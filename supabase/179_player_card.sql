-- 179 🪪 個人名片（v534，作者 11/17：「我們是不是該加入像傳說對決，玩家個人展示系統」）
-- 點別人就能看到他的名片：釣了幾條、圖鑑幾種、最大的魚、最得意的三條、對決段位和戰績、釣友隊、一句自己寫的話。
-- 只放玩家自己玩出來的成績，不放任何要花錢買的裝飾。可以重複執行。

alter table public.players add column if not exists motto text;

create or replace function public.player_card(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.players; s public.duel_stats; t public.teams; top jsonb; dex int;
begin
  select * into p from public.players where id = p_uid;
  if not found then return jsonb_build_object('err', '找不到這位玩家'); end if;
  select * into s from public.duel_stats where uid = p_uid;
  select tm.* into t from public.team_members m join public.teams tm on tm.id = m.team where m.uid = p_uid limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('f', k, 'w', v) order by v desc), '[]'::jsonb) into top
    from (select e.key k, (e.value)::text::numeric v from jsonb_each(coalesce(p.fish_best, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number' order by 2 desc limit 3) x;
  select count(*) into dex from jsonb_object_keys(coalesce(p.fish_count, '{}'::jsonb));
  return jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'total', p.total, 'legend', p.legend, 'dex', dex,
    'best_fish', p.best_fish, 'best_w', p.best_w, 'top', top, 'likes', coalesce(p.likes, 0), 'motto', coalesce(p.motto, ''),
    'since', (extract(epoch from p.created_at) * 1000)::bigint,
    'team', case when t.id is null then null else jsonb_build_object('name', t.name, 'badge', t.badge, 'color', t.color) end,
    'duel', case when s.uid is null then null else jsonb_build_object('wins', s.wins, 'losses', s.losses, 'best', s.best_streak, 'stars', s.stars, 'tier', public._duel_tier(s.stars)) end,
    'me', p.id = auth.uid());
end $$;

create or replace function public.player_set_motto(p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); v text := left(btrim(regexp_replace(coalesce(p_text, ''), '[\r\n\t<>]', ' ', 'g')), 30);
begin
  update public.players set motto = nullif(v, ''), updated_at = now() where id = pl.id;
  return jsonb_build_object('ok', true, 'motto', v);
end $$;

revoke all on function public.player_card(uuid) from public, anon;
revoke all on function public.player_set_motto(text) from public, anon;
grant execute on function public.player_card(uuid) to authenticated;
grant execute on function public.player_set_motto(text) to authenticated;
