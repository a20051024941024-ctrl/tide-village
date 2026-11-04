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
alter table public.players add column if not exists cast_rs text;
alter table public.players add column if not exists cast_sex text;      -- 這次碰到的魚是公（M）還是母（F）（037）
alter table public.players add column if not exists cast_brood boolean; -- 母吳郭魚嘴裡含著小魚（037）   -- 赤紅霸王鯊（032）：這次碰到的那一隻
-- 赤紅霸王鯊的族群（032 會放一開始的一公一母和其他函式；表要先建好，roll_fish 才編得過）
create table if not exists public.red_sharks (
  id integer primary key, sex text not null check (sex in ('M', 'F')), born_at timestamptz not null,
  status text not null default 'sea' check (status in ('sea', 'caught')), hooked_by uuid, hooked_at timestamptz,
  caught_by uuid, caught_name text, caught_w numeric(10,2), caught_at timestamptz
);
alter table public.red_sharks add column if not exists scars integer not null default 0;
alter table public.red_sharks enable row level security;
revoke all on public.red_sharks from anon, authenticated;
create index if not exists players_chum_idx on public.players (chum_type, chum_at desc);

create or replace function public._fishcfg() returns jsonb language sql immutable as $cfg$ select '__CFG__'::jsonb $cfg$;

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
  ipool text[]; ih bigint; intel text[] := '{}';
  season text; mo integer; kr numeric; kl numeric; nleg integer; legk numeric; rainy boolean;
  fid text; f jsonb; wt numeric; tot numeric := 0; ids text[] := '{}'; wts numeric[] := '{}'; pick text; r numeric; i integer;
  rsh public.red_sharks; rs text; fitk numeric := 1; sx text; brood boolean := false; wild boolean := false;
  c jsonb; ctype text; cat timestamptz; left_k numeric; fit numeric; k numeric; sc jsonb; age numeric; pw numeric; nb integer; fw numeric;
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
  pool := array(select x from jsonb_array_elements_text(cfg->'spots'->tip_spot->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) order by n);
  tip_fish := pool[1 + ((hh / 256) % cardinality(pool))::integer];
  -- 外海的魚情（每 5 分鐘換 3 種活躍的魚，×2.5；跟 js/game.js 的 intelAt 一樣）
  if p_spot = 'harbor' then
    ipool := array(select x from jsonb_array_elements_text(cfg->'spots'->'harbor'->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) order by n);
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
  for fid in select x from jsonb_array_elements_text(sp->'fish') with ordinality t(x, n) order by n loop
    f := cfg->'fish'->fid; if f is null then continue; end if;
    wt := (f->>'w')::numeric
      * (case when rig = 'lure' then (case when cfg->'lure' ? fid then 2.2 else 0.55 end) when rig = 'bottom' then (case when cfg->'bottom' ? fid then 2.2 else 0.65 end) else 1 end)
      * (case when fid = any(intel) then 2.5 else 1 end)
      * (case when season in ('spring', 'summer') and cfg->'wildBreed' ? fid then 1.5 else 1 end)   -- 野外繁殖季（037）：春夏吳郭魚、鯽魚這些會自己生的魚比較多
      * (case when p_spot <> 'mudflat' then 1 when (rig = 'bottom') = (cfg->'bottom' ? fid) then 1 else 0 end)   -- 泥灘：抓招潮蟹（沉底）只會是蟹，抓彈塗魚只會是魚
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
  -- 赤紅霸王鯊（032）：全伺服器的族群，隻數越多機率越高（還是非常低）
  if p_spot = 'harbor' then rsh := public._rs_try(pl.id); if rsh.id is not null then pick := 'shark_red'; rs := rsh.id || ':' || rsh.sex || ':' || rsh.scars || (case when rsh.hooked_by is null then ':x' else '' end); end if; end if;
  f := cfg->'fish'->pick;
  wild := season in ('spring', 'summer') and cfg->'wildBreed' ? pick;
  fw := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), case when wild then 2.4 else 1.7 end))::numeric, 2);   -- 繁殖季小魚比較多
  -- 公母（037）：一半一半；紅鯊用牠自己的性別；繁殖季的母吳郭魚有三成嘴裡含著小魚
  sx := case when rs is not null then rsh.sex when random() < 0.5 then 'M' else 'F' end;
  brood := sx = 'F' and season in ('spring', 'summer') and cfg->'brood' ? pick and random() < 0.3;
  if rs is not null then fw := public._rs_w(rsh); end if;
  update public.players set cast_fish = pick, cast_w = fw, cast_rs = rs, cast_sex = sx, cast_brood = brood, cast_at = now(), bait = pl.bait, bait_on = pl.bait_on, buff_left = pl.buff_left, updated_at = now()
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
  if p_fish = 'shark_red' then perform public._rs_claim(pl.id, pl.nickname, pl.cast_rs, w); end if;   -- 赤紅霸王鯊（032）
  select * into c from public.current_contest();
  update public.players set
    total      = total + 1,
    legend     = legend + (case when sp.rarity = '傳說' then 1 else 0 end),
    fish_count = jsonb_set(fish_count, array[p_fish], to_jsonb(coalesce((fish_count ->> p_fish)::int, 0) + 1)),
    fish_best  = case when coalesce((fish_best ->> p_fish)::numeric, 0) < w then jsonb_set(fish_best, array[p_fish], to_jsonb(w)) else fish_best end,
    best_fish  = case when w > best_w then p_fish else best_fish end,
    best_w     = greatest(best_w, w),
    tank       = public._trim_tank(jsonb_build_array(jsonb_build_object('f', p_fish, 'w', w, 't', ts) || case when (public._fishcfg()->'fish'->p_fish) ? 'v' then jsonb_build_object('k', true) else '{}'::jsonb end || case when pl.cast_sex in ('M', 'F') then jsonb_build_object('s', pl.cast_sex) else '{}'::jsonb end || case when pl.cast_brood then jsonb_build_object('b', true) else '{}'::jsonb end || case when p_fish = 'shark_red' then jsonb_build_object('rs', pl.cast_rs) else '{}'::jsonb end) || tank, show),
    week_best_w = case when p_fish <> c.fish then (case when week_id = c.week_id then week_best_w else 0 end)
                       when week_id = c.week_id then greatest(week_best_w, w) else w end,
    week_id    = case when p_fish = c.fish or week_id = c.week_id then c.week_id else week_id end,
    tourney_w  = case when tid is null then tourney_w when tourney_id = tid then tourney_w + w else w end,
    tourney_n  = case when tid is null then tourney_n when tourney_id = tid then tourney_n + 1 else 1 end,
    tourney_id = coalesce(tid, tourney_id),
    cast_fish  = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null,
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
