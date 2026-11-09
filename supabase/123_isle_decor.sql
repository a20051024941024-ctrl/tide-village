-- 潮汐釣魚村 v305：玩家說家具太少 → 小島新增 24 種裝飾（吊床、小風車、古井、花拱門、鳥屋、烤肉架、海灘躺椅、衝浪板、噴水池、小木橋、迷你燈塔、稻草人、腳踏車、繡球花、向日葵、櫻花樹、楓樹、葡萄架、露營帳篷、浮球堆、木箱堆、曬魚架、石板路、矮樹籬）（可以重複執行）
-- 價錢、大小跟 js/game.js 的 ISLE_ITEMS 一樣，其他照 075
create or replace function public._isle_item(p text, out price integer, out rad numeric, out house boolean) language sql immutable as $$
  select v.price, v.rad, v.house from (values
    ('cabin',1500,2.6,true),('beach',3000,2.9,true),('villa',8000,3.6,true),('tea',5500,3.0,true),('mansion',3000,4.6,true),
    ('flower',200,0.9,false),('bench',150,0.9,false),('lamp',250,0.35,false),('palm',400,0.6,false),('pond',1200,1.5,false),('flag',300,0.3,false),
    ('fence',80,0.9,false),('tree',300,1.1,false),('rock',100,0.7,false),('mailbox',200,0.35,false),('picnic',600,1.4,false),('parasol',350,1.0,false),
    ('campfire',450,0.8,false),('statue',2000,0.9,false),('swing',900,1.3,false),('bush',120,0.7,false),('lantern',180,0.4,false),('boat',1500,1.6,false),
    ('hammock',700,1.4,false),('windmill',1200,0.9,false),('well',800,0.8,false),('arch',650,1.0,false),('birdhouse',220,0.35,false),('bbq',500,0.7,false),('sunbed',300,1.0,false),('surf',250,0.4,false),('fountain',2500,1.4,false),('bridge',900,1.5,false),('minilh',1800,0.8,false),('scarecrow',300,0.5,false),('bike',600,0.8,false),('hydrangea',180,0.7,false),('sunflower',150,0.5,false),('cherry',800,1.3,false),('maple',600,1.2,false),('pergola',1100,1.6,false),('tent',700,1.2,false),('buoys',150,0.5,false),('crates',120,0.6,false),('fishrack',400,0.9,false),('stonepath',40,0.6,false),('hedge',100,0.9,false)
  ) v(id, price, rad, house) where v.id = p $$;
