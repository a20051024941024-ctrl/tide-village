-- 潮汐釣魚村：2026-11 新增 11 種魚（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('tilapia', '河口吳郭魚', '常見', 0.3, 1.5),
  ('eel', '月影鰻', '稀有', 0.5, 3.0),
  ('carp', '金鱗大鯉', '稀有', 1.5, 8.0),
  ('loach', '石縫泥鰍', '常見', 0.05, 0.3),
  ('puffer', '圓滾河豚', '稀有', 0.3, 2.0),
  ('squid', '透光小卷', '常見', 0.1, 0.6),
  ('bonito', '藍背鰹魚', '常見', 0.8, 3.0),
  ('tuna', '黑鮪魚', '傳說', 80, 450),
  ('lantern', '螢光燈籠魚', '稀有', 0.2, 0.9),
  ('clown', '小丑魚', '常見', 0.05, 0.25),
  ('parrot', '彩虹鸚哥魚', '稀有', 0.8, 4.0)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '新魚設定完成 🐟' as result;
