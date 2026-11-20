-- 潮汐釣魚村：好友私訊（v601，可以重複執行）
-- 只有「互相加好友」的兩個人可以傳；表不能直接讀寫，只能用下面的函式。
-- 一則最多 120 字、1 秒最多 1 則、1 分鐘最多 20 則；被管理員禁言的人不能傳。訊息只留 30 天。
create table if not exists public.dm_msgs (
  id         bigserial primary key,
  from_id    uuid not null references public.players(id) on delete cascade,
  to_id      uuid not null references public.players(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  read       boolean not null default false
);
create index if not exists dm_msgs_pair_idx on public.dm_msgs (least(from_id, to_id), greatest(from_id, to_id), id desc);
create index if not exists dm_msgs_unread_idx on public.dm_msgs (to_id) where not read;
create index if not exists dm_msgs_from_idx on public.dm_msgs (from_id, created_at desc);
alter table public.dm_msgs enable row level security;
revoke all on public.dm_msgs from anon, authenticated;

create or replace function public._dm_mutual(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where owner = a and friend = b) and exists (select 1 from public.friends where owner = b and friend = a);
$$;
revoke all on function public._dm_mutual(uuid, uuid) from public, anon, authenticated;

create or replace function public.dm_send(p_to uuid, p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text := btrim(coalesce(p_text, '')); r public.dm_msgs;
begin
  if p_to is null or p_to = pl.id then raise exception '找不到對方'; end if;
  if char_length(t) < 1 then raise exception '訊息是空的'; end if;
  if char_length(t) > 120 then raise exception '一則最多 120 個字'; end if;
  if not public._dm_mutual(pl.id, p_to) then raise exception '要互相加好友才能私訊'; end if;
  if exists (select 1 from public.muted m where m.user_id = pl.id and m.until > now()) then raise exception '你被禁言中，暫時不能傳訊息'; end if;
  if exists (select 1 from public.dm_msgs where from_id = pl.id and created_at > now() - interval '1 second') then raise exception '傳太快了，等一下再傳'; end if;
  if (select count(*) from public.dm_msgs where from_id = pl.id and created_at > now() - interval '1 minute') >= 20 then raise exception '傳太多了，休息一分鐘'; end if;
  insert into public.dm_msgs (from_id, to_id, body) values (pl.id, p_to, t) returning * into r;
  delete from public.dm_msgs where created_at < now() - interval '30 days' and least(from_id, to_id) = least(pl.id, p_to) and greatest(from_id, to_id) = greatest(pl.id, p_to);
  return jsonb_build_object('id', r.id, 'me', true, 't', r.body, 'at', r.created_at);
end $$;

-- 跟某位好友的對話：p_after 之後的（最多 60 則，舊的在前）；順便把對方傳來的標成已讀
create or replace function public.dm_list(p_with uuid, p_after bigint default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); out jsonb;
begin
  if p_with is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'me', x.from_id = pl.id, 't', x.body, 'at', x.created_at, 'rd', x.read) order by x.id), '[]'::jsonb) into out
    from (select * from public.dm_msgs
          where least(from_id, to_id) = least(pl.id, p_with) and greatest(from_id, to_id) = greatest(pl.id, p_with)
            and id > coalesce(p_after, 0) and created_at > now() - interval '30 days'
          order by id desc limit 60) x;
  update public.dm_msgs set read = true where to_id = pl.id and from_id = p_with and not read;
  return out;
end $$;

-- 每位好友還沒讀的則數和最後一則（手機的紅點、好友名單上的數字）
create or replace function public.dm_unread() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('from', u.from_id, 'name', p.nickname, 'n', u.n, 'last', u.last, 'at', u.at) order by u.at desc)
    from (select from_id, count(*) as n, (array_agg(body order by id desc))[1] as last, max(created_at) as at
          from public.dm_msgs where to_id = pl.id and not read and created_at > now() - interval '30 days' group by from_id) u
    join public.players p on p.id = u.from_id), '[]'::jsonb);
end $$;

grant execute on function public.dm_send(uuid, text) to authenticated;
grant execute on function public.dm_list(uuid, bigint) to authenticated;
grant execute on function public.dm_unread() to authenticated;
