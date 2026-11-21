-- 216 🎣 釣友隊的獎勵（v674，作者 11/21：「釣友隊也可以有獎勵」→ 設計同意：隊伍勝場、隊伍等級、每週寶箱）。可以重複執行。
-- ・隊伍經驗（teams.xp）：隊員每釣一條 +1；每週兩個目標都達成那一刻 +300；同隊的兩個人一起打小組對決打贏 +50。
-- ・隊伍等級：Lv2 500、Lv3 1500、Lv4 3000（經驗）。
--     Lv2：名字旁邊掛隊徽；Lv3：隊員的小島插隊旗；Lv4：隊服（top_team，顏色是隊色，所有隊員都拿得到）。
-- ・本週小組勝場（team_week.wins）：同隊兩個人一起打小組對決贏一場算一場。大看板多一個「本週小組勝場」。
-- ・每週寶箱：領每週獎勵時，除了金幣再開一個寶箱（隨機魚餌、打窩料或珊瑚苗）。

alter table public.teams add column if not exists xp integer not null default 0;
alter table public.team_week add column if not exists wins integer not null default 0;
alter table public.team_week add column if not exists xp_done boolean not null default false;

create or replace function public._team_lv(x integer) returns integer language sql immutable as $$
  select case when x >= 3000 then 4 when x >= 1500 then 3 when x >= 500 then 2 else 1 end $$;
create or replace function public._reward_item(p text) returns boolean language sql immutable as $$ select p in ('hat_skipom', 'acc_skigog', 'top_team') or p = any(public._stamp_gear()) $$;

-- 隊員釣到魚：經驗 +1；這一週剛好兩個目標都達成：+300（同一週只加一次）
create or replace function public._team_xp_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare t bigint; wk public.team_week; done_now boolean;
begin
  if new.total <> old.total + 1 or new.last_fish is null then return new; end if;
  select team into t from public.team_members where uid = new.id; if t is null then return new; end if;
  select * into wk from public.team_week where team = t and week = public._team_week();
  done_now := wk.team is not null and not wk.xp_done and wk.n >= wk.n_goal and coalesce(array_length(wk.kinds, 1), 0) >= wk.k_goal;   -- 第一次兩個都達成
  if done_now then update public.team_week set xp_done = true where team = t and week = wk.week; end if;
  update public.teams set xp = xp + 1 + case when done_now then 300 else 0 end where id = t;
  perform public._team_gear(t);
  return new;
exception when others then return new;
end $$;
revoke all on function public._team_xp_trg() from public, anon, authenticated;
drop trigger if exists team_xp on public.players;
create trigger team_xp after update of total on public.players for each row when (new.total > old.total) execute function public._team_xp_trg();

-- Lv4 以上：隊員都拿到隊服
create or replace function public._team_gear(t bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if public._team_lv((select xp from public.teams where id = t)) < 4 then return; end if;
  update public.players p set owned = coalesce(p.owned, '{}') || array['top_team'], updated_at = now()
    from public.team_members m where m.team = t and m.uid = p.id and not ('top_team' = any(coalesce(p.owned, '{}')));
end $$;
revoke all on function public._team_gear(bigint) from public, anon, authenticated;

-- 小組對決結束：同一隊的兩個人一起贏，算隊伍勝場
create or replace function public._team_duel_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare w1 uuid; w2 uuid; t1 bigint; t2 bigint;
begin
  if not new.team or new.winner is null then return new; end if;
  if new.winner = new.a then w1 := new.a; w2 := new.a2; else w1 := new.b; w2 := new.b2; end if;
  select team into t1 from public.team_members where uid = w1; select team into t2 from public.team_members where uid = w2;
  if t1 is null or t1 <> t2 then return new; end if;
  insert into public.team_week (team, week, n, kinds, n_goal, k_goal, wins) values (t1, public._team_week(), 0, '{}', public._team_ng((select count(*)::int from public.team_members where team = t1)), public._team_kg((select count(*)::int from public.team_members where team = t1)), 1)
    on conflict (team, week) do update set wins = public.team_week.wins + 1;
  update public.teams set xp = xp + 50 where id = t1;
  perform public._team_gear(t1);
  return new;
exception when others then return new;
end $$;
revoke all on function public._team_duel_trg() from public, anon, authenticated;
drop trigger if exists team_duel on public.duels;
create trigger team_duel after update of status on public.duels for each row when (new.status = 'done' and old.status <> 'done') execute function public._team_duel_trg();

-- 領每週獎勵：金幣＋寶箱
create or replace function public.team_claim() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t bigint; w date := public._team_week(); wk public.team_week; pay integer := public._team_reward(); prow public.players; ch jsonb; k text; q int; r float := random();
begin
  select team into t from public.team_members where uid = pl.id;
  if t is null then raise exception '你還沒有隊伍'; end if;
  select * into wk from public.team_week where team = t and week = w;
  if wk.team is null or wk.n < wk.n_goal or coalesce(array_length(wk.kinds, 1), 0) < wk.k_goal then raise exception '這一週的目標還沒達成'; end if;
  if not exists (select 1 from public.team_week_member where team = t and week = w and uid = pl.id and n >= 5) then raise exception '這一週你要自己釣到 5 條魚才能領'; end if;
  insert into public.team_claims (team, week, uid) values (t, w, pl.id) on conflict do nothing;
  if not found then raise exception '這一週已經領過了'; end if;
  select x.k, x.q into k, q from (values ('glow', 8, 0.25), ('gold', 2, 0.45), ('chum_krill', 4, 0.62), ('seed_coral', 2, 0.77), ('chum_gold', 2, 0.9), ('rainbow', 1, 1.01)) x(k, q, p) where r < x.p order by x.p limit 1;
  update public.players set coins = coins + pay, earned = earned + pay, updated_at = now() where id = pl.id;
  perform public._stamp_add(pl.id, k, q);
  select * into prow from public.players where id = pl.id;
  return jsonb_build_object('player', to_jsonb(prow), 'team', public.team_my(), 'pay', pay, 'chest', jsonb_build_array(k, q));
end $$;

-- 我的隊伍：多回傳經驗、等級、本週勝場
create or replace function public.team_my2() returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := public.team_my(); t public.teams; wk public.team_week;
begin
  select tm.* into t from public.teams tm join public.team_members x on x.team = tm.id where x.uid = auth.uid();
  if t.id is null then return r; end if;
  perform public._team_gear(t.id);
  select * into wk from public.team_week where team = t.id and week = public._team_week();
  return r || jsonb_build_object('xp', t.xp, 'lv', public._team_lv(t.xp), 'wins', coalesce(wk.wins, 0));
end $$;

-- 某個人的隊伍（小島的隊旗、名字旁的隊徽用）
create or replace function public.team_of(p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select (select jsonb_build_object('name', tm.name, 'badge', tm.badge, 'color', tm.color, 'lv', public._team_lv(tm.xp)) from public.teams tm join public.team_members x on x.team = tm.id where x.uid = p_uid) $$;

-- 大看板：多一個本週小組勝場
create or replace function public.team_wins_top() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', tm.name, 'badge', tm.badge, 'color', tm.color, 'wins', tw.wins, 'lv', public._team_lv(tm.xp)) order by tw.wins desc), '[]'::jsonb)
  from (select * from public.team_week where week = public._team_week() and wins > 0 order by wins desc limit 5) tw join public.teams tm on tm.id = tw.team $$;

revoke all on function public.team_claim() from public, anon; grant execute on function public.team_claim() to authenticated;
revoke all on function public.team_my2() from public, anon; grant execute on function public.team_my2() to authenticated;
revoke all on function public.team_of(uuid) from public, anon; grant execute on function public.team_of(uuid) to authenticated;
revoke all on function public.team_wins_top() from public, anon; grant execute on function public.team_wins_top() to authenticated;

select '釣友隊獎勵設定完成 🎣' as result;
