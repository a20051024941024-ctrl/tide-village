-- 潮汐釣魚村：一起住的人共用「我的海」（v652，可以重複執行）
-- 作者：「那一起住的怎麼辦」→ 小島海底看得到這個家每個人放進「我的海」的魚，每條魚寫是誰的。
-- 回傳島主和一起住的人：[{ id, n(暱稱), fish:[放進我的海的魚] }]
create or replace function public.home_sea(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'n', p.nickname, 'fish', public._show_tank(p.tank, p.show), 'show', p.show) order by (p.id <> p_owner), p.created_at), '[]'::jsonb)
  from public.players p
  where p.id = p_owner or p.id in (select member from public.home_members where owner = p_owner) $$;
revoke all on function public.home_sea(uuid) from public;
grant execute on function public.home_sea(uuid) to anon, authenticated;
select '一起住的人共用我的海 🐠' as result;
