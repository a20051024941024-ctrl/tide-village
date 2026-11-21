-- 218 🏗️ 小島蓋房子第二版（v681，作者 11/22：「應該怎麼加入讓玩家可以自己在小島上蓋自己喜歡的建築」→ 看過計畫「好」「直接做兩次」）。可以重複執行。
-- ・新的形狀：方塊 cb、半塊 hf、地磚 tl、斜坡 sl、階梯 st、圓角 qr、圓柱 cy、半圓頂 dm、拱頂 ar、門 dr（下）/dt（上）、圓窗 wr、方窗 ws、遮雨棚 aw。
-- ・新的形狀都可以選顏色：一塊存成 [gx, gz, gy, 種類, 方向(0～3), 誰放的, 顏色(0～23)]（舊的材質方塊沒有顏色這格）。顏色免費選。
-- ・最高疊到 16 層（gy 0～15），一座島最多 1500 塊，一次最多送 300 塊（拉一整面牆用）。
-- ・不能懸空：下面要有一塊，或旁邊（前後左右同一層）有一塊可以靠（屋簷、遮雨棚可以伸出去）。
-- ・🏆 本週人氣小島：isle_week_top()，照這星期（台灣時間星期一開始）收到的讚排前 10 名。

create or replace function public._blk_price(t text) returns integer language sql immutable as $$
  select case t
    when 'wood' then 15 when 'stone' then 20 when 'brick' then 25 when 'glass' then 30 when 'grass' then 10 when 'sand' then 10
    when 'pr' then 20 when 'pw' then 20 when 'pb' then 20 when 'py' then 20 when 'pg' then 20 when 'pk' then 20
    when 'nw' then 20 when 'nb' then 30 when 'ns' then 40 when 'ng' then 50 when 'nl' then 40
    when 'cb' then 12 when 'hf' then 8 when 'tl' then 5 when 'sl' then 15 when 'st' then 15 when 'qr' then 15 when 'cy' then 15 when 'dm' then 15
    when 'ar' then 20 when 'dr' then 20 when 'dt' then 20 when 'wr' then 25 when 'ws' then 25 when 'aw' then 15
    else null end $$;

create or replace function public.isle_blocks_edit(p_owner uuid, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); bag jsonb; bk text; rk int; cur jsonb; e jsonb; gx int; gz int; gy int; t text; r int; c int; cost int := 0; back int := 0; me8 text; px numeric; pz numeric; n int; o jsonb; pr int; nw jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  rk := public._perm_rank(public._isle_perm(p_owner, pl.id));
  if rk = 0 then raise exception '這不是你的島'; end if;
  me8 := left(pl.id::text, 8);
  bag := coalesce(pl.isle_bag, '{}'::jsonb);
  insert into public.isle_blocks (owner) values (p_owner) on conflict (owner) do nothing;
  select b into cur from public.isle_blocks where owner = p_owner for update;
  if jsonb_typeof(p_del) = 'array' then
    if jsonb_array_length(p_del) > 300 then raise exception '一次收太多了'; end if;
    for e in select * from jsonb_array_elements(p_del) loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int;
      select x into o from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy limit 1;
      if o is null then continue; end if;
      if rk < 2 and o->>5 <> me8 then raise exception '一般成員只能收自己放的'; end if;
      if exists (select 1 from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy + 1)
         and not exists (select 1 from jsonb_array_elements(p_del) d where (d->>0)::int = gx and (d->>1)::int = gz and (d->>2)::int = gy + 1) then
        raise exception '上面還有東西，先收上面的'; end if;
      cur := (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(cur) x where not ((x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy));
      if o->>5 = me8 then bk := 'b:' || (o->>3); bag := jsonb_set(bag, array[bk], to_jsonb(coalesce((bag->>bk)::int, 0) + 1)); end if;
    end loop;
  end if;
  if jsonb_typeof(p_add) = 'array' then
    if jsonb_array_length(p_add) > 300 then raise exception '一次放太多了'; end if;
    -- 由下往上放，一整面牆才不會被說懸空
    for e in select x from jsonb_array_elements(p_add) x order by (x->>2)::int loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int; t := e->>3; r := coalesce((e->>4)::int, 0) % 4;
      c := case when jsonb_array_length(e) > 6 and jsonb_typeof(e->6) = 'number' then least(23, greatest(0, (e->>6)::int)) else null end;
      pr := public._blk_price(t); if pr is null then raise exception '沒有這種建材'; end if;
      if gy < 0 or gy > 15 then raise exception '最多疊 16 層'; end if;
      px := gx * 0.5; pz := gz * 0.5;
      if sqrt(px * px + pz * pz) > 22.6 then raise exception '放在島外面了'; end if;
      if abs(px) < 1.2 and pz > 17 then raise exception '會擋住碼頭的路'; end if;
      if exists (select 1 from jsonb_array_elements(cur) y where (y->>0)::int = gx and (y->>1)::int = gz and (y->>2)::int = gy) then continue; end if;
      if gy > 0 and not exists (select 1 from jsonb_array_elements(cur) y where (y->>2)::int = gy - 1 and (y->>0)::int = gx and (y->>1)::int = gz)
         and not exists (select 1 from jsonb_array_elements(cur) y where (y->>2)::int = gy and abs((y->>0)::int - gx) + abs((y->>1)::int - gz) = 1) then
        raise exception '不能懸空，下面或旁邊要有一塊可以靠'; end if;
      nw := jsonb_build_array(gx, gz, gy, t, r, me8); if c is not null then nw := nw || to_jsonb(c); end if;
      cur := cur || jsonb_build_array(nw);
      bk := 'b:' || t; if coalesce((bag->>bk)::int, 0) > 0 then bag := jsonb_set(bag, array[bk], to_jsonb((bag->>bk)::int - 1)); else cost := cost + pr; end if;
    end loop;
  end if;
  n := jsonb_array_length(cur);
  if n > 1500 then raise exception '小島最多放 1500 塊，先收掉一些'; end if;
  if pl.coins + back < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost + back, isle_bag = bag, updated_at = now() where id = pl.id returning * into pl;
  update public.isle_blocks set b = cur, updated_at = now() where owner = p_owner;
  return jsonb_build_object('b', cur, 'player', to_jsonb(pl), 'cost', cost, 'back', back);
end $$;
revoke all on function public.isle_blocks_edit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.isle_blocks_edit(uuid, jsonb, jsonb) to authenticated;

-- 🏆 本週人氣小島：這星期收到最多讚的 10 座島（只給名字、讚數、方塊數）
create or replace function public.isle_week_top() returns jsonb language sql stable security definer set search_path = public as $$
  with wk as (select (date_trunc('week', (now() at time zone 'Asia/Taipei')))::date as d),
  l as (select owner, count(*)::int as n from public.island_likes, wk where day >= wk.d group by owner order by n desc limit 10)
  select coalesce(jsonb_agg(jsonb_build_object('id', l.owner, 'name', p.nickname, 'likes', l.n,
           'blocks', coalesce((select jsonb_array_length(b) from public.isle_blocks ib where ib.owner = l.owner), 0)) order by l.n desc), '[]'::jsonb)
  from l join public.players p on p.id = l.owner $$;
revoke all on function public.isle_week_top() from public, anon;
grant execute on function public.isle_week_top() to authenticated;

select '小島蓋房子第二版設定完成 🏗️' as result;
