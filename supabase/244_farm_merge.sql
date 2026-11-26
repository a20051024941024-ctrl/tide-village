-- 244 潮汐釣魚村 v880：原本西邊的格子菜園合併進自由種田。可以重複執行。要先貼 242、243。
-- ・菜園那塊地（格子 i -9～-6、j -1～1）直接算你的，不用開。
-- ・原本格子田裡種的東西，搬到同一個位置的自由田（照原本的時間繼續長、澆水次數也保留）。
-- ・以前花錢開墾的格數不浪費：自由田上限 = 300 + 5×格數（12 格的人是 360 株）。

create or replace function public._isle_tile_core(i integer, j integer) returns boolean language sql immutable as $$
  select sqrt(((4 * i) ^ 2 + (4 * j) ^ 2)::double precision) <= 22 or (i between -9 and -6 and j between -1 and 1) $$;

/* 搬家：格子 s（0～11）原本在 x = -32.1 + (s%4)×2.4、z = (s/4 - 1)×3（相對島中心） */
update public.farm_plots f set slot = 1000 + (round(((f.slot / 4) - 1) * 3 / 0.8) + 75)::integer * 151 + (round((-32.1 + (f.slot % 4) * 2.4) / 0.8) + 75)::integer
  where f.slot < 100
    and not exists (select 1 from public.farm_plots g where g.owner = f.owner and g.slot = 1000 + (round(((f.slot / 4) - 1) * 3 / 0.8) + 75)::integer * 151 + (round((-32.1 + (f.slot % 4) * 2.4) / 0.8) + 75)::integer);

create or replace function public.farm_plant(p_slot integer, p_crop text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c record; k text := 'seed_' || p_crop; have integer; sea boolean := public._farm_is_sea(p_crop);
begin
  select * into c from public._farm_crop(p_crop);
  if c.seed is null then raise exception '沒有這種種子'; end if;
  if p_slot is null or p_slot < 0 then raise exception '這一格還沒開墾'; end if;
  if p_slot >= 1000 then   -- v875 自由種田：在自己島上買下的地（或中間那圈）隨便種
    if sea then raise exception '這種種子要種在海底'; end if;
    if p_slot > 1000 + 151 * 151 then raise exception '這裡不能種'; end if;
    if not public._isle_can(pl.id, ((((p_slot - 1000) % 151) - 75) * 0.8)::numeric, ((((p_slot - 1000) / 151) - 75) * 0.8)::numeric, 0.4) then raise exception '這裡不能種（要在自己開好的地上，不能在沙灘）'; end if;
    if (select count(*) from public.farm_plots where owner = pl.id and slot >= 1000) >= 300 + 5 * coalesce(pl.farm_n, 4) then raise exception '田裡最多種 % 株，先收一些', 300 + 5 * coalesce(pl.farm_n, 4); end if;
  elsif p_slot >= 100 then
    if not sea then raise exception '這種種子要種在菜園'; end if;
    if p_slot - 100 >= pl.sea_n then raise exception '這一格還沒開墾'; end if;
  else
    raise exception '菜園改成自由種了：拿著種子在田裡按「種田」';
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

notify pgrst, 'reload schema';
