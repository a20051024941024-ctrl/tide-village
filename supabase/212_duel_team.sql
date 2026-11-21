-- 212 👥 小組對決（2 對 2）（v668，作者 11/21：「對決能有小組對決嗎」→ 同意設計：2 對 2、先不算星星）。可以重複執行。
-- ・一場一樣 3 分鐘，比兩隊加起來的總重量（mode 照舊：null 總重量／big／count）。分數伺服器算。
-- ・兩種開法：
--   1. 邀請（同一個大廳）：開的人選 1 個隊友＋2 個對手，三個人都按接受才開始（40 秒內）。
--   2. 小組找對手（duel_team_queue）：自己排，或跟朋友互相指定對方當隊友一起排。湊滿 4 人就開：兩組朋友就朋友對朋友；
--      一組朋友＋兩個單獨的，單獨的兩個人一隊；四個都單獨的，照星星平均分（最強＋最弱一隊）。
-- ・不算星星、不算戰績（ranked = false），結果卡顯示誰贏、這場誰釣最重。
-- duels 多記：team、a2／b2（隊友）、a2_name／b2_name、acc（已經接受的人）、am／bm（每個人各釣了多重 {uid: kg}）。
-- a_w／b_w 是整隊加起來的（舊的畫面照樣能顯示比分）；winner 是隊長（a 或 b）。

alter table public.duels add column if not exists team boolean not null default false;
alter table public.duels add column if not exists a2 uuid references public.players(id) on delete cascade;
alter table public.duels add column if not exists b2 uuid references public.players(id) on delete cascade;
alter table public.duels add column if not exists a2_name text;
alter table public.duels add column if not exists b2_name text;
alter table public.duels add column if not exists acc uuid[] not null default '{}';
alter table public.duels add column if not exists am jsonb not null default '{}'::jsonb;
alter table public.duels add column if not exists bm jsonb not null default '{}'::jsonb;
create index if not exists duels_a2_idx on public.duels (a2, id desc);
create index if not exists duels_b2_idx on public.duels (b2, id desc);
alter table public.duel_queue add column if not exists mate uuid;

create or replace function public._duel_busy(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duels d where (d.a = p_uid or d.b = p_uid or d.a2 = p_uid or d.b2 = p_uid)
    and ((d.status = 'invited' and d.created_at > now() - case when d.team then interval '40 seconds' else interval '25 seconds' end)
      or (d.status = 'active' and d.end_at + interval '12 seconds' > now()))) $$;
revoke all on function public._duel_busy(uuid) from public, anon, authenticated;

create or replace function public._duel_on_catch() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := coalesce(new.last_w, 0); f text := new.last_fish; item jsonb; sp text; k text := new.id::text;
begin
  if f is null or w <= 0 then return new; end if;
  if (public._fishcfg()->'spots'->'shrimp'->'fish') ? f then return new; end if;   -- 釣蝦場的蝦不算
  select cs.spot into sp from public.casts cs where cs.uid = new.id;
  item := jsonb_build_array(jsonb_build_object('f', f, 'w', w, 'u', k));
  update public.duels set a_w = a_w + w, a_n = a_n + 1, a_big = greatest(a_big, w), a_log = case when jsonb_array_length(a_log) < 60 then a_log || item else a_log end,
      am = case when team then jsonb_set(am, array[k], to_jsonb(coalesce((am ->> k)::numeric, 0) + w)) else am end
    where (a = new.id or a2 = new.id) and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  update public.duels set b_w = b_w + w, b_n = b_n + 1, b_big = greatest(b_big, w), b_log = case when jsonb_array_length(b_log) < 60 then b_log || item else b_log end,
      bm = case when team then jsonb_set(bm, array[k], to_jsonb(coalesce((bm ->> k)::numeric, 0) + w)) else bm end
    where (b = new.id or b2 = new.id) and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds' and (spot is null or spot = sp);
  return new;
exception when others then return new;   -- 對決記分出任何問題都不能害玩家釣不到魚
end $$;
revoke all on function public._duel_on_catch() from public, anon, authenticated;

create or replace function public._duel_json(d public.duels, me uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.duel_stats; oa public.duel_stats; ob public.duel_stats;
begin
  select * into s from public.duel_stats where uid = me;
  select * into oa from public.duel_stats where uid = d.a; select * into ob from public.duel_stats where uid = d.b;
  return jsonb_build_object('id', d.id, 'status', d.status, 'me', case when d.a = me or d.a2 = me then 'a' else 'b' end, 'uid', me,
    'a', d.a, 'b', d.b, 'a_name', d.a_name, 'b_name', d.b_name,
    'team', d.team, 'a2', d.a2, 'b2', d.b2, 'a2_name', d.a2_name, 'b2_name', d.b2_name, 'acc', to_jsonb(d.acc), 'am', d.am, 'bm', d.bm,
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

create or replace function public.duel_now() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.duels;
begin
  if me is null then return null; end if;
  select * into d from public.duels x where (x.a = me or x.b = me or x.a2 = me or x.b2 = me) and x.status = 'active' order by x.id desc limit 1;
  if found and now() >= d.end_at + interval '12 seconds' then perform public._duel_settle(d.id); end if;
  select * into d from public.duels x where (x.a = me or x.b = me or x.a2 = me or x.b2 = me)
    and ((x.status = 'invited' and x.created_at > now() - case when x.team then interval '40 seconds' else interval '25 seconds' end) or x.status = 'active' or (x.status = 'done' and x.end_at > now() - interval '90 seconds'))
    order by (x.status = 'active') desc, x.id desc limit 1;
  if not found then return null; end if;
  return public._duel_json(d, me);
end $$;

-- 邀請小組對決：自己＋隊友 對 兩個對手（都要在線上；三個人都按接受才開始）
create or replace function public.duel_team_invite(p_mate uuid, p_op1 uuid, p_op2 uuid, p_mode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.players; o1 public.players; o2 public.players; d public.duels; x uuid;
begin
  if p_mode is not null and p_mode not in ('big', 'count') then p_mode := null; end if;
  if p_mate is null or p_op1 is null or p_op2 is null then return jsonb_build_object('err', '要選 1 個隊友和 2 個對手'); end if;
  if array_length(array(select distinct u from unnest(array[pl.id, p_mate, p_op1, p_op2]) u), 1) <> 4 then return jsonb_build_object('err', '四個人要都不一樣'); end if;
  select * into m from public.players where id = p_mate; select * into o1 from public.players where id = p_op1; select * into o2 from public.players where id = p_op2;
  if m.id is null or o1.id is null or o2.id is null then return jsonb_build_object('err', '找不到這位玩家'); end if;
  if public._duel_busy(pl.id) then return jsonb_build_object('err', '你已經有一場對決了'); end if;
  foreach x in array array[p_mate, p_op1, p_op2] loop
    if public._duel_busy(x) then return jsonb_build_object('err', '有人正在對決，等一下再邀'); end if;
  end loop;
  if exists (select 1 from public.duels y where y.a = pl.id and y.created_at > now() - interval '8 seconds') then return jsonb_build_object('err', '邀請太頻繁了，等幾秒再試'); end if;
  insert into public.duels (a, a2, b, b2, a_name, a2_name, b_name, b2_name, team, mode, acc)
    values (pl.id, p_mate, p_op1, p_op2, coalesce(nullif(pl.nickname, ''), '釣客'), coalesce(nullif(m.nickname, ''), '釣客'), coalesce(nullif(o1.nickname, ''), '釣客'), coalesce(nullif(o2.nickname, ''), '釣客'),
            true, p_mode, array[pl.id]) returning * into d;
  return public._duel_json(d, pl.id);
end $$;

-- 被邀的人回應：都接受了就 6 秒後開始；有人拒絕整場取消
create or replace function public.duel_team_answer(p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.duels;
begin
  select * into d from public.duels where id = p_id and team for update;
  if not found or pl.id not in (d.a2, d.b, d.b2) then return jsonb_build_object('err', '找不到這個邀請'); end if;
  if d.status <> 'invited' or d.created_at <= now() - interval '45 seconds' then return jsonb_build_object('err', '這個邀請已經過期了'); end if;
  if not p_ok then update public.duels set status = 'declined' where id = d.id returning * into d; return public._duel_json(d, pl.id); end if;
  if not (pl.id = any(d.acc)) then update public.duels set acc = acc || pl.id where id = d.id returning * into d; end if;
  if d.a2 = any(d.acc) and d.b = any(d.acc) and d.b2 = any(d.acc) then
    update public.duels set status = 'active', start_at = now() + interval '6 seconds', end_at = now() + interval '186 seconds' where id = d.id returning * into d;
  end if;
  return public._duel_json(d, pl.id);
end $$;

-- 小組找對手：p_mate＝想跟誰一隊（對方也要選你才算），null＝自己排
create or replace function public.duel_team_queue(p_mate uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); nm text; st int; r record; ids uuid[] := '{}'; nms text[] := '{}'; sts int[] := '{}'; mates uuid[] := '{}';
  ta uuid[]; tb uuid[]; i int; j int; d public.duels; used uuid[] := '{}'; pairs uuid[][] := '{}'; singles uuid[] := '{}'; myq public.duel_queue; tmp uuid[];
begin
  if p_mate = pl.id then p_mate := null; end if;
  if public._duel_busy(pl.id) then delete from public.duel_queue where uid = pl.id; return coalesce(public.duel_now(), jsonb_build_object('err', '你已經有一場對決了')); end if;
  delete from public.duel_queue where seen_at < now() - interval '20 seconds';
  select coalesce(stars, 0) into st from public.duel_stats where uid = pl.id; st := coalesce(st, 0);
  nm := coalesce(nullif(pl.nickname, ''), '釣客');
  insert into public.duel_queue (uid, name, stars, spot, mode, mate) values (pl.id, nm, st, null, 'team', p_mate)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars, spot = null, mode = 'team', mate = excluded.mate;
  -- 排隊的人（先排的先），朋友組要兩邊都指定對方
  for r in select q.* from public.duel_queue q where q.mode = 'team' and q.seen_at > now() - interval '20 seconds' order by q.joined_at for update skip locked loop
    if public._duel_busy(r.uid) then continue; end if;
    ids := ids || r.uid; nms := nms || coalesce(r.name, '釣客'); sts := sts || coalesce(r.stars, 0); mates := mates || r.mate;
  end loop;
  -- 找出朋友組（互相指定）和單獨的人
  for i in 1 .. coalesce(array_length(ids, 1), 0) loop
    if ids[i] = any(used) then continue; end if;
    j := array_position(ids, mates[i]);
    if j is not null and mates[j] = ids[i] then
      pairs := pairs || array[array[ids[i], ids[j]]]; used := used || ids[i] || ids[j];
    elsif mates[i] is null then singles := singles || ids[i]; used := used || ids[i];
    end if;   -- 指定了朋友但朋友還沒來（或沒選你）：先等，不拿去配
  end loop;
  -- 我自己一定要在這場裡
  if not (pl.id = any(used)) then
    return jsonb_build_object('queued', true, 'n', coalesce(array_length(ids, 1), 0), 'wait_mate', p_mate is not null);
  end if;
  ta := null; tb := null;
  if coalesce(array_length(pairs, 1), 0) >= 2 then
    -- 兩組朋友：有我那組先上
    for i in 1 .. array_length(pairs, 1) loop if pl.id = pairs[i][1] or pl.id = pairs[i][2] then ta := array[pairs[i][1], pairs[i][2]]; end if; end loop;
    if ta is not null then for i in 1 .. array_length(pairs, 1) loop if not (pairs[i][1] = any(ta)) and tb is null then tb := array[pairs[i][1], pairs[i][2]]; end if; end loop; end if;
  end if;
  if ta is null and coalesce(array_length(pairs, 1), 0) >= 1 and coalesce(array_length(singles, 1), 0) >= 2 then
    for i in 1 .. array_length(pairs, 1) loop if pl.id = pairs[i][1] or pl.id = pairs[i][2] then ta := array[pairs[i][1], pairs[i][2]]; end if; end loop;
    if ta is null and pl.id = any(singles) then ta := array[pairs[1][1], pairs[1][2]]; end if;
    if ta is not null then
      tmp := array(select u from unnest(singles) u where u = pl.id union all select u from unnest(singles) u where u <> pl.id);
      tb := tmp[1:2];
    end if;
  end if;
  if ta is null and coalesce(array_length(singles, 1), 0) >= 4 then
    tmp := array(select u from unnest(singles) u where u = pl.id union all select u from unnest(singles) u where u <> pl.id);
    tmp := tmp[1:4];
    -- 照星星排：最強＋最弱一隊，中間兩個一隊
    tmp := array(select u from unnest(tmp) u join unnest(ids, sts) as z(id, s) on z.id = u order by z.s desc, u);
    ta := array[tmp[1], tmp[4]]; tb := array[tmp[2], tmp[3]];
  end if;
  if ta is null or tb is null then
    return jsonb_build_object('queued', true, 'n', coalesce(array_length(ids, 1), 0));
  end if;
  delete from public.duel_queue where uid in (ta[1], ta[2], tb[1], tb[2]);
  insert into public.duels (a, a2, b, b2, a_name, a2_name, b_name, b2_name, team, status, start_at, end_at, ranked, acc)
    values (ta[1], ta[2], tb[1], tb[2], nms[array_position(ids, ta[1])], nms[array_position(ids, ta[2])], nms[array_position(ids, tb[1])], nms[array_position(ids, tb[2])],
            true, 'active', now() + interval '8 seconds', now() + interval '188 seconds', false, array[ta[1], ta[2], tb[1], tb[2]]) returning * into d;
  return public._duel_json(d, pl.id);
end $$;

-- 小組找對手時，看看有幾個人在排（給「排隊中…」的字用）
create or replace function public.duel_team_peek() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', (select count(*) from public.duel_queue q where q.mode = 'team' and q.seen_at > now() - interval '20 seconds')) $$;

-- 一般排位排隊不要配到在排小組的人
create or replace function public.duel_queue_join3(p_mode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p_spot text; my_st int; o public.duel_queue; d public.duels; nm text; lead interval;
begin
  if p_mode = 'team' then return jsonb_build_object('err', '小組對決請用小組找對手'); end if;
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
  select * into o from public.duel_queue q where q.uid <> pl.id and q.mode is not distinct from p_mode and not public._duel_busy(q.uid)
    order by abs(q.stars - my_st), q.joined_at limit 1 for update skip locked;
  if found then
    delete from public.duel_queue where uid in (pl.id, o.uid);
    lead := case when p_spot is null then interval '6 seconds' else interval '12 seconds' end;
    insert into public.duels (a, b, a_name, b_name, status, start_at, end_at, ranked, spot, mode)
      values (o.uid, pl.id, coalesce(o.name, '釣客'), nm, 'active', now() + lead, now() + lead + interval '180 seconds', true, p_spot, p_mode) returning * into d;
    return public._duel_json(d, pl.id);
  end if;
  insert into public.duel_queue (uid, name, stars, spot, mode, mate) values (pl.id, nm, my_st, p_spot, p_mode, null)
    on conflict (uid) do update set seen_at = now(), name = excluded.name, stars = excluded.stars, spot = excluded.spot, mode = excluded.mode, mate = null;
  return jsonb_build_object('queued', true, 'n', (select count(*) from public.duel_queue where seen_at > now() - interval '20 seconds' and mode is not distinct from p_mode));
end $$;

-- 舊版手機收到小組邀請時會用 duel_answer：不讓它直接開始
create or replace function public.duel_answer(p_id bigint, p_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.duels; lead interval;
begin
  select * into d from public.duels where id = p_id for update;
  if found and d.team then return public.duel_team_answer(p_id, p_ok); end if;
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

-- 小組對決不扣、不加星星：_duel_settle 已經是 ranked=false 就只記結果（194），這裡不用改。

revoke all on function public.duel_now() from public, anon;
grant execute on function public.duel_now() to authenticated;
revoke all on function public.duel_team_invite(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.duel_team_invite(uuid, uuid, uuid, text) to authenticated;
revoke all on function public.duel_team_answer(bigint, boolean) from public, anon;
grant execute on function public.duel_team_answer(bigint, boolean) to authenticated;
revoke all on function public.duel_team_queue(uuid) from public, anon;
grant execute on function public.duel_team_queue(uuid) to authenticated;
revoke all on function public.duel_team_peek() from public, anon;
grant execute on function public.duel_team_peek() to authenticated;
revoke all on function public.duel_queue_join3(text) from public, anon;
grant execute on function public.duel_queue_join3(text) to authenticated;

select '小組對決設定完成 👥' as result;
