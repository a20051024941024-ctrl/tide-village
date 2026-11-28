-- 潮汐釣魚村 v988：慢慢烏龜屋第二輪（可以重複執行）
-- 1. 照顧小烏龜多一種「lamp」：在慢慢烏龜屋或家裡的曬背燈台下曬，不用等晴天（跟曬太陽共用一天一次）。
-- 2. 家具多兩樣：曬背燈台 baskinglamp 🪙400、烏龜造景石 turtlerock 🪙250。其他照 156。

create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
  if p ~ '^(gyb?|fe)_[a-z]{2,14}$' then
    rad := case p when 'fe_dragonboat' then 0.9 when 'fe_stall' then 0.9 else 0.45 end; flat := false;
    price := case when exists (select 1 from public.players where id = auth.uid() and p = any(owned)) then 0 end;
    return;
  end if;
  if p ~ '^gk[0-9]{1,9}$' then   -- 132 自己做的魚拓：只有做的人能擺，不用錢
    rad := 0.45; flat := false;
    price := case when exists (select 1 from public.gyotaku g where g.id = substr(p, 3)::integer and g.uid = auth.uid()) then 0 end;
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
    ('kk_bed_single_A',650,1.0,false),('kk_bed_single_B',650,1.0,false),('kk_bed_double_A',1300,1.3,false),('kk_bed_double_B',1300,1.3,false),('kk_cabinet_small',300,0.4,false),('kk_cabinet_small_decorated',380,0.4,false),('kk_cabinet_medium',450,0.7,false),('kk_cabinet_medium_decorated',600,0.7,false),('kk_lamp_table',180,0.3,false),('kk_lamp_standing',260,0.35,false),('kk_couch',900,1.1,false),('kk_couch_pillows',1000,1.1,false),('kk_armchair',450,0.6,false),('kk_armchair_pillows',520,0.6,false),('kk_chair_A',140,0.35,false),('kk_chair_A_wood',140,0.35,false),('kk_chair_B_wood',160,0.35,false),('kk_chair_C',160,0.35,false),('kk_chair_stool_wood',90,0.3,false),('kk_table_low',350,0.9,false),('kk_table_small',250,0.4,false),('kk_table_medium',450,0.8,false),('kk_table_medium_long',600,1.1,false),('kk_rug_oval_A',260,1.1,true),('kk_rug_rectangle_A',240,1.1,true),('kk_rug_rectangle_stripes_A',280,1.1,true),('kk_rug_rectangle_stripes_B',280,1.1,true),('kk_cactus_small_A',120,0.25,false),('kk_cactus_small_B',120,0.25,false),('kk_cactus_medium_A',220,0.4,false),('kk_cactus_medium_B',220,0.4,false),
    ('vanity',600,0.6,false),('nightstand',200,0.35,false),('mirror',350,0.35,false),('beanbag',250,0.5,false),('cushion',80,0.35,false),('coffee',350,0.6,false),('trophy',500,0.45,false),('turtletank',1500,1.3,false),('baskinglamp',400,0.45,false),('turtlerock',250,0.5,false),('rodrack',400,0.5,false),('globe',300,0.3,false),('radio',250,0.3,false),('fan',200,0.3,false),('shoerack',300,0.5,false),('bar',900,0.9,false),('washer',700,0.45,false),('micro',250,0.35,false),('teaset',300,0.4,false),('cactus',100,0.3,false),('bonsai',400,0.35,false),('vase',150,0.3,false),('monstera',350,0.5,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

create or replace function public.turtle_care(p_id bigint, p_act text, p_food text default null, p_t bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; t public.pet_turtle; td date := (now() at time zone 'Asia/Taipei')::date; add integer := 0; msg text; e jsonb; f jsonb;
begin
  select * into p from public.pets where id = p_id and owner = pl.id;
  if p.id is null or p.kind <> 'pondturtle' then raise exception '找不到這隻小烏龜'; end if;
  if p.price is not null then raise exception '掛在市集賣的寵物不能照顧，先收回來'; end if;
  t := public._turtle_get(p.id, pl.id);
  if p_act = 'sun' then
    if t.last_sun = td then raise exception '今天曬過太陽了，明天再來'; end if;
    if coalesce(public._weather((extract(epoch from now()) * 1000)::bigint)->>'k', 'sunny') <> 'sunny' then raise exception '現在不是晴天，等出太陽再帶牠出來曬'; end if;
    add := 6; t.last_sun := td; msg := '曬太陽讓龜殼長得又硬又亮，這是最有效的照顧';
  elsif p_act = 'lamp' then   -- 262：慢慢烏龜屋、家裡的曬背燈台，下雨天也能曬（跟曬太陽共用一天一次）
    if t.last_sun = td then raise exception '今天曬過了，明天再來'; end if;
    add := 6; t.last_sun := td; msg := '曬背燈的光跟太陽一樣，殼會又硬又亮';
  elsif p_act = 'feed' then
    if p_food not in ('pellet', 'greens', 'fish') then raise exception '沒有這種食物'; end if;
    if t.last_feed = td then raise exception '今天吃過了，吃太多對烏龜不好，明天再餵'; end if;
    if p_food = 'fish' then
      select * into pl from public.players where id = pl.id for update;
      select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
      if e is null then raise exception '這條魚不在你的魚缸裡'; end if;
      f := public._fishcfg()->'fish'->(e->>'f');
      if coalesce(f->>'r', '常見') <> '常見' or (e->>'w')::numeric > 1.5 or coalesce((e->>'k')::boolean, false) then raise exception '要給一條小小的常見魚（1.5 公斤以下、沒有收藏）'; end if;
      update public.players set tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where (x->>'t')::bigint <> p_t), '[]'::jsonb),
        show = case when show is null then show else coalesce((select jsonb_agg(x) from jsonb_array_elements(show) x where (x #>> '{}') <> p_t::text), '[]'::jsonb) end, updated_at = now()
        where id = pl.id returning * into pl;
    end if;
    add := 3 + case when t.last_food is distinct from p_food then 2 else 0 end; msg := case when t.last_food is distinct from p_food then '換著吃，營養比較均衡' else '每天換不同的食物，效果會更好喔' end;
    t.last_feed := td; t.last_food := p_food;
  elsif p_act = 'treat' then
    if t.last_treat is not null and t.last_treat > now() - interval '20 hours' then raise exception '剛剛才吃過點心'; end if;
    if t.last_treat is null or t.last_treat < now() - interval '6 days 12 hours' then add := 3; msg := '蛋黃是點心，牠吃得好開心！一週一次就好';
    else add := 0; msg := '點心偶爾給就好，太常吃反而沒效喔'; end if;
    t.last_treat := now();
  elsif p_act = 'clean' then
    if t.last_clean = td then raise exception '今天換過水了'; end if;
    add := 1; t.last_clean := td; msg := '水乾淨、殼刷乾淨，光澤就不會掉';
  elsif p_act = 'oil' then
    if t.last_oil is not null and t.last_oil > now() - interval '30 days' then raise exception '一個月最多保養一次，太常塗反而會悶住龜殼'; end if;
    select * into pl from public.players where id = pl.id for update;
    if pl.coins < 120 then raise exception '金幣不夠（龜殼保養 🪙120）'; end if;
    update public.players set coins = coins - 120, updated_at = now() where id = pl.id returning * into pl;
    add := 3; t.last_oil := now(); msg := '偶爾保養就好，太常塗反而不好';
  else raise exception '不知道要怎麼照顧'; end if;
  t.shine := least(100, t.shine + add);
  if t.shine >= 100 and (t.full_day is null or t.full_day < td - 6) then t.full_day := td; end if;
  update public.pet_turtle set shine = t.shine, last_sun = t.last_sun, last_feed = t.last_feed, last_food = t.last_food, last_clean = t.last_clean, last_treat = t.last_treat, last_oil = t.last_oil,
    last_care = case when p_act = 'treat' and add = 0 then last_care else now() end, last_decay = case when p_act = 'treat' and add = 0 then last_decay else null end, full_day = t.full_day where pet_id = p.id;   -- 太常給點心不算照顧
  if p_act in ('feed', 'treat') then update public.pets set love = love + 1 where id = p.id; end if;
  select * into p from public.pets where id = p.id;
  return jsonb_build_object('add', add, 'msg', msg, 'pet', public._pet_row(p), 'player', to_jsonb(pl));
end $$;
