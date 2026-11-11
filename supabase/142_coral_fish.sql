-- 潮汐釣魚村 v376：海底花園的珊瑚會吸引珊瑚礁魚（可以重複執行）
-- 自己種的珊瑚長到一半以上，在小島（自己的或朋友的都算）釣魚時，稀有的珊瑚礁魚（鸚哥魚、海馬、獅子魚）比較容易上鉤：
-- 每株 +25%，最多算 4 株（也就是最多 2 倍）。roll_fish（020）會呼叫這個函式；這個檔案沒套用的話，020 會當成 0，不會壞。
create or replace function public._coral_k(p_uid uuid, p_spot text) returns integer language sql stable security definer set search_path = public as $$
  select case when p_spot <> 'isle' then 0 else least(4, (select count(*) from public.farm_plots f
    where f.owner = p_uid and f.slot >= 100 and f.crop = 'coral' and now() >= f.planted_at + make_interval(secs => (select secs from public._farm_crop('coral')) * 0.5)))::integer end
$$;
revoke all on function public._coral_k(uuid, text) from public, anon, authenticated;
