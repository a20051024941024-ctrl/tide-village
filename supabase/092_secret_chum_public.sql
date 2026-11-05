-- 092 祕密窩點大家看得到（使用者要的）：可以重複執行
-- 每個人做的「提前打」窩點，地圖和水面上大家都看得到（標著是誰打的，只給暱稱）；
-- 別人的窩點也可以去釣，效果是打窩的人的 75%（打的人自己 100%）。窩點一樣 1 小時後散掉。
create or replace function public.secret_chum_all() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'at')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object('id', (e->>'id')::bigint, 'x', (e->>'x')::numeric, 'z', (e->>'z')::numeric, 'type', e->>'type', 'at', (e->>'at')::bigint,
             'where', e->>'where', 'nick', left(coalesce(nullif(p.nickname, ''), '一位釣客'), 16), 'mine', s.owner = auth.uid()) as x
    from public.secret_chum s join public.players p on p.id = s.owner, jsonb_array_elements(s.spots) e
    where s.updated_at > now() - interval '2 hours'
      and (e->>'at')::bigint > (extract(epoch from now()) * 1000)::bigint - 3600000
    limit 120) q $$;
revoke all on function public.secret_chum_all() from public, anon;
grant execute on function public.secret_chum_all() to authenticated;
select '祕密窩點公開設定完成 🤫' as result;
