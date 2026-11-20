-- 潮汐釣魚村：🧬 全服共養的魚種族群（可以重複執行）
-- 整個伺服器共用一片海，每種魚有一個族群量（%），從 100 開始，最低 30（不會絕種）、最高 130：
--   * 釣走一條：減少 100 / 容量；一般放流 +1 條、標記放流 +2 條（多掛標籤的那一條由 fish_tags 的觸發器補）
--   * 容量照稀有度：常見 400、稀有 120、傳說 30（稀有的魚一條就差很多）
--   * 每天慢慢回到 100：常見一天補回差距的 30%、稀有 20%、傳說 10%（用經過的時間算，不用排程）
--   * 抽魚（020 roll_fish）：族群 30% 時 ×0.5、100% 時 ×1、130% 時 ×1.3；族群少的魚偏小，很多的偶爾特別大
--   * 演化：族群連續 3 天都在 115% 以上，這種魚就會「演化」出新花色（之後一直留著），釣到時 15% 是演化花色
-- 紅鯊（自己有族群系統）、節慶魚不算。
create table if not exists public.fish_pop (
  fid text primary key,
  pop numeric not null default 100,
  good_since timestamptz,
  evo boolean not null default false,
  evo_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.fish_pop enable row level security;
revoke all on public.fish_pop from anon, authenticated;

create or replace function public._pop_cap(p_fid text) returns numeric language sql stable as $$
  select case coalesce(public._fishcfg()->'fish'->p_fid->>'r', '稀有') when '常見' then 400 when '傳說' then 30 else 120 end::numeric $$;
create or replace function public._pop_rate(p_fid text) returns numeric language sql stable as $$
  select case coalesce(public._fishcfg()->'fish'->p_fid->>'r', '稀有') when '常見' then 0.3 when '傳說' then 0.1 else 0.2 end::numeric $$;
-- 現在的族群量：照經過的天數往 100 靠
create or replace function public._pop_now(p_pop numeric, p_at timestamptz, p_fid text) returns numeric language sql stable as $$
  select 100 + (p_pop - 100) * power(1 - public._pop_rate(p_fid), greatest(0, extract(epoch from now() - p_at) / 86400.0)) $$;

create or replace function public._pop_add(p_fid text, p_n numeric) returns void language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public._fishcfg(); base text; cur numeric; r public.fish_pop;
begin
  if p_fid is null or p_n = 0 then return; end if;
  base := coalesce(cfg->'fish'->p_fid->>'of', p_fid);
  if base in ('shark_red', 'shark_red_albino') or not (cfg->'fish' ? base) or (cfg->'fish'->base) ? 'fest' then return; end if;
  select * into r from public.fish_pop where fid = base for update;
  cur := case when found then public._pop_now(r.pop, r.updated_at, base) else 100 end;
  cur := least(130, greatest(30, cur + p_n * 100 / public._pop_cap(base)));
  insert into public.fish_pop as t (fid, pop, good_since, updated_at) values (base, cur, case when cur >= 115 then now() end, now())
  on conflict (fid) do update set pop = cur, updated_at = now(),
    good_since = case when cur >= 115 then coalesce(t.good_since, now()) else null end,
    evo = t.evo or (cur >= 115 and t.good_since is not null and t.good_since <= now() - interval '3 days'),
    evo_at = case when not t.evo and cur >= 115 and t.good_since is not null and t.good_since <= now() - interval '3 days' then now() else t.evo_at end;
end $$;

-- 抽魚用：{魚: {m: 機率倍數, p: 族群量, e: 演化過沒}}
create or replace function public._pop_map() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(fid, jsonb_build_object('p', round(n, 1),
    'm', round(case when n < 100 then 0.5 + 0.5 * (n - 30) / 70 else 1 + 0.3 * (n - 100) / 30 end, 3), 'e', evo)), '{}'::jsonb)
  from (select fid, evo, public._pop_now(pop, updated_at, fid) as n from public.fish_pop) x $$;

-- 圖鑑用（大家都能看）：{魚: [族群量, 演化過沒]}
create or replace function public.fish_pop_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(fid, jsonb_build_array(round(public._pop_now(pop, updated_at, fid)), evo)), '{}'::jsonb) from public.fish_pop $$;
grant execute on function public.fish_pop_list() to anon, authenticated;
revoke all on function public._pop_add(text, numeric) from public, anon, authenticated;
revoke all on function public._pop_map() from public, anon, authenticated;

-- 釣走：每天的漁獲統計（053 catch_log）一增加就扣
create or replace function public._pop_catch_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare dn integer := new.n - coalesce(case when tg_op = 'UPDATE' then old.n end, 0);
begin
  if dn > 0 and dn < 50 then perform public._pop_add(new.fish, -dn); end if;
  return new;
end $$;
drop trigger if exists pop_catch on public.catch_log;
create trigger pop_catch after insert or update of n on public.catch_log for each row execute function public._pop_catch_trg();

-- 標記放流多補一條（一般放流的那一條在 release_fish 裡）
create or replace function public._pop_tag_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public._pop_add(new.fish, 1); return new; end $$;
drop trigger if exists pop_tag on public.fish_tags;
create trigger pop_tag after insert on public.fish_tags for each row execute function public._pop_tag_trg();

-- 一般放流：跟 042 一樣，多補回族群一條
create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer; fid text; rs text;
begin
  select public._love_pts(sp, (e->>'w')::numeric) + (case when e ? 'b' then 5 else 0 end), sp.id, e->>'rs' into pts, fid, rs
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = p_ts limit 1;
  if pts is null then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    love = love + pts, released = released + 1, updated_at = now()
  where id = pl.id returning * into pl;
  if fid = 'bluelobster' then
    update public.shrimp_events set caught_by = null, caught_name = null, caught_w = null, caught_at = null, hooked_by = null, hooked_at = null
    where fish = fid and caught_by = pl.id and end_at > now();
  end if;
  if fid in ('shark_red', 'shark_red_albino') and rs is not null then
    update public.red_sharks set status = 'sea', hooked_by = null, hooked_at = null where id = split_part(rs, ':', 1)::integer and caught_by = pl.id and status = 'caught';
  end if;
  perform public._pop_add(fid, 1);
  return pl;
end $$;
revoke all on function public.release_fish(bigint) from public, anon;
grant execute on function public.release_fish(bigint) to authenticated;
