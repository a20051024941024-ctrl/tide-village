-- 107 表情動作商店（v264）：新的表情動作要用金幣買，買了放進 owned（'em_' 開頭，跟衣服一樣）。原本的 15 個表情照舊免費。可以重複執行。
-- 價錢由伺服器決定；只是外觀，不影響釣魚。
create or replace function public._emote_price(p text) returns integer language sql immutable as $$
  select case p
    when 'em_thumbs' then 300 when 'em_point' then 300 when 'em_pickup' then 300 when 'em_throw' then 300
    when 'em_shrug' then 500 when 'em_yawn' then 500 when 'em_stretch' then 500
    when 'em_spin' then 800 when 'em_hop' then 800
    else null end $$;

create or replace function public.buy_emote(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c integer := public._emote_price(p_id);
begin
  if c is null then raise exception '沒有這個表情動作'; end if;
  select * into pl from public.players where id = pl.id for update;
  if p_id = any(coalesce(pl.owned, '{}')) then raise exception '你已經學會了'; end if;
  if pl.coins < c then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - c, owned = array_append(coalesce(owned, '{}'), p_id), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl));
end $$;
revoke all on function public.buy_emote(text) from public, anon;
grant execute on function public.buy_emote(text) to authenticated;
