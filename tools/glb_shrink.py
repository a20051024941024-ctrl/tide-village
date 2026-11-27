# 用法：python3 tools/glb_shrink.py 原本.glb 輸出.glb 目標三角形數 貼圖邊長（例如 40000 1024）。Meshy 的模型太大（幾十萬面、30MB）時用；沒有網路也能跑（只要 numpy、Pillow）
# 減面第二版：先把同位置的點焊在一起算形狀（貼圖座標放在三角形的每個角上），塌縮 a→b 時，a 在每一塊貼圖上的座標換成 b 在同一塊貼圖上的座標；換不了（那塊貼圖沒有 b）就不塌。
import json, struct, sys, io, numpy as np
from PIL import Image
src, dst, target, tex = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
b = open(src, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20+L]); off = 20 + L; BL = struct.unpack('<I', b[off:off+4])[0]; BIN = b[off+8:off+8+BL]
def acc(i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; ct = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); arr = np.frombuffer(BIN, ct, a['count'] * n, o); return arr.reshape(-1, n) if n > 1 else arr
pr = J['meshes'][0]['primitives'][0]; P0 = acc(pr['attributes']['POSITION']).astype(np.float64); UV0 = acc(pr['attributes']['TEXCOORD_0']).astype(np.float64); T0 = acc(pr['indices']).astype(np.int64).reshape(-1, 3)
q = np.round(P0 / 1e-6).astype(np.int64); _, pinv = np.unique(q, axis=0, return_inverse=True); pinv = pinv.ravel()
nV = pinv.max() + 1; P = np.zeros((nV, 3)); P[pinv] = P0
T = pinv[T0]; CU = UV0[T0]   # 三角形每個角的貼圖座標
ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2]); T = T[ok]; CU = CU[ok]
E0 = np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), 1); ue, ec = np.unique(E0, axis=0, return_counts=True)
lock = np.zeros(nV, bool); lock[ue[ec != 2].ravel()] = True   # 開放的邊、非流形的邊上的點不動
print('welded verts', nV, 'tris', len(T), 'locked', int(lock.sum()), flush=True)
v0, v1, v2 = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]; n = np.cross(v1 - v0, v2 - v0); ar = np.linalg.norm(n, axis=1); n = n / np.maximum(ar, 1e-15)[:, None]; d = -(n * v0).sum(1)
pl = np.concatenate([n, d[:, None]], 1); K = pl[:, :, None] * pl[:, None, :] * ar[:, None, None]; Q = np.zeros((nV, 4, 4))
for k in range(3): np.add.at(Q, T[:, k], K)
# 貼圖接縫也加一點誤差，讓接縫不要被拉歪：接縫邊（兩邊三角形的貼圖座標不同）兩端點加權
uvkey = lambda u: np.round(u * 2**20).astype(np.int64)
it = 0; rng = np.random.default_rng(3); REJ = np.zeros(0, np.int64)
while len(T) > target and it < 400:
    it += 1
    E = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]); E = np.unique(np.concatenate([E, E[:, ::-1]]), axis=0); E = E[~lock[E[:, 0]]]
    if len(REJ): E = E[~np.isin(E[:, 0] * nV + E[:, 1], REJ)]
    vb = np.concatenate([P[E[:, 1]], np.ones((len(E), 1))], 1); cost = np.einsum('ni,nij,nj->n', vb, Q[E[:, 0]] + Q[E[:, 1]], vb) + rng.random(len(E)) * 1e-16
    mv = np.full(nV, np.inf); np.minimum.at(mv, E[:, 0], cost); np.minimum.at(mv, E[:, 1], cost)
    S = E[(cost <= mv[E[:, 0]]) & (cost <= mv[E[:, 1]])]; sc = (np.einsum('ni,nij,nj->n', np.concatenate([P[S[:, 1]], np.ones((len(S), 1))], 1), Q[S[:, 0]] + Q[S[:, 1]], np.concatenate([P[S[:, 1]], np.ones((len(S), 1))], 1)))
    need = max(1, (len(T) - target) // 2 + 1)
    if len(S) > need: S = S[np.argsort(sc)[:need]]
    to = np.arange(nV); to[S[:, 0]] = S[:, 1]; mov = np.zeros(nV, bool); mov[S[:, 0]] = True
    tm = mov[T].any(1); idx = np.nonzero(tm)[0]; TT = T[idx]; T2 = to[TT]
    gone = (T2[:, 0] == T2[:, 1]) | (T2[:, 1] == T2[:, 2]) | (T2[:, 0] == T2[:, 2])
    badv = np.zeros(nV, bool)
    # 翻面
    n0 = np.cross(P[TT[:, 1]] - P[TT[:, 0]], P[TT[:, 2]] - P[TT[:, 0]]); n1 = np.cross(P[T2[:, 1]] - P[T2[:, 0]], P[T2[:, 2]] - P[T2[:, 0]])
    flip = (~gone) & ((n0 * n1).sum(1) <= 0.3 * np.linalg.norm(n0, axis=1) * np.linalg.norm(n1, axis=1))
    for k in range(3): badv[TT[flip, k]] |= mov[TT[flip, k]]
    # 貼圖：消失的三角形裡（含 a 和 b）記下「a 的這個貼圖座標 → b 的貼圖座標」
    mp = {}
    gi = idx[gone]
    for t in gi:
        tri = T[t]; 
        for ka in range(3):
            a = tri[ka]
            if not mov[a]: continue
            bb = to[a]; kb = np.nonzero(tri == bb)[0]
            if not len(kb): continue
            key = (a, *uvkey(CU[t, ka]))
            val = CU[t, kb[0]]
            if key in mp and np.abs(mp[key] - val).max() > 1e-6: badv[a] = True
            mp[key] = val
    # 留下來的三角形裡 a 的角要找得到對應
    si = idx[~gone]; newCU = {}
    for t in si:
        tri = T[t]
        for ka in range(3):
            a = tri[ka]
            if not mov[a] or badv[a]: continue
            key = (a, *uvkey(CU[t, ka]))
            if key not in mp: badv[a] = True
    rj = S[badv[S[:, 0]]]; REJ = np.unique(np.concatenate([REJ, rj[:, 0] * nV + rj[:, 1]]))   # 這次不行的就記起來，下次換別條邊
    S = S[~badv[S[:, 0]]]
    if not len(S):
        continue
    to = np.arange(nV); to[S[:, 0]] = S[:, 1]; mov = np.zeros(nV, bool); mov[S[:, 0]] = True
    for t in si:
        tri = T[t]
        for ka in range(3):
            a = tri[ka]
            if mov[a]: CU[t, ka] = mp[(a, *uvkey(CU[t, ka]))]
    np.add.at(Q, S[:, 1], Q[S[:, 0]])
    T = to[T]; keep = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2]); T = T[keep]; CU = CU[keep]
    if it % 5 == 0 or len(T) <= target: print('it', it, 'collapsed', len(S), 'tris', len(T), flush=True)
# 輸出：每個（位置, 貼圖座標）一個點
key = np.concatenate([T.reshape(-1, 1), uvkey(CU.reshape(-1, 2))], 1); uk, vinv = np.unique(key, axis=0, return_inverse=True); vinv = vinv.ravel()
NP = P[uk[:, 0]]; NUV = np.zeros((len(uk), 2)); NUV[vinv] = CU.reshape(-1, 2); TI = vinv.reshape(-1, 3)
# 法線用焊起來的位置算（接縫不會有明顯的稜線）
Nw = np.zeros((nV, 3)); fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
for k in range(3): np.add.at(Nw, T[:, k], fn)
N = Nw[uk[:, 0]]; N /= np.maximum(1e-12, np.linalg.norm(N, axis=1))[:, None]
im = J['images'][J['textures'][J['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]; bv = J['bufferViews'][im['bufferView']]
img = Image.open(io.BytesIO(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB').resize((tex, tex), Image.LANCZOS); jb = io.BytesIO(); img.save(jb, 'JPEG', quality=86); jb = jb.getvalue()
parts = [NP.astype(np.float32).tobytes(), N.astype(np.float32).tobytes(), NUV.astype(np.float32).tobytes(), TI.astype(np.uint32).ravel().tobytes(), jb]
bvs = []; buf = b''
for dd in parts:
    while len(buf) % 4: buf += b'\0'
    bvs.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(dd)}); buf += dd
while len(buf) % 4: buf += b'\0'
G = {'asset': {'version': '2.0', 'generator': 'tide qem2'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
     'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
     'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.6}, 'doubleSided': True}],
     'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987}], 'images': [{'bufferView': 4, 'mimeType': 'image/jpeg'}],
     'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(NP), 'type': 'VEC3', 'min': NP.min(0).tolist(), 'max': NP.max(0).tolist()}, {'bufferView': 1, 'componentType': 5126, 'count': len(NP), 'type': 'VEC3'},
                   {'bufferView': 2, 'componentType': 5126, 'count': len(NP), 'type': 'VEC2'}, {'bufferView': 3, 'componentType': 5125, 'count': TI.size, 'type': 'SCALAR'}],
     'bufferViews': bvs, 'buffers': [{'byteLength': len(buf)}]}
js = json.dumps(G).encode()
while len(js) % 4: js += b' '
open(dst, 'wb').write(b'glTF' + struct.pack('<II', 2, 28 + len(js) + len(buf)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(buf)) + b'BIN\0' + buf)
print('out verts', len(NP), 'tris', len(TI), 'bytes', 28 + len(js) + len(buf))
