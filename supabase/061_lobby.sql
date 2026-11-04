-- 潮汐釣魚村：12 人公共大廳（架構第四階段；可以重複執行）
-- 每個公共大廳最多 12 人。伺服器記得誰在哪一個大廳（每 30 秒報到一次，75 秒沒報到就算離開），
-- 分配大廳由伺服器決定（同一時間只讓一個人挑，不會兩個人同時搶到第 12 個位子）：想去的大廳有位子就去；不然去有好友的大廳；再不然去人最多但還沒滿的大廳（大家比較熱鬧）。
-- 即時的位置、動作、釣魚狀態還是走 Supabase Realtime 頻道；公共 NPC、魚市、村報這些重要資料都在資料庫裡，所以每個大廳看到的一樣。

create table if not exists public.lobby_members (
  uid  uuid primary key,
  no   integer not null check (no between 1 and 40),
  name text not null default '',
  at   timestamptz not null default now()
);
create index if not exists lobby_members_no on public.lobby_members (no, at);
alter table public.lobby_members enable row level security;
revoke all on public.lobby_members from anon, authenticated;

create or replace function public._lobby_max() returns integer language sql immutable as $$ select 12 $$;
create or replace function public._lobby_count() returns integer language sql immutable as $$ select 30 $$;

-- 報到（進大廳、之後每 30 秒）
create or replace function public.lobby_beat(p_no integer) returns void language plpgsql security definer set search_path = public as $$
declare me public.players := public._me();
begin
  if p_no is null or p_no < 1 or p_no > public._lobby_count() then return; end if;
  insert into public.lobby_members (uid, no, name, at) values (me.id, p_no, left(coalesce(me.nickname, ''), 16), now())
    on conflict (uid) do update set no = excluded.no, name = excluded.name, at = now();
end $$;
create or replace function public.lobby_leave() returns void language sql security definer set search_path = public as $$
  delete from public.lobby_members where uid = auth.uid() $$;

-- 每個大廳現在幾個人、我的好友在哪裡
create or replace function public.lobby_list() returns jsonb language sql stable security definer set search_path = public as $$
  with live as (select * from public.lobby_members where at > now() - interval '75 seconds'),
  fr as (select f.friend from public.friends f where f.owner = auth.uid())
  select jsonb_build_object('max', public._lobby_max(), 'count', public._lobby_count(), 'rooms',
    coalesce((select jsonb_agg(jsonb_build_object('no', g.no, 'n', g.n, 'friends', g.fr) order by g.no) from (
      select l.no, count(*)::int n, coalesce(jsonb_agg(l.name) filter (where l.uid in (select friend from fr)), '[]'::jsonb) fr from live l group by l.no) g), '[]'::jsonb)) $$;

-- 幫我挑一個大廳（p_want：想去的那一個，0 = 讓伺服器挑；p_new：開一個沒人的新大廳）
create or replace function public.lobby_pick(p_want integer, p_new boolean) returns integer language plpgsql security definer set search_path = public as $$
declare me public.players := public._me(); pick integer; mx int := public._lobby_max(); cnt int := public._lobby_count();
begin
  perform pg_advisory_xact_lock(hashtext('tide-lobby-pick'));
  delete from public.lobby_members where uid = me.id or at < now() - interval '10 minutes';
  with live as (select no, count(*) n from public.lobby_members where at > now() - interval '75 seconds' group by no)
  select g into pick from generate_series(1, cnt) g left join live l on l.no = g
    where coalesce(l.n, 0) < mx and (
      (p_new and coalesce(l.n, 0) = 0) or
      (not coalesce(p_new, false) and coalesce(p_want, 0) = g))
    order by g limit 1;
  if pick is null and not coalesce(p_new, false) then
    with live as (select no, count(*) n from public.lobby_members where at > now() - interval '75 seconds' group by no),
         fr as (select m.no, count(*) k from public.lobby_members m join public.friends f on f.friend = m.uid and f.owner = me.id where m.at > now() - interval '75 seconds' group by m.no)
    select g into pick from generate_series(1, cnt) g left join live l on l.no = g left join fr on fr.no = g
      where coalesce(l.n, 0) < mx order by coalesce(fr.k, 0) desc, coalesce(l.n, 0) desc, g limit 1;
  end if;
  if pick is null then raise exception '所有大廳都滿了，等一下再試'; end if;
  insert into public.lobby_members (uid, no, name, at) values (me.id, pick, left(coalesce(me.nickname, ''), 16), now());
  return pick;
end $$;

do $$ declare f text; begin
  foreach f in array array['lobby_beat(integer)', 'lobby_leave()', 'lobby_list()', 'lobby_pick(integer, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '12 人公共大廳設定完成 🏘️' as result;
