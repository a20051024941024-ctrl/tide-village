-- 098 馬里亞納海溝的生物（v239）：可以重複執行
-- 黑淵裂縫的溝底多了真實世界在馬里亞納海溝記錄過的生物（遊戲裡把深度縮短了）：
--   馬里亞納獅子魚、深海鼬鳚、小飛象章魚、超巨型端足類、紫色游泳海參，各有白化
-- 只在潛水艇的 sub_cast 釣得到（重新定義 097 的 sub_cast，加進魚池；其他規則不變）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('marsnail', '馬里亞納獅子魚', '稀有', 0.03, 0.16), ('marsnail_albino', '白化馬里亞納獅子魚', '稀有', 0.03, 0.16),
  ('cuskeel', '深海鼬鳚', '稀有', 0.05, 0.3), ('cuskeel_albino', '白化深海鼬鳚', '稀有', 0.05, 0.3),
  ('dumbo', '小飛象章魚', '稀有', 0.2, 2.5), ('dumbo_albino', '白化小飛象章魚', '稀有', 0.2, 2.5),
  ('amphipod', '超巨型端足類', '常見', 0.02, 0.12), ('amphipod_albino', '白化超巨型端足類', '常見', 0.02, 0.12),
  ('seacuc', '紫色游泳海參', '常見', 0.1, 0.6), ('seacuc_albino', '白化游泳海參', '常見', 0.1, 0.6)
on conflict (id) do nothing;

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
  r := random() * tot; pick := ids[1];
  for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
  select * into sp from public.fish_species where id = pick;
  fw := round((sp.min_w + (sp.max_w - sp.min_w) * power(random(), 1.7))::numeric, 2);
  insert into public.casts (uid, spot, fish, w, at, shown_at) values (pl.id, 'trench', pick, fw, now(), null)
    on conflict (uid) do update set spot = 'trench', fish = excluded.fish, w = excluded.w, rs = null, sex = null, brood = null, gp = null, at = now(), shown_at = null;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sub_cast(integer) from public, anon;
grant execute on function public.sub_cast(integer) to authenticated;

select '馬里亞納海溝的生物設定完成 🐙' as result;
