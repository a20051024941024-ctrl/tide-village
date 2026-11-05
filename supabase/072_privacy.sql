-- 潮汐釣魚村：玩家資料不再公開（可以重複執行）
-- 修正：players 整張表任何人（沒登入的也可以）都能讀全部欄位，連「這一竿會釣到什麼」都看得到。
-- 改成：
--   1. players 不能直接讀（revoke select）。需要公開的部分改用下面這些函式，只給必要的欄位：
--      board_list（排行榜）、board_week（本週比賽）、tourney_board（定時大賽）、visit_isle（參觀小島）、visit_aqua（參觀水族館）、isle_neighbors（小島旁邊的鄰居島，只給外觀）。
--   2. 這一竿的結果改存在不公開的 casts 表（020 已經改好）；players 的 cast_* 欄位清空、不再用。
--      咬餌前大約 2 秒，hook_fish() 才告訴手機是什麼魚（游過來咬餌的動畫用）。
--   3. 村報（057）、蔚博士（070）的觸發器改用 last_fish／last_w（釣上來以後才寫，不是秘密）。

-- ---- 2. 舊的答案欄位清掉 ----
update public.players set cast_fish = null, cast_w = null, cast_rs = null, cast_sex = null, cast_brood = null, cast_gp = null
where cast_fish is not null or cast_w is not null or cast_rs is not null or cast_sex is not null or cast_brood is not null or cast_gp is not null;

-- ---- 3. 觸發器 ----
create or replace function public._news_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare sp public.fish_species; d date := public._tw_day(now()); nm text := left(coalesce(nullif(new.nickname, ''), '一位釣客'), 16);
begin
  if new.total = old.total + 1 and new.last_fish is not null then
    insert into public.news_daily (day, uid, nick, n) values (d, new.id, nm, 1) on conflict (day, uid) do update set n = public.news_daily.n + 1, nick = excluded.nick;
    select * into sp from public.fish_species where id = new.last_fish;
    if sp.id is not null and (sp.rarity <> '常見' or new.last_w >= sp.max_w * 0.9) then
      insert into public.news_catch (day, uid, nick, fish, w, rarity) values (d, new.id, nm, sp.id, new.last_w, sp.rarity);
    end if;
  end if;
  return new;
end $$;
create or replace function public._sci_first() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total = old.total + 1 and new.last_fish like 'nx%' then
    update public.sci_finds set first_by = left(coalesce(new.nickname, '釣客'), 16), first_at = now() where id = new.last_fish and first_by is null;
  end if;
  return new;
end $$;

-- ---- 1. 不能直接讀 players ----
revoke select on public.players from anon, authenticated;

-- 排行榜：最大的魚、釣魚總數、賺最多金幣（前 20 名）
create or replace function public.board_list(p_col text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'best_w', best_w, 'best_fish', best_fish, 'total', total, 'legend', legend,
    'species', (select count(*) from jsonb_object_keys(coalesce(fish_count, '{}'::jsonb))), 'earned', earned) order by o desc), '[]'::jsonb)
  from (select *, case p_col when 'total' then total::numeric when 'earned' then earned::numeric else best_w::numeric end o from public.players where total > 0
        order by case p_col when 'total' then total::numeric when 'earned' then earned::numeric else best_w::numeric end desc limit 20) p $$;

-- 本週比賽
create or replace function public.board_week(p_week integer) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'best_w', best_w, 'best_fish', best_fish, 'total', total, 'legend', legend,
    'species', (select count(*) from jsonb_object_keys(coalesce(fish_count, '{}'::jsonb))), 'earned', earned, 'week_id', week_id, 'week_best_w', week_best_w) order by week_best_w desc), '[]'::jsonb)
  from (select * from public.players where week_id = p_week and week_best_w > 0 order by week_best_w desc limit 20) p $$;

-- 定時大賽
create or replace function public.tourney_board(p_id bigint) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'tourney_id', tourney_id, 'tourney_w', tourney_w, 'tourney_n', tourney_n) order by tourney_w desc), '[]'::jsonb)
  from (select * from public.players where tourney_id = p_id and tourney_w > 0 order by tourney_w desc limit 10) p $$;

-- 展示中的魚（參觀用：只給 show 裡面那幾條）
create or replace function public._show_tank(tank jsonb, show jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(coalesce(tank, '[]'::jsonb)) e where coalesce(show, '[]'::jsonb) @> jsonb_build_array(e->'t') $$;

-- 參觀小島：暱稱、島、讚數、展示中的魚
create or replace function public.visit_isle(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'island', island, 'likes', likes, 'tank', public._show_tank(tank, show), 'show', show) from public.players where id = p_id $$;

-- 參觀水族館：暱稱、展示中的魚
create or replace function public.visit_aqua(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'tank', public._show_tank(tank, show), 'show', show) from public.players where id = p_id $$;

-- 鄰居島（站在自己島上看到旁邊的島）：讚數最多的 12 座，只給外觀（房子＋前 18 件裝飾的種類和位置，不含房子裡的家具和格局）
create or replace function public.isle_neighbors() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'likes', p.likes, 'island', jsonb_build_object('v', 2, 'items',
    (select coalesce(jsonb_agg(jsonb_build_object('id', e->'id', 't', e->'t', 'x', e->'x', 'z', e->'z', 'r', e->'r')), '[]'::jsonb) from (
       (select e from jsonb_array_elements(public._isle_items(public._isle_upgrade(p.island))) e where (public._isle_item(e->>'t')).house)
       union all (select e from jsonb_array_elements(public._isle_items(public._isle_upgrade(p.island))) e where not coalesce((public._isle_item(e->>'t')).house, false) limit 18)) q(e)))) order by p.likes desc), '[]'::jsonb)
  from (select id, nickname, likes, island from public.players where id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
          and jsonb_array_length(coalesce(island->'items', '[]'::jsonb)) > 0 order by likes desc limit 12) p $$;

do $$ declare f text; begin
  foreach f in array array['board_list(text)', 'board_week(integer)', 'tourney_board(bigint)', 'visit_isle(uuid)', 'visit_aqua(uuid)', 'isle_neighbors()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select '玩家資料不公開設定完成 🔒' as result;
