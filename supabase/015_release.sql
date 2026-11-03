-- 潮汐釣魚村：尺寸限制、放流、愛海點數（可以重複執行）
-- 規則要跟 js/game.js 的 sizeMin / lovePts / fishPrice / LOVE 商品一樣
alter table public.players add column if not exists love     integer not null default 0;   -- 愛海點數（可以花掉）
alter table public.players add column if not exists released integer not null default 0;   -- 總共放流幾條（成就用）

-- 未達尺寸：比「最輕 + 四分之一的範圍」還輕
create or replace function public._undersized(sp public.fish_species, w numeric) returns boolean language sql immutable as $$
  select w < sp.min_w + 0.25 * (sp.max_w - sp.min_w) $$;

-- 賣價：未達尺寸只能賣一半
create or replace function public._fish_price(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select round((case sp.rarity when '常見' then 10 when '稀有' then 60 else 400 end)
    * (1 + 1.5 * least(1, greatest(0, (w - sp.min_w) / greatest(0.01, sp.max_w - sp.min_w))))
    * (case when public._undersized(sp, w) then 0.5 else 1 end))::integer $$;

-- 放流得到的愛海點數：常見 1、稀有 3、傳說 10；未達尺寸至少 3
create or replace function public._love_pts(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select greatest(case when public._undersized(sp, w) then 3 else 0 end,
                  case sp.rarity when '常見' then 1 when '稀有' then 3 else 10 end) $$;

-- 放流魚缸裡的一條魚（展示中的也可以），會得到愛海點數
create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer;
begin
  select public._love_pts(sp, (e->>'w')::numeric) into pts
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = p_ts limit 1;
  if pts is null then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    love = love + pts, released = released + 1, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 剛釣到就放流：找最近 5 分鐘內釣到的那種魚（最新的一條）
create or replace function public.release_catch(p_fish text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t bigint;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select max((e->>'t')::bigint) into t from jsonb_array_elements(pl.tank) e
  where e->>'f' = p_fish and (e->>'t')::bigint > now_ms - 300000;
  if t is null then return pl; end if;
  return public.release_fish(t);
end $$;

-- 愛海商店（用愛海點數換，不能用金幣買）
create or replace function public._love_price(p text) returns integer language sql immutable as $$
  select v.price from (values ('acc_coral',20),('hat_turtle',30),('top_ocean',40),('back_fin',60)) v(id, price) where v.id = p $$;

create or replace function public.redeem_love(p_item text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._love_price(p_item); slot text := split_part(p_item, '_', 1);
begin
  if price is null then raise exception '沒有這個商品'; end if;
  if p_item = any(pl.owned) then return pl; end if;
  if pl.love < price then raise exception '愛海點數不夠'; end if;
  update public.players set love = love - price, owned = array_append(owned, p_item),
    gear = jsonb_set(coalesce(gear, '{}'::jsonb), array[slot], to_jsonb(p_item)), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 換穿：愛海商品也要換到才能穿
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer;
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k not in ('hat','top','pants','shoes','socks','acc','back','face') then continue; end if;
    pr := coalesce(public._item_price(v), case when public._love_price(v) is not null then -1 end);
    if pr is null or split_part(v, '_', 1) <> k then raise exception '沒有這個商品'; end if;
    if pr <> 0 and not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
    g := g || jsonb_build_object(k, v);
  end loop;
  update public.players set gear = g, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['release_fish(bigint)', 'release_catch(text)', 'redeem_love(text)', 'set_gear(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '放流和愛海點數設定完成 💙' as result;
