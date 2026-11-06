-- 101 藍鯨浮上來改成每小時一次（v244）：可以重複執行
-- 原本每 20 分鐘有 90 秒（020 的 _bw_up），玩家覺得太常出現；改成每小時一次。畫面上的 bwWin（js/game.js）用一樣的公式。
create or replace function public._bw_up() returns boolean language sql stable as $$
  select (s - c * 3600 - ((c * 2654435761) % 4294967296) % 3420) between 0 and 89
  from (select floor(extract(epoch from now()))::bigint as s, floor(extract(epoch from now()) / 3600)::bigint as c) x $$;
