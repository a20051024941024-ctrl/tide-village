-- 166 跑船生意第一版（v433）：把魚裝上魚艙，載到另一個地方賣，價錢比較好。可以重複執行。
-- 兩個收魚的地方：village＝村子的海邊商店、reef＝珊瑚礁島的阿嬤。
--   在礁島賣：礁島自己的魚（_reef_fish）只有 0.7 倍，別處載來的魚 1.3 倍；在村子賣：礁島載回來的魚 1.3 倍，其他照原價。
--   所以「把村子的魚載去礁島」「把礁島的魚載回村子」都多三成；在產地直接賣則沒有好處。
-- 魚艙最多 10 條。魚從魚缸移進魚艙（伺服器保管），可以整艙放回魚缸。
-- 新鮮度：裝上船 5 分鐘內 100%，之後每分鐘少 4%，最低 50%。
-- 防瞬間移動：伺服器不知道玩家站在哪，所以規定裝上船至少 45 秒才能賣（開船過去本來就要這麼久）。
-- 防洗錢：礁島有自己的庫存，同一種魚賣越多，那裡收得越便宜（村子的公式 _econ_mult，但從「剛剛好」的庫存起算，所以是 0.6～1.0 倍，不會比 1.3 倍更高）；庫存每小時自己少一成。
-- 村子原本的賣魚（sell_fish）、行情（econ_fish）完全沒有改。展示中的魚、收藏的魚、赤紅霸王鯊不能裝上船。

alter table public.players add column if not exists cargo jsonb not null default '[]'::jsonb;
create table if not exists public.econ_place (place text not null, fish text not null, stock numeric not null default 0, updated_at timestamptz not null default now(), primary key (place, fish));
alter table public.econ_place enable row level security;

create or replace function public._cargo_cap() returns integer language sql immutable as $$ select 10 $$;
create or replace function public._reef_fish(f text) returns boolean language sql immutable as $$
  select f = any(array['rabbitfish','girella','blackgirella','lethrinus','amberjack','rabbitfish_gold','girella_gold','blackgirella_albino','lethrinus_red','amberjack_gold','snowmoray','snowmoray_gold']) $$;
create or replace function public._cargo_fresh(ld bigint) returns numeric language sql stable as $$
  select round(greatest(0.5, least(1.0, 1.0 - (greatest(0, (extract(epoch from now()) * 1000 - ld) / 60000.0) - 5) * 0.04))::numeric, 2) $$;
create or replace function public._cargo_k(place text, f text) returns numeric language sql immutable as $$
  select case when place = 'reef' then (case when public._reef_fish(f) then 0.7 else 1.3 end) else (case when public._reef_fish(f) then 1.3 else 1.0 end) end $$;
-- 這個地方現在的庫存（每小時少一成，用時間差算，不用排程）
create or replace function public._place_stock(p_place text, p_fish text) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select stock * power(0.9, extract(epoch from now() - updated_at) / 3600.0) from public.econ_place where place = p_place and fish = p_fish), 0) $$;
create or replace function public._cargo_mult(p_place text, p_fish text, p_rarity text) returns numeric language sql stable security definer set search_path = public as $$
  select case when p_place = 'reef' then public._econ_mult(public._econ_target(p_rarity) + public._place_stock('reef', p_fish), p_rarity) else coalesce((select mult from public.econ_fish where fish = p_fish), 1) end $$;
create or replace function public._cargo_price(p_place text, sp public.fish_species, e jsonb) returns integer language sql stable security definer set search_path = public as $$
  select round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end) * public._cargo_k(p_place, sp.id) * public._cargo_mult(p_place, sp.id, sp.rarity) * public._cargo_fresh((e->>'ld')::bigint))::integer $$;

create or replace function public._cargo_info(pl public.players) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cap', public._cargo_cap(),
    'cargo', coalesce((select jsonb_agg(jsonb_build_object('t', (e->>'t')::bigint, 'f', e->>'f', 'w', (e->>'w')::numeric, 'fr', public._cargo_fresh((e->>'ld')::bigint),
        'age', round((extract(epoch from now()) * 1000 - (e->>'ld')::bigint) / 1000.0), 'pv', public._cargo_price('village', sp, e), 'pr', public._cargo_price('reef', sp, e),
        'base', round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end) * coalesce(ef.mult, 1))) order by i)
      from jsonb_array_elements(pl.cargo) with ordinality x(e, i) join public.fish_species sp on sp.id = e->>'f' left join public.econ_fish ef on ef.fish = sp.id), '[]'::jsonb)) $$;

create or replace function public.cargo_info() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); begin return public._cargo_info(pl); end $$;

-- 把魚缸裡的魚裝上魚艙
create or replace function public.cargo_load(p_ts bigint[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); room integer; mv jsonb; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  room := public._cargo_cap() - jsonb_array_length(pl.cargo);
  if room <= 0 then raise exception '魚艙滿了（最多 % 條）', public._cargo_cap(); end if;
  select coalesce(jsonb_agg(e || jsonb_build_object('ld', ms)), '[]'::jsonb) into mv from (
    select e from jsonb_array_elements(pl.tank) with ordinality x(e, i)
    where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k')
      and exists (select 1 from public.fish_species sp where sp.id = e->>'f')
    order by i limit room) q;
  if jsonb_array_length(mv) = 0 then raise exception '這條魚不能裝上船（展示中、收藏的魚不行）'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where not exists (select 1 from jsonb_array_elements(mv) m where m->'t' = e->'t')),
    cargo = cargo || mv, updated_at = now()
  where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'info', public._cargo_info(pl));
end $$;

-- 整艙放回魚缸
create or replace function public.cargo_unload() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.players set tank = tank || (select coalesce(jsonb_agg(e - 'ld'), '[]'::jsonb) from jsonb_array_elements(cargo) e), cargo = '[]'::jsonb, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'info', public._cargo_info(pl));
end $$;

-- 在這個地方把整艙賣掉
create or replace function public.cargo_sell(p_place text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0; r record; ms bigint := (extract(epoch from now()) * 1000)::bigint; base integer := 0;
begin
  if p_place not in ('village', 'reef') then raise exception '這裡不收魚'; end if;
  if jsonb_array_length(pl.cargo) = 0 then raise exception '魚艙是空的'; end if;
  if exists (select 1 from jsonb_array_elements(pl.cargo) e where ms - (e->>'ld')::bigint < 45000) then raise exception '剛裝上船的魚還沒運到，再等一下（裝上船至少 45 秒才能賣）'; end if;
  select coalesce(sum(public._cargo_price(p_place, sp, e)), 0), count(*), coalesce(sum(round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end) * coalesce(ef.mult, 1))), 0)
    into got, cnt, base
    from jsonb_array_elements(pl.cargo) e join public.fish_species sp on sp.id = e->>'f' left join public.econ_fish ef on ef.fish = sp.id;
  for r in select e->>'f' f, count(*) n from jsonb_array_elements(pl.cargo) e group by 1 loop
    if p_place = 'reef' then
      insert into public.econ_place (place, fish, stock, updated_at) values ('reef', r.f, r.n, now())
        on conflict (place, fish) do update set stock = public.econ_place.stock * power(0.9, extract(epoch from now() - public.econ_place.updated_at) / 3600.0) + excluded.stock, updated_at = now();
    else
      insert into public.econ_fish (fish, stock, sold_h) values (r.f, r.n, r.n) on conflict (fish) do update set stock = public.econ_fish.stock + excluded.stock, sold_h = public.econ_fish.sold_h + excluded.sold_h;
    end if;
  end loop;
  if p_place = 'village' then
    update public.econ_fish ef set mult = public._econ_mult(ef.stock, sp.rarity), updated_at = now() from public.fish_species sp where sp.id = ef.fish and ef.fish in (select e->>'f' from jsonb_array_elements(pl.cargo) e);
  end if;
  update public.players set cargo = '[]'::jsonb, coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'info', public._cargo_info(pl), 'got', got, 'n', cnt, 'base', base);
end $$;

do $$ declare f text; begin
  foreach f in array array['cargo_info()', 'cargo_load(bigint[])', 'cargo_unload()', 'cargo_sell(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_place_stock(text,text)', '_cargo_mult(text,text,text)', '_cargo_price(text,public.fish_species,jsonb)', '_cargo_info(public.players)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
