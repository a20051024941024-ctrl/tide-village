-- 潮汐釣魚村：阿綾服裝店（可以重複執行）
-- 阿綾是村子裡的服裝設計師 NPC，每天早上和傍晚會自己設計一件新衣服（或帽子、鞋子、披風、領巾）放到設計師市集。
-- 圖案是程式照「主題配色 × 花樣」畫出來的 16×16 格子，跟玩家自己設計的格式一模一樣；她的設計都不會下架（使用者 2026-11-04）。
-- 她不是玩家：賣出去的錢不會進任何人的帳戶。

create or replace function public._ling_id() returns uuid language sql immutable as $$ select 'a11e0000-0000-4000-8000-00000000a11e'::uuid $$;

-- 畫一面 16×16（p_mask：不要放小魚、船錨這種圖案，衣服背面用）
create or replace function public._ling_face(p_pat text, c integer[], p_mask boolean) returns text language plpgsql immutable as $$
declare out text := ''; x int; y int; v int; w int := 2; m text[];
  fish text[] := array['................','................','................','................','..........#.....','....#....###....','....##.#######..','.....#########.#','.....#####.###..','....##.#######..','....#....###....','..........#.....','................','................','................','................'];
  anchor text[] := array['................','.......##.......','......#..#......','.......##.......','.......##.......','....########....','.......##.......','.......##.......','.......##.......','..#....##....#..','..##...##...##..','...##..##..##...','....########....','......####......','................','................'];
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

-- 設計一件新的，放到市集
create or replace function public._ling_make() returns integer language plpgsql security definer set search_path = public as $$
declare
  themes text[] := array['海洋','晚霞','森林','珊瑚','水手','楓葉','薰衣草','黑白','薄荷','檸檬','燈塔','月光'];
  cols integer[][] := array[[9,0,8,10],[4,5,2,13],[7,13,12,5],[3,6,0,4],[10,0,2,9],[12,4,13,2],[11,0,3,8],[1,0,15,14],[6,0,13,9],[5,0,9,4],[2,0,10,5],[10,5,14,0]];
  pats text[] := array['stripe','vstripe','check','dots','wave','fade','diag','hem','fish','anchor'];
  pnames text[] := array['條紋','直條','格子','點點','波浪','漸層','斜紋','滾邊','小魚','船錨'];
  kinds text[] := array['top','top','top','top','pants','pants','hat','hat','shoes','back','acc','acc'];
  kname jsonb := '{"top":"上衣","pants":"褲","hat":"帽","shoes":"鞋","back":"披風","acc":"領巾"}';
  t int := 1 + floor(random() * 12)::int; pi int := 1 + floor(random() * 10)::int; k text := kinds[1 + floor(random() * 12)::int];
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

-- 市集多一個「阿綾的店」：p_mode = 'ling'
create or replace function public.list_designs(p_mode text, p_offset integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._design_row(d)), '[]'::jsonb) from (
    select * from public.designs d
    where case when p_mode = 'mine' then owner = auth.uid()
               when p_mode = 'ling' then owner = public._ling_id() and listed and not hidden
               else listed and not hidden end
    order by case when p_mode = 'hot' then sold end desc nulls last, id desc
    limit case when p_mode = 'ling' then 200 else 30 end offset greatest(0, coalesce(p_offset, 0))) d $$;
revoke all on function public.list_designs(text, integer) from public, anon;
grant execute on function public.list_designs(text, integer) to authenticated;

-- 之前下架的放回來
update public.designs set listed = true where owner = public._ling_id() and not listed and not hidden;

-- 開店的時候先擺 6 件
do $$ begin
  while (select count(*) from public.designs where owner = public._ling_id()) < 6 loop perform public._ling_make(); end loop;
end $$;

-- 每天台灣時間 10:07、18:07 各設計一件新的
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice '沒辦法開 pg_cron：%', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tide-ling-design', '7 2,10 * * *', 'select public._ling_make()');
  end if;
end $$;

select '阿綾服裝店開張了 👗' as result;
