-- 潮汐釣魚村：🐾 寵物（可以重複執行）
-- 種類：貓、柴犬、水獺、海鷗、寄居蟹（模型都是遊戲自己用程式畫的，沒有授權問題）。在寵物店領養。
-- 每人最多養 3 隻，同時只能帶 1 隻出門（out），其他的待在自己島上的家，朋友來參觀看得到。
-- 名字 1～8 個字，擋髒話。
-- 餵食：用自己魚缸裡的魚（魚會拿走）。一天第一次餵加比較多親密度（15，稀有魚 +5、傳說魚 +10），之後同一天每次只加 1（最多 5 次），拿一堆小魚洗不上去。
-- 禮物：每隻寵物一天可以領一次（親密度 10 以上），撿回來的貝殼、一點金幣或一張照片，親密度越高金幣越多一點點（不會太強）。
-- 公開的只有：島上待在家的寵物種類、名字、配件等級（給朋友參觀時畫出來），不給親密度數字。

create table if not exists public.pets (
  id bigserial primary key,
  owner uuid not null,
  kind text not null check (kind in ('cat', 'shiba', 'otter', 'gull', 'crab')),
  name text not null,
  love integer not null default 0,
  fed_day date, fed_n integer not null default 0,
  gift_day date,
  out boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pets_owner on public.pets(owner);
alter table public.pets enable row level security;
revoke all on public.pets from anon, authenticated;

create or replace function public._pet_price(k text) returns integer language sql immutable as $$
  select case k when 'cat' then 300 when 'shiba' then 2000 when 'otter' then 2500 when 'gull' then 1200 when 'crab' then 800 end $$;
-- 配件等級：親密度 60 戴項圈、150 再戴小帽子
create or replace function public._pet_acc(love integer) returns integer language sql immutable as $$ select case when love >= 150 then 2 when love >= 60 then 1 else 0 end $$;

create or replace function public._pet_row(p public.pets) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', p.id, 'kind', p.kind, 'name', p.name, 'love', p.love, 'acc', public._pet_acc(p.love), 'out', p.out,
    'fed', p.fed_day = (now() at time zone 'Asia/Taipei')::date, 'gift', p.gift_day = (now() at time zone 'Asia/Taipei')::date) $$;

create or replace function public.pet_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._pet_row(p) order by p.id), '[]'::jsonb) from public.pets p where p.owner = auth.uid() $$;

create or replace function public._pet_name(p_name text) returns text language plpgsql stable security definer set search_path = public as $$
declare nm text := btrim(coalesce(p_name, ''));
begin
  if char_length(nm) < 1 or char_length(nm) > 8 then raise exception '名字要 1～8 個字'; end if;
  if public._name_bad(nm) then raise exception '這個名字不行，換一個吧'; end if;
  return nm;
end $$;

-- 領養
create or replace function public.pet_adopt(p_kind text, p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pr integer := public._pet_price(p_kind); nm text := public._pet_name(p_name);
begin
  if pr is null then raise exception '沒有這種寵物'; end if;
  select * into pl from public.players where id = pl.id for update;
  if (select count(*) from public.pets where owner = pl.id) >= 3 then raise exception '最多養 3 隻寵物'; end if;
  if pl.coins < pr then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - pr, updated_at = now() where id = pl.id returning * into pl;
  insert into public.pets (owner, kind, name) values (pl.id, p_kind, nm);
  return jsonb_build_object('pets', public.pet_list(), 'player', to_jsonb(pl));
end $$;

-- 帶出門（同時只能 1 隻；p_id 是 null 就全部回家）
create or replace function public.pet_out(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_id is not null and not exists (select 1 from public.pets where id = p_id and owner = auth.uid()) then raise exception '找不到這隻寵物'; end if;
  update public.pets set out = (id = p_id) where owner = auth.uid();
  return public.pet_list();
end $$;

create or replace function public.pet_rename(p_id bigint, p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare nm text := public._pet_name(p_name);
begin
  update public.pets set name = nm where id = p_id and owner = auth.uid();
  if not found then raise exception '找不到這隻寵物'; end if;
  return public.pet_list();
end $$;

-- 送養（不養了）：不退錢
create or replace function public.pet_release(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.pets where id = p_id and owner = auth.uid();
  if not found then raise exception '找不到這隻寵物'; end if;
  return public.pet_list();
end $$;

-- 餵食：用魚缸裡的魚
create or replace function public.pet_feed(p_id bigint, p_t bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; e jsonb; td date := (now() at time zone 'Asia/Taipei')::date; r text; add integer;
begin
  select * into p from public.pets where id = p_id and owner = pl.id for update;
  if p.id is null then raise exception '找不到這隻寵物'; end if;
  select * into pl from public.players where id = pl.id for update;
  select x into e from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x where (x->>'t')::bigint = p_t limit 1;
  if e is null then raise exception '這條魚不在你的魚缸裡'; end if;
  if p.fed_day = td and p.fed_n >= 6 then raise exception '今天吃飽了，明天再餵'; end if;
  r := coalesce(public._fishcfg()->'fish'->(e->>'f')->>'r', (select rarity from public.fish_species where id = e->>'f'), '常見');
  if p.fed_day is distinct from td then add := 15 + case r when '傳說' then 10 when '稀有' then 5 else 0 end; p.fed_n := 1;
  else add := 1; p.fed_n := p.fed_n + 1; end if;
  update public.players set tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where (x->>'t')::bigint <> p_t), '[]'::jsonb),
    show = case when show is null then show else coalesce((select jsonb_agg(x) from jsonb_array_elements(show) x where (x #>> '{}') <> p_t::text), '[]'::jsonb) end,
    updated_at = now() where id = pl.id returning * into pl;
  update public.pets set love = love + add, fed_day = td, fed_n = p.fed_n where id = p.id returning * into p;
  return jsonb_build_object('add', add, 'pet', public._pet_row(p), 'player', to_jsonb(pl));
end $$;

-- 每天的小禮物
create or replace function public.pet_gift(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); p public.pets; td date := (now() at time zone 'Asia/Taipei')::date; k integer := floor(random() * 3)::integer; c integer; what text;
begin
  select * into p from public.pets where id = p_id and owner = pl.id for update;
  if p.id is null then raise exception '找不到這隻寵物'; end if;
  if p.love < 10 then raise exception '再跟牠熟一點（親密度 10）才會帶禮物給你'; end if;
  if p.gift_day = td then raise exception '今天的禮物已經領過了'; end if;
  c := 15 + floor(random() * 26)::integer + least(40, p.love / 10);
  what := case k when 0 then 'shell' when 1 then 'coin' else 'photo' end;
  update public.pets set gift_day = td where id = p.id returning * into p;
  update public.players set coins = coins + c, earned = earned + c, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('what', what, 'coins', c, 'pet', public._pet_row(p), 'player', to_jsonb(pl));
end $$;

-- 參觀小島：待在家裡的寵物（只給種類、名字、配件）
create or replace function public.isle_pets(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'name', name, 'acc', public._pet_acc(love)) order by id), '[]'::jsonb) from public.pets where owner = p_owner and not out $$;

do $$ declare f text; begin
  foreach f in array array['pet_list()', 'pet_adopt(text,text)', 'pet_out(bigint)', 'pet_rename(bigint,text)', 'pet_release(bigint)', 'pet_feed(bigint,bigint)', 'pet_gift(bigint)', 'isle_pets(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public._pet_name(text) from public, anon, authenticated;

select '寵物店開張了 🐾' as result;
