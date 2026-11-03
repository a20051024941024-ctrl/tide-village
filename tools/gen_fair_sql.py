#!/usr/bin/env python3
# 產生 supabase/020_fair_fishing.sql：把遊戲裡的釣魚數值（tools/fishcfg.json，從遊戲匯出）放進伺服器
# 改了魚、釣點、釣竿、魚餌、料理、窩料、天氣、季節以後：重新匯出 fishcfg.json，再跑 python3 tools/gen_fair_sql.py
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(root, 'tools', 'fishcfg.json'), encoding='utf-8'))
lit = json.dumps(cfg, ensure_ascii=False, separators=(',', ':')).replace("'", "''")
tpl = open(os.path.join(root, 'tools', 'fair_fishing.sql.tpl'), encoding='utf-8').read()
open(os.path.join(root, 'supabase', '020_fair_fishing.sql'), 'w', encoding='utf-8').write(tpl.replace('__CFG__', lit))
print('ok', len(lit))
