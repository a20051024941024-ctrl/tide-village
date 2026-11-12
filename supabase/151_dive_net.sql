-- 潮汐釣魚村 v390：手抄網改成要用買的（可以重複執行）
-- 手抄網（dive_net）🪙800，在商店的「潛水」分頁買，要先有潛水裝備。沒有手抄網不能抓小生物；撿垃圾、撿造景材料不用。
create or replace function public._dive_item(p text, out price integer, out need text) language sql immutable as $$
  select v.price, v.need from (values ('dive_suit',1500,null), ('dive_tank2',1200,'dive_suit'), ('dive_tank3',3000,'dive_tank2'),
    ('dive_tank4',7000,'dive_tank3'), ('dive_fins',900,'dive_suit'), ('dive_light',600,'dive_suit'), ('dive_net',800,'dive_suit')) v(id, price, need) where v.id = p $$;

create or replace function public.dive_pick(p_kind text, p_item text default null) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); today date := (now() at time zone 'Asia/Taipei')::date; k text; have integer;
begin
  if pl.dive_pick_at is not null and now() - pl.dive_pick_at < interval '0.7 seconds' then raise exception '撿太快了'; end if;
  if pl.dive_day is distinct from today then pl.dive_trash := 0; pl.dive_mat := 0; pl.dive_crit := 0; end if;
  if p_kind = 'trash' then
    if pl.dive_trash >= 20 then raise exception '今天撿夠多了，明天再來（一天最多 20 個）'; end if;
    update public.players set love = love + 1, dive_day = today, dive_trash = pl.dive_trash + 1, dive_mat = pl.dive_mat, dive_crit = pl.dive_crit, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  elsif p_kind = 'mat' then
    if p_item is null or p_item not in ('shell', 'starfish', 'rock_s', 'seagrass', 'coral_p', 'coral_o', 'coral_v', 'sponge', 'anemone') then raise exception '這個不能撿'; end if;
    if pl.dive_mat >= 15 then raise exception '今天撿夠多了，明天再來（一天最多 15 個）'; end if;
    k := 'deco_' || p_item; have := coalesce((pl.bait ->> k)::integer, 0);
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(999, have + 1))), dive_day = today, dive_trash = pl.dive_trash, dive_mat = pl.dive_mat + 1, dive_crit = pl.dive_crit, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  elsif p_kind = 'crit' then
    if p_item is null or p_item not in ('c_shrimp', 'c_crab', 'c_slug', 'c_clown', 'c_seahorse', 'c_puffer') then raise exception '這個不能抓'; end if;
    if not ('dive_net' = any(coalesce(pl.dive, '{}'::text[]))) then raise exception '要先買手抄網（商店的「🤿潛水」分頁）'; end if;
    if pl.dive_crit >= 10 then raise exception '今天抓夠多了，明天再來（一天最多 10 隻）'; end if;
    k := 'deco_' || p_item; have := coalesce((pl.bait ->> k)::integer, 0);
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(999, have + 1))), dive_day = today, dive_trash = pl.dive_trash, dive_mat = pl.dive_mat, dive_crit = pl.dive_crit + 1, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  else raise exception '這個不能撿';
  end if;
  return pl;
end $$;
