-- 214 🧱 小島的小方塊和隔板（v672，作者 11/21：「自己的小島應該要加更多裝飾，比如一塊一塊的小方塊」「或隔板」→ 同意設計）。可以重複執行。
-- ・一格 50 公分，對齊格子。gx／gz 是格子編號（島中心是 0,0，往外一格 0.5 公尺），gy 是第幾層（0～5，最多 6 層）。
-- ・一塊存成 [gx, gz, gy, 種類, 方向(0～3), 誰放的(uid 前 8 碼)]。整座島最多 400 塊，跟一起住的人共用。
-- ・方塊要放在地上或另一塊上面（不能懸空）。拆掉退一半（只有自己放的才退；島主、管理成員可以拆別人的但不退錢）。
-- ・權限跟小島的東西一樣：島上的成員都能放（_isle_perm），拆別人的要管理以上。

create table if not exists public.isle_blocks (
  owner uuid primary key references public.players(id) on delete cascade,
  b jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.isle_blocks enable row level security;

create or replace function public._blk_price(t text) returns integer language sql immutable as $$
  select case t
    when 'wood' then 15 when 'stone' then 20 when 'brick' then 25 when 'glass' then 30 when 'grass' then 10 when 'sand' then 10
    when 'pr' then 20 when 'pw' then 20 when 'pb' then 20 when 'py' then 20 when 'pg' then 20 when 'pk' then 20
    when 'nw' then 20 when 'nb' then 30 when 'ns' then 40 when 'ng' then 50 when 'nl' then 40
    else null end $$;

create or replace function public.isle_blocks_get(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select b from public.isle_blocks where owner = p_owner), '[]'::jsonb) $$;

create or replace function public.isle_blocks_edit(p_owner uuid, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); rk int; cur jsonb; e jsonb; gx int; gz int; gy int; t text; r int; cost int := 0; back int := 0; me8 text; px numeric; pz numeric; n int; o jsonb; pr int;
begin
  if p_owner is null then p_owner := pl.id; end if;
  rk := public._perm_rank(public._isle_perm(p_owner, pl.id));
  if rk = 0 then raise exception '這不是你的島'; end if;
  me8 := left(pl.id::text, 8);
  insert into public.isle_blocks (owner) values (p_owner) on conflict (owner) do nothing;
  select b into cur from public.isle_blocks where owner = p_owner for update;
  if jsonb_typeof(p_del) = 'array' then
    for e in select * from jsonb_array_elements(p_del) loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int;
      select x into o from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy limit 1;
      if o is null then continue; end if;
      if rk < 2 and o->>5 <> me8 then raise exception '一般成員只能拆自己放的'; end if;
      -- 上面還有東西就不能拆（不然會懸空）
      if exists (select 1 from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy + 1)
         and not exists (select 1 from jsonb_array_elements(p_del) d where (d->>0)::int = gx and (d->>1)::int = gz and (d->>2)::int = gy + 1) then
        raise exception '上面還有東西，先拆上面的'; end if;
      cur := (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(cur) x where not ((x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy));
      if o->>5 = me8 then back := back + coalesce(public._blk_price(o->>3), 0) / 2; end if;
    end loop;
  end if;
  if jsonb_typeof(p_add) = 'array' then
    if jsonb_array_length(p_add) > 60 then raise exception '一次放太多了'; end if;
    for e in select * from jsonb_array_elements(p_add) loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int; t := e->>3; r := coalesce((e->>4)::int, 0) % 4;
      pr := public._blk_price(t); if pr is null then raise exception '沒有這種建材'; end if;
      if gy < 0 or gy > 5 then raise exception '最多疊 6 層'; end if;
      px := gx * 0.5; pz := gz * 0.5;
      if sqrt(px * px + pz * pz) > 22.6 then raise exception '放在島外面了'; end if;
      if abs(px) < 1.2 and pz > 17 then raise exception '會擋住碼頭的路'; end if;
      if exists (select 1 from jsonb_array_elements(cur) y where (y->>0)::int = gx and (y->>1)::int = gz and (y->>2)::int = gy) then continue; end if;   -- 已經有了：略過
      if gy > 0 and not exists (select 1 from jsonb_array_elements(cur) y where (y->>0)::int = gx and (y->>1)::int = gz and (y->>2)::int = gy - 1) then raise exception '不能懸空，下面要先有一塊'; end if;
      cur := cur || jsonb_build_array(jsonb_build_array(gx, gz, gy, t, r, me8));
      cost := cost + pr;
    end loop;
  end if;
  n := jsonb_array_length(cur);
  if n > 400 then raise exception '小島最多放 400 塊，先拆掉一些'; end if;
  if pl.coins + back < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost + back, updated_at = now() where id = pl.id returning * into pl;
  update public.isle_blocks set b = cur, updated_at = now() where owner = p_owner;
  return jsonb_build_object('b', cur, 'player', to_jsonb(pl), 'cost', cost, 'back', back);
end $$;

revoke all on function public.isle_blocks_get(uuid) from public, anon;
grant execute on function public.isle_blocks_get(uuid) to authenticated;
revoke all on function public.isle_blocks_edit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.isle_blocks_edit(uuid, jsonb, jsonb) to authenticated;

select '小島方塊設定完成 🧱' as result;
