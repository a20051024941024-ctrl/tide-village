-- 潮汐釣魚村 v1009：水裡的地形第二段（接在 265 後面貼，可以重複執行）
-- roll_fish 照 259，只改兩個地方：海面徵兆不再加成（sg_k 一律是空的）；浮標落在水草、礁石、棧橋柱子、河口旁邊，愛待在那裡的魚 ×3（傳說 ×1.5）。
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
eco jsonb := '{}';
season text; mo integer; kr numeric; kl numeric; nleg integer; legk numeric; rainy boolean;
fid text; f jsonb; wt numeric; tot numeric := 0; ids text[] := '{}'; wts numeric[] := '{}'; pick text; r numeric; i integer;
rsh public.red_sharks; rs text; gpv text; fitk numeric := 1; sx text; brood boolean := false; wild boolean := false;
crowd integer := 0; ch_own uuid; ch_sid text;
c jsonb; ctype text; cat timestamptz; left_k numeric; fit numeric; k numeric; sc jsonb; age numeric; pw numeric; nb integer; fw numeric;
sf record;
sg_k text; hk text; hf text[];
popm jsonb := '{}'; pp numeric; evo boolean := false;
begin
if sp is null then raise exception '沒有這個釣點'; end if;
if pl.cast_at is not null and now() - pl.cast_at < interval '2.5 seconds' then raise exception '拋太快了'; end if;
if p_spot = 'shrimp' and coalesce(pl.shrimp_until, '-infinity') < now() then raise exception '要先買釣蝦時段'; end if;
if p_spot = 'mudflat' and sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) >= -0.5 then raise exception '泥灘現在被水淹著，退潮才能下去抓'; end if;
if p_bait is not null and rig <> 'lure' and cfg->'baits' ? p_bait and coalesce((pl.bait ->> p_bait)::integer, 0) > 0 then
bait := cfg->'baits'->p_bait; nb := (pl.bait ->> p_bait)::integer - 1;
pl.bait := case when nb <= 0 then pl.bait - p_bait else jsonb_set(pl.bait, array[p_bait], to_jsonb(nb)) end;
if nb <= 0 and pl.bait_on = p_bait then pl.bait_on := null; end if;
end if;
if pl.buff_r is not null and pl.buff_left > 0 and cfg->'buffs' ? pl.buff_r then bf := cfg->'buffs'->pl.buff_r; pl.buff_left := pl.buff_left - 1; end if;
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
select e, s.owner = pl.id into sc, sc_mine from public.secret_chum s, jsonb_array_elements(s.spots) e
where e->>'id' = substr(p_chum, 8) and (s.owner = pl.id or (p_x is not null and p_z is not null and sqrt(power(p_x - (e->>'x')::numeric, 2) + power(p_z - (e->>'z')::numeric, 2)) < 10))
order by (s.owner = pl.id) desc limit 1;
if sc is not null and cfg->'chums' ? (sc->>'type') then
c := cfg->'chums'->(sc->>'type'); age := ms - (sc->>'at')::bigint;
if age >= 0 and age <= (cfg->>'secretLife')::numeric + coalesce((sc->>'ext')::numeric, 0) then
pw := least(1, greatest(0.15, 0.15 + 0.85 * age / (cfg->>'secretGrow')::numeric));
fit := case when (c->>'fresh')::boolean then (case when sea then 0.45 else 1 end) when (c->>'sea')::boolean then (case when sea then 1 else 0.5 end) else 1 end;
k := pw * fit * (case when sc_mine then 1 else 0.75 end); cb_r := 1 + ((c->>'rare')::numeric * 1.25 - 1) * k; cb_l := 1 + ((c->>'legend')::numeric * 1.35 - 1) * k;
end if;
end if;
end if;
if cb_r > 1 or cb_l > 1 then
begin
crowd := public._chum_crowd(pl.id, p_x, p_z); cb_r := cb_r * (1 + 0.10 * crowd); cb_l := cb_l * (1 + 0.12 * crowd);
ch_own := public._chum_owner(p_chum, pl.id, p_x, p_z); if p_chum like 'secret:%' then ch_sid := substr(p_chum, 8); end if;
exception when undefined_function then crowd := 0; end;
end if;
w := public._weather(ms);
if sea then
tide_st := case when sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) > 0.8 then 'high'
when sin((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) < -0.8 then 'low'
when cos((ms % (cfg->>'tidePeriod')::bigint)::numeric / (cfg->>'tidePeriod')::numeric * 2 * pi()) > 0 then 'rising' else 'falling' end;
tr := (cfg->'tide'->tide_st->>'rare')::numeric;
end if;
rainy := w->>'k' in ('rain', 'storm');
if not coalesce(p_boat, false) and p_x is not null and p_z is not null and (sqrt(power(p_x - (sp->>'x')::numeric, 2) + power(p_z - (sp->>'z')::numeric, 2)) < 2.2
or (sp->>'x2' is not null and sqrt(power(p_x - (sp->>'x2')::numeric, 2) + power(p_z - (sp->>'z2')::numeric, 2)) < 2.2)) then
ring := 1.3; lb := (sp->>'lb')::numeric; end if;
gh := mod((mod(ms / 1000.0, (cfg->>'dayLen')::numeric) / (cfg->>'dayLen')::numeric * 24 + 8)::numeric, 24);
per := case when gh >= 7.5 and gh < 17 then 'day' when (gh >= 5 and gh < 7.5) or (gh >= 17 and gh < 19.6) then 'twilight' else 'night' end;
hh := public._fnv('tip' || to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD'));
tip_spot := cfg->'tipSpots'->>(hh % jsonb_array_length(cfg->'tipSpots'))::integer;
pool := array(select x from jsonb_array_elements_text(cfg->'spots'->tip_spot->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) order by n);
tip_fish := pool[1 + ((hh / 256) % cardinality(pool))::integer];
if p_spot = 'harbor' then
ipool := array(select x from jsonb_array_elements_text(cfg->'spots'->'harbor'->'fish') with ordinality t(x, n) where cfg->'fish'->x->>'r' <> '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false) and cfg->'fish'->x->>'fest' is null order by n);
ih := public._fnv('intel' || floor(ms / 300000.0)::bigint::text);
intel := array[ipool[1 + (ih % cardinality(ipool))::integer], ipool[1 + ((ih / 256) % cardinality(ipool))::integer], ipool[1 + ((ih / 65536) % cardinality(ipool))::integer]];
end if;
mo := extract(month from now() at time zone 'Asia/Taipei');
season := case when mo between 3 and 5 then 'spring' when mo between 6 and 8 then 'summer' when mo between 9 and 11 then 'autumn' else 'winter' end;
fitk := case when p_spot in ('shrimp', 'mudflat') or cfg->'rodFit'->coalesce(rod->>'type', 'cast') is null then 1 when cfg->'rodFit'->coalesce(rod->>'type', 'cast') ? p_spot then 1.15 else 0.85 end;
kr := fitk * (rod->>'rare')::numeric * coalesce((bait->>'rare')::numeric, 1) * coalesce((bf->>'rare')::numeric, 1) * cb_r * (w->>'rare')::numeric * tr * (ln->>'rare')::numeric;
kl := (rod->>'legend')::numeric * coalesce((bait->>'legend')::numeric, 1) * coalesce((bf->>'legend')::numeric, 1) * cb_l
* (case when (w->>'legendSea')::boolean then (case when sea then (w->>'legend')::numeric else 1 end) else (w->>'legend')::numeric end);
if pl.rod = 'r_lure' and p_spot not in ('shrimp', 'mudflat') then kr := kr * (case when rig = 'lure' then 1.15 else 0.85 end); end if;
if pl.rod in ('r_lure', 'r_iso', 'r_surf', 'r_pole') then
kr := kr * (array[1, 1.1, 1.2, 1.35, 1.5])[least(5, greatest(1, coalesce((pl.rod_lv->>pl.rod)::int, 1)))];
if (pl.rod = 'r_lure' and rig = 'lure') or (pl.rod <> 'r_lure' and fitk > 1) then
kl := kl * (array[1, 1, 1.1, 1.25, 1.4])[least(5, greatest(1, coalesce((pl.rod_lv->>pl.rod)::int, 1)))];
end if;
end if;
if rod ? 'sp' then
if rod->'sp' ? 'night' and per = 'night' then kr := kr * (rod->'sp'->'night'->>0)::numeric; kl := kl * (rod->'sp'->'night'->>1)::numeric; end if;
if rod->'sp' ? 'sea' and sea then kr := kr * (rod->'sp'->'sea'->>0)::numeric; kl := kl * (rod->'sp'->'sea'->>1)::numeric; end if;
if rod->'sp' ? 'lure' and rig = 'lure' then kr := kr * (rod->'sp'->'lure'->>0)::numeric; kl := kl * (rod->'sp'->'lure'->>1)::numeric; end if;
end if;
select count(*) into nleg from jsonb_array_elements_text(sp->'fish') x where cfg->'fish'->x->>'r' = '傳說' and not coalesce((cfg->'fish'->x->>'v')::boolean, false);
legk := coalesce((cfg->'legKs'->>p_spot)::numeric, case when p_spot = 'harbor' then (cfg->'legK'->>'harbor')::numeric else (cfg->'legK'->>'other')::numeric end) / greatest(1, nleg);
begin select coalesce(jsonb_object_agg(e.fish, e.mult), '{}') into eco from public.ocean_eco e where e.spot = p_spot and e.until > now(); exception when undefined_table then eco := '{}'; end;
sg_k := null; hk := case when p_boat then null else public._habitat_at(p_bx, p_bz) end; hf := coalesce(public._habitat_fish(hk), '{}'::text[]);
begin evm := public._ev_mig(); if public._ev_meteor() then kl := kl * 1.6; end if; exception when undefined_function then evm := null; end;
begin cor_k := public._coral_k(pl.id, p_spot); exception when undefined_function then cor_k := 0; end;
begin popm := public._pop_map(); exception when undefined_function or undefined_table then popm := '{}'; end;
begin rum_f := public._rumor_hit(pl.id, p_spot, rig, per); exception when undefined_function then rum_f := null; end;
if p_boat then begin if public._breach_luck(pl.id) then kr := kr * 1.4; kl := kl * 1.25; end if; exception when undefined_function then null; end; end if;
for fid in select x from jsonb_array_elements_text(sp->'fish') with ordinality t(x, n) order by n loop
f := cfg->'fish'->fid; if f is null then continue; end if;
if f ? 'fest' and not public._fest_on(f->>'fest') then continue; end if;
wt := (f->>'w')::numeric
* (case when rig = 'lure' then (case when cfg->'lure' ? fid then 2.2 else 0.55 end) when rig = 'bottom' then (case when cfg->'bottom' ? fid then 2.2 else 0.65 end) else 1 end)
* (case when fid = any(intel) then 2.5 else 1 end)
* coalesce((eco->>fid)::numeric, 1)
* (case when season in ('spring', 'summer') and cfg->'wildBreed' ? fid then 1.5 else 1 end)
* (case when p_spot <> 'mudflat' then 1 when (rig = 'bottom') = (cfg->'bottom' ? fid) then 1 else 0 end)
* (case when tip_spot = p_spot and tip_fish = fid then 2.5 else 1 end)
* (case when rainy and cfg->'rain' ? fid then 2 else 1 end)
* (case when cfg->'seasons'->season ? fid and f->>'r' <> '傳說' then 2 else 1 end)
* (case when f->>'t' is null then 1 when f->>'t' = per then 1.5 else 0.15 end)
* (case when p_spot = 'mystic' and fid in ('bluewhale', 'bluewhale_albino') and public._bw_up() then 5 else 1 end)
* (case when evm is not null and (evm->>'active')::boolean and p_spot = evm->>'spot' and fid = evm->>'fish' then 4 else 1 end)
* (case when cor_k > 0 and fid in ('parrot', 'seahorse', 'lionfish') then 1 + 0.25 * cor_k else 1 end)
* coalesce((popm->coalesce(f->>'of', fid)->>'m')::numeric, 1)
* (case when rum_f is not null and fid = rum_f then 4 else 1 end)
* (case when sg_k is not null and (f->>'k' = sg_k or (sg_k = 'shadow' and (f->>'max')::numeric >= 3)) then
(case when f->>'r' = '傳說' then (case when coalesce((f->>'follow')::boolean, false) and sg_k = 'shadow' then 3.0 when sg_k = bait->>'k' then 1.5 else 1.3 end) else (case when sg_k = bait->>'k' then 4 else 2.5 end) end) else 1 end)
* (case when hk is not null and coalesce(f->>'of', fid) = any(hf) then (case when f->>'r' = '傳說' then 1.5 else 3 end) else 1 end)
* (case when bait ? 'fav' then (case when bait->'fav' ? coalesce(f->>'of', fid) then (case when f->>'r' = '傳說' then 1.3 else 1.8 end) else 0.88 end) else 1 end)
* (case when bait->>'k' is not null and f->>'k' = bait->>'k' then 1.5 else 1 end)
* (case f->>'r' when '常見' then 1 when '稀有' then 0.34 * (1 + charge * 0.8) * kr * ring else 0.07 * (1 + charge * 1.6) * lb * kl * ring * legk end);
ids := ids || fid; wts := wts || wt; tot := tot + wt;
end loop;
if cardinality(ids) = 0 then raise exception '沒有這個釣點'; end if;
r := random() * tot; pick := ids[1];
for i in 1..cardinality(ids) loop r := r - wts[i]; if r <= 0 then pick := ids[i]; exit; end if; end loop;
begin
for sf in select s.id, s.var_id, s.day, s.giant from public.sci_finds s where s.spot = p_spot and s.day <= (now() at time zone 'Asia/Taipei')::date order by s.day desc limit 60 loop
if random() < (case when sf.giant then (case when sf.day = (now() at time zone 'Asia/Taipei')::date then 0.015 else 0.004 end) * (1 + charge * 0.6)
when sf.day = (now() at time zone 'Asia/Taipei')::date then 0.05 else 0.012 end) then pick := case when random() < 0.04 then sf.var_id else sf.id end; exit; end if;
end loop;
exception when undefined_table or undefined_column then null; end;
if p_spot = 'shrimp' then fid := public._sev_try(pl.id); if fid is not null and cfg->'fish' ? fid then pick := fid; end if; end if;
if p_spot = 'harbor' or (p_spot = 'reef' and random() < 0.4) then rsh := public._rs_try(pl.id); if rsh.id is not null then pick := case when rsh.albino then 'shark_red_albino' else 'shark_red' end; rs := rsh.id || ':' || rsh.sex || ':' || rsh.scars || (case when rsh.hooked_by is null then ':x' else '' end); end if; end if;
f := coalesce(cfg->'fish'->pick, (select jsonb_build_object('r', s.rarity, 'min', s.min_w, 'max', s.max_w) from public.fish_species s where s.id = pick));
wild := season in ('spring', 'summer') and cfg->'wildBreed' ? pick;
fw := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), case when wild then 2.4 else 1.7 end))::numeric, 2);
sx := case when rs is not null then rsh.sex when random() < 0.5 then 'M' else 'F' end;
brood := sx = 'F' and season in ('spring', 'summer') and cfg->'brood' ? pick and random() < 0.3;
begin if rs is null and random() < 0.5 and public._mastery3(pl.id, pick) then fw := greatest(fw, round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.3))::numeric, 2)); end if; exception when undefined_function then null; end;
if rs is not null then fw := public._rs_w(rsh); end if;
pp := (popm->coalesce(f->>'of', pick)->>'p')::numeric;
if rs is null and pp is not null then
if pp < 100 then fw := greatest((f->>'min')::numeric, round(fw * (0.85 + 0.15 * (pp - 30) / 70), 2));
elsif pp > 110 and random() < 0.1 then fw := greatest(fw, round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.2))::numeric, 2)); end if;
evo := coalesce((popm->coalesce(f->>'of', pick)->>'e')::boolean, false) and random() < 0.15;
end if;
gpv := case when pick in ('guppy', 'guppy_albino') then public._gpy_wild() end;
perform set_config('tide.rig', coalesce(p_rig, ''), true);
perform set_config('tide.bait', case when bait is not null then coalesce(p_bait, '') else '' end, true);
insert into public.casts (uid, spot, fish, w, rs, sex, brood, gp, ev, at, shown_at) values (pl.id, p_spot, pick, fw, rs, sx, brood, gpv, evo, now(), null)
on conflict (uid) do update set spot = excluded.spot, fish = excluded.fish, w = excluded.w, rs = excluded.rs, sex = excluded.sex, brood = excluded.brood, gp = excluded.gp, ev = excluded.ev, at = excluded.at, shown_at = null;
update public.players set cast_fish = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null, cast_gp = null, cast_at = now(), bait = pl.bait, bait_on = pl.bait_on, buff_left = pl.buff_left, updated_at = now()
where id = pl.id returning * into pl;
begin
update public.players set cast_x = p_x, cast_z = p_z, cast_chum = case when cb_r > 1 or cb_l > 1 then p_chum else null end where id = pl.id;
update public.casts set chum_owner = ch_own, chum_sid = ch_sid where uid = pl.id;
exception when undefined_column then null; end;
return pl;
end $$;
