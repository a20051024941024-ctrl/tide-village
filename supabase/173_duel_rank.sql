-- 173 ⚔️ 釣魚對決第二步（v516，作者 11/16：「對決這個大家都說還不錯」→ 做配對、段位、排行）
-- 1. 段位：贏一局 +1 星，連勝第 3 場起每場再多 +1；輸一局 -1 星（3 星以下不扣，新手保護）；平手不變。
--    星數 → 段位：0-2 對決新手、3-7 釣竿好手、8-14 釣魚高手、15-24 海上名人、25 以上 傳說釣手。
-- 2. 自動配對：duel_queue_join 排隊；每次呼叫都會試著找另一個也在排隊的人（優先找星數接近的），找到就直接開始一場。
--    手機排隊時每 3 秒呼叫一次；超過 20 秒沒呼叫的人視為離開。
-- 3. 排行：duel_top 回傳星數前 20 名。
-- 可以重複執行。

alter table public.duel_stats add column if not exists stars integer not null default 0;

create or replace function public._duel_tier(s integer) returns text language sql immutable as $$
  select case when s >= 25 then '傳說釣手' when s >= 15 then '海上名人' when s >= 8 then '釣魚高手' when s >= 3 then '釣竿好手' else '對決新手' end $$;

-- 結算（取代 172 的版本：多算星星）
create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid; ws int;
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
    select streak into ws from public.duel_stats where uid = w;
    update public.duel_stats set wins = wins + 1, streak = streak + 1, best_streak = greatest(best_streak, streak + 1),
      stars = stars + 1 + (case when coalesce(ws, 0) + 1 >= 3 then 1 else 0 end), updated_at = now() where uid = w;
    update public.duel_stats set losses = losses + 1, streak = 0, stars = case when stars <= 3 then stars else stars - 1 end, updated_at = now() where uid = l;
  end if;
end $$;
revoke all on function public._duel_settle(bigint) from public, anon, authenticated;

-- 回傳的格式多帶星星和段位（取代 172 的版本）
create or replace function public._duel_json(d public.duels, me uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.duel_stats; oa public.duel_stats; ob public.duel_stats;
begin
  select * into s from public.duel_stats where uid = me;
  select * into oa from public.duel_stats where uid = d.a; select * into ob from public.duel_stats where uid = d.b;
  return jsonb_build_object('id', d.id, 'status', d.status, 'me', case when d.a = me then 'a' else 'b' end,
    'a', d.a, 'b', d.b, 'a_name', d.a_name, 'b_name', d.b_name,
    'a_tier', public._duel_tier(coalesce(oa.stars, 0)), 'b_tier', public._duel_tier(coalesce(ob.stars, 0)),
    'a_w', d.a_w, 'b_w', d.b_w, 'a_n', d.a_n, 'b_n', d.b_n, 'a_log', d.a_log, 'b_log', d.b_log,
    'created', (extract(epoch from d.created_at) * 1000)::bigint,
    'start', (extract(epoch from d.start_at) * 1000)::bigint, 'end', (extract(epoch from d.end_at) * 1000)::bigint,
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'winner', d.winner, 'counted', d.counted,
    'stats', jsonb_build_object('wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0),
      'stars', coalesce(s.stars, 0), 'tier', public._duel_tier(coalesce(s.stars, 0))));
end $$;
revoke all on function public._duel_json(public.duels, uuid) from public, anon, authenticated;

create or replace function public.duel_my_stats() returns jsonb language sql security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('wins', s.wins, 'losses', s.losses, 'draws', s.draws, 'streak', s.streak, 'best', s.best_streak, 'stars', s.stars, 'tier', public._duel_tier(s.stars)) from public.duel_stats s where s.uid = auth.uid()),
                  jsonb_build_object('wins', 0, 'losses', 0, 'draws', 0, 'streak', 0, 'best', 0, 'stars', 0, 'tier', public._duel_tier(0))) $$;

-- 排隊
create table if not exists public.duel_queue (
  uid uuid primary key references public.players(id) on delete cascade,
  name text, stars integer not null default 0,
  joined_at timestamptz not null default now(), seen_at timestamptz not null default now()
);
alter table public.duel_queue enable row level security;

create or replace function public.duel_queue_join() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); my_st int; o public.duel_queue; d public.duels; nm text;
begin
  if public._duel_busy(pl.id) then
    delete from public.duel_queue where uid = pl.id;
    return coalesce(public.duel_now(), jsonb_build_object('err', '你已經有一場對決了'));
  end if;
  delete from public.duel_queue where seen_at < now() - interval '20 seconds';
  select coalesce(stars, 0) into my_st from public.duel_stats where uid = pl.id; my_st := coalesce(my_st, 0);
  nm := coalesce(nullif(pl.nickname, ''), '釣客');
  -- 找另一個在排隊的人：星數差越小越優先，再來是排比較久的
  select * into o from public.duel_queue q where q.uid <> pl.id and not public._duel_busy(q.uid)
    order by abs(q.stars - my_st), q.joined_at limit 1 for update skip locked;
  if found then
    delete from public.duel_queue where uid in (pl.id, o.uid);
    insert into public.duels (a, b, a_name, b_name, status, start_at, end_at)
      values (o.uid, pl.id, coalesce(o.name, '釣客'), nm, 'active', now() + interval '6 seconds', now() + interval '186 seconds') returning * into d;
    return public._duel_json(d, pl.id);
  end if;
  insert into public.duel_queue (uid, name, stars) values (pl.id, nm, my_st)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars;
  return jsonb_build_object('queued', true, 'n', (select count(*) from public.duel_queue where seen_at > now() - interval '20 seconds'));
end $$;

create or replace function public.duel_queue_leave() returns jsonb language plpgsql security definer set search_path = public as $$
begin delete from public.duel_queue where uid = auth.uid(); return jsonb_build_object('ok', true); end $$;

-- 排行：星數前 20 名（星數一樣比勝場）
create or replace function public.duel_top() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'stars')::int desc, (r->>'wins')::int desc), '[]'::jsonb) from (
    select jsonb_build_object('n', coalesce(nullif(p.nickname, ''), '釣客'), 'stars', s.stars, 'wins', s.wins, 'losses', s.losses, 'best', s.best_streak, 'tier', public._duel_tier(s.stars), 'me', s.uid = auth.uid()) r
    from public.duel_stats s join public.players p on p.id = s.uid where s.wins + s.losses > 0
    order by s.stars desc, s.wins desc limit 20) t $$;

revoke all on function public.duel_queue_join() from public, anon;
revoke all on function public.duel_queue_leave() from public, anon;
revoke all on function public.duel_top() from public, anon;
grant execute on function public.duel_queue_join() to authenticated;
grant execute on function public.duel_queue_leave() to authenticated;
grant execute on function public.duel_top() to authenticated;
grant execute on function public.duel_my_stats() to authenticated;
