-- 213 ⚔️ 排位的獎勵和專屬畫面（v670，作者 11/21：「排位是不是也要有專屬畫面跟獎勵」「每季換新」）。可以重複執行。
-- ・每天第一場排位勝利：亮光餌 ×5（台灣時間，一天一次）。
-- ・每季第一次升到某個段位，馬上送這一季的造型（每季都是新的一套，id 裡有年月）：
--     釣竿好手（3⭐）→ lc_sYYYYMM 賽季釣線；釣魚高手（8⭐）→ rs_sYYYYMM 賽季竿子皮膚；
--     海上名人（15⭐）→ nf_YYYYMM 名牌外框；傳說釣手（25⭐）→ rs_lYYYYMM 會發光的傳說竿子皮膚。
-- ・換季時（_duel_roll）把上一季有打過的人記一個紀念徽章（badges：{s: 季, p: 最高星數}），永久保留。
-- ・duel_hub()：專屬畫面要的全部資料（自己的戰績、這季拿到哪些、徽章、最近 10 場、本季前 20 名和自己的名次）。
-- 獎勵都是用 trigger 掛在 duel_stats 上（星星變多、本季勝場變多時），不用改結算的函式。

alter table public.duel_stats add column if not exists day_win date;
alter table public.duel_stats add column if not exists got text[] not null default '{}';
alter table public.duel_stats add column if not exists badges jsonb not null default '[]'::jsonb;

create or replace function public._duel_tier_n(s integer) returns integer language sql immutable as $$
  select case when s >= 25 then 4 when s >= 15 then 3 when s >= 8 then 2 when s >= 3 then 1 else 0 end $$;
create or replace function public._duel_season_item(p_season text, p_k integer) returns text language sql immutable as $$
  select (array['lc_s', 'rs_s', 'nf_', 'rs_l'])[p_k] || replace(p_season, '-', '') $$;

create or replace function public._duel_reward_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare td date := (now() at time zone 'Asia/Taipei')::date; k int; key text; it text; se text := coalesce(new.season, public._duel_season()); add text[] := '{}';
begin
  -- 每天第一場排位勝利
  if new.s_wins > old.s_wins and new.day_win is distinct from td then
    new.day_win := td;
    update public.players set bait = jsonb_set(coalesce(bait, '{}'::jsonb), '{glow}', to_jsonb(least(999, coalesce((bait ->> 'glow')::integer, 0) + 5))), updated_at = now() where id = new.uid;
  end if;
  -- 這一季第一次升到某段位
  if new.stars > old.stars then
    for k in 1 .. public._duel_tier_n(new.stars) loop
      key := se || ':' || k;
      if not (key = any(new.got)) then new.got := new.got || key; it := public._duel_season_item(se, k); add := add || it; end if;
    end loop;
    if array_length(add, 1) > 0 then
      update public.players set owned = array(select distinct x from unnest(coalesce(owned, '{}') || add) x), updated_at = now() where id = new.uid;
    end if;
  end if;
  return new;
exception when others then return new;   -- 獎勵出問題也不能害對決結算失敗
end $$;
revoke all on function public._duel_reward_trg() from public, anon, authenticated;
drop trigger if exists duel_reward on public.duel_stats;
create trigger duel_reward before update on public.duel_stats for each row when (new.stars > old.stars or new.s_wins > old.s_wins) execute function public._duel_reward_trg();

-- 換季：多記一個紀念徽章
create or replace function public._duel_roll(p_uid uuid) returns void language plpgsql security definer set search_path = public as $$
declare cur text := public._duel_season();
begin
  update public.duel_stats set
      badges = case when s_wins + s_losses > 0 then badges || jsonb_build_array(jsonb_build_object('s', season, 'p', greatest(peak, stars))) else badges end,
      prev_season = season, prev_peak = greatest(peak, stars), stars = stars / 2, peak = stars / 2, s_wins = 0, s_losses = 0, season = cur
    where uid = p_uid and season is distinct from cur and season is not null;
  update public.duel_stats set season = cur, peak = stars where uid = p_uid and season is null;
end $$;
revoke all on function public._duel_roll(uuid) from public, anon, authenticated;

create or replace function public.duel_hub() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.duel_stats; td date := (now() at time zone 'Asia/Taipei')::date; hist jsonb; top jsonb; rk int; se text := public._duel_season();
begin
  if me is null then return null; end if;
  perform public._duel_roll(me);
  select * into s from public.duel_stats where uid = me;
  select coalesce(jsonb_agg(h order by (h->>'id')::bigint desc), '[]'::jsonb) into hist from (
    select jsonb_build_object('id', d.id, 'ranked', d.ranked, 'team', d.team, 'mode', d.mode, 'spot', d.spot, 'at', (extract(epoch from d.end_at) * 1000)::bigint,
      'me_w', case when d.a = me or d.a2 = me then d.a_w else d.b_w end, 'op_w', case when d.a = me or d.a2 = me then d.b_w else d.a_w end,
      'me_n', case when d.a = me or d.a2 = me then d.a_n else d.b_n end, 'op_n', case when d.a = me or d.a2 = me then d.b_n else d.a_n end,
      'me_big', case when d.a = me or d.a2 = me then d.a_big else d.b_big end, 'op_big', case when d.a = me or d.a2 = me then d.b_big else d.a_big end,
      'op', case when d.a = me or d.a2 = me then concat_ws('＋', d.b_name, d.b2_name) else concat_ws('＋', d.a_name, d.a2_name) end,
      'res', case when d.winner is null then 'd' when (d.winner = d.a) = (d.a = me or d.a2 = me) then 'w' else 'l' end) h
    from public.duels d where (d.a = me or d.b = me or d.a2 = me or d.b2 = me) and d.status = 'done' order by d.id desc limit 10) t;
  select coalesce(jsonb_agg(r order by (r->>'stars')::int desc, (r->>'wins')::int desc), '[]'::jsonb) into top from (
    select jsonb_build_object('n', coalesce(nullif(p.nickname, ''), '釣客'), 'stars', x.stars, 'wins', x.s_wins, 'losses', x.s_losses, 'tier', public._duel_tier(x.stars), 'me', x.uid = me) r
    from public.duel_stats x join public.players p on p.id = x.uid where x.season = se and x.s_wins + x.s_losses > 0 order by x.stars desc, x.s_wins desc limit 20) t;
  if s.uid is not null and s.s_wins + s.s_losses > 0 then
    select count(*) + 1 into rk from public.duel_stats x where x.season = se and x.s_wins + x.s_losses > 0 and (x.stars > s.stars or (x.stars = s.stars and x.s_wins > s.s_wins));
  end if;
  return jsonb_build_object('season', se, 'stars', coalesce(s.stars, 0), 'tier', public._duel_tier(coalesce(s.stars, 0)), 'wins', coalesce(s.wins, 0), 'losses', coalesce(s.losses, 0), 'draws', coalesce(s.draws, 0),
    's_wins', coalesce(s.s_wins, 0), 's_losses', coalesce(s.s_losses, 0), 'streak', coalesce(s.streak, 0), 'best', coalesce(s.best_streak, 0), 'peak', coalesce(s.peak, 0),
    'got', to_jsonb(coalesce(s.got, '{}')), 'badges', coalesce(s.badges, '[]'::jsonb), 'day_win', coalesce(s.day_win = td, false),
    'days_left', (date_trunc('month', now() at time zone 'Asia/Taipei') + interval '1 month')::date - td,
    'mode', public._duel_day_mode(), 'spot', case when public._duel_day_mode() = 'spot' then public._duel_day_spot() end,
    'hist', hist, 'top', top, 'rank', rk);
end $$;
revoke all on function public.duel_hub() from public, anon;
grant execute on function public.duel_hub() to authenticated;

-- 資料頁也看得到別人的紀念徽章
create or replace function public.duel_badges(p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select badges from public.duel_stats where uid = p_uid), '[]'::jsonb) $$;
revoke all on function public.duel_badges(uuid) from public, anon;
grant execute on function public.duel_badges(uuid) to authenticated;

select '排位獎勵設定完成 ⚔️' as result;
