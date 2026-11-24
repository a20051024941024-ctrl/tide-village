-- 220 🧬 生命垂釣・第一次：配種缸（作者 11/23 選 C「自然演化＋玩家培育」，11/24「生命垂釣」開工）。可以重複執行。
-- 計畫：https://claude.ai/artifact/87U1euctC6DPnpAeN6GQUA
-- ・原本的東西都不動：公母（037）、變種的隱性遺傳（043）、孔雀魚（046）、展示缸自動生小魚（breed_tank）照舊。
-- ・每條魚（tank 裡的一筆）可以多一組基因 gn：{"c":[a,b],"p":[a,b],"f":[a,b],"s":[a,b],"r":[a,b],"z":100,"n":0}
--     c 主色（0 原色 1 紅 2 橘 3 黃 4 白 5 黑 6 藍 7 紫 8 粉 9 綠 10 青 11 棕），兩份混在一起
--     p 花紋（0 沒有 1 斑點 2 條紋 3 紅白 4 三色 5 網紋 6 漸層）；1、2、6 一份就會出現，3、4、5 要兩份一樣
--     f 鰭（0 一般 1 長鰭 2 蝴蝶鰭 3 燕尾 4 圓扇），要兩份一樣
--     s 光澤（0 一般 1 金屬光 2 珍珠 3 透明），要兩份一樣
--     r 稀有突變（0 沒有 1 白化 2 金鱗 3 黑化 4 夜光 5 寶石眼），要兩份一樣；突變出來的那一條直接兩份
--     z 體型（80～130，100＝原本大小），n 第幾代
--   沒有 gn 的魚（以前的魚、釣到的魚）就是全部 0、體型 100、第 0 代。
-- ・配種缸：自己挑一公一母（同一種、會在魚缸生的那 13 種、已經長大），設定水溫／飼料／水草，每一缸每天配一次，生 1～3 條魚苗。
--     水溫 cold：藍、紫、青比較容易傳下去和突變出來；warm：紅、橘、黃、粉。飼料 color（🪙30）：顏色、花紋比較容易傳下去；protein（🪙30）：體型大一點。水草（🪙20）：特別的鰭比較容易傳下去。
--     這些只是把機率從 50% 推到 60%，不是保證。
-- ・突變：每條魚苗 5% 機會某一個特徵跳成爸媽都沒有的樣子（只有一份，要再配才會顯出來的就先藏著）；0.5% 機會稀有突變（直接顯出來）。
-- ・近親（兄弟姊妹、爸媽配小孩）體型會小一點。
-- ・魚苗 pm＝[爸爸的 t, 媽媽的 t]，gb＝出生時間（毫秒）；出生滿 1 天才算長大、才能再配。養殖的魚照舊只賣四分之一（y）。
-- ・每人最多 60 條有基因的魚；配種缸一開始 1 缸，可以用金幣加到 4 缸（2000、5000、10000）。
-- ・全部在這裡算，手機只負責顯示。

alter table public.players add column if not exists blab jsonb not null default '{"n":1,"s":{}}'::jsonb;   -- 配種缸：n 幾缸，s {"1":{"m":t,"f":t,"tp":"mid","fd":"norm","pl":false,"at":毫秒}}

create or replace function public._gn_of(e jsonb) returns jsonb language sql immutable as $$
  select '{"c":[0,0],"p":[0,0],"f":[0,0],"s":[0,0],"r":[0,0],"z":100,"n":0}'::jsonb || coalesce(case when jsonb_typeof(e->'gn') = 'object' then e->'gn' end, '{}'::jsonb) $$;

-- 一個特徵從爸媽各拿一份；pref 裡面的值比較容易被挑到（60%）
create or replace function public._gn_pick(pair jsonb, pref integer[]) returns integer language plpgsql volatile as $$
declare a integer := coalesce((pair->>0)::integer, 0); b integer := coalesce((pair->>1)::integer, 0); pa boolean; pb boolean;
begin
  if pref is not null then pa := a = any(pref); pb := b = any(pref);
    if pa and not pb then return case when random() < 0.6 then a else b end; end if;
    if pb and not pa then return case when random() < 0.6 then b else a end; end if;
  end if;
  return case when random() < 0.5 then a else b end;
end $$;

create or replace function public._gn_child(ga jsonb, gb jsonb, p_tp text, p_fd text, p_pl boolean, p_inbred boolean) returns jsonb language plpgsql volatile as $$
declare cold integer[] := array[6,7,10]; warm integer[] := array[1,2,3,8]; any11 integer[] := array[1,2,3,4,5,6,7,8,9,10,11];
  cpref integer[] := case p_tp when 'cold' then cold when 'warm' then warm else case when p_fd = 'color' then any11 end end;
  ppref integer[] := case when p_fd = 'color' then array[1,2,3,4,5,6] end;
  fpref integer[] := case when p_pl then array[1,2,3,4] end;
  c integer[] := array[public._gn_pick(ga->'c', cpref), public._gn_pick(gb->'c', cpref)];
  p integer[] := array[public._gn_pick(ga->'p', ppref), public._gn_pick(gb->'p', ppref)];
  f integer[] := array[public._gn_pick(ga->'f', fpref), public._gn_pick(gb->'f', fpref)];
  s integer[] := array[public._gn_pick(ga->'s', null), public._gn_pick(gb->'s', null)];
  r integer[] := array[public._gn_pick(ga->'r', null), public._gn_pick(gb->'r', null)];
  z integer; k integer; i integer; mut text := null; pool integer[];
begin
  z := round(((ga->>'z')::numeric + (gb->>'z')::numeric) / 2 + (random() * 10 - 5))::integer + case when p_fd = 'protein' then 3 else 0 end - case when p_inbred then 4 else 0 end;
  z := greatest(80, least(130, z));
  if random() < 0.05 then   -- 一般突變：某一個特徵的其中一份跳成別的
    k := 1 + floor(random() * 4)::integer; i := 1 + floor(random() * 2)::integer;
    if k = 1 then pool := case when p_tp = 'cold' and random() < 0.7 then cold when p_tp = 'warm' and random() < 0.7 then warm else any11 end;
      c[i] := pool[1 + floor(random() * cardinality(pool))::integer]; mut := 'c';
    elsif k = 2 then p[i] := 1 + floor(random() * 6)::integer; mut := 'p';
    elsif k = 3 then f[i] := 1 + floor(random() * 4)::integer; mut := 'f';
    else s[i] := 1 + floor(random() * 3)::integer; mut := 's'; end if;
  end if;
  if random() < 0.005 then k := 1 + floor(random() * 5)::integer; r := array[k, k]; mut := 'r'; end if;   -- 稀有突變：直接顯出來
  return jsonb_build_object('c', to_jsonb(c), 'p', to_jsonb(p), 'f', to_jsonb(f), 's', to_jsonb(s), 'r', to_jsonb(r), 'z', z,
    'n', greatest((ga->>'n')::integer, (gb->>'n')::integer) + 1) || case when mut is not null then jsonb_build_object('mu', mut) else '{}'::jsonb end;
end $$;

create or replace function public.lab_get() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return jsonb_build_object('lab', pl.blab, 'now', (extract(epoch from clock_timestamp()) * 1000)::bigint);
end $$;

create or replace function public.lab_breed(p_slot integer, p_m bigint, p_f bigint, p_tp text, p_fd text, p_pl boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); lab jsonb; sl jsonb; em jsonb; ef jsonb; b text; fsp public.fish_species; nowms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  cost integer; n integer; born jsonb := '[]'::jsonb; i integer; g text; fid text; gp text; gn jsonb; inbred boolean; ts bigint; have integer;
begin
  select * into pl from public.players where id = pl.id for update;
  lab := coalesce(pl.blab, '{"n":1,"s":{}}'::jsonb);
  if p_slot is null or p_slot < 1 or p_slot > coalesce((lab->>'n')::integer, 1) then raise exception '沒有這一缸'; end if;
  if p_tp is null or p_tp not in ('cold', 'mid', 'warm') then p_tp := 'mid'; end if;
  if p_fd is null or p_fd not in ('norm', 'color', 'protein') then p_fd := 'norm'; end if;
  p_pl := coalesce(p_pl, false);
  sl := lab->'s'->(p_slot::text);
  if sl is not null and (sl->>'at') is not null and nowms - (sl->>'at')::bigint < 20 * 3600 * 1000 then raise exception '這一缸今天配過了，明天再來'; end if;
  select e into em from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = p_m limit 1;
  select e into ef from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = p_f limit 1;
  if em is null or ef is null then raise exception '魚缸裡找不到這條魚'; end if;
  if em->>'s' is distinct from 'M' or ef->>'s' is distinct from 'F' then raise exception '要一公一母'; end if;
  if em ? 'rs' or ef ? 'rs' then raise exception '這條魚不能放進配種缸'; end if;
  b := public._breed_base(em->>'f');
  if b <> public._breed_base(ef->>'f') then raise exception '要同一種魚才能配'; end if;
  if not public._tank_breed_ok(b) then raise exception '這種魚不會在魚缸裡生小魚'; end if;
  if (em ? 'gb' and nowms - (em->>'gb')::bigint < 86400000) or (ef ? 'gb' and nowms - (ef->>'gb')::bigint < 86400000) then raise exception '魚苗還沒長大，明天再配'; end if;
  select * into fsp from public.fish_species where id = b; if not found then raise exception '沒有這種魚'; end if;
  cost := case p_fd when 'norm' then 0 else 30 end + case when p_pl then 20 else 0 end;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  n := 1 + case when random() < 0.6 then 1 else 0 end + case when random() < 0.25 then 1 else 0 end;
  select count(*) into have from jsonb_array_elements(pl.tank) e where e ? 'gn';
  if have + n > 60 then raise exception '有基因的魚最多養 60 條，先賣掉或放掉一些'; end if;
  inbred := (em ? 'pm' and ef ? 'pm' and em->'pm' = ef->'pm') or (em ? 'pm' and em->'pm' @> to_jsonb(p_f)) or (ef ? 'pm' and ef->'pm' @> to_jsonb(p_m));
  ts := nowms;
  for i in 1..n loop
    ts := ts + 1;
    g := public._baby(public._geno(em), public._geno(ef));
    fid := case when g like 'V:%' then split_part(g, ':', 2) else b end;
    gp := case when b = 'guppy' then public._gpy_baby(coalesce(em->>'gp', ''), coalesce(ef->>'gp', '')) end;
    gn := public._gn_child(public._gn_of(em), public._gn_of(ef), p_tp, p_fd, p_pl, inbred);
    born := born || jsonb_build_array(jsonb_build_object('f', fid, 'w', round(fsp.min_w::numeric, 2), 't', ts, 's', case when random() < 0.5 then 'M' else 'F' end, 'y', true,
              'gn', gn, 'pm', jsonb_build_array(p_m, p_f), 'gb', nowms)
              || case when g like 'C:%' then jsonb_build_object('g', split_part(g, ':', 2)) else '{}'::jsonb end
              || case when gp is not null then jsonb_build_object('gp', gp) else '{}'::jsonb end);
  end loop;
  lab := jsonb_set(lab, array['s'], coalesce(lab->'s', '{}'::jsonb) || jsonb_build_object(p_slot::text,
           jsonb_build_object('m', p_m, 'f', p_f, 'tp', p_tp, 'fd', p_fd, 'pl', p_pl, 'at', nowms)));
  update public.players set coins = coins - cost, blab = lab, tank = public._trim_tank(born || tank, show), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('born', born, 'lab', pl.blab, 'tank', pl.tank, 'coins', pl.coins, 'cost', cost, 'now', nowms);
end $$;

create or replace function public.lab_slot_buy() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); lab jsonb; n integer; cost integer;
begin
  select * into pl from public.players where id = pl.id for update;
  lab := coalesce(pl.blab, '{"n":1,"s":{}}'::jsonb); n := coalesce((lab->>'n')::integer, 1);
  if n >= 4 then raise exception '配種缸最多 4 缸'; end if;
  cost := (array[2000, 5000, 10000])[n];
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost, blab = jsonb_set(lab, array['n'], to_jsonb(n + 1)), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('lab', pl.blab, 'coins', pl.coins, 'cost', cost);
end $$;

revoke all on function public._gn_of(jsonb) from public, anon, authenticated;
revoke all on function public._gn_pick(jsonb, integer[]) from public, anon, authenticated;
revoke all on function public._gn_child(jsonb, jsonb, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.lab_get() from public, anon;
revoke all on function public.lab_breed(integer, bigint, bigint, text, text, boolean) from public, anon;
revoke all on function public.lab_slot_buy() from public, anon;
grant execute on function public.lab_get() to authenticated;
grant execute on function public.lab_breed(integer, bigint, bigint, text, text, boolean) to authenticated;
grant execute on function public.lab_slot_buy() to authenticated;

select '生命垂釣・配種缸設定完成 🧬' as result;
