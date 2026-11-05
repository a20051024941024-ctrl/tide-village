-- 潮汐釣魚村：蔚博士偶爾發現深海巨魚（可以重複執行）
-- 大約 6% 的日子（一個月一兩次、不會連兩天），蔚博士發現的不是一般新品種，而是深海巨魚：
--   近親是深海浮台的六鰓鯊、歐氏尖吻鮫，港口外海的大王魷、皇帶魚，流冰海岸的小頭睡鯊；身體 1.0～1.5 倍大，傳說級。
--   在發現的釣點才釣得到：發現當天每一竿約 1.5%（拋越遠越容易），之後 0.4%；一樣有很少見的白化／黑化變種。
-- 已經發現的一般新品種不受影響。

alter table public.sci_finds add column if not exists giant boolean not null default false;

create or replace function public._sci_giants() returns jsonb language sql immutable as $j$
  select '{"abyss":["sixgill","goblinshark"],"harbor":["giantsquid","oarfish"],"icesea":["sleepershark"]}'::jsonb $j$;

create or replace function public._sci_make(p_day date) returns public.sci_finds language plpgsql security definer set search_path = public as $$
declare r public.sci_finds; h bigint; spots text[]; prev text; sp text; pool text[]; b public.fish_species; hue int; hue2 int; part text; nm text; nid text; k numeric; kind text; st text; lbl text; giant boolean; rar text;
begin
  select * into r from public.sci_finds where day = p_day; if r.day is not null then return r; end if;
  h := public._fnv('sci' || p_day::text);
  spots := array(select s from jsonb_object_keys(public._sci_pool()) s order by s);
  select spot into prev from public.sci_finds where day = p_day - 1;
  -- 深海巨魚：大約 6% 的日子（一個月一兩次），而且不會連兩天
  giant := public._fnv('giant' || p_day::text) % 100 < 6 and not coalesce((select s2.giant from public.sci_finds s2 where s2.day = p_day - 1), false);
  rar := case when giant then '傳說' else '稀有' end;
  if giant then
    spots := array(select s from jsonb_object_keys(public._sci_giants()) s order by s); sp := spots[1 + (h % cardinality(spots))::int];
    pool := array(select x from jsonb_array_elements_text(public._sci_giants()->sp) x);
  else
  sp := spots[1 + (h % cardinality(spots))::int];
  if sp = prev then sp := spots[1 + ((h % cardinality(spots)) + 1 + (h / 7) % (cardinality(spots) - 1))::int % cardinality(spots)]; end if;   -- 不要連兩天在同一個地方
  pool := array(select x from jsonb_array_elements_text(public._sci_pool()->sp) x);
  end if;
  select * into b from public.fish_species where id = pool[1 + ((h / 64) % cardinality(pool))::int];
  if b.id is null then raise exception '找不到近親的魚'; end if;
  hue := ((h / 4096) % 360)::int; hue2 := ((hue + 90 + (h / 1048576) % 180) % 360)::int;
  part := (array['紋', '斑', '鰭', '背', '尾', '點', '鱗', '帶'])[1 + ((h / 16777216) % 8)::int];
  lbl := public._sci_spots()->sp->>'short';
  nm := lbl || public._sci_color(hue) || part || (case when giant then '巨' else '' end) || regexp_replace(b.name, '（.*）', '');
  nid := 'nx' || to_char(p_day, 'YYMMDD');
  k := case when giant then 1.0 + ((h / 33) % 50) / 100.0 else 0.8 + ((h / 33) % 45) / 100.0 end;   -- 一般 0.8～1.24 倍；巨魚 1.0～1.49 倍
  kind := case when (h / 3) % 2 = 0 then 'albino' else 'melan' end;
  if giant then st := (array[
    '蔚博士的深海攝影機在' || (public._sci_spots()->sp->>'label') || '拍到一個巨大的影子，慢慢從鏡頭前面游過去，光是背鰭就比人還長！比對之後確定是' || b.name || '的巨型近親，從來沒有人記錄過。',
    '蔚博士在' || (public._sci_spots()->sp->>'label') || '放下的聲納突然出現一大團回波，跟著追了一整夜，終於看清楚是一條' || public._sci_color(hue) || '色的巨魚，是' || b.name || '的親戚。',
    '漁夫說' || (public._sci_spots()->sp->>'label') || '的網被什麼東西整個扯破了。蔚博士去調查，在很深的地方找到牠：一條身上有' || public._sci_color(hue) || '色' || part || '的巨魚，比' || b.name || '還要大。'
  ])[1 + ((h / 11) % 3)::int]; else
  st := (array[
    '蔚博士在' || (public._sci_spots()->sp->>'label') || '架了水下攝影機，拍到一群' || public._sci_color(hue) || '色的魚，仔細一看鰭的形狀跟' || b.name || '不一樣，是新品種！',
    '蔚博士跟著漁夫在' || (public._sci_spots()->sp->>'label') || '調查了一整天，網子裡有一條沒看過的魚：長得像' || b.name || '，但身上有' || public._sci_color(hue) || '色的' || part || '。',
    '蔚博士在' || (public._sci_spots()->sp->>'label') || '採集水樣的時候，發現一種' || b.name || '的近親，' || part || '的顏色很特別，已經送去比對 DNA，確定是新品種。',
    '蔚博士潛到' || (public._sci_spots()->sp->>'label') || '底下觀察了三個小時，記錄到一種會' || (array['在黃昏成群洄游', '躲在石縫裡等食物', '跟著海流慢慢漂', '在水草間跳來跳去'])[1 + ((h / 5) % 4)::int] || '的新品種，是' || b.name || '的親戚。'
  ])[1 + ((h / 11) % 4)::int]; end if;
  insert into public.fish_species (id, name, rarity, min_w, max_w) values (nid, nm, rar, round(b.min_w * k, 2), round(b.max_w * k, 2)) on conflict (id) do nothing;
  insert into public.fish_species (id, name, rarity, min_w, max_w) values (nid || 'v', (case kind when 'albino' then '白化' else '黑化' end) || nm, rar, round(b.min_w * k, 2), round(b.max_w * k * 1.1, 2)) on conflict (id) do nothing;
  begin insert into public.econ_fish (fish, stock, mult) values (nid, 6, 1), (nid || 'v', 6, 1) on conflict (fish) do nothing; exception when undefined_table then null; end;
  insert into public.sci_finds (day, id, base, spot, name, hue, hue2, shape, min_w, max_w, story, var_id, var_kind, var_name, giant)
  values (p_day, nid, b.id, sp, nm, hue, hue2, round(0.92 + ((h / 97) % 17) / 100.0, 2), round(b.min_w * k, 2), round(b.max_w * k, 2), st, nid || 'v', kind, (case kind when 'albino' then '白化' else '黑化' end) || nm, giant)
  on conflict (day) do nothing;
  select * into r from public.sci_finds where day = p_day; return r;
end $$;
revoke all on function public._sci_make(date) from public, anon, authenticated;

create or replace function public.sci_list() returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if not exists (select 1 from public.sci_finds where day = d) then perform public._sci_make(d); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'id', s.id, 'base', s.base, 'spot', s.spot, 'name', s.name, 'hue', s.hue, 'hue2', s.hue2, 'shape', s.shape,
    'min', s.min_w, 'max', s.max_w, 'story', s.story, 'vid', s.var_id, 'vkind', s.var_kind, 'vname', s.var_name, 'first', s.first_by, 'giant', s.giant, 'rarity', case when s.giant then '傳說' else '稀有' end) order by s.day desc), '[]'::jsonb)
    from (select * from public.sci_finds where day <= d order by day desc limit 400) s);
end $$;
revoke all on function public.sci_list() from public, anon;
grant execute on function public.sci_list() to authenticated;

select '蔚博士的深海巨魚設定完成 🐋' as result;
