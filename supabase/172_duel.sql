-- 172 ⚔️ 釣魚對決（v502，作者 11/16：想要像對戰遊戲那樣「一局很短、跟真人比、想再來一局」）
-- 兩個人、3 分鐘、比這段時間釣到的魚的總重量。魚本來就是伺服器抽的（020），所以分數也在伺服器算，改手機沒有用。
-- 第一步：邀請同一個大廳裡的人、計分、結算、勝場和連勝。（配對排隊、段位星星是下一步）
-- 規則：
--   ・邀請 25 秒沒回應就過期；接受以後 6 秒倒數，然後 180 秒。
--   ・釣蝦場的蝦不算。照自己的裝備、不限釣點。
--   ・時間到誰重誰贏；一樣重（含兩個人都 0）算平手，不算勝敗。
--   ・同一個對手每天（台灣時間）只有前 3 局算進勝敗和連勝，免得兩個人互刷。
-- 可以重複執行。

create table if not exists public.duels (
  id         bigserial primary key,
  a          uuid not null references public.players(id) on delete cascade,
  b          uuid not null references public.players(id) on delete cascade,
  a_name     text, b_name text,
  status     text not null default 'invited' check (status in ('invited', 'active', 'done', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  start_at   timestamptz, end_at timestamptz,
  a_w        numeric(10,2) not null default 0, b_w numeric(10,2) not null default 0,
  a_n        integer not null default 0, b_n integer not null default 0,
  a_log      jsonb not null default '[]'::jsonb, b_log jsonb not null default '[]'::jsonb,
  winner     uuid, counted boolean not null default false
);
create index if not exists duels_a_idx on public.duels (a, id desc);
create index if not exists duels_b_idx on public.duels (b, id desc);
alter table public.duels enable row level security;   -- 沒有任何 policy：只能透過下面的函式讀寫

create table if not exists public.duel_stats (
  uid         uuid primary key references public.players(id) on delete cascade,
  wins        integer not null default 0, losses integer not null default 0, draws integer not null default 0,
  streak      integer not null default 0, best_streak integer not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.duel_stats enable row level security;

-- 結算一場（時間到了才會動；重複呼叫沒關係）
create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.status <> 'active' or now() < d.end_at then return; end if;
  w := case when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end;
  l := case when w is null then null when w = d.a then d.b else d.a end;
  day0 := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  select count(*) into n from public.duels x where x.status = 'done' and x.counted and x.end_at >= day0 and ((x.a = d.a and x.b = d.b) or (x.a = d.b and x.b = d.a));
  update public.duels set status = 'done', winner = w, counted = (n < 3) where id = d.id;
  if n >= 3 then return; end if;
  insert into public.duel_stats (uid) values (d.a), (d.b) on conflict (uid) do nothing;
  if w is null then
    update public.duel_stats set draws = draws + 1, updated_at = now() where uid in (d.a, d.b);
  else
    update public.duel_stats set wins = wins + 1, streak = streak + 1, best_streak = greatest(best_streak, streak + 1), updated_at = now() where uid = w;
    update public.duel_stats set losses = losses + 1, streak = 0, updated_at = now() where uid = l;
  end if;
end $$;
revoke all on function public._duel_settle(bigint) from public, anon, authenticated;

-- 把一場對決整理成手機要的樣子
create or replace function public._duel_json(d public.duels, me uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.duel_stats;
begin
  select * into s from public.duel_stats where uid = me;
  return jsonb_build_object('id', d.id, 'status', d.status, 'me', case when d.a = me then 'a' else 'b' end,
    'a', d.a, 'b', d.b, 'a_name', d.a_name, 'b_name', d.b_name,
    'a_w', d.a_w, 'b_w', d.b_w, 'a_n', d.a_n, 'b_n', d.b_n, 'a_log', d.a_log, 'b_log', d.b_log,
    'created', (extract(epoch from d.created_at) * 1000)::bigint,
    'start', (extract(epoch from d.start_at) * 1000)::bigint, 'end', (extract(epoch from d.end_at) * 1000)::bigint,
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'winner', d.winner, 'counted', d.counted,
    'stats', jsonb_build_object('wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0)));
end $$;
revoke all on function public._duel_json(public.duels, uuid) from public, anon, authenticated;

-- 這個人現在有沒有「還沒結束」的對決（等回應的邀請、或正在打）
create or replace function public._duel_busy(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duels d where (d.a = p_uid or d.b = p_uid)
    and ((d.status = 'invited' and d.created_at > now() - interval '25 seconds') or (d.status = 'active' and d.end_at > now()))) $$;
revoke all on function public._duel_busy(uuid) from public, anon, authenticated;

-- 我現在的對決：等回應的邀請、進行中、或剛結束 90 秒內的（給結果卡用）。沒有就回 null。順便把到時間的結算掉。
create or replace function public.duel_now() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.duels;
begin
  if me is null then return null; end if;
  select * into d from public.duels x where (x.a = me or x.b = me) and x.status = 'active' order by x.id desc limit 1;
  if found and now() >= d.end_at then perform public._duel_settle(d.id); end if;
  select * into d from public.duels x where (x.a = me or x.b = me)
    and ((x.status = 'invited' and x.created_at > now() - interval '25 seconds') or x.status = 'active' or (x.status = 'done' and x.end_at > now() - interval '90 seconds'))
    order by (x.status = 'active') desc, x.id desc limit 1;
  if not found then return null; end if;
  return public._duel_json(d, me);
end $$;

-- 邀請對決
create or replace function public.duel_invite(p_to uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); other public.players; d public.duels;
begin
  if p_to is null or p_to = pl.id then return jsonb_build_object('err', '不能跟自己對決'); end if;
  select * into other from public.players where id = p_to;
  if not found then return jsonb_build_object('err', '找不到這位玩家'); end if;
  if public._duel_busy(pl.id) then return jsonb_build_object('err', '你已經有一場對決了'); end if;
  if public._duel_busy(p_to) then return jsonb_build_object('err', '對方正在對決，等一下再邀'); end if;
  if exists (select 1 from public.duels x where x.a = pl.id and x.created_at > now() - interval '8 seconds') then return jsonb_build_object('err', '邀請太頻繁了，等幾秒再試'); end if;
  insert into public.duels (a, b, a_name, b_name) values (pl.id, p_to, coalesce(nullif(pl.nickname, ''), '釣客'), coalesce(nullif(other.nickname, ''), '釣客')) returning * into d;
  return public._duel_json(d, pl.id);
end $$;

-- 回應邀請（接受 → 6 秒後開始，打 180 秒；拒絕）
create or replace function public.duel_answer(p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.duels;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.b <> pl.id then return jsonb_build_object('err', '找不到這個邀請'); end if;
  if d.status <> 'invited' or d.created_at <= now() - interval '30 seconds' then return jsonb_build_object('err', '這個邀請已經過期了'); end if;
  if p_ok then
    update public.duels set status = 'active', start_at = now() + interval '6 seconds', end_at = now() + interval '186 seconds' where id = d.id returning * into d;
  else
    update public.duels set status = 'declined' where id = d.id returning * into d;
  end if;
  return public._duel_json(d, pl.id);
end $$;

-- 收回還沒被回應的邀請
create or replace function public.duel_cancel(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update public.duels set status = 'cancelled' where id = p_id and a = me and status = 'invited';
  return jsonb_build_object('ok', true);
end $$;

-- 我的對決戰績
create or replace function public.duel_my_stats() returns jsonb language sql security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('wins', s.wins, 'losses', s.losses, 'draws', s.draws, 'streak', s.streak, 'best', s.best_streak) from public.duel_stats s where s.uid = auth.uid()),
                  jsonb_build_object('wins', 0, 'losses', 0, 'draws', 0, 'streak', 0, 'best', 0)) $$;

-- 釣到魚（players.total 加一）的時候，如果正在對決而且在比賽時間內，就把這條魚的重量記進去。
-- 用 trigger 掛在 players 上，不用去改 record_catch（那個函式在很舊的檔案裡，改它會讓一大串舊設定重跑）。
create or replace function public._duel_on_catch() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := coalesce(new.last_w, 0); f text := new.last_fish; item jsonb;
begin
  if f is null or w <= 0 then return new; end if;
  if (public._fishcfg()->'spots'->'shrimp'->'fish') ? f then return new; end if;   -- 釣蝦場的蝦不算
  item := jsonb_build_array(jsonb_build_object('f', f, 'w', w));
  update public.duels set a_w = a_w + w, a_n = a_n + 1, a_log = case when jsonb_array_length(a_log) < 60 then a_log || item else a_log end
    where a = new.id and status = 'active' and now() >= start_at and now() < end_at;
  update public.duels set b_w = b_w + w, b_n = b_n + 1, b_log = case when jsonb_array_length(b_log) < 60 then b_log || item else b_log end
    where b = new.id and status = 'active' and now() >= start_at and now() < end_at;
  return new;
exception when others then return new;   -- 對決記分出任何問題都不能害玩家釣不到魚
end $$;
revoke all on function public._duel_on_catch() from public, anon, authenticated;
drop trigger if exists duel_on_catch on public.players;
create trigger duel_on_catch after update of total on public.players for each row when (new.total > old.total) execute function public._duel_on_catch();

revoke all on function public.duel_now() from public, anon;
revoke all on function public.duel_invite(uuid) from public, anon;
revoke all on function public.duel_answer(bigint, boolean) from public, anon;
revoke all on function public.duel_cancel(bigint) from public, anon;
revoke all on function public.duel_my_stats() from public, anon;
grant execute on function public.duel_now() to authenticated;
grant execute on function public.duel_invite(uuid) to authenticated;
grant execute on function public.duel_answer(bigint, boolean) to authenticated;
grant execute on function public.duel_cancel(bigint) to authenticated;
grant execute on function public.duel_my_stats() to authenticated;
