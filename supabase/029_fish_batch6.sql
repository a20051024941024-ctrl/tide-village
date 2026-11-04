-- 潮汐釣魚村：第六批 15 種常見小魚（把大魚和稀有魚的機率壓下來）（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('pomfret', '白鯧', '常見', 0.2, 0.8),
  ('grunt', '黃雞魚', '常見', 0.15, 0.6),
  ('roundscad', '四破', '常見', 0.08, 0.3),
  ('anchovy', '丁香魚', '常見', 0.01, 0.03),
  ('filefish', '剝皮魚', '常見', 0.15, 0.5),
  ('threadfin', '金線魚', '常見', 0.15, 0.5),
  ('sergeant', '五帶豆娘魚', '常見', 0.05, 0.2),
  ('rabbitfish', '臭肚魚', '常見', 0.15, 0.6),
  ('bluetang', '藍倒吊', '常見', 0.1, 0.4),
  ('moonwrasse', '新月錦魚', '常見', 0.1, 0.35),
  ('acro', '台灣石賓', '常見', 0.1, 0.5),
  ('pseudorasbora', '羅漢魚', '常見', 0.01, 0.03),
  ('hillstream', '台灣間爬岩鰍', '常見', 0.01, 0.03),
  ('candidia', '台灣鬚鱲', '常見', 0.01, 0.05),
  ('medaka', '青鱂魚', '常見', 0.01, 0.02)on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '第六批新魚設定完成 🐟' as result;
