-- 234（第 2 段，共 3 段）潮汐釣魚村 v867：撿材料、分解魚鱗、入門材料包、浮標和路亞、釣竿耐久度。可以重複執行。要先貼過 233。
/* 撿垃圾（海邊或潛水）成功後馬上叫：有機會多撿到一樣材料。一天最多：海邊 15 樣、潛水 12 樣；而且不會比今天撿的垃圾多 */
create or replace function public.mat_bonus(p_src text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; cap integer; picks integer; x double precision; k text;
begin
  if p_src = 'litter' then
    if pl.litter_at is null or now() - pl.litter_at > interval '6 seconds' then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
    picks := case when pl.litter_day = td then pl.litter_n else 0 end; cap := 15;
  elsif p_src = 'dive' then
    if pl.dive_pick_at is null or now() - pl.dive_pick_at > interval '6 seconds' then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
    picks := case when pl.dive_day = td then pl.dive_trash else 0 end; cap := 12;
  else raise exception '沒有這種地方'; end if;
  select n into cnt from public.mat_log where uid = pl.id and day = td and src = p_src;
  if coalesce(cnt, 0) >= least(cap, picks) then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
  x := random();
  k := case when p_src = 'litter' then (case when x < 0.32 then 'shell' when x < 0.52 then 'net' when x < 0.70 then 'wood' when x < 0.73 then 'pink' else null end)
            else (case when x < 0.38 then 'coral' when x < 0.55 then 'net' when x < 0.62 then 'shell' when x < 0.66 then 'pink' else null end) end;
  insert into public.mat_log (uid, day, src, n) values (pl.id, td, p_src, 1) on conflict (uid, day, src) do update set n = public.mat_log.n + 1;
  if k is null then return jsonb_build_object('player', to_jsonb(pl), 'got', null); end if;
  update public.players set bait = public._bag_add(bait, 'mat_' || k, 1), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'got', k);
end $$;

/* 把魚分解成魚鱗：常見 1、稀有 3、傳說 8。用最輕的、不碰收藏／展示中／變種。一天最多分解 40 條 */
create or replace function public.mat_scale(p_r text, p_n integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; cnt integer; use text[]; per integer;
begin
  if p_r not in ('常見', '稀有', '傳說') or p_n is null or p_n < 1 or p_n > 20 then raise exception '一次可以分解 1～20 條'; end if;
  select * into pl from public.players where id = pl.id for update;
  select n into cnt from public.mat_log where uid = pl.id and day = td and src = 'scale';
  if coalesce(cnt, 0) + p_n > 40 then raise exception '今天分解夠多了（一天最多 40 條），明天再來'; end if;
  use := public._take_fish(pl, p_n, p_r); if use is null then raise exception '魚不夠：要 % 條%的魚（收藏、展示中、變種的不算）', p_n, p_r; end if;
  per := case p_r when '常見' then 1 when '稀有' then 3 else 8 end;
  update public.players set bait = public._bag_add(bait, 'mat_scale', per * p_n),
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.mat_log (uid, day, src, n) values (pl.id, td, 'scale', p_n) on conflict (uid, day, src) do update set n = public.mat_log.n + p_n;
  return jsonb_build_object('player', to_jsonb(pl), 'got', per * p_n);
end $$;

/* 入門材料包：每個人一次（夠做 2～3 樣東西） */
create or replace function public.mats_starter() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); b jsonb;
begin
  select * into pl from public.players where id = pl.id for update;
  if coalesce((pl.bait ->> 'mat_starter')::integer, 0) = 1 then return jsonb_build_object('player', to_jsonb(pl), 'got', false); end if;
  b := coalesce(pl.bait, '{}'::jsonb);
  b := public._bag_add(b, 'mat_shell', 6); b := public._bag_add(b, 'mat_net', 3); b := public._bag_add(b, 'mat_wood', 4);
  b := public._bag_add(b, 'mat_coral', 3); b := public._bag_add(b, 'mat_scale', 6); b := public._bag_add(b, 'mat_pink', 1);
  b := jsonb_set(b, '{mat_starter}', '1');
  update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'got', true);
end $$;

/* 裝上／拿下浮標或路亞（p_q 0＝拿下） */
create or replace function public.gear_equip(p_kind text, p_q integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pre text;
begin
  if p_kind not in ('float', 'lure') or p_q is null or p_q < 0 or p_q > 3 then raise exception '不能這樣裝'; end if;
  pre := case p_kind when 'float' then 'gf_' else 'gl_' end;
  if p_q > 0 and coalesce((pl.bait ->> (pre || p_q))::integer, 0) < 1 then raise exception '你沒有這個'; end if;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array['eq_' || p_kind], to_jsonb(p_q)), updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

/* 拉斷線：裝著的浮標或路亞少一個；用完了自動換成還有的（先換好的） */
create or replace function public.gear_lose(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pre text; q integer; b jsonb; nq integer := 0; i integer;
begin
  if p_kind not in ('float', 'lure') then raise exception '沒有這種東西'; end if;
  select * into pl from public.players where id = pl.id for update;
  pre := case p_kind when 'float' then 'gf_' else 'gl_' end; q := coalesce((pl.bait ->> ('eq_' || p_kind))::integer, 0);
  if q = 0 or coalesce((pl.bait ->> (pre || q))::integer, 0) < 1 then return jsonb_build_object('player', to_jsonb(pl), 'lost', 0); end if;
  b := public._bag_add(pl.bait, pre || q, -1);
  if coalesce((b ->> (pre || q))::integer, 0) > 0 then nq := q; else for i in reverse 3..1 loop if coalesce((b ->> (pre || i))::integer, 0) > 0 then nq := i; exit; end if; end loop; end if;
  b := jsonb_set(b, array['eq_' || p_kind], to_jsonb(nq));
  update public.players set bait = b, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'lost', q, 'next', nq);
end $$;

/* 釣竿磨損：只會變少。一次最多 -10 */
create or replace function public.rod_wear(p_rod text, p_n integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cur integer;
begin
  if p_rod is null or not (p_rod = any(pl.rods)) or p_n is null or p_n < 1 or p_n > 10 then return to_jsonb(pl); end if;
  cur := coalesce((pl.rod_dur ->> p_rod)::integer, 100);
  update public.players set rod_dur = jsonb_set(coalesce(rod_dur, '{}'::jsonb), array[p_rod], to_jsonb(greatest(0, cur - p_n))), updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

/* 用修竿包：耐久度 +40（最多 100） */
create or replace function public.rod_repair(p_rod text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cur integer;
begin
  select * into pl from public.players where id = pl.id for update;
  if p_rod is null or not (p_rod = any(pl.rods)) then raise exception '你沒有這支竿'; end if;
  if coalesce((pl.bait ->> 'g_repair')::integer, 0) < 1 then raise exception '沒有修竿包（阿鐵師傅的工坊可以做，或到市集買）'; end if;
  cur := coalesce((pl.rod_dur ->> p_rod)::integer, 100); if cur >= 100 then raise exception '這支竿還好好的，不用修'; end if;
  update public.players set bait = public._bag_add(bait, 'g_repair', -1), rod_dur = jsonb_set(coalesce(rod_dur, '{}'::jsonb), array[p_rod], to_jsonb(least(100, cur + 40))), updated_at = now()
    where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

do $$ declare f text; begin
  foreach f in array array['mat_bonus(text)', 'mat_scale(text,integer)', 'mats_starter()', 'gear_equip(text,integer)', 'gear_lose(text)', 'rod_wear(text,integer)', 'rod_repair(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
