-- 潮汐釣魚村：好友與送禮（可以重複執行）
-- 好友名單和禮物放在「只有自己」的表，不能直接讀寫，只能用下面的函式
create table if not exists public.friends (
  owner  uuid not null references public.players(id) on delete cascade,
  friend uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, friend)
);
create index if not exists friends_friend_idx on public.friends (friend);
alter table public.friends enable row level security;
revoke all on public.friends from anon, authenticated;

create table if not exists public.gifts (
  id bigserial primary key,
  to_id   uuid not null references public.players(id) on delete cascade,
  from_id uuid not null references public.players(id) on delete cascade,
  kind text not null,            -- 'coins' 或 'fish'
  data jsonb not null,
  created_at timestamptz not null default now(),
  opened boolean not null default false
);
create index if not exists gifts_to_idx on public.gifts (to_id, opened);
alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;

alter table public.players add column if not exists gift_day   date;
alter table public.players add column if not exists gift_coins integer not null default 0;   -- 今天送出的金幣
alter table public.players add column if not exists gift_fish  integer not null default 0;   -- 今天送出的魚

-- 好友、好友邀請、還沒打開的禮物
create or replace function public.get_friends() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'seen', p.updated_at,
        'mutual', exists (select 1 from public.friends r where r.owner = f.friend and r.friend = pl.id)) order by f.created_at)
      from public.friends f join public.players p on p.id = f.friend where f.owner = pl.id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname) order by f.created_at desc)
      from public.friends f join public.players p on p.id = f.owner
      where f.friend = pl.id and not exists (select 1 from public.friends m where m.owner = pl.id and m.friend = f.owner)), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from', g.from_id, 'name', p.nickname, 'kind', g.kind, 'data', g.data, 'at', g.created_at) order by g.id desc)
      from (select * from public.gifts where to_id = pl.id and not opened order by id desc limit 30) g left join public.players p on p.id = g.from_id), '[]'::jsonb));
end $$;

create or replace function public.add_friend(p_uid uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_uid = pl.id then raise exception '不能加自己當好友'; end if;
  if not exists (select 1 from public.players where id = p_uid) then raise exception '找不到這位玩家'; end if;
  if (select count(*) from public.friends where owner = pl.id) >= 100 then raise exception '好友最多 100 位'; end if;
  insert into public.friends (owner, friend) values (pl.id, p_uid) on conflict do nothing;
  return public.get_friends();
end $$;

-- 用好友代碼加（玩家 id 的前 8 碼）
create or replace function public.add_friend_code(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := lower(trim(coalesce(p_code, ''))); ids uuid[];
begin
  if c !~ '^[0-9a-f]{8}$' then raise exception '好友代碼是 8 個英文或數字'; end if;
  select array_agg(id) into ids from (select id from public.players where id::text like c || '%' limit 2) s;
  if ids is null or cardinality(ids) <> 1 then raise exception '找不到這位玩家'; end if;
  return public.add_friend(ids[1]);
end $$;

create or replace function public.remove_friend(p_uid uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  delete from public.friends where (owner = pl.id and friend = p_uid) or (owner = p_uid and friend = pl.id);
  return public.get_friends();
end $$;

-- 送禮：只能送給互相加好友的人。金幣每天最多送 1000，魚每天最多送 10 條（展示中的魚不能送）
create or replace function public.send_gift(p_to uuid, p_kind text, p_ts bigint, p_amount integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; gc integer; gf integer; e jsonb;
begin
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_to) and exists (select 1 from public.friends where owner = p_to and friend = pl.id)) then raise exception '要互相加好友才能送禮'; end if;
  if (select count(*) from public.gifts where to_id = p_to and not opened) >= 30 then raise exception '對方的禮物箱滿了'; end if;
  gc := case when pl.gift_day = d then pl.gift_coins else 0 end; gf := case when pl.gift_day = d then pl.gift_fish else 0 end;
  if p_kind = 'coins' then
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
    update public.players set
      tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality y(x, i) where (x->>'t')::bigint <> p_ts),
      gift_day = d, gift_coins = gc, gift_fish = gf + 1, updated_at = now()
    where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'fish', jsonb_build_object('f', e->>'f', 'w', (e->>'w')::numeric));
  else raise exception '沒有這種禮物'; end if;
  return pl;
end $$;

-- 打開禮物：金幣直接加，魚放進魚缸
create or replace function public.open_gift(p_id bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); g public.gifts; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into g from public.gifts where id = p_id and to_id = pl.id and not opened for update;
  if not found then raise exception '找不到這個禮物'; end if;
  update public.gifts set opened = true where id = g.id;
  if g.kind = 'coins' then
    update public.players set coins = coins + (g.data->>'amount')::integer, updated_at = now() where id = pl.id returning * into pl;
  elsif g.kind = 'fish' and exists (select 1 from public.fish_species where id = g.data->>'f') then
    update public.players set tank = public._trim_tank(jsonb_build_array(jsonb_build_object('f', g.data->>'f', 'w', (g.data->>'w')::numeric, 't', ts)) || tank, show), updated_at = now()
    where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['get_friends()', 'add_friend(uuid)', 'add_friend_code(text)', 'remove_friend(uuid)', 'send_gift(uuid,text,bigint,integer)', 'open_gift(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '好友與送禮設定完成 🎁' as result;
