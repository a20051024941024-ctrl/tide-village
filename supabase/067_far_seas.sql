-- 潮汐釣魚村：深海浮台（參考日本駿河灣的深海釣）、遠洋神秘島（參考加拉巴哥群島）的魚（可以重複執行）
-- 機率、釣點清單在 020（fishcfg.json）裡；這裡只登記魚種
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('mehikari', '青眼魚', '常見', 0.02, 0.08),
  ('rattail', '鼠尾鱈', '常見', 0.2, 1.5),
  ('blackthroat', '赤鯥', '稀有', 0.2, 1.0),
  ('blobfish', '水滴魚', '稀有', 0.5, 2.5),
  ('fangtooth', '角高體金眼鯛', '稀有', 0.03, 0.12),
  ('goblinshark', '歐氏尖吻鮫', '傳說', 40, 200),
  ('sixgill', '灰六鰓鯊', '傳說', 80, 500),
  ('mehikari_gold', '金眼青眼魚', '稀有', 0.02, 0.08),
  ('rattail_albino', '白化鼠尾鱈', '稀有', 0.2, 1.5),
  ('blackthroat_gold', '金赤鯥', '稀有', 0.2, 1.0),
  ('blobfish_albino', '白化水滴魚', '稀有', 0.5, 2.5),
  ('fangtooth_gold', '金牙角高體金眼鯛', '稀有', 0.03, 0.12),
  ('goblinshark_albino', '白化尖吻鮫', '傳說', 40, 200),
  ('sixgill_albino', '白化六鰓鯊', '傳說', 80, 500),
  ('creolefish', '克里奧鮨', '常見', 0.2, 0.8),
  ('razorsurgeon', '黃尾刺尾鯛', '常見', 0.3, 1.2),
  ('idol', '角蝶魚', '常見', 0.1, 0.4),
  ('batfish', '紅唇蝙蝠魚', '稀有', 0.1, 0.6),
  ('galapagosshark', '加拉巴哥鯊', '傳說', 30, 85),
  ('creolefish_gold', '金色克里奧鮨', '稀有', 0.2, 0.8),
  ('razorsurgeon_albino', '白化刺尾鯛', '稀有', 0.3, 1.2),
  ('idol_gold', '金色角蝶魚', '稀有', 0.1, 0.4),
  ('batfish_albino', '白化蝙蝠魚', '稀有', 0.1, 0.6),
  ('galapagosshark_albino', '白化加拉巴哥鯊', '傳說', 30, 85)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;
-- 新的魚放進行情表（063）
insert into public.econ_fish (fish, stock, mult) select id, public._econ_target(rarity), 1 from public.fish_species where id in (select id from public.fish_species) on conflict (fish) do nothing;

select '深海浮台、遠洋神秘島的魚設定完成 🌌🌋' as result;
