-- 102 阿鐵師傅的工坊（v253）：用魚缸裡的魚＋金幣做竿子造型（rs_）和釣線顏色（lc_）。可以重複執行。
-- 用哪幾條魚由伺服器決定：同稀有度裡最輕的，不會用到收藏（k）、展示中的、變種。做好的東西放進 owned（跟衣服一樣），一人一個、不能交易。
-- 每人每天最多做 10 件。只是外觀，不影響釣魚機率。
alter table public.players add column if not exists rod_skin text;
alter table public.players add column if not exists line_col text;
create table if not exists public.craft_log (uid uuid not null, day date not null, n integer not null default 0, primary key (uid, day));
alter table public.craft_log enable row level security;

create or replace function public._craft_def(p text) returns jsonb language sql immutable as $$
  select (case p
    when 'rs_bamboo'  then '{"c":400,"n":3,"r":"常見"}' when 'rs_wood'   then '{"c":500,"n":3,"r":"常見"}'
    when 'rs_stripe'  then '{"c":800,"n":4,"r":"常見"}' when 'rs_wave'   then '{"c":1200,"n":5,"r":"常見"}'
    when 'rs_coral'   then '{"c":1200,"n":5,"r":"常見"}' when 'rs_carbon' then '{"c":2000,"n":2,"r":"稀有"}'
    when 'rs_gold'    then '{"c":4000,"n":3,"r":"稀有"}' when 'rs_rainbow' then '{"c":6000,"n":4,"r":"稀有"}'
    when 'lc_red'     then '{"c":200,"n":2,"r":"常見"}' when 'lc_yellow' then '{"c":200,"n":2,"r":"常見"}'
    when 'lc_green'   then '{"c":300,"n":2,"r":"常見"}' when 'lc_pink'   then '{"c":300,"n":2,"r":"常見"}'
    when 'lc_blue'    then '{"c":800,"n":1,"r":"稀有"}' when 'lc_gold'   then '{"c":1500,"n":2,"r":"稀有"}'
    else null end)::jsonb $$;

create or replace function public.craft_item(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d jsonb := public._craft_def(p_id); cfg jsonb := public._fishcfg(); use text[]; td date := (now() at time zone 'Asia/Taipei')::date; cnt integer;
begin
  if d is null then raise exception '阿鐵師傅不會做這個'; end if;
  select * into pl from public.players where id = pl.id for update;
  if p_id = any(pl.owned) then raise exception '你已經有了'; end if;
  if pl.coins < (d->>'c')::integer then raise exception '金幣不夠'; end if;
  select n into cnt from public.craft_log where uid = pl.id and day = td;
  if coalesce(cnt, 0) >= 10 then raise exception '阿鐵師傅今天做累了，明天再來'; end if;
  select array_agg(t) into use from (
    select x->>'t' as t from jsonb_array_elements(coalesce(pl.tank, '[]'::jsonb)) x
    where coalesce(cfg->'fish'->(x->>'f')->>'r', (select rarity from public.fish_species where id = x->>'f'), '常見') = d->>'r'
      and not coalesce((cfg->'fish'->(x->>'f')->>'v')::boolean, false) and not coalesce((x->>'k')::boolean, false)
      and not exists (select 1 from jsonb_array_elements(coalesce(pl.show, '[]'::jsonb)) s where s #>> '{}' = x->>'t')
    order by (x->>'w')::numeric limit (d->>'n')::integer) q;
  if coalesce(array_length(use, 1), 0) < (d->>'n')::integer then raise exception '魚不夠：要 % 條%的魚（收藏、展示中的不算）', d->>'n', d->>'r'; end if;
  update public.players set coins = coins - (d->>'c')::integer, owned = array_append(owned, p_id),
    tank = coalesce((select jsonb_agg(x) from jsonb_array_elements(tank) x where not (x->>'t' = any(use))), '[]'::jsonb),
    updated_at = now() where id = pl.id returning * into pl;
  insert into public.craft_log (uid, day, n) values (pl.id, td, 1) on conflict (uid, day) do update set n = public.craft_log.n + 1;
  return jsonb_build_object('player', to_jsonb(pl), 'used', to_jsonb(use));
end $$;

create or replace function public.set_rod_look(p_skin text, p_line text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_skin is not null and not (p_skin like 'rs\_%' and p_skin = any(pl.owned)) then raise exception '你還沒有這個造型'; end if;
  if p_line is not null and not (p_line like 'lc\_%' and p_line = any(pl.owned)) then raise exception '你還沒有這個顏色'; end if;
  update public.players set rod_skin = p_skin, line_col = p_line, updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;

do $$ declare f text; begin
  foreach f in array array['_craft_def(text)', 'craft_item(text)', 'set_rod_look(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop; end $$;
