-- 潮汐釣魚村 v313：安全認識陌生人（41）。13～17 歲的玩家，「只看認識的人打的字」預設打開（可以重複執行）
-- my_age_mode 多回傳 teen；出生年份還是只有年，保守算（今年 - 出生年 <= 17）
create or replace function public.my_age_mode() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('asked', birth_year is not null, 'kid', kid,
    'teen', not kid and birth_year is not null and extract(year from now())::int - birth_year <= 17)
  from public.players where id = auth.uid() $$;
revoke all on function public.my_age_mode() from public, anon;
grant execute on function public.my_age_mode() to authenticated;
select '青少年預設設定完成 👋' as result;
