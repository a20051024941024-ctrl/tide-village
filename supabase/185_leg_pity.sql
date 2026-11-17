-- 185 🎣 傳說魚保底（v547，作者 11/17：「有人說傳說機率好低」→ 選了「加保底」）。可以重複執行。
-- ・players.leg_dry：連續釣到幾條都不是傳說魚（釣蝦場的蝦不算）。釣到任何傳說魚就歸零。
-- ・超過 150 條以後，每拋一竿多一個「額外機率」把這一竿換成那個釣點的傳說魚：每多一條 +0.004%，最高 3%。
--   （150 條時 0%、250 條 0.4%、400 條 1%、650 條 2%、900 條以上 3%。）原本的機率完全沒有動，這是另外加上去的。
-- ・做法：不改 020 的 roll_fish／record_catch（改 020 會讓後面一百多份全部重跑）。計數掛在 players 的觸發器上，換魚掛在 casts（每一竿的結果，不公開的表）的觸發器上。
-- ・不會換的情況：釣蝦場、潛水艇、赤紅霸王鯊、這一竿本來就是傳說魚、那個釣點沒有一般的傳說魚（變種和節慶限定不放進保底）。

alter table public.players add column if not exists leg_dry integer not null default 0;

create or replace function public._leg_dry_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total = old.total + 1 then
    if new.legend > old.legend then new.leg_dry := 0;
    elsif new.last_fish is not null and not (public._fishcfg()->'spots'->'shrimp'->'fish' ? new.last_fish) then new.leg_dry := coalesce(old.leg_dry, 0) + 1;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists leg_dry_trg on public.players;
create trigger leg_dry_trg before update on public.players for each row execute function public._leg_dry_trg();

create or replace function public._leg_pity_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; dry integer; f jsonb; fid text; tot numeric := 0; r numeric; pick text;
begin
  if new.spot is null or new.spot in ('shrimp', 'trench') or new.rs is not null then return new; end if;
  select p.leg_dry into dry from public.players p where p.id = new.uid;
  if coalesce(dry, 0) <= 150 then return new; end if;
  if random() >= least(0.03, (dry - 150) * 0.00004) then return new; end if;
  cfg := public._fishcfg();
  if cfg->'fish'->new.fish->>'r' = '傳說' or cfg->'spots'->new.spot is null then return new; end if;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f->>'r' = '傳說' and not coalesce((f->>'v')::boolean, false) and not (f ? 'fest' and f->>'fest' is not null) then tot := tot + (f->>'w')::numeric; end if;
  end loop;
  if tot <= 0 then return new; end if;
  r := random() * tot;
  for fid in select x from jsonb_array_elements_text(cfg->'spots'->new.spot->'fish') x loop
    f := cfg->'fish'->fid;
    if f->>'r' = '傳說' and not coalesce((f->>'v')::boolean, false) and not (f ? 'fest' and f->>'fest' is not null) then
      pick := fid; r := r - (f->>'w')::numeric; if r <= 0 then exit; end if;
    end if;
  end loop;
  f := cfg->'fish'->pick;
  new.fish := pick; new.w := round(((f->>'min')::numeric + ((f->>'max')::numeric - (f->>'min')::numeric) * power(random(), 1.7))::numeric, 2);
  new.brood := false; new.gp := null;
  return new;
end $$;
drop trigger if exists leg_pity_trg on public.casts;
create trigger leg_pity_trg before insert on public.casts for each row execute function public._leg_pity_trg();

revoke all on function public._leg_dry_trg() from public, anon, authenticated;
revoke all on function public._leg_pity_trg() from public, anon, authenticated;
