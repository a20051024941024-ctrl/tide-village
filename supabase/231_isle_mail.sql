-- 231 📮 小島信箱＋訪客數（v853，作者 11/26 說好：人少、大家不一定同時在線上 → 不用同時在線也能互動）。可以重複執行。
-- ・別人來你的島，可以投一張明信片：一個圖案＋一句話（最多 40 字，擋髒話）。兒童模式只能選固定句子（伺服器照編號換成句子）。
--   同一個人一天在同一座島最多投 3 張；明信片留 30 天、每座島最多留 50 張（舊的先清掉）。
-- ・島主看得到誰來過、留了什麼，可以刪除；檢舉走原本的 report_player。
-- ・訪客數：今天幾個人來過（visits 表，021）＋總共幾人次（新的 isle_visit_total，一個人一天算一次）。
create table if not exists public.isle_mail (
  id bigserial primary key,
  owner uuid not null references public.players(id) on delete cascade,
  sender uuid not null references public.players(id) on delete cascade,
  stamp text not null default '🐟',
  body text not null,
  at timestamptz not null default now(),
  seen boolean not null default false);
create index if not exists isle_mail_owner_idx on public.isle_mail (owner, at desc);
alter table public.isle_mail enable row level security;
revoke all on public.isle_mail from anon, authenticated;

create table if not exists public.isle_visit_total (owner uuid primary key references public.players(id) on delete cascade, n integer not null default 0);
alter table public.isle_visit_total enable row level security;
revoke all on public.isle_visit_total from anon, authenticated;

-- 一個人一天第一次來（visits 多一列）＝總數加一
create or replace function public._isle_visit_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'isle' then insert into public.isle_visit_total (owner, n) values (new.owner, 1) on conflict (owner) do update set n = isle_visit_total.n + 1; end if;
  return new;
end $$;
drop trigger if exists isle_visit_count on public.visits;
create trigger isle_visit_count after insert on public.visits for each row execute function public._isle_visit_count();

create or replace function public._mail_kid_q(i integer) returns text language sql immutable as $$
  select (array['你的島好漂亮！','下次一起釣魚！','謝謝招待 🐟','我來玩囉！','你的房子好可愛','我也想要這樣的島'])[i + 1] $$;

-- 投明信片
create or replace function public.isle_mail_send(p_owner uuid, p_stamp text, p_body text, p_q integer default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); b text; st text := coalesce(nullif(p_stamp, ''), '🐟'); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if p_owner is null or p_owner = pl.id then raise exception '不能投給自己'; end if;
  if not exists (select 1 from public.players where id = p_owner) then raise exception '找不到這座島'; end if;
  if st not in ('🐟', '🎣', '🌸', '👍', '🎉', '💙', '🏝️', '🦀') then st := '🐟'; end if;
  if pl.kid then b := public._mail_kid_q(coalesce(p_q, -1)); if b is null then raise exception '請選一句話'; end if;
  else b := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')); if char_length(b) < 1 then raise exception '寫一句話吧'; end if;
    if char_length(b) > 40 then b := left(b, 40); end if; if public._name_bad(b) then raise exception '這句話不太好，換一句吧'; end if; end if;
  if (select count(*) from public.isle_mail where owner = p_owner and sender = pl.id and (at at time zone 'Asia/Taipei')::date = d) >= 3 then raise exception '今天在這座島投了 3 張了，明天再來'; end if;
  insert into public.isle_mail (owner, sender, stamp, body) values (p_owner, pl.id, st, b);
  delete from public.isle_mail where owner = p_owner and (at < now() - interval '30 days' or id not in (select id from public.isle_mail where owner = p_owner order by at desc limit 50));
  begin perform public._push(p_owner, 'visit', '📮 有人在你的小島投了明信片', coalesce(nullif(pl.nickname, ''), '有人') || '：' || b); exception when others then null; end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.isle_mail_send(uuid, text, text, integer) from public, anon;
grant execute on function public.isle_mail_send(uuid, text, text, integer) to authenticated;

-- 我的信箱（打開就算看過了）
create or replace function public.isle_mail_list() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'stamp', m.stamp, 'body', m.body, 'at', m.at, 'new', not m.seen) order by m.at desc), '[]'::jsonb) into r
    from public.isle_mail m left join public.players p on p.id = m.sender where m.owner = pl.id and m.at > now() - interval '30 days';
  update public.isle_mail set seen = true where owner = pl.id and not seen;
  return r;
end $$;
revoke all on function public.isle_mail_list() from public, anon;
grant execute on function public.isle_mail_list() to authenticated;

create or replace function public.isle_mail_unread() returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.isle_mail where owner = auth.uid() and not seen and at > now() - interval '30 days' $$;
revoke all on function public.isle_mail_unread() from public, anon;
grant execute on function public.isle_mail_unread() to authenticated;

create or replace function public.isle_mail_del(p_id bigint) returns void language sql security definer set search_path = public as $$
  delete from public.isle_mail where id = p_id and owner = auth.uid() $$;
revoke all on function public.isle_mail_del(bigint) from public, anon;
grant execute on function public.isle_mail_del(bigint) to authenticated;

-- 任何人都可以看：這座島今天幾個人來過、總共幾人次
create or replace function public.isle_visit_count(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('today', (select count(*) from public.visits where owner = p_owner and kind = 'isle' and day = (now() at time zone 'Asia/Taipei')::date),
                            'total', coalesce((select n from public.isle_visit_total where owner = p_owner), 0)) $$;
revoke all on function public.isle_visit_count(uuid) from public, anon;
grant execute on function public.isle_visit_count(uuid) to authenticated;

select '小島信箱 📮 設定完成：' || (select count(*) from public.isle_mail) || ' 張明信片' as result;
