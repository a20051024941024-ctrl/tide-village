-- 潮汐釣魚村：雲端來訪紀錄（誰來逛過你的小島、水族館；只有主人自己看得到）（可以重複執行）
create table if not exists public.visits (
  owner   uuid not null references public.players(id) on delete cascade,
  visitor uuid not null references public.players(id) on delete cascade,
  kind    text not null,           -- 'isle' 或 'aqua'
  day     date not null,
  n       integer not null default 1,
  last_at timestamptz not null default now(),
  primary key (owner, visitor, kind, day)
);
create index if not exists visits_owner_idx on public.visits (owner, last_at desc);
alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;

-- 記一次來訪（同一個人同一天同一個地方只算一筆，次數加一；最多每 30 秒算一次）
create or replace function public.log_visit(p_owner uuid, p_kind text) returns void language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if p_owner is null or p_owner = pl.id or p_kind not in ('isle', 'aqua') then return; end if;
  if not exists (select 1 from public.players where id = p_owner) then return; end if;
  insert into public.visits (owner, visitor, kind, day) values (p_owner, pl.id, p_kind, d)
  on conflict (owner, visitor, kind, day) do update set n = visits.n + (case when now() - visits.last_at > interval '30 seconds' then 1 else 0 end), last_at = now();
  delete from public.visits where owner = p_owner and day < d - 14;
end $$;

-- 拿自己的來訪紀錄（最近 14 天、最多 50 筆）
create or replace function public.get_visits() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.visitor, 'name', p.nickname, 'kind', v.kind, 'n', v.n, 'at', v.last_at) order by v.last_at desc)
    from (select * from public.visits where owner = pl.id order by last_at desc limit 50) v left join public.players p on p.id = v.visitor), '[]'::jsonb);
end $$;

do $$ declare f text; begin
  foreach f in array array['log_visit(uuid,text)', 'get_visits()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '來訪紀錄設定完成 👣' as result;
