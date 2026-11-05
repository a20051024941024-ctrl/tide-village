-- 潮汐釣魚村：寵物第二版（可以重複執行）
-- 1. 花色（var）：每一種寵物有好幾種花色，領養、釣到的時候由伺服器照機率抽，少見的花色比較稀有。
-- 2. 釣到寵物：海邊、港口、珊瑚礁、紅樹林、泥灘、溪流…釣到魚以後，伺服器有很小的機會讓你「順便」撈到一隻小動物
--    （寄居蟹、小海龜、小章魚、河豚、小水獺）。每釣一條魚只能試一次（pet_try_n 記到第幾條）。已經養 3 隻就只能放牠回去。
-- 3. 寵物市集：自己的寵物可以掛價（50～20000）賣，買的人付錢，賣的人拿九成；賣出去以後親密度歸零（要跟新主人重新培養）。
--    掛賣中的寵物不能帶出門、不能餵。要釣到 30 條魚才能買；不能買自己的。新帳號一天最多花 1500（跟設計師市集一起算）。
-- 公開的市集資料只有：編號、種類、花色、名字、價錢、賣家名字。

alter table public.pets add column if not exists var text not null default 'a';
alter table public.pets add column if not exists price integer;
alter table public.pets add column if not exists listed_at timestamptz;
alter table public.pets add column if not exists caught boolean not null default false;
alter table public.players add column if not exists pet_try_n integer not null default 0;
alter table public.pets drop constraint if exists pets_kind_check;
alter table public.pets add constraint pets_kind_check check (kind in ('cat', 'shiba', 'otter', 'gull', 'crab', 'turtle', 'octopus', 'puffer'));

-- 每一種的花色和權重（a 一定最常見；最後一個最稀有）
create or replace function public._pet_vars(k text) returns jsonb language sql immutable as $$
  select case k
    when 'cat' then '{"a":30,"b":22,"c":12,"d":12,"e":10,"f":9,"g":5}'
    when 'shiba' then '{"a":50,"b":20,"c":18,"d":12}'
    when 'otter' then '{"a":70,"b":25,"c":5}'
    when 'gull' then '{"a":70,"b":25,"c":5}'
    when 'crab' then '{"a":45,"b":25,"c":20,"d":10}'
    when 'turtle' then '{"a":60,"b":30,"c":10}'
    when 'octopus' then '{"a":55,"b":35,"c":10}'
    when 'puffer' then '{"a":55,"b":35,"c":10}'
  end::jsonb $$;
create or replace function public._pet_roll(k text) returns text language plpgsql volatile as $$
declare v jsonb := public._pet_vars(k); tot int; r int; key text; w int;
begin
  select sum(value::int) into tot from jsonb_each_text(v); r := floor(random() * tot)::int;
  for key, w in select e.key, e.value::int from jsonb_each_text(v) e order by e.key loop r := r - w; if r < 0 then return key; end if; end loop;
  return 'a';
end $$;

create or replace function public._pet_price(k text) returns integer language sql immutable as $$
  select case k when 'cat' then 300 when 'shiba' then 2000 when 'otter' then 2500 when 'gull' then 1200 when 'crab' then 800 end $$;

create or replace function public._pet_row(p public.pets) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', p.id, 'kind', p.kind, 'var', p.var, 'name', p.name, 'love', p.love, 'acc', public._pet_acc(p.love), 'out', p.out, 'price', p.price, 'caught', p.caught,
    'fed', p.fed_day = (now() at time zone 'Asia/Taipei')::date, 'gift', p.gift_day = (now() at time zone 'Asia/Taipei')::date) $$;

-- 領養（只有寵物店那 5 種；花色抽獎）
create or replace function public.pet_adopt(p_kind text, p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pr integer := public._pet_price(p_kind); nm text := public._pet_name(p_name); v text;
begin
  if pr is null then raise exception '這種寵物店裡沒有賣'; end if;
  select * into pl from public.players where id = pl.id for update;
  if (select count(*) from public.pets where owner = pl.id) >= 3 then raise exception '最多養 3 隻寵物'; end if;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - pr, updated_at = now() where id = pl.id returning * into pl;
  v := public._pet_roll(p_kind);
  insert into public.pets (owner, kind, name, var) values (pl.id, p_kind, nm, v);
  return jsonb_build_object('pets', public.pet_list(), 'player', to_jsonb(pl), 'var', v);
end $$;

-- 釣到魚以後試一次運氣（手機在釣到魚之後呼叫；伺服器自己看你最後釣到的魚在哪些釣點）
create or replace function public.pet_lucky() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); spots text[]; pool text[] := '{}'; k text; v text;
begin
  select * into pl from public.players where id = pl.id for update;
  if pl.last_fish is null or pl.total <= pl.pet_try_n then return jsonb_build_object('got', false); end if;   -- 每釣一條只能試一次
  update public.players set pet_try_n = pl.total where id = pl.id;
  if random() >= 0.012 then return jsonb_build_object('got', false); end if;
  select array_agg(s) into spots from jsonb_object_keys(cfg->'spots') s where cfg->'spots'->s->'fish' ? pl.last_fish;
  if spots && array['sea', 'harbor', 'reef', 'isle'] then pool := pool || array['crab', 'turtle', 'octopus', 'puffer']; end if;
  if spots && array['mangrove', 'mudflat'] then pool := pool || array['crab', 'crab', 'puffer']; end if;
  if spots && array['river', 'creek', 'weir', 'lake', 'canal'] then pool := pool || array['otter']; end if;
  if coalesce(array_length(pool, 1), 0) = 0 then return jsonb_build_object('got', false); end if;
  k := pool[1 + floor(random() * array_length(pool, 1))::int]; v := public._pet_roll(k);
  if (select count(*) from public.pets where owner = pl.id) >= 3 then return jsonb_build_object('got', true, 'kind', k, 'var', v, 'full', true); end if;
  insert into public.pets (owner, kind, name, var, caught) values (pl.id, k, case k when 'crab' then '寄居蟹' when 'turtle' then '小海龜' when 'octopus' then '小章魚' when 'puffer' then '河豚' else '小水獺' end, v, true);
  return jsonb_build_object('got', true, 'kind', k, 'var', v, 'pets', public.pet_list());
end $$;

-- 掛賣／收回
create or replace function public.pet_sell(p_id bigint, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_price is null then
    update public.pets set price = null, listed_at = null where id = p_id and owner = auth.uid();
  else
    if p_price < 50 or p_price > 20000 then raise exception '價錢要 50～20000'; end if;
    update public.pets set price = p_price, listed_at = now(), out = false where id = p_id and owner = auth.uid();
  end if;
  if not found then raise exception '找不到這隻寵物'; end if;
  return public.pet_list();
end $$;

-- 市集（公開：不給賣家編號、不給親密度）
create or replace function public.pet_market() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'var', p.var, 'name', p.name, 'price', p.price, 'by', coalesce(nullif(btrim(pl.nickname), ''), '釣客'), 'mine', p.owner = auth.uid()) order by p.listed_at desc), '[]'::jsonb)
  from (select * from public.pets where price is not null order by listed_at desc limit 60) p join public.players pl on pl.id = p.owner $$;

create or replace function public.pet_buy(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; td date := (now() at time zone 'Asia/Taipei')::date; spent integer; give integer;
begin
  select * into p from public.pets where id = p_id for update;
  if p.id is null or p.price is null then raise exception '這隻寵物已經被買走了'; end if;
  if p.owner = pl.id then raise exception '這是你自己的寵物'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.total < 30 then raise exception '要先釣到 30 條魚才能買寵物'; end if;
  if (select count(*) from public.pets where owner = pl.id) >= 3 then raise exception '最多養 3 隻寵物'; end if;
  if pl.coins < p.price then raise exception '金幣不夠'; end if;
  spent := case when pl.design_spend_day = td then pl.design_spend else 0 end;
  if (pl.created_at > now() - interval '3 days' or pl.total < 200) and spent + p.price > 1500 then raise exception '新手一天在市集最多花 1500 金幣（帳號滿 3 天、釣到 200 條魚以後就沒有限制）'; end if;
  give := floor(p.price * 0.9)::int;
  update public.players set coins = coins - p.price, design_spend_day = td, design_spend = spent + p.price, updated_at = now() where id = pl.id returning * into pl;
  update public.players set coins = coins + give, earned = earned + give, updated_at = now() where id = p.owner;
  perform public._push(p.owner, 'market', '🐾 你的寵物有新家了', '「' || p.name || '」被買走了，+' || give || ' 金幣', give);
  update public.pets set owner = pl.id, price = null, listed_at = null, out = false, love = 0, fed_day = null, fed_n = 0, gift_day = null where id = p.id;
  return jsonb_build_object('pets', public.pet_list(), 'player', to_jsonb(pl));
end $$;

-- 掛賣中的不能帶出門、不能餵
create or replace function public.pet_feed(p_id bigint, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; e jsonb; td date := (now() at time zone 'Asia/Taipei')::date; r text; add integer;
begin
  select * into p from public.pets where id = p_id and owner = pl.id for update;
  if p.id is null then raise exception '找不到這隻寵物'; end if;
  if p.price is not null then raise exception '掛在市集賣的寵物不能餵，先收回來'; end if;
  select * into pl from public.players where id = pl.id for update;
  select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '這條魚不在你的魚缸裡'; end if;
  if p.fed_day = td and p.fed_n >= 6 then raise exception '今天吃飽了，明天再餵'; end if;
  r := coalesce(public._fishcfg()->'fish'->(e->>'f')->>'r', (select rarity from public.fish_species where id = e->>'f'), '常見');
  if p.fed_day is distinct from td then add := 15 + case r when '傳說' then 10 when '稀有' then 5 else 0 end; p.fed_n := 1;
  else add := 1; p.fed_n := p.fed_n + 1; end if;
  update public.players set tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where (x->>'t')::bigint <> p_t), '[]'::jsonb),
    show = case when show is null then show else coalesce((select jsonb_agg(x) from jsonb_array_elements(show) x where (x #>> '{}') <> p_t::text), '[]'::jsonb) end,
    updated_at = now() where id = pl.id returning * into pl;
  update public.pets set love = love + add, fed_day = td, fed_n = p.fed_n where id = p.id returning * into p;
  return jsonb_build_object('add', add, 'pet', public._pet_row(p), 'player', to_jsonb(pl));
end $$;

create or replace function public.pet_out(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_id is not null and not exists (select 1 from public.pets where id = p_id and owner = auth.uid()) then raise exception '找不到這隻寵物'; end if;
  if p_id is not null and exists (select 1 from public.pets where id = p_id and price is not null) then raise exception '掛在市集賣的寵物不能帶出門，先收回來'; end if;
  update public.pets set out = (id = p_id) where owner = auth.uid();
  return public.pet_list();
end $$;

create or replace function public.isle_pets(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'var', var, 'name', name, 'acc', public._pet_acc(love)) order by id), '[]'::jsonb) from public.pets where owner = p_owner and not out $$;

do $$ declare f text; begin
  foreach f in array array['pet_adopt(text,text)', 'pet_lucky()', 'pet_sell(bigint,integer)', 'pet_market()', 'pet_buy(bigint)', 'pet_out(bigint)', 'isle_pets(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '寵物第二版：花色、釣到寵物、寵物市集 🐾' as result;
