-- 221 築城守土（村子裡的另一款遊戲）：領地存檔、出征、戰報
-- 可以重複執行。貼到 Supabase 的 SQL Editor 按 Run 就好。
-- 規則：
--   ・每個人一份領地（zc_bases），只有自己能改
--   ・搜尋對手：只找得到主堡 3 級以上、沒有護盾的人，先找等級接近的
--   ・出征：搶走的資源由伺服器再檢查一次，最多是對方庫存的 15%（攻陷主堡 25%）
--   ・被打以後有 8 小時護盾；自己出征的話護盾馬上結束
--   ・一天最多出征 40 次

create table if not exists public.zc_bases (
  id           uuid primary key references auth.users(id) on delete cascade,
  lv           integer not null default 1,
  body         jsonb not null,
  shield_until timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists zc_bases_lv_idx on public.zc_bases (lv);

create table if not exists public.zc_raids (
  id   bigserial primary key,
  att  uuid not null references auth.users(id) on delete cascade,
  def  uuid not null references auth.users(id) on delete cascade,
  t    bigint not null,                 -- 手機上的時間（毫秒），同一場不會記兩次
  pct  integer not null,                -- 摧毀幾 %
  civ  integer not null default 0,
  loot jsonb not null default '{}'::jsonb,
  at   timestamptz not null default now(),
  unique (att, t)
);
create index if not exists zc_raids_def_idx on public.zc_raids (def, at desc);
create index if not exists zc_raids_att_idx on public.zc_raids (att, at desc);

alter table public.zc_bases enable row level security;
alter table public.zc_raids enable row level security;
-- 不開放直接讀寫，全部走下面的函式

create or replace function public._zc_num(j jsonb, k text) returns numeric language plpgsql immutable as $$
declare v numeric;
begin
  begin v := (j->>k)::numeric; exception when others then v := 0; end;
  if v is null or v < 0 then v := 0; end if;
  return v;
end $$;

create or replace function public.zc_save(p_body jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l integer; sh timestamptz;
begin
  if me is null then raise exception '要先登入'; end if;
  if p_body is null or jsonb_typeof(p_body) <> 'object' then raise exception '存檔格式不對'; end if;
  if pg_column_size(p_body) > 300000 then raise exception '存檔太大'; end if;
  l := greatest(1, least(60, floor(public._zc_num(p_body, 'lv'))::integer));
  insert into public.zc_bases (id, lv, body) values (me, l, p_body)
    on conflict (id) do update set lv = excluded.lv, body = excluded.body, updated_at = now()
    returning shield_until into sh;
  return jsonb_build_object('ok', true, 'shield', floor(extract(epoch from sh) * 1000));
end $$;

create or replace function public.zc_my() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.zc_bases;
begin
  if me is null then return null; end if;
  select * into r from public.zc_bases where id = me;
  if not found then return jsonb_build_object('body', null, 'shield', 0); end if;
  return jsonb_build_object('body', r.body, 'shield', floor(extract(epoch from r.shield_until) * 1000));
end $$;

create or replace function public.zc_find() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mylv integer; res jsonb;
begin
  if me is null then return '[]'::jsonb; end if;
  select lv into mylv from public.zc_bases where id = me; mylv := coalesce(mylv, 1);
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'body', q.body)), '[]'::jsonb) into res from (
    select id, body from public.zc_bases
     where id <> me and lv >= 3 and shield_until <= now() and updated_at > now() - interval '60 days'
     order by abs(lv - mylv), random() limit 40) q;
  return res;
end $$;

create or replace function public.zc_raid(p_def uuid, p_pct integer, p_loot jsonb, p_civ integer, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.zc_bases; pct integer; cap numeric; l jsonb; n integer;
begin
  if me is null then raise exception '要先登入'; end if;
  if p_def is null or p_def = me then raise exception '不能打自己'; end if;
  if not exists (select 1 from public.zc_bases where id = me) then raise exception '你還沒有領地'; end if;
  select * into d from public.zc_bases where id = p_def for update;
  if not found then raise exception '找不到這個領地'; end if;
  if d.lv < 3 then raise exception '對方還在新手保護'; end if;
  if d.shield_until > now() then raise exception '對方有護盾'; end if;
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
  if pct > 0 then update public.zc_bases set shield_until = now() + interval '8 hours' where id = p_def; end if;
  update public.zc_bases set shield_until = now() where id = me and shield_until > now();
  return jsonb_build_object('ok', true, 'loot', l);
end $$;

-- 戰報：我打別人的最近 12 場（第一筆，id 是我自己）＋別人打我的最近 14 天（照攻打的人分組）
create or replace function public.zc_reports() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine jsonb; them jsonb;
begin
  if me is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x.j order by x.t), '[]'::jsonb) into mine from (
    select t, jsonb_build_object('d', def, 'p', pct, 't', t, 'c', civ, 'l', loot) j from public.zc_raids where att = me order by t desc limit 12) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', y.att, 'list', y.list)), '[]'::jsonb) into them from (
    select att, jsonb_agg(jsonb_build_object('d', def, 'p', pct, 't', t, 'c', civ, 'l', loot) order by t) list
      from public.zc_raids where def = me and at > now() - interval '14 days' group by att) y;
  return jsonb_build_array(jsonb_build_object('id', me, 'list', mine)) || them;
end $$;

create or replace function public.zc_names(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if auth.uid() is null or p_ids is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', nickname)), '[]'::jsonb) into res
    from public.players where id = any(p_ids[1:100]);
  return res;
end $$;

revoke all on function public._zc_num(jsonb, text) from public, anon, authenticated;
revoke all on function public.zc_save(jsonb) from public, anon;
revoke all on function public.zc_my() from public, anon;
revoke all on function public.zc_find() from public, anon;
revoke all on function public.zc_raid(uuid, integer, jsonb, integer, bigint) from public, anon;
revoke all on function public.zc_reports() from public, anon;
revoke all on function public.zc_names(uuid[]) from public, anon;
grant execute on function public.zc_save(jsonb) to authenticated;
grant execute on function public.zc_my() to authenticated;
grant execute on function public.zc_find() to authenticated;
grant execute on function public.zc_raid(uuid, integer, jsonb, integer, bigint) to authenticated;
grant execute on function public.zc_reports() to authenticated;
grant execute on function public.zc_names(uuid[]) to authenticated;

select '築城守土・領地與出征設定完成 🏰' as result;
