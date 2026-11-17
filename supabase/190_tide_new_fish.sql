-- 190 🆕 第一批真的新魚（v557，作者 11/18：「慢慢也能加新魚啊，怎麼一堆變種，只是換顏色而已」）。可以重複執行。
-- ・四種新魚已經放進 020 的 _fishcfg（重新產生）和 095 的 fish_species：
--     whiting 沙鮻（常見）、groupie 點帶石斑幼魚（稀有）：只在漲潮、滿潮咬
--     tidegoby 潮池蝦虎（常見）、horseshoe 三棘鱟（稀有）：只在退潮、乾潮咬
-- ・這四種是「潮位不對就完全不咬」（189 的六種舊魚是 88% 不咬）。做法還是 189 那個 casts 觸發器，這裡重新定義。
-- ・鱟在 _fishcfg 裡帶了一個 "v":false：record_catch 看到有 v 這個鍵就會自動打星號收藏（不會被不小心賣掉、做菜），
--   其他地方都是讀 v 的值（false），所以牠還是一般的魚，不是變種。

create or replace function public._tide_fish(p text) returns text language sql immutable as $$
  select v.side from (values ('trevally', 'in'), ('blackbream', 'in'), ('mullet', 'in'), ('flounder', 'out'), ('octopus', 'out'), ('mudcrab', 'out'),
                             ('whiting', 'in'), ('groupie', 'in'), ('tidegoby', 'out'), ('horseshoe', 'out')) v(id, side) where v.id = p $$;
create or replace function public._tide_only(p text) returns boolean language sql immutable as $$ select p in ('whiting', 'groupie', 'tidegoby', 'horseshoe') $$;

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
    if mine = side then return new; end if;
    if not public._tide_only(new.fish) and random() >= 0.88 then return new; end if;   -- 舊的六種留 12% 的例外；新魚潮位不對一定換掉
    want_tide := false;
  else
    if random() >= 0.20 then return new; end if;
    want_tide := true;
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
revoke all on function public._tide_fish_trg() from public, anon, authenticated;
revoke all on function public._tide_only(text) from public, anon;
