-- 潮汐釣魚村 v409：每支釣竿各自的造型（可以重複執行）
-- 玩家想要「這支竿子配這個顏色、那支竿子配那個顏色，不要全部一起改」。
-- 以前工坊的竿子造型只有一個（rod_skin），所有釣竿共用。現在每支竿子記自己的造型（rod_skins：{竿子: 造型}）：
--   * 在工坊按「裝上／拿下」只改現在拿的這支；
--   * 換竿子時，自動換成那支竿子記住的造型。
-- 舊玩家：原本裝著的造型，先幫他已經有的每支竿子都裝上（看起來跟以前一樣），之後再一支一支改。
alter table public.players add column if not exists rod_skins jsonb not null default '{}'::jsonb;

update public.players p set rod_skins = coalesce((select jsonb_object_agg(r, p.rod_skin) from unnest(coalesce(p.rods, '{}') || array[p.rod]) r where r is not null), '{}'::jsonb)
  where p.rod_skin is not null and p.rod_skins = '{}'::jsonb;

create or replace function public._rod_skin_sync() returns trigger language plpgsql as $$
begin
  if new.rod is distinct from old.rod then
    new.rod_skin := nullif(coalesce(new.rod_skins, '{}'::jsonb)->>coalesce(new.rod, ''), '');
    if new.rod_skin is not null and not (new.rod_skin = any(coalesce(new.owned, '{}'))) then new.rod_skin := null; end if;
  elsif new.rod_skin is distinct from old.rod_skin and new.rod is not null then
    new.rod_skins := case when new.rod_skin is null then coalesce(new.rod_skins, '{}'::jsonb) - new.rod
                          else jsonb_set(coalesce(new.rod_skins, '{}'::jsonb), array[new.rod], to_jsonb(new.rod_skin)) end;
  end if;
  return new;
end $$;
drop trigger if exists rod_skin_sync on public.players;
create trigger rod_skin_sync before update of rod, rod_skin on public.players for each row execute function public._rod_skin_sync();
