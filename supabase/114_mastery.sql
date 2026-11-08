-- 114 魚種精通（v287）：圖鑑每種魚 3 顆星。可以重複執行。
--   ★   第一次釣到
--   ★★  釣到 10 條，或釣過一條「大尺寸」（這種魚重量範圍的前 20%）
--   ★★★ 釣過一次「完美搏鬥」（魚的每個動作都對上、線沒有快爆）＋釣過「紀錄級」（前 5%）
-- 星星由伺服器算（players.fish_count / fish_best ＋ 這裡的 fish_mastery）。三顆星的魚，之後釣到大尺寸的機率小幅提高（roll_fish）。
create table if not exists public.fish_mastery (uid uuid not null, fish text not null, perfect_at timestamptz not null default now(), primary key (uid, fish));
alter table public.fish_mastery enable row level security;
revoke all on public.fish_mastery from anon, authenticated;

create or replace function public._star_of(p_n integer, p_best numeric, p_min numeric, p_max numeric, p_perfect boolean) returns integer language sql immutable as $$
  select case when coalesce(p_n, 0) < 1 then 0
              when p_perfect and coalesce(p_best, 0) >= p_min + (p_max - p_min) * 0.95 then 3
              when p_n >= 10 or coalesce(p_best, 0) >= p_min + (p_max - p_min) * 0.8 then 2
              else 1 end $$;

-- 剛釣上來的那條魚是完美搏鬥：手機回報，伺服器檢查是不是真的剛釣到這種魚、搏鬥時間夠長
create or replace function public.fish_perfect(p_fish text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f jsonb := public._fishcfg()->'fish'->p_fish; mint numeric; isnew boolean;
begin
  if f is null or pl.last_fish is distinct from p_fish or pl.last_catch_at is null or now() - pl.last_catch_at > interval '60 seconds' then return jsonb_build_object('ok', false); end if;
  mint := 5;   -- 要對上至少兩個動作，最快也要好幾秒
  if pl.cast_at is null or extract(epoch from pl.last_catch_at - pl.cast_at) < mint then return jsonb_build_object('ok', false); end if;
  insert into public.fish_mastery (uid, fish) values (pl.id, p_fish) on conflict do nothing; isnew := found;
  return jsonb_build_object('ok', true, 'new', isnew, 'stars', public._star_of((pl.fish_count->>p_fish)::int, (pl.fish_best->>p_fish)::numeric, (f->>'min')::numeric, (f->>'max')::numeric, true));
end $$;
revoke all on function public.fish_perfect(text) from public, anon;
grant execute on function public.fish_perfect(text) to authenticated;

-- 我完美搏鬥過的魚
create or replace function public.my_mastery() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(fish), '{}') from public.fish_mastery where uid = auth.uid() $$;
revoke all on function public.my_mastery() from public, anon;
grant execute on function public.my_mastery() to authenticated;

-- 一個人的總星數
create or replace function public._stars_total(p_uid uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(public._star_of((p.fish_count->>k)::int, (p.fish_best->>k)::numeric, (c.v->>'min')::numeric, (c.v->>'max')::numeric, m.fish is not null)), 0)::int
  from public.players p cross join lateral jsonb_object_keys(p.fish_count) k
  join lateral (select public._fishcfg()->'fish'->k as v) c on c.v is not null
  left join public.fish_mastery m on m.uid = p.id and m.fish = k
  where p.id = p_uid $$;
revoke all on function public._stars_total(uuid) from public, anon, authenticated;

-- 圖鑑星數排行（只給名字和星數）
create or replace function public.star_board() returns table (name text, stars integer) language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.nickname, ''), '釣客'), public._stars_total(p.id) s from public.players p where p.total > 0 order by s desc, p.total desc limit 20 $$;
revoke all on function public.star_board() from public, anon;
grant execute on function public.star_board() to authenticated;

-- roll_fish 用：這種魚三顆星了沒
create or replace function public._mastery3(p_uid uuid, p_fish text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.fish_mastery m join public.players p on p.id = m.uid
    where m.uid = p_uid and m.fish = p_fish and coalesce((p.fish_best->>p_fish)::numeric, 0) >= ((public._fishcfg()->'fish'->p_fish->>'min')::numeric + ((public._fishcfg()->'fish'->p_fish->>'max')::numeric - (public._fishcfg()->'fish'->p_fish->>'min')::numeric) * 0.95)) $$;
revoke all on function public._mastery3(uuid, text) from public, anon, authenticated;
