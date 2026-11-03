-- 潮汐釣魚村：服飾（帽子、衣服、褲子、鞋子、襪子、配件、背飾、表情；可以重複執行）
-- 價格要跟 js/game.js 的 GEAR 一樣；價格 0 的是預設，大家都有
alter table public.players add column if not exists gear  jsonb  not null default '{}'::jsonb;
alter table public.players add column if not exists owned text[] not null default '{}';

create or replace function public._item_price(p text) returns integer language sql immutable as $$
  select v.price from (values
    ('hat_sun',0),('hat_none',0),('hat_cap',250),('hat_beanie',300),('hat_bucket',350),('hat_cat',600),('hat_chef',800),('hat_flower',500),('hat_pirate',1500),('hat_crown',5000),
    ('top_tee',0),('top_stripe',300),('top_apron',400),('top_vest',500),('top_hoodie',700),('top_hawaii',800),('top_suit',2500),
    ('pants_jeans',0),('pants_shorts',200),('pants_khaki',250),('pants_skirt',500),('pants_overalls',600),('pants_rainbow',1500),
    ('shoes_boots',0),('shoes_sandals',150),('shoes_sneakers',250),('shoes_rain',350),('shoes_gold',2500),
    ('socks_none',0),('socks_white',80),('socks_stripe',200),('socks_rainbow',500),
    ('acc_none',0),('acc_scarf',300),('acc_bowtie',350),('acc_glasses',450),('acc_shell',600),('acc_lei',700),
    ('back_none',0),('back_bag',400),('back_basket',500),('back_balloon',800),('back_cape',1500),('back_wings',3000),
    ('face_normal',0),('face_happy',200),('face_sleepy',200),('face_wink',300),('face_cool',600),('face_heart',700),('face_star',900)
  ) v(id, price) where v.id = p $$;

-- 買一件（買了自動穿上）
create or replace function public.buy_item(p_item text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._item_price(p_item); slot text := split_part(p_item, '_', 1);
begin
  if price is null then raise exception '沒有這個商品'; end if;
  if price = 0 or p_item = any(pl.owned) then return pl; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, owned = array_append(owned, p_item),
    gear = jsonb_set(coalesce(gear, '{}'::jsonb), array[slot], to_jsonb(p_item)), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 換穿：每一格只能穿那一格的東西，而且要是免費或已經買的
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer;
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k not in ('hat','top','pants','shoes','socks','acc','back','face') then continue; end if;
    pr := public._item_price(v);
    if pr is null or split_part(v, '_', 1) <> k then raise exception '沒有這個商品'; end if;
    if pr > 0 and not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
    g := g || jsonb_build_object(k, v);
  end loop;
  update public.players set gear = g, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['buy_item(text)', 'set_gear(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '服飾設定完成 👗' as result;
