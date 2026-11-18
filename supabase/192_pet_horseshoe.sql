-- 潮汐釣魚村 v559：小鱟寵物（可以重複執行）
-- 玩家問「鱟不能養嗎」。三棘鱟已經可以放魚缸、水族館（190）；這裡再加一隻會跟著走的寵物「小鱟」。
-- 怎麼得到：釣到三棘鱟（晴潮海邊、紅樹林，退潮或乾潮才有）的那一下，20% 機會發現旁邊跟著一隻小鱟。
--   手機程式釣到三棘鱟時呼叫 pet_horseshoe()（不走 pet_lucky，舊版手機程式不認得這種寵物，所以分開一支）；每釣一條只能試一次（跟 pet_lucky 共用 pet_try_n）。
-- 只有一種樣子，不做花色（玩家：不要只是換顏色）。分類是「海」：算在一般 3 隻名額或海水池裡（_pet_cat 本來就把其他種類當成海）。店裡不賣。
-- 081、119 的種類檢查也加了 horseshoe，不然重跑會失敗。

alter table public.pets drop constraint if exists pets_kind_check;
alter table public.pets add constraint pets_kind_check check (kind in ('cat', 'shiba', 'otter', 'gull', 'crab', 'turtle', 'octopus', 'puffer', 'pondturtle', 'horseshoe'));

create or replace function public.pet_horseshoe() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me();
begin
  select * into pl from public.players where id = pl.id for update;
  if pl.last_fish is distinct from 'horseshoe' or pl.total <= pl.pet_try_n then return jsonb_build_object('got', false); end if;   -- 每釣一條只能試一次
  update public.players set pet_try_n = pl.total where id = pl.id;
  if random() >= 0.20 then return jsonb_build_object('got', false); end if;
  if not public._pet_fit(pl.id, 'horseshoe') then return jsonb_build_object('got', true, 'kind', 'horseshoe', 'var', 'a', 'full', true); end if;
  insert into public.pets (owner, kind, name, var, caught) values (pl.id, 'horseshoe', '小鱟', 'a', true);
  return jsonb_build_object('got', true, 'kind', 'horseshoe', 'var', 'a', 'pets', public.pet_list());
end $$;
revoke all on function public.pet_horseshoe() from public, anon;
grant execute on function public.pet_horseshoe() to authenticated;

select '小鱟寵物設定完成 🦀' as result;
