-- 潮汐釣魚村 v357：每天誰有上線（可以重複執行）
-- 為了一個月後看數據決定要不要上架：以前只知道「今天有幾個人上線」，不知道「新玩家隔天還來不來」。
-- 每小時記一次「這一小時有動過的玩家」，一天一個人一筆，hrs = 那天有幾個小時在玩（大約的遊玩時間）。只記玩家代號和日期，不記其他個資；留 120 天。
create table if not exists public.metrics_active (
  day  date not null,
  uid  uuid not null,
  hrs  integer not null default 1,
  primary key (day, uid)
);
alter table public.metrics_active enable row level security;
revoke all on public.metrics_active from anon, authenticated;

create or replace function public._metrics_tick() returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.metrics_active (day, uid)
    select (now() at time zone 'Asia/Taipei')::date, id from public.players where updated_at >= now() - interval '60 minutes'
  on conflict (day, uid) do update set hrs = public.metrics_active.hrs + 1;
  delete from public.metrics_active where day < (now() at time zone 'Asia/Taipei')::date - 120;
end $$;
revoke all on function public._metrics_tick() from public, anon, authenticated;

do $$ begin
  -- 先把「今天已經上線過的人」補進去，不用等到下一個整點
  insert into public.metrics_active (day, uid)
    select (now() at time zone 'Asia/Taipei')::date, id from public.players
    where updated_at >= (date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')
  on conflict do nothing;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-metrics', '58 * * * *', 'select public._metrics_tick()');   -- 每小時 58 分
  end if;
end $$;
