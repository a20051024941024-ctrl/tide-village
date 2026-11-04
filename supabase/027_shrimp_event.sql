-- 潮汐釣魚村：釣蝦場老闆的放生活動（可以重複執行）
-- 每天台灣時間 12～21 點之間的某個整點開始，持續 2 小時，老闆放一隻藍色龍蝦進池子，全伺服器只有一隻。
-- 時間表要跟 js/game.js 的 sevPlan() 一樣（FNV-1a 雜湊 'sev' + 日期）。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('bluelobster', '藍色龍蝦', '傳說', 0.4, 1.2)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

create table if not exists public.shrimp_events (
  id bigint primary key,                 -- 日期，例如 20261104
  fish text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  hooked_by uuid, hooked_at timestamptz, -- 抽到牠、正在拉的人（90 秒內沒拉上來就放回池子）
  caught_by uuid, caught_name text, caught_w numeric(10,2), caught_at timestamptz
);
alter table public.shrimp_events enable row level security;
revoke all on public.shrimp_events from anon, authenticated;

create or replace function public._sev_p() returns numeric language sql immutable as $$ select 0.0015::numeric $$;   -- 每拋一次竿碰到牠的機率

-- 今天（台灣時間）的活動，沒有就照時間表建一筆
create or replace function public._sev_today() returns public.shrimp_events language plpgsql security definer set search_path = public as $$
declare d text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD'); h bigint := public._fnv('sev' || d); e public.shrimp_events; st timestamptz;
begin
  select * into e from public.shrimp_events where id = replace(d, '-', '')::bigint;
  if found then return e; end if;
  st := (d::date + make_interval(hours => 12 + (h % 10)::integer))::timestamp at time zone 'Asia/Taipei';
  insert into public.shrimp_events (id, fish, start_at, end_at)
  values (replace(d, '-', '')::bigint, (array['bluelobster'])[1], st, st + interval '2 hours')
  on conflict (id) do nothing;
  select * into e from public.shrimp_events where id = replace(d, '-', '')::bigint;
  return e;
end $$;

-- 拋竿時（roll_fish）呼叫：碰到了就回傳那隻的 id，並先記下是誰在拉
create or replace function public._sev_try(p_uid uuid) returns text language plpgsql security definer set search_path = public as $$
declare e public.shrimp_events := public._sev_today();
begin
  if now() < e.start_at or now() >= e.end_at or e.caught_by is not null then return null; end if;
  if e.hooked_by is not null and e.hooked_by <> p_uid and e.hooked_at > now() - interval '90 seconds' then return null; end if;
  if random() >= public._sev_p() then return null; end if;
  update public.shrimp_events set hooked_by = p_uid, hooked_at = now() where id = e.id and caught_by is null;
  return e.fish;
end $$;

-- 拉上來時（record_catch）呼叫：只有正在拉的人能拿到，而且只有一次
create or replace function public._sev_claim(p_uid uuid, p_name text, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shrimp_events set caught_by = p_uid, caught_name = coalesce(nullif(p_name, ''), '有人'), caught_w = p_w, caught_at = now()
  where id = (select id from public.shrimp_events where fish = p_fish and hooked_by = p_uid and caught_by is null order by id desc limit 1);
  if not found then raise exception '這隻已經被別人釣走了'; end if;
end $$;

-- 給遊戲看的：今天的活動（還沒開始、進行中、被誰釣走了）
create or replace function public.get_shrimp_event() returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.shrimp_events := public._sev_today();
begin
  if now() >= e.end_at then
    -- 今天的結束了，給明天的時間表（不建資料，只是算出來）
    declare d text := to_char((now() at time zone 'Asia/Taipei') + interval '1 day', 'YYYY-MM-DD'); h bigint := public._fnv('sev' || d); st timestamptz;
    begin st := (d::date + make_interval(hours => 12 + (h % 10)::integer))::timestamp at time zone 'Asia/Taipei';
      return jsonb_build_object('id', replace(d, '-', '')::bigint, 'fish', (array['bluelobster'])[1], 'start_at', st, 'end_at', st + interval '2 hours', 'caught_name', null); end;
  end if;
  return jsonb_build_object('id', e.id, 'fish', e.fish, 'start_at', e.start_at, 'end_at', e.end_at, 'caught_name', e.caught_name);
end $$;

revoke all on function public._sev_today() from public, anon, authenticated;
revoke all on function public._sev_try(uuid) from public, anon, authenticated;
revoke all on function public._sev_claim(uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function public.get_shrimp_event() from public;
grant execute on function public.get_shrimp_event() to anon, authenticated;

select '釣蝦場放生活動設定完成 🎉' as result;

-- 放生：藍色龍蝦放生得到 50 愛海點數；活動還沒結束的話，牠會回到池子裡（其他人又有機會釣到）
-- 下面兩個函式取代 015 的版本，其他規則跟 015 一樣
create or replace function public._love_pts(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select case when sp.id = 'bluelobster' then 50 else greatest(case when public._undersized(sp, w) then 3 else 0 end,
                  case sp.rarity when '常見' then 1 when '稀有' then 3 else 10 end) end $$;

create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer; fid text;
begin
  select public._love_pts(sp, (e->>'w')::numeric), sp.id into pts, fid
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
  return pl;
end $$;
revoke all on function public.release_fish(bigint) from public, anon;
grant execute on function public.release_fish(bigint) to authenticated;
