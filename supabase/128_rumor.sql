-- 潮汐釣魚村 v326：傳說魚的線索（29）（可以重複執行）
-- 每週一 0:00（台北）換一則「傳聞」：主島某個釣點出現了很大的影子（傳說魚）。
--   線索一（地點）：大家都知道。
--   線索二（時段：白天／清晨黃昏／晚上）：在那個釣點釣到 5 條魚就會注意到。
--   線索三（釣法：浮標／沉底／路亞）：有了線索二以後去找港口的阿默聊。
--   三條線索都有：在對的釣點、時段、釣法，那條傳說魚的機率 ×4（020 的 roll_fish 呼叫 _rumor_hit）。
--   本週第一個釣到的人 +500 金幣、名字給大家看；之後釣到的人 +150。

create table if not exists public.rumor_prog (
  uid uuid not null, week date not null, n integer not null default 0, c2 boolean not null default false, c3 boolean not null default false, caught boolean not null default false,
  primary key (uid, week));
alter table public.rumor_prog enable row level security;
revoke all on public.rumor_prog from anon, authenticated;

create table if not exists public.rumor_first (week date primary key, uid uuid not null, name text, fish text, w numeric, at timestamptz not null default now());
alter table public.rumor_first enable row level security;
revoke all on public.rumor_first from anon, authenticated;

create or replace function public._rumor_week(t timestamptz default now()) returns date language sql stable as $$
  select date_trunc('week', t at time zone 'Asia/Taipei')::date $$;

-- 這週的傳聞：釣點、魚、時段、釣法（每週固定，大家都一樣）
create or replace function public._rumor(p_week date default null) returns jsonb language plpgsql stable as $$
declare wk date := coalesce(p_week, public._rumor_week()); c text[] := array['river:koi', 'lake:koi', 'lake:sturgeon', 'lake:arowana', 'pool:trout', 'sea:grouper', 'reef:amberjack', 'reef:grouper', 'mangrove:bullshark', 'mangrove:sawfish', 'creek:trout'];
  h bigint := public._fnv('rumor' || wk::text); e text[];
begin
  e := string_to_array(c[1 + (h % cardinality(c))::integer], ':');
  return jsonb_build_object('week', wk, 'spot', e[1], 'fish', e[2],
    'per', (array['day', 'twilight', 'night'])[1 + ((h / 7) % 3)::integer],
    'rig', (array['float', 'bottom', 'lure'])[1 + ((h / 131) % 3)::integer]);
end $$;

-- 抽魚的時候用：三條線索都有、條件都對 → 回傳那條魚
create or replace function public._rumor_hit(p_uid uuid, p_spot text, p_rig text, p_per text) returns text language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public._rumor(); g public.rumor_prog;
begin
  if p_spot is distinct from r->>'spot' or p_rig is distinct from r->>'rig' or p_per is distinct from r->>'per' then return null; end if;
  select * into g from public.rumor_prog where uid = p_uid and week = (r->>'week')::date;
  if found and g.c2 and g.c3 then return r->>'fish'; end if;
  return null;
end $$;

-- 釣到魚的時候用：在傳聞的釣點累積條數、釣到傳說魚發獎勵
create or replace function public._rumor_on_catch(p_uid uuid, p_spot text, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare r jsonb := public._rumor(); wk date := (r->>'week')::date; g public.rumor_prog; nm text;
begin
  if p_spot is distinct from r->>'spot' then return; end if;
  insert into public.rumor_prog (uid, week, n) values (p_uid, wk, 1) on conflict (uid, week) do update set n = rumor_prog.n + 1 returning * into g;
  if g.n >= 5 and not g.c2 then update public.rumor_prog set c2 = true where uid = p_uid and week = wk; end if;
  if p_fish = r->>'fish' and not g.caught then
    update public.rumor_prog set caught = true where uid = p_uid and week = wk;
    select nickname into nm from public.players where id = p_uid;
    insert into public.rumor_first (week, uid, name, fish, w) values (wk, p_uid, left(coalesce(nm, '釣客'), 16), p_fish, p_w) on conflict (week) do nothing;
    if found then update public.players set coins = coins + 500 where id = p_uid; else update public.players set coins = coins + 150 where id = p_uid; end if;
  end if;
end $$;

-- 跟 111／117 一樣，多了傳聞
create or replace function public._ev_on_catch(p_uid uuid, p_spot text, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb := public._ev_mig(); b jsonb := public._ev_bounty(); n integer;
begin
  if (m->>'active')::boolean and p_spot = m->>'spot' and p_fish = m->>'fish' then
    insert into public.ev_claims (uid, kind, ev_id, n) values (p_uid, 'mig', (m->>'id')::bigint, 1)
      on conflict (uid, kind, ev_id) do update set n = ev_claims.n + 1 returning n into n;
    if n >= 4 then update public.ev_claims set done = true where uid = p_uid and kind = 'mig' and ev_id = (m->>'id')::bigint and not done;
      if found then update public.players set coins = coins + 200 where id = p_uid; end if; end if;
  end if;
  if p_fish = b->>'fish' and p_w >= (b->>'minw')::numeric then
    insert into public.ev_claims (uid, kind, ev_id, n, done) values (p_uid, 'bounty', (b->>'id')::bigint, 1, true) on conflict do nothing;
    if found then update public.players set coins = coins + 300 where id = p_uid; end if;
  end if;
  begin perform public._rumor_on_catch(p_uid, p_spot, p_fish, p_w); exception when others then null; end;   -- 128 傳說魚的線索（出錯也不能影響釣魚）
end $$;
revoke all on function public._ev_on_catch(uuid, text, text, numeric) from public, anon, authenticated;

-- 給畫面看：還沒找到的線索不告訴手機
create or replace function public.rumor_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public._rumor(); wk date := (r->>'week')::date; g public.rumor_prog; f public.rumor_first;
begin
  select * into g from public.rumor_prog where uid = auth.uid() and week = wk;
  select * into f from public.rumor_first where week = wk;
  return jsonb_build_object('week', wk, 'ends', (wk + 7)::timestamp at time zone 'Asia/Taipei', 'spot', r->>'spot',
    'n', coalesce(g.n, 0), 'c2', coalesce(g.c2, false), 'c3', coalesce(g.c3, false), 'caught', coalesce(g.caught, false),
    'per', case when coalesce(g.c2, false) then r->>'per' end, 'rig', case when coalesce(g.c3, false) then r->>'rig' end,
    'fish', case when coalesce(g.caught, false) or f.uid is not null then r->>'fish' end,
    'first', case when f.uid is not null then jsonb_build_object('name', f.name, 'w', f.w, 'at', f.at, 'me', f.uid = auth.uid()) end);
end $$;

-- 跟阿默聊：有線索二才問得到線索三
create or replace function public.rumor_talk() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := public._rumor(); wk date := (r->>'week')::date;
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  update public.rumor_prog set c3 = true where uid = auth.uid() and week = wk and c2;
  return public.rumor_status();
end $$;

do $$ declare f text; begin
  foreach f in array array['_rumor_hit(uuid,text,text,text)', '_rumor_on_catch(uuid,text,text,numeric)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['rumor_status()', 'rumor_talk()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '傳說魚的線索設定完成 🔍' as result;
