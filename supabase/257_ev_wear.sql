-- 257 活動限定衣服（作者 11/27：「配衣服，然後活動完成可以得到」「也可以設計新衣服」）
-- 每個活動一件只有這裡拿得到的衣服或帽子：完成那個活動幾次就可以領（商店不賣、不能抽）。
-- 次數全部從原本就有的紀錄算，不改任何原本的函式：
--   mig 魚群洄游＝ev_claims 完成次數；bounty 懸賞魚＝ev_claims 次數；tny 釣魚大賽＝領過前三名獎；boss 全服大魚＝參加過幾場；
--   whale 藍鯨＝釣到過；rumor 傳聞＝釣到過傳說魚；lob 釣蝦場放生＝釣到過那隻龍蝦；fest 節慶＝玩過幾次節慶遊戲。
-- 可以重跑。

-- 衣服清單（手機 K3.EVD、K3.EVH 同一份）
create or replace function public._ev_wear() returns jsonb language sql immutable as $$
  select '{"mig":{"items":["k3_top_hoodie","k3v_top_hoodie_emig"],"need":3},
    "bounty":{"items":["k3_top_vest","k3v_top_vest_ebty"],"need":3},
    "tny":{"items":["k3_top_wave","k3v_top_wave_etny"],"need":1},
    "boss":{"items":["k3v_top_tee_eboss"],"need":3},
    "whale":{"items":["k3v_top_tee_ewhl"],"need":1},
    "rumor":{"items":["k3_hat_bucket"],"need":1},
    "lob":{"items":["k3_hat_beanie"],"need":1},
    "fest":{"items":["k3_hat_band"],"need":5}}'::jsonb $$;

-- 某個人某個活動完成了幾次
create or replace function public._ev_wear_n(p_uid uuid, p_kind text) returns integer language plpgsql stable security definer set search_path = public as $$
declare cnt integer := 0;
begin
  if p_kind = 'mig' then select count(*) into cnt from public.ev_claims where uid = p_uid and kind = 'mig' and done;
  elsif p_kind = 'bounty' then select count(*) into cnt from public.ev_claims where uid = p_uid and kind = 'bounty' and done;
  elsif p_kind = 'tny' then select case when tourney_claim is not null then 1 else 0 end into cnt from public.players where id = p_uid;
  elsif p_kind = 'boss' then select count(*) into cnt from public.boss_pull_log where uid = p_uid and n > 0;
  elsif p_kind = 'whale' then select coalesce((fish_count->>'bluewhale')::int, 0) + coalesce((fish_count->>'bluewhale_albino')::int, 0) into cnt from public.players where id = p_uid;
  elsif p_kind = 'rumor' then select count(*) into cnt from public.rumor_prog where uid = p_uid and caught;
  elsif p_kind = 'lob' then select count(*) into cnt from public.shrimp_events where caught_by = p_uid;
  elsif p_kind = 'fest' then select count(*) into cnt from public.fest_log where uid = p_uid;
  end if;
  return coalesce(cnt, 0);
end $$;

-- 活動頁用：每個活動完成幾次、要幾次、領過沒
create or replace function public.ev_wear_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); w jsonb := public._ev_wear(); k text; o jsonb := '{}'::jsonb; own text[];
begin
  if v_uid is null then return o; end if;
  select coalesce(owned, '{}') into own from public.players where id = v_uid;
  for k in select jsonb_object_keys(w) loop
    o := o || jsonb_build_object(k, jsonb_build_object('n', public._ev_wear_n(v_uid, k), 'need', (w->k->>'need')::int,
      'got', (select bool_and(x = any(own)) from jsonb_array_elements_text(w->k->'items') x)));
  end loop;
  return o;
end $$;

-- 領衣服
create or replace function public.ev_wear_claim(p_kind text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); w jsonb := public._ev_wear()->p_kind; add text[];
begin
  if w is null then raise exception '沒有這個活動'; end if;
  if public._ev_wear_n(pl.id, p_kind) < (w->>'need')::int then raise exception '還沒完成，再加油'; end if;
  select array_agg(x) into add from jsonb_array_elements_text(w->'items') x;
  update public.players set owned = array(select distinct x from unnest(coalesce(owned, '{}') || add) x), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 商店不賣活動限定的設計款（e 開頭）；新的帽子（beanie、bucket、band）本來就不在價目表上，也不賣。其他跟 238 一樣
create or replace function public._k3_price(p_id text) returns integer language plpgsql immutable as $$
declare k text; v text; d text;
begin
  if p_id is null or length(p_id) > 40 then return null; end if;
  if p_id ~ '^k3c_' then return null; end if;   -- 不賣顏色了
  if p_id ~ '^k3v_(top|bot|shoes|hat|mask|ear)_[a-z0-9]+_[a-z][a-z0-9]{0,9}$' then
    k := split_part(p_id, '_', 2); d := split_part(p_id, '_', 4);
    if d ~ '^g[0-9]+$' then return null; end if;   -- 老港限定
    if d ~ '^e[a-z0-9]*$' then return null; end if;   -- 257 活動限定
    return case k when 'top' then 800 when 'bot' then 500 when 'shoes' then 400 else 500 end; end if;
  if p_id !~ '^k3_[a-z]+_[a-z0-9]+$' then return null; end if;
  k := split_part(p_id, '_', 2); v := split_part(p_id, '_', 3);
  if p_id = any(array['k3_hair_long', 'k3_hair_short', 'k3_top_tee', 'k3_bot_shorts', 'k3_bot_pants', 'k3_shoes_sneak', 'k3_hat_none', 'k3_mask_none', 'k3_ear_none']) then return 0; end if;
  if k = 'hair' and v = any(array['short2', 'pony', 'twin', 'bob', 'lowpony', 'bun', 'buzz', 'bowl', 'mid', 'curly', 'braid', 'straight']) then return 600; end if;
  if k = 'top' and v = any(array['hoodie', 'maid', 'rain', 'vest', 'wave', 'hoodup']) then return 800; end if;
  if k = 'bot' then return null; end if;
  if k = 'shoes' and v = 'mary' then return 400; end if;
  if k = 'hat' and v = any(array['cap', 'straw']) then return 500; end if;
  if k = 'mask' and v = 'mask' then return 500; end if;
  if k = 'ear' and v = any(array['pearl', 'star', 'hoop', 'drop']) then return 500; end if;
  return null;
end $$;

do $$ declare f text; begin
  foreach f in array array['_ev_wear()', '_ev_wear_n(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['ev_wear_status()', 'ev_wear_claim(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '活動限定衣服設定完成 🎪' as result;
