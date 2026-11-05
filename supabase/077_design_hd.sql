-- 潮汐釣魚村：設計室變精緻（可以重複執行）
-- 以前一件設計是 16×16 格、16 種顏色（每格 1 個十六進位字：上衣 512 字、其他 256 字）。
-- 現在可以存 32×32 格、48 種顏色（每格 2 個十六進位字：上衣 4096 字、其他 2048 字）。舊的設計照樣可以穿、可以賣。
-- 其他規則跟 047 一樣：名字擋髒話、一天最多存 50 件、價錢 0～5000。

create or replace function public.save_design(p_kind text, p_name text, p_px text, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; nm text := left(btrim(coalesce(p_name, '')), 16); n1 int; n2 int; i int;
begin
  if p_kind not in ('top', 'pants', 'hat', 'shoes', 'back', 'acc') then raise exception '沒有這種衣服'; end if;
  n1 := case when p_kind = 'top' then 512 else 256 end; n2 := n1 * 8;
  if p_px is null or p_px !~ '^[0-9a-f]+$' or length(p_px) not in (n1, n2) then raise exception '圖案不對'; end if;
  if length(p_px) = n2 then   -- 新格式：每格的顏色編號 00～2f（48 色）
    for i in 0 .. length(p_px) / 2 - 1 loop
      if substr(p_px, i * 2 + 1, 1) > '2' then raise exception '圖案不對'; end if;
    end loop;
  end if;
  if nm = '' or public._name_bad(nm) then nm := '我的設計'; end if;
  if (select count(*) from public.designs where owner = pl.id and created_at > now() - interval '1 day') >= 50 then raise exception '今天設計太多件了，明天再來'; end if;
  insert into public.designs (owner, owner_name, kind, name, px, price) values (pl.id, pl.nickname, p_kind, nm, p_px, greatest(0, least(5000, coalesce(p_price, 0)))) returning * into d;
  update public.players set owned = array_append(owned, d.kind || '_dz' || d.id), updated_at = now() where id = pl.id;
  return public._design_row(d);
end $$;

revoke all on function public.save_design(text, text, text, integer) from public, anon;
grant execute on function public.save_design(text, text, text, integer) to authenticated;

select '設計室可以存 32×32、48 色的設計了 🎨' as result;
