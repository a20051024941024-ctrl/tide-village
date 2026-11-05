-- 潮汐釣魚村：新家具（KayKit Furniture Bits，Kay Lousberg，CC0；可以重複執行）
-- 31 件圓角、溫暖風格的家具：床、櫃子、檯燈、沙發、扶手椅、椅子、桌子、地毯、仙人掌。
-- 價格和大小跟手機（js/game.js 的 KKF_LIST）一樣；擺的時候伺服器照這裡收錢、收掉退一半。

create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
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

select '新家具設定完成 🛋️' as result;
