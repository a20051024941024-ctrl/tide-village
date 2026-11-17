-- 189 🌊 潮汐魚（v556，作者 11/18 選了「潮位限定魚」）。可以重複執行。
-- ・不加新魚種（不然大家集滿的圖鑑、博物館會突然缺一格），讓六種本來就有的海魚跟著潮水走：
--     跟著漲潮進來（漲潮、滿潮）：trevally 浪人鰺、blackbream 黑鯛、mullet 烏魚
--     退潮才好抓（退潮、乾潮）：flounder 沙底比目魚、octopus 紅石章魚、mudcrab 鋸緣青蟳
-- ・做法跟 185 保底一樣，掛在 casts（每一竿的結果）的觸發器上，不改 020：
--     這一竿是「潮位不對的潮汐魚」→ 88% 換成同一個釣點、同樣稀有度的別種魚（所以錯的潮位幾乎不咬，但不是完全沒有）。
--     這一竿是普通的常見／稀有魚 → 20% 換成「現在潮位對、同樣稀有度的潮汐魚」（那個釣點有的才換；所以對的潮位明顯變多）。
--     只在同樣稀有度之間換：常見換常見、稀有換稀有，稀有魚的總量不變，不會變成賺錢的捷徑。
-- ・不動的：傳說魚、變種、節慶限定魚、赤紅霸王鯊、釣蝦場、潛水艇、泥灘、不是海的釣點。
-- ・潮位的算法跟 020 的 roll_fish、js/game.js 的 tideNow 一樣。

create or replace function public._tide_side() returns text language sql stable as $$
  with c as (select (public._fishcfg()->>'tidePeriod')::bigint as p, (extract(epoch from clock_timestamp()) * 1000)::bigint as ms),
       a as (select (ms % p)::numeric / p::numeric * 2 * pi() as ang from c)
  select case when sin(ang) > 0.8 or (sin(ang) >= -0.8 and cos(ang) > 0) then 'in' else 'out' end from a $$;

create or replace function public._tide_fish(p text) returns text language sql immutable as $$
  select v.side from (values ('trevally', 'in'), ('blackbream', 'in'), ('mullet', 'in'), ('flounder', 'out'), ('octopus', 'out'), ('mudcrab', 'out')) v(id, side) where v.id = p $$;

create or replace function public._tide_fish_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; cur jsonb; side text; mine text; f jsonb; fid text; tot numeric := 0; r numeric; pick text; want_tide boolean;
begin
  if new.spot is null or new.spot in ('shrimp', 'trench', 'mudflat') or new.rs is not null then return new; end if;
  cfg := public._fishcfg();
  if cfg->'spots'->new.spot is null or not (cfg->'sea' ? new.spot) then return new; end if;
  cur := cfg->'fish'->new.fish;
  if cur is null or cur->>'r' = '傳說' or coalesce((cur->>'v')::boolean, false) or (cur ? 'fest' and cur->>'fest' is not null) then return new; end if;
  side := public._tide_side(); mine := public._tide_fish(new.fish);
  if mine is not null then
    if mine = side or random() >= 0.88 then return new; end if;   -- 潮位對，或是那 12% 的例外
    want_tide := false;                                            -- 潮位不對：換成別的一般魚
  else
    if random() >= 0.20 then return new; end if;
    want_tide := true;                                             -- 換成現在潮位對的潮汐魚
  end if;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f is null or f->>'r' <> cur->>'r' or coalesce((f->>'v')::boolean, false) or (f ? 'fest' and f->>'fest' is not null) then continue; end if;
    if want_tide then if public._tide_fish(fid) is distinct from side then continue; end if;
    else if public._tide_fish(fid) is not null then continue; end if; end if;
    tot := tot + coalesce((f->>'w')::numeric, 1);
  end loop;
  if tot <= 0 then return new; end if;
  r := random() * tot;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f is null or f->>'r' <> cur->>'r' or coalesce((f->>'v')::boolean, false) or (f ? 'fest' and f->>'fest' is not null) then continue; end if;
    if want_tide then if public._tide_fish(fid) is distinct from side then continue; end if;
    else if public._tide_fish(fid) is not null then continue; end if; end if;
    pick := fid; r := r - coalesce((f->>'w')::numeric, 1); if r <= 0 then exit; end if;
  end loop;
  if pick is null then return new; end if;
  f := cfg->'fish'->pick;
  new.fish := pick; new.w := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  new.brood := false; new.gp := null;
  return new;
end $$;
drop trigger if exists tide_fish_trg on public.casts;
create trigger tide_fish_trg before insert on public.casts for each row execute function public._tide_fish_trg();

revoke all on function public._tide_fish_trg() from public, anon, authenticated;
revoke all on function public._tide_side() from public, anon;
revoke all on function public._tide_fish(text) from public, anon;
