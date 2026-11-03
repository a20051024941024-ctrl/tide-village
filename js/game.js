// 潮汐釣魚村：遊戲主程式
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FISH_MESH } from './fish-models.js';
window.__gameStarted = true;
(function(){
'use strict';
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && innerWidth < 900);
if (isTouch) document.body.classList.add('touch');
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;


/* ================= DATA (from world.ts) ================= */
const PALETTE = { sky:'#8bd8e8', grass:'#77b86a', grassLight:'#a6d37d', sand:'#f2d69a', wood:'#8c5d3b', ink:'#18334a', river:'#4fc2cf', sea:'#2f89c7', creek:'#6bd6b0', coral:'#f17b6d', gold:'#ffd36a' };

const FISH = [
  // river
  { id:'perch',  spot:'river', name:'翡翠河鱸', rarity:'常見', color:'#5de0bd', min:0.4, max:1.6, power:0.38, desc:'月灣河岸最常見的住民，綠色鱗片在水草間一閃一閃。' },
  { id:'crucian',spot:'lake', name:'銀鱗鯽',   rarity:'常見', color:'#c9d6e3', min:0.2, max:0.9, power:0.3,  desc:'成群在木橋下打轉，咬餌很快，適合新手練手感。' },
  { id:'catfish',spot:'river', time:'night', name:'竹影鯰',   rarity:'稀有', color:'#9c8657', min:1.5, max:5.5, power:0.66, desc:'白天躲在竹影下，鬍鬚很長，力氣比看起來大很多。' },
  { id:'koi',    spot:'lake', time:'twilight', name:'朱紅錦鯉', rarity:'傳說', color:'#ff6b4a', min:2.5, max:7.0, power:0.9,  desc:'傳說它每年只在滿月那週游到河灣。釣到的人會有一整年好運。' },
  // sea
  { id:'mackerel',spot:'sea', time:'day',  name:'沙灘小鯖', rarity:'常見', color:'#6fa8dc', min:0.3, max:1.2, power:0.4,  desc:'跟著浪花游來游去，背上有藍綠色的斑紋。' },
  { id:'scorpion',spot:'sea',  name:'條紋石狗公',rarity:'常見',color:'#e08f5b', min:0.3, max:1.4, power:0.42, desc:'喜歡貼著礁石，背鰭有刺，拿的時候要小心。' },
  { id:'moonbream',spot:'sea', time:'night', name:'月光鯛',   rarity:'稀有', color:'#ffd86d', min:1.0, max:3.8, power:0.64, desc:'鱗片會反射月光，晴潮燈塔一亮，牠們就會靠近岸邊。' },
  { id:'marlin', spot:'harbor',   name:'深藍旗魚', rarity:'傳說', color:'#2f5fd0', min:8.0, max:24.0,power:0.95, desc:'遠洋的王者，偶爾追著小魚游進海灣。拉線時要很有耐心。' },
  { id:'manta',   spot:'harbor',   name:'星紋魟魚', rarity:'稀有', color:'#2f4d6b', min:12, max:45,  power:0.72, desc:'像披風一樣在海面下滑行，背上的星紋只有晴天才看得到。' },
  { id:'dolphin', spot:'harbor',   name:'晴潮海豚', rarity:'稀有', color:'#7f8fa3', min:40, max:150, power:0.7,  w:0.7, desc:'喜歡追著船跑的聰明傢伙。合照之後牠會對你眨眨眼，再游回海裡。' },
  { id:'shark',   spot:'harbor',   name:'礁岩鯊',   rarity:'傳說', color:'#3f5f78', min:60, max:250, power:0.97, w:0.6, desc:'在燈塔下方的深水巡游。力氣非常大，拉線時千萬別硬拉。' },
  { id:'orca',    spot:'harbor',   name:'浪花虎鯨', rarity:'傳說', color:'#2b3138', min:1200, max:5500, power:0.98, w:0.3, desc:'黑白分明的海上獵手，常常成群在港口外繞圈。拉線時牠會突然轉向，要跟著放線。' },
  { id:'beluga',  spot:'harbor',   name:'月白白鯨', rarity:'稀有', color:'#e4ebf0', min:400, max:1500, power:0.76, w:0.45, desc:'圓圓的額頭軟軟的，看起來一直在對你笑。聽說牠會學海鷗叫。' },
  { id:'sunfish', spot:'harbor', time:'day',   name:'慵懶翻車魚', rarity:'稀有', color:'#8fa3b8', min:60, max:900, power:0.55, w:0.55, desc:'喜歡側躺在海面曬太陽，看起來很懶，其實是在等海鳥幫牠清潔身體。' },
  { id:'sperm',   spot:'harbor', time:'night',   name:'深潛抹香鯨', rarity:'傳說', color:'#6d7f96', min:3000, max:15000, power:1.0, w:0.18, desc:'方方的大頭可以潛到最深的海溝。能把牠拉上岸的人，手臂一定很有力。' },
  { id:'whaleshark', spot:'harbor', time:'day', name:'星斑鯨鯊', rarity:'傳說', color:'#7f8c99', min:2000, max:12000, power:0.96, w:0.22, desc:'世界上最大的魚，背上滿是白色星點。脾氣非常溫和，只吃小小的浮游生物。' },
  { id:'whale',   spot:'harbor',   name:'座頭鯨',   rarity:'傳說', color:'#34395e', min:900, max:3000, power:1.0, w:0.25, desc:'偶爾會游進海灣唱歌。能釣上牠的人，整個村子都會記住你的名字。' },
  // creek
  { id:'kuhua',  spot:'pool', name:'清溪苦花', rarity:'常見', color:'#9fd8c4', min:0.2, max:0.8, power:0.34, desc:'只住在最乾淨的溪水裡，身上有一條淡淡的光帶。' },
  { id:'ayu',    spot:'pool', time:'twilight', name:'霧溪香魚', rarity:'常見', color:'#b8e0a0', min:0.1, max:0.6, power:0.32, desc:'聞起來有西瓜般的清香，是溪間居民的驕傲。' },
  { id:'goby',   spot:'creek', time:'night', name:'紫晶蝦虎', rarity:'稀有', color:'#9b7bff', min:0.1, max:0.5, power:0.58, desc:'在螢光石旁邊發出紫色微光，個頭小但很會掙扎。' },
  { id:'trout',  spot:'creek', time:'night', name:'星點溪鱒', rarity:'傳說', color:'#c084ff', min:1.2, max:4.5, power:0.88, desc:'身上的星點跟夜空一模一樣。據說是螢光溪的守護者。' },
];
const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

const V3 = (x, z) => new THREE.Vector3(x, 0, z), V2 = (x, z) => new THREE.Vector2(x, z).normalize();
// 六個釣點：fish = 會釣到的魚，legendBoost = 傳說魚機率加成
const SPOTS = [
  { id:'river',  label:'月灣河岸', short:'河岸',   subtitle:'木橋下的河灣，河魚最多',         pos:V3(-20.4, -17.6), color:PALETTE.river, dir:V2(0.25, -1),  fish:['perch','crucian','catfish','koi'] },
  { id:'lake',   label:'鏡湖',     short:'湖邊',   subtitle:'平靜如鏡的湖，錦鯉偶爾會浮上來', pos:V3(-21.8, -2),    color:'#62c9e0',     dir:V2(-1, 0.05),  fish:['crucian','perch','koi'], legendBoost:1.4 },
  { id:'pool',   label:'瀑布潭',   short:'瀑布潭', subtitle:'瀑布底下的深潭，水很冰',         pos:V3(-26.2, 5.4),   color:'#9fe3ff',     dir:V2(0, 1),      fish:['ayu','kuhua','goby','trout'] },
  { id:'sea',    label:'晴潮海邊', short:'海邊',   subtitle:'北海灘的木碼頭，近海魚很多',     pos:V3(0, -50.8),     color:PALETTE.sea,   dir:V2(0, -1),     fish:['mackerel','scorpion','moonbream'] },
  { id:'harbor', label:'港口外海', short:'外海',   subtitle:'港口盡頭，大型魚出沒的深海',     pos:V3(33.2, -27),    color:'#1c5d8c',     dir:V2(1, -0.25),  fish:['mackerel','moonbream','manta','sunfish','dolphin','beluga','marlin','shark','orca','whaleshark','whale','sperm'] },
  { id:'creek',  label:'螢光溪間', short:'溪間',   subtitle:'森林深處的秘密水潭',             pos:V3(20.8, 27.4),   color:PALETTE.creek, dir:V2(1, 0.05),   fish:['kuhua','goby','trout'], legendBoost:1.8 },
];
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));
const AQUA = [11, -14];
const LIGHTHOUSE = (() => { const r = islandR(-1.2) - 3.2; return [Math.cos(-1.2) * r, Math.sin(-1.2) * r]; })();
const LANDMARKS = [
  { id:'plaza',      label:'潮汐廣場', pos:V3(4, 4),            color:PALETTE.gold, ly:1.8 },
  { id:'aquarium',   label:'水族館',   pos:V3(AQUA[0], AQUA[1]), color:PALETTE.coral, ly:6.8, mx:7.6, mz:4.6 },
  { id:'chat',       label:'聊天亭',   pos:V3(-3, 22),          color:'#f5a5d8', ly:3.8 },
  { id:'tackle',     label:'釣具店',   pos:V3(-9, -3),          color:'#f6a96b', ly:4.4, mx:2.4, mz:2.8 },
  { id:'shop',       label:'海邊商店', pos:V3(18, -1),          color:'#5fb6e3', ly:4.4, mx:-2.6, mz:2.8 },
  { id:'lighthouse', label:'晴潮燈塔', pos:V3(LIGHTHOUSE[0], LIGHTHOUSE[1]), color:'#ffe5a4', ly:7.4 },
  { id:'hill',       label:'望海丘',   pos:V3(-28, 25),         color:'#a6d37d', ly:2.6 },
];
// 小船停靠點
const BOAT_DOCKS = [
  { id:'harbor', x:28.5, z:-30.5, rot:Math.PI / 2 },
  { id:'lake',   x:-20.5, z:-4.9, rot:-Math.PI / 2 },
];
// 快速傳送點（站的位置與面向）
const TRAVEL = [
  { id:'plaza', label:'潮汐廣場', x:4, z:9.6, rot:Math.PI, color:PALETTE.gold },
  ...SPOTS.map(s => ({ id:s.id, label:s.label, x:s.pos.x, z:s.pos.z, rot:Math.atan2(s.dir.x, s.dir.y), color:s.color })),
  { id:'hill', label:'望海丘', x:-26, z:27, rot:-2.6, color:'#a6d37d' },
  { id:'lighthouse', label:'晴潮燈塔', x:LIGHTHOUSE[0] - 2.4, z:LIGHTHOUSE[1] + 3.2, rot:2.6, color:'#ffe5a4' },
];
const SHIRTS = ['#f17b6d','#2f89c7','#3fbf9d','#ffd36a','#9b7bff','#f5a5d8','#ff9f43','#5b6b7a'];
const HATS = ['#ffd36a','#f6f0dd','#18334a','#f17b6d','#3fbf9d','#8c5d3b'];
const EMOTES = { wave:'👋', fish:'🐟', wow:'😮' };
const RARITY_ORDER = { '常見':0, '稀有':1, '傳說':2 };

/* ---- Quaternius「Animated Fish Pack」(CC0) 的三種魚形，依魚種重新上色 ----
   Fish1 流線型、Fish2 高身型、Fish3 條紋型。座標 ×1000 存成整數，頭朝 +x，身長 1.6。 */
// 魚的模型資料放在 fish-models.js
const FISH_STYLE = {
  perch:    { shape:'Fish1', c:{ Top:'#2f9e7a', Bottom:'#d8efe3', Fins:'#e3b65a' } },
  crucian:  { shape:'Fish2', c:{ Body:'#b9c6d3', Front:'#e6edf3', Fins:'#8fa3b5' } },
  catfish:  { shape:'Fish1', c:{ Top:'#6b5a3a', Bottom:'#c8b48a', Fins:'#4f4230' } },
  koi:      { shape:'Fish1', c:{ Top:'#ff5a36', Bottom:'#fff3e8', Fins:'#ffb070' }, glow:true },
  mackerel: { shape:'Fish1', c:{ Top:'#2f6fb5', Bottom:'#dfe8f0', Fins:'#7fb0d8' } },
  scorpion: { shape:'Fish3', c:{ Body:'#e07a45', Stripes:'#fff1dc', Outline:'#3a2418' } },
  moonbream:{ shape:'Fish2', c:{ Body:'#f2c14e', Front:'#fff0b8', Fins:'#e59a2f' } },
  kuhua:    { shape:'Fish1', c:{ Top:'#6fae9a', Bottom:'#e6f4ee', Fins:'#a8d8c4' } },
  ayu:      { shape:'Fish1', c:{ Top:'#8fae5a', Bottom:'#eef4dc', Fins:'#d8c46a' } },
  goby:     { shape:'Fish3', c:{ Body:'#8a63e8', Stripes:'#e8dcff', Outline:'#2a1a4a' } },
  trout:    { shape:'Fish1', c:{ Top:'#9b5de5', Bottom:'#efe6ff', Fins:'#c084ff' }, glow:true },
  manta:    { shape:'Manta',   c:{ Top:'#2f4d6b', Bottom:'#e8eef3' }, move:'wing' },
  dolphin:  { shape:'Dolphin', c:{ Top:'#7f8fa3', Bottom:'#e6ecf2' }, move:'vert' },
  shark:    { shape:'Shark',   c:{ Top:'#3f5f78', Bottom:'#eef2f5' }, glow:true },
  whale:    { shape:'Whale',   c:{ Top:'#34395e', Bottom:'#d9dde6' }, glow:true, move:'vert' },
  orca:     { shape:'Orca',    c:{ Top:'#2b3138', Bottom:'#f2f4f5', Fins:'#2b3138', Patch:'#f6f8f9' }, glow:true, move:'vert' },
  beluga:   { shape:'Beluga',  c:{ Top:'#e4ebf0', Bottom:'#f7f9fa', Fins:'#cfd9e1', Eye:'#2a3138' }, move:'vert' },
  sperm:    { shape:'Sperm',   c:{ Top:'#6d7f96', Bottom:'#c9d2dc', Fins:'#5b6b80', Eye:'#1d2228' }, glow:true, move:'vert' },
  sunfish:  { shape:'Sunfish', c:{ Top:'#8fa3b8', Bottom:'#d3dce5', Fins:'#7b8ea3', Eye:'#1d2228' }, move:'flap' },
  whaleshark:{ shape:'WhaleShark', c:{ Top:'#7f8c99', Bottom:'#e8ecef', Fins:'#6f7c89', Eye:'#1d2228', Spots:'#f3f5f7', Gill:'#4c5762' }, glow:true },
};
const fishTime = { value: 0 };           // 尾巴擺動用的共用時間
const fishGeoCache = {}, fishMatCache = {};
function fishGeo(shape, part){
  const key = shape + '/' + part; if (fishGeoCache[key]) return fishGeoCache[key];
  const raw = FISH_MESH[shape][part]; const arr = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw[i] / 1000;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals();
  return (fishGeoCache[key] = g);
}
const FISH_MOVES = {
  side: 'float wk = clamp((-position.x - 0.05) / 0.75, 0.0, 1.0);\n transformed.z += sin(uFishT * 9.0 + position.x * 5.0) * 0.12 * wk * wk;',
  vert: 'float wk = clamp((-position.x - 0.1) / 0.7, 0.0, 1.0);\n transformed.y += sin(uFishT * 4.0 + position.x * 3.0) * 0.1 * wk * wk;',
  flap: 'float wk = clamp((abs(position.y) - 0.45) / 0.5, 0.0, 1.0);\n transformed.z += sin(uFishT * 2.6) * 0.16 * wk * sign(position.y);',
  wing: 'float wk = clamp((abs(position.z) - 0.12) / 0.4, 0.0, 1.0);\n transformed.y += sin(uFishT * 3.0 - abs(position.z) * 2.0) * 0.13 * wk;',
};
function fishMat(id, part, color, glow, move, shape){
  move = move || 'side';
  const key = id + '/' + part; if (fishMatCache[key]) return fishMatCache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness:0.55, metalness:0.05, flatShading:true });
  const body = ['Top', 'Bottom', 'Body', 'Front', 'Stripes'].includes(part), scaly = body && /^Fish/.test(shape || '');
  if (!CLASSIC && part === 'Fins'){ m.transparent = true; m.opacity = 0.88; m.side = THREE.DoubleSide; }
  if (glow && (part === 'Top' || part === 'Body')){ m.emissive = new THREE.Color(color); m.emissiveIntensity = 0.35; }
  m.onBeforeCompile = sh => {
    sh.uniforms.uFishT = fishTime;
    sh.vertexShader = 'uniform float uFishT;\nvarying vec3 vFishP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = vec3(position);\n vFishP = position;\n ' + FISH_MOVES[move]);
    if (!CLASSIC){
      sh.fragmentShader = 'varying vec3 vFishP;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' +
        (body ? 'diffuseColor.rgb *= mix(1.08, 0.88, smoothstep(-0.2, 0.22, vFishP.y));\n' : '') +
        (scaly ? 'vec2 sp = vFishP.xy * vec2(30.0, 34.0); sp.y += mod(floor(sp.x), 2.0) * 0.5; vec2 fq = fract(sp) - 0.5; diffuseColor.rgb *= 0.9 + 0.14 * smoothstep(0.52, 0.2, length(fq * vec2(1.0, 1.3)));\n' : ''));
      const outChunk = sh.fragmentShader.includes('#include <opaque_fragment>') ? '#include <opaque_fragment>' : '#include <output_fragment>';
      sh.fragmentShader = sh.fragmentShader.replace(outChunk, 'outgoingLight += vec3(0.85, 0.95, 1.0) * pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0) * 0.28;\n' + outChunk);
    }
  };
  m.customProgramCacheKey = () => 'fish-' + move + (body ? 'b' : '') + (scaly ? 's' : '') + (CLASSIC ? 'c' : '');
  return (fishMatCache[key] = m);
}
function makeModelFish(f, scale){
  const st = FISH_STYLE[f.id]; const fish = new THREE.Group(); fish.scale.setScalar(scale || 1);
  const inner = new THREE.Group(); if (/^Fish/.test(st.shape)) inner.scale.z = 1.5; fish.add(inner);   // 稍微加厚，從上往下看比較清楚
  for (const part of Object.keys(FISH_MESH[st.shape])){
    const mesh = new THREE.Mesh(fishGeo(st.shape, part), fishMat(f.id, part, st.c[part] || f.color, st.glow, st.move, st.shape));
    mesh.castShadow = true; inner.add(mesh);
  }
  fish.userData.tail = new THREE.Object3D();   // 舊程式會轉尾巴；新模型的擺動在 shader 裡
  return fish;
}
function fishModel(f, scale){
  if (f.id === 'marlin') return makeMarlin(scale);
  if (FISH_STYLE[f.id]){ try { return makeModelFish(f, scale); } catch(e){} }
  return makeFish(f.color, scale);
}

/* ================= QUALITY（畫質分級：低 / 中 / 高） ================= */
// 中 = 原本手機的設定，高 = 原本電腦的設定；低是給較舊的 Android 手機
const TIERS = {
  low:  { label:'低', dpr:1.0, shadow:0,    tufts:0.25, waterEvery:2, aa:false },
  mid:  { label:'中', dpr:1.5, shadow:1024, tufts:0.5,  waterEvery:1, aa:false },
  high: { label:'高', dpr:2.0, shadow:2048, tufts:1.0,  waterEvery:1, aa:true  },
};
const Quality = {
  setting: LS.get('tide.quality', 'auto'),   // 'auto' | 'low' | 'mid' | 'high'
  tier: 'mid',
  detect(){
    if (!isTouch) return 'high';
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    if (mem <= 3 || cores <= 4) return 'low';
    return 'mid';
  },
};
Quality.tier = Quality.setting === 'auto' ? Quality.detect() : (TIERS[Quality.setting] ? Quality.setting : 'mid');

/* ================= TERRAIN（新地圖：約 100×95 公尺的島） =================
   x 往東、z 往南（北邊是 -z）。陸地平地高度 0，西南有山丘，水面高度 WATER_LEVEL。
   區域代號 region：0 海、1 河、2 溪、3 湖、4 瀑布潭 */
const WATER_LEVEL = 0.11;
const MAP_HALF = 75;                       // 地形網格與水面遮罩涵蓋 -75..75
function wobble(a, b){ return Math.sin(a * 0.37 + b) * 0.6 + Math.sin(a * 0.83 + b * 2.3) * 0.3 + Math.sin(a * 0.17 + b * 0.7) * 0.4; }
function smooth01(t){ t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
// 島的輪廓（極座標）：西北海灣（河口）、北邊燈塔岬角、東北港灣
function islandR(t){
  let r = 47 + (Math.sin(3 * t + 1.1) * 0.6 + Math.sin(7 * t + 2.3) * 0.3 + Math.sin(5 * t + 0.7) * 0.4 + Math.sin(11 * t + 0.2) * 0.2) * 3.2;   // 週期性，接縫不會斷開
  const bump = (c, w) => { let d = t - c; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.exp(-(d * d) / w); };
  r -= 7 * bump(-1.87, 0.05);
  r += 7 * bump(-1.2, 0.012);
  r -= 8 * bump(-0.72, 0.03);
  return r;
}
function islandEdge(x, z){ return islandR(Math.atan2(z, x)) - Math.hypot(x, z); }   // 正數 = 島上
// 線段距離
function segDist(px, pz, ax, az, bx, bz){ const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz; let t = l ? ((px - ax) * vx + (pz - az) * vz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - vx * t, pz - az - vz * t); }
function lineDist(px, pz, pts){ let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])); return d; }
const MAP = {
  plaza: [4, 4],
  river: [[-27, -10], [-22, -15], [-19, -20], [-18, -26], [-20, -32], [-17, -38], [-13, -48], [-12, -58]],
  riverHalf: 2.6,
  creek: [[26, 40], [27, 32], [25, 27], [25, 22], [28, 16], [33, 9], [40, 4], [52, 2]],
  creekHalf: 1.5, creekPool: [25, 27.5, 3.1],
  lake: [-30, -6, 11, 9],                                // 中心 x, z、半徑 rx, rz
  pool: [-26.3, 9.9, 3.4],                               // 瀑布潭
  hill: { x: -29, z: 24, R: 13, H: 5, face: [0.184, -0.983] },
  paths: [
    [[4, 4], [2, -18], [0, -40]],                        // 往北海灘碼頭
    [[4, 4], [-6, -8], [-16, -15], [-24.5, -17.6]],     // 往木橋
    [[4, 4], [-8, 1], [-16, -2]],                        // 往鏡湖棧道
    [[4, 4], [16, -8], [27, -21]],                       // 往港口
    [[4, 4], [10, 14], [18, 20], [23, 22]],              // 往螢光溪
    [[4, 4], [-10, 7], [-19, 6], [-24, 5.2]],            // 往瀑布潭
    [[-19, 6], [-17, 14], [-21, 22], [-27, 26]],         // 上山丘
  ],
};
function hillH(x, z){
  const h = MAP.hill, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
  if (d > h.R + 0.5) return 0;
  const face = Math.pow(Math.max(0, (dx * h.face[0] + dz * h.face[1]) / (d || 1)), 3);
  const ramp = 14 * (1 - face) + 3 * face;              // 面向瀑布潭的那一面是陡峭的崖
  const R = h.R + wobble(Math.atan2(dz, dx) * 4, 0.9) * 0.6;
  return h.H * smooth01((R - d) / ramp) + (d < R - ramp ? Math.sin(x * 0.5) * Math.sin(z * 0.43) * 0.25 : 0);
}
// 回傳 { h: 地面高度, water: 是否為水面, region }
function terrainInfo(x, z){
  let h = 0, water = false, region = 0;
  const e = islandEdge(x, z);
  if (e < 2){ h = Math.max(-3, -(2 - e) * 0.32); if (h < -0.02) water = true; }
  else h = hillH(x, z);
  const dig = (dist, max, slope, reg) => { if (dist > 0){ const dep = -Math.min(max, 0.08 + dist * slope); if (!water || dep < h){ h = Math.min(h, dep); region = reg; } water = true; } };
  // 湖（橢圓＋微彎岸線）
  const L = MAP.lake, lx = (x - L[0]) / L[2], lz = (z - L[1]) / L[3], ld = Math.hypot(lx, lz);
  dig((1 - ld) * Math.min(L[2], L[3]) + wobble(Math.atan2(lz, lx) * 3, 0.4) * 0.6, 1.6, 0.32, 3);
  // 瀑布潭
  const P = MAP.pool; dig(P[2] - Math.hypot(x - P[0], z - P[1]), 1.3, 0.45, 4);
  // 河（湖 → 西北海灣）
  if (e > -1.5) dig(MAP.riverHalf + wobble(z, 1.3) * 0.35 - lineDist(x, z, MAP.river), 0.95, 0.4, 1);
  // 溪（森林溪谷 → 東海岸），中間有一個小水潭
  if (e > -1.5) dig(MAP.creekHalf + wobble(z, 4.1) * 0.25 - lineDist(x, z, MAP.creek), 0.55, 0.45, 2);
  const C = MAP.creekPool; dig(C[2] - Math.hypot(x - C[0], z - C[1]), 0.7, 0.45, 2);
  if (!water && h < -0.02){ water = true; region = 0; }   // 島外的海
  return { h, water, region };
}
function terrainH(x, z){ return terrainInfo(x, z).h; }
function isLand(x, z){ return !terrainInfo(x, z).water; }
function pathDist(x, z){ let d = 1e9; for (const p of MAP.paths) d = Math.min(d, lineDist(x, z, p)); return d; }
function inSand(x, z){ const e = islandEdge(x, z); return e < 4.5 + wobble(x + z, 2) * 1.2; }
// 地面顏色（0～1 的 sRGB）
function terrainColor(x, z, info, out){
  const h = info.h;
  if (info.water){ const k = Math.min(1, -h / 1.4); out[0] = 0.85 - 0.42 * k; out[1] = 0.75 - 0.15 * k; out[2] = 0.54 + 0.02 * k; return out; }
  if (inSand(x, z)){ out[0] = 0.949; out[1] = 0.839; out[2] = 0.604; return out; }
  const pd = pathDist(x, z);
  if (pd < 0.85){ const k = smooth01((0.85 - pd) / 0.45) * 0.75; out[0] = 0.5 + 0.41 * k; out[1] = 0.73 + 0.08 * k; out[2] = 0.42 + 0.18 * k; return out; }   // 小路（踩出來的步道）
  const n = Math.sin(x * 0.21 + z * 0.17) * Math.sin(x * 0.09 - z * 0.23), k = 0.5 + 0.5 * n;
  const hk = Math.min(1, Math.max(0, h / 5));             // 山上的草偏黃綠
  out[0] = 0.467 + 0.09 * k + 0.12 * hk; out[1] = 0.722 + 0.05 * k + 0.02 * hk; out[2] = 0.416 + 0.03 * k + 0.04 * hk;
  // 森林地面稍深
  const fk = smooth01((z - 14) / 10) * (1 - smooth01(h - 0.3)) * 0.1; out[0] *= 1 - fk; out[1] *= 1 - fk * 0.7; out[2] *= 1 - fk;
  return out;
}

/* ================= 新版環境（第 1 階段）：經典畫面可在「造型」分頁切回 ================= */
const CLASSIC = false;   // 新地圖只有新版畫面
let waterfall = null;
let skyDome = null, waterSurface = null, sunDisc = null, windowGlass = null, tankWaterMat = null;

/* ================= RENDERER ================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: TIERS[Quality.tier].aa, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[Quality.tier].dpr));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog('#b7e5df', 45, 140);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
// 畫面大小用「版面」寬高，不用 innerWidth：iOS Safari 被放大時 innerWidth 會變小，畫面會變糊、標籤會跑掉
function viewW(){ return document.documentElement.clientWidth || innerWidth; }
function viewH(){ return (canvas && canvas.clientHeight) || document.documentElement.clientHeight || innerHeight; }
function resize(){ const w = viewW(), h = viewH(); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
// iOS：擋掉雙指放大與連點放大（Safari 不理會 user-scalable=no）；萬一已經被放大，畫面也會照版面大小重畫
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive:false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const t = Date.now(); if (t - lastTouchEnd < 320 && !(e.target && e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); lastTouchEnd = t; }, { passive:false });
if (window.visualViewport) visualViewport.addEventListener('resize', resize);

const MODERN = parseInt(THREE.REVISION, 10) >= 155;
const hemi = new THREE.HemisphereLight('#e7fbff', '#52725c', MODERN ? 1.55 : 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4d2', MODERN ? 2.2 : 1.25);
sun.castShadow = true;
const SM = TIERS[Quality.tier].shadow || 1024;
sun.shadow.mapSize.set(SM, SM);
sun.castShadow = TIERS[Quality.tier].shadow > 0;
Object.assign(sun.shadow.camera, { left:-30, right:30, top:30, bottom:-30, near:1, far:100 });
sun.shadow.bias = -0.0008;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);

/* ================= WORLD ================= */
const colliders = []; // {t:'b',x,z,hw,hd} | {t:'c',x,z,r}
const decks = [];     // {x0,x1,z0,z1,y}
const waters = [];    // {x0,x1,z0,z1}
const animWater = [];
const lanterns = [];
const schools = [];
const clouds = [];

function mat(color, roughness=0.8, extra){ return new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness:0.04 }, extra||{})); }
function box(size, color, pos, material){ const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material || mat(color)); m.position.set(pos[0], pos[1], pos[2]); m.castShadow = true; m.receiveShadow = true; return m; }
const addBoxCol = (x, z, w, d) => colliders.push({ t:'b', x, z, hw:w/2, hd:d/2 });
const addCircleCol = (x, z, r) => colliders.push({ t:'c', x, z, r });
function addDeck(x, z, w, d, y){ decks.push({ x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2, y }); }

function waterY(x, z, t){ return 0.12 + Math.sin(x*0.6 + t*1.3)*0.035 + Math.cos(z*0.5 + t*1.1)*0.035; }

// 小船（港口裝飾與可以划的船共用）
function makeBoatMesh(color){
  const g = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(-0.62, -1.25); shape.lineTo(0.62, -1.25); shape.lineTo(0.66, 0.45); shape.quadraticCurveTo(0.4, 1.15, 0, 1.45); shape.quadraticCurveTo(-0.4, 1.15, -0.66, 0.45); shape.lineTo(-0.62, -1.25);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false }); hullGeo.rotateX(-Math.PI / 2); hullGeo.translate(0, -0.12, 0);
  const hull = new THREE.Mesh(hullGeo, mat(color, 0.8)); hull.castShadow = true;
  const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), mat('#8c5d3b', 0.9)); inner.geometry.rotateX(-Math.PI / 2); inner.scale.set(0.86, 1, 0.86); inner.position.y = 0.12;
  const seat = box([1.15, 0.06, 0.32], '#8c5d3b', [0, 0.26, -0.25]);
  const stripe = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), mat(PALETTE.coral, 0.7)); stripe.geometry.rotateX(-Math.PI / 2); stripe.scale.set(1.02, 1, 1.02); stripe.position.y = 0.24;
  const oars = [-1, 1].map(sd => { const o = new THREE.Group(); o.position.set(sd * 0.62, 0.3, -0.1); const shaft = box([1.4, 0.05, 0.05], '#c9965f', [sd * 0.6, 0, 0]); const blade = box([0.36, 0.03, 0.16], '#c9965f', [sd * 1.25, -0.05, 0]); o.add(shaft, blade); o.rotation.z = -sd * 0.35; g.add(o); return o; });
  g.add(hull, inner, stripe, seat); g.userData.oars = oars;
  return g;
}
// 從某個位置朝某個方向，找離 dist 最近、夠深的水面點
/* ---- 卡通樹：圓樹、松樹、白樺、村子裡的花樹和果樹（每種用 InstancedMesh 一次畫完） ---- */
function buildTrees(trees, PX, PZ){
  const hash = (k, n) => { const v = Math.sin(k * 9301.7 + n * 49.3) * 43758.5453; return v - Math.floor(v); };
  const hiDet = Quality.tier === 'high' ? 2 : 1;
  const blob = (r, x, y, z, sy, det) => { const g = new THREE.IcosahedronGeometry(r, det == null ? 1 : det); g.scale(1, sy || 0.88, 1); g.translate(x, y, z); return g; };
  const trunkGeo = (r0, r1, h, flare, seg) => { const g = new THREE.CylinderGeometry(r0, r1, h, 9, seg || 4); g.translate(0, h / 2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i); if (y < 0.3){ const k = 1 + (0.3 - y) / 0.3 * flare; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); return g; };
  // 幾何
  const G = {
    trunk: vgrad(trunkGeo(0.15, 0.24, 2.0, 0.45), 0, 2, 0.78, 1.05, 0.03),
    round: vgrad(mergeParts([blob(1.05, 0, 2.4, 0, 0.88, hiDet), blob(0.78, 0.66, 2.08, 0.25), blob(0.8, -0.6, 2.12, -0.2), blob(0.72, 0.1, 3.0, -0.1), blob(0.62, -0.12, 2.0, 0.62), blob(0.58, 0.2, 2.15, -0.7)]), 1.3, 3.7, 0.66, 1.12, 0.035),
    pineTrunk: vgrad(trunkGeo(0.11, 0.19, 1.7, 0.4), 0, 1.7, 0.75, 1.0, 0.03),
    pine: vgrad(mergeParts([0, 1, 2, 3].map(j => { const g = new THREE.ConeGeometry(1.35 - j * 0.3, 1.25 - j * 0.07, 9, 1); g.rotateY(j * 0.6); g.translate(0, 1.55 + j * 0.68, 0); return g; })), 0.9, 4.4, 0.62, 1.1, 0.03),
    birchTrunk: vgrad(trunkGeo(0.1, 0.14, 2.8, 0.25, 22), 0, 2.8, 0.95, 1.08, 0, (x, y, z) => { const a = Math.atan2(z, x), band = Math.sin(y * 9 + Math.sin(a * 2) * 0.8) > 0.8 && Math.sin(a * 3 + y * 2) > -0.2; return band ? [0.3, 0.28, 0.28] : [1, 1, 0.97]; }),
    birch: vgrad(mergeParts([blob(0.82, 0, 3.0, 0, 1.3, hiDet), blob(0.55, 0.38, 2.45, 0.2, 1.1), blob(0.5, -0.32, 2.6, -0.22, 1.1)]), 1.9, 4.1, 0.7, 1.12, 0.035),
    fruit: mergeParts([[0.85, 2.3, 0.6], [-0.7, 2.5, 0.55], [0.3, 2.0, 0.95], [-0.3, 3.1, 0.6], [0.95, 2.7, -0.3], [-0.95, 2.2, -0.35], [0.2, 3.3, -0.55], [0.6, 1.75, -0.5]].map(([x, y, z]) => { const g = new THREE.IcosahedronGeometry(0.11, 1); g.translate(x, y, z); return g; })),
  };
  const vm = (opts) => new THREE.MeshStandardMaterial(Object.assign({ color:'#ffffff', vertexColors:true, roughness:0.85 }, opts));
  const M = { trunk: vm(), round: vm(), pine: vm({ flatShading:true }), birch: vm(), fruit: new THREE.MeshStandardMaterial({ color:'#ffffff', roughness:0.45, emissive:'#401010', emissiveIntensity:0.15 }) };
  instSway(M.round, 0.07, 1.4, 3.6, 'round'); instSway(M.pine, 0.05, 1.4, 4.4, 'pine'); instSway(M.birch, 0.08, 1.9, 4.0, 'birch'); instSway(M.fruit, 0.07, 1.4, 3.6, 'round');
  const C = (h) => new THREE.Color(h);
  const kinds = { round:[], pine:[], birch:[] }, fruits = [];
  for (const [x, z, k] of trees){
    const village = Math.hypot(x - PX, z - PZ) < 28 && z < 15;
    const nearHill = Math.hypot(x - MAP.hill.x, z - MAP.hill.z) < MAP.hill.R + 4;
    const pine = (k < 0.33 && z > 10) || (nearHill && k < 0.5);
    const birch = !pine && z > 15 && hash(k, 1) < 0.28;
    const sc = 0.85 + k * 0.45, y = terrainH(x, z) - 0.05, ry = k * 6;
    if (pine) kinds.pine.push({ x, y, z, sc, sy: 1.08, ry, crown: C(['#4f8f4f', '#5d9c55', '#4a8a5e'][Math.floor(hash(k, 4) * 3)]), trunk: C('#7a4f33') });
    else if (birch) kinds.birch.push({ x, y, z, sc, sy: 1, ry, crown: C(['#b2d46a', '#a3cc64', '#c2db78'][Math.floor(hash(k, 5) * 3)]), trunk: C('#efeae0') });
    else {
      const blossom = village && hash(k, 2) < 0.3, fruit = village && !blossom && hash(k, 3) < 0.35;
      const crown = blossom ? ['#f7b6c8', '#f4a3bb', '#fbcad8'][Math.floor(hash(k, 6) * 3)] : ['#8cc46a', '#7ab85e', '#9fd27a', '#76b35f'][Math.floor(hash(k, 7) * 4)];
      const t = { x, y, z, sc, sy: 1, ry, crown: C(crown), trunk: C(blossom ? '#7b5440' : PALETTE.wood) };
      kinds.round.push(t); if (fruit) fruits.push(Object.assign({}, t, { crown: C(hash(k, 8) < 0.6 ? '#ef5b4c' : '#ffb347') }));
    }
  }
  const d = new THREE.Object3D();
  const put = (geo, mat, list, colorKey, shadow) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => { d.position.set(t.x, t.y, t.z); d.rotation.set(0, t.ry, 0); d.scale.set(t.sc, t.sc * t.sy, t.sc); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, t[colorKey]); });
    im.castShadow = shadow !== false; im.receiveShadow = true; scene.add(im); return im;
  };
  put(G.trunk, M.trunk, kinds.round, 'trunk'); put(G.round, M.round, kinds.round, 'crown');
  put(G.pineTrunk, M.trunk, kinds.pine, 'trunk'); put(G.pine, M.pine, kinds.pine, 'crown');
  put(G.birchTrunk, M.trunk, kinds.birch, 'trunk'); put(G.birch, M.birch, kinds.birch, 'crown');
  put(G.fruit, M.fruit, fruits, 'crown', false);
}

function castPoint(x, z, dx, dz, dist){
  const ok = d => { const px = x + dx * d, pz = z + dz * d; const i = terrainInfo(px, pz); return i.water && i.h < -0.15 && !deckAt(px, pz); };
  if (ok(dist)) return [x + dx * dist, z + dz * dist];
  for (let k = 0.4; k < 8; k += 0.4){ if (dist - k > 1.2 && ok(dist - k)) return [x + dx * (dist - k), z + dz * (dist - k)]; if (ok(dist + k)) return [x + dx * (dist + k), z + dz * (dist + k)]; }
  return [x + dx * dist, z + dz * dist];
}
(function buildWorld(){
  // 世界用固定亂數種子，所有玩家看到的樹、花草位置都一樣
  const wr = (() => { let a = 20261103 >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const wrand = (a, b) => a + wr() * (b - a);
  // sun disc
  const sd = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color:'#ffe8ae', fog:false })); sunDisc = sd; sd.userData.keep = true;
  sd.position.set(-34, 32, -48); scene.add(sd);
  buildNewEnvironment();
  const [PX, PZ] = MAP.plaza;

  // ---- 潮汐廣場 ----
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 40), mat('#dcbf7d')); plaza.rotation.x = -Math.PI/2; plaza.position.set(PX, 0.015, PZ); plaza.receiveShadow = true; scene.add(plaza);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.11, 8, 48), mat(PALETTE.gold, 0.6, { emissive:PALETTE.gold, emissiveIntensity:0.5 })); ring.rotation.x = -Math.PI/2; ring.position.set(PX, 0.06, PZ); scene.add(ring);
  for (let i = 0; i < 8; i++){ const a = i/8*Math.PI*2; const st = box([0.9,0.04,0.9], '#cfae6a', [PX + Math.cos(a)*3, 0.03, PZ + Math.sin(a)*3]); st.rotation.y = a; scene.add(st); }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.45, 20), mat('#e9e2cf', 0.7)); basin.position.set(PX, 0.22, PZ); basin.castShadow = basin.receiveShadow = true; scene.add(basin);
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.05, 20), mat('#67c9d0', 0.15, { emissive:'#4fc2cf', emissiveIntensity:0.35 })); fw.position.set(PX, 0.42, PZ); scene.add(fw);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10), mat('#e9e2cf', 0.7)); spout.position.set(PX, 0.8, PZ); spout.castShadow = true; scene.add(spout);
  addCircleCol(PX, PZ, 1.6);

  // ---- 木碼頭、棧道、木橋 ----
  function deck(x0, x1, z0, z1, y, color){
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    addDeck(cx, cz, w, d, y);
    // 一片片木板（兩種木色交錯、中間留小縫），下面兩根長樑
    const c1 = color || PALETTE.wood, c2 = '#' + new THREE.Color(c1).multiplyScalar(0.86).getHexString();
    const along = w >= d, len = along ? w : d, n = Math.max(1, Math.round(len / 0.34)), step = len / n;
    for (let i = 0; i < n; i++){ const k = (i * 7) % 3 === 0 ? c2 : c1, o = (along ? x0 : z0) + step * (i + 0.5), jy = ((i * 13) % 5) * 0.004;
      scene.add(along ? box([step - 0.05, 0.12, d], k, [o, y - 0.06 + jy, cz]) : box([w, 0.12, step - 0.05], k, [cx, y - 0.06 + jy, o])); }
    for (const e of [-1, 1]) scene.add(along ? box([w, 0.14, 0.18], '#6e4a2f', [cx, y - 0.19, cz + e * (d / 2 - 0.2)]) : box([0.18, 0.14, d], '#6e4a2f', [cx + e * (w / 2 - 0.2), y - 0.19, cz]));
    // 水裡的木樁
    for (let x = x0 + 0.2; x <= x1 - 0.1; x += Math.max(1.6, (w - 0.4) / Math.max(1, Math.round((w - 0.4) / 2.2))))
      for (const z of [z0 + 0.15, z1 - 0.15]){ const h = terrainH(x, z); if (h < -0.05){ const len = y - h; scene.add(box([0.2, len, 0.2], '#6e4a2f', [x, h + len / 2 - 0.1, z])); } }
    for (let z = z0 + 0.2; z <= z1 - 0.1; z += Math.max(1.6, (d - 0.4) / Math.max(1, Math.round((d - 0.4) / 2.2))))
      for (const x of [x0 + 0.15, x1 - 0.15]){ const h = terrainH(x, z); if (h < -0.05){ const len = y - h; scene.add(box([0.2, len, 0.2], '#6e4a2f', [x, h + len / 2 - 0.1, z])); } }
  }
  deck(-1.8, 1.8, -52.2, -42.4, 0.28);                 // 北海灘碼頭
  deck(22, 34.2, -28.2, -25.8, 0.3);                    // 港口碼頭 1
  deck(23, 32, -35.2, -32.8, 0.3);                      // 港口碼頭 2
  deck(-23.2, -16, -3, -1, 0.28);                       // 鏡湖棧道
  deck(-24.6, -16.2, -18.7, -16.5, 0.42, '#a8754a');    // 河上的木橋
  for (const z of [-18.62, -16.58]) scene.add(box([8.4, 0.08, 0.08], '#6e4a2f', [-20.4, 1.05, z]));   // 橋欄杆
  for (let x = -24.4; x <= -16.3; x += 1.35) for (const z of [-18.62, -16.58]) scene.add(box([0.1, 0.62, 0.1], '#6e4a2f', [x, 0.74, z]));
  deck(19.6, 21.8, 26.2, 28.6, 0.18);                   // 螢光溪的小平台
  deck(24, 29, 18.2, 19.8, 0.36, '#a8754a');            // 溪上的小木橋（通往東南森林）
  for (const z of [18.24, 19.76]) scene.add(box([5, 0.06, 0.06], '#6e4a2f', [26.5, 0.92, z]));
  // 港口的小船（裝飾）與漁網架
  for (const [x, z, r] of [[30.5, -37.5, 0.3], [35.5, -30.2, -0.2]]){ const b = makeBoatMesh('#f6e4bd'); b.position.set(x, WATER_LEVEL, z); b.rotation.y = r; scene.add(b); }

  // ---- 瀑布（山丘的崖 → 瀑布潭）----
  const H = MAP.hill, fd = H.face, fx = H.x + fd[0] * (H.R - 1.4), fz = H.z + fd[1] * (H.R - 1.4);
  const fallTop = H.H + 0.15, fallLen = fallTop - WATER_LEVEL;
  const wfMat = new THREE.ShaderMaterial({
    uniforms: { uT: fishTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      void main(){
        float s = sin(vUv.x * 40.0 + sin(vUv.x * 13.0) * 2.0) * 0.5 + 0.5;
        float flow = fract(vUv.y * 3.0 + uT * 1.6 + s * 0.3);
        float streak = smoothstep(0.0, 0.5, flow) * smoothstep(1.0, 0.6, flow);
        vec3 c = mix(vec3(0.62, 0.86, 0.95), vec3(1.0), streak * 0.7 + s * 0.15);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(c, (0.65 + 0.3 * streak) * edge);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, fallLen, 1, 6), wfMat);
  fall.position.set(fx, WATER_LEVEL + fallLen / 2, fz); fall.lookAt(fx + fd[0], WATER_LEVEL + fallLen / 2, fz + fd[1]); fall.userData.keep = true; scene.add(fall);
  waterfall = { x: fx + fd[0] * 0.6, z: fz + fd[1] * 0.6 };
  const rockM = mat('#9d998d', 0.95, { flatShading: true });
  for (let i = 0; i < 9; i++){ const a = -1.2 + i * 0.3, r = 2.2 + wr() * 0.6; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + wr() * 0.5, 0), rockM); const rx = fx + Math.cos(a + Math.atan2(fd[1], fd[0]) + Math.PI / 2) * r * 0.9, rz = fz + Math.sin(a + Math.atan2(fd[1], fd[0]) + Math.PI / 2) * r * 0.9; rk.position.set(rx, Math.max(terrainH(rx, rz), -0.3) + 0.2, rz); rk.rotation.set(wr() * 3, wr() * 3, 0); rk.castShadow = true; scene.add(rk); }

  // ---- 螢光石（溪邊）----
  const glowM = mat('#9bf3d6', 0.4, { emissive:'#6bd6b0', emissiveIntensity:0.9 });
  const CP = MAP.creekPool;
  for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2 + 0.4, r = CP[2] + 0.9 + wr() * 0.6; const x = CP[0] + Math.cos(a) * r, z = CP[1] + Math.sin(a) * r; if (deckAt(x, z) || !isLand(x, z)) continue; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + (i % 3) * 0.12, 0), glowM); s.position.set(x, terrainH(x, z) + 0.15, z); s.rotation.set(i, i * 2, 0); scene.add(s); lanterns.push(s); }
  for (let i = 0; i < 10; i++){ const t = wr(), seg = MAP.creek, k = Math.min(seg.length - 2, Math.floor(t * (seg.length - 1))), u = t * (seg.length - 1) - k; const x = seg[k][0] + (seg[k+1][0] - seg[k][0]) * u + (wr() < 0.5 ? -2.4 : 2.4), z = seg[k][1] + (seg[k+1][1] - seg[k][1]) * u; if (!isLand(x, z)) continue; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), glowM); s.position.set(x, terrainH(x, z) + 0.12, z); scene.add(s); lanterns.push(s); }

  // ---- 房子與商店 ----
  const reedM = mat('#5f9e58', 0.9);   // （保留給舊程式參考）
  // 溫馨木屋：石頭地基、灰泥牆加木框、斜屋頂（瓦片層次＋屋脊）、拱門、窗框和花台、煙囪
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  const glassM = mat('#9fdbe3', 0.25, { emissive:'#ffe3a0', emissiveIntensity:0.18 }); windowGlass = glassM;
  function house(x, z, roofColor, width, rotY, opts){
    opts = opts || {};
    const g = new THREE.Group(); g.position.set(x, groundHeight(x, z), z); g.rotation.y = rotY || 0;
    const W = width, D = 2.5, wallH = 2.0, base = 0.3, top = base + wallH;
    const dark = '#6e4a2f', wall = opts.wall || '#f6e4bd', trim = '#fffaf0';
    g.add(box([W + 0.24, base, D + 0.24], '#b9b2a3', [0, base / 2, 0]));                        // 地基
    g.add(box([W, wallH, D], wall, [0, base + wallH / 2, 0]));                                  // 牆
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box([0.16, wallH, 0.16], dark, [sx * (W / 2 - 0.02), base + wallH / 2, sz * (D / 2 - 0.02)]));
    for (const sz of [-1, 1]) g.add(box([W + 0.06, 0.14, 0.1], dark, [0, top - 0.07, sz * (D / 2 + 0.01)]));
    for (const sx of [-1, 1]) g.add(box([0.1, 0.14, D + 0.06], dark, [sx * (W / 2 + 0.01), top - 0.07, 0]));
    // 斜屋頂：屋脊沿著寬度方向，前後兩片，兩側是三角山牆
    const ang = 0.62, over = 0.32, rise = Math.tan(ang) * D / 2, run = D / 2 + over, L = run / Math.cos(ang);
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
    const gable = new THREE.ExtrudeGeometry(tri, { depth:0.1, bevelEnabled:false }); gable.rotateY(Math.PI / 2); gable.translate(-0.05, top, 0);
    for (const sx of [-1, 1]){ const m = new THREE.Mesh(gable, mat(wall)); m.position.x = sx * (W / 2 - 0.04); m.castShadow = m.receiveShadow = true; g.add(m);
      const rw = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), glassM); rw.position.set(sx * (W / 2 + 0.02), top + rise * 0.42, 0); rw.rotation.y = sx * Math.PI / 2; g.add(rw);
      const rr = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 16), mat(trim)); rr.position.copy(rw.position); rr.rotation.y = sx * Math.PI / 2; g.add(rr); }
    const roofDark = shade(roofColor, 0.8);
    for (const sz of [-1, 1]){
      const zc = sz * run / 2, yc = top + rise - Math.tan(ang) * run / 2 + 0.06;
      const slab = box([W + 0.5, 0.14, L], roofColor, [0, yc, zc]); slab.rotation.x = sz * ang; g.add(slab);
      for (const f of [0.3, 0.55, 0.8]){ const zz = sz * run * f, yy = top + rise - Math.tan(ang) * run * f + 0.15; const st = box([W + 0.54, 0.05, 0.12], roofDark, [0, yy, zz]); st.rotation.x = sz * ang; g.add(st); }
    }
    g.add(box([W + 0.6, 0.16, 0.22], roofDark, [0, top + rise + 0.13, 0]));                       // 屋脊
    // 煙囪
    g.add(box([0.42, 1.3, 0.42], '#c9b38a', [W * 0.27, top + rise * 0.55 + 0.4, -0.55]));
    g.add(box([0.54, 0.12, 0.54], '#9d8f78', [W * 0.27, top + rise * 0.55 + 1.08, -0.55]));
    // 門（住家是拱門，商店是方門）
    const fz = D / 2;
    g.add(box([1.0, 0.14, 0.5], '#c8c0b0', [0, 0.07, fz + 0.3]));                                  // 門前石階
    g.add(box([0.8, 1.3, 0.08], dark, [0, base + 0.65, fz + 0.02]));
    g.add(box([0.62, 1.18, 0.1], PALETTE.wood, [0, base + 0.59, fz + 0.05]));
    if (!opts.awning){   // 拱門：門框和門板上緣各一個半圓
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16, 0, Math.PI), mat(dark)); arch.position.set(0, base + 1.3, fz + 0.065); g.add(arch);
      const arch2 = new THREE.Mesh(new THREE.CircleGeometry(0.31, 16, 0, Math.PI), mat(PALETTE.wood)); arch2.position.set(0, base + 1.18, fz + 0.105); g.add(arch2); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(PALETTE.gold, 0.3, { metalness:0.5 })); knob.position.set(0.2, base + 0.6, fz + 0.12); g.add(knob);
    // 窗戶：白色窗框、十字窗格、下方花台
    const flowerCols = ['#f17b6d', '#ffd36a', '#f5a5d8', '#b9a4ff'];
    function windowAt(px, py, pz, ry, flowers){
      const w = new THREE.Group(); w.position.set(px, py, pz); w.rotation.y = ry; g.add(w);
      w.add(box([0.74, 0.68, 0.07], trim, [0, 0, 0])); const gl = box([0.58, 0.52, 0.08], null, [0, 0, 0.01], glassM); gl.castShadow = false; w.add(gl);
      w.add(box([0.05, 0.52, 0.1], trim, [0, 0, 0.03])); w.add(box([0.58, 0.05, 0.1], trim, [0, 0, 0.03]));
      if (flowers){ w.add(box([0.82, 0.14, 0.2], PALETTE.wood, [0, -0.42, 0.08]));
        for (let i = 0; i < 4; i++){ const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), mat(flowerCols[(i + Math.round(px * 3)) & 3], 0.6)); f.position.set(-0.27 + i * 0.18, -0.3, 0.1); w.add(f); } }
    }
    const wx = Math.min(W * 0.3, 1.05);
    if (!opts.awning) for (const sx of [-1, 1]) windowAt(sx * wx, base + 1.2, fz + 0.03, 0, true);
    for (const sx of [-1, 1]) windowAt(sx * (W / 2 + 0.03), base + 1.2, 0, sx * Math.PI / 2, false);
    if (opts.awning){   // 商店：條紋遮雨棚、櫃台、招牌、木箱和木桶
      for (const sx of [-1, 1]) windowAt(sx * wx * 1.05, base + 1.25, fz + 0.03, 0, false);
      for (let i = 0; i < 6; i++){ const st = box([W / 6, 0.07, 1.15], i % 2 ? '#ffffff' : opts.awning, [-W / 2 + W / 12 + i * W / 6, 1.95, fz + 0.5]); st.rotation.x = 0.38; g.add(st); }
      for (let i = 0; i < 6; i++){ const sc = new THREE.Mesh(new THREE.CircleGeometry(W / 12, 12, Math.PI, Math.PI), mat(i % 2 ? '#ffffff' : opts.awning, 0.8, { side:THREE.DoubleSide })); sc.position.set(-W / 2 + W / 12 + i * W / 6, 1.75, fz + 1.04); g.add(sc); }   // 遮雨棚前緣的波浪邊
      g.add(box([W * 0.8, 0.85, 0.5], PALETTE.wood, [0, 0.43, fz + 0.8])); g.add(box([W * 0.84, 0.08, 0.6], '#c79a6b', [0, 0.88, fz + 0.8]));
      g.add(box([1.7, 0.34, 0.07], opts.awning, [0, top - 0.25, fz + 0.09])); g.add(box([1.5, 0.22, 0.08], trim, [0, top - 0.25, fz + 0.1]));
      g.add(box([0.5, 0.45, 0.5], '#b8865a', [W / 2 + 0.2, 0.22, fz + 0.4])); g.add(box([0.4, 0.35, 0.4], '#a8754a', [W / 2 + 0.25, 0.62, fz + 0.4]));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 12), mat('#9b6a42')); barrel.position.set(-W / 2 - 0.15, 0.3, fz + 0.5); barrel.castShadow = true; g.add(barrel);
      for (const yy of [0.12, 0.48]){ const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.02, 4, 16), mat('#4c4c4c', 0.5)); hoop.rotation.x = Math.PI / 2; hoop.position.set(-W / 2 - 0.15, yy, fz + 0.5); g.add(hoop); }
    }
    scene.add(g);
    const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0), ex = Math.abs(c) * width + Math.abs(s) * 2.5, ez = Math.abs(s) * width + Math.abs(c) * 2.5;
    addBoxCol(x, z, ex, ez);
  }
  // 門都朝向廣場
  const faceTo = (x, z) => Math.atan2(PX - x, PZ - z);
  house(-9, 15, '#d896c3', 3.1, faceTo(-9, 15));
  house(16, 14, '#7db7d7', 3.6, faceTo(16, 14));
  house(-14, -9, '#ec8b68', 3.3, faceTo(-14, -9));
  house(22, 7, '#9fc7a8', 3.2, faceTo(22, 7));
  house(-9, -3, '#f6a96b', 3.6, faceTo(-9, -3), { awning: '#f17b6d' });      // 釣具店
  house(18, -1, '#5fb6e3', 3.8, faceTo(18, -1), { awning: '#2f89c7' });      // 海邊商店

  // ---- 聊天亭 ----
  const [CX, CZ] = [-3, 22];
  const pav = new THREE.Group(); pav.position.set(CX, 0, CZ);
  for (const [px,pz] of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,2.3,8), mat(PALETTE.wood)); p.position.set(px,1.15,pz); p.castShadow = true; pav.add(p); }
  const proof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 6), mat('#f5a5d8')); proof.position.y = 2.85; proof.castShadow = true; pav.add(proof);
  // 屋簷木邊、頂端小尖塔、四周矮欄杆
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.16, 6, 1, true), mat(PALETTE.wood, 0.8, { side:THREE.DoubleSide })); eave.position.y = 2.3; pav.add(eave);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(PALETTE.gold, 0.4)); fin.position.y = 3.55; pav.add(fin);
  for (const sx of [-1, 1]){ pav.add(box([0.08, 0.08, 2.4], PALETTE.wood, [sx * 1.4, 0.72, 0])); for (const z of [-0.8, 0, 0.8]) pav.add(box([0.06, 0.6, 0.06], PALETTE.wood, [sx * 1.4, 0.42, z])); }
  const bench = box([2.2, 0.12, 0.5], PALETTE.wood, [0, 0.45, 0.9]); const bench2 = bench.clone(); bench2.position.z = -0.9;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.12, 6), mat('#e9d6b0')); floor.position.y = 0.06; floor.receiveShadow = true;
  pav.add(bench, bench2, floor); scene.add(pav);

  // ---- 水族館（大型玻璃魚缸，正面朝南）----
  const [AX, AZ] = AQUA;
  const aq = new THREE.Group(); aq.position.set(AX, 0, AZ); scene.add(aq);
  aq.add(box([13, 0.4, 8], '#d9cfb8', [0, 0.2, 0]));                       // 石台
  aq.add(box([12.4, 0.5, 4.2], PALETTE.wood, [0, 0.65, -0.6]));           // 魚缸底座
  aq.add(box([12.4, 4.2, 0.3], '#f6e4bd', [0, 2.5, -2.9]));               // 後牆
  for (const x of [-6, 6]) for (const z of [-2.9, 3.6]) aq.add(box([0.35, 4.6, 0.35], PALETTE.wood, [x, 2.5, z]));
  const aroof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 1.8, 4), mat(PALETTE.coral)); aroof.scale.set(1, 1, 0.62); aroof.rotation.y = Math.PI / 4; aroof.position.set(0, 5.6, 0.35); aroof.castShadow = true; aq.add(aroof);
  aq.add(box([3.6, 0.7, 0.18], PALETTE.coral, [0, 4.6, 3.7]));             // 招牌
  // 魚缸本體（之後的魚會放在 tankGroup 裡）
  const tank = new THREE.Group(); tank.position.set(AX, 2.45, AZ - 0.6); scene.add(tank);
  tank.add(box([10.6, 0.25, 3.0], '#e8d9a8', [0, -1.4, 0]));               // 沙
  for (let i = 0; i < 9; i++){ const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + wr() * 0.25, 0), mat(['#9d998d', '#b7b2a4', '#c9a8a0'][i % 3], 0.9, { flatShading:true })); rk.position.set(wrand(-4.8, 4.8), -1.2, wrand(-1.2, 1.0)); rk.rotation.set(wr() * 3, wr() * 3, 0); tank.add(rk); }
  for (let i = 0; i < 16; i++){ const len = wrand(0.5, 1.6), sw = new THREE.Mesh(new THREE.ConeGeometry(0.06, len, 4), mat(i % 2 ? '#3f8f6a' : '#5aa874', 0.8)); sw.position.set(wrand(-5, 5), -1.3 + len / 2, wrand(-1.3, -0.4)); tank.add(sw); }
  const twater = new THREE.Mesh(new THREE.BoxGeometry(10.6, 2.8, 3.0), new THREE.MeshStandardMaterial({ color:'#67c9d0', transparent:true, opacity:0.32, roughness:0.2, depthWrite:false, emissive:'#4fc2cf', emissiveIntensity:0 })); tankWaterMat = twater.material;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(11, 3.2, 3.4), new THREE.MeshPhysicalMaterial({ color:'#b8f3f1', transparent:true, opacity:0.16, roughness:0.05, depthWrite:false }));
  tank.add(twater, glass);
  tankGroup = new THREE.Group(); tank.add(tankGroup);
  // 石台可以走上去，站到玻璃前面看魚；只有魚缸底座、後牆、柱子會擋
  addDeck(AX, AZ, 13, 8, 0.4);
  addBoxCol(AX, AZ - 0.8, 12.6, 4.6);
  for (const x of [-6, 6]) addCircleCol(AX + x, AZ + 3.6, 0.3);

  // ---- 燈塔（北邊岬角）----
  const [LX, LZ] = LIGHTHOUSE;
  const lh = new THREE.Group(); lh.position.set(LX, 0, LZ); lh.rotation.y = Math.atan2(-LX, -LZ);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), mat('#8e9a9a', 0.95)); rock.scale.y = 0.3; rock.castShadow = rock.receiveShadow = true;
  // 燈塔：石頭底座、紅白條紋塔身、小門和窗、環形陽台、玻璃燈室、紅色圓頂
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.2, 5.2, 20), mat('#f7f3e4')); tower.position.y = 2.75; tower.castShadow = true;
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.4, 20), mat('#a9a497', 0.95)); baseRing.position.y = 0.2; baseRing.castShadow = baseRing.receiveShadow = true;
  lh.add(rock, baseRing, tower);
  for (const [y, r0, r1] of [[1.6, 1.13, 1.17], [3.4, 1.0, 1.05]]){ const st = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, 0.75, 20), mat(PALETTE.coral)); st.position.y = y; st.castShadow = true; lh.add(st); }
  const ldoor = box([0.5, 0.85, 0.12], PALETTE.wood, [0, 0.82, 1.17]); lh.add(ldoor);
  for (const [y, a] of [[2.4, 0.6], [4.2, -0.8]]){ const w = box([0.26, 0.34, 0.1], '#9fdbe3', [Math.sin(a) * 0.98, y, Math.cos(a) * 0.98]); w.rotation.y = a; lh.add(w); }
  const deckL = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.16, 20), mat('#e9e2cf')); deckL.position.y = 5.42; deckL.castShadow = true; lh.add(deckL);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 6, 28), mat('#3a4a57', 0.5)); rail.rotation.x = Math.PI / 2; rail.position.y = 5.85; lh.add(rail);
  for (let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; lh.add(box([0.04, 0.42, 0.04], '#3a4a57', [Math.cos(a) * 1.2, 5.65, Math.sin(a) * 1.2])); }
  const lroom = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.85, 16), new THREE.MeshPhysicalMaterial({ color:'#cdf5f2', transparent:true, opacity:0.35, roughness:0.05, depthWrite:false })); lroom.position.y = 5.92; lh.add(lroom);
  for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; lh.add(box([0.05, 0.85, 0.05], '#3a4a57', [Math.cos(a) * 0.62, 5.92, Math.sin(a) * 0.62])); }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(PALETTE.coral)); cap.position.y = 6.33; cap.scale.y = 0.8; cap.castShadow = true; lh.add(cap);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#3a4a57', 0.4)); capTop.position.y = 6.97; lh.add(capTop);
  lhLight = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshStandardMaterial({ color:'#fff6bb', emissive:'#fff0a0', emissiveIntensity:3 })); lhLight.position.y = 5.92;
  lh.add(lhLight); scene.add(lh); addCircleCol(LX, LZ, 1.5);

  // ---- 山頂的觀景長椅與旗子 ----
  const [HX, HZ] = [MAP.hill.x + 1, MAP.hill.z + 1];
  const hy = terrainH(HX, HZ);
  scene.add(box([1.8, 0.12, 0.5], PALETTE.wood, [HX, hy + 0.45, HZ]));
  for (const dx of [-0.75, 0.75]) scene.add(box([0.12, 0.45, 0.4], PALETTE.wood, [HX + dx, hy + 0.22, HZ]));
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), mat('#e9e2cf')); flagPole.position.set(HX + 2, hy + 1.5, HZ - 1); scene.add(flagPole);
  scene.add(box([0.9, 0.55, 0.04], PALETTE.coral, [HX + 2.47, hy + 2.7, HZ - 1]));

  // ---- 樹：南邊的森林、山丘，加上村子周圍零星幾棵 ----
  const nearThing = (x, z) => Math.hypot(x - PX, z - PZ) < 10 || Math.hypot(x - CX, z - CZ) < 4.5 || Math.hypot(x - AX, z - AZ) < 9 || Math.hypot(x - LX, z - LZ) < 4 || SPOTS.some(s => Math.hypot(x - s.pos.x, z - s.pos.z) < 4.5) || Math.hypot(x - HX, z - HZ) < 4 || BOAT_DOCKS.some(b => Math.hypot(x - b.x, z - b.z) < 4);
  const treeOK = (x, z) => isLand(x, z) && islandEdge(x, z) > 4 && pathDist(x, z) > 2.2 && lineDist(x, z, MAP.creek) > 3.2 && Math.hypot(x - MAP.creekPool[0], z - MAP.creekPool[1]) > 5.2 && !nearThing(x, z) && !blocked(x, z, 1.2) && Math.hypot(x - waterfall.x, z - waterfall.z) > 4;
  const trees = [];
  const want = Quality.tier === 'low' ? 85 : Quality.tier === 'mid' ? 115 : 145;
  let guard = 0;
  while (trees.length < want && guard++ < 6000){
    const x = wrand(-48, 48), z = wrand(-46, 48);
    const forest = z > 15 || Math.hypot(x - MAP.hill.x, z - MAP.hill.z) < MAP.hill.R + 4;   // 森林和山丘密，其他地方稀疏
    if (!forest && wr() > 0.12) continue;
    if (!treeOK(x, z)) continue;
    trees.push([x, z, wr()]); addCircleCol(x, z, 0.5);
  }
  buildTrees(trees, PX, PZ);

  // ---- 廣場周圍的燈 ----
  const lampM = () => new THREE.MeshStandardMaterial({ color:'#fff3c4', emissive:'#ffd36a', emissiveIntensity:1.2 });
  for (let i = 0; i < 6; i++){
    const a = i/6*Math.PI*2 + 0.3; const x = PX + Math.cos(a)*6.4, z = PZ + Math.sin(a)*6.4;
    if (pathDist(x, z) < 1.2) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), mat(PALETTE.ink)); pole.position.set(x, 0.8, z); pole.castShadow = true;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), lampM()); lamp.position.set(x, 1.68, z);
    scene.add(pole, lamp); lanterns.push(lamp); addCircleCol(x, z, 0.2);
  }

  // ---- 地標、釣點標記、路牌、魚群 ----
  function labelMarker(color){ const m = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 1.3, 8), mat(PALETTE.wood)); pole.position.y = 0.65; pole.castShadow = true; const orb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 10), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:1.4 })); orb.position.y = 1.42; m.add(pole, orb); return m; }
  function signpost(x, z, rot){ const g = new THREE.Group(); g.position.set(x, groundHeight(x, z), z); g.rotation.y = rot; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), mat(PALETTE.wood)); p.position.y = 0.75; p.castShadow = true; g.add(p); g.add(box([0.9, 0.38, 0.06], '#c9965f', [0.25, 1.25, 0])); g.add(box([0.16, 0.16, 0.07], PALETTE.gold, [0.55, 1.25, 0])); scene.add(g); }
  for (const sp of SPOTS){
    const deckY = groundHeight(sp.pos.x, sp.pos.z);
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 36), new THREE.MeshStandardMaterial({ color:sp.color, emissive:sp.color, emissiveIntensity:1.8, transparent:true, opacity:0.86 }));
    r.rotation.x = -Math.PI/2; r.position.set(sp.pos.x, deckY + 0.06, sp.pos.z); scene.add(r); sp.ring = r;
    const side = [sp.dir.y, -sp.dir.x];
    let mx = sp.pos.x - sp.dir.x*1.4 + side[0]*1.5, mz = sp.pos.z - sp.dir.y*1.4 + side[1]*1.5;
    if (!walkable(mx, mz)){ mx = sp.pos.x - sp.dir.x*1.4 - side[0]*1.5; mz = sp.pos.z - sp.dir.y*1.4 - side[1]*1.5; }
    const m = labelMarker(sp.color); m.position.set(mx, groundHeight(mx, mz), mz); scene.add(m);
    // 魚群：在釣點前方找一處夠深的水
    const p = castPoint(sp.pos.x, sp.pos.z, sp.dir.x, sp.dir.y, 5);
    const g = new THREE.Group(); g.position.set(p[0], Math.max(terrainH(p[0], p[1]) + 0.25, -0.12), p[1]);
    sp.fish.map(id => FISH_BY_ID[id]).filter(f => f.rarity === '常見').slice(0, 2).forEach((f, i) => { for (let k = 0; k < 2; k++){ const fm = fishModel(f, 0.45); const a = (i*2+k)/4*Math.PI*2; fm.position.set(Math.cos(a)*1.0, 0, Math.sin(a)*1.0); fm.rotation.y = -a; g.add(fm); } });
    scene.add(g); schools.push({ g, phase: sp.pos.x*0.2 });
  }
  for (const mk of LANDMARKS){ if (['plaza', 'lighthouse', 'hill'].includes(mk.id)) continue; const m = labelMarker(mk.color); const mx = mk.pos.x + (mk.mx || 1.6), mz = mk.pos.z + (mk.mz || 1.8); m.position.set(mx, groundHeight(mx, mz), mz); scene.add(m); }
  for (const tp of TRAVEL) if (tp.id !== 'plaza') signpost(tp.x + Math.cos(tp.rot) * 1.6, tp.z - Math.sin(tp.rot) * 1.6, tp.rot);
  signpost(PX + 7.6, PZ + 2.5, 0.4);

  // ---- 小草（instanced）----
  const tuftGeo = new THREE.ConeGeometry(0.09, 0.32, 4); const tuftMat = mat('#ffffff', 0.9);
  const N = 900; const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, N);
  const dummy = new THREE.Object3D(); const col = new THREE.Color(); let n = 0; guard = 0;
  while (n < N && guard++ < 9000){
    const x = wrand(-48, 48), z = wrand(-48, 48);
    if (!isLand(x, z) || Math.hypot(x - PX, z - PZ) < 7.4 || blocked(x, z, 0.3) || inSand(x, z) || islandEdge(x, z) < 3.6 || pathDist(x, z) < 1.2 || deckAt(x, z)) continue;
    dummy.position.set(x, terrainH(x, z) + 0.14, z); dummy.rotation.set(wrand(-0.2,0.2), wrand(0,6), wrand(-0.2,0.2)); dummy.scale.setScalar(wrand(0.7,1.4)); dummy.updateMatrix();
    tufts.setMatrixAt(n, dummy.matrix); col.set(wr() < 0.08 ? (wr()<0.5 ? '#ffd36a' : '#f5a5d8') : (wr()<0.5 ? '#8fc46f' : '#a6d37d')); tufts.setColorAt(n, col); n++;
  }
  tuftsMesh = tufts; tuftsTotal = n; tufts.count = Math.round(n * TIERS[Quality.tier].tufts); tufts.receiveShadow = true; scene.add(tufts);

  // ---- 雲 ----
  const cm = mat('#ffffff', 1, { flatShading:true, emissive:'#ffffff', emissiveIntensity:0.25 });
  for (let i = 0; i < 10; i++){
    const g = new THREE.Group(); const k = 3 + (i%3);
    for (let j = 0; j < k; j++){ const p = new THREE.Mesh(new THREE.IcosahedronGeometry(wrand(1.4,2.4), 0), cm); p.position.set(j*1.8 - k, wrand(-0.3,0.4), wrand(-0.6,0.6)); g.add(p); }
    g.position.set(wrand(-90,90), wrand(18,28), wrand(-90,60)); scene.add(g); clouds.push({ g, v: wrand(0.4,0.9) });
  }
})();

var tankGroup, lhLight, tuftsMesh = null, tuftsTotal = 0;

function applyQuality(tier, why){
  if (!TIERS[tier]) return; const T = TIERS[tier]; Quality.tier = tier;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, T.dpr)); resize();
  if (T.shadow > 0){
    if (sun.shadow.mapSize.x !== T.shadow){ sun.shadow.mapSize.set(T.shadow, T.shadow); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.castShadow = true;
  } else sun.castShadow = false;
  if (tuftsMesh) tuftsMesh.count = Math.round(tuftsTotal * T.tufts);
  if (why === 'auto') toast(`畫面有點卡，已自動把畫質調成「${T.label}」。可以在「造型」分頁改回來。`);
}
// 自動模式：連續卡頓就降一級（每次降級後至少等 15 秒再判斷）
const fpsMon = { frames: 0, since: 0, lastDrop: 0, startAt: 0 };
function watchFps(t){
  if (!fpsMon.startAt){ fpsMon.startAt = t; fpsMon.since = t; }
  fpsMon.frames++;
  if (t - fpsMon.since < 5) return;
  const fps = fpsMon.frames / (t - fpsMon.since); fpsMon.frames = 0; fpsMon.since = t; Quality.fps = fps;
  if (Quality.setting !== 'auto' || document.hidden || t - fpsMon.startAt < 10 || t - fpsMon.lastDrop < 15) return;
  if (fps < 32 && Quality.tier !== 'low'){ fpsMon.lastDrop = t; applyQuality(Quality.tier === 'high' ? 'mid' : 'low', 'auto'); }
}

/* ---- 合併靜態物件：同一種材質的房子、碼頭、樹幹…合成一個網格，大幅減少手機的繪製次數 ---- */
function batchStatic(){
  if (/nomerge/.test(location.hash)) return;
  try {
    const skip = new Set();
    animWater.forEach(w => skip.add(w.m)); lanterns.forEach(l => skip.add(l));
    SPOTS.forEach(sp => sp.ring && skip.add(sp.ring)); schools.forEach(sc => skip.add(sc.g)); clouds.forEach(c => skip.add(c.g));
    if (lhLight) skip.add(lhLight); if (sunDisc) skip.add(sunDisc); if (tankGroup && tankGroup.parent) skip.add(tankGroup.parent);
    scene.updateMatrixWorld(true);
    const groups = new Map();
    (function walk(o){
      if (skip.has(o)) return;
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.visible){
        const m = o.material;
        const key = [m.type, m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.roughness, m.metalness, m.transparent, m.opacity, m.side, m.flatShading, m.fog, o.castShadow, o.receiveShadow].join('|');
        if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
      }
      for (const c of o.children.slice()) walk(c);
    })(scene);
    let before = 0, after = 0;
    for (const list of groups.values()){
      before += list.length;
      if (list.length < 2){ after += list.length; continue; }
      const geos = list.map(o => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.applyMatrix4(o.matrixWorld); return g; });
      const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
      if (!merged){ after += list.length; continue; }
      const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.matrixAutoUpdate = false;
      scene.add(mesh); for (const o of list) o.parent && o.parent.remove(o); after++;
    }
    Quality.batched = { before, after };
  } catch(e){ console.warn('batchStatic skipped', e); }
}
batchStatic();
addFlora();

function inWater(x, z){ if (!CLASSIC) return !isLand(x, z); for (const w of waters) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true; return false; }
function deckAt(x, z){ for (const d of decks) if (x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1) return d; return null; }
function groundHeight(x, z){ const d = deckAt(x, z); return d ? d.y : Math.max(0, terrainH(x, z)); }
function walkable(x, z){ if (deckAt(x, z)) return true; return Math.abs(x) < MAP_HALF && Math.abs(z) < MAP_HALF && isLand(x, z); }
function blocked(x, z, r){
  for (const c of colliders){
    if (c.t === 'b'){ if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true; }
    else if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
  }
  return false;
}

/* ================= ASSETS（外部 3D 模型：載入、快取、失敗時用程式模型代替） ================= */
// 之後換美術模型時，在這裡登記；檔案放在 models/ 資料夾（.glb）。目前還沒有外部模型。
const ASSET_MANIFEST = {
  // 例：player: { url: 'models/character.glb', scale: 1 },
};
const Assets = (() => {
  const loader = new GLTFLoader(); try { loader.setMeshoptDecoder(MeshoptDecoder); } catch(e){}
  const cache = new Map();
  function load(url){
    if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej)).catch(e => { cache.delete(url); throw e; }));
    return cache.get(url);
  }
  // 立刻回傳一個群組：先放程式模型（fallback），外部模型載好後再換上去
  function model(name, fallback, onReady){
    const holder = new THREE.Group(); const fb = fallback ? fallback() : null; if (fb) holder.add(fb);
    const entry = ASSET_MANIFEST[name]; if (!entry) return holder;
    load(entry.url).then(gltf => {
      const m = SkeletonUtils.clone(gltf.scene); if (entry.scale) m.scale.setScalar(entry.scale);
      m.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
      if (fb) holder.remove(fb); holder.add(m);
      if (onReady) onReady(m, gltf);
    }).catch(e => console.warn('model fallback:', name, e && e.message));
    return holder;
  }
  return { load, model, has: name => !!ASSET_MANIFEST[name] };
})();

// 分區：玩家靠近某區才載入／顯示那一區的東西；離開後停止更新
const Zones = [];
function addZone(name, x, z, radius, onEnter, onLeave){ Zones.push({ name, x, z, radius, inside: false, onEnter, onLeave }); }
let zoneCheckAt = 0;
function updateZones(t){
  if (t - zoneCheckAt < 0.5) return; zoneCheckAt = t;
  for (const zn of Zones){
    const inside = Math.hypot(me.pos.x - zn.x, me.pos.z - zn.z) < zn.radius;
    if (inside !== zn.inside){ zn.inside = inside; const fn = inside ? zn.onEnter : zn.onLeave; if (fn) try { fn(); } catch(e){} }
  }
}

/* ================= SEA LIFE（海裡游的風景，不能釣） ================= */
const seaLife = [];
function addSeaLife(id, scale, cx, cz, r, speed, mode, ph){ const m = fishModel(FISH_BY_ID[id], scale); scene.add(m); seaLife.push({ m, cx, cz, r, speed, mode, ph: ph || 0, prevUp: false }); }
function updateSeaLife(t){
  for (const s of seaLife){
    if (s.mode !== 'whale'){ const near = Math.hypot(me.pos.x - s.cx, me.pos.z - s.cz) < 60; s.m.visible = near; if (!near) continue; }
    const a = t * s.speed + s.ph, x = s.cx + Math.cos(a) * s.r, z = s.cz + Math.sin(a) * s.r;
    const vx = -Math.sin(a), vz = Math.cos(a); s.m.position.x = x; s.m.position.z = z; s.m.rotation.y = Math.atan2(-vz, vx);
    if (s.mode === 'jump'){
      const k = Math.sin(t * 1.1 + s.ph * 3), up = k > 0.55; const h = up ? (k - 0.55) / 0.45 : 0;
      s.m.position.y = -0.35 + Math.sin(h * Math.PI / 2) * 1.5; s.m.rotation.z = up ? Math.cos(t * 1.1 + s.ph * 3) * 1.2 : 0;
      if (up !== s.prevUp){ ripple(x, z, true); s.prevUp = up; }
    } else if (s.mode === 'glide'){ s.m.position.y = CLASSIC ? -0.02 : -0.12; s.m.rotation.z = Math.sin(t * 0.7) * 0.08; }
    else if (s.mode === 'whale'){ s.m.position.y = -1.3 + Math.max(0, Math.sin(t * 0.18 + s.ph)) * 1.1; }
  }
}

/* ================= MODELS ================= */
function makeFish(color, scale){
  const fish = new THREE.Group(); fish.scale.setScalar(scale || 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mat(color, 0.4)); body.scale.set(1.45, 0.68, 0.62);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.62, 3), mat(color, 0.55)); tail.rotation.z = Math.PI/2; tail.position.x = -0.65;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 3), mat('#fff4d2', 0.65)); fin.rotation.z = -Math.PI/2; fin.position.set(0.05, 0.3, 0);
  const eyeM = mat('#173247', 0.25);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeM); eye.position.set(0.47, 0.13, -0.23);
  const eye2 = eye.clone(); eye2.position.z = 0.23;
  fish.add(body, tail, fin, eye, eye2); fish.userData.tail = tail;
  fish.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return fish;
}

// 深藍旗魚：長嘴、高帆狀背鰭、新月尾，深藍背、銀白肚（頭朝 +x，和 makeFish 一樣）
function makeMarlin(scale){
  const fish = new THREE.Group(); fish.scale.setScalar(scale || 1);
  const dark = mat('#1f3f8f', 0.35), belly = mat('#d6dee8', 0.3), finM = new THREE.MeshStandardMaterial({ color:'#1a3478', roughness:0.5, side:THREE.DoubleSide });
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI*2, 0, Math.PI/2), dark);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2), belly);
  for (const b of [top, bot]) b.scale.set(2.05, 0.62, 0.5); // 球體上半深藍、下半銀白
  // 側面淡藍條紋
  const stripeM = mat('#8fb4e8', 0.4);
  for (let i = 0; i < 5; i++){ const st = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.43), stripeM); st.position.set(0.35 - i*0.2, 0.02, 0); st.scale.y = 1 - Math.abs(i - 1.5)*0.12; fish.add(st); }
  // 長嘴
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.95, 8), mat('#2a3550', 0.4)); bill.rotation.z = -Math.PI/2; bill.position.set(1.28, -0.03, 0);
  // 高高的帆狀背鰭
  const sail = new THREE.Shape(); sail.moveTo(0.55, 0.12); sail.lineTo(0.38, 0.78); sail.quadraticCurveTo(0.2, 0.62, -0.05, 0.42); sail.quadraticCurveTo(-0.35, 0.3, -0.62, 0.14); sail.lineTo(0.55, 0.12);
  const sailM = new THREE.Mesh(new THREE.ShapeGeometry(sail), finM);
  // 胸鰭（左右各一，細長往後下方）
  const pec = new THREE.Shape(); pec.moveTo(0, 0); pec.lineTo(-0.62, -0.32); pec.lineTo(-0.1, -0.06); pec.lineTo(0, 0);
  const pecL = new THREE.Mesh(new THREE.ShapeGeometry(pec), finM); pecL.position.set(0.5, -0.12, 0.2); pecL.rotation.y = -0.35;
  const pecR = pecL.clone(); pecR.position.z = -0.2; pecR.rotation.y = 0.35;
  // 腹鰭與小背鰭
  const small = new THREE.Shape(); small.moveTo(0, 0); small.lineTo(-0.22, -0.2); small.lineTo(-0.18, 0); small.lineTo(0, 0);
  const anal = new THREE.Mesh(new THREE.ShapeGeometry(small), finM); anal.position.set(-0.35, -0.2, 0);
  const dors2 = new THREE.Mesh(new THREE.ShapeGeometry(small), finM); dors2.position.set(-0.55, 0.13, 0); dors2.scale.y = -0.8;
  // 新月形尾巴（可擺動）
  const tail = new THREE.Group(); tail.position.x = -0.82;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.28, 8), dark); ped.rotation.z = Math.PI/2; ped.position.x = -0.08;
  const cres = new THREE.Shape(); cres.moveTo(-0.2, 0); cres.quadraticCurveTo(-0.3, 0.3, -0.62, 0.62); cres.quadraticCurveTo(-0.42, 0.22, -0.4, 0); cres.quadraticCurveTo(-0.42, -0.22, -0.62, -0.58); cres.quadraticCurveTo(-0.3, -0.28, -0.2, 0);
  const fin = new THREE.Mesh(new THREE.ShapeGeometry(cres), finM);
  tail.add(ped, fin);
  // 眼睛
  const eyeW = mat('#ffffff', 0.3), eyeB = mat('#10203a', 0.2);
  for (const z of [0.17, -0.17]){ const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeW); w.position.set(0.66, 0.06, z); const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeB); b.position.set(0.69, 0.06, z * 1.12); fish.add(w, b); }
  fish.add(top, bot, bill, sailM, pecL, pecR, anal, dors2, tail);
  fish.userData.tail = tail;
  fish.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return fish;
}

// 人物：Q 版卡通比例（大頭、圓身體、圓手腳），衣服和帽子顏色照造型設定換色
const AV_GEO = {};
function avGeo(){
  if (AV_GEO.head) return AV_GEO;
  const G = AV_GEO;
  G.head = new THREE.SphereGeometry(0.33, 22, 16);
  G.hair = new THREE.SphereGeometry(0.348, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
  G.ear = new THREE.SphereGeometry(0.065, 10, 8);
  G.eye = new THREE.SphereGeometry(0.046, 10, 8);
  G.shine = new THREE.SphereGeometry(0.015, 6, 4);
  G.blush = new THREE.CircleGeometry(0.055, 14);
  G.smile = new THREE.TorusGeometry(0.045, 0.011, 5, 12, Math.PI);
  G.torso = new THREE.CapsuleGeometry(0.25, 0.22, 6, 16);
  G.belt = new THREE.CylinderGeometry(0.262, 0.262, 0.07, 18);
  G.leg = new THREE.CapsuleGeometry(0.09, 0.2, 4, 10);
  G.shoe = new THREE.SphereGeometry(0.11, 12, 8);
  G.arm = new THREE.CapsuleGeometry(0.072, 0.24, 4, 10);
  G.hand = new THREE.SphereGeometry(0.075, 10, 8);
  G.brim = new THREE.CylinderGeometry(0.47, 0.47, 0.035, 28);
  G.crown = new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  G.band = new THREE.CylinderGeometry(0.302, 0.302, 0.06, 24);
  return G;
}
function makeAvatar(shirt, hat){
  const G = avGeo(), g = new THREE.Group();
  const skin = mat('#ffd9b8', 0.7), pants = mat('#2f4b63', 0.8), shirtM = mat(shirt, 0.75), hatM = mat(hat, 0.7), ink = mat(PALETTE.ink, 0.4);
  const hairM = mat('#5a3d2b', 0.8), shoeM = mat('#6b4a35', 0.7), white = new THREE.MeshBasicMaterial({ color:'#ffffff' });
  const blushM = new THREE.MeshBasicMaterial({ color:'#ff9a8f', transparent:true, opacity:0.55, depthWrite:false });
  const add = (geo, m, x, y, z, parent, shadow) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (shadow !== false) o.castShadow = true; (parent || g).add(o); return o; };
  // 腳：圓圓的褲管＋鞋子
  function leg(x){ const p = new THREE.Group(); p.position.set(x, 0.5, 0); g.add(p); add(G.leg, pants, 0, -0.2, 0, p); const sh = add(G.shoe, shoeM, 0, -0.43, 0.04, p); sh.scale.set(0.95, 0.6, 1.3); return p; }
  const legL = leg(-0.12), legR = leg(0.12);
  // 身體
  const body = add(G.torso, shirtM, 0, 0.8, 0); body.scale.set(1, 1, 0.86);
  const belt = add(G.belt, pants, 0, 0.56, 0); belt.scale.set(1, 1, 0.86);
  // 頭：大大的頭、頭髮、耳朵、眼睛（會眨眼）、腮紅、微笑
  const headG = new THREE.Group(); headG.position.y = 1.31; g.add(headG);
  const head = add(G.head, skin, 0, 0, 0, headG); head.scale.set(1, 0.94, 0.96);
  const hair = add(G.hair, hairM, 0, 0.01, -0.02, headG); hair.rotation.x = -0.42;
  for (const sx of [-1, 1]) add(G.ear, skin, sx * 0.315, -0.02, -0.01, headG);
  const eyes = [];
  for (const sx of [-1, 1]){
    const e = add(G.eye, ink, sx * 0.115, 0.0, 0.29, headG, false); e.scale.set(0.8, 1.15, 0.5); eyes.push(e);
    add(G.shine, white, sx * 0.115 + 0.015, 0.025, 0.315, headG, false);
    const bl = add(G.blush, blushM, sx * 0.19, -0.085, 0.262, headG, false); bl.rotation.y = sx * 0.62;
  }
  const smile = add(G.smile, ink, 0, -0.1, 0.305, headG, false); smile.rotation.z = Math.PI; smile.scale.set(1, 0.8, 1);
  // 漁夫帽
  const hatG = new THREE.Group(); hatG.position.set(0, 1.56, -0.02); hatG.rotation.x = -0.12; g.add(hatG);
  add(G.brim, hatM, 0, 0, 0, hatG);
  const crown = add(G.crown, hatM, 0, 0.0, 0, hatG); crown.scale.set(1, 0.72, 1);
  add(G.band, ink, 0, 0.035, 0, hatG, false);
  // 手：袖子＋圓圓的手
  function arm(x){ const p = new THREE.Group(); p.position.set(x, 1.0, 0); g.add(p); add(G.arm, shirtM, 0, -0.18, 0, p); add(G.hand, skin, 0, -0.4, 0, p); p.rotation.z = Math.sign(x) * 0.08; return p; }
  const armL = arm(-0.33), armR = arm(0.33);
  // 釣竿（跟原本一樣掛在右手前方）
  const rod = new THREE.Group(); rod.position.set(0.36, 0.74, 0.37);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 2.3, 6), mat('#3b2a1e', 0.5)); pole.position.y = 1.15;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), mat(PALETTE.coral)); grip.position.y = 0.05;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), mat('#c9d6e3', 0.3, { metalness:0.6 })); reel.rotation.z = Math.PI/2; reel.position.set(0.06, 0.25, 0);
  const tip = new THREE.Object3D(); tip.position.y = 2.3;
  rod.add(pole, grip, reel, tip); rod.rotation.x = 0.95; rod.visible = false; g.add(rod);
  return { g, legL, legR, armL, armR, rod, tip, pole, shirtM, hatM, eyes, headG, blinkAt: Math.random() * 4 };
}
function makeBobber(){
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI*2, 0, Math.PI/2), mat('#e8473a', 0.4));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2), mat('#ffffff', 0.4));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), mat(PALETTE.ink)); stick.position.y = 0.14;
  g.add(top, bot, stick); g.visible = false; scene.add(g); return g;
}
const LINE_PTS = 18;
function makeLine(){
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS*3), 3));
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color:'#fbf8ef', transparent:true, opacity:0.85 })); l.frustumCulled = false; l.visible = false; scene.add(l); return l;
}

// ripples
const ripples = [];
const rippleGeo = new THREE.RingGeometry(0.12, 0.17, 28); rippleGeo.rotateX(-Math.PI/2);
for (let i = 0; i < 10; i++){ const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color:'#ffffff', transparent:true, opacity:0, depthWrite:false })); m.visible = false; scene.add(m); ripples.push({ m, t:9 }); }
function ripple(x, z, big){ const r = ripples.find(r => r.t > 1.2) || ripples[0]; r.t = 0; r.big = big ? 1.8 : 1; r.m.position.set(x, waterY(x, z, now()) + 0.02, z); r.m.visible = true; }
function buildNewEnvironment(){
  // ---- 地形：一整片網格，陸地 y=0，水底與海岸有坡度 ----
  const step = Quality.tier === 'low' ? 1.5 : 1.0, half = MAP_HALF, n = Math.round(half * 2 / step);
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), rgb = [0, 0, 0], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    const x = pos.getX(i), z = pos.getZ(i), info = terrainInfo(x, z);
    pos.setY(i, info.h); terrainColor(x, z, info, rgb); c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  if (Quality.tier !== 'low') terrainMat.onBeforeCompile = sh => {   // 水底光紋（caustics）
    sh.uniforms.uT = fishTime;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uT;\nvarying vec3 vWP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float under = clamp((0.02 - vWP.y) / 0.4, 0.0, 1.0) * (1.0 - smoothstep(0.8, 2.2, -vWP.y));
      if (under > 0.0){ vec2 p = vWP.xz * 0.85;
        float cc = sin(p.x * 1.7 + uT * 1.1 + sin(p.y * 1.3 + uT * 0.8)) * sin(p.y * 1.9 - uT * 0.9 + sin(p.x * 1.1 - uT * 0.7));
        totalEmissiveRadiance += vec3(0.45, 0.62, 0.62) * pow(abs(cc), 6.0) * under * 0.55; }`);
  };
  terrainMat.customProgramCacheKey = () => 'terrain-' + (Quality.tier !== 'low');
  const terrain = new THREE.Mesh(geo, terrainMat); terrain.receiveShadow = true; terrain.userData.keep = true; scene.add(terrain);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#3f7f8f', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.05; floor.userData.keep = true; scene.add(floor);

  // ---- 水面：一整片，用遮罩決定哪裡是水；深淺漸層、波紋、反射天空、太陽閃光、岸邊浪花 ----
  const S = 360, data = new Uint8Array(S * S * 4), MH = MAP_HALF;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){
    const x = -MH + (i + 0.5) / S * MH * 2, z = -MH + (j + 0.5) / S * MH * 2, inf = terrainInfo(x, z), o = (j * S + i) * 4;
    data[o] = Math.round(clamp(-inf.h / 2, 0, 1) * 255); data[o+1] = inf.water ? 255 : 0; data[o+2] = inf.region * 60; data[o+3] = 255;
  }
  { // 區域通道模糊約 2 公尺，讓河水和海水的顏色慢慢混在一起
    const R = 6, tmp = new Float32Array(S * S);
    for (let pass = 0; pass < 2; pass++){
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ let sum = 0, cnt = 0; for (let k = -R; k <= R; k++){ const ii = pass ? i : Math.min(S - 1, Math.max(0, i + k)), jj = pass ? Math.min(S - 1, Math.max(0, j + k)) : j; sum += data[(jj * S + ii) * 4 + 2]; cnt++; } tmp[j * S + i] = sum / cnt; }
      for (let q = 0; q < S * S; q++) data[q * 4 + 2] = Math.round(tmp[q]);
    }
  }
  const mask = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter; mask.wrapS = mask.wrapT = THREE.ClampToEdgeWrapping; mask.needsUpdate = true;
  const sunDir = new THREE.Vector3(-34, 32, -48).normalize();
  const wmat = new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      uMask: { value: mask }, uTime: fishTime, uSun: { value: sunDir },
      uSkyTop: { value: new THREE.Color('#6cc4ea') }, uSkyHor: { value: new THREE.Color('#d2f1f2') },
      cSea: { value: new THREE.Color(PALETTE.sea) }, cRiver: { value: new THREE.Color(PALETTE.river) }, cCreek: { value: new THREE.Color(PALETTE.creek) }, cLake: { value: new THREE.Color('#4fb3d6') }, cPool: { value: new THREE.Color('#7fd6ec') },
      cDeep: { value: new THREE.Color('#1c5d8c') }, uFoam: { value: Quality.tier === 'low' ? 0.6 : 1.0 },
      uLight: { value: new THREE.Color(1, 1, 1) }, uGlint: { value: new THREE.Color(1.0, 0.96, 0.85) },
    }),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uMask; uniform float uTime; uniform vec3 uSun; uniform vec3 uSkyTop; uniform vec3 uSkyHor;
      uniform vec3 cSea; uniform vec3 cRiver; uniform vec3 cCreek; uniform vec3 cLake; uniform vec3 cPool; uniform vec3 cDeep; uniform float uFoam; uniform vec3 uLight; uniform vec3 uGlint;
      varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      vec3 waveN(vec2 p, float t){
        vec2 g = vec2(0.0);
        g += vec2(0.80, 0.60) * cos(dot(p, vec2(0.80, 0.60)) * 1.9 + t * 1.6) * 0.050;
        g += vec2(-0.55, 0.83) * cos(dot(p, vec2(-0.55, 0.83)) * 2.7 + t * 2.1) * 0.035;
        g += vec2(0.97, -0.24) * cos(dot(p, vec2(0.97, -0.24)) * 4.3 + t * 2.9) * 0.022;
        g += vec2(-0.20, -0.98) * cos(dot(p, vec2(-0.20, -0.98)) * 6.1 + t * 3.4) * 0.015;
        return normalize(vec3(-g.x, 1.0, -g.y));
      }
      void main(){
        vec2 uv = (vW.xz + 75.0) / 150.0;
        vec4 m = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(1.0, 1.0, 0.0, 1.0) : texture2D(uMask, uv);
        if (m.g < 0.2) discard;
        float edge = smoothstep(0.25, 0.7, m.g);
        float depth = m.r * 2.0;
        vec3 surf = mix(cSea, cRiver, smoothstep(0.06, 0.2, m.b)); surf = mix(surf, cCreek, smoothstep(0.3, 0.42, m.b)); surf = mix(surf, cLake, smoothstep(0.55, 0.66, m.b)); surf = mix(surf, cPool, smoothstep(0.8, 0.9, m.b));
        vec3 V = normalize(cameraPosition - vW);
        float far = smoothstep(25.0, 85.0, length(cameraPosition.xz - vW.xz));
        vec3 N = normalize(mix(waveN(vW.xz, uTime), vec3(0.0, 1.0, 0.0), far * 0.85));
        float fres = 0.04 + 0.6 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y * 1.4, 0.0, 1.0));
        vec3 col = mix(surf * 1.08, cDeep, smoothstep(0.35, 1.8, depth));
        col *= 0.82 + 0.25 * max(dot(N, uSun), 0.0);
        col = mix(col, sky, fres);
        col *= uLight;
        col += uGlint * pow(max(dot(R, uSun), 0.0), 180.0) * 1.6;
        float shore = 1.0 - smoothstep(0.08, 0.24, depth);
        float fn = sin(vW.x * 2.3 + uTime * 1.4 + sin(vW.z * 1.7)) * sin(vW.z * 2.1 - uTime * 1.1 + sin(vW.x * 1.3));
        float foam = shore * smoothstep(0.15, 0.75, fn * 0.5 + 0.5 + shore * 0.35) * uFoam;
        col = mix(col, uLight, foam * 0.7);
        float alpha = mix(0.58, 0.93, smoothstep(0.1, 1.2, depth));
        gl_FragColor = vec4(col, max(alpha, foam * 0.8) * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  waterSurface = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), wmat);
  waterSurface.rotation.x = -Math.PI / 2; waterSurface.position.y = WATER_LEVEL; waterSurface.renderOrder = -1; waterSurface.frustumCulled = false; waterSurface.userData.keep = true;
  scene.add(waterSurface);

  // ---- 天空：上深下淺的漸層＋太陽周圍的光暈 ----
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color('#62bfe8') }, uHor: { value: new THREE.Color('#c6ecef') }, uLow: { value: new THREE.Color('#b7e5df') }, uSun: { value: sunDir }, uSunCol: { value: new THREE.Color('#fff1c4') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uLow; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.6, y)); col = mix(col, uLow, smoothstep(0.0, -0.25, y));
        float s = max(dot(d, uSun), 0.0); col += uSunCol * (pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  skyDome.renderOrder = -10; skyDome.frustumCulled = false; skyDome.userData.keep = true; scene.add(skyDome);
}

// 樹冠、蘆葦隨風輕輕擺動
/* ---- 卡通植物的共用工具：頂點明暗漸層、InstancedMesh 專用的擺動 ---- */
function vgrad(geo, y0, y1, lo, hi, noise, tint){
  if (!geo) return new THREE.BufferGeometry();
  geo = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    let v = lo + (hi - lo) * t + (noise ? Math.sin(x * 7.1 + z * 5.3 + y * 3.7) * noise : 0);
    const c = tint ? tint(x, y, z) : [1, 1, 1];
    col[i*3] = v * c[0]; col[i*3+1] = v * c[1]; col[i*3+2] = v * c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
function mergeParts(list){
  const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; });
  return mergeGeometries(gs, false) || gs[0];   // 合併失敗時至少用第一個形狀，不讓整個遊戲壞掉
}
// 依每棵樹自己的位置錯開擺動，看起來不會整片同步
function instSway(material, amp, y0, y1, key){
  material.onBeforeCompile = sh => {
    sh.uniforms.uT = fishTime;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float sw = clamp((position.y - ${y0.toFixed(2)}) / ${(y1 - y0).toFixed(2)}, 0.0, 1.0);
      float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
      transformed.x += sin(uT * 1.3 + ph) * ${amp.toFixed(3)} * sw;
      transformed.z += cos(uT * 1.05 + ph * 1.3) * ${(amp * 0.6).toFixed(3)} * sw;
      #endif`);
  };
  material.customProgramCacheKey = () => 'isway-' + key;
}
function addSway(material, amp, y0, y1){
  if (CLASSIC) return;
  material.onBeforeCompile = sh => {
    sh.uniforms.uT = fishTime;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sw = clamp((position.y - ${y0.toFixed(2)}) / ${(y1 - y0).toFixed(2)}, 0.0, 1.0);
      transformed.x += sin(uT * 1.3 + position.x * 0.3 + position.z * 0.2) * ${amp.toFixed(3)} * sw;
      transformed.z += cos(uT * 1.1 + position.z * 0.25) * ${(amp * 0.6).toFixed(3)} * sw;`);
  };
  material.customProgramCacheKey = () => 'sway-' + amp + '-' + y0;
}

// ---- 花草、灌木、石頭、水草（數量依畫質） ----
function addFlora(){
  if (CLASSIC) return;
  const dens = Quality.tier === 'low' ? 0.35 : Quality.tier === 'mid' ? 0.65 : 1;
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const avoid = (x, z) => SPOTS.some(s => Math.hypot(x - s.pos.x, z - s.pos.z) < 3.5) || LANDMARKS.some(l => Math.hypot(x - l.pos.x, z - l.pos.z) < 3);
  const grassOK = (x, z, r) => isLand(x, z) && islandEdge(x, z) > 3.6 && !inSand(x, z) && Math.hypot(x - MAP.plaza[0], z - MAP.plaza[1]) > 8 && pathDist(x, z) > 1.3 && !blocked(x, z, r) && !deckAt(x, z) && !avoid(x, z);
  function scatter(count, test){ const out = []; let guard = 0; while (out.length < count && guard++ < count * 40){ const x = rand(-50, 50), z = rand(-50, 50); if (test(x, z)) out.push([x, z]); } return out; }
  function inst(geo, mat, pts, place, shadow){
    if (!pts.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    pts.forEach((p, i) => { place(p, dummy, c); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, c); });
    im.castShadow = !!shadow; im.receiveShadow = true; scene.add(im); return im;
  }
  // 灌木
  const bushGeo = vgrad(mergeParts([[0.56, 0, 0.04, 0, 1], [0.42, 0.42, -0.06, 0.1, 0], [0.42, -0.4, -0.05, -0.08, 0]].map(([r, x, y, z, det]) => { const g = new THREE.IcosahedronGeometry(r, det); g.scale(1, 0.85, 1); g.translate(x, y, z); return g; })), -0.4, 0.6, 0.68, 1.1, 0.04);
  inst(bushGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.9 }),
    scatter(Math.round(220 * dens), (x, z) => grassOK(x, z, 0.8)),
    ([x, z], d, col) => { const s = rand(0.7, 1.3); d.position.set(x, terrainH(x, z) + 0.22 * s, z); d.scale.set(s, s * rand(0.6, 0.85), s * rand(0.8, 1.1)); d.rotation.set(0, rand(0, 6), 0); col.set(['#6fae5c', '#86c26a', '#5d9c55'][Math.floor(Math.random() * 3)]); },
    Quality.tier === 'high');
  // 小花：五片花瓣（依顏色換色）＋黃色花心與綠色花莖
  const flowerPts = scatter(Math.round(560 * dens), (x, z) => grassOK(x, z, 0.3)).map(([x, z]) => [x, z, rand(0.8, 1.4), Math.floor(Math.random() * 5), rand(0, 6)]);
  const petalParts = [];
  for (let k = 0; k < 5; k++){ const g = new THREE.CircleGeometry(0.055, 6); g.scale(1, 0.62, 1); g.translate(0, 0.05, 0); g.rotateX(-1.05); g.rotateY(k / 5 * Math.PI * 2); g.translate(0, 0.24, 0); petalParts.push(g); }
  const petalGeo = mergeParts(petalParts); for (const k of Object.keys(petalGeo.attributes)) if (k !== 'position' && k !== 'normal') petalGeo.deleteAttribute(k);
  const stemGeo = (() => { const c = new THREE.IcosahedronGeometry(0.034, 0); c.scale(1, 0.7, 1); c.translate(0, 0.25, 0); const st = new THREE.CylinderGeometry(0.011, 0.014, 0.24, 4, 1, true); st.translate(0, 0.12, 0);
    return vgrad(mergeParts([c, st]), 0, 1, 1, 1, 0, (x, y) => y > 0.225 ? [1, 0.82, 0.35] : [0.36, 0.62, 0.3]); })();
  const flowerPlace = ([x, z, s, ci, r], d) => { d.position.set(x, terrainH(x, z), z); d.scale.setScalar(s); d.rotation.set(0, r, 0); };
  inst(petalGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }), flowerPts,
    (p, d, col) => { flowerPlace(p, d); col.set(['#ffd36a', '#f5a5d8', '#ffffff', '#f17b6d', '#b9a4ff'][p[3]]); });
  inst(stemGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.8 }), flowerPts,
    (p, d, col) => { flowerPlace(p, d); col.set('#ffffff'); });
  // 石頭（海岸、沙灘、淺水）
  inst(new THREE.DodecahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }),
    scatter(Math.round(130 * dens), (x, z) => { const e = islandEdge(x, z), h = terrainH(x, z); return !deckAt(x, z) && !avoid(x, z) && !blocked(x, z, 0.5) && ((e > -2 && e < 4) || inSand(x, z) || (h < -0.15 && h > -0.9)) && Math.hypot(x - MAP.plaza[0], z - MAP.plaza[1]) > 8 && Math.abs(x) < 52 && Math.abs(z) < 56; }),
    ([x, z], d, col) => { const s = rand(0.5, 1.4); d.position.set(x, terrainH(x, z) + 0.08 * s, z); d.scale.set(s, s * rand(0.5, 0.8), s); d.rotation.set(rand(0, 1), rand(0, 6), 0); col.set(Math.random() < 0.5 ? '#b7b2a4' : '#9d998d'); });
  // 蘆葦叢：長在岸邊（陸地邊緣或很淺的水），每叢 5 片細長葉子，會隨風擺
  const bladeGeos = [];
  for (let k = 0; k < 5; k++){ const g = new THREE.ConeGeometry(0.035, 1, 3); g.translate(0, 0.5, 0); g.rotateZ(rand(-0.25, 0.25)); g.rotateX(rand(-0.2, 0.2)); g.translate(rand(-0.12, 0.12), 0, rand(-0.12, 0.12)); g.scale(1, rand(0.6, 1), 1); bladeGeos.push(g.index ? g.toNonIndexed() : g); }
  const reedGeo = mergeGeometries(bladeGeos.map(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }));
  const reedMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide });
  reedMat.onBeforeCompile = sh => {
    sh.uniforms.uT = fishTime;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float rp = float(gl_InstanceID) * 2.1;
      transformed.x += sin(uT * 1.4 + rp) * 0.08 * position.y * position.y;
      transformed.z += cos(uT * 1.1 + rp) * 0.05 * position.y * position.y;`);
  };
  reedMat.customProgramCacheKey = () => 'reeds';
  const nearWater = (x, z) => [[1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]].some(([dx, dz]) => !isLand(x + dx, z + dz));
  if (reedGeo) inst(reedGeo, reedMat,
    scatter(Math.round(170 * dens), (x, z) => { const h = terrainH(x, z); return islandEdge(x, z) > 2 && h > -0.22 && (h < -0.02 || nearWater(x, z)) && !deckAt(x, z) && !avoid(x, z) && !blocked(x, z, 0.4); }),
    ([x, z], d, col) => { d.position.set(x, Math.max(terrainH(x, z), -0.2), z); d.scale.setScalar(rand(0.6, 1.05)); d.rotation.set(0, rand(0, 6), 0); col.set(['#5f9e58', '#7aa85c', '#8fae5a'][Math.floor(Math.random() * 3)]); });
  // 水草（會隨水搖擺）
  const weedMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  weedMat.onBeforeCompile = sh => {
    sh.uniforms.uT = fishTime;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = float(gl_InstanceID) * 1.37;
      transformed.x += sin(uT * 1.6 + ph) * 0.12 * position.y;
      transformed.z += cos(uT * 1.3 + ph) * 0.08 * position.y;`);
  };
  weedMat.customProgramCacheKey = () => 'seaweed';
  const weedGeo = new THREE.ConeGeometry(0.06, 1, 4); weedGeo.translate(0, 0.5, 0);
  inst(weedGeo, weedMat,
    scatter(Math.round(240 * dens), (x, z) => { const h = terrainH(x, z); return h < -0.3 && h > -1.5 && islandEdge(x, z) > -4 && !deckAt(x, z); }),
    ([x, z], d, col) => { const h = terrainH(x, z), len = Math.min(rand(0.5, 1.1), -h - 0.05); d.position.set(x, h, z); d.scale.set(1, len, 1); d.rotation.set(0, rand(0, 6), 0); col.set(Math.random() < 0.5 ? '#3f8f6a' : '#5aa874'); });
}

// ---- 角色腳下的柔和影子（便宜的接觸陰影） ----
const BLOB_TEX = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(24,51,74,0.55)'); g.addColorStop(1, 'rgba(24,51,74,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); return t; })();
const BLOB_GEO = new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2);
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false });

// ---- 粒子特效：稀有魚閃光、傳說魚金色光點 ----
const FX = (() => {
  const MAX = 240, geo = new THREE.BufferGeometry(), pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(30, 4, 4, 56); x.fillRect(4, 30, 56, 4);
  const mat = new THREE.PointsMaterial({ size: 0.34, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const P = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 }));
  let cur = 0, alive = 0; const cc = new THREE.Color();
  function emit(x, y, z, n, color, spread, up, life){
    cc.set(color);
    for (let k = 0; k < n; k++){ const p = P[cur]; cur = (cur + 1) % MAX; const a = Math.random() * Math.PI * 2, s = spread * (0.3 + Math.random() * 0.7);
      p.life = p.max = life * (0.6 + Math.random() * 0.6); p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = up * (0.5 + Math.random()); p.r = cc.r; p.g = cc.g; p.b = cc.b; }
    alive = MAX;
  }
  function update(dt){
    if (!alive) return; let any = 0;
    for (let i = 0; i < MAX; i++){ const p = P[i], o = i * 3;
      if (p.life > 0){ p.life -= dt; p.vy -= 2.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = Math.max(0, p.life / p.max);
        pos[o] = p.x; pos[o+1] = p.y; pos[o+2] = p.z; col[o] = p.r * k; col[o+1] = p.g * k; col[o+2] = p.b * k; any++; }
      else { pos[o+1] = -999; col[o] = col[o+1] = col[o+2] = 0; } }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; if (!any) alive = 0;
  }
  return { emit, update };
})();
let camShake = 0;
const BIG_FISH = new Set(['marlin', 'shark', 'whale', 'dolphin', 'manta', 'orca', 'beluga', 'sperm', 'sunfish', 'whaleshark']);
function rareBurst(){
  if (CLASSIC || !F.fish || F.fish.rarity === '常見') return;
  const leg = F.fish.rarity === '傳說';
  FX.emit(me.bobPos.x, 0.25, me.bobPos.z, leg ? 30 : 12, leg ? '#ffd36a' : '#9fe3ff', 1.3, 2.4, 1.0);
}
function fxReel(dt){
  if (CLASSIC || !F.fish) return;
  if ((BIG_FISH.has(F.fish.id) || F.fish.rarity === '傳說') && F.surge > 0) camShake = Math.max(camShake, 0.07 * F.fish.power);
  if (F.fish.rarity === '傳說' && Math.random() < dt * 14) FX.emit(me.bobPos.x + rand(-0.4, 0.4), 0.2, me.bobPos.z + rand(-0.4, 0.4), 1, '#ffd36a', 0.4, 1.6, 0.8);
}
function fxLand(f, at){
  if (CLASSIC) return;
  const leg = f.rarity === '傳說', rare = f.rarity === '稀有';
  FX.emit(at.x, 0.4, at.z, leg ? 70 : rare ? 28 : 8, leg ? '#ffd36a' : rare ? '#9fe3ff' : '#ffffff', leg ? 2.6 : 1.6, leg ? 4.5 : 3, leg ? 1.6 : 1.0);
  if (BIG_FISH.has(f.id) || leg){ camShake = Math.max(camShake, 0.22); ripple(at.x + 0.6, at.z, true); ripple(at.x - 0.5, at.z + 0.4, true); }
}
// 海裡的風景：兩隻海豚會跳出水面、一隻魟魚貼著水面滑行、遠方有座頭鯨
addSeaLife('dolphin', 1.3, 47, -38, 6, 0.38, 'jump', 0);
addSeaLife('dolphin', 1.1, 47, -38, 6, 0.38, 'jump', 0.5);
addSeaLife('manta', 1.8, -6, -56, 5, 0.2, 'glide', 1);
addSeaLife('whale', 7, 8, -95, 15, 0.04, 'whale', 2);
addSeaLife('orca', 2.2, 58, -48, 6, 0.3, 'jump', 1.3);
addSeaLife('orca', 1.6, 58, -48, 6, 0.3, 'jump', 1.75);
addSeaLife('sunfish', 1.4, -30, -58, 3, 0.08, 'glide', 0.4);
addSeaLife('whaleshark', 4.5, 30, -62, 8, 0.07, 'glide', 3);
addSeaLife('beluga', 1.5, -46, -50, 6, 0.2, 'jump', 2.2);

/* ================= FISHER ================= */
const labelsEl = $('#labels');
class Fisher {
  constructor(opts){
    this.av = makeAvatar(opts.shirt, opts.hat); scene.add(this.av.g);
    this.bob = makeBobber(); this.line = makeLine();
    this.pos = this.av.g.position; this.rot = 0; this.walk = 0; this.speed = 0;
    this.fishing = false; this.bobPos = new THREE.Vector3(); this.dip = 0; this.bend = 0; this.flying = null;
    this.tag = document.createElement('div'); this.tag.className = 'tag';
    this.bub = document.createElement('div'); this.bub.className = 'bub'; this.bub.hidden = true;
    this.nm = document.createElement('div'); this.nm.className = 'nm' + (opts.kind ? ' ' + opts.kind : '');
    this.nm.textContent = opts.name || '';
    this.tag.append(this.bub, this.nm); labelsEl.appendChild(this.tag);
    this.bubUntil = 0;
    if (!CLASSIC){ this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); this.blob.renderOrder = 1; scene.add(this.blob); }
  }
  setLook(shirt, hat){ this.av.shirtM.color.set(shirt); this.av.hatM.color.set(hat); }
  setRod(id){ const r = RODS.find(r => r.id === id) || RODS[0]; if (this.rodId !== r.id){ this.rodId = r.id; this.av.pole.material.color.set(r.color); } }
  setName(n){ if (this.nm.textContent !== n) this.nm.textContent = n; }
  say(text, cls, secs){ this.bub.className = 'bub' + (cls ? ' ' + cls : ''); this.bub.textContent = text; this.bub.hidden = false; this.bubUntil = now() + (secs || 5); }
  // 炫耀魚：把魚舉在頭上幾秒
  holdFish(f, w, secs){
    const a = this.av; if (this.held) a.g.remove(this.held.o);
    // 像拍釣魚紀念照一樣，雙手把魚捧在胸前
    const big = BIG_FISH.has(f.id), o = new THREE.Group(), m = fishModel(f, big ? 0.75 : 0.45);
    const y = 0.98; o.position.set(0, y, 0.48); o.add(m); a.g.add(o);
    this.held = { o, y, until: now() + (secs || 6) };
    this.say(`${f.name} ${fmtKg(w)}`, 'emote', secs || 6);
  }
  dispose(){ if (this.boatMesh) scene.remove(this.boatMesh); scene.remove(this.av.g, this.bob, this.line); if (this.blob) scene.remove(this.blob); this.tag.remove(); }
  update(dt, t){
    const a = this.av;
    this.walk += dt * this.speed * 2.2;
    const sw = Math.sin(this.walk) * Math.min(1, this.speed / 3) * 0.7;
    a.legL.rotation.x = sw; a.legR.rotation.x = -sw;
    if (this.sitting){ a.legL.rotation.x = a.legR.rotation.x = -1.45; }
    else if (this.air > 0.05){ a.legL.rotation.x = -0.55; a.legR.rotation.x = 0.35; }
    a.g.rotation.y = this.rot;
    if (a.eyes){ const bt = (t + a.blinkAt) % 4.2, sy = bt < 0.12 ? 0.12 : 1.15; a.eyes[0].scale.y = a.eyes[1].scale.y = sy; a.headG.rotation.z = Math.sin(t * 1.3 + a.blinkAt) * 0.03 * (this.speed < 0.3 ? 1 : 0); }
    a.rod.visible = this.fishing;
    if (this.fishing){
      a.armR.rotation.x = -1.0 - this.bend * 0.3; a.armL.rotation.x = -0.7 - this.bend*0.2;
      a.rod.rotation.x = 0.95 - this.bend * 0.45 + Math.sin(t*9) * this.bend * 0.04;
    } else { a.armL.rotation.x = -sw * 0.8; a.armR.rotation.x = sw * 0.8; }
    if (this.held){
      const h = this.held;
      if (now() > h.until || this.fishing){ a.g.remove(h.o); this.held = null; }
      else { a.armL.rotation.x = a.armR.rotation.x = -1.3; h.o.position.y = h.y + Math.sin(t * 4) * 0.04; h.o.rotation.z = Math.sin(t * 2.6) * 0.1; }
    }
    a.g.position.y = this.baseY + Math.abs(Math.sin(this.walk)) * Math.min(1, this.speed/3) * 0.06;
    if (this.blob){ this.blob.position.set(this.pos.x, this.baseY + 0.025, this.pos.z); this.blob.visible = a.g.visible; }
    // bobber
    const showBob = this.fishing && this.bobState !== 'none';
    this.bob.visible = showBob; this.line.visible = showBob;
    if (showBob){
      if (this.flying){
        const f = this.flying; f.t += dt / f.dur; const k = Math.min(1, f.t);
        this.bob.position.lerpVectors(f.from, f.to, k); this.bob.position.y += Math.sin(k * Math.PI) * f.h;
        if (k >= 1){ this.flying = null; this.bobState = 'water'; ripple(f.to.x, f.to.z); if (f.done) f.done(); }
      } else {
        const wy = waterY(this.bobPos.x, this.bobPos.z, t);
        this.bob.position.set(this.bobPos.x, wy - this.dip * 0.16 + Math.sin(t*3)*0.01, this.bobPos.z);
      }
      // line
      const tip = new THREE.Vector3(); a.tip.getWorldPosition(tip);
      const B = this.bob.position; const arr = this.line.geometry.attributes.position.array;
      const dist = tip.distanceTo(B); const sag = this.flying ? 0.05 : (0.35 - this.bend*0.3) * Math.min(1, dist/4);
      for (let i = 0; i < LINE_PTS; i++){ const k = i/(LINE_PTS-1); arr[i*3] = tip.x + (B.x - tip.x)*k; arr[i*3+1] = tip.y + (B.y + 0.1 - tip.y)*k - Math.sin(k*Math.PI)*sag; arr[i*3+2] = tip.z + (B.z - tip.z)*k; }
      this.line.geometry.attributes.position.needsUpdate = true;
    }
    if (!this.bub.hidden && now() > this.bubUntil) this.bub.hidden = true;
  }
  placeTag(){
    const v = tmpV.set(this.pos.x, this.pos.y + 1.95, this.pos.z);
    const d = camera.position.distanceTo(v);
    v.project(camera);
    if (v.z > 1 || d > 45){ this.tag.style.display = 'none'; return; }
    this.tag.style.display = '';
    this.tag.style.transform = `translate(${(v.x*0.5+0.5)*viewW()}px,${(-v.y*0.5+0.5)*viewH()}px) translate(-50%,-100%)`;
    this.tag.style.opacity = d > 30 ? String(clamp(1 - (d-30)/15, 0, 1)) : '1';
  }
}
Fisher.prototype.baseY = 0;
Fisher.prototype.bobState = 'none';
const tmpV = new THREE.Vector3();

/* ================= LABELS for places ================= */
const placeLabels = [];
for (const s of SPOTS){ const el = document.createElement('div'); el.className = 'lbl spot'; el.style.setProperty('--c', s.color); el.innerHTML = ''; el.textContent = s.label; const sm = document.createElement('small'); sm.textContent = '釣點'; el.appendChild(sm); labelsEl.appendChild(el); placeLabels.push({ el, p:new THREE.Vector3(s.pos.x, 2.1 + groundHeight(s.pos.x, s.pos.z), s.pos.z), spot:s }); }
for (const m of LANDMARKS){ const el = document.createElement('div'); el.className = 'lbl'; el.textContent = m.label; labelsEl.appendChild(el); placeLabels.push({ el, p:new THREE.Vector3(m.pos.x, (m.ly || 2) + groundHeight(m.pos.x, m.pos.z), m.pos.z) }); }
let topBarBottom = 60;
function measureTopBar(){ const r = document.getElementById('top').getBoundingClientRect(); topBarBottom = r.bottom; }
addEventListener('resize', () => setTimeout(measureTopBar, 150)); setTimeout(measureTopBar, 300);
function placeLabelsUpdate(){
  for (const L of placeLabels){
    const d = camera.position.distanceTo(L.p); tmpV.copy(L.p).project(camera);
    const sx = (tmpV.x*0.5+0.5)*viewW(), sy = (-tmpV.y*0.5+0.5)*viewH();
    const atSpot = L.spot && Math.hypot(me.pos.x - L.spot.pos.x, me.pos.z - L.spot.pos.z) < 4;
    if (tmpV.z > 1 || d > 55 || atSpot || sy < topBarBottom + 26){ L.el.style.display = 'none'; continue; }
    L.el.style.display = ''; L.el.style.opacity = String(clamp(1.3 - d/55, 0.25, 1));
    L.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
  }
}

/* ================= SOUND ================= */
let actx = null, soundOn = LS.get('tide.sound', true), musicOn = LS.get('tide.music', true);
function ensureAudio(){ if (!actx && (soundOn || musicOn)){ try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if (actx && actx.state === 'suspended') actx.resume(); if (actx && musicOn && typeof MUSIC !== 'undefined' && !MUSIC.playing()) MUSIC.start(); }
function tone(freq, dur, type, vol, slide){ if (!soundOn || !actx) return; const t = actx.currentTime; const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur); g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur); }
const SFX = {
  cast(){ tone(900, 0.25, 'triangle', 0.08, 300); },
  plop(){ tone(520, 0.18, 'sine', 0.18, 160); },
  bite(){ tone(880, 0.08, 'square', 0.06); setTimeout(() => tone(1100, 0.1, 'square', 0.06), 90); },
  catch(){ [523,659,784,1046].forEach((f,i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.12), i*90)); },
  fail(){ tone(300, 0.35, 'sawtooth', 0.06, 120); },
  chat(){ tone(1320, 0.06, 'sine', 0.05); },
  jump(){ tone(420, 0.12, 'sine', 0.07, 760); }
};
function renderSoundIcon(){ $('#soundIco').innerHTML = soundOn ? '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6"/>' : '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'; }
renderSoundIcon();
$('#soundBtn').addEventListener('click', () => { soundOn = !soundOn; LS.set('tide.sound', soundOn); if (soundOn) ensureAudio(); renderSoundIcon(); });

/* ================= MUSIC：程式即時演奏的海島背景音樂 ================= */
const MUSIC = (() => {
  let master = null, timer = null, next = 0, step = 0, sea = null, mel = 4, section = 0;
  const SPB = 60 / 84 / 2; // 每個八分音符的秒數（每分鐘 84 拍）
  const PROGS = [
    [[48,52,55,60],[45,48,52,57],[41,45,48,53],[43,47,50,55]],   // C  Am F  G
    [[41,45,48,53],[43,47,50,55],[48,52,55,60],[45,48,52,57]],   // F  G  C  Am
    [[48,52,55,60],[40,43,47,52],[41,45,48,53],[43,47,50,55]]    // C  Em F  G
  ];
  const PENT = [60,62,64,67,69,72,74,76,79];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function note(m, t, dur, type, vol, cut){
    const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
    o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = cut || 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function seaStart(){
    const len = actx.sampleRate * 4, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++){ b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = actx.createGain(); g.gain.value = 0.22;
    const lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.16;
    lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start(); sea = { src, lfo };
  }
  function tick(){
    if (!actx || !master) return;
    if (next < actx.currentTime - 0.1) next = actx.currentTime + 0.05; // 分頁切回來時不要一次補一大堆音
    while (next < actx.currentTime + 0.3){
      const bar = Math.floor(step / 8), beat = step % 8, t = next;
      if (beat === 0 && bar % 8 === 0) section = Math.floor(Math.random() * PROGS.length);
      const ch = PROGS[section][bar % 4];
      if (beat === 0) note(ch[0] - 12, t, SPB * 7, 'sine', 0.2, 500);
      if (beat === 4) note(ch[0] - 5, t, SPB * 3.5, 'sine', 0.1, 500);
      const arp = [0,2,1,3,2,1,3,2][beat];
      note(ch[arp] + 12, t, SPB * 2.4, 'triangle', 0.055, 2400);
      if (beat % 2 === 0 && Math.random() < (bar % 8 < 4 ? 0.55 : 0.4)){
        mel = clamp(mel + [-2,-1,-1,0,1,1,2][Math.floor(Math.random() * 7)], 0, PENT.length - 1);
        note(PENT[mel] + 12, t, SPB * (Math.random() < 0.3 ? 3.6 : 1.8), 'sine', 0.05, 3200);
      }
      next += SPB; step++;
    }
  }
  return {
    start(){ if (!actx || master) return; master = actx.createGain(); master.gain.value = 0.0001; master.connect(actx.destination); master.gain.exponentialRampToValueAtTime(0.4, actx.currentTime + 2.5); next = actx.currentTime + 0.1; seaStart(); timer = setInterval(tick, 100); },
    stop(){ if (!master) return; clearInterval(timer); const m = master, s = sea; m.gain.setTargetAtTime(0.0001, actx.currentTime, 0.25); setTimeout(() => { try { s && s.src.stop(); s && s.lfo.stop(); m.disconnect(); } catch(e){} }, 1500); master = null; sea = null; },
    playing(){ return !!master; }
  };
})();
function renderMusicIcon(){ $('#musicBtn').classList.toggle('off', !musicOn); $('#musicBtn').setAttribute('aria-pressed', String(musicOn)); }
renderMusicIcon();
$('#musicBtn').addEventListener('click', () => { musicOn = !musicOn; LS.set('tide.music', musicOn); if (musicOn){ ensureAudio(); MUSIC.start(); } else MUSIC.stop(); renderMusicIcon(); });
document.addEventListener('visibilitychange', () => { if (!actx) return; if (document.hidden) actx.suspend().catch(() => {}); else actx.resume().catch(() => {}); });

/* ================= PLAYER ================= */
const look = LS.get('tide.look', { shirt: SHIRTS[Math.floor(Math.random()*SHIRTS.length)], hat: HATS[0] });
let nickname = LS.get('tide.nick', '');
const me = new Fisher({ shirt: look.shirt, hat: look.hat, name: '你', kind: 'me' });
me.pos.set(4, 0, 9.6); me.rot = Math.PI;
const cam = { yaw: 0, pitch: 0.42, dist: 9 };

const keys = {};
const joy = { x: 0, z: 0 };
let uiBlocked = false;

addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (!$('#photoView').hidden){ if (e.key === 'Escape') closePhotoView(); return; }
  if (Photo.on){ if (e.key === 'Escape' || e.code === 'KeyP') exitPhoto(); else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat){ e.preventDefault(); takePhoto(); } else if (e.code === 'Digit1') emote('wave'); else if (e.code === 'Digit2') emote('fish'); else if (e.code === 'Digit3') emote('wow'); return; }
  if (e.code === 'KeyP' && $('#sheet').hidden && $('#catchCard').hidden){ enterPhoto(); return; }
  if (!$('#sheet').hidden || !$('#catchCard').hidden){ if (e.key === 'Escape'){ closeSheet(); closeCatch(); } if (e.key === 'Enter' && !$('#catchCard').hidden) closeCatch(); return; }
  keys[e.code] = true;
  if (e.code === 'KeyJ' && !e.repeat){ jump(); return; }
  if (e.code === 'Space' && !e.repeat && F.phase === 'idle' && !myBoat && nearestSpot().d > 1.7 && !nearShop()){ e.preventDefault(); jump(); return; }
  if (e.code === 'Space' || e.code === 'KeyF'){ e.preventDefault(); if (!e.repeat) actionDown(); }
  if (e.code === 'Enter'){ e.preventDefault(); $('#chatIn').focus(); }
  if (e.code === 'Digit1') emote('wave'); if (e.code === 'Digit2') openShowPick(); if (e.code === 'Digit3') emote('wow');
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space' || e.code === 'KeyF') actionUp(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; actionUp(); });

// camera drag
let drag = null;
const pinch = new Map(); let pinchDist = 0;
const camLimits = () => Photo.on ? { pmin: -0.12, pmax: 1.45, dmin: 2, dmax: 30 } : { pmin: 0.12, pmax: 1.15, dmin: 4.5, dmax: 18 };
canvas.addEventListener('pointerdown', e => { ensureAudio(); pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch.size === 2){ const [a, b] = [...pinch.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); drag = null; } else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch(_){} });
canvas.addEventListener('pointermove', e => { if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch.size === 2){ const [a, b] = [...pinch.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const L = camLimits(); if (pinchDist > 0) cam.dist = clamp(cam.dist * pinchDist / d, L.dmin, L.dmax); pinchDist = d; } });
['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, e => { pinch.delete(e.pointerId); if (pinch.size < 2) pinchDist = 0; }));
canvas.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; cam.yaw -= dx * 0.006; const L = camLimits(); cam.pitch = clamp(cam.pitch + dy * 0.004, L.pmin, L.pmax); });
const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => { e.preventDefault(); const L = camLimits(); cam.dist = clamp(cam.dist + e.deltaY * 0.01, L.dmin, L.dmax); }, { passive:false });

// joystick（浮動：按在左半邊哪裡，搖桿中心就在哪裡）
(function(){
  const zone = $('#joyZone'), el = $('#joy'), knob = $('.knob', el); let id = null, cx = 0, cy = 0, M = 60;
  zone.addEventListener('pointerdown', e => {
    if (id !== null) return; ensureAudio(); id = e.pointerId; try { zone.setPointerCapture(id); } catch(_){}
    const R = el.offsetWidth / 2; M = R * 0.72;
    cx = clamp(e.clientX, R + 4, innerWidth - R - 4); cy = clamp(e.clientY, R + 4, innerHeight - R - 4);
    el.style.left = (cx - R) + 'px'; el.style.top = (cy - R) + 'px'; el.style.bottom = 'auto'; el.classList.add('active');
    move(e);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; joy.x = joy.z = 0; knob.style.transform = ''; el.style.left = el.style.top = el.style.bottom = ''; el.classList.remove('active'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
  function move(e){ let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy); if (L > M){ dx *= M/L; dy *= M/L; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / M; joy.z = dy / M; }
})();

/* ================= 拍照模式 ================= */
const Photo = { on: false, saved: null, names: true, url: null, blob: null };
function enterPhoto(){
  if (Photo.on) return; ensureAudio(); closeSheet();
  Photo.on = true; Photo.saved = { ...cam }; uiBlocked = true; for (const k in keys) keys[k] = false; joy.x = joy.z = 0;
  document.body.classList.add('photo'); document.body.classList.toggle('nonames', !Photo.names); $('#photoUI').hidden = false;
}
function exitPhoto(){
  if (!Photo.on) return; Photo.on = false;
  if (Photo.saved){ cam.dist = clamp(cam.dist, 4.5, 18); cam.pitch = clamp(cam.pitch, 0.12, 1.15); }
  document.body.classList.remove('photo', 'nonames'); $('#photoUI').hidden = true; uiBlocked = !$('#sheet').hidden || !$('#catchCard').hidden;
}
function stamp(){ const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
function takePhoto(){
  // 先畫一格，再立刻把畫面複製下來（不用保留繪圖緩衝，手機比較省）
  renderer.render(scene, camera);
  const src = renderer.domElement, W = src.width, H = src.height;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');
  ctx.drawImage(src, 0, 0);
  // 右下角浮水印
  const fs = Math.round(H * 0.032), pad = Math.round(H * 0.025), d = new Date();
  ctx.font = `${fs}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  const text = `潮汐釣魚村・${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  ctx.fillStyle = 'rgba(24,51,74,.35)'; ctx.fillText(text, W - pad + 2, H - pad + 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(text, W - pad, H - pad);
  const fx = $('#flashFx'); fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
  if (soundOn && actx){ const t = actx.currentTime, b = actx.createBuffer(1, actx.sampleRate * 0.08, actx.sampleRate), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length); const n = actx.createBufferSource(), g = actx.createGain(); n.buffer = b; g.gain.value = 0.25; n.connect(g).connect(actx.destination); n.start(t); }
  out.toBlob(blob => {
    if (!blob) return; if (Photo.url) URL.revokeObjectURL(Photo.url);
    Photo.blob = blob; Photo.url = URL.createObjectURL(blob); $('#photoImg').src = Photo.url;
    const file = new File([blob], `潮汐釣魚村-${stamp()}.jpg`, { type: 'image/jpeg' }); Photo.file = file;
    $('#pShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('#photoView').hidden = false;
  }, 'image/jpeg', 0.92);
}
function closePhotoView(){ $('#photoView').hidden = true; }
$('#photoBtn').addEventListener('click', enterPhoto);
$('#pExit').addEventListener('click', exitPhoto);
$('#shutter').addEventListener('click', takePhoto);
$('#pNames').addEventListener('click', () => { Photo.names = !Photo.names; $('#pNames').classList.toggle('on', Photo.names); document.body.classList.toggle('nonames', !Photo.names); });
$('#pSelfie').addEventListener('click', () => {   // 在正前方和背後之間切換
  const front = me.rot, back = me.rot + Math.PI, d = a => Math.abs(Math.atan2(Math.sin(a - cam.yaw), Math.cos(a - cam.yaw)));
  cam.yaw = d(front) < d(back) ? back : front; if (cam.dist > 6) cam.dist = 4; cam.pitch = Math.min(cam.pitch, 0.35);
});
$$('#photoUI [data-pemote]').forEach(b => b.addEventListener('click', () => emote(b.dataset.pemote)));
$('#pSave').addEventListener('click', () => { if (!Photo.url) return; const a = document.createElement('a'); a.href = Photo.url; a.download = Photo.file ? Photo.file.name : 'photo.jpg'; document.body.appendChild(a); a.click(); a.remove(); toast('照片已存到「下載」資料夾。'); });
$('#pShare').addEventListener('click', async () => { try { await navigator.share({ files: [Photo.file], title: '潮汐釣魚村', text: '我在潮汐釣魚村拍的照片！' }); } catch(e){} });
$('#pAgain').addEventListener('click', closePhotoView);
$('#photoView').addEventListener('click', e => { if (e.target.id === 'photoView') closePhotoView(); });


/* ================= 小船 ================= */
const boats = BOAT_DOCKS.map(d => { const m = makeBoatMesh('#c98b55'); m.position.set(d.x, WATER_LEVEL, d.z); m.rotation.y = d.rot; scene.add(m); return { dock: d, m }; });
let myBoat = null;
function nearBoat(){ for (const b of boats){ if (b === myBoat) continue; if (Math.hypot(me.pos.x - b.m.position.x, me.pos.z - b.m.position.z) < 3.4) return b; } return null; }
function boatWater(x, z){ if (Math.abs(x) > 85 || Math.abs(z) > 85) return false; const i = terrainInfo(x, z); return i.water && i.h < -0.3 && !deckAt(x, z); }
function boardBoat(b){
  if (F.phase !== 'idle') cancelFishing();
  myBoat = b; me.pos.x = b.m.position.x; me.pos.z = b.m.position.z; me.rot = b.m.rotation.y; me.sitting = true; cam.yaw = me.rot + Math.PI;
  toast('上船了！用搖桿划船，在水上任何地方都可以拋竿。'); pushPresence(true);
}
function leaveBoat(){
  if (!myBoat) return;
  let best = null;
  for (let r = 1.2; r <= 3.6 && !best; r += 0.6) for (let k = 0; k < 16; k++){ const a = k / 16 * Math.PI * 2, x = me.pos.x + Math.cos(a) * r, z = me.pos.z + Math.sin(a) * r; if (walkable(x, z) && !blocked(x, z, 0.35)){ best = [x, z]; break; } }
  if (!best){ toast('要靠近岸邊或碼頭才能下船。'); return; }
  if (F.phase !== 'idle') cancelFishing();
  const b = myBoat; myBoat = null; me.sitting = false; me.pos.x = best[0]; me.pos.z = best[1];
  b.m.position.set(b.dock.x, WATER_LEVEL, b.dock.z); b.m.rotation.set(0, b.dock.rot, 0);   // 小船自己划回碼頭
  pushPresence(true);
}
// 在船上拋竿：依所在的水域決定會釣到哪些魚
function boatSpot(){
  const i = terrainInfo(me.pos.x, me.pos.z);
  const id = i.region === 1 ? 'river' : i.region === 2 ? 'creek' : i.region === 3 ? 'lake' : i.region === 4 ? 'pool' : (islandEdge(me.pos.x, me.pos.z) < -6 ? 'harbor' : 'sea');
  return Object.assign({}, SPOT_BY_ID[id], { pos: me.pos.clone(), dir: new THREE.Vector2(Math.sin(me.rot), Math.cos(me.rot)) });
}
function updateBoat(dt, ix, iz, L, locked){
  let speed = 0; const t = now();
  if (L > 0.08 && !locked){
    if (F.phase !== 'idle') cancelFishing('收竿了');
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix, ml = Math.max(1e-6, Math.hypot(mx, mz));
    speed = 4.2 * Math.min(1, L);
    const nx = me.pos.x + mx / ml * speed * dt, nz = me.pos.z + mz / ml * speed * dt;
    if (boatWater(nx, me.pos.z)) me.pos.x = nx;
    if (boatWater(me.pos.x, nz)) me.pos.z = nz;
    me.rot = lerpAngle(me.rot, Math.atan2(mx, mz), 1 - Math.exp(-5 * dt));
    if (Math.random() < dt * 4) ripple(me.pos.x - Math.sin(me.rot) * 1.3, me.pos.z - Math.cos(me.rot) * 1.3);
  }
  me.speed = 0;
  const bob = Math.sin(t * 1.6) * 0.04;
  me.baseY = WATER_LEVEL - 0.08 + bob;
  myBoat.m.position.set(me.pos.x, WATER_LEVEL + bob, me.pos.z); myBoat.m.rotation.set(Math.sin(t * 1.1) * 0.02, me.rot, Math.sin(t * 1.3) * 0.03);
  const oar = myBoat.m.userData.oars; if (oar){ const k = speed > 0.3 ? Math.sin(t * 6) * 0.6 : 0; oar[0].rotation.y = k; oar[1].rotation.y = -k; }
}
$('#boatBtn').addEventListener('click', () => { ensureAudio(); if (myBoat) leaveBoat(); else { const b = nearBoat(); if (b) boardBoat(b); } });
function updateBoatButton(){
  const btn = $('#boatBtn'); let label = '';
  if (myBoat){ if (F.phase === 'idle') label = '下船'; }
  else if (F.phase === 'idle' && nearBoat()) label = '上船';
  btn.hidden = !label; if (label && btn.textContent !== label) btn.textContent = label;
}

/* ================= 快速傳送與地圖 ================= */
const visited = new Set(LS.get('tide.visited', ['plaza']));
let discoverAt = 0;
function discover(t){
  if (t - discoverAt < 0.5) return; discoverAt = t;
  for (const tp of TRAVEL){
    if (!visited.has(tp.id) && Math.hypot(me.pos.x - tp.x, me.pos.z - tp.z) < 7){
      visited.add(tp.id); LS.set('tide.visited', [...visited]);
      toast(`發現新地點：<b>${esc(tp.label)}</b><br>以後可以從「地圖」直接傳送過來`);
    }
  }
}
function travelTo(tp){
  closeSheet(); if (Photo.on) exitPhoto();
  if (myBoat){ const b = myBoat; myBoat = null; me.sitting = false; b.m.position.set(b.dock.x, WATER_LEVEL, b.dock.z); b.m.rotation.set(0, b.dock.rot, 0); }
  if (F.phase !== 'idle') cancelFishing();
  const fx = $('#fadeFx'); fx.classList.add('on');
  setTimeout(() => {
    me.pos.x = tp.x; me.pos.z = tp.z; me.baseY = groundHeight(tp.x, tp.z); me.rot = tp.rot; cam.yaw = tp.rot + Math.PI;
    const cp = Math.cos(cam.pitch); camera.position.set(tp.x + Math.sin(cam.yaw) * cp * cam.dist, me.baseY + 1.3 + Math.sin(cam.pitch) * cam.dist, tp.z + Math.cos(cam.yaw) * cp * cam.dist);
    pushPresence(true); setTimeout(() => fx.classList.remove('on'), 80);
  }, 280);
}
let mapImg = null;
const MAP_VIEW = 58;   // 地圖顯示 -58..58 公尺
function getMapImage(){
  if (mapImg) return mapImg;
  const N = 232, cv = document.createElement('canvas'); cv.width = cv.height = N; const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), c = [0, 0, 0];
  const wc = { 0: [47, 137, 199], 1: [79, 194, 207], 2: [107, 214, 176], 3: [79, 184, 212], 4: [127, 211, 234] };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const x = -MAP_VIEW + (i + 0.5) / N * MAP_VIEW * 2, z = -MAP_VIEW + (j + 0.5) / N * MAP_VIEW * 2, info = terrainInfo(x, z), o = (j * N + i) * 4;
    let r, g, b;
    if (info.water){ const w = wc[info.region], k = 1 - Math.min(0.35, -info.h * 0.18); r = w[0] * k; g = w[1] * k; b = w[2] * k; }
    else { terrainColor(x, z, info, c); const sh = info.h > 0.05 ? clamp(0.95 + (terrainH(x + 0.6, z - 0.6) - info.h) * 0.5, 0.8, 1.1) : 1; r = c[0] * 255 * sh; g = c[1] * 255 * sh; b = c[2] * 255 * sh; }
    img.data[o] = r; img.data[o+1] = g; img.data[o+2] = b; img.data[o+3] = 255;
  }
  ctx.putImageData(img, 0, 0); return (mapImg = cv);
}
function renderMap(body){
  body.appendChild(el('p', 'sub', '走到新的地點就會解鎖。點地圖上的地點，或下面的按鈕，就能直接傳送過去。'));
  const wrap = el('div', 'mapwrap'); const cv = el('canvas', 'mapcv'); const S = 480; cv.width = cv.height = S; wrap.appendChild(cv); body.appendChild(wrap);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(getMapImage(), 0, 0, S, S);
  const toPx = (x, z) => [(x + MAP_VIEW) / (MAP_VIEW * 2) * S, (z + MAP_VIEW) / (MAP_VIEW * 2) * S];
  ctx.font = `bold 15px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center';
  for (const tp of TRAVEL){
    const [px, py] = toPx(tp.x, tp.z), on = visited.has(tp.id);
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fillStyle = on ? tp.color : '#9fb3bf'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    const label = on ? tp.label : '？？？'; const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(24,51,74,.8)'; ctx.fillRect(px - w / 2, py - 32, w, 20); ctx.fillStyle = '#fff'; ctx.fillText(label, px, py - 17);
  }
  const [mx, my] = toPx(me.pos.x, me.pos.z);   // 你在這裡
  ctx.save(); ctx.translate(mx, my); ctx.rotate(-me.rot + Math.PI); ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fillStyle = PALETTE.coral; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S, y = (e.clientY - r.top) / r.height * S;
    let best = null, bd = 30; for (const tp of TRAVEL){ const [px, py] = toPx(tp.x, tp.z), d = Math.hypot(px - x, py - y); if (d < bd){ bd = d; best = tp; } }
    if (!best) return; if (visited.has(best.id)) travelTo(best); else toast('還沒去過這裡，先走過去一次就能解鎖。');
  });
  const list = el('div', 'tplist');
  for (const tp of TRAVEL){ const on = visited.has(tp.id); const b = el('button', 'tpbtn' + (on ? '' : ' lock'), on ? tp.label : '？？？（還沒去過）'); b.disabled = !on; b.addEventListener('click', () => travelTo(tp)); list.appendChild(b); }
  body.appendChild(list);
}

function nearestSpot(){ let best = null, bd = 1e9; for (const s of SPOTS){ const d = Math.hypot(me.pos.x - s.pos.x, me.pos.z - s.pos.z); if (d < bd){ bd = d; best = s; } } return { spot: best, d: bd }; }

function updatePlayer(dt){
  let ix = 0, iz = 0;
  if (!uiBlocked){
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += joy.x; iz += joy.z;
  }
  const L = Math.hypot(ix, iz); if (L > 1){ ix /= L; iz /= L; }
  const locked = F.phase === 'bite' || F.phase === 'reeling' || F.phase === 'landing';
  if (myBoat){ updateBoat(dt, ix, iz, L, locked); return; }
  let speed = 0;
  if (L > 0.08 && !locked){
    if (F.phase !== 'idle') cancelFishing('收竿了');
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix;
    const run = keys.ShiftLeft || keys.ShiftRight || L > 0.95;
    speed = (run ? 6.2 : 4.2) * Math.min(1, L) * (Jump.air > 0 ? 1.1 : 1);
    const nx = me.pos.x + mx / Math.max(1e-6, Math.hypot(mx, mz)) * speed * dt;
    const nz = me.pos.z + mz / Math.max(1e-6, Math.hypot(mx, mz)) * speed * dt;
    // 可以走上山坡，但太陡的崖爬不上去
    // 跳在空中時，只要腳比前面的地面高，就能跳上去
    const okStep = (ax, az, bx, bz) => { if (!walkable(bx, bz) || blocked(bx, bz, 0.35)) return false; if (deckAt(bx, bz)) return true; const gb = groundHeight(bx, bz); if (Jump.air > 0.05 && gb <= Jump.gy + Jump.air + 0.1) return true; const dh = gb - groundHeight(ax, az), dl = Math.hypot(bx - ax, bz - az) || 1e-3; return dh / dl < 1.2; };
    if (okStep(me.pos.x, me.pos.z, nx, me.pos.z)) me.pos.x = nx;
    if (okStep(me.pos.x, me.pos.z, me.pos.x, nz)) me.pos.z = nz;
    const target = Math.atan2(mx, mz);
    me.rot = lerpAngle(me.rot, target, 1 - Math.exp(-14 * dt));
  }
  me.speed += (speed - me.speed) * Math.min(1, dt * 12);
  const gy = groundHeight(me.pos.x, me.pos.z);
  if (Math.abs(gy - Jump.gy) > 1.5 && Jump.air <= 0) Jump.gy = gy; else Jump.gy += (gy - Jump.gy) * Math.min(1, dt * 14);
  if (Jump.vy !== 0 || Jump.air > 0){
    Jump.vy -= 24 * dt; Jump.air += Jump.vy * dt;
    if (Jump.air <= 0){ Jump.air = 0; Jump.vy = 0; Jump.land = 0.18; puff(me.pos.x, Jump.gy, me.pos.z); }
  }
  if (Jump.land > 0) Jump.land -= dt;
  me.air = Jump.air; me.baseY = Jump.gy + Jump.air;
}
/* ---- 跳躍 ---- */
const Jump = { vy:0, air:0, gy:0, land:0 };
function canJump(){ return !uiBlocked && !myBoat && !Photo.on && F.phase === 'idle' && Jump.air <= 0 && Jump.land <= 0.05; }
function jump(){
  if (!canJump()) return;
  ensureAudio();
  Jump.gy = me.baseY; Jump.vy = 7.6; Jump.air = 0.001;
  SFX.jump(); pushPresence(true);
}
function puff(x, y, z){ FX.emit(x, y + 0.05, z, 8, '#f3ead2', 0.6, 0.8, 0.45); }
function lerpAngle(a, b, k){ let d = ((b - a + Math.PI) % (Math.PI*2)); if (d < 0) d += Math.PI*2; return a + (d - Math.PI) * k; }

function updateCamera(dt){
  const target = tmpV.set(me.pos.x, me.pos.y + 1.3, me.pos.z);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const want = new THREE.Vector3(target.x + Math.sin(cam.yaw)*cp*cam.dist, target.y + sp*cam.dist, target.z + Math.cos(cam.yaw)*cp*cam.dist);
  want.y = Math.max(want.y, Photo.on ? 0.3 : 0.8);
  camera.position.lerp(want, 1 - Math.exp(-10 * dt));
  camera.lookAt(target);
  if (camShake > 0.002){ camera.position.x += (Math.random() - 0.5) * camShake; camera.position.y += (Math.random() - 0.5) * camShake; camShake *= Math.pow(0.03, dt); }
}

/* ================= FISHING ================= */
const F = { phase:'idle', spot:null, charge:0, chargeT:0, waitUntil:0, nibbleAt:0, biteUntil:0, fish:null, weight:0, T:0.3, P:0.3, hold:false, surge:0, seed:0, castCharge:0 };
const bigMsg = $('#bigMsg');
let bigTimer = 0;
function flash(text, secs){ bigMsg.textContent = text; bigMsg.hidden = false; bigMsg.classList.remove('pop'); void bigMsg.offsetWidth; bigMsg.classList.add('pop'); clearTimeout(bigTimer); bigTimer = setTimeout(() => bigMsg.hidden = true, (secs || 1.2) * 1000); }

function actionDown(){
  if (uiBlocked) return;
  ensureAudio();
  const act = $('#act'); act.classList.add('down');
  if (F.phase === 'idle'){
    let spot;
    if (myBoat) spot = boatSpot(); else { const ns = nearestSpot(); if (ns.d > 1.7){ const sh = nearShop(); if (sh){ act.classList.remove('down'); openShop(sh); } return; } spot = ns.spot; }
    F.spot = spot; F.phase = 'charging'; F.chargeT = 0;
    me.rot = Math.atan2(spot.dir.x, spot.dir.y); me.fishing = true; me.bobState = 'none';
  } else if (F.phase === 'waiting'){
    cancelFishing('收竿了');
  } else if (F.phase === 'bite'){
    startReel(); F.hold = true;
  } else if (F.phase === 'reeling'){
    F.hold = true;
  }
}
function actionUp(){
  $('#act').classList.remove('down');
  if (F.phase === 'charging') doCast();
  else if (F.phase === 'reeling') F.hold = false;
}
function doCast(){
  const s = F.spot; const c = F.charge; F.castCharge = c;
  // 用掉一個魚餌
  const bt = curBait(); F.baitUsed = bt;
  if (bt){ cloudCall('use_bait', { p_bait: bt.id }); rec.bait[bt.id]--; if (rec.bait[bt.id] <= 0){ delete rec.bait[bt.id]; rec.baitOn = null; toast(`${bt.name}用完了，換回普通魚餌`); } saveRecLocal(); }
  const dist = 3 + c * 4.5;
  const cp = castPoint(s.pos.x, s.pos.z, s.dir.x, s.dir.y, dist);
  const to = new THREE.Vector3(cp[0] + rand(-0.3,0.3), 0.12, cp[1] + rand(-0.3,0.3));
  const from = new THREE.Vector3(); me.av.tip.getWorldPosition(from);
  me.bobPos.copy(to); me.bobState = 'fly';
  me.flying = { from, to, t:0, dur: 0.55 + c*0.25, h: 1.4 + c*1.4, done(){ SFX.plop(); } };
  F.phase = 'waiting'; F.waitUntil = now() + 0.8 + rand(2.4, 6.5) - c * 0.8; F.nibbleAt = now() + 1.2 + Math.random()*1.5;
  SFX.cast(); pushPresence(true);
}
function cancelFishing(msg){
  F.phase = 'idle'; F.hold = false; me.fishing = false; me.bobState = 'none'; me.flying = null; me.dip = 0; me.bend = 0;
  if (msg && msg !== '收竿了') flash(msg);
  pushPresence(true);
}
function pickFish(spot, charge){
  const list = (spot.fish || []).map(id => FISH_BY_ID[id]).filter(Boolean);
  const rod = curRod(), bait = F.baitUsed || null;   // 釣竿和這次拋竿用的魚餌會提高稀有魚機率
  const kr = rod.rare * (bait ? bait.rare : 1), kl = rod.legend * (bait ? bait.legend : 1);
  const per = periodOf(gameHour());   // 有些魚只在特定時段常出現
  const w = list.map(f => (f.w || 1) * (f.time ? (f.time === per ? 1.5 : 0.15) : 1) * (f.rarity === '常見' ? 1 : f.rarity === '稀有' ? 0.34 * (1 + charge*0.8) * kr : 0.07 * (1 + charge*1.6) * (spot.legendBoost || 1) * kl));
  let r = Math.random() * w.reduce((a,b) => a+b, 0);
  for (let i = 0; i < list.length; i++){ r -= w[i]; if (r <= 0) return list[i]; }
  return list[0];
}
function startReel(){
  F.phase = 'reeling'; F.T = 0.35; F.P = 0.3; F.surge = 0; F.seed = Math.random()*10;
  me.say('!', 'alert', 0.6);
  $('#fhName').textContent = F.fish.rarity === '傳說' ? '超大的拉力！' : F.fish.rarity === '稀有' ? '好重的手感！' : '有魚上鉤了！';
  pushPresence(true);
}
function updateFishing(dt, t){
  const act = $('#act');
  if (F.phase === 'charging'){
    F.chargeT += dt; F.charge = 1 - Math.abs(((F.chargeT / 1.3) % 2) - 1);
    $('#chargeFill').style.width = (F.charge*100).toFixed(1) + '%';
    me.bend = F.charge * 1.5;
  }
  if (F.phase === 'waiting' && !me.flying){
    me.bend *= 0.9;
    if (t > F.nibbleAt && t < F.waitUntil - 0.6){ me.dip = 0.35; ripple(me.bobPos.x, me.bobPos.z); F.nibbleAt = t + 0.9 + Math.random()*1.6; }
    me.dip *= Math.pow(0.02, dt);
    if (t > F.waitUntil){
      F.fish = pickFish(F.spot, F.castCharge); F.weight = +(F.fish.min + (F.fish.max - F.fish.min) * Math.pow(Math.random(), 1.7)).toFixed(2);
      rareBurst(); F.phase = 'bite'; F.biteUntil = t + (F.fish.rarity === '傳說' ? 0.8 : F.fish.rarity === '稀有' ? 0.95 : 1.15);
      me.say('!', 'alert', 1); SFX.bite(); ripple(me.bobPos.x, me.bobPos.z, true); pushPresence(true);
    }
  }
  if (F.phase === 'bite'){
    me.dip = 0.9 + Math.sin(t*30)*0.1;
    if (t > F.biteUntil){ me.dip = 0; F.phase = 'waiting'; F.waitUntil = t + rand(2.5, 5.5); F.nibbleAt = t + 1; flash('魚跑掉了', 1); SFX.fail(); pushPresence(true); }
  }
  if (F.phase === 'reeling'){
    const p = F.fish.power;
    let pull = p * (0.55 + 0.45 * Math.sin(t*2.3 + F.seed) * Math.sin(t*0.7 + F.seed*2));
    if (F.surge > 0){ F.surge -= dt; pull += 0.55 * p; } else if (Math.random() < dt * 0.3 * p){ F.surge = rand(0.4, 0.9); }
    const inZone = F.T > 0.35 && F.T < 0.8;
    const rod = curRod();
    if (F.hold){ F.T += (0.42 + pull*0.9) * dt * rod.tension; F.P += (0.26 + (inZone ? 0.1 : 0)) * (1.15 - p*0.35) * dt * rod.reel; }
    else { F.T -= 0.75 * dt; F.T += pull * 0.12 * dt; F.P -= (0.03 + pull*0.03) * dt; }
    F.T = Math.max(0, F.T);
    me.bend = clamp(F.T, 0, 1); me.dip = 0.5 + pull*0.4; fxReel(dt);
    // bobber drifts toward player with progress
    const s = F.spot; const dist = 1.4 + (1 - F.P) * (2 + F.castCharge*4.5);
    const tx = s.pos.x + s.dir.x*dist + Math.sin(t*3 + F.seed)*0.5*(1-F.P), tz = s.pos.z + s.dir.y*dist + Math.cos(t*2.4)*0.5*(1-F.P);
    me.bobPos.x += (tx - me.bobPos.x) * Math.min(1, dt*3); me.bobPos.z += (tz - me.bobPos.z) * Math.min(1, dt*3);
    if (Math.random() < dt * 4) ripple(me.bobPos.x, me.bobPos.z);
    $('#tFill').style.width = (clamp(F.T,0,1)*100).toFixed(1) + '%';
    $('#tBar').classList.toggle('hot', F.T > 0.8);
    $('#fhT').textContent = F.T > 0.8 ? '線快斷了！放開！' : F.T < 0.35 ? '太鬆了，按住拉' : '很好，保持住';
    $('#pFill').style.width = (clamp(F.P,0,1)*100).toFixed(1) + '%';
    $('#fhP').textContent = Math.round(clamp(F.P,0,1)*100) + '%';
    if (F.T >= 1){ SFX.fail(); flash('線斷了！', 1.4); cancelFishing(); }
    else if (F.P <= 0){ SFX.fail(); flash('魚掙脫了', 1.4); cancelFishing(); }
    else if (F.P >= 1){ landFish(); }
  }
  // HUD + button
  $('#chargeHud').hidden = F.phase !== 'charging';
  $('#fishHud').hidden = F.phase !== 'reeling';
  let label, sub = '', cls = '';
  const near = myBoat ? { spot: boatSpot(), d: 0 } : nearestSpot();
  if (F.phase === 'idle'){ const bt = curBait(); const sh = near.d >= 1.7 ? nearShop() : null;
    if (near.d < 1.7){ label = '拋竿'; sub = bt ? `${bt.name} ×${rec.bait[bt.id]}` : isTouch ? '按住蓄力' : '按住空白鍵'; }
    else if (sh){ label = sh.label; sub = sh.mode === 'sell' ? '賣魚' : '買釣具'; cls = 'shop'; }
    else { label = '走到釣點'; cls = 'idle'; } }
  else if (F.phase === 'charging'){ label = '放開'; sub = '拋出去'; }
  else if (F.phase === 'waiting'){ label = '等待中'; sub = '點一下收竿'; cls = 'idle'; }
  else if (F.phase === 'bite'){ label = '提竿！'; cls = 'bite'; }
  else if (F.phase === 'reeling'){ label = '拉線'; sub = '按住 / 放開'; }
  else { label = '…'; cls = 'idle'; }
  const html = label + (sub ? `<small>${sub}</small>` : '');
  if (act._h !== html){ act.innerHTML = html; act._h = html; }
  const c = 'act-' + cls; if (act._c !== c){ act.classList.remove('idle','bite'); if (cls) act.classList.add(cls); act._c = c; }
  // spot card
  const card = $('#spotCard');
  const showCard = near.d < 3.2 && F.phase !== 'reeling' && F.phase !== 'charging';
  if (showCard && card._s !== near.spot.id){
    card._s = near.spot.id; $('.t', card).textContent = near.spot.label; $('.s', card).textContent = near.spot.subtitle;
    const fl = $('.fl', card); fl.textContent = '';
    near.spot.fish.map(id => FISH_BY_ID[id]).forEach(f => { const c = document.createElement('span'); const known = rec.count[f.id] > 0; c.className = 'chip r-' + f.rarity; c.textContent = (known ? f.name : '？？？') + '・' + f.rarity; fl.appendChild(c); });
  }
  if (!showCard) card._s = null;
  card.hidden = !showCard;
}
function landFish(){
  F.phase = 'landing'; F.hold = false; me.bobState = 'none'; me.dip = 0; me.bend = 0.2;
  const f = F.fish, w = F.weight;
  const from = me.bobPos.clone(); from.y = 0.1;
  const fm = fishModel(f, clamp(0.5 + Math.log(1 + w) * 0.35, 0.5, 1.8)); fm.position.copy(from); scene.add(fm);
  const to = new THREE.Vector3(me.pos.x, me.pos.y + 2.4, me.pos.z);
  jumpers.push({ m: fm, from, to, t: 0 });
  ripple(from.x, from.z, true); SFX.catch(); fxLand(f, from);
  setTimeout(() => { me.fishing = false; F.phase = 'result'; const res = recordCatch(f, w); showCatch(f, w, res); announceCatch(f, w, F.spot.id); pushPresence(true); me.holdFish(f, w, 5); }, 900);
}
const jumpers = [];
function updateJumpers(dt, t){
  for (let i = jumpers.length - 1; i >= 0; i--){
    const j = jumpers[i]; j.t += dt;
    const k = Math.min(1, j.t / 0.9);
    j.m.position.lerpVectors(j.from, j.to, k); j.m.position.y += Math.sin(k*Math.PI) * 1.6;
    j.m.rotation.z = Math.sin(t*14) * 0.4; j.m.rotation.y += dt * 4;
    if (j.t > 2.6){ scene.remove(j.m); jumpers.splice(i, 1); }
  }
}

/* ================= RECORDS / COLLECTION ================= */
/* ================= ECONOMY：金幣、賣魚、釣竿與魚餌 ================= */
// 目前存在玩家自己的瀏覽器；之後接上伺服器時，賣魚和購買要改由伺服器驗證
const RODS = [
  { id:'bamboo', name:'竹釣竿',     price:0,    color:'#3b2a1e', desc:'村裡人人都有的入門竿，輕巧好用。', tension:1, reel:1, rare:1, legend:1 },
  { id:'carbon', name:'碳纖維釣竿', price:400,  color:'#2f6fb5', desc:'線比較不容易繃斷、收線快一點，稀有魚機率 ×1.2。', tension:0.85, reel:1.12, rare:1.2, legend:1.1 },
  { id:'deep',   name:'深海巨物竿', price:2500, color:'#c9302c', desc:'對付大型魚的專用竿：拉力大減、收線更快，傳說魚機率 ×1.4。', tension:0.72, reel:1.22, rare:1.3, legend:1.4 },
];
const BAITS = [
  { id:'glow', name:'亮光餌', price:60,  pack:5, desc:'會發光的小蝦，稀有魚機率 ×1.8。', rare:1.8, legend:1.2 },
  { id:'gold', name:'黃金餌', price:300, pack:3, desc:'傳說中的金色魚餌，傳說魚機率 ×3。', rare:1.3, legend:3 },
];
const SELL_BASE = { '常見':10, '稀有':60, '傳說':400 };
function fishPrice(f, w){ const rel = clamp((w - f.min) / Math.max(0.01, f.max - f.min), 0, 1); return Math.round(SELL_BASE[f.rarity] * (1 + 1.5 * rel)); }
function curRod(){ return RODS.find(r => r.id === rec.rod) || RODS[0]; }
function curBait(){ const b = BAITS.find(b => b.id === rec.baitOn); return b && (rec.bait[b.id] || 0) > 0 ? b : null; }
function renderCoins(){ const t = $('#coinTxt'); if (t) t.textContent = rec.coins.toLocaleString(); }
function addCoins(n){ rec.coins = Math.max(0, rec.coins + n); saveRecLocal(); renderCoins(); const c = $('#coins'); if (c){ c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
function sellFish(ts, batch){
  const i = rec.tank.findIndex(x => x.t === ts); if (i < 0) return 0;
  const x = rec.tank[i], f = FISH_BY_ID[x.f], price = fishPrice(f, x.w);
  rec.tank.splice(i, 1); if (rec.show) rec.show = rec.show.filter(t => t !== ts);
  rec.sold++; rec.earned += price; addCoins(price);
  if (!batch) cloudCall('sell_fish', { p_ts: [ts] });
  return price;
}
const SHOPS = [ { id:'tackle', label:'釣具店', mode:'rod' }, { id:'shop', label:'海邊商店', mode:'sell' } ];
function nearShop(){
  if (myBoat) return null;
  for (const sh of SHOPS){ const l = LANDMARKS.find(l => l.id === sh.id); if (l && Math.hypot(me.pos.x - l.pos.x, me.pos.z - l.pos.z) < 4.8) return sh; }
  return null;
}
let shopMode = 'sell', sellConfirm = 0, shopName = '海邊商店';
function openShop(sh){ ensureAudio(); shopMode = sh.mode; shopName = sh.label; sellConfirm = 0; openSheet('shop'); }
function renderShop(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>${shopName}</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  const seg = el('div', 'seg');
  [['sell','賣魚'],['rod','釣竿'],['bait','魚餌']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(shopMode === k)); b.addEventListener('click', () => { shopMode = k; sellConfirm = 0; renderTab(); }); seg.appendChild(b); });
  body.appendChild(seg);
  if (shopMode === 'sell'){
    const locked = new Set(rec.show || []);
    const list = rec.tank.filter(x => !locked.has(x.t)).sort((a, b) => fishPrice(FISH_BY_ID[b.f], b.w) - fishPrice(FISH_BY_ID[a.f], a.w));
    body.appendChild(el('p', 'sub', `魚缸裡的魚可以賣掉換金幣，越重越值錢。${locked.size ? `你挑去水族館展示的 ${locked.size} 條不會出現在這裡。` : ''}`));
    if (!list.length){ body.appendChild(el('div', 'empty', '沒有可以賣的魚。去釣幾條再回來吧！')); return; }
    const commons = list.filter(x => FISH_BY_ID[x.f].rarity === '常見'), csum = commons.reduce((a, x) => a + fishPrice(FISH_BY_ID[x.f], x.w), 0);
    if (commons.length){
      const all = el('button', 'tbtn' + (sellConfirm ? ' warn' : ''), sellConfirm ? `確定賣掉 ${commons.length} 條常見魚？` : `賣掉全部常見魚（${commons.length} 條，+${csum}）`);
      all.addEventListener('click', () => { if (!sellConfirm){ sellConfirm = 1; renderTab(); return; } let got = 0; for (const x of commons) got += sellFish(x.t, true); cloudCall('sell_fish', { p_ts: commons.map(x => x.t) }); sellConfirm = 0; afterSell(got, commons.length); });
      const bar = el('div', 'tankbar'); bar.appendChild(all); body.appendChild(bar);
    }
    const ul = el('ul', 'shoplist cols');
    for (const x of list){
      const f = FISH_BY_ID[x.f], price = fishPrice(f, x.w), li = el('li', ''); li.appendChild(fishCanvas(f, true, 56, 36));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', f.name)); d.appendChild(el('div', 'meta', `${fmtKg(x.w)}・${f.rarity}`)); li.appendChild(d);
      const acts = el('div', 'tacts'), b = el('button', 'tbtn', `賣 🪙${price}`);
      b.addEventListener('click', () => afterSell(sellFish(x.t), 1));
      acts.appendChild(b); li.appendChild(acts); ul.appendChild(li);
    }
    body.appendChild(ul);
  } else if (shopMode === 'rod'){
    body.appendChild(el('p', 'sub', '換一支好竿子，拉線時比較不容易斷，也更容易遇到稀有魚。'));
    const ul = el('ul', 'shoplist');
    for (const r of RODS){
      const owned = rec.rods.includes(r.id), using = rec.rod === r.id, li = el('li', using ? 'on' : '');
      const sw = el('span', 'rodsw'); sw.style.background = r.color; li.appendChild(sw);
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', r.name)); d.appendChild(el('div', 'meta', r.desc)); li.appendChild(d);
      const b = el('button', 'tbtn' + (using ? ' ghost' : ''), using ? '使用中' : owned ? '換上' : `買 🪙${r.price.toLocaleString()}`);
      b.disabled = using;
      b.addEventListener('click', async () => {
        if (!owned && rec.coins < r.price){ toast(`金幣不夠，還差 🪙${(r.price - rec.coins).toLocaleString()}`); return; }
        if (Cloud.on){ b.disabled = true; b.textContent = '處理中…'; const row = await cloudCall('buy_rod', { p_rod: r.id }); if (row && !owned){ SFX.catch(); toast(`買到了 <b>${esc(r.name)}</b>！`); } renderTab(); return; }   // 由伺服器確認金幣
        if (!owned){ rec.rods.push(r.id); addCoins(-r.price); SFX.catch(); toast(`買到了 <b>${esc(r.name)}</b>！`); }
        rec.rod = r.id; saveRecLocal(); me.setRod(r.id); pushPresence(true); renderTab();
      });
      li.appendChild(b); ul.appendChild(li);
    }
    body.appendChild(ul);
  } else {
    body.appendChild(el('p', 'sub', '選一種魚餌來用，每拋一次竿用掉一個。用完會自動換回普通魚餌（免費）。'));
    const ul = el('ul', 'shoplist');
    const none = el('li', !curBait() ? 'on' : ''); none.appendChild(el('span', 'rodsw bait0'));
    const d0 = el('div', 'tinfo'); d0.appendChild(el('div', 'n', '普通魚餌')); d0.appendChild(el('div', 'meta', '免費、用不完。')); none.appendChild(d0);
    const b0 = el('button', 'tbtn' + (!curBait() ? ' ghost' : ''), !curBait() ? '使用中' : '換上'); b0.disabled = !curBait(); b0.addEventListener('click', () => { rec.baitOn = null; saveRecLocal(); renderTab(); cloudCall('set_bait', { p_bait: null }); }); none.appendChild(b0); ul.appendChild(none);
    for (const bt of BAITS){
      const n = rec.bait[bt.id] || 0, using = rec.baitOn === bt.id && n > 0, li = el('li', using ? 'on' : '');
      li.appendChild(el('span', 'rodsw bait-' + bt.id));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${bt.name}　×${n}`)); d.appendChild(el('div', 'meta', `${bt.desc} 一包 ${bt.pack} 個。`)); li.appendChild(d);
      const acts = el('div', 'tacts');
      const buy = el('button', 'tbtn', `買一包 🪙${bt.price}`);
      buy.addEventListener('click', async () => {
        if (rec.coins < bt.price){ toast(`金幣不夠，還差 🪙${bt.price - rec.coins}`); return; }
        if (Cloud.on){ buy.disabled = true; buy.textContent = '處理中…'; const row = await cloudCall('buy_bait', { p_bait: bt.id }); if (row) SFX.chat(); renderTab(); return; }
        rec.bait[bt.id] = n + bt.pack; if (!curBait()) rec.baitOn = bt.id; addCoins(-bt.price); SFX.chat(); renderTab(); });
      acts.appendChild(buy);
      if (n > 0 && !using){ const u = el('button', 'tbtn ghost', '換上'); u.addEventListener('click', () => { rec.baitOn = bt.id; saveRecLocal(); renderTab(); cloudCall('set_bait', { p_bait: bt.id }); }); acts.appendChild(u); }
      li.appendChild(acts); ul.appendChild(li);
    }
    body.appendChild(ul);
  }
}
function afterSell(got, n){
  if (!got) return;
  buildTank(); SFX.catch(); flash(`+${got} 金幣`, 1.1);
  logMsg('', `你賣了 ${n} 條魚，得到 ${got} 金幣`, true); renderTab();
}

function emptyRec(){ return { total:0, bestW:0, bestFish:null, best:{}, count:{}, tank:[], show:[], legend:0, updatedAt:0, coins:0, rod:'bamboo', rods:['bamboo'], bait:{}, baitOn:null, sold:0, earned:0 }; }
const SHOW_MAX = 100, KEEP_MAX = 200;
// 魚缸保留最新 200 條；有被選去展示的魚不會被擠掉
function trimTank(){ const keep = new Set(rec.show || []); let others = 0; rec.tank = rec.tank.filter(x => keep.has(x.t) || ++others <= KEEP_MAX); }
function shownFish(){ if (visiting) return visiting.list; if (rec.show && rec.show.length){ const set = new Set(rec.show); return rec.tank.filter(x => set.has(x.t)); } return rec.tank.slice(0, SHOW_MAX); }
function saveRecLocal(){ rec.updatedAt = Date.now(); LS.set('tide.rec', rec); }
function normRec(r){
  const e = emptyRec(); if (!r || typeof r !== 'object') return e;
  e.total = Number(r.total) || 0; e.bestW = Number(r.bestW) || 0; e.bestFish = FISH_BY_ID[r.bestFish] ? r.bestFish : null; e.legend = Number(r.legend) || 0; e.updatedAt = Number(r.updatedAt) || 0;
  for (const f of FISH){ if (r.best && Number(r.best[f.id]) > 0) e.best[f.id] = Number(r.best[f.id]); if (r.count && Number(r.count[f.id]) > 0) e.count[f.id] = Number(r.count[f.id]); }
  if (Array.isArray(r.tank)) e.tank = r.tank.filter(x => x && FISH_BY_ID[x.f]).slice(0, KEEP_MAX + SHOW_MAX).map(x => ({ f:x.f, w:Number(x.w)||0, t:Number(x.t)||0 }));
  if (Array.isArray(r.show)){ const ts = new Set(e.tank.map(x => x.t)); e.show = r.show.map(Number).filter(t => ts.has(t)).slice(0, SHOW_MAX); }
  // 經濟（金幣、釣竿、魚餌）
  e.coins = Math.max(0, Math.floor(Number(r.coins) || 0)); e.sold = Number(r.sold) || 0; e.earned = Number(r.earned) || 0;
  if (Array.isArray(r.rods)) e.rods = ['bamboo', ...r.rods.filter(id => id !== 'bamboo' && RODS.some(x => x.id === id))];
  e.rod = e.rods.includes(r.rod) ? r.rod : 'bamboo';
  if (r.bait && typeof r.bait === 'object') for (const b of BAITS){ const n = Math.floor(Number(r.bait[b.id]) || 0); if (n > 0) e.bait[b.id] = Math.min(999, n); }
  e.baitOn = BAITS.some(b => b.id === r.baitOn) ? r.baitOn : null;
  return e;
}
let rec = normRec(LS.get('tide.rec', null));
me.setRod(rec.rod); renderCoins();
function recordCatch(f, w){
  const isNew = !rec.count[f.id]; const isBest = w > (rec.best[f.id] || 0);
  rec.total++; rec.count[f.id] = (rec.count[f.id] || 0) + 1; if (isBest) rec.best[f.id] = w;
  const isTop = w > rec.bestW; if (isTop){ rec.bestW = w; rec.bestFish = f.id; }
  if (f.rarity === '傳說') rec.legend++;
  rec.tank.unshift({ f: f.id, w, t: Date.now() }); trimTank();
  rec.updatedAt = Date.now();
  LS.set('tide.rec', rec); saveRemote(); buildTank();
  cloudCall('record_catch', { p_fish: f.id, p_weight: w });
  return { isNew, isBest: isBest && !isNew };
}

function shade(hex, amt){ const c = new THREE.Color(hex); if (amt < 0) c.lerp(new THREE.Color('#000'), -amt); else c.lerp(new THREE.Color('#fff'), amt); return '#' + c.getHexString(); }
function drawFish(cv, color, known, id){
  if (id === 'marlin') return drawMarlin(cv, known);
  if (id && FISH_STYLE[id]){ try { return drawModelFish(cv, FISH_BY_ID[id], known); } catch(e){} }
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W*0.52, H/2);
  const c = known ? color : '#b9c8cf';
  ctx.fillStyle = shade(c, -0.18); ctx.beginPath(); ctx.moveTo(-W*0.24, 0); ctx.lineTo(-W*0.44, -H*0.3); ctx.quadraticCurveTo(-W*0.38, 0, -W*0.44, H*0.3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-W*0.05, -H*0.2); ctx.quadraticCurveTo(W*0.02, -H*0.44, W*0.12, -H*0.2); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, W*0.32, H*0.26, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(W*0.02, H*0.09, W*0.22, H*0.09, 0, 0, Math.PI*2); ctx.fill();
  if (known){ ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W*0.19, -H*0.05, H*0.075, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#173247'; ctx.beginPath(); ctx.arc(W*0.205, -H*0.05, H*0.04, 0, Math.PI*2); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `bold ${Math.round(H*0.34)}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, H*0.02); }
  ctx.restore();
}
function fishCanvas(f, known, w, h){ const cv = document.createElement('canvas'); cv.width = w*2; cv.height = h*2; drawFish(cv, f.color, known, f.id); return cv; }
// 用 3D 模型資料畫側面圖（圖鑑、釣到卡片、魚缸清單共用）
function drawModelFish(cv, f, known){
  const st = FISH_STYLE[f.id], mesh = FISH_MESH[st.shape];
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
  const tilt = st.shape === 'Manta' ? 0.95 : 0.22, ct = Math.cos(tilt), sn = Math.sin(tilt), thick = /^Fish/.test(st.shape) ? 1.5 : 1;
  const L = [0.3, 0.85, 0.45], ll = Math.hypot(...L), tris = [];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const part in mesh){
    const raw = mesh[part], c = new THREE.Color(known ? (st.c[part] || f.color) : '#b9c8cf');
    for (let i = 0; i < raw.length; i += 9){
      const P = [];
      for (let k = 0; k < 3; k++){ const x = raw[i+k*3]/1000, y = raw[i+k*3+1]/1000, z = raw[i+k*3+2]/1000*thick; P.push([x, y*ct - z*sn, y*sn + z*ct]); }
      const ax = P[1][0]-P[0][0], ay = P[1][1]-P[0][1], az = P[1][2]-P[0][2], bx = P[2][0]-P[0][0], by = P[2][1]-P[0][1], bz = P[2][2]-P[0][2];
      const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx, nl = Math.hypot(nx, ny, nz) || 1;
      const sh = 0.55 + 0.45 * Math.abs((nx*L[0] + ny*L[1] + nz*L[2]) / nl / ll);
      tris.push({ P, d: (P[0][2]+P[1][2]+P[2][2]) / 3, col: `rgb(${Math.round(c.r*255*sh)},${Math.round(c.g*255*sh)},${Math.round(c.b*255*sh)})` });
      for (const p of P){ x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    }
  }
  tris.sort((a, b) => a.d - b.d);
  const sc = Math.min(W*0.9/(x1-x0), H*0.86/(y1-y0)), ox = W/2 - (x0+x1)/2*sc, oy = H/2 + (y0+y1)/2*sc;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, W/400);
  for (const t of tris){ ctx.beginPath(); ctx.moveTo(ox + t.P[0][0]*sc, oy - t.P[0][1]*sc); ctx.lineTo(ox + t.P[1][0]*sc, oy - t.P[1][1]*sc); ctx.lineTo(ox + t.P[2][0]*sc, oy - t.P[2][1]*sc); ctx.closePath(); ctx.fillStyle = t.col; ctx.strokeStyle = t.col; ctx.fill(); ctx.stroke(); }
  if (!known){ ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `bold ${Math.round(H*0.34)}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', W/2, H/2); }
}
function drawMarlin(cv, known){
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(W*0.5, H*0.55); ctx.scale(0.9, 0.9);
  const dark = known ? '#1f3f8f' : '#a9bac4', fin = known ? '#1a3478' : '#9fb1bc', belly = known ? '#d6dee8' : '#c9d5db';
  // 尾巴
  ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(-W*0.3, 0); ctx.quadraticCurveTo(-W*0.36, -H*0.18, -W*0.46, -H*0.36); ctx.quadraticCurveTo(-W*0.4, -H*0.1, -W*0.39, 0); ctx.quadraticCurveTo(-W*0.4, H*0.1, -W*0.46, H*0.34); ctx.quadraticCurveTo(-W*0.36, H*0.17, -W*0.3, 0); ctx.fill();
  // 帆狀背鰭
  ctx.beginPath(); ctx.moveTo(W*0.17, -H*0.08); ctx.lineTo(W*0.1, -H*0.44); ctx.quadraticCurveTo(W*0.02, -H*0.34, -W*0.06, -H*0.27); ctx.quadraticCurveTo(-W*0.16, -H*0.18, -W*0.24, -H*0.07); ctx.closePath(); ctx.fill();
  // 身體：上深下淺
  ctx.beginPath(); ctx.ellipse(-W*0.02, 0, W*0.29, H*0.15, 0, 0, Math.PI*2); ctx.save(); ctx.clip();
  ctx.fillStyle = belly; ctx.fillRect(-W*0.4, -H*0.2, W*0.8, H*0.4); ctx.fillStyle = dark; ctx.fillRect(-W*0.4, -H*0.2, W*0.8, H*0.19);
  if (known){ ctx.strokeStyle = 'rgba(143,180,232,.8)'; ctx.lineWidth = W*0.008; for (let i = 0; i < 6; i++){ const x = W*0.12 - i*W*0.06; ctx.beginPath(); ctx.moveTo(x, -H*0.12); ctx.lineTo(x - W*0.01, H*0.08); ctx.stroke(); } }
  ctx.restore();
  // 長嘴
  ctx.fillStyle = known ? '#2a3550' : '#9fb1bc'; ctx.beginPath(); ctx.moveTo(W*0.24, -H*0.04); ctx.lineTo(W*0.52, H*0.0); ctx.lineTo(W*0.24, H*0.04); ctx.closePath(); ctx.fill();
  // 胸鰭
  ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(W*0.13, H*0.06); ctx.lineTo(-W*0.08, H*0.3); ctx.lineTo(W*0.06, H*0.08); ctx.closePath(); ctx.fill();
  if (known){ ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W*0.2, -H*0.03, H*0.05, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#10203a'; ctx.beginPath(); ctx.arc(W*0.207, -H*0.03, H*0.028, 0, Math.PI*2); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `bold ${Math.round(H*0.3)}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', -W*0.02, H*0.02); }
  ctx.restore();
}

// in-world tank
// 水族館最多 100 條魚：同一種魚的同一個部位用一個 InstancedMesh 一次畫完，手機才撐得住
let tankInst = [];      // 這次建出來的 InstancedMesh／一般模型，重建時要拿掉
function buildTank(){
  if (!tankGroup) return;
  for (const m of tankInst){ tankGroup.remove(m); if (m.isInstancedMesh) m.dispose(); } tankInst = []; tankFish = [];
  const list = shownFish();
  const bySpecies = new Map();
  list.forEach((x, i) => {
    const f = FISH_BY_ID[x.f]; const big = BIG_FISH.has(f.id);
    const fish = { f, scale: big ? 0.46 : 0.3 + Math.min(0.18, Math.log(1 + x.w) * 0.06), zk: FISH_STYLE[f.id] && /^Fish/.test(FISH_STYLE[f.id].shape) ? 1.5 : 1,
      ph: i * 1.7 + Math.random() * 3, ph2: Math.random() * 6, sp: rand(0.15, 0.36), ax: rand(2.4, 4.5), az: rand(0.4, 1.1), y: rand(-0.9, 0.95), cx: rand(-0.4, 0.4), slots: [] };
    tankFish.push(fish);
    if (!FISH_STYLE[f.id]){ fish.m = fishModel(f, fish.scale); tankGroup.add(fish.m); tankInst.push(fish.m); return; }   // 旗魚：專屬模型
    if (!bySpecies.has(f.id)) bySpecies.set(f.id, []); bySpecies.get(f.id).push(fish);
  });
  for (const [id, fishes] of bySpecies){
    const st = FISH_STYLE[id], f = FISH_BY_ID[id];
    for (const part of Object.keys(FISH_MESH[st.shape])){
      const im = new THREE.InstancedMesh(fishGeo(st.shape, part), fishMat(id, part, st.c[part] || f.color, st.glow, st.move, st.shape), fishes.length);
      im.frustumCulled = false; im.castShadow = false;
      fishes.forEach((fish, k) => fish.slots.push([im, k]));
      tankGroup.add(im); tankInst.push(im);
    }
  }
  tankDirty = true;
}
let tankFish = [], tankDirty = true;
const tankDummy = new THREE.Object3D();
buildTank();
function updateTank(t){
  // 離水族館太遠就不更新也不畫
  const near = Math.hypot(me.pos.x - AQUA[0], me.pos.z - AQUA[1]) < 45;
  if (tankGroup) tankGroup.visible = near;
  if (!near) return;
  const touched = new Set();
  for (const fish of tankFish){
    const a = t * fish.sp + fish.ph, b = t * fish.sp * 0.7 + fish.ph2;
    const x = fish.cx + Math.sin(a) * fish.ax, z = Math.cos(b) * fish.az;
    const vx = Math.cos(a) * fish.ax * fish.sp, vz = -Math.sin(b) * fish.az * fish.sp * 0.7;
    const y = fish.y + Math.sin(a * 1.3) * 0.12, ry = Math.atan2(-vz, vx);
    if (fish.m){ fish.m.position.set(x, y, z); fish.m.rotation.y = ry; if (fish.m.userData.tail) fish.m.userData.tail.rotation.y = Math.sin(t * 8 + fish.ph) * 0.4; continue; }
    tankDummy.position.set(x, y, z); tankDummy.rotation.set(0, ry, 0); tankDummy.scale.set(fish.scale, fish.scale, fish.scale * fish.zk); tankDummy.updateMatrix();
    for (const [im, k] of fish.slots){ im.setMatrixAt(k, tankDummy.matrix); touched.add(im); }
  }
  for (const im of touched) im.instanceMatrix.needsUpdate = true;
}

/* ================= CATCH CARD ================= */
function showCatch(f, w, res){
  drawFish($('#ccCanvas'), f.color, true, f.id);
  const b = $('#ccBadges'); b.textContent = '';
  const chip = document.createElement('span'); chip.className = 'chip r-' + f.rarity; chip.textContent = f.rarity + '・' + SPOT_BY_ID[f.spot].label; b.appendChild(chip);
  if (res.isNew){ const x = document.createElement('span'); x.className = 'badge new'; x.textContent = '圖鑑新登錄'; b.appendChild(x); }
  if (res.isBest){ const x = document.createElement('span'); x.className = 'badge'; x.textContent = '個人新紀錄'; b.appendChild(x); }
  $('#ccName').textContent = f.name;
  $('#ccW').innerHTML = w.toFixed(2) + '<small>kg</small>' + `<small class="ccp">・可賣 🪙${fishPrice(f, w)}</small>`;
  $('#ccDesc').textContent = f.desc;
  $('#catchCard').hidden = false; uiBlocked = true;
  setTimeout(() => $('#ccOk').focus(), 50);
}
function closeCatch(){ if ($('#catchCard').hidden) return; $('#catchCard').hidden = true; uiBlocked = !$('#sheet').hidden; if (F.phase === 'result') F.phase = 'idle'; }
$('#ccOk').addEventListener('click', closeCatch);
(function(){ const j = $('#jumpBtn');
  j.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); j.classList.add('down'); jump(); });
  const off = () => j.classList.remove('down'); j.addEventListener('pointerup', off); j.addEventListener('pointercancel', off); j.addEventListener('pointerleave', off);
  j.addEventListener('contextmenu', e => e.preventDefault());
})();
(function(){ const a = $('#act');
  a.addEventListener('pointerdown', e => { e.preventDefault(); try { a.setPointerCapture(e.pointerId); } catch(_){} actionDown(); });
  const up = () => actionUp();
  a.addEventListener('pointerup', up); a.addEventListener('pointercancel', up); a.addEventListener('lostpointercapture', up);
  a.addEventListener('contextmenu', e => e.preventDefault());
})();

/* ================= CHAT / TOASTS ================= */
const logEl = $('#log');
function logMsg(name, text, sys){
  const d = document.createElement('div'); d.className = 'm' + (sys ? ' sys' : '');
  if (name){ const b = document.createElement('b'); b.textContent = name; d.appendChild(b); }
  d.appendChild(document.createTextNode(text)); logEl.appendChild(d);
  while (logEl.children.length > 30) logEl.firstChild.remove();
  setTimeout(() => d.classList.add('fade'), 14000);
}
// 跑馬燈：大家的動態（誰釣到什麼、誰在炫耀、天色變化）從右往左飄過去；排隊一則接一則，不會疊在一起
const Ticker = { q:[], nextAt:0, busy:false, speed:110 };
function ticker(html){
  if (Ticker.q.length > 12) Ticker.q.shift();
  Ticker.q.push(html); runTicker();
}
function runTicker(){
  if (Ticker.busy || !Ticker.q.length) return;
  const wait = Ticker.nextAt - performance.now();
  if (wait > 0){ Ticker.busy = true; setTimeout(() => { Ticker.busy = false; runTicker(); }, wait); return; }
  const box = $('#ticker'), d = document.createElement('div'); d.className = 'tk'; d.innerHTML = Ticker.q.shift(); box.appendChild(d);
  const W = box.clientWidth || viewW(), w = d.offsetWidth, dist = W + w + 20, dur = dist / Ticker.speed * 1000;
  const anim = d.animate([{ transform:`translateX(${W + 10}px)` }, { transform:`translateX(${-w - 10}px)` }], { duration: dur, easing:'linear' });
  anim.onfinish = () => d.remove(); anim.oncancel = () => d.remove();
  Ticker.nextAt = performance.now() + (w + 60) / Ticker.speed * 1000;   // 前一則完全進場、留一點空隙後，下一則才出發
  if (Ticker.q.length) runTicker();
}
function toast(html){ const t = document.createElement('div'); t.className = 'toast panel'; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 5200); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove(); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

let chatAllowed = true;
$('#chatForm').addEventListener('submit', async e => {
  e.preventDefault(); const inp = $('#chatIn'); const text = clean(inp.value.trim().slice(0, 120)); if (!text) return;
  const nowT = performance.now(); myChatAt = myChatAt.filter(x => nowT - x < 6000);
  if (myChatAt.length >= 4){ toast('說太快了，休息一下再說'); return; }
  if (text === lastMyChat && myChatAt.length && nowT - myChatAt[myChatAt.length - 1] < 4000){ toast('同一句話不要一直重複喔'); return; }
  myChatAt.push(nowT); lastMyChat = text;
  inp.value = '';
  if (room && room.connected() && chatAllowed){
    try { await room.emit('chat', { t: text }); }
    catch(err){ if (err && err.code === 'not_permitted'){ chatAllowed = false; logMsg('系統', '你目前是檢視者，聊天只有你自己看得到。', true); } me.say(text); logMsg('你', text); }
  } else { me.say(text); logMsg('你', text + (room ? '' : '（單人模式）')); }
  if (isTouch){ inp.blur(); document.body.classList.remove('chatting'); }
});
$('#chatToggle').addEventListener('click', () => { document.body.classList.toggle('chatting'); if (document.body.classList.contains('chatting')) $('#chatIn').focus(); });
$('#chatIn').addEventListener('focus', () => { for (const k in keys) keys[k] = false; });

let myEmote = null;
function emote(k){ ensureAudio(); me.say(EMOTES[k], 'emote', 3); myEmote = { k, at: Date.now() }; pushPresence(true); }
$$('#emotes [data-emote]').forEach(b => b.addEventListener('click', () => emote(b.dataset.emote)));

/* ---- 炫耀魚：選一條釣過的魚，舉起來給大家看 ---- */
let myShow = null;
function fmtKg(w){ w = +w || 0; return (w >= 100 ? Math.round(w).toLocaleString() : w.toFixed(2)) + 'kg'; }
function openShowPick(){
  ensureAudio();
  const pick = $('#showPick');
  if (!pick.hidden){ pick.hidden = true; return; }
  if (F.phase !== 'idle'){ toast('正在釣魚，先收竿再炫耀吧'); return; }
  const ids = Object.keys(rec.best || {}).filter(id => FISH_BY_ID[id] && rec.best[id] > 0);
  if (!ids.length){ toast('還沒有釣到魚，先去釣一條再來炫耀吧！'); return; }
  ids.sort((a, b) => RARITY_ORDER[FISH_BY_ID[b].rarity] - RARITY_ORDER[FISH_BY_ID[a].rarity] || rec.best[b] - rec.best[a]);
  const list = pick.querySelector('.splist'); list.innerHTML = '';
  for (const id of ids){
    const f = FISH_BY_ID[id], b = el('button', 'spbtn');
    b.innerHTML = `<span class="chip r-${f.rarity}">${f.rarity}</span><b>${esc(f.name)}</b><small>${fmtKg(rec.best[id])}</small>`;
    b.addEventListener('click', () => { pick.hidden = true; showOff(id, rec.best[id]); });
    list.appendChild(b);
  }
  pick.hidden = false;
}
function showOff(id, w){
  const f = FISH_BY_ID[id]; if (!f) return;
  me.holdFish(f, w, 6);
  myShow = { f: id, w: +(+w).toFixed(2), at: Date.now() }; pushPresence(true);
  const p = me.av.g.position; FX.emit(p.x, p.y + 2.5, p.z, f.rarity === '傳說' ? 40 : 18, f.rarity === '傳說' ? '#ffd36a' : '#9fe3ff', 1.2, 2.2, 1.0);
  SFX.catch();
  logMsg('', `你在炫耀 ${f.name} ${fmtKg(w)}`, true);
}
$('#showBtn').addEventListener('click', openShowPick);
$('#showPick .spx').addEventListener('click', () => { $('#showPick').hidden = true; });
canvas.addEventListener('pointerdown', () => { $('#showPick').hidden = true; });

/* ================= SOCIAL (room / db / user) ================= */
let room = null, db = null, user = null, myId = null, dbWritable = true;
const peers = new Map(); // peer -> {fisher, by, target, rot, lastEmoteAt, pres}
const profileNames = {};
async function resolveNames(ids){
  ids = ids.filter(Boolean); if (!user || !ids.length) return;
  try { const ps = await user.profiles(ids); for (const id of ids) if (ps[id]) profileNames[id] = ps[id].name || ''; } catch(e){}
}
/* ================= SAFETY：不雅字過濾、封鎖玩家、防洗版 ================= */
// 不雅字：中英文常見髒話，字中間夾空白或符號也抓得到；「幹嘛、樹幹」這類正常用法不算
const BAD_WORDS = ['幹你','幹妳','幹您','幹拎','幹林','幹恁','操你','操妳','肏','靠北','靠杯','靠腰','機掰','機八','雞巴','雞掰','屌','他媽的','他媽','你媽','妳媽','你娘','婊子','賤人','賤貨','王八蛋','白癡','白痴','智障','腦殘','去死','垃圾人','三小','淦','fuck','fck','shit','bitch','asshole','dick','cunt','bastard','nigger','nigga','retard'];
const BAD_OK = ['幹嘛','幹麼','幹什麼','能幹','幹部','幹活','樹幹','主幹','幹事','才幹','骨幹','苦幹','實幹','幹勁','精幹','軀幹','幹練'];
const BAD_SEP = '[\\s\\x21-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\x7e。，、！？～．·＿]{0,2}';   // 字中間只允許夾空白或標點
const BAD_RE = new RegExp(BAD_WORDS.map(w => [...w].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(BAD_SEP)).join('|') + '|幹', 'gi');   // 單獨的「幹」：正常用法已經先保護起來了
let filterOn = LS.get('tide.filter', true);
function clean(text){
  if (!filterOn || !text) return text;
  // 先把正常用法換成記號，過濾完再換回來
  const keep = []; let t = String(text).replace(new RegExp(BAD_OK.join('|'), 'g'), m => { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0002'; });
  t = t.replace(BAD_RE, m => '＊'.repeat(Math.min(4, [...m.replace(new RegExp(BAD_SEP.slice(0, -5), 'g'), '')].length || 1)));
  return t.replace(/\u0001(\d+)\u0002/g, (_, i) => keep[+i]);
}
// 封鎖：用玩家的雲端 id（沒有的話用連線 id），存在這台裝置
let blockList = LS.get('tide.blocked', {});   // { uid: 名字 }
const peerUid = new Map();                   // 連線 id → 玩家 id
function uidOf(pp){ const pr = pp.presence || {}; return typeof pr.u === 'string' && pr.u ? pr.u : (pp.by || pp.peer); }
function isBlockedPeer(peerId){ const u = peerUid.get(peerId); return !!(u && blockList[u]); }
function blockPeer(peerId, name){
  const u = peerUid.get(peerId) || peerId; blockList[u] = String(name || '釣客').slice(0, 16); LS.set('tide.blocked', blockList);
  const p = peers.get(peerId); if (p){ p.fisher.dispose(); peers.delete(peerId); }
  setOnline(); toast(`已封鎖 ${esc(blockList[u])}：你不會再看到他的角色、聊天和動態。`);
}
function unblock(u){ delete blockList[u]; LS.set('tide.blocked', blockList); toast('已解除封鎖，對方下次移動時就會出現。'); }
// 防洗版：每個人 6 秒內最多 4 則，超過的不顯示
const chatRate = new Map();
function tooChatty(peerId){ const t = performance.now(), a = (chatRate.get(peerId) || []).filter(x => t - x < 6000); a.push(t); chatRate.set(peerId, a); return a.length > 4; }
let myChatAt = [], lastMyChat = '';

function peerName(p){ const pr = p.pres || {}; if (typeof pr.n === 'string' && pr.n.trim()) return clean(pr.n.trim().slice(0, 16)); return (p.by && profileNames[p.by]) || '釣客'; }
function myDisplayName(){ return nickname || (myId && profileNames[myId]) || '你'; }

let lastPres = '', lastPresAt = 0;
function presenceObj(){
  const o = { p:[+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.baseY.toFixed(2)], r:+me.rot.toFixed(2), sh:look.shirt, ht:look.hat };
  if (nickname) o.n = nickname;
  if (myId) o.u = myId;
  if (myBoat) o.bt = 1;
  if (me.fishing && me.bobState !== 'none') o.f = { ph: F.phase === 'bite' ? 'bite' : F.phase === 'reeling' ? 'reel' : 'wait', b:[+me.bobPos.x.toFixed(2), +me.bobPos.z.toFixed(2)] };
  else if (me.fishing) o.f = { ph:'cast' };
  if (myEmote && Date.now() - myEmote.at < 4000) o.e = myEmote;
  if (myShow && Date.now() - myShow.at < 6500) o.s = myShow;
  if (rec.rod !== 'bamboo') o.rd = rec.rod;
  return o;
}
function pushPresence(force){
  if (!room) return; const t = now(); if (!force && t - lastPresAt < 0.1) return;
  const o = presenceObj(); const s = JSON.stringify(o); if (s === lastPres) return;
  lastPres = s; lastPresAt = t; room.presence(o).catch(() => {});
}
function setOnline(){
  const n = 1 + Array.from(peers.values()).length; const el = $('#online');
  el.classList.toggle('live', !!(room && room.connected()));
  $('#onlineTxt').textContent = room ? (room.connected() ? (pjMode && room.code ? `房間 ${room.code}・` : room.isLobby ? `大廳 ${room.lobbyNo}・` : '') + `${n} 人在村裡` : '連線中…') : '單人模式';
  if (!$('#sheet').hidden && curTab === 'people') renderTab();
}
function isHex(s){ return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); }
function applyPeer(pp){
  if (pp.isMe || pp.kind !== 'viewer') return;
  peerUid.set(pp.peer, uidOf(pp));
  if (isBlockedPeer(pp.peer)){ const bp = peers.get(pp.peer); if (bp){ bp.fisher.dispose(); peers.delete(pp.peer); } return; }
  let p = peers.get(pp.peer); const pr = pp.presence || {};
  const pos = Array.isArray(pr.p) ? pr.p : null;
  if (!p){
    if (!pos) return;
    const f = new Fisher({ shirt: isHex(pr.sh) ? pr.sh : '#9fb3bf', hat: isHex(pr.ht) ? pr.ht : '#ffd36a', name:'' });
    f.pos.set(+pos[0]||0, 0, +pos[1]||0); f.rot = +pr.r || 0;
    p = { fisher: f, by: pp.by, target: new THREE.Vector3(+pos[0]||0, 0, +pos[1]||0), rot: +pr.r || 0, y:+pos[2]||0, lastEmote: 0, pres: pr, guest: pp.guest };
    peers.set(pp.peer, p);
    resolveNames([pp.by]).then(() => p.fisher.setName(peerName(p)));
  }
  p.pres = pr; p.by = pp.by;
  if (pos){ p.target.set(clamp(+pos[0]||0, -90, 90), 0, clamp(+pos[1]||0, -90, 90)); p.y = clamp(+pos[2]||0, -0.2, 8); }
  p.rot = Number.isFinite(+pr.r) ? +pr.r : p.rot;
  p.fisher.setLook(isHex(pr.sh) ? pr.sh : '#9fb3bf', isHex(pr.ht) ? pr.ht : '#ffd36a');
  p.fisher.setName(peerName(p) + (pp.guest ? '・訪客' : ''));
  p.fisher.sitting = !!pr.bt;
  p.fisher.setRod(typeof pr.rd === 'string' ? pr.rd : 'bamboo');
  if (pr.bt && !p.fisher.boatMesh){ p.fisher.boatMesh = makeBoatMesh('#c98b55'); scene.add(p.fisher.boatMesh); }
  if (!pr.bt && p.fisher.boatMesh){ scene.remove(p.fisher.boatMesh); p.fisher.boatMesh = null; }
  const fi = pr.f && typeof pr.f === 'object' ? pr.f : null;
  p.fisher.fishing = !!fi;
  if (fi && Array.isArray(fi.b)){
    const nb = new THREE.Vector3(clamp(+fi.b[0]||0,-36,36), 0.12, clamp(+fi.b[1]||0,-36,36));
    if (p.fisher.bobState === 'none'){ const from = new THREE.Vector3(); p.fisher.av.tip.getWorldPosition(from); p.fisher.bobPos.copy(nb); p.fisher.bobState = 'fly'; p.fisher.flying = { from, to: nb.clone(), t:0, dur:0.6, h:1.8 }; }
    else p.fisher.bobPos.copy(nb);
    p.ph = fi.ph;
  } else { p.fisher.bobState = 'none'; p.fisher.flying = null; p.ph = null; }
  if (pr.s && typeof pr.s === 'object' && FISH_BY_ID[pr.s.f] && pr.s.at !== p.lastShow){
    p.lastShow = pr.s.at; const sf = FISH_BY_ID[pr.s.f], sw = clamp(+pr.s.w || 0, 0, 1e6);
    p.fisher.holdFish(sf, sw, 6);
    ticker(`🐟 <b>${esc(peerName(p))}</b> 在炫耀 <span class="chip r-${sf.rarity}">${sf.rarity}</span> <b>${esc(sf.name)}</b> ${fmtKg(sw)}`);
  }
  if (pr.e && typeof pr.e === 'object' && EMOTES[pr.e.k] && pr.e.at !== p.lastEmote){ p.lastEmote = pr.e.at; p.fisher.say(EMOTES[pr.e.k], 'emote', 3); }
}
function updatePeers(dt, t){
  for (const p of peers.values()){
    const f = p.fisher; const dx = p.target.x - f.pos.x, dz = p.target.z - f.pos.z; const d = Math.hypot(dx, dz);
    if (d > 8){ f.pos.x = p.target.x; f.pos.z = p.target.z; }
    else { const k = 1 - Math.exp(-8*dt); f.pos.x += dx*k; f.pos.z += dz*k; }
    f.speed += ((d > 0.05 ? Math.min(6, d*8) : 0) - f.speed) * Math.min(1, dt*8);
    f.rot = lerpAngle(f.rot, p.rot, 1 - Math.exp(-10*dt));
    f.baseY += (p.y - f.baseY) * Math.min(1, dt*10);
    if (f.boatMesh){ f.boatMesh.position.set(f.pos.x, WATER_LEVEL + Math.sin(t * 1.6) * 0.04, f.pos.z); f.boatMesh.rotation.y = f.rot; }
    f.dip = p.ph === 'bite' ? 0.9 + Math.sin(t*30)*0.1 : p.ph === 'reel' ? 0.5 + Math.sin(t*7)*0.2 : f.dip * Math.pow(0.05, dt);
    f.bend = p.ph === 'reel' ? 0.55 + Math.sin(t*5)*0.25 : f.bend * 0.9;
    f.update(dt, t); f.placeTag();
  }
}

let pjMode = false, roomTimer = null;
function useRoom(r){
  room = r;
    room.onPeers(ch => { for (const pp of ch.joined) applyPeer(pp); for (const pp of ch.updated) applyPeer(pp);
      for (const pp of ch.left){ const p = peers.get(pp.peer); if (p){ p.fisher.dispose(); peers.delete(pp.peer); } }
      for (const pp of ch.joined){ if (!pp.isMe && pp.kind === 'viewer') setTimeout(() => { const p = peers.get(pp.peer); if (p){ logMsg('', `${peerName(p)} 來到了村子`, true); ticker(`👋 <b>${esc(peerName(p))}</b> 來到了村子`); } }, 600); }
      setOnline(); }, () => { room = null; setOnline(); });
    room.on('chat', msg => {
      let text = msg && msg.data && typeof msg.data.t === 'string' ? msg.data.t.slice(0, 120) : ''; if (!text) return;
      if (msg.sameTab){ me.say(text); logMsg(myDisplayName() === '你' ? '你' : myDisplayName(), text); return; }
      if (isBlockedPeer(msg.peer) || tooChatty(msg.peer)) return;
      text = clean(text);
      const p = peers.get(msg.peer); const name = p ? peerName(p) : '釣客';
      if (p) p.fisher.say(text); logMsg(name, text); SFX.chat();
    }, () => {});
    room.on('visit', msg => {
      if (msg.sameTab || !msg.data || msg.data.to !== myId || isBlockedPeer(msg.peer)) return;
      const p = peers.get(msg.peer); ticker(`👀 <b>${esc(p ? peerName(p) : '有人')}</b> 正在參觀你的水族館`);
    }, () => {});
    room.on('catch', msg => {
      if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const f = FISH_BY_ID[msg.data.f]; const w = Number(msg.data.w); if (!f || !(w > 0) || w > f.max + 0.01) return;
      const p = peers.get(msg.peer); const name = p ? peerName(p) : '有人';
      ticker(`${f.rarity === '傳說' ? '🎉' : '🎣'} <b>${esc(name)}</b> 在${esc(SPOT_BY_ID[f.spot].short)}釣到 <span class="chip r-${f.rarity}">${f.rarity}</span> <b>${esc(f.name)}</b> ${fmtKg(w)}`);
      if (p){ p.fisher.holdFish(f, w, 5); if (f.rarity === '傳說') p.fisher.say('🎉 ' + f.name + ' ' + fmtKg(w), 'emote', 5); }   // 大家都看得到他捧著剛釣到的魚
    }, () => {});
    room.onConnection(() => setOnline(), () => {});
    clearInterval(roomTimer); roomTimer = setInterval(() => pushPresence(false), 120);
    pushPresence(true); setOnline();
}
/* ---- 公共大廳：用 Supabase Realtime，打開遊戲就會看到其他正在玩的人 ---- */
// 和 PJRoom 一樣的介面（connected／on／onPeers／onConnection／presence／emit／leave），所以 useRoom() 不用改。
// 位置用 broadcast 送（最多每秒 4 次、只有變動時才送）；presence 只拿來知道誰進來、誰離開。
const LOBBY_MAX = 16, LOBBY_COUNT = 5;
function SBRoom(sb, name, key, myName){
  const R = { isLobby:true, code:null, lobbyNo:0 }; let ch = null, live = false, myPres = null, lastSent = '', flushT = 0, lastAt = 0;
  const lis = {}, peerFns = [], connFns = [], pres = {};
  const fire = (t, m) => (lis[t] || []).forEach(f => { try { f(m); } catch(e){} });
  const firePeers = c => peerFns.forEach(f => { try { f(c); } catch(e){} });
  const fireConn = () => connFns.forEach(f => { try { f(live); } catch(e){} });
  const pp = id => ({ peer:id, isMe:false, kind:'viewer', presence: pres[id] || {}, by: (pres[id] && pres[id].u) || id, guest:false });
  function send(force){
    if (!live || !myPres) return; const t = performance.now();
    if (!force && t - lastAt < 240){ if (!flushT) flushT = setTimeout(() => { flushT = 0; send(); }, 250); return; }
    const sv = JSON.stringify(myPres); if (!force && sv === lastSent) return; lastSent = sv; lastAt = t;
    ch.send({ type:'broadcast', event:'p', payload:{ id:key, p:myPres } }).catch(() => {});
  }
  R.connected = () => live;
  R.on = (t, fn) => { (lis[t] = lis[t] || []).push(fn); return () => {}; };
  R.onPeers = fn => { peerFns.push(fn); const j = Object.keys(pres).map(pp); if (j.length) setTimeout(() => fn({ joined:j, updated:[], left:[] }), 0); return () => {}; };   // 補上已經在大廳裡的人
  R.onConnection = fn => { connFns.push(fn); return () => {}; };
  R.presence = o => { myPres = o; send(); return Promise.resolve(); };
  R.emit = (topic, data) => { if (!live) return Promise.reject({ code:'not_connected' }); ch.send({ type:'broadcast', event:'ev', payload:{ id:key, topic, data } }).catch(() => {}); fire(topic, { peer:key, data, sameTab:true }); return Promise.resolve(); };
  R.leave = () => { live = false; clearTimeout(flushT); try { sb.removeChannel(ch); } catch(e){} fireConn(); };
  R.size = () => { try { return Object.keys(ch.presenceState()).length; } catch(e){ return 1; } };
  R.start = () => new Promise((res, rej) => {
    ch = sb.channel(name, { config:{ broadcast:{ self:false, ack:false }, presence:{ key } } });
    ch.on('broadcast', { event:'p' }, ({ payload }) => {
      if (!payload || payload.id === key || !payload.p || typeof payload.p !== 'object') return;
      const isNew = !pres[payload.id]; pres[payload.id] = payload.p;
      firePeers(isNew ? { joined:[pp(payload.id)], updated:[], left:[] } : { joined:[], updated:[pp(payload.id)], left:[] });
    });
    ch.on('broadcast', { event:'ev' }, ({ payload }) => { if (!payload || payload.id === key || typeof payload.topic !== 'string') return; fire(payload.topic, { peer:payload.id, data:payload.data, sameTab:false }); });
    // 有新的人進來：重送一次自己的狀態，對方才看得到站著不動的人
    ch.on('presence', { event:'join' }, ({ key:k }) => { if (k !== key) setTimeout(() => send(true), 150 + Math.random() * 600); });
    ch.on('presence', { event:'leave' }, ({ key:k }) => { if (pres[k]){ const x = pp(k); delete pres[k]; firePeers({ joined:[], updated:[], left:[x] }); } });
    let done = false;
    ch.subscribe(async st => {
      if (st === 'SUBSCRIBED'){ live = true; fireConn(); try { await ch.track({ n: myName || '' }); } catch(e){} send(true); if (!done){ done = true; res(R); } }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED'){ const was = live; live = false; if (was) fireConn(); if (!done){ done = true; rej(new Error(st)); } }
    });
  });
  return R;
}
let lobbyJoining = false;
async function joinLobby(){
  if (!Cloud.on || room || pjMode || lobbyJoining) return;
  lobbyJoining = true;
  try {
    for (let i = 1; i <= LOBBY_COUNT; i++){
      const r = SBRoom(Cloud.sb, 'tide-lobby-' + i, (Cloud.userId || 'x').slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6), nickname);
      try { await r.start(); } catch(e){ console.warn('lobby', e); break; }
      await new Promise(res => setTimeout(res, 1200));   // 等一下，知道大廳裡有幾個人
      if (room || pjMode){ r.leave(); break; }
      if (r.size() <= LOBBY_MAX || i === LOBBY_COUNT){
        r.lobbyNo = i; useRoom(r);
        const n = r.size() - 1;
        logMsg('系統', n > 0 ? `進入公共大廳 ${i}，現在有 ${n} 位釣客在村子裡。` : `進入公共大廳 ${i}。現在只有你，有人進來時你就會看到他。`, true);
        break;
      }
      r.leave();
    }
  } finally { lobbyJoining = false; }
}
function leaveLobby(){ if (room && room.isLobby){ try { room.leave(); } catch(e){} clearInterval(roomTimer); clearPeers(); room = null; } }

/* ---- 5 碼房間代碼（不在 Claude 網頁裡、或沒登入時用） ---- */
function pjAvailable(){ return !!(window.PJRoom && PJRoom.available()) && !(window.claude && room && !pjMode); }
function clearPeers(){ for (const p of peers.values()) p.fisher.dispose(); peers.clear(); }
async function pjStart(mode, code){
  leaveLobby();
  if (room && pjMode){ try { room.leave(); } catch(e){} }
  clearInterval(roomTimer); clearPeers(); room = null; pjMode = true; setOnline();
  $('#onlineTxt').textContent = mode === 'host' ? '開房中…' : '連線中…';
  try {
    const r = mode === 'host' ? await PJRoom.host(nickname) : await PJRoom.join(code, nickname);
    useRoom(r); pjMode = true;
    try { history.replaceState(null, '', location.pathname + location.search + '#room=' + r.code); } catch(e){}
    logMsg('系統', mode === 'host' ? `開好房間了，房間代碼 ${r.code}。把代碼或網址傳給朋友就能一起釣魚。` : `加入房間 ${r.code} 了！`, true);
    setOnline(); if (!$('#sheet').hidden && curTab === 'people') renderTab();
  } catch(err){
    pjMode = false; room = null; setOnline(); setTimeout(joinLobby, 500);
    const why = err && err.type === 'peer-unavailable' ? '找不到這個房間，請確認 5 個字母沒打錯、開房的人畫面還開著。' : err && err.type === 'timeout' ? '連不上房間，請再試一次。' : '連線服務暫時連不上，請稍後再試。';
    logMsg('系統', why, true); toast(esc(why));
  }
}
function pjLeave(){ setTimeout(joinLobby, 400); if (room && pjMode){ try { room.leave(); } catch(e){} } clearInterval(roomTimer); clearPeers(); room = null; pjMode = false; try { history.replaceState(null, '', location.pathname + location.search); } catch(e){} setOnline(); logMsg('系統', '你離開了房間，現在是單人模式。', true); }
function autoJoinCode(){ const m = /room=([A-Za-z]{5})/.exec(location.hash || ''); if (m && pjAvailable()) pjStart('join', m[1].toUpperCase()); }
/* ================= CLOUD：Supabase 雲端存檔＋伺服器驗證 ================= */
// 玩家資料由伺服器保管：釣到魚、賣魚、買東西都會送到伺服器檢查，結果以伺服器為準。
// 這把 publishable key 本來就是要放在網頁上的；資料表只能透過 supabase/schema.sql 裡的函式修改。
const SUPABASE_URL = 'https://mfaskrjcxofwkusrzkhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XfsYJu9TUcctWxQX57P2Vw_JPoD1EfK';
const Cloud = { sb:null, on:false, status:'connecting', err:'', userId:null, email:null, isAnon:true, queue:Promise.resolve(), pending:0, board:{ best:[], total:[], earned:[] }, ui:{ step:'idle', mode:'bind', email:'', busy:false, msg:'' } };
function rowToRec(r){
  return normRec({ total:r.total, bestW:Number(r.best_w) || 0, bestFish:r.best_fish, best:r.fish_best, count:r.fish_count, tank:r.tank, show:r.show, legend:r.legend,
    coins:r.coins, rod:r.rod, rods:r.rods, bait:r.bait, baitOn:r.bait_on, sold:r.sold, earned:r.earned, updatedAt:Date.parse(r.updated_at) || Date.now() });
}
function adoptRow(row){
  if (!row || typeof row !== 'object') return;
  rec = rowToRec(row); LS.set('tide.rec', rec); buildTank(); renderCoins(); me.setRod(rec.rod); pushPresence(true);
  if (!$('#sheet').hidden && ['shop', 'tank', 'dex', 'rank', 'style'].includes(curTab) && !Cloud.ui.busy) renderTab();
}
const CLOUD_ERR = ['還沒登入', '沒有這種魚', '重量不合理', '釣太快了', '金幣不夠', '沒有這支釣竿', '沒有這種魚餌'];
// 依序送出（避免兩個動作互相蓋掉），全部送完才採用伺服器回傳的最新資料
function cloudCall(fn, args){
  if (!Cloud.on) return Promise.resolve(null);
  Cloud.pending++;
  const job = Cloud.queue.then(async () => {
    let data = null, error = null;
    try { ({ data, error } = await Cloud.sb.rpc(fn, args || {})); } catch(e){ error = e; }
    Cloud.pending--;
    if (error){
      const m = String(error.message || error); const known = CLOUD_ERR.find(k => m.includes(k));
      toast(known ? `伺服器：${esc(known)}` : '暫時連不上雲端，這個動作沒有存到。');
      console.warn('cloud', fn, m);
      if (Cloud.pending === 0) cloudRefresh();
      return null;
    }
    if (Cloud.pending === 0) adoptRow(data);
    if (fn === 'record_catch' || fn === 'sell_fish' || fn === 'set_profile'){ clearTimeout(Cloud.boardT); Cloud.boardT = setTimeout(loadBoard, 4000); }
    return data;
  });
  Cloud.queue = job.catch(() => {});
  return job;
}
/* ---- 參觀別人的水族館：把廣場北邊的大水族館換成對方展示的魚 ---- */
var visiting = null;   // { id, name, list }（用 var：水族館在這之前就會先建一次）
async function visitAquarium(id, name){
  if (!Cloud.sb || !id){ toast('要連上雲端才能參觀別人的水族館'); return; }
  if (id === Cloud.userId){ leaveVisit(); return; }
  try {
    const { data, error } = await Cloud.sb.from('players').select('nickname,tank,show').eq('id', id).maybeSingle();
    if (error || !data){ toast('找不到這位玩家的水族館'); return; }
    const r = normRec({ tank:data.tank, show:data.show });
    const set = new Set(r.show || []), list = set.size ? r.tank.filter(x => set.has(x.t)) : r.tank.slice(0, SHOW_MAX);
    visiting = { id, name: data.nickname || name || '釣客', list };
    buildTank(); renderVisitBar();
    travelTo({ id:'aquarium', label:'水族館', x: AQUA[0] + 1.2, z: AQUA[1] + 6.2, rot: Math.PI });
    if (room && room.connected()) room.emit('visit', { to: id }).catch(() => {});
    ticker(`🐠 正在參觀 <b>${esc(visiting.name)}</b> 的水族館（${list.length} 條魚）`);
  } catch(e){ toast('暫時連不上雲端'); }
}
function leaveVisit(){ if (!visiting) return; visiting = null; buildTank(); renderVisitBar(); }
function renderVisitBar(){
  let bar = $('#visitBar');
  if (!visiting){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'visitBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = '';
  bar.appendChild(el('span', '', `🐠 正在參觀 ${visiting.name} 的水族館・${visiting.list.length} 條`));
  const b = el('button', 'tbtn', '回到我的'); b.addEventListener('click', leaveVisit); bar.appendChild(b);
}

async function cloudRefresh(){ try { const { data, error } = await Cloud.sb.rpc('ensure_player'); if (!error) adoptRow(data); } catch(e){} }
function setCloudUser(u){ const switched = Cloud.userId && Cloud.userId !== u.id; Cloud.userId = u.id; Cloud.email = u.email || null; Cloud.isAnon = !u.email; if (!myId || switched) myId = u.id; }
async function cloudLoad(allowImport){
  let { data:row, error } = await Cloud.sb.rpc('ensure_player'); if (error) throw error;
  if (allowImport && row && row.total === 0 && !row.imported && rec.total > 0){
    const r2 = await Cloud.sb.rpc('import_local', { p: { best:rec.best, count:rec.count, tank:rec.tank, coins:rec.coins, rods:rec.rods, rod:rec.rod } });
    if (!r2.error && r2.data){ row = r2.data; toast('已把這台裝置的紀錄存到雲端 ☁️'); }
  }
  adoptRow(row);
  // 暱稱和造型以這台裝置的設定為準
  if (row && (nickname && row.nickname !== nickname || row.shirt !== look.shirt || row.hat !== look.hat)) cloudProfile();
}
let profTimer = 0;
function cloudProfile(){ if (!Cloud.on && !Cloud.sb) return; clearTimeout(profTimer); profTimer = setTimeout(() => { if (Cloud.sb) Cloud.sb.rpc('set_profile', { p_nick: nickname || '', p_shirt: look.shirt, p_hat: look.hat }).then(() => loadBoard()).catch(() => {}); }, 800); }
async function loadBoard(){
  if (!Cloud.sb) return;
  const cols = 'id,nickname,best_w,best_fish,total,legend,fish_count,earned';
  const q = (col) => Cloud.sb.from('players').select(cols).gt('total', 0).order(col, { ascending:false }).limit(20);
  try {
    const [a, b, c] = await Promise.all([q('best_w'), q('total'), q('earned')]);
    const map = r => ({ id:r.id, name:r.nickname, bestW:Number(r.best_w) || 0, bestFish:r.best_fish, total:r.total, legend:r.legend, count:r.fish_count || {}, earned:r.earned || 0 });
    if (!a.error) Cloud.board.best = a.data.map(map); if (!b.error) Cloud.board.total = b.data.map(map); if (!c.error) Cloud.board.earned = c.data.map(map);
    if (curTab === 'rank' && !$('#sheet').hidden) renderTab();
  } catch(e){}
}
async function cloudInit(){
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    const sb = mod.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'implicit', storageKey:'tide.auth' } });
    Cloud.sb = sb;
    const fromLink = /access_token=|error_description=/.test(location.hash);
    const linkErr = (location.hash.match(/error_description=([^&]+)/) || [])[1];
    let { data:{ session } } = await sb.auth.getSession();
    if (fromLink){ try { history.replaceState(null, '', location.pathname + location.search); } catch(e){} }
    if (linkErr) toast('這個連結已經失效，請重新寄一次。');
    else if (fromLink && session) setTimeout(() => toast(session.user.email ? `已用 ${esc(session.user.email)} 登入 ✅` : '已登入 ✅'), 1500);
    if (!session){
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw new Error(/anonymous/i.test(error.message) ? '伺服器還沒開啟訪客登入' : error.message);
      session = data.session;
    }
    setCloudUser(session.user);
    sb.auth.onAuthStateChange((ev, ss) => { if (!ss || !ss.user) return; const other = Cloud.on && ss.user.id !== Cloud.userId; setCloudUser(ss.user); if (other){ cloudLoad(false).then(loadBoard).catch(() => {}); } });
    await cloudLoad(true);
    Cloud.on = true; Cloud.status = 'on';
    loadBoard(); setInterval(loadBoard, 60000);
    joinLobby();
    document.addEventListener('visibilitychange', async () => { if (document.hidden || !Cloud.on) return; cloudRefresh(); if (Cloud.isAnon){ try { const { data } = await sb.auth.getUser(); if (data && data.user && data.user.email){ setCloudUser(data.user); if (!$('#sheet').hidden && curTab === 'style') renderTab(); } } catch(e){} } });
  } catch(e){
    Cloud.status = 'error'; Cloud.err = String(e && e.message || e); console.warn('cloud off', Cloud.err);
  }
  if (!$('#sheet').hidden && curTab === 'style') renderTab();
}
// ---- Email 連結：綁定（保存這份紀錄）或在別的裝置登入 ----
// Supabase 免費方案不能改信件內容，所以用信裡的「Sign in／Confirm」連結（不用驗證碼）。
const SITE_URL = location.origin + location.pathname;
async function cloudSendLink(email, mode){
  const sb = Cloud.sb;
  if (mode === 'bind'){ const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: SITE_URL }); if (error) throw error; return; }
  const { error } = await sb.auth.signInWithOtp({ email, options:{ shouldCreateUser:false, emailRedirectTo: SITE_URL } }); if (error) throw error;
}
// 綁定：信裡的連結在哪個瀏覽器打開都可以，這裡每幾秒問一次伺服器是否已經確認
function watchBind(){
  clearInterval(Cloud.bindTimer);
  Cloud.bindTimer = setInterval(async () => {
    try { const { data } = await Cloud.sb.auth.getUser(); if (data && data.user && data.user.email){ clearInterval(Cloud.bindTimer); setCloudUser(data.user); Cloud.ui.step = 'idle'; toast('紀錄已經保存到你的 Email ✅'); if (!$('#sheet').hidden && curTab === 'style') renderTab(); } } catch(e){}
  }, 4000);
}
function cloudErrText(e){
  const m = String(e && e.message || e);
  if (/rate|security purposes|too many|seconds/i.test(m)) return '寄信太頻繁了，等一下再試（免費方案每小時只能寄幾封）。';
  if (/already.*registered|already been registered|exists/i.test(m)) return '這個 Email 已經保存過別的紀錄了，請改用「我已經保存過，登入」。';
  if (/signups not allowed|not found|user not found/i.test(m)) return '這個 Email 還沒有保存過紀錄。';
  return '發生錯誤：' + m;
}
function renderCloudBox(body){
  const box = el('div', 'field cloudbox'); box.appendChild(el('label', '', '雲端存檔'));
  const U = Cloud.ui;
  if (Cloud.status === 'connecting'){ box.appendChild(el('p', 'sub', '正在連線到雲端…')); body.appendChild(box); return; }
  if (!Cloud.on){ box.appendChild(el('p', 'sub', `目前沒有連上雲端，紀錄只存在這個瀏覽器。${Cloud.err ? '（' + Cloud.err + '）' : ''}`)); body.appendChild(box); return; }
  if (!Cloud.isAnon && Cloud.email){
    box.appendChild(el('p', 'sub', `✅ 已保存到 ${Cloud.email}。換手機或換瀏覽器時，選「我已經保存過，登入」並輸入同一個 Email，就能用同一份紀錄。`));
    body.appendChild(box); return;
  }
  if (U.step === 'idle'){
    box.appendChild(el('p', 'sub', '你的紀錄已經存在雲端（訪客身分），但只認得這個瀏覽器。綁定 Email 之後，換手機、換瀏覽器（例如 LINE 和 Chrome）都能用同一份紀錄。'));
    const row = el('div', 'tankbar');
    const b1 = el('button', 'tbtn', '綁定 Email 保存紀錄'); b1.addEventListener('click', () => { U.step = 'email'; U.mode = 'bind'; U.msg = ''; renderTab(); });
    const b2 = el('button', 'tbtn ghost', '我已經保存過，登入'); b2.addEventListener('click', () => { U.step = 'email'; U.mode = 'login'; U.msg = ''; renderTab(); });
    row.appendChild(b1); row.appendChild(b2); box.appendChild(row);
  } else if (U.step === 'sent'){
    box.appendChild(el('p', 'sub', U.mode === 'bind'
      ? `📧 確認信已寄到 ${U.email}。打開信，點裡面的確認連結（用哪支手機、哪個瀏覽器打開都可以），這裡會自動顯示「已保存」。沒收到的話看一下垃圾郵件。`
      : `📧 登入信已寄到 ${U.email}。請用「你要玩遊戲的這個瀏覽器」打開信裡的「Sign in」連結，就會回到遊戲並載入你的紀錄。如果你在 LINE 裡玩，可以長按連結複製，貼到這裡的網址列。`));
    const row = el('div', 'tankbar'); const back = el('button', 'tbtn ghost', '重新輸入'); back.addEventListener('click', () => { clearInterval(Cloud.bindTimer); U.step = 'email'; U.msg = ''; renderTab(); }); row.appendChild(back); box.appendChild(row);
  } else {
    box.appendChild(el('p', 'sub', U.mode === 'bind' ? '輸入你的 Email，我們會寄一封確認信給你。' : '輸入之前保存紀錄用的 Email，我們會寄登入連結給你。登入後，這個瀏覽器會換成那份紀錄（目前這份訪客紀錄不會保留）。'));
    const inp = el('input', 'txt'); inp.type = 'email'; inp.inputMode = 'email'; inp.autocomplete = 'email'; inp.placeholder = 'you@example.com'; inp.maxLength = 120; inp.value = U.email; box.appendChild(inp);
    if (U.msg) box.appendChild(el('p', 'sub warnmsg', U.msg));
    const row = el('div', 'tankbar');
    const go = el('button', 'tbtn', U.busy ? '寄送中…' : '寄出'); go.disabled = U.busy;
    go.addEventListener('click', async () => {
      const v = inp.value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ U.msg = 'Email 格式不對'; renderTab(); return; }
      U.busy = true; U.msg = ''; U.email = v; renderTab();
      try { await cloudSendLink(v, U.mode); U.step = 'sent'; if (U.mode === 'bind') watchBind(); } catch(e){ U.msg = cloudErrText(e); }
      U.busy = false; renderTab();
    });
    const back = el('button', 'tbtn ghost', '取消'); back.addEventListener('click', () => { U.step = 'idle'; U.msg = ''; renderTab(); });
    row.appendChild(go); row.appendChild(back); box.appendChild(row);
  }
  body.appendChild(box);
}

async function initSocial(){
  if (!window.claude || typeof window.claude.use !== 'function'){ autoJoinCode(); return; }
  const [r, d, u] = await Promise.all([ window.claude.use('room').catch(() => null), window.claude.use('db').catch(() => null), window.claude.use('user').catch(() => null) ]);
  user = u; db = d;
  if (user){ try { myId = await user.id(); } catch(e){} if (myId) await resolveNames([myId]); refreshMyName(); }
  if (r) useRoom(r);
  else autoJoinCode();
  if (db && myId){
    try { const can = await user.can('data.write'); if (can === false) dbWritable = false; } catch(e){}
    let first = true;
    db.doc('records/' + myId).onSnapshot(snap => {
      if (!snap.exists){ if (first && rec.total > 0) setTimeout(saveRemote, 50); first = false; return; }
      const remote = normRec(snap.data());
      if (remote.total > rec.total){ rec = remote; LS.set('tide.rec', rec); buildTank(); if (!$('#sheet').hidden) renderTab(); }
      else if (first && rec.total > remote.total) setTimeout(saveRemote, 50);
      first = false;
    }, () => {});
  }
  if (db){
    lbLoading = true; const timer = setTimeout(() => { lbSlow = true; if (curTab === 'rank') renderTab(); }, 10000);
    db.collection('records').orderBy('bestW', 'desc').limit(20).onSnapshot(s => { clearTimeout(timer); lbLoading = false; lbSlow = false; lb.best = s.docs.map(d => ({ id:d.id, ...normRec(d.data()) })); if (curTab === 'rank' && !$('#sheet').hidden) renderTab(); }, () => { lbLoading = false; });
    db.collection('records').orderBy('total', 'desc').limit(20).onSnapshot(s => { lb.total = s.docs.map(d => ({ id:d.id, ...normRec(d.data()) })); if (curTab === 'rank' && !$('#sheet').hidden) renderTab(); }, () => {});
  }
}
function refreshMyName(){ me.setName(nickname || (myId && profileNames[myId]) || '你'); }
let saving = false, saveAgain = false;
async function saveRemote(){
  if (!db || !myId || !dbWritable) return;
  if (saving){ saveAgain = true; return; }
  saving = true;
  try { await db.doc('records/' + myId).set(JSON.parse(JSON.stringify(rec))); }
  catch(e){ if (e && e.code === 'invalid_argument') dbWritable = false; }
  saving = false; if (saveAgain){ saveAgain = false; saveRemote(); }
}
function announceCatch(f, w, spot){ if (room && room.connected() && chatAllowed) room.emit('catch', { f: f.id, w, s: spot }).catch(() => {}); logMsg('', `你釣到了 ${f.name} ${w.toFixed(2)}kg`, true); }
const lb = { best: [], total: [] }; let lbLoading = false, lbSlow = false, lbMode = 'best';

/* ================= NPC villagers ================= */
const npcs = [
  { name:'阿潮・村民', shirt:'#7db7d7', hat:'#f6f0dd', x:1.1, z:-49.2, y:0.28, dir:new THREE.Vector2(0.15,-1).normalize() },
  { name:'小溪・村民', shirt:'#d896c3', hat:'#3fbf9d', x:-17.2, z:-2.4, y:0.28, dir:new THREE.Vector2(-1,0.1).normalize() },
  { name:'老港・漁夫', shirt:'#5b6b7a', hat:'#ffd36a', x:31.4, z:-34.4, y:0.3, dir:new THREE.Vector2(1,-0.1).normalize() },
].map(n => { const f = new Fisher({ shirt:n.shirt, hat:n.hat, name:n.name, kind:'npc' }); f.pos.set(n.x, n.y, n.z); f.baseY = n.y; f.rot = Math.atan2(n.dir.x, n.dir.y); f.fishing = true; f.bobState = 'water'; { const cp = castPoint(n.x, n.z, n.dir.x, n.dir.y, 4.5); f.bobPos.set(cp[0], 0.12, cp[1]); } f.next = now() + rand(4, 12); f.lines = ['今天的浪很溫柔呢', '聽說溪裡有會發光的魚…', '慢慢來，魚會來的', '燈塔亮的時候，月光鯛最多']; return f; });
function updateNpcs(dt, t){
  for (const n of npcs){
    if (t > n.next){ n.dip = 1; n.bend = 0.6; ripple(n.bobPos.x, n.bobPos.z); if (Math.random() < 0.35 && camera.position.distanceTo(n.pos) < 25) n.say(n.lines[Math.floor(Math.random()*n.lines.length)], '', 4); n.next = t + rand(6, 15); }
    n.dip *= Math.pow(0.08, dt); n.bend *= Math.pow(0.2, dt);
    n.update(dt, t); n.placeTag();
  }
}

/* ================= SHEET ================= */
let curTab = 'dex', tankSort = 'new';
function openSheet(tab){ sheetOpenedAt = performance.now(); curTab = tab; $('#sheet').hidden = false; uiBlocked = true; for (const k in keys) keys[k] = false; renderTab(); }
function closeSheet(){ if ($('#sheet').hidden) return; $('#sheet').hidden = true; uiBlocked = !$('#catchCard').hidden; canvas.focus(); }
$$('#menu [data-tab]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.tab)));
$$('#tabs [data-tab]').forEach(b => b.addEventListener('click', () => { curTab = b.dataset.tab; renderTab(); }));
$('#closeSheet').addEventListener('click', closeSheet);
let sheetOpenedAt = 0;   // 用按鈕打開選單的那一下，放開手指時的 click 不要把它關掉
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet' && performance.now() - sheetOpenedAt > 450) closeSheet(); });

function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function renderTab(){
  $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === curTab)));
  const body = $('#sheetBody'); body.textContent = '';
  if (curTab === 'shop'){ renderShop(body); return; }
  if (curTab === 'dex'){
    const got = FISH.filter(f => rec.count[f.id]).length;
    body.appendChild(el('p', 'sub', `已收集 ${got} / ${FISH.length} 種・總共釣到 ${rec.total} 條・傳說 ${rec.legend} 條。拋得越遠，越容易遇到稀有魚。`));
    for (const s of SPOTS){
      if (!FISH.some(f => f.spot === s.id)) continue;
      const h = el('div', 'dexhead', s.label); h.appendChild(el('small', '', s.subtitle)); body.appendChild(h);
      const g = el('div', 'dex');
      FISH.filter(f => f.spot === s.id).sort((a,b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]).forEach(f => {
        const known = !!rec.count[f.id]; const it = el('div', 'it' + (known ? '' : ' lock'));
        it.appendChild(fishCanvas(f, known, 96, 60)); it.appendChild(el('div', 'n', known ? f.name : '？？？'));
        it.appendChild(el('span', 'chip r-' + f.rarity, f.rarity));
        it.appendChild(el('div', 'meta', known ? `最大 ${rec.best[f.id].toFixed(2)}kg・${rec.count[f.id]} 條` : '尚未釣到'));
        if (f.time) it.appendChild(el('div', 'meta tm', PERIOD_LABEL[f.time].split(' ')[0] + ' ' + PERIOD_FISH[f.time]));
        g.appendChild(it);
      });
      body.appendChild(g);
    }
  } else if (curTab === 'rank'){
    const seg = el('div', 'seg');
    [['best','最大的魚'],['total','釣魚總數']].concat(Cloud.on ? [['earned','賺最多金幣']] : []).forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(lbMode === k)); b.addEventListener('click', () => { lbMode = k; renderTab(); }); seg.appendChild(b); });
    body.appendChild(seg);
    if (Cloud.on){ Object.assign(lb, Cloud.board); body.appendChild(el('p', 'sub', '全服排行榜：所有玩家的紀錄都經過伺服器檢查，每分鐘更新一次。')); }
    else if (!db){ body.appendChild(el('p', 'sub', '排行榜會跟所有打開這個村子的人同步。目前沒有連上共享資料，下面只顯示你自己的紀錄。')); }
    else if (lbSlow){ body.appendChild(el('p', 'sub', '暫時連不上排行榜，資料可能不是最新的。')); }
    const shared = db || Cloud.on;
    let rows = (lbMode === 'best' ? lb.best : lbMode === 'earned' ? (lb.earned || []) : lb.total).filter(r => r.total > 0);
    if (Cloud.on) rows = rows.map(r => r.id === myId ? Object.assign({}, r, rec, { name:r.name }) : r);   // 自己那一列用最新的資料
    if (!shared || (!rows.some(r => r.id === myId) && rec.total > 0)) rows = rows.concat([{ id: myId || 'me', ...rec, _me: true }]);
    rows.sort((a, b) => lbMode === 'best' ? b.bestW - a.bestW : lbMode === 'earned' ? (b.earned || 0) - (a.earned || 0) : b.total - a.total);
    if (!rows.length){ body.appendChild(el('div', 'empty', lbLoading ? '正在讀取排行榜…' : '還沒有人上榜。走到任何一個發光圈拋竿，成為村子裡第一個上榜的釣客吧！')); return; }
    const ul = el('ol', 'rank'); const ids = rows.map(r => r.id).filter(id => id && id !== 'me');
    rows.slice(0, 20).forEach((r, i) => {
      const isMe = r._me || r.id === myId; const li = el('li', isMe ? 'me' : '');
      li.appendChild(el('span', 'pos', String(i + 1)));
      const who = el('span', 'who', isMe ? `${myDisplayName() === '你' ? '你' : myDisplayName() + '（你）'}` : (r.name || profileNames[r.id] || '釣客'));
      who.dataset.id = r.id;
      const bf = r.bestFish && FISH_BY_ID[r.bestFish];
      who.appendChild(el('small', '', lbMode === 'best' ? (bf ? `${bf.name}・${bf.rarity}` : '') : `收集 ${Object.keys(r.count || {}).length} 種・傳說 ${r.legend || 0} 條`));
      li.appendChild(who);
      if (Cloud.on && !isMe && r.id){ who.classList.add('canvisit'); who.title = '參觀水族館'; who.addEventListener('click', () => visitAquarium(r.id, r.name)); who.appendChild(el('small', 'vlink', '🐠 點一下參觀他的水族館')); }
      li.appendChild(el('span', 'val', lbMode === 'best' ? r.bestW.toFixed(2) + ' kg' : lbMode === 'earned' ? '🪙' + (r.earned || 0).toLocaleString() : r.total + ' 條'));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    const missing = ids.filter(id => !(id in profileNames));
    if (missing.length) resolveNames(missing).then(() => { if (curTab === 'rank' && !$('#sheet').hidden) $$('.rank .who', body).forEach(w => { const id = w.dataset.id; if (id !== myId && profileNames[id]) w.firstChild.textContent = profileNames[id]; }); });
  } else if (curTab === 'tank'){
    const picking = rec.show && rec.show.length > 0;
    body.appendChild(el('p', 'sub', picking
      ? `你選了 ${rec.show.length} / ${SHOW_MAX} 條魚放進廣場北邊的大水族館。點「展示」可以放進去或拿出來，「放生」會把這條魚從魚缸移走。`
      : `現在是自動模式：最新的 ${SHOW_MAX} 條魚會放進大水族館。按任何一條的「展示／展示中」，就會改成由你自己調整。`));
    if (!rec.tank.length){ body.appendChild(el('div', 'empty', '魚缸還是空的。去任何一個釣點釣第一條魚吧！')); return; }
    const bar = el('div', 'tankbar');
    if (picking){ const auto = el('button', 'tbtn ghost', '改回自動展示'); auto.addEventListener('click', () => { rec.show = []; saveRecLocal(); buildTank(); renderTab(); cloudCall('set_show', { p_show: [] }); }); bar.appendChild(auto); }
    const sortSel = el('div', 'seg');
    [['new','最新'],['big','最重'],['rare','最稀有']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String((tankSort || 'new') === k)); b.addEventListener('click', () => { tankSort = k; renderTab(); }); sortSel.appendChild(b); });
    bar.appendChild(sortSel); body.appendChild(bar);
    const shown = new Set(shownFish().map(x => x.t));
    let list = rec.tank.slice();
    if (tankSort === 'big') list.sort((a, b) => b.w - a.w);
    else if (tankSort === 'rare') list.sort((a, b) => RARITY_ORDER[FISH_BY_ID[b.f].rarity] - RARITY_ORDER[FISH_BY_ID[a.f].rarity] || b.w - a.w);
    const ul = el('ul', 'tank');
    list.forEach(x => {
      const f = FISH_BY_ID[x.f]; const li = el('li' , shown.has(x.t) ? 'on' : ''); li.appendChild(fishCanvas(f, true, 56, 36));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', f.name)); const dt = new Date(x.t);
      d.appendChild(el('div', 'meta', `${x.w.toFixed(2)}kg・${f.rarity}・${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`)); li.appendChild(d);
      const acts = el('div', 'tacts');
      const show = el('button', 'tbtn' + (shown.has(x.t) ? '' : ' ghost'), shown.has(x.t) ? '展示中' : '展示'); show.setAttribute('aria-pressed', String(shown.has(x.t)));
      show.addEventListener('click', () => {
        if (!rec.show || !rec.show.length) rec.show = shownFish().map(y => y.t);   // 第一次自己挑：從目前展示的魚開始調整
        const i = rec.show.indexOf(x.t);
        if (i >= 0) rec.show.splice(i, 1);
        else { if (rec.show.length >= SHOW_MAX){ toast(`水族館最多放 ${SHOW_MAX} 條，先拿出一條再放。`); return; } rec.show.push(x.t); }
        saveRecLocal(); buildTank(); renderTab(); cloudCall('set_show', { p_show: rec.show.slice() });
      });
      const rel = el('button', 'tbtn ghost', '放生');
      rel.addEventListener('click', () => {
        if (rel.dataset.sure !== '1'){ rel.dataset.sure = '1'; rel.textContent = '確定放生？'; setTimeout(() => { if (rel.isConnected){ rel.dataset.sure = ''; rel.textContent = '放生'; } }, 2500); return; }
        rec.tank = rec.tank.filter(y => y.t !== x.t); if (rec.show) rec.show = rec.show.filter(t => t !== x.t);
        saveRecLocal(); buildTank(); renderTab(); toast(`${esc(f.name)} 游回大海了。`); cloudCall('release_fish', { p_ts: x.t });
      });
      acts.append(show, rel); li.appendChild(acts); ul.appendChild(li);
    });
    body.appendChild(ul);
  } else if (curTab === 'people'){
    if (room && room.isLobby){ body.appendChild(el('p', 'sub', `你在公共大廳 ${room.lobbyNo}：打開遊戲的人都會自動來這裡（每個大廳最多 ${LOBBY_MAX} 人，滿了會分到下一個）。想只跟朋友玩，可以開私人房間。`)); body.appendChild(pjBox()); }
    else if (room && !pjMode) body.appendChild(el('p', 'sub', '現在在村子裡的人。分享這個頁面的連結給朋友，就能一起釣魚、聊天。'));
    else if (pjAvailable()) body.appendChild(pjBox());
    else body.appendChild(el('p', 'sub', '目前是單人模式。在 claude.ai 上開啟並分享這個頁面，朋友加入後就會出現在這裡。'));
    const ul = el('ul', 'people');
    const add = (name, color, st, isMe, uid, peerId) => { const li = el('li'); const sw = el('span', 'sw'); sw.style.background = color; li.append(sw, el('span', '', name + (isMe ? '（你）' : '')), el('span', 'st', st));
      if (uid && Cloud.on && !isMe){ const v = el('button', 'tbtn ghost vbtn', '參觀水族館'); v.addEventListener('click', () => visitAquarium(uid, name)); li.appendChild(v); }
      if (peerId){ const bk = el('button', 'tbtn ghost vbtn bk', '封鎖'); bk.addEventListener('click', () => { if (bk.dataset.sure !== '1'){ bk.dataset.sure = '1'; bk.textContent = '確定封鎖？'; bk.classList.add('warn'); return; } blockPeer(peerId, name); renderTab(); }); li.appendChild(bk); }
      ul.appendChild(li); };
    const stOf = (ph, x, z) => { if (ph){ const s = SPOTS.reduce((a, b) => Math.hypot(x-a.pos.x, z-a.pos.z) < Math.hypot(x-b.pos.x, z-b.pos.z) ? a : b); return `在${s.short}釣魚中`; } return '散步中'; };
    add(myDisplayName() === '你' ? '你' : myDisplayName(), look.shirt, stOf(me.fishing, me.pos.x, me.pos.z), true);
    for (const p of peers.values()) add(peerName(p) + (p.guest ? '・訪客' : ''), isHex(p.pres.sh) ? p.pres.sh : '#9fb3bf', stOf(!!p.pres.f, p.target.x, p.target.z), false, typeof p.pres.u === 'string' ? p.pres.u : null, [...peers.entries()].find(([k, v]) => v === p)[0]);
    for (const n of npcs) add(n.nm.textContent, n.av.shirtM.color.getStyle(), '在岸邊釣魚（NPC）');
    body.appendChild(ul);
    const bl = Object.entries(blockList);
    if (bl.length){
      const h = el('div', 'dexhead', `已封鎖（${bl.length}）`); body.appendChild(h);
      const ub = el('ul', 'people');
      for (const [u, n] of bl){ const li = el('li'); li.append(el('span', '', n)); const b = el('button', 'tbtn ghost vbtn', '解除封鎖'); b.addEventListener('click', () => { unblock(u); renderTab(); }); li.appendChild(b); ub.appendChild(li); }
      body.appendChild(ub);
    }
    body.appendChild(el('p', 'sub', '有人講話不禮貌，按「封鎖」後就看不到他的角色、聊天和動態（只對你自己有效）。'));
  } else if (curTab === 'map'){
    renderMap(body);
  } else if (curTab === 'style'){
    renderCloudBox(body);
    const f1 = el('div', 'field'); f1.appendChild(el('label', '', '衣服顏色')); const s1 = el('div', 'swatches');
    SHIRTS.forEach(c => { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', '衣服 ' + c); b.setAttribute('aria-pressed', String(look.shirt === c)); b.addEventListener('click', () => { look.shirt = c; saveLook(); renderTab(); }); s1.appendChild(b); });
    f1.appendChild(s1); body.appendChild(f1);
    const f2 = el('div', 'field'); f2.appendChild(el('label', '', '帽子顏色')); const s2 = el('div', 'swatches');
    HATS.forEach(c => { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', '帽子 ' + c); b.setAttribute('aria-pressed', String(look.hat === c)); b.addEventListener('click', () => { look.hat = c; saveLook(); renderTab(); }); s2.appendChild(b); });
    f2.appendChild(s2); body.appendChild(f2);
    const f3 = el('div', 'field'); const lab = el('label', '', '暱稱'); lab.htmlFor = 'nickIn'; f3.appendChild(lab);
    const inp = el('input', 'txt'); inp.id = 'nickIn'; inp.maxLength = 16; inp.value = nickname; inp.placeholder = (myId && profileNames[myId]) || '例如：小陳';
    inp.addEventListener('change', () => { nickname = clean(inp.value.trim().slice(0, 16)); inp.value = nickname; LS.set('tide.nick', nickname); refreshMyName(); pushPresence(true); cloudProfile(); });
    f3.appendChild(inp); f3.appendChild(el('p', 'sub', '其他玩家會在你頭上看到這個名字。'));
    body.appendChild(f3);
    const ff = el('div', 'field'); ff.appendChild(el('label', '', '聊天'));
    const fseg = el('div', 'seg');
    [[true, '過濾不雅文字'], [false, '不過濾']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(filterOn === k)); b.addEventListener('click', () => { filterOn = k; LS.set('tide.filter', k); renderTab(); }); fseg.appendChild(b); });
    ff.appendChild(fseg); ff.appendChild(el('p', 'sub', '開啟時，別人聊天和名字裡的髒話會變成＊＊。')); body.appendChild(ff);
    const fq = el('div', 'field'); fq.appendChild(el('label', '', '畫質'));
    const seg = el('div', 'seg');
    [['auto','自動'],['low','低'],['mid','中'],['high','高']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(Quality.setting === k)); b.addEventListener('click', () => { Quality.setting = k; LS.set('tide.quality', k); applyQuality(k === 'auto' ? Quality.detect() : k); renderTab(); }); seg.appendChild(b); });
    fq.appendChild(seg);
    fq.appendChild(el('p', 'sub', `目前：${TIERS[Quality.tier].label}。手機發燙或卡頓時選「低」；「高」會開啟較清晰的陰影和更多花草。`));
    body.appendChild(fq);
  } else if (curTab === 'help'){
    body.appendChild(el('p', 'sub', '島上有 6 個釣點，每個地方的魚都不一樣。大型魚在港口外海，螢光溪間藏在南邊森林深處。在港口和鏡湖可以搭小船，划到水上任何地方釣魚。走過的地點可以從「地圖」直接傳送。'));
    const k = el('div', 'kbd');
    [['移動', isTouch ? '左下搖桿' : 'WASD / 方向鍵（Shift 跑步）'], ['轉視角', isTouch ? '在畫面上拖曳' : '拖曳滑鼠・滾輪縮放'], ['拋竿', '按住蓄力，放開拋出；拋越遠越容易遇到稀有魚'], ['提竿', '浮標猛沉、出現「!」時馬上按'], ['拉線', '按住收線、放開卸力，讓拉力停在綠色區'], ['聊天', isTouch ? '💬 按鈕' : 'Enter'], ['表情', isTouch ? '右下表情按鈕' : '1 / 2 / 3'], ['音樂', '右上角音符按鈕開關背景音樂（喇叭按鈕是音效）']].forEach(([a, b]) => { k.appendChild(el('kbd', '', a)); k.appendChild(el('span', '', b)); });
    body.appendChild(k);
    body.appendChild(el('p', 'sub', '賺金幣：走到「海邊商店」把魚缸裡的魚賣掉，越重越值錢。到「釣具店」可以買更好的釣竿和魚餌：好竿子拉線時比較不容易斷，魚餌能提高稀有魚和傳說魚的機率。'));
    body.appendChild(el('p', 'sub', '魚的 3D 模型：Animated Fish Pack by Quaternius（CC0 授權，quaternius.com）。'));
  }
}
function pjBox(){
  const box = el('div', 'field');
  if (room && pjMode){
    box.appendChild(el('label', '', '房間代碼'));
    const code = el('div', ''); code.style.cssText = 'font-family:var(--f-display);font-size:34px;letter-spacing:.3em;color:var(--sea)'; code.textContent = room.code || ''; box.appendChild(code);
    box.appendChild(el('p', 'sub', '把這 5 個字母，或下面的連結傳給朋友。朋友在「玩家」分頁輸入代碼，或直接點連結就能進來。開房的人關掉頁面，大家就會斷線。'));
    const row = el('div', ''); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const share = el('button', 'pbtn', '分享連結'); share.style.cssText = 'margin:0;width:auto;padding:10px 16px';
    share.addEventListener('click', async () => { const url = location.href.split('#')[0] + '#room=' + room.code; try { if (navigator.share) await navigator.share({ title:'潮汐釣魚村', text:'來一起釣魚！房間代碼 ' + room.code, url }); else { await navigator.clipboard.writeText(url); toast('已複製連結'); } } catch(e){} });
    const leave = el('button', 'pbtn', '離開房間'); leave.style.cssText = 'margin:0;width:auto;padding:10px 16px;background:var(--paper-2);color:var(--ink)';
    leave.addEventListener('click', () => { pjLeave(); renderTab(); });
    row.append(share, leave); box.appendChild(row);
    return box;
  }
  box.appendChild(el('p', 'sub', room && room.isLobby ? '私人房間：開一個房間，或輸入朋友給的 5 個字母，就會離開大廳、只跟朋友一起玩。' : '目前是單人模式。開一個房間，或輸入朋友給的 5 個字母，就能一起釣魚、聊天。先到「造型」分頁取個暱稱，朋友才認得出你。'));
  const host = el('button', 'pbtn', '開新房間'); host.style.marginTop = '0'; host.addEventListener('click', () => pjStart('host'));
  box.appendChild(host);
  const row = el('div', ''); row.style.cssText = 'display:flex;gap:8px;margin-top:12px';
  const inp = el('input', 'txt'); inp.maxLength = 5; inp.placeholder = '房間代碼，例如 KMRTA'; inp.style.cssText = 'flex:1;min-width:0;text-transform:uppercase;letter-spacing:.15em';
  const go = el('button', 'pbtn', '加入'); go.style.cssText = 'margin:0;width:auto;padding:10px 18px';
  go.addEventListener('click', () => { const c = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); if (c.length !== 5) { toast('房間代碼是 5 個英文字母'); return; } pjStart('join', c); });
  row.append(inp, go); box.appendChild(row);
  return box;
}
function saveLook(){ LS.set('tide.look', look); me.setLook(look.shirt, look.hat); pushPresence(true); cloudProfile(); }

// landscape / fullscreen
const portraitMQ = matchMedia('(orientation: portrait)');
function syncOrient(){ document.body.classList.toggle('portrait', portraitMQ.matches); setTimeout(resize, 120); }
(portraitMQ.addEventListener ? portraitMQ.addEventListener('change', syncOrient) : portraitMQ.addListener(syncOrient)); syncOrient();
addEventListener('orientationchange', () => setTimeout(resize, 250));
const fsEl = document.documentElement;
const canFS = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
if (canFS) $('#fsBtn').classList.add('ok');
async function goLandscape(){
  ensureAudio();
  try { if (!document.fullscreenElement){ await (fsEl.requestFullscreen ? fsEl.requestFullscreen({ navigationUI:'hide' }) : fsEl.webkitRequestFullscreen()); } } catch(e){}
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch(e){}
  setTimeout(() => { if (portraitMQ.matches) toast('這個瀏覽器不能自動轉向，請手動把手機轉成橫向，或關掉螢幕旋轉鎖定。'); }, 700);
}
$('#rotFull').addEventListener('click', goLandscape);
$('#rotate').addEventListener('click', e => { if (e.target.id !== 'rotSkip') goLandscape(); });
$('#rotSkip').addEventListener('click', () => document.body.classList.add('allowPortrait'));
$('#fsBtn').addEventListener('click', () => { if (document.fullscreenElement){ document.exitFullscreen().catch(() => {}); } else goLandscape(); });

// hint
if (isTouch) $('#hintTxt').textContent = '左下搖桿移動・拖曳畫面轉視角・走進發光圈按住按鈕拋竿';
if (LS.get('tide.hintSeen', false)) $('#hint').hidden = true;
$('#hintX').addEventListener('click', () => { $('#hint').hidden = true; LS.set('tide.hintSeen', true); });

/* ================= LOOP ================= */
let last = now(), frameNo = 0;
// 開發用效能面板：網址後面加 #debug 才會出現
const debugEl = /debug/.test(location.hash) ? Object.assign(document.createElement('div'), { className:'panel', id:'debugPanel' }) : null;
if (debugEl){ debugEl.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);padding:6px 10px;font:12px/1.4 ui-monospace,monospace;z-index:40;pointer-events:none;white-space:nowrap'; document.body.appendChild(debugEl); }
function updateDebug(){
  const i = renderer.info, b = Quality.batched;
  debugEl.textContent = `FPS ${Quality.fps ? Quality.fps.toFixed(0) : '…'} · 繪製 ${i.render.calls} · 三角形 ${(i.render.triangles/1000).toFixed(1)}k · 畫質 ${TIERS[Quality.tier].label}${Quality.setting === 'auto' ? '(自動)' : ''} · 合併 ${b ? b.before + '→' + b.after : '關'}`;
}
/* ================= DAY / NIGHT：日夜循環 ================= */
// 一天 = 現實 36 分鐘。用現實時間換算，所以同一時刻所有玩家看到的天色都一樣（不用連線同步）。
// 網址加 #hour=21 可以固定時間（測試或拍照用）。
const DAY_LEN = 36 * 60;
const DAY_KEYS = [   // h：遊戲裡的幾點；顏色都是 sRGB
  { h:0,    top:'#1b2a5a', hor:'#3d5288', low:'#2c3d6b', sun:'#a9bcff', si:0.55, hs:'#8494d8', hg:'#2b3550', hi:0.8,  lamp:1,   stars:1,   wl:'#5d6f9e', disc:'#eef2ff' },
  { h:4.8,  top:'#1b2a5a', hor:'#3d5288', low:'#2c3d6b', sun:'#a9bcff', si:0.55, hs:'#8494d8', hg:'#2b3550', hi:0.8,  lamp:1,   stars:1,   wl:'#5d6f9e', disc:'#eef2ff' },
  { h:6,    top:'#5f7cc0', hor:'#f6b892', low:'#d9aa9c', sun:'#ffb47e', si:1.2,  hs:'#ffd6bd', hg:'#5a5f5c', hi:1.15, lamp:0.4, stars:0.15, wl:'#d9c2c0', disc:'#ffcf8f' },
  { h:7.5,  top:'#62bfe8', hor:'#d6f0ee', low:'#c3e6df', sun:'#fff1d8', si:2.0,  hs:'#e7fbff', hg:'#52725c', hi:1.45, lamp:0,   stars:0,   wl:'#ffffff', disc:'#ffe8ae' },
  { h:16.3, top:'#62bfe8', hor:'#c6ecef', low:'#b7e5df', sun:'#fff4d2', si:2.2,  hs:'#e7fbff', hg:'#52725c', hi:1.55, lamp:0,   stars:0,   wl:'#ffffff', disc:'#ffe8ae' },
  { h:18,   top:'#4b62ad', hor:'#ffaf78', low:'#e6a48c', sun:'#ff9c60', si:1.45, hs:'#ffcaa8', hg:'#4f4a52', hi:1.1,  lamp:0.7, stars:0.1, wl:'#e8b9a8', disc:'#ff9e5e' },
  { h:19.6, top:'#1b2a5a', hor:'#3d5288', low:'#2c3d6b', sun:'#a9bcff', si:0.55, hs:'#8494d8', hg:'#2b3550', hi:0.8,  lamp:1,   stars:1,   wl:'#5d6f9e', disc:'#eef2ff' },
  { h:24,   top:'#1b2a5a', hor:'#3d5288', low:'#2c3d6b', sun:'#a9bcff', si:0.55, hs:'#8494d8', hg:'#2b3550', hi:0.8,  lamp:1,   stars:1,   wl:'#5d6f9e', disc:'#eef2ff' },
];
const DayNight = { hour: 12, fixed: null, lamp: 0, period: 'day' };
{ const m = location.hash.match(/hour=(\d+(?:\.\d+)?)/); if (m) DayNight.fixed = clamp(+m[1], 0, 23.99); }
function gameHour(){ if (DayNight.fixed != null) return DayNight.fixed; const sec = (Date.now() / 1000) % DAY_LEN; return (sec / DAY_LEN * 24 + 8) % 24; }   // 新的一天從早上 8 點開始算
// 時段：day 白天、twilight 清晨與黃昏、night 晚上（魚種會依時段出現）
function periodOf(h){ return h >= 7.5 && h < 17 ? 'day' : (h >= 5 && h < 7.5) || (h >= 17 && h < 19.6) ? 'twilight' : 'night'; }
const PERIOD_LABEL = { day:'☀️ 白天', twilight:'🌇 黃昏', night:'🌙 晚上' };
const PERIOD_FISH = { day:'白天比較多', twilight:'清晨和黃昏比較多', night:'晚上比較多' };
// 星星：只在晚上出現
const stars = (() => {
  const n = 420, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, y = 0.12 + Math.pow(Math.random(), 0.7) * 0.88, r = Math.sqrt(1 - y * y); pos[i*3] = Math.cos(a) * r * 175; pos[i*3+1] = y * 175; pos[i*3+2] = Math.sin(a) * r * 175; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color:'#ffffff', size:1.6, sizeAttenuation:true, transparent:true, opacity:0, depthWrite:false, fog:false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9; scene.add(p); return p;
})();
// 燈塔晚上的旋轉光束
const lhBeam = (() => {
  if (!lhLight) return null;
  const geo = new THREE.ConeGeometry(2.6, 30, 20, 1, true); geo.translate(0, -13, 0); geo.rotateZ(Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color:'#fff3c0', transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false });
  const b = new THREE.Mesh(geo, m); const wp = new THREE.Vector3(); lhLight.getWorldPosition(wp); b.position.copy(wp); b.visible = false; scene.add(b); return b;
})();
const _cA = new THREE.Color(), _cB = new THREE.Color();
function lerpKey(k0, k1, f, key, out){ _cA.set(k0[key]); _cB.set(k1[key]); return out.copy(_cA).lerp(_cB, f); }
const _sunDir = new THREE.Vector3();
function updateDayNight(t){
  const h = gameHour(); DayNight.hour = h; DayNight.period = periodOf(h);
  let i = 0; while (i < DAY_KEYS.length - 2 && h >= DAY_KEYS[i + 1].h) i++;
  const k0 = DAY_KEYS[i], k1 = DAY_KEYS[i + 1], f = clamp((h - k0.h) / (k1.h - k0.h), 0, 1);
  const num = key => k0[key] + (k1[key] - k0[key]) * f;
  // 太陽（晚上換成月亮）的方向：白天從東邊升起、西邊落下
  const dayK = clamp((h - 5.5) / 14.5, 0, 1), night = h < 5.5 || h >= 20;
  let ang; if (!night) ang = dayK * Math.PI; else { const nh = h >= 20 ? h - 20 : h + 4; ang = clamp(nh / 9.5, 0, 1) * Math.PI; }
  _sunDir.set(Math.cos(ang) * 0.8, Math.max(0.18, Math.sin(ang)) * 0.75, -0.55).normalize();
  lerpKey(k0, k1, f, 'sun', sun.color); sun.intensity = num('si') * (MODERN ? 1 : 0.57);
  lerpKey(k0, k1, f, 'hs', hemi.color); lerpKey(k0, k1, f, 'hg', hemi.groundColor); hemi.intensity = num('hi') * (MODERN ? 1 : 0.68);
  lerpKey(k0, k1, f, 'low', scene.fog.color); lerpKey(k0, k1, f, 'top', scene.background);
  if (skyDome){ const u = skyDome.material.uniforms; lerpKey(k0, k1, f, 'top', u.uTop.value); lerpKey(k0, k1, f, 'hor', u.uHor.value); lerpKey(k0, k1, f, 'low', u.uLow.value); lerpKey(k0, k1, f, 'disc', u.uSunCol.value); u.uSun.value.copy(_sunDir); }
  if (waterSurface){ const u = waterSurface.material.uniforms; lerpKey(k0, k1, f, 'top', u.uSkyTop.value).lerp(_cB.set('#6cc4ea'), 0.25); lerpKey(k0, k1, f, 'hor', u.uSkyHor.value); lerpKey(k0, k1, f, 'wl', u.uLight.value); lerpKey(k0, k1, f, 'disc', u.uGlint.value); u.uSun.value.copy(_sunDir); }
  if (sunDisc){ sunDisc.position.copy(camera.position).addScaledVector(_sunDir, 160); lerpKey(k0, k1, f, 'disc', sunDisc.material.color); sunDisc.scale.setScalar(night ? 0.7 : 1); }
  const lamp = num('lamp'), st = num('stars'); DayNight.lamp = lamp;
  stars.material.opacity = st * 0.9; stars.visible = st > 0.02; stars.position.copy(camera.position); stars.rotation.y = t * 0.004;
  if (windowGlass) windowGlass.emissiveIntensity = 0.18 + lamp * 1.1;
  if (tankWaterMat) tankWaterMat.emissiveIntensity = lamp * 0.55;   // 晚上水族館會亮
  if (lhBeam){ lhBeam.visible = lamp > 0.3; lhBeam.material.opacity = lamp * 0.09; lhBeam.rotation.y = t * 0.7; }
  // 陰影跟著太陽／月亮的方向
  sun.position.set(me.pos.x + _sunDir.x * 40, _sunDir.y * 40, me.pos.z + _sunDir.z * 40); sun.target.position.set(me.pos.x, 0, me.pos.z);
  // 左上角的時間
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10, txt = `${DayNight.period === 'twilight' && h < 12 ? '🌅 清晨' : PERIOD_LABEL[DayNight.period]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const ck = $('#clock'); if (ck && ck._t !== txt){ ck.textContent = txt; ck._t = txt; }
  if (DayNight.period !== DayNight._last){ if (DayNight._last) ticker(DayNight.period === 'night' ? '天黑了，<b>晚上</b>出沒的魚開始活動 🌙' : DayNight.period === 'twilight' ? (h < 12 ? '天快亮了，清晨的魚正活躍 🌅' : '黃昏了，有些魚只在這時候出現 🌇') : '天亮了 ☀️'); DayNight._last = DayNight.period; }
}

camera.position.set(4, 5, 18);
function frame(){
  const t = now(); const dt = Math.min(0.05, t - last); last = t; frameNo++;
  updatePlayer(dt); updateFishing(dt, t); me.update(dt, t); updateCamera(dt); me.placeTag();
  updatePeers(dt, t); updateNpcs(dt, t); updateJumpers(dt, t); updateTank(t);
  // water
  if (frameNo % TIERS[Quality.tier].waterEvery === 0) for (const w of animWater){ const pos = w.m.geometry.attributes.position; const a = pos.array; const ox = w.m.position.x, oz = w.m.position.z; for (let i = 0; i < a.length; i += 3) a[i+1] = waterY(a[i] + ox, a[i+2] + oz, t) - 0.01; pos.needsUpdate = true; if (frameNo % 2 === 0) w.m.geometry.computeVertexNormals(); }
  for (const s of schools){ s.g.visible = Math.hypot(me.pos.x - s.g.position.x, me.pos.z - s.g.position.z) < 40; if (!s.g.visible) continue; s.g.rotation.y += dt * 0.28; s.g.children.forEach((f, i) => { if (f.userData.tail) f.userData.tail.rotation.y = Math.sin(t*7 + i)*0.5; }); }
  updateDayNight(t);
  for (const l of lanterns) l.material.emissiveIntensity = (0.6 + DayNight.lamp * 1.8) + Math.sin(t*2 + l.position.x) * 0.25;
  if (lhLight) lhLight.material.emissiveIntensity = (1.6 + DayNight.lamp * 2.4) + Math.sin(t*1.5) * 1.2;
  for (const s of SPOTS) if (s.ring) s.ring.material.emissiveIntensity = 1.4 + Math.sin(t*3 + s.pos.x)*0.5;
  for (const c of clouds){ c.g.position.x += c.v * dt; if (c.g.position.x > 70) c.g.position.x = -70; }
  for (const r of ripples){ if (r.t > 1.2){ r.m.visible = false; continue; } r.t += dt; const k = r.t / 1.2; r.m.scale.setScalar((1 + k*7) * r.big); r.m.material.opacity = (1 - k) * 0.8; }
  discover(t); updateBoatButton();
  { const jb = $('#jumpBtn'), hide = !!myBoat || F.phase !== 'idle'; if (jb.hidden !== hide) jb.hidden = hide; }
  if (waterfall && Math.hypot(me.pos.x - waterfall.x, me.pos.z - waterfall.z) < 45){ if (Math.random() < dt * 10) FX.emit(waterfall.x + rand(-1, 1), 0.3, waterfall.z + rand(-0.5, 0.5), 1, '#ffffff', 0.9, 1.6, 0.7); if (Math.random() < dt * 1.5) ripple(waterfall.x + rand(-0.8, 0.8), waterfall.z + rand(-0.4, 0.4)); }
  fishTime.value = t; updateSeaLife(t); FX.update(dt); if (skyDome) skyDome.position.copy(camera.position); updateZones(t); watchFps(t);
  placeLabelsUpdate();
  renderer.render(scene, camera);
  if (debugEl && frameNo % 15 === 0) updateDebug();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
logMsg('', '歡迎來到潮汐釣魚村！走進任一個發光圈就可以拋竿。', true);
initSocial().catch(() => {});
cloudInit();
})();
