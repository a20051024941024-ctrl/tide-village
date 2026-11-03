-- 潮汐釣魚村：逛島列表（照讚數排）用的索引；排行榜的索引在 schema.sql（可以重複執行）
create index if not exists players_likes_idx on public.players (likes desc);
select '索引設定完成 ⚡' as result;
