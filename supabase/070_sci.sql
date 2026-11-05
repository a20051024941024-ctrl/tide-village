-- 潮汐釣魚村：海洋科學家「蔚博士」每天發現一種新品種的魚（可以重複執行）
-- 每天（台灣時間）蔚博士跑到世界上的一個釣點做調查，發現一種新品種：
--   拿那個釣點本來就有的一種魚當「近親」，身體的花色、大小不一樣（顏色在手機上照 hue／hue2 重新上色，模型跟近親同一套產生方式）。
--   新品種是「稀有」，從發現那天開始，在那個釣點就有機會釣到（當天發現的比較容易，以前發現的也一直都在）；
--   每一種新品種都有一個很少見的變種（白化或黑化），釣到才會出現在圖鑑。
-- 同一天全伺服器都一樣（用日期算出來，誰先打開都一樣）；第一個釣到的人會記在發現紀錄上。
-- roll_fish（020）裡面多了一段：在那個釣點，照機率把抽到的魚換成新品種。

create table if not exists public.sci_finds (
  day      date primary key,
  id       text not null unique,
  base     text not null,
  spot     text not null,
  name     text not null,
  hue      integer not null,
  hue2     integer not null,
  shape    numeric(4,2) not null default 1,
  min_w    numeric not null,
  max_w    numeric not null,
  story    text not null default '',
  var_id   text not null,
  var_kind text not null,
  var_name text not null,
  first_by text,
  first_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.sci_finds add column if not exists giant boolean not null default false;   -- 深海巨魚（074）
create index if not exists sci_finds_spot on public.sci_finds (spot, day desc);
alter table public.sci_finds enable row level security;
revoke all on public.sci_finds from anon, authenticated;

-- 每個釣點可以當「近親」的魚（有照維基百科做模型、常見或稀有、不是變種、不是大型魚）
create or replace function public._sci_pool() returns jsonb language sql immutable as $j$ select '{"river":["perch","crucian","catfish","tilapia","eel","snakehead","zacco","acro","pseudorasbora"],"lake":["crucian","perch","carp","bass","goldfish","bighead"],"pool":["ayu","kuhua","loach","salmon","hillstream","candidia"],"sea":["mackerel","scorpion","moonbream","puffer","squid","bonito","cuttle","flounder","crab","tilefish","stingray"],"isle":["clown","parrot","puffer","squid","cuttle","octopus","seahorse","lionfish","lobster","butterfly","trevally","sergeant","rabbitfish","bluetang","moonwrasse"],"harbor":["mackerel","moonbream","octopus","ika","barracuda","kingcrab","mahi","saury","horsemack","hairtail","sardine","flyingfish","yellowtail","pomfret","grunt","roundscad","anchovy","filefish","threadfin"],"mangrove":["mullet","milkfish","scat","terapon","blackbream","mudcrab","mangsnapper","barramundi"],"canal":["tilapia","crucian","carp","snakehead","pseudorasbora","mosquitofish","guppy","pleco","giantsnake","clarias"],"abyss":["mehikari","rattail","blackthroat","blobfish","fangtooth"],"mystic":["creolefish","razorsurgeon","idol","batfish"],"icelake":["wakasagi","shirauo","dolly","himemasu"],"icesea":["capelin","hokke","cod"],"reef":["rabbitfish","girella","blackgirella","lethrinus","parrot","butterfly","sergeant","lionfish","octopus","trevally"],"weir":["rabbitfish","sergeant","butterfly","girella","octopus","puffer"],"creek":["kuhua","lantern","shrimp","medaka","candidia","guppy"]}'::jsonb $j$;
create or replace function public._sci_spots() returns jsonb language sql immutable as $j$ select '{"river":{"label":"月灣河岸","short":"河岸"},"lake":{"label":"鏡湖","short":"湖邊"},"pool":{"label":"瀑布潭","short":"瀑布潭"},"sea":{"label":"晴潮海邊","short":"海邊"},"isle":{"label":"小島碼頭","short":"小島"},"harbor":{"label":"港口外海","short":"外海"},"mangrove":{"label":"紅樹林碼頭","short":"紅樹林"},"canal":{"label":"百年生態池","short":"生態池"},"abyss":{"label":"深海浮台","short":"深海"},"mystic":{"label":"神秘島礁岩","short":"神秘島"},"icelake":{"label":"冰湖冰洞","short":"冰湖"},"icesea":{"label":"流冰海岸","short":"流冰"},"reef":{"label":"珊瑚礁岸","short":"珊瑚礁"},"weir":{"label":"雙心石滬","short":"石滬"},"creek":{"label":"螢光溪間","short":"溪間"}}'::jsonb $j$;

create or replace function public._sci_color(h integer) returns text language sql immutable as $$
  select case when h < 12 or h >= 340 then '緋' when h < 30 then '橙' when h < 48 then '金' when h < 66 then '黃' when h < 100 then '檸' when h < 150 then '翠'
              when h < 185 then '碧' when h < 205 then '青' when h < 240 then '藍' when h < 265 then '靛' when h < 295 then '紫' when h < 325 then '紅紫' else '粉' end $$;

create or replace function public._sci_make(p_day date) returns public.sci_finds language plpgsql security definer set search_path = public as $$
declare r public.sci_finds; h bigint; spots text[]; prev text; sp text; pool text[]; b public.fish_species; hue int; hue2 int; part text; nm text; nid text; k numeric; kind text; st text; lbl text;
begin
  select * into r from public.sci_finds where day = p_day; if r.day is not null then return r; end if;
  h := public._fnv('sci' || p_day::text);
  spots := array(select s from jsonb_object_keys(public._sci_pool()) s order by s);
  select spot into prev from public.sci_finds where day = p_day - 1;
  sp := spots[1 + (h % cardinality(spots))::int];
  if sp = prev then sp := spots[1 + ((h % cardinality(spots)) + 1 + (h / 7) % (cardinality(spots) - 1))::int % cardinality(spots)]; end if;   -- 不要連兩天在同一個地方
  pool := array(select x from jsonb_array_elements_text(public._sci_pool()->sp) x);
  select * into b from public.fish_species where id = pool[1 + ((h / 64) % cardinality(pool))::int];
  if b.id is null then raise exception '找不到近親的魚'; end if;
  hue := ((h / 4096) % 360)::int; hue2 := ((hue + 90 + (h / 1048576) % 180) % 360)::int;
  part := (array['紋', '斑', '鰭', '背', '尾', '點', '鱗', '帶'])[1 + ((h / 16777216) % 8)::int];
  lbl := public._sci_spots()->sp->>'short';
  nm := lbl || public._sci_color(hue) || part || regexp_replace(b.name, '（.*）', '');
  nid := 'nx' || to_char(p_day, 'YYMMDD');
  k := 0.8 + ((h / 33) % 45) / 100.0;   -- 0.8～1.24 倍
  kind := case when (h / 3) % 2 = 0 then 'albino' else 'melan' end;
  st := (array[
    '蔚博士在' || (public._sci_spots()->sp->>'label') || '架了水下攝影機，拍到一群' || public._sci_color(hue) || '色的魚，仔細一看鰭的形狀跟' || b.name || '不一樣，是新品種！',
    '蔚博士跟著漁夫在' || (public._sci_spots()->sp->>'label') || '調查了一整天，網子裡有一條沒看過的魚：長得像' || b.name || '，但身上有' || public._sci_color(hue) || '色的' || part || '。',
    '蔚博士在' || (public._sci_spots()->sp->>'label') || '採集水樣的時候，發現一種' || b.name || '的近親，' || part || '的顏色很特別，已經送去比對 DNA，確定是新品種。',
    '蔚博士潛到' || (public._sci_spots()->sp->>'label') || '底下觀察了三個小時，記錄到一種會' || (array['在黃昏成群洄游', '躲在石縫裡等食物', '跟著海流慢慢漂', '在水草間跳來跳去'])[1 + ((h / 5) % 4)::int] || '的新品種，是' || b.name || '的親戚。'
  ])[1 + ((h / 11) % 4)::int];
  insert into public.fish_species (id, name, rarity, min_w, max_w) values (nid, nm, '稀有', round(b.min_w * k, 2), round(b.max_w * k, 2)) on conflict (id) do nothing;
  insert into public.fish_species (id, name, rarity, min_w, max_w) values (nid || 'v', (case kind when 'albino' then '白化' else '黑化' end) || nm, '稀有', round(b.min_w * k, 2), round(b.max_w * k * 1.1, 2)) on conflict (id) do nothing;
  begin insert into public.econ_fish (fish, stock, mult) values (nid, 6, 1), (nid || 'v', 6, 1) on conflict (fish) do nothing; exception when undefined_table then null; end;
  insert into public.sci_finds (day, id, base, spot, name, hue, hue2, shape, min_w, max_w, story, var_id, var_kind, var_name)
  values (p_day, nid, b.id, sp, nm, hue, hue2, round(0.92 + ((h / 97) % 17) / 100.0, 2), round(b.min_w * k, 2), round(b.max_w * k, 2), st, nid || 'v', kind, (case kind when 'albino' then '白化' else '黑化' end) || nm)
  on conflict (day) do nothing;
  select * into r from public.sci_finds where day = p_day; return r;
end $$;
revoke all on function public._sci_make(date) from public, anon, authenticated;

-- 手機讀的：所有發現（新的在前面）；今天的還沒做就先做
create or replace function public.sci_list() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if not exists (select 1 from public.sci_finds where day = d) then perform public._sci_make(d); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'id', s.id, 'base', s.base, 'spot', s.spot, 'name', s.name, 'hue', s.hue, 'hue2', s.hue2, 'shape', s.shape,
    'min', s.min_w, 'max', s.max_w, 'story', s.story, 'vid', s.var_id, 'vkind', s.var_kind, 'vname', s.var_name, 'first', s.first_by) order by s.day desc), '[]'::jsonb)
    from (select * from public.sci_finds where day <= d order by day desc limit 400) s);
end $$;
revoke all on function public.sci_list() from public, anon;
grant execute on function public.sci_list() to authenticated;

-- 第一個釣到新品種的人（record_catch 把 cast_fish 清掉的那一下）
create or replace function public._sci_first() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total = old.total + 1 and old.cast_fish like 'nx%' and new.cast_fish is null then
    update public.sci_finds set first_by = left(coalesce(new.nickname, '釣客'), 16), first_at = now() where id = old.cast_fish and first_by is null;
  end if;
  return new;
end $$;
drop trigger if exists sci_first on public.players;
create trigger sci_first after update of total on public.players for each row execute function public._sci_first();

do $$ begin
  perform public._sci_make((now() at time zone 'Asia/Taipei')::date);
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-sci-day', '1 16 * * *', 'select public._sci_make((now() at time zone ''Asia/Taipei'')::date)');   -- 台灣時間每天 0:01
  end if;
end $$;

select '海洋科學家蔚博士設定完成 🔬' as result;
