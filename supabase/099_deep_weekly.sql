-- 099 深海生物每週解鎖（v240）：可以重複執行
-- 黑淵裂縫的新生物不會一次全部出現：排在 deep_queue 裡，從 2026-11-06（星期五）開始每週五解鎖一種（ord 0、1、2…，白化跟本種同一週）。
-- 解鎖以前釣不到、圖鑑也看不到；解鎖了才加進潛水艇 sub_cast 的魚池。
-- 以後要加新的魚：在 deep_queue 最後面加一行（ord 接下去），fish_species 也要加，就會自動排進每週的順序。
-- deep_unlocked() 只回傳已經解鎖的魚 id（不會透露下週是什麼）。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('barreleye', '管眼魚', '稀有', 0.05, 0.25),
  ('barreleye_albino', '白化管眼魚', '稀有', 0.05, 0.25),
  ('gulper', '寬咽魚', '稀有', 0.2, 1.5),
  ('gulper_albino', '白化寬咽魚', '稀有', 0.2, 1.5),
  ('viperfish', '蝰魚', '稀有', 0.05, 0.3),
  ('viperfish_albino', '白化蝰魚', '稀有', 0.05, 0.3),
  ('dragonfish', '巨口魚', '稀有', 0.1, 0.6),
  ('dragonfish_albino', '白化巨口魚', '稀有', 0.1, 0.6),
  ('hatchetfish', '斧頭魚', '常見', 0.01, 0.06),
  ('hatchetfish_albino', '白化斧頭魚', '常見', 0.01, 0.06),
  ('tripodfish', '三腳架魚', '常見', 0.1, 0.5),
  ('tripodfish_albino', '白化三腳架魚', '常見', 0.1, 0.5),
  ('swallower', '黑叉齒魚', '稀有', 0.05, 0.3),
  ('swallower_albino', '白化黑叉齒魚', '稀有', 0.05, 0.3),
  ('chimaera', '銀鮫', '稀有', 0.5, 4),
  ('chimaera_albino', '白化銀鮫', '稀有', 0.5, 4),
  ('hagfish', '盲鰻', '常見', 0.1, 0.8),
  ('hagfish_albino', '白化盲鰻', '常見', 0.1, 0.8),
  ('isopod', '大王具足蟲', '稀有', 0.5, 1.7),
  ('isopod_albino', '白化大王具足蟲', '稀有', 0.5, 1.7),
  ('redshrimp', '深海紅蝦', '常見', 0.01, 0.05),
  ('redshrimp_albino', '白化深海紅蝦', '常見', 0.01, 0.05),
  ('frilledshark', '皺鰓鯊', '傳說', 20, 90),
  ('frilledshark_albino', '白化皺鰓鯊', '傳說', 20, 90)
on conflict (id) do nothing;

create table if not exists public.deep_queue (id text primary key, ord integer not null, min_depth integer not null default 1500, wt numeric not null default 1);
alter table public.deep_queue enable row level security;
revoke all on public.deep_queue from anon, authenticated;
insert into public.deep_queue (id, ord, min_depth, wt) values
  ('barreleye', 0, 600, 2.0),
  ('barreleye_albino', 0, 600, 0.06),
  ('gulper', 1, 900, 1.6),
  ('gulper_albino', 1, 900, 0.048),
  ('viperfish', 2, 500, 1.8),
  ('viperfish_albino', 2, 500, 0.054),
  ('dragonfish', 3, 700, 1.6),
  ('dragonfish_albino', 3, 700, 0.048),
  ('hatchetfish', 4, 300, 4.0),
  ('hatchetfish_albino', 4, 300, 0.12),
  ('tripodfish', 5, 1500, 3.0),
  ('tripodfish_albino', 5, 1500, 0.09),
  ('swallower', 6, 1000, 1.4),
  ('swallower_albino', 6, 1000, 0.042),
  ('chimaera', 7, 500, 1.4),
  ('chimaera_albino', 7, 500, 0.042),
  ('hagfish', 8, 800, 2.6),
  ('hagfish_albino', 8, 800, 0.078),
  ('isopod', 9, 1500, 1.2),
  ('isopod_albino', 9, 1500, 0.036),
  ('redshrimp', 10, 800, 4.0),
  ('redshrimp_albino', 10, 800, 0.12),
  ('frilledshark', 11, 1200, 0.35),
  ('frilledshark_albino', 11, 1200, 0.0105)
on conflict (id) do update set ord = excluded.ord, min_depth = excluded.min_depth, wt = excluded.wt;

create or replace function public._deep_open(p_ord integer) returns boolean language sql stable as $$
  select now() >= timestamptz '2026-11-06 00:00+08' + make_interval(days => 7 * p_ord) $$;

create or replace function public.deep_unlocked() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(id order by ord, id), '[]'::jsonb) from public.deep_queue where public._deep_open(ord) $$;

create or replace function public.sub_cast(p_depth integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.sub_dives; dep integer := greatest(0, coalesce(p_depth, 0));
  ids text[] := '{}'; wts numeric[] := '{}'; tot numeric := 0; r numeric; pick text; sp public.fish_species; fw numeric; i integer;
begin
  d := public._sub_active(pl.id);
  if dep > d.pressure_m + 150 or dep > 3100 then
    update public.sub_dives set active = false, ended = now(), result = 'void', hold = '[]'::jsonb, max_depth = dep where id = d.id;
    return jsonb_build_object('void', true);   -- 不用 raise（raise 會把作廢的紀錄也一起取消）
  end if;
  if dep < 200 then raise exception '這裡太淺了，深海的魚在裂縫裡'; end if;
  if exists (select 1 from public.casts where uid = pl.id and spot = 'trench' and at > now() - interval '3 seconds') then raise exception '太快了'; end if;
  update public.sub_dives set max_depth = greatest(max_depth, dep) where id = d.id;
  -- 魚池：越深越多種；皇帶魚在 1000～1600 公尺的岩壁中段，大王魷魚只在 2500 公尺以下的溝底；
  -- 098：馬里亞納海溝的生物——小飛象章魚、游泳海參（1500 公尺以下）、超巨型端足類（2000 以下）、馬里亞納獅子魚、深海鼬鳚（2400 以下）
  for pick, r in select * from (values
      ('deeplantern', 10.0), ('deeplantern_albino', 0.12), ('vampsquid', case when dep >= 500 then 3.0 else 0 end), ('vampsquid_albino', case when dep >= 500 then 0.05 else 0 end),
      ('blobfish', case when dep >= 1200 then 3.0 else 0 end), ('blobfish_albino', case when dep >= 1200 then 0.05 else 0 end),
      ('rattail', case when dep >= 800 then 2.0 else 0 end), ('angler', case when dep >= 1000 then 0.5 else 0 end), ('angler_albino', case when dep >= 1000 then 0.012 else 0 end),
      ('oarfish', case when dep between 1000 and 1600 then 0.6 else 0 end), ('giantsquid', case when dep >= 2500 then 0.45 else 0 end),
      ('dumbo', case when dep >= 1500 then 1.6 else 0 end), ('dumbo_albino', case when dep >= 1500 then 0.05 else 0 end),
      ('seacuc', case when dep >= 1500 then 4.0 else 0 end), ('seacuc_albino', case when dep >= 1500 then 0.08 else 0 end),
      ('amphipod', case when dep >= 2000 then 6.0 else 0 end), ('amphipod_albino', case when dep >= 2000 then 0.12 else 0 end),
      ('marsnail', case when dep >= 2400 then 2.2 else 0 end), ('marsnail_albino', case when dep >= 2400 then 0.07 else 0 end),
      ('cuskeel', case when dep >= 2400 then 1.6 else 0 end), ('cuskeel_albino', case when dep >= 2400 then 0.05 else 0 end)) v(f, w) loop
    if r > 0 and exists (select 1 from public.fish_species where id = pick) then ids := ids || pick; wts := wts || r; tot := tot + r; end if;
  end loop;
  -- 099：排隊名單裡已經解鎖的深海生物也加進魚池（每週一種）
  for pick, r in select q.id, q.wt from public.deep_queue q where public._deep_open(q.ord) and dep >= q.min_depth loop
    if exists (select 1 from public.fish_species where id = pick) then ids := ids || pick; wts := wts || r; tot := tot + r; end if;
  end loop;
  r := random() * tot; pick := ids[1];
  for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
  select * into sp from public.fish_species where id = pick;
  fw := round((sp.min_w + (sp.max_w - sp.min_w) * power(random(), 1.7))::numeric, 2);
  insert into public.casts (uid, spot, fish, w, at, shown_at) values (pl.id, 'trench', pick, fw, now(), null)
    on conflict (uid) do update set spot = 'trench', fish = excluded.fish, w = excluded.w, rs = null, sex = null, brood = null, gp = null, at = now(), shown_at = null;
  return jsonb_build_object('ok', true);
end $$;

do $$ begin
  revoke all on function public.sub_cast(integer) from public, anon; grant execute on function public.sub_cast(integer) to authenticated;
  revoke all on function public.deep_unlocked() from public; grant execute on function public.deep_unlocked() to anon, authenticated;
end $$;

select '深海生物每週解鎖設定完成 🔬' as result;
