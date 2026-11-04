-- 潮汐釣魚村：室內釣蝦場的時段（可以重複執行）
-- 價格要跟 js/game.js 的 SHRIMP_PRICE 一樣：30 分鐘 200 金幣、60 分鐘 350 金幣
alter table public.players add column if not exists shrimp_until timestamptz;

create or replace function public.buy_shrimp_time(p_min integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer;
begin
  price := case p_min when 30 then 200 when 60 then 350 end;
  if price is null then raise exception '一次可以買 30 或 60 分鐘'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price,
    shrimp_until = greatest(now(), coalesce(shrimp_until, now())) + make_interval(mins => p_min), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.buy_shrimp_time(integer) from public, anon;
grant execute on function public.buy_shrimp_time(integer) to authenticated;

select '釣蝦場時段設定完成 🦐' as result;
