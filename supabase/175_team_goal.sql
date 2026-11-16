-- 175 🎣 釣友隊每週目標調難（v522，作者 11/17：「釣友隊這個目標太簡單了」——一個人一下子就 9／40 條、7／10 種）
-- 以前：40 條 × 人數；8 種 ＋ 2 × 人數。現在：120 條 × 人數；15 種 ＋ 5 × 人數（人數最多算 6）。
-- 目標變難，獎勵也從每人 300 金幣加到 600。這一週還沒有人領過獎的隊伍，目標直接換成新的。可以重複執行。

create or replace function public._team_ng(m integer) returns integer language sql immutable as $$ select 120 * greatest(1, least(6, m)) $$;
create or replace function public._team_kg(m integer) returns integer language sql immutable as $$ select 15 + 5 * greatest(1, least(6, m)) $$;
create or replace function public._team_reward() returns integer language sql immutable as $$ select 600 $$;

create or replace function public._team_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare t bigint; w date := public._team_week(); m integer; nm text := left(coalesce(nullif(new.nickname, ''), '釣客'), 16);
begin
  if new.total = old.total + 1 and new.last_fish is not null then
    select team into t from public.team_members where uid = new.id;
    if t is not null then
      select count(*) into m from public.team_members where team = t;
      insert into public.team_week (team, week, n, kinds, n_goal, k_goal, best_fish, best_w, best_nick)
        values (t, w, 1, array[new.last_fish], public._team_ng(m), public._team_kg(m), new.last_fish, new.last_w, nm)
      on conflict (team, week) do update set n = public.team_week.n + 1,
        kinds = case when new.last_fish = any(public.team_week.kinds) or coalesce(array_length(public.team_week.kinds, 1), 0) >= 200 then public.team_week.kinds else public.team_week.kinds || new.last_fish end,
        best_fish = case when coalesce(new.last_w, 0) > coalesce(public.team_week.best_w, 0) then new.last_fish else public.team_week.best_fish end,
        best_nick = case when coalesce(new.last_w, 0) > coalesce(public.team_week.best_w, 0) then nm else public.team_week.best_nick end,
        best_w = greatest(coalesce(public.team_week.best_w, 0), coalesce(new.last_w, 0));
      insert into public.team_week_member (team, week, uid, n) values (t, w, new.id, 1) on conflict (team, week, uid) do update set n = public.team_week_member.n + 1;
    end if;
  end if;
  return new;
end $$;

create or replace function public.team_my() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t public.teams; w date := public._team_week(); wk public.team_week; mem jsonb; m integer;
begin
  select tm.* into t from public.teams tm join public.team_members x on x.team = tm.id where x.uid = pl.id;
  if t.id is null then return jsonb_build_object('team', null, 'reward', public._team_reward()); end if;
  select * into wk from public.team_week where team = t.id and week = w;
  select count(*) into m from public.team_members where team = t.id;
  select coalesce(jsonb_agg(jsonb_build_object('i', rn, 'n', left(coalesce(nullif(btrim(p.nickname), ''), '釣客'), 16), 'me', p.id = pl.id, 'own', p.id = t.owner, 'c', coalesce(wm.n, 0), 'lv', coalesce(p.total, 0)) order by rn), '[]'::jsonb) into mem
    from (select uid, row_number() over (order by joined, uid) rn from public.team_members where team = t.id) x
    join public.players p on p.id = x.uid left join public.team_week_member wm on wm.team = t.id and wm.week = w and wm.uid = x.uid;
  return jsonb_build_object('team', jsonb_build_object('name', t.name, 'badge', t.badge, 'color', t.color, 'code', t.code, 'own', t.owner = pl.id, 'm', m),
    'members', mem, 'reward', public._team_reward(),
    'week', jsonb_build_object('n', coalesce(wk.n, 0), 'ng', coalesce(wk.n_goal, public._team_ng(m)), 'k', coalesce(array_length(wk.kinds, 1), 0), 'kg', coalesce(wk.k_goal, public._team_kg(m)),
      'bf', wk.best_fish, 'bw', wk.best_w, 'bn', wk.best_nick,
      'done', wk.team is not null and wk.n >= wk.n_goal and coalesce(array_length(wk.kinds, 1), 0) >= wk.k_goal,
      'claimed', exists (select 1 from public.team_claims c where c.week = w and c.uid = pl.id)));
end $$;

update public.team_week tw set
  n_goal = public._team_ng((select count(*)::int from public.team_members x where x.team = tw.team)),
  k_goal = public._team_kg((select count(*)::int from public.team_members x where x.team = tw.team))
where tw.week = public._team_week() and not exists (select 1 from public.team_claims c where c.team = tw.team and c.week = tw.week);
