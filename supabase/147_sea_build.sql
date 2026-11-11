-- 潮汐釣魚村 v383：自由打造海底世界（可以重複執行）
-- 玩家建議：海底要可以緊貼著放成一片、不要有數量上限。
--   · 海底的裝飾、造景（珊瑚、海草、海葵、石頭、白沙…）可以緊貼著放，上限從 12 個提高到 300 個（手機和伺服器撐得住的量）。
--   · 新增 13 種便宜的造景，一次可以買 1～50 個。
--   · 會收成賺金幣的海底作物還是有數量上限（sea_n），不然金幣會多到沒有意義；但兩株之間只要隔 0.6 公尺。
create or replace function public._sea_deco_price(p text) returns integer language sql immutable as $$
  select v.c from (values ('amphora', 300), ('bubble', 400), ('clam', 500), ('anchor', 600), ('lantern', 700), ('chest', 800), ('statue', 1200), ('arch', 1500),
    ('coral_p', 80), ('coral_o', 80), ('coral_v', 80), ('braincoral', 100), ('seagrass', 30), ('kelpdeco', 40), ('anemone', 60), ('sponge', 50),
    ('starfish', 30), ('shell', 20), ('rock_s', 20), ('rock_l', 50), ('sandtile', 15)) v(k, c) where v.k = p
$$;
create or replace function public.sea_deco_buy(p_kind text, p_n integer default 1) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._sea_deco_price(p_kind); n integer := coalesce(p_n, 1); k text := 'deco_' || p_kind; have integer;
begin
  if price is null then raise exception '沒有這種裝飾'; end if;
  if n < 1 or n > 50 then raise exception '一次可以買 1 到 50 個'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have + n > 999 then raise exception '帶太多了'; end if;
  if pl.coins < price * n then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price * n, bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(have + n)), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
-- 住在一起的人（室友、家人）也可以一起佈置島主的海底：放的是自己背包裡的，收起來的回到收的人的背包（跟一起蓋島一樣）。
drop function if exists public.sea_deco_put(text, real, real, real);
create or replace function public.sea_deco_put(p_kind text, p_x real, p_z real, p_rot real default 0, p_owner uuid default null) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text := 'deco_' || p_kind; have integer; own uuid := coalesce(p_owner, pl.id);
begin
  if public._sea_deco_price(p_kind) is null then raise exception '沒有這種裝飾'; end if;
  if own <> pl.id and not public._home_can(own, pl.id) then raise exception '只有島主和住在一起的人可以佈置這裡'; end if;
  if p_x is null or p_z is null or p_x <> p_x or p_z <> p_z or sqrt(p_x * p_x + p_z * p_z) > 30 then raise exception '這裡太遠了，放近一點'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 then raise exception '背包裡沒有這個裝飾'; end if;
  if (select count(*) from public.sea_decor where owner = own) >= 300 then raise exception '海底放滿了（最多 300 個）'; end if;
  insert into public.sea_decor (owner, kind, px, pz, rot) values (own, p_kind, p_x, p_z, coalesce(nullif(p_rot, 'NaN'::real), 0));
  update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
create or replace function public.sea_deco_take(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sea_decor; k text;
begin
  select * into d from public.sea_decor where id = p_id for update;
  if not found or (d.owner <> pl.id and not public._home_can(d.owner, pl.id)) then raise exception '找不到這個裝飾'; end if;
  delete from public.sea_decor where id = p_id;
  k := 'deco_' || d.kind;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(999, coalesce((bait ->> k)::integer, 0) + 1))), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.sea_deco_put(text, real, real, real, uuid) from public, anon;
grant execute on function public.sea_deco_put(text, real, real, real, uuid) to authenticated;
-- 海底作物：兩株之間只要隔 0.6 公尺（可以種成一片）
create or replace function public.sea_plant(p_crop text, p_x real, p_z real) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer; cnt integer; sl integer;
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null or not public._farm_is_sea(p_crop) then raise exception '這種種子不能種在海底'; end if;
  if p_x is null or p_z is null or p_x <> p_x or p_z <> p_z or sqrt(p_x * p_x + p_z * p_z) > 30 then raise exception '這裡太遠了，種近一點'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 then raise exception '背包裡沒有這種種子'; end if;
  select count(*) into cnt from public.farm_plots where owner = pl.id and slot >= 100;
  if cnt >= pl.sea_n then raise exception '會收成的海底作物種滿了'; end if;
  if exists (select 1 from public.farm_plots f where f.owner = pl.id and f.slot >= 100 and f.px is not null and sqrt((f.px - p_x) * (f.px - p_x) + (f.pz - p_z) * (f.pz - p_z)) < 0.6) then raise exception '離旁邊那一株太近了'; end if;
  select min(g) into sl from generate_series(100, 199) g where not exists (select 1 from public.farm_plots f where f.owner = pl.id and f.slot = g);
  insert into public.farm_plots (owner, slot, crop, px, pz) values (pl.id, sl, p_crop, p_x, p_z);
  update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
