-- 潮汐釣魚村：釣蝦場的蝦竿（可以重複執行）
-- 價格要跟 js/game.js 的 SHRIMP_RODS 一樣。蝦竿只影響手感（反應時間、鬆鉗），不影響釣到哪一種蝦。
alter table public.players add column if not exists srods text[] not null default '{}';
alter table public.players add column if not exists srod  text   not null default 'srod_basic';

create or replace function public._srod_price(p text) returns integer language sql immutable as $$
  select v.price from (values ('srod_basic', 0), ('srod_carbon', 1200), ('srod_master', 4000)) v(id, price) where v.id = p $$;

create or replace function public.buy_shrimp_rod(p_id text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._srod_price(p_id);
begin
  if price is null then raise exception '沒有這支蝦竿'; end if;
  if price = 0 or p_id = any(pl.srods) then
    update public.players set srod = p_id, updated_at = now() where id = pl.id returning * into pl; return pl; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, srods = array_append(srods, p_id), srod = p_id, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.set_shrimp_rod(p_id text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._srod_price(p_id);
begin
  if price is null then raise exception '沒有這支蝦竿'; end if;
  if price > 0 and not (p_id = any(pl.srods)) then raise exception '還沒有買這支蝦竿'; end if;
  update public.players set srod = p_id, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['buy_shrimp_rod(text)', 'set_shrimp_rod(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '蝦竿設定完成 🎣' as result;
