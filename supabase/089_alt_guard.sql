-- 089 分身帳號限制（可以重複執行）
-- 防止開很多帳號領免費的東西再轉給主帳號：
--   1. 釣客魚市：新帳號（不到 3 天）或釣不到 200 條的人，跟設計師市集、寵物市集共用「一天最多花 1500」的上限。
--   2. 送魚：送的人要帳號滿 3 天（或綁定 Email）而且釣過 30 條魚；一個人一天最多收 20 份禮物。
--   3. 節慶免費的東西（紅包、每日禮物、小遊戲獎勵）：要先釣過 10 條魚才拿得到（剛開的空帳號拿不到）。
alter table public.gifts add column if not exists created_at timestamptz not null default now();

create or replace function public.market_buy(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); m public.fish_market; got int; sp public.fish_species; td date := (now() at time zone 'Asia/Taipei')::date; spent integer;
begin
  select * into m from public.fish_market where id = p_id for update;
  if m.id is null or m.status <> 'open' then raise exception '這條魚已經被買走了'; end if;
  if m.seller = pl.id then raise exception '不能買自己的魚'; end if;
  if pl.coins < m.price then raise exception '金幣不夠'; end if;
  spent := case when pl.design_spend_day = td then pl.design_spend else 0 end;   -- 089：新手跟設計師市集、寵物市集共用每天 1500 的上限
  if (pl.created_at > now() - interval '3 days' or pl.total < 200) and spent + m.price > 1500 then raise exception '新手一天在市集最多花 1500 金幣（帳號滿 3 天、釣到 200 條魚以後就沒有限制）'; end if;
  got := floor(m.price * 0.95)::int;
  update public.fish_market set status = 'sold', buyer = pl.id, done_at = now() where id = p_id;
  update public.players set coins = coins - m.price, design_spend_day = td, design_spend = spent + m.price,
    tank = public._trim_tank(jsonb_build_array(m.item || jsonb_build_object('t', (extract(epoch from clock_timestamp()) * 1000)::bigint)) || tank, show), updated_at = now()
    where id = pl.id returning * into pl;
  update public.players set coins = coins + got, earned = earned + got, updated_at = now() where id = m.seller;
  select * into sp from public.fish_species where id = m.fish;
  perform public._push(m.seller, 'market', '🐟 你的魚賣掉了！', coalesce(sp.name, '魚') || ' ' || round(m.w, 2) || 'kg 賣了 🪙' || m.price || '，你拿到 🪙' || got);
  return pl;
end $$;

create or replace function public.send_gift(p_to uuid, p_kind text, p_ts bigint, p_amount integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; gc integer; gf integer; e jsonb;
begin
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_to) and exists (select 1 from public.friends where owner = p_to and friend = pl.id)) then raise exception '要互相加好友才能送禮'; end if;
  if (select count(*) from public.gifts where to_id = p_to and not opened) >= 30 then raise exception '對方的禮物箱滿了'; end if;
  if pl.total < 30 or not public._trusted(pl.id) then raise exception '帳號建立滿 3 天（或綁定 Email）而且釣到 30 條魚以後才能送禮'; end if;   -- 089：分身帳號不能一開就送魚
  if (select count(*) from public.gifts where to_id = p_to and created_at > now() - interval '1 day') >= 20 then raise exception '對方今天收到的禮物太多了，明天再送'; end if;
  gc := case when pl.gift_day = d then pl.gift_coins else 0 end; gf := case when pl.gift_day = d then pl.gift_fish else 0 end;
  if p_kind = 'coins' then
    raise exception '金幣不能送人了，可以送魚喔';   -- 086：拿掉送金幣（避免開分身帳號刷金幣再轉給自己）
    if p_amount is null or p_amount < 10 or p_amount > 1000 then raise exception '一次可以送 10～1000 金幣'; end if;
    if gc + p_amount > 1000 then raise exception '今天送的金幣到上限了（每天 1000）'; end if;
    if pl.coins < p_amount then raise exception '金幣不夠'; end if;
    update public.players set coins = coins - p_amount, gift_day = d, gift_coins = gc + p_amount, gift_fish = gf, updated_at = now() where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'coins', jsonb_build_object('amount', p_amount));
  elsif p_kind = 'fish' then
    if gf >= 10 then raise exception '今天送的魚到上限了（每天 10 條）'; end if;
    select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_ts limit 1;
    if e is null then raise exception '找不到這條魚'; end if;
    if pl.show @> jsonb_build_array(e->'t') then raise exception '展示中的魚不能送'; end if;
    if e ? 'rs' then raise exception '赤紅霸王鯊不能送人'; end if;
    update public.players set
      tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality y(x, i) where (x->>'t')::bigint <> p_ts),
      gift_day = d, gift_coins = gc, gift_fish = gf + 1, updated_at = now()
    where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'fish', jsonb_build_object('f', e->>'f', 'w', (e->>'w')::numeric));
  else raise exception '沒有這種禮物'; end if;
  return pl;
end $$;

create or replace function public._fest_ready() returns void language plpgsql stable security definer set search_path = public as $$
begin if coalesce((select total from public.players where id = auth.uid()), 0) < 10 then raise exception '先去釣 10 條魚，就能參加節慶活動'; end if; end $$;
revoke all on function public._fest_ready() from public, anon, authenticated;

create or replace function public.fest_hongbao() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; r numeric := random(); c integer;
begin
  if not public._fest_on('cny') then raise exception '春節的時候才有紅包'; end if;
  perform public._fest_ready();
  insert into public.fest_log (uid, what, day) values (pl.id, 'hongbao', td) on conflict do nothing;
  if not found then raise exception '今天的紅包已經領過了，明天再來'; end if;
  c := case when r < 0.6 then 88 + floor(random() * 80)::int when r < 0.9 then 168 + floor(random() * 200)::int when r < 0.99 then 388 + floor(random() * 200)::int else 888 end;
  update public.players set coins = coins + c, earned = earned + c, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('coins', c, 'player', to_jsonb(pl));
end $$;

create or replace function public.fest_gift() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; r numeric := random(); c integer; k text;
begin
  k := case when public._fest_on('xmas') then 'xgift' when public._fest_on('qixi') then 'qgift' when public._fest_on('halloween') then 'hgift' end;
  if k is null then raise exception '節日的時候才有禮物'; end if;
  perform public._fest_ready();
  insert into public.fest_log (uid, what, day) values (pl.id, k, td) on conflict do nothing;
  if not found then raise exception '今天的禮物已經拿過了，明天再來'; end if;
  c := case when r < 0.6 then 50 + floor(random() * 100)::int when r < 0.92 then 150 + floor(random() * 150)::int else 500 end;
  update public.players set coins = coins + c, earned = earned + c, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('coins', c, 'player', to_jsonb(pl));
end $$;

create or replace function public.fest_game_start(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); gid bigint;
begin
  if p_kind not in ('scoop', 'balloon', 'boat', 'bbq') then raise exception '沒有這個遊戲'; end if;
  perform public._fest_ready();
  if p_kind in ('scoop', 'balloon') and not public._fest_on('night') then raise exception '夜市的時候才能玩（每個月第一個週末晚上）'; end if;
  if p_kind = 'boat' and not public._fest_on('duanwu') then raise exception '端午節的時候才能划龍舟'; end if;
  if p_kind = 'bbq' and not public._fest_on('moon') then raise exception '中秋節的時候才能烤肉'; end if;
  if exists (select 1 from public.fest_games where uid = pl.id and started > now() - interval '3 seconds') then raise exception '太快了，等一下再玩'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < 30 then raise exception '金幣不夠（一次 30 金幣）'; end if;
  update public.fest_games set done = true, score = 0 where uid = pl.id and not done;
  update public.players set coins = coins - 30, updated_at = now() where id = pl.id returning * into pl;
  insert into public.fest_games (uid, kind) values (pl.id, p_kind) returning id into gid;
  return jsonb_build_object('id', gid, 'player', to_jsonb(pl));
end $$;

select '分身帳號限制設定完成 🛡️' as result;
