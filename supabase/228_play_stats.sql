-- 228 📊 遊玩紀錄（v848，作者 11/25：80 人來過、昨天只剩 1 人 → 先知道新玩家在哪裡離開）。可以重複執行。
-- 只記「遊戲裡做到哪一步」和「每天玩幾分鐘、最後在做什麼」，不記個人資料、位置、聊天內容。手機不能讀，只有部署紀錄印出統計。
-- ・play_ms：每個人每個里程碑只記第一次（例：cast1 第一次拋竿、catch1 第一次釣到、g1～g5 新手五步、tab:dex 第一次打開圖鑑）。
-- ・play_days：每個人每天玩了幾分鐘（手機開著畫面時每 60 秒報一次）、最後一次在做什麼（last_ctx，例：fish:waiting、sheet:shop、walk）。
create table if not exists public.play_ms (
  uid uuid not null, ev text not null, at timestamptz not null default now(),
  primary key (uid, ev));
create table if not exists public.play_days (
  uid uuid not null, day date not null, mins integer not null default 0,
  first_at timestamptz not null default now(), last_at timestamptz not null default now(), last_ctx text,
  primary key (uid, day));
alter table public.play_ms enable row level security;
alter table public.play_days enable row level security;

create or replace function public.stat_ms(p_ev text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null or p_ev is null or p_ev !~ '^[a-z0-9_:]{1,24}$' then return; end if;
  if (select count(*) from public.play_ms where uid = u) >= 150 then return; end if;
  insert into public.play_ms (uid, ev) values (u, p_ev) on conflict do nothing;
end $$;
revoke all on function public.stat_ms(text) from public, anon;
grant execute on function public.stat_ms(text) to authenticated;

create or replace function public.stat_beat(p_ctx text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); d date := (now() at time zone 'Asia/Taipei')::date; c text := left(coalesce(p_ctx, ''), 40);
begin
  if u is null then return; end if;
  if c !~ '^[a-z0-9_:|.-]*$' then c := 'x'; end if;
  insert into public.play_days (uid, day, mins, last_ctx) values (u, d, 1, c)
  on conflict (uid, day) do update set mins = least(1440, public.play_days.mins + 1), last_at = now(), last_ctx = c
    where public.play_days.last_at < now() - interval '45 seconds';   -- 太快重複報不算
end $$;
revoke all on function public.stat_beat(text) from public, anon;
grant execute on function public.stat_beat(text) to authenticated;

-- 部署時印出來：最近 30 天新來的玩家，每一步有幾個人做到（漏斗），和「之後沒再回來的人最後在做什麼」
with np as (select id, created_at from public.players where created_at > now() - interval '30 days'),
ms as (select m.ev, count(*) n from public.play_ms m join np on np.id = m.uid group by m.ev)
select '遊玩紀錄 📊 新玩家 ' || (select count(*) from np) || ' 人；做到：' ||
  coalesce((select string_agg(e || ' ' || coalesce((select n from ms where ms.ev = e), 0), '、' order by o)
    from unnest(array['boot1','cast1','bite1','catch1','tab:dex','g2','sell1','g3','boat1','g4','catch5','g5','catch20','isle1','name','day2','day7']) with ordinality as t(e, o)), '')
  as result;
with last as (select distinct on (uid) uid, day, last_ctx, mins from public.play_days order by uid, day desc)
select '遊玩紀錄 📊 超過 2 天沒回來的人，最後在做什麼：' || coalesce(string_agg(c || ' ' || n, '、' order by n desc), '還沒有資料') as result
from (select coalesce(nullif(split_part(last_ctx, '|', 2), ''), last_ctx, '?') c, count(*) n from last where day < (now() at time zone 'Asia/Taipei')::date - 2 group by 1 order by 2 desc limit 10) z;
select '遊玩紀錄 📊 每天平均玩幾分鐘（最近 7 天，有玩的人）：' || coalesce(round(avg(mins))::text, '0') || ' 分鐘，' || count(distinct uid) || ' 人' as result
from public.play_days where day > (now() at time zone 'Asia/Taipei')::date - 7;
