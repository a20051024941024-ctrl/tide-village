-- 194 ⚔️ 對決的變化玩法（v562，作者 11/18 同意）。可以重複執行。
-- 玩家不多，再多開排隊會更難配到人。所以排隊還是只有兩種：「一般排位賽」和「今天的特別賽」。
-- 【每日特別賽】每天（台灣時間）輪一種：
--   spot  指定釣點賽（187 原本的）：只有在今天的指定釣點釣到的才算，比總重量
--   big   大魚賽：只比最大的一條
--   count 多魚賽：比釣到幾條（一樣多就比總重量）
-- 【友誼賽】邀請的人可以自己選要比哪一種（duel_invite2）。
-- duels.mode／duel_queue.mode：null＝一般（總重量）。duels 多記 a_big／b_big（最大的一條）。
-- 舊版手機：duel_queue_join2(釣點) 只有在今天剛好是指定釣點賽時才接受；duel_queue_peek／duel_my_stats 的 spot 只有那天才回傳，舊版就不會顯示特別賽。

alter table public.duels add column if not exists mode text;
alter table public.duels add column if not exists a_big numeric(10,2) not null default 0;
alter table public.duels add column if not exists b_big numeric(10,2) not null default 0;
alter table public.duel_queue add column if not exists mode text;
update public.duels set mode = 'spot' where spot is not null and mode is null;
update public.duel_queue set mode = 'spot' where spot is not null and mode is null;

create or replace function public._duel_day_mode() returns text language sql stable as $$
  select (array['spot', 'big', 'count'])[1 + (((now() at time zone 'Asia/Taipei')::date - date '2026-01-01') % 3)] $$;

create or replace function public._duel_on_catch() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := coalesce(new.last_w, 0); f text := new.last_fish; item jsonb; sp text;
begin
  if f is null or w <= 0 then return new; end if;
  if (public._fishcfg()->'spots'->'shrimp'->'fish') ? f then return new; end if;   -- 釣蝦場的蝦不算
  select cs.spot into sp from public.casts cs where cs.uid = new.id;   -- 這一竿是在哪個釣點釣的（record_catch 更新 players 的時候這一列還在）
  item := jsonb_build_array(jsonb_build_object('f', f, 'w', w));
  update public.duels set a_w = a_w + w, a_n = a_n + 1, a_big = greatest(a_big, w), a_log = case when jsonb_array_length(a_log) < 60 then a_log || item else a_log end
    where a = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  update public.duels set b_w = b_w + w, b_n = b_n + 1, b_big = greatest(b_big, w), b_log = case when jsonb_array_length(b_log) < 60 then b_log || item else b_log end
    where b = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  return new;
exception when others then return new;   -- 對決記分出任何問題都不能害玩家釣不到魚
end $$;

create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid; ws int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.status <> 'active' or now() < d.end_at + interval '12 seconds' then return; end if;
  w := case d.mode
         when 'big'   then (case when d.a_big > d.b_big then d.a when d.b_big > d.a_big then d.b else null end)                      -- 大魚賽：只比最大的一條
         when 'count' then (case when d.a_n > d.b_n then d.a when d.b_n > d.a_n then d.b when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end)   -- 多魚賽：比條數，一樣多就比總重量
         else (case when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end) end;
  l := case when w is null then null when w = d.a then d.b else d.a end;
  day0 := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  select count(*) into n from public.duels x where x.status = 'done' and x.counted and x.end_at >= day0 and ((x.a = d.a and x.b = d.b) or (x.a = d.b and x.b = d.a));
  if not d.ranked then   -- 友誼賽：只記結果，不算戰績、不算星星
    update public.duels set status = 'done', winner = w, counted = false where id = d.id; return;
  end if;
  update public.duels set status = 'done', winner = w, counted = (n < 3) where id = d.id;
  if n >= 3 then return; end if;
  insert into public.duel_stats (uid, season) values (d.a, public._duel_season()), (d.b, public._duel_season()) on conflict (uid) do nothing;
  perform public._duel_roll(d.a); perform public._duel_roll(d.b);   -- 換月了就先結算上一季
  if w is null then
    update public.duel_stats set draws = draws + 1, updated_at = now() where uid in (d.a, d.b);
  else
    select streak into ws from public.duel_stats where uid = w;
    update public.duel_stats set wins = wins + 1, s_wins = s_wins + 1, streak = streak + 1, best_streak = greatest(best_streak, streak + 1),
      stars = stars + 1 + (case when coalesce(ws, 0) + 1 >= 3 then 1 else 0 end),
      peak = greatest(peak, stars + 1 + (case when coalesce(ws, 0) + 1 >= 3 then 1 else 0 end)), updated_at = now() where uid = w;
    update public.duel_stats set losses = losses + 1, s_losses = s_losses + 1, streak = 0, stars = case when stars <= 3 then stars else stars - 1 end, updated_at = now() where uid = l;
  end if;
end $$;

create or replace function public._duel_json(d public.duels, me uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.duel_stats; oa public.duel_stats; ob public.duel_stats;
begin
  select * into s from public.duel_stats where uid = me;
  select * into oa from public.duel_stats where uid = d.a; select * into ob from public.duel_stats where uid = d.b;
  return jsonb_build_object('id', d.id, 'status', d.status, 'me', case when d.a = me then 'a' else 'b' end,
    'a', d.a, 'b', d.b, 'a_name', d.a_name, 'b_name', d.b_name,
    'a_tier', public._duel_tier(public._duel_stars(oa)), 'b_tier', public._duel_tier(public._duel_stars(ob)),
    'a_w', d.a_w, 'b_w', d.b_w, 'a_n', d.a_n, 'b_n', d.b_n, 'a_log', d.a_log, 'b_log', d.b_log,
    'created', (extract(epoch from d.created_at) * 1000)::bigint,
    'start', (extract(epoch from d.start_at) * 1000)::bigint, 'end', (extract(epoch from d.end_at) * 1000)::bigint,
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'winner', d.winner, 'counted', d.counted, 'ranked', d.ranked, 'spot', d.spot, 'mode', d.mode, 'a_big', d.a_big, 'b_big', d.b_big,
    'stats', jsonb_build_object('wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0),
      'stars', public._duel_stars(s), 'tier', public._duel_tier(public._duel_stars(s))));
end $$;
revoke all on function public._duel_json(public.duels, uuid) from public, anon, authenticated;

create or replace function public.duel_my_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.duel_stats;
begin
  perform public._duel_roll(auth.uid());
  select * into s from public.duel_stats where uid = auth.uid();
  return jsonb_build_object('wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0),
    'stars', coalesce(s.stars, 0), 'tier', public._duel_tier(coalesce(s.stars, 0)), 's_wins', coalesce(s.s_wins, 0), 's_losses', coalesce(s.s_losses, 0),
    'season', public._duel_season(), 'mode', public._duel_day_mode(), 'spot', case when public._duel_day_mode() = 'spot' then public._duel_day_spot() end,
    'prev', case when s.prev_season is null then null else jsonb_build_object('season', s.prev_season, 'stars', s.prev_peak, 'tier', public._duel_tier(s.prev_peak)) end);
end $$;

create or replace function public.duel_queue_join3(p_mode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p_spot text; my_st int; o public.duel_queue; d public.duels; nm text; lead interval;
begin
  if p_mode is not null and p_mode <> public._duel_day_mode() then return jsonb_build_object('err', '今天的特別賽換了，重新按一次'); end if;
  p_spot := case when p_mode = 'spot' then public._duel_day_spot() end;
  if public._duel_busy(pl.id) then
    delete from public.duel_queue where uid = pl.id;
    return coalesce(public.duel_now(), jsonb_build_object('err', '你已經有一場對決了'));
  end if;
  delete from public.duel_queue where seen_at < now() - interval '20 seconds';
  perform public._duel_roll(pl.id);
  select coalesce(stars, 0) into my_st from public.duel_stats where uid = pl.id; my_st := coalesce(my_st, 0);
  nm := coalesce(nullif(pl.nickname, ''), '釣客');
  -- 找另一個在排隊的人（要選同一種：一般，或今天的指定釣點）：星數差越小越優先，再來是排比較久的
  select * into o from public.duel_queue q where q.uid <> pl.id and q.mode is not distinct from p_mode and not public._duel_busy(q.uid)
    order by abs(q.stars - my_st), q.joined_at limit 1 for update skip locked;
  if found then
    delete from public.duel_queue where uid in (pl.id, o.uid);
    lead := case when p_spot is null then interval '6 seconds' else interval '12 seconds' end;
    insert into public.duels (a, b, a_name, b_name, status, start_at, end_at, ranked, spot, mode)
      values (o.uid, pl.id, coalesce(o.name, '釣客'), nm, 'active', now() + lead, now() + lead + interval '180 seconds', true, p_spot, p_mode) returning * into d;
    return public._duel_json(d, pl.id);
  end if;
  insert into public.duel_queue (uid, name, stars, spot, mode) values (pl.id, nm, my_st, p_spot, p_mode)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars, spot = excluded.spot, mode = excluded.mode;
  return jsonb_build_object('queued', true, 'n', (select count(*) from public.duel_queue where seen_at > now() - interval '20 seconds' and mode is not distinct from p_mode));
end $$;
-- 舊版手機
create or replace function public.duel_queue_join2(p_spot text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_spot is null then return public.duel_queue_join3(null); end if;
  if public._duel_day_mode() = 'spot' and p_spot = public._duel_day_spot() then return public.duel_queue_join3('spot'); end if;
  return jsonb_build_object('err', '今天的特別賽換了，請先更新遊戲再排');
end $$;
create or replace function public.duel_queue_join() returns jsonb language sql security definer set search_path = public as $$ select public.duel_queue_join3(null) $$;

create or replace function public.duel_queue_peek() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.mode is null and q.seen_at > now() - interval '20 seconds'),
    'sn', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.mode = public._duel_day_mode() and q.seen_at > now() - interval '20 seconds'),
    'mode', public._duel_day_mode(), 'dspot', public._duel_day_spot(),
    'spot', case when public._duel_day_mode() = 'spot' then public._duel_day_spot() end) $$;

-- 友誼賽：邀請的人選玩法
create or replace function public.duel_invite2(p_to uuid, p_mode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); other public.players; d public.duels;
begin
  if p_mode is not null and p_mode not in ('spot', 'big', 'count') then p_mode := null; end if;
  if p_to is null or p_to = pl.id then return jsonb_build_object('err', '不能跟自己對決'); end if;
  select * into other from public.players where id = p_to;
  if not found then return jsonb_build_object('err', '找不到這位玩家'); end if;
  if public._duel_busy(pl.id) then return jsonb_build_object('err', '你已經有一場對決了'); end if;
  if public._duel_busy(p_to) then return jsonb_build_object('err', '對方正在對決，等一下再邀'); end if;
  if exists (select 1 from public.duels x where x.a = pl.id and x.created_at > now() - interval '8 seconds') then return jsonb_build_object('err', '邀請太頻繁了，等幾秒再試'); end if;
  insert into public.duels (a, b, a_name, b_name, mode, spot) values (pl.id, p_to, coalesce(nullif(pl.nickname, ''), '釣客'), coalesce(nullif(other.nickname, ''), '釣客'), p_mode, case when p_mode = 'spot' then public._duel_day_spot() end) returning * into d;
  return public._duel_json(d, pl.id);
end $$;
-- 回應邀請：指定釣點的友誼賽也給 12 秒走位
create or replace function public.duel_answer(p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.duels; lead interval;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.b <> pl.id then return jsonb_build_object('err', '找不到這個邀請'); end if;
  if d.status <> 'invited' or d.created_at <= now() - interval '30 seconds' then return jsonb_build_object('err', '這個邀請已經過期了'); end if;
  if p_ok then
    lead := case when d.spot is null then interval '6 seconds' else interval '12 seconds' end;
    update public.duels set status = 'active', start_at = now() + lead, end_at = now() + lead + interval '180 seconds' where id = d.id returning * into d;
  else
    update public.duels set status = 'declined' where id = d.id returning * into d;
  end if;
  return public._duel_json(d, pl.id);
end $$;
create or replace function public.duel_invite(p_to uuid) returns jsonb language sql security definer set search_path = public as $$ select public.duel_invite2(p_to, null) $$;

revoke all on function public._duel_settle(bigint) from public, anon, authenticated;
revoke all on function public._duel_on_catch() from public, anon, authenticated;
revoke all on function public._duel_day_mode() from public, anon;
revoke all on function public.duel_queue_join3(text) from public, anon;
grant execute on function public.duel_queue_join3(text) to authenticated;
revoke all on function public.duel_queue_join2(text) from public, anon;
grant execute on function public.duel_queue_join2(text) to authenticated;
revoke all on function public.duel_queue_join() from public, anon;
grant execute on function public.duel_queue_join() to authenticated;
revoke all on function public.duel_queue_peek() from public, anon;
grant execute on function public.duel_queue_peek() to authenticated;
revoke all on function public.duel_my_stats() from public, anon;
grant execute on function public.duel_my_stats() to authenticated;
revoke all on function public.duel_invite2(uuid, text) from public, anon;
grant execute on function public.duel_invite2(uuid, text) to authenticated;
revoke all on function public.duel_invite(uuid) from public, anon;
grant execute on function public.duel_invite(uuid) to authenticated;

select '對決變化玩法設定完成 ⚔️' as result;
