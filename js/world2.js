// 潮汐釣魚村・新主島（預覽）——照作者 2026-11-27 定的「第十五版總規劃圖」蓋。
// 現在還在施工：放在離村子很遠的海上，只有網址帶 #map2 才會載入這個檔，一般玩家不會下載、不會看到。
// 座標：規劃圖 1 像素 = 0.2 公尺；圖上主城廣場的中心 (965,505) 是島的原點。x 往東、z 往南（跟村子一樣，北邊是 -z）。
// 做法：把規劃圖上的形狀（海岸、森林、河、沙灘、路）畫進小畫布 → 算出「離邊界幾公尺」→ 地形高度、顏色、水面遮罩都從這裡來，
// 所以海岸線跟作者看過的圖是同一條。地形切成一塊一塊，走近才蓋、走遠就收（分區載入）。
export function init(A){
  const { THREE, scene, camera, me, colliders, mat, Quality, DayNight, waterSurface, mergeGeometries } = A;
  const OX = 0, OZ = 1500;                                   // 島的原點放在世界的哪裡（離村子夠遠，互相看不到）
  const S = 0.2, PX0 = 965, PY0 = 505;                       // 規劃圖 → 公尺
  const X0 = -196, Z0 = -112, GW = 384, GH = 216, RES = 2, NX = GW * RES, NZ = GH * RES, NN = NX * NZ;   // 資料格：0.5 公尺一格
  const WL = waterSurface.position.y, PAVE_Y = 0.34, TILE = 48, COL0 = colliders.length;
  const low = Quality.tier === 'low', STEP = low ? 3 : 1.5; let VIEW = low ? 90 : Quality.tier === 'mid' ? 110 : 140;   // 地形一格幾公尺、多遠以內的地才蓋
  let sd = 11; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const P = (x, y) => [(x - PX0) * S, (y - PY0) * S];        // 規劃圖的點 → 島上的公尺
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), s01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, lerp = (a, b, k) => a + (b - a) * k;
  const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  /* ---------- 規劃圖的畫法（跟畫圖那支程式一樣，海岸線才會一樣） ---------- */
  function rough(pts, it, k, seed){ sd = seed || 7; let p = pts; for (let n = 0; n < it; n++){ const q = []; for (let i = 0; i < p.length; i++){ const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), d = (R() - 0.5) * l * k; q.push(a, [(a[0] + b[0]) / 2 - dy / l * d, (a[1] + b[1]) / 2 + dx / l * d]); } p = q; } return p; }
  const grow = (pts, d) => { const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; return pts.map(p => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1; return [p[0] + vx / l * d, p[1] + vy / l * d]; }); };
  function closed(g, pts){ g.beginPath(); const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const s = m(pts[n - 1], pts[0]); g.moveTo(s[0], s[1]); for (let i = 0; i < n; i++){ const p = pts[i], q = m(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); } g.closePath(); }
  function open(g, pts){ g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++){ const q = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } const L = pts[pts.length - 1]; g.lineTo(L[0], L[1]); }
  /* 把彎彎的線切成一小段一小段（公尺），鋪路、鐵軌、小火車都用這個 */
  function curve(pts, loop){ const out = [], Q = (a, c, b, n) => { for (let i = 1; i <= n; i++){ const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } }, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = pts.length;
    if (loop){ let a = m(pts[n - 1], pts[0]); out.push(a); for (let i = 0; i < n; i++){ const b = m(pts[i], pts[(i + 1) % n]); Q(a, pts[i], b, 8); a = b; } }
    else if (n === 2){ out.push(pts[0], pts[1]); }
    else { let a = pts[0]; out.push(a); for (let i = 1; i < n - 1; i++){ const b = m(pts[i], pts[i + 1]); Q(a, pts[i], b, 8); a = b; } out.push(pts[n - 1]); }
    return out.map(p => P(p[0], p[1])); }
  function layer(){ const cv = document.createElement('canvas'); cv.width = NX; cv.height = NZ; const g = cv.getContext('2d', { willReadFrequently: true }); g.setTransform(S * RES, 0, 0, S * RES, (-PX0 * S - X0) * RES, (-PY0 * S - Z0) * RES); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round'; return { cv, g }; }
  const bits = L => { const d = L.g.getImageData(0, 0, NX, NZ).data, a = new Uint8Array(NN); for (let i = 0; i < NN; i++) a[i] = d[i * 4 + 3] > 127 ? 1 : 0; return a; };
  /* 「離邊界幾公尺」：裡面是正的、外面是負的 */
  function sdf(mask){ const INF = 1e20, M = Math.max(NX, NZ), f = new Float64Array(M), dd = new Float64Array(M), v = new Int32Array(M), z = new Float64Array(M + 1);
    const one = n => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF; for (let q = 1; q < n; q++){ let s; for (;;){ const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; } k++; v[k] = q; z[k] = s; z[k + 1] = INF; } k = 0; for (let q = 0; q < n; q++){ while (z[k + 1] < q) k++; const p = v[k]; dd[q] = (q - p) * (q - p) + f[p]; } };
    const dt = g => { for (let x = 0; x < NX; x++){ for (let y = 0; y < NZ; y++) f[y] = g[y * NX + x]; one(NZ); for (let y = 0; y < NZ; y++) g[y * NX + x] = dd[y]; } for (let y = 0; y < NZ; y++){ const o = y * NX; for (let x = 0; x < NX; x++) f[x] = g[o + x]; one(NX); for (let x = 0; x < NX; x++) g[o + x] = dd[x]; } return g; };
    const a = new Float64Array(NN), b = new Float64Array(NN); for (let i = 0; i < NN; i++){ a[i] = mask[i] ? 0 : INF; b[i] = mask[i] ? INF : 0; } dt(a); dt(b);
    const out = new Float32Array(NN); for (let i = 0; i < NN; i++) out[i] = (Math.sqrt(b[i]) - Math.sqrt(a[i])) / RES; return out; }
  const samp = (F, lx, lz) => { const fx = clamp((lx - X0) * RES - 0.5, 0, NX - 1.001), fz = clamp((lz - Z0) * RES - 0.5, 0, NZ - 1.001), i = fx | 0, j = fz | 0, u = fx - i, w = fz - j, o = j * NX + i; return (F[o] * (1 - u) + F[o + 1] * u) * (1 - w) + (F[o + NX] * (1 - u) + F[o + NX + 1] * u) * w; };

  /* ---------- 規劃圖上的形狀 ---------- */
  const IS = rough([[160,610],[150,500],[230,420],[380,370],[460,260],[560,180],[660,110],[790,70],[910,110],[990,190],[1100,240],[1250,215],[1400,265],[1540,320],[1630,440],[1630,560],[1700,650],[1680,760],[1560,810],[1410,800],[1270,770],[1160,800],[1060,860],[910,870],[790,830],[660,760],[520,720],[390,700],[250,690]], 3, 0.28, 3);
  const ISLET = rough([[620,800],[660,785],[690,810],[670,845],[630,840]], 3, 0.4, 90);                       // 燈塔的小岩島
  const SHOALS = [[[[180,330],[230,310],[260,340],[240,380],[190,375]], 93], [[[200,410],[245,400],[260,430],[230,455],[195,445]], 94], [[[150,370],[175,362],[182,390],[158,398]], 95]].map(([p, s0]) => rough(p, 3, 0.45, s0));   // 河口外面的小沙洲
  const FO = rough([[540,230],[620,150],[740,95],[860,100],[960,170],[1000,240],[930,300],[820,290],[720,310],[620,300]], 3, 0.3, 8);   // 北邊的山和森林
  const LAKE = rough([[820,215],[870,205],[905,230],[880,262],[830,258]], 2, 0.3, 11);
  const RIV = [[855,240],[800,215],[785,195],[770,250],[730,296],[660,308],[580,308],[500,316],[430,338],[360,365],[300,385],[262,392]];   // 中段比規劃圖往北挪 3～4 公尺：原本跟鐵軌、水族館站疊在一起
  const MF = rough([[270,350],[340,320],[420,330],[440,380],[380,415],[300,420],[255,395]], 3, 0.4, 91);          // 紅樹林
  const SAND = rough([[1300,700],[1420,660],[1560,640],[1660,680],[1690,760],[1580,800],[1430,795],[1300,780]], 2, 0.2, 77);   // 陽光沙灘
  const PLAZA = [[860,430],[940,400],[1060,410],[1090,480],[1060,560],[960,580],[870,560],[845,495]];
  const PL = [965, 505], RING = [215, 150];
  const NODES = { hall:[965,320,240,120], aqua:[640,400,210,130], mus:[775,662,170,100], amuse:[1255,325,270,160], stad:[1480,430,240,130], mkt:[1210,640,200,110] };
  const edgeP = (n, t) => { const [x, y, w, h] = n, dx = t[0] - x, dy = t[1] - y, k = Math.min((w / 2) / Math.abs(dx || 1e-6), (h / 2) / Math.abs(dy || 1e-6)); return [x + dx * k, y + dy * k]; };
  /* 路：[點, 寬（圖上的像素）, 種類]。stone＝石板大道、lane＝巷子、wood＝港邊木棧道 */
  const ROADS = [
    [[[965,545],[975,600],[985,700],[990,800]], 26, 'stone'],                                      // 廣場 → 商店街 → 港口
    [[[640,760],[800,820],[990,830],[1160,790]], 22, 'wood'],                                      // 港邊
    ...Object.values(NODES).map(n => [[PL, edgeP(n, PL)], 24, 'stone']),                          // 圓環 → 每棟大建築的前廣場（直直的大道）
    [[[752,535],[700,588]], 16, 'stone'], [[[1178,520],[1205,540]], 16, 'stone'], [[[1308,665],[1360,700]], 14, 'stone'],
    ...[[[280,556],[700,588]], [[290,601],[710,633]], [[280,556],[300,690]], [[480,568],[488,690]], [[690,588],[695,660]]].map(L => [L, 11, 'lane']),   // 居民區的巷子
    [[[1205,540],[1310,535],[1430,575]], 12, 'lane'], [[[1300,470],[1310,535],[1320,625]], 12, 'lane'],                                              // 玩家建地區的十字巷
  ];
  const TRAILS = [[[700,283],[684,240],[640,205]], [[934,272],[930,244],[918,210],[870,186],[822,190]], [[440,390],[380,400],[300,395],[240,370],[200,345]], [[700,319],[700,345]], [[540,402],[490,398],[440,390]]];   // 0、1 森林步道；2 紅樹林木棧道；3 過河小橋接到水族館；4 水族館接到木棧道
  const RAIL = [[1160,810],[1300,780],[1420,640],[1560,560],[1610,470],[1620,380],[1500,300],[1360,235],[1250,222],[1080,230],[900,270],[700,330],[560,330],[430,430],[320,470],[260,560],[330,700],[480,740],[640,780],[820,830],[1000,840]];
  const STA = [[1300,780,'沙灘'],[1440,640,'玩家建地'],[1618,470,'體育場'],[1250,222,'遊樂園'],[1080,230,'森林'],[965,256,'村公所'],[560,330,'水族館'],[300,520,'紅樹林・居民區'],[760,808,'博物館'],[990,840,'港口'],[1215,800,'中央市場']];

  /* ---------- 畫進資料格 ---------- */
  const fillL = polys => { const L = layer(); for (const p of polys){ closed(L.g, p); L.g.fill(); } return L; };
  const landL = fillL([IS, ISLET, ...SHOALS]), sdLand = sdf(bits(landL));
  const sdMain = sdf(bits(fillL([IS])));
  const sdFor = sdf(bits(fillL([FO]))), sdSand = sdf(bits(fillL([SAND]))), sdMang = sdf(bits(fillL([MF])));
  const watL = fillL([LAKE]); { const g = watL.g; open(g, RIV); g.lineWidth = 17; g.stroke(); } const sdWat = sdf(bits(watL));
  const paveL = layer(); { const g = paveL.g; closed(g, PLAZA); g.fill(); g.beginPath(); g.ellipse(PL[0], PL[1], RING[0], RING[1], 0, 0, 7); g.lineWidth = 24; g.stroke();
    for (const [pts, w] of ROADS){ open(g, pts); g.lineWidth = w + 4; g.stroke(); }
    for (const k in NODES){ const [x, y, w, h] = NODES[k]; g.beginPath(); g.ellipse(x, y, w / 2 + 4, h / 2 + 4, 0, 0, 7); g.fill(); }
    { open(g, RAIL.concat([RAIL[0]])); g.lineWidth = 16; g.stroke(); } }
  const sdPave = sdf(bits(paveL)), sdLake = sdf(bits(fillL([LAKE])));
  const boardL = layer(); { const g = boardL.g; open(g, TRAILS[2]); g.lineWidth = 8.5; g.stroke(); } const sdBoard = sdf(bits(boardL));                       // 紅樹林木棧道：架在水上，可以走
  const trailL = layer(); { const g = trailL.g; for (const i of [0, 1, 3, 4]){ open(g, TRAILS[i]); g.lineWidth = 8; g.stroke(); } } const sdTrail = sdf(bits(trailL));   // 泥土步道：不長樹
  const BOARD_Y = 0.46, boardY = (lx, lz) => Math.max(hAt(lx, lz) + 0.07, BOARD_Y), onBoard = (lx, lz) => samp(sdBoard, lx, lz) > -0.1;
  /* 高度：海岸前 3 公尺是淺灘；陸地平平的（之後要蓋房子），北邊森林是一座山；河和湖往下挖到海平面以下 */
  const PEAK = P(785, 122), PEAK2 = P(640, 190);
  /* 紅樹林：一片淺淺的水（樹站在水裡），中間幾塊露出來的泥灘 */
  const lagoon = (lx, lz, mg) => { const n = Math.sin(lx * 0.42 + 1.7) * Math.cos(lz * 0.47 - 0.4) + 0.45 * Math.sin(lx * 0.93 - lz * 0.71); return lerp(-0.4, 0.2, s01((n - 0.5) / 0.3) * s01((mg - 0.5) / 2)); };
  function height(lx, lz){ const dl = samp(sdLand, lx, lz), mg = samp(sdMang, lx, lz);
    if (dl < 0){ const d = -dl; let h = d <= 3 ? -0.03 - d * 0.1 : Math.max(-3.2, -0.33 - (d - 3) * 0.42); if (mg > -5) h = lerp(h, lagoon(lx, lz, mg), s01((mg + 5) / 5)); return h; }
    const dw = samp(sdWat, lx, lz), dm = samp(sdMain, lx, lz), flat = s01((samp(sdPave, lx, lz) + 3) / 3);
    let h = 0.1 + s01(dl / 4) * (PAVE_Y - 0.1);
    h += (Math.sin(lx * 0.11 + 1.3) * Math.cos(lz * 0.13) * 0.22 + Math.sin((lx + lz) * 0.31) * 0.07 + 0.12) * s01((dl - 5) / 8) * (1 - flat);
    const df = samp(sdFor, lx, lz); if (df > -14 && dm > 0){ const k = s01((df + 14) / 34) * s01((-dw - 1.5) / 9) * s01(dm / 10) * (1 - flat), a = Math.max(0, 1 - Math.hypot(lx - PEAK[0], lz - PEAK[1]) / 36), b = Math.max(0, 1 - Math.hypot(lx - PEAK2[0], lz - PEAK2[1]) / 26);
      h += k * (0.9 + Math.pow(a, 1.5) * 13.5 + Math.pow(b, 1.6) * 5.5 + (Math.sin(lx * 0.37) * Math.cos(lz * 0.33) + 1) * 0.35); }
    if (dw > -2.2 && dm > 0) h = Math.min(h, dw > 0 ? WL - 0.16 - Math.min(0.85, dw * 0.55) : WL + 0.06 + (-dw) * (-dw) * 0.11);
    if (mg > -3) h = Math.min(h, lerp(h, lagoon(lx, lz, mg), s01((mg + 3) / 4) * (1 - flat)));
    return h; }
  const HG = new Float32Array(NN); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HG[j * NX + i] = height(X0 + (i + 0.5) / RES, Z0 + (j + 0.5) / RES);
  const inBox = (lx, lz, m) => lx > X0 - (m || 0) && lx < X0 + GW + (m || 0) && lz > Z0 - (m || 0) && lz < Z0 + GH + (m || 0);
  const hAt = (lx, lz) => inBox(lx, lz) ? samp(HG, lx, lz) : -3.2;
  const paved = (lx, lz, m) => samp(sdPave, lx, lz) > -(m || 0);

  /* ---------- 水面遮罩（跟村子同一套水：深淺、浪、岸邊泡沫都照這張圖） ---------- */
  let maskTex = null, inside = false;
  { const data = new Uint8Array(NN * 4);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++){ const o = j * NX + i, lx = X0 + (i + 0.5) / RES, lz = Z0 + (j + 0.5) / RES, h = HG[o], dl = sdLand[o], wet = h < WL - 0.02, lk0 = s01((sdMang[o] + 3.5) / 2), inland = (dl > 0 && wet) || lk0 > 0.3, lake = inland && sdLake[o] > -1;   /* lk0：紅樹林（水和泥灘那幾格都算，水邊才不會被當成海邊） */
      let shore = -dl; if (shore < 0 && !(h < 0.2 && samp(sdSand, lx, lz) > -4 && !paved(lx, lz, 2))) shore = -8; if (inland) shore = Math.max(shore, 6);
      data[o * 4] = Math.round(Math.max(clamp(-h / 2, 0, 1) * 255, 36 * lk0));   /* 紅樹林裡（連泥灘那幾格）水深都算 28 公分以上：水邊才不會冒一圈白泡沫 */ data[o * 4 + 1] = wet ? 255 : 0; data[o * 4 + 2] = Math.round(Math.max(dl > 0 && wet ? (lake ? 180 : 60) : 0, 95 * lk0)); data[o * 4 + 3] = Math.round(clamp((shore + 8) / 32, 0, 1) * 255); }
    maskTex = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat); maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter; maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping; maskTex.needsUpdate = true; }

  /* ---------- 地形：一塊 48 公尺，走近才蓋 ---------- */
  const DEEPF = '#6f8f93'; const root = new THREE.Group(); root.position.set(OX, 0, OZ); root.userData.keep = true; root.userData.dyn = true; scene.add(root);
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: DEEPF, roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.y = -3.25; root.add(f); }
  const C = new THREE.Color(), col = (hex, k) => { C.set(hex); if (k != null) C.multiplyScalar(k); return C; };
  const GRASS = ['#8fcf6a', '#7cc25f', '#9ad873'], WOODS = ['#5fae55', '#4f9a4a'], SANDC = '#efe0ae', BEACH = '#fbf3da', MUD = '#8f8a6a', ROCK = '#8f8878', SEAB = '#e9dcae';
  function groundCol(lx, lz, h, out){ const dl = samp(sdLand, lx, lz), n = hash(Math.floor(lx * 0.7), Math.floor(lz * 0.7)), n2 = Math.sin(lx * 0.09 + 0.7) * Math.cos(lz * 0.11) * 0.5 + 0.5;
    if (h < WL - 0.02 && dl > 0){ col('#6f8f72', 0.9); }                                                    // 河床、湖底
    else if (dl < 0.4){ col(SEAB, 1 - clamp(-h / 5, 0, 0.35)); C.lerp(col2.set(DEEPF), s01((-h - 1.4) / 1.6)); }
    else { const bs = samp(sdSand, lx, lz), sandW = 3.2 + Math.sin(lx * 0.07) * 1.1 + Math.cos(lz * 0.09) * 0.9;
      if (dl < sandW){ col(SANDC, 0.96 + n * 0.06); }
      else { const df = samp(sdFor, lx, lz), mg = samp(sdMang, lx, lz), dw = samp(sdWat, lx, lz);
        C.set(GRASS[n2 > 0.62 ? 2 : n2 < 0.35 ? 1 : 0]); if (df > -6){ const k = s01((df + 6) / 10); C.lerp(col2.set(WOODS[n > 0.5 ? 0 : 1]), k * 0.85); }
        if (h > 7.5) C.lerp(col2.set(ROCK), s01((h - 7.5) / 3.5)); if (mg > -1.5) C.lerp(col2.set(MUD), s01((mg + 1.5) / 3) * 0.75); if (dw > -1.6) C.lerp(col2.set('#7fa860'), 0.5);
        C.multiplyScalar(0.95 + n * 0.1); const k2 = s01((dl - sandW) / 2.2); if (k2 < 1){ col2.set(SANDC); C.lerpColors(col2, C.clone(), k2); } }
      if (bs > -7) C.lerp(col2.set(BEACH).multiplyScalar(0.96 + n * 0.06), s01((bs + 7) / 5.5)); }   /* 陽光沙灘：往草地那一邊慢慢淡掉（原本是一格一格的鋸齒邊） */
    { const mg0 = samp(sdMang, lx, lz); if (mg0 > -3 && h < 0.3) C.lerp(col2.set(h < WL ? '#56624a' : '#857f5c'), s01((mg0 + 3) / 3) * 0.9); }
    out[0] = C.r; out[1] = C.g; out[2] = C.b; }
  const col2 = new THREE.Color();
  const terrMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  /* 樹：三種（闊葉、松、椰子），每一種一個形狀，靠大小和顏色拉開差異 */
  const treeGeo = (() => { const mk = parts => { const gs = parts.map(([g, hex]) => { const q = g.index ? g.toNonIndexed() : g, n = q.attributes.position.count, c = new Float32Array(n * 3); col2.set(hex); for (let i = 0; i < n; i++){ c[i * 3] = col2.r; c[i * 3 + 1] = col2.g; c[i * 3 + 2] = col2.b; } q.setAttribute('color', new THREE.BufferAttribute(c, 3)); return q; }); return mergeGeometries(gs, false); };
    const seg = low ? 5 : 6;
    return [ mk([[new THREE.CylinderGeometry(0.13, 0.2, 1.5, 5).translate(0, 0.75, 0), '#8c5d3b'], [new THREE.IcosahedronGeometry(1.15, 0).scale(1, 0.92, 1).translate(0, 2.25, 0), '#5fae55'], [new THREE.IcosahedronGeometry(0.8, 0).translate(0.55, 1.75, 0.2), '#6fbe62']]),
      mk([[new THREE.CylinderGeometry(0.11, 0.17, 1.1, 5).translate(0, 0.55, 0), '#6e4a2f'], [new THREE.ConeGeometry(1.05, 1.7, seg).translate(0, 1.75, 0), '#3d8c42'], [new THREE.ConeGeometry(0.8, 1.5, seg).translate(0, 2.75, 0), '#4a9a4c'], [new THREE.ConeGeometry(0.52, 1.2, seg).translate(0, 3.6, 0), '#57a857']]),
      mk([[new THREE.CylinderGeometry(0.1, 0.17, 3.3, 5).translate(0, 1.65, 0).rotateZ(0.1), '#9b6a42'], ...[0, 1, 2, 3, 4, 5].map(i => [new THREE.ConeGeometry(0.34, 1.9, 4).scale(1, 1, 0.28).rotateZ(1.25).translate(0.85, 3.25, 0).rotateY(i * 1.047), i % 2 ? '#4f9a4a' : '#5fae55'])]),
      /* 紅樹：一根細樹幹、五根往外撐開的支柱根（站在水裡）、扁扁的三團樹冠 */
      mk([[new THREE.CylinderGeometry(0.08, 0.12, 1.5, 5).translate(0, 1.55, 0), '#6b5138'], ...[0, 1, 2, 3, 4].map(i => [new THREE.CylinderGeometry(0.04, 0.065, 1.25, 4).rotateZ(0.655).translate(0.415, 0.475, 0).rotateY(i * 1.2566 + 0.3), '#5d4732']),
        [new THREE.IcosahedronGeometry(1.25, 0).scale(1, 0.55, 1).translate(0, 2.55, 0), '#3f8f58'], [new THREE.IcosahedronGeometry(0.85, 0).scale(1, 0.6, 1).translate(0.7, 2.25, -0.35), '#4fa368'], [new THREE.IcosahedronGeometry(0.75, 0).scale(1, 0.6, 1).translate(-0.6, 2.2, 0.5), '#377f50']]) ]; })();
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const chunks = new Map();
  function buildChunk(ci, cj){ const x0 = X0 + ci * TILE, z0 = Z0 + cj * TILE, n = TILE / STEP, g = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * (n + 1) * 3), cl = new Float32Array(pos.length), nr = new Float32Array(pos.length), idx = [], rgb = [0, 0, 0];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++){ const lx = x0 + i * STEP, lz = z0 + j * STEP, h = hAt(lx, lz), o = (j * (n + 1) + i) * 3; pos[o] = lx; pos[o + 1] = h; pos[o + 2] = lz; groundCol(lx, lz, h, rgb); cl[o] = rgb[0]; cl[o + 1] = rgb[1]; cl[o + 2] = rgb[2];
      const ex = hAt(lx + 0.6, lz) - hAt(lx - 0.6, lz), ez = hAt(lx, lz + 0.6) - hAt(lx, lz - 0.6), il = 1 / Math.hypot(ex, 1.2, ez); nr[o] = -ex * il; nr[o + 1] = 1.2 * il; nr[o + 2] = -ez * il; }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setIndex(idx);
    const grp = new THREE.Group(), m = new THREE.Mesh(g, terrMat); m.receiveShadow = true; grp.add(m);
    /* 這一塊的樹 */
    const T = [[], [], [], []], cols = [];
    const cell = 2.6; for (let a = Math.floor(x0 / cell); a * cell < x0 + TILE; a++) for (let b = Math.floor(z0 / cell); b * cell < z0 + TILE; b++){ const r1 = hash(a, b), r2 = hash(a + 911, b - 57), r3 = hash(a - 333, b + 777), lx = (a + 0.15 + r1 * 0.7) * cell, lz = (b + 0.15 + r2 * 0.7) * cell;
      if (lx < x0 || lx >= x0 + TILE || lz < z0 || lz >= z0 + TILE || !inBox(lx, lz)) continue; if (samp(sdBoard, lx, lz) > -1.3 || samp(sdTrail, lx, lz) > -1.1) continue; const mg = samp(sdMang, lx, lz);
      if (mg > 0.3){ const hm = hAt(lx, lz); if (hm < -0.55 || paved(lx, lz, 1.6) || reserved(lx, lz) || hash(a * 7 + 3, b * 13 + 1) > 0.64 * (low ? 0.6 : 1)) continue;   /* 紅樹林：水裡、泥灘上都長 */
        const sm = 0.8 + r3 * 0.55; T[3].push([lx, Math.max(hm, -0.42) + 0.05, lz, sm, r1 * 6.283, 1]); if (hm > WL) cols.push({ t: 'c', x: OX + lx, z: OZ + lz, r: 0.3 * sm, tree: true }); continue; }
      const dl = samp(sdLand, lx, lz); if (dl < 2.2) continue; const h = hAt(lx, lz); if (h < 0.12) continue;
      if (paved(lx, lz, 2.4) || samp(sdWat, lx, lz) > -1.4 || reserved(lx, lz)) continue; const df = samp(sdFor, lx, lz), bs = samp(sdSand, lx, lz);
      let dens, kind; const dk = low ? 0.55 : 1; if (bs > -2){ dens = dl < 9 ? 0 : 0.035; kind = 2; } else if (df > 2){ dens = 0.62; kind = h > 4 || r3 > 0.55 ? 1 : 0; } else if (mg > -5){ dens = 0.3; kind = 0; } else if (dl < 7){ dens = 0.05; kind = r3 > 0.5 ? 2 : 0; } else { dens = 0.075; kind = r3 > 0.8 ? 1 : 0; }
      if (hash(a * 7 + 3, b * 13 + 1) > dens * dk) continue; const s = (kind === 2 ? 0.95 : 0.8) + r3 * 0.55 + (df > 2 ? 0.25 : 0); T[kind].push([lx, h, lz, s, r1 * 6.283, mg > -5 ? 0.8 : 1]); cols.push({ t: 'c', x: OX + lx, z: OZ + lz, r: 0.28 * s, tree: true }); }
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    T.forEach((L, k) => { if (!L.length) return; const im = new THREE.InstancedMesh(treeGeo[k], treeMat, L.length); L.forEach(([x, y, z, s, ry, sy], i) => { e.set(0, ry, 0); q.setFromEuler(e); sc.set(s, s * sy, s); ps.set(x, y - 0.05, z); M4.compose(ps, q, sc); im.setMatrixAt(i, M4); col2.setHSL(0, 0, 0.86 + hash(i, k + ci * 31 + cj) * 0.28); im.setColorAt(i, col2); }); im.castShadow = !low; im.computeBoundingSphere(); grp.add(im); });
    root.add(grp); for (const c of cols) colliders.push(c); return { grp, cols, cx: x0 + TILE / 2, cz: z0 + TILE / 2 }; }
  function dropChunk(k){ const c = chunks.get(k); if (!c) return; root.remove(c.grp); c.grp.traverse(o => { if (o.isMesh && o.geometry && !treeGeo.includes(o.geometry)) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); const S2 = new Set(c.cols); for (let i = colliders.length - 1; i >= 0; i--) if (S2.has(colliders[i])) colliders.splice(i, 1); chunks.delete(k); }
  const NCX = Math.ceil(GW / TILE), NCZ = Math.ceil(GH / TILE);
  function chunkTick(px, pz, all){ let made = 0; for (let cj = 0; cj < NCZ; cj++) for (let ci = 0; ci < NCX; ci++){ const k = ci + ',' + cj, cx = X0 + ci * TILE + TILE / 2, cz = Z0 + cj * TILE + TILE / 2, d = Math.hypot(Math.max(0, Math.abs(px - cx) - TILE / 2), Math.max(0, Math.abs(pz - cz) - TILE / 2));
      if (d < VIEW && !chunks.has(k)){ if (made < (all ? 99 : 1)){ chunks.set(k, buildChunk(ci, cj)); made++; } } else if (d > VIEW + 40 && chunks.has(k)) dropChunk(k); } }

  /* ---------- 路和廣場（石板、巷子、港邊木棧道）：平平的一層，貼在地上 ---------- */
  const stoneTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#e9dfc9'; c.fillRect(0, 0, 256, 256); let s0 = 5; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
      for (let row = 0; row < 4; row++){ let x = -r() * 40; while (x < 256){ const w = 48 + r() * 40; c.fillStyle = ['#efe6d2', '#e4d8be', '#ebe0c8', '#dfd2b6'][Math.floor(r() * 4)]; c.fillRect(x + 1.5, row * 64 + 1.5, w - 3, 61); x += w; } }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
  const woodTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); for (let i = 0; i < 8; i++){ c.fillStyle = ['#b98a5a', '#ad7f52', '#c2935f', '#a87848'][i % 4]; c.fillRect(0, i * 16, 128, 15); c.fillStyle = '#7a5530'; c.fillRect(0, i * 16 + 15, 128, 1); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const railTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#b9ae98'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#6e4a2f'; c.fillRect(4, 8, 56, 14); c.fillRect(4, 40, 56, 14); c.fillStyle = '#5a5f66'; c.fillRect(14, 0, 5, 64); c.fillRect(45, 0, 5, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const pm = (tex, o) => new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o || {}));
  const dirtTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#c9ad7c'; c.fillRect(0, 0, 64, 64); let s0 = 21; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; }; for (let i = 0; i < 90; i++){ c.fillStyle = ['#b89a68', '#d6bc8e', '#a98b5c'][i % 3]; c.fillRect(r() * 64, r() * 64, 2 + r() * 4, 2 + r() * 3); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const MAT = { stone: pm(stoneTex), lane: pm(stoneTex, { color: '#e2d6bd' }), wood: pm(woodTex), rail: pm(railTex), dirt: pm(dirtTex, { roughness: 1 }) };
  const paveParts = { stone: [], lane: [], wood: [], rail: [], dirt: [] };
  const dense = (L, st) => { const o = [L[0]]; for (let i = 1; i < L.length; i++){ const a = L[i - 1], b = L[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / st)); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
  function ribbon(kind, line, w, y, loop, tile){ const n = line.length, pos = [], uv = [], idx = []; let len = 0;
    for (let i = 0; i < n; i++){ const a = line[loop ? (i - 1 + n) % n : Math.max(0, i - 1)], b = line[loop ? (i + 1) % n : Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l; if (i) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      const cx = line[i][0], cz = line[i][1], xa = cx + nx * w / 2, za = cz + nz * w / 2, xb = cx - nx * w / 2, zb = cz - nz * w / 2, fy = typeof y === 'function', yy = fy ? 0 : y != null ? y : Math.max(0.2, hAt(cx, cz)) + 0.05;
      pos.push(xa, fy ? y(xa, za, cx, cz) : yy, za, xb, fy ? y(xb, zb, cx, cz) : yy, zb); uv.push(0, len / (tile || 3), w / (tile || 3), len / (tile || 3)); }
    const m = loop ? n : n - 1; for (let i = 0; i < m; i++){ const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); paveParts[kind].push(g.toNonIndexed()); }
  function flatShape(kind, pts, y){ const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))), g = new THREE.ShapeGeometry(sh), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, y, z); uv.setXY(i, x / 3, z / 3); } g.computeVertexNormals(); const n = g.attributes.normal; if (n.getY(0) < 0){ const ix = g.index.array; for (let i = 0; i < ix.length; i += 3){ const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); } paveParts[kind].push(g.toNonIndexed()); }
  const ell = (cx, cy, rx, ry, n, a0, a1) => Array.from({ length: n }, (_, i) => { const a = (a0 || 0) + ((a1 != null ? a1 : 6.2832) - (a0 || 0)) * i / (a1 != null ? n - 1 : n); return P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); });
  ribbon('stone', ell(PL[0], PL[1], RING[0], RING[1], 96), 4.6, PAVE_Y, true);                                  // 圓環大道
  flatShape('stone', curve(PLAZA.map((p, i, L) => p), true), PAVE_Y + 0.012);                                  // 主城廣場
  for (const [pts, w, kind] of ROADS) ribbon(kind, curve(pts), w * S, PAVE_Y + (kind === 'lane' ? 0.004 : 0.008), false, kind === 'wood' ? 1.6 : 3);
  /* 前廣場：照建築換形狀（村公所半圓台階、水族館波浪、博物館拱形、遊樂園和市場圓、體育場橢圓） */
  { let [x, y, w, h] = NODES.hall; const a = [[x - w / 2, y - h / 2 + 10], [x + w / 2, y - h / 2 + 10], [x + w / 2 - 20, y + h / 2 - 20]]; for (let i = 1; i < 8; i++){ const t = i / 8, u = 1 - t; a.push([u * u * (x + w / 2 - 20) + 2 * u * t * x + t * t * (x - w / 2 + 20), u * u * (y + h / 2 - 20) + 2 * u * t * (y + h / 2 + 18) + t * t * (y + h / 2 - 20)]); } a.push([x - w / 2 + 20, y + h / 2 - 20]); flatShape('stone', a.map(p => P(p[0], p[1])), PAVE_Y + 0.016);
    [x, y, w, h] = NODES.aqua; flatShape('stone', curve(rough([[x - w / 2, y], [x - w / 3, y - h / 2], [x, y - h / 2 - 8], [x + w / 3, y - h / 2 + 4], [x + w / 2, y + 4], [x + w / 4, y + h / 2], [x - w / 6, y + h / 2 + 6], [x - w / 2 + 10, y + h / 3]], 2, 0.18, 301), true), PAVE_Y + 0.016);
    [x, y, w, h] = NODES.mus; { const b = [[x - w / 2, y + h / 2], [x - w / 2, y - h / 6]]; for (let i = 1; i <= 12; i++){ const t = Math.PI - i / 12 * Math.PI; b.push([x + Math.cos(t) * w / 2, y - h / 6 - Math.sin(t) * (h / 3 + 20)]); } b.push([x + w / 2, y + h / 2]); flatShape('stone', b.map(p => P(p[0], p[1])), PAVE_Y + 0.016); }
    for (const k of ['amuse', 'stad', 'mkt']){ [x, y, w, h] = NODES[k]; flatShape(k === 'amuse' ? 'lane' : 'stone', ell(x, y, w / 2, h / 2, 40), PAVE_Y + 0.016); } }
  const boardLine = dense(curve(TRAILS[2]), 1.2); ribbon('wood', boardLine, 1.7, (x, z, cx, cz) => boardY(cx, cz), false, 1.6);   // 紅樹林木棧道：架在水上
  for (const i of [0, 1, 3, 4]) ribbon('dirt', dense(curve(TRAILS[i]), 1.1), 1.6, (x, z) => Math.max(0.2, hAt(x, z)) + 0.05, false, 2.2);   // 泥土步道：貼著山坡
  const railLine = curve(RAIL, true); ribbon('rail', railLine, 2.0, (x, z, cx, cz) => Math.max(0.2, hAt(cx, cz)) + 0.075, true, 1.0);                          // 環島小火車的軌道
  for (const k in paveParts){ if (!paveParts[k].length) continue; const m = new THREE.Mesh(mergeGeometries(paveParts[k], false), MAT[k]); m.receiveShadow = true; root.add(m); }

  /* ---------- 大建築（先用簡單的樣子佔位置，看大小和位置對不對；之後一棟一棟換成真的） ---------- */
  const RSV = [], DECKS = [];   /* 蓋了東西的地方：不長樹；DECKS：可以走上去的棧橋 [x0, x1, z0, z1, 高度] */
  const deck = (lx, lz) => { for (const d of DECKS) if (lx > d[0] && lx < d[1] && lz > d[2] && lz < d[3]) return d; return null; };
  const reserved = (lx, lz) => RSV.some(([x, z, r]) => Math.hypot(lx - x, lz - z) < r);
  const roofG = (len, depth, h) => new THREE.CylinderGeometry(1, 1, len, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.5, 0).scale(1, h / 1.5, depth / 1.732);   /* 沿著 x 的三角柱屋頂 */
  const B = (parts, hex, w, h, d, x, y, z, ry) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); (parts[hex] = parts[hex] || []).push(g.toNonIndexed()); };
  const G = (parts, hex, g, x, y, z) => { g.translate(x, y, z); (parts[hex] = parts[hex] || []).push(g.index ? g.toNonIndexed() : g); };
  const flush = (parts, grp) => { for (const hex in parts){ const m = new THREE.Mesh(mergeGeometries(parts[hex], false), mat(hex.slice(0, 7), hex.length > 7 ? 0.35 : 0.85)); m.castShadow = true; m.receiveShadow = true; grp.add(m); } };
  const tickers = [], labels = []; let labelsOn = true;
  function label(txt, lx, y, lz, s){ const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.font = 'bold 64px sans-serif'; const tw = Math.min(480, c.measureText(txt).width + 56); c.fillStyle = 'rgba(24,51,74,.88)'; c.beginPath(); c.roundRect(256 - tw / 2, 16, tw, 96, 26); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 256, 66, 440);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.material.map.colorSpace = THREE.SRGBColorSpace; sp.userData.w = 10 * (s || 1); sp.userData.h = 2.5 * (s || 1); sp.scale.set(sp.userData.w, sp.userData.h, 1); sp.position.set(lx, y, lz); sp.renderOrder = 9; root.add(sp); labels.push(sp); return sp; }
  const town = new THREE.Group(); root.add(town);
  { const parts = {}, WALL = '#f3ecdc', BLUE = '#3b5fb3', RED = '#d9393b';
    /* 主城廣場：大看板＋噴水池 */
    { const [x, z] = P(975, 440); B(parts, '#222831', 13, 7.2, 0.6, x, 5.4, z); B(parts, '#222831', 0.7, 2.2, 0.7, x - 5, 1.1, z); B(parts, '#222831', 0.7, 2.2, 0.7, x + 5, 1.1, z);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 272; const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#4ec9ff'); gr.addColorStop(1, '#b36bff'); c.fillStyle = gr; c.fillRect(0, 0, 512, 272); c.fillStyle = '#fff'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText('潮汐大看板', 256, 150);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const scr = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 6.4), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(x, 5.4, z + 0.32); town.add(scr); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 6.5, hd: 0.5, big: true });
      const [fx, fz] = P(975, 520); G(parts, '#dfe7ee', new THREE.CylinderGeometry(3.4, 3.6, 0.5, 24), fx, 0.55, fz); G(parts, '#7fd3ef66', new THREE.CylinderGeometry(3.1, 3.1, 0.12, 24), fx, 0.78, fz); G(parts, '#dfe7ee', new THREE.CylinderGeometry(0.35, 0.5, 1.5, 10), fx, 1.3, fz); G(parts, '#dfe7ee', new THREE.CylinderGeometry(1.1, 0.5, 0.25, 14), fx, 2.1, fz);
      colliders.push({ t: 'c', x: OX + fx, z: OZ + fz, r: 3.6, big: true }); RSV.push([x, z, 9], [fx, fz, 6]); label('主城廣場・大看板', x, 11.5, z); }
    /* 村公所・鐘樓 */
    { const [x, z] = P(965, 314); B(parts, WALL, 34, 5.2, 9, x, 2.9, z); B(parts, BLUE, 35.4, 0.9, 10.4, x, 5.9, z); B(parts, WALL, 5, 13, 5, x, 6.8, z - 1.5); G(parts, BLUE, new THREE.ConeGeometry(4.3, 4.4, 4).rotateY(Math.PI / 4), x, 15.5, z - 1.5); G(parts, '#ffffff', new THREE.CylinderGeometry(1.5, 1.5, 0.2, 20).rotateX(Math.PI / 2), x, 11.2, z + 1.05);
      for (let i = 0; i < 6; i++) B(parts, '#8bb6e6', 2.4, 2.6, 0.2, x - 14 + i * 5.6, 3, z + 4.55); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 17.2, hd: 4.8, big: true }); RSV.push([x - 9, z, 12], [x + 9, z, 12]); label('村公所・鐘樓', x, 20, z); }
    /* 水族館（圓頂） */
    { const [x, z] = P(626, 412); G(parts, '#bfe8f5', new THREE.CylinderGeometry(11.2, 11.8, 2.4, 36), x, 1.5, z); G(parts, '#2f86c9', new THREE.SphereGeometry(10.2, 28, 12, 0, 6.2832, 0, Math.PI / 2).scale(1, 0.62, 1), x, 2.7, z); G(parts, '#7fd8f5aa', new THREE.SphereGeometry(6.6, 20, 8, 0, 6.2832, 0, Math.PI / 2).scale(1, 0.75, 1), x, 4.9, z);
      B(parts, '#bfe8f5', 5.2, 3.4, 2.4, x + 11.6, 2.0, z); B(parts, '#2f86c9', 5.8, 0.4, 3, x + 11.6, 3.9, z); B(parts, '#8bd0f0', 0.2, 2.4, 1.5, x + 14.25, 1.6, z);   /* 朝廣場那一面的入口 */
      colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 11.7, big: true }, { t: 'b', x: OX + x + 11.6, z: OZ + z, hw: 2.7, hd: 1.3, big: true }); RSV.push([x, z, 14], [x + 12, z, 5]); label('水族館', x, 13, z); }
    /* 博物館 */
    { const [x, z] = P(775, 682); B(parts, '#e9e1cf', 24, 6.4, 12, x, 3.5, z); G(parts, '#7c8fb0', roofG(26, 13.4, 3.6), x, 6.7, z); for (let i = 0; i < 6; i++) G(parts, '#ffffff', new THREE.CylinderGeometry(0.5, 0.56, 5.6, 10), x - 10 + i * 4, 3.1, z + 6.7); B(parts, '#d9cfb8', 25, 0.5, 3.4, x, 0.55, z + 7.2);
      colliders.push({ t: 'b', x: OX + x, z: OZ + z + 0.6, hw: 12.2, hd: 7.4, big: true }); RSV.push([x - 6, z, 11], [x + 6, z, 11]); label('博物館', x, 14, z); }
    /* 體育場 */
    { const [x, z] = P(1480, 430), n = 28; for (let i = 0; i < n; i++){ const a = i / n * 6.2832, ca = Math.cos(a), sa = Math.sin(a); for (let k = 0; k < 3; k++) B(parts, k === 2 ? '#dfe6ef' : '#3d66b5', 4.6, 1.3 + k * 1.3, 2.1, x + ca * (19 + k * 2.1), 0.9 + k * 0.65, z + sa * (9.5 + k * 2.1), Math.atan2(-9.5 * ca, -19 * sa)); }
      G(parts, '#d8584a', new THREE.CylinderGeometry(1, 1, 0.1, 36).scale(16.5, 1, 7.4), x, 0.5, z); G(parts, '#4fae55', new THREE.CylinderGeometry(1, 1, 0.1, 36).scale(12.5, 1, 4.6), x, 0.56, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 9, big: true }, { t: 'c', x: OX + x - 13, z: OZ + z, r: 9.5, big: true }, { t: 'c', x: OX + x + 13, z: OZ + z, r: 9.5, big: true }); RSV.push([x - 12, z, 14], [x + 12, z, 14], [x, z, 14]); label('體育場', x, 11, z); }
    /* 中央市場 */
    { const [x, z] = P(1235, 655); B(parts, '#f0e6d0', 24, 5, 11, x, 2.8, z); B(parts, '#2c6fb5', 25.4, 1.6, 12.4, x, 5.9, z); ['#e2574c', '#f0a02a', '#4bb57b', '#3c8fd8', '#a46ad8'].forEach((c, i) => B(parts, c, 3.6, 0.2, 2.2, x - 9.2 + i * 4.6, 3.3, z + 6.4)); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 12.2, hd: 5.7, big: true }); RSV.push([x - 6, z, 11], [x + 6, z, 11]); label('中央市場', x, 12, z); }
    /* 燈塔（港口外的小岩島） */
    { const [x, z] = P(655, 815), y = Math.max(0.3, hAt(x, z)); G(parts, '#ffffff', new THREE.CylinderGeometry(1.5, 2.3, 11, 14), x, y + 5.5, z); for (let i = 0; i < 3; i++) G(parts, RED, new THREE.CylinderGeometry(1.62 + (2 - i) * 0.25, 1.78 + (2 - i) * 0.25, 1.5, 14), x, y + 2.6 + i * 3.1, z); G(parts, '#333a44', new THREE.CylinderGeometry(1.9, 1.9, 0.3, 14), x, y + 11.1, z); G(parts, '#ffe5a4', new THREE.CylinderGeometry(1.1, 1.1, 1.5, 10), x, y + 12, z); G(parts, RED, new THREE.ConeGeometry(1.7, 1.6, 12), x, y + 13.5, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 2.4, big: true }); RSV.push([x, z, 5]); label('燈塔', x, 17.5, z, 0.8); }
    /* 港口碼頭：五條棧橋 */
    for (const [dx, len] of [[-170, 90], [-90, 120], [0, 140], [90, 120], [170, 90]]){ const [x, z0] = P(990 + dx, 835), L = len * S; B(parts, '#b98a5a', 3.4, 0.3, L, x, 0.5, z0 + L / 2); DECKS.push([x - 1.7, x + 1.7, z0 - 2, z0 + L, 0.65]); for (let k = 0; k <= L; k += 4){ B(parts, '#7a5530', 0.4, 2.4, 0.4, x - 1.5, -0.5, z0 + k); B(parts, '#7a5530', 0.4, 2.4, 0.4, x + 1.5, -0.5, z0 + k); } }
    { const [x, z] = P(990, 880); label('港口碼頭', x, 8, z); }
    /* 居民區、商店街、玩家建地：小房子（之後換成真的房子模型） */
    const ROOF = ['#c0583a', '#4a6fb5', '#7a5aa0', '#d08a2a', '#3e8f86', '#e2574c', '#3c8fd8', '#4bb57b'];
    const house = (px, py, w, d, roof, ry) => { const [x, z] = P(px, py); if (paved(x, z, 1.2) || samp(sdLand, x, z) < 4 || hAt(x, z) < 0.2) return; B(parts, '#f7efe1', w, 2.9, d, x, 1.75, z, ry); const g = roofG(w + 0.5, d + 0.7, 1.7); if (ry) g.rotateY(ry); G(parts, roof, g, x, 3.2, z); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: w / 2 + 0.1, hd: d / 2 + 0.1 }); RSV.push([x, z, Math.max(w, d) * 0.75]); };
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) house(315 + i * 52 + r * 20, 531 + r * 45 + i * 4, 6, 4.4, ROOF[(i + r) % 5]);
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) house(985 + side * 36, 611 + i * 32, 6, 4.4, ROOF[5 + (i + (side > 0 ? 1 : 0)) % 3]);
    for (const [px, py, i] of [[1238, 511], [1268, 511], [1238, 568], [1268, 568], [1348, 503], [1378, 518], [1353, 573], [1383, 583]].map((p, i) => [p[0], p[1], i])) if (i < 5) house(px, py, 4.6, 3.6, ROOF[5 + i % 3]);
    { const [x, z] = P(470, 585); label('居民區', x, 9, z); } { const [x, z] = P(985, 700); label('商店街', x, 9, z, 0.8); } { const [x, z] = P(1320, 545); label('玩家建地區', x, 9, z); }
    { const [x, z] = P(1490, 720); label('陽光沙灘', x, 8, z); } { const [x, z] = P(780, 215); label('森林冒險區', x, 22, z); } { const [x, z] = P(345, 372); label('紅樹林', x, 8, z); }
    /* 陽傘 */
    sd = 75; for (let i = 0; i < 16; i++){ const [x, z] = P(1330 + R() * 330, 690 + R() * 90), y = hAt(x, z); if (y < 0.15) continue; G(parts, ['#2c8fd6', '#e46a4a', '#f2c230', '#ff8fb0'][i % 4], new THREE.ConeGeometry(1.5, 0.6, 8), x, y + 2.2, z); G(parts, '#f7efe1', new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), x, y + 1.1, z); }
    /* 小火車的車站 */
    /* 月台貼著鐵軌、順著鐵軌的方向；兩邊看哪一邊有空地（不是水、沒有壓到房子）就蓋哪一邊 */
    const hit = (x, z, m) => { for (let i = COL0; i < colliders.length; i++){ const c = colliders[i], dx = OX + x - c.x, dz = OZ + z - c.z; if (c.t === 'c' ? Math.hypot(dx, dz) < c.r + m : Math.abs(dx) < c.hw + m && Math.abs(dz) < c.hd + m) return true; } return false; };
    for (const [sx, sy, nm] of STA){ const [px, pz] = P(sx, sy), NR = railLine.length; let bi = 0, bd = 1e9; railLine.forEach((q, i) => { const d = Math.hypot(q[0] - px, q[1] - pz); if (d < bd){ bd = d; bi = i; } });
      const a = railLine[(bi - 1 + NR) % NR], b = railLine[(bi + 1) % NR], q = railLine[bi], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / tl, tz = (b[1] - a[1]) / tl; let best = null;
      for (const sg of [1, -1]){ const x = q[0] - tz * sg * 2.5, z = q[1] + tx * sg * 2.5, ox = q[0] - tz * sg * 4.4, oz = q[1] + tx * sg * 4.4; let sc = -Math.hypot(ox, oz) * 0.01; if (hAt(ox, oz) < 0.25 || hAt(x, z) < 0.25) sc -= 10; if (samp(sdWat, ox, oz) > -1.5) sc -= 10; if (hit(x, z, 1.7) || hit(ox, oz, 0.9)) sc -= 5; if (!best || sc > best.sc) best = { x, z, sg, sc }; }
      const { x, z, sg } = best, y = Math.max(0.2, hAt(x, z)), ry = Math.atan2(-tz, tx); B(parts, '#fff6e0', 5.4, 0.35, 2.6, x, y + 0.2, z, ry); B(parts, RED, 5.8, 0.25, 3, x, y + 3.1, z, ry);
      for (const k of [-2.4, 2.4]) B(parts, '#8a6038', 0.22, 2.8, 0.22, x + tx * k - tz * sg * 1.0, y + 1.6, z + tz * k + tx * sg * 1.0); B(parts, '#8a6038', 2.2, 0.12, 0.5, x - tz * sg * 0.8, y + 0.75, z + tx * sg * 0.8, ry);   /* 兩根柱子、一張長椅 */
      label(nm + '站', x, y + 5, z, 0.6).userData.st = 1; RSV.push([x, z, 4.5]); }
    /* 過河的小木橋（森林步道 → 水族館） */
    { const [x, z0] = P(700, 281), z1 = P(700, 321)[1], zc = (z0 + z1) / 2, L = z1 - z0 + 0.4, TOP = 0.62; B(parts, '#b98a5a', 2.2, 0.2, L, x, TOP - 0.1, zc); DECKS.push([x - 1.1, x + 1.1, z0 - 1.3, z1 + 1.3, TOP, 1.1]);
      G(parts, '#b98a5a', new THREE.BoxGeometry(2.2, 0.1, 1.2).rotateX(-0.22), x, TOP - 0.17, z0 - 0.72); G(parts, '#b98a5a', new THREE.BoxGeometry(2.2, 0.1, 1.2).rotateX(0.22), x, TOP - 0.17, z1 + 0.72);   /* 兩頭的斜坡 */
      for (const sx of [-1.05, 1.05]){ B(parts, '#7a5530', 0.1, 0.1, L, x + sx, TOP + 0.84, zc); for (let k = 0; k <= 4; k++) B(parts, '#7a5530', 0.12, 0.9, 0.12, x + sx, TOP + 0.42, z0 + (z1 - z0) * k / 4); } for (const dz of [-1.6, 1.6]) for (const sx of [-0.9, 0.9]) B(parts, '#6e4a2f', 0.22, 1.9, 0.22, x + sx, -0.4, zc + dz); }
    /* 紅樹林木棧道：水上的那一段有樁、兩邊有扶手 */
    { const L = dense(curve(TRAILS[2]), 2.4), n = L.length, side = [[], []]; for (let i = 0; i < n; i++){ const a = L[Math.max(0, i - 1)], b = L[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, [cx, cz] = L[i], y = boardY(cx, cz), over = hAt(cx, cz) < 0.3;
        for (const k of [0, 1]){ const sx = cx + nx * (k ? -0.85 : 0.85), sz = cz + nz * (k ? -0.85 : 0.85); side[k].push(over ? [sx, y, sz] : null); if (over) B(parts, '#7a5530', 0.13, 1.95, 0.13, sx, y - 0.1, sz); } }
      for (const sd2 of side) for (let i = 1; i < sd2.length; i++){ const a = sd2[i - 1], b = sd2[i]; if (!a || !b) continue; const dx = b[0] - a[0], dz = b[2] - a[2]; B(parts, '#8a6038', Math.hypot(dx, dz) + 0.05, 0.08, 0.08, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.82, (a[2] + b[2]) / 2, Math.atan2(-dz, dx)); } }
    flush(parts, town); }
  /* 遊樂園：摩天輪會轉（先這一樣會動，其他設施之後補） */
  { const [x, z] = P(1215, 320), parts = {}, wheel = new THREE.Group(), wp = {}; for (const dz of [-1, 1]){ B(parts, '#e45a8a', 0.7, 12.3, 0.5, x, 6.15, z + dz * 1.1); B(parts, '#c94a78', 3.2, 0.5, 0.9, x, 0.5, z + dz * 1.1); } B(parts, '#c94a78', 0.6, 0.6, 2.8, x, 12.3, z);
    G(wp, '#e45a8a', new THREE.TorusGeometry(9.6, 0.22, 6, 40), 0, 0, 0); for (let i = 0; i < 12; i++){ const a = i / 12 * 6.2832; const sp = new THREE.CylinderGeometry(0.07, 0.07, 9.6, 4).translate(0, 4.8, 0).rotateZ(a); G(wp, '#f7c6d8', sp, 0, 0, 0); }
    flush(wp, wheel); wheel.position.set(x, 12.3, z); town.add(wheel); const cars = []; for (let i = 0; i < 12; i++){ const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), mat(['#ffcc33', '#4ec1ff', '#ff6b6b', '#7bd389'][i % 4], 0.6)); c.castShadow = true; town.add(c); cars.push(c); }
    /* 旋轉木馬：整座慢慢轉，馬一上一下 */
    { const cx = x + 13.5, cz = z + 5.5, spin = new THREE.Group(), sp = {}, hA = new THREE.Group(), hB = new THREE.Group(), pa = {}, pb = {};
      G(parts, '#e9dfc9', new THREE.CylinderGeometry(4.4, 4.6, 0.36, 20), cx, 0.52, cz);
      G(sp, '#fff3d6', new THREE.CylinderGeometry(4.0, 4.0, 0.16, 20), 0, 0.78, 0); G(sp, '#fff3d6', new THREE.CylinderGeometry(4.7, 4.7, 0.3, 16), 0, 4.35, 0); G(sp, '#f2c230', new THREE.CylinderGeometry(0.45, 0.55, 3.6, 10), 0, 2.6, 0); G(sp, '#f2c230', new THREE.SphereGeometry(0.36, 8, 6), 0, 6.55, 0); G(sp, '#e2574c', new THREE.ConeGeometry(4.7, 2.0, 16), 0, 5.5, 0);
      for (let i = 0; i < 8; i++){ const a = i / 8 * 6.2832, hx = Math.cos(a) * 3.0, hz = Math.sin(a) * 3.0, tg = i % 2 ? pb : pa, hc = i % 2 ? '#ffd9a8' : '#ffffff'; G(sp, '#fff3d6', new THREE.CylinderGeometry(0.05, 0.05, 3.5, 5), hx, 2.6, hz);
        B(tg, hc, 0.38, 0.6, 1.0, hx, 1.75, hz, -a); B(tg, hc, 0.26, 0.5, 0.3, hx - Math.sin(a) * 0.5, 2.25, hz + Math.cos(a) * 0.5, -a); B(tg, '#e2574c', 0.42, 0.12, 0.4, hx, 2.08, hz, -a); }
      flush(sp, spin); flush(pa, hA); flush(pb, hB); spin.add(hA, hB); spin.position.set(cx, 0, cz); town.add(spin); colliders.push({ t: 'c', x: OX + cx, z: OZ + cz, r: 4.6, big: true }); RSV.push([cx, cz, 6]);
      tickers.push((dt, t) => { spin.rotation.y = -t * 0.45; hA.position.y = Math.sin(t * 2.2) * 0.2; hB.position.y = -Math.sin(t * 2.2) * 0.2; }); }
    for (const [dx, dz, c1] of [[25, 7, '#f2c230'], [23, -6, '#4ec1ff']]){ G(parts, c1, new THREE.ConeGeometry(3.4, 2.4, 10), x + dx, 4.4, z + dz); G(parts, '#ffffff', new THREE.CylinderGeometry(3.1, 3.1, 0.3, 10), x + dx, 3.1, z + dz); G(parts, '#f7efe1', new THREE.CylinderGeometry(0.3, 0.3, 3, 8), x + dx, 1.6, z + dz); colliders.push({ t: 'c', x: OX + x + dx, z: OZ + z + dz, r: 3.2, big: true }); RSV.push([x + dx, z + dz, 5]); }
    flush(parts, town); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 1.8, hd: 1.6, big: true }); RSV.push([x, z, 11]); label('遊樂園', x, 25, z);
    tickers.push((dt, t) => { wheel.rotation.z = t * 0.18; for (let i = 0; i < 12; i++){ const a = t * 0.18 + i / 12 * 6.2832; cars[i].position.set(x + Math.cos(a) * 9.6, 12.3 + Math.sin(a) * 9.6 - 0.9, z); } }); }
  /* 環島小火車：三節車廂沿著軌道跑 */
  { const cum = [0]; for (let i = 1; i <= railLine.length; i++){ const a = railLine[i - 1], b = railLine[i % railLine.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } const LEN = cum[cum.length - 1];
    const at = s => { s = ((s % LEN) + LEN) % LEN; let lo = 0, hi = cum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const a = railLine[lo], b = railLine[(lo + 1) % railLine.length], k = (s - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
    const cars = []; for (let k = 0; k < 3; k++){ const g = new THREE.Group(), parts = {}; B(parts, k ? '#3c8fd8' : '#d9393b', 1.7, 1.5, 3.4, 0, 1.25, 0); B(parts, '#fff6e0', 1.8, 0.16, 3.6, 0, 2.08, 0); B(parts, '#f7efe1', 1.72, 0.5, 2.2, 0, 1.5, 0); if (!k){ G(parts, '#333a44', new THREE.CylinderGeometry(0.22, 0.3, 0.9, 8), 0, 2.5, 1.0); } for (const [dx, dz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]]) G(parts, '#333a44', new THREE.CylinderGeometry(0.36, 0.36, 0.2, 10).rotateZ(Math.PI / 2), dx, 0.42, dz); flush(parts, g); root.add(g); cars.push(g); }
    W2rail = { at, LEN }; tickers.push((dt, t) => { const s0 = t * 5.5; cars.forEach((g, k) => { const [x, z, a] = at(s0 - k * 3.9); g.position.set(x, Math.max(0.2, hAt(x, z)) + 0.08, z); g.rotation.y = a; }); }); }
  var W2rail;
  /* 港口的船：五艘停在棧橋邊跟著浪晃，兩艘在外面的航道上慢慢開（作者：「看著船開來開去也很療癒」） */
  { const boat = (hex, s) => { const g = new THREE.Group(), parts = {}; G(parts, '#ffffff', new THREE.CylinderGeometry(1, 0.72, 0.9, 10, 1).scale(1, 1, 2.6), 0, 0.25, 0); G(parts, hex, new THREE.CylinderGeometry(1.04, 1.04, 0.18, 10, 1).scale(1, 1, 2.62), 0, 0.72, 0); B(parts, '#f7efe1', 1.3, 0.9, 1.6, 0, 1.2, -0.5); B(parts, hex, 1.5, 0.14, 1.8, 0, 1.72, -0.5); B(parts, '#8bb6e6', 1.32, 0.4, 0.06, 0, 1.28, 0.31); flush(parts, g); g.scale.setScalar(s); root.add(g); return g; };
    const moored = [[-170, 60, '#2c6fb5', 1.0], [-90, 95, '#c0392b', 1.25], [0, 118, '#2c6fb5', 1.15], [90, 95, '#f0a02a', 1.2], [170, 62, '#3fbf9d', 0.95]].map(([dx, dy, hex, s], i) => { const [x, z] = P(990 + dx + (i % 2 ? 22 : -22), 835 + dy), g = boat(hex, s); g.position.set(x, WL, z); g.rotation.y = i % 2 ? 0.08 : -0.06; return { g, x, z, ph: i * 1.7 }; });
    const lanes = [curve([[620,960],[820,1010],[1060,1000],[1250,1040],[1420,960],[1330,900],[1060,930],[800,930]], true), curve([[1690,880],[1760,640],[1750,420],[1690,300],[1730,520],[1700,760]], true)];
    const sail = lanes.map((L, k) => { const cum = [0]; for (let i = 1; i <= L.length; i++){ const a = L[i - 1], b = L[i % L.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return { L, cum, g: boat(k ? '#a46ad8' : '#3fbf9d', 1.3), sp: k ? 2.2 : 2.8 }; });
    tickers.push((dt, t) => { for (const m of moored){ m.g.position.y = WL - 0.12 + Math.sin(t * 1.1 + m.ph) * 0.06; m.g.rotation.z = Math.sin(t * 0.9 + m.ph) * 0.04; m.g.rotation.x = Math.sin(t * 0.7 + m.ph * 2) * 0.025; }
      for (const b of sail){ const LEN = b.cum[b.cum.length - 1], s = (t * b.sp) % LEN; let lo = 0, hi = b.cum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (b.cum[m] <= s) lo = m; else hi = m; } const p0 = b.L[lo], p1 = b.L[(lo + 1) % b.L.length], k = (s - b.cum[lo]) / Math.max(1e-6, b.cum[lo + 1] - b.cum[lo]);
        b.g.position.set(p0[0] + (p1[0] - p0[0]) * k, WL - 0.1 + Math.sin(t * 1.3) * 0.05, p0[1] + (p1[1] - p0[1]) * k); const a = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]); let d = a - b.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); b.g.rotation.y += d * Math.min(1, dt * 1.5); b.g.rotation.z = Math.sin(t * 1.1) * 0.03; } }); }
  /* 瀑布：從山上流進湖裡，水一直往下流 */
  { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#bfeaf6'; c.fillRect(0, 0, 64, 128); let s0 = 9; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; }; for (let i = 0; i < 70; i++){ c.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`; c.fillRect(r() * 64, r() * 128, 2 + r() * 3, 14 + r() * 26); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    const a = P(785, 128), b = P(785, 192), n = 14, pos = [], uv = [], idx = []; let len = 0, py = 0, pz = 0;
    for (let i = 0; i <= n; i++){ const k = i / n, x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k), y = Math.max(WL + 0.02, hAt(x, z)) + 0.12; if (i) len += Math.hypot(y - py, z - pz); py = y; pz = z; pos.push(x - 1.3, y, z, x + 1.3, y, z); uv.push(0, -len / 5, 1, -len / 5); if (i < n){ const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.92, side: THREE.DoubleSide })); root.add(m); tickers.push((dt, t) => { tx.offset.y = t * 0.9; }); }

  /* ---------- 給遊戲用的接口 ---------- */
  const W2 = {
    ox: OX, oz: OZ, spawn: [OX + P(975, 560)[0], OZ + P(975, 560)[1]],
    near: (x, z) => z > OZ + Z0 - 30 && z < OZ + Z0 + GH + 30 && x > OX + X0 - 30 && x < OX + X0 + GW + 30,
    h: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz)) return -3.2; const d = deck(lx, lz); if (d) return d[5] ? lerp(Math.max(0.2, samp(HG, lx, lz)), d[4], clamp(Math.min(lz - d[2], d[3] - lz) / d[5], 0, 1)) : d[4]; if (onBoard(lx, lz)) return boardY(lx, lz) + 0.02; const h = samp(HG, lx, lz); return paved(lx, lz, 0.2) && h > 0.2 ? Math.max(h, PAVE_Y + 0.02) : h; },
    land: (x, z) => { const lx = x - OX, lz = z - OZ; return inBox(lx, lz) && (samp(HG, lx, lz) > WL - 0.02 || !!deck(lx, lz) || onBoard(lx, lz)); },
    walk: (x, z) => { const lx = x - OX, lz = z - OZ; return inBox(lx, lz) && (samp(HG, lx, lz) > WL - 0.05 || !!deck(lx, lz) || onBoard(lx, lz)); },
    tick: (dt, t) => { const here = W2.near(me.pos.x, me.pos.z) || W2.near(camera.position.x, camera.position.z);
      if (here !== inside){ inside = here; root.visible = here; if (here) A.setWaterMask(maskTex, OX + X0 + GW / 2, OZ + Z0 + GH / 2, GW, GH); else { A.setWaterMask(null); for (const k of [...chunks.keys()]) dropChunk(k); } }
      if (!here) return;
      chunkTick(camera.position.x - OX, camera.position.z - OZ, false); waterSurface.position.x = Math.round(camera.position.x / 16) * 16; waterSurface.position.z = Math.round(camera.position.z / 16) * 16;
      if (labelsOn) for (const sp of labels){ const u = sp.userData, d = Math.hypot(camera.position.x - OX - sp.position.x, camera.position.y - sp.position.y, camera.position.z - OZ - sp.position.z), k = clamp(d / 55, 1, 4.2); sp.visible = !(u.st && d > 150); sp.scale.set(u.w * k, u.h * k, 1); }
      for (const f of tickers) f(dt, t); },
    warm: (x, z) => chunkTick(x - OX, z - OZ, true),
    info: () => ({ chunks: chunks.size, tris: (() => { let n = 0; root.traverse(o => { if (o.isMesh && o.geometry){ const g = o.geometry, c = (g.index ? g.index.count : g.attributes.position.count) / 3; n += o.isInstancedMesh ? c * o.count : c; } }); return Math.round(n); })(), labels: labels.length, cols: colliders.length }),
    labels: on => { labelsOn = on; for (const sp of labels) sp.visible = on; },
    view: v => { VIEW = v; },   /* 拍全島的時候用：多遠以內的地都蓋 */
    board: boardLine, rail: railLine,   /* 測試用：木棧道、鐵軌的中心線（島上的公尺） */
    /* 預覽用：一按就過去的地點（島上的公尺） */
    spots: [['主城廣場', 975, 560], ['村公所', 965, 372], ['港口', 990, 822], ['商店街', 985, 690], ['博物館', 840, 608], ['水族館', 700, 400], ['紅樹林', 446, 390], ['居民區', 482, 580], ['森林步道', 696, 262], ['瀑布', 822, 190], ['遊樂園', 1215, 352], ['體育場', 1352, 449], ['玩家建地', 1310, 535], ['中央市場', 1105, 582], ['沙灘', 1490, 715]].map(([n, px, py]) => [n, ...P(px, py)]),
  };
  root.visible = false;
  return W2;
}
