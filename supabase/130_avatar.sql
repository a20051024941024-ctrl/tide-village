-- 潮汐釣魚村 v334：頭像（可以重複執行）
-- players.avatar：''＝自己的角色大頭照；'f:魚'＝釣過的魚；'p:寵物種類'＝自己養的寵物；'e:符號'＝一組可愛的符號
-- set_avatar 檢查真的釣過那條魚、真的有那隻寵物；好友列表多回傳 av
alter table public.players add column if not exists avatar text not null default '';

create or replace function public.set_avatar(p text) returns text language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); v text := coalesce(btrim(p), '');
begin
  if v = '' then null;
  elsif v ~ '^f:[a-z0-9_]{1,40}$' then
    if coalesce((pl.fish_count->>substr(v, 3))::integer, 0) <= 0 then raise exception '要先釣到這條魚'; end if;
  elsif v ~ '^p:[a-z]{1,20}$' then
    if not exists (select 1 from public.pets where owner = pl.id and kind = substr(v, 3)) then raise exception '要先養這隻寵物'; end if;
  elsif v ~ '^e:[0-9]{1,2}$' then
    if substr(v, 3)::integer > 23 then raise exception '沒有這個頭像'; end if;
  else raise exception '沒有這個頭像'; end if;
  update public.players set avatar = v, updated_at = now() where id = pl.id;
  return v;
end $$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- 跟 018 一樣，好友和邀請多了頭像
create or replace function public.get_friends() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'av', p.avatar, 'seen', p.updated_at,
        'mutual', exists (select 1 from public.friends r where r.owner = f.friend and r.friend = pl.id)) order by f.created_at)
      from public.friends f join public.players p on p.id = f.friend where f.owner = pl.id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'av', p.avatar) order by f.created_at desc)
      from public.friends f join public.players p on p.id = f.owner
      where f.friend = pl.id and not exists (select 1 from public.friends m where m.owner = pl.id and m.friend = f.owner)), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from', g.from_id, 'name', p.nickname, 'kind', g.kind, 'data', g.data, 'at', g.created_at) order by g.id desc)
      from (select * from public.gifts where to_id = pl.id and not opened order by id desc limit 30) g left join public.players p on p.id = g.from_id), '[]'::jsonb));
end $$;

select '頭像設定完成 🖼️' as result;
