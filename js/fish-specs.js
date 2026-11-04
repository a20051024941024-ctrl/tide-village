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
  goby: { c:{ Top:'#7a6a40', Mid:'#b49a5a', Bottom:'#e8dfc6', Stripes:'#4a3c22', Glow:'#a46cff', Fins:'#8a8070', Eye:'#15181c' }, p:{
    bl:0.82, depth:0.18, wr:0.85, tm:0.2, nose:0.5, ped:0.4, tailK:0.8, cs:0.1, n:2.2, up:[[0,0.45],[0.1,0.85],[0.22,1],[0.6,0.8],[1,0.45]],
    pat:[{ k:'band', t0:0, t1:1, y0:-0.45, y1:0.1, part:'Mid' }, { k:'bars', bars:BARS(6, 0.28, 0.92, 0.05, -0.3, 0.6), part:'Stripes' }],
    dots:{ n:16, t0:0.15, t1:0.9, y0:-0.2, y1:0.7, r:0.018, part:'Glow' },
    dorsal:[{ s:0.3, e:0.42, h:0.55, shape:'round' }, { s:0.5, e:0.78, h:0.42, shape:'flat' }], anal:{ s:0.58, e:0.8, h:0.35, shape:'flat' },
    pect:{ t:0.22, y:-0.3, size:0.55, shape:'round', w:0.8 }, pelv:{ t:0.26, size:0.3, shape:'round' }, caudal:{ type:'rounded', hk:1.0 }, eye:EYE(0.08, 0.7, 0.11, { pop:0.4 }) } },
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
};
