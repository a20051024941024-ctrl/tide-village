-- 潮汐釣魚村：第三批新魚 14 種（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('snakehead', '黑斑雷魚', '稀有', 1.0, 5.0),
  ('bass', '大口黑鱸', '常見', 0.4, 2.5),
  ('goldfish', '圓圓金魚', '常見', 0.05, 0.3),
  ('sturgeon', '鏡湖鱘龍', '傳說', 20, 90),
  ('salmon', '櫻花鉤吻鮭', '稀有', 0.3, 1.6),
  ('jelly', '月光水母', '稀有', 0.2, 2.0),
  ('flounder', '沙底比目魚', '常見', 0.3, 2.0),
  ('grouper', '龍膽石斑', '傳說', 15, 60),
  ('barracuda', '銀刀梭子魚', '稀有', 2.0, 12),
  ('hammer', '雙髻鯊', '傳說', 80, 300),
  ('oarfish', '皇帶魚', '傳說', 30, 150),
  ('seahorse', '小海馬', '稀有', 0.02, 0.1),
  ('lionfish', '獅子魚', '稀有', 0.3, 1.3),
  ('turtle', '綠蠵龜', '傳說', 40, 180)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '第三批新魚設定完成 🐢' as result;
