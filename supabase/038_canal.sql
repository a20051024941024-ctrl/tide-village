-- 潮汐釣魚村：城市水圳（參考新竹湖口）（可以重複執行）
-- 新魚：食蚊魚、琵琶鼠魚、泰國鱧、革胡子鯰和牠們的變種；機率、釣點清單在 020（fishcfg.json）裡
-- 撈網（tool_net）：買了放在 owned；撿垃圾 pick_litter：每次愛海 +1，一天最多 20 個、兩次之間至少 4 秒
insert into public.fish_species (id, name, rarity, min_w, max_w) values
  ('mosquitofish', '食蚊魚（大肚魚）', '常見', 0.002, 0.01),
  ('pleco', '琵琶鼠魚', '常見', 0.2, 1.2),
  ('giantsnake', '泰國鱧（魚虎）', '稀有', 2.0, 15),
  ('clarias', '革胡子鯰（埃及塘蝨）', '稀有', 3.0, 20),
  ('mosquitofish_gold', '金色大肚魚', '稀有', 0.002, 0.01),
  ('pleco_albino', '白化琵琶鼠', '稀有', 0.2, 1.2),
  ('giantsnake_red', '火焰魚虎', '傳說', 2.0, 15),
  ('clarias_albino', '白化塘蝨', '傳說', 3.0, 20)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

alter table public.players add column if not exists litter_day date;
alter table public.players add column if not exists litter_n integer not null default 0;
alter table public.players add column if not exists litter_at timestamptz;

create or replace function public.buy_tool(p_tool text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); price integer := case p_tool when 'tool_net' then 800 end;
begin
  if price is null then raise exception '沒有這個商品'; end if;
  if p_tool = any(pl.owned) then return pl; end if;
  if pl.coins < price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - price, owned = array_append(owned, p_tool), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

create or replace function public.pick_litter() returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d date := (now() at time zone 'Asia/Taipei')::date; n integer;
begin
  n := case when pl.litter_day = d then pl.litter_n else 0 end;
  if n >= 20 then raise exception '今天已經撿很多了'; end if;
  if pl.litter_at is not null and now() - pl.litter_at < interval '4 seconds' then raise exception '等一下再撿'; end if;
  update public.players set love = love + 1, litter_day = d, litter_n = n + 1, litter_at = now(), updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['buy_tool(text)', 'pick_litter()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '城市水圳設定完成 🏙️' as result;
