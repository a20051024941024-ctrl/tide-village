-- 潮汐釣魚村：阿福海產店（可以重複執行）
-- 每天台灣時間 6:00 公布「今日收購」（3～4 項），參考全服「前一天」的漁獲：前一天很少人釣到的魚 → 高價收購；太多的魚不收。
--   bonus：今天把這種魚賣給阿福，價格 ×倍數（每人每項一次，一次最多 3 條）
--   quest：交 N 條 X 公斤以上的某種魚，給一筆金幣（全服前 cap 個人才有，每人一次）
-- 海豚、鯨魚、海龜、海馬、水母這些阿福不收。只收野生的魚：箱網養的（fm）、魚缸生的（y）、紅鯊（rs）、收藏的（k）、展示中的都不收。
-- 18:00「今日特餐」：用今天收到最多的魚做一道特餐（接現有的料理加成 buff），每人每天買一份。
-- 「一天」從台灣時間 6:00 算到隔天 6:00。

-- ---- 全服每天的漁獲統計（玩家的 fish_count 增加時記下來）----
create table if not exists public.catch_log (day date not null, fish text not null, n integer not null default 0, primary key (day, fish));
alter table public.catch_log enable row level security;
revoke all on public.catch_log from anon, authenticated;
create or replace function public._fu_day() returns date language sql stable as $$ select ((now() at time zone 'Asia/Taipei') - interval '6 hours')::date $$;
create or replace function public._catch_log_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; dn integer; d date := public._fu_day();
begin
  for k in select jsonb_object_keys(coalesce(new.fish_count, '{}'::jsonb)) loop
    dn := coalesce((new.fish_count->>k)::int, 0) - coalesce((old.fish_count->>k)::int, 0);
    if dn > 0 and dn < 50 then insert into public.catch_log (day, fish, n) values (d, k, dn) on conflict (day, fish) do update set n = public.catch_log.n + excluded.n; end if;
  end loop;
  return new;
end $$;
drop trigger if exists catch_log_trg on public.players;
create trigger catch_log_trg after update of fish_count on public.players for each row when (old.fish_count is distinct from new.fish_count) execute function public._catch_log_trg();

-- ---- 收購單 ----
create table if not exists public.fu_orders (
  day date not null, idx integer not null, kind text not null check (kind in ('bonus', 'quest')), fish text not null,
  mult numeric not null default 1, need integer not null default 1, minw numeric not null default 0, reward integer not null default 0,
  cap integer not null default 10, done integer not null default 0, primary key (day, idx));
create table if not exists public.fu_done (day date not null, idx integer not null, uid uuid not null, n integer not null default 0, got integer not null default 0, at timestamptz not null default now(), primary key (day, idx, uid));
create table if not exists public.fu_log (day date not null, fish text not null, n integer not null default 0, primary key (day, fish));
create table if not exists public.fu_specials (day date primary key, r text not null, fish text);
create table if not exists public.fu_special_buys (day date not null, uid uuid not null, primary key (day, uid));
do $$ declare t text; begin
  foreach t in array array['fu_orders', 'fu_done', 'fu_log', 'fu_specials', 'fu_special_buys'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 出今天的收購單（已經有了就不動）
create or replace function public._fu_make(p_day date) returns integer language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public._fishcfg(); c record; k int := 0; sp public.fish_species; need int; mw numeric; top text[];
begin
  if exists (select 1 from public.fu_orders where day = p_day) then return 0; end if;
  -- 前一天最多人釣的 3 種：今天不收
  select coalesce(array_agg(fish), '{}') into top from (select l.fish from public.catch_log l where l.day = p_day - 1 order by l.n desc limit 3) x;
  create temp table if not exists _fu_cand (fish text, r text, y integer) on commit drop; delete from _fu_cand;
  insert into _fu_cand
    select f.key, f.value->>'r', coalesce(l.n, 0)
    from jsonb_each(cfg->'fish') f left join public.catch_log l on l.day = p_day - 1 and l.fish = f.key
    where not (f.value ? 'v') and f.value->>'r' in ('常見', '稀有') and f.key not like 'shark_red%' and f.key not in ('dolphin', 'beluga', 'orca', 'whale', 'sperm', 'turtle', 'seahorse', 'jelly', 'manta', 'sunfish') and not (f.key = any(top))
      and exists (select 1 from jsonb_each(cfg->'spots') s where s.key not in ('shrimp', 'isle') and (s.value->'fish') ? f.key)
      and exists (select 1 from public.fish_species x where x.id = f.key);
  -- 高價收購：前一天最少人釣到的 2 種
  for c in select * from _fu_cand order by y, random() limit 2 loop
    insert into public.fu_orders (day, idx, kind, fish, mult) values (p_day, k, 'bonus', c.fish, case when c.y = 0 then 2.0 else 1.5 end); k := k + 1;
  end loop;
  -- 委託：另外 1～2 種（中間的），交 N 條夠大的
  for c in select * from _fu_cand where _fu_cand.fish not in (select o.fish from public.fu_orders o where o.day = p_day) order by random() limit (1 + floor(random() * 2))::int loop
    select * into sp from public.fish_species where id = c.fish;
    need := case when c.r = '常見' then 3 else 2 end; mw := round(sp.min_w + (sp.max_w - sp.min_w) * 0.3, 2);
    insert into public.fu_orders (day, idx, kind, fish, need, minw, reward, cap)
      values (p_day, k, 'quest', c.fish, need, mw, (ceil(need * public._fish_price(sp, mw) * 1.8 / 10) * 10)::int, 10); k := k + 1;
  end loop;
  return k;
end $$;

-- 今天的特餐：今天收到最多的魚，有這種魚的料理就做那道，不然做綜合壽司拼盤
create or replace function public._fu_special(p_day date) returns text language plpgsql security definer set search_path = public as $$
declare f text; r text;
begin
  select l.fish into f from public.fu_log l where l.day = p_day order by l.n desc, l.fish limit 1;
  r := case f when 'mackerel' then 'saba' when 'moonbream' then 'tai' when 'ayu' then 'ayu' when 'perch' then 'suzuki' when 'octopus' then 'tako' when 'ika' then 'ikayaki'
    when 'cuttle' then 'sumi' when 'squid' then 'sanbei' when 'tuna' then 'toro' when 'eel' then 'unadon' when 'puffer' then 'fugu' when 'tilapia' then 'tilapia' when 'prawn' then 'ebi' else 'mori' end;
  if not (public._fishcfg()->'buffs' ? r) then r := 'mori'; end if;
  insert into public.fu_specials (day, r, fish) values (p_day, r, f) on conflict (day) do update set r = excluded.r, fish = excluded.fish;
  return r;
end $$;
revoke all on function public._fu_make(date) from public, anon, authenticated;
revoke all on function public._fu_special(date) from public, anon, authenticated;

-- 看今天的收購單
create or replace function public.fu_today() returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public._fu_day(); me uuid := auth.uid(); sp record; tw timestamp := now() at time zone 'Asia/Taipei';
begin
  perform public._fu_make(d);
  if extract(hour from tw) >= 18 and not exists (select 1 from public.fu_specials where day = d) then perform public._fu_special(d); end if;
  select * into sp from public.fu_specials where day = d;
  return jsonb_build_object('day', d,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('idx', o.idx, 'kind', o.kind, 'fish', o.fish, 'mult', o.mult, 'need', o.need, 'minw', o.minw, 'reward', o.reward, 'cap', o.cap, 'done', o.done,
      'mine', exists (select 1 from public.fu_done x where x.day = o.day and x.idx = o.idx and x.uid = me)) order by o.idx) from public.fu_orders o where o.day = d), '[]'::jsonb),
    'special', case when sp.day is null then null else jsonb_build_object('r', sp.r, 'fish', sp.fish, 'bought', exists (select 1 from public.fu_special_buys b where b.day = d and b.uid = me)) end,
    'got', coalesce((select jsonb_agg(jsonb_build_object('fish', fish, 'n', n) order by n desc) from public.fu_log where day = d), '[]'::jsonb));
end $$;

-- 把魚交給阿福
create or replace function public.fu_deliver(p_idx integer, p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := public._fu_day(); o public.fu_orders; sp public.fish_species; cnt integer; pay integer;
begin
  select * into o from public.fu_orders where day = d and idx = p_idx for update;
  if o.day is null then raise exception '阿福今天沒有收這個'; end if;
  if exists (select 1 from public.fu_done where day = d and idx = p_idx and uid = pl.id) then raise exception '這一項你今天已經交過了'; end if;
  if o.kind = 'quest' and o.done >= o.cap then raise exception '名額已經滿了，明天早一點來'; end if;
  select * into sp from public.fish_species where id = o.fish;
  -- 交的魚：要是這一種、野生的、夠大的、沒有收藏、沒有展示
  select count(*), coalesce(sum(round(public._fish_price(sp, (e->>'w')::numeric) * o.mult)), 0) into cnt, pay
  from jsonb_array_elements(pl.tank) e
  where (e->>'t')::bigint = any(p_ts) and e->>'f' = o.fish and (e->>'w')::numeric >= o.minw
    and not (e ? 'fm') and not (e ? 'y') and not (e ? 'rs') and not (e ? 'k') and not (pl.show @> jsonb_build_array(e->'t'));
  if cnt <> coalesce(array_length(p_ts, 1), 0) or cnt = 0 then raise exception '有的魚阿福不收（要野生的、夠大的，收藏或展示中的魚要先取消）'; end if;
  if o.kind = 'quest' then
    if cnt <> o.need then raise exception '要剛好交 % 條', o.need; end if;
    pay := o.reward;
  elsif cnt > 3 then raise exception '一次最多賣 3 條';
  end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where not ((e->>'t')::bigint = any(p_ts))),
    coins = coins + pay, earned = earned + pay, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  insert into public.fu_done (day, idx, uid, n, got) values (d, p_idx, pl.id, cnt, pay);
  update public.fu_orders set done = done + 1 where day = d and idx = p_idx;
  insert into public.fu_log (day, fish, n) values (d, o.fish, cnt) on conflict (day, fish) do update set n = public.fu_log.n + excluded.n;
  return pl;
end $$;

-- 買今天的特餐（150 金幣，每人每天一份；吃了就是那道料理的加成）
create or replace function public.fu_special_buy() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := public._fu_day(); sp public.fu_specials; b jsonb;
begin
  select * into sp from public.fu_specials where day = d;
  if sp.day is null then raise exception '特餐傍晚 6 點才有'; end if;
  if exists (select 1 from public.fu_special_buys where day = d and uid = pl.id) then raise exception '今天的特餐你已經吃過了'; end if;
  if pl.coins < 150 then raise exception '金幣不夠'; end if;
  b := public._fishcfg()->'buffs'->sp.r;
  update public.players set coins = coins - 150, buff_r = sp.r, buff_left = coalesce((b->>'casts')::int, 5), updated_at = now() where id = pl.id returning * into pl;
  insert into public.fu_special_buys (day, uid) values (d, pl.id);
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['fu_today()', 'fu_deliver(integer,bigint[])', 'fu_special_buy()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 每天台灣時間 6:02 出收購單（UTC 22:02）、18:02 做特餐（UTC 10:02）；沒有排程的話，有人打開店的時候也會自己出
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice '沒辦法開 pg_cron：%', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-fu-orders', '2 22 * * *', 'select public._fu_make(public._fu_day())');
    perform cron.schedule('tide-fu-special', '2 10 * * *', 'select public._fu_special(public._fu_day())');
  end if;
end $$;

select '阿福海產店開張了 🐟' as result;
