-- 潮汐釣魚村 v5xx：自動回報「暫時連不上雲端」的真正原因（可以重複執行）
-- 玩家問「為什麼一直暫時連不到雲端」：伺服器回的錯誤如果不是中文（程式的錯，不是故意擋的），遊戲只會說「暫時連不上雲端」，我們也看不到是哪裡壞。
-- 現在遊戲會把「哪個動作、伺服器回了什麼錯」自動送到這張表，伺服器報告（tools/server_report.sql）每天列出最多的錯誤，就知道要修哪裡。
-- 只記動作名稱和錯誤訊息（最多 300 字），不記聊天內容；同一個人同一個錯誤 10 分鐘內只算次數；每人每小時最多 30 筆；兩週前的自動刪掉。
create table if not exists public.client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  uid uuid,
  fn text not null,
  msg text not null,
  ver text,
  n integer not null default 1
);
create index if not exists client_errors_at on public.client_errors (at);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.log_client_error(p_fn text, p_msg text, p_ver text default null) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); f text := left(coalesce(p_fn, '?'), 60); m text := left(coalesce(p_msg, ''), 300); hit bigint;
begin
  if u is null then return; end if;
  if (select count(*) from public.client_errors where uid = u and at > now() - interval '1 hour') >= 30 then return; end if;
  select id into hit from public.client_errors where uid = u and fn = f and msg = m and at > now() - interval '10 minutes' order by id desc limit 1;
  if hit is not null then update public.client_errors set n = n + 1 where id = hit; return; end if;
  insert into public.client_errors (uid, fn, msg, ver) values (u, f, m, left(p_ver, 20));
  if random() < 0.02 then delete from public.client_errors where at < now() - interval '14 days'; end if;
end $$;
revoke all on function public.log_client_error(text, text, text) from public, anon;
grant execute on function public.log_client_error(text, text, text) to authenticated;
