-- 潮汐釣魚村：港口外海的姥鯊、大白鯊和牠們的變種（可以重複執行）
-- 機率、釣點清單在 020（fishcfg.json）裡
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('baskingshark', '姥鯊', '傳說', 500, 4000),
  ('greatwhite', '大白鯊', '傳說', 300, 1500),
  ('baskingshark_albino', '白化姥鯊', '傳說', 500, 4000),
  ('greatwhite_dark', '黑化大白鯊', '傳說', 300, 1500)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

select '姥鯊、大白鯊設定完成 🦈' as result;
