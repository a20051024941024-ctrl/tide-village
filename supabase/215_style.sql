-- 215 👕 讓大家想挑衣服（v673，作者 11/21：「衣服，我發現大家都沒在挑衣服」→ 同意設計）。可以重複執行。
-- ・入門套裝：每個人可以免費挑一套（style_starter），挑過會在 owned 裡記 kit_starter。
-- ・每週穿搭主題（台灣時間週一換，六種輪流）：身上穿到主題裡 2 件以上，釣到魚多一成經驗（players.xp_bonus，用戶端算等級時加上去）。
-- ・幫別人的穿搭按讚（style_like），一週一個人只能讚同一個人一次、一週最多讚 30 次；style_top 是這週被讚最多的 5 個人。

alter table public.players add column if not exists xp_bonus integer not null default 0;

create or replace function public._style_week() returns text language sql stable as $$
  select to_char(date_trunc('week', now() at time zone 'Asia/Taipei'), 'YYYY-MM-DD') $$;
create or replace function public._style_theme() returns integer language sql stable as $$
  select ((date_trunc('week', now() at time zone 'Asia/Taipei')::date - date '2026-11-16') / 7 % 6 + 6) % 6 $$;
-- 每個主題算數的衣服（% 結尾＝開頭一樣的都算）。用戶端 STYLE_THEMES 要一樣。
create or replace function public._style_set(i integer) returns text[] language sql immutable as $$
  select array(select unnest((array[
    array['hat_sun', 'top_hawaii', 'top_tank', 'pants_shorts', 'shoes_sandals', 'acc_lei', 'acc_shell', 'back_balloon'],
    array['hat_bucket', 'top_vest', 'top_apron', 'pants_overalls', 'shoes_rain', 'back_basket', 'back_fishpack', 'top_stripe'],
    array['hat_cap', 'top_dry', 'top_dryv', 'top_tee', 'top_vtee', 'pants_shorts', 'shoes_sneakers', 'socks_white'],
    array['hat_beanie', 'top_fstripe', 'top_long', 'pants_khaki', 'acc_glasses', 'acc_bowtie', 'socks_stripe', 'top_pocket'],
    array['hat_beanie', 'top_hoodie', 'top_sweat', 'top_hoodt', 'acc_scarf%', 'pants_jeans', 'shoes_boots', 'hat_antler'],
    array['hat_pirate', 'top_nylon', 'back_fishpack', 'back_cloak%', 'back_kcape%', 'shoes_boots', 'pants_jeans', 'acc_goggles']
  ])[i + 1:i + 1][1:8])) $$;
create or replace function public._style_match(g jsonb, i integer) returns integer language sql immutable as $$
  select count(*)::int from jsonb_each_text(coalesce(g, '{}'::jsonb)) e, unnest(public._style_set(i)) s
  where e.key <> 'look' and (e.value = s or (right(s, 1) = '%' and e.value like s)) $$;

-- 釣到魚的時候：穿對主題就多一成經驗（常見 1、稀有 4、傳說 25）
create or replace function public._style_xp_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if new.last_fish is null then return new; end if;
  if public._style_match(new.gear, public._style_theme()) < 2 then return new; end if;
  r := public._fishcfg()->'fish'->new.last_fish->>'r';
  new.xp_bonus := coalesce(new.xp_bonus, 0) + case r when '傳說' then 25 when '稀有' then 4 else 1 end;
  return new;
exception when others then return new;
end $$;
revoke all on function public._style_xp_trg() from public, anon, authenticated;
drop trigger if exists style_xp on public.players;
create trigger style_xp before update of total on public.players for each row when (new.total > old.total) execute function public._style_xp_trg();

-- 入門套裝
create or replace function public._style_kit(k integer) returns text[] language sql immutable as $$
  select array(select unnest((array[
    array['hat_sun', 'top_hawaii', 'pants_shorts', 'shoes_sandals', 'acc_lei'],
    array['hat_bucket', 'top_vest', 'pants_overalls', 'shoes_rain', 'back_basket'],
    array['hat_cap', 'top_dry', 'pants_shorts', 'shoes_sneakers', 'socks_white'],
    array['hat_beanie', 'top_stripe', 'pants_khaki', 'shoes_sneakers', 'acc_glasses'],
    array['hat_cat', 'top_kid', 'pants_skirt', 'shoes_sneakers', 'socks_stripe'],
    array['hat_pirate', 'top_nylon', 'pants_jeans', 'shoes_boots', 'back_fishpack']
  ])[k + 1:k + 1][1:5])) $$;
create or replace function public.style_starter(p_k integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); kit text[]; g jsonb; x text;
begin
  if p_k is null or p_k < 0 or p_k > 5 then raise exception '沒有這一套'; end if;
  if 'kit_starter' = any(coalesce(pl.owned, '{}')) then raise exception '已經挑過入門套裝了'; end if;
  kit := public._style_kit(p_k); g := coalesce(pl.gear, '{}'::jsonb);
  foreach x in array kit loop g := g || jsonb_build_object(split_part(x, '_', 1), x); end loop;
  update public.players set owned = array(select distinct y from unnest(coalesce(owned, '{}') || kit || array['kit_starter']) y), gear = g, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

-- 按讚
create table if not exists public.style_likes (
  week text not null, src uuid not null references public.players(id) on delete cascade, dst uuid not null references public.players(id) on delete cascade,
  at timestamptz not null default now(), primary key (week, src, dst));
create index if not exists style_likes_dst on public.style_likes (week, dst);
alter table public.style_likes enable row level security;
create or replace function public.style_like(p_to uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); wk text := public._style_week();
begin
  if p_to is null or p_to = pl.id then raise exception '不能讚自己'; end if;
  if not exists (select 1 from public.players where id = p_to) then raise exception '找不到這位玩家'; end if;
  if (select count(*) from public.style_likes where week = wk and src = pl.id) >= 30 then raise exception '這週按讚的次數用完了'; end if;
  insert into public.style_likes (week, src, dst) values (wk, pl.id, p_to) on conflict do nothing;
  return public.style_of(p_to);
end $$;
create or replace function public.style_of(p_uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', (select count(*) from public.style_likes where week = public._style_week() and dst = p_uid),
    'mine', exists (select 1 from public.style_likes where week = public._style_week() and dst = p_uid and src = auth.uid()),
    'gear', (select gear from public.players where id = p_uid)) $$;
create or replace function public.style_top() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('theme', public._style_theme(), 'week', public._style_week(), 'top', coalesce((select jsonb_agg(r) from (
    select jsonb_build_object('id', l.dst, 'n', coalesce(nullif(p.nickname, ''), '釣客'), 'likes', count(*), 'gear', p.gear) r
    from public.style_likes l join public.players p on p.id = l.dst where l.week = public._style_week() group by l.dst, p.nickname, p.gear order by count(*) desc limit 5) t), '[]'::jsonb)) $$;

revoke all on function public.style_starter(integer) from public, anon;
grant execute on function public.style_starter(integer) to authenticated;
revoke all on function public.style_like(uuid) from public, anon;
grant execute on function public.style_like(uuid) to authenticated;
revoke all on function public.style_of(uuid) from public, anon;
grant execute on function public.style_of(uuid) to authenticated;
revoke all on function public.style_top() from public, anon;
grant execute on function public.style_top() to authenticated;

select '穿搭設定完成 👕' as result;
