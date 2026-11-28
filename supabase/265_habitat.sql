-- 潮汐釣魚村 v1009：水裡的地形（可以重複執行）。先貼這個，再貼 266。
-- 作者 11/28：「還不如靠玩家經驗，有草的地方比較有鱉之類的」→ 海面上的徵兆（海鳥、漣漪、魚影、氣泡）拿掉，
-- 改成新主島水裡真的放了水草叢、礁石，加上棧橋的柱子底下、河口；浮標落在這些地方旁邊，愛待在那裡的魚比較多（一般 ×3、傳說 ×1.5）。
-- 位置（新主島的世界座標 x, z, 半徑）跟 js/game.js 的 HAB_Z 一樣，兩邊要一起改。
create or replace function public._habitat_at(p_x numeric, p_z numeric) returns text language sql immutable as $$
  select k from (values
(26,1574,3.5,'pile'),
(-130,1476,3.5,'pile'),
(6,1594,3.5,'pile'),
(-140,1472,3.5,'pile'),
(-32,1572,3.5,'pile'),
(38,1586,3.5,'pile'),
(8,1576,3.5,'pile'),
(-122,1476,3.5,'pile'),
(-10,1574,3.5,'pile'),
(-16,1578,3.5,'pile'),
(36,1574,3.5,'pile'),
(-30,1584,3.5,'pile'),
(42,1570,3.5,'pile'),
(-110,1476,3.5,'pile'),
(22,1590,3.5,'pile'),
(-26,1576,3.5,'pile'),
(-14,1592,3.5,'pile'),
(-158,1470,3.5,'pile'),
(-116,1480,3.5,'pile'),
(20,1578,3.5,'pile'),
(-100,1466,7,'mouth'),
(-18,1442,4,'weed'),
(-28,1444,4,'weed'),
(-22,1452,4,'weed'),
(-66,1460,4,'weed'),
(-82,1460,4,'weed'),
(-44,1456,4,'weed'),
(-38,1448,4,'weed'),
(-110,1466,4,'weed'),
(-124,1464,4,'weed'),
(-38,1438,4,'weed'),
(-54,1578,3.5,'rock'),
(-66,1424,3.5,'rock'),
(106,1564,3.5,'rock'),
(126,1462,3.5,'rock'),
(-108,1456,3.5,'rock'),
(8,1436,3.5,'rock'),
(-148,1478,3.5,'rock'),
(136,1514,3.5,'rock'),
(44,1580,3.5,'rock'),
(-8,1586,3.5,'rock'),
(-74,1460,3.5,'rock'),
(-92,1464,3.5,'rock'),
(-58,1460,3.5,'rock')
  ) v(x, z, r, k) where p_x is not null and p_z is not null and (p_x - x) * (p_x - x) + (p_z - z) * (p_z - z) <= r * r
  order by (p_x - x) * (p_x - x) + (p_z - z) * (p_z - z) limit 1 $$;
create or replace function public._habitat_fish(p_k text) returns text[] language sql immutable as $$
  select case p_k
    when 'weed' then array['softshell', 'bass', 'goldfish', 'carp', 'crucian', 'snakehead', 'tilapia', 'pseudorasbora', 'medaka', 'guppy', 'shrimp', 'mosquitofish', 'climbperch', 'loach', 'koi']::text[]
    when 'rock' then array['scorpion', 'grouper', 'groupie', 'octopus', 'crab', 'puffer', 'kingcrab', 'acro', 'zacco', 'creekcrab', 'goby', 'kuhua', 'hillstream', 'ayu', 'trout', 'catfish', 'eel', 'tilefish']::text[]
    when 'pile' then array['grunt', 'filefish', 'roundscad', 'horsemack', 'threadfin', 'moonbream', 'blackbream', 'terapon', 'scat', 'squid', 'cuttle', 'ika', 'mangsnapper']::text[]
    when 'mouth' then array['perch', 'eel', 'alligatorgar', 'mullet', 'milkfish', 'barramundi', 'flounder', 'stingray', 'tarpon', 'whiting', 'yellowcheek']::text[]
    else '{}'::text[] end $$;
