-- 104 阿鐵師傅做鉤子（v257）：hk_ 開頭，跟竿子造型一樣放進 owned；players.hook 是現在裝的鉤子。可以重複執行。
-- 鉤子只影響拉魚的手感（脫鉤、連擊、拉力），不改伺服器抽魚的機率。
alter table public.players add column if not exists hook text;
create or replace function public._craft_def(p text) returns jsonb language sql immutable as $$
  select (case p
    when 'rs_bamboo'  then '{"c":400,"n":3,"r":"常見"}' when 'rs_wood'   then '{"c":500,"n":3,"r":"常見"}'
    when 'rs_stripe'  then '{"c":800,"n":4,"r":"常見"}' when 'rs_wave'   then '{"c":1200,"n":5,"r":"常見"}'
    when 'rs_coral'   then '{"c":1200,"n":5,"r":"常見"}' when 'rs_carbon' then '{"c":2000,"n":2,"r":"稀有"}'
    when 'rs_gold'    then '{"c":4000,"n":3,"r":"稀有"}' when 'rs_rainbow' then '{"c":6000,"n":4,"r":"稀有"}'
    when 'lc_red'     then '{"c":200,"n":2,"r":"常見"}' when 'lc_yellow' then '{"c":200,"n":2,"r":"常見"}'
    when 'lc_green'   then '{"c":300,"n":2,"r":"常見"}' when 'lc_pink'   then '{"c":300,"n":2,"r":"常見"}'
    when 'lc_blue'    then '{"c":800,"n":1,"r":"稀有"}' when 'lc_gold'   then '{"c":1500,"n":2,"r":"稀有"}'
    when 'hk_barb'    then '{"c":600,"n":3,"r":"常見"}' when 'hk_circle' then '{"c":1500,"n":2,"r":"稀有"}'
    when 'hk_forge'   then '{"c":2500,"n":3,"r":"稀有"}' when 'hk_gold'   then '{"c":5000,"n":4,"r":"稀有"}'
    else null end)::jsonb $$;
create or replace function public.set_hook(p_hook text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  if p_hook is not null and not (p_hook like 'hk\_%' and p_hook = any(pl.owned)) then raise exception '你還沒有這個鉤子'; end if;
  update public.players set hook = p_hook, updated_at = now() where id = pl.id returning * into pl;
  return to_jsonb(pl);
end $$;
revoke all on function public.set_hook(text) from public, anon;
grant execute on function public.set_hook(text) to authenticated;
revoke all on function public._craft_def(text) from public, anon;
grant execute on function public._craft_def(text) to authenticated;
