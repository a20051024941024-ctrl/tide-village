-- 217 📦 島上的東西「收起來」而不是拆掉退一半（v676，作者 11/22：「買的東西不是要拆掉退一半吧，而是整個收回吧」）。可以重複執行。
-- ・players.isle_bag：收起來的東西 {種類: 個數}，方塊和隔板是 {"b:種類": 個數}。收起來的東西回到當初付錢的那個人的包包。
-- ・isle_stow：把島上一件東西收起來（房子不行，房子還是用拆掉；別人放的要管理成員以上才能收，收回那個人的包包）。
-- ・isle_bag_place：從包包拿出來擺，不用再付錢。
-- ・方塊和隔板：拆掉＝收回包包（自己放的）；放的時候包包裡有就先用包包的，不扣錢。

alter table public.players add column if not exists isle_bag jsonb not null default '{}'::jsonb;

create or replace function public.isle_stow(p_owner uuid, p_id integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow public.players; o jsonb; rk int; payer uuid; t text; half int; r jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  rk := public._perm_rank(public._isle_perm(p_owner, pl.id));
  if rk = 0 then raise exception '這不是你的家'; end if;
  select * into ow from public.players where id = p_owner;
  select e into o from jsonb_array_elements(public._isle_items(public._isle_upgrade(ow.island))) e where (e->>'id')::int = p_id;
  if o is null then raise exception '找不到這個東西'; end if;
  t := o->>'t';
  if (public._isle_item(t)).house then raise exception '房子不能收起來（裡面還有家具），要拆的話用「拆掉」'; end if;
  payer := coalesce((o->>'by')::uuid, p_owner);
  if rk < 2 and payer <> pl.id then raise exception '一般成員只能收自己放的'; end if;
  if rk < 2 then   -- 一般成員：home_edit 的 remove 要管理以上，自己放的就直接處理
    raise exception '只有島主、共同島主、管理成員可以收東西';
  end if;
  r := public.home_edit(p_owner, 'remove', jsonb_build_object('id', p_id));   -- 會退一半給付錢的人，下面再扣回來，改成放進包包
  half := coalesce((public._isle_item(t)).price, 0) / 2;
  update public.players set coins = greatest(0, coins - half), isle_bag = jsonb_set(coalesce(isle_bag, '{}'::jsonb), array[t], to_jsonb(coalesce((isle_bag->>t)::int, 0) + 1)), updated_at = now() where id = payer;
  select * into pl from public.players where id = pl.id;
  return jsonb_build_object('island', r->'island', 'coins', pl.coins, 'bag', pl.isle_bag, 'to', case when payer = pl.id then null else (select nickname from public.players where id = payer) end);
end $$;

create or replace function public.isle_bag_place(p_owner uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t text := p->>'t'; price int; r jsonb;
begin
  if coalesce((pl.isle_bag->>t)::int, 0) <= 0 then raise exception '包包裡沒有這個'; end if;
  price := coalesce((public._isle_item(t)).price, 0);
  update public.players set coins = coins + price where id = pl.id;   -- 先把錢補上，home_edit 會照價扣掉
  r := public.home_edit(p_owner, 'place', p);
  update public.players set isle_bag = jsonb_set(isle_bag, array[t], to_jsonb((isle_bag->>t)::int - 1)), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('island', r->'island', 'coins', pl.coins, 'bag', pl.isle_bag);
end $$;

create or replace function public.isle_blocks_edit(p_owner uuid, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); bag jsonb; bk text; rk int; cur jsonb; e jsonb; gx int; gz int; gy int; t text; r int; cost int := 0; back int := 0; me8 text; px numeric; pz numeric; n int; o jsonb; pr int;
begin
  if p_owner is null then p_owner := pl.id; end if;
  rk := public._perm_rank(public._isle_perm(p_owner, pl.id));
  if rk = 0 then raise exception '這不是你的島'; end if;
  me8 := left(pl.id::text, 8);
  bag := coalesce(pl.isle_bag, '{}'::jsonb);
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
      if o->>5 = me8 then bk := 'b:' || (o->>3); bag := jsonb_set(bag, array[bk], to_jsonb(coalesce((bag->>bk)::int, 0) + 1)); end if;   -- 自己放的收回包包（不退錢）
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
      bk := 'b:' || t; if coalesce((bag->>bk)::int, 0) > 0 then bag := jsonb_set(bag, array[bk], to_jsonb((bag->>bk)::int - 1)); else cost := cost + pr; end if;   -- 包包裡有就用包包的
    end loop;
  end if;
  n := jsonb_array_length(cur);
  if n > 400 then raise exception '小島最多放 400 塊，先拆掉一些'; end if;
  if pl.coins + back < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost + back, isle_bag = bag, updated_at = now() where id = pl.id returning * into pl;
  update public.isle_blocks set b = cur, updated_at = now() where owner = p_owner;
  return jsonb_build_object('b', cur, 'player', to_jsonb(pl), 'cost', cost, 'back', back);
end $$;
revoke all on function public.isle_blocks_edit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.isle_blocks_edit(uuid, jsonb, jsonb) to authenticated;

select '小島方塊設定完成 🧱' as result;


revoke all on function public.isle_stow(uuid, integer) from public, anon; grant execute on function public.isle_stow(uuid, integer) to authenticated;
revoke all on function public.isle_bag_place(uuid, jsonb) from public, anon; grant execute on function public.isle_bag_place(uuid, jsonb) to authenticated;
revoke all on function public.isle_blocks_edit(uuid, jsonb, jsonb) from public, anon; grant execute on function public.isle_blocks_edit(uuid, jsonb, jsonb) to authenticated;

select '收起來設定完成 📦' as result;
