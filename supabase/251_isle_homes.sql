-- 251 潮汐釣魚村 v892：各有自己的家。可以重複執行。要先貼過 248。
-- ・島上的房子可以掛「我的家」：一個人一棟，掛了以後只有你可以動裡面的家具、改格局、拆這棟房子。
-- ・沒掛的房子是大家的。人搬走了，他的家自動變成大家的（家具留著）。

create table if not exists public.isle_homes (
  owner uuid not null references public.players(id) on delete cascade,
  hid   int  not null,
  uid   uuid not null,
  at    timestamptz not null default now(),
  primary key (owner, hid)
);
alter table public.isle_homes enable row level security;
revoke all on public.isle_homes from anon, authenticated;

/* 這棟房子是不是別人的家（人搬走了就不算） */
create or replace function public._home_lock(p_owner uuid, p_hid int, me uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(p.nickname, '別人') || '的家' from public.isle_homes h left join public.players p on p.id = h.uid
  where h.owner = p_owner and h.hid = p_hid and h.uid <> me and public._isle_perm(p_owner, h.uid) is not null limit 1 $$;

create or replace function public.isle_homes(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('hid', h.hid, 'uid', h.uid, 'name', p.nickname)), '[]'::jsonb)
  from public.isle_homes h left join public.players p on p.id = h.uid where h.owner = p_owner and public._isle_perm(p_owner, h.uid) is not null $$;

/* 掛「我的家」／拿掉 */
create or replace function public.isle_home_claim(p_owner uuid, p_hid int, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; ow public.players; nm text;
begin
  if p_owner is null then p_owner := me; end if;
  if public._perm_rank(public._isle_perm(p_owner, me)) < 2 then raise exception '要住在這座島才能有自己的家'; end if;
  select * into ow from public.players where id = p_owner for update;
  if not exists (select 1 from jsonb_array_elements(public._isle_items(public._isle_upgrade(ow.island))) e where (e->>'id')::int = p_hid and (public._isle_item(e->>'t')).house) then raise exception '找不到這棟房子'; end if;
  nm := public._home_lock(p_owner, p_hid, me);
  if nm is not null then raise exception '這是%', nm; end if;
  delete from public.isle_homes where owner = p_owner and hid = p_hid;   -- 搬走的人留下的也清掉
  if p_on then
    delete from public.isle_homes where owner = p_owner and uid = me;   -- 一個人一棟：換一棟的話舊的變回大家的
    insert into public.isle_homes (owner, hid, uid) values (p_owner, p_hid, me);
  end if;
  return public.isle_homes(p_owner);
end $$;

/* 島上的東西：別人的家（拆、移動房子、裡面的家具、格局）不能動。外面再包一層（248 的 home_edit 會照樣做房間的檢查） */
do $$ begin
  if position('_home_edit1' in pg_get_functiondef('public.home_edit(uuid,text,jsonb)'::regprocedure)) = 0 then
    drop function if exists public._home_edit1(uuid, text, jsonb);
    alter function public.home_edit(uuid, text, jsonb) rename to _home_edit1;
  end if;
end $$;
revoke all on function public._home_edit1(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; ow uuid := coalesce(p_owner, me); hid int; nm text;
begin
  hid := case when p_op in ('move', 'remove') then (p->>'id')::int when p ? 'house' then (p->>'house')::int end;
  if hid is not null and p_op <> 'repay' then
    nm := public._home_lock(ow, hid, me);
    if nm is not null then raise exception '這是%，只有他自己可以動', nm; end if;
  end if;
  return public._home_edit1(p_owner, p_op, p);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

do $$ declare f text; begin
  foreach f in array array['isle_homes(uuid)', 'isle_home_claim(uuid,integer,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public._home_lock(uuid,integer,uuid) from public, anon, authenticated';
end $$;
notify pgrst, 'reload schema';
select '各有自己的家設定完成 🏠' as result;
