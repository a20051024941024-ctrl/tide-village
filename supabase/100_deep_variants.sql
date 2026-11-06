-- 100 深海生物的變種（v242）：可以重複執行
-- 黑淵裂縫排隊名單（099 deep_queue）的 12 種，每種再加一個「螢光」變種（本種的 0.02 倍）；
-- 真實世界有不同顏色的另外加一個：紅燈巨口魚、斑點銀鮫、南非皺鰓鯊（本種的 0.05 倍）。跟本種同一週解鎖（ord 一樣）。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('barreleye_glow', '螢光管眼魚', '稀有', 0.05, 0.25),
  ('gulper_glow', '螢光寬咽魚', '稀有', 0.2, 1.5),
  ('viperfish_glow', '螢光蝰魚', '稀有', 0.05, 0.3),
  ('dragonfish_glow', '螢光巨口魚', '稀有', 0.1, 0.6),
  ('dragonfish_red', '紅燈巨口魚', '稀有', 0.1, 0.6),
  ('hatchetfish_glow', '螢光斧頭魚', '常見', 0.01, 0.06),
  ('tripodfish_glow', '螢光三腳架魚', '常見', 0.1, 0.5),
  ('swallower_glow', '螢光黑叉齒魚', '稀有', 0.05, 0.3),
  ('chimaera_glow', '螢光銀鮫', '稀有', 0.5, 4),
  ('chimaera_spot', '斑點銀鮫', '稀有', 0.5, 4),
  ('hagfish_glow', '螢光盲鰻', '常見', 0.1, 0.8),
  ('isopod_glow', '螢光大王具足蟲', '稀有', 0.5, 1.7),
  ('redshrimp_glow', '螢光深海紅蝦', '常見', 0.01, 0.05),
  ('frilledshark_glow', '螢光皺鰓鯊', '傳說', 20, 90),
  ('frilledshark_af', '南非皺鰓鯊', '傳說', 20, 60)
on conflict (id) do nothing;

insert into public.deep_queue (id, ord, min_depth, wt) values
  ('barreleye_glow', 0, 600, 0.04),
  ('gulper_glow', 1, 900, 0.032),
  ('viperfish_glow', 2, 500, 0.036),
  ('dragonfish_glow', 3, 700, 0.032),
  ('dragonfish_red', 3, 700, 0.08),
  ('hatchetfish_glow', 4, 300, 0.08),
  ('tripodfish_glow', 5, 1500, 0.06),
  ('swallower_glow', 6, 1000, 0.028),
  ('chimaera_glow', 7, 500, 0.028),
  ('chimaera_spot', 7, 500, 0.07),
  ('hagfish_glow', 8, 800, 0.052),
  ('isopod_glow', 9, 1500, 0.024),
  ('redshrimp_glow', 10, 800, 0.08),
  ('frilledshark_glow', 11, 1200, 0.007),
  ('frilledshark_af', 11, 1200, 0.0175)
on conflict (id) do update set ord = excluded.ord, min_depth = excluded.min_depth, wt = excluded.wt;
