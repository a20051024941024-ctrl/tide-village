-- 105 深海目擊（v261）：開潛水艇遇到的事件（魚群包圍、深海的光、黑暗中的眼睛、那盞燈、抹香鯨），每一種第一次看到記一筆、送 💙30 愛海點數。可以重複執行。
-- 只在開潛水艇的時候才能記（要有進行中的潛水），深的事件要這一趟真的下到 1000 公尺以下。
create table if not exists public.sub_sightings (uid uuid not null, kind text not null, at timestamptz not null default now(), primary key (uid, kind));
alter table public.sub_sightings enable row level security;

-- 關燈省電：午夜層可以把潛水艇的燈關掉，關燈的時間電池只用一半。伺服器記關燈多久，電池檢查多給那一半的時間。
alter table public.sub_dives add column if not exists dark_s numeric not null default 0;
alter table public.sub_dives add column if not exists dark_at timestamptz;
create or replace function public._sub_active(uid uuid) returns public.sub_dives language plpgsql security definer set search_path = public as $$
declare d public.sub_dives; saved numeric;
begin
  select * into d from public.sub_dives where sub_dives.uid = _sub_active.uid and active order by id desc limit 1 for update;
  if d.id is null then raise exception '你現在沒有在開潛水艇'; end if;
  saved := least(d.battery_s, (coalesce(d.dark_s, 0) + coalesce(extract(epoch from now() - d.dark_at), 0)) / 2);
  if now() - d.started > make_interval(secs => d.battery_s + 60 + saved) then raise exception '電池早就沒電了，先回港'; end if;
  return d;
end $$;
drop function if exists public.sub_dark(boolean);
-- 記這一趟到過多深（跟 sub_cast 一樣：比耐壓＋150 還深就是改過數字，不採用）
create or replace function public._sub_depth(uid uuid, p_depth integer) returns public.sub_dives language plpgsql security definer set search_path = public as $$
declare d public.sub_dives := public._sub_active(uid); dep integer := greatest(0, coalesce(p_depth, 0));
begin
  if dep > 0 and dep <= d.pressure_m + 150 and dep <= 3100 and dep > d.max_depth then update public.sub_dives set max_depth = dep where id = d.id returning * into d; end if;
  return d;
end $$;
revoke all on function public._sub_depth(uuid, integer) from public, anon, authenticated;

drop function if exists public.sub_sighting(text);
create or replace function public.sub_sighting(p_kind text, p_depth integer default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; n integer := 0; first boolean := false;
begin
  if p_kind is not null then
    if p_kind not in ('school', 'glow', 'eyes', 'lure', 'whale') then raise exception '沒有這種目擊'; end if;
    d := public._sub_depth(pl.id, p_depth);
    if p_kind in ('glow', 'eyes', 'lure') and coalesce(d.max_depth, 0) < 1000 then raise exception '這要在 1000 公尺以下才看得到'; end if;
    insert into public.sub_sightings (uid, kind) values (pl.id, p_kind) on conflict do nothing;
    get diagnostics n = row_count; first := n > 0;
    if first then update public.players set love = love + 30, updated_at = now() where id = pl.id returning * into pl; end if;
  end if;
  return jsonb_build_object('first', first, 'kinds', coalesce((select jsonb_agg(kind order by at) from public.sub_sightings where uid = pl.id), '[]'::jsonb), 'player', to_jsonb(pl));
end $$;
revoke all on function public.sub_sighting(text, integer) from public, anon;
grant execute on function public.sub_sighting(text, integer) to authenticated;

create or replace function public.sub_dark(p_on boolean, p_depth integer default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives;
begin
  d := public._sub_depth(pl.id, p_depth);
  if coalesce(p_on, false) then
    if coalesce(d.max_depth, 0) < 1000 then raise exception '要到午夜層（1000 公尺以下）才能關燈'; end if;
    if d.dark_at is null then update public.sub_dives set dark_at = now() where id = d.id; end if;
  elsif d.dark_at is not null then
    update public.sub_dives set dark_s = dark_s + least(extract(epoch from now() - d.dark_at), d.battery_s * 2), dark_at = null where id = d.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sub_dark(boolean, integer) from public, anon;
grant execute on function public.sub_dark(boolean, integer) to authenticated;
revoke all on function public._sub_active(uuid) from public, anon, authenticated;
