-- 潮汐釣魚村：釣客魚市（玩家之間買賣魚；可以重複執行）
-- 把魚缸裡的魚放上魚市（魚先從魚缸拿出來，由伺服器保管），自己訂價：海邊商店收購價的 0.5～5 倍。
-- 別人買了：魚放進買家的魚缸，錢的 95% 給賣家（5% 是魚市的清潔費）。每人最多同時擺 6 條，擺 3 天沒賣掉自動退回魚缸。
-- 展示中的魚、紅鯊不能賣；同一條魚只會被一個人買到（for update 鎖住那一筆）。

create table if not exists public.fish_market (
  id          bigserial primary key,
  seller      uuid not null,
  seller_name text not null,
  fish        text not null,
  w           numeric not null,
  item        jsonb not null,           -- 魚缸裡那一筆（變種、公母、基因都跟著走）
  price       integer not null check (price > 0),
  base        integer not null,         -- 擺上去時的收購價（給大家比較）
  status      text not null default 'open' check (status in ('open', 'sold', 'cancel', 'expired')),
  buyer       uuid,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists fish_market_open on public.fish_market (status, created_at desc);
create index if not exists fish_market_seller on public.fish_market (seller, status);
alter table public.fish_market enable row level security;
revoke all on public.fish_market from anon, authenticated;

create or replace function public._market_row(m public.fish_market) returns jsonb language sql stable as $$
  select jsonb_build_object('id', m.id, 'seller', m.seller_name, 'mine', m.seller = auth.uid(), 'fish', m.fish, 'w', m.w, 'item', m.item - 't', 'price', m.price, 'base', m.base, 'status', m.status, 'at', m.created_at, 'done', m.done_at) $$;

-- 擺上魚市
create or replace function public.market_list(p_t bigint, p_price integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb; sp public.fish_species; base int; n int;
begin
  select count(*) into n from public.fish_market where seller = pl.id and status = 'open';
  if n >= 6 then raise exception '一個人最多同時擺 6 條'; end if;
  select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '魚缸裡沒有這條魚'; end if;
  if e ? 'rs' then raise exception '赤紅霸王鯊不能賣'; end if;
  if pl.show @> jsonb_build_array(e->'t') then raise exception '展示中的魚要先收回來才能賣'; end if;
  select * into sp from public.fish_species where id = e->>'f'; if sp.id is null then raise exception '沒有這種魚'; end if;
  base := greatest(1, public._fish_price(sp, (e->>'w')::numeric));
  if p_price is null or p_price < greatest(5, round(base * 0.5)) or p_price > greatest(50, base * 5) then raise exception '價錢要在 % 到 % 之間', greatest(5, round(base * 0.5)), greatest(50, base * 5); end if;
  update public.players set tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality t(x, i) where (x->>'t')::bigint <> p_t), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.fish_market (seller, seller_name, fish, w, item, price, base) values (pl.id, left(coalesce(nullif(pl.nickname, ''), '釣客'), 16), sp.id, (e->>'w')::numeric, e, p_price, base);
  return pl;
end $$;

-- 收回來
create or replace function public.market_cancel(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.fish_market;
begin
  select * into m from public.fish_market where id = p_id for update;
  if m.id is null or m.seller <> pl.id then raise exception '這不是你的魚'; end if;
  if m.status <> 'open' then raise exception '這條魚已經賣掉或收回了'; end if;
  update public.fish_market set status = 'cancel', done_at = now() where id = p_id;
  update public.players set tank = public._trim_tank(jsonb_build_array(m.item || jsonb_build_object('t', (extract(epoch from clock_timestamp()) * 1000)::bigint)) || tank, show), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 買
create or replace function public.market_buy(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.fish_market; got int; sp public.fish_species;
begin
  select * into m from public.fish_market where id = p_id for update;
  if m.id is null or m.status <> 'open' then raise exception '這條魚已經被買走了'; end if;
  if m.seller = pl.id then raise exception '不能買自己的魚'; end if;
  if pl.coins < m.price then raise exception '金幣不夠'; end if;
  got := floor(m.price * 0.95)::int;
  update public.fish_market set status = 'sold', buyer = pl.id, done_at = now() where id = p_id;
  update public.players set coins = coins - m.price,
    tank = public._trim_tank(jsonb_build_array(m.item || jsonb_build_object('t', (extract(epoch from clock_timestamp()) * 1000)::bigint)) || tank, show), updated_at = now()
    where id = pl.id returning * into pl;
  update public.players set coins = coins + got, earned = earned + got, updated_at = now() where id = m.seller;
  select * into sp from public.fish_species where id = m.fish;
  perform public._push(m.seller, 'market', '🐟 你的魚賣掉了！', coalesce(sp.name, '魚') || ' ' || round(m.w, 2) || 'kg 賣了 🪙' || m.price || '，你拿到 🪙' || got);
  return pl;
end $$;

-- 逛魚市：p_mode = 'new'（最新）／'cheap'（跟收購價比最划算）／'mine'（我擺的、最近賣掉的）；p_fish 只看某一種
create or replace function public.market_browse(p_mode text, p_fish text, p_offset integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._market_row(m)), '[]'::jsonb) from (
    select * from public.fish_market m
    where case when p_mode = 'mine' then m.seller = auth.uid() and (m.status = 'open' or m.done_at > now() - interval '3 days')
               else m.status = 'open' and (p_fish is null or m.fish = p_fish) end
    order by case when p_mode = 'cheap' then m.price::numeric / greatest(1, m.base) end asc nulls last, m.created_at desc
    limit 40 offset greatest(0, coalesce(p_offset, 0))) m $$;

-- 魚市的行情：每一種魚最近 7 天賣掉的平均價格、現在擺著幾條（玩家交易會影響公共市場）
create or replace function public.market_stats() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(fish, jsonb_build_object('avg', avg_p, 'sold', sold, 'open', open_n)), '{}'::jsonb) from (
    select fish, round(avg(price) filter (where status = 'sold' and done_at > now() - interval '7 days')) avg_p,
           count(*) filter (where status = 'sold' and done_at > now() - interval '7 days') sold, count(*) filter (where status = 'open') open_n
    from public.fish_market where status = 'open' or done_at > now() - interval '7 days' group by fish) s $$;

do $$ declare f text; begin
  foreach f in array array['market_list(bigint, integer)', 'market_cancel(bigint)', 'market_buy(bigint)', 'market_browse(text, text, integer)', 'market_stats()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 擺超過 3 天沒賣掉：退回賣家的魚缸
create or replace function public._market_expire() returns integer language plpgsql security definer set search_path = public as $$
declare m public.fish_market; n int := 0;
begin
  for m in select * from public.fish_market where status = 'open' and created_at < now() - interval '3 days' for update skip locked loop
    update public.fish_market set status = 'expired', done_at = now() where id = m.id;
    update public.players set tank = public._trim_tank(jsonb_build_array(m.item || jsonb_build_object('t', (extract(epoch from clock_timestamp()) * 1000)::bigint + n)) || tank, show), updated_at = now() where id = m.seller;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public._market_expire() from public, anon, authenticated;

-- 通知開關多一個「魚賣掉了」
create or replace function public.set_push_prefs(p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  update public.push_subs set prefs = (select coalesce(jsonb_object_agg(k, to_jsonb((p->>k)::boolean)), '{}'::jsonb) from unnest(array['rs','tourney','cage','design','visit','fu','gang','news','cai','market']) k where p ? k) where uid = auth.uid();
  return true;
end $$;
revoke all on function public.set_push_prefs(jsonb) from public, anon;
grant execute on function public.set_push_prefs(jsonb) to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-market-expire', '17 * * * *', 'select public._market_expire()');
  end if;
end $$;

select '釣客魚市開張了 🐟' as result;
