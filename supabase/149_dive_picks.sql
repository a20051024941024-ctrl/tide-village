-- 潮汐釣魚村 v387：潛水的新玩法（可以重複執行）
--   · 海底清潔：公共潛水點漂著垃圾，撿起來 💙 愛海點數 +1（一天最多 20 個）。
--   · 採集造景：海底撿得到貝殼、海星、小石頭、海草、珊瑚、海綿、海葵，放進背包，可以拿回自己的海底擺（一天最多 15 個）。
--   · 手抄網：抓小生物（小蝦、小螃蟹、海蛞蝓、小丑魚寶寶、海馬寶寶、小河豚），放進背包，可以放進自己的海底當會動的住戶（一天最多 10 隻）。
--   · 每日潛水委託：每天輪一種（撿垃圾 5 個／撿造景 4 個／抓小生物 2 隻），完成拿 🪙300、💙 2。
-- 小生物跟造景放在同一張表（sea_decor，種類是 c_ 開頭），不能用金幣買。
alter table public.players add column if not exists dive_day date;
alter table public.players add column if not exists dive_trash integer not null default 0;
alter table public.players add column if not exists dive_mat integer not null default 0;
alter table public.players add column if not exists dive_crit integer not null default 0;
alter table public.players add column if not exists dive_q_done date;
alter table public.players add column if not exists dive_pick_at timestamptz;

create or replace function public._sea_deco_price(p text) returns integer language sql immutable as $$
  select v.c from (values ('amphora', 300), ('bubble', 400), ('clam', 500), ('anchor', 600), ('lantern', 700), ('chest', 800), ('statue', 1200), ('arch', 1500),
    ('coral_p', 80), ('coral_o', 80), ('coral_v', 80), ('braincoral', 100), ('seagrass', 30), ('kelpdeco', 40), ('anemone', 60), ('sponge', 50),
    ('starfish', 30), ('shell', 20), ('rock_s', 20), ('rock_l', 50), ('sandtile', 15),
    ('c_shrimp', 0), ('c_crab', 0), ('c_slug', 0), ('c_clown', 0), ('c_seahorse', 0), ('c_puffer', 0)) v(k, c) where v.k = p
$$;
create or replace function public.sea_deco_buy(p_kind text, p_n integer default 1) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := public._sea_deco_price(p_kind); n integer := coalesce(p_n, 1); k text := 'deco_' || p_kind; have integer;
begin
  if price is null or price <= 0 then raise exception '這個不能用買的'; end if;
  if n < 1 or n > 50 then raise exception '一次可以買 1 到 50 個'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have + n > 999 then raise exception '帶太多了'; end if;
  if pl.coins < price * n then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price * n, bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(have + n)), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 今天的委託是哪一種、要幾個
create or replace function public._dive_quest(out kind text, out need integer) language sql stable as $$
  select (array['trash', 'mat', 'crit'])[1 + d % 3], (array[5, 4, 2])[1 + d % 3] from (select ((now() at time zone 'Asia/Taipei')::date - date '2026-01-01') as d) q
$$;

create or replace function public.dive_pick(p_kind text, p_item text default null) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); today date := (now() at time zone 'Asia/Taipei')::date; k text; have integer;
begin
  if pl.dive_pick_at is not null and now() - pl.dive_pick_at < interval '0.7 seconds' then raise exception '撿太快了'; end if;
  if pl.dive_day is distinct from today then pl.dive_trash := 0; pl.dive_mat := 0; pl.dive_crit := 0; end if;
  if p_kind = 'trash' then
    if pl.dive_trash >= 20 then raise exception '今天撿夠多了，明天再來（一天最多 20 個）'; end if;
    update public.players set love = love + 1, dive_day = today, dive_trash = pl.dive_trash + 1, dive_mat = pl.dive_mat, dive_crit = pl.dive_crit, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  elsif p_kind = 'mat' then
    if p_item is null or p_item not in ('shell', 'starfish', 'rock_s', 'seagrass', 'coral_p', 'coral_o', 'coral_v', 'sponge', 'anemone') then raise exception '這個不能撿'; end if;
    if pl.dive_mat >= 15 then raise exception '今天撿夠多了，明天再來（一天最多 15 個）'; end if;
    k := 'deco_' || p_item; have := coalesce((pl.bait ->> k)::integer, 0);
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(999, have + 1))), dive_day = today, dive_trash = pl.dive_trash, dive_mat = pl.dive_mat + 1, dive_crit = pl.dive_crit, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  elsif p_kind = 'crit' then
    if p_item is null or p_item not in ('c_shrimp', 'c_crab', 'c_slug', 'c_clown', 'c_seahorse', 'c_puffer') then raise exception '這個不能抓'; end if;
    if pl.dive_crit >= 10 then raise exception '今天抓夠多了，明天再來（一天最多 10 隻）'; end if;
    k := 'deco_' || p_item; have := coalesce((pl.bait ->> k)::integer, 0);
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[k], to_jsonb(least(999, have + 1))), dive_day = today, dive_trash = pl.dive_trash, dive_mat = pl.dive_mat, dive_crit = pl.dive_crit + 1, dive_pick_at = now(), updated_at = now() where id = pl.id returning * into pl;
  else raise exception '這個不能撿';
  end if;
  return pl;
end $$;

create or replace function public.dive_quest_claim() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); today date := (now() at time zone 'Asia/Taipei')::date; q record; have integer;
begin
  select * into q from public._dive_quest();
  if pl.dive_q_done = today then raise exception '今天的委託已經領過了'; end if;
  have := case when pl.dive_day is distinct from today then 0 when q.kind = 'trash' then pl.dive_trash when q.kind = 'mat' then pl.dive_mat else pl.dive_crit end;
  if have < q.need then raise exception '委託還沒完成'; end if;
  update public.players set coins = coins + 300, earned = earned + 300, love = love + 2, dive_q_done = today, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public._dive_quest() from public, anon, authenticated;
revoke all on function public.dive_pick(text, text), public.dive_quest_claim() from public, anon;
grant execute on function public.dive_pick(text, text), public.dive_quest_claim() to authenticated;
