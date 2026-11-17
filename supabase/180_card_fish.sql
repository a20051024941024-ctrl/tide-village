-- 180 🪪 名片上「最得意的三種魚」可以自己選（v535，作者 11/17：「應該是要能自己選吧」）
-- players.card_fish：自己挑的魚種（最多 3 種，一定要是自己釣過的）。沒挑就照舊顯示最重的三種。可以重複執行。

alter table public.players add column if not exists card_fish jsonb;

create or replace function public.player_set_card_fish(p_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); out jsonb := '[]'::jsonb; k text; n int := 0;
begin
  if p_ids is not null then foreach k in array p_ids loop
    exit when n >= 3;
    if k is not null and length(k) <= 40 and coalesce(pl.fish_best, '{}'::jsonb) ? k and not (out ? k) then out := out || to_jsonb(k); n := n + 1; end if;
  end loop; end if;
  update public.players set card_fish = case when n = 0 then null else out end, updated_at = now() where id = pl.id;
  return jsonb_build_object('ok', true, 'picked', out);
end $$;

create or replace function public.player_card(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.players; s public.duel_stats; t public.teams; top jsonb; dex int; picked boolean := false;
begin
  select * into p from public.players where id = p_uid;
  if not found then return jsonb_build_object('err', '找不到這位玩家'); end if;
  select * into s from public.duel_stats where uid = p_uid;
  select tm.* into t from public.team_members m join public.teams tm on tm.id = m.team where m.uid = p_uid limit 1;
  if p.card_fish is not null and jsonb_typeof(p.card_fish) = 'array' and jsonb_array_length(p.card_fish) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('f', c.k, 'w', (p.fish_best->c.k)::text::numeric) order by c.ord), '[]'::jsonb) into top
      from jsonb_array_elements_text(p.card_fish) with ordinality c(k, ord) where coalesce(p.fish_best, '{}'::jsonb) ? c.k and jsonb_typeof(p.fish_best->c.k) = 'number';
    picked := jsonb_array_length(top) > 0;
  end if;
  if not picked then
    select coalesce(jsonb_agg(jsonb_build_object('f', k, 'w', v) order by v desc), '[]'::jsonb) into top
      from (select e.key k, (e.value)::text::numeric v from jsonb_each(coalesce(p.fish_best, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number' order by 2 desc limit 3) x;
  end if;
  select count(*) into dex from jsonb_object_keys(coalesce(p.fish_count, '{}'::jsonb));
  return jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'total', p.total, 'legend', p.legend, 'dex', dex,
    'best_fish', p.best_fish, 'best_w', p.best_w, 'top', top, 'picked', picked, 'likes', coalesce(p.likes, 0), 'motto', coalesce(p.motto, ''),
    'since', (extract(epoch from p.created_at) * 1000)::bigint,
    'team', case when t.id is null then null else jsonb_build_object('name', t.name, 'badge', t.badge, 'color', t.color) end,
    'duel', case when s.uid is null then null else jsonb_build_object('wins', s.wins, 'losses', s.losses, 'best', s.best_streak, 'stars', s.stars, 'tier', public._duel_tier(s.stars)) end,
    'me', p.id = auth.uid());
end $$;

revoke all on function public.player_set_card_fish(text[]) from public, anon;
grant execute on function public.player_set_card_fish(text[]) to authenticated;
revoke all on function public.player_card(uuid) from public, anon;
grant execute on function public.player_card(uuid) to authenticated;
