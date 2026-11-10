-- v355 港口重新排過後，阿福海產店的攤位搬了，把伺服器記的上班地點改成新的位置（村民走路去上班才會走到對的地方）
update public.npc_places set x = 15.80, z = -18.61, r = 1.85 where id = 'work_fu';
