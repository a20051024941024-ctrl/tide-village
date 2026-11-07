-- 110 阿萍不會停（v273）：髮色第 31 色以後每天自動調一色（最多到 999 號，外觀字串的髮色變成最多 3 位數）；髮型的最大編號改由 _salon_hs_max() 決定（每週加新髮型時改這裡）。可以重複執行。
create or replace function public._salon_hs_max() returns integer language sql immutable as $$ select 21 $$;
create or replace function public._salon_ok(p_kind text, p_n integer) returns boolean language sql stable as $$
  select case p_kind when 'hs' then p_n between 10 and public._salon_hs_max() and (p_n - 10) < 4 + public._salon_days() / 2
                     when 'hc' then p_n between 11 and 999 and (p_n - 11) < 3 + public._salon_days() else false end $$;

-- set_gear：外觀換成阿萍的新髮型、新髮色時，要先買過（其他照 051 原樣）
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer; m text[];
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k = 'look' then
      m := regexp_match(v, '^h([0-9]{1,2})c([0-9]{1,3})s[0-9]e[0-9]$');
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
