-- 240（第 2 段，共 2 段）潮汐釣魚村 v873：方塊也可以蓋在買下的地上。要先貼 239。可以重複執行。
create or replace function public.isle_blocks_edit(p_owner uuid, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare lm integer; pl public.players := public._me(); bag jsonb; bk text; rk int; cur jsonb; e jsonb; gx int; gz int; gy int; t text; r int; c int; cost int := 0; back int := 0; me8 text; px numeric; pz numeric; n int; o jsonb; pr int; nw jsonb;
begin
  if p_owner is null then p_owner := pl.id; end if;
  lm := coalesce((select isle_land from public.players where id = p_owner), 0);
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
      if not public._isle_land_ok(px, pz, 1.4, lm) then raise exception '放在島外面了（買下的地才能蓋）'; end if;
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
notify pgrst, 'reload schema';
