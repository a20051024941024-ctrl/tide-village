-- 潮汐釣魚村 v1018：聯名活動週（可以重複執行）
-- 作者 11/29：「阿穎那些限定款……出一個活動要用得到的，釣竿還有整套套裝要有特效……名牌還是相框，其他人也是活動出一個」「眼睛也是要活動出」
-- 阿穎週 → 阿默週 → 阿萬週 輪流，每週日 00:00（台灣時間）換。活動那一週釣到的魚（players.total 增加的數量）算進度：
--   20 條 名牌框 nfa_c<套>、40 條 眼睛顏色 k3e_<套>、80 條 聯名釣竿 rs_c<套>、150 條 整套衣服＋k3s_<套>。
-- 聯名套裝不再用金幣買（已經買的人保留）。
create table if not exists public.collab_ev (uid uuid not null, wk integer not null, base integer not null, claimed integer not null default 0, at timestamptz not null default now(), primary key (uid, wk));
alter table public.collab_ev enable row level security;

create or replace function public._collab_wk() returns integer language sql stable as $$
  select floor((extract(epoch from now()) - extract(epoch from timestamptz '2026-11-29 00:00:00+08')) / 604800)::integer $$;
create or replace function public._collab_set(w integer) returns text language sql immutable as $$
  select (array['ying', 'mo', 'wan'])[((w % 3) + 3) % 3 + 1] $$;
create or replace function public._collab_items(s text, tier integer) returns text[] language sql immutable as $$
  select case tier
    when 1 then array['nfa_c' || s]
    when 2 then array['k3e_' || s]
    when 3 then array['rs_c' || s]
    when 4 then (case s
      when 'wan' then array['k3v_top_tee_cwan', 'k3v_bot_shorts_cwan', 'k3v_shoes_sneak_cwan']
      when 'mo' then array['k3_top_hoodie', 'k3_hat_cap', 'k3_mask_mask', 'k3v_top_hoodie_cmo', 'k3v_bot_pants_cmo', 'k3v_shoes_sneak_cmo', 'k3v_hat_cap_cmo', 'k3v_mask_mask_cmo']
      when 'ying' then array['k3_top_wave', 'k3_hat_straw', 'k3v_top_wave_cying', 'k3v_bot_pants_cying', 'k3v_shoes_sneak_cying', 'k3v_hat_straw_cying']
      else array[]::text[] end) || array['k3s_' || s]
    else array[]::text[] end $$;

create or replace function public.collab_status() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); w integer := public._collab_wk(); r public.collab_ev;
begin
  if w < 0 then return jsonb_build_object('wk', w); end if;
  insert into public.collab_ev (uid, wk, base) values (pl.id, w, pl.total) on conflict (uid, wk) do nothing;
  select * into r from public.collab_ev where uid = pl.id and wk = w;
  return jsonb_build_object('wk', w, 'set', public._collab_set(w), 'n', greatest(0, pl.total - r.base), 'claimed', r.claimed,
    'ends', extract(epoch from timestamptz '2026-11-29 00:00:00+08')::bigint + (w + 1) * 604800);
end $$;

create or replace function public.collab_claim(p_tier integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); w integer := public._collab_wk(); r public.collab_ev; need integer; ids text[]; s text;
begin
  if p_tier not between 1 and 4 then raise exception '沒有這個獎勵'; end if;
  need := (array[20, 40, 80, 150])[p_tier]; s := public._collab_set(w);
  select * into pl from public.players where id = pl.id for update;
  select * into r from public.collab_ev where uid = pl.id and wk = w for update;
  if r.uid is null then raise exception '先打開活動頁'; end if;
  if (r.claimed & (1 << p_tier)) <> 0 then return pl; end if;
  if pl.total - r.base < need then raise exception '這週釣到的魚還不夠'; end if;
  ids := public._collab_items(s, p_tier);
  update public.collab_ev set claimed = claimed | (1 << p_tier) where uid = pl.id and wk = w;
  update public.players set owned = coalesce(owned, '{}') || array(select v from unnest(ids) v where not v = any(coalesce(owned, '{}'))), updated_at = now()
    where id = pl.id returning * into pl;
  return pl;
end $$;

-- 聯名套裝不再用金幣買
create or replace function public.k3_set_buy(p_set text) returns public.players language plpgsql security definer set search_path = public as $$
begin raise exception '聯名套裝要參加聯名活動週才拿得到'; end $$;

revoke all on function public.collab_status() from public, anon;
revoke all on function public.collab_claim(integer) from public, anon;
grant execute on function public.collab_status() to authenticated;
grant execute on function public.collab_claim(integer) to authenticated;
grant execute on function public.k3_set_buy(text) to authenticated;
