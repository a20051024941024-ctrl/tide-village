-- 潮汐釣魚村 v380：釣具店的「保養釣竿」（可以重複執行）
-- 釣竿不會壞。花 🪙200 保養一次，接下來 30 次拋竿收線快 10%、線比較不容易斷（拉力少 10%）。沒保養也照常釣，只是沒有加成。
-- 加成的次數記在手機上（跟吃料理的加成一樣），伺服器只負責扣金幣。
create or replace function public.rod_care() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if pl.coins < 200 then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - 200, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.rod_care() from public, anon;
grant execute on function public.rod_care() to authenticated;
