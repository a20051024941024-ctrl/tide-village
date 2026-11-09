-- 潮汐釣魚村 v304：魚群洄游只輪主島上、新手走路就到得了的釣點（以前會輪到冰海、冰湖、小島，新手去不了）（可以重複執行）
create or replace function public._ev_mig_list() returns text[] language sql immutable as $$
  select array['harbor:saury','mangrove:mullet','harbor:horsemack','lake:crucian','harbor:sardine','reef:girella','river:zacco','pool:ayu','lake:bass','sea:flounder'] $$;
