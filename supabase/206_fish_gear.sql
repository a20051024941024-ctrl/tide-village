-- 潮汐釣魚村 v618：釣魚裝備（可以重複執行）
-- 作者：「這個是我想要的，可以坐著可以用自己的裝備」→ 釣具店「🧰工具」多四樣，買一次就一直有（放在 owned）。
-- 摺疊椅 600、小釣台 1500、竿架＋魚護 900、遮陽傘＋釣箱 800；後三樣要先有摺疊椅。撈網照舊 800。
-- 裝備只改「怎麼釣」（坐著、多拋 3 公尺、竿子插著走開、現場買餌），不改抽魚的機率，所以 roll_fish 不用動。
create or replace function public.buy_tool(p_tool text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
  price integer := case p_tool when 'tool_net' then 800 when 'tool_chair' then 600 when 'tool_stand' then 1500 when 'tool_holder' then 900 when 'tool_shade' then 800 end;
begin
  if price is null then raise exception '沒有這個商品'; end if;
  if p_tool = any(pl.owned) then return pl; end if;
  if p_tool in ('tool_stand', 'tool_holder', 'tool_shade') and not ('tool_chair' = any(pl.owned)) then raise exception '要先有摺疊椅'; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, owned = array_append(owned, p_tool), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.buy_tool(text) from public, anon;
grant execute on function public.buy_tool(text) to authenticated;
