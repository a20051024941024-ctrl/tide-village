-- 潮汐釣魚村 v295：玩家說「餌料很少，可以做特定的」→ 新增 9 種針對特定魚的餌（可以重複執行）
-- 商店買：玉米粒 corn、紅蟲 redworm、麵包糰 bread、蝦仁 shrimpmeat、南極蝦 krill
-- 自己拿：沙蠶 lugworm（退潮時在沙灘挖，gather_bait）、螃蟹 crabbait（礁岩區撿，gather_bait）
-- 阿鐵師傅做：秋刀魚切塊 saurychunk（1 條秋刀魚＋20 金幣 → 4 個，craft_bait）
-- 蔚博士的委託：夜光蟲餌 nightbug（把今天發現的新品種釣上來給他看，一天一次，sci_bug）
-- 哪種餌吸引哪些魚寫在 fishcfg（baits.fav），roll_fish（020）照這個算：愛吃的魚 ×1.8（傳說 ×1.3），其他魚 ×0.88

create table if not exists public.bait_gather (
  uid uuid not null references public.players(id) on delete cascade,
  day date not null, kind text not null, n integer not null default 0,
  primary key (uid, day, kind));
alter table public.bait_gather enable row level security;

create or replace function public._bait_info(p text, out price integer, out pack integer) language sql immutable as $$
  select case p when 'worm' then 20 when 'glow' then 60 when 'squidbait' then 150 when 'gold' then 300 when 'rainbow' then 900
                when 'corn' then 30 when 'redworm' then 25 when 'bread' then 20 when 'shrimpmeat' then 80 when 'krill' then 50
                when 'chum_rice' then 40 when 'chum_krill' then 120 when 'chum_gold' then 500 end,
         case p when 'worm' then 10 when 'glow' then 5 when 'squidbait' then 5 when 'gold' then 3 when 'rainbow' then 2
                when 'corn' then 10 when 'redworm' then 10 when 'bread' then 10 when 'shrimpmeat' then 6 when 'krill' then 8
                when 'chum_rice' then 3 when 'chum_krill' then 3 when 'chum_gold' then 2 end $$;

-- 阿鐵師傅做餌：活餌（2 條常見魚＋30 金幣 → 4 個）、秋刀魚切塊（1 條秋刀魚＋20 金幣 → 4 個）；兩種加起來每人每天最多 8 次
create or replace function public.craft_bait(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer;
  need integer; cost integer; pack integer := 4;
begin
  if p_id not in ('live', 'saurychunk') then raise exception '阿鐵師傅不會做這種餌'; end if;
  need := case p_id when 'live' then 2 else 1 end; cost := case p_id when 'live' then 30 else 20 end;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  select nb into cnt from public.craft_log where uid = pl.id and day = td;
  if coalesce(cnt, 0) >= 8 then raise exception '魚餌今天做夠多了，明天再來'; end if;
  if coalesce((pl.bait ->> p_id)::integer, 0) >= 99 then raise exception '這種餌已經很多了，先用掉一些'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where (case when p_id = 'live' then coalesce(cfg->'fish'->(x->>'f')->>'r', '常見') = '常見' and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false)
                else x->>'f' = 'saury' end)
      and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit need) q;
  if coalesce(array_length(use, 1), 0) < need then raise exception '%', case when p_id = 'live' then '魚不夠：要 2 條常見的魚（收藏、展示中的不算）' else '要 1 條秋刀魚（收藏、展示中的不算）' end; end if;
  update public.players set coins = coins - cost,
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[p_id], to_jsonb(least(99, coalesce((bait ->> p_id)::integer, 0) + pack))),
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n, nb) values (pl.id, td, 0, 1) on conflict (uid, day) do update set nb = public.craft_log.nb + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use));
end $$;
revoke all on function public.craft_bait(text) from public, anon;
grant execute on function public.craft_bait(text) to authenticated;

-- 自己拿餌：沙蠶（退潮或乾潮時在沙灘挖，一次 2 隻）、螃蟹（礁岩區撿，一次 1 隻）；每種每人每天最多 6 次
create or replace function public.gather_bait(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; got integer; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if p_kind not in ('lugworm', 'crabbait') then raise exception '沒有這種東西'; end if;
  if p_kind = 'lugworm' and sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) >= -0.3 then raise exception '現在水還很高，退潮的時候沙灘露出來才挖得到沙蠶'; end if;
  select n into cnt from public.bait_gather where uid = pl.id and day = td and kind = p_kind;
  if coalesce(cnt, 0) >= 6 then raise exception '%', case when p_kind = 'lugworm' then '今天挖夠多了，明天再來' else '今天撿夠多了，明天再來' end; end if;
  got := case when p_kind = 'lugworm' then 2 else 1 end;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[p_kind], to_jsonb(least(99, coalesce((bait ->> p_kind)::integer, 0) + got))), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.bait_gather (uid, day, kind, n) values (pl.id, td, p_kind, 1) on conflict (uid, day, kind) do update set n = public.bait_gather.n + 1 returning n into cnt;
  return jsonb_build_object('player', to_jsonb(pl), 'got', got, 'left', 6 - cnt);
end $$;
revoke all on function public.gather_bait(text) from public, anon;
grant execute on function public.gather_bait(text) to authenticated;

-- 蔚博士的委託：魚缸裡有「今天釣到的、今天發現的新品種」→ 送 3 個夜光蟲餌（一天一次）
create or replace function public.sci_bug() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; sid text; t0 bigint; cnt integer;
begin
  select id into sid from public.sci_finds where day = td; if sid is null then raise exception '蔚博士今天還在調查，等一下再來'; end if;
  t0 := (extract(epoch from (td::timestamp at time zone 'Asia/Taipei')) * 1000)::bigint;
  if not exists (select 1 from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'f' = sid or x->>'f' like sid || '\_%') and (x->>'t')::bigint >= t0) then
    raise exception '還沒看到今天的新品種喔：先把牠釣上來（要放在魚缸裡）'; end if;
  select n into cnt from public.bait_gather where uid = pl.id and day = td and kind = 'nightbug';
  if coalesce(cnt, 0) >= 1 then raise exception '今天已經拿過了，明天再來'; end if;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array['nightbug'], to_jsonb(least(99, coalesce((bait ->> 'nightbug')::integer, 0) + 3))), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.bait_gather (uid, day, kind, n) values (pl.id, td, 'nightbug', 1) on conflict (uid, day, kind) do update set n = public.bait_gather.n + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'got', 3);
end $$;
revoke all on function public.sci_bug() from public, anon;
grant execute on function public.sci_bug() to authenticated;
