-- 222 築城守土：玩家名單、指定攻打、報仇
-- 可以重複執行。貼到 Supabase 的 SQL Editor 按 Run 就好（要先跑過 221_zc.sql）。
-- 規則：
--   ・玩家名單：列出其他真人玩家（主堡 3 級以上），標出誰有護盾、誰最近打過你
--   ・報仇：48 小時內打過你的人，就算他有護盾，你也可以打回去一次（他每打你一次，你就能報仇一次）
--   ・其他規則照 221（一次最多搶 15%、攻陷主堡 25%、被打後 8 小時護盾、一天最多出征 40 次）

-- 這個人現在能不能被我報仇
create or replace function public._zc_can_rev(me uuid, p_def uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.zc_raids r
     where r.att = p_def and r.def = me and r.pct > 0 and r.at > now() - interval '48 hours'
       and not exists (select 1 from public.zc_raids r2 where r2.att = me and r2.def = p_def and r2.at > r.at))
$$;

-- 玩家名單（不含領地內容，只有摘要）
create or replace function public.zc_players() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mylv integer; res jsonb;
begin
  if me is null then return '[]'::jsonb; end if;
  select lv into mylv from public.zc_bases where id = me; mylv := coalesce(mylv, 1);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'name', q.name, 'lv', q.lv, 'civ', q.civ, 'army', q.army,
      'shield', floor(extract(epoch from q.shield_until) * 1000), 'rev', q.rev) order by q.rev desc, q.ord), '[]'::jsonb) into res
  from (
    select b.id, coalesce(p.nickname, '') name, b.lv,
           coalesce((b.body->>'civ')::integer, 0) civ,
           case when jsonb_typeof(b.body->'army') = 'array' then jsonb_array_length(b.body->'army') else 0 end army,
           b.shield_until, public._zc_can_rev(me, b.id) rev, abs(b.lv - mylv) ord
      from public.zc_bases b left join public.players p on p.id = b.id
     where b.id <> me and b.lv >= 3 and b.updated_at > now() - interval '60 days'
     order by public._zc_can_rev(me, b.id) desc, abs(b.lv - mylv), b.updated_at desc
     limit 30) q;
  return res;
end $$;

-- 拿某一位玩家的領地來打（沒護盾、或可以報仇才拿得到）
create or replace function public.zc_target(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.zc_bases; rv boolean;
begin
  if me is null or p_id is null or p_id = me then return null; end if;
  select * into d from public.zc_bases where id = p_id;
  if not found or d.lv < 3 then return null; end if;
  rv := public._zc_can_rev(me, p_id);
  if d.shield_until > now() and not rv then return null; end if;
  return jsonb_build_object('id', d.id, 'body', d.body, 'rev', rv);
end $$;

-- 出征結算：多了「可以報仇就算有護盾也能打」
create or replace function public.zc_raid(p_def uuid, p_pct integer, p_loot jsonb, p_civ integer, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.zc_bases; pct integer; cap numeric; l jsonb; n integer; rv boolean;
begin
  if me is null then raise exception '要先登入'; end if;
  if p_def is null or p_def = me then raise exception '不能打自己'; end if;
  if not exists (select 1 from public.zc_bases where id = me) then raise exception '你還沒有領地'; end if;
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
  -- 報仇不會再給對方加長護盾；一般攻打照舊給 8 小時
  if pct > 0 and not rv then update public.zc_bases set shield_until = now() + interval '8 hours' where id = p_def; end if;
  update public.zc_bases set shield_until = now() where id = me and shield_until > now();
  return jsonb_build_object('ok', true, 'loot', l, 'rev', rv);
end $$;

revoke all on function public._zc_can_rev(uuid, uuid) from public, anon, authenticated;
revoke all on function public.zc_players() from public, anon;
revoke all on function public.zc_target(uuid) from public, anon;
revoke all on function public.zc_raid(uuid, integer, jsonb, integer, bigint) from public, anon;
grant execute on function public.zc_players() to authenticated;
grant execute on function public.zc_target(uuid) to authenticated;
grant execute on function public.zc_raid(uuid, integer, jsonb, integer, bigint) to authenticated;

select '築城守土・玩家名單與報仇設定完成 ⚔️' as result;
