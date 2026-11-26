-- 242（第 1 段，共 2 段）潮汐釣魚村 v879：小島改成一格一格開地。可以重複執行。要先貼過 239。
-- 一格 4×4 公尺（格子編號 i、j 從 -14 到 14；格子中心在 (4i, 4j)）。中間半徑 22 以內的格子一開始就是你的；
-- 其他格子在海岸線往內 5 公尺以上、不是峭壁，就可以開，但要跟你的地相連。價錢：150 + 3×已開格數，最多 600。開一格送 1 個漂流木。
-- 以前買的大塊地（isle_land）會換成那幾塊裡面所有的小格子。

alter table public.players add column if not exists isle_tiles integer[] not null default '{}';

create or replace function public._isl2_in(x double precision, z double precision) returns double precision language sql immutable as $$
  select public._isl2_shore(atan2(z, x)) - sqrt(x * x + z * z) $$;
create or replace function public._isl2_karst_near(x double precision, z double precision, pad double precision) returns boolean language sql immutable as $$
  select exists (select 1 from (values (32.89, -24.48, 5.0), (40.91, -16.19, 3.8), (23.53, -31.1, 3.6), (41.43, -23.24, 2.8), (45.42, -7.3, 2.6)) k(kx, kz, r)
    where sqrt((x - kx) ^ 2 + (z - kz) ^ 2) < r + pad) $$;
create or replace function public._isle_tile_id(i integer, j integer) returns integer language sql immutable as $$ select (j + 14) * 29 + (i + 14) $$;
create or replace function public._isle_tile_core(i integer, j integer) returns boolean language sql immutable as $$ select sqrt(((4 * i) ^ 2 + (4 * j) ^ 2)::double precision) <= 22 $$;
create or replace function public._isle_tile_ok(i integer, j integer) returns boolean language sql immutable as $$
  select abs(i) <= 14 and abs(j) <= 14 and not public._isle_tile_core(i, j) and public._isl2_in(4.0 * i, 4.0 * j) >= 5 and not public._isl2_karst_near(4.0 * i, 4.0 * j, 2.5) $$;
create or replace function public._isle_tile_mine(tiles integer[], i integer, j integer) returns boolean language sql immutable as $$
  select public._isle_tile_core(i, j) or public._isle_tile_id(i, j) = any(coalesce(tiles, '{}')) $$;
create or replace function public._isle_tiles_total() returns integer language sql immutable as $$
  select count(*)::integer from generate_series(-14, 14) i, generate_series(-14, 14) j where public._isle_tile_ok(i, j) $$;

/* 這個位置能不能蓋、能不能種：中間那圈可以；外面要是開好的格子、離海岸 3 公尺以上、不是峭壁 */
create or replace function public._isle_can(p_owner uuid, px numeric, pz numeric, m numeric) returns boolean language plpgsql stable as $$
declare r double precision; i integer; j integer; t integer[];
begin
  if px is null or pz is null then return false; end if;
  r := sqrt((px * px + pz * pz)::double precision);
  if r <= 24 - m then return true; end if;
  i := round(px / 4); j := round(pz / 4);
  select isle_tiles into t from public.players where id = p_owner;
  if not public._isle_tile_mine(t, i, j) then return false; end if;
  if public._isl2_karst_near(px::double precision, pz::double precision, 0.6) then return false; end if;
  return public._isl2_in(px::double precision, pz::double precision) >= 3 + m;
end $$;

/* 放東西的檢查：島主由 home_edit 先放進 tide.owner */
create or replace function public._isle_check(items jsonb, p_type text, p_x numeric, p_z numeric, p_skip integer) returns void language plpgsql stable as $$
declare me record; o record; it record; own uuid := nullif(current_setting('tide.owner', true), '')::uuid;
begin
  select * into me from public._isle_item(p_type);
  if me.price is null then raise exception '沒有這種東西'; end if;
  if not public._isle_can(own, p_x, p_z, me.rad * 0.6 + 0.6) then raise exception '放在島外面了（開好的地才能放）'; end if;
  if abs(p_x) < 1.4 + me.rad * 0.7 and p_z > 17 then raise exception '會擋住碼頭的路'; end if;
  for o in select * from jsonb_to_recordset(items) as x(id integer, t text, x numeric, z numeric, r numeric) loop
    if o.id = p_skip then continue; end if;
    select * into it from public._isle_item(o.t);
    if it.price is not null and sqrt((o.x - p_x) ^ 2 + (o.z - p_z) ^ 2) < (it.rad + me.rad) * 0.8 then raise exception '跟別的東西疊在一起了'; end if;
  end loop;
end $$;
create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tide.owner', coalesce(p_owner, (public._me()).id)::text, true);
  return public._home_edit0(p_owner, p_op, p);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

/* 以前買的大塊地換成小格子 */
update public.players p set isle_tiles = coalesce((select array_agg(public._isle_tile_id(i, j)) from generate_series(-14, 14) i, generate_series(-14, 14) j
    where public._isle_tile_ok(i, j) and ((p.isle_land >> floor((((atan2(4.0 * j, 4.0 * i) + 2 * pi())::numeric) % ((2 * pi())::numeric)) / ((pi() / 4)::numeric))::integer) & 1) = 1
      and floor((((atan2(4.0 * j, 4.0 * i) + 2 * pi())::numeric) % ((2 * pi())::numeric)) / ((pi() / 4)::numeric)) < 6), '{}')
  where p.isle_land > 0 and cardinality(p.isle_tiles) = 0;

/* 開一格地：要跟你的地相連 */
create or replace function public.isle_tile_buy(p_i integer, p_j integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer; price integer;
begin
  if p_i is null or p_j is null or not public._isle_tile_ok(p_i, p_j) then raise exception '這裡不能開'; end if;
  select * into pl from public.players where id = pl.id for update;
  if public._isle_tile_mine(pl.isle_tiles, p_i, p_j) then raise exception '這格已經是你的了'; end if;
  if not (public._isle_tile_mine(pl.isle_tiles, p_i + 1, p_j) or public._isle_tile_mine(pl.isle_tiles, p_i - 1, p_j) or public._isle_tile_mine(pl.isle_tiles, p_i, p_j + 1) or public._isle_tile_mine(pl.isle_tiles, p_i, p_j - 1)) then
    raise exception '要跟你的地連在一起才能開'; end if;
  n := cardinality(pl.isle_tiles); price := least(600, 150 + 3 * n);
  if pl.coins < price then raise exception '金幣不夠，這格要 % 金幣', price; end if;
  update public.players set coins = coins - price, isle_tiles = array_append(isle_tiles, public._isle_tile_id(p_i, p_j)),
    bait = public._bag_add(coalesce(bait, '{}'::jsonb), 'mat_wood', 1), updated_at = now()
    where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'price', price, 'n', n + 1, 'total', public._isle_tiles_total());
end $$;
revoke all on function public.isle_tile_buy(integer, integer) from public, anon;
grant execute on function public.isle_tile_buy(integer, integer) to authenticated;

create or replace function public.visit_isle(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'island', island, 'likes', likes, 'tank', public._show_tank(tank, show), 'show', show, 'land', isle_land, 'tiles', isle_tiles) from public.players where id = p_id $$;

notify pgrst, 'reload schema';
