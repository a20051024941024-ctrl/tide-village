-- 潮汐釣魚村：老港的每週限定手作（可以重複執行）
-- 老港每週一早上 9 點（台灣時間）用舊漁網、船纜、浮球的顏色做一件限定的帽子／披風／領巾／上衣，只做 5 件。
-- 每人每週最多買 1 件；防分身：帳號要建立超過 2 天、總共釣過 50 條魚才能買。賣完就沒了，下週換新的。
-- 這件東西也是 16×16 的設計（designs 表，owner = 老港），但不放上市集（listed = false），只能在老港這裡買。

create or replace function public._gang_id() returns uuid language sql immutable as $$ select 'a11e0000-0000-4000-8000-00000000006a'::uuid $$;
-- 這一週：週一 9:00 開始（台灣時間）
create or replace function public._gang_week() returns date language sql stable as $$
  select date_trunc('week', (now() at time zone 'Asia/Taipei') - interval '9 hours')::date $$;

create table if not exists public.gang_weekly (
  week      date primary key,
  design_id integer not null references public.designs(id),
  price     integer not null,
  stock     integer not null default 5,
  sold      integer not null default 0 check (sold <= stock)
);
create table if not exists public.gang_buys (
  week date not null references public.gang_weekly(week),
  uid  uuid not null,
  at   timestamptz not null default now(),
  primary key (week, uid)
);
alter table public.gang_weekly enable row level security; alter table public.gang_buys enable row level security;
revoke all on public.gang_weekly from anon, authenticated; revoke all on public.gang_buys from anon, authenticated;

-- 做這週的（已經做過就不做）
create or replace function public._gang_make(p_week date) returns public.gang_weekly language plpgsql security definer set search_path = public as $$
declare
  w public.gang_weekly; kinds text[] := array['hat', 'back', 'acc', 'top'];
  kname jsonb := '{"hat":"船長帽","back":"漁網披風","acc":"船纜領巾","top":"出海外套"}';
  themes text[] := array['深海', '舊漁網', '浮球', '燈塔夜', '退潮', '鹹魚', '老船', '黑潮'];
  cols integer[][] := array[[10,0,15,14],[13,5,14,0],[4,10,0,5],[10,5,1,14],[9,13,15,0],[12,13,0,10],[13,4,15,10],[1,10,0,9]];
  pats text[] := array['anchor', 'fish', 'stripe', 'wave', 'check', 'hem'];
  h bigint := abs(hashtext('gang' || p_week::text)); t int; k text; pi int; c integer[]; cc integer[]; px text; nid int; pr int; n int;
begin
  select * into w from public.gang_weekly where week = p_week; if w.week is not null then return w; end if;
  t := 1 + (h % 8)::int; k := kinds[1 + ((h / 8) % 4)::int]; pi := 1 + ((h / 32) % 6)::int; pr := (array[600, 800, 900, 1200])[1 + ((h / 192) % 4)::int];
  c := cols[t:t][1:4]; select array_agg(v) into cc from unnest(c) v; c := cc;
  px := public._ling_face(pats[pi], c, false); if k = 'top' then px := px || public._ling_face(pats[pi], c, true); end if;
  select count(*) + 1 into n from public.gang_weekly;
  insert into public.designs (owner, owner_name, kind, name, px, price, listed)
    values (public._gang_id(), '老港', k, left('老港手作・' || themes[t] || (kname->>k), 16), px, pr, false) returning id into nid;
  insert into public.gang_weekly (week, design_id, price) values (p_week, nid, pr) on conflict (week) do nothing returning * into w;
  if w.week is null then select * into w from public.gang_weekly where week = p_week; end if;
  return w;
end $$;
revoke all on function public._gang_make(date) from public, anon, authenticated;

-- 看這週的手作（沒有的話老港馬上做一件）
create or replace function public.gang_week() returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.gang_weekly; d public.designs; pl public.players := public._me(); why text;
begin
  w := public._gang_make(public._gang_week());
  select * into d from public.designs where id = w.design_id;
  why := case when pl.created_at > now() - interval '2 days' then '帳號建立滿 2 天才能買老港的手作'
              when pl.total < 50 then '總共釣過 50 條魚才能買（現在 ' || pl.total || ' 條）' end;
  return jsonb_build_object('week', w.week, 'item', public._design_row(d), 'price', w.price, 'stock', w.stock, 'sold', w.sold,
    'mine', exists (select 1 from public.gang_buys where week = w.week and uid = pl.id), 'why', why,
    'past', (select coalesce(jsonb_agg(jsonb_build_object('week', g.week, 'name', x.name, 'sold', g.sold, 'stock', g.stock) order by g.week desc), '[]'::jsonb)
             from (select * from public.gang_weekly where week < w.week order by week desc limit 4) g join public.designs x on x.id = g.design_id));
end $$;

-- 買：鎖住這週那一筆（for update）防止兩個人同時搶到第 6 件；每人每週一件（主鍵擋住）
create or replace function public.gang_buy() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); w public.gang_weekly; d public.designs; item text;
begin
  perform public._gang_make(public._gang_week());
  select * into w from public.gang_weekly where week = public._gang_week() for update;
  if pl.created_at > now() - interval '2 days' then raise exception '帳號建立滿 2 天才能買老港的手作'; end if;
  if pl.total < 50 then raise exception '總共釣過 50 條魚才能買老港的手作'; end if;
  if exists (select 1 from public.gang_buys where week = w.week and uid = pl.id) then raise exception '這週你已經買過了，下週一再來'; end if;
  if w.sold >= w.stock then raise exception '這週的已經賣完了，下週一早上 9 點再來'; end if;
  if pl.coins < w.price then raise exception '金幣不夠'; end if;
  select * into d from public.designs where id = w.design_id; item := d.kind || '_dz' || d.id;
  update public.players set coins = coins - w.price, owned = case when item = any(owned) then owned else array_append(owned, item) end, updated_at = now() where id = pl.id returning * into pl;
  insert into public.gang_buys (week, uid) values (w.week, pl.id);
  update public.gang_weekly set sold = sold + 1 where week = w.week;
  update public.designs set sold = sold + 1 where id = d.id;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['gang_week()', 'gang_buy()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 每週一台灣時間 9:05（UTC 1:05）做新的一件
do $$ begin
  perform public._gang_make(public._gang_week());
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-gang-weekly', '5 1 * * 1', 'select public._gang_make(public._gang_week())');
  end if;
end $$;

select '老港的每週限定手作開賣了 ⚓' as result;
