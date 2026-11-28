-- 潮汐釣魚村 v1019：好友列表顯示每個人自己的新人物大頭照（可以重複執行）
-- 作者 11/29 截圖：好友列表沒在線上的人都是 🙂 → 新人物的樣子以前只存在自己的手機裡，別人看不到。
-- players.k3：新人物的樣子（遊戲裡 K3.enc 的字串，220 字以內，只有英文、數字、#、|、_）；自己進遊戲、換造型時存一次
-- get_friends 多回傳 k3（其他欄位跟 130 一樣）
alter table public.players add column if not exists k3 text not null default '';

create or replace function public.set_my_k3(p text) returns text language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); v text := coalesce(btrim(p), '');
begin
  if length(v) > 220 or v !~ '^[A-Za-z0-9#|_]*$' then raise exception '造型資料不對'; end if;
  update public.players set k3 = v where id = pl.id and k3 is distinct from v;
  return v;
end $$;
revoke all on function public.set_my_k3(text) from public, anon;
grant execute on function public.set_my_k3(text) to authenticated;

create or replace function public.get_friends() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'av', p.avatar, 'k3', p.k3, 'seen', p.updated_at,
        'mutual', exists (select 1 from public.friends r where r.owner = f.friend and r.friend = pl.id)) order by f.created_at)
      from public.friends f join public.players p on p.id = f.friend where f.owner = pl.id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'av', p.avatar, 'k3', p.k3) order by f.created_at desc)
      from public.friends f join public.players p on p.id = f.owner
      where f.friend = pl.id and not exists (select 1 from public.friends m where m.owner = pl.id and m.friend = f.owner)), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from', g.from_id, 'name', p.nickname, 'kind', g.kind, 'data', g.data, 'at', g.created_at) order by g.id desc)
      from (select * from public.gifts where to_id = pl.id and not opened order by id desc limit 30) g left join public.players p on p.id = g.from_id), '[]'::jsonb));
end $$;

select '好友大頭照設定完成 🧑' as result;
