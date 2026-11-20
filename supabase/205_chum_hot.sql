-- 潮汐釣魚村 v610：今天最熱的窩、祕密窩點延長不會被蓋掉（可以重複執行）
-- * set_secret_chum：存自己的窩點時，保留伺服器加上去的延長時間（204 的 ext）。
-- * secret_chum_all：多給 ext（延長了多久）和 n（最近 2 分鐘在這個窩拋過竿的人數）。
-- * chum_hot()：手機「🍚 熱門窩點」用——每個還有效的祕密窩點（人數、窩主、地點），加上大家最近 2 分鐘在「現在打」的窩裡釣魚的地方（12 公尺一格合在一起算人數）。

create or replace function public.set_secret_chum(p_spots jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); clean jsonb; old jsonb;
begin
  if jsonb_typeof(p_spots) <> 'array' then raise exception '格式不對'; end if;
  select spots into old from public.secret_chum where owner = pl.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', (e->>'id')::bigint, 'x', round((e->>'x')::numeric, 2), 'z', round((e->>'z')::numeric, 2),
           'type', e->>'type', 'at', (e->>'at')::bigint, 'where', left(coalesce(e->>'where', ''), 12))
           || coalesce((select jsonb_build_object('ext', least(1800000, coalesce((o->>'ext')::bigint, 0))) from jsonb_array_elements(coalesce(old, '[]'::jsonb)) o where o->>'id' = e->>'id' and o ? 'ext' limit 1), '{}'::jsonb)), '[]'::jsonb)
    into clean
    from (select e from jsonb_array_elements(p_spots) e
          where e->>'type' in ('chum_rice', 'chum_krill', 'chum_gold') and (e->>'x') ~ '^-?[0-9.]+$' and (e->>'z') ~ '^-?[0-9.]+$' and (e->>'at') ~ '^[0-9]+$' and (e->>'id') ~ '^[0-9]+$'
          limit 3) s;
  insert into public.secret_chum (owner, spots, updated_at) values (pl.id, clean, now())
    on conflict (owner) do update set spots = excluded.spots, updated_at = now();
  return clean;
end $$;

create or replace function public._chum_n(p_src text) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.players where cast_chum = p_src and cast_at > now() - interval '120 seconds' $$;

create or replace function public.secret_chum_all() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'at')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object('id', (e->>'id')::bigint, 'x', (e->>'x')::numeric, 'z', (e->>'z')::numeric, 'type', e->>'type', 'at', (e->>'at')::bigint,
             'where', e->>'where', 'nick', left(coalesce(nullif(p.nickname, ''), '一位釣客'), 16), 'mine', s.owner = auth.uid(),
             'ext', coalesce((e->>'ext')::bigint, 0), 'n', public._chum_n('secret:' || (e->>'id'))) as x
    from public.secret_chum s join public.players p on p.id = s.owner, jsonb_array_elements(s.spots) e
    where s.updated_at > now() - interval '3 hours'
      and (e->>'at')::bigint + coalesce((e->>'ext')::bigint, 0) > (extract(epoch from now()) * 1000)::bigint - 3600000
    limit 120) q $$;

create or replace function public.chum_hot() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'secret', public.secret_chum_all(),
    'live', coalesce((select jsonb_agg(jsonb_build_object('x', round(ax, 1), 'z', round(az, 1), 'n', n, 'type', ty) order by n desc) from (
        select avg(cast_x) ax, avg(cast_z) az, count(*)::int n, max(substr(cast_chum, 6)) ty
        from public.players where cast_chum like 'live:%' and cast_at > now() - interval '120 seconds' and cast_x is not null
        group by round(cast_x / 12), round(cast_z / 12) order by count(*) desc limit 8) g), '[]'::jsonb)) $$;

revoke all on function public._chum_n(text) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['set_secret_chum(jsonb)', 'secret_chum_all()', 'chum_hot()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
