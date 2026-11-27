-- 260 運河（百年生態池）和石滬的魚搬到新主島（換島清單第 5 項）
-- 河：琵琶鼠魚、革胡子鯰、泰國鱧（含變種）、鱷雀鱔；紅樹林：攀鱸、食蚊魚（含金色）；溪：白子孔雀魚；珊瑚礁：蘇眉魚。
-- 舊的地方也還釣得到（只是去不了了）。可以重複跑。要先貼過 258。
create or replace function public._fishcfg() returns jsonb language sql immutable as $f$
  select jsonb_set(b, '{spots}', (select jsonb_object_agg(k, case when p ? k then v || (p -> k) else v end) from jsonb_each(b -> 'spots') e(k, v)))
  from (select public._fishcfg_base() as b, '{
  "harbor":{"x2": 5, "z2": 1592.6, "dx2": 0, "dz2": 1},
  "sea":{"x2": 88.5, "z2": 1558.66, "dx2": 0, "dz2": 1},
  "river":{"x2": -62.31, "z2": 1458, "dx2": 0, "dz2": 1, "fish": ["perch", "crucian", "catfish", "koi", "tilapia", "eel", "snakehead", "zacco", "acro", "pseudorasbora", "koi_sanke", "koi_showa", "koi_ogon", "catfish_albino", "tilapia_red", "grasscarp", "yellowcheek", "pleco", "pleco_albino", "clarias", "clarias_albino", "giantsnake", "giantsnake_red", "alligatorgar"]},
  "creek":{"x2": -38.31, "z2": 1452.73, "dx2": -0.50001, "dz2": -0.86602, "fish": ["kuhua", "goby", "trout", "lantern", "shrimp", "medaka", "candidia", "guppy", "trout_golden", "creekcrab", "guppy_albino"]},
  "lake":{"x2": -13.5, "z2": 1449.05, "dx2": -1e-05, "dz2": -1},
  "mangrove":{"x2": -106.21, "z2": 1477.47, "dx2": -1e-05, "dz2": -1, "fish": ["mullet", "milkfish", "scat", "terapon", "blackbream", "mudcrab", "mangsnapper", "barramundi", "bullshark", "sawfish", "scat_red", "horseshoe", "climbperch", "mosquitofish", "mosquitofish_gold"]},
  "reef":{"x2": 132.32, "z2": 1558.07, "dx2": 0, "dz2": 1, "fish": ["rabbitfish", "girella", "blackgirella", "lethrinus", "amberjack", "parrot", "butterfly", "sergeant", "lionfish", "octopus", "trevally", "grouper", "rabbitfish_gold", "girella_gold", "blackgirella_albino", "lethrinus_red", "amberjack_gold", "snowmoray", "snowmoray_gold", "groupie", "nurseshark", "nurseshark_xanthic", "napoleon"]}
  }'::jsonb as p) s
$f$;
