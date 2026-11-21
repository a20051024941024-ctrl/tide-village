-- 潮汐釣魚村：我的海（v651，可以重複執行）
-- 作者：「如果能將釣到的魚放在小島海底下」「這樣水族館可以不要，箱網也可以不要」
-- 1) 廣場的水族館不再放玩家自己挑的魚，改成自動展示「這 7 天全村釣到的大魚」：每種魚取最重的一條，稀有度高的先、同等級比重量，最多 24 條（用村報的 news_catch）
-- 2) 箱網拿掉：箱網裡的魚全部退回魚缸（用養大以後的重量、標 fm=養殖），而且自動收藏（k），魚缸滿了也不會被擠掉
-- 「我的海」用原本的 show 清單，伺服器不用改

create or replace function public.aqua_week() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('f', fish, 'w', w, 'n', nick, 'r', rarity) order by rk, w desc), '[]'::jsonb) from (
    select * from (
      select distinct on (fish) fish, w, nick, rarity, case rarity when '傳說' then 0 when '史詩' then 1 when '稀有' then 2 else 3 end as rk
      from public.news_catch where day >= public._tw_day(now()) - 6 order by fish, w desc) a
    order by rk, w desc limit 24) t $$;
revoke all on function public.aqua_week() from public;
grant execute on function public.aqua_week() to anon, authenticated;

-- 箱網的魚退回魚缸
update public.players set
  tank = (select coalesce(jsonb_agg((e - 'w0' - 'at') || jsonb_build_object('fm', true, 'k', true)), '[]'::jsonb) from jsonb_array_elements(cage) e) || tank,
  cage = '[]'::jsonb, updated_at = now()
where jsonb_typeof(cage) = 'array' and jsonb_array_length(cage) > 0;

-- 不能再放魚進箱網（舊版本的遊戲按了會看到這句）
create or replace function public.cage_put(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '箱網已經拆掉了，最喜歡的魚可以放進「我的海」'; end $$;

select '我的海：水族館自動展示、箱網拆掉 🐠' as result;
