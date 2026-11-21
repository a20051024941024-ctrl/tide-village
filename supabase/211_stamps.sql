-- 211 📮 集章卡（登入獎勵）＋ 郵差的包裹（在線獎勵）（v662）。可以重複執行。
-- ・集章卡：每天（台灣時間）第一次進遊戲蓋一個章，7 格一張。漏掉一天不會歸零，下次接著蓋。
--   第 1～6 格：金幣、魚餌、窩料；第 7 格：好一點的東西（四種輪流）＋ 300 金幣；
--   每蓋滿 4 張（第 28、56…個章）：送一件只有集章拿得到的造型（之後出新造型就加進 _stamp_gear 的清單），全部拿過就改送 1000 金幣。
-- ・郵差的包裹：每天有在玩（手機每分鐘回報一次，伺服器 50 秒內只算一次）滿 10、30、60 分鐘各送一次。超過 60 分鐘不再算。
-- ・「今天蓋過沒」、「玩了幾分鐘」都由伺服器記，改手機時間或重新整理都沒用。

create table if not exists public.stamp_card (
  uid        uuid primary key references public.players(id) on delete cascade,
  n          integer not null default 0,
  last_day   date,
  play_day   date,
  play_min   integer not null default 0,
  play_claim integer not null default 0,
  play_at    timestamptz
);
alter table public.stamp_card enable row level security;

-- 集章才拿得到的造型（依順序送）。以後出新造型就往後面加。
create or replace function public._stamp_gear() returns text[] language sql immutable as $$ select array['hat_mail', 'back_mailbag'] $$;

-- 獎勵品可以穿（set_gear 會檢查要先擁有）
create or replace function public._reward_item(p text) returns boolean language sql immutable as $$ select p in ('hat_skipom', 'acc_skigog') or p = any(public._stamp_gear()) $$;

create or replace function public._stamp_add(p_uid uuid, p_k text, p_q integer) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_k = 'coins' then
    update public.players set coins = coins + p_q, updated_at = now() where id = p_uid;
  else
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array[p_k], to_jsonb(least(999, coalesce((bait ->> p_k)::integer, 0) + p_q))), updated_at = now() where id = p_uid;
  end if;
end $$;
revoke all on function public._stamp_add(uuid, text, integer) from public, anon, authenticated;

create or replace function public._stamp_row(p_uid uuid) returns public.stamp_card language plpgsql security definer set search_path = public as $$
declare r public.stamp_card; td date := (now() at time zone 'Asia/Taipei')::date;
begin
  insert into public.stamp_card (uid) values (p_uid) on conflict (uid) do nothing;
  select * into r from public.stamp_card where uid = p_uid for update;
  if r.play_day is distinct from td then
    update public.stamp_card set play_day = td, play_min = 0, play_claim = 0, play_at = null where uid = p_uid returning * into r;
  end if;
  return r;
end $$;
revoke all on function public._stamp_row(uuid) from public, anon, authenticated;

create or replace function public.stamp_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.stamp_card; td date := (now() at time zone 'Asia/Taipei')::date;
begin
  r := public._stamp_row(pl.id);
  return jsonb_build_object('n', r.n, 'today', coalesce(r.last_day = td, false), 'mins', r.play_min, 'claim', r.play_claim);
end $$;

create or replace function public.stamp_claim() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.stamp_card; td date := (now() at time zone 'Asia/Taipei')::date;
  n integer; p integer; c integer; got jsonb := '[]'::jsonb; it record; g text := null; x text;
begin
  r := public._stamp_row(pl.id);
  if r.last_day = td then raise exception '今天已經蓋過章了，明天再來'; end if;
  n := r.n + 1; p := (n - 1) % 7 + 1; c := (n - 1) / 7;
  got := case p
    when 1 then '[["coins",150]]'
    when 2 then '[["worm",10]]'
    when 3 then '[["chum_rice",3]]'
    when 4 then '[["coins",250]]'
    when 5 then '[["glow",5]]'
    when 6 then '[["chum_krill",3]]'
    else (case c % 4 when 0 then '[["gold",3],["coins",300]]' when 1 then '[["seed_coral",2],["coins",300]]' when 2 then '[["chum_gold",2],["coins",300]]' else '[["rainbow",2],["coins",300]]' end)
  end::jsonb;
  if n % 28 = 0 then
    foreach x in array public._stamp_gear() loop
      if not (x = any(coalesce(pl.owned, '{}'))) then g := x; exit; end if;
    end loop;
    if g is null then got := got || '[["coins",1000]]'::jsonb;
    else update public.players set owned = coalesce(owned, '{}') || g, updated_at = now() where id = pl.id; end if;
  end if;
  for it in select e->>0 as kk, (e->>1)::integer as q from jsonb_array_elements(got) e loop
    perform public._stamp_add(pl.id, it.kk, it.q);
  end loop;
  update public.stamp_card set n = r.n + 1, last_day = td where uid = pl.id;
  select * into pl from public.players where id = pl.id;
  return jsonb_build_object('player', to_jsonb(pl), 'n', n, 'got', got, 'gear', g);
end $$;

create or replace function public.play_ping() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.stamp_card;
begin
  r := public._stamp_row(pl.id);
  if r.play_min < 60 and (r.play_at is null or r.play_at <= now() - interval '50 seconds') then
    update public.stamp_card set play_min = play_min + 1, play_at = now() where uid = pl.id returning * into r;
  end if;
  return jsonb_build_object('mins', r.play_min, 'claim', r.play_claim);
end $$;

create or replace function public.play_claim() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.stamp_card; k integer; got jsonb; it record;
begin
  r := public._stamp_row(pl.id);
  k := r.play_claim + 1;
  if k > 3 then raise exception '今天的包裹都拿過了，明天再來'; end if;
  if r.play_min < (array[10, 30, 60])[k] then raise exception '郵差還沒到喔'; end if;
  got := (array['[["coins",120]]', '[["glow",5],["coins",100]]', '[["chum_krill",3],["coins",200]]'])[k]::jsonb;
  for it in select e->>0 as kk, (e->>1)::integer as q from jsonb_array_elements(got) e loop
    perform public._stamp_add(pl.id, it.kk, it.q);
  end loop;
  update public.stamp_card set play_claim = k where uid = pl.id;
  select * into pl from public.players where id = pl.id;
  return jsonb_build_object('player', to_jsonb(pl), 'step', k, 'got', got);
end $$;

revoke all on function public.stamp_state() from public, anon;
revoke all on function public.stamp_claim() from public, anon;
revoke all on function public.play_ping() from public, anon;
revoke all on function public.play_claim() from public, anon;
grant execute on function public.stamp_state() to authenticated;
grant execute on function public.stamp_claim() to authenticated;
grant execute on function public.play_ping() to authenticated;
grant execute on function public.play_claim() to authenticated;

select '集章卡和郵差的包裹 📮' as result;
