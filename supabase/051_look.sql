-- 潮汐釣魚村：角色外觀（髮型、髮色、膚色、眼睛顏色），全部免費，存在 gear.look（例如 'h3c2s1e0'）（可以重複執行）
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer;
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k = 'look' then
      if v ~ '^h[0-9]{1,2}c[0-9]{1,2}s[0-9]e[0-9]$' then g := g || jsonb_build_object('look', v); end if;
      continue;
    end if;
    if k not in ('hat','top','pants','shoes','socks','acc','back','face') then continue; end if;
    if v ~ '^(top|pants|hat|shoes|back|acc)_dz[0-9]+$' then
      if split_part(v, '_', 1) <> k or not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
      g := g || jsonb_build_object(k, v); continue;
    end if;
    pr := coalesce(public._item_price(v), case when public._love_price(v) is not null then -1 end);
    if pr is null or split_part(v, '_', 1) <> k then raise exception '沒有這個商品'; end if;
    if pr <> 0 and not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
    g := g || jsonb_build_object(k, v);
  end loop;
  update public.players set gear = g, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.set_gear(jsonb) from public, anon;
grant execute on function public.set_gear(jsonb) to authenticated;

select '角色外觀設定完成 💇' as result;
