-- 潮汐釣魚村：伺服器狀況報告（只讀資料，不會改任何東西）
-- 給 .github/workflows/server-report.yml 用：每一段印出 Markdown，貼到 GitHub Actions 的摘要頁。
\pset format unaligned
\pset tuples_only on

select '## 🗄️ 資料庫大小' || chr(10) || chr(10) ||
  '目前 **' || pg_size_pretty(pg_database_size(current_database())) || '**，免費方案上限 500 MB，用了 **' ||
  round(pg_database_size(current_database()) * 100.0 / (500 * 1024 * 1024), 1) || '%**' ||
  case when pg_database_size(current_database()) > 400 * 1024 * 1024 then chr(10) || chr(10) || '> ⚠️ 已經超過 80%，要開始清資料或考慮升級了' else '' end || chr(10);

select '### 最大的 10 張表' || chr(10) || chr(10) || '| 表 | 大小 | 筆數（估計） |' || chr(10) || '|---|---|---|' || chr(10) ||
  string_agg('| ' || relname || ' | ' || pg_size_pretty(pg_total_relation_size(c.oid)) || ' | ' || greatest(c.reltuples, 0)::bigint || ' |', chr(10) order by pg_total_relation_size(c.oid) desc) || chr(10)
from (select c.* from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 10) c;

select '## 👥 玩家' || chr(10) || chr(10) || '| 項目 | 人數 |' || chr(10) || '|---|---|' || chr(10) ||
  '| 全部玩家 | ' || count(*) || ' |' || chr(10) ||
  '| 今天有上線（台灣時間） | ' || count(*) filter (where updated_at >= (date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')) || ' |' || chr(10) ||
  '| 最近 7 天有上線 | ' || count(*) filter (where updated_at >= now() - interval '7 days') || ' |' || chr(10) ||
  '| 最近 30 天有上線 | ' || count(*) filter (where updated_at >= now() - interval '30 days') || ' |' || chr(10) ||
  '| 今天新來的 | ' || count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')) || ' |' || chr(10) ||
  '| 綁了 Email 的 | ' || (select count(*) from auth.users u where (to_jsonb(u)->>'email') is not null) || ' |' || chr(10) ||
  '| 有蓋房子的 | ' || count(*) filter (where island::text like '%"cabin"%' or island::text like '%"beach"%' or island::text like '%"villa"%' or island::text like '%"tea"%' or island::text like '%"mansion"%') || ' |' || chr(10) ||
  '| 全部玩家總共釣了 | ' || coalesce(sum(total), 0) || ' 條 |' || chr(10)
from public.players;

select '## 🎣 今天' || chr(10) || chr(10) ||
  '- 今天釣上來：**' || coalesce((select sum(n) from public.news_daily where day = (now() at time zone 'Asia/Taipei')::date), 0) || '** 條' || chr(10) ||
  '- 蔚博士今天的新品種：' || coalesce((select name || '（' || coalesce(public._sci_spots()->spot->>'label', spot) || '）' from public.sci_finds where day = (now() at time zone 'Asia/Taipei')::date), '還沒發現') ||
  '，到今天一共發現 ' || (select count(*) from public.sci_finds) || ' 種' || chr(10) ||
  '- 釣客魚市上架中：' || coalesce((select count(*) from public.fish_market where status = 'open'), 0) || ' 條' || chr(10) ||
  '- 設計師市集：' || (select count(*) from public.designs where listed and not hidden) || ' 件上架中' || chr(10) ||
  '- 海裡的紅鯊：' || coalesce((select count(*) from public.red_sharks where status = 'sea'), 0) || ' 隻' || chr(10);
