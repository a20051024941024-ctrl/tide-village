-- 潮汐釣魚村：家（小島房子的格局、家具、室友／家人）（可以重複執行）
-- 島上每一棟房子可以選格局（套房／一房一廳／兩房一廳／三房一廳），裡面自己擺家具。
-- 島主可以邀請互相加好友的人搬進來一起住（含島主最多 6 人），住戶也可以一起蓋、一起擺家具。
-- 房子資料放在 players.island 的 items 裡：{"id":3,"t":"cabin","x":..,"z":..,"r":..,"lay":"two","f":[{"id":1,"t":"bed","x":-3.4,"z":-2.1,"r":0,"own":"<uuid>"}]}
-- 格局、家具的價格大小要跟 js/game.js 的 LAYOUTS、FURN 一樣。

alter table public.players add column if not exists home_role  text;   -- 自己在家裡的關係：mate 室友／family 家人／couple 情侶
alter table public.players add column if not exists home_title text;   -- 自己選的稱呼（例如：哥哥、媽媽），最多 6 個字

create table if not exists public.home_members (
  owner  uuid not null references public.players(id) on delete cascade,
  member uuid not null references public.players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (owner, member)
);
create unique index if not exists home_members_member_idx on public.home_members (member);   -- 一個人只能住一個家
alter table public.home_members enable row level security;
revoke all on public.home_members from anon, authenticated;

create table if not exists public.home_invites (
  owner  uuid not null references public.players(id) on delete cascade,
  member uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, member)
);
alter table public.home_invites enable row level security;
revoke all on public.home_invites from anon, authenticated;

create or replace function public._home_cap() returns integer language sql immutable as $$ select 6 $$;

-- 格局：價格、大小、隔間牆（線段）、房門（不能被家具擋住）
create or replace function public._home_lay(p text) returns jsonb language sql immutable as $$
  select case p
    when 'open'  then '{"price":0,"W":9,"D":7,"walls":[],"doors":[]}'::jsonb
    when 'one'   then '{"price":1500,"W":11,"D":8,"walls":[[-1.5,-4,-1.5,1.3],[-1.5,2.6,-1.5,4]],"doors":[[-1.5,1.95]]}'::jsonb
    when 'two'   then '{"price":3500,"W":13,"D":9,"walls":[[-2.5,-4.5,-2.5,1.6],[-2.5,2.9,-2.5,4.5],[2.5,-4.5,2.5,1.6],[2.5,2.9,2.5,4.5]],"doors":[[-2.5,2.25],[2.5,2.25]]}'::jsonb
    when 'three' then '{"price":7000,"W":15,"D":10,"walls":[[-3.5,-5,-3.5,2.2],[-3.5,3.5,-3.5,5],[3.5,-5,3.5,2.2],[3.5,3.5,3.5,5],[-3.5,-1,-0.65,-1],[0.65,-1,3.5,-1]],"doors":[[-3.5,2.85],[3.5,2.85],[0,-1]]}'::jsonb
  end $$;

-- 家具：價格、大小（半徑）、flat＝地毯（可以跟別的東西疊）
create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language sql immutable as $$
  select v.price, v.rad, v.flat from (values
    ('bed',600,1.1,false),('dbed',1200,1.4,false),('bunk',1000,1.1,false),('sofa',800,1.2,false),('arm',400,0.6,false),('table',500,0.8,false),('chair',120,0.35,false),
    ('desk',450,0.7,false),('shelf',500,0.7,false),('ward',700,0.8,false),('lamp',200,0.3,false),('plant',150,0.4,false),('bigplant',300,0.5,false),('rug',250,1.2,true),
    ('tv',900,0.9,false),('fridge',800,0.5,false),('stove',700,0.5,false),('sink',500,0.6,false),('bath',1200,1.0,false),('toilet',400,0.4,false),('fire',1500,0.8,false),
    ('tank',1000,0.7,false),('piano',2500,0.9,false),('clock',600,0.3,false)
  ) v(id, price, rad, flat) where v.id = p $$;

-- 沒擺過家具的房子：用原本房間裡的那套（免費）
create or replace function public._home_def() returns jsonb language sql immutable as $$ select
  '[{"id":1,"t":"bed","x":-3.4,"z":-2.1,"r":0},{"id":2,"t":"rug","x":0.5,"z":0.4,"r":0},{"id":3,"t":"table","x":0.5,"z":0.4,"r":0},{"id":4,"t":"chair","x":0.5,"z":-0.6,"r":0},{"id":5,"t":"chair","x":0.5,"z":1.4,"r":3.14},{"id":6,"t":"shelf","x":4.2,"z":-2.1,"r":-1.57},{"id":7,"t":"fire","x":0,"z":-3.2,"r":0},{"id":8,"t":"tank","x":3.3,"z":2.7,"r":3.14},{"id":9,"t":"plant","x":-4,"z":2.9,"r":0}]'::jsonb $$;

-- 點到線段的距離
create or replace function public._segd(px numeric, pz numeric, ax numeric, az numeric, bx numeric, bz numeric) returns numeric language sql immutable as $$
  select sqrt(power(px - (ax + (bx - ax) * t), 2) + power(pz - (az + (bz - az) * t), 2)) from (
    select greatest(0, least(1, case when (bx - ax) ^ 2 + (bz - az) ^ 2 = 0 then 0 else ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / ((bx - ax) ^ 2 + (bz - az) ^ 2) end)) as t) s $$;

-- 家具的位置檢查：要在房間裡、不能卡在隔間牆上、不能擋住門、不能跟別的家具疊在一起（跟 js/game.js 的 furnCheck 一樣）
create or replace function public._furn_check(lay jsonb, f jsonb, p_type text, p_x numeric, p_z numeric, p_skip integer) returns void language plpgsql immutable as $$
declare me record; o record; it record; w jsonb; d jsonb; hw numeric := (lay->>'W')::numeric / 2; hd numeric := (lay->>'D')::numeric / 2;
begin
  select * into me from public._furn(p_type);
  if me.price is null then raise exception '沒有這種家具'; end if;
  if p_x is null or p_z is null or abs(p_x) > hw - 0.25 or abs(p_z) > hd - 0.25 then raise exception '放在房間外面了'; end if;
  if sqrt(p_x ^ 2 + (p_z - (hd - 0.6)) ^ 2) < me.rad * 0.7 + 0.8 and not me.flat then raise exception '會擋住大門'; end if;
  for w in select * from jsonb_array_elements(lay->'walls') loop
    if public._segd(p_x, p_z, (w->>0)::numeric, (w->>1)::numeric, (w->>2)::numeric, (w->>3)::numeric) < me.rad * 0.7 then raise exception '卡在牆上了'; end if;
  end loop;
  if not me.flat then for d in select * from jsonb_array_elements(lay->'doors') loop
    if sqrt((p_x - (d->>0)::numeric) ^ 2 + (p_z - (d->>1)::numeric) ^ 2) < me.rad * 0.7 + 0.7 then raise exception '會擋住房門'; end if;
  end loop; end if;
  for o in select * from jsonb_to_recordset(f) as x(id integer, t text, x numeric, z numeric) loop
    if o.id = p_skip then continue; end if;
    select * into it from public._furn(o.t);
    if it.price is null or it.flat or me.flat then continue; end if;
    if sqrt((o.x - p_x) ^ 2 + (o.z - p_z) ^ 2) < (it.rad + me.rad) * 0.75 then raise exception '跟別的家具疊在一起了'; end if;
  end loop;
end $$;

-- 我住在誰家（自己就是島主的話回傳自己）
create or replace function public._home_of(p_uid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner from public.home_members where member = p_uid), p_uid) $$;
-- 能不能動這座島（島主或住戶）
create or replace function public._home_can(p_owner uuid, p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = p_uid or exists (select 1 from public.home_members where owner = p_owner and member = p_uid) $$;

-- 一起蓋家：島上的東西、房子的格局、家具，都用這個（島主和住戶都可以；錢從動手的人身上扣、退）
-- p_op：place {t,x,z,r}、move {id,x,z,r}、remove {id}、layout {house,lay}、fplace {house,t,x,z,r}、fmove {house,id,x,z,r}、fremove {house,id}、bed {house,id}
create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow public.players; isl jsonb; items jsonb; info record; fi record; nid integer; h jsonb; f jsonb; lay jsonb; nl jsonb;
  cost integer := 0; back integer := 0; hid integer; fid integer; t text; o jsonb; keep jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  if not public._home_can(p_owner, pl.id) then raise exception '這不是你的家'; end if;
  select * into ow from public.players where id = p_owner for update;
  if not found then raise exception '找不到這座島'; end if;
  isl := public._isle_upgrade(ow.island); items := public._isle_items(isl);
  if p_op = 'place' then
    t := p->>'t'; select * into info from public._isle_item(t);
    if info.price is null then raise exception '沒有這種東西'; end if;
    if jsonb_array_length(items) >= 60 then raise exception '島上已經放滿了'; end if;
    if info.house and (select count(*) from jsonb_array_elements(items) e where (public._isle_item(e->>'t')).house) >= 6 then raise exception '房子最多 6 棟'; end if;
    perform public._isle_check(items, t, (p->>'x')::numeric, (p->>'z')::numeric, -1);
    cost := info.price;
    select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(items) e;
    items := items || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)));
  elsif p_op = 'move' then
    select e into o from jsonb_array_elements(items) e where (e->>'id')::int = (p->>'id')::int;
    if o is null then raise exception '找不到這個東西'; end if;
    perform public._isle_check(items, o->>'t', (p->>'x')::numeric, (p->>'z')::numeric, (p->>'id')::int);
    items := (select jsonb_agg(case when (e->>'id')::int = (p->>'id')::int then e || jsonb_build_object('x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)) else e end) from jsonb_array_elements(items) e);
  elsif p_op = 'remove' then
    select e into o from jsonb_array_elements(items) e where (e->>'id')::int = (p->>'id')::int;
    if o is null then raise exception '找不到這個東西'; end if;
    back := (public._isle_item(o->>'t')).price / 2;
    if o ? 'f' then select coalesce(sum((public._furn(x->>'t')).price / 2), 0) + back into back from jsonb_array_elements(o->'f') x; end if;   -- 拆房子連家具一起退一半
    if o ? 'lay' then back := back + coalesce((public._home_lay(o->>'lay')->>'price')::int, 0) / 2; end if;
    items := coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where (e->>'id')::int <> (p->>'id')::int), '[]'::jsonb);
  elsif p_op in ('layout', 'fplace', 'fmove', 'fremove', 'bed') then
    hid := (p->>'house')::int;
    select e into h from jsonb_array_elements(items) e where (e->>'id')::int = hid;
    if h is null or not (public._isle_item(h->>'t')).house then raise exception '找不到這棟房子'; end if;
    f := coalesce(h->'f', public._home_def()); lay := public._home_lay(coalesce(h->>'lay', 'open'));
    if p_op = 'layout' then
      nl := public._home_lay(p->>'lay'); if nl is null then raise exception '沒有這種格局'; end if;
      if coalesce(h->>'lay', 'open') = p->>'lay' then return jsonb_build_object('island', isl, 'coins', pl.coins); end if;
      cost := greatest(0, (nl->>'price')::int - (lay->>'price')::int); back := greatest(0, ((lay->>'price')::int - (nl->>'price')::int) / 2);
      -- 換格局：放不下的家具收起來，全額退錢
      keep := '[]'::jsonb;
      for o in select * from jsonb_array_elements(f) loop
        begin perform public._furn_check(nl, keep, o->>'t', (o->>'x')::numeric, (o->>'z')::numeric, -1); keep := keep || jsonb_build_array(o);
        exception when others then back := back + coalesce((public._furn(o->>'t')).price, 0); end;
      end loop;
      h := h || jsonb_build_object('lay', p->>'lay', 'f', keep);
    elsif p_op = 'fplace' then
      t := p->>'t'; select * into fi from public._furn(t);
      if fi.price is null then raise exception '沒有這種家具'; end if;
      if jsonb_array_length(f) >= 40 then raise exception '這棟房子已經擺滿了'; end if;
      perform public._furn_check(lay, f, t, (p->>'x')::numeric, (p->>'z')::numeric, -1);
      cost := fi.price;
      select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(f) e;
      h := h || jsonb_build_object('f', f || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2))));
    elsif p_op = 'fmove' then
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null then raise exception '找不到這個家具'; end if;
      perform public._furn_check(lay, f, o->>'t', (p->>'x')::numeric, (p->>'z')::numeric, fid);
      h := h || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e || jsonb_build_object('x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)) else e end) from jsonb_array_elements(f) e));
    elsif p_op = 'fremove' then
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null then raise exception '找不到這個家具'; end if;
      back := coalesce((public._furn(o->>'t')).price, 0) / 2;
      h := h || jsonb_build_object('f', coalesce((select jsonb_agg(e) from jsonb_array_elements(f) e where (e->>'id')::int <> fid), '[]'::jsonb));
    else   -- bed：認領／放掉一張床（同一個人在整座島上只能有一張）
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null or o->>'t' not in ('bed', 'dbed', 'bunk') then raise exception '這不是床'; end if;
      if o->>'own' is not null and o->>'own' <> pl.id::text then raise exception '這張床已經有人了'; end if;
      if o->>'own' = pl.id::text then
        h := h || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e - 'own' else e end) from jsonb_array_elements(f) e));
      else
        -- 先把我在其他床的認領拿掉
        items := (select jsonb_agg(case when e ? 'f' then e || jsonb_build_object('f', (select coalesce(jsonb_agg(case when x->>'own' = pl.id::text then x - 'own' else x end), '[]'::jsonb) from jsonb_array_elements(e->'f') x)) else e end) from jsonb_array_elements(items) e);
        select coalesce(e->'f', public._home_def()) into f from jsonb_array_elements(items) e where (e->>'id')::int = hid;
        h := (select e from jsonb_array_elements(items) e where (e->>'id')::int = hid) || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e || jsonb_build_object('own', pl.id::text) else e end) from jsonb_array_elements(f) e));
      end if;
    end if;
    items := (select jsonb_agg(case when (e->>'id')::int = hid then h else e end) from jsonb_array_elements(items) e);
  else raise exception '不知道要做什麼';
  end if;
  if pl.coins + back < cost then raise exception '金幣不夠'; end if;
  isl := jsonb_build_object('v', 2, 'items', items);
  update public.players set island = isl, updated_at = now() where id = p_owner;
  update public.players set coins = coins - cost + back, updated_at = now() where id = pl.id returning coins into pl.coins;
  return jsonb_build_object('island', isl, 'coins', pl.coins);
end $$;

-- 移動島上的東西時保留房子裡的格局和家具（取代 012 的版本）
create or replace function public.move_item(p_id integer, p_x numeric, p_z numeric, p_r numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); isl jsonb := public._isle_upgrade(pl.island); items jsonb := public._isle_items(isl); t text;
begin
  select e->>'t' into t from jsonb_array_elements(items) e where (e->>'id')::int = p_id;
  if t is null then raise exception '找不到這個東西'; end if;
  perform public._isle_check(items, t, p_x, p_z, p_id);
  items := (select jsonb_agg(case when (e->>'id')::int = p_id then e || jsonb_build_object('x', round(p_x, 2), 'z', round(p_z, 2), 'r', round(coalesce(p_r, 0), 2)) else e end) from jsonb_array_elements(items) e);
  update public.players set island = jsonb_build_object('v', 2, 'items', items), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 家的資料：我住在誰家、有哪些人、別人寄給我的邀請
create or replace function public.get_home() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id);
begin
  return jsonb_build_object(
    'owner', ow, 'cap', public._home_cap(),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'role', p.home_role, 'title', p.home_title, 'owner', p.id = ow) order by p.id <> ow, m.joined_at), '[]'::jsonb)
               from public.players p left join public.home_members m on m.member = p.id and m.owner = ow
               where p.id = ow or m.member is not null),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('owner', i.owner, 'name', p.nickname, 'at', (extract(epoch from i.created_at) * 1000)::bigint) order by i.created_at desc), '[]'::jsonb)
                from public.home_invites i join public.players p on p.id = i.owner where i.member = pl.id),
    'sent', (select coalesce(jsonb_agg(i.member), '[]'::jsonb) from public.home_invites i where i.owner = pl.id));
end $$;

-- 邀請好友搬進來（要互相加好友；自己要是島主、不能住在別人家）
create or replace function public.invite_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if exists (select 1 from public.home_members where member = pl.id) then raise exception '你現在住在別人家，要先搬出來才能邀請'; end if;
  if p_member = pl.id then raise exception '不能邀請自己'; end if;
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_member) and exists (select 1 from public.friends where owner = p_member and friend = pl.id)) then raise exception '要互相加好友才能邀請'; end if;
  if (select count(*) from public.home_members where owner = pl.id) + 1 >= public._home_cap() then raise exception '家裡已經住滿了（最多 6 人）'; end if;
  if exists (select 1 from public.home_members where member = p_member) then raise exception '對方已經住在別人家了'; end if;
  if (select count(*) from public.home_invites where owner = pl.id) >= 10 then raise exception '邀請太多了，等對方回覆吧'; end if;
  insert into public.home_invites (owner, member) values (pl.id, p_member) on conflict do nothing;
  return public.get_home();
end $$;

-- 回覆邀請：答應就搬進去（自己家裡如果有室友就不能搬）
create or replace function public.answer_home(p_owner uuid, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  delete from public.home_invites where owner = p_owner and member = pl.id;
  if not found then raise exception '這個邀請已經沒有了'; end if;
  if p_ok then
    if exists (select 1 from public.home_members where owner = pl.id) then raise exception '你家裡還有室友，要先請他們搬走才能搬去別人家'; end if;
    if (select count(*) from public.home_members where owner = p_owner) + 1 >= public._home_cap() then raise exception '對方家裡已經住滿了'; end if;
    delete from public.home_members where member = pl.id;
    insert into public.home_members (owner, member) values (p_owner, pl.id);
    delete from public.home_invites where member = pl.id;
  end if;
  return public.get_home();
end $$;

-- 把我認領的床放掉（搬走、被請走時用）
create or replace function public._home_unbed(p_owner uuid, p_uid uuid) returns void language plpgsql security definer set search_path = public as $$
declare isl jsonb; items jsonb;
begin
  select public._isle_upgrade(island) into isl from public.players where id = p_owner; items := public._isle_items(isl);
  items := coalesce((select jsonb_agg(case when e ? 'f' then e || jsonb_build_object('f', (select coalesce(jsonb_agg(case when x->>'own' = p_uid::text then x - 'own' else x end), '[]'::jsonb) from jsonb_array_elements(e->'f') x)) else e end) from jsonb_array_elements(items) e), '[]'::jsonb);
  update public.players set island = jsonb_build_object('v', 2, 'items', items) where id = p_owner;
end $$;

-- 搬出去
create or replace function public.leave_home() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid;
begin
  delete from public.home_members where member = pl.id returning owner into ow;
  if ow is not null then perform public._home_unbed(ow, pl.id); end if;
  return public.get_home();
end $$;

-- 島主請人搬走，或收回邀請
create or replace function public.kick_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  delete from public.home_invites where owner = pl.id and member = p_member;
  delete from public.home_members where owner = pl.id and member = p_member;
  if found then perform public._home_unbed(pl.id, p_member); end if;
  return public.get_home();
end $$;

-- 自己在家裡的關係和稱呼
create or replace function public.set_home_title(p_role text, p_title text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text := nullif(btrim(left(coalesce(p_title, ''), 6)), '');
begin
  if p_role is not null and p_role not in ('mate', 'family', 'couple') then raise exception '沒有這種關係'; end if;
  update public.players set home_role = p_role, home_title = t, updated_at = now() where id = pl.id;
  return public.get_home();
end $$;

revoke all on function public._home_of(uuid) from public, anon, authenticated;
revoke all on function public._home_can(uuid, uuid) from public, anon, authenticated;
revoke all on function public._home_unbed(uuid, uuid) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['home_edit(uuid,text,jsonb)', 'get_home()', 'invite_home(uuid)', 'answer_home(uuid,boolean)', 'leave_home()', 'kick_home(uuid)', 'set_home_title(text,text)', 'move_item(integer,numeric,numeric,numeric)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '家（格局、家具、室友）設定完成 🏠' as result;
