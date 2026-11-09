-- 131 女玩家變多，造型一次推出（v335）：阿萍設計好的髮型（10～30 號）全部上架、不用再等兩天一款；髮色一次多 30 種，之後一樣每天一色。
-- 另外請阿綾一次多設計 10 件衣服（她平常一天兩件，設計過的都會一直賣）。可以重複執行（阿綾那段每執行一次就多 10 件）。
create or replace function public._salon_ok(p_kind text, p_n integer) returns boolean language sql stable as $$
  select case p_kind when 'hs' then p_n between 10 and public._salon_hs_max()
                     when 'hc' then p_n between 11 and 999 and (p_n - 11) < 33 + public._salon_days() else false end $$;

do $$ begin for i in 1..10 loop perform public._ling_make(); end loop; end $$;
update public.designs set listed = true where owner = public._ling_id() and not listed and not hidden;
