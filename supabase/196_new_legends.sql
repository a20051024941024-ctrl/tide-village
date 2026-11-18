-- 196 🆕 新的傳說魚（v568，作者 11/18：「應該是要加新的傳說魚吧」「大家都還是都在外海釣」）。可以重複執行。
-- 七種（都已經放進 020 的 _fishcfg 和 095）：
--   tarpon 大海鰱（晴潮海邊，清晨黃昏多）　cobia 海鱺（晴潮海邊、港口外海；對著深色魚影拋 ×3，020 裡的 follow）
--   sailfish 雨傘旗魚（港口外海，白天多）　swordfish 劍旗魚（港口外海，晚上多）
--   yellowcheek 鱤魚（月灣河岸，只追路亞）　alligatorgar 鱷雀鱔（百年生態池，晚上多）　napoleon 蘇眉魚（石滬，只有退潮、乾潮；釣到自動收藏）
-- 這裡管「一定要符合條件」的兩種：鱤魚要路亞（roll_fish 把釣組放進 tide.rig）、蘇眉魚要退潮。時段是 020 原本的規則（不對的時段剩 15%）。
-- 總機率：020 的 legKs（晴潮海邊 1.05、月灣河岸 0.7）、legK.harbor 2.6，讓原本的傳說魚不會因為多了新魚就變難。
-- 193 的觸發器改成：同稀有度找不到可以換的魚時，往下找稀有、常見（石滬沒有別的傳說魚）。

create or replace function public._cond_fish(p text) returns text language sql immutable as $$
  select v.c from (values ('softshell', 'sunny'), ('climbperch', 'rain'), ('creekcrab', 'night'), ('grasscarp', 'veg'), ('yellowcheek', 'lure'), ('napoleon', 'ebb')) v(id, c) where v.id = p $$;
create or replace function public._cond_ok(c text) returns boolean language plpgsql stable as $$
declare wx text;
begin
  if c = 'night' then return public._game_per() = 'night'; end if;
  if c = 'veg' then return coalesce(current_setting('tide.bait', true), '') in ('corn', 'bread'); end if;
  if c = 'lure' then return coalesce(current_setting('tide.rig', true), '') = 'lure'; end if;
  if c = 'ebb' then return public._tide_side() = 'out'; end if;
  wx := public._weather((extract(epoch from clock_timestamp()) * 1000)::bigint)->>'k';
  if c = 'sunny' then return wx = 'sunny'; end if;
  if c = 'rain' then return wx in ('rain', 'storm'); end if;
  return true;
end $$;

create or replace function public._cond_fish_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; cur jsonb; c text; f jsonb; fid text; tot numeric; r numeric; pick text; rr text;
begin
  c := public._cond_fish(new.fish);
  if c is null or new.spot is null or new.rs is not null or public._cond_ok(c) then return new; end if;
  cfg := public._fishcfg(); cur := cfg->'fish'->new.fish;
  if cur is null or cfg->'spots'->new.spot is null then return new; end if;
  foreach rr in array (case cur->>'r' when '傳說' then array['傳說', '稀有', '常見'] when '稀有' then array['稀有', '常見'] else array['常見'] end) loop
    tot := 0; pick := null;
    for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
      f := cfg->'fish'->fid;
      if f is null or f->>'r' <> rr or f ? 'v' or f ? 'fest' or f->>'t' is not null or public._cond_fish(fid) is not null then continue; end if;
      tot := tot + coalesce((f->>'w')::numeric, 1);
    end loop;
    if tot <= 0 then continue; end if;
    r := random() * tot;
    for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
      f := cfg->'fish'->fid;
      if f is null or f->>'r' <> rr or f ? 'v' or f ? 'fest' or f->>'t' is not null or public._cond_fish(fid) is not null then continue; end if;
      pick := fid; r := r - coalesce((f->>'w')::numeric, 1); if r <= 0 then exit; end if;
    end loop;
    exit when pick is not null;
  end loop;
  if pick is null then return new; end if;
  f := cfg->'fish'->pick;
  new.fish := pick; new.w := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  new.brood := false; new.gp := null;
  return new;
end $$;
revoke all on function public._cond_fish_trg() from public, anon, authenticated;
revoke all on function public._cond_ok(text) from public, anon;
revoke all on function public._cond_fish(text) from public, anon;

select '新傳說魚設定完成 🐟' as result;
