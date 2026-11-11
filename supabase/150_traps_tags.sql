-- 潮汐釣魚村 v389：籠子、標記放流（可以重複執行）
-- 一、籠子：潛水時在公共潛水點的海底放一個籠子（🪙50），4 小時後回同一個潛水點潛下去收，裡面有 1～3 隻螃蟹、蝦、小卷、章魚…，直接放進魚缸。一個人最多同時放 2 個。
-- 二、標記放流：魚缸裡的魚可以「標記放流」，除了原本放流的 💙，再多 💙1；之後別人釣到同一種魚時，有機會（12%）釣到這條掛著標籤的魚：
--     釣到的人 🪙+50，標記的人 💙+5，兩邊都會看到通知。一天最多標記 10 條。
create table if not exists public.dive_traps (
  id        bigint generated always as identity primary key,
  owner     uuid not null,
  site      text not null,
  px        real not null,
  pz        real not null,
  placed_at timestamptz not null default now()
);
create index if not exists dive_traps_owner on public.dive_traps (owner);
alter table public.dive_traps enable row level security;
revoke all on public.dive_traps from anon, authenticated;

create or replace function public.trap_list() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('now', floor(extract(epoch from now()) * 1000),
    'traps', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'site', t.site, 'x', t.px, 'z', t.pz, 'ready', floor(extract(epoch from t.placed_at + interval '4 hours') * 1000)) order by t.id) from public.dive_traps t where t.owner = auth.uid()), '[]'::jsonb)) $$;

create or replace function public.trap_put(p_site text, p_x real, p_z real) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_site is null or p_site not in ('reef', 'wreck', 'offshore', 'harbor', 'cave') then raise exception '這裡不能放籠子'; end if;
  if p_x is null or p_z is null or p_x <> p_x or p_z <> p_z or abs(p_x) > 60 or abs(p_z) > 60 then raise exception '這裡不能放籠子'; end if;
  if (select count(*) from public.dive_traps where owner = pl.id) >= 2 then raise exception '最多同時放 2 個籠子，先去收一個'; end if;
  if pl.coins < 50 then raise exception '金幣不夠'; end if;
  insert into public.dive_traps (owner, site, px, pz) values (pl.id, p_site, p_x, p_z);
  update public.players set coins = coins - 50, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 收籠子：回傳 { got: [{f, w}], pl: 玩家資料 }
create or replace function public.trap_take(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t public.dive_traps; n integer; i integer; r numeric; fid text; sp public.fish_species; w numeric; got jsonb := '[]'::jsonb; ts bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; add jsonb := '[]'::jsonb; fc jsonb; fb jsonb;
begin
  select * into t from public.dive_traps where id = p_id and owner = pl.id for update;
  if not found then raise exception '找不到這個籠子'; end if;
  if now() < t.placed_at + interval '4 hours' then raise exception '籠子裡還沒有東西，晚一點再來'; end if;
  delete from public.dive_traps where id = p_id;
  r := random(); n := 1 + (case when r < 0.6 then 1 else 0 end) + (case when r < 0.2 then 1 else 0 end);
  fc := coalesce(pl.fish_count, '{}'::jsonb); fb := coalesce(pl.fish_best, '{}'::jsonb);
  for i in 1..n loop
    r := random() * 100;
    fid := case when r < 30 then 'crab' when r < 50 then 'shrimp' when r < 62 then 'squid' when r < 70 then 'eel' when r < 78 then 'mudcrab' when r < 84 then 'cuttle' when r < 90 then 'lobster' when r < 95 then 'octopus' else 'kingcrab' end;
    select * into sp from public.fish_species where id = fid;
    if not found then continue; end if;
    w := round((sp.min_w + (sp.max_w - sp.min_w) * power(random(), 2))::numeric, 2);
    add := add || jsonb_build_array(jsonb_build_object('f', fid, 'w', w, 't', ts + i));
    got := got || jsonb_build_array(jsonb_build_object('f', fid, 'w', w));
    fc := jsonb_set(fc, array[fid], to_jsonb(coalesce((fc ->> fid)::integer, 0) + 1));
    if coalesce((fb ->> fid)::numeric, 0) < w then fb := jsonb_set(fb, array[fid], to_jsonb(w)); end if;
  end loop;
  update public.players set tank = public._trim_tank(add || tank, show), fish_count = fc, fish_best = fb, total = total + jsonb_array_length(add), updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('got', got, 'pl', to_jsonb(pl));
end $$;

-- 標記放流
create table if not exists public.fish_tags (
  id          bigint generated always as identity primary key,
  tagger      uuid not null,
  tagger_name text,
  fish        text not null,
  w           numeric not null,
  at          timestamptz not null default now(),
  caught_by   uuid,
  caught_at   timestamptz
);
create index if not exists fish_tags_open on public.fish_tags (fish, at) where caught_by is null;
create index if not exists fish_tags_tagger on public.fish_tags (tagger, at);
alter table public.fish_tags enable row level security;
revoke all on public.fish_tags from anon, authenticated;
alter table public.players add column if not exists tag_note jsonb;

create or replace function public.tag_release(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); fid text; w numeric; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  select e->>'f', (e->>'w')::numeric into fid, w from jsonb_array_elements(pl.tank) e where (e->>'t')::bigint = p_ts limit 1;
  if fid is null then raise exception '找不到這條魚'; end if;
  if (select count(*) from public.fish_tags where tagger = pl.id and (at at time zone 'Asia/Taipei')::date = today) >= 10 then raise exception '今天標記夠多了（一天最多 10 條），可以用一般的放流'; end if;
  perform public.release_fish(p_ts);
  insert into public.fish_tags (tagger, tagger_name, fish, w) values (pl.id, coalesce(nullif(pl.nickname, ''), '釣客'), fid, w);
  update public.players set love = love + 1, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 釣到魚的時候（020 的 record_catch 會呼叫）：有機會是別人標記過的那一條
create or replace function public._tag_hit(p_uid uuid, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare t public.fish_tags; nm text;
begin
  if random() >= 0.12 then return; end if;
  select * into t from public.fish_tags where fish = p_fish and caught_by is null and tagger <> p_uid order by at limit 1 for update skip locked;
  if not found then return; end if;
  update public.fish_tags set caught_by = p_uid, caught_at = now() where id = t.id;
  select coalesce(nullif(nickname, ''), '釣客') into nm from public.players where id = p_uid;
  update public.players set coins = coins + 50, earned = earned + 50, tag_note = jsonb_build_object('id', t.id, 'k', 'catch', 'name', t.tagger_name, 'f', p_fish, 'w', t.w, 'days', greatest(0, (now()::date - t.at::date))) where id = p_uid;
  update public.players set love = love + 5, tag_note = jsonb_build_object('id', t.id, 'k', 'back', 'name', nm, 'f', p_fish, 'w', p_w) where id = t.tagger;
end $$;

revoke all on function public._tag_hit(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.trap_list(), public.trap_put(text, real, real), public.trap_take(bigint), public.tag_release(bigint) from public, anon;
grant execute on function public.trap_list(), public.trap_put(text, real, real), public.trap_take(bigint), public.tag_release(bigint) to authenticated;
