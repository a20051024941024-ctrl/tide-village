-- 233（第 1 段，共 3 段）潮汐釣魚村 v867：材料、阿鐵工坊新配方。可以重複執行。第 2 段是 234_craft_gear.sql，第 3 段是 235_item_market.sql。
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
--   集章、排位賽季送的、以後付費的造型都不在 _craft_recipe 裡，所以不能賣。
alter table public.players add column if not exists rod_dur jsonb not null default '{}'::jsonb;
alter table public.craft_log add column if not exists ng integer not null default 0;
create table if not exists public.mat_log (uid uuid not null, day date not null, src text not null, n integer not null default 0, primary key (uid, day, src));
alter table public.mat_log enable row level security;

/* 加減 bait 裡的一個數量（不會小於 0，最多 999） */
create or replace function public._bag_add(b jsonb, k text, n integer) returns jsonb language sql immutable as $$
  select jsonb_set(coalesce(b, '{}'::jsonb), array[k], to_jsonb(greatest(0, least(999, coalesce((b ->> k)::integer, 0) + n)))) $$;

/* 配方：c 金幣、n 幾條魚、r 魚的稀有度、m 材料、kind（own＝放進 owned、一人一個；gear＝有品質的消耗品；item＝數量；bait＝魚餌） */
create or replace function public._craft_recipe(p text) returns jsonb language sql immutable as $$
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
  select case when public._craft_recipe(p) ->> 'kind' = 'own' then public._craft_recipe(p) else null end $$;

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
declare pl public.players := public._me(); d jsonb := public._craft_recipe(p_id); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; ng integer; b jsonb; e record; q integer := 0; rnd double precision; short text;
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

do $$ declare f text; begin
  foreach f in array array['craft_item(text)', 'craft_bait(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_bag_add(jsonb,text,integer)', '_craft_recipe(text)', '_take_fish(public.players,integer,text)', '_mat_short(jsonb,jsonb)', '_mat_name(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public._craft_def(text) to authenticated;
