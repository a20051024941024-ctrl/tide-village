-- 潮汐釣魚村 v391：兌換碼（可以重複執行）
-- 給實體活動用（例如學校實習商店的環保袋版畫：買袋子附一張小卡，上面有兌換碼）。
--   · 玩家在遊戲的「設定 → 🎁 兌換碼」輸入，拿到：🪙300、💙5、一面「版畫小旗」（只有兌換碼拿得到的海底裝飾）。
--   · 一組碼可以設定能用幾次（預設 1 次）、哪一天過期；同一個人同一組碼只能用一次。
--   · 只有管理員可以產生、作廢（在管理頁的「兌換碼」分頁）。這是單向的贈送：不能用遊戲裡的東西換實體商品或錢。
create table if not exists public.redeem_codes (
  code       text primary key,
  kind       text not null default 'tote',
  note       text,
  max_uses   integer not null default 1,
  uses       integer not null default 0,
  expires    timestamptz,
  void       boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);
create table if not exists public.redeem_log (
  code text not null,
  uid  uuid not null,
  at   timestamptz not null default now(),
  primary key (code, uid)
);
alter table public.redeem_codes enable row level security;
alter table public.redeem_log enable row level security;
revoke all on public.redeem_codes, public.redeem_log from anon, authenticated;
alter table public.players add column if not exists redeem_at timestamptz;

create or replace function public._sea_deco_price(p text) returns integer language sql immutable as $$
  select v.c from (values ('amphora', 300), ('bubble', 400), ('clam', 500), ('anchor', 600), ('lantern', 700), ('chest', 800), ('statue', 1200), ('arch', 1500),
    ('coral_p', 80), ('coral_o', 80), ('coral_v', 80), ('braincoral', 100), ('seagrass', 30), ('kelpdeco', 40), ('anemone', 60), ('sponge', 50),
    ('starfish', 30), ('shell', 20), ('rock_s', 20), ('rock_l', 50), ('sandtile', 15),
    ('c_shrimp', 0), ('c_crab', 0), ('c_slug', 0), ('c_clown', 0), ('c_seahorse', 0), ('c_puffer', 0), ('g_printflag', 0)) v(k, c) where v.k = p
$$;

create or replace function public.redeem(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); c public.redeem_codes; k text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); have integer;
begin
  if pl.redeem_at is not null and now() - pl.redeem_at < interval '3 seconds' then raise exception '輸入太快了，等一下再試'; end if;
  update public.players set redeem_at = now() where id = pl.id;
  if length(k) < 6 then return jsonb_build_object('ok', false, 'msg', '兌換碼不對，請再檢查一次'); end if;
  select * into c from public.redeem_codes where code = k for update;
  if not found or c.void then return jsonb_build_object('ok', false, 'msg', '兌換碼不對，請再檢查一次'); end if;
  if c.expires is not null and now() > c.expires then return jsonb_build_object('ok', false, 'msg', '這組兌換碼已經過期了'); end if;
  if exists (select 1 from public.redeem_log where code = k and uid = pl.id) then return jsonb_build_object('ok', false, 'msg', '你已經用過這組兌換碼了'); end if;
  if c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'msg', '這組兌換碼已經被用完了'); end if;
  insert into public.redeem_log (code, uid) values (k, pl.id);
  update public.redeem_codes set uses = uses + 1 where code = k;
  have := coalesce((pl.bait ->> 'deco_g_printflag')::integer, 0);
  update public.players set coins = coins + 300, earned = earned + 300, love = love + 5,
    bait = jsonb_set(coalesce(bait, '{}'::jsonb), array['deco_g_printflag'], to_jsonb(least(99, have + 1))), updated_at = now()
  where id = pl.id returning * into pl;
  return jsonb_build_object('ok', true, 'kind', c.kind, 'pl', to_jsonb(pl));
end $$;

-- 管理員：一次產生幾組（8 個字，去掉容易看錯的 0 O 1 I L）
create or replace function public.admin_redeem_make(p_n integer, p_note text default null, p_max integer default 1, p_days integer default 90) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._admin_check(); out jsonb := '[]'::jsonb; i integer; k text; al text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; n integer := least(200, greatest(1, coalesce(p_n, 1)));
begin
  for i in 1..n loop
    loop
      k := (select string_agg(substr(al, 1 + floor(random() * length(al))::integer, 1), '') from generate_series(1, 8));
      exit when not exists (select 1 from public.redeem_codes where code = k);
    end loop;
    insert into public.redeem_codes (code, note, max_uses, expires, created_by) values (k, nullif(p_note, ''), least(100000, greatest(1, coalesce(p_max, 1))), case when coalesce(p_days, 0) > 0 then now() + make_interval(days => p_days) end, me);
    out := out || to_jsonb(k);
  end loop;
  perform public._admin_log('redeem_make', null, null, n || ' 組 ' || coalesce(p_note, ''));
  return out;
end $$;
create or replace function public.admin_redeem_list(p_limit integer default 300) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_check();
  return coalesce((select jsonb_agg(to_jsonb(q)) from (select code, note, max_uses, uses, expires, void, created_at from public.redeem_codes order by created_at desc, code limit least(1000, greatest(1, coalesce(p_limit, 300)))) q), '[]'::jsonb);
end $$;
create or replace function public.admin_redeem_void(p_code text, p_void boolean default true) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_check();
  update public.redeem_codes set void = coalesce(p_void, true) where code = upper(p_code);
  perform public._admin_log(case when coalesce(p_void, true) then 'redeem_void' else 'redeem_unvoid' end, null, null, upper(p_code));
end $$;

revoke all on function public.redeem(text), public.admin_redeem_make(integer, text, integer, integer), public.admin_redeem_list(integer), public.admin_redeem_void(text, boolean) from public, anon;
grant execute on function public.redeem(text), public.admin_redeem_make(integer, text, integer, integer), public.admin_redeem_list(integer), public.admin_redeem_void(text, boolean) to authenticated;
