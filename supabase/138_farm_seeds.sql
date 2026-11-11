-- 潮汐釣魚村 v371：菜園的種子放進背包（可以重複執行）
-- 玩家建議：先買種子放背包，再從背包拿出來一顆一顆種。種子跟魚餌放在同一個欄位（bait），名字是 seed_作物。
-- farm_buy_seed：買種子（一次 1～99 顆）。farm_plant：背包有種子就用掉一顆；沒有的話照舊直接扣金幣（舊版遊戲還沒更新的人不會壞掉）。
create or replace function public.farm_buy_seed(p_crop text, p_n integer default 1) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; n integer := coalesce(p_n, 1); k text := 'seed_' || p_crop; have integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if n < 1 or n > 99 then raise exception '一次可以買 1 到 99 顆'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have + n > 999 then raise exception '種子帶太多了'; end if;
  if pl.coins < c.seed * n then raise exception '金幣不夠買種子'; end if;
  update public.players set coins = coins - c.seed * n, bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(have + n)), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 or p_slot >= pl.farm_n then raise exception '這一格還沒開墾'; end if;
  if exists (select 1 from public.farm_plots where owner = pl.id and slot = p_slot) then raise exception '這一格已經種東西了'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 and pl.coins < c.seed then raise exception '金幣不夠買種子'; end if;
  insert into public.farm_plots (owner, slot, crop) values (pl.id, p_slot, p_crop);
  if have >= 1 then
    update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - c.seed, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

revoke all on function public.farm_buy_seed(text, integer) from public, anon;
grant execute on function public.farm_buy_seed(text, integer) to authenticated;
