-- 233 潮汐釣魚村 v867：材料、阿鐵工坊用材料做東西、浮標和路亞、釣竿耐久度、市集賣材料／裝備／造型（可以重複執行）
-- 作者 11/26：「收集材料丟到市場賣的玩法」「裝備不會賣不就只會賣一次」「把阿鐵那邊原本的商品一起融合進去」→ 選了「照你建議」。
--
-- 東西都放在 players.bait（jsonb，跟魚餌、造景材料一樣）：
--   材料：mat_shell 貝殼、mat_net 舊漁網、mat_wood 漂流木、mat_coral 珊瑚碎片、mat_scale 魚鱗、mat_pink 粉紅貝
--   裝備：gf_1/gf_2/gf_3 貝殼浮標（普通／精良／極品）、gl_1/gl_2/gl_3 魚鱗路亞、g_repair 修竿包
--   裝著的：eq_float、eq_lure（0＝沒裝，1～3＝哪個品質）
-- 釣竿耐久度：players.rod_dur（{竿的 id: 0～100}，沒寫＝100）。只會變少（rod_wear），用修竿包補（rod_repair）。
-- 材料怎麼來：
--   海邊撿垃圾（pick_litter 成功後馬上叫 mat_bonus('litter')）、潛水撿垃圾（dive_pick 成功後叫 mat_bonus('dive')）→ 有機會多撿到一樣材料
--   魚分解成魚鱗（mat_scale）；第一次打開工坊送一包入門材料（mats_starter）
-- 阿鐵的工坊（craft_item、craft_bait）：原本的東西照做，配方改成「金幣＋少一點魚＋材料」；新東西只用材料。修竿包也可以直接付 🪙300 買（g_repair_c）。
-- 普通浮標、普通假餌不是東西：沒裝（eq_float／eq_lure = 0）就是用普通的，免費、不會弄丟。
-- 市集（item_market）：材料、浮標／路亞／修竿包、工坊做的造型（竿子造型、釣線顏色、鉤子）可以賣。
--   集章、排位賽季送的、以後付費的造型都不在 _recipe 裡，所以不能賣。
alter table public.players add column if not exists rod_dur jsonb not null default '{}'::jsonb;
alter table public.craft_log add column if not exists ng integer not null default 0;
create table if not exists public.mat_log (uid uuid not null, day date not null, src text not null, n integer not null default 0, primary key (uid, day, src));
alter table public.mat_log enable row level security;

/* 加減 bait 裡的一個數量（不會小於 0，最多 999） */
create or replace function public._bag_add(b jsonb, k text, n integer) returns jsonb language sql immutable as $$
  select jsonb_set(coalesce(b, '{}'::jsonb), array[k], to_jsonb(greatest(0, least(999, coalesce((b ->> k)::integer, 0) + n)))) $$;

/* 配方：c 金幣、n 幾條魚、r 魚的稀有度、m 材料、kind（own＝放進 owned、一人一個；gear＝有品質的消耗品；item＝數量；bait＝魚餌） */
create or replace function public._recipe(p text) returns jsonb language sql immutable as $$
  select (case p
    when 'rs_bamboo'  then '{"c":400,"n":1,"r":"常見","m":{"wood":2},"kind":"own"}'
    when 'rs_wood'    then '{"c":500,"n":1,"r":"常見","m":{"wood":3},"kind":"own"}'
    when 'rs_stripe'  then '{"c":800,"n":2,"r":"常見","m":{"wood":2,"shell":2},"kind":"own"}'
    when 'rs_wave'    then '{"c":1200,"n":2,"r":"常見","m":{"shell":3,"coral":1},"kind":"own"}'
    when 'rs_coral'   then '{"c":1200,"n":2,"r":"常見","m":{"coral":3,"shell":1},"kind":"own"}'
    when 'rs_carbon'  then '{"c":2000,"n":1,"r":"稀有","m":{"net":3,"scale":3},"kind":"own"}'
    when 'rs_gold'    then '{"c":4000,"n":2,"r":"稀有","m":{"scale":5,"pink":1},"kind":"own"}'
    when 'rs_rainbow' then '{"c":6000,"n":2,"r":"稀有","m":{"coral":4,"scale":3,"pink":1},"kind":"own"}'
    when 'rs_carve'   then '{"c":800,"n":2,"r":"常見","m":{"wood":6,"scale":4},"kind":"own"}'
    when 'rs_pinkglow' then '{"c":1500,"n":2,"r":"稀有","m":{"pink":3,"coral":4,"shell":4},"kind":"own"}'
    when 'lc_red'     then '{"c":200,"n":1,"r":"常見","m":{"net":1},"kind":"own"}'
    when 'lc_yellow'  then '{"c":200,"n":1,"r":"常見","m":{"net":1},"kind":"own"}'
    when 'lc_green'   then '{"c":300,"n":1,"r":"常見","m":{"net":1,"scale":1},"kind":"own"}'
    when 'lc_pink'    then '{"c":300,"n":1,"r":"常見","m":{"net":1,"shell":1},"kind":"own"}'
    when 'lc_blue'    then '{"c":800,"n":1,"r":"稀有","m":{"net":2,"coral":1},"kind":"own"}'
    when 'lc_gold'    then '{"c":1500,"n":1,"r":"稀有","m":{"net":2,"scale":3},"kind":"own"}'
    when 'hk_barb'    then '{"c":600,"n":1,"r":"常見","m":{"net":1,"scale":2},"kind":"own"}'
    when 'hk_circle'  then '{"c":1500,"n":1,"r":"稀有","m":{"net":1,"scale":3},"kind":"own"}'
    when 'hk_forge'   then '{"c":2500,"n":2,"r":"稀有","m":{"net":2,"wood":2,"scale":3},"kind":"own"}'
    when 'hk_gold'    then '{"c":5000,"n":2,"r":"稀有","m":{"scale":6,"pink":1},"kind":"own"}'
    when 'gf'         then '{"c":20,"n":0,"m":{"shell":3,"wood":1,"net":1},"kind":"gear"}'
    when 'gl'         then '{"c":30,"n":0,"m":{"scale":4,"shell":1,"net":1},"kind":"gear"}'
    when 'g_repair'   then '{"c":50,"n":0,"m":{"net":2,"wood":2,"scale":2},"kind":"item"}'
    when 'g_repair_c' then '{"c":300,"n":0,"m":{},"kind":"item","give":"g_repair"}'   /* 不想撿材料：直接付錢跟阿鐵買一個修竿包 */
    when 'live'       then '{"c":30,"n":1,"r":"常見","m":{"scale":1},"kind":"bait"}'
    else null end)::jsonb $$;

/* 舊的 _craft_def 也改成看新配方（別的地方還有在用，例如市集判斷能不能賣） */
create or replace function public._craft_def(p text) returns jsonb language sql immutable as $$
  select case when public._recipe(p) ->> 'kind' = 'own' then public._recipe(p) else null end $$;

/* 用掉魚缸裡最輕的 n 條某稀有度的魚（不碰收藏、展示中、變種）；不夠回 null */
create or replace function public._take_fish(pl public.players, n integer, r text) returns text[] language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := public._fishcfg(); use text[];
begin
  if n <= 0 then return array[]::text[]; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where coalesce(cfg->'fish'->(x->>'f')->>'r', (select rarity from public.fish_species where id = x->>'f'), '常見') = r
      and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit n) q;
  if coalesce(array_length(use, 1), 0) < n then return null; end if;
  return use;
end $$;

/* 材料夠不夠：回傳缺的第一樣（夠就 null） */
create or replace function public._mat_short(b jsonb, m jsonb) returns text language sql immutable as $$
  select k from jsonb_each_text(coalesce(m, '{}'::jsonb)) e(k, v) where coalesce((b ->> ('mat_' || k))::integer, 0) < v::integer limit 1 $$;
create or replace function public._mat_name(k text) returns text language sql immutable as $$
  select case k when 'shell' then '貝殼' when 'net' then '舊漁網' when 'wood' then '漂流木' when 'coral' then '珊瑚碎片' when 'scale' then '魚鱗' when 'pink' then '粉紅貝' else k end $$;

create or replace function public.craft_item(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d jsonb := public._recipe(p_id); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; ng integer; b jsonb; e record; q integer := 0; rnd double precision; short text;
begin
  if d is null or d ->> 'kind' = 'bait' then raise exception '阿鐵師傅不會做這個'; end if;
  select * into pl from public.players where id = pl.id for update;
  if d ->> 'kind' = 'own' and p_id = any(pl.owned) then raise exception '你已經有了'; end if;
  if pl.coins < (d->>'c')::integer then raise exception '金幣不夠'; end if;
  select n, craft_log.ng into cnt, ng from public.craft_log where uid = pl.id and day = td;
  if d ->> 'kind' = 'own' and coalesce(cnt, 0) >= 10 then raise exception '阿鐵師傅今天做累了，明天再來'; end if;
  if d ->> 'kind' <> 'own' and coalesce(ng, 0) >= 30 then raise exception '今天做夠多了，明天再來（浮標、路亞、修竿包一天最多 30 個）'; end if;
  short := public._mat_short(pl.bait, d->'m'); if short is not null then raise exception '材料不夠：還缺%', public._mat_name(short); end if;
  use := public._take_fish(pl, coalesce((d->>'n')::integer, 0), coalesce(d->>'r', '常見'));
  if use is null then raise exception '魚不夠：要 % 條%的魚（收藏、展示中的不算）', d->>'n', d->>'r'; end if;
  b := coalesce(pl.bait, '{}'::jsonb);
  for e in select k, v::integer as v from jsonb_each_text(d->'m') t(k, v) loop b := public._bag_add(b, 'mat_' || e.k, -e.v); end loop;
  if d ->> 'kind' = 'gear' then rnd := random(); q := case when rnd < 0.05 then 3 when rnd < 0.30 then 2 else 1 end; b := public._bag_add(b, p_id || '_' || q, 1);
    if coalesce((b ->> ('eq_' || case p_id when 'gf' then 'float' else 'lure' end))::integer, 0) = 0 then b := jsonb_set(b, array['eq_' || case p_id when 'gf' then 'float' else 'lure' end], to_jsonb(q)); end if;   /* 第一次做好的直接裝上 */
  elsif d ->> 'kind' = 'item' then b := public._bag_add(b, coalesce(d->>'give', p_id), 1); end if;
  update public.players set coins = coins - (d->>'c')::integer, bait = b,
    owned = case when d ->> 'kind' = 'own' then array_append(owned, p_id) else owned end,
    tank = case when array_length(use, 1) > 0 then coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb) else tank end,
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n, ng) values (pl.id, td, case when d ->> 'kind' = 'own' then 1 else 0 end, case when d ->> 'kind' = 'own' then 0 else 1 end)
    on conflict (uid, day) do update set n = public.craft_log.n + excluded.n, ng = public.craft_log.ng + excluded.ng;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use), 'q', q);
end $$;

/* 活餌也照新配方（🪙30＋常見魚 1＋魚鱗 1 → 4 個）；秋刀魚切塊不變 */
create or replace function public.craft_bait(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer;
  need integer; cost integer; pack integer := 4; sc integer := 0;
begin
  if p_id not in ('live', 'saurychunk') then raise exception '阿鐵師傅不會做這種餌'; end if;
  need := 1; cost := case p_id when 'live' then 30 else 20 end; sc := case p_id when 'live' then 1 else 0 end;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  if coalesce((pl.bait ->> 'mat_scale')::integer, 0) < sc then raise exception '材料不夠：還缺魚鱗'; end if;
  select nb into cnt from public.craft_log where uid = pl.id and day = td;
  if coalesce(cnt, 0) >= 8 then raise exception '魚餌今天做夠多了，明天再來'; end if;
  if coalesce((pl.bait ->> p_id)::integer, 0) >= 99 then raise exception '這種餌已經很多了，先用掉一些'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where (case when p_id = 'live' then coalesce(cfg->'fish'->(x->>'f')->>'r', '常見') = '常見' and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false)
                else x->>'f' = 'saury' end)
      and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit need) q;
  if coalesce(array_length(use, 1), 0) < need then raise exception '%', case when p_id = 'live' then '魚不夠：要 1 條常見的魚（收藏、展示中的不算）' else '要 1 條秋刀魚（收藏、展示中的不算）' end; end if;
  update public.players set coins = coins - cost,
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    bait = public._bag_add(jsonb_set(coalesce(bait, '{}'::jsonb), array[p_id], to_jsonb(least(99, coalesce((bait ->> p_id)::integer, 0) + pack))), 'mat_scale', -sc),
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n, nb) values (pl.id, td, 0, 1) on conflict (uid, day) do update set nb = public.craft_log.nb + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use));
end $$;

/* 撿垃圾（海邊或潛水）成功後馬上叫：有機會多撿到一樣材料。一天最多：海邊 15 樣、潛水 12 樣；而且不會比今天撿的垃圾多 */
create or replace function public.mat_bonus(p_src text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; cap integer; picks integer; x double precision; k text;
begin
  if p_src = 'litter' then
    if pl.litter_at is null or now() - pl.litter_at > interval '6 seconds' then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
    picks := case when pl.litter_day = td then pl.litter_n else 0 end; cap := 15;
  elsif p_src = 'dive' then
    if pl.dive_pick_at is null or now() - pl.dive_pick_at > interval '6 seconds' then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
    picks := case when pl.dive_day = td then pl.dive_trash else 0 end; cap := 12;
  else raise exception '沒有這種地方'; end if;
  select n into cnt from public.mat_log where uid = pl.id and day = td and src = p_src;
  if coalesce(cnt, 0) >= least(cap, picks) then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
  x := random();
  k := case when p_src = 'litter' then (case when x < 0.32 then 'shell' when x < 0.52 then 'net' when x < 0.70 then 'wood' when x < 0.73 then 'pink' else null end)
            else (case when x < 0.38 then 'coral' when x < 0.55 then 'net' when x < 0.62 then 'shell' when x < 0.66 then 'pink' else null end) end;
  insert into public.mat_log (uid, day, src, n) values (pl.id, td, p_src, 1) on conflict (uid, day, src) do update set n = public.mat_log.n + 1;
  if k is null then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
  update public.players set bait = public._bag_add(bait, 'mat_' || k, 1), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'got', k);
end $$;

/* 把魚分解成魚鱗：常見 1、稀有 3、傳說 8。用最輕的、不碰收藏／展示中／變種。一天最多分解 40 條 */
create or replace function public.mat_scale(p_r text, p_n integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; use text[]; per integer;
begin
  if p_r not in ('常見', '稀有', '傳說') or p_n is null or p_n < 1 or p_n > 20 then raise exception '一次可以分解 1～20 條'; end if;
  select * into pl from public.players where id = pl.id for update;
  select n into cnt from public.mat_log where uid = pl.id and day = td and src = 'scale';
  if coalesce(cnt, 0) + p_n > 40 then raise exception '今天分解夠多了（一天最多 40 條），明天再來'; end if;
  use := public._take_fish(pl, p_n, p_r); if use is null then raise exception '魚不夠：要 % 條%的魚（收藏、展示中、變種的不算）', p_n, p_r; end if;
  per := case p_r when '常見' then 1 when '稀有' then 3 else 8 end;
  update public.players set bait = public._bag_add(bait, 'mat_scale', per * p_n),
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.mat_log (uid, day, src, n) values (pl.id, td, 'scale', p_n) on conflict (uid, day, src) do update set n = public.mat_log.n + p_n;
  return jsonb_build_object('player', to_jsonb(pl), 'got', per * p_n);
end $$;

/* 入門材料包：每個人一次（夠做 2～3 樣東西） */
create or replace function public.mats_starter() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); b jsonb;
begin
  select * into pl from public.players where id = pl.id for update;
  if coalesce((pl.bait ->> 'mat_starter')::integer, 0) = 1 then return jsonb_build_object('player', to_jsonb(pl), 'got', false); end if;
  b := coalesce(pl.bait, '{}'::jsonb);
  b := public._bag_add(b, 'mat_shell', 6); b := public._bag_add(b, 'mat_net', 3); b := public._bag_add(b, 'mat_wood', 4);
  b := public._bag_add(b, 'mat_coral', 3); b := public._bag_add(b, 'mat_scale', 6); b := public._bag_add(b, 'mat_pink', 1);
  b := jsonb_set(b, '{mat_starter}', '1');
  update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'got', true);
end $$;

/* 裝上／拿下浮標或路亞（p_q 0＝拿下） */
create or replace function public.gear_equip(p_kind text, p_q integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pre text;
begin
  if p_kind not in ('float', 'lure') or p_q is null or p_q < 0 or p_q > 3 then raise exception '不能這樣裝'; end if;
  pre := case p_kind when 'float' then 'gf_' else 'gl_' end;
  if p_q > 0 and coalesce((pl.bait ->> (pre || p_q))::integer, 0) < 1 then raise exception '你沒有這個'; end if;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array['eq_' || p_kind], to_jsonb(p_q)), updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

/* 拉斷線：裝著的浮標或路亞少一個；用完了自動換成還有的（先換好的） */
create or replace function public.gear_lose(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pre text; q integer; b jsonb; nq integer := 0; i integer;
begin
  if p_kind not in ('float', 'lure') then raise exception '沒有這種東西'; end if;
  select * into pl from public.players where id = pl.id for update;
  pre := case p_kind when 'float' then 'gf_' else 'gl_' end; q := coalesce((pl.bait ->> ('eq_' || p_kind))::integer, 0);
  if q = 0 or coalesce((pl.bait ->> (pre || q))::integer, 0) < 1 then return jsonb_build_object('player', to_jsonb(pl), 'lost', 0); end if;
  b := public._bag_add(pl.bait, pre || q, -1);
  if coalesce((b ->> (pre || q))::integer, 0) > 0 then nq := q; else for i in reverse 3..1 loop if coalesce((b ->> (pre || i))::integer, 0) > 0 then nq := i; exit; end if; end loop; end if;
  b := jsonb_set(b, array['eq_' || p_kind], to_jsonb(nq));
  update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'lost', q, 'next', nq);
end $$;

/* 釣竿磨損：只會變少。一次最多 -10 */
create or replace function public.rod_wear(p_rod text, p_n integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cur integer;
begin
  if p_rod is null or not (p_rod = any(pl.rods)) or p_n is null or p_n < 1 or p_n > 10 then return to_jsonb(pl); end if;
  cur := coalesce((pl.rod_dur ->> p_rod)::integer, 100);
  update public.players set rod_dur = jsonb_set(coalesce(rod_dur, '{}'::jsonb), array[p_rod], to_jsonb(greatest(0, cur - p_n))), updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

/* 用修竿包：耐久度 +40（最多 100） */
create or replace function public.rod_repair(p_rod text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cur integer;
begin
  select * into pl from public.players where id = pl.id for update;
  if p_rod is null or not (p_rod = any(pl.rods)) then raise exception '你沒有這支竿'; end if;
  if coalesce((pl.bait ->> 'g_repair')::integer, 0) < 1 then raise exception '沒有修竿包（阿鐵師傅的工坊可以做，或到市集買）'; end if;
  cur := coalesce((pl.rod_dur ->> p_rod)::integer, 100); if cur >= 100 then raise exception '這支竿還好好的，不用修'; end if;
  update public.players set bait = public._bag_add(bait, 'g_repair', -1), rod_dur = jsonb_set(coalesce(rod_dur, '{}'::jsonb), array[p_rod], to_jsonb(least(100, cur + 40))), updated_at = now()
    where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

/* ================= 市集：材料、裝備、造型 ================= */
create table if not exists public.item_market (
  id          bigserial primary key,
  seller      uuid not null,
  seller_name text not null,
  kind        text not null check (kind in ('mat', 'gear', 'skin')),
  key         text not null,               -- mat_shell／gf_3／g_repair／rs_wave …
  qty         integer not null check (qty >= 0),
  price       integer not null check (price > 0),   -- 一個的價錢
  status      text not null default 'open' check (status in ('open', 'sold', 'cancel', 'expired')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists item_market_open on public.item_market (kind, status, price);
create index if not exists item_market_seller on public.item_market (seller, status);
alter table public.item_market enable row level security;

/* 這個東西能不能擺：回傳 kind（mat／gear／skin），不能就 null */
create or replace function public._item_kind(k text) returns text language sql immutable as $$
  select case when k in ('mat_shell', 'mat_net', 'mat_wood', 'mat_coral', 'mat_scale', 'mat_pink') then 'mat'
    when k in ('gf_1', 'gf_2', 'gf_3', 'gl_1', 'gl_2', 'gl_3', 'g_repair') then 'gear'
    when public._recipe(k) ->> 'kind' = 'own' then 'skin' else null end $$;

/* 擺 3 天沒賣掉：退回給賣家 */
create or replace function public._item_expire() returns void language plpgsql security definer set search_path = public as $$
declare r public.item_market;
begin
  for r in select * from public.item_market where status = 'open' and created_at < now() - interval '3 days' for update skip locked loop
    if r.kind = 'skin' then update public.players set owned = case when r.key = any(owned) then owned else array_append(owned, r.key) end where id = r.seller;
    else update public.players set bait = public._bag_add(bait, r.key, r.qty) where id = r.seller; end if;
    update public.item_market set status = 'expired', done_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public.item_list(p_key text, p_qty integer, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text := public._item_kind(p_key); b jsonb; m public.item_market;
begin
  if k is null then raise exception '這個不能拿到市集賣'; end if;
  if p_price is null or p_price < 1 or p_price > 99999 then raise exception '價錢要在 1～99999 之間'; end if;
  if k = 'skin' then p_qty := 1; end if;
  if p_qty is null or p_qty < 1 or p_qty > 99 then raise exception '一次可以擺 1～99 個'; end if;
  perform public._item_expire();
  select * into pl from public.players where id = pl.id for update;
  if (select count(*) from public.item_market where seller = pl.id and status = 'open') >= 8 then raise exception '同時最多擺 8 樣'; end if;
  if k = 'skin' then
    if not (p_key = any(pl.owned)) then raise exception '你沒有這個造型'; end if;
    if p_key in (coalesce(pl.rod_skin, ''), coalesce(pl.line_col, ''), coalesce(pl.hook, '')) then raise exception '正在用的要先拿下來才能賣'; end if;
    update public.players set owned = array_remove(owned, p_key), updated_at = now() where id = pl.id returning * into pl;
  else
    if coalesce((pl.bait ->> p_key)::integer, 0) < p_qty then raise exception '數量不夠'; end if;
    b := public._bag_add(pl.bait, p_key, -p_qty);
    if p_key like 'gf\__' and coalesce((b ->> 'eq_float')::integer, 0) = substr(p_key, 4)::integer and coalesce((b ->> p_key)::integer, 0) = 0 then b := jsonb_set(b, '{eq_float}', '0'); end if;
    if p_key like 'gl\__' and coalesce((b ->> 'eq_lure')::integer, 0) = substr(p_key, 4)::integer and coalesce((b ->> p_key)::integer, 0) = 0 then b := jsonb_set(b, '{eq_lure}', '0'); end if;
    update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  end if;
  insert into public.item_market (seller, seller_name, kind, key, qty, price) values (pl.id, coalesce(nullif(pl.nickname, ''), '釣客'), k, p_key, p_qty, p_price) returning * into m;
  return jsonb_build_object('player', to_jsonb(pl), 'item', to_jsonb(m));
end $$;

create or replace function public.item_browse(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._item_expire();
  return coalesce((select jsonb_agg(to_jsonb(q) - 'seller' || jsonb_build_object('mine', q.seller = auth.uid()) order by q.price, q.id) from (
    select * from public.item_market where status = 'open' and qty > 0 and (p_kind is null or kind = p_kind) order by price, id limit 80) q), '[]'::jsonb);
end $$;

create or replace function public.item_mine() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) from (
    select * from public.item_market where seller = auth.uid() and (status = 'open' or done_at > now() - interval '3 days') order by created_at desc limit 30) q $$;

create or replace function public.item_buy(p_id bigint, p_qty integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.item_market; cost integer; got integer; td date := (now() at time zone 'Asia/Taipei')::date; spent integer;
begin
  select * into m from public.item_market where id = p_id for update;
  if m.id is null or m.status <> 'open' or m.qty < 1 then raise exception '已經被買走了'; end if;
  if m.created_at < now() - interval '3 days' then raise exception '這個已經下架了'; end if;
  if m.seller = pl.id then raise exception '不能買自己擺的'; end if;
  if m.kind = 'skin' then p_qty := 1; end if;
  if p_qty is null or p_qty < 1 or p_qty > m.qty then raise exception '數量不對'; end if;
  cost := m.price * p_qty;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  spent := case when pl.design_spend_day = td then pl.design_spend else 0 end;   /* 089：新手跟其他市集共用每天 1500 的上限 */
  if (pl.created_at > now() - interval '3 days' or pl.total < 200) and spent + cost > 1500 then raise exception '新手一天在市集最多花 1500 金幣（帳號滿 3 天、釣到 200 條魚以後就沒有限制）'; end if;
  if m.kind = 'skin' then
    if m.key = any(pl.owned) then raise exception '你已經有這個造型了'; end if;
    update public.players set coins = coins - cost, owned = array_append(owned, m.key), design_spend_day = td, design_spend = spent + cost, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - cost, bait = public._bag_add(bait, m.key, p_qty), design_spend_day = td, design_spend = spent + cost, updated_at = now() where id = pl.id returning * into pl;
  end if;
  got := floor(cost * 0.95)::int;
  update public.item_market set qty = qty - p_qty, status = case when qty - p_qty <= 0 then 'sold' else 'open' end, done_at = case when qty - p_qty <= 0 then now() else done_at end where id = p_id;
  update public.players set coins = coins + got, earned = earned + got, updated_at = now() where id = m.seller;
  begin perform public._push(m.seller, 'market', '🏪 你擺的東西賣掉了！', '賣了 ' || p_qty || ' 個，你拿到 🪙' || got); exception when others then null; end;
  return jsonb_build_object('player', to_jsonb(pl), 'got', p_qty);
end $$;

create or replace function public.item_cancel(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.item_market;
begin
  select * into m from public.item_market where id = p_id for update;
  if m.id is null or m.seller <> pl.id or m.status <> 'open' then raise exception '不能收回這個'; end if;
  select * into pl from public.players where id = pl.id for update;
  if m.kind = 'skin' then update public.players set owned = case when m.key = any(owned) then owned else array_append(owned, m.key) end, updated_at = now() where id = pl.id returning * into pl;
  else update public.players set bait = public._bag_add(bait, m.key, m.qty), updated_at = now() where id = pl.id returning * into pl; end if;
  update public.item_market set status = 'cancel', done_at = now() where id = p_id;
  return jsonb_build_object('player', to_jsonb(pl));
end $$;

do $$ declare f text; begin
  foreach f in array array['craft_item(text)', 'craft_bait(text)', 'mat_bonus(text)', 'mat_scale(text,integer)', 'mats_starter()', 'gear_equip(text,integer)', 'gear_lose(text)',
    'rod_wear(text,integer)', 'rod_repair(text)', 'item_list(text,integer,integer)', 'item_browse(text)', 'item_mine()', 'item_buy(bigint,integer)', 'item_cancel(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_bag_add(jsonb,text,integer)', '_recipe(text)', '_take_fish(public.players,integer,text)', '_mat_short(jsonb,jsonb)', '_mat_name(text)', '_item_kind(text)', '_item_expire()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public._craft_def(text) to authenticated;
