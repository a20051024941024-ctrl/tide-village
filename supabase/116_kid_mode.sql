-- 116 兒童安全模式（v288，上架 Google Play 用）。可以重複執行。
-- 第一次進遊戲問出生年份（只有年）；未滿 13 歲（保守算：今年 - 出生年 <= 13）就是兒童模式，之後自己不能改。
-- 兒童模式：不能在留言板留言、名字只能從「形容詞＋動物」選、好友只能用當面給的好友代碼加（陌生人不能直接加）。
-- 聊天只能用快速聊天、看不到別人自由打字，這部分在手機上做（聊天是即時轉送，伺服器不保存）。
alter table public.players add column if not exists birth_year integer;
alter table public.players add column if not exists kid boolean not null default false;

create or replace function public._kid_adj() returns text[] language sql immutable as $$ select array['開心的','勇敢的','害羞的','愛睡的','好奇的','溫柔的','活潑的','安靜的','聰明的','愛笑的','迷糊的','閃亮的'] $$;
create or replace function public._kid_ani() returns text[] language sql immutable as $$ select array['水獺','海豚','企鵝','海龜','小貓','柴犬','海鷗','河豚','章魚','螃蟹','鯨魚','兔子','松鼠','貓頭鷹','刺蝟','熊貓'] $$;
create or replace function public._kid_name_ok(p text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(public._kid_adj()) a, unnest(public._kid_ani()) b where a || b = p) $$;
create or replace function public._kid_name_rand() returns text language sql volatile as $$
  select (public._kid_adj())[1 + floor(random() * 12)::int] || (public._kid_ani())[1 + floor(random() * 16)::int] $$;

create or replace function public.set_birth_year(p_year integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); y integer := extract(year from now() at time zone 'Asia/Taipei')::int; k boolean;
begin
  if pl.birth_year is not null then return jsonb_build_object('ok', true, 'kid', pl.kid, 'already', true); end if;
  if p_year is null or p_year < y - 110 or p_year > y then raise exception '請選你的出生年份'; end if;
  k := y - p_year <= 13;
  update public.players set birth_year = p_year, kid = k,
    nickname = case when k and not public._kid_name_ok(coalesce(nickname, '')) then public._kid_name_rand() else nickname end, updated_at = now()
  where id = pl.id returning * into pl;
  return jsonb_build_object('ok', true, 'kid', pl.kid, 'name', pl.nickname);
end $$;
revoke all on function public.set_birth_year(integer) from public, anon;
grant execute on function public.set_birth_year(integer) to authenticated;

-- 兒童模式改名只能用清單裡的名字（其他名字不會生效）
create or replace function public._kid_name_guard() returns trigger language plpgsql as $$
begin
  if new.kid and new.nickname is distinct from old.nickname and not public._kid_name_ok(coalesce(new.nickname, '')) then new.nickname := old.nickname; end if;
  if old.kid and not new.kid and current_setting('tide.admin', true) is distinct from '1' then new.kid := true; end if;   -- 不能自己關掉兒童模式
  if old.birth_year is not null and new.birth_year is distinct from old.birth_year and current_setting('tide.admin', true) is distinct from '1' then new.birth_year := old.birth_year; end if;
  return new;
end $$;
drop trigger if exists players_kid_guard on public.players;
create trigger players_kid_guard before update on public.players for each row execute function public._kid_name_guard();

-- 兒童模式不能在留言板留言
create or replace function public._kid_board_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.players where id = new.uid and kid) then raise exception '兒童安全模式不能留言，可以看大家的留言喔'; end if;
  return new;
end $$;
drop trigger if exists board_kid_guard on public.board_posts;
create trigger board_kid_guard before insert on public.board_posts for each row execute function public._kid_board_guard();

-- 好友：只要有一方是兒童模式，就只能用當面給的好友代碼加
create or replace function public._kid_friend_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('tide.bycode', true) is distinct from '1' and exists (select 1 from public.players where id in (new.owner, new.friend) and kid) then
    raise exception '兒童安全模式只能用好友代碼加好友（請對方當面給你看他的代碼）';
  end if;
  return new;
end $$;
drop trigger if exists friends_kid_guard on public.friends;
create trigger friends_kid_guard before insert on public.friends for each row execute function public._kid_friend_guard();

create or replace function public.add_friend_code(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := lower(trim(coalesce(p_code, ''))); ids uuid[];
begin
  if c !~ '^[0-9a-f]{8}$' then raise exception '好友代碼是 8 個英文或數字'; end if;
  select array_agg(id) into ids from (select id from public.players where id::text like c || '%' limit 2) s;
  if ids is null or cardinality(ids) <> 1 then raise exception '找不到這位玩家'; end if;
  perform set_config('tide.bycode', '1', true);
  return public.add_friend(ids[1]);
end $$;

-- 我自己的年齡設定（手機用來決定要不要問年份、要不要開兒童模式）
create or replace function public.my_age_mode() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('asked', birth_year is not null, 'kid', kid) from public.players where id = auth.uid() $$;
revoke all on function public.my_age_mode() from public, anon;
grant execute on function public.my_age_mode() to authenticated;
