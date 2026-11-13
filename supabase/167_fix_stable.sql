-- 167 修正：跑船生意一直「載入中」、釣友隊「我的隊伍」讀不到（v435）。可以重複執行。
-- 原因：cargo_info() 和 team_my() 標成 stable（只讀），但它們呼叫的 _me() 會寫入（第一次登入時建玩家資料、鎖定那一列），
--       Postgres 不准只讀的函式做寫入，所以每次呼叫都直接失敗。改回一般（volatile）函式就好，內容不變。
alter function public.cargo_info() volatile;
alter function public.team_my() volatile;
