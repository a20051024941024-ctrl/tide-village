-- v368 已經不用了：147_chat_recent_off.sql 會把這裡建的東西刪掉（GitHub 會依序執行，所以這個檔案保留，但 147 一定跑在後面）
-- 潮汐釣魚村 v367：大廳聊天留 24 小時（可以重複執行）
-- 以前聊天只即時傳出去，晚一點上線的人看不到前面大家說了什麼。
-- 現在「🌐 全部」聊天會同時存一份在伺服器（只存每個大廳最近 24 小時、最多 200 句），剛上線、換大廳的人會先看到最近的對話。
--   「📍 附近」聊天不存。被禁言的人不存。兒童帳號只能存固定句子（q 是句子的編號）。刪除帳號時一起刪掉。
--   手機上還是會照「封鎖」「陌生人的字先藏起來」「兒童安全模式」的設定過濾。

create table if not exists public.chat_recent (
  id bigserial primary key, lobby integer not null, uid uuid not null references public.players(id) on delete cascade,
  name text not null default '', t text not null, q smallint, at timestamptz not null default now());
create index if not exists chat_recent_lobby_at on public.chat_recent (lobby, at desc);
alter table public.chat_recent enable row level security;
revoke all on public.chat_recent from anon, authenticated;

create or replace function public.chat_post(p_lobby integer, p_t text, p_q integer default null) returns boolean language plpgsql security definer set search_path = public as $$
declare pl public.players; n integer;
begin
  if auth.uid() is null or p_lobby is null or p_lobby < 0 or p_lobby > 999 then return false; end if;
  select * into pl from public.players where id = auth.uid(); if not found then return false; end if;
  if exists (select 1 from public.muted m where m.user_id = pl.id and m.until > now()) then return false; end if;
  if pl.kid and p_q is null then return false; end if;   -- 兒童帳號只能用固定句子
  if coalesce(length(trim(p_t)), 0) = 0 then return false; end if;
  select count(*) into n from public.chat_recent where uid = pl.id and at > now() - interval '6 seconds';
  if n >= 4 then return false; end if;   -- 說太快的不存
  insert into public.chat_recent (lobby, uid, name, t, q) values (p_lobby, pl.id, left(coalesce(nullif(pl.nickname, ''), '釣客'), 16), left(p_t, 120), case when p_q between 0 and 99 then p_q end);
  delete from public.chat_recent where at < now() - interval '24 hours';
  delete from public.chat_recent where lobby = p_lobby and id < (select min(id) from (select id from public.chat_recent where lobby = p_lobby order by id desc limit 200) x);
  return true;
end $$;

-- 剛上線的人：這個大廳最近 3 小時、最多 40 句（舊的在前面）
create or replace function public.chat_history(p_lobby integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('u', c.uid, 'n', c.name, 't', c.t, 'q', c.q, 'at', c.at) order by c.id), '[]'::jsonb)
  from (select * from public.chat_recent where lobby = p_lobby and at > now() - interval '3 hours'
        and not exists (select 1 from public.muted m where m.user_id = chat_recent.uid and m.until > now()) order by id desc limit 40) c $$;

do $$ declare f text; begin
  foreach f in array array['chat_post(integer,text,integer)', 'chat_history(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '大廳聊天紀錄設定完成 💬' as result;
