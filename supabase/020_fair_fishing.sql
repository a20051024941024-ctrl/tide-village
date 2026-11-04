-- 潮汐釣魚村：公平釣魚（伺服器決定上鉤的是什麼魚）（可以重複執行）
-- ⚠️ 這份是 tools/gen_fair_sql.py 自動產生的，不要直接改；要改請改 tools/fair_fishing.sql.tpl 或 tools/fishcfg.json
-- 流程：拋竿時遊戲呼叫 roll_fish()，伺服器用跟遊戲一樣的機率抽一條魚（釣竿、魚餌、料理、窩料、天氣、潮汐、季節、時段、今日情報、釣法、釣線），
--       記在 cast_fish／cast_w；拉上來時 record_catch() 一定要是這條魚、這個重量才算數。
alter table public.players add column if not exists cast_fish  text;
alter table public.players add column if not exists cast_w     numeric(10,2);
alter table public.players add column if not exists cast_at    timestamptz;
alter table public.players add column if not exists buff_r     text;
alter table public.players add column if not exists buff_left  integer not null default 0;
alter table public.players add column if not exists chum_type  text;
alter table public.players add column if not exists chum_at    timestamptz;
alter table public.players add column if not exists shrimp_until timestamptz;   -- 釣蝦場買的時段到什麼時候（025）
create index if not exists players_chum_idx on public.players (chum_type, chum_at desc);

create or replace function public._fishcfg() returns jsonb language sql immutable as $cfg$ select '{"spots":{"river":{"x":-20.4,"z":-17.6,"fish":["perch","crucian","catfish","koi","tilapia","eel","snakehead","zacco","acro","pseudorasbora"],"lb":1},"lake":{"x":-21.8,"z":-2,"fish":["crucian","perch","koi","carp","bass","goldfish","sturgeon","arowana","bighead"],"lb":1.4},"pool":{"x":-26.2,"z":5.4,"fish":["ayu","kuhua","goby","trout","loach","salmon","hillstream","candidia"],"lb":1},"sea":{"x":0,"z":-50.8,"fish":["mackerel","scorpion","moonbream","puffer","squid","bonito","cuttle","jelly","flounder","grouper","crab","tilefish","stingray","milkfish","mullet"],"lb":1},"isle":{"x":150,"z":29.4,"fish":["clown","parrot","puffer","squid","sunfish","tuna","cuttle","octopus","seahorse","lionfish","turtle","lobster","butterfly","trevally","sergeant","rabbitfish","bluetang","moonwrasse"],"lb":1},"harbor":{"x":33.2,"z":-27,"fish":["mackerel","moonbream","manta","sunfish","dolphin","beluga","marlin","shark","orca","whaleshark","whale","sperm","tuna","octopus","ika","giantsquid","barracuda","hammer","oarfish","kingcrab","mahi","angler","saury","horsemack","hairtail","sardine","flyingfish","yellowtail","pomfret","grunt","roundscad","anchovy","filefish","threadfin"],"lb":1},"shrimp":{"x":-118,"z":40.75,"fish":["prawn","whiteshrimp","tigerprawn","crayfish","blueclaw","goldprawn"],"lb":1},"creek":{"x":20.8,"z":27.4,"fish":["kuhua","goby","trout","lantern","shrimp","medaka","candidia"],"lb":1.8}},"tipSpots":["river","lake","pool","sea","harbor","shrimp","creek"],"fish":{"perch":{"r":"常見","w":1,"t":null,"min":0.4,"max":1.6},"crucian":{"r":"常見","w":1,"t":null,"min":0.2,"max":0.9},"catfish":{"r":"稀有","w":1,"t":"night","min":1.5,"max":5.5},"koi":{"r":"傳說","w":1,"t":"twilight","min":2.5,"max":7},"mackerel":{"r":"常見","w":1,"t":"day","min":0.3,"max":1.2},"scorpion":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.4},"moonbream":{"r":"稀有","w":1,"t":"night","min":1,"max":3.8},"marlin":{"r":"傳說","w":1,"t":null,"min":8,"max":24},"manta":{"r":"稀有","w":0.35,"t":null,"min":12,"max":45},"dolphin":{"r":"稀有","w":0.35,"t":null,"min":40,"max":150},"shark":{"r":"傳說","w":0.6,"t":null,"min":60,"max":250},"orca":{"r":"傳說","w":0.3,"t":null,"min":1200,"max":5500},"beluga":{"r":"稀有","w":0.25,"t":null,"min":400,"max":1500},"sunfish":{"r":"稀有","w":0.3,"t":"day","min":60,"max":900},"sperm":{"r":"傳說","w":0.18,"t":"night","min":3000,"max":15000},"whaleshark":{"r":"傳說","w":0.22,"t":"day","min":2000,"max":12000},"whale":{"r":"傳說","w":0.25,"t":null,"min":900,"max":3000},"kuhua":{"r":"常見","w":1,"t":null,"min":0.2,"max":0.8},"ayu":{"r":"常見","w":1,"t":"twilight","min":0.1,"max":0.6},"goby":{"r":"稀有","w":1,"t":"night","min":0.1,"max":0.5},"trout":{"r":"傳說","w":1,"t":"night","min":1.2,"max":4.5},"tilapia":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.5},"eel":{"r":"稀有","w":1,"t":"night","min":0.5,"max":3},"carp":{"r":"稀有","w":1,"t":null,"min":1.5,"max":8},"loach":{"r":"常見","w":1,"t":"twilight","min":0.05,"max":0.3},"puffer":{"r":"稀有","w":1,"t":null,"min":0.3,"max":2},"squid":{"r":"常見","w":1,"t":"night","min":0.1,"max":0.6},"bonito":{"r":"常見","w":1,"t":"day","min":0.8,"max":3},"tuna":{"r":"傳說","w":0.5,"t":null,"min":80,"max":450},"lantern":{"r":"稀有","w":1,"t":"night","min":0.2,"max":0.9},"clown":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.25},"parrot":{"r":"稀有","w":1,"t":"day","min":0.8,"max":4},"cuttle":{"r":"稀有","w":1,"t":null,"min":0.5,"max":3},"octopus":{"r":"稀有","w":1,"t":"night","min":2,"max":15},"ika":{"r":"常見","w":1,"t":"night","min":0.6,"max":4},"giantsquid":{"r":"傳說","w":0.25,"t":"night","min":120,"max":500},"snakehead":{"r":"稀有","w":1,"t":null,"min":1,"max":5},"bass":{"r":"常見","w":1,"t":null,"min":0.4,"max":2.5},"goldfish":{"r":"常見","w":1,"t":"day","min":0.05,"max":0.3},"sturgeon":{"r":"傳說","w":0.5,"t":"night","min":20,"max":90},"salmon":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.6},"jelly":{"r":"稀有","w":1,"t":"night","min":0.2,"max":2},"flounder":{"r":"常見","w":1,"t":null,"min":0.3,"max":2},"grouper":{"r":"傳說","w":0.55,"t":null,"min":15,"max":60},"barracuda":{"r":"稀有","w":1,"t":"day","min":2,"max":12},"hammer":{"r":"傳說","w":0.4,"t":null,"min":80,"max":300},"oarfish":{"r":"傳說","w":0.3,"t":"night","min":30,"max":150},"seahorse":{"r":"稀有","w":1,"t":null,"min":0.02,"max":0.1},"lionfish":{"r":"稀有","w":1,"t":null,"min":0.3,"max":1.3},"turtle":{"r":"傳說","w":0.5,"t":"day","min":40,"max":180},"crab":{"r":"常見","w":1,"t":null,"min":0.1,"max":0.8},"kingcrab":{"r":"稀有","w":1,"t":"night","min":2,"max":8},"lobster":{"r":"稀有","w":1,"t":"night","min":0.5,"max":4},"shrimp":{"r":"常見","w":1,"t":null,"min":0.01,"max":0.05},"arowana":{"r":"傳說","w":1,"t":null,"min":3,"max":12},"tilefish":{"r":"常見","w":1,"t":"day","min":0.3,"max":1.8},"mahi":{"r":"常見","w":1,"t":"day","min":3,"max":15},"butterfly":{"r":"常見","w":1,"t":"day","min":0.05,"max":0.3},"angler":{"r":"傳說","w":0.45,"t":"night","min":10,"max":50},"stingray":{"r":"稀有","w":1,"t":null,"min":2,"max":20},"trevally":{"r":"稀有","w":1,"t":null,"min":5,"max":40},"saury":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.3},"horsemack":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.6},"hairtail":{"r":"常見","w":1,"t":"night","min":0.5,"max":3},"sardine":{"r":"常見","w":1.4,"t":null,"min":0.05,"max":0.15},"flyingfish":{"r":"常見","w":1,"t":"day","min":0.2,"max":0.5},"yellowtail":{"r":"常見","w":1,"t":null,"min":1,"max":8},"milkfish":{"r":"常見","w":1,"t":null,"min":0.3,"max":1.5},"mullet":{"r":"常見","w":1,"t":null,"min":0.5,"max":2.5},"zacco":{"r":"常見","w":1,"t":null,"min":0.03,"max":0.12},"bighead":{"r":"常見","w":1,"t":null,"min":1,"max":10},"pomfret":{"r":"常見","w":1.3,"t":null,"min":0.2,"max":0.8},"grunt":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.6},"roundscad":{"r":"常見","w":1.4,"t":null,"min":0.08,"max":0.3},"anchovy":{"r":"常見","w":1.4,"t":null,"min":0.01,"max":0.03},"filefish":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.5},"threadfin":{"r":"常見","w":1.2,"t":null,"min":0.15,"max":0.5},"sergeant":{"r":"常見","w":1.4,"t":null,"min":0.05,"max":0.2},"rabbitfish":{"r":"常見","w":1.3,"t":null,"min":0.15,"max":0.6},"bluetang":{"r":"常見","w":1.2,"t":null,"min":0.1,"max":0.4},"moonwrasse":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.35},"acro":{"r":"常見","w":1.3,"t":null,"min":0.1,"max":0.5},"pseudorasbora":{"r":"常見","w":1.4,"t":null,"min":0.01,"max":0.03},"hillstream":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.03},"candidia":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.05},"medaka":{"r":"常見","w":1.3,"t":null,"min":0.01,"max":0.02},"prawn":{"r":"常見","w":1.6,"t":null,"min":0.06,"max":0.22},"whiteshrimp":{"r":"常見","w":1,"t":null,"min":0.03,"max":0.09},"tigerprawn":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.18},"crayfish":{"r":"常見","w":1,"t":null,"min":0.05,"max":0.14},"blueclaw":{"r":"稀有","w":1,"t":null,"min":0.15,"max":0.38},"goldprawn":{"r":"傳說","w":1,"t":null,"min":0.35,"max":0.65},"bluelobster":{"r":"傳說","w":1,"t":null,"min":0.4,"max":1.2}},"sea":["sea","harbor","isle"],"rain":["catfish","eel","snakehead","tilapia","bass","loach"],"lure":["yellowtail","hairtail","cod","toothfish","bass","snakehead","mackerel","bonito","barracuda","mahi","tuna","trevally","marlin","perch","trout","salmon","arowana","shark","hammer","squid","ika"],"bottom":["cod","toothfish","crayfish","prawn","tigerprawn","catfish","eel","flounder","scorpion","crab","kingcrab","lobster","stingray","grouper","sturgeon","loach","goby","octopus","angler","cuttle","shrimp","crucian","carp"],"seasons":{"spring":["ayu","salmon","shrimp","squid","carp","flounder"],"summer":["mahi","bonito","parrot","butterfly","jelly","sunfish"],"autumn":["mackerel","crab","cuttle","barracuda","catfish","eel"],"winter":["tilefish","kingcrab","ika","angler","crucian","grouper"]},"weathers":[{"k":"sunny","w":45,"bite":1,"rare":1,"legend":1,"legendSea":false},{"k":"cloudy","w":25,"bite":1,"rare":1.05,"legend":1,"legendSea":false},{"k":"rain","w":15,"bite":0.8,"rare":1.15,"legend":1,"legendSea":false},{"k":"fog","w":8,"bite":1,"rare":1.25,"legend":1,"legendSea":false},{"k":"storm","w":7,"bite":0.9,"rare":1.2,"legend":1.6,"legendSea":true}],"tide":{"rising":{"bite":0.78,"rare":1.15},"high":{"bite":0.9,"rare":1.05},"falling":{"bite":1,"rare":1},"low":{"bite":1.25,"rare":0.9}},"legK":{"harbor":4,"other":0.75},"rods":{"bamboo":{"rare":1,"legend":1},"carbon":{"rare":1.2,"legend":1.1},"lure":{"rare":1.25,"legend":1.15},"deep":{"rare":1.3,"legend":1.4},"moon":{"rare":1.5,"legend":1.5},"king":{"rare":1.45,"legend":1.9}},"baits":{"worm":{"rare":1.25,"legend":1},"glow":{"rare":1.8,"legend":1.2},"squidbait":{"rare":1.4,"legend":1.8},"gold":{"rare":1.3,"legend":3},"rainbow":{"rare":2.2,"legend":4}},"chums":{"chum_rice":{"rare":1.15,"legend":1,"dur":120,"fresh":true,"sea":false},"chum_krill":{"rare":1.35,"legend":1.15,"dur":150,"fresh":false,"sea":true},"chum_gold":{"rare":1.5,"legend":1.8,"dur":180,"fresh":false,"sea":false}},"buffs":{"saba":{"rare":1.3,"legend":1,"casts":5},"tai":{"rare":1,"legend":1.5,"casts":5},"ayu":{"rare":1,"legend":1,"casts":5},"suzuki":{"rare":1,"legend":1,"casts":5},"mori":{"rare":1.2,"legend":1.2,"casts":10},"tako":{"rare":1,"legend":1.3,"casts":6},"ikayaki":{"rare":1.4,"legend":1,"casts":5},"sumi":{"rare":1,"legend":1,"casts":5},"sanbei":{"rare":1,"legend":1,"casts":4},"toro":{"rare":1.3,"legend":1.6,"casts":8},"unadon":{"rare":1,"legend":1,"casts":6},"fugu":{"rare":1,"legend":1.4,"casts":6},"tilapia":{"rare":1.15,"legend":1,"casts":6},"ebi":{"rare":1.25,"legend":1,"casts":6}},"lines":{"thin":{"rare":1},"normal":{"rare":1},"thick":{"rare":0.92}},"secretGrow":600000,"secretLife":3600000,"dayLen":2160,"wxBlock":540000,"tidePeriod":1080000}'::jsonb $cfg$;

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
create or replace function public.roll_fish(p_spot text, p_charge numeric, p_x numeric, p_z numeric, p_rig text, p_line text, p_bait text, p_chum text, p_boat boolean)
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
  season text; mo integer; kr numeric; kl numeric; nleg integer; legk numeric; rainy boolean;
  fid text; f jsonb; wt numeric; tot numeric := 0; ids text[] := '{}'; wts numeric[] := '{}'; pick text; r numeric; i integer;
  c jsonb; ctype text; cat timestamptz; left_k numeric; fit numeric; k numeric; sc jsonb; age numeric; pw numeric; nb integer; fw numeric;
begin
  if sp is null then raise exception '沒有這個釣點'; end if;
  if pl.cast_at is not null and now() - pl.cast_at < interval '2.5 seconds' then raise exception '拋太快了'; end if;
  if p_spot = 'shrimp' and coalesce(pl.shrimp_until, '-infinity') < now() then raise exception '要先買釣蝦時段'; end if;
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
    select e into sc from public.secret_chum s, jsonb_array_elements(s.spots) e where s.owner = pl.id and e->>'id' = substr(p_chum, 8) limit 1;
    if sc is not null and cfg->'chums' ? (sc->>'type') then
      c := cfg->'chums'->(sc->>'type'); age := ms - (sc->>'at')::bigint;
      if age >= 0 and age <= (cfg->>'secretLife')::numeric then
        pw := least(1, greatest(0.15, 0.15 + 0.85 * age / (cfg->>'secretGrow')::numeric));
        fit := case when (c->>'fresh')::boolean then (case when sea then 0.45 else 1 end) when (c->>'sea')::boolean then (case when sea then 1 else 0.5 end) else 1 end;
        k := pw * fit; cb_r := 1 + ((c->>'rare')::numeric * 1.25 - 1) * k; cb_l := 1 + ((c->>'legend')::numeric * 1.35 - 1) * k;
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
  pool := array(select x from jsonb_array_elements_text(cfg->'spots'->tip_spot->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' order by n);
  tip_fish := pool[1 + ((hh / 256) % cardinality(pool))::integer];
  -- 季節
  mo := extract(month from now() at time zone 'Asia/Taipei');
  season := case when mo between 3 and 5 then 'spring' when mo between 6 and 8 then 'summer' when mo between 9 and 11 then 'autumn' else 'winter' end;
  kr := (rod->>'rare')::numeric * coalesce((bait->>'rare')::numeric, 1) * coalesce((bf->>'rare')::numeric, 1) * cb_r * (w->>'rare')::numeric * tr * (ln->>'rare')::numeric;
  kl := (rod->>'legend')::numeric * coalesce((bait->>'legend')::numeric, 1) * coalesce((bf->>'legend')::numeric, 1) * cb_l
        * (case when (w->>'legendSea')::boolean then (case when sea then (w->>'legend')::numeric else 1 end) else (w->>'legend')::numeric end);
  select count(*) into nleg from jsonb_array_elements_text(sp->'fish') x where cfg->'fish'->x->>'r' = '傳說';
  legk := (case when p_spot = 'harbor' then (cfg->'legK'->>'harbor')::numeric else (cfg->'legK'->>'other')::numeric end) / greatest(1, nleg);
  for fid in select x from jsonb_array_elements_text(sp->'fish') with ordinality t(x, n) order by n loop
    f := cfg->'fish'->fid; if f is null then continue; end if;
    wt := (f->>'w')::numeric
      * (case when rig = 'lure' then (case when cfg->'lure' ? fid then 2.2 else 0.55 end) when rig = 'bottom' then (case when cfg->'bottom' ? fid then 2.2 else 0.65 end) else 1 end)
      * (case when tip_spot = p_spot and tip_fish = fid then 2.5 else 1 end)
      * (case when rainy and cfg->'rain' ? fid then 2 else 1 end)
      * (case when cfg->'seasons'->season ? fid and f->>'r' <> '傳說' then 2 else 1 end)
      * (case when f->>'t' is null then 1 when f->>'t' = per then 1.5 else 0.15 end)
      * (case f->>'r' when '常見' then 1 when '稀有' then 0.34 * (1 + charge * 0.8) * kr * ring else 0.07 * (1 + charge * 1.6) * lb * kl * ring * legk end);
    ids := ids || fid; wts := wts || wt; tot := tot + wt;
  end loop;
  if cardinality(ids) = 0 then raise exception '沒有這個釣點'; end if;
  r := random() * tot; pick := ids[1];
  for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
  -- 釣蝦場老闆的放生活動（027）：極小的機會碰到全伺服器只有一隻的特別蝦
  if p_spot = 'shrimp' then fid := public._sev_try(pl.id); if fid is not null and cfg->'fish' ? fid then pick := fid; end if; end if;
  f := cfg->'fish'->pick;
  fw := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  update public.players set cast_fish = pick, cast_w = fw, cast_at = now(), bait = pl.bait, bait_on = pl.bait_on, buff_left = pl.buff_left, updated_at = now()
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
  tid bigint := public._tourney_at(now());
begin
  select * into sp from public.fish_species where id = p_fish;
  if not found then raise exception '沒有這種魚'; end if;
  if pl.cast_fish is null or pl.cast_fish <> p_fish or pl.cast_w is distinct from w then raise exception '這條魚對不上伺服器，請重新整理遊戲'; end if;
  if now() - pl.cast_at < interval '1.5 seconds' then raise exception '釣太快了'; end if;
  if now() - pl.cast_at > interval '20 minutes' then raise exception '這條魚對不上伺服器，請重新整理遊戲'; end if;
  if pl.last_catch_at is not null and now() - pl.last_catch_at < interval '3 seconds' then raise exception '釣太快了'; end if;
  if p_fish in ('bluelobster') then perform public._sev_claim(pl.id, pl.nickname, p_fish, w); end if;   -- 放生活動的蝦只有一隻（027）
  select * into c from public.current_contest();
  update public.players set
    total      = total + 1,
    legend     = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
    fish_count = jsonb_set(fish_count, array[p_fish], to_jsonb(coalesce((fish_count ->> p_fish)::int, 0) + 1)),
    fish_best  = case when coalesce((fish_best ->> p_fish)::numeric, 0) < w then jsonb_set(fish_best, array[p_fish], to_jsonb(w)) else fish_best end,
    best_fish  = case when w > best_w then p_fish else best_fish end,
    best_w     = greatest(best_w, w),
    tank       = public._trim_tank(jsonb_build_array(jsonb_build_object('f', p_fish, 'w', w, 't', ts)) || tank, show),
    week_best_w = case when p_fish <> c.fish then (case when week_id = c.week_id then week_best_w else 0 end)
                       when week_id = c.week_id then greatest(week_best_w, w) else w end,
    week_id    = case when p_fish = c.fish or week_id = c.week_id then c.week_id else week_id end,
    tourney_w  = case when tid is null then tourney_w when tourney_id = tid then tourney_w + w else w end,
    tourney_n  = case when tid is null then tourney_n when tourney_id = tid then tourney_n + 1 else 1 end,
    tourney_id = coalesce(tid, tourney_id),
    cast_fish  = null, cast_w = null,
    last_catch_at = now(), updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['roll_fish(text,numeric,numeric,numeric,text,text,text,text,boolean)', 'use_bait(text)', 'eat_dish(bigint)', 'record_catch(text,numeric)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '公平釣魚設定完成 🎣' as result;
