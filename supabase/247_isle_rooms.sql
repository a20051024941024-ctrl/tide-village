-- 247（第 1 段，共 2 段）潮汐釣魚村 v887：自己圍房間＋名牌門。可以重複執行。要先貼過 245、246。
-- ・用方塊或隔板圍一圈（至少 2 塊高），留一個「門」，在門上掛名牌就變成一間房間。
-- ・名牌：「我的房間」＝只有你可以動裡面的東西；「廁所、浴室、廚房、遊戲間、衣帽間、自己取名」＝大家的房間。
-- ・格子編號：(gx + 500) * 1000 + (gz + 500)，一格 50 公分（跟方塊一樣）。

create table if not exists public.isle_rooms (
  id    bigserial primary key,
  owner uuid not null references public.players(id) on delete cascade,
  gx int not null, gz int not null, gy int not null,
  kind  text not null default 'mine',
  label text not null default '',
  uid   uuid,
  cells int[] not null default '{}',
  ring  int[] not null default '{}',
  at    timestamptz not null default now(),
  unique (owner, gx, gz, gy)
);
alter table public.isle_rooms enable row level security;
revoke all on public.isle_rooms from anon, authenticated;

/* 從一格開始往外找，碰到「至少 2 塊高的牆」就停；跑太遠（超過 15 公尺）或太大（超過 900 格）就是沒圍好，回傳 null */
create or replace function public._room_fill(b jsonb, sgx int, sgz int, gy int) returns int[] language sql immutable as $$
  with recursive bl as (
    select (x->>0)::int gx, (x->>1)::int gz, (x->>2)::int y from jsonb_array_elements(coalesce(b, '[]'::jsonb)) x where x->>3 not in ('tl', 'aw') and (x->>2)::int in (gy, gy + 1)
  ), w as (
    select gx, gz from bl where y = gy intersect select gx, gz from bl where y = gy + 1
  ), f(gx, gz) as (
    select sgx, sgz where not exists (select 1 from w where w.gx = sgx and w.gz = sgz)
    union
    select f.gx + d.dx, f.gz + d.dz from f cross join (values (1, 0), (-1, 0), (0, 1), (0, -1)) d(dx, dz)
    where abs(f.gx + d.dx - sgx) <= 31 and abs(f.gz + d.dz - sgz) <= 31
      and not exists (select 1 from w where w.gx = f.gx + d.dx and w.gz = f.gz + d.dz)
  )
  select case when count(*) = 0 or count(*) > 900 or max(greatest(abs(gx - sgx), abs(gz - sgz))) >= 31 then null
    else array_agg((gx + 500) * 1000 + (gz + 500) order by gx, gz) end from f $$;

/* 門的兩邊各找一次，圍好的那邊就是房間（兩邊都圍好就選小的） */
create or replace function public._room_calc(b jsonb, dgx int, dgz int, dgy int) returns int[] language plpgsql immutable as $$
declare d jsonb; r int; a int[]; c int[];
begin
  select x into d from jsonb_array_elements(coalesce(b, '[]'::jsonb)) x where (x->>0)::int = dgx and (x->>1)::int = dgz and (x->>2)::int = dgy and x->>3 = 'dr' limit 1;
  if d is null then return null; end if;
  r := coalesce((d->>4)::int, 0) % 2;
  if r = 0 then a := public._room_fill(b, dgx, dgz - 1, dgy); c := public._room_fill(b, dgx, dgz + 1, dgy);
  else a := public._room_fill(b, dgx - 1, dgz, dgy); c := public._room_fill(b, dgx + 1, dgz, dgy); end if;
  if a is null then return c; end if;
  if c is null then return a; end if;
  return case when cardinality(a) <= cardinality(c) then a else c end;
end $$;

/* 房間外面一圈（牆的位置） */
create or replace function public._room_ring(cells int[]) returns int[] language sql immutable as $$
  select coalesce(array_agg(distinct k), '{}') from (select c + dx * 1000 + dz k from unnest(cells) c, generate_series(-1, 1) dx, generate_series(-1, 1) dz) q where not (k = any(cells)) $$;

/* 牆動過以後重新算每一間：門不見了就拿掉名牌；牆有缺口就先變成「有缺口」（cells 空的，不保護） */
create or replace function public._rooms_refresh(p_owner uuid) returns void language plpgsql security definer set search_path = public as $$
declare b jsonb; rm public.isle_rooms; c int[];
begin
  select ib.b into b from public.isle_blocks ib where ib.owner = p_owner;
  for rm in select * from public.isle_rooms where owner = p_owner loop
    if not exists (select 1 from jsonb_array_elements(coalesce(b, '[]'::jsonb)) x where (x->>0)::int = rm.gx and (x->>1)::int = rm.gz and (x->>2)::int = rm.gy and x->>3 = 'dr') then
      delete from public.isle_rooms where id = rm.id; continue; end if;
    c := coalesce(public._room_calc(b, rm.gx, rm.gz, rm.gy), '{}');
    if c is distinct from rm.cells then update public.isle_rooms set cells = c, ring = public._room_ring(c) where id = rm.id; end if;
  end loop;
end $$;

/* 這些格子是不是在別人的房間裡（人搬走了就不算） */
create or replace function public._room_lock(p_owner uuid, ks int[], me uuid, with_ring boolean) returns text language sql stable security definer set search_path = public as $$
  select coalesce(p.nickname, '別人') || '的房間' from public.isle_rooms r left join public.players p on p.id = r.uid
  where r.owner = p_owner and r.kind = 'mine' and r.uid is not null and r.uid <> me and cardinality(r.cells) > 0
    and public._isle_perm(p_owner, r.uid) is not null
    and (r.cells && ks or (with_ring and r.ring && ks)) limit 1 $$;

create or replace function public.isle_rooms(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'gx', r.gx, 'gz', r.gz, 'gy', r.gy, 'kind', case when r.kind = 'mine' and (r.uid is null or public._isle_perm(r.owner, r.uid) is null) then 'shared' else r.kind end,
    'label', r.label, 'uid', r.uid, 'name', p.nickname, 'cells', r.cells) order by r.id), '[]'::jsonb)
  from public.isle_rooms r left join public.players p on p.id = r.uid where r.owner = p_owner $$;

/* 掛名牌（同一個門再掛一次＝換名牌） */
create or replace function public.isle_room_set(p_owner uuid, p_gx int, p_gz int, p_gy int, p_kind text, p_label text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; b jsonb; c int[]; old public.isle_rooms; lb text := left(btrim(coalesce(p_label, '')), 6);
begin
  if p_owner is null then p_owner := me; end if;
  if public._perm_rank(public._isle_perm(p_owner, me)) < 2 then raise exception '要住在這座島才能掛名牌'; end if;
  if p_kind not in ('mine', 'toilet', 'bath', 'kitchen', 'game', 'closet', 'custom') then raise exception '沒有這種名牌'; end if;
  if p_kind = 'custom' and lb = '' then raise exception '名字要寫'; end if;
  perform 1 from public.players where id = p_owner for update;
  select ib.b into b from public.isle_blocks ib where ib.owner = p_owner;
  c := public._room_calc(b, p_gx, p_gz, p_gy);
  if c is null then raise exception '房間還沒圍好：牆要至少 2 塊高、圍一整圈，只留這個門（最大 15×15 公尺）'; end if;
  select * into old from public.isle_rooms where owner = p_owner and gx = p_gx and gz = p_gz and gy = p_gy;
  if old.id is not null and old.kind = 'mine' and old.uid <> me and public._isle_perm(p_owner, old.uid) is not null then raise exception '這是別人的房間'; end if;
  if exists (select 1 from public.isle_rooms where owner = p_owner and id is distinct from old.id and cells && c) then raise exception '這間已經從另一個門掛過名牌了'; end if;
  if p_kind = 'mine' and exists (select 1 from public.isle_rooms where owner = p_owner and id is distinct from old.id and kind = 'mine' and uid = me) then raise exception '每個人在一座島上只能有一間「我的房間」'; end if;
  if old.id is null and (select count(*) from public.isle_rooms where owner = p_owner) >= 12 then raise exception '一座島最多 12 間房間'; end if;
  insert into public.isle_rooms (owner, gx, gz, gy, kind, label, uid, cells, ring) values (p_owner, p_gx, p_gz, p_gy, p_kind, case when p_kind = 'custom' then lb else '' end, case when p_kind = 'mine' then me end, c, public._room_ring(c))
  on conflict (owner, gx, gz, gy) do update set kind = excluded.kind, label = excluded.label, uid = excluded.uid, cells = excluded.cells, ring = excluded.ring, at = now();
  return public.isle_rooms(p_owner);
end $$;

/* 拿掉名牌：自己的房間、大家的房間都可以；別人的房間要那個人搬走了才可以 */
create or replace function public.isle_room_del(p_owner uuid, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; rm public.isle_rooms;
begin
  if p_owner is null then p_owner := me; end if;
  if public._perm_rank(public._isle_perm(p_owner, me)) < 2 then raise exception '要住在這座島才能拿名牌'; end if;
  select * into rm from public.isle_rooms where id = p_id and owner = p_owner;
  if rm.id is null then return public.isle_rooms(p_owner); end if;
  if rm.kind = 'mine' and rm.uid <> me and public._isle_perm(p_owner, rm.uid) is not null then raise exception '這是別人的房間'; end if;
  delete from public.isle_rooms where id = p_id;
  return public.isle_rooms(p_owner);
end $$;

do $$ declare f text; begin
  foreach f in array array['isle_rooms(uuid)', 'isle_room_set(uuid,integer,integer,integer,text,text)', 'isle_room_del(uuid,bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_room_fill(jsonb,integer,integer,integer)', '_room_calc(jsonb,integer,integer,integer)', '_room_ring(integer[])', '_rooms_refresh(uuid)', '_room_lock(uuid,integer[],uuid,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
select '房間名牌：第 1 段好了，接著貼 248 🚪' as result;
