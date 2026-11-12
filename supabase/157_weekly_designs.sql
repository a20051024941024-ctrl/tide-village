-- 157 設計師每週新作品（v404）：可以重複執行。已經賣出去、已經擁有的東西都不變，價格規則不變。
-- 阿萍：新髮型「狼尾頭」「精靈短髮」（編號 31、32）。
-- 阿綾：新花樣「小愛心」（_ling_face 加 heart 的畫法、_ling_make 的 pats 加 heart；其他照 050 原樣）。
-- 阿木：新花樣「星星」（_mu_make 的 pats 加 star；畫法在 js/game.js 的 fzTex；其他照 052 原樣）。

create or replace function public._salon_hs_max() returns integer language sql immutable as $$ select 32 $$;

create or replace function public._ling_face(p_pat text, c integer[], p_mask boolean) returns text language plpgsql immutable as $$
declare out text := ''; x int; y int; v int; w int := 2; m text[];
  fish text[] := array['................','................','................','................','..........#.....','....#....###....','....##.#######..','.....#########.#','.....#####.###..','....##.#######..','....#....###....','..........#.....','................','................','................','................'];
  anchor text[] := array['................','.......##.......','......#..#......','.......##.......','.......##.......','....########....','.......##.......','.......##.......','.......##.......','..#....##....#..','..##...##...##..','...##..##..##...','....########....','......####......','................','................'];
  heart text[] := array['........','.##.##..','#######.','#######.','.#####..','..###...','...#....','........'];
begin
  m := case p_pat when 'fish' then fish when 'anchor' then anchor else null end;
  for y in 0..15 loop for x in 0..15 loop
    v := case p_pat
      when 'stripe' then case when (y / w) % 2 = 0 then c[1] else c[2] end
      when 'vstripe' then case when (x / w) % 2 = 0 then c[1] else c[2] end
      when 'check' then case when ((x / 4) + (y / 4)) % 2 = 0 then c[1] else c[2] end
      when 'dots' then case when y % 4 = 1 and (x + ((y / 4) % 2) * 2) % 4 = 1 then c[2] else c[1] end
      when 'wave' then case ((y + round(1.4 * sin(x * 0.8))::int + 30) / 3) % 3 when 0 then c[1] when 1 then c[2] else c[3] end
      when 'fade' then c[1 + least(3, y / 4)]
      when 'diag' then case when ((x + y) / 3) % 2 = 0 then c[1] else c[2] end
      when 'heart' then case when substr(heart[y % 8 + 1], (x + ((y / 8) % 2) * 4) % 8 + 1, 1) = '#' then c[2] else c[1] end
      when 'hem' then case when y < 2 or y > 13 then c[2] when y = 2 or y = 13 then c[3] when x % 5 = 2 and y % 5 = 2 then c[3] else c[1] end
      else c[1] end;
    if m is not null then
      v := case when y < 2 or y > 13 then c[3] else c[1] end;
      if not p_mask and substr(m[y + 1], x + 1, 1) = '#' then v := c[2]; end if;
    end if;
    out := out || to_hex(v);
  end loop; end loop;
  return out;
end $$;

create or replace function public._ling_make() returns integer language plpgsql security definer set search_path = public as $$
declare
  themes text[] := array['海洋','晚霞','森林','珊瑚','水手','楓葉','薰衣草','黑白','薄荷','檸檬','燈塔','月光'];
  cols integer[][] := array[[9,0,8,10],[4,5,2,13],[7,13,12,5],[3,6,0,4],[10,0,2,9],[12,4,13,2],[11,0,3,8],[1,0,15,14],[6,0,13,9],[5,0,9,4],[2,0,10,5],[10,5,14,0]];
  pats text[] := array['stripe','vstripe','check','dots','wave','fade','diag','hem','fish','anchor','heart'];
  pnames text[] := array['條紋','直條','格子','點點','波浪','漸層','斜紋','滾邊','小魚','船錨','小愛心'];
  kinds text[] := array['top','top','top','top','pants','pants','hat','hat','shoes','back','acc','acc'];
  kname jsonb := '{"top":"上衣","pants":"褲","hat":"帽","shoes":"鞋","back":"披風","acc":"領巾"}';
  t int := 1 + floor(random() * 12)::int; pi int := 1 + floor(random() * array_length(pats, 1))::int; k text := kinds[1 + floor(random() * 12)::int];
  c integer[] := cols[t:t][1:4]; cc integer[]; px text; price int; nid int;
begin
  select array_agg(v) into cc from unnest(c) v; c := cc;
  if random() < 0.4 then c := array[c[2], c[1], c[3], c[4]]; end if;   -- 有時候深淺顛倒
  px := public._ling_face(pats[pi], c, false);
  if k = 'top' then px := px || public._ling_face(pats[pi], c, true); end if;
  price := (array[0, 120, 150, 200, 280, 350, 450])[1 + floor(random() * 7)::int];
  insert into public.designs (owner, owner_name, kind, name, px, price)
    values (public._ling_id(), '阿綾', k, themes[t] || pnames[pi] || (kname->>k), px, price) returning id into nid;
  return nid;
end $$;
revoke all on function public._ling_make() from public, anon, authenticated;

create or replace function public._mu_make() returns integer language plpgsql security definer set search_path = public as $$
declare
  bases text[] := array['table','chair','chair','desk','shelf','ward','sofa','arm','arm','rug','rug','lamp','clock','bed','dbed'];
  bnames jsonb := '{"table":["餐桌","張"],"chair":["椅子","張"],"desk":["書桌","張"],"shelf":["書櫃","座"],"ward":["衣櫃","座"],"sofa":["沙發","張"],"arm":["單人沙發","張"],"rug":["地毯","塊"],"lamp":["立燈","盞"],"clock":["落地鐘","座"],"bed":["單人床","張"],"dbed":["雙人床","張"]}';
  woods text[] := array['漂流木','柚木','胡桃木','白橡木','檜木','黑檀木','竹子'];
  wcols text[] := array['#b8a890','#9a6a40','#5e4030','#d8c4a0','#c89a60','#3a2e28','#c8b878'];
  cnames text[] := array['海洋藍','晚霞橘','珊瑚粉','森林綠','檸檬黃','薰衣草','米白','海軍藍','番茄紅'];
  ccols text[] := array['#2f89c7','#ff9f43','#f5a5d8','#5d9c55','#ffd36a','#9b7bff','#f1e3c8','#18334a','#e8473a'];
  pats text[] := array['plain','stripe','check','wave','dots','grain','star'];
  pnames text[] := array['素面','條紋','格子','海浪','點點','木紋','星星'];
  pdesc text[] := array['素素的布面','一條一條的條紋布','格子布','海浪花紋','小圓點','特別留下來的木紋','小星星花紋'];
  b text := bases[1 + floor(random() * array_length(bases, 1))::int];
  wi int := 1 + floor(random() * 7)::int; ci int := 1 + floor(random() * 9)::int; pi int := 1 + floor(random() * array_length(pats, 1))::int;
  nm text; st text; price int; nid int;
begin
  nm := left(woods[wi] || pnames[pi] || (bnames->b->>0), 16);
  st := '這' || (bnames->b->>1) || (bnames->b->>0) || '是用' || woods[wi] || '做的，配了' || cnames[ci] || '的' || pdesc[pi];
  price := (array[0, 150, 200, 300, 400, 500, 600])[1 + floor(random() * 7)::int];
  insert into public.furn_designs (base, name, main, accent, pat, story, price)
    values (b, nm, wcols[wi], ccols[ci], pats[pi], st, price) returning id into nid;
  return nid;
end $$;
revoke all on function public._mu_make() from public, anon, authenticated;

select '設計師這週的新作品上架了 ✂️👗🪑' as result;
