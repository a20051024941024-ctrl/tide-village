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

-- 2. 魚訊：浮標離哪一個位置近就用哪一個（光圈在 259）
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
