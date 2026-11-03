-- 潮汐釣魚村：Supabase 資料庫設定
-- 用法：Supabase 後台 → SQL Editor → New query → 整份貼上 → Run。
-- 重複執行也沒關係（已經有的東西會略過或更新）。
-- 規則：玩家不能直接改自己的資料，只能透過下面的函式（伺服器會檢查魚種、重量、價格、金幣夠不夠）。

-- ========== 1. 魚種表（伺服器用來檢查重量和算價格）==========
create table if not exists public.fish_species (
  id     text primary key,
  name   text not null,
  rarity text not null check (rarity in ('常見','稀有','傳說')),
  min_w  numeric not null,
  max_w  numeric not null
);
alter table public.fish_species enable row level security;
drop policy if exists "fish readable" on public.fish_species;
create policy "fish readable" on public.fish_species for select using (true);
revoke all on public.fish_species from anon, authenticated;
grant select on public.fish_species to anon, authenticated;

insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('perch', '翡翠河鱸', '常見', 0.4, 1.6),
  ('crucian', '銀鱗鯽', '常見', 0.2, 0.9),
  ('catfish', '竹影鯰', '稀有', 1.5, 5.5),
  ('koi', '朱紅錦鯉', '傳說', 2.5, 7),
  ('mackerel', '沙灘小鯖', '常見', 0.3, 1.2),
  ('scorpion', '條紋石狗公', '常見', 0.3, 1.4),
  ('moonbream', '月光鯛', '稀有', 1, 3.8),
  ('marlin', '深藍旗魚', '傳說', 8, 24),
  ('manta', '星紋魟魚', '稀有', 12, 45),
  ('dolphin', '晴潮海豚', '稀有', 40, 150),
  ('shark', '礁岩鯊', '傳說', 60, 250),
  ('orca', '浪花虎鯨', '傳說', 1200, 5500),
  ('beluga', '月白白鯨', '稀有', 400, 1500),
  ('sunfish', '慵懶翻車魚', '稀有', 60, 900),
  ('sperm', '深潛抹香鯨', '傳說', 3000, 15000),
  ('whaleshark', '星斑鯨鯊', '傳說', 2000, 12000),
  ('whale', '座頭鯨', '傳說', 900, 3000),
  ('kuhua', '清溪苦花', '常見', 0.2, 0.8),
  ('ayu', '霧溪香魚', '常見', 0.1, 0.6),
  ('goby', '紫晶蝦虎', '稀有', 0.1, 0.5),
  ('trout', '星點溪鱒', '傳說', 1.2, 4.5)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- ========== 2. 玩家資料 ==========
create table if not exists public.players (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null default '釣客',
  shirt         text not null default '#f17b6d',
  hat           text not null default '#ffd36a',
  total         integer not null default 0,
  legend        integer not null default 0,
  best_w        numeric(10,2) not null default 0,
  best_fish     text,
  fish_best     jsonb not null default '{}'::jsonb,   -- 每種魚的最大重量
  fish_count    jsonb not null default '{}'::jsonb,   -- 每種魚釣到幾條
  tank          jsonb not null default '[]'::jsonb,   -- 魚缸 [{"f":"perch","w":1.23,"t":毫秒}]，最新的在前面
  show          jsonb not null default '[]'::jsonb,   -- 自己挑去水族館展示的魚（t 的清單）
  coins         integer not null default 0 check (coins >= 0),
  earned        integer not null default 0,
  sold          integer not null default 0,
  rods          text[] not null default array['bamboo'],
  rod           text not null default 'bamboo',
  bait          jsonb not null default '{}'::jsonb,   -- {"glow": 3}
  bait_on       text,
  imported      boolean not null default false,
  last_catch_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists players_best_w_idx on public.players (best_w desc);
create index if not exists players_total_idx  on public.players (total desc);
create index if not exists players_earned_idx on public.players (earned desc);

alter table public.players enable row level security;
drop policy if exists "players readable" on public.players;
create policy "players readable" on public.players for select using (true);
revoke all on public.players from anon, authenticated;
grant select on public.players to anon, authenticated;   -- 大家都看得到（排行榜、參觀魚缸）；寫入只能透過函式

-- ========== 3. 商品（價格放在伺服器，玩家改不了）==========
create or replace function public._rod_price(p text) returns integer language sql immutable as $$
  select case p when 'bamboo' then 0 when 'carbon' then 400 when 'deep' then 2500 else null end $$;
create or replace function public._bait_info(p text, out price integer, out pack integer) language sql immutable as $$
  select case p when 'glow' then 60 when 'gold' then 300 end, case p when 'glow' then 5 when 'gold' then 3 end $$;
create or replace function public._fish_price(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select round((case sp.rarity when '常見' then 10 when '稀有' then 60 else 400 end)
    * (1 + 1.5 * least(1, greatest(0, (w - sp.min_w) / greatest(0.01, sp.max_w - sp.min_w)))))::integer $$;

-- 取得自己的資料列（沒有就建立），並鎖住避免同時修改
create or replace function public._me() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players;
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  insert into public.players (id) values (auth.uid()) on conflict (id) do nothing;
  select * into pl from public.players where id = auth.uid() for update;
  return pl;
end $$;

-- 魚缸整理：展示中的魚全部保留，其他保留最新 200 條
create or replace function public._trim_tank(tank jsonb, show jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from (
    select e, i, (show @> jsonb_build_array(e->'t')) as keep,
           row_number() over (partition by (show @> jsonb_build_array(e->'t')) order by i) as rn
    from jsonb_array_elements(tank) with ordinality as x(e, i)
  ) s where keep or rn <= 200 $$;

-- ========== 4. 遊戲用的函式 ==========
-- 進遊戲時呼叫：回傳自己的資料
create or replace function public.ensure_player() returns public.players language plpgsql security definer set search_path = public as $$
begin return public._me(); end $$;

-- 改暱稱和造型
create or replace function public.set_profile(p_nick text, p_shirt text, p_hat text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  p_nick := left(btrim(coalesce(p_nick, '')), 16);
  update public.players set
    nickname = case when p_nick = '' then nickname else p_nick end,
    shirt = case when p_shirt ~ '^#[0-9a-fA-F]{6}$' then p_shirt else shirt end,
    hat   = case when p_hat   ~ '^#[0-9a-fA-F]{6}$' then p_hat   else hat end,
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 釣到一條魚
create or replace function public.record_catch(p_fish text, p_weight numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare
  pl public.players := public._me();
  sp public.fish_species;
  w  numeric := round(p_weight, 2);
  ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into sp from public.fish_species where id = p_fish;
  if not found then raise exception '沒有這種魚'; end if;
  if w < sp.min_w or w > sp.max_w then raise exception '重量不合理'; end if;
  if pl.last_catch_at is not null and now() - pl.last_catch_at < interval '3 seconds' then raise exception '釣太快了'; end if;
  update public.players set
    total      = total + 1,
    legend     = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
    fish_count = jsonb_set(fish_count, array[p_fish], to_jsonb(coalesce((fish_count ->> p_fish)::int, 0) + 1)),
    fish_best  = case when coalesce((fish_best ->> p_fish)::numeric, 0) < w then jsonb_set(fish_best, array[p_fish], to_jsonb(w)) else fish_best end,
    best_fish  = case when w > best_w then p_fish else best_fish end,
    best_w     = greatest(best_w, w),
    tank       = public._trim_tank(jsonb_build_array(jsonb_build_object('f', p_fish, 'w', w, 't', ts)) || tank, show),
    last_catch_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 拋竿時用掉一個魚餌
create or replace function public.use_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer;
begin
  n := coalesce((pl.bait ->> p_bait)::int, 0);
  if n <= 0 then return pl; end if;
  update public.players set
    bait = case when n - 1 <= 0 then bait - p_bait else jsonb_set(bait, array[p_bait], to_jsonb(n - 1)) end,
    bait_on = case when n - 1 <= 0 and bait_on = p_bait then null else bait_on end,
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 賣魚（價格由伺服器算；展示中的魚不能賣）
create or replace function public.sell_fish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0;
begin
  select coalesce(sum(public._fish_price(sp, (e->>'w')::numeric)), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t'));
  if cnt = 0 then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i)
            where not ((e->>'t')::bigint = any(p_ts) and not (show @> jsonb_build_array(e->'t')))),
    coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 放生一條魚
create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 設定水族館展示的魚（最多 100 條，只能選自己魚缸裡有的）
create or replace function public.set_show(p_show bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.players set
    show = (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
              select distinct t from unnest(coalesce(p_show, '{}')) t
              where exists (select 1 from jsonb_array_elements(tank) e where (e->>'t')::bigint = t) limit 100) s),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 買釣竿／換釣竿
create or replace function public.buy_rod(p_rod text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._rod_price(p_rod);
begin
  if price is null then raise exception '沒有這支釣竿'; end if;
  if p_rod = any(pl.rods) then
    update public.players set rod = p_rod, updated_at = now() where id = pl.id returning * into pl; return pl;
  end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, rods = array_append(rods, p_rod), rod = p_rod, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 買一包魚餌
create or replace function public.buy_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); info record;
begin
  select * into info from public._bait_info(p_bait);
  if info.price is null then raise exception '沒有這種魚餌'; end if;
  if pl.coins < info.price then raise exception '金幣不夠'; end if;
  update public.players set
    coins = coins - info.price,
    bait = jsonb_set(bait, array[p_bait], to_jsonb(least(999, coalesce((bait ->> p_bait)::int, 0) + info.pack))),
    bait_on = coalesce(bait_on, p_bait), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 換魚餌（null = 普通魚餌）
create or replace function public.set_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_bait is not null and coalesce((pl.bait ->> p_bait)::int, 0) <= 0 then raise exception '沒有這種魚餌'; end if;
  update public.players set bait_on = p_bait, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 第一次登入時，把這台裝置原本的紀錄搬上來（只能一次，數量有上限、魚種和重量會檢查）
create or replace function public.import_local(p jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); fb jsonb := '{}'; fc jsonb := '{}'; tk jsonb; tot integer := 0; leg integer := 0; bw numeric := 0; bf text;
begin
  if pl.imported or pl.total > 0 then return pl; end if;
  select coalesce(jsonb_object_agg(sp.id, round(least(sp.max_w, greatest(sp.min_w, (p->'best'->>sp.id)::numeric)), 2)), '{}') into fb
    from public.fish_species sp where (p->'best'->>sp.id) ~ '^[0-9.]+$';
  select coalesce(jsonb_object_agg(sp.id, least(5000, (p->'count'->>sp.id)::int)), '{}'),
         coalesce(sum(least(5000, (p->'count'->>sp.id)::int)), 0),
         coalesce(sum(case when sp.rarity = '傳說' then least(5000, (p->'count'->>sp.id)::int) else 0 end), 0)
    into fc, tot, leg
    from public.fish_species sp where (p->'count'->>sp.id) ~ '^[0-9]+$' and (p->'count'->>sp.id)::int > 0;
  select coalesce(jsonb_agg(jsonb_build_object('f', e->>'f', 'w', round(least(sp.max_w, greatest(sp.min_w, (e->>'w')::numeric)), 2), 't', (e->>'t')::bigint) order by i), '[]')
    into tk from (select e, i from jsonb_array_elements(case when jsonb_typeof(p->'tank') = 'array' then p->'tank' else '[]' end) with ordinality x(e, i) limit 200) s
    join public.fish_species sp on sp.id = s.e->>'f' where (s.e->>'w') ~ '^[0-9.]+$' and (s.e->>'t') ~ '^[0-9]+$';
  select key, value::numeric into bf, bw from jsonb_each_text(fb) order by value::numeric desc limit 1;
  update public.players set
    fish_best = fb, fish_count = fc, total = tot, legend = leg, best_w = coalesce(bw, 0), best_fish = bf, tank = tk,
    coins = least(3000, greatest(0, coalesce((p->>'coins')::numeric, 0)))::integer,
    rods = array['bamboo'] || array(select r from jsonb_array_elements_text(case when jsonb_typeof(p->'rods') = 'array' then p->'rods' else '[]' end) r where r in ('carbon','deep')),
    rod = case when p->>'rod' in ('carbon','deep') and (p->'rods') ? (p->>'rod') then p->>'rod' else 'bamboo' end,
    imported = true, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 只有登入的玩家能呼叫這些函式；內部用的函式不開放
do $$ declare f text; begin
  foreach f in array array['ensure_player()', 'set_profile(text,text,text)', 'record_catch(text,numeric)', 'use_bait(text)', 'sell_fish(bigint[])', 'release_fish(bigint)', 'set_show(bigint[])', 'buy_rod(text)', 'buy_bait(text)', 'set_bait(text)', 'import_local(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_me()', '_trim_tank(jsonb,jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

select '設定完成 ✅' as result;
