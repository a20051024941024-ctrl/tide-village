-- 伺服器狀況報告：每天自動跑的排程（pg_cron）最近一次有沒有成功（只讀）
\pset format unaligned
\pset tuples_only on
select '## ⏰ 自動排程' || chr(10) || chr(10) || '| 排程 | 時間 | 最近一次 | 結果 | 最近 24 小時失敗 |' || chr(10) || '|---|---|---|---|---|' || chr(10) ||
  string_agg('| ' || j.jobname || ' | `' || j.schedule || '` | ' || coalesce(to_char(r.start_time at time zone 'Asia/Taipei', 'MM/DD HH24:MI'), '還沒跑過') || ' | ' ||
    case when r.status = 'succeeded' then '✅' when r.status is null then '—' else '❌ ' || left(coalesce(r.return_message, r.status), 60) end || ' | ' ||
    (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours') || ' |', chr(10) order by j.jobname) || chr(10)
from cron.job j
left join lateral (select * from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) r on true;
