-- 113 鯨魚躍出水面的好運（v282）：在外海親眼看到座頭鯨或藍鯨跳出水面，接下來 3 分鐘在船上釣，稀有魚 ×1.4、傳說魚 ×1.25。
-- 伺服器自己算：外海的鯨魚是用「格子＋20 分鐘時段」算出來的（跟 js/game.js 的 owR／owPlan 一樣），
-- 只有那一格那一段真的排到「會跳出水面」的鯨魚、而且現在正在那段時間裡，才算數。
-- 一個人 30 分鐘最多一次、一天最多 4 次。可以重複執行。
create table if not exists public.sea_breach_claims (uid uuid not null, at timestamptz not null default now(), cx integer not null, cz integer not null, w bigint not null);
create index if not exists sea_breach_claims_uid on public.sea_breach_claims (uid, at desc);
alter table public.sea_breach_claims enable row level security;
revoke all on public.sea_breach_claims from anon, authenticated;

-- 32 位元整數相乘取低 32 位（跟 JS 的 Math.imul 一樣，結果用 0～2^32-1 表示）
create or replace function public._u32mul(a bigint, b bigint) returns bigint language sql immutable as $$
  select ((a * (b & 65535)) + (((a * (b >> 16)) & 65535) << 16)) & 4294967295 $$;
-- 跟 js/game.js 的 owR 一模一樣
create or replace function public._ow_r(a bigint, b bigint, c bigint, k bigint) returns numeric language plpgsql immutable as $$
declare h bigint;
begin
  h := (a * 374761393 + b * 668265263 + c * 2147483647 + k * 1274126177) & 4294967295;
  h := public._u32mul(h # (h >> 13), 1274126177);
  h := h # (h >> 16);
  h := public._u32mul(h, 2246822519);
  h := h # (h >> 13);
  return (h % 100000) / 100000.0;
end $$;

-- 這一格這一段有沒有會跳出水面的鯨魚、在哪段時間（開始秒、結束秒，以這 20 分鐘開頭算）
create or replace function public._ow_breach(p_cx integer, p_cz integer, p_w bigint) returns int[] language plpgsql immutable as $$
declare r numeric := public._ow_r(p_cx, p_cz, p_w, 1); k text; nb integer; na integer; q numeric; dur numeric := 0; br boolean := false; i integer; st numeric;
begin
  -- 機率順序跟 OW_SP 一樣：海豚 .25、座頭鯨 .08、藍鯨 .05、抹香鯨 .04
  if r < 0.25 then return null; elsif r < 0.33 then k := 'humpback'; elsif r < 0.38 then k := 'bluewhale'; else return null; end if;
  if k = 'bluewhale' then
    nb := 3 + floor(public._ow_r(p_cx, p_cz, p_w, 11) * 4); br := public._ow_r(p_cx, p_cz, p_w, 12) < 1.0 / 30;
    dur := 6 + nb * 17 + 14 + (case when br then 6 else 0 end);
  else
    nb := 2 + floor(public._ow_r(p_cx, p_cz, p_w, 11) * 2); na := 2 + floor(public._ow_r(p_cx, p_cz, p_w, 12) * 2); dur := 6 + nb * 12 + 12;
    for i in 0 .. na - 1 loop q := public._ow_r(p_cx, p_cz, p_w, 13 + i);
      if q < 0.4 then br := true; dur := dur + (1 + floor(public._ow_r(p_cx, p_cz, p_w, 18 + i) * 3)) * 6;
      elsif q < 0.7 then dur := dur + (3 + floor(public._ow_r(p_cx, p_cz, p_w, 18 + i) * 6)) * 2 + 4;
      else dur := dur + (4 + floor(public._ow_r(p_cx, p_cz, p_w, 18 + i) * 7)) * 2 + 4; end if;
    end loop;
  end if;
  if not br then return null; end if;
  st := 20 + public._ow_r(p_cx, p_cz, p_w, 19) * (1200 - dur - 40);
  return array[floor(st)::integer, ceil(st + dur)::integer];
end $$;

create or replace function public.sea_breach(p_cx integer, p_cz integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s numeric := extract(epoch from now()); w bigint := floor(s / 1200); u numeric := s - floor(s / 1200) * 1200; win int[]; until timestamptz;
begin
  if v_uid is null then raise exception '要登入才能領'; end if;
  if abs(p_cx) > 3 or abs(p_cz) > 3 then return jsonb_build_object('ok', false); end if;
  win := public._ow_breach(p_cx, p_cz, w);
  if win is null or u < win[1] or u > win[2] + 60 then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.sea_breach_claims where uid = v_uid and at > now() - interval '30 minutes') then
    select at + interval '3 minutes' into until from public.sea_breach_claims where uid = v_uid order by at desc limit 1;
    return jsonb_build_object('ok', false, 'until', until);
  end if;
  if (select count(*) from public.sea_breach_claims where uid = v_uid and at > now() - interval '1 day') >= 4 then return jsonb_build_object('ok', false, 'max', true); end if;
  insert into public.sea_breach_claims (uid, cx, cz, w) values (v_uid, p_cx, p_cz, w);
  return jsonb_build_object('ok', true, 'until', now() + interval '3 minutes');
end $$;
revoke all on function public.sea_breach(integer, integer) from public, anon;
grant execute on function public.sea_breach(integer, integer) to authenticated;

-- roll_fish 用：這個人現在有沒有鯨魚的好運
create or replace function public._breach_luck(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sea_breach_claims where uid = p_uid and at > now() - interval '3 minutes') $$;
revoke all on function public._breach_luck(uuid) from public, anon, authenticated;
