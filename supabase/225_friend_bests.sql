-- 225 朋友的釣魚紀錄：每種魚朋友釣過最大的（圖鑑和釣到魚的卡片上跟朋友比）
-- 可以重複執行。貼到 Supabase 的 SQL Editor 按 Run 就好（要先跑過 018_friends.sql）。
-- 只回傳「我加的好友」的名字和每種魚的最大重量，不回傳其他資料。
create or replace function public.friend_bests() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'best', p.fish_best))
      from public.friends f join public.players p on p.id = f.friend
     where f.owner = me
     limit 200), '[]'::jsonb);
end $$;

revoke all on function public.friend_bests() from public, anon;
grant execute on function public.friend_bests() to authenticated;

select '朋友的釣魚紀錄設定完成 🎣' as result;
