-- 潮汐釣魚村：🏛️ 海洋博物館（可以重複執行）
-- 從魚缸挑一條魚捐給博物館（魚會從魚缸拿走）。每一種魚、每一種變種、白化都是一格展示。
--   · 每一格記「首位捐贈者」（名字、日期、那條魚的重量），之後別人再捐同一種不會改首位，只算自己的收集；
--     有人捐了比首位更重的，另外記「最大展示」。
--   · 同一個人同一種只能捐一次。箱網、公共儲物箱的魚不能捐（只看魚缸）。赤紅霸王鯊可以捐，算一格。
--   · 蔚博士發現的新品種（nx 開頭）不收：那是蔚博士自己要研究的。
-- 收集獎勵：每一個釣點（私人小島除外）的「一般魚」都捐齊了，可以領一次：金幣（300 + 每種 30），
--   加上那一區專屬的「魚拓」家具（gy_釣點，只有集滿才拿得到，擺在家裡不用錢）。變種是加分的格子，不算在集滿裡。
--   全部集滿有稱號「博物館榮譽館長」（遊戲裡看領了幾區自動給）。
-- 公開讀取只給：格子、名字、日期、重量（不給玩家編號）。第一個捐的人會收到推播。

create table if not exists public.museum (
  slot text primary key,
  first_by uuid, first_name text, first_at timestamptz, first_w numeric,
  max_by uuid, max_name text, max_w numeric
);
create table if not exists public.museum_mine (
  owner uuid not null, slot text not null, at timestamptz not null default now(), w numeric,
  primary key (owner, slot)
);
create table if not exists public.museum_claims (
  owner uuid not null, region text not null, at timestamptz not null default now(), coins integer not null default 0,
  primary key (owner, region)
);
alter table public.museum enable row level security;
alter table public.museum_mine enable row level security;
alter table public.museum_claims enable row level security;
revoke all on public.museum, public.museum_mine, public.museum_claims from anon, authenticated;

-- 一區要捐齊的魚：那個釣點的一般魚（不含變種）
create or replace function public._museum_need(p_region text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from jsonb_array_elements_text(public._fishcfg()->'spots'->p_region->'fish') x
  where not coalesce((public._fishcfg()->'fish'->x->>'v')::boolean, false) $$;
create or replace function public._museum_regions() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k order by k), '{}') from jsonb_object_keys(public._fishcfg()->'spots') k where k <> 'isle' $$;
revoke all on function public._museum_need(text), public._museum_regions() from public, anon, authenticated;

-- 魚拓家具：只有領過那一區獎勵的人可以擺（不用錢）；其他家具照 069
create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
  if p ~ '^gy_[a-z]{2,12}$' then
    rad := 0.45; flat := false;
    price := case when exists (select 1 from public.players where id = auth.uid() and p = any(owned)) then 0 end;
    return;
  end if;
  if p ~ '^fz[0-9]{1,9}$' then
    select * into d from public.furn_designs where id = substr(p, 3)::integer;
    if d.id is null then return; end if;
    if d.base = 'paint' then rad := 0.45; flat := false; else select b.rad, b.flat into rad, flat from public._furn(d.base) b; end if;
    price := case when d.listed and (d.owner is null or d.owner = auth.uid()) then d.price end;
    return;
  end if;
  select v.price, v.rad, v.flat into price, rad, flat from (values
    ('bed',600,1.1,false),('dbed',1200,1.4,false),('bunk',1000,1.1,false),('sofa',800,1.2,false),('arm',400,0.6,false),('table',500,0.8,false),('chair',120,0.35,false),
    ('desk',450,0.7,false),('shelf',500,0.7,false),('ward',700,0.8,false),('lamp',200,0.3,false),('plant',150,0.4,false),('bigplant',300,0.5,false),('rug',250,1.2,true),
    ('tv',900,0.9,false),('fridge',800,0.5,false),('stove',700,0.5,false),('sink',500,0.6,false),('bath',1200,1.0,false),('toilet',400,0.4,false),('fire',1500,0.8,false),
    ('tank',1000,0.7,false),('piano',2500,0.9,false),('clock',600,0.3,false),
    ('kk_bed_single_A',650,1.0,false),('kk_bed_single_B',650,1.0,false),('kk_bed_double_A',1300,1.3,false),('kk_bed_double_B',1300,1.3,false),('kk_cabinet_small',300,0.4,false),('kk_cabinet_small_decorated',380,0.4,false),('kk_cabinet_medium',450,0.7,false),('kk_cabinet_medium_decorated',600,0.7,false),('kk_lamp_table',180,0.3,false),('kk_lamp_standing',260,0.35,false),('kk_couch',900,1.1,false),('kk_couch_pillows',1000,1.1,false),('kk_armchair',450,0.6,false),('kk_armchair_pillows',520,0.6,false),('kk_chair_A',140,0.35,false),('kk_chair_A_wood',140,0.35,false),('kk_chair_B_wood',160,0.35,false),('kk_chair_C',160,0.35,false),('kk_chair_stool_wood',90,0.3,false),('kk_table_low',350,0.9,false),('kk_table_small',250,0.4,false),('kk_table_medium',450,0.8,false),('kk_table_medium_long',600,1.1,false),('kk_rug_oval_A',260,1.1,true),('kk_rug_rectangle_A',240,1.1,true),('kk_rug_rectangle_stripes_A',280,1.1,true),('kk_rug_rectangle_stripes_B',280,1.1,true),('kk_cactus_small_A',120,0.25,false),('kk_cactus_small_B',120,0.25,false),('kk_cactus_medium_A',220,0.4,false),('kk_cactus_medium_B',220,0.4,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;


-- 捐魚
create or replace function public.donate_fish(p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb; f text; w numeric; cfg jsonb := public._fishcfg(); nm text; first boolean := false; m public.museum;
begin
  select * into pl from public.players where id = pl.id for update;
  select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '這條魚不在你的魚缸裡'; end if;
  f := e->>'f'; w := round(coalesce((e->>'w')::numeric, 0), 2);
  if f ~ '^nx' then raise exception '蔚博士發現的新品種要留給蔚博士研究，博物館不收'; end if;
  if not (cfg->'fish' ? f) and not exists (select 1 from public.fish_species where id = f) then raise exception '博物館不認得這種魚'; end if;
  if exists (select 1 from public.museum_mine where owner = pl.id and slot = f) then raise exception '你已經捐過這種魚了'; end if;
  nm := coalesce(nullif(btrim(pl.nickname), ''), '釣客');
  -- 從魚缸（和展示）拿走
  update public.players set tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where (x->>'t')::bigint <> p_t), '[]'::jsonb),
    show = case when show is null then show else coalesce((select jsonb_agg(x) from jsonb_array_elements(show) x where (x #>> '{}') <> p_t::text), '[]'::jsonb) end,
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.museum_mine (owner, slot, w) values (pl.id, f, w);
  insert into public.museum (slot, first_by, first_name, first_at, first_w, max_by, max_name, max_w) values (f, pl.id, nm, now(), w, pl.id, nm, w)
    on conflict (slot) do nothing returning true into first;
  if first then
    perform public._push(pl.id, 'museum', '🏛️ 名字刻在博物館了', '你是第一個捐出「' || coalesce(cfg->'fish'->f->>'n', (select name from public.fish_species where id = f), f) || '」的人，名字刻在博物館了！', 0);
  else
    update public.museum set max_by = pl.id, max_name = nm, max_w = w where slot = f and w > coalesce(max_w, 0);
  end if;
  return jsonb_build_object('first', coalesce(first, false), 'player', to_jsonb(pl));
end $$;

-- 博物館每一格（公開：只有名字、日期、重量）
create or replace function public.museum_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('s', slot, 'fn', first_name, 'fd', to_char(first_at at time zone 'Asia/Taipei', 'YYYY-MM-DD'), 'fw', first_w, 'mn', max_name, 'mw', max_w)), '[]'::jsonb) from public.museum $$;

-- 自己捐過哪些、領過哪些區的獎勵
create or replace function public.museum_my() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slots', coalesce((select jsonb_agg(slot) from public.museum_mine where owner = auth.uid()), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(region) from public.museum_claims where owner = auth.uid()), '[]'::jsonb)) $$;

-- 領一區的收集獎勵（只能領一次）
create or replace function public.museum_claim(p_region text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); need text[]; miss int; give int; item text := 'gy_' || p_region;
begin
  if not (p_region = any(public._museum_regions())) then raise exception '沒有這一區'; end if;
  need := public._museum_need(p_region);
  if coalesce(array_length(need, 1), 0) = 0 then raise exception '這一區沒有要收集的魚'; end if;
  select count(*) into miss from unnest(need) x where not exists (select 1 from public.museum_mine where owner = pl.id and slot = x);
  if miss > 0 then raise exception '這一區還差 % 種魚', miss; end if;
  give := 300 + 30 * array_length(need, 1);
  insert into public.museum_claims (owner, region, coins) values (pl.id, p_region, give) on conflict do nothing;
  if not found then raise exception '這一區的獎勵已經領過了'; end if;
  update public.players set coins = coins + give, owned = case when item = any(owned) then owned else array_append(owned, item) end, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('coins', give, 'item', item, 'player', to_jsonb(pl));
end $$;

do $$ declare f text; begin
  foreach f in array array['donate_fish(bigint)', 'museum_list()', 'museum_my()', 'museum_claim(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '海洋博物館開館了 🏛️' as result;
