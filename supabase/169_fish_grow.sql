-- 169 魚的成長進化（v437）：箱網養得夠久、夠大的魚會變成「魚王」，魚王有機會變成變種。可以重複執行。
-- 規則（每天餵一次，一次 20 金幣，跟以前一樣）：
--   1. 每次餵，魚往最大重量長 12%（不變），並且多記一次 fd。
--   2. 魚王 👑：被餵滿 21 次，而且體型到這種魚的九成以上 → 變成魚王（cr），重量直接補到這種魚的最大。
--   3. 變種 ✨：已經是魚王、而且這種魚有變種（_evo_of）→ 之後每次餵有 4% 機會變成變種（ev），餵到第 60 次一定變。
--      變種還是魚王、重量是變種的最大。大約要每天餵五、六個星期，是長期養魚的獎勵。
--   以前就在箱網裡的魚沒有 fd：第一次餵的時候用「已經長了多少」回推牠被餵過幾次，不讓老玩家從零開始。
-- 魚王和養出來的變種只是魚缸裡的魚：不算進圖鑑、最重紀錄、排行榜（那些只算釣到的）。賣價照魚種和重量算，沒有額外加成。

create or replace function public._evo_of(f text) returns text[] language sql immutable as $$
  select case f when 'amberjack' then array['amberjack_gold'] when 'girella' then array['girella_gold'] when 'rabbitfish' then array['rabbitfish_gold']
                when 'lethrinus' then array['lethrinus_red'] when 'tilapia' then array['tilapia_red'] else array[]::text[] end $$;

create or replace function public.cage_feed() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date;
  x jsonb; outc jsonb := '[]'::jsonb; sp public.fish_species; vs public.fish_species; wt numeric; w_0 numeric; n integer; ev text[]; vid text;
begin
  if jsonb_array_length(pl.cage) = 0 then raise exception '箱網裡還沒有魚'; end if;
  if pl.cage_fed = d then raise exception '今天已經餵過了'; end if;
  if pl.coins < 20 then raise exception '金幣不夠'; end if;
  for x in select e from jsonb_array_elements(pl.cage) with ordinality q(e, i) order by i loop
    select * into sp from public.fish_species where id = x->>'f';
    if sp.id is null then outc := outc || jsonb_build_array(x); continue; end if;
    wt := (x->>'w')::numeric; w_0 := coalesce((x->>'w0')::numeric, wt);
    if x ? 'fd' then n := (x->>'fd')::integer;
    elsif sp.max_w - wt <= 0.05 then n := 21;
    elsif sp.max_w - w_0 > 0 and wt > w_0 then n := least(21, greatest(0, floor(ln((sp.max_w - wt) / (sp.max_w - w_0)) / ln(0.88))::integer));
    else n := 0; end if;
    n := n + 1;
    wt := least(sp.max_w, round(wt + (sp.max_w - wt) * 0.12, 2));
    x := x || jsonb_build_object('w', wt, 'fd', n);
    if not (x ? 'cr') then
      if n >= 21 and wt >= sp.min_w + 0.9 * (sp.max_w - sp.min_w) then x := x || jsonb_build_object('cr', true, 'w', sp.max_w); end if;
    elsif not (x ? 'ev') then
      ev := public._evo_of(sp.id);
      if array_length(ev, 1) > 0 and (random() < 0.04 or n >= 60) then
        vid := ev[1 + floor(random() * array_length(ev, 1))::integer];
        select * into vs from public.fish_species where id = vid;
        if vs.id is not null then x := x || jsonb_build_object('f', vs.id, 'ev', true, 'w', vs.max_w); end if;
      end if;
    end if;
    outc := outc || jsonb_build_array(x);
  end loop;
  update public.players set cage = outc, coins = coins - 20, cage_fed = d, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ begin
  revoke all on function public.cage_feed() from public, anon;
  grant execute on function public.cage_feed() to authenticated;
end $$;
