-- 196 每週新深海生物：線鰻（Nemichthys scolopaceus）：可以重複執行
-- 排在黑淵裂縫 deep_queue 的 ord 13（2027-02-05 星期五解鎖），白化／螢光線鰻、黑鷸鰻（近親 Avocettina）同一週。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('snipeeel', '線鰻', '常見', 0.02, 0.1),
  ('snipeeel_albino', '白化線鰻', '常見', 0.02, 0.1),
  ('snipeeel_glow', '螢光線鰻', '常見', 0.02, 0.1),
  ('snipeeel_black', '黑鷸鰻', '常見', 0.02, 0.08)
on conflict (id) do nothing;

insert into public.deep_queue (id, ord, min_depth, wt) values
  ('snipeeel', 13, 300, 2.4),
  ('snipeeel_albino', 13, 300, 0.072),
  ('snipeeel_glow', 13, 300, 0.048),
  ('snipeeel_black', 13, 500, 0.12)
on conflict (id) do update set ord = excluded.ord, min_depth = excluded.min_depth, wt = excluded.wt;
