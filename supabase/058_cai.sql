-- 潮汐釣魚村：阿彩畫廊（可以重複執行）
-- 阿彩是村子裡的畫家。每天早上 8 點（台灣時間）畫一幅魚的畫：畫的是昨天全村最厲害的那一條（報紙上的頭條），沒有的話就畫她喜歡的魚。
-- 畫是一種家具（'fz<編號>'，base = 'paint'，跟阿木的家具一樣走 home_edit 擺進房子），掛在畫廊裡賣；被畫的那位玩家會收到一幅免費的。
-- 作品都不下架。

alter table public.furn_designs add column if not exists maker text not null default 'mu';
alter table public.furn_designs add column if not exists fish text;
alter table public.furn_designs add column if not exists about uuid;
alter table public.furn_designs add column if not exists about_name text;
alter table public.furn_designs add column if not exists owner uuid;    -- 不是空的＝只有這個人能擺（免費送的那一幅）

-- 家具的大小和價格：多了「畫」；送給某個人的那一幅只有他自己能擺
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
    ('tank',1000,0.7,false),('piano',2500,0.9,false),('clock',600,0.3,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

create or replace function public._fz_row(d public.furn_designs) returns jsonb language sql stable as $$
  select jsonb_build_object('id', d.id, 'base', d.base, 'name', d.name, 'main', d.main, 'accent', d.accent, 'pat', d.pat, 'story', d.story, 'price', d.price, 'listed', d.listed, 'at', d.created_at,
    'maker', d.maker, 'fish', d.fish, 'aboutName', d.about_name, 'mine', d.owner is not null and d.owner = auth.uid(), 'gift', d.owner is not null) $$;

-- 阿木的店只放阿木做的
create or replace function public.list_furn(p_offset integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fz_row(d) order by d.id desc), '[]'::jsonb) from (select * from public.furn_designs where listed and maker = 'mu' order by id desc limit 200 offset greatest(0, coalesce(p_offset, 0))) d $$;

-- 阿彩的畫廊：掛著賣的畫（最新的在前面）＋送給我的畫
create or replace function public.list_paint() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._fz_row(d) order by d.id desc), '[]'::jsonb) from (
    select * from public.furn_designs where maker = 'cai' and listed and (owner is null or owner = auth.uid()) order by id desc limit 120) d $$;
do $$ declare f text; begin
  foreach f in array array['list_furn(integer)', 'list_paint()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create table if not exists public.cai_days (day date primary key, paint_id integer not null, gift_id integer);
alter table public.cai_days enable row level security;
revoke all on public.cai_days from anon, authenticated;

-- 畫今天的畫
create or replace function public._cai_make(p_day date) returns integer language plpgsql security definer set search_path = public as $$
declare c public.cai_days; r record; sp public.fish_species; styles text[] := array['dawn', 'sea', 'sunset', 'night', 'reef', 'mist'];
  snames jsonb := '{"dawn":"清晨","sea":"大海","sunset":"晚霞","night":"月夜","reef":"珊瑚礁","mist":"霧"}';
  bgs text[] := array['#f6d8b8', '#4f9fd0', '#f19a6b', '#1f3358', '#3fbfb0', '#c8d4d8'];
  frames text[] := array['#c8a060', '#8c5d3b', '#2b2f36', '#e8d8b0', '#b8862b'];
  h bigint := abs(hashtext('cai' || p_day::text)); si int := 1 + (h % 6)::int; st text; nm text; pid int; gid int; price int;
begin
  select * into c from public.cai_days where day = p_day; if c.day is not null then return c.paint_id; end if;
  -- 昨天全村最厲害的一條（跟報紙的頭條一樣的排法）
  select n.*, s.name fname into r from public.news_catch n join public.fish_species s on s.id = n.fish where n.day = p_day - 1
    order by case n.rarity when '傳說' then 0 when '史詩' then 1 when '稀有' then 2 else 3 end, n.w desc limit 1;
  price := (array[300, 400, 500, 600, 800])[1 + ((h / 6) % 5)::int];
  if r.id is not null then
    nm := left(snames->>styles[si] || '裡的' || r.fname, 16);
    st := '畫的是 ' || r.nick || ' 昨天釣到的' || r.fname || '（' || round(r.w, 2) || 'kg），' || (snames->>styles[si]) || '的顏色';
    insert into public.furn_designs (base, name, main, accent, pat, story, price, maker, fish, about, about_name)
      values ('paint', nm, bgs[si], frames[1 + ((h / 30) % 5)::int], styles[si], st, price, 'cai', r.fish, r.uid, r.nick) returning id into pid;
    -- 送一幅給被畫的人（只有他能擺、免費）
    insert into public.furn_designs (base, name, main, accent, pat, story, price, maker, fish, about, about_name, owner)
      values ('paint', nm, bgs[si], frames[1 + ((h / 30) % 5)::int], styles[si], st || '。這幅是阿彩送給你的', 0, 'cai', r.fish, r.uid, r.nick, r.uid) returning id into gid;
    perform public._push(r.uid, 'cai', '🎨 阿彩畫了你的魚！', '她把你昨天釣到的' || r.fname || '畫成了一幅畫，送你一幅，去畫廊看看');
  else
    select * into sp from public.fish_species where rarity = '常見' order by hashtext(id || p_day::text) limit 1;
    nm := left(snames->>styles[si] || '裡的' || coalesce(sp.name, '小魚'), 16);
    st := '阿彩畫了她喜歡的' || coalesce(sp.name, '小魚') || '，' || (snames->>styles[si]) || '的顏色';
    insert into public.furn_designs (base, name, main, accent, pat, story, price, maker, fish)
      values ('paint', nm, bgs[si], frames[1 + ((h / 30) % 5)::int], styles[si], st, price, 'cai', sp.id) returning id into pid;
  end if;
  insert into public.cai_days (day, paint_id, gift_id) values (p_day, pid, gid) on conflict do nothing;
  return pid;
end $$;
revoke all on function public._cai_make(date) from public, anon, authenticated;

-- 今天的畫（8 點以前是昨天的；還沒畫就先畫）
create or replace function public.cai_today() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := public._tw_day(now() - interval '8 hours'); c public.cai_days;
begin
  perform public._cai_make(d);
  select * into c from public.cai_days where day = d;
  return jsonb_build_object('day', d, 'paint', (select public._fz_row(f) from public.furn_designs f where f.id = c.paint_id),
    'gift', (select public._fz_row(f) from public.furn_designs f where f.id = c.gift_id and f.owner = auth.uid()));
end $$;
revoke all on function public.cai_today() from public, anon;
grant execute on function public.cai_today() to authenticated;

-- 開幕先畫一幅；每天台灣時間 8:00（UTC 0:00）畫一幅
do $$ begin
  perform public._cai_make(public._tw_day(now() - interval '8 hours'));
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-cai-paint', '0 0 * * *', 'select public._cai_make(public._tw_day(now()))');
  end if;
end $$;

select '阿彩畫廊開幕了 🎨' as result;
