-- 潮汐釣魚村：NPC 每日任務（村長、漁夫老王、食堂美雲姨；可以重複執行）
-- 任務由伺服器依照日期產生（台灣時間），每天 3 個，交付時由伺服器檢查魚或料理
alter table public.players add column if not exists quest_day  date;
alter table public.players add column if not exists quest_done integer[] not null default '{}';

create or replace function public._qhash(d date, i integer) returns integer language sql immutable as $$
  select abs(('x' || substr(md5(d::text || ':q' || i), 1, 7))::bit(28)::int) $$;

create or replace function public._quests(d date)
returns table(i integer, kind text, who text, target text, n integer, minw numeric, reward integer) language plpgsql stable as $$
declare commons text[] := array['mackerel','perch','crucian','kuhua','ayu','tilapia','bonito','bass','squid','flounder','ika','scorpion','loach','goldfish'];
        rares   text[] := array['moonbream','catfish','eel','carp','puffer','cuttle','salmon','barracuda','snakehead','goby','manta','lantern','octopus','jelly'];
        dishes  text[] := array['saba','ayu','suzuki','tako','ikayaki','sanbei','tilapia','mori','sumi','unadon','fugu'];
        h integer; f text; sp public.fish_species; v integer;
begin
  h := public._qhash(d, 0); f := commons[1 + h % array_length(commons, 1)];
  i := 0; kind := 'fish'; who := 'chief'; target := f; n := 2 + (h / 7) % 3; minw := 0; reward := 45 * n; return next;
  h := public._qhash(d, 1); f := rares[1 + h % array_length(rares, 1)]; select * into sp from public.fish_species where id = f;
  i := 1; kind := 'fish'; who := 'wang'; target := f; n := 1; minw := round(sp.min_w + (sp.max_w - sp.min_w) * 0.45, 2); reward := 260; return next;
  h := public._qhash(d, 2); f := dishes[1 + h % array_length(dishes, 1)]; select r.value into v from public._recipe(f) r;
  i := 2; kind := 'dish'; who := 'mei'; target := f; n := 1 + (h / 11) % 2; minw := 0; reward := round(v * 2 * (1 + (h / 11) % 2)); return next;
end $$;

-- 今天的任務＋自己完成了哪些
create or replace function public.get_quests() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date;
begin
  return (select jsonb_agg(jsonb_build_object('i', q.i, 'kind', q.kind, 'who', q.who, 'target', q.target, 'n', q.n, 'minw', q.minw, 'reward', q.reward,
            'done', pl.quest_day = d and q.i = any(pl.quest_done)) order by q.i) from public._quests(d) q);
end $$;

-- 交任務：p_ts 是要交出去的魚（魚缸的 t）或料理（料理的 t）
create or replace function public.complete_quest(p_idx integer, p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; q record; ok integer;
begin
  select * into q from public._quests(d) x where x.i = p_idx;
  if not found then raise exception '沒有這個任務'; end if;
  if pl.quest_day = d and p_idx = any(pl.quest_done) then raise exception '這個任務今天已經完成了'; end if;
  if coalesce(array_length(p_ts, 1), 0) <> q.n or (select count(distinct x) from unnest(p_ts) x) <> q.n then raise exception '交的東西不對'; end if;
  if q.kind = 'fish' then
    select count(*) into ok from jsonb_array_elements(pl.tank) e
      where (e->>'t')::bigint = any(p_ts) and e->>'f' = q.target and (e->>'w')::numeric >= q.minw and not (pl.show @> jsonb_build_array(e->'t'));
    if ok <> q.n then raise exception '交的東西不對'; end if;
    update public.players set tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where not ((e->>'t')::bigint = any(p_ts))) where id = pl.id;
  else
    select count(*) into ok from jsonb_array_elements(pl.dishes) e where (e->>'t')::bigint = any(p_ts) and e->>'r' = q.target;
    if ok <> q.n then raise exception '交的東西不對'; end if;
    update public.players set dishes = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(dishes) with ordinality x(e, i) where not ((e->>'t')::bigint = any(p_ts))) where id = pl.id;
  end if;
  update public.players set coins = coins + q.reward, earned = earned + q.reward,
    quest_done = case when quest_day = d then array_append(quest_done, p_idx) else array[p_idx] end, quest_day = d, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['get_quests()', 'complete_quest(integer,bigint[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select 'NPC 任務設定完成 📜' as result;
