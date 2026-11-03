-- 潮汐釣魚村：每週比賽、食堂客人、吃料理、檢舉與禁言（第 3 份資料庫設定）
-- 用法：Supabase 後台 → SQL Editor → New query → 整份貼上 → Run。重複執行也沒關係。
-- 需要先執行過 schema.sql 和 002_cooking.sql。

alter table public.players add column if not exists week_id integer;                     -- 比賽的週次，例如 202645
alter table public.players add column if not exists week_best_w numeric(10,2) not null default 0;
alter table public.players add column if not exists serve_day date;
alter table public.players add column if not exists serve_count integer not null default 0;
create index if not exists players_week_idx on public.players (week_id, week_best_w desc);

-- ========== 每週釣魚比賽：每週一（台灣時間）換一種目標魚，比誰釣得最重 ==========
create or replace function public.current_contest(out week_id integer, out fish text, out ends_at timestamptz) language sql stable as $$
  with w as (select date_trunc('week', now() at time zone 'Asia/Taipei') as start)
  select to_char(w.start, 'IYYYIW')::integer,
         (array['perch','mackerel','moonbream','crucian','scorpion','catfish','kuhua','goby','ayu','manta','sunfish','beluga','dolphin'])[1 + (to_char(w.start, 'IYYYIW')::integer % 13)],
         (w.start + interval '7 days') at time zone 'Asia/Taipei'
  from w $$;
grant execute on function public.current_contest() to anon, authenticated;

-- 釣到魚：跟原本一樣，另外記錄本週比賽魚的最佳重量
create or replace function public.record_catch(p_fish text, p_weight numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare
  pl public.players := public._me();
  sp public.fish_species;
  w  numeric := round(p_weight, 2);
  ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  c  record;
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
    last_catch_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- ========== 食堂客人：把料理端給點餐的客人，價格 ×1.5（每天最多 60 位客人）==========
create or replace function public.serve_dish(p_ts bigint, p_recipe text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d jsonb; today date := (now() at time zone 'Asia/Taipei')::date; got integer;
begin
  select e into d from jsonb_array_elements(pl.dishes) e where (e->>'t')::bigint = p_ts limit 1;
  if d is null or d->>'r' <> p_recipe then raise exception '沒有這道料理'; end if;
  if pl.serve_day = today and pl.serve_count >= 60 then raise exception '今天客人都吃飽了'; end if;
  got := round(public._dish_price(d->>'r', (d->>'q')::int) * 1.5);
  update public.players set
    dishes = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    coins = coins + got, earned = earned + got,
    serve_count = case when serve_day = today then serve_count + 1 else 1 end, serve_day = today, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- ========== 吃料理（加成效果在遊戲裡）==========
create or replace function public.eat_dish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  update public.players set
    dishes = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- ========== 檢舉 ==========
-- 檢舉紀錄只有你（專案擁有者）在後台 Table Editor 看得到，玩家看不到
create table if not exists public.reports (
  id         bigserial primary key,
  reporter   uuid not null default auth.uid(),
  target     uuid not null,
  target_name text,
  reason     text not null,
  chat       text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.report_player(p_target uuid, p_name text, p_reason text, p_chat text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  if p_target = auth.uid() then return false; end if;
  if (select count(*) from public.reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception '今天檢舉太多次了'; end if;
  if exists (select 1 from public.reports where reporter = auth.uid() and target = p_target and created_at > now() - interval '1 hour') then return true; end if;
  insert into public.reports (reporter, target, target_name, reason, chat) values (auth.uid(), p_target, left(p_name, 32), left(p_reason, 40), left(p_chat, 600));
  return true;
end $$;

-- ========== 禁言 ==========
-- 你在後台 Table Editor → muted 新增一列（user_id、until 到什麼時候）就能禁言；所有玩家的遊戲都會把他藏起來
create table if not exists public.muted (
  user_id uuid primary key,
  until   timestamptz not null default now() + interval '7 days',
  note    text
);
alter table public.muted enable row level security;
drop policy if exists "muted readable" on public.muted;
create policy "muted readable" on public.muted for select using (true);
revoke all on public.muted from anon, authenticated;
grant select on public.muted to anon, authenticated;

do $$ declare f text; begin
  foreach f in array array['serve_dish(bigint,text)', 'eat_dish(bigint)', 'report_player(uuid,text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '新功能設定完成 🎉' as result;
