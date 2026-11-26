-- 254 潮汐釣魚村 v905：寵物陪著你就會變親（不用每天餵）。可以重複執行。
-- 阿穎的回饋：「上了一天的班已經很累了，寵物就是要放鬆，什麼都不用管」
-- ・帶寵物出門，每陪 5 分鐘親密度 +1（一天最多 +12，大約陪一個小時）。餵食變成想寵牠時的加分。

alter table public.pets add column if not exists comp_at timestamptz;
alter table public.pets add column if not exists comp_day date;
alter table public.pets add column if not exists comp_n integer not null default 0;

create or replace function public.pet_company(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); pt public.pets; td date := (now() at time zone 'Asia/Taipei')::date; got int := 0;
begin
  select * into pt from public.pets where id = p_id and owner = pl.id for update;
  if pt.id is null or not coalesce(pt.out, false) then return jsonb_build_object('got', 0); end if;
  if pt.comp_at is not null and pt.comp_at > now() - interval '4 minutes 30 seconds' then return jsonb_build_object('got', 0, 'love', pt.love); end if;
  if pt.comp_day is distinct from td then pt.comp_n := 0; end if;
  if pt.comp_n < 12 then got := 1; end if;
  update public.pets set love = love + got, comp_at = now(), comp_day = td, comp_n = pt.comp_n + got where id = pt.id returning * into pt;
  return jsonb_build_object('got', got, 'love', pt.love, 'n', pt.comp_n);
end $$;
revoke all on function public.pet_company(bigint) from public, anon;
grant execute on function public.pet_company(bigint) to authenticated;
notify pgrst, 'reload schema';
select '寵物陪著就會變親 設定完成 🐾' as result;
