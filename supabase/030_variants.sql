-- 潮汐釣魚村：變種（同一種魚、長得不一樣，機率很低）（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('koi_sanke', '錦鯉・大正三色', '傳說', 2.5, 7.0),
  ('koi_showa', '錦鯉・昭和三色', '傳說', 2.5, 7.0),
  ('koi_ogon', '錦鯉・黃金', '傳說', 2.5, 7.0),
  ('goldfish_ranchu', '獅子頭金魚', '稀有', 0.05, 0.3),
  ('goldfish_telescope', '黑龍睛金魚', '稀有', 0.05, 0.3),
  ('goldfish_pearl', '珍珠鱗金魚', '稀有', 0.05, 0.3),
  ('clown_black', '黑色小丑魚', '稀有', 0.05, 0.25),
  ('catfish_albino', '白化鯰魚', '稀有', 1.5, 5.5),
  ('trout_golden', '黃金鱒', '傳說', 1.2, 4.5),
  ('carp_mirror', '鏡鯉', '稀有', 1.5, 8.0),
  ('crayfish_blue', '藍色小龍蝦', '稀有', 0.05, 0.14),
  ('tilapia_red', '紅色吳郭魚', '稀有', 0.3, 1.5),
  ('arowana_red', '紅龍魚', '傳說', 3.0, 12)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '變種設定完成 ✨' as result;
