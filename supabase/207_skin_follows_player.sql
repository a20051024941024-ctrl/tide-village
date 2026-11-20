-- 潮汐釣魚村 v635：釣具改版第一次——竿子造型跟著人走（可以重複執行）
-- 作者的計畫「釣具大改版」：做好一個造型，換哪支竿都還在；不裝造型的時候竿子是那個種類的顏色。
-- 159 的觸發器在換竿時會換成那支竿子記住的造型 → 改成換竿時造型不變（rod_skins 留著不刪，只是不再用）。
create or replace function public._rod_skin_sync() returns trigger language plpgsql as $$
begin
  if new.rod_skin is not null and not (new.rod_skin = any(coalesce(new.owned, '{}'))) then new.rod_skin := null; end if;
  return new;
end $$;
