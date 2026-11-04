-- 潮汐釣魚村：白化赤紅霸王鯊（可以重複執行）
-- 紅鯊族群生小鯊時，有 2% 的機會生出白化的。白化的一樣是族群裡的一隻（一樣會長大、留叉叉、被釣光就絕種），
-- 只是釣起來是另一種魚「shark_red_albino」（圖鑑另外一格），跑馬燈會特別公告。albino 欄位在 020 開頭就先加好了。
insert into public.fish_species (id, name, rarity, min_w, max_w) values ('shark_red_albino', '白化赤紅霸王鯊', '傳說', 15, 420)
on conflict (id) do update set name = excluded.name, rarity = excluded.rarity, min_w = excluded.min_w, max_w = excluded.max_w;

-- 繁殖：跟 032 一樣，只是小鯊有 2% 是白化
create or replace function public._rs_breed() returns void language plpgsql security definer set search_path = public as $$
declare m public.red_shark_meta; lc timestamptz; ev timestamptz; nm integer; nf integer; nid integer;
begin
  select * into m from public.red_shark_meta where id = 1 for update;
  if not found then return; end if;
  loop
    select max(caught_at) into lc from public.red_sharks;
    ev := greatest(m.last_breed, coalesce(lc, m.last_breed));
    exit when ev + interval '7 days' > now();
    select count(*) filter (where sex = 'M'), count(*) filter (where sex = 'F') into nm, nf from public.red_sharks where status = 'sea';
    if nm >= 1 and nf >= 1 and nm + nf < public._rs_cap() then
      select coalesce(max(id), 0) + 1 into nid from public.red_sharks;
      insert into public.red_sharks (id, sex, born_at, albino) values (nid, case when random() < 0.5 then 'M' else 'F' end, ev + interval '7 days', random() < 0.02);
    end if;
    m.last_breed := ev + interval '7 days';
    update public.red_shark_meta set last_breed = m.last_breed where id = 1;
  end loop;
end $$;
revoke all on function public._rs_breed() from public, anon, authenticated;

-- 放流點數：白化紅鯊也是 100
create or replace function public._love_pts(sp public.fish_species, w numeric) returns integer language sql immutable as $$
  select case when sp.id in ('shark_red', 'shark_red_albino') then 100 when sp.id = 'bluelobster' then 50 else greatest(case when public._undersized(sp, w) then 3 else 0 end,
                  case sp.rarity when '常見' then 1 when '稀有' then 3 else 10 end) end $$;

-- 放生：紅鯊（包括白化的）放回海裡會回到族群（其他跟 037 一樣）
create or replace function public.release_fish(p_ts bigint) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pts integer; fid text; rs text;
begin
  select public._love_pts(sp, (e->>'w')::numeric) + (case when e ? 'b' then 5 else 0 end), sp.id, e->>'rs' into pts, fid, rs
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = p_ts limit 1;
  if pts is null then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i) where (e->>'t')::bigint <> p_ts),
    show = (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(show) v where v::bigint <> p_ts),
    love = love + pts, released = released + 1, updated_at = now()
  where id = pl.id returning * into pl;
  if fid = 'bluelobster' then
    update public.shrimp_events set caught_by = null, caught_name = null, caught_w = null, caught_at = null, hooked_by = null, hooked_at = null
    where fish = fid and caught_by = pl.id and end_at > now();
  end if;
  if fid in ('shark_red', 'shark_red_albino') and rs is not null then
    update public.red_sharks set status = 'sea', hooked_by = null, hooked_at = null where id = split_part(rs, ':', 1)::integer and caught_by = pl.id and status = 'caught';
  end if;
  return pl;
end $$;
revoke all on function public.release_fish(bigint) from public, anon;
grant execute on function public.release_fish(bigint) to authenticated;

-- 給遊戲看的：多回傳「最近被釣到的是不是白化的」
create or replace function public.get_red_shark() returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer; l public.red_sharks;
begin
  perform public._rs_breed();
  select count(*) into n from public.red_sharks where status = 'sea';
  select * into l from public.red_sharks where caught_at is not null order by caught_at desc limit 1;
  return jsonb_build_object('n', n, 'last', case when l.id is null then null else jsonb_build_object('id', l.id, 'sex', l.sex, 'scars', l.scars, 'name', l.caught_name, 'w', l.caught_w, 'at', (extract(epoch from l.caught_at) * 1000)::bigint, 'caught', l.status = 'caught', 'a', l.albino) end);
end $$;
revoke all on function public.get_red_shark() from public;
grant execute on function public.get_red_shark() to anon, authenticated;

select '白化赤紅霸王鯊設定完成 🦈' as result;
