-- 潮汐釣魚村 v374：小島海底花園（可以重複執行）
-- 從小島碼頭的潛水梯下去，海底有幾格「海床」可以種海底的作物：海帶、海葡萄、珊瑚、珍珠貝。
-- 跟菜園用同一張表（farm_plots），海底的格子編號從 100 開始；種子一樣放背包、在種子攤買。
-- 海底的作物不用澆水（也不會豐收加成），長得比較慢。一開始 4 格，可以開墾到 8 格；以後要再加，改 _sea_next 那張表就好。
alter table public.players add column if not exists sea_n integer not null default 4;

create or replace function public._farm_crop(p text, out seed integer, out sell integer, out secs integer) language sql immutable as $$
  select c.seed, c.sell, c.secs from (values
    ('tomato', 15, 45, 7200), ('cabbage', 25, 80, 14400), ('corn', 35, 100, 21600),
    ('sweetpotato', 45, 150, 28800), ('strawberry', 70, 220, 43200), ('pumpkin', 120, 420, 86400),
    ('watermelon', 90, 330, 57600), ('carrot', 30, 105, 18000), ('grape', 100, 380, 64800), ('sunflower', 60, 215, 36000),
    ('kelp', 20, 70, 10800), ('seagrape', 50, 170, 28800), ('coral', 150, 560, 129600), ('oyster', 200, 760, 172800)
  ) as c(id, seed, sell, secs) where c.id = p
$$;
create or replace function public._farm_is_sea(p text) returns boolean language sql immutable as $$ select p in ('kelp', 'seagrape', 'coral', 'oyster') $$;
create or replace function public._sea_next(p_n integer, out n integer, out cost integer) language sql immutable as $$
  select s.n, s.cost from (values (8, 3000)) as s(n, cost) where s.n > coalesce(p_n, 4) order by s.n limit 1
$$;
create or replace function public._sea_max() returns integer language sql stable as $$
  select greatest(4, coalesce((select max(q.n) from generate_series(4, 60, 4) g, lateral public._sea_next(g) q), 4))
$$;

create or replace function public.farm_get(p_owner uuid default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owner', o.id, 'n', o.n, 'max', public._farm_max(), 'now', floor(extract(epoch from now()) * 1000),
    'next', (select case when q.n is null then null else jsonb_build_object('n', q.n, 'cost', q.cost) end from public._farm_next(o.n) q),
    'sea', jsonb_build_object('n', o.sn, 'max', public._sea_max(), 'next', (select case when q.n is null then null else jsonb_build_object('n', q.n, 'cost', q.cost) end from public._sea_next(o.sn) q)),
    'plots', coalesce((select jsonb_agg(jsonb_build_object('s', f.slot, 'c', f.crop, 't', floor(extract(epoch from f.planted_at) * 1000), 'w', f.waters,
        'wa', case when f.watered_at is null then null else floor(extract(epoch from f.watered_at) * 1000) end) order by f.slot) from public.farm_plots f where f.owner = o.id), '[]'::jsonb))
  from (select i.id, coalesce((select farm_n from public.players where id = i.id), 4) as n, coalesce((select sea_n from public.players where id = i.id), 4) as sn from (select coalesce(p_owner, auth.uid()) as id) i) o
$$;

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer; sea boolean := public._farm_is_sea(p_crop);
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 then raise exception '這一格還沒開墾'; end if;
  if p_slot >= 100 then
    if not sea then raise exception '這種種子要種在菜園'; end if;
    if p_slot - 100 >= pl.sea_n then raise exception '這一格還沒開墾'; end if;
  else
    if sea then raise exception '這種種子要種在海底'; end if;
    if p_slot >= pl.farm_n then raise exception '這一格還沒開墾'; end if;
  end if;
  if exists (select 1 from public.farm_plots where owner = pl.id and slot = p_slot) then raise exception '這一格已經種東西了'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 and (sea or not public._farm_on_sale(p_crop)) then raise exception '背包裡沒有這種種子'; end if;
  if have < 1 and pl.coins < c.seed then raise exception '金幣不夠買種子'; end if;
  insert into public.farm_plots (owner, slot, crop) values (pl.id, p_slot, p_crop);
  if have >= 1 then
    update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - c.seed, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

create or replace function public.farm_water(p_owner uuid, p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f public.farm_plots; own uuid := coalesce(p_owner, pl.id); today date := (now() at time zone 'Asia/Taipei')::date; pay integer := 0;
begin
  if p_slot >= 100 then raise exception '海底的不用澆水'; end if;
  select * into f from public.farm_plots where owner = own and slot = p_slot for update;
  if not found then raise exception '這一格沒有種東西'; end if;
  if now() >= public._farm_ripe_at(f.crop, f.planted_at, f.waters) then raise exception '已經成熟了，不用澆水'; end if;
  if f.waters >= 3 then raise exception '水已經夠了'; end if;
  if f.watered_at is not null and f.watered_at > now() - interval '1 hour' then raise exception '剛澆過水，一小時後再來'; end if;
  update public.farm_plots set waters = waters + 1, watered_at = now() where owner = own and slot = p_slot;
  if own <> pl.id then
    if pl.farm_help_day is distinct from today then pl.farm_help_n := 0; end if;
    if pl.farm_help_n < 10 then pay := 10; end if;
    update public.players set coins = coins + pay, earned = earned + pay, farm_help_day = today, farm_help_n = pl.farm_help_n + 1, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

create or replace function public.farm_unlock_sea() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); nx record;
begin
  select * into nx from public._sea_next(pl.sea_n);
  if nx.n is null then raise exception '海底花園已經開到最大了'; end if;
  if pl.coins < nx.cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - nx.cost, sea_n = nx.n, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public._farm_is_sea(text), public._sea_next(integer), public._sea_max() from public, anon, authenticated;
revoke all on function public.farm_unlock_sea() from public, anon;
grant execute on function public.farm_unlock_sea() to authenticated;
