-- 潮汐釣魚村 v330：村民的故事（28）（可以重複執行）
-- 5 位村民（村長阿土伯、阿綾、阿木、阿福、老港）各有好感度 0～100：
--   每天委託（交 1 條指定的魚）+15 好感、+80 金幣；每天打招呼一次 +3 好感。
--   好感到 15／35／60／85／100 各解鎖一章故事，讀了拿 100／150／200／300／500 金幣（第 5 章另外有稱號，在手機上顯示）。
-- 金幣、好感都由這裡決定；交魚跟每日任務（010）一樣，伺服器檢查魚缸裡真的有那條魚再收走。

create table if not exists public.villager_aff (
  uid uuid not null, who text not null, aff integer not null default 0, ch integer not null default 0,
  ask_day date, talk_day date, primary key (uid, who));
alter table public.villager_aff enable row level security;
revoke all on public.villager_aff from anon, authenticated;

create or replace function public._story_who() returns text[] language sql immutable as $$ select array['chief', 'ling', 'mu', 'fu', 'gang'] $$;
create or replace function public._story_need(p_ch integer) returns integer language sql immutable as $$ select (array[15, 35, 60, 85, 100])[p_ch] $$;
create or replace function public._story_pay(p_ch integer) returns integer language sql immutable as $$ select (array[100, 150, 200, 300, 500])[p_ch] $$;

-- 每個人每天想要的魚（主島常見、稀有的魚，每位村民口味不同）
create or replace function public._story_ask(p_uid uuid, p_who text, p_day date) returns text language plpgsql immutable as $$
declare L text[] := case p_who
    when 'chief' then array['perch', 'crucian', 'tilapia', 'carp', 'catfish', 'mackerel']
    when 'ling'  then array['goldfish', 'guppy', 'medaka', 'zacco', 'ayu', 'perch']
    when 'mu'    then array['catfish', 'eel', 'snakehead', 'crucian', 'loach', 'perch']
    when 'fu'    then array['mackerel', 'scorpion', 'moonbream', 'squid', 'saury', 'sardine']
    else              array['mackerel', 'flounder', 'puffer', 'horsemack', 'mullet', 'girella'] end;
begin
  return L[1 + (public._fnv(p_uid::text || p_who || p_day::text) % cardinality(L))::integer];
end $$;

create or replace function public.story_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Taipei')::date; w text; a public.villager_aff; out jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then return out; end if;
  foreach w in array public._story_who() loop
    select * into a from public.villager_aff where uid = auth.uid() and who = w;
    out := out || jsonb_build_object('who', w, 'aff', coalesce(a.aff, 0), 'ch', coalesce(a.ch, 0),
      'ask', public._story_ask(auth.uid(), w, d), 'asked', coalesce(a.ask_day = d, false), 'talked', coalesce(a.talk_day = d, false),
      'next', case when coalesce(a.ch, 0) < 5 then public._story_need(coalesce(a.ch, 0) + 1) end);
  end loop;
  return out;
end $$;

-- 交今天的委託：p_t 是魚缸裡那條魚的時間（跟每日任務一樣）
create or replace function public.story_give(p_who text, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; f text := public._story_ask(pl.id, p_who, d); ok integer;
begin
  if not p_who = any(public._story_who()) then raise exception '沒有這位村民'; end if;
  if exists (select 1 from public.villager_aff where uid = pl.id and who = p_who and ask_day = d) then raise exception '今天已經幫過他了'; end if;
  select count(*) into ok from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = p_t and e->>'f' = f and not (coalesce(pl.show, '[]'::jsonb) @> jsonb_build_array(e->'t'));
  if ok <> 1 then raise exception '交的東西不對'; end if;
  update public.players set tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where not ((e->>'t')::bigint = p_t)),
    coins = coins + 80, earned = earned + 80, updated_at = now() where id = pl.id;
  insert into public.villager_aff (uid, who, aff, ask_day) values (pl.id, p_who, 15, d)
    on conflict (uid, who) do update set aff = least(100, villager_aff.aff + 15), ask_day = d;
  return jsonb_build_object('player', (select to_jsonb(p) from public.players p where p.id = pl.id), 'story', public.story_status());
end $$;

-- 打招呼：每天一次
create or replace function public.story_talk(p_who text) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  if not p_who = any(public._story_who()) then raise exception '沒有這位村民'; end if;
  insert into public.villager_aff (uid, who, aff, talk_day) values (auth.uid(), p_who, 3, d)
    on conflict (uid, who) do update set aff = least(100, villager_aff.aff + case when villager_aff.talk_day = d then 0 else 3 end), talk_day = d;
  return public.story_status();
end $$;

-- 讀下一章：好感夠了才讀得到，讀了拿金幣
create or replace function public.story_read(p_who text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.villager_aff; pay integer;
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  select * into a from public.villager_aff where uid = auth.uid() and who = p_who for update;
  if not found or a.ch >= 5 or a.aff < public._story_need(a.ch + 1) then raise exception '好感度還不夠'; end if;
  pay := public._story_pay(a.ch + 1);
  update public.villager_aff set ch = ch + 1 where uid = auth.uid() and who = p_who;
  update public.players set coins = coins + pay, earned = earned + pay, updated_at = now() where id = auth.uid();
  return jsonb_build_object('ch', a.ch + 1, 'pay', pay, 'player', (select to_jsonb(p) from public.players p where p.id = auth.uid()), 'story', public.story_status());
end $$;

do $$ declare f text; begin
  foreach f in array array['story_status()', 'story_give(text,bigint)', 'story_talk(text)', 'story_read(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '村民的故事設定完成 💌' as result;
