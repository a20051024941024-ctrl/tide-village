-- 潮汐釣魚村 v304：新手主線（釣第一條魚 → 賣魚 → 買竿子 → 去小島 → 潛一次水）（可以重複執行）
-- 走完主線的獎勵 🪙300，每個角色只能領一次；伺服器確認真的釣過 5 條以上，其他步驟在手機上判斷。
alter table public.players add column if not exists guide_done boolean not null default false;
create or replace function public.guide_reward() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  select * into pl from public.players where id = pl.id for update;
  if pl.guide_done then raise exception '新手獎勵已經領過了'; end if;
  if pl.total < 5 then raise exception '再多釣幾條魚吧'; end if;
  update public.players set guide_done = true, coins = coins + 300, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.guide_reward() from public, anon;
grant execute on function public.guide_reward() to authenticated;
