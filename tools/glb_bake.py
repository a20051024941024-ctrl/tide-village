# 用法：python3 tools/glb_bake.py 原本.glb 減面後.glb 輸出.glb 貼圖邊長 [--fish]
# Meshy 的模型貼圖座標很碎，直接減面會在接縫拉出跨到別塊貼圖的三角形（看起來一點一點的雜色）。
# 這支改成：減面後的模型（glb_shrink 輸出，只用它的形狀）重新排一張貼圖（每個三角形一小格），
# 每個像素回到原本的模型上找最近、朝同一邊的那一點拿顏色。需要 numpy、scipy、Pillow。
# --fish：轉成「頭朝 +x、身長 1、中心在原點」（REAL3 的魚用），頭的方向自動判斷（身體最長的那一軸，比較粗的那一端當頭）。
import json, struct, sys, io, math, numpy as np
from PIL import Image
from scipy.spatial import cKDTree

def load(fn):
    b = open(fn, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20 + L]); off = 20 + L; BL = struct.unpack('<I', b[off:off + 4])[0]; BIN = b[off + 8:off + 8 + BL]
    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; ct = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); arr = np.frombuffer(BIN, ct, a['count'] * n, o); return arr.reshape(-1, n) if n > 1 else arr
    pr = J['meshes'][0]['primitives'][0]; P = acc(pr['attributes']['POSITION']).astype(np.float64); T = acc(pr['indices']).astype(np.int64).reshape(-1, 3)
    UV = acc(pr['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in pr['attributes'] else None
    img = None
    try:
        im = J['images'][J['textures'][J['materials'][pr.get('material', 0)]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]; bv = J['bufferViews'][im['bufferView']]
        img = np.asarray(Image.open(io.BytesIO(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')).astype(np.float32)
    except Exception: pass
    # 節點本身的縮放旋轉（Meshy 通常沒有）
    nd = J['nodes'][J['scenes'][J.get('scene', 0)]['nodes'][0]]
    if 'matrix' in nd: M = np.array(nd['matrix']).reshape(4, 4).T; P = P @ M[:3, :3].T + M[:3, 3]
    return P, T, UV, img

src, dec, dst, tex = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]); FISH = '--fish' in sys.argv
P0, T0, UV0, IMG = load(src); P1, T1, _, _ = load(dec)
import os
MIR = None
if os.environ.get('FIX'):   # 改過形狀的模型（例如左右鏡射補一邊）：FIX=資料夾前綴，裡面 P.npy T.npy M.npy；M 是哪些三角形是鏡射來的，顏色要回到鏡射前的位置拿；XM 是鏡射的面
    fx = os.environ['FIX']; P1 = np.load(fx + 'P.npy'); T1 = np.load(fx + 'T.npy'); MIR = np.load(fx + 'M.npy'); XMIR = float(os.environ.get('XM', '0'))
H, W = IMG.shape[:2]
# 原本模型表面的取樣點：每個三角形的三個角＋中心＋三邊中點（顏色從原本的貼圖拿），帶面的法線
def tex_at(uv):
    x = np.clip((uv[:, 0] % 1) * (W - 1), 0, W - 1); y = np.clip((uv[:, 1] % 1) * (H - 1), 0, H - 1)   # glTF 的 v 往下
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); x1 = np.minimum(x0 + 1, W - 1); y1 = np.minimum(y0 + 1, H - 1); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return IMG[y0, x0] * (1 - fx) * (1 - fy) + IMG[y0, x1] * fx * (1 - fy) + IMG[y1, x0] * (1 - fx) * fy + IMG[y1, x1] * fx * fy
fn0 = np.cross(P0[T0[:, 1]] - P0[T0[:, 0]], P0[T0[:, 2]] - P0[T0[:, 0]]); fn0 /= np.maximum(np.linalg.norm(fn0, axis=1), 1e-15)[:, None]
BW = [(1, 0, 0), (0, 1, 0), (0, 0, 1), (1/3, 1/3, 1/3), (.5, .5, 0), (0, .5, .5), (.5, 0, .5), (2/3, 1/6, 1/6), (1/6, 2/3, 1/6), (1/6, 1/6, 2/3)]
SP, SC, SN = [], [], []
for w in BW:
    w = np.array(w); SP.append(P0[T0[:, 0]] * w[0] + P0[T0[:, 1]] * w[1] + P0[T0[:, 2]] * w[2])
    SC.append(tex_at(UV0[T0[:, 0]] * w[0] + UV0[T0[:, 1]] * w[1] + UV0[T0[:, 2]] * w[2])); SN.append(fn0)
SP = np.concatenate(SP); SC = np.concatenate(SC); SN = np.concatenate(SN)
print('samples', len(SP), flush=True)
tree = cKDTree(SP)
# 新的貼圖：每個三角形一格裡的一半（兩個三角形共用一格），留 1.5 像素的邊
n = len(T1); cells = int(math.ceil(math.sqrt(n / 2))); cs = tex / cells; pad = 1.6
print('tris', n, 'cell px', round(cs, 1), flush=True)
UVn = np.zeros((n, 3, 2)); OUT = np.zeros((tex, tex, 3), np.float32); FILL = np.zeros((tex, tex), bool)
fn1 = np.cross(P1[T1[:, 1]] - P1[T1[:, 0]], P1[T1[:, 2]] - P1[T1[:, 0]]); fn1 /= np.maximum(np.linalg.norm(fn1, axis=1), 1e-15)[:, None]
qp, qn, qx, qy = [], [], [], []
for t in range(n):
    c = t // 2; cx = (c % cells) * cs; cy = (c // cells) * cs; up = t % 2 == 0
    if up: A = (cx + pad, cy + pad); B = (cx + cs - pad * 2.2, cy + pad); C = (cx + pad, cy + cs - pad * 2.2)
    else: A = (cx + cs - pad, cy + cs - pad); B = (cx + pad * 2.2, cy + cs - pad); C = (cx + cs - pad, cy + pad * 2.2)
    UVn[t] = [[A[0] / tex, A[1] / tex], [B[0] / tex, B[1] / tex], [C[0] / tex, C[1] / tex]]
    x0 = int(math.floor(cx)); y0 = int(math.floor(cy)); x1 = min(tex, int(math.ceil(cx + cs))); y1 = min(tex, int(math.ceil(cy + cs)))
    gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5); gx = gx.ravel(); gy = gy.ravel()
    # 這格裡屬於這個三角形那一半的像素（含邊）
    inside = (gx - cx + gy - cy <= cs + 0.01) if up else (gx - cx + gy - cy >= cs - 0.01)
    gx = gx[inside]; gy = gy[inside]
    # 重心座標（超出三角形的邊緣像素夾回三角形內）
    v0 = np.array(B) - np.array(A); v1 = np.array(C) - np.array(A); d = v0[0] * v1[1] - v0[1] * v1[0]
    px = gx - A[0]; py = gy - A[1]; b1 = (px * v1[1] - py * v1[0]) / d; b2 = (v0[0] * py - v0[1] * px) / d
    b1 = np.clip(b1, 0, 1); b2 = np.clip(b2, 0, 1); s = b1 + b2; over = s > 1; b1[over] /= s[over]; b2[over] /= s[over]; b0 = 1 - b1 - b2
    p = P1[T1[t, 0]] * b0[:, None] + P1[T1[t, 1]] * b1[:, None] + P1[T1[t, 2]] * b2[:, None]; nq = fn1[t].copy()
    if MIR is not None and MIR[t]: p = p.copy(); p[:, 0] = 2 * XMIR - p[:, 0]; nq[0] = -nq[0]
    qp.append(p); qn.append(np.repeat(nq[None], len(p), 0)); qx.append(gx.astype(int)); qy.append(gy.astype(int))
qp = np.concatenate(qp); qn = np.concatenate(qn); qx = np.concatenate(qx); qy = np.concatenate(qy)
print('texels', len(qp), flush=True)
K = 8; col = np.zeros((len(qp), 3), np.float32)
for i in range(0, len(qp), 400000):
    dd, ii = tree.query(qp[i:i + 400000], k=K, workers=-1)
    nn = SN[ii]; ok = (nn * qn[i:i + 400000, None, :]).sum(2) > 0.2   # 朝同一邊的才算（薄牆另一面的不拿）
    first = np.where(ok.any(1), ok.argmax(1), 0)
    col[i:i + 400000] = SC[ii[np.arange(len(ii)), first]]
OUT[qy, qx] = col; FILL[qy, qx] = True
# 沒畫到的像素用旁邊的補（mipmap 縮小時不會滲進黑色）
for _ in range(4):
    m = ~FILL
    if not m.any(): break
    acc = np.zeros_like(OUT); cnt = np.zeros((tex, tex), np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.roll(np.roll(OUT, dy, 0), dx, 1); shf = np.roll(np.roll(FILL, dy, 0), dx, 1); acc += sh * shf[..., None]; cnt += shf
    g = m & (cnt > 0); OUT[g] = acc[g] / cnt[g][:, None]; FILL |= g
# 位置、法線（同位置的點平均，接縫不出稜線）
NPOS = P1[T1].reshape(-1, 3); NUV = UVn.reshape(-1, 2)
q = np.round(P1 / 1e-6).astype(np.int64); _, wi = np.unique(q, axis=0, return_inverse=True); wi = wi.ravel()
Nw = np.zeros((wi.max() + 1, 3)); fnn = np.cross(P1[T1[:, 1]] - P1[T1[:, 0]], P1[T1[:, 2]] - P1[T1[:, 0]])
for k in range(3): np.add.at(Nw, wi[T1[:, k]], fnn)
NN = Nw[wi[T1]].reshape(-1, 3); NN /= np.maximum(np.linalg.norm(NN, axis=1), 1e-12)[:, None]
if FISH:   # 頭朝 +x、身長 1、中心在原點
    c = NPOS.mean(0); X = NPOS - c; ev, evec = np.linalg.eigh(np.cov(X.T)); ax = evec[:, np.argmax(ev)]; proj = X @ ax
    # 頭＝身體比較粗的那一端（尾巴那端很薄）
    lo, hi = proj.min(), proj.max(); L = hi - lo; th = lambda sel: np.linalg.norm(X[sel] - np.outer(proj[sel], ax), axis=1).mean()
    a_end = th(proj > hi - L * 0.3); b_end = th(proj < lo + L * 0.3)
    if b_end > a_end: ax = -ax; proj = -proj
    # 上下：讓 +y 保持原本最接近 +y 的方向
    yv = np.array([0, 1.0, 0]); yv = yv - ax * (yv @ ax); yv /= np.linalg.norm(yv); zv = np.cross(ax, yv)
    R = np.stack([ax, yv, zv]); X = X @ R.T; X[:, 0] -= (X[:, 0].max() + X[:, 0].min()) / 2; s = 1 / (X[:, 0].max() - X[:, 0].min()); NPOS = X * s; NN = NN @ R.T
    print('fish head ends thick', round(a_end, 4), round(b_end, 4), flush=True)
TI = np.arange(len(NPOS), dtype=np.uint32)
jb = io.BytesIO(); Image.fromarray(np.clip(OUT, 0, 255).astype(np.uint8)).save(jb, 'JPEG', quality=88); jb = jb.getvalue()
parts = [NPOS.astype(np.float32).tobytes(), NN.astype(np.float32).tobytes(), NUV.astype(np.float32).tobytes(), TI.tobytes(), jb]
bvs = []; buf = b''
for dd in parts:
    while len(buf) % 4: buf += b'\0'
    bvs.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(dd)}); buf += dd
while len(buf) % 4: buf += b'\0'
G = {'asset': {'version': '2.0', 'generator': 'tide bake'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
     'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
     'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.75}, 'doubleSided': True}],
     'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9729 if '--nomip' in sys.argv else 9987}], 'images': [{'bufferView': 4, 'mimeType': 'image/jpeg'}],
     'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(NPOS), 'type': 'VEC3', 'min': NPOS.min(0).tolist(), 'max': NPOS.max(0).tolist()}, {'bufferView': 1, 'componentType': 5126, 'count': len(NPOS), 'type': 'VEC3'},
                   {'bufferView': 2, 'componentType': 5126, 'count': len(NPOS), 'type': 'VEC2'}, {'bufferView': 3, 'componentType': 5125, 'count': TI.size, 'type': 'SCALAR'}],
     'bufferViews': bvs, 'buffers': [{'byteLength': len(buf)}]}
js = json.dumps(G).encode()
while len(js) % 4: js += b' '
out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(buf)) + b'BIN\0' + buf
open(dst, 'wb').write(out); print('out', dst, len(out), 'bytes', flush=True)
