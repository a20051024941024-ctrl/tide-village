-- 潮汐釣魚村 v368：拿掉大廳聊天紀錄（可以重複執行）
-- 使用者說不需要「上線先看到 3 小時前的對話」：146 存的聊天全部刪掉，伺服器回到「不保存聊天紀錄」。
drop function if exists public.chat_post(integer, text, integer);
drop function if exists public.chat_history(integer);
drop table if exists public.chat_recent;
select '大廳聊天紀錄已經拿掉 🧹' as result;
