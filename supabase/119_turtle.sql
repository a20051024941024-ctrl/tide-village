-- 潮汐釣魚村 v296：小烏龜（淡水的斑龜）和龜殼光澤度（可以重複執行）
-- 玩家意見：「可以餵牠們蛋黃，殼會比較漂亮；我會幫牠們擦龜油」。遊戲是老少皆宜，所以照真的正確養法設計：
--   曬太陽（晴天，一天一次）效果最好；均衡飲食（飼料、葉菜、小魚，換著吃加成）；蛋黃是點心，一週一次才有效；
--   換水刷殼（一天一次）保持光澤；龜殼保養一個月最多一次（太常塗反而不好）。三天沒照顧光澤慢慢變暗，不會死、不會生病。
-- 光澤度 0～100，全部由伺服器算。光澤度第一次到 100 的隔天早上，《潮汐村報》刊出「本週最美烏龜」（同一隻一週最多一次）。
-- 小海龜（turtle，保育類）維持原樣，不加入養殖。

alter table public.pets drop constraint if exists pets_kind_check;
alter table public.pets add constraint pets_kind_check check (kind in ('cat', 'shiba', 'otter', 'gull', 'crab', 'turtle', 'octopus', 'puffer', 'pondturtle'));

create table if not exists public.pet_turtle (
  pet_id bigint primary key references public.pets(id) on delete cascade,
  owner uuid not null,
  shine integer not null default 40,
  last_sun date, last_feed date, last_food text, last_clean date,
  last_treat timestamptz, last_oil timestamptz,
  last_care timestamptz not null default now(), last_decay timestamptz,
  full_day date
);
create index if not exists pet_turtle_full on public.pet_turtle (full_day);
alter table public.pet_turtle enable row level security;
revoke all on public.pet_turtle from anon, authenticated;

create or replace function public._pet_vars(k text) returns jsonb language sql immutable as $$
  select case k
    when 'cat' then '{"a":30,"b":22,"c":12,"d":12,"e":10,"f":9,"g":5}'
    when 'shiba' then '{"a":50,"b":20,"c":18,"d":12}'
    when 'otter' then '{"a":70,"b":25,"c":5}'
    when 'gull' then '{"a":70,"b":25,"c":5}'
    when 'crab' then '{"a":45,"b":25,"c":20,"d":10}'
    when 'turtle' then '{"a":60,"b":30,"c":10}'
    when 'octopus' then '{"a":55,"b":35,"c":10}'
    when 'puffer' then '{"a":55,"b":35,"c":10}'
    when 'pondturtle' then '{"a":65,"b":28,"c":7}'
  end::jsonb $$;
create or replace function public._pet_price(k text) returns integer language sql immutable as $$
  select case k when 'cat' then 300 when 'shiba' then 2000 when 'otter' then 2500 when 'gull' then 1200 when 'crab' then 800 when 'pondturtle' then 600 end $$;

-- 光澤度：三天沒照顧以後，每多一天 -5（最低 10）。讀的時候順便算進去
create or replace function public._turtle_get(p_pet bigint, p_owner uuid) returns public.pet_turtle language plpgsql security definer set search_path = public as $$
declare t public.pet_turtle; st timestamptz; d integer;
begin
  insert into public.pet_turtle (pet_id, owner) values (p_pet, p_owner) on conflict (pet_id) do update set owner = excluded.owner;
  select * into t from public.pet_turtle where pet_id = p_pet for update;
  st := greatest(t.last_care + interval '3 days', coalesce(t.last_decay, t.last_care));
  if now() > st then d := floor(extract(epoch from now() - st) / 86400)::int;
    if d >= 1 then t.shine := greatest(10, t.shine - 5 * d); t.last_decay := st + make_interval(days => d); update public.pet_turtle set shine = t.shine, last_decay = t.last_decay where pet_id = p_pet; end if; end if;
  return t;
end $$;

create or replace function public._pet_row(p public.pets) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'kind', p.kind, 'var', p.var, 'name', p.name, 'love', p.love, 'acc', public._pet_acc(p.love), 'out', p.out, 'price', p.price, 'caught', p.caught,
    'fed', p.fed_day = (now() at time zone 'Asia/Taipei')::date, 'gift', p.gift_day = (now() at time zone 'Asia/Taipei')::date)
    || case when p.kind = 'pondturtle' then (select jsonb_build_object('shine', t.shine, 'sun', t.last_sun = d, 'feed', t.last_feed = d, 'food', t.last_food, 'clean', t.last_clean = d,
         'treatDays', case when t.last_treat is null then null else floor(extract(epoch from now() - t.last_treat) / 86400)::int end,
         'oilDays', case when t.last_oil is null then null else floor(extract(epoch from now() - t.last_oil) / 86400)::int end)
       from public.pet_turtle t, (select (now() at time zone 'Asia/Taipei')::date d) dd where t.pet_id = p.id) else '{}'::jsonb end $$;
create or replace function public.pet_list() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r record; begin
  for r in select id, owner from public.pets where owner = auth.uid() and kind = 'pondturtle' loop perform public._turtle_get(r.id, r.owner); end loop;
  return (select coalesce(jsonb_agg(public._pet_row(p) order by p.id), '[]'::jsonb) from public.pets p where p.owner = auth.uid());
end $$;

-- 照顧：sun 曬太陽、feed 餵（p_food: pellet 飼料／greens 葉菜／fish 小魚，小魚要給魚缸裡的魚 p_t）、treat 蛋黃、clean 換水刷殼、oil 龜殼保養（🪙120）
create or replace function public.turtle_care(p_id bigint, p_act text, p_food text default null, p_t bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; t public.pet_turtle; td date := (now() at time zone 'Asia/Taipei')::date; add integer := 0; msg text; e jsonb; f jsonb;
begin
  select * into p from public.pets where id = p_id and owner = pl.id;
  if p.id is null or p.kind <> 'pondturtle' then raise exception '找不到這隻小烏龜'; end if;
  if p.price is not null then raise exception '掛在市集賣的寵物不能照顧，先收回來'; end if;
  t := public._turtle_get(p.id, pl.id);
  if p_act = 'sun' then
    if t.last_sun = td then raise exception '今天曬過太陽了，明天再來'; end if;
    if coalesce(public._weather((extract(epoch from now()) * 1000)::bigint)->>'k', 'sunny') <> 'sunny' then raise exception '現在不是晴天，等出太陽再帶牠出來曬'; end if;
    add := 6; t.last_sun := td; msg := '曬太陽讓龜殼長得又硬又亮，這是最有效的照顧';
  elsif p_act = 'feed' then
    if p_food not in ('pellet', 'greens', 'fish') then raise exception '沒有這種食物'; end if;
    if t.last_feed = td then raise exception '今天吃過了，吃太多對烏龜不好，明天再餵'; end if;
    if p_food = 'fish' then
      select * into pl from public.players where id = pl.id for update;
      select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
      if e is null then raise exception '這條魚不在你的魚缸裡'; end if;
      f := public._fishcfg()->'fish'->(e->>'f');
      if coalesce(f->>'r', '常見') <> '常見' or (e->>'w')::numeric > 1.5 or coalesce((e->>'k')::boolean, false) then raise exception '要給一條小小的常見魚（1.5 公斤以下、沒有收藏）'; end if;
      update public.players set tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where (x->>'t')::bigint <> p_t), '[]'::jsonb),
        show = case when show is null then show else coalesce((select jsonb_agg(x) from jsonb_array_elements(show) x where (x #>> '{}') <> p_t::text), '[]'::jsonb) end, updated_at = now()
        where id = pl.id returning * into pl;
    end if;
    add := 3 + case when t.last_food is distinct from p_food then 2 else 0 end; msg := case when t.last_food is distinct from p_food then '換著吃，營養比較均衡' else '每天換不同的食物，效果會更好喔' end;
    t.last_feed := td; t.last_food := p_food;
  elsif p_act = 'treat' then
    if t.last_treat is not null and t.last_treat > now() - interval '20 hours' then raise exception '剛剛才吃過點心'; end if;
    if t.last_treat is null or t.last_treat < now() - interval '6 days 12 hours' then add := 3; msg := '蛋黃是點心，牠吃得好開心！一週一次就好';
    else add := 0; msg := '點心偶爾給就好，太常吃反而沒效喔'; end if;
    t.last_treat := now();
  elsif p_act = 'clean' then
    if t.last_clean = td then raise exception '今天換過水了'; end if;
    add := 1; t.last_clean := td; msg := '水乾淨、殼刷乾淨，光澤就不會掉';
  elsif p_act = 'oil' then
    if t.last_oil is not null and t.last_oil > now() - interval '30 days' then raise exception '一個月最多保養一次，太常塗反而會悶住龜殼'; end if;
    select * into pl from public.players where id = pl.id for update;
    if pl.coins < 120 then raise exception '金幣不夠（龜殼保養 🪙120）'; end if;
    update public.players set coins = coins - 120, updated_at = now() where id = pl.id returning * into pl;
    add := 3; t.last_oil := now(); msg := '偶爾保養就好，太常塗反而不好';
  else raise exception '不知道要怎麼照顧'; end if;
  t.shine := least(100, t.shine + add);
  if t.shine >= 100 and (t.full_day is null or t.full_day < td - 6) then t.full_day := td; end if;
  update public.pet_turtle set shine = t.shine, last_sun = t.last_sun, last_feed = t.last_feed, last_food = t.last_food, last_clean = t.last_clean, last_treat = t.last_treat, last_oil = t.last_oil,
    last_care = case when p_act = 'treat' and add = 0 then last_care else now() end, last_decay = case when p_act = 'treat' and add = 0 then last_decay else null end, full_day = t.full_day where pet_id = p.id;   -- 太常給點心不算照顧
  if p_act in ('feed', 'treat') then update public.pets set love = love + 1 where id = p.id; end if;
  select * into p from public.pets where id = p.id;
  return jsonb_build_object('add', add, 'msg', msg, 'pet', public._pet_row(p), 'player', to_jsonb(pl));
end $$;

-- 河邊、池塘釣魚偶爾撿到被棄養的小烏龜（其他照 081）
create or replace function public.pet_lucky() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); spots text[]; pool text[] := '{}'; k text; v text;
begin
  select * into pl from public.players where id = pl.id for update;
  if pl.last_fish is null or pl.total <= pl.pet_try_n then return jsonb_build_object('got', false); end if;   -- 每釣一條只能試一次
  update public.players set pet_try_n = pl.total where id = pl.id;
  if random() >= 0.012 then return jsonb_build_object('got', false); end if;
  select array_agg(s) into spots from jsonb_object_keys(cfg->'spots') s where cfg->'spots'->s->'fish' ? pl.last_fish;
  if spots && array['sea', 'harbor', 'reef', 'isle'] then pool := pool || array['crab', 'turtle', 'octopus', 'puffer']; end if;
  if spots && array['mangrove', 'mudflat'] then pool := pool || array['crab', 'crab', 'puffer']; end if;
  if spots && array['river', 'creek', 'weir', 'lake', 'canal'] then pool := pool || array['otter', 'pondturtle']; end if;
  if spots && array['lake', 'canal', 'pool'] then pool := pool || array['pondturtle']; end if;
  if coalesce(array_length(pool, 1), 0) = 0 then return jsonb_build_object('got', false); end if;
  k := pool[1 + floor(random() * array_length(pool, 1))::int]; v := public._pet_roll(k);
  if (select count(*) from public.pets where owner = pl.id) >= 3 then return jsonb_build_object('got', true, 'kind', k, 'var', v, 'full', true); end if;
  insert into public.pets (owner, kind, name, var, caught) values (pl.id, k, case k when 'crab' then '寄居蟹' when 'turtle' then '小海龜' when 'octopus' then '小章魚' when 'puffer' then '河豚' when 'pondturtle' then '小烏龜' else '小水獺' end, v, true);
  return jsonb_build_object('got', true, 'kind', k, 'var', v, 'pets', public.pet_list());
end $$;

-- 別人來小島看到的寵物：小烏龜也帶光澤度（殼的樣子）
create or replace function public.isle_pets(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'var', p.var, 'name', p.name, 'acc', public._pet_acc(p.love)) || case when t.pet_id is not null then jsonb_build_object('shine', t.shine) else '{}'::jsonb end order by p.id), '[]'::jsonb)
  from public.pets p left join public.pet_turtle t on t.pet_id = p.id where p.owner = p_owner and not p.out $$;

-- 村報：光澤度到 100 的隔天早上刊出「本週最美烏龜」（出報的時候自動加一則）
create or replace function public._news_turtle() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; names text := ''; arr jsonb := '[]'::jsonb; cnt int := 0;
begin
  for r in select t.owner, p.name pname, left(coalesce(nullif(pl.nickname, ''), '一位釣客'), 16) nick from public.pet_turtle t join public.pets p on p.id = t.pet_id join public.players pl on pl.id = t.owner
           where t.full_day = new.day - 1 order by t.pet_id limit 3 loop
    names := names || case when cnt > 0 then '、' else '' end || r.nick || '的「' || r.pname || '」'; arr := arr || to_jsonb(r.nick); new.featured := array_append(new.featured, r.owner); cnt := cnt + 1;
  end loop;
  if cnt > 0 then new.body := jsonb_set(new.body, '{items}', jsonb_build_array(jsonb_build_object('k', 'turtle', 'title', '🐢 本週最美烏龜', 'text',
      names || '的龜殼亮到會發光！主人說秘訣是每天曬太陽、吃得均衡、水保持乾淨，點心偶爾給就好。', 'names', arr)) || coalesce(new.body->'items', '[]'::jsonb)); end if;
  return new;
end $$;
drop trigger if exists news_turtle on public.news;
create trigger news_turtle before insert on public.news for each row execute function public._news_turtle();

do $$ declare f text; begin
  foreach f in array array['turtle_care(bigint,text,text,bigint)', 'pet_lucky()', 'isle_pets(uuid)', 'pet_list()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public._turtle_get(bigint, uuid) from public, anon, authenticated;
