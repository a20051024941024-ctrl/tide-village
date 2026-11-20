-- 201 🏝️ 遠方荒島・漂流島的存檔（v590，作者 11/20：「除了釣魚就沒有第二件大事可以做」→ 荒島求生）
-- ・每個人一份荒島存檔（荒島背包、撿過的地方什麼時候長回來、營地、飽足度和體力），手機傳上來、換手機時拿回去。
-- ・第一階段荒島的東西不能拿回村子、不能賣（作者決定照建議），所以不碰金幣和魚缸，伺服器只負責保管：限制大小（16KB）和頻率（2 秒一次）。
-- ・可以重複執行。

create table if not exists public.wild_saves (uid uuid primary key references public.players(id) on delete cascade, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.wild_saves enable row level security;

create or replace function public.wild_load() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select w.data from public.wild_saves w where w.uid = auth.uid()), 'null'::jsonb) $$;

create or replace function public.wild_save(p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); last timestamptz;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 16384 then return jsonb_build_object('err', 'bad'); end if;
  select w.updated_at into last from public.wild_saves w where w.uid = pl.id;
  if last is not null and last > now() - interval '2 seconds' then return jsonb_build_object('err', 'too fast'); end if;
  insert into public.wild_saves (uid, data, updated_at) values (pl.id, p_data, now())
    on conflict (uid) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.wild_load() from public, anon; grant execute on function public.wild_load() to authenticated;
revoke all on function public.wild_save(jsonb) from public, anon; grant execute on function public.wild_save(jsonb) to authenticated;
