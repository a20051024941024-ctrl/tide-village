-- 潮汐釣魚村：大宅大改（像天天玩樂園那樣；可以重複執行）
-- 1. 只賣大宅：小木屋、海邊小屋、別墅、茶屋不再賣（已經買的人保留，照樣可以住、擺家具）。
-- 2. 大宅再加大 3 級：22×14（🪙4000）、26×16（🪙5000）、30×18（🪙6000），一樣跟村長阿土伯借錢、慢慢還；以前買的大宅（沒有 lv，算第 5 級）也可以繼續擴建。
-- 3. 加蓋二樓（🪙6000）、三樓（🪙9000），也是借錢慢慢還；樓梯在房間後面的兩個角落（右後往上、左後往下），那裡不能放家具。
-- 4. 每一層樓可以免費換地板、壁紙（dc）；家具記住放在第幾層（k），每層最多 40 件。
-- 5. 不用再自己畫牆（遊戲裡拿掉了設計格局）；以前畫過的牆會留在一樓，可以一鍵拆掉。
-- 地板、壁紙的格子資料改成最大的 30×18 格（540 格）；以前的 18×12（216 格）會自動換過來。

create or replace function public._mansion_hw(lv integer) returns integer language sql immutable as $$ select (array[5, 6, 7, 8, 9, 11, 13, 15])[greatest(1, least(8, lv))] $$;
create or replace function public._mansion_hd(lv integer) returns integer language sql immutable as $$ select (array[4, 4, 5, 5, 6, 7, 8, 9])[greatest(1, least(8, lv))] $$;
create or replace function public._mansion_cost(lv integer) returns integer language sql immutable as $$ select (array[0, 1500, 2000, 2500, 3000, 4000, 5000, 6000])[greatest(1, least(8, lv))] $$;
create or replace function public._mansion_paid(lv integer) returns integer language sql immutable as $$ select coalesce(sum(public._mansion_cost(i)), 0)::int from generate_series(2, greatest(1, least(8, lv))) i $$;
create or replace function public._floor_cost(n integer) returns integer language sql immutable as $$ select (array[6000, 9000])[greatest(1, least(2, n))] $$;
create or replace function public._floor_paid(up integer) returns integer language sql immutable as $$ select coalesce(sum(public._floor_cost(i)), 0)::int from generate_series(1, greatest(0, least(2, up))) i $$;
-- 樓梯：房間後面的兩個角落（離側牆 1.3、離後牆 1.0 公尺），半徑 1.5 公尺內不能放家具
create or replace function public._stair_hit(lv integer, x numeric, z numeric) returns boolean language sql immutable as $$
  select sqrt((abs(x) - (public._mansion_hw(lv) - 1.3)) ^ 2 + (z - (-public._mansion_hd(lv) + 1.0)) ^ 2) < 1.5 $$;

create or replace function public._cl_grid(s text) returns text language plpgsql immutable as $$
declare o text := ''; x int; z int;
begin
  if s is null then return repeat('0', 540); end if;
  if length(s) = 540 then return s; end if;
  if length(s) <> 216 then return repeat('0', 540); end if;
  for z in -9..8 loop for x in -15..14 loop
    o := o || case when x >= -9 and x < 9 and z >= -6 and z < 6 then substr(s, (z + 6) * 18 + (x + 9) + 1, 1) else '0' end;
  end loop; end loop;
  return o;
end $$;

create or replace function public._cl_default() returns jsonb language sql immutable as $$
  select jsonb_build_object('walls', '[]'::jsonb, 'doors', '[]'::jsonb, 'wins', '[]'::jsonb, 'owins', '[]'::jsonb, 'fl', repeat('0', 540), 'wp', repeat('0', 540)) $$;

create or replace function public._cl_check2(c jsonb, lv integer) returns jsonb language plpgsql immutable as $$
declare hw int := public._mansion_hw(lv); hd int := public._mansion_hd(lv); w jsonb; out_o jsonb := '[]'::jsonb; out_w jsonb := '[]'::jsonb; out_d jsonb := '[]'::jsonb; out_n jsonb := '[]'::jsonb; x0 numeric; z0 numeric; x1 numeric; z1 numeric; fl text; wp text; seen text[] := '{}'; k text;
begin
  if c is null or jsonb_typeof(c) <> 'object' then raise exception '格局資料不對'; end if;
  if jsonb_array_length(coalesce(c->'walls', '[]')) + jsonb_array_length(coalesce(c->'wins', '[]')) > 500 or jsonb_array_length(coalesce(c->'doors', '[]')) > 60 then raise exception '牆或門太多了'; end if;
  for w in select * from jsonb_array_elements(coalesce(c->'walls', '[]') || coalesce(c->'wins', '[]')) loop
    x0 := (w->>0)::numeric; z0 := (w->>1)::numeric; x1 := (w->>2)::numeric; z1 := (w->>3)::numeric;
    if x0 <> round(x0) or z0 <> round(z0) or x1 <> round(x1) or z1 <> round(z1) or abs(x1 - x0) + abs(z1 - z0) <> 1 or least(x0, x1) < -hw or greatest(x0, x1) > hw or least(z0, z1) < -hd or greatest(z0, z1) > hd then raise exception '牆要畫在格線上、房子裡面'; end if;
  end loop;
  for w in select * from jsonb_array_elements(coalesce(c->'walls', '[]')) loop k := (w->>0) || (w->>1) || (w->>2) || (w->>3);
    if ((w->>0)::numeric = (w->>2)::numeric and abs((w->>0)::numeric) = hw) or ((w->>1)::numeric = (w->>3)::numeric and abs((w->>1)::numeric) = hd) or k = any(seen) then continue; end if; seen := seen || k; out_w := out_w || jsonb_build_array(w); end loop;
  for w in select * from jsonb_array_elements(coalesce(c->'wins', '[]')) loop k := (w->>0) || (w->>1) || (w->>2) || (w->>3); if k = any(seen) then continue; end if; seen := seen || k;
    if ((w->>0)::numeric = (w->>2)::numeric and abs((w->>0)::numeric) = hw) or ((w->>1)::numeric = (w->>3)::numeric and abs((w->>1)::numeric) = hd) then out_o := out_o || jsonb_build_array(w); else out_n := out_n || jsonb_build_array(w); end if; end loop;
  for w in select * from jsonb_array_elements(coalesce(c->'doors', '[]')) loop
    x0 := (w->>0)::numeric; z0 := (w->>1)::numeric;
    if not ((x0 = round(x0) and z0 - floor(z0) = 0.5) or (z0 = round(z0) and x0 - floor(x0) = 0.5)) or abs(x0) >= hw or abs(z0) >= hd then raise exception '門要放在格線上、房子裡面'; end if;
    out_d := out_d || jsonb_build_array(jsonb_build_array(x0, z0));
  end loop;
  fl := coalesce(c->>'fl', repeat('0', 540)); wp := coalesce(c->>'wp', repeat('0', 540));
  if fl !~ '^[0-5]+$' or wp !~ '^[0-4]+$' or length(fl) not in (216, 540) or length(wp) not in (216, 540) then raise exception '地板或壁紙的資料不對'; end if;
  fl := public._cl_grid(fl); wp := public._cl_grid(wp);
  if jsonb_array_length(out_o) > 60 then raise exception '窗戶太多了'; end if;
  return jsonb_build_object('walls', out_w, 'doors', out_d, 'wins', out_n, 'owins', out_o, 'fl', fl, 'wp', wp);
end $$;

create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow public.players; isl jsonb; items jsonb; info record; fi record; nid integer; h jsonb; f jsonb; lay jsonb; nl jsonb;
  cost integer := 0; hid integer; fid integer; t text; o jsonb; x jsonb; keep jsonb; rk integer; me_t text; ow_t text; refund jsonb := '{}'::jsonb; k text; amt integer; payer text; lv integer; up integer; pk integer; ff jsonb;
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
    if t in ('cabin', 'beach', 'villa', 'tea') then raise exception '這種房子已經不賣了，現在只有大宅（可以擴建、加蓋二樓三樓）'; end if;
    if jsonb_array_length(items) >= 60 then raise exception '島上已經放滿了'; end if;
    if info.house and (select count(*) from jsonb_array_elements(items) e where (public._isle_item(e->>'t')).house) >= 6 then raise exception '房子最多 6 棟'; end if;
    perform public._isle_check(items, t, (p->>'x')::numeric, (p->>'z')::numeric, -1);
    cost := info.price;
    select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(items) e;
    items := items || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2), 'by', me_t)
      || case when t = 'mansion' then jsonb_build_object('lay', 'custom', 'f', '[]'::jsonb, 'cl', public._cl_default(), 'lv', 1, 'loan', 0, 'up', 0) else '{}'::jsonb end);
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
    if coalesce((o->>'loan')::int, 0) > 0 then raise exception '這棟房子還有擴建貸款沒還清，先還完才能拆'; end if;
    refund := public._refund_add(refund, payer, (case when o->>'t' = 'mansion' and not (o ? 'lv') then 12000 else (public._isle_item(o->>'t')).price end) / 2);   -- 以前買的大宅是 12000
    if o->>'t' = 'mansion' and o ? 'lv' then refund := public._refund_add(refund, payer, public._mansion_paid((o->>'lv')::int) / 2); end if;   -- 擴建花的錢也退一半
    if o->>'t' = 'mansion' then refund := public._refund_add(refund, payer, public._floor_paid(coalesce((o->>'up')::int, 0)) / 2); end if;   -- 加蓋的樓層也退一半
    if o ? 'f' then   -- 拆房子：裡面的家具各自退一半給付錢的人
      for x in select * from jsonb_array_elements(o->'f') loop refund := public._refund_add(refund, coalesce(x->>'by', ow_t), coalesce((public._furn(x->>'t')).price, 0) / 2); end loop;
    end if;
    if o ? 'lay' then refund := public._refund_add(refund, coalesce(o->>'lby', payer), coalesce((public._home_lay(o->>'lay')->>'price')::int, 0) / 2); end if;
    items := coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where (e->>'id')::int <> (p->>'id')::int), '[]'::jsonb);
  elsif p_op in ('layout', 'fplace', 'fmove', 'fremove', 'bed', 'design', 'expand', 'repay', 'floor', 'deco') then
    hid := (p->>'house')::int;
    select e into h from jsonb_array_elements(items) e where (e->>'id')::int = hid;
    if h is null or not (public._isle_item(h->>'t')).house then raise exception '找不到這棟房子'; end if;
    f := coalesce(h->'f', case when h->>'t' = 'mansion' then '[]'::jsonb else public._home_def() end); lv := coalesce((h->>'lv')::int, 5); up := coalesce((h->>'up')::int, 0); lay := case when h->>'t' = 'mansion' then public._custom_lay2(h->'cl', lv) else public._home_lay(coalesce(h->>'lay', 'open')) end;
    if p_op in ('layout', 'design') and rk < 2 then raise exception '只有島主、共同島主、管理成員可以改格局'; end if;
    if p_op = 'layout' and (h->>'t' = 'mansion') then raise exception '大宅的格局要用「設計格局」自己畫'; end if;
    if p_op = 'expand' then   -- 擴建：跟村長借錢（不收利息），房間馬上變大；還清以前不能再擴建
      if h->>'t' <> 'mansion' then raise exception '只有大宅可以擴建'; end if;
      if rk < 2 then raise exception '只有島主、共同島主、管理成員可以擴建'; end if;
      if lv >= 8 then raise exception '已經擴建到最大了'; end if;
      if coalesce((h->>'loan')::int, 0) > 0 then raise exception '上一次的擴建貸款還沒還清'; end if;
      h := h || jsonb_build_object('lv', lv + 1, 'loan', public._mansion_cost(lv + 1));
    elsif p_op = 'floor' then   -- 加蓋樓層（二樓、三樓）：一樣跟村長借錢
      if h->>'t' <> 'mansion' then raise exception '只有大宅可以加蓋樓層'; end if;
      if rk < 2 then raise exception '只有島主、共同島主、管理成員可以加蓋'; end if;
      if up >= 2 then raise exception '最多蓋到三樓'; end if;
      if coalesce((h->>'loan')::int, 0) > 0 then raise exception '上一次的貸款還沒還清'; end if;
      if up = 0 then   -- 第一次蓋樓梯：一樓後面兩個角落要空出來
        for o in select * from jsonb_array_elements(f) loop
          if coalesce((o->>'k')::int, 0) = 0 and public._stair_hit(lv, (o->>'x')::numeric, (o->>'z')::numeric) then raise exception '一樓後面兩個角落要蓋樓梯，先把那裡的家具移開'; end if;
        end loop;
      end if;
      h := h || jsonb_build_object('up', up + 1, 'loan', public._floor_cost(up + 1));
    elsif p_op = 'deco' then   -- 每一層樓的地板、壁紙（免費換）
      if rk < 2 then raise exception '只有島主、共同島主、管理成員可以換地板壁紙'; end if;
      pk := greatest(0, least(up, coalesce((p->>'k')::int, 0)));
      if coalesce((p->>'fl')::int, -1) not between 0 and 5 or coalesce((p->>'wp')::int, -1) not between 0 and 4 then raise exception '沒有這種地板或壁紙'; end if;
      ff := coalesce(h->'dc', '[]'::jsonb); while jsonb_array_length(ff) < 3 loop ff := ff || jsonb_build_array(jsonb_build_array(-1, -1)); end loop;
      ff := jsonb_set(ff, array[pk::text], jsonb_build_array((p->>'fl')::int, (p->>'wp')::int));
      h := h || jsonb_build_object('dc', ff);
    elsif p_op = 'repay' then   -- 還擴建貸款：住在島上的人都可以幫忙還（錢從還的人身上扣）
      amt := least(coalesce((h->>'loan')::int, 0), greatest(0, coalesce((p->>'amount')::int, 0)));
      if amt <= 0 then raise exception '沒有要還的錢'; end if;
      cost := amt; h := h || jsonb_build_object('loan', coalesce((h->>'loan')::int, 0) - amt);
    elsif p_op = 'design' then
      if h->>'t' <> 'mansion' then raise exception '只有大宅可以自己設計格局'; end if;
      nl := public._cl_check2(p->'cl', lv); lay := public._custom_lay2(nl, lv);
      keep := '[]'::jsonb;
      for o in select * from jsonb_array_elements(f) loop   -- 放不下的家具收起來，退一半給付錢的人（樓上的家具不受影響）
        if coalesce((o->>'k')::int, 0) > 0 then keep := keep || jsonb_build_array(o); continue; end if;
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
      pk := case when h->>'t' = 'mansion' then greatest(0, least(up, coalesce((p->>'k')::int, 0))) else 0 end;
      ff := coalesce((select jsonb_agg(e) from jsonb_array_elements(f) e where coalesce((e->>'k')::int, 0) = pk), '[]'::jsonb);
      if jsonb_array_length(ff) >= 40 then raise exception '這一層已經擺滿了'; end if;
      if pk > 0 then lay := public._custom_lay2('{}'::jsonb, lv); end if;
      if up > 0 and public._stair_hit(lv, (p->>'x')::numeric, (p->>'z')::numeric) then raise exception '會擋住樓梯'; end if;
      perform public._furn_check(lay, ff, t, (p->>'x')::numeric, (p->>'z')::numeric, -1);
      cost := fi.price;
      select coalesce(max((e->>'id')::int), 0) + 1 into nid from jsonb_array_elements(f) e;
      h := h || jsonb_build_object('f', f || jsonb_build_array(jsonb_build_object('id', nid, 't', t, 'x', round((p->>'x')::numeric, 2), 'z', round((p->>'z')::numeric, 2), 'r', round(coalesce((p->>'r')::numeric, 0), 2), 'by', me_t) || case when pk > 0 then jsonb_build_object('k', pk) else '{}'::jsonb end));
    elsif p_op = 'fmove' then
      fid := (p->>'id')::int; select e into o from jsonb_array_elements(f) e where (e->>'id')::int = fid;
      if o is null then raise exception '找不到這個家具'; end if;
      if rk < 2 and coalesce(o->>'by', ow_t) <> me_t then raise exception '一般成員只能移動自己買的家具'; end if;
      pk := coalesce((o->>'k')::int, 0);
      ff := coalesce((select jsonb_agg(e) from jsonb_array_elements(f) e where coalesce((e->>'k')::int, 0) = pk), '[]'::jsonb);
      if pk > 0 then lay := public._custom_lay2('{}'::jsonb, lv); end if;
      if up > 0 and public._stair_hit(lv, (p->>'x')::numeric, (p->>'z')::numeric) then raise exception '會擋住樓梯'; end if;
      perform public._furn_check(lay, ff, o->>'t', (p->>'x')::numeric, (p->>'z')::numeric, fid);
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

select '大宅大改完成：可以擴建到 30×18、加蓋到三樓 🏗️' as result;
