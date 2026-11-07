-- 109 阿萍美髮沙龍（v270）：新髮型（hs10～hs21）、新髮色（hc11～hc40）要找阿萍買，買了放進 owned。原本的 10 種髮型、11 種髮色照舊免費。可以重複執行。
-- 阿萍每天都在設計：髮型從 4 款開始、每兩天多一款；髮色從 3 色開始、每天多一色（從 2026-11-07 起算，台灣時間）。
create or replace function public._salon_days() returns integer language sql stable as $$ select greatest(0, ((now() at time zone 'Asia/Taipei')::date - date '2026-11-07')) $$;
create or replace function public._salon_ok(p_kind text, p_n integer) returns boolean language sql stable as $$
  select case p_kind when 'hs' then p_n between 10 and 21 and (p_n - 10) < 4 + public._salon_days() / 2
                     when 'hc' then p_n between 11 and 40 and (p_n - 11) < 3 + public._salon_days() else false end $$;

create or replace function public.buy_salon(p_kind text, p_n integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); v_id text := p_kind || p_n; c integer := case p_kind when 'hs' then 400 when 'hc' then 200 end;
begin
  if c is null or not public._salon_ok(p_kind, p_n) then raise exception '阿萍還沒設計出這個'; end if;
  select * into pl from public.players where id = pl.id for update;
  if v_id = any(coalesce(pl.owned, '{}')) then raise exception '你已經有了'; end if;
  if pl.coins < c then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - c, owned = array_append(coalesce(owned, '{}'), v_id), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('player', to_jsonb(pl));
end $$;
revoke all on function public.buy_salon(text, integer) from public, anon;
grant execute on function public.buy_salon(text, integer) to authenticated;

-- set_gear：外觀換成阿萍的新髮型、新髮色時，要先買過（其他照 051 原樣）
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer; m text[];
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k = 'look' then
      m := regexp_match(v, '^h([0-9]{1,2})c([0-9]{1,2})s[0-9]e[0-9]$');
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
