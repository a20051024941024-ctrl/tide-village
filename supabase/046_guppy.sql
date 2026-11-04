-- 潮汐釣魚村：孔雀魚配種（可以重複執行）
-- 每一條孔雀魚有基因 gp＝「尾巴顏色兩個字|尾巴形狀兩個字」，例如 rb|do。顏色 w灰 r紅 b藍 y黃 k黑 p紫（黑、紫只會從配種突變出來）；形狀 d扇尾 s劍尾 o圓尾（扇尾＞劍尾＞圓尾）。
-- 小魚從爸爸、媽媽各拿一個顏色、一個形狀；4% 機會顏色突變、3% 機會形狀突變。白化一樣照 043 的隱性遺傳。野生的基因在 020（_gpy_wild）。
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('guppy', '孔雀魚', '常見', 0.01, 0.02),
  ('guppy_albino', '白化孔雀魚', '稀有', 0.01, 0.02)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

create or replace function public._tank_breed_ok(p text) returns boolean language sql immutable as $$
  select p = any(array['goldfish','koi','carp','crucian','tilapia','clown','medaka','prawn','crayfish','seahorse','loach','pseudorasbora','guppy']) $$;   -- 要跟 js/game.js 的 TANK_BREED 一樣

create or replace function public._gpy_baby(a text, b text) returns text language plpgsql volatile as $$
declare ca text := coalesce(nullif(split_part(a, '|', 1), ''), 'ww'); ta text := coalesce(nullif(split_part(a, '|', 2), ''), 'oo');
        cb text := coalesce(nullif(split_part(b, '|', 1), ''), 'ww'); tb text := coalesce(nullif(split_part(b, '|', 2), ''), 'oo'); c text; t text; i integer;
begin
  c := substr(ca, 1 + floor(random() * 2)::int, 1) || substr(cb, 1 + floor(random() * 2)::int, 1);
  t := substr(ta, 1 + floor(random() * 2)::int, 1) || substr(tb, 1 + floor(random() * 2)::int, 1);
  if random() < 0.04 then i := 1 + floor(random() * 2)::int; c := overlay(c placing substr('wrbykp', 1 + floor(random() * 6)::int, 1) from i for 1); end if;
  if random() < 0.03 then i := 1 + floor(random() * 2)::int; t := overlay(t placing substr('dso', 1 + floor(random() * 3)::int, 1) from i for 1); end if;
  return c || '|' || t;
end $$;
revoke all on function public._gpy_baby(text, text) from public, anon, authenticated;

-- 水族館繁殖：跟 043 一樣，多了孔雀魚的基因
create or replace function public.breed_tank() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); days integer; born jsonb := '[]'::jsonb; sp record; d integer; k integer; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  pairs integer; n integer := 0; fsp public.fish_species; ms text[]; fs text[]; g text; fid text; gp text;
begin
  if pl.breed_at is null then update public.players set breed_at = now() where id = pl.id; return jsonb_build_object('born', born, 'tank', pl.tank); end if;
  days := least(3, floor(extract(epoch from now() - pl.breed_at) / 86400)::integer);
  if days < 1 then return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint); end if;
  for sp in select public._breed_base(e->>'f') as b,
                   array_agg(public._geno(e) || '#' || coalesce(e->>'gp', '') order by (case when public._geno(e) like 'V:%' then 0 when public._geno(e) like 'C:%' then 1 else 2 end), public._geno(e)) filter (where e->>'s' = 'M') as m,
                   array_agg(public._geno(e) || '#' || coalesce(e->>'gp', '') order by (case when public._geno(e) like 'V:%' then 0 when public._geno(e) like 'C:%' then 1 else 2 end), public._geno(e)) filter (where e->>'s' = 'F') as fm
             from jsonb_array_elements(pl.tank) e
             where pl.show @> jsonb_build_array(e->'t') and public._tank_breed_ok(public._breed_base(e->>'f')) and not (e ? 'rs')
             group by public._breed_base(e->>'f') loop
    ms := coalesce(sp.m, '{}'); fs := coalesce(sp.fm, '{}'); pairs := least(cardinality(ms), cardinality(fs)); if pairs < 1 then continue; end if;
    select * into fsp from public.fish_species where id = sp.b; if not found then continue; end if;
    for d in 1..days loop for k in 1..pairs loop
      if n >= 3 * days then exit; end if;
      if random() < 0.5 then n := n + 1; ts := ts + 1; g := public._baby(split_part(ms[k], '#', 1), split_part(fs[k], '#', 1));
        fid := case when g like 'V:%' then split_part(g, ':', 2) else sp.b end;
        gp := case when sp.b = 'guppy' then public._gpy_baby(split_part(ms[k], '#', 2), split_part(fs[k], '#', 2)) end;
        born := born || jsonb_build_array(jsonb_build_object('f', fid, 'w', round(fsp.min_w::numeric, 2), 't', ts, 's', case when random() < 0.5 then 'M' else 'F' end, 'y', true)
                  || case when g like 'C:%' then jsonb_build_object('g', split_part(g, ':', 2)) else '{}'::jsonb end
                  || case when g like 'V:%' then jsonb_build_object('k', true) else '{}'::jsonb end
                  || case when gp is not null then jsonb_build_object('gp', gp) else '{}'::jsonb end); end if;
    end loop; end loop;
  end loop;
  update public.players set tank = public._trim_tank(born || tank, show), breed_at = breed_at + make_interval(days => days), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint);
end $$;
revoke all on function public.breed_tank() from public, anon;
grant execute on function public.breed_tank() to authenticated;

select '孔雀魚配種設定完成 🐟' as result;
