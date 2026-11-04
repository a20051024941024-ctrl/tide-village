-- 潮汐釣魚村：KayKit Adventurers（Kay Lousberg，CC0）的帽子、頭盔、披風上架（可以重複執行）
-- 巫師帽 1200、騎士頭盔 1800、熊熊帽 1000、短披風四種 800～900；價格要跟 js/game.js 的 GEAR 一樣
create or replace function public._item_price(p text) returns integer language sql immutable as $$
  select v.price from (values
    ('hat_sun',0),('hat_wizard',1200),('hat_knight',1800),('hat_bear',1000),('hat_none',0),('hat_cap',250),('hat_beanie',300),('hat_bucket',350),('hat_cat',600),('hat_chef',800),('hat_flower',500),('hat_pirate',1500),('hat_crown',5000),
    ('top_tee',0),('top_stripe',300),('top_apron',400),('top_vest',500),('top_hoodie',700),('top_hawaii',800),('top_suit',2500),
    ('pants_jeans',0),('pants_shorts',200),('pants_khaki',250),('pants_skirt',500),('pants_overalls',600),('pants_rainbow',1500),
    ('shoes_boots',0),('shoes_sandals',150),('shoes_sneakers',250),('shoes_rain',350),('shoes_gold',2500),
    ('socks_none',0),('socks_white',80),('socks_stripe',200),('socks_rainbow',500),
    ('acc_none',0),('acc_scarf',300),('acc_bowtie',350),('acc_glasses',450),('acc_shell',600),('acc_lei',700),
    ('acc_scarf_black',320),('acc_scarf_white',320),('acc_scarf_navy',350),('acc_scarf_pink',350),('acc_scarf_yellow',350),('acc_scarf_green',350),('acc_scarf_grey',380),('acc_scarf_brown',380),('acc_scarf_plaid',500),('acc_scarf_stripe',500),('acc_scarf_rainbow',900),
    ('back_none',0),('back_kcape_m',900),('back_kcape_r',900),('back_kcape_b',800),('back_kcape_g',900),('back_bag',400),('back_basket',500),('back_balloon',800),('back_cape',1500),('back_wings',3000),
    ('face_normal',0),('face_happy',200),('face_sleepy',200),('face_wink',300),('face_cool',600),('face_heart',700),('face_star',900)
  ) v(id, price) where v.id = p $$;

select 'KayKit 帽子、披風上架了 🧙' as result;
