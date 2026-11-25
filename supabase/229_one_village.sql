-- 229 🏘️ 先不分大廳（v851，作者 11/26：「還是先不要有大廳，讓玩家目前都可以出現在這裡」）。可以重複執行。
-- ・一個大廳最多 12 人 → 100 人；挑大廳時一律挑第 1 個還有位子的（大家都在同一個村子）。
-- ・超過 100 人才會開到第 2 個（以後人多了再做「分線」）。
create or replace function public._lobby_max() returns integer language sql immutable as $$ select 100 $$;
create or replace function public.lobby_pick(p_want integer, p_new boolean) returns integer language plpgsql security definer set search_path = public as $$
declare me public.players := public._me(); pick integer; mx int := public._lobby_max(); cnt int := public._lobby_count();
begin
  perform pg_advisory_xact_lock(hashtext('tide-lobby-pick'));
  delete from public.lobby_members where uid = me.id or at < now() - interval '10 minutes';
  with live as (select no, count(*) n from public.lobby_members where at > now() - interval '75 seconds' group by no)
  select g into pick from generate_series(1, cnt) g left join live l on l.no = g where coalesce(l.n, 0) < mx order by g limit 1;
  if pick is null then raise exception '村子裡人太多了，等一下再試'; end if;
  insert into public.lobby_members (uid, no, name, at) values (me.id, pick, left(coalesce(me.nickname, ''), 16), now());
  return pick;
end $$;
revoke all on function public.lobby_pick(integer, boolean) from public, anon;
grant execute on function public.lobby_pick(integer, boolean) to authenticated;
select '先不分大廳 🏘️：一個大廳最多 ' || public._lobby_max() || ' 人，大家都進第 1 個' as result;
