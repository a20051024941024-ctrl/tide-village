-- 潮汐釣魚村：定時釣魚大賽（每天台灣時間 12:00、19:00、21:00，各 10 分鐘；比總重量，前三名有獎）（可以重複執行）
-- 時間要跟 js/game.js 的 TOURNEY 一樣
alter table public.players add column if not exists tourney_id    bigint;                              -- 例如 2026110319
alter table public.players add column if not exists tourney_w     numeric(10,2) not null default 0;
alter table public.players add column if not exists tourney_n     integer not null default 0;
alter table public.players add column if not exists tourney_claim bigint;                              -- 領過獎的那一場
create index if not exists players_tourney_idx on public.players (tourney_id, tourney_w desc);

-- 某個時間點正在進行的大賽（沒有就回傳 null）
create or replace function public._tourney_at(ts timestamptz) returns bigint language sql immutable as $$
  select case when extract(hour from l) in (12, 19, 21) and extract(minute from l) < 10
              then to_char(l, 'YYYYMMDDHH24')::bigint end
  from (select ts at time zone 'Asia/Taipei' as l) s $$;
-- 這一場什麼時候結束
create or replace function public._tourney_end(p_id bigint) returns timestamptz language sql immutable as $$
  select (to_timestamp(p_id::text, 'YYYYMMDDHH24')::timestamp + interval '10 minutes') at time zone 'Asia/Taipei' $$;

-- 釣到魚：跟 003 一樣，另外把大賽期間的重量加起來
create or replace function public.record_catch(p_fish text, p_weight numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare
  pl public.players := public._me();
  sp public.fish_species;
  w  numeric := round(p_weight, 2);
  ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  c  record;
  tid bigint := public._tourney_at(now());
begin
  select * into sp from public.fish_species where id = p_fish;
  if not found then raise exception '沒有這種魚'; end if;
  if w < sp.min_w or w > sp.max_w then raise exception '重量不合理'; end if;
  if pl.last_catch_at is not null and now() - pl.last_catch_at < interval '3 seconds' then raise exception '釣太快了'; end if;
  select * into c from public.current_contest();
  update public.players set
    total      = total + 1,
    legend     = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
    fish_count = jsonb_set(fish_count, array[p_fish], to_jsonb(coalesce((fish_count ->> p_fish)::int, 0) + 1)),
    fish_best  = case when coalesce((fish_best ->> p_fish)::numeric, 0) < w then jsonb_set(fish_best, array[p_fish], to_jsonb(w)) else fish_best end,
    best_fish  = case when w > best_w then p_fish else best_fish end,
    best_w     = greatest(best_w, w),
    tank       = public._trim_tank(jsonb_build_array(jsonb_build_object('f', p_fish, 'w', w, 't', ts)) || tank, show),
    week_best_w = case when p_fish <> c.fish then (case when week_id = c.week_id then week_best_w else 0 end)
                       when week_id = c.week_id then greatest(week_best_w, w) else w end,
    week_id    = case when p_fish = c.fish or week_id = c.week_id then c.week_id else week_id end,
    tourney_w  = case when tid is null then tourney_w when tourney_id = tid then tourney_w + w else w end,
    tourney_n  = case when tid is null then tourney_n when tourney_id = tid then tourney_n + 1 else 1 end,
    tourney_id = coalesce(tid, tourney_id),
    last_catch_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 大賽結束後領獎：第一名 3000、第二名 1500、第三名 800，其他有參加（釣到至少一條）的人 100
create or replace function public.claim_tourney() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); rk integer; prize integer;
begin
  if pl.tourney_id is null or pl.tourney_n <= 0 then return pl; end if;
  if pl.tourney_claim is not distinct from pl.tourney_id then return pl; end if;
  if now() < public._tourney_end(pl.tourney_id) + interval '20 seconds' then return pl; end if;   -- 等最後幾條魚都算完
  select 1 + count(*) into rk from public.players where tourney_id = pl.tourney_id and tourney_w > pl.tourney_w;
  prize := case rk when 1 then 3000 when 2 then 1500 when 3 then 800 else 100 end;
  update public.players set coins = coins + prize, earned = earned + prize, tourney_claim = pl.tourney_id, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['claim_tourney()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '定時釣魚大賽設定完成 🏆' as result;
