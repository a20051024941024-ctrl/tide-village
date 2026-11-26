-- 253 潮汐釣魚村 v896：島上的幫手會做三種工作，做久了變熟練（1～5 顆星）。可以重複執行。
-- ・🎣 釣魚：白天在碼頭釣魚，魚放進公共儲物箱。星星越多越常釣到稀有的魚。
-- ・🌱 顧田：幫島上的田澆水，熟了就收，賣的錢給島主。星星越多一小時做越多株。
-- ・🪓 開地：用大家放進他錢包的金幣，一格一格把樹林開成地（價錢跟自己開一樣），木頭給島主。星星越多開越快。
-- ・還是一個 🪙1500、一座島最多 2 個。白天（台灣時間 6～22 點）工作，晚上睡覺。

alter table public.isle_npcs add column if not exists job text not null default 'fish';
alter table public.isle_npcs add column if not exists xp jsonb not null default '{}'::jsonb;
alter table public.isle_npcs add column if not exists wallet integer not null default 0;
alter table public.isle_npcs add column if not exists prog integer not null default 0;
alter table public.isle_npcs add column if not exists act jsonb;
do $$ begin
  begin alter table public.isle_npcs add constraint isle_npcs_job_chk check (job in ('fish', 'farm', 'land')); exception when duplicate_object then null; end;
end $$;

create or replace function public._npc_star(x integer) returns integer language sql immutable as $$
  select case when x < 30 then 1 when x < 100 then 2 when x < 250 then 3 when x < 500 then 4 else 5 end $$;

/* 補算一座島的幫手（一小時一小時算，最多補 24 小時） */
create or replace function public._isle_npc_tick(p_owner uuid) returns integer language plpgsql security definer set search_path = public as $$
declare n public.isle_npcs; t timestamptz; h numeric; rate numeric; got int; total int := 0; pool text[]; rare text[]; f text; sp public.fish_species; w numeric; k int; day_n int;
  st int; vx int; fp public.farm_plots; c record; pay int; nw int; nh int; tiles int[]; ti int; tj int; price int; did boolean;
begin
  perform 1 from public.players where id = p_owner for update;
  select array_agg(x) into pool from jsonb_array_elements_text(public._fishcfg()->'spots'->'isle'->'fish') x join public.fish_species s on s.id = x where s.rarity = '常見' and not (public._fishcfg()->'fish'->x ? 'v');
  select array_agg(x) into rare from jsonb_array_elements_text(public._fishcfg()->'spots'->'isle'->'fish') x join public.fish_species s on s.id = x where s.rarity = '稀有' and not (public._fishcfg()->'fish'->x ? 'v');
  for n in select * from public.isle_npcs where owner = p_owner for update loop
    t := greatest(n.last_tick, now() - interval '24 hours'); day_n := 0;
    vx := coalesce((n.xp->>n.job)::int, 0);
    rate := case n.trait when 'hard' then 1.3 when 'sleepy' then 0.5 when 'chatty' then 0.7 else 0.9 end;
    while t + interval '1 hour' <= now() loop
      t := t + interval '1 hour'; h := extract(hour from t at time zone 'Asia/Taipei');
      if h < 6 or h >= 22 or (n.trait = 'sleepy' and (h < 9 or h >= 20)) then continue; end if;
      st := public._npc_star(vx);
      if n.job = 'fish' then
        if pool is null then continue; end if;
        got := floor(rate + random())::int;
        for k in 1 .. got loop
          if (select count(*) from public.isle_store where owner = p_owner) >= 60 then
            if not exists (select 1 from jsonb_array_elements(n.log) e where e->>'txt' like '儲物箱滿了%' and (e->>'at')::timestamptz > t - interval '6 hours') then n.log := public._isle_npc_log(n.log, t, '儲物箱滿了，先休息一下'); end if;
            exit; end if;
          f := case when rare is not null and random() < 0.04 * st then rare[1 + floor(random() * array_length(rare, 1))::int] else pool[1 + floor(random() * array_length(pool, 1))::int] end;
          select * into sp from public.fish_species where id = f;
          w := round((sp.min_w + (sp.max_w - sp.min_w) * random() * (0.5 + 0.06 * st))::numeric, 2);
          insert into public.isle_store (owner, item, by_uid, by_name) values (p_owner, jsonb_build_object('f', f, 'w', w, 't', (extract(epoch from t) * 1000)::bigint + k), p_owner, n.name || '（幫手）');
          if sp.rarity = '稀有' then n.log := public._isle_npc_log(n.log, t, '釣到稀有的' || sp.name || '了！'); end if;
          n.total := n.total + 1; day_n := day_n + 1; total := total + 1; vx := vx + 1;
        end loop;
        if h = 21 and day_n > 0 then n.log := public._isle_npc_log(n.log, t, '今天釣了 ' || day_n || ' 條，都放進儲物箱了'); day_n := 0; end if;
      elsif n.job = 'farm' then
        nw := 0; nh := 0; pay := 0;
        for fp in select * from public.farm_plots where owner = p_owner and slot >= 1000 order by planted_at limit 300 for update loop
          if t >= public._farm_ripe_at(fp.crop, fp.planted_at, fp.waters) then
            if nh >= round((3 + 2 * st) * rate) then continue; end if;
            select * into c from public._farm_crop(fp.crop);
            pay := pay + round(c.sell * (case when fp.waters >= 2 then 1.5 else 1 end));
            delete from public.farm_plots where owner = p_owner and slot = fp.slot; nh := nh + 1;
          elsif fp.waters < 3 and (fp.watered_at is null or fp.watered_at <= t - interval '1 hour') then
            if nw >= round((6 + 3 * st) * rate) then continue; end if;
            update public.farm_plots set waters = waters + 1, watered_at = t where owner = p_owner and slot = fp.slot; nw := nw + 1;
          end if;
        end loop;
        if pay > 0 then update public.players set coins = coins + pay, earned = earned + pay where id = p_owner; end if;
        if nw + nh > 0 then vx := vx + least(6, 1 + (nw + nh) / 4); n.total := n.total + nh; day_n := day_n + nh;
          n.act := jsonb_build_object('k', 'farm', 'at', t); end if;
        if nh > 0 then n.log := public._isle_npc_log(n.log, t, '收了 ' || nh || ' 株，賣了 🪙' || pay || ' 給島主'); end if;
      else   -- land
        price := least(600, 150 + 3 * coalesce(cardinality((select isle_tiles from public.players where id = p_owner)), 0));
        if n.wallet < price then
          if not exists (select 1 from jsonb_array_elements(n.log) e where e->>'txt' like '錢包%' and (e->>'at')::timestamptz > t - interval '12 hours') then n.log := public._isle_npc_log(n.log, t, '錢包不夠開下一格（要 🪙' || price || '），先休息'); end if;
          continue; end if;
        n.prog := n.prog + 1;
        if n.prog < greatest(1, 6 - st) then continue; end if;
        select isle_tiles into tiles from public.players where id = p_owner;
        select i, j into ti, tj from generate_series(-14, 14) i, generate_series(-14, 14) j
          where public._isle_tile_ok(i, j) and not public._isle_tile_mine(tiles, i, j)
            and (public._isle_tile_mine(tiles, i + 1, j) or public._isle_tile_mine(tiles, i - 1, j) or public._isle_tile_mine(tiles, i, j + 1) or public._isle_tile_mine(tiles, i, j - 1))
          order by i * i + j * j, i, j limit 1;
        if ti is null then
          if not exists (select 1 from jsonb_array_elements(n.log) e where e->>'txt' like '整座島%') then n.log := public._isle_npc_log(n.log, t, '整座島都開好了！'); end if;
          n.prog := 0; continue; end if;
        update public.players set isle_tiles = array_append(coalesce(isle_tiles, '{}'), public._isle_tile_id(ti, tj)), bait = public._bag_add(coalesce(bait, '{}'::jsonb), 'mat_wood', 1) where id = p_owner;
        n.wallet := n.wallet - price; n.prog := 0; n.total := n.total + 1; vx := vx + 5; total := total + 1;
        n.act := jsonb_build_object('k', 'land', 'i', ti, 'j', tj, 'at', t);
        n.log := public._isle_npc_log(n.log, t, '開好一格地了（花了 🪙' || price || '），木頭給島主');
      end if;
    end loop;
    if n.job = 'fish' and day_n > 0 then n.log := public._isle_npc_log(n.log, t, '剛剛又釣到 ' || day_n || ' 條'); end if;
    update public.isle_npcs set last_tick = t, total = n.total, log = n.log, xp = jsonb_set(coalesce(n.xp, '{}'::jsonb), array[n.job], to_jsonb(vx)), wallet = n.wallet, prog = n.prog, act = n.act where id = n.id;
  end loop;
  return total;
end $$;
revoke all on function public._isle_npc_tick(uuid) from public, anon, authenticated;

create or replace function public._isle_npc_row(n public.isle_npcs) returns jsonb language sql stable as $$
  select jsonb_build_object('id', n.id, 'name', n.name, 'trait', n.trait, 'total', n.total, 'log', n.log, 'job', n.job, 'xp', n.xp, 'wallet', n.wallet, 'act', n.act,
    'star', public._npc_star(coalesce((n.xp->>n.job)::int, 0)),
    'state', case when extract(hour from now() at time zone 'Asia/Taipei') < 6 or extract(hour from now() at time zone 'Asia/Taipei') >= 22
                    or (n.trait = 'sleepy' and (extract(hour from now() at time zone 'Asia/Taipei') < 9 or extract(hour from now() at time zone 'Asia/Taipei') >= 20)) then 'sleep' else n.job end) $$;

/* 請幫手（多一個「做什麼」） */
create or replace function public.isle_hire(p_name text, p_trait text, p_job text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); nm text := btrim(coalesce(p_name, ''));
begin
  if public._perm_rank(public._isle_perm(ow, pl.id)) < 2 then raise exception '要住在這座島才能請幫手'; end if;
  if p_trait not in ('hard', 'normal', 'sleepy', 'chatty') then raise exception '沒有這種個性'; end if;
  if p_job not in ('fish', 'farm', 'land') then raise exception '沒有這種工作'; end if;
  if char_length(nm) < 1 or char_length(nm) > 8 then raise exception '名字要 1～8 個字'; end if;
  perform 1 from public.players where id = ow for update;
  if (select count(*) from public.isle_npcs where owner = ow) >= 2 then raise exception '一座島最多 2 個幫手'; end if;
  if pl.coins < 1500 then raise exception '金幣不夠（要 🪙1500）'; end if;
  update public.players set coins = coins - 1500, updated_at = now() where id = pl.id returning * into pl;
  insert into public.isle_npcs (owner, name, trait, job, log) values (ow, nm, p_trait, p_job, jsonb_build_array(jsonb_build_object('at', now(), 'txt', '來到島上了，請多指教！')));
  return pl;
end $$;

/* 換工作（每種工作的熟練度分開記） */
create or replace function public.isle_npc_job(p_id integer, p_job text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ow uuid := public._home_of(auth.uid());
begin
  if public._perm_rank(public._isle_perm(ow, auth.uid())) < 2 then raise exception '要住在這座島才能叫幫手換工作'; end if;
  if p_job not in ('fish', 'farm', 'land') then raise exception '沒有這種工作'; end if;
  perform public._isle_npc_tick(ow);
  update public.isle_npcs set job = p_job, prog = 0, log = public._isle_npc_log(log, now(), case p_job when 'fish' then '好，我去釣魚！' when 'farm' then '好，田交給我顧！' else '好，我去開地！' end) where id = p_id and owner = ow and job <> p_job;
  return public.isle_helpers(ow);
end $$;

/* 放錢進開地幫手的錢包（錢從放的人身上扣，最多放到 🪙20,000） */
create or replace function public.isle_npc_fund(p_id integer, p_amt integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); n public.isle_npcs;
begin
  if public._perm_rank(public._isle_perm(ow, pl.id)) < 2 then raise exception '要住在這座島才能給幫手錢'; end if;
  if p_amt is null or p_amt < 100 or p_amt > 20000 then raise exception '一次放 100～20,000'; end if;
  select * into n from public.isle_npcs where id = p_id and owner = ow for update;
  if n.id is null then raise exception '找不到這個幫手'; end if;
  if n.wallet + p_amt > 20000 then raise exception '錢包最多放 🪙20,000'; end if;
  if pl.coins < p_amt then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - p_amt, updated_at = now() where id = pl.id returning * into pl;
  update public.isle_npcs set wallet = wallet + p_amt, log = public._isle_npc_log(log, now(), coalesce(pl.nickname, '有人') || ' 放了 🪙' || p_amt || ' 進錢包') where id = n.id;
  return jsonb_build_object('player', to_jsonb(pl), 'helpers', public.isle_helpers(ow));
end $$;

/* 請幫手離開：錢包裡沒用完的錢還給島主 */
create or replace function public.isle_fire(p_id integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare ow uuid := public._home_of(auth.uid()); n public.isle_npcs;
begin
  if public._perm_rank(public._isle_perm(ow, auth.uid())) < 2 then raise exception '要住在這座島才能請幫手離開'; end if;
  select * into n from public.isle_npcs where id = p_id and owner = ow for update;
  if n.id is null then return public.isle_helpers(ow); end if;
  if n.wallet > 0 then update public.players set coins = coins + n.wallet where id = ow; end if;
  delete from public.isle_npcs where id = p_id;
  return public.isle_helpers(ow);
end $$;

do $$ declare f text; begin
  foreach f in array array['isle_hire(text,text,text)', 'isle_npc_job(integer,text)', 'isle_npc_fund(integer,integer)', 'isle_fire(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
notify pgrst, 'reload schema';
select '島上的幫手（三種工作、熟練度）設定完成 🧑‍🌾' as result;
