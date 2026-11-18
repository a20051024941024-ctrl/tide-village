-- 潮汐釣魚村：蔚博士不再每天「發現」換顏色的新品種，改成每天調查一種真的魚（可以重複執行）
-- 玩家說新品種「只是換顏色而已」。所以：
--   1. 070／074 的 _sci_make 從 2026-11-19 起不再產生新的（那兩個檔案裡加了日期判斷）；已經發現的全部留著，還是住在原來的釣點、圖鑑也還在。
--   2. 蔚博士每天換一個釣點，調查那裡一種「真的魚」（15 個釣點輪一圈，不會連兩天同一個地方）。
--   3. 委託改成：把今天調查的那種魚釣上來、放在魚缸裡給他看 → 夜光蟲餌 ×3，一天一次（獎勵跟以前一樣）。
--   4. 以後真的新魚（有自己的外形和習性）由蔚博士公布，名單寫在手機程式裡（魚本來就要手機程式才畫得出來）。

-- 每個釣點可以被調查的魚：沿用 070 的名單，海邊加上 v557 的四種新魚
create or replace function public._sci_quest_pool() returns jsonb language sql immutable as $$
  select public._sci_pool() || jsonb_build_object('sea', (public._sci_pool()->'sea') || '["whiting","tidegoby","groupie","horseshoe"]'::jsonb) $$;

-- 某一天調查哪個釣點、哪種魚（用日期算，全伺服器一樣）
create or replace function public._sci_quest(p_day date, out spot text, out fish text) language plpgsql immutable as $$
declare spots text[]; pool text[]; h bigint := public._fnv('scq' || p_day::text); n int;
begin
  spots := array(select s from jsonb_object_keys(public._sci_quest_pool()) s order by s); n := cardinality(spots);
  spot := spots[1 + (((p_day - date '2026-01-01') * 4) % n + n) % n];   -- 一次跳 4 格：15 天輪完一圈，不會連兩天同一個地方
  pool := array(select x from jsonb_array_elements_text(public._sci_quest_pool()->spot) x);
  fish := pool[1 + ((h / 64) % cardinality(pool))::int];
end $$;
revoke all on function public._sci_quest(date) from public, anon, authenticated;
revoke all on function public._sci_quest_pool() from public, anon, authenticated;

-- 手機讀的：今天的調查
create or replace function public.sci_quest() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; q record; cnt integer;
begin
  select * into q from public._sci_quest(td);
  select n into cnt from public.bait_gather where uid = pl.id and day = td and kind = 'nightbug';
  return jsonb_build_object('day', td, 'spot', q.spot, 'fish', q.fish, 'done', coalesce(cnt, 0) >= 1);
end $$;
revoke all on function public.sci_quest() from public, anon;
grant execute on function public.sci_quest() to authenticated;

-- 委託：魚缸裡有「今天釣到的、今天調查的那種魚」（變種也算）→ 夜光蟲餌 ×3，一天一次
create or replace function public.sci_bug() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); td date := (now() at time zone 'Asia/Taipei')::date; q record; t0 bigint; cnt integer;
begin
  select * into q from public._sci_quest(td);
  t0 := (extract(epoch from (td::timestamp at time zone 'Asia/Taipei')) * 1000)::bigint;
  if not exists (select 1 from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'f' = q.fish or x->>'f' like q.fish || '\_%') and (x->>'t')::bigint >= t0) then
    raise exception '還沒看到今天要調查的魚喔：先把牠釣上來（要是今天釣的、放在魚缸裡）'; end if;
  select n into cnt from public.bait_gather where uid = pl.id and day = td and kind = 'nightbug';
  if coalesce(cnt, 0) >= 1 then raise exception '今天已經拿過了，明天再來'; end if;
  update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), array['nightbug'], to_jsonb(least(99, coalesce((bait ->> 'nightbug')::integer, 0) + 3))), updated_at = now()
    where id = pl.id returning * into pl;
  insert into public.bait_gather (uid, day, kind, n) values (pl.id, td, 'nightbug', 1) on conflict (uid, day, kind) do update set n = public.bait_gather.n + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'got', 3);
end $$;
revoke all on function public.sci_bug() from public, anon;
grant execute on function public.sci_bug() to authenticated;

select '蔚博士改成調查真的魚 🔬' as result;
