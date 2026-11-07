-- 106 廣場留言板（v262）：大家都可以留言，最新的 40 則給所有人看。可以重複執行。
-- 防亂留：要釣過 5 條魚才能留言；每人 60 秒一則、一天最多 5 則；一則最多 60 個字；有髒話不收（跟設計名字同一份 _name_bad）。
-- 公開的欄位只有：編號、暱稱、內容、時間、是不是自己留的（不給 uid）。
-- 檢舉：釣過 50 條魚的人檢舉才算，3 個人檢舉就收起來；自己留的可以自己刪。
create table if not exists public.board_posts (id bigserial primary key, uid uuid not null, name text not null, body text not null, at timestamptz not null default now(), hidden boolean not null default false);
create index if not exists board_posts_at on public.board_posts (at desc);
create index if not exists board_posts_uid on public.board_posts (uid, at desc);
alter table public.board_posts enable row level security;
create table if not exists public.board_reports (post_id bigint not null, uid uuid not null, at timestamptz not null default now(), primary key (post_id, uid));
alter table public.board_reports enable row level security;

create or replace function public.board_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'n', name, 'b', body, 'at', at, 'me', uid = auth.uid()) order by at desc), '[]'::jsonb)
  from (select * from public.board_posts where not hidden order by at desc limit 40) x $$;

create or replace function public.board_post(p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text := left(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'), 60);
begin
  if t = '' then raise exception '要寫點東西喔'; end if;
  if coalesce(pl.total, 0) < 5 then raise exception '先釣 5 條魚才能在留言板留言'; end if;
  if public._name_bad(t) then raise exception '這句話不行，換個說法吧'; end if;
  if exists (select 1 from public.board_posts where uid = pl.id and at > now() - interval '60 seconds') then raise exception '留太快了，等一分鐘再留'; end if;
  if (select count(*) from public.board_posts where uid = pl.id and at > now() - interval '1 day') >= 5 then raise exception '今天留夠多了，明天再來'; end if;
  insert into public.board_posts (uid, name, body) values (pl.id, left(coalesce(nullif(btrim(pl.nickname), ''), '釣客'), 16), t);
  return public.board_list();
end $$;

create or replace function public.board_del(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  delete from public.board_posts where id = p_id and uid = pl.id;
  return public.board_list();
end $$;

create or replace function public.board_report(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer;
begin
  if coalesce(pl.total, 0) < 50 then return jsonb_build_object('ok', false, 'msg', '謝謝回報！（釣過 50 條魚的人檢舉才會算數）'); end if;
  if exists (select 1 from public.board_posts where id = p_id and uid = pl.id) then raise exception '這是你自己留的，可以直接刪掉'; end if;
  insert into public.board_reports (post_id, uid) values (p_id, pl.id) on conflict do nothing;
  select count(*) into n from public.board_reports where post_id = p_id;
  if n >= 3 then update public.board_posts set hidden = true where id = p_id; end if;
  return jsonb_build_object('ok', true, 'msg', '收到了，謝謝你幫忙維持村子的秩序');
end $$;

revoke all on function public.board_list() from public, anon;
revoke all on function public.board_post(text) from public, anon;
revoke all on function public.board_del(bigint) from public, anon;
revoke all on function public.board_report(bigint) from public, anon;
grant execute on function public.board_list() to authenticated;
grant execute on function public.board_post(text) to authenticated;
grant execute on function public.board_del(bigint) to authenticated;
grant execute on function public.board_report(bigint) to authenticated;
