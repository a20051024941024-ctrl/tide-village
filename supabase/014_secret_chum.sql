-- 潮汐釣魚村：祕密窩點存在雲端（換裝置也找得到），只有自己讀得到（可以重複執行）
-- 注意：players 表大家都讀得到（排行榜用），所以祕密窩點放在另一張「只有自己」的表
create table if not exists public.secret_chum (
  owner uuid primary key references public.players(id) on delete cascade,
  spots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.secret_chum enable row level security;
revoke all on public.secret_chum from anon, authenticated;   -- 不能直接讀寫，只能透過下面兩個函式（只會拿到自己的）

create or replace function public.get_secret_chum() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); r jsonb;
begin
  select spots into r from public.secret_chum where owner = pl.id;
  return coalesce(r, '[]'::jsonb);
end $$;

-- 存自己的祕密窩點（最多 3 個；只留需要的欄位）
create or replace function public.set_secret_chum(p_spots jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); clean jsonb;
begin
  if jsonb_typeof(p_spots) <> 'array' then raise exception '格式不對'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', (e->>'id')::bigint, 'x', round((e->>'x')::numeric, 2), 'z', round((e->>'z')::numeric, 2),
           'type', e->>'type', 'at', (e->>'at')::bigint, 'where', left(coalesce(e->>'where', ''), 12))), '[]'::jsonb)
    into clean
    from (select e from jsonb_array_elements(p_spots) e
          where e->>'type' in ('chum_rice', 'chum_krill', 'chum_gold') and (e->>'x') ~ '^-?[0-9.]+$' and (e->>'z') ~ '^-?[0-9.]+$' and (e->>'at') ~ '^[0-9]+$' and (e->>'id') ~ '^[0-9]+$'
          limit 3) s;
  insert into public.secret_chum (owner, spots, updated_at) values (pl.id, clean, now())
    on conflict (owner) do update set spots = excluded.spots, updated_at = now();
  return clean;
end $$;

do $$ declare f text; begin
  foreach f in array array['get_secret_chum()', 'set_secret_chum(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select '祕密窩點雲端設定完成 🤫' as result;
