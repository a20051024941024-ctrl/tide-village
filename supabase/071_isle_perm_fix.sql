-- 潮汐釣魚村：島嶼權限修正（可以重複執行）
-- 修正：一般成員可以拆島主的東西、換格局，退的錢跑到自己口袋。
-- 改成：
--   1. 照 062 的權限：
--      拆島上的東西（remove）、換格局（layout）、畫大宅格局（design）：管理成員（admin）以上。
--      移動島上的東西（move）、移動／收掉家具（fmove／fremove）：一般成員只能動自己買的；管理成員以上都可以。
--      蓋東西（place）、擺家具（fplace）、認領床（bed）：住在島上的人都可以。
--   2. 每一件島上的東西、每一件家具都記下付錢的人（by）；房子的格局記下付格局錢的人（lby）。舊資料沒有記的，當作島主付的。
--   3. 拆掉、收掉、換格局放不下：都退一半，退給「當初付錢的人」，不是動手的人。
--      （以前換格局放不下的家具是全額退錢，現在跟拆除一樣退一半。）
--   4. 舊的單人小島函式 place_item／remove_item／move_item 不能再用（會繞過權限）；遊戲連上雲端時本來就是用 home_edit。

create or replace function public._refund_add(r jsonb, uid text, amt integer) returns jsonb language sql immutable as $$
  select case when coalesce(amt, 0) <= 0 or uid is null then r else jsonb_set(r, array[uid], to_jsonb(coalesce((r->>uid)::int, 0) + amt)) end $$;

create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow public.players; isl jsonb; items jsonb; info record; fi record; nid integer; h jsonb; f jsonb; lay jsonb; nl jsonb;
  cost integer := 0; hid integer; fid integer; t text; o jsonb; x jsonb; keep jsonb; rk integer; me_t text; ow_t text; refund jsonb := '{}'::jsonb; k text; amt integer; payer text;
begin
  if p_owner is null then p_owner := pl.id; end if;
  rk := public._perm_rank(public._isle_perm(p_owner, pl.id));
  if rk = 0 or not public._home_can(p_owner, pl.id) then raise exception '這不是你的家'; end if;
  me_t := pl.id::text; ow_t := p_owner::text;
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
    items := items || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2), 'by', me_t)
      || case when t = 'mansion' then jsonb_build_object('lay', 'custom', 'f', '[]'::jsonb, 'cl', public._cl_default()) else '{}'::jsonb end);
  elsif p_op = 'move' then
    select e into o from jsonb_array_elements(items) e where (e->>'id')::int = (p->>'id')::int;
    if o is null then raise exception '找不到這個東西'; end if;
    if rk < 2 and coalesce(o->>'by', ow_t) <> me_t then raise exception '一般成員只能移動自己蓋的東西'; end if;
    perform public._isle_check(items, o->>'t', (p->>'x')::numeric, (p->>'z')::numeric, (p->>'id')::int);
    items := (select jsonb_agg(case when (e->>'id')::int = (p->>'id')::int then e || jsonb_build_object('x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)) else e end) from jsonb_array_elements(items) e);
  elsif p_op = 'remove' then
    if rk < 2 then raise exception '只有島主、共同島主、管理成員可以拆東西'; end if;
    select e into o from jsonb_array_elements(items) e where (e->>'id')::int = (p->>'id')::int;
    if o is null then raise exception '找不到這個東西'; end if;
    payer := coalesce(o->>'by', ow_t);
    refund := public._refund_add(refund, payer, (public._isle_item(o->>'t')).price / 2);
    if o ? 'f' then   -- 拆房子：裡面的家具各自退一半給付錢的人
      for x in select * from jsonb_array_elements(o->'f') loop refund := public._refund_add(refund, coalesce(x->>'by', ow_t), coalesce((public._furn(x->>'t')).price, 0) / 2); end loop;
    end if;
    if o ? 'lay' then refund := public._refund_add(refund, coalesce(o->>'lby', payer), coalesce((public._home_lay(o->>'lay')->>'price')::int, 0) / 2); end if;
    items := coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where (e->>'id')::int <> (p->>'id')::int), '[]'::jsonb);
  elsif p_op in ('layout', 'fplace', 'fmove', 'fremove', 'bed', 'design') then
    hid := (p->>'house')::int;
    select e into h from jsonb_array_elements(items) e where (e->>'id')::int = hid;
    if h is null or not (public._isle_item(h->>'t')).house then raise exception '找不到這棟房子'; end if;
    f := coalesce(h->'f', case when h->>'t' = 'mansion' then '[]'::jsonb else public._home_def() end); lay := case when h->>'t' = 'mansion' then public._custom_lay(h->'cl') else public._home_lay(coalesce(h->>'lay', 'open')) end;
    if p_op in ('layout', 'design') and rk < 2 then raise exception '只有島主、共同島主、管理成員可以改格局'; end if;
    if p_op = 'layout' and (h->>'t' = 'mansion') then raise exception '大宅的格局要用「設計格局」自己畫'; end if;
    if p_op = 'design' then
      if h->>'t' <> 'mansion' then raise exception '只有大宅可以自己設計格局'; end if;
      nl := public._cl_check(p->'cl'); lay := public._custom_lay(nl);
      keep := '[]'::jsonb;
      for o in select * from jsonb_array_elements(f) loop   -- 放不下的家具收起來，退一半給付錢的人
        begin perform public._furn_check(lay, keep, o->>'t', (o->>'x')::numeric, (o->>'z')::numeric, -1); keep := keep || jsonb_build_array(o);
        exception when others then refund := public._refund_add(refund, coalesce(o->>'by', ow_t), coalesce((public._furn(o->>'t')).price, 0) / 2); end;
      end loop;
      h := h || jsonb_build_object('cl', nl, 'f', keep, 'lay', 'custom');
    elsif p_op = 'layout' then
      nl := public._home_lay(p->>'lay'); if nl is null then raise exception '沒有這種格局'; end if;
      if coalesce(h->>'lay', 'open') = p->>'lay' then return jsonb_build_object('island', isl, 'coins', pl.coins); end if;
      cost := greatest(0, (nl->>'price')::int - (lay->>'price')::int);
      refund := public._refund_add(refund, coalesce(h->>'lby', h->>'by', ow_t), greatest(0, ((lay->>'price')::int - (nl->>'price')::int) / 2));
      keep := '[]'::jsonb;
      for o in select * from jsonb_array_elements(f) loop   -- 放不下的家具收起來，退一半給付錢的人（以前是全額）
        begin perform public._furn_check(nl, keep, o->>'t', (o->>'x')::numeric, (o->>'z')::numeric, -1); keep := keep || jsonb_build_array(o);
        exception when others then refund := public._refund_add(refund, coalesce(o->>'by', ow_t), coalesce((public._furn(o->>'t')).price, 0) / 2); end;
      end loop;
      h := h || jsonb_build_object('lay', p->>'lay', 'f', keep) || case when cost > 0 then jsonb_build_object('lby', me_t) else '{}'::jsonb end;
    elsif p_op = 'fplace' then
      t := p->>'t'; select * into fi from public._furn(t);
      if fi.price is null then raise exception '沒有這種家具'; end if;
      if jsonb_array_length(f) >= 40 then raise exception '這棟房子已經擺滿了'; end if;
      perform public._furn_check(lay, f, t, (p->>'x')::numeric, (p->>'z')::numeric, -1);
      cost := fi.price;
      select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(f) e;
      h := h || jsonb_build_object('f', f || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2), 'by', me_t)));
    elsif p_op = 'fmove' then
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null then raise exception '找不到這個家具'; end if;
      if rk < 2 and coalesce(o->>'by', ow_t) <> me_t then raise exception '一般成員只能移動自己買的家具'; end if;
      perform public._furn_check(lay, f, o->>'t', (p->>'x')::numeric, (p->>'z')::numeric, fid);
      h := h || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e || jsonb_build_object('x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)) else e end) from jsonb_array_elements(f) e));
    elsif p_op = 'fremove' then
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null then raise exception '找不到這個家具'; end if;
      if rk < 2 and coalesce(o->>'by', ow_t) <> me_t then raise exception '一般成員只能收掉自己買的家具'; end if;
      refund := public._refund_add(refund, coalesce(o->>'by', ow_t), coalesce((public._furn(o->>'t')).price, 0) / 2);
      h := h || jsonb_build_object('f', coalesce((select jsonb_agg(e) from jsonb_array_elements(f) e where (e->>'id')::int <> fid), '[]'::jsonb));
    else   -- bed：認領／放掉一張床（同一個人在整座島上只能有一張）
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null or not (o->>'t' in ('bed', 'dbed', 'bunk') or o->>'t' like 'kk\_bed%') then raise exception '這不是床'; end if;
      if o->>'own' is not null and o->>'own' <> me_t then raise exception '這張床已經有人了'; end if;
      if o->>'own' = me_t then
        h := h || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e - 'own' else e end) from jsonb_array_elements(f) e));
      else
        items := (select jsonb_agg(case when e ? 'f' then e || jsonb_build_object('f', (select coalesce(jsonb_agg(case when x2->>'own' = me_t then x2 - 'own' else x2 end), '[]'::jsonb) from jsonb_array_elements(e->'f') x2)) else e end) from jsonb_array_elements(items) e);
        select coalesce(e->'f', public._home_def()) into f from jsonb_array_elements(items) e where (e->>'id')::int = hid;
        h := (select e from jsonb_array_elements(items) e where (e->>'id')::int = hid) || jsonb_build_object('f', (select jsonb_agg(case when (e->>'id')::int = fid then e || jsonb_build_object('own', me_t) else e end) from jsonb_array_elements(f) e));
      end if;
    end if;
    items := (select jsonb_agg(case when (e->>'id')::int = hid then h else e end) from jsonb_array_elements(items) e);
  else raise exception '不知道要做什麼';
  end if;
  if pl.coins + coalesce((refund->>me_t)::int, 0) < cost then raise exception '金幣不夠'; end if;
  isl := jsonb_build_object('v', 2, 'items', items);
  update public.players set island = isl, updated_at = now() where id = p_owner;
  -- 動手的人付錢；退錢退給當初付錢的人
  update public.players set coins = coins - cost + coalesce((refund->>me_t)::int, 0), updated_at = now() where id = pl.id returning coins into pl.coins;
  for k, amt in select key, value::int from jsonb_each_text(refund) where key <> me_t loop
    update public.players set coins = coins + amt, updated_at = now() where id = k::uuid;
  end loop;
  return jsonb_build_object('island', isl, 'coins', pl.coins);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

-- 舊的單人小島函式：會繞過權限、退錢給動手的人，不能再用
create or replace function public.place_item(p_type text, p_x numeric, p_z numeric, p_r numeric) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '請重新整理遊戲（小島改版了）'; end $$;
create or replace function public.remove_item(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '請重新整理遊戲（小島改版了）'; end $$;
create or replace function public.move_item(p_id integer, p_x numeric, p_z numeric, p_r numeric) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '請重新整理遊戲（小島改版了）'; end $$;

select '島嶼權限修正完成 🔒' as result;
