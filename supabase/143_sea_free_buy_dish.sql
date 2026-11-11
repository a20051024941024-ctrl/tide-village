-- 潮汐釣魚村 v377（可以重複執行）
-- 一、海底花園改成「拿著種子，海底想種哪裡就種哪裡」：不再是固定的格子，每一株記自己的位置（px、pz，相對海底中心的公尺數）。
--     還是有數量上限（sea_n，一開始 4 株，可以開到 8、12、16 株）；兩株之間至少隔 1.5 公尺。舊的（沒有位置的）照原本的格子畫。
-- 二、食堂可以直接買料理：一星的成品，價錢是料理價值的 2.5 倍（買來再賣回去一定虧），一天最多買 6 道。
alter table public.farm_plots add column if not exists px real;
alter table public.farm_plots add column if not exists pz real;
alter table public.players add column if not exists dish_buy_day date;
alter table public.players add column if not exists dish_buy_n integer not null default 0;

-- 三、海底的裝飾品：在種子攤買（放背包，名字是 deco_種類），拿在手上到海底想放哪裡就放哪裡，可以再收回背包。一個人最多放 12 個。
create table if not exists public.sea_decor (
  id    bigint generated always as identity primary key,
  owner uuid not null,
  kind  text not null,
  px    real not null,
  pz    real not null,
  rot   real not null default 0
);
create index if not exists sea_decor_owner on public.sea_decor (owner);
alter table public.sea_decor enable row level security;
revoke all on public.sea_decor from anon, authenticated;
create or replace function public._sea_deco_price(p text) returns integer language sql immutable as $$
  select v.c from (values ('amphora', 300), ('bubble', 400), ('clam', 500), ('anchor', 600), ('lantern', 700), ('chest', 800), ('statue', 1200), ('arch', 1500)) v(k, c) where v.k = p
$$;
create or replace function public._sea_next(p_n integer, out n integer, out cost integer) language sql immutable as $$
  select s.n, s.cost from (values (8, 3000), (12, 8000), (16, 15000)) as s(n, cost) where s.n > coalesce(p_n, 4) order by s.n limit 1
$$;

create or replace function public.farm_get(p_owner uuid default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owner', o.id, 'n', o.n, 'max', public._farm_max(), 'now', floor(extract(epoch from now()) * 1000),
    'next', (select case when q.n is null then null else jsonb_build_object('n', q.n, 'cost', q.cost) end from public._farm_next(o.n) q),
    'sea', jsonb_build_object('n', o.sn, 'max', public._sea_max(), 'next', (select case when q.n is null then null else jsonb_build_object('n', q.n, 'cost', q.cost) end from public._sea_next(o.sn) q)),
    'plots', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('s', f.slot, 'c', f.crop, 't', floor(extract(epoch from f.planted_at) * 1000), 'w', f.waters,
        'wa', case when f.watered_at is null then null else floor(extract(epoch from f.watered_at) * 1000) end, 'x', f.px, 'z', f.pz)) order by f.slot) from public.farm_plots f where f.owner = o.id), '[]'::jsonb),
    'deco', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'k', d.kind, 'x', d.px, 'z', d.pz, 'r', d.rot) order by d.id) from public.sea_decor d where d.owner = o.id), '[]'::jsonb))
  from (select i.id, coalesce((select farm_n from public.players where id = i.id), 4) as n, coalesce((select sea_n from public.players where id = i.id), 4) as sn from (select coalesce(p_owner, auth.uid()) as id) i) o
$$;

-- 在海底的某個位置種下去（位置是相對海底中心的公尺數）
create or replace function public.sea_plant(p_crop text, p_x real, p_z real) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer; cnt integer; sl integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null or not public._farm_is_sea(p_crop) then raise exception '這種種子不能種在海底'; end if;
  if p_x is null or p_z is null or p_x <> p_x or p_z <> p_z or sqrt(p_x * p_x + p_z * p_z) > 30 then raise exception '這裡太遠了，種近一點'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 then raise exception '背包裡沒有這種種子'; end if;
  select count(*) into cnt from public.farm_plots where owner = pl.id and slot >= 100;
  if cnt >= pl.sea_n then raise exception '海底花園種滿了'; end if;
  if exists (select 1 from public.farm_plots f where f.owner = pl.id and f.slot >= 100 and f.px is not null and sqrt((f.px - p_x) * (f.px - p_x) + (f.pz - p_z) * (f.pz - p_z)) < 1.5) then raise exception '離旁邊那一株太近了'; end if;
  select min(g) into sl from generate_series(100, 199) g where not exists (select 1 from public.farm_plots f where f.owner = pl.id and f.slot = g);
  insert into public.farm_plots (owner, slot, crop, px, pz) values (pl.id, sl, p_crop, p_x, p_z);
  update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 食堂買料理
create or replace function public.buy_dish(p_recipe text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); rc record; price integer; today date := (now() at time zone 'Asia/Taipei')::date; n integer; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into rc from public._recipe(p_recipe);
  if rc.value is null then raise exception '沒有這道料理'; end if;
  price := round(rc.value * 2.5);
  n := case when pl.dish_buy_day = today then pl.dish_buy_n else 0 end;
  if n >= 6 then raise exception '今天買太多了，明天再來（一天最多 6 道）'; end if;
  if jsonb_array_length(coalesce(pl.dishes, '[]'::jsonb)) >= 100 then raise exception '料理放不下了'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price,
    dishes = jsonb_build_array(jsonb_build_object('r', p_recipe, 'q', 1, 't', ts)) || coalesce(dishes, '[]'::jsonb),
    dish_buy_day = today, dish_buy_n = n + 1, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;


create or replace function public.sea_deco_buy(p_kind text, p_n integer default 1) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._sea_deco_price(p_kind); n integer := coalesce(p_n, 1); k text := 'deco_' || p_kind; have integer;
begin
  if price is null then raise exception '沒有這種裝飾'; end if;
  if n < 1 or n > 20 then raise exception '一次可以買 1 到 20 個'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have + n > 99 then raise exception '帶太多了'; end if;
  if pl.coins < price * n then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price * n, bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(have + n)), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
create or replace function public.sea_deco_put(p_kind text, p_x real, p_z real, p_rot real default 0) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text := 'deco_' || p_kind; have integer;
begin
  if public._sea_deco_price(p_kind) is null then raise exception '沒有這種裝飾'; end if;
  if p_x is null or p_z is null or p_x <> p_x or p_z <> p_z or sqrt(p_x * p_x + p_z * p_z) > 30 then raise exception '這裡太遠了，放近一點'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 then raise exception '背包裡沒有這個裝飾'; end if;
  if (select count(*) from public.sea_decor where owner = pl.id) >= 12 then raise exception '海底的裝飾放滿了（最多 12 個）'; end if;
  insert into public.sea_decor (owner, kind, px, pz, rot) values (pl.id, p_kind, p_x, p_z, coalesce(nullif(p_rot, 'NaN'::real), 0));
  update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
create or replace function public.sea_deco_take(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sea_decor; k text;
begin
  delete from public.sea_decor where id = p_id and owner = pl.id returning * into d;
  if not found then raise exception '找不到這個裝飾'; end if;
  k := 'deco_' || d.kind;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(99, coalesce((bait ->> k)::integer, 0) + 1))), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public._sea_deco_price(text) from public, anon, authenticated;
revoke all on function public.sea_deco_buy(text, integer), public.sea_deco_put(text, real, real, real), public.sea_deco_take(bigint) from public, anon;
grant execute on function public.sea_deco_buy(text, integer), public.sea_deco_put(text, real, real, real), public.sea_deco_take(bigint) to authenticated;
revoke all on function public.sea_plant(text, real, real), public.buy_dish(text) from public, anon;
grant execute on function public.sea_plant(text, real, real), public.buy_dish(text) to authenticated;
