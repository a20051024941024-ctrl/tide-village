-- 潮汐釣魚村：北方冰封群島（冰湖冰洞、流冰海岸）的魚（可以重複執行）
-- 機率、釣點清單在 020（fishcfg.json）裡；這裡只登記魚種（伺服器記錄、排行榜、阿福收購用）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('wakasagi', '公魚', '常見', 0.008, 0.035),
  ('shirauo', '白魚', '常見', 0.004, 0.02),
  ('dolly', '花羔紅點鮭', '稀有', 0.15, 1.4),
  ('himemasu', '姬鱒', '稀有', 0.3, 1.6),
  ('ito', '哲羅鮭', '傳說', 4, 35),
  ('capelin', '毛鱗魚', '常見', 0.015, 0.06),
  ('hokke', '遠東多線魚', '常見', 0.2, 1.2),
  ('cod', '太平洋鱈', '常見', 0.8, 9),
  ('sleepershark', '太平洋睡鯊', '傳說', 80, 700),
  ('wakasagi_gold', '金色公魚', '稀有', 0.008, 0.035),
  ('shirauo_gold', '金色白魚', '稀有', 0.004, 0.02),
  ('dolly_gold', '黃金紅點鮭', '稀有', 0.15, 1.4),
  ('himemasu_albino', '白化姬鱒', '稀有', 0.3, 1.6),
  ('ito_gold', '黃金哲羅鮭', '傳說', 4, 35),
  ('capelin_gold', '金色毛鱗魚', '稀有', 0.015, 0.06),
  ('hokke_albino', '白化多線魚', '稀有', 0.2, 1.2),
  ('cod_albino', '白化鱈魚', '稀有', 0.8, 9),
  ('sleepershark_albino', '白化睡鯊', '傳說', 80, 700)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '北方冰封群島的魚設定完成 ❄️' as result;
