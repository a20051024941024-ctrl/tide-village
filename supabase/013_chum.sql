-- 潮汐釣魚村：打窩（窩料；可以重複執行）
-- 窩料跟魚餌放在同一個 bait 欄位（id 用 chum_ 開頭），但不會被設成掛在鉤子上的魚餌
create or replace function public._bait_info(p text, out price integer, out pack integer) language sql immutable as $$
  select case p when 'worm' then 20 when 'glow' then 60 when 'squidbait' then 150 when 'gold' then 300 when 'rainbow' then 900
                when 'chum_rice' then 40 when 'chum_krill' then 120 when 'chum_gold' then 500 end,
         case p when 'worm' then 10 when 'glow' then 5 when 'squidbait' then 5 when 'gold' then 3 when 'rainbow' then 2
                when 'chum_rice' then 3 when 'chum_krill' then 3 when 'chum_gold' then 2 end $$;

create or replace function public.buy_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); info record;
begin
  select * into info from public._bait_info(p_bait);
  if info.price is null then raise exception '沒有這種魚餌'; end if;
  if pl.coins < info.price then raise exception '金幣不夠'; end if;
  update public.players set
    coins = coins - info.price,
    bait = jsonb_set(bait, array[p_bait], to_jsonb(least(999, coalesce((bait ->> p_bait)::int, 0) + info.pack))),
    bait_on = case when p_bait like 'chum\_%' then bait_on else coalesce(bait_on, p_bait) end, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.set_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_bait like 'chum\_%' then raise exception '窩料不能掛在鉤子上'; end if;
  if p_bait is not null and coalesce((pl.bait ->> p_bait)::int, 0) <= 0 then raise exception '沒有這種魚餌'; end if;
  update public.players set bait_on = p_bait, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

select '打窩設定完成 🍚' as result;
