-- 252 潮汐釣魚村 v894：房子整棟買（不用擴建、不用借錢）。可以重複執行。要先貼過 251。
-- ・八種房子：小屋、小家、中家、大房子、兩層樓、大宅、三層大宅、海景豪宅。價錢＝以前一路擴建到同樣大小花的錢。
-- ・不能再擴建、加蓋（expand、floor）。還沒還完的擴建貸款照樣可以還（repay）。
-- ・以前買的大宅：大小、樓層、家具、格局都不變。

create or replace function public._house_kit(k text, out lv int, out up int, out price int) language sql immutable as $$
  select x.lv, x.up, x.price from (values ('s1', 1, 0, 3000), ('s2', 2, 0, 4500), ('s3', 3, 0, 6500), ('s5', 5, 0, 12000),
    ('f5', 5, 1, 18000), ('f6', 6, 1, 22000), ('t7', 7, 2, 36000), ('t8', 8, 2, 42000)) x(k, lv, up, price) where x.k = $1 $$;

create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; ow uuid := coalesce(p_owner, me); hid int; nm text; kt record; base int; nid int; isl jsonb; cn int;
begin
  if p_op in ('expand', 'floor') then raise exception '房子現在是整棟買的，不用再擴建了。想住大一點，可以再買一棟大的'; end if;
  if p_op = 'buyhouse' then
    select * into kt from public._house_kit(p->>'k');
    if kt.lv is null then raise exception '沒有這種房子'; end if;
    base := coalesce((public._isle_item('mansion')).price, 3000);
    if (select coins from public.players where id = me) < kt.price then raise exception '金幣不夠'; end if;
    perform public.home_edit(p_owner, 'place', jsonb_build_object('t', 'mansion', 'x', p->'x', 'z', p->'z', 'r', coalesce(p->'r', '0'::jsonb)));
    select public._isle_upgrade(island) into isl from public.players where id = ow for update;
    select max((e->>'id')::int) into nid from jsonb_array_elements(public._isle_items(isl)) e where e->>'t' = 'mansion';
    isl := jsonb_set(isl, '{items}', (select jsonb_agg(case when (e->>'id')::int = nid then e || jsonb_build_object('lv', kt.lv, 'up', kt.up, 'loan', 0, 'kit', p->>'k') else e end) from jsonb_array_elements(public._isle_items(isl)) e));
    update public.players set island = isl, updated_at = now() where id = ow;
    update public.players set coins = coins - (kt.price - base), updated_at = now() where id = me returning coins into cn;
    return jsonb_build_object('island', isl, 'coins', cn, 'id', nid);
  end if;
  hid := case when p_op in ('move', 'remove') then (p->>'id')::int when p ? 'house' then (p->>'house')::int end;
  if hid is not null and p_op <> 'repay' then
    nm := public._home_lock(ow, hid, me);
    if nm is not null then raise exception '這是%，只有他自己可以動', nm; end if;
  end if;
  return public._home_edit1(p_owner, p_op, p);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;
notify pgrst, 'reload schema';
select '房子整棟買設定完成 🏠' as result;
