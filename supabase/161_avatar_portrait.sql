-- 潮汐釣魚村 v414：頭像多一種「大頭照」（c:b背景f外框x表情p姿勢a角度z遠近）。玩家想用自己的圖片當頭像，為了全年齡安全不開放上傳，改成用自己的角色在遊戲裡擺姿勢拍。可以重複執行。
create or replace function public.set_avatar(p text) returns text language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); v text := coalesce(btrim(p), '');
begin
  if v = '' then null;
  elsif v ~ '^f:[a-z0-9_]{1,40}$' then
    if coalesce((pl.fish_count->>substr(v, 3))::integer, 0) <= 0 then raise exception '要先釣到這條魚'; end if;
  elsif v ~ '^p:[a-z]{1,20}$' then
    if not exists (select 1 from public.pets where owner = pl.id and kind = substr(v, 3)) then raise exception '要先養這隻寵物'; end if;
  elsif v ~ '^c:b[0-9]{1,2}f[0-9]{1,2}x[0-9]p[0-9]a[0-9]z[0-9]$' then null;   -- 大頭照：背景、外框、表情、姿勢、角度、遠近（都是遊戲裡的選項，沒有上傳圖片）
  elsif v ~ '^e:[0-9]{1,2}$' then
    if substr(v, 3)::integer > 23 then raise exception '沒有這個頭像'; end if;
  else raise exception '沒有這個頭像'; end if;
  update public.players set avatar = v, updated_at = now() where id = pl.id;
  return v;
end $$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;
