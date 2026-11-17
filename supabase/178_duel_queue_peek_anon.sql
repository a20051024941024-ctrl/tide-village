-- 178 ⚔️ 「有人在找對手」的提示不顯示名字（v531，作者 11/17：「一定要顯示名字嗎」）
-- 只回有幾個別人在排隊，不回名字和段位：看到是誰就挑對手（看到強的不打、專挑新手）不公平，排隊的人也不一定想被大家知道。可以重複執行。

create or replace function public.duel_queue_peek() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', (select count(*) from public.duel_queue q where q.uid <> auth.uid() and q.seen_at > now() - interval '20 seconds')) $$;
revoke all on function public.duel_queue_peek() from public, anon;
grant execute on function public.duel_queue_peek() to authenticated;
