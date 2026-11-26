-- 250 設計師每週新作品（v891）：可以重複執行。已經賣出去、已經擁有的東西都不變，價格規則不變。
-- 阿木：新花樣「菱格紋」（_mu_make 的 pats 加 diamond；畫法在 js/game.js 的 fzTex；其他照 198 原樣）。
-- 阿萍、阿綾這週沒有新作品：兩間店從 v743 起整修中（新人物用不到舊髮型、舊衣服）。

create or replace function public._mu_make() returns integer language plpgsql security definer set search_path = public as $$
declare
  bases text[] := array['table','chair','chair','desk','shelf','ward','sofa','arm','arm','rug','rug','lamp','clock','bed','dbed'];
  bnames jsonb := '{"table":["餐桌","張"],"chair":["椅子","張"],"desk":["書桌","張"],"shelf":["書櫃","座"],"ward":["衣櫃","座"],"sofa":["沙發","張"],"arm":["單人沙發","張"],"rug":["地毯","塊"],"lamp":["立燈","盞"],"clock":["落地鐘","座"],"bed":["單人床","張"],"dbed":["雙人床","張"]}';
  woods text[] := array['漂流木','柚木','胡桃木','白橡木','檜木','黑檀木','竹子'];
  wcols text[] := array['#b8a890','#9a6a40','#5e4030','#d8c4a0','#c89a60','#3a2e28','#c8b878'];
  cnames text[] := array['海洋藍','晚霞橘','珊瑚粉','森林綠','檸檬黃','薰衣草','米白','海軍藍','番茄紅'];
  ccols text[] := array['#2f89c7','#ff9f43','#f5a5d8','#5d9c55','#ffd36a','#9b7bff','#f1e3c8','#18334a','#e8473a'];
  pats text[] := array['plain','stripe','check','wave','dots','grain','star','herring','diamond'];
  pnames text[] := array['素面','條紋','格子','海浪','點點','木紋','星星','人字紋','菱格紋'];
  pdesc text[] := array['素素的布面','一條一條的條紋布','格子布','海浪花紋','小圓點','特別留下來的木紋','小星星花紋','一排一排左右交錯的人字紋','一格一格斜斜的菱格紋'];
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

select '阿木這週的新花樣上架了 🪑' as result;
