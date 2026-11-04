// 潮汐釣魚村：每一種魚的外形參數（照維基百科的體型比例、鰭的位置、尾鰭形狀、顏色和花紋整理）
// gen: 'fish'（預設）| 'shrimp' | 'crab'；c 是各部位的顏色；move 是游泳的擺動方式
// © 2026 a20051024941024-ctrl。保留所有權利。

const BARS = (n, t0, t1, w, y0 = -2, y1 = 2) => Array.from({ length: n }, (_, i) => { const t = t0 + (t1 - t0) * (n === 1 ? 0 : i / (n - 1)); return [t - w / 2, t + w / 2, y0, y1]; });
const GILLS = (t0, n = 5, gap = 0.022, y0 = -0.35, y1 = 0.35) => ({ k:'bars', bars: Array.from({ length: n }, (_, i) => [t0 + i * gap, t0 + i * gap + 0.006, y0 + i * 0.03, y1 - i * 0.03]), part:'Gill' });
const EYE = (t, y, r, o = {}) => Object.assign({ t, y, r }, o);

export const SPECS = {
  /* ---------------- 河、湖、溪 ---------------- */
  perch: { c:{ Top:'#4d6b2e', Mid:'#93a84c', Bottom:'#efe7c4', Stripes:'#26361a', Fins:'#8a9c55', Fins2:'#e0502e', Eye:'#15181c', EyeW:'#f0d86a' }, p:{
    bl:0.82, depth:0.3, wr:0.5, tm:0.36, nose:0.85, ped:0.2, up:[[0,0.12],[0.1,0.55],[0.24,0.95],[0.36,1],[0.62,0.72],[0.88,0.3],[1,0.2]], cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }, { k:'bars', bars:BARS(6, 0.24, 0.8, 0.045, -0.35, 1.1), part:'Stripes' }],
    dorsal:[{ s:0.24, e:0.48, h:0.42, shape:'spiny', back:0.55 }, { s:0.52, e:0.7, h:0.32, shape:'tri', peak:0.2 }], anal:{ s:0.63, e:0.74, h:0.3, part:'Fins2' },
    pect:{ t:0.27, y:-0.1, size:0.42 }, pelv:{ t:0.3, size:0.35, part:'Fins2' }, caudal:{ type:'emarginate', hk:1.15, part:'Fins2' }, eye:EYE(0.1, 0.35, 0.09, { ring:true }) } },
  crucian: { c:{ Top:'#5a5a34', Mid:'#c2a050', Bottom:'#efdc98', Stripes:'#7a6a3a', Fins:'#a06a3e', Eye:'#15181c', EyeW:'#e8d080' }, p:{
    bl:0.8, depth:0.42, wr:0.45, tm:0.4, nose:0.6, ped:0.28, cs:0.3, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'wave', f:70, fy:9, t0:0.15, t1:0.92, y0:-0.6, y1:0.95, th:0.86, part:'Stripes' }],
    dorsal:{ s:0.38, e:0.78, h:0.3, shape:'rampd', back:0.35 }, anal:{ s:0.72, e:0.82, h:0.25 }, pect:{ t:0.28, y:-0.35, size:0.35 }, pelv:{ t:0.42, size:0.3 },
    caudal:{ type:'forked', notch:0.6, hk:1.05 }, eye:EYE(0.1, 0.3, 0.08, { ring:true }) } },
  catfish: { c:{ Top:'#4e4a2e', Mid:'#7f7344', Bottom:'#efeee6', Spots:'#cfc9a8', Fins:'#5a553a', Eye:'#15181c' }, move:'eel', p:{
    bl:0.9, depth:0.17, wr:0.85, tm:0.22, nose:0.45, ped:0.12, n:2.3, cs:-0.2, up:[[0,0.4],[0.08,0.75],[0.22,1],[0.5,0.85],[0.8,0.45],[1,0.12]], lo:[[0,0.35],[0.1,0.8],[0.25,1],[0.5,0.9],[0.8,0.5],[1,0.12]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.2, y1:0.3, part:'Mid' }], dots:{ n:22, t0:0.15, t1:0.9, y0:-0.1, y1:0.8, r:0.02, part:'Spots' },
    dorsal:{ s:0.3, e:0.34, h:0.25 }, anal:{ s:0.42, e:0.99, h:0.18, shape:'flat' }, pect:{ t:0.18, y:-0.55, size:0.45, shape:'round' }, pelv:{ t:0.4, size:0.25 },
    caudal:{ type:'truncate', hk:0.9, len:0.7 }, eye:EYE(0.07, 0.35, 0.05),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.01, yn:0.2, z:0.03 }, { x:0.86, y:0.06, z:0.12 }, { x:0.75, y:0.02, z:0.28 }, { x:0.55, y:-0.05, z:0.33 }], r0:0.008, r1:0.003, part:'Fins' },
           { k:'limb', sym:true, pts:[{ t:0.03, yn:-0.6, z:0.02 }, { x:0.78, y:-0.12, z:0.05 }, { x:0.72, y:-0.16, z:0.07 }], r0:0.006, r1:0.002, part:'Fins' }] } },
  koi: { c:{ Top:'#f6f3ec', Bottom:'#fbfaf6', Accent:'#d8231c', Fins:'#f3eee6', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.3, wr:0.6, tm:0.38, nose:0.7, ped:0.24, cs:-0.4,
    pat:[{ k:'ell', t:0.1, y:0.75, rt:0.07, ry:0.5, part:'Accent' }, { k:'ell', t:0.36, y:0.7, rt:0.12, ry:0.65, part:'Accent' }, { k:'ell', t:0.66, y:0.6, rt:0.1, ry:0.55, part:'Accent' }],
    dorsal:{ s:0.36, e:0.76, h:0.32, shape:'rampd', back:0.3 }, anal:{ s:0.74, e:0.82, h:0.24 }, pect:{ t:0.26, y:-0.45, size:0.42, shape:'round' }, pelv:{ t:0.45, size:0.3 },
    caudal:{ type:'forked', notch:0.55, hk:1.25 }, eye:EYE(0.09, 0.2, 0.07),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.01, yn:-0.3, z:0.02 }, { x:0.82, y:-0.04, z:0.05 }, { x:0.79, y:-0.08, z:0.07 }], r0:0.007, r1:0.003, part:'Fins' }] } },
  kuhua: { c:{ Top:'#47533f', Mid:'#b2b9a8', Bottom:'#eef0e8', Stripes:'#3c4636', Fins:'#8a8e7a', Eye:'#15181c', EyeW:'#e0e0c8' }, p:{
    bl:0.8, depth:0.27, wr:0.6, tm:0.36, nose:0.75, ped:0.22, cs:0.25, yc:[[0,-0.15],[0.2,0],[1,0]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, { k:'line', t0:0.12, t1:0.98, y:[[0,0.08],[1,0.08]], w:0.05, part:'Stripes' }],
    dorsal:{ s:0.36, e:0.5, h:0.45, shape:'tri', peak:0.2 }, anal:{ s:0.7, e:0.78, h:0.28 }, pect:{ t:0.25, y:-0.5, size:0.4 }, pelv:{ t:0.45, size:0.3 },
    caudal:{ type:'forked', notch:0.45, hk:1.3 }, eye:EYE(0.1, 0.3, 0.09, { ring:true }) } },
  ayu: { c:{ Top:'#6b6a3e', Mid:'#c9c6a8', Bottom:'#f3f1e8', Accent:'#f2c51e', Fins:'#c9b860', Eye:'#15181c', EyeW:'#e8e4c0' }, p:{
    bl:0.82, depth:0.2, wr:0.6, tm:0.4, nose:0.9, ped:0.18, cs:0.2,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, { k:'ell', t:0.26, y:0.05, rt:0.04, ry:0.22, part:'Accent' }],
    dorsal:[{ s:0.36, e:0.5, h:0.6, shape:'tri', peak:0.25 }, { s:0.8, e:0.84, h:0.12, shape:'round' }], anal:{ s:0.68, e:0.8, h:0.3 },
    pect:{ t:0.25, y:-0.5, size:0.4 }, pelv:{ t:0.45, size:0.3 }, caudal:{ type:'forked', notch:0.4, hk:1.5 }, eye:EYE(0.09, 0.3, 0.08, { ring:true }) } },
  // goby（紫晶蝦虎）：使用者比較喜歡原本會發紫光的模型，所以不重做，用 game.js 原本的 FISH_STYLE.goby
  trout: { c:{ Top:'#3f4e2c', Mid:'#75834a', Bottom:'#e07a40', Stripes:'#9aa868', Spots:'#d8283a', Accent:'#f2e2a0', Fins:'#5a6a3a', Fins2:'#d0583a', Eye:'#15181c', EyeW:'#e8d890' }, p:{
    bl:0.82, depth:0.24, wr:0.6, tm:0.38, nose:0.8, ped:0.25, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, { k:'wave', f:80, fy:14, t0:0.15, t1:0.95, y0:0.35, th:0.65, part:'Stripes' }],
    dots:[{ n:18, t0:0.18, t1:0.9, y0:-0.35, y1:0.2, r:0.014, part:'Spots' }, { n:20, t0:0.15, t1:0.9, y0:-0.2, y1:0.45, r:0.015, part:'Accent', seed:7 }],
    dorsal:[{ s:0.38, e:0.52, h:0.42, shape:'tri', peak:0.25 }, { s:0.8, e:0.84, h:0.14, shape:'round' }], anal:{ s:0.68, e:0.79, h:0.3, part:'Fins2' },
    pect:{ t:0.25, y:-0.55, size:0.38, part:'Fins2' }, pelv:{ t:0.47, size:0.3, part:'Fins2' }, caudal:{ type:'truncate', hk:1.15 }, eye:EYE(0.09, 0.3, 0.08, { ring:true }) } },
  salmon: { c:{ Top:'#3f5a3a', Mid:'#d9a35a', Bottom:'#ecebe4', Stripes:'#4a4038', Spots:'#1d1d1a', Accent:'#e88aa8', Fins:'#d8b64a', Eye:'#15181c', EyeW:'#e8d890' }, p:{
    bl:0.82, depth:0.29, wr:0.55, tm:0.38, nose:0.8, ped:0.25, cs:0.2,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, ...Array.from({ length:9 }, (_, i) => ({ k:'ell', t:0.2 + i * 0.075, y:0.0, rt:0.025, ry:0.32, part:'Stripes' }))],
    dots:[{ n:14, t0:0.15, t1:0.85, y0:0.35, y1:0.85, r:0.012, part:'Spots' }, { n:10, t0:0.2, t1:0.85, y0:-0.3, y1:0.3, r:0.016, part:'Accent', seed:3 }],
    dorsal:[{ s:0.36, e:0.5, h:0.42, shape:'tri', peak:0.25 }, { s:0.8, e:0.84, h:0.14, shape:'round' }], anal:{ s:0.68, e:0.79, h:0.3 },
    pect:{ t:0.25, y:-0.55, size:0.38 }, pelv:{ t:0.47, size:0.3 }, caudal:{ type:'emarginate', hk:1.15 }, eye:EYE(0.09, 0.3, 0.08, { ring:true }) } },
  tilapia: { c:{ Top:'#4a5236', Mid:'#8e9460', Bottom:'#dcd8b6', Stripes:'#5f6644', Fins:'#5a5a48', Accent:'#c43a30', Eye:'#15181c', EyeW:'#d8c060' }, p:{
    bl:0.8, depth:0.4, wr:0.42, tm:0.38, nose:0.65, ped:0.3, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }, { k:'bars', bars:BARS(6, 0.28, 0.85, 0.05, -0.4, 0.95), part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.62, h:0.32, shape:'spiny', back:1 }, { s:0.62, e:0.84, h:0.45, shape:'tri', peak:0.5, back:0.1, part:'Fins' }], anal:{ s:0.64, e:0.82, h:0.4, shape:'tri', peak:0.5 },
    pect:{ t:0.27, y:-0.2, size:0.42 }, pelv:{ t:0.32, size:0.45 }, caudal:{ type:'truncate', hk:0.95, part:'Fins' }, eye:EYE(0.11, 0.35, 0.08, { ring:true }) } },
  eel: { c:{ Top:'#3b4030', Mid:'#7b7e60', Bottom:'#f0f0e8', Fins:'#4a4c3c', Eye:'#15181c' }, move:'eel', p:{
    bl:0.97, depth:0.065, wr:0.85, tm:0.2, nose:0.6, ped:0.05, tailK:1.0, cs:0.0, ns:56, pat:[{ k:'band', t0:0, t1:1, y0:-0.3, y1:0.1, part:'Mid' }],
    up:[[0,0.35],[0.06,0.8],[0.15,1],[0.6,0.85],[0.9,0.4],[1,0.1]], lo:[[0,0.3],[0.06,0.8],[0.15,1],[0.6,0.8],[0.9,0.35],[1,0.1]],
    dorsal:{ s:0.38, e:1.0, h:0.55, shape:'flat', sweep:0.1, seg:24 }, anal:{ s:0.48, e:1.0, h:0.5, shape:'flat', sweep:0.1, seg:20 },
    pect:{ t:0.13, y:0, size:0.9, shape:'round', w:0.8 }, caudal:{ type:'rounded', hk:2.2, len:0.9 }, eye:EYE(0.045, 0.35, 0.12) } },
  carp: { c:{ Top:'#5a4c28', Mid:'#c09a44', Bottom:'#ecdca4', Stripes:'#806a30', Fins:'#8a5a2a', Fins2:'#d0782a', Eye:'#15181c', EyeW:'#e8c860' }, p:{
    bl:0.8, depth:0.3, wr:0.6, tm:0.38, nose:0.7, ped:0.25, cs:0.35, up:[[0,0.15],[0.1,0.55],[0.3,0.95],[0.4,1],[0.7,0.65],[1,0.25]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }, { k:'wave', f:64, fy:8, t0:0.16, t1:0.94, y0:-0.6, y1:0.95, th:0.85, part:'Stripes' }],
    dorsal:{ s:0.38, e:0.78, h:0.38, shape:'rampd', back:0.25 }, anal:{ s:0.74, e:0.82, h:0.28, part:'Fins2' }, pect:{ t:0.26, y:-0.5, size:0.42 }, pelv:{ t:0.45, size:0.32 },
    caudal:{ type:'forked', notch:0.55, hk:1.2, part:'Fins2' }, eye:EYE(0.09, 0.25, 0.07, { ring:true }),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.01, yn:-0.35, z:0.02 }, { x:0.82, y:-0.06, z:0.05 }, { x:0.79, y:-0.1, z:0.07 }], r0:0.008, r1:0.003, part:'Fins' }] } },
  loach: { c:{ Top:'#6a6240', Mid:'#a69a6a', Bottom:'#e8e2c8', Spots:'#3a3424', Fins:'#8a8264', Accent:'#2e2a1e', Eye:'#15181c' }, move:'eel', p:{
    bl:0.9, depth:0.13, wr:0.8, tm:0.3, nose:0.55, ped:0.4, tailK:0.6, cs:0.1, ns:48, pat:[{ k:'band', t0:0, t1:1, y0:-0.4, y1:0.1, part:'Mid' }, { k:'spots', gt:0.03, gy:0.22, r:0.008, ar:5, t0:0.08, t1:0.96, y0:-0.3, y1:0.95, part:'Spots', fill:0.7 }, { k:'ell', t:0.98, y:0.5, rt:0.03, ry:0.35, part:'Accent' }],
    wd:[[0,0.5],[0.3,1],[0.7,0.65],[1,0.35]],
    dorsal:{ s:0.48, e:0.6, h:0.4, shape:'round' }, anal:{ s:0.72, e:0.8, h:0.3, shape:'round' }, pect:{ t:0.16, y:-0.6, size:0.45, shape:'round' }, pelv:{ t:0.5, size:0.3, shape:'round' },
    caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.06, 0.4, 0.07),
    extra:[0.02, 0.04, 0.06].flatMap(z => [{ k:'limb', sym:true, pts:[{ t:0.01, yn:-0.5, z }, { x:0.84, y:-0.05 - z * 0.4, z:z * 1.6 }], r0:0.004, r1:0.002, part:'Fins' }]) } },
  puffer: { c:{ Top:'#5e6a4a', Mid:'#8e9470', Bottom:'#f6f6f2', Spots:'#f4f2e0', Accent:'#1e2216', Fins:'#d8c040', Eye:'#15181c', EyeW:'#e8d040' }, p:{
    bl:0.84, depth:0.5, wr:0.92, tm:0.42, nose:0.45, ped:0.2, tailK:1.2, cs:0.0, up:[[0,0.32],[0.12,0.75],[0.4,1],[0.7,0.7],[1,0.2]], lo:[[0,0.25],[0.15,0.8],[0.45,1],[0.72,0.65],[1,0.2]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.3, y1:0.0, part:'Mid' }, { k:'ell', t:0.36, y:0.15, rt:0.06, ry:0.25, part:'Accent' }], dots:{ n:40, t0:0.1, t1:0.85, y0:0.05, y1:0.95, r:0.016, part:'Spots' },
    dorsal:{ s:0.72, e:0.8, h:0.28, shape:'round' }, anal:{ s:0.74, e:0.82, h:0.26, shape:'round' }, pect:{ t:0.3, y:0.0, size:0.22, shape:'round', w:1.0, out:0.2 },
    caudal:{ type:'truncate', hk:0.9, len:0.85 }, eye:EYE(0.16, 0.5, 0.075, { ring:true }) } },
  lantern: { c:{ Top:'#1a2a40', Mid:'#7a90a8', Bottom:'#c8d4dc', Glow:'#6cf0ff', Fins:'#3a4a5a', Eye:'#0d1018', EyeW:'#c8e8ff' }, glowParts:['Glow'], p:{
    bl:0.82, depth:0.24, wr:0.45, tm:0.3, nose:0.6, ped:0.2, cs:0.25, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }],
    dots:[{ n:16, t0:0.18, t1:0.9, y0:-0.8, y1:-0.65, r:0.016, part:'Glow' }, { n:12, t0:0.2, t1:0.85, y0:-0.45, y1:-0.3, r:0.014, part:'Glow', seed:4 }],
    dorsal:[{ s:0.38, e:0.55, h:0.35, shape:'tri', peak:0.3 }, { s:0.82, e:0.86, h:0.1, shape:'round' }], anal:{ s:0.6, e:0.8, h:0.25 }, pect:{ t:0.24, y:-0.3, size:0.35 }, pelv:{ t:0.4, size:0.25 },
    caudal:{ type:'forked', notch:0.45, hk:1.3 }, eye:EYE(0.1, 0.25, 0.15, { ring:true }) } },
  snakehead: { c:{ Top:'#3a3a2e', Mid:'#7a7458', Bottom:'#dcd8c4', Spots:'#1c1c16', Accent:'#141410', Fins:'#4a4a3a', Eye:'#15181c' }, p:{
    bl:0.85, depth:0.18, wr:0.8, tm:0.3, nose:0.6, ped:0.45, tailK:0.7, cs:0.25, n:2.2,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, { k:'spots', gt:0.085, gy:0.5, r:0.03, ar:6, t0:0.2, t1:0.95, y0:-0.3, y1:0.6, part:'Spots', fill:0.8 }, { k:'line', t0:0.02, t1:0.16, y:[[0,0.2],[0.16,-0.25]], w:0.08, part:'Accent' }, { k:'ell', t:0.99, y:0.2, rt:0.025, ry:0.35, part:'Accent' }],
    dorsal:{ s:0.25, e:0.98, h:0.3, shape:'flat', sweep:0.2 }, anal:{ s:0.5, e:0.98, h:0.28, shape:'flat', sweep:0.2 }, pect:{ t:0.2, y:-0.4, size:0.5, shape:'round' }, pelv:{ t:0.3, size:0.25, shape:'round' },
    caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.07, 0.45, 0.08) } },
  bass: { c:{ Top:'#3e5228', Mid:'#8a9a60', Bottom:'#ece8d0', Stripes:'#1f2a12', Fins:'#6a7448', Eye:'#15181c', EyeW:'#c8a040' }, p:{
    bl:0.8, depth:0.3, wr:0.55, tm:0.38, nose:0.75, ped:0.24, cs:0.3, yc:[[0,-0.2],[0.15,0],[1,0]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'wave', f:46, fy:0, t0:0.15, t1:0.98, y0:-0.12, y1:0.22, th:-0.4, part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.5, h:0.4, shape:'spiny', back:0.4 }, { s:0.51, e:0.72, h:0.42, shape:'round' }], anal:{ s:0.64, e:0.76, h:0.32, shape:'round' },
    pect:{ t:0.27, y:-0.3, size:0.4 }, pelv:{ t:0.32, size:0.35 }, caudal:{ type:'emarginate', hk:1.15 }, eye:EYE(0.1, 0.35, 0.085, { ring:true }) } },
  goldfish: { c:{ Top:'#e8401a', Bottom:'#f8d0a0', Accent:'#ffffff', Fins:'#f06a30', Eye:'#15181c' }, p:{
    bl:0.62, depth:0.68, wr:0.62, tm:0.45, nose:0.5, ped:0.32, tailK:1.0, cs:-0.45, up:[[0,0.2],[0.12,0.55],[0.3,0.95],[0.42,1],[0.7,0.8],[1,0.3]],
    pat:[{ k:'ell', t:0.55, y:-0.2, rt:0.2, ry:0.5, part:'Accent' }],
    dorsal:{ s:0.32, e:0.72, h:0.5, shape:'tri', peak:0.2, sweep:0.6 }, anal:{ s:0.72, e:0.84, h:0.45, sweep:0.6 }, pect:{ t:0.3, y:-0.45, size:0.3, shape:'round' }, pelv:{ t:0.45, size:0.35, shape:'round' },
    caudal:{ type:'forked', notch:0.45, hk:1.7, len:1.0 }, eye:EYE(0.12, 0.2, 0.09, { pop:0.35 }),
    extra:[{ k:'plate', sym:true, pts:[{ x:-0.2, y:0.0, z:0.0 }, { x:-0.68, y:0.34, z:0.16 }, { x:-0.8, y:0.0, z:0.24 }, { x:-0.68, y:-0.34, z:0.16 }], part:'Fins' }] } },
  sturgeon: { c:{ Top:'#4a5560', Mid:'#7d8790', Bottom:'#ebe7df', Accent:'#cfc8b6', Fins:'#5a6570', Eye:'#15181c' }, move:'eel', p:{
    bl:0.78, depth:0.15, wr:0.9, tm:0.3, nose:1.4, ped:0.12, n:2.4, cs:0.0, pat:[{ k:'band', t0:0, t1:1, y0:-0.35, y1:0.0, part:'Mid' }, { k:'line', t0:0.1, t1:0.98, y:[[0,0.25],[1,0.15]], w:0.07, part:'Accent' }],
    up:[[0,0.05],[0.12,0.45],[0.3,1],[0.7,0.7],[1,0.12]], lo:[[0,0.03],[0.12,0.4],[0.3,1],[0.7,0.65],[1,0.12]], yc:[[0,0.2],[0.15,0],[1,0]],
    dorsal:{ s:0.72, e:0.82, h:0.4 }, anal:{ s:0.75, e:0.83, h:0.35 }, pect:{ t:0.26, y:-0.6, size:0.6, ang:-0.2 }, pelv:{ t:0.62, size:0.35 },
    caudal:{ type:'hetero', hk:1.5, len:1.0 }, eye:EYE(0.12, 0.45, 0.05),
    extra:[...Array.from({ length:12 }, (_, i) => ({ k:'cone', a:{ t:0.2 + i * 0.045, yn:0.98 }, b:{ t:0.205 + i * 0.045, yn:0.98, dy:0.03 }, r:0.016, n:4, part:'Accent' })),
      ...[0.03, 0.06].map(z => ({ k:'limb', sym:true, pts:[{ t:0.07, yn:-0.9, z }, { t:0.07, yn:-0.9, z:z * 1.3, dy:-0.05 }], r0:0.005, r1:0.003, part:'Fins' }))] } },
  arowana: { c:{ Top:'#6a5422', Mid:'#e2bc50', Bottom:'#f2d878', Stripes:'#a8842e', Fins:'#9a4222', Eye:'#15181c', EyeW:'#f0d070' }, p:{
    bl:0.82, depth:0.22, wr:0.45, tm:0.4, nose:1.0, ped:0.3, cs:0.55, yc:[[0,0.35],[0.15,0],[1,0]], up:[[0,0.05],[0.15,0.6],[0.4,0.9],[0.7,1],[1,0.4]], lo:[[0,0.15],[0.15,0.75],[0.4,1],[0.7,1],[1,0.4]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.55, part:'Mid' }, { k:'wave', f:46, fy:7, t0:0.15, t1:0.95, y0:-0.6, y1:0.9, th:0.82, part:'Stripes' }],
    dorsal:{ s:0.72, e:0.95, h:0.4, shape:'tri', peak:0.6, sweep:0.5 }, anal:{ s:0.58, e:0.95, h:0.55, shape:'tri', peak:0.65, sweep:0.5 },
    pect:{ t:0.2, y:-0.7, size:0.6, shape:'long', ang:-0.4 }, pelv:{ t:0.45, size:0.3 }, caudal:{ type:'rounded', hk:1.3 }, eye:EYE(0.08, 0.35, 0.1, { ring:true }),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.01, yn:-0.5, z:0.01 }, { x:0.86, y:0.04, z:0.03 }], r0:0.008, r1:0.004, part:'Fins' }] } },
  zacco: { c:{ Top:'#5a6a6a', Mid:'#e8a88a', Bottom:'#f2d8c8', Stripes:'#2f7aa8', Fins:'#e8784a', Eye:'#15181c', EyeW:'#e8d0b0' }, p:{
    bl:0.8, depth:0.24, wr:0.45, tm:0.38, nose:0.8, ped:0.2, cs:0.35, pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }, { k:'bars', bars:BARS(10, 0.22, 0.9, 0.035, -0.45, 0.6), part:'Stripes' }],
    dorsal:{ s:0.42, e:0.55, h:0.45 }, anal:{ s:0.6, e:0.78, h:0.55, shape:'tri', peak:0.2, back:0.5, sweep:0.6 }, pect:{ t:0.25, y:-0.55, size:0.45 }, pelv:{ t:0.45, size:0.35 },
    caudal:{ type:'forked', notch:0.45, hk:1.35 }, eye:EYE(0.1, 0.3, 0.08, { ring:true }) } },
  bighead: { c:{ Top:'#5a6068', Mid:'#a8acb0', Bottom:'#ebebe7', Spots:'#3a3e44', Fins:'#7a7e82', Eye:'#15181c', EyeW:'#e0e0d8' }, p:{
    bl:0.8, depth:0.3, wr:0.55, tm:0.3, nose:0.5, ped:0.24, cs:0.2, yc:[[0,-0.1],[0.3,0],[1,0]], up:[[0,0.35],[0.1,0.7],[0.25,0.92],[0.4,1],[0.7,0.7],[1,0.25]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, { k:'spots', gt:0.09, gy:0.45, r:0.03, ar:5, t0:0.3, t1:0.95, y0:-0.3, y1:0.9, part:'Spots', fill:0.7 }],
    dorsal:{ s:0.52, e:0.62, h:0.4 }, anal:{ s:0.66, e:0.8, h:0.3 }, pect:{ t:0.32, y:-0.65, size:0.45 }, pelv:{ t:0.5, size:0.3 },
    caudal:{ type:'forked', notch:0.45, hk:1.25 }, eye:EYE(0.1, -0.25, 0.06) } },

  /* ---------------- 海邊、外海 ---------------- */
  mackerel: { c:{ Top:'#1f5f6f', Mid:'#c9d6da', Bottom:'#f2f4f4', Stripes:'#0c2730', Fins:'#6f8a92', Eye:'#15181c', EyeW:'#f2f2ea' }, p:{
    bl:0.84, depth:0.2, wr:0.7, nose:1.15, tm:0.38, ped:0.08, cs:0.1,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.3, y1:0.1, part:'Mid' }, { k:'wave', f:58, fy:6, t0:0.12, t1:0.95, y0:0.28, th:0.45, part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.45, h:0.45, shape:'tri', peak:0.25 }, { s:0.58, e:0.66, h:0.3, shape:'tri', peak:0.3 }], anal:{ s:0.6, e:0.68, h:0.25 }, finlets:{ n:5, s:0.7, e:0.93 },
    pect:{ t:0.24, y:0.05, size:0.45, w:0.3 }, pelv:{ t:0.3, size:0.25 }, caudal:{ type:'forked', notch:0.2, hk:1.55 }, eye:EYE(0.1, 0.25, 0.1, { ring:true }) } },
  scorpion: { c:{ Top:'#5b3a24', Mid:'#9a6235', Bottom:'#dcbc94', Spots:'#3a2416', Accent:'#f1e7d4', Fins:'#8a5530', Eye:'#15181c', EyeW:'#e8c080' }, p:{
    bl:0.8, depth:0.36, wr:0.55, tm:0.28, nose:0.5, ped:0.25, cs:0.15, up:[[0,0.25],[0.1,0.7],[0.25,1],[0.6,0.7],[1,0.25]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.15, part:'Mid' }, { k:'spots', gt:0.12, gy:0.55, r:0.04, ar:6, t0:0.1, t1:0.95, y0:-0.2, y1:0.95, part:'Spots', fill:0.85 }], dots:{ n:16, t0:0.15, t1:0.85, y0:-0.7, y1:-0.1, r:0.015, part:'Accent' },
    dorsal:[{ s:0.18, e:0.55, h:0.42, shape:'spiny', back:0.5 }, { s:0.56, e:0.78, h:0.35, shape:'round' }], anal:{ s:0.62, e:0.76, h:0.35, shape:'round' },
    pect:{ t:0.3, y:-0.3, size:0.6, shape:'round', w:0.9 }, pelv:{ t:0.33, size:0.4 }, caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.11, 0.6, 0.1, { ring:true, pop:0.3 }),
    extra:[0.12, 0.16, 0.2].map((t, i) => ({ k:'cone', sym:true, a:{ t, yn:0.55, z:0.05 }, b:{ t:t + 0.02, yn:0.55, z:0.07, dy:0.035 }, r:0.01, n:4, part:'Fins' })) } },
  moonbream: { c:{ Top:'#c8485a', Mid:'#e88a92', Bottom:'#f6dcd6', Spots:'#3fa6e0', Fins:'#d86070', Eye:'#15181c', EyeW:'#f0d090' }, p:{
    bl:0.8, depth:0.4, wr:0.4, tm:0.35, nose:0.65, ped:0.18, cs:0.2, up:[[0,0.2],[0.12,0.62],[0.3,1],[0.6,0.72],[1,0.18]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }], dots:{ n:30, t0:0.15, t1:0.85, y0:0.0, y1:0.9, r:0.012, part:'Spots' },
    dorsal:[{ s:0.28, e:0.56, h:0.34, shape:'spiny', back:0.7 }, { s:0.56, e:0.76, h:0.28, shape:'flat' }], anal:{ s:0.64, e:0.76, h:0.25 },
    pect:{ t:0.3, y:-0.2, size:0.55, shape:'long', ang:-0.25 }, pelv:{ t:0.33, size:0.35 }, caudal:{ type:'forked', notch:0.5, hk:1.15 }, eye:EYE(0.12, 0.3, 0.08, { ring:true }) } },
  marlin: { c:{ Top:'#0e1f4a', Mid:'#5e7fb0', Bottom:'#e8ecf2', Stripes:'#9cc8ff', Fins:'#1b2235', Eye:'#15181c', EyeW:'#c8d8f0' }, p:{
    bl:0.78, depth:0.22, wr:0.6, tm:0.32, nose:1.1, ped:0.06, cs:0.1, pat:[{ k:'band', t0:0, t1:1, y0:-0.35, y1:0.1, part:'Mid' }, { k:'bars', bars:BARS(12, 0.25, 0.8, 0.012, -0.3, 0.6), part:'Stripes' }],
    dorsal:[{ s:0.15, e:0.62, h:0.9, shape:'sail', sweep:0.25 }, { s:0.82, e:0.85, h:0.18 }], anal:[{ s:0.55, e:0.64, h:0.4, shape:'falcate' }, { s:0.82, e:0.85, h:0.15 }],
    pect:{ t:0.22, y:-0.5, size:0.8, shape:'long', ang:-0.55 }, pelv:{ t:0.26, size:0.5, shape:'long' }, caudal:{ type:'lunate', hk:1.9 }, eye:EYE(0.07, 0.15, 0.08, { ring:true }),
    extra:[{ k:'cone', a:{ t:0.02, yn:0.0 }, b:{ x:1.15, y:0.0, z:0 }, r:0.025, n:6, part:'Top' }] } },
  shark: { c:{ Top:'#8d8576', Mid:'#a59d8e', Bottom:'#f4f2ec', Accent:'#111111', Gill:'#5a554a', Fins:'#8d8576', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.18, wr:0.8, tm:0.35, nose:0.95, ped:0.12, n:2.1, cs:-0.1, yc:[[0,0.25],[0.12,0],[1,0.15]], pat:[{ k:'band', t0:0.3, t1:0.8, y0:-0.35, y1:-0.1, part:'Mid' }, GILLS(0.17)],
    dorsal:[{ s:0.32, e:0.47, h:0.75, shape:'falcate', sweep:0.55 }, { s:0.75, e:0.79, h:0.25 }, { s:0.385, e:0.42, h:0.78, shape:'falcate', sweep:0.6, part:'Accent', inset:0 }], anal:{ s:0.77, e:0.8, h:0.22 },
    pect:{ t:0.26, y:-0.7, size:1.1, shape:'tri', ang:-0.6, out:0.6, w:0.4 }, pelv:{ t:0.6, size:0.4 }, caudal:{ type:'hetero', hk:1.7 }, eye:EYE(0.1, 0.25, 0.045) } },
  hammer: { c:{ Top:'#6d757a', Bottom:'#f0f0ec', Gill:'#4a5055', Fins:'#5f676c', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.16, wr:0.8, tm:0.38, nose:0.6, ped:0.12, cs:-0.1, yc:[[0,0.15],[0.12,0],[1,0.15]], pat:[GILLS(0.17)],
    dorsal:[{ s:0.3, e:0.44, h:0.95, shape:'falcate', sweep:0.4 }, { s:0.76, e:0.79, h:0.2 }], anal:{ s:0.76, e:0.79, h:0.22 },
    pect:{ t:0.25, y:-0.7, size:0.9, shape:'tri', ang:-0.6, out:0.6, w:0.4 }, pelv:{ t:0.6, size:0.35 }, caudal:{ type:'hetero', hk:1.7 }, eye:false,
    extra:[{ k:'ellip', c:{ t:0.025, yn:0.15 }, r:[0.07, 0.022, 0.25], part:'Top', seg:14, rings:6 }, { k:'ellip', sym:true, c:{ x:0.77, y:0.03, z:0.245 }, r:[0.022, 0.02, 0.02], part:'Eye' }] } },
  whaleshark: { c:{ Top:'#3e4c5c', Bottom:'#f1f1ee', Spots:'#e8ecef', Accent:'#59697a', Gill:'#2a3440', Fins:'#3e4c5c', Eye:'#15181c' }, move:'vert', p:{
    bl:0.8, depth:0.2, wr:1.1, tm:0.3, nose:0.45, ped:0.12, n:2.4, cs:-0.25, yc:[[0,0],[0.12,0],[1,0.12]], up:[[0,0.4],[0.1,0.75],[0.3,1],[0.7,0.55],[1,0.12]],
    pat:[GILLS(0.15, 5, 0.022, -0.5, 0.2), { k:'line', t0:0.2, t1:0.95, y:[[0,0.45],[1,0.35]], w:0.04, part:'Accent' }, { k:'line', t0:0.2, t1:0.9, y:[[0,0.15],[1,0.1]], w:0.04, part:'Accent' }],
    dots:{ n:60, t0:0.08, t1:0.95, y0:-0.15, y1:0.98, r:0.018, part:'Spots' },
    dorsal:[{ s:0.5, e:0.62, h:0.55, shape:'falcate', sweep:0.5 }, { s:0.8, e:0.83, h:0.2 }], anal:{ s:0.8, e:0.83, h:0.18 },
    pect:{ t:0.24, y:-0.7, size:1.0, ang:-0.5, out:0.7, w:0.35 }, pelv:{ t:0.6, size:0.35 }, caudal:{ type:'hetero', hk:1.6, up:1 }, eye:EYE(0.06, 0.05, 0.035),
    extra:[{ k:'ellip', c:{ t:0.004, yn:-0.15 }, r:[0.012, 0.012, 0.1], part:'Gill', seg:10, rings:4 }] } },
  dolphin: { c:{ Top:'#5c6670', Mid:'#8f99a2', Bottom:'#eceeee', Fins:'#525b64', Eye:'#15181c' }, move:'vert', p:{
    bl:0.86, depth:0.24, wr:0.85, top:0.55,
    up:[[0,0.07],[0.05,0.13],[0.085,0.16],[0.12,0.5],[0.2,0.78],[0.4,1],[0.6,0.8],[0.8,0.38],[0.93,0.16],[1,0.1]],
    lo:[[0,0.06],[0.06,0.13],[0.1,0.35],[0.25,0.85],[0.42,1],[0.6,0.75],[0.8,0.32],[1,0.1]],
    wd:[[0,0.05],[0.08,0.14],[0.14,0.5],[0.38,1],[0.65,0.7],[0.85,0.25],[1,0.06]], yc:[[0,-0.18],[0.12,-0.05],[0.4,0],[1,0.05]], cs:-0.1,
    pat:[{ k:'band', t0:0.12, t1:0.95, y0:-0.1, y1:0.45, part:'Mid' }, { k:'line', t0:0.15, t1:0.75, y:[[0.15,0.75],[0.4,0.55],[0.75,0.62]], w:0.12, part:'Top' }],
    dorsal:{ s:0.45, e:0.62, h:0.55, shape:'falcate', sweep:0.75 }, pect:{ t:0.24, y:-0.45, size:0.75, w:0.35, shape:'flipper', ang:-0.55, out:0.45 },
    caudal:{ type:'flukes', horiz:true, len:1.0, hk:1.35 }, eye:EYE(0.14, 0.05, 0.05) } },
  orca: { c:{ Top:'#141518', Bottom:'#f5f5f2', Accent:'#f5f5f2', Mid:'#a9adb2', Fins:'#141518', Eye:'#141518' }, move:'vert', p:{
    bl:0.86, depth:0.26, wr:0.9, top:0.55, nose:0.5, tm:0.35, ped:0.12, cs:-0.35,
    up:[[0,0.25],[0.08,0.55],[0.2,0.85],[0.38,1],[0.6,0.8],[0.85,0.3],[1,0.12]], lo:[[0,0.2],[0.08,0.5],[0.25,0.9],[0.42,1],[0.6,0.75],[0.85,0.3],[1,0.12]],
    pat:[{ k:'band', t0:0, t1:0.6, y0:-2, y1:-0.25, part:'Bottom' }, { k:'band', t0:0.6, t1:1, y0:-2, y1:-0.7, part:'Top' }, { k:'ell', t:0.17, y:0.35, rt:0.055, ry:0.13, part:'Accent' }, { k:'ell', t:0.62, y:-0.2, rt:0.12, ry:0.35, part:'Accent' }, { k:'ell', t:0.47, y:0.92, rt:0.06, ry:0.12, part:'Mid' }],
    dorsal:{ s:0.4, e:0.52, h:1.1, shape:'tri', peak:0.3, sweep:0.1, back:0 }, pect:{ t:0.25, y:-0.6, size:0.8, w:0.6, shape:'round', ang:-0.7, out:0.4 },
    caudal:{ type:'flukes', horiz:true, hk:1.45 }, eye:EYE(0.15, 0.2, 0.03) } },
  beluga: { c:{ Top:'#eceff0', Bottom:'#f7f8f7', Fins:'#e0e4e3', Eye:'#2a3138' }, move:'vert', p:{
    bl:0.86, depth:0.26, wr:0.95, nose:0.4, tm:0.38, ped:0.12, cs:-0.3, yc:[[0,-0.1],[0.2,0],[1,0]],
    up:[[0,0.25],[0.04,0.32],[0.07,0.7],[0.15,0.85],[0.22,0.8],[0.4,1],[0.65,0.8],[0.88,0.3],[1,0.12]], lo:[[0,0.2],[0.06,0.4],[0.2,0.85],[0.42,1],[0.65,0.75],[0.88,0.3],[1,0.12]],
    dorsal:{ s:0.45, e:0.65, h:0.08, shape:'round' }, pect:{ t:0.24, y:-0.6, size:0.55, w:0.6, shape:'round', ang:-0.6, out:0.45 },
    caudal:{ type:'flukes', horiz:true, hk:1.35 }, eye:EYE(0.1, 0.0, 0.035) } },
  sunfish: { c:{ Top:'#7e8a96', Bottom:'#cfd6dc', Spots:'#b8c1c9', Fins:'#77838f', Eye:'#15181c', EyeW:'#e9edf0' }, move:'flap', p:{
    bl:0.9, depth:0.62, wr:0.32, tm:0.42, nose:0.45, ped:0.62, tailK:0.6,
    up:[[0,0.25],[0.08,0.62],[0.2,0.88],[0.45,1],[0.75,0.88],[1,0.6]], lo:[[0,0.2],[0.1,0.62],[0.3,0.92],[0.5,1],[0.78,0.88],[1,0.6]], wd:[[0,0.3],[0.2,0.9],[0.5,1],[0.85,0.75],[1,0.45]],
    cs:-0.25, dots:{ n:30, t0:0.2, t1:0.92, y0:-0.85, y1:0.85, r:0.022, part:'Spots' },
    dorsal:{ s:0.56, e:0.84, h:0.85, shape:'tri', peak:0.4, sweep:0.55, back:0.05 }, anal:{ s:0.58, e:0.86, h:0.8, shape:'tri', peak:0.4, sweep:0.55, back:0.05 },
    pect:{ t:0.3, y:0.0, size:0.12, w:0.6, shape:'round', ang:0.1, out:0.2 }, caudal:{ type:'clavus', len:1.4 }, eye:EYE(0.16, 0.15, 0.05, { ring:true }) } },
  sperm: { c:{ Top:'#4f5257', Bottom:'#6a6c70', Accent:'#e8e6e0', Fins:'#45474b', Eye:'#15181c' }, move:'vert', p:{
    bl:0.86, depth:0.22, wr:0.85, tm:0.25, nose:0.15, ped:0.12, n:2.6, cs:-0.2,
    up:[[0,0.85],[0.15,0.95],[0.3,1],[0.38,0.9],[0.55,0.85],[0.65,0.9],[0.75,0.6],[0.9,0.3],[1,0.12]], lo:[[0,0.35],[0.05,0.45],[0.3,0.95],[0.45,1],[0.7,0.6],[1,0.12]], yc:[[0,0.25],[0.3,0],[1,0]],
    pat:[{ k:'band', t0:0.02, t1:0.28, y0:-1.1, y1:-0.85, part:'Accent' }],
    dorsal:{ s:0.6, e:0.68, h:0.12, shape:'round' }, pect:{ t:0.35, y:-0.7, size:0.4, w:0.6, shape:'round', ang:-0.6 },
    caudal:{ type:'flukes', horiz:true, hk:1.4 }, eye:EYE(0.32, -0.45, 0.025),
    extra:[0.74, 0.79, 0.84, 0.89].map(t => ({ k:'ellip', c:{ t, yn:0.95 }, r:[0.018, 0.012, 0.02], part:'Top', seg:8, rings:4 })) } },
  whale: { c:{ Top:'#1d2228', Bottom:'#d9dbd6', Accent:'#e8e8e2', Gill:'#9a9e9a', Fins:'#e8e8e2', Eye:'#15181c' }, move:'vert', p:{
    bl:0.86, depth:0.24, wr:0.95, tm:0.35, nose:0.55, ped:0.1, cs:-0.45, yc:[[0,-0.1],[0.3,0],[1,0.05]],
    up:[[0,0.25],[0.15,0.6],[0.35,1],[0.65,0.8],[0.88,0.3],[1,0.1]], lo:[[0,0.4],[0.12,0.8],[0.35,1],[0.65,0.65],[0.88,0.25],[1,0.1]],
    pat:[{ k:'bars', bars:Array.from({ length:12 }, (_, i) => [0.05, 0.45, -0.95 + i * 0.045, -0.93 + i * 0.045]), part:'Gill' }],
    dots:{ n:14, t0:0.02, t1:0.14, y0:0.2, y1:0.95, r:0.012, part:'Top' },
    dorsal:{ s:0.62, e:0.7, h:0.15, shape:'tri', sweep:0.4 }, pect:{ t:0.28, y:-0.55, size:1.9, w:0.2, shape:'long', ang:-0.45, out:0.9 },
    caudal:{ type:'flukes', horiz:true, hk:1.55, part:'Top' }, eye:EYE(0.2, -0.3, 0.025) } },
  bonito: { c:{ Top:'#2a2f5a', Mid:'#b9c2d0', Bottom:'#eef0f4', Stripes:'#3a4060', Fins:'#3a405e', Eye:'#15181c', EyeW:'#e0e4f0' }, p:{
    bl:0.82, depth:0.27, wr:0.85, tm:0.38, nose:1.0, ped:0.05, cs:0.2,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.3, y1:0.2, part:'Mid' }, { k:'bars', bars:[0, 1, 2, 3].map(i => [0.3, 0.92, -0.75 + i * 0.16, -0.7 + i * 0.16]), part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.5, h:0.4, shape:'tri', peak:0.15 }, { s:0.56, e:0.62, h:0.3, shape:'falcate' }], anal:{ s:0.6, e:0.66, h:0.28, shape:'falcate' }, finlets:{ n:7, s:0.66, e:0.95 },
    pect:{ t:0.25, y:0.0, size:0.4 }, pelv:{ t:0.3, size:0.22 }, caudal:{ type:'lunate', hk:1.5 }, eye:EYE(0.09, 0.3, 0.08, { ring:true }) } },
  tuna: { c:{ Top:'#101a3a', Mid:'#8e9aac', Bottom:'#e8ecf0', Fins:'#2a3040', Fins2:'#e2c420', Eye:'#15181c', EyeW:'#e0e4f0' }, p:{
    bl:0.82, depth:0.28, wr:0.8, tm:0.38, nose:1.0, ped:0.04, cs:0.15, pat:[{ k:'band', t0:0, t1:1, y0:-0.35, y1:0.15, part:'Mid' }],
    dorsal:[{ s:0.28, e:0.46, h:0.35, shape:'tri', peak:0.15 }, { s:0.52, e:0.6, h:0.45, shape:'falcate' }], anal:{ s:0.58, e:0.65, h:0.4, shape:'falcate' }, finlets:{ n:8, s:0.66, e:0.95, part:'Fins2' },
    pect:{ t:0.25, y:0.0, size:0.45 }, pelv:{ t:0.3, size:0.22 }, caudal:{ type:'lunate', hk:1.6 }, eye:EYE(0.09, 0.3, 0.07, { ring:true }) } },
  grouper: { c:{ Top:'#5a5448', Mid:'#7a7262', Bottom:'#9e967f', Spots:'#3f3a32', Fins:'#3f3a32', Eye:'#15181c', EyeW:'#c8b878' }, p:{
    bl:0.8, depth:0.35, wr:0.65, tm:0.35, nose:0.6, ped:0.3, cs:0.2, yc:[[0,-0.15],[0.2,0],[1,0]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, { k:'spots', gt:0.1, gy:0.5, r:0.035, ar:6, t0:0.12, t1:0.95, y0:-0.6, y1:0.95, part:'Spots', fill:0.7 }],
    dorsal:[{ s:0.3, e:0.6, h:0.3, shape:'spiny', back:0.9 }, { s:0.6, e:0.82, h:0.38, shape:'round' }], anal:{ s:0.64, e:0.8, h:0.35, shape:'round' },
    pect:{ t:0.3, y:-0.3, size:0.5, shape:'round' }, pelv:{ t:0.34, size:0.35 }, caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.1, 0.45, 0.06, { ring:true }) } },
  barracuda: { c:{ Top:'#4f6578', Mid:'#c4ccd2', Bottom:'#f2f2ee', Stripes:'#3a4a5a', Spots:'#1d2430', Fins:'#3a2d45', Eye:'#15181c', EyeW:'#e0e4e8' }, p:{
    bl:0.84, depth:0.15, wr:0.7, tm:0.45, nose:1.3, ped:0.25, tailK:1.0, cs:0.3, yc:[[0,-0.25],[0.12,0],[1,0]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'bars', bars:BARS(16, 0.25, 0.9, 0.018, 0.35, 0.95), part:'Stripes' }, { k:'line', t0:0.12, t1:1, y:[[0,0.05],[1,0.05]], w:0.04, part:'Stripes' }],
    dots:{ n:12, t0:0.45, t1:0.9, y0:-0.6, y1:-0.25, r:0.014, part:'Spots' },
    dorsal:[{ s:0.38, e:0.46, h:0.5, shape:'tri', peak:0.3 }, { s:0.68, e:0.74, h:0.45, shape:'falcate' }], anal:{ s:0.69, e:0.75, h:0.42, shape:'falcate' },
    pect:{ t:0.25, y:-0.4, size:0.5 }, pelv:{ t:0.4, size:0.35 }, caudal:{ type:'forked', notch:0.4, hk:1.6 }, eye:EYE(0.09, 0.45, 0.09, { ring:true }) } },
  oarfish: { c:{ Top:'#9fb0c8', Bottom:'#dfe3e8', Spots:'#3a3d48', Fins:'#c8283a', Eye:'#15181c', EyeW:'#e0e8f0' }, move:'eel', p:{
    bl:1.0, depth:0.08, wr:0.25, tm:0.12, nose:0.5, ped:0.05, tailK:1.0, cs:-0.2, ns:70, up:[[0,0.4],[0.08,1],[0.6,0.85],[1,0.1]], lo:[[0,0.4],[0.08,1],[0.6,0.85],[1,0.1]],
    pat:[{ k:'wave', f:110, fy:3, t0:0.1, t1:1, y0:-0.7, y1:0.7, th:0.8, part:'Spots' }],
    dorsal:{ s:0.04, e:1.0, h:0.55, shape:'flat', sweep:0.1, seg:40 }, pect:{ t:0.08, y:-0.3, size:0.4 }, caudal:{ type:'none' }, eye:EYE(0.03, 0.3, 0.12, { ring:true }),
    extra:[...Array.from({ length:7 }, (_, i) => ({ k:'limb', pts:[{ t:0.02 + i * 0.006, yn:1 }, { x:0.78 - i * 0.012, y:0.12 + i * 0.008, z:0 }, { x:0.72 - i * 0.03, y:0.17 + (6 - i) * 0.012, z:0 }], r0:0.006, r1:0.004, n:4, part:'Fins' })),
      { k:'limb', sym:true, pts:[{ t:0.07, yn:-0.95, z:0.005 }, { x:0.65, y:-0.12, z:0.03 }, { x:0.35, y:-0.2, z:0.05 }, { x:0.2, y:-0.17, z:0.05 }], r0:0.006, r1:0.004, n:4, part:'Fins' },
      { k:'ellip', sym:true, c:{ x:0.2, y:-0.17, z:0.05 }, r:[0.03, 0.012, 0.006], part:'Fins' }] } },
  lionfish: { c:{ Top:'#9c2a20', Bottom:'#f8f0e8', Stripes:'#f4ece4', Accent:'#5a1a14', Fins:'#f0d8c8', Fins2:'#9c2a20', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.33, wr:0.5, tm:0.32, nose:0.55, ped:0.28, cs:-2, pat:[{ k:'bars', bars:BARS(9, 0.12, 0.95, 0.04), part:'Stripes' }, { k:'bars', bars:BARS(8, 0.17, 0.9, 0.012), part:'Accent' }],
    dorsal:[{ s:0.22, e:0.6, h:1.2, shape:'spiny', back:0.4, sweep:0.25, part:'Fins2' }, { s:0.62, e:0.82, h:0.4, shape:'round' }], anal:{ s:0.66, e:0.8, h:0.35, shape:'round' },
    pect:{ t:0.3, y:-0.2, size:1.5, shape:'fan', w:1.0, ang:-0.5, out:0.7, part:'Fins2' }, pelv:{ t:0.34, size:0.55, part:'Fins2' }, caudal:{ type:'rounded', hk:1.1 }, eye:EYE(0.1, 0.45, 0.09, { pop:0.3 }),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.08, yn:0.7, z:0.03 }, { t:0.06, yn:0.9, z:0.05, dy:0.06 }], r0:0.006, r1:0.002, part:'Fins' }] } },
  tilefish: { c:{ Top:'#d86a6a', Mid:'#e89a8a', Bottom:'#f0d8b0', Accent:'#f4f4f4', Stripes:'#f0d030', Fins:'#e8a090', Eye:'#15181c' }, p:{
    bl:0.82, depth:0.27, wr:0.5, tm:0.3, nose:0.3, ped:0.28, cs:0.2, up:[[0,0.6],[0.05,0.85],[0.15,1],[0.5,0.85],[1,0.3]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, { k:'ell', t:0.1, y:0.05, rt:0.035, ry:0.2, part:'Accent' }],
    dorsal:{ s:0.25, e:0.92, h:0.25, shape:'flat', sweep:0.2 }, anal:{ s:0.5, e:0.92, h:0.22, shape:'flat', sweep:0.2 }, pect:{ t:0.25, y:-0.3, size:0.5 }, pelv:{ t:0.3, size:0.3 },
    caudal:{ type:'truncate', hk:1.05, part:'Stripes' }, eye:EYE(0.07, 0.5, 0.11) } },
  mahi: { c:{ Top:'#2a8a6a', Mid:'#e8c23a', Bottom:'#f2e494', Spots:'#3a7ac0', Fins:'#2a5aa0', Eye:'#15181c' }, p:{
    bl:0.82, depth:0.26, wr:0.4, tm:0.15, nose:0.25, ped:0.14, tailK:0.8, cs:0.45, up:[[0,0.55],[0.04,0.85],[0.12,1],[0.5,0.7],[1,0.14]], lo:[[0,0.4],[0.1,0.85],[0.3,1],[0.6,0.6],[1,0.14]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.6, y1:0.45, part:'Mid' }], dots:{ n:24, t0:0.12, t1:0.85, y0:-0.3, y1:0.6, r:0.01, part:'Spots' },
    dorsal:{ s:0.05, e:0.92, h:0.4, shape:'rampd', back:0.4, sweep:0.25, seg:24 }, anal:{ s:0.5, e:0.92, h:0.3, shape:'rampd', back:0.4, sweep:0.25 }, pect:{ t:0.25, y:-0.3, size:0.45, part:'Spots' }, pelv:{ t:0.28, size:0.35 },
    caudal:{ type:'forked', notch:0.25, hk:1.7 }, eye:EYE(0.08, 0.0, 0.07) } },
  trevally: { c:{ Top:'#5a6068', Mid:'#9aa2a8', Bottom:'#e2e4e2', Accent:'#2a2e32', Fins:'#4a4e52', Eye:'#15181c', EyeW:'#e0e0d8' }, p:{
    bl:0.8, depth:0.38, wr:0.42, tm:0.3, nose:0.45, ped:0.06, tailK:1.1, cs:0.25, up:[[0,0.4],[0.08,0.75],[0.25,1],[0.55,0.8],[0.8,0.3],[1,0.06]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }, { k:'line', t0:0.62, t1:1, y:[[0,0],[1,0]], w:0.09, part:'Accent' }], dots:{ n:10, t0:0.2, t1:0.7, y0:-0.2, y1:0.7, r:0.008, part:'Accent' },
    dorsal:[{ s:0.3, e:0.4, h:0.25, shape:'spiny' }, { s:0.43, e:0.75, h:0.4, shape:'falcate' }], anal:{ s:0.5, e:0.75, h:0.35, shape:'falcate' },
    pect:{ t:0.27, y:-0.1, size:0.85, shape:'long', ang:-0.2, w:0.3 }, pelv:{ t:0.3, size:0.3 }, caudal:{ type:'forked', notch:0.25, hk:1.45 }, eye:EYE(0.1, 0.35, 0.07, { ring:true }) } },
  saury: { c:{ Top:'#1f3a5a', Mid:'#c8d0d8', Bottom:'#f2f2f2', Spots:'#3a7ad0', Fins:'#3a4a5a', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.86, depth:0.12, wr:0.6, tm:0.45, nose:1.6, ped:0.25, tailK:1.0, cs:0.25, yc:[[0,-0.2],[0.1,0],[1,0]], pat:[{ k:'band', t0:0, t1:1, y0:-0.35, y1:0.25, part:'Mid' }],
    dots:{ n:6, t0:0.3, t1:0.8, y0:0.1, y1:0.2, r:0.012, part:'Spots' },
    dorsal:{ s:0.68, e:0.74, h:0.4 }, anal:{ s:0.66, e:0.73, h:0.38 }, finlets:{ n:6, s:0.75, e:0.95 }, pect:{ t:0.2, y:0.1, size:0.4 }, pelv:{ t:0.5, size:0.3 },
    caudal:{ type:'forked', notch:0.35, hk:1.7 }, eye:EYE(0.08, 0.2, 0.15, { ring:true }) } },
  horsemack: { c:{ Top:'#4a6a88', Mid:'#c8d0d6', Bottom:'#f2f2f0', Accent:'#1a1a1a', Stripes:'#a0aab4', Fins:'#5a6068', Fins2:'#e0c040', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.82, depth:0.24, wr:0.55, tm:0.35, nose:0.9, ped:0.08, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }, { k:'line', t0:0.12, t1:1, y:[[0.12,0.45],[0.45,0.25],[0.6,0.05],[1,0.05]], w:0.06, part:'Stripes' }, { k:'ell', t:0.17, y:0.4, rt:0.02, ry:0.12, part:'Accent' }],
    dorsal:[{ s:0.3, e:0.44, h:0.45, shape:'spiny', back:0.4 }, { s:0.46, e:0.8, h:0.3, shape:'rampd', back:0.4 }], anal:{ s:0.56, e:0.8, h:0.25, shape:'rampd', back:0.4 },
    pect:{ t:0.25, y:0.0, size:0.55, shape:'long' }, pelv:{ t:0.3, size:0.3 }, caudal:{ type:'forked', notch:0.25, hk:1.45, part:'Fins2' }, eye:EYE(0.09, 0.3, 0.12, { ring:true }) } },
  hairtail: { c:{ Top:'#c8d4e0', Bottom:'#e8eef2', Fins:'#e8e0b0', Eye:'#15181c', EyeW:'#f0f0e0' }, move:'eel', p:{
    bl:1.0, depth:0.08, wr:0.3, tm:0.12, nose:0.7, ped:0.01, tailK:0.75, cs:-0.3, ns:64, yc:[[0,-0.2],[0.1,0],[1,0]],
    up:[[0,0.25],[0.06,0.8],[0.12,1],[0.5,0.8],[0.85,0.3],[1,0.02]], lo:[[0,0.45],[0.06,0.85],[0.12,1],[0.5,0.8],[0.85,0.3],[1,0.02]],
    dorsal:{ s:0.08, e:0.78, h:0.4, shape:'flat', sweep:0.1, seg:30 }, pect:{ t:0.1, y:-0.2, size:0.35 }, caudal:{ type:'none' }, eye:EYE(0.04, 0.35, 0.12, { ring:true }),
    extra:[0.01, 0.025].map(t => ({ k:'cone', sym:true, a:{ t, yn:-0.15, z:0.012 }, b:{ t, yn:-0.15, z:0.012, dy:-0.02 }, r:0.004, n:3, part:'Bottom' })) } },
  sardine: { c:{ Top:'#2a6a7a', Mid:'#e2e8ee', Bottom:'#f8f8f8', Spots:'#1a2a3a', Fins:'#c8d0d4', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.82, depth:0.2, wr:0.55, tm:0.38, nose:0.85, ped:0.18, cs:0.35, pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }],
    dots:{ n:9, t0:0.22, t1:0.75, y0:0.2, y1:0.25, r:0.013, part:'Spots' },
    dorsal:{ s:0.4, e:0.52, h:0.4 }, anal:{ s:0.72, e:0.82, h:0.2 }, pect:{ t:0.24, y:-0.55, size:0.35 }, pelv:{ t:0.48, size:0.25 },
    caudal:{ type:'forked', notch:0.35, hk:1.5 }, eye:EYE(0.09, 0.25, 0.1, { ring:true }) } },
  flyingfish: { c:{ Top:'#2a4a7a', Mid:'#c8d4e0', Bottom:'#f4f6f8', Fins:'#8aa0bc', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.82, depth:0.18, wr:0.75, tm:0.32, nose:0.75, ped:0.2, n:2.3, cs:0.25, pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }],
    dorsal:{ s:0.62, e:0.76, h:0.35 }, anal:{ s:0.66, e:0.76, h:0.3 }, pect:{ t:0.22, y:0.3, size:2.0, w:0.5, shape:'wing', ang:0.1, out:1.7, horiz:true }, pelv:{ t:0.5, size:0.8, w:0.5, shape:'wing', ang:0.0, out:1.4, horiz:true },
    caudal:{ type:'forked', notch:0.3, hk:1.5, up:0.8, lo:1.25 }, eye:EYE(0.08, 0.3, 0.11, { ring:true }) } },
  yellowtail: { c:{ Top:'#2a4a7a', Mid:'#c8d0d8', Bottom:'#f0f0f0', Stripes:'#e8c838', Fins:'#8a98a8', Fins2:'#e0c040', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.82, depth:0.25, wr:0.6, tm:0.38, nose:0.95, ped:0.1, cs:0.15, pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.15, part:'Mid' }, { k:'line', t0:0.06, t1:1, y:[[0,0.12],[1,0.05]], w:0.09, part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.4, h:0.2, shape:'spiny' }, { s:0.42, e:0.8, h:0.35, shape:'rampd', back:0.3 }], anal:{ s:0.6, e:0.8, h:0.25, shape:'rampd', back:0.3 },
    pect:{ t:0.25, y:-0.2, size:0.4 }, pelv:{ t:0.3, size:0.3 }, caudal:{ type:'forked', notch:0.25, hk:1.55, part:'Fins2' }, eye:EYE(0.09, 0.3, 0.07, { ring:true }) } },
  milkfish: { c:{ Top:'#6a7a5a', Mid:'#d8dcde', Bottom:'#f4f4f4', Fins:'#9aa0a0', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.8, depth:0.25, wr:0.55, tm:0.4, nose:0.9, ped:0.12, cs:0.35, pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }],
    dorsal:{ s:0.42, e:0.55, h:0.5, shape:'tri', peak:0.25 }, anal:{ s:0.75, e:0.82, h:0.22 }, pect:{ t:0.24, y:-0.6, size:0.4 }, pelv:{ t:0.52, size:0.3 },
    caudal:{ type:'forked', notch:0.2, hk:1.85 }, eye:EYE(0.09, 0.3, 0.08, { ring:true }) } },
  mullet: { c:{ Top:'#5a6a4a', Mid:'#c4c8c8', Bottom:'#f2f2f0', Stripes:'#646e5c', Fins:'#7a807e', Eye:'#15181c', EyeW:'#e0e0d0' }, p:{
    bl:0.82, depth:0.22, wr:0.75, tm:0.35, nose:0.5, ped:0.25, n:2.2, cs:0.3, up:[[0,0.3],[0.1,0.7],[0.35,1],[0.7,0.7],[1,0.25]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.3, part:'Mid' }, { k:'bars', bars:[0, 1, 2, 3, 4, 5].map(i => [0.2, 0.96, -0.45 + i * 0.17, -0.41 + i * 0.17]), part:'Stripes' }],
    dorsal:[{ s:0.4, e:0.48, h:0.4, shape:'spiny' }, { s:0.62, e:0.7, h:0.35 }], anal:{ s:0.62, e:0.72, h:0.3 }, pect:{ t:0.24, y:0.2, size:0.38 }, pelv:{ t:0.4, size:0.3 },
    caudal:{ type:'emarginate', hk:1.25 }, eye:EYE(0.08, 0.35, 0.08, { ring:true }) } },
  clown: { c:{ Top:'#f06a14', Bottom:'#f38a2e', Stripes:'#ffffff', Accent:'#16120f', Fins:'#ec6516', Fins2:'#16120f', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.42, wr:0.5, nose:0.55, tm:0.4, ped:0.35, cs:-2,
    pat:[{ k:'bars', bars:[[0.15, 0.27], [0.47, 0.62], [0.93, 1.01]], part:'Accent' }, { k:'bars', bars:[[0.17, 0.25], [0.49, 0.6], [0.95, 1.01]], part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.55, h:0.28, shape:'spiny', back:0.7 }, { s:0.55, e:0.8, h:0.38, shape:'round' }], anal:{ s:0.6, e:0.8, h:0.35, shape:'round' },
    pect:{ t:0.3, y:-0.2, size:0.38, w:0.6, shape:'round' }, pelv:{ t:0.35, size:0.3 }, caudal:{ type:'rounded', hk:1.15, len:0.95 }, eye:EYE(0.14, 0.3, 0.09) } },
  parrot: { c:{ Top:'#2aa08a', Mid:'#40b89c', Bottom:'#f0a8b8', Stripes:'#e870a0', Accent:'#3a8ac8', Fins:'#3a8ac8', Beak:'#e8f0e8', Eye:'#15181c', EyeW:'#f0c040' }, p:{
    bl:0.8, depth:0.36, wr:0.5, tm:0.38, nose:0.5, ped:0.3, cs:0.3,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.3, part:'Mid' }, { k:'wave', f:52, fy:8, t0:0.15, t1:0.95, y0:-0.6, y1:0.95, th:0.85, part:'Stripes' }, { k:'line', t0:0.0, t1:0.14, y:[[0,-0.3],[0.14,0.1]], w:0.08, part:'Accent' }, { k:'line', t0:0.04, t1:0.13, y:[[0,0.65],[0.13,0.5]], w:0.07, part:'Stripes' }],
    dorsal:{ s:0.28, e:0.85, h:0.25, shape:'flat', sweep:0.15 }, anal:{ s:0.62, e:0.85, h:0.25, shape:'flat', sweep:0.15 }, pect:{ t:0.3, y:-0.1, size:0.45, part:'Accent' }, pelv:{ t:0.35, size:0.3 },
    caudal:{ type:'lunate', hk:1.15 }, eye:EYE(0.1, 0.4, 0.07, { ring:true }),
    extra:[{ k:'ellip', c:{ t:0.0, yn:-0.15 }, r:[0.035, 0.045, 0.05], part:'Beak', seg:10, rings:6 }] } },
  butterfly: { c:{ Top:'#f4f4f0', Bottom:'#f6f2e8', Stripes:'#2a2a2a', Accent:'#1a1a1a', Mid:'#f2c230', Fins:'#f2c230', Eye:'#15181c' }, p:{
    nr:44, ns:48, bl:0.82, depth:0.7, wr:0.3, tm:0.45, nose:0.5, ped:0.35, tailK:0.7, cs:-2, up:[[0,0.12],[0.12,0.5],[0.35,0.95],[0.5,1],[0.8,0.75],[1,0.35]], lo:[[0,0.1],[0.12,0.45],[0.4,0.95],[0.55,1],[0.8,0.7],[1,0.35]],
    pat:[{ k:'band', t0:0.62, t1:1, y0:-2, y1:2, part:'Mid' }, { k:'band', t0:0.1, t1:0.15, y0:-0.2, y1:1.1, part:'Accent' }, ...[0, 1].map(i => ({ k:'line', t0:0.2 + i * 0.12, t1:0.62, y:[[0.2 + i * 0.12, 1.0], [0.62, 0.15 + i * 0.3]], w:0.07, part:'Stripes' })), { k:'line', t0:0.32, t1:0.62, y:[[0.32, -0.95], [0.62, -0.35]], w:0.07, part:'Stripes' }, { k:'ell', t:0.8, y:0.75, rt:0.04, ry:0.12, part:'Accent' }],
    dorsal:{ s:0.22, e:0.92, h:0.16, shape:'flat', sweep:0.35 }, anal:{ s:0.55, e:0.92, h:0.16, shape:'flat', sweep:0.35 }, pect:{ t:0.32, y:-0.2, size:0.2 }, pelv:{ t:0.36, size:0.22 },
    caudal:{ type:'truncate', hk:0.6, len:0.8 }, eye:EYE(0.12, 0.25, 0.05),
    extra:[{ k:'limb', pts:[{ t:0.82, yn:1.0, dy:0.1 }, { x:-0.48, y:0.6, z:0 }, { x:-0.62, y:0.58, z:0 }], r0:0.008, r1:0.003, n:4, part:'Fins' }] } },
  angler: { c:{ Top:'#1a1612', Bottom:'#2a221c', Fins:'#14100e', Glow:'#d8f0ff', Teeth:'#e8e4d8', Eye:'#0a0a0a', EyeW:'#3a3a40' }, glowParts:['Glow'], p:{
    bl:0.84, depth:0.62, wr:0.75, tm:0.32, nose:0.25, ped:0.2, tailK:1.0, cs:-0.1, up:[[0,0.6],[0.1,0.85],[0.3,1],[0.6,0.75],[1,0.2]], lo:[[0,0.95],[0.1,1],[0.35,0.95],[0.65,0.6],[1,0.2]], yc:[[0,0.05],[1,0.1]],
    dorsal:{ s:0.72, e:0.84, h:0.3, shape:'round' }, anal:{ s:0.75, e:0.85, h:0.28, shape:'round' }, pect:{ t:0.45, y:-0.2, size:0.3, shape:'round' }, caudal:{ type:'rounded', hk:0.9 }, eye:EYE(0.2, 0.55, 0.035, { ring:true }),
    extra:[{ k:'limb', pts:[{ t:0.12, yn:1 }, { x:0.75, y:0.42, z:0 }, { x:0.86, y:0.42, z:0 }, { x:0.95, y:0.32, z:0 }], r0:0.01, r1:0.006, part:'Fins' }, { k:'ellip', c:{ x:0.96, y:0.28, z:0 }, r:[0.035, 0.04, 0.035], part:'Glow' },
      ...Array.from({ length:8 }, (_, i) => ({ k:'cone', sym:true, a:{ x:0.8, y:0.12 - i * 0.002, z:0.04 + i * 0.022 }, b:{ x:0.8, y:0.02, z:0.045 + i * 0.022 }, r:0.008, n:4, part:'Teeth' })),
      ...Array.from({ length:8 }, (_, i) => ({ k:'cone', sym:true, a:{ x:0.79, y:-0.16, z:0.04 + i * 0.022 }, b:{ x:0.8, y:-0.05, z:0.045 + i * 0.022 }, r:0.008, n:4, part:'Teeth' }))] } },

  /* ---------------- 第六批：常見的小魚 ---------------- */
  pomfret: { c:{ Top:'#aab4bc', Mid:'#d4dade', Bottom:'#eef1f3', Fins:'#b8c0c6', Eye:'#15181c' }, p:{
    bl:0.78, depth:0.62, wr:0.3, tm:0.42, nose:0.45, ped:0.12, tailK:1.1, cs:0.3, pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.3, part:'Mid' }],
    dorsal:{ s:0.4, e:0.85, h:0.35, shape:'tri', peak:0.1, back:0.2, sweep:0.6 }, anal:{ s:0.42, e:0.85, h:0.35, shape:'tri', peak:0.1, back:0.2, sweep:0.6 },
    pect:{ t:0.3, y:-0.1, size:0.4, shape:'long' }, caudal:{ type:'forked', notch:0.2, hk:1.0, lo:1.25 }, eye:EYE(0.1, 0.15, 0.05) } },
  grunt: { c:{ Top:'#6f6a48', Mid:'#b59a6a', Bottom:'#e8e0c8', Stripes:'#3e3a28', Fins:'#8a7a50', Eye:'#15181c', EyeW:'#e0d0a0' }, p:{
    bl:0.8, depth:0.3, wr:0.5, tm:0.35, nose:0.75, ped:0.22, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, ...[0.55, 0.2, -0.15].map(y => ({ k:'line', t0:0.08, t1:1, y:[[0, y + 0.1], [1, y * 0.5]], w:0.05, part:'Stripes' }))],
    dorsal:[{ s:0.3, e:0.55, h:0.4, shape:'spiny', back:0.6 }, { s:0.56, e:0.76, h:0.3, shape:'flat' }], anal:{ s:0.64, e:0.76, h:0.28 }, pect:{ t:0.27, y:-0.2, size:0.4 }, pelv:{ t:0.32, size:0.35 },
    caudal:{ type:'forked', notch:0.5, hk:1.2 }, eye:EYE(0.1, 0.35, 0.09, { ring:true }) } },
  roundscad: { c:{ Top:'#2f6a80', Mid:'#c6d2d8', Bottom:'#f2f4f4', Accent:'#1a1a1a', Stripes:'#a0aab4', Fins:'#7a8a96', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.82, depth:0.22, wr:0.6, tm:0.38, nose:0.95, ped:0.08, cs:0.25, pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.25, part:'Mid' }, { k:'line', t0:0.6, t1:1, y:[[0, 0.05], [1, 0.05]], w:0.07, part:'Stripes' }, { k:'ell', t:0.17, y:0.35, rt:0.02, ry:0.12, part:'Accent' }],
    dorsal:[{ s:0.3, e:0.44, h:0.4, shape:'spiny', back:0.4 }, { s:0.46, e:0.8, h:0.25, shape:'rampd', back:0.4 }], anal:{ s:0.56, e:0.8, h:0.22, shape:'rampd', back:0.4 }, finlets:{ n:1, s:0.86, e:0.88 },
    pect:{ t:0.25, y:0.0, size:0.45, shape:'long' }, pelv:{ t:0.3, size:0.25 }, caudal:{ type:'forked', notch:0.25, hk:1.45 }, eye:EYE(0.09, 0.3, 0.12, { ring:true }) } },
  anchovy: { c:{ Top:'#3a6a8a', Mid:'#d8e0e6', Bottom:'#f6f8f8', Stripes:'#e8f0f6', Fins:'#c8d4dc', Eye:'#15181c', EyeW:'#e8ecf0' }, p:{
    bl:0.84, depth:0.17, wr:0.55, tm:0.4, nose:0.9, ped:0.15, cs:0.3, yc:[[0,0.15],[0.1,0],[1,0]], pat:[{ k:'band', t0:0, t1:1, y0:-0.6, y1:0.3, part:'Mid' }, { k:'line', t0:0.12, t1:1, y:[[0,0.05],[1,0.05]], w:0.1, part:'Stripes' }],
    dorsal:{ s:0.45, e:0.55, h:0.4 }, anal:{ s:0.7, e:0.8, h:0.2 }, pect:{ t:0.2, y:-0.6, size:0.3 }, pelv:{ t:0.45, size:0.2 },
    caudal:{ type:'forked', notch:0.3, hk:1.5 }, eye:EYE(0.08, 0.2, 0.13, { ring:true }) } },
  filefish: { c:{ Top:'#6f8078', Mid:'#9aa8a0', Bottom:'#d8dcd4', Spots:'#5a6a62', Fins:'#3fa070', Eye:'#15181c', EyeW:'#d8e0c0' }, p:{
    bl:0.82, depth:0.45, wr:0.3, tm:0.42, nose:1.1, ped:0.22, cs:0.2, yc:[[0,0.25],[0.2,0],[1,0]], pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }, { k:'spots', gt:0.1, gy:0.5, r:0.03, ar:5, t0:0.2, t1:0.9, y0:-0.4, y1:0.9, part:'Spots', fill:0.5 }],
    dorsal:[{ s:0.18, e:0.2, h:0.7, shape:'tri', peak:0.5, sweep:0.3, back:0 }, { s:0.48, e:0.86, h:0.28, shape:'round' }], anal:{ s:0.5, e:0.86, h:0.26, shape:'round' },
    pect:{ t:0.3, y:0.0, size:0.25, shape:'round' }, caudal:{ type:'truncate', hk:1.0 }, eye:EYE(0.18, 0.45, 0.07, { ring:true }) } },
  threadfin: { c:{ Top:'#e07a8a', Mid:'#f0a8b0', Bottom:'#f8e4e0', Stripes:'#f2c840', Fins:'#f0b0b8', Fins2:'#f2c840', Eye:'#15181c', EyeW:'#f0d0d8' }, p:{
    bl:0.8, depth:0.3, wr:0.45, tm:0.35, nose:0.8, ped:0.2, cs:0.3, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, ...[0.45, 0.15, -0.2].map(y => ({ k:'line', t0:0.12, t1:1, y:[[0, y], [1, y * 0.6]], w:0.045, part:'Stripes' }))],
    dorsal:{ s:0.3, e:0.8, h:0.25, shape:'flat' }, anal:{ s:0.6, e:0.8, h:0.2, shape:'flat' }, pect:{ t:0.27, y:-0.2, size:0.45, shape:'long' }, pelv:{ t:0.3, size:0.35 },
    caudal:{ type:'forked', notch:0.45, hk:1.2, part:'Fins2' }, eye:EYE(0.1, 0.35, 0.1, { ring:true }),
    extra:[{ k:'limb', pts:[{ x:-0.62, y:0.2, z:0 }, { x:-0.85, y:0.3, z:0 }, { x:-1.0, y:0.33, z:0 }], r0:0.006, r1:0.002, n:3, part:'Fins2' }] } },
  sergeant: { c:{ Top:'#e8d870', Bottom:'#f2f2ec', Mid:'#dce6d8', Stripes:'#1d1d1d', Fins:'#d8d8c8', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.5, wr:0.4, tm:0.4, nose:0.55, ped:0.25, cs:0.45, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.45, part:'Mid' }, { k:'bars', bars:BARS(5, 0.22, 0.86, 0.06, -0.55, 1.1), part:'Stripes' }],
    dorsal:[{ s:0.3, e:0.6, h:0.3, shape:'spiny', back:0.9 }, { s:0.6, e:0.8, h:0.35, shape:'round' }], anal:{ s:0.62, e:0.8, h:0.32, shape:'round' }, pect:{ t:0.3, y:-0.2, size:0.4 }, pelv:{ t:0.34, size:0.35 },
    caudal:{ type:'forked', notch:0.5, hk:1.0 }, eye:EYE(0.12, 0.3, 0.08) } },
  rabbitfish: { c:{ Top:'#7a6a40', Mid:'#9a8a5a', Bottom:'#d8d0b0', Spots:'#e0d8b8', Fins:'#8a7a50', Eye:'#15181c', EyeW:'#d8c880' }, p:{
    bl:0.8, depth:0.4, wr:0.4, tm:0.4, nose:0.7, ped:0.2, cs:0.2, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.2, part:'Mid' }], dots:{ n:30, t0:0.15, t1:0.9, y0:-0.5, y1:0.9, r:0.014, part:'Spots' },
    dorsal:[{ s:0.25, e:0.62, h:0.3, shape:'spiny', back:0.9 }, { s:0.62, e:0.84, h:0.32, shape:'round' }], anal:{ s:0.5, e:0.84, h:0.28, shape:'spiny', back:0.9 }, pect:{ t:0.3, y:-0.1, size:0.4 }, pelv:{ t:0.35, size:0.35 },
    caudal:{ type:'emarginate', hk:1.1 }, eye:EYE(0.13, 0.35, 0.08, { ring:true }) } },
  bluetang: { c:{ Top:'#2a5ad8', Bottom:'#3a6ae0', Accent:'#121a2e', Fins:'#1f3a9a', Fins2:'#f2d23a', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.5, wr:0.35, tm:0.42, nose:0.5, ped:0.22, cs:-2,
    pat:[{ k:'line', t0:0.14, t1:0.95, y:[[0.14, 0.55], [0.5, 0.65], [0.75, 0.2], [0.95, 0.1]], w:0.12, part:'Accent' }, { k:'ell', t:0.45, y:0.1, rt:0.12, ry:0.15, part:'Accent' }, { k:'band', t0:0.94, t1:1.01, y0:-2, y1:2, part:'Fins2' }],
    dorsal:{ s:0.28, e:0.92, h:0.22, shape:'flat', part:'Accent' }, anal:{ s:0.55, e:0.92, h:0.2, shape:'flat', part:'Accent' }, pect:{ t:0.32, y:-0.1, size:0.45, part:'Fins2' }, pelv:{ t:0.36, size:0.3 },
    caudal:{ type:'emarginate', hk:1.05, part:'Fins2' }, eye:EYE(0.13, 0.3, 0.08) } },
  moonwrasse: { c:{ Top:'#2fa880', Bottom:'#4fc89a', Stripes:'#e870b0', Accent:'#4a8ae0', Fins:'#e870b0', Fins2:'#f2d23a', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.26, wr:0.45, tm:0.38, nose:0.7, ped:0.25, cs:-0.2, pat:[{ k:'bars', bars:BARS(14, 0.2, 0.95, 0.012, -0.8, 0.9), part:'Stripes' }, { k:'band', t0:0, t1:0.15, y0:-2, y1:2, part:'Accent' }, { k:'line', t0:0.0, t1:0.15, y:[[0, 0.1], [0.15, 0.3]], w:0.08, part:'Stripes' }],
    dorsal:{ s:0.25, e:0.85, h:0.25, shape:'flat' }, anal:{ s:0.55, e:0.85, h:0.22, shape:'flat' }, pect:{ t:0.27, y:-0.1, size:0.45, part:'Accent' }, pelv:{ t:0.32, size:0.25 },
    caudal:{ type:'lunate', hk:1.25, part:'Fins2' }, eye:EYE(0.08, 0.3, 0.08) } },
  acro: { c:{ Top:'#6a6a3a', Mid:'#b8aa6a', Bottom:'#eee8cc', Stripes:'#2e2e1e', Fins:'#a89060', Eye:'#15181c', EyeW:'#e0d090' }, p:{
    bl:0.8, depth:0.28, wr:0.55, tm:0.38, nose:0.75, ped:0.22, cs:0.3, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'bars', bars:BARS(6, 0.24, 0.88, 0.05, -0.4, 1.1), part:'Stripes' }],
    dorsal:{ s:0.38, e:0.52, h:0.45, shape:'tri', peak:0.2 }, anal:{ s:0.7, e:0.78, h:0.28 }, pect:{ t:0.25, y:-0.55, size:0.4 }, pelv:{ t:0.45, size:0.3 }, caudal:{ type:'forked', notch:0.45, hk:1.3 }, eye:EYE(0.1, 0.3, 0.08, { ring:true }),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.02, yn:-0.4, z:0.02 }, { x:0.79, y:-0.06, z:0.05 }], r0:0.006, r1:0.003, part:'Fins' }] } },
  pseudorasbora: { c:{ Top:'#7a8068', Mid:'#c0c4b4', Bottom:'#eeeee6', Stripes:'#2f3428', Fins:'#a8ac98', Eye:'#15181c', EyeW:'#e0e0d0' }, p:{
    bl:0.82, depth:0.22, wr:0.55, tm:0.4, nose:0.85, ped:0.25, cs:0.3, yc:[[0,0.2],[0.1,0],[1,0]], pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'line', t0:0.05, t1:1, y:[[0,0.1],[1,0.05]], w:0.08, part:'Stripes' }],
    dorsal:{ s:0.4, e:0.52, h:0.4 }, anal:{ s:0.68, e:0.76, h:0.25 }, pect:{ t:0.22, y:-0.6, size:0.3 }, pelv:{ t:0.42, size:0.25 }, caudal:{ type:'forked', notch:0.45, hk:1.3 }, eye:EYE(0.08, 0.3, 0.1, { ring:true }) } },
  hillstream: { c:{ Top:'#7a6a42', Bottom:'#e8dfc4', Spots:'#d8c070', Fins:'#8a7a50', Eye:'#15181c' }, p:{
    bl:0.84, depth:0.11, wr:1.8, tm:0.25, nose:0.45, ped:0.35, tailK:0.8, n:2.2, cs:-0.1, wd:[[0,0.55],[0.2,1],[0.5,0.75],[1,0.35]], dots:{ n:24, t0:0.1, t1:0.9, y0:0.2, y1:0.95, r:0.02, part:'Spots' },
    dorsal:{ s:0.42, e:0.55, h:0.6, shape:'round' }, anal:{ s:0.7, e:0.78, h:0.4, shape:'round' }, pect:{ t:0.16, y:-0.2, size:1.3, shape:'round', w:1.1, horiz:true, out:1.0, ang:0 }, pelv:{ t:0.45, size:1.0, shape:'round', w:1.0, horiz:true, out:1.0, ang:0 },
    caudal:{ type:'emarginate', hk:1.6 }, eye:EYE(0.1, 0.75, 0.08, { pop:0.4 }) } },
  candidia: { c:{ Top:'#4f6f7a', Mid:'#c0ccd0', Bottom:'#eef0ee', Stripes:'#1f2f3a', Fins:'#e07a5a', Eye:'#15181c', EyeW:'#e0e8ea' }, p:{
    bl:0.82, depth:0.23, wr:0.5, tm:0.38, nose:0.8, ped:0.22, cs:0.3, pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }, { k:'line', t0:0.1, t1:1, y:[[0,0.12],[1,0.05]], w:0.13, part:'Stripes' }],
    dorsal:{ s:0.42, e:0.54, h:0.45 }, anal:{ s:0.64, e:0.76, h:0.35 }, pect:{ t:0.24, y:-0.6, size:0.35 }, pelv:{ t:0.45, size:0.3 }, caudal:{ type:'forked', notch:0.45, hk:1.35 }, eye:EYE(0.09, 0.3, 0.09, { ring:true }),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.02, yn:-0.4, z:0.02 }, { x:0.8, y:-0.05, z:0.05 }], r0:0.005, r1:0.002, part:'Fins' }] } },
  medaka: { c:{ Top:'#8a8a60', Mid:'#c8c8a8', Bottom:'#f0eee0', Fins:'#d8d4c0', Eye:'#15181c', EyeW:'#d0e8f0' }, p:{
    bl:0.84, depth:0.22, wr:0.6, tm:0.45, nose:0.7, ped:0.35, tailK:0.9, cs:0.4, yc:[[0,0.2],[0.2,0],[1,0]], up:[[0,0.4],[0.15,0.7],[0.45,0.95],[0.6,1],[1,0.35]], pat:[{ k:'band', t0:0, t1:1, y0:-0.6, y1:0.4, part:'Mid' }],
    dorsal:{ s:0.74, e:0.82, h:0.35, shape:'round' }, anal:{ s:0.52, e:0.85, h:0.3, shape:'flat' }, pect:{ t:0.22, y:0.2, size:0.35 }, pelv:{ t:0.42, size:0.25 }, caudal:{ type:'truncate', hk:1.1 }, eye:EYE(0.1, 0.45, 0.16, { ring:true }) } },

  /* ---------------- 魟魚、比目魚 ---------------- */
  manta: { c:{ Top:'#1c1f26', Bottom:'#f2f2ee', Accent:'#e9e9e4', Fins:'#14161b', Eye:'#15181c' }, move:'wing', view:[-0.4, 0.7], p:{
    bl:0.66, depth:0.12, wr:13, tm:0.3, nose:0.6, ped:0.08, cs:0.0, ns:44, nr:36, up:[[0,0.5],[0.2,1],[0.6,0.7],[1,0.2]], lo:[[0,0.4],[0.2,0.8],[0.6,0.5],[1,0.2]],
    wd:[[0,0.17],[0.1,0.25],[0.32,1],[0.42,0.55],[0.62,0.14],[1,0.04]], pat:[{ k:'ellz', t:0.28, z:0.38, rt:0.13, rz:0.22, part:'Accent' }],
    dorsal:{ s:0.84, e:0.92, h:2.0, shape:'tri' }, caudal:{ type:'none' }, eye:false,
    extra:[{ k:'tube', a:{ t:1, yn:0 }, b:{ x:-0.85, y:0.0, z:0 }, r0:0.016, r1:0.004, part:'Top' }, { k:'ellip', sym:true, c:{ x:0.8, y:0.0, z:0.13 }, r:[0.012, 0.012, 0.012], part:'Eye' },
      { k:'plate', sym:true, pts:[{ x:0.79, y:0.0, z:0.09 }, { x:0.96, y:-0.02, z:0.1 }, { x:0.95, y:-0.04, z:0.14 }, { x:0.79, y:-0.01, z:0.15 }], part:'Top' }] } },
  stingray: { c:{ Top:'#b49a50', Bottom:'#f4f2ee', Spots:'#2aa0e8', Stripes:'#2a8ad8', Eye:'#e8c840', Fins:'#a08848' }, move:'wing', view:[-0.4, 0.75], p:{
    bl:0.6, depth:0.12, wr:7.5, tm:0.4, nose:0.6, ped:0.1, cs:0.0, ns:40, nr:36, up:[[0,0.6],[0.3,1],[0.7,0.8],[1,0.3]], lo:[[0,0.4],[0.3,0.7],[1,0.3]],
    wd:[[0,0.3],[0.1,0.72],[0.35,1],[0.65,0.88],[0.9,0.4],[1,0.12]], dots:{ n:40, t0:0.05, t1:0.95, y0:0.2, y1:0.98, r:0.014, part:'Spots' },
    caudal:{ type:'none' }, eye:false,
    extra:[{ k:'tube', a:{ t:1, yn:0 }, b:{ x:-0.75, y:0.0, z:0 }, r0:0.03, r1:0.006, part:'Top' }, { k:'tube', a:{ x:-0.25, y:0.022, z:0 }, b:{ x:-0.6, y:0.012, z:0 }, r0:0.008, r1:0.004, part:'Stripes' },
      { k:'cone', a:{ x:-0.45, y:0.02, z:0 }, b:{ x:-0.55, y:0.05, z:0 }, r:0.008, n:4, part:'Fins' }, { k:'ellip', sym:true, c:{ x:0.58, y:0.05, z:0.05 }, r:[0.02, 0.018, 0.018], part:'Eye' }] } },
  flounder: { c:{ Top:'#6b5a43', Bottom:'#f2efe8', Spots:'#3e3222', Accent:'#e8e0d0', Fins:'#6b5a43', Eye:'#15181c', EyeW:'#d8c8a0' }, move:'wing', view:[-0.4, 0.75], p:{
    flat:true, bl:0.82, depth:0.42, wr:0.2, tm:0.4, nose:0.55, ped:0.2, cs:-2, nr:30,
    pat:[{ k:'band', t0:0, t1:1.01, side:-1, part:'Bottom' }], dots:[{ n:16, t0:0.1, t1:0.9, y0:-0.6, y1:0.6, r:0.035, part:'Spots', side:1 }, { n:14, t0:0.1, t1:0.9, y0:-0.6, y1:0.6, r:0.012, part:'Accent', side:1, seed:5 }],
    dorsal:{ s:0.06, e:0.94, h:0.22, shape:'round', sweep:0.1, seg:24 }, anal:{ s:0.3, e:0.94, h:0.2, shape:'round', sweep:0.1, seg:20 }, pect:{ t:0.26, y:0, size:0.3, shape:'round', out:0.1 },
    caudal:{ type:'rounded', hk:1.0 }, eye:false,
    extra:[{ k:'ellip', c:{ t:0.09, yn:0.45, z:0.045 }, r:[0.025, 0.025, 0.02], part:'Eye' }, { k:'ellip', c:{ t:0.12, yn:0.1, z:0.05 }, r:[0.025, 0.025, 0.02], part:'Eye' }] } },

  /* ---------------- 頭足類、水母、海龜、海馬 ---------------- */
  squid: { gen:'squid', c:{ Top:'#f0c8b8', Bottom:'#f8ece6', Spots:'#b8584a', Fins:'#f4d4c4', Arms:'#f0c0b0', Eye:'#1a1414', EyeW:'#e8f0f0' }, p:{ mantle:0.5, R:0.085, armLen:0.2, tentLen:0.36, finS:0.45, finW:1.7, spots:40 } },
  ika: { gen:'squid', c:{ Top:'#d87a60', Bottom:'#f6e4dc', Spots:'#8a2a1e', Fins:'#e8a890', Arms:'#e09078', Eye:'#1a1414', EyeW:'#f0e8e0' }, p:{ mantle:0.56, R:0.08, armLen:0.2, tentLen:0.36, finS:0.5, finW:1.5, taper:1.2, spots:60 } },
  giantsquid: { gen:'squid', c:{ Top:'#9a3a2e', Bottom:'#e8c8bc', Spots:'#5a1a14', Fins:'#a84838', Arms:'#b85a48', Eye:'#ffd36a', EyeW:'#f2e2da' }, glow:true, p:{ mantle:0.42, R:0.1, armLen:0.3, tentLen:0.75, finS:0.72, finW:1.1, spots:30, eye:1.6 } },
  cuttle: { gen:'squid', c:{ Top:'#8a6448', Bottom:'#efe6da', Stripes:'#f6f2ea', Fins:'#d8c8b0', Arms:'#a88466', Eye:'#2a2418', EyeW:'#e8d8b8' }, p:{ mantle:0.55, R:0.17, my:0.55, mz:1.0, taper:0.5, armLen:0.16, tent:false, fin:'fringe', finW:0.28, bands:7, head:0.7 } },
  octopus: { gen:'octo', c:{ Top:'#b04a3a', Arms:'#c06a50', Bottom:'#f4e0d4', Spots:'#8a3428', Eye:'#2a1a14', EyeW:'#f0d890' }, move:'vert', p:{ R:0.22, armLen:0.7, spots:24 } },
  jelly: { gen:'jelly', c:{ Top:'#cfe6f6', Bottom:'#e8f4fc', Ring:'#ffffff', Spots:'#c9a0d8', Fins:'#e8e0f0' }, glow:true, move:'vert', p:{ R:0.38, H:0.24 } },
  turtle: { gen:'turtle', c:{ Top:'#6b6a3a', Spots:'#57562c', Bottom:'#e6cf7a', Skin:'#5a4a32', Eye:'#15140e' }, move:'wing', view:[-0.5, 0.55], p:{ cl:0.5, cw:0.4, ch:0.16 } },
  seahorse: { gen:'seahorse', c:{ Top:'#c89a3a', Stripes:'#a87a2a', Bottom:'#e0c070', Fins:'#f0e4c8', Eye:'#15140e', EyeW:'#f0e0b0' }, move:'vert', view:[-0.4, 0.05], p:{} },

  /* ---------------- 甲殼類 ---------------- */
  crab: { gen:'crab', c:{ Top:'#d8c8a0', Bottom:'#f0e6cc', Spots:'#8a7a58', Fins:'#e0d2b0', Claw:'#f0e6cc', Eye:'#141418' }, move:'vert', p:{
    cd:0.28, cr:0.34, ch:0.13, pairs:4, span:0.62, legR:0.026, eyeH:0.08, spots:10, claw:{ size:0.75, right:1.45 },
    shell:v => [v[0] * (v[0] > 0 ? 1 : 0.9), v[1], v[2] * (1 - Math.max(0, -v[0]) * 0.15)] } },
  kingcrab: { gen:'crab', c:{ Top:'#9a2a2c', Bottom:'#e8d8c0', Spots:'#c24a40', Fins:'#a83a34', Claw:'#a83a34', Eye:'#141418' }, move:'vert', p:{
    cd:0.27, cr:0.29, ch:0.13, pairs:3, span:0.8, legR:0.045, legBias:-0.1, legSpikes:true, spikes:{ n:70, h:0.045, r:0.014 }, claw:{ size:0.9, right:1.3 },
    shell:v => [v[0] * (v[0] > 0 ? 1.12 : 0.92), v[1], v[2] * (1 - Math.max(0, v[0]) * 0.25)] } },
  lobster: { gen:'shrimp', c:{ Ant:'#f4f4f4', Cara:'#e6d6e0', Top:'#3f7a5a', Bottom:'#e8e0d8', Stripes:'#1d2a24', Fins:'#1f2a45', Claw:'#1f2a45', Eye:'#141418' }, move:'vert', p:{
    len:0.6, cw:0.15, ch:0.15, cara:0.42, curl:0.15, rostrum:0, ant:0.55, legLen:0.24, bands:[1, 3, 5], scale:false, ridge:true, caraPart:'Cara', antR:0.022, antPart:'Ant' } },
  shrimp: { gen:'shrimp', c:{ Top:'#f4b8c0', Bottom:'#f8dde0', Stripes:'#e05060', Fins:'#f09aa8', Eye:'#141418' }, move:'vert', glow:true, p:{
    len:0.6, cw:0.09, ch:0.1, curl:0.35, rostrum:0.1, ant:1.4, legLen:0.32, bands:[2, 4] } },
  prawn: { gen:'shrimp', c:{ Top:'#6f7f70', Bottom:'#d9dcc8', Stripes:'#5a6a5c', Fins:'#8a9478', Claw:'#2f62b8', Eye:'#141418' }, move:'vert', p:{
    len:0.62, cw:0.14, ch:0.15, curl:0.3, rostrum:0.17, rostUp:0.05, ant:1.2, claw:{ leg:1, len:0.85, r:0.022, palm:1.3, finger:0.22 } } },
  whiteshrimp: { gen:'shrimp', c:{ Top:'#e8e8e0', Bottom:'#f8f8f4', Stripes:'#d8d8d0', Fins:'#d86a50', Eye:'#141418' }, move:'vert', p:{
    len:0.62, cw:0.12, ch:0.13, curl:0.35, rostrum:0.12, ant:1.3, legLen:0.3 } },
  tigerprawn: { gen:'shrimp', c:{ Top:'#e8e0c8', Bottom:'#f0e8d0', Stripes:'#3a2a2a', Fins:'#c84a3a', Eye:'#141418' }, move:'vert', p:{
    len:0.64, cw:0.13, ch:0.14, curl:0.33, rostrum:0.14, ant:1.25, legLen:0.3, bands:[0, 2, 4], ridge:true } },
  crayfish: { gen:'shrimp', c:{ Top:'#9a1e1e', Bottom:'#c8502a', Stripes:'#5a0e0e', Fins:'#a82a20', Claw:'#b8261e', Eye:'#141418' }, move:'vert', p:{
    len:0.6, cw:0.14, ch:0.14, cara:0.45, curl:0.12, rostrum:0.05, ant:0.7, legLen:0.26, scale:false, claw:{ leg:0, len:0.62, r:0.03, palm:2.0, finger:0.3 } } },
  blueclaw: { gen:'shrimp', c:{ Top:'#6a6050', Bottom:'#d8d0c0', Stripes:'#5a5040', Fins:'#7a7060', Claw:'#1e3a8a', Eye:'#141418' }, move:'vert', p:{
    len:0.55, cw:0.15, ch:0.16, curl:0.3, rostrum:0.15, rostUp:0.05, ant:1.2, claw:{ leg:1, len:1.15, r:0.028, palm:1.4, finger:0.22 } } },
  goldprawn: { gen:'shrimp', c:{ Top:'#d8a830', Bottom:'#fff0a0', Stripes:'#b88a20', Fins:'#e8c040', Claw:'#e8c040', Eye:'#1a1a1a' }, move:'vert', glow:true, p:{
    len:0.6, cw:0.15, ch:0.16, curl:0.3, rostrum:0.18, rostUp:0.06, ant:1.3, ridge:true, claw:{ leg:1, len:0.95, r:0.026, palm:1.4, finger:0.24 } } },
  bluelobster: { gen:'shrimp', c:{ Top:'#2f6fe0', Bottom:'#9cc4ff', Stripes:'#2458c0', Fins:'#2a5cc0', Claw:'#2f6fe0', Eye:'#141418' }, move:'vert', glow:true, p:{
    len:0.62, cw:0.15, ch:0.15, cara:0.42, curl:0.12, rostrum:0.06, ant:0.75, legLen:0.26, scale:false, claw:{ leg:0, len:0.66, r:0.032, palm:2.3, finger:0.32 } } },
  // ---- 紅樹林（2026-11-04，參考維基百科）----
  // 金錢魚 Scatophagus argus：側扁、很高的身體，黃褐色帶不規則黑斑，頭和嘴小，最大約 30 公分
  scat: { c:{ Top:'#8a7a3a', Mid:'#c8b45a', Bottom:'#e8dca0', Spots:'#1e1a10', Fins:'#a8963e', Eye:'#15181c', EyeW:'#e8d890' }, p:{
    bl:0.75, depth:0.62, wr:0.32, tm:0.32, nose:0.55, ped:0.14, cs:0.2, up:[[0,0.25],[0.15,0.75],[0.4,1],[0.7,0.8],[1,0.2]], lo:[[0,0.3],[0.2,0.8],[0.5,1],[0.8,0.6],[1,0.2]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.3, part:'Mid' }], dots:{ n:34, t0:0.12, t1:0.85, y0:-0.6, y1:0.9, r:0.03, part:'Spots' },
    dorsal:[{ s:0.3, e:0.55, h:0.4, shape:'spiny', back:0.6 }, { s:0.56, e:0.8, h:0.38, shape:'flat' }], anal:{ s:0.55, e:0.8, h:0.38 }, pect:{ t:0.26, y:-0.1, size:0.35 }, pelv:{ t:0.3, size:0.3 },
    caudal:{ type:'truncate', hk:1.0 }, eye:EYE(0.1, 0.35, 0.09, { ring:true }) } },
  // 花身鯻 Terapon jarbua：銀白色，身上有 3～4 條往後彎的黑色縱帶，尾鰭有黑色斜帶
  terapon: { c:{ Top:'#7a8288', Mid:'#c8ccce', Bottom:'#f2f2f0', Stripes:'#22262a', Fins:'#a8acae', Eye:'#15181c', EyeW:'#e8e8e0' }, p:{
    bl:0.8, depth:0.32, wr:0.5, tm:0.36, nose:0.7, ped:0.2, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, ...[0.6, 0.25, -0.1, -0.4].map(y => ({ k:'line', t0:0.1, t1:1, y:[[0, y + 0.18], [0.5, y + 0.05], [1, y * 0.4]], w:0.055, part:'Stripes' }))],
    dorsal:[{ s:0.28, e:0.55, h:0.42, shape:'spiny', back:0.55 }, { s:0.55, e:0.72, h:0.3, shape:'flat' }], anal:{ s:0.64, e:0.75, h:0.28 }, pect:{ t:0.27, y:-0.2, size:0.38 }, pelv:{ t:0.32, size:0.32 },
    caudal:{ type:'emarginate', hk:1.2 }, eye:EYE(0.1, 0.33, 0.09, { ring:true }) } },
  // 黑鯛 Acanthopagrus schlegelii：灰黑色帶銀光的鯛，背鰭硬棘很強
  blackbream: { c:{ Top:'#2e3236', Mid:'#7a8086', Bottom:'#d8dade', Fins:'#2a2e32', Eye:'#15181c', EyeW:'#d8dce0' }, p:{
    bl:0.8, depth:0.42, wr:0.42, tm:0.35, nose:0.7, ped:0.18, cs:0.2, up:[[0,0.2],[0.12,0.62],[0.3,1],[0.6,0.72],[1,0.18]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }],
    dorsal:[{ s:0.28, e:0.56, h:0.38, shape:'spiny', back:0.7 }, { s:0.56, e:0.76, h:0.28, shape:'flat' }], anal:{ s:0.64, e:0.76, h:0.26 }, pect:{ t:0.27, y:-0.15, size:0.45 }, pelv:{ t:0.3, size:0.32 },
    caudal:{ type:'forked', notch:0.35, hk:1.3 }, eye:EYE(0.1, 0.35, 0.085, { ring:true }) } },
  // 銀紋笛鯛（紅樹林笛鯛）Lutjanus argentimaculatus：紅銅色到褐色，年輕時臉上有藍線
  mangsnapper: { c:{ Top:'#7a3a28', Mid:'#c06a48', Bottom:'#f0c8b0', Stripes:'#4ab0e0', Fins:'#a04a30', Eye:'#15181c', EyeW:'#e8c090' }, p:{
    bl:0.82, depth:0.33, wr:0.5, tm:0.36, nose:0.85, ped:0.2, cs:0.25,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, { k:'line', t0:0.02, t1:0.14, y:[[0, -0.15], [1, -0.25]], w:0.025, part:'Stripes' }],
    dorsal:[{ s:0.28, e:0.52, h:0.42, shape:'spiny', back:0.6 }, { s:0.52, e:0.72, h:0.34, shape:'flat' }], anal:{ s:0.64, e:0.76, h:0.32 }, pect:{ t:0.27, y:-0.2, size:0.42 }, pelv:{ t:0.32, size:0.34 },
    caudal:{ type:'emarginate', hk:1.25 }, eye:EYE(0.1, 0.35, 0.08, { ring:true }) } },
  // 尖吻鱸（金目鱸）Lates calcarifer：銀色、頭部輪廓凹、嘴很大，眼睛在光下發出金紅色
  barramundi: { c:{ Top:'#5a6a6a', Mid:'#c4cccc', Bottom:'#f2f4f2', Fins:'#8a9494', Eye:'#d8a040', EyeW:'#f0c060' }, p:{
    bl:0.82, depth:0.3, wr:0.55, tm:0.38, nose:0.9, ped:0.24, cs:0.25, up:[[0,0.15],[0.08,0.35],[0.2,0.85],[0.38,1],[0.65,0.75],[1,0.3]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.3, part:'Mid' }],
    dorsal:[{ s:0.3, e:0.5, h:0.45, shape:'spiny', back:0.5 }, { s:0.52, e:0.7, h:0.36 }], anal:{ s:0.64, e:0.75, h:0.32 }, pect:{ t:0.26, y:-0.25, size:0.4 }, pelv:{ t:0.32, size:0.34 },
    caudal:{ type:'rounded', hk:1.1 }, eye:EYE(0.09, 0.4, 0.075, { ring:true }) } },
  // 彈塗魚 Periophthalmus modestus：長條、眼睛長在頭頂突出來，胸鰭像手可以在泥上爬、跳，最大約 10 公分
  mudskipper: { c:{ Top:'#6a5a44', Mid:'#9a8a6a', Bottom:'#d8ccb0', Spots:'#2a221a', Fins:'#7a6a50', Fins2:'#3a7ac8', Eye:'#15181c', EyeW:'#c8b890' }, p:{
    bl:0.85, depth:0.2, wr:0.95, tm:0.4, nose:0.4, ped:0.28, n:1.8, cs:0.0, up:[[0,0.55],[0.1,0.9],[0.25,1],[0.6,0.7],[1,0.35]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.2, part:'Mid' }], dots:{ n:26, t0:0.15, t1:0.9, y0:0.0, y1:0.95, r:0.014, part:'Spots' },
    dorsal:[{ s:0.35, e:0.48, h:0.55, shape:'round', part:'Fins2' }, { s:0.55, e:0.82, h:0.4, shape:'flat', part:'Fins2' }], anal:{ s:0.58, e:0.82, h:0.25 },
    pect:{ t:0.24, y:-0.55, size:0.75, shape:'round', out:0.8 }, pelv:{ t:0.28, size:0.35 }, caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.06, 0.9, 0.13, { pop:0.9 }) } },
  // 大彈塗魚 Boleophthalmus pectinirostris：比較大、身上有很多藍綠色的亮點，背鰭很高
  bigskipper: { c:{ Top:'#4a5a48', Mid:'#7a8a6a', Bottom:'#d0d4bc', Spots:'#4ac8e8', Fins:'#5a6a50', Fins2:'#3ab0d8', Eye:'#15181c', EyeW:'#c8c8a0' }, p:{
    bl:0.85, depth:0.2, wr:0.95, tm:0.4, nose:0.4, ped:0.26, n:1.8, cs:0.0, up:[[0,0.55],[0.1,0.9],[0.25,1],[0.6,0.7],[1,0.35]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.2, part:'Mid' }], dots:{ n:44, t0:0.1, t1:0.95, y0:-0.3, y1:0.95, r:0.016, part:'Spots' },
    dorsal:[{ s:0.32, e:0.48, h:0.85, shape:'round', part:'Fins2' }, { s:0.55, e:0.85, h:0.45, shape:'flat', part:'Fins2' }], anal:{ s:0.58, e:0.84, h:0.28 },
    pect:{ t:0.24, y:-0.55, size:0.75, shape:'round', out:0.8 }, pelv:{ t:0.28, size:0.35 }, caudal:{ type:'rounded', hk:1.05 }, eye:EYE(0.06, 0.9, 0.12, { pop:0.9 }) } },
  // 弧邊招潮蟹 Tubuca arcuata：雄蟹一隻大螯特別大（橘紅色），用來揮動招潮
  fiddler: { gen:'crab', c:{ Top:'#3a3a40', Bottom:'#d8ccb8', Spots:'#8a6a4a', Fins:'#6a5a4a', Claw:'#e8602a', Eye:'#141418' }, move:'vert', p:{
    cd:0.24, cr:0.3, ch:0.11, pairs:4, span:0.55, legR:0.022, eyeH:0.16, spots:6, claw:{ size:0.45, right:3.4 },
    shell:v => [v[0] * (v[0] > 0 ? 1.1 : 0.85), v[1], v[2] * (1 - Math.max(0, -v[0]) * 0.2)] } },
  // 鋸緣青蟳（紅蟳）Scylla serrata：墨綠到褐色的大蟳，兩隻螯又大又有力
  mudcrab: { gen:'crab', c:{ Top:'#3e4a2e', Bottom:'#e0d4b0', Spots:'#2a321e', Fins:'#4e5a36', Claw:'#5a6a3a', Eye:'#141418' }, move:'vert', p:{
    cd:0.27, cr:0.36, ch:0.14, pairs:4, span:0.66, legR:0.03, eyeH:0.08, spots:4, claw:{ size:0.95, right:1.25 },
    shell:v => [v[0] * (v[0] > 0 ? 1.05 : 0.9), v[1], v[2] * (1 - Math.max(0, -v[0]) * 0.1)] } },
  // 鬥牛鯊 Carcharhinus leucas：灰色、壯碩、吻很短很鈍，會游進河口和紅樹林
  bullshark: { c:{ Top:'#7a8288', Mid:'#9aa0a4', Bottom:'#f2f2ee', Accent:'#4a5056', Gill:'#5a6066', Fins:'#747c82', Eye:'#15181c' }, p:{
    bl:0.8, depth:0.22, wr:0.85, tm:0.36, nose:0.6, ped:0.12, n:2.0, cs:-0.1, yc:[[0,0.15],[0.12,0],[1,0.15]], pat:[{ k:'band', t0:0.3, t1:0.8, y0:-0.35, y1:-0.1, part:'Mid' }, GILLS(0.17)],
    dorsal:[{ s:0.3, e:0.45, h:0.7, shape:'falcate', sweep:0.45 }, { s:0.74, e:0.78, h:0.22 }], anal:{ s:0.76, e:0.8, h:0.2 },
    pect:{ t:0.25, y:-0.7, size:1.2, shape:'tri', ang:-0.6, out:0.6, w:0.45 }, pelv:{ t:0.6, size:0.4 }, caudal:{ type:'hetero', hk:1.6 }, eye:EYE(0.08, 0.25, 0.035) } },
  // 鋸鰩 Pristis pristis：像鯊魚的扁身體，前面有一支長長的、兩邊都是齒的吻；會進紅樹林和河口，極度瀕危
  sawfish: { c:{ Top:'#9a8a5a', Mid:'#b0a070', Bottom:'#f0eee2', Accent:'#6a5e3e', Gill:'#7a6e4a', Fins:'#8a7a4e', Eye:'#15181c', Teeth:'#f4f0e0' }, p:{
    bl:0.75, depth:0.13, wr:1.25, tm:0.36, nose:0.5, ped:0.12, n:2.0, cs:-0.05, yc:[[0,0.05],[0.12,0],[1,0.12]], pat:[{ k:'band', t0:0.2, t1:0.8, y0:-0.35, y1:-0.1, part:'Mid' }],
    dorsal:[{ s:0.42, e:0.52, h:0.55, shape:'falcate', sweep:0.35 }, { s:0.68, e:0.75, h:0.45, shape:'falcate', sweep:0.35 }], anal:{ s:0.8, e:0.8, h:0 },
    pect:{ t:0.2, y:-0.75, size:1.1, shape:'tri', ang:-0.25, out:0.9, w:0.55 }, pelv:{ t:0.45, size:0.5 }, caudal:{ type:'hetero', hk:1.3 }, eye:EYE(0.1, 0.4, 0.03),
    extra:[{ k:'ellip', c:{ x:0.62, y:0.0, z:0 }, r:[0.27, 0.02, 0.055], part:'Top', seg:10, rings:5 },
      ...Array.from({ length: 24 }, (_, i) => ({ k:'ellip', c:{ x:0.42 + (i >> 1) * 0.036, y:0, z:(i % 2 ? 1 : -1) * 0.06 }, r:[0.006, 0.008, 0.022], part:'Teeth', seg:5, rings:3 }))] } },
  /* ---------------- 城市水圳（參考新竹湖口的水圳；2026-11-04）---------------- */
  // 食蚊魚（大肚魚）Gambusia affinis：3～6 公分，灰綠半透明、嘴往上翹吃水面的孑孓，背鰭很後面、尾鰭圓；母魚肚子大、肚子後面有一塊黑色的「懷孕斑」
  mosquitofish: { c:{ Top:'#7a7c5a', Mid:'#b8b898', Bottom:'#eeeadc', Spots:'#2a2a22', Accent:'#3a3a2a', Fins:'#c8c4a8', Eye:'#15181c', EyeW:'#d8e0d0' }, p:{
    bl:0.8, depth:0.26, wr:0.58, tm:0.36, nose:0.6, ped:0.34, tailK:0.9, cs:0.25, yc:[[0,0.12],[0.2,0],[1,0]], up:[[0,0.35],[0.15,0.7],[0.4,0.95],[0.6,1],[1,0.4]], lo:[[0,0.3],[0.15,0.8],[0.35,1.15],[0.5,1.1],[0.7,0.7],[1,0.35]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }, { k:'ell', t:0.45, y:-0.45, rt:0.05, ry:0.25, part:'Accent' }], dots:{ n:10, t0:0.3, t1:0.95, y0:0.1, y1:0.7, r:0.012, part:'Spots' },
    dorsal:{ s:0.6, e:0.7, h:0.38, shape:'round' }, anal:{ s:0.52, e:0.62, h:0.3, shape:'round' }, pect:{ t:0.22, y:0.0, size:0.35 }, pelv:{ t:0.4, size:0.22 },
    caudal:{ type:'rounded', hk:1.15 }, eye:EYE(0.1, 0.4, 0.13, { ring:true }) } },
  // 琵琶鼠魚（豹紋翼甲鯰）Pterygoplichthys pardalis：全身骨板、肚子扁平，嘴是吸盤在頭的下面，背鰭像一面大帆，深褐色帶豹紋；在台灣的水圳和河流裡大量繁殖的外來種
  pleco: { c:{ Top:'#3a3024', Mid:'#5a4a36', Bottom:'#8a7a60', Spots:'#d8c8a0', Fins:'#4a3e2e', Accent:'#2a221a', Eye:'#15181c' }, move:'eel', p:{
    bl:0.88, depth:0.15, wr:1.1, tm:0.24, nose:0.5, ped:0.18, n:2.0, cs:-0.1, yc:[[0,-0.15],[0.25,0],[1,0.05]], up:[[0,0.45],[0.1,0.85],[0.25,1],[0.5,0.8],[0.8,0.45],[1,0.22]], lo:[[0,0.25],[0.1,0.45],[0.3,0.5],[0.6,0.4],[1,0.2]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.3, y1:0.2, part:'Mid' }, { k:'wave', f:40, fy:14, t0:0.05, t1:0.98, y0:-0.3, y1:0.95, th:0.25, part:'Spots' }],
    dorsal:{ s:0.24, e:0.52, h:0.75, shape:'round', back:0.2 }, anal:{ s:0.7, e:0.76, h:0.15 }, pect:{ t:0.18, y:-0.85, size:0.7, shape:'tri', ang:-0.3, out:0.9, w:0.45 }, pelv:{ t:0.45, size:0.45 },
    caudal:{ type:'emarginate', hk:1.15, len:0.75 }, eye:EYE(0.08, 0.55, 0.06) } },
  // 小盾鱧（泰國鱧、魚虎）Channa micropeltes：可以長到 1 公尺、20 公斤；大魚背上藍黑色、肚子白，眼睛後面有一條黑帶。很兇，在台灣是會吃光其他魚的外來種
  giantsnake: { c:{ Top:'#1e2630', Mid:'#3e4a58', Bottom:'#eef0f0', Spots:'#9aa4b0', Accent:'#0e1216', Fins:'#26303a', Eye:'#c8402a', EyeW:'#e0a040' }, p:{
    bl:0.86, depth:0.17, wr:0.78, tm:0.3, nose:0.65, ped:0.45, tailK:0.7, cs:0.25, n:2.2,
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.2, part:'Mid' }, { k:'spots', gt:0.09, gy:0.5, r:0.022, ar:5, t0:0.25, t1:0.95, y0:0.1, y1:0.6, part:'Spots', fill:0.55 }],
    dorsal:{ s:0.25, e:0.98, h:0.28, shape:'flat', sweep:0.2 }, anal:{ s:0.5, e:0.98, h:0.26, shape:'flat', sweep:0.2 }, pect:{ t:0.2, y:-0.4, size:0.5, shape:'round' }, pelv:{ t:0.3, size:0.22, shape:'round' },
    caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.07, 0.45, 0.075) } },
  // 革胡子鯰（埃及塘蝨）Clarias gariepinus：身體長得像鰻、頭扁平又硬，四對長鬍鬚，背鰭和臀鰭一路長到尾巴；灰黑色帶斑駁。台灣水溝、水圳裡最大的鯰魚，可以超過 1 公尺
  clarias: { c:{ Top:'#2e3230', Mid:'#5a605a', Bottom:'#d8d8cc', Spots:'#3a3e38', Fins:'#3a3e3a', Eye:'#15181c' }, move:'eel', p:{
    bl:0.92, depth:0.14, wr:0.95, tm:0.2, nose:0.4, ped:0.08, n:2.4, cs:-0.15, up:[[0,0.4],[0.06,0.75],[0.18,1],[0.5,0.9],[0.85,0.55],[1,0.18]], lo:[[0,0.3],[0.08,0.7],[0.2,0.95],[0.5,0.9],[0.85,0.55],[1,0.18]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.25, y1:0.25, part:'Mid' }, { k:'spots', gt:0.07, gy:0.45, r:0.03, ar:3, t0:0.15, t1:0.95, y0:-0.2, y1:0.8, part:'Spots', fill:0.6 }],
    dorsal:{ s:0.28, e:0.97, h:0.16, shape:'flat' }, anal:{ s:0.48, e:0.97, h:0.14, shape:'flat' }, pect:{ t:0.16, y:-0.55, size:0.4, shape:'round' }, pelv:{ t:0.42, size:0.22 },
    caudal:{ type:'rounded', hk:0.95, len:0.6 }, eye:EYE(0.05, 0.4, 0.04),
    extra:[{ k:'limb', sym:true, pts:[{ t:0.005, yn:0.25, z:0.03 }, { x:0.88, y:0.07, z:0.14 }, { x:0.74, y:0.03, z:0.3 }, { x:0.56, y:-0.04, z:0.36 }], r0:0.008, r1:0.003, part:'Fins' },
           { k:'limb', sym:true, pts:[{ t:0.01, yn:0.45, z:0.02 }, { x:0.9, y:0.09, z:0.07 }, { x:0.82, y:0.12, z:0.12 }], r0:0.005, r1:0.002, part:'Fins' },
           { k:'limb', sym:true, pts:[{ t:0.02, yn:-0.6, z:0.03 }, { x:0.8, y:-0.12, z:0.07 }, { x:0.7, y:-0.17, z:0.12 }], r0:0.006, r1:0.002, part:'Fins' },
           { k:'limb', sym:true, pts:[{ t:0.03, yn:-0.75, z:0.015 }, { x:0.78, y:-0.13, z:0.03 }, { x:0.72, y:-0.18, z:0.05 }], r0:0.005, r1:0.002, part:'Fins' }] } },
};

/* ---------------- 變種：同一種魚、長得不一樣（從原本那種魚的外形改顏色和一點點形狀） ---------------- */
const VAR = (base, c, p, extra) => Object.assign({}, SPECS[base], extra || {}, { c: Object.assign({}, SPECS[base].c, c), p: Object.assign({}, SPECS[base].p, p) });
Object.assign(SPECS, {
  koi_sanke: VAR('koi', { Spots:'#151515' }, { dots:{ n:10, t0:0.15, t1:0.85, y0:0.3, y1:0.95, r:0.025, part:'Spots' } }),
  koi_showa: VAR('koi', { Top:'#1a1a1a', Bottom:'#f2efe8', Accent:'#d8231c', Spots:'#f4f0ea', Fins:'#2a2a2a' }, { cs:0.1, dots:{ n:8, t0:0.2, t1:0.8, y0:0.0, y1:0.6, r:0.05, part:'Spots' } }),
  koi_ogon: VAR('koi', { Top:'#f2c040', Bottom:'#f8d870', Accent:'#f6cc50', Fins:'#f0c048' }, {}, { glow:true }),
  goldfish_ranchu: VAR('goldfish', { Top:'#ff5a1a', Bottom:'#ffd0a0', Accent:'#ff8a50', Fins:'#ff7a3a' }, { dorsal:[], up:[[0,0.4],[0.06,0.95],[0.15,1],[0.42,0.95],[0.7,0.75],[1,0.3]],
    extra:[...SPECS.goldfish.p.extra, ...[0, 1, 2, 3, 4, 5].map(i => ({ k:'ellip', sym:i % 2 === 1, c:{ t:0.03 + (i % 3) * 0.035, yn:0.85 - Math.floor(i / 3) * 0.3, z:0.02 + (i % 2) * 0.04 }, r:[0.035, 0.035, 0.035], part:'Accent', seg:8, rings:5 }))] }),
  goldfish_telescope: VAR('goldfish', { Top:'#1e1e22', Bottom:'#3a3a40', Accent:'#2a2a30', Fins:'#26262c', Eye:'#0a0a0a' }, { eye:{ t:0.12, y:0.25, r:0.16, pop:0.9 } }),
  goldfish_pearl: VAR('goldfish', { Top:'#f8a060', Bottom:'#fff0e0', Accent:'#ffffff', Spots:'#fff4e8', Fins:'#f8b880' }, { depth:0.85, dots:{ n:50, t0:0.15, t1:0.85, y0:-0.8, y1:0.9, r:0.02, part:'Spots' } }),
  clown_black: VAR('clown', { Top:'#1a1a1a', Bottom:'#2a2420', Fins:'#1f1a18', Accent:'#0a0a0a' }, {}),
  catfish_albino: VAR('catfish', { Top:'#f0d8d0', Mid:'#f6e4de', Bottom:'#fff4f0', Spots:'#f8e8e4', Fins:'#ecccc4', Eye:'#d02a3a' }, {}),
  trout_golden: VAR('trout', { Top:'#f0b830', Mid:'#f4cc50', Bottom:'#f8e8b0', Stripes:'#e8a828', Spots:'#e86a3a', Accent:'#f8d870', Fins:'#f0c040', Fins2:'#f0a838' },
    { pat:[{ k:'band', t0:0, t1:1, y0:-0.5, y1:0.25, part:'Mid' }, { k:'line', t0:0.08, t1:1, y:[[0,0.05],[1,0.05]], w:0.1, part:'Spots' }], dots:[] }),
  carp_mirror: VAR('carp', { Mid:'#b89048', Stripes:'#d8b060', Spots:'#e8c878' }, { pat:[{ k:'band', t0:0, t1:1, y0:-0.55, y1:0.35, part:'Mid' }],
    dots:[{ n:9, t0:0.2, t1:0.85, y0:0.8, y1:0.92, r:0.045, part:'Spots' }, { n:8, t0:0.2, t1:0.9, y0:-0.02, y1:0.05, r:0.04, part:'Spots', seed:3 }] }),
  crayfish_blue: VAR('crayfish', { Top:'#2a5ec8', Bottom:'#6a9ae8', Stripes:'#1a3a8a', Fins:'#3a6ad0', Claw:'#2f6fe0' }, {}),
  tilapia_red: VAR('tilapia', { Top:'#e8503a', Mid:'#ff7a5a', Bottom:'#ffc8b0', Stripes:'#e86a50', Fins:'#f06a50' }, {}),
  // 赤紅霸王鯊：礁岩鯊的變種（全伺服器只有一公一母，會繁殖）；深紅身體、背上黑色虎紋、更高更尖的背鰭、黃眼睛
  shark_red: VAR('shark', { Top:'#8e1016', Mid:'#c8161c', Bottom:'#e9d9c8', Accent:'#2a0406', Gill:'#3a0408', Fins:'#8a0f14', Stripes:'#1e0204', Eye:'#f2c230' }, {
    depth:0.2, pat:[{ k:'band', t0:0.2, t1:0.85, y0:-0.4, y1:-0.05, part:'Mid' }, { k:'bars', bars:BARS(6, 0.25, 0.64, 0.032, 0.15, 1.2), part:'Stripes' }, GILLS(0.17)],
    dorsal:[{ s:0.31, e:0.47, h:0.95, shape:'falcate', sweep:0.7 }, { s:0.75, e:0.79, h:0.3 }, { s:0.39, e:0.425, h:0.98, shape:'falcate', sweep:0.75, part:'Accent', inset:0 }],
    pect:{ t:0.26, y:-0.7, size:1.25, shape:'tri', ang:-0.6, out:0.65, w:0.42 }, caudal:{ type:'hetero', hk:1.9 } }),
  scat_red: VAR('scat', { Top:'#a8402a', Mid:'#e0703a', Bottom:'#f0c8a0', Fins:'#c8502e' }, {}),
  mudskipper_albino: VAR('mudskipper', { Top:'#f0d4c8', Mid:'#f6e2da', Bottom:'#fff4ee', Spots:'#e8c4b8', Fins:'#ecc8bc', Fins2:'#f0b0b0', Eye:'#d02a3a' }, {}),
  fiddler_blue: VAR('fiddler', { Top:'#2a6ad8', Spots:'#8ac0f0', Fins:'#3a5a9a', Claw:'#f4f0e8' }, {}),
  // 城市水圳的變種（都是真的有的色型）
  mosquitofish_gold: VAR('mosquitofish', { Top:'#e8a040', Mid:'#f4c060', Bottom:'#fbe8c0', Spots:'#c87020', Accent:'#b86020', Fins:'#f4c880' }, {}),
  pleco_albino: VAR('pleco', { Top:'#f0d890', Mid:'#f6e4a8', Bottom:'#fff4d8', Spots:'#fff8e8', Fins:'#f0dca0', Accent:'#e8c880', Eye:'#d02a3a' }, {}),
  giantsnake_red: VAR('giantsnake', { Top:'#c8401e', Mid:'#f07a30', Bottom:'#f8d8b0', Spots:'#f8a050', Accent:'#1a1210', Fins:'#d8602a' }, {}, { glow:true }),
  clarias_albino: VAR('clarias', { Top:'#f0d8cc', Mid:'#f6e6dc', Bottom:'#fff6f0', Spots:'#ecd0c4', Fins:'#ecccc0', Eye:'#d02a3a' }, {}),
  arowana_red: VAR('arowana', { Top:'#8a2420', Mid:'#d8302a', Bottom:'#f06a50', Stripes:'#b8241e', Fins:'#a8201a' }, {}, { glow:true }),
});

// ---- 嘴巴（2026-11-04）：照每種魚真正的嘴型。term＝嘴在吻端、sub＝嘴在頭的下面（鯊魚、鱘龍）、sup＝嘴往上翹（龍魚、鮟鱇）
// t＝嘴角往後延伸到哪裡（越大嘴越大），y＝嘴在吻端的高度（負的＝偏下），open＝張開的大小，lip＝嘴唇（用哪個顏色）
const MOUTH = {
  mosquitofish:{ type:'sup', t:0.04, y:0.3 }, pleco:{ type:'sub', t:0.06, y:-0.85, t0:0.04 }, giantsnake:{ t:0.12, y:-0.15 }, clarias:{ t:0.06, y:-0.1, open:0.3 },
  shark:{ type:'sub', t:0.13, y:-0.5, t0:0.05 }, hammer:{ type:'sub', t:0.1, y:-0.6, t0:0.05 }, bullshark:{ type:'sub', t:0.12, y:-0.5, t0:0.04 }, sawfish:{ type:'sub', t:0.12, y:-0.7, t0:0.08 },
  sturgeon:{ type:'sub', t:0.1, y:-0.8, t0:0.07 }, whaleshark:{ t:0.06, y:-0.05, open:0.5 }, manta:false, stingray:false, flounder:{ t:0.05, y:0.1 },
  arowana:{ type:'sup', t:0.1, y:0.2 }, angler:{ type:'sup', t:0.18, y:0.15, open:1.0 }, barramundi:{ type:'sup', t:0.09, y:-0.05 }, snakehead:{ t:0.1, y:-0.15 },
  bass:{ t:0.1, y:-0.15 }, grouper:{ t:0.11, y:-0.15, open:0.3 }, scorpion:{ t:0.09, y:-0.1 }, lionfish:{ t:0.08, y:-0.1 }, mangsnapper:{ t:0.08, y:-0.15 }, perch:{ t:0.08, y:-0.15 },
  barracuda:{ t:0.12, y:-0.05 }, catfish:{ t:0.07, y:-0.2, th:1.3 }, eel:{ t:0.06, y:-0.05 }, marlin:{ t:0.05, y:-0.3 }, tuna:{ t:0.06, y:-0.15 }, trevally:{ t:0.07, y:-0.15 },
  scat:{ t:0.03, y:-0.1 }, butterfly:{ t:0.025, y:-0.05 }, bluetang:{ t:0.025, y:-0.1 }, clown:{ t:0.03, y:-0.1 }, goldfish:{ t:0.03, y:-0.1, lip:'Mid' }, koi:{ t:0.04, y:-0.2 }, carp:{ t:0.04, y:-0.25 },
  puffer:{ t:0.025, y:-0.05, th:1.4 }, parrot:{ t:0.035, y:-0.1, th:1.6, part:'EyeW' }, sunfish:{ t:0.03, y:-0.05, open:0.4 }, milkfish:{ t:0.035, y:-0.15 }, mullet:{ t:0.035, y:-0.2 },
  mudskipper:{ t:0.06, y:-0.35, th:1.2 }, bigskipper:{ t:0.06, y:-0.35, th:1.2 }, anchovy:{ type:'sub', t:0.09, y:-0.4, t0:0.02 }, loach:{ type:'sub', t:0.05, y:-0.6, t0:0.02 },
  hillstream:{ type:'sub', t:0.06, y:-0.8, t0:0.05 }, salmon:{ t:0.08, y:-0.15 }, trout:{ t:0.08, y:-0.15 }, ayu:{ t:0.06, y:-0.2 }, tilapia:{ t:0.05, y:-0.1, lip:'Mid' }, bonito:{ t:0.06, y:-0.15 },
  mackerel:{ t:0.06, y:-0.15 }, oarfish:{ t:0.04, y:0.0 },
  dolphin:{ t:0.11, y:-0.3, th:1.1 }, orca:{ t:0.13, y:-0.3, th:1.2 }, beluga:{ t:0.08, y:-0.25 }, sperm:{ type:'sub', t:0.24, y:-0.65, t0:0.04, th:1.3 }, whale:{ t:0.2, y:-0.2, th:1.4 },
};
for (const id of Object.keys(SPECS)){ const S = SPECS[id]; if (S.gen) continue; const m = id in MOUTH ? MOUTH[id] : MOUTH[id.split('_')[0]];
  S.p = Object.assign({}, S.p, { mouth: m === false ? false : Object.assign({}, m || {}) }); S.c = Object.assign({ Mouth:'#2a1a18' }, S.c); }
