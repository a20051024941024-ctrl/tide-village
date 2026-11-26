-- 245（第 1 段，共 2 段）潮汐釣魚村 v886：大家一起住。可以重複執行。要先貼過 242、243、244。
-- ・住在島上的人全部一樣：都可以蓋、拆、收、擺（以前分共同島主／管理／一般成員，現在不分了）。
-- ・只有島主可以邀請人、請人搬走。
-- ・島上收起來的東西、拆下來的方塊，全部放進島主家的「大箱子」（isle_bag），大家都能拿出來擺。

update public.home_members set perm = 'admin' where perm <> 'admin';
alter table public.home_members alter column perm set default 'admin';

-- 邀請：只有島主
create or replace function public.invite_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id);
begin
  if ow <> pl.id then raise exception '只有島主可以邀請'; end if;
  if p_member = pl.id then raise exception '不能邀請自己'; end if;
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_member) and exists (select 1 from public.friends where owner = p_member and friend = pl.id)) then raise exception '要互相加好友才能邀請'; end if;
  perform 1 from public.players where id = ow for update;
  if (select count(*) from public.home_members where owner = ow) + 1 >= public._home_cap() then raise exception '島上已經住滿了（最多 6 人）'; end if;
  if exists (select 1 from public.home_members where member = p_member) then raise exception '對方已經住在別人家了'; end if;
  if (select count(*) from public.home_invites where owner = ow) >= 10 then raise exception '邀請太多了，等對方回覆吧'; end if;
  insert into public.home_invites (owner, member) values (ow, p_member) on conflict do nothing;
  return public.get_home();
end $$;

-- 請人搬走、收回邀請：只有島主
create or replace function public.kick_home(p_member uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id);
begin
  if ow <> pl.id then raise exception '只有島主可以請人搬走'; end if;
  if exists (select 1 from public.home_invites where owner = ow and member = p_member) then delete from public.home_invites where owner = ow and member = p_member; return public.get_home(); end if;
  if not exists (select 1 from public.home_members where owner = ow and member = p_member) then raise exception '對方不住在這座島'; end if;
  delete from public.home_members where owner = ow and member = p_member;
  perform public._home_unbed(ow, p_member);
  return public.get_home();
end $$;

-- 權限不分了：舊的設定按鈕按了只會說明
create or replace function public.isle_set_perm(p_member uuid, p_perm text) returns jsonb language plpgsql security definer set search_path = public as $$
begin raise exception '現在住在島上的人都一樣，不用設定'; end $$;

-- 收起來：放進島主家的大箱子
create or replace function public.isle_stow(p_owner uuid, p_id integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow public.players; o jsonb; payer uuid; t text; half int; r jsonb; bag jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  if public._perm_rank(public._isle_perm(p_owner, pl.id)) < 2 then raise exception '這不是你的家'; end if;
  select * into ow from public.players where id = p_owner;
  select e into o from jsonb_array_elements(public._isle_items(public._isle_upgrade(ow.island))) e where (e->>'id')::int = p_id;
  if o is null then raise exception '找不到這個東西'; end if;
  t := o->>'t';
  if (public._isle_item(t)).house then raise exception '房子不能收起來（裡面還有家具），要拆的話用「拆掉」'; end if;
  payer := coalesce((o->>'by')::uuid, p_owner);
  r := public.home_edit(p_owner, 'remove', jsonb_build_object('id', p_id));   -- 會退一半給付錢的人，這裡扣回來，改成放進大箱子
  half := coalesce((public._isle_item(t)).price, 0) / 2;
  update public.players set coins = greatest(0, coins - half), updated_at = now() where id = payer;
  update public.players set isle_bag = jsonb_set(coalesce(isle_bag, '{}'::jsonb), array[t], to_jsonb(coalesce((isle_bag->>t)::int, 0) + 1)), updated_at = now() where id = p_owner returning isle_bag into bag;
  select * into pl from public.players where id = pl.id;
  return jsonb_build_object('island', r->'island', 'coins', pl.coins, 'bag', bag);
end $$;

-- 從大箱子拿出來擺：不用付錢
create or replace function public.isle_bag_place(p_owner uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text := p->>'t'; price int; r jsonb; bag jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  if public._perm_rank(public._isle_perm(p_owner, pl.id)) < 2 then raise exception '這不是你的家'; end if;
  select isle_bag into bag from public.players where id = p_owner for update;
  if coalesce((bag->>t)::int, 0) <= 0 then raise exception '大箱子裡沒有這個'; end if;
  price := coalesce((public._isle_item(t)).price, 0);
  update public.players set coins = coins + price where id = pl.id;   -- 先把錢補上，home_edit 會照價扣掉
  r := public.home_edit(p_owner, 'place', p);
  update public.players set isle_bag = jsonb_set(isle_bag, array[t], to_jsonb((isle_bag->>t)::int - 1)), updated_at = now() where id = p_owner returning isle_bag into bag;
  select * into pl from public.players where id = pl.id;
  return jsonb_build_object('island', r->'island', 'coins', pl.coins, 'bag', bag);
end $$;

-- 去島上看的時候：住在這座島的人會拿到大箱子裡有什麼
create or replace function public.visit_isle(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'island', island, 'likes', likes, 'tank', public._show_tank(tank, show), 'show', show, 'land', isle_land, 'tiles', isle_tiles,
    'bag', case when public._isle_perm(p_id, auth.uid()) is not null then coalesce(isle_bag, '{}'::jsonb) end) from public.players where id = p_id $$;

notify pgrst, 'reload schema';
select '大家一起住：第 1 段好了，接著貼 246 🏠' as result;
