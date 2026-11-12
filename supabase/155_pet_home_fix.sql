-- 潮汐釣魚村 v400：寵物「回家」修正（可以重複執行）
-- 玩家回報：帶著小烏龜去烏龜缸按「放進去」一直跳「暫時連不上雲端」。
-- 原因：讓寵物回家時傳的是 null，「out = (id = null)」算出來是 null，違反 out 不能是空的規定，整個失敗（寵物頁的「回家」也一樣）。
create or replace function public.pet_out(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_id is not null and not exists (select 1 from public.pets where id = p_id and owner = auth.uid()) then raise exception '找不到這隻寵物'; end if;
  if p_id is not null and exists (select 1 from public.pets where id = p_id and price is not null) then raise exception '掛在市集賣的寵物不能帶出門，先收回來'; end if;
  update public.pets set out = (p_id is not null and id = p_id) where owner = auth.uid();
  return public.pet_list();
end $$;
