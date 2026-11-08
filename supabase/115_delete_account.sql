-- 115 刪除我的帳號（v288，Google Play 規定）：玩家自己在設定裡刪除。可以重複執行。
-- 不需要 service_role 金鑰：這個函式由資料庫擁有者建立（security definer），只能刪「呼叫的人自己」（auth.uid()）。
-- 做的事：留言板的留言改成「已刪除的玩家」，其他所有跟這個人有關的遊戲資料（public 裡任何 uuid 欄位等於他的 id 的列）全部刪掉，最後刪掉登入帳號。
alter table public.board_posts alter column uid drop not null;
create or replace function public.delete_my_account(p_confirm text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r record; n integer := 0; k integer;
begin
  if v_uid is null then raise exception '要登入才能刪除'; end if;
  if p_confirm is distinct from '刪除' then raise exception '請輸入「刪除」兩個字'; end if;
  update public.board_posts set name = '已刪除的玩家', uid = null where uid = v_uid;
  -- 先刪掉其他表，最後才刪 players（其他表有外鍵指到 players）
  for r in select c.table_name t, c.column_name col from information_schema.columns c join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
           where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.data_type = 'uuid' and c.table_name <> 'players' order by c.table_name loop
    begin execute format('delete from public.%I where %I = $1', r.t, r.col) using v_uid; get diagnostics k = row_count; n := n + k;
    exception when others then null; end;
  end loop;
  delete from public.players where id = v_uid; get diagnostics k = row_count; n := n + k;
  delete from auth.users where id = v_uid;
  return jsonb_build_object('ok', true, 'rows', n);
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- 檢舉時附上的聊天內容只保存 30 天（隱私權政策寫的）：每次有新檢舉時順便清掉 30 天前的
create or replace function public._purge_old_reports() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.reports where created_at < now() - interval '30 days';
  return null;
end $$;
drop trigger if exists reports_purge on public.reports;
create trigger reports_purge after insert on public.reports for each statement execute function public._purge_old_reports();
