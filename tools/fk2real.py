# 用法：python3 tools/fk2real.py fishkit的魚.glb 輸出.glb
# Fish Kit（CC0）的魚轉成 REAL3 用的樣子：頭朝 +x、身長 1、中心在原點、背朝 +y；貼圖照原本的（webp，鰭是半透明的）
import json, struct, sys, numpy as np
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); L = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20 + L]); off = 20 + L; BL = struct.unpack('<I', b[off:off + 4])[0]; BIN = b[off + 8:off + 8 + BL]
def acc(i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; ct = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); arr = np.frombuffer(BIN, ct, a['count'] * n, o); return arr.reshape(-1, n) if n > 1 else arr
pr = J['meshes'][0]['primitives'][0]; P = acc(pr['attributes']['POSITION']).astype(np.float64); N = acc(pr['attributes']['NORMAL']).astype(np.float64); UV = acc(pr['attributes']['TEXCOORD_0']).astype(np.float32); I = acc(pr['indices']).astype(np.uint32)
ext = P.max(0) - P.min(0); ax = int(np.argmax(ext)); sw = (J['nodes'][0].get('extras') or {}).get('swim') or {}
sign = 1 if sw.get('snout', 1) >= 0 else -1
# 新的 x＝身體長軸（頭那邊是正），y 保持朝上，z＝x 叉 y
X = np.zeros(3); X[ax] = sign; Y = np.array([0, 1.0, 0]) if ax != 1 else np.array([0, 0, 1.0]); Z = np.cross(X, Y); R = np.stack([X, Y, Z])
P = P @ R.T; N = N @ R.T; c = (P.max(0) + P.min(0)) / 2; P -= c; s = 1 / (P[:, 0].max() - P[:, 0].min()); P *= s
if np.linalg.det(R) < 0: I = I.reshape(-1, 3)[:, ::-1].ravel()
im = J['images'][0]; bv = J['bufferViews'][im['bufferView']]; img = BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
parts = [P.astype(np.float32).tobytes(), N.astype(np.float32).tobytes(), UV.tobytes(), I.astype(np.uint32).tobytes(), img]
bvs = []; buf = b''
for dd in parts:
    while len(buf) % 4: buf += b'\0'
    bvs.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(dd)}); buf += dd
while len(buf) % 4: buf += b'\0'
G = {'asset': {'version': '2.0', 'generator': 'tide fk2real'}, 'extensionsUsed': ['EXT_texture_webp'], 'extensionsRequired': ['EXT_texture_webp'], 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
     'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
     'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.5}, 'alphaMode': 'MASK', 'alphaCutoff': 0.4, 'doubleSided': True}],
     'textures': [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 0}}}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987}], 'images': [{'bufferView': 4, 'mimeType': 'image/webp'}],
     'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()}, {'bufferView': 1, 'componentType': 5126, 'count': len(P), 'type': 'VEC3'},
                   {'bufferView': 2, 'componentType': 5126, 'count': len(P), 'type': 'VEC2'}, {'bufferView': 3, 'componentType': 5125, 'count': int(I.size), 'type': 'SCALAR'}],
     'bufferViews': bvs, 'buffers': [{'byteLength': len(buf)}]}
js = json.dumps(G).encode()
while len(js) % 4: js += b' '
open(dst, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(buf)) + b'BIN\0' + buf)
print(dst, 'axis', 'xyz'[ax], 'sign', sign, 'bytes', 20 + len(js) + 8 + len(buf))
