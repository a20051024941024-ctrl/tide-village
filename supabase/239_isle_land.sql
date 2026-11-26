-- 239（第 1 段，共 2 段）潮汐釣魚村 v873：小島買地。可以重複執行。
-- 小島變大了：中間半徑 24 公尺照舊是你的，外面分 6 塊地（扇形，東北邊兩塊是峭壁不能買）。
-- 買了才能在那塊地上放房子、方塊、家具；買一塊砍下來的樹變成 6 個漂流木。價錢照順序：2,000 → 4,000 → 7,000 → 11,000 → 16,000 → 22,000。

alter table public.players add column if not exists isle_land integer not null default 0;

/* 海岸線（跟遊戲裡 isl2Shore 一樣）：th 是 atan2(z, x) */
create or replace function public._isl2_shore(th double precision) returns double precision language plpgsql immutable as $$
declare r double precision; ds double precision; k double precision;
begin
  r := 45 + 5 * sin(2 * th + 0.6) + 2.2 * sin(3 * th + 2.1) + 1.3 * sin(5 * th + 1.3) + 0.6 * sin(9 * th);
  ds := abs(th - pi() / 2); if ds > pi() then ds := 2 * pi() - ds; end if;
  k := case when ds < 0.22 then 1 when ds > 0.6 then 0 else 1 - (ds - 0.22) / 0.38 end;
  return r * (1 - k) + 28.6 * k;
end $$;

/* 這個位置能不能蓋：中間那圈可以；外面要是買下的地，而且離海岸至少 3 公尺 */
create or replace function public._isle_land_ok(px numeric, pz numeric, m numeric, mask integer) returns boolean language plpgsql immutable as $$
declare r double precision; th double precision; s integer;
begin
  if px is null or pz is null then return false; end if;
  r := sqrt((px * px + pz * pz)::double precision);
  if r <= 24 - m then return true; end if;
  th := atan2(pz::double precision, px::double precision);
  s := floor((((th + 2 * pi())::numeric) % ((2 * pi())::numeric)) / ((pi() / 4)::numeric))::integer;
  if s >= 6 or ((coalesce(mask, 0) >> s) & 1) = 0 then return false; end if;
  return public._isl2_shore(th) - r >= 3 + m;
end $$;

/* 放東西的檢查改成看買下的地（地的資料由外面 home_edit 先放進 tide.land） */
create or replace function public._isle_check(items jsonb, p_type text, p_x numeric, p_z numeric, p_skip integer) returns void language plpgsql stable as $$
declare me record; o record; it record; mask integer := coalesce(nullif(current_setting('tide.land', true), '')::integer, 0);
begin
  select * into me from public._isle_item(p_type);
  if me.price is null then raise exception '沒有這種東西'; end if;
  if not public._isle_land_ok(p_x, p_z, me.rad * 0.6 + 0.6, mask) then raise exception '放在島外面了（買下的地才能放）'; end if;
  if abs(p_x) < 1.4 + me.rad * 0.7 and p_z > 17 then raise exception '會擋住碼頭的路'; end if;
  for o in select * from jsonb_to_recordset(items) as x(id integer, t text, x numeric, z numeric, r numeric) loop
    if o.id = p_skip then continue; end if;
    select * into it from public._isle_item(o.t);
    if it.price is not null and sqrt((o.x - p_x) ^ 2 + (o.z - p_z) ^ 2) < (it.rad + me.rad) * 0.8 then raise exception '跟別的東西疊在一起了'; end if;
  end loop;
end $$;

/* home_edit 外面包一層：先查島主買了哪幾塊地 */
do $$ begin
  if to_regprocedure('public.home_edit(uuid,text,jsonb)') is not null and to_regprocedure('public._home_edit0(uuid,text,jsonb)') is null then
    alter function public.home_edit(uuid, text, jsonb) rename to _home_edit0;
  end if;
end $$;
revoke all on function public._home_edit0(uuid, text, jsonb) from public, anon, authenticated;
create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tide.land', coalesce((select isle_land from public.players where id = coalesce(p_owner, (public._me()).id)), 0)::text, true);
  return public._home_edit0(p_owner, p_op, p);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

/* 買地：p_sect 0～5（從東邊開始順時針……就是遊戲裡的扇形編號） */
create or replace function public.isle_land_buy(p_sect integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer; price integer; prices integer[] := array[2000, 4000, 7000, 11000, 16000, 22000];
begin
  if p_sect is null or p_sect < 0 or p_sect > 5 then raise exception '這塊地不能買'; end if;
  select * into pl from public.players where id = pl.id for update;
  if ((pl.isle_land >> p_sect) & 1) = 1 then raise exception '這塊地已經是你的了'; end if;
  n := length(replace((pl.isle_land & 63)::bit(6)::text, '0', ''));
  price := prices[n + 1];
  if pl.coins < price then raise exception '金幣不夠，這塊要 % 金幣', price; end if;
  update public.players set coins = coins - price, isle_land = isle_land | (1 << p_sect),
    bait = public._bag_add(coalesce(bait, '{}'::jsonb), 'mat_wood', 6), updated_at = now()
    where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl), 'price', price, 'wood', 6);
end $$;
revoke all on function public.isle_land_buy(integer) from public, anon;
grant execute on function public.isle_land_buy(integer) to authenticated;

/* 去別人的島：多給「買了哪幾塊地」 */
create or replace function public.visit_isle(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'island', island, 'likes', likes, 'tank', public._show_tank(tank, show), 'show', show, 'land', isle_land) from public.players where id = p_id $$;

notify pgrst, 'reload schema';
