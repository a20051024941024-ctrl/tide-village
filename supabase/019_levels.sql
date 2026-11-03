-- 潮汐釣魚村：等級獎勵（可以重複執行）
-- 經驗值的算法要跟 js/game.js 的 calcXP / lvNeed 一樣：常見 10、稀有 40、傳說 250、放流 5、水下照片每種 30
alter table public.players add column if not exists level_claimed integer not null default 1;

create or replace function public._xp(pl public.players) returns integer language sql stable as $$
  select coalesce((select sum((e.value #>> '{}')::numeric * case sp.rarity when '常見' then 10 when '稀有' then 40 else 250 end)
                   from jsonb_each(pl.fish_count) e join public.fish_species sp on sp.id = e.key), 0)::integer
         + coalesce(pl.released, 0) * 5 + coalesce(cardinality(pl.photos), 0) * 30 $$;

create or replace function public._level(xp integer) returns integer language sql immutable as $$
  select coalesce(max(l), 1) from generate_series(1, 99) l where xp >= 80 * (l - 1) + 20 * (l - 1) * (l - 2) $$;

-- 領升級獎金：每升到 Lv.N 得到 N × 50 金幣
create or replace function public.claim_levels() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); lv integer; got integer;
begin
  lv := public._level(public._xp(pl));
  if lv <= pl.level_claimed then return pl; end if;
  select coalesce(sum(k * 50), 0) into got from generate_series(pl.level_claimed + 1, lv) k;
  update public.players set coins = coins + got, earned = earned + got, level_claimed = lv, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.claim_levels() from public, anon;
grant execute on function public.claim_levels() to authenticated;

select '等級獎勵設定完成 ⭐' as result;
