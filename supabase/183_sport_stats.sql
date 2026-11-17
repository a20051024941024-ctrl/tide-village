-- 183 🏟 球類戰績和釣友隊排行（v544，作者 11/17：「自尊、社會…都先加」）
-- ・sport_stats：每個人每種球（soccer 足球、basket 籃球、badminton 羽球）幾勝幾敗幾平，顯示在玩家資料頁。
-- ・team_sport：釣友隊對釣友隊的足球賽，隊伍幾勝幾敗；team_sport_top 是隊伍排行。
-- ・比賽結束時每個參加的人自己回報一次（sport_report）。同一場（p_mid）同一個人只算一次、同一場同一隊只算一次；30 秒內不能連報、每天最多 40 場。
--   結果是手機自己報的（不像釣魚對決是伺服器算分），所以只當紀錄和排行用，不發任何獎勵。可以重複執行。

create table if not exists public.sport_stats (uid uuid not null references public.players(id) on delete cascade, sport text not null, wins integer not null default 0, losses integer not null default 0, draws integer not null default 0, updated_at timestamptz not null default now(), primary key (uid, sport));
create table if not exists public.sport_reports (uid uuid not null references public.players(id) on delete cascade, mid text not null, at timestamptz not null default now(), primary key (uid, mid));
create index if not exists sport_reports_uid_at on public.sport_reports (uid, at desc);
create table if not exists public.team_sport (team bigint primary key references public.teams(id) on delete cascade, wins integer not null default 0, losses integer not null default 0, draws integer not null default 0, updated_at timestamptz not null default now());
create table if not exists public.team_sport_matches (team bigint not null references public.teams(id) on delete cascade, mid text not null, at timestamptz not null default now(), primary key (team, mid));
alter table public.sport_stats enable row level security; alter table public.sport_reports enable row level security; alter table public.team_sport enable row level security; alter table public.team_sport_matches enable row level security;

create or replace function public.sport_report(p_sport text, p_mid text, p_res text, p_team boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); tid bigint; n int;
begin
  if p_sport not in ('soccer', 'basket', 'badminton') or p_res not in ('w', 'l', 'd') or p_mid is null or length(p_mid) < 6 or length(p_mid) > 64 then return jsonb_build_object('err', 'bad'); end if;
  if exists (select 1 from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '30 seconds') then return jsonb_build_object('err', 'too fast'); end if;
  select count(*) into n from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '1 day'; if n >= 40 then return jsonb_build_object('err', 'daily'); end if;
  insert into public.sport_reports (uid, mid) values (pl.id, p_mid) on conflict do nothing; get diagnostics n = row_count; if n = 0 then return jsonb_build_object('ok', true, 'dup', true); end if;
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

create or replace function public.team_sport_top() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'w')::int desc, (r->>'l')::int asc), '[]'::jsonb) from (
    select jsonb_build_object('name', t.name, 'badge', t.badge, 'color', t.color, 'w', s.wins, 'l', s.losses, 'd', s.draws,
      'm', (select count(*) from public.team_members m where m.team = t.id), 'me', exists (select 1 from public.team_members m where m.team = t.id and m.uid = auth.uid())) r
    from public.team_sport s join public.teams t on t.id = s.team order by s.wins desc, s.losses asc limit 20) x $$;

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
    'me', p.id = auth.uid());
end $$;

revoke all on function public.sport_report(text, text, text, boolean) from public, anon;
revoke all on function public.team_sport_top() from public, anon;
revoke all on function public.player_card(uuid) from public, anon;
grant execute on function public.sport_report(text, text, text, boolean) to authenticated;
grant execute on function public.team_sport_top() to authenticated;
grant execute on function public.player_card(uuid) to authenticated;
