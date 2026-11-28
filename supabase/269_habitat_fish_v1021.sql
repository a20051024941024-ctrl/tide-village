-- v1021 新的真實魚（Fish Kit）也有喜歡的地形：大眼平鮋/星點笛鯛在礁石、長尾黑毛/海鱸在棧橋、海鱸/牛尾魚在河口
-- 可以重複跑
create or replace function public._habitat_fish(p_k text) returns text[] language sql immutable as $$
  select case p_k
    when 'weed' then array['softshell', 'bass', 'goldfish', 'carp', 'crucian', 'snakehead', 'tilapia', 'pseudorasbora', 'medaka', 'guppy', 'shrimp', 'mosquitofish', 'climbperch', 'loach', 'koi']::text[]
    when 'rock' then array['scorpion', 'grouper', 'groupie', 'octopus', 'crab', 'puffer', 'kingcrab', 'acro', 'zacco', 'creekcrab', 'goby', 'kuhua', 'hillstream', 'ayu', 'trout', 'catfish', 'eel', 'tilefish', 'mebaru', 'shibudai']::text[]
    when 'pile' then array['grunt', 'filefish', 'roundscad', 'horsemack', 'threadfin', 'moonbream', 'blackbream', 'terapon', 'scat', 'squid', 'cuttle', 'ika', 'mangsnapper', 'onaga', 'seabass']::text[]
    when 'mouth' then array['perch', 'eel', 'alligatorgar', 'mullet', 'milkfish', 'barramundi', 'flounder', 'stingray', 'tarpon', 'whiting', 'yellowcheek', 'seabass', 'magochi']::text[]
    else '{}'::text[] end $$;
