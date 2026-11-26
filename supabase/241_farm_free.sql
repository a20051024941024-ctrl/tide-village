-- 241 潮汐釣魚村 v876：自由種田。可以重複執行。要先貼過 239（買地）。
-- 田不分格子：在自己島上（中間那圈或買下的地，不能在沙灘）每 0.8 公尺一個位置，想種多密就種多密，一座島最多 300 株。
-- 位置編號 slot = 1000 + (z 格 + 75) * 151 + (x 格 + 75)。原本的菜園格子（0～99）、海底（100～999）照舊。
-- 另外加三個一次做很多株的（手指劃過去一起種、一起收、一起澆水）：一次最多 40 株，做不了的那株跳過。

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer; sea boolean := public._farm_is_sea(p_crop);
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 then raise exception '這一格還沒開墾'; end if;
  if p_slot >= 1000 then   -- v875 自由種田：在自己島上買下的地（或中間那圈）隨便種
    if sea then raise exception '這種種子要種在海底'; end if;
    if p_slot > 1000 + 151 * 151 then raise exception '這裡不能種'; end if;
    if not public._isle_land_ok(((((p_slot - 1000) % 151) - 75) * 0.8)::numeric, ((((p_slot - 1000) / 151) - 75) * 0.8)::numeric, 0.4, pl.isle_land) then raise exception '這裡不能種（要在自己買下的地上，不能在沙灘）'; end if;
    if (select count(*) from public.farm_plots where owner = pl.id and slot >= 1000) >= 300 then raise exception '田裡最多種 300 株，先收一些'; end if;
  elsif p_slot >= 100 then
    if not sea then raise exception '這種種子要種在菜園'; end if;
    if p_slot - 100 >= pl.sea_n then raise exception '這一格還沒開墾'; end if;
  else
    if sea then raise exception '這種種子要種在海底'; end if;
    if p_slot >= pl.farm_n then raise exception '這一格還沒開墾'; end if;
  end if;
  if exists (select 1 from public.farm_plots where owner = pl.id and slot = p_slot) then raise exception '這一格已經種東西了'; end if;
  have := coalesce((pl.bait ->> k)::integer, 0);
  if have < 1 and (sea or not public._farm_on_sale(p_crop)) then raise exception '背包裡沒有這種種子'; end if;
  if have < 1 and pl.coins < c.seed then raise exception '金幣不夠買種子'; end if;
  insert into public.farm_plots (owner, slot, crop) values (pl.id, p_slot, p_crop);
  if have >= 1 then
    update public.players set bait = case when have = 1 then bait - k else jsonb_set(bait, array[k], to_jsonb(have - 1)) end, updated_at = now() where id = pl.id returning * into pl;
  else
    update public.players set coins = coins - c.seed, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

create or replace function public.farm_water(p_owner uuid, p_slot integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); f public.farm_plots; own uuid := coalesce(p_owner, pl.id); today date := (now() at time zone 'Asia/Taipei')::date; pay integer := 0;
begin
  if p_slot >= 100 and p_slot < 1000 then raise exception '海底的不用澆水'; end if;
  select * into f from public.farm_plots where owner = own and slot = p_slot for update;
  if not found then raise exception '這一格沒有種東西'; end if;
  if now() >= public._farm_ripe_at(f.crop, f.planted_at, f.waters) then raise exception '已經成熟了，不用澆水'; end if;
  if f.waters >= 3 then raise exception '水已經夠了'; end if;
  if f.watered_at is not null and f.watered_at > now() - interval '1 hour' then raise exception '剛澆過水，一小時後再來'; end if;
  update public.farm_plots set waters = waters + 1, watered_at = now() where owner = own and slot = p_slot;
  if own <> pl.id then
    if pl.farm_help_day is distinct from today then pl.farm_help_n := 0; end if;
    if pl.farm_help_n < 10 then pay := 10; end if;
    update public.players set coins = coins + pay, earned = earned + pay, farm_help_day = today, farm_help_n = pl.farm_help_n + 1, updated_at = now() where id = pl.id returning * into pl;
  end if;
  return pl;
end $$;

create or replace function public.farm_plant_many(p_slots integer[], p_crop text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players; s integer; ok integer := 0; err text;
begin
  if coalesce(array_length(p_slots, 1), 0) > 40 then raise exception '一次最多種 40 株'; end if;
  foreach s in array coalesce(p_slots, array[]::integer[]) loop
    begin pl := public.farm_plant(s, p_crop); ok := ok + 1; exception when others then err := coalesce(err, sqlerrm); end;
  end loop;
  if pl.id is null then pl := public._me(); end if;
  return jsonb_build_object('player', to_jsonb(pl), 'n', ok, 'err', err);
end $$;

create or replace function public.farm_harvest_many(p_slots integer[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players; s integer; ok integer := 0; c0 integer; err text;
begin
  if coalesce(array_length(p_slots, 1), 0) > 40 then raise exception '一次最多收 40 株'; end if;
  c0 := (public._me()).coins;
  foreach s in array coalesce(p_slots, array[]::integer[]) loop
    begin pl := public.farm_harvest(s); ok := ok + 1; exception when others then err := coalesce(err, sqlerrm); end;
  end loop;
  if pl.id is null then pl := public._me(); end if;
  return jsonb_build_object('player', to_jsonb(pl), 'n', ok, 'got', pl.coins - c0, 'err', err);
end $$;

create or replace function public.farm_water_many(p_owner uuid, p_slots integer[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players; s integer; ok integer := 0; err text;
begin
  if coalesce(array_length(p_slots, 1), 0) > 40 then raise exception '一次最多澆 40 株'; end if;
  foreach s in array coalesce(p_slots, array[]::integer[]) loop
    begin pl := public.farm_water(p_owner, s); ok := ok + 1; exception when others then err := coalesce(err, sqlerrm); end;
  end loop;
  if pl.id is null then pl := public._me(); end if;
  return jsonb_build_object('player', to_jsonb(pl), 'n', ok, 'err', err);
end $$;

do $$ declare f text; begin
  foreach f in array array['farm_plant_many(integer[],text)', 'farm_harvest_many(integer[])', 'farm_water_many(uuid,integer[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
