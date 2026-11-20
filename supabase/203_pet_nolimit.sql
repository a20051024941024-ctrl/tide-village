-- 潮汐釣魚村 v606：寵物不限數量（可以重複執行）
-- 作者：「不應該限制包包裡寵物的數量吧」。以前一般 3 隻＋圍欄每個多 5 隻（149、153）；現在想養幾隻都可以。
-- 只留一個技術上的保護：一個人最多 200 隻（避免有人用程式灌爆資料庫），正常玩不會碰到。
-- 圍欄、海水池、烏龜缸照舊是寵物在家住的地方（待在家的寵物會在裡面玩），只是不再算名額；拆圍欄也不會被擋。
create or replace function public._pet_fit(p_owner uuid, p_kind text) returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.pets where owner = p_owner) < 200 $$;
revoke all on function public._pet_fit(uuid, text) from public, anon, authenticated;

create or replace function public._pen_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin return new; end $$;
