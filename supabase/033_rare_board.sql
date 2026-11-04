-- 潮汐釣魚村：排行榜「最稀有的魚」（可以重複執行）
-- 每種魚的稀有度（同樣少的話，傳說 > 稀有 > 常見） = 全服所有玩家總共釣到幾條（越少越稀有）。每個玩家取他釣過的魚裡面全服數量最少的那一種來排名。
create or replace function public.get_rare_board() returns jsonb language sql stable security definer set search_path = public as $$
  with fc as (
    select p.id, p.nickname, e.key as fid, e.value::int as c, case sp.rarity when '傳說' then 0 when '稀有' then 1 else 2 end as rk
    from public.players p, jsonb_each_text(coalesce(p.fish_count, '{}'::jsonb)) e
    join public.fish_species sp on sp.id = e.key
    where e.value ~ '^[0-9]+$' and e.value::int > 0
  ), tot as (select fid, sum(c)::int as n, count(*)::int as who from fc group by fid),
  per as (
    select fc.id, fc.nickname, fc.fid, t.n, t.who, fc.rk, row_number() over (partition by fc.id order by t.n, fc.rk, fc.fid) as rn,
           (select count(*) from fc f2 join tot t2 on t2.fid = f2.fid where f2.id = fc.id and t2.n <= 3) as rare3
    from fc join tot t on t.fid = fc.fid
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', nickname, 'f', fid, 'n', n, 'who', who, 'r3', rare3) order by n, rk, rare3 desc, nickname), '[]'::jsonb)
  from (select * from per where rn = 1 order by n, rk, rare3 desc limit 30) s
$$;
revoke all on function public.get_rare_board() from public;
grant execute on function public.get_rare_board() to anon, authenticated;

select '最稀有的魚排行榜設定完成 💎' as result;
