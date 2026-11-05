-- 084 夜市小遊戲：🐟 撈金魚、🎈 射氣球（只有夜市的時候能玩）
-- 可以重複執行。每玩一次 30 金幣；獎勵由伺服器照分數和實際玩的時間算，有上限：
--   撈金魚：分數（金魚 1 分、黑金魚 2 分）最多 20、而且不能比玩的秒數多；每分 6 金幣；一次撈到 8 分以上送「金魚缸」家具（fe_goldbowl，只送一次）
--   射氣球：10 發，打中 10 顆 150、8 顆以上 70、5 顆以上 35、其他 10；每一發至少要 0.4 秒
--   每人每天小遊戲最多拿 600 金幣；同一時間只能有一局，每局 3 分鐘內要結束
create table if not exists public.fest_games (
  id bigserial primary key, uid uuid not null, kind text not null, started timestamptz not null default now(),
  done boolean not null default false, score integer, reward integer not null default 0, day date not null default (now() at time zone 'Asia/Taipei')::date);
create index if not exists fest_games_uid on public.fest_games (uid, day);
alter table public.fest_games enable row level security;
revoke all on public.fest_games from anon, authenticated;

create or replace function public.fest_game_start(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); gid bigint;
begin
  if p_kind not in ('scoop', 'balloon') then raise exception '沒有這個遊戲'; end if;
  if not public._fest_on('night') then raise exception '夜市的時候才能玩（每個月第一個週末晚上）'; end if;
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
  else
    sc := least(sc, 10, floor(secs / 0.4)::int);
    rw := case when sc >= 10 then 150 when sc >= 8 then 70 when sc >= 5 then 35 else 10 end;
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

do $$ declare f text; begin
  foreach f in array array['fest_game_start(text)', 'fest_game_end(bigint,integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '夜市小遊戲設定完成 🐟🎈' as result;
