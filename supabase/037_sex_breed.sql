-- 潮汐釣魚村：魚的公母、野外繁殖季、水族館繁殖（可以重複執行）
-- 釣到的魚一半公一半母（roll_fish 抽的時候決定，記在 cast_sex；020）。
-- 春天、夏天是野外繁殖季：吳郭魚、鯽魚這些會自己生的魚比較多、小魚比較多；母吳郭魚有三成嘴裡含著小魚（放流多 5 點愛海點數）。
-- 水族館裡展示同一種魚的一公一母，每天有一半的機會生一條小魚（每天最多 3 條；只有真的養得起來會生的魚）。小魚賣的錢只有四分之一。
alter table public.players add column if not exists breed_at timestamptz;
-- 以前釣的魚沒有記公母：用時間決定（偶數公、奇數母；跟 js/game.js 的 normRec 一樣）
update public.players set tank = (select jsonb_agg(case when e ? 's' then e else e || jsonb_build_object('s', case when (e->>'t')::bigint % 2 = 0 then 'M' else 'F' end) end order by i) from jsonb_array_elements(tank) with ordinality x(e, i))
where jsonb_typeof(tank) = 'array' and jsonb_array_length(tank) > 0 and exists (select 1 from jsonb_array_elements(tank) e where not e ? 's');

create or replace function public._tank_breed_ok(p text) returns boolean language sql immutable as $$
  select p = any(array['goldfish','koi','carp','crucian','tilapia','clown','medaka','prawn','crayfish','seahorse','loach','pseudorasbora']) $$;   -- 要跟 js/game.js 的 TANK_BREED 一樣

-- 水族館繁殖：從上次算到現在，每滿一天、每一對（同一種的一公一母都在展示中）有一半機會生一條小魚
create or replace function public.breed_tank() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); days integer; born jsonb := '[]'::jsonb; sp record; d integer; k integer; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; pairs integer; n integer := 0; fsp public.fish_species;
begin
  if pl.breed_at is null then update public.players set breed_at = now() where id = pl.id; return jsonb_build_object('born', born, 'tank', pl.tank); end if;
  days := least(3, floor(extract(epoch from now() - pl.breed_at) / 86400)::integer);
  if days < 1 then return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint); end if;
  for sp in select e->>'f' as f, count(*) filter (where e->>'s' = 'M') as m, count(*) filter (where e->>'s' = 'F') as fm
             from jsonb_array_elements(pl.tank) e where pl.show @> jsonb_build_array(e->'t') and public._tank_breed_ok(e->>'f') group by e->>'f' loop
    pairs := least(sp.m, sp.fm); if pairs < 1 then continue; end if;
    select * into fsp from public.fish_species where id = sp.f; if not found then continue; end if;
    for d in 1..days loop for k in 1..pairs loop
      if n >= 3 * days then exit; end if;
      if random() < 0.5 then n := n + 1; ts := ts + 1;
        born := born || jsonb_build_array(jsonb_build_object('f', sp.f, 'w', round(fsp.min_w::numeric, 2), 't', ts, 's', case when random() < 0.5 then 'M' else 'F' end, 'y', true)); end if;
    end loop; end loop;
  end loop;
  update public.players set tank = public._trim_tank(born || tank, show), breed_at = breed_at + make_interval(days => days), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint);
end $$;
revoke all on function public.breed_tank() from public, anon;
grant execute on function public.breed_tank() to authenticated;

-- 賣魚：水族館生的小魚只值四分之一（其他跟 032 一樣：紅鯊不能賣）
create or replace function public.sell_fish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0;
begin
  select coalesce(sum(round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end))), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs');
  if cnt = 0 then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i)
            where not ((e->>'t')::bigint = any(p_ts) and not (show @> jsonb_build_array(e->'t')) and not (e ? 'rs'))),
    coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;


-- 放生：嘴裡含著小魚的母魚多 5 點（其他跟 032 一樣）
create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer; fid text; rs text;
begin
  select public._love_pts(sp, (e->>'w')::numeric) + (case when e ? 'b' then 5 else 0 end), sp.id, e->>'rs' into pts, fid, rs
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = p_ts limit 1;
  if pts is null then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    love = love + pts, released = released + 1, updated_at = now()
  where id = pl.id returning * into pl;
  if fid = 'bluelobster' then
    update public.shrimp_events set caught_by = null, caught_name = null, caught_w = null, caught_at = null, hooked_by = null, hooked_at = null
    where fish = fid and caught_by = pl.id and end_at > now();
  end if;
  if fid = 'shark_red' and rs is not null then
    update public.red_sharks set status = 'sea', hooked_by = null, hooked_at = null where id = split_part(rs, ':', 1)::integer and caught_by = pl.id and status = 'caught';
  end if;
  return pl;
end $$;
revoke all on function public.release_fish(bigint) from public, anon;
grant execute on function public.release_fish(bigint) to authenticated;


select '公母和繁殖設定完成 🐣' as result;
