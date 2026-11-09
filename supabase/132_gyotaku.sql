-- 潮汐釣魚村 v342：魚拓（可以重複執行）
-- 魚缸裡任何一條魚都可以做成一張魚拓（墨色的魚印在和紙上，寫上魚名、重量、釣到的日期、釣客名字、紅色印章）。
--   做一張 🪙200；魚還是留在魚缸裡；同一條魚只能做一次；每人最多 40 張（可以丟掉）。
--   魚拓可以當家具掛在家裡（家具 id 'gk<編號>'，只有做的人能擺，不用錢），來玩的人也看得到。
--   金幣和「魚缸裡真的有這條魚」都由伺服器檢查。

create table if not exists public.gyotaku (
  id serial primary key, uid uuid not null, fish text not null, w numeric not null, t bigint not null,
  name text not null default '', made_at timestamptz not null default now(), unique (uid, t));
alter table public.gyotaku enable row level security;
revoke all on public.gyotaku from anon, authenticated;
create index if not exists gyotaku_uid on public.gyotaku (uid);

create or replace function public._gk_row(g public.gyotaku) returns jsonb language sql stable as $$
  select jsonb_build_object('id', g.id, 'fish', g.fish, 'w', g.w, 't', g.t, 'name', g.name, 'at', g.made_at, 'mine', g.uid = auth.uid()) $$;

-- 家具價格：跟 124 一樣，多了 gk 魚拓
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
    ('vanity',600,0.6,false),('nightstand',200,0.35,false),('mirror',350,0.35,false),('beanbag',250,0.5,false),('cushion',80,0.35,false),('coffee',350,0.6,false),('trophy',500,0.45,false),('rodrack',400,0.5,false),('globe',300,0.3,false),('radio',250,0.3,false),('fan',200,0.3,false),('shoerack',300,0.5,false),('bar',900,0.9,false),('washer',700,0.45,false),('micro',250,0.35,false),('teaset',300,0.4,false),('cactus',100,0.3,false),('bonsai',400,0.35,false),('vase',150,0.3,false),('monstera',350,0.5,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

create or replace function public.gyotaku_make(p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb; n integer; r public.gyotaku;
begin
  select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '魚缸裡沒有這條魚'; end if;
  if exists (select 1 from public.gyotaku where uid = pl.id and t = p_t) then raise exception '這條魚已經做過魚拓了'; end if;
  select count(*) into n from public.gyotaku where uid = pl.id;
  if n >= 40 then raise exception '魚拓最多 40 張，先丟掉一張'; end if;
  if pl.coins < 200 then raise exception '金幣不夠（做一張要 200）'; end if;
  update public.players set coins = coins - 200, updated_at = now() where id = pl.id;
  insert into public.gyotaku (uid, fish, w, t, name) values (pl.id, e->>'f', round((e->>'w')::numeric, 2), p_t, left(coalesce(nullif(pl.nickname, ''), '釣客'), 16)) returning * into r;
  return jsonb_build_object('player', (select to_jsonb(p) from public.players p where p.id = pl.id), 'item', public._gk_row(r));
end $$;

create or replace function public.gyotaku_mine() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._gk_row(g) order by g.id desc), '[]'::jsonb) from public.gyotaku g where g.uid = auth.uid() $$;

-- 到別人家看得到掛著的魚拓
create or replace function public.gyotaku_get(p_ids integer[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._gk_row(g)), '[]'::jsonb) from public.gyotaku g where g.id = any(p_ids[1:60]) $$;

create or replace function public.gyotaku_del(p_id integer) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  delete from public.gyotaku where id = p_id and uid = auth.uid();
  return public.gyotaku_mine();
end $$;

do $$ declare f text; begin
  foreach f in array array['gyotaku_make(bigint)', 'gyotaku_mine()', 'gyotaku_get(integer[])', 'gyotaku_del(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '魚拓設定完成 🖋️' as result;
