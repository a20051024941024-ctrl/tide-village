-- 177 ⚔️ 「有人在找對手」的提示（v530，作者 11/17：加了對決以後上線的人變多 → 先解決「上線了卻找不到人打」）
-- duel_queue_peek：現在有沒有「別人」正在排排位賽。手機每 15 秒問一次，有的話畫面上跳一顆「某某 在找對手・跟他打」。
-- 只回人數、排最久那個人的名字和段位，不回其他資料。可以重複執行。

create or replace function public.duel_queue_peek() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.seen_at > now() - interval '20 seconds'),
    'name', (select q.name from public.duel_queue q where q.uid <> auth.uid() and q.seen_at > now() - interval '20 seconds' order by q.joined_at limit 1),
    'tier', (select public._duel_tier(q.stars) from public.duel_queue q where q.uid <> auth.uid() and q.seen_at > now() - interval '20 seconds' order by q.joined_at limit 1)) $$;
revoke all on function public.duel_queue_peek() from public, anon;
grant execute on function public.duel_queue_peek() to authenticated;
