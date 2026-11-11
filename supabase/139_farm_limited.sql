-- 潮汐釣魚村 v372：種子攤的「本週限定」作物（可以重複執行）
-- 平常的 6 種隨時買得到；另外 4 種限定作物一週輪一種（台灣時間每週一換）：西瓜 → 胡蘿蔔 → 葡萄 → 向日葵。
-- 限定種子只有當週買得到，但買起來放背包的，之後哪一週都可以種、可以收。
create or replace function public._farm_crop(p text, out seed integer, out sell integer, out secs integer) language sql immutable as $$
  select c.seed, c.sell, c.secs from (values
    ('tomato', 15, 45, 7200), ('cabbage', 25, 80, 14400), ('corn', 35, 100, 21600),
    ('sweetpotato', 45, 150, 28800), ('strawberry', 70, 220, 43200), ('pumpkin', 120, 420, 86400),
    ('watermelon', 90, 330, 57600), ('carrot', 30, 105, 18000), ('grape', 100, 380, 64800), ('sunflower', 60, 215, 36000)
  ) as c(id, seed, sell, secs) where c.id = p
$$;
-- 這種種子現在買得到嗎（限定的要看是第幾週）
create or replace function public._farm_on_sale(p text) returns boolean language sql stable as $$
  select case p when 'watermelon' then w = 0 when 'carrot' then w = 1 when 'grape' then w = 2 when 'sunflower' then w = 3 else true end
  from (select (floor((floor(extract(epoch from now()) / 86400 + 8.0 / 24) + 3) / 7))::bigint % 4 as w) q
$$;

create or replace function public.farm_buy_seed(p_crop text, p_n integer default 1) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; n integer := coalesce(p_n, 1); k text := 'seed_' || p_crop; have integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if not public._farm_on_sale(p_crop) then raise exception '這種種子這週沒有賣'; end if;
  if n < 1 or n > 99 then raise exception '一次可以買 1 到 99 顆'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have + n > 999 then raise exception '種子帶太多了'; end if;
  if pl.coins < c.seed * n then raise exception '金幣不夠買種子'; end if;
  update public.players set coins = coins - c.seed * n, bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(have + n)), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 or p_slot >= pl.farm_n then raise exception '這一格還沒開墾'; end if;
  if exists (select 1 from public.farm_plots where owner = pl.id and slot = p_slot) then raise exception '這一格已經種東西了'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 and not public._farm_on_sale(p_crop) then raise exception '背包裡沒有這種種子'; end if;
  if have < 1 and pl.coins < c.seed then raise exception '金幣不夠買種子'; end if;
  insert into public.farm_plots (owner, slot, crop) values (pl.id, p_slot, p_crop);
  if have >= 1 then
    update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - c.seed, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;
revoke all on function public._farm_on_sale(text) from public, anon, authenticated;
