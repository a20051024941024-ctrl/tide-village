-- 潮汐釣魚村 v406：掛在市集賣的寵物不會出現在小島上（可以重複執行）
-- 玩家回報：寄居蟹放到市集賣了，小島上還是看得到牠。別人來參觀時也一樣，所以伺服器這邊也要排除掛賣中的寵物。

create or replace function public.isle_pets(p_owner uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'var', p.var, 'name', p.name, 'acc', public._pet_acc(p.love)) || case when t.pet_id is not null then jsonb_build_object('shine', t.shine) else '{}'::jsonb end order by p.id), '[]'::jsonb)
  from public.pets p left join public.pet_turtle t on t.pet_id = p.id where p.owner = p_owner and not p.out and p.price is null $$;
