-- 087 端午划龍舟、中秋烤肉小遊戲（沿用 084 的 fest_games，可以重複執行）
-- 一樣一次 30 金幣、每人每天小遊戲最多贏 600；伺服器照分數和實際玩的時間算獎勵
create or replace function public.fest_game_start(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); gid bigint;
begin
  if p_kind not in ('scoop', 'balloon', 'boat', 'bbq') then raise exception '沒有這個遊戲'; end if;
  if p_kind in ('scoop', 'balloon') and not public._fest_on('night') then raise exception '夜市的時候才能玩（每個月第一個週末晚上）'; end if;
  if p_kind = 'boat' and not public._fest_on('duanwu') then raise exception '端午節的時候才能划龍舟'; end if;
  if p_kind = 'bbq' and not public._fest_on('moon') then raise exception '中秋節的時候才能烤肉'; end if;
  if exists (select 1 from public.fest_games where uid = pl.id and started > now() - interval '3 seconds') then raise exception '太快了，等一下再玩'; end if;
  select * into pl from public.players where id = pl.id for update;
  if pl.coins < 30 then raise exception '金幣不夠（一次 30 金幣）'; end if;
  update public.fest_games set done = true, score = 0 where uid = pl.id and not done;
  update public.players set coins = coins - 30, updated_at = now() where id = pl.id returning * into pl;
  insert into public.fest_games (uid, kind) values (pl.id, p_kind) returning id into gid;
  return jsonb_build_object('id', gid, 'player', to_jsonb(pl));
end $$;

create or replace function public.fest_game_end(p_id bigint, p_score integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); g public.fest_games; secs numeric; sc integer; rw integer; got integer; bowl boolean := false;
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
  return jsonb_build_object('score', sc, 'coins', rw, 'bowl', bowl, 'capped', got + rw >= 600, 'player', to_jsonb(pl));
end $$;


select '划龍舟、烤肉小遊戲設定完成 🐉🍢' as result;
