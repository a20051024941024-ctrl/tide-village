-- 潮汐釣魚村：紅樹林群島（開船過去的釣點 mangrove，和退潮時徒手抓的泥灘 mudflat）（可以重複執行）
-- 烏魚、虱目魚從海邊搬到紅樹林；機率、釣點清單在 020（fishcfg.json）裡
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('scat', '金錢魚', '常見', 0.1, 0.6),
  ('terapon', '花身鯻', '常見', 0.05, 0.3),
  ('blackbream', '黑鯛', '常見', 0.3, 2.5),
  ('mudcrab', '鋸緣青蟳', '稀有', 0.3, 2.5),
  ('mangsnapper', '銀紋笛鯛', '稀有', 1.0, 8.0),
  ('barramundi', '尖吻鱸', '稀有', 2.0, 15),
  ('bullshark', '鬥牛鯊', '傳說', 90, 230),
  ('sawfish', '鋸鰩', '傳說', 100, 500),
  ('scat_red', '紅金錢魚', '稀有', 0.1, 0.6),
  ('mudskipper', '彈塗魚', '常見', 0.01, 0.03),
  ('fiddler', '弧邊招潮蟹', '常見', 0.01, 0.03),
  ('bigskipper', '大彈塗魚', '稀有', 0.04, 0.12),
  ('mudskipper_albino', '白化彈塗魚', '稀有', 0.01, 0.03),
  ('fiddler_blue', '藍殼招潮蟹', '稀有', 0.01, 0.03)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '紅樹林設定完成 🌿' as result;
