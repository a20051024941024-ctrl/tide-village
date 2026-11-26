-- 238 👕 造型不能自己調色了，改成「設計款」（作者 11/26：「顏色就算了吧，直接用那些顏色與圖案來設計原本的衣服，老港改賣限定衣服可能比較好」，選了「全部調色都拿掉」）。可以重複執行。
-- 1. 調色拿掉：每個人 owned 裡的 k3c_（買過或第一次送的顏色）一個退 150 金幣，從 owned 拿掉。退款寫進 refund_log（kind = k3_color），進遊戲時跳提示。
--    232 第一次連上時「身上那套直接送」也送了顏色，那些沒有花錢，照樣一個 150 一起退（數量很少，算是補償換掉的顏色）。
-- 2. 設計款：k3v_<部位>_<款式>_<設計>，價錢跟那一部位的款式一樣（上衣 800、褲子 500、鞋子 400、帽子／口罩／耳環 500）。g 開頭的是老港限定，只能在老港那裡買。
-- 3. 老港每週改賣一款限定設計（_gang_des，跟手機 K3.GANGD 同一份順序），買了得到那一款＋那個設計。

create or replace function public._k3_price(p_id text) returns integer language plpgsql immutable as $$
declare k text; v text; d text;
begin
  if p_id is null or length(p_id) > 40 then return null; end if;
  if p_id ~ '^k3c_' then return null; end if;   -- 不賣顏色了
  if p_id ~ '^k3v_(top|bot|shoes|hat|mask|ear)_[a-z0-9]+_[a-z][a-z0-9]{0,9}$' then
    k := split_part(p_id, '_', 2); d := split_part(p_id, '_', 4);
    if d ~ '^g[0-9]+$' then return null; end if;   -- 老港限定
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

-- 老港限定設計：[款式, 設計, 名字]（手機 K3.GANGD 同一份）
create or replace function public._gang_des() returns jsonb language sql immutable as $$
  select '[["rain","g1","浮球點點雨衣"],["wave","g2","老船出海外套"],["hoodie","g3","舊漁網連帽衣"],["tee","g4","燈塔條紋T"],["vest","g5","黑潮背心"],["rain","g6","鹹魚銀雨衣"],["wave","g7","退潮沙海浪外套"],["hoodie","g8","船纜紅連帽衣"]]'::jsonb $$;

-- 1. 退顏色
do $$ declare r record; n int := 0; tot int := 0; begin
  for r in select id, (select count(*) from unnest(owned) x where x ~ '^k3c_')::int as c from public.players where exists (select 1 from unnest(owned) x where x ~ '^k3c_') loop
    insert into public.refund_log (player, kind, coins) values (r.id, 'k3_color', r.c * 150) on conflict (player, kind) do nothing;
    if found then update public.players set coins = coins + r.c * 150 where id = r.id; n := n + 1; tot := tot + r.c * 150; end if;
    update public.players set owned = array(select x from unnest(owned) x where x !~ '^k3c_') where id = r.id;
  end loop;
  raise notice '238 調色拿掉：% 人退了 % 金幣', n, tot;
end $$;

-- 3. 老港
create or replace function public._gang_make(p_week date) returns public.gang_weekly language plpgsql security definer set search_path = public as $$
declare w public.gang_weekly; h bigint := abs(hashtext('gang3' || p_week::text)); d jsonb;
begin
  select * into w from public.gang_weekly where week = p_week;
  if w.week is not null and w.k3_col ~ '^g[0-9]+$' then return w; end if;
  d := public._gang_des() -> (h % jsonb_array_length(public._gang_des()))::int;
  if w.week is not null and w.sold = 0 or (w.week is not null and w.k3_part is not null) then   -- 這週還是舊的（圖案衣服、237 的限定色）：換成限定設計；237 已經賣出的照樣補上設計
    update public.gang_weekly set design_id = null, k3_part = 'top', k3_style = d->>0, k3_col = d->>1, name = left('老港手作・' || (d->>2), 16), price = 900 where week = p_week returning * into w;
    update public.players set owned = array(select distinct x from unnest(owned || array['k3_top_' || (d->>0), 'k3v_top_' || (d->>0) || '_' || (d->>1)]) x)
      where id in (select uid from public.gang_buys where week = p_week);
    return w; end if;
  if w.week is not null then return w; end if;
  insert into public.gang_weekly (week, design_id, price, k3_part, k3_style, k3_col, name)
    values (p_week, null, 900, 'top', d->>0, d->>1, left('老港手作・' || (d->>2), 16)) on conflict (week) do nothing returning * into w;
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
  return jsonb_build_object('week', w.week, 'k3', jsonb_build_object('part', w.k3_part, 'style', w.k3_style, 'key', w.k3_col, 'name', w.name),
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
  add := array['k3_' || w.k3_part || '_' || w.k3_style, 'k3v_' || w.k3_part || '_' || w.k3_style || '_' || w.k3_col];
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

do $$ declare w public.gang_weekly; begin w := public._gang_make(public._gang_week()); raise notice '238 老港這週：% %（% 金幣，賣了 %/%）', w.week, w.name, w.price, w.sold, w.stock; end $$;
