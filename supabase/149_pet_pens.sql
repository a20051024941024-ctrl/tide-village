-- 潮汐釣魚村 v386：寵物圍欄（可以重複執行）
-- 玩家意見：寵物上限 3 隻太少，想買圍欄多養。分三種，各 1500 金幣、各多 5 隻名額：
--   陸地圍欄 penland：貓、柴犬、海鷗
--   海水池   pensea ：水獺、寄居蟹、小海龜、章魚、河豚
--   烏龜缸   pentank：小烏龜
-- 原本的 3 隻名額照舊什麼都能養；圍欄是小島上的東西，算在小島 60 件裡，數量不另外設上限。
-- 圍欄裡還有寵物（拆了會超過名額）就不能拆。

create or replace function public._isle_item(p text, out price integer, out rad numeric, out house boolean) language sql immutable as $$
  select v.price, v.rad, v.house from (values
    ('cabin',1500,2.6,true),('beach',3000,2.9,true),('villa',8000,3.6,true),('tea',5500,3.0,true),('mansion',3000,4.6,true),
    ('flower',200,0.9,false),('bench',150,0.9,false),('lamp',250,0.35,false),('palm',400,0.6,false),('pond',1200,1.5,false),('flag',300,0.3,false),
    ('fence',80,0.9,false),('tree',300,1.1,false),('rock',100,0.7,false),('mailbox',200,0.35,false),('picnic',600,1.4,false),('parasol',350,1.0,false),
    ('campfire',450,0.8,false),('statue',2000,0.9,false),('swing',900,1.3,false),('bush',120,0.7,false),('lantern',180,0.4,false),('boat',1500,1.6,false),
    ('hammock',700,1.4,false),('windmill',1200,0.9,false),('well',800,0.8,false),('arch',650,1.0,false),('birdhouse',220,0.35,false),('bbq',500,0.7,false),('sunbed',300,1.0,false),('surf',250,0.4,false),('fountain',2500,1.4,false),('bridge',900,1.5,false),('minilh',1800,0.8,false),('scarecrow',300,0.5,false),('bike',600,0.8,false),('hydrangea',180,0.7,false),('sunflower',150,0.5,false),('cherry',800,1.3,false),('maple',600,1.2,false),('pergola',1100,1.6,false),('tent',700,1.2,false),('buoys',150,0.5,false),('crates',120,0.6,false),('fishrack',400,0.9,false),('stonepath',40,0.6,false),('hedge',100,0.9,false),
    ('penland',1500,2.0,false),('pensea',1500,1.8,false),('pentank',1500,1.2,false)
  ) v(id, price, rad, house) where v.id = p $$;

create or replace function public._pet_cat(k text) returns text language sql immutable as $$
  select case when k in ('cat', 'shiba', 'gull') then 'land' when k = 'pondturtle' then 'tank' else 'sea' end $$;

-- 照島上的圍欄算：每一類超過圍欄名額的部分加起來，要在一般 3 隻以內
create or replace function public._pet_over(p_owner uuid, p_isl jsonb, p_add text default null) returns integer language sql stable security definer set search_path = public as $$
  with pens as (select case e->>'t' when 'penland' then 'land' when 'pensea' then 'sea' else 'tank' end c, count(*) * 5 cap
                from jsonb_array_elements(public._isle_items(public._isle_upgrade(p_isl))) e where e->>'t' in ('penland', 'pensea', 'pentank') group by 1),
       n as (select c, count(*) n from (select public._pet_cat(kind) c from public.pets where owner = p_owner
                                         union all select public._pet_cat(p_add) where p_add is not null) x group by c)
  select coalesce(sum(greatest(0, n.n - coalesce(pens.cap, 0))), 0)::int from n left join pens using (c) $$;

create or replace function public._pet_fit(p_owner uuid, p_kind text) returns boolean language sql stable security definer set search_path = public as $$
  select public._pet_over(p_owner, (select island from public.players where id = p_owner), p_kind) <= 3 $$;

-- 拆圍欄：拆了寵物會超過名額就不行
create or replace function public._pen_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare a integer; b integer;
begin
  if new.island is not distinct from old.island then return new; end if;
  if not exists (select 1 from jsonb_array_elements(public._isle_items(public._isle_upgrade(old.island))) e where e->>'t' in ('penland', 'pensea', 'pentank')) then return new; end if;
  a := public._pet_over(new.id, new.island); b := public._pet_over(new.id, old.island);
  if a > 3 and a > b then raise exception '圍欄裡還有寵物，拆了會放不下（可以先把寵物放到市集，或是多買一個圍欄）'; end if;
  return new;
end $$;
drop trigger if exists pen_guard on public.players;
create trigger pen_guard before update of island on public.players for each row execute function public._pen_guard();

create or replace function public.pet_adopt(p_kind text, p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pr integer := public._pet_price(p_kind); nm text := public._pet_name(p_name); v text;
begin
  if pr is null then raise exception '這種寵物店裡沒有賣'; end if;
  select * into pl from public.players where id = pl.id for update;
  if not public._pet_fit(pl.id, p_kind) then raise exception '寵物名額滿了（一般 3 隻；買陸地圍欄、海水池、烏龜缸可以多養）'; end if;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - pr, updated_at = now() where id = pl.id returning * into pl;
  v := public._pet_roll(p_kind);
  insert into public.pets (owner, kind, name, var) values (pl.id, p_kind, nm, v);
  return jsonb_build_object('pets', public.pet_list(), 'player', to_jsonb(pl), 'var', v);
end $$;

create or replace function public.pet_buy(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; td date := (now() at time zone 'Asia/Taipei')::date; spent integer; give integer;
begin
  select * into p from public.pets where id = p_id for update;
  if p.id is null or p.price is null then raise exception '這隻寵物已經被買走了'; end if;
  if p.owner = pl.id then raise exception '這是你自己的寵物'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.total < 30 then raise exception '要先釣到 30 條魚才能買寵物'; end if;
  if not public._pet_fit(pl.id, p.kind) then raise exception '寵物名額滿了（一般 3 隻；買陸地圍欄、海水池、烏龜缸可以多養）'; end if;
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
  if spots && array['river', 'creek', 'weir', 'lake', 'canal'] then pool := pool || array['otter', 'pondturtle']; end if;
  if spots && array['lake', 'canal', 'pool'] then pool := pool || array['pondturtle']; end if;
  if coalesce(array_length(pool, 1), 0) = 0 then return jsonb_build_object('got', false); end if;
  k := pool[1 + floor(random() * array_length(pool, 1))::int]; v := public._pet_roll(k);
  if not public._pet_fit(pl.id, k) then return jsonb_build_object('got', true, 'kind', k, 'var', v, 'full', true); end if;
  insert into public.pets (owner, kind, name, var, caught) values (pl.id, k, case k when 'crab' then '寄居蟹' when 'turtle' then '小海龜' when 'octopus' then '小章魚' when 'puffer' then '河豚' when 'pondturtle' then '小烏龜' else '小水獺' end, v, true);
  return jsonb_build_object('got', true, 'kind', k, 'var', v, 'pets', public.pet_list());
end $$;

revoke all on function public._pet_over(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public._pet_fit(uuid, text) from public, anon, authenticated;
