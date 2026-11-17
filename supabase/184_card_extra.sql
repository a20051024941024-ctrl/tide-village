-- 184 🪪 玩家資料頁補三樣（v546，作者：參考圖裡的「最近動態、大賽名次、探索進度」）。可以重複執行。
-- ・探索：players.explore 記去過哪些地點（手機回報，只當紀錄，沒有獎勵；換手機也拿得回來）。
-- ・釣魚大賽：領獎時順便記最佳名次、參加幾場、前三名幾次、最近一場的名次（從這一版開始記，以前的場次沒有紀錄）。
-- ・最近動態：最近 6 件事（上報的好魚、打完的對決、球類比賽、釣魚大賽名次），都是本來就公開的東西。

alter table public.players add column if not exists explore jsonb not null default '[]'::jsonb;
alter table public.players add column if not exists tourney_best integer;
alter table public.players add column if not exists tourney_plays integer not null default 0;
alter table public.players add column if not exists tourney_top3 integer not null default 0;
alter table public.players add column if not exists tourney_last_rk integer;
alter table public.players add column if not exists tourney_last_at timestamptz;
alter table public.sport_reports add column if not exists sport text;
alter table public.sport_reports add column if not exists res text;

create or replace function public.player_set_explore(p_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); o jsonb;
begin
  select coalesce(jsonb_agg(x order by x), '[]'::jsonb) into o from (
    select distinct x from (select jsonb_array_elements_text(coalesce(pl.explore, '[]'::jsonb)) x union all select unnest(coalesce(p_ids, '{}'::text[])) x) u where x ~ '^[a-z0-9_]{2,24}$' order by x limit 60) v;
  if o is distinct from pl.explore then update public.players set explore = o where id = pl.id; end if;
  return jsonb_build_object('ok', true, 'list', o);
end $$;

create or replace function public.claim_tourney() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); rk integer; prize integer;
begin
  if pl.tourney_id is null or pl.tourney_n <= 0 then return pl; end if;
  if pl.tourney_claim is not distinct from pl.tourney_id then return pl; end if;
  if now() < public._tourney_end(pl.tourney_id) + interval '20 seconds' then return pl; end if;   -- 等最後幾條魚都算完
  select 1 + count(*) into rk from public.players where tourney_id = pl.tourney_id and tourney_w > pl.tourney_w;
  prize := case rk when 1 then 3000 when 2 then 1500 when 3 then 800 else 100 end;
  update public.players set coins = coins + prize, earned = earned + prize, tourney_claim = pl.tourney_id, updated_at = now(),
    tourney_best = least(coalesce(tourney_best, rk), rk), tourney_plays = tourney_plays + 1, tourney_top3 = tourney_top3 + (rk <= 3)::int,
    tourney_last_rk = rk, tourney_last_at = public._tourney_end(pl.tourney_id)
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public._card_recent(p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(v.r order by v.at desc), '[]'::jsonb) from (
    select u.r, u.at from (
      select jsonb_build_object('k', 'c', 'f', c.fish, 'w', c.w, 'r', c.rarity, 't', (extract(epoch from c.at) * 1000)::bigint) r, c.at
        from (select * from public.news_catch where uid = p_uid order by id desc limit 6) c
      union all
      select jsonb_build_object('k', 'd', 'res', case when d.winner is null then 'd' when d.winner = p_uid then 'w' else 'l' end, 'rk', d.ranked,
          'o', left(coalesce(case when d.a = p_uid then d.b_name else d.a_name end, ''), 16), 't', (extract(epoch from coalesce(d.end_at, d.created_at)) * 1000)::bigint), coalesce(d.end_at, d.created_at)
        from (select * from public.duels where status = 'done' and (a = p_uid or b = p_uid) order by id desc limit 6) d
      union all
      select jsonb_build_object('k', 's', 's', s.sport, 'res', s.res, 't', (extract(epoch from s.at) * 1000)::bigint), s.at
        from (select * from public.sport_reports where uid = p_uid and sport is not null order by at desc limit 6) s
      union all
      select jsonb_build_object('k', 't', 'rk', p.tourney_last_rk, 't', (extract(epoch from p.tourney_last_at) * 1000)::bigint), p.tourney_last_at
        from public.players p where p.id = p_uid and p.tourney_last_rk is not null and p.tourney_last_at > now() - interval '14 days'
    ) u order by u.at desc limit 6) v $$;

create or replace function public.sport_report(p_sport text, p_mid text, p_res text, p_team boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); tid bigint; n int;
begin
  if p_sport not in ('soccer', 'basket', 'badminton') or p_res not in ('w', 'l', 'd') or p_mid is null or length(p_mid) < 6 or length(p_mid) > 64 then return jsonb_build_object('err', 'bad'); end if;
  if exists (select 1 from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '30 seconds') then return jsonb_build_object('err', 'too fast'); end if;
  select count(*) into n from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '1 day'; if n >= 40 then return jsonb_build_object('err', 'daily'); end if;
  insert into public.sport_reports (uid, mid, sport, res) values (pl.id, p_mid, p_sport, p_res) on conflict do nothing; get diagnostics n = row_count; if n = 0 then return jsonb_build_object('ok', true, 'dup', true); end if;
  delete from public.sport_reports where uid = pl.id and at < now() - interval '2 days';
  insert into public.sport_stats (uid, sport, wins, losses, draws) values (pl.id, p_sport, (p_res = 'w')::int, (p_res = 'l')::int, (p_res = 'd')::int)
    on conflict (uid, sport) do update set wins = sport_stats.wins + (p_res = 'w')::int, losses = sport_stats.losses + (p_res = 'l')::int, draws = sport_stats.draws + (p_res = 'd')::int, updated_at = now();
  if p_team and p_sport = 'soccer' then
    select m.team into tid from public.team_members m where m.uid = pl.id limit 1;
    if tid is not null then
      insert into public.team_sport_matches (team, mid) values (tid, p_mid) on conflict do nothing; get diagnostics n = row_count;
      if n > 0 then insert into public.team_sport (team, wins, losses, draws) values (tid, (p_res = 'w')::int, (p_res = 'l')::int, (p_res = 'd')::int)
        on conflict (team) do update set wins = team_sport.wins + (p_res = 'w')::int, losses = team_sport.losses + (p_res = 'l')::int, draws = team_sport.draws + (p_res = 'd')::int, updated_at = now();
        delete from public.team_sport_matches where team = tid and at < now() - interval '2 days'; end if;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

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
    'duel', case when s.uid is null then null else jsonb_build_object('wins', s.wins, 'losses', s.losses, 'best', s.best_streak, 'stars', s.stars, 'tier', public._duel_tier(s.stars)) end,
    'sports', (select coalesce(jsonb_object_agg(x.sport, jsonb_build_object('w', x.wins, 'l', x.losses, 'd', x.draws)), '{}'::jsonb) from public.sport_stats x where x.uid = p_uid),
    'explore', coalesce(p.explore, '[]'::jsonb),
    'tourney', jsonb_build_object('best', p.tourney_best, 'plays', coalesce(p.tourney_plays, 0), 'top3', coalesce(p.tourney_top3, 0)),
    'recent', public._card_recent(p_uid),
    'me', p.id = auth.uid());
end $$;

revoke all on function public._card_recent(uuid) from public, anon, authenticated;
revoke all on function public.player_set_explore(text[]) from public, anon;
grant execute on function public.player_set_explore(text[]) to authenticated;
revoke all on function public.claim_tourney() from public, anon;
grant execute on function public.claim_tourney() to authenticated;
revoke all on function public.sport_report(text, text, text, boolean) from public, anon;
grant execute on function public.sport_report(text, text, text, boolean) to authenticated;
revoke all on function public.player_card(uuid) from public, anon;
grant execute on function public.player_card(uuid) to authenticated;
