-- 潮汐釣魚村：🐋 全服合作大魚（世界王）（可以重複執行）
-- 每天台灣時間 20:30、週六日再加 14:00，港口外海出現一條超大的魚，持續 10 分鐘。出現前 10 分鐘全服推播（遊戲裡跑馬燈）。
-- 種類輪流：海龍王（巨型石斑）、大白鯊、皇帶魚王。
-- 玩法：到港口外海按「一起拉！」加入，之後手機每秒最多回報一次「這一秒有沒有在綠色區拉」（boss_pull）。
--   · 出力由伺服器照你的釣竿算（越好的竿子一次越多，有上限）；呼叫太快（不到 0.9 秒）不算。
--   · 大魚掙扎的時候（每 40 秒裡的第 30～37 秒，全服同時）還在拉的人會「斷線」：10 秒不能出力。
--   · 體力跟參加人數走：每多一個人（第 4 個人開始）體力加一份，3 個人也打得贏。
-- 獎勵（結束時伺服器發一次，ended 欄位擋重複）：
--   · 成功：有出力的人都拿金幣（300 + 出力的一半，最多 800）；出力前 3 名拿那條大魚的魚拓家具（gyb_種類）；第 1 名拿稱號（bt_種類）並上跑馬燈。
--   · 失敗：有出力的人拿參加獎 60 金幣。
-- 公開的資料：大魚狀態、血量、時間、前 5 名的名字和出力（沒有玩家編號）。
-- 測試：在 SQL Editor 執行 select public.boss_test_spawn(1); 一分鐘後出現一條，持續 10 分鐘（一般玩家不能呼叫）。

create table if not exists public.world_boss (
  id bigserial primary key,
  kind text not null,
  hp numeric not null, hp_max numeric not null, per numeric not null,
  start_at timestamptz not null, end_at timestamptz not null,
  state text not null default 'soon',   -- soon / live / won / lost
  ended boolean not null default false,
  announced boolean not null default false
);
create unique index if not exists world_boss_start on public.world_boss(start_at);
create table if not exists public.boss_pull_log (
  boss_id bigint not null, uid uuid not null, name text, power numeric not null default 0, n integer not null default 0,
  last_at timestamptz, pause_until timestamptz, joined_at timestamptz not null default now(),
  primary key (boss_id, uid)
);
alter table public.world_boss enable row level security;
alter table public.boss_pull_log enable row level security;
revoke all on public.world_boss, public.boss_pull_log from anon, authenticated;

create or replace function public._boss_name(k text) returns text language sql immutable as $$
  select case k when 'dragon' then '海龍王' when 'gwhite' then '大白鯊' else '皇帶魚王' end $$;
create or replace function public._boss_struggle(b public.world_boss) returns boolean language sql stable as $$
  select b.state = 'live' and mod(floor(extract(epoch from (now() - b.start_at)))::int, 40) between 30 and 37 $$;

-- 排程：每分鐘看一次（建立下一條、開始、結束）
create or replace function public._boss_tick() returns void language plpgsql security definer set search_path = public as $$
declare tp timestamp := now() at time zone 'Asia/Taipei'; d date := tp::date; s timestamptz; b public.world_boss; k text;
begin
  foreach s in array array[(d + time '20:30') at time zone 'Asia/Taipei', case when extract(isodow from d) in (6, 7) then (d + time '14:00') at time zone 'Asia/Taipei' end] loop
    if s is null then continue; end if;
    if now() >= s - interval '10 minutes' and now() < s + interval '10 minutes' then
      k := (array['dragon', 'gwhite', 'oarking'])[1 + mod((d - date '2026-01-01') + case when extract(hour from s at time zone 'Asia/Taipei') = 14 then 1 else 0 end, 3)];
      insert into public.world_boss (kind, hp, hp_max, per, start_at, end_at) values (k, 7500, 7500, 2500, s, s + interval '10 minutes') on conflict (start_at) do nothing;
    end if;
  end loop;
  for b in select * from public.world_boss where not ended and start_at < now() + interval '11 minutes' loop
    if not b.announced then
      update public.world_boss set announced = true where id = b.id;
      perform public._push(null, 'boss', '🐋 ' || public._boss_name(b.kind) || '要來了！', to_char(b.start_at at time zone 'Asia/Taipei', 'HH24:MI') || ' 港口外海出現超大的' || public._boss_name(b.kind) || '，大家一起來拉！', 0);
    end if;
    if b.state = 'soon' and now() >= b.start_at then update public.world_boss set state = 'live' where id = b.id; end if;
    if b.state in ('soon', 'live') and now() >= b.end_at then perform public._boss_finish(b.id, false); end if;
  end loop;
end $$;

create or replace function public._boss_finish(p_id bigint, p_won boolean) returns void language plpgsql security definer set search_path = public as $$
declare b public.world_boss; r record; i int := 0; top_name text;
begin
  select * into b from public.world_boss where id = p_id for update;
  if b.id is null or b.ended then return; end if;
  update public.world_boss set ended = true, state = case when p_won then 'won' else 'lost' end, hp = case when p_won then 0 else hp end where id = p_id;
  for r in select * from public.boss_pull_log where boss_id = p_id and power > 0 order by power desc, joined_at loop
    i := i + 1;
    if p_won then
      update public.players set coins = coins + least(800, 300 + floor(r.power / 2)::int), earned = earned + least(800, 300 + floor(r.power / 2)::int),
        owned = case when i <= 3 and not ('gyb_' || b.kind = any(owned)) then array_append(owned, 'gyb_' || b.kind) else owned end, updated_at = now() where id = r.uid;
      if i = 1 then update public.players set owned = case when 'bt_' || b.kind = any(owned) then owned else array_append(owned, 'bt_' || b.kind) end where id = r.uid; top_name := r.name; end if;
      perform public._push(r.uid, 'boss', '🎉 ' || public._boss_name(b.kind) || '釣上來了！', '你是第 ' || i || ' 名' || case when i <= 3 then '，拿到了' || public._boss_name(b.kind) || '的魚拓！' else '，謝謝幫忙！' end, 0);
    else
      update public.players set coins = coins + 60, earned = earned + 60, updated_at = now() where id = r.uid;
    end if;
  end loop;
end $$;

-- 大魚的狀態（公開）
create or replace function public.boss_state() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.world_boss; me public.boss_pull_log; nx timestamptz; tp timestamp := now() at time zone 'Asia/Taipei';
begin
  select * into b from public.world_boss where (not ended and start_at < now() + interval '11 minutes') or (ended and end_at > now() - interval '3 minutes') order by start_at desc limit 1;
  if b.id is null then   -- 下一條什麼時候（給手機顯示）
    nx := (select min(x) from (values ((tp::date + time '20:30') at time zone 'Asia/Taipei'), ((tp::date + 1 + time '20:30') at time zone 'Asia/Taipei'),
      (case when extract(isodow from tp::date) in (6, 7) then (tp::date + time '14:00') at time zone 'Asia/Taipei' end), (case when extract(isodow from tp::date + 1) in (6, 7) then (tp::date + 1 + time '14:00') at time zone 'Asia/Taipei' end)) v(x) where x > now());
    return jsonb_build_object('next', nx, 'now', now());
  end if;
  select * into me from public.boss_pull_log where boss_id = b.id and uid = auth.uid();
  return jsonb_build_object('id', b.id, 'kind', b.kind, 'name', public._boss_name(b.kind), 'hp', b.hp, 'hp_max', b.hp_max, 'start', b.start_at, 'end', b.end_at, 'state', b.state, 'now', now(),
    'struggle', public._boss_struggle(b), 'n', (select count(*) from public.boss_pull_log where boss_id = b.id),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'p', round(power))) from (select name, power from public.boss_pull_log where boss_id = b.id and power > 0 order by power desc, joined_at limit 5) t), '[]'::jsonb),
    'me', case when me.uid is null then null else jsonb_build_object('p', round(me.power), 'pause', me.pause_until > now(), 'rank', (select count(*) + 1 from public.boss_pull_log x where x.boss_id = b.id and x.power > me.power)) end);
end $$;

create or replace function public.boss_join(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); b public.world_boss; n int;
begin
  select * into b from public.world_boss where id = p_id for update;
  if b.id is null or b.state <> 'live' or now() >= b.end_at then raise exception '大魚現在不在'; end if;
  insert into public.boss_pull_log (boss_id, uid, name) values (b.id, pl.id, coalesce(nullif(btrim(pl.nickname), ''), '釣客')) on conflict do nothing;
  if found then select count(*) into n from public.boss_pull_log where boss_id = b.id;
    if n > 3 then update public.world_boss set hp_max = hp_max + per, hp = hp + per where id = b.id; end if; end if;   -- 人多體力跟著變多
  return public.boss_state();
end $$;

create or replace function public.boss_pull(p_id bigint, p_good integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); b public.world_boss; L public.boss_pull_log; pw numeric; cfg jsonb := public._fishcfg();
begin
  select * into b from public.world_boss where id = p_id for update;
  if b.id is null or b.state <> 'live' or now() >= b.end_at then return public.boss_state(); end if;
  select * into L from public.boss_pull_log where boss_id = b.id and uid = pl.id for update;
  if L.uid is null then raise exception '要先按「一起拉！」加入'; end if;
  if L.last_at is not null and now() - L.last_at < interval '900 milliseconds' then return public.boss_state(); end if;   -- 呼叫太快不算
  if L.pause_until is not null and L.pause_until > now() then update public.boss_pull_log set last_at = now() where boss_id = b.id and uid = pl.id; return public.boss_state(); end if;
  if public._boss_struggle(b) then
    if coalesce(p_good, 0) = 1 then update public.boss_pull_log set last_at = now(), pause_until = now() + interval '10 seconds' where boss_id = b.id and uid = pl.id; end if;   -- 掙扎時還在拉：斷線
    return public.boss_state();
  end if;
  pw := case when coalesce(p_good, 0) = 1 then least(14, 8 * coalesce((cfg->'rods'->pl.rod->>'rare')::numeric, 1)) else 0 end;
  update public.boss_pull_log set power = power + pw, n = n + 1, last_at = now() where boss_id = b.id and uid = pl.id;
  update public.world_boss set hp = greatest(0, hp - pw) where id = b.id returning * into b;
  if b.hp <= 0 then perform public._boss_finish(b.id, true); end if;
  return public.boss_state();
end $$;

-- 測試用：手動叫出一條（只有站長在 SQL Editor 可以用）
create or replace function public.boss_test_spawn(p_minutes integer default 1) returns text language plpgsql security definer set search_path = public as $$
declare s timestamptz := date_trunc('second', now()) + make_interval(mins => greatest(0, p_minutes));
begin
  insert into public.world_boss (kind, hp, hp_max, per, start_at, end_at, state, announced) values ((array['dragon', 'gwhite', 'oarking'])[1 + floor(random() * 3)::int], 7500, 7500, 2500, s, s + interval '10 minutes', case when p_minutes <= 0 then 'live' else 'soon' end, false);
  return '大魚會在 ' || to_char(s at time zone 'Asia/Taipei', 'HH24:MI:SS') || ' 出現';
end $$;

revoke all on function public._boss_tick(), public._boss_finish(bigint, boolean), public.boss_test_spawn(integer) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['boss_state()', 'boss_join(bigint)', 'boss_pull(bigint,integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 魚拓家具 gyb_ 和稱號 bt_：只有拿到的人可以擺（不用錢）；其他照 078
create or replace function public._furn(p text, out price integer, out rad numeric, out flat boolean) language plpgsql stable security definer set search_path = public as $$
declare d public.furn_designs;
begin
  if p ~ '^gyb?_[a-z]{2,12}$' then
    rad := 0.45; flat := false;
    price := case when exists (select 1 from public.players where id = auth.uid() and p = any(owned)) then 0 end;
    return;
  end if;
  if p ~ '^fz[0-9]{1,9}$' then
    select * into d from public.furn_designs where id = substr(p, 3)::integer;
    if d.id is null then return; end if;
    if d.base = 'paint' then rad := 0.45; flat := false; else select b.rad, b.flat into rad, flat from public._furn(d.base) b; end if;
    price := case when d.listed and (d.owner is null or d.owner = auth.uid()) then d.price end;
    return;
  end if;
  select v.price, v.rad, v.flat into price, rad, flat from (values
    ('bed',600,1.1,false),('dbed',1200,1.4,false),('bunk',1000,1.1,false),('sofa',800,1.2,false),('arm',400,0.6,false),('table',500,0.8,false),('chair',120,0.35,false),
    ('desk',450,0.7,false),('shelf',500,0.7,false),('ward',700,0.8,false),('lamp',200,0.3,false),('plant',150,0.4,false),('bigplant',300,0.5,false),('rug',250,1.2,true),
    ('tv',900,0.9,false),('fridge',800,0.5,false),('stove',700,0.5,false),('sink',500,0.6,false),('bath',1200,1.0,false),('toilet',400,0.4,false),('fire',1500,0.8,false),
    ('tank',1000,0.7,false),('piano',2500,0.9,false),('clock',600,0.3,false),
    ('kk_bed_single_A',650,1.0,false),('kk_bed_single_B',650,1.0,false),('kk_bed_double_A',1300,1.3,false),('kk_bed_double_B',1300,1.3,false),('kk_cabinet_small',300,0.4,false),('kk_cabinet_small_decorated',380,0.4,false),('kk_cabinet_medium',450,0.7,false),('kk_cabinet_medium_decorated',600,0.7,false),('kk_lamp_table',180,0.3,false),('kk_lamp_standing',260,0.35,false),('kk_couch',900,1.1,false),('kk_couch_pillows',1000,1.1,false),('kk_armchair',450,0.6,false),('kk_armchair_pillows',520,0.6,false),('kk_chair_A',140,0.35,false),('kk_chair_A_wood',140,0.35,false),('kk_chair_B_wood',160,0.35,false),('kk_chair_C',160,0.35,false),('kk_chair_stool_wood',90,0.3,false),('kk_table_low',350,0.9,false),('kk_table_small',250,0.4,false),('kk_table_medium',450,0.8,false),('kk_table_medium_long',600,1.1,false),('kk_rug_oval_A',260,1.1,true),('kk_rug_rectangle_A',240,1.1,true),('kk_rug_rectangle_stripes_A',280,1.1,true),('kk_rug_rectangle_stripes_B',280,1.1,true),('kk_cactus_small_A',120,0.25,false),('kk_cactus_small_B',120,0.25,false),('kk_cactus_medium_A',220,0.4,false),('kk_cactus_medium_B',220,0.4,false)
  ) v(id, price, rad, flat) where v.id = p;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-boss', '* * * * *', 'select public._boss_tick()');   -- 每分鐘
  end if;
end $$;

select '全服合作大魚設定完成 🐋' as result;
