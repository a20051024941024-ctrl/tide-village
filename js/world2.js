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
  /* v920 固定的活動場地（作者 11/27：「就先固定」）：商店街東邊、市場南邊、港口北邊那一塊，不蓋房子，辦活動用。北邊跟市場的前廣場連在一起，南邊接港邊木棧道 */
  const EVT = rough([[1040,702],[1076,672],[1150,676],[1190,712],[1182,764],[1120,790],[1054,772]], 2, 0.12, 733), EVT_C = [1112, 730];
  const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const PL = [965, 505], RING = [215, 150];
  const NODES = { hall:[965,320,240,120], aqua:[640,410,210,130], mus:[775,662,170,100], amuse:[1255,325,270,160], stad:[1480,430,240,130], mkt:[1210,640,230,140] };   /* v919 水族館往南 2 公尺（圓頂放正中間還要離鐵軌遠一點）、市場的廣場放大（建築放正中間四周才有地方走） */
  const edgeP = (n, t) => { const [x, y, w, h] = n, dx = t[0] - x, dy = t[1] - y, k = Math.min((w / 2) / Math.abs(dx || 1e-6), (h / 2) / Math.abs(dy || 1e-6)); return [x + dx * k, y + dy * k]; };
  /* 路：[點, 寬（圖上的像素）, 種類]。stone＝石板大道、lane＝巷子、wood＝港邊木棧道 */
  const ROADS = [
    [[[965,545],[975,600],[985,700],[990,800]], 26, 'stone'],                                      // 廣場 → 商店街 → 港口
    [[[640,760],[800,820],[990,830],[1160,790]], 22, 'wood'],                                      // 港邊
    ...Object.values(NODES).map(n => [[PL, edgeP(n, PL)], 24, 'stone']),                          // 圓環 → 每棟大建築的前廣場（直直的大道）
    [[[752,535],[700,588]], 16, 'stone'], [[[1178,520],[1205,540]], 16, 'stone'],
    /* v919 作者：「有些路都沒連過去」→ 市場接到沙灘、每個車站接到最近的廣場或巷子、建地區的巷子接到市場和體育場大道 */
    ...[[[1308,668],[1332,722],[1306,770]], [[1430,575],[1438,632]], [[1596,442],[1612,462]], [[1252,232],[1255,250]], [[1080,240],[1080,272]], [[560,340],[578,364]], [[300,530],[285,556]], [[768,800],[772,716]], [[1213,790],[1210,712]], [[1320,625],[1314,650]], [[1300,470],[1298,452]]].map(L => [L, 11, 'lane']),
    ...[[[280,556],[700,588]], [[290,601],[710,633]], [[280,556],[300,690]], [[480,568],[488,690]], [[690,588],[695,660]]].map(L => [L, 11, 'lane']),   // 居民區的巷子
    [[[1205,540],[1310,535],[1430,575]], 12, 'lane'], [[[1300,470],[1310,535],[1320,625]], 12, 'lane'],                                              // 玩家建地區的十字巷
  ];
  const TRAILS = [[[700,283],[684,240],[640,205]], [[934,272],[930,244],[918,210],[870,186],[822,190]], [[440,390],[380,400],[300,395],[240,370],[200,345]], [[700,319],[700,362]], [[540,402],[490,398],[440,390]]];   // 0、1 森林步道；2 紅樹林木棧道；3 過河小橋接到水族館；4 水族館接到木棧道
  const RAIL = [[1160,810],[1300,780],[1420,640],[1560,560],[1610,470],[1620,380],[1500,300],[1360,235],[1250,222],[1080,230],[900,270],[700,330],[560,330],[430,430],[320,470],[260,560],[330,700],[480,740],[640,780],[820,830],[1000,840]];
  const STA = [[1300,780,'沙灘'],[1440,640,'玩家建地'],[1618,470,'體育場'],[1250,222,'遊樂園'],[1080,230,'森林'],[965,256,'村公所'],[560,330,'水族館'],[300,520,'紅樹林・居民區'],[760,808,'博物館'],[990,840,'港口'],[1215,800,'中央市場']];

  /* ---------- 畫進資料格 ---------- */
  const fillL = polys => { const L = layer(); for (const p of polys){ closed(L.g, p); L.g.fill(); } return L; };
  const landL = fillL([IS, ISLET, ...SHOALS]), sdLand = sdf(bits(landL));
  const sdMain = sdf(bits(fillL([IS])));
  const sdFor = sdf(bits(fillL([FO]))), sdSand = sdf(bits(fillL([SAND]))), sdMang = sdf(bits(fillL([MF])));
  const watL = fillL([LAKE]); { const g = watL.g; open(g, RIV); g.lineWidth = 17; g.stroke(); } const sdWat = sdf(bits(watL));
  const paveL = layer(); { const g = paveL.g; closed(g, PLAZA); g.fill(); closed(g, EVT); g.fill(); g.beginPath(); g.ellipse(PL[0], PL[1], RING[0], RING[1], 0, 0, 7); g.lineWidth = 24; g.stroke();
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
  flatShape('lane', curve(EVT, true), PAVE_Y + 0.006);                                                         // 活動場地
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
  const tickers = [], labels = []; let labelsOn = true; const seats = [], doors = []; let bbInfo = null;   /* seats：看板前面可以坐的位置（世界座標）；bbInfo：高看板的螢幕 */
  function label(txt, lx, y, lz, s){ const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.font = 'bold 64px sans-serif'; const tw = Math.min(480, c.measureText(txt).width + 56); c.fillStyle = 'rgba(24,51,74,.88)'; c.beginPath(); c.roundRect(256 - tw / 2, 16, tw, 96, 26); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 256, 66, 440);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.material.map.colorSpace = THREE.SRGBColorSpace; sp.userData.w = 10 * (s || 1); sp.userData.h = 2.5 * (s || 1); sp.scale.set(sp.userData.w, sp.userData.h, 1); sp.position.set(lx, y, lz); sp.renderOrder = 9; root.add(sp); labels.push(sp); return sp; }
  const town = new THREE.Group(); root.add(town);
  /* v919 作者：「為什麼島嶼不能設計的精美」→ 房子不再用積木：民宅、店面、博物館、市場、村公所先用村子現在那一套做法（game.js 的 tw*），
     攤子、石燈籠、推車、水井、牌樓用村子的模型（models/art2）。水族館、體育場、遊樂設施還沒有模型，先留著，等作者生圖轉 3D 再換 */
  const TWB = A.tw || null, twRoot = new THREE.Group(); town.add(twRoot);
  { const parts = {}, WALL = '#f3ecdc', BLUE = '#3b5fb3', RED = '#d9393b';
    /* 主城廣場：高高的大看板（作者：「看板能做高然後玩家們能聚在那裡看，就像看煙火一樣」）。
       兩座小燈塔撐著一面 20 公尺寬的螢幕，螢幕底離地 10 公尺，下面可以走過去；節目跟村子的潮汐大看板是同一份（game.js 的 BB） */
    { const [x, z] = P(975, 440), SW = 20, SH = SW * 9 / 16, CH = SW * 0.1, Y0 = 10.2, YC = Y0 + SH / 2, NAVY = '#1f2a3a', PX = SW / 2 + 1.7, zb = z - 0.3;
      B(parts, NAVY, SW + 0.9, SH + CH + 0.9, 0.5, x, Y0 - CH + (SH + CH) / 2, zb);                                           // 螢幕背板
      B(parts, BLUE, PX * 2 + 0.6, 0.55, 0.7, x, Y0 - CH - 0.75, zb); B(parts, BLUE, PX * 2 + 0.6, 0.45, 0.7, x, Y0 + SH + 0.7, zb);   // 上下兩根橫樑
      for (const sg of [-1, 1]){ const px = x + sg * PX;                                                                     // 兩座小燈塔
        B(parts, '#d9cfb8', 2.6, 1.2, 2.6, px, 0.6, zb); G(parts, '#f7f1e3', new THREE.CylinderGeometry(0.78, 1.08, 21.4, 10), px, 11.9, zb);
        for (const by of [5.2, 11.4, 17.6]){ const r = 0.78 + (22.6 - by) * 0.014 + 0.05; G(parts, BLUE, new THREE.CylinderGeometry(r - 0.008, r + 0.008, 1.1, 10), px, by, zb); }
        G(parts, '#333a44', new THREE.CylinderGeometry(1.25, 1.25, 0.28, 10), px, 22.74, zb); G(parts, '#ffe5a4', new THREE.CylinderGeometry(0.72, 0.72, 1.3, 10), px, 23.5, zb); G(parts, BLUE, new THREE.ConeGeometry(1.2, 1.5, 10), px, 24.9, zb); G(parts, '#f7f1e3', new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), px, 26.8, zb);
        G(parts, '#3a4658', new THREE.BoxGeometry(4.4, 0.3, 0.3).rotateZ(-sg * 0.78), px - sg * 2.3, Y0 - CH - 2.6, zb);     // 橫樑下面的斜撐
        colliders.push({ t: 'c', x: OX + px, z: OZ + zb, r: 1.5, big: true });
        const fl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.04).translate(0.75, 0, 0), mat(sg < 0 ? '#e2574c' : '#f2c230', 0.8)); fl.position.set(px, 27.5, zb); town.add(fl); tickers.push((dt, t) => { fl.rotation.y = 0.6 + Math.sin(t * 2.1 + sg) * 0.35 + Math.sin(t * 5.3 + sg * 2) * 0.08; }); }   // 塔頂的旗子會飄
      /* 螢幕和字幕條：平常是這張字卡；走近以後 game.js 會把節目接上來 */
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576; { const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 576); gr.addColorStop(0, '#1d6aa8'); gr.addColorStop(1, '#0f2a44'); c.fillStyle = gr; c.fillRect(0, 0, 1024, 576); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 110px sans-serif'; c.fillText('潮汐大看板', 512, 250); c.font = 'bold 44px sans-serif'; c.fillStyle = '#ffd34a'; c.fillText('大家坐下來一起看', 512, 380); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); scr.position.set(x, YC, z); town.add(scr);
      const cc = document.createElement('canvas'); cc.width = 640; cc.height = 64; { const c = cc.getContext('2d'); c.fillStyle = '#10161e'; c.fillRect(0, 0, 640, 64); c.fillStyle = '#ffd34a'; c.font = 'bold 30px sans-serif'; c.textBaseline = 'middle'; c.fillText('📺 潮汐大看板', 16, 33); }
      const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; const cap = new THREE.Mesh(new THREE.PlaneGeometry(SW, CH), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false })); cap.position.set(x, Y0 - CH / 2 - 0.02, z + 0.001); town.add(cap);
      bbInfo = { x: OX + x, z: OZ + z, y: YC, h: SH, scr, cap, live: false };
      /* 螢幕四周一圈燈泡，兩組輪流亮（跑馬燈） */
      { const bulbs = [[], []], g0 = new THREE.SphereGeometry(0.17, 6, 4), xl = x - SW / 2 - 0.25, xr = x + SW / 2 + 0.25, yb = Y0 - CH - 0.25, yt = Y0 + SH + 0.25; let n = 0;
        const put = (bx, by) => { bulbs[n++ % 2].push(g0.clone().translate(bx, by, z + 0.06)); };
        for (let i = 0; i <= 20; i++){ put(xl + (xr - xl) * i / 20, yt); put(xl + (xr - xl) * i / 20, yb); } for (let i = 1; i < 13; i++){ put(xl, yb + (yt - yb) * i / 13); put(xr, yb + (yt - yb) * i / 13); }
        const ms = bulbs.map(L => { const m = new THREE.Mesh(mergeGeometries(L.map(g => g.index ? g.toNonIndexed() : g), false), new THREE.MeshBasicMaterial({ color: '#ffe9a8', toneMapped: false })); town.add(m); return m; });
        tickers.push((dt, t) => { const k = Math.floor(t * 1.6) % 2; ms[0].material.color.set(k ? '#fff3c4' : '#8a6a2c'); ms[1].material.color.set(k ? '#8a6a2c' : '#fff3c4'); }); }
      /* 最上面的招牌 */
      { const sc = document.createElement('canvas'); sc.width = 512; sc.height = 112; const c = sc.getContext('2d'); c.fillStyle = '#fff6e0'; c.fillRect(0, 0, 512, 112); c.strokeStyle = '#3b5fb3'; c.lineWidth = 10; c.strokeRect(5, 5, 502, 102); c.fillStyle = '#18334a'; c.font = 'bold 68px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('潮汐大看板', 256, 60);
        const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.75), new THREE.MeshBasicMaterial({ map: st, toneMapped: false })); sign.position.set(x, Y0 + SH + 2.0, z + 0.06); town.add(sign); B(parts, BLUE, 8.5, 2.2, 0.4, x, Y0 + SH + 2.0, zb); }
      RSV.push([x - PX, z, 5], [x + PX, z, 5], [x, z, 7]); label('主城廣場・大看板', x, 30, z);
      /* 噴水池：中間一道、旁邊六道水柱，高高低低地噴 */
      const [fx, fz] = P(975, 520); G(parts, '#dfe7ee', new THREE.CylinderGeometry(3.4, 3.6, 0.5, 24), fx, 0.55, fz); G(parts, '#7fd3ef66', new THREE.CylinderGeometry(3.1, 3.1, 0.12, 24), fx, 0.78, fz); G(parts, '#dfe7ee', new THREE.CylinderGeometry(0.35, 0.5, 1.5, 10), fx, 1.3, fz); G(parts, '#dfe7ee', new THREE.CylinderGeometry(1.1, 0.5, 0.25, 14), fx, 2.1, fz);
      { const jm = new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.72, depthWrite: false }), mid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.17, 2.4, 6).translate(0, 1.2, 0), jm); mid.position.set(fx, 2.2, fz); town.add(mid);
        const ring = new THREE.Mesh(mergeGeometries([0, 1, 2, 3, 4, 5].map(i => new THREE.CylinderGeometry(0.03, 0.1, 1.3, 5).translate(0, 0.65, 0).rotateZ(-0.35).translate(2.2, 0, 0).rotateY(i * 1.0472).toNonIndexed()), false), jm); ring.position.set(fx, 0.82, fz); town.add(ring);
        tickers.push((dt, t) => { mid.scale.y = 0.75 + Math.sin(t * 1.3) * 0.25 + Math.sin(t * 7.1) * 0.03; ring.scale.y = 0.8 + Math.sin(t * 1.3 + 2.1) * 0.3; }); }
      colliders.push({ t: 'c', x: OX + fx, z: OZ + fz, r: 3.6, big: true }); RSV.push([fx, fz, 6]);
      /* 看板前面的長椅：三排弧形，中間留給噴水池和大道。坐下去鏡頭會抬頭看螢幕 */
      const SEAT_Y = PAVE_Y + 0.34;
      for (const [R0, a0, a1] of [[15, 0.37, 0.62], [19.5, 0.26, 0.66], [24, 0.27, 0.62]]) for (const sg of [-1, 1]){ const arc = R0 * (a1 - a0), nb = Math.max(1, Math.round(arc / 3.5));
        for (let i = 0; i < nb; i++){ const a = sg * (a0 + (i + 0.5) / nb * (a1 - a0)), bx = x + Math.sin(a) * R0, bz = z + Math.cos(a) * R0, face = Math.atan2(x - bx, z - bz), c = Math.cos(face), sn = Math.sin(face), len = Math.min(3.1, arc / nb - 0.5);
          if (!paved(bx, bz, -0.6)) continue;
          B(parts, '#b98a5a', len, 0.1, 0.52, bx, SEAT_Y - 0.05, bz, face); B(parts, '#8a6038', len - 0.3, 0.08, 0.08, bx, SEAT_Y - 0.24, bz, face); for (const o of [-(len / 2 - 0.3), len / 2 - 0.3]) B(parts, '#3a3f47', 0.1, 0.3, 0.46, bx + c * o, PAVE_Y + 0.15, bz - sn * o, face);
          const ns = Math.max(1, Math.floor(len / 0.72)); for (let k = 0; k < ns; k++){ const o = (k - (ns - 1) / 2) * 0.72; seats.push({ x: OX + bx + c * o, z: OZ + bz - sn * o, y: SEAT_Y, face }); }
          colliders.push({ t: 'o', x: OX + bx, z: OZ + bz, hw: len / 2, hd: 0.26, c, s: sn, bw: Math.abs(c) * len / 2 + Math.abs(sn) * 0.26, bd: Math.abs(sn) * len / 2 + Math.abs(c) * 0.26 }); } } }
    /* 村公所・鐘樓 */
    { const [x, z] = P(965, 314);
      if (TWB){ const g = new THREE.Group(); g.position.set(x, PAVE_Y, z); g.scale.setScalar(2); twRoot.add(g); TWB.office(g, { w: 10, d: 5, front: 2.5 });   /* 村長辦公室那棟放大兩倍：20×10 公尺、兩層樓，前面有門廊 */
        B(parts, WALL, 4.6, 9, 4.6, x, 13, z - 1.6); B(parts, '#e9dfc8', 5.2, 0.5, 5.2, x, 17.4, z - 1.6); G(parts, BLUE, new THREE.ConeGeometry(4.0, 4.6, 4).rotateY(Math.PI / 4), x, 19.9, z - 1.6); G(parts, '#f2c230', new THREE.SphereGeometry(0.3, 8, 6), x, 22.4, z - 1.6);   /* 鐘樓從屋頂後面伸出來 */
        for (const sg of [1, -1]){ const fz = z - 1.6 + sg * 2.33; G(parts, '#ffffff', new THREE.CylinderGeometry(1.55, 1.55, 0.12, 24).rotateX(Math.PI / 2), x, 14.6, fz); G(parts, '#18334a', new THREE.TorusGeometry(1.55, 0.09, 6, 28), x, 14.6, fz + sg * 0.05);
          const hh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.05).translate(0, 0.36, 0), mat('#18334a', 0.6)), mh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.05).translate(0, 0.55, 0), mat('#18334a', 0.6)); for (const h of [hh, mh]){ h.position.set(x, 14.6, fz + sg * 0.1); town.add(h); }
          tickers.push(() => { const hr = A.DayNight && A.DayNight.hour != null ? A.DayNight.hour : 10; hh.rotation.z = -sg * (hr % 12) / 12 * 6.2832; mh.rotation.z = -sg * (hr % 1) * 6.2832; }); }   /* 鐘面的指針照遊戲時間走 */
        colliders.push({ t: 'b', x: OX + x, z: OZ + z + 0.8, hw: 10.3, hd: 6.3, big: true }); RSV.push([x - 6, z, 9], [x + 6, z, 9]); label('村公所・鐘樓', x, 25, z); }
      else { B(parts, WALL, 34, 5.2, 9, x, 2.9, z); B(parts, BLUE, 35.4, 0.9, 10.4, x, 5.9, z); B(parts, WALL, 5, 13, 5, x, 6.8, z - 1.5); G(parts, BLUE, new THREE.ConeGeometry(4.3, 4.4, 4).rotateY(Math.PI / 4), x, 15.5, z - 1.5); G(parts, '#ffffff', new THREE.CylinderGeometry(1.5, 1.5, 0.2, 20).rotateX(Math.PI / 2), x, 11.2, z + 1.05);
        for (let i = 0; i < 6; i++) B(parts, '#8bb6e6', 2.4, 2.6, 0.2, x - 14 + i * 5.6, 3, z + 4.55); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 17.2, hd: 4.8, big: true }); RSV.push([x - 9, z, 12], [x + 9, z, 12]); label('村公所・鐘樓', x, 20, z); } }
    /* 水族館（圓頂） */
    { const [x, z] = P(640, 410); G(parts, '#bfe8f5', new THREE.CylinderGeometry(11.2, 11.8, 2.4, 36), x, 1.5, z); G(parts, '#2f86c9', new THREE.SphereGeometry(10.2, 28, 12, 0, 6.2832, 0, Math.PI / 2).scale(1, 0.62, 1), x, 2.7, z); G(parts, '#7fd8f5aa', new THREE.SphereGeometry(6.6, 20, 8, 0, 6.2832, 0, Math.PI / 2).scale(1, 0.75, 1), x, 4.9, z);
      B(parts, '#bfe8f5', 5.2, 3.4, 2.4, x + 11.6, 2.0, z); B(parts, '#2f86c9', 5.8, 0.4, 3, x + 11.6, 3.9, z); B(parts, '#8bd0f0', 0.2, 2.4, 1.5, x + 14.25, 1.6, z);   /* 朝廣場那一面的入口 */
      colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 11.7, big: true }, { t: 'b', x: OX + x + 11.6, z: OZ + z, hw: 2.7, hd: 1.3, big: true }); RSV.push([x, z, 14], [x + 12, z, 5]); label('水族館', x, 13, z); }
    /* 博物館 */
    { const [x, z] = P(775, 650);   /* 放在拱形前廣場的正中間 */
      if (TWB){ const g = new THREE.Group(); g.position.set(x, PAVE_Y, z); g.rotation.y = Math.PI; g.scale.setScalar(2.3); twRoot.add(g); TWB.museum(g);   /* 村子那棟博物館放大，正面朝北邊的前廣場 */
        colliders.push({ t: 'b', x: OX + x, z: OZ + z + 0.9, hw: 8.1, hd: 6.1, big: true }); RSV.push([x - 4, z + 1, 9], [x + 4, z + 1, 9]); label('博物館', x, 12, z + 1); }
      else { B(parts, '#e9e1cf', 24, 6.4, 12, x, 3.5, z); G(parts, '#7c8fb0', roofG(26, 13.4, 3.6), x, 6.7, z); for (let i = 0; i < 6; i++) G(parts, '#ffffff', new THREE.CylinderGeometry(0.5, 0.56, 5.6, 10), x - 10 + i * 4, 3.1, z + 6.7); B(parts, '#d9cfb8', 25, 0.5, 3.4, x, 0.55, z + 7.2);
        colliders.push({ t: 'b', x: OX + x, z: OZ + z + 0.6, hw: 12.2, hd: 7.4, big: true }); RSV.push([x - 6, z, 11], [x + 6, z, 11]); label('博物館', x, 14, z); } }
    /* 體育場 */
    { const [x, z] = P(1480, 430), n = 28; for (let i = 0; i < n; i++){ const a = i / n * 6.2832, ca = Math.cos(a), sa = Math.sin(a); for (let k = 0; k < 3; k++) B(parts, k === 2 ? '#dfe6ef' : '#3d66b5', 4.6, 1.3 + k * 1.3, 2.1, x + ca * (19 + k * 2.1), 0.9 + k * 0.65, z + sa * (9.5 + k * 2.1), Math.atan2(-9.5 * ca, -19 * sa)); }
      G(parts, '#d8584a', new THREE.CylinderGeometry(1, 1, 0.1, 36).scale(16.5, 1, 7.4), x, 0.5, z); G(parts, '#4fae55', new THREE.CylinderGeometry(1, 1, 0.1, 36).scale(12.5, 1, 4.6), x, 0.56, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 9, big: true }, { t: 'c', x: OX + x - 13, z: OZ + z, r: 9.5, big: true }, { t: 'c', x: OX + x + 13, z: OZ + z, r: 9.5, big: true }); RSV.push([x - 12, z, 14], [x + 12, z, 14], [x, z, 14]); label('體育場', x, 11, z); }
    /* 中央市場 */
    { const [x, z] = P(1210, 640);   /* 圓形前廣場的正中間 */
      if (TWB){ const g = new THREE.Group(); g.position.set(x, PAVE_Y, z); g.rotation.y = Math.PI; g.scale.setScalar(1.5); twRoot.add(g); TWB.market(g, { w: 15, d: 7.4, front: 3.7 }); }   /* 村子魚市場的樣子，拉長、放大，正面朝前廣場 */
      else { B(parts, '#f0e6d0', 24, 5, 11, x, 2.8, z); B(parts, '#2c6fb5', 25.4, 1.6, 12.4, x, 5.9, z); ['#e2574c', '#f0a02a', '#4bb57b', '#3c8fd8', '#a46ad8'].forEach((c, i) => B(parts, c, 3.6, 0.2, 2.2, x - 9.2 + i * 4.6, 3.3, z + 6.4)); }
      colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 11.6, hd: 5.9, big: true }); RSV.push([x - 6, z, 11], [x + 6, z, 11]); label('中央市場', x, 12, z); }
    /* 燈塔（港口外的小岩島） */
    { const [x, z] = P(655, 815), y = Math.max(0.3, hAt(x, z)); G(parts, '#ffffff', new THREE.CylinderGeometry(1.5, 2.3, 11, 14), x, y + 5.5, z); for (let i = 0; i < 3; i++) G(parts, RED, new THREE.CylinderGeometry(1.62 + (2 - i) * 0.25, 1.78 + (2 - i) * 0.25, 1.5, 14), x, y + 2.6 + i * 3.1, z); G(parts, '#333a44', new THREE.CylinderGeometry(1.9, 1.9, 0.3, 14), x, y + 11.1, z); G(parts, '#ffe5a4', new THREE.CylinderGeometry(1.1, 1.1, 1.5, 10), x, y + 12, z); G(parts, RED, new THREE.ConeGeometry(1.7, 1.6, 12), x, y + 13.5, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 2.4, big: true }); RSV.push([x, z, 5]); label('燈塔', x, 17.5, z, 0.8); }
    /* 港口碼頭：五條棧橋 */
    for (const [dx, len] of [[-170, 90], [-90, 120], [0, 140], [90, 120], [170, 90]]){ const [x, z0] = P(990 + dx, 835), L = len * S; B(parts, '#b98a5a', 3.4, 0.3, L, x, 0.5, z0 + L / 2); DECKS.push([x - 1.7, x + 1.7, z0 - 2, z0 + L, 0.65]); for (let k = 0; k <= L; k += 4){ B(parts, '#7a5530', 0.4, 2.4, 0.4, x - 1.5, -0.5, z0 + k); B(parts, '#7a5530', 0.4, 2.4, 0.4, x + 1.5, -0.5, z0 + k); } }
    { const [x, z] = P(990, 880); label('港口碼頭', x, 8, z); }
    /* 居民區、商店街、玩家建地：小房子（之後換成真的房子模型） */
    const ROOF = ['#c0583a', '#4a6fb5', '#7a5aa0', '#d08a2a', '#3e8f86', '#e2574c', '#3c8fd8', '#4bb57b'];
    /* 民宅＝三層樓透天和兩層街屋輪流；商店街＝一樓是店面的街屋，每四間一間小木屋店。門都朝著路 */
    const PASTEL = ['#f2b6c0', '#f4d9a0', '#c7e3c0', '#f6c9a8', '#b9d9ee'], COTK = ['cloth', 'hair', 'wood', 'art']; let hN = 0;
    const house = (px, py, w, d, roof, ry, kind) => { const [x, z] = P(px, py); if (paved(x, z, 1.2) || samp(sdLand, x, z) < 4 || hAt(x, z) < 0.2) return; const q = Math.abs(Math.sin(ry || 0)) > 0.7;
      /* 作者 11/27：「其實原本的房子還可以」→ 民宅和店面用村子現在那一套街屋（民宅＝三層樓透天和兩層街屋輪流；商店街一樓是店面，每四間一間小木屋店） */
      if (TWB){ const g = new THREE.Group(), sd = hN++; g.position.set(x, Math.max(0.2, hAt(x, z)), z); g.rotation.y = ry || 0; twRoot.add(g);
        if (kind === 'shop' && sd % 4 === 1) TWB.cottage(g, { w: w - 0.4, d, front: d / 2, kind: COTK[(sd >> 2) % 4] });
        else { const sub = new THREE.Group(), S = 1.34; sub.scale.setScalar(S); g.add(sub); TWB.house(sub, kind === 'shop' ? { w: w / S, d: d / S, fl: 2 + (sd % 3 === 0 ? 1 : 0), front: d / 2 / S, seed: sd * 7 + 1, kind: 'shop' } : { w: w / S, d: d / S, fl: sd % 2 ? 3 : 2, front: d / 2 / S, seed: sd * 5 + 2, kind: 'home', wall: HWALL[roof] || PASTEL[sd % 5] }); } }
      else { B(parts, '#f7efe1', w, 2.9, d, x, 1.75, z, ry); const g = roofG(w + 0.5, d + 0.7, 1.7); if (ry) g.rotateY(ry); G(parts, roof, g, x, 3.2, z); }
      colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: (q ? d : w) / 2 + 0.1, hd: (q ? w : d) / 2 + 0.1 }); RSV.push([x, z, Math.max(w, d) * 0.75]); };
    /* 規劃圖上的每一棟房子（作者 11/27 說規劃圖「就很好」→ 位置照圖，一棟不少）：[中心 x, 中心 y, 大小, 屋頂顏色, 是不是店]。門朝最近的路 */
    const HS = [[315,531,0,6,0],[367,535,0,2,0],[419,539,0,4,0],[523,547,0,1,0],[575,551,0,6,0],[627,555,0,2,0],[335,576,0,2,0],[387,580,0,4,0],[439,584,0,7,0],[543,592,0,6,0],[595,596,0,2,0],[647,600,0,4,0],[355,621,0,4,0],[407,625,0,7,0],[459,629,0,1,0],[511,633,0,6,0],[563,637,0,2,0],[615,641,0,4,0],[667,645,0,7,0],[1159,655,0,3,1],[1193,609,0,9,1],[1193,669,0,5,1],[1227,623,0,3,1],[1227,683,0,8,1],[1261,637,0,5,1],[1261,697,0,0,1],[1295,711,0,9,1],[949,611,0,0,1],[1021,611,0,0,1],[949,643,0,9,1],[1021,643,0,9,1],[949,675,0,3,1],[1021,675,0,3,1],[949,707,0,5,1],[1021,707,0,5,1],[949,739,0,8,1],[1021,739,0,8,1],[949,771,0,0,1],[1021,771,0,0,1],[1238,510,2,8,0],[1268,510,2,0,0],[1238,568,2,3,0],[1268,568,2,9,0],[1348,502,2,5,0],[468,456,1,8,1],[501,456,1,0,1],[463,495,1,8,0],[507,494,1,5,0],[540,490,1,9,0],[582,495,1,6,0],[618,491,1,2,1],[655,495,1,2,0],[694,493,1,5,1],[656,525,1,8,1],[692,527,1,9,0],[809,524,1,9,1],[1494,526,1,8,1],[1488,560,1,8,1],[695,626,1,2,0],[508,695,1,9,0],[578,698,1,0,0],[618,694,1,5,1],[653,698,1,5,0],[923,696,1,3,0],[658,729,1,3,0],[696,729,1,3,0],[886,728,1,3,0],[1076,730,1,0,0],[1111,728,1,0,0],[1147,728,1,9,0],[1226,728,1,8,1],[1265,732,1,7,1],[810,764,1,6,0],[846,766,1,5,0],[880,765,1,3,0],[922,764,1,2,1],[1070,763,1,3,1],[1110,765,1,0,1],[1185,763,1,9,1],[1226,763,1,7,0]];
    const HCOL = ["#3c8fd8", "#3e8f86", "#4a6fb5", "#4bb57b", "#7a5aa0", "#a46ad8", "#c0583a", "#d08a2a", "#e2574c", "#f0a02a"], HWALL = { '#e2574c': '#f2b3a6', '#3c8fd8': '#b9d9ee', '#f0a02a': '#f4d9a0', '#4bb57b': '#c7e3c0', '#a46ad8': '#d9c7ee', '#c0583a': '#f6c9a8', '#4a6fb5': '#bcd0f0', '#d08a2a': '#f3d98a', '#7a5aa0': '#dccbee', '#3e8f86': '#bfe0d8' };
    const EVTG = grow(EVT, 16), street = [];
    const faceRoad = (x, z) => { let best = 0, bv = -1e9; for (let k = 0; k < 4; k++){ const a = k * Math.PI / 2, v = samp(sdPave, x + Math.sin(a) * 4, z + Math.cos(a) * 4); if (v > bv){ bv = v; best = a; } } return best; };
    for (const [cx, cy, sz, ci, shop] of HS){ const [hx, hz] = P(cx, cy), wd = [[5.4, 4.4], [5.2, 4.2], [4.6, 3.8]][sz]; if (inPoly(EVTG, cx, cy)) continue;   /* 活動場地上的房子拿掉 */ if (RSV.some(([rx, rz, rr]) => rr >= 5 && Math.hypot(hx - rx, hz - rz) < rr + 1.5)) continue; const col = Math.abs(cx - 949) < 4 ? 0 : Math.abs(cx - 1021) < 4 ? 1 : -1, onSt = col >= 0 && cy > 600 && cy < 790, fr = onSt ? (col ? -Math.PI / 2 : Math.PI / 2) : faceRoad(hx, hz);   /* 商店街兩排一定面對大道（不然靠近別條路的會轉過去） */
      house(cx, cy, wd[0], wd[1], HCOL[ci], fr, shop || onSt ? 'shop' : 'home'); if (onSt) street.push({ col, row: Math.round((cy - 611) / 32), x: hx, z: hz, face: fr, d: wd[1] }); }
    /* v921 可以走進去的店（作者 11/27：「可以開始改了」→ 港口和商店街先接上）：店的裡面是村子現在那幾間（釣具店、木工坊、畫廊、寵物店、食堂、撞球館、釣蝦場、魚市場、博物館、體育場），
       新主島這邊只是多一個門：走到門口按「進去看看」，出來回到這個門。門牌用村子的直式掛牌 */
    const door = (k, label, icon, x, z, face) => { const fx = Math.sin(face), fz = Math.cos(face); doors.push({ k, label, x: OX + x, z: OZ + z, face }); if (A.sign){ const g = new THREE.Group(), sx = x + fz * 1.9 - fx * 0.5, sz2 = z - fx * 1.9 - fz * 0.5; g.position.set(sx, Math.max(0.2, hAt(sx, sz2)), sz2); town.add(g); A.sign(g, label, icon, 0, 0); colliders.push({ t: 'c', x: OX + sx, z: OZ + sz2, r: 0.2 }); } };
    { const Wc = street.filter(q => q.col === 0).sort((a, b) => a.row - b.row), Ec = street.filter(q => q.col === 1).sort((a, b) => a.row - b.row), free = [], put = (h, k, label, icon) => { if (h){ h.used = 1; door(k, label, icon, h.x + Math.sin(h.face) * (h.d / 2 + 0.9), h.z + Math.cos(h.face) * (h.d / 2 + 0.9), h.face); } else free.push([k, label, icon]); };
      /* 西排由北到南：食堂、木工坊、撞球館；東排：畫廊、寵物店、釣蝦場；最靠港口那一間是釣具店。哪一間房子被拿掉了（例如讓給活動場地）就排到還空著的房子 */
      put(Wc[0], 'cafe', '潮汐食堂', '🍱'); put(Ec[0], 'cai', '阿彩畫廊', '🎨'); put(Wc[1], 'mu', '阿木木工坊', '🪑'); put(Ec[1], 'pet', '小花寵物店', '🐾'); put(Wc[2], 'pool', '潮汐撞球館', '🎱'); put(Ec[2], 'shrimp', '釣蝦場', '🦐'); put(Wc.length > 3 ? Wc[Wc.length - 1] : null, 'tackle', '釣具店', '🎣');
      for (const [k, label, icon] of free){ const h = street.find(q => !q.used); if (h){ h.used = 1; door(k, label, icon, h.x + Math.sin(h.face) * (h.d / 2 + 0.9), h.z + Math.cos(h.face) * (h.d / 2 + 0.9), h.face); } }
      { const [x, z] = P(1210, 640); door('market', '潮汐魚市場', '🐟', x, z - 7.2, Math.PI); } { const [x, z] = P(775, 650); door('museum', '海洋博物館', '🏛️', x, z - 7.4, Math.PI); } { const [x, z] = P(1480, 430); door('stad', '潮汐體育場', '🏟️', x - 25.5, z + 3, -Math.PI / 2); } }
    { const [x, z] = P(470, 585); label('居民區', x, 9, z); } { const [x, z] = P(985, 700); label('商店街', x, 9, z, 0.8); } { const [x, z] = P(1320, 545); label('玩家建地區', x, 9, z); }
    /* 預留的空地：照規劃圖把房子放滿以後，還空著的大塊草地剩這兩塊（西邊海岸、水族館和村公所中間）；全島空草地約 25% */
    for (const [px, py, t] of [[221, 556, '預留・以後擴建'], [783, 355, '預留']]){ const [x, z] = P(px, py); label(t, x, 6, z, 0.75); }
    { const [x, z] = P(EVT_C[0], EVT_C[1]); label('活動場地', x, 7, z); }
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
    /* 村子的模型（models/art2）：石燈籠、攤子、推車、木桶、水井、牌樓、小船、漁網。模型是另外下載的，載好才會出現 */
    const prop = (name, px, py, sc, ry, col) => { if (!A.art2Add) return; const [x, z] = P(px, py), g = new THREE.Group(); g.position.set(x, Math.max(0.2, hAt(x, z)), z); g.rotation.y = ry || 0; town.add(g); A.art2Add(g, name, { s: sc }); if (col) colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: col }); RSV.push([x, z, 1.6]); };
    for (const n of Object.values(NODES)){ const b = edgeP(n, PL), dx = b[0] - PL[0], dy = b[1] - PL[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; for (const k of [118, 168]) for (const sd2 of [-1, 1]) prop('lamp', PL[0] + ux * k - uy * sd2 * 19, PL[1] + uy * k + ux * sd2 * 19, 1.7, 0, 0.4); }   /* 每條大道兩旁的石燈籠 */
    for (const py of [600, 664, 728, 792]) for (const sd2 of [-1, 1]) prop('lamp', 981 + (py - 600) * 0.06 + sd2 * 19, py, 1.7, 0, 0.4);                                              /* 商店街 */
    for (const i of [0, 7, 14, 21]){ const q = EVT[i % EVT.length]; prop('lamp', q[0], q[1], 1.7, 0, 0.4); }                                                                           /* 活動場地四個角 */
    prop('arch_2', 970, 588, 2.1, 0);                                                                                                                                              /* 商店街入口的牌樓 */
    for (const [px, py, ry] of [[1158, 592, 0.25], [1193, 584, 0.05], [1228, 584, -0.05], [1262, 593, -0.25], [884, 797, 0.2], [1066, 802, -0.15], [1122, 786, -0.3]]) prop('stand', px, py, 1.5, ry, 1.2);   /* 市場前面、港邊的攤子 */
    prop('cart', 1042, 818, 1.3, 0.4, 0.9); prop('barrel_1', 930, 822, 1.2, 0, 0.5); prop('barrel_2', 938, 825, 1.2, 1, 0.5); prop('barrel_1', 1050, 813, 1.2, 0.6, 0.5); prop('pot_1', 1140, 612, 1.3, 0, 0.4); prop('pot_1', 1280, 612, 1.3, 0, 0.4);
    prop('well', 706, 628, 1.4, 0, 1.1); prop('f_net', 846, 792, 1.5, 0.25, 0.6); prop('f_net', 1100, 790, 1.5, -0.3, 0.6); prop('f_boat', 1410, 752, 1.5, 0.9, 1.0); prop('f_boat3', 1455, 772, 1.5, -0.5, 1.0);
    if (TWB) try { TWB.merge(twRoot); } catch(e){ console.warn('world2 merge', e); }   /* 幾十棟房子同一種材質的零件併成一塊，畫面負擔才不會隨房子數量增加 */
    flush(parts, town); }
  /* 遊樂園：摩天輪會轉（先這一樣會動，其他設施之後補） */
  { const [x, z] = P(1255, 316), parts = {}, wheel = new THREE.Group(), wp = {};   /* 摩天輪在橢圓廣場的正中間，旋轉木馬和帳篷分在兩邊 */ for (const dz of [-1, 1]){ B(parts, '#e45a8a', 0.7, 12.3, 0.5, x, 6.15, z + dz * 1.1); B(parts, '#c94a78', 3.2, 0.5, 0.9, x, 0.5, z + dz * 1.1); } B(parts, '#c94a78', 0.6, 0.6, 2.8, x, 12.3, z);
    G(wp, '#e45a8a', new THREE.TorusGeometry(9.6, 0.22, 6, 40), 0, 0, 0); for (let i = 0; i < 12; i++){ const a = i / 12 * 6.2832; const sp = new THREE.CylinderGeometry(0.07, 0.07, 9.6, 4).translate(0, 4.8, 0).rotateZ(a); G(wp, '#f7c6d8', sp, 0, 0, 0); }
    flush(wp, wheel); wheel.position.set(x, 12.3, z); town.add(wheel); const cars = []; for (let i = 0; i < 12; i++){ const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), mat(['#ffcc33', '#4ec1ff', '#ff6b6b', '#7bd389'][i % 4], 0.6)); c.castShadow = true; town.add(c); cars.push(c); }
    /* 旋轉木馬：整座慢慢轉，馬一上一下 */
    { const cx = x - 13, cz = z + 4.5, spin = new THREE.Group(), sp = {}, hA = new THREE.Group(), hB = new THREE.Group(), pa = {}, pb = {};
      G(parts, '#e9dfc9', new THREE.CylinderGeometry(4.4, 4.6, 0.36, 20), cx, 0.52, cz);
      G(sp, '#fff3d6', new THREE.CylinderGeometry(4.0, 4.0, 0.16, 20), 0, 0.78, 0); G(sp, '#fff3d6', new THREE.CylinderGeometry(4.7, 4.7, 0.3, 16), 0, 4.35, 0); G(sp, '#f2c230', new THREE.CylinderGeometry(0.45, 0.55, 3.6, 10), 0, 2.6, 0); G(sp, '#f2c230', new THREE.SphereGeometry(0.36, 8, 6), 0, 6.55, 0); G(sp, '#e2574c', new THREE.ConeGeometry(4.7, 2.0, 16), 0, 5.5, 0);
      for (let i = 0; i < 8; i++){ const a = i / 8 * 6.2832, hx = Math.cos(a) * 3.0, hz = Math.sin(a) * 3.0, tg = i % 2 ? pb : pa, hc = i % 2 ? '#ffd9a8' : '#ffffff'; G(sp, '#fff3d6', new THREE.CylinderGeometry(0.05, 0.05, 3.5, 5), hx, 2.6, hz);
        B(tg, hc, 0.38, 0.6, 1.0, hx, 1.75, hz, -a); B(tg, hc, 0.26, 0.5, 0.3, hx - Math.sin(a) * 0.5, 2.25, hz + Math.cos(a) * 0.5, -a); B(tg, '#e2574c', 0.42, 0.12, 0.4, hx, 2.08, hz, -a); }
      flush(sp, spin); flush(pa, hA); flush(pb, hB); spin.add(hA, hB); spin.position.set(cx, 0, cz); town.add(spin); colliders.push({ t: 'c', x: OX + cx, z: OZ + cz, r: 4.6, big: true }); RSV.push([cx, cz, 6]);
      tickers.push((dt, t) => { spin.rotation.y = -t * 0.45; hA.position.y = Math.sin(t * 2.2) * 0.2; hB.position.y = -Math.sin(t * 2.2) * 0.2; }); }
    for (const [dx, dz, c1] of [[13, 4.5, '#f2c230'], [20.5, -4, '#4ec1ff']]){ G(parts, c1, new THREE.ConeGeometry(3.4, 2.4, 10), x + dx, 4.4, z + dz); G(parts, '#ffffff', new THREE.CylinderGeometry(3.1, 3.1, 0.3, 10), x + dx, 3.1, z + dz); G(parts, '#f7efe1', new THREE.CylinderGeometry(0.3, 0.3, 3, 8), x + dx, 1.6, z + dz); colliders.push({ t: 'c', x: OX + x + dx, z: OZ + z + dz, r: 3.2, big: true }); RSV.push([x + dx, z + dz, 5]); }
    flush(parts, town); colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: 1.8, hd: 1.6, big: true }); RSV.push([x, z, 11]); label('遊樂園', x, 25, z);
    tickers.push((dt, t) => { wheel.rotation.z = t * 0.18; for (let i = 0; i < 12; i++){ const a = t * 0.18 + i / 12 * 6.2832; cars[i].position.set(x + Math.cos(a) * 9.6, 12.3 + Math.sin(a) * 9.6 - 0.9, z); } }); }
  /* 環島小火車：三節車廂沿著軌道跑 */
  { const cum = [0]; for (let i = 1; i <= railLine.length; i++){ const a = railLine[i - 1], b = railLine[i % railLine.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } const LEN = cum[cum.length - 1];
    const at = s => { s = ((s % LEN) + LEN) % LEN; let lo = 0, hi = cum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const a = railLine[lo], b = railLine[(lo + 1) % railLine.length], k = (s - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
    const cars = []; for (let k = 0; k < 3; k++){ const g = new THREE.Group(), parts = {}; B(parts, k ? '#3c8fd8' : '#d9393b', 1.7, 1.5, 3.4, 0, 1.25, 0); B(parts, '#fff6e0', 1.8, 0.16, 3.6, 0, 2.08, 0); B(parts, '#f7efe1', 1.72, 0.5, 2.2, 0, 1.5, 0); if (!k){ G(parts, '#333a44', new THREE.CylinderGeometry(0.22, 0.3, 0.9, 8), 0, 2.5, 1.0); } for (const [dx, dz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]]) G(parts, '#333a44', new THREE.CylinderGeometry(0.36, 0.36, 0.2, 10).rotateZ(Math.PI / 2), dx, 0.42, dz); flush(parts, g); root.add(g); cars.push(g); }
    W2rail = { at, LEN }; tickers.push((dt, t) => { const s0 = t * 5.5; cars.forEach((g, k) => { const [x, z, a] = at(s0 - k * 3.9); g.position.set(x, Math.max(0.2, hAt(x, z)) + 0.08, z); g.rotation.y = a; }); }); }
  var W2rail;
  /* 港口的船：五艘停在棧橋邊跟著浪晃，兩艘在外面的航道上慢慢開（作者：「看著船開來開去也很療癒」） */
  { const boat = (hex, s) => { if (TWB && TWB.boat){ const g = new THREE.Group(); g.add(TWB.boat()); g.scale.setScalar(s * 0.8); root.add(g); return g; }   /* 村子的漁船 */ const g = new THREE.Group(), parts = {}; G(parts, '#ffffff', new THREE.CylinderGeometry(1, 0.72, 0.9, 10, 1).scale(1, 1, 2.6), 0, 0.25, 0); G(parts, hex, new THREE.CylinderGeometry(1.04, 1.04, 0.18, 10, 1).scale(1, 1, 2.62), 0, 0.72, 0); B(parts, '#f7efe1', 1.3, 0.9, 1.6, 0, 1.2, -0.5); B(parts, hex, 1.5, 0.14, 1.8, 0, 1.72, -0.5); B(parts, '#8bb6e6', 1.32, 0.4, 0.06, 0, 1.28, 0.31); flush(parts, g); g.scale.setScalar(s); root.add(g); return g; };
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
    bb: bbInfo, seats, doors,   /* 高看板（螢幕、字幕條的 Mesh，中心高度）和它前面的座位：game.js 接節目、接坐下 */
    /* 這一點是什麼地：0 不是主島、1 水和紅樹林、2 路和廣場、3 森林、4 沙灘、5 蓋了東西、6 海岸邊、7 空草地（量「還有多少地沒用」用的） */
    kind: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz) || samp(sdMain, lx, lz) <= 0) return 0; if (samp(HG, lx, lz) < WL || samp(sdMang, lx, lz) > -3) return 1; if (paved(lx, lz, 0.5)) return 2; if (samp(sdFor, lx, lz) > -4) return 3; if (samp(sdSand, lx, lz) > -3) return 4; if (reserved(lx, lz)) return 5; if (samp(sdLand, lx, lz) < 6) return 6; return 7; },
    /* 預覽用：一按就過去的地點（島上的公尺） */
    spots: [['主城廣場', 975, 560], ['村公所', 965, 372], ['港口', 990, 822], ['商店街', 985, 690], ['博物館', 840, 608], ['水族館', 735, 410], ['活動場地', 1112, 730], ['紅樹林', 446, 390], ['居民區', 482, 580], ['森林步道', 696, 262], ['瀑布', 822, 190], ['遊樂園', 1255, 372], ['體育場', 1352, 449], ['玩家建地', 1310, 535], ['中央市場', 1105, 582], ['沙灘', 1490, 715]].map(([n, px, py]) => [n, ...P(px, py)]),
  };
  root.visible = false;
  return W2;
}
