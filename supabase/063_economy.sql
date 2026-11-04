-- 潮汐釣魚村：公共魚市行情（架構第六階段；可以重複執行）
-- 海邊商店收魚的價格會跟著「庫存」變：大家賣很多的魚，庫存高、價錢下降；很少人賣的魚，價錢上升（0.6～1.6 倍）。
-- 每小時（pg_cron）：食堂和阿福海產店用掉一些庫存（餐廳消耗食材）、商店把庫存運出去（進貨出貨）；
--   正在釣魚的村民（老港上班、其他人去釣魚）會把漁獲賣給商店（NPC 捕魚和販售）；
--   玩家在釣客魚市成交的價格也會把行情往那邊拉一點（玩家交易影響公共市場）。
-- 每個大廳看到的價格都一樣（資料在伺服器），賣魚的錢也是伺服器照這個算。

create table if not exists public.econ_fish (
  fish    text primary key,
  stock   numeric not null default 0,
  mult    numeric(4,2) not null default 1.00,
  sold_h  integer not null default 0,      -- 這一個小時玩家賣給商店幾條
  npc_h   integer not null default 0,      -- 這一個小時村民賣給商店幾條
  updated_at timestamptz not null default now()
);
alter table public.econ_fish enable row level security;
revoke all on public.econ_fish from anon, authenticated;
create table if not exists public.econ_clock (id integer primary key default 1 check (id = 1), last_tick timestamptz not null default now());
insert into public.econ_clock (id) values (1) on conflict do nothing;
alter table public.econ_clock enable row level security;
revoke all on public.econ_clock from anon, authenticated;

-- 每一種魚的「剛剛好」庫存：常見 20、稀有 6、傳說 2
create or replace function public._econ_target(r text) returns numeric language sql immutable as $$ select case r when '常見' then 20 when '稀有' then 6 else 2 end::numeric $$;
create or replace function public._econ_mult(stock numeric, r text) returns numeric language sql immutable as $$
  select round(least(1.6, greatest(0.6, power((public._econ_target(r) + 4) / (greatest(0, stock) + 4), 0.35)))::numeric, 2) $$;

-- 賣魚給海邊商店：價錢 × 行情；賣掉的魚進商店庫存
create or replace function public.sell_fish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0; r record;
begin
  select coalesce(sum(round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end) * coalesce(ef.mult, 1))), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f' left join public.econ_fish ef on ef.fish = sp.id
  where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k');
  if cnt = 0 then return pl; end if;
  for r in select e->>'f' f, count(*) n from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k') group by 1 loop
    insert into public.econ_fish (fish, stock, sold_h) values (r.f, r.n, r.n) on conflict (fish) do update set stock = public.econ_fish.stock + excluded.stock, sold_h = public.econ_fish.sold_h + excluded.sold_h;
  end loop;
  update public.econ_fish ef set mult = public._econ_mult(ef.stock, sp.rarity), updated_at = now() from public.fish_species sp where sp.id = ef.fish and ef.fish in (select e->>'f' from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = any(p_ts));
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i)
            where not ((e->>'t')::bigint = any(p_ts) and not (show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k'))),
    coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 每小時推進一次行情（離線、伺服器停機也照時間差補算，最多補 48 小時）
create or replace function public._econ_tick() returns integer language plpgsql security definer set search_path = public as $$
declare c public.econ_clock; hrs numeric; n public.npcs; spot text; pool text[]; f text; k int; m record; total int := 0;
begin
  select * into c from public.econ_clock where id = 1 for update skip locked; if c.id is null then return -1; end if;
  hrs := least(48, extract(epoch from now() - c.last_tick) / 3600.0); if hrs < 0.9 then return 0; end if;
  -- 食堂、阿福海產店用掉食材，商店把魚運出去：每小時庫存剩 90%
  update public.econ_fish set stock = stock * power(0.9, hrs), sold_h = 0, npc_h = 0;
  -- 正在釣魚的村民把漁獲賣給商店（每個人每小時 1～3 條常見魚）
  for n in select * from public.npcs where (act = 'fish' or (id = 'gang' and act = 'work')) and arr_at <= now() loop
    spot := case n.place when 'fish_river' then 'river' when 'fish_lake' then 'lake' when 'fish_sea' then 'sea' when 'work_gang' then 'harbor' else null end;
    if spot is null then continue; end if;
    select array_agg(x) into pool from jsonb_array_elements_text(public._fishcfg()->'spots'->spot->'fish') x join public.fish_species s on s.id = x where s.rarity = '常見' and not (public._fishcfg()->'fish'->x ? 'v');
    if pool is null then continue; end if;
    for k in 1 .. (1 + floor(random() * 3))::int loop
      f := pool[1 + floor(random() * array_length(pool, 1))::int];
      insert into public.econ_fish (fish, stock, npc_h) values (f, 1, 1) on conflict (fish) do update set stock = public.econ_fish.stock + 1, npc_h = public.econ_fish.npc_h + 1;
      total := total + 1;
    end loop;
    if random() < 0.3 then perform public._remember(n.id, now(), 'sell', null, 1, '把釣到的魚賣給海邊商店'); end if;
  end loop;
  -- 重算行情；釣客魚市最近一小時成交的價錢會把行情往那邊拉 10%
  update public.econ_fish ef set mult = public._econ_mult(ef.stock, sp.rarity), updated_at = now() from public.fish_species sp where sp.id = ef.fish;
  for m in select fish, avg(price::numeric / greatest(1, base)) r from public.fish_market where status = 'sold' and done_at > now() - interval '1 hour' group by fish loop
    update public.econ_fish set mult = round(least(1.6, greatest(0.6, mult * 0.9 + least(1.6, greatest(0.6, m.r)) * 0.1))::numeric, 2) where fish = m.fish;
  end loop;
  update public.econ_clock set last_tick = now() where id = 1;
  return total;
end $$;
revoke all on function public._econ_tick() from public, anon, authenticated;

-- 手機讀的：每一種魚現在的行情（只回傳不是 1.00 的）
create or replace function public.econ_prices() returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if (select last_tick from public.econ_clock where id = 1) < now() - interval '75 minutes' then perform public._econ_tick(); end if;
  return (select coalesce(jsonb_object_agg(fish, jsonb_build_object('m', mult, 's', round(stock), 'p', sold_h, 'n', npc_h)), '{}'::jsonb) from public.econ_fish where mult <> 1 or stock > 0);
end $$;
revoke all on function public.econ_prices() from public, anon;
grant execute on function public.econ_prices() to authenticated;

do $$ begin
  -- 一開始：每一種魚放一些庫存，價錢都是 1 倍左右
  insert into public.econ_fish (fish, stock, mult) select id, public._econ_target(rarity), public._econ_mult(public._econ_target(rarity), rarity) from public.fish_species on conflict (fish) do nothing;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-econ-tick', '9 * * * *', 'select public._econ_tick()');
  end if;
end $$;

select '公共魚市行情設定完成 📈' as result;
