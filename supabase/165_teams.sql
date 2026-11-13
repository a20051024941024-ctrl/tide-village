-- 165 釣友隊＋廣場大看板（v429）。可以重複執行。
-- 釣友隊：2～6 個人一隊，有隊名、隊徽、隊色；用 6 碼的邀請碼加入（只有隊員看得到邀請碼）。
-- 每週（台灣時間週一 00:00 開始）全隊一起完成兩個目標：合力釣到幾條魚、湊齊幾種不同的魚。兩個都達成，每個隊員可以領一次獎勵。
--   目標在這一週第一條魚釣上來的時候照當時的人數定下來（40 條 × 人數；8 種 ＋ 2 × 人數），之後有人進出也不變。
-- 防亂來：要釣過 20 條魚才能建隊；隊名 2～10 個字、擋髒話（跟設計名字同一份 _name_bad）、不能跟別隊一樣；
--   兒童模式不能自己取隊名（系統取「○○隊」），但可以用邀請碼加入別人的隊。一個人同時只能在一隊；退出後 1 小時內不能再加入或建隊。
-- 公開的東西只有：隊名、隊徽、隊色、人數、本週進度、暱稱。不給 uid、不給邀請碼。
-- 大看板 team_board()：今天最大的 5 條魚、最近 6 條上報的魚（都來自村報的 news_catch，本來就是公開的）、本週進度最前面的 10 隊。

create table if not exists public.teams (
  id bigserial primary key, name text not null, badge integer not null default 0, color integer not null default 0,
  owner uuid not null, code text not null unique, created timestamptz not null default now());
create unique index if not exists teams_name_u on public.teams (lower(name));
alter table public.teams enable row level security;
create table if not exists public.team_members (uid uuid primary key, team bigint not null references public.teams(id) on delete cascade, joined timestamptz not null default now());
create index if not exists team_members_team on public.team_members (team);
alter table public.team_members enable row level security;
create table if not exists public.team_week (
  team bigint not null references public.teams(id) on delete cascade, week date not null,
  n integer not null default 0, kinds text[] not null default '{}', n_goal integer not null, k_goal integer not null,
  best_fish text, best_w numeric(10,2), best_nick text, primary key (team, week));
alter table public.team_week enable row level security;
create table if not exists public.team_week_member (team bigint not null references public.teams(id) on delete cascade, week date not null, uid uuid not null, n integer not null default 0, primary key (team, week, uid));
alter table public.team_week_member enable row level security;
create table if not exists public.team_claims (team bigint not null, week date not null, uid uuid not null, at timestamptz not null default now(), primary key (week, uid));
alter table public.team_claims enable row level security;
alter table public.players add column if not exists team_left timestamptz;

create or replace function public._team_week() returns date language sql stable as $$ select date_trunc('week', now() at time zone 'Asia/Taipei')::date $$;
create or replace function public._team_reward() returns integer language sql immutable as $$ select 300 $$;

-- 釣上來一條魚：算進隊伍這一週的進度
create or replace function public._team_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare t bigint; w date := public._team_week(); m integer; nm text := left(coalesce(nullif(new.nickname, ''), '釣客'), 16);
begin
  if new.total = old.total + 1 and new.last_fish is not null then
    select team into t from public.team_members where uid = new.id;
    if t is not null then
      select count(*) into m from public.team_members where team = t;
      insert into public.team_week (team, week, n, kinds, n_goal, k_goal, best_fish, best_w, best_nick)
        values (t, w, 1, array[new.last_fish], 40 * greatest(1, least(6, m)), 8 + 2 * greatest(1, least(6, m)), new.last_fish, new.last_w, nm)
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
drop trigger if exists team_trg on public.players;
create trigger team_trg after update of total on public.players for each row when (new.total is distinct from old.total) execute function public._team_trg();

-- 我的隊伍
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
    'week', jsonb_build_object('n', coalesce(wk.n, 0), 'ng', coalesce(wk.n_goal, 40 * greatest(1, least(6, m))), 'k', coalesce(array_length(wk.kinds, 1), 0), 'kg', coalesce(wk.k_goal, 8 + 2 * greatest(1, least(6, m))),
      'bf', wk.best_fish, 'bw', wk.best_w, 'bn', wk.best_nick,
      'done', wk.team is not null and wk.n >= wk.n_goal and coalesce(array_length(wk.kinds, 1), 0) >= wk.k_goal,
      'claimed', exists (select 1 from public.team_claims c where c.week = w and c.uid = pl.id)));
end $$;

create or replace function public._team_code() returns text language plpgsql as $$
declare c text; i integer := 0;
begin
  loop c := ''; for k in 1..6 loop c := c || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1); end loop;
    exit when not exists (select 1 from public.teams where code = c); i := i + 1; if i > 30 then raise exception '請再試一次'; end if; end loop;
  return c;
end $$;

create or replace function public.team_create(p_name text, p_badge integer, p_color integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); nm text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 10); c text; tid bigint;
begin
  if exists (select 1 from public.team_members where uid = pl.id) then raise exception '你已經有隊伍了'; end if;
  if coalesce(pl.total, 0) < 20 then raise exception '先釣 20 條魚才能建立釣友隊'; end if;
  if pl.team_left is not null and pl.team_left > now() - interval '1 hour' then raise exception '剛退出隊伍，過一個小時才能再建隊'; end if;
  c := public._team_code();
  if coalesce(pl.kid, false) then nm := c || '隊';
  else
    if char_length(nm) < 2 then raise exception '隊名要 2 到 10 個字'; end if;
    if public._name_bad(nm) then raise exception '這個隊名不行，換一個吧'; end if;
    if exists (select 1 from public.teams where lower(name) = lower(nm)) then raise exception '這個隊名已經有人用了'; end if;
  end if;
  insert into public.teams (name, badge, color, owner, code) values (nm, greatest(0, least(15, coalesce(p_badge, 0))), greatest(0, least(7, coalesce(p_color, 0))), pl.id, c) returning id into tid;
  insert into public.team_members (uid, team) values (pl.id, tid);
  return public.team_my();
end $$;

create or replace function public.team_join(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t public.teams; m integer;
begin
  if exists (select 1 from public.team_members where uid = pl.id) then raise exception '你已經有隊伍了，要先退出才能換隊'; end if;
  if pl.team_left is not null and pl.team_left > now() - interval '1 hour' then raise exception '剛退出隊伍，過一個小時才能再加入'; end if;
  select * into t from public.teams where code = upper(btrim(coalesce(p_code, ''))) for update;
  if t.id is null then raise exception '找不到這個邀請碼'; end if;
  select count(*) into m from public.team_members where team = t.id;
  if m >= 6 then raise exception '這一隊已經滿 6 個人了'; end if;
  insert into public.team_members (uid, team) values (pl.id, t.id);
  return public.team_my();
end $$;

create or replace function public._team_drop(p_uid uuid, p_mark boolean) returns void language plpgsql security definer set search_path = public as $$
declare t public.teams; nxt uuid;
begin
  select tm.* into t from public.teams tm join public.team_members x on x.team = tm.id where x.uid = p_uid for update of tm;
  if t.id is null then return; end if;
  delete from public.team_members where uid = p_uid;
  if p_mark then update public.players set team_left = now() where id = p_uid; end if;
  select uid into nxt from public.team_members where team = t.id order by joined, uid limit 1;
  if nxt is null then delete from public.teams where id = t.id;
  elsif t.owner = p_uid then update public.teams set owner = nxt where id = t.id; end if;
end $$;

create or replace function public.team_leave() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin perform public._team_drop(pl.id, true); return public.team_my(); end $$;

-- 隊長把人請出去（用名單上的第幾個，不給 uid）
create or replace function public.team_kick(p_i integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t public.teams; who uuid;
begin
  select tm.* into t from public.teams tm join public.team_members x on x.team = tm.id where x.uid = pl.id;
  if t.id is null or t.owner <> pl.id then raise exception '只有隊長可以這樣做'; end if;
  select uid into who from (select uid, row_number() over (order by joined, uid) rn from public.team_members where team = t.id) x where rn = p_i;
  if who is null or who = pl.id then raise exception '找不到這個隊員'; end if;
  perform public._team_drop(who, false);
  return public.team_my();
end $$;

-- 隊長換隊徽、隊色
create or replace function public.team_style(p_badge integer, p_color integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.teams set badge = greatest(0, least(15, coalesce(p_badge, 0))), color = greatest(0, least(7, coalesce(p_color, 0))) where owner = pl.id and id = (select team from public.team_members where uid = pl.id);
  return public.team_my();
end $$;

-- 領這一週的獎勵（兩個目標都達成才行；一個人一週一次，換隊也不能再領）
create or replace function public.team_claim() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t bigint; w date := public._team_week(); wk public.team_week; pay integer := public._team_reward(); prow public.players;
begin
  select team into t from public.team_members where uid = pl.id;
  if t is null then raise exception '你還沒有隊伍'; end if;
  select * into wk from public.team_week where team = t and week = w;
  if wk.team is null or wk.n < wk.n_goal or coalesce(array_length(wk.kinds, 1), 0) < wk.k_goal then raise exception '這一週的目標還沒達成'; end if;
  if not exists (select 1 from public.team_week_member where team = t and week = w and uid = pl.id and n >= 5) then raise exception '這一週你要自己釣到 5 條魚才能領'; end if;
  insert into public.team_claims (team, week, uid) values (t, w, pl.id) on conflict do nothing;
  if not found then raise exception '這一週已經領過了'; end if;
  update public.players set coins = coins + pay, earned = earned + pay, updated_at = now() where id = pl.id returning * into prow;
  return jsonb_build_object('player', to_jsonb(prow), 'team', public.team_my(), 'pay', pay);
end $$;

-- 廣場大看板
create or replace function public.team_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d0 date := public._tw_day(now()); w0 date := public._team_week(); mine bigint;
begin
  select team into mine from public.team_members where uid = auth.uid();
  return jsonb_build_object(
    'best', (select coalesce(jsonb_agg(jsonb_build_object('n', nick, 'f', fish, 'w', w) order by w desc), '[]'::jsonb) from (select nick, fish, w from public.news_catch where day = d0 order by w desc limit 5) x),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('n', nick, 'f', fish, 'w', w, 'r', rarity) order by id desc), '[]'::jsonb) from (select id, nick, fish, w, rarity from public.news_catch where day >= d0 - 1 order by id desc limit 6) x),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'badge', badge, 'color', color, 'm', m, 'n', n, 'ng', n_goal, 'k', k, 'kg', k_goal, 'me', id = mine) order by pr desc, n desc), '[]'::jsonb)
      from (select tm.id, tm.name, tm.badge, tm.color, (select count(*) from public.team_members x where x.team = tm.id) m, tw.n, tw.n_goal, coalesce(array_length(tw.kinds, 1), 0) k, tw.k_goal,
                   least(1.0, tw.n::numeric / greatest(1, tw.n_goal)) + least(1.0, coalesce(array_length(tw.kinds, 1), 0)::numeric / greatest(1, tw.k_goal)) pr
            from public.team_week tw join public.teams tm on tm.id = tw.team where tw.week = w0 order by pr desc, tw.n desc limit 10) y),
    'nteams', (select count(*) from public.teams));
end $$;

-- 刪帳號時一起離隊（115 的 delete_account 會刪 players；這裡用觸發器接）
create or replace function public._team_gone() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public._team_drop(old.id, false); return old; end $$;
drop trigger if exists team_gone on public.players;
create trigger team_gone before delete on public.players for each row execute function public._team_gone();

do $$ declare f text; begin
  foreach f in array array['team_my()', 'team_create(text,integer,integer)', 'team_join(text)', 'team_leave()', 'team_kick(integer)', 'team_style(integer,integer)', 'team_claim()', 'team_board()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_team_trg()', '_team_code()', '_team_drop(uuid,boolean)', '_team_gone()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
