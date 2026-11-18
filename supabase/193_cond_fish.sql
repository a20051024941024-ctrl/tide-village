-- 193 🆕 第二批新魚「看天氣的魚」＋護士鯊（v561）。可以重複執行。
-- 作者 11/18 同意的名單（都已經放進 020 的 _fishcfg 和 095 的 fish_species）：
--   softshell 中華鱉（鏡湖，稀有）：只有晴天　　climbperch 攀鱸（百年生態池，常見）：只有下雨、暴風雨
--   creekcrab 拉氏清溪蟹（螢光溪間，常見）：只有晚上　　grasscarp 草魚（月灣河岸，稀有）：只吃玉米粒、麵包糰
--   nurseshark 護士鯊（珊瑚礁岸，稀有，晚上多）、nurseshark_xanthic 黃化護士鯊（作者說這一隻變種要做）：照 020 原本的時段規則，不在這裡管
-- 做法跟 189／190 的潮汐魚一樣：在 casts 上掛觸發器，條件不符合就把這一竿換成同一個釣點、同樣稀有度、沒有條件的魚。
-- 魚餌：020 的 roll_fish 在寫入 casts 前把這一竿用的魚餌放進 tide.bait（交易內的設定）。

create or replace function public._game_per() returns text language sql stable as $$
  select case when gh >= 7.5 and gh < 17 then 'day' when (gh >= 5 and gh < 7.5) or (gh >= 17 and gh < 19.6) then 'twilight' else 'night' end
  from (select mod((mod((extract(epoch from clock_timestamp()) * 1000)::bigint / 1000.0, (public._fishcfg()->>'dayLen')::numeric) / (public._fishcfg()->>'dayLen')::numeric * 24 + 8)::numeric, 24) as gh) x $$;
create or replace function public._cond_fish(p text) returns text language sql immutable as $$
  select v.c from (values ('softshell', 'sunny'), ('climbperch', 'rain'), ('creekcrab', 'night'), ('grasscarp', 'veg')) v(id, c) where v.id = p $$;
create or replace function public._cond_ok(c text) returns boolean language plpgsql stable as $$
declare wx text;
begin
  if c = 'night' then return public._game_per() = 'night'; end if;
  if c = 'veg' then return coalesce(current_setting('tide.bait', true), '') in ('corn', 'bread'); end if;
  wx := public._weather((extract(epoch from clock_timestamp()) * 1000)::bigint)->>'k';
  if c = 'sunny' then return wx = 'sunny'; end if;
  if c = 'rain' then return wx in ('rain', 'storm'); end if;
  return true;
end $$;

create or replace function public._cond_fish_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; cur jsonb; c text; f jsonb; fid text; tot numeric := 0; r numeric; pick text;
begin
  c := public._cond_fish(new.fish);
  if c is null or new.spot is null or new.rs is not null or public._cond_ok(c) then return new; end if;
  cfg := public._fishcfg(); cur := cfg->'fish'->new.fish;
  if cur is null or cfg->'spots'->new.spot is null then return new; end if;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f is null or f->>'r' <> cur->>'r' or f ? 'v' or f ? 'fest' or f->>'t' is not null or public._cond_fish(fid) is not null then continue; end if;
    tot := tot + coalesce((f->>'w')::numeric, 1);
  end loop;
  if tot <= 0 then return new; end if;
  r := random() * tot;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f is null or f->>'r' <> cur->>'r' or f ? 'v' or f ? 'fest' or f->>'t' is not null or public._cond_fish(fid) is not null then continue; end if;
    pick := fid; r := r - coalesce((f->>'w')::numeric, 1); if r <= 0 then exit; end if;
  end loop;
  if pick is null then return new; end if;
  f := cfg->'fish'->pick;
  new.fish := pick; new.w := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  new.brood := false; new.gp := null;
  return new;
end $$;
drop trigger if exists cond_fish_trg on public.casts;
create trigger cond_fish_trg before insert on public.casts for each row execute function public._cond_fish_trg();
revoke all on function public._cond_fish_trg() from public, anon, authenticated;
revoke all on function public._cond_ok(text) from public, anon;
revoke all on function public._cond_fish(text) from public, anon;
revoke all on function public._game_per() from public, anon;

-- 蔚博士每天調查的魚（191）：加上這一批
create or replace function public._sci_quest_pool() returns jsonb language sql immutable as $$
  select p || jsonb_build_object(
    'sea',   (p->'sea')   || '["whiting","tidegoby","groupie","horseshoe"]'::jsonb,
    'lake',  (p->'lake')  || '["softshell"]'::jsonb,
    'canal', (p->'canal') || '["climbperch"]'::jsonb,
    'creek', (p->'creek') || '["creekcrab"]'::jsonb,
    'river', (p->'river') || '["grasscarp"]'::jsonb,
    'reef',  (p->'reef')  || '["nurseshark"]'::jsonb)
  from (select public._sci_pool() as p) x $$;
revoke all on function public._sci_quest_pool() from public, anon, authenticated;

select '第二批新魚設定完成 🐢' as result;
