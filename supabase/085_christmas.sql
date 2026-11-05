-- 085 聖誕節（加在 083 的節慶活動裡）：可以重複執行
-- 每年 12/20～12/26：廣場大聖誕樹、每天一份聖誕禮物、限定聖誕帽／麋鹿角／聖誕樹家具；12/31 接著是跨年
alter table public.festivals drop constraint if exists festivals_kind_check;
alter table public.festivals add constraint festivals_kind_check check (kind in ('ny', 'cny', 'lantern', 'duanwu', 'moon', 'night', 'xmas'));
insert into public.festivals (id, kind, name, starts_at, ends_at) values
  ('xmas2026', 'xmas', '聖誕節', '2026-12-20 00:00+08', '2026-12-26 23:59+08'),
  ('xmas2027', 'xmas', '聖誕節', '2027-12-20 00:00+08', '2027-12-26 23:59+08'),
  ('xmas2028', 'xmas', '聖誕節', '2028-12-20 00:00+08', '2028-12-26 23:59+08')
on conflict (id) do update set kind = excluded.kind, name = excluded.name, starts_at = excluded.starts_at, ends_at = excluded.ends_at;

create or replace function public._fest_item(p text) returns text language sql immutable as $$
  select case p when 'hat_lion' then 'cny' when 'fe_couplet' then 'cny' when 'hat_party' then 'ny' when 'fe_skylantern' then 'lantern' when 'acc_sachet' then 'duanwu' when 'fe_dragonboat' then 'duanwu' when 'hat_pomelo' then 'moon' when 'fe_stall' then 'night'
    when 'hat_santa' then 'xmas' when 'hat_antler' then 'xmas' when 'fe_xtree' then 'xmas' end $$;
create or replace function public._fest_price(p text) returns integer language sql immutable as $$
  select case p when 'fe_couplet' then 200 when 'fe_skylantern' then 300 when 'fe_dragonboat' then 600 when 'fe_stall' then 800 when 'fe_xtree' then 500 end $$;

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
    ('hat_santa',300),('hat_antler',350),   -- 聖誕節限定（085）
    ('face_normal',0),('face_happy',200),('face_sleepy',200),('face_wink',300),('face_cool',600),('face_heart',700),('face_star',900)
  ) v(id, price) where v.id = p $$;

-- 聖誕禮物：節日期間每天一份
create or replace function public.fest_gift() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; r numeric := random(); c integer;
begin
  if not public._fest_on('xmas') then raise exception '聖誕節的時候才有禮物'; end if;
  insert into public.fest_log (uid, what, day) values (pl.id, 'xgift', td) on conflict do nothing;
  if not found then raise exception '今天的禮物已經拿過了，明天再來'; end if;
  c := case when r < 0.6 then 50 + floor(random() * 100)::int when r < 0.92 then 150 + floor(random() * 150)::int else 500 end;
  update public.players set coins = coins + c, earned = earned + c, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('coins', c, 'player', to_jsonb(pl));
end $$;

create or replace function public._fest_tick() returns void language plpgsql security definer set search_path = public as $$
declare f public.festivals;
begin
  for f in select * from public.festivals where not announced and now() between starts_at and ends_at loop
    update public.festivals set announced = true where id = f.id;
    perform public._push(null, 'fest', case when f.kind = 'xmas' then '🎄 ' else '🏮 ' end || f.name || '活動開始了！', case f.kind when 'cny' then '每天登入領紅包，限定舞獅帽和春聯只有這幾天買得到' when 'lantern' then '晚上水面有燈籠，來猜燈謎拿金幣' when 'ny' then '晚上港口放煙火，倒數的時候在線上可以領紀念章' when 'duanwu' then '龍舟和香包限定登場' when 'moon' then '一起看月亮，柚子帽限定登場' when 'xmas' then '廣場立起大聖誕樹，每天來拿一份聖誕禮物，限定聖誕帽和麋鹿角' else '廣場夜市開張了，晚上一起來逛' end, 0);
  end loop;
end $$;

do $$ begin
  revoke all on function public.fest_gift() from public, anon; grant execute on function public.fest_gift() to authenticated;
  revoke all on function public._fest_tick() from public, anon, authenticated;
end $$;

select '聖誕節設定完成 🎄' as result;
