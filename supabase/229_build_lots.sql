-- 229 🏘️ 建地島（作者 11/25：「我有朋友就想要我蓋的東西大家都看得到」「我們必須為以後人越來越多做準備」→ 看過示意圖「好」）。可以重複執行。
-- ・西邊海上的建地島，一條「街」9 格建地（lot 0～8，3×3），每格 20×20 公尺（作者：「就怕地太小，玩家真正想蓋的東西蓋不出來」）。一街剩不到 2 格就自動開下一街，沒有上限。
-- ・建地主人可以邀朋友當「共同建造者」（build_lot_members），一起蓋。
-- ・每個人最多申請一格。在自己的建地上用方塊蓋東西，大家（不管哪個大廳）走上那條街都看得到。
-- ・方塊格式跟小島一樣：[gx, gz, gy, 種類, 方向(0～3), 誰放的(uid 前 8 碼), 顏色(0～23)]，gx／gz 是 -19～19（建地中心是 0,0，一格 0.5 公尺），gy 0～31（16 公尺高），一格建地最多 3000 塊。
-- ・價錢跟小島一樣（_blk_price），收掉的放回包包（isle_bag），之後蓋小島或建地都能用。
-- ・14 天沒上線（players.updated_at），建地就可以被別人申請；原本蓋的東西存成「設計圖」（build_blueprints），下次申請一鍵蓋回來。自己退掉建地也一樣存。
-- ・招牌：每格可以寫一行字（最多 14 個字）。
-- ・檢舉：3 個不同的人檢舉，這格先藏起來（hidden），等管理員看過。管理員可以清空、恢復。

create table if not exists public.build_lots (
  street int not null check (street >= 1),
  lot int not null check (lot between 0 and 8),
  owner uuid references public.players(id) on delete set null,
  sign text not null default '',
  b jsonb not null default '[]'::jsonb,
  hidden boolean not null default false,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (street, lot)
);
create unique index if not exists build_lots_owner on public.build_lots (owner) where owner is not null;
alter table public.build_lots enable row level security;

create table if not exists public.build_blueprints (
  owner uuid primary key references public.players(id) on delete cascade,
  sign text not null default '',
  b jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);
alter table public.build_blueprints enable row level security;

create table if not exists public.build_lot_members (
  street int not null, lot int not null, member uuid not null references public.players(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (street, lot, member)
);
alter table public.build_lot_members enable row level security;

create table if not exists public.build_lot_reports (
  street int not null, lot int not null, reporter uuid not null references public.players(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (street, lot, reporter)
);
alter table public.build_lot_reports enable row level security;

-- 這格建地現在算不算「沒人用」：沒有主人，或主人 14 天沒上線
create or replace function public._lot_free(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is null or coalesce((select updated_at < now() - interval '14 days' from public.players where id = p_owner), true) $$;

-- 有幾條街：最後一條街剩不到 3 格空地就多開一條
create or replace function public.lots_streets() returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select street, count(*) filter (where not public._lot_free(owner)) as used from public.build_lots group by street),
  mx as (select coalesce(max(street), 1) as m from s)
  select jsonb_build_object('n', case when coalesce((select used from s where street = mx.m), 0) >= 7 then mx.m + 1 else mx.m end,
    'used', coalesce((select jsonb_object_agg(street, used) from s), '{}'::jsonb),
    'mine', (select jsonb_build_object('street', street, 'lot', lot) from public.build_lots where owner = auth.uid()),
    'help', (select coalesce(jsonb_agg(jsonb_build_object('street', m.street, 'lot', m.lot)), '[]'::jsonb) from public.build_lot_members m join public.build_lots l on l.street = m.street and l.lot = m.lot and not public._lot_free(l.owner) where m.member = auth.uid()))
  from mx $$;
revoke all on function public.lots_streets() from public, anon;
grant execute on function public.lots_streets() to authenticated;

-- 一條街的 16 格：誰的、招牌、方塊（藏起來的不給方塊，除非是自己的）
create or replace function public.lots_get(p_street int) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('lot', l.lot, 'owner', case when public._lot_free(l.owner) then null else l.owner end,
      'name', case when public._lot_free(l.owner) then null else p.nickname end, 'sign', l.sign, 'hidden', l.hidden,
      'b', case when l.hidden and l.owner is distinct from auth.uid() then '[]'::jsonb when public._lot_free(l.owner) then '[]'::jsonb else l.b end,
      'mem', case when public._lot_free(l.owner) then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', m.member, 'name', q.nickname)), '[]'::jsonb) from public.build_lot_members m join public.players q on q.id = m.member where m.street = l.street and m.lot = l.lot) end) order by l.lot), '[]'::jsonb)
  from public.build_lots l left join public.players p on p.id = l.owner where l.street = p_street $$;
revoke all on function public.lots_get(int) from public, anon;
grant execute on function public.lots_get(int) to authenticated;

-- 存成設計圖（退地、被收回時用）
create or replace function public._lot_save_bp(p_street int, p_lot int) returns void language plpgsql security definer set search_path = public as $$
declare r public.build_lots;
begin
  select * into r from public.build_lots where street = p_street and lot = p_lot;
  if r.owner is null or jsonb_array_length(r.b) = 0 then return; end if;
  insert into public.build_blueprints (owner, sign, b, saved_at) values (r.owner, r.sign, r.b, now())
    on conflict (owner) do update set sign = excluded.sign, b = excluded.b, saved_at = now();
end $$;

-- 申請一格；p_bp = true 時把設計圖一起蓋回來（照設計圖算錢，包包裡有的先用）
create or replace function public.lot_claim(p_street int, p_lot int, p_bp boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); cur public.build_lots; mx int; bp jsonb := '[]'::jsonb; sg text := ''; bag jsonb; cost int := 0; e jsonb; bk text; pr int;
begin
  if p_lot < 0 or p_lot > 8 or p_street < 1 then raise exception '沒有這格建地'; end if;
  select (public.lots_streets()->>'n')::int into mx; if p_street > mx then raise exception '這條街還沒開'; end if;
  if exists (select 1 from public.build_lots where owner = pl.id) then raise exception '你已經有一格建地了，要先退掉才能換'; end if;
  select * into cur from public.build_lots where street = p_street and lot = p_lot for update;
  if found and not public._lot_free(cur.owner) then raise exception '這格已經有人了'; end if;
  if found and cur.owner is not null then perform public._lot_save_bp(p_street, p_lot); end if;
  if p_bp then select b, sign into bp, sg from public.build_blueprints where owner = pl.id; bp := coalesce(bp, '[]'::jsonb); sg := coalesce(sg, '');
    bag := coalesce(pl.isle_bag, '{}'::jsonb);
    for e in select * from jsonb_array_elements(bp) loop
      pr := public._blk_price(e->>3); if pr is null then continue; end if; bk := 'b:' || (e->>3);
      if coalesce((bag->>bk)::int, 0) > 0 then bag := jsonb_set(bag, array[bk], to_jsonb((bag->>bk)::int - 1)); else cost := cost + pr; end if;
    end loop;
    if pl.coins < cost then raise exception '金幣不夠把設計圖蓋回來（要 %）', cost; end if;
    bp := (select coalesce(jsonb_agg(jsonb_set(x, '{5}', to_jsonb(left(pl.id::text, 8)))), '[]'::jsonb) from jsonb_array_elements(bp) x);
    update public.players set coins = coins - cost, isle_bag = bag, updated_at = now() where id = pl.id returning * into pl;
    delete from public.build_blueprints where owner = pl.id;
  end if;
  insert into public.build_lots (street, lot, owner, sign, b, hidden, claimed_at, updated_at) values (p_street, p_lot, pl.id, sg, bp, false, now(), now())
    on conflict (street, lot) do update set owner = pl.id, sign = sg, b = bp, hidden = false, claimed_at = now(), updated_at = now();
  delete from public.build_lot_reports where street = p_street and lot = p_lot;
  delete from public.build_lot_members where street = p_street and lot = p_lot;
  return jsonb_build_object('street', p_street, 'lot', p_lot, 'b', bp, 'sign', sg, 'player', to_jsonb(pl), 'cost', cost);
end $$;
revoke all on function public.lot_claim(int, int, boolean) from public, anon;
grant execute on function public.lot_claim(int, int, boolean) to authenticated;

-- 退掉自己的建地（蓋的東西存成設計圖）
create or replace function public.lot_release() returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.build_lots;
begin
  select * into r from public.build_lots where owner = auth.uid() for update;
  if not found then raise exception '你沒有建地'; end if;
  perform public._lot_save_bp(r.street, r.lot);
  update public.build_lots set owner = null, sign = '', b = '[]'::jsonb, hidden = false, updated_at = now() where street = r.street and lot = r.lot;
  delete from public.build_lot_members where street = r.street and lot = r.lot;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lot_release() from public, anon;
grant execute on function public.lot_release() to authenticated;

-- 有沒有設計圖（幾塊、招牌）
create or replace function public.lot_blueprint() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('n', jsonb_array_length(b), 'sign', sign, 'at', saved_at) from public.build_blueprints where owner = auth.uid()), 'null'::jsonb) $$;
revoke all on function public.lot_blueprint() from public, anon;
grant execute on function public.lot_blueprint() to authenticated;

-- 在自己的建地上放／收方塊（規則跟小島一樣，只是範圍和上限不同）
drop function if exists public.lot_blocks_edit(jsonb, jsonb);
create or replace function public.lot_blocks_edit(p_street int, p_lot int, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); lr public.build_lots; bag jsonb; bk text; cur jsonb; e jsonb; gx int; gz int; gy int; t text; r int; c int; cost int := 0; me8 text; n int; o jsonb; pr int; nw jsonb;
begin
  select * into lr from public.build_lots where street = p_street and lot = p_lot for update;
  if not found or public._lot_free(lr.owner) then raise exception '這格建地沒有主人'; end if;
  if lr.owner <> pl.id and not exists (select 1 from public.build_lot_members where street = p_street and lot = p_lot and member = pl.id) then raise exception '這不是你的建地（要主人邀你一起蓋）'; end if;
  me8 := left(pl.id::text, 8); bag := coalesce(pl.isle_bag, '{}'::jsonb); cur := lr.b;
  if jsonb_typeof(p_del) = 'array' then
    if jsonb_array_length(p_del) > 300 then raise exception '一次收太多了'; end if;
    for e in select * from jsonb_array_elements(p_del) loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int;
      select x into o from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy limit 1;
      if o is null then continue; end if;
      if lr.owner <> pl.id and o->>5 <> me8 then raise exception '一起蓋的人只能收自己放的'; end if;
      if exists (select 1 from jsonb_array_elements(cur) x where (x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy + 1)
         and not exists (select 1 from jsonb_array_elements(p_del) d where (d->>0)::int = gx and (d->>1)::int = gz and (d->>2)::int = gy + 1) then
        raise exception '上面還有東西，先收上面的'; end if;
      cur := (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(cur) x where not ((x->>0)::int = gx and (x->>1)::int = gz and (x->>2)::int = gy));
      if o->>5 = me8 then bk := 'b:' || (o->>3); bag := jsonb_set(bag, array[bk], to_jsonb(coalesce((bag->>bk)::int, 0) + 1)); end if;   -- 收自己放的才退回包包
    end loop;
  end if;
  if jsonb_typeof(p_add) = 'array' then
    if jsonb_array_length(p_add) > 300 then raise exception '一次放太多了'; end if;
    for e in select x from jsonb_array_elements(p_add) x order by (x->>2)::int loop
      gx := (e->>0)::int; gz := (e->>1)::int; gy := (e->>2)::int; t := e->>3; r := coalesce((e->>4)::int, 0) % 4;
      c := case when jsonb_array_length(e) > 6 and jsonb_typeof(e->6) = 'number' then least(23, greatest(0, (e->>6)::int)) else null end;
      pr := public._blk_price(t); if pr is null then raise exception '沒有這種建材'; end if;
      if gy < 0 or gy > 31 then raise exception '最多疊 32 層'; end if;
      if abs(gx) > 19 or abs(gz) > 19 then raise exception '超出建地了'; end if;
      if exists (select 1 from jsonb_array_elements(cur) y where (y->>0)::int = gx and (y->>1)::int = gz and (y->>2)::int = gy) then continue; end if;
      if gy > 0 and not exists (select 1 from jsonb_array_elements(cur) y where (y->>2)::int = gy - 1 and (y->>0)::int = gx and (y->>1)::int = gz)
         and not exists (select 1 from jsonb_array_elements(cur) y where (y->>2)::int = gy and abs((y->>0)::int - gx) + abs((y->>1)::int - gz) = 1) then
        raise exception '不能懸空，下面或旁邊要有一塊可以靠'; end if;
      nw := jsonb_build_array(gx, gz, gy, t, r, me8); if c is not null then nw := nw || to_jsonb(c); end if;
      cur := cur || jsonb_build_array(nw);
      bk := 'b:' || t; if coalesce((bag->>bk)::int, 0) > 0 then bag := jsonb_set(bag, array[bk], to_jsonb((bag->>bk)::int - 1)); else cost := cost + pr; end if;
    end loop;
  end if;
  n := jsonb_array_length(cur);
  if n > 3000 then raise exception '一格建地最多放 3000 塊，先收掉一些'; end if;
  if pl.coins < cost then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - cost, isle_bag = bag, updated_at = now() where id = pl.id returning * into pl;
  update public.build_lots set b = cur, updated_at = now() where street = lr.street and lot = lr.lot;
  return jsonb_build_object('b', cur, 'player', to_jsonb(pl), 'cost', cost);
end $$;
revoke all on function public.lot_blocks_edit(int, int, jsonb, jsonb) from public, anon;
grant execute on function public.lot_blocks_edit(int, int, jsonb, jsonb) to authenticated;

-- 共同建造者：建地主人加好友（只能加自己的好友，最多 6 個人）／移除；被加的人自己也可以退出
create or replace function public.lot_member(p_member uuid, p_add boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.build_lots;
begin
  if p_add then
    select * into r from public.build_lots where owner = auth.uid();
    if not found then raise exception '你還沒有建地'; end if;
    if not exists (select 1 from public.friends where owner = auth.uid() and friend = p_member) then raise exception '只能邀請好友'; end if;
    if (select count(*) from public.build_lot_members where street = r.street and lot = r.lot) >= 6 then raise exception '最多 6 個人一起蓋'; end if;
    insert into public.build_lot_members (street, lot, member) values (r.street, r.lot, p_member) on conflict do nothing;
  else
    delete from public.build_lot_members m using public.build_lots l
      where m.street = l.street and m.lot = l.lot and m.member = p_member and (l.owner = auth.uid() or p_member = auth.uid());
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lot_member(uuid, boolean) from public, anon;
grant execute on function public.lot_member(uuid, boolean) to authenticated;

-- 招牌（最多 14 個字）
create or replace function public.lot_sign(p_text text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s text := btrim(regexp_replace(coalesce(p_text, ''), '[\r\n\t<>]', '', 'g'));
begin
  if char_length(s) > 14 then raise exception '招牌最多 14 個字'; end if;
  update public.build_lots set sign = s, updated_at = now() where owner = auth.uid();
  if not found then raise exception '你還沒有建地'; end if;
  return jsonb_build_object('sign', s);
end $$;
revoke all on function public.lot_sign(text) from public, anon;
grant execute on function public.lot_sign(text) to authenticated;

-- 檢舉：3 個不同的人檢舉就先藏起來
create or replace function public.lot_report(p_street int, p_lot int) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; ow uuid;
begin
  select owner into ow from public.build_lots where street = p_street and lot = p_lot;
  if ow is null then raise exception '這格是空地'; end if;
  if ow = auth.uid() then raise exception '不能檢舉自己'; end if;
  insert into public.build_lot_reports (street, lot, reporter) values (p_street, p_lot, auth.uid()) on conflict do nothing;
  select count(*) into n from public.build_lot_reports where street = p_street and lot = p_lot;
  if n >= 3 then update public.build_lots set hidden = true where street = p_street and lot = p_lot; end if;
  return jsonb_build_object('n', n, 'hidden', n >= 3);
end $$;
revoke all on function public.lot_report(int, int) from public, anon;
grant execute on function public.lot_report(int, int) to authenticated;

-- 管理員：清空一格（p_clear）或恢復顯示
create or replace function public.admin_lot(p_street int, p_lot int, p_clear boolean) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check();
  if p_clear then update public.build_lots set b = '[]'::jsonb, sign = '', hidden = false where street = p_street and lot = p_lot;
  else update public.build_lots set hidden = false where street = p_street and lot = p_lot; end if;
  delete from public.build_lot_reports where street = p_street and lot = p_lot;
  perform public._admin_log(case when p_clear then 'lot_clear' else 'lot_show' end, p_street || '-' || p_lot, '', '');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_lot(int, int, boolean) from public, anon;
grant execute on function public.admin_lot(int, int, boolean) to authenticated;

select '建地島設定完成 🏘️' as result;
