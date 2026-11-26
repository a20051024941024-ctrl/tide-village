-- 255 潮汐釣魚村 v917：訂單板（世界做深第一步）第 1 段：訂單怎麼出、訂單板的內容。可以重複執行。貼完這個再貼 256。
-- ・港邊廣場的訂單板每 4 小時換一批（台灣時間 0、4、8、12、16、20 點），一批 4 張：兩張小單、一張中單、一張大單。
-- ・訂單要的東西：魚缸裡的魚（指定魚種、指定重量、或隨便的小魚）、料理、材料、菜籃裡的菜。
-- ・交貨由伺服器檢查、收走東西、發金幣、經驗和「村子貢獻」。全村的貢獻加在一起（public.village），之後村子發展會用到。
-- ・菜籃：收成的金幣照舊，另外留一顆在背包（crop_作物，最多 99 顆），用來交訂單。

alter table public.players add column if not exists order_slot bigint;
alter table public.players add column if not exists order_done integer[] not null default '{}';
alter table public.players add column if not exists order_pts integer not null default 0;
alter table public.players add column if not exists order_n integer not null default 0;
alter table public.players add column if not exists xp_bonus integer not null default 0;

create table if not exists public.village (id integer primary key, pts bigint not null default 0, orders bigint not null default 0, updated_at timestamptz not null default now());
insert into public.village (id) values (1) on conflict (id) do nothing;
alter table public.village enable row level security;
revoke all on table public.village from public, anon, authenticated;

create or replace function public._ord_slot() returns bigint language sql stable as $$
  select floor((extract(epoch from now()) + 28800) / 14400)::bigint $$;

create or replace function public._ord_h(p_slot bigint, p_i integer, p_salt text) returns integer language sql immutable as $$
  select abs(('x' || substr(md5(p_slot::text || ':' || p_i || ':' || p_salt), 1, 7))::bit(28)::int) $$;

/* 可以被訂的魚：照釣魚設定（_fishcfg）挑，不含變種、節慶魚、很少出現的。回傳 {"home:c":[常見], "home:r":[稀有], "reef:c":…}；home＝村子附近，其他是要坐船去的地方 */
create or replace function public._ord_pools() returns jsonb language sql stable set jit = off as $$   -- 不關 jit 的話，每次會多花零點幾秒在編譯
  with cfg as materialized (select public._fishcfg() c),
  f as materialized (select e.key id, e.value v from cfg, jsonb_each(cfg.c->'fish') e),
  s as materialized (select distinct x.id, case when sp.key in ('river', 'lake', 'sea', 'harbor', 'pool', 'creek', 'canal') then 'home' when sp.key in ('icesea', 'icelake') then 'ice' else sp.key end z
        from cfg, jsonb_each(cfg.c->'spots') sp, jsonb_array_elements_text(sp.value->'fish') x(id)),
  ok as (select s.z, fs.rarity r, s.id from s join f on f.id = s.id join public.fish_species fs on fs.id = s.id
         where fs.rarity in ('常見', '稀有') and coalesce((f.v->>'v')::boolean, false) = false and not (f.v ? 'fest') and not (f.v ? 'of')
           and s.id not in ('horseshoe', 'dolphin', 'beluga', 'turtle')
           and coalesce((f.v->>'w')::numeric, 1) >= case when fs.rarity = '常見' then 0.9 else 0.6 end
           and (s.z = 'home' or not exists (select 1 from s h where h.id = s.id and h.z = 'home')))
  select coalesce(jsonb_object_agg(q.k, q.ids), '{}'::jsonb)
  from (select ok.z || (case ok.r when '常見' then ':c' else ':r' end) k, jsonb_agg(ok.id order by ok.id) ids from ok group by 1) q $$;

/* 一樣東西：魚（p_frac > 0 表示有重量要求）；v 是算獎勵用的價值 */
create or replace function public._ord_fish(p_id text, p_n integer, p_frac numeric) returns jsonb language sql stable as $$
  select jsonb_build_object('k', 'fish', 'f', sp.id, 'n', p_n,
    'minw', case when p_frac > 0 then round(sp.min_w + (sp.max_w - sp.min_w) * p_frac, 2) else 0 end,
    'v', round((case sp.rarity when '常見' then 10 when '稀有' then 60 else 400 end) * (1 + 1.5 * (case when p_frac > 0 then p_frac else 0.4 end)) * p_n))
  from public.fish_species sp where sp.id = p_id $$;

create or replace function public._ord_item(p_k text, p_key text, p_n integer) returns jsonb language sql stable as $$
  select case p_k
    when 'small' then jsonb_build_object('k', 'small', 'n', p_n, 'maxw', 0.6, 'v', 8 * p_n)
    when 'mat'   then jsonb_build_object('k', 'mat', 'm', p_key, 'n', p_n, 'v', (case p_key when 'mat_scale' then 20 else 30 end) * p_n)
    when 'crop'  then (select jsonb_build_object('k', 'crop', 'c', p_key, 'n', p_n, 'v', round(c.sell * 0.25) * p_n) from public._farm_crop(p_key) c where c.sell is not null)
    when 'dish'  then (select jsonb_build_object('k', 'dish', 'r', p_key, 'n', p_n, 'v', r.value * p_n) from public._recipe(p_key) r where r.value is not null)
  end $$;

revoke all on function public._ord_slot(), public._ord_h(bigint, integer, text), public._ord_pools(), public._ord_fish(text, integer, numeric), public._ord_item(text, text, integer) from public, anon, authenticated;


/* 這一批的 4 張訂單（照時段算出來，大家看到的都一樣）。kind 是給遊戲選哪一句話用的 */
create or replace function public._orders(p_slot bigint)
returns table(i integer, who text, tier integer, kind text, items jsonb, reward integer, pts integer, xp integer) language plpgsql stable as $$
declare P jsonb := public._ord_pools(); ch text[] := array(select jsonb_array_elements_text(P->'home:c')); rh text[] := array(select jsonb_array_elements_text(P->'home:r')); cf text[]; rf text[];
  crops text[] := array['tomato', 'cabbage', 'corn', 'sweetpotato']; crops2 text[] := array['tomato', 'cabbage', 'corn', 'sweetpotato', 'strawberry', 'pumpkin', 'kelp', 'seagrape'];
  mats text[] := array['mat_wood', 'mat_shell', 'mat_net']; dishes text[] := array['saba', 'ayu', 'suzuki', 'ikayaki', 'sanbei', 'tilapia', 'mori', 'tako', 'sumi', 'unadon', 'fugu', 'tai'];
  zones text[] := array['reef', 'isle', 'mangrove', 'moss', 'ice', 'mystic'];
  h integer; h2 integer; h3 integer; t integer; t0 integer := 0; a jsonb[]; idx integer; nc integer; nr integer; nf integer; d text; z text; far integer;
begin
  if cardinality(ch) < 6 then ch := array['mackerel', 'perch', 'crucian', 'kuhua', 'tilapia', 'bonito', 'bass', 'squid', 'flounder', 'ika', 'scorpion', 'goldfish']; end if;
  if cardinality(rh) < 4 then rh := array['moonbream', 'catfish', 'eel', 'carp', 'puffer', 'cuttle', 'salmon', 'barracuda', 'snakehead', 'octopus']; end if;
  nc := cardinality(ch); nr := cardinality(rh);
  for idx in 0..3 loop
    h := public._ord_h(p_slot, idx, 'a'); h2 := public._ord_h(p_slot, idx, 'b'); h3 := public._ord_h(p_slot, idx, 'c'); far := 0;
    z := zones[1 + (h / 11) % 6]; cf := array(select jsonb_array_elements_text(P->(z || ':c'))); rf := array(select jsonb_array_elements_text(P->(z || ':r'))); nf := cardinality(cf);
    if idx < 2 then
      tier := 1; if idx = 0 then t := h % 5; t0 := t; else t := (t0 + 1 + h % 4) % 5; end if;
      if t = 0 then who := 'mei'; kind := 'set'; a := array[public._ord_fish(ch[1 + h2 % nc], 2 + h3 % 2, 0)];
      elsif t = 1 then who := 'pet'; kind := 'cat'; a := array[public._ord_item('small', null, 3 + h3 % 2)];
      elsif t = 2 then who := 'tie'; kind := 'fix'; a := array[public._ord_item('mat', mats[1 + h2 % 3], 2 + h3 % 2)];
      elsif t = 3 then who := 'mei'; kind := 'veg'; a := array[public._ord_item('crop', crops[1 + h2 % 4], 2 + h3 % 2)];
      else who := 'fu'; kind := 'stock'; a := array[public._ord_fish(ch[1 + h2 % nc], 2, 0), public._ord_fish(ch[1 + (h2 % nc + 1 + h3 % (nc - 1)) % nc], 2, 0)];
      end if;
    elsif idx = 2 then
      tier := 2; t := h % 5; if t = 3 and nf < 2 then t := 0; end if;
      if t = 0 then who := 'aqua'; kind := 'tank'; a := array[public._ord_fish(rh[1 + h2 % nr], 1, 0.35)];
      elsif t = 1 then who := 'mei'; kind := 'dish'; d := dishes[1 + h2 % 12]; a := array[public._ord_item('dish', d, case when d in ('tako', 'sumi', 'unadon', 'fugu', 'tai', 'mori') then 1 else 2 end)];
      elsif t = 2 then who := 'mei'; kind := 'lunch'; a := array[public._ord_fish(ch[1 + h2 % nc], 3, 0), public._ord_item('crop', crops[1 + h3 % 4], 2)];
      elsif t = 3 then who := 'sci'; kind := 'sample'; far := 60; a := array[public._ord_fish(cf[1 + h2 % nf], 2, 0), public._ord_fish(cf[1 + (h2 % nf + 1 + h3 % (nf - 1)) % nf], 2, 0)];
      else who := 'tie'; kind := 'craft'; a := array[public._ord_item('mat', mats[1 + h2 % 3], 2), public._ord_item('mat', mats[1 + (h2 % 3 + 1 + h3 % 2) % 3], 2), public._ord_item('mat', 'mat_scale', 2)];
      end if;
    else
      tier := 3; t := h % 4; if t = 3 and (nf < 1 or cardinality(rf) < 1) then t := 0; end if;
      if t = 0 then who := 'chief'; kind := 'feast'; a := array[public._ord_fish(ch[1 + h2 % nc], 3, 0), public._ord_fish(rh[1 + h3 % nr], 1, 0), public._ord_item('crop', crops2[1 + (h2 / 7) % 8], 3)];
      elsif t = 1 then who := 'museum'; kind := 'exhibit'; a := array[public._ord_fish(rh[1 + h2 % nr], 1, 0.5), public._ord_fish(rh[1 + (h2 % nr + 1 + h3 % (nr - 1)) % nr], 1, 0)];
      elsif t = 2 then who := 'fu'; kind := 'bulk'; a := array[public._ord_fish(ch[1 + h2 % nc], 3, 0), public._ord_fish(ch[1 + (h2 % nc + 1 + h3 % (nc - 1)) % nc], 3, 0), public._ord_fish(rh[1 + (h3 / 5) % nr], 1, 0)];
      else who := 'aqua'; kind := 'far'; far := 120; a := array[public._ord_fish(cf[1 + h2 % nf], 2, 0), public._ord_fish(rf[1 + h3 % cardinality(rf)], 1, 0)];
      end if;
    end if;
    a := array_remove(a, null); if cardinality(a) = 0 then a := array[public._ord_item('small', null, 3)]; end if;
    i := idx; items := to_jsonb(a);
    reward := (round((select sum((x->>'v')::numeric) from unnest(a) x) * 1.8 / 5) * 5)::integer + (array[40, 80, 200])[tier] + far;
    pts := (array[1, 2, 4])[tier]; xp := (array[30, 60, 120])[tier];
    return next;
  end loop;
end $$;

/* 訂單板現在的樣子：這一批訂單、我交了哪幾張、還剩幾秒換下一批、我的和全村的貢獻 */
create or replace function public.get_orders() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); s bigint := public._ord_slot(); vg public.village;
begin
  select * into vg from public.village where id = 1;
  return jsonb_build_object('slot', s, 'left', greatest(0, ((s + 1) * 14400 - 28800 - extract(epoch from now()))::integer),
    'pts', pl.order_pts, 'n', pl.order_n, 'vpts', coalesce(vg.pts, 0), 'vn', coalesce(vg.orders, 0),
    'can', to_regprocedure('public.order_deliver(bigint,integer,bigint[],bigint[])') is not null,   -- 256 貼了沒（還沒貼就先只能看）
    'list', (select jsonb_agg(jsonb_build_object('i', o.i, 'who', o.who, 'tier', o.tier, 'kind', o.kind, 'items', o.items, 'reward', o.reward, 'pts', o.pts, 'xp', o.xp,
               'done', pl.order_slot = s and o.i = any(pl.order_done)) order by o.i) from public._orders(s) o));
end $$;

revoke all on function public._orders(bigint) from public, anon, authenticated;
revoke all on function public.get_orders() from public, anon;
grant execute on function public.get_orders() to authenticated;
notify pgrst, 'reload schema';

select '訂單板 1/2 好了 📋 接著貼 256' as result;
