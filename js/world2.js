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
  const IS = rough([[160,610],[150,500],[230,420],[380,370],[460,260],[560,180],[660,110],[790,70],[910,110],[990,190],[1100,240],[1250,215],[1400,265],[1540,320],[1630,440],[1630,560],[1700,650],[1680,760],[1560,810],[1410,800],[1270,770],[1160,800],[1060,860],[910,870],[790,852],[700,818],[600,796],[520,776],[390,746],[250,716]], 3, 0.28, 3);   /* v936 西南岸往外推：以前鐵軌跑到水上，漲潮就被淹掉看不到 */
  const ISLET = rough([[620,855],[660,840],[690,865],[670,900],[630,895]], 3, 0.4, 90);   /* v936 跟著岸往南挪 */                       // 燈塔的小岩島
  const SHOALS = [[[[180,330],[230,310],[260,340],[240,380],[190,375]], 93], [[[200,410],[245,400],[260,430],[230,455],[195,445]], 94], [[[150,370],[175,362],[182,390],[158,398]], 95]].map(([p, s0]) => rough(p, 3, 0.45, s0));   // 河口外面的小沙洲
  const FO = rough([[540,230],[620,150],[740,95],[860,100],[960,170],[1000,240],[930,300],[820,290],[720,310],[620,300]], 3, 0.3, 8);   // 北邊的山和森林
  const LAKE = rough([[820,215],[870,205],[905,230],[880,262],[830,258]], 2, 0.3, 11);
  const RIV = [[855,240],[800,215],[785,195],[770,250],[730,296],[660,308],[580,308],[500,316],[430,338],[360,365],[300,385],[262,392]];   // 中段比規劃圖往北挪 3～4 公尺：原本跟鐵軌、水族館站疊在一起
  const MF = rough([[270,350],[340,320],[420,330],[440,380],[380,415],[300,420],[255,395]], 3, 0.4, 91);          // 紅樹林
  const SAND = rough([[1300,700],[1420,660],[1560,640],[1660,680],[1690,760],[1580,800],[1430,795],[1300,780]], 2, 0.2, 77);   // 陽光沙灘
  /* v950 作者：「要做」→ 新主島自己的珊瑚礁：陽光沙灘外面一片淺水（底下是珊瑚），沙灘踩著幾塊礁岩走出去，站在礁岩上釣。原本珊瑚礁岸的魚在這裡釣（釣點代號 reef） */
  const REEF = rough([[1520,818],[1625,806],[1730,826],[1760,900],[1680,965],[1560,955],[1505,890]], 3, 0.28, 61), REEF_C = [1630, 880];
  const REEF_ROCKS = [[1598,812,13],[1612,836,11],[1630,858,12],[1652,878,13],[1676,866,9],[1700,892,11],[1578,872,10],[1612,915,9],[1720,846,8]];   /* 礁岩：[x, y, 半徑]（規劃圖的像素） */
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
    ...Object.values(NODES).map(n => [[PL, edgeP(n, PL), [lerp(edgeP(n, PL)[0], n[0], 0.35), lerp(edgeP(n, PL)[1], n[1], 0.35)]], 24, 'stone']),   // 圓環 → 每棟大建築的前廣場（直直的大道）；v936 多伸進前廣場一點（遊樂園以前差一點沒接上）
    /* v936 作者：「路可以參考那張圖嗎，路還有很多接不上」→ 照規劃圖加外環大路：水族館 → 居民區北邊 → 居民區西邊；港邊 → 沙灘北邊 → 體育場；體育場 ↔ 遊樂園 ↔ 村公所前廣場 */
    [[[575,462],[500,478],[420,494],[345,512],[298,548],[286,580]], 18, 'stone'],
    [[[1160,790],[1262,760],[1340,700],[1420,612],[1490,548],[1530,500]], 18, 'stone'],
    [[[1395,402],[1360,380]], 18, 'stone'], [[[1080,330],[1130,330]], 18, 'stone'],
    [[[752,535],[700,588]], 16, 'stone'], [[[1178,520],[1205,540]], 16, 'stone'],
    /* v919 作者：「有些路都沒連過去」→ 市場接到沙灘、每個車站接到最近的廣場或巷子、建地區的巷子接到市場和體育場大道 */
    ...[[[1308,668],[1332,722],[1340,700]], [[1430,575],[1438,612]], [[1545,555],[1500,540]], [[1080,240],[1080,272],[1095,330]], [[560,340],[578,364]], [[300,530],[290,560]], [[768,800],[772,716]], [[1213,790],[1210,712]], [[1320,625],[1360,680]], [[1300,470],[1298,452]]].map(L => [L, 11, 'lane']),   /* v936 火車站剩 5 站：留下的站接到最近的路，拿掉的站的小路改接外環 */
    ...[[[280,556],[700,588]], [[290,601],[710,633]], [[280,556],[290,640]], [[480,568],[488,690]], [[690,588],[695,660]]].map(L => [L, 11, 'lane']),   // 居民區的巷子
    [[[1205,540],[1310,535],[1430,575]], 12, 'lane'], [[[1300,470],[1310,535],[1320,625]], 12, 'lane'],                                              // 玩家建地區的十字巷
  ];
  const TRAILS = [[[700,283],[684,240],[640,205]], [[934,272],[930,244],[918,210],[870,186],[822,190]], [[440,390],[380,400],[300,395],[240,370],[200,345]], [[700,319],[700,362]], [[540,402],[490,398],[440,390]], [[684,240],[697,224],[706,212]]];   // 0、1 森林步道；5 步道岔出去到山洞；2 紅樹林木棧道；3 過河小橋接到水族館；4 水族館接到木棧道
  const RAIL = [[1160,810],[1300,780],[1420,640],[1560,560],[1610,470],[1620,380],[1500,300],[1360,235],[1250,222],[1080,230],[900,270],[700,330],[560,330],[430,430],[320,470],[260,560],[330,700],[480,740],[640,780],[820,830],[1000,840]];
  /* v936 作者：「火車太多站了而且好近，所以一直停車」→ 11 站剩 5 站，一站大約隔 100～170 公尺 */
  const STA = [[1560,560,'體育場・沙灘'],[1080,230,'村公所・遊樂園'],[560,330,'水族館・森林'],[300,520,'居民區・紅樹林'],[990,840,'港口・商店街']];

  /* ---------- 畫進資料格 ---------- */
  const fillL = polys => { const L = layer(); for (const p of polys){ closed(L.g, p); L.g.fill(); } return L; };
  /* v937 作者圈了東北角和市場南邊：鐵軌又跑到水上（跟西南邊一樣）→ 鐵軌兩邊各 7 公尺一定是陸地，整圈都不會再泡水 */
  const railLand = L => { const g = L.g; open(g, RAIL.concat([RAIL[0]])); g.lineWidth = 70; g.lineJoin = 'round'; g.stroke(); return L; };
  const rocksTo = L => { for (const [x, y, r] of REEF_ROCKS){ L.g.beginPath(); for (let k = 0; k <= 12; k++){ const a = k / 12 * 6.2832, rr = r * (0.8 + 0.25 * Math.sin(a * 3 + x)); L.g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } L.g.fill(); } return L; };
  const landL = rocksTo(railLand(fillL([IS, ISLET, ...SHOALS]))), sdLand = sdf(bits(landL));
  const sdReef = sdf(bits(fillL([REEF]))), sdRock = sdf(bits(rocksTo(layer())));
  const sdMain = sdf(bits(railLand(fillL([IS]))));
  const sdFor = sdf(bits(fillL([FO]))), sdSand = sdf(bits(fillL([SAND]))), sdMang = sdf(bits(fillL([MF])));
  const POOLC = [785, 206], POOLR = 21;   /* v929 瀑布下面沖出來的深潭（規劃圖的像素；21 像素＝4.2 公尺） */
  const watL = fillL([LAKE]); { const g = watL.g; open(g, RIV); g.lineWidth = 17; g.stroke(); g.beginPath(); g.arc(POOLC[0], POOLC[1], POOLR, 0, 7); g.fill(); } const sdWat = sdf(bits(watL));
  const paveL = layer(); { const g = paveL.g; closed(g, PLAZA); g.fill(); closed(g, EVT); g.fill(); g.beginPath(); g.ellipse(PL[0], PL[1], RING[0], RING[1], 0, 0, 7); g.lineWidth = 24; g.stroke();
    for (const [pts, w] of ROADS){ open(g, pts); g.lineWidth = w + 4; g.stroke(); }
    for (const k in NODES){ const [x, y, w, h] = NODES[k]; g.beginPath(); g.ellipse(x, y, w / 2 + 4, h / 2 + 4, 0, 0, 7); g.fill(); }
    { open(g, RAIL.concat([RAIL[0]])); g.lineWidth = 16; g.stroke(); } }
  const sdPave = sdf(bits(paveL)), sdLake = sdf(bits(fillL([LAKE])));
  const boardL = layer(); { const g = boardL.g; open(g, TRAILS[2]); g.lineWidth = 8.5; g.stroke(); } const sdBoard = sdf(bits(boardL));                       // 紅樹林木棧道：架在水上，可以走
  const trailL = layer(); { const g = trailL.g; for (const i of [0, 1, 3, 4, 5]){ open(g, TRAILS[i]); g.lineWidth = 8; g.stroke(); } } const sdTrail = sdf(bits(trailL));   // 泥土步道：不長樹
  const BOARD_Y = 0.46, boardY = (lx, lz) => Math.max(hAt(lx, lz) + 0.07, BOARD_Y), onBoard = (lx, lz) => samp(sdBoard, lx, lz) > -0.1;
  /* 高度：海岸前 3 公尺是淺灘；陸地平平的（之後要蓋房子），北邊森林是一座山；河和湖往下挖到海平面以下 */
  const PEAK = P(785, 122), PEAK2 = P(640, 190);
  /* v929 山洞：洞口在大山西南邊的山坡，朝外（背對山頂）。洞裡的地要平：那一塊山坡照洞的中線削平／墊高（左右兩邊原本高低差一公尺半） */
  const CAVE = (() => { const [ex, ez] = P(708, 210), face = Math.atan2(ex - PEAK[0], ez - PEAK[1]); return { ex, ez, face, fx: Math.sin(face), fz: Math.cos(face), rx: Math.cos(face), rz: -Math.sin(face), LEN: 9, W: 1.7, HT: 2.9, on: false, y0: 0, y1: 0 }; })();
  const caveUV = (lx, lz) => { const dx = lx - CAVE.ex, dz = lz - CAVE.ez; return [-(dx * CAVE.fx + dz * CAVE.fz), dx * CAVE.rx + dz * CAVE.rz]; };
  const caveFloor = u => CAVE.y0 + (CAVE.y1 - CAVE.y0) * clamp(u, 0, CAVE.LEN) / CAVE.LEN;
  /* 紅樹林：一片淺淺的水（樹站在水裡），中間幾塊露出來的泥灘 */
  const lagoon = (lx, lz, mg) => { const n = Math.sin(lx * 0.42 + 1.7) * Math.cos(lz * 0.47 - 0.4) + 0.45 * Math.sin(lx * 0.93 - lz * 0.71); return lerp(-0.4, 0.2, s01((n - 0.5) / 0.3) * s01((mg - 0.5) / 2)); };
  /* v951 礁岩上的大石頭：位置先決定好，地面高度和石頭的樣子用同一份，人才會站在石頭上面 */
  const rockBase = (lx, lz, rk) => 0.3 + 0.32 * s01(rk / 1.6) + Math.sin(lx * 1.7) * Math.cos(lz * 1.9) * 0.06;
  const BOULDERS = (() => { let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, out = [];
    for (const [px, py, r] of REEF_ROCKS){ const [x, z] = P(px, py), R = r * S; for (let b = 0; b < 3; b++){ const bx = x + (rnd() - 0.5) * R * 0.8, bz = z + (rnd() - 0.5) * R * 0.6, br = R * (0.35 + rnd() * 0.2); out.push({ x: bx, z: bz, r: br, dark: !b, y: rockBase(bx, bz, samp(sdRock, bx, bz)) - 0.04 }); } }
    return out; })();
  function height(lx, lz){ const h0 = height0(lx, lz); let hb = -9; for (const B of BOULDERS){ const dx = lx - B.x, dz = lz - B.z, R = B.r; if (dx * dx + dz * dz < R * R) hb = Math.max(hb, B.y + B.r * 0.45 * Math.sqrt(1 - (dx * dx + dz * dz) / (R * R))); } return Math.max(h0, hb); }   /* v951 礁岩上的大石頭踩得上去，石頭伸到水上的那一塊也算 */
  function height0(lx, lz){ const dl = samp(sdLand, lx, lz), mg = samp(sdMang, lx, lz);
    if (dl < 0){ const d = -dl; let h = d <= 3 ? -0.03 - d * 0.1 : Math.max(-3.2, -0.33 - (d - 3) * 0.42); if (mg > -5) h = lerp(h, lagoon(lx, lz, mg), s01((mg + 5) / 5)); { const rf = samp(sdReef, lx, lz); if (rf > -5) h = lerp(h, -0.46 - 0.22 * (Math.sin(lx * 0.8 + 1.3) * Math.cos(lz * 0.7) * 0.5 + 0.5), s01((rf + 5) / 5)); }   /* v950 珊瑚礁：淺淺的一片 */ return h; }
    const dw = samp(sdWat, lx, lz), dm = samp(sdMain, lx, lz), flat = s01((samp(sdPave, lx, lz) + 3) / 3);
    let h = 0.1 + s01(dl / 4) * (PAVE_Y - 0.1);
    { const rk = samp(sdRock, lx, lz); if (rk > -0.5 && samp(sdMain, lx, lz) < 0){ return Math.max(h, rockBase(lx, lz, rk)); } }   /* v950 礁岩：比水面高一點、中間凸起；v951 上面的大石頭也踩得上去（腳不會陷進石頭裡） */   /* v950 礁岩：比水面高一點、中間凸起 */
    h += (Math.sin(lx * 0.11 + 1.3) * Math.cos(lz * 0.13) * 0.22 + Math.sin((lx + lz) * 0.31) * 0.07 + 0.12) * s01((dl - 5) / 8) * (1 - flat);
    const df = samp(sdFor, lx, lz); if (df > -14 && dm > 0){ const k = s01((df + 14) / 34) * s01((-dw - 1.5) / 9) * s01(dm / 10) * (1 - flat), a = Math.max(0, 1 - Math.hypot(lx - PEAK[0], lz - PEAK[1]) / 36), b = Math.max(0, 1 - Math.hypot(lx - PEAK2[0], lz - PEAK2[1]) / 26);
      h += k * (0.9 + Math.pow(a, 1.5) * 13.5 + Math.pow(b, 1.6) * 5.5 + (Math.sin(lx * 0.37) * Math.cos(lz * 0.33) + 1) * 0.35); }
    if (dw > -2.2 && dm > 0) h = Math.min(h, dw > 0 ? WL - 0.16 - Math.min(0.85, dw * 0.55) : WL + 0.06 + (-dw) * (-dw) * 0.11);
    if (mg > -3) h = Math.min(h, lerp(h, lagoon(lx, lz, mg), s01((mg + 3) / 4) * (1 - flat)));
    if (CAVE.on){ const [u, v] = caveUV(lx, lz); if (u > -4 && u < CAVE.LEN + 3 && Math.abs(v) < CAVE.W + 3.5){ const k = Math.max(s01((Math.abs(v) - CAVE.W - 0.3) / 3), s01((-1.2 - u) / 2.5), s01((u - CAVE.LEN - 0.6) / 2.2)); h = lerp(caveFloor(u), h, k); } }   /* 洞裡（和洞口前一公尺）是平的，往外三公尺慢慢接回原本的山坡 */
    return h; }
  { const [ax, az] = [CAVE.ex, CAVE.ez]; CAVE.y0 = height(ax + CAVE.fx * 0.6, az + CAVE.fz * 0.6); CAVE.y1 = Math.max(CAVE.y0, height(ax - CAVE.fx * CAVE.LEN, az - CAVE.fz * CAVE.LEN) - 0.6); CAVE.on = true; }   /* 洞口的高度取洞口外一點點（步道接上來的地方）；最裡面比原本的山坡低一點 */
  const HG = new Float32Array(NN); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HG[j * NX + i] = height(X0 + (i + 0.5) / RES, Z0 + (j + 0.5) / RES);
  const inBox = (lx, lz, m) => lx > X0 - (m || 0) && lx < X0 + GW + (m || 0) && lz > Z0 - (m || 0) && lz < Z0 + GH + (m || 0);
  const hAt = (lx, lz) => inBox(lx, lz) ? samp(HG, lx, lz) : -3.2;
  const paved = (lx, lz, m) => samp(sdPave, lx, lz) > -(m || 0);

  /* ---------- 水面遮罩（跟村子同一套水：深淺、浪、岸邊泡沫都照這張圖） ---------- */
  let maskTex = null, inside = false;
  { const data = new Uint8Array(NN * 4);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++){ const o = j * NX + i, lx = X0 + (i + 0.5) / RES, lz = Z0 + (j + 0.5) / RES, h = HG[o], dl = sdLand[o], wet = h < WL - 0.02, lk0 = s01((sdMang[o] + 3.5) / 2), inland = (dl > 0 && wet) || lk0 > 0.3, lake = inland && sdLake[o] > -1;   /* lk0：紅樹林（水和泥灘那幾格都算，水邊才不會被當成海邊） */
      let shore = -dl; if (shore < 0 && !(h < 0.2 && samp(sdSand, lx, lz) > -4 && !paved(lx, lz, 2))) shore = -8; if (inland) shore = Math.max(shore, 6);
      data[o * 4] = Math.round(Math.max(clamp((sdReef[o] > -3 ? Math.min(-h, lerp(-h, 0.44, s01((sdReef[o] + 3) / 3))) : -h) / 2, 0, 1) * 255, 36 * lk0));   /* v950 珊瑚礁上的水當成很淺（44 公分）：水比較透明、顏色比較淺，看得到底下的珊瑚；退潮最多退 36 公分，不會整片乾掉 */   /* 紅樹林裡（連泥灘那幾格）水深都算 28 公分以上：水邊才不會冒一圈白泡沫 */ data[o * 4 + 1] = wet ? 255 : 0; data[o * 4 + 2] = Math.round(Math.max(dl > 0 && wet ? (lake ? 180 : 60) : 0, 95 * lk0)); data[o * 4 + 3] = Math.round(clamp((shore + 8) / 32, 0, 1) * 255); }
    maskTex = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat); maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter; maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping; maskTex.needsUpdate = true; }

  /* ---------- 地形：一塊 48 公尺，走近才蓋 ---------- */
  const DEEPF = '#6f8f93'; const root = new THREE.Group(); root.position.set(OX, 0, OZ); root.userData.keep = true; root.userData.dyn = true; scene.add(root);
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: DEEPF, roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.y = -3.25; root.add(f); }
  const C = new THREE.Color(), col = (hex, k) => { C.set(hex); if (k != null) C.multiplyScalar(k); return C; };
  const GRASS = ['#8fcf6a', '#7cc25f', '#9ad873'], WOODS = ['#5fae55', '#4f9a4a'], SANDC = '#efe0ae', BEACH = '#fbf3da', MUD = '#8f8a6a', ROCK = '#8f8878', SEAB = '#e9dcae';
  function groundCol(lx, lz, h, out){ const dl = samp(sdLand, lx, lz), n = hash(Math.floor(lx * 0.7), Math.floor(lz * 0.7)), n2 = Math.sin(lx * 0.09 + 0.7) * Math.cos(lz * 0.11) * 0.5 + 0.5;
    if (samp(sdRock, lx, lz) > -0.3 && dl > 0){ col(ROCK, 0.82 + n * 0.25); }   /* v950 礁岩 */
    else if (h < WL - 0.02 && dl > 0){ col('#6f8f72', 0.9); }                                                    // 河床、湖底
    else if (dl < 0.4){ col(SEAB, 1 - clamp(-h / 5, 0, 0.35)); C.lerp(col2.set(DEEPF), s01((-h - 1.4) / 1.6)); { const rf = samp(sdReef, lx, lz); if (rf > -2){ const q = hash(Math.floor(lx * 0.5) + 7, Math.floor(lz * 0.5) + 3), cc = ['#f29a9a', '#f2b56a', '#b99ae0', '#6fc9b8', '#f4e2b8', '#f4e2b8']; C.lerp(col2.set(cc[Math.floor(q * cc.length) % cc.length]), s01((rf + 2) / 3) * 0.7); } } }   /* v950 珊瑚礁的底：一塊一塊粉紅、橘、紫、青綠的珊瑚 */
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
  for (const i of [0, 1, 3, 4, 5]) ribbon('dirt', dense(curve(TRAILS[i]), 1.1), 1.6, (x, z) => Math.max(0.2, hAt(x, z)) + 0.05, false, 2.2);   // 泥土步道：貼著山坡
  const railLine = curve(RAIL, true); ribbon('rail', railLine, 2.0, (x, z, cx, cz) => Math.max(0.2, hAt(cx, cz)) + 0.075, true, 1.0);                          // 環島小火車的軌道
  /* v923 軌道的里程表（公尺）：railAt(s) → [x, z, 朝向]。小火車、車站共用。railStops：每一站在第幾公尺、月台在哪（蓋車站的時候填） */
  const railCum = [0]; for (let i = 1; i <= railLine.length; i++){ const a = railLine[i - 1], b = railLine[i % railLine.length]; railCum.push(railCum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const railLen = railCum[railCum.length - 1], railStops = [];
  const railAt = s => { s = ((s % railLen) + railLen) % railLen; let lo = 0, hi = railCum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (railCum[m] <= s) lo = m; else hi = m; } const a = railLine[lo], b = railLine[(lo + 1) % railLine.length], k = (s - railCum[lo]) / Math.max(1e-6, railCum[lo + 1] - railCum[lo]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  for (const k in paveParts){ if (!paveParts[k].length) continue; const m = new THREE.Mesh(mergeGeometries(paveParts[k], false), MAT[k]); m.receiveShadow = true; root.add(m); }

  /* ---------- 大建築（先用簡單的樣子佔位置，看大小和位置對不對；之後一棟一棟換成真的） ---------- */
  const RSV = [], DECKS = [];   /* 蓋了東西的地方：不長樹；DECKS：可以走上去的棧橋 [x0, x1, z0, z1, 高度] */
  const deck = (lx, lz) => { for (const d of DECKS) if (lx > d[0] && lx < d[1] && lz > d[2] && lz < d[3]) return d; return null; };
  const reserved = (lx, lz) => RSV.some(([x, z, r]) => Math.hypot(lx - x, lz - z) < r);
  const roofG = (len, depth, h) => new THREE.CylinderGeometry(1, 1, len, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.5, 0).scale(1, h / 1.5, depth / 1.732);   /* 沿著 x 的三角柱屋頂 */
  const B = (parts, hex, w, h, d, x, y, z, ry) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); (parts[hex] = parts[hex] || []).push(g.toNonIndexed()); };
  const G = (parts, hex, g, x, y, z) => { g.translate(x, y, z); (parts[hex] = parts[hex] || []).push(g.index ? g.toNonIndexed() : g); };
  const flush = (parts, grp) => { for (const hex in parts){ const m = new THREE.Mesh(mergeGeometries(parts[hex], false), mat(hex.slice(0, 7), hex.length > 7 ? 0.35 : 0.85)); m.castShadow = true; m.receiveShadow = true; grp.add(m); } };
  const tickers = [], labels = []; let labelsOn = true; const seats = [], doors = [], posts = {}, homes = [], spotsAt = {}, PIERS = []; let bbInfo = null, caveInfo = null;   /* seats：看板前面可以坐的位置（世界座標）；bbInfo：高看板的螢幕 */
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
    { const [x, z] = P(655, 870), y = Math.max(0.3, hAt(x, z)); G(parts, '#ffffff', new THREE.CylinderGeometry(1.5, 2.3, 11, 14), x, y + 5.5, z); for (let i = 0; i < 3; i++) G(parts, RED, new THREE.CylinderGeometry(1.62 + (2 - i) * 0.25, 1.78 + (2 - i) * 0.25, 1.5, 14), x, y + 2.6 + i * 3.1, z); G(parts, '#333a44', new THREE.CylinderGeometry(1.9, 1.9, 0.3, 14), x, y + 11.1, z); G(parts, '#ffe5a4', new THREE.CylinderGeometry(1.1, 1.1, 1.5, 10), x, y + 12, z); G(parts, RED, new THREE.ConeGeometry(1.7, 1.6, 12), x, y + 13.5, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 2.4, big: true }); RSV.push([x, z, 5]); label('燈塔', x, 17.5, z, 0.8); }
    /* 港口碼頭：五條棧橋 */
    const piers = PIERS;
    for (const [dx, len] of [[-170, 90], [-90, 120], [0, 140], [90, 120], [170, 90]]){ const [x, z00] = P(990 + dx, 835), z1 = z00 + len * S; let zr = -1e9; for (const q of railLine) if (Math.abs(q[0] - x) < 2.4 && Math.abs(q[1] - z00) < 12) zr = Math.max(zr, q[1]); const z0 = zr > -1e8 ? Math.max(z00, zr + 1.3) : z00, L = z1 - z0;   /* v925 棧橋以前從岸上蓋出去、橫在鐵軌上，小火車會從橋板中間穿過去；現在從鐵軌靠海那一側才開始 */
      B(parts, '#b98a5a', 3.4, 0.3, L, x, 0.5, z0 + L / 2); DECKS.push([x - 1.7, x + 1.7, z0 - 0.2, z0 + L, 0.65]); piers.push({ x, z0, L }); for (let k = 0; k <= L; k += 4){ B(parts, '#7a5530', 0.4, 2.4, 0.4, x - 1.5, -0.5, z0 + k); B(parts, '#7a5530', 0.4, 2.4, 0.4, x + 1.5, -0.5, z0 + k); } }
    { const [x, z] = P(990, 880); label('港口碼頭', x, 8, z); }
    /* 居民區、商店街、玩家建地：小房子（之後換成真的房子模型） */
    const ROOF = ['#c0583a', '#4a6fb5', '#7a5aa0', '#d08a2a', '#3e8f86', '#e2574c', '#3c8fd8', '#4bb57b'];
    /* 民宅＝三層樓透天和兩層街屋輪流；商店街＝一樓是店面的街屋，每四間一間小木屋店。門都朝著路 */
    const PASTEL = ['#f2b6c0', '#f4d9a0', '#c7e3c0', '#f6c9a8', '#b9d9ee'], COTK = ['cloth', 'hair', 'wood', 'art'], cots = [], stands = []; let hN = 0;   /* cots：小木屋店（哪一種、在哪、門朝哪）；stands：攤子模型放在哪——村民擺攤、站崗的位置從這裡來 */
    const house = (px, py, w, d, roof, ry, kind, ck) => { const [x, z] = P(px, py); if (paved(x, z, 1.2) || samp(sdLand, x, z) < 4 || hAt(x, z) < 0.2) return; const q = Math.abs(Math.sin(ry || 0)) > 0.7;
      /* 作者 11/27：「其實原本的房子還可以」→ 民宅和店面用村子現在那一套街屋（民宅＝三層樓透天和兩層街屋輪流；商店街一樓是店面，每四間一間小木屋店） */
      if (TWB){ const g = new THREE.Group(), sd = hN++; g.position.set(x, Math.max(0.2, hAt(x, z)), z); g.rotation.y = ry || 0; twRoot.add(g);
        if (kind === 'shop' && (ck || sd % 4 === 1)){ const kk = ck || COTK[(sd >> 2) % 4]; TWB.cottage(g, { w: w - 0.4, d, front: d / 2, kind: kk }); cots.push({ k: kk, x, z, face: ry || 0, d }); }
        else { const sub = new THREE.Group(), S = 1.34; sub.scale.setScalar(S); g.add(sub); TWB.house(sub, kind === 'shop' ? { w: w / S, d: d / S, fl: 2 + (sd % 3 === 0 ? 1 : 0), front: d / 2 / S, seed: sd * 7 + 1, kind: 'shop' } : { w: w / S, d: d / S, fl: sd % 2 ? 3 : 2, front: d / 2 / S, seed: sd * 5 + 2, kind: 'home', wall: HWALL[roof] || PASTEL[sd % 5] }); } }
      else { B(parts, '#f7efe1', w, 2.9, d, x, 1.75, z, ry); const g = roofG(w + 0.5, d + 0.7, 1.7); if (ry) g.rotateY(ry); G(parts, roof, g, x, 3.2, z); }
      colliders.push({ t: 'b', x: OX + x, z: OZ + z, hw: (q ? d : w) / 2 + 0.1, hd: (q ? w : d) / 2 + 0.1 }); RSV.push([x, z, Math.max(w, d) * 0.75]);
      if (kind === 'home'){ const f = ry || 0; homes.push({ x: OX + x + Math.sin(f) * (d / 2 + 0.9), z: OZ + z + Math.cos(f) * (d / 2 + 0.9), face: f }); } };   /* v934 民宅的門口（村民下雨回家用） */
    /* 規劃圖上的每一棟房子（作者 11/27 說規劃圖「就很好」→ 位置照圖，一棟不少）：[中心 x, 中心 y, 大小, 屋頂顏色, 是不是店]。門朝最近的路 */
    const HS = [[315,531,0,6,0],[367,535,0,2,0],[419,539,0,4,0],[523,547,0,1,0],[575,551,0,6,0],[627,555,0,2,0],[335,576,0,2,0],[387,580,0,4,0],[439,584,0,7,0],[543,592,0,6,0],[595,596,0,2,0],[647,600,0,4,0],[355,621,0,4,0],[407,625,0,7,0],[459,629,0,1,0],[511,633,0,6,0],[563,637,0,2,0],[615,641,0,4,0],[667,645,0,7,0],[1159,655,0,3,1],[1193,609,0,9,1],[1193,669,0,5,1],[1227,623,0,3,1],[1227,683,0,8,1],[1261,637,0,5,1],[1261,697,0,0,1],[1295,711,0,9,1],[949,611,0,0,1],[1021,611,0,0,1],[949,643,0,9,1],[1021,643,0,9,1],[949,675,0,3,1],[1021,675,0,3,1],[949,707,0,5,1],[1021,707,0,5,1],[949,739,0,8,1],[1021,739,0,8,1],[949,771,0,0,1],[1021,771,0,0,1],[1238,510,2,8,0],[1268,510,2,0,0],[1238,568,2,3,0],[1268,568,2,9,0],[1348,502,2,5,0],[468,456,1,8,1],[501,456,1,0,1],[463,495,1,8,0],[507,494,1,5,0],[540,490,1,9,0],[582,495,1,6,0],[618,491,1,2,1],[655,495,1,2,0],[694,493,1,5,1],[656,525,1,8,1],[692,527,1,9,0],[809,524,1,9,1],[1494,526,1,8,1],[1488,560,1,8,1],[695,626,1,2,0],[508,695,1,9,0],[578,698,1,0,0],[618,694,1,5,1],[653,698,1,5,0],[923,696,1,3,0],[658,729,1,3,0],[696,729,1,3,0],[886,728,1,3,0],[1076,730,1,0,0],[1111,728,1,0,0],[1147,728,1,9,0],[1226,728,1,8,1],[1265,732,1,7,1],[810,764,1,6,0],[846,766,1,5,0],[880,765,1,3,0],[922,764,1,2,1],[1070,763,1,3,1],[1110,765,1,0,1],[1185,763,1,9,1],[1226,763,1,7,0]];
    const HCOL = ["#3c8fd8", "#3e8f86", "#4a6fb5", "#4bb57b", "#7a5aa0", "#a46ad8", "#c0583a", "#d08a2a", "#e2574c", "#f0a02a"], HWALL = { '#e2574c': '#f2b3a6', '#3c8fd8': '#b9d9ee', '#f0a02a': '#f4d9a0', '#4bb57b': '#c7e3c0', '#a46ad8': '#d9c7ee', '#c0583a': '#f6c9a8', '#4a6fb5': '#bcd0f0', '#d08a2a': '#f3d98a', '#7a5aa0': '#dccbee', '#3e8f86': '#bfe0d8' };
    const EVTG = grow(EVT, 16), street = [];
    const faceRoad = (x, z) => { let best = 0, bv = -1e9; for (let k = 0; k < 4; k++){ const a = k * Math.PI / 2, v = samp(sdPave, x + Math.sin(a) * 4, z + Math.cos(a) * 4); if (v > bv){ bv = v; best = a; } } return best; };
    for (const [cx, cy, sz, ci, shop] of HS){ const [hx, hz] = P(cx, cy), wd = [[5.4, 4.4], [5.2, 4.2], [4.6, 3.8]][sz]; if (inPoly(EVTG, cx, cy)) continue;   /* 活動場地上的房子拿掉 */ if (RSV.some(([rx, rz, rr]) => rr >= 5 && Math.hypot(hx - rx, hz - rz) < rr + 1.5)) continue; const col = Math.abs(cx - 949) < 4 ? 0 : Math.abs(cx - 1021) < 4 ? 1 : -1, onSt = col >= 0 && cy > 600 && cy < 790, fr = onSt ? (col ? -Math.PI / 2 : Math.PI / 2) : faceRoad(hx, hz);   /* 商店街兩排一定面對大道（不然靠近別條路的會轉過去） */
      /* v927 商店街東排那三間小木屋店，裡面擺的東西要跟招牌對得上：最北那間掛的是「阿彩畫廊」→ 擺畫（以前剛好排到理髮店的擺設，畫廊的招牌掛在理髮店上）；
         中間那間是阿萍的美髮沙龍；最靠港口那間留給阿綾的服裝店 */
      const row = Math.round((cy - 611) / 32), ck = onSt && col === 1 ? { 0: 'art', 3: 'hair', 5: 'cloth' }[row] : null;
      house(cx, cy, wd[0], wd[1], HCOL[ci], fr, shop || onSt ? 'shop' : 'home', ck); if (onSt) street.push({ col, row, x: hx, z: hz, face: fr, d: wd[1] }); }
    /* v921 可以走進去的店（作者 11/27：「可以開始改了」→ 港口和商店街先接上）：店的裡面是村子現在那幾間（釣具店、木工坊、畫廊、寵物店、食堂、撞球館、釣蝦場、魚市場、博物館、體育場），
       新主島這邊只是多一個門：走到門口按「進去看看」，出來回到這個門。門牌用村子的直式掛牌 */
    const plate = (label, icon, x, z, face) => { if (!A.sign) return; const fx = Math.sin(face), fz = Math.cos(face), g = new THREE.Group(), sx = x + fz * 1.9 - fx * 0.5, sz2 = z - fx * 1.9 - fz * 0.5; g.position.set(sx, Math.max(0.2, hAt(sx, sz2)), sz2); town.add(g); A.sign(g, label, icon, 0, 0); colliders.push({ t: 'c', x: OX + sx, z: OZ + sz2, r: 0.2 }); };   /* 門口旁邊的直式掛牌 */
    const door = (k, label, icon, x, z, face) => { doors.push({ k, label, x: OX + x, z: OZ + z, face }); plate(label, icon, x, z, face); };
    { const Wc = street.filter(q => q.col === 0).sort((a, b) => a.row - b.row), Ec = street.filter(q => q.col === 1).sort((a, b) => a.row - b.row), free = [], put = (h, k, label, icon) => { if (h){ h.used = 1; door(k, label, icon, h.x + Math.sin(h.face) * (h.d / 2 + 0.9), h.z + Math.cos(h.face) * (h.d / 2 + 0.9), h.face); } else free.push([k, label, icon]); };
      /* 西排由北到南：食堂、木工坊、撞球館；東排：畫廊、寵物店、釣蝦場；最靠港口那一間是釣具店。哪一間房子被拿掉了（例如讓給活動場地）就排到還空著的房子 */
      put(Wc[0], 'cafe', '潮汐食堂', '🍱'); put(Ec[0], 'cai', '阿彩畫廊', '🎨'); put(Wc[1], 'mu', '阿木木工坊', '🪑'); put(Ec[1], 'pet', '小花寵物店', '🐾'); put(Wc[2], 'pool', '潮汐撞球館', '🎱'); put(Ec[2], 'shrimp', '釣蝦場', '🦐'); put(Wc.length > 3 ? Wc[Wc.length - 1] : null, 'tackle', '釣具店', '🎣');
      put(Ec.find(q => q.row === 5 && !q.used) || null, 'tailor', '阿綾服裝店', '👗');   /* v951 阿綾服裝店：商店街東排最靠港口那間（v927 就留給她，裡面擺衣架） */
      for (const [k, label, icon] of free){ const h = street.find(q => !q.used); if (h){ h.used = 1; door(k, label, icon, h.x + Math.sin(h.face) * (h.d / 2 + 0.9), h.z + Math.cos(h.face) * (h.d / 2 + 0.9), h.face); } }
      { const [x, z] = P(1210, 640); door('market', '潮汐魚市場', '🐟', x, z - 7.2, Math.PI); } { const [x, z] = P(775, 650); door('museum', '海洋博物館', '🏛️', x, z - 7.4, Math.PI); } { const [x, z] = P(1480, 430); door('stad', '潮汐體育場', '🏟️', x - 25.5, z + 3, -Math.PI / 2); } }
    { const [x, z] = P(470, 585); label('居民區', x, 9, z); } { const [x, z] = P(985, 700); label('商店街', x, 9, z, 0.8); }
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
      const { x, z, sg } = best, y = Math.max(0.2, hAt(x, z)), ry = Math.atan2(-tz, tx); B(parts, '#fff6e0', 5.4, 0.3, 2.6, x, y + 0.15, z, ry); B(parts, '#f2c230', 5.4, 0.31, 0.14, x + tz * sg * 1.2, y + 0.15, z - tx * sg * 1.2, ry); B(parts, RED, 5.8, 0.22, 1.7, x - tz * sg * 0.78, y + 3.0, z + tx * sg * 0.78, ry); B(parts, '#fff6e0', 5.86, 0.08, 1.76, x - tz * sg * 0.78, y + 2.87, z + tx * sg * 0.78, ry);   /* v925 屋頂從蓋滿整個月台（3 公尺寬）縮成只蓋長椅那一半的候車亭：不然鏡頭從上面看下來，等車的人、車上的人都被屋頂蓋住 */   /* v923 月台從 37 公分降到 30 公分：一步跨得上去（遊戲一步最多上 34 公分）；靠軌道那一邊畫一條黃線 */
      railStops.push({ name: nm, s: railCum[bi], x, z, y: y + 0.3, tx, tz, nx: -tz * sg, nz: tx * sg });
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
    const prop = (name, px, py, sc, ry, col) => { const [x, z] = P(px, py); if (name === 'stand') stands.push({ x, z, ry: ry || 0 }); if (!A.art2Add) return; const g = new THREE.Group(); g.position.set(x, Math.max(0.2, hAt(x, z)), z); g.rotation.y = ry || 0; town.add(g); A.art2Add(g, name, { s: sc }); if (col) colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: col }); RSV.push([x, z, 1.6]); };
    /* v936 作者：「裡面有很多我們很早就不要的模型，那些我都不要」→ 舊素材包（WizP）的石燈籠、牌樓、木攤子、木推車、木桶、甕、水井、漁網架、木船全部拿掉（村子在 v464、v480 就撤掉了）。prop() 留著備用 */
    /* v926 村子戶外的人和板子在新主島的位置（作者 11/27：把村子戶外的人和攤子搬過來）。
       這裡只決定「站哪裡、面朝哪」（世界座標；face 0＝朝南、π/2＝朝東）；人和板子本身還是 game.js 原本那一份——你人在新主島，game.js 就把他們放到這裡（見 game.js 的 w2Site）。
       位置附近不長樹（RSV）。 */
    const post = (k, x, z, face, o) => { posts[k] = Object.assign({ x: OX + x, z: OZ + z, face }, o || {}); RSV.push([x, z, (o && o.r) || 2.6]); };   /* relax：顧攤的人就在攤位旁邊幾步走動，草地也可以（附近 r 公尺不長樹） */
    { const [x, z] = P(1143, 640); post('orders', x, z, -Math.PI / 2); }                        /* 📋 訂單板：中央市場西邊的牆外，面向西邊的廣場（從圓環大道、活動場地走過來都看得到正面）。v928 從主城廣場搬過來——總規劃寫的是「中央市場（交易、跑商、訂單板）」，v926 我放錯地方 */
    { const [x, z] = P(1044, 580); post('board', x, z, Math.PI); }   /* v942 作者截圖指定：廣場東南邊長椅後面那塊空地，面向廣場 */                                   /* 📌 留言板：主城廣場南邊、出生點的西南，斜斜朝著噴水池和出生點 */
    /* 🔧 阿鐵：釣具店旁邊擺攤（村子裡他也是在釣具店旁邊）。釣具店是商店街最靠港口的那一間，攤子擺在它靠港口那一側的轉角：
       一張工作台（工具箱、虎鉗、線軸、捲線器、幾個假餌）、後面一座竿架靠著四支竿子、一塊掛牌；阿鐵站在工作台後面，面對巷子。竿架上的小旗子會飄 */
    { const d = doors.find(q => q.k === 'tackle'); if (d){ const f = d.face, fx = Math.sin(f), fz = Math.cos(f), lx = Math.cos(f), lz = -Math.sin(f);
        let x = d.x - OX - fx * 3.1 + fx * 1.9 - lx * 6.0, z = d.z - OZ - fz * 3.1 + fz * 1.9 - lz * 6.0, sd2 = 1;   /* sd2：高的東西（竿架、掛牌）放靠房子那一邊，另一邊留空，從港邊看過來才看得到人 */
        if (hit(x, z, 1.2) || hAt(x, z) < 0.25){ x = d.x - OX - fx * 3.1 + fx * 1.9 + lx * 6.0; z = d.z - OZ - fz * 3.1 + fz * 1.9 + lz * 6.0; sd2 = -1; }   /* 那一側被別的東西佔了就換另一側 */
        const y = Math.max(0.2, hAt(x, z)), at = (fw, rt) => [x + fx * fw + lx * rt, z + fz * fw + lz * rt], WD = '#9a6b3f', DK = '#5e3d24';
        { const [bx, bz] = at(0.95, 0); B(parts, WD, 1.7, 0.08, 0.7, bx, y + 0.86, bz, f); B(parts, DK, 1.5, 0.05, 0.5, bx, y + 0.3, bz, f); for (const a of [-0.76, 0.76]) for (const b2 of [-0.27, 0.27]){ const [qx, qz] = at(0.95 + b2, a); B(parts, DK, 0.09, 0.82, 0.09, qx, y + 0.41, qz, f); }
          colliders.push({ t: 'o', x: OX + bx, z: OZ + bz, hw: 0.9, hd: 0.4, c: Math.cos(f), s: Math.sin(f), bw: Math.abs(Math.cos(f)) * 0.9 + Math.abs(Math.sin(f)) * 0.4, bd: Math.abs(Math.sin(f)) * 0.9 + Math.abs(Math.cos(f)) * 0.4 }); }
        { const [qx, qz] = at(0.9, -0.52 * sd2); B(parts, '#c9442e', 0.4, 0.2, 0.24, qx, y + 1.0, qz, f); B(parts, '#8f2a1f', 0.42, 0.04, 0.26, qx, y + 1.12, qz, f); B(parts, '#3a3f47', 0.16, 0.03, 0.04, qx, y + 1.16, qz, f); }                    /* 工具箱 */
        { const [qx, qz] = at(1.16, 0.58); B(parts, '#4a5058', 0.16, 0.13, 0.12, qx, y + 0.965, qz, f); B(parts, '#6b727c', 0.05, 0.1, 0.2, qx, y + 1.02, qz, f); }                                                                  /* 虎鉗 */
        { const [qx, qz] = at(0.82, 0.2); G(parts, '#d7dbe0', new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12).rotateZ(Math.PI / 2).rotateY(f), qx, y + 0.98, qz); G(parts, '#2b2f36', new THREE.CylinderGeometry(0.03, 0.03, 0.13, 8).rotateZ(Math.PI / 2).rotateY(f), qx, y + 0.98, qz); }   /* 捲線器 */
        { const [qx, qz] = at(1.1, 0.05); G(parts, '#3fb7c9', new THREE.TorusGeometry(0.07, 0.03, 6, 12).rotateX(Math.PI / 2), qx, y + 0.93, qz); }                                                                                /* 線軸 */
        [['#e2574c', 0.72, -0.14], ['#f2c230', 0.78, -0.02], ['#4bb57b', 1.02, 0.32]].forEach(([col, fw, rt]) => { const [qx, qz] = at(fw, rt); G(parts, col, new THREE.SphereGeometry(0.035, 6, 5).scale(2, 1, 1).rotateY(f + 0.6), qx, y + 0.93, qz); });   /* 假餌 */
        { const [rx, rz] = at(-1.0, 1.05 * sd2); for (const a of [-0.62, 0.62]){ const [qx, qz] = [rx + lx * a, rz + lz * a]; B(parts, DK, 0.08, 1.7, 0.08, qx, y + 0.85, qz, f); B(parts, DK, 0.1, 0.06, 0.5, qx, y + 0.03, qz, f); } B(parts, WD, 1.4, 0.07, 0.07, rx, y + 1.5, rz, f); B(parts, WD, 1.4, 0.05, 0.05, rx, y + 0.25, rz, f);
          ['#2f89c7', '#3a3f47', '#c94a78', '#e0a12a'].forEach((col, i) => { const a = -0.45 + i * 0.3, g = new THREE.CylinderGeometry(0.01, 0.022, 2.5, 5).translate(0, 1.25, 0).rotateX(0.15).rotateY(f); G(parts, col, g, rx + lx * a - fx * 0.3, y + 0.04, rz + lz * a - fz * 0.3); const h = new THREE.CylinderGeometry(0.028, 0.028, 0.4, 6).translate(0, 0.25, 0).rotateX(0.15).rotateY(f); G(parts, '#2b2f36', h, rx + lx * a - fx * 0.3, y + 0.04, rz + lz * a - fz * 0.3); });   /* 竿架：四支竿子斜靠著 */
          const fl = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, -0.11, 0), new THREE.Vector3(0, -0.22, 0)]), new THREE.MeshBasicMaterial({ color: '#f2c230', side: THREE.DoubleSide })); B(parts, DK, 0.04, 0.75, 0.04, rx + lx * 0.62, y + 2.05, rz + lz * 0.62, f); fl.position.set(rx + lx * 0.62, y + 2.4, rz + lz * 0.62); town.add(fl); tickers.push((dt, t) => { fl.rotation.y = f + 0.9 + Math.sin(t * 2.3) * 0.4 + Math.sin(t * 5.7) * 0.1; });   /* 竿架上的小旗子：會飄 */
          colliders.push({ t: 'c', x: OX + rx, z: OZ + rz, r: 0.75 }); }
        if (A.sign){ const [sx, sz2] = at(0.95, 1.25 * sd2), g = new THREE.Group(); g.position.set(sx, y, sz2); town.add(g); A.sign(g, '阿鐵工坊', '🔧', 0, 0); colliders.push({ t: 'c', x: OX + sx, z: OZ + sz2, r: 0.2 }); }
        post('craft', x, z, f, { r: 4.2, relax: true }); } }
    /* v933 🚤 阿海和他的船：港口西邊第二條棧橋。船停在棧橋西邊（船頭朝外海），阿海站在棧橋上船邊；從這裡坐船去外島。
       voy：dock＝船的位置和船頭方向、edge＝從棧橋跳上船的那一點、out＝開出港的路（之後接到外島的航道） */
    { const pr = piers[1]; if (pr){ const bz = pr.z0 + pr.L * 0.5, dx2 = pr.x - 4.2; post('ferry', pr.x - 0.6, bz - 3.2, -Math.PI / 2);
        posts.voy = { dock: [OX + dx2, OZ + bz, 0], edge: [OX + pr.x - 1.35, OZ + bz], out: [[OX + dx2, OZ + bz + 22], [OX + dx2 - 14, OZ + bz + 70]], arrive: { x: OX + pr.x, z: OZ + pr.z0 + 3, rot: Math.PI } }; } }
    /* v946 自己的小船（平台舟）：新主島港口最西、最東兩條棧橋的外側各停一艘，在水深的地方 */
    posts.kayak = []; for (const [pi, sg] of [[0, -1], [4, 1]]){ const pr = PIERS[pi]; if (!pr) continue; for (const f of [0.7, 0.8, 0.6, 0.9]){ const x = pr.x + sg * 3.4, z = pr.z0 + pr.L * f; if (samp(HG, x, z) < WL - 0.6 && !deck(x, z)){ posts.kayak.push({ x: OX + x, z: OZ + z, rot: 0 }); break; } } }
    /* v933 阿默、阿穎：港口東邊第二條棧橋的尾巴，兩個人一起釣（阿默的船和出海找紅鯊，等外海做好再接） */
    { const pr = piers[3]; if (pr){ post('amo', pr.x + 1.05, pr.z0 + pr.L - 4, Math.PI / 2, { fishing: true }); post('yin', pr.x - 1.05, pr.z0 + pr.L - 5.5, -Math.PI / 2, { fishing: true }); } }
    /* ⚓ 老港：港口中間那條棧橋上，面朝東邊的海釣魚（走棧橋的人從他左邊過）。腳邊一個保冷箱、一個水桶 */
    { const pr = piers[2]; if (pr){ const x = pr.x + 1.05, z = pr.z0 + 7.5; post('gang', x, z, Math.PI / 2, { fishing: true });
        B(parts, '#2f7fa8', 0.52, 0.3, 0.36, x + 0.2, 0.8, z - 1.0); B(parts, '#f4f6f8', 0.54, 0.07, 0.38, x + 0.2, 0.985, z - 1.0); B(parts, '#c8ced6', 0.2, 0.03, 0.04, x + 0.2, 1.035, z - 1.0);
        G(parts, '#8a6038', new THREE.CylinderGeometry(0.17, 0.14, 0.3, 10), x + 0.25, 0.8, z + 0.9); G(parts, '#5fb3d9', new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10), x + 0.25, 0.93, z + 0.9);
        colliders.push({ t: 'c', x: OX + x + 0.2, z: OZ + z - 1.0, r: 0.3 }, { t: 'c', x: OX + x + 0.25, z: OZ + z + 0.9, r: 0.2 }); } }
    /* ---- v927 第二批：阿報、村子大看板、村長、築城守土、老王、阿萍、蔚博士，還有三位釣魚的村民 ---- */
    { const [x, z] = P(990, 547); post('news', x, z, -0.86, { r: 4.2 }); }                     /* 📰 阿報：噴水池和出生點中間偏東，一出生就看得到他（村子裡他也是站在廣場上喊號外） */
    { const [x, z] = P(884, 512); post('tboard', x, z, Math.PI / 2); }                         /* 🏆 村子大看板：廣場西邊，往水族館和往博物館兩條大道的中間，面向噴水池 */
    { const [x, z] = P(948, 359); post('chief', x, z, 0); }                                    /* 村長 阿土伯：村公所門口的左邊，面向廣場（村子裡他也站在村長辦公室門口） */
    { const [x, z] = P(994, 366); post('zc', x, z, 0); }                                       /* 🏰 築城守土的沙盤桌：村公所門口的右邊 */
    { const [x, z] = P(944, 818); post('wang', x, z, 0.5); }                                   /* 漁夫 老王：港邊木棧道上，木桶旁邊，看著海 */
    { const h = street.find(q => q.col === 1 && q.row === 3); if (h){ const f = h.face, fx = Math.sin(f), fz = Math.cos(f), lx = Math.cos(f), lz = -Math.sin(f);   /* 💇 阿萍：商店街東排中間那間美髮沙龍的門口（掛牌在門的另一邊） */
        post('salon', h.x + fx * 2.8 - lx * 1.8, h.z + fz * 2.8 - lz * 1.8, f, { r: 4.2 }); plate('阿萍美髮沙龍', '💇', h.x + fx * (h.d / 2 + 0.9), h.z + fz * (h.d / 2 + 0.9), f); } }
    /* 🔬 蔚博士：平常在水族館入口旁邊。村子裡她每天站在「今天調查的釣點」旁邊——新主島有同一種水的話（海邊、外海、河、溪、湖、紅樹林），game.js 會把她放到 at 裡那一種水最近的岸邊 */
    { const [x, z] = P(640, 410), W = (px, py) => { const q = P(px, py); return [OX + q[0], OZ + q[1]]; }, pe = piers[4];
      post('sci', x + 15.8, z + 2.2, Math.PI / 2, { r: 3.4, at: { sea: W(1440, 794), harbor: pe ? [OX + pe.x, OZ + pe.z0 + pe.L - 1.5] : W(1160, 940), river: W(655, 322), creek: W(775, 258), lake: W(900, 228), mangrove: W(385, 400) } }); }
    /* 釣魚的村民：shore＝站到這附近最近的水邊、面朝水（game.js 用 W2.shore 找）。阿潮在陽光沙灘、小溪在水族館北邊的河岸（靠鎮上這一邊）、阿蘭（紅樹林巡守員）在紅樹林的木棧道上 */
    { const [x, z] = P(1560, 786); post('chao', x, z, 0, { shore: true }); } { const [x, z] = P(600, 325); post('xi', x, z, 0, { shore: true }); } { const [x, z] = P(300, 396); post('lan', x, z, 0, { shore: true }); }
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
  /* 環島小火車（v923 可以坐）：三班車照時刻表繞島一圈，每一站停 9 秒。
     車在哪裡只看「大家共用的時間」（game.js 每一幀把時間傳進 trainStep），所以每個人畫面上的車都在同一個位置，坐在車上的人別人也看得到在同一個位子。
     一班車＝火車頭＋兩節沒有車頂的車廂，每節 4 個位子（兩排長椅，都面向前）。一節車廂是一個 Mesh（顏色寫在頂點上），三班車總共 9 個。 */
  const TRAIN = (() => { const NS = railStops.length; if (!NS) return null; const V = 8, ACC = 1.6, DWELL = 9, NT = 3, GAP = 3.9, SEATS = 8;
    railStops.sort((a, b) => a.s - b.s);
    /* 時刻表：在第 i 站停 DWELL 秒，再開 seg[i].tr 秒到下一站（慢慢加速、等速、慢慢減速） */
    let TC = 0; const seg = railStops.map((q, i) => { const n = railStops[(i + 1) % NS], L = ((((n.s - q.s) % railLen) + railLen) % railLen) || railLen, tr = L >= V * V / ACC ? L / V + V / ACC : 2 * Math.sqrt(L / ACC), o = { L, tr, t0: TC }; TC += DWELL + tr; return o; });
    const state = tau => { tau = ((tau % TC) + TC) % TC; let i = NS - 1; for (let k = 0; k < NS; k++) if (tau < seg[k].t0 + DWELL + seg[k].tr){ i = k; break; } const g = seg[i], u = tau - g.t0, nx = (i + 1) % NS;
      if (u < DWELL) return { s: railStops[i].s, v: 0, at: i, next: nx, leave: DWELL - u, eta: DWELL - u + g.tr };
      const x = u - DWELL, ta = Math.min(V / ACC, g.tr / 2), vp = ACC * ta; let d, v; if (x < ta){ d = 0.5 * ACC * x * x; v = ACC * x; } else if (x < g.tr - ta){ d = 0.5 * ACC * ta * ta + vp * (x - ta); v = vp; } else { const r = g.tr - x; d = g.L - 0.5 * ACC * r * r; v = ACC * r; }
      return { s: railStops[i].s + d, v, at: -1, next: nx, leave: 0, eta: g.tr - x }; };
    /* 車廂的樣子 */
    const trainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05 });
    const vc = (L, hex, g, x, y, z) => { const q = g.index ? g.toNonIndexed() : g; q.translate(x || 0, y || 0, z || 0); const n = q.attributes.position.count, c = new Float32Array(n * 3); col2.set(hex); for (let i = 0; i < n; i++){ c[i * 3] = col2.r; c[i * 3 + 1] = col2.g; c[i * 3 + 2] = col2.b; } q.setAttribute('color', new THREE.BufferAttribute(c, 3)); L.push(q); };
    const bx = (L, hex, w, h, d, x, y, z) => vc(L, hex, new THREE.BoxGeometry(w, h, d), x, y, z);
    const wheel = (L, r, x, z) => { vc(L, '#30353d', new THREE.CylinderGeometry(r, r, 0.16, 14).rotateZ(Math.PI / 2), x, r + 0.06, z); vc(L, '#f2c230', new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.19, 8).rotateZ(Math.PI / 2), x, r + 0.06, z); };
    const DARK = '#3a3f47', CREAM = '#fff6e0', GOLD = '#f2c230', WOOD = '#c99a66', RED = '#d9393b', BENCH_Z = [0.75, -0.75], SEAT_H = 1.11;
    const engine = () => { const L = []; bx(L, DARK, 1.5, 0.2, 3.3, 0, 0.58, 0);
      vc(L, RED, new THREE.CylinderGeometry(0.52, 0.52, 1.85, 16).rotateX(Math.PI / 2), 0, 1.2, 0.62); vc(L, DARK, new THREE.CylinderGeometry(0.56, 0.56, 0.12, 16).rotateX(Math.PI / 2), 0, 1.2, 1.58);
      for (const z of [0.15, 1.05]) vc(L, GOLD, new THREE.CylinderGeometry(0.545, 0.545, 0.07, 16).rotateX(Math.PI / 2), 0, 1.2, z);
      vc(L, DARK, new THREE.CylinderGeometry(0.27, 0.17, 0.72, 10), 0, 2.02, 1.12); vc(L, GOLD, new THREE.CylinderGeometry(0.31, 0.31, 0.07, 10), 0, 2.4, 1.12); vc(L, GOLD, new THREE.SphereGeometry(0.24, 10, 8), 0, 1.72, 0.42);
      vc(L, '#fff2b0', new THREE.CylinderGeometry(0.15, 0.15, 0.14, 10).rotateX(Math.PI / 2), 0, 1.86, 1.6); bx(L, GOLD, 1.36, 0.26, 0.3, 0, 0.52, 1.78); bx(L, DARK, 1.1, 0.12, 0.2, 0, 0.36, 1.92);
      bx(L, RED, 1.6, 1.3, 1.2, 0, 1.33, -0.95); bx(L, CREAM, 1.84, 0.12, 1.5, 0, 2.05, -0.95); for (const sx of [-1, 1]) bx(L, '#bfe3f7', 0.05, 0.46, 0.62, sx * 0.81, 1.56, -0.95); bx(L, '#bfe3f7', 1.0, 0.36, 0.05, 0, 1.66, -0.345); bx(L, GOLD, 1.64, 0.07, 1.24, 0, 0.72, -0.95);
      for (const sx of [-1, 1]){ wheel(L, 0.4, sx * 0.78, -1.05); wheel(L, 0.4, sx * 0.78, -0.2); wheel(L, 0.28, sx * 0.78, 1.0); bx(L, '#9aa3ad', 0.05, 0.08, 0.95, sx * 0.88, 0.46, -0.62); }
      bx(L, DARK, 0.12, 0.1, 0.5, 0, 0.5, -1.85); return mergeGeometries(L, false); };
    const coach = hex => { const L = []; bx(L, DARK, 1.6, 0.18, 3.4, 0, 0.6, 0); bx(L, '#b98a5a', 1.7, 0.08, 3.4, 0, 0.73, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]){ bx(L, hex, 0.08, 0.5, 1.12, sx * 0.83, 1.02, sz * 1.12); bx(L, CREAM, 0.11, 0.06, 1.12, sx * 0.83, 1.3, sz * 1.12); bx(L, CREAM, 0.1, 0.72, 0.1, sx * 0.81, 1.12, sz * 1.63); vc(L, GOLD, new THREE.SphereGeometry(0.09, 8, 6), sx * 0.81, 1.53, sz * 1.63); }
      for (const sz of [-1, 1]){ bx(L, hex, 1.7, 0.56, 0.08, 0, 1.05, sz * 1.66); bx(L, CREAM, 1.74, 0.06, 0.11, 0, 1.36, sz * 1.66); }
      for (const zb of BENCH_Z){ bx(L, WOOD, 1.34, 0.08, 0.42, 0, SEAT_H - 0.04, zb); bx(L, WOOD, 1.34, 0.42, 0.07, 0, SEAT_H + 0.23, zb - 0.235); for (const sx of [-1, 1]) bx(L, DARK, 0.08, 0.3, 0.36, sx * 0.56, 0.92, zb); }
      /* 沒有車頂：鏡頭從後上方看下來才看得到坐在裡面的人 */ for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheel(L, 0.34, sx * 0.78, sz * 1.05); bx(L, DARK, 0.12, 0.1, 0.5, 0, 0.5, -1.85);
      return mergeGeometries(L, false); };
    const COLS = ['#3c8fd8', '#3fae7a', '#f0a02a'], engGeo = engine(), trains = [], cur = [], seatPos = [];
    for (let k = 0; k < NT; k++){ const coachGeo = coach(COLS[k % COLS.length]), cars = []; for (let c = 0; c < 3; c++){ const m = new THREE.Mesh(c ? coachGeo : engGeo, trainMat); m.castShadow = true; m.receiveShadow = true; root.add(m); cars.push(m); } trains.push(cars); cur.push(null); for (let i = 0; i < SEATS; i++) seatPos.push({ x: 0, y: 0, z: 0, face: 0 }); }
    /* 煙：火車頭在動的時候煙囪冒白煙（所有的煙是同一個 Points，一次畫完） */
    const NP = 30, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 4), pAge = new Float32Array(NP).fill(9), pVel = new Float32Array(NP * 3), pGeo = new THREE.BufferGeometry(); for (let i = 0; i < NP; i++){ pPos[i * 3 + 1] = -50; pCol[i * 4] = pCol[i * 4 + 1] = pCol[i * 4 + 2] = 1; }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
    const pTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const puffs = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: pTex, size: 1.5, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true })); puffs.frustumCulled = false; root.add(puffs);
    let pNext = 0, pAcc = [0, 0, 0], now = 0;
    const step = (t, dt) => { now = t; let smoke = false;
      for (let k = 0; k < NT; k++){ const st = cur[k] = state(t + k * TC / NT), cars = trains[k], run = st.v / V;
        for (let c = 0; c < 3; c++){ const s0 = st.s + GAP * 1.5 - c * GAP, [x, z] = railAt(s0), pf = railAt(s0 + 1.6), pb = railAt(s0 - 1.6), a = Math.atan2(pf[0] - pb[0], pf[1] - pb[1]), m = cars[c],   /* v938 車頭方向看前後 1.6 公尺：轉彎時慢慢轉，不會一格一格跳 */ y = Math.max(0.2, hAt(x, z)) + 0.08; m.position.set(x, y + Math.sin(t * 9 + c * 1.7 + k) * 0.012 * run, z); m.rotation.set(0, a, Math.sin(t * 5.3 + c * 2.1 + k) * 0.012 * run);
          if (c){ const ca = Math.cos(a), sa = Math.sin(a); for (let j = 0; j < 4; j++){ const lx = j % 2 ? 0.36 : -0.36, lz = BENCH_Z[j >> 1], q = seatPos[k * SEATS + (c - 1) * 4 + j]; q.x = OX + x + lx * ca + lz * sa; q.z = OZ + z - lx * sa + lz * ca; q.y = y + SEAT_H; q.face = a; } }
          else if (st.v > 0.4 && dt > 0){ pAcc[k] += dt * (1.6 + run * 4.5); if (pAcc[k] >= 1){ pAcc[k] = 0; const i = pNext; pNext = (pNext + 1) % NP; pAge[i] = 0; pPos[i * 3] = x + Math.sin(a) * 1.12; pPos[i * 3 + 1] = y + 2.5; pPos[i * 3 + 2] = z + Math.cos(a) * 1.12; pVel[i * 3] = (Math.random() - 0.5) * 0.3; pVel[i * 3 + 1] = 1.1 + Math.random() * 0.5; pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3; } } } }
      for (let i = 0; i < NP; i++){ if (pAge[i] > 2.4){ if (pCol[i * 4 + 3] !== 0){ pCol[i * 4 + 3] = 0; smoke = true; } continue; } pAge[i] += dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; pVel[i * 3 + 1] *= 1 - 0.5 * dt; pCol[i * 4 + 3] = Math.max(0, 0.75 * (1 - pAge[i] / 2.4)); smoke = true; }
      if (smoke){ pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; } };
    step(0, 0);
    return { step, api: { n: NT, seats: SEATS, cycle: TC, dwell: DWELL, len: railLen, stops: railStops.map(q => ({ name: q.name, x: OX + q.x, z: OZ + q.z, y: q.y, tx: q.tx, tz: q.tz, nx: q.nx, nz: q.nz })),
      state: k => cur[k], seat: (k, i) => seatPos[k * SEATS + i] || null,
      atStop: i => { for (let k = 0; k < NT; k++) if (cur[k] && cur[k].at === i) return { k, leave: cur[k].leave }; return null; },
      arrive: i => { let best = 1e9; for (let k = 0; k < NT; k++){ const tau = (((now + k * TC / NT) % TC) + TC) % TC; let d = seg[i].t0 - tau; if (d < 0) d += TC; if (d < best) best = d; } return best; } } }; })();
  /* 月台：站得上去（順著軌道方向的長方形，5.4 × 2.6 公尺） */
  const railDist = (lx, lz) => { let bd = 1e9; const n = railLine.length; for (let i = 0; i < n; i++){ const a = railLine[i], b = railLine[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], u = clamp(((lx - a[0]) * dx + (lz - a[1]) * dz) / ((dx * dx + dz * dz) || 1), 0, 1), d = Math.hypot(lx - a[0] - dx * u, lz - a[1] - dz * u); if (d < bd) bd = d; } return bd; };   /* 離鐵軌中心線幾公尺 */
  const platAt = (lx, lz) => { for (const q of railStops){ const dx = lx - q.x, dz = lz - q.z; if (Math.abs(dx) > 3.2 || Math.abs(dz) > 3.2) continue; if (Math.abs(dx * q.tx + dz * q.tz) < 2.7 && Math.abs(-dx * q.tz + dz * q.tx) < 1.3) return q; } return null; };
  /* 港口的船：五艘停在棧橋邊跟著浪晃，兩艘在外面的航道上慢慢開（作者：「看著船開來開去也很療癒」） */
  { const boat = (hex, s) => { if (TWB && TWB.boat){ const g = new THREE.Group(); g.add(TWB.boat()); g.scale.setScalar(s * 0.8); root.add(g); return g; }   /* 村子的漁船 */ const g = new THREE.Group(), parts = {}; G(parts, '#ffffff', new THREE.CylinderGeometry(1, 0.72, 0.9, 10, 1).scale(1, 1, 2.6), 0, 0.25, 0); G(parts, hex, new THREE.CylinderGeometry(1.04, 1.04, 0.18, 10, 1).scale(1, 1, 2.62), 0, 0.72, 0); B(parts, '#f7efe1', 1.3, 0.9, 1.6, 0, 1.2, -0.5); B(parts, hex, 1.5, 0.14, 1.8, 0, 1.72, -0.5); B(parts, '#8bb6e6', 1.32, 0.4, 0.06, 0, 1.28, 0.31); flush(parts, g); g.scale.setScalar(s); root.add(g); return g; };
    const moored = [[-170, 60, '#2c6fb5', 1.0], [-90, 95, '#c0392b', 1.25], [0, 118, '#2c6fb5', 1.15], [90, 95, '#f0a02a', 1.2], [170, 62, '#3fbf9d', 0.95]].map(([dx, dy, hex, s], i) => { const [x, z] = P(990 + dx + (i % 2 ? 22 : -22), 835 + dy), g = boat(hex, s); g.position.set(x, WL, z); g.rotation.y = i % 2 ? 0.08 : -0.06; return { g, x, z, ph: i * 1.7 }; });
    const lanes = [curve([[620,960],[820,1010],[1060,1000],[1250,1040],[1420,960],[1330,900],[1060,930],[800,930]], true), curve([[1690,880],[1760,640],[1750,420],[1690,300],[1730,520],[1700,760]], true)];
    const sail = lanes.map((L, k) => { const cum = [0]; for (let i = 1; i <= L.length; i++){ const a = L[i - 1], b = L[i % L.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return { L, cum, g: boat(k ? '#a46ad8' : '#3fbf9d', 1.3), sp: k ? 2.2 : 2.8 }; });
    tickers.push((dt, t) => { for (const m of moored){ m.g.position.y = WL - 0.12 + Math.sin(t * 1.1 + m.ph) * 0.06; m.g.rotation.z = Math.sin(t * 0.9 + m.ph) * 0.04; m.g.rotation.x = Math.sin(t * 0.7 + m.ph * 2) * 0.025; }
      for (const b of sail){ const LEN = b.cum[b.cum.length - 1], s = (t * b.sp) % LEN; let lo = 0, hi = b.cum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (b.cum[m] <= s) lo = m; else hi = m; } const p0 = b.L[lo], p1 = b.L[(lo + 1) % b.L.length], k = (s - b.cum[lo]) / Math.max(1e-6, b.cum[lo + 1] - b.cum[lo]);
        b.g.position.set(p0[0] + (p1[0] - p0[0]) * k, WL - 0.1 + Math.sin(t * 1.3) * 0.05, p0[1] + (p1[1] - p0[1]) * k); const a = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]); let d = a - b.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); b.g.rotation.y += d * Math.min(1, dt * 1.5); b.g.rotation.z = Math.sin(t * 1.1) * 0.03; } }); }
  /* v950 珊瑚礁的樣子：水底的珊瑚（樹枝、腦紋、扇子、管子）、礁岩上的石頭、一群熱帶小魚繞著游 */
  { const parts = {}, rg = new THREE.Group(); root.add(rg); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const CC = ['#ff6f6a', '#ff9a2e', '#b27cff', '#2fd6b0', '#ffd84a', '#ff5fa8'], cparts = {};
    for (let k = 0; k < 420; k++){ const px = 1505 + rnd() * 255, py = 806 + rnd() * 160, [x, z] = P(px, py); if (samp(sdReef, x, z) < 0.3 || samp(sdRock, x, z) > -0.6 || samp(sdLand, x, z) > -0.3) continue;
      const y = hAt(x, z), c = CC[Math.floor(rnd() * CC.length)], t = rnd(), room = WL - 0.12 - y; if (room < 0.15) continue;
      if (t < 0.35){ for (let b = 0; b < 4; b++){ const a = rnd() * 6.28, tilt = 0.25 + rnd() * 0.45, L = Math.min(room, 0.35 + rnd() * 0.3), g = new THREE.CylinderGeometry(0.05, 0.08, L, 5); g.translate(0, L / 2, 0); g.rotateZ(tilt); g.rotateY(a); G(cparts, c, g, x, y, z); } }   /* 樹枝珊瑚 */
      else if (t < 0.6){ const r = 0.3 + rnd() * 0.3; G(cparts, c, new THREE.SphereGeometry(r, 9, 6, 0, 6.2832, 0, Math.PI / 2).scale(1, Math.min(0.7, room * 0.9 / r), 1), x, y, z); }   /* 腦紋珊瑚 */
      else if (t < 0.8){ const r = Math.min(room, 0.32 + rnd() * 0.2), g = new THREE.CircleGeometry(r, 9, 0, Math.PI); g.rotateY(rnd() * 6.28); G(cparts, c, g, x, y, z); }   /* 扇子 */
      else { for (let b = 0; b < 5; b++){ const L = Math.min(room, 0.12 + rnd() * 0.22), g = new THREE.CylinderGeometry(0.035, 0.035, L, 6, 1, true); g.translate((rnd() - 0.5) * 0.18, L / 2, (rnd() - 0.5) * 0.18); G(cparts, c, g, x, y, z); } } }   /* 管子 */
    for (const B of BOULDERS){ const g = new THREE.DodecahedronGeometry(B.r, 0); g.scale(1, 0.45, 1); G(parts, B.dark ? '#7d776a' : '#8f8878', g, B.x, B.y, B.z); }   /* v951 跟地面高度同一份 */
    flush(parts, rg);
    for (const hex in cparts){ const m = new THREE.Mesh(mergeGeometries(cparts[hex], false), new THREE.MeshLambertMaterial({ color: hex, emissive: new THREE.Color(hex).multiplyScalar(0.35), side: THREE.DoubleSide })); m.receiveShadow = true; rg.add(m); }   /* 珊瑚自己帶一點亮，隔著水也看得出粉紅、橘、紫 */
    const fishG = new THREE.Group(); rg.add(fishG); const FC = ['#ffd23f', '#3fb8ff', '#ff7a4a', '#ffffff', '#7fe08a'], school = [];
    for (let k = 0; k < 18; k++){ const f = new THREE.Group(), c = FC[k % FC.length], m = new THREE.MeshLambertMaterial({ color: c }); const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5).scale(1, 0.75, 1.9), m), tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4).rotateX(-Math.PI / 2), m); tail.position.z = -0.15; f.add(body, tail); fishG.add(f);
      const [cx, cz] = P(1560 + rnd() * 160, 840 + rnd() * 100); school.push({ f, tail, cx, cz, r: 0.6 + rnd() * 1.4, sp: (0.5 + rnd() * 0.6) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, y: Math.min(WL - 0.18, hAt(cx, cz) + 0.3) }); }
    tickers.push((dt, t) => { for (const q of school){ const a = q.ph + t * q.sp, x = q.cx + Math.cos(a) * q.r, z = q.cz + Math.sin(a) * q.r; q.f.position.set(x, q.y + Math.sin(t * 2 + q.ph) * 0.04, z); q.f.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(q.sp), Math.cos(a) * Math.sign(q.sp)) ; q.tail.rotation.y = Math.sin(t * 12 + q.ph) * 0.5; } }); }
  { const [x, z] = P(1660, 930); label('珊瑚礁', x, 6, z); }
  /* v945 外島照規劃圖排在新主島四周的海平線上（作者 11/27：外島要放遠）：從新主島看出去，每個方向有一座看得到的島，坐阿海的船出海就往那個方向開。
     島本身（釣點、伺服器）沒有搬，這裡只是遠景：一直保持在鏡頭外 185 公尺、不受霧影響，看起來像在很遠的海上 */
  const HORIZON = { old: [0, -1], frostdock: [-0.8, -0.6], greendock: [0.45, -0.89], wilddock: [0.99, 0.12], mystdock: [0.66, 0.75], abyssdock: [-0.08, 1], reef: [-0.94, 0.33] };
  { const hz = new THREE.Group(); root.add(hz); const FOGC = new THREE.Color('#b7e5df'), mats = {}, M = (hex, k) => { const key = hex + (k || 0.38); if (!mats[key]){ const c = new THREE.Color(hex).lerp(FOGC, k == null ? 0.38 : k); mats[key] = new THREE.MeshLambertMaterial({ color: c, fog: false }); } return mats[key]; };
    const add = (g, geo, hex, x, y, z, k) => { const m = new THREE.Mesh(geo, M(hex, k)); m.position.set(x, y, z); g.add(m); return m; };
    const cone = (r, h, n) => new THREE.ConeGeometry(r, h, n || 7), hill = (r, h) => new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1);
    const isl = {}, smoke = [];
    for (const id in HORIZON){ const g = new THREE.Group(); hz.add(g); isl[id] = g;
      if (id === 'old'){ add(g, hill(26, 9), '#7fae66', 0, 0, 0); add(g, hill(14, 7), '#6f9e5a', -16, 0, 4); for (let i = 0; i < 9; i++) add(g, new THREE.BoxGeometry(3, 2.6, 3), ['#f2b6c0', '#f4d9a0', '#b9d9ee', '#fff6e0'][i % 4], -14 + i * 3.6, 2 + Math.sin(i) * 1.5, 14 - (i % 3) * 3); add(g, new THREE.CylinderGeometry(0.9, 1.2, 9, 8), '#ffffff', 22, 4.5, 10); }
      else if (id === 'frostdock'){ add(g, hill(24, 5), '#dfeef5', 0, 0, 0, 0.3); for (const [x, h, r] of [[-8, 22, 9], [6, 28, 10], [16, 16, 7], [-18, 13, 6]]) add(g, cone(r, h, 6), '#f4fbff', x, h / 2, -2, 0.25); add(g, cone(10, 4, 6), '#bfe0ee', 6, 26, -2, 0.25); }
      else if (id === 'greendock'){ add(g, hill(22, 14), '#3f7d4a', 0, 0, 0); for (let i = 0; i < 8; i++) add(g, cone(2.6, 9, 6), '#2f6a3c', -15 + i * 4.2, 9 + Math.sin(i * 1.7) * 3, 3); }
      else if (id === 'wilddock'){ add(g, hill(20, 6), '#e8d6a2', 0, 0, 0, 0.3); add(g, hill(14, 9), '#5f9b55', -3, 0, -2); for (let i = 0; i < 5; i++){ add(g, new THREE.CylinderGeometry(0.35, 0.45, 9, 5), '#8a6a44', -9 + i * 4.5, 7.5, 6); add(g, cone(3.4, 2, 6), '#4c8f47', -9 + i * 4.5, 12, 6); } }
      else if (id === 'mystdock'){ add(g, hill(24, 5), '#5a5148', 0, 0, 0); add(g, new THREE.CylinderGeometry(6, 20, 26, 9, 1, true), '#4a4038', 0, 13, 0); add(g, new THREE.CylinderGeometry(6.2, 6.2, 0.8, 9), '#ff7a3a', 0, 26, 0, 0.15); { const sg = new THREE.IcosahedronGeometry(3.4, 1); for (let i = 0; i < 6; i++){ const m = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: '#e4dfda', fog: false, transparent: true, opacity: 0.45, depthWrite: false })); g.add(m); smoke.push([m, i]); } } }
      else if (id === 'abyssdock'){ for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) add(g, new THREE.CylinderGeometry(0.8, 0.8, 9, 6), '#6c7a86', x, 4.5, z); add(g, new THREE.BoxGeometry(18, 1.6, 18), '#e7eef2', 0, 9, 0); add(g, new THREE.BoxGeometry(7, 6, 7), '#ffcf3f', -3, 13, 0); add(g, new THREE.CylinderGeometry(0.5, 0.5, 14, 6), '#d9393b', 6, 16, 4); }
      else if (id === 'reef'){ add(g, hill(18, 3.5), '#efe2b8', 0, 0, 0, 0.3); add(g, new THREE.BoxGeometry(6, 4, 5), '#f2b6c0', -2, 3.5, 0); add(g, new THREE.ConeGeometry(4.6, 2.6, 4).rotateY(Math.PI / 4), '#c0503a', -2, 6.8, 0); add(g, hill(8, 6), '#6fae5f', 9, 0, -3); } }
    tickers.push((dt, t) => { const cx = camera.position.x - OX, cz = camera.position.z - OZ; for (const id in isl){ const d = HORIZON[id], g = isl[id]; g.position.set(cx + d[0] * 185, WL - 0.6, cz + d[1] * 185); g.rotation.y = Math.atan2(-d[0], -d[1]); g.scale.setScalar(id === 'mystdock' ? 1.05 : 1.35); }
      for (const [m, i] of smoke){ const k = ((t * 0.08 + i / 6) % 1); m.position.y = 27 + k * 22; m.position.x = k * 9 + Math.sin(i * 2.3) * 2; m.position.z = Math.cos(i * 1.7) * 2; m.scale.setScalar(0.5 + k * 1.6); m.material.opacity = 0.5 * (1 - k); } }); }
  /* 瀑布：從山上流進湖裡，水一直往下流 */
  { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#bfeaf6'; c.fillRect(0, 0, 64, 128); let s0 = 9; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; }; for (let i = 0; i < 70; i++){ c.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`; c.fillRect(r() * 64, r() * 128, 2 + r() * 3, 14 + r() * 26); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    const a = P(785, 128), b = P(785, 192), n = 14, pos = [], uv = [], idx = []; let len = 0, py = 0, pz = 0;
    for (let i = 0; i <= n; i++){ const k = i / n, x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k), y = Math.max(WL + 0.02, hAt(x, z)) + 0.12; if (i) len += Math.hypot(y - py, z - pz); py = y; pz = z; pos.push(x - 1.3, y, z, x + 1.3, y, z); uv.push(0, -len / 5, 1, -len / 5); if (i < n){ const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.92, side: THREE.DoubleSide })); root.add(m); tickers.push((dt, t) => { tx.offset.y = t * 0.9; }); }

  /* ===== v929 森林冒險區的內容（作者 11/27 說「好」）：瀑布下的深潭、山洞、護林員小屋 ===== */
  const benches = [];   /* 可以坐的長椅（世界座標）：game.js 接到 CHAIRS */
  { const parts = {}, ROCK = ['#7d7a70', '#8f8a7c', '#6e6b62'], fg = new THREE.Group(); root.add(fg);
    const rock = (x, y, z, r, k, sy) => { const g = new THREE.DodecahedronGeometry(r, 0); g.scale(1, sy || 0.7, 1); g.rotateY(k * 1.7); G(parts, ROCK[k % 3], g, x, y, z); };
    /* --- 瀑布下的深潭：一圈大石頭、水花和水霧往上冒、潭面一圈一圈的波紋 --- */
    { const [cx, cz] = P(POOLC[0], POOLC[1]), R0 = POOLR * S;
      for (let i = 0; i < 15; i++){ const a = i / 15 * 6.2832 + 0.3; if (Math.cos(a) > 0.55 && Math.sin(a) > -0.2) continue;   /* 東南邊留一個缺口（往河流出去） */ const r = R0 + 0.5 + (i % 3) * 0.3, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; rock(x, Math.max(WL, hAt(x, z)) + 0.15, z, 0.55 + (i % 4) * 0.18, i, 0.65); }
      const [wx, wz] = P(785, 192), wy = Math.max(WL, hAt(wx, wz));
      /* 水花：瀑布落下的地方一直有白色的小水珠往上噴、落下 */
      const N = 46, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++){ seed.push([Math.random() * 6.28, 0.6 + Math.random() * 1.4, Math.random()]); }
      pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); const mist = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0.75, depthWrite: false })); fg.add(mist);
      const foam = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })); foam.position.set(wx, WL + 0.03, wz + 0.8); fg.add(foam);
      const foam2 = foam.clone(); foam2.material = foam.material.clone(); fg.add(foam2);
      tickers.push((dt, t) => { const a = pg.attributes.position.array; for (let i = 0; i < N; i++){ const [ang, sp, ph] = seed[i], u = (t * 0.9 + ph) % 1, r = 0.3 + u * sp; a[i * 3] = wx + Math.cos(ang) * r; a[i * 3 + 1] = WL + 0.1 + Math.sin(u * Math.PI) * (0.8 + sp * 0.5); a[i * 3 + 2] = wz + 0.8 + Math.sin(ang) * r * 0.8; } pg.attributes.position.needsUpdate = true;
        const u1 = (t * 0.45) % 1, u2 = (t * 0.45 + 0.5) % 1; foam.scale.setScalar(1 + u1 * 2.6); foam.material.opacity = 0.55 * (1 - u1); foam2.scale.setScalar(1 + u2 * 2.6); foam2.material.opacity = 0.55 * (1 - u2); });
      label('清溪潭', cx, wy + 6.5, cz, 0.7); }
    /* --- 山洞：大山西南邊的山坡上，從西邊的森林步道岔一條小路過去。洞口朝西南（對著步道），往山裡走 9 公尺；
           裡面暗暗的，石壁上長著會發光的水晶和小蘑菇（一明一暗慢慢呼吸）、洞頂有水一滴一滴滴下來、空中飄著發光的孢子 --- */
    { const { ex, ez, face, fx, fz, rx, rz, LEN, W, HT } = CAVE;   /* face：洞口朝外的方向（背對山頂） */
      const at = (u, v) => [ex - fx * u + rx * v, ez - fz * u + rz * v], fl = u => { const [x, z] = at(u, 0); return hAt(x, z); };   /* u：往洞裡幾公尺；v：往右幾公尺 */
      const y0 = CAVE.y0, y1 = CAVE.y1, pitch = Math.atan2(y1 - y0, LEN);
      const cave = new THREE.Group(); cave.position.set(ex, y0, ez); cave.rotation.order = 'YXZ'; cave.rotation.y = face + Math.PI; cave.rotation.x = -pitch; fg.add(cave);   /* 洞的自己座標：+z 往洞裡 */
      const cp = {}, CB = (hex, w, h, d, x, y, z, rx2, ry, rz2) => { const g = new THREE.BoxGeometry(w, h, d); if (rx2 || ry || rz2) g.rotateX(rx2 || 0).rotateY(ry || 0).rotateZ(rz2 || 0); g.translate(x, y, z); (cp[hex] = cp[hex] || []).push(g.toNonIndexed()); };
      /* 洞壁：半個圓筒（裡面那一面），外面再蓋一層凹凸的大石頭，看起來像山長出來的 */
      for (const v of [-1, 1]) CB('#4a4740', 0.3, HT + 0.6, LEN + 0.2, v * (W + 0.15), (HT + 0.6) / 2 - 0.3, LEN / 2 + 0.6);   /* 兩邊石壁、洞頂（從洞口往裡 0.5 公尺開始，洞口留給外面的大石頭） */
      CB('#3f3c36', 2 * W + 0.6, 0.3, LEN + 0.2, 0, HT + 0.15, LEN / 2 + 0.6);
      CB('#3d3a34', 2 * W + 0.6, HT + 0.4, 0.5, 0, (HT + 0.4) / 2 - 0.2, LEN + 0.1);   /* 最裡面的石壁 */
      const cm = new THREE.Group(); cave.add(cm);
      for (const hex in cp){ const m = new THREE.Mesh(mergeGeometries(cp[hex], false), new THREE.MeshStandardMaterial({ color: hex, roughness: 1, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; cm.add(m); }
      { const op = {}; let k = 0; for (let u = -0.2; u <= LEN + 0.4; u += 1.5) for (const v of [-1, 1]){ const g = new THREE.DodecahedronGeometry(1.25 + (k % 3) * 0.35, 0).scale(1, 0.9, 1.1).rotateY(k * 1.3); g.translate(v * (W + 0.9 + (k % 2) * 0.3), 0.9 + (k % 3) * 0.4, u); (op[ROCK[k % 3]] = op[ROCK[k % 3]] || []).push(g.toNonIndexed()); k++; }
        for (let u = 1.4; u <= LEN + 0.4; u += 1.6){ const g = new THREE.DodecahedronGeometry(1.5 + (k % 3) * 0.3, 0).scale(1.3, 0.55, 1).rotateY(k); g.translate(((k % 3) - 1) * 0.6, HT + 0.35, u); (op[ROCK[k % 3]] = op[ROCK[k % 3]] || []).push(g.toNonIndexed()); k++; }   /* 洞頂 */
        for (const v of [-1, 1]){ const g = new THREE.DodecahedronGeometry(1.1, 0).scale(0.8, 1.6, 0.8).rotateY(v); g.translate(v * (W + 0.35), 1.3, -0.25); (op[ROCK[1]] = op[ROCK[1]] || []).push(g.toNonIndexed()); }   /* 洞口兩邊的大石柱 */
        for (const hex in op){ const m = new THREE.Mesh(mergeGeometries(op[hex], false), new THREE.MeshStandardMaterial({ color: hex, roughness: 1, flatShading: true })); m.castShadow = true; m.receiveShadow = true; cm.add(m); } }
      /* 會發光的水晶、蘑菇：一明一暗慢慢呼吸（不用燈，用自己發光的材質） */
      const glow = [];
      const crystal = (u, v, y, h, col, tilt) => { h *= 1.6; const m = new THREE.Mesh(new THREE.ConeGeometry(0.14 + h * 0.1, h, 5), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, roughness: 0.3, transparent: true, opacity: 0.9 })); m.position.set(v, y + h / 2, u); m.rotation.z = tilt; cave.add(m); glow.push(m.material); };
      [[2.2, -1.35, 0.05, 0.6, '#6fe3ff', 0.35], [2.5, -1.3, 0.05, 0.38, '#6fe3ff', 0.2], [4.6, 1.3, 0.05, 0.7, '#b08cff', -0.35], [4.9, 1.38, 0.05, 0.42, '#b08cff', -0.15], [7.2, -1.2, 0.05, 0.55, '#6fe3ff', 0.3], [8.3, 0.9, 0.05, 0.8, '#b08cff', -0.25], [8.6, 0.5, 0.05, 0.45, '#6fe3ff', -0.1], [6.0, -1.0, 2.25, 0.4, '#6fe3ff', 2.6], [3.5, 0.9, 2.35, 0.35, '#b08cff', 3.6]].forEach(c => crystal(...c));
      { const stem = new THREE.MeshStandardMaterial({ color: '#e8e2cf', roughness: 0.9 }); [[1.6, 1.4], [3.2, -1.45], [5.6, 1.4], [6.4, 1.3], [7.8, -1.35]].forEach(([u, v], i) => { const cap = new THREE.MeshStandardMaterial({ color: '#9dffb0', emissive: '#59ff8a', emissiveIntensity: 0.9, roughness: 0.6 }); for (let k = 0; k < 3; k++){ const s2 = 0.6 + k * 0.25, st = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s2, 0.03 * s2, 0.18 * s2, 5), stem), cp2 = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s2, 8, 5, 0, 6.29, 0, 1.6), cap); const ox = (k - 1) * 0.13, oz = (k % 2) * 0.1; st.position.set(v + ox, 0.09 * s2, u + oz); cp2.position.set(v + ox, 0.18 * s2, u + oz); cave.add(st, cp2); } glow.push(cap); }); }
      /* 洞頂滴水：三個地方輪流滴，落到地上濺一下 */
      const drops = [[3.0, 0.4], [5.8, -0.5], [7.6, 0.3]].map(([u, v], i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4).scale(1, 1.6, 1), new THREE.MeshBasicMaterial({ color: '#cfefff' })); d.position.set(v, HT - 0.4, u); cave.add(d); const pud = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fb8d8', transparent: true, opacity: 0.45, depthWrite: false })); pud.position.set(v, 0.03, u); cave.add(pud); const rp = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); rp.position.set(v, 0.04, u); cave.add(rp); return { d, rp, ph: i * 0.9, top: HT - 0.4 }; });
      /* 空中飄的發光孢子 */
      const NS = 26, sg = new THREE.BufferGeometry(), sp = new Float32Array(NS * 3), sb = []; for (let i = 0; i < NS; i++){ sb.push([(Math.random() - 0.5) * 2.6, 0.4 + Math.random() * 2, 0.8 + Math.random() * (LEN - 1.2), Math.random() * 6.28]); } sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const spores = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#b8ffd0', size: 0.09, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); cave.add(spores);
      tickers.push((dt, t) => { for (let i = 0; i < glow.length; i++) glow[i].emissiveIntensity = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7));
        for (const q of drops){ const u = ((t + q.ph) % 2.7) / 2.7; if (u < 0.75){ q.d.visible = u > 0.15; q.d.position.y = q.top - Math.max(0, (u - 0.15) / 0.6) ** 2 * (q.top - 0.05); q.rp.material.opacity = 0; } else { q.d.visible = false; const k = (u - 0.75) / 0.25; q.rp.scale.setScalar(1 + k * 4); q.rp.material.opacity = 0.7 * (1 - k); } }
        const a = sg.attributes.position.array; for (let i = 0; i < NS; i++){ const [v, y, u, ph] = sb[i]; a[i * 3] = v + Math.sin(t * 0.4 + ph) * 0.3; a[i * 3 + 1] = y + Math.sin(t * 0.6 + ph * 2) * 0.25; a[i * 3 + 2] = u + Math.cos(t * 0.3 + ph) * 0.3; } sg.attributes.position.needsUpdate = true; });
      /* 碰撞：兩邊石壁、最裡面；洞口外面兩根石柱。洞外的山坡不能從旁邊爬到洞頂上 */
      const oc = (u, v, hw, hd) => { const [x, z] = at(u, v), c = Math.cos(face), sn = Math.sin(face); colliders.push({ t: 'o', x: OX + x, z: OZ + z, hw, hd, c, s: sn, bw: Math.abs(c) * hw + Math.abs(sn) * hd, bd: Math.abs(sn) * hw + Math.abs(c) * hd, big: true }); };
      oc(LEN / 2, -(W + 0.35), 0.35, LEN / 2 + 0.6); oc(LEN / 2, W + 0.35, 0.35, LEN / 2 + 0.6); oc(LEN + 0.35, 0, W + 0.7, 0.3); oc(LEN / 2, -(W + 2.6), 1.9, LEN / 2 + 0.8); oc(LEN / 2, W + 2.6, 1.9, LEN / 2 + 0.8);
      { const [cx, cz] = at(LEN / 2, 0); RSV.push([cx, cz, 7.5]); const [lx2, lz2] = at(-1.2, 0); RSV.push([lx2, lz2, 3]); }
      label('山洞', ex, y0 + 5.2, ez, 0.75);
      /* 洞裡的地面：一段一段貼著山坡鋪石頭地（不然看起來是草地），再撒幾顆小石頭 */
      { const fp = {}; for (let u = -0.3; u < LEN; u += 1.0){ const [x, z] = at(u + 0.5, 0); G(fp, '#4f4a42', new THREE.BoxGeometry(2 * W - 0.1, 0.06, 1.06).rotateY(face), x, Math.max(fl(u), fl(u + 1)) + 0.09, z); }
        for (let i = 0; i < 14; i++){ const u = 0.6 + (i * 0.618 % 1) * (LEN - 1), v = ((i * 0.37) % 1 - 0.5) * 2 * (W - 0.4), [x, z] = at(u, v); G(fp, ROCK[i % 3], new THREE.DodecahedronGeometry(0.1 + (i % 3) * 0.05, 0).scale(1, 0.6, 1), x, fl(u) + 0.08, z); }
        flush(fp, fg); }
      const uv = (x, z) => { const dx = x - OX - ex, dz = z - OZ - ez; return [-(dx * fx + dz * fz), dx * rx + dz * rz]; }, roofY = u => y0 + (y1 - y0) * u / LEN + HT - 1.0;
      caveInfo = { x: OX + ex, z: OZ + ez, face, len: LEN, w: W, inside: (x, z) => { const [u, v] = uv(x, z); return u > 0.3 && u < LEN && Math.abs(v) < W; },
        /* 鏡頭：人在洞裡（或剛走到洞口）時，鏡頭只能在洞的中線上、在人的前面或後面，而且不高過洞頂；不然會鑽進石頭裡，畫面整片灰 */
        cam: (T, want) => { const [ut, vt] = uv(T.x, T.z); if (!(ut > -0.8 && ut < LEN + 0.2 && Math.abs(vt) < W + 0.3)) return false;
          let [uw] = uv(want.x, want.z); const L = Math.max(2.2, Math.min(3.4, Math.hypot(want.x - T.x, want.z - T.z))); uw = uw < ut ? ut - L : ut + L; if (uw > LEN - 0.4) uw = ut - L;   /* 鏡頭在人的哪一邊就留在哪一邊（往裡面看還是往外看） */
          const vw = vt * 0.5; want.x = OX + ex - fx * uw + rx * vw; want.z = OZ + ez - fz * uw + rz * vw; want.y = Math.min(want.y, roofY(Math.max(0, uw)) + (uw < -1.5 ? 0.8 : 0)); return true; } }; }
    /* --- 護林員小屋：湖東邊的步道旁，木頭小屋、門前有走廊和一張長椅（可以坐）、煙囪冒煙、晚上窗戶會亮、門口一塊「森林步道」的地圖看板 --- */
    { const [hx, hz] = P(953, 236), f = -Math.PI / 2 - 0.15, fx = Math.sin(f), fz = Math.cos(f), lx = Math.cos(f), lz = -Math.sin(f), y = Math.max(0.3, hAt(hx, hz)) + 0.12, at = (fw, rt) => [hx + fx * fw + lx * rt, hz + fz * fw + lz * rt];
      const LOG = '#8a5a34', LOGD = '#6b4426', ROOFC = '#4f6f3a', hp = {};
      const HB = (hex, w, h, d, fw, rt, yy, rot) => { const [x, z] = at(fw, rt); B(hp, hex, w, h, d, x, y + yy, z, (rot || 0) + f); };
      HB('#9a8a6a', 4.8, 0.24, 4.6, -0.2, 0, -0.06);   /* 石頭地基 */
      for (let k = 0; k < 9; k++){ const yy = 0.2 + k * 0.27, c = k % 2 ? LOG : LOGD; HB(c, 4.2, 0.26, 0.26, -1.8, 0, yy); HB(c, 4.2, 0.26, 0.26, 1.6, 0, yy); HB(c, 0.26, 0.26, 3.6, -0.1, -2.0, yy); HB(c, 0.26, 0.26, 3.6, -0.1, 2.0, yy); }   /* 一根一根疊起來的原木牆（前面那一面在 fw=1.6） */
      { const g = roofG(4.9, 4.6, 1.5); g.rotateY(f); const [x, z] = at(-0.1, 0); G(hp, ROOFC, g, x, y + 2.65, z); }
      HB('#8a8a84', 0.55, 1.6, 0.55, -1.0, 1.2, 3.4);   /* 煙囪 */
      HB('#5a3a22', 0.95, 1.7, 0.08, 1.75, 0.4, 0.95);   /* 門 */
      HB('#b98a5a', 4.4, 0.12, 1.5, 2.5, 0, 0.1); for (const rt of [-2.05, 2.05]) HB(LOGD, 0.14, 2.3, 0.14, 3.15, rt, 1.2); HB(ROOFC, 4.6, 0.12, 1.7, 2.55, 0, 2.38, 0);   /* 走廊、柱子、走廊的小屋簷 */
      HB('#a77b4c', 1.7, 0.08, 0.42, 2.6, -1.1, 0.55); HB(LOGD, 0.08, 0.4, 0.38, 2.6, -1.85, 0.33); HB(LOGD, 0.08, 0.4, 0.38, 2.6, -0.35, 0.33); HB('#a77b4c', 1.7, 0.4, 0.06, 2.42, -1.1, 0.8);   /* 長椅（面向步道） */
      HB('#6e4a2f', 0.5, 0.5, 0.5, 2.7, 1.5, 0.37); HB('#6e4a2f', 0.4, 0.35, 0.4, 2.6, 1.0, 0.3);   /* 木箱 */
      { const [x, z] = at(2.6, 1.5); G(hp, '#c94a2e', new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6).rotateZ(1.2), x, y + 0.7, z); }   /* 箱子上的斧頭柄 */
      flush(hp, fg);
      /* 窗戶：晚上亮 */
      const win = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffcf6a', emissiveIntensity: 0, roughness: 0.5 });
      for (const rt of [-1.1, 1.3]){ const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.6), win); const [x, z] = at(1.75, rt); m.position.set(x, y + 1.35, z); m.rotation.y = f; fg.add(m); }
      { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.6), win); const [x, z] = at(-0.1, 2.15); m.position.set(x, y + 1.35, z); m.rotation.y = f + Math.PI / 2; fg.add(m); }
      /* 煙囪的煙：一團一團往上飄、慢慢散開 */
      const smk = []; for (let i = 0; i < 6; i++){ const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.5, depthWrite: false })); fg.add(m); smk.push(m); }
      const [cx0, cz0] = at(-1.0, 1.2);
      tickers.push((dt, t) => { for (let i = 0; i < smk.length; i++){ const u = ((t * 0.22) + i / smk.length) % 1, m = smk[i]; m.position.set(cx0 + u * 1.2 + Math.sin(t + i) * 0.15, y + 4.3 + u * 3.2, cz0 + u * 0.4); m.scale.setScalar(0.6 + u * 1.8); m.material.opacity = 0.55 * (1 - u); }
        const hr = A.DayNight && A.DayNight.hour != null ? A.DayNight.hour : 12; win.emissiveIntensity = hr < 6 || hr >= 18 ? 1.4 : 0.05; });
      /* 地圖看板：「森林步道」——清溪潭、山洞、湖、護林員小屋在哪 */
      { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 340; const c = cv.getContext('2d'); c.fillStyle = '#f4ecd8'; c.fillRect(0, 0, 512, 340); c.strokeStyle = '#6b4426'; c.lineWidth = 12; c.strokeRect(6, 6, 500, 328);
        c.fillStyle = '#3f6b3a'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.fillText('🌲 森林步道', 256, 62);
        c.fillStyle = '#5a3d2b'; c.font = '30px sans-serif'; c.textAlign = 'left'; ['💧 瀑布和清溪潭：往西', '🪨 山洞：大山的西南邊', '🐟 湖、溪可以釣魚', '🛖 你在這裡：護林員小屋'].forEach((tx2, i) => c.fillText(tx2, 40, 122 + i * 54));
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.06), new THREE.MeshBasicMaterial({ map: tx })); const [x, z] = at(3.9, -2.9); pl.position.set(x, y + 1.25, z); pl.rotation.y = f; fg.add(pl);
        const bk = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.18, 0.08), new THREE.MeshStandardMaterial({ color: LOGD, roughness: 0.9 })); bk.position.set(x - fx * 0.05, y + 1.25, z - fz * 0.05); bk.rotation.y = f; fg.add(bk);
        for (const sd2 of [-0.8, 0.8]){ const ps = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), bk.material); ps.position.set(x + lx * sd2 - fx * 0.05, y + 0.9 - 0.12, z + lz * sd2 - fz * 0.05); fg.add(ps); }
        colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 0.5 }); }
      { const c = Math.cos(f), sn = Math.sin(f), [x, z] = at(-0.1, 0); colliders.push({ t: 'o', x: OX + x, z: OZ + z, hw: 2.25, hd: 2.0, c, s: sn, bw: Math.abs(c) * 2.25 + Math.abs(sn) * 2.0, bd: Math.abs(sn) * 2.25 + Math.abs(c) * 2.0, big: true }); }
      for (const o of [-1.5, -0.7]){ const [x, z] = at(2.78, o - 0.0); benches.push({ x: OX + x, z: OZ + z, y: y + 0.6, face: f }); }
      { const [x, z] = at(0, 0); RSV.push([x, z, 5.5]); const [x2, z2] = at(3.5, -1); RSV.push([x2, z2, 2.5]); }
      label('護林員小屋', hx, y + 6, hz, 0.7); }
    flush(parts, fg); }
  /* ===== v930 紅樹林的內容：泥灘上的小動物（game.js 放、徒手抓）、巡守站、螢火蟲、白鷺 ===== */
  const mudPts = [];   /* 泥灘上小動物住的地方（世界座標）：紅樹林裡、從岸上走得到、露出水面的泥地 */
  { const parts = {}, mg = new THREE.Group(); root.add(mg);
    /* --- 找泥灘：0.5 公尺一格，從岸上（水族館往木棧道那條步道）開始往外走，走得到又是紅樹林裡露出水面的泥地才算 --- */
    { const [ax, az] = P(200, 320), [bx, bz] = P(480, 450), St = 0.5, NX2 = Math.round((bx - ax) / St), NZ2 = Math.round((bz - az) / St), ok = new Uint8Array(NX2 * NZ2), seen = new Uint8Array(NX2 * NZ2), cand = [];
      const cx = i => ax + (i + 0.5) * St, cz = j => az + (j + 0.5) * St;
      for (let j = 0; j < NZ2; j++) for (let i = 0; i < NX2; i++){ const x = cx(i), z = cz(j), h = samp(HG, x, z); ok[j * NX2 + i] = (h > WL - 0.05 || onBoard(x, z) || !!deck(x, z)) ? 1 : 0; }
      const [sx, sz] = P(470, 395); let start = -1, bd = 1e9; for (let j = 0; j < NZ2; j++) for (let i = 0; i < NX2; i++){ if (!ok[j * NX2 + i]) continue; const d = Math.hypot(cx(i) - sx, cz(j) - sz); if (d < bd){ bd = d; start = j * NX2 + i; } }
      const q = start >= 0 ? [start] : []; if (start >= 0) seen[start] = 1;
      while (q.length){ const k = q.pop(), i = k % NX2, j = (k / NX2) | 0, x = cx(i), z = cz(j), h = samp(HG, x, z);
        if (!onBoard(x, z) && samp(sdMang, x, z) > -2.5 && h < 0.32 && h > WL - 0.02 && samp(sdBoard, x, z) < -1.0 && railDist(x, z) > 4) cand.push([x, z, h]);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX2 || b >= NZ2) continue; const kk = b * NX2 + a; if (ok[kk] && !seen[kk]){ seen[kk] = 1; q.push(kk); } } }
      let sd3 = 930; const rr = () => (sd3 = (sd3 * 16807) % 2147483647) / 2147483647;
      for (let t = 0; t < 400 && mudPts.length < 14 && cand.length; t++){ const c = cand[Math.floor(rr() * cand.length)]; if (mudPts.some(m => Math.hypot(m.x - OX - c[0], m.z - OZ - c[1]) < 2.2)) continue; mudPts.push({ x: OX + c[0], z: OZ + c[1], y: c[2], kind: mudPts.length % 3 === 0 ? 'crab' : 'skipper' }); RSV.push([c[0], c[1], 1.2]); } }
    /* --- 巡守站：木棧道西邊的盡頭，架高的平台上一間小木屋（門朝木棧道），平台可以走上去、站在邊邊看海 --- */
    { const L = boardLine, E = L[L.length - 1], E0 = L[Math.max(0, L.length - 4)], dl = Math.hypot(E[0] - E0[0], E[1] - E0[1]) || 1, dx = (E[0] - E0[0]) / dl, dz = (E[1] - E0[1]) / dl;
      const cx = E[0] + dx * 2.0, cz = E[1] + dz * 2.0, Y = BOARD_Y, HW = 2.3;
      B(parts, '#b98a5a', HW * 2, 0.18, HW * 2, cx, Y - 0.09, cz); DECKS.push([cx - HW, cx + HW, cz - HW, cz + HW, Y]);
      for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) B(parts, '#6e4a2f', 0.22, 2.4, 0.22, cx + sx * (HW - 0.2), Y - 1.25, cz + sz2 * (HW - 0.2));   /* 高腳 */
      const f = Math.atan2(-dx, -dz), hx = cx + dx * 1.0, hz = cz + dz * 1.0;   /* 小屋在平台靠海那一半，門朝木棧道 */
      B(parts, '#4f7f44', 2.6, 1.9, 2.0, hx, Y + 0.95, hz, f); { const g = roofG(3.0, 2.5, 0.9); g.rotateY(f); G(parts, '#6b4a32', g, hx, Y + 1.9, hz); }
      { const sxd = Math.sin(f), szd = Math.cos(f); B(parts, '#3d2a1a', 0.8, 1.4, 0.06, hx + sxd * 1.02, Y + 0.7, hz + szd * 1.02, f); }
      const c0 = Math.cos(f), s0 = Math.sin(f); colliders.push({ t: 'o', x: OX + hx, z: OZ + hz, hw: 1.35, hd: 1.05, c: c0, s: s0, bw: Math.abs(c0) * 1.35 + Math.abs(s0) * 1.05, bd: Math.abs(s0) * 1.35 + Math.abs(c0) * 1.05 });
      /* 平台三邊的欄杆（靠木棧道那邊開著） */
      for (const [ax2, az2, w, d] of [[0, -HW, HW * 2, 0.08], [0, HW, HW * 2, 0.08], [-HW, 0, 0.08, HW * 2], [HW, 0, 0.08, HW * 2]]){ const side = Math.abs(ax2) > 0 ? Math.sign(ax2) * dx : Math.sign(az2) * dz; if (side < -0.5) continue;
        B(parts, '#8a6038', w, 0.08, d, cx + ax2, Y + 0.85, cz + az2); colliders.push({ t: 'b', x: OX + cx + ax2, z: OZ + cz + az2, hw: Math.max(w, 0.2) / 2, hd: Math.max(d, 0.2) / 2 }); }
      if (A.sign){ const g = new THREE.Group(), sx = cx - dx * 1.6 + dz * 1.9, sz2 = cz - dz * 1.6 - dx * 1.9; g.position.set(sx, Y, sz2); mg.add(g); A.sign(g, '紅樹林巡守站', '🌿', 0, 0); }
      label('紅樹林巡守站', cx, Y + 5, cz, 0.65); }
    /* --- 木棧道入口的告示牌（跟村子那塊一樣的話）--- */
    { const [x, z] = P(452, 396), cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#6e4a2f'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#fff4d6'; c.fillRect(8, 8, 240, 112); c.fillStyle = '#3f6b3a'; c.textAlign = 'center';
      c.font = 'bold 40px sans-serif'; c.fillText('紅樹林', 128, 56); c.font = '22px sans-serif'; c.fillStyle = '#5a3d2b'; c.fillText('退潮時泥灘上可以抓', 128, 96);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const y = Math.max(0.3, hAt(x, z)); for (const ry of [0, Math.PI]){ const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tx })); sg.position.set(x, y + 1.4, z); sg.rotation.y = Math.PI / 2 + ry + 0.25; mg.add(sg); }
      B(parts, '#6e4a2f', 0.1, 1.5, 0.1, x, y + 0.7, z); colliders.push({ t: 'c', x: OX + x, z: OZ + z, r: 0.25 }); }
    /* --- 白鷺：兩隻站在淺水裡，偶爾低頭啄一下水 --- */
    { const herons = [], put = (px, py, ry) => { const [x, z] = P(px, py), g = new THREE.Group(), hp = {}; B(hp, '#ffffff', 0.26, 0.24, 0.5, 0, 0.78, 0); B(hp, '#ffffff', 0.2, 0.14, 0.24, 0, 0.72, -0.32, 0.3); for (const s2 of [-0.06, 0.06]) B(hp, '#2b2b2b', 0.03, 0.66, 0.03, s2, 0.33, 0.05); flush(hp, g);
        const neck = new THREE.Group(); neck.position.set(0, 0.86, 0.22); g.add(neck); const nm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 6).translate(0, 0.21, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })); neck.add(nm);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), nm.material); head.position.set(0, 0.44, 0.03); neck.add(head); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f0c030', roughness: 0.6 })); bk.position.set(0, 0.44, 0.17); neck.add(bk);
        g.position.set(x, Math.max(hAt(x, z), WL - 0.3), z); g.rotation.y = ry; mg.add(g); herons.push({ neck, ph: herons.length * 3.1 }); };
      put(330, 372, 0.8); put(262, 408, -2.2);
      tickers.push((dt, t) => { for (const h of herons){ const u = (t + h.ph) % 9; h.neck.rotation.x = u < 1.2 ? Math.sin(u / 1.2 * Math.PI) * 1.3 : Math.sin(t * 0.7 + h.ph) * 0.06; } }); }
    /* --- 螢火蟲：晚上才亮，在紅樹林上面慢慢飄 --- */
    { const N = 80, fgeo = new THREE.BufferGeometry(), fp = new Float32Array(N * 3), base = []; let sd4 = 77; const rr = () => (sd4 = (sd4 * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < N; i++){ const [x, z] = P(250 + rr() * 200, 345 + rr() * 80); base.push([x, 0.8 + rr() * 2.4, z, rr() * 6.28]); } fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ color: '#d8ff7a', size: 0.18, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); mg.add(flies);
      tickers.push((dt, t) => { const hr = A.DayNight && A.DayNight.hour != null ? A.DayNight.hour : 12, want = hr < 5 || hr >= 18.5 ? 0.9 : 0; flies.material.opacity += (want - flies.material.opacity) * Math.min(1, dt * 0.8); flies.visible = flies.material.opacity > 0.02; if (!flies.visible) return;
        const a = fgeo.attributes.position.array; for (let i = 0; i < N; i++){ const [x, y, z, ph] = base[i]; a[i * 3] = x + Math.sin(t * 0.5 + ph) * 0.6; a[i * 3 + 1] = y + Math.sin(t * 0.8 + ph * 2) * 0.3; a[i * 3 + 2] = z + Math.cos(t * 0.4 + ph) * 0.6; } fgeo.attributes.position.needsUpdate = true; }); }
    flush(parts, mg); }
  /* v922 潮汐（跟舊島一樣）：海水退掉多少（公尺，0～0.3）。海岸前 3 公尺是緩緩的淺灘，乾潮時水深不到這個數字的地方，水面著色器不畫水、露出濕沙。
     seaAt：這一格是海（不是河、湖、紅樹林——那些不退潮）；dryAt：露出來、可以走上去的濕沙；wetAt：可以下竿的水（退潮時要再深 9 公分才算，浮標才不會落在濕沙上） */
  let tideFix = null;   /* 排位置的時候用：當成滿潮來算（不然剛好退潮進遊戲，「水邊」會排到退潮才露出來的沙地上） */
  const tideD = () => { if (tideFix != null) return tideFix; const U = waterSurface.material.uniforms.uTideD; return U ? U.value : 0; };
  const seaAt = (lx, lz) => samp(sdLand, lx, lz) <= 0 && samp(sdMang, lx, lz) < -3.2;
  const deckNear = (lx, lz, m) => { for (const d of DECKS) if (lx > d[0] - m && lx < d[1] + m && lz > d[2] - m && lz < d[3] + m) return true; return false; };
  const dryAt = (lx, lz) => { const td = tideD(); if (td < 0.02 || !inBox(lx, lz)) return false; const h = samp(HG, lx, lz); return h < WL - 0.02 && -h <= td - 0.01 && samp(sdLand, lx, lz) <= 0.75 && samp(sdMang, lx, lz) < -3.2 && !deckNear(lx, lz, 2.5); };   /* 棧橋旁邊 2.5 公尺不算（不然會從棧橋邊掉到沙上，或從沙上卡在橋樁旁邊） */
  const wetAt = (lx, lz) => { if (!inBox(lx, lz)) return true; const h = samp(HG, lx, lz); if (h >= WL - 0.2 || deck(lx, lz) || onBoard(lx, lz)) return false; const td = tideD(); return !(td > 0.01 && -h < td + 0.09 && seaAt(lx, lz)); };
  /* ---------- 給遊戲用的接口 ---------- */
  const W2 = {
    ox: OX, oz: OZ, spawn: [OX + P(975, 560)[0], OZ + P(975, 560)[1]],
    near: (x, z) => z > OZ + Z0 - 30 && z < OZ + Z0 + GH + 30 && x > OX + X0 - 30 && x < OX + X0 + GW + 30,
    h: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz)) return -3.2; const d = deck(lx, lz); if (d) return d[5] ? lerp(Math.max(0.2, samp(HG, lx, lz)), d[4], clamp(Math.min(lz - d[2], d[3] - lz) / d[5], 0, 1)) : d[4]; if (onBoard(lx, lz)) return boardY(lx, lz) + 0.02; { const pf = platAt(lx, lz); if (pf) return pf.y; } const h = samp(HG, lx, lz); return paved(lx, lz, 0.2) && h > 0.2 ? Math.max(h, PAVE_Y + 0.02) : h; },
    land: (x, z) => { const lx = x - OX, lz = z - OZ; return inBox(lx, lz) && (samp(HG, lx, lz) > WL - 0.02 || !!deck(lx, lz) || onBoard(lx, lz)); },
    walk: (x, z) => { const lx = x - OX, lz = z - OZ; return inBox(lx, lz) && (samp(HG, lx, lz) > WL - 0.05 || !!deck(lx, lz) || onBoard(lx, lz) || dryAt(lx, lz)); },   /* v922 退潮露出來的濕沙可以走上去（漲回來，遊戲原本的檢查會把人推回岸上） */
    dry: (x, z) => dryAt(x - OX, z - OZ),
    /* v922 釣魚用。water：這一點可不可以下竿（水夠深；棧橋、木棧道、橋的底下不算；格子外面全是外海）
       （water 的算式在上面的 wetAt）
       spot：這片水算哪一個釣點——山上的湖、森林裡的溪（橋的上游）、平地的河、紅樹林、岸邊的海、離岸 6 公尺以上的外海（碼頭走到底）
       tinfo：跟舊島的 terrainInfo 一樣的格式（高度、是不是水、哪一種水 1 河 2 溪 3 湖），水裡的魚影、魚跳出水面要用 */
    water: (x, z) => wetAt(x - OX, z - OZ),
    spot: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz)) return 'harbor'; { const [px, pz] = P(POOLC[0], POOLC[1]); if (Math.hypot(lx - px, lz - pz) < POOLR * S + 1.2) return 'pool'; } if (samp(sdLake, lx, lz) > -1.5) return 'lake';   /* v929 瀑布下的深潭＝清溪潭 */ if (samp(sdMang, lx, lz) > -2.5) return 'mangrove'; if (samp(sdReef, lx, lz) > -1.5) return 'reef';   /* v950 */
      if (samp(sdMain, lx, lz) > 0 && samp(sdWat, lx, lz) > -2) return samp(sdFor, lx, lz) > 3 ? 'creek' : 'river'; return samp(sdLand, lx, lz) < -6 ? 'harbor' : 'sea'; },
    /* 最近可以站著釣魚的水邊（「找釣點」按鈕帶路用）：從腳邊一圈一圈往外找，站的地方要在主島或棧橋上、ok() 說沒被東西擋住，而且往某一邊 1.6 和 3.1 公尺都是水 */
    shore: (x, z, ok) => { const lx0 = x - OX, lz0 = z - OZ, wat = wetAt;
      for (let r = 0; r < 170; r += 1.5){ const n = Math.max(1, Math.round(r * 2.1)); for (let k = 0; k < n; k++){ const a = k / n * 6.2832 + r * 0.37, lx = lx0 + Math.sin(a) * r, lz = lz0 + Math.cos(a) * r; if (!inBox(lx, lz)) continue;
          if (!(deck(lx, lz) || onBoard(lx, lz) || (samp(sdMain, lx, lz) > 0 && samp(HG, lx, lz) > WL - 0.02) || (dryAt(lx, lz) && samp(sdMain, lx, lz) > -3.6))) continue; if (ok && !ok(OX + lx, OZ + lz)) continue;
          for (let j = 0; j < 12; j++){ const b = j / 12 * 6.2832, dx = Math.sin(b), dz = Math.cos(b); if (wat(lx + dx * 1.6, lz + dz * 1.6) && wat(lx + dx * 3.1, lz + dz * 3.1)) return { x: OX + lx, z: OZ + lz, face: b, id: W2.spot(OX + lx + dx * 1.6, OZ + lz + dz * 1.6) }; } } }
      return null; },
    tinfo: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz)) return { h: -3.2, water: true, region: 0 }; const h = samp(HG, lx, lz), water = h < WL - 0.02; let region = 0;
      if (water && samp(sdMain, lx, lz) > 0 && samp(sdMang, lx, lz) <= -2.5){ if (samp(sdLake, lx, lz) > -1.5) region = 3; else if (samp(sdWat, lx, lz) > -2) region = samp(sdFor, lx, lz) > 3 ? 2 : 1; } return { h, water, region }; },
    tick: (dt, t) => { const here = W2.near(me.pos.x, me.pos.z) || W2.near(camera.position.x, camera.position.z);
      if (here !== inside){ inside = here; root.visible = here; if (here) A.setWaterMask(maskTex, OX + X0 + GW / 2, OZ + Z0 + GH / 2, GW, GH); else { A.setWaterMask(null); for (const k of [...chunks.keys()]) dropChunk(k); } }
      if (!here) return;
      chunkTick(camera.position.x - OX, camera.position.z - OZ, false); waterSurface.position.x = Math.round(camera.position.x / 16) * 16; waterSurface.position.z = Math.round(camera.position.z / 16) * 16;
      if (labelsOn) for (const sp of labels){ const u = sp.userData, d = Math.hypot(camera.position.x - OX - sp.position.x, camera.position.y - sp.position.y, camera.position.z - OZ - sp.position.z), k = clamp(d / 55, 1, 4.2); sp.visible = u.st ? d > 5 && d < 32 : d > 70 && camera.position.y > 22; if (u.st && sp.material.depthTest === false){ sp.material.depthTest = true; } sp.scale.set(u.w * k, u.h * k, 1); }   /* v942 作者：「村公所、森林冒險區的字都擋到了」→ 地區的名字只有鏡頭在高空、很遠（70 公尺以上）才出現；車站的牌子只在附近 5～32 公尺出現，而且會被房子擋住 */
      for (const f of tickers) f(dt, t); },
    warm: (x, z) => chunkTick(x - OX, z - OZ, true),
    info: () => ({ chunks: chunks.size, tris: (() => { let n = 0; root.traverse(o => { if (o.isMesh && o.geometry){ const g = o.geometry, c = (g.index ? g.index.count : g.attributes.position.count) / 3; n += o.isInstancedMesh ? c * o.count : c; } }); return Math.round(n); })(), labels: labels.length, cols: colliders.length }),
    labels: on => { labelsOn = on; for (const sp of labels) sp.visible = on; },
    view: v => { VIEW = v; },   /* 拍全島的時候用：多遠以內的地都蓋 */
    board: boardLine, rail: railLine,   /* 測試用：木棧道、鐵軌的中心線（島上的公尺） */
    /* v923 小火車：train 是給 game.js 問的（有幾站、哪一班停在哪一站、座位現在在哪）；trainStep(共用時間的秒數, dt) 每一幀在移動玩家之前叫一次 */
    /* v935 新主島的地圖：從上面往下看的小圖（1 公尺 2 格），第一次要用才畫，畫一次就留著 */
    mapImg: () => { if (W2._mi) return W2._mi; const K = 2, cv = document.createElement('canvas'); cv.width = GW * K; cv.height = GH * K; const c = cv.getContext('2d'), im = c.createImageData(cv.width, cv.height), D = im.data;
      const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const C = { sea: hex('#3d8fcc'), deep: hex('#2f78b4'), lake: hex('#5fb3dc'), reef: hex('#5fd0c8'), rock: hex('#9a9282'), mang: hex('#4f8f86'), sand: hex('#ecd9a6'), grass: hex('#8cc46a'), forest: hex('#4f8f4a'), pave: hex('#d9d2c4'), dirt: hex('#c9ad7c'), wood: hex('#b98a5a'), hill: hex('#7aa860') };
      for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++){ const lx = X0 + (i + 0.5) / K, lz = Z0 + (j + 0.5) / K, h = samp(HG, lx, lz); let col, sh = 1;
        if (deck(lx, lz) || samp(sdBoard, lx, lz) > 0) col = C.wood;
        else if (samp(sdRock, lx, lz) > 0) col = C.rock;
        else if (h < WL - 0.02){ if (samp(sdMang, lx, lz) > -2.5) col = C.mang; else if (samp(sdReef, lx, lz) > 0) col = C.reef; else if (samp(sdMain, lx, lz) > 0 && samp(sdLake, lx, lz) > -1.5) col = C.lake; else if (samp(sdMain, lx, lz) > 0) col = C.lake; else { col = samp(sdMain, lx, lz) < -14 ? C.deep : C.sea; } }
        else { if (paved(lx, lz, 0)) col = C.pave; else if (samp(sdTrail, lx, lz) > 0) col = C.dirt; else if (samp(sdSand, lx, lz) > 0 && h < 1.4) col = C.sand; else if (samp(sdFor, lx, lz) > 0) col = C.forest; else col = h > 6 ? C.hill : C.grass; sh = 0.92 + Math.min(0.16, h * 0.012); }
        const o = (j * cv.width + i) * 4; D[o] = Math.min(255, col[0] * sh); D[o + 1] = Math.min(255, col[1] * sh); D[o + 2] = Math.min(255, col[2] * sh); D[o + 3] = 255; }
      c.putImageData(im, 0, 0);
      c.fillStyle = 'rgba(120,92,70,.85)'; for (let i = COL0; i < colliders.length; i++){ const q = colliders[i]; if (q.t === 'c' || !inBox(q.x - OX, q.z - OZ)) continue; const w = (q.bw || q.hw || 0) * 2, d = (q.bd || q.hd || 0) * 2; if (w * d < 9) continue; c.fillRect((q.x - OX - X0 - w / 2) * K, (q.z - OZ - Z0 - d / 2) * K, w * K, d * K); }
      c.strokeStyle = '#6e4a2f'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); railLine.forEach((q, n) => { const x = (q[0] - X0) * K, y = (q[1] - Z0) * K; if (n) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); c.stroke(); c.setLineDash([]);
      return (W2._mi = { cv, x0: OX + X0, z0: OZ + Z0, w: GW, h: GH }); },
    train: TRAIN ? TRAIN.api : null, trainStep: (t, dt) => { if (TRAIN && inside) TRAIN.step(t, dt); },
    horizon: HORIZON,   /* v945 外島在新主島海平線上的方向：坐船往那邊開 */
    bb: bbInfo, seats, doors, posts, benches, cave: caveInfo, mud: mudPts, homes, spotsAt,   /* v935 spotsAt：村子的發光釣點在新主島的位置（釣點代號不變） */   /* v934 homes：居民區民宅的門口 */   /* v930 mud：紅樹林泥灘上小動物住的地方 */   /* v929 benches：森林裡可以坐的長椅；cave：山洞（inside(x,z) 人是不是在洞裡） */
    /* v926 村民散步用。railNear：這一點是不是在鐵軌旁邊（m 公尺內）或月台上；stroll：可不可以當散步的去處——鋪了路的地（廣場、大道、巷子、港邊木棧道），不靠鐵軌、不上月台和棧橋 */
    railNear: (x, z, m) => { const lx = x - OX, lz = z - OZ; return railDist(lx, lz) < (m || 1.6) || !!platAt(lx, lz); },
    stroll: (x, z, near) => { const lx = x - OX, lz = z - OZ; return inBox(lx, lz) && (near ? samp(sdMain, lx, lz) > 1.5 && samp(sdFor, lx, lz) < -4 : samp(sdPave, lx, lz) > 0.3) && samp(HG, lx, lz) > 0.2 && !deck(lx, lz) && !platAt(lx, lz) && railDist(lx, lz) > 2.2; },   /* near：攤位旁邊幾步，不一定要鋪路，草地也行（不進森林、不下水） */   /* 高看板（螢幕、字幕條的 Mesh，中心高度）和它前面的座位：game.js 接節目、接坐下 */
    /* 這一點是什麼地：0 不是主島、1 水和紅樹林、2 路和廣場、3 森林、4 沙灘、5 蓋了東西、6 海岸邊、7 空草地（量「還有多少地沒用」用的） */
    kind: (x, z) => { const lx = x - OX, lz = z - OZ; if (!inBox(lx, lz) || samp(sdMain, lx, lz) <= 0) return 0; if (samp(HG, lx, lz) < WL || samp(sdMang, lx, lz) > -3) return 1; if (paved(lx, lz, 0.5)) return 2; if (samp(sdFor, lx, lz) > -4) return 3; if (samp(sdSand, lx, lz) > -3) return 4; if (reserved(lx, lz)) return 5; if (samp(sdLand, lx, lz) < 6) return 6; return 7; },
    /* 預覽用：一按就過去的地點（島上的公尺） */
    spots: [['主城廣場', 975, 560], ['村公所', 965, 372], ['港口', 990, 822], ['商店街', 985, 690], ['博物館', 840, 608], ['水族館', 735, 410], ['活動場地', 1112, 730], ['紅樹林', 446, 390], ['巡守站', 222, 356], ['居民區', 482, 580], ['森林步道', 696, 262], ['瀑布', 805, 196], ['山洞', 694, 226], ['護林員小屋', 925, 246], ['遊樂園', 1255, 372], ['體育場', 1352, 449], ['玩家建地', 1310, 535], ['中央市場', 1105, 582], ['沙灘', 1490, 715]].map(([n, px, py]) => [n, ...P(px, py)]),
  };
  /* v927 要站在水邊的位置（釣魚的村民、蔚博士調查的岸邊）：從排好的那一點找最近的水邊（當成滿潮），站好、面朝水；不靠鐵軌、不站在東西裡面；那裡不長樹。
     蔚博士的往後退一步半（不擋到在那裡釣魚的人）。找不到同一種水的就拿掉，她留在水族館入口。 */
  { const hitC = (x, z, m) => { for (let i = COL0; i < colliders.length; i++){ const c = colliders[i], dx = x - c.x, dz = z - c.z; if (c.t === 'c' ? Math.hypot(dx, dz) < c.r + m : Math.abs(dx) < (c.bw || c.hw) + m && Math.abs(dz) < (c.bd || c.hd) + m) return true; } return false; };
    const ok = (x, z) => !hitC(x, z, 0.45) && railDist(x - OX, z - OZ) > 2.4; tideFix = 0;
    try { for (const k in posts){ const p = posts[k];
        if (p.shore){ const s = W2.shore(p.x, p.z, ok); if (s && Math.hypot(s.x - p.x, s.z - p.z) < 45){ p.x = s.x; p.z = s.z; p.face = s.face; p.fishing = true; RSV.push([s.x - OX, s.z - OZ, 2.6]); } else p.fishing = false; }
        if (p.at) for (const id in p.at){ const A = p.at[id], s = W2.shore(A[0], A[1], ok); if (!s || s.id !== id || Math.hypot(s.x - A[0], s.z - A[1]) > 45){ delete p.at[id]; continue; }
            const bx = s.x - Math.sin(s.face) * 1.6, bz = s.z - Math.cos(s.face) * 1.6, back = W2.walk(bx, bz) && !W2.water(bx, bz) && ok(bx, bz) && Math.abs(W2.h(bx, bz) - W2.h(s.x, s.z)) < 0.4;
            p.at[id] = { x: back ? bx : s.x, z: back ? bz : s.z, face: s.face }; RSV.push([p.at[id].x - OX, p.at[id].z - OZ, 2.6]); } } } catch(e){ console.warn('world2 posts', e); }
    /* v935 發光的好釣點（村子的釣點搬過來，釣點代號不變）：每一種水挑一個好站的岸邊，離村民釣魚的位置 4 公尺以上 */
    try { const W = (px, py) => { const q = P(px, py); return [OX + q[0], OZ + q[1]]; }, busy = (x, z) => Object.values(posts).some(q => q && q.x != null && Math.hypot(q.x - x, q.z - z) < 4);
      const pr = PIERS[2]; if (pr) spotsAt.harbor = { x: OX + pr.x, z: OZ + pr.z0 + pr.L - 1.4, face: 0 };   /* 外海：港口中間那條棧橋的最尾端 */
      for (const [id, px, py] of [['sea', 1420, 790], ['river', 640, 330], ['creek', 760, 262], ['lake', 905, 250], ['pool', 806, 222], ['mangrove', 430, 386], ['reef', 1650, 890]]){ let [ax, az] = W(px, py), got = null;
        for (let k = 0; k < 4 && !got; k++){ const s2 = W2.shore(ax, az, (x, z) => ok(x, z) && !busy(x, z)); if (s2 && s2.id === id && Math.hypot(s2.x - ax, s2.z - az) < 45) got = s2; else { ax += 6; az += 3; } }
        if (got){ spotsAt[id] = { x: got.x, z: got.z, face: got.face }; RSV.push([got.x - OX, got.z - OZ, 2.6]); } } } catch(e){ console.warn('world2 spots', e); }
    tideFix = null; }
  root.visible = false;
  return W2;
}
