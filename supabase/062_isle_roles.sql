-- 潮汐釣魚村：共同島嶼的權限和公共儲物箱（架構第五階段；可以重複執行）
-- 一座島（島主的 uid 就是 Island ID）的成員權限：
--   owner 創建者：全部都可以，設定每個人的權限
--   co    共同島主：蓋、拆、邀請、請人搬走（管理成員和一般成員）、設定管理成員／一般成員、拿公共儲物箱的東西
--   admin 管理成員：蓋、拆、邀請、請一般成員搬走、拿公共儲物箱的東西
--   member 一般成員：一起蓋、擺家具、把魚放進公共儲物箱，只能拿回自己放的
--   訪客：只能參觀（原本的「逛別人的島」）
-- 公共儲物箱跟自己的魚缸分開：放進去的魚是大家的，誰放、誰拿都有紀錄；拿的時候鎖住那一筆，不會兩個人拿到同一條。

alter table public.home_members add column if not exists perm text not null default 'member';
do $$ begin
  begin alter table public.home_members add constraint home_members_perm_chk check (perm in ('co', 'admin', 'member')); exception when duplicate_object then null; end;
end $$;

create or replace function public._isle_perm(p_owner uuid, p_uid uuid) returns text language sql stable security definer set search_path = public as $$
  select case when p_owner = p_uid then 'owner' else (select perm from public.home_members where owner = p_owner and member = p_uid) end $$;
create or replace function public._perm_rank(p text) returns integer language sql immutable as $$
  select case p when 'owner' then 4 when 'co' then 3 when 'admin' then 2 when 'member' then 1 else 0 end $$;

-- 邀請：島主、共同島主、管理成員都可以（邀請的人要跟「邀請的人」互相是好友）
create or replace function public.invite_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id);
begin
  if public._perm_rank(public._isle_perm(ow, pl.id)) < 2 then raise exception '只有島主、共同島主、管理成員可以邀請'; end if;
  if p_member = pl.id or p_member = ow then raise exception '不能邀請自己'; end if;
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_member) and exists (select 1 from public.friends where owner = p_member and friend = pl.id)) then raise exception '要互相加好友才能邀請'; end if;
  perform 1 from public.players where id = ow for update;   -- 同一座島同時只處理一個邀請，不會超過人數
  if (select count(*) from public.home_members where owner = ow) + 1 >= public._home_cap() then raise exception '島上已經住滿了（最多 6 人）'; end if;
  if exists (select 1 from public.home_members where member = p_member) then raise exception '對方已經住在別人家了'; end if;
  if (select count(*) from public.home_invites where owner = ow) >= 10 then raise exception '邀請太多了，等對方回覆吧'; end if;
  insert into public.home_invites (owner, member) values (ow, p_member) on conflict do nothing;
  return public.get_home();
end $$;

-- 請人搬走：權限要比對方高
create or replace function public.kick_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); mine int; theirs int;
begin
  mine := public._perm_rank(public._isle_perm(ow, pl.id)); theirs := public._perm_rank(public._isle_perm(ow, p_member));
  if exists (select 1 from public.home_invites where owner = ow and member = p_member) and mine >= 2 then delete from public.home_invites where owner = ow and member = p_member; return public.get_home(); end if;
  if theirs = 0 then raise exception '對方不住在這座島'; end if;
  if mine < 2 or mine <= theirs then raise exception '你的權限不夠'; end if;
  delete from public.home_members where owner = ow and member = p_member;
  perform public._home_unbed(ow, p_member);
  return public.get_home();
end $$;

-- 設定權限：島主可以設任何人；共同島主可以設管理成員／一般成員
create or replace function public.isle_set_perm(p_member uuid, p_perm text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); mine int; theirs int;
begin
  if p_perm not in ('co', 'admin', 'member') then raise exception '沒有這種權限'; end if;
  mine := public._perm_rank(public._isle_perm(ow, pl.id)); theirs := public._perm_rank(public._isle_perm(ow, p_member));
  if theirs = 0 or theirs = 4 then raise exception '對方不是這座島的成員'; end if;
  if mine < 3 or (mine = 3 and (theirs >= 3 or p_perm = 'co')) then raise exception '你的權限不夠'; end if;
  update public.home_members set perm = p_perm where owner = ow and member = p_member;
  return public.isle_people();
end $$;

-- 島上的人和權限（給「我的家」畫面用）
create or replace function public.isle_people() returns jsonb language sql stable security definer set search_path = public as $$
  with o as (select public._home_of(auth.uid()) ow)
  select jsonb_build_object('island', (select ow from o), 'me', public._isle_perm((select ow from o), auth.uid()),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'perm', public._isle_perm((select ow from o), p.id)) order by public._perm_rank(public._isle_perm((select ow from o), p.id)) desc, p.nickname), '[]'::jsonb)
      from public.players p where p.id = (select ow from o) or p.id in (select member from public.home_members where owner = (select ow from o)))) $$;

-- ---- 公共儲物箱 ----
create table if not exists public.isle_store (
  id    bigserial primary key,
  owner uuid not null references public.players(id) on delete cascade,
  item  jsonb not null,
  by_uid uuid not null,
  by_name text not null default '',
  at    timestamptz not null default now()
);
create index if not exists isle_store_owner on public.isle_store (owner, id desc);
alter table public.isle_store enable row level security;
revoke all on public.isle_store from anon, authenticated;

create or replace function public.isle_storage() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'item', s.item - 't', 'by', s.by_name, 'mine', s.by_uid = auth.uid(), 'at', s.at) order by s.id desc), '[]'::jsonb)
  from public.isle_store s where s.owner = public._home_of(auth.uid()) and public._isle_perm(s.owner, auth.uid()) is not null $$;

create or replace function public.isle_deposit(p_t bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); e jsonb;
begin
  if public._isle_perm(ow, pl.id) is null then raise exception '你不住在這座島'; end if;
  perform 1 from public.players where id = ow for update;
  if (select count(*) from public.isle_store where owner = ow) >= 60 then raise exception '公共儲物箱滿了（最多 60 條）'; end if;
  select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '魚缸裡沒有這條魚'; end if;
  if e ? 'rs' then raise exception '赤紅霸王鯊不能放'; end if;
  if pl.show @> jsonb_build_array(e->'t') then raise exception '展示中的魚要先收回來'; end if;
  update public.players set tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality t(x, i) where (x->>'t')::bigint <> p_t), updated_at = now() where id = pl.id returning * into pl;
  insert into public.isle_store (owner, item, by_uid, by_name) values (ow, e, pl.id, left(coalesce(pl.nickname, ''), 16));
  return pl;
end $$;

create or replace function public.isle_withdraw(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); s public.isle_store; r int;
begin
  select * into s from public.isle_store where id = p_id and owner = ow for update;
  if s.id is null then raise exception '這條魚已經被拿走了'; end if;
  r := public._perm_rank(public._isle_perm(ow, pl.id));
  if r = 0 then raise exception '你不住在這座島'; end if;
  if r < 2 and s.by_uid <> pl.id then raise exception '一般成員只能拿回自己放的魚'; end if;
  delete from public.isle_store where id = p_id;
  update public.players set tank = public._trim_tank(jsonb_build_array(s.item || jsonb_build_object('t', (extract(epoch from clock_timestamp()) * 1000)::bigint)) || tank, show), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['invite_home(uuid)', 'kick_home(uuid)', 'isle_set_perm(uuid, text)', 'isle_people()', 'isle_storage()', 'isle_deposit(bigint)', 'isle_withdraw(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '共同島嶼權限、公共儲物箱設定完成 🏝️' as result;
