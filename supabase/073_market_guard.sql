-- 潮汐釣魚村：設計師市集再加強（可以重複執行）
-- 047／048 已經有：檢舉要釣過 50 條魚才算、3 個才下架；買要錢的設計要先釣到 30 條；設計的人一天最多收 3000；設計名字擋髒話。
-- 這次再加：
--   1. 檢舉要「釣過 50 條」而且「綁了 Email 或帳號建立滿 3 天」才算（訪客帳號一直開新的也沒辦法讓設計下架）。
--   2. 新帳號（建立不到 3 天）或等級低（釣不到 200 條）的人，一天在市集最多花 1500 金幣（分身帳號高價買主帳號的設計來轉金幣，轉不了多少）。
--   3. 島上幫手（065）的名字也擋髒話。

alter table public.players add column if not exists design_spend_day date;
alter table public.players add column if not exists design_spend integer not null default 0;

create or replace function public._trusted(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (to_jsonb(u)->>'email') is not null from auth.users u where u.id = p_uid), false)
      or coalesce((select created_at < now() - interval '3 days' from public.players where id = p_uid), false) $$;
revoke all on function public._trusted(uuid) from public, anon, authenticated;

create or replace function public.report_design(p_id integer, p_reason text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '還沒登入'; end if;
  if (select count(*) from public.design_reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception '今天檢舉太多次了'; end if;
  insert into public.design_reports (design, reporter, reason) values (p_id, auth.uid(), left(coalesce(p_reason, ''), 40)) on conflict do nothing;
  update public.designs set hidden = true where id = p_id
    and (select count(*) from public.design_reports r join public.players p on p.id = r.reporter where r.design = p_id and p.total >= 50 and public._trusted(r.reporter)) >= 3;
  return true;
end $$;

create or replace function public.buy_design(p_id integer) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); d public.designs; item text; so public.players; td date := (now() at time zone 'Asia/Taipei')::date; give integer := 0; got integer; spent integer;
begin
  select * into d from public.designs where id = p_id for update;
  if d.id is null or d.hidden or not d.listed then raise exception '這件設計已經下架了'; end if;
  item := d.kind || '_dz' || d.id;
  if item = any(pl.owned) then return pl; end if;
  if d.price > 0 and pl.total < 30 then raise exception '要先釣到 30 條魚才能買要錢的設計'; end if;
  if pl.coins < d.price then raise exception '金幣不夠'; end if;
  spent := case when pl.design_spend_day = td then pl.design_spend else 0 end;
  if d.price > 0 and d.owner <> pl.id and (pl.created_at > now() - interval '3 days' or pl.total < 200) and spent + d.price > 1500 then
    raise exception '新手一天在市集最多花 1500 金幣（帳號滿 3 天、釣到 200 條魚以後就沒有限制）'; end if;
  update public.players set coins = coins - d.price, owned = array_append(owned, item), design_spend_day = td, design_spend = spent + (case when d.owner <> pl.id then d.price else 0 end), updated_at = now()
  where id = pl.id returning * into pl;
  if d.owner <> pl.id and d.price > 0 then
    select * into so from public.players where id = d.owner for update;
    got := case when so.design_day = td then so.design_income else 0 end;
    give := greatest(0, least(floor(d.price * 0.9)::integer, 3000 - got));
    update public.players set coins = coins + give, design_day = td, design_income = got + give, updated_at = now() where id = d.owner;
  end if;
  update public.designs set sold = sold + 1 where id = d.id;
  if d.owner <> pl.id then perform public._push(d.owner, 'design', '👕 你的設計賣出了', '你的設計「' || d.name || '」賣出了' || (case when give > 0 then '，+' || give || ' 金幣' else '' end), give); end if;
  return pl;
end $$;

create or replace function public.isle_hire(p_name text, p_trait text) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); ow uuid := public._home_of(pl.id); nm text := btrim(coalesce(p_name, ''));
begin
  if public._perm_rank(public._isle_perm(ow, pl.id)) < 2 then raise exception '只有島主、共同島主、管理成員可以請幫手'; end if;
  if p_trait not in ('hard', 'normal', 'sleepy', 'chatty') then raise exception '沒有這種個性'; end if;
  if char_length(nm) < 1 or char_length(nm) > 8 then raise exception '名字要 1～8 個字'; end if;
  if public._name_bad(nm) then raise exception '這個名字不行，換一個吧'; end if;
  perform 1 from public.players where id = ow for update;
  if (select count(*) from public.isle_npcs where owner = ow) >= 2 then raise exception '一座島最多 2 個幫手'; end if;
  if pl.coins < 1500 then raise exception '金幣不夠（要 🪙1500）'; end if;
  update public.players set coins = coins - 1500, updated_at = now() where id = pl.id returning * into pl;
  insert into public.isle_npcs (owner, name, trait, log) values (ow, nm, p_trait, jsonb_build_array(jsonb_build_object('at', now(), 'txt', '來到島上了，請多指教！')));
  return pl;
end $$;

do $$ declare f text; begin
  foreach f in array array['report_design(integer,text)', 'buy_design(integer)', 'isle_hire(text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '設計師市集加強完成 🛡️' as result;
