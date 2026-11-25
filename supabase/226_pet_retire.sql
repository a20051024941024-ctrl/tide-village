-- 226 🐾 寵物調整（v832，作者 11/25：「小章魚、河豚、寄居蟹我覺得可以不要，水獺以後等活動出」）。可以重複執行（每個人只會退一次）。
-- ・小章魚、河豚、寄居蟹：遊戲裡拿掉。商店不賣、釣魚撈不到；已經養的收回（寵物市集上架中的也一起收回）。
--   退錢：在寵物店領養的寄居蟹（caught = false）每隻退 800 金；釣魚撈到的沒花錢，不退，但一樣會告訴他。
-- ・水獺：先停賣、溪邊釣魚也撈不到，等之後的活動再出。已經養的留著。
-- ・退了多少記在 refund_log（219 的表），進遊戲時 refund_seen() 會告訴他一次。

-- 1. 退錢、記下來（每人一筆，kind = 'pet_retire'；重跑時已經記過的不會再退）
with calc as (
  select owner as id,
         (count(*) filter (where kind = 'crab' and not coalesce(caught, false)) * 800)::integer as amt
  from public.pets where kind in ('crab', 'octopus', 'puffer')
  group by owner
), ins as (
  insert into public.refund_log (player, kind, coins)
  select id, 'pet_retire', amt from calc
  on conflict (player, kind) do nothing
  returning player, coins
)
update public.players pl set coins = pl.coins + ins.coins, updated_at = now() from ins where pl.id = ins.player and ins.coins > 0;

-- 2. 收回
delete from public.pets where kind in ('crab', 'octopus', 'puffer');

-- 3. 商店價錢：寄居蟹、水獺不賣了
create or replace function public._pet_price(k text) returns integer language sql immutable as $$
  select case k when 'cat' then 300 when 'shiba' then 2000 when 'gull' then 1200 when 'pondturtle' then 600 end $$;

-- 4. 釣魚撈到的寵物：只剩小海龜（海邊）和小烏龜（溪邊、池塘）；小鱟還是走 192 的 pet_horseshoe
create or replace function public.pet_lucky() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cfg jsonb := public._fishcfg(); spots text[]; pool text[] := '{}'; k text; v text;
begin
  select * into pl from public.players where id = pl.id for update;
  if pl.last_fish is null or pl.total <= pl.pet_try_n then return jsonb_build_object('got', false); end if;   -- 每釣一條只能試一次
  update public.players set pet_try_n = pl.total where id = pl.id;
  if random() >= 0.012 then return jsonb_build_object('got', false); end if;
  select array_agg(s) into spots from jsonb_object_keys(cfg->'spots') s where cfg->'spots'->s->'fish' ? pl.last_fish;
  if spots && array['sea', 'harbor', 'reef', 'isle'] then pool := pool || array['turtle']; end if;
  if spots && array['river', 'creek', 'weir', 'lake', 'canal', 'pool'] then pool := pool || array['pondturtle']; end if;
  if coalesce(array_length(pool, 1), 0) = 0 then return jsonb_build_object('got', false); end if;
  k := pool[1 + floor(random() * array_length(pool, 1))::int]; v := public._pet_roll(k);
  if not public._pet_fit(pl.id, k) then return jsonb_build_object('got', true, 'kind', k, 'var', v, 'full', true); end if;
  insert into public.pets (owner, kind, name, var, caught) values (pl.id, k, case k when 'turtle' then '小海龜' else '小烏龜' end, v, true);
  return jsonb_build_object('got', true, 'kind', k, 'var', v, 'pets', public.pet_list());
end $$;
revoke all on function public.pet_lucky() from public, anon;
grant execute on function public.pet_lucky() to authenticated;

-- 5. 進遊戲時問一次：多回傳是哪幾種退款（手機照種類寫提示）
create or replace function public.refund_seen() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer; ks text[];
begin
  with u as (update public.refund_log set seen = true where player = pl.id and not seen returning kind, coins)
  select coalesce(sum(coins), 0)::integer, coalesce(array_agg(kind), '{}') into n, ks from u;
  return jsonb_build_object('coins', n, 'kinds', to_jsonb(ks));
end $$;
revoke all on function public.refund_seen() from public, anon;
grant execute on function public.refund_seen() to authenticated;

select '寵物調整完成 🐾：收回小章魚、河豚、寄居蟹，' || count(*) || ' 人，退 ' || coalesce(sum(coins), 0) || ' 金幣；水獺停賣' as result from public.refund_log where kind = 'pet_retire';
