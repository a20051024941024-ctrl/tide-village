-- 潮汐釣魚村 v365：海洋記憶（可以重複執行）
-- 每個玩家在每個釣點的「記憶點數」。只影響那個釣點好不好看、魚上鉤快一點（最多快兩成），不影響釣到什麼魚，所以由手機算、伺服器只負責保存（換手機不會不見）。
-- 存的時候跟伺服器上的取比較大的那個，回傳合併後的結果。
alter table public.players add column if not exists sea_mem jsonb not null default '{}'::jsonb;

create or replace function public.sea_mem_save(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur jsonb; k text; v jsonb; n integer; res jsonb; cnt integer := 0;
begin
  if uid is null then raise exception '請先登入'; end if;
  select sea_mem into cur from public.players where id = uid for update;
  if not found then return '{}'::jsonb; end if;
  cur := coalesce(cur, '{}'::jsonb); res := cur;
  if p is not null and jsonb_typeof(p) = 'object' then
    for k, v in select key, value from jsonb_each(p) loop
      exit when cnt >= 60; cnt := cnt + 1;
      if length(k) > 24 or k !~ '^[a-z0-9_]+$' or jsonb_typeof(v) <> 'object' then continue; end if;
      n := case when (v->>'p') ~ '^[0-9]{1,4}$' then (v->>'p')::integer else 0 end;
      n := greatest(n, case when (cur->k->>'p') ~ '^[0-9]{1,4}$' then (cur->k->>'p')::integer else 0 end);
      res := res || jsonb_build_object(k, jsonb_build_object('p', n));
    end loop;
  end if;
  if res is distinct from cur then update public.players set sea_mem = res where id = uid; end if;
  return res;
end $$;
revoke all on function public.sea_mem_save(jsonb) from public, anon;
grant execute on function public.sea_mem_save(jsonb) to authenticated;
