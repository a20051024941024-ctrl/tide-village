-- 103 阿鐵師傅做活餌（v255）：2 條常見魚＋30 金幣 → 4 個活餌（live）。可以重複執行。
-- 活餌吸引掠食魚（020 roll_fish：bait.k = 'pred'）。商店不賣（_bait_info 沒有 live）。每人每天最多做 8 次活餌。
alter table public.craft_log add column if not exists nb integer not null default 0;
create or replace function public.craft_bait(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer;
  need integer := 2; cost integer := 30; pack integer := 4;
begin
  if p_id <> 'live' then raise exception '阿鐵師傅不會做這種餌'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  select nb into cnt from public.craft_log where uid = pl.id and day = td;
  if coalesce(cnt, 0) >= 8 then raise exception '活餌今天做夠多了，明天再來'; end if;
  if coalesce((pl.bait ->> p_id)::integer, 0) >= 99 then raise exception '活餌已經很多了，先用掉一些'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where coalesce(cfg->'fish'->(x->>'f')->>'r', '常見') = '常見' and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit need) q;
  if coalesce(array_length(use, 1), 0) < need then raise exception '魚不夠：要 2 條常見的魚（收藏、展示中的不算）'; end if;
  update public.players set coins = coins - cost,
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[p_id], to_jsonb(least(99, coalesce((bait ->> p_id)::integer, 0) + pack))),
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n, nb) values (pl.id, td, 0, 1) on conflict (uid, day) do update set nb = public.craft_log.nb + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use));
end $$;
revoke all on function public.craft_bait(text) from public, anon;
grant execute on function public.craft_bait(text) to authenticated;
