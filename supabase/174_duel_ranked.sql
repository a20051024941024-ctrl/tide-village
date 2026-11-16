-- 174 ⚔️ 排位賽／友誼賽分開（v521，作者 11/17：「排位賽先做 1 跟 3」）
-- ・排位賽：只有「找對手」自動配對到的才算，贏輸才會動星星、勝敗、連勝。
-- ・友誼賽：邀請同一個大廳的人打的，只看結果，不算戰績也不算星星（朋友之間互刷不了，輸給朋友也不會掉星）。
-- 這個檔案之前建立的對決都當成友誼賽（ranked 預設 false）。可以重複執行。

alter table public.duels add column if not exists ranked boolean not null default false;

create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid; ws int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.status <> 'active' or now() < d.end_at then return; end if;
  w := case when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end;
  l := case when w is null then null when w = d.a then d.b else d.a end;
  day0 := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  select count(*) into n from public.duels x where x.status = 'done' and x.counted and x.end_at >= day0 and ((x.a = d.a and x.b = d.b) or (x.a = d.b and x.b = d.a));
  if not d.ranked then   -- 友誼賽：只記結果，不算戰績、不算星星
    update public.duels set status = 'done', winner = w, counted = false where id = d.id; return;
  end if;
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
    'winner', d.winner, 'counted', d.counted, 'ranked', d.ranked,
    'stats', jsonb_build_object('wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0),
      'stars', coalesce(s.stars, 0), 'tier', public._duel_tier(coalesce(s.stars, 0))));
end $$;
revoke all on function public._duel_json(public.duels, uuid) from public, anon, authenticated;

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
    insert into public.duels (a, b, a_name, b_name, status, start_at, end_at, ranked)
      values (o.uid, pl.id, coalesce(o.name, '釣客'), nm, 'active', now() + interval '6 seconds', now() + interval '186 seconds', true) returning * into d;
    return public._duel_json(d, pl.id);
  end if;
  insert into public.duel_queue (uid, name, stars) values (pl.id, nm, my_st)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars;
  return jsonb_build_object('queued', true, 'n', (select count(*) from public.duel_queue where seen_at > now() - interval '20 seconds'));
end $$;
revoke all on function public.duel_queue_join() from public, anon;
grant execute on function public.duel_queue_join() to authenticated;
