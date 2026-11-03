-- 潮汐釣魚村：第四批新魚 11 種（蝦蟹、熱帶魚、深海魚；可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('crab', '沙灘螃蟹', '常見', 0.1, 0.8),
  ('kingcrab', '帝王蟹', '稀有', 2.0, 8.0),
  ('lobster', '藍紋龍蝦', '稀有', 0.5, 4.0),
  ('shrimp', '櫻花蝦', '常見', 0.01, 0.05),
  ('arowana', '金龍魚', '傳說', 3.0, 12),
  ('tilefish', '粉紅馬頭魚', '常見', 0.3, 1.8),
  ('mahi', '鬼頭刀', '常見', 3.0, 15),
  ('butterfly', '蝴蝶魚', '常見', 0.05, 0.3),
  ('angler', '深海鮟鱇', '傳說', 10, 50),
  ('stingray', '斑點魟', '稀有', 2.0, 20),
  ('trevally', '浪人鰺', '稀有', 5.0, 40)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '第四批新魚設定完成 🦀' as result;
