-- 097 潛水艇與黑淵裂縫（v237）：可以重複執行
-- 跟蔚博士租潛水艇（Lv.15 以上、4500 金幣，租一次以後免費），開進港口外海底下的深海區；
-- 走到大陸棚盡頭會突然看到一條看不到底的「黑淵裂縫」。
-- 金幣、魚、材料全部由這裡的函式決定，手機只畫畫面：
--   sub_dive_start()           出發：開一趟新的紀錄（同時只能有一趟）
--   sub_cast(p_depth)          放線：伺服器照深度抽魚（存在 casts，跟一般釣魚一樣用 hook_fish 拿結果）
--   sub_land(p_fish, p_w)      拉上來：先放進這一趟的船艙（還不是你的）
--   sub_pick(p_kind, p_depth)  撿深海礦石、古代船錨（每趟、每天有上限）
--   sub_found()                第一次發現裂縫（成就、通知）
--   sub_dive_end(p_max_depth, p_reason)  回港：把船艙的魚放進魚缸；
--        p_max_depth 超過耐壓深度＋150 公尺（警告區）就整趟作廢；耐壓超時（pressure）船艙的魚全部不見；電池用完（battery）魚保留
--   sub_upgrade(p_kind)        升級耐壓／電池／探照燈（金幣＋特定的魚或材料）
-- 新魚：深海燈籠魚、吸血鬼烏賊（各有白化）、白化深海鮟鱇（只有潛水艇釣得到）

insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('deeplantern', '深海燈籠魚', '常見', 0.02, 0.12),
  ('deeplantern_albino', '白化深海燈籠魚', '常見', 0.02, 0.12),
  ('vampsquid', '吸血鬼烏賊', '稀有', 0.2, 0.6),
  ('vampsquid_albino', '白化吸血鬼烏賊', '稀有', 0.2, 0.6),
  ('angler_albino', '白化深海鮟鱇', '傳說', 5, 50)
on conflict (id) do nothing;

create table if not exists public.sub_state (
  owner uuid primary key references public.players(id) on delete cascade,
  unlocked boolean not null default false,
  pressure_lv integer not null default 1, battery_lv integer not null default 1, light_lv integer not null default 1,
  found_trench boolean not null default false,
  ore integer not null default 0, anchor integer not null default 0,
  max_depth integer not null default 0, updated_at timestamptz not null default now());
alter table public.sub_state enable row level security;
revoke all on public.sub_state from anon, authenticated;

create table if not exists public.sub_dives (
  id bigserial primary key, uid uuid not null references public.players(id) on delete cascade,
  started timestamptz not null default now(), ended timestamptz, active boolean not null default true,
  pressure_m integer not null, battery_s integer not null, max_depth integer not null default 0,
  hold jsonb not null default '[]'::jsonb, picks jsonb not null default '{}'::jsonb, result text);
create index if not exists sub_dives_uid on public.sub_dives (uid, started);
alter table public.sub_dives enable row level security;
revoke all on public.sub_dives from anon, authenticated;

create or replace function public._sub_pressure(lv integer) returns integer language sql immutable as $$ select case lv when 1 then 800 when 2 then 1500 else 3000 end $$;
create or replace function public._sub_battery(lv integer) returns integer language sql immutable as $$ select case lv when 1 then 300 when 2 then 480 else 720 end $$;

create or replace function public._sub_row(uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('unlocked', s.unlocked, 'pressure_lv', s.pressure_lv, 'battery_lv', s.battery_lv, 'light_lv', s.light_lv,
    'found', s.found_trench, 'ore', s.ore, 'anchor', s.anchor, 'max_depth', s.max_depth) from public.sub_state s where s.owner = uid),
    jsonb_build_object('unlocked', false, 'pressure_lv', 1, 'battery_lv', 1, 'light_lv', 1, 'found', false, 'ore', 0, 'anchor', 0, 'max_depth', 0)) $$;

create or replace function public.sub_get() returns jsonb language sql stable security definer set search_path = public as $$ select public._sub_row(auth.uid()) $$;

-- 租潛水艇：Lv.15 以上、4500 金幣，只要租一次
create or replace function public.sub_unlock() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if exists (select 1 from public.sub_state where owner = pl.id and unlocked) then return jsonb_build_object('sub', public._sub_row(pl.id), 'player', to_jsonb(pl)); end if;
  if public._level(public._xp(pl)) < 15 then raise exception '要 Lv.15 以上蔚博士才放心借你潛水艇'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < 4500 then raise exception '金幣不夠（租潛水艇要 4500 金幣）'; end if;
  update public.players set coins = coins - 4500, updated_at = now() where id = pl.id returning * into pl;
  insert into public.sub_state (owner, unlocked) values (pl.id, true) on conflict (owner) do update set unlocked = true, updated_at = now();
  return jsonb_build_object('sub', public._sub_row(pl.id), 'player', to_jsonb(pl));
end $$;

create or replace function public.sub_dive_start() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); s public.sub_state; d public.sub_dives;
begin
  select * into s from public.sub_state where owner = pl.id;
  if s.owner is null or not s.unlocked then raise exception '要先跟蔚博士租潛水艇'; end if;
  if exists (select 1 from public.sub_dives where uid = pl.id and started > now() - interval '5 seconds') then raise exception '太快了，等一下再出發'; end if;
  update public.sub_dives set active = false, ended = now(), result = 'abandoned', hold = '[]'::jsonb where uid = pl.id and active;   -- 上一趟沒回港（關掉遊戲）：船艙的魚算不見
  insert into public.sub_dives (uid, pressure_m, battery_s) values (pl.id, public._sub_pressure(s.pressure_lv), public._sub_battery(s.battery_lv)) returning * into d;
  return jsonb_build_object('id', d.id, 'pressure_m', d.pressure_m, 'battery_s', d.battery_s, 'sub', public._sub_row(pl.id));
end $$;

create or replace function public._sub_active(uid uuid) returns public.sub_dives language plpgsql security definer set search_path = public as $$
declare d public.sub_dives;
begin
  select * into d from public.sub_dives where sub_dives.uid = _sub_active.uid and active order by id desc limit 1 for update;
  if d.id is null then raise exception '你現在沒有在開潛水艇'; end if;
  if now() - d.started > make_interval(secs => d.battery_s + 60) then raise exception '電池早就沒電了，先回港'; end if;
  return d;
end $$;

-- 放線：照深度抽魚（伺服器決定，手機要等 hook_fish 才知道是什麼）
create or replace function public.sub_cast(p_depth integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; dep integer := greatest(0, coalesce(p_depth, 0));
  ids text[] := '{}'; wts numeric[] := '{}'; tot numeric := 0; r numeric; pick text; sp public.fish_species; fw numeric; i integer;
begin
  d := public._sub_active(pl.id);
  if dep > d.pressure_m + 150 or dep > 3100 then
    update public.sub_dives set active = false, ended = now(), result = 'void', hold = '[]'::jsonb, max_depth = dep where id = d.id;
    return jsonb_build_object('void', true);   -- 不用 raise（raise 會把作廢的紀錄也一起取消）
  end if;
  if dep < 200 then raise exception '這裡太淺了，深海的魚在裂縫裡'; end if;
  if exists (select 1 from public.casts where uid = pl.id and spot = 'trench' and at > now() - interval '3 seconds') then raise exception '太快了'; end if;
  update public.sub_dives set max_depth = greatest(max_depth, dep) where id = d.id;
  -- 魚池：越深越多種；皇帶魚在 1000～1600 公尺的岩壁中段，大王魷魚只在 2500 公尺以下的溝底
  for pick, r in select * from (values
      ('deeplantern', 10.0), ('deeplantern_albino', 0.12), ('vampsquid', case when dep >= 500 then 3.0 else 0 end), ('vampsquid_albino', case when dep >= 500 then 0.05 else 0 end),
      ('blobfish', case when dep >= 1200 then 3.0 else 0 end), ('blobfish_albino', case when dep >= 1200 then 0.05 else 0 end),
      ('rattail', case when dep >= 800 then 2.0 else 0 end), ('angler', case when dep >= 1000 then 0.5 else 0 end), ('angler_albino', case when dep >= 1000 then 0.012 else 0 end),
      ('oarfish', case when dep between 1000 and 1600 then 0.6 else 0 end), ('giantsquid', case when dep >= 2500 then 0.45 else 0 end)) v(f, w) loop
    if r > 0 and exists (select 1 from public.fish_species where id = pick) then ids := ids || pick; wts := wts || r; tot := tot + r; end if;
  end loop;
  r := random() * tot; pick := ids[1];
  for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
  select * into sp from public.fish_species where id = pick;
  fw := round((sp.min_w + (sp.max_w - sp.min_w) * power(random(), 1.7))::numeric, 2);
  insert into public.casts (uid, spot, fish, w, at, shown_at) values (pl.id, 'trench', pick, fw, now(), null)
    on conflict (uid) do update set spot = 'trench', fish = excluded.fish, w = excluded.w, rs = null, sex = null, brood = null, gp = null, at = now(), shown_at = null;
  return jsonb_build_object('ok', true);
end $$;

-- 拉上來：先放進船艙（回港才算你的）
create or replace function public.sub_land(p_fish text, p_w numeric) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; c public.casts;
begin
  d := public._sub_active(pl.id);
  select * into c from public.casts where uid = pl.id for update;
  if c.uid is null or c.spot is distinct from 'trench' or c.fish <> p_fish or c.w is distinct from round(p_w, 2) then raise exception '這條魚對不上伺服器'; end if;
  if now() - c.at < interval '3 seconds' then raise exception '釣太快了'; end if;
  if jsonb_array_length(d.hold) >= 20 then raise exception '船艙滿了（最多 20 條），先回港'; end if;
  delete from public.casts where uid = pl.id;
  update public.sub_dives set hold = hold || jsonb_build_array(jsonb_build_object('f', c.fish, 'w', c.w)) where id = d.id returning * into d;
  return jsonb_build_object('hold', d.hold);
end $$;

-- 溝底撿材料：深海礦石（1400 公尺以下，每趟 3 個）、古代船錨（2400 公尺以下，每天 1 個）
create or replace function public.sub_pick(p_kind text, p_depth integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; n integer; today boolean;
begin
  d := public._sub_active(pl.id);
  if p_kind not in ('ore', 'anchor') then raise exception '沒有這種東西'; end if;
  if coalesce(p_depth, 0) > d.pressure_m + 150 then raise exception '潛水艇的紀錄不對'; end if;
  if p_kind = 'ore' and coalesce(p_depth, 0) < 1400 then raise exception '深海礦石在更深的地方'; end if;
  if p_kind = 'anchor' and coalesce(p_depth, 0) < 2400 then raise exception '古代船錨在溝底'; end if;
  n := coalesce((d.picks ->> p_kind)::integer, 0);
  if p_kind = 'ore' and n >= 3 then raise exception '這一趟的礦石撿夠了（每趟 3 個）'; end if;
  if p_kind = 'anchor' and exists (select 1 from public.sub_dives where uid = pl.id and (picks ? 'anchor') and (started at time zone 'Asia/Taipei')::date = (now() at time zone 'Asia/Taipei')::date) then raise exception '今天已經撿過船錨了'; end if;
  update public.sub_dives set picks = jsonb_set(picks, array[p_kind], to_jsonb(n + 1)) where id = d.id;
  if p_kind = 'ore' then update public.sub_state set ore = ore + 1, updated_at = now() where owner = pl.id;
  else update public.sub_state set anchor = anchor + 1, updated_at = now() where owner = pl.id; end if;
  return jsonb_build_object('sub', public._sub_row(pl.id));
end $$;

create or replace function public.sub_found() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; first boolean;
begin
  d := public._sub_active(pl.id);
  update public.sub_state set found_trench = true, updated_at = now() where owner = pl.id and not found_trench returning true into first;
  if first then perform public._push(pl.id, 'sub', '你發現了黑淵裂縫', '沒有人知道它有多深。'); end if;
  return jsonb_build_object('first', coalesce(first, false), 'sub', public._sub_row(pl.id));
end $$;

-- 回港：檢查深度和時間，船艙的魚放進魚缸
create or replace function public.sub_dive_end(p_max_depth integer, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; e jsonb; sp public.fish_species; w numeric; ts bigint; why text := coalesce(p_reason, 'normal'); kept jsonb := '[]'::jsonb; dep integer := greatest(0, coalesce(p_max_depth, 0));
begin
  select * into d from public.sub_dives where uid = pl.id and active order by id desc limit 1 for update;
  if d.id is null then raise exception '你現在沒有在開潛水艇'; end if;
  dep := greatest(dep, d.max_depth);
  if dep > d.pressure_m + 150 or dep > 3100 then   -- 比耐壓深度＋警告區還深：一定是改過數字，整趟作廢
    update public.sub_dives set active = false, ended = now(), result = 'void', hold = '[]'::jsonb, max_depth = dep where id = d.id;
    return jsonb_build_object('void', true, 'kept', '[]'::jsonb, 'player', to_jsonb(pl));
  end if;
  if why not in ('normal', 'battery', 'pressure') then why := 'normal'; end if;
  if why = 'pressure' then   -- 耐壓超時被強制拉回：船艙的魚全部不見
    update public.sub_dives set active = false, ended = now(), result = 'pressure', hold = '[]'::jsonb, max_depth = dep where id = d.id;
    return jsonb_build_object('void', false, 'lost', jsonb_array_length(d.hold), 'kept', '[]'::jsonb, 'player', to_jsonb(pl));
  end if;
  select * into pl from public.players where id = pl.id for update;
  ts := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  for e in select * from jsonb_array_elements(d.hold) loop
    select * into sp from public.fish_species where id = e->>'f'; if sp.id is null then continue; end if;
    w := (e->>'w')::numeric; ts := ts + 1;
    update public.players set
      total = total + 1, legend = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
      fish_count = jsonb_set(fish_count, array[sp.id], to_jsonb(coalesce((fish_count ->> sp.id)::int, 0) + 1)),
      fish_best = case when coalesce((fish_best ->> sp.id)::numeric, 0) < w then jsonb_set(fish_best, array[sp.id], to_jsonb(w)) else fish_best end,
      best_fish = case when w > best_w then sp.id else best_fish end, best_w = greatest(best_w, w),
      tank = public._trim_tank(jsonb_build_array(jsonb_build_object('f', sp.id, 'w', w, 't', ts) || case when sp.id ~ '_albino$' then jsonb_build_object('k', true) else '{}'::jsonb end) || tank, show),
      last_fish = sp.id, last_w = w, updated_at = now()
    where id = pl.id returning * into pl;
    kept := kept || jsonb_build_array(e);
  end loop;
  update public.sub_dives set active = false, ended = now(), result = why, max_depth = dep where id = d.id;
  update public.sub_state set max_depth = greatest(max_depth, dep), updated_at = now() where owner = pl.id;
  return jsonb_build_object('void', false, 'kept', kept, 'player', to_jsonb(pl), 'sub', public._sub_row(pl.id));
end $$;

-- 升級：金幣＋特定的魚（從魚缸拿走一條，收藏、展示的不拿）或材料
--   耐壓 2 級 3000＋深海燈籠魚；3 級 8000＋水滴魚
--   電池 2 級 2000＋深海礦石 2；3 級 5000＋古代船錨 1
--   探照燈 2 級 1500＋吸血鬼烏賊；3 級 4000＋深海礦石 4
create or replace function public.sub_upgrade(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); s public.sub_state; lv integer; cost integer; need_fish text; need_ore integer := 0; need_anchor integer := 0; idx integer;
begin
  select * into s from public.sub_state where owner = pl.id for update;
  if s.owner is null or not s.unlocked then raise exception '要先跟蔚博士租潛水艇'; end if;
  lv := case p_kind when 'pressure' then s.pressure_lv when 'battery' then s.battery_lv when 'light' then s.light_lv else null end;
  if lv is null then raise exception '沒有這種升級'; end if;
  if lv >= 3 then raise exception '已經升到最高級了'; end if;
  if p_kind = 'pressure' then cost := case lv when 1 then 3000 else 8000 end; need_fish := case lv when 1 then 'deeplantern' else 'blobfish' end;
  elsif p_kind = 'battery' then cost := case lv when 1 then 2000 else 5000 end; need_ore := case lv when 1 then 2 else 0 end; need_anchor := case lv when 1 then 0 else 1 end;
  else cost := case lv when 1 then 1500 else 4000 end; need_fish := case lv when 1 then 'vampsquid' else null end; need_ore := case lv when 1 then 0 else 4 end; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠（要 % 金幣）', cost; end if;
  if s.ore < need_ore then raise exception '深海礦石不夠（要 % 個，在裂縫 1400 公尺以下撿）', need_ore; end if;
  if s.anchor < need_anchor then raise exception '要一個古代船錨（在溝底撿）'; end if;
  if need_fish is not null then
    select (o - 1)::integer into idx from jsonb_array_elements(pl.tank) with ordinality t(e, o)
      where e->>'f' = need_fish and not coalesce((e->>'k')::boolean, false) and not (coalesce(pl.show, '[]'::jsonb) @> jsonb_build_array(e->'t')) limit 1;
    if idx is null then raise exception '魚缸裡要有一條%（潛水艇在裂縫裡釣得到）', (select name from public.fish_species where id = need_fish); end if;
    update public.players set tank = tank - idx where id = pl.id;
  end if;
  update public.players set coins = coins - cost, updated_at = now() where id = pl.id returning * into pl;
  update public.sub_state set ore = ore - need_ore, anchor = anchor - need_anchor,
    pressure_lv = pressure_lv + (case when p_kind = 'pressure' then 1 else 0 end), battery_lv = battery_lv + (case when p_kind = 'battery' then 1 else 0 end),
    light_lv = light_lv + (case when p_kind = 'light' then 1 else 0 end), updated_at = now() where owner = pl.id;
  return jsonb_build_object('sub', public._sub_row(pl.id), 'player', to_jsonb(pl));
end $$;

do $$ declare f text; begin
  foreach f in array array['sub_get()', 'sub_unlock()', 'sub_dive_start()', 'sub_cast(integer)', 'sub_land(text,numeric)', 'sub_pick(text,integer)', 'sub_found()', 'sub_dive_end(integer,text)', 'sub_upgrade(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_sub_row(uuid)', '_sub_active(uuid)'] loop execute format('revoke all on function public.%s from public, anon, authenticated', f); end loop;
end $$;

select '潛水艇與黑淵裂縫設定完成 🚢' as result;
