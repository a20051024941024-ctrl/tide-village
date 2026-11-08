-- 潮汐釣魚村：公平釣魚（伺服器決定上鉤的是什麼魚）（可以重複執行）
-- ⚠️ 這份是 tools/gen_fair_sql.py 自動產生的，不要直接改；要改請改 tools/fair_fishing.sql.tpl 或 tools/fishcfg.json
-- 流程：拋竿時遊戲呼叫 roll_fish()，伺服器用跟遊戲一樣的機率抽一條魚（釣竿、魚餌、料理、窩料、天氣、潮汐、季節、時段、今日情報、釣法、釣線），
--       記在 casts（072：不公開的表，手機讀不到）；咬餌前大約 2 秒 hook_fish() 才告訴手機是什麼魚（游過來的動畫要用）；
--       拉上來時 record_catch() 一定要是這條魚、這個重量才算數。players 的 cast_* 欄位不再用（一直是空的），不會跟著玩家資料送出去。
alter table public.players add column if not exists cast_fish  text;
alter table public.players add column if not exists cast_w     numeric(10,2);
alter table public.players add column if not exists cast_at    timestamptz;
alter table public.players add column if not exists buff_r     text;
alter table public.players add column if not exists buff_left  integer not null default 0;
alter table public.players add column if not exists chum_type  text;
alter table public.players add column if not exists chum_at    timestamptz;
alter table public.players add column if not exists shrimp_until timestamptz;   -- 釣蝦場買的時段到什麼時候（025）
alter table public.players add column if not exists cast_rs text;
alter table public.players add column if not exists cast_gp text;       -- 孔雀魚的基因（046）：「尾巴顏色兩個|尾巴形狀兩個」，例如 rb|do
-- 野生孔雀魚的基因：顏色大多是灰（w），有時紅（r）、藍（b）、黃（y）；尾巴大多是圓尾（o），有時劍尾（s）、扇尾（d）。黑（k）、紫（p）只會從配種突變出來
create or replace function public._gpy_wild() returns text language sql volatile as $$
  select substr('wwwrby', 1 + floor(random() * 6)::int, 1) || substr('wwwrby', 1 + floor(random() * 6)::int, 1) || '|' || substr('ooosd', 1 + floor(random() * 5)::int, 1) || substr('ooosd', 1 + floor(random() * 5)::int, 1) $$;
alter table public.players add column if not exists cast_sex text;      -- 這次碰到的魚是公（M）還是母（F）（037）
create table if not exists public.casts (
  uid uuid primary key references public.players(id) on delete cascade, spot text, fish text not null, w numeric(10,2) not null,
  rs text, sex text, brood boolean, gp text, at timestamptz not null default now(), shown_at timestamptz);
alter table public.casts enable row level security;
revoke all on public.casts from anon, authenticated;
alter table public.players add column if not exists last_fish text;            -- 剛剛釣到的魚（村報、蔚博士的觸發器用；已經釣上來了，不是秘密）
alter table public.players add column if not exists last_w numeric(10,2);
alter table public.players add column if not exists cast_brood boolean; -- 母吳郭魚嘴裡含著小魚（037）   -- 赤紅霸王鯊（032）：這次碰到的那一隻
-- 赤紅霸王鯊的族群（032 會放一開始的一公一母和其他函式；表要先建好，roll_fish 才編得過）
create table if not exists public.red_sharks (
  id integer primary key, sex text not null check (sex in ('M', 'F')), born_at timestamptz not null,
  status text not null default 'sea' check (status in ('sea', 'caught')), hooked_by uuid, hooked_at timestamptz,
  caught_by uuid, caught_name text, caught_w numeric(10,2), caught_at timestamptz
);
alter table public.red_sharks add column if not exists scars integer not null default 0;
alter table public.red_sharks add column if not exists albino boolean not null default false;   -- 白化（042）：生小鯊時極少數會是白化
alter table public.red_sharks enable row level security;
revoke all on public.red_sharks from anon, authenticated;
create index if not exists players_chum_idx on public.players (chum_type, chum_at desc);

create or replace function public._fishcfg() returns jsonb language sql immutable as $cfg$ select '{"spots":{"river":{"x":-20.4,"z":-17.6,"fish":["perch","crucian","catfish","koi","tilapia","eel","snakehead","zacco","acro","pseudorasbora","koi_sanke","koi_showa","koi_ogon","catfish_albino","tilapia_red"],"lb":1,"dx":0.24254,"dz":-0.97014},"lake":{"x":-21.8,"z":-2,"fish":["crucian","perch","koi","carp","bass","goldfish","sturgeon","arowana","bighead","koi_sanke","koi_showa","koi_ogon","goldfish_ranchu","goldfish_telescope","goldfish_pearl","carp_mirror","arowana_red","koi_red","koi_fuku"],"lb":1.4,"dx":-0.99875,"dz":0.04994},"pool":{"x":-26.2,"z":5.4,"fish":["ayu","kuhua","goby","trout","loach","salmon","hillstream","candidia","trout_golden"],"lb":1,"dx":0,"dz":1},"sea":{"x":0,"z":-50.8,"fish":["mackerel","scorpion","moonbream","puffer","squid","bonito","cuttle","jelly","flounder","grouper","crab","tilefish","stingray"],"lb":1,"dx":0,"dz":-1},"isle":{"x":150,"z":29.4,"fish":["clown","parrot","puffer","squid","sunfish","tuna","cuttle","octopus","seahorse","lionfish","turtle","lobster","butterfly","trevally","sergeant","rabbitfish","bluetang","moonwrasse","clown_black","xclown","xclown_gold","xwrasse","xwrasse_gold"],"lb":1,"dx":0,"dz":1},"harbor":{"x":33.2,"z":-27,"fish":["mackerel","moonbream","manta","sunfish","dolphin","beluga","marlin","shark","orca","whaleshark","whale","sperm","tuna","octopus","ika","giantsquid","barracuda","hammer","oarfish","kingcrab","mahi","angler","saury","horsemack","hairtail","sardine","flyingfish","yellowtail","pomfret","grunt","roundscad","anchovy","filefish","threadfin","baskingshark","greatwhite","baskingshark_albino","greatwhite_albino","bluewhale","bluewhale_albino","fwfish","fwfish_gold"],"lb":1,"dx":0.97014,"dz":-0.24254},"shrimp":{"x":-118,"z":40.75,"fish":["prawn","whiteshrimp","tigerprawn","crayfish","blueclaw","goldprawn","crayfish_blue"],"lb":1,"dx":0,"dz":-1},"mangrove":{"x":67.8,"z":10,"fish":["mullet","milkfish","scat","terapon","blackbream","mudcrab","mangsnapper","barramundi","bullshark","sawfish","scat_red"],"lb":1,"dx":1,"dz":0},"mudflat":{"x":9999,"z":9999,"fish":["mudskipper","fiddler","bigskipper","mudskipper_albino","fiddler_blue"],"lb":1,"dx":0,"dz":1},"canal":{"x":13,"z":-41.1,"fish":["tilapia","crucian","carp","snakehead","pseudorasbora","mosquitofish","guppy","pleco","giantsnake","clarias","tilapia_red","mosquitofish_gold","pleco_albino","giantsnake_red","clarias_albino","guppy_albino"],"lb":1,"dx":0,"dz":1},"abyss":{"x":64.2,"z":-148.4,"fish":["mehikari","rattail","blackthroat","blobfish","fangtooth","goblinshark","sixgill","mehikari_gold","rattail_albino","blackthroat_gold","blobfish_albino","fangtooth_gold","goblinshark_albino","sixgill_albino"],"lb":1,"dx":0,"dz":-1},"mystic":{"x":-60,"z":178.6,"fish":["creolefish","razorsurgeon","idol","batfish","galapagosshark","creolefish_gold","razorsurgeon_albino","idol_gold","batfish_albino","galapagosshark_albino"],"lb":1,"dx":0,"dz":1},"icelake":{"x":-157.2,"z":-10.8,"fish":["wakasagi","shirauo","dolly","himemasu","ito","wakasagi_gold","shirauo_gold","dolly_gold","himemasu_albino","ito_gold"],"lb":1,"dx":-0.70711,"dz":0.70711},"icesea":{"x":-179.4,"z":-10,"fish":["capelin","hokke","cod","sleepershark","capelin_gold","hokke_albino","cod_albino","sleepershark_albino"],"lb":1,"dx":-1,"dz":0},"reef":{"x":-9,"z":87.5,"fish":["rabbitfish","girella","blackgirella","lethrinus","amberjack","parrot","butterfly","sergeant","lionfish","octopus","trevally","grouper","rabbitfish_gold","girella_gold","blackgirella_albino","lethrinus_red","amberjack_gold","snowmoray","snowmoray_gold"],"lb":1,"dx":-0.99504,"dz":0.0995},"weir":{"x":11,"z":82,"fish":["rabbitfish","sergeant","butterfly","girella","octopus","puffer","rabbitfish_gold","girella_gold"],"lb":1,"dx":1,"dz":0},"moss":{"x":116,"z":145.2,"fish":["sicyo","eleotris","kuhlia","mokuzu","marmorata","sicyo_blue","eleotris_albino","kuhlia_gold","mokuzu_blue","marmorata_gold","ayu","kuhua","eel"],"lb":1,"dx":0,"dz":-1},"creek":{"x":20.8,"z":27.4,"fish":["kuhua","goby","trout","lantern","shrimp","medaka","candidia","guppy","trout_golden"],"lb":1.8,"dx":0.99875,"dz":0.04994}},"tipSpots":["river","lake","pool","sea","harbor","shrimp","mangrove","mudflat","canal","abyss","mystic","icelake","icesea","reef","weir","moss","creek"],"fish":{"perch":{"r":"常見","w":1,"t":null,"min":0.4,"max":1.6,"k":"pred"},"crucian":{"r":"常見","w":1,"t":null,"min":0.2,"max":0.9,"k":"bottom"},"catfish":{"r":"稀有","w":1,"t":"night","min":1.5,"max":5.5,"k":"bottom"},"koi":{"r":"傳說","w":1,"t":"twilight","min":2.5,"max":7,"k":"school"},"mackerel":{"r":"常見","w":1,"t":"day","min":0.3,"max":1.2,"k":"pred"},"scorpion":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.4,"k":"bottom"},"moonbream":{"r":"稀有","w":1,"t":"night","min":1,"max":3.8,"k":"school"},"marlin":{"r":"傳說","w":1,"t":null,"min":8,"max":24,"k":"pred"},"manta":{"r":"稀有","w":0.2,"t":null,"min":12,"max":45,"k":"shadow"},"dolphin":{"r":"稀有","w":0.2,"t":null,"min":40,"max":150,"k":"shadow"},"shark":{"r":"傳說","w":0.6,"t":null,"min":60,"max":250,"k":"pred"},"orca":{"r":"傳說","w":0.3,"t":null,"min":1200,"max":5500,"k":"pred"},"beluga":{"r":"稀有","w":0.15,"t":null,"min":400,"max":1500,"k":"shadow"},"sunfish":{"r":"稀有","w":0.18,"t":"day","min":60,"max":900,"k":"shadow"},"sperm":{"r":"傳說","w":0.18,"t":"night","min":3000,"max":15000,"k":"shadow"},"whaleshark":{"r":"傳說","w":0.22,"t":"day","min":2000,"max":12000,"k":"pred"},"whale":{"r":"傳說","w":0.25,"t":null,"min":900,"max":3000,"k":"shadow"},"bluewhale":{"r":"傳說","w":0.1,"t":null,"min":5000,"max":25000,"k":"shadow"},"kuhua":{"r":"常見","w":1,"t":null,"min":0.2,"max":0.8,"k":"school"},"ayu":{"r":"常見","w":1,"t":"twilight","min":0.1,"max":0.6,"k":"school"},"goby":{"r":"稀有","w":1,"t":"night","min":0.1,"max":0.5,"k":"bottom"},"trout":{"r":"傳說","w":1,"t":"night","min":1.2,"max":4.5,"k":"pred"},"tilapia":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.5,"k":"school"},"eel":{"r":"稀有","w":1,"t":"night","min":0.5,"max":3,"k":"bottom"},"carp":{"r":"稀有","w":1,"t":null,"min":1.5,"max":8,"k":"bottom"},"loach":{"r":"常見","w":1,"t":"twilight","min":0.05,"max":0.3,"k":"bottom"},"puffer":{"r":"稀有","w":1,"t":null,"min":0.3,"max":2,"k":"school"},"squid":{"r":"常見","w":1,"t":"night","min":0.1,"max":0.6,"k":"pred"},"bonito":{"r":"常見","w":1,"t":"day","min":0.8,"max":3,"k":"pred"},"tuna":{"r":"傳說","w":0.5,"t":null,"min":80,"max":450,"k":"pred"},"lantern":{"r":"稀有","w":1,"t":"night","min":0.2,"max":0.9,"k":"school"},"clown":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.25,"k":"school"},"parrot":{"r":"稀有","w":1,"t":"day","min":0.8,"max":4,"k":"school"},"cuttle":{"r":"稀有","w":1,"t":null,"min":0.5,"max":3,"k":"bottom"},"octopus":{"r":"稀有","w":1,"t":"night","min":2,"max":15,"k":"bottom"},"ika":{"r":"常見","w":1,"t":"night","min":0.6,"max":4,"k":"pred"},"giantsquid":{"r":"傳說","w":0.25,"t":"night","min":120,"max":500,"k":"shadow"},"snakehead":{"r":"稀有","w":1,"t":null,"min":1,"max":5,"k":"pred"},"bass":{"r":"常見","w":1,"t":null,"min":0.4,"max":2.5,"k":"pred"},"goldfish":{"r":"常見","w":1,"t":"day","min":0.05,"max":0.3,"k":"school"},"sturgeon":{"r":"傳說","w":0.5,"t":"night","min":20,"max":90,"k":"bottom"},"salmon":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.6,"k":"pred"},"jelly":{"r":"稀有","w":1,"t":"night","min":0.2,"max":2,"k":"school"},"flounder":{"r":"常見","w":1,"t":null,"min":0.3,"max":2,"k":"bottom"},"grouper":{"r":"傳說","w":0.55,"t":null,"min":15,"max":60,"k":"bottom"},"barracuda":{"r":"稀有","w":1,"t":"day","min":2,"max":12,"k":"pred"},"hammer":{"r":"傳說","w":0.4,"t":null,"min":80,"max":300,"k":"pred"},"oarfish":{"r":"傳說","w":0.3,"t":"night","min":30,"max":150,"k":"shadow"},"seahorse":{"r":"稀有","w":1,"t":null,"min":0.02,"max":0.1,"k":"school"},"lionfish":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.3,"k":"school"},"turtle":{"r":"傳說","w":0.5,"t":"day","min":40,"max":180,"k":"shadow"},"crab":{"r":"常見","w":1,"t":null,"min":0.1,"max":0.8,"k":"bottom"},"kingcrab":{"r":"稀有","w":1,"t":"night","min":2,"max":8,"k":"bottom"},"lobster":{"r":"稀有","w":1,"t":"night","min":0.5,"max":4,"k":"bottom"},"shrimp":{"r":"常見","w":1,"t":null,"min":0.01,"max":0.05,"k":"bottom"},"arowana":{"r":"傳說","w":1,"t":null,"min":3,"max":12,"k":"pred"},"tilefish":{"r":"常見","w":1,"t":"day","min":0.3,"max":1.8,"k":"school"},"mahi":{"r":"常見","w":1,"t":"day","min":3,"max":15,"k":"pred"},"butterfly":{"r":"常見","w":1,"t":"day","min":0.05,"max":0.3,"k":"school"},"angler":{"r":"傳說","w":0.45,"t":"night","min":10,"max":50,"k":"bottom"},"stingray":{"r":"稀有","w":1,"t":null,"min":2,"max":20,"k":"bottom"},"trevally":{"r":"稀有","w":1,"t":null,"min":5,"max":40,"k":"pred"},"saury":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.3,"k":"school"},"horsemack":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.6,"k":"school"},"hairtail":{"r":"常見","w":1,"t":"night","min":0.5,"max":3,"k":"pred"},"sardine":{"r":"常見","w":1.4,"t":null,"min":0.05,"max":0.15,"k":"school"},"flyingfish":{"r":"常見","w":1,"t":"day","min":0.2,"max":0.5,"k":"school"},"yellowtail":{"r":"常見","w":1,"t":null,"min":1,"max":8,"k":"pred"},"milkfish":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.5,"k":"school"},"mullet":{"r":"常見","w":1,"t":null,"min":0.5,"max":2.5,"k":"school"},"zacco":{"r":"常見","w":1,"t":null,"min":0.03,"max":0.12,"k":"school"},"bighead":{"r":"常見","w":1,"t":null,"min":1,"max":10,"k":"shadow"},"pomfret":{"r":"常見","w":1.3,"t":null,"min":0.2,"max":0.8,"k":"school"},"grunt":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.6,"k":"school"},"roundscad":{"r":"常見","w":1.4,"t":null,"min":0.08,"max":0.3,"k":"school"},"anchovy":{"r":"常見","w":1.4,"t":null,"min":0.01,"max":0.03,"k":"school"},"filefish":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.5,"k":"school"},"threadfin":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.5,"k":"school"},"sergeant":{"r":"常見","w":1.4,"t":null,"min":0.05,"max":0.2,"k":"school"},"rabbitfish":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.6,"k":"school"},"bluetang":{"r":"常見","w":1.2,"t":null,"min":0.1,"max":0.4,"k":"school"},"moonwrasse":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.35,"k":"school"},"acro":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.5,"k":"school"},"pseudorasbora":{"r":"常見","w":1.4,"t":null,"min":0.01,"max":0.03,"k":"school"},"hillstream":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.03,"k":"school"},"candidia":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.05,"k":"school"},"medaka":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.02,"k":"school"},"prawn":{"r":"常見","w":1.6,"t":null,"min":0.06,"max":0.22,"k":"bottom"},"whiteshrimp":{"r":"常見","w":1,"t":null,"min":0.03,"max":0.09,"k":"school"},"tigerprawn":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.18,"k":"bottom"},"crayfish":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.14,"k":"bottom"},"blueclaw":{"r":"稀有","w":1,"t":null,"min":0.15,"max":0.38,"k":"school"},"goldprawn":{"r":"傳說","w":1,"t":null,"min":0.35,"max":0.65,"k":"school"},"koi_sanke":{"r":"傳說","w":0.3,"t":"twilight","min":2.5,"max":7,"k":"school","v":true,"of":"koi"},"koi_showa":{"r":"傳說","w":0.25,"t":"twilight","min":2.5,"max":7,"k":"school","v":true,"of":"koi"},"koi_ogon":{"r":"傳說","w":0.2,"t":"twilight","min":2.5,"max":7,"k":"school","v":true,"of":"koi"},"goldfish_ranchu":{"r":"稀有","w":0.03,"t":"day","min":0.05,"max":0.3,"k":"school","v":true,"of":"goldfish"},"goldfish_telescope":{"r":"稀有","w":0.03,"t":"day","min":0.05,"max":0.3,"k":"school","v":true,"of":"goldfish"},"goldfish_pearl":{"r":"稀有","w":0.03,"t":"day","min":0.05,"max":0.3,"k":"school","v":true,"of":"goldfish"},"clown_black":{"r":"稀有","w":0.03,"t":null,"min":0.05,"max":0.25,"k":"school","v":true,"of":"clown"},"catfish_albino":{"r":"稀有","w":0.015,"t":"night","min":1.5,"max":5.5,"k":"bottom","v":true,"of":"catfish"},"trout_golden":{"r":"傳說","w":0.06,"t":"night","min":1.2,"max":4.5,"k":"pred","v":true,"of":"trout"},"carp_mirror":{"r":"稀有","w":0.015,"t":null,"min":1.5,"max":8,"k":"bottom","v":true,"of":"carp"},"crayfish_blue":{"r":"稀有","w":0.015,"t":null,"min":0.05,"max":0.14,"k":"bottom","v":true,"of":"crayfish"},"tilapia_red":{"r":"稀有","w":0.015,"t":null,"min":0.3,"max":1.5,"k":"school","v":true,"of":"tilapia"},"scat":{"r":"常見","w":1.1,"t":null,"min":0.1,"max":0.6,"k":"school"},"terapon":{"r":"常見","w":1.2,"t":null,"min":0.05,"max":0.3,"k":"school"},"blackbream":{"r":"常見","w":0.8,"t":null,"min":0.3,"max":2.5,"k":"school"},"mudcrab":{"r":"稀有","w":1,"t":null,"min":0.3,"max":2.5,"k":"bottom"},"mangsnapper":{"r":"稀有","w":1,"t":null,"min":1,"max":8,"k":"pred"},"barramundi":{"r":"稀有","w":1,"t":null,"min":2,"max":15,"k":"pred"},"bullshark":{"r":"傳說","w":1,"t":null,"min":90,"max":230,"k":"pred"},"sawfish":{"r":"傳說","w":1,"t":null,"min":100,"max":500,"k":"bottom"},"scat_red":{"r":"稀有","w":0.03,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"scat"},"mudskipper":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.03,"k":"school"},"fiddler":{"r":"常見","w":1.2,"t":null,"min":0.01,"max":0.03,"k":"bottom"},"bigskipper":{"r":"稀有","w":1,"t":null,"min":0.04,"max":0.12,"k":"school"},"mudskipper_albino":{"r":"稀有","w":0.01,"t":null,"min":0.01,"max":0.03,"k":"school","v":true,"of":"mudskipper"},"fiddler_blue":{"r":"稀有","w":0.01,"t":null,"min":0.01,"max":0.03,"k":"bottom","v":true,"of":"fiddler"},"mosquitofish":{"r":"常見","w":1.4,"t":null,"min":0.002,"max":0.01,"k":"school"},"pleco":{"r":"常見","w":1,"t":null,"min":0.2,"max":1.2,"k":"school"},"giantsnake":{"r":"稀有","w":1,"t":null,"min":2,"max":15,"k":"shadow"},"clarias":{"r":"稀有","w":0.6,"t":null,"min":3,"max":20,"k":"shadow"},"guppy":{"r":"常見","w":1.2,"t":null,"min":0.01,"max":0.02,"k":"school"},"guppy_albino":{"r":"稀有","w":0.02,"t":null,"min":0.01,"max":0.02,"k":"school","v":true,"of":"guppy"},"mosquitofish_gold":{"r":"稀有","w":0.02,"t":null,"min":0.002,"max":0.01,"k":"school","v":true,"of":"mosquitofish"},"pleco_albino":{"r":"稀有","w":0.015,"t":null,"min":0.2,"max":1.2,"k":"school","v":true,"of":"pleco"},"giantsnake_red":{"r":"傳說","w":0.01,"t":null,"min":2,"max":15,"k":"shadow","v":true,"of":"giantsnake"},"clarias_albino":{"r":"傳說","w":0.01,"t":null,"min":3,"max":20,"k":"shadow","v":true,"of":"clarias"},"girella":{"r":"常見","w":1,"t":null,"min":0.3,"max":2,"k":"school"},"blackgirella":{"r":"稀有","w":1,"t":null,"min":0.5,"max":3.5,"k":"school"},"lethrinus":{"r":"稀有","w":1,"t":null,"min":1,"max":8,"k":"shadow"},"amberjack":{"r":"傳說","w":0.5,"t":null,"min":10,"max":60,"k":"pred"},"rabbitfish_gold":{"r":"稀有","w":0.02,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"rabbitfish"},"girella_gold":{"r":"稀有","w":0.015,"t":null,"min":0.3,"max":2,"k":"school","v":true,"of":"girella"},"blackgirella_albino":{"r":"傳說","w":0.01,"t":null,"min":0.5,"max":3.5,"k":"school","v":true,"of":"blackgirella"},"lethrinus_red":{"r":"稀有","w":0.015,"t":null,"min":1,"max":8,"k":"shadow","v":true,"of":"lethrinus"},"amberjack_gold":{"r":"傳說","w":0.01,"t":null,"min":10,"max":60,"k":"pred","v":true,"of":"amberjack"},"mehikari":{"r":"常見","w":1,"t":null,"min":0.02,"max":0.08,"k":"school"},"rattail":{"r":"常見","w":1,"t":null,"min":0.2,"max":1.5,"k":"school"},"blackthroat":{"r":"稀有","w":1,"t":null,"min":0.2,"max":1,"k":"school"},"blobfish":{"r":"稀有","w":1,"t":null,"min":0.5,"max":2.5,"k":"school"},"fangtooth":{"r":"稀有","w":1,"t":null,"min":0.03,"max":0.12,"k":"school"},"goblinshark":{"r":"傳說","w":0.2,"t":null,"min":40,"max":200,"k":"pred"},"sixgill":{"r":"傳說","w":0.2,"t":null,"min":80,"max":500,"k":"shadow"},"mehikari_gold":{"r":"稀有","w":0.025,"t":null,"min":0.02,"max":0.08,"k":"school","v":true,"of":"mehikari"},"rattail_albino":{"r":"稀有","w":0.02,"t":null,"min":0.2,"max":1.5,"k":"school","v":true,"of":"rattail"},"blackthroat_gold":{"r":"稀有","w":0.02,"t":null,"min":0.2,"max":1,"k":"school","v":true,"of":"blackthroat"},"blobfish_albino":{"r":"稀有","w":0.02,"t":null,"min":0.5,"max":2.5,"k":"school","v":true,"of":"blobfish"},"deeplantern":{"r":"常見","w":1,"t":null,"min":0.02,"max":0.12,"k":"school"},"deeplantern_albino":{"r":"常見","w":0.012,"t":null,"min":0.02,"max":0.12,"k":"school","v":true,"of":"deeplantern"},"vampsquid":{"r":"稀有","w":1,"t":null,"min":0.2,"max":0.6,"k":"school"},"vampsquid_albino":{"r":"稀有","w":0.02,"t":null,"min":0.2,"max":0.6,"k":"school","v":true,"of":"vampsquid"},"angler_albino":{"r":"傳說","w":0.02,"t":null,"min":5,"max":50,"k":"bottom","v":true,"of":"angler"},"marsnail":{"r":"稀有","w":1,"t":null,"min":0.03,"max":0.16,"k":"school"},"marsnail_albino":{"r":"稀有","w":0.03,"t":null,"min":0.03,"max":0.16,"k":"school","v":true,"of":"marsnail"},"cuskeel":{"r":"稀有","w":1,"t":null,"min":0.05,"max":0.3,"k":"school"},"cuskeel_albino":{"r":"稀有","w":0.03,"t":null,"min":0.05,"max":0.3,"k":"school","v":true,"of":"cuskeel"},"dumbo":{"r":"稀有","w":1,"t":null,"min":0.2,"max":2.5,"k":"school"},"dumbo_albino":{"r":"稀有","w":0.03,"t":null,"min":0.2,"max":2.5,"k":"school","v":true,"of":"dumbo"},"amphipod":{"r":"常見","w":1,"t":null,"min":0.02,"max":0.12,"k":"school"},"amphipod_albino":{"r":"常見","w":0.02,"t":null,"min":0.02,"max":0.12,"k":"school","v":true,"of":"amphipod"},"seacuc":{"r":"常見","w":1,"t":null,"min":0.1,"max":0.6,"k":"school"},"seacuc_albino":{"r":"常見","w":0.02,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"seacuc"},"fangtooth_gold":{"r":"稀有","w":0.02,"t":null,"min":0.03,"max":0.12,"k":"school","v":true,"of":"fangtooth"},"goblinshark_albino":{"r":"傳說","w":0.008,"t":null,"min":40,"max":200,"k":"pred","v":true,"of":"goblinshark"},"sixgill_albino":{"r":"傳說","w":0.008,"t":null,"min":80,"max":500,"k":"shadow","v":true,"of":"sixgill"},"creolefish":{"r":"常見","w":1,"t":null,"min":0.2,"max":0.8,"k":"school"},"razorsurgeon":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.2,"k":"school"},"idol":{"r":"常見","w":1,"t":null,"min":0.1,"max":0.4,"k":"school"},"batfish":{"r":"稀有","w":1,"t":null,"min":0.1,"max":0.6,"k":"school"},"galapagosshark":{"r":"傳說","w":0.25,"t":null,"min":30,"max":85,"k":"pred"},"creolefish_gold":{"r":"稀有","w":0.025,"t":null,"min":0.2,"max":0.8,"k":"school","v":true,"of":"creolefish"},"razorsurgeon_albino":{"r":"稀有","w":0.02,"t":null,"min":0.3,"max":1.2,"k":"school","v":true,"of":"razorsurgeon"},"idol_gold":{"r":"稀有","w":0.02,"t":null,"min":0.1,"max":0.4,"k":"school","v":true,"of":"idol"},"batfish_albino":{"r":"稀有","w":0.02,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"batfish"},"galapagosshark_albino":{"r":"傳說","w":0.008,"t":null,"min":30,"max":85,"k":"pred","v":true,"of":"galapagosshark"},"wakasagi":{"r":"常見","w":1,"t":null,"min":0.008,"max":0.035,"k":"school"},"shirauo":{"r":"常見","w":1,"t":null,"min":0.004,"max":0.02,"k":"school"},"dolly":{"r":"稀有","w":1,"t":null,"min":0.15,"max":1.4,"k":"school"},"himemasu":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.6,"k":"school"},"ito":{"r":"傳說","w":0.25,"t":null,"min":4,"max":35,"k":"shadow"},"capelin":{"r":"常見","w":1,"t":null,"min":0.015,"max":0.06,"k":"school"},"hokke":{"r":"常見","w":1,"t":null,"min":0.2,"max":1.2,"k":"school"},"cod":{"r":"常見","w":1,"t":null,"min":0.8,"max":9,"k":"bottom"},"sleepershark":{"r":"傳說","w":0.2,"t":null,"min":80,"max":700,"k":"pred"},"wakasagi_gold":{"r":"稀有","w":0.025,"t":null,"min":0.008,"max":0.035,"k":"school","v":true,"of":"wakasagi"},"shirauo_gold":{"r":"稀有","w":0.025,"t":null,"min":0.004,"max":0.02,"k":"school","v":true,"of":"shirauo"},"dolly_gold":{"r":"稀有","w":0.02,"t":null,"min":0.15,"max":1.4,"k":"school","v":true,"of":"dolly"},"himemasu_albino":{"r":"稀有","w":0.02,"t":null,"min":0.3,"max":1.6,"k":"school","v":true,"of":"himemasu"},"ito_gold":{"r":"傳說","w":0.008,"t":null,"min":4,"max":35,"k":"shadow","v":true,"of":"ito"},"capelin_gold":{"r":"稀有","w":0.025,"t":null,"min":0.015,"max":0.06,"k":"school","v":true,"of":"capelin"},"hokke_albino":{"r":"稀有","w":0.02,"t":null,"min":0.2,"max":1.2,"k":"school","v":true,"of":"hokke"},"cod_albino":{"r":"稀有","w":0.02,"t":null,"min":0.8,"max":9,"k":"bottom","v":true,"of":"cod"},"sleepershark_albino":{"r":"傳說","w":0.008,"t":null,"min":80,"max":700,"k":"pred","v":true,"of":"sleepershark"},"baskingshark":{"r":"傳說","w":0.18,"t":null,"min":500,"max":4000,"k":"pred"},"greatwhite":{"r":"傳說","w":0.2,"t":null,"min":300,"max":1500,"k":"pred"},"baskingshark_albino":{"r":"傳說","w":0.008,"t":null,"min":500,"max":4000,"k":"pred","v":true,"of":"baskingshark"},"greatwhite_albino":{"r":"傳說","w":0.008,"t":null,"min":300,"max":1500,"k":"pred","v":true,"of":"greatwhite"},"bluewhale_albino":{"r":"傳說","w":0.005,"t":null,"min":5000,"max":25000,"k":"shadow","v":true,"of":"bluewhale"},"shark_red_albino":{"r":"傳說","w":1,"t":null,"min":15,"max":420,"k":"pred","v":true,"of":"shark"},"shark_red":{"r":"傳說","w":1,"t":null,"min":15,"max":420,"k":"pred","v":true,"of":"shark"},"arowana_red":{"r":"傳說","w":0.1,"t":null,"min":3,"max":12,"k":"pred","v":true,"of":"arowana"},"sicyo":{"r":"常見","w":1,"t":null,"min":0.02,"max":0.08,"k":"school"},"eleotris":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.3,"k":"school"},"kuhlia":{"r":"稀有","w":1,"t":null,"min":0.1,"max":0.6,"k":"school"},"mokuzu":{"r":"稀有","w":1,"t":null,"min":0.08,"max":0.4,"k":"school"},"marmorata":{"r":"傳說","w":1,"t":"night","min":2,"max":20,"k":"shadow"},"sicyo_blue":{"r":"稀有","w":0.04,"t":null,"min":0.02,"max":0.08,"k":"school","v":true,"of":"sicyo"},"eleotris_albino":{"r":"稀有","w":0.025,"t":null,"min":0.05,"max":0.3,"k":"school","v":true,"of":"eleotris"},"kuhlia_gold":{"r":"傳說","w":0.03,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"kuhlia"},"mokuzu_blue":{"r":"傳說","w":0.03,"t":null,"min":0.08,"max":0.4,"k":"school","v":true,"of":"mokuzu"},"marmorata_gold":{"r":"傳說","w":0.03,"t":"night","min":2,"max":20,"k":"shadow","v":true,"of":"marmorata"},"fwfish":{"r":"稀有","w":1,"t":"night","min":0.3,"max":1.6,"k":"school","fest":"ny"},"fwfish_gold":{"r":"傳說","w":0.05,"t":"night","min":0.3,"max":1.6,"k":"school","v":true,"of":"fwfish","fest":"ny"},"xclown":{"r":"稀有","w":1,"t":null,"min":0.05,"max":0.25,"k":"school","fest":"xmas"},"xclown_gold":{"r":"傳說","w":0.05,"t":null,"min":0.05,"max":0.25,"k":"school","v":true,"of":"xclown","fest":"xmas"},"xwrasse":{"r":"稀有","w":1,"t":null,"min":0.1,"max":0.6,"k":"school","fest":"xmas"},"xwrasse_gold":{"r":"傳說","w":0.05,"t":null,"min":0.1,"max":0.6,"k":"school","v":true,"of":"xwrasse","fest":"xmas"},"snowmoray":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.5,"k":"school","fest":"xmas"},"snowmoray_gold":{"r":"傳說","w":0.05,"t":null,"min":0.3,"max":1.5,"k":"school","v":true,"of":"snowmoray","fest":"xmas"},"koi_red":{"r":"稀有","w":1,"t":null,"min":0.5,"max":4,"k":"school","fest":"cny"},"koi_fuku":{"r":"傳說","w":0.05,"t":null,"min":0.5,"max":4,"k":"school","v":true,"of":"koi_red","fest":"cny"},"bluelobster":{"r":"傳說","w":1,"t":null,"min":0.4,"max":1.2,"k":"school"}},"sea":["sea","harbor","isle","mangrove","mudflat","reef","weir","icesea","abyss","mystic"],"rain":["catfish","eel","snakehead","tilapia","bass","loach"],"lure":["barramundi","mangsnapper","bullshark","yellowtail","hairtail","cod","toothfish","bass","snakehead","mackerel","bonito","barracuda","mahi","tuna","trevally","marlin","perch","trout","salmon","arowana","shark","hammer","squid","ika"],"bottom":["fiddler","fiddler_blue","mudcrab","sawfish","cod","toothfish","crayfish","prawn","tigerprawn","catfish","eel","flounder","scorpion","crab","kingcrab","lobster","stingray","grouper","sturgeon","loach","goby","octopus","angler","cuttle","shrimp","crucian","carp"],"seasons":{"spring":["ayu","salmon","shrimp","squid","carp","flounder"],"summer":["mahi","bonito","parrot","butterfly","jelly","sunfish"],"autumn":["mackerel","crab","cuttle","barracuda","catfish","eel"],"winter":["tilefish","kingcrab","ika","angler","crucian","grouper"]},"weathers":[{"k":"sunny","w":45,"bite":1,"rare":1,"legend":1,"legendSea":false},{"k":"cloudy","w":25,"bite":1,"rare":1.05,"legend":1,"legendSea":false},{"k":"rain","w":15,"bite":0.8,"rare":1.15,"legend":1,"legendSea":false},{"k":"fog","w":8,"bite":1,"rare":1.25,"legend":1,"legendSea":false},{"k":"storm","w":7,"bite":0.9,"rare":1.2,"legend":1.6,"legendSea":true}],"tide":{"rising":{"bite":0.78,"rare":1.15},"high":{"bite":0.9,"rare":1.05},"falling":{"bite":1,"rare":1},"low":{"bite":1.25,"rare":0.9}},"legK":{"harbor":1.3,"other":0.35},"rods":{"bamboo":{"rare":1,"legend":1},"carbon":{"rare":1.2,"legend":1.05},"lure":{"rare":1.25,"legend":1.1},"deep":{"rare":1.3,"legend":1.25},"moon":{"rare":1.5,"legend":1.3},"king":{"rare":1.45,"legend":1.5},"pole_bamboo":{"rare":1.05,"legend":1,"type":"pole"},"pole_carbon":{"rare":1.3,"legend":1.1,"type":"pole"},"surf_basic":{"rare":1.1,"legend":1.05,"type":"surf"},"surf_pro":{"rare":1.35,"legend":1.2,"type":"surf"},"iso_basic":{"rare":1.15,"legend":1.05,"type":"iso"},"iso_pro":{"rare":1.4,"legend":1.2,"type":"iso"}},"rodFit":{"pole":["river","lake","pool","creek","canal","weir","icelake"],"surf":["sea","icesea","abyss"],"iso":["harbor","isle","reef"]},"baits":{"worm":{"rare":1.25,"legend":1,"k":"bottom"},"live":{"rare":1.15,"legend":1.1,"k":"pred"},"glow":{"rare":1.8,"legend":1.1},"squidbait":{"rare":1.4,"legend":1.4},"gold":{"rare":1.3,"legend":1.8},"rainbow":{"rare":2.2,"legend":2.2}},"chums":{"chum_rice":{"rare":1.15,"legend":1,"dur":120,"fresh":true,"sea":false},"chum_krill":{"rare":1.35,"legend":1.15,"dur":150,"fresh":false,"sea":true},"chum_gold":{"rare":1.5,"legend":1.8,"dur":180,"fresh":false,"sea":false}},"buffs":{"saba":{"rare":1.3,"legend":1,"casts":5},"tai":{"rare":1,"legend":1.5,"casts":5},"ayu":{"rare":1,"legend":1,"casts":5},"suzuki":{"rare":1,"legend":1,"casts":5},"mori":{"rare":1.2,"legend":1.2,"casts":10},"tako":{"rare":1,"legend":1.3,"casts":6},"ikayaki":{"rare":1.4,"legend":1,"casts":5},"sumi":{"rare":1,"legend":1,"casts":5},"sanbei":{"rare":1,"legend":1,"casts":4},"toro":{"rare":1.3,"legend":1.6,"casts":8},"unadon":{"rare":1,"legend":1,"casts":6},"fugu":{"rare":1,"legend":1.4,"casts":6},"tilapia":{"rare":1.15,"legend":1,"casts":6},"ebi":{"rare":1.25,"legend":1,"casts":6}},"wildBreed":["tilapia","tilapia_red","crucian","pseudorasbora","medaka","mudskipper","fiddler","crayfish","guppy"],"brood":["tilapia","tilapia_red"],"lines":{"thin":{"rare":1},"normal":{"rare":1},"thick":{"rare":0.92}},"secretGrow":600000,"secretLife":3600000,"dayLen":2160,"wxBlock":540000,"tidePeriod":1080000}'::jsonb $cfg$;

-- 跟遊戲 hash32 一樣（FNV-1a 32 位元）
create or replace function public._fnv(s text) returns bigint language plpgsql immutable as $$
declare h bigint := 2166136261; i integer;
begin
  for i in 1..length(s) loop h := (h # ascii(substr(s, i, 1))) * 16777619 % 4294967296; end loop;
  return h;
end $$;

-- 現在的天氣（9 分鐘一段）
create or replace function public._weather(ms bigint) returns jsonb language plpgsql stable as $$
declare cfg jsonb := public._fishcfg(); r integer; acc integer := 0; w jsonb;
begin
  r := public._fnv('wx' || floor(ms / (cfg->>'wxBlock')::numeric)::bigint::text) % 100;
  for w in select * from jsonb_array_elements(cfg->'weathers') loop acc := acc + (w->>'w')::integer; if r < acc then return w; end if; end loop;
  return cfg->'weathers'->0;
end $$;

-- 抽一條魚（拋竿時呼叫）
-- 藍鯨浮上來的時間（228，230 改成 90 秒）：每 20 分鐘一輪，這一輪從第 off 秒開始的 90 秒；off 用固定公式算，遊戲畫面（bwWin）也是同一個公式
create or replace function public._bw_up() returns boolean language sql stable as $$
  select (s - c * 3600 - ((c * 2654435761) % 4294967296) % 3420) between 0 and 89   -- v244：每小時一次（原本每 20 分鐘，太常出現）
  from (select floor(extract(epoch from now()))::bigint as s, floor(extract(epoch from now()) / 3600)::bigint as c) x $$;

-- 247：水面的徵兆（漣漪＝小魚群、魚影＝中大型魚、海鳥＝掠食魚、氣泡＝底棲魚）。每個釣點每 45 秒一批，跟 js/game.js 的 signsAt 同一個公式。
-- 浮標落在徵兆旁邊 0.7～2.4 公尺：那一類魚 ×2.5（傳說 ×1.3）；0.7 公尺內是砸在上面，魚被嚇跑，沒有加成。
create or replace function public._sign_m(a bigint) returns bigint language sql immutable as $$ select (((a * 9301 + 49297) % 233280) * 9301 + 49297) % 233280 $$;
drop function if exists public._sign_hit(text, numeric, numeric);
drop function if exists public._sign_hit(text, numeric, numeric, bigint);
-- 255：p_bk＝用的餌吸引哪一類（活餌→掠食魚、蚯蚓→底棲魚），那一類徵兆的範圍從 2.4 變 3.6 公尺
create or replace function public._sign_hit(p_spot text, p_bx numeric, p_bz numeric, p_sl bigint, p_bk text default null) returns text language plpgsql stable set search_path = public as $$
declare cfg jsonb := public._fishcfg(); sp jsonb := cfg->'spots'->p_spot; kinds text[]; sc integer := 0; slot bigint; o integer; base bigint; n integer; i integer; b bigint;
  k text; d float8; a float8; acc float8[] := '{}'; j integer; ok boolean; scared boolean := false; sx float8; sz float8; dx float8; dz float8; gx float8; gz float8; dist float8; best float8 := 99; bk text := null;
begin
  if sp is null or sp->>'dx' is null or p_bx is null or p_bz is null or p_spot in ('shrimp', 'icelake', 'mudflat') then return null; end if;
  sx := (sp->>'x')::float8; sz := (sp->>'z')::float8; dx := (sp->>'dx')::float8; dz := (sp->>'dz')::float8;
  if sqrt(power(p_bx::float8 - sx, 2) + power(p_bz::float8 - sz, 2)) > 16 then return null; end if;
  select array_agg(v.k0 order by v.o0) into kinds from (values ('school', 1), ('shadow', 2), ('pred', 3), ('bottom', 4)) v(k0, o0)
    where exists (select 1 from jsonb_array_elements_text(sp->'fish') x where cfg->'fish'->x->>'k' = v.k0 and not coalesce((cfg->'fish'->x->>'v')::boolean, false));
  if kinds is null then return null; end if;
  for i in 1..length(p_spot) loop sc := sc + ascii(substr(p_spot, i, 1)); end loop;
  slot := floor(extract(epoch from clock_timestamp()) / 45)::bigint;
  if p_sl is null or abs(p_sl - slot) > 1 then return null; end if;   -- 手機說是哪一批（差一批以內都算：剛好換批、時間差一點點）
  for o in 0..0 loop
    base := (p_sl % 100000) * 13 + sc * 7; n := 2 + floor(public._sign_m(base) * 3 / 233280.0)::integer;
    acc := '{}';
    for i in 0..n - 1 loop
      b := base + (i + 1) * 101; k := kinds[1 + floor(public._sign_m(b) * array_length(kinds, 1) / 233280.0)::integer];
      d := 3.5 + public._sign_m(b + 17) / 233280.0 * 5.5; a := (public._sign_m(b + 34) / 233280.0 - 0.5) * 1.5;
      gx := sx + (dx * cos(a) - dz * sin(a)) * d; gz := sz + (dx * sin(a) + dz * cos(a)) * d;
      ok := true; j := 1; while j < coalesce(array_length(acc, 1), 0) loop if sqrt(power(acc[j] - gx, 2) + power(acc[j + 1] - gz, 2)) < 3 then ok := false; end if; j := j + 2; end loop;   -- 太靠近前一個的不算（跟 js 一樣）
      if not ok then continue; end if; acc := acc || array[gx, gz];
      dist := sqrt(power(p_bx::float8 - gx, 2) + power(p_bz::float8 - gz, 2));
      if dist < 0.7 then scared := true; end if;
      if dist >= 0.7 and dist <= (case when k = p_bk then 3.6 else 2.4 end) and dist < best then best := dist; bk := k; end if;
    end loop;
  end loop;
  if scared then return null; end if;   -- 砸在徵兆上面：魚被嚇跑
  return bk; end $$;

drop function if exists public.roll_fish(text, numeric, numeric, numeric, text, text, text, text, boolean);
drop function if exists public.roll_fish(text, numeric, numeric, numeric, text, text, text, text, boolean, numeric, numeric);
create or replace function public.roll_fish(p_spot text, p_charge numeric, p_x numeric, p_z numeric, p_rig text, p_line text, p_bait text, p_chum text, p_boat boolean, p_bx numeric default null, p_bz numeric default null, p_sl bigint default null)
returns public.players language plpgsql security definer set search_path = public as $$
declare
  pl public.players := public._me(); cfg jsonb := public._fishcfg(); sp jsonb := cfg->'spots'->p_spot;
  ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  charge numeric := least(1, greatest(0, coalesce(p_charge, 0)));
  rig text := case when p_rig in ('float', 'lure', 'bottom') then p_rig else 'float' end;
  ln jsonb := coalesce(cfg->'lines'->coalesce(p_line, 'normal'), cfg->'lines'->'normal');
  rod jsonb := coalesce(cfg->'rods'->pl.rod, cfg->'rods'->'bamboo');
  bait jsonb; bf jsonb; cb_r numeric := 1; cb_l numeric := 1; w jsonb; tide_st text; tr numeric := 1;
  sea boolean := p_spot = any(array(select jsonb_array_elements_text(cfg->'sea')));
  ring numeric := 1; lb numeric := 1; per text; gh numeric; tip_spot text; tip_fish text; hh bigint; pool text[];
  ipool text[]; ih bigint; intel text[] := '{}'; sc_mine boolean := false; evm jsonb;
  eco jsonb := '{}';   -- 海洋生態（066）：魚群洄游、群聚、保育
  season text; mo integer; kr numeric; kl numeric; nleg integer; legk numeric; rainy boolean;
  fid text; f jsonb; wt numeric; tot numeric := 0; ids text[] := '{}'; wts numeric[] := '{}'; pick text; r numeric; i integer;
  rsh public.red_sharks; rs text; gpv text; fitk numeric := 1; sx text; brood boolean := false; wild boolean := false;
  c jsonb; ctype text; cat timestamptz; left_k numeric; fit numeric; k numeric; sc jsonb; age numeric; pw numeric; nb integer; fw numeric;
  sf record;   -- 蔚博士的新品種（070）
  sg_k text;   -- 247：浮標落在哪一種徵兆旁邊
begin
  if sp is null then raise exception '沒有這個釣點'; end if;
  if pl.cast_at is not null and now() - pl.cast_at < interval '2.5 seconds' then raise exception '拋太快了'; end if;
  if p_spot = 'shrimp' and coalesce(pl.shrimp_until, '-infinity') < now() then raise exception '要先買釣蝦時段'; end if;
  -- 紅樹林泥灘（035）：退潮、泥灘露出來的時候才能下去抓（跟 js/game.js 的 mudGrabOk 一樣：潮位 < -0.5）
  if p_spot = 'mudflat' and sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) >= -0.5 then raise exception '泥灘現在被水淹著，退潮才能下去抓'; end if;
  -- 魚餌（路亞不用魚餌）：伺服器扣掉一個
  if p_bait is not null and rig <> 'lure' and cfg->'baits' ? p_bait and coalesce((pl.bait ->> p_bait)::integer, 0) > 0 then
    bait := cfg->'baits'->p_bait; nb := (pl.bait ->> p_bait)::integer - 1;
    pl.bait := case when nb <= 0 then pl.bait - p_bait else jsonb_set(pl.bait, array[p_bait], to_jsonb(nb)) end;
    if nb <= 0 and pl.bait_on = p_bait then pl.bait_on := null; end if;
  end if;
  -- 料理加成（吃了料理以後幾次拋竿有效）
  if pl.buff_r is not null and pl.buff_left > 0 and cfg->'buffs' ? pl.buff_r then bf := cfg->'buffs'->pl.buff_r; pl.buff_left := pl.buff_left - 1; end if;
  -- 窩料：「現在打」要真的有人在 3 分鐘內打過這種窩；「提前打」要是自己的祕密窩點
  if p_chum like 'live:%' then
    ctype := substr(p_chum, 6); c := cfg->'chums'->ctype;
    if c is not null then
      select max(chum_at) into cat from public.players where chum_type = ctype and chum_at > now() - make_interval(secs => (c->>'dur')::numeric);
      if cat is not null then
        left_k := least(1, greatest(0, 1 - extract(epoch from now() - cat) / (c->>'dur')::numeric));
        fit := case when (c->>'fresh')::boolean then (case when sea then 0.45 else 1 end) when (c->>'sea')::boolean then (case when sea then 1 else 0.5 end) else 1 end;
        k := (0.45 + 0.55 * left_k) * fit; cb_r := 1 + ((c->>'rare')::numeric - 1) * k; cb_l := 1 + ((c->>'legend')::numeric - 1) * k;
      end if;
    end if;
  elsif p_chum like 'secret:%' then
    -- 092：別人的祕密窩點也能用（要站在窩點 10 公尺內），效果 75%；自己的 100%
    select e, s.owner = pl.id into sc, sc_mine from public.secret_chum s, jsonb_array_elements(s.spots) e
      where e->>'id' = substr(p_chum, 8) and (s.owner = pl.id or (p_x is not null and p_z is not null and sqrt(power(p_x - (e->>'x')::numeric, 2) + power(p_z - (e->>'z')::numeric, 2)) < 10))
      order by (s.owner = pl.id) desc limit 1;
    if sc is not null and cfg->'chums' ? (sc->>'type') then
      c := cfg->'chums'->(sc->>'type'); age := ms - (sc->>'at')::bigint;
      if age >= 0 and age <= (cfg->>'secretLife')::numeric then
        pw := least(1, greatest(0.15, 0.15 + 0.85 * age / (cfg->>'secretGrow')::numeric));
        fit := case when (c->>'fresh')::boolean then (case when sea then 0.45 else 1 end) when (c->>'sea')::boolean then (case when sea then 1 else 0.5 end) else 1 end;
        k := pw * fit * (case when sc_mine then 1 else 0.75 end); cb_r := 1 + ((c->>'rare')::numeric * 1.25 - 1) * k; cb_l := 1 + ((c->>'legend')::numeric * 1.35 - 1) * k;
      end if;
    end if;
  end if;
  -- 天氣、潮汐
  w := public._weather(ms);
  if sea then
    tide_st := case when sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) > 0.8 then 'high'
                    when sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) < -0.8 then 'low'
                    when cos((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) > 0 then 'rising' else 'falling' end;
    tr := (cfg->'tide'->tide_st->>'rare')::numeric;
  end if;
  rainy := w->>'k' in ('rain', 'storm');
  -- 發光圈（好釣點）：站在圈圈旁邊（不是在船上）
  if not coalesce(p_boat, false) and p_x is not null and p_z is not null and sqrt(power(p_x - (sp->>'x')::numeric, 2) + power(p_z - (sp->>'z')::numeric, 2)) < 2.2 then
    ring := 1.3; lb := (sp->>'lb')::numeric; end if;
  -- 遊戲裡的時間（一天 36 分鐘）
  gh := mod((mod(ms / 1000.0, (cfg->>'dayLen')::numeric) / (cfg->>'dayLen')::numeric * 24 + 8)::numeric, 24);
  per := case when gh >= 7.5 and gh < 17 then 'day' when (gh >= 5 and gh < 7.5) or (gh >= 17 and gh < 19.6) then 'twilight' else 'night' end;
  -- 今日情報
  hh := public._fnv('tip' || to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD'));
  tip_spot := cfg->'tipSpots'->>(hh % jsonb_array_length(cfg->'tipSpots'))::integer;
  pool := array(select x from jsonb_array_elements_text(cfg->'spots'->tip_spot->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) order by n);
  tip_fish := pool[1 + ((hh / 256) % cardinality(pool))::integer];
  -- 外海的魚情（每 5 分鐘換 3 種活躍的魚，×2.5；跟 js/game.js 的 intelAt 一樣）
  if p_spot = 'harbor' then
    ipool := array(select x from jsonb_array_elements_text(cfg->'spots'->'harbor'->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) and cfg->'fish'->x->>'fest' is null order by n);   -- v283 節慶魚不排進魚情
    ih := public._fnv('intel' || floor(ms / 300000.0)::bigint::text);
    intel := array[ipool[1 + (ih % cardinality(ipool))::integer], ipool[1 + ((ih / 256) % cardinality(ipool))::integer], ipool[1 + ((ih / 65536) % cardinality(ipool))::integer]];
  end if;
  -- 季節
  mo := extract(month from now() at time zone 'Asia/Taipei');
  season := case when mo between 3 and 5 then 'spring' when mo between 6 and 8 then 'summer' when mo between 9 and 11 then 'autumn' else 'winter' end;
  -- 專用竿（036）：手竿、遠投竿、磯釣竿用在對的釣點稀有魚 ×1.15，用錯 ×0.85；甩竿不變（跟 js/game.js 的 rodFit 一樣）
  fitk := case when p_spot in ('shrimp', 'mudflat') or cfg->'rodFit'->coalesce(rod->>'type', 'cast') is null then 1 when cfg->'rodFit'->coalesce(rod->>'type', 'cast') ? p_spot then 1.15 else 0.85 end;
  kr := fitk * (rod->>'rare')::numeric * coalesce((bait->>'rare')::numeric, 1) * coalesce((bf->>'rare')::numeric, 1) * cb_r * (w->>'rare')::numeric * tr * (ln->>'rare')::numeric;
  kl := (rod->>'legend')::numeric * coalesce((bait->>'legend')::numeric, 1) * coalesce((bf->>'legend')::numeric, 1) * cb_l
        * (case when (w->>'legendSea')::boolean then (case when sea then (w->>'legend')::numeric else 1 end) else (w->>'legend')::numeric end);
  select count(*) into nleg from jsonb_array_elements_text(sp->'fish') x where cfg->'fish'->x->>'r' = '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false);   -- 變種不算
  legk := (case when p_spot = 'harbor' then (cfg->'legK'->>'harbor')::numeric else (cfg->'legK'->>'other')::numeric end) / greatest(1, nleg);
  begin select coalesce(jsonb_object_agg(e.fish, e.mult), '{}') into eco from public.ocean_eco e where e.spot = p_spot and e.until > now(); exception when undefined_table then eco := '{}'; end;
  sg_k := case when p_boat then null else public._sign_hit(p_spot, p_bx, p_bz, p_sl, bait->>'k') end;
  begin evm := public._ev_mig(); if public._ev_meteor() then kl := kl * 1.6; end if; exception when undefined_function then evm := null; end;   -- 111 釣魚活動：魚群洄游、流星雨
  if p_boat then begin if public._breach_luck(pl.id) then kr := kr * 1.4; kl := kl * 1.25; end if; exception when undefined_function then null; end; end if;   -- 113 在外海看到鯨魚跳出水面：3 分鐘內在船上釣稀有 ×1.4、傳說 ×1.25
  for fid in select x from jsonb_array_elements_text(sp->'fish') with ordinality t(x, n) order by n loop
    f := cfg->'fish'->fid; if f is null then continue; end if;
    if f ? 'fest' and not public._fest_on(f->>'fest') then continue; end if;   -- 節慶限定魚（087）：只有那個節日期間釣得到
    wt := (f->>'w')::numeric
      * (case when rig = 'lure' then (case when cfg->'lure' ? fid then 2.2 else 0.55 end) when rig = 'bottom' then (case when cfg->'bottom' ? fid then 2.2 else 0.65 end) else 1 end)
      * (case when fid = any(intel) then 2.5 else 1 end)
      * coalesce((eco->>fid)::numeric, 1)
      * (case when season in ('spring', 'summer') and cfg->'wildBreed' ? fid then 1.5 else 1 end)   -- 野外繁殖季（037）：春夏吳郭魚、鯽魚這些會自己生的魚比較多
      * (case when p_spot <> 'mudflat' then 1 when (rig = 'bottom') = (cfg->'bottom' ? fid) then 1 else 0 end)   -- 泥灘：抓招潮蟹（沉底）只會是蟹，抓彈塗魚只會是魚
      * (case when tip_spot = p_spot and tip_fish = fid then 2.5 else 1 end)
      * (case when rainy and cfg->'rain' ? fid then 2 else 1 end)
      * (case when cfg->'seasons'->season ? fid and f->>'r' <> '傳說' then 2 else 1 end)
      * (case when f->>'t' is null then 1 when f->>'t' = per then 1.5 else 0.15 end)
      * (case when p_spot = 'harbor' and fid in ('bluewhale', 'bluewhale_albino') and public._bw_up() then 5 else 1 end)
      * (case when evm is not null and (evm->>'active')::boolean and p_spot = evm->>'spot' and fid = evm->>'fish' then 4 else 1 end)   -- 111 魚群洄游：那種魚在那個釣點 ×4
      * (case when sg_k is not null and f->>'k' = sg_k then (case when f->>'r' = '傳說' then (case when sg_k = bait->>'k' then 1.5 else 1.3 end) else (case when sg_k = bait->>'k' then 4 else 2.5 end) end) else 1 end)   -- 247 徵兆（255：餌對上徵兆加成更大）
      * (case when bait->>'k' is not null and f->>'k' = bait->>'k' then 1.5 else 1 end)   -- 255 餌吸引的那一類魚   -- 藍鯨浮上來的 90 秒（228）：港口外海釣到藍鯨的機率 ×5
      * (case f->>'r' when '常見' then 1 when '稀有' then 0.34 * (1 + charge * 0.8) * kr * ring else 0.07 * (1 + charge * 1.6) * lb * kl * ring * legk end);
    ids := ids || fid; wts := wts || wt; tot := tot + wt;
  end loop;
  if cardinality(ids) = 0 then raise exception '沒有這個釣點'; end if;
  r := random() * tot; pick := ids[1];
  for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
  -- 蔚博士發現的新品種（070）：在發現的那個釣點，抽到的魚有機會換成新品種（當天發現的 5%，以前的每一種 1.2%；深海巨魚 1.5%／0.4%）；新品種的變種 4%
  begin
    for sf in select s.id, s.var_id, s.day, s.giant from public.sci_finds s where s.spot = p_spot and s.day <= (now() at time zone 'Asia/Taipei')::date order by s.day desc limit 60 loop
      if random() < (case when sf.giant then (case when sf.day = (now() at time zone 'Asia/Taipei')::date then 0.015 else 0.004 end) * (1 + charge * 0.6)   -- 深海巨魚（074）：傳說級，很難遇到
                          when sf.day = (now() at time zone 'Asia/Taipei')::date then 0.05 else 0.012 end) then pick := case when random() < 0.04 then sf.var_id else sf.id end; exit; end if;
    end loop;
  exception when undefined_table or undefined_column then null; end;
  -- 釣蝦場老闆的放生活動（027）：極小的機會碰到全伺服器只有一隻的特別蝦
  if p_spot = 'shrimp' then fid := public._sev_try(pl.id); if fid is not null and cfg->'fish' ? fid then pick := fid; end if; end if;
  -- 赤紅霸王鯊（032）：全伺服器的族群，隻數越多機率越高（還是非常低）
  -- 珊瑚礁岸：紅鯊偶爾在礁外的深水邊巡游（機率是港口外海的四成）
  if p_spot = 'harbor' or (p_spot = 'reef' and random() < 0.4) then rsh := public._rs_try(pl.id); if rsh.id is not null then pick := case when rsh.albino then 'shark_red_albino' else 'shark_red' end; rs := rsh.id || ':' || rsh.sex || ':' || rsh.scars || (case when rsh.hooked_by is null then ':x' else '' end); end if; end if;
  f := coalesce(cfg->'fish'->pick, (select jsonb_build_object('r', s.rarity, 'min', s.min_w, 'max', s.max_w) from public.fish_species s where s.id = pick));
  wild := season in ('spring', 'summer') and cfg->'wildBreed' ? pick;
  fw := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), case when wild then 2.4 else 1.7 end))::numeric, 2);   -- 繁殖季小魚比較多
  -- 公母（037）：一半一半；紅鯊用牠自己的性別；繁殖季的母吳郭魚有三成嘴裡含著小魚
  sx := case when rs is not null then rsh.sex when random() < 0.5 then 'M' else 'F' end;
  brood := sx = 'F' and season in ('spring', 'summer') and cfg->'brood' ? pick and random() < 0.3;
  if rs is not null then fw := public._rs_w(rsh); end if;
  gpv := case when pick in ('guppy', 'guppy_albino') then public._gpy_wild() end;
  insert into public.casts (uid, spot, fish, w, rs, sex, brood, gp, at, shown_at) values (pl.id, p_spot, pick, fw, rs, sx, brood, gpv, now(), null)
  on conflict (uid) do update set spot = excluded.spot, fish = excluded.fish, w = excluded.w, rs = excluded.rs, sex = excluded.sex, brood = excluded.brood, gp = excluded.gp, at = excluded.at, shown_at = null;
  update public.players set cast_fish = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null, cast_gp = null, cast_at = now(), bait = pl.bait, bait_on = pl.bait_on, buff_left = pl.buff_left, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 用掉魚餌：跟原本一樣，打窩的時候另外記下來（「現在打」的窩點用這個確認）
create or replace function public.use_bait(p_bait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer;
begin
  n := coalesce((pl.bait ->> p_bait)::int, 0);
  if n <= 0 then return pl; end if;
  update public.players set
    bait = case when n - 1 <= 0 then bait - p_bait else jsonb_set(bait, array[p_bait], to_jsonb(n - 1)) end,
    bait_on = case when n - 1 <= 0 and bait_on = p_bait then null else bait_on end,
    chum_type = case when p_bait like 'chum_%' then p_bait else chum_type end,
    chum_at   = case when p_bait like 'chum_%' then now() else chum_at end,
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 吃料理：記下加成（伺服器抽魚的時候用）
create or replace function public.eat_dish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d jsonb; cfg jsonb := public._fishcfg();
begin
  select e into d from jsonb_array_elements(pl.dishes) e where (e->>'t')::bigint = p_ts limit 1;
  if d is null then return pl; end if;
  update public.players set
    dishes = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    buff_r = case when cfg->'buffs' ? (d->>'r') then d->>'r' else buff_r end,
    buff_left = case when cfg->'buffs' ? (d->>'r') then (cfg->'buffs'->(d->>'r')->>'casts')::integer + (least(3, greatest(1, coalesce((d->>'q')::integer, 1))) - 1) * 2 else buff_left end,
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 釣到魚：一定要是 roll_fish 抽到的那條魚和重量（其他跟 017 一樣）
create or replace function public.record_catch(p_fish text, p_weight numeric) returns public.players language plpgsql security definer set search_path = public as $$
declare
  pl public.players := public._me();
  sp public.fish_species;
  w  numeric := round(p_weight, 2);
  ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  c  record;
  tid bigint := public._tourney_at(now()); v_spot text;
begin
  select * into sp from public.fish_species where id = p_fish;
  if not found then raise exception '沒有這種魚'; end if;
  select cs.fish, cs.w, cs.rs, cs.sex, cs.brood, cs.gp, cs.spot into pl.cast_fish, pl.cast_w, pl.cast_rs, pl.cast_sex, pl.cast_brood, pl.cast_gp, v_spot from public.casts cs where cs.uid = pl.id;   -- 這一竿的結果（不公開的表）
  if pl.cast_fish is null or pl.cast_fish <> p_fish or pl.cast_w is distinct from w then raise exception '這條魚對不上伺服器，請重新整理遊戲'; end if;
  if now() - pl.cast_at < interval '1.5 seconds' then raise exception '釣太快了'; end if;
  if now() - pl.cast_at > interval '20 minutes' then raise exception '這條魚對不上伺服器，請重新整理遊戲'; end if;
  if pl.last_catch_at is not null and now() - pl.last_catch_at < interval '3 seconds' then raise exception '釣太快了'; end if;
  if p_fish in ('bluelobster') then perform public._sev_claim(pl.id, pl.nickname, p_fish, w); end if;   -- 放生活動的蝦只有一隻（027）
  if p_fish in ('shark_red', 'shark_red_albino') then perform public._rs_claim(pl.id, pl.nickname, pl.cast_rs, w); end if;   -- 赤紅霸王鯊（032）
  select * into c from public.current_contest();
  update public.players set
    total      = total + 1,
    legend     = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
    fish_count = jsonb_set(fish_count, array[p_fish], to_jsonb(coalesce((fish_count ->> p_fish)::int, 0) + 1)),
    fish_best  = case when coalesce((fish_best ->> p_fish)::numeric, 0) < w then jsonb_set(fish_best, array[p_fish], to_jsonb(w)) else fish_best end,
    best_fish  = case when w > best_w then p_fish else best_fish end,
    best_w     = greatest(best_w, w),
    tank       = public._trim_tank(jsonb_build_array(jsonb_build_object('f', p_fish, 'w', w, 't', ts) || case when (public._fishcfg()->'fish'->p_fish) ? 'v' or p_fish ~ '^nx[0-9]{6}v$' then jsonb_build_object('k', true) else '{}'::jsonb end || case when pl.cast_sex in ('M', 'F') then jsonb_build_object('s', pl.cast_sex) else '{}'::jsonb end || case when pl.cast_brood then jsonb_build_object('b', true) else '{}'::jsonb end || case when pl.cast_gp is not null then jsonb_build_object('gp', pl.cast_gp) else '{}'::jsonb end || case when p_fish in ('shark_red', 'shark_red_albino') then jsonb_build_object('rs', pl.cast_rs) else '{}'::jsonb end) || tank, show),
    week_best_w = case when p_fish <> c.fish then (case when week_id = c.week_id then week_best_w else 0 end)
                       when week_id = c.week_id then greatest(week_best_w, w) else w end,
    week_id    = case when p_fish = c.fish or week_id = c.week_id then c.week_id else week_id end,
    tourney_w  = case when tid is null then tourney_w when tourney_id = tid then tourney_w + w else w end,
    tourney_n  = case when tid is null then tourney_n when tourney_id = tid then tourney_n + 1 else 1 end,
    tourney_id = coalesce(tid, tourney_id),
    cast_fish  = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null, cast_gp = null, last_fish = p_fish, last_w = w,
    last_catch_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  delete from public.casts where uid = pl.id;
  begin perform public._ev_on_catch(pl.id, v_spot, p_fish, w); select * into pl from public.players where id = pl.id; exception when undefined_function then null; end;   -- 111 洄游、懸賞的獎勵
  return pl;
end $$;

-- 魚游過來咬餌之前大約 2 秒，手機才拿到這一竿是什麼魚（畫游過來、咬餌的動畫）；拋竿 2 秒內問不到（泥灘用手抓的不用等）
create or replace function public.hook_fish() returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.casts;
begin
  select * into c from public.casts where uid = auth.uid() for update;
  if c.uid is null then raise exception '還沒有拋竿'; end if;
  if now() - c.at > interval '20 minutes' then raise exception '這條魚對不上伺服器，請重新整理遊戲'; end if;
  if c.spot is distinct from 'mudflat' and now() - c.at < interval '1.9 seconds' then raise exception '魚還沒游過來'; end if;
  update public.casts set shown_at = coalesce(shown_at, now()) where uid = c.uid;
  return jsonb_build_object('cast_fish', c.fish, 'cast_w', c.w, 'cast_rs', c.rs, 'cast_sex', c.sex, 'cast_brood', c.brood, 'cast_gp', c.gp);
end $$;

do $$ declare f text; begin
  foreach f in array array['roll_fish(text,numeric,numeric,numeric,text,text,text,text,boolean,numeric,numeric,bigint)', 'use_bait(text)', 'eat_dish(bigint)', 'record_catch(text,numeric)', 'hook_fish()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '公平釣魚設定完成 🎣' as result;
