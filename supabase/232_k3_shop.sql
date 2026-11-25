-- 232 👕 造型要用金幣買（v860，作者 11/26：「造型的衣服頭髮顏色那些全部都要用錢買，不要現在什麼都免費」）。可以重複執行。
-- 作者選的：
--   ・臉（眼睛、眉毛、嘴巴、腮紅、眼睛顏色）免費；再送一套基本款：白T、短褲、長褲、運動鞋、長捲髮、刺刺短髮、原色、不戴帽子／口罩／耳環。
--   ・其他用金幣買：髮型 600、上衣 800、褲子 500、鞋子 400、帽子／口罩／耳環 500、每一種顏色 150。買了就是你的（記在 players.owned）。
--   ・已經在玩的人：身上現在那一套直接送（k3_grant，只能領一次，只給這個版本上線前就有的帳號）。
-- 東西的 id：k3_<部位>_<款式>（例 k3_top_wave）、顏色 k3c_<部位>_<六碼色號小寫>（例 k3c_hair_f2a7c0）。用戶端 K3.PRICE、K3.FREE 要一樣。

create or replace function public._k3_price(p_id text) returns integer language plpgsql immutable as $$
declare k text; v text;
begin
  if p_id is null or length(p_id) > 40 then return null; end if;
  if p_id ~ '^k3c_(hair|top|bot|shoes|hat|mask|ear)_[0-9a-f]{6}$' then return 150; end if;
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

create or replace function public.k3_buy(p_id text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pr integer := public._k3_price(p_id);
begin
  if pr is null then raise exception '沒有這個東西'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pr = 0 or p_id = any(coalesce(pl.owned, '{}')) then return pl; end if;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - pr, owned = array_append(coalesce(owned, '{}'), p_id), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 已經在玩的人：身上那一套送他（只能領一次；這個版本上線之後才建的帳號只會記一下領過，什麼都不送）
create or replace function public.k3_grant(p_ids text[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); add text[];
begin
  select * into pl from public.players where id = pl.id for update;
  if 'k3_grand' = any(coalesce(pl.owned, '{}')) then return pl; end if;
  if pl.created_at < timestamptz '2026-11-25 18:30+00' then
    add := array(select distinct x from unnest(coalesce(p_ids, '{}')) x where public._k3_price(x) > 0 limit 20);
  else add := '{}'; end if;
  update public.players set owned = array(select distinct y from unnest(coalesce(owned, '{}') || add || array['k3_grand']) y), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

grant execute on function public.k3_buy(text) to authenticated;
grant execute on function public.k3_grant(text[]) to authenticated;
revoke all on function public._k3_price(text) from public, anon;
grant execute on function public._k3_price(text) to authenticated;

do $$ begin raise notice '232 造型商店：已領身上那套的人 %', (select count(*) from public.players where 'k3_grand' = any(owned)); end $$;
