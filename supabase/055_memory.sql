-- 潮汐釣魚村：村民的記憶、關係、社交（架構第三階段；可以重複執行）
-- 村民之間：家人、同事、競爭、朋友、好友、不熟、不合。一起聊天、吃飯會改變關係；關係會影響他們想去找誰聊天、要不要避開誰。
-- 村民跟玩家：跟村民說話、送魚給村民會變熟，村民會記得你、叫得出你的名字。
-- 記憶：有重要程度（1～5）。小事 1 天就忘、普通的事 7 天、重要的事（變成好友、吵架、收到很棒的禮物）一直記得；每個村民最多記 60 件，太多就先忘掉最不重要、最舊的。

-- ---- 村民之間的關係 ----
create table if not exists public.npc_rel (
  a      text not null references public.npcs(id),
  b      text not null references public.npcs(id),
  base   text not null default 'none',        -- family 家人 / colleague 同事 / rival 競爭 / none
  score  numeric not null default 0,          -- -100（很不合）～ 100（最好的朋友）
  meets  integer not null default 0,
  last_at timestamptz,
  primary key (a, b),
  check (a < b)
);
alter table public.npc_rel enable row level security;
revoke all on public.npc_rel from anon, authenticated;

-- 一開始的關係：阿福和老港是兄弟；阿綾和阿木是商店街的鄰居（同事）；阿木和老港都愛釣魚，誰也不服誰（競爭）；村長跟大家都還不錯
insert into public.npc_rel (a, b, base, score) values
  ('fu', 'gang', 'family', 55), ('ling', 'mu', 'colleague', 20), ('gang', 'mu', 'rival', -5),
  ('chief', 'fu', 'none', 25), ('chief', 'gang', 'none', 20), ('chief', 'ling', 'none', 20), ('chief', 'mu', 'none', 15),
  ('fu', 'ling', 'none', 5), ('fu', 'mu', 'none', 0), ('gang', 'ling', 'none', 0)
on conflict (a, b) do nothing;

-- ---- 村民跟玩家 ----
create table if not exists public.npc_player (
  npc     text not null references public.npcs(id),
  uid     uuid not null,
  score   numeric not null default 0,         -- 0～100
  talks   integer not null default 0,
  gifts   integer not null default 0,
  talk_day date, talk_n integer not null default 0,
  gift_day date,
  last_at timestamptz,
  primary key (npc, uid)
);
alter table public.npc_player enable row level security;
revoke all on public.npc_player from anon, authenticated;

-- ---- 記憶 ----
create table if not exists public.npc_mem (
  id      bigserial primary key,
  npc     text not null references public.npcs(id),
  at      timestamptz not null default now(),
  kind    text not null,           -- chat / quarrel / friend / bestie / gift / meet / weather
  about   text,                    -- 另一個村民的 id，或玩家的 uid
  imp     smallint not null check (imp between 1 and 5),
  txt     text not null,
  n       integer not null default 1,  -- 同一天同一件事合併起來算幾次
  forget_at timestamptz
);
create index if not exists npc_mem_npc on public.npc_mem (npc, at desc);
alter table public.npc_mem enable row level security;
revoke all on public.npc_mem from anon, authenticated;

create or replace function public._rel_label(base text, score numeric) returns text language sql immutable as $$
  select case
    when base = 'family' then '家人'
    when base = 'rival' and score < 40 then '競爭對手'
    when score >= 70 then '好友'
    when score >= 30 then case when base = 'colleague' then '同事・朋友' else '朋友' end
    when score <= -30 then '不合'
    when base = 'colleague' then '同事'
    when base = 'rival' then '競爭對手'
    else '不熟' end $$;

-- 記一件事（同一天、同一種、同一個對象的小事合併成一筆）
create or replace function public._remember(p_npc text, p_at timestamptz, p_kind text, p_about text, p_imp int, p_txt text) returns void language plpgsql security definer set search_path = public as $$
declare m public.npc_mem;
begin
  if p_imp <= 2 then
    select * into m from public.npc_mem where npc = p_npc and kind = p_kind and about is not distinct from p_about and at > p_at - interval '1 day' order by at desc limit 1;
    if m.id is not null then update public.npc_mem set n = n + 1, at = p_at, txt = p_txt where id = m.id; return; end if;
  end if;
  insert into public.npc_mem (npc, at, kind, about, imp, txt, forget_at)
    values (p_npc, p_at, p_kind, p_about, p_imp, p_txt, case when p_imp <= 1 then p_at + interval '1 day' when p_imp <= 3 then p_at + interval '7 days' else null end);
end $$;
revoke all on function public._remember(text, timestamptz, text, text, int, text) from public, anon, authenticated;

-- 整理記憶：忘掉過期的；每人最多 60 件，留重要的、新的
create or replace function public._mem_tidy() returns void language sql security definer set search_path = public as $$
  delete from public.npc_mem where forget_at < now();
  delete from public.npc_mem m using (select id, row_number() over (partition by npc order by imp desc, at desc) rn from public.npc_mem) r where m.id = r.id and r.rn > 60;
$$;
revoke all on function public._mem_tidy() from public, anon, authenticated;

create or replace function public._rel_get(x text, y text) returns public.npc_rel language sql stable security definer set search_path = public as $$
  select * from public.npc_rel where a = least(x, y) and b = greatest(x, y) $$;

-- 兩個村民在同一個地方遇到：聊天、吵架、變熟
create or replace function public._npc_meet(x text, y text, p_place text, p_at timestamptz) returns void language plpgsql security definer set search_path = public as $$
declare r public.npc_rel; nx public.npcs; ny public.npcs; d numeric; before text; after text; pl text; nmx text; nmy text;
begin
  select * into r from public.npc_rel where a = least(x, y) and b = greatest(x, y) for update;
  if r.a is null then insert into public.npc_rel (a, b) values (least(x, y), greatest(x, y)) returning * into r; end if;
  if r.last_at is not null and r.last_at > p_at - interval '20 minutes' then return; end if;   -- 剛剛才聊過
  select * into nx from public.npcs where id = x; select * into ny from public.npcs where id = y;
  select name into pl from public.npc_places where id = p_place;
  nmx := split_part(nx.name, ' ', array_length(string_to_array(nx.name, ' '), 1)); nmy := split_part(ny.name, ' ', array_length(string_to_array(ny.name, ' '), 1));
  -- 合不合得來：兩個人都愛聊天比較容易變熟；競爭對手容易鬥嘴
  -- 越熟越難再加（最好的朋友要很久才當得上）；個性差很多的人比較容易吵
  d := (0.6 + ((nx.traits->>'social')::numeric + (ny.traits->>'social')::numeric) * 0.8 + (random() - 0.3) * 4.5 - abs((nx.traits->>'diligent')::numeric - (ny.traits->>'diligent')::numeric) * 1.5);
  if d > 0 then d := d * (1 - greatest(0, r.score) / 115); end if;
  if r.base = 'rival' then d := d - 1.5 + (random() - 0.5) * 4; end if;
  if r.score < -30 then d := d - 2; end if;
  before := public._rel_label(r.base, r.score);
  update public.npc_rel set score = least(100, greatest(-100, score + d)), meets = meets + 1, last_at = p_at where a = r.a and b = r.b returning * into r;
  after := public._rel_label(r.base, r.score);
  if d < -2 then
    perform public._remember(x, p_at, 'quarrel', y, 3, '在' || pl || '跟' || nmy || '吵了一架');
    perform public._remember(y, p_at, 'quarrel', x, 3, '在' || pl || '跟' || nmx || '吵了一架');
  else
    perform public._remember(x, p_at, 'chat', y, 1, '在' || pl || '跟' || nmy || '聊天');
    perform public._remember(y, p_at, 'chat', x, 1, '在' || pl || '跟' || nmx || '聊天');
  end if;
  if after <> before and after in ('朋友', '同事・朋友', '好友') then
    perform public._remember(x, p_at, case when after = '好友' then 'bestie' else 'friend' end, y, case when after = '好友' then 5 else 4 end, '跟' || nmy || '變成' || after || '了');
    perform public._remember(y, p_at, case when after = '好友' then 'bestie' else 'friend' end, x, case when after = '好友' then 5 else 4 end, '跟' || nmx || '變成' || after || '了');
  elsif after <> before and after = '不合' then
    perform public._remember(x, p_at, 'fallout', y, 4, '跟' || nmy || '鬧翻了');
    perform public._remember(y, p_at, 'fallout', x, 4, '跟' || nmx || '鬧翻了');
  end if;
end $$;
revoke all on function public._npc_meet(text, text, text, timestamptz) from public, anon, authenticated;

-- 決定要做什麼（第二階段的版本 + 關係）：想聊天的時候去找最要好的人，避開不合的人
create or replace function public._chat_dest(n public.npcs, wet boolean) returns text language plpgsql volatile security definer set search_path = public as $$
declare dest text;
begin
  select o.place into dest from public.npcs o join public.npc_places p on p.id = o.place left join public.npc_rel r on r.a = least(n.id, o.id) and r.b = greatest(n.id, o.id)
    where o.id <> n.id and o.act in ('chat', 'eat') and p.kind in ('social', 'food')
      and not exists (select 1 from public.npcs z join public.npc_rel zr on zr.a = least(n.id, z.id) and zr.b = greatest(n.id, z.id) where z.place = o.place and z.id <> n.id and zr.score <= -30)
    order by coalesce(r.score, 0) + random() * 30 desc limit 1;
  return coalesce(dest, case when wet then 'pavilion' else (array['plaza', 'pavilion'])[1 + floor(random() * 2)::int] end);
end $$;
revoke all on function public._chat_dest(public.npcs, boolean) from public, anon, authenticated;

-- 把第二階段的決定換成會看關係的版本：只改「想聊天要去哪裡」這一段
do $$ declare src text; begin
  select pg_get_functiondef('public._npc_decide(public.npcs, timestamptz, text)'::regprocedure) into src;
  if position('_chat_dest' in src) = 0 then
    src := regexp_replace(src, 'select o\.place into social_at from public\.npcs o join public\.npc_places p on p\.id = o\.place\s+where o\.id <> n\.id and o\.act in \(''chat'', ''eat''\) and p\.kind in \(''social'', ''food''\) order by random\(\) limit 1;\s+dest := coalesce\(social_at, case when wet then ''pavilion'' else \(array\[''plaza'', ''pavilion''\]\)\[1 \+ floor\(random\(\) \* 2\)::int\] end\);',
      'dest := public._chat_dest(n, wet);');
    if position('_chat_dest' in src) = 0 then raise exception '找不到要換的地方'; end if;
    execute src;
  end if;
end $$;

-- 推進世界之後：在同一個地方聊天、吃飯的村民會互相交流；整理記憶
create or replace function public._world_social() returns void language plpgsql security definer set search_path = public as $$
declare x public.npcs; y public.npcs;
begin
  for x in select * from public.npcs where act in ('chat', 'eat') and arr_at <= now() loop
    for y in select * from public.npcs where id > x.id and place = x.place and act in ('chat', 'eat') and arr_at <= now() loop
      perform public._npc_meet(x.id, y.id, x.place, now());
    end loop;
  end loop;
  -- 很久沒見面的人慢慢變得沒那麼熟（家人除外；一天大約少 4 分）
  update public.npc_rel set score = score - sign(score) * least(abs(score), 0.003) where base <> 'family' and (last_at is null or last_at < now() - interval '1 day');
  -- 天氣大變的時候記一筆（暴風雨）
  if public._wx_at(now()) = 'storm' then
    insert into public.npc_mem (npc, at, kind, imp, txt, forget_at)
      select n.id, now(), 'weather', 2, '遇到暴風雨，外面好可怕', now() + interval '7 days' from public.npcs n
      where not exists (select 1 from public.npc_mem m where m.npc = n.id and m.kind = 'weather' and m.at > now() - interval '6 hours');
  end if;
  perform public._mem_tidy();
end $$;
revoke all on function public._world_social() from public, anon, authenticated;

-- 玩家跟村民說話（每個村民每 10 分鐘算一次、每天最多 5 次會加好感）
create or replace function public.npc_talk(p_npc text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.players := public._me(); r public.npc_player; d date := (now() at time zone 'Asia/Taipei')::date; nm text := left(coalesce(nullif(me.nickname, ''), '一位釣客'), 16);
begin
  if not exists (select 1 from public.npcs where id = p_npc) then raise exception '沒有這個村民'; end if;
  insert into public.npc_player (npc, uid) values (p_npc, me.id) on conflict do nothing;
  select * into r from public.npc_player where npc = p_npc and uid = me.id for update;
  if r.last_at is null or r.last_at < now() - interval '10 minutes' then
    if r.talk_day is distinct from d then r.talk_day := d; r.talk_n := 0; end if;
    if r.talk_n < 5 then r.score := least(100, r.score + 2); r.talk_n := r.talk_n + 1; end if;
    r.talks := r.talks + 1;
    if r.talks = 1 then perform public._remember(p_npc, now(), 'meet', me.id::text, 3, '第一次跟' || nm || '說話'); end if;
    if r.talks in (10, 50, 100) then perform public._remember(p_npc, now(), 'meet', me.id::text, 4, '已經跟' || nm || '聊過 ' || r.talks || ' 次了'); end if;
    update public.npc_player set score = r.score, talks = r.talks, talk_day = r.talk_day, talk_n = r.talk_n, last_at = now() where npc = p_npc and uid = me.id;
  end if;
  return jsonb_build_object('npc', p_npc, 'score', round(r.score), 'talks', r.talks, 'gifts', r.gifts);
end $$;

-- 送一條魚給村民（每個村民每天收一條；要野生、沒收藏、沒展示）
create or replace function public.npc_gift(p_npc text, p_t bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r public.npc_player; e jsonb; sp public.fish_species; d date := (now() at time zone 'Asia/Taipei')::date; add numeric; nm text := left(coalesce(nullif(pl.nickname, ''), '一位釣客'), 16);
begin
  if not exists (select 1 from public.npcs where id = p_npc) then raise exception '沒有這個村民'; end if;
  insert into public.npc_player (npc, uid) values (p_npc, pl.id) on conflict do nothing;
  select * into r from public.npc_player where npc = p_npc and uid = pl.id for update;
  if r.gift_day = d then raise exception '今天已經送過他禮物了，明天再來'; end if;
  select x into e from jsonb_array_elements(pl.tank) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '魚缸裡沒有這條魚'; end if;
  if e ? 'fm' or e ? 'y' or e ? 'rs' or e ? 'k' or pl.show @> jsonb_build_array(e->'t') then raise exception '要送野生的魚（收藏或展示中的魚要先取消）'; end if;
  select * into sp from public.fish_species where id = e->>'f';
  add := 6 + case sp.rarity when '稀有' then 6 when '史詩' then 10 when '傳說' then 16 else 0 end;
  update public.players set tank = (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality t(x, i) where (x->>'t')::bigint <> p_t), updated_at = now()
    where id = pl.id returning * into pl;
  update public.npc_player set score = least(100, score + add), gifts = gifts + 1, gift_day = d, last_at = now() where npc = p_npc and uid = pl.id;
  perform public._remember(p_npc, now(), 'gift', pl.id::text, case when add >= 16 then 5 when add >= 12 then 4 else 3 end, nm || '送了我一條' || coalesce(sp.name, '魚') || '（' || round((e->>'w')::numeric, 2) || 'kg）');
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['npc_talk(text)', 'npc_gift(text, bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 手機讀的：第二階段的資料 + 村民之間的關係、每個人最近記得的事、這個玩家跟每個村民有多熟
create or replace function public.npc_world() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.world_clock; uid uuid := auth.uid();
begin
  select * into c from public.world_clock where id = 1;
  if c.last_tick < now() - interval '90 seconds' then perform public._world_tick(); perform public._world_social(); end if;
  return jsonb_build_object(
    'now', now(),
    'places', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'x', p.x, 'z', p.z, 'r', p.r, 'fishDir', p.fish_dir, 'solo', p.solo)) from public.npc_places p),
    'npcs', (select jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name, 'act', n.act, 'place', n.place, 'from', n.from_place, 'dep', n.dep_at, 'arr', n.arr_at, 'until', n.until_at,
               'hunger', round(n.hunger), 'energy', round(n.energy), 'social', round(n.social), 'fun', round(n.fun))) from public.npcs n),
    'log', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (select jsonb_build_object('npc', l.npc, 'at', l.at, 'act', l.act, 'place', l.place, 'why', l.why) x from public.npc_log l where l.at <= now() order by l.at desc limit 20) q),
    'rel', (select coalesce(jsonb_agg(jsonb_build_object('a', r.a, 'b', r.b, 'score', round(r.score), 'label', public._rel_label(r.base, r.score))), '[]'::jsonb) from public.npc_rel r),
    'mem', (select coalesce(jsonb_agg(jsonb_build_object('npc', m.npc, 'kind', m.kind, 'about', case when m.about ~ '^[0-9a-f-]{36}$' then case when m.about = uid::text then 'me' else 'player' end else m.about end, 'imp', m.imp, 'txt', m.txt, 'n', m.n, 'at', m.at)), '[]'::jsonb)
            from (select *, row_number() over (partition by npc order by imp desc, at desc) rn from public.npc_mem where imp >= 2 or about = uid::text) m where m.rn <= 6 or m.about = uid::text),
    'me', (select coalesce(jsonb_object_agg(p.npc, jsonb_build_object('score', round(p.score), 'talks', p.talks, 'gifts', p.gifts, 'giftToday', p.gift_day = (now() at time zone 'Asia/Taipei')::date)), '{}'::jsonb) from public.npc_player p where p.uid = auth.uid()));
end $$;
revoke all on function public.npc_world() from public, anon;
grant execute on function public.npc_world() to authenticated;

-- 每分鐘：推進世界、村民交流、整理記憶
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-world-tick', '* * * * *', 'select public._world_tick(); select public._world_social();');
  end if;
end $$;

select '村民開始記得事情、交朋友了 🤝' as result;
