-- 潮汐釣魚村：變種也會繁殖（照真實的隱性遺傳）（可以重複執行）
-- 魚缸裡的魚有三種「基因」：V＝變種本身（例如黃金錦鯉）、C＝帶著變種基因但看起來是原種（tank 裡 g=變種的 id）、N＝一般。
--   V(a)×V(a)→變種 a；V(a)×C(a)→一半變種 a、一半帶 a；V(a)×N→全部帶 a；C(a)×C(a)→1/4 變種、1/2 帶、1/4 一般；C(a)×N→一半帶 a。
-- 同一種（變種算原本那種）的一公一母都在展示中才會配對，變種先跟變種配；每天每一對一半機會生一條，每天最多 3 條（跟 037 一樣）。
-- 變種的原本那種從 020 的 _fishcfg() 查（fish.<id>.of）。
create or replace function public._breed_base(f text) returns text language sql stable as $$
  select coalesce(public._fishcfg()->'fish'->f->>'of', f) $$;

-- 一條魚的基因：'V:<變種>'、'C:<變種>' 或 'N'
create or replace function public._geno(e jsonb) returns text language sql stable as $$
  select case when public._breed_base(e->>'f') <> (e->>'f') then 'V:' || (e->>'f') when e ? 'g' then 'C:' || (e->>'g') else 'N' end $$;

-- 小魚的基因
create or replace function public._baby(a text, b text) returns text language plpgsql volatile as $$
declare ka text := split_part(a, ':', 1); va text := split_part(a, ':', 2); kb text := split_part(b, ':', 1); vb text := split_part(b, ':', 2); r numeric := random();
begin
  if ka = 'N' and kb = 'N' then return 'N'; end if;
  if ka <> 'N' and kb <> 'N' and va = vb then
    if ka = 'V' and kb = 'V' then return 'V:' || va; end if;
    if ka = 'V' or kb = 'V' then return case when r < 0.5 then 'V:' || va else 'C:' || va end; end if;
    return case when r < 0.25 then 'V:' || va when r < 0.75 then 'C:' || va else 'N' end;
  end if;
  -- 兩邊不一樣（或只有一邊有）：變種那一邊一定傳下去（變成帶基因），只是帶著的那一邊一半機會
  if ka = 'V' and (kb <> 'V' or r < 0.5) then return 'C:' || va; end if;
  if kb = 'V' then return 'C:' || vb; end if;
  if ka = 'C' and (kb = 'N' or r < 0.5) then return case when random() < 0.5 then 'C:' || va else 'N' end; end if;
  return case when random() < 0.5 then 'C:' || vb else 'N' end;
end $$;

create or replace function public.breed_tank() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); days integer; born jsonb := '[]'::jsonb; sp record; d integer; k integer; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  pairs integer; n integer := 0; fsp public.fish_species; ms text[]; fs text[]; g text; fid text;
begin
  if pl.breed_at is null then update public.players set breed_at = now() where id = pl.id; return jsonb_build_object('born', born, 'tank', pl.tank); end if;
  days := least(3, floor(extract(epoch from now() - pl.breed_at) / 86400)::integer);
  if days < 1 then return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint); end if;
  for sp in select public._breed_base(e->>'f') as b,
                   array_agg(public._geno(e) order by (case when public._geno(e) like 'V:%' then 0 when public._geno(e) like 'C:%' then 1 else 2 end), public._geno(e)) filter (where e->>'s' = 'M') as m,
                   array_agg(public._geno(e) order by (case when public._geno(e) like 'V:%' then 0 when public._geno(e) like 'C:%' then 1 else 2 end), public._geno(e)) filter (where e->>'s' = 'F') as fm
             from jsonb_array_elements(pl.tank) e
             where pl.show @> jsonb_build_array(e->'t') and public._tank_breed_ok(public._breed_base(e->>'f')) and not (e ? 'rs')
             group by public._breed_base(e->>'f') loop
    ms := coalesce(sp.m, '{}'); fs := coalesce(sp.fm, '{}'); pairs := least(cardinality(ms), cardinality(fs)); if pairs < 1 then continue; end if;
    select * into fsp from public.fish_species where id = sp.b; if not found then continue; end if;
    for d in 1..days loop for k in 1..pairs loop
      if n >= 3 * days then exit; end if;
      if random() < 0.5 then n := n + 1; ts := ts + 1; g := public._baby(ms[k], fs[k]);
        fid := case when g like 'V:%' then split_part(g, ':', 2) else sp.b end;
        born := born || jsonb_build_array(jsonb_build_object('f', fid, 'w', round(fsp.min_w::numeric, 2), 't', ts, 's', case when random() < 0.5 then 'M' else 'F' end, 'y', true)
                  || case when g like 'C:%' then jsonb_build_object('g', split_part(g, ':', 2)) else '{}'::jsonb end
                  || case when g like 'V:%' then jsonb_build_object('k', true) else '{}'::jsonb end); end if;
    end loop; end loop;
  end loop;
  update public.players set tank = public._trim_tank(born || tank, show), breed_at = breed_at + make_interval(days => days), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('born', born, 'tank', pl.tank, 'next', (extract(epoch from pl.breed_at + interval '1 day') * 1000)::bigint);
end $$;
revoke all on function public.breed_tank() from public, anon;
grant execute on function public.breed_tank() to authenticated;
revoke all on function public._baby(text, text) from public, anon, authenticated;

select '變種繁殖設定完成 🧬' as result;
