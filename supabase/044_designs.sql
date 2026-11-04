-- 潮汐釣魚村：自己設計衣服、褲子，放到「設計師市集」賣（可以重複執行）
-- 圖案是 16×16 的格子，每格一個調色盤的顏色（0～f，16 色，要跟 js/game.js 的 DESIGN_PAL 一樣）。
-- 上衣有正面＋背面（512 格），褲子一面（256 格）。穿在身上時裝備的 id 是 top_dz<編號> / pants_dz<編號>。
-- 買的錢 9 成給設計的人、1 成是市集手續費；被 3 個人檢舉就先下架（已經買的人看到的是素面）。
create table if not exists public.designs (
  id         serial primary key,
  owner      uuid not null,
  owner_name text not null default '釣客',
  kind       text not null check (kind in ('top', 'pants')),
  name       text not null,
  px         text not null,
  price      integer not null default 0 check (price between 0 and 5000),
  sold       integer not null default 0,
  listed     boolean not null default true,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.designs enable row level security;
revoke all on public.designs from anon, authenticated;
create table if not exists public.design_reports (design integer not null, reporter uuid not null, reason text, created_at timestamptz not null default now(), primary key (design, reporter));
alter table public.design_reports enable row level security;
revoke all on public.design_reports from anon, authenticated;

create or replace function public._design_row(d public.designs) returns jsonb language sql stable as $$
  select jsonb_build_object('id', d.id, 'kind', d.kind, 'name', d.name, 'by', d.owner_name, 'price', d.price, 'sold', d.sold, 'listed', d.listed and not d.hidden, 'px', case when d.hidden then null else d.px end, 'mine', d.owner = auth.uid()) $$;

create or replace function public.save_design(p_kind text, p_name text, p_px text, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; nm text := left(btrim(coalesce(p_name, '')), 16);
begin
  if p_kind not in ('top', 'pants') then raise exception '沒有這種衣服'; end if;
  if p_px !~ '^[0-9a-f]+$' or length(p_px) <> (case when p_kind = 'top' then 512 else 256 end) then raise exception '圖案不對'; end if;
  if nm = '' then nm := '我的設計'; end if;
  if (select count(*) from public.designs where owner = pl.id) >= 12 then raise exception '最多設計 12 件'; end if;
  insert into public.designs (owner, owner_name, kind, name, px, price) values (pl.id, pl.nickname, p_kind, nm, p_px, greatest(0, least(5000, coalesce(p_price, 0)))) returning * into d;
  update public.players set owned = array_append(owned, d.kind || '_dz' || d.id), updated_at = now() where id = pl.id;
  return public._design_row(d);
end $$;

create or replace function public.edit_design(p_id integer, p_price integer, p_listed boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.designs;
begin
  update public.designs set price = greatest(0, least(5000, coalesce(p_price, price))), listed = coalesce(p_listed, listed) where id = p_id and owner = auth.uid() returning * into d;
  if d.id is null then raise exception '找不到這件設計'; end if;
  return public._design_row(d);
end $$;

-- 市集：上架中的設計（最新／最多人買），自己的設計
create or replace function public.list_designs(p_mode text, p_offset integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._design_row(d)), '[]'::jsonb) from (
    select * from public.designs d
    where case when p_mode = 'mine' then owner = auth.uid() else listed and not hidden end
    order by case when p_mode = 'hot' then sold end desc nulls last, id desc
    limit 30 offset greatest(0, coalesce(p_offset, 0))) d $$;

-- 看別人身上穿的設計
create or replace function public.get_designs(p_ids integer[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._design_row(d)), '[]'::jsonb) from public.designs d where d.id = any(p_ids[1:40]) $$;

create or replace function public.buy_design(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; item text;
begin
  select * into d from public.designs where id = p_id for update;
  if d.id is null or d.hidden or not d.listed then raise exception '這件設計已經下架了'; end if;
  item := d.kind || '_dz' || d.id;
  if item = any(pl.owned) then return pl; end if;
  if pl.coins < d.price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - d.price, owned = array_append(owned, item), updated_at = now() where id = pl.id returning * into pl;
  if d.owner <> pl.id then update public.players set coins = coins + floor(d.price * 0.9)::integer, earned = earned + floor(d.price * 0.9)::integer, updated_at = now() where id = d.owner; end if;
  update public.designs set sold = sold + 1 where id = d.id;
  return pl;
end $$;

create or replace function public.report_design(p_id integer, p_reason text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  if (select count(*) from public.design_reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception '今天檢舉太多次了'; end if;
  insert into public.design_reports (design, reporter, reason) values (p_id, auth.uid(), left(coalesce(p_reason, ''), 40)) on conflict do nothing;
  update public.designs set hidden = true where id = p_id and (select count(*) from public.design_reports where design = p_id) >= 3;
  return true;
end $$;

-- 換穿：自己設計的、買來的設計也可以穿（其他跟 015 一樣）
create or replace function public.set_gear(p_gear jsonb) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); k text; v text; g jsonb := '{}'::jsonb; pr integer;
begin
  if jsonb_typeof(p_gear) <> 'object' then raise exception '沒有這個商品'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_gear) loop
    if k not in ('hat','top','pants','shoes','socks','acc','back','face') then continue; end if;
    if v ~ '^(top|pants)_dz[0-9]+$' then
      if split_part(v, '_', 1) <> k or not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
      g := g || jsonb_build_object(k, v); continue;
    end if;
    pr := coalesce(public._item_price(v), case when public._love_price(v) is not null then -1 end);
    if pr is null or split_part(v, '_', 1) <> k then raise exception '沒有這個商品'; end if;
    if pr <> 0 and not (v = any(pl.owned)) then raise exception '還沒有買這個'; end if;
    g := g || jsonb_build_object(k, v);
  end loop;
  update public.players set gear = g, updated_at = now() where id = pl.id returning * into pl;
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['save_design(text,text,text,integer)', 'edit_design(integer,integer,boolean)', 'list_designs(text,integer)', 'get_designs(integer[])', 'buy_design(integer)', 'report_design(integer,text)', 'set_gear(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '設計師市集設定完成 🎨' as result;
