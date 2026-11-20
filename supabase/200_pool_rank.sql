-- 200 🎱 撞球館的小排行（v589，作者 11/20：「感覺撞球館要裝一個小小的排名，然後阿喆也可以算」）
-- ・八號球打完，兩個人各自回報輸贏（跟足球、籃球、羽球一樣用 sport_report，同一個人同一場只算一次、30 秒內不能連報、每天最多 40 場）。
--   跟真人打記成 sport='pool'，跟阿喆打記成 sport='zhe'。
-- ・阿喆是 NPC，沒有帳號：他的戰績另外記在 pool_zhe（一列）。玩家回報「輸給阿喆」= 阿喆贏一場。
-- ・pool_top()：球館牆上的排行。玩家的勝場＝跟真人＋跟阿喆加起來，取前 6 名；阿喆照他的勝場排進去；也回傳自己的名次。
-- ・結果是手機自己報的，所以只當紀錄和排行用，不發任何獎勵。可以重複執行。

create table if not exists public.pool_zhe (id int primary key default 1, wins integer not null default 0, losses integer not null default 0, updated_at timestamptz not null default now(), constraint pool_zhe_one check (id = 1));
insert into public.pool_zhe (id) values (1) on conflict do nothing;
alter table public.pool_zhe enable row level security;

create or replace function public.sport_report(p_sport text, p_mid text, p_res text, p_team boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); tid bigint; n int;
begin
  if p_sport not in ('soccer', 'basket', 'badminton', 'pool', 'zhe') or p_res not in ('w', 'l', 'd') or p_mid is null or length(p_mid) < 6 or length(p_mid) > 64 then return jsonb_build_object('err', 'bad'); end if;
  if p_sport in ('pool', 'zhe') and p_res = 'd' then return jsonb_build_object('err', 'bad'); end if;
  if exists (select 1 from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '30 seconds') then return jsonb_build_object('err', 'too fast'); end if;
  select count(*) into n from public.sport_reports r where r.uid = pl.id and r.at > now() - interval '1 day'; if n >= 40 then return jsonb_build_object('err', 'daily'); end if;
  insert into public.sport_reports (uid, mid, sport, res) values (pl.id, p_mid, p_sport, p_res) on conflict do nothing; get diagnostics n = row_count; if n = 0 then return jsonb_build_object('ok', true, 'dup', true); end if;
  delete from public.sport_reports where uid = pl.id and at < now() - interval '2 days';
  insert into public.sport_stats (uid, sport, wins, losses, draws) values (pl.id, p_sport, (p_res = 'w')::int, (p_res = 'l')::int, (p_res = 'd')::int)
    on conflict (uid, sport) do update set wins = sport_stats.wins + (p_res = 'w')::int, losses = sport_stats.losses + (p_res = 'l')::int, draws = sport_stats.draws + (p_res = 'd')::int, updated_at = now();
  if p_sport = 'zhe' then update public.pool_zhe set wins = wins + (p_res = 'l')::int, losses = losses + (p_res = 'w')::int, updated_at = now() where id = 1; end if;
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

create or replace function public.pool_top() returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select uid, sum(wins)::int w, sum(losses)::int l from public.sport_stats where sport in ('pool', 'zhe') group by uid having sum(wins) + sum(losses) > 0),
       r as (select s.*, rank() over (order by s.w desc, s.l asc) rk from s)
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.nickname, ''), '釣客'), 'w', r.w, 'l', r.l, 'me', r.uid = auth.uid()) order by r.rk, r.uid) from (select * from r order by rk, uid limit 6) r join public.players p on p.id = r.uid), '[]'::jsonb),
    'zhe', (select jsonb_build_object('w', z.wins, 'l', z.losses) from public.pool_zhe z where z.id = 1),
    'me', (select jsonb_build_object('w', r.w, 'l', r.l, 'rk', r.rk) from r where r.uid = auth.uid())) $$;
revoke all on function public.pool_top() from public, anon;
grant execute on function public.pool_top() to authenticated;
