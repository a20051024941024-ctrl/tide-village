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

-- v357 上架前要看的數據：每天上線人數、新玩家留不留得住、新手卡在哪
select '## 📈 最近 30 天（每天）' || chr(10) || chr(10) || '> 從 2026/11/10 開始記錄，之前的日子沒有資料。隔天回來＝那天新來的人裡，第二天還有上線的比例。' || chr(10) || chr(10) ||
  '| 日期 | 上線人數 | 新玩家 | 隔天回來 | 第 7 天回來 | 有玩的小時數（粗估） |' || chr(10) || '|---|---|---|---|---|---|' || chr(10) ||
  coalesce(string_agg('| ' || to_char(d.day, 'MM/DD') || ' | ' || d.dau || ' | ' || d.newp || ' | ' ||
    case when d.day >= t.today or d.newp = 0 then '–' else d.r1 || '（' || round(d.r1 * 100.0 / d.newp) || '%）' end || ' | ' ||
    case when d.day > t.today - 7 or d.newp = 0 then '–' else d.r7 || '（' || round(d.r7 * 100.0 / d.newp) || '%）' end || ' | ' || d.hrs || ' |', chr(10) order by d.day desc), '| （還沒有資料） | | | | | |') || chr(10)
from (select (now() at time zone 'Asia/Taipei')::date as today) t,
  lateral (select a.day, count(*) as dau, round(avg(a.hrs), 1) as hrs,
      count(*) filter (where (p.created_at at time zone 'Asia/Taipei')::date = a.day) as newp,
      count(*) filter (where (p.created_at at time zone 'Asia/Taipei')::date = a.day and exists (select 1 from public.metrics_active b where b.uid = a.uid and b.day = a.day + 1)) as r1,
      count(*) filter (where (p.created_at at time zone 'Asia/Taipei')::date = a.day and exists (select 1 from public.metrics_active b where b.uid = a.uid and b.day between a.day + 6 and a.day + 8)) as r7
    from public.metrics_active a join public.players p on p.id = a.uid where a.day > t.today - 30 group by a.day) d;

select '## 🧭 最近 30 天的新玩家，走到哪一步' || chr(10) || chr(10) || '| 步驟 | 人數 | 比例 |' || chr(10) || '|---|---|---|' || chr(10) ||
  string_agg('| ' || r.label || ' | ' || r.c || ' | ' || case when s.n > 0 then round(r.c * 100.0 / s.n) || '%' else '–' end || ' |', chr(10) order by r.ord) || chr(10)
from (select count(*) as n, count(*) filter (where total >= 1) as c1, count(*) filter (where total >= 5) as c5, count(*) filter (where sold > 0) as sold,
    count(*) filter (where array_length(rods, 1) >= 2) as rod2, count(*) filter (where guide_done) as guide, count(*) filter (where total >= 50) as c50,
    count(*) filter (where kid) as kids,
    count(*) filter (where exists (select 1 from auth.users u where u.id = p.id and (to_jsonb(u)->>'email') is not null)) as em
  from public.players p where created_at >= now() - interval '30 days') s
  cross join lateral (values (1, '開始玩', s.n), (2, '釣到第一條魚', s.c1), (3, '釣到 5 條', s.c5), (4, '賣過魚', s.sold), (5, '買了第二支釣竿', s.rod2),
    (6, '新手任務全部做完', s.guide), (7, '釣到 50 條', s.c50), (8, '綁定 Email', s.em), (9, '兒童模式（13 歲以下）', s.kids)) as r(ord, label, c);

\echo
\echo '## 🛋️ 家具檢查（屋子裡有沒有伺服器不認得的家具）'
\echo
select '室內烏龜缸設定' as 項目, (public._furn('turtletank')).price::text || ' 金幣、半徑 ' || (public._furn('turtletank')).rad::text as 值
union all select '_furn 版本數', count(*)::text from pg_proc where proname = '_furn'
union all select '不認得：' || coalesce(x->>'t', '(空白)'), count(*)::text from public.players p, jsonb_array_elements(case when jsonb_typeof(p.island->'items') = 'array' then p.island->'items' else '[]' end) h, jsonb_array_elements(case when jsonb_typeof(h->'f') = 'array' then h->'f' else '[]' end) x where (public._furn(x->>'t')).price is null group by x->>'t';
