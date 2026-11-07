-- 108 海上目擊（v268）：划船在外海遇到鯨魚、海豚，每一種第一次遇到記一筆、送 💙30 愛海點數。可以重複執行。
-- 防小帳號：要釣過 10 條魚才送點數（記錄照記）；每種只算第一次。
create table if not exists public.sea_sightings (uid uuid not null, kind text not null, at timestamptz not null default now(), primary key (uid, kind));
alter table public.sea_sightings enable row level security;
create or replace function public.sea_sighting(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer := 0; first boolean := false;
begin
  if p_kind is not null then
    if p_kind not in ('dolphin', 'humpback', 'bluewhale', 'sperm') then raise exception '沒有這種目擊'; end if;
    insert into public.sea_sightings (uid, kind) values (pl.id, p_kind) on conflict do nothing;
    get diagnostics n = row_count; first := n > 0 and coalesce(pl.total, 0) >= 10;
    if first then update public.players set love = love + 30, updated_at = now() where id = pl.id returning * into pl; end if;
  end if;
  return jsonb_build_object('first', first, 'kinds', coalesce((select jsonb_agg(kind order by at) from public.sea_sightings where uid = pl.id), '[]'::jsonb), 'player', to_jsonb(pl));
end $$;
revoke all on function public.sea_sighting(text) from public, anon;
grant execute on function public.sea_sighting(text) to authenticated;
