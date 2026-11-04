-- 潮汐釣魚村：珊瑚礁群島（參考小琉球、澎湖七美雙心石滬）的新魚（可以重複執行）
-- 機率、釣點清單（reef 珊瑚礁岸、weir 雙心石滬）在 020（fishcfg.json）裡
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('rabbitfish', '臭肚魚', '常見', 0.1, 0.6),
  ('girella', '白毛', '常見', 0.3, 2.0),
  ('blackgirella', '黑毛', '稀有', 0.5, 3.5),
  ('lethrinus', '青嘴龍占', '稀有', 1.0, 8.0),
  ('amberjack', '紅甘', '傳說', 10, 60),
  ('rabbitfish_gold', '金色臭肚魚', '稀有', 0.1, 0.6),
  ('girella_gold', '金黃白毛', '稀有', 0.3, 2.0),
  ('blackgirella_albino', '白化黑毛', '傳說', 0.5, 3.5),
  ('lethrinus_red', '赤龍占', '稀有', 1.0, 8.0),
  ('amberjack_gold', '黃金紅甘', '傳說', 10, 60)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '珊瑚礁群島設定完成 🪸' as result;
