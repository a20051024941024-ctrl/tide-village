-- 潮汐釣魚村：釣蝦場的蝦變大一點、沒有尺寸限制（可以重複執行）
-- 重量要跟 js/game.js 的 FISH 一樣
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('prawn', '泰國蝦', '常見', 0.06, 0.22),
  ('whiteshrimp', '白蝦', '常見', 0.03, 0.09),
  ('tigerprawn', '草蝦', '常見', 0.05, 0.18),
  ('crayfish', '小龍蝦', '常見', 0.05, 0.14),
  ('blueclaw', '藍鉗泰國蝦', '稀有', 0.15, 0.38),
  ('goldprawn', '金鉤蝦王', '傳說', 0.35, 0.65)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- 未達尺寸：釣蝦場的蝦是老闆放的，不算（取代 015 的版本，要跟 js/game.js 的 sizeMin 一樣）
create or replace function public._undersized(sp public.fish_species, w numeric) returns boolean language sql immutable as $$
  select sp.id not in ('prawn', 'whiteshrimp', 'tigerprawn', 'crayfish', 'blueclaw', 'goldprawn', 'bluelobster')
     and w < sp.min_w + 0.25 * (sp.max_w - sp.min_w) $$;

select '釣蝦場的蝦調整完成 🦐' as result;
