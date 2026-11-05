// 潮汐釣魚村：玩家角色 3D 模型產生器（2026-11-04）
// 角色的造型是本專案自己設計的（大頭 Q 版，跟原本遊戲裡的角色長得一樣），骨架和動作用 KayKit Character Animations（CC0，Kay Lousberg）。
// 做法：把 KayKit 的 Rig_Medium 骨架縮小 0.85 倍 → 在骨架的 T-pose 上做出我們的身體（每個點依照離哪根骨頭最近分配權重）
//       → 綁成 SkinnedMesh → 挑要用的動作（位移軌跡跟著縮小）→ 加上自己做的游泳、潛水動作 → 匯出成 models/tide_kid.glb
// 在瀏覽器裡跑（tools/character/build.html 或測試腳本），three.js 版本跟遊戲一樣（r158）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const SCALE = 0.85;
// 要放進模型檔的動作：KayKit 的名字 → 遊戲裡用的名字
export const CLIPS = {
  'Idle_A': 'idle', 'Idle_B': 'idle2', 'Walking_A': 'walk', 'Running_A': 'run', 'Running_B': 'sprint',
  'Jump_Start': 'jump_start', 'Jump_Idle': 'jump_air', 'Jump_Land': 'jump_land',
  'Fishing_Cast': 'fish_cast', 'Fishing_Idle': 'fish_idle', 'Fishing_Reeling': 'fish_reel', 'Fishing_Struggling': 'fish_fight', 'Fishing_Catch': 'fish_catch', 'Fishing_Bite': 'fish_bite',
  'Sit_Chair_Idle': 'sit', 'Sit_Floor_Idle': 'sit_floor', 'Lie_Idle': 'lie', 'Waving': 'wave', 'Cheering': 'cheer', 'Holding_A': 'hold', 'PickUp': 'pickup', 'Interact': 'interact', 'Throw': 'throw',
  // 表情動作（2026-11-05）
  'Push_Ups': 'pushups', 'Sit_Ups': 'situps', 'Hit_A': 'surprised', 'Death_A': 'playdead', 'Lie_Down': 'lie_down', 'Sit_Floor_Down': 'sit_floor_down',
};
const FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb', 'Rig_Medium_Tools.glb', 'Rig_Medium_Simulation.glb'];

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function segDist(p, a, b){ const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); }

export async function buildCharacter(base){
  const loader = new GLTFLoader();
  const rigG = await loader.loadAsync(base + 'Mannequin_Medium.glb');
  // 只留骨架
  const rig = rigG.scene; const meshes = []; rig.traverse(o => { if (o.isMesh || o.isSkinnedMesh) meshes.push(o); }); for (const m of meshes) m.parent.remove(m);
  const root = rig.getObjectByName('root'); root.updateMatrixWorld(true);
  // 縮小骨架：每根骨頭的位置 ×0.85（方向不變，動作的旋轉照樣能用）
  root.traverse(o => { if (o.isBone && o !== root) o.position.multiplyScalar(SCALE); });
  rig.updateMatrixWorld(true);
  const B = {}; root.traverse(o => { if (o.isBone) B[o.name] = o; });
  const P = {}; for (const k in B) P[k] = B[k].getWorldPosition(new THREE.Vector3());

  // ---- 材質（名字固定，遊戲照名字換顏色）----
  const M = {
    skin: new THREE.MeshStandardMaterial({ name:'skin', color:'#ffd9b8', roughness:0.7 }),
    hair: new THREE.MeshStandardMaterial({ name:'hair', color:'#5a3d2b', roughness:0.8 }),
    shirt: new THREE.MeshStandardMaterial({ name:'shirt', color:'#f17b6d', roughness:0.75 }),
    pants: new THREE.MeshStandardMaterial({ name:'pants', color:'#2f4b63', roughness:0.8 }),
    shin: new THREE.MeshStandardMaterial({ name:'shin', color:'#2f4b63', roughness:0.8 }),   // 小腿（穿短褲、裙子的時候遊戲換成皮膚）
    shoe: new THREE.MeshStandardMaterial({ name:'shoe', color:'#6b4a35', roughness:0.7 }),
    iris: new THREE.MeshStandardMaterial({ name:'iris', color:'#3a2a20', roughness:0.35 }),
    ink: new THREE.MeshStandardMaterial({ name:'ink', color:'#18334a', roughness:0.4 }),
    white: new THREE.MeshStandardMaterial({ name:'white', color:'#ffffff', roughness:0.3, emissive:'#ffffff', emissiveIntensity:0.6 }),
    blush: new THREE.MeshStandardMaterial({ name:'blush', color:'#ff9a8f', roughness:0.8, transparent:true, opacity:0.6 }),
  };
  const ORDER = Object.keys(M);
  const parts = [];   // { geo（世界座標）, mat, bones:[[名字, 段落起點, 段落終點]] 或 rigid:骨頭名字 }
  const put = (geo, mat, bones, xf) => { if (xf) geo.applyMatrix4(xf); parts.push({ geo: geo.toNonIndexed ? geo : geo, mat, bones }); };
  const at = (x, y, z, rx, ry, rz, s) => new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), s ? v3(s[0], s[1], s[2]) : v3(1, 1, 1));
  const along = (geo, a, b) => { const d = b.clone().sub(a), L = d.length(); const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.clone().normalize()); geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, v3(1, 1, 1))); return geo; };

  // 頭：大大的圓頭（頭骨上方），頭髮、耳朵、眼睛、眉毛、腮紅、嘴巴，全部跟頭骨一起動
  const H = P.head.clone().add(v3(0, 0.255, 0.01)), HR = 0.33;
  put(new THREE.SphereGeometry(HR, 28, 20), M.skin, 'head', at(H.x, H.y, H.z, 0, 0, 0, [1, 0.94, 0.96]));
  { const g = new THREE.SphereGeometry(HR + 0.018, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56); put(g, M.hair, 'head', at(H.x, H.y + 0.01, H.z - 0.02, -0.42, 0, 0)); }
  for (const sx of [-1, 1]){
    put(new THREE.SphereGeometry(0.065, 12, 10), M.skin, 'head', at(H.x + sx * 0.315, H.y - 0.02, H.z - 0.01));
    const ex = H.x + sx * 0.115, ey = H.y, ez = H.z + 0.285;
    put(new THREE.SphereGeometry(0.056, 16, 12), M.iris, 'head', at(ex, ey, ez, 0, 0, 0, [0.82, 1.15, 0.5]));
    put(new THREE.SphereGeometry(0.03, 10, 8), M.ink, 'head', at(ex, ey - 0.009, ez + 0.018, 0, 0, 0, [0.82, 1.15, 0.5]));
    put(new THREE.SphereGeometry(0.015, 8, 6), M.white, 'head', at(ex + sx * 0.013 + 0.005, ey + 0.025, ez + 0.03));
    put(new THREE.SphereGeometry(0.009, 6, 5), M.white, 'head', at(ex - sx * 0.01, ey - 0.03, ez + 0.03));
    put(new THREE.TorusGeometry(0.056, 0.008, 4, 14, Math.PI), M.ink, 'head', at(ex, ey + 0.005, ez + 0.01, 0, 0, 0, [0.92, 1.2, 0.5]));
    put(new THREE.CapsuleGeometry(0.012, 0.06, 3, 6), M.hair, 'head', at(H.x + sx * 0.118, H.y + 0.098, H.z + 0.296, 0, 0, Math.PI / 2 + sx * 0.12));
    put(new THREE.CircleGeometry(0.055, 14), M.blush, 'head', at(H.x + sx * 0.19, H.y - 0.085, H.z + 0.262, 0, sx * 0.62, 0));
  }
  put(new THREE.TorusGeometry(0.045, 0.011, 5, 12, Math.PI), M.ink, 'head', at(H.x, H.y - 0.1, H.z + 0.305, 0, 0, Math.PI, [1, 0.8, 1]));

  // 身體：圓圓的上衣（胸骨、脊椎、髖部之間平滑分配）、腰帶
  { const prof = [[0.0, 0.17], [0.03, 0.235], [0.12, 0.255], [0.38, 0.25], [0.52, 0.235], [0.62, 0.19], [0.7, 0.1], [0.72, 0.0]].map(([y, r]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, 22); g.scale(1, 1, 0.86); g.translate(0, P.hips.y + 0.02, 0); g.rotateY(Math.PI);   // 接縫轉到背後
    put(g, M.shirt, [['hips', P.hips, P.spine], ['spine', P.spine, P.chest], ['chest', P.chest, P.head]]); }
  { const g = new THREE.CylinderGeometry(0.262, 0.262, 0.07, 22); g.scale(1, 1, 0.86); put(g, M.pants, [['hips', P.hips, P.spine]], at(0, P.hips.y + 0.115, 0)); }
  // 手：袖子（上臂）＋手臂＋圓圓的手（T-pose：沿著 x 軸）
  for (const s of ['l', 'r']){
    const ua = P['upperarm' + s], la = P['lowerarm' + s], wr = P['wrist' + s], hd = P['hand' + s];
    put(along(new THREE.CapsuleGeometry(0.075, Math.max(0.01, ua.distanceTo(la) - 0.02), 4, 12), ua.clone().lerp(la, -0.15), la.clone().lerp(ua, -0.12)), M.shirt, [['upperarm' + s, ua, la], ['lowerarm' + s, la, wr]]);
    put(along(new THREE.CapsuleGeometry(0.066, Math.max(0.01, la.distanceTo(wr) - 0.04), 4, 12), la, wr), M.skin, [['upperarm' + s, ua, la], ['lowerarm' + s, la, wr], ['wrist' + s, wr, hd]]);
    put(new THREE.SphereGeometry(0.078, 14, 10), M.skin, 'hand' + s, at(hd.x + (s === 'l' ? 0.03 : -0.03), hd.y, hd.z));
  }
  // 腳：褲管（大腿、小腿）＋鞋子
  for (const s of ['l', 'r']){
    const ul = P['upperleg' + s], ll = P['lowerleg' + s], ft = P['foot' + s], to = P['toes' + s];
    put(along(new THREE.CapsuleGeometry(0.098, Math.max(0.01, ul.distanceTo(ll) - 0.02), 4, 12), ul.clone().add(v3(0, 0.06, 0)), ll), M.pants, [['hips', P.hips, ul], ['upperleg' + s, ul, ll], ['lowerleg' + s, ll, ft]]);
    put(along(new THREE.CapsuleGeometry(0.09, Math.max(0.01, ll.distanceTo(ft) - 0.03), 4, 12), ll, ft), M.shin, [['upperleg' + s, ul, ll], ['lowerleg' + s, ll, ft], ['foot' + s, ft, to]]);
    { const g = new THREE.SphereGeometry(0.11, 14, 10); g.scale(0.95, 0.6, 1.4); put(g, M.shoe, [['foot' + s, ft, to.clone().lerp(ft, 0.4)], ['toes' + s, to.clone().lerp(ft, 0.4), to]], at(ft.x, Math.max(0.065, ft.y - 0.07), (ft.z + to.z) / 2 + 0.01)); }
  }

  // ---- 合成一個 SkinnedMesh：每個點照最近的骨頭段落分配權重（最多 2 根），關節附近平滑過渡 ----
  const boneList = []; root.traverse(o => { if (o.isBone) boneList.push(o); });
  const idxOf = Object.fromEntries(boneList.map((b, i) => [b.name, i]));
  const pos = [], nor = [], uv = [], si = [], sw = [], groups = [];
  for (const mname of ORDER){
    const start = pos.length / 3;
    for (const p of parts.filter(p => p.mat === M[mname])){
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo; const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
      for (let i = 0; i < pa.count; i++){
        const v = v3(pa.getX(i), pa.getY(i), pa.getZ(i)); pos.push(v.x, v.y, v.z); nor.push(na.getX(i), na.getY(i), na.getZ(i)); uv.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0);
        if (typeof p.bones === 'string'){ si.push(idxOf[p.bones], 0, 0, 0); sw.push(1, 0, 0, 0); continue; }
        const ds = p.bones.map(([n, a, b]) => [n, segDist(v, a, b)]).sort((x, y) => x[1] - y[1]);
        const [n0, d0] = ds[0], [n1, d1] = ds[1] || ds[0];
        const k = ds.length > 1 ? THREE.MathUtils.smoothstep(d1 - d0, 0, 0.05) : 1, w0 = 0.5 + 0.5 * k;   /* 兩根骨頭差不多近的地方各半 */
        si.push(idxOf[n0], idxOf[n1], 0, 0); sw.push(w0, 1 - w0, 0, 0);
      }
    }
    const n = pos.length / 3 - start; if (n) groups.push([start, n, ORDER.indexOf(mname)]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i));   /* 匯出多材質要有 index */
  for (const [s, c, m] of groups) geo.addGroup(s, c, m);
  const mesh = new THREE.SkinnedMesh(geo, ORDER.map(k => M[k])); mesh.name = 'TideKid';
  const holder = new THREE.Group(); holder.name = 'TideKidRoot'; holder.add(root); holder.add(mesh);
  holder.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(boneList); mesh.bind(skel, mesh.matrixWorld);

  // ---- 動作 ----
  const clips = [];
  for (const f of FILES){ const g = await loader.loadAsync(base + f); for (const c of g.animations){ const nm = CLIPS[c.name]; if (!nm) continue;
    const cc = c.clone(); cc.name = nm;
    cc.tracks = cc.tracks.filter(t => !t.name.endsWith('.scale')).filter(t => !t.name.endsWith('.position') || /^(hips|root)\./.test(t.name)).filter(t => B[t.name.split('.')[0]]);   /* 我們的骨架沒有的骨頭（拿工具的掛點）不要 */
    for (const t of cc.tracks) if (t.name.endsWith('.position')){ for (let i = 0; i < t.values.length; i += 3){ t.values[i] *= SCALE; t.values[i + 1] *= SCALE; t.values[i + 2] *= SCALE; } if (/^root\./.test(t.name)) for (let i = 0; i < t.values.length; i += 3){ t.values[i] = 0; t.values[i + 2] = 0; } }
    // 遊戲裡角色跑得比 KayKit 的原始動作快很多：走、跑的腿擺動幅度放大一點（步伐大一點），播放速度才不用快到很怪
    const amp = { walk: 1.25, run: 1.55, sprint: 1.7 }[nm];
    if (amp) for (const t of cc.tracks){ const bn = t.name.split('.')[0]; if (!t.name.endsWith('.quaternion') || !/^(upperleg|lowerleg)/.test(bn)) continue; const R = B[bn].quaternion.clone(), Ri = R.clone().invert(), k = amp;
      for (let i = 0; i < t.values.length; i += 4){ const Q = new THREE.Quaternion(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]), d = Ri.clone().multiply(Q); if (d.w < 0){ d.x = -d.x; d.y = -d.y; d.z = -d.z; d.w = -d.w; }
        const ang = 2 * Math.acos(Math.min(1, d.w)), sn = Math.sqrt(Math.max(1e-9, 1 - d.w * d.w)); if (ang < 1e-4) continue; const ax = new THREE.Vector3(d.x / sn, d.y / sn, d.z / sn), d2 = new THREE.Quaternion().setFromAxisAngle(ax, ang * k), r = R.clone().multiply(d2);
        t.values[i] = r.x; t.values[i + 1] = r.y; t.values[i + 2] = r.z; t.values[i + 3] = r.w; } }
    clips.push(cc); } }
  clips.push(swimClip(boneList, 'swim', false), swimClip(boneList, 'dive', true));
  clips.push(...emoteClips(boneList));
  return { holder, mesh, clips, boneList };
}

// 自己做的游泳（蛙式，身體在水面）和潛水（手往兩邊划、腳上下踢）：用「角色站著時的方向」寫旋轉，左右才會對稱
// 站著的角色面向 +z：繞 z 轉＝手往上抬／放下；繞 x 轉＝手腳往前後擺（遊戲裡游泳時整個人會往前趴平）
function swimClip(bones, name, dive){
  const T = dive ? 1.5 : 1.25, N = 13, times = Array.from({ length: N }, (_, i) => i / (N - 1) * T), tracks = [];
  const byName = Object.fromEntries(bones.map(b => [b.name, b]));
  const q = (bn, fn) => { const b = byName[bn]; if (!b) return; const restL = b.quaternion.clone(), W = b.getWorldQuaternion(new THREE.Quaternion()), Wi = W.clone().invert(), vals = [];
    for (const t of times){ const k = t / T * Math.PI * 2, e = fn(k), D = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ')); const r = restL.clone().multiply(Wi.clone().multiply(D).multiply(W)); vals.push(r.x, r.y, r.z, r.w); }
    tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, vals)); };
  for (const [s, sg] of [['l', 1], ['r', -1]]){
    if (dive){
      // 潛水：手從頭頂往兩邊划到大腿旁邊再收回來；腳一上一下踢（蛙鞋）
      q('upperarm' + s, k => [0.25 * Math.sin(k), 0, sg * (0.55 + 0.75 * Math.cos(k))]);
      q('lowerarm' + s, k => [0, 0, sg * 0.35 * Math.max(0, Math.sin(k))]);
      const ph = s === 'l' ? 0 : Math.PI;
      q('upperleg' + s, k => [0.35 * Math.sin(k * 2 + ph), 0, sg * 0.08]);
      q('lowerleg' + s, k => [0.15 + 0.35 * Math.max(0, Math.sin(k * 2 + ph + 0.8)), 0, 0]);
      q('foot' + s, k => [0.9, 0, 0]);
    } else {
      // 蛙式：手往前伸（頭頂）→ 往外、往下划開 → 收到胸前 → 再伸出去；腳往外蹬再併攏
      q('upperarm' + s, k => [-0.5 * Math.max(0, Math.sin(k)), 0, sg * (0.85 + 0.6 * Math.cos(k))]);
      q('lowerarm' + s, k => [-0.9 * Math.max(0, Math.sin(k)), 0, 0]);
      q('upperleg' + s, k => [-0.4 * Math.max(0, Math.sin(k + 1.2)), 0, sg * (0.15 + 0.4 * Math.max(0, Math.sin(k + 1.2)))]);
      q('lowerleg' + s, k => [0.2 + 1.1 * Math.max(0, Math.sin(k + 0.6)), 0, 0]);
      q('foot' + s, k => [0.6, 0, 0]);
    }
  }
  q('head', k => [dive ? -0.75 : -1.0, 0, 0]);
  q('chest', k => [0.05 * Math.sin(k * 2), 0, 0]);
  return new THREE.AnimationClip(name, T, tracks);
}

// 自己做的表情動作：跳舞、鞠躬、拍手、生氣跺腳、大笑（跟游泳一樣用「站著時的方向」寫旋轉：繞 x＝往前後、繞 z＝往兩邊抬）
function poseClip(bones, name, T, N, def){
  const times = Array.from({ length: N }, (_, i) => i / (N - 1) * T), tracks = [], byName = Object.fromEntries(bones.map(b => [b.name, b]));
  for (const [bn, fn] of Object.entries(def.rot || {})){ const b = byName[bn]; if (!b) continue; const restL = b.quaternion.clone(), W = b.getWorldQuaternion(new THREE.Quaternion()), Wi = W.clone().invert(), vals = [];
    for (const t of times){ const k = t / T, e = fn(k), D = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ')); const r = restL.clone().multiply(Wi.clone().multiply(D).multiply(W)); vals.push(r.x, r.y, r.z, r.w); }
    tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, vals)); }
  if (def.hipsY && byName.hips){ const h = byName.hips, vals = []; for (const t of times){ const k = t / T; vals.push(h.position.x, h.position.y + def.hipsY(k), h.position.z); } tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, vals)); }
  return new THREE.AnimationClip(name, T, tracks);
}
function emoteClips(bones){
  const S = Math.sin, P2 = Math.PI * 2, out = [], arms = (fnL, fnR, low) => { const r = {}; r.upperarml = fnL; r.upperarmr = fnR; if (low){ r.lowerarml = low[0]; r.lowerarmr = low[1]; } return r; };
  // 跳舞：左右搖、手輪流往上舉、膝蓋一彈一彈
  out.push(poseClip(bones, 'dance', 1.2, 25, { hipsY: k => -0.035 * Math.abs(S(k * P2 * 2)),
    rot: Object.assign(arms(k => [-0.3, 0, 1.0 + 0.9 * Math.max(0, S(k * P2))], k => [-0.3, 0, -(1.0 + 0.9 * Math.max(0, -S(k * P2)))], [k => [0, 0, 0.6 + 0.4 * S(k * P2)], k => [0, 0, -(0.6 - 0.4 * S(k * P2))]]),
      { hips: k => [0, 0.3 * S(k * P2), 0.06 * S(k * P2)], chest: k => [0, -0.15 * S(k * P2), -0.08 * S(k * P2)], head: k => [0, 0, 0.18 * S(k * P2)],
        upperlegl: k => [-0.25 * Math.max(0, S(k * P2 * 2)), 0, 0.05], upperlegr: k => [-0.25 * Math.max(0, -S(k * P2 * 2)), 0, -0.05], lowerlegl: k => [0.4 * Math.max(0, S(k * P2 * 2)), 0, 0], lowerlegr: k => [0.4 * Math.max(0, -S(k * P2 * 2)), 0, 0] }) }));
  // 鞠躬：彎下去、停一下、起來
  const bw = k => k < 0.3 ? Math.sin(k / 0.3 * Math.PI / 2) : k < 0.65 ? 1 : Math.cos((k - 0.65) / 0.35 * Math.PI / 2);
  out.push(poseClip(bones, 'bow', 2.0, 21, { rot: { spine: k => [0.45 * bw(k), 0, 0], chest: k => [0.45 * bw(k), 0, 0], head: k => [0.25 * bw(k), 0, 0], upperarml: k => [0, 0.15 * bw(k), -1.2], upperarmr: k => [0, 0.15 * bw(k), 1.2] } }));
  // 拍手：手在胸前，一開一合
  const op = k => 0.5 + 0.5 * Math.cos(k * P2);   /* 1＝張開、0＝合起來 */
  out.push(poseClip(bones, 'clap', 0.6, 13, { rot: { upperarml: k => [0, 1.7 - 0.45 * op(k), -0.45], upperarmr: k => [0, 1.7 - 0.45 * op(k), 0.45],
    lowerarml: k => [0, 0.35, 0], lowerarmr: k => [0, 0.35, 0], head: k => [-0.1, 0, 0] } }));
  // 生氣跺腳：手插腰、一腳一腳用力踩
  out.push(poseClip(bones, 'angry', 0.9, 19, { hipsY: k => -0.02 * Math.abs(S(k * P2)),
    rot: { upperarml: k => [0, -0.25, -1.05], upperarmr: k => [0, -0.25, 1.05], lowerarml: k => [0, 0.7 + 0.15 * S(k * P2 * 2), 0], lowerarmr: k => [0, 0.7 - 0.15 * S(k * P2 * 2), 0], head: k => [0.2, 0, 0.08 * S(k * P2 * 2)], chest: k => [0.12, 0, 0.05 * S(k * P2)],
      upperlegl: k => [-0.55 * Math.max(0, S(k * P2)), 0, 0], lowerlegl: k => [0.7 * Math.max(0, S(k * P2)), 0, 0], upperlegr: k => [-0.55 * Math.max(0, -S(k * P2)), 0, 0], lowerlegr: k => [0.7 * Math.max(0, -S(k * P2)), 0, 0] } }));
  // 大笑：身體往後仰、抖肩膀、抱肚子
  out.push(poseClip(bones, 'laugh', 0.5, 11, { rot: { chest: k => [-0.22 + 0.06 * S(k * P2), 0, 0], head: k => [-0.3 + 0.08 * S(k * P2), 0, 0], spine: k => [-0.08, 0, 0],
    upperarml: k => [0, 0.45, -1.0 + 0.06 * S(k * P2)], upperarmr: k => [0, 0.45, 1.0 - 0.06 * S(k * P2)], lowerarml: k => [0, 1.5, 0], lowerarmr: k => [0, 1.5, 0] } }));
  return out;
}

export async function exportGLB(holder, clips){
  const ex = new GLTFExporter();
  return await new Promise((res, rej) => ex.parse(holder, res, rej, { binary: true, animations: clips, onlyVisible: false }));
}
export { SkeletonUtils };
