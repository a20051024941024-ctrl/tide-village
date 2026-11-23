-- 219 💰 退回舊人物的服裝、髮型的金幣（v746，作者 11/24：阿綾服裝店、阿萍美髮沙龍賣的是舊人物的東西，新人物用不到 →「退回去」）。可以重複執行（每個人只會退一次）。
-- ・退的東西：買過的服飾（帽子、衣服、褲子、鞋子、襪子、配件、背飾、表情，照 _item_price 的價錢）、阿萍的髮型（hs，每款 400）、髮色（hc，每色 200）、阿綾設計的衣服（照那件設計的價錢）。
-- ・不退的：免費的、別的玩家設計的衣服（那筆金幣已經給設計的玩家了）、用愛海點數換的。
-- ・東西都還留著（owned 不動），只是把金幣加回去。
-- ・每個人退了多少記在 refund_log，進遊戲時 refund_seen() 會告訴他一次。

create table if not exists public.refund_log (
  player     uuid not null,
  kind       text not null,
  coins      integer not null,
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (player, kind)
);
alter table public.refund_log enable row level security;   -- 手機不能直接讀寫，只能透過下面的函式

with calc as (
  select p.id, sum(
    case when o ~ '^hs[0-9]+$' then 400
         when o ~ '^hc[0-9]+$' then 200
         when o ~ '^(top|pants|hat|shoes|back|acc)_dz[0-9]+$' then coalesce((select d.price from public.designs d where d.id = substring(o from '_dz([0-9]+)$')::integer and d.owner = public._ling_id()), 0)
         else coalesce(public._item_price(o), 0) end)::integer as amt
  from public.players p, lateral unnest(coalesce(p.owned, '{}')) as o
  group by p.id
), ins as (
  insert into public.refund_log (player, kind, coins)
  select id, 'old_wardrobe', amt from calc where amt > 0
  on conflict (player, kind) do nothing
  returning player, coins
)
update public.players pl set coins = pl.coins + ins.coins, updated_at = now() from ins where pl.id = ins.player;

-- 進遊戲時問一次：有沒有還沒看過的退款？有的話回傳金額，並記成看過了
create or replace function public.refund_seen() returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.players := public._me(); n integer;
begin
  with u as (update public.refund_log set seen = true where player = pl.id and not seen returning coins)
  select coalesce(sum(coins), 0)::integer into n from u;
  return jsonb_build_object('coins', n);
end $$;
revoke all on function public.refund_seen() from public, anon;
grant execute on function public.refund_seen() to authenticated;

select '退回舊服裝、髮型的金幣完成 💰：' || count(*) || ' 人，共 ' || coalesce(sum(coins), 0) || ' 金幣' as result from public.refund_log where kind = 'old_wardrobe';
