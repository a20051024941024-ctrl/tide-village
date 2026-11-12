-- 潮汐釣魚村 v396：室內烏龜缸（可以重複執行）
-- 玩家想把烏龜缸放在屋子裡。新增一件屋內家具 turtletank（1500 金幣），效果跟島上的烏龜缸一樣：小烏龜名額 +5。
-- 屋裡的家具存在 island.items[房子].f 裡，所以拆掉的時候同一個 pen_guard 也擋得到。

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
    ('vanity',600,0.6,false),('nightstand',200,0.35,false),('mirror',350,0.35,false),('beanbag',250,0.5,false),('cushion',80,0.35,false),('coffee',350,0.6,false),('trophy',500,0.45,false),('turtletank',1500,0.8,false),('rodrack',400,0.5,false),('globe',300,0.3,false),('radio',250,0.3,false),('fan',200,0.3,false),('shoerack',300,0.5,false),('bar',900,0.9,false),('washer',700,0.45,false),('micro',250,0.35,false),('teaset',300,0.4,false),('cactus',100,0.3,false),('bonsai',400,0.35,false),('vase',150,0.3,false),('monstera',350,0.5,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

create or replace function public._pet_over(p_owner uuid, p_isl jsonb, p_add text default null) returns integer language sql stable security definer set search_path = public as $$
  with it as (select e from jsonb_array_elements(public._isle_items(public._isle_upgrade(p_isl))) e),
       pens as (select c, count(*) * 5 cap from (
                  select case e->>'t' when 'penland' then 'land' when 'pensea' then 'sea' else 'tank' end c from it where e->>'t' in ('penland', 'pensea', 'pentank')
                  union all
                  select 'tank' from it, jsonb_array_elements(case when jsonb_typeof(e->'f') = 'array' then e->'f' else '[]'::jsonb end) x where x->>'t' = 'turtletank') q group by c),
       n as (select c, count(*) n from (select public._pet_cat(kind) c from public.pets where owner = p_owner
                                         union all select public._pet_cat(p_add) where p_add is not null) x group by c)
  select coalesce(sum(greatest(0, n.n - coalesce(pens.cap, 0))), 0)::int from n left join pens using (c) $$;

create or replace function public._pen_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare a integer; b integer;
begin
  if new.island is not distinct from old.island then return new; end if;
  if old.island::text !~ '"(penland|pensea|pentank|turtletank)"' then return new; end if;
  a := public._pet_over(new.id, new.island); b := public._pet_over(new.id, old.island);
  if a > 3 and a > b then raise exception '圍欄裡還有寵物，拆了會放不下（可以先把寵物放到市集，或是多買一個圍欄）'; end if;
  return new;
end $$;

revoke all on function public._pet_over(uuid, jsonb, text) from public, anon, authenticated;
