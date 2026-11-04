-- 潮汐釣魚村：動態海洋生態（架構第八階段；可以重複執行）
-- 三個海域各有自己的規則：
--   coast 本島沿海（海邊、外海、珊瑚礁、石滬、紅樹林）：暖水，夏天 29 度、冬天 21 度
--   north 北方冰封群島的流冰海岸：冷水，夏天 8 度、冬天 -1 度
--   fresh 河、湖、溪、池塘：跟著氣溫走，變化比較大
-- 每小時（pg_cron；手機讀的時候太久沒更新也會補）：
--   水溫 = 季節 + 一天的起伏 + 天氣（下雨、暴風雨會變冷）；海流方向跟著潮汐轉，速度跟著天氣；浮游生物跟水溫、海流（湧升流）有關。
--   魚類洄游：照水溫和月份，某些魚會游到某些釣點（例如秋冬水溫降下來，秋刀魚、鯖魚到外海；夏天鬼頭刀、鮪魚到外海；春天毛鱗魚到流冰海岸）。
--   魚群：浮游生物多的時候，偶爾在某個海邊釣點出現一大群常見魚（2 小時、×2.5）。
--   保育事件：每週輪流保護一種稀有的海洋生物 3 天，這段時間釣不到（機率 0），讓牠們好好生小孩。
-- 這些都寫進 ocean_eco，伺服器抽魚（roll_fish）時直接乘上去；每個大廳、每支手機看到的一樣。

create table if not exists public.ocean_state (
  region text primary key, temp numeric not null, cur_dir numeric not null default 0, cur_spd numeric not null default 0.3, plankton numeric not null default 0.5, updated_at timestamptz not null default now());
create table if not exists public.ocean_eco (
  spot text not null, fish text not null, mult numeric not null, kind text not null, label text not null default '', until timestamptz not null,
  primary key (spot, fish, kind));
create table if not exists public.ocean_events (id bigserial primary key, kind text not null, label text not null, fish text, spot text, starts timestamptz not null default now(), ends timestamptz not null);
alter table public.ocean_state enable row level security; alter table public.ocean_eco enable row level security; alter table public.ocean_events enable row level security;
revoke all on public.ocean_state from anon, authenticated; revoke all on public.ocean_eco from anon, authenticated; revoke all on public.ocean_events from anon, authenticated;
create table if not exists public.ocean_clock (id integer primary key default 1 check (id = 1), last_tick timestamptz not null default now() - interval '2 hours');
insert into public.ocean_clock (id) values (1) on conflict do nothing;
alter table public.ocean_clock enable row level security; revoke all on public.ocean_clock from anon, authenticated;

-- 洄游規則：哪種魚、到哪個釣點、什麼水溫、幾月、幾倍
create or replace function public._ocean_rules() returns jsonb language sql immutable as $$ select '[
  {"fish":"saury","spot":"harbor","region":"coast","tmin":0,"tmax":25.5,"months":[9,10,11,12],"mult":3,"label":"秋刀魚南下洄游到外海"},
  {"fish":"mackerel","spot":"harbor","region":"coast","tmin":0,"tmax":25,"months":[10,11,12,1,2],"mult":2.2,"label":"鯖魚群跟著冷水來到外海"},
  {"fish":"mahi","spot":"harbor","region":"coast","tmin":27,"tmax":40,"months":[5,6,7,8,9],"mult":2.5,"label":"鬼頭刀跟著黑潮游過外海"},
  {"fish":"tuna","spot":"harbor","region":"coast","tmin":26,"tmax":40,"months":[4,5,6],"mult":2,"label":"黑鮪魚北上洄游經過外海"},
  {"fish":"mullet","spot":"mangrove","region":"coast","tmin":0,"tmax":23,"months":[12,1,2],"mult":2.5,"label":"烏魚隨著冬天的冷水游進紅樹林"},
  {"fish":"capelin","spot":"icesea","region":"north","tmin":-5,"tmax":6,"months":[3,4,5,6],"mult":2.5,"label":"毛鱗魚成群游到流冰海岸產卵"},
  {"fish":"cod","spot":"icesea","region":"north","tmin":-5,"tmax":4,"months":[12,1,2,3],"mult":2,"label":"鱈魚在最冷的時候靠近海岸"},
  {"fish":"wakasagi","spot":"icelake","region":"fresh","tmin":-10,"tmax":10,"months":[12,1,2,3],"mult":1.8,"label":"冰湖的公魚最肥的季節"}
]'::jsonb $$;
-- 輪流保育的物種（要是在 fish_species 裡真的有的才會選到）
create or replace function public._ocean_protect() returns text[] language sql immutable as $$ select array['turtle', 'sawfish', 'whaleshark', 'manta', 'dolphin', 'sleepershark', 'ito', 'hammer'] $$;

create or replace function public._ocean_tick() returns integer language plpgsql security definer set search_path = public as $$
declare c public.ocean_clock; tw timestamptz := now() at time zone 'Asia/Taipei'; mo int := extract(month from now() at time zone 'Asia/Taipei')::int; hr numeric := public._tw_hour(now());
  wx text := public._wx_at(now()); season numeric := cos((extract(doy from now() at time zone 'Asia/Taipei') - 213) / 365.0 * 2 * pi());   -- 8 月初最熱 = 1，2 月初最冷 = -1
  ms bigint := (extract(epoch from now()) * 1000)::bigint; tide numeric; r jsonb; t numeric; st public.ocean_state; spots text[] := array['sea', 'harbor', 'reef', 'weir']; sp text; pool text[]; f text; wk int; prot text; n int := 0;
begin
  select * into c from public.ocean_clock where id = 1 for update skip locked; if c.id is null then return -1; end if;
  if now() - c.last_tick < interval '50 minutes' then return 0; end if;
  tide := sin((ms % (public._fishcfg()->>'tidePeriod')::bigint)::numeric / (public._fishcfg()->>'tidePeriod')::numeric * 2 * pi());
  -- 水溫、海流、浮游生物
  for r in select * from jsonb_array_elements('[{"k":"coast","mid":25,"amp":4,"day":0.6},{"k":"north","mid":3.5,"amp":4.5,"day":0.3},{"k":"fresh","mid":20,"amp":8,"day":2.2}]'::jsonb) loop
    t := (r->>'mid')::numeric + (r->>'amp')::numeric * season + (r->>'day')::numeric * sin((hr - 9) / 24 * 2 * pi()) + case wx when 'rain' then -0.6 when 'storm' then -1.4 when 'sunny' then 0.3 else 0 end + (random() - 0.5) * 0.4;
    insert into public.ocean_state (region, temp, cur_dir, cur_spd, plankton) values (r->>'k', round(t, 1), 0, 0.3, 0.5) on conflict (region) do nothing;
    select * into st from public.ocean_state where region = r->>'k';
    update public.ocean_state set temp = round(st.temp * 0.6 + t * 0.4, 1),
      cur_dir = round(((case when tide > 0 then 30 else 210 end) + (random() - 0.5) * 40)::numeric, 0),
      cur_spd = round(least(2.5, 0.2 + abs(tide) * 0.6 + case wx when 'storm' then 1.2 when 'rain' then 0.3 else 0 end)::numeric, 2),
      plankton = round(least(1, greatest(0, st.plankton * 0.7 + (0.35 + abs(tide) * 0.35 + case when abs(st.temp - (r->>'mid')::numeric) < 2 then 0.15 else 0 end + (random() - 0.5) * 0.2) * 0.3))::numeric, 2),
      updated_at = now() where region = r->>'k';
  end loop;
  delete from public.ocean_eco where until < now() or kind = 'migrate';
  -- 洄游
  for r in select * from jsonb_array_elements(public._ocean_rules()) loop
    if not exists (select 1 from public.fish_species where id = r->>'fish') then continue; end if;
    select * into st from public.ocean_state where region = r->>'region';
    if r->'months' @> to_jsonb(mo) and st.temp between (r->>'tmin')::numeric and (r->>'tmax')::numeric then
      insert into public.ocean_eco (spot, fish, mult, kind, label, until) values (r->>'spot', r->>'fish', (r->>'mult')::numeric, 'migrate', r->>'label', now() + interval '70 minutes')
        on conflict (spot, fish, kind) do update set mult = excluded.mult, label = excluded.label, until = excluded.until;
      n := n + 1;
    end if;
  end loop;
  -- 魚群：沿海浮游生物多的時候，偶爾在一個海邊釣點出現一大群常見魚
  select * into st from public.ocean_state where region = 'coast';
  if st.plankton > 0.55 and random() < 0.5 and not exists (select 1 from public.ocean_eco where kind = 'school' and until > now()) then
    sp := spots[1 + floor(random() * array_length(spots, 1))::int];
    select array_agg(x) into pool from jsonb_array_elements_text(public._fishcfg()->'spots'->sp->'fish') x join public.fish_species s on s.id = x where s.rarity = '常見' and not (public._fishcfg()->'fish'->x ? 'v');
    if pool is not null then f := pool[1 + floor(random() * array_length(pool, 1))::int];
      insert into public.ocean_eco (spot, fish, mult, kind, label, until) values (sp, f, 2.5, 'school', '浮游生物變多，一大群' || (select name from public.fish_species where id = f) || '聚過來了', now() + interval '2 hours') on conflict (spot, fish, kind) do update set until = excluded.until, label = excluded.label;
      insert into public.ocean_events (kind, label, fish, spot, ends) values ('school', '一大群' || (select name from public.fish_species where id = f) || '出現在' || sp, f, sp, now() + interval '2 hours'); end if;
  end if;
  -- 保育事件：每週輪流一種，前 3 天保護（釣不到）
  wk := floor(extract(epoch from now()) / (7 * 86400))::int;
  select x into prot from unnest(public._ocean_protect()) with ordinality u(x, i) where exists (select 1 from public.fish_species where id = x) order by i offset (wk % greatest(1, (select count(*) from unnest(public._ocean_protect()) x2 where exists (select 1 from public.fish_species where id = x2)))::int) limit 1;
  delete from public.ocean_eco where kind = 'protect' and fish <> coalesce(prot, '');
  if prot is not null and extract(epoch from now()) - wk * 7 * 86400 < 3 * 86400 then
    for sp in select key from jsonb_each(public._fishcfg()->'spots') where value->'fish' ? prot loop
      insert into public.ocean_eco (spot, fish, mult, kind, label, until) values (sp, prot, 0, 'protect', (select name from public.fish_species where id = prot) || '保育週：這幾天讓牠們好好生小孩，釣不到喔', to_timestamp((wk * 7 + 3) * 86400))
        on conflict (spot, fish, kind) do nothing;
    end loop;
    if not exists (select 1 from public.ocean_events where kind = 'protect' and fish = prot and ends > now()) then insert into public.ocean_events (kind, label, fish, ends) values ('protect', (select name from public.fish_species where id = prot) || '保育週', prot, to_timestamp((wk * 7 + 3) * 86400)); end if;
  end if;
  delete from public.ocean_events where ends < now() - interval '7 days';
  update public.ocean_clock set last_tick = now() where id = 1;
  return n;
end $$;
revoke all on function public._ocean_tick() from public, anon, authenticated;

-- 手機讀的：三個海域的狀態、現在有效的洄游／魚群／保育
create or replace function public.ocean_now() returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if (select last_tick from public.ocean_clock where id = 1) < now() - interval '75 minutes' then perform public._ocean_tick(); end if;
  return jsonb_build_object(
    'state', (select coalesce(jsonb_object_agg(region, jsonb_build_object('temp', temp, 'dir', cur_dir, 'spd', cur_spd, 'pk', plankton)), '{}'::jsonb) from public.ocean_state),
    'eco', (select coalesce(jsonb_agg(jsonb_build_object('spot', spot, 'fish', fish, 'mult', mult, 'kind', kind, 'label', label, 'until', until) order by kind, spot), '[]'::jsonb) from public.ocean_eco where until > now()));
end $$;
revoke all on function public.ocean_now() from public, anon;
grant execute on function public.ocean_now() to authenticated;

do $$ begin
  perform public._ocean_tick();
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-ocean-tick', '4 * * * *', 'select public._ocean_tick()');
  end if;
end $$;

select '動態海洋生態設定完成 🌊' as result;
