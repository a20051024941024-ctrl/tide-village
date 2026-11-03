-- 潮汐釣魚村：料理與壽司（第 2 份資料庫設定）
-- 用法：Supabase 後台 → SQL Editor → New query → 整份貼上 → Run。重複執行也沒關係。
-- 料理需要的魚、價格都由伺服器決定；玩家只能用自己魚缸裡、沒有展示的魚來做。

alter table public.players add column if not exists dishes jsonb not null default '[]'::jsonb;   -- [{"r":"saba","q":2,"t":毫秒}]
alter table public.players add column if not exists last_cook_at timestamptz;

-- 食譜：需要哪種魚（mori = 任意 3 條常見魚）、基本價格
create or replace function public._recipe(p text, out fish text, out need integer, out value integer) language sql immutable as $$
  select v.fish, v.need, v.value from (values
    ('saba', 'mackerel',  1,  40),
    ('tai',  'moonbream', 1, 160),
    ('ayu',  'ayu',       1,  30),
    ('suzuki','perch',    1,  35),
    ('mori', '*common',   3, 120)
  ) v(r, fish, need, value) where v.r = p $$;

-- 料理價格：星星越多越貴（1 星 ×1、2 星 ×1.3、3 星 ×1.6）
create or replace function public._dish_price(r text, q integer) returns integer language sql immutable as $$
  select round((select value from public._recipe(r)) * (1 + 0.3 * (least(3, greatest(1, q)) - 1)))::integer $$;

-- 做一道料理
create or replace function public.cook(p_recipe text, p_ts bigint[], p_quality integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); rc record; ok integer; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into rc from public._recipe(p_recipe);
  if rc.value is null then raise exception '沒有這道料理'; end if;
  if coalesce(array_length(p_ts, 1), 0) <> rc.need or (select count(distinct x) from unnest(p_ts) x) <> rc.need then raise exception '食材不對'; end if;
  if pl.last_cook_at is not null and now() - pl.last_cook_at < interval '3 seconds' then raise exception '做太快了'; end if;
  select count(*) into ok from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
   where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t'))
     and (case when rc.fish = '*common' then sp.rarity = '常見' else sp.id = rc.fish end);
  if ok <> rc.need then raise exception '食材不對'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where not ((e->>'t')::bigint = any(p_ts))),
    dishes = (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(jsonb_build_array(jsonb_build_object('r', p_recipe, 'q', least(3, greatest(1, coalesce(p_quality, 1))), 't', ts)) || dishes) e limit 100) s),
    last_cook_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 賣料理（價格由伺服器算）
create or replace function public.sell_dish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0;
begin
  select coalesce(sum(public._dish_price(e->>'r', (e->>'q')::int)), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.dishes) e where (e->>'t')::bigint = any(p_ts) and (select value from public._recipe(e->>'r')) is not null;
  if cnt = 0 then return pl; end if;
  update public.players set
    dishes = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, i) where not ((e->>'t')::bigint = any(p_ts))),
    coins = coins + got, earned = earned + got, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['cook(text,bigint[],integer)', 'sell_dish(bigint[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '料理設定完成 🍣' as result;
