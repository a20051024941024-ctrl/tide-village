-- 248（第 2 段，共 2 段）潮汐釣魚村 v887：「我的房間」裡面的東西和牆，只有房間的主人可以動。要先貼 247。可以重複執行。
-- （如果之後又重貼 246，要再貼一次這個）

do $$ begin
  if position('_isle_blocks_edit0' in pg_get_functiondef('public.isle_blocks_edit(uuid,jsonb,jsonb)'::regprocedure)) = 0 then
    drop function if exists public._isle_blocks_edit0(uuid, jsonb, jsonb);
    alter function public.isle_blocks_edit(uuid, jsonb, jsonb) rename to _isle_blocks_edit0;
  end if;
end $$;
revoke all on function public._isle_blocks_edit0(uuid, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.isle_blocks_edit(p_owner uuid, p_add jsonb, p_del jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; ow uuid := coalesce(p_owner, me); ks int[]; nm text; r jsonb;
begin
  ks := array(select ((e->>0)::int + 500) * 1000 + ((e->>1)::int + 500) from jsonb_array_elements(case when jsonb_typeof(p_add) = 'array' then p_add else '[]'::jsonb end) e
        union select ((e->>0)::int + 500) * 1000 + ((e->>1)::int + 500) from jsonb_array_elements(case when jsonb_typeof(p_del) = 'array' then p_del else '[]'::jsonb end) e);
  nm := public._room_lock(ow, ks, me, true);
  if nm is not null then raise exception '這裡是%，只有他自己可以動', nm; end if;
  r := public._isle_blocks_edit0(p_owner, p_add, p_del);
  if exists (select 1 from public.isle_rooms where owner = ow) then perform public._rooms_refresh(ow); end if;
  return r || jsonb_build_object('rooms', public.isle_rooms(ow));
end $$;
revoke all on function public.isle_blocks_edit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.isle_blocks_edit(uuid, jsonb, jsonb) to authenticated;

/* 島上的東西：放、移動、收在別人房間裡的不行 */
create or replace function public.home_edit(p_owner uuid, p_op text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := (public._me()).id; ow uuid := coalesce(p_owner, me); o jsonb; ks int[] := '{}'; nm text;
begin
  perform set_config('tide.owner', ow::text, true);
  if p_op in ('place', 'move', 'remove') and exists (select 1 from public.isle_rooms where owner = ow and kind = 'mine') then
    if p_op in ('move', 'remove') then
      select e into o from jsonb_array_elements(public._isle_items(public._isle_upgrade((select island from public.players where id = ow)))) e where (e->>'id')::int = (p->>'id')::int;
      if o is not null then ks := ks || ((round((o->>'x')::numeric * 2)::int + 500) * 1000 + (round((o->>'z')::numeric * 2)::int + 500)); end if;
    end if;
    if p_op in ('place', 'move') and p ? 'x' then ks := ks || ((round((p->>'x')::numeric * 2)::int + 500) * 1000 + (round((p->>'z')::numeric * 2)::int + 500)); end if;
    nm := public._room_lock(ow, ks, me, false);
    if nm is not null then raise exception '這裡是%，只有他自己可以動裡面的東西', nm; end if;
  end if;
  return public._home_edit0(p_owner, p_op, p);
end $$;
revoke all on function public.home_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.home_edit(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
select '房間名牌設定完成 🚪' as result;
