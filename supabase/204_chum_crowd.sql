-- 潮汐釣魚村 v607：熱窩——人越多窩越旺（可以重複執行）
-- 作者：「之前有人蠻喜歡打窩這個功能，都會跟我說『要不要來釣魚，窩打好了』」。
-- * 抽魚（020 roll_fish）：這一竿有窩料加成時，12 公尺內、最近 90 秒也在窩裡拋竿的其他玩家每多一個，稀有 ×1.10、傳說 ×1.12（最多算 3 個）。
-- * 窩主謝禮：在別人的窩（祕密窩點，或附近別人剛打的「現在打」）釣到魚，窩主拿 2 金幣，一天最多 60；窩主手機會看到是誰釣到什麼（chum_thx_log）。
-- * 祕密窩點有別人釣到魚，每條延長 1 分鐘，最多多 30 分鐘（spots[].ext，毫秒）。
alter table public.players add column if not exists cast_x numeric;
alter table public.players add column if not exists cast_z numeric;
alter table public.players add column if not exists cast_chum text;
alter table public.players add column if not exists chum_thx_day date;
alter table public.players add column if not exists chum_thx integer not null default 0;
alter table public.players add column if not exists chum_thx_log jsonb not null default '[]'::jsonb;
alter table public.casts add column if not exists chum_owner uuid;
alter table public.casts add column if not exists chum_sid text;
create index if not exists players_cast_chum_idx on public.players (cast_at) where cast_chum is not null;

-- 窩裡一起釣的其他人（最多算 3 個）
create or replace function public._chum_crowd(p_uid uuid, p_x numeric, p_z numeric) returns integer language sql stable security definer set search_path = public as $$
  select least(3, count(*))::int from public.players
   where cast_chum is not null and cast_at > now() - interval '90 seconds' and id <> p_uid
     and p_x is not null and p_z is not null and cast_x is not null and cast_z is not null
     and sqrt(power(cast_x - p_x, 2) + power(cast_z - p_z, 2)) < 12 $$;

-- 這個窩是誰打的：祕密窩點看主人；「現在打」找附近 15 公尺內、3 分鐘內打過同一種窩料的人
create or replace function public._chum_owner(p_chum text, p_uid uuid, p_x numeric, p_z numeric) returns uuid language plpgsql stable security definer set search_path = public as $$
declare o uuid;
begin
  if p_chum like 'secret:%' then
    select s.owner into o from public.secret_chum s, jsonb_array_elements(s.spots) e where e->>'id' = substr(p_chum, 8) limit 1;
  elsif p_chum like 'live:%' and p_x is not null and p_z is not null then
    select id into o from public.players
     where chum_type = substr(p_chum, 6) and chum_at > now() - interval '200 seconds' and id <> p_uid
       and cast_x is not null and sqrt(power(cast_x - p_x, 2) + power(cast_z - p_z, 2)) < 15
     order by chum_at desc limit 1;
  end if;
  return case when o = p_uid then null else o end;
end $$;

-- 窩主謝禮＋祕密窩點延長
create or replace function public._chum_thank(p_owner uuid, p_from uuid, p_fish text, p_sid text) returns void language plpgsql security definer set search_path = public as $$
declare td date := (now() at time zone 'Asia/Taipei')::date; nm text; give integer;
begin
  if p_owner is null or p_owner = p_from then return; end if;
  select nickname into nm from public.players where id = p_from;
  update public.players set
    chum_thx = case when chum_thx_day = td then chum_thx else 0 end,
    chum_thx_day = td
  where id = p_owner;
  select case when chum_thx < 60 then 2 else 0 end into give from public.players where id = p_owner;
  if give is null then return; end if;
  update public.players set
    coins = coins + give, chum_thx = chum_thx + give,
    chum_thx_log = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(
                      jsonb_build_array(jsonb_build_object('n', left(coalesce(nm, '釣客'), 16), 'f', p_fish, 'c', give, 'at', (extract(epoch from now()) * 1000)::bigint)) || coalesce(chum_thx_log, '[]'::jsonb)) x limit 8) y),
    updated_at = now()
  where id = p_owner;
  if p_sid is not null then
    update public.secret_chum s set spots = (
      select coalesce(jsonb_agg(case when e->>'id' = p_sid then jsonb_set(e, '{ext}', to_jsonb(least(1800000, coalesce((e->>'ext')::bigint, 0) + 60000))) else e end), '[]'::jsonb)
      from jsonb_array_elements(s.spots) e)
    where s.owner = p_owner and exists (select 1 from jsonb_array_elements(s.spots) e where e->>'id' = p_sid);
  end if;
end $$;

revoke all on function public._chum_crowd(uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public._chum_owner(text, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public._chum_thank(uuid, uuid, text, text) from public, anon, authenticated;
