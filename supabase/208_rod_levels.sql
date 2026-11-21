-- 潮汐釣魚村 v637：釣具改版第三次——新的釣竿陣容、升級、舊竿免費換（可以重複執行）
-- 作者的「釣具大改版計畫」＋決定：舊竿 C（停賣照用，想換就免費換）、王者竿全能中等＋補償。
-- * 商店只賣 6 支：竹竿（免費）、路亞軟竿 r_lure、磯釣硬竿 r_iso、遠投竿 r_surf、手竿 r_pole、黃金王者竿 king。
-- * 四支專用竿可以升級 1～5 級（players.rod_lv：{ 竿子: 等級 }），每級要金幣＋魚缸裡的魚（收藏、展示中的不算，先用最小的）：
--     2 級 800＋常見 3 條｜3 級 2000＋稀有 2 條｜4 級 4500＋稀有 4 條｜5 級 9000＋傳說 1 條
--   效果在 020 roll_fish（稀有 ×1.1／1.2／1.35／1.5、傳說 1／1.1／1.25／1.4）；拉力、竿尖發光在 js/game.js。
-- * 舊的 10 支竿停賣（買過的照用）；rod_swap(舊竿) 免費換成對應的專用竿和等級，跟這支竿的紀錄（rod_log）一起帶過去。
alter table public.players add column if not exists rod_lv jsonb not null default '{}'::jsonb;

create or replace function public._rod_price(p text) returns integer language sql immutable as $$
  select case p when 'bamboo' then 0 when 'r_pole' then 500 when 'r_lure' then 800 when 'r_iso' then 800 when 'r_surf' then 800 when 'king' then 12000
                -- 停賣的舊竿：只能換上（已經有的），不能再買（buy_rod 會擋）
                when 'carbon' then 400 when 'lure' then 1200 when 'deep' then 2500 when 'moon' then 5000
                when 'pole_bamboo' then 300 when 'pole_carbon' then 1800 when 'surf_basic' then 900 when 'surf_pro' then 4000
                when 'iso_basic' then 1000 when 'iso_pro' then 4500 else null end $$;
create or replace function public._rod_old(p text) returns boolean language sql immutable as $$
  select p in ('carbon', 'lure', 'deep', 'moon', 'pole_bamboo', 'pole_carbon', 'surf_basic', 'surf_pro', 'iso_basic', 'iso_pro') $$;
-- 舊竿 → [新竿, 等級]
create or replace function public._rod_swap_to(p text) returns jsonb language sql immutable as $$
  select (case p when 'carbon' then '["r_lure",2]' when 'lure' then '["r_lure",3]' when 'moon' then '["r_lure",4]' when 'deep' then '["r_surf",3]'
                 when 'pole_bamboo' then '["r_pole",2]' when 'pole_carbon' then '["r_pole",3]' when 'surf_basic' then '["r_surf",2]' when 'surf_pro' then '["r_surf",4]'
                 when 'iso_basic' then '["r_iso",2]' when 'iso_pro' then '["r_iso",4]' else null end)::jsonb $$;

create or replace function public.buy_rod(p_rod text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._rod_price(p_rod);
begin
  if price is null then raise exception '沒有這支釣竿'; end if;
  if p_rod = any(pl.rods) or p_rod = 'bamboo' then
    update public.players set rod = p_rod, updated_at = now() where id = pl.id returning * into pl; return pl;
  end if;
  if public._rod_old(p_rod) then raise exception '這支釣竿已經停賣了'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, rods = array_append(rods, p_rod), rod = p_rod,
    rod_lv = jsonb_set(coalesce(rod_lv, '{}'::jsonb), array[p_rod], to_jsonb(greatest(1, coalesce((rod_lv->>p_rod)::int, 1)))), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.rod_upgrade(p_rod text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); lv integer; c integer; n integer; r text; use text[];
begin
  if p_rod not in ('r_lure', 'r_iso', 'r_surf', 'r_pole') then raise exception '這支釣竿不能升級'; end if;
  select * into pl from public.players where id = pl.id for update;
  if not (p_rod = any(pl.rods)) then raise exception '你還沒有這支釣竿'; end if;
  lv := coalesce((pl.rod_lv->>p_rod)::int, 1);
  if lv >= 5 then raise exception '已經是最高的 5 級了'; end if;
  c := (array[800, 2000, 4500, 9000])[lv]; n := (array[3, 2, 4, 1])[lv]; r := (array['常見', '稀有', '稀有', '傳說'])[lv];
  if pl.coins < c then raise exception '金幣不夠'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where coalesce(cfg->'fish'->(x->>'f')->>'r', (select rarity from public.fish_species where id = x->>'f'), '常見') = r
      and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit n) q;
  if coalesce(array_length(use, 1), 0) < n then raise exception '魚不夠：要 % 條%的魚（收藏、展示中的不算）', n, r; end if;
  update public.players set coins = coins - c,
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    rod_lv = jsonb_set(coalesce(rod_lv, '{}'::jsonb), array[p_rod], to_jsonb(lv + 1)), updated_at = now()
  where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use), 'lv', lv + 1);
end $$;

create or replace function public.rod_swap(p_old text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m jsonb := public._rod_swap_to(p_old); nw text; nlv integer; o jsonb; t jsonb;
begin
  if m is null then raise exception '這支釣竿不用換'; end if;
  select * into pl from public.players where id = pl.id for update;
  if not (p_old = any(pl.rods)) then raise exception '你沒有這支釣竿'; end if;
  nw := m->>0; nlv := (m->>1)::int; o := coalesce(pl.rod_log->p_old, '{}'::jsonb); t := coalesce(pl.rod_log->nw, '{}'::jsonb);
  update public.players set
    rods = array_append(array_remove(rods, nw), nw),
    rod = case when rod = p_old then nw else rod end,
    rod_lv = jsonb_set(coalesce(rod_lv, '{}'::jsonb), array[nw], to_jsonb(greatest(nlv, coalesce((rod_lv->>nw)::int, 1)))),
    rod_log = case when o = '{}'::jsonb then rod_log else jsonb_set(coalesce(rod_log, '{}'::jsonb) - p_old, array[nw], jsonb_build_object(
      'n', coalesce((o->>'n')::int, 0) + coalesce((t->>'n')::int, 0),
      'f', case when coalesce((o->>'w')::numeric, 0) >= coalesce((t->>'w')::numeric, 0) then o->'f' else t->'f' end,
      'w', greatest(coalesce((o->>'w')::numeric, 0), coalesce((t->>'w')::numeric, 0)))) end,
    updated_at = now()
  where id = pl.id returning * into pl;
  update public.players set rods = array_remove(rods, p_old) where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public._rod_old(text) from public, anon, authenticated;
revoke all on function public._rod_swap_to(text) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['buy_rod(text)', 'rod_upgrade(text)', 'rod_swap(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
