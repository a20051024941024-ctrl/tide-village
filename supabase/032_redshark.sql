-- 潮汐釣魚村：赤紅霸王鯊（礁岩鯊的變種）（可以重複執行）
-- 全伺服器只有一個族群：一開始一公一母。海裡至少有一公一母、而且 7 天都沒有紅鯊被釣起來，就會生一隻小鯊（最多 8 隻）。
-- 只在港口外海出現；每拋一次竿碰到的機率 = 0.015% × 海裡的隻數（2 隻 0.03%、8 隻 0.12%）。
-- 上鉤以後大部分都會掙脫（80%，每多一道叉叉再 +3%，最多 95%）；掙脫一次身上就多一道叉叉。
-- 被釣走的不會再回來（除非釣到的人放回海裡）；全部被釣光就絕種了。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('shark_red', '赤紅霸王鯊', '傳說', 15, 420)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

alter table public.players add column if not exists cast_rs text;   -- 這次拋竿碰到的紅鯊（「編號:性別」，例如 2:F）

create table if not exists public.red_sharks (
  id integer primary key,
  sex text not null check (sex in ('M', 'F')),
  born_at timestamptz not null,
  status text not null default 'sea' check (status in ('sea', 'caught')),
  hooked_by uuid, hooked_at timestamptz,          -- 正在拉的人（90 秒內沒拉上來就回到海裡）
  caught_by uuid, caught_name text, caught_w numeric(10,2), caught_at timestamptz
);
alter table public.red_sharks add column if not exists scars integer not null default 0;   -- 掙脫過幾次（身上的叉叉）
alter table public.red_sharks enable row level security;
revoke all on public.red_sharks from anon, authenticated;
create table if not exists public.red_shark_meta (id integer primary key, last_breed timestamptz not null);
alter table public.red_shark_meta enable row level security;
revoke all on public.red_shark_meta from anon, authenticated;

-- 一開始的一公一母（已經是大鯊魚了）；只有第一次會放
insert into public.red_sharks (id, sex, born_at) values (1, 'M', now() - interval '400 days'), (2, 'F', now() - interval '380 days') on conflict (id) do nothing;
insert into public.red_shark_meta (id, last_breed) values (1, now()) on conflict (id) do nothing;

create or replace function public._rs_p() returns numeric language sql immutable as $$ select 0.00015::numeric $$;   -- 每一隻每拋一次竿的機率
create or replace function public._rs_esc(scars integer) returns numeric language sql immutable as $$ select least(0.95, 0.8 + 0.03 * scars)::numeric $$;   -- 上鉤後掙脫的機率
drop function if exists public._rs_land(integer);
create or replace function public._rs_cap() returns integer language sql immutable as $$ select 8 $$;

-- 重量跟著年紀長：剛出生約 18 公斤，慢慢長到 400 公斤左右（每一隻有一點點不一樣）
create or replace function public._rs_w(s public.red_sharks) returns numeric language sql stable as $$
  select round(least(420, (18 + 382 * (1 - exp(-extract(epoch from now() - s.born_at) / 86400 / 90))) * (0.92 + (public._fnv('rs' || s.id) % 100) / 100.0 * 0.16))::numeric, 2) $$;

-- 繁殖：從上一次「生小鯊」或「有紅鯊被釣起來」算起，每滿 7 天生一隻
create or replace function public._rs_breed() returns void language plpgsql security definer set search_path = public as $$
declare m public.red_shark_meta; lc timestamptz; ev timestamptz; nm integer; nf integer; nid integer;
begin
  select * into m from public.red_shark_meta where id = 1 for update;
  if not found then return; end if;
  loop
    select max(caught_at) into lc from public.red_sharks;
    ev := greatest(m.last_breed, coalesce(lc, m.last_breed));
    exit when ev + interval '7 days' > now();
    select count(*) filter (where sex = 'M'), count(*) filter (where sex = 'F') into nm, nf from public.red_sharks where status = 'sea';
    if nm >= 1 and nf >= 1 and nm + nf < public._rs_cap() then
      select coalesce(max(id), 0) + 1 into nid from public.red_sharks;
      insert into public.red_sharks (id, sex, born_at) values (nid, case when random() < 0.5 then 'M' else 'F' end, ev + interval '7 days');
    end if;
    m.last_breed := ev + interval '7 days';
    update public.red_shark_meta set last_breed = m.last_breed where id = 1;
  end loop;
end $$;

-- 拋竿時（roll_fish，港口外海）呼叫：碰到了就回傳那一隻，並先記下是誰在拉
create or replace function public._rs_try(p_uid uuid) returns public.red_sharks language plpgsql security definer set search_path = public as $$
declare n integer; s public.red_sharks;
begin
  perform public._rs_breed();
  -- 上次上鉤但沒拉上來（自己又拋竿了，或是超過 5 分鐘）＝跑掉了，身上多一道叉叉
  update public.red_sharks set scars = scars + 1, hooked_by = null, hooked_at = null
  where status = 'sea' and hooked_by is not null and (hooked_by = p_uid or hooked_at < now() - interval '5 minutes');
  select count(*) into n from public.red_sharks where status = 'sea' and hooked_by is null;
  if n = 0 or random() >= public._rs_p() * n then return null; end if;
  select * into s from public.red_sharks where status = 'sea' and hooked_by is null order by random() limit 1;
  if random() < public._rs_esc(s.scars) then
    -- 這次注定會掙脫：先記上叉叉，不鎖住牠（回傳的 hooked_by 是空的，遊戲就知道要讓牠甩頭跑掉）
    update public.red_sharks set scars = scars + 1 where id = s.id; s.scars := s.scars + 1; s.hooked_by := null; return s;
  end if;
  update public.red_sharks set hooked_by = p_uid, hooked_at = now() where id = s.id;
  s.hooked_by := p_uid; return s;
end $$;

-- 拉上來時（record_catch）呼叫：只有正在拉的人能拿到
create or replace function public._rs_claim(p_uid uuid, p_name text, p_rs text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.red_sharks set status = 'caught', caught_by = p_uid, caught_name = coalesce(nullif(p_name, ''), '有人'), caught_w = p_w, caught_at = now(), hooked_by = null, hooked_at = null
  where id = split_part(coalesce(p_rs, ''), ':', 1)::integer and hooked_by = p_uid and status = 'sea';
  if not found then raise exception '這隻已經被別人釣走了'; end if;
end $$;

-- 拉的時候自己沒拉好（線斷、掙脫）：牠逃走了，身上也多一道叉叉
create or replace function public.rs_escaped() returns void language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.red_sharks set scars = scars + 1, hooked_by = null, hooked_at = null
  where hooked_by = pl.id and status = 'sea' and hooked_at > now() - interval '5 minutes';
end $$;
revoke all on function public.rs_escaped() from public, anon;
grant execute on function public.rs_escaped() to authenticated;

-- 給遊戲看的：海裡還有幾隻（不給編號）、最近一次被誰釣到
create or replace function public.get_red_shark() returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer; l public.red_sharks;
begin
  perform public._rs_breed();
  select count(*) into n from public.red_sharks where status = 'sea';
  select * into l from public.red_sharks where caught_at is not null order by caught_at desc limit 1;
  return jsonb_build_object('n', n, 'last', case when l.id is null then null else jsonb_build_object('id', l.id, 'sex', l.sex, 'scars', l.scars, 'name', l.caught_name, 'w', l.caught_w, 'at', (extract(epoch from l.caught_at) * 1000)::bigint, 'caught', l.status = 'caught') end);
end $$;

revoke all on function public._rs_breed() from public, anon, authenticated;
revoke all on function public._rs_try(uuid) from public, anon, authenticated;
revoke all on function public._rs_claim(uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function public.get_red_shark() from public;
grant execute on function public.get_red_shark() to anon, authenticated;

-- 魚缸：紅鯊不會因為魚太多被擠掉
create or replace function public._trim_tank(tank jsonb, show jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from (
    select e, i, (show @> jsonb_build_array(e->'t') or e ? 'rs') as keep,
           row_number() over (partition by (show @> jsonb_build_array(e->'t') or e ? 'rs') order by i) as rn
    from jsonb_array_elements(tank) with ordinality as x(e, i)
  ) s where keep or rn <= 200 $$;

-- 賣魚：紅鯊不能賣（其他規則跟 schema.sql 一樣）
create or replace function public.sell_fish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0;
begin
  select coalesce(sum(public._fish_price(sp, (e->>'w')::numeric)), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs');
  if cnt = 0 then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i)
            where not ((e->>'t')::bigint = any(p_ts) and not (show @> jsonb_build_array(e->'t')) and not (e ? 'rs'))),
    coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 放生：紅鯊放回海裡得 100 愛海點數，牠會回到族群（其他規則跟 027 一樣）
create or replace function public._love_pts(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select case when sp.id = 'shark_red' then 100 when sp.id = 'bluelobster' then 50 else greatest(case when public._undersized(sp, w) then 3 else 0 end,
                  case sp.rarity when '常見' then 1 when '稀有' then 3 else 10 end) end $$;

create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer; fid text; rs text;
begin
  select public._love_pts(sp, (e->>'w')::numeric), sp.id, e->>'rs' into pts, fid, rs
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
  if fid = 'shark_red' and rs is not null then
    update public.red_sharks set status = 'sea', hooked_by = null, hooked_at = null where id = split_part(rs, ':', 1)::integer and caught_by = pl.id and status = 'caught';
  end if;
  return pl;
end $$;
revoke all on function public.release_fish(bigint) from public, anon;
grant execute on function public.release_fish(bigint) to authenticated;

-- 送禮：紅鯊不能送（其他規則跟 018 一樣）
create or replace function public.send_gift(p_to uuid, p_kind text, p_ts bigint, p_amount integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; gc integer; gf integer; e jsonb;
begin
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_to) and exists (select 1 from public.friends where owner = p_to and friend = pl.id)) then raise exception '要互相加好友才能送禮'; end if;
  if (select count(*) from public.gifts where to_id = p_to and not opened) >= 30 then raise exception '對方的禮物箱滿了'; end if;
  gc := case when pl.gift_day = d then pl.gift_coins else 0 end; gf := case when pl.gift_day = d then pl.gift_fish else 0 end;
  if p_kind = 'coins' then
    if p_amount is null or p_amount < 10 or p_amount > 1000 then raise exception '一次可以送 10～1000 金幣'; end if;
    if gc + p_amount > 1000 then raise exception '今天送的金幣到上限了（每天 1000）'; end if;
    if pl.coins < p_amount then raise exception '金幣不夠'; end if;
    update public.players set coins = coins - p_amount, gift_day = d, gift_coins = gc + p_amount, gift_fish = gf, updated_at = now() where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'coins', jsonb_build_object('amount', p_amount));
  elsif p_kind = 'fish' then
    if gf >= 10 then raise exception '今天送的魚到上限了（每天 10 條）'; end if;
    select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_ts limit 1;
    if e is null then raise exception '找不到這條魚'; end if;
    if pl.show @> jsonb_build_array(e->'t') then raise exception '展示中的魚不能送'; end if;
    if e ? 'rs' then raise exception '赤紅霸王鯊不能送人'; end if;
    update public.players set
      tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality y(x, i) where (x->>'t')::bigint <> p_ts),
      gift_day = d, gift_coins = gc, gift_fish = gf + 1, updated_at = now()
    where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'fish', jsonb_build_object('f', e->>'f', 'w', (e->>'w')::numeric));
  else raise exception '沒有這種禮物'; end if;
  return pl;
end $$;

select '赤紅霸王鯊設定完成 🦈' as result;
