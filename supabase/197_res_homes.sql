-- 197 🏘️ 村民搬進居民區（v569，作者 11/18：「居民區是專門給 NPC 住的」）。可以重複執行。
-- 054 設定的五個家還在地圖改版（v489／v494）之前的位置，其中兩棟房子早就搬走了，村民晚上是走到空地上「回家」。
-- 現在一人一棟，位置是居民區巷子（x = -47）兩邊房子的門口：西排房子在 x = -53、東排在 x = -41，z = 16／24／32／40。
-- 剩下三棟（-41,32）（-53,40）（-41,40）是空屋，留給以後的新村民。手機 js/game.js 的 RES_HOMES 是同一份名單（門牌和門口的燈）。
update public.npc_places set name = '村長家', x = -50.6, z = 16, r = 1.571 where id = 'home_chief';
update public.npc_places set name = '阿綾家', x = -43.4, z = 16, r = -1.571 where id = 'home_ling';
update public.npc_places set name = '阿木家', x = -50.6, z = 24, r = 1.571 where id = 'home_mu';
update public.npc_places set name = '阿福家', x = -43.4, z = 24, r = -1.571 where id = 'home_fu';
update public.npc_places set name = '老港家', x = -50.6, z = 32, r = 1.571 where id = 'home_gang';
select '村民搬進居民區 🏘️' as result;
