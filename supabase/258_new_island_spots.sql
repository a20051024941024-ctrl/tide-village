-- 258 新主島的好釣點（短版：手機貼上不會被切掉）
-- 做什麼：伺服器認得新主島上的光圈和魚訊位置（舊村子的也照樣算）。
-- 可以重複跑。貼到 Supabase 的 SQL 頁面按 Run。

-- 1. 原本的釣點設定改名留著，外面包一層，加上新主島的位置（x2、z2）
do $do$ begin
  if to_regprocedure('public._fishcfg_base()') is null then
    alter function public._fishcfg() rename to _fishcfg_base;
  end if;
end $do$;

create or replace function public._fishcfg() returns jsonb language sql immutable as $f$
  select jsonb_set(b, '{spots}', (select jsonb_object_agg(k, case when p ? k then v || (p -> k) else v end) from jsonb_each(b -> 'spots') e(k, v)))
  from (select public._fishcfg_base() as b, '{
  "river":{"x2": -62.31, "z2": 1458, "dx2": 0, "dz2": 1},
  "lake":{"x2": -13.5, "z2": 1449.05, "dx2": -1e-05, "dz2": -1},
  "sea":{"x2": 88.5, "z2": 1558.66, "dx2": 0, "dz2": 1},
  "harbor":{"x2": 5, "z2": 1592.6, "dx2": 0, "dz2": 1},
  "mangrove":{"x2": -106.21, "z2": 1477.47, "dx2": -1e-05, "dz2": -1},
  "reef":{"x2": 132.32, "z2": 1558.07, "dx2": 0, "dz2": 1},
  "creek":{"x2": -38.31, "z2": 1452.73, "dx2": -0.50001, "dz2": -0.86602}
  }'::jsonb as p) s
$f$;

-- 2. 魚訊、光圈：浮標或人離哪一個位置近就用哪一個
create or replace function public._sign_hit(p_spot text, p_bx numeric, p_bz numeric, p_sl bigint, p_bk text default null) returns text language plpgsql stable set search_path = public as $$
declare cfg jsonb := public._fishcfg(); sp jsonb := cfg->'spots'->p_spot; kinds text[]; sc integer := 0; slot bigint; o integer; base bigint; n integer; i integer; b bigint;
  k text; d float8; a float8; acc float8[] := '{}'; j integer; ok boolean; scared boolean := false; sx float8; sz float8; dx float8; dz float8; gx float8; gz float8; dist float8; best float8 := 99; bk text := null;
begin
  if sp is null or sp->>'dx' is null or p_bx is null or p_bz is null or p_spot in ('shrimp', 'icelake', 'mudflat') then return null; end if;
  sx := (sp->>'x')::float8; sz := (sp->>'z')::float8; dx := (sp->>'dx')::float8; dz := (sp->>'dz')::float8;
  -- 258：新主島上同一個釣點的第二個位置（x2、z2）：浮標離哪一個近就用哪一個（舊村子、新主島兩邊的魚訊都算）
  if sp->>'x2' is not null and sqrt(power(p_bx::float8 - (sp->>'x2')::float8, 2) + power(p_bz::float8 - (sp->>'z2')::float8, 2)) < sqrt(power(p_bx::float8 - sx, 2) + power(p_bz::float8 - sz, 2)) then
    sx := (sp->>'x2')::float8; sz := (sp->>'z2')::float8; dx := (sp->>'dx2')::float8; dz := (sp->>'dz2')::float8; end if;
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
  bait jsonb; bf jsonb; cb_r numeric := 1; cb_l numeric := 1; w jsonb; tide_st text; tr numeric := 1; rum_f text; cor_k integer := 0;
  sea boolean := p_spot = any(array(select jsonb_array_elements_text(cfg->'sea')));
  ring numeric := 1; lb numeric := 1; per text; gh numeric; tip_spot text; tip_fish text; hh bigint; pool text[];
  ipool text[]; ih bigint; intel text[] := '{}'; sc_mine boolean := false; evm jsonb;
  eco jsonb := '{}';   -- 海洋生態（066）：魚群洄游、群聚、保育
  season text; mo integer; kr numeric; kl numeric; nleg integer; legk numeric; rainy boolean;
  fid text; f jsonb; wt numeric; tot numeric := 0; ids text[] := '{}'; wts numeric[] := '{}'; pick text; r numeric; i integer;
  rsh public.red_sharks; rs text; gpv text; fitk numeric := 1; sx text; brood boolean := false; wild boolean := false;
  crowd integer := 0; ch_own uuid; ch_sid text;   -- 204：熱窩（窩裡一起釣的人數、窩主、哪一個祕密窩點）
  c jsonb; ctype text; cat timestamptz; left_k numeric; fit numeric; k numeric; sc jsonb; age numeric; pw numeric; nb integer; fw numeric;
  sf record;   -- 蔚博士的新品種（070）
  sg_k text;   -- 247：浮標落在哪一種徵兆旁邊
  popm jsonb := '{}'; pp numeric; evo boolean := false;   -- v586 全服共養的魚種族群（199_fish_pop）
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
      if age >= 0 and age <= (cfg->>'secretLife')::numeric + coalesce((sc->>'ext')::numeric, 0) then   -- 204：有人在窩裡釣到魚，窩點會延長（ext）
        pw := least(1, greatest(0.15, 0.15 + 0.85 * age / (cfg->>'secretGrow')::numeric));
        fit := case when (c->>'fresh')::boolean then (case when sea then 0.45 else 1 end) when (c->>'sea')::boolean then (case when sea then 1 else 0.5 end) else 1 end;
        k := pw * fit * (case when sc_mine then 1 else 0.75 end); cb_r := 1 + ((c->>'rare')::numeric * 1.25 - 1) * k; cb_l := 1 + ((c->>'legend')::numeric * 1.35 - 1) * k;
      end if;
    end if;
  end if;
  -- 204 熱窩：這一竿有窩料加成的話，12 公尺內最近 90 秒也在窩裡拋竿的其他玩家每多一個，稀有 +10%、傳說 +12%（最多算 3 個）；記下窩主，釣到魚時給窩主謝禮
  if cb_r > 1 or cb_l > 1 then
    begin
      crowd := public._chum_crowd(pl.id, p_x, p_z); cb_r := cb_r * (1 + 0.10 * crowd); cb_l := cb_l * (1 + 0.12 * crowd);
      ch_own := public._chum_owner(p_chum, pl.id, p_x, p_z); if p_chum like 'secret:%' then ch_sid := substr(p_chum, 8); end if;
    exception when undefined_function then crowd := 0; end;
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
  if not coalesce(p_boat, false) and p_x is not null and p_z is not null and (sqrt(power(p_x - (sp->>'x')::numeric, 2) + power(p_z - (sp->>'z')::numeric, 2)) < 2.2
      or (sp->>'x2' is not null and sqrt(power(p_x - (sp->>'x2')::numeric, 2) + power(p_z - (sp->>'z2')::numeric, 2)) < 2.2)) then   -- 258：新主島的光圈也算
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
  -- v637 釣具改版第三次：專用竿的等級（208 rod_lv）：稀有 1／1.1／1.2／1.35／1.5、傳說 1／1／1.1／1.25／1.4（跟 js/game.js 的 rodLvK 一樣）
  --   傳說的等級加成只在「對的地方」才有（手竿、遠投、磯釣 = 對的釣點；路亞軟竿 = 用路亞釣法），不然 5 級竿到哪裡都贏王者竿
  --   路亞軟竿用路亞釣法時稀有 ×1.15、沒用 ×0.85（跟其他專用竿在對／錯的釣點一樣）
  if pl.rod = 'r_lure' and p_spot not in ('shrimp', 'mudflat') then kr := kr * (case when rig = 'lure' then 1.15 else 0.85 end); end if;
  if pl.rod in ('r_lure', 'r_iso', 'r_surf', 'r_pole') then
    kr := kr * (array[1, 1.1, 1.2, 1.35, 1.5])[least(5, greatest(1, coalesce((pl.rod_lv->>pl.rod)::int, 1)))];
    if (pl.rod = 'r_lure' and rig = 'lure') or (pl.rod <> 'r_lure' and fitk > 1) then
      kl := kl * (array[1, 1, 1.1, 1.25, 1.4])[least(5, greatest(1, coalesce((pl.rod_lv->>pl.rod)::int, 1)))];
    end if;
  end if;
  -- v634 竿子的特別加成（月光竿晚上、深海竿在海上、路亞竿配假餌；跟 js/game.js 的 rodSp 一樣）
  if rod ? 'sp' then
    if rod->'sp' ? 'night' and per = 'night' then kr := kr * (rod->'sp'->'night'->>0)::numeric; kl := kl * (rod->'sp'->'night'->>1)::numeric; end if;
    if rod->'sp' ? 'sea' and sea then kr := kr * (rod->'sp'->'sea'->>0)::numeric; kl := kl * (rod->'sp'->'sea'->>1)::numeric; end if;
    if rod->'sp' ? 'lure' and rig = 'lure' then kr := kr * (rod->'sp'->'lure'->>0)::numeric; kl := kl * (rod->'sp'->'lure'->>1)::numeric; end if;
  end if;
  select count(*) into nleg from jsonb_array_elements_text(sp->'fish') x where cfg->'fish'->x->>'r' = '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false);   -- 變種不算
  legk := coalesce((cfg->'legKs'->>p_spot)::numeric, case when p_spot = 'harbor' then (cfg->'legK'->>'harbor')::numeric else (cfg->'legK'->>'other')::numeric end) / greatest(1, nleg);   -- v568 加了新傳說魚的釣點有自己的總機率（legKs），原本的傳說魚才不會被分掉
  begin select coalesce(jsonb_object_agg(e.fish, e.mult), '{}') into eco from public.ocean_eco e where e.spot = p_spot and e.until > now(); exception when undefined_table then eco := '{}'; end;
  sg_k := case when p_boat then null else public._sign_hit(p_spot, p_bx, p_bz, p_sl, bait->>'k') end;
  begin evm := public._ev_mig(); if public._ev_meteor() then kl := kl * 1.6; end if; exception when undefined_function then evm := null; end;
  begin cor_k := public._coral_k(pl.id, p_spot); exception when undefined_function then cor_k := 0; end;
  begin popm := public._pop_map(); exception when undefined_function or undefined_table then popm := '{}'; end;   -- v586 族群量：少的魚難釣（最低 ×0.5）、多的好釣（最高 ×1.3）   -- 142 小島海底花園：自己種的珊瑚長到一半以上，在小島釣稀有的珊瑚礁魚（鸚哥魚、海馬、獅子魚）比較容易（每株 +25%，最多 4 株）
  begin rum_f := public._rumor_hit(pl.id, p_spot, rig, per); exception when undefined_function then rum_f := null; end;   -- 128 傳說魚的線索：三條線索都找到、在對的釣點時段釣法，那條傳說魚 ×4   -- 111 釣魚活動：魚群洄游、流星雨
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
      * (case when p_spot = 'mystic' and fid in ('bluewhale', 'bluewhale_albino') and public._bw_up() then 5 else 1 end)
      * (case when evm is not null and (evm->>'active')::boolean and p_spot = evm->>'spot' and fid = evm->>'fish' then 4 else 1 end)
      * (case when cor_k > 0 and fid in ('parrot', 'seahorse', 'lionfish') then 1 + 0.25 * cor_k else 1 end)   -- 142 珊瑚吸引珊瑚礁魚
      * coalesce((popm->coalesce(f->>'of', fid)->>'m')::numeric, 1)
      * (case when rum_f is not null and fid = rum_f then 4 else 1 end)   -- 111 魚群洄游：那種魚在那個釣點 ×4
      * (case when sg_k is not null and (f->>'k' = sg_k or (sg_k = 'shadow' and (f->>'max')::numeric >= 3)) then   -- v565 魚影（中大型魚）：以前只認「shadow」那一類，海邊只有魟魚、外海只有魟魚和海豚，所以對著魚影拋永遠是那兩種。改成最大能長到 3 公斤以上的都算
        (case when f->>'r' = '傳說' then (case when coalesce((f->>'follow')::boolean, false) and sg_k = 'shadow' then 3.0 when sg_k = bait->>'k' then 1.5 else 1.3 end) else (case when sg_k = bait->>'k' then 4 else 2.5 end) end) else 1 end)   -- 247 徵兆（255：餌對上徵兆加成更大）
      * (case when bait ? 'fav' then (case when bait->'fav' ? coalesce(f->>'of', fid) then (case when f->>'r' = '傳說' then 1.3 else 1.8 end) else 0.88 end) else 1 end)   -- 118 針對特定魚的餌：愛吃的魚 ×1.8（傳說 ×1.3），其他 ×0.88
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
  begin if rs is null and random() < 0.5 and public._mastery3(pl.id, pick) then fw := greatest(fw, round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.3))::numeric, 2)); end if; exception when undefined_function then null; end;   -- 114 三顆星的魚：大尺寸機率小幅提高
  if rs is not null then fw := public._rs_w(rsh); end if;
  -- v586 族群量影響大小：族群少的魚偏小，族群很多的偶爾特別大；演化過的魚種有 15% 是演化花色
  pp := (popm->coalesce(f->>'of', pick)->>'p')::numeric;
  if rs is null and pp is not null then
    if pp < 100 then fw := greatest((f->>'min')::numeric, round(fw * (0.85 + 0.15 * (pp - 30) / 70), 2));
    elsif pp > 110 and random() < 0.1 then fw := greatest(fw, round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.2))::numeric, 2)); end if;
    evo := coalesce((popm->coalesce(f->>'of', pick)->>'e')::boolean, false) and random() < 0.15;
  end if;
  gpv := case when pick in ('guppy', 'guppy_albino') then public._gpy_wild() end;
  perform set_config('tide.rig', coalesce(p_rig, ''), true);   -- 196 鱤魚只追路亞
  perform set_config('tide.bait', case when bait is not null then coalesce(p_bait, '') else '' end, true);   -- 193 這一竿用的魚餌：casts 的觸發器要看（草魚只吃玉米粒、麵包糰）
  insert into public.casts (uid, spot, fish, w, rs, sex, brood, gp, ev, at, shown_at) values (pl.id, p_spot, pick, fw, rs, sx, brood, gpv, evo, now(), null)
  on conflict (uid) do update set spot = excluded.spot, fish = excluded.fish, w = excluded.w, rs = excluded.rs, sex = excluded.sex, brood = excluded.brood, gp = excluded.gp, ev = excluded.ev, at = excluded.at, shown_at = null;
  update public.players set cast_fish = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null, cast_gp = null, cast_at = now(), bait = pl.bait, bait_on = pl.bait_on, buff_left = pl.buff_left, updated_at = now()
  where id = pl.id returning * into pl;
  begin   -- 204：記下這一竿在不在窩裡（別人算熱度用）、窩主是誰
    update public.players set cast_x = p_x, cast_z = p_z, cast_chum = case when cb_r > 1 or cb_l > 1 then p_chum else null end where id = pl.id;
    update public.casts set chum_owner = ch_own, chum_sid = ch_sid where uid = pl.id;
  exception when undefined_column then null; end;
  return pl;
end $$;

