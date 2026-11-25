-- 224 築城守土：大地圖＋聯盟（作者 11/25：「我們很像世紀帝國」「大家出現在地圖上但就這麼多人，然後可以結盟可以攻打」）
-- 可以重複執行。要先跑過 221_zc.sql、222_zc_rivals.sql。
-- 規則：
--   ・每個人的領地在一張 60×60 的大地圖上有一個固定座標（伺服器幫每個人挑一塊空地，旁邊 3 格內不會有別人）
--   ・聯盟：名字 2～10 個字、簡稱 1～3 個字（會擋不雅字），最多 20 人；誰都可以直接加入；盟主可以踢人；盟主離開時交給最早加入的人，最後一個人離開聯盟就解散
--   ・同一個聯盟的人不能互打（報仇也不行）
--   ・其他規則照 221／222（一次最多搶 15%、攻陷主堡 25%、被打後 8 小時護盾、一天最多出征 40 次、48 小時內可以報仇）

alter table public.zc_bases add column if not exists wx integer;
alter table public.zc_bases add column if not exists wy integer;
create index if not exists zc_bases_xy_idx on public.zc_bases (wx, wy);

create table if not exists public.zc_allies (
  id     bigserial primary key,
  name   text not null unique,
  tag    text not null,
  leader uuid not null references auth.users(id) on delete cascade,
  at     timestamptz not null default now()
);
create table if not exists public.zc_ally_mem (
  uid  uuid primary key references auth.users(id) on delete cascade,
  aid  bigint not null references public.zc_allies(id) on delete cascade,
  at   timestamptz not null default now()
);
create index if not exists zc_ally_mem_aid_idx on public.zc_ally_mem (aid, at);
alter table public.zc_allies enable row level security;
alter table public.zc_ally_mem enable row level security;
-- 不開放直接讀寫，全部走下面的函式

create or replace function public._zc_aid(u uuid) returns bigint language sql stable security definer set search_path = public as $$
  select aid from public.zc_ally_mem where uid = u $$;

-- 幫還沒有座標的領地挑一塊空地
create or replace function public._zc_place(u uuid) returns void language plpgsql security definer set search_path = public as $$
declare x integer; y integer; i integer;
begin
  if exists (select 1 from public.zc_bases where id = u and wx is not null) then return; end if;
  if not exists (select 1 from public.zc_bases where id = u) then return; end if;
  for i in 1..300 loop
    x := 3 + floor(random() * 54)::integer; y := 3 + floor(random() * 54)::integer;
    if not exists (select 1 from public.zc_bases b where b.wx is not null and abs(b.wx - x) <= 3 and abs(b.wy - y) <= 3) then exit; end if;
  end loop;
  update public.zc_bases set wx = x, wy = y where id = u;
end $$;

-- 大地圖：所有最近 60 天有玩的領地＋聯盟
create or replace function public.zc_world() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res jsonb; u uuid;
begin
  if me is null then return null; end if;
  perform public._zc_place(me);
  for u in select id from public.zc_bases where wx is null and updated_at > now() - interval '60 days' limit 50 loop perform public._zc_place(u); end loop;   -- 還沒打開過大地圖的人也放上去
  select jsonb_build_object(
    'me', me, 'aid', public._zc_aid(me), 'now', floor(extract(epoch from clock_timestamp()) * 1000),
    'bases', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', coalesce(p.nickname, ''), 'lv', b.lv,
        'civ', coalesce((b.body->>'civ')::integer, 0), 'x', b.wx, 'y', b.wy,
        'shield', floor(extract(epoch from b.shield_until) * 1000), 'aid', m.aid,
        'army', case when jsonb_typeof(b.body->'army') = 'array' then jsonb_array_length(b.body->'army') else 0 end,
        'rev', public._zc_can_rev(me, b.id)))
      from public.zc_bases b left join public.players p on p.id = b.id left join public.zc_ally_mem m on m.uid = b.id
      where b.wx is not null and (b.id = me or b.updated_at > now() - interval '60 days')), '[]'::jsonb),
    'allies', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'tag', a.tag, 'leader', a.leader,
        'n', (select count(*) from public.zc_ally_mem m where m.aid = a.id)) order by a.id) from public.zc_allies a), '[]'::jsonb)) into res;
  return res;
end $$;

create or replace function public.zc_ally_create(p_name text, p_tag text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name, '')); tg text := btrim(coalesce(p_tag, '')); a bigint;
begin
  if me is null then raise exception '要先登入'; end if;
  if not exists (select 1 from public.zc_bases where id = me) then raise exception '你還沒有領地'; end if;
  if public._zc_aid(me) is not null then raise exception '你已經在一個聯盟裡了，先退出'; end if;
  if char_length(nm) < 2 or char_length(nm) > 10 then raise exception '聯盟名字要 2～10 個字'; end if;
  if char_length(tg) < 1 or char_length(tg) > 3 then raise exception '簡稱要 1～3 個字'; end if;
  if public._name_bad(nm) or public._name_bad(tg) then raise exception '這個名字不能用，換一個吧'; end if;
  if exists (select 1 from public.zc_allies where lower(name) = lower(nm)) then raise exception '已經有同名的聯盟了'; end if;
  insert into public.zc_allies (name, tag, leader) values (nm, tg, me) returning id into a;
  insert into public.zc_ally_mem (uid, aid) values (me, a);
  return jsonb_build_object('ok', true, 'aid', a);
end $$;

create or replace function public.zc_ally_join(p_aid bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer;
begin
  if me is null then raise exception '要先登入'; end if;
  if not exists (select 1 from public.zc_bases where id = me) then raise exception '你還沒有領地'; end if;
  if public._zc_aid(me) is not null then raise exception '你已經在一個聯盟裡了，先退出'; end if;
  if not exists (select 1 from public.zc_allies where id = p_aid) then raise exception '找不到這個聯盟'; end if;
  perform 1 from public.zc_allies where id = p_aid for update;
  select count(*) into n from public.zc_ally_mem where aid = p_aid;
  if n >= 20 then raise exception '這個聯盟滿了（最多 20 人）'; end if;
  insert into public.zc_ally_mem (uid, aid) values (me, p_aid);
  return jsonb_build_object('ok', true, 'aid', p_aid);
end $$;

create or replace function public.zc_ally_leave() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a bigint := public._zc_aid(me); nxt uuid;
begin
  if me is null or a is null then return jsonb_build_object('ok', true); end if;
  delete from public.zc_ally_mem where uid = me;
  select uid into nxt from public.zc_ally_mem where aid = a order by at limit 1;
  if nxt is null then delete from public.zc_allies where id = a;
  elsif exists (select 1 from public.zc_allies where id = a and leader = me) then update public.zc_allies set leader = nxt where id = a; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.zc_ally_kick(p_uid uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a bigint := public._zc_aid(me);
begin
  if me is null or a is null then raise exception '你不在聯盟裡'; end if;
  if not exists (select 1 from public.zc_allies where id = a and leader = me) then raise exception '只有盟主可以請人離開'; end if;
  if p_uid = me then raise exception '盟主要用「退出聯盟」'; end if;
  delete from public.zc_ally_mem where uid = p_uid and aid = a;
  return jsonb_build_object('ok', true);
end $$;

-- 聯盟成員
create or replace function public.zc_ally_info(p_aid bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return (select jsonb_build_object('id', a.id, 'name', a.name, 'tag', a.tag, 'leader', a.leader,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.uid, 'name', coalesce(p.nickname, ''), 'lv', coalesce(b.lv, 1)) order by m.at)
       from public.zc_ally_mem m left join public.players p on p.id = m.uid left join public.zc_bases b on b.id = m.uid where m.aid = a.id), '[]'::jsonb))
    from public.zc_allies a where a.id = p_aid);
end $$;

-- 同盟不能互打：拿領地、出征結算都多檢查一次（其他照 222）
create or replace function public.zc_target(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.zc_bases; rv boolean;
begin
  if me is null or p_id is null or p_id = me then return null; end if;
  if public._zc_aid(me) is not null and public._zc_aid(me) = public._zc_aid(p_id) then return jsonb_build_object('ally', true); end if;
  select * into d from public.zc_bases where id = p_id;
  if not found or d.lv < 3 then return null; end if;
  rv := public._zc_can_rev(me, p_id);
  if d.shield_until > now() and not rv then return null; end if;
  return jsonb_build_object('id', d.id, 'body', d.body, 'rev', rv);
end $$;

create or replace function public.zc_raid(p_def uuid, p_pct integer, p_loot jsonb, p_civ integer, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.zc_bases; pct integer; cap numeric; l jsonb; n integer; rv boolean;
begin
  if me is null then raise exception '要先登入'; end if;
  if p_def is null or p_def = me then raise exception '不能打自己'; end if;
  if not exists (select 1 from public.zc_bases where id = me) then raise exception '你還沒有領地'; end if;
  if public._zc_aid(me) is not null and public._zc_aid(me) = public._zc_aid(p_def) then raise exception '不能打同一個聯盟的人'; end if;
  select * into d from public.zc_bases where id = p_def for update;
  if not found then raise exception '找不到這個領地'; end if;
  if d.lv < 3 then raise exception '對方還在新手保護'; end if;
  rv := public._zc_can_rev(me, p_def);
  if d.shield_until > now() and not rv then raise exception '對方有護盾'; end if;
  select count(*) into n from public.zc_raids where att = me and at > now() - interval '1 day';
  if n >= 40 then raise exception '今天出征太多次了'; end if;
  pct := greatest(0, least(100, coalesce(p_pct, 0)));
  cap := (case when pct >= 100 then 0.25 else 0.15 end) * pct / 100.0;
  l := jsonb_build_object(
    'g', floor(least(public._zc_num(p_loot, 'g'), public._zc_num(d.body, 'gold')  * cap)),
    'w', floor(least(public._zc_num(p_loot, 'w'), public._zc_num(d.body, 'wood')  * cap)),
    's', floor(least(public._zc_num(p_loot, 's'), public._zc_num(d.body, 'stone') * cap)),
    'f', floor(least(public._zc_num(p_loot, 'f'), public._zc_num(d.body, 'food')  * cap)));
  insert into public.zc_raids (att, def, t, pct, civ, loot) values (me, p_def, coalesce(p_t, floor(extract(epoch from now()) * 1000)), pct, greatest(0, least(3, coalesce(p_civ, 0))), l)
    on conflict (att, t) do nothing;
  if pct > 0 and not rv then update public.zc_bases set shield_until = now() + interval '8 hours' where id = p_def; end if;
  update public.zc_bases set shield_until = now() where id = me and shield_until > now();
  return jsonb_build_object('ok', true, 'loot', l, 'rev', rv);
end $$;

revoke all on function public._zc_aid(uuid) from public, anon, authenticated;
revoke all on function public._zc_place(uuid) from public, anon, authenticated;
revoke all on function public.zc_world() from public, anon;
revoke all on function public.zc_ally_create(text, text) from public, anon;
revoke all on function public.zc_ally_join(bigint) from public, anon;
revoke all on function public.zc_ally_leave() from public, anon;
revoke all on function public.zc_ally_kick(uuid) from public, anon;
revoke all on function public.zc_ally_info(bigint) from public, anon;
revoke all on function public.zc_target(uuid) from public, anon;
revoke all on function public.zc_raid(uuid, integer, jsonb, integer, bigint) from public, anon;
grant execute on function public.zc_world() to authenticated;
grant execute on function public.zc_ally_create(text, text) to authenticated;
grant execute on function public.zc_ally_join(bigint) to authenticated;
grant execute on function public.zc_ally_leave() to authenticated;
grant execute on function public.zc_ally_kick(uuid) to authenticated;
grant execute on function public.zc_ally_info(bigint) to authenticated;
grant execute on function public.zc_target(uuid) to authenticated;
grant execute on function public.zc_raid(uuid, integer, jsonb, integer, bigint) to authenticated;

select '築城守土・大地圖與聯盟設定完成 🗺️' as result;
