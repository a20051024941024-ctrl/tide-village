-- 168 我的魚（v436）：每條魚可以取名字，箱網養大的魚記得「原本多重、餵過幾次」。可以重複執行。
-- 魚缸／箱網裡每條魚多三個可有可無的欄位：n＝名字、w0＝第一次放進箱網時的重量、fd＝在箱網被餵過幾次。
--   以前收成時會把 w0 丟掉，現在留著（收成後再放進去也不會被新的重量蓋掉），所以卡片上看得到「從幾公斤養到幾公斤」。
-- 名字：最多 8 個字、擋髒話（跟隊名、設計名字同一份 _name_bad）；兒童模式只能從固定名單選。空字串＝拿掉名字。
-- 價錢、排行榜、圖鑑都只看魚種和重量，名字和這些紀錄不影響任何數值。

create or replace function public._fish_names() returns text[] language sql immutable as $$
  select array['小胖','阿肥','泡泡','布丁','小不點','大頭','阿金','小花','饅頭','豆豆','球球','阿呆','小勇','閃閃','糖糖','老大'] $$;

create or replace function public.fish_name(p_ts bigint, p_name text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); nm text := btrim(coalesce(p_name, ''));
begin
  if nm <> '' then
    if char_length(nm) > 8 then raise exception '魚的名字最多 8 個字'; end if;
    if coalesce(pl.kid, false) and not (nm = any(public._fish_names())) then raise exception '兒童模式只能從名單裡選名字'; end if;
    if public._name_bad(nm) then raise exception '這個名字不行，換一個吧'; end if;
  end if;
  if not exists (select 1 from jsonb_array_elements(pl.tank || pl.cage) x where (x->>'t')::bigint = p_ts) then raise exception '找不到這條魚'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(case when (x->>'t')::bigint = p_ts then (case when nm = '' then x - 'n' else x || jsonb_build_object('n', nm) end) else x end order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality q(x, i)),
    cage = (select coalesce(jsonb_agg(case when (x->>'t')::bigint = p_ts then (case when nm = '' then x - 'n' else x || jsonb_build_object('n', nm) end) else x end order by i), '[]'::jsonb) from jsonb_array_elements(cage) with ordinality q(x, i)),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 箱網三個動作：內容跟 041 一樣，只多記 w0（保留最早的）和 fd（餵過幾次）
create or replace function public.cage_put(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb;
begin
  if jsonb_array_length(pl.cage) >= 6 then raise exception '箱網最多放 6 條'; end if;
  select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_ts and not (x ? 'rs') limit 1;
  if e is null then raise exception '找不到這條魚'; end if;
  if not public._cage_ok(e->>'f') then raise exception '這種魚不能放進箱網'; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality q(x, i) where (x->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    cage = cage || jsonb_build_array((e - 'fm') || jsonb_build_object('w0', coalesce(e->'w0', e->'w'), 'at', (extract(epoch from now()) * 1000)::bigint)),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.cage_feed() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if jsonb_array_length(pl.cage) = 0 then raise exception '箱網裡還沒有魚'; end if;
  if pl.cage_fed = d then raise exception '今天已經餵過了'; end if;
  if pl.coins < 20 then raise exception '金幣不夠'; end if;
  update public.players set
    cage = (select coalesce(jsonb_agg(x || jsonb_build_object('w', least(sp.max_w, round((x->>'w')::numeric + (sp.max_w - (x->>'w')::numeric) * 0.12, 2)), 'fd', coalesce((x->>'fd')::integer, 0) + 1) order by i), '[]'::jsonb)
            from jsonb_array_elements(cage) with ordinality q(x, i) join public.fish_species sp on sp.id = x->>'f'),
    coins = coins - 20, cage_fed = d, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.cage_take(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); e jsonb;
begin
  select x into e from jsonb_array_elements(pl.cage) x where (x->>'t')::bigint = p_ts limit 1;
  if e is null then raise exception '找不到這條魚'; end if;
  update public.players set
    cage = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(cage) with ordinality q(x, i) where (x->>'t')::bigint <> p_ts),
    tank = public._trim_tank(jsonb_build_array((e - 'at') || jsonb_build_object('fm', true)) || tank, show),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['fish_name(bigint,text)', 'cage_put(bigint)', 'cage_feed()', 'cage_take(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
