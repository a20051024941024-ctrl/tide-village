-- 潮汐釣魚村 v367：共同海圖（可以重複執行）
-- 玩家可以在自己站的位置做記號（魚很多、釣到稀有魚、有大魚或鯨魚、有寶箱貝殼、風景漂亮），所有人打開地圖都看得到，可以按「帶我去」和「謝謝」。
-- 沒有自由輸入的文字（只有固定的種類），記號 24 小時後自動消失；每人同時最多 3 個、一天最多 10 個；要釣過 5 條魚才能做記號。
create table if not exists public.sea_pins (
  id         bigserial primary key,
  uid        uuid not null,
  kind       text not null,
  x          real not null,
  z          real not null,
  likes      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sea_pins_time_idx on public.sea_pins (created_at desc);
create table if not exists public.sea_pin_likes (
  pin bigint not null references public.sea_pins(id) on delete cascade,
  uid uuid not null,
  primary key (pin, uid)
);
alter table public.sea_pins enable row level security;
alter table public.sea_pin_likes enable row level security;
revoke all on public.sea_pins, public.sea_pin_likes from anon, authenticated;

create or replace function public.sea_pins_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'k', q.kind, 'x', q.x, 'z', q.z, 'n', q.nickname, 'l', q.likes, 'mine', q.uid = auth.uid(),
      'liked', exists (select 1 from public.sea_pin_likes k where k.pin = q.id and k.uid = auth.uid()),
      'left', greatest(0, floor(extract(epoch from (q.created_at + interval '24 hours' - now())) / 60))::int) order by q.created_at desc), '[]'::jsonb)
  from (select s.*, p.nickname from public.sea_pins s join public.players p on p.id = s.uid where s.created_at > now() - interval '24 hours' order by s.created_at desc limit 80) q
$$;

create or replace function public.sea_pin_add(p_kind text, p_x real, p_z real) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tot integer; n integer;
begin
  if me is null then raise exception '請先登入'; end if;
  if p_kind not in ('school', 'rare', 'big', 'chest', 'view') then raise exception '沒有這種記號'; end if;
  if p_x is null or p_z is null or abs(p_x) > 400 or abs(p_z) > 400 then raise exception '這裡不能做記號'; end if;
  select total into tot from public.players where id = me;
  if tot is null or tot < 5 then raise exception '先釣到 5 條魚才能做記號'; end if;
  delete from public.sea_pins where created_at < now() - interval '48 hours';
  select count(*) into n from public.sea_pins where uid = me and created_at > now() - interval '24 hours';
  if n >= 10 then raise exception '今天做太多記號了，明天再來'; end if;
  -- 同一個人附近 6 公尺內已經有記號，就換成新的；同時最多留 3 個（最舊的拿掉）
  delete from public.sea_pins s where s.uid = me and (s.x - p_x) * (s.x - p_x) + (s.z - p_z) * (s.z - p_z) < 36;
  insert into public.sea_pins (uid, kind, x, z) values (me, p_kind, p_x, p_z);
  delete from public.sea_pins s where s.uid = me and s.id not in (select t.id from public.sea_pins t where t.uid = me order by t.created_at desc, t.id desc limit 3);
  return public.sea_pins_list();
end $$;

create or replace function public.sea_pin_like(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); own uuid;
begin
  if me is null then raise exception '請先登入'; end if;
  select s.uid into own from public.sea_pins s where s.id = p_id and s.created_at > now() - interval '24 hours';
  if own is null then raise exception '這個記號已經不見了'; end if;
  if own = me then raise exception '不能謝謝自己的記號'; end if;
  insert into public.sea_pin_likes (pin, uid) values (p_id, me) on conflict do nothing;
  if found then update public.sea_pins set likes = likes + 1 where id = p_id; end if;
  return public.sea_pins_list();
end $$;

create or replace function public.sea_pin_del(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  delete from public.sea_pins s where s.id = p_id and s.uid = auth.uid();
  return public.sea_pins_list();
end $$;

revoke all on function public.sea_pins_list(), public.sea_pin_add(text, real, real), public.sea_pin_like(bigint), public.sea_pin_del(bigint) from public, anon;
grant execute on function public.sea_pins_list(), public.sea_pin_add(text, real, real), public.sea_pin_like(bigint), public.sea_pin_del(bigint) to authenticated;
