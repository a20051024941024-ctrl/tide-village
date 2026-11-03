-- 潮汐釣魚村：玩家島 2.0（更大的島、自由擺放、更多家具、按讚；可以重複執行）
-- 島的資料改成 {"v":2,"items":[{"id":1,"t":"cabin","x":-6.5,"z":-4.5,"r":0.8}, ...]}，座標以島中心為原點
alter table public.players add column if not exists likes integer not null default 0;

create table if not exists public.island_likes (
  owner uuid not null references public.players(id) on delete cascade,
  liker uuid not null references public.players(id) on delete cascade,
  day   date not null,
  primary key (owner, liker, day)
);
alter table public.island_likes enable row level security;
revoke all on public.island_likes from anon, authenticated;

-- 價格和大小（半徑，用來檢查有沒有疊在一起）；要跟 js/game.js 的 ISLE_ITEMS 一樣
create or replace function public._isle_item(p text, out price integer, out rad numeric, out house boolean) language sql immutable as $$
  select v.price, v.rad, v.house from (values
    ('cabin',1500,2.6,true),('beach',3000,2.9,true),('villa',8000,3.6,true),('tea',5500,3.0,true),
    ('flower',200,0.9,false),('bench',150,0.9,false),('lamp',250,0.35,false),('palm',400,0.6,false),('pond',1200,1.5,false),('flag',300,0.3,false),
    ('fence',80,0.9,false),('tree',300,1.1,false),('rock',100,0.7,false),('mailbox',200,0.35,false),('picnic',600,1.4,false),('parasol',350,1.0,false),
    ('campfire',450,0.8,false),('statue',2000,0.9,false),('swing',900,1.3,false),('bush',120,0.7,false),('lantern',180,0.4,false),('boat',1500,1.6,false)
  ) v(id, price, rad, house) where v.id = p $$;

create or replace function public._isle_items(isl jsonb) returns jsonb language sql immutable as $$
  select case when isl ? 'items' and jsonb_typeof(isl->'items') = 'array' then isl->'items' else '[]'::jsonb end $$;

-- 把舊版（固定格子）的島轉成新版
create or replace function public._isle_upgrade(isl jsonb) returns jsonb language plpgsql immutable as $$
declare items jsonb := '[]'::jsonb; k text; v text; n integer := 0;
  hs numeric[][] := array[[-6.5,-4.5],[6.5,-4.5],[0,-9]];
  ds numeric[][] := array[[-3,3],[3,3],[-8,2],[8,2],[-5,9],[5,9],[-10.5,-2],[10.5,-2],[0,4.5],[-2,10.5]];
begin
  if isl is null then return '{"v":2,"items":[]}'::jsonb; end if;
  if (isl->>'v') = '2' then return isl; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(isl->'h', '{}'::jsonb)) loop
    if k::int between 0 and 2 then n := n + 1; items := items || jsonb_build_array(jsonb_build_object('id', n, 't', v, 'x', hs[k::int + 1][1], 'z', hs[k::int + 1][2], 'r', round(atan2(-hs[k::int + 1][1], -hs[k::int + 1][2])::numeric, 2))); end if;
  end loop;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(isl->'d', '{}'::jsonb)) loop
    if k::int between 0 and 9 then n := n + 1; items := items || jsonb_build_array(jsonb_build_object('id', n, 't', v, 'x', ds[k::int + 1][1], 'z', ds[k::int + 1][2], 'r', round((atan2(-ds[k::int + 1][1], -ds[k::int + 1][2]) + pi())::numeric, 2))); end if;
  end loop;
  return jsonb_build_object('v', 2, 'items', items);
end $$;
update public.players set island = public._isle_upgrade(island) where coalesce(island->>'v', '') <> '2';
alter table public.players alter column island set default '{"v":2,"items":[]}'::jsonb;

-- 檢查位置：要在島上（房子要離岸邊遠一點），不能跟別的東西疊在一起，也不能擋住碼頭的路
create or replace function public._isle_check(items jsonb, p_type text, p_x numeric, p_z numeric, p_skip integer) returns void language plpgsql immutable as $$
declare me record; o record; it record;
begin
  select * into me from public._isle_item(p_type);
  if me.price is null then raise exception '沒有這種東西'; end if;
  if p_x is null or p_z is null or sqrt(p_x * p_x + p_z * p_z) > 24 - me.rad * 0.6 - 0.6 then raise exception '放在島外面了'; end if;
  if abs(p_x) < 1.4 + me.rad * 0.7 and p_z > 17 then raise exception '會擋住碼頭的路'; end if;
  for o in select * from jsonb_to_recordset(items) as x(id integer, t text, x numeric, z numeric, r numeric) loop
    if o.id = p_skip then continue; end if;
    select * into it from public._isle_item(o.t);
    if it.price is not null and sqrt((o.x - p_x) ^ 2 + (o.z - p_z) ^ 2) < (it.rad + me.rad) * 0.8 then raise exception '跟別的東西疊在一起了'; end if;
  end loop;
end $$;

create or replace function public.place_item(p_type text, p_x numeric, p_z numeric, p_r numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); isl jsonb := public._isle_upgrade(pl.island); items jsonb := public._isle_items(isl); info record; nid integer;
begin
  select * into info from public._isle_item(p_type);
  if info.price is null then raise exception '沒有這種東西'; end if;
  if jsonb_array_length(items) >= 60 then raise exception '島上已經放滿了'; end if;
  if info.house and (select count(*) from jsonb_array_elements(items) e where (public._isle_item(e->>'t')).house) >= 6 then raise exception '房子最多 6 棟'; end if;
  perform public._isle_check(items, p_type, p_x, p_z, -1);
  if pl.coins < info.price then raise exception '金幣不夠'; end if;
  select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(items) e;
  items := items || jsonb_build_array(jsonb_build_object('id', nid, 't', p_type, 'x', round(p_x, 2), 'z', round(p_z, 2), 'r', round(coalesce(p_r, 0), 2)));
  update public.players set coins = coins - info.price, island = jsonb_build_object('v', 2, 'items', items), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.move_item(p_id integer, p_x numeric, p_z numeric, p_r numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); isl jsonb := public._isle_upgrade(pl.island); items jsonb := public._isle_items(isl); t text;
begin
  select e->>'t' into t from jsonb_array_elements(items) e where (e->>'id')::int = p_id;
  if t is null then raise exception '找不到這個東西'; end if;
  perform public._isle_check(items, t, p_x, p_z, p_id);
  items := (select jsonb_agg(case when (e->>'id')::int = p_id then jsonb_build_object('id', p_id, 't', t, 'x', round(p_x, 2), 'z', round(p_z, 2), 'r', round(coalesce(p_r, 0), 2)) else e end) from jsonb_array_elements(items) e);
  update public.players set island = jsonb_build_object('v', 2, 'items', items), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.remove_item(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); isl jsonb := public._isle_upgrade(pl.island); items jsonb := public._isle_items(isl); t text;
begin
  select e->>'t' into t from jsonb_array_elements(items) e where (e->>'id')::int = p_id;
  if t is null then raise exception '找不到這個東西'; end if;
  items := coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where (e->>'id')::int <> p_id), '[]'::jsonb);
  update public.players set coins = coins + (public._isle_item(t)).price / 2, island = jsonb_build_object('v', 2, 'items', items), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 幫別人的島按讚（每天每座島一次）
create or replace function public.like_island(p_owner uuid) returns integer language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; n integer;
begin
  if p_owner = pl.id then raise exception '不能幫自己按讚'; end if;
  insert into public.island_likes (owner, liker, day) values (p_owner, pl.id, d) on conflict do nothing;
  if found then update public.players set likes = likes + 1 where id = p_owner; end if;
  select likes into n from public.players where id = p_owner; return coalesce(n, 0);
end $$;

-- 舊版的格子函式不能再用（舊畫面的人會被提醒重新整理）
create or replace function public.buy_build(p_kind text, p_slot integer, p_type text) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '請重新整理遊戲（小島改版了）'; end $$;
create or replace function public.remove_build(p_kind text, p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '請重新整理遊戲（小島改版了）'; end $$;

do $$ declare f text; begin
  foreach f in array array['place_item(text,numeric,numeric,numeric)', 'move_item(integer,numeric,numeric,numeric)', 'remove_item(integer)', 'like_island(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '玩家島 2.0 設定完成 🏝️' as result;
