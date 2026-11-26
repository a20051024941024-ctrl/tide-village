-- 236 潮汐釣魚村 v868：做東西的時候可以自己挑要用哪條魚。可以重複執行。要先貼過 233、234。
-- 做法：craft_item / mat_scale 外面包一層，多收一個「選的魚」(p_fish)；沒選的話跟以前一樣自動用最輕的。

/* 拿魚：如果這次有指定魚（存在 tide.pick），就檢查指定的魚能不能用；沒指定就照舊用最輕的 */
create or replace function public._take_fish(pl public.players, n integer, r text) returns text[] language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := public._fishcfg(); use text[]; pk text := current_setting('tide.pick', true); pick text[];
begin
  if n <= 0 then return array[]::text[]; end if;
  if pk is not null and pk <> '' then
    pick := array(select distinct jsonb_array_elements_text(pk::jsonb));
    if coalesce(array_length(pick, 1), 0) <> n then raise exception '要選剛好 % 條魚', n; end if;
    select array_agg(x->>'t') into use from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where x->>'t' = any(pick)
      and coalesce(cfg->'fish'->(x->>'f')->>'r', (select rarity from public.fish_species where id = x->>'f'), '常見') = r
      and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t');
    if coalesce(array_length(use, 1), 0) <> n then raise exception '選的魚有的不能用（要%的魚，收藏、展示中的不行），請重新選', r; end if;
    return use;
  end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where coalesce(cfg->'fish'->(x->>'f')->>'r', (select rarity from public.fish_species where id = x->>'f'), '常見') = r
      and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit n) q;
  if coalesce(array_length(use, 1), 0) < n then return null; end if;
  return use;
end $$;

/* 舊的 craft_item(text)、mat_scale(text,int) 改名當內部用，外面換成多收 p_fish 的版本 */
do $$ begin
  if to_regprocedure('public.craft_item(text)') is not null then
    drop function if exists public._craft_item0(text);
    alter function public.craft_item(text) rename to _craft_item0;
  end if;
  if to_regprocedure('public.mat_scale(text,integer)') is not null then
    drop function if exists public._mat_scale0(text, integer);
    alter function public.mat_scale(text, integer) rename to _mat_scale0;
  end if;
end $$;
revoke all on function public._craft_item0(text) from public, anon, authenticated;
revoke all on function public._mat_scale0(text, integer) from public, anon, authenticated;

create or replace function public.craft_item(p_id text, p_fish text[] default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tide.pick', case when coalesce(array_length(p_fish, 1), 0) > 0 then to_jsonb(p_fish)::text else '' end, true);
  return public._craft_item0(p_id);
end $$;

create or replace function public.mat_scale(p_r text, p_n integer, p_fish text[] default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(p_fish, 1), 0) > 0 then p_n := array_length(p_fish, 1); end if;
  perform set_config('tide.pick', case when coalesce(array_length(p_fish, 1), 0) > 0 then to_jsonb(p_fish)::text else '' end, true);
  return public._mat_scale0(p_r, p_n);
end $$;

/* 魚餌：活餌要 1 條常見魚、秋刀魚切塊要 1 條秋刀魚，現在可以自己挑那 1 條 */
drop function if exists public.craft_bait(text);
create or replace function public.craft_bait(p_id text, p_fish text[] default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer;
  cost integer; pack integer := 4; sc integer := 0; pick text := case when coalesce(array_length(p_fish, 1), 0) > 0 then p_fish[1] end;
begin
  if p_id not in ('live', 'saurychunk') then raise exception '阿鐵師傅不會做這種餌'; end if;
  cost := case p_id when 'live' then 30 else 20 end; sc := case p_id when 'live' then 1 else 0 end;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  if coalesce((pl.bait ->> 'mat_scale')::integer, 0) < sc then raise exception '材料不夠：還缺魚鱗'; end if;
  select nb into cnt from public.craft_log where uid = pl.id and day = td;
  if coalesce(cnt, 0) >= 8 then raise exception '魚餌今天做夠多了，明天再來'; end if;
  if coalesce((pl.bait ->> p_id)::integer, 0) >= 99 then raise exception '這種餌已經很多了，先用掉一些'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where (case when p_id = 'live' then coalesce(cfg->'fish'->(x->>'f')->>'r', '常見') = '常見' and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false)
                else x->>'f' = 'saury' end)
      and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
      and (pick is null or x->>'t' = pick)
    order by (x->>'w')::numeric limit 1) q;
  if coalesce(array_length(use, 1), 0) < 1 then raise exception '%', case when pick is not null then '選的魚不能用，請重新選' when p_id = 'live' then '魚不夠：要 1 條常見的魚（收藏、展示中的不算）' else '要 1 條秋刀魚（收藏、展示中的不算）' end; end if;
  update public.players set coins = coins - cost,
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    bait = public._bag_add(jsonb_set(coalesce(bait, '{}'::jsonb), array[p_id], to_jsonb(least(99, coalesce((bait ->> p_id)::integer, 0) + pack))), 'mat_scale', -sc),
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n, nb) values (pl.id, td, 0, 1) on conflict (uid, day) do update set nb = public.craft_log.nb + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use));
end $$;

do $$ declare f text; begin
  foreach f in array array['craft_item(text,text[])', 'craft_bait(text,text[])', 'mat_scale(text,integer,text[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
