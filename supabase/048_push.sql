-- 潮汐釣魚村：推播通知（遊戲關著時手機也會跳通知）（可以重複執行）
-- 通知種類：rs（全服：有人釣到紅鯊、紅鯊生小鯊）、tourney（全服：大賽前 10 分鐘）、cage（個人：晚上 8 點箱網還沒餵）、design（個人：設計賣出）、visit（個人：有人來你的小島）
-- 真正把通知送到手機的是 Edge Function「tide-push」（supabase/functions/tide-push/index.ts）。金鑰、排程用的密碼都由這份 SQL／那支程式自動產生，不用自己設定。

-- 訂閱：一支手機（瀏覽器）一筆；prefs 是每一種通知的開關（沒寫＝開）
create table if not exists public.push_subs (
  endpoint text primary key, uid uuid not null, sub jsonb not null, prefs jsonb not null default '{}'::jsonb,
  last_at timestamptz, created_at timestamptz not null default now());
alter table public.push_subs enable row level security;
drop policy if exists "push own insert" on public.push_subs;
drop policy if exists "push own update" on public.push_subs;
drop policy if exists "push own delete" on public.push_subs;
drop policy if exists "push own read" on public.push_subs;
create policy "push own insert" on public.push_subs for insert to authenticated with check (uid = auth.uid());
create policy "push own update" on public.push_subs for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create policy "push own delete" on public.push_subs for delete to authenticated using (uid = auth.uid());
create policy "push own read" on public.push_subs for select to authenticated using (uid = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;

-- 金鑰（Edge Function 第一次執行時自動產生；玩家讀不到）
create table if not exists public.push_vapid (id int primary key, pub text not null, priv text not null);
alter table public.push_vapid enable row level security;
revoke all on public.push_vapid from anon, authenticated;
-- 排程呼叫 Edge Function 用的密碼（自動產生；玩家讀不到）
create table if not exists public.push_secret (id int primary key, secret text not null);
alter table public.push_secret enable row level security;
revoke all on public.push_secret from anon, authenticated;
insert into public.push_secret (id, secret) values (1, md5(random()::text || clock_timestamp()::text) || md5(random()::text)) on conflict (id) do nothing;

-- 等著送出的通知；uid 是空的＝全服
create table if not exists public.push_queue (
  id bigserial primary key, uid uuid, kind text not null, title text, body text, n integer not null default 1, amt integer not null default 0,
  created_at timestamptz not null default now(), sent_at timestamptz);
alter table public.push_queue enable row level security;
revoke all on public.push_queue from anon, authenticated;
create index if not exists push_queue_unsent on public.push_queue (created_at) where sent_at is null;

-- 排一則通知：同一個人、同一種、10 分鐘內還沒送出的就合併（n 加一、amt 加起來）；全服紅鯊 30 分鐘最多一則
create or replace function public._push(p_uid uuid, p_kind text, p_title text, p_body text, p_amt integer default 0) returns void language plpgsql security definer set search_path = public as $$
declare q bigint;
begin
  if p_uid is null and p_kind = 'rs' and exists (select 1 from public.push_queue where uid is null and kind = 'rs' and created_at > now() - interval '30 minutes') then return; end if;
  if p_uid is not null then
    select id into q from public.push_queue where uid = p_uid and kind = p_kind and sent_at is null order by id desc limit 1;   -- 還沒送出的就合併（送出程式會讓同一種 10 分鐘內只送一次）
    if q is not null then update public.push_queue set n = n + 1, amt = amt + coalesce(p_amt, 0), title = p_title, body = p_body where id = q; return; end if;
  end if;
  insert into public.push_queue (uid, kind, title, body, amt) values (p_uid, p_kind, left(p_title, 60), left(p_body, 180), coalesce(p_amt, 0));
  delete from public.push_queue where sent_at is not null and sent_at < now() - interval '3 days';
exception when others then null;   -- 通知失敗不能影響遊戲
end $$;
revoke all on function public._push(uuid, text, text, text, integer) from public, anon, authenticated;

-- 玩家改自己所有訂閱的開關
create or replace function public.set_push_prefs(p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  update public.push_subs set prefs = (select coalesce(jsonb_object_agg(k, to_jsonb((p->>k)::boolean)), '{}'::jsonb) from unnest(array['rs','tourney','cage','design','visit']) k where p ? k) where uid = auth.uid();
  return true;
end $$;
revoke all on function public.set_push_prefs(jsonb) from public, anon;
grant execute on function public.set_push_prefs(jsonb) to authenticated;

-- ---- 在原本的函式裡加上通知 ----
-- 紅鯊被釣到（跟 032 一樣，多了通知）
create or replace function public._rs_claim(p_uid uuid, p_name text, p_rs text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare s public.red_sharks;
begin
  update public.red_sharks set status = 'caught', caught_by = p_uid, caught_name = coalesce(nullif(p_name, ''), '有人'), caught_w = p_w, caught_at = now(), hooked_by = null, hooked_at = null
  where id = split_part(coalesce(p_rs, ''), ':', 1)::integer and hooked_by = p_uid and status = 'sea' returning * into s;
  if not found then raise exception '這隻已經被別人釣走了'; end if;
  perform public._push(null, 'rs', '🦈 赤紅霸王鯊被釣到了！', coalesce(nullif(p_name, ''), '有人') || ' 在外海釣到' || (case when s.albino then '白化' else '' end) || '赤紅霸王鯊（' || round(p_w, 1) || ' kg）！');
end $$;
revoke all on function public._rs_claim(uuid, text, text, numeric) from public, anon, authenticated;

-- 紅鯊繁殖（跟 042 一樣，多了通知）
create or replace function public._rs_breed() returns void language plpgsql security definer set search_path = public as $$
declare m public.red_shark_meta; lc timestamptz; ev timestamptz; nm integer; nf integer; nid integer; k integer; alb boolean;
begin
  select * into m from public.red_shark_meta where id = 1 for update;
  if not found then return; end if;
  loop
    select max(caught_at) into lc from public.red_sharks;
    ev := greatest(m.last_breed, coalesce(lc, m.last_breed));
    exit when ev + interval '7 days' > now();
    select count(*) filter (where sex = 'M'), count(*) filter (where sex = 'F') into nm, nf from public.red_sharks where status = 'sea';
    for k in 1..least(nm, nf) loop
      exit when nm + nf >= public._rs_cap();
      if random() < 0.5 then
        select coalesce(max(id), 0) + 1 into nid from public.red_sharks; alb := random() < 0.02;
        insert into public.red_sharks (id, sex, born_at, albino) values (nid, case when random() < 0.5 then 'M' else 'F' end, ev + interval '7 days', alb);
        nm := nm + 1;
        perform public._push(null, 'rs', case when alb then '🦈 外海出現白化的小紅鯊！' else '🦈 赤紅霸王鯊生小鯊了' end, '紅鯊族群又多了一隻' || (case when alb then '，而且是極少見的白化' else '' end) || '，快去外海碰碰運氣！');
      end if;
    end loop;
    m.last_breed := ev + interval '7 days';
    update public.red_shark_meta set last_breed = m.last_breed where id = 1;
  end loop;
end $$;
revoke all on function public._rs_breed() from public, anon, authenticated;

-- 設計賣出（跟 047 一樣，多了通知給設計的人）
create or replace function public.buy_design(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; item text; so public.players; td date := (now() at time zone 'Asia/Taipei')::date; give integer := 0; got integer;
begin
  select * into d from public.designs where id = p_id for update;
  if d.id is null or d.hidden or not d.listed then raise exception '這件設計已經下架了'; end if;
  item := d.kind || '_dz' || d.id;
  if item = any(pl.owned) then return pl; end if;
  if d.price > 0 and pl.total < 30 then raise exception '要先釣到 30 條魚才能買要錢的設計'; end if;
  if pl.coins < d.price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - d.price, owned = array_append(owned, item), updated_at = now() where id = pl.id returning * into pl;
  if d.owner <> pl.id and d.price > 0 then
    select * into so from public.players where id = d.owner for update;
    got := case when so.design_day = td then so.design_income else 0 end;
    give := greatest(0, least(floor(d.price * 0.9)::integer, 3000 - got));
    update public.players set coins = coins + give, design_day = td, design_income = got + give, updated_at = now() where id = d.owner;
  end if;
  update public.designs set sold = sold + 1 where id = d.id;
  if d.owner <> pl.id then perform public._push(d.owner, 'design', '👕 你的設計賣出了', '你的設計「' || d.name || '」賣出了' || (case when give > 0 then '，+' || give || ' 金幣' else '' end), give); end if;
  return pl;
end $$;
revoke all on function public.buy_design(integer) from public, anon;
grant execute on function public.buy_design(integer) to authenticated;

-- 有人來你的小島（跟 021 一樣，多了通知；同一個人 30 秒內重複的不算）
create or replace function public.log_visit(p_owner uuid, p_kind text) returns void language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; fresh boolean;
begin
  if p_owner is null or p_owner = pl.id or p_kind not in ('isle', 'aqua') then return; end if;
  if not exists (select 1 from public.players where id = p_owner) then return; end if;
  fresh := not exists (select 1 from public.visits where owner = p_owner and visitor = pl.id and kind = p_kind and day = d and now() - last_at < interval '30 minutes');
  insert into public.visits (owner, visitor, kind, day) values (p_owner, pl.id, p_kind, d)
  on conflict (owner, visitor, kind, day) do update set n = visits.n + (case when now() - visits.last_at > interval '30 seconds' then 1 else 0 end), last_at = now();
  delete from public.visits where owner = p_owner and day < d - 14;
  if fresh and p_kind = 'isle' then perform public._push(p_owner, 'visit', '🏝 有人來你的小島', coalesce(nullif(pl.nickname, ''), '有人') || ' 來你的小島玩了'); end if;
end $$;
revoke all on function public.log_visit(uuid, text) from public, anon;
grant execute on function public.log_visit(uuid, text) to authenticated;

-- 排程要用的兩個工作
create or replace function public._push_tourney() returns void language sql security definer set search_path = public as $$
  select public._push(null, 'tourney', '🏆 釣魚大賽 10 分鐘後開始', '比 10 分鐘內釣到的總重量，前三名有獎！') $$;
create or replace function public._push_cage() returns void language plpgsql security definer set search_path = public as $$
declare r record; d date := (now() at time zone 'Asia/Taipei')::date;
begin
  for r in select id from public.players where jsonb_array_length(cage) > 0 and (cage_fed is null or cage_fed <> d) loop
    perform public._push(r.id, 'cage', '🐟 箱網還沒餵', '你的箱網今天還沒餵，餵了魚才會長大。');
  end loop;
end $$;
revoke all on function public._push_tourney() from public, anon, authenticated;
revoke all on function public._push_cage() from public, anon, authenticated;

-- 排程（pg_cron＋pg_net）：大賽提醒、箱網提醒、每分鐘叫 Edge Function 把通知送出去。這個專案沒有開這兩個擴充功能的話會略過，不影響其他設定
do $$
declare sec text; url text := 'https://mfaskrjcxofwkusrzkhb.supabase.co/functions/v1/tide-push';
begin
  begin create extension if not exists pg_cron; exception when others then raise notice '沒辦法開 pg_cron：%', sqlerrm; end;
  begin create extension if not exists pg_net; exception when others then raise notice '沒辦法開 pg_net：%', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select secret into sec from public.push_secret where id = 1;
    perform cron.schedule('tide-push-tourney', '50 3,10,12 * * *', 'select public._push_tourney()');
    perform cron.schedule('tide-push-cage', '0 12 * * *', 'select public._push_cage()');
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      perform cron.schedule('tide-push-flush', '* * * * *', format($f$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L), body := '{"action":"flush"}'::jsonb) where exists (select 1 from public.push_queue where sent_at is null)$f$, url, sec));
    end if;
    raise notice '推播排程設定好了';
  end if;
exception when others then raise notice '排程沒有設定：%', sqlerrm;
end $$;

select '推播通知設定完成 🔔' as result;
