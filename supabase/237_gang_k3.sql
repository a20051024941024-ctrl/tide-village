-- 237 ⚓ 老港的每週限定手作改成新人物（3D）的衣服（作者 11/26：「老港這個應該變成設計目前3D模型衣服了吧」）。可以重複執行。
-- 以前老港做的是舊人物的 16×16 圖案衣服，新人物穿不到。現在改成：每週一早上 9 點，老港用「老港色」（造型頁買不到的限定顏色）
-- 染一件新人物的衣服或帽子，只做 5 件、一人一週一件。買了得到兩樣：那一款（k3_<部位>_<款式>）＋那個限定顏色（k3c_<部位>_<色號>）。
-- 限定顏色在 _k3_price 擋掉，造型頁不能用 150 金幣買到。以前賣出的舊圖案衣服照樣留在買的人身上（不動）。

alter table public.gang_weekly alter column design_id drop not null;
alter table public.gang_weekly add column if not exists k3_part text;
alter table public.gang_weekly add column if not exists k3_style text;
alter table public.gang_weekly add column if not exists k3_col text;
alter table public.gang_weekly add column if not exists name text;

-- 老港色（名字、色號）。手機 js/game.js 的 GANG_COLS 是同一份
create or replace function public._gang_cols() returns jsonb language sql immutable as $$
  select '[["浮球橘","ff8a3d"],["船纜紅","b8372e"],["舊漁網綠","5e7a52"],["老船藍","2c4f73"],["燈塔黃","f3d27a"],["黑潮藍","16324a"],["鹹魚銀","a9b3b8"],["退潮沙","d9c49a"]]'::jsonb $$;

-- 造型價錢：老港色不能在造型頁買（其他跟 232 一樣）
create or replace function public._k3_price(p_id text) returns integer language plpgsql immutable as $$
declare k text; v text;
begin
  if p_id is null or length(p_id) > 40 then return null; end if;
  if p_id ~ '^k3c_(hair|top|bot|shoes|hat|mask|ear)_[0-9a-f]{6}$' then
    if exists (select 1 from jsonb_array_elements(public._gang_cols()) e where e->>1 = right(p_id, 6)) then return null; end if;
    return 150; end if;
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

-- 做這週的：照週數挑一款＋一個老港色
create or replace function public._gang_make(p_week date) returns public.gang_weekly language plpgsql security definer set search_path = public as $$
declare
  w public.gang_weekly;
  pieces jsonb := '[["top","rain","雨衣"],["top","vest","釣魚背心"],["top","wave","海浪外套"],["top","hoodie","連帽衣"],["hat","cap","棒球帽"],["hat","straw","草帽"]]';
  h bigint := abs(hashtext('gang3' || p_week::text)); pc jsonb; cl jsonb; pr int;
begin
  select * into w from public.gang_weekly where week = p_week;
  if w.week is not null and (w.k3_part is not null or w.sold > 0) then return w; end if;
  pc := pieces -> (h % jsonb_array_length(pieces))::int; cl := public._gang_cols() -> ((h / 7) % jsonb_array_length(public._gang_cols()))::int;
  pr := case when pc->>0 = 'top' then 900 else 600 end;
  if w.week is not null then   -- 這週已經做了舊人物的、還沒人買：換成新人物的
    update public.gang_weekly set design_id = null, k3_part = pc->>0, k3_style = pc->>1, k3_col = cl->>1, name = left('老港手作・' || (cl->>0) || (pc->>2), 16), price = pr where week = p_week returning * into w;
    return w; end if;
  insert into public.gang_weekly (week, design_id, price, k3_part, k3_style, k3_col, name)
    values (p_week, null, pr, pc->>0, pc->>1, cl->>1, left('老港手作・' || (cl->>0) || (pc->>2), 16)) on conflict (week) do nothing returning * into w;
  if w.week is null then select * into w from public.gang_weekly where week = p_week; end if;
  return w;
end $$;
revoke all on function public._gang_make(date) from public, anon, authenticated;

create or replace function public.gang_week() returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.gang_weekly; pl public.players := public._me(); why text;
begin
  w := public._gang_make(public._gang_week());
  why := case when pl.created_at > now() - interval '2 days' then '帳號建立滿 2 天才能買老港的手作'
              when pl.total < 50 then '總共釣過 50 條魚才能買（現在 ' || pl.total || ' 條）' end;
  return jsonb_build_object('week', w.week, 'k3', jsonb_build_object('part', w.k3_part, 'style', w.k3_style, 'col', '#' || w.k3_col, 'name', w.name),
    'price', w.price, 'stock', w.stock, 'sold', w.sold,
    'mine', exists (select 1 from public.gang_buys where week = w.week and uid = pl.id), 'why', why,
    'past', (select coalesce(jsonb_agg(jsonb_build_object('week', g.week, 'name', coalesce(g.name, x.name), 'sold', g.sold, 'stock', g.stock) order by g.week desc), '[]'::jsonb)
             from (select * from public.gang_weekly where week < w.week order by week desc limit 4) g left join public.designs x on x.id = g.design_id));
end $$;

create or replace function public.gang_buy() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); w public.gang_weekly; add text[];
begin
  perform public._gang_make(public._gang_week());
  select * into w from public.gang_weekly where week = public._gang_week() for update;
  select * into pl from public.players where id = pl.id for update;
  if pl.created_at > now() - interval '2 days' then raise exception '帳號建立滿 2 天才能買老港的手作'; end if;
  if pl.total < 50 then raise exception '總共釣過 50 條魚才能買老港的手作'; end if;
  if exists (select 1 from public.gang_buys where week = w.week and uid = pl.id) then raise exception '這週你已經買過了，下週一再來'; end if;
  if w.sold >= w.stock then raise exception '這週的已經賣完了，下週一早上 9 點再來'; end if;
  if pl.coins < w.price then raise exception '金幣不夠'; end if;
  if w.k3_part is null then raise exception '這週的手作還沒準備好'; end if;
  add := array['k3_' || w.k3_part || '_' || w.k3_style, 'k3c_' || w.k3_part || '_' || w.k3_col];
  update public.players set coins = coins - w.price, owned = array(select distinct x from unnest(coalesce(owned, '{}') || add) x), updated_at = now() where id = pl.id returning * into pl;
  insert into public.gang_buys (week, uid) values (w.week, pl.id);
  update public.gang_weekly set sold = sold + 1 where week = w.week;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['gang_week()', 'gang_buy()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$ declare w public.gang_weekly; begin w := public._gang_make(public._gang_week()); raise notice '237 老港這週：% %（% 金幣，賣了 %/%）', w.week, w.name, w.price, w.sold, w.stock; end $$;
