-- 潮汐釣魚村：第五批新魚（外海更多常見魚）、海上釣蝦場、企鵝冰原，加上鹽烤泰國蝦（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('saury', '秋刀魚', '常見', 0.1, 0.3),
  ('horsemack', '竹莢魚', '常見', 0.15, 0.6),
  ('hairtail', '白帶魚', '常見', 0.5, 3.0),
  ('sardine', '沙丁魚', '常見', 0.05, 0.15),
  ('flyingfish', '飛魚', '常見', 0.2, 0.5),
  ('yellowtail', '青甘鰺', '常見', 1.0, 8.0),
  ('milkfish', '虱目魚', '常見', 0.3, 1.5),
  ('mullet', '烏魚', '常見', 0.5, 2.5),
  ('zacco', '溪哥', '常見', 0.03, 0.12),
  ('bighead', '大頭鰱', '常見', 1.0, 10),
  ('prawn', '泰國蝦', '常見', 0.04, 0.16),
  ('whiteshrimp', '白蝦', '常見', 0.02, 0.06),
  ('tigerprawn', '草蝦', '常見', 0.03, 0.12),
  ('crayfish', '小龍蝦', '常見', 0.03, 0.09),
  ('blueclaw', '藍鉗泰國蝦', '稀有', 0.12, 0.3),
  ('goldprawn', '金鉤蝦王', '傳說', 0.3, 0.55),
  ('capelin', '冰原柳葉魚', '常見', 0.02, 0.06),
  ('cod', '北極鱈', '常見', 1.0, 6.0),
  ('arcticchar', '北極紅點鮭', '稀有', 1.0, 5.0),
  ('icefish', '透明冰魚', '稀有', 0.3, 1.5),
  ('toothfish', '南極犬牙魚', '傳說', 20, 100),
  ('narwhal', '一角鯨', '傳說', 400, 1500)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- 料理清單（價格要跟 js/game.js 的 RECIPES 一樣）
create or replace function public._recipe(p text, out fish text, out need integer, out value integer) language sql immutable as $$
  select v.fish, v.need, v.value from (values
    ('saba', 'mackerel',  1,  40), ('tai',  'moonbream', 1, 160), ('ayu',  'ayu',       1,  30), ('suzuki','perch',    1,  35),
    ('mori', '*common',   3, 120), ('tako', 'octopus',   1, 110), ('ikayaki','ika',     1,  60), ('sumi', 'cuttle',    1, 130),
    ('sanbei','squid',    2,  55), ('toro', 'tuna',      1, 900), ('unadon','eel',      1, 150), ('fugu', 'puffer',    1, 140),
    ('tilapia','tilapia', 1,  30), ('ebi',  'prawn',     3,  75)
  ) v(r, fish, need, value) where v.r = p $$;

select '第五批新魚、釣蝦場、企鵝冰原設定完成 🐧' as result;
