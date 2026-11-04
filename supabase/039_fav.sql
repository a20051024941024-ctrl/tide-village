-- 潮汐釣魚村：魚可以打星號收藏（可以重複執行）
-- 魚缸裡的魚多一個 k=true：不能賣、魚缸滿了也不會被擠掉；最多 100 條。變種魚釣到時自動收藏（020 record_catch）
create or replace function public.set_fav(p_ts bigint, p_on boolean) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer;
begin
  if p_on then
    select count(*) into n from jsonb_array_elements(pl.tank) e where e ? 'k' and (e->>'t')::bigint <> p_ts;
    if n >= 100 then raise exception '收藏最多 100 條'; end if;
  end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(case when (e->>'t')::bigint = p_ts then (case when p_on then e || '{"k":true}'::jsonb else e - 'k' end) else e end order by i), '[]'::jsonb)
            from jsonb_array_elements(tank) with ordinality x(e, i)),
    updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;
revoke all on function public.set_fav(bigint, boolean) from public, anon;
grant execute on function public.set_fav(bigint, boolean) to authenticated;

-- 魚缸滿了：展示中、紅鯊、收藏的魚都留著（其他跟 032 一樣）
create or replace function public._trim_tank(tank jsonb, show jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from (
    select e, i, (show @> jsonb_build_array(e->'t') or e ? 'rs' or e ? 'k') as keep,
           row_number() over (partition by (show @> jsonb_build_array(e->'t') or e ? 'rs' or e ? 'k') order by i) as rn
    from jsonb_array_elements(tank) with ordinality as x(e, i)
  ) s where keep or rn <= 200 $$;

-- 賣魚：收藏的魚不能賣（其他跟 037 一樣）
create or replace function public.sell_fish(p_ts bigint[]) returns public.players language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); got integer := 0; cnt integer := 0;
begin
  select coalesce(sum(round(public._fish_price(sp, (e->>'w')::numeric) * (case when e ? 'y' then 0.25 else 1 end))), 0), count(*) into got, cnt
  from jsonb_array_elements(pl.tank) e join public.fish_species sp on sp.id = e->>'f'
  where (e->>'t')::bigint = any(p_ts) and not (pl.show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k');
  if cnt = 0 then return pl; end if;
  update public.players set
    tank = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(tank) with ordinality x(e, i)
            where not ((e->>'t')::bigint = any(p_ts) and not (show @> jsonb_build_array(e->'t')) and not (e ? 'rs') and not (e ? 'k'))),
    coins = coins + got, earned = earned + got, sold = sold + cnt, updated_at = now()
  where id = pl.id returning * into pl;
  return pl;
end $$;

-- 以前釣到的變種也自動收藏（每個玩家只做一次，之後玩家自己取消就不會再被打回來）
alter table public.players add column if not exists fav_init boolean not null default false;
update public.players set
  tank = (select coalesce(jsonb_agg(case when (public._fishcfg()->'fish'->(e->>'f')) ? 'v' and rn <= 100 then e || '{"k":true}'::jsonb else e end order by i), '[]'::jsonb)
          from (select e, i, row_number() over (partition by (public._fishcfg()->'fish'->(e->>'f')) ? 'v' order by i) rn from jsonb_array_elements(tank) with ordinality x(e, i)) q),
  fav_init = true
where not fav_init;

select '收藏設定完成 ⭐' as result;
