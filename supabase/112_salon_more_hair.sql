-- 112 阿萍又設計了 9 款髮型（v279）：八字瀏海、法式瀏海、鎖骨髮、低馬尾、空氣瀏海、內扣髮、蛋捲頭、低丸子頭、高顱頂半扎（編號 22～30），一樣每兩天多一款。已經買的都不變。可以重複執行。
create or replace function public._salon_hs_max() returns integer language sql immutable as $$ select 30 $$;
