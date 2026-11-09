-- 潮汐釣魚村 v312：管理頁 admin.html（處理檢舉、禁言、改名、下架設計和留言、操作紀錄）＋有新檢舉時推播給管理員（可以重複執行）
-- 管理員名單在 public.admins，只有在 Supabase 後台 SQL Editor 才能加人（步驟寫在 admin.html 最下面和 README）。
-- 所有管理用的函式第一行都會檢查 is_admin()，不是管理員就直接擋掉；玩家讀不到 admins、admin_log。

create table if not exists public.admins (user_id uuid primary key, note text, added_at timestamptz not null default now());
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create table if not exists public.admin_log (
  id bigserial primary key, admin uuid not null, admin_name text, action text not null, target text, target_name text, note text, at timestamptz not null default now());
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;
create index if not exists admin_log_at on public.admin_log (at desc);

alter table public.reports add column if not exists status text not null default 'open';
alter table public.reports add column if not exists handled_by uuid;
alter table public.reports add column if not exists handled_at timestamptz;
alter table public.reports add column if not exists handled_note text;
create index if not exists reports_open on public.reports (created_at desc) where status = 'open';

-- 被管理員改名：這段時間內玩家自己不能改回來
alter table public.players add column if not exists name_lock timestamptz;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.admins where user_id = auth.uid()) $$;

create or replace function public._admin_check() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '你不是管理員'; end if;
  return auth.uid();
end $$;

create or replace function public._admin_log(p_action text, p_target text, p_target_name text, p_note text) returns void language sql security definer set search_path = public as $$
  insert into public.admin_log (admin, admin_name, action, target, target_name, note)
  values (auth.uid(), (select nickname from public.players where id = auth.uid()), p_action, p_target, left(p_target_name, 40), left(p_note, 200)) $$;

-- 首頁數字
create or replace function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return jsonb_build_object(
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'reports_today', (select count(*) from public.reports where created_at > now() - interval '1 day'),
    'muted', (select count(*) from public.muted where until > now()),
    'designs_hidden', (select count(*) from public.designs where hidden),
    'designs_reported', (select count(distinct design) from public.design_reports where created_at > now() - interval '7 days'),
    'board_hidden', (select count(*) from public.board_posts where hidden),
    'players', (select count(*) from public.players),
    'players_today', (select count(*) from public.players where updated_at > now() - interval '1 day'));
end $$;

-- 檢舉清單（open／done／all），附上被檢舉的人最近 30 天被檢舉幾次、現在的名字、有沒有被禁言
create or replace function public.admin_reports(p_status text default 'open', p_limit integer default 100) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select r.id, r.created_at as at, r.reason, r.chat, r.status, r.handled_note as note, r.target, coalesce(t.nickname, r.target_name) as target_name, r.target_name as name_then,
      r.reporter, rp.nickname as reporter_name, coalesce(rp.total, 0) as reporter_total,
      (select count(*) from public.reports r2 where r2.target = r.target and r2.created_at > now() - interval '30 days') as target_n30,
      (select m.until from public.muted m where m.user_id = r.target and m.until > now()) as muted_until
    from public.reports r left join public.players t on t.id = r.target left join public.players rp on rp.id = r.reporter
    where p_status = 'all' or r.status = p_status order by r.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 300)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_report_close(p_id bigint, p_note text) returns boolean language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  perform public._admin_check();
  update public.reports set status = 'done', handled_by = auth.uid(), handled_at = now(), handled_note = left(coalesce(p_note, ''), 200) where id = p_id returning * into r;
  if not found then return false; end if;
  perform public._admin_log('檢舉處理完', r.target::text, r.target_name, '檢舉 #' || p_id || coalesce('：' || nullif(p_note, ''), ''));
  return true;
end $$;

-- 同一個人的檢舉一次全部處理完
create or replace function public.admin_reports_close_target(p_target uuid, p_note text) returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public._admin_check();
  update public.reports set status = 'done', handled_by = auth.uid(), handled_at = now(), handled_note = left(coalesce(p_note, ''), 200) where target = p_target and status = 'open';
  get diagnostics n = row_count;
  perform public._admin_log('檢舉處理完', p_target::text, (select nickname from public.players where id = p_target), n || ' 筆' || coalesce('：' || nullif(p_note, ''), ''));
  return n;
end $$;

-- 禁言（小時；0 = 解除）
create or replace function public.admin_mute(p_uid uuid, p_hours integer, p_note text) returns timestamptz language plpgsql security definer set search_path = public as $$
declare u timestamptz; nm text := (select nickname from public.players where id = p_uid);
begin
  perform public._admin_check();
  if p_uid = auth.uid() then raise exception '不能禁言自己'; end if;
  if coalesce(p_hours, 0) <= 0 then
    delete from public.muted where user_id = p_uid;
    perform public._admin_log('解除禁言', p_uid::text, nm, p_note);
    return null;
  end if;
  u := now() + make_interval(hours => least(p_hours, 24 * 365));
  insert into public.muted (user_id, until, note) values (p_uid, u, left(coalesce(p_note, ''), 200))
  on conflict (user_id) do update set until = excluded.until, note = excluded.note;
  perform public._admin_log('禁言 ' || p_hours || ' 小時', p_uid::text, nm, p_note);
  return u;
end $$;

-- 改名：名字不適合時改成「釣客＋編號」或管理員填的名字，30 天內玩家不能自己改回來
create or replace function public.admin_rename(p_uid uuid, p_name text, p_note text) returns text language plpgsql security definer set search_path = public as $$
declare old text; nn text := left(btrim(coalesce(p_name, '')), 16);
begin
  perform public._admin_check();
  select nickname into old from public.players where id = p_uid;
  if not found then raise exception '找不到這位玩家'; end if;
  if nn = '' then nn := '釣客' || (floor(random() * 9000) + 1000)::int; end if;
  update public.players set nickname = nn, name_lock = now() + interval '30 days', updated_at = now() where id = p_uid;
  perform public._admin_log('改名', p_uid::text, old, '改成「' || nn || '」' || coalesce('：' || nullif(p_note, ''), ''));
  return nn;
end $$;

-- 玩家自己改名時，被管理員改過名字的 30 天內不收（其他欄位照舊）
create or replace function public.set_profile(p_nick text, p_shirt text, p_hat text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  p_nick := left(btrim(coalesce(p_nick, '')), 16);
  update public.players set
    nickname = case when p_nick = '' or (name_lock is not null and name_lock > now()) then nickname else p_nick end,
    shirt = case when p_shirt ~ '^#[0-9a-fA-F]{6}$' then p_shirt else shirt end,
    hat   = case when p_hat   ~ '^#[0-9a-fA-F]{6}$' then p_hat   else hat end,
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 找玩家（名字部分符合，或貼上完整 id）
create or replace function public.admin_players(p_q text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := btrim(coalesce(p_q, ''));
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x) from (
    select p.id, p.nickname, p.total, p.updated_at as at, p.name_lock,
      (select m.until from public.muted m where m.user_id = p.id and m.until > now()) as muted_until,
      (select count(*) from public.reports r where r.target = p.id) as reports
    from public.players p
    where (q ~ '^[0-9a-f-]{36}$' and p.id = q::uuid) or (q <> '' and q !~ '^[0-9a-f-]{36}$' and p.nickname ilike '%' || replace(replace(q, '%', ''), '_', '') || '%')
    order by p.updated_at desc limit 30) x), '[]'::jsonb);
end $$;

-- 被禁言中的人
create or replace function public.admin_muted() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x order by x.until desc) from (
    select m.user_id as id, p.nickname, m.until, m.note from public.muted m left join public.players p on p.id = m.user_id where m.until > now()) x), '[]'::jsonb);
end $$;

-- 被檢舉或被收起來的設計
create or replace function public.admin_designs() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x order by x.last desc nulls last) from (
    select d.id, d.name, d.kind, d.owner, d.owner_name, d.hidden, d.listed,
      (select count(*) from public.design_reports r where r.design = d.id) as n,
      (select max(r.created_at) from public.design_reports r where r.design = d.id) as last,
      (select string_agg(distinct nullif(r.reason, ''), '、') from public.design_reports r where r.design = d.id) as reasons
    from public.designs d where d.hidden or exists (select 1 from public.design_reports r where r.design = d.id)
    order by last desc nulls last limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.admin_design_hide(p_id integer, p_hidden boolean, p_note text) returns boolean language plpgsql security definer set search_path = public as $$
declare d public.designs;
begin
  perform public._admin_check();
  update public.designs set hidden = coalesce(p_hidden, true) where id = p_id returning * into d;
  if not found then return false; end if;
  if not coalesce(p_hidden, true) then delete from public.design_reports where design = p_id; end if;   -- 放回去就把舊檢舉清掉，免得又被自動收起來
  perform public._admin_log(case when coalesce(p_hidden, true) then '設計下架' else '設計放回' end, 'design:' || p_id, d.name, p_note);
  return true;
end $$;

-- 留言板：被檢舉或收起來的留言
create or replace function public.admin_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select b.id, b.uid, b.name, b.body, b.at, b.hidden, (select count(*) from public.board_reports r where r.post_id = b.id) as n
    from public.board_posts b where b.hidden or exists (select 1 from public.board_reports r where r.post_id = b.id) or b.at > now() - interval '2 days'
    order by b.at desc limit 150) x), '[]'::jsonb);
end $$;

create or replace function public.admin_board_hide(p_id bigint, p_hidden boolean, p_note text) returns boolean language plpgsql security definer set search_path = public as $$
declare b public.board_posts;
begin
  perform public._admin_check();
  update public.board_posts set hidden = coalesce(p_hidden, true) where id = p_id returning * into b;
  if not found then return false; end if;
  if not coalesce(p_hidden, true) then delete from public.board_reports where post_id = p_id; end if;
  perform public._admin_log(case when coalesce(p_hidden, true) then '留言收起來' else '留言放回' end, b.uid::text, b.name, left(b.body, 60) || coalesce('：' || nullif(p_note, ''), ''));
  return true;
end $$;

create or replace function public.admin_log_list(p_limit integer default 100) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select id, at, admin_name, action, target, target_name, note from public.admin_log order by at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x), '[]'::jsonb);
end $$;

-- 有新檢舉 → 推播給每一位管理員（同一位管理員 10 分鐘內合併成一則，靠 _push 本來的合併）
create or replace function public._report_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in select user_id from public.admins loop
    perform public._push(a.user_id, 'report', '🚩 有新的檢舉', '「' || coalesce(new.target_name, '某位玩家') || '」被檢舉：' || coalesce(new.reason, '') || '。打開管理頁處理');
  end loop;
  return new;
exception when others then return new;   -- 推播失敗不能讓檢舉失敗
end $$;
drop trigger if exists reports_notify on public.reports;
create trigger reports_notify after insert on public.reports for each row execute function public._report_notify();

-- 設計、留言被自動收起來時也通知管理員
create or replace function public._hidden_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare a record; what text := case when tg_table_name = 'designs' then '設計「' || new.name || '」' else '留言「' || left(new.body, 20) || '」' end;
begin
  if new.hidden and not coalesce(old.hidden, false) and not public.is_admin() then
    for a in select user_id from public.admins loop
      perform public._push(a.user_id, 'report', '🙈 有東西被檢舉到自動收起來', what || '被 3 個人檢舉，已經自動收起來了。打開管理頁看看');
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists designs_hidden_notify on public.designs;
create trigger designs_hidden_notify after update of hidden on public.designs for each row execute function public._hidden_notify();
drop trigger if exists board_hidden_notify on public.board_posts;
create trigger board_hidden_notify after update of hidden on public.board_posts for each row execute function public._hidden_notify();

do $$ declare f text; begin
  foreach f in array array['_admin_check()', '_admin_log(text,text,text,text)', '_report_notify()', '_hidden_notify()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['is_admin()', 'admin_overview()', 'admin_reports(text,integer)', 'admin_report_close(bigint,text)', 'admin_reports_close_target(uuid,text)',
    'admin_mute(uuid,integer,text)', 'admin_rename(uuid,text,text)', 'admin_players(text)', 'admin_muted()', 'admin_designs()', 'admin_design_hide(integer,boolean,text)',
    'admin_board()', 'admin_board_hide(bigint,boolean,text)', 'admin_log_list(integer)', 'set_profile(text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '管理頁設定完成 🛡️' as result;
