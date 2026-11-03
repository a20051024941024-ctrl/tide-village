-- 潮汐釣魚村：釣具店新商品（釣竿 3 支、魚餌 3 種；可以重複執行）
-- 價格要跟 js/game.js 的 RODS／BAITS 一樣
create or replace function public._rod_price(p text) returns integer language sql immutable as $$
  select case p when 'bamboo' then 0 when 'carbon' then 400 when 'lure' then 1200 when 'deep' then 2500
                when 'moon' then 5000 when 'king' then 12000 else null end $$;

create or replace function public._bait_info(p text, out price integer, out pack integer) language sql immutable as $$
  select case p when 'worm' then 20 when 'glow' then 60 when 'squidbait' then 150 when 'gold' then 300 when 'rainbow' then 900 end,
         case p when 'worm' then 10 when 'glow' then 5 when 'squidbait' then 5 when 'gold' then 3 when 'rainbow' then 2 end $$;

select '釣具店新商品設定完成 🎣' as result;
