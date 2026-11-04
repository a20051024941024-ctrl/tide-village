-- 潮汐釣魚村：阿報的《潮汐村報》（可以重複執行）
-- 每天早上 7 點（台灣時間）出一份報紙，報導昨天村子裡發生的事：最厲害的漁獲、釣最多的人、稀有魚、阿福收了什麼、村民的八卦、新作品、今天的天氣。
-- 報紙放在廣場的阿報那裡，留最近 7 天。上報的玩家名字是金色的。全部用伺服器真正的紀錄寫，不會亂編。

-- ---- 昨天的紀錄：每個人釣了幾條、稀有或很大的魚 ----
create table if not exists public.news_daily (day date not null, uid uuid not null, nick text not null, n integer not null default 0, primary key (day, uid));
create table if not exists public.news_catch (id bigserial primary key, day date not null, uid uuid not null, nick text not null, fish text not null, w numeric not null, rarity text not null, at timestamptz not null default now());
create index if not exists news_catch_day on public.news_catch (day);
create table if not exists public.news (day date primary key, made_at timestamptz not null default now(), body jsonb not null, featured uuid[] not null default '{}');
alter table public.news_daily enable row level security; alter table public.news_catch enable row level security; alter table public.news enable row level security;
revoke all on public.news_daily from anon, authenticated; revoke all on public.news_catch from anon, authenticated; revoke all on public.news from anon, authenticated;

create or replace function public._tw_day(t timestamptz) returns date language sql immutable as $$ select (t at time zone 'Asia/Taipei')::date $$;

-- 釣到魚的時候（record_catch 把 total + 1、cast_fish 清掉的那一下）記一筆
create or replace function public._news_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare sp public.fish_species; d date := public._tw_day(now()); nm text := left(coalesce(nullif(new.nickname, ''), '一位釣客'), 16);
begin
  if new.total = old.total + 1 and old.cast_fish is not null and new.cast_fish is null then
    insert into public.news_daily (day, uid, nick, n) values (d, new.id, nm, 1) on conflict (day, uid) do update set n = public.news_daily.n + 1, nick = excluded.nick;
    select * into sp from public.fish_species where id = old.cast_fish;
    if sp.id is not null and (sp.rarity <> '常見' or old.cast_w >= sp.max_w * 0.9) then
      insert into public.news_catch (day, uid, nick, fish, w, rarity) values (d, new.id, nm, sp.id, old.cast_w, sp.rarity);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists news_trg on public.players;
create trigger news_trg after update of total on public.players for each row when (new.total is distinct from old.total) execute function public._news_trg();

-- 寫一份報紙（p_day = 出報的那天；報導的是前一天）
create or replace function public._news_make(p_day date) returns public.news language plpgsql security definer set search_path = public as $$
declare y date := p_day - 1; items jsonb := '[]'::jsonb; feat uuid[] := '{}'; r record; t text; nm text; cnt int; tot int; w jsonb; ms bigint; wx text := ''; paper public.news;
  wxname jsonb := '{"sunny":"晴天","cloudy":"多雲","rain":"下雨","fog":"起霧","storm":"暴風雨"}';
begin
  select * into paper from public.news where day = p_day; if paper.day is not null then return paper; end if;
  -- 頭條：昨天最厲害的一條（傳說 > 史詩 > 稀有，同等級比重量）
  select c.*, s.name fname into r from public.news_catch c join public.fish_species s on s.id = c.fish where c.day = y
    order by case c.rarity when '傳說' then 0 when '史詩' then 1 when '稀有' then 2 else 3 end, c.w desc limit 1;
  if r.id is not null then
    items := items || jsonb_build_object('k', 'head', 'title', '📰 頭條', 'text', r.nick || ' 昨天釣到了' || r.rarity || '的「' || r.fname || '」' || round(r.w, 2) || ' 公斤！全村都在討論', 'names', jsonb_build_array(r.nick));
    feat := array_append(feat, r.uid);
  else
    items := items || jsonb_build_object('k', 'head', 'title', '📰 頭條', 'text', '昨天的海很平靜，沒有人釣到稀有的魚。今天會是誰呢？', 'names', '[]'::jsonb);
  end if;
  -- 昨天釣最多的人
  select * into r from public.news_daily where day = y order by n desc, uid limit 1;
  if r.uid is not null and r.n >= 5 then
    items := items || jsonb_build_object('k', 'king', 'title', '🎣 昨天的釣魚王', 'text', r.nick || ' 一天就釣了 ' || r.n || ' 條魚，手都不會痠嗎？', 'names', jsonb_build_array(r.nick));
    feat := array_append(feat, r.uid);
  end if;
  -- 其他稀有漁獲（最多 4 條，不重複人）
  t := ''; cnt := 0;
  for r in select distinct on (c.uid) c.*, s.name fname from public.news_catch c join public.fish_species s on s.id = c.fish where c.day = y and c.rarity <> '常見'
           order by c.uid, case c.rarity when '傳說' then 0 when '史詩' then 1 else 2 end, c.w desc loop
    exit when cnt >= 5;
    if not (r.uid = any(feat)) then t := t || case when cnt > 0 then '、' else '' end || r.nick || '（' || r.fname || ' ' || round(r.w, 2) || 'kg）'; feat := array_append(feat, r.uid); nm := coalesce(nm, '') || r.nick || '|'; cnt := cnt + 1; end if;
  end loop;
  if cnt > 0 then items := items || jsonb_build_object('k', 'rare', 'title', '💎 稀有漁獲', 'text', '昨天還有這些人釣到稀有的魚：' || t, 'names', to_jsonb(string_to_array(rtrim(nm, '|'), '|'))); end if;
  -- 全村一共釣了幾條
  select coalesce(sum(n), 0), count(*) into tot, cnt from public.news_daily where day = y;
  if tot > 0 then items := items || jsonb_build_object('k', 'total', 'title', '📊 村子的數字', 'text', '昨天有 ' || cnt || ' 位釣客，一共釣了 ' || tot || ' 條魚。', 'names', '[]'::jsonb); end if;
  -- 阿福昨天收最多的魚
  select l.*, s.name fname into r from public.fu_log l join public.fish_species s on s.id = l.fish where l.day = y order by l.n desc limit 1;
  if r.fish is not null then items := items || jsonb_build_object('k', 'fu', 'title', '🐟 阿福海產店', 'text', '阿福說昨天收最多的是「' || r.fname || '」，一共 ' || r.n || ' 條。今天的收購單早上 6 點就貼出來了。', 'names', '[]'::jsonb); end if;
  -- 村民的八卦（昨天村民記得的重要的事）
  t := '';
  for r in select distinct on (m.npc) m.npc, m.txt, n.name from public.npc_mem m join public.npcs n on n.id = m.npc
           where public._tw_day(m.at) = y and m.imp >= 3 and m.kind in ('friend', 'bestie', 'quarrel', 'fallout') order by m.npc, m.imp desc limit 3 loop
    t := t || case when t <> '' then '；' else '' end || split_part(r.name, ' ', array_length(string_to_array(r.name, ' '), 1)) || r.txt;
  end loop;
  if t <> '' then items := items || jsonb_build_object('k', 'gossip', 'title', '🗣️ 村民八卦', 'text', '聽說' || t || '。', 'names', '[]'::jsonb); end if;
  -- 新作品
  select count(*) into cnt from public.designs where owner = public._ling_id() and public._tw_day(created_at) = y;
  select count(*) into tot from public.furn_designs where public._tw_day(created_at) = y;
  if cnt + tot > 0 then items := items || jsonb_build_object('k', 'new', 'title', '🆕 商店街新貨', 'text', '阿綾昨天設計了 ' || cnt || ' 件新衣服，阿木做了 ' || tot || ' 件新家具，都在商店街。', 'names', '[]'::jsonb); end if;
  -- 老港這週的手作
  select g.*, d.name dname into r from public.gang_weekly g join public.designs d on d.id = g.design_id where g.week = public._gang_week();
  if r.week is not null then items := items || jsonb_build_object('k', 'gang', 'title', '⚓ 老港的手作', 'text', '這週的「' || r.dname || '」' || case when r.sold >= r.stock then '已經賣完了。' else '還剩 ' || (r.stock - r.sold) || ' 件，去港口碼頭找老港。' end, 'names', '[]'::jsonb); end if;
  -- 今天的天氣（跟遊戲裡同一套）
  foreach cnt in array array[9, 13, 18, 21] loop
    ms := (extract(epoch from (p_day::timestamp + make_interval(hours => cnt)) at time zone 'Asia/Taipei') * 1000)::bigint;
    wx := wx || case when wx <> '' then '、' else '' end || cnt || ' 點' || coalesce(wxname->>(public._weather(ms)->>'k'), '晴天');
  end loop;
  items := items || jsonb_build_object('k', 'wx', 'title', '🌤️ 今天的天氣', 'text', wx || '。', 'names', '[]'::jsonb);
  insert into public.news (day, body, featured) values (p_day, jsonb_build_object('items', items), feat) on conflict (day) do nothing returning * into paper;
  if paper.day is null then select * into paper from public.news where day = p_day; end if;
  -- 上報的人：推播通知（可以在設定關掉「上報」）
  for cnt in 1 .. coalesce(array_length(feat, 1), 0) loop
    perform public._push(feat[cnt], 'news', '📰 你上報了！', '今天的《潮汐村報》有寫到你，去廣場找阿報看看');
  end loop;
  delete from public.news where day < p_day - 6;
  delete from public.news_catch where day < p_day - 8;
  delete from public.news_daily where day < p_day - 8;
  return paper;
end $$;
revoke all on function public._news_make(date) from public, anon, authenticated;

-- 讀報紙：最近 7 天（今天 7 點以前看到的是昨天的）
create or replace function public.get_news() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := public._tw_day(now() - interval '7 hours');
begin
  perform public._news_make(d);
  return (select coalesce(jsonb_agg(jsonb_build_object('day', n.day, 'items', n.body->'items', 'me', auth.uid() = any(n.featured)) order by n.day desc), '[]'::jsonb) from public.news n where n.day > d - 7);
end $$;
revoke all on function public.get_news() from public, anon;
grant execute on function public.get_news() to authenticated;

-- ---- 通知開關多了：阿福每日收購、老港每週手作、上報、被阿彩畫 ----
create or replace function public.set_push_prefs(p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  update public.push_subs set prefs = (select coalesce(jsonb_object_agg(k, to_jsonb((p->>k)::boolean)), '{}'::jsonb) from unnest(array['rs','tourney','cage','design','visit','fu','gang','news','cai']) k where p ? k) where uid = auth.uid();
  return true;
end $$;
revoke all on function public.set_push_prefs(jsonb) from public, anon;
grant execute on function public.set_push_prefs(jsonb) to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-push-fu', '5 22 * * *', $c$select public._push(null, 'fu', '🐟 阿福的今日收購出來了', '今天有高價收的魚和委託，名額有限，快去碼頭邊的海產店')$c$);
    perform cron.schedule('tide-gang-weekly', '5 1 * * 1', $c$select public._gang_make(public._gang_week()); select public._push(null, 'gang', '⚓ 老港這週的手作做好了', '全村只有 5 件，每人一件，去港口碼頭找老港')$c$);
  end if;
end $$;

-- 每天台灣時間 7:00（UTC 23:00）出報
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-news', '0 23 * * *', 'select public._news_make(public._tw_day(now()))');
  end if;
end $$;

select '潮汐村報創刊了 📰' as result;
