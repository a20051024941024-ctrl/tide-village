-- 潮汐釣魚村 v303：玩家說「自己設計的衣服可以刪掉嗎」（可以重複執行）
-- drop_design：把一件設計從「我的衣服」拿掉。
--   自己設計的：同時從設計師市集下架；如果還沒有人買過，整件設計刪掉。有人買過就留著給買的人穿（他們的衣服不會不見）。
--   買來的：只從自己的衣櫃拿掉（不退錢）。
--   如果正穿著，會換回那一格的「不穿」。
create or replace function public.drop_design(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; item text; g jsonb;
begin
  select * into d from public.designs where id = p_id;
  if d.id is null then raise exception '找不到這件設計'; end if;
  item := d.kind || '_dz' || d.id;
  select * into pl from public.players where id = pl.id for update;
  if not (item = any(coalesce(pl.owned, '{}'))) and d.owner <> pl.id then raise exception '你沒有這件設計'; end if;
  g := coalesce(pl.gear, '{}'::jsonb);
  if g ->> d.kind = item then g := g - d.kind; end if;
  update public.players set owned = array_remove(coalesce(owned, '{}'), item), gear = g, updated_at = now() where id = pl.id returning * into pl;
  if d.owner = pl.id then
    if d.sold = 0 then delete from public.design_reports where design = d.id; delete from public.designs where id = d.id;
    else update public.designs set listed = false where id = d.id; end if;
  end if;
  return pl;
end $$;
revoke all on function public.drop_design(integer) from public, anon;
grant execute on function public.drop_design(integer) to authenticated;
