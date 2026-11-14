-- 170 下雨天村民躲雨更確實（v443，玩家建議）
-- 原本（054）：剛開始下雨的那一分鐘，正在釣魚、散步的人會提早改主意；下雨時不想釣魚（老港例外）、比較不想散步、想聊天就去涼亭。
-- 漏掉的：① 下雨還是有三成機率去散步 ② 已經在廣場聊天的人不會走 ③ 想聊天時如果別人正在廣場聊，還是會去廣場
--         ④ 開始下雨時正在路上的人，走到以後照樣在雨裡釣魚、散步一整段
-- 現在：下雨（含暴風雨）時完全不散步；聊天只去有屋頂的地方（涼亭、食堂）；只要還在下雨、人在外面沒屋頂的地方，下一分鐘就會改主意。
-- 老港照舊：他下雨也愛釣魚（穿雨衣）。上班的人照常上班。
-- 可以重複執行。

-- 這個人現在是不是在「沒屋頂的地方做可以不做的事」
create or replace function public._npc_outdoor(n public.npcs) returns boolean language sql stable security definer set search_path = public as $$
  select n.act = 'stroll'
      or (n.act = 'fish' and n.id <> 'gang')
      or (n.act = 'chat' and not exists (select 1 from public.npc_places p where p.id = n.place and (p.kind = 'food' or p.id = 'pavilion'))) $$;
revoke all on function public._npc_outdoor(public.npcs) from public, anon, authenticated;

-- 想聊天要去哪：下雨時只考慮有屋頂的地方
create or replace function public._chat_dest(n public.npcs, wet boolean) returns text language plpgsql volatile security definer set search_path = public as $$
declare dest text;
begin
  select o.place into dest from public.npcs o join public.npc_places p on p.id = o.place left join public.npc_rel r on r.a = least(n.id, o.id) and r.b = greatest(n.id, o.id)
    where o.id <> n.id and o.act in ('chat', 'eat') and p.kind in ('social', 'food')
      and (not wet or p.kind = 'food' or p.id = 'pavilion')
      and not exists (select 1 from public.npcs z join public.npc_rel zr on zr.a = least(n.id, z.id) and zr.b = greatest(n.id, z.id) where z.place = o.place and z.id <> n.id and zr.score <= -30)
    order by coalesce(r.score, 0) + random() * 30 desc limit 1;
  return coalesce(dest, case when wet then 'pavilion' else (array['plaza', 'pavilion'])[1 + floor(random() * 2)::int] end);
end $$;
revoke all on function public._chat_dest(public.npcs, boolean) from public, anon, authenticated;

-- 只改兩個小地方（跟 055 一樣的做法：拿現在線上的函式內容來換，找不到要換的地方就整份不動、報錯）
do $$ declare src text; begin
  select pg_get_functiondef('public._npc_decide(public.npcs, timestamptz, text)'::regprocedure) into src;
  if position('''stroll'', case when wet then 0 else' in src) = 0 then
    src := replace(src, '''stroll'', case when wx = ''storm'' then 0 else', '''stroll'', case when wet then 0 else');
    if position('''stroll'', case when wet then 0 else' in src) = 0 then raise exception '170：_npc_decide 找不到散步那一行'; end if;
    execute src;
  end if;
  select pg_get_functiondef('public._world_tick()'::regprocedure) into src;
  if position('_npc_outdoor' in src) = 0 then
    src := replace(src, 'if wx_now in (''rain'', ''storm'') and coalesce(c.wx, '''') <> wx_now and n.act in (''fish'', ''stroll'') and n.arr_at <= tnow then',
                        'if wx_now in (''rain'', ''storm'') and public._npc_outdoor(n) and n.arr_at <= tnow then');
    if position('_npc_outdoor' in src) = 0 then raise exception '170：_world_tick 找不到下雨那一行'; end if;
    execute src;
  end if;
end $$;
revoke all on function public._npc_decide(public.npcs, timestamptz, text) from public, anon, authenticated;
revoke all on function public._world_tick() from public, anon, authenticated;
