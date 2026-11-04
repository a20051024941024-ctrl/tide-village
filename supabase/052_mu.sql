-- 潮汐釣魚村：阿木木工坊（可以重複執行）
-- 阿木是村子裡的家具木匠 NPC，每天台灣時間 9:03、17:03 會自己做一件新家具放到店裡。
-- 每件是「同一種家具（base）＋自己的木頭顏色、布料顏色、花樣」；家具的 id 是 'fz<編號>'，擺進房子跟一般家具一樣走 home_edit。
-- 大小照 base、價格照這件作品；做過的作品都會一直留在店裡（使用者 2026-11-04：阿綾的也不下架）。

create or replace function public._mu_id() returns uuid language sql immutable as $$ select 'a11e0000-0000-4000-8000-0000000000b0'::uuid $$;

create table if not exists public.furn_designs (
  id         serial primary key,
  base       text not null,
  name       text not null,
  main       text not null,
  accent     text not null,
  pat        text not null,
  story      text not null default '',
  price      integer not null default 0 check (price between 0 and 5000),
  listed     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.furn_designs enable row level security;
revoke all on public.furn_designs from anon, authenticated;

-- 家具的大小和價格：一般家具照原本的表；'fz<編號>' 照它的 base 的大小、自己的價格（下架的不能再擺，已經擺的照常）
create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
  if p ~ '^fz[0-9]{1,9}$' then
    select * into d from public.furn_designs where id = substr(p, 3)::integer;
    if d.id is null then return; end if;
    select b.rad, b.flat into rad, flat from public._furn(d.base) b;
    price := case when d.listed then d.price end;
    return;
  end if;
  select v.price, v.rad, v.flat into price, rad, flat from (values
    ('bed',600,1.1,false),('dbed',1200,1.4,false),('bunk',1000,1.1,false),('sofa',800,1.2,false),('arm',400,0.6,false),('table',500,0.8,false),('chair',120,0.35,false),
    ('desk',450,0.7,false),('shelf',500,0.7,false),('ward',700,0.8,false),('lamp',200,0.3,false),('plant',150,0.4,false),('bigplant',300,0.5,false),('rug',250,1.2,true),
    ('tv',900,0.9,false),('fridge',800,0.5,false),('stove',700,0.5,false),('sink',500,0.6,false),('bath',1200,1.0,false),('toilet',400,0.4,false),('fire',1500,0.8,false),
    ('tank',1000,0.7,false),('piano',2500,0.9,false),('clock',600,0.3,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

create or replace function public._fz_row(d public.furn_designs) returns jsonb language sql stable as $$
  select jsonb_build_object('id', d.id, 'base', d.base, 'name', d.name, 'main', d.main, 'accent', d.accent, 'pat', d.pat, 'story', d.story, 'price', d.price, 'listed', d.listed, 'at', d.created_at) $$;

-- 做一件新家具
create or replace function public._mu_make() returns integer language plpgsql security definer set search_path = public as $$
declare
  bases text[] := array['table','chair','chair','desk','shelf','ward','sofa','arm','arm','rug','rug','lamp','clock','bed','dbed'];
  bnames jsonb := '{"table":["餐桌","張"],"chair":["椅子","張"],"desk":["書桌","張"],"shelf":["書櫃","座"],"ward":["衣櫃","座"],"sofa":["沙發","張"],"arm":["單人沙發","張"],"rug":["地毯","塊"],"lamp":["立燈","盞"],"clock":["落地鐘","座"],"bed":["單人床","張"],"dbed":["雙人床","張"]}';
  woods text[] := array['漂流木','柚木','胡桃木','白橡木','檜木','黑檀木','竹子'];
  wcols text[] := array['#b8a890','#9a6a40','#5e4030','#d8c4a0','#c89a60','#3a2e28','#c8b878'];
  cnames text[] := array['海洋藍','晚霞橘','珊瑚粉','森林綠','檸檬黃','薰衣草','米白','海軍藍','番茄紅'];
  ccols text[] := array['#2f89c7','#ff9f43','#f5a5d8','#5d9c55','#ffd36a','#9b7bff','#f1e3c8','#18334a','#e8473a'];
  pats text[] := array['plain','stripe','check','wave','dots','grain'];
  pnames text[] := array['素面','條紋','格子','海浪','點點','木紋'];
  pdesc text[] := array['素素的布面','一條一條的條紋布','格子布','海浪花紋','小圓點','特別留下來的木紋'];
  b text := bases[1 + floor(random() * array_length(bases, 1))::int];
  wi int := 1 + floor(random() * 7)::int; ci int := 1 + floor(random() * 9)::int; pi int := 1 + floor(random() * 6)::int;
  nm text; st text; price int; nid int;
begin
  nm := left(woods[wi] || pnames[pi] || (bnames->b->>0), 16);
  st := '這' || (bnames->b->>1) || (bnames->b->>0) || '是用' || woods[wi] || '做的，配了' || cnames[ci] || '的' || pdesc[pi];
  price := (array[0, 150, 200, 300, 400, 500, 600])[1 + floor(random() * 7)::int];
  insert into public.furn_designs (base, name, main, accent, pat, story, price)
    values (b, nm, wcols[wi], ccols[ci], pats[pi], st, price) returning id into nid;
  return nid;
end $$;
revoke all on function public._mu_make() from public, anon, authenticated;

-- 逛阿木的店（最新的在前面）、看房子裡擺著的阿木家具
create or replace function public.list_furn(p_offset integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fz_row(d) order by d.id desc), '[]'::jsonb) from (select * from public.furn_designs where listed order by id desc limit 200 offset greatest(0, coalesce(p_offset, 0))) d $$;
create or replace function public.get_furn(p_ids integer[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fz_row(d)), '[]'::jsonb) from public.furn_designs d where d.id = any(p_ids[1:60]) $$;
do $$ declare f text; begin
  foreach f in array array['list_furn(integer)', 'get_furn(integer[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 開店先擺 6 件
do $$ begin
  while (select count(*) from public.furn_designs) < 6 loop perform public._mu_make(); end loop;
end $$;

-- 每天台灣時間 9:03、17:03（UTC 1:03、9:03）各做一件
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice '沒辦法開 pg_cron：%', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-mu-furn', '3 1,9 * * *', 'select public._mu_make()');
  end if;
end $$;

select '阿木木工坊開張了 🪑' as result;
