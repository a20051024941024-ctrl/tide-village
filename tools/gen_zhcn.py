# 產生 js/zh-cn.js：繁體（台灣）→ 簡體的對照表
# 資料來源：OpenCC（https://github.com/BYVoid/OpenCC，Apache License 2.0）data/dictionary 的
#   TWVariants.txt（反過來用）、TWVariantsRevPhrases.txt、TSPhrases.txt、TSCharacters.txt
# 用法：python3 tools/gen_zhcn.py <OpenCC 的 data/dictionary 資料夾>
import json, sys, os
d = sys.argv[1]
def load(name, rev=False):
    out = {}
    for line in open(os.path.join(d, name), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        a, b = line.split('\t')[:2]; b = b.split(' ')[0]
        if rev:
            for x in line.split('\t')[1].split(' '): out.setdefault(x, a)
        else: out.setdefault(a, b)
    return out
tw2t = load('TWVariants.txt', rev=True)
phr = {}; phr.update(load('TWVariantsRevPhrases.txt')); phr.update(load('TSPhrases.txt'))
ch = load('TSCharacters.txt')
chars = {}
for k, v in tw2t.items():
    if len(k) == 1: chars[k] = ch.get(v, v)
for k, v in ch.items():
    if len(k) == 1: chars.setdefault(k, v)
chars = {k: v for k, v in chars.items() if k != v}
phr = {k: v for k, v in phr.items() if len(k) > 1}
src = '// 自動產生（tools/gen_zhcn.py），不要手動改。繁體（台灣）→ 簡體。\n// 對照表來自 OpenCC（https://github.com/BYVoid/OpenCC），Apache License 2.0。\n'
src += 'const C = ' + json.dumps(chars, ensure_ascii=False, separators=(',', ':')) + ';\n'
src += 'const P = ' + json.dumps(phr, ensure_ascii=False, separators=(',', ':')) + ';\n'
src += '''const PL = Math.max(1, ...Object.keys(P).map(k => [...k].length));
export function toCN(s){ if (!s) return s; const a = [...s]; let o = '';
  for (let i = 0; i < a.length; ){ let hit = false; for (let n = Math.min(PL, a.length - i); n > 1; n--){ const w = a.slice(i, i + n).join(''); if (P[w] !== undefined){ o += P[w]; i += n; hit = true; break; } } if (hit) continue; o += C[a[i]] || a[i]; i++; }
  return o; }
'''
open('js/zh-cn.js', 'w', encoding='utf-8').write(src)
print(len(chars), len(phr), os.path.getsize('js/zh-cn.js'))
