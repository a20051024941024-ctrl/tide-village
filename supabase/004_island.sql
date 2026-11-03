-- 潮汐釣魚村：私人小島（買房子、放裝飾）
-- 可以重複執行。價格和格子數要跟 js/game.js 的 HOUSES / DECOS / HOUSE_SLOTS / DECO_SLOTS 一樣。

alter table public.players add column if not exists island jsonb not null default '{"h":{},"d":{}}'::jsonb;

-- 每一種建築的價格（找不到就回傳 null）
create or replace function public._build_price(p_kind text, p_type text) returns integer language sql immutable as $$
  select case p_kind
    when 'h' then case p_type when 'cabin' then 1500 when 'beach' then 3000 when 'villa' then 8000 end
    when 'd' then case p_type when 'flower' then 200 when 'bench' then 150 when 'lamp' then 250
                               when 'palm' then 400 when 'pond' then 1200 when 'flag' then 300 end
  end $$;

-- 蓋房子／放裝飾：房子 3 塊建地（0-2），裝飾 10 個位置（0-9）
create or replace function public.buy_build(p_kind text, p_slot integer, p_type text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._build_price(p_kind, p_type); isl jsonb;
begin
  if price is null then raise exception '沒有這種建築'; end if;
  if p_slot is null or p_slot < 0 or p_slot >= (case p_kind when 'h' then 3 else 10 end) then raise exception '位置不對'; end if;
  isl := coalesce(pl.island, '{"h":{},"d":{}}'::jsonb);
  if not (isl ? 'h') then isl := isl || '{"h":{}}'; end if;
  if not (isl ? 'd') then isl := isl || '{"d":{}}'; end if;
  if (isl -> p_kind) ? p_slot::text then raise exception '這個位置已經有東西了'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price,
    island = jsonb_set(isl, array[p_kind, p_slot::text], to_jsonb(p_type)), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 拆掉：退回一半金幣
create or replace function public.remove_build(p_kind text, p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text; price integer;
begin
  if p_kind not in ('h', 'd') then raise exception '位置不對'; end if;
  t := pl.island -> p_kind ->> p_slot::text;
  if t is null then raise exception '這裡沒有東西'; end if;
  price := coalesce(public._build_price(p_kind, t), 0);
  update public.players set coins = coins + price / 2,
    island = pl.island #- array[p_kind, p_slot::text], updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['buy_build(text,integer,text)', 'remove_build(text,integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '私人小島設定完成 🏝️' as result;
