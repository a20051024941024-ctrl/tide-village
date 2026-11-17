-- 187 ⚔️ 排位賽賽季＋指定釣點賽（v551，作者 11/17：「星星每月重算也加」「然後指定釣點賽也加」）。可以重複執行。
-- 【賽季】每個月（台灣時間）是一季。換月以後第一次用到戰績時才結算（不用排程）：
--   ・上一季的最高星數記到 prev_peak（資料頁會顯示「上一季最高：某段位」）；
--   ・星星保留一半（無條件捨去），本季勝敗 s_wins／s_losses 歸零；總勝敗、最多連勝不動。
--   ・第一季從現在開始：現有的星星原封不動當作這一季的。
-- 【指定釣點賽】每天（台灣時間）輪一個本島釣點（月灣河岸、鏡湖、清溪潭、晴潮海邊、港口外海）。
--   ・排隊時可以選「指定釣點賽」，只會配到也選這個的人；開始前多給 12 秒走位。
--   ・只有在指定釣點釣到的魚才算分（伺服器照那一竿的釣點判斷，手機改不了）。一樣是排位賽，算星星。

alter table public.duel_stats add column if not exists season text;
alter table public.duel_stats add column if not exists peak integer not null default 0;
alter table public.duel_stats add column if not exists prev_season text;
alter table public.duel_stats add column if not exists prev_peak integer not null default 0;
alter table public.duel_stats add column if not exists s_wins integer not null default 0;
alter table public.duel_stats add column if not exists s_losses integer not null default 0;
alter table public.duel_queue add column if not exists spot text;
alter table public.duels add column if not exists spot text;

create or replace function public._duel_season() returns text language sql stable as $$ select to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM') $$;
create or replace function public._duel_day_spot() returns text language sql stable as $$
  select (array['river', 'lake', 'pool', 'sea', 'harbor'])[1 + (extract(doy from (now() at time zone 'Asia/Taipei'))::int % 5)] $$;
-- 還沒結算到這一季的人，星星先當作已經減半（只讀的地方用）
create or replace function public._duel_stars(s public.duel_stats) returns integer language sql stable as $$
  select case when s.season is null or s.season = public._duel_season() then coalesce(s.stars, 0) else coalesce(s.stars, 0) / 2 end $$;
-- 第一季：現有的人直接算進這一季（只會做一次）
update public.duel_stats set season = public._duel_season(), peak = stars, s_wins = wins, s_losses = losses where season is null;

create or replace function public._duel_roll(p_uid uuid) returns void language plpgsql security definer set search_path = public as $$
declare cur text := public._duel_season();
begin
  update public.duel_stats set prev_season = season, prev_peak = greatest(peak, stars), stars = stars / 2, peak = stars / 2, s_wins = 0, s_losses = 0, season = cur
    where uid = p_uid and season is distinct from cur and season is not null;
  update public.duel_stats set season = cur, peak = stars where uid = p_uid and season is null;
end $$;

create or replace function public._duel_on_catch() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := coalesce(new.last_w, 0); f text := new.last_fish; item jsonb; sp text;
begin
  if f is null or w <= 0 then return new; end if;
  if (public._fishcfg()->'spots'->'shrimp'->'fish') ? f then return new; end if;   -- 釣蝦場的蝦不算
  select cs.spot into sp from public.casts cs where cs.uid = new.id;   -- 這一竿是在哪個釣點釣的（record_catch 更新 players 的時候這一列還在）
  item := jsonb_build_array(jsonb_build_object('f', f, 'w', w));
  update public.duels set a_w = a_w + w, a_n = a_n + 1, a_log = case when jsonb_array_length(a_log) < 60 then a_log || item else a_log end
    where a = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  update public.duels set b_w = b_w + w, b_n = b_n + 1, b_log = case when jsonb_array_length(b_log) < 60 then b_log || item else b_log end
    where b = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  return new;
exception when others then return new;   -- 對決記分出任何問題都不能害玩家釣不到魚
end $$;

create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid; ws int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.status <> 'active' or now() < d.end_at + interval '12 seconds' then return; end if;
  w := case when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end;
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
    'winner', d.winner, 'counted', d.counted, 'ranked', d.ranked, 'spot', d.spot,
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
    'season', public._duel_season(), 'spot', public._duel_day_spot(),
    'prev', case when s.prev_season is null then null else jsonb_build_object('season', s.prev_season, 'stars', s.prev_peak, 'tier', public._duel_tier(s.prev_peak)) end);
end $$;

-- 排行：只列這一季打過的人，勝敗也是這一季的
create or replace function public.duel_top() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'stars')::int desc, (r->>'wins')::int desc), '[]'::jsonb) from (
    select jsonb_build_object('n', coalesce(nullif(p.nickname, ''), '釣客'), 'stars', s.stars, 'wins', s.s_wins, 'losses', s.s_losses, 'best', s.best_streak, 'tier', public._duel_tier(s.stars), 'me', s.uid = auth.uid()) r
    from public.duel_stats s join public.players p on p.id = s.uid where s.season = public._duel_season() and s.s_wins + s.s_losses > 0
    order by s.stars desc, s.s_wins desc limit 20) t $$;

create or replace function public.duel_queue_join2(p_spot text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); my_st int; o public.duel_queue; d public.duels; nm text; lead interval;
begin
  if p_spot is not null and p_spot <> public._duel_day_spot() then return jsonb_build_object('err', '今天的指定釣點換了，重新按一次'); end if;
  if public._duel_busy(pl.id) then
    delete from public.duel_queue where uid = pl.id;
    return coalesce(public.duel_now(), jsonb_build_object('err', '你已經有一場對決了'));
  end if;
  delete from public.duel_queue where seen_at < now() - interval '20 seconds';
  perform public._duel_roll(pl.id);
  select coalesce(stars, 0) into my_st from public.duel_stats where uid = pl.id; my_st := coalesce(my_st, 0);
  nm := coalesce(nullif(pl.nickname, ''), '釣客');
  -- 找另一個在排隊的人（要選同一種：一般，或今天的指定釣點）：星數差越小越優先，再來是排比較久的
  select * into o from public.duel_queue q where q.uid <> pl.id and q.spot is not distinct from p_spot and not public._duel_busy(q.uid)
    order by abs(q.stars - my_st), q.joined_at limit 1 for update skip locked;
  if found then
    delete from public.duel_queue where uid in (pl.id, o.uid);
    lead := case when p_spot is null then interval '6 seconds' else interval '12 seconds' end;
    insert into public.duels (a, b, a_name, b_name, status, start_at, end_at, ranked, spot)
      values (o.uid, pl.id, coalesce(o.name, '釣客'), nm, 'active', now() + lead, now() + lead + interval '180 seconds', true, p_spot) returning * into d;
    return public._duel_json(d, pl.id);
  end if;
  insert into public.duel_queue (uid, name, stars, spot) values (pl.id, nm, my_st, p_spot)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars, spot = excluded.spot;
  return jsonb_build_object('queued', true, 'n', (select count(*) from public.duel_queue where seen_at > now() - interval '20 seconds' and spot is not distinct from p_spot));
end $$;
-- 舊版手機還在叫沒有參數的那個：當成一般排位賽
create or replace function public.duel_queue_join() returns jsonb language sql security definer set search_path = public as $$ select public.duel_queue_join2(null) $$;

create or replace function public.duel_queue_peek() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.spot is null and q.seen_at > now() - interval '20 seconds'),
    'sn', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.spot is not null and q.seen_at > now() - interval '20 seconds'),
    'spot', public._duel_day_spot()) $$;

create or replace function public.player_card(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.players; s public.duel_stats; t public.teams; top jsonb; dex int; picked boolean := false;
begin
  select * into p from public.players where id = p_uid;
  if not found then return jsonb_build_object('err', '找不到這位玩家'); end if;
  select * into s from public.duel_stats where uid = p_uid;
  select tm.* into t from public.team_members m join public.teams tm on tm.id = m.team where m.uid = p_uid limit 1;
  if p.card_fish is not null and jsonb_typeof(p.card_fish) = 'array' and jsonb_array_length(p.card_fish) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('f', c.k, 'w', (p.fish_best->c.k)::text::numeric) order by c.ord), '[]'::jsonb) into top
      from jsonb_array_elements_text(p.card_fish) with ordinality c(k, ord) where coalesce(p.fish_best, '{}'::jsonb) ? c.k and jsonb_typeof(p.fish_best->c.k) = 'number';
    picked := jsonb_array_length(top) > 0;
  end if;
  if not picked then
    select coalesce(jsonb_agg(jsonb_build_object('f', k, 'w', v) order by v desc), '[]'::jsonb) into top
      from (select e.key k, (e.value)::text::numeric v from jsonb_each(coalesce(p.fish_best, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number' order by 2 desc limit 3) x;
  end if;
  select count(*) into dex from jsonb_object_keys(coalesce(p.fish_count, '{}'::jsonb));
  return jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'total', p.total, 'legend', p.legend, 'dex', dex,
    'best_fish', p.best_fish, 'best_w', p.best_w, 'top', top, 'picked', picked, 'likes', coalesce(p.likes, 0), 'motto', coalesce(p.motto, ''), 'avatar', coalesce(p.avatar, ''), 'gear', p.gear, 'count', coalesce(p.fish_count, '{}'::jsonb), 'released', coalesce(p.released, 0),
    'since', (extract(epoch from p.created_at) * 1000)::bigint,
    'team', case when t.id is null then null else jsonb_build_object('name', t.name, 'badge', t.badge, 'color', t.color) end,
    'duel', case when s.uid is null then null else jsonb_build_object('wins', s.wins, 'losses', s.losses, 'best', s.best_streak, 'stars', public._duel_stars(s), 'tier', public._duel_tier(public._duel_stars(s)),
      'season', public._duel_season(),
      'prev', case when s.season = public._duel_season() then (case when s.prev_season is null then null else jsonb_build_object('season', s.prev_season, 'stars', s.prev_peak, 'tier', public._duel_tier(s.prev_peak)) end)
                   else jsonb_build_object('season', s.season, 'stars', greatest(s.peak, s.stars), 'tier', public._duel_tier(greatest(s.peak, s.stars))) end) end,
    'sports', (select coalesce(jsonb_object_agg(x.sport, jsonb_build_object('w', x.wins, 'l', x.losses, 'd', x.draws)), '{}'::jsonb) from public.sport_stats x where x.uid = p_uid),
    'explore', coalesce(p.explore, '[]'::jsonb),
    'tourney', jsonb_build_object('best', p.tourney_best, 'plays', coalesce(p.tourney_plays, 0), 'top3', coalesce(p.tourney_top3, 0)),
    'recent', public._card_recent(p_uid),
    'race', (select coalesce(jsonb_object_agg(x.kind, jsonb_build_object('best', x.best_ms, 'runs', x.runs)), '{}'::jsonb) from public.race_best x where x.uid = p_uid),
    'me', p.id = auth.uid());
end $$;

revoke all on function public._duel_roll(uuid) from public, anon, authenticated;
revoke all on function public._duel_settle(bigint) from public, anon, authenticated;
revoke all on function public._duel_on_catch() from public, anon, authenticated;
revoke all on function public.duel_queue_join2(text) from public, anon;
grant execute on function public.duel_queue_join2(text) to authenticated;
revoke all on function public.duel_queue_join() from public, anon;
grant execute on function public.duel_queue_join() to authenticated;
revoke all on function public.duel_queue_peek() from public, anon;
grant execute on function public.duel_queue_peek() to authenticated;
revoke all on function public.duel_my_stats() from public, anon;
grant execute on function public.duel_my_stats() to authenticated;
revoke all on function public.duel_top() from public, anon;
grant execute on function public.duel_top() to authenticated;
revoke all on function public.player_card(uuid) from public, anon;
grant execute on function public.player_card(uuid) to authenticated;
