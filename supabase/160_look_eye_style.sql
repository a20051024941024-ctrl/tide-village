-- 潮汐釣魚村 v411：外觀字串可以多帶「眼型」和「髮飾」（y0～y99、a0～a99，例如 h0c1s1e0y2a1）。這兩樣免費、不用買，其他檢查照 110 原樣。可以重複執行。
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer; m text[];
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k = 'look' then
      m := regexp_match(v, '^h([0-9]{1,2})c([0-9]{1,3})s[0-9]e[0-9](y[0-9]{1,2})?(a[0-9]{1,2})?$');
      if m is not null then
        if m[1]::int >= 10 and not (('hs' || m[1]::int) = any(coalesce(pl.owned, '{}'))) then raise exception '這個髮型要先找阿萍做'; end if;
        if m[2]::int >= 11 and not (('hc' || m[2]::int) = any(coalesce(pl.owned, '{}'))) then raise exception '這個髮色要先找阿萍染'; end if;
        g := g || jsonb_build_object('look', v);
      end if;
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
