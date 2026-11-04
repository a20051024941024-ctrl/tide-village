-- 潮汐釣魚村：箱網養殖（參考澎湖的圓形箱網）（可以重複執行）
-- 每個人一個箱網，最多放 6 條；只能放真的有人在養的魚。每天可以餵一次飼料（20 金幣），餵了每條魚往最大重量長 12%。
-- 收成時魚回到魚缸，重量是養大以後的（標 fm=養殖），排行榜和最重紀錄只算自己釣到的，不受影響。
alter table public.players add column if not exists cage jsonb not null default '[]'::jsonb;
alter table public.players add column if not exists cage_fed date;

create or replace function public._cage_ok(f text) returns boolean language sql immutable as $$
  select f = any(array['grouper','amberjack','blackbream','girella','rabbitfish','lethrinus','milkfish','tilapia','mullet','barramundi','scat','mangsnapper','trevally']) $$;

create or replace function public.cage_put(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb;
begin
  if jsonb_array_length(pl.cage) >= 6 then raise exception '箱網最多放 6 條'; end if;
  select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_ts and not (x ? 'rs') limit 1;
  if e is null then raise exception '找不到這條魚'; end if;
  if not public._cage_ok(e->>'f') then raise exception '這種魚不能放進箱網'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality q(x, i) where (x->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    cage = cage || jsonb_build_array((e - 'fm') || jsonb_build_object('w0', e->'w', 'at', (extract(epoch from now()) * 1000)::bigint)),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.cage_feed() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if jsonb_array_length(pl.cage) = 0 then raise exception '箱網裡還沒有魚'; end if;
  if pl.cage_fed = d then raise exception '今天已經餵過了'; end if;
  if pl.coins < 20 then raise exception '金幣不夠'; end if;
  update public.players set
    cage = (select coalesce(jsonb_agg(x || jsonb_build_object('w', least(sp.max_w, round((x->>'w')::numeric + (sp.max_w - (x->>'w')::numeric) * 0.12, 2))) order by i), '[]'::jsonb)
            from jsonb_array_elements(cage) with ordinality q(x, i) join public.fish_species sp on sp.id = x->>'f'),
    coins = coins - 20, cage_fed = d, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.cage_take(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb;
begin
  select x into e from jsonb_array_elements(pl.cage) x where (x->>'t')::bigint = p_ts limit 1;
  if e is null then raise exception '找不到這條魚'; end if;
  update public.players set
    cage = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(cage) with ordinality q(x, i) where (x->>'t')::bigint <> p_ts),
    tank = public._trim_tank(jsonb_build_array((e - 'w0' - 'at') || jsonb_build_object('fm', true)) || tank, show),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['cage_put(bigint)', 'cage_feed()', 'cage_take(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '箱網養殖設定完成 🐟' as result;
