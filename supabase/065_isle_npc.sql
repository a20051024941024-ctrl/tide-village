-- 潮汐釣魚村：私人島嶼的幫手 NPC（架構第七階段：離線世界模擬；可以重複執行）
-- 島主、共同島主、管理成員可以請幫手（每座島最多 2 個，一個 🪙1500）。幫手有名字、個性、作息：
--   白天（台灣時間 6～22 點）在島的碼頭釣魚，釣到的魚放進島上的公共儲物箱；晚上睡覺。
--   個性：勤勞（釣得多）、普通、愛睡（釣得少、睡得久）、愛聊天（釣得少一點，但會記得常來的島民）。
-- 大家都離線的時候照樣工作：用時間差一小時一小時補算（最多補 24 小時），儲物箱滿了就停下來等。
-- 同一座島同一時間只有一個在算（鎖住島主那一筆），不會重複算、重複放魚。

create table if not exists public.isle_npcs (
  id      serial primary key,
  owner   uuid not null references public.players(id) on delete cascade,
  name    text not null,
  trait   text not null check (trait in ('hard', 'normal', 'sleepy', 'chatty')),
  last_tick timestamptz not null default now(),
  total   integer not null default 0,
  log     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists isle_npcs_owner on public.isle_npcs (owner);
alter table public.isle_npcs enable row level security;
revoke all on public.isle_npcs from anon, authenticated;

create or replace function public._isle_npc_log(l jsonb, t timestamptz, txt text) returns jsonb language sql immutable as $$
  select (jsonb_build_array(jsonb_build_object('at', t, 'txt', txt)) || coalesce(l, '[]'::jsonb)) - 20 $$;

-- 補算一座島的幫手
create or replace function public._isle_npc_tick(p_owner uuid) returns integer language plpgsql security definer set search_path = public as $$
declare n public.isle_npcs; t timestamptz; h numeric; rate numeric; got int; total int := 0; pool text[]; f text; sp public.fish_species; w numeric; k int; full_ boolean; day_n int;
begin
  perform 1 from public.players where id = p_owner for update;
  select array_agg(x) into pool from jsonb_array_elements_text(public._fishcfg()->'spots'->'isle'->'fish') x join public.fish_species s on s.id = x where s.rarity = '常見' and not (public._fishcfg()->'fish'->x ? 'v');
  if pool is null then return 0; end if;
  for n in select * from public.isle_npcs where owner = p_owner for update loop
    t := greatest(n.last_tick, now() - interval '24 hours'); day_n := 0;
    rate := case n.trait when 'hard' then 1.3 when 'sleepy' then 0.5 when 'chatty' then 0.7 else 0.9 end;
    while t + interval '1 hour' <= now() loop
      t := t + interval '1 hour'; h := extract(hour from t at time zone 'Asia/Taipei');
      if h < 6 or h >= 22 or (n.trait = 'sleepy' and (h < 9 or h >= 20)) then continue; end if;
      got := floor(rate + random())::int;
      for k in 1 .. got loop
        full_ := (select count(*) from public.isle_store where owner = p_owner) >= 60;
        if full_ then
          if not exists (select 1 from jsonb_array_elements(n.log) e where e->>'txt' like '儲物箱滿了%' and (e->>'at')::timestamptz > t - interval '6 hours') then n.log := public._isle_npc_log(n.log, t, '儲物箱滿了，先休息一下'); end if;
          exit;
        end if;
        f := pool[1 + floor(random() * array_length(pool, 1))::int]; select * into sp from public.fish_species where id = f;
        w := round((sp.min_w + (sp.max_w - sp.min_w) * random() * 0.6)::numeric, 2);
        insert into public.isle_store (owner, item, by_uid, by_name) values (p_owner, jsonb_build_object('f', f, 'w', w, 't', (extract(epoch from t) * 1000)::bigint + k), p_owner, n.name || '（幫手）');
        n.total := n.total + 1; day_n := day_n + 1; total := total + 1;
      end loop;
      if h = 21 and day_n > 0 then n.log := public._isle_npc_log(n.log, t, '今天釣了 ' || day_n || ' 條，都放進儲物箱了'); day_n := 0; end if;
    end loop;
    if day_n > 0 then n.log := public._isle_npc_log(n.log, t, '剛剛又釣到 ' || day_n || ' 條'); end if;
    update public.isle_npcs set last_tick = t, total = n.total, log = n.log where id = n.id;
  end loop;
  return total;
end $$;
revoke all on function public._isle_npc_tick(uuid) from public, anon, authenticated;

create or replace function public._isle_npc_row(n public.isle_npcs) returns jsonb language sql stable as $$
  select jsonb_build_object('id', n.id, 'name', n.name, 'trait', n.trait, 'total', n.total, 'log', n.log,
    'state', case when extract(hour from now() at time zone 'Asia/Taipei') < 6 or extract(hour from now() at time zone 'Asia/Taipei') >= 22
                    or (n.trait = 'sleepy' and (extract(hour from now() at time zone 'Asia/Taipei') < 9 or extract(hour from now() at time zone 'Asia/Taipei') >= 20)) then 'sleep' else 'fish' end) $$;

-- 看某座島的幫手（參觀的人也看得到）；自己的島順便補算
create or replace function public.isle_helpers(p_owner uuid) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare ow uuid := coalesce(p_owner, public._home_of(auth.uid()));
begin
  if exists (select 1 from public.isle_npcs where owner = ow and last_tick < now() - interval '1 hour') then perform public._isle_npc_tick(ow); end if;
  return (select coalesce(jsonb_agg(public._isle_npc_row(n) order by n.id), '[]'::jsonb) from public.isle_npcs n where n.owner = ow);
end $$;

create or replace function public.isle_hire(p_name text, p_trait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); nm text := btrim(coalesce(p_name, ''));
begin
  if public._perm_rank(public._isle_perm(ow, pl.id)) < 2 then raise exception '只有島主、共同島主、管理成員可以請幫手'; end if;
  if p_trait not in ('hard', 'normal', 'sleepy', 'chatty') then raise exception '沒有這種個性'; end if;
  if char_length(nm) < 1 or char_length(nm) > 8 then raise exception '名字要 1～8 個字'; end if;
  perform 1 from public.players where id = ow for update;
  if (select count(*) from public.isle_npcs where owner = ow) >= 2 then raise exception '一座島最多 2 個幫手'; end if;
  if pl.coins < 1500 then raise exception '金幣不夠（要 🪙1500）'; end if;
  update public.players set coins = coins - 1500, updated_at = now() where id = pl.id returning * into pl;
  insert into public.isle_npcs (owner, name, trait, log) values (ow, nm, p_trait, jsonb_build_array(jsonb_build_object('at', now(), 'txt', '來到島上了，請多指教！')));
  return pl;
end $$;

create or replace function public.isle_fire(p_id integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare ow uuid := public._home_of(auth.uid());
begin
  if public._perm_rank(public._isle_perm(ow, auth.uid())) < 3 then raise exception '只有島主、共同島主可以請幫手離開'; end if;
  delete from public.isle_npcs where id = p_id and owner = ow;
  return public.isle_helpers(ow);
end $$;

do $$ declare f text; begin
  foreach f in array array['isle_helpers(uuid)', 'isle_hire(text, text)', 'isle_fire(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 每小時把所有有幫手的島補算一次（大家都離線也會動）
create or replace function public._isle_npc_all() returns integer language plpgsql security definer set search_path = public as $$
declare o uuid; n int := 0;
begin
  for o in select distinct owner from public.isle_npcs where last_tick < now() - interval '1 hour' limit 500 loop
    begin perform public._isle_npc_tick(o); n := n + 1; exception when others then raise notice '幫手補算失敗 %：%', o, sqlerrm; end;
  end loop;
  return n;
end $$;
revoke all on function public._isle_npc_all() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-isle-npc', '23 * * * *', 'select public._isle_npc_all()');
  end if;
end $$;

select '私人島嶼的幫手設定完成 🧑‍🌾' as result;
