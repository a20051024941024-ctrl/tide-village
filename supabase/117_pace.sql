-- 潮汐釣魚村 v293：玩家說「魚釣太快」，等咬餌和搏鬥都變久了，所以要求的數量一起調低一點（可以重複執行）
-- 1) 每日任務：村長要的常見魚從 2～4 條改成 2～3 條，每條的獎勵從 45 提高到 60
-- 2) 魚群洄游：洄游期間在那裡釣到 5 條 → 4 條就送 200 金幣

create or replace function public._quests(d date)
returns table(i integer, kind text, who text, target text, n integer, minw numeric, reward integer) language plpgsql stable as $$
declare commons text[] := array['mackerel','perch','crucian','kuhua','ayu','tilapia','bonito','bass','squid','flounder','ika','scorpion','loach','goldfish'];
        rares   text[] := array['moonbream','catfish','eel','carp','puffer','cuttle','salmon','barracuda','snakehead','goby','manta','lantern','octopus','jelly'];
        dishes  text[] := array['saba','ayu','suzuki','tako','ikayaki','sanbei','tilapia','mori','sumi','unadon','fugu'];
        h integer; f text; sp public.fish_species; v integer;
begin
  h := public._qhash(d, 0); f := commons[1 + h % array_length(commons, 1)];
  i := 0; kind := 'fish'; who := 'chief'; target := f; n := 2 + (h / 7) % 2; minw := 0; reward := 60 * n; return next;
  h := public._qhash(d, 1); f := rares[1 + h % array_length(rares, 1)]; select * into sp from public.fish_species where id = f;
  i := 1; kind := 'fish'; who := 'wang'; target := f; n := 1; minw := round(sp.min_w + (sp.max_w - sp.min_w) * 0.45, 2); reward := 260; return next;
  h := public._qhash(d, 2); f := dishes[1 + h % array_length(dishes, 1)]; select r.value into v from public._recipe(f) r;
  i := 2; kind := 'dish'; who := 'mei'; target := f; n := 1 + (h / 11) % 2; minw := 0; reward := round(v * 2 * (1 + (h / 11) % 2)); return next;
end $$;

create or replace function public._ev_on_catch(p_uid uuid, p_spot text, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare m jsonb := public._ev_mig(); b jsonb := public._ev_bounty(); n integer;
begin
  if (m->>'active')::boolean and p_spot = m->>'spot' and p_fish = m->>'fish' then
    insert into public.ev_claims (uid, kind, ev_id, n) values (p_uid, 'mig', (m->>'id')::bigint, 1)
      on conflict (uid, kind, ev_id) do update set n = ev_claims.n + 1 returning n into n;
    if n >= 4 then update public.ev_claims set done = true where uid = p_uid and kind = 'mig' and ev_id = (m->>'id')::bigint and not done;
      if found then update public.players set coins = coins + 200 where id = p_uid; end if; end if;
  end if;
  if p_fish = b->>'fish' and p_w >= (b->>'minw')::numeric then
    insert into public.ev_claims (uid, kind, ev_id, n, done) values (p_uid, 'bounty', (b->>'id')::bigint, 1, true) on conflict do nothing;
    if found then update public.players set coins = coins + 300 where id = p_uid; end if;
  end if;
end $$;
revoke all on function public._ev_on_catch(uuid, text, text, numeric) from public, anon, authenticated;
