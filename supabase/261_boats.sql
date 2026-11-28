-- 261 潮汐船行：玩家自己買船（單人獨木舟、雙人划艇、四人釣魚小艇）。可以重複執行。
alter table public.players add column if not exists boats text[] not null default '{}';

create or replace function public.buy_boat(p_kind text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price int;
begin
  price := case p_kind when 'solo' then 800 when 'duo' then 2500 when 'quad' then 8000 else null end;
  if price is null then raise exception '沒有這種船'; end if;
  if p_kind = any(pl.boats) then return pl; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, boats = array_append(boats, p_kind), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.buy_boat(text) from public, anon;
grant execute on function public.buy_boat(text) to authenticated;

select '船行設定完成 ⛵' as result;
