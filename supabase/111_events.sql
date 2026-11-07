-- 111 釣魚活動（v276）：三種新活動，時間表跟 js/game.js 的 EVT 一模一樣（台灣時間），獎勵都由伺服器算。可以重複執行。
--  🐟 魚群洄游：每 3 小時一次（0、3、6…點的 30 分開始，25 分鐘），某個釣點來一大群某種魚，那種魚在那裡 ×4；洄游期間在那裡釣到 5 條，送 200 金幣（每次洄游一人一次）。
--  🎯 懸賞魚：每 2 小時換一種稀有魚＋最低重量（那種魚重量範圍的 40% 處），這 2 小時內釣到夠重的，送 300 金幣（每次懸賞一人一次）。
--  🌠 流星雨夜釣：每天晚上 23:00～23:30，所有釣點傳說魚機率 ×1.6（沒有金幣）。
create table if not exists public.ev_claims (uid uuid not null, kind text not null, ev_id bigint not null, n integer not null default 0, done boolean not null default false, at timestamptz not null default now(), primary key (uid, kind, ev_id));
alter table public.ev_claims enable row level security;

create or replace function public._ev_mig_list() returns text[] language sql immutable as $$
  select array['harbor:saury','mangrove:mullet','harbor:horsemack','icesea:capelin','harbor:sardine','reef:girella','icelake:wakasagi','isle:bluetang','harbor:yellowtail','sea:flounder'] $$;
create or replace function public._ev_bounty_list() returns text[] language sql immutable as $$
  select array['snakehead','carp','salmon','cuttle','lionfish','manta','barramundi','blackgirella','dolly','batfish','kuhlia','mangsnapper'] $$;

-- 洄游：回傳 id、spot、fish、active
create or replace function public._ev_mig(t timestamptz default now()) returns jsonb language plpgsql stable as $$
declare s bigint := floor(extract(epoch from t)); p bigint := floor((s + 28800) / 10800.0); st bigint := p * 10800 - 28800 + 1800; L text[] := public._ev_mig_list(); e text;
begin
  e := L[1 + (((p * 2654435761) % 4294967296) % cardinality(L))::integer];
  return jsonb_build_object('id', p, 'spot', split_part(e, ':', 1), 'fish', split_part(e, ':', 2), 'active', s >= st and s < st + 1500, 'st', st);
end $$;
-- 懸賞：回傳 id、fish、minw
create or replace function public._ev_bounty(t timestamptz default now()) returns jsonb language plpgsql stable as $$
declare s bigint := floor(extract(epoch from t)); b bigint := floor((s + 28800) / 7200.0); L text[] := public._ev_bounty_list(); f text; c jsonb;
begin
  f := L[1 + (((b * 40503) % 1000003) % cardinality(L))::integer]; c := public._fishcfg()->'fish'->f;
  return jsonb_build_object('id', b, 'fish', f, 'minw', round((c->>'min')::numeric + ((c->>'max')::numeric - (c->>'min')::numeric) * 0.4, 2));
end $$;
create or replace function public._ev_meteor(t timestamptz default now()) returns boolean language sql stable as $$
  select extract(hour from t at time zone 'Asia/Taipei') = 23 and extract(minute from t at time zone 'Asia/Taipei') < 30 $$;

-- 釣到魚的時候（record_catch 呼叫）：算洄游的條數、懸賞有沒有達成，達成就加金幣
create or replace function public._ev_on_catch(p_uid uuid, p_spot text, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb := public._ev_mig(); b jsonb := public._ev_bounty(); n integer;
begin
  if (m->>'active')::boolean and p_spot = m->>'spot' and p_fish = m->>'fish' then
    insert into public.ev_claims (uid, kind, ev_id, n) values (p_uid, 'mig', (m->>'id')::bigint, 1)
      on conflict (uid, kind, ev_id) do update set n = ev_claims.n + 1 returning n into n;
    if n = 5 then update public.ev_claims set done = true where uid = p_uid and kind = 'mig' and ev_id = (m->>'id')::bigint and not done;
      if found then update public.players set coins = coins + 200 where id = p_uid; end if; end if;
  end if;
  if p_fish = b->>'fish' and p_w >= (b->>'minw')::numeric then
    insert into public.ev_claims (uid, kind, ev_id, n, done) values (p_uid, 'bounty', (b->>'id')::bigint, 1, true) on conflict do nothing;
    if found then update public.players set coins = coins + 300 where id = p_uid; end if;
  end if;
end $$;
revoke all on function public._ev_on_catch(uuid, text, text, numeric) from public, anon, authenticated;

-- 給畫面看：現在的活動和我的進度
create or replace function public.ev_status() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m jsonb := public._ev_mig(); b jsonb := public._ev_bounty(); v_uid uuid := auth.uid();
begin
  return jsonb_build_object(
    'mig', m || jsonb_build_object('n', coalesce((select n from public.ev_claims e where e.uid = v_uid and kind = 'mig' and ev_id = (m->>'id')::bigint), 0), 'done', coalesce((select done from public.ev_claims e where e.uid = v_uid and kind = 'mig' and ev_id = (m->>'id')::bigint), false)),
    'bounty', b || jsonb_build_object('done', exists (select 1 from public.ev_claims e where e.uid = v_uid and kind = 'bounty' and ev_id = (b->>'id')::bigint)),
    'meteor', public._ev_meteor());
end $$;
revoke all on function public.ev_status() from public, anon;
grant execute on function public.ev_status() to authenticated;
