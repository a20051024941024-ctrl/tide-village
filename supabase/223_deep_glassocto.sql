-- 223 每週新深海生物：玻璃章魚（Vitreledonella richardi）：可以重複執行
-- 排在黑淵裂縫 deep_queue 的 ord 14（2027-02-12 星期五解鎖），白化／螢光玻璃章魚同一週。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('glassocto', '玻璃章魚', '稀有', 0.05, 0.4),
  ('glassocto_albino', '白化玻璃章魚', '稀有', 0.05, 0.4),
  ('glassocto_glow', '螢光玻璃章魚', '稀有', 0.05, 0.4)
on conflict (id) do nothing;

insert into public.deep_queue (id, ord, min_depth, wt) values
  ('glassocto', 14, 400, 1.2),
  ('glassocto_albino', 14, 400, 0.036),
  ('glassocto_glow', 14, 400, 0.024)
on conflict (id) do update set ord = excluded.ord, min_depth = excluded.min_depth, wt = excluded.wt;
