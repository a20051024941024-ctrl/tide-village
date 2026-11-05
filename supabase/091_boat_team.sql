-- 091 划龍舟多人一起划：同一時間（前後 20 秒內開始）一起划的玩家算隊友，每個隊友獎勵 +20%（最多 +60%）；可以重複執行
create or replace function public.fest_game_end(p_id bigint, p_score integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); g public.fest_games; secs numeric; sc integer; rw integer; got integer; bowl boolean := false; team integer := 0;
begin
  select * into g from public.fest_games where id = p_id and uid = pl.id for update;
  if g.id is null or g.done then raise exception '這一局已經結束了'; end if;
  secs := extract(epoch from now() - g.started);
  sc := greatest(0, coalesce(p_score, 0));
  if secs > 180 then sc := 0; end if;
  if g.kind = 'scoop' then
    sc := least(sc, 20, floor(secs)::int);
    rw := sc * 6;
  elsif g.kind = 'balloon' then
    sc := least(sc, 10, floor(secs / 0.4)::int);
    rw := case when sc >= 10 then 150 when sc >= 8 then 70 when sc >= 5 then 35 else 10 end;
  elsif g.kind = 'boat' then   -- 划龍舟：跟著鼓聲划，每划對一下 1 分，最多 60 分、一秒最多 3 下
    sc := least(sc, 60, floor(secs * 3)::int);
    rw := case when sc >= 50 then 160 when sc >= 35 then 90 when sc >= 20 then 45 else 10 end;
    -- 091：同一時間（前後 20 秒內開始）一起划的別的玩家算隊友，一個隊友 +20%，最多 +60%
    select count(distinct uid) into team from public.fest_games where kind = 'boat' and uid <> pl.id and started between g.started - interval '20 seconds' and g.started + interval '20 seconds';
    if sc >= 10 then rw := floor(rw * (1 + least(3, team) * 0.2))::int; end if;
  else   -- 中秋烤肉：烤得剛好的串數，最多 12 串、每串至少要 2.5 秒
    sc := least(sc, 12, floor(secs / 2.5)::int);
    rw := sc * 12;
  end if;
  select coalesce(sum(reward), 0) into got from public.fest_games where uid = pl.id and day = (now() at time zone 'Asia/Taipei')::date;
  rw := greatest(0, least(rw, 600 - got));
  update public.fest_games set done = true, score = sc, reward = rw where id = g.id;
  select * into pl from public.players where id = pl.id for update;
  if g.kind = 'scoop' and sc >= 8 and not ('fe_goldbowl' = any(pl.owned)) then bowl := true; end if;
  update public.players set coins = coins + rw, earned = earned + rw,
    owned = case when bowl then array_append(owned, 'fe_goldbowl') else owned end, updated_at = now()
    where id = pl.id returning * into pl;
  return jsonb_build_object('score', sc, 'coins', rw, 'team', team, 'bowl', bowl, 'capped', got + rw >= 600, 'player', to_jsonb(pl));
end $$;
select '龍舟一起划設定完成 🐉' as result;
