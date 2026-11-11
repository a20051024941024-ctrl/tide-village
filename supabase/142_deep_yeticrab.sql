-- 142 每週新深海生物：雪人蟹（Kiwa hirsuta）：可以重複執行
-- 排在黑淵裂縫 deep_queue 的 ord 12（2027-01-29 星期五解鎖），白化／螢光／跳舞雪人蟹同一週。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('yeticrab', '雪人蟹', '稀有', 0.05, 0.3),
  ('yeticrab_albino', '白化雪人蟹', '稀有', 0.05, 0.3),
  ('yeticrab_glow', '螢光雪人蟹', '稀有', 0.05, 0.3),
  ('yeticrab_dance', '跳舞雪人蟹', '稀有', 0.05, 0.25)
on conflict (id) do nothing;

insert into public.deep_queue (id, ord, min_depth, wt) values
  ('yeticrab', 12, 2200, 1.2),
  ('yeticrab_albino', 12, 2200, 0.036),
  ('yeticrab_glow', 12, 2200, 0.024),
  ('yeticrab_dance', 12, 1000, 0.06)
on conflict (id) do update set ord = excluded.ord, min_depth = excluded.min_depth, wt = excluded.wt;
