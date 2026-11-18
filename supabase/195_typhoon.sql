-- 195 🌀 颱風來襲（v563，作者 11/18 同意：大約一到兩週一次）。可以重複執行。
-- 【什麼時候】每 10 天一輪（台灣時間對齊），每一輪登陸一次：第 2～9 天的 12:00～21:00 之間某個整點（用輪次算，全伺服器一樣；手機 js/game.js 的 tyLand 是同一個公式）。
--   所以兩次颱風相隔 2～18 天，平均 10 天，而且一定在白天到晚上、有人在線上的時段。
-- 【三個階段】pre 登陸前 60 分鐘｜mid 登陸後 40 分鐘｜post 再 60 分鐘。
--   天氣：020 的 _weather 會問這裡（pre＝下雨而且魚咬得特別快、mid＝更強的暴風雨、post＝放晴）。
-- 【颱風中的魚】mid 期間在晴潮海邊、港口外海釣，這一竿有 10% 換成被大浪翻上來的深海魚（大眼青眼魚、鼠尾鱈、赤鯥、水滴魚），1.5% 換成皇帶魚或翻車魚。
--   傳說魚、變種、紅鯊、節慶魚不換。
-- 【颱風過後撿東西】post 期間海邊沖上 12 樣東西（位置手機自己算，大家一樣），每個人每一樣可以撿一次：
--   漂流木 🪙30～69｜貝殼 🪙60｜玻璃浮球 💙5｜寶箱 🪙300。種類用颱風編號＋第幾個算，手機改不了。
-- 不會讓玩家損失任何東西。開船、潛水的限制是手機那邊擋的（不牽涉公平）。

create or replace function public._typhoon_land(p_ep bigint) returns bigint language sql immutable as $$
  select p_ep * 864000000 - 28800000 + (1 + h % 8) * 86400000 + (12 + (h / 256) % 10) * 3600000 from (select public._fnv('ty' || p_ep::text) as h) x $$;
create or replace function public._typhoon(p_ms bigint) returns jsonb language sql immutable as $$
  select case when p_ms >= l - 3600000 and p_ms < l + 6000000
              then jsonb_build_object('id', ep, 'land', l, 'phase', case when p_ms < l then 'pre' when p_ms < l + 2400000 then 'mid' else 'post' end)
              else jsonb_build_object('id', null, 'phase', null) end
  from (select ep, public._typhoon_land(ep) as l from (select floor((p_ms + 28800000) / 864000000.0)::bigint as ep) e) x $$;
revoke all on function public._typhoon_land(bigint) from public, anon;
revoke all on function public._typhoon(bigint) from public, anon;

-- 颱風中的魚
create or replace function public._typhoon_fish_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; cur jsonb; f jsonb; r numeric; pick text; pool text[];
begin
  if new.spot is null or new.spot not in ('sea', 'harbor') or new.rs is not null then return new; end if;
  if public._typhoon((extract(epoch from clock_timestamp()) * 1000)::bigint)->>'phase' is distinct from 'mid' then return new; end if;
  cfg := public._fishcfg(); cur := cfg->'fish'->new.fish;
  if cur is null or cur->>'r' = '傳說' or coalesce((cur->>'v')::boolean, false) or cur ? 'fest' then return new; end if;
  r := random();
  if r < 0.015 then pool := array['oarfish', 'sunfish']; elsif r < 0.115 then pool := array['mehikari', 'rattail', 'blackthroat', 'blobfish']; else return new; end if;
  pick := pool[1 + floor(random() * cardinality(pool))::int]; f := cfg->'fish'->pick;
  if f is null then return new; end if;
  new.fish := pick; new.w := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  new.brood := false; new.gp := null;
  return new;
exception when others then return new;
end $$;
drop trigger if exists typhoon_fish_trg on public.casts;
create trigger typhoon_fish_trg before insert on public.casts for each row execute function public._typhoon_fish_trg();
revoke all on function public._typhoon_fish_trg() from public, anon, authenticated;

-- 颱風過後撿東西
create table if not exists public.typhoon_picks (uid uuid not null references public.players(id) on delete cascade, ty bigint not null, i integer not null, at timestamptz not null default now(), primary key (uid, ty, i));
alter table public.typhoon_picks enable row level security;
revoke all on public.typhoon_picks from anon, authenticated;

create or replace function public.typhoon_my() returns jsonb language plpgsql security definer set search_path = public as $$
declare t jsonb := public._typhoon((extract(epoch from clock_timestamp()) * 1000)::bigint);
begin
  return t || jsonb_build_object('now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'picked', coalesce((select jsonb_agg(p.i order by p.i) from public.typhoon_picks p where p.uid = auth.uid() and p.ty = (t->>'id')::bigint), '[]'::jsonb));
end $$;
create or replace function public.typhoon_pick(p_i integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); t jsonb := public._typhoon((extract(epoch from clock_timestamp()) * 1000)::bigint); ty bigint; h bigint; kind text; c integer := 0; lv integer := 0;
begin
  if t->>'phase' is distinct from 'post' then raise exception '現在沒有東西可以撿，要等颱風過後'; end if;
  if p_i is null or p_i < 0 or p_i > 11 then raise exception '找不到這樣東西'; end if;
  ty := (t->>'id')::bigint;
  begin insert into public.typhoon_picks (uid, ty, i) values (pl.id, ty, p_i); exception when unique_violation then raise exception '這個你已經撿過了'; end;
  h := public._fnv('typ' || ty::text || ':' || p_i::text);
  if h % 100 < 45 then kind := 'wood'; c := 30 + ((h / 100) % 40)::int;
  elsif h % 100 < 75 then kind := 'shell'; c := 60;
  elsif h % 100 < 93 then kind := 'float'; lv := 5;
  else kind := 'chest'; c := 300; end if;
  update public.players set coins = coins + c, earned = earned + c, love = love + lv, updated_at = now() where id = pl.id returning * into pl;
  return jsonb_build_object('kind', kind, 'coins', c, 'love', lv, 'player', to_jsonb(pl));
end $$;
revoke all on function public.typhoon_my() from public, anon;
grant execute on function public.typhoon_my() to authenticated;
revoke all on function public.typhoon_pick(integer) from public, anon;
grant execute on function public.typhoon_pick(integer) to authenticated;

select '颱風設定完成 🌀' as result;
