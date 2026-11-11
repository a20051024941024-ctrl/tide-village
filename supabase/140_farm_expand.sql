-- 潮汐釣魚村 v373：為「以後可以再擴建農地」做準備（可以重複執行）
-- 以前「最多 12 格、開墾多少錢」是寫死在好幾個地方的。現在集中在下面這一張表（_farm_next）：
--   以後要讓玩家開更多田，只要在表裡多加幾行（例如 (16, 12000), (20, 25000)），遊戲畫面會自己把菜園平台加長、多畫幾排田，不用再改別的地方。
-- farm_get 會多回傳 max（最多幾格）和 next（下一次開墾會變幾格、要多少金幣）。
create or replace function public._farm_next(p_n integer, out n integer, out cost integer) language sql immutable as $$
  select s.n, s.cost from (values (8, 2000), (12, 5000)) as s(n, cost) where s.n > coalesce(p_n, 4) order by s.n limit 1
$$;
create or replace function public._farm_max() returns integer language sql stable as $$
  select greatest(4, coalesce((select max(q.n) from generate_series(4, 96, 4) g, lateral public._farm_next(g) q), 4))
$$;

create or replace function public.farm_get(p_owner uuid default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owner', o.id, 'n', o.n, 'max', public._farm_max(), 'now', floor(extract(epoch from now()) * 1000),
    'next', (select case when q.n is null then null else jsonb_build_object('n', q.n, 'cost', q.cost) end from public._farm_next(o.n) q),
    'plots', coalesce((select jsonb_agg(jsonb_build_object('s', f.slot, 'c', f.crop, 't', floor(extract(epoch from f.planted_at) * 1000), 'w', f.waters,
        'wa', case when f.watered_at is null then null else floor(extract(epoch from f.watered_at) * 1000) end) order by f.slot) from public.farm_plots f where f.owner = o.id), '[]'::jsonb))
  from (select i.id, coalesce((select farm_n from public.players where id = i.id), 4) as n from (select coalesce(p_owner, auth.uid()) as id) i) o
$$;

create or replace function public.farm_unlock() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); nx record;
begin
  select * into nx from public._farm_next(pl.farm_n);
  if nx.n is null then raise exception '菜園已經開到最大了'; end if;
  if pl.coins < nx.cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - nx.cost, farm_n = nx.n, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public._farm_next(integer), public._farm_max() from public, anon, authenticated;
