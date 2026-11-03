-- 潮汐釣魚村：潛水（進階玩法）— 潛水用品、水下圖鑑、貝殼和寶箱（可以重複執行）
-- 價格要跟 js/game.js 的 DIVE_GEAR 一樣
alter table public.players add column if not exists dive        text[]  not null default '{}';   -- 買了的潛水用品
alter table public.players add column if not exists photos      text[]  not null default '{}';   -- 水下圖鑑（拍到的魚）
alter table public.players add column if not exists dive_day    date;
alter table public.players add column if not exists dive_shells integer not null default 0;
alter table public.players add column if not exists dive_chests integer not null default 0;
alter table public.players add column if not exists dive_at     timestamptz;

create or replace function public._dive_item(p text, out price integer, out need text) language sql immutable as $$
  select v.price, v.need from (values ('dive_suit',1500,null), ('dive_tank2',1200,'dive_suit'), ('dive_tank3',3000,'dive_tank2'),
    ('dive_tank4',7000,'dive_tank3'), ('dive_fins',900,'dive_suit'), ('dive_light',600,'dive_suit')) v(id, price, need) where v.id = p $$;

create or replace function public.buy_dive(p_item text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); it record;
begin
  select * into it from public._dive_item(p_item);
  if it.price is null then raise exception '沒有這個商品'; end if;
  if p_item = any(pl.dive) then return pl; end if;
  if it.need is not null and not (it.need = any(pl.dive)) then raise exception '要先買前一級的潛水用品'; end if;
  if pl.coins < it.price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - it.price, dive = array_append(dive, p_item), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 水下拍照：只能拍海裡的魚，要有潛水裝備
create or replace function public.add_photo(p_fish text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if not ('dive_suit' = any(pl.dive)) then raise exception '要先買潛水裝備'; end if;
  if not exists (select 1 from public.fish_species where id = p_fish) then raise exception '沒有這種魚'; end if;
  if p_fish = any(pl.photos) or cardinality(pl.photos) >= 200 then return pl; end if;
  update public.players set photos = array_append(photos, p_fish), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 撿貝殼／開寶箱：金幣由伺服器決定，每天有上限（台灣時間換日）
create or replace function public.dive_loot(p_kind text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; sh integer; ch integer; got integer := 0;
begin
  if not ('dive_suit' = any(pl.dive)) then raise exception '要先買潛水裝備'; end if;
  if p_kind not in ('shell', 'chest') then raise exception '沒有這種東西'; end if;
  if pl.dive_at is not null and now() - pl.dive_at < interval '1 second' then raise exception '撿太快了'; end if;
  sh := case when pl.dive_day = d then pl.dive_shells else 0 end;
  ch := case when pl.dive_day = d then pl.dive_chests else 0 end;
  if p_kind = 'shell' and sh < 40 then got := 5 + floor(random() * 16)::integer; sh := sh + 1; end if;
  if p_kind = 'chest' and ch < 3 then got := 150 + floor(random() * 201)::integer; ch := ch + 1; end if;
  update public.players set coins = coins + got, earned = earned + got, dive_day = d, dive_shells = sh, dive_chests = ch, dive_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['buy_dive(text)', 'add_photo(text)', 'dive_loot(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '潛水設定完成 🤿' as result;
