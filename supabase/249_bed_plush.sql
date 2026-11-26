-- 249 潮汐釣魚村 v890：床上可以放娃娃（每張床最多 3 隻，躺下來會抱著）。可以重複執行。要先貼過 245。
-- ・娃娃從自己釣過的魚（f:魚的代號）、自己養的寵物（p:寵物種類）來。
-- ・存在島主的 players.isle_plush：{"房子id:家具id": ["f:salmon", "p:cat"]}

alter table public.players add column if not exists isle_plush jsonb not null default '{}'::jsonb;

create or replace function public.isle_plush_set(p_owner uuid, p_key text, p_items text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); x text; m jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  if public._perm_rank(public._isle_perm(p_owner, pl.id)) < 2 then raise exception '要住在這座島才能放娃娃'; end if;
  if p_key !~ '^[0-9]{1,6}:[0-9]{1,6}$' then raise exception '找不到這張床'; end if;
  if coalesce(array_length(p_items, 1), 0) > 3 then raise exception '一張床最多放 3 隻娃娃'; end if;
  foreach x in array coalesce(p_items, '{}') loop
    if x ~ '^f:[a-z0-9_]{1,40}$' then
      if not (coalesce(pl.fish_best, '{}'::jsonb) ? substr(x, 3)) then raise exception '要先釣過這種魚，才有牠的娃娃'; end if;
    elsif x ~ '^p:[a-z0-9_]{1,40}$' then
      if not exists (select 1 from public.pets where owner = pl.id and kind = substr(x, 3)) then raise exception '要先養過這種寵物，才有牠的娃娃'; end if;
    else raise exception '沒有這種娃娃'; end if;
  end loop;
  select isle_plush into m from public.players where id = p_owner for update;
  if coalesce(array_length(p_items, 1), 0) = 0 then m := coalesce(m, '{}'::jsonb) - p_key;
  else
    if not (coalesce(m, '{}'::jsonb) ? p_key) and (select count(*) from jsonb_object_keys(coalesce(m, '{}'::jsonb))) >= 40 then raise exception '島上的床放太多娃娃了'; end if;
    m := jsonb_set(coalesce(m, '{}'::jsonb), array[p_key], to_jsonb(p_items));
  end if;
  update public.players set isle_plush = m, updated_at = now() where id = p_owner;
  return m;
end $$;
revoke all on function public.isle_plush_set(uuid, text, text[]) from public, anon;
grant execute on function public.isle_plush_set(uuid, text, text[]) to authenticated;

create or replace function public.visit_isle(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'island', island, 'likes', likes, 'tank', public._show_tank(tank, show), 'show', show, 'land', isle_land, 'tiles', isle_tiles,
    'bag', case when public._isle_perm(p_id, auth.uid()) is not null then coalesce(isle_bag, '{}'::jsonb) end, 'plush', isle_plush) from public.players where id = p_id $$;

notify pgrst, 'reload schema';
select '床上的娃娃設定完成 🧸' as result;
