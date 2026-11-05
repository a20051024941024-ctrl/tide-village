-- 086 拿掉送金幣：好友之間只能送魚（每天 10 條），送金幣會被擋下；可以重複執行
-- 原因：春節紅包、聖誕禮物、夜市小遊戲都有免費金幣，開分身帳號領完再送給自己會讓金幣越刷越多
-- 已經送出、還沒打開的金幣禮物照樣可以收
create or replace function public.send_gift(p_to uuid, p_kind text, p_ts bigint, p_amount integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; gc integer; gf integer; e jsonb;
begin
  if not (exists (select 1 from public.friends where owner = pl.id and friend = p_to) and exists (select 1 from public.friends where owner = p_to and friend = pl.id)) then raise exception '要互相加好友才能送禮'; end if;
  if (select count(*) from public.gifts where to_id = p_to and not opened) >= 30 then raise exception '對方的禮物箱滿了'; end if;
  gc := case when pl.gift_day = d then pl.gift_coins else 0 end; gf := case when pl.gift_day = d then pl.gift_fish else 0 end;
  if p_kind = 'coins' then
    raise exception '金幣不能送人了，可以送魚喔';   -- 086：拿掉送金幣（避免開分身帳號刷金幣再轉給自己）
    if p_amount is null or p_amount < 10 or p_amount > 1000 then raise exception '一次可以送 10～1000 金幣'; end if;
    if gc + p_amount > 1000 then raise exception '今天送的金幣到上限了（每天 1000）'; end if;
    if pl.coins < p_amount then raise exception '金幣不夠'; end if;
    update public.players set coins = coins - p_amount, gift_day = d, gift_coins = gc + p_amount, gift_fish = gf, updated_at = now() where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'coins', jsonb_build_object('amount', p_amount));
  elsif p_kind = 'fish' then
    if gf >= 10 then raise exception '今天送的魚到上限了（每天 10 條）'; end if;
    select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_ts limit 1;
    if e is null then raise exception '找不到這條魚'; end if;
    if pl.show @> jsonb_build_array(e->'t') then raise exception '展示中的魚不能送'; end if;
    if e ? 'rs' then raise exception '赤紅霸王鯊不能送人'; end if;
    update public.players set
      tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality y(x, i) where (x->>'t')::bigint <> p_ts),
      gift_day = d, gift_coins = gc, gift_fish = gf + 1, updated_at = now()
    where id = pl.id returning * into pl;
    insert into public.gifts (to_id, from_id, kind, data) values (p_to, pl.id, 'fish', jsonb_build_object('f', e->>'f', 'w', (e->>'w')::numeric));
  else raise exception '沒有這種禮物'; end if;
  return pl;
end $$;

select '送禮只剩送魚 🐟' as result;
