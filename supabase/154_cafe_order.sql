-- 潮汐食堂點餐（v397，可以重複執行）
-- 玩家坐在食堂吧台的椅子上，可以花金幣跟美雲姨點一道菜（她用自己的食材做），吃完馬上有那道菜的加成（一顆星的次數）。
-- 自己釣魚來做料理比較便宜、還能做到三顆星；點餐是方便用的。
create or replace function public._cafe_price(p text) returns integer language sql immutable as $$
  select v.price from (values ('ayu', 45), ('tilapia', 45), ('suzuki', 55), ('saba', 60), ('sanbei', 85), ('ikayaki', 90), ('tako', 165), ('unadon', 225)) v(id, price) where v.id = p $$;

create or replace function public.cafe_order(p_r text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c integer := public._cafe_price(p_r); cfg jsonb := public._fishcfg();
begin
  if c is null or not (cfg->'buffs' ? p_r) then raise exception '菜單上沒有這道菜'; end if;
  if pl.coins < c then raise exception '金幣不夠喔'; end if;
  update public.players set coins = coins - c, buff_r = p_r, buff_left = (cfg->'buffs'->p_r->>'casts')::integer, updated_at = now()
    where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl));
end $$;
revoke all on function public.cafe_order(text) from public, anon;
grant execute on function public.cafe_order(text) to authenticated;
