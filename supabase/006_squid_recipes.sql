-- 潮汐釣魚村：墨魚、章魚、魷魚，加上 8 道新料理（可以重複執行）
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('cuttle', '斑馬墨魚', '稀有', 0.5, 3.0),
  ('octopus', '紅石章魚', '稀有', 2.0, 15),
  ('ika', '劍尖魷魚', '常見', 0.6, 4.0),
  ('giantsquid', '大王魷魚', '傳說', 120, 500)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- 料理清單（價格要跟 js/game.js 的 RECIPES 一樣）
create or replace function public._recipe(p text, out fish text, out need integer, out value integer) language sql immutable as $$
  select v.fish, v.need, v.value from (values
    ('saba', 'mackerel',  1,  40),
    ('tai',  'moonbream', 1, 160),
    ('ayu',  'ayu',       1,  30),
    ('suzuki','perch',    1,  35),
    ('mori', '*common',   3, 120),
    ('tako', 'octopus',   1, 110),
    ('ikayaki','ika',     1,  60),
    ('sumi', 'cuttle',    1, 130),
    ('sanbei','squid',    2,  55),
    ('toro', 'tuna',      1, 900),
    ('unadon','eel',      1, 150),
    ('fugu', 'puffer',    1, 140),
    ('tilapia','tilapia', 1,  30)
  ) v(r, fish, need, value) where v.r = p $$;

select '墨魚章魚魷魚和新料理設定完成 🦑' as result;
