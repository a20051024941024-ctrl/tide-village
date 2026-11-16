-- 176 ⚔️ 對決時間到以後多給 12 秒「把手上這條拉上來」（v524，作者 11/17：「時間到了不要馬上跳出來，不然就是等最後一條釣上來再跳出來」）
-- 時間到的那一刻如果魚還在線上，12 秒內拉上來的還是算；結算也等這 12 秒過了才做。兩邊都一樣，所以公平。可以重複執行。

create or replace function public._duel_on_catch() returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric := coalesce(new.last_w, 0); f text := new.last_fish; item jsonb;
begin
  if f is null or w <= 0 then return new; end if;
  if (public._fishcfg()->'spots'->'shrimp'->'fish') ? f then return new; end if;   -- 釣蝦場的蝦不算
  item := jsonb_build_array(jsonb_build_object('f', f, 'w', w));
  update public.duels set a_w = a_w + w, a_n = a_n + 1, a_log = case when jsonb_array_length(a_log) < 60 then a_log || item else a_log end
    where a = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds';
  update public.duels set b_w = b_w + w, b_n = b_n + 1, b_log = case when jsonb_array_length(b_log) < 60 then b_log || item else b_log end
    where b = new.id and status = 'active' and now() >= start_at and now() < end_at + interval '12 seconds';
  return new;
exception when others then return new;   -- 對決記分出任何問題都不能害玩家釣不到魚
end $$;

create or replace function public._duel_settle(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare d public.duels; day0 timestamptz; n int; w uuid; l uuid; ws int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or d.status <> 'active' or now() < d.end_at + interval '12 seconds' then return; end if;
  w := case when d.a_w > d.b_w then d.a when d.b_w > d.a_w then d.b else null end;
  l := case when w is null then null when w = d.a then d.b else d.a end;
  day0 := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  select count(*) into n from public.duels x where x.status = 'done' and x.counted and x.end_at >= day0 and ((x.a = d.a and x.b = d.b) or (x.a = d.b and x.b = d.a));
  if not d.ranked then   -- 友誼賽：只記結果，不算戰績、不算星星
    update public.duels set status = 'done', winner = w, counted = false where id = d.id; return;
  end if;
  update public.duels set status = 'done', winner = w, counted = (n < 3) where id = d.id;
  if n >= 3 then return; end if;
  insert into public.duel_stats (uid) values (d.a), (d.b) on conflict (uid) do nothing;
  if w is null then
    update public.duel_stats set draws = draws + 1, updated_at = now() where uid in (d.a, d.b);
  else
    select streak into ws from public.duel_stats where uid = w;
    update public.duel_stats set wins = wins + 1, streak = streak + 1, best_streak = greatest(best_streak, streak + 1),
      stars = stars + 1 + (case when coalesce(ws, 0) + 1 >= 3 then 1 else 0 end), updated_at = now() where uid = w;
    update public.duel_stats set losses = losses + 1, streak = 0, stars = case when stars <= 3 then stars else stars - 1 end, updated_at = now() where uid = l;
  end if;
end $$;

create or replace function public._duel_busy(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duels d where (d.a = p_uid or d.b = p_uid)
    and ((d.status = 'invited' and d.created_at > now() - interval '25 seconds') or (d.status = 'active' and d.end_at + interval '12 seconds' > now()))) $$;
