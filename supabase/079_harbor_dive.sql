-- 潮汐釣魚村：港口海底潛水點（可以重複執行）
-- 穿潛水裝從港口碼頭的梯子直接下去：消波塊、碼頭木樁、海藻森林、沉船、貨櫃、大錨。只要潛水裝備組。
-- 寶箱 200～400 金幣（介於珊瑚礁和沉船深海之間）；一天撿貝殼、開寶箱的上限跟其他潛水點共用（022）。

create or replace function public.dive_loot(p_kind text, p_site text default 'reef') returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; sh integer; ch integer; pr integer; got integer := 0;
  site text := coalesce(p_site, 'reef');
begin
  if not ('dive_suit' = any(pl.dive)) then raise exception '要先買潛水裝備'; end if;
  if p_kind not in ('shell', 'chest', 'pearl') then raise exception '沒有這種東西'; end if;
  if site not in ('reef', 'wreck', 'cave', 'harbor') then raise exception '沒有這種東西'; end if;
  if site = 'wreck' and not ('dive_tank3' = any(pl.dive)) then raise exception '要先買前一級的潛水用品'; end if;
  if site = 'cave' and not ('dive_tank4' = any(pl.dive) and 'dive_light' = any(pl.dive)) then raise exception '要先買前一級的潛水用品'; end if;
  if p_kind = 'pearl' and site <> 'cave' then raise exception '沒有這種東西'; end if;
  if pl.dive_at is not null and now() - pl.dive_at < interval '1 second' then raise exception '撿太快了'; end if;
  sh := case when pl.dive_day = d then pl.dive_shells else 0 end;
  ch := case when pl.dive_day = d then pl.dive_chests else 0 end;
  pr := case when pl.dive_day = d then pl.dive_pearls else 0 end;
  if p_kind = 'shell' and sh < 40 then got := 5 + floor(random() * 16)::integer; sh := sh + 1; end if;
  if p_kind = 'chest' and ch < 6 then got := (case site when 'wreck' then 300 when 'cave' then 400 when 'harbor' then 200 else 150 end) + floor(random() * 201)::integer; ch := ch + 1; end if;
  if p_kind = 'pearl' and pr < 15 then got := 80 + floor(random() * 81)::integer; pr := pr + 1; end if;
  update public.players set coins = coins + got, earned = earned + got, dive_day = d, dive_shells = sh, dive_chests = ch, dive_pearls = pr, dive_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

revoke all on function public.dive_loot(text, text) from public, anon;
grant execute on function public.dive_loot(text, text) to authenticated;

select '港口海底潛水點設定完成 ⚓' as result;
