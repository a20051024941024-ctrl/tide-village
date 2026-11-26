-- 235（第 3 段，共 3 段）潮汐釣魚村 v867：釣客市集賣材料、裝備、造型。可以重複執行。要先貼過 233、234。
/* ================= 市集：材料、裝備、造型 ================= */
create table if not exists public.item_market (
  id          bigserial primary key,
  seller      uuid not null,
  seller_name text not null,
  kind        text not null check (kind in ('mat', 'gear', 'skin')),
  key         text not null,               -- mat_shell／gf_3／g_repair／rs_wave …
  qty         integer not null check (qty >= 0),
  price       integer not null check (price > 0),   -- 一個的價錢
  status      text not null default 'open' check (status in ('open', 'sold', 'cancel', 'expired')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists item_market_open on public.item_market (kind, status, price);
create index if not exists item_market_seller on public.item_market (seller, status);
alter table public.item_market enable row level security;

/* 這個東西能不能擺：回傳 kind（mat／gear／skin），不能就 null */
create or replace function public._item_kind(k text) returns text language sql immutable as $$
  select case when k in ('mat_shell', 'mat_net', 'mat_wood', 'mat_coral', 'mat_scale', 'mat_pink') then 'mat'
    when k in ('gf_1', 'gf_2', 'gf_3', 'gl_1', 'gl_2', 'gl_3', 'g_repair') then 'gear'
    when public._craft_recipe(k) ->> 'kind' = 'own' then 'skin' else null end $$;

/* 擺 3 天沒賣掉：退回給賣家 */
create or replace function public._item_expire() returns void language plpgsql security definer set search_path = public as $$
declare r public.item_market;
begin
  for r in select * from public.item_market where status = 'open' and created_at < now() - interval '3 days' for update skip locked loop
    if r.kind = 'skin' then update public.players set owned = case when r.key = any(owned) then owned else array_append(owned, r.key) end where id = r.seller;
    else update public.players set bait = public._bag_add(bait, r.key, r.qty) where id = r.seller; end if;
    update public.item_market set status = 'expired', done_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public.item_list(p_key text, p_qty integer, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text := public._item_kind(p_key); b jsonb; m public.item_market;
begin
  if k is null then raise exception '這個不能拿到市集賣'; end if;
  if p_price is null or p_price < 1 or p_price > 99999 then raise exception '價錢要在 1～99999 之間'; end if;
  if k = 'skin' then p_qty := 1; end if;
  if p_qty is null or p_qty < 1 or p_qty > 99 then raise exception '一次可以擺 1～99 個'; end if;
  perform public._item_expire();
  select * into pl from public.players where id = pl.id for update;
  if (select count(*) from public.item_market where seller = pl.id and status = 'open') >= 8 then raise exception '同時最多擺 8 樣'; end if;
  if k = 'skin' then
    if not (p_key = any(pl.owned)) then raise exception '你沒有這個造型'; end if;
    if p_key in (coalesce(pl.rod_skin, ''), coalesce(pl.line_col, ''), coalesce(pl.hook, '')) then raise exception '正在用的要先拿下來才能賣'; end if;
    update public.players set owned = array_remove(owned, p_key), updated_at = now() where id = pl.id returning * into pl;
  else
    if coalesce((pl.bait ->> p_key)::integer, 0) < p_qty then raise exception '數量不夠'; end if;
    b := public._bag_add(pl.bait, p_key, -p_qty);
    if p_key like 'gf\__' and coalesce((b ->> 'eq_float')::integer, 0) = substr(p_key, 4)::integer and coalesce((b ->> p_key)::integer, 0) = 0 then b := jsonb_set(b, '{eq_float}', '0'); end if;
    if p_key like 'gl\__' and coalesce((b ->> 'eq_lure')::integer, 0) = substr(p_key, 4)::integer and coalesce((b ->> p_key)::integer, 0) = 0 then b := jsonb_set(b, '{eq_lure}', '0'); end if;
    update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  end if;
  insert into public.item_market (seller, seller_name, kind, key, qty, price) values (pl.id, coalesce(nullif(pl.nickname, ''), '釣客'), k, p_key, p_qty, p_price) returning * into m;
  return jsonb_build_object('player', to_jsonb(pl), 'item', to_jsonb(m));
end $$;

create or replace function public.item_browse(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._item_expire();
  return coalesce((select jsonb_agg(to_jsonb(q) - 'seller' || jsonb_build_object('mine', q.seller = auth.uid()) order by q.price, q.id) from (
    select * from public.item_market where status = 'open' and qty > 0 and (p_kind is null or kind = p_kind) order by price, id limit 80) q), '[]'::jsonb);
end $$;

create or replace function public.item_mine() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) from (
    select * from public.item_market where seller = auth.uid() and (status = 'open' or done_at > now() - interval '3 days') order by created_at desc limit 30) q $$;

create or replace function public.item_buy(p_id bigint, p_qty integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.item_market; cost integer; got integer; td date := (now() at time zone 'Asia/Taipei')::date; spent integer;
begin
  select * into m from public.item_market where id = p_id for update;
  if m.id is null or m.status <> 'open' or m.qty < 1 then raise exception '已經被買走了'; end if;
  if m.created_at < now() - interval '3 days' then raise exception '這個已經下架了'; end if;
  if m.seller = pl.id then raise exception '不能買自己擺的'; end if;
  if m.kind = 'skin' then p_qty := 1; end if;
  if p_qty is null or p_qty < 1 or p_qty > m.qty then raise exception '數量不對'; end if;
  cost := m.price * p_qty;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  spent := case when pl.design_spend_day = td then pl.design_spend else 0 end;   /* 089：新手跟其他市集共用每天 1500 的上限 */
  if (pl.created_at > now() - interval '3 days' or pl.total < 200) and spent + cost > 1500 then raise exception '新手一天在市集最多花 1500 金幣（帳號滿 3 天、釣到 200 條魚以後就沒有限制）'; end if;
  if m.kind = 'skin' then
    if m.key = any(pl.owned) then raise exception '你已經有這個造型了'; end if;
    update public.players set coins = coins - cost, owned = array_append(owned, m.key), design_spend_day = td, design_spend = spent + cost, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - cost, bait = public._bag_add(bait, m.key, p_qty), design_spend_day = td, design_spend = spent + cost, updated_at = now() where id = pl.id returning * into pl;
  end if;
  got := floor(cost * 0.95)::int;
  update public.item_market set qty = qty - p_qty, status = case when qty - p_qty <= 0 then 'sold' else 'open' end, done_at = case when qty - p_qty <= 0 then now() else done_at end where id = p_id;
  update public.players set coins = coins + got, earned = earned + got, updated_at = now() where id = m.seller;
  begin perform public._push(m.seller, 'market', '🏪 你擺的東西賣掉了！', '賣了 ' || p_qty || ' 個，你拿到 🪙' || got); exception when others then null; end;
  return jsonb_build_object('player', to_jsonb(pl), 'got', p_qty);
end $$;

create or replace function public.item_cancel(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.item_market;
begin
  select * into m from public.item_market where id = p_id for update;
  if m.id is null or m.seller <> pl.id or m.status <> 'open' then raise exception '不能收回這個'; end if;
  select * into pl from public.players where id = pl.id for update;
  if m.kind = 'skin' then update public.players set owned = case when m.key = any(owned) then owned else array_append(owned, m.key) end, updated_at = now() where id = pl.id returning * into pl;
  else update public.players set bait = public._bag_add(bait, m.key, m.qty), updated_at = now() where id = pl.id returning * into pl; end if;
  update public.item_market set status = 'cancel', done_at = now() where id = p_id;
  return jsonb_build_object('player', to_jsonb(pl));
end $$;
do $$ declare f text; begin
  foreach f in array array['item_list(text,integer,integer)', 'item_browse(text)', 'item_mine()', 'item_buy(bigint,integer)', 'item_cancel(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_item_kind(text)', '_item_expire()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
