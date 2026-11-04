-- 潮汐釣魚村：設計不設上限、全身都能設計（帽子、鞋子、背飾、配件也可以）（可以重複執行）
-- 帽子／鞋子／背飾（披風）／配件（領巾）都是 16×16 一面（256 格）；上衣一樣是正面＋背面（512 格）。
-- 不限件數，只擋短時間洗版：一天最多存 50 件。
alter table public.designs drop constraint if exists designs_kind_check;
alter table public.designs add constraint designs_kind_check check (kind in ('top', 'pants', 'hat', 'shoes', 'back', 'acc'));

create or replace function public.save_design(p_kind text, p_name text, p_px text, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; nm text := left(btrim(coalesce(p_name, '')), 16);
begin
  if p_kind not in ('top', 'pants', 'hat', 'shoes', 'back', 'acc') then raise exception '沒有這種衣服'; end if;
  if p_px !~ '^[0-9a-f]+$' or length(p_px) <> (case when p_kind = 'top' then 512 else 256 end) then raise exception '圖案不對'; end if;
  if nm = '' then nm := '我的設計'; end if;
  if (select count(*) from public.designs where owner = pl.id and created_at > now() - interval '1 day') >= 50 then raise exception '今天設計太多件了，明天再來'; end if;
  insert into public.designs (owner, owner_name, kind, name, px, price) values (pl.id, pl.nickname, p_kind, nm, p_px, greatest(0, least(5000, coalesce(p_price, 0)))) returning * into d;
  update public.players set owned = array_append(owned, d.kind || '_dz' || d.id), updated_at = now() where id = pl.id;
  return public._design_row(d);
end $$;

create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer;
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
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

do $$ declare f text; begin
  foreach f in array array['save_design(text,text,text,integer)', 'set_gear(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '全身設計設定完成 🎨' as result;
