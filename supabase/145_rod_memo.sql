-- 潮汐釣魚村 v381：釣竿的紀念（可以重複執行）
-- 每支釣竿記自己釣過幾條魚、釣過最大的是什麼魚幾公斤（players.rod_log：{ 釣竿: { n, f, w } }）。純紀念，不影響釣魚。
-- record_catch（020）釣到魚的時候會呼叫 _rod_note；這個檔案沒套用的話，020 會跳過，不會壞。釣蝦場用的是蝦竿，不算。
alter table public.players add column if not exists rod_log jsonb not null default '{}'::jsonb;
create or replace function public._rod_note(p_uid uuid, p_fish text, p_w numeric) returns void language plpgsql security definer set search_path = public as $$
declare r text; o jsonb;
begin
  select rod, coalesce(rod_log -> rod, '{}'::jsonb) into r, o from public.players where id = p_uid;
  if r is null or r = '' then return; end if;
  update public.players set rod_log = jsonb_set(coalesce(rod_log, '{}'::jsonb), array[r], jsonb_build_object(
    'n', coalesce((o ->> 'n')::integer, 0) + 1,
    'f', case when p_w > coalesce((o ->> 'w')::numeric, 0) then to_jsonb(p_fish) else o -> 'f' end,
    'w', greatest(coalesce((o ->> 'w')::numeric, 0), coalesce(p_w, 0)))) where id = p_uid;
end $$;
revoke all on function public._rod_note(uuid, text, numeric) from public, anon, authenticated;
