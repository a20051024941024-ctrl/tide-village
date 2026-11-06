#!/usr/bin/env python3
# 產生 supabase/095_species_sync.sql：把遊戲裡每一種魚（js/game.js 的 FISH）補進伺服器的 fish_species 表
# 伺服器記錄釣到的魚（record_catch）、拍照（add_photo）都要先在這張表找得到；已經有的魚不會被改
import re, os, json
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'js', 'game.js'), encoding='utf-8').read()
cfg = json.load(open(os.path.join(root, 'tools', 'fishcfg.json'), encoding='utf-8'))['fish']
rows = []
for m in re.finditer(r"\{ id:'([a-z0-9_]+)',[^}]*?name:'([^']+)',\s*rarity:'(常見|稀有|傳說)'[^}]*?min:\s*([0-9.]+),\s*max:\s*([0-9.]+)", src):
    i, n, r, a, b = m.groups()
    if i not in cfg: continue
    rows.append("('%s', '%s', '%s', %s, %s)" % (i, n.replace("'", "''"), r, a, b))
sql = "-- 095 魚種補齊（可以重複執行，由 tools/gen_species_sql.py 產生）\n-- 伺服器的 fish_species 要有每一種魚，釣到才記得起來、拍照才收得進圖鑑；已經有的魚不會被改（on conflict do nothing）\n"
sql += "insert into public.fish_species (id, name, rarity, min_w, max_w) values\n  " + ",\n  ".join(rows) + "\non conflict (id) do nothing;\n\nselect '魚種補齊完成 🐟 共 ' || count(*) || ' 種' as result from public.fish_species;\n"
open(os.path.join(root, 'supabase', '095_species_sync.sql'), 'w', encoding='utf-8').write(sql)
print(len(rows))
