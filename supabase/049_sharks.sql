-- 潮汐釣魚村：港口外海的姥鯊、大白鯊和牠們的變種（可以重複執行）
-- 機率、釣點清單在 020（fishcfg.json）裡
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('baskingshark', '姥鯊', '傳說', 500, 4000),
  ('greatwhite', '大白鯊', '傳說', 300, 1500),
  ('baskingshark_albino', '白化姥鯊', '傳說', 500, 4000),
  ('greatwhite_albino', '白化大白鯊', '傳說', 300, 1500)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- 一開始的變種是「黑化大白鯊」，現實沒有紀錄，改成白化大白鯊；萬一有人已經釣到，一起換過去
update public.players set tank = (select jsonb_agg(case when e->>'f' = 'greatwhite_dark' then jsonb_set(e, '{f}', '"greatwhite_albino"') else e end) from jsonb_array_elements(tank) e)
  where tank::text like '%greatwhite_dark%';
update public.players set fish_best = (fish_best - 'greatwhite_dark') || jsonb_build_object('greatwhite_albino', fish_best->'greatwhite_dark') where fish_best ? 'greatwhite_dark';
update public.players set fish_count = (fish_count - 'greatwhite_dark') || jsonb_build_object('greatwhite_albino', fish_count->'greatwhite_dark') where fish_count ? 'greatwhite_dark';
delete from public.fish_species where id = 'greatwhite_dark';

select '姥鯊、大白鯊設定完成 🦈' as result;
