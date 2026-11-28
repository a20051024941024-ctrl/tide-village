-- 潮汐釣魚村 v995：聯名套裝（可以重複執行）
-- 阿萬、阿默、阿穎三套炫炮的整套衣服，只能整套買（🪙2,500），買了衣服每一件都是你的，穿整套身上會有光。
-- 單件的聯名設計款（k3v_..._c...）不能單買。_k3_price 其他照 257。

create or replace function public._k3_price(p_id text) returns integer language plpgsql immutable as $$
declare k text; v text; d text;
begin
  if p_id is null or length(p_id) > 40 then return null; end if;
  if p_id ~ '^k3c_' then return null; end if;   -- 不賣顏色了
  if p_id ~ '^k3v_(top|bot|shoes|hat|mask|ear)_[a-z0-9]+_[a-z][a-z0-9]{0,9}$' then
    k := split_part(p_id, '_', 2); d := split_part(p_id, '_', 4);
    if d ~ '^g[0-9]+$' then return null; end if;   -- 老港限定
    if d ~ '^e[a-z0-9]*$' then return null; end if;   -- 257 活動限定
    if d ~ '^c[a-z0-9]*$' then return null; end if;   -- 263 聯名套裝：只能整套買
    return case k when 'top' then 800 when 'bot' then 500 when 'shoes' then 400 else 500 end; end if;
  if p_id !~ '^k3_[a-z]+_[a-z0-9]+$' then return null; end if;
  k := split_part(p_id, '_', 2); v := split_part(p_id, '_', 3);
  if p_id = any(array['k3_hair_long', 'k3_hair_short', 'k3_top_tee', 'k3_bot_shorts', 'k3_bot_pants', 'k3_shoes_sneak', 'k3_hat_none', 'k3_mask_none', 'k3_ear_none']) then return 0; end if;
  if k = 'hair' and v = any(array['short2', 'pony', 'twin', 'bob', 'lowpony', 'bun', 'buzz', 'bowl', 'mid', 'curly', 'braid', 'straight']) then return 600; end if;
  if k = 'top' and v = any(array['hoodie', 'maid', 'rain', 'vest', 'wave', 'hoodup']) then return 800; end if;
  if k = 'bot' then return null; end if;
  if k = 'shoes' and v = 'mary' then return 400; end if;
  if k = 'hat' and v = any(array['cap', 'straw']) then return 500; end if;
  if k = 'mask' and v = 'mask' then return 500; end if;
  if k = 'ear' and v = any(array['pearl', 'star', 'hoop', 'drop']) then return 500; end if;
  return null;
end $$;

create or replace function public.k3_set_buy(p_set text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ids text[]; pr integer := 2500; x text;
begin
  ids := case p_set
    when 'wan' then array['k3v_top_tee_cwan', 'k3v_bot_shorts_cwan', 'k3v_shoes_sneak_cwan']
    when 'mo' then array['k3_top_hoodie', 'k3_hat_cap', 'k3_mask_mask', 'k3v_top_hoodie_cmo', 'k3v_bot_pants_cmo', 'k3v_shoes_sneak_cmo', 'k3v_hat_cap_cmo', 'k3v_mask_mask_cmo']
    when 'ying' then array['k3_top_wave', 'k3_hat_straw', 'k3v_top_wave_cying', 'k3v_bot_pants_cying', 'k3v_shoes_sneak_cying', 'k3v_hat_straw_cying']
    else null end;
  if ids is null then raise exception '沒有這一套'; end if;
  select * into pl from public.players where id = pl.id for update;
  if ('k3s_' || p_set) = any(coalesce(pl.owned, '{}')) then return pl; end if;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  ids := array_append(ids, 'k3s_' || p_set);
  update public.players set coins = coins - pr,
    owned = coalesce(owned, '{}') || array(select v from unnest(ids) v where not v = any(coalesce(owned, '{}'))), updated_at = now()
    where id = pl.id returning * into pl;
  return pl;
end $$;
grant execute on function public.k3_set_buy(text) to authenticated;
