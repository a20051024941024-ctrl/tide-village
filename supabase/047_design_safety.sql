-- 潮汐釣魚村：設計師市集防作弊、防惡意檢舉（可以重複執行）
-- 1. 檢舉：只有「認真玩過」的玩家（釣過 50 條魚以上）的檢舉才算數，3 個這樣的人檢舉才會下架；一個人開很多小帳號沒辦法把別人的設計弄下架
-- 2. 分身轉金幣：買要花錢的設計，買的人要釣過 30 條魚；設計賣出的錢不算進「賺最多」排行（earned）；每個設計師一天從市集最多收 3000 金幣，超過的部分給市集
-- 3. 設計的名字擋髒話（跟 js/game.js 的 BAD_WORDS 一樣）：有髒話就改成「我的設計」
create or replace function public._name_bad(p text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(array['幹你','幹妳','幹您','幹拎','幹林','幹恁','操你','操妳','肏','靠北','靠杯','靠腰','機掰','機八','雞巴','雞掰','屌','他媽的','他媽','你媽','妳媽','你娘','婊子','賤人','賤貨','王八蛋','白癡','白痴','智障','腦殘','去死','垃圾人','三小','淦','fuck','fck','shit','bitch','asshole','dick','cunt','bastard','nigger','nigga','retard']) w where position(w in regexp_replace(coalesce(p, ''), '[[:space:][:punct:]。，、！？～．·＿]', '', 'g')) > 0)
     and not exists (select 1 from unnest(array['幹嘛','幹麼','幹什麼','能幹','幹部','幹活','樹幹','主幹','幹事','才幹','骨幹','苦幹','實幹','幹勁','精幹','軀幹','幹練']) ok where position(ok in coalesce(p, '')) > 0) $$;

alter table public.players add column if not exists design_day date;
alter table public.players add column if not exists design_income integer not null default 0;

create or replace function public.save_design(p_kind text, p_name text, p_px text, p_price integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; nm text := left(btrim(coalesce(p_name, '')), 16);
begin
  if p_kind not in ('top', 'pants', 'hat', 'shoes', 'back', 'acc') then raise exception '沒有這種衣服'; end if;
  if p_px !~ '^[0-9a-f]+$' or length(p_px) <> (case when p_kind = 'top' then 512 else 256 end) then raise exception '圖案不對'; end if;
  if nm = '' or public._name_bad(nm) then nm := '我的設計'; end if;
  if (select count(*) from public.designs where owner = pl.id and created_at > now() - interval '1 day') >= 50 then raise exception '今天設計太多件了，明天再來'; end if;
  insert into public.designs (owner, owner_name, kind, name, px, price) values (pl.id, pl.nickname, p_kind, nm, p_px, greatest(0, least(5000, coalesce(p_price, 0)))) returning * into d;
  update public.players set owned = array_append(owned, d.kind || '_dz' || d.id), updated_at = now() where id = pl.id;
  return public._design_row(d);
end $$;

create or replace function public.buy_design(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; item text; so public.players; td date := (now() at time zone 'Asia/Taipei')::date; give integer; got integer;
begin
  select * into d from public.designs where id = p_id for update;
  if d.id is null or d.hidden or not d.listed then raise exception '這件設計已經下架了'; end if;
  item := d.kind || '_dz' || d.id;
  if item = any(pl.owned) then return pl; end if;
  if d.price > 0 and pl.total < 30 then raise exception '要先釣到 30 條魚才能買要錢的設計'; end if;
  if pl.coins < d.price then raise exception '金幣不夠'; end if;
  update public.players set coins = coins - d.price, owned = array_append(owned, item), updated_at = now() where id = pl.id returning * into pl;
  if d.owner <> pl.id and d.price > 0 then
    select * into so from public.players where id = d.owner for update;
    got := case when so.design_day = td then so.design_income else 0 end;
    give := greatest(0, least(floor(d.price * 0.9)::integer, 3000 - got));
    update public.players set coins = coins + give, design_day = td, design_income = got + give, updated_at = now() where id = d.owner;
  end if;
  update public.designs set sold = sold + 1 where id = d.id;
  return pl;
end $$;

create or replace function public.report_design(p_id integer, p_reason text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  if (select count(*) from public.design_reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception '今天檢舉太多次了'; end if;
  insert into public.design_reports (design, reporter, reason) values (p_id, auth.uid(), left(coalesce(p_reason, ''), 40)) on conflict do nothing;
  update public.designs set hidden = true where id = p_id and (select count(*) from public.design_reports r join public.players p on p.id = r.reporter where r.design = p_id and p.total >= 50) >= 3;
  return true;
end $$;

do $$ declare f text; begin
  foreach f in array array['save_design(text,text,text,integer)', 'buy_design(integer)', 'report_design(integer,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- 已經存在、名字有髒話的設計也改掉
update public.designs set name = '我的設計' where public._name_bad(name);

select '設計師市集安全設定完成 🛡️' as result;
