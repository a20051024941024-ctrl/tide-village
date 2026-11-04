-- 潮汐釣魚村：自己設計的大宅（可以重複執行）
-- 小島上可以蓋「大宅」（18×12 公尺），走進去按「設計格局」：用 1 公尺的格子畫牆、放門、放窗戶，每個房間選地板和壁紙。
-- 格局存在房子那一筆的 cl 裡：{"walls":[[x0,z0,x1,z1],...],"doors":[[x,z],...],"wins":[[x0,z0,x1,z1],...],"fl":"216 個 0～5","wp":"216 個 0～4"}
-- 伺服器檢查：牆、門、窗都要在 1 公尺的格線上、在房子裡面；家具不能卡在牆上、不能擋住門（換格局時放不下的家具收起來、退錢）。

create or replace function public._isle_item(p text, out price integer, out rad numeric, out house boolean) language sql immutable as $$
  select v.price, v.rad, v.house from (values
    ('cabin',1500,2.6,true),('beach',3000,2.9,true),('villa',8000,3.6,true),('tea',5500,3.0,true),('mansion',12000,4.6,true),
    ('flower',200,0.9,false),('bench',150,0.9,false),('lamp',250,0.35,false),('palm',400,0.6,false),('pond',1200,1.5,false),('flag',300,0.3,false),
    ('fence',80,0.9,false),('tree',300,1.1,false),('rock',100,0.7,false),('mailbox',200,0.35,false),('picnic',600,1.4,false),('parasol',350,1.0,false),
    ('campfire',450,0.8,false),('statue',2000,0.9,false),('swing',900,1.3,false),('bush',120,0.7,false),('lantern',180,0.4,false),('boat',1500,1.6,false)
  ) v(id, price, rad, house) where v.id = p $$;

create or replace function public._cl_default() returns jsonb language sql immutable as $$
  select jsonb_build_object('walls', '[]'::jsonb, 'doors', '[]'::jsonb, 'wins', '[]'::jsonb, 'owins', '[]'::jsonb, 'fl', repeat('0', 216), 'wp', repeat('0', 216)) $$;

-- 檢查並整理一份格局（不合規定就報錯）
create or replace function public._cl_check(c jsonb) returns jsonb language plpgsql immutable as $$
declare w jsonb; out_o jsonb := '[]'::jsonb; out_w jsonb := '[]'::jsonb; out_d jsonb := '[]'::jsonb; out_n jsonb := '[]'::jsonb; x0 numeric; z0 numeric; x1 numeric; z1 numeric; fl text; wp text; seen text[] := '{}'; k text;
begin
  if c is null or jsonb_typeof(c) <> 'object' then raise exception '格局資料不對'; end if;
  if jsonb_array_length(coalesce(c->'walls', '[]')) + jsonb_array_length(coalesce(c->'wins', '[]')) > 300 or jsonb_array_length(coalesce(c->'doors', '[]')) > 40 then raise exception '牆或門太多了'; end if;
  for w in select * from jsonb_array_elements(coalesce(c->'walls', '[]') || coalesce(c->'wins', '[]')) loop
    x0 := (w->>0)::numeric; z0 := (w->>1)::numeric; x1 := (w->>2)::numeric; z1 := (w->>3)::numeric;
    if x0 <> round(x0) or z0 <> round(z0) or x1 <> round(x1) or z1 <> round(z1) or abs(x1 - x0) + abs(z1 - z0) <> 1 or least(x0, x1) < -9 or greatest(x0, x1) > 9 or least(z0, z1) < -6 or greatest(z0, z1) > 6 then raise exception '牆要畫在格線上、房子裡面'; end if;
    if (x0 = x1 and abs(x0) = 9) or (z0 = z1 and abs(z0) = 6) then continue; end if;   -- 外牆本來就有
    k := least(x0, x1) || ',' || least(z0, z1) || ',' || case when x0 = x1 then 'v' else 'h' end; if k = any(seen) then continue; end if; seen := seen || k;
  end loop;
  seen := '{}';
  for w in select * from jsonb_array_elements(coalesce(c->'walls', '[]')) loop k := (w->>0) || (w->>1) || (w->>2) || (w->>3); if (abs((w->>0)::numeric - (w->>2)::numeric) = 0 and abs((w->>0)::numeric) = 9) or (abs((w->>1)::numeric - (w->>3)::numeric) = 0 and abs((w->>1)::numeric) = 6) or k = any(seen) then continue; end if; seen := seen || k; out_w := out_w || jsonb_build_array(w); end loop;
  for w in select * from jsonb_array_elements(coalesce(c->'wins', '[]')) loop k := (w->>0) || (w->>1) || (w->>2) || (w->>3); if k = any(seen) then continue; end if; seen := seen || k;
    if (abs((w->>0)::numeric - (w->>2)::numeric) = 0 and abs((w->>0)::numeric) = 9) or (abs((w->>1)::numeric - (w->>3)::numeric) = 0 and abs((w->>1)::numeric) = 6) then out_o := out_o || jsonb_build_array(w); else out_n := out_n || jsonb_build_array(w); end if; end loop;
  for w in select * from jsonb_array_elements(coalesce(c->'doors', '[]')) loop
    x0 := (w->>0)::numeric; z0 := (w->>1)::numeric;
    if not ((x0 = round(x0) and z0 - floor(z0) = 0.5) or (z0 = round(z0) and x0 - floor(x0) = 0.5)) or abs(x0) >= 9 or abs(z0) >= 6 then raise exception '門要放在格線上、房子裡面'; end if;
    out_d := out_d || jsonb_build_array(jsonb_build_array(x0, z0));
  end loop;
  fl := coalesce(c->>'fl', repeat('0', 216)); wp := coalesce(c->>'wp', repeat('0', 216));
  if fl !~ '^[0-5]{216}$' or wp !~ '^[0-4]{216}$' then raise exception '地板或壁紙的資料不對'; end if;
  if jsonb_array_length(out_o) > 60 then raise exception '窗戶太多了'; end if;
  return jsonb_build_object('walls', out_w, 'doors', out_d, 'wins', out_n, 'owins', out_o, 'fl', fl, 'wp', wp);
end $$;

-- 大宅的格局 → 跟固定格局一樣的格式（家具檢查用）
create or replace function public._custom_lay(c jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('price', 0, 'W', 18, 'D', 12, 'walls', coalesce(c->'walls', '[]'::jsonb) || coalesce(c->'wins', '[]'::jsonb), 'doors', coalesce(c->'doors', '[]'::jsonb)) $$;

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
    items := items || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2)) || case when t = 'mansion' then jsonb_build_object('lay', 'custom', 'f', '[]'::jsonb, 'cl', public._cl_default()) else '{}'::jsonb end);
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
  elsif p_op in ('layout', 'fplace', 'fmove', 'fremove', 'bed', 'design') then
    hid := (p->>'house')::int;
    select e into h from jsonb_array_elements(items) e where (e->>'id')::int = hid;
    if h is null or not (public._isle_item(h->>'t')).house then raise exception '找不到這棟房子'; end if;
    f := coalesce(h->'f', case when h->>'t' = 'mansion' then '[]'::jsonb else public._home_def() end); lay := case when h->>'t' = 'mansion' then public._custom_lay(h->'cl') else public._home_lay(coalesce(h->>'lay', 'open')) end;
    if p_op = 'layout' and (h->>'t' = 'mansion') then raise exception '大宅的格局要用「設計格局」自己畫'; end if;
    if p_op = 'design' then
      if h->>'t' <> 'mansion' then raise exception '只有大宅可以自己設計格局'; end if;
      nl := public._cl_check(p->'cl'); lay := public._custom_lay(nl);
      keep := '[]'::jsonb;
      for o in select * from jsonb_array_elements(f) loop
        begin perform public._furn_check(lay, keep, o->>'t', (o->>'x')::numeric, (o->>'z')::numeric, -1); keep := keep || jsonb_build_array(o);
        exception when others then back := back + coalesce((public._furn(o->>'t')).price, 0); end;
      end loop;
      h := h || jsonb_build_object('cl', nl, 'f', keep, 'lay', 'custom');
    end if;
    if p_op = 'design' then null;
    elsif p_op = 'layout' then
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

revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

select '自己設計的大宅設定完成 🏠' as result;
