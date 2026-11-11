-- 潮汐釣魚村 v370：小島菜園（可以重複執行）
-- 每個人的小島西邊有一塊菜園，一開始 4 格（可以用金幣開墾到 8、12 格）。買種子種下去，照現實時間長大，澆水會長快一點，成熟後收成換金幣。
-- 作物、時間、價錢都在這裡（_farm_crop），手機上的數字只是顯示用；種、澆水、收成都由伺服器算時間和金幣。
-- 朋友來島上可以幫忙澆水（幫忙的人每次 🪙10，一天最多 10 次）。忘記澆水不會枯死，只是長得慢。
create table if not exists public.farm_plots (
  owner      uuid not null,
  slot       integer not null,
  crop       text not null,
  planted_at timestamptz not null default now(),
  waters     integer not null default 0,
  watered_at timestamptz,
  primary key (owner, slot)
);
alter table public.farm_plots enable row level security;
revoke all on public.farm_plots from anon, authenticated;
alter table public.players add column if not exists farm_n integer not null default 4;
alter table public.players add column if not exists farm_help_day date;
alter table public.players add column if not exists farm_help_n integer not null default 0;

-- 種子價、收成價、要幾秒才熟
create or replace function public._farm_crop(p text, out seed integer, out sell integer, out secs integer) language sql immutable as $$
  select c.seed, c.sell, c.secs from (values
    ('tomato', 15, 45, 7200), ('cabbage', 25, 80, 14400), ('corn', 35, 100, 21600),
    ('sweetpotato', 45, 150, 28800), ('strawberry', 70, 220, 43200), ('pumpkin', 120, 420, 86400)
  ) as c(id, seed, sell, secs) where c.id = p
$$;
-- 這一格什麼時候熟：每澆一次水少 12% 的時間（最多算 3 次）
create or replace function public._farm_ripe_at(p_crop text, p_planted timestamptz, p_waters integer) returns timestamptz language sql immutable as $$
  select p_planted + make_interval(secs => (select secs from public._farm_crop(p_crop)) * (1 - 0.12 * least(3, greatest(0, p_waters))))
$$;

create or replace function public.farm_get(p_owner uuid default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owner', o.id, 'n', coalesce((select farm_n from public.players where id = o.id), 4), 'now', floor(extract(epoch from now()) * 1000),
    'plots', coalesce((select jsonb_agg(jsonb_build_object('s', f.slot, 'c', f.crop, 't', floor(extract(epoch from f.planted_at) * 1000), 'w', f.waters,
        'wa', case when f.watered_at is null then null else floor(extract(epoch from f.watered_at) * 1000) end) order by f.slot) from public.farm_plots f where f.owner = o.id), '[]'::jsonb))
  from (select coalesce(p_owner, auth.uid()) as id) o
$$;

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 or p_slot >= pl.farm_n then raise exception '這一格還沒開墾'; end if;
  if exists (select 1 from public.farm_plots where owner = pl.id and slot = p_slot) then raise exception '這一格已經種東西了'; end if;
  if pl.coins < c.seed then raise exception '金幣不夠買種子'; end if;
  insert into public.farm_plots (owner, slot, crop) values (pl.id, p_slot, p_crop);
  update public.players set coins = coins - c.seed, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.farm_water(p_owner uuid, p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f public.farm_plots; own uuid := coalesce(p_owner, pl.id); today date := (now() at time zone 'Asia/Taipei')::date; pay integer := 0;
begin
  select * into f from public.farm_plots where owner = own and slot = p_slot for update;
  if not found then raise exception '這一格沒有種東西'; end if;
  if now() >= public._farm_ripe_at(f.crop, f.planted_at, f.waters) then raise exception '已經成熟了，不用澆水'; end if;
  if f.waters >= 3 then raise exception '水已經夠了'; end if;
  if f.watered_at is not null and f.watered_at > now() - interval '1 hour' then raise exception '剛澆過水，一小時後再來'; end if;
  update public.farm_plots set waters = waters + 1, watered_at = now() where owner = own and slot = p_slot;
  if own <> pl.id then   -- 幫別人澆水：🪙10，一天最多 10 次
    if pl.farm_help_day is distinct from today then pl.farm_help_n := 0; end if;
    if pl.farm_help_n < 10 then pay := 10; end if;
    update public.players set coins = coins + pay, earned = earned + pay, farm_help_day = today, farm_help_n = pl.farm_help_n + 1, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

create or replace function public.farm_harvest(p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f public.farm_plots; c record; pay integer;
begin
  select * into f from public.farm_plots where owner = pl.id and slot = p_slot for update;
  if not found then raise exception '這一格沒有種東西'; end if;
  if now() < public._farm_ripe_at(f.crop, f.planted_at, f.waters) then raise exception '還沒成熟'; end if;
  select * into c from public._farm_crop(f.crop);
  pay := round(c.sell * (case when f.waters >= 2 then 1.5 else 1 end));   -- 澆過兩次水以上：豐收，多五成
  delete from public.farm_plots where owner = pl.id and slot = p_slot;
  update public.players set coins = coins + pay, earned = earned + pay,
    bait = case when f.crop = 'corn' then jsonb_set(coalesce(bait, '{}'::jsonb), array['corn'], to_jsonb(least(999, coalesce((bait ->> 'corn')::integer, 0) + 5))) else bait end,   -- 玉米另外送 5 份玉米粒魚餌
    updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.farm_unlock() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cost integer;
begin
  if pl.farm_n >= 12 then raise exception '菜園已經開到最大了'; end if;
  cost := case when pl.farm_n < 8 then 2000 else 5000 end;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost, farm_n = least(12, farm_n + 4), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.farm_get(uuid), public.farm_plant(integer, text), public.farm_water(uuid, integer), public.farm_harvest(integer), public.farm_unlock() from public, anon;
revoke all on function public._farm_crop(text), public._farm_ripe_at(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.farm_get(uuid), public.farm_plant(integer, text), public.farm_water(uuid, integer), public.farm_harvest(integer), public.farm_unlock() to authenticated;
