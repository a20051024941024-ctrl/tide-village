-- 潮汐釣魚村 v386：海底花園按讚、本週最美海底排行（可以重複執行）
-- 去別人的島潛下去參觀，可以幫他的海底按讚（一個人一週對同一座島一次，不能按自己的）。
-- 排行每週一（台灣時間）重新算，只看這一週拿到的讚；海底至少要放 5 樣東西（造景、裝飾或作物）才會上榜。
create table if not exists public.sea_likes (
  owner uuid not null,
  liker uuid not null,
  week  date not null,
  at    timestamptz not null default now(),
  primary key (owner, liker, week)
);
create index if not exists sea_likes_week on public.sea_likes (week, owner);
alter table public.sea_likes enable row level security;
revoke all on public.sea_likes from anon, authenticated;
create or replace function public._sea_week() returns date language sql stable as $$ select date_trunc('week', now() at time zone 'Asia/Taipei')::date $$;
create or replace function public._sea_pieces(p_owner uuid) returns integer language sql stable security definer set search_path = public as $$
  select ((select count(*) from public.sea_decor where owner = p_owner) + (select count(*) from public.farm_plots where owner = p_owner and slot >= 100))::integer $$;

-- 這座島的海底這週幾個讚、我按過了沒
create or replace function public.sea_like_info(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', (select count(*) from public.sea_likes where owner = p_owner and week = public._sea_week()),
    'liked', exists (select 1 from public.sea_likes where owner = p_owner and liker = auth.uid() and week = public._sea_week()),
    'pieces', public._sea_pieces(p_owner)) $$;

create or replace function public.sea_like(p_owner uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_owner is null or p_owner = pl.id then raise exception '不能幫自己按讚'; end if;
  if not exists (select 1 from public.players where id = p_owner) then raise exception '找不到這座島'; end if;
  if public._sea_pieces(p_owner) < 5 then raise exception '這裡的海底還沒佈置好（至少要放 5 樣東西）'; end if;
  insert into public.sea_likes (owner, liker, week) values (p_owner, pl.id, public._sea_week()) on conflict do nothing;
  return public.sea_like_info(p_owner);
end $$;

-- 本週前 10 名，加上上週的第一名
create or replace function public.sea_top() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', t.owner, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'n', t.n, 'pieces', public._sea_pieces(t.owner)) order by t.n desc, t.first)
      from (select owner, count(*) as n, min(at) as first from public.sea_likes where week = public._sea_week() group by owner order by count(*) desc, min(at) limit 10) t
      join public.players p on p.id = t.owner), '[]'::jsonb),
    'last', (select jsonb_build_object('id', t.owner, 'name', coalesce(nullif(p.nickname, ''), '釣客'), 'n', t.n)
      from (select owner, count(*) as n, min(at) as first from public.sea_likes where week = public._sea_week() - 7 group by owner order by count(*) desc, min(at) limit 1) t
      join public.players p on p.id = t.owner)) $$;

revoke all on function public._sea_week(), public._sea_pieces(uuid) from public, anon, authenticated;
revoke all on function public.sea_like_info(uuid), public.sea_like(uuid), public.sea_top() from public, anon;
grant execute on function public.sea_like_info(uuid), public.sea_like(uuid), public.sea_top() to authenticated;
