-- 186 🚣 划船賽、🎿 滑雪：最快紀錄和排行（v548）。可以重複執行。
-- ・成績是手機自己回報的（跟球類戰績一樣，不像釣魚對決是伺服器算分），所以只當紀錄和排行，不發任何獎勵。
-- ・擋掉明顯不合理的：太快（划船 18 秒內、滑雪 9 秒內不可能）、10 秒內連報、一天超過 80 次。
-- ・race_best：每個人每一種的最快時間和完成次數；race_day：每天每個人每一種的最快（看板「今天最快」用，留 3 天）。

create table if not exists public.race_best (uid uuid not null references public.players(id) on delete cascade, kind text not null, best_ms integer not null, runs integer not null default 0, day date, day_n integer not null default 0, updated_at timestamptz not null default now(), primary key (uid, kind));
create table if not exists public.race_day (day date not null, kind text not null, uid uuid not null references public.players(id) on delete cascade, ms integer not null, primary key (day, kind, uid));
create index if not exists race_best_kind_ms on public.race_best (kind, best_ms);
create index if not exists race_day_kind_ms on public.race_day (day, kind, ms);
alter table public.race_best enable row level security; alter table public.race_day enable row level security;

create or replace function public.race_report(p_kind text, p_ms integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; r public.race_best; pb boolean := false;
begin
  if p_kind not in ('boat', 'ski') or p_ms is null or p_ms > 600000 or p_ms < (case p_kind when 'boat' then 18000 else 9000 end) then return jsonb_build_object('err', 'bad'); end if;
  select * into r from public.race_best where uid = pl.id and kind = p_kind;
  if found then
    if r.updated_at > now() - interval '10 seconds' then return jsonb_build_object('err', 'too fast'); end if;
    if r.day = d and r.day_n >= 80 then return jsonb_build_object('err', 'daily'); end if;
    pb := p_ms < r.best_ms;
    update public.race_best set best_ms = least(best_ms, p_ms), runs = runs + 1, day = d, day_n = case when day = d then day_n + 1 else 1 end, updated_at = now() where uid = pl.id and kind = p_kind;
  else
    pb := true; insert into public.race_best (uid, kind, best_ms, runs, day, day_n) values (pl.id, p_kind, p_ms, 1, d, 1);
  end if;
  insert into public.race_day (day, kind, uid, ms) values (d, p_kind, pl.id, p_ms) on conflict (day, kind, uid) do update set ms = least(public.race_day.ms, excluded.ms);
  delete from public.race_day where day < d - 3 and uid = pl.id;
  return jsonb_build_object('ok', true, 'pb', pb, 'best', least(coalesce(r.best_ms, p_ms), p_ms));
end $$;

create or replace function public.race_top(p_kind text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'day', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(nullif(p.nickname, ''), '釣客'), 'ms', x.ms, 'me', x.uid = auth.uid()) order by x.ms), '[]'::jsonb)
            from (select * from public.race_day where day = (now() at time zone 'Asia/Taipei')::date and kind = p_kind order by ms limit 8) x join public.players p on p.id = x.uid),
    'all', (select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(nullif(p.nickname, ''), '釣客'), 'ms', x.best_ms, 'me', x.uid = auth.uid()) order by x.best_ms), '[]'::jsonb)
            from (select * from public.race_best where kind = p_kind order by best_ms limit 20) x join public.players p on p.id = x.uid),
    'me', (select jsonb_build_object('best', b.best_ms, 'runs', b.runs) from public.race_best b where b.uid = auth.uid() and b.kind = p_kind)) $$;

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
    'race', (select coalesce(jsonb_object_agg(x.kind, jsonb_build_object('best', x.best_ms, 'runs', x.runs)), '{}'::jsonb) from public.race_best x where x.uid = p_uid),
    'me', p.id = auth.uid());
end $$;

revoke all on function public.race_report(text, integer) from public, anon;
grant execute on function public.race_report(text, integer) to authenticated;
revoke all on function public.race_top(text) from public, anon;
grant execute on function public.race_top(text) to authenticated;
revoke all on function public.player_card(uuid) from public, anon;
grant execute on function public.player_card(uuid) to authenticated;
