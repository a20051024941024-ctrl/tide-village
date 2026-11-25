-- 227 📊 玩家人數（v833，只讀、不改任何資料；可以重複執行）。每次部署時在「套用資料庫設定」的紀錄印一行，讓作者知道實際有多少人在玩。
-- 「玩過」＝ updated_at 在那段時間內有變（釣魚、買東西、存檔都會更新）。
select '玩家人數 📊：全部 ' || count(*)
    || ' 人；釣過 10 條以上 ' || count(*) filter (where total >= 10)
    || '；最近 1 天有玩 ' || count(*) filter (where updated_at > now() - interval '1 day')
    || '；最近 7 天 ' || count(*) filter (where updated_at > now() - interval '7 days')
    || '；最近 30 天 ' || count(*) filter (where updated_at > now() - interval '30 days')
    || '；最近 30 天新來的 ' || count(*) filter (where created_at > now() - interval '30 days')
    || '（其中 7 天後還有回來玩的 ' || count(*) filter (where created_at > now() - interval '30 days' and created_at < now() - interval '7 days' and updated_at > created_at + interval '7 days') || '）' as result
from public.players;
