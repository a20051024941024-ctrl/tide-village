// 潮汐釣魚村：照真實魚類比例「參數化」產生的 3D 魚模型（參考維基百科的體型、鰭的位置、尾鰭形狀、顏色和花紋）
// 產生的資料格式跟 fish-models.js 的 FISH_MESH 一樣：每個部位一串三角形頂點（×1000 的整數），頭朝 +x，全長約 1.6。
// © 2026 a20051024941024-ctrl。保留所有權利。

const PI = Math.PI, TL = 1.6, X0 = 0.8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = k => k * k * (3 - 2 * k);
function hash(n){ const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// 控制點內插：pts = [[t, v], ...]（t 由 0 到 1）
function curve(pts, t){
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++){ const [ta, va] = pts[i - 1], [tb, vb] = pts[i]; if (t <= tb) return lerp(va, vb, sstep((t - ta) / (tb - ta || 1))); }
  return pts[pts.length - 1][1];
}

class Mesh {
  constructor(){ this.parts = {}; }
  tri(part, a, b, c){ (this.parts[part] || (this.parts[part] = [])).push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  quad(part, a, b, c, d){ this.tri(part, a, b, c); this.tri(part, a, c, d); }
  tri2(part, a, b, c){ this.tri(part, a, b, c); this.tri(part, a, c, b); }          // 兩面都看得到（鰭）
  quad2(part, a, b, c, d){ this.tri2(part, a, b, c); this.tri2(part, a, c, d); }
  // 橢圓球
  ellip(part, c, r, seg = 10, rings = 7, rot){
    const P = (i, j) => { const th = (j / rings) * PI, ph = (i / seg) * PI * 2; let v = [Math.sin(th) * Math.cos(ph) * r[0], Math.cos(th) * r[1], Math.sin(th) * Math.sin(ph) * r[2]]; if (rot) v = rot(v); return [c[0] + v[0], c[1] + v[1], c[2] + v[2]]; };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++){ const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1); if (j > 0) this.tri(part, a, b, cc); if (j < rings - 1) this.tri(part, a, cc, d); }
  }
  // 兩點之間的管子（圓錐台），n 邊
  tube(part, p0, p1, r0, r1, n = 5, cap = true){
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...d) || 1e-6, u = d.map(v => v / L);
    let a = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let s = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]]; const sl = Math.hypot(...s); s = s.map(v => v / sl);
    const t = [u[1] * s[2] - u[2] * s[1], u[2] * s[0] - u[0] * s[2], u[0] * s[1] - u[1] * s[0]];
    const ring = (p, r) => Array.from({ length: n }, (_, i) => { const an = i / n * PI * 2, cs = Math.cos(an) * r, sn = Math.sin(an) * r; return [p[0] + s[0] * cs + t[0] * sn, p[1] + s[1] * cs + t[1] * sn, p[2] + s[2] * cs + t[2] * sn]; });
    const A = ring(p0, r0), B = ring(p1, r1);
    for (let i = 0; i < n; i++){ const j = (i + 1) % n; this.quad(part, A[i], A[j], B[j], B[i]); if (cap){ if (r0 > 0) this.tri(part, p0, A[j], A[i]); if (r1 > 0) this.tri(part, p1, B[i], B[j]); } }
  }
  // 折線管子（腳、觸鬚）
  limb(part, pts, r0, r1, n = 5){ for (let i = 0; i < pts.length - 1; i++){ const k0 = i / (pts.length - 1), k1 = (i + 1) / (pts.length - 1); this.tube(part, pts[i], pts[i + 1], lerp(r0, r1, k0), lerp(r0, r1, k1), n); } }
  cone(part, base, tip, r, n = 6){ this.tube(part, base, tip, r, 0, n); }
  mirror(fn){ fn(1); fn(-1); }
  out(){ const o = {}; for (const k in this.parts) o[k] = this.parts[k].map(v => Math.round(v * 1000)); return o; }
}

/* ======================= 一般的魚 =======================
   p.bl   身體（不含尾鰭）佔全長的比例
   p.depth 最大體高 ÷ 體長，p.wr 體寬 ÷ 體高，p.tm 最高點的位置，p.nose 吻部（<1 鈍、>1 尖），p.ped 尾柄高度比例
   p.up / p.lo / p.wd 可以直接給控制點，p.yc 中心線上下偏移（控制點），p.n 截面方圓（2 橢圓、>2 方）
   p.cs 背腹分色的高度（-1~1），p.pat 花紋規則，p.dorsal/anal/pect/pelv/caudal 鰭，p.eye，p.extra 其他零件 */
export function genFish(p){
  const M = new Mesh(), bl = p.bl ?? 0.8, SL = TL * bl, xt = X0 - SL, HD = (p.depth ?? 0.25) * SL / 2;
  const prof = t => { const tm = p.tm ?? 0.35, nose = p.nose ?? 0.8, ped = p.ped ?? 0.22; if (t < tm) return Math.pow(Math.sin(t / tm * PI / 2), nose); const a = (t - tm) / (1 - tm); return ped + (1 - ped) * Math.pow(Math.cos(a * PI / 2), p.tailK ?? 1.3); };
  const top = p.top ?? 0.5;
  const hu = t => HD * 2 * top * (p.up ? curve(p.up, t) : prof(t));
  const hl = t => HD * 2 * (1 - top) * (p.lo ? curve(p.lo, t) : prof(t));
  const wd = t => HD * (p.wr ?? 0.55) * (p.wd ? curve(p.wd, t) : prof(t));
  const yc = t => (p.yc ? curve(p.yc, t) : 0) * HD;
  const X = t => X0 - t * SL, n = p.n ?? 2;
  const se = (c, s) => [Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
  const NS = p.lod ? 16 : p.ns ?? 28, NR = p.lod ? 14 : p.nr ?? 22;   // lod：低畫質用比較少的面
  const pt = (t, th) => { const [cz, sy] = se(Math.cos(th), Math.sin(th)); const h = sy > 0 ? hu(t) : hl(t); return [X(t), yc(t) + sy * h, cz * wd(t)]; };
  const rules = p.pat || [];
  const partAt = (t, yn, z) => {
    let part = yn > (p.cs ?? 0) + (p.csWave ? Math.sin(t * p.csWave[0]) * p.csWave[1] : 0) + (p.csSlope ? p.csSlope * t : 0) ? 'Top' : 'Bottom';
    for (const r of rules){
      if (r.side && Math.sign(z) !== r.side) continue;
      if (r.k === 'band' && t >= r.t0 && t <= r.t1 && yn >= (r.y0 ?? -2) && yn <= (r.y1 ?? 2)) part = r.part;
      else if (r.k === 'bars'){ for (const [a, b, y0 = -2, y1 = 2] of r.bars) if (t >= a && t <= b && yn >= y0 && yn <= y1) part = r.part; }
      else if (r.k === 'ell'){ const dx = (t - r.t) / r.rt, dy = (yn - r.y) / r.ry; if (dx * dx + dy * dy <= 1) part = r.part; }
      else if (r.k === 'spots'){ const gx = r.gt ?? 0.06, gy = r.gy ?? 0.3; const ix = Math.floor(t / gx), iy = Math.floor((yn + 1) / gy);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++){ const cx = (ix + a + 0.2 + 0.6 * hash(ix + a + (iy + b) * 57 + (r.seed || 0))) * gx, cy = (iy + b + 0.2 + 0.6 * hash((ix + a) * 13 + (iy + b) * 7 + 3 + (r.seed || 0))) * gy - 1;
          if (cx < (r.t0 ?? 0) || cx > (r.t1 ?? 1) || cy < (r.y0 ?? -1) || cy > (r.y1 ?? 1)) continue; if (hash((ix + a) * 31 + (iy + b) * 17 + (r.seed || 0)) > (r.fill ?? 1)) continue;
          const dx = (t - cx) / (r.r ?? 0.02), dy = (yn - cy) / ((r.r ?? 0.02) * (r.ar ?? 6)); if (dx * dx + dy * dy <= 1) part = r.part; } }
      else if (r.k === 'wave'){ const v = Math.sin(t * r.f + yn * (r.fy ?? 0)) ; if (t >= (r.t0 ?? 0) && t <= (r.t1 ?? 1) && yn >= (r.y0 ?? -2) && yn <= (r.y1 ?? 2) && v > (r.th ?? 0.5)) part = r.part; }
      else if (r.k === 'ellz' && yn > (r.ymin ?? 0)){ const dx = (t - r.t) / r.rt, dz = (Math.abs(z) - r.z) / r.rz; if (dx * dx + dz * dz <= 1) part = r.part; }
      else if (r.k === 'line' && t >= (r.t0 ?? 0) && t <= (r.t1 ?? 1)){ const yy = curve(r.y, t); if (Math.abs(yn - yy) <= r.w) part = r.part; }
    }
    return part;
  };
  // 身體：一圈一圈接起來
  const ts = Array.from({ length: NS + 1 }, (_, i) => Math.pow(i / NS, p.tk ?? 1.12));
  for (let i = 0; i < NS; i++){
    const t0 = ts[i], t1 = ts[i + 1];
    for (let j = 0; j < NR; j++){
      const a0 = j / NR * PI * 2 - PI / 2, a1 = (j + 1) / NR * PI * 2 - PI / 2;
      const A = pt(t0, a0), B = pt(t0, a1), C = pt(t1, a1), D = pt(t1, a0);
      const tm = (t0 + t1) / 2, am = (a0 + a1) / 2, ynm = Math.sin(am), zm = Math.cos(am);
      const part = partAt(tm, Math.sign(ynm) * Math.pow(Math.abs(ynm), 2 / n), zm);
      if (i === 0) M.tri(part === 'Bottom' && !p.tipBelly ? 'Top' : part, A, D, C); else M.quad(part, A, B, C, D);   /* 吻端那一小圈用背的顏色，不然白色肚子在尖端會變成一圈鋸齒、看起來像牙齒 */
    }
  }
  if ((p.ped ?? 0.22) > 0.01){ // 尾柄的切口封起來
    const t = 1, c = [X(t), yc(t), 0]; for (let j = 0; j < NR; j++){ const a0 = j / NR * PI * 2 - PI / 2, a1 = (j + 1) / NR * PI * 2 - PI / 2; M.tri(p.capPart || 'Top', c, pt(t, a0), pt(t, a1)); } }
  const surfY = (t, s) => yc(t) + (s > 0 ? hu(t) : -hl(t));
  // 圓點花紋：貼在身體表面的扁扁小圓片（比三角形上色更圓）
  for (const d of [].concat(p.dots || [])){
    for (let i = 0; i < Math.ceil((d.n || 20) * (p.lod ? 0.5 : 1)); i++){
      const t = lerp(d.t0 ?? 0.1, d.t1 ?? 0.9, hash(i * 1.37 + (d.seed || 0))), yn = lerp(d.y0 ?? -0.2, d.y1 ?? 0.9, hash(i * 2.71 + 5 + (d.seed || 0)));
      const th = Math.asin(clamp(yn, -0.98, 0.98)), r = (d.r ?? 0.03) * (0.7 + 0.6 * hash(i * 9.1 + (d.seed || 0)));
      for (const sd of (d.side ? [d.side] : [1, -1])){
        const P0 = pt(t, sd > 0 ? th : PI - th), dt = 0.01, Pa = pt(clamp(t + dt, 0, 1), sd > 0 ? th : PI - th), Pb = pt(t, (sd > 0 ? th : PI - th) + 0.05);
        const u = [Pa[0] - P0[0], Pa[1] - P0[1], Pa[2] - P0[2]], v = [Pb[0] - P0[0], Pb[1] - P0[1], Pb[2] - P0[2]];
        let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const nl = Math.hypot(...nn) || 1; nn = nn.map(q => q / nl * sd);
        if (nn[1] * (P0[1] - yc(t)) + nn[2] * P0[2] < 0) nn = nn.map(q => -q);
        const ul = Math.hypot(...u) || 1, e1 = u.map(q => q / ul), e2 = [e1[1] * nn[2] - e1[2] * nn[1], e1[2] * nn[0] - e1[0] * nn[2], e1[0] * nn[1] - e1[1] * nn[0]];
        M.ellip(d.part || 'Spots', [P0[0] + nn[0] * r * 0.06, P0[1] + nn[1] * r * 0.06, P0[2] + nn[2] * r * 0.06], [1, 1, 1], 6, 3, w => { const a = w[0] * r * (d.ax ?? 1), b2 = w[2] * r, c = w[1] * r * 0.18; return [e1[0] * a + e2[0] * b2 + nn[0] * c, e1[1] * a + e2[1] * b2 + nn[1] * c, e1[2] * a + e2[2] * b2 + nn[2] * c]; });
      }
    }
  }
  const tOfX = x => clamp((X0 - x) / SL, 0, 1);
  // ---- 鰭 ----
  const finPart = f => f.part || 'Fins';
  const stripFin = (f, dir) => { // 背鰭、臀鰭：沿著身體上緣（dir=1）或下緣（dir=-1）
    const m = f.seg ?? 14, H = f.h * HD * 2, sweep = f.sweep ?? 0.35;
    const hp = a => { const sh = f.shape || 'tri';
      if (sh === 'tri') return a < (f.peak ?? 0.3) ? a / (f.peak ?? 0.3) : 1 - (a - (f.peak ?? 0.3)) / (1 - (f.peak ?? 0.3)) * (1 - (f.back ?? 0.15));
      if (sh === 'round') return Math.sin(a * PI) * 0.9 + 0.1;
      if (sh === 'flat') return a < 0.08 ? a / 0.08 : a > 0.92 ? (1 - a) / 0.08 : 1;
      if (sh === 'sail') return Math.min(1, a / 0.12) * (1 - Math.pow(a, 3) * 0.7);
      if (sh === 'falcate') return Math.pow(Math.sin(Math.min(1, a / 0.55) * PI / 2), 0.7) * (a > 0.55 ? 1 - (a - 0.55) / 0.45 * 0.92 : 1);
      if (sh === 'spiny') return (0.75 + 0.25 * ((Math.round(a * m) % 2) ? -0.6 : 1)) * (a < 0.1 ? a / 0.1 : 1) * (1 - a * (1 - (f.back ?? 0.6)));
      if (sh === 'ramp') return a; if (sh === 'rampd') return 1 - a * (1 - (f.back ?? 0.2));
      return 1; };
    for (let k = 0; k < m; k++){
      const a0 = k / m, a1 = (k + 1) / m, t0 = lerp(f.s, f.e, a0), t1 = lerp(f.s, f.e, a1);
      const g0 = hp(a0) * H, g1 = hp(a1) * H, inset = f.inset ?? 0.3;
      const b0 = [X(t0), surfY(t0, dir) - dir * HD * 0.06 * inset, 0], b1 = [X(t1), surfY(t1, dir) - dir * HD * 0.06 * inset, 0];
      const c0 = [X(t0) - sweep * g0, surfY(t0, dir) + dir * g0, 0], c1 = [X(t1) - sweep * g1, surfY(t1, dir) + dir * g1, 0];
      M.quad2(finPart(f), b0, b1, c1, c0);
    }
  };
  for (const f of [].concat(p.dorsal || [])) stripFin(f, 1);
  for (const f of [].concat(p.anal || [])) stripFin(f, -1);
  // 小離鰭（鮪魚、鰹魚、鯖魚）
  if (p.finlets){ const { n: k, s, e, h = 0.08, part = 'Fins' } = p.finlets; for (let i = 0; i < k; i++){ const t = lerp(s, e, (i + 0.5) / k); for (const dir of [1, -1]){ const y = surfY(t, dir), g = h * HD * 2; M.tri2(part, [X(t) + 0.012, y - dir * 0.004, 0], [X(t) - 0.012, y - dir * 0.004, 0], [X(t) - 0.02, y + dir * g, 0]); } } }
  // 尾鰭
  const cd = p.caudal || {}, ctype = cd.type || 'forked';
  if (ctype !== 'none'){
    const Lc = (cd.len ?? 1) * (xt + X0), H = (cd.h ?? 1) * Math.max(hu(1) + hl(1), HD * 0.9) * (cd.hk ?? 2.1), yb = yc(1), ph = Math.max(hu(1), 0.01), pl = Math.max(hl(1), 0.01), x0 = xt + 0.01;
    let O; // 外框（從尾柄上緣順時針到下緣），座標 (u 往後, v 往上)
    const Uo = cd.up ?? 1, Lo = cd.lo ?? 1;
    if (ctype === 'forked') O = [[0, ph], [Lc * 0.55, H * 0.55 * Uo], [Lc, H * Uo], [Lc * (cd.notch ?? 0.5), 0], [Lc, -H * Lo], [Lc * 0.55, -H * 0.55 * Lo], [0, -pl]];
    else if (ctype === 'lunate') O = [[0, ph], [Lc * 0.35, H * 0.45], [Lc * 0.75, H * 0.85], [Lc, H * 1.12], [Lc * 0.62, H * 0.42], [Lc * (cd.notch ?? 0.38), 0], [Lc * 0.62, -H * 0.42], [Lc, -H * 1.12], [Lc * 0.75, -H * 0.85], [Lc * 0.35, -H * 0.45], [0, -pl]];
    else if (ctype === 'emarginate') O = [[0, ph], [Lc * 0.7, H * 0.8], [Lc, H * 0.9], [Lc * (cd.notch ?? 0.84), 0], [Lc, -H * 0.9], [Lc * 0.7, -H * 0.8], [0, -pl]];
    else if (ctype === 'truncate') O = [[0, ph], [Lc * 0.8, H * 0.78], [Lc, H * 0.8], [Lc * 1.0, 0], [Lc, -H * 0.8], [Lc * 0.8, -H * 0.78], [0, -pl]];
    else if (ctype === 'rounded'){ O = [[0, ph]]; for (let i = 0; i <= 10; i++){ const a = PI / 2 - i / 10 * PI; O.push([Lc * (0.35 + 0.65 * Math.cos(a)), H * 0.72 * Math.sin(a)]); } O.push([0, -pl]); }
    else if (ctype === 'pointed') O = [[0, ph], [Lc * 0.5, H * 0.35], [Lc, 0], [Lc * 0.5, -H * 0.35], [0, -pl]];
    else if (ctype === 'hetero') O = [[0, ph], [Lc * 0.55, H * 0.7], [Lc * 1.05, H * 1.25], [Lc * 0.95, H * 1.0], [Lc * 0.62, H * 0.3], [Lc * 0.48, 0], [Lc * 0.55, -H * 0.5], [Lc * 0.4, -H * 0.55], [0, -pl]];
    else if (ctype === 'flukes') O = [[0, ph], [Lc * 0.3, H * 0.5], [Lc * 0.75, H * 1.05], [Lc * 0.95, H * 1.12], [Lc * 0.78, H * 0.55], [Lc * 0.55, H * 0.06], [Lc * 0.6, 0], [Lc * 0.55, -H * 0.06], [Lc * 0.78, -H * 0.55], [Lc * 0.95, -H * 1.12], [Lc * 0.75, -H * 1.05], [Lc * 0.3, -H * 0.5], [0, -pl]];
    else if (ctype === 'clavus'){ O = [[0, ph * 1.0]]; for (let i = 0; i <= 12; i++){ const a = PI / 2 - i / 12 * PI; O.push([Lc * 0.55 * Math.cos(a) * (0.75 + 0.25 * Math.cos(i * 1.7)), ph * 1.05 * Math.sin(a)]); } O.push([0, -pl * 1.0]); }
    else if (ctype === 'eel') O = [[0, ph], [Lc, 0], [0, -pl]];
    const ctr = [Lc * 0.12, 0];
    const map = ([u, v]) => cd.horiz ? [x0 - u, yb, v] : [x0 - u, yb + v, 0];
    for (let i = 0; i < O.length - 1; i++) M.tri2(cd.part || 'Fins', map(ctr), map(O[i]), map(O[i + 1]));
    if (cd.horiz) M.tri2(cd.part || 'Fins', map(ctr), map(O[O.length - 1]), map(O[0]));
  }
  // 胸鰭、腹鰭：貼在身體兩側的薄片（size 是相對體高）
  const sideFin = (f, isPelv) => {
    const t = f.t ?? (isPelv ? 0.38 : 0.26), yn = f.y ?? (isPelv ? -0.85 : -0.25), L = (f.size ?? 0.5) * HD * 2, W = L * (f.w ?? 0.45);
    const ang = f.ang ?? (isPelv ? -0.5 : -0.35), out = f.out ?? (isPelv ? 0.35 : 0.5), sh = f.shape || 'tri';
    M.mirror(s => {
      const x = X(t), y = yc(t) + (yn > 0 ? hu(t) : hl(t)) * yn, zs = wd(t) * Math.sqrt(Math.max(0, 1 - yn * yn)) * s * 0.95;
      const dir = [-Math.cos(ang), Math.sin(ang)], o = out * s;
      const P = f.horiz ? (u, v) => [x + dir[0] * u + v, y + dir[1] * u, zs + o * u] : (u, v) => [x + dir[0] * u - (f.dz ?? 0) , y + dir[1] * u + v, zs + o * u + (f.vz ?? 0) * v * s];
      let pts;
      if (sh === 'tri') pts = [P(0, W * 0.5), P(L, 0), P(L * 0.75, -W * 0.35), P(0, -W * 0.5)];
      else if (sh === 'round'){ pts = [P(0, W * 0.5)]; for (let i = 0; i <= 8; i++){ const a = PI / 2 - i / 8 * PI; pts.push(P(L * 0.5 + L * 0.5 * Math.cos(a), W * 0.6 * Math.sin(a))); } pts.push(P(0, -W * 0.5)); }
      else if (sh === 'wing') pts = [P(0, W * 0.3), P(L * 0.55, W * 0.95), P(L, W * 0.55), P(L * 0.9, -W * 0.2), P(L * 0.4, -W * 0.45), P(0, -W * 0.3)];
      else if (sh === 'flipper') pts = [P(0, W * 0.45), P(L * 0.6, W * 0.3), P(L, -W * 0.15), P(L * 0.55, -W * 0.5), P(0, -W * 0.45)];
      else if (sh === 'long') pts = [P(0, W * 0.25), P(L, -W * 0.05), P(L * 0.9, -W * 0.25), P(0, -W * 0.25)];
      else if (sh === 'fan'){ pts = [P(0, W * 0.3)]; for (let i = 0; i <= 9; i++){ const a = 0.9 - i / 9 * 1.8, r = L * (i % 2 ? 0.8 : 1); pts.push(P(r * Math.cos(a), r * Math.sin(a) * 0.9)); } pts.push(P(0, -W * 0.3)); }
      const c = pts[0], part = f.part || 'Fins';
      for (let i = 1; i < pts.length - 1; i++) M.tri2(part, c, pts[i], pts[i + 1]);
    });
  };
  for (const f of [].concat(p.pect || [])) sideFin(f, false);
  for (const f of [].concat(p.pelv || [])) sideFin(f, true);
  // 眼睛
  const ey = p.eye || {}; if (ey !== false && !ey.none){
    const t = ey.t ?? 0.1, yn = ey.y ?? 0.3, r = (ey.r ?? 0.09) * HD * 2 * (ey.abs ? 0 : 1) + (ey.abs || 0);
    M.mirror(s => {
      const y = yc(t) + (yn > 0 ? hu(t) : hl(t)) * yn, z = wd(t) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(yn), n))) * s;
      if (ey.ring) M.ellip(ey.ringPart || 'EyeW', [X(t), y, z - s * r * 0.15], [r * 1.45, r * 1.45, r * 0.45], 8, 4);
      M.ellip('Eye', [X(t), y, z + s * r * (ey.pop ?? 0.15)], [r, r, r * 0.7], 8, 5);
      if (ey.hi) M.ellip('EyeW', [X(t) + r * 0.25, y + r * 0.35, z + s * r * 0.62], [r * 0.3, r * 0.3, r * 0.18], 6, 4);
    });
  }
  // 嘴巴（2026-11-04）：p.mouth = { type:'term'（吻端）|'sub'（頭下面，像鯊魚）|'sup'（往上翹，像龍魚）, t:嘴角往後到哪裡, y:嘴在吻端的高度, open:張嘴的大小, lip:嘴唇的顏色 }
  const mo = p.mouth === false ? null : Object.assign({ type:'term', t:0.055, y:-0.1, open:0, th:1 }, p.mouth || {});
  if (mo){
    const S = (t, yn, s, out) => { const y = yc(t) + (yn > 0 ? hu(t) : hl(t)) * yn, z = wd(t) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(yn)), n))) * s; const k = out ?? 1.06; return [X(t) + (t < 0.02 ? HD * 0.02 : 0), yc(t) + (y - yc(t)) * k, z * k]; };
    const r0 = HD * 0.035 * mo.th, part = mo.part || 'Mouth';
    M.mirror(s => { const pts = [];
      if (mo.type === 'sub'){ const t0 = mo.t0 ?? 0.04; for (let k = 0; k <= 6; k++){ const u = k / 6; pts.push(S(t0 + (mo.t - t0) * Math.pow(u, 1.4), -0.97 + u * (0.97 + (mo.y ?? -0.55)), s)); } }
      else { const yE = mo.type === 'sup' ? mo.y - 0.25 : mo.y - 0.12; for (let k = 0; k <= 6; k++){ const u = k / 6; pts.push(S(0.003 + mo.t * u, mo.y + (yE - mo.y) * u, s)); } }
      M.limb(part, pts, r0, r0 * 0.6, 5);
      if (mo.lip) M.limb(mo.lip, pts.map(q => [q[0] + HD * 0.01, q[1] + HD * 0.03, q[2] * 1.02]), r0 * 0.7, r0 * 0.4, 5);
    });
    if (mo.open){ const y = yc(0.02) + hl(0.02) * mo.y; M.ellip(part, [X(0) + HD * 0.015, y, 0], [HD * 0.04, HD * 0.1 * mo.open, wd(0.04) * 0.75 + HD * 0.04 * mo.open], 10, 6); }
  }
  // 其他零件：{k:'cone'|'tube'|'ellip'|'limb', ...}，座標可以用 t（沿身體）和 yn（上下）表示
  const P3 = q => Array.isArray(q) ? q : [q.x ?? X(q.t), q.y ?? (yc(q.t) + (q.yn > 0 ? hu(q.t) : hl(q.t)) * (q.yn ?? 0)) + (q.dy || 0), (q.z ?? 0)];
  for (const e of p.extra || []){
    const sym = e.sym ? [1, -1] : [1];
    for (const s of sym){ const F = q => { const v = P3(q); return [v[0], v[1], v[2] * s]; };
      if (e.k === 'cone') M.cone(e.part || 'Fins', F(e.a), F(e.b), e.r, e.n || 6);
      else if (e.k === 'tube') M.tube(e.part || 'Fins', F(e.a), F(e.b), e.r0 ?? e.r, e.r1 ?? e.r, e.n || 6);
      else if (e.k === 'limb') M.limb(e.part || 'Fins', e.pts.map(F), e.r0, e.r1 ?? e.r0, e.n || 5);
      else if (e.k === 'ellip'){ const c = F(e.c); M.ellip(e.part || 'Top', c, e.r, e.seg || 12, e.rings || 8); }
      else if (e.k === 'plate'){ const pts = e.pts.map(F); for (let i = 1; i < pts.length - 1; i++) M.tri2(e.part || 'Fins', pts[0], pts[i], pts[i + 1]); }
    }
  }
  if (p.flat){ for (const k in M.parts){ const A = M.parts[k]; for (let i = 0; i < A.length; i += 9){ for (let j = 0; j < 9; j += 3){ const y = A[i + j + 1], z = A[i + j + 2]; A[i + j + 1] = z * 0.9; A[i + j + 2] = -y; } } } }   // 比目魚：側躺
  return M.out();
}

/* ======================= 頭足類：魷魚、小卷、墨魚（頭朝 +x，觸手往前） ======================= */
export function genSquid(p){
  const M = new Mesh(), L = TL * (p.mantle ?? 0.55), xa = X0 - TL * (p.armLen ?? 0.3) - 0.1, xb = xa - L, R = p.R ?? 0.1, my = p.my ?? 1, mz = p.mz ?? 1, NS = 26, NR = 20;
  const rad = t => R * (t < 0.12 ? 0.85 + t / 0.12 * 0.15 : Math.pow(Math.cos((t - 0.12) / 0.88 * PI / 2), p.taper ?? 0.8)) + 0.004;
  const P = (t, a) => [xa - t * L, Math.sin(a) * rad(t) * my, Math.cos(a) * rad(t) * mz];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++){ const t0 = i / NS, t1 = (i + 1) / NS, a0 = j / NR * PI * 2, a1 = (j + 1) / NR * PI * 2; const part = Math.sin((a0 + a1) / 2) > (p.cs ?? -0.2) ? 'Top' : 'Bottom'; M.quad(part, P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0)); }
  if (p.bands) for (let i = 0; i < p.bands; i++){ const t = 0.1 + i / p.bands * 0.8; for (let j = 0; j < 8; j++){ const a = PI * 0.15 + j / 8 * PI * 0.7; const q = P(t, a); M.ellip('Stripes', [q[0], q[1] * 1.01, q[2] * 1.01], [L * 0.012, R * 0.05, R * 0.18], 6, 3); } }
  if (p.spots) for (let i = 0; i < p.spots; i++){ const t = 0.05 + hash(i * 3.3) * 0.85, a = PI * (0.1 + hash(i * 7.1) * 0.8), q = P(t, a), r = R * 0.07 * (0.6 + hash(i)); M.ellip('Spots', [q[0], q[1] + r * 0.2, q[2]], [r, r * 0.4, r], 6, 3); }
  // 鰭：菱形（魷魚）或整圈的裙邊（墨魚）
  if (p.fin === 'fringe') M.mirror(s => { for (let i = 0; i < 16; i++){ const t0 = 0.04 + i / 16 * 0.92, t1 = 0.04 + (i + 1) / 16 * 0.92, w = R * (p.finW ?? 0.35); const a = P(t0, 0), b = P(t1, 0); M.quad2('Fins', [a[0], 0, a[2] * s], [b[0], 0, b[2] * s], [b[0], 0, (b[2] + w) * s], [a[0], 0, (a[2] + w) * s]); } });
  else M.mirror(s => { const f0 = p.finS ?? 0.5, w = R * (p.finW ?? 1.4); const a = P(f0, 0), m = P(0.78, 0), b = P(1, 0); M.plateish = 1; M.tri2('Fins', [a[0], 0, a[2] * s], [m[0], 0, (m[2] + w) * s], [b[0] - 0.01, 0, 0]); M.tri2('Fins', [a[0], 0, a[2] * s], [b[0] - 0.01, 0, 0], [m[0], 0, m[2] * s]); });
  // 頭和眼睛
  const hx = xa + 0.04, hr = R * (p.head ?? 0.75); M.ellip('Top', [hx, 0, 0], [0.06, hr * my, hr * mz], 12, 7);
  M.mirror(s => { M.ellip('EyeW', [hx, hr * 0.25 * my, hr * mz * 0.85 * s], [0.035 * (p.eye ?? 1), 0.035 * (p.eye ?? 1), 0.02], 10, 6); M.ellip('Eye', [hx + 0.004, hr * 0.25 * my, hr * mz * 0.95 * s], [0.02 * (p.eye ?? 1), 0.02 * (p.eye ?? 1), 0.012], 8, 5); });
  // 8 隻腕 + 2 條長觸手（前端有觸手冠）
  const ax = hx + 0.05, al = TL * (p.armLen ?? 0.3);
  for (let i = 0; i < 8; i++){ const a = i / 8 * PI * 2 + 0.2, cy = Math.sin(a) * hr * 0.6, cz = Math.cos(a) * hr * 0.6, spread = p.spread ?? 0.35;
    const pts = []; for (let k = 0; k <= 5; k++){ const u = k / 5; pts.push([ax + al * u, cy * (1 + spread * u * 3) + Math.sin(u * 3 + i) * 0.015, cz * (1 + spread * u * 3)]); } M.limb(p.armPart || 'Arms', pts, R * 0.13, R * 0.03, 5); }
  if (p.tent !== false) M.mirror(s => { const tl = TL * (p.tentLen ?? 0.45), pts = []; for (let k = 0; k <= 7; k++){ const u = k / 7; pts.push([ax + tl * u, -hr * 0.1 + Math.sin(u * 4) * 0.02, s * (hr * 0.25 + u * 0.04)]); } M.limb(p.armPart || 'Arms', pts, R * 0.06, R * 0.04, 4); const e = pts[pts.length - 1]; M.ellip(p.armPart || 'Arms', [e[0] + 0.03, e[1], e[2]], [0.05, R * 0.1, R * 0.12], 8, 4); });
  if (p.glow) for (let i = 0; i < 6; i++){ const q = P(0.15 + i * 0.12, -PI / 2); M.ellip('Glow', [q[0], q[1] - 0.005, q[2]], [0.015, 0.008, 0.015], 6, 3); }
  return M.out();
}

/* ======================= 章魚：頭（外套膜）在後上方，8 隻腳往四周捲 ======================= */
export function genOcto(p){
  const M = new Mesh(), R = p.R ?? 0.22;
  M.ellip('Top', [-0.18, 0.2, 0], [R * 1.25, R * 0.95, R * 0.95], 16, 10, v => [v[0] * Math.cos(0.5) - v[1] * Math.sin(0.5), v[0] * Math.sin(0.5) + v[1] * Math.cos(0.5), v[2]]);
  M.ellip('Top', [0.06, 0.02, 0], [R * 0.75, R * 0.6, R * 0.8], 14, 8);
  if (p.spots) for (let i = 0; i < p.spots; i++){ const u = hash(i * 2.1) * PI * 2, v = Math.acos(1 - hash(i * 5.7) * 1.2); M.ellip('Spots', [-0.18 + Math.sin(v) * Math.cos(u) * R * 1.2, 0.2 + Math.cos(v) * R * 0.92, Math.sin(v) * Math.sin(u) * R * 0.92], [0.02, 0.02, 0.02], 6, 3); }
  M.mirror(s => { M.ellip('EyeW', [0.1, 0.12, R * 0.62 * s], [0.045, 0.04, 0.03], 10, 6); M.ellip('Eye', [0.12, 0.12, R * 0.7 * s], [0.024, 0.012, 0.016], 8, 5); });
  const al = p.armLen ?? 0.75;
  for (let i = 0; i < 8; i++){
    const a = (i + 0.5) / 8 * PI * 2, dx = Math.cos(a), dz = Math.sin(a), pts = [];
    for (let k = 0; k <= 10; k++){ const u = k / 10, r = 0.1 + al * u, curl = Math.max(0, u - 0.6) * 2.5; const ca = a + curl * 0.9 * (i % 2 ? 1 : -1); pts.push([0.08 + Math.cos(ca) * r * (1 - curl * 0.25), -0.08 - u * 0.05 + curl * 0.06 + Math.sin(u * 6 + i) * 0.015, Math.sin(ca) * r * (1 - curl * 0.25)]); }
    M.limb('Arms', pts, 0.055, 0.008, 6);
    for (let k = 1; k < 9; k += 1){ const q = pts[k], q2 = pts[k + 1]; M.ellip('Bottom', [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2 - 0.045 * (1 - k / 10), (q[2] + q2[2]) / 2], [0.016 * (1 - k / 11), 0.008, 0.016 * (1 - k / 11)], 6, 3); }
  }
  return M.out();
}

/* ======================= 水母：鐘形傘朝 +x，觸手往後拖 ======================= */
export function genJelly(p){
  const M = new Mesh(), R = p.R ?? 0.38, H = p.H ?? 0.24, NS = 10, NR = 24, xb = 0.5;
  const P = (t, a) => { const r = R * Math.sin(t * PI / 2) * (1 + (t > 0.92 ? Math.sin(a * 16) * 0.03 : 0)), h = H * Math.cos(t * PI / 2); return [xb - H + h, Math.sin(a) * r, Math.cos(a) * r]; };
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++){ const t0 = i / NS, t1 = (i + 1) / NS, a0 = j / NR * PI * 2, a1 = (j + 1) / NR * PI * 2; M.quad(i >= NS - 1 ? 'Ring' : 'Top', P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0)); M.quad('Bottom', P(t0, a0), P(t1, a0), P(t1, a1), P(t0, a1)); }
  // 四片馬蹄形生殖腺（從傘頂看得到）
  for (let g = 0; g < 4; g++){ const a = g / 4 * PI * 2 + PI / 4; for (let k = 0; k < 7; k++){ const b = a - 0.6 + k / 6 * 1.2, rr = R * 0.36; M.ellip('Spots', [xb - H * 0.25 + 0.005, Math.sin(b) * rr, Math.cos(b) * rr], [0.03, 0.03, 0.03], 6, 4); } }
  // 傘緣的細觸手
  for (let j = 0; j < 32; j++){ const a = j / 32 * PI * 2, q = P(1, a), pts = [q]; for (let k = 1; k <= 4; k++) pts.push([q[0] - k * 0.07, q[1] * (1 - k * 0.02) + Math.sin(k + j) * 0.01, q[2] * (1 - k * 0.02)]); M.limb('Fins', pts, 0.006, 0.002, 3); }
  // 4 條口腕
  for (let g = 0; g < 4; g++){ const a = g / 4 * PI * 2, pts = []; for (let k = 0; k <= 8; k++){ const u = k / 8; pts.push([xb - H * 0.9 - u * 0.75, Math.sin(a) * (0.04 + u * 0.06) + Math.sin(u * 8 + g) * 0.04, Math.cos(a) * (0.04 + u * 0.06) + Math.cos(u * 8 + g) * 0.04]); } M.limb('Fins', pts, 0.035, 0.01, 5); }
  return M.out();
}

/* ======================= 海龜：頭朝 +x ======================= */
export function genTurtle(p){
  const M = new Mesh(), cl = p.cl ?? 0.5, cw = p.cw ?? 0.4, ch = p.ch ?? 0.16;
  M.ellip('Top', [0, 0.04, 0], [cl, ch, cw], 18, 9, v => [v[0], v[1] > 0 ? v[1] : v[1] * 0.25, v[2]]);
  M.ellip('Bottom', [0, 0.0, 0], [cl * 0.92, ch * 0.35, cw * 0.88], 14, 6);
  // 背甲的鱗片（中央 5 片、兩側各 4 片）
  const sc = (x, z, r) => { const y = 0.04 + ch * Math.sqrt(Math.max(0, 1 - (x / cl) ** 2 - (z / cw) ** 2)); M.ellip('Spots', [x, y - 0.006, z], [r, 0.012, r * 0.85], 7, 3); };
  for (let i = 0; i < 5; i++) sc(cl * (0.62 - i * 0.31), 0, cl * 0.13);
  for (let i = 0; i < 4; i++) M.mirror(s => sc(cl * (0.5 - i * 0.32), cw * 0.48 * s, cl * 0.13));
  // 頭
  M.ellip('Skin', [cl + 0.1, 0.03, 0], [0.12, 0.08, 0.085], 12, 7); M.mirror(s => M.ellip('Eye', [cl + 0.15, 0.06, 0.06 * s], [0.018, 0.018, 0.012], 6, 4));
  // 前鰭（長）和後鰭（短）
  M.mirror(s => { M.quad2('Skin', [cl * 0.55, 0.0, cw * 0.7 * s], [cl * 0.25, -0.01, cw * 0.85 * s], [-cl * 0.2, -0.03, (cw + 0.42) * s], [cl * 0.2, -0.02, (cw + 0.32) * s]);
    M.quad2('Skin', [-cl * 0.6, 0.0, cw * 0.55 * s], [-cl * 0.85, -0.01, cw * 0.45 * s], [-cl * 1.05, -0.02, (cw * 0.75) * s], [-cl * 0.8, -0.01, (cw * 0.85) * s]); });
  M.cone('Skin', [-cl * 0.9, 0.0, 0], [-cl - 0.1, -0.01, 0], 0.03, 5);
  return M.out();
}

/* ======================= 海馬：直立，頭朝 +x，尾巴捲在下面 ======================= */
export function genSeahorse(){
  const M = new Mesh();
  // 身體的骨環：沿著一條 S 形曲線，越往下越細，最後捲起來
  const spine = []; for (let i = 0; i <= 30; i++){ const u = i / 30; let x, y;
    if (u < 0.55){ const a = u / 0.55; x = -0.05 + Math.sin(a * PI) * 0.12 - a * 0.05; y = 0.45 - a * 0.75; }
    else { const a = (u - 0.55) / 0.45, ang = a * PI * 1.6; x = -0.1 + Math.sin(ang) * 0.14 * (1 - a * 0.4); y = -0.3 - (1 - Math.cos(ang)) * 0.12 * (1 - a * 0.4); }
    spine.push([x, y, 0, u]); }
  for (let i = 0; i < spine.length - 1; i++){ const [x0, y0, , u] = spine[i], [x1, y1] = spine[i + 1]; const r = u < 0.15 ? 0.09 + u * 0.4 : Math.max(0.012, 0.15 * Math.pow(1 - (u - 0.15) / 0.85, 1.2)); M.tube(i % 2 ? 'Top' : 'Stripes', [x0, y0, 0], [x1, y1, 0], r, r * 0.95, 8); if (u > 0.05 && u < 0.5 && i % 2) M.mirror(s => M.cone('Stripes', [x0, y0, r * 0.8 * s], [x0, y0, r * 1.15 * s], 0.012, 4)); }
  M.ellip('Bottom', [0.04, 0.12, 0], [0.11, 0.17, 0.1], 10, 7);   // 肚子
  // 頭：往前低頭，長長的管狀嘴
  M.ellip('Top', [0.0, 0.56, 0], [0.1, 0.09, 0.075], 10, 7); M.tube('Top', [0.06, 0.53, 0], [0.26, 0.47, 0], 0.035, 0.025, 6); M.ellip('Top', [0.27, 0.47, 0], [0.015, 0.03, 0.03], 6, 4);
  M.cone('Stripes', [-0.03, 0.62, 0], [-0.05, 0.72, 0], 0.04, 5);   // 頭冠
  M.mirror(s => { M.ellip('EyeW', [0.04, 0.58, 0.065 * s], [0.03, 0.03, 0.015], 8, 5); M.ellip('Eye', [0.045, 0.58, 0.075 * s], [0.016, 0.016, 0.01], 6, 4); });
  // 背鰭
  M.quad2('Fins', [-0.12, 0.2, 0], [-0.1, 0.02, 0], [-0.2, 0.0, 0], [-0.22, 0.18, 0]);
  return M.out();
}

/* ======================= 蝦、龍蝦、螯蝦 ======================= */
export function genShrimp(p){
  const M = new Mesh(), L = TL * (p.len ?? 0.62), x0 = X0 * (p.x0 ?? 0.55), cw = p.cw ?? 0.11, ch = p.ch ?? 0.12;
  const curl = p.curl ?? 0.25, nseg = 6;
  // 頭胸甲
  const cl = L * (p.cara ?? 0.38);
  M.ellip(p.caraPart || 'Top', [x0 - cl * 0.5, 0.02, 0], [cl * 0.55, ch, cw], 14, 9);
  if (p.ridge) for (let i = 0; i < 5; i++) M.cone('Top', [x0 - cl * (0.2 + i * 0.13), ch * 0.95, 0], [x0 - cl * (0.22 + i * 0.13), ch * 1.25, 0], 0.012, 4);
  // 額角（尖刺）
  if (p.rostrum !== 0) M.cone('Top', [x0 - cl * 0.05, 0.05, 0], [x0 + L * (p.rostrum ?? 0.18), 0.08 + (p.rostUp ?? 0.03), 0], 0.018, 5);
  // 腹部 6 節，往後越來越細、往下彎
  let px = x0 - cl * 0.95, py = 0.02, ang = 0, r = cw * 0.95, rh = ch * 0.9; const segL = L * (1 - (p.cara ?? 0.38)) * 0.78 / nseg;
  const bands = p.bands || [];
  for (let i = 0; i < nseg; i++){
    ang += curl / nseg * (i > 1 ? 1.4 : 0.6); const nx = px - Math.cos(ang) * segL, ny = py - Math.sin(ang) * segL, nr = r * (0.93 - i * 0.02), nrh = rh * (0.92 - i * 0.02);
    M.ellip(bands.includes(i) ? 'Stripes' : (i % 2 ? 'Top' : 'Top'), [(px + nx) / 2, (py + ny) / 2 + nrh * 0.05, 0], [segL * 0.62, nrh, nr], 10, 7, v => { const c = Math.cos(-ang), s = Math.sin(-ang); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; });
    if (p.belly !== false) M.ellip('Bottom', [(px + nx) / 2, (py + ny) / 2 - nrh * 0.45, 0], [segL * 0.5, nrh * 0.5, nr * 0.85], 8, 5);
    // 泳足
    if (p.swim !== false) M.mirror(s => M.limb('Fins', [[(px + nx) / 2, (py + ny) / 2 - nrh * 0.6, nr * 0.5 * s], [(px + nx) / 2 + 0.01, (py + ny) / 2 - nrh * 1.6, nr * 0.8 * s]], 0.008, 0.004, 4));
    px = nx; py = ny; r = nr; rh = nrh;
  }
  // 尾扇（尾節 + 尾肢）
  const tc = Math.cos(ang), ts = Math.sin(ang), tl = L * (p.fan ?? 0.17);
  const TP = (u, z) => [px - tc * u, py - ts * u, z];
  M.mirror(s => { M.quad2('Fins', TP(0, 0), TP(tl, s * 0.004), TP(tl * 0.95, s * tl * 0.55), TP(tl * 0.2, s * r * 0.9)); });
  M.quad2('Fins', TP(0, -r * 0.4), TP(tl * 1.05, -0.03), TP(tl * 1.05, 0.03), TP(0, r * 0.4));
  // 眼睛（眼柄）
  M.mirror(s => { M.tube('Top', [x0 - cl * 0.08, 0.06, cw * 0.4 * s], [x0 + 0.015, 0.075, cw * 0.95 * s], 0.012, 0.012, 4); M.ellip('Eye', [x0 + 0.02, 0.078, cw * 1.05 * s], [0.022, 0.022, 0.022], 8, 5); });
  // 觸角：兩對，長觸角往後彎
  const an = p.ant ?? 1.1;
  M.mirror(s => {
    const b = [x0, 0.03, cw * 0.35 * s], pts = [b]; for (let i = 1; i <= 8; i++){ const k = i / 8; pts.push([b[0] + L * 0.25 * k - L * an * k * k * 0.9, b[1] + 0.12 * Math.sin(k * 2.2), b[2] + s * L * 0.28 * k]); } M.limb(p.antPart || 'Fins', pts, p.antR ?? 0.007, (p.antR ?? 0.007) * 0.3, p.antR ? 6 : 4);
    const b2 = [x0 + 0.01, 0.0, cw * 0.2 * s]; M.limb('Fins', [b2, [b2[0] + L * 0.2, 0.06, s * 0.05], [b2[0] + L * 0.32, 0.1, s * 0.1]], 0.006, 0.002, 4);
    if (p.scale !== false) M.quad2('Fins', [x0 - 0.01, 0.0, cw * 0.6 * s], [x0 + L * 0.12, 0.01, cw * 0.9 * s], [x0 + L * 0.1, 0.0, cw * 1.25 * s], [x0 - 0.02, -0.01, cw * 1.0 * s]);
  });
  // 步足 5 對（第 2 對可以是很長的大螯，或第 1 對是大鉗子）
  const legs = p.legs ?? 5;
  for (let i = 0; i < legs; i++){
    const lx = x0 - cl * (0.25 + i * 0.13);
    M.mirror(s => {
      const big = p.claw && p.claw.leg === i;
      if (big){
        const c = p.claw, ln = L * c.len, part = c.part || 'Claw';
        const b = [lx, -ch * 0.6, cw * 0.7 * s], k1 = [lx + ln * 0.25, -ch * 0.9, cw * 2.2 * s + s * ln * 0.12], k2 = [lx + ln * 0.62, -ch * 0.5, cw * 2.0 * s + s * ln * 0.25], k3 = [lx + ln * 0.92, -ch * 0.3, cw * 1.5 * s + s * ln * 0.25];
        M.limb(part, [b, k1, k2], c.r * 0.7, c.r * 0.9, 5);
        // 鉗子：掌節 + 兩根指
        M.ellip(part, [(k2[0] + k3[0]) / 2, (k2[1] + k3[1]) / 2, (k2[2] + k3[2]) / 2], [Math.hypot(k3[0] - k2[0], k3[2] - k2[2]) * 0.55, c.r * (c.palm ?? 1.6), c.r * (c.palm ?? 1.6) * 0.8], 10, 6, v => { const a = Math.atan2(k3[2] - k2[2], k3[0] - k2[0]); return [v[0] * Math.cos(a) - v[2] * Math.sin(a), v[1], v[0] * Math.sin(a) + v[2] * Math.cos(a)]; });
        const fl = ln * (c.finger ?? 0.22); M.cone(part, [k3[0], k3[1] + c.r * 0.5, k3[2]], [k3[0] + fl, k3[1] + c.r * 0.9, k3[2] - s * fl * 0.15], c.r * 0.7, 5); M.cone(part, [k3[0], k3[1] - c.r * 0.5, k3[2]], [k3[0] + fl * 0.9, k3[1] - c.r * 0.6, k3[2] - s * fl * 0.1], c.r * 0.6, 5);
        return;
      }
      const ll = L * (p.legLen ?? 0.3) * (i === 0 && p.smallFirst ? 0.8 : 1), b = [lx, -ch * 0.55, cw * 0.6 * s];
      M.limb('Fins', [b, [lx + 0.01, -ch * 0.75, cw * 0.6 * s + s * ll * 0.45], [lx + 0.02 - i * 0.01, -ch * 0.75 - ll * 0.6, cw * 0.6 * s + s * ll * 0.6]], 0.009, 0.005, 4);
    });
  }
  return M.out();
}

/* ======================= 螃蟹、帝王蟹 ======================= */
export function genCrab(p){
  const M = new Mesh(), cr = p.cr ?? 0.36, cd = p.cd ?? 0.3, chh = p.ch ?? 0.15;
  // 甲殼：上面的殼 + 比較淡的腹面
  M.ellip('Top', [0, 0.04, 0], [cd, chh, cr], 18, 10, p.shell ? p.shell : undefined);
  M.ellip('Bottom', [0, -0.03, 0], [cd * 0.92, chh * 0.55, cr * 0.9], 14, 6);
  if (p.spikes){ const { n = 40, h = 0.05, r = 0.016, part = 'Spots', seed = 1 } = p.spikes; for (let i = 0; i < n; i++){ const u = hash(i * 3.1 + seed) * PI * 2, v = Math.acos(1 - hash(i * 7.7 + seed) * 0.9); const nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u); const b = [nx * cd, 0.04 + ny * chh, nz * cr]; M.cone(part, b, [b[0] + nx * h, b[1] + ny * h * 1.2, b[2] + nz * h], r, 4); } }
  if (p.spots){ for (let i = 0; i < p.spots; i++){ const u = hash(i * 5.3 + 2) * PI * 2, v = Math.acos(1 - hash(i * 2.9 + 4) * 0.7); M.ellip('Spots', [Math.sin(v) * Math.cos(u) * cd * 0.98, 0.04 + Math.cos(v) * chh * 0.98, Math.sin(v) * Math.sin(u) * cr * 0.98], [0.03, 0.012, 0.03], 6, 4); } }
  // 眼睛
  M.mirror(s => { M.tube('Top', [cd * 0.8, 0.08, cr * 0.25 * s], [cd * 1.02, 0.16 + (p.eyeH ?? 0), cr * 0.3 * s], 0.014, 0.012, 4); M.ellip('Eye', [cd * 1.04, 0.17 + (p.eyeH ?? 0), cr * 0.3 * s], [0.03, 0.03, 0.03], 8, 5); });
  // 腳：每隻腳三節，往外、往上、再往下
  const pairs = p.pairs ?? 4, span = p.span ?? 0.55, lr = p.legR ?? 0.028;
  for (let i = 0; i < pairs; i++){
    const a = lerp(0.35, -0.95, pairs === 1 ? 0 : i / (pairs - 1)) + (p.legBias ?? 0);
    M.mirror(s => {
      const bx = Math.cos(a) * cd * 0.85, bz = Math.sin(PI / 2) * cr * 0.85 * s, dirx = Math.cos(a) * 0.9, dirz = s;
      const L1 = span * 0.45, L2 = span * 0.6, L3 = span * 0.5;
      const k0 = [bx, -0.01, bz], k1 = [bx + dirx * L1 * 0.5, 0.05 + span * 0.1, bz + dirz * L1], k2 = [k1[0] + dirx * L2 * 0.35, k1[1] - span * 0.02, k1[2] + dirz * L2 * 0.8], k3 = [k2[0] + dirx * L3 * 0.25, -0.12 - span * 0.06, k2[2] + dirz * L3 * 0.6];
      M.limb('Fins', [k0, k1, k2], lr, lr * 0.85, 6); M.cone('Fins', k2, k3, lr * 0.85, 5);
      if (p.legSpikes) for (const [q0, q1] of [[k0, k1], [k1, k2]]) for (let j = 1; j <= 4; j++){ const m = j / 5, q = [lerp(q0[0], q1[0], m), lerp(q0[1], q1[1], m), lerp(q0[2], q1[2], m)]; M.cone('Spots', q, [q[0] + 0.012, q[1] + lr * 1.8, q[2]], lr * 0.4, 4); }
    });
  }
  // 大螯
  const cl = p.claw || {}; M.mirror(s => {
    const big = (cl.right ?? 1) > 1 && s > 0 ? cl.right : 1, k = (cl.size ?? 1) * big;
    const b = [cd * 0.75, -0.01, cr * 0.6 * s], k1 = [cd * 1.0 + 0.06 * k, 0.03, cr * 0.95 * s + 0.08 * k * s], k2 = [cd * 1.2 + 0.18 * k, 0.04, cr * 0.75 * s];
    M.limb(cl.part || 'Claw', [b, k1, k2], lr * 1.2 * k, lr * 1.5 * k, 6);
    M.ellip(cl.part || 'Claw', [k2[0] + 0.05 * k, k2[1], k2[2] - 0.03 * s * k], [0.09 * k, 0.05 * k, 0.045 * k], 10, 6, v => { const a = -0.6 * s; return [v[0] * Math.cos(a) - v[2] * Math.sin(a), v[1], v[0] * Math.sin(a) + v[2] * Math.cos(a)]; });
    const tip = [k2[0] + 0.12 * k, k2[1], k2[2] - 0.13 * s * k]; M.cone(cl.part || 'Claw', [k2[0] + 0.1 * k, k2[1] + 0.02 * k, k2[2] - 0.06 * s * k], [tip[0] + 0.04 * k, tip[1] + 0.02 * k, tip[2] - 0.02 * s * k], 0.025 * k, 5); M.cone(cl.part || 'Claw', [k2[0] + 0.1 * k, k2[1] - 0.02 * k, k2[2] - 0.06 * s * k], [tip[0] + 0.02 * k, tip[1] - 0.025 * k, tip[2]], 0.02 * k, 5);
    if (cl.tip) M.cone(cl.tip, tip, [tip[0] + 0.05 * k, tip[1], tip[2] - 0.02 * s * k], 0.012 * k, 4);
  });
  return M.out();
}
