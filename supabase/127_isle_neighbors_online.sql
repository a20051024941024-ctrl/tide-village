-- 潮汐釣魚村 v320：海上看到的鄰居島，改成「現在在線上的人」的島（人下線了島就收起來）（可以重複執行）
-- 手機把同一個大廳裡在線上的人的 id 傳上來（最多 12 個），回傳的格式跟 isle_neighbors 一樣（072）
create or replace function public.isle_neighbors_of(p_ids uuid[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'likes', p.likes, 'island', jsonb_build_object('v', 2, 'items',
    (select coalesce(jsonb_agg(jsonb_build_object('id', e->'id', 't', e->'t', 'x', e->'x', 'z', e->'z', 'r', e->'r')), '[]'::jsonb) from (
       (select e from jsonb_array_elements(public._isle_items(public._isle_upgrade(p.island))) e where (public._isle_item(e->>'t')).house)
       union all (select e from jsonb_array_elements(public._isle_items(public._isle_upgrade(p.island))) e where not coalesce((public._isle_item(e->>'t')).house, false) limit 18)) q(e)))) order by p.likes desc), '[]'::jsonb)
  from (select id, nickname, likes, island from public.players
        where id = any(coalesce(p_ids[1:12], '{}'::uuid[])) and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
          and jsonb_array_length(coalesce(island->'items', '[]'::jsonb)) > 0 order by likes desc limit 12) p $$;
revoke all on function public.isle_neighbors_of(uuid[]) from public;
grant execute on function public.isle_neighbors_of(uuid[]) to anon, authenticated;
select '鄰居島改成在線上的人 🏝️' as result;
