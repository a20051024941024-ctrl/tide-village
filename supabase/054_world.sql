-- 潮汐釣魚村：村民自己過日子（架構第二階段；可以重複執行）
-- 伺服器是村民的「世界權威資料」：5 位公共 NPC（村長、阿綾、阿木、阿福、老港）的需求、正在做什麼、在哪裡、幾點出發幾點到，都只存在這裡。
-- 每分鐘推進一次（pg_cron），玩家打開遊戲時如果太久沒推進也會順便推進；玩家離線時照樣過日子（用時間差一步一步補算，最多補 24 小時）。
-- 手機只讀 npc_world()，照同一張地圖算同一條路，所以不同房間看到的村民都一樣。不用 AI API。

-- ---- 地點 ----
create table if not exists public.npc_places (
  id       text primary key,
  name     text not null,
  kind     text not null,              -- home / work / food / social / fish / stroll
  x        numeric not null,
  z        numeric not null,
  r        numeric,                    -- 站著的時候面向哪裡
  fish_dir numeric,                    -- 釣魚的時候往哪裡拋
  solo     boolean not null default false
);
alter table public.npc_places enable row level security;
revoke all on public.npc_places from anon, authenticated;

insert into public.npc_places (id, name, kind, x, z, r, fish_dir, solo) values
  ('home_chief', '村長家', 'home', -12.1, -7.5, null, null, false),
  ('home_ling',  '阿綾家', 'home', -7.3, 13.5, null, null, false),
  ('home_mu',    '阿木家', 'home', 14.3, 12.3, null, null, false),
  ('home_gang',  '老港家', 'home', 19.7, 6.9, null, null, false),
  ('home_fu',    '海產店後面的家', 'home', 19.1, -23.1, null, null, false),
  ('work_chief', '潮汐廣場', 'work', 7.2, 1.2, -0.852, null, true),
  ('work_ling',  '阿綾服裝店', 'work', -4.25, 32.25, 1.571, null, true),
  ('work_mu',    '阿木木工坊', 'work', 8.95, 19.95, -1.571, null, true),
  ('work_fu',    '阿福海產店', 'work', 17.63, -23.95, -0.51, null, true),
  ('work_gang',  '港口碼頭', 'work', 31.4, -34.4, 1.67, 1.67, true),
  ('cook',       '食堂', 'food', 10.7, 7.5, 0, null, false),
  ('pavilion',   '聊天涼亭', 'social', -3.1, 21.9, 0, null, false),
  ('plaza',      '廣場', 'social', 1.5, 6.5, 0, null, false),
  ('beach',      '東邊沙灘', 'stroll', 40.1, -5.7, 1.57, null, false),
  ('harbor',     '港口', 'stroll', 28.1, -26.7, 2.5, null, false),
  ('lighthouse', '燈塔', 'stroll', 15.5, -43.5, 2.8, null, false),
  ('fish_river', '溪上的木橋', 'fish', -20.5, -17.7, 0, 0, false),
  ('fish_lake',  '鏡湖棧道', 'fish', -21.7, -2.1, -1.571, -1.571, false),
  ('fish_sea',   '北海灘碼頭', 'fish', -1.5, -50.8, 2.99, 2.99, false)
on conflict (id) do update set name = excluded.name, kind = excluded.kind, x = excluded.x, z = excluded.z, r = excluded.r, fish_dir = excluded.fish_dir, solo = excluded.solo;

-- ---- 村民 ----
-- traits：diligent 認真、social 愛聊天、glutton 愛吃、lazy 愛休息、fishy 愛釣魚、wander 愛散步（0～1）
-- sched：sleep [幾點睡, 幾點起]、work [[上班, 下班], ...]（台灣時間，小時）
create table if not exists public.npcs (
  id        text primary key,
  name      text not null,
  job       text not null,
  traits    jsonb not null,
  sched     jsonb not null,
  home      text not null references public.npc_places(id),
  work      text not null references public.npc_places(id),
  fishspot  text not null references public.npc_places(id),
  strolls   text[] not null default '{}',
  -- 現在的狀態（伺服器才會改）
  act       text not null default 'rest',
  place     text not null,
  from_place text not null,
  dep_at    timestamptz not null default now(),
  arr_at    timestamptz not null default now(),
  until_at  timestamptz not null default now(),
  needs_at  timestamptz not null default now(),
  hunger    numeric not null default 70,     -- 飽足（100 = 很飽）
  energy    numeric not null default 80,     -- 體力
  social    numeric not null default 60,     -- 跟人說話的滿足
  fun       numeric not null default 60,     -- 玩樂的滿足
  worked    numeric not null default 0,      -- 今天工作了幾小時
  work_day  date
);
alter table public.npcs enable row level security;
revoke all on public.npcs from anon, authenticated;

insert into public.npcs (id, name, job, traits, sched, home, work, fishspot, strolls, place, from_place) values
  ('chief', '村長 阿土伯', '村長', '{"diligent":0.7,"social":0.9,"glutton":0.5,"lazy":0.3,"fishy":0.4,"wander":0.6}',
     '{"sleep":[23,6],"work":[[8,12],[13.5,19]]}', 'home_chief', 'work_chief', 'fish_lake', array['plaza','pavilion','beach'], 'work_chief', 'work_chief'),
  ('ling', '阿綾', '服裝設計師', '{"diligent":0.6,"social":0.7,"glutton":0.6,"lazy":0.4,"fishy":0.1,"wander":0.9}',
     '{"sleep":[0,7.5],"work":[[10,13],[14,20]]}', 'home_ling', 'work_ling', 'fish_lake', array['beach','pavilion','lighthouse'], 'work_ling', 'work_ling'),
  ('mu', '阿木', '家具木匠', '{"diligent":0.9,"social":0.3,"glutton":0.5,"lazy":0.2,"fishy":0.8,"wander":0.3}',
     '{"sleep":[22,5.5],"work":[[8,12],[13,17]]}', 'home_mu', 'work_mu', 'fish_river', array['beach','harbor'], 'work_mu', 'work_mu'),
  ('fu', '阿福', '海產店老闆', '{"diligent":0.8,"social":0.8,"glutton":0.9,"lazy":0.3,"fishy":0.3,"wander":0.4}',
     '{"sleep":[21.5,4.5],"work":[[5,12],[15,19]]}', 'home_fu', 'work_fu', 'fish_sea', array['harbor','plaza'], 'work_fu', 'work_fu'),
  ('gang', '老港', '漁夫', '{"diligent":0.8,"social":0.4,"glutton":0.6,"lazy":0.3,"fishy":1.0,"wander":0.3}',
     '{"sleep":[20.5,3.5],"work":[[4,10],[15,18]]}', 'home_gang', 'work_gang', 'fish_sea', array['harbor','lighthouse'], 'work_gang', 'work_gang')
on conflict (id) do update set name = excluded.name, job = excluded.job, traits = excluded.traits, sched = excluded.sched, home = excluded.home, work = excluded.work, fishspot = excluded.fishspot, strolls = excluded.strolls;

-- ---- 世界時鐘、村民日記（第三階段的「記憶」會從這裡整理；只留 3 天）----
create table if not exists public.world_clock (id integer primary key default 1 check (id = 1), last_tick timestamptz not null default now(), seq bigint not null default 0, wx text);
insert into public.world_clock (id) values (1) on conflict do nothing;
alter table public.world_clock enable row level security;
revoke all on public.world_clock from anon, authenticated;

create table if not exists public.npc_log (
  id    bigserial primary key,
  npc   text not null,
  at    timestamptz not null,
  act   text not null,
  place text not null,
  why   text not null default ''
);
create index if not exists npc_log_at on public.npc_log (at desc);
alter table public.npc_log enable row level security;
revoke all on public.npc_log from anon, authenticated;

-- 台灣時間幾點（小數）
create or replace function public._tw_hour(t timestamptz) returns numeric language sql immutable as $$
  select extract(hour from t at time zone 'Asia/Taipei') + extract(minute from t at time zone 'Asia/Taipei') / 60.0 $$;
create or replace function public._in_win(h numeric, a numeric, b numeric) returns boolean language sql immutable as $$
  select case when a <= b then h >= a and h < b else h >= a or h < b end $$;

-- 這個時間點的天氣（跟遊戲裡的天氣同一套）
create or replace function public._wx_at(t timestamptz) returns text language sql stable as $$
  select public._weather((extract(epoch from t) * 1000)::bigint)->>'k' $$;

-- 決定接下來要做什麼（在時間 t、需求已經算到 t 的時候呼叫）
create or replace function public._npc_decide(n public.npcs, t timestamptz, wx text) returns public.npcs language plpgsql volatile security definer set search_path = public as $$
declare
  h numeric := public._tw_hour(t); tr jsonb := n.traits; s jsonb := n.sched; w jsonb;
  inwork boolean := false; insleep boolean; wet boolean := wx in ('rain', 'storm');
  meal boolean := public._in_win(h, 6.5, 8.5) or public._in_win(h, 11.5, 13.3) or public._in_win(h, 17.5, 19.3);
  u jsonb := '{}'; best text; bu numeric := -1; k text; v numeric; dest text; dur numeric; why text; pl public.npc_places; cur public.npc_places; dist numeric;
  social_at text;
begin
  for w in select * from jsonb_array_elements(s->'work') loop if public._in_win(h, (w->>0)::numeric, (w->>1)::numeric) then inwork := true; end if; end loop;
  insleep := public._in_win(h, (s->'sleep'->>0)::numeric, (s->'sleep'->>1)::numeric);
  -- 每件事有多想做（越大越想）
  u := jsonb_build_object(
    'sleep', case when insleep then 200 when n.energy < 12 then 130 else 0 end,
    'work',  case when inwork and not insleep then 85 + (tr->>'diligent')::numeric * 35 - least(n.worked, 9) * 2 else 0 end,
    'eat',   (100 - n.hunger) * (0.9 + (tr->>'glutton')::numeric * 0.5) + case when meal then 45 else 0 end,
    'chat',  (100 - n.social) * (0.4 + (tr->>'social')::numeric * 0.9),
    'fish',  case when wet and n.id <> 'gang' then 0 else (100 - n.fun) * (0.3 + (tr->>'fishy')::numeric * 0.9) end,
    'stroll', case when wx = 'storm' then 0 else (100 - n.fun) * (0.25 + (tr->>'wander')::numeric * 0.6) * case when wet then 0.3 else 1 end + 6 end,
    'rest',  (100 - n.energy) * (0.6 + (tr->>'lazy')::numeric * 0.6) + case when wet then 15 else 0 end);
  for k, v in select key, value::numeric from jsonb_each_text(u) loop
    v := v + random() * 12 + case when k = n.act then 14 else 0 end;   /* 正在做的事多一點分數，不會一直換來換去 */
    if insleep and k <> 'sleep' then v := v - 150; end if;
    if v > bu then bu := v; best := k; end if;
  end loop;
  -- 去哪裡
  dest := case best
    when 'sleep' then n.home when 'rest' then n.home when 'work' then n.work when 'fish' then n.fishspot
    when 'eat' then case when public._in_win(h, 6, 21) then 'cook' else n.home end
    else null end;
  if best = 'chat' then   -- 去別人正在聊天、吃飯的地方；沒有的話去喜歡的地方
    select o.place into social_at from public.npcs o join public.npc_places p on p.id = o.place
      where o.id <> n.id and o.act in ('chat', 'eat') and p.kind in ('social', 'food') order by random() limit 1;
    dest := coalesce(social_at, case when wet then 'pavilion' else (array['plaza', 'pavilion'])[1 + floor(random() * 2)::int] end);
  end if;
  if best = 'stroll' then dest := case when n.act = 'stroll' and random() < 0.4 then n.place else n.strolls[1 + floor(random() * array_length(n.strolls, 1))::int] end; end if;
  why := case best
    when 'sleep' then case when insleep then '到了睡覺的時間' else '太累了' end
    when 'work' then '上班時間' when 'eat' then case when meal then '吃飯時間到了' else '肚子餓了' end
    when 'chat' then '想找人說說話' when 'fish' then '想去釣魚放鬆' when 'stroll' then '出去走走' else '休息一下' end;
  if wet and best in ('rest', 'chat') then why := why || '（外面在下雨）'; end if;
  dur := case best when 'sleep' then 60 when 'work' then 30 when 'eat' then 35 when 'chat' then 25 when 'fish' then 40 when 'stroll' then 20 else 30 end;
  select * into cur from public.npc_places where id = n.place;
  select * into pl from public.npc_places where id = dest;
  if pl.id is null then pl := cur; dest := cur.id; end if;
  if best <> n.act or dest <> n.place then
    insert into public.npc_log (npc, at, act, place, why) values (n.id, t, best, dest, why);
  end if;
  if dest = n.place then
    n.from_place := n.place; n.dep_at := t; n.arr_at := t;
  else
    dist := sqrt(power(pl.x - cur.x, 2) + power(pl.z - cur.z, 2));
    n.from_place := n.place; n.place := dest; n.dep_at := t; n.arr_at := t + make_interval(secs => round(dist * 1.3 / 1.6 + 2)::float8);
  end if;
  n.act := best; n.until_at := n.arr_at + make_interval(mins => dur::int);
  if best = 'sleep' and insleep then   -- 睡到起床時間（最多 1 小時一段，下雨、餓醒也會重新決定）
    n.until_at := least(n.until_at, n.arr_at + interval '60 minutes');
  end if;
  return n;
end $$;
revoke all on function public._npc_decide(public.npcs, timestamptz, text) from public, anon, authenticated;

-- 從 needs_at 算到 t：這段時間在做的事讓需求怎麼變（每小時）
create or replace function public._npc_needs(n public.npcs, t timestamptz) returns public.npcs language plpgsql immutable as $$
declare hrs numeric := greatest(0, extract(epoch from t - n.needs_at) / 3600.0); a text := n.act;
  mv numeric := greatest(0, extract(epoch from least(t, n.arr_at) - greatest(n.needs_at, n.dep_at)) / 3600.0); st numeric;
begin
  if hrs = 0 then return n; end if;
  st := greatest(0, hrs - mv);   -- 走路的時間照「散步」算，到了以後才照正在做的事算
  n.hunger := n.hunger - 9 * hrs; n.energy := n.energy - 5 * mv; n.social := n.social - 6 * hrs; n.fun := n.fun - 4 * hrs;
  if a = 'sleep' then n.energy := n.energy + 15 * st; n.hunger := n.hunger + 6 * st; n.social := n.social + 5 * st; n.fun := n.fun + 3 * st;
  elsif a = 'rest' then n.energy := n.energy + 22 * st; n.fun := n.fun + 6 * st;
  elsif a = 'eat' then n.hunger := n.hunger + 160 * st; n.social := n.social + 12 * st; n.energy := n.energy - 2 * st;
  elsif a = 'work' then n.energy := n.energy - 7 * st; n.fun := n.fun - 2 * st; n.worked := n.worked + st;
  elsif a = 'chat' then n.social := n.social + 90 * st; n.fun := n.fun + 15 * st; n.energy := n.energy - 3 * st;
  elsif a = 'fish' then n.fun := n.fun + 60 * st; n.energy := n.energy - 6 * st;
  elsif a = 'stroll' then n.fun := n.fun + 55 * st; n.social := n.social + 6 * st; n.energy := n.energy - 6 * st;
  end if;
  n.hunger := least(100, greatest(0, n.hunger)); n.energy := least(100, greatest(0, n.energy));
  n.social := least(100, greatest(0, n.social)); n.fun := least(100, greatest(0, n.fun));
  n.needs_at := t; return n;
end $$;

-- 推進世界：鎖住時鐘（同一時間只有一個在推）、每個村民照事件一個一個補算到現在
create or replace function public._world_tick() returns integer language plpgsql volatile security definer set search_path = public as $$
declare c public.world_clock; tnow timestamptz := now(); n public.npcs; ev timestamptz; steps int; total int := 0; wx_now text; d date;
begin
  select * into c from public.world_clock where id = 1 for update skip locked;
  if c.id is null then return -1; end if;
  wx_now := public._wx_at(tnow);
  for n in select * from public.npcs order by id for update loop
    -- 伺服器停太久（超過 24 小時）：不補算那麼久，直接從 24 小時前開始
    if n.until_at < tnow - interval '24 hours' then n.needs_at := tnow - interval '24 hours'; n.until_at := n.needs_at; n.arr_at := n.needs_at; n.dep_at := n.needs_at; end if;
    -- 下雨、颳暴風雨：在外面釣魚、散步的人會提早改變主意
    if wx_now in ('rain', 'storm') and coalesce(c.wx, '') <> wx_now and n.act in ('fish', 'stroll') and n.arr_at <= tnow then n.until_at := least(n.until_at, tnow); end if;
    steps := 0;
    loop
      ev := n.until_at; exit when ev > tnow or steps >= 400;
      n := public._npc_needs(n, ev);
      d := (ev at time zone 'Asia/Taipei')::date; if n.work_day is distinct from d then n.work_day := d; n.worked := 0; end if;
      n := public._npc_decide(n, ev, public._wx_at(ev));
      steps := steps + 1;
    end loop;
    total := total + steps;
    update public.npcs set act = n.act, place = n.place, from_place = n.from_place, dep_at = n.dep_at, arr_at = n.arr_at, until_at = n.until_at, needs_at = n.needs_at,
      hunger = n.hunger, energy = n.energy, social = n.social, fun = n.fun, worked = n.worked, work_day = n.work_day where id = n.id;
  end loop;
  update public.world_clock set last_tick = tnow, seq = seq + 1, wx = wx_now where id = 1;
  delete from public.npc_log where at < tnow - interval '3 days';
  return total;
end $$;
revoke all on function public._world_tick() from public, anon, authenticated;

-- 手機讀的：村民現在的狀態、地點表、最近的動態（太久沒推進就先推進一次）
create or replace function public.npc_world() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.world_clock;
begin
  select * into c from public.world_clock where id = 1;
  if c.last_tick < now() - interval '90 seconds' then perform public._world_tick(); end if;
  return jsonb_build_object(
    'now', now(),
    'places', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'x', p.x, 'z', p.z, 'r', p.r, 'fishDir', p.fish_dir, 'solo', p.solo)) from public.npc_places p),
    'npcs', (select jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name, 'act', n.act, 'place', n.place, 'from', n.from_place, 'dep', n.dep_at, 'arr', n.arr_at, 'until', n.until_at,
               'hunger', round(n.hunger), 'energy', round(n.energy), 'social', round(n.social), 'fun', round(n.fun))) from public.npcs n),
    'log', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (select jsonb_build_object('npc', l.npc, 'at', l.at, 'act', l.act, 'place', l.place, 'why', l.why) x from public.npc_log l where l.at <= now() order by l.at desc limit 20) q));
end $$;
revoke all on function public.npc_world() from public, anon;
grant execute on function public.npc_world() to authenticated;

-- 第一次：讓每個人馬上決定一次
do $$ begin perform public._world_tick(); end $$;

-- 每分鐘推進一次
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice '沒辦法開 pg_cron：%', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-world-tick', '* * * * *', 'select public._world_tick()');
  end if;
end $$;

select '村民開始自己過日子了 🏘️' as result;
