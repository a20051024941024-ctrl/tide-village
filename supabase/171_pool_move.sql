-- v489 地圖重新分區：山丘鏟平蓋居民區，瀑布潭（釣點代號 pool）搬到河的西岸，改名清溪潭。
-- 伺服器只用釣點座標算「魚的徵兆」的位置（_sign_hit），所以把 _fishcfg 裡 pool 的座標換成新的；魚的清單、代號都不變。
-- 做法：把現有的 _fishcfg 函式定義拿出來，換掉那一小段座標再建回去（不用整份重貼）。已經換過就不會再動。
do $$
declare d text;
begin
  select pg_get_functiondef('public._fishcfg()'::regprocedure) into d;
  if position('"pool":{"x":-26.2,"z":5.4,' in d) > 0 then
    d := replace(d, '"pool":{"x":-26.2,"z":5.4,', '"pool":{"x":-29.5,"z":-29,');
    execute d;
  end if;
end $$;
