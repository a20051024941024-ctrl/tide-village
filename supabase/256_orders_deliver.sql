-- 256 潮汐釣魚村 v917：訂單板第 2 段：交貨、菜籃。可以重複執行。要先貼 255。
-- ・交貨由伺服器檢查、收走東西、發金幣、經驗和「村子貢獻」。
-- ・菜籃：收成的金幣照舊，另外留一顆在背包（crop_作物，最多 99 顆），用來交訂單。

/* 交貨。p_fish、p_dish：要交出去的魚（魚缸的 t）和料理（料理的 t），照訂單上的順序排好 */
create or replace function public.order_deliver(p_slot bigint, p_idx integer, p_fish bigint[], p_dish bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); s bigint := public._ord_slot(); o record; it jsonb; n integer; ok integer; have integer; k text;
  fp integer := 0; dp integer := 0; seg bigint[]; bag jsonb;
begin
  if p_slot is distinct from s then raise exception '訂單已經換新的一批了'; end if;
  select * into o from public._orders(s) x where x.i = p_idx;
  if not found then raise exception '沒有這張訂單'; end if;
  if pl.order_slot = s and p_idx = any(pl.order_done) then raise exception '這張訂單已經交過了'; end if;
  p_fish := coalesce(p_fish, '{}'); p_dish := coalesce(p_dish, '{}'); bag := coalesce(pl.bait, '{}'::jsonb);
  if (select count(distinct x) from unnest(p_fish) x) <> cardinality(p_fish) or (select count(distinct x) from unnest(p_dish) x) <> cardinality(p_dish) then raise exception '交的東西不對'; end if;
  for it in select e from jsonb_array_elements(o.items) e loop
    n := (it->>'n')::integer;
    if it->>'k' in ('fish', 'small') then
      seg := p_fish[fp + 1 : fp + n]; fp := fp + n;
      select count(*) into ok from jsonb_array_elements(pl.tank) e
        where (e->>'t')::bigint = any(seg) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k') and not (e ? 'y')
          and case when it->>'k' = 'fish' then e->>'f' = it->>'f' and (e->>'w')::numeric >= (it->>'minw')::numeric else (e->>'w')::numeric <= (it->>'maxw')::numeric end;
      if coalesce(cardinality(seg), 0) <> n or ok <> n then raise exception '交的魚不對（收藏、展示中的魚不能交）'; end if;
    elsif it->>'k' = 'dish' then
      seg := p_dish[dp + 1 : dp + n]; dp := dp + n;
      select count(*) into ok from jsonb_array_elements(pl.dishes) e where (e->>'t')::bigint = any(seg) and e->>'r' = it->>'r';
      if coalesce(cardinality(seg), 0) <> n or ok <> n then raise exception '交的料理不對'; end if;
    else
      k := case when it->>'k' = 'mat' then it->>'m' else 'crop_' || (it->>'c') end; have := coalesce((bag->>k)::integer, 0);
      if have < n then raise exception '%', case when it->>'k' = 'mat' then '材料不夠' else '菜籃裡的菜不夠' end; end if;
      bag := case when have = n then bag - k else jsonb_set(bag, array[k], to_jsonb(have - n)) end;
    end if;
  end loop;
  if fp <> cardinality(p_fish) or dp <> cardinality(p_dish) then raise exception '交的東西不對'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by j), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, j) where not ((e->>'t')::bigint = any(p_fish))),
    dishes = (select coalesce(jsonb_agg(e order by j), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, j) where not ((e->>'t')::bigint = any(p_dish))),
    bait = bag, coins = coins + o.reward, earned = earned + o.reward, xp_bonus = xp_bonus + o.xp, order_pts = order_pts + o.pts, order_n = order_n + 1,
    order_done = case when order_slot = s then array_append(order_done, p_idx) else array[p_idx] end, order_slot = s, updated_at = now()
  where id = pl.id returning * into pl;
  update public.village set pts = pts + o.pts, orders = orders + 1, updated_at = now() where id = 1;
  return pl;
end $$;

/* 菜籃：收成的金幣照舊，另外留一顆在背包（最多 99 顆） */
create or replace function public.farm_harvest(p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f public.farm_plots; c record; pay integer; b jsonb; k text;
begin
  select * into f from public.farm_plots where owner = pl.id and slot = p_slot for update;
  if not found then raise exception '這一格沒有種東西'; end if;
  if now() < public._farm_ripe_at(f.crop, f.planted_at, f.waters) then raise exception '還沒成熟'; end if;
  select * into c from public._farm_crop(f.crop);
  pay := round(c.sell * (case when f.waters >= 2 then 1.5 else 1 end));   -- 澆過兩次水以上：豐收，多五成
  delete from public.farm_plots where owner = pl.id and slot = p_slot;
  b := coalesce(pl.bait, '{}'::jsonb); k := 'crop_' || f.crop;
  b := jsonb_set(b, array[k], to_jsonb(least(99, coalesce((b->>k)::integer, 0) + 1)));
  if f.crop = 'corn' then b := jsonb_set(b, array['corn'], to_jsonb(least(999, coalesce((b->>'corn')::integer, 0) + 5))); end if;   -- 玉米另外送 5 份玉米粒魚餌
  update public.players set coins = coins + pay, earned = earned + pay, bait = b, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.order_deliver(bigint, integer, bigint[], bigint[]) from public, anon;
grant execute on function public.order_deliver(bigint, integer, bigint[], bigint[]) to authenticated;
notify pgrst, 'reload schema';

select '訂單板 2/2 好了 📋 可以交貨了' as result;
