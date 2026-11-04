-- 潮汐釣魚村：專用竿（手竿、遠投竿、磯釣竿）（可以重複執行）
-- 價格要跟 js/game.js 的 RODS 一樣；用在哪個釣點比較好的加成寫在 020（fishcfg.json 的 rodFit）
create or replace function public._rod_price(p text) returns integer language sql immutable as $$
  select case p when 'bamboo' then 0 when 'carbon' then 400 when 'lure' then 1200 when 'deep' then 2500
                when 'moon' then 5000 when 'king' then 12000
                when 'pole_bamboo' then 300 when 'pole_carbon' then 1800 when 'surf_basic' then 900 when 'surf_pro' then 4000
                when 'iso_basic' then 1000 when 'iso_pro' then 4500 else null end $$;

select '專用竿設定完成 🎋' as result;
