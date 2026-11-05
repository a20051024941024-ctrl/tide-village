-- 潮汐釣魚村：🏮 台灣節慶活動（可以重複執行）
-- 日期都放在 festivals 表（不寫死在程式裡），站長要改就用 SQL 改 starts_at／ends_at（台灣時間 +08）。
-- 農曆節日的國曆日期來源：
--   2027：行政院人事行政總處 116 年（2027）政府行政機關辦公日曆表（整理自 104 職場力 https://blog.104.com.tw/2027-taiwan-government-calendar/ ）
--         除夕 2/5、春節 2/6、端午 6/9、中秋 9/15；元宵是正月十五 = 2/20。
--   2028：農曆換算（StudyCLI 2028 中國節日表 https://studycli.org/chinese-holidays/2028/ ）：除夕 1/25、春節 1/26、元宵 2/9、端午 5/28、中秋 10/3。
--         2028 的台灣辦公日曆表還沒公布，公布後如果放假日不同，用 SQL 改這張表就好。
-- 活動期間：跨年 12/31 傍晚～1/1；春節從除夕起 7 天；元宵 1 天；端午、中秋各 3 天（節日當天和前後一天）；夜市每個月第一個週六傍晚～週日。
-- 伺服器管的事：
--   · 限定商品（衣服：舞獅帽、派對帽、柚子帽、香包；家具：春聯、天燈、龍舟模型、夜市小攤）只有節日期間買得到，買到的永遠保留。
--   · 春節紅包：每天登入領一次（88～888 金幣）。
--   · 元宵猜燈謎：每一題每人只能答對一次，答對 50 金幣。
--   · 跨年紀念章：12/31 23:50～1/1 00:15 在線上按「領紀念章」才拿得到。
--   · 每個節日開始時推播（玩家可以在設定關掉「節慶活動」）。

create table if not exists public.festivals (
  id text primary key, kind text not null check (kind in ('ny', 'cny', 'lantern', 'duanwu', 'moon', 'night')),
  name text not null, starts_at timestamptz not null, ends_at timestamptz not null, announced boolean not null default false
);
alter table public.festivals enable row level security;
revoke all on public.festivals from anon, authenticated;
insert into public.festivals (id, kind, name, starts_at, ends_at) values
  ('ny2027', 'ny', '跨年', '2026-12-31 18:00+08', '2027-01-01 23:59+08'),
  ('cny2027', 'cny', '春節', '2027-02-05 00:00+08', '2027-02-11 23:59+08'),
  ('lantern2027', 'lantern', '元宵節', '2027-02-20 00:00+08', '2027-02-20 23:59+08'),
  ('duanwu2027', 'duanwu', '端午節', '2027-06-08 00:00+08', '2027-06-10 23:59+08'),
  ('moon2027', 'moon', '中秋節', '2027-09-14 00:00+08', '2027-09-16 23:59+08'),
  ('ny2028', 'ny', '跨年', '2027-12-31 18:00+08', '2028-01-01 23:59+08'),
  ('cny2028', 'cny', '春節', '2028-01-25 00:00+08', '2028-01-31 23:59+08'),
  ('lantern2028', 'lantern', '元宵節', '2028-02-09 00:00+08', '2028-02-09 23:59+08'),
  ('duanwu2028', 'duanwu', '端午節', '2028-05-27 00:00+08', '2028-05-29 23:59+08'),
  ('moon2028', 'moon', '中秋節', '2028-10-02 00:00+08', '2028-10-04 23:59+08'),
  ('night202611', 'night', '夜市', '2026-11-07 17:00+08', '2026-11-08 23:59+08'),
  ('night202612', 'night', '夜市', '2026-12-05 17:00+08', '2026-12-06 23:59+08'),
  ('night202701', 'night', '夜市', '2027-01-02 17:00+08', '2027-01-03 23:59+08'),
  ('night202702', 'night', '夜市', '2027-02-06 17:00+08', '2027-02-07 23:59+08'),
  ('night202703', 'night', '夜市', '2027-03-06 17:00+08', '2027-03-07 23:59+08'),
  ('night202704', 'night', '夜市', '2027-04-03 17:00+08', '2027-04-04 23:59+08'),
  ('night202705', 'night', '夜市', '2027-05-01 17:00+08', '2027-05-02 23:59+08'),
  ('night202706', 'night', '夜市', '2027-06-05 17:00+08', '2027-06-06 23:59+08'),
  ('night202707', 'night', '夜市', '2027-07-03 17:00+08', '2027-07-04 23:59+08'),
  ('night202708', 'night', '夜市', '2027-08-07 17:00+08', '2027-08-08 23:59+08'),
  ('night202709', 'night', '夜市', '2027-09-04 17:00+08', '2027-09-05 23:59+08'),
  ('night202710', 'night', '夜市', '2027-10-02 17:00+08', '2027-10-03 23:59+08'),
  ('night202711', 'night', '夜市', '2027-11-06 17:00+08', '2027-11-07 23:59+08'),
  ('night202712', 'night', '夜市', '2027-12-04 17:00+08', '2027-12-05 23:59+08'),
  ('night202801', 'night', '夜市', '2028-01-01 17:00+08', '2028-01-02 23:59+08'),
  ('night202802', 'night', '夜市', '2028-02-05 17:00+08', '2028-02-06 23:59+08'),
  ('night202803', 'night', '夜市', '2028-03-04 17:00+08', '2028-03-05 23:59+08'),
  ('night202804', 'night', '夜市', '2028-04-01 17:00+08', '2028-04-02 23:59+08'),
  ('night202805', 'night', '夜市', '2028-05-06 17:00+08', '2028-05-07 23:59+08'),
  ('night202806', 'night', '夜市', '2028-06-03 17:00+08', '2028-06-04 23:59+08'),
  ('night202807', 'night', '夜市', '2028-07-01 17:00+08', '2028-07-02 23:59+08'),
  ('night202808', 'night', '夜市', '2028-08-05 17:00+08', '2028-08-06 23:59+08'),
  ('night202809', 'night', '夜市', '2028-09-02 17:00+08', '2028-09-03 23:59+08'),
  ('night202810', 'night', '夜市', '2028-10-07 17:00+08', '2028-10-08 23:59+08'),
  ('night202811', 'night', '夜市', '2028-11-04 17:00+08', '2028-11-05 23:59+08')
on conflict (id) do nothing;   -- 已經有的不蓋掉（站長改過的日期保留）

create table if not exists public.fest_log (uid uuid not null, what text not null, day date not null, at timestamptz not null default now(), primary key (uid, what, day));
alter table public.fest_log enable row level security;
revoke all on public.fest_log from anon, authenticated;
create table if not exists public.fest_riddles (id integer primary key, q text not null, a text[] not null, hint text);
alter table public.fest_riddles enable row level security;
revoke all on public.fest_riddles from anon, authenticated;
insert into public.fest_riddles (id, q, a, hint) values
  (1, '有頭沒有頸，身上冷冰冰，有翅不能飛，無腳也能行。（猜一種動物）', array['魚'], '水裡游的'),
  (2, '小時穿黑衣，大時穿綠袍，水裡過日子，岸上來睡覺。（猜一種動物）', array['青蛙', '蛙'], '小時候是蝌蚪'),
  (3, '身穿紅袍子，頭戴綠帽子，一碰就流血，不碰也冒汗。（猜一種水果）', array['草莓'], '春天的水果'),
  (4, '八隻腳，抬面鼓，兩把剪刀鼓前舞，生來橫行又霸道，嘴裡常把泡沫吐。（猜一種動物）', array['螃蟹', '蟹'], '走路橫著走'),
  (5, '一位公公精神好，從早到晚不睡覺，身體只有一隻腳，眼睛長在頭頂上。（猜一種東西）', array['路燈', '燈'], '晚上會亮'),
  (6, '上不怕水，下不怕火，家家廚房，都有一個。（猜一種東西）', array['鍋', '鍋子', '鐵鍋'], '煮東西用的'),
  (7, '一個老頭，不跑不走，請他睡覺，他就搖頭。（猜一種東西）', array['不倒翁'], '推不倒'),
  (8, '頭戴紅帽子，身穿白袍子，走路像公子，說話像傻子。（猜一種動物）', array['鵝', '大白鵝'], '會嘎嘎叫'),
  (9, '弟兄七八個，圍著柱子坐，只要一分開，衣服就扯破。（猜一種東西）', array['大蒜', '蒜', '蒜頭'], '廚房的調味料'),
  (10, '千條線，萬條線，掉到水裡看不見。（猜一種天氣）', array['雨', '下雨'], '天上掉下來的')
on conflict (id) do update set q = excluded.q, a = excluded.a, hint = excluded.hint;

create or replace function public._fest_on(k text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.festivals where kind = k and now() between starts_at and ends_at) $$;
create or replace function public._fest_item(p text) returns text language sql immutable as $$
  select case p when 'hat_lion' then 'cny' when 'fe_couplet' then 'cny' when 'hat_party' then 'ny' when 'fe_skylantern' then 'lantern' when 'acc_sachet' then 'duanwu' when 'fe_dragonboat' then 'duanwu' when 'hat_pomelo' then 'moon' when 'fe_stall' then 'night' end $$;
create or replace function public._fest_price(p text) returns integer language sql immutable as $$
  select case p when 'fe_couplet' then 200 when 'fe_skylantern' then 300 when 'fe_dragonboat' then 600 when 'fe_stall' then 800 end $$;

create or replace function public._item_price(p text) returns integer language sql immutable as $$
  select v.price from (values
    ('hat_sun',0),('hat_wizard',1200),('hat_knight',1800),('hat_bear',1000),('hat_none',0),('hat_cap',250),('hat_beanie',300),('hat_bucket',350),('hat_cat',600),('hat_chef',800),('hat_flower',500),('hat_pirate',1500),('hat_crown',5000),
    ('top_tee',0),('top_stripe',300),('top_apron',400),('top_vest',500),('top_hoodie',700),('top_hawaii',800),('top_suit',2500),
    ('pants_jeans',0),('pants_shorts',200),('pants_khaki',250),('pants_skirt',500),('pants_overalls',600),('pants_rainbow',1500),
    ('shoes_boots',0),('shoes_sandals',150),('shoes_sneakers',250),('shoes_rain',350),('shoes_gold',2500),
    ('socks_none',0),('socks_white',80),('socks_stripe',200),('socks_rainbow',500),
    ('acc_none',0),('acc_scarf',300),('acc_bowtie',350),('acc_glasses',450),('acc_shell',600),('acc_lei',700),
    ('acc_scarf_black',320),('acc_scarf_white',320),('acc_scarf_navy',350),('acc_scarf_pink',350),('acc_scarf_yellow',350),('acc_scarf_green',350),('acc_scarf_grey',380),('acc_scarf_brown',380),('acc_scarf_plaid',500),('acc_scarf_stripe',500),('acc_scarf_rainbow',900),
    ('back_none',0),('back_kcape_m',900),('back_kcape_r',900),('back_kcape_b',800),('back_kcape_g',900),('back_bag',400),('back_basket',500),('back_balloon',800),('back_cape',1500),('back_wings',3000),
    ('hat_lion',800),('hat_party',300),('hat_pomelo',300),('acc_sachet',300),   -- 節慶限定（083）：只有節日期間買得到，買到的永遠保留
    ('face_normal',0),('face_happy',200),('face_sleepy',200),('face_wink',300),('face_cool',600),('face_heart',700),('face_star',900)
  ) v(id, price) where v.id = p $$;

-- 買衣服：限定的只有節日期間買得到（已經買的保留）
create or replace function public.buy_item(p_item text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._item_price(p_item); slot text := split_part(p_item, '_', 1); fk text := public._fest_item(p_item);
begin
  if price is null then raise exception '沒有這個商品'; end if;
  if price = 0 or p_item = any(pl.owned) then return pl; end if;
  if fk is not null and not public._fest_on(fk) then raise exception '這是節慶限定的，節日的時候才買得到'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, owned = array_append(owned, p_item),
    gear = jsonb_set(coalesce(gear, '{}'::jsonb), array[slot], to_jsonb(p_item)), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 買節慶家具：買一次就永遠是你的，擺在家裡不用再付錢
create or replace function public.fest_buy(p_item text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pr integer := public._fest_price(p_item); fk text := public._fest_item(p_item);
begin
  if pr is null then raise exception '沒有這個商品'; end if;
  if p_item = any(pl.owned) then return pl; end if;
  if not public._fest_on(fk) then raise exception '這是節慶限定的，節日的時候才買得到'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - pr, owned = array_append(owned, p_item), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 現在有哪些節日、下一個是什麼（公開）
create or replace function public.fest_now() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('now', now(),
    'on', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'name', name, 'start', starts_at, 'end', ends_at) order by starts_at) from public.festivals where now() between starts_at and ends_at), '[]'::jsonb),
    'next', (select jsonb_build_object('id', id, 'kind', kind, 'name', name, 'start', starts_at, 'end', ends_at) from public.festivals where starts_at > now() order by starts_at limit 1),
    'mine', coalesce((select jsonb_agg(what) from public.fest_log where uid = auth.uid() and day = (now() at time zone 'Asia/Taipei')::date), '[]'::jsonb)) $$;

-- 春節紅包：每天一次
create or replace function public.fest_hongbao() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; r numeric := random(); c integer;
begin
  if not public._fest_on('cny') then raise exception '春節的時候才有紅包'; end if;
  insert into public.fest_log (uid, what, day) values (pl.id, 'hongbao', td) on conflict do nothing;
  if not found then raise exception '今天的紅包已經領過了，明天再來'; end if;
  c := case when r < 0.6 then 88 + floor(random() * 80)::int when r < 0.9 then 168 + floor(random() * 200)::int when r < 0.99 then 388 + floor(random() * 200)::int else 888 end;
  update public.players set coins = coins + c, earned = earned + c, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('coins', c, 'player', to_jsonb(pl));
end $$;

-- 元宵猜燈謎：題目（不給答案）、回答
create or replace function public.fest_riddles() returns jsonb language sql stable security definer set search_path = public as $$
  select case when public._fest_on('lantern') then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'q', r.q, 'hint', r.hint, 'done', exists (select 1 from public.fest_log l where l.uid = auth.uid() and l.what = 'riddle' || r.id || '_' || extract(year from now() at time zone 'Asia/Taipei')::int)) order by r.id) from public.fest_riddles r), '[]'::jsonb) else '[]'::jsonb end $$;
create or replace function public.fest_answer(p_id integer, p_answer text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.fest_riddles; ans text := regexp_replace(coalesce(p_answer, ''), '[\s。，,.!！?？「」]', '', 'g');
begin
  if not public._fest_on('lantern') then raise exception '元宵節的時候才能猜燈謎'; end if;
  select * into r from public.fest_riddles where id = p_id; if r.id is null then raise exception '沒有這一題'; end if;
  if exists (select 1 from public.fest_log where uid = pl.id and what = 'riddle' || p_id || '_' || extract(year from now() at time zone 'Asia/Taipei')::int) then raise exception '這一題你已經答對了'; end if;
  if (select count(*) from public.fest_log where uid = pl.id and what like 'try%' and at > now() - interval '1 minute') >= 10 then raise exception '猜太快了，休息一下'; end if;
  insert into public.fest_log (uid, what, day) values (pl.id, 'try' || p_id || '_' || floor(extract(epoch from now()) * 1000)::bigint, (now() at time zone 'Asia/Taipei')::date) on conflict do nothing;
  if not (ans = any(r.a)) then return jsonb_build_object('ok', false); end if;
  insert into public.fest_log (uid, what, day) values (pl.id, 'riddle' || p_id || '_' || extract(year from now() at time zone 'Asia/Taipei')::int, (now() at time zone 'Asia/Taipei')::date);
  update public.players set coins = coins + 50, earned = earned + 50, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('ok', true, 'coins', 50, 'player', to_jsonb(pl));
end $$;

-- 跨年紀念章：倒數的時候在線上才拿得到
create or replace function public.fest_badge() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); tp timestamp := now() at time zone 'Asia/Taipei'; y int; item text;
begin
  if (extract(month from tp) = 12 and extract(day from tp) = 31 and tp::time >= time '23:50') then y := extract(year from tp)::int + 1;
  elsif (extract(month from tp) = 1 and extract(day from tp) = 1 and tp::time < time '00:15') then y := extract(year from tp)::int;
  else raise exception '跨年倒數的時候（12/31 23:50～1/1 00:15）才能領'; end if;
  item := 'bt_ny' || y;
  update public.players set owned = case when item = any(owned) then owned else array_append(owned, item) end, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('item', item, 'player', to_jsonb(pl));
end $$;

-- 每個節日開始的時候推播一次
create or replace function public._fest_tick() returns void language plpgsql security definer set search_path = public as $$
declare f public.festivals;
begin
  for f in select * from public.festivals where not announced and now() between starts_at and ends_at loop
    update public.festivals set announced = true where id = f.id;
    perform public._push(null, 'fest', '🏮 ' || f.name || '活動開始了！', case f.kind when 'cny' then '每天登入領紅包，限定舞獅帽和春聯只有這幾天買得到' when 'lantern' then '晚上水面有燈籠，來猜燈謎拿金幣' when 'ny' then '晚上港口放煙火，倒數的時候在線上可以領紀念章' when 'duanwu' then '龍舟和香包限定登場' when 'moon' then '一起看月亮，柚子帽限定登場' else '廣場夜市開張了，晚上一起來逛' end, 0);
  end loop;
end $$;

-- 節慶家具 fe_、魚拓 gy_／gyb_：買過（拿到）的人可以擺，不用錢；其他照 082
create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
  if p ~ '^(gyb?|fe)_[a-z]{2,14}$' then
    rad := case p when 'fe_dragonboat' then 0.9 when 'fe_stall' then 0.9 else 0.45 end; flat := false;
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

revoke all on function public._fest_tick(), public._fest_on(text) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['buy_item(text)', 'fest_buy(text)', 'fest_now()', 'fest_hongbao()', 'fest_riddles()', 'fest_answer(integer,text)', 'fest_badge()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-fest', '*/5 * * * *', 'select public._fest_tick()');
  end if;
end $$;

select '台灣節慶活動設定完成 🏮' as result;
