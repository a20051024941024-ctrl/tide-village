// 潮汐釣魚村：遊戲主程式
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FISH_MESH } from './fish-models.js';
import * as FishGen from './fish-gen.js';
import { SPECS as FISH_SPECS } from './fish-specs.js';
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
  { id:'manta',   spot:'harbor',   name:'星紋魟魚', rarity:'稀有', color:'#2f4d6b', min:12, max:45,  w:0.2, power:0.72, desc:'像披風一樣在海面下滑行，背上的星紋只有晴天才看得到。' },
  { id:'dolphin', spot:'harbor',   name:'晴潮海豚', rarity:'稀有', color:'#7f8fa3', min:40, max:150, power:0.7,  w:0.2, desc:'喜歡追著船跑的聰明傢伙。合照之後牠會對你眨眨眼，再游回海裡。' },
  { id:'shark',   spot:'harbor',   name:'礁岩鯊',   rarity:'傳說', color:'#3f5f78', min:60, max:250, power:0.97, w:0.6, desc:'在燈塔下方的深水巡游。力氣非常大，拉線時千萬別硬拉。' },
  { id:'orca',    spot:'harbor',   name:'浪花虎鯨', rarity:'傳說', color:'#2b3138', min:1200, max:5500, power:0.98, w:0.3, desc:'黑白分明的海上獵手，常常成群在港口外繞圈。拉線時牠會突然轉向，要跟著放線。' },
  { id:'beluga',  spot:'harbor',   name:'月白白鯨', rarity:'稀有', color:'#e4ebf0', min:400, max:1500, power:0.76, w:0.15, desc:'圓圓的額頭軟軟的，看起來一直在對你笑。聽說牠會學海鷗叫。' },
  { id:'sunfish', spot:'harbor', time:'day',   name:'慵懶翻車魚', rarity:'稀有', color:'#8fa3b8', min:60, max:900, power:0.55, w:0.18, desc:'喜歡側躺在海面曬太陽，看起來很懶，其實是在等海鳥幫牠清潔身體。' },
  { id:'sperm',   spot:'harbor', time:'night',   name:'深潛抹香鯨', rarity:'傳說', color:'#6d7f96', min:3000, max:15000, power:1.0, w:0.18, desc:'方方的大頭可以潛到最深的海溝。能把牠拉上岸的人，手臂一定很有力。' },
  { id:'whaleshark', spot:'harbor', time:'day', name:'星斑鯨鯊', rarity:'傳說', color:'#7f8c99', min:2000, max:12000, power:0.96, w:0.22, desc:'世界上最大的魚，背上滿是白色星點。脾氣非常溫和，只吃小小的浮游生物。' },
  { id:'whale',   spot:'harbor',   name:'座頭鯨',   rarity:'傳說', color:'#34395e', min:900, max:3000, power:1.0, w:0.25, desc:'偶爾會游進海灣唱歌。能釣上牠的人，整個村子都會記住你的名字。' },
  // creek
  { id:'kuhua',  spot:'pool', name:'清溪苦花', rarity:'常見', color:'#9fd8c4', min:0.2, max:0.8, power:0.34, desc:'只住在最乾淨的溪水裡，身上有一條淡淡的光帶。' },
  { id:'ayu',    spot:'pool', time:'twilight', name:'霧溪香魚', rarity:'常見', color:'#b8e0a0', min:0.1, max:0.6, power:0.32, desc:'聞起來有西瓜般的清香，是溪間居民的驕傲。' },
  { id:'goby',   spot:'creek', time:'night', name:'紫晶蝦虎', rarity:'稀有', color:'#9b7bff', min:0.1, max:0.5, power:0.58, desc:'在螢光石旁邊發出紫色微光，個頭小但很會掙扎。' },
  { id:'trout',  spot:'creek', time:'night', name:'星點溪鱒', rarity:'傳說', color:'#c084ff', min:1.2, max:4.5, power:0.88, desc:'身上的星點跟夜空一模一樣。據說是螢光溪的守護者。' },
  // 2026-11 新魚
  { id:'tilapia', spot:'river', name:'河口吳郭魚', rarity:'常見', color:'#7d8f78', min:0.3, max:1.5, power:0.36, desc:'什麼環境都能活，咬餌很積極，是河岸最好釣的魚之一。' },
  { id:'eel',     spot:'river', time:'night', name:'月影鰻', rarity:'稀有', color:'#4a4f32', min:0.5, max:3.0, power:0.7, desc:'晚上才從石縫鑽出來，身體滑溜溜的，拉上岸還會一直扭。' },
  { id:'carp',    spot:'lake',  name:'金鱗大鯉', rarity:'稀有', color:'#d39a36', min:1.5, max:8.0, power:0.68, desc:'鏡湖裡活了很久的大鯉魚，金色鱗片一片一片像銅板。' },
  { id:'loach',   spot:'pool',  time:'twilight', name:'石縫泥鰍', rarity:'常見', color:'#7d6a4a', min:0.05, max:0.3, power:0.3, desc:'躲在潭底的石縫裡，抓在手上滑來滑去，很難拿穩。' },
  { id:'puffer',  spot:'sea',   name:'圓滾河豚', rarity:'稀有', color:'#c9b06a', min:0.3, max:2.0, power:0.5, desc:'一緊張就鼓成一顆球，身上的刺全部豎起來。千萬不要拿去生吃！' },
  { id:'squid',   spot:'sea',   time:'night', name:'透光小卷', rarity:'常見', color:'#f0b9a8', min:0.1, max:0.6, power:0.4, desc:'晚上會被碼頭的燈光吸引過來，身體幾乎是透明的。' },
  { id:'bonito',  spot:'sea',   time:'day', name:'藍背鰹魚', rarity:'常見', color:'#2c4f80', min:0.8, max:3.0, power:0.5, desc:'成群在近海追小魚，游得很快，力氣比看起來大。' },
  { id:'tuna',    spot:'harbor', name:'黑鮪魚', rarity:'傳說', color:'#1c2f4d', min:80, max:450, power:0.97, w:0.5, desc:'游得比船還快的遠洋魚，一條就能讓整個食堂忙上一整天。' },
  { id:'lantern', spot:'creek', time:'night', name:'螢光燈籠魚', rarity:'稀有', color:'#3fbf9d', min:0.2, max:0.9, power:0.55, desc:'身體會發出淡綠色的光，螢光溪晚上會這麼亮，有一半是牠們的功勞。' },
  { id:'clown',   spot:'isle',  name:'小丑魚', rarity:'常見', color:'#ff7a2a', min:0.05, max:0.25, power:0.32, desc:'住在小島碼頭下的海葵裡，橘白條紋很好認。只有小島釣得到。' },
  { id:'parrot',  spot:'isle',  time:'day', name:'彩虹鸚哥魚', rarity:'稀有', color:'#2fc6a6', min:0.8, max:4.0, power:0.6, desc:'嘴巴像鸚鵡，會啃珊瑚。每一條的顏色都不太一樣。只有小島釣得到。' },
  // 頭足類：墨魚、章魚、魷魚
  { id:'cuttle',  spot:'sea',   name:'斑馬墨魚', rarity:'稀有', color:'#8a5a4a', min:0.5, max:3.0, power:0.55, desc:'背上的斑馬紋會像波浪一樣流動。生氣的時候會噴出一大團墨汁。' },
  { id:'octopus', spot:'harbor', time:'night', name:'紅石章魚', rarity:'稀有', color:'#d0553f', min:2.0, max:15, power:0.74, desc:'八隻腳上滿是吸盤，會緊緊抱住礁石不放。拉線的時候要有耐心。' },
  { id:'ika',     spot:'harbor', time:'night', name:'劍尖魷魚', rarity:'常見', color:'#e88a6a', min:0.6, max:4.0, power:0.48, desc:'晚上成群浮到海面附近，被燈光一照，身體會變成粉紅色。' },
  { id:'giantsquid', spot:'harbor', time:'night', name:'大王魷魚', rarity:'傳說', color:'#b8383a', min:120, max:500, power:0.99, w:0.25, desc:'傳說中住在最深海溝的巨大魷魚，眼睛比餐盤還大。很少有人見過牠。' },
  // 2026-11 第三批
  { id:'snakehead', spot:'river', name:'黑斑雷魚', rarity:'稀有', color:'#3d4a2e', min:1.0, max:5.0, power:0.72, desc:'河岸草叢裡的霸王，會突然從水草裡衝出來咬餌。' },
  { id:'bass',    spot:'lake',  name:'大口黑鱸', rarity:'常見', color:'#5f7f3e', min:0.4, max:2.5, power:0.45, desc:'嘴巴大大的，什麼都敢咬。是鏡湖最受歡迎的魚。' },
  { id:'goldfish', spot:'lake', time:'day', name:'圓圓金魚', rarity:'常見', color:'#ff8a2a', min:0.05, max:0.3, power:0.25, desc:'不知道誰放進鏡湖的，現在已經生了一大群。' },
  { id:'sturgeon', spot:'lake', time:'night', name:'鏡湖鱘龍', rarity:'傳說', color:'#7d8794', min:20, max:90, power:0.93, w:0.5, desc:'活了上百年的老魚，背上有一排像盔甲的骨板。' },
  { id:'salmon',  spot:'pool',  name:'櫻花鉤吻鮭', rarity:'稀有', color:'#c98a9a', min:0.3, max:1.6, power:0.6, desc:'只住在最冰涼的山澗裡，身上有櫻花一樣的粉紅色斑點。' },
  { id:'jelly',   spot:'sea',   time:'night', name:'月光水母', rarity:'稀有', color:'#bfe6ff', min:0.2, max:2.0, power:0.3, desc:'晚上會發出淡藍色的光，一群一群漂在海邊。不要用手摸！' },
  { id:'flounder', spot:'sea',  name:'沙底比目魚', rarity:'常見', color:'#a88a62', min:0.3, max:2.0, power:0.4, desc:'兩隻眼睛長在同一邊，平平地躲在沙子裡。' },
  { id:'grouper', spot:'sea',   name:'龍膽石斑', rarity:'傳說', color:'#6b5a3a', min:15, max:60, power:0.9, w:0.55, desc:'礁石洞裡的大老大，一口就能吞下一整條魚。' },
  { id:'barracuda', spot:'harbor', time:'day', name:'銀刀梭子魚', rarity:'稀有', color:'#b7c3cf', min:2.0, max:12, power:0.7, desc:'像一把銀色的刀，游得飛快，牙齒很尖。' },
  { id:'hammer',  spot:'harbor', name:'雙髻鯊', rarity:'傳說', color:'#5f7488', min:80, max:300, power:0.96, w:0.4, desc:'頭長得像一把槌子，兩邊的眼睛可以同時看到前後。' },
  { id:'oarfish', spot:'harbor', time:'night', name:'皇帶魚', rarity:'傳說', color:'#d9dfe6', min:30, max:150, power:0.92, w:0.3, desc:'又長又扁的銀色大魚，頭上有紅色的冠。傳說牠出現時海會很平靜。' },
  { id:'seahorse', spot:'isle', name:'小海馬', rarity:'稀有', color:'#f2a14a', min:0.02, max:0.1, power:0.22, desc:'用捲捲的尾巴抓著小島碼頭下的海草。是爸爸負責生寶寶喔。' },
  { id:'lionfish', spot:'isle', name:'獅子魚', rarity:'稀有', color:'#d9453a', min:0.3, max:1.3, power:0.5, desc:'鰭像一把把打開的扇子，紅白條紋超漂亮，但刺有毒。' },
  { id:'turtle',  spot:'isle', time:'day', name:'綠蠵龜', rarity:'傳說', color:'#5f8f5a', min:40, max:180, power:0.85, w:0.5, desc:'慢慢游到小島來曬太陽的海龜。拍完照記得放牠回大海。' },
  // 2026-11 第四批：蝦蟹和熱帶魚
  { id:'crab',    spot:'sea',   name:'沙灘螃蟹', rarity:'常見', color:'#e06a3a', min:0.1, max:0.8, power:0.35, desc:'橫著走路的沙灘居民，被釣起來時還會揮著鉗子抗議。' },
  { id:'kingcrab', spot:'harbor', time:'night', name:'帝王蟹', rarity:'稀有', color:'#c9302c', min:2.0, max:8.0, power:0.66, desc:'腳張開比一個人還寬，冰冷的深海是牠的家。' },
  { id:'lobster', spot:'isle',  time:'night', name:'藍紋龍蝦', rarity:'稀有', color:'#3f6fb5', min:0.5, max:4.0, power:0.58, desc:'晚上才從礁石洞裡出來散步，藍色的殼煮熟會變紅色。' },
  { id:'shrimp',  spot:'creek', name:'櫻花蝦', rarity:'常見', color:'#f5a5b8', min:0.01, max:0.05, power:0.2, desc:'小小的、粉紅色的，一群一群在螢光溪裡游來游去。' },
  { id:'arowana', spot:'lake',  name:'金龍魚', rarity:'傳說', color:'#e8b730', min:3.0, max:12, power:0.86, desc:'鱗片像金幣一樣閃閃發光，傳說會帶來好運和財富。' },
  { id:'tilefish', spot:'sea',  time:'day', name:'粉紅馬頭魚', rarity:'常見', color:'#f2a0a8', min:0.3, max:1.8, power:0.4, desc:'方方的額頭像一匹小馬，粉紅色的身體很可愛。' },
  { id:'mahi',    spot:'harbor', time:'day', name:'鬼頭刀', rarity:'常見', color:'#3fbf6a', min:3.0, max:15, power:0.6, desc:'綠色和金色的身體在陽光下會變色，跳起來的樣子超帥。' },
  { id:'butterfly', spot:'isle', time:'day', name:'蝴蝶魚', rarity:'常見', color:'#ffd23a', min:0.05, max:0.3, power:0.25, desc:'黃色的身體配上黑色條紋，在小島的珊瑚旁邊飛來飛去。' },
  { id:'angler',  spot:'harbor', time:'night', name:'深海鮟鱇', rarity:'傳說', color:'#3b3a48', min:10, max:50, power:0.88, w:0.45, desc:'頭上掛著一盞發光的小燈籠，用來騙小魚靠近。' },
  { id:'stingray', spot:'sea',  name:'斑點魟', rarity:'稀有', color:'#7d6a52', min:2.0, max:20, power:0.62, desc:'平平地貼在沙底，身上有一圈一圈的斑點。小心尾巴的刺。' },
  { id:'trevally', spot:'isle', name:'浪人鰺', rarity:'稀有', color:'#5f6f80', min:5.0, max:40, power:0.82, desc:'小島附近最兇猛的獵手，一咬到餌就會拚命往外衝。' },
  // 第五批：外海的小魚（外海有更多常見魚，傳說魚就比較少出現）、海邊、河、湖
  { id:'saury',     spot:'harbor', name:'秋刀魚',   rarity:'常見', color:'#4a6fa0', min:0.1, max:0.3, power:0.3, w:1.3, desc:'細長的刀子形狀，秋天成群游過外海，烤來吃最香。' },
  { id:'horsemack', spot:'harbor', name:'竹莢魚',   rarity:'常見', color:'#7d9ab0', min:0.15, max:0.6, power:0.34, w:1.2, desc:'身體側邊有一排硬硬的稜鱗，港口的老漁夫天天都釣得到。' },
  { id:'hairtail',  spot:'harbor', name:'白帶魚',   rarity:'常見', color:'#d8dfe6', min:0.5, max:3.0, power:0.42, time:'night', desc:'銀白色、像緞帶一樣長，晚上會游到水面附近覓食。' },
  { id:'sardine',   spot:'harbor', name:'沙丁魚',   rarity:'常見', color:'#5f86a8', min:0.05, max:0.15, power:0.2, w:1.4, desc:'一大群一大群游來游去，是很多大魚的食物。' },
  { id:'flyingfish', spot:'harbor', name:'飛魚',    rarity:'常見', color:'#3f7fd0', min:0.2, max:0.5, power:0.36, time:'day', desc:'胸鰭像翅膀一樣大，會跳出水面滑翔好幾十公尺。' },
  { id:'yellowtail', spot:'harbor', name:'青甘鰺',  rarity:'常見', color:'#8fb0a0', min:1.0, max:8.0, power:0.55, desc:'背是藍綠色、尾巴黃黃的，力氣很大，生魚片很受歡迎。' },
  { id:'milkfish',  spot:'mangrove',  name:'虱目魚',     rarity:'常見', color:'#c9d4dc', min:0.3, max:1.5, power:0.38, desc:'台灣南部最有名的魚，煮虱目魚粥是很多人的早餐。' },
  { id:'mullet',    spot:'mangrove',  name:'烏魚',       rarity:'常見', color:'#6f7a80', min:0.5, max:2.5, power:0.42, desc:'冬天會成群游過海峽，烏魚子就是牠的魚卵。' },
  { id:'zacco',     spot:'river', name:'溪哥',      rarity:'常見', color:'#7fb0c8', min:0.03, max:0.12, power:0.22, desc:'公的身上有漂亮的粉藍色條紋，河邊最常看到的小魚。' },
  { id:'bighead',   spot:'lake', name:'大頭鰱',     rarity:'常見', color:'#8f9aa0', min:1.0, max:10, power:0.5, desc:'頭特別大，在湖裡慢慢地游，砂鍋魚頭就是用牠做的。' },
  // 第六批：更多常見的小魚，把大魚和稀有魚的機率壓下來
  { id:'pomfret', spot:'harbor', name:'白鯧', rarity:'常見', color:'#c9d1d8', min:0.2, max:0.8, power:0.3, w:1.3, desc:'扁扁圓圓像一面銀色的鏡子，沒有腹鰭，過年的餐桌上一定有牠。' },
  { id:'grunt', spot:'harbor', name:'黃雞魚', rarity:'常見', color:'#b59a6a', min:0.15, max:0.6, power:0.35, w:1.2, desc:'三線磯鱸，被拉起來的時候會「咕咕」叫，所以叫雞魚。' },
  { id:'roundscad', spot:'harbor', name:'四破', rarity:'常見', color:'#6f97a8', min:0.08, max:0.3, power:0.3, w:1.4, desc:'藍圓鰺，台灣漁港最常見的小魚之一，煎得酥酥的很下飯。' },
  { id:'anchovy', spot:'harbor', name:'丁香魚', rarity:'常見', color:'#9fb8c8', min:0.01, max:0.03, power:0.12, w:1.4, desc:'小小一條、身體中間有一條銀線，常常一大群一起游。' },
  { id:'filefish', spot:'harbor', name:'剝皮魚', rarity:'常見', color:'#7d8f88', min:0.15, max:0.5, power:0.3, w:1.2, desc:'頭上有一根硬刺，皮很粗，要剝掉皮才能吃。' },
  { id:'threadfin', spot:'harbor', name:'金線魚', rarity:'常見', color:'#e88a9a', min:0.15, max:0.5, power:0.3, w:1.2, desc:'粉紅色的身體上有幾條金黃色的線，尾巴上端拖著一根長絲。' },
  { id:'sergeant', spot:'isle', name:'五帶豆娘魚', rarity:'常見', color:'#e8d870', min:0.05, max:0.2, power:0.22, w:1.4, desc:'黃色的背、五條黑色的直紋，在珊瑚礁上成群游來游去。' },
  { id:'rabbitfish', spot:'isle', name:'臭肚魚', rarity:'常見', color:'#9a8a5a', min:0.15, max:0.6, power:0.3, w:1.3, desc:'嘴巴小小的愛啃海藻，鰭上的硬刺有毒，拿的時候要小心。' },
  { id:'bluetang', spot:'isle', name:'藍倒吊', rarity:'常見', color:'#2f6fd0', min:0.1, max:0.4, power:0.3, w:1.2, desc:'寶藍色的身體、黃色的尾巴，尾柄兩邊各有一把小刀。' },
  { id:'moonwrasse', spot:'isle', name:'新月錦魚', rarity:'常見', color:'#3fbf8a', min:0.1, max:0.35, power:0.28, w:1.3, desc:'綠色身體配上粉紅色的線條，尾巴像一彎黃色的月亮。' },
  { id:'acro', spot:'river', name:'台灣石賓', rarity:'常見', color:'#a89a5a', min:0.1, max:0.5, power:0.35, w:1.3, desc:'身上有六七條黑色的直條紋，喜歡在湍急的溪水裡。' },
  { id:'pseudorasbora', spot:'river', name:'羅漢魚', rarity:'常見', color:'#a8b0a0', min:0.01, max:0.03, power:0.12, w:1.4, desc:'小小的、身體中間有一條黑線，河邊的水草裡到處都是。' },
  { id:'hillstream', spot:'pool', name:'台灣間爬岩鰍', rarity:'常見', color:'#8a7a50', min:0.01, max:0.03, power:0.15, w:1.3, desc:'扁扁的身體和大大的胸鰭像吸盤，可以緊緊貼在瀑布旁的石頭上。' },
  { id:'candidia', spot:'pool', name:'台灣鬚鱲', rarity:'常見', color:'#6f8f9a', min:0.01, max:0.05, power:0.18, w:1.3, desc:'身體側邊有一條深色的帶子，公魚到了春天鰭會變紅。' },
  { id:'medaka', spot:'creek', name:'青鱂魚', rarity:'常見', color:'#c8c8a8', min:0.01, max:0.02, power:0.1, w:1.3, desc:'眼睛大大的小魚，台灣原生的「大肚魚」，喜歡住在乾淨的小水溝。' },
  // 釣蝦場（浮標要自己看：輕輕點一下是在試探，整個沉下去才是吃餌）
  { id:'prawn',     spot:'shrimp', name:'泰國蝦',     rarity:'常見', color:'#5f8fb0', min:0.06, max:0.22, power:0.22, w:1.6, desc:'釣蝦場的主角，長長的藍色大鉗子。撒鹽烤到紅通通最好吃。' },
  { id:'whiteshrimp', spot:'shrimp', name:'白蝦',     rarity:'常見', color:'#d8dde0', min:0.03, max:0.09, power:0.15, desc:'小小的、半透明的白蝦，很容易上鉤。' },
  { id:'tigerprawn',  spot:'shrimp', name:'草蝦',     rarity:'常見', color:'#4a5a3a', min:0.05, max:0.18, power:0.2,  desc:'身上有一條一條黑色的虎紋，又叫斑節蝦。' },
  { id:'crayfish',  spot:'shrimp', name:'小龍蝦',     rarity:'常見', color:'#c0402a', min:0.05, max:0.14, power:0.24, desc:'紅通通的小龍蝦，一被拉起來就會舉起大鉗子示威。' },
  { id:'blueclaw',  spot:'shrimp', name:'藍鉗泰國蝦', rarity:'稀有', color:'#2f6fd0', min:0.15, max:0.38,  power:0.32, desc:'鉗子是漂亮的寶藍色，又大又長，釣到可以炫耀一整天。' },
  { id:'goldprawn', spot:'shrimp', name:'金鉤蝦王',   rarity:'傳說', color:'#e8b730', min:0.35,  max:0.65, power:0.42, desc:'池子裡傳說中的蝦王，全身金黃色。老闆說十幾年才出現一次。' },
  // 變種：同一種魚、長得不一樣（機率很低；沒釣到之前圖鑑看不到）
  { id:'koi_sanke', spot:'lake', of:'koi', time:'twilight', name:'錦鯉・大正三色', rarity:'傳說', color:'#f4f0e8', min:2.5, max:7.0, power:0.9, w:0.3, desc:'白底配上紅色大斑，背上還點綴著黑色小斑，三種顏色的錦鯉。' },
  { id:'koi_showa', spot:'lake', of:'koi', time:'twilight', name:'錦鯉・昭和三色', rarity:'傳說', color:'#1d1d1d', min:2.5, max:7.0, power:0.9, w:0.25, desc:'黑色底上有紅色和白色的花紋，看起來特別有氣勢。' },
  { id:'koi_ogon', spot:'lake', of:'koi', time:'twilight', name:'錦鯉・黃金', rarity:'傳說', color:'#f2c040', min:2.5, max:7.0, power:0.9, w:0.2, desc:'全身閃著金屬光澤的黃金錦鯉，在水裡像一塊金子。' },
  { id:'goldfish_ranchu', spot:'lake', of:'goldfish', time:'day', name:'獅子頭金魚', rarity:'稀有', color:'#ff6a2a', min:0.05, max:0.3, power:0.25, w:0.03, desc:'沒有背鰭、頭上長著一顆顆肉瘤，圓滾滾地慢慢游。' },
  { id:'goldfish_telescope', spot:'lake', of:'goldfish', time:'day', name:'黑龍睛金魚', rarity:'稀有', color:'#1e1e22', min:0.05, max:0.3, power:0.25, w:0.03, desc:'全身黑色、兩顆眼睛凸出來像望遠鏡。' },
  { id:'goldfish_pearl', spot:'lake', of:'goldfish', time:'day', name:'珍珠鱗金魚', rarity:'稀有', color:'#f8a060', min:0.05, max:0.3, power:0.25, w:0.03, desc:'圓得像一顆球，每一片鱗片都鼓起來像小珍珠。' },
  { id:'clown_black', spot:'isle', of:'clown', name:'黑色小丑魚', rarity:'稀有', color:'#1d1d1d', min:0.05, max:0.25, power:0.32, w:0.03, desc:'少見的黑色小丑魚，黑底白條紋，酷到不行。' },
  { id:'catfish_albino', spot:'river', of:'catfish', time:'night', name:'白化鯰魚', rarity:'稀有', color:'#f0d8d0', min:1.5, max:5.5, power:0.66, w:0.015, desc:'天生沒有色素的鯰魚，全身粉白色、眼睛紅紅的。' },
  { id:'trout_golden', spot:'creek', of:'trout', time:'night', name:'黃金鱒', rarity:'傳說', color:'#f2c030', min:1.2, max:4.5, power:0.88, w:0.06, desc:'全身金黃色的鱒魚，身側有一條橘紅色的帶子，非常罕見。' },
  { id:'carp_mirror', spot:'lake', of:'carp', name:'鏡鯉', rarity:'稀有', color:'#b88a3a', min:1.5, max:8.0, power:0.68, w:0.015, desc:'身上幾乎沒有鱗片，只有背上和身側長著幾片像鏡子一樣的大鱗。' },
  { id:'crayfish_blue', spot:'shrimp', of:'crayfish', name:'藍色小龍蝦', rarity:'稀有', color:'#2f6fd0', min:0.05, max:0.14, power:0.24, w:0.015, desc:'基因突變的藍色小龍蝦，跟一般紅色的小龍蝦是同一種。' },
  { id:'tilapia_red', spot:'river', of:'tilapia', name:'紅色吳郭魚', rarity:'稀有', color:'#ff6a4a', min:0.3, max:1.5, power:0.36, w:0.015, desc:'紅通通的吳郭魚，市場上叫「台灣鯛」。' },
  // ---- 紅樹林（2026-11-04）：開船到東北外海的紅樹林群島；退潮時泥灘露出來可以徒手抓 ----
  { id:'scat',        spot:'mangrove', name:'金錢魚',     rarity:'常見', color:'#c8b45a', min:0.1, max:0.6, power:0.4, w:1.1, desc:'圓圓扁扁、身上有黑色斑點，像一枚金幣。住在河口和紅樹林，什麼都吃，台灣叫牠「金鼓」。' },
  { id:'terapon',     spot:'mangrove', name:'花身鯻',     rarity:'常見', color:'#c8ccce', min:0.05, max:0.3, power:0.35, w:1.2, desc:'銀白色的身上有幾條往後彎的黑線。被抓起來會「咕咕」叫，所以也叫「雞仔魚」。' },
  { id:'blackbream',  spot:'mangrove', name:'黑鯛',       rarity:'常見', color:'#2e3236', min:0.3, max:2.5, power:0.6, w:0.8, desc:'灰黑色的鯛，台灣叫「黑格」。很警覺，漲潮時會游進紅樹林的樹根之間找螃蟹吃。' },
  { id:'mudcrab',     spot:'mangrove', name:'鋸緣青蟳',   rarity:'稀有', color:'#3e4a2e', min:0.3, max:2.5, power:0.65, desc:'紅樹林最有名的大蟳，墨綠色的殼、兩隻又大又有力的螯。夾到手會很痛！' },
  { id:'mangsnapper', spot:'mangrove', name:'銀紋笛鯛',   rarity:'稀有', color:'#c06a48', min:1.0, max:8.0, power:0.75, desc:'紅銅色的笛鯛，年輕時躲在紅樹林裡長大，所以又叫「紅樹林笛鯛」。' },
  { id:'barramundi',  spot:'mangrove', name:'尖吻鱸',     rarity:'稀有', color:'#c4cccc', min:2.0, max:15, power:0.85, desc:'俗稱「金目鱸」，眼睛在光下會反射金紅色。力氣很大，咬餌以後會跳出水面甩頭。' },
  { id:'bullshark',   spot:'mangrove', name:'鬥牛鯊',     rarity:'傳說', color:'#9aa0a4', min:90, max:230, power:0.97, desc:'少數能游進河口、甚至淡水的鯊魚。吻又短又鈍，脾氣很差，漲潮時會跟著水游進紅樹林。' },
  { id:'sawfish',     spot:'mangrove', name:'鋸鰩',       rarity:'傳說', color:'#b0a070', min:100, max:500, power:0.98, desc:'前面一支長長的「鋸子」，兩邊都是齒，用來在泥裡翻找食物。在野外已經極度瀕危，釣到請一定要放流。' },
  { id:'scat_red',    spot:'mangrove', of:'scat', name:'紅金錢魚', rarity:'稀有', color:'#e0703a', min:0.1, max:0.6, power:0.4, w:0.03, desc:'身體偏紅的金錢魚，有人叫牠「紅頭金鼓」，比一般的少見很多。' },
  { id:'mudskipper',  spot:'mudflat', name:'彈塗魚',     rarity:'常見', color:'#9a8a6a', min:0.01, max:0.03, power:0.15, w:1.3, desc:'眼睛長在頭頂、用胸鰭在泥上爬、會跳的魚。身體濕濕的就能離開水好幾十個小時。要慢慢靠近才抓得到。' },
  { id:'fiddler',     spot:'mudflat', name:'弧邊招潮蟹', rarity:'常見', color:'#e8602a', min:0.01, max:0.03, power:0.15, w:1.2, desc:'公的有一隻特別大的橘紅色大螯，退潮時會在洞口揮來揮去「招潮」。一嚇就躲回洞裡。' },
  { id:'bigskipper',  spot:'mudflat', name:'大彈塗魚',   rarity:'稀有', color:'#7a8a6a', min:0.04, max:0.12, power:0.25, desc:'比彈塗魚大，身上有很多藍綠色的亮點，背鰭立起來很漂亮。跳得很遠。' },
  { id:'mudskipper_albino', spot:'mudflat', of:'mudskipper', name:'白化彈塗魚', rarity:'稀有', color:'#f6e2da', min:0.01, max:0.03, power:0.15, w:0.01, desc:'全身粉白、眼睛紅紅的彈塗魚，在灰色的泥灘上特別顯眼。' },
  { id:'fiddler_blue', spot:'mudflat', of:'fiddler', name:'藍殼招潮蟹', rarity:'稀有', color:'#2a6ad8', min:0.01, max:0.03, power:0.15, w:0.01, desc:'殼是亮藍色、大螯是白色的招潮蟹，很少見。' },
  // ---- 百年生態池（參考新竹湖口國小；原本是城市水圳）：外來種很多的老池塘 ----
  { id:'mosquitofish', spot:'canal', name:'食蚊魚（大肚魚）', rarity:'常見', color:'#9a9c78', min:0.002, max:0.01, power:0.08, w:1.4, desc:'水溝裡一群一群的小魚，嘴往上翹、專吃水面的孑孓。母魚肚子大大的、直接生小魚。原本是引進來吃蚊子的外來種。' },
  { id:'pleco', spot:'canal', name:'琵琶鼠魚', rarity:'常見', color:'#5a4a36', min:0.2, max:1.2, power:0.4, desc:'全身硬硬的骨板，嘴巴是吸盤，背鰭像一面帆。從水族館跑出來的外來種，現在水溝、池塘裡到處都是。' },
  { id:'giantsnake', spot:'canal', name:'泰國鱧（魚虎）', rarity:'稀有', color:'#2e3a48', min:2.0, max:15, power:0.9, desc:'可以長到一公尺的大鱧魚，非常兇，會把池塘裡的魚吃光。咬到餌會往水草裡猛衝。' },
  { id:'clarias', spot:'canal', name:'革胡子鯰（埃及塘蝨）', rarity:'稀有', color:'#4a4e4a', min:3.0, max:20, power:0.92, w:0.6, desc:'水溝、池塘裡最大的鯰魚，頭又扁又硬、有四對長鬍鬚，晚上最會吃。' },
  { id:'guppy', spot:'canal', name:'孔雀魚', rarity:'常見', color:'#e8602a', min:0.01, max:0.02, power:0.06, w:1.2, desc:'公魚的尾巴又大又花、顏色五彩繽紛，母魚灰灰的。放在水族館一公一母會生小魚，尾巴的顏色和形狀會遺傳，偶爾還會突變出黑色、紫色。' },
  { id:'guppy_albino', spot:'canal', of:'guppy', name:'白化孔雀魚', rarity:'稀有', color:'#f4e0d0', min:0.01, max:0.02, power:0.06, w:0.02, desc:'身體淡粉色、紅眼睛的孔雀魚。白化是隱性的，兩條配在一起小魚才會是白化。' },
  { id:'mosquitofish_gold', spot:'canal', of:'mosquitofish', name:'金色大肚魚', rarity:'稀有', color:'#f4b050', min:0.002, max:0.01, power:0.08, w:0.02, desc:'身上沒有黑色素、整條金黃色的大肚魚，在魚群裡一眼就看得到。' },
  { id:'pleco_albino', spot:'canal', of:'pleco', name:'白化琵琶鼠', rarity:'稀有', color:'#f2dca0', min:0.2, max:1.2, power:0.4, w:0.015, desc:'淡黃色、紅眼睛的琵琶鼠魚，很少在野外看到。' },
  { id:'giantsnake_red', spot:'canal', of:'giantsnake', name:'火焰魚虎', rarity:'傳說', color:'#f07a30', min:2.0, max:15, power:0.9, w:0.01, desc:'泰國鱧小時候是橘紅色帶黑線的「火焰」，這條長大了還保留那個顏色，非常少見。' },
  { id:'clarias_albino', spot:'canal', of:'clarias', name:'白化塘蝨', rarity:'傳說', color:'#f2dcd2', min:3.0, max:20, power:0.92, w:0.01, desc:'粉白色、紅眼睛的大塘蝨，在黑黑的池水裡像幽靈一樣。' },
  // ---- 珊瑚礁群島（參考小琉球、澎湖；2026-11-04）----
  { id:'rabbitfish', spot:'reef', name:'臭肚魚', rarity:'常見', color:'#8a8a5e', min:0.1, max:0.6, power:0.3, w:1.3, desc:'褐籃子魚。吃海藻長大，肚子有海藻的味道所以叫「臭肚」。背鰭的硬棘有毒，抓的時候要小心，是石滬裡最常抓到的魚。' },
  { id:'girella', spot:'reef', name:'白毛', rarity:'常見', color:'#8e9a90', min:0.3, max:2.0, power:0.45, desc:'瓜子鱲。灰綠色、嘴很小，喜歡在浪打的礁岩邊吃海藻，是磯釣的人最愛的魚。' },
  { id:'blackgirella', spot:'reef', name:'黑毛', rarity:'稀有', color:'#3a4240', min:0.5, max:3.5, power:0.7, desc:'黑瓜子鱲。比白毛黑、比白毛大，上鉤以後會拚命往礁石洞裡鑽。' },
  { id:'lethrinus', spot:'reef', name:'青嘴龍占', rarity:'稀有', color:'#c8b88a', min:1.0, max:8.0, power:0.72, desc:'嘴巴長長尖尖、臉上有藍色線條，喜歡在珊瑚礁旁的沙地找螃蟹和貝類吃。' },
  { id:'amberjack', spot:'reef', name:'紅甘', rarity:'傳說', color:'#c8b07a', min:10, max:60, power:0.95, w:0.5, desc:'杜氏鰤。在深水礁區巡游的大魚，眼睛有一條深色斜帶，力氣大到會把線拉進礁石裡磨斷。' },
  { id:'rabbitfish_gold', spot:'reef', of:'rabbitfish', name:'金色臭肚魚', rarity:'稀有', color:'#f0c850', min:0.1, max:0.6, power:0.3, w:0.02, desc:'全身金黃色的臭肚魚，在石滬的淺水裡閃閃發亮。' },
  { id:'girella_gold', spot:'reef', of:'girella', name:'金黃白毛', rarity:'稀有', color:'#e8c870', min:0.3, max:2.0, power:0.45, w:0.015, desc:'身體偏金黃色的白毛，老釣客一輩子可能只看過一次。' },
  { id:'blackgirella_albino', spot:'reef', of:'blackgirella', name:'白化黑毛', rarity:'傳說', color:'#f6e6de', min:0.5, max:3.5, power:0.7, w:0.01, desc:'明明叫黑毛，卻全身粉白色、紅眼睛。' },
  { id:'lethrinus_red', spot:'reef', of:'lethrinus', name:'赤龍占', rarity:'稀有', color:'#e87a5a', min:1.0, max:8.0, power:0.72, w:0.015, desc:'身體偏紅的龍占，在藍色的礁盤裡特別顯眼。' },
  { id:'amberjack_gold', spot:'reef', of:'amberjack', name:'黃金紅甘', rarity:'傳說', color:'#f0c040', min:10, max:60, power:0.95, w:0.01, desc:'全身像黃金一樣的紅甘，傳說只在大潮的日子出現。' },
  // ---- 深海浮台、遠洋神秘島 ----
  { id:'mehikari', spot:'abyss', name:'青眼魚', rarity:'常見', color:'#9aa8b0', min:0.02, max:0.08, power:0.2, desc:'深海裡成群的銀色小魚，一雙大大的綠眼睛在燈光下會反光，炸起來很好吃。' },
  { id:'rattail', spot:'abyss', name:'鼠尾鱈', rarity:'常見', color:'#7a7068', min:0.2, max:1.5, power:0.4, desc:'大大的頭、身體往後越來越細，尾巴尖尖的像老鼠尾巴，是深海海底最常見的魚之一。' },
  { id:'blackthroat', spot:'abyss', name:'赤鯥', rarity:'稀有', color:'#e86a4a', min:0.2, max:1.0, power:0.45, desc:'全身紅通通、嘴巴裡面卻是黑色的，所以又叫黑喉。油脂很多，是很高級的魚。' },
  { id:'blobfish', spot:'abyss', name:'水滴魚', rarity:'稀有', color:'#f0c0c0', min:0.5, max:2.5, power:0.25, desc:'在深海的高壓裡其實長得像一般的魚，被拉上來以後才會變得鬆鬆垮垮、像一團粉紅色的果凍。' },
  { id:'fangtooth', spot:'abyss', name:'角高體金眼鯛', rarity:'稀有', color:'#34343a', min:0.03, max:0.12, power:0.3, desc:'黑黑的小魚，嘴巴裡長著和身體比起來超級長的尖牙，住在很深很暗的地方。' },
  { id:'goblinshark', spot:'abyss', name:'歐氏尖吻鮫', rarity:'傳說', color:'#e0b0b0', min:40, max:200, power:0.9, w:0.2, desc:'粉紅色的深海鯊魚，鼻子又長又扁，咬東西的時候整個下巴會往前彈出去，像外星生物一樣。' },
  { id:'sixgill', spot:'abyss', name:'灰六鰓鯊', rarity:'傳說', color:'#6a6a60', min:80, max:500, power:0.95, w:0.2, desc:'很古老的鯊魚，一般鯊魚有 5 條鰓裂，牠有 6 條。白天待在深海，晚上才往上游。' },
  { id:'mehikari_gold', spot:'abyss', of:'mehikari', name:'金眼青眼魚', rarity:'稀有', color:'#f0d878', min:0.02, max:0.08, power:0.2, w:0.025, desc:'全身金黃色的青眼魚，眼睛還是綠的，好像一顆會游的寶石。' },
  { id:'rattail_albino', spot:'abyss', of:'rattail', name:'白化鼠尾鱈', rarity:'稀有', color:'#efe8e2', min:0.2, max:1.5, power:0.4, w:0.02, desc:'全身白白的鼠尾鱈，在漆黑的深海裡特別顯眼。' },
  { id:'blackthroat_gold', spot:'abyss', of:'blackthroat', name:'金赤鯥', rarity:'稀有', color:'#f0c850', min:0.2, max:1.0, power:0.45, w:0.02, desc:'紅色變成金色的赤鯥，漁夫說釣到會帶來好運。' },
  { id:'blobfish_albino', spot:'abyss', of:'blobfish', name:'白化水滴魚', rarity:'稀有', color:'#f8f4f2', min:0.5, max:2.5, power:0.25, w:0.02, desc:'白白軟軟的水滴魚，看起來像一顆麻糬。' },
  { id:'fangtooth_gold', spot:'abyss', of:'fangtooth', name:'金牙角高體金眼鯛', rarity:'稀有', color:'#c89830', min:0.03, max:0.12, power:0.3, w:0.02, desc:'全身金色的角高體金眼鯛，尖牙閃閃發亮。' },
  { id:'goblinshark_albino', spot:'abyss', of:'goblinshark', name:'白化尖吻鮫', rarity:'傳說', color:'#f8f0f0', min:40, max:200, power:0.9, w:0.008, desc:'全身雪白的尖吻鮫，幾乎沒有人看過。' },
  { id:'sixgill_albino', spot:'abyss', of:'sixgill', name:'白化六鰓鯊', rarity:'傳說', color:'#f0ece6', min:80, max:500, power:0.95, w:0.008, desc:'白色的六鰓鯊，眼睛是淡淡的紅色。' },
  { id:'creolefish', spot:'mystic', name:'克里奧鮨', rarity:'常見', color:'#d87060', min:0.2, max:0.8, power:0.38, desc:'橘紅色的魚，背上有一排小白點，成群在火山岩旁邊游來游去。' },
  { id:'razorsurgeon', spot:'mystic', name:'黃尾刺尾鯛', rarity:'常見', color:'#5a5e68', min:0.3, max:1.2, power:0.42, desc:'灰色的身體配上鮮黃色的尾巴根部，那裡有像刀片一樣的硬棘，成群在淺海吃藻類。' },
  { id:'idol', spot:'mystic', name:'角蝶魚', rarity:'常見', color:'#f0e040', min:0.1, max:0.4, power:0.3, desc:'黑、白、黃三色的寬條紋，背鰭拉成一條長長的白絲，在礁岩間優雅地游。' },
  { id:'batfish', spot:'mystic', name:'紅唇蝙蝠魚', rarity:'稀有', color:'#a89470', min:0.1, max:0.6, power:0.3, desc:'用胸鰭在海底一步一步「走路」，嘴唇是鮮紅色的，好像擦了口紅。只住在這片海域。' },
  { id:'galapagosshark', spot:'mystic', name:'加拉巴哥鯊', rarity:'傳說', color:'#8a8a84', min:30, max:85, power:0.92, w:0.25, desc:'住在遠洋小島周圍的大鯊魚，好奇心很重，常常游過來看看船上在做什麼。' },
  { id:'creolefish_gold', spot:'mystic', of:'creolefish', name:'金色克里奧鮨', rarity:'稀有', color:'#f0c850', min:0.2, max:0.8, power:0.38, w:0.025, desc:'全身金黃色的克里奧鮨。' },
  { id:'razorsurgeon_albino', spot:'mystic', of:'razorsurgeon', name:'白化刺尾鯛', rarity:'稀有', color:'#f0eeea', min:0.3, max:1.2, power:0.42, w:0.02, desc:'灰色變成白色的刺尾鯛，只有尾巴還留著一點黃色。' },
  { id:'idol_gold', spot:'mystic', of:'idol', name:'金色角蝶魚', rarity:'稀有', color:'#fbe890', min:0.1, max:0.4, power:0.3, w:0.02, desc:'黑色條紋變成金色的角蝶魚，閃閃發亮。' },
  { id:'batfish_albino', spot:'mystic', of:'batfish', name:'白化蝙蝠魚', rarity:'稀有', color:'#f4f0ea', min:0.1, max:0.6, power:0.3, w:0.02, desc:'全身白色、只剩嘴唇還是紅的蝙蝠魚。' },
  { id:'galapagosshark_albino', spot:'mystic', of:'galapagosshark', name:'白化加拉巴哥鯊', rarity:'傳說', color:'#f0ece6', min:30, max:85, power:0.92, w:0.008, desc:'全身白色的加拉巴哥鯊。' },
  // ---- 北方冰封群島：冰湖（冰洞釣）和流冰海岸 ----
  { id:'wakasagi', spot:'icelake', name:'公魚', rarity:'常見', color:'#c8d0c4', min:0.008, max:0.035, power:0.18, desc:'冬天湖面結冰以後，大家鑿一個小洞、用好幾根細細的鉤子一次釣好幾條的小魚，炸起來香香脆脆。' },
  { id:'shirauo', spot:'icelake', name:'白魚', rarity:'常見', color:'#eef2f0', min:0.004, max:0.02, power:0.15, desc:'身體幾乎透明的小魚，死掉以後才會變白，所以叫白魚。早春成群游到湖邊產卵。' },
  { id:'dolly', spot:'icelake', name:'花羔紅點鮭', rarity:'稀有', color:'#6f7a5a', min:0.15, max:1.4, power:0.5, desc:'住在冰冷乾淨的山湖和溪流裡，身上有紅色和白色的小圓點，像撒了糖粒一樣。' },
  { id:'himemasu', spot:'icelake', name:'姬鱒', rarity:'稀有', color:'#7a9ab0', min:0.3, max:1.6, power:0.58, desc:'一輩子都住在湖裡的紅鮭，平常銀色，到了秋天要產卵時全身會變成紅色。' },
  { id:'ito', spot:'icelake', name:'哲羅鮭', rarity:'傳說', color:'#5a5a48', min:4, max:35, power:0.92, w:0.25, desc:'日本最大的淡水魚，可以活二十年以上，連鳥和老鼠都吃，被叫做「幻之魚」，現在已經非常少了。' },
  { id:'capelin', spot:'icesea', name:'毛鱗魚', rarity:'常見', color:'#9ab0a8', min:0.015, max:0.06, power:0.2, desc:'北方冷海裡成群結隊的小魚，是海鳥、鱈魚和鯨魚最重要的食物。母魚肚子裡滿滿都是卵。' },
  { id:'hokke', spot:'icesea', name:'遠東多線魚', rarity:'常見', color:'#8a8670', min:0.2, max:1.2, power:0.42, desc:'北方很常見的魚，身上有好幾條側線。剖開曬一晚做成一夜干，烤起來油油的很下飯。' },
  { id:'cod', spot:'icesea', name:'太平洋鱈', rarity:'常見', color:'#8a7a5a', min:0.8, max:9, power:0.6, desc:'大大的嘴巴、下巴有一根小鬍鬚，住在冰冷的海底。魚肉雪白，冬天煮鱈魚火鍋最好吃。' },
  { id:'sleepershark', spot:'icesea', name:'太平洋睡鯊', rarity:'傳說', color:'#4a4a50', min:80, max:700, power:0.97, w:0.2, desc:'住在冰冷深海、游得很慢很慢的大鯊魚，好像一直在睡覺。這一類的鯊魚可以活好幾百年。' },
  { id:'wakasagi_gold', spot:'icelake', of:'wakasagi', name:'金色公魚', rarity:'稀有', color:'#e8c860', min:0.008, max:0.035, power:0.18, w:0.025, desc:'全身金黃色的公魚，色素和一般的不一樣，冰洞裡一閃一閃的。' },
  { id:'shirauo_gold', spot:'icelake', of:'shirauo', name:'金色白魚', rarity:'稀有', color:'#f4e4a0', min:0.004, max:0.02, power:0.15, w:0.025, desc:'透明的身體帶著淡淡的金色，很少很少見。' },
  { id:'dolly_gold', spot:'icelake', of:'dolly', name:'黃金紅點鮭', rarity:'稀有', color:'#e8b040', min:0.15, max:1.4, power:0.5, w:0.02, desc:'身體變成金黃色的花羔紅點鮭，紅點還在，像金子上撒了紅寶石。' },
  { id:'himemasu_albino', spot:'icelake', of:'himemasu', name:'白化姬鱒', rarity:'稀有', color:'#f4ecec', min:0.3, max:1.6, power:0.58, w:0.02, desc:'全身白白的、眼睛紅紅的姬鱒。' },
  { id:'ito_gold', spot:'icelake', of:'ito', name:'黃金哲羅鮭', rarity:'傳說', color:'#d8a040', min:4, max:35, power:0.92, w:0.008, desc:'傳說中金色的「幻之魚」，連老漁夫一輩子都沒看過。' },
  { id:'capelin_gold', spot:'icesea', of:'capelin', name:'金色毛鱗魚', rarity:'稀有', color:'#e8d070', min:0.015, max:0.06, power:0.2, w:0.025, desc:'一大群銀色毛鱗魚裡，偶爾會混著一條金色的。' },
  { id:'hokke_albino', spot:'icesea', of:'hokke', name:'白化多線魚', rarity:'稀有', color:'#f0ece0', min:0.2, max:1.2, power:0.42, w:0.02, desc:'全身淡淡白色的遠東多線魚。' },
  { id:'cod_albino', spot:'icesea', of:'cod', name:'白化鱈魚', rarity:'稀有', color:'#f2eee6', min:0.8, max:9, power:0.6, w:0.02, desc:'全身雪白的鱈魚，在冰冷的海底像一顆會游的雪球。' },
  { id:'sleepershark_albino', spot:'icesea', of:'sleepershark', name:'白化睡鯊', rarity:'傳說', color:'#e8e4e0', min:80, max:700, power:0.97, w:0.008, desc:'全身白色的睡鯊，慢慢從深海浮上來，像一艘白色的潛水艇。' },
  { id:'baskingshark', spot:'harbor', name:'姥鯊', rarity:'傳說', color:'#6b665d', min:500, max:4000, power:0.95, w:0.18, desc:'世界第二大的魚，張著像山洞一樣的大嘴慢慢游，靠濾海水裡的浮游生物過活。鰓裂長得幾乎繞頭一圈，春天常常浮在水面晒太陽。' },
  { id:'greatwhite', spot:'harbor', name:'大白鯊', rarity:'傳說', color:'#6c7480', min:300, max:1500, power:0.99, w:0.2, desc:'背是石板灰、肚子雪白，一口三角形的鋸齒牙。會從深處往上衝撞獵物，力氣大到能把整條船拖著走，拉線一定要穩。' },
  { id:'baskingshark_albino', spot:'harbor', of:'baskingshark', name:'白化姥鯊', rarity:'傳說', color:'#f2ece4', min:500, max:4000, power:0.95, w:0.008, desc:'全身白裡透粉、眼睛淡紅的姥鯊。白化在好幾種鯊魚身上都出現過，但在姥鯊身上非常非常罕見。' },
  { id:'greatwhite_albino', spot:'harbor', of:'greatwhite', name:'白化大白鯊', rarity:'傳說', color:'#f4eee8', min:300, max:1500, power:0.99, w:0.008, desc:'背上的灰色不見了，全身粉白、眼睛是紅的。白化在好幾種鯊魚身上都出現過，但大白鯊非常非常罕見。' },
  { id:'shark_red_albino', spot:'harbor', of:'shark', rs:true, name:'白化赤紅霸王鯊', rarity:'傳說', color:'#f8e8e2', min:15, max:420, power:0.99, desc:'赤紅霸王鯊生小鯊時極少數會出現的白化個體，全身粉白、眼睛是紅的。牠一樣是族群裡的一隻，會長大、會留下叉叉；被釣光一樣會絕種。不能賣，也不能送人。' },
  { id:'shark_red', spot:'harbor', of:'shark', rs:true, name:'赤紅霸王鯊', rarity:'傳說', color:'#c8161c', min:15, max:420, power:0.99, desc:'全身深紅、背上有黑色虎紋的礁岩鯊。整片海只有一小群，從一公一母開始，沒被釣走就會慢慢繁殖；全部被釣光就絕種了。不能賣，也不能送人。' },
  { id:'arowana_red', spot:'lake', of:'arowana', name:'紅龍魚', rarity:'傳說', color:'#d8302a', min:3.0, max:12, power:0.86, w:0.1, desc:'鱗片紅得像火一樣的紅龍，比金龍更稀有。' },
  // 老闆的放生活動：每天一段時間只放一隻，全伺服器只有一隻（不在一般的釣點清單裡，見 Sev）
  { id:'bluelobster', spot:'shrimp', sev:true, name:'藍色龍蝦',   rarity:'傳說', color:'#2f6fe0', min:0.4,  max:1.2,  power:0.5,  desc:'大約兩百萬隻龍蝦才有一隻是藍色的，是基因讓殼裡的色素變成寶藍色。阿忠說這是他的壓箱寶。' },
];
const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

const V3 = (x, z) => new THREE.Vector3(x, 0, z), V2 = (x, z) => new THREE.Vector2(x, z).normalize();
// 六個釣點：fish = 會釣到的魚，legendBoost = 傳說魚機率加成
// 私人小島：在海上的另一個位置（主島在 -75～75 之間），每個人的島都在同一個地方，只會看到同一座島上的人
const ISLE = { x:150, z:0, r:24, y:0.32 };
// 海上的釣蝦場、企鵝冰原：在主島西邊的海上（用快速傳送或渡船去）
const SHRIMP = { x:-118, z:36, w:24, d:18, pw:14, pd:8, y:0.9 };
const ICE = { x:-120, z:-72, w:30, d:22, y:0.45 };
// 北方冰封群島（2026-11-05）：主島北邊（-x）的雪島，中間一座結冰的湖可以鑿冰洞釣魚，北邊海岸有流冰。坐港口阿海的船去
const FROST = { x:-160, z:-10, r:22, y:0.36, lake:{ x:-156, z:-8, r:8.5, y:0.37 }, holes:[[-158.4, -9.6], [-153.6, -5.8], [-155.2, -11.6], [-159.6, -4.6], [-152.4, -9.8]], dock:[-139.2, -10] };
// 深海浮台（2026-11-05）：遠洋上一座浮台；遠洋神秘島：火山島
const ABYSS = { x:64, z:-145, w:12, d:8, y:0.55 };
const MYST = { x:-60, z:162, r:16, y:0.5 };
function mystH(x, z){ const d = Math.hypot(x - MYST.x, z - MYST.z); if (d > MYST.r + 2.2) return null; const k = Math.max(0, 1 - d / (MYST.r * 0.5)), bump = Math.pow(k, 1.3) * 5 - (d < 1.6 ? (1.6 - d) * 0.9 : 0); return d <= MYST.r ? MYST.y + bump : MYST.y - (d - MYST.r) / 2.2 * 0.6; }   /* 中間一座小火山（頂上有火山口） */
function frostHole(x, z, r){ for (const h of FROST.holes) if (Math.hypot(x - h[0], z - h[1]) < (r || 0.45)) return h; return null; }
const SPOTS = [
  { id:'river',  label:'月灣河岸', short:'河岸',   subtitle:'木橋下的河灣，河魚最多',         pos:V3(-20.4, -17.6), color:PALETTE.river, dir:V2(0.25, -1),  fish:['perch','crucian','catfish','koi','tilapia','eel','snakehead','zacco','acro','pseudorasbora','koi_sanke','koi_showa','koi_ogon','catfish_albino','tilapia_red'] },
  { id:'lake',   label:'鏡湖',     short:'湖邊',   subtitle:'平靜如鏡的湖，錦鯉偶爾會浮上來', pos:V3(-21.8, -2),    color:'#62c9e0',     dir:V2(-1, 0.05),  fish:['crucian','perch','koi','carp','bass','goldfish','sturgeon','arowana','bighead','koi_sanke','koi_showa','koi_ogon','goldfish_ranchu','goldfish_telescope','goldfish_pearl','carp_mirror','arowana_red'], legendBoost:1.4 },
  { id:'pool',   label:'瀑布潭',   short:'瀑布潭', subtitle:'瀑布底下的深潭，水很冰',         pos:V3(-26.2, 5.4),   color:'#9fe3ff',     dir:V2(0, 1),      fish:['ayu','kuhua','goby','trout','loach','salmon','hillstream','candidia','trout_golden'] },
  { id:'sea',    label:'晴潮海邊', short:'海邊',   subtitle:'東海灘的木碼頭，近海魚很多',     pos:V3(0, -50.8),     color:PALETTE.sea,   dir:V2(0, -1),     fish:['mackerel','scorpion','moonbream','puffer','squid','bonito','cuttle','jelly','flounder','grouper','crab','tilefish','stingray'] },
  { id:'isle', label:'小島碼頭', short:'小島', subtitle:'自己小島的木碼頭，海風很舒服', pos:V3(ISLE.x, ISLE.z + ISLE.r + 5.4), color:'#5fb6e3', dir:V2(0, 1), fish:['clown','parrot','puffer','squid','sunfish','tuna','cuttle','octopus','seahorse','lionfish','turtle','lobster','butterfly','trevally','sergeant','rabbitfish','bluetang','moonwrasse','clown_black'] },
  { id:'harbor', label:'港口外海', short:'外海',   subtitle:'港口盡頭，大型魚出沒的深海',     pos:V3(33.2, -27),    color:'#1c5d8c',     dir:V2(1, -0.25),  fish:['mackerel','moonbream','manta','sunfish','dolphin','beluga','marlin','shark','orca','whaleshark','whale','sperm','tuna','octopus','ika','giantsquid','barracuda','hammer','oarfish','kingcrab','mahi','angler','saury','horsemack','hairtail','sardine','flyingfish','yellowtail','pomfret','grunt','roundscad','anchovy','filefish','threadfin','baskingshark','greatwhite','baskingshark_albino','greatwhite_albino'] },
  { id:'shrimp', label:'室內釣蝦場', short:'釣蝦場', subtitle:'買時段、坐板凳，看浮標整個沉下去才拉！', pos:V3(SHRIMP.x, SHRIMP.z + SHRIMP.pd / 2 + 0.75), color:'#ff9f43', dir:V2(0, -1), fish:['prawn','whiteshrimp','tigerprawn','crayfish','blueclaw','goldprawn','crayfish_blue'] },
  { id:'mangrove', label:'紅樹林碼頭', short:'紅樹林', subtitle:'南方沙灘再往南的紅樹林，漲潮時魚會游進樹根之間', pos:V3(67.8, 10), color:'#4f9a5a', dir:V2(1, 0), late:true, fish:['mullet','milkfish','scat','terapon','blackbream','mudcrab','mangsnapper','barramundi','bullshark','sawfish','scat_red'] },
  { id:'mudflat', label:'紅樹林泥灘', short:'泥灘', subtitle:'退潮時露出來的泥灘，慢慢靠近、徒手抓', pos:V3(9999, 9999), color:'#8a6a4a', dir:V2(0, 1), hidden:true, fish:['mudskipper','fiddler','bigskipper','mudskipper_albino','fiddler_blue'] },
  { id:'canal', label:'百年生態池', short:'生態池', subtitle:'百年生態池：石頭砌的池邊、紅色拱橋、假山和睡蓮', pos:V3(13.0, -41.1), color:'#5aa070', dir:V2(0, 1), late:true, fish:['tilapia','crucian','carp','snakehead','pseudorasbora','mosquitofish','guppy','pleco','giantsnake','clarias','tilapia_red','mosquitofish_gold','pleco_albino','giantsnake_red','clarias_albino','guppy_albino'] },
  { id:'abyss', label:'深海浮台', short:'深海', subtitle:'遠洋上的浮台，底下是幾百公尺深的海溝，放長長的線下去釣', pos:V3(64.2, -148.4), color:'#1d3a6a', dir:V2(0, -1), late:true, fish:['mehikari','rattail','blackthroat','blobfish','fangtooth','goblinshark','sixgill','mehikari_gold','rattail_albino','blackthroat_gold','blobfish_albino','fangtooth_gold','goblinshark_albino','sixgill_albino'] },
  { id:'mystic', label:'神秘島礁岩', short:'神秘島', subtitle:'遠洋火山島的黑色礁岩，寒流和暖流在這裡交會', pos:V3(-60, 178.6), color:'#3a8a7a', dir:V2(0, 1), late:true, fish:['creolefish','razorsurgeon','idol','batfish','galapagosshark','creolefish_gold','razorsurgeon_albino','idol_gold','batfish_albino','galapagosshark_albino'] },
  { id:'icelake', label:'冰湖冰洞', short:'冰湖', subtitle:'結冰的湖上鑿好的小洞，用手竿垂直放線下去', pos:V3(-157.2, -10.8), color:'#9fd8f0', dir:V2(-0.7, 0.7).normalize(), late:true, fish:['wakasagi','shirauo','dolly','himemasu','ito','wakasagi_gold','shirauo_gold','dolly_gold','himemasu_albino','ito_gold'] },
  { id:'icesea', label:'流冰海岸', short:'流冰', subtitle:'冰封群島北邊的海岸，流冰一塊一塊漂過來', pos:V3(-179.4, -10), color:'#5f9fc8', dir:V2(-1, 0), late:true, fish:['capelin','hokke','cod','sleepershark','capelin_gold','hokke_albino','cod_albino','sleepershark_albino'] },
  { id:'reef', label:'珊瑚礁岸', short:'珊瑚礁', subtitle:'本島西邊走長橋過去的珊瑚礁島，站在礁岩上用磯釣竿最好', pos:V3(-9.0, 87.5), color:'#2fb0a8', dir:V2(-1, 0.1), late:true, fish:['rabbitfish','girella','blackgirella','lethrinus','amberjack','parrot','butterfly','sergeant','lionfish','octopus','trevally','grouper','rabbitfish_gold','girella_gold','blackgirella_albino','lethrinus_red','amberjack_gold'] },
  { id:'weir', label:'雙心石滬', short:'石滬', subtitle:'珊瑚礁島東邊用咾咕石疊成的愛心石滬，退潮時魚被困在裡面、咬得特別快', pos:V3(11.0, 82.0), color:'#e86a8a', dir:V2(1, 0), late:true, fish:['rabbitfish','sergeant','butterfly','girella','octopus','puffer','rabbitfish_gold','girella_gold'] },
  { id:'creek',  label:'螢光溪間', short:'溪間',   subtitle:'森林深處的秘密水潭',             pos:V3(20.8, 27.4),   color:PALETTE.creek, dir:V2(1, 0.05),   fish:['kuhua','goby','trout','lantern','shrimp','medaka','candidia','guppy','trout_golden'], legendBoost:1.8 },
];
const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));
const AQUA = [11, -14];
const TANK_ROCKS = [];   // 水族館裡石頭的位置（魚會從上面游過去）
const LIGHTHOUSE = (() => { const r = islandR(-1.2) - 3.2; return [Math.cos(-1.2) * r, Math.sin(-1.2) * r]; })();
/* 潮汐商店街（2026-11-04 使用者：NPC 的店分開一點、整齊一點）：往珊瑚礁群島那條路的兩邊，一排一排的店，門口都朝著路 */
var SHOPLOT = { ling:{ x:-7, z:30.5, r:Math.PI / 2 }, mu:{ x:9.5, z:22.5, r:-Math.PI / 2 }, cai:{ x:-7, z:38.5, r:Math.PI / 2 }, spare:{ x:9, z:31, r:-Math.PI / 2 } };
var Mkt = { tab:'new', list:null, mine:null, stats:null, at:0, busy:false, sell:null, fish:null };
function lotAt(k, lx, lz){ const L = SHOPLOT[k], c = Math.cos(L.r), s = Math.sin(L.r); return [L.x + c * lx + s * lz, L.z - s * lx + c * lz]; }
const LANDMARKS = [
  { id:'plaza',      label:'潮汐廣場', pos:V3(4, 4),            color:PALETTE.gold, ly:1.8 },
  { id:'aquarium',   label:'水族館',   pos:V3(AQUA[0], AQUA[1]), color:PALETTE.coral, ly:6.8, mx:7.6, mz:4.6 },
  { id:'chat',       label:'聊天亭',   pos:V3(-3, 22),          color:'#f5a5d8', ly:3.8 },
  { id:'tackle',     label:'釣具店',   pos:V3(-9, -3),          color:'#f6a96b', ly:5.5, mx:2.4, mz:2.8 },
  { id:'shop',       label:'海邊商店', pos:V3(18, -1),          color:'#5fb6e3', ly:5.5, mx:-2.6, mz:2.8 },
  { id:'cook',       label:'潮汐食堂', pos:V3(12.5, 8.5),       color:'#f17b6d', ly:3.6 },
  { id:'tailor',     label:'阿綾服裝店', pos:V3(SHOPLOT.ling.x, SHOPLOT.ling.z), color:'#f5a5d8', ly:5.5, mx:2.4, mz:-2.6 },
  { id:'mu',         label:'阿木木工坊', pos:V3(SHOPLOT.mu.x, SHOPLOT.mu.z), color:'#c79a6b', ly:5.5, mx:-2.4, mz:2.6 },
  { id:'market',     label:'釣客魚市', pos:V3(SHOPLOT.spare.x, SHOPLOT.spare.z), color:'#5fb6e3', ly:5.5, mx:-2.4, mz:2.6 },
  { id:'cai',        label:'阿彩畫廊', pos:V3(SHOPLOT.cai.x, SHOPLOT.cai.z), color:'#9b7bff', ly:5.5, mx:2.4, mz:-2.6 },
  { id:'fu',         label:'阿福海產店', pos:V3(20.5, -25.5),   color:'#5fb6e3', ly:5.5, mx:-2.4, mz:2.4 },
  { id:'lighthouse', label:'晴潮燈塔', pos:V3(LIGHTHOUSE[0], LIGHTHOUSE[1]), color:'#ffe5a4', ly:7.4 },
  { id:'hill',       label:'望海丘',   pos:V3(-28, 25),         color:'#a6d37d', ly:2.6 },
  { id:'beach',      label:'南方沙灘', pos:V3(40, -6),          color:'#f2d69a', ly:2.2 },
];
// 小船停靠點
const BOAT_DOCKS = [
  { id:'harbor', x:28.5, z:-30.5, rot:Math.PI / 2 },
  { id:'lake',   x:-20.5, z:-4.9, rot:-Math.PI / 2 },
];
// 快速傳送點（站的位置與面向）
const TRAVEL = [
  { id:'plaza', label:'潮汐廣場', x:4, z:9.6, rot:Math.PI, color:PALETTE.gold },
  ...SPOTS.filter(s => s.id !== 'isle' && !s.hidden).map(s => s.id === 'shrimp' ? { id:s.id, label:'釣蝦場門口', x:-1, z:-6.4, rot:Math.PI, color:s.color } : ({ id:s.id, label:s.label, x:s.pos.x, z:s.pos.z, rot:Math.atan2(s.dir.x, s.dir.y), color:s.color })),   /* 釣蝦場在村子裡，傳送到門口（SHRIMP_DOOR 往外 2.6） */
  { id:'hill', label:'望海丘', x:-26, z:27, rot:-2.6, color:'#a6d37d' },
  { id:'lighthouse', label:'晴潮燈塔', x:LIGHTHOUSE[0] - 2.4, z:LIGHTHOUSE[1] + 3.2, rot:2.6, color:'#ffe5a4' },
  { id:'frostdock', label:'冰封群島碼頭', x:-141.2, z:-10, rot:-Math.PI / 2, color:'#bfe6f5' },
  { id:'abyssdock', label:'深海浮台', x:64, z:-143.5, rot:Math.PI, color:'#1d3a6a' },
  { id:'mystdock', label:'神秘島碼頭', x:-60, z:150.5, rot:0, color:'#3a8a7a' },
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
  scorpion: { shape:'Scorpion', c:{ Top:'#c0603c', Bottom:'#efc49a', Fins:'#d0724a', Spots:'#6b2c1c', Eye:'#2a1a14' } },
  moonbream:{ shape:'Fish2', c:{ Body:'#f2c14e', Front:'#fff0b8', Fins:'#e59a2f' } },
  kuhua:    { shape:'Fish1', c:{ Top:'#6fae9a', Bottom:'#e6f4ee', Fins:'#a8d8c4' } },
  ayu:      { shape:'Fish1', c:{ Top:'#8fae5a', Bottom:'#eef4dc', Fins:'#d8c46a' } },
  goby:     { shape:'Goby', c:{ Top:'#7a54d8', Bottom:'#d9ccff', Fins:'#a98cf2', Spots:'#f1e6ff', Ring:'#f6f0ff', Eye:'#1d1430' }, glow:true },
  trout:    { shape:'Fish1', c:{ Top:'#9b5de5', Bottom:'#efe6ff', Fins:'#c084ff' }, glow:true },
  tilapia:  { shape:'Fish2', c:{ Body:'#7d8f78', Front:'#c9d4bf', Fins:'#5f7060' } },
  eel:      { shape:'Eel',   c:{ Top:'#4a4f32', Bottom:'#c9c08a', Fins:'#6b6a3e', Eye:'#1d1f12' }, move:'eel' },
  carp:     { shape:'Fish1', c:{ Top:'#c98a2a', Bottom:'#f3d68a', Fins:'#e0a84a' }, glow:true },
  loach:    { shape:'Eel',   c:{ Top:'#7d6a4a', Bottom:'#d8c79e', Fins:'#9a8460', Eye:'#1d1a12' }, move:'eel' },
  puffer:   { shape:'Puffer', c:{ Top:'#c9b06a', Bottom:'#f6efd8', Fins:'#d8a64a', Spots:'#5a4a2a', Eye:'#1d1a12' } },
  squid:    { shape:'Squid', c:{ Top:'#f0b9a8', Bottom:'#fbe3da', Fins:'#f4c7b8', Spots:'#c4645a', Eye:'#2a1a1a' } },
  bonito:   { shape:'Fish1', c:{ Top:'#2c4f80', Bottom:'#e8eef4', Fins:'#6f8fb8' } },
  tuna:     { shape:'Fish1', c:{ Top:'#1c2f4d', Bottom:'#cfd8e2', Fins:'#e2c24a' }, glow:true },
  lantern:  { shape:'Fish1', c:{ Top:'#2fae8a', Bottom:'#bff7e2', Fins:'#7af0c0' }, glow:true },
  clown:    { shape:'Fish3', c:{ Body:'#ff7a2a', Stripes:'#ffffff', Outline:'#1a1a1a' } },
  parrot:   { shape:'Fish2', c:{ Body:'#2fc6a6', Front:'#ff9ad5', Fins:'#5f8cff' } },
  cuttle:   { shape:'Cuttle', c:{ Top:'#a87560', Bottom:'#ecd9cc', Fins:'#d8bfae', Spots:'#f6ece4', Eye:'#2f7a6a', Ring:'#c9a890' } },
  octopus:  { shape:'Octopus', c:{ Top:'#d0553f', Bottom:'#f1a48f', Fins:'#e06a52', Spots:'#fbe0d6', Eye:'#2a1a14', Ring:'#f7d07a' } },
  ika:      { shape:'Squid', c:{ Top:'#e88a6a', Bottom:'#fbd8c8', Fins:'#f0a68a', Spots:'#b8463a', Eye:'#1d1414' } },
  giantsquid:{ shape:'Squid', c:{ Top:'#b8383a', Bottom:'#e9a49a', Fins:'#c94a48', Spots:'#6e1a1e', Eye:'#ffd36a' }, glow:true },
  snakehead:{ shape:'Fish1', c:{ Top:'#2f3a24', Bottom:'#a8a88a', Fins:'#4a5a34' } },
  bass:     { shape:'Fish1', c:{ Top:'#4f6f30', Bottom:'#e3e8cf', Fins:'#7f9a50' } },
  goldfish: { shape:'Fish2', c:{ Body:'#ff7a1a', Front:'#ffc070', Fins:'#ffb050' } },
  sturgeon: { shape:'Eel',   c:{ Top:'#6d7784', Bottom:'#d9dde2', Fins:'#5a636e', Eye:'#1d2228' }, glow:true, move:'eel' },
  salmon:   { shape:'Fish1', c:{ Top:'#9a6a7a', Bottom:'#f3dfe4', Fins:'#e59ab0' } },
  jelly:    { shape:'Jelly', c:{ Top:'#bfe6ff', Bottom:'#e8f6ff', Fins:'#d6f0ff', Spots:'#f5c6ff', Ring:'#ffffff' }, glow:true, move:'vert' },
  flounder: { shape:'Manta', c:{ Top:'#a88a62', Bottom:'#f1e8da' }, move:'wing' },
  grouper:  { shape:'Fish2', c:{ Body:'#9a7d52', Front:'#d2b88a', Fins:'#7a6040' }, glow:true },
  barracuda:{ shape:'Fish1', c:{ Top:'#7f8fa0', Bottom:'#eef2f5', Fins:'#c9d6e3' } },
  hammer:   { shape:'Shark', c:{ Top:'#5f7488', Bottom:'#eef2f5' }, glow:true },
  oarfish:  { shape:'Eel',   c:{ Top:'#d9dfe6', Bottom:'#f4f6f8', Fins:'#e0443a', Eye:'#1d2228' }, glow:true, move:'eel' },
  seahorse: { shape:'Seahorse', c:{ Top:'#f2a14a', Bottom:'#ffd08a', Fins:'#ffe0b0', Spots:'#d97a2a', Eye:'#1d1a12' }, move:'vert' },
  lionfish: { shape:'Scorpion', c:{ Top:'#d9453a', Bottom:'#fbe9e4', Fins:'#f6c2b8', Spots:'#ffffff', Eye:'#1d1414' } },
  turtle:   { shape:'Turtle', c:{ Top:'#6b8f4a', Bottom:'#e8d8a8', Fins:'#8fae6a', Spots:'#4a6a30', Eye:'#1d1a12' }, glow:true, move:'wing' },
  crab:     { shape:'Crab', c:{ Top:'#e06a3a', Bottom:'#f6c8a0', Fins:'#d0552c', Spots:'#fbe0c8', Eye:'#1d1414' }, move:'vert' },
  kingcrab: { shape:'Crab', c:{ Top:'#c9302c', Bottom:'#f3b8a0', Fins:'#b02420', Spots:'#ffe0d0', Eye:'#1d1414' }, move:'vert' },
  lobster:  { shape:'Lobster', c:{ Top:'#3f6fb5', Bottom:'#a8c8ef', Fins:'#2f5a98', Spots:'#1f3f78', Eye:'#141418' }, move:'vert' },
  shrimp:   { shape:'Shrimp', c:{ Top:'#f5a5b8', Bottom:'#ffe0e8', Fins:'#f8c0cc', Eye:'#2a1414' }, move:'vert' },
  arowana:  { shape:'Fish1', c:{ Top:'#d9a020', Bottom:'#fbe7a0', Fins:'#e8b730' }, glow:true },
  tilefish: { shape:'Fish2', c:{ Body:'#f2a0a8', Front:'#fbe0e4', Fins:'#ffd36a' } },
  mahi:     { shape:'Fish1', c:{ Top:'#2fae6a', Bottom:'#ffe07a', Fins:'#3f7fd0' } },
  butterfly:{ shape:'Fish2', c:{ Body:'#ffd23a', Front:'#fff6d0', Fins:'#2a2a2a' } },
  angler:   { shape:'Puffer', c:{ Top:'#3b3a48', Bottom:'#6d6a78', Fins:'#2a2934', Spots:'#9fe8ff', Eye:'#d8f0ff' }, glow:true },
  stingray: { shape:'Manta', c:{ Top:'#7d6a52', Bottom:'#efe6da' }, move:'wing' },
  trevally: { shape:'Fish1', c:{ Top:'#4f5f70', Bottom:'#dfe6ec', Fins:'#2f3a46' } },
  saury:      { shape:'Fish1', c:{ Top:'#3a5f90', Bottom:'#e6ecf2', Fins:'#d8b040' } },
  horsemack:  { shape:'Fish1', c:{ Top:'#6f8aa0', Bottom:'#e8eef2', Fins:'#d8c070' } },
  hairtail:   { shape:'Eel',   c:{ Top:'#c9d2da', Bottom:'#f2f5f8', Fins:'#e0e6ec', Eye:'#d8c060' }, move:'eel', glow:true },
  sardine:    { shape:'Fish1', c:{ Top:'#3f6a90', Bottom:'#eef2f5', Fins:'#a8bccd' } },
  flyingfish: { shape:'Fish1', c:{ Top:'#2f6fc0', Bottom:'#e6f0f8', Fins:'#8fc0f0' } },
  yellowtail: { shape:'Fish1', c:{ Top:'#4f8a7a', Bottom:'#eef2ec', Fins:'#f2c94a' } },
  milkfish:   { shape:'Fish1', c:{ Top:'#9aa8b4', Bottom:'#f2f4f6', Fins:'#c9d0d6' } },
  mullet:     { shape:'Fish1', c:{ Top:'#4f5a62', Bottom:'#d8dde0', Fins:'#7a858c' } },
  zacco:      { shape:'Fish1', c:{ Top:'#5f90b0', Bottom:'#f2d8e0', Fins:'#e88aa0' } },
  bighead:    { shape:'Fish2', c:{ Body:'#7a868c', Front:'#c9d0d4', Fins:'#5a6468' } },
  prawn:      { shape:'Shrimp', c:{ Top:'#5f8fb0', Bottom:'#d9e8f0', Fins:'#2f5f9a', Eye:'#141418' }, move:'vert' },
  whiteshrimp:{ shape:'Shrimp', c:{ Top:'#d8dde0', Bottom:'#f4f6f7', Fins:'#e6c9b8', Eye:'#141418' }, move:'vert' },
  tigerprawn: { shape:'Shrimp', c:{ Top:'#4a5a3a', Bottom:'#c9c0a0', Fins:'#2a2f22', Eye:'#141418' }, move:'vert' },
  crayfish:   { shape:'Lobster', c:{ Top:'#c0402a', Bottom:'#f0a080', Fins:'#9a2a1a', Spots:'#7a1a10', Eye:'#141418' }, move:'vert' },
  blueclaw:   { shape:'Shrimp', c:{ Top:'#2f6fd0', Bottom:'#cfe0ff', Fins:'#1f4fb0', Eye:'#141418' }, move:'vert', glow:true },
  bluelobster: { shape:'Lobster', c:{ Top:'#2f6fe0', Bottom:'#9cc4ff', Fins:'#2a5cc0', Spots:'#173f99', Eye:'#141418' }, move:'vert', glow:true },
  goldprawn:  { shape:'Shrimp', c:{ Top:'#e8b730', Bottom:'#fff0b8', Fins:'#d89a20', Eye:'#2a1a0a' }, move:'vert', glow:true },
  capelin:    { shape:'Fish1', c:{ Top:'#6f8fa8', Bottom:'#e8f0f4', Fins:'#a8c0d0' } },
  cod:        { shape:'Fish1', c:{ Top:'#7a8a6a', Bottom:'#ece6d2', Fins:'#5f6a50' } },
  arcticchar: { shape:'Fish1', c:{ Top:'#5a6a5a', Bottom:'#e8784a', Fins:'#f0a080' } },
  icefish:    { shape:'Fish1', c:{ Top:'#cfe6f4', Bottom:'#f4fbff', Fins:'#bfe0f0' }, glow:true },
  toothfish:  { shape:'Shark', c:{ Top:'#3a4048', Bottom:'#a8b0b8', Fins:'#2a3038' } },
  narwhal:    { shape:'Beluga', c:{ Top:'#9aa4ac', Bottom:'#e8ecef', Fins:'#7a848c', Eye:'#2a3138' }, move:'vert' },
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
// 照維基百科重做的魚：用參數產生模型（js/fish-gen.js、js/fish-specs.js），第一次用到才產生
for (const [id, S] of Object.entries(FISH_SPECS)){
  const shape = 'G_' + id; let cache = null;
  Object.defineProperty(FISH_MESH, shape, { configurable:true, enumerable:true, get(){ if (!cache){ const gen = FishGen[{ shrimp:'genShrimp', crab:'genCrab', squid:'genSquid', octo:'genOcto', jelly:'genJelly', turtle:'genTurtle', seahorse:'genSeahorse' }[S.gen] || 'genFish']; cache = gen(Quality.tier === 'low' ? Object.assign({ lod:true }, S.p) : S.p); } return cache; } });
  FISH_STYLE[id] = { shape, c: Object.assign({ Mouth:'#2a1a18' }, S.c), move: S.move || 'side', glow: !!S.glow, glowParts: S.glowParts };   /* 嘴巴預設深色 */
}
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
  eel:  'float wk = clamp((0.6 - position.x) / 1.3, 0.0, 1.0);\n transformed.z += sin(uFishT * 7.0 + position.x * 7.0) * 0.07 * (0.25 + wk);',
  wing: 'float wk = clamp((abs(position.z) - 0.12) / 0.4, 0.0, 1.0);\n transformed.y += sin(uFishT * 3.0 - abs(position.z) * 2.0) * 0.13 * wk;',
};
function fishMat(id, part, color, glow, move, shape){
  move = move || 'side';
  const key = id + '/' + part; if (fishMatCache[key]) return fishMatCache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness:0.55, metalness:0.05, flatShading:true });
  const body = ['Top', 'Bottom', 'Body', 'Front', 'Stripes'].includes(part), scaly = body && /^Fish/.test(shape || '');
  if (!CLASSIC && part === 'Fins'){ m.transparent = true; m.opacity = 0.88; m.side = THREE.DoubleSide; }
  if (glow && (part === 'Top' || part === 'Body')){ m.emissive = new THREE.Color(color); m.emissiveIntensity = 0.35; }
  if (shape === 'Goby' && part === 'Spots'){ m.emissive = new THREE.Color(color); m.emissiveIntensity = 0.9; }
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
    const mt = fishMat(f.id, part, st.c[part] || f.color, st.glow, st.move, st.shape); if (st.glowParts && st.glowParts.includes(part) && !mt.userData.gl){ mt.userData.gl = 1; mt.emissive = new THREE.Color(st.c[part] || f.color); mt.emissiveIntensity = 0.9; }
    const mesh = new THREE.Mesh(fishGeo(st.shape, part), mt);
    mesh.castShadow = true; inner.add(mesh);
  }
  fish.userData.tail = new THREE.Object3D();   // 舊程式會轉尾巴；新模型的擺動在 shader 裡
  return fish;
}
function fishModel(f, scale){
  if (f.id === 'marlin' && !FISH_STYLE.marlin) return makeMarlin(scale);
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
function lerp(a, b, k){ return a + (b - a) * k; }
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
    [[4, 4], [3, 18], [1, 32], [0, 43.6]],               // 往跨海大橋（珊瑚礁群島）
  ],
};
// 珊瑚礁群島（參考小琉球、澎湖）的位置，放在這裡是因為建地形、種樹的時候就要用到
/* 阿綾服裝店：建房子的時候就要用到，所以放在這裡（var 才不會在宣告前用到出錯） */
var Ling = { rack:null, list:null, at:0, busy:false, gearSet:'' };
var Cai = { list:null, today:null, at:0, busy:false, show:null, showId:0, tex:new Map() };
var Mu = { show:null, at:0, busy:false };
var Fu = { data:null, at:0, busy:false, ice:null, iceKey:'', pick:null };
var REEF = { x:0, z:86, r:10, y:0.42, bz0:43.6, bz1:76.8, bw:2.2, by:0.55, weir:[[13.6, 82.0, 0.13], [13.6, 87.6, 0.115]] };
// 百年生態池（參考新竹湖口國小，前身大湖口公學校的生態池）：兩個圓圓的池子連在一起，中間有紅色拱橋
const POND = { x:16.6, z:-36.4, lobes:[[13.0, -36.2, 4.2], [20.2, -36.6, 3.6]], bx:16.8, mound:[12.4, -36.6], hut:[8.0, -33.2], sign:[6.0, -38.6], trees:[[8.4, -41.6, 1.0], [24.2, -31.6, 0.9], [23.2, -41.4, 0.85]] };
var CANAL = POND;   /* 舊的名字（有些地方還在用） */
function pondIn(x, z){ let e = -99; POND.lobes.forEach(([cx, cz, r], i) => { const a = Math.atan2(z - cz, x - cx); e = Math.max(e, r + wobble(a * 3, i * 2.1) * 0.35 - Math.hypot(x - cx, z - cz)); }); return e; }   /* 正的＝在池子裡 */
function hillH(x, z){
  const h = MAP.hill, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
  if (d > h.R + 0.5) return 0;
  const face = Math.pow(Math.max(0, (dx * h.face[0] + dz * h.face[1]) / (d || 1)), 3) * smooth01(d / 5);   /* 山頂中間不要分崖面、緩坡面，不然方向一變高度就跳 */
  const ramp = 14 * (1 - face) + 3 * face;              // 面向瀑布潭的那一面是陡峭的崖
  const R = h.R + wobble(Math.atan2(dz, dx) * 4, 0.9) * 0.6;
  return h.H * smooth01((R - d) / ramp) + Math.sin(x * 0.5) * Math.sin(z * 0.43) * 0.25 * smooth01((R - ramp - d) / 3);   /* 山頂的小起伏要慢慢淡出，不然會有一道看不見的小台階卡住人 */
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
  // 百年生態池
  if (Math.abs(x - POND.x) < 12 && Math.abs(z - POND.z) < 8) dig(pondIn(x, z), 1.0, 0.55, 5);
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
var houseBuilder = null;
var CHAIRS = [], cafeSeats = [], mySeat = null;   // 可以坐的椅子；cafeSeats 是食堂露台給客人坐的位置
let skyDome = null, waterSurface = null, sunDisc = null, windowGlass = null, tankWaterMat = null, cookStall = null, aquaVane = null, rainbow = null;

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
/* 斜放的房子、攤子：照它真正的方向擋（原本用外框方塊，斜的東西四個角會多擋一大塊，走不過去） */
const addOBoxCol = (x, z, w, d, rot) => { const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2; colliders.push({ t:'o', x, z, hw, hd, c, s, bw: Math.abs(c) * hw + Math.abs(s) * hd, bd: Math.abs(s) * hw + Math.abs(c) * hd }); };
const addCircleCol = (x, z, r) => colliders.push({ t:'c', x, z, r });
function addDeck(x, z, w, d, y){ decks.push({ x0:x-w/2, x1:x+w/2, z0:z-d/2, z1:z+d/2, y }); }
// 釣蝦場平台：中間留一個蝦池（四條木板圍起來）
{ const S = SHRIMP, bw = (S.w - S.pw) / 2, bd = (S.d - S.pd) / 2;
  addDeck(S.x, S.z - S.pd / 2 - bd / 2, S.w, bd, S.y); addDeck(S.x, S.z + S.pd / 2 + bd / 2, S.w, bd, S.y);
  addDeck(S.x - S.pw / 2 - bw / 2, S.z, bw, S.pd, S.y); addDeck(S.x + S.pw / 2 + bw / 2, S.z, bw, S.pd, S.y); }
function inShrimpHall(x, z, m){ return Math.abs(x - SHRIMP.x) < SHRIMP.w / 2 + (m || 0) && Math.abs(z - SHRIMP.z) < SHRIMP.d / 2 + (m || 0); }
function inShrimpPool(x, z){ return Math.abs(x - SHRIMP.x) < SHRIMP.pw / 2 - 0.05 && Math.abs(z - SHRIMP.z) < SHRIMP.pd / 2 - 0.05; }
function nearIce(x, z, m){ return Math.abs(x - ICE.x) < ICE.w / 2 + (m || 0) && Math.abs(z - ICE.z) < ICE.d / 2 + (m || 0); }

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
// ---- 季節：跟著現實（台灣）的月份。3～5 月春、6～8 月夏、9～11 月秋、12～2 月冬；網址加 #season=winter 可以預覽 ----
var SEASONS = {
  spring: { name:'春天', icon:'🌸', desc:'櫻花開了，溪裡的香魚、櫻花鉤吻鮭和櫻花蝦最多。', fish:['ayu', 'salmon', 'shrimp', 'squid', 'carp', 'flounder'] },
  summer: { name:'夏天', icon:'🌻', desc:'海水變暖，鬼頭刀、鰹魚和熱帶魚都游過來了。',     fish:['mahi', 'bonito', 'parrot', 'butterfly', 'jelly', 'sunfish'] },
  autumn: { name:'秋天', icon:'🍁', desc:'樹葉變紅了，秋天的鯖魚、螃蟹、墨魚最肥。',       fish:['mackerel', 'crab', 'cuttle', 'barracuda', 'catfish', 'eel'] },
  winter: { name:'冬天', icon:'❄️', desc:'天氣變冷，馬頭魚、帝王蟹、魷魚和鮟鱇魚正是時候。', fish:['tilefish', 'kingcrab', 'ika', 'angler', 'crucian', 'grouper'] },
};
var SEASON = (() => { const h = (location.hash.match(/season=(\w+)/) || [])[1]; if (SEASONS[h]) return h; const m = new Date(Date.now() + 8 * 3600e3).getUTCMonth() + 1; return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; })();
var SEASON_FISH = new Set(SEASONS[SEASON].fish);
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
    const SP = SEASON === 'spring', AU = SEASON === 'autumn', WI = SEASON === 'winter';
    if (pine) kinds.pine.push({ x, y, z, sc, sy: 1.08, ry, crown: C(WI ? ['#5b8f73', '#6c9a82', '#d9e6e4'][Math.floor(hash(k, 4) * 3)] : ['#4f8f4f', '#5d9c55', '#4a8a5e'][Math.floor(hash(k, 4) * 3)]), trunk: C('#7a4f33') });
    else if (birch) kinds.birch.push({ x, y, z, sc, sy: 1, ry, crown: C(AU ? ['#f0c75a', '#e8b04a', '#f2d36e'][Math.floor(hash(k, 5) * 3)] : WI ? ['#c9c3a0', '#d6d0b0', '#bfc2a8'][Math.floor(hash(k, 5) * 3)] : ['#b2d46a', '#a3cc64', '#c2db78'][Math.floor(hash(k, 5) * 3)]), trunk: C('#efeae0') });
    else {
      const blossom = (village && hash(k, 2) < (SP ? 0.6 : 0.3)) || (SP && hash(k, 2) < 0.22), fruit = village && !blossom && hash(k, 3) < (AU ? 0.5 : 0.35);
      const crown = blossom && !AU && !WI ? ['#f7b6c8', '#f4a3bb', '#fbcad8'][Math.floor(hash(k, 6) * 3)]
        : AU ? ['#e0a14a', '#d9783c', '#c9573a', '#e8c15a', '#a7a95a'][Math.floor(hash(k, 7) * 5)]
        : WI ? ['#8fae86', '#9db894', '#a9bfa3', '#c5d3c8'][Math.floor(hash(k, 7) * 4)]
        : ['#8cc46a', '#7ab85e', '#9fd27a', '#76b35f'][Math.floor(hash(k, 7) * 4)];
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

// 這一點是不是可以下竿的水面（不是碼頭、也不是小島的陸地）
function waterAt(px, pz){ if (inShrimpHall(px, pz, 5)) return inShrimpPool(px, pz); if (Math.hypot(px - FROST.x, pz - FROST.z) < FROST.r + 1.2) return !!frostHole(px, pz, 0.5); if (Math.hypot(px - MYST.x, pz - MYST.z) < MYST.r + 0.6) return false; if (nearReef(px, pz) && reefE(px, pz) > -0.3) return false; { const e = mangE(px, pz); if (e > 0 || (e > -4.6 && mudOut())) return false; } const i = terrainInfo(px, pz); return i.water && i.h < -0.15 && !deckAt(px, pz) && isleH(px, pz) === null; }
function castBlocked(x, z, px, pz){
  const L = Math.hypot(px - x, pz - z); if (L < 2.2) return false;
  let wet = !!deckAt(x, z); for (let d = 0.8; d < L - 0.4; d += 0.3){ const k = d / L, qx = x + (px - x) * k, qz = z + (pz - z) * k; if (deckAt(qx, qz)) continue; if (waterAt(qx, qz) || groundHeight(qx, qz) <= WATER_LEVEL + 0.02){ wet = true; continue; } if (wet) return true; }   /* 先經過水、後面又碰到陸地＝線拉過對岸或小島（站在岸上往水裡拋是可以的） */
  return false;
}
function castPoint(x, z, dx, dz, dist){
  const ok = d => waterAt(x + dx * d, z + dz * d);
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
  deck(ISLE.x - 1.4, ISLE.x + 1.4, ISLE.z + ISLE.r - 0.5, ISLE.z + ISLE.r + 5.4, 0.36);   // 私人小島的碼頭
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
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.9, fallLen, 1, 6), wfMat);
  fall.position.set(fx, WATER_LEVEL + fallLen / 2, fz); fall.lookAt(fx + fd[0], WATER_LEVEL + fallLen / 2, fz + fd[1]); fall.userData.keep = true; scene.add(fall);
  // 後面再一層較深、較慢的水，看起來比較厚
  const wfBack = wfMat.clone(); wfBack.uniforms = { uT: { get value(){ return fishTime.value * 0.6 + 3.7; } } };
  wfBack.fragmentShader = wfMat.fragmentShader.replace('vec3(0.62, 0.86, 0.95)', 'vec3(0.38, 0.68, 0.84)');
  const fall2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, fallLen + 0.1, 1, 6), wfBack);
  fall2.position.set(fx - fd[0] * 0.18, WATER_LEVEL + fallLen / 2, fz - fd[1] * 0.18); fall2.lookAt(fx + fd[0] * 2, WATER_LEVEL + fallLen / 2, fz + fd[1] * 2); fall2.renderOrder = -1; fall2.userData.keep = true; scene.add(fall2);
  // 崖頂的小溪流向瀑布、崖邊的石唇
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2, 1, 4), wfMat); top.rotation.x = -Math.PI / 2; const topG = new THREE.Group(); topG.add(top);
  topG.position.set(fx - fd[0] * 1.7, fallTop - 0.02, fz - fd[1] * 1.7); topG.rotation.y = Math.atan2(fd[0], fd[1]); topG.userData.keep = true; scene.add(topG);
  { // 自己的亂數，不影響地圖其他東西的位置
    let sd = 99; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const lat = [-fd[1], fd[0]], rockM2 = mat('#8f8b80', 0.95, { flatShading:true }), mossM = mat('#6f9a5a', 0.95, { flatShading:true });
    const lip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), rockM2); lip.scale.set(3.2, 0.5, 1.2); lip.position.set(fx - fd[0] * 0.25, fallTop - 0.25, fz - fd[1] * 0.25); lip.rotation.y = Math.atan2(lat[0], lat[1]); lip.castShadow = true; scene.add(lip);
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++){   // 瀑布兩側疊起來的岩壁
      const h = 0.35 + k * 0.82, off = 1.75 + rr() * 0.5, sz = 0.55 + rr() * 0.45;
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), k % 3 === 2 ? mossM : rockM2);
      rk.position.set(fx + lat[0] * side * off - fd[0] * (0.2 + rr() * 0.6), Math.min(fallTop, h), fz + lat[1] * side * off - fd[1] * (0.2 + rr() * 0.6));
      rk.scale.set(1, 0.75 + rr() * 0.4, 1); rk.rotation.set(rr() * 3, rr() * 3, 0); rk.castShadow = true; scene.add(rk);
    }
    // 潭裡的白色水花
    const foamM = new THREE.ShaderMaterial({ uniforms:{ uT: fishTime }, transparent:true, depthWrite:false,
      vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:`uniform float uT; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float ring = smoothstep(0.08, 0.0, abs(fract(r * 2.2 - uT * 0.8) - 0.5) - 0.32); float n = sin(a * 9.0 + uT * 3.0) * 0.5 + 0.5;
        float alpha = (1.0 - smoothstep(0.55, 1.0, r)) * (0.35 + 0.45 * ring * n) * (1.0 - smoothstep(0.0, 0.15, r) * 0.0);
        gl_FragColor = vec4(vec3(1.0), alpha * 0.85);
        #include <colorspace_fragment>
      }` });
    const foam = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28), foamM); foam.rotation.x = -Math.PI / 2; foam.position.set(fx + fd[0] * 0.9, WATER_LEVEL + 0.04, fz + fd[1] * 0.9); foam.userData.keep = true; scene.add(foam);
    // 白天的小彩虹（瀑布前的水霧）
    const rb = new THREE.Group(), cols = ['#ff6b6b', '#ffb347', '#ffe66d', '#7bd389', '#6ec6ff', '#9b8cff'];
    cols.forEach((c, i) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(2.6 + i * 0.13, 0.065, 4, 36, Math.PI), new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:0.22, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); rb.add(arc); });
    rb.position.set(fx + fd[0] * 1.6, WATER_LEVEL + 0.1, fz + fd[1] * 1.6); rb.rotation.y = Math.atan2(lat[0], lat[1]) + Math.PI / 2; rb.userData.keep = true; scene.add(rb); rainbow = rb;
  }
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
      if (opts.sign){   // 招牌上的字（畫布貼圖；有貼圖的東西不會被合併，字才不會不見）
        const scv = document.createElement('canvas'); scv.width = 256; scv.height = 48; const sc = scv.getContext('2d');
        sc.fillStyle = '#fffaf0'; sc.fillRect(0, 0, 256, 48); sc.fillStyle = opts.signInk || '#5a3a24'; sc.font = 'bold 34px sans-serif'; sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.fillText(opts.sign, 128, 26);
        const stx = new THREE.CanvasTexture(scv); stx.colorSpace = THREE.SRGBColorSpace; stx.anisotropy = 4;
        const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.28), new THREE.MeshBasicMaterial({ map: stx })); sp.position.set(0, top - 0.25, fz + 0.145); g.add(sp);
        // 屋頂上再立一塊大招牌，遠遠就看得到
        const bcv = document.createElement('canvas'); bcv.width = 320; bcv.height = 96; const bc = bcv.getContext('2d');
        bc.fillStyle = opts.awning; bc.fillRect(0, 0, 320, 96); bc.fillStyle = '#fffaf0'; bc.fillRect(8, 8, 304, 80); bc.fillStyle = opts.awning; bc.font = 'bold 54px sans-serif'; bc.textAlign = 'center'; bc.textBaseline = 'middle'; bc.fillText((opts.signIcon || '') + opts.sign, 160, 52);
        const btx = new THREE.CanvasTexture(bcv); btx.colorSpace = THREE.SRGBColorSpace; btx.anisotropy = 4;
        const big = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.72), new THREE.MeshBasicMaterial({ map: btx, side: THREE.DoubleSide })); big.position.set(0, top + 1.75, fz - 0.6); g.add(big);
        for (const sx of [-0.9, 0.9]) g.add(box([0.07, 1.1, 0.07], dark, [sx, top + 1.1, fz - 0.62]));
      }
      g.add(box([0.5, 0.45, 0.5], '#b8865a', [W / 2 + 0.2, 0.22, fz + 0.4])); g.add(box([0.4, 0.35, 0.4], '#a8754a', [W / 2 + 0.25, 0.62, fz + 0.4]));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 12), mat('#9b6a42')); barrel.position.set(-W / 2 - 0.15, 0.3, fz + 0.5); barrel.castShadow = true; g.add(barrel);
      for (const yy of [0.12, 0.48]){ const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.02, 4, 16), mat('#4c4c4c', 0.5)); hoop.rotation.x = Math.PI / 2; hoop.position.set(-W / 2 - 0.15, yy, fz + 0.5); g.add(hoop); }
    }
    scene.add(g);
    addOBoxCol(x, z, width + 0.3, 2.8, rotY || 0);
    if (opts.awning){ const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0), lz = 2.05; addOBoxCol(x + s * lz, z + c * lz, width * 0.84, 0.6, rotY || 0); }   /* 商店前面的櫃台 */
    return g;
  }
  houseBuilder = house;   // 私人小島也用同一個木屋
  // 門都朝向廣場
  const faceTo = (x, z) => Math.atan2(PX - x, PZ - z);
  /* 阿綾服裝店（2026-11-04）：原本的粉紅色民宅改成服裝店；門口一個衣架，掛著阿綾最新設計的三件衣服 */
  house(-9, 15, '#d896c3', 3.1, faceTo(-9, 15));
  house(16, 14, '#7db7d7', 3.6, faceTo(16, 14));
  { const tg = house(SHOPLOT.ling.x, SHOPLOT.ling.z, '#d896c3', 3.4, SHOPLOT.ling.r, { awning: '#f5a5d8', sign: '阿綾服裝店', signIcon: '👗', signInk: '#8a3a6a' });
    const rk = new THREE.Group(); rk.position.set(2.45, 0, 1.5); tg.add(rk); const mt = '#7a7f86';
    for (const sx of [-0.85, 0.85]){ rk.add(box([0.06, 1.7, 0.06], mt, [sx, 0.85, 0])); rk.add(box([0.06, 0.06, 0.5], mt, [sx, 0.03, 0])); }
    rk.add(box([1.8, 0.05, 0.05], mt, [0, 1.68, 0]));
    Ling.rack = [-0.55, 0, 0.55].map((sx, i) => { const hg = box([0.03, 0.14, 0.03], mt, [sx, 1.6, 0]); rk.add(hg);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), mat(['#f5a5d8', '#5fb6e3', '#ffd36a'][i], 0.8)); sh.position.set(sx, 1.25, 0); rk.add(sh);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.05), sh.material); sl.position.set(sx, 1.42, 0); rk.add(sl); return { sh, sl }; });
    addOBoxCol(tg.position.x + Math.sin(tg.rotation.y) * 1.5 + Math.cos(tg.rotation.y) * 2.45, tg.position.z + Math.cos(tg.rotation.y) * 1.5 - Math.sin(tg.rotation.y) * 2.45, 1.9, 0.5, tg.rotation.y); }
  /* 阿木木工坊（2026-11-04）：原本的藍色民宅改成木工坊，門口左右兩邊各擺一件阿木最新做的家具 */
  /* 商店街：入口一塊大招牌、路兩邊的路燈 */
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const c = cv.getContext('2d'); c.fillStyle = '#8c5d3b'; c.fillRect(0, 0, 512, 112); c.fillStyle = '#fff4d6'; c.fillRect(8, 8, 496, 96); c.fillStyle = '#5a3a24'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏮 潮汐商店街', 256, 60);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const ag = new THREE.Group(); ag.position.set(2.6, groundHeight(2.6, 19.5), 19.5); ag.rotation.y = Math.PI; scene.add(ag);
    for (const sx of [-2.2, 2.2]){ ag.add(box([0.22, 3.2, 0.22], '#8c5d3b', [sx, 1.6, 0])); addCircleCol(2.6 - sx, 19.5, 0.2); }
    ag.add(box([4.9, 0.18, 0.3], '#6e4a2f', [0, 3.25, 0])); const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.74), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); sp.position.set(0, 2.75, 0); ag.add(sp); }
  { const mg = house(SHOPLOT.mu.x, SHOPLOT.mu.z, '#a0704a', 3.6, SHOPLOT.mu.r, { awning: '#8c5d3b', sign: '阿木木工坊', signIcon: '🪑', signInk: '#5a3a24' });
    Mu.show = [-2.55, 2.55].map(sx => { const slot = new THREE.Group(); slot.position.set(sx, 0, 1.4); mg.add(slot); slot.add(box([1.5, 0.08, 1.3], '#c9b38a', [0, 0.04, 0]));
      const c = Math.cos(mg.rotation.y), sn = Math.sin(mg.rotation.y); addOBoxCol(mg.position.x + c * sx + sn * 1.4, mg.position.z - sn * sx + c * 1.4, 1.5, 1.3, mg.rotation.y); return { slot, id: 0, m: null }; }); }
  /* 阿彩畫廊（2026-11-04）：商店街的另一間，門口一個畫架擺著今天畫的畫 */
  { const cg = house(SHOPLOT.cai.x, SHOPLOT.cai.z, '#f1e3c8', 3.4, SHOPLOT.cai.r, { awning: '#9b7bff', sign: '阿彩畫廊', signIcon: '🎨', signInk: '#4a3a8a' });
    Cai.show = new THREE.Group(); Cai.show.position.set(-2.5, 0, 1.7); Cai.show.rotation.y = -0.35; Cai.show.scale.setScalar(1.3); cg.add(Cai.show); Cai.show.add(paintMesh({ main:'#f1e3c8', accent:'#8c5d3b', pat:'mist', fish:null }));
    const c = Math.cos(cg.rotation.y), sn = Math.sin(cg.rotation.y); addOBoxCol(cg.position.x - c * 2.5 + sn * 1.7, cg.position.z + sn * 2.5 + c * 1.7, 1.1, 0.7, cg.rotation.y); }
  /* 釣客魚市（2026-11-05）：商店街最後一間，玩家之間買賣魚；門口一排冰桶 */
  { const mg = house(SHOPLOT.spare.x, SHOPLOT.spare.z, '#5fb6e3', 3.4, SHOPLOT.spare.r, { awning: '#2f89c7', sign: '釣客魚市', signIcon: '🐟', signInk: '#1d4a6a' });
    for (const sx of [-2.6, -1.7]){ const b = new THREE.Group(); b.position.set(sx, 0, 1.6); mg.add(b); b.add(box([0.75, 0.55, 0.5], '#e8f4f8', [0, 0.28, 0])); b.add(box([0.78, 0.06, 0.53], '#2f89c7', [0, 0.57, 0])); }
    const c = Math.cos(mg.rotation.y), sn = Math.sin(mg.rotation.y); addOBoxCol(mg.position.x - c * 2.15 + sn * 1.6, mg.position.z + sn * 2.15 + c * 1.6, 1.8, 0.6, mg.rotation.y); }
  house(-14, -9, '#ec8b68', 3.3, faceTo(-14, -9));
  house(22, 7, '#9fc7a8', 3.2, faceTo(22, 7));
  house(-9, -3, '#f6a96b', 3.6, faceTo(-9, -3), { awning: '#f17b6d', sign: '釣具店', signIcon: '🎣' });      // 釣具店
  /* 阿福海產店（2026-11-04）：碼頭邊的小海產店，櫃台上一個冰櫃，擺著今天高價收購的魚 */
  { const fg = house(20.5, -25.5, '#2f6fa0', 3.4, faceTo(20.5, -25.5), { awning: '#2f89c7', sign: '阿福海產店', signIcon: '🐟', signInk: '#1d4a6a' });
    const ice = new THREE.Group(); ice.position.set(0, 0.92, 1.25 + 0.8); fg.add(ice);
    ice.add(box([2.3, 0.1, 0.46], '#e8f4f8', [0, 0.05, 0])); { const gl = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.32, 0.5), new THREE.MeshStandardMaterial({ color:'#cfefff', transparent:true, opacity:0.28, roughness:0.1, depthWrite:false })); gl.position.y = 0.22; ice.add(gl); }
    for (let i = 0; i < 14; i++){ const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), mat('#f4fbff', 0.3)); c.position.set(-1.05 + (i % 7) * 0.35, 0.12, i < 7 ? -0.12 : 0.12); c.rotation.y = i * 0.7; ice.add(c); }
    Fu.ice = ice; }
  house(18, -1, '#5fb6e3', 3.8, faceTo(18, -1), { awning: '#2f89c7', sign: '海邊商店', signIcon: '🐟' });      // 海邊商店
  // ---- 潮汐食堂：小吃攤（櫃台、紅白遮雨棚、招牌、燒烤爐、紙燈籠、壽司盤、板凳）----
  {
    const [KX, KZ] = [12.5, 8.5], g = new THREE.Group(); g.position.set(KX, 0, KZ); g.rotation.y = faceTo(KX, KZ); scene.add(g);
    g.add(box([3.0, 0.95, 0.9], PALETTE.wood, [0, 0.48, 0.4]));                          // 櫃台
    g.add(box([3.2, 0.08, 1.05], '#c79a6b', [0, 0.99, 0.42]));                           // 檯面
    g.add(box([3.0, 1.6, 0.12], '#e9d6b0', [0, 0.8, -0.8]));                             // 後牆
    for (const sx of [-1.45, 1.45]) for (const sz of [-0.8, 0.85]) g.add(box([0.12, 2.4, 0.12], '#6e4a2f', [sx, 1.2, sz]));
    for (let i = 0; i < 6; i++){ const st = box([0.54, 0.06, 2.1], i % 2 ? '#ffffff' : PALETTE.coral, [-1.35 + i * 0.54, 2.48, 0.1]); st.rotation.x = 0.22; g.add(st); }
    // 招牌：用畫布寫字
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cx = cv.getContext('2d');
    cx.fillStyle = '#8c3b2e'; cx.fillRect(0, 0, 256, 64); cx.fillStyle = '#fff4d6'; cx.font = 'bold 40px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('潮汐食堂', 128, 34);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, 2.08, 1.0); g.add(sign);
    // 燒烤爐（炭火會發光）
    g.add(box([0.8, 0.5, 0.5], '#3b3b3b', [-0.85, 1.25, -0.45]));
    const coal = box([0.7, 0.04, 0.4], '#ff7a3a', [-0.85, 1.52, -0.45], mat('#ff7a3a', 0.6, { emissive:'#ff5a1a', emissiveIntensity:1.2 })); coal.castShadow = false; g.add(coal);
    for (let i = 0; i < 3; i++){ const sk = box([0.04, 0.04, 0.5], '#d9b98a', [-1.05 + i * 0.2, 1.56, -0.45]); g.add(sk); const fishBit = box([0.09, 0.06, 0.2], '#c98a5a', [-1.05 + i * 0.2, 1.6, -0.45]); g.add(fishBit); }
    // 壽司盤
    for (let i = 0; i < 3; i++){ const px = 0.15 + i * 0.45; const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.03, 14), mat('#ffffff', 0.4)); plate.position.set(px, 1.05, 0.6); g.add(plate);
      for (const dx of [-0.05, 0.05]){ g.add(box([0.07, 0.05, 0.12], '#fbf7ee', [px + dx, 1.09, 0.6])); g.add(box([0.075, 0.025, 0.13], i === 1 ? '#f2a37a' : '#e86a5a', [px + dx, 1.125, 0.6])); } }
    // 紙燈籠
    for (const sx of [-1.2, 1.2]){ const lan = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat('#e8473a', 0.6, { emissive:'#ff6a3a', emissiveIntensity:0.6 })); lan.scale.y = 1.25; lan.position.set(sx, 2.05, 1.05); g.add(lan); lanterns.push(lan); }
    // 板凳
    for (const sx of [-0.8, 0, 0.8]){ const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), mat(PALETTE.wood)); st.position.set(sx, 0.55, 1.35); st.castShadow = true; g.add(st); g.add(box([0.06, 0.52, 0.06], '#6e4a2f', [sx, 0.27, 1.35])); 
      // 客人（和玩家）坐這三張板凳，面向櫃台
      const wp = new THREE.Vector3(sx, 0, 1.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(new THREE.Vector3(KX, 0, KZ)), fd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
      const seat = { x: wp.x, z: wp.z, face: Math.atan2(fd.x, fd.z), y: terrainH(wp.x, wp.z) + 0.13, cafe: true }; CHAIRS.push(seat); cafeSeats.push(seat); }
    const c = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y); addOBoxCol(KX + sn * 0.1, KZ + c * 0.1, 3.3, 2.0, g.rotation.y);
    cookStall = { x: KX, z: KZ, rot: g.rotation.y, grill: new THREE.Vector3(-0.85, 1.6, -0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(new THREE.Vector3(KX, 0, KZ)) };
  }

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
  // 外觀：石台＋台階、木頭櫃座、海洋壁畫後牆、金屬框玻璃、斜屋頂（瓦片、屋脊、山牆圓窗）、招牌、魚形風向標、燈籠、長椅、盆栽
  aq.add(box([13, 0.4, 8], '#d9cfb8', [0, 0.2, 0]));                       // 石台
  aq.add(box([13.2, 0.08, 8.2], '#c4b89c', [0, 0.42, 0]));                 // 石台邊緣
  aq.add(box([4.2, 0.27, 0.4], '#cfc4aa', [0, 0.135, 4.2])); aq.add(box([4.2, 0.13, 0.4], '#cfc4aa', [0, 0.065, 4.55]));   // 台階
  aq.add(box([12.4, 0.5, 4.2], PALETTE.wood, [0, 0.65, -0.6]));           // 魚缸底座
  for (let i = 0; i < 6; i++) aq.add(box([1.7, 0.3, 0.05], '#7a4f33', [-5.1 + i * 2.04, 0.65, 1.52]));   // 底座的木板格
  aq.add(box([12.5, 0.08, 0.1], '#c9a227', [0, 0.92, 1.52]));             // 金色飾條
  aq.add(box([12.4, 4.2, 0.3], '#d8eef0', [0, 2.5, -2.9]));               // 後牆
  for (const [y, c, h] of [[1.1, '#a9dde4', 0.5], [1.55, '#8fd0db', 0.3], [3.6, '#f6fbfb', 0.25]]) aq.add(box([12.2, h, 0.05], c, [0, y, -2.73]));   // 壁畫：海浪層次
  for (const x of [-6, 6]) for (const z of [-2.9, 3.6]){ aq.add(box([0.38, 4.6, 0.38], PALETTE.wood, [x, 2.5, z])); aq.add(box([0.5, 0.25, 0.5], '#c4b89c', [x, 0.52, z])); }
  // 玻璃的金屬框
  const frameM = mat('#2f5f6b', 0.4, { metalness:0.5 });
  for (const x of [-5.52, 5.52]) for (const z of [-2.3, 1.1]) aq.add(box([0.1, 3.3, 0.1], null, [x, 2.45, z - 0.6 + 0.6], frameM));
  for (const y of [0.82, 4.1]) aq.add(box([11.15, 0.1, 0.1], null, [0, y, 1.1], frameM));
  // 斜屋頂（屋脊沿著寬度方向，兩側是山牆）
  { const W = 13.4, D = 7.3, cz = 0.35, top = 4.8, ang = 0.42, over = 0.45, rise = Math.tan(ang) * D / 2, run = D / 2 + over, L = run / Math.cos(ang), roofC = PALETTE.coral, roofD = '#' + new THREE.Color(roofC).multiplyScalar(0.8).getHexString();
    for (const sz of [-1, 1]){
      const slab = box([W, 0.16, L], roofC, [0, top + rise - Math.tan(ang) * run / 2 + 0.07, cz + sz * run / 2]); slab.rotation.x = sz * ang; aq.add(slab);
      for (const f of [0.25, 0.5, 0.75]){ const st = box([W + 0.04, 0.05, 0.14], roofD, [0, top + rise - Math.tan(ang) * run * f + 0.17, cz + sz * run * f]); st.rotation.x = sz * ang; aq.add(st); }
    }
    aq.add(box([W + 0.1, 0.18, 0.26], roofD, [0, top + rise + 0.15, cz]));
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath();
    const gable = new THREE.ExtrudeGeometry(tri, { depth:0.12, bevelEnabled:false }); gable.rotateY(Math.PI / 2); gable.translate(-0.06, top, cz);
    for (const sx of [-1, 1]){ const m = new THREE.Mesh(gable, mat('#f6e4bd')); m.position.x = sx * 6.1; m.castShadow = true; aq.add(m);
      const rw = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), mat('#9fdbe3', 0.25, { emissive:'#ffe3a0', emissiveIntensity:0.2 })); rw.position.set(sx * 6.18, top + rise * 0.4, cz); rw.rotation.y = sx * Math.PI / 2; aq.add(rw);
      const rr = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 6, 20), mat('#fffaf0')); rr.position.copy(rw.position); rr.rotation.y = sx * Math.PI / 2; aq.add(rr); }
    // 屋脊上的魚形風向標
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat('#4c4c4c', 0.5)); pole.position.set(0, top + rise + 0.6, cz); aq.add(pole);
    const vane = fishModel(FISH_BY_ID.koi, 0.55); vane.position.set(0, top + rise + 1.05, cz); vane.userData.keep = true; aq.add(vane); aquaVane = vane;
  }
  // 招牌（畫布寫字）
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const c2 = cv.getContext('2d');
    c2.fillStyle = '#1f6f8b'; c2.fillRect(0, 0, 512, 112); c2.strokeStyle = '#ffd36a'; c2.lineWidth = 6; c2.strokeRect(6, 6, 500, 100);
    c2.fillStyle = '#ffd36a'; c2.beginPath(); c2.ellipse(78, 56, 30, 16, 0, 0, Math.PI * 2); c2.fill(); c2.beginPath(); c2.moveTo(46, 56); c2.lineTo(26, 40); c2.lineTo(26, 72); c2.fill();
    c2.fillStyle = '#ffffff'; c2.font = 'bold 54px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('潮汐水族館', 290, 60);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.84), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, 4.35, 3.8); aq.add(sign); }
  // 燈籠、長椅、盆栽
  for (const x of [-6, 6]){ const lan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#fff3c4', 0.5, { emissive:'#ffd36a', emissiveIntensity:1 })); lan.scale.y = 1.2; lan.position.set(AX + x * 0.93, 3.6, AZ + 3.85); scene.add(lan); lanterns.push(lan); }
  for (const x of [-3.4, 3.4]){ aq.add(box([1.8, 0.1, 0.5], PALETTE.wood, [x, 0.85, 3.0])); aq.add(box([1.8, 0.45, 0.08], PALETTE.wood, [x, 1.1, 3.27])); for (const dx of [-0.75, 0.75]) aq.add(box([0.1, 0.42, 0.42], '#6e4a2f', [x + dx, 0.62, 3.0])); addBoxCol(AX + x, AZ + 3.1, 1.8, 0.55); }
  for (const x of [-5.4, 5.4]){ const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 10), mat('#c9744f')); pot.position.set(x, 0.65, 3.0); pot.castShadow = true; aq.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat('#6fae5c', 0.9)); bush.position.set(x, 1.15, 3.0); bush.scale.y = 1.1; bush.castShadow = true; aq.add(bush); }
  // 魚缸本體（之後的魚會放在 tankGroup 裡）
  const tank = new THREE.Group(); tank.position.set(AX, 2.45, AZ - 0.6); scene.add(tank);
  tank.add(box([10.6, 0.25, 3.0], '#e8d9a8', [0, -1.4, 0]));               // 沙
  for (let i = 0; i < 9; i++){ const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + wr() * 0.25, 0), mat(['#9d998d', '#b7b2a4', '#c9a8a0'][i % 3], 0.9, { flatShading:true })); rk.position.set(wrand(-4.8, 4.8), -1.2, wrand(-1.2, 1.0)); TANK_ROCKS.push([rk.position.x, rk.position.z, rk.geometry.parameters.radius]); rk.rotation.set(wr() * 3, wr() * 3, 0); tank.add(rk); }
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
    { const hd = Math.hypot(x - MAP.hill.x, z - MAP.hill.z); if (hd < 7 || (hd < MAP.hill.R + 2 && pathDist(x, z) < 3.4)) continue; }
    if (Math.hypot((x - 40) / 1, (z + 6) / 1.5) < 11) continue;   /* 南方沙灘不長樹 */
    if (Math.abs(x - POND.x) < 11 && Math.abs(z - POND.z) < 8) continue;   /* 生態池旁邊自己種樹 */
    if (x > -13 && x < 15 && z > 18 && z < 42) continue;   /* 潮汐商店街 */
    if (Math.abs(x - REEF.x) < 4.5 && z > REEF.bz0 - 6) continue;   /* 往珊瑚礁群島的橋頭 */   /* 城市水圳那一區是工廠和水泥路，不長樹 */   /* 山頂留一塊空地、上山的路寬一點，走得過去 */
    trees.push([x, z, wr()]); addCircleCol(x, z, 0.38);
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
    if (sp.late || sp.hidden) continue;   /* 紅樹林的釣點在 buildMangrove 裡做 */
    const deckY = groundHeight(sp.pos.x, sp.pos.z);
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 36), new THREE.MeshStandardMaterial({ color:sp.color, emissive:sp.color, emissiveIntensity:1.8, transparent:true, opacity:0.86 }));
    r.rotation.x = -Math.PI/2; r.position.set(sp.pos.x, deckY + 0.06, sp.pos.z); scene.add(r); sp.ring = r;
    const side = [sp.dir.y, -sp.dir.x];
    let mx = sp.pos.x - sp.dir.x*1.4 + side[0]*1.5, mz = sp.pos.z - sp.dir.y*1.4 + side[1]*1.5;
    if (!walkable(mx, mz)){ mx = sp.pos.x - sp.dir.x*1.4 - side[0]*1.5; mz = sp.pos.z - sp.dir.y*1.4 - side[1]*1.5; }
    if (sp.id !== 'shrimp'){ const m = labelMarker(sp.color); m.position.set(mx, groundHeight(mx, mz), mz); scene.add(m); }   /* 釣蝦場裡面不要立一根標示柱（擋在走道中間） */
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
      if (skip.has(o) || (o.userData && o.userData.keep)) return;   // 會動的東西（風向標、彩虹、瀑布）不合併
      if (o.material && o.material.map) return;   // 有貼圖的（招牌）不合併：合併會丟掉 uv，招牌的字會不見
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
function isleH(x, z){ const d = Math.hypot(x - ISLE.x, z - ISLE.z); if (d > ISLE.r + 2.2) return null; return d <= ISLE.r ? ISLE.y : ISLE.y - (d - ISLE.r) / 2.2 * 0.3; }
function frostH(x, z){ const d = Math.hypot(x - FROST.x, z - FROST.z); if (d > FROST.r + 2.2) return null; if (Math.hypot(x - FROST.lake.x, z - FROST.lake.z) < FROST.lake.r) return FROST.lake.y; return d <= FROST.r ? FROST.y : FROST.y - (d - FROST.r) / 2.2 * 0.3; }
function groundHeight(x, z){ const d = deckAt(x, z); if (d) return d.y; const ih = isleH(x, z); if (ih !== null) return Math.max(0, ih); { const fh = frostH(x, z); if (fh !== null) return Math.max(0, fh); } { const mh = mystH(x, z); if (mh !== null) return Math.max(0, mh); } if (MANG && Math.abs(x - MANG.x) < 20 && Math.abs(z - MANG.z) < 20){ const mh = mangH(x, z); if (mh !== null) return mh; } if (nearReef(x, z)){ const rh = reefH(x, z); if (rh !== null) return rh; } return Math.max(0, terrainH(x, z)); }
function walkable(x, z){ if (deckAt(x, z)) return true; if (Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r + 1.6) return true; if (Math.hypot(x - FROST.x, z - FROST.z) < FROST.r + 1.6) return !frostHole(x, z, 0.4); if (Math.hypot(x - MYST.x, z - MYST.z) < MYST.r + 1.2) return true; if (MANG && Math.abs(x - MANG.x) < 20 && Math.abs(z - MANG.z) < 20 && mangWalk(x, z)) return true; if (nearReef(x, z) && reefE(x, z) > -0.45) return true; return Math.abs(x) < MAP_HALF && Math.abs(z) < MAP_HALF && isLand(x, z); }
function blocked(x, z, r){
  for (const c of colliders){
    if (c.t === 'b'){ if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true; }
    else if (c.t === 'o'){ const dx = x - c.x, dz = z - c.z; if (Math.abs(dx * c.c - dz * c.s) < c.hw + r && Math.abs(dx * c.s + dz * c.c) < c.hd + r) return true; }
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
function addSeaLife(id, scale, cx, cz, r, speed, mode, ph){ const m = fishModel(FISH_BY_ID[id], scale); scene.add(m); const s = { id, m, cx, cz, r, speed, mode, ph: ph || 0, prevUp: false }; seaLife.push(s); seaGlbSwap(s); }
/* 海豚、鬼蝠魟、鯨魚用 Quaternius「Animated Fish Pack」（CC0，跟遊戲原本魚的風格同一套）的骨架模型，有真正的游泳動作；載入失敗就繼續用原本的模型。網址加 #seaglb=0 可以關掉 */
const SEA_GLB = { dolphin:{ file:'Dolphin', col:null }, manta:{ file:'Manta_ray', col:{ Top:'#2a2e34', Bottom:'#e8eaec' } }, whale:{ file:'Whale', col:{ Top:'#2e3440', Bottom:'#d8dce0' } } }, SEA_GLB_CACHE = {};
function seaGlbSwap(s){ const G = SEA_GLB[s.id]; if (!G || /seaglb=0/.test(location.hash)) return;
  (SEA_GLB_CACHE[G.file] = SEA_GLB_CACHE[G.file] || new GLTFLoader().loadAsync('models/sealife/' + G.file + '.glb')).then(gl => {
    const inner = SkeletonUtils.clone(gl.scene), wrap = new THREE.Group(); inner.rotation.y = Math.PI / 2; wrap.add(inner);
    inner.traverse(o => { if (o.isMesh){ o.frustumCulled = false; o.castShadow = false; if (G.col && G.col[o.material.name]){ o.material = o.material.clone(); o.material.color.set(G.col[o.material.name]); } } });
    // 跟原本模型一樣長
    // 骨架模型的實際大小要用「套上骨頭以後」的頂點算（模型本身的網格很大、骨架把它縮小）
    wrap.updateMatrixWorld(true); const L1 = new THREE.Box3(); wrap.traverse(o => { if (o.isSkinnedMesh){ o.skeleton.update(); o.computeBoundingBox(); L1.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } else if (o.isMesh){ L1.expandByObject(o); } });
    const L0 = new THREE.Box3().setFromObject(s.m), a = L0.getSize(new THREE.Vector3()), b = L1.getSize(new THREE.Vector3()); wrap.scale.setScalar(Math.max(a.x, a.z) / Math.max(0.001, Math.max(b.x, b.z)));
    const mixer = new THREE.AnimationMixer(inner); if (gl.animations[0]){ const ac = mixer.clipAction(gl.animations[0]); ac.play(); ac.time = Math.random() * ac.getClip().duration; }
    wrap.position.copy(s.m.position); wrap.rotation.copy(s.m.rotation); wrap.visible = s.m.visible; scene.remove(s.m); scene.add(wrap); s.m = wrap; s.mixer = mixer;
  }).catch(e => { console.warn('sea glb', e); }); }
function updateSeaLife(t){
  for (const s of seaLife){
    // 偶爾才出現一次：每隔 1～2.5 分鐘出來一下（跳兩三下、滑過去、噴一口氣），其他時間躲在水裡
    if (s.showAt == null){ s.showAt = t + 15 + Math.random() * 60; s.dur = s.mode === 'jump' ? 9 : s.mode === 'whale' ? 18 : 14; }
    if (t > s.showAt + s.dur){ s.showAt = t + 60 + Math.random() * 90; }
    const showing = t >= s.showAt && t <= s.showAt + s.dur;
    if (!showing){ s.m.visible = false; continue; }
    if (s.mode !== 'whale'){ const near = Math.hypot(me.pos.x - s.cx, me.pos.z - s.cz) < 60; s.m.visible = near; if (!near) continue; } else s.m.visible = true;
    if (s.mixer) s.mixer.update(Math.min(0.1, t - (s.lastT || t)) * (s.mode === 'whale' ? 0.6 : 1)); s.lastT = t;
    const a = t * s.speed + s.ph, x = s.cx + Math.cos(a) * s.r, z = s.cz + Math.sin(a) * s.r;
    const vx = -Math.sin(a), vz = Math.cos(a); s.m.position.x = x; s.m.position.z = z; s.m.rotation.y = Math.atan2(-vz, vx);
    if (s.mode === 'jump'){
      const k = Math.sin(t * 1.1 + s.ph * 3), up = k > 0.55; const h = up ? (k - 0.55) / 0.45 : 0;
      s.m.position.y = -0.35 + Math.sin(h * Math.PI / 2) * 1.5; s.m.rotation.z = up ? Math.cos(t * 1.1 + s.ph * 3) * 1.2 : 0;
      if (up !== s.prevUp){ ripple(x, z, true); s.prevUp = up; }
    } else if (s.mode === 'glide'){ s.m.position.y = CLASSIC ? -0.02 : -0.12; s.m.rotation.z = Math.sin(t * 0.7) * 0.08; }
    else if (s.mode === 'whale'){ s.m.position.y = -1.3 + Math.sin(Math.min(1, (t - s.showAt) / s.dur) * Math.PI) * 1.1; }
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
  G.eye = new THREE.SphereGeometry(0.056, 14, 10);
  G.pupil = new THREE.SphereGeometry(0.03, 10, 8);
  G.lash = new THREE.TorusGeometry(0.056, 0.008, 4, 14, Math.PI);
  G.brow = new THREE.CapsuleGeometry(0.012, 0.06, 3, 6);
  G.shine = new THREE.SphereGeometry(0.015, 6, 4);
  G.blush = new THREE.CircleGeometry(0.055, 14);
  G.smile = new THREE.TorusGeometry(0.045, 0.011, 5, 12, Math.PI);
  G.torso = new THREE.CapsuleGeometry(0.25, 0.22, 6, 16);
  G.belt = new THREE.CylinderGeometry(0.262, 0.262, 0.07, 18);
  G.leg = new THREE.CapsuleGeometry(0.09, 0.2, 4, 10);
  G.thigh = new THREE.CapsuleGeometry(0.09, 0.12, 4, 10);
  G.shin = new THREE.CapsuleGeometry(0.086, 0.07, 4, 10);
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
  const BODY = [];   /* 換成正式 3D 模型（tide_kid.glb）時要拿掉的程式身體 */
  // 腳：圓圓的褲管＋鞋子
  /* 腿（2026-11-04 動畫改版）：髖關節（腿）→ 膝蓋（shin，離髖 0.22）→ 腳踝（foot，離髖 0.40）；外觀跟原本一樣，只是多了兩個可以彎的地方 */
  function leg(x){ const p = new THREE.Group(); p.position.set(x, 0.5, 0); g.add(p); p.userData.pants = add(G.thigh, pants, 0, -0.1, 0, p);
    const shin = new THREE.Group(); shin.position.y = -0.22; p.add(shin); p.userData.shin = shin; p.userData.pants2 = add(G.shin, pants, 0, -0.08, 0, shin);
    const foot = new THREE.Group(); foot.position.y = -0.18; shin.add(foot); p.userData.foot = foot;
    const sh = add(G.shoe, shoeM, 0, -0.03, 0.04, foot); sh.scale.set(0.95, 0.6, 1.3); p.userData.shoe = sh; BODY.push(p.userData.pants, p.userData.pants2, sh); return p; }
  const legL = leg(-0.12), legR = leg(0.12);
  // 身體
  const body = add(G.torso, shirtM, 0, 0.8, 0); body.scale.set(1, 1, 0.86); BODY.push(body);
  const belt = add(G.belt, pants, 0, 0.56, 0); belt.scale.set(1, 1, 0.86); BODY.push(belt);
  // 頭：大大的頭、頭髮、耳朵、眼睛（會眨眼）、腮紅、微笑
  const headG = new THREE.Group(); headG.position.y = 1.31; g.add(headG);
  const head = add(G.head, skin, 0, 0, 0, headG); head.scale.set(1, 0.94, 0.96); BODY.push(head);
  const hair = add(G.hair, hairM, 0, 0.01, -0.02, headG); hair.rotation.x = -0.42;
  for (const sx of [-1, 1]) BODY.push(add(G.ear, skin, sx * 0.315, -0.02, -0.01, headG));
  /* 眼睛（2026-11-04 角色改版）：大大的彩色眼珠＋黑色瞳孔＋兩顆反光＋上眼線，眨眼時整組一起壓扁；眉毛跟頭髮同色 */
  const eyes = [], shines = [], eyeM = mat('#3a2a20', 0.35), brows = [];
  for (const sx of [-1, 1]){
    const e = new THREE.Group(); e.position.set(sx * 0.115, 0.0, 0.285); e.scale.set(0.82, 1.15, 0.5); headG.add(e); eyes.push(e);
    add(G.eye, eyeM, 0, 0, 0, e, false); add(G.pupil, ink, 0, -0.008, 0.035, e, false);
    shines.push(add(G.shine, white, sx * 0.016 + 0.006, 0.022, 0.058, e, false)); { const s2 = add(G.shine, white, -sx * 0.012, -0.026, 0.056, e, false); s2.scale.setScalar(0.6); }
    const ls = add(G.lash, ink, 0, 0.004, 0.02, e, false); ls.scale.set(1.12, 1.05, 1);
    const br = add(G.brow, hairM, sx * 0.118, 0.098, 0.296, headG, false); br.rotation.z = Math.PI / 2 + sx * 0.12; brows.push(br);
    const bl = add(G.blush, blushM, sx * 0.19, -0.085, 0.262, headG, false); bl.rotation.y = sx * 0.62;
  }
  const smile = add(G.smile, ink, 0, -0.1, 0.305, headG, false); smile.rotation.z = Math.PI; smile.scale.set(1, 0.8, 1);
  // 漁夫帽
  const hatG = new THREE.Group(); hatG.position.set(0, 1.56, -0.02); hatG.rotation.x = -0.12; g.add(hatG);
  const hatBase = [add(G.brim, hatM, 0, 0, 0, hatG)];
  const crown = add(G.crown, hatM, 0, 0.0, 0, hatG); crown.scale.set(1, 0.72, 1); hatBase.push(crown);
  hatBase.push(add(G.band, ink, 0, 0.035, 0, hatG, false));
  // 手：袖子＋圓圓的手
  function arm(x){ const p = new THREE.Group(); p.position.set(x, 1.0, 0); g.add(p); BODY.push(add(G.arm, shirtM, 0, -0.18, 0, p), add(G.hand, skin, 0, -0.4, 0, p)); p.rotation.z = Math.sign(x) * 0.08; return p; }
  const armL = arm(-0.33), armR = arm(0.33);
  // 釣竿（跟原本一樣掛在右手前方）
  const rod = new THREE.Group(); rod.position.set(0.36, 0.74, 0.37);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 2.3, 6), mat('#3b2a1e', 0.5)); pole.position.y = 1.15;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), mat(PALETTE.coral)); grip.position.y = 0.05;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), mat('#c9d6e3', 0.3, { metalness:0.6 })); reel.rotation.z = Math.PI/2; reel.position.set(0.06, 0.25, 0);
  const tip = new THREE.Object3D(); tip.position.y = 2.3;
  rod.add(pole, grip, reel, tip); rod.rotation.x = 0.95; rod.visible = false; g.add(rod);
  return { g, legL, legR, armL, armR, rod, tip, pole, reel, shirtM, hatM, eyes, shines, headG, hatG, hatBase, pantsM: pants, shoeM, skinM: skin, inkM: ink, body, hairM, eyeM, hair, BODY, white, blushM, gearMeshes: [], gearAnim: null, blinkAt: Math.random() * 4 };
}
/* ================= WARDROBE：服裝（帽子、衣服、褲子、鞋子、襪子、配件、背飾、表情）================= */
// 價格要跟 supabase/008_wardrobe.sql 的 _item_price 一樣；價格 0 的是預設，大家都有
/* ---- 外觀（2026-11-04）：髮型、髮色、膚色、眼睛顏色，全部免費，存在 gear.look，例如 'h3c2s1e0' ---- */
const LOOK_HAIR = ['短髮', '齊瀏海', '刺刺頭', '鮑伯頭', '長髮', '馬尾', '雙馬尾', '丸子頭', '捲髮', '飛機頭'];
const LOOK_HC = ['#2a2422', '#5a3d2b', '#8a5a3a', '#d8a850', '#f0d890', '#c0482a', '#f2a0c0', '#4a7ad0', '#4aa070', '#8a6ad0', '#ecebe6'];
const LOOK_SKIN = ['#ffe6d2', '#ffd9b8', '#f2c49a', '#d9a070', '#a8704a', '#74492f'];
const LOOK_EYE = ['#3a2a20', '#7a4a28', '#2f6fb5', '#3a8a5a', '#8a5ac0', '#c0402a', '#3aa0b0'];
const LOOK_DEFAULT = 'h0c1s1e0';
function lookParse(v){ const m = /^h(\d{1,2})c(\d{1,2})s(\d)e(\d)$/.exec(v || ''); const r = m ? { h:+m[1], c:+m[2], s:+m[3], e:+m[4] } : { h:0, c:1, s:1, e:0 }; r.h = r.h < LOOK_HAIR.length ? r.h : 0; r.c = r.c < LOOK_HC.length ? r.c : 1; r.s = r.s < LOOK_SKIN.length ? r.s : 1; r.e = r.e < LOOK_EYE.length ? r.e : 0; return r; }
function lookStr(L){ return `h${L.h}c${L.c}s${L.s}e${L.e}`; }
function applyLook(av, gear, mk){
  const L = lookParse(gear.look), HD = av.headG, hm = av.hairM, hatOn = gear.hat !== 'hat_none';
  av.skinM.color.set(LOOK_SKIN[L.s]); hm.color.set(LOOK_HC[L.c]); if (av.eyeM) av.eyeM.color.set(LOOK_EYE[L.e]);
  const sph = (r, x, y, z, sx, sy, sz) => { const o = mk(new THREE.SphereGeometry(r, 14, 10), hm, x, y, z, HD); o.scale.set(sx || 1, sy || 1, sz || 1); return o; };
  const shell = (rt, rb, h, y, gap) => { const o = mk(new THREE.CylinderGeometry(rt, rb, h, 22, 1, true, gap, Math.PI * 2 - gap * 2), hm, 0, y, -0.01, HD); o.material = hm.clone(); o.material.side = THREE.DoubleSide; return o; };
  switch (L.h){
    case 1: { const f = mk(new THREE.SphereGeometry(0.352, 20, 6, -1.05, 2.1, Math.PI * 0.28, Math.PI * 0.145), hm, 0, 0.0, 0, HD); f.material = hm.clone(); f.material.side = THREE.DoubleSide; break; }   /* 齊瀏海 */
    case 2: if (!hatOn) for (let i = 0; i < 7; i++){ const a = i / 7 * Math.PI * 2, c = mk(new THREE.ConeGeometry(0.075, 0.2, 6), hm, Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17 - 0.03, HD); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } if (!hatOn) mk(new THREE.ConeGeometry(0.08, 0.22, 6), hm, 0, 0.37, -0.02, HD); break;
    case 3: shell(0.352, 0.37, 0.3, -0.06, 0.95); break;   /* 鮑伯頭：到下巴 */
    case 4: shell(0.352, 0.34, 0.62, -0.2, 1.05); { const b = sph(0.2, 0, -0.38, -0.2, 1.4, 0.9, 0.6); } break;   /* 長髮：到肩膀 */
    case 5: { const bd = mk(new THREE.TorusGeometry(0.05, 0.02, 6, 12), av.inkM, 0, 0.12, -0.34, HD); bd.rotation.x = 0.4; const t = mk(new THREE.CapsuleGeometry(0.075, 0.28, 4, 10), hm, 0, -0.08, -0.42, HD); t.rotation.x = -0.35; sph(0.08, 0, 0.12, -0.35); break; }   /* 馬尾 */
    case 6: for (const sx of [-1, 1]){ sph(0.07, sx * 0.3, 0.12, -0.06); const t = mk(new THREE.CapsuleGeometry(0.065, 0.26, 4, 10), hm, sx * 0.39, -0.08, -0.08, HD); t.rotation.z = sx * 0.25; } break;   /* 雙馬尾 */
    case 7: if (!hatOn) sph(0.13, 0, 0.36, -0.08); else sph(0.11, 0, 0.12, -0.36); break;   /* 丸子頭（戴帽子時改成在後腦勺） */
    case 8: for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2, y = 0.05 + (i % 2) * 0.12; sph(0.085, Math.cos(a) * 0.31, y, Math.sin(a) * 0.31 - 0.02); } break;   /* 捲髮 */
    case 9: if (!hatOn) sph(0.16, 0, 0.27, 0.12, 1.3, 0.75, 1.4); break;   /* 飛機頭 */
  }
}
const GEAR_SLOTS = [['look','外觀'],['hat','帽子'],['top','衣服'],['pants','褲子'],['shoes','鞋子'],['socks','襪子'],['acc','配件'],['back','背飾'],['face','表情']];
const GEAR = [
  ['hat_sun','草帽',0,'👒'],['hat_wizard','巫師帽',1200,'🧙'],['hat_knight','騎士頭盔',1800,'🛡️'],['hat_bear','熊熊帽',1000,'🐻'],['hat_none','不戴帽子',0,'🙂'],['hat_cap','棒球帽',250,'🧢'],['hat_beanie','毛線帽',300,'🧶'],['hat_bucket','漁夫帽',350,'🎣'],['hat_cat','貓耳朵',600,'🐱'],['hat_chef','廚師帽',800,'👨‍🍳'],['hat_flower','花環',500,'🌼'],['hat_pirate','海盜帽',1500,'🏴‍☠️'],['hat_crown','皇冠',5000,'👑'],
  ['top_tee','素 T',0,'👕'],['top_stripe','水手條紋衫',300,'⚓'],['top_apron','食堂圍裙',400,'🍳'],['top_vest','救生衣',500,'🦺'],['top_hoodie','連帽外套',700,'🧥'],['top_hawaii','夏威夷衫',800,'🌺'],['top_suit','帥氣西裝',2500,'🤵'],
  ['pants_jeans','牛仔褲',0,'👖'],['pants_shorts','短褲',200,'🩳'],['pants_khaki','卡其褲',250,'🟫'],['pants_skirt','格紋裙',500,'👗'],['pants_overalls','吊帶褲',600,'🧑‍🌾'],['pants_rainbow','彩虹褲',1500,'🌈'],
  ['shoes_boots','皮靴',0,'👞'],['shoes_sandals','夾腳拖',150,'🩴'],['shoes_sneakers','白球鞋',250,'👟'],['shoes_rain','黃雨靴',350,'🥾'],['shoes_gold','黃金鞋',2500,'✨'],
  ['socks_none','不穿襪子',0,'🦶'],['socks_white','白襪',80,'🧦'],['socks_stripe','條紋襪',200,'🍭'],['socks_rainbow','彩虹襪',500,'🌈'],
  ['acc_none','沒有配件',0,'🙂'],['acc_scarf','紅圍巾',300,'🧣'],['acc_scarf_black','黑圍巾',320,'⚫'],['acc_scarf_white','白圍巾',320,'⚪'],['acc_scarf_navy','深藍圍巾',350,'🔵'],['acc_scarf_pink','粉紅圍巾',350,'🩷'],['acc_scarf_yellow','芥末黃圍巾',350,'🟡'],['acc_scarf_green','森林綠圍巾',350,'🟢'],['acc_scarf_grey','灰色毛圍巾',380,'🩶'],['acc_scarf_brown','焦糖圍巾',380,'🟤'],['acc_scarf_plaid','紅黑格紋圍巾',500,'🟥'],['acc_scarf_stripe','藍白條紋圍巾',500,'🔷'],['acc_scarf_rainbow','彩虹圍巾',900,'🌈'],['acc_bowtie','領結',350,'🎀'],['acc_glasses','圓框眼鏡',450,'👓'],['acc_shell','貝殼項鍊',600,'🐚'],['acc_lei','花圈項鍊',700,'🌸'],
  ['back_none','沒有背飾',0,'🙂'],['back_kcape_m','紫紅短披風',900,'🟣'],['back_kcape_r','紅色短披風',900,'🔴'],['back_kcape_b','咖啡色短披風',800,'🟤'],['back_kcape_g','綠色短披風',900,'🟢'],['back_bag','小背包',400,'🎒'],['back_basket','魚簍',500,'🧺'],['back_balloon','魚魚氣球',800,'🎈'],['back_cape','英雄披風',1500,'🦸'],['back_wings','天使翅膀',3000,'🪽'],
  ['face_normal','普通',0,'🙂'],['face_happy','笑咪咪',200,'😊'],['face_sleepy','想睡覺',200,'😪'],['face_wink','眨眼',300,'😉'],['face_cool','墨鏡',600,'😎'],['face_heart','愛心眼',700,'😍'],['face_star','星星眼',900,'🤩'],
  // 愛海商店：只能用放流得到的愛海點數換（第 5 欄是點數）
  ['hat_turtle','海龜帽',0,'🐢',30],['top_ocean','海洋守護衫',0,'🌊',40],['acc_coral','珊瑚項鍊',0,'🪸',20],['back_fin','鯊魚背鰭',0,'🦈',60],
].map(([id, name, price, icon, love]) => ({ id, slot: id.split('_')[0], name, price, icon, love: love || 0 }));
function paidGear(it){ return !!it && (it.price > 0 || it.love > 0); }
const GEAR_BY_ID = Object.fromEntries(GEAR.map(g => [g.id, g]));
const GEAR_DEFAULT = { look:LOOK_DEFAULT, hat:'hat_sun', top:'top_tee', pants:'pants_jeans', shoes:'shoes_boots', socks:'socks_none', acc:'acc_none', back:'back_none', face:'face_normal' };
function cleanGear(g){ const r = Object.assign({}, GEAR_DEFAULT); if (g && typeof g === 'object') for (const [k, v] of Object.entries(g)){ if (k === 'look'){ if (typeof v === 'string' && /^h\d{1,2}c\d{1,2}s\de\d$/.test(v)) r.look = lookStr(lookParse(v)); continue; } const it = GEAR_BY_ID[v]; if (it && it.slot === k) r[k] = v; else if (typeof v === 'string' && /^(top|pants|hat|shoes|back|acc)_dz\d+$/.test(v) && v.split('_')[0] === k) r[k] = v; } return r; }
const PANTS_COL = { pants_jeans:'#2f4b63', pants_shorts:'#3f6fa0', pants_khaki:'#c8a873', pants_skirt:'#b8443a', pants_overalls:'#4a78b0', pants_rainbow:'#f6f0e6' };
const SHOE_COL = { shoes_boots:'#6b4a35', shoes_sandals:'#3fbf9d', shoes_sneakers:'#f4f4f4', shoes_rain:'#f6c83b', shoes_gold:'#e8b730' };
const RAINBOW = ['#f05a4a', '#ff9f43', '#ffd36a', '#3fbf9d', '#2f89c7', '#9b7bff'];
function heartShape(s){ const sh = new THREE.Shape(); sh.moveTo(0, -s * 0.9); sh.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.9, s * 1.0, 0, s * 0.35); sh.bezierCurveTo(s * 0.9, s * 1.0, s * 1.4, -s * 0.1, 0, -s * 0.9); return sh; }
function starShape(s){ const sh = new THREE.Shape(); for (let i = 0; i < 10; i++){ const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } return sh; }
// ---- KayKit Adventurers（CC0）的帽子、頭盔、披風：models/kaykit_gear.glb，每一件記著是掛在頭骨還是胸骨 ----
// 3D 角色直接掛在對應的骨頭；舊的程式角色掛在頭／身體上。模型還沒載好就先等，載好再穿一次
const GEAR3D = { ok:false, map:null, wait:new Set(), fit:{ hat_wizard:{ y:0.17, w:0.86 }, hat_knight:{ y:0.03, w:0.84, full:true }, hat_bear:{ y:0.16, w:0.82, full:true, z:-0.03 }, back_kcape_m:{ y:0, s:0.95 }, back_kcape_r:{ y:0, s:0.95 }, back_kcape_b:{ y:0, s:0.95 }, back_kcape_g:{ y:0, s:0.95 } } };
new GLTFLoader().loadAsync('models/kaykit_gear.glb').then(g => { GEAR3D.map = {}; g.scene.traverse(o => { if (o.isMesh && GEAR3D.fit[o.name]){ o.castShadow = true; GEAR3D.map[o.name] = o; } }); GEAR3D.ok = true; for (const [av, gear] of [...GEAR3D.wait].map(x => [x, x.gear3dWant])) { try { applyGear(av, gear); } catch(e){} } GEAR3D.wait.clear(); }).catch(e => console.warn('gear3d', e));
function gear3dApply(av, gear){ const ids = [gear.hat, gear.back].filter(id => GEAR3D.fit[id]); if (av.hair) av.hair.visible = true; if (!ids.length) return;
  if (!GEAR3D.ok){ av.gear3dWant = gear; GEAR3D.wait.add(av); return; }
  for (const id of ids){ const src = GEAR3D.map[id], F = GEAR3D.fit[id]; if (!src) continue;
    if (id.startsWith('hat_')){
      // 帽子、頭盔掛在頭上（頭的中心在原點、半徑大約 0.33）：照模型的大小自動對齊，戴得剛剛好
      const m = new THREE.Mesh(src.geometry, src.material); m.quaternion.copy(src.quaternion); m.castShadow = true; const w = new THREE.Group(); w.add(m); w.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(w), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), k = F.w / Math.max(sz.x, sz.z);
      m.position.set(-c.x, F.full ? -c.y : -b.min.y, -c.z); w.scale.setScalar(k); w.position.set(0, F.y, F.z || 0); av.headG.add(w); av.gearMeshes.push(w);
      if (F.full){ if (av.hair) av.hair.visible = false; for (const o of av.gearMeshes) if (o.parent === av.headG && o !== w) o.visible = false; }   /* 頭盔、熊熊帽蓋住整顆頭：頭髮先藏起來 */
    } else {
      // 披風掛在胸骨（3D 角色）或身體上
      const m = src.clone(); m.castShadow = true; m.position.multiplyScalar(F.s); m.scale.multiplyScalar(F.s);
      if (av.kid){ av.kid.B.chest.add(m); av.gearMeshes.push(m); } else { const w = new THREE.Group(); w.add(m); w.position.set(0, 0.62, 0); (av.torsoG || av.g).add(w); av.gearMeshes.push(w); } } } }
function applyGear(av, gear){
  gear = cleanGear(gear);
  for (const m of av.gearMeshes){ if (m.parent) m.parent.remove(m); if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }
  av.gearMeshes = []; av.gearAnim = null;
  const G = avGeo(), M = (c, r, ex) => mat(c, r == null ? 0.7 : r, ex);
  const mk = (geo, m, x, y, z, parent) => { if (parent && parent.userData.foot && y < -0.395){ parent = parent.userData.foot; y += 0.40; } else if (parent && parent.userData.shin && y < -0.22){ parent = parent.userData.shin; y += 0.22; }   /* 膝蓋以下的東西跟著小腿、腳踝以下跟著腳 */
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; (parent || av.torsoG || av.g).add(o); av.gearMeshes.push(o); return o; };
  const hatC = av.hatM, ink = av.inkM, white = M('#ffffff', 0.6);
  if (av.hairM) applyLook(av, gear, mk);
  // ---- 帽子 ----
  for (const b of av.hatBase) b.visible = gear.hat === 'hat_sun';
  gear3dApply(av, gear);
  const H = av.hatG, HD = av.headG;
  switch (gear.hat){
    case 'hat_turtle': { const sh = M('#4f9a54', 0.6), dk = M('#2f6b3a', 0.65), sk = M('#9fd08a', 0.7);
      const d = mk(new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), sh, 0, -0.05, 0, H); d.scale.set(1, 0.78, 1.05);
      const rim = mk(new THREE.TorusGeometry(0.335, 0.035, 6, 24), dk, 0, -0.05, 0, H); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.05;
      const top = mk(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 6), dk, 0, 0.215, 0, H);
      for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2 + 0.52, el2 = 0.85; const x = Math.sin(el2) * 0.34 * Math.cos(a), z = Math.sin(el2) * 0.34 * Math.sin(a) * 1.05, y = -0.05 + Math.cos(el2) * 0.34 * 0.78;
        const pl = mk(new THREE.CylinderGeometry(0.085, 0.095, 0.03, 6), dk, x, y, z, H); pl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, (y + 0.05) / 0.78, z / 1.05).normalize()); }
      const hd = mk(new THREE.SphereGeometry(0.075, 10, 8), sk, 0, 0.0, 0.37, H); hd.scale.set(1, 0.8, 1.1);
      for (const sx of [-1, 1]) mk(new THREE.SphereGeometry(0.014, 6, 4), ink, sx * 0.035, 0.02, 0.44, H);
      break; }
    case 'hat_cap': { const c = mk(G.crown, hatC, 0, -0.02, 0, H); c.scale.set(1.02, 0.62, 1.02); const v = mk(new THREE.BoxGeometry(0.4, 0.03, 0.26), hatC, 0, -0.01, 0.33, H); v.rotation.x = 0.12; mk(new THREE.SphereGeometry(0.03, 8, 6), hatC, 0, 0.18, 0, H); break; }
    case 'hat_beanie': { const c = mk(new THREE.SphereGeometry(0.33, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatC, 0, -0.06, 0, H); c.scale.set(1, 0.95, 1); const rim = mk(new THREE.TorusGeometry(0.325, 0.045, 8, 22), white, 0, -0.04, 0, H); rim.rotation.x = Math.PI / 2; mk(new THREE.SphereGeometry(0.085, 10, 8), white, 0, 0.27, 0, H); break; }
    case 'hat_bucket': { mk(new THREE.CylinderGeometry(0.25, 0.31, 0.2, 18), hatC, 0, 0.09, 0, H); mk(new THREE.CylinderGeometry(0.31, 0.44, 0.06, 20), hatC, 0, -0.01, 0, H); mk(new THREE.CylinderGeometry(0.262, 0.262, 0.04, 18), ink, 0, 0.04, 0, H); break; }
    case 'hat_chef': { mk(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 18), white, 0, 0.04, 0, H); const t = mk(new THREE.SphereGeometry(0.34, 16, 12), white, 0, 0.32, 0, H); t.scale.set(1, 0.75, 1); for (const a of [0, 2.1, 4.2]) mk(new THREE.SphereGeometry(0.16, 10, 8), white, Math.cos(a) * 0.17, 0.42, Math.sin(a) * 0.17, H); break; }
    case 'hat_cat': { const pink = M('#ffb3c7', 0.6); for (const sx of [-1, 1]){ const e = mk(new THREE.ConeGeometry(0.11, 0.22, 4), hatC, sx * 0.19, 0.3, 0, HD); e.rotation.z = -sx * 0.35; const i2 = mk(new THREE.ConeGeometry(0.06, 0.14, 4), pink, sx * 0.185, 0.29, 0.04, HD); i2.rotation.z = -sx * 0.35; } break; }
    case 'hat_pirate': { const blk = M('#1d1d24', 0.7); const tr = mk(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 3), blk, 0, 0.0, 0, H); tr.rotation.y = Math.PI; const c = mk(new THREE.CylinderGeometry(0.22, 0.3, 0.24, 18), blk, 0, 0.12, 0, H); mk(new THREE.SphereGeometry(0.055, 10, 8), white, 0, 0.13, 0.27, H); mk(new THREE.BoxGeometry(0.12, 0.02, 0.02), white, 0, 0.07, 0.28, H); const gold = mk(new THREE.TorusGeometry(0.3, 0.012, 4, 3), M('#e8b730', 0.3, { metalness:0.6 }), 0, 0.03, 0, H); gold.rotation.x = Math.PI / 2; break; }
    case 'hat_flower': { const ring = mk(new THREE.TorusGeometry(0.3, 0.03, 6, 22), M('#5d9c55', 0.8), 0, -0.02, 0, H); ring.rotation.x = Math.PI / 2; const cs = ['#f17b6d', '#ffd36a', '#f5a5d8', '#ffffff', '#b9a4ff']; for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2; mk(new THREE.IcosahedronGeometry(0.06, 0), M(cs[i % 5], 0.6), Math.cos(a) * 0.3, 0.0, Math.sin(a) * 0.3, H); } break; }
    case 'hat_crown': { const gold = M('#f2c14e', 0.25, { metalness:0.7, emissive:'#7a5a10', emissiveIntensity:0.25 }); mk(new THREE.CylinderGeometry(0.22, 0.23, 0.12, 16, 1, true), gold, 0, 0.06, 0, H).material.side = THREE.DoubleSide; for (let i = 0; i < 5; i++){ const a = i / 5 * Math.PI * 2; mk(new THREE.ConeGeometry(0.05, 0.12, 4), gold, Math.sin(a) * 0.22, 0.17, Math.cos(a) * 0.22, H); mk(new THREE.SphereGeometry(0.025, 8, 6), M(['#e8473a', '#3fbf9d', '#2f89c7'][i % 3], 0.2), Math.sin(a) * 0.235, 0.06, Math.cos(a) * 0.235, H); } break; }
  }
  // ---- 衣服 ----
  const torsoR = y => { const dy = Math.abs(y - 0.8); return dy <= 0.11 ? 0.25 : Math.sqrt(Math.max(0, 0.0625 - (dy - 0.11) * (dy - 0.11))); };
  const band = (y, h, c) => { const o = mk(new THREE.CylinderGeometry(torsoR(y) + 0.012, torsoR(y) + 0.012, h, 18), c, 0, y, 0); o.scale.z = 0.88; return o; };
  const shell = (c, gap) => { const o = mk(new THREE.CylinderGeometry(0.272, 0.27, 0.44, 18, 1, true, gap, Math.PI * 2 - gap * 2), c, 0, 0.82, 0); o.material.side = THREE.DoubleSide; o.scale.z = 0.9; return o; };
  switch (gear.top){
    case 'top_ocean': { const sea = M('#2f89c7', 0.6), foam = M('#ffffff', 0.6); band(0.64, 0.1, sea); band(0.71, 0.03, foam);
      for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; const r = torsoR(0.735) + 0.012; mk(new THREE.SphereGeometry(0.03, 6, 4), foam, Math.sin(a) * r, 0.735, Math.cos(a) * r * 0.88); }
      const fb = mk(new THREE.SphereGeometry(0.06, 10, 8), M('#ff9f43', 0.5), -0.02, 0.9, 0.235); fb.scale.set(1.4, 0.8, 0.35);
      const ft = mk(new THREE.ConeGeometry(0.045, 0.07, 3), M('#ff9f43', 0.5), 0.085, 0.9, 0.232); ft.rotation.z = Math.PI / 2; ft.scale.z = 0.35;
      mk(new THREE.SphereGeometry(0.01, 6, 4), ink, -0.07, 0.91, 0.258); break; }
    case 'top_stripe': { for (const y of [0.64, 0.76, 0.88, 1.0]) band(y, 0.045, white); const nk = mk(new THREE.ConeGeometry(0.07, 0.14, 3), M('#e8473a', 0.6), 0, 1.02, 0.2); nk.rotation.x = Math.PI; break; }
    case 'top_vest': { const or = M('#ff7a2a', 0.6); shell(or, 0.32); band(0.72, 0.035, M('#e9eef2', 0.3, { metalness:0.3 })); band(0.92, 0.035, M('#e9eef2', 0.3, { metalness:0.3 })); for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.03, 0.05, 0.02), ink, sx * 0.05, 0.82, 0.245); break; }
    case 'top_hoodie': { const hd = mk(new THREE.SphereGeometry(0.21, 14, 10), av.shirtM, 0, 1.13, -0.17); hd.scale.set(1.25, 0.75, 0.85); mk(new THREE.BoxGeometry(0.24, 0.1, 0.03), av.shirtM, 0, 0.66, 0.225); for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.015, 0.16, 0.015), white, sx * 0.06, 0.98, 0.235); break; }
    case 'top_hawaii': { const cs = ['#ffd36a', '#ffffff', '#f5a5d8', '#3fbf9d']; for (let i = 0; i < 18; i++){ const a = (i * 2.399) % (Math.PI * 2), y = 0.6 + ((i * 0.37) % 1) * 0.42, r = torsoR(y) + 0.005; mk(new THREE.IcosahedronGeometry(0.035, 0), M(cs[i % 4], 0.6), Math.sin(a) * r, y, Math.cos(a) * r * 0.88); } for (const sx of [-1, 1]){ const c = mk(new THREE.BoxGeometry(0.1, 0.02, 0.08), av.shirtM, sx * 0.07, 1.08, 0.17); c.rotation.z = sx * 0.4; } break; }
    case 'top_apron': { mk(new THREE.BoxGeometry(0.34, 0.46, 0.02), white, 0, 0.72, 0.228); mk(new THREE.BoxGeometry(0.16, 0.08, 0.025), M('#f1e3c8', 0.7), 0, 0.68, 0.24); for (const sx of [-1, 1]){ const st = mk(new THREE.BoxGeometry(0.025, 0.2, 0.02), white, sx * 0.13, 1.02, 0.16); st.rotation.x = -0.5; } break; }
    case 'top_suit': { const nv = M('#243447', 0.55); shell(nv, 0.42); mk(new THREE.BoxGeometry(0.12, 0.3, 0.02), white, 0, 0.88, 0.235); mk(new THREE.BoxGeometry(0.04, 0.22, 0.025), M('#c9302c', 0.5), 0, 0.86, 0.247); for (const y of [0.7, 0.8]) mk(new THREE.SphereGeometry(0.014, 6, 4), M('#e8b730', 0.3), 0.07, y, 0.24); break; }
  }
  // ---- 褲子 ----
  av.pantsM.color.set(PANTS_COL[gear.pants] || PANTS_COL.pants_jeans);
  const shorts = gear.pants === 'pants_shorts' || gear.pants === 'pants_skirt';
  av.shortLegs = shorts; if (av.kid && av.kid.prim.shin) av.kid.prim.shin.material = shorts ? av.skinM : av.pantsM;   /* 3D 角色：短褲、裙子露出小腿 */
  for (const L of [av.legL, av.legR]){
    const pm = L.userData.pants; pm.scale.y = shorts ? 0.6 : 1; pm.position.y = shorts ? -0.06 : -0.1; if (L.userData.pants2) L.userData.pants2.visible = !shorts;
    if (shorts && !av.kid) mk(new THREE.CylinderGeometry(0.062, 0.058, 0.26, 10), av.skinM, 0, -0.29, 0, L);
    if (gear.pants === 'pants_rainbow') RAINBOW.forEach((c, i) => mk(new THREE.CylinderGeometry(0.094, 0.094, 0.05, 12), M(c, 0.7), 0, -0.06 - i * 0.055, 0, L));
  }
  if (gear.pants === 'pants_skirt'){ const sk = mk(new THREE.CylinderGeometry(0.26, 0.34, 0.24, 18), av.pantsM, 0, 0.47, 0); sk.scale.z = 0.9; for (const y of [0.41, 0.5]){ const b = mk(new THREE.CylinderGeometry(0.3 + (0.47 - y) * 0.3, 0.3 + (0.47 - y) * 0.3, 0.02, 18), M('#2a1a2e', 0.7), 0, y, 0); b.scale.z = 0.9; } }
  if (gear.pants === 'pants_overalls'){ mk(new THREE.BoxGeometry(0.3, 0.24, 0.03), av.pantsM, 0, 0.74, 0.225); for (const sx of [-1, 1]){ const st = mk(new THREE.BoxGeometry(0.04, 0.34, 0.03), av.pantsM, sx * 0.11, 0.95, 0.12); st.rotation.x = -0.55; mk(new THREE.SphereGeometry(0.022, 6, 4), M('#e8b730', 0.3), sx * 0.11, 0.84, 0.245); } }
  // ---- 鞋子 ----
  av.shoeM.color.set(SHOE_COL[gear.shoes] || SHOE_COL.shoes_boots); av.shoeM.metalness = gear.shoes === 'shoes_gold' ? 0.7 : 0.04; av.shoeM.roughness = gear.shoes === 'shoes_gold' ? 0.25 : 0.7;
  for (const L of [av.legL, av.legR]){
    const sh = L.userData.shoe; sh.scale.set(0.95, gear.shoes === 'shoes_sandals' ? 0.32 : 0.6, 1.3); sh.position.y = gear.shoes === 'shoes_sandals' ? -0.06 : -0.03;
    if (gear.shoes === 'shoes_rain') mk(new THREE.CylinderGeometry(0.1, 0.105, 0.2, 12), av.shoeM, 0, -0.33, 0.01, L);
    if (gear.shoes === 'shoes_sneakers'){ mk(new THREE.BoxGeometry(0.2, 0.03, 0.22), M('#e8473a', 0.6), 0, -0.45, 0.04, L); }
    if (gear.shoes === 'shoes_sandals'){ mk(new THREE.SphereGeometry(0.075, 10, 8), av.skinM, 0, -0.42, 0.06, L).scale.set(1, 0.6, 1.4); }
    // ---- 襪子 ----
    if (gear.socks !== 'socks_none' && gear.shoes !== 'shoes_rain'){
      const hgt = shorts ? 0.15 : 0.06, y0 = -0.36 + hgt / 2 - 0.01;
      const cs = gear.socks === 'socks_white' ? ['#ffffff'] : gear.socks === 'socks_stripe' ? ['#ffffff', '#e8473a'] : RAINBOW;
      const n = gear.socks === 'socks_white' ? 1 : shorts ? cs.length : Math.min(2, cs.length);
      for (let i = 0; i < n; i++) mk(new THREE.CylinderGeometry(0.068, 0.068, hgt / n, 12), M(cs[i % cs.length], 0.7), 0, y0 + hgt / 2 - (i + 0.5) * hgt / n, 0, L);
    }
  }
  // ---- 配件 ----
  switch (gear.acc){
    case 'acc_coral': { const bead = M('#ffd9c7', 0.4); for (let i = 0; i <= 10; i++){ const a = Math.PI * (0.1 + i / 10 * 0.8); mk(new THREE.SphereGeometry(0.017, 6, 4), bead, Math.cos(a) * 0.17, 1.07 - Math.sin(a) * 0.06, Math.sin(a) * 0.17); }
      const cr = M('#ff6f61', 0.5); const br = (x, y, len, rz) => { const c = mk(new THREE.CylinderGeometry(0.011, 0.016, len, 5), cr, x, y, 0.215); c.rotation.z = rz; mk(new THREE.SphereGeometry(0.016, 6, 4), cr, x - Math.sin(rz) * len / 2, y + Math.cos(rz) * len / 2, 0.215); };
      br(0, 0.97, 0.09, 0); br(-0.025, 0.985, 0.07, 0.6); br(0.025, 0.99, 0.065, -0.55); br(-0.04, 1.01, 0.04, 1.1); break; }
    case 'acc_scarf_black': case 'acc_scarf_white': case 'acc_scarf_navy': case 'acc_scarf_pink': case 'acc_scarf_yellow': case 'acc_scarf_green': case 'acc_scarf_grey': case 'acc_scarf_brown': case 'acc_scarf_plaid': case 'acc_scarf_stripe': case 'acc_scarf_rainbow': {
      // 各種顏色的圍巾：脖子一圈＋兩條垂下來的尾巴；格紋、條紋、彩虹在圍巾上一條一條
      const k = gear.acc.slice(10), [c0, c1] = ({black:['#2b2b30','#8a8a90'],white:['#f6f4ee','#c9c3b5'],navy:['#24406e','#e9e4d6'],pink:['#f5a5c8','#ffffff'],yellow:['#d9a62e','#5a3d2b'],green:['#3f7f5a','#e9e4d6'],grey:['#8f9196','#5c5e63'],brown:['#a8673a','#f2d6b0'],plaid:['#c0392b','#1e1e22'],stripe:['#ffffff','#2f6fb5'],rainbow:['#e8473a','']})[k], main = M(c0, 0.8);
      const r = mk(new THREE.TorusGeometry(0.17, 0.055, 8, 18), main, 0, 1.1, 0); r.rotation.x = Math.PI / 2;
      const tl = mk(new THREE.BoxGeometry(0.09, 0.26, 0.05), main, 0.1, 0.95, 0.2); tl.rotation.z = 0.25;
      const tl2 = mk(new THREE.BoxGeometry(0.08, 0.2, 0.045), main, 0.01, 0.97, 0.212); tl2.rotation.z = -0.12;
      const pat = k === 'rainbow' || k === 'plaid' || k === 'stripe', bands = k === 'rainbow' ? RAINBOW.slice(1) : pat ? [c1, c1, c1, c1] : [c1, c1];
      if (pat){ const ring = mk(new THREE.TorusGeometry(0.172, 0.057, 6, 18), M(k === 'rainbow' ? RAINBOW[4] : c1, 0.8), 0, 1.1, 0); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1, 0.22); }
      bands.forEach((bc, i) => { const y = pat ? 1.05 - i * (0.24 / bands.length) : 0.86 + i * 0.04; const b = mk(new THREE.BoxGeometry(0.095, pat ? 0.03 : 0.018, 0.056), M(bc, 0.8), 0.1 + (0.95 - y) * 0.25, y, 0.2); b.rotation.z = 0.25; });
      if (k === 'plaid') for (const dx of [-0.022, 0.022]){ const v = mk(new THREE.BoxGeometry(0.014, 0.26, 0.057), M(c1, 0.8), 0.1 + dx, 0.95, 0.2); v.rotation.z = 0.25; }
      break; }
    case 'acc_scarf': { const red = M('#e8473a', 0.75); const r = mk(new THREE.TorusGeometry(0.17, 0.055, 8, 18), red, 0, 1.1, 0); r.rotation.x = Math.PI / 2; const tl = mk(new THREE.BoxGeometry(0.09, 0.24, 0.05), red, 0.1, 0.96, 0.2); tl.rotation.z = 0.25; for (const y of [0.9, 0.97]) mk(new THREE.BoxGeometry(0.095, 0.02, 0.055), white, 0.1 + (0.96 - y) * 0.25, y, 0.2); break; }
    case 'acc_bowtie': { const red = M('#c9302c', 0.5); for (const sx of [-1, 1]){ const c = mk(new THREE.ConeGeometry(0.05, 0.09, 4), red, sx * 0.05, 1.08, 0.2); c.rotation.z = sx * Math.PI / 2; } mk(new THREE.SphereGeometry(0.025, 8, 6), red, 0, 1.08, 0.21); break; }
    case 'acc_glasses': { const fr = M('#5a3a24', 0.4); for (const sx of [-1, 1]) mk(new THREE.TorusGeometry(0.062, 0.011, 6, 16), fr, sx * 0.115, 0.0, 0.31, HD); mk(new THREE.BoxGeometry(0.07, 0.012, 0.012), fr, 0, 0.01, 0.315, HD); break; }
    case 'acc_shell': { const pearl = M('#fbf3ea', 0.3); for (let i = 0; i <= 10; i++){ const a = Math.PI * (0.1 + i / 10 * 0.8); mk(new THREE.SphereGeometry(0.018, 6, 4), pearl, Math.cos(a) * 0.17, 1.07 - Math.sin(a) * 0.06, Math.sin(a) * 0.17); } const sh2 = mk(new THREE.ConeGeometry(0.05, 0.07, 7), M('#f5a5d8', 0.4), 0, 0.98, 0.21); sh2.rotation.x = Math.PI; break; }
    case 'acc_lei': { const cs = ['#f17b6d', '#ffd36a', '#f5a5d8', '#ffffff', '#ff9f43']; for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; mk(new THREE.IcosahedronGeometry(0.045, 0), M(cs[i % 5], 0.6), Math.cos(a) * 0.21, 1.06 - Math.max(0, Math.sin(a)) * 0.1, Math.sin(a) * 0.19); } break; }
  }
  // ---- 背飾 ----
  switch (gear.back){
    case 'back_fin': { const gr = M('#7f95a6', 0.55), wh = M('#e9eef2', 0.6);
      const sh = new THREE.Shape(); sh.moveTo(-0.2, 0); sh.quadraticCurveTo(-0.05, 0.12, 0.08, 0.46); sh.quadraticCurveTo(0.12, 0.2, 0.22, 0); sh.lineTo(-0.2, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.025);
      const f = mk(g, gr, 0, 0.74, -0.3); f.rotation.y = Math.PI / 2; mk(new THREE.BoxGeometry(0.06, 0.05, 0.3), wh, 0, 0.74, -0.27);
      f.scale.set(1.35, 1.35, 1);
      av.gearAnim = (t, sp) => { f.rotation.z = Math.sin(t * (2 + sp)) * 0.08; }; break; }
    case 'back_bag': { const c = M('#f17b6d', 0.7); mk(new THREE.BoxGeometry(0.3, 0.32, 0.14), c, 0, 0.84, -0.27); mk(new THREE.BoxGeometry(0.31, 0.12, 0.15), M('#d8604f', 0.7), 0, 0.96, -0.27); for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.04, 0.36, 0.03), c, sx * 0.1, 0.84, 0.2).rotation.x = 0.1; break; }
    case 'back_basket': { const w = M('#c99a5b', 0.85); mk(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12), w, 0, 0.82, -0.32); for (const y of [0.74, 0.84, 0.94]) mk(new THREE.TorusGeometry(0.14, 0.012, 4, 14), M('#9b6a42', 0.8), 0, y, -0.32).rotation.x = Math.PI / 2; const tail = mk(new THREE.ConeGeometry(0.06, 0.14, 4), M('#2f6fb5', 0.6), 0.04, 1.03, -0.32); tail.rotation.z = 0.4; break; }
    case 'back_cape': { const red = M('#c9302c', 0.65, { side:THREE.DoubleSide }); const c = mk(new THREE.PlaneGeometry(0.56, 0.8, 1, 4), red, 0, 0.72, -0.25); c.rotation.x = 0.12; mk(new THREE.TorusGeometry(0.16, 0.03, 6, 14), M('#e8b730', 0.3, { metalness:0.5 }), 0, 1.1, -0.02).rotation.x = Math.PI / 2;
      av.gearAnim = (t, sp) => { c.rotation.x = 0.12 + Math.min(1, sp / 5) * 0.7 + Math.sin(t * 6) * 0.04 * (0.3 + sp / 5); }; break; }
    case 'back_wings': { const wm = M('#ffffff', 0.5, { emissive:'#fff6d8', emissiveIntensity:0.25, side:THREE.DoubleSide }), ws = [];
      for (const sx of [-1, 1]){ const pv = new THREE.Group(); pv.position.set(sx * 0.08, 0.95, -0.24); av.g.add(pv); av.gearMeshes.push(pv); for (let i = 0; i < 3; i++){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.2 - i * 0.04, 10, 8), wm); f.scale.set(1, 0.42, 0.12); f.position.set(sx * (0.17 + i * 0.07), 0.05 - i * 0.09, 0); f.castShadow = true; pv.add(f); } ws.push([pv, sx]); }
      av.gearAnim = t => { for (const [pv, sx] of ws) pv.rotation.y = sx * (0.45 + Math.sin(t * 3.2) * 0.25); }; break; }
    case 'back_balloon': { const str = mk(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 4), M('#ffffff', 0.5), 0.3, 1.55, -0.1); const bg = new THREE.Group(); bg.position.set(0.32, 2.2, -0.12); av.g.add(bg); av.gearMeshes.push(bg);
      const pm = M('#ff8fb0', 0.35); const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), pm); b.scale.set(1.3, 0.9, 0.8); bg.add(b); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), pm); tl.rotation.z = Math.PI / 2; tl.position.x = -0.3; bg.add(tl); const ey = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), ink); ey.position.set(0.15, 0.05, 0.14); bg.add(ey);
      av.gearAnim = t => { bg.position.y = 2.2 + Math.sin(t * 1.7) * 0.05; bg.rotation.z = Math.sin(t * 1.3) * 0.15; str.rotation.z = Math.sin(t * 1.3) * 0.05; }; break; }
  }
  // ---- 表情 ----
  const eyesOn = gear.face === 'face_normal' || gear.face === 'face_wink';
  av.eyes.forEach((e, i) => e.visible = eyesOn && !(gear.face === 'face_wink' && i === 1)); av.shines.forEach((e, i) => e.visible = eyesOn && !(gear.face === 'face_wink' && i === 1));
  const arcEye = (sx, flip) => { const a = mk(G.smile, ink, sx * 0.115, 0.0, 0.305, HD); a.scale.set(1.15, 1.15, 1); if (flip) a.rotation.z = Math.PI; return a; };
  switch (gear.face){
    case 'face_happy': arcEye(-1); arcEye(1); break;
    case 'face_wink': arcEye(1); break;
    case 'face_sleepy': for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.08, 0.014, 0.01), ink, sx * 0.115, -0.01, 0.312, HD); break;
    case 'face_cool': { const blk = M('#141820', 0.25, { metalness:0.5 }); for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.135, 0.075, 0.02), blk, sx * 0.115, 0.01, 0.31, HD); mk(new THREE.BoxGeometry(0.06, 0.015, 0.015), blk, 0, 0.03, 0.315, HD); break; }
    case 'face_heart': { const hm = new THREE.MeshBasicMaterial({ color:'#ff4d6d' }); for (const sx of [-1, 1]) mk(new THREE.ShapeGeometry(heartShape(0.055)), hm, sx * 0.115, 0.01, 0.318, HD); break; }
    case 'face_star': { const sm = new THREE.MeshBasicMaterial({ color:'#ffc93c' }); for (const sx of [-1, 1]) mk(new THREE.ShapeGeometry(starShape(0.065)), sm, sx * 0.115, 0.01, 0.318, HD); break; }
  }
  applyDesigns(av, gear);   /* 自己設計的衣服、褲子（044） */
}

// 竿子的樣子：手竿最長、沒有捲線器；遠投竿又長又粗；磯釣竿長長細細的
const ROD_SHAPE = { cast:{ len:1, thick:1, reel:true }, pole:{ len:1.4, thick:0.8, reel:false }, surf:{ len:1.55, thick:1.25, reel:true }, iso:{ len:1.4, thick:0.85, reel:true } };
function applyRodShape(av, type, hall){ if (!av || !av.pole) return; const S = ROD_SHAPE[type] || ROD_SHAPE.cast, k = hall ? 0.5 : S.len; av.pole.scale.set(hall ? 1 : S.thick, k, hall ? 1 : S.thick); av.pole.position.y = 1.15 * k; av.tip.position.y = 2.3 * k; if (av.reel) av.reel.visible = hall || S.reel; }
// 竿種不同，甩竿的動作也不同：手竿輕輕往前放、遠投竿舉過頭用力甩
const CAST_STYLE = { cast:{ w:1, f:1, raise:0 }, pole:{ w:0.35, f:0.55, raise:0 }, surf:{ w:1.35, f:1.35, raise:0.6 }, iso:{ w:1.05, f:1, raise:0.15 } };
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
const BIG_FISH = new Set(['goblinshark', 'goblinshark_albino', 'sixgill', 'sixgill_albino', 'galapagosshark', 'galapagosshark_albino', 'sleepershark', 'sleepershark_albino', 'bullshark', 'sawfish', 'shark_red', 'shark_red_albino', 'toothfish', 'narwhal', 'angler', 'sturgeon', 'grouper', 'hammer', 'oarfish', 'turtle', 'giantsquid', 'tuna', 'marlin', 'shark', 'whale', 'dolphin', 'manta', 'orca', 'beluga', 'sperm', 'sunfish', 'whaleshark', 'baskingshark', 'greatwhite', 'baskingshark_albino', 'greatwhite_albino']);
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
addSeaLife('baskingshark', 3.2, 70, -20, 7, 0.06, 'glide', 4.2);
addSeaLife('beluga', 1.5, -46, -50, 6, 0.2, 'jump', 2.2);

/* ================= FISHER ================= */
const labelsEl = $('#labels');
/* 走路動畫的「地面類型」：之後的海洋環境都從這裡調（st 步幅、kn 抬腳、bob 上下起伏、arm 手張開、lean 前傾）
   ground 一般地面、sand 沙灘（步伐小一點、陷一點）、wade 淺水／泥灘（抬高腳、手張開保持平衡）、boat 船上（身體抵消搖晃）；游泳和潛水用 Fisher.swim */
const GAIT_SURF = {
  ground: { st:1, kn:1, bob:1, arm:0, lean:0 },
  sand:   { st:0.86, kn:1.15, bob:1.3, arm:0.03, lean:0.02 },
  wade:   { st:0.7, kn:1.9, bob:1.1, arm:0.32, lean:0.06 },
  boat:   { st:0.8, kn:1.1, bob:0.6, arm:0.12, lean:0 },
};
function surfaceAt(x, z){
  if (typeof Mang !== 'undefined' && Mang.onMud) return 'wade';
  if (myBoat) return 'boat';
  const e = islandEdge(x, z); if (e > -0.5 && e < 2.6) return 'sand';
  if (Math.hypot((x - 40) / 1.0, (z + 6) / 1.6) < 9) return 'sand';
  return 'ground';
}
/* ===================== 正式 3D 角色（2026-11-04）=====================
   models/tide_kid.glb：本專案自己做的 Q 版角色（tools/character/build_character.js 產生），骨架和大部分動作是 KayKit Character Animations（CC0）。
   模型載好以後，每個角色把程式做的身體換成這個模型：衣服顏色、髮色膚色、自己設計的圖案照樣能換；帽子、臉、髮型、配件黏在對應的骨頭上跟著動。
   載入失敗（或網址加 #kid=0）就繼續用原本程式做的角色。 */
const KID = { gltf: null, clips: null, ok: false, failed: false, wait: new Set() };
(function loadKid(){
  if (/kid=0/.test(location.hash)) return;
  try { new GLTFLoader().load('models/tide_kid.glb', g => { KID.gltf = g; KID.clips = Object.fromEntries(g.animations.map(a => [a.name, a])); if (KID.clips.hold){ const h = KID.clips.hold.clone(); h.name = 'hold_arms'; h.tracks = h.tracks.filter(t => /^(upperarm|lowerarm|wrist|hand|chest)/.test(t.name)); KID.clips.hold_arms = h; }   /* 捧魚：只有上半身，腳照樣走 */ KID.ok = true; for (const f of [...KID.wait]){ KID.wait.delete(f); try { kidUpgrade(f); } catch(e){ console.warn('kid upgrade', e); } } },
    undefined, e => { KID.failed = true; KID.wait.clear(); console.warn('3D 角色載入失敗，繼續用程式角色', e); }); } catch(e){ KID.failed = true; }
})();
// 動作的原始移動速度（量過：腳往後推的速度），用來讓播放速度跟真正的移動速度一樣
const KID_SPD = { walk: 0.68, run: 1.51, sprint: 1.43 };
function kidUpgrade(f){
  const a = f.av; if (a.kid || !KID.ok) return;
  const m = SkeletonUtils.clone(KID.gltf.scene), prim = {}, B = {};
  m.traverse(o => { if (o.isBone) B[o.name] = o; if (o.isMesh){ o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; prim[o.material.name] = o; } });
  const mapM = { skin: a.skinM, shirt: a.shirtM, pants: a.pantsM, shin: a.pantsM, shoe: a.shoeM };
  for (const k in prim){ if (mapM[k]) prim[k].material = mapM[k]; else prim[k].visible = false; }   /* 臉、頭髮用原本的（表情、髮型才換得了），身體用模型的 */
  const keepRot = a.g.rotation.clone(), keepPos = a.g.position.clone(); a.g.rotation.set(0, 0, 0); a.g.position.set(0, 0, 0); a.g.add(m); m.updateMatrixWorld(true); a.g.updateMatrixWorld(true);
  for (const o of a.BODY) if (o.parent) o.parent.remove(o);
  // 掛點：頭、帽子 → 頭骨；腿 → 大腿／小腿／腳骨；上衣類配件 → 胸骨
  B.head.attach(a.headG); B.head.attach(a.hatG);
  for (const [L, s] of [[a.legL, 'r'], [a.legR, 'l']]){ const sx = s === 'l' ? 1 : -1; L.rotation.set(0, 0, 0); L.position.set(sx * 0.145, 0.441, 0); L.userData.shin.rotation.set(0, 0, 0); L.userData.shin.position.y = -0.193; L.userData.foot.rotation.set(0, 0, 0); L.userData.foot.position.y = -0.125;
    a.g.updateMatrixWorld(true); B['upperleg' + s].attach(L); B['lowerleg' + s].attach(L.userData.shin); B['foot' + s].attach(L.userData.foot); }
  a.torsoG = new THREE.Group(); a.g.add(a.torsoG); a.g.updateMatrixWorld(true); B.chest.attach(a.torsoG);
  for (const o of [...a.gearMeshes]) if (o.parent === a.g) a.torsoG.attach(o);
  a.armL.visible = a.armR.visible = false;
  a.g.rotation.copy(keepRot); a.g.position.copy(keepPos);
  const mixer = new THREE.AnimationMixer(m), acts = {};
  for (const [nm, c] of Object.entries(KID.clips)){ const ac = mixer.clipAction(c); ac.enabled = true; ac.setEffectiveWeight(0); ac.play(); acts[nm] = ac; }
  for (const nm of ['jump_land', 'fish_cast']){ if (acts[nm]){ acts[nm].setLoop(THREE.LoopOnce, 1); acts[nm].clampWhenFinished = true; } }
  a.kid = { m, B, prim, mixer, acts, w: {}, handR: B.handr, v: new THREE.Vector3(), skipT: 0 };
  a.body = prim.shirt || a.body;
  if (f.gearKey){ const g = JSON.parse(f.gearKey); f.gearKey = ''; f.setGear(g); }
}
// 每一格：照角色現在在做什麼，決定每個動作的比重（平滑過去，不會瞬間跳），播放速度跟移動速度一樣
function kidAnimate(f, dt, t){
  const a = f.av, K = a.kid, v = f.aspd || 0, W = {};
  if (f.swim) W.dive = 1;
  else if (f.sitting) W.sit = 1;
  else if (f.air > 0.05) W.jump_air = 1;
  else if (f.fishing){ if ((f.windup || 0) > 0.02 || f.castT >= 0) W.fish_cast = 1; else if ((f.bend || 0) > 0.45) W.fish_fight = 1; else if ((f.bend || 0) > 0.05) W.fish_reel = 1; else W.fish_idle = 1; }
  else { const wk = smooth01((v - 0.2) / 0.8) * (1 - smooth01((v - 2.4) / 1.2)), rn = smooth01((v - 2.4) / 1.2) * (1 - smooth01((v - 4.3) / 0.6)), sp = smooth01((v - 4.3) / 0.6);   /* 走 3.8 用跑步動作、推到底 5.0 用衝刺動作 */
    W.idle = 1 - smooth01((v - 0.1) / 0.5); if (wk > 0) W.walk = wk; if (rn > 0) W.run = rn; if (sp > 0) W.sprint = sp;
    if (f.held) W.hold_arms = 5; }   /* 上半身捧著魚的比重大很多，手幾乎都是捧魚的樣子 */
  if (f === me && Jump.land > 0 && !f.swim && !f.fishing){ W.jump_land = 1; for (const k of ['idle', 'walk', 'run', 'sprint']) if (W[k]) W[k] *= 0.3; }
  const rate = 1 - Math.exp(-dt * 10);
  for (const nm in K.acts){ const tgt = W[nm] || 0, cur = K.w[nm] || 0, nw = cur + (tgt - cur) * rate; K.w[nm] = nw < 0.002 && tgt === 0 ? 0 : nw; K.acts[nm].setEffectiveWeight(K.w[nm]); }
  // 播放速度
  const ac = K.acts; if (ac.walk) ac.walk.timeScale = clamp(v / KID_SPD.walk, 0.6, 2.4); if (ac.run) ac.run.timeScale = clamp(v / KID_SPD.run, 0.7, 3.0); if (ac.sprint) ac.sprint.timeScale = clamp(v / KID_SPD.sprint, 0.7, 3.2);
  if (ac.dive) ac.dive.timeScale = 0.6 + Math.min(1, v / 2.5) * 0.9;
  // 甩竿：蓄力時停在往後舉的那一格，放開時從那裡往前甩
  if (ac.fish_cast){ const c = ac.fish_cast, d = c.getClip().duration;
    if (f.castT >= 0){ if (!K.casting){ K.casting = true; c.reset(); c.time = d * 0.38; c.paused = false; c.timeScale = 1.8; } }
    else if ((f.windup || 0) > 0.02){ K.casting = false; c.paused = true; c.time = d * 0.38 * Math.min(1, f.windup); }
    else K.casting = false; }
  if (ac.jump_land && W.jump_land && (K.w.jump_land || 0) < 0.1){ ac.jump_land.reset(); }
  K.mixer.update(dt);
}
class Fisher {
  constructor(opts){
    this.av = makeAvatar(opts.shirt, opts.hat); scene.add(this.av.g);
    if (KID.ok) kidUpgrade(this); else if (!KID.failed) KID.wait.add(this);
    this.bob = makeBobber(); this.line = makeLine();
    this.pos = this.av.g.position; this.rot = 0; this.walk = 0; this.speed = 0;
    this.fishing = false; this.bobPos = new THREE.Vector3(); this.dip = 0; this.bend = 0; this.flying = null; this.windup = 0; this.castT = -1;
    this.tag = document.createElement('div'); this.tag.className = 'tag';
    this.bub = document.createElement('div'); this.bub.className = 'bub'; this.bub.hidden = true;
    this.nm = document.createElement('div'); this.nm.className = 'nm' + (opts.kind ? ' ' + opts.kind : '');
    this.nm.textContent = opts.name || '';
    this.tag.append(this.bub, this.nm); labelsEl.appendChild(this.tag);
    this.bubUntil = 0;
    if (!CLASSIC){ this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); this.blob.renderOrder = 1; scene.add(this.blob); }
  }
  setLook(shirt, hat){ this.av.shirtM.color.set(shirt); this.av.hatM.color.set(hat); }
  setGear(gear){ const k = JSON.stringify(gear || {}); if (k === this.gearKey) return; this.gearKey = k; applyGear(this.av, gear || {}); }
  setRod(id){ const r = RODS.find(r => r.id === id) || RODS[0]; if (this.rodId !== r.id){ this.rodId = r.id; this.rodType = rodType(r); this.av.pole.material.color.set(r.color); applyRodShape(this.av, this.rodType, false); } }
  setName(n){ if (this.nm.textContent !== n) this.nm.textContent = n; }
  say(text, cls, secs){ this.bub.className = 'bub' + (cls ? ' ' + cls : ''); this.bub.textContent = text; this.bub.hidden = false; this.bubUntil = now() + (secs || 5); }
  // 炫耀魚：把魚舉在頭上幾秒
  // 潛水：身體趴平、背氧氣瓶、戴面鏡
  setSwim(on){
    on = !!on; if (on === !!this.swim) return; this.swim = on; const a = this.av;
    if (on){ const tank = new THREE.Group(), y = mat('#f6c83b', 0.4, { metalness:0.3 }), k = mat('#2b2f36', 0.5);
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 12), y); c1.position.set(0, 0.86, -0.3); tank.add(c1);
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), y); c2.position.set(0, 1.09, -0.3); tank.add(c2);
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), k); v.position.set(0, 1.2, -0.3); tank.add(v);
      a.g.add(tank); const mask = new THREE.Group(); const gl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), mat('#9fe3ff', 0.1, { transparent:true, opacity:0.6, metalness:0.2 })); gl.position.set(0, 0.0, 0.31); mask.add(gl);
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20), k); st.rotation.x = Math.PI / 2; st.position.y = 0.0; st.scale.set(1, 1.08, 1); mask.add(st);
      const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), mat('#f05a4a', 0.5)); sn.position.set(0.22, 0.15, 0.1); mask.add(sn);
      a.headG.add(mask); this.swimMesh = [tank, mask]; a.rod.visible = false; }
    else { for (const m of this.swimMesh || []) if (m.parent) m.parent.remove(m); this.swimMesh = null; const g = a.g; g.rotation.x = 0; g.rotation.order = 'XYZ'; }
  }
  holdFish(f, w, secs){
    const a = this.av; if (this.held) a.g.remove(this.held.o);
    // 像拍釣魚紀念照一樣，雙手把魚捧在胸前
    const big = BIG_FISH.has(f.id), o = new THREE.Group(), m = fishModel(f, big ? 0.75 : 0.45);
    const y = a.kid ? 0.8 : 0.98; o.position.set(0, y, a.kid ? 0.42 : 0.48); o.add(m); a.g.add(o);
    this.held = { o, y, until: now() + (secs || 6) };
    this.say(`${f.name} ${fmtKg(w)}`, 'emote', secs || 6);
  }
  dispose(){ KID.wait.delete(this); if (this.hookM){ scene.remove(this.hookM); this.hookM = null; } if (this.boatMesh) scene.remove(this.boatMesh); scene.remove(this.av.g, this.bob, this.line); if (this.blob) scene.remove(this.blob); this.tag.remove(); }
  update(dt, t){
    const a = this.av; dt = Math.min(dt, 0.1);
    // ===== 走路動畫（2026-11-04 改版）：Idle／Walk／Run／Sprint 依速度平滑混合；腳步照「實際走了多遠」前進，減少滑步 =====
    if (this === me && (frameNo % 10 === 0)) this.surf = surfaceAt(this.pos.x, this.pos.z);
    const S = GAIT_SURF[this.surf] || GAIT_SURF.ground;
    const prevSp = this.aspd || 0; this.aspd = prevSp + ((this.speed || 0) - prevSp) * Math.min(1, dt * 8); const v = this.aspd;
    const w = smooth01(v / 1.2), r = clamp((v - 4.4) / 1.6, 0, 1), sp = clamp((v - 6.4) / 1.0, 0, 1);
    const Lc = (lerp(1.5, 2.35, r) + sp * 0.35) * lerp(0.62, 1, clamp(v / 3.2, 0, 1)) * S.st;   /* 走兩步的距離 */
    if (w > 0.15) this.walk += v * dt / Lc * Math.PI * 2;
    else { const tgt = Math.round(this.walk / Math.PI) * Math.PI, d = tgt - this.walk; this.walk += Math.sign(d) * Math.min(Math.abs(d), dt * 7); }   /* 停下來：把腳收回來站好 */
    this.walk %= Math.PI * 4;
    const ph = this.walk, sL = Math.sin(ph), cL = Math.cos(ph);
    // 加速、減速時身體前後傾；轉彎時往內側傾
    { const acc = (v - prevSp) / Math.max(dt, 1e-3); this.accL = (this.accL || 0) + (clamp(acc * 0.02, -0.12, 0.14) - (this.accL || 0)) * Math.min(1, dt * 6); }
    { const pr = this.prevRot == null ? this.rot : this.prevRot; let dr = this.rot - pr; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); this.prevRot = this.rot;
      this.bank = (this.bank || 0) + (clamp(-dr / Math.max(dt, 1e-3) * v * 0.012, -0.2, 0.2) - (this.bank || 0)) * Math.min(1, dt * 6); }
    const A = lerp(0.42, 0.72, r) * w, K = lerp(0.65, 1.35, r) * w * S.kn;
    const P = this.pose || (this.pose = { lL:0, lR:0, kL:0, kR:0, fL:0, fR:0, aL:0, aR:0, zL:-0.08, zR:0.08, tw:0, pit:0, rol:0, bob:0, hy:0, br:1 });
    const T = { lL: sL * A, lR: -sL * A, kL: Math.max(0, -cL) * K, kR: Math.max(0, cL) * K, aL: -sL * lerp(0.55, 0.95, r) * w - r * 0.35, aR: sL * lerp(0.55, 0.95, r) * w - r * 0.35,
      zL: -0.08 - (r * 0.12 + S.arm), zR: 0.08 + (r * 0.12 + S.arm), tw: sL * 0.09 * w, pit: (0.03 + 0.09 * r + 0.06 * sp + S.lean) * w + this.accL, rol: this.bank,
      bob: (0.5 + 0.5 * Math.cos(ph * 2)) * lerp(0.035, 0.075, r) * w * S.bob, hy: 0, br: 1 };
    T.fL = -(T.lL + T.kL) * 0.75 + Math.max(0, sL) * 0.35 * w; T.fR = -(T.lR + T.kR) * 0.75 + Math.max(0, -sL) * 0.35 * w;   /* 腳掌：著地時平貼地面、往後推時腳尖踮起來 */
    // Idle：呼吸、手輕輕晃、偶爾左右看
    const idle = 1 - w; if (idle > 0.01){ T.br = 1 + Math.sin(t * 2.1 + a.blinkAt) * 0.012 * idle; T.aL += Math.sin(t * 1.1 + a.blinkAt) * 0.04 * idle; T.aR -= Math.sin(t * 1.1 + a.blinkAt) * 0.04 * idle;
      T.hy = Math.sin(t * 0.31 + a.blinkAt * 3) * Math.max(0, Math.sin(t * 0.13 + a.blinkAt)) * 0.45 * idle; }
    T.hy += -T.tw * 0.8 - this.bank * 0.6;   /* 頭穩住、轉彎時先看過去 */
    // 船上：身體反過來抵消搖晃（之後在船上站著時用）
    if (this.surf === 'boat' && this.boatRoll != null) T.rol -= this.boatRoll * 0.6;
    // ---- 特殊姿勢（目標姿勢，下面再平滑過去，不會瞬間跳動）----
    if (this.sitting){ T.lL = T.lR = -1.45; T.kL = T.kR = 1.35; T.fL = T.fR = 0.1; T.pit = 0; T.bob = 0; T.tw = 0; T.rol = 0; }
    else if (this.air > 0.05){ T.lL = -0.55; T.lR = 0.35; T.kL = 0.9; T.kR = 0.5; T.fL = 0.2; T.fR = 0.3; T.bob = 0; T.aL = T.aR = -0.6; T.zL = -0.35; T.zR = 0.35; }
    else if (this === me && Jump.land > 0){ const k = Jump.land / 0.18; T.lL = T.lR = -0.35 * k; T.kL = T.kR = 0.75 * k; T.fL = T.fR = -0.4 * k; T.bob -= 0.08 * k; }   /* 落地：膝蓋微彎緩衝 */
    a.rod.visible = this.fishing;
    if (this.fishing){
      // 甩竿動畫：蓄力時把竿子往後舉到肩膀上（windup），放開時用力往前甩（castT），竿尖甩過頭再回來
      const CS = CAST_STYLE[this.rodType || 'cast'] || CAST_STYLE.cast; let pz = -(this.windup || 0) * CS.w;
      if (this.castT >= 0){ this.castT += dt; const k = this.castT / 0.5; if (k >= 1) this.castT = -1; else pz = k < 0.4 ? (-1 + (k / 0.4) * 2.25) * (k < 0.2 ? CS.w : CS.f) : (1.25 - ((k - 0.4) / 0.6) * 1.25) * CS.f; }
      const back = Math.max(0, -pz), fwd = Math.max(0, pz); T.zR = CS.raise && back > 0 ? -back * CS.raise * 0.4 : 0;   /* 遠投：手舉高一點 */
      T.aR = -1.0 - this.bend * 0.3 - back * 0.55 + fwd * 0.3; T.aL = -0.7 - this.bend * 0.2 - back * 0.4 + fwd * 0.2; T.zL = 0.08 * 0;   /* 手不要舉太高：主要是竿子往後倒 */
      T.tw = -back * 0.12 + fwd * 0.08; T.pit += fwd * 0.06 - back * 0.03;
      a.rod.rotation.x = 0.95 - this.bend * 0.45 + Math.sin(t*9) * this.bend * 0.04 - back * 1.1 + fwd * 0.5;
      this.castSnap = this.castT >= 0 || (this.windup || 0) > 0;
    } else this.castSnap = false;
    if (this.held){
      const h = this.held;
      if (now() > h.until || this.fishing){ a.g.remove(h.o); this.held = null; }
      else { T.aL = T.aR = -1.3; T.zL = -0.05; T.zR = 0.05; h.o.position.y = h.y + Math.sin(t * 4) * 0.04; h.o.rotation.z = Math.sin(t * 2.6) * 0.1; }
    }
    if (this.swim){ const mv = Math.min(1, this.speed / 2.5), want = this.swimPitch != null ? this.swimPitch : 0.3 + mv * 0.95; this.swimP = (this.swimP || 0) + (want - (this.swimP || 0)) * Math.min(1, dt * 4);
      const kick = Math.sin(t * (4 + mv * 6)) * (0.2 + mv * 0.25); T.lL = kick; T.lR = -kick; T.kL = 0.25 + Math.max(0, kick) * 0.6; T.kR = 0.25 + Math.max(0, -kick) * 0.6; T.fL = T.fR = 0.6;   /* 蛙鞋往後伸直 */
      T.aL = T.aR = -0.5 - mv * 2.2 + Math.sin(t * 2) * 0.1; T.zL = -0.1; T.zR = 0.1; T.tw = 0; T.pit = this.swimP; T.rol = Math.sin(t * 1.3) * 0.05; T.bob = Math.sin(t * 1.6) * 0.05; T.hy = 0; a.rod.visible = false; }
    // ---- 平滑套用：每個關節往目標姿勢靠過去（甩竿要很快，其他稍微柔一點）----
    const kk = this.castSnap ? 1 : 1 - Math.exp(-dt * (this.swim ? 8 : 22));
    for (const k in T) P[k] += (T[k] - P[k]) * kk;
    if (a.kid){
      // 正式 3D 角色：手腳的動作由骨架動畫負責；整個人的前傾、轉彎傾斜、上下浮動照原本的算法（前傾少一點，動畫自己會前傾）
      const far = this !== me && camera.position.distanceToSquared(this.pos) > 900; a.kid.skipT += dt;
      if (!far || a.kid.skipT > 0.1){ kidAnimate(this, far ? a.kid.skipT : dt, t); a.kid.skipT = 0; }
      a.g.rotation.order = 'YXZ'; a.g.rotation.y = this.rot; a.g.rotation.x = this.swim ? P.pit : P.pit * 0.35; a.g.rotation.z = P.rol * 0.8;
      a.g.position.y = this.baseY + (this.swim ? P.bob : 0);
      if (this.fishing){ a.g.updateMatrixWorld(true); a.kid.handR.getWorldPosition(a.kid.v); a.g.worldToLocal(a.kid.v); a.rod.position.copy(a.kid.v); }
    } else {
    a.legL.rotation.x = P.lL; a.legR.rotation.x = P.lR; a.legL.userData.shin.rotation.x = P.kL; a.legR.userData.shin.rotation.x = P.kR; a.legL.userData.foot.rotation.x = P.fL; a.legR.userData.foot.rotation.x = P.fR;
    a.armL.rotation.x = P.aL; a.armR.rotation.x = P.aR; a.armL.rotation.z = P.zL; a.armR.rotation.z = P.zR;
    { const c = Math.cos(P.tw), s2 = Math.sin(P.tw); a.body.rotation.y = P.tw; a.armL.position.set(-0.33 * c, 1.0, 0.33 * s2); a.armR.position.set(0.33 * c, 1.0, -0.33 * s2); }
    a.body.scale.y = P.br;
    a.g.rotation.order = 'YXZ'; a.g.rotation.y = this.rot; a.g.rotation.x = P.pit; a.g.rotation.z = P.rol;
    a.g.position.y = this.baseY + P.bob;
    }
    if (a.gearAnim) a.gearAnim(t, this.speed || 0);
    if (a.eyes){ const bt = (t + a.blinkAt) % 4.2, sy = bt < 0.12 ? 0.12 : 1.15; a.eyes[0].scale.y = a.eyes[1].scale.y = sy; a.headG.rotation.z = Math.sin(t * 1.3 + a.blinkAt) * 0.03 * idle; a.headG.rotation.y = P.hy; }
    if (this.blob){ this.blob.position.set(this.pos.x, this.baseY + 0.025, this.pos.z); this.blob.visible = a.g.visible && !this.swim; }
    // bobber
    const showBob = this.fishing && this.bobState !== 'none';
    this.bob.visible = showBob; this.line.visible = showBob;
    if (showBob){
      if (this.flying && this.flying.delay > 0){ this.flying.delay -= dt; this.av.tip.getWorldPosition(this.flying.from); this.bob.position.copy(this.flying.from); }   // 甩到一半浮標才飛出去
      else if (this.flying){
        const f = this.flying; f.t += dt / f.dur; const k = Math.min(1, f.t);
        this.bob.position.lerpVectors(f.from, f.to, k); this.bob.position.y += Math.sin(k * Math.PI) * f.h;
        if (k >= 1){ this.flying = null; this.bobState = 'water'; ripple(f.to.x, f.to.z); if (f.done) f.done(); }
      } else {
        const wy = waterY(this.bobPos.x, this.bobPos.z, t);
        const jt = this === me && F.phase === 'bite' ? (this.bobJit || 0) : 0; this.bob.position.set(this.bobPos.x + Math.sin(t * 37) * jt, wy - this.dip * 0.16 + Math.sin(t*3)*0.01, this.bobPos.z + Math.cos(t * 41) * jt);
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
    // 自己的名字一直清楚；別人的名字：太遠會變淡，被房子或樹擋住也會變淡（每幾格才算一次）
    if (this === me){ this.tag.style.opacity = '1'; return; }
    if ((frameNo + (this._ofs || (this._ofs = 1 + Math.floor(Math.random() * 7)))) % 8 === 0) this._occ = tagOccluded(this.pos.x, this.pos.y + 1.95, this.pos.z);
    const far = d > 18 ? clamp(1 - (d - 18) / 20, 0.12, 1) : 1, op = Math.min(far, this._occ ? 0.25 : 1);
    if (Math.abs((this._op || 1) - op) > 0.02){ this._op = (this._op || 1) + (op - (this._op || 1)) * 0.35; this.tag.style.opacity = this._op.toFixed(2); }
  }
}
Fisher.prototype.baseY = 0;
Fisher.prototype.bobState = 'none';
const tmpV = new THREE.Vector3();
// 鏡頭到某一點之間有沒有被房子（方形障礙物）或樹冠擋住：只用平面上的線段檢查，很便宜
function tagOccluded(tx, ty, tz){
  const ax = camera.position.x, ay = camera.position.y, az = camera.position.z, dx = tx - ax, dz = tz - az, L = Math.hypot(dx, dz); if (L < 1.5) return false;
  if (House.on || Dive.on) return false;
  for (const c of colliders){
    if (c.t === 'b' || c.t === 'o'){ const hw = c.t === 'o' ? c.bw : c.hw, hd = c.t === 'o' ? c.bd : c.hd; if (hw < 0.9 && hd < 0.9) continue;
      let t0 = 0.02, t1 = 0.95; for (const [o, dd, lo, hi] of [[ax, dx, c.x - hw, c.x + hw], [az, dz, c.z - hd, c.z + hd]]){ if (Math.abs(dd) < 1e-6){ if (o < lo || o > hi){ t0 = 2; break; } continue; } let a = (lo - o) / dd, b = (hi - o) / dd; if (a > b){ const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break; }
      if (t0 <= t1){ const hy = ay + (ty - ay) * t0; if (hy < groundHeight(ax + dx * t0, az + dz * t0) + 3.2) return true; } }
    else if (c.t === 'c' && c.r >= 0.45 && c.r <= 0.6){   // 樹：樹冠比樹幹大很多
      const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / (L * L), 0.02, 0.95), px = ax + dx * t - c.x, pz = az + dz * t - c.z;
      if (px * px + pz * pz < 1.2){ const hy = ay + (ty - ay) * t, g = groundHeight(c.x, c.z); if (hy > g + 1.3 && hy < g + 3.8) return true; } }
  }
  return false;
}

/* ================= LABELS for places ================= */
const placeLabels = [];
for (const s of SPOTS){ if (s.hidden) continue; const el = document.createElement('div'); el.className = 'lbl spot'; el.style.setProperty('--c', s.color); el.innerHTML = ''; el.textContent = s.label; const sm = document.createElement('small'); sm.textContent = '釣點'; el.appendChild(sm); labelsEl.appendChild(el); placeLabels.push({ el, p:new THREE.Vector3(s.pos.x, 2.1 + groundHeight(s.pos.x, s.pos.z), s.pos.z), spot:s }); }
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
// 噪音做的音效（水花、風、腳步）
let noiseBuf = null;
function noise(dur, vol, f0, f1, q, type){ if (!soundOn || !actx) return; if (!noiseBuf){ noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = noiseBuf; f.type = type || 'bandpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f).connect(g).connect(actx.destination); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05); }
const SFX = {
  splash(big){ noise(big ? 0.7 : 0.4, big ? 0.22 : 0.12, 1800, 400, 0.8); tone(240, 0.2, 'sine', 0.05, 90); },
  tick(){ tone(1600, 0.03, 'sine', 0.035); },
  reel(){ noise(0.035, 0.04, 3200, 0, 6); },
  coin(){ tone(1568, 0.08, 'square', 0.04); setTimeout(() => tone(2093, 0.16, 'square', 0.04), 70); },
  click(){ tone(700, 0.04, 'triangle', 0.04); },
  squeak(){ const f = 900 + Math.random() * 300; tone(f, 0.12, 'square', 0.025, f * 1.4); setTimeout(() => tone(f * 1.2, 0.1, 'square', 0.02, f * 0.9), 130); },
  gull(){ const f = 1300 + Math.random() * 300; tone(f, 0.25, 'sawtooth', 0.012, f * 0.7); setTimeout(() => tone(f * 1.05, 0.3, 'sawtooth', 0.012, f * 0.65), 280); },
  wind(){ noise(2.5, 0.05, 300, 700, 0.6, 'lowpass'); },
  bubble(){ tone(500 + Math.random() * 500, 0.06, 'sine', 0.03, 1200); },
  door(){ tone(180, 0.18, 'triangle', 0.08, 120); setTimeout(() => tone(140, 0.1, 'triangle', 0.06), 160); },
  step(){ noise(0.05, 0.025, 900, 0, 1.5); },
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

/* ================= MUSIC：程式即時演奏的背景音樂（會跟著地方和狀況換曲子）================= */
const MUSIC = (() => {
  let master = null, timer = null, next = 0, step = 0, sea = null, mel = 4, section = 0, theme = 'day', want = 'day';
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const C = [48,52,55,60], Am = [45,48,52,57], F_ = [41,45,48,53], G = [43,47,50,55], Em = [40,43,47,52], Dm = [38,41,45,50], E7 = [40,44,47,50];
  // 每一首：速度、和弦進行、旋律音階、樂器
  const THEMES = {
    day:    { bpm:84,  progs:[[C, Am, F_, G], [F_, G, C, Am], [C, Em, F_, G]], scale:[60,62,64,67,69,72,74,76,79], arp:'triangle', arpV:0.055, melV:0.05, melP:0.5, bass:0.2, sea:0.22, name:'晴天的海島' },
    night:  { bpm:64,  progs:[[Am, F_, C, G], [Dm, Am, F_, E7], [F_, G, Em, Am]], scale:[57,60,62,64,67,69,72,74], arp:'sine', arpV:0.04, melV:0.045, melP:0.3, bass:0.14, sea:0.26, soft:true, name:'夜晚的海邊' },
    shrimp: { bpm:104, progs:[[C, G, Am, F_], [F_, C, G, C]], scale:[60,62,64,67,69,72,74,76], arp:'square', arpV:0.022, melV:0.035, melP:0.6, bass:0.18, sea:0.08, stab:true, name:'釣蝦場' },
    dive:   { bpm:56,  progs:[[F_, C, Dm, C], [Am, F_, C, G]], scale:[65,67,69,72,74,77,79,81], arp:'sine', arpV:0.035, melV:0.05, melP:0.35, bass:0.1, sea:0.06, soft:true, bell:true, name:'海底' },
    reel:   { bpm:126, progs:[[Am, Am, F_, E7], [Am, Dm, E7, Am]], scale:[57,60,62,64,67,69,72], arp:'sawtooth', arpV:0.018, melV:0.0, melP:0, bass:0.22, sea:0.1, drive:true, name:'拉魚' },
    boss:   { bpm:140, progs:[[Am, F_, Dm, E7], [Am, E7, Am, E7]], scale:[57,59,60,62,64,65,68,69], arp:'sawtooth', arpV:0.022, melV:0.035, melP:0.5, bass:0.26, sea:0.1, drive:true, name:'大魚搏鬥' },
  };
  function pick(){
    if (F.phase === 'reeling') return F.boss ? 'boss' : 'reel';
    if (Dive.on) return 'dive';
    if (inShrimpHall(me.pos.x, me.pos.z, 8)) return 'shrimp';
    return DayNight.period === 'night' ? 'night' : 'day';
  }
  function note(m, t, dur, type, vol, cut){
    if (vol <= 0) return;
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
    lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start(); sea = { src, lfo, g, f };
  }
  function tick(){
    if (!actx || !master) return;
    try { want = pick(); } catch(e){}
    // 拉魚的音樂馬上換；其他的等一小節結束再換，比較自然
    if (want !== theme && (want === 'reel' || want === 'boss' || theme === 'reel' || theme === 'boss' || step % 8 === 0)){ theme = want; step = 0; section = 0; if (sea){ sea.g.gain.setTargetAtTime(THEMES[theme].sea, actx.currentTime, 1.2); sea.f.frequency.setTargetAtTime(theme === 'dive' ? 260 : 520, actx.currentTime, 1); } }
    const T = THEMES[theme], SPB = 60 / T.bpm / 2;
    if (next < actx.currentTime - 0.1) next = actx.currentTime + 0.05; // 分頁切回來時不要一次補一大堆音
    while (next < actx.currentTime + 0.3){
      const bar = Math.floor(step / 8), beat = step % 8, t = next;
      if (beat === 0 && bar % 8 === 0) section = Math.floor(Math.random() * T.progs.length);
      const ch = T.progs[section][bar % 4];
      if (T.drive){ if (beat % 2 === 0) note(ch[0] - 12, t, SPB * 0.9, 'triangle', T.bass, 700); if (beat === 0 || beat === 4) noiseHit(t, 0.05); }
      else { if (beat === 0) note(ch[0] - 12, t, SPB * 7, 'sine', T.bass, 500); if (beat === 4 && !T.soft) note(ch[0] - 5, t, SPB * 3.5, 'sine', T.bass * 0.5, 500); }
      if (T.soft && beat === 0) for (const n of ch.slice(1)) note(n, t, SPB * 7.5, 'sine', 0.018, 1200);   // 柔柔的和弦墊底
      if (T.stab){ if (beat % 2 === 1) for (const n of ch.slice(1)) note(n + 12, t, SPB * 0.5, 'square', 0.012, 1800); }
      else { const arp = [0,2,1,3,2,1,3,2][beat]; if (!T.soft || beat % 2 === 0) note(ch[arp] + 12, t, SPB * (T.soft ? 3.5 : 2.4), T.arp, T.arpV, T.drive ? 1400 : 2400); }
      if (beat % 2 === 0 && Math.random() < T.melP * (bar % 8 < 4 ? 1.1 : 0.8)){
        mel = clamp(mel + [-2,-1,-1,0,1,1,2][Math.floor(Math.random() * 7)], 0, T.scale.length - 1);
        const m = T.scale[mel] + 12, d = SPB * (Math.random() < 0.3 ? 3.6 : 1.8);
        note(m, t, d, 'sine', T.melV, 3200); if (T.bell){ note(m + 12, t, d * 1.6, 'sine', T.melV * 0.3, 5000); note(m, t + SPB * 1.5, d, 'sine', T.melV * 0.35, 2400); }   // 海底：像回音的鈴聲
      }
      next += SPB; step++;
    }
  }
  function noiseHit(t, vol){ if (!noiseBuf){ noise(0.01, 0.0001, 1000); } if (!noiseBuf) return; const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 5000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + 0.06); }
  return {
    theme: () => THEMES[theme].name,
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
const lookFresh = !LS.get('tide.look', null);   /* 第一次玩才隨機挑衣服，之後固定（存起來） */
const look = LS.get('tide.look', { shirt: SHIRTS[Math.floor(Math.random()*SHIRTS.length)], hat: HATS[0] }); if (lookFresh) LS.set('tide.look', look);
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
  if (Dive.on && e.code === 'Space'){ e.preventDefault(); return; }
  if (e.code === 'KeyJ' && !e.repeat){ jump(); return; }
  if (e.code === 'Space' && !e.repeat && F.phase === 'idle' && !myBoat && nearestSpot().d > 1.7 && !nearShop() && !shoreSpot() && !nearDoor() && !nearExit() && !nearChair()){ e.preventDefault(); jump(); return; }
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
function boatWater(x, z){ if (Math.abs(x) > 85 || Math.abs(z) > 85) return false; { const e = mangE(x, z); if (e > -1.0 || (e > -4.6 && mudOut())) return false; } const i = terrainInfo(x, z); return i.water && i.h < -0.3 && !deckAt(x, z); }
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
  const id = waterSpotId(me.pos.x, me.pos.z);
  return Object.assign({}, SPOT_BY_ID[id], { pos: me.pos.clone(), dir: new THREE.Vector2(Math.sin(me.rot), Math.cos(me.rot)), shore: true, legendBoost: 1 });
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
function boatDiveSite(){ if (!myBoat) return null; const w = waterSpotId(me.pos.x, me.pos.z); return w === 'harbor' ? 'offshore' : (w === 'reef' || w === 'weir') ? 'reef' : null; }
/* 舊的 index.html 還在瀏覽器快取裡時沒有這顆按鈕：自己補上，不然整個遊戲會開不起來 */
(() => { let d = $('#boatDive'); if (!d){ const bb = $('#boatBtn'); d = document.createElement('button'); d.id = 'boatDive'; d.className = 'panel'; d.hidden = true; d.textContent = '🤿 下潛'; if (bb && bb.parentNode){ let row = bb.parentNode; if (row.id !== 'boatRow'){ row = document.createElement('div'); row.id = 'boatRow'; bb.parentNode.insertBefore(row, bb); row.appendChild(bb); } row.insertBefore(d, bb); } else document.body.appendChild(d); }
  d.addEventListener('click', () => { ensureAudio(); const ds = boatDiveSite(); if (ds) startDive(ds); }); })();
function updateBoatButton(){
  { const d = $('#boatDive'), show = !!(myBoat && !Ferry.on && F.phase === 'idle' && !Dive.on && boatDiveSite()); if (d.hidden === show) d.hidden = !show; }
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
  closeSheet(); if (Photo.on) exitPhoto(); if (Dive.on) endDive('', true);
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
const MAP_VIEW = 66;
// 世界地圖的區域（2026-11-04，每一區都參考台灣或世界上真實的地方；edge＝在地圖外面，要坐船去，畫在邊上）
const WORLD_REGIONS = [
  { label:'🏝️ 潮汐釣魚村', x:6, z:6 },
  { label:'🏔️ 山間湖泊與溪流', x:-30, z:4 },
  { label:'🌲 森林河流', x:22, z:36 },
  { label:'🏖️ 南方沙灘', x:42, z:-4 },
  { label:'🌿 紅樹林', x:56, z:16 },
  { label:'🪷 百年生態池', x:16.6, z:-36.4 },
  { label:'🌊 深海海域（坐船）', x:60, z:-36 },
  { label:'❄️ 北方冰封群島（找港口的阿海坐船）', edge:[0.5, 0.03] },
  { label:'🪸 珊瑚礁群島（走長橋過去）', edge:[0.13, 0.5] },
  { label:'🌋 遠洋神秘島（找港口的阿海坐船）', edge:[0.68, 0.97] },
  { label:'🌌 深海浮台（找港口的阿海坐船）', edge:[0.97, 0.3] },
];   // 地圖顯示 -58..58 公尺
function getMapImage(){
  if (mapImg) return mapImg;
  const N = 232, cv = document.createElement('canvas'); cv.width = cv.height = N; const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), c = [0, 0, 0];
  const wc = { 0: [47, 137, 199], 1: [79, 194, 207], 2: [107, 214, 176], 3: [79, 184, 212], 4: [127, 211, 234], 5: [122, 108, 78] };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const z = MAP_VIEW - (i + 0.5) / N * MAP_VIEW * 2, x = -MAP_VIEW + (j + 0.5) / N * MAP_VIEW * 2, info = terrainInfo(x, z), o = (j * N + i) * 4;   /* 地圖上面是北（世界的 -x）、右邊是東（-z） */
    let r, g, b; const me2 = mangE(x, z);
    if (me2 > 0){ r = 63; g = 107; b = 58; } else if (me2 > -MANG.mud && info.water){ r = 110; g = 92; b = 66; }   /* 紅樹林、泥灘 */
    else if (info.water){ const w = wc[info.region], k = 1 - Math.min(0.35, -info.h * 0.18); r = w[0] * k; g = w[1] * k; b = w[2] * k; }
    else { terrainColor(x, z, info, c); const sh = info.h > 0.05 ? clamp(0.95 + (terrainH(x + 0.6, z - 0.6) - info.h) * 0.5, 0.8, 1.1) : 1; r = c[0] * 255 * sh; g = c[1] * 255 * sh; b = c[2] * 255 * sh; }
    img.data[o] = r; img.data[o+1] = g; img.data[o+2] = b; img.data[o+3] = 255;
  }
  ctx.putImageData(img, 0, 0); return (mapImg = cv);
}
function renderMap(body){
  body.appendChild(el('p', 'sub', '走到新的地點就會解鎖。點地圖上的地點，或下面的按鈕，就能直接傳送過去。'));
  const wrap = el('div', 'mapwrap'); const cv = el('canvas', 'mapcv'); const S = 480; cv.width = cv.height = S; wrap.appendChild(cv); body.appendChild(wrap);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(getMapImage(), 0, 0, S, S);
  const toPx = (x, z) => [(-z + MAP_VIEW) / (MAP_VIEW * 2) * S, (x + MAP_VIEW) / (MAP_VIEW * 2) * S];   /* 上北下南、左西右東 */
  ctx.font = `bold 15px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = 'center';
  for (const tp of TRAVEL){
    const [px, py] = toPx(tp.x, tp.z), on = visited.has(tp.id);
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fillStyle = on ? tp.color : '#9fb3bf'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    const label = on ? tp.label : '？？？'; const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(24,51,74,.8)'; ctx.fillRect(px - w / 2, py - 32, w, 20); ctx.fillStyle = '#fff'; ctx.fillText(label, px, py - 17);
  }
  // 各區域的名字（照真實地方設計的世界地圖）、地圖外面要坐船去的地方畫箭頭、指北針
  { ctx.save(); ctx.textAlign = 'center'; ctx.font = `bold 13px ${getComputedStyle(document.body).fontFamily}`;
    const tag = (txt, px, py, bg) => { const w = ctx.measureText(txt).width + 12; ctx.fillStyle = bg || 'rgba(255,255,255,.82)'; ctx.fillRect(px - w / 2, py - 11, w, 20); ctx.fillStyle = bg ? '#fff' : '#18334a'; ctx.fillText(txt, px, py + 4); };
    for (const R of WORLD_REGIONS){ const [px, py] = R.edge ? R.edge.map(v => v * S) : toPx(R.x, R.z); tag(R.label, clamp(px, 70, S - 70), clamp(py, 14, S - 12), R.edge ? 'rgba(24,51,74,.78)' : null); }
    ctx.translate(S - 26, 30); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PALETTE.coral; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(6, 2); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#18334a'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('北', 0, 13); ctx.restore(); }
  for (const sp of secretSpots){ const [sx, sy] = toPx(sp.x, sp.z); if (sx < 0 || sy < 0 || sx > S || sy > S) continue; ctx.font = '20px sans-serif'; ctx.fillText('🤫', sx, sy + 7); }   // 只有自己看得到的祕密窩點
  const WS = worldSummary();   // 村民現在在哪裡（伺服器的資料）
  for (const w of WS){ const [px, py] = toPx(w.x, w.z); ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillText(w.icon, px, py + 6); ctx.font = `bold 11px ${getComputedStyle(document.body).fontFamily}`; ctx.fillStyle = '#18334a'; ctx.fillText(w.name, px, py + 23); }
  const [mx, my] = toPx(me.pos.x, me.pos.z);   // 你在這裡
  ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(Math.cos(me.rot), -Math.sin(me.rot)) + Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fillStyle = PALETTE.coral; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S, y = (e.clientY - r.top) / r.height * S;
    let best = null, bd = 30; for (const tp of TRAVEL){ const [px, py] = toPx(tp.x, tp.z), d = Math.hypot(px - x, py - y); if (d < bd){ bd = d; best = tp; } }
    if (!best) return; if (visited.has(best.id)) travelTo(best); else toast('還沒去過這裡，先走過去一次就能解鎖。');
  });
  const list = el('div', 'tplist');
  for (const tp of TRAVEL){ const on = visited.has(tp.id); const b = el('button', 'tpbtn' + (on ? '' : ' lock'), on ? tp.label : '？？？（還沒去過）'); b.disabled = !on; b.addEventListener('click', () => travelTo(tp)); list.appendChild(b); }
  body.appendChild(list);
  renderOcean(body);
  if (WS.length){ body.appendChild(el('div', 'dexhead', '🏘️ 村民現在在做什麼'));
    const ul = el('ul', 'wlist'); for (const w of WS){ const li = el('li', '', `${w.icon} ${w.name}：${w.text}`), m = (World.me || {})[w.id];
      li.appendChild(el('span', 'wme', m && m.talks ? `跟你：${m.score >= 60 ? '好朋友' : m.score >= 25 ? '朋友' : '認識'}（聊過 ${m.talks} 次${m.gifts ? `、收過你 ${m.gifts} 份禮物` : ''}）` : '跟你：還不認識'));
      const b = el('button', 'tbtn wgift', m && m.giftToday ? '今天送過了' : '🎁 送魚'); b.disabled = !!(m && m.giftToday);
      b.addEventListener('click', () => { if (!worldNear(w.id)){ toast(`走到${w.name}旁邊才能送喔`); return; } World.giftTo = w.id; curTab = 'wgift'; renderTab(); }); li.appendChild(b); ul.appendChild(li); }
    body.appendChild(ul);
    const R = (World.rel || []).slice().sort((a, b) => b.score - a.score); if (R.length){ body.appendChild(el('div', 'dexhead', '🤝 村民之間的關係')); const ur = el('ul', 'wlist old'); for (const r of R) ur.appendChild(el('li', '', `${WORLD_WHO[r.a]} ↔ ${WORLD_WHO[r.b]}：${r.label}（${r.score}）`)); body.appendChild(ur); }
    const L = (World.log || []).slice(0, 8); if (L.length){ const ul2 = el('ul', 'wlist old'); for (const l of L){ const pl = (World.places && World.places[l.place]) || {}, d = new Date(l.at), hh = d.toLocaleTimeString('zh-TW', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Taipei' });
      ul2.appendChild(el('li', '', `${hh}　${WORLD_WHO[l.npc] || l.npc}${l.why ? '（' + l.why + '）' : ''}→ 去${pl.name || ''}${(WORLD_ACT[l.act] || ['', ''])[1]}`)); } body.appendChild(ul2); } }
  else if (Cloud.on && !World.rows) loadWorld();
}

// 岸邊釣魚：不在發光圈裡也可以，只要面前（或旁邊）幾公尺內有水
function waterSpotId(x, z){
  if (inShrimpHall(x, z, 5)) return 'shrimp';
  if (Math.hypot(x - ISLE.x, z - ISLE.z) < 55) return 'isle';
  if (Math.hypot(x - FROST.x, z - FROST.z) < 50) return frostHole(x, z, 1) ? 'icelake' : 'icesea';
  if (Math.hypot(x - ABYSS.x, z - ABYSS.z) < 40) return 'abyss';
  if (Math.hypot(x - MYST.x, z - MYST.z) < 45) return 'mystic';
  const i = terrainInfo(x, z);
  if (!i.region && inMang(x, z)) return 'mangrove';
  if (!i.region && inReef(x, z)) return inWeir(x, z) ? 'weir' : 'reef';   /* 溪的出海口還是溪 */
  return i.region === 5 ? 'canal' : i.region === 1 ? 'river' : i.region === 2 ? 'creek' : i.region === 3 ? 'lake' : i.region === 4 ? 'pool' : (islandEdge(x, z) < -6 ? 'harbor' : 'sea');
}
const Shore = { x:1e9, z:1e9, r:0, at:0, res:null };
function shoreSpot(){
  const t = performance.now();
  if (Math.hypot(me.pos.x - Shore.x, me.pos.z - Shore.z) < 0.25 && Math.abs(lerpAngle(me.rot, Shore.r, 1) - me.rot) < 0.01 && t - Shore.at < 600) return Shore.res;
  Shore.x = me.pos.x; Shore.z = me.pos.z; Shore.r = me.rot; Shore.at = t; Shore.res = null;
  if (myBoat || mySeat) return null;
  { const h = Math.hypot(me.pos.x - FROST.lake.x, me.pos.z - FROST.lake.z) < FROST.lake.r + 1 && FROST.holes.find(h => Math.hypot(me.pos.x - h[0], me.pos.z - h[1]) < 2.2); if (h){ const dx = h[0] - me.pos.x, dz = h[1] - me.pos.z, L = Math.hypot(dx, dz) || 1; Shore.res = Object.assign({}, SPOT_BY_ID.icelake, { pos: me.pos.clone(), dir: new THREE.Vector2(dx / L, dz / L), shore: true, legendBoost: 1, hole: h }); return Shore.res; } }
  const dirs = [me.rot]; for (let k = 1; k <= 6; k++){ dirs.push(me.rot + k * 0.45); dirs.push(me.rot - k * 0.45); }
  for (const a of dirs){ const dx = Math.sin(a), dz = Math.cos(a);
    for (let d = 1.2; d <= 4.6; d += 0.55){ const px = me.pos.x + dx * d, pz = me.pos.z + dz * d;
      if (waterAt(px, pz) && waterAt(px + dx * 1.5, pz + dz * 1.5)){ const id = waterSpotId(px, pz), base = SPOT_BY_ID[id];
        Shore.res = Object.assign({}, base, { pos: me.pos.clone(), dir: new THREE.Vector2(dx, dz), shore: true, legendBoost: 1 }); return Shore.res; } } }
  return null;
}
function nearestSpot(){ let best = null, bd = 1e9; for (const s of SPOTS){ if (s.hidden) continue; const d = Math.hypot(me.pos.x - s.pos.x, me.pos.z - s.pos.z); if (d < bd){ bd = d; best = s; } } return { spot: best, d: bd }; }

function updatePlayer(dt){
  let ix = 0, iz = 0;
  if (!uiBlocked){
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += joy.x; iz += joy.z;
  }
  const L = Math.hypot(ix, iz); if (L > 1){ ix /= L; iz /= L; }
  const locked = F.phase === 'bite' || F.phase === 'reeling' || F.phase === 'landing';
  if (Dive.on){ updateDiveSwim(dt, ix, iz, L); return; }
  if (myBoat){ updateBoat(dt, ix, iz, L, locked); return; }
  if (mySeat){
    if (L > 0.08 && !locked) standUp();
    else { me.pos.x = mySeat.x; me.pos.z = mySeat.z; me.rot = lerpAngle(me.rot, mySeat.face, 1 - Math.exp(-10 * dt)); me.speed = 0; me.baseY = mySeat.y; Jump.gy = mySeat.y; return; }
  }
  let speed = 0;
  if (L > 0.08 && !locked){
    if (F.phase !== 'idle') cancelFishing('收竿了');
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix;
    const run = keys.ShiftLeft || keys.ShiftRight || L > 0.95;
    speed = (run ? 5.0 : 3.8) * Math.min(1, L) * (Jump.air > 0 ? 1.1 : 1) * (Mang.onMud ? 0.75 : 1) * (iAmGhost() ? 1.08 : 1);   // 鬼跑快一點點
    const nx = me.pos.x + mx / Math.max(1e-6, Math.hypot(mx, mz)) * speed * dt;
    const nz = me.pos.z + mz / Math.max(1e-6, Math.hypot(mx, mz)) * speed * dt;
    // 可以走上山坡，但太陡的崖爬不上去
    // 跳在空中時，只要腳比前面的地面高，就能跳上去
    const okStep = (ax, az, bx, bz) => { if (!walkable(bx, bz) || blocked(bx, bz, 0.35)) return false; { const db = deckAt(bx, bz); if (db){ const ga = groundHeight(ax, az); return db.y - ga < 0.7 || (Jump.air > 0.05 && db.y <= Jump.gy + Jump.air + 0.1); } }   /* 高高的堤防路只能從樓梯上去 */ const gb = groundHeight(bx, bz); if (Jump.air > 0.05 && gb <= Jump.gy + Jump.air + 0.1) return true; const dh = gb - groundHeight(ax, az), dl = Math.hypot(bx - ax, bz - az) || 1e-3; return dh / dl < 1.2; };
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
/* ---- 坐椅子：走到椅子旁邊按按鈕就能坐下，搖桿一動就站起來 ---- */
function allChairs(){ return CHAIRS.concat(isleChairs, CHAIRS_ROOM); }
function nearChair(){
  let best = null, bd = 1.1;
  for (const c of allChairs()){ const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z); if (d < bd && !customers.some(k => k.st === c && k.state !== 'out') && ![...peers.values()].some(p => p.fisher.sitting && Math.hypot(p.target.x - c.x, p.target.z - c.z) < 0.3)){ bd = d; best = c; } }
  return best;
}
function sitDown(c){ if (F.phase !== 'idle') return; mySeat = c; me.sitting = true; me.pos.x = c.x; me.pos.z = c.z; me.baseY = c.y; if (c.shrimp){ me.rot = c.face; cam.yaw = c.face + Math.PI + 0.6; cam.pitch = 0.55; cam.dist = 3.2; } pushPresence(true); }   /* 釣蝦場：坐下後鏡頭從背後看著池子 */
function standUp(){ if (!mySeat) return; if (F.phase !== 'idle' && F.phase !== 'result') cancelFishing(); const c = mySeat; mySeat = null; me.sitting = false; me.pos.x = c.x - Math.sin(c.face) * 0.7; me.pos.z = c.z - Math.cos(c.face) * 0.7; Jump.gy = groundHeight(me.pos.x, me.pos.z); pushPresence(true); }
/* ---- 跳躍 ---- */
const Jump = { vy:0, air:0, gy:0, land:0 };
function canJump(){ return !Dive.on && !uiBlocked && !myBoat && !Photo.on && F.phase === 'idle' && Jump.air <= 0 && Jump.land <= 0.05; }
function jump(){ if (mySeat){ standUp(); return; }
  if (!canJump()) return;
  ensureAudio();
  Jump.gy = me.baseY; Jump.vy = 7.6; Jump.air = 0.001;
  SFX.jump(); pushPresence(true);
}
function puff(x, y, z){ FX.emit(x, y + 0.05, z, 8, '#f3ead2', 0.6, 0.8, 0.45); }
function lerpAngle(a, b, k){ let d = ((b - a + Math.PI) % (Math.PI*2)); if (d < 0) d += Math.PI*2; return a + (d - Math.PI) * k; }

const reelCam = { k:0, pos:new THREE.Vector3(), look:new THREE.Vector3() };
const camLook = new THREE.Vector3();
function updateCamera(dt){ updateCamera2(dt); if (inHall()){ const S = SHRIMP, c = camera.position; c.x = clamp(c.x, S.x - S.w / 2 + 0.4, S.x + S.w / 2 - 0.4); c.z = clamp(c.z, S.z - S.d / 2 + 0.4, S.z + S.d / 2 - 0.4); c.y = clamp(c.y, S.y + 0.6, S.y + 4.1); camera.lookAt(camLook); } }   /* 被牆擋住拉回來以後要重新對準角色，不然手機上會一直抖 */
function updateCamera2(dt){
  // 拉魚的時候：鏡頭移到肩膀後面、靠近釣竿，看著魚的方向（像一般釣魚遊戲）
  const reelOn = F.phase === 'reeling' && !Photo.on;
  reelCam.k += ((reelOn ? 1 : 0) - reelCam.k) * Math.min(1, dt * (reelOn ? 3 : 4));
  if (reelCam.k > 0.01){
    const bx = me.bobPos.x - me.pos.x, bz = me.bobPos.z - me.pos.z, L = Math.hypot(bx, bz) || 1, dx = bx / L, dz = bz / L, rx = -dz, rz = dx;
    const want = reelCam.pos.set(me.pos.x - dx * 2.0 + rx * 1.25, me.baseY + 2.05, me.pos.z - dz * 2.0 + rz * 1.25);   // 右肩後上方，角色在畫面左下，不會擋住魚
    const look = reelCam.look.set(me.bobPos.x, F.boss && F.jump > 0 && F.leap ? 0.55 + F.leap.position.y * 0.6 : 0.55, me.bobPos.z);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), tg = tmpV.set(me.pos.x, me.baseY + 1.3, me.pos.z);
    const normal = new THREE.Vector3(tg.x + Math.sin(cam.yaw)*cp*cam.dist, Math.max(House.on ? ROOM_Y + 0.8 : Dive.on ? DIVE.y + 0.5 : 0.8, tg.y + sp*cam.dist), tg.z + Math.cos(cam.yaw)*cp*cam.dist);
    camera.position.lerp(normal.lerp(want, reelCam.k), 1 - Math.exp(-8 * dt));
    camera.lookAt(tg.lerp(look, reelCam.k)); camLook.copy(tg);
    if (camShake > 0.002){ camera.position.x += (Math.random() - 0.5) * camShake; camera.position.y += (Math.random() - 0.5) * camShake; camShake *= Math.pow(0.03, dt); }
    return;
  }
  const target = tmpV.set(me.pos.x, me.baseY + 1.3, me.pos.z);   // 用地面高度，不跟著走路的上下晃動（不然鏡頭會一直震）
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const want = new THREE.Vector3(target.x + Math.sin(cam.yaw)*cp*cam.dist, target.y + sp*cam.dist, target.z + Math.cos(cam.yaw)*cp*cam.dist);
  want.y = Dive.on ? clamp(want.y, diveBed(want.x, want.z) + 0.5, DIVE.y + DIVE.top - 0.3) : Math.max(want.y, House.on ? ROOM_Y + 0.8 : Photo.on ? 0.3 : 0.8);
  camera.position.lerp(want, 1 - Math.exp(-10 * dt));
  camera.lookAt(target); camLook.copy(target);
  if (camShake > 0.002){ camera.position.x += (Math.random() - 0.5) * camShake; camera.position.y += (Math.random() - 0.5) * camShake; camShake *= Math.pow(0.03, dt); }
}

/* ================= FISHING ================= */
const F = { phase:'idle', spot:null, charge:0, chargeT:0, waitUntil:0, nibbleAt:0, biteUntil:0, fish:null, weight:0, T:0.3, P:0.3, hold:false, surge:0, seed:0, castCharge:0 };
const bigMsg = $('#bigMsg');
let bigTimer = 0;
function flash(text, secs){ bigMsg.textContent = text; bigMsg.hidden = false; bigMsg.classList.toggle('long', [...String(text)].length > 9); document.body.classList.toggle('diving', !!(typeof Dive !== 'undefined' && Dive.on)); bigMsg.classList.remove('pop'); void bigMsg.offsetWidth; bigMsg.classList.add('pop'); clearTimeout(bigTimer); bigTimer = setTimeout(() => bigMsg.hidden = true, (secs || 1.2) * 1000); }

function actionDown(){
  if (uiBlocked) return;
  ensureAudio();
  const act = $('#act'); act.classList.add('down');
  if (Dive.on){ diveAction(); return; }
  if (F.phase === 'idle'){
    { const cr = nearCritter(); if (cr){ act.classList.remove('down'); grabCritter(cr); return; } }
   /* 紅樹林泥灘：徒手抓 */
    { const lt = nearLitter(); if (lt){ act.classList.remove('down'); pickLitter(lt); return; } }   /* 水圳：撿垃圾 */
    if (nearCage()){ act.classList.remove('down'); openSheet('cage'); return; }   /* 箱網 */
    if (nearSnorkel()){ act.classList.remove('down'); startDive('reef', { x: me.pos.x, z: me.pos.z }); return; }   /* 珊瑚礁島：從沙灘下水浮潛 */
    let spot;
    if (inHall() && mySeat && mySeat.shrimp){ spot = seatSpot(mySeat); }
    else if (myBoat) spot = boatSpot(); else { const ns = nearestSpot(); const sh0 = ns.d > 1.7 && !mySeat ? shoreSpot() : null; if (sh0 && !nearShop() && !(nearChair() && Math.hypot(me.pos.x - nearChair().x, me.pos.z - nearChair().z) < 0.9)){ ns.d = 0; ns.spot = sh0; } if (ns.d > 1.7){ const chN = !mySeat ? nearChair() : null; const sh = mySeat || (chN && Math.hypot(me.pos.x - chN.x, me.pos.z - chN.z) < 0.9) ? null : nearShop(); if (nearExit()){ act.classList.remove('down'); exitHouse(); } else if (nearDoor()){ act.classList.remove('down'); enterHouse(nearDoor()); } else if (sh){ act.classList.remove('down'); openShop(sh); } else if (mySeat){ standUp(); } else { const ch = nearChair(); if (ch) sitDown(ch); } return; } spot = ns.spot; }
    if (spot && spot.id === 'shrimp' && !shrimpLeft()){ act.classList.remove('down'); toast('🎫 要先跟櫃台的老闆阿忠買時段，才可以釣蝦'); openSheet('shrimp'); return; }
    F.spot = spot; F.phase = 'charging'; F.chargeT = 0;
    me.rot = Math.atan2(spot.dir.x, spot.dir.y); me.fishing = true; me.bobState = 'none';
  } else if (F.phase === 'waiting'){
    if (F.spot && F.spot.id === 'shrimp' && me.bobState === 'water' && Rig.rig !== 'lure'){
      const t = now();
      if (F.lastNib && t - F.lastNib < 0.6){ flash('太早了！蝦子被嚇跑了 🦐', 1.3); SFX.fail(); F.waitUntil = Math.max(F.waitUntil, t) + rand(2.5, 4.5); F.nibbleAt = t + 1.5; F.lastNib = 0; me.bend = 0.5; F.spooked = (F.spooked || 0) + 1; return; }
      cancelFishing('收竿了'); return;
    }
    if (Rig.rig === 'lure' && me.bobState === 'water'){
      // 路亞抽竿：假餌往回跳一下，魚比較快咬；拉到太近就收竿
      const dx = me.pos.x - me.bobPos.x, dz = me.pos.z - me.bobPos.z, d = Math.hypot(dx, dz);
      if (d < 2.2){ cancelFishing('收竿了'); return; }
      me.bobPos.x += dx / d * 0.55; me.bobPos.z += dz / d * 0.55; if (!waterAt(me.bobPos.x, me.bobPos.z)){ cancelFishing('收竿了'); return; }
      F.waitUntil -= 0.7; F.twitch = (F.twitch || 0) + 1; me.bend = 0.6; ripple(me.bobPos.x, me.bobPos.z); SFX.plop();
    } else cancelFishing('收竿了');
  } else if (F.phase === 'bite'){
    startReel(); F.hold = true;
  } else if (F.phase === 'reeling'){
    if (F.mash){ F.P += 0.045; F.mashHits++; camShake = Math.max(camShake, 0.06);
      const v = tmpV.set(me.bobPos.x, 0.45, me.bobPos.z).project(camera), d = document.createElement('div'); d.className = 'dmg crit'; d.textContent = '-' + Math.round(300 + Math.random() * 500); d.style.left = ((v.x + 1) / 2 * viewW() + Math.random() * 60 - 30) + 'px'; d.style.top = ((1 - v.y) / 2 * viewH() - 40) + 'px'; $('#dmgLayer').appendChild(d); setTimeout(() => d.remove(), 900);
      return; }
    F.hold = true;
  }
}
function actionUp(){
  $('#act').classList.remove('down');
  if (F.phase === 'charging') doCast();
  else if (F.phase === 'reeling') F.hold = false;
}
// 等魚的時間跟現實一樣有快有慢：大多 3～8 秒，偶爾一丟下去就咬，偶爾要等很久；清晨和黃昏魚口比較好（漲退潮、天氣在 envBonus 裡）
doCast.told = {};
function biteWait(c){
  const r = Math.random(); let w = r < 0.14 ? rand(0.9, 2.2) : r < 0.74 ? rand(2.5, 7.5) : r < 0.94 ? rand(7.5, 14) : rand(14, 24);
  const per = periodOf(gameHour()); w *= per === 'twilight' ? 0.75 : per === 'day' ? 1.08 : 1;
  return Math.max(0.8, w - c * 0.8);
}
function doCast(){
  const s = F.spot; const c = F.charge; F.castCharge = c;
  if (s && s.id !== 'shrimp' && s.id !== 'icelake' && !myBoat && !mySeat){ const rt0 = rodType(curRod()), d0 = (3 + c * 4.5) * (Rig.rig === 'lure' ? 1.25 : 1) * (rt0 === 'pole' ? 0.55 : rt0 === 'surf' ? 1.45 : rt0 === 'iso' ? 1.1 : 1), cp0 = castPoint(s.pos.x, s.pos.z, s.dir.x, s.dir.y, d0);
    if (castBlocked(s.pos.x, s.pos.z, cp0[0], cp0[1])){ SFX.fail(); flash('🚫 前面有陸地擋住，線拋不過去 — 換個方向再拋', 1.8); cancelFishing(); return; } }   /* 線會經過陸地（草岸、沙灘）就不讓拋 */
  { const fit = rodFit(s && s.id); if (fit === 'bad' && !doCast.told[s.id]){ doCast.told[s.id] = 1; const best = Object.entries(ROD_TYPES).find(([, T]) => T.fit && T.fit.includes(s.id)); setTimeout(() => toast(`${ROD_TYPES[rodType(curRod())].name}在這裡不太好用${best ? `，${s.short}比較適合用${best[1].icon}${best[1].name}（包包裡可以換）` : '，換成甩竿試試'}`), 900); } }
  if (liftHeight() > LIFT_H && !hasNet() && !doCast.netTold){ doCast.netTold = 1; setTimeout(() => toast(`🥅 這裡比水面高很多：1.5 公斤以上的魚沒有撈網會拉不上來（釣具店「🧰工具」有賣）`), 400); }
  F.buffAt = curBuff(); useBuffCast();
  // 用掉一個魚餌
  const bt = Rig.rig === 'lure' ? null : curBait(); F.baitUsed = bt;   // 路亞用假餌，不消耗魚餌
  if (bt){ if (!Cloud.on) cloudCall('use_bait', { p_bait: bt.id }); rec.bait[bt.id]--; if (rec.bait[bt.id] <= 0){ delete rec.bait[bt.id]; rec.baitOn = null; toast(`${bt.name}用完了，換回普通魚餌`); } saveRecLocal(); }
  const rt = rodType(curRod()), dist = s.id === 'shrimp' ? 1.4 + c * 1.6 : (3 + c * 4.5) * (Rig.rig === 'lure' ? 1.25 : 1) * (rt === 'pole' ? 0.55 : rt === 'surf' ? 1.45 : rt === 'iso' ? 1.1 : 1);   /* 手竿拋不遠、遠投竿拋很遠 */   /* 蝦竿很短，拋近近的 */
  const hole = s.id === 'icelake' ? (s.hole || FROST.holes.slice().sort((a, b) => Math.hypot(me.pos.x - a[0], me.pos.z - a[1]) - Math.hypot(me.pos.x - b[0], me.pos.z - b[1]))[0]) : null;   /* 冰洞：直接放進洞裡 */
  const cp = hole ? hole : castPoint(s.pos.x, s.pos.z, s.dir.x, s.dir.y, dist);
  const to = new THREE.Vector3(cp[0] + (hole ? 0 : rand(-0.3,0.3)), 0.12, cp[1] + (hole ? 0 : rand(-0.3,0.3)));
  const from = new THREE.Vector3(); me.av.tip.getWorldPosition(from);
  me.bobPos.copy(to); me.bobState = 'fly';
  me.flying = { from, to, t:0, delay:0.17, dur: 0.55 + c*0.25, h: 1.4 + c*1.4, done(){ SFX.plop(); } }; me.windup = 0; me.castT = 0;
  F.chumB = chumBonus(chumAt(to.x, to.z), s.id, secretAt(to.x, to.z));
  F.roll = null; F.rollWait = 0; F.pre = null;
  if (!Cloud.on){ let pf = pickFish(s, c); if (s.id === 'shrimp' && sevActive() && Math.random() < SEV_P) pf = FISH_BY_ID[Sev.ev.fish]; F.pre = pf; }   /* 沒連線：拋竿時就先決定（才能讓魚游過來） */
  if (Cloud.on){ const id = F.castId = (F.castId || 0) + 1; F.roll = 'pending';
    cloudCall('roll_fish', { p_spot: s.id, p_charge: +c.toFixed(3), p_x: +me.pos.x.toFixed(2), p_z: +me.pos.z.toFixed(2), p_rig: Rig.rig, p_line: Rig.line, p_bait: bt ? bt.id : null, p_chum: F.chumB ? F.chumB.src : null, p_boat: !!myBoat })
      .then(row => { if (F.castId !== id) return; F.roll = row && FISH_BY_ID[row.cast_fish] && row.cast_w != null ? { f: FISH_BY_ID[row.cast_fish], w: Number(row.cast_w), rs: row.cast_rs || null, sex: row.cast_sex || null, brood: !!row.cast_brood, gp: row.cast_gp || null } : 'fail'; }); }
  F.envB = envBonus(s.id);
  F.nest = nestNear(to.x, to.z); if (F.nest) setTimeout(() => toast('🐟 浮標落在吳郭魚的窩旁邊，守窩的公魚很兇，馬上就會咬！'), 700);
  F.phase = 'waiting'; F.waitUntil = now() + biteWait(c) * (F.nest ? 0.55 : 1) * (rodFit(s.id) ? ROD_FIT[rodFit(s.id)].bite : 1) * (s.id === 'shrimp' ? 0.75 : 1) * (s.id === 'mangrove' && Env.tide.lv < -0.35 ? 1.6 : 1) * (F.chumB ? F.chumB.wait : 1) * F.envB.bite * LINES[Rig.line].bite * (Rig.rig === 'bottom' ? 1.15 : 1); F.nibbleAt = now() + 1.2 + Math.random()*1.5;
  if (F.chumB) setTimeout(() => toast(`🍚 浮標落在${F.chumB.name}的窩點裡！`), 500);
  SFX.cast(); pushPresence(true);
}
function cancelFishing(msg){
  if (F.phase === 'reeling' && F.fish && F.fish.rs && F.rsTag && !F.rsDone && !rsInfo(F.rsTag).esc && Cloud.on && Cloud.sb) Cloud.sb.rpc('rs_escaped').then(() => {}, () => {});   /* 自己沒拉好讓牠跑了：伺服器也記一道叉叉 */
  F.rsDone = 0;
  reelCleanup(); F.phase = 'idle'; F.hold = false; me.fishing = false; me.bobState = 'none'; me.flying = null; me.dip = 0; me.bend = 0; me.windup = 0; me.castT = -1;
  if (msg && msg !== '收竿了') flash(msg);
  pushPresence(true);
}
const LEG_K = { harbor: 1.3, other: 0.35 };   /* 傳說魚：大概幾十分鐘到幾個小時才遇到一次（2026-11-04 調低） */
function pickFish(spot, charge){
  const list = (spot.fish || []).map(id => FISH_BY_ID[id]).filter(Boolean);
  const rod = curRod(), bait = F.baitUsed || null;   // 釣竿和這次拋竿用的魚餌會提高稀有魚機率
  const fb = F.buffAt || null, cb = F.phase === 'waiting' ? F.chumB : null, eb = envBonus(spot.id), tip = dailyTip(), rainy = WEATHERS[Env.wx].rain > 0, kr = rod.rare * (bait ? bait.rare : 1) * (fb && fb.rare || 1) * (cb ? cb.rare : 1) * eb.rare * LINES[Rig.line].rare, kl = rod.legend * (bait ? bait.legend : 1) * (fb && fb.legend || 1) * (cb ? cb.legend : 1) * eb.legend;
  const per = periodOf(gameHour());   // 有些魚只在特定時段常出現
  const rfit = rodFit(spot.id); const krFit = rfit ? ROD_FIT[rfit].rare : 1;   /* 專用竿用在對的地方 */
  const ring = spot.shore ? 1 : 1.3;   // 發光圈（好釣點）稀有魚、傳說魚比較多
  // 傳說魚：每個釣點的傳說魚加起來是固定的機率（不會因為種類多就特別常出現），外海比較高
  const nLeg = list.filter(f => f.rarity === '傳說' && !f.of).length,   /* 變種不算在傳說魚種類數裡 */ legK = (spot.id === 'harbor' ? LEG_K.harbor : LEG_K.other) / Math.max(1, nLeg);
  const rw = f => Rig.rig === 'lure' ? (LURE_FISH.has(f.id) ? 2.2 : 0.55) : Rig.rig === 'bottom' ? (BOTTOM_FISH.has(f.id) ? 2.2 : 0.65) : 1;
  const intel = spot.id === 'harbor' ? intelAt(Date.now()).ids : null;
  const mudK = f => spot.id !== 'mudflat' ? 1 : ((Rig.rig === 'bottom') === BOTTOM_FISH.has(f.id) ? 1 : 0);   /* 泥灘：抓招潮蟹就是蟹、抓彈塗魚就是魚 */
  const wildK = f => breedSeason() && WILD_BREED.has(f.id) ? 1.5 : 1;   /* 野外繁殖季 */
  const w = list.map(f => (f.w || 1) * rw(f) * mudK(f) * wildK(f) * (intel && intel.includes(f.id) ? 2.5 : 1) * (tip.spot === spot.id && tip.fish === f.id ? 2.5 : 1) * (rainy && RAIN_FISH.has(f.id) ? 2 : 1) * (SEASON_FISH.has(f.id) && f.rarity !== '傳說' ? 2 : 1) * (f.time ? (f.time === per ? 1.5 : 0.15) : 1) * (f.rarity === '常見' ? 1 : f.rarity === '稀有' ? 0.34 * (1 + charge*0.8) * kr * krFit * ring : 0.07 * (1 + charge*1.6) * (spot.legendBoost || 1) * kl * ring * legK));
  let r = Math.random() * w.reduce((a,b) => a+b, 0);
  for (let i = 0; i < list.length; i++){ r -= w[i]; if (r <= 0) return list[i]; }
  return list[0];
}
function startReel(){
  F.phase = 'reeling'; F.T = 0.35; F.P = 0.3; F.surge = 0; F.seed = Math.random()*10;
  F.S = 1; F.dir = 0; F.dirUntil = now() + rand(1.2, 2.2); F.lat = 0; F.jump = 0; F.maxDist = 4 + (F.castCharge || 0) * 6 + (BIG_FISH.has(F.fish.id) ? 6 : 0);
  if (F.leap){ scene.remove(F.leap); F.leap = null; }
  F.boss = (BIG_FISH.has(F.fish.id) || F.fish.rarity === '傳說') && !(F.spot && F.spot.id === 'shrimp'); F.mash = false; F.mashHits = 0; F.surf = 0; F.surfT = now() + rand(1.2, 2.5);
  F.bossScale = F.boss ? clamp(0.55 + Math.log10(Math.max(1, F.weight || 1)) * 0.6, 0.65, 3.4) : (BIG_FISH.has(F.fish.id) ? 0.7 : 0.55);
  try { F.leap = fishModel(F.fish, F.bossScale); if (F.fish.rs && F.rsTag) addScars(F.leap, rsInfo(F.rsTag).scars); F.leap.visible = false; scene.add(F.leap); } catch(e){ F.leap = null; }
  { const bb = $('#bossBar'); bb.hidden = !F.boss; if (F.boss){ bb.className = 'r-' + F.fish.rarity; $('#bbName').textContent = `？？？・${F.fish.rarity}`; $('#bbHp').style.width = '100%'; $('#bbPct').textContent = '100%';
    flash('⚠️ 巨大魚影！', 1.8); camShake = Math.max(camShake, 0.35); SFX.bite(); ripple(me.bobPos.x, me.bobPos.z, true); FX.emit(me.bobPos.x, 0.3, me.bobPos.z, 36, '#e8f7ff', 1.8, 3.2, 1.1); } }
  $('#mashFx').hidden = true;
  me.say('!', 'alert', 0.6);
  const shr = F.spot && F.spot.id === 'shrimp'; F.shr = shr;
  $('#fhName').textContent = rec.count[F.fish.id] ? `${F.fish.name}上鉤了！` : shr ? (F.fish.rarity === '傳說' ? '這隻蝦超有力！' : F.fish.rarity === '稀有' ? '好大的鉗子！' : '沒見過的蝦上鉤了！') : F.fish.rarity === '傳說' ? '超大的拉力！' : F.fish.rarity === '稀有' ? '好重的手感！' : '沒見過的魚上鉤了！';   /* 釣過的魚會直接說是什麼魚 */
  const rc = $('#fhRar'); rc.className = 'chip r-' + F.fish.rarity; rc.textContent = F.fish.rarity;
  $('#fishMark').className = 'r-' + F.fish.rarity; { const ic = $('#fmIco'); ic.textContent = ''; const cv = fishCanvas(F.fish, !!rec.count[F.fish.id], 40, 26); cv.className = 'fmpic'; ic.appendChild(cv); }   /* 拉魚時顯示這條魚的樣子（沒釣過的只有黑影） */ F.S0 = 1; F.dmgAcc = 0; F.dmgT = 0;
  pushPresence(true);
}
function reelCleanup(){ if (F.leap){ scene.remove(F.leap); F.leap = null; } const d = $('#fhDir'); if (d) d.hidden = true; $('#bossBar').hidden = true; $('#mashFx').hidden = true; F.mash = false; F.boss = false; camera.fov = 55; camera.updateProjectionMatrix(); }
/* ---- 來吃餌的魚：等魚的時候看得到牠從旁邊游過來、試探、咬下去（大魚不顯示）。沒釣過的魚只看得到黑影 ---- */
const BiteFish = { m:null, id:null, ang:0, k:0, shadowM:null };
function biteFishOf(){ if (F.phase === 'reeling') return F.fish; if (Rig.rig === 'bottom') return null; const f = F.roll && F.roll.f ? F.roll.f : F.pre; return f && !BIG_FISH.has(f.id) && !BOTTOM_FISH.has(f.id) ? f : null; }   /* 沉底釣、底棲魚在很深的地方吃餌，看不到牠游過來 */
function updateBiteFish(dt, t){
  const on = ((F.phase === 'waiting' || F.phase === 'bite') && me.bobState === 'water' && !me.flying || F.phase === 'reeling') && !Dive.on, f = on ? biteFishOf() : null;
  if (!f){ if (BiteFish.m){ scene.remove(BiteFish.m); BiteFish.m = null; BiteFish.id = null; } return; }
  if (BiteFish.id !== f.id){
    if (BiteFish.m) scene.remove(BiteFish.m);
    const w = F.roll && F.roll.f ? F.roll.w : (f.min + f.max) / 2, m = fishModel(f, clamp(0.42 + Math.log(1 + w) * 0.3, 0.42, 0.9));
    const mats = []; if (!rec.count[f.id]){ const sm = new THREE.MeshBasicMaterial({ color:'#0d2233', transparent:true, opacity:0, depthWrite:false }); mats.push([sm, 0.5]); m.traverse(o => { if (o.isMesh) o.material = sm; }); }
    else m.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0; o.material.depthWrite = false; mats.push([o.material, 0.75]); } });
    m.traverse(o => { if (o.isMesh){ o.castShadow = false; o.renderOrder = -1; } });   /* 先畫魚、再畫水面：看起來在水裡 */
    m.visible = false; scene.add(m); BiteFish.m = m; BiteFish.mats = mats; BiteFish.id = f.id; BiteFish.ang = Math.random() * Math.PI * 2; BiteFish.k = 0; BiteFish.fade = 0; BiteFish.showAt = t + rand(1.2, 3.5);   /* 等一下才游過來，不會一丟下去就出現 */ m.position.set(me.bobPos.x + Math.cos(BiteFish.ang) * 2.4, WATER_LEVEL - 0.06, me.bobPos.z + Math.sin(BiteFish.ang) * 2.4);
  }
  const m = BiteFish.m, b = me.bobPos, nib = F.lastNib && t - F.lastNib < 0.35, bite = F.phase === 'bite';
  if (F.phase === 'reeling'){   // 拉魚時：魚就在浮標底下掙扎，往外衝的方向擺頭
    if (!m.visible) m.visible = true; BiteFish.fade = Math.min(1, BiteFish.fade + dt * 1.5); for (const [mt, op] of BiteFish.mats) mt.opacity = op * BiteFish.fade;
    const dx = b.x - me.pos.x, dz = b.z - me.pos.z, ang = Math.atan2(-dz, dx), thr = Math.sin(t * 14) * 0.45 * (0.5 + (F.T || 0));
    m.position.set(b.x + Math.cos(ang) * 0.25, WATER_LEVEL - 0.12 + Math.sin(t * 9) * 0.04 + (F.jump > 0 ? 0.3 : 0), b.z - Math.sin(ang) * 0.25); m.rotation.y = ang + thr; m.rotation.z = Math.sin(t * 11) * 0.25; return; }
  if (t < BiteFish.showAt && !bite) return; if (!m.visible){ m.visible = true; }
  BiteFish.fade = Math.min(1, BiteFish.fade + dt * 0.6); for (const [mt, op] of BiteFish.mats) mt.opacity = op * BiteFish.fade;   // 從深處慢慢浮現
  // 慢慢靠近：一開始在 2.2 公尺外繞圈，越等越近；試探時衝過來碰一下；咬下去時頭頂著浮標
  BiteFish.k = Math.min(1, BiteFish.k + dt * 0.25); BiteFish.ang += dt * (bite ? 0 : 0.5);
  const r = bite ? 0.12 : nib ? 0.25 : 1.7 + (0.7 - 1.7) * BiteFish.k;
  const tx = b.x + Math.cos(BiteFish.ang) * r, tz = b.z + Math.sin(BiteFish.ang) * r;
  m.position.x += (tx - m.position.x) * Math.min(1, dt * (nib || bite ? 8 : 2)); m.position.z += (tz - m.position.z) * Math.min(1, dt * (nib || bite ? 8 : 2));
  m.position.y = (F.spot && F.spot.id === 'shrimp' ? WATER_LEVEL - 0.14 : WATER_LEVEL - 0.22 - (1 - BiteFish.fade) * 0.4) + (bite ? Math.sin(t * 20) * 0.02 : 0);
  m.rotation.y = Math.atan2(-(b.z - m.position.z), b.x - m.position.x) + (bite ? Math.sin(t * 18) * 0.25 : Math.sin(t * 3) * 0.1);
}
function updateFishing(dt, t){
  { const inf = F.phase === 'charging' || F.phase === 'reeling' || F.phase === 'landing'; if (inf !== updateFishing._inf){ updateFishing._inf = inf; document.body.classList.toggle('infish', inf); } }   // 拉魚時把下面的聊天列藏起來，不要擋到張力條
  const act = $('#act');
  if (F.phase === 'charging'){
    F.chargeT += dt; F.charge = 1 - Math.abs(((F.chargeT / 1.3) % 2) - 1);
    $('#chargeFill').style.width = (F.charge*100).toFixed(1) + '%';
    me.bend = F.charge * 0.25; me.windup += (0.8 - me.windup) * Math.min(1, dt * 6);   /* 蓄力時竿子往後舉一次就停住（不會跟著力量條一直上下） */
  }
  if (F.phase === 'waiting' && !me.flying){
    me.bend *= 0.9;
    const shrimpMode = F.spot && F.spot.id === 'shrimp';
    if (shrimpMode){
      // 釣蝦：蝦子會一直來試探（浮標輕輕點一下、抖一下），這時候拉就會把蝦嚇跑
      if (t > F.nibbleAt && t < F.waitUntil - 0.9){ F.nibK = rand(0.25, 0.55); F.lastNib = t; ripple(me.bobPos.x, me.bobPos.z); SFX.tick(); F.nibbleAt = t + 0.45 + Math.random() * 1.3; }
      me.dip = Math.max(me.dip * Math.pow(0.01, dt), F.nibK && t - F.lastNib < 0.25 ? F.nibK : 0); if (t - F.lastNib > 0.25) F.nibK = 0;
    } else {
    if (t > F.nibbleAt && t < F.waitUntil - 0.6){ me.dip = 0.35; F.lastNib = t; ripple(me.bobPos.x, me.bobPos.z); F.nibbleAt = t + 0.9 + Math.random()*1.6; }
    me.dip *= Math.pow(0.02, dt); }
    if (t > F.waitUntil && Cloud.on && F.roll === 'pending'){ F.waitUntil = t + 0.4; F.rollWait = (F.rollWait || 0) + 0.4; if (F.rollWait > 12){ cancelFishing(); flash('連不上伺服器，魚跑掉了', 1.4); } }
    else if (t > F.waitUntil && Cloud.on && (!F.roll || F.roll === 'fail')){ cancelFishing(); flash('連不上伺服器，魚跑掉了', 1.4); }
    else if (t > F.waitUntil){
      // 連上雲端時，上鉤的魚由伺服器決定（拋竿時就抽好了，見 roll_fish）；沒連線時在這裡抽
      if (F.roll && F.roll.f){ F.fish = F.roll.f; F.weight = F.roll.w; F.sex = F.roll.sex; F.brood = F.roll.brood; F.gp = F.roll.gp; F.rsTag = F.roll.rs; F.rsEscAt = F.rsTag && rsInfo(F.rsTag).esc ? rand(0.45, 0.85) : 0; }
      else { F.fish = F.pre || pickFish(F.spot, F.castCharge); const wild = breedSeason() && WILD_BREED.has(F.fish.id); F.weight = +(F.fish.min + (F.fish.max - F.fish.min) * Math.pow(Math.random(), wild ? 2.4 : 1.7)).toFixed(2); F.sex = Math.random() < 0.5 ? 'M' : 'F'; F.brood = F.sex === 'F' && wild && BROOD.has(F.fish.id) && Math.random() < 0.3; F.gp = isGuppy(F.fish.id) ? gpyWild() : null; }
      F.phase = 'bite'; F.biteAt = t; F.drift = 0;
      if (F.spot && F.spot.id === 'shrimp'){ F.biteUntil = t + (F.fish.rarity === '傳說' ? 1.5 : F.fish.rarity === '稀有' ? 1.7 : 1.9) + curSrod().win; ripple(me.bobPos.x, me.bobPos.z); }   // 釣蝦場：沒有「!」，浮標會慢慢沉下去
      else { rareBurst(); F.biteUntil = t + (F.fish.rarity === '傳說' ? 0.8 : F.fish.rarity === '稀有' ? 0.95 : 1.15); me.say('!', 'alert', 1); SFX.bite(); ripple(me.bobPos.x, me.bobPos.z, true); }
      pushPresence(true);
    }
  }
  if (F.phase === 'bite'){
    if (F.spot && F.spot.id === 'shrimp'){ const k = clamp((t - F.biteAt) / 0.5, 0, 1); me.dip = 0.3 + k * 1.1 + Math.sin(t * 24) * 0.06 * k; me.bobJit = 0.04 * k; if (!F.drift) F.drift = Math.random() < 0.5 ? -1 : 1; const nx = me.bobPos.x + F.drift * 0.25 * dt; if (inShrimpPool(nx, me.bobPos.z)) me.bobPos.x = nx; }   // 慢慢沉到底、一直抖、往旁邊跑   // 慢慢沉到底、一直抖
    else me.dip = 0.9 + Math.sin(t*30)*0.1;
    if (t > F.biteUntil){ me.dip = 0; F.phase = 'waiting'; F.waitUntil = t + rand(2.5, 5.5); F.nibbleAt = t + 1; flash(F.spot && F.spot.id === 'shrimp' ? '太慢了，蝦子把餌吃掉跑了' : '魚跑掉了', 1); SFX.fail(); pushPresence(true); }
  }
  if (F.phase === 'reeling'){
    // 像一般釣魚遊戲：魚有體力，會往左右衝（往反方向拉最有效），稀有的魚會跳出水面（跳的時候要放開）
    const p = F.fish.power, rod = curRod(), fb = curBuff(), big = BIG_FISH.has(F.fish.id);
    if (t > F.dirUntil && !F.mash){
      const nd = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      if (nd !== F.dir && nd !== 0){ const d = $('#fhDir'); d.hidden = false; d.className = nd < 0 ? 'l' : 'r'; d.innerHTML = nd < 0 ? '<span>往右拉</span><b>➡</b>' : '<b>⬅</b><span>往左拉</span>'; }
      else if (nd === 0) $('#fhDir').hidden = true;
      F.dir = nd; F.dirUntil = t + rand(1.3, 2.8) * (1.2 - p * 0.4);
    }
    if (F.jump > 0){
      const u0 = 1 - Math.max(0, F.jump) / 1.0; F.jump -= dt * (F.boss && u0 > 0.32 && u0 < 0.68 ? 0.35 : 1);   // 大魚跳到最高的時候畫面放慢
      const u = 1 - Math.max(0, F.jump) / 1.0, hgt = (F.boss ? 1.3 + F.bossScale * 1.1 : big ? 2.6 : 1.5) * Math.sin(u * Math.PI);
      if (F.leap){ F.leap.visible = F.jump > 0; F.leap.position.set(me.bobPos.x, 0.1 + hgt, me.bobPos.z); F.leap.rotation.set(0, Math.atan2(me.pos.x - me.bobPos.x, me.pos.z - me.bobPos.z) + Math.PI / 2, (0.5 - u) * 2.2); }
      if (F.jump <= 0){ ripple(me.bobPos.x, me.bobPos.z, true); FX.emit(me.bobPos.x, 0.3, me.bobPos.z, F.boss ? 48 : 16, '#e8f7ff', F.boss ? 2.2 : 1.2, F.boss ? 3.6 : 2.2, 0.9); if (F.boss){ camShake = Math.max(camShake, 0.45); SFX.plop(); ripple(me.bobPos.x + 0.8, me.bobPos.z, true); ripple(me.bobPos.x - 0.7, me.bobPos.z + 0.5, true); } $('#fhT').textContent = ''; }
    } else if (F.boss && !F.mash && F.surf > 0){
      // 大魚浮上水面翻身、拖出水痕
      F.surf -= dt; const lr = Math.sign(F.lat || 1), hd = Math.atan2(me.pos.x - me.bobPos.x, me.pos.z - me.bobPos.z) + lr * Math.PI / 2;
      if (F.leap){ F.leap.visible = F.surf > 0; F.leap.position.set(me.bobPos.x, -0.12 * F.bossScale + Math.sin(t * 5) * 0.04, me.bobPos.z); F.leap.rotation.set(0, hd + Math.PI / 2, Math.sin(t * 3) * 0.15); }
      if (Math.random() < dt * 14) FX.emit(me.bobPos.x + (Math.random() - 0.5) * F.bossScale, 0.2, me.bobPos.z + (Math.random() - 0.5) * F.bossScale, 2, '#ffffff', 0.6, 1.4, 0.7);
      if (Math.random() < dt * 6) ripple(me.bobPos.x + (Math.random() - 0.5) * F.bossScale, me.bobPos.z + (Math.random() - 0.5) * F.bossScale, true);
      if (F.surf <= 0 && F.leap) F.leap.visible = false;
    } else if (F.boss && !F.mash && t > F.surfT && F.S > 0.12){
      F.surf = rand(1.4, 2.4); F.surfT = t + rand(3.5, 6.5); ripple(me.bobPos.x, me.bobPos.z, true); FX.emit(me.bobPos.x, 0.3, me.bobPos.z, 20, '#e8f7ff', 1.3, 2.4, 0.9);
    } else if ((F.fish.rarity !== '常見' || big) && F.S > 0.15 && !F.mash && Math.random() < dt * (F.boss ? 0.16 : 0.11) * p){
      F.jump = 1.0; ripple(me.bobPos.x, me.bobPos.z, true); FX.emit(me.bobPos.x, 0.3, me.bobPos.z, 20, '#e8f7ff', 1.4, 2.6, 0.9); SFX.plop(); camShake = Math.max(camShake, big ? 0.18 : 0.08);
    }
    let pull = p * (0.55 + 0.45 * Math.sin(t*2.3 + F.seed) * Math.sin(t*0.7 + F.seed*2)) * (0.35 + 0.65 * F.S);
    if (F.surge > 0){ F.surge -= dt; pull += 0.55 * p; } else if (Math.random() < dt * 0.3 * p){ F.surge = rand(0.4, 0.9); }
    let steer = 0; if (!uiBlocked){ steer = joy.x + ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0); } steer = clamp(steer, -1, 1);
    const counter = F.dir !== 0 && steer * F.dir < -0.35, wrong = F.dir !== 0 && steer * F.dir > 0.35;
    if (F.dir !== 0) pull += (counter ? -0.18 : wrong ? 0.45 : 0.22) * p;
    const inZone = F.T > 0.3 && F.T < 0.8;
    if (F.boss && !F.mash && F.S < 0.1){ F.mash = true; F.hold = false; $('#mashFx').hidden = false; SFX.bite(); F.dir = 0; $('#fhDir').hidden = true; if (F.leap) F.leap.visible = false; }
    if (F.mash){
      // 最後關頭：狂按按鈕把大魚拉上來（不會斷線，但魚會慢慢往回拉）
      F.T += (0.55 - F.T) * Math.min(1, dt * 3); F.P -= 0.05 * dt; F.S = Math.max(0, F.S - dt * 0.01);
      $('#mashFx').style.setProperty('--m', (F.mashHits % 2).toString());
    } else if (F.hold){
      F.reelT = (F.reelT || 0) + dt; if (F.reelT > 0.09){ F.reelT = 0; SFX.reel(); }
      F.T += (0.42 + pull*0.9) * dt * (F.spot && F.spot.id === 'shrimp' ? curSrod().ten : rod.tension) * (fb && fb.tension || 1) * (F.jump > 0 ? 2.4 : 1) * (F.envB ? F.envB.tension : 1) * LINES[Rig.line].tension;
      F.P += (0.24 + (inZone ? 0.1 : 0)) * (1.15 - p*0.35) * dt * rod.reel * (fb && fb.reel || 1) * (0.7 + 0.6 * (1 - F.S));
    } else { F.T -= 0.75 * dt; F.T += pull * 0.12 * dt; F.P -= (0.03 + pull*0.03) * dt; }
    F.T = Math.max(0, F.T);
    F.S = Math.max(0, F.S - dt * (0.04 + (F.hold && inZone ? 0.09 : 0) + (counter ? 0.12 : 0)) / (0.6 + p * 0.8));
    me.bend = clamp(F.T, 0, 1); me.dip = 0.5 + pull*0.4; fxReel(dt);
    // 浮標：越收越近，魚往哪邊衝就往哪邊偏
    F.lat += (F.dir * 1.8 * (counter ? 0.35 : 1) - F.lat) * Math.min(1, dt * 1.6);
    const s = F.spot; const dist = 1.4 + (1 - F.P) * (2 + F.castCharge*4.5), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let tx = s.pos.x + s.dir.x*dist + rx * F.lat + Math.sin(t*3 + F.seed)*0.4*(1-F.P), tz = s.pos.z + s.dir.y*dist + rz * F.lat + Math.cos(t*2.4)*0.4*(1-F.P);
    // 浮標一定要在水裡：左右偏到岸上就不偏，太靠近岸邊就停在最近的水面（不會被拉到陸地上）
    if (!waterAt(tx, tz)){ tx = s.pos.x + s.dir.x*dist; tz = s.pos.z + s.dir.y*dist; F.lat *= 0.5;
      if (!waterAt(tx, tz)){ let ok = false; for (let k = 0.3; k < 6; k += 0.3){ const ax = s.pos.x + s.dir.x*(dist + k), az = s.pos.z + s.dir.y*(dist + k); if (waterAt(ax, az)){ tx = ax; tz = az; ok = true; break; } } if (!ok){ tx = me.bobPos.x; tz = me.bobPos.z; } } }
    me.bobPos.x += (tx - me.bobPos.x) * Math.min(1, dt*3); me.bobPos.z += (tz - me.bobPos.z) * Math.min(1, dt*3);
    if (Math.random() < dt * (4 + Math.abs(F.dir) * 4)) ripple(me.bobPos.x, me.bobPos.z);
    // 畫面
    const T = clamp(F.T, 0, 1), arc = $('#tArc');
    arc.style.strokeDashoffset = (339.3 * (1 - T)).toFixed(1); arc.style.stroke = T > 0.8 ? '#f05a4a' : T > 0.62 ? '#f3b33d' : T < 0.3 ? '#8fb7d6' : '#3fbf9d';
    $('#tRing').classList.toggle('hot', T > 0.8);
    $('#hpFill').style.width = (F.S * 100).toFixed(1) + '%';
    $('#fhDist').textContent = ((1 - clamp(F.P, 0, 1)) * F.maxDist + 0.5).toFixed(1) + ' m';
    $('#fhT').textContent = F.shr ? (T > 0.8 ? '太用力了，蝦子快鬆鉗了！放開！' : T < 0.3 ? '太鬆了，慢慢拉' : F.S < 0.25 ? '蝦子沒力氣了，拉上來！' : '很好，慢慢拉，保持在綠色') : F.jump > 0 ? '🐟 跳起來了！快放開！' : T > 0.8 ? '線快斷了！放開！' : counter ? '👍 反方向拉，魚越來越累了' : wrong ? '⚠️ 方向拉錯了！' : T < 0.3 ? '太鬆了，按住拉' : F.S < 0.25 ? '魚沒力氣了，一口氣拉上來！' : '很好，保持在綠色';
    $('#fhT').className = 'fh-hint' + (F.jump > 0 || T > 0.8 || wrong ? ' warn' : counter ? ' good' : '');
    // ---- 跟著魚走的標記：體力條、魚的圖示、距離；收線時跳出傷害數字 ----
    { const v = tmpV.set(me.bobPos.x, 0.45, me.bobPos.z).project(camera), mk = $('#fishMark');
      const sx = (v.x + 1) / 2 * viewW(), sy = (1 - v.y) / 2 * viewH(), sxC = clamp(sx, 90, viewW() - 90), syC = clamp(sy, 120, viewH() - 150);
      mk.style.transform = `translate(${sxC.toFixed(0)}px, ${syC.toFixed(0)}px)`;
      $('#fmHp').style.width = (F.S * 100).toFixed(1) + '%';
      if (F.boss){ $('#bbHp').style.width = (F.S * 100).toFixed(1) + '%'; $('#bbPct').textContent = Math.ceil(F.S * 100) + '%'; mk.classList.add('boss'); } else mk.classList.remove('boss');
      { const want = F.boss && F.jump > 0 ? 44 : F.mash ? 50 : 55; if (Math.abs(camera.fov - want) > 0.05){ camera.fov += (want - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); } }
      $('#fmDist').textContent = ((1 - clamp(F.P, 0, 1)) * F.maxDist + 0.5).toFixed(1) + 'm';
      const warn = F.mash ? '' : F.jump > 0 ? '跳起來了！放開！' : T > 0.8 ? '張力太高！' : wrong ? '方向錯了！' : F.S < 0.25 ? '快拉上來！' : '';
      const fw = $('#fmWarn'); if (fw.textContent !== warn) fw.textContent = warn; fw.className = 'fm-warn' + (warn ? ' on' : '') + (F.S < 0.25 && T <= 0.8 && !F.jump && !wrong ? ' good' : '');
      const dir = $('#fhDir'); if (!dir.hidden){ dir.style.left = (sxC + (F.dir < 0 ? -110 : 110)) + 'px'; dir.style.top = (syC - 10) + 'px'; }
      mk.classList.toggle('hot', T > 0.8);
      // 傷害數字
      F.dmgAcc = (F.dmgAcc || 0) + (F.S0 != null ? Math.max(0, F.S0 - F.S) : 0); F.S0 = F.S; F.dmgT = (F.dmgT || 0) + dt;
      if (F.dmgT > 0.35 && F.dmgAcc > 0.004){ const hp = Math.round(800 + F.fish.power * 2200 + (BIG_FISH.has(F.fish.id) ? 3000 : 0)), n = Math.max(1, Math.round(F.dmgAcc * hp));
        const d = document.createElement('div'); d.className = 'dmg' + (counter ? ' crit' : ''); d.textContent = '-' + n; d.style.left = (sxC + 40 + Math.random() * 40) + 'px'; d.style.top = (syC - 30 - Math.random() * 20) + 'px'; $('#dmgLayer').appendChild(d); setTimeout(() => d.remove(), 900);
        F.dmgAcc = 0; F.dmgT = 0; }
      // 下面的張力條
      $('#tbFill').style.width = (T * 100).toFixed(1) + '%'; $('#tenBar').classList.toggle('hot', T > 0.8); $('#tenBar').classList.toggle('low', T < 0.3);
    }
    if (F.rsEscAt && F.fish.rs && F.P >= F.rsEscAt){ SFX.fail(); camShake = Math.max(camShake, 0.5); F.rsDone = 1; flash(`🦈 ${F.fish.name}甩頭掙脫了！牠身上又多了一道叉叉`, 2.4); cancelFishing(); }
    else if (F.T >= 1){ SFX.fail(); flash(F.spot && F.spot.id === 'shrimp' ? '太用力了，蝦子鬆鉗掉回池子裡 🦐' : '線斷了！', 1.4); cancelFishing(); }
    else if (F.P <= 0){ SFX.fail(); flash('魚掙脫了', 1.4); cancelFishing(); }
    else if (F.P >= 1){ landFish(); }
  }
  // HUD + button
  $('#chargeHud').hidden = F.phase !== 'charging';
  { const cb = $('#chumBtn'), show = !Dive.on && !!myChums().length && !!chumSpot(); if (cb.hidden === show) cb.hidden = !show; if (!show && !$('#chumPick')?.hidden) { const pk = $('#chumPick'); if (pk && F.phase !== 'idle') pk.hidden = true; } }
  $('#fishHud').hidden = true; { const on = F.phase === 'reeling'; $('#fishMark').hidden = !on; $('#tenBar').hidden = !on; if (!on){ F.S0 = null; } } $('#tRing').classList.toggle('on', F.phase === 'reeling'); if (F.phase !== 'reeling') $('#fhDir').hidden = true;
  let label, sub = '', cls = '';
  const near = myBoat ? { spot: boatSpot(), d: 0 } : nearestSpot();
  if (Dive.on){ const l = diveNearLoot(), tg = !l && diveFacing(); label = l ? (l.kind === 'chest' ? '打開寶箱' : l.kind === 'pearl' ? '撿珍珠' : '撿貝殼') : tg ? '📷 拍照' : '潛水中'; sub = l ? '' : tg ? tg.f.name + ((rec.photos || []).includes(tg.f.id) ? '・拍過了' : '・新的！') : '靠近魚可以拍照'; cls = l || tg ? 'shop' : 'idle'; }
  else if (F.phase === 'idle'){ const bt = curBait(); const chNear = !mySeat && near.d >= 1.7 ? nearChair() : null, sh = near.d >= 1.7 && !mySeat && !(chNear && Math.hypot(me.pos.x - chNear.x, me.pos.z - chNear.z) < 0.9) ? nearShop() : null;
    const shoreS = near.d >= 1.7 && !mySeat && !sh && !(chNear && Math.hypot(me.pos.x - chNear.x, me.pos.z - chNear.z) < 0.9) ? shoreSpot() : null;
    const crN = nearCritter();
    const ltN = !crN && nearLitter();
    if (crN){ label = '抓！'; sub = crN.kind === 'crab' ? '🦀 招潮蟹' : '🐟 彈塗魚'; cls = 'bite'; }
    else if (ltN){ label = '撿起來'; sub = `${ltN.T.icon} ${ltN.T.name}・💙+1`; cls = 'shop'; }
    else if (nearSnorkel()){ label = '浮潛'; sub = hasDive('dive_suit') ? '🤿 下水看珊瑚礁' : '🤿 要先買潛水裝備'; cls = 'shop'; }
    else if (nearCage()){ label = '箱網'; sub = `🐟 ${(rec.cage || []).length}/${CAGE.max} 條${rec.cageFed === taipeiDate() ? '' : '・還沒餵'}`; cls = 'shop'; }
    else if (near.d < 1.7 || shoreS){ label = '拋竿'; const fb = curBuff(); sub = (Rig.rig !== 'float' ? RIGS[Rig.rig].icon + ' ' : '') + (bt && Rig.rig !== 'lure' ? `${bt.name} ×${rec.bait[bt.id]}` : fb ? `${RECIPES[fb.r].icon} 加成 ×${fb.left}` : near.d < 1.7 && !myBoat ? '✨ 好釣點' : shoreS ? SPOT_BY_ID[shoreS.id].short + '・岸邊' : isTouch ? '按住蓄力' : '按住空白鍵'); }
    else if (sh){ label = sh.label; sub = sh.mode === 'tailor' ? '👗 逛衣服' : sh.mode === 'mu' ? '🪑 逛家具' : sh.mode === 'fu' ? '🐟 今日收購' : sh.mode === 'gang' ? '⚓ 每週限定手作' : sh.mode === 'news' ? '📰 看今天的村報' : sh.mode === 'cai' ? '🎨 逛畫廊' : sh.mode === 'market' ? '🐟 買賣魚' : sh.mode === 'shrimpdoor' ? '🦐 進去釣蝦' : sh.mode === 'shrimpexit' ? '回到村子' : sh.mode === 'shrimpdesk' ? '🎫 跟老闆買' : sh.id === 'grill' ? '免費烤蝦' : sh.mode === 'ferry' ? '🚤 渡船' : sh.mode === 'quest' ? '📜 任務' : sh.mode === 'sell' ? '賣魚' : sh.mode === 'cook' ? (waitingCustomers().length ? '🔔 客人點餐' : '做料理') : '買釣具'; cls = 'shop'; }
    else if (nearExit()){ label = '出去'; sub = '離開房子'; cls = 'shop'; }
    else if (nearDoor()){ label = '進屋'; sub = ISLE_ITEMS[nearDoor().it.t].name; cls = 'shop'; }
    else if (mySeat){ label = '站起來'; sub = '坐著休息中'; cls = 'shop'; }
    else if (chNear){ label = '坐下'; sub = '休息一下'; cls = 'shop'; }
    else { label = '走到釣點'; cls = 'idle'; } }
  else if (F.phase === 'charging'){ label = '放開'; sub = '拋出去'; }
  else if ((F.phase === 'waiting' || F.phase === 'bite') && F.spot && F.spot.id === 'shrimp' && Rig.rig !== 'lure'){ label = '提竿'; sub = '浮標整個沉下去才拉'; cls = ''; }
  else if (F.phase === 'waiting'){ label = Rig.rig === 'lure' ? '抽竿' : '等待中'; sub = Rig.rig === 'lure' ? '點一下讓假餌動・搖桿收竿' : '點一下收竿'; cls = 'idle'; }
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
    // 只顯示釣點名字；這裡有什麼魚到圖鑑看就好
    $('.s', card).hidden = true; $('.fl', card).hidden = true;
  }
  if (!showCard) card._s = null;
  card.hidden = !showCard;
}
// ---- 拔魚（城市水圳）：站在比水面高很多的地方（堤防路），魚要從水面整條「拔」上來。小魚直接拉；大魚太重，沒有撈網硬拔線會斷 ----
const LIFT_H = 1.6, LIFT_KG = 1.5, NET = { id:'tool_net', name:'撈網', icon:'🥅', price:800, desc:'長柄的撈網。在高高的堤防、岸壁上釣到大魚（超過 1.5 公斤）時，要用撈網從水面撈起來，不然硬拔線會斷。' };
function hasNet(){ return (rec.owned || []).includes(NET.id); }
function liftHeight(){ return myBoat || mySeat ? 0 : groundHeight(me.pos.x, me.pos.z) - WATER_LEVEL; }
function landFish(){
  if (liftHeight() > LIFT_H && F.weight > LIFT_KG && !hasNet() && !F.fish.rs){   /* 太高、魚太重、沒有撈網：拔到一半線斷掉，魚掉回水裡 */
    reelCleanup(); F.phase = 'landing'; F.hold = false; me.bobState = 'none'; me.dip = 0; me.bend = 0.9;
    const f = F.fish, w = F.weight, from = me.bobPos.clone(); from.y = 0.1; const fm = fishModel(f, clamp(0.5 + Math.log(1 + w) * 0.35, 0.5, 1.8)); fm.position.copy(from); scene.add(fm);
    const mid = new THREE.Vector3(from.x + (me.pos.x - from.x) * 0.25, from.y + liftHeight() * 0.55, from.z + (me.pos.z - from.z) * 0.25);
    jumpers.push({ m: fm, from, to: mid, t: 0 }); SFX.splash(true);
    setTimeout(() => { SFX.fail(); camShake = Math.max(camShake, 0.3); ripple(from.x, from.z, true); fm.visible = false; me.bend = 0; flash(`線斷了！${esc(f.name)}（${fmtKg(w)}）太重了，從這麼高硬拔拉不上來 — 去釣具店「🧰工具」買${NET.icon}撈網，或到南岸草坡下面的低岸釣`, 3.4); cancelFishing(); }, 650);
    return; }
  if (liftHeight() > LIFT_H && F.weight > LIFT_KG){ flash(`${NET.icon} 放下撈網，把魚撈上來！`, 1.2);   /* 撈網：長柄網子伸到水面，把魚兜起來一起拉上來 */
    const ng = new THREE.Group(), rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 20), mat('#3a3a3a', 0.6)); rim.rotation.x = Math.PI / 2; ng.add(rim);
    const bag = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.55, 12, 1, true), mat('#4a7a8a', 0.8, { transparent:true, opacity:0.55, side:THREE.DoubleSide, wireframe:true })); bag.rotation.x = Math.PI; bag.position.y = -0.27; ng.add(bag);
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1, 6), mat('#c8b070', 0.6)); poleM.geometry.translate(0, 0.5, 0); ng.add(poleM); ng.userData.pole = poleM;
    const from = me.bobPos.clone(); from.y = WATER_LEVEL + 0.05; ng.position.copy(from); scene.add(ng); jumpers.push({ m: ng, from, to: new THREE.Vector3(me.pos.x, me.pos.y + 2.2, me.pos.z), t: 0, end: 0.92, net: true }); }
  reelCleanup(); SFX.splash(BIG_FISH.has(F.fish.id) || F.fish.rarity === '傳說');
  F.phase = 'landing'; F.hold = false; me.bobState = 'none'; me.dip = 0; me.bend = 0.2;
  const f = F.fish, w = F.weight;
  const from = me.bobPos.clone(); from.y = 0.1;
  const fm = fishModel(f, clamp(0.5 + Math.log(1 + w) * 0.35, 0.5, 1.8)); fm.position.copy(from); scene.add(fm);
  const to = new THREE.Vector3(me.pos.x, me.pos.y + 2.4, me.pos.z);
  jumpers.push({ m: fm, from, to, t: 0, end: 0.92 });
  ripple(from.x, from.z, true); SFX.catch(); fxLand(f, from);
  setTimeout(() => { me.fishing = false; F.phase = 'result'; const res = recordCatch(f, w); if (f.sev) sevCaughtByMe(f, w); if (f.rs && F.rsTag) RS.mine.add(String(F.rsTag).split(':')[0]); showCatch(f, w, res); announceCatch(f, w, F.spot.id); pushPresence(true); me.holdFish(f, w, 5); }, 900);
}
const jumpers = [];
function updateJumpers(dt, t){
  for (let i = jumpers.length - 1; i >= 0; i--){
    const j = jumpers[i]; j.t += dt;
    const k = Math.min(1, j.t / 0.9);
    j.m.position.lerpVectors(j.from, j.to, k); j.m.position.y += Math.sin(k*Math.PI) * (j.net ? 0.3 : 1.6);
    if (j.net){ const p = j.m.userData.pole, dx = me.pos.x - j.m.position.x, dy = me.pos.y + 1.3 - j.m.position.y, dz = me.pos.z - j.m.position.z, L = Math.hypot(dx, dy, dz) || 1; p.scale.y = L; p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)); }
    else { j.m.rotation.z = Math.sin(t*14) * 0.4; j.m.rotation.y += dt * 4; }
    if (j.t > (j.end || 2.6)){ scene.remove(j.m); jumpers.splice(i, 1); }   /* end：落到手上就收掉（手上會換成 holdFish 的魚） */
  }
}

/* ================= RECORDS / COLLECTION ================= */
/* ================= ISLAND 2.0：玩家島（自由擺放、房子可以進去、看得到別人的島、按讚）================= */
// 價格、大小要跟伺服器 supabase/012_island_v2.sql 的 _isle_item 一樣
const ISLE_ITEMS = {
  cabin:   { name:'小木屋',   price:1500, rad:2.6, house:true, roof:'#d896c3', w:3.0 },
  beach:   { name:'海邊小屋', price:3000, rad:2.9, house:true, roof:'#5fb6e3', w:3.6, awning:'#2f89c7' },
  tea:     { name:'和風茶屋', price:5500, rad:3.0, house:true, roof:'#4a4f5a', w:3.4, wall:'#f1e6cf' },
  villa:   { name:'大別墅',   price:8000, rad:3.6, house:true, roof:'#ec8b68', w:4.4, scale:1.3 },
  mansion: { name:'大宅（自己設計格局）', price:12000, rad:4.6, house:true, roof:'#5a6f8a', w:4.4, scale:1.7, wall:'#f4efe4' },
  flower:  { name:'花圃', price:200, rad:0.9 },   bench:  { name:'長椅', price:150, rad:0.9 },   lamp:   { name:'路燈', price:250, rad:0.35 },
  palm:    { name:'椰子樹', price:400, rad:0.6 }, pond:   { name:'小魚池', price:1200, rad:1.5 }, flag:   { name:'旗子', price:300, rad:0.3 },
  fence:   { name:'木圍籬', price:80, rad:0.9 },  tree:   { name:'圓圓樹', price:300, rad:1.1 }, rock:   { name:'石頭', price:100, rad:0.7 },
  mailbox: { name:'信箱', price:200, rad:0.35 },  picnic: { name:'野餐桌', price:600, rad:1.4 }, parasol:{ name:'遮陽傘', price:350, rad:1.0 },
  campfire:{ name:'營火', price:450, rad:0.8 },   statue: { name:'金魚雕像', price:2000, rad:0.9 }, swing: { name:'鞦韆', price:900, rad:1.3 },
  bush:    { name:'小樹叢', price:120, rad:0.7 }, lantern:{ name:'石燈籠', price:180, rad:0.4 }, boat:  { name:'小木船', price:1500, rad:1.6 },
};
const HOUSES = Object.fromEntries(Object.entries(ISLE_ITEMS).filter(([, v]) => v.house));
const ISLE_MAX = 60, ISLE_HOUSE_MAX = 6;
// 舊版（固定格子）的島轉成新版（跟伺服器的 _isle_upgrade 一樣）
const OLD_HS = [[-6.5, -4.5], [6.5, -4.5], [0, -9]], OLD_DS = [[-3, 3], [3, 3], [-8, 2], [8, 2], [-5, 9], [5, 9], [-10.5, -2], [10.5, -2], [0, 4.5], [-2, 10.5]];
function cleanIsland(o){
  if (o && String(o.v) !== '2' && (o.h || o.d)){ const items = []; let n = 0;
    for (const [k, v] of Object.entries(o.h || {})){ const p = OLD_HS[+k]; if (p && ISLE_ITEMS[v]) items.push({ id:++n, t:v, x:p[0], z:p[1], r:+Math.atan2(-p[0], -p[1]).toFixed(2) }); }
    for (const [k, v] of Object.entries(o.d || {})){ const p = OLD_DS[+k]; if (p && ISLE_ITEMS[v]) items.push({ id:++n, t:v, x:p[0], z:p[1], r:+(Math.atan2(-p[0], -p[1]) + Math.PI).toFixed(2) }); }
    o = { v:2, items }; }
  const items = (o && Array.isArray(o.items) ? o.items : []).filter(it => it && ISLE_ITEMS[it.t] && isFinite(+it.x) && isFinite(+it.z)).slice(0, ISLE_MAX)
    .map(it => { const o = { id: Math.floor(+it.id) || 0, t: it.t, x: +it.x, z: +it.z, r: +it.r || 0 }; if (ISLE_ITEMS[it.t].house){ if (LAYOUTS[it.lay]) o.lay = it.lay; const f = cleanFurn(it.f); if (f) o.f = f; if (it.t === 'mansion'){ o.lay = 'custom'; if (it.cl && typeof it.cl === 'object') o.cl = it.cl; if (!o.f) o.f = []; } } return o; });   /* 房子的格局、家具（034） */
  return { v:2, items };
}
// 跟伺服器一樣的位置檢查
function isleCheck(items, type, x, z, skipId){
  const me = ISLE_ITEMS[type]; if (!me) return '沒有這種東西';
  if (Math.hypot(x, z) > ISLE.r - me.rad * 0.6 - 0.6) return '放在島外面了';
  if (Math.abs(x) < 1.4 + me.rad * 0.7 && z > 17) return '會擋住碼頭的路';
  for (const o of items){ if (o.id === skipId) continue; const it = ISLE_ITEMS[o.t]; if (it && Math.hypot(o.x - x, o.z - z) < (it.rad + me.rad) * 0.8) return '跟別的東西疊在一起了'; }
  return null;
}
var onIsle = null;            // { owner, name, layout, likes, tank, show } 現在在誰的島上
let isleGroup = null, isleCols = [], isleChairs = [], isleDoors = [];
// ---- 島本體（草地、沙灘、碼頭的路、石頭、歡迎牌）----
function isleBaseMesh(g, R, withSign){
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.2, R + 3.8, 0.8, 56), mat('#f2d69a', 0.95)); sand.position.y = ISLE.y - 0.72; sand.receiveShadow = true; g.add(sand);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 1.6, 0.5, 56), mat('#86c26a', 0.95)); grass.position.y = ISLE.y - 0.25; grass.receiveShadow = true; g.add(grass);
  const path = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), mat('#dcbf7d')); path.rotation.x = -Math.PI / 2; path.position.y = ISLE.y + 0.01; path.receiveShadow = true; g.add(path);
  const lane = box([1.6, 0.02, R - 2], '#dcbf7d', [0, ISLE.y + 0.012, (R + 2) / 2]); lane.castShadow = false; g.add(lane);
  let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 10; i++){ const a = rr() * Math.PI * 2, r = R + 0.6 + rr() * 1.4; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rr() * 0.5, 0), mat('#b7b2a4', 0.95, { flatShading:true })); rk.position.set(Math.cos(a) * r, ISLE.y - 0.25, Math.sin(a) * r); rk.castShadow = true; g.add(rk); }
  if (withSign){
    g.add(box([0.14, 1.4, 0.14], PALETTE.wood, [1.6, ISLE.y + 0.7, R - 1.2]));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; isleSignCtx = cv.getContext('2d'); isleSignTex = new THREE.CanvasTexture(cv); isleSignTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: isleSignTex })); sign.position.set(1.6, ISLE.y + 1.35, R - 1.1); g.add(sign);
  }
}
function isleBase(){ const g = new THREE.Group(); g.position.set(ISLE.x, 0, ISLE.z); scene.add(g); isleBaseMesh(g, ISLE.r, true); }
let isleSignCtx = null, isleSignTex = null;
function drawIsleSign(name){
  if (!isleSignCtx) return; const c = isleSignCtx;
  c.fillStyle = '#8c5d3b'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff4d6'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 30px sans-serif'; c.fillText(String(name).slice(0, 8), 128, 34); c.font = '24px sans-serif'; c.fillText('的小島', 128, 70); isleSignTex.needsUpdate = true;
}
// ---- 每一種東西的 3D 模型（原點在地面中心，正面朝 +z）----
function itemMesh(type, opts){
  opts = opts || {}; const T = ISLE_ITEMS[type], g = new THREE.Group();
  if (T.house){
    if (!houseBuilder) return g; const n0 = colliders.length;
    const h = houseBuilder(0, 0, T.roof, T.w, 0, Object.assign({}, T.awning ? { awning:T.awning } : {}, T.wall ? { wall:T.wall } : {}));
    colliders.length = n0; scene.remove(h); h.position.set(0, 0, 0); if (T.scale) h.scale.setScalar(T.scale); g.add(h);
    if (type === 'tea'){ for (const sx of [-1, 1]){ const ln = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#f6efe2', 0.6, { emissive:'#ffb070', emissiveIntensity:0.5 })); ln.scale.y = 1.3; ln.position.set(sx * 1.2, 1.9, 1.45); g.add(ln); g.userData.lamp = ln; } }
    return g;
  }
  const B = (sz, c, p) => { const b = box(sz, c, p); g.add(b); return b; };
  switch (type){
    case 'flower': { B([1.6, 0.25, 1.0], '#8c5d3b', [0, 0.12, 0]); const cols = ['#f17b6d', '#ffd36a', '#f5a5d8', '#b9a4ff', '#ffffff']; for (let i = 0; i < 10; i++){ const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(cols[i % 5], 0.6)); f.position.set(-0.6 + (i % 5) * 0.3, 0.38, i < 5 ? -0.2 : 0.2); g.add(f); } break; }
    case 'bench': { B([1.8, 0.1, 0.5], PALETTE.wood, [0, 0.45, 0]); B([1.8, 0.45, 0.08], PALETTE.wood, [0, 0.72, -0.24]); for (const dx of [-0.75, 0.75]) B([0.1, 0.42, 0.42], '#6e4a2f', [dx, 0.22, 0]); break; }
    case 'lamp': { B([0.12, 2.2, 0.12], PALETTE.ink, [0, 1.1, 0]); const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color:'#fff3c4', emissive:'#ffd36a', emissiveIntensity:1.2 })); l.position.y = 2.3; g.add(l); g.userData.lamp = l; break; }
    case 'palm': { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3.2, 8), mat('#9b6a42')); tr.position.y = 1.6; tr.rotation.z = 0.12; tr.castShadow = true; g.add(tr);
      for (let i = 0; i < 6; i++){ const lf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.8, 4), mat('#5d9c55', 0.85, { flatShading:true })); lf.geometry.translate(0, 0.9, 0); lf.position.set(0.2, 3.1, 0); lf.rotation.set(0, i / 6 * Math.PI * 2, 1.25); lf.castShadow = true; g.add(lf); } break; }
    case 'pond': { const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 6, 24), mat('#b7b2a4', 0.9)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.15; g.add(rim);
      const w = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), mat('#4fc2cf', 0.2, { emissive:'#2f89c7', emissiveIntensity:0.2 })); w.rotation.x = -Math.PI / 2; w.position.y = 0.12; g.add(w);
      if (!opts.lite) for (let i = 0; i < 3; i++){ const f = fishModel(FISH_BY_ID[['koi', 'goby', 'kuhua'][i]], 0.22); f.position.set(Math.cos(i * 2.1) * 0.5, 0.06, Math.sin(i * 2.1) * 0.5); g.add(f); g.userData.fish = (g.userData.fish || []).concat([f]); } break; }
    case 'flag': { B([0.08, 3, 0.08], '#e9e2cf', [0, 1.5, 0]); g.userData.flag = B([1.0, 0.6, 0.04], PALETTE.coral, [0.54, 2.6, 0]); break; }
    case 'fence': { for (const x of [-0.85, 0, 0.85]) B([0.12, 0.8, 0.12], PALETTE.wood, [x, 0.4, 0]); for (const y of [0.32, 0.62]) B([1.82, 0.08, 0.06], '#c79a6b', [0, y, 0]); break; }
    case 'tree': { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8), mat('#8c5d3b')); tr.position.y = 0.8; tr.castShadow = true; g.add(tr);
      for (const [x, y, z, r] of [[0, 2.0, 0, 0.95], [0.5, 1.7, 0.2, 0.65], [-0.45, 1.75, -0.15, 0.7], [0.1, 2.55, -0.1, 0.6]]){ const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat('#6fae52', 0.85, { flatShading:true })); b.position.set(x, y, z); b.castShadow = true; g.add(b); } break; }
    case 'rock': { for (const [x, z, r] of [[0, 0, 0.55], [0.45, 0.25, 0.32], [-0.35, -0.2, 0.28]]){ const k = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat('#a9a499', 0.95, { flatShading:true })); k.position.set(x, r * 0.7, z); k.castShadow = true; g.add(k); } break; }
    case 'mailbox': { B([0.1, 1.0, 0.1], PALETTE.wood, [0, 0.5, 0]); B([0.36, 0.3, 0.5], '#2f89c7', [0, 1.12, 0]); B([0.04, 0.22, 0.12], '#e8473a', [0.2, 1.25, -0.1]); break; }
    case 'picnic': { B([1.6, 0.08, 0.8], '#c79a6b', [0, 0.72, 0]); for (const sx of [-0.65, 0.65]) B([0.08, 0.7, 0.7], '#8c5d3b', [sx, 0.36, 0]); for (const sz of [-0.75, 0.75]){ B([1.6, 0.07, 0.3], '#c79a6b', [0, 0.42, sz]); for (const sx of [-0.65, 0.65]) B([0.07, 0.4, 0.07], '#8c5d3b', [sx, 0.2, sz]); } B([0.5, 0.02, 0.5], '#e8473a', [0, 0.77, 0]); break; }
    case 'parasol': { B([0.06, 2.3, 0.06], '#f6efe2', [0, 1.15, 0]); const c = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8, 1, true), mat('#f17b6d', 0.75, { side:THREE.DoubleSide, flatShading:true })); c.position.y = 2.3; c.castShadow = true; g.add(c); const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), mat('#ffffff', 0.6)); tb.position.y = 0.7; g.add(tb); B([0.08, 0.7, 0.08], '#4c4c4c', [0, 0.35, 0.0]); break; }
    case 'campfire': { for (let i = 0; i < 5; i++){ const lg = box([0.12, 0.12, 0.8], '#6e4a2f', [0, 0.08, 0]); lg.rotation.y = i / 5 * Math.PI; g.add(lg); } for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; const k = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), mat('#8a857a', 0.95)); k.position.set(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5); g.add(k); }
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 6), new THREE.MeshStandardMaterial({ color:'#ffb040', emissive:'#ff7a1a', emissiveIntensity:1.6, transparent:true, opacity:0.9 })); fl.position.y = 0.45; g.add(fl); g.userData.fire = fl; break; }
    case 'statue': { B([0.9, 0.5, 0.9], '#d8d2c4', [0, 0.25, 0]); B([0.7, 0.12, 0.7], '#c9c2b2', [0, 0.56, 0]); if (!opts.lite){ const f = fishModel(FISH_BY_ID.koi, 0.9); f.position.y = 1.15; f.rotation.z = 0.6; f.traverse(o => { if (o.isMesh){ o.material = mat('#f2c14e', 0.25, { metalness:0.75, emissive:'#7a5a10', emissiveIntensity:0.25 }); } }); g.add(f); } break; }
    case 'swing': { for (const sx of [-1, 1]) for (const sz of [-1, 1]){ const p = box([0.1, 2.3, 0.1], '#8c5d3b', [sx * 0.95, 1.1, sz * 0.35]); p.rotation.x = -sz * 0.15; g.add(p); } B([2.1, 0.12, 0.12], '#8c5d3b', [0, 2.2, 0]); const sw = new THREE.Group(); sw.position.y = 2.15; g.add(sw); for (const sx of [-0.3, 0.3]){ const r = box([0.03, 1.6, 0.03], '#e9e2cf', [sx, -0.8, 0]); sw.add(r); } sw.add(box([0.75, 0.06, 0.32], '#e8473a', [0, -1.62, 0])); g.userData.swing = sw; break; }
    case 'bush': { for (const [x, z, r] of [[0, 0, 0.5], [0.4, 0.15, 0.35], [-0.35, 0.1, 0.38]]){ const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat('#5d9c55', 0.85, { flatShading:true })); b.position.set(x, r * 0.8, z); b.castShadow = true; g.add(b); } break; }
    case 'lantern': { B([0.5, 0.15, 0.5], '#b7b2a4', [0, 0.08, 0]); B([0.18, 0.6, 0.18], '#b7b2a4', [0, 0.45, 0]); const lt = box([0.4, 0.32, 0.4], '#fff3c4', [0, 0.9, 0], new THREE.MeshStandardMaterial({ color:'#fff3c4', emissive:'#ffd36a', emissiveIntensity:0.9 })); g.add(lt); g.userData.lamp = lt; const rf = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.25, 4), mat('#9a958a', 0.9)); rf.rotation.y = Math.PI / 4; rf.position.y = 1.2; g.add(rf); break; }
    case 'boat': { const b = makeBoatMesh('#c98b55'); b.position.y = 0.15; b.rotation.z = 0.08; g.add(b); break; }
  }
  return g;
}
function itemDoor(it){ const T = ISLE_ITEMS[it.t], d = 1.25 * (T.scale || 1) + 0.7, c = Math.cos(it.r), s = Math.sin(it.r); return { x: ISLE.x + it.x + s * d, z: ISLE.z + it.z + c * d, face: it.r + Math.PI, it }; }
function placeItemInGroup(group, it, withCols){
  const T = ISLE_ITEMS[it.t], g = itemMesh(it.t, { lite: !withCols }); g.position.set(ISLE.x + it.x, ISLE.y, ISLE.z + it.z); g.rotation.y = it.r; g.userData.item = it; group.add(g);
  if (!withCols) return g;
  if (T.house){ const c = Math.cos(it.r), s = Math.sin(it.r), w = T.w * (T.scale || 1), d = 2.5 * (T.scale || 1); addBoxCol(ISLE.x + it.x, ISLE.z + it.z, Math.abs(c) * w + Math.abs(s) * d, Math.abs(s) * w + Math.abs(c) * d); isleDoors.push(itemDoor(it)); }
  else if (it.t === 'bench' || it.t === 'picnic' || it.t === 'swing'){
    const c = Math.cos(it.r), s = Math.sin(it.r), seat = (lx, lz, face) => isleChairs.push({ x: ISLE.x + it.x + c * lx + s * lz, z: ISLE.z + it.z - s * lx + c * lz, face: it.r + face, y: ISLE.y + (it.t === 'swing' ? 0.1 : 0.02), isle: true });
    if (it.t === 'bench'){ seat(-0.45, 0.05, 0); seat(0.45, 0.05, 0); } else if (it.t === 'picnic'){ seat(-0.4, -0.78, 0); seat(0.4, -0.78, 0); seat(-0.4, 0.78, Math.PI); seat(0.4, 0.78, Math.PI); addCircleCol(ISLE.x + it.x, ISLE.z + it.z, 0.5); } else seat(0, 0, 0);
  } else if (it.t === 'fence'){ const c = Math.cos(it.r), s = Math.sin(it.r); addBoxCol(ISLE.x + it.x, ISLE.z + it.z, Math.abs(c) * 1.9 + Math.abs(s) * 0.2, Math.abs(s) * 1.9 + Math.abs(c) * 0.2); }
  else if (it.t !== 'flower') addCircleCol(ISLE.x + it.x, ISLE.z + it.z, T.rad * 0.7);
  return g;
}
function buildIsle(layout, ownerName){
  if (!isleSignCtx) isleBase();
  if (isleGroup){ scene.remove(isleGroup); }
  for (const c of isleCols){ const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } isleCols = [];
  isleGroup = new THREE.Group(); scene.add(isleGroup); drawIsleSign(ownerName || '我'); if (mySeat && mySeat.isle) standUp(); isleChairs = []; isleDoors = [];
  const L = cleanIsland(layout), n0 = colliders.length;
  for (const it of L.items) placeItemInGroup(isleGroup, it, true);
  isleCols = colliders.slice(n0);
  isleGroup.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
}
// ---- 北方冰封群島的樣子（第一次走近才蓋，手機比較省）：雪島、結冰的湖和冰洞、冰釣帳篷、雪松、雪屋、雪人、流冰、海豹、一直下的小雪 ----
const Frost = { built:false, snow:null, floes:[], seals:[] };
function buildFrost(){
  Frost.built = true; const F0 = FROST, g = new THREE.Group(); g.position.set(F0.x, 0, F0.z); scene.add(g); Frost.g = g; const R = F0.r, L = F0.lake, lx = L.x - F0.x, lz = L.z - F0.z;
  let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.2, R + 3.8, 0.8, 56), mat('#d8e4ec', 0.9)); sh.position.y = F0.y - 0.72; g.add(sh); }
  { const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(lx, -lz, L.r, 0, Math.PI * 2, true); shape.holes.push(hole);   /* 雪地中間挖一個湖 */
    const eg = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 40 }); eg.rotateX(-Math.PI / 2); const top = new THREE.Mesh(eg, mat('#f6f9fc', 0.85)); top.position.y = F0.y - 0.5; top.receiveShadow = true; g.add(top);
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 1.6, 0.5, 56, 1, true), mat('#e8f0f6', 0.9)); sk.position.y = F0.y - 0.25; g.add(sk); }
  // 結冰的湖：冰面上有幾個鑿好的洞（洞裡看得到水）
  { const shape = new THREE.Shape(); shape.absarc(0, 0, L.r + 0.05, 0, Math.PI * 2, false); for (const h of F0.holes){ const p = new THREE.Path(); p.absarc(h[0] - L.x, -(h[1] - L.z), 0.42, 0, Math.PI * 2, true); shape.holes.push(p); }
    const ig = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 36 }); ig.rotateX(-Math.PI / 2); const ice = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ color:'#bfe3f2', roughness:0.18, metalness:0.05, transparent:true, opacity:0.92 })); ice.position.set(lx, L.y - 0.06, lz); ice.receiveShadow = true; g.add(ice);
    const bank = new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r, 0.6, 40, 1, true), mat('#9fb8c8', 0.9, { side: THREE.BackSide })); bank.position.set(lx, L.y - 0.3, lz); g.add(bank);
    for (let i = 0; i < 26; i++){ const a = rr() * 6.28, r = rr() * L.r * 0.9; const c = new THREE.Mesh(new THREE.CircleGeometry(0.3 + rr() * 0.9, 7), new THREE.MeshBasicMaterial({ color:'#e8f6fc', transparent:true, opacity:0.35 })); c.rotation.x = -Math.PI / 2; c.position.set(lx + Math.cos(a) * r, L.y + 0.005, lz + Math.sin(a) * r); if (!frostHole(F0.x + c.position.x, F0.z + c.position.z, 1)) g.add(c); }   /* 冰上的白色霜花 */
    for (const h of F0.holes){ const hx = h[0] - F0.x, hz = h[1] - F0.z; const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 6, 18), mat('#e8f4fa', 0.5)); rim.rotation.x = Math.PI / 2; rim.position.set(hx, L.y, hz); g.add(rim);
      for (let k = 0; k < 4; k++){ const a = rr() * 6.28; g.add(box([0.12 + rr() * 0.15, 0.06, 0.1 + rr() * 0.12], '#dff2fa', [hx + Math.cos(a) * 0.62, L.y + 0.03, hz + Math.sin(a) * 0.62])); } } }
  // 冰釣帳篷（兩頂）、小板凳
  for (const [i, h] of [[0, F0.holes[1]], [1, F0.holes[3]]]){ const tg = new THREE.Group(), c = ['#e8473a', '#2f89c7'][i]; const tent = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 4, 1, true), mat(c, 0.8, { side: THREE.DoubleSide })); tent.position.y = 0.95; tent.rotation.y = Math.PI / 4; tg.add(tent);
    tg.position.set(h[0] - F0.x + (i ? -1.6 : 1.6), L.y, h[1] - F0.z + 0.8); g.add(tg); addCircleCol(h[0] + (i ? -1.6 : 1.6), h[1] + 0.8, 0.9); }
  // 雪松
  const tree = (x, z, s) => { const tg = new THREE.Group(); tg.add(box([0.22 * s, 0.6 * s, 0.22 * s], '#5a4030', [0, 0.3 * s, 0])); for (let k = 0; k < 3; k++){ const c = new THREE.Mesh(new THREE.ConeGeometry((1.15 - k * 0.3) * s, 1.2 * s, 8), mat('#2f5a48', 0.9)); c.position.y = (0.9 + k * 0.7) * s; tg.add(c); const sn = new THREE.Mesh(new THREE.ConeGeometry((0.85 - k * 0.24) * s, 0.5 * s, 8), mat('#f6fafc', 0.8)); sn.position.y = (1.3 + k * 0.7) * s; tg.add(sn); }
    tg.position.set(x, F0.y, z); g.add(tg); addCircleCol(F0.x + x, F0.z + z, 0.45 * s); };
  for (let i = 0; i < 46; i++){ const a = rr() * Math.PI * 2, r = 4 + rr() * (R - 6), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - lx, z - lz) < L.r + 2.2 || (x > 6 && Math.abs(z) < 3.2) || (x < -R + 7 && Math.abs(z) < 4)) continue; tree(x, z, 0.8 + rr() * 0.7); }
  // 雪屋
  { const ig = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f2f8fc', 0.6)); ig.position.set(-6, F0.y, 8); g.add(ig); const en = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12, 1, false, 0, Math.PI), mat('#eaf4fa', 0.6)); en.rotation.set(0, 0, Math.PI / 2); en.rotation.order = 'ZYX'; en.position.set(-6, F0.y, 9.8); en.rotation.y = Math.PI / 2; g.add(en);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12, 0, Math.PI), mat('#2b3f5a', 0.9)); door.position.set(-6, F0.y + 0.01, 10.42); g.add(door); addCircleCol(F0.x - 6, F0.z + 8, 1.7); }
  // 雪人
  for (const [x, z, ry] of [[9, -6, 0.6], [3, 11, -0.4], [-10, -9, 2.4]]){ const sg = new THREE.Group(), w = mat('#fbfdff', 0.6); for (const [r, y] of [[0.45, 0.4], [0.33, 1.0], [0.24, 1.45]]){ const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), w); b.position.y = y; sg.add(b); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mat('#ff8a30', 0.6)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.47, 0.3); sg.add(nose); for (const ex of [-0.08, 0.08]) sg.add(box([0.04, 0.04, 0.02], '#18334a', [ex, 1.55, 0.22]));
    sg.add(box([0.5, 0.08, 0.1], '#e8473a', [0, 1.22, 0.06])); sg.position.set(x, F0.y, z); sg.rotation.y = ry; g.add(sg); addCircleCol(F0.x + x, F0.z + z, 0.45); }
  // 碼頭（東邊，阿海的船停在這裡）、招牌
  { const x0 = F0.x + R - 0.6, x1 = F0.dock[0] + 6; addDeck((x0 + x1) / 2, F0.dock[1], x1 - x0, 2.6, 0.38); const dk = box([x1 - x0, 0.12, 2.6], '#8c6a4a', [(x0 + x1) / 2 - F0.x, 0.32, F0.dock[1] - F0.z]); g.add(dk);
    for (let x = x0; x <= x1; x += 2) for (const sz of [-1.2, 1.2]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), mat('#5a4030')); p.position.set(x - F0.x, -0.2, F0.dock[1] - F0.z + sz); g.add(p); }
    const boat = makeBoatMesh('#2f89c7'); boat.position.set(x1 - 1.2 - F0.x, 0, F0.dock[1] - F0.z + 2.4); boat.rotation.y = Math.PI / 2; g.add(boat);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#2b4a6a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#f6fafc'; c.fillRect(8, 8, 496, 112); c.fillStyle = '#2b4a6a'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.fillText('❄ 北方冰封群島', 256, 88);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); sp.position.set(R - 3, F0.y + 2.6, -3.4); sp.rotation.y = Math.PI / 2; g.add(sp);
    for (const sz of [-1.5, 1.5]){ const po = box([0.16, 3, 0.16], '#5a4030', [R - 3, F0.y + 1.5, -3.4 + sz]); g.add(po); } addCircleCol(F0.x + R - 3, F0.z - 4.9, 0.2); addCircleCol(F0.x + R - 3, F0.z - 1.9, 0.2); }
  // 北邊海岸外的流冰、躺在冰上的海豹
  for (let i = 0; i < 34; i++){ const a = Math.PI + (rr() - 0.5) * 2.2, r = R + 4 + rr() * 16, s = 0.8 + rr() * 2.2; const fl = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.08, 0.3, 6 + Math.floor(rr() * 3)), mat('#f2f8fc', 0.6)); fl.position.set(Math.cos(a) * r, WATER_LEVEL, Math.sin(a) * r); fl.rotation.y = rr() * 6; fl.scale.z = 0.6 + rr() * 0.5; g.add(fl); Frost.floes.push({ m: fl, ph: rr() * 6, s });
    if (i % 9 === 3){ const se = new THREE.Group(), sm = mat('#7a7f86', 0.6); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 10), sm); b.rotation.z = Math.PI / 2; b.position.y = 0.32; se.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), sm); hd.position.set(0.55, 0.45, 0); se.add(hd); for (const ez of [-0.08, 0.08]) se.add(box([0.04, 0.04, 0.04], '#111', [0.74, 0.5, ez]));
      se.position.copy(fl.position); se.position.y += 0.1; se.rotation.y = rr() * 6; g.add(se); Frost.seals.push({ m: se, fl, ph: rr() * 6 }); } }
  // 一直下的小雪（跟著鏡頭）
  { const N = 500, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); for (let i = 0; i < N; i++){ pos[i * 3] = (rr() - 0.5) * 40; pos[i * 3 + 1] = rr() * 14; pos[i * 3 + 2] = (rr() - 0.5) * 40; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ color:'#ffffff', size:0.09, transparent:true, opacity:0.9, depthWrite:false })); p.frustumCulled = false; scene.add(p); Frost.snow = p; }
  g.traverse(o => { if (o.isMesh){ o.castShadow = false; } });
}
// ---- 深海浮台、遠洋神秘島的樣子（走近才蓋）----
const Far = { abyss:false, myst:false, jelly:null, glows:[] };
function buildAbyss(){ Far.abyss = true; const A = ABYSS, g = new THREE.Group(); g.position.set(A.x, 0, A.z); scene.add(g); Far.ag = g;
  addDeck(A.x, A.z, A.w, A.d, A.y); g.add(box([A.w, 0.3, A.d], '#5a6470', [0, A.y - 0.15, 0])); g.add(box([A.w - 0.3, 0.04, A.d - 0.3], '#8a7a62', [0, A.y + 0.01, 0]));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12), mat('#e8a040', 0.6)); fl.position.set(sx * (A.w / 2 - 0.8), 0, sz * (A.d / 2 - 0.8)); g.add(fl); }
  for (let i = 0; i <= 12; i++){ const x = -A.w / 2 + i * A.w / 12; for (const z of [-A.d / 2, A.d / 2]) if (!(z > 0 && Math.abs(x) < 1.2)) g.add(box([0.06, 0.9, 0.06], '#c8ccd0', [x, A.y + 0.45, z])); }
  for (const z of [-A.d / 2, A.d / 2]){ g.add(box([A.w, 0.06, 0.06], '#c8ccd0', [0, A.y + 0.9, z])); } for (const x of [-A.w / 2, A.w / 2]) g.add(box([0.06, 0.06, A.d], '#c8ccd0', [x, A.y + 0.9, 0]));
  addBoxCol(A.x, A.z - A.d / 2 - 0.1, A.w, 0.2); addBoxCol(A.x - A.w / 2 - 0.1, A.z, 0.2, A.d); addBoxCol(A.x + A.w / 2 + 0.1, A.z, 0.2, A.d);
  // 小小的觀測站、吊臂、燈
  g.add(box([3, 2.4, 2.2], '#e8ecf0', [-3.6, A.y + 1.2, 1.8])); g.add(box([3.2, 0.2, 2.4], '#2f5a8a', [-3.6, A.y + 2.5, 1.8])); g.add(box([0.8, 1.6, 0.05], '#2f5a8a', [-3.6, A.y + 0.8, 0.68])); addBoxCol(A.x - 3.6, A.z + 1.8, 3, 2.2);
  { const arm = new THREE.Group(); arm.position.set(4.2, A.y, 2.4); g.add(arm); arm.add(box([0.3, 3.2, 0.3], '#e8a040', [0, 1.6, 0])); const jib = box([0.2, 0.2, 3.2], '#e8a040', [0, 3.1, -1.4]); arm.add(jib); arm.add(box([0.03, 2.4, 0.03], '#333', [0, 1.9, -2.9])); addCircleCol(A.x + 4.2, A.z + 2.4, 0.35); }
  for (const [x, z] of [[-5.6, -3.6], [5.6, -3.6], [5.6, 3.6]]){ g.add(box([0.1, 2.2, 0.1], '#7a8088', [x, A.y + 1.1, z])); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffe9a8' })); b.position.set(x, A.y + 2.25, z); g.add(b); Far.glows.push(b); }
  // 很深的海：浮台底下一大片深藍色，裡面有發光的水母慢慢飄
  { const deep = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshBasicMaterial({ color:'#06182e', transparent:true, opacity:0.55, depthWrite:false })); deep.rotation.x = -Math.PI / 2; deep.position.set(0, WATER_LEVEL - 0.25, 0); g.add(deep);
    const N = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); for (let i = 0; i < N; i++){ const a = Math.random() * 6.28, r = 6 + Math.random() * 40; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = -0.6 - Math.random() * 1.5; pos[i * 3 + 2] = Math.sin(a) * r; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color:'#7ef0ff', size:0.35, transparent:true, opacity:0.75, depthWrite:false })); g.add(pts); Far.jelly = pts; }
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#1d3a6a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#e8f4fb'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.fillText('🌌 深海浮台', 256, 88); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); sp.position.set(-3.6, A.y + 3.1, 0.66); g.add(sp); }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
function buildMyst(){ Far.myst = true; const M = MYST, g = new THREE.Group(); g.position.set(M.x, 0, M.z); scene.add(g); Far.mg = g; const R = M.r; let sd = 23; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // 黑色火山岩的島：中間隆起一座小火山
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.2, R + 3.6, 0.9, 48), mat('#3a3634', 0.95)); base.position.y = M.y - 0.7; g.add(base);
    const pg = new THREE.RingGeometry(0.02, R, 56, 28); pg.rotateX(-Math.PI / 2); const p = pg.attributes.position; for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i); p.setY(i, (mystH(M.x + x, M.z + z) || M.y)); } pg.computeVertexNormals();
    { const cs = [], c = new THREE.Color(); for (let i = 0; i < p.count; i++){ const d = Math.hypot(p.getX(i), p.getZ(i)), n = Math.sin(p.getX(i) * 1.3) * Math.cos(p.getZ(i) * 1.1) * 0.5 + 0.5;
        if (d > R - 2.2) c.set('#3a3836'); else if (d < R * 0.32) c.set(n > 0.5 ? '#5a4a44' : '#4a3e3a'); else c.set(n > 0.45 ? '#7aa04a' : '#9ab858'); cs.push(c.r, c.g, c.b); }
      pg.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); }   /* 黑沙岸邊、中間綠色的灌木地、山頂是火山岩 */
    const top = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95 })); g.add(top);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), new THREE.MeshBasicMaterial({ color:'#ff6a2a' })); lava.rotation.x = -Math.PI / 2; lava.position.y = (mystH(M.x, M.z) || M.y) + 0.05; g.add(lava); Far.lava = lava;
    addCircleCol(M.x, M.z, R * 0.3);
    const sm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color:'#d8d4cc', transparent:true, opacity:0.35, depthWrite:false })); sm.position.y = M.y + 4.6; g.add(sm); Far.smoke = sm; }
  // 沙灘（南邊上岸的地方）、仙人掌、火山岩塊
  { const sand = new THREE.Mesh(new THREE.CircleGeometry(5, 24, Math.PI * 1.15, Math.PI * 0.7), mat('#d8c8a0', 0.95)); sand.rotation.x = -Math.PI / 2; sand.position.set(0, M.y + 0.01, 0); sand.scale.set(2.6, 2.6, 1); g.add(sand); }
  // 仙人掌樹（一片一片橢圓形的掌）、海邊的椰子樹、低矮的灌木
  const pad = mat('#5f9a4a', 0.8), trunkM = mat('#8a7a5a', 0.9);
  for (let i = 0; i < 12; i++){ const a = rr() * 6.28, r = R * (0.45 + rr() * 0.4), x = Math.cos(a) * r, z = Math.sin(a) * r; if (z < -R * 0.45 && Math.abs(x) < 7) continue; const cg = new THREE.Group(), h = 1.0 + rr() * 0.8;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h, 7), trunkM); tr.position.y = h / 2; cg.add(tr);
    for (let k = 0; k < 7; k++){ const pd = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), pad); pd.scale.set(1, 1.3, 0.28); const aa = k * 0.9 + rr(); pd.position.set(Math.cos(aa) * (0.25 + rr() * 0.3), h + 0.2 + rr() * 0.7, Math.sin(aa) * (0.25 + rr() * 0.3)); pd.rotation.set(rr() - 0.5, aa, (rr() - 0.5) * 0.8); cg.add(pd);
      if (rr() < 0.4){ const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#ffd040', 0.6)); fl.position.copy(pd.position); fl.position.y += 0.42; cg.add(fl); } }
    cg.position.set(x, mystH(M.x + x, M.z + z) || M.y, z); g.add(cg); addCircleCol(M.x + x, M.z + z, 0.4); }
  for (let i = 0; i < 9; i++){ const a = rr() * 6.28, r = R * (0.72 + rr() * 0.18), x = Math.cos(a) * r, z = Math.sin(a) * r; if (z < -R * 0.5 && Math.abs(x) < 6) continue; const pg2 = new THREE.Group(), h = 3 + rr() * 1.5, lean = (rr() - 0.5) * 0.4;
    for (let k = 0; k < 6; k++){ const sg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, h / 6, 7), trunkM); sg.position.set(lean * k * 0.3, h / 12 + k * h / 6, 0); pg2.add(sg); }
    for (let k = 0; k < 7; k++){ const lf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.8, 4), mat('#3f8a3a', 0.8)); lf.scale.z = 0.25; const aa = k / 7 * 6.28; lf.position.set(lean * 1.8 + Math.cos(aa) * 0.7, h - 0.1, Math.sin(aa) * 0.7); lf.rotation.set(Math.sin(aa) * 1.1, 0, -Math.cos(aa) * 1.1); pg2.add(lf); }
    pg2.position.set(x, mystH(M.x + x, M.z + z) || M.y, z); g.add(pg2); addCircleCol(M.x + x, M.z + z, 0.3); }
  for (let i = 0; i < 20; i++){ const a = rr() * 6.28, r = R * (0.38 + rr() * 0.45), x = Math.cos(a) * r, z = Math.sin(a) * r; if (z < -R * 0.45 && Math.abs(x) < 6) continue; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + rr() * 0.4, 0), mat(rr() < 0.5 ? '#6a9a40' : '#8ab050', 0.9, { flatShading:true })); b.scale.y = 0.6; b.position.set(x, (mystH(M.x + x, M.z + z) || M.y) + 0.15, z); g.add(b); }
  for (let i = 0; i < 22; i++){ const a = rr() * 6.28, r = R * (0.8 + rr() * 0.3), x = Math.cos(a) * r, z = Math.sin(a) * r; if (z < -R * 0.5 && Math.abs(x) < 5) continue; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rr() * 0.9, 0), mat('#2e2a28', 0.95, { flatShading:true })); rk.position.set(x, (mystH(M.x + x, M.z + z) || M.y) - 0.1, z); rk.rotation.set(rr(), rr() * 6, rr()); g.add(rk); }
  // 海獅（躺在岩石上）、海鬣蜥、大象龜
  for (const [x, z, ry] of [[9, 6, 0.6], [-8, 9, 2.2], [11, -2, -0.4]]){ const sl = new THREE.Group(), m2 = mat('#7a5a40', 0.6); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 4, 10), m2); b.rotation.z = Math.PI / 2; b.position.y = 0.34; sl.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), m2); hd.position.set(0.7, 0.62, 0); sl.add(hd);
    for (const ez of [-0.09, 0.09]) sl.add(box([0.05, 0.05, 0.05], '#111', [0.9, 0.68, ez])); sl.position.set(x, mystH(M.x + x, M.z + z) || M.y, z); sl.rotation.y = ry; g.add(sl); addCircleCol(M.x + x, M.z + z, 0.6); }
  for (const [x, z, ry] of [[-4, -9, 0.3], [5, -10, 2.8], [-11, 2, 1.2]]){ const ig = new THREE.Group(), m3 = mat('#3a3a36', 0.7); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), m3); b.rotation.z = Math.PI / 2; b.position.y = 0.12; ig.add(b);
    const tl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 6), m3); tl.rotation.z = Math.PI / 2; tl.position.set(-0.65, 0.1, 0); ig.add(tl); for (let k = 0; k < 6; k++) ig.add(box([0.03, 0.07, 0.03], '#8a3a30', [-0.25 + k * 0.1, 0.25, 0])); ig.position.set(x, mystH(M.x + x, M.z + z) || M.y, z); ig.rotation.y = ry; g.add(ig); }
  { const tt = new THREE.Group(), sh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#5a5040', 0.8)); sh.scale.set(1.2, 0.8, 1); sh.position.y = 0.35; tt.add(sh); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat('#6a6050', 0.8)); hd.position.set(1.2, 0.45, 0); tt.add(hd);
    tt.position.set(-3, mystH(M.x - 3, M.z + 4) || M.y, 4); tt.rotation.y = 0.8; g.add(tt); addCircleCol(M.x - 3, M.z + 4, 1.1); Far.tortoise = tt; }
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#3a6a5a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#f4f0e0'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText('🌋 遠洋神秘島', 256, 86); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); sp.position.set(7, M.y + 2.4, -11); sp.rotation.y = Math.PI - 0.5; g.add(sp); for (const sx of [-1.4, 1.4]) g.add(box([0.14, 2.6, 0.14], '#5a4030', [7 + sx * Math.cos(0.5), M.y + 1.3, -11 + sx * Math.sin(0.5)])); }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
function updateFar(dt, t){
  if (frameNo % 30 === 0){ const vis = (G, x, z, R) => { if (G) G.visible = Math.hypot(camera.position.x - x, camera.position.z - z) < R; };   /* 手機效能：離很遠的區域先不畫（走近再出現） */
    vis(Frost.g, FROST.x, FROST.z, 130); vis(Far.ag, ABYSS.x, ABYSS.z, 120); vis(Far.mg, MYST.x, MYST.z, 130); }
  if (!Far.abyss && Math.hypot(me.pos.x - ABYSS.x, me.pos.z - ABYSS.z) < 90) buildAbyss();
  if (!Far.myst && Math.hypot(me.pos.x - MYST.x, me.pos.z - MYST.z) < 90) buildMyst();
  if (Far.jelly && frameNo % 3 === 0 && Math.hypot(me.pos.x - ABYSS.x, me.pos.z - ABYSS.z) < 70){ Far.jelly.position.y = Math.sin(t * 0.5) * 0.25; Far.jelly.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.2; }
  if (Far.lava) Far.lava.material.color.setHSL(0.05, 1, 0.5 + Math.sin(t * 2) * 0.08);
  if (Far.smoke){ Far.smoke.position.y = MYST.y + 4.6 + (t * 0.3 % 2); Far.smoke.material.opacity = 0.35 * (1 - (t * 0.3 % 2) / 2); }
  if (Far.tortoise && frameNo % 2 === 0) Far.tortoise.rotation.y = 0.8 + Math.sin(t * 0.1) * 0.6;
}
function updateFrost(dt, t){
  const d = Math.hypot(me.pos.x - FROST.x, me.pos.z - FROST.z); if (!Frost.built){ if (d < 90) buildFrost(); else return; }
  const near = d < 70; if (Frost.snow){ Frost.snow.visible = near && !Dive.on && !House.on; if (Frost.snow.visible){ const a = Frost.snow.geometry.attributes.position, A = a.array; Frost.snow.position.set(camera.position.x, 0, camera.position.z);
    for (let i = 0; i < A.length; i += 3){ A[i + 1] -= dt * (0.7 + (i % 5) * 0.12); A[i] += Math.sin(t + i) * dt * 0.15; if (A[i + 1] < 0) A[i + 1] = 14; } a.needsUpdate = true; } }
  if (near && frameNo % 2 === 0){ for (const f of Frost.floes) f.m.position.y = WATER_LEVEL + Math.sin(t * 0.8 + f.ph) * 0.04; for (const s of Frost.seals){ s.m.position.y = s.fl.position.y + 0.1; } }
}
function updateIsle(t){
  if (isleGroup) isleGroup.children.forEach(g => { const u = g.userData; if (u.flag) u.flag.rotation.y = Math.sin(t * 2 + g.position.x) * 0.25; if (u.fish) u.fish.forEach((f, k) => { const a = t * 0.6 + k * 2.1; f.position.set(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55); f.rotation.y = -a; });
    if (u.lamp) u.lamp.material.emissiveIntensity = 0.4 + DayNight.lamp * 1.6; if (u.fire){ u.fire.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1); u.fire.rotation.y = t * 2; } if (u.swing) u.swing.rotation.x = Math.sin(t * 1.6 + g.position.x) * 0.25; });
  updateBuild(); updateHouse(t);
}
// ---- 去島上／離開 ----
function goIsle(owner, name, layout, extra){
  if (visiting) leaveVisit(); if (House.on) exitHouse(true);
  layout = cleanIsland(layout); onIsle = Object.assign({ owner, name, layout, at: performance.now(), likes:0 }, extra || {}); buildIsle(layout, name);
  travelTo({ id:'isle', label:'小島', x: ISLE.x, z: ISLE.z + ISLE.r - 4, rot: Math.PI });
  renderIsleBar(); pushPresence(true); loadNeighbors();
  ticker(owner === myIdOrMe() ? '🏝️ 歡迎回到你的小島' : `🏝️ 來到 <b>${esc(name)}</b> 的小島`);
}
function myIdOrMe(){ return Cloud.userId || myId || 'me'; }
function goMyIsle(){ goIsle(myIdOrMe(), myDisplayName() === '你' ? '我' : myDisplayName(), rec.island, { likes: Cloud.myLikes || 0, tank: rec.tank, show: rec.show }); }
async function visitIsle(id, name){
  if (!Cloud.sb){ toast('要連上雲端才能參觀別人的島'); return; }
  if (id === myIdOrMe()){ closeSheet(); goMyIsle(); return; }
  try { const { data } = await Cloud.sb.from('players').select('nickname,island,likes,tank,show').eq('id', id).maybeSingle(); if (!data){ toast('找不到這位玩家的島'); return; } closeSheet(); Cloud.sb.rpc('log_visit', { p_owner: id, p_kind: 'isle' }).then(() => {}, () => {}); goIsle(id, data.nickname || name, data.island, { likes: data.likes || 0, tank: data.tank, show: data.show }); if (room && room.connected()) room.emit('isle', { to:id }).catch(() => {}); }
  catch(e){ toast('暫時連不上雲端'); }
}
function leaveIsle(){ if (!onIsle) return; if (House.on) exitHouse(true); stopBuild(); onIsle = null; clearNeighbors(); renderIsleBar(); travelTo(TRAVEL[0]); pushPresence(true); }
function checkIsle(){ if (onIsle && !House.on && performance.now() - onIsle.at > 1500 && Math.hypot(me.pos.x - ISLE.x, me.pos.z - ISLE.z) > 45){ stopBuild(); onIsle = null; clearNeighbors(); renderIsleBar(); pushPresence(true); } }
async function likeIsle(){
  if (!onIsle || onIsle.owner === myIdOrMe() || !Cloud.sb) return;
  try { const { data, error } = await Cloud.sb.rpc('like_island', { p_owner: onIsle.owner }); if (error) throw error; onIsle.likes = data; onIsle.liked = true; SFX.catch(); flash('❤️ 按讚了！', 1.2); renderIsleBar(); }
  catch(e){ toast('暫時沒辦法按讚'); }
}
function renderIsleBar(){
  let bar = $('#isleBar');
  if (!onIsle){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'isleBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = ''; const mine = onIsle.owner === myIdOrMe();
  bar.appendChild(el('span', '', (mine ? '🏝️ 我的小島' : canEditIsle() ? `🏠 我家（${onIsle.name}）` : `🏝️ ${onIsle.name} 的小島`) + `・❤️ ${onIsle.likes || 0}`));
  if (House.on && canEditIsle()){ const fb = el('button', 'tbtn', FB.on ? '完成擺設' : '🛋️ 擺家具'); fb.addEventListener('click', () => { if (FB.on) stopFurn(); else startFurn(); renderIsleBar(); }); bar.appendChild(fb);
    const lb = el('button', 'tbtn ghost', '🏠 格局'); lb.addEventListener('click', () => { furnSheet = 'lay'; openSheet('furn'); }); bar.appendChild(lb); }
  else if (mine || canEditIsle()){ const b = el('button', 'tbtn', Build.on ? '完成建造' : '🔨 建造'); b.addEventListener('click', () => { if (Build.on) stopBuild(); else { Build.on = true; renderBuildBar(); renderIsleBar(); } }); bar.appendChild(b);
    const s = el('button', 'tbtn ghost', '🛒 買東西'); s.addEventListener('click', () => openSheet('island')); bar.appendChild(s); }
  if (!mine && !canEditIsle()){ const l = el('button', 'tbtn' + (onIsle.liked ? ' ghost' : ''), onIsle.liked ? '❤️ 已按讚' : '❤️ 按讚'); l.disabled = !!onIsle.liked; l.addEventListener('click', likeIsle); bar.appendChild(l); }
  const back = el('button', 'tbtn ghost', '回村子'); back.addEventListener('click', leaveIsle); bar.appendChild(back);
}
// ---- 建造模式：拿著東西走來走去，放在想要的位置 ----
const Build = { on:false, type:null, moveId:null, rot:0, ghost:null, x:0, z:0, err:null, sel:null };
const ghostOk = new THREE.MeshStandardMaterial({ color:'#7fe0a8', transparent:true, opacity:0.55, emissive:'#3fbf7a', emissiveIntensity:0.6, depthWrite:false });
const ghostBad = new THREE.MeshStandardMaterial({ color:'#ff8a7a', transparent:true, opacity:0.55, emissive:'#f04a3a', emissiveIntensity:0.6, depthWrite:false });
function startPlace(type, moveId){
  if (!onIsle || !canEditIsle()){ goMyIsle(); setTimeout(() => startPlace(type, moveId), 900); return; }
  closeSheet(); clearGhost(); Build.on = true; Build.type = type; Build.moveId = moveId || null;
  const it = moveId ? isleItems().find(x => x.id === moveId) : null; Build.rot = it ? it.r : Math.round(((me.rot + Math.PI) % (Math.PI * 2)) / (Math.PI / 4)) * Math.PI / 4;
  Build.ghost = itemMesh(type, { lite:true }); Build.ghost.traverse(o => { if (o.isMesh){ o.material = ghostOk; o.castShadow = false; } }); scene.add(Build.ghost);
  if (moveId && isleGroup){ const g = isleGroup.children.find(c => c.userData.item && c.userData.item.id === moveId); if (g) g.visible = false; }
  renderBuildBar(); renderIsleBar();
}
function clearGhost(){ if (Build.ghost){ scene.remove(Build.ghost); Build.ghost = null; } if (Build.moveId && isleGroup) isleGroup.children.forEach(c => { c.visible = true; }); Build.type = null; Build.moveId = null; }
function stopBuild(){ clearGhost(); Build.on = false; Build.sel = null; renderBuildBar(); if (onIsle) renderIsleBar(); }
function updateBuild(){
  if (!Build.on || !onIsle) return;
  if (Build.ghost){
    const T = ISLE_ITEMS[Build.type], d = T.rad + 1.4, fx = Math.sin(me.rot), fz = Math.cos(me.rot);
    const lx = Math.round((me.pos.x + fx * d - ISLE.x) * 4) / 4, lz = Math.round((me.pos.z + fz * d - ISLE.z) * 4) / 4;
    Build.x = lx; Build.z = lz; Build.err = isleCheck(isleItems(), Build.type, lx, lz, Build.moveId || -1);
    Build.ghost.position.set(ISLE.x + lx, ISLE.y + 0.02, ISLE.z + lz); Build.ghost.rotation.y = Build.rot;
    const m = Build.err ? ghostBad : ghostOk; Build.ghost.traverse(o => { if (o.isMesh && o.material !== m) o.material = m; });
    const hint = $('#bbHint'); if (hint){ const t = Build.err || `${T.name}：走路調整位置`; if (hint.textContent !== t) hint.textContent = t; hint.classList.toggle('bad', !!Build.err); }
  } else {
    // 沒拿東西時：選最靠近的東西，可以移動或拆掉
    let best = null, bd = 2.6; for (const it of isleItems()){ const dd = Math.hypot(me.pos.x - ISLE.x - it.x, me.pos.z - ISLE.z - it.z) - ISLE_ITEMS[it.t].rad * 0.6; if (dd < bd){ bd = dd; best = it; } }
    if ((best && best.id) !== (Build.sel && Build.sel.id)){ Build.sel = best; renderBuildBar(); }
  }
}
function renderBuildBar(){
  let bar = $('#buildBar');
  if (!Build.on){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'buildBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = '';
  if (Build.ghost){
    const T = ISLE_ITEMS[Build.type];
    bar.appendChild(el('span', 'bb-hint', '')).id = 'bbHint';
    const r = el('button', 'tbtn ghost', '⟲ 轉向'); r.addEventListener('click', () => { Build.rot = (Build.rot + Math.PI / 4) % (Math.PI * 2); }); bar.appendChild(r);
    const ok = el('button', 'tbtn', Build.moveId ? '✔ 放這裡' : `✔ 放這裡 🪙${T.price.toLocaleString()}`); ok.addEventListener('click', confirmPlace); bar.appendChild(ok);
    const x = el('button', 'tbtn ghost', '✖'); x.addEventListener('click', () => { clearGhost(); renderBuildBar(); }); bar.appendChild(x);
  } else if (Build.sel){
    const T = ISLE_ITEMS[Build.sel.t]; bar.appendChild(el('span', 'bb-hint', `🔨 ${T.name}`));
    const mv = el('button', 'tbtn', '移動'); mv.addEventListener('click', () => startPlace(Build.sel.t, Build.sel.id)); bar.appendChild(mv);
    const rm = el('button', 'tbtn ghost', `拆掉 +${Math.floor(T.price / 2)}`); rm.addEventListener('click', () => { if (rm.dataset.sure !== '1'){ rm.dataset.sure = '1'; rm.textContent = '確定拆掉？'; rm.classList.add('warn'); return; } removeIsleItem(Build.sel.id); }); bar.appendChild(rm);
    const sh = el('button', 'tbtn ghost', '🛒'); sh.addEventListener('click', () => openSheet('island')); bar.appendChild(sh);
  } else {
    bar.appendChild(el('span', 'bb-hint', '🔨 建造模式：走到東西旁邊可以移動或拆掉'));
    const sh = el('button', 'tbtn', '🛒 買東西'); sh.addEventListener('click', () => openSheet('island')); bar.appendChild(sh);
  }
}
function confirmPlace(){
  if (!Build.ghost) return; if (Build.err){ toast(Build.err); return; }
  if (Cloud.on && Cloud.sb){   // 雲端：經過伺服器（島主和住戶都可以蓋）
    const T = ISLE_ITEMS[Build.type], x = Build.x, z = Build.z, r = +Build.rot.toFixed(2), moving = Build.moveId, type = Build.type;
    if (!moving && rec.coins < T.price){ toast(`金幣不夠，還差 🪙${(T.price - rec.coins).toLocaleString()}`); return; }
    clearGhost(); homeOp(moving ? 'move' : 'place', moving ? { id: moving, x, z, r } : { t: type, x, z, r }).then(ok => { if (!ok) return; SFX.plop(); FX.emit(ISLE.x + x, 0.6, ISLE.z + z, 14, '#fff4dc', 0.6, 1.6, 0.9);
      if (!moving) ticker(`🏗️ 你在小島上放了 <b>${esc(T.name)}</b>！`); if (!moving && rec.coins >= T.price && !T.house) startPlace(type); });
    return; }
  const T = ISLE_ITEMS[Build.type], items = rec.island.items, x = Build.x, z = Build.z, r = +Build.rot.toFixed(2);
  if (Build.moveId){ const it = items.find(i => i.id === Build.moveId); if (!it) return; it.x = x; it.z = z; it.r = r; cloudCall('move_item', { p_id: it.id, p_x: x, p_z: z, p_r: r }); }
  else {
    if (items.length >= ISLE_MAX){ toast('島上已經放滿了'); return; }
    if (T.house && items.filter(i => ISLE_ITEMS[i.t].house).length >= ISLE_HOUSE_MAX){ toast('房子最多 6 棟'); return; }
    if (rec.coins < T.price){ toast(`金幣不夠，還差 🪙${(T.price - rec.coins).toLocaleString()}`); return; }
    const id = items.reduce((m, i) => Math.max(m, i.id), 0) + 1; items.push({ id, t: Build.type, x, z, r }); addCoins(-T.price);
    cloudCall('place_item', { p_type: Build.type, p_x: x, p_z: z, p_r: r }); ticker(`🏗️ 你在小島上放了 <b>${esc(T.name)}</b>！`);
  }
  saveRecLocal(); SFX.plop(); FX.emit(ISLE.x + x, 0.6, ISLE.z + z, 14, '#fff4dc', 0.6, 1.6, 0.9);
  const keep = Build.moveId ? null : Build.type; clearGhost(); onIsle.layout = rec.island; buildIsle(rec.island, onIsle.name);
  if (keep && rec.coins >= T.price && !T.house) startPlace(keep); else renderBuildBar();   // 裝飾可以連續放
}
function removeIsleItem(id){
  if (Cloud.on && Cloud.sb){ const it = isleItems().find(i => i.id === id); if (!it) return; homeOp('remove', { id }).then(ok => { if (ok){ toast(`拆掉了 ${ISLE_ITEMS[it.t].name}，退回一半金幣`); Build.sel = null; renderBuildBar(); } }); return; }
  const items = rec.island.items, it = items.find(i => i.id === id); if (!it) return; const back = Math.floor(ISLE_ITEMS[it.t].price / 2);
  rec.island.items = items.filter(i => i.id !== id); addCoins(back); saveRecLocal(); cloudCall('remove_item', { p_id: id });
  toast(`拆掉了 ${ISLE_ITEMS[it.t].name}，退回 🪙${back}`); Build.sel = null; onIsle.layout = rec.island; buildIsle(rec.island, onIsle.name); renderBuildBar();
}
// ---- 房子裡面（在島的正下方蓋一間房間，從門口走進去）----
const House = { on:false, group:null, cols:[], back:null, door:null, type:null, fish:[], it:null, furnG:new Map(), fires:[], lamps:[] };
const ROOM_Y = -40;
function nearDoor(){ if (!onIsle || House.on || Build.ghost) return null; let best = null, bd = 1.6; for (const d of isleDoors){ const dd = Math.hypot(me.pos.x - d.x, me.pos.z - d.z); if (dd < bd){ bd = dd; best = d; } } return best; }
function nearExit(){ return House.on && Math.hypot(me.pos.x - House.door.x, me.pos.z - House.door.z) < 1.4 ? House.door : null; }
// ===== 家：房子的格局、家具、室友／家人（伺服器 034_home.sql；價格大小要一樣）=====
const LAYOUTS = {
  open:  { name:'套房',     price:0,    W:9,  D:7,  walls:[], doors:[], rooms:[] },
  one:   { name:'一房一廳', price:1500, W:11, D:8,  walls:[[-1.5, -4, -1.5, 1.3], [-1.5, 2.6, -1.5, 4]], doors:[[-1.5, 1.95]], rooms:[{ x0:-5.5, x1:-1.5, z0:-4, z1:4, door:[-1.5, 1.95] }] },
  two:   { name:'兩房一廳', price:3500, W:13, D:9,  walls:[[-2.5, -4.5, -2.5, 1.6], [-2.5, 2.9, -2.5, 4.5], [2.5, -4.5, 2.5, 1.6], [2.5, 2.9, 2.5, 4.5]], doors:[[-2.5, 2.25], [2.5, 2.25]],
           rooms:[{ x0:-6.5, x1:-2.5, z0:-4.5, z1:4.5, door:[-2.5, 2.25] }, { x0:2.5, x1:6.5, z0:-4.5, z1:4.5, door:[2.5, 2.25] }] },
  three: { name:'三房一廳', price:7000, W:15, D:10, walls:[[-3.5, -5, -3.5, 2.2], [-3.5, 3.5, -3.5, 5], [3.5, -5, 3.5, 2.2], [3.5, 3.5, 3.5, 5], [-3.5, -1, -0.65, -1], [0.65, -1, 3.5, -1]], doors:[[-3.5, 2.85], [3.5, 2.85], [0, -1]],
           rooms:[{ x0:-7.5, x1:-3.5, z0:-5, z1:5, door:[-3.5, 2.85] }, { x0:3.5, x1:7.5, z0:-5, z1:5, door:[3.5, 2.85] }, { x0:-3.5, x1:3.5, z0:-5, z1:-1, door:[0, -1] }] },
};
const LAYOUT_DESC = { open:'一間大房間，什麼都放在一起', one:'左邊隔出一間臥室', two:'中間客廳，左右各一間臥室', three:'左右各一間臥室，後面再一間，適合一家人' };
const FURN = {
  bed:{ name:'單人床', price:600, rad:1.1, bed:1, g:'bed' }, dbed:{ name:'雙人床', price:1200, rad:1.4, bed:1, g:'bed' }, bunk:{ name:'上下舖', price:1000, rad:1.1, bed:1, g:'bed' },
  ward:{ name:'衣櫃', price:700, rad:0.8, g:'bed' }, desk:{ name:'書桌', price:450, rad:0.7, g:'bed' }, lamp:{ name:'立燈', price:200, rad:0.3, g:'bed' }, clock:{ name:'落地鐘', price:600, rad:0.3, g:'bed' },
  sofa:{ name:'沙發', price:800, rad:1.2, g:'live' }, arm:{ name:'單人沙發', price:400, rad:0.6, g:'live' }, tv:{ name:'電視櫃', price:900, rad:0.9, g:'live' }, table:{ name:'餐桌', price:500, rad:0.8, g:'live' },
  chair:{ name:'椅子', price:120, rad:0.35, g:'live' }, shelf:{ name:'書櫃', price:500, rad:0.7, g:'live' }, rug:{ name:'地毯', price:250, rad:1.2, flat:1, g:'live' }, fire:{ name:'壁爐', price:1500, rad:0.8, g:'live' },
  piano:{ name:'鋼琴', price:2500, rad:0.9, g:'live' }, tank:{ name:'小魚缸', price:1000, rad:0.7, g:'live' },
  fridge:{ name:'冰箱', price:800, rad:0.5, g:'kit' }, stove:{ name:'爐台', price:700, rad:0.5, g:'kit' }, sink:{ name:'流理台', price:500, rad:0.6, g:'kit' }, bath:{ name:'浴缸', price:1200, rad:1.0, g:'kit' }, toilet:{ name:'馬桶', price:400, rad:0.4, g:'kit' },
  paint:{ name:'畫', price:0, rad:0.45, g:'_base' },
  plant:{ name:'盆栽', price:150, rad:0.4, g:'plant' }, bigplant:{ name:'大盆栽', price:300, rad:0.5, g:'plant' },
};
const FURN_GROUPS = [['mu', '🪵 阿木的作品'], ['cai', '🎨 阿彩的畫'], ['bed', '🛏️ 臥室'], ['live', '🛋️ 客廳'], ['kit', '🍳 廚房、浴室'], ['plant', '🪴 植物']];
// KayKit Furniture Bits（Kay Lousberg，CC0）的家具：models/kaykit_furn.glb，價格大小跟伺服器 069_kaykit_furn.sql 一樣
const KKF_LIST = {
  kk_bed_single_A:{ name:'原木單人床', price:650, rad:1.0, g:'bed', base:'bed', kk:'bed_single_A', bed:1 },
  kk_bed_single_B:{ name:'白漆單人床', price:650, rad:1.0, g:'bed', base:'bed', kk:'bed_single_B', bed:1 },
  kk_bed_double_A:{ name:'原木雙人床', price:1300, rad:1.3, g:'bed', base:'dbed', kk:'bed_double_A', bed:1 },
  kk_bed_double_B:{ name:'白漆雙人床', price:1300, rad:1.3, g:'bed', base:'dbed', kk:'bed_double_B', bed:1 },
  kk_cabinet_small:{ name:'床頭小櫃', price:300, rad:0.4, g:'bed', base:'desk', kk:'cabinet_small' },
  kk_cabinet_small_decorated:{ name:'床頭櫃（放了小東西）', price:380, rad:0.4, g:'bed', base:'desk', kk:'cabinet_small_decorated' },
  kk_cabinet_medium:{ name:'矮櫃', price:450, rad:0.7, g:'bed', base:'ward', kk:'cabinet_medium' },
  kk_cabinet_medium_decorated:{ name:'矮櫃（擺滿裝飾）', price:600, rad:0.7, g:'bed', base:'ward', kk:'cabinet_medium_decorated' },
  kk_lamp_table:{ name:'圓燈罩檯燈', price:180, rad:0.3, g:'bed', base:'lamp', kk:'lamp_table' },
  kk_lamp_standing:{ name:'圓燈罩立燈', price:260, rad:0.35, g:'bed', base:'lamp', kk:'lamp_standing' },
  kk_couch:{ name:'圓角沙發', price:900, rad:1.1, g:'live', base:'sofa', kk:'couch' },
  kk_couch_pillows:{ name:'抱枕沙發', price:1000, rad:1.1, g:'live', base:'sofa', kk:'couch_pillows' },
  kk_armchair:{ name:'圓角扶手椅', price:450, rad:0.6, g:'live', base:'arm', kk:'armchair' },
  kk_armchair_pillows:{ name:'抱枕扶手椅', price:520, rad:0.6, g:'live', base:'arm', kk:'armchair_pillows' },
  kk_chair_A:{ name:'靠背餐椅', price:140, rad:0.35, g:'live', base:'chair', kk:'chair_A' },
  kk_chair_A_wood:{ name:'原木靠背椅', price:140, rad:0.35, g:'live', base:'chair', kk:'chair_A_wood' },
  kk_chair_B_wood:{ name:'原木格子椅', price:160, rad:0.35, g:'live', base:'chair', kk:'chair_B_wood' },
  kk_chair_C:{ name:'高背椅', price:160, rad:0.35, g:'live', base:'chair', kk:'chair_C' },
  kk_chair_stool_wood:{ name:'原木圓凳', price:90, rad:0.3, g:'live', base:'chair', kk:'chair_stool_wood' },
  kk_table_low:{ name:'矮茶几', price:350, rad:0.9, g:'live', base:'table', kk:'table_low' },
  kk_table_small:{ name:'小方桌', price:250, rad:0.4, g:'live', base:'table', kk:'table_small' },
  kk_table_medium:{ name:'四人方桌', price:450, rad:0.8, g:'live', base:'table', kk:'table_medium' },
  kk_table_medium_long:{ name:'長餐桌', price:600, rad:1.1, g:'live', base:'table', kk:'table_medium_long' },
  kk_rug_oval_A:{ name:'橢圓地毯', price:260, rad:1.1, g:'live', base:'rug', kk:'rug_oval_A', flat:1 },
  kk_rug_rectangle_A:{ name:'素色長地毯', price:240, rad:1.1, g:'live', base:'rug', kk:'rug_rectangle_A', flat:1 },
  kk_rug_rectangle_stripes_A:{ name:'條紋地毯（暖色）', price:280, rad:1.1, g:'live', base:'rug', kk:'rug_rectangle_stripes_A', flat:1 },
  kk_rug_rectangle_stripes_B:{ name:'條紋地毯（冷色）', price:280, rad:1.1, g:'live', base:'rug', kk:'rug_rectangle_stripes_B', flat:1 },
  kk_cactus_small_A:{ name:'小仙人掌', price:120, rad:0.25, g:'plant', base:'plant', kk:'cactus_small_A' },
  kk_cactus_small_B:{ name:'圓圓小仙人掌', price:120, rad:0.25, g:'plant', base:'plant', kk:'cactus_small_B' },
  kk_cactus_medium_A:{ name:'仙人掌盆栽', price:220, rad:0.4, g:'plant', base:'bigplant', kk:'cactus_medium_A' },
  kk_cactus_medium_B:{ name:'胖胖仙人掌盆栽', price:220, rad:0.4, g:'plant', base:'bigplant', kk:'cactus_medium_B' },
};
Object.assign(FURN, KKF_LIST);
const KKF = { scene:null, busy:false, wait:[] };
function kkfLoad(){ if (KKF.scene || KKF.busy) return; KKF.busy = true;
  new GLTFLoader().load('models/kaykit_furn.glb', g => { KKF.scene = g.scene; g.scene.traverse(o => { if (o.isMesh && o.material){ o.material.metalness = 0; o.material.roughness = 0.85; } }); const W = KKF.wait; KKF.wait = []; for (const x of W) kkfFill(x); },
    undefined, () => { KKF.busy = false; setTimeout(kkfLoad, 8000); }); }   /* 載入失敗過一陣子再試 */
function kkfFill(g){ const src = KKF.scene.getObjectByName(g.userData.kk); if (!src) return; if (g.userData.ph){ g.remove(g.userData.ph); g.userData.ph = null; } const m = new THREE.Mesh(src.geometry, src.material); m.castShadow = false; m.receiveShadow = false; g.add(m); }
function kkfMesh(t){ const F0 = FURN[t], g = new THREE.Group(); g.userData.kk = F0.kk;
  if (KKF.scene) kkfFill(g); else { const ph = box([F0.rad * 1.3, F0.flat ? 0.04 : 0.5, F0.rad * 1.3], null, [0, F0.flat ? 0.02 : 0.25, 0], new THREE.MeshStandardMaterial({ color:'#d8c8b0', transparent:true, opacity:0.35 })); ph.castShadow = false; g.add(ph); g.userData.ph = ph; KKF.wait.push(g); kkfLoad(); }   /* 模型還沒載好：先放一個淡淡的方塊 */
  return g; }
// ---- 阿木的家具（052_mu.sql）：'fz<編號>'＝某一種家具＋自己的木頭顏色、布料顏色、花樣 ----
const FZ = { map: new Map(), list: null, at: 0, busy: false, want: new Set(), timer: 0, tex: new Map() };
function fzId(t){ const m = /^fz(\d{1,9})$/.exec(t || ''); return m ? +m[1] : 0; }
function fzReg(d){ if (!d || !FURN[d.base] || FURN[d.base].dz) return; FZ.map.set(d.id, d); const B = FURN[d.base]; FURN['fz' + d.id] = { name: d.name + (d.gift ? '（阿彩送你的）' : ''), price: d.price, rad: B.rad, flat: B.flat, g: !d.listed ? 'mu_old' : d.base === 'paint' ? (d.gift && !d.mine ? 'mu_old' : 'cai') : 'mu', base: d.base, dz: d }; }
function fzWant(id){ if (!id || FZ.map.has(id)) return; let on = false; try { on = Cloud.on && !!Cloud.sb; } catch(e){ setTimeout(() => fzWant(id), 1500); return; } if (!on) return; FZ.want.add(id); clearTimeout(FZ.timer); FZ.timer = setTimeout(fzFetch, 250); }
async function fzFetch(){ const ids = [...FZ.want].filter(id => !FZ.map.has(id)).slice(0, 60); FZ.want.clear(); if (!ids.length) return;
  try { const { data } = await Cloud.sb.rpc('get_furn', { p_ids: ids }); for (const d of data || []) fzReg(d); for (const id of ids) if (!FZ.map.has(id)) FZ.map.set(id, null); } catch(e){ return; }
  if (House.on && House.it) rebuildHouseRoom(House.it); }
async function loadMu(){ if (FZ.busy || !Cloud.on || !Cloud.sb) return; FZ.busy = true; FZ.at = Date.now();
  try { const { data } = await Cloud.sb.rpc('list_furn', { p_offset: 0 }); FZ.list = data || []; for (const d of FZ.list) fzReg(d); } catch(e){ FZ.list = FZ.list || []; }
  FZ.busy = false; applyMuShow(); if (!$('#sheet').hidden && (curTab === 'mu' || curTab === 'furn')) renderTab(); }
function fzTex(pat, col, base){ const k = pat + col + base; let t = FZ.tex.get(k); if (t) return t; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = col; c.fillRect(0, 0, 64, 64); const dk = shade(col, -0.22), lt = shade(col, 0.35);
  if (pat === 'stripe'){ c.fillStyle = lt; for (let x = 0; x < 64; x += 16) c.fillRect(x, 0, 7, 64); }
  else if (pat === 'check'){ c.fillStyle = lt; for (let y = 0; y < 64; y += 16) for (let x = (y / 16 % 2) * 16; x < 64; x += 32) c.fillRect(x, y, 16, 16); c.globalAlpha = 0.25; c.fillStyle = dk; for (let x = 0; x < 64; x += 16) c.fillRect(x + 7, 0, 2, 64); c.globalAlpha = 1; }
  else if (pat === 'wave'){ c.strokeStyle = lt; c.lineWidth = 4; for (let y = 8; y < 64; y += 16){ c.beginPath(); for (let x = 0; x <= 64; x += 2) c.lineTo(x, y + Math.sin(x / 64 * Math.PI * 4) * 4); c.stroke(); } }
  else if (pat === 'dots'){ c.fillStyle = lt; for (let y = 8; y < 64; y += 16) for (let x = (y / 16 % 2) * 8 + 8; x < 64; x += 16){ c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } }
  else if (pat === 'grain'){ c.strokeStyle = dk; c.globalAlpha = 0.45; c.lineWidth = 1.5; for (let y = 4; y < 64; y += 6){ c.beginPath(); for (let x = 0; x <= 64; x += 4) c.lineTo(x, y + Math.sin(x / 9 + y) * 1.5); c.stroke(); } c.globalAlpha = 1; }
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); FZ.tex.set(k, t); return t; }
// ---- 阿彩的畫（058_cai.sql）：畫架上一幅畫；背景照畫的風格用筆觸畫出來，魚是遊戲裡同一隻魚的模型，扁扁的貼在畫布上 ----
function paintTex(d){ const k = d.pat + d.main; let t = Cai.tex.get(k); if (t) return t; const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const c = cv.getContext('2d');
  const P = { dawn:['#ffe2c4', '#f6b8a8', '#a8d8f0'], sea:['#8fd3f4', '#3f8fc8', '#1d5f8a'], sunset:['#ffd38a', '#f1846b', '#7a4a8a'], night:['#2b3f6a', '#18284a', '#0c1428'], reef:['#9ff0e0', '#3fbfb0', '#1f7a8a'], mist:['#eef2f2', '#c8d4d8', '#9aa8b0'] }[d.pat] || ['#fff', d.main, shade(d.main, -0.3)];
  const g = c.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, P[0]); g.addColorStop(0.55, P[1]); g.addColorStop(1, P[2]); c.fillStyle = g; c.fillRect(0, 0, 128, 96);
  let a = hash32('paint' + k) >>> 0; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < 70; i++){ const y = rnd() * 96, x = rnd() * 128; c.strokeStyle = P[Math.floor(rnd() * 3)]; c.globalAlpha = 0.35; c.lineWidth = 2 + rnd() * 4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 3 + rnd() * 6, x + 14 + rnd() * 12, y + rnd() * 4 - 2); c.stroke(); }
  c.globalAlpha = 1; if (d.pat === 'night'){ c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(100, 20, 9, 0, 7); c.fill(); } if (d.pat === 'dawn' || d.pat === 'sunset'){ c.fillStyle = d.pat === 'dawn' ? '#fff1a8' : '#ffb35a'; c.beginPath(); c.arc(24, 30, 11, 0, 7); c.fill(); }
  if (d.pat === 'reef') for (let i = 0; i < 6; i++){ c.fillStyle = ['#f5a5d8', '#ff9f43', '#ffd36a'][i % 3]; c.beginPath(); c.arc(10 + i * 22, 92, 6 + rnd() * 6, 0, 7); c.fill(); }
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; Cai.tex.set(k, t); return t; }
function paintMesh(d){
  const g = new THREE.Group(), fr = d.accent || '#8c5d3b', leg = (x, z, rx) => { const m = box([0.05, 1.5, 0.05], fr, [x, 0.72, z]); m.rotation.x = rx; g.add(m); };
  leg(-0.32, 0.08, -0.08); leg(0.32, 0.08, -0.08); leg(0, -0.22, 0.25); g.add(box([0.8, 0.05, 0.08], fr, [0, 0.62, 0.12]));
  const W = 0.86, H = 0.66, y = 1.02;
  for (const [sz, p] of [[[W + 0.1, 0.06, 0.05], [0, y + H / 2 + 0.03, 0.12]], [[W + 0.1, 0.06, 0.05], [0, y - H / 2 - 0.03, 0.12]], [[0.06, H, 0.05], [-W / 2 - 0.02, y, 0.12]], [[0.06, H, 0.05], [W / 2 + 0.02, y, 0.12]]]) g.add(box(sz, shade(fr, 0.1), p));
  const cvm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: paintTex(d), roughness: 0.95, emissive: '#ffffff', emissiveIntensity: 0.06 })); cvm.position.set(0, y, 0.125); g.add(cvm);
  const f = d.fish && FISH_BY_ID[d.fish]; if (f){ try { const m = fishModel(f, 0.5); m.scale.z *= 0.25; m.position.set(0, y - 0.02, 0.16); g.add(m); } catch(e){} }
  return g; }
async function loadCai(){ if (Cai.busy || !Cloud.on || !Cloud.sb) return; Cai.busy = true; Cai.at = Date.now();
  try { const [a, b] = await Promise.all([Cloud.sb.rpc('list_paint'), Cloud.sb.rpc('cai_today')]); Cai.list = (a.data || []); for (const d of Cai.list) fzReg(d); if (b.data){ Cai.today = b.data; if (b.data.paint) fzReg(b.data.paint); if (b.data.gift) fzReg(b.data.gift); } } catch(e){ Cai.list = Cai.list || []; }
  Cai.busy = false; applyCaiShow(); if (!$('#sheet').hidden && (curTab === 'cai' || curTab === 'furn')) renderTab(); }
function applyCaiShow(){ const d = Cai.today && Cai.today.paint; if (!Cai.show || !d || Cai.showId === d.id) return; Cai.showId = d.id; for (const c of [...Cai.show.children]) Cai.show.remove(c); Cai.show.add(paintMesh(d)); }
function caiLines(){ const T = Cai.today, out = []; const d = T && T.paint; if (d){ out.push(`今天畫的是「${d.name}」，${d.story}`); if (d.aboutName) out.push(`${d.aboutName} 昨天釣到的魚好漂亮，我忍不住就畫下來了`); }
  if (T && T.gift) out.push('我畫了你的魚喔！送你一幅，回家按「擺家具」→「🎨 阿彩的畫」就找得到'); out.push('每天早上 8 點，我會畫昨天全村最厲害的那條魚'); return out; }
function renderCaiShop(body){
  const head = el('div', 'shophead'); head.innerHTML = '<b>🎨 阿彩畫廊</b>'; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能逛畫廊。')); return; }
  body.appendChild(el('p', 'sub', '阿彩每天早上 8 點畫一幅魚：畫的是昨天全村最厲害的那一條（就是報紙的頭條），被畫的人會收到一幅免費的。畫是家具，回到小島的房子按「擺家具」→「🎨 阿彩的畫」，擺下去的時候才付錢。畫都不會下架。'));
  if (!Cai.list){ body.appendChild(el('div', 'empty', '載入中…')); return; }
  const T = Cai.today; if (T && T.gift){ body.appendChild(el('div', 'pme', `🎁 阿彩畫了你的魚，送你一幅「${T.gift.name}」！`)); }
  if (!Cai.list.length){ body.appendChild(el('div', 'empty', '阿彩還在畫第一幅畫。')); return; }
  const ul = el('ul', 'shoplist'); for (const d of Cai.list){ const li = el('li'), sw = el('span', 'dishic', '🖼️'); sw.style.cssText = `background:linear-gradient(180deg, ${d.main}, ${shade(d.main, -0.3)});border:3px solid ${d.accent};border-radius:6px`; li.appendChild(sw);
    const inf = el('div', 'tinfo'); inf.appendChild(el('div', 'n', d.name + (d.gift ? '（送你的）' : ''))); inf.appendChild(el('div', 'sub2', `${d.story}・${d.gift ? '免費' : d.price ? '🪙' + d.price : '免費'}`)); li.appendChild(inf);
    const a = el('div', 'tacts'), b = el('button', 'tbtn', House.on && canEditIsle() ? '拿去擺' : '回家擺'); b.addEventListener('click', () => { if (House.on && canEditIsle()){ closeSheet(); startFurn('fz' + d.id); } else toast('走進你小島上的房子，按「擺家具」→「🎨 阿彩的畫」就能擺'); }); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}
// 阿木的家具：照原本那種家具的樣子，木頭換成他的木頭顏色、布的地方換成他的布料花樣；沒有布的家具（桌子、櫃子…）加一塊花布
function fzMesh(d){
  const g = furnMesh(d.base), W = new Set(['8c5d3b', 'c79a6b']), A = { bed:['f17b6d'], dbed:['5f8fd8'], sofa:['5f8f7a'], arm:['d87a5a'], rug:['e8a8b8'], chair:['c98a5a'] }, acc = new Set(A[d.base] || []);
  const em = c => ({ emissive: c, emissiveIntensity: 0.1 });
  const mainM = new THREE.MeshStandardMaterial(Object.assign({ color: '#ffffff', map: fzTex('grain', d.main, 1), roughness: 0.8 }, em('#000000'))), mainD = mat(shade(d.main, -0.18), 0.8, em(shade(d.main, -0.18)));
  const accM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: fzTex(d.pat === 'grain' ? 'plain' : d.pat, d.accent, 0), roughness: 0.85, emissive: '#ffffff', emissiveIntensity: 0.05 });
  g.traverse(o => { if (!o.isMesh || !o.material || !o.material.color) return; const hx = o.material.color.getHexString(); if (W.has(hx)) o.material = hx === '8c5d3b' ? mainD : mainM; else if (acc.has(hx)) o.material = accM; });
  const add = (sz, p) => { const b = box(sz, null, p, accM); b.castShadow = false; g.add(b); };
  switch (d.base){ case 'table': add([1.34, 0.012, 0.38], [0, 0.765, 0]); break; case 'desk': add([0.62, 0.01, 0.36], [0, 0.785, 0.05]); break;
    case 'shelf': add([1.7, 2.1, 0.02], [0, 1.1, -0.19]); break; case 'ward': for (const sx of [-0.33, 0.33]) add([0.58, 1.78, 0.02], [sx, 1.0, 0.31]); break;
    case 'clock': add([0.32, 0.6, 0.02], [0, 0.6, 0.16]); break; case 'lamp': g.traverse(o => { if (o === g.userData.lamp){ o.material = o.material.clone(); o.material.color.set(shade(d.accent, 0.4)); o.material.emissive.set(d.accent); } }); break; }
  return g;
}
function applyMuShow(){ const L = FZ.list || []; if (!Mu.show) return; Mu.show.forEach((s, i) => { const d = L[i]; if (!d || s.id === d.id) return; s.id = d.id; if (s.m) s.slot.remove(s.m); s.m = fzMesh(d); s.m.position.y = 0.08; s.m.rotation.y = i ? -0.5 : 0.5; const sc = d.base === 'dbed' || d.base === 'bed' || d.base === 'shelf' || d.base === 'ward' ? 0.62 : 0.8; s.m.scale.setScalar(sc); s.slot.add(s.m); }); }
const FURN_DEF = [{ id:1, t:'bed', x:-3.4, z:-2.1, r:0 }, { id:2, t:'rug', x:0.5, z:0.4, r:0 }, { id:3, t:'table', x:0.5, z:0.4, r:0 }, { id:4, t:'chair', x:0.5, z:-0.6, r:0 }, { id:5, t:'chair', x:0.5, z:1.4, r:3.14 },
  { id:6, t:'shelf', x:4.2, z:-2.1, r:-1.57 }, { id:7, t:'fire', x:0, z:-3.2, r:0 }, { id:8, t:'tank', x:3.3, z:2.7, r:3.14 }, { id:9, t:'plant', x:-4, z:2.9, r:0 }];
const HOME_ROLES = { mate:'室友', family:'家人', couple:'情侶' };
const HOME_TITLES = ['爸爸', '媽媽', '哥哥', '姊姊', '弟弟', '妹妹', '爺爺', '奶奶', '老公', '老婆', '寶貝', '房東'];
// 大宅（064_mansion.sql）：格局是玩家自己畫的（1 公尺的格子；房子 18×12，中心在 0,0）
const CL_CACHE = new WeakMap();
function houseLay(it){
  if (it && it.t === 'mansion'){ const c = it.cl || {}, k = JSON.stringify(c), old = CL_CACHE.get(it); if (old && old.k === k) return old.lay;
    const lay = { name:'自己設計', price:0, W:18, D:12, custom:true, walls:[...(c.walls || []), ...(c.wins || [])], doors:c.doors || [], wins:c.wins || [], owins:c.owins || [], fl:c.fl || '0'.repeat(216), wp:c.wp || '0'.repeat(216), rooms:[] }; CL_CACHE.set(it, { k, lay }); return lay; }
  return LAYOUTS[it && it.lay] || LAYOUTS.open; }
const CL_FLOOR = [['木地板', '#c99a6b'], ['藍色地毯', '#a8c8e8'], ['白磁磚', '#eef2ee'], ['格子磁磚', '#e8d4a8'], ['粉紅地毯', '#f2c4d8'], ['深色木頭', '#7a5638']];
const CL_WALL = [['米白', '#f4ead6'], ['天空藍', '#cfe6f4'], ['淡粉紅', '#f8dce6'], ['薄荷綠', '#dcefd8'], ['海軍藍', '#3a4a5e']];
function clFloorTex(i){ const [, col] = CL_FLOOR[i] || CL_FLOOR[0]; return roomTex('clf' + i, 64, 64, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h);
  if (i === 0 || i === 5){ c.fillStyle = shade(col, -0.18); for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 2); for (let y = 0; y < h; y += 16) c.fillRect(((y / 16) % 2) * 32 + 10, y, 2, 16); }
  else if (i === 2 || i === 3){ c.fillStyle = i === 3 ? '#d8b878' : '#d4dcd8'; if (i === 3){ for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) c.fillRect(x, y, 16, 16); } c.fillStyle = shade(col, -0.15); for (let k = 0; k < w; k += 32){ c.fillRect(k, 0, 1, h); c.fillRect(0, k, w, 1); } }
  else { c.fillStyle = shade(col, 0.08); for (let k = 0; k < 40; k++) c.fillRect((k * 37) % w, (k * 53) % h, 2, 2); } }); }
function houseFurn(it){ return it && Array.isArray(it.f) ? it.f : FURN_DEF.map(x => Object.assign({}, x)); }
function segD(px, pz, ax, az, bx, bz){ const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? clamp(((px - ax) * dx + (pz - az) * dz) / L, 0, 1) : 0; return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)); }
// 跟伺服器的 _furn_check 一樣
function furnCheck(lay, f, type, x, z, skip){
  const me = FURN[type]; if (!me) return '沒有這種家具';
  if (Math.abs(x) > lay.W / 2 - 0.25 || Math.abs(z) > lay.D / 2 - 0.25) return '放在房間外面了';
  if (!me.flat && Math.hypot(x, z - (lay.D / 2 - 0.6)) < me.rad * 0.7 + 0.8) return '會擋住大門';
  for (const w of lay.walls) if (segD(x, z, w[0], w[1], w[2], w[3]) < me.rad * 0.7) return '卡在牆上了';
  if (!me.flat) for (const d of lay.doors) if (Math.hypot(x - d[0], z - d[1]) < me.rad * 0.7 + 0.7) return '會擋住房門';
  for (const o of f){ if (o.id === skip) continue; const it = FURN[o.t]; if (!it || it.flat || me.flat) continue; if (Math.hypot(o.x - x, o.z - z) < (it.rad + me.rad) * 0.75) return '跟別的家具疊在一起了'; }
  return null;
}
function cleanFurn(f){ if (Array.isArray(f)) for (const x of f) if (x && !FURN[x.t] && fzId(x.t)) fzWant(fzId(x.t)); return Array.isArray(f) ? f.filter(x => x && (FURN[x.t] || fzId(x.t)) && isFinite(+x.x) && isFinite(+x.z)).slice(0, 40).map(x => Object.assign({ id: Math.floor(+x.id) || 0, t: x.t, x: +x.x, z: +x.z, r: +x.r || 0 }, typeof x.own === 'string' && x.own.length < 64 ? { own: x.own } : {})) : null; }

// 家具的樣子（正面朝 +z，放在地板上）
function furnMesh(t){
  if (FURN[t] && FURN[t].dz) return FURN[t].dz.base === 'paint' ? paintMesh(FURN[t].dz) : fzMesh(FURN[t].dz);
  if (t === 'paint') return paintMesh({ main:'#f1e3c8', accent:'#8c5d3b', pat:'sea', fish:null });
  if (FURN[t] && FURN[t].kk) return kkfMesh(t);
  const g = new THREE.Group(), B = (sz, c, p, rough) => { const b = box(sz, c, p, mat(c, rough == null ? 0.8 : rough, { emissive:c, emissiveIntensity:0.1 })); g.add(b); return b; };
  const C = (rt, rb, h, c, p, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat(c, 0.7, { emissive:c, emissiveIntensity:0.1 })); m.position.set(p[0], p[1], p[2]); g.add(m); return m; };
  const wood = '#8c5d3b', lw = '#c79a6b';
  switch (t){
    case 'bed': case 'dbed': { const w = t === 'dbed' ? 1.7 : 1.1; B([w + 0.1, 0.35, 2.1], wood, [0, 0.18, 0]); B([w, 0.2, 1.95], '#ffffff', [0, 0.45, 0.02]); B([w + 0.02, 0.1, 1.25], t === 'dbed' ? '#5f8fd8' : '#f17b6d', [0, 0.58, 0.35]);
      for (const sx of t === 'dbed' ? [-0.4, 0.4] : [0]) B([0.6, 0.14, 0.34], '#fff6e6', [sx, 0.6, -0.72]); B([w + 0.1, 0.9, 0.1], wood, [0, 0.45, -1.02]); break; }
    case 'bunk': { for (const sx of [-0.55, 0.55]) for (const sz of [-0.98, 0.98]) B([0.08, 1.9, 0.08], wood, [sx, 0.95, sz]); for (const y of [0.35, 1.3]){ B([1.12, 0.1, 2.0], wood, [0, y, 0]); B([1.02, 0.16, 1.9], '#ffffff', [0, y + 0.13, 0]); B([1.04, 0.08, 1.2], y < 1 ? '#3fbf9d' : '#ffd36a', [0, y + 0.24, 0.3]); }
      for (let i = 0; i < 4; i++) B([0.4, 0.05, 0.05], wood, [0.62, 0.5 + i * 0.3, 0.6]); break; }
    case 'ward': B([1.3, 2.0, 0.6], lw, [0, 1.0, 0]); B([0.02, 1.9, 0.02], wood, [0, 1.0, 0.31]); for (const sx of [-0.12, 0.12]) B([0.05, 0.2, 0.04], '#e8b730', [sx, 1.0, 0.32]); break;
    case 'desk': B([1.2, 0.07, 0.6], lw, [0, 0.74, 0]); for (const sx of [-0.55, 0.55]) B([0.06, 0.72, 0.56], wood, [sx, 0.36, 0]); B([0.5, 0.32, 0.04], '#2a2f3a', [0, 0.95, -0.2]); B([0.3, 0.02, 0.15], '#dfe6ee', [0, 0.79, 0.08]); break;
    case 'lamp': C(0.18, 0.2, 0.05, '#4c4c4c', [0, 0.03, 0]); C(0.03, 0.03, 1.5, '#4c4c4c', [0, 0.78, 0]); { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 12, 1, true), new THREE.MeshStandardMaterial({ color:'#fff3c4', emissive:'#ffd36a', emissiveIntensity:0.9, side:THREE.DoubleSide })); s.position.y = 1.55; g.add(s); g.userData.lamp = s; } break;
    case 'clock': B([0.45, 1.8, 0.3], wood, [0, 0.9, 0]); { const fc = C(0.16, 0.16, 0.03, '#fff6e6', [0, 1.45, 0.16], 16); fc.rotation.x = Math.PI / 2; } B([0.02, 0.4, 0.02], '#e8b730', [0, 0.85, 0.16]); break;
    case 'sofa': case 'arm': { const w = t === 'sofa' ? 2.0 : 0.85, c = t === 'sofa' ? '#5f8f7a' : '#d87a5a'; B([w, 0.42, 0.85], c, [0, 0.21, 0]); B([w, 0.55, 0.2], c, [0, 0.62, -0.33]); for (const sx of [-1, 1]) B([0.16, 0.55, 0.85], c, [sx * (w / 2 - 0.08), 0.4, 0]);
      const n = t === 'sofa' ? 3 : 1; for (let i = 0; i < n; i++) B([w / n - 0.12, 0.1, 0.6], '#f6efe2', [-w / 2 + (i + 0.5) * w / n, 0.47, 0.05]); break; }
    case 'tv': B([1.8, 0.5, 0.5], wood, [0, 0.25, 0]); B([1.4, 0.8, 0.06], '#15181c', [0, 0.95, -0.1]); B([1.3, 0.7, 0.01], '#2b4a6a', [0, 0.95, -0.065]); break;
    case 'table': B([1.3, 0.08, 0.9], lw, [0, 0.72, 0]); for (const [lx, lz] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) B([0.08, 0.7, 0.08], wood, [lx, 0.35, lz]); break;
    case 'chair': B([0.5, 0.06, 0.5], '#c98a5a', [0, 0.45, 0]); B([0.5, 0.5, 0.06], '#c98a5a', [0, 0.72, -0.22]); for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) B([0.05, 0.45, 0.05], wood, [lx, 0.22, lz]); break;
    case 'shelf': { B([1.8, 2.2, 0.4], wood, [0, 1.1, 0]); const bc = ['#f17b6d', '#2f89c7', '#ffd36a', '#3fbf9d', '#9b7bff']; for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) B([0.26, 0.32, 0.18], bc[(r + k) % 5], [-0.65 + k * 0.26, 0.35 + r * 0.5, 0.13]); break; }
    case 'rug': { const r = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), mat('#e8a8b8', 0.9, { emissive:'#e8a8b8', emissiveIntensity:0.1 })); r.rotation.x = -Math.PI / 2; r.position.y = 0.012; r.receiveShadow = true; g.add(r);
      const r2 = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.18, 28), mat('#ffffff', 0.9)); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.016; g.add(r2); break; }
    case 'fire': { B([1.4, 1.2, 0.5], '#b7b2a4', [0, 0.6, 0]); B([0.9, 0.6, 0.1], '#2a1a14', [0, 0.45, 0.21]); B([1.6, 0.12, 0.6], '#d8d2c4', [0, 1.26, 0]);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 6), new THREE.MeshStandardMaterial({ color:'#ffb040', emissive:'#ff7a1a', emissiveIntensity:1.8 })); fl.position.set(0, 0.42, 0.18); g.add(fl); g.userData.fire = fl; break; }
    case 'piano': B([1.5, 1.1, 0.6], '#1e1e22', [0, 0.75, -0.1], 0.3); B([1.4, 0.06, 0.3], '#f8f8f4', [0, 0.82, 0.3]); for (let i = 0; i < 10; i++) B([0.05, 0.03, 0.16], '#1e1e22', [-0.6 + i * 0.13, 0.86, 0.26]); for (const sx of [-0.65, 0.65]) B([0.08, 0.8, 0.08], '#1e1e22', [sx, 0.4, 0.3]); B([0.8, 0.45, 0.35], '#1e1e22', [0, 0.23, 0.85]); break;
    case 'tank': { B([1.4, 0.7, 0.6], wood, [0, 0.35, 0]); const gl = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.55), new THREE.MeshStandardMaterial({ color:'#9fe3ff', transparent:true, opacity:0.35, emissive:'#2f89c7', emissiveIntensity:0.3, depthWrite:false })); gl.position.y = 1.1; g.add(gl); g.userData.tank = 1; break; }
    case 'fridge': B([0.8, 1.8, 0.7], '#eef2f4', [0, 0.9, 0], 0.4); B([0.78, 0.02, 0.02], '#b8c0c6', [0, 1.2, 0.36]); B([0.04, 0.4, 0.04], '#8a9298', [0.3, 1.45, 0.37]); B([0.04, 0.3, 0.04], '#8a9298', [0.3, 0.85, 0.37]); break;
    case 'stove': B([0.8, 0.9, 0.65], '#e6e9ec', [0, 0.45, 0], 0.4); B([0.78, 0.03, 0.62], '#2a2f3a', [0, 0.91, 0]); for (const [sx, sz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]){ const r = C(0.1, 0.1, 0.02, '#4c4c4c', [sx, 0.93, sz]); } B([0.6, 0.35, 0.02], '#2a2f3a', [0, 0.4, 0.33]); break;
    case 'sink': B([1.1, 0.9, 0.65], '#7fb0a0', [0, 0.45, 0]); B([1.12, 0.05, 0.67], '#e6e9ec', [0, 0.92, 0]); B([0.5, 0.04, 0.35], '#9aa4ab', [0, 0.95, 0.02]); B([0.04, 0.25, 0.04], '#b8c0c6', [0, 1.05, -0.22]); break;
    case 'bath': B([1.0, 0.6, 1.8], '#f8f8f4', [0, 0.3, 0], 0.3); B([0.8, 0.04, 1.6], '#9fd8f0', [0, 0.55, 0]); B([0.05, 0.3, 0.05], '#b8c0c6', [0, 0.75, -0.85]); break;
    case 'toilet': B([0.45, 0.4, 0.55], '#f8f8f4', [0, 0.2, 0.05], 0.3); B([0.48, 0.05, 0.5], '#ffffff', [0, 0.43, 0.08]); B([0.45, 0.5, 0.2], '#f8f8f4', [0, 0.6, -0.22], 0.3); break;
    case 'plant': case 'bigplant': { const k = t === 'bigplant' ? 1.5 : 1; C(0.25 * k, 0.2 * k, 0.4 * k, '#c7643e', [0, 0.2 * k, 0]); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 * k, 0), mat('#5d9c55', 0.85, { flatShading:true })); l.position.y = 0.7 * k; g.add(l);
      if (t === 'bigplant') for (const [x, y, z] of [[0.35, 1.3, 0], [-0.3, 1.4, 0.15], [0, 1.6, -0.2]]){ const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat('#6fae52', 0.85, { flatShading:true })); b.position.set(x, y, z); g.add(b); } break; }
  }
  return g;
}

// ---- 家的資料（住在誰家、住戶、邀請）----
const Home = { owner:null, people:[], invites:[], sent:[], cap:6, at:0, told:{} };
function canEditIsle(owner){ owner = owner || (onIsle && onIsle.owner); const meId = myIdOrMe(); return !!owner && (owner === meId || (Home.owner === owner && Home.people.some(p => p.id === meId))); }
function homeMate(uid){ return uid && Home.people.find(p => p.id === uid && p.id !== myIdOrMe()); }
function homeTitle(p){ return p ? (p.title || (p.owner ? '島主' : HOME_ROLES[p.role] || '室友')) : ''; }
async function loadHome(){
  if (!Cloud.on || !Cloud.sb) return; try { const { data, error } = await Cloud.sb.rpc('get_home'); if (error || !data) return; adoptHome(data); } catch(e){}
}
function adoptHome(d){
  Home.owner = d.owner || null; Home.people = Array.isArray(d.people) ? d.people : []; Home.invites = Array.isArray(d.invites) ? d.invites : []; Home.sent = Array.isArray(d.sent) ? d.sent : []; Home.cap = d.cap || 6; Home.at = Date.now();
  for (const iv of Home.invites){ const k = iv.owner + iv.at; if (!Home.told[k]){ Home.told[k] = 1; ticker(`🏠 <b>${esc(iv.name || '朋友')}</b> 邀請你搬進他家！到「小島」分頁的「🏠 我的家」回覆`); } }
  for (const p of peers.values()) p.fisher.setName(peerName(p));
  $$('[data-tab="island"]').forEach(b => b.classList.toggle('hasdot', Home.invites.length > 0));
  if (!$('#sheet').hidden && curTab === 'island') renderTab(); if (onIsle) renderIsleBar();
}
async function homeRpc(fn, args){ if (!Cloud.on || !Cloud.sb){ toast('要連上雲端才能用家的功能'); return null; } try { const { data, error } = await Cloud.sb.rpc(fn, args || {}); if (error) throw error; adoptHome(data); return data; } catch(e){ toast(cloudErrMsg(e)); return null; } }
function cloudErrMsg(e){ const m = String(e && (e.message || e) || ''); return /[一-龥]/.test(m) ? m.replace(/^.*?([一-龥])/, '$1') : '暫時連不上雲端'; }
async function goHome(){
  const meId = myIdOrMe(); if (!Home.owner || Home.owner === meId){ closeSheet(); goMyIsle(); return; }
  const o = Home.people.find(p => p.id === Home.owner); await visitIsle(Home.owner, (o && o.name) || '家');
}

// ---- 一起蓋家：島上的東西、格局、家具都經過伺服器（島主和住戶都可以）----
function editLayout(){ return onIsle && onIsle.owner !== myIdOrMe() && canEditIsle() ? onIsle.layout : rec.island; }
function isleItems(){ return editLayout().items; }
async function homeOp(op, p){
  const owner = onIsle ? onIsle.owner : myIdOrMe(), mine = owner === myIdOrMe();
  if (!Cloud.on || !Cloud.sb){ if (!mine){ toast('要連上雲端才能幫別人蓋家'); return false; } const err = localHomeOp(op, p); if (err){ toast(err); return false; } afterHomeOp(rec.island); return true; }
  try { const { data, error } = await Cloud.sb.rpc('home_edit', { p_owner: owner, p_op: op, p }); if (error) throw error;
    const L = cleanIsland(data.island); if (mine) rec.island = L; if (onIsle && onIsle.owner === owner) onIsle.layout = L; rec.coins = Number(data.coins) || 0; saveRecLocal(); renderCoins(); afterHomeOp(L); return true; }
  catch(e){ toast(cloudErrMsg(e)); return false; }
}
function afterHomeOp(L){
  if (!onIsle) return; onIsle.layout = L; const keepHouse = House.on && House.it ? House.it.id : null;
  buildIsle(L, onIsle.name);
  if (keepHouse){ const it = L.items.find(i => i.id === keepHouse); if (it) rebuildHouseRoom(it); else exitHouse(); }
  renderBuildBar(); renderFurnBar(); renderIsleBar();
}
// 沒連雲端時（只有自己的島）在本機照一樣的規則改
function localHomeOp(op, p){
  const items = rec.island.items, cost = n => { if (rec.coins < n) return `金幣不夠，還差 🪙${(n - rec.coins).toLocaleString()}`; addCoins(-n); return null; };
  if (op === 'place'){ const T = ISLE_ITEMS[p.t], e = isleCheck(items, p.t, p.x, p.z, -1); if (e) return e; if (items.length >= ISLE_MAX) return '島上已經放滿了'; if (T.house && items.filter(i => ISLE_ITEMS[i.t].house).length >= ISLE_HOUSE_MAX) return '房子最多 6 棟'; const c = cost(T.price); if (c) return c; items.push({ id: items.reduce((m, i) => Math.max(m, i.id), 0) + 1, t:p.t, x:p.x, z:p.z, r:p.r }); }
  else if (op === 'design'){ const it = items.find(i => i.id === p.house); if (!it || it.t !== 'mansion') return '只有大宅可以自己設計格局'; it.cl = Object.assign({ owins: (p.cl.wins || []).filter(w => w[0] === w[2] ? Math.abs(w[0]) === 9 : Math.abs(w[1]) === 6) }, p.cl, { wins: (p.cl.wins || []).filter(w => !(w[0] === w[2] ? Math.abs(w[0]) === 9 : Math.abs(w[1]) === 6)) }); it.lay = 'custom'; }
  else if (op === 'move'){ const it = items.find(i => i.id === p.id); if (!it) return '找不到這個東西'; const e = isleCheck(items, it.t, p.x, p.z, it.id); if (e) return e; Object.assign(it, { x:p.x, z:p.z, r:p.r }); }
  else if (op === 'remove'){ const it = items.find(i => i.id === p.id); if (!it) return '找不到這個東西'; let back = Math.floor(ISLE_ITEMS[it.t].price / 2); if (it.f) back += it.f.reduce((a, x) => a + Math.floor(FURN[x.t].price / 2), 0); if (it.lay) back += Math.floor(houseLay(it).price / 2); rec.island.items = items.filter(i => i !== it); addCoins(back); }
  else { const h = items.find(i => i.id === p.house); if (!h) return '找不到這棟房子'; const f = houseFurn(h), lay = houseLay(h);
    if (op === 'layout'){ const nl = LAYOUTS[p.lay]; if (!nl) return '沒有這種格局'; let back = Math.max(0, Math.floor((lay.price - nl.price) / 2)); const keep = []; for (const o of f){ if (furnCheck(nl, keep, o.t, o.x, o.z, -1)) back += FURN[o.t].price; else keep.push(o); }
      const need = Math.max(0, nl.price - lay.price); if (rec.coins + back < need) return '金幣不夠'; addCoins(back - need); h.lay = p.lay; h.f = keep; }
    else if (op === 'fplace'){ const e = furnCheck(lay, f, p.t, p.x, p.z, -1); if (e) return e; if (f.length >= 40) return '這棟房子已經擺滿了'; const c = cost(FURN[p.t].price); if (c) return c; f.push({ id: f.reduce((m, i) => Math.max(m, i.id), 0) + 1, t:p.t, x:p.x, z:p.z, r:p.r }); h.f = f; }
    else if (op === 'fmove'){ const o = f.find(i => i.id === p.id); if (!o) return '找不到這個家具'; const e = furnCheck(lay, f, o.t, p.x, p.z, o.id); if (e) return e; Object.assign(o, { x:p.x, z:p.z, r:p.r }); h.f = f; }
    else if (op === 'fremove'){ const o = f.find(i => i.id === p.id); if (!o) return '找不到這個家具'; addCoins(Math.floor(FURN[o.t].price / 2)); h.f = f.filter(i => i !== o); }
    else if (op === 'bed'){ const o = f.find(i => i.id === p.id); if (!o || !FURN[o.t].bed) return '這不是床'; const meId = myIdOrMe(); if (o.own && o.own !== meId) return '這張床已經有人了';
      if (o.own === meId) delete o.own; else { for (const it of items) if (it.f) it.f.forEach(x => { if (x.own === meId) delete x.own; }); o.own = meId; } h.f = f; } }
  saveRecLocal(); return null;
}

// ---- 房子裡面 ----
function roomName(uid){ if (uid === myIdOrMe()) return myDisplayName() === '你' ? '我' : myDisplayName(); const p = Home.people.find(x => x.id === uid); return (p && p.name) || profileNames[uid] || '室友'; }
function roomSign(text, x, y, z, ry){
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#8c5d3b'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff4d6'; c.fillRect(6, 6, 244, 52);
  c.fillStyle = '#5a3d2b'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text.slice(0, 9), 128, 33);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: tx, side:THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; return m;
}
function enterHouse(door){
  if (House.on) return; SFX.door(); stopBuild(); const it = door.it, T = ISLE_ITEMS[it.t];
  House.on = true; House.type = it.t; House.back = { x: door.x, z: door.z, rot: door.face };
  rebuildHouseRoom(it);
  const fx = $('#fadeFx'); fx.classList.add('on'); const lay = houseLay(it);
  setTimeout(() => { me.pos.x = ISLE.x; me.pos.z = ISLE.z + lay.D / 2 - 1.4; me.baseY = ROOM_Y; Jump.gy = ROOM_Y; me.rot = Math.PI; cam.yaw = 0; cam.pitch = Math.max(cam.pitch, 0.6); House.savedDist = cam.dist; cam.dist = Math.min(cam.dist, 7); pushPresence(true); setTimeout(() => fx.classList.remove('on'), 80); }, 220);
  flash(`🏠 ${T.name}・${lay.name}`, 1.0); renderIsleBar();
}
function clearHouseRoom(){
  if (House.group) scene.remove(House.group); for (const c of House.cols){ const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } House.cols = [];
  const di = decks.indexOf(House.deck); if (di >= 0) decks.splice(di, 1); CHAIRS_ROOM.length = 0; if (mySeat && mySeat.room){ mySeat = null; me.sitting = false; }
  House.group = null; House.fish = []; House.fires = []; House.lamps = []; House.furnG = new Map();
}
// 大宅的地板（每一格照房間的地板）、壁紙（每一面牆照旁邊那一格的房間）、窗戶
function clDecorate(g, lay, cx, cz, fy){
  const W = 18, D = 12, cell = (x, z) => (z + 6) * 18 + (x + 9), byF = {}, byW = {};
  for (let z = -6; z < 6; z++) for (let x = -9; x < 9; x++){ const i = +lay.fl[cell(x, z)] || 0; (byF[i] = byF[i] || []).push([x, z]); }
  for (const [i, cs] of Object.entries(byF)){ const gs = cs.map(([x, z]) => { const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2); pg.translate(x + 0.5, 0, z + 0.5); return pg; }); const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ map: clFloorTex(+i), roughness: 0.85, emissive: '#ffffff', emissiveMap: clFloorTex(+i), emissiveIntensity: 0.2 })); m.position.set(cx, fy + 0.004, cz); g.add(m); }
  // 壁紙：每一面牆（外牆、自己畫的牆、窗戶）兩邊各貼一片，顏色照那一邊的房間
  const panel = (x0, z0, x1, z1, side, h, wpI) => { const vert = x0 === x1, pg = new THREE.PlaneGeometry(1, h * 0.62); if (vert) pg.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2); else if (side < 0) pg.rotateY(Math.PI);
    pg.translate((x0 + x1) / 2 + (vert ? side * 0.08 : 0), h * 0.69, (z0 + z1) / 2 + (vert ? 0 : side * 0.08)); (byW[wpI] = byW[wpI] || []).push(pg); };
  const sideCell = (x0, z0, x1, z1, side) => x0 === x1 ? [side > 0 ? x0 : x0 - 1, Math.min(z0, z1)] : [Math.min(x0, x1), side > 0 ? z0 : z0 - 1];
  const inner = [...lay.walls]; for (const w of inner) for (const sd of [-1, 1]){ const [x, z] = sideCell(w[0], w[1], w[2], w[3], sd); if (x < -9 || x >= 9 || z < -6 || z >= 6) continue; panel(w[0], w[1], w[2], w[3], sd, 2.2, +lay.wp[cell(x, z)] || 0); }
  for (let x = -9; x < 9; x++){ panel(x, -6, x + 1, -6, 1, 3.2, +lay.wp[cell(x, -6)] || 0); }
  for (let z = -6; z < 6; z++){ panel(-9, z, -9, z + 1, 1, 3.2, +lay.wp[cell(-9, z)] || 0); panel(9, z, 9, z + 1, -1, 3.2, +lay.wp[cell(8, z)] || 0); }
  for (const [i, gs] of Object.entries(byW)){ const col = (CL_WALL[+i] || CL_WALL[0])[1]; const m = new THREE.Mesh(mergeGeometries(gs), mat(col, 0.9, { emissive: col, emissiveIntensity: 0.15 })); m.position.set(cx, fy, cz); g.add(m); }
  // 窗戶：自己畫的牆上的窗戶、外牆的窗戶
  const glass = new THREE.MeshBasicMaterial({ color:'#bfe6f8', transparent:true, opacity:0.75 });
  for (const w of [...lay.wins, ...lay.owins]){ const vert = w[0] === w[2], mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2, outer = Math.abs(mx) === 9 || Math.abs(mz) === 6;
    const gm = new THREE.Mesh(new THREE.BoxGeometry(vert ? 0.17 : 0.7, 0.8, vert ? 0.7 : 0.17), glass); gm.position.set(cx + mx + (outer && vert ? -Math.sign(mx) * 0.1 : 0), fy + 1.5, cz + mz + (outer && !vert ? -Math.sign(mz) * 0.1 : 0)); g.add(gm);
    g.add(box([vert ? 0.2 : 0.86, 0.07, vert ? 0.86 : 0.2], '#8c5d3b', [cx + gm.position.x - cx, fy + 1.92, cz + gm.position.z - cz])); g.add(box([vert ? 0.2 : 0.86, 0.07, vert ? 0.86 : 0.2], '#8c5d3b', [cx + gm.position.x - cx, fy + 1.08, cz + gm.position.z - cz])); }
}
function rebuildHouseRoom(it){
  clearHouseRoom(); clearFurnGhost();
  const T = ISLE_ITEMS[it.t], lay = houseLay(it), f = houseFurn(it), W = lay.W, D = lay.D, cx = ISLE.x, cz = ISLE.z, fy = ROOM_Y;
  House.it = it; const g = new THREE.Group(); scene.add(g); House.group = g; const n0 = colliders.length;
  const warm = (c, r) => mat(c, r == null ? 0.85 : r, { emissive: c, emissiveIntensity: 0.12 });
  const wallC = T.wall || (it.t === 'tea' ? '#efe3c8' : it.t === 'beach' ? '#e6f3f7' : '#f6e4bd'), floorC = it.t === 'tea' ? '#c9b27a' : '#c99a6b';
  /* 地板：木頭地板的貼圖（不再用一條一條細線，手機上會閃成虛線）；比牆小一點點，邊緣才不會跟牆打架 */
  const floorTx = roomTex('floor' + floorC, 256, 256, (c, w, h) => { c.fillStyle = floorC; c.fillRect(0, 0, w, h); const rows = 8;
    for (let r = 0; r < rows; r++){ const y = r * h / rows, off = (r % 2) * w / 3; for (let k = -1; k < 3; k++){ const x = off + k * w / 1.5;
      c.fillStyle = shade(floorC, ((r * 7 + k * 3) % 5 - 2) * 0.025); c.fillRect(x + 2, y + 2, w / 1.5 - 4, h / rows - 4); c.fillStyle = shade(floorC, -0.22); c.fillRect(x, y, 2, h / rows); }
      c.fillStyle = shade(floorC, -0.2); c.fillRect(0, y, w, 2); } });
  floorTx.repeat.set(W / 3, D / 3);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.2, D - 0.04), new THREE.MeshStandardMaterial({ map: floorTx, roughness: 0.85, emissive: '#ffffff', emissiveMap: floorTx, emissiveIntensity: 0.22 })); floor.position.set(cx, fy - 0.1, cz); g.add(floor);
  /* 牆：下半截木頭護牆板、上半截壁紙；盒子從裡面看，靠鏡頭那面會自動看不到（像娃娃屋） */
  const wallTx = roomTex('wall' + wallC, 64, 256, (c, w, h) => { c.fillStyle = wallC; c.fillRect(0, 0, w, h);
    c.fillStyle = shade(wallC, -0.05); for (let y = 0; y < h * 0.66; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) c.fillRect(x + 6, y + 6, 4, 4);
    const wy = h * 0.66; c.fillStyle = '#b07a4e'; c.fillRect(0, wy, w, h - wy); c.fillStyle = '#9a6840'; for (let x = 0; x < w; x += 32) c.fillRect(x, wy, 2, h - wy);
    c.fillStyle = '#7a4e2e'; c.fillRect(0, wy - 4, w, 6); c.fillRect(0, h - 10, w, 10); });
  wallTx.wrapT = THREE.ClampToEdgeWrapping;
  const roomG = new THREE.BoxGeometry(W, 3.3, D); { const uv = roomG.attributes.uv, pos = roomG.attributes.position; for (let k = 0; k < uv.count; k++){ const x = pos.getX(k), z = pos.getZ(k), y = pos.getY(k); const side = Math.abs(Math.abs(x) - W / 2) < 1e-3 ? z : x; uv.setXY(k, side / 1.6, (y + 1.65) / 3.3); } }
  wallTx.wrapS = THREE.RepeatWrapping;
  const room = new THREE.Mesh(roomG, new THREE.MeshStandardMaterial({ map: wallTx, roughness: 0.9, side: THREE.BackSide, emissive: '#ffffff', emissiveMap: wallTx, emissiveIntensity: 0.2 })); room.position.set(cx, fy + 1.6, cz); g.add(room);
  /* 外面：白天是淡淡的天空色、晚上是深藍，不要一片咖啡色 */
  const back = new THREE.Mesh(new THREE.BoxGeometry(70, 30, 70), new THREE.MeshBasicMaterial({ color:'#a9d6e8', side:THREE.BackSide, fog:false })); back.position.set(cx, fy + 5, cz); g.add(back); House.bg = back.material;
  /* 房子底下一圈草地和石頭地基，看起來是一棟放在島上的房子 */
  { const lawn = new THREE.Mesh(new THREE.CircleGeometry(Math.max(W, D) * 0.95, 40), new THREE.MeshBasicMaterial({ color:'#7fb069', fog:false })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, fy - 0.32, cz); g.add(lawn); House.lawn = lawn.material;
    g.add(box([W + 0.3, 0.3, D + 0.3], '#9a9284', [cx, fy - 0.2, cz])); }
  /* 天花板的吊燈和燈光照在地上的一圈暖光 */
  { const pool = new THREE.Mesh(new THREE.CircleGeometry(Math.min(W, D) * 0.48, 32), new THREE.MeshBasicMaterial({ map: roomTex('pool', 128, 128, (c, w) => { const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(cx, fy + 0.02, cz); g.add(pool); House.pool = pool.material;
    const cord = box([0.03, 0.9, 0.03], '#3a2a1e', [cx, fy + 2.75, cz]); g.add(cord);
    const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 16, 1, true), new THREE.MeshStandardMaterial({ color:'#f3d9a4', emissive:'#ffcf7a', emissiveIntensity:0.6, side:THREE.DoubleSide })); shadeM.position.set(cx, fy + 2.2, cz); g.add(shadeM);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color:'#fff1c8' })); bulb.position.set(cx, fy + 2.04, cz); g.add(bulb); House.bulb = bulb.material; }
  addDeck(cx, cz, W - 0.2, D - 0.2, fy); House.deck = decks[decks.length - 1];
  addBoxCol(cx, cz - D / 2 - 0.2, W + 1, 0.4); addBoxCol(cx, cz + D / 2 + 0.2, W + 1, 0.4); addBoxCol(cx - W / 2 - 0.2, cz, 0.4, D + 1); addBoxCol(cx + W / 2 + 0.2, cz, 0.4, D + 1);
  // 隔間牆（矮一點，鏡頭比較不會被擋住）和房門的門框
  const pw = warm(shade(wallC, -0.06), 0.9);
  for (const [ax, az, bx, bz] of lay.walls){ const L = Math.hypot(bx - ax, bz - az), along = Math.abs(bx - ax) > Math.abs(bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const wg = new THREE.BoxGeometry(along ? L : 0.14, 2.2, along ? 0.14 : L); { const uv = wg.attributes.uv, ps = wg.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, (ps.getX(k) + ps.getZ(k)) / 1.6, (ps.getY(k) + 1.1) / 3.3); }   /* 跟外牆一樣：下面護牆板、上面壁紙 */
    const w = new THREE.Mesh(wg, room.material.clone()); w.material.side = THREE.FrontSide; w.position.set(cx + mx, fy + 1.1, cz + mz); g.add(w); g.add(box([along ? L : 0.18, 0.08, along ? 0.18 : L], '#8c5d3b', [cx + mx, fy + 2.24, cz + mz]));
    addBoxCol(cx + mx, cz + mz, along ? L : 0.2, along ? 0.2 : L); }
  if (lay.custom) clDecorate(g, lay, cx, cz, fy);
  for (const [dx, dz] of lay.doors){ const along = lay.custom ? Math.abs(dx - Math.round(dx)) > 0.01 : lay.walls.some(w => Math.abs(w[1] - w[3]) < 0.01 && Math.abs(w[1] - dz) < 0.01); g.add(box([along ? 1.4 : 0.2, 0.18, along ? 0.2 : 1.4], '#8c5d3b', [cx + dx, fy + 2.1, cz + dz])); }
  // 窗戶、大門
  const winM = new THREE.MeshBasicMaterial({ color:'#ffffff', map: roomTex('winday', 64, 48, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd0f0'); gr.addColorStop(1, '#d9f1fb'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(16, 30, 6, 0, 7); c.arc(24, 28, 8, 0, 7); c.arc(32, 31, 5, 0, 7); c.fill(); }) }); House.win = winM;
  House.winTx = [winM.map, roomTex('winnight', 64, 48, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0f1a33'); gr.addColorStop(1, '#2a3d66'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(46, 14, 6, 0, 7); c.fill(); c.fillStyle = '#ffffff'; for (const [x, y] of [[8, 8], [20, 18], [30, 6], [14, 32], [52, 34], [38, 24]]) c.fillRect(x, y, 1.5, 1.5); })];
  for (const wx of W > 10 ? [-W / 3, 0, W / 3] : [-W / 4, W / 4]){ const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), winM); wn.position.set(cx + wx, fy + 1.8, cz - D / 2 + 0.02); g.add(wn); g.add(box([1.5, 0.08, 0.08], '#8c5d3b', [cx + wx, fy + 1.8, cz - D / 2 + 0.05])); g.add(box([0.08, 1.1, 0.08], '#8c5d3b', [cx + wx, fy + 1.8, cz - D / 2 + 0.05])); }
  /* 大門在靠鏡頭那面牆（會被切掉看不到），所以只放門口的地墊、門檻和出口箭頭，不會擋住人 */
  g.add(box([1.4, 0.03, 0.8], '#6f8f5a', [cx, fy + 0.015, cz + D / 2 - 0.55])); g.add(box([1.2, 0.035, 0.6], '#8fb07a', [cx, fy + 0.02, cz + D / 2 - 0.55]));
  g.add(box([1.5, 0.08, 0.12], '#7a4e2e', [cx, fy + 0.04, cz + D / 2 - 0.08]));
  { const ar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ map: roomTex('exitar', 128, 80, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.moveTo(w / 2, h - 6); c.lineTo(w - 14, 30); c.lineTo(w / 2 + 16, 30); c.lineTo(w / 2 + 16, 4); c.lineTo(w / 2 - 16, 4); c.lineTo(w / 2 - 16, 30); c.lineTo(14, 30); c.closePath(); c.fill(); }), transparent: true, depthWrite: false }));
    ar.rotation.x = -Math.PI / 2; ar.position.set(cx, fy + 0.045, cz + D / 2 - 0.55); g.add(ar); }
  House.door = { x: cx, z: cz + D / 2 - 0.9 };
  // 家具
  const tank = (onIsle && onIsle.tank) || [], show = (onIsle && onIsle.show) || [], shown = tank.filter(x => show.includes(x.t) && FISH_BY_ID[x.f] && !BIG_FISH.has(x.f)).slice(0, 4), pick = shown.length ? shown : tank.filter(x => FISH_BY_ID[x.f] && !BIG_FISH.has(x.f)).slice(0, 3);
  for (const o of f){ const F0 = FURN[o.t]; if (!F0){ fzWant(fzId(o.t)); continue; } const m = furnMesh(o.t); m.position.set(cx + o.x, fy, cz + o.z); m.rotation.y = o.r; m.userData.furn = o; g.add(m); House.furnG.set(o.id, m);
    const c = Math.cos(o.r), s = Math.sin(o.r), at = (lx, lz) => ({ x: cx + o.x + c * lx + s * lz, z: cz + o.z - s * lx + c * lz });
    if (m.userData.fire) House.fires.push(m.userData.fire); if (m.userData.lamp) House.lamps.push(m.userData.lamp);
    if (m.userData.tank) pick.forEach((x, i) => { try { const fm = fishModel(FISH_BY_ID[x.f], 0.2); fm.position.set(cx + o.x, fy + 1.1, cz + o.z); g.add(fm); House.fish.push({ f: fm, k: i * 1.7, x: cx + o.x, z: cz + o.z, r: o.r }); } catch(e){} });
    const bt = F0.base || o.t;
    if (bt === 'chair' || bt === 'arm'){ const p = at(0, 0.02); CHAIRS_ROOM.push({ x: p.x, z: p.z, face: o.r, y: fy + 0.02, room: true }); continue; }
    if (bt === 'sofa'){ for (const lx of [-0.62, 0, 0.62]){ const p = at(lx, 0.05); CHAIRS_ROOM.push({ x: p.x, z: p.z, face: o.r, y: fy + 0.02, room: true }); } addBoxCol(cx + o.x, cz + o.z, Math.abs(c) * 1.6 + Math.abs(s) * 0.5, Math.abs(s) * 1.6 + Math.abs(c) * 0.5); continue; }
    if (F0.bed){ const p = at(0.55 * (o.t === 'dbed' ? 1.4 : 1), 0.2); CHAIRS_ROOM.push({ x: p.x, z: p.z, face: o.r + Math.PI / 2, y: fy + 0.12, room: true, bed: o }); addCircleCol(cx + o.x, cz + o.z, 0.55);
      if (o.own){ const nm = roomName(o.own); const rm = lay.rooms.find(r => o.x > r.x0 && o.x < r.x1 && o.z > r.z0 && o.z < r.z1);
        if (rm && !rm._sign){ rm._sign = 1; const vert = Math.abs(rm.door[0]) > 0.01 && lay.walls.some(w => Math.abs(w[0] - w[2]) < 0.01 && Math.abs(w[0] - rm.door[0]) < 0.01); g.add(roomSign(`${nm}的房間`, cx + rm.door[0] + (vert ? (rm.x0 < rm.door[0] ? 0.09 : -0.09) * -1 : 0), fy + 2.45, cz + rm.door[1] + (vert ? 0 : 0.09), vert ? Math.PI / 2 : 0)); }
        else { const sg = roomSign(`${nm}的床`, cx + o.x, fy + 1.35, cz + o.z, o.r); const hb = at(0, -1.07); sg.position.set(hb.x, fy + 1.15, hb.z); g.add(sg); } }
      continue; }
    if (F0.flat) continue;
    addCircleCol(cx + o.x, cz + o.z, F0.rad * 0.6);
  }
  lay.rooms.forEach(r => { delete r._sign; });
  House.cols = colliders.slice(n0);
  g.traverse(o => { if (o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
}
const CHAIRS_ROOM = [];
const _roomTx = new Map();
function roomTex(key, w, h, draw){ let t = _roomTx.get(key); if (t) return t; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; _roomTx.set(key, t); return t; }
function exitHouse(instant){
  if (!House.on) return; const b = House.back; stopFurn();
  const done = () => {
    clearHouseRoom(); House.on = false; House.it = null;
    if (!instant){ me.pos.x = b.x; me.pos.z = b.z; me.baseY = groundHeight(b.x, b.z); Jump.gy = me.baseY; me.rot = b.rot; cam.yaw = b.rot + Math.PI; if (House.savedDist) cam.dist = House.savedDist; }
    pushPresence(true); renderIsleBar();
  };
  if (instant){ done(); return; }
  const fx = $('#fadeFx'); fx.classList.add('on'); setTimeout(() => { done(); setTimeout(() => fx.classList.remove('on'), 80); }, 260);
}
function updateHouse(t){
  if (!House.on) return;
  for (const fl of House.fires || []) fl.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1);
  for (const l of House.lamps || []) l.material.emissiveIntensity = 0.5 + DayNight.lamp * 1.2;
  if (House.win && House.winTx){ const tx = House.winTx[DayNight.lamp > 0.5 ? 1 : 0]; if (House.win.map !== tx){ House.win.map = tx; House.win.needsUpdate = true; } }
  if (House.bg){ const nt = DayNight.lamp > 0.5; House.bg.color.set(nt ? '#1b2440' : '#a9d6e8'); House.lawn.color.set(nt ? '#2f4a3a' : '#7fb069'); House.pool.opacity = nt ? 1 : 0.55; }
  for (const o of House.fish){ const a = t * 0.8 + o.k, c = Math.cos(o.r), s = Math.sin(o.r), lx = Math.cos(a) * 0.45, lz = Math.sin(a * 1.3) * 0.12; o.f.position.x = o.x + c * lx + s * lz; o.f.position.z = o.z - s * lx + c * lz; o.f.rotation.y = o.r + (Math.sin(a) > 0 ? Math.PI : 0); }
  updateFurn();
}

// ---- 擺家具模式（在房子裡面拿著家具走，放在想要的位置）----
const FB = { on:false, type:null, moveId:null, rot:0, ghost:null, x:0, z:0, err:null, sel:null };
function startFurn(type, moveId){
  if (!House.on || !canEditIsle()){ toast('要在自己（或住的）家裡才能擺家具'); return; }
  closeSheet(); clearFurnGhost(); FB.on = true; FB.type = type || null; FB.moveId = moveId || null;
  if (type){ const o = moveId ? houseFurn(House.it).find(x => x.id === moveId) : null; FB.rot = o ? o.r : Math.round(((me.rot + Math.PI) % (Math.PI * 2)) / (Math.PI / 2)) * Math.PI / 2;
    FB.ghost = furnMesh(type); FB.ghost.traverse(o => { if (o.isMesh){ o.material = ghostOk; o.castShadow = false; } }); scene.add(FB.ghost);
    if (moveId){ const m = House.furnG.get(moveId); if (m) m.visible = false; } }
  renderFurnBar(); renderIsleBar();
}
function clearFurnGhost(){ if (FB.ghost){ scene.remove(FB.ghost); FB.ghost = null; } if (FB.moveId && House.furnG){ const m = House.furnG.get(FB.moveId); if (m) m.visible = true; } FB.type = null; FB.moveId = null; }
function stopFurn(){ clearFurnGhost(); FB.on = false; FB.sel = null; renderFurnBar(); }
function updateFurn(){
  if (!FB.on || !House.on || !House.it) return; const lay = houseLay(House.it), f = houseFurn(House.it);
  if (FB.ghost){
    const T = FURN[FB.type], d = T.rad + 0.9, lx = Math.round((me.pos.x + Math.sin(me.rot) * d - ISLE.x) * 4) / 4, lz = Math.round((me.pos.z + Math.cos(me.rot) * d - ISLE.z) * 4) / 4;
    FB.x = lx; FB.z = lz; FB.err = furnCheck(lay, f, FB.type, lx, lz, FB.moveId || -1);
    FB.ghost.position.set(ISLE.x + lx, ROOM_Y + 0.01, ISLE.z + lz); FB.ghost.rotation.y = FB.rot;
    const m = FB.err ? ghostBad : ghostOk; FB.ghost.traverse(o => { if (o.isMesh && o.material !== m) o.material = m; });
    const hint = $('#fbHint'); if (hint){ const t = FB.err || `${T.name}：走路調整位置`; if (hint.textContent !== t) hint.textContent = t; hint.classList.toggle('bad', !!FB.err); }
  } else {
    let best = null, bd = 1.6; for (const o of f){ const dd = Math.hypot(me.pos.x - ISLE.x - o.x, me.pos.z - ISLE.z - o.z) - FURN[o.t].rad * 0.5; if (dd < bd){ bd = dd; best = o; } }
    if ((best && best.id) !== (FB.sel && FB.sel.id)){ FB.sel = best; renderFurnBar(); }
  }
}
function renderFurnBar(){
  let bar = $('#furnBar');
  if (!FB.on){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'furnBar'; bar.className = 'panel buildbar'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = '';
  const btn = (txt, cls, fn) => { const b = el('button', 'tbtn' + (cls ? ' ' + cls : ''), txt); b.addEventListener('click', fn); bar.appendChild(b); return b; };
  if (FB.ghost){ const T = FURN[FB.type]; bar.appendChild(el('span', 'bb-hint', '')).id = 'fbHint';
    btn('⟲ 轉向', 'ghost', () => { FB.rot = (FB.rot + Math.PI / 2) % (Math.PI * 2); });
    btn(FB.moveId ? '✔ 放這裡' : `✔ 放這裡 🪙${T.price.toLocaleString()}`, '', confirmFurn); btn('✖', 'ghost', () => { clearFurnGhost(); renderFurnBar(); }); }
  else if (FB.sel){ const o = FB.sel, T = FURN[o.t]; bar.appendChild(el('span', 'bb-hint', `🛋️ ${T.name}${o.own ? `・${roomName(o.own)}的` : ''}`));
    btn('移動', '', () => startFurn(o.t, o.id));
    if (T.bed && (!o.own || o.own === myIdOrMe())) btn(o.own ? '不睡這張了' : '🛏️ 這是我的床', 'ghost', () => homeOp('bed', { house: House.it.id, id: o.id }).then(ok => ok && toast(o.own ? '已經放掉這張床' : '這張床是你的了！房門上會掛你的名字')));
    const rm = btn(`收掉 +${Math.floor(T.price / 2)}`, 'ghost', () => { if (rm.dataset.sure !== '1'){ rm.dataset.sure = '1'; rm.textContent = '確定收掉？'; rm.classList.add('warn'); return; } homeOp('fremove', { house: House.it.id, id: o.id }).then(ok => { if (ok){ FB.sel = null; toast(`收掉了 ${T.name}，退回 🪙${Math.floor(T.price / 2)}`); } }); });
    btn('🛒', 'ghost', () => openSheet('furn')); btn('完成', 'ghost', stopFurn); }
  else { bar.appendChild(el('span', 'bb-hint', '🛋️ 擺家具：走到家具旁邊可以移動、收掉'));
    btn('🛒 買家具', '', () => openSheet('furn')); btn('🏠 格局', 'ghost', () => { furnSheet = 'lay'; openSheet('furn'); }); btn('完成', 'ghost', stopFurn); }
}
async function confirmFurn(){
  if (!FB.ghost) return; if (FB.err){ toast(FB.err); return; }
  const T = FURN[FB.type], p = { house: House.it.id, x: FB.x, z: FB.z, r: +FB.rot.toFixed(2) }, moving = FB.moveId, type = FB.type;
  if (!moving && rec.coins < T.price){ toast(`金幣不夠，還差 🪙${(T.price - rec.coins).toLocaleString()}`); return; }
  const ok = await homeOp(moving ? 'fmove' : 'fplace', moving ? Object.assign(p, { id: moving }) : Object.assign(p, { t: type }));
  if (!ok) return; SFX.plop(); FX.emit(ISLE.x + p.x, ROOM_Y + 0.6, ISLE.z + p.z, 12, '#fff4dc', 0.5, 1.4, 0.8);
  if (!moving && rec.coins >= T.price && !T.bed) startFurn(type); else { FB.on = true; renderFurnBar(); }
}
// ---- 大宅的格局編輯器：俯視的格子圖，用手指畫牆、門、窗，或幫房間上色 ----
var CLE = null;
function clOpen(it){ const c = JSON.parse(JSON.stringify(it.cl || {})); CLE = { it, tool:'wall', fl:1, wp:1, walls:c.walls || [], doors:c.doors || [], wins:[...(c.wins || []), ...(c.owins || [])], flS:(c.fl || '0'.repeat(216)).split(''), wpS:(c.wp || '0'.repeat(216)).split(''), busy:false }; curTab = 'cldesign'; if ($('#sheet').hidden) openSheet('cldesign'); else renderTab(); }
const CL_PX = 22;
function clKey(e){ return e.map(v => +(+v).toFixed(1)).join(','); }
function clHas(list, e){ const k = clKey(e), k2 = clKey([e[2], e[3], e[0], e[1]]); return list.findIndex(x => clKey(x) === k || clKey(x) === k2); }
function clDoorAt(e){ return [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2]; }
function clEdgeAt(px, pz){   // 點到哪一條格線（房子座標）
  const fx = px - Math.floor(px), fz = pz - Math.floor(pz), dx = Math.min(fx, 1 - fx), dz = Math.min(fz, 1 - fz);
  if (dx < dz){ const x = Math.round(px), z = Math.floor(pz); return [x, z, x, z + 1]; } const z = Math.round(pz), x = Math.floor(px); return [x, z, x + 1, z]; }
function clBlocked(x0, z0, x1, z1){ const e = [x0, z0, x1, z1]; if (x0 === x1 ? Math.abs(x0) === 9 : Math.abs(z0) === 6) return true; return clHas(CLE.walls, e) >= 0 || clHas(CLE.wins, e) >= 0 || CLE.doors.some(d => clKey(d) === clKey(clDoorAt(e))); }
function clFill(x, z){ const seen = new Set(), st = [[x, z]]; while (st.length){ const [cx, cz] = st.pop(), k = cx + ',' + cz; if (seen.has(k) || cx < -9 || cx >= 9 || cz < -6 || cz >= 6) continue; seen.add(k); const i = (cz + 6) * 18 + (cx + 9); CLE.flS[i] = String(CLE.fl); CLE.wpS[i] = String(CLE.wp);
    if (!clBlocked(cx + 1, cz, cx + 1, cz + 1)) st.push([cx + 1, cz]); if (!clBlocked(cx, cz, cx, cz + 1)) st.push([cx - 1, cz]); if (!clBlocked(cx, cz + 1, cx + 1, cz + 1)) st.push([cx, cz + 1]); if (!clBlocked(cx, cz, cx + 1, cz)) st.push([cx, cz - 1]); } }
function clApply(e){ const T = CLE.tool, outer = e[0] === e[2] ? Math.abs(e[0]) === 9 : Math.abs(e[1]) === 6, dk = clKey(clDoorAt(e));
  const rm = () => { let i; if ((i = clHas(CLE.walls, e)) >= 0) CLE.walls.splice(i, 1); if ((i = clHas(CLE.wins, e)) >= 0) CLE.wins.splice(i, 1); CLE.doors = CLE.doors.filter(d => clKey(d) !== dk); };
  if (T === 'erase'){ rm(); return; }
  if (outer && T !== 'win') return; rm();
  if (T === 'wall') CLE.walls.push(e); else if (T === 'win') CLE.wins.push(e); else if (T === 'door' && !outer) CLE.doors.push(clDoorAt(e)); }
function clDraw(cv){ const c = cv.getContext('2d'), P = CL_PX, O = 10; c.clearRect(0, 0, cv.width, cv.height);
  for (let z = -6; z < 6; z++) for (let x = -9; x < 9; x++){ const i = (z + 6) * 18 + (x + 9); c.fillStyle = CL_FLOOR[+CLE.flS[i]][1]; c.fillRect(O + (x + 9) * P, O + (z + 6) * P, P, P); c.fillStyle = CL_WALL[+CLE.wpS[i]][1]; c.fillRect(O + (x + 9) * P + P - 6, O + (z + 6) * P + 2, 4, 4); c.strokeStyle = 'rgba(0,0,0,0.08)'; c.strokeRect(O + (x + 9) * P, O + (z + 6) * P, P, P); }
  const line = (e, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(O + (e[0] + 9) * P, O + (e[1] + 6) * P); c.lineTo(O + (e[2] + 9) * P, O + (e[3] + 6) * P); c.stroke(); };
  line([-9, -6, 9, -6], '#5a3d2b', 6); line([-9, -6, -9, 6], '#5a3d2b', 6); line([9, -6, 9, 6], '#5a3d2b', 6); line([-9, 6, -1, 6], '#5a3d2b', 6); line([1, 6, 9, 6], '#5a3d2b', 6); line([-1, 6, 1, 6], '#e8473a', 6);
  for (const e of CLE.walls) line(e, '#5a3d2b', 5); for (const e of CLE.wins) line(e, '#5fb6e3', 5);
  for (const d of CLE.doors){ c.fillStyle = '#ffd36a'; const vert = Math.abs(d[0] - Math.round(d[0])) < 0.01; c.fillRect(O + (d[0] + 9) * P - (vert ? 3 : P / 2), O + (d[1] + 6) * P - (vert ? P / 2 : 3), vert ? 6 : P, vert ? P : 6); } }
function renderClDesign(body){
  const E = CLE; if (!E){ curTab = 'furn'; renderTab(); return; }
  body.appendChild(el('div', 'shophead')).innerHTML = '<b>📐 設計大宅的格局</b>';
  body.appendChild(el('p', 'sub', '在格子上點或拖：畫牆、放門（只能放在裡面的牆線上）、放窗戶（外牆也可以）。選「房間上色」再點一個房間，整個房間換成選好的地板和壁紙（門也會把房間隔開）。紅色是大門。'));
  const tools = el('div', 'seg'); [['wall', '🧱 牆'], ['door', '🚪 門'], ['win', '🪟 窗'], ['erase', '🧽 擦掉'], ['paint', '🎨 房間上色']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(E.tool === k)); b.addEventListener('click', () => { E.tool = k; renderTab(); }); tools.appendChild(b); }); body.appendChild(tools);
  if (E.tool === 'paint'){ const r1 = el('div', 'chipline'); CL_FLOOR.forEach(([n, col], i) => { const b = el('button', 'chip' + (E.fl === i ? ' on' : ''), n); b.style.borderLeft = `14px solid ${col}`; b.addEventListener('click', () => { E.fl = i; renderTab(); }); r1.appendChild(b); }); body.appendChild(el('div', 'sub2', '地板')); body.appendChild(r1);
    const r2 = el('div', 'chipline'); CL_WALL.forEach(([n, col], i) => { const b = el('button', 'chip' + (E.wp === i ? ' on' : ''), n); b.style.borderLeft = `14px solid ${col}`; b.addEventListener('click', () => { E.wp = i; renderTab(); }); r2.appendChild(b); }); body.appendChild(el('div', 'sub2', '壁紙')); body.appendChild(r2); }
  const cv = el('canvas', 'clcv'); cv.width = 18 * CL_PX + 20; cv.height = 12 * CL_PX + 20; cv.style.cssText = 'width:100%;max-width:416px;touch-action:none;border-radius:12px;background:#fff;display:block;margin:6px auto'; body.appendChild(cv); clDraw(cv);
  const toH = ev => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * cv.width, y = (ev.clientY - r.top) / r.height * cv.height; return [(x - 10) / CL_PX - 9, (y - 10) / CL_PX - 6]; };
  let drag = false, last = '';
  const act = ev => { const [hx, hz] = toH(ev); if (hx < -9.4 || hx > 9.4 || hz < -6.4 || hz > 6.4) return;
    if (E.tool === 'paint'){ clFill(Math.max(-9, Math.min(8, Math.floor(hx))), Math.max(-6, Math.min(5, Math.floor(hz)))); clDraw(cv); return; }
    const e = clEdgeAt(hx, hz), k = clKey(e); if (k === last) return; last = k; clApply(e); clDraw(cv); };
  cv.addEventListener('pointerdown', ev => { ev.preventDefault(); drag = true; last = ''; try { cv.setPointerCapture(ev.pointerId); } catch(_){} act(ev); });
  cv.addEventListener('pointermove', ev => { if (drag && E.tool !== 'paint') act(ev); }); cv.addEventListener('pointerup', () => { drag = false; }); cv.addEventListener('pointercancel', () => { drag = false; });
  const bar = el('div', 'tankbar'), ok = el('button', 'tbtn', '💾 儲存格局'), clr = el('button', 'tbtn ghost', '全部清掉'), bk = el('button', 'tbtn ghost', '取消');
  ok.addEventListener('click', async () => { if (E.busy) return; E.busy = true; ok.disabled = true;
    const cl = { walls: E.walls, doors: E.doors, wins: E.wins, fl: E.flS.join(''), wp: E.wpS.join('') }; const okk = await homeOp('design', { house: E.it.id, cl });
    E.busy = false; if (okk){ SFX.catch(); flash('🏠 格局改好了！放不下的家具已經收起來、退錢了', 1.8); CLE = null; closeSheet(); const it = isleItems().find(x => x.id === E.it.id); if (it && House.on) rebuildHouseRoom(it); } else ok.disabled = false; });
  clr.addEventListener('click', () => { if (clr.dataset.sure !== '1'){ clr.dataset.sure = '1'; clr.textContent = '確定清掉？'; return; } E.walls = []; E.doors = []; E.wins = []; E.flS = '0'.repeat(216).split(''); E.wpS = '0'.repeat(216).split(''); renderTab(); });
  bk.addEventListener('click', () => { CLE = null; curTab = 'furn'; renderTab(); }); bar.append(ok, clr, bk); body.appendChild(bar);
  body.appendChild(el('p', 'sub', `牆 ${E.walls.length} 段・門 ${E.doors.length} 個・窗 ${E.wins.length} 個（最多：牆＋窗 300、門 40）`));
}
let furnSheet = 'buy';
function renderFurnSheet(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🛋️ 家具</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  if (!House.on || !House.it){ body.appendChild(el('div', 'empty', '走進小島上的房子裡才能擺家具。')); return; }
  const seg = el('div', 'seg'); [['buy', '🛒 買家具'], ['lay', '🏠 換格局']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(furnSheet === k)); b.addEventListener('click', () => { furnSheet = k; renderTab(); }); seg.appendChild(b); }); body.appendChild(seg);
  const it = House.it, cur = houseLay(it), f = houseFurn(it);
  if (furnSheet === 'lay' && it.t === 'mansion'){ body.appendChild(el('p', 'sub', '大宅的格局是你自己畫的：畫牆、放門窗、每個房間選地板和壁紙。')); const b = el('button', 'tbtn', '📐 設計格局'); b.addEventListener('click', () => { if (!canEditIsle()){ toast('只有住在這座島的人可以改'); return; } clOpen(it); }); body.appendChild(b); return; }
  if (furnSheet === 'lay'){
    body.appendChild(el('p', 'sub', '換大一點的格局只要補差價；換小的退一半。放不下的家具會自動收起來，全額退錢。'));
    const ul = el('ul', 'shoplist'); for (const [k, L] of Object.entries(LAYOUTS)){ const on = (it.lay || 'open') === k, li = el('li', on ? 'on' : ''); li.appendChild(el('span', 'dishic', ['🏠', '🏡', '🏘️', '🏰'][Object.keys(LAYOUTS).indexOf(k)]));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${L.name}（${L.W}×${L.D}）`)); d.appendChild(el('div', 'sub2', `${LAYOUT_DESC[k]}・${L.rooms.length ? L.rooms.length + ' 間臥室' : '沒有隔間'}`)); li.appendChild(d);
      const diff = L.price - cur.price, b = el('button', 'tbtn' + (on ? ' ghost' : ''), on ? '現在的' : diff > 0 ? `換 🪙${diff.toLocaleString()}` : diff < 0 ? `換 +${Math.floor(-diff / 2)}` : '換'); b.disabled = on || (diff > 0 && rec.coins < diff);
      b.addEventListener('click', () => homeOp('layout', { house: it.id, lay: k }).then(ok => { if (ok){ SFX.catch(); flash(`🏠 換成${L.name}了！`, 1.4); me.pos.x = ISLE.x; me.pos.z = ISLE.z + L.D / 2 - 1.4; renderTab(); } }));
      const a = el('div', 'tacts'); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
    body.appendChild(ul); return;
  }
  body.appendChild(el('p', 'sub', `這棟房子有 ${f.length} / 40 件家具。按「拿去擺」之後走路調整位置、「⟲」轉方向、「✔」放下。收掉退一半金幣。床可以認領，房門上會掛你的名字。`));
  if (!FZ.list && Cloud.on) loadMu(); if (!Cai.list && Cloud.on) loadCai();
  for (const [gk, title] of FURN_GROUPS){ if ((gk === 'mu' || gk === 'cai') && !Object.values(FURN).some(v => v.g === gk)) continue; body.appendChild(el('div', 'dexhead', title)); const ul = el('ul', 'shoplist cols');
    for (const [k, v] of Object.entries(FURN).filter(([, v]) => v.g === gk)){ const li = el('li'); li.appendChild(el('span', 'dishic', { bed:'🛏️', dbed:'🛏️', bunk:'🛏️', ward:'🚪', desk:'🖥️', lamp:'💡', clock:'🕰️', sofa:'🛋️', arm:'💺', tv:'📺', table:'🍽️', chair:'🪑', shelf:'📚', rug:'🟣', fire:'🔥', piano:'🎹', tank:'🐠', fridge:'🧊', stove:'🍳', sink:'🚰', bath:'🛁', toilet:'🚽', plant:'🪴', bigplant:'🌳' }[v.base || k] || '📦'));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', v.name)); d.appendChild(el('div', 'sub2', `🪙 ${v.price.toLocaleString()}・家裡 ${f.filter(x => x.t === k).length} 個`)); li.appendChild(d);
      const b = el('button', 'tbtn', '拿去擺'); b.disabled = rec.coins < v.price; b.addEventListener('click', () => startFurn(k)); const a = el('div', 'tacts'); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
    body.appendChild(ul); }
}

// ---- 「🏠 我的家」：住戶、邀請、稱呼 ----
function renderHomeTab(body){
  const meId = myIdOrMe();
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端才能跟朋友一起住。')); return; }
  if (!Home.at || Date.now() - Home.at > 20000){ Home.at = Date.now(); loadHome(); }
  const amOwner = !Home.owner || Home.owner === meId, people = Home.people.length ? Home.people : [{ id: meId, name: myDisplayName(), owner: true }];
  body.appendChild(el('p', 'sub', `跟互相加好友的人一起住（含島主最多 ${Home.cap} 人）。住戶可以一起蓋島、走進房子一起擺家具、認領自己的床。`));
  const bar = el('div', 'tankbar'); const go = el('button', 'tbtn', '🏠 回家'); go.addEventListener('click', goHome); bar.appendChild(go); body.appendChild(bar);
  if (Home.invites.length){ body.appendChild(el('div', 'dexhead', '📮 邀請你搬進去')); const ul = el('ul', 'shoplist');
    for (const iv of Home.invites){ const li = el('li'); li.appendChild(el('span', 'dishic', '🏠')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${iv.name || '朋友'} 的家`)); d.appendChild(el('div', 'sub2', amOwner && people.length > 1 ? '你家裡還有室友，要先請他們搬走才能搬過去' : '搬過去以後，你的小島還在，只是「回家」會回到他家')); li.appendChild(d);
      const a = el('div', 'tacts'), y = el('button', 'tbtn', '搬進去'), n = el('button', 'tbtn ghost', '不要'); y.addEventListener('click', () => homeRpc('answer_home', { p_owner: iv.owner, p_ok: true }).then(d => d && (SFX.catch(), flash(`🏠 搬進 ${iv.name || '朋友'} 的家了！`, 1.8)))); n.addEventListener('click', () => homeRpc('answer_home', { p_owner: iv.owner, p_ok: false }));
      a.appendChild(y); a.appendChild(n); li.appendChild(a); ul.appendChild(li); }
    body.appendChild(ul); }
  const ownerP = people.find(p => p.owner) || people[0];
  body.appendChild(el('div', 'dexhead', `👨‍👩‍👧 ${amOwner ? '我家' : `${ownerP.name || '島主'} 的家`}（${people.length} / ${Home.cap} 人）`)); const ul = el('ul', 'shoplist');
  for (const p of people){ const isMe = p.id === meId, li = el('li', isMe ? 'on' : ''); li.appendChild(el('span', 'dishic', p.owner ? '👑' : p.role === 'family' ? '👪' : p.role === 'couple' ? '💞' : '🙂'));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', (isMe ? (p.name || myDisplayName()) + '（你）' : p.name || '釣客'))); d.appendChild(el('div', 'sub2', p.owner ? '島主' + (p.title ? '・' + p.title : '') : homeTitle(p))); li.appendChild(d);
    const a = el('div', 'tacts');
    if (amOwner && !isMe){ const k = el('button', 'tbtn ghost', '請他搬走'); k.addEventListener('click', () => { if (k.dataset.sure !== '1'){ k.dataset.sure = '1'; k.textContent = '確定？'; k.classList.add('warn'); return; } homeRpc('kick_home', { p_member: p.id }); }); a.appendChild(k); }
    if (!amOwner && isMe){ const k = el('button', 'tbtn ghost', '搬出去'); k.addEventListener('click', () => { if (k.dataset.sure !== '1'){ k.dataset.sure = '1'; k.textContent = '確定搬走？'; k.classList.add('warn'); return; } homeRpc('leave_home').then(d => d && toast('你搬出去了，「回家」會回到你自己的小島')); }); a.appendChild(k); }
    li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
  // 自己的關係和稱呼
  const mine = people.find(p => p.id === meId) || {}; body.appendChild(el('div', 'dexhead', '🏷️ 我在家裡是…'));
  const rs = el('div', 'seg'); Object.entries(HOME_ROLES).forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String((mine.role || 'mate') === k)); b.addEventListener('click', () => homeRpc('set_home_title', { p_role: k, p_title: mine.title || null })); rs.appendChild(b); }); body.appendChild(rs);
  const ts = el('div', 'chipline'); for (const t of HOME_TITLES){ const b = el('button', 'chip' + (mine.title === t ? ' on' : ''), t); b.addEventListener('click', () => homeRpc('set_home_title', { p_role: mine.role || 'family', p_title: mine.title === t ? null : t })); ts.appendChild(b); }
  const cus = el('button', 'chip', '✏️ 自己取'); cus.addEventListener('click', () => { const v = prompt('稱呼（最多 6 個字）', mine.title || ''); if (v != null) homeRpc('set_home_title', { p_role: mine.role || 'family', p_title: clean(v).slice(0, 6) || null }); }); ts.appendChild(cus); body.appendChild(ts);
  renderIslePerms(body, meId);
  // 邀請好友（島主、共同島主、管理成員都可以）
  if (amOwner || IsleP.me === 'co' || IsleP.me === 'admin'){ body.appendChild(el('div', 'dexhead', '📨 邀請好友搬進來')); const fl = (Fr.list || []).filter(f => f.mutual && !people.some(p => p.id === f.id));
    if (people.length >= Home.cap) body.appendChild(el('div', 'empty', '家裡已經住滿了。'));
    else if (!fl.length) body.appendChild(el('div', 'empty', '要先在「玩家」分頁互相加好友，才能邀請他搬進來。'));
    else { const u2 = el('ul', 'shoplist'); for (const f of fl){ const sent = Home.sent.includes(f.id), li = el('li'); li.appendChild(el('span', 'dishic', '🙂')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', f.name || '釣客')); d.appendChild(el('div', 'sub2', sent ? '已經寄出邀請，等他回覆' : '互相加好友')); li.appendChild(d);
        const a = el('div', 'tacts'), b = el('button', 'tbtn' + (sent ? ' ghost' : ''), sent ? '收回' : '邀請'); b.addEventListener('click', () => sent ? homeRpc('kick_home', { p_member: f.id }) : homeRpc('invite_home', { p_member: f.id }).then(d => d && toast(`📨 邀請寄給 ${esc(f.name || '朋友')} 了`))); a.appendChild(b); li.appendChild(a); u2.appendChild(li); }
      body.appendChild(u2); } }
}
// ---- 共同島嶼的權限、公共儲物箱（062_isle_roles.sql）----
var IsleP = { me:null, people:[], store:null, at:0, busy:false };
const PERM_NAME = { owner:'👑 創建者', co:'🤝 共同島主', admin:'🛠️ 管理成員', member:'🙂 一般成員' }, PERM_RANK = { owner:4, co:3, admin:2, member:1 };
async function loadIsleP(){ if (IsleP.busy || !Cloud.on) return; IsleP.busy = true; IsleP.at = Date.now();
  try { const [a, b] = await Promise.all([Cloud.sb.rpc('isle_people'), Cloud.sb.rpc('isle_storage')]); if (a.data){ IsleP.me = a.data.me; IsleP.people = a.data.people || []; } IsleP.store = b.data || []; } catch(e){}
  IsleP.busy = false; if (!$('#sheet').hidden && curTab === 'island') renderTab(); }
async function isleCall(fn, args, msg){ try { const { data, error } = await Cloud.sb.rpc(fn, args); if (error) throw error; if (data && data.tank) { adoptRow(data); buildTank(); } if (msg) flash(msg, 1.4); } catch(e){ toast(cloudErrMsg(e)); } IsleP.at = 0; Home.at = 0; loadIsleP(); }
// ---- 島上的幫手（065_isle_npc.sql）：白天在碼頭釣魚、釣到的放進公共儲物箱；大家都離線也照樣工作 ----
var IsleH = { owner:null, list:null, at:0, busy:false, fishers:[], hireName:'', hireTrait:'hard' };
const HELPER_TRAIT = { hard:'💪 勤勞', normal:'🙂 普通', sleepy:'😴 愛睡', chatty:'💬 愛聊天' };
async function loadIsleH(owner){ if (IsleH.busy || !Cloud.on) return; IsleH.busy = true; IsleH.at = Date.now(); try { const { data } = await Cloud.sb.rpc('isle_helpers', { p_owner: owner || null }); IsleH.list = data || []; IsleH.owner = owner || null; } catch(e){} IsleH.busy = false; isleHelperSpawn(); if (!$('#sheet').hidden && curTab === 'island') renderTab(); }
function isleHelperSpawn(){ for (const f of IsleH.fishers) f.dispose(); IsleH.fishers = []; if (!onIsle || !IsleH.list) return;
  IsleH.list.forEach((h, i) => { const f = new Fisher({ shirt:['#3fbf9d', '#ff9f43'][i % 2], hat:'#f6f0dd', name:`${h.name}・島上的幫手`, kind:'npc' }); const x = ISLE.x + (i ? 0.9 : -0.9), z = ISLE.z + ISLE.r + 4.4;
    f.pos.set(x, 0, z); f.baseY = groundHeight(x, z); f.rot = 0; f.helper = h; f.setGear({ hat:'hat_bucket', face: h.state === 'sleep' ? 'face_sleepy' : 'face_happy' }); f.sitting = true;
    if (h.state === 'fish'){ f.fishing = true; f.bobState = 'water'; const cp = castPoint(x, z, 0, 1, 4); f.bobPos.set(cp[0], 0.12, cp[1]); f.next = now() + rand(4, 10); } else f.say('💤', 'emote', 99999);
    f.lines = h.state === 'sleep' ? ['（呼呼大睡中…）'] : [...(h.log || []).slice(0, 3).map(l => l.txt), `我已經幫大家釣了 ${h.total} 條魚`, h.trait === 'chatty' ? '島上的大家都好親切～' : h.trait === 'hard' ? '再釣一條！' : '今天的海很平靜']; IsleH.fishers.push(f); }); }
function updateIsleHelpers(dt, t){ if (!onIsle){ if (IsleH.fishers.length){ for (const f of IsleH.fishers) f.dispose(); IsleH.fishers = []; IsleH.list = null; } return; }
  if (Cloud.on && (!IsleH.list || IsleH.owner !== onIsle.owner || Date.now() - IsleH.at > 10 * 60000)) loadIsleH(onIsle.owner);
  for (const f of IsleH.fishers){ const d = Math.hypot(me.pos.x - f.pos.x, me.pos.z - f.pos.z);
    if (f.fishing && t > f.next){ f.dip = 1; f.bend = 0.6; ripple(f.bobPos.x, f.bobPos.z); f.next = t + rand(6, 14); } f.dip = (f.dip || 0) * Math.pow(0.08, dt); f.bend = (f.bend || 0) * Math.pow(0.2, dt);
    if (d < 7 && t > (f.talkAt || 0) && f.helper.state === 'fish'){ f.say(f.lines[Math.floor(Math.random() * f.lines.length)], '', 5); f.talkAt = t + rand(15, 28); }
    if (d < 60){ f.update(dt, t); f.placeTag(); } else f.tag.style.display = 'none'; } }
function renderIsleHelpers(body){
  const my = PERM_RANK[IsleP.me] || 0, L = (IsleH.owner === null || !onIsle || onIsle.owner === myIdOrMe()) ? IsleH.list : null; if (!L && !IsleH.busy) loadIsleH(null);
  body.appendChild(el('div', 'dexhead', '🧑‍🌾 島上的幫手（最多 2 個）')); body.appendChild(el('p', 'sub', '幫手白天（6～22 點）在島的碼頭釣魚，釣到的魚放進公共儲物箱；晚上睡覺。大家都離線的時候也照樣工作（最多補 24 小時），儲物箱滿了就會停下來。'));
  const ul = el('ul', 'shoplist'); for (const h of L || []){ const li = el('li'); li.appendChild(el('span', 'dishic', h.state === 'sleep' ? '💤' : '🎣')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${h.name}・${HELPER_TRAIT[h.trait] || ''}`)); d.appendChild(el('div', 'sub2', `一共釣了 ${h.total} 條・${(h.log || [])[0] ? h.log[0].txt : ''}`)); li.appendChild(d);
    if (my >= 3){ const a = el('div', 'tacts'), b = el('button', 'tbtn ghost vbtn', '請他離開'); b.addEventListener('click', () => { if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = '確定？'; return; } b.disabled = true; Cloud.sb.rpc('isle_fire', { p_id: h.id }).then(() => { IsleH.at = 0; loadIsleH(null); }); }); a.appendChild(b); li.appendChild(a); } ul.appendChild(li); }
  body.appendChild(ul);
  if (my >= 2 && (L || []).length < 2){ const row = el('div', 'tankbar'), inp = el('input'); inp.placeholder = '幫手的名字（1～8 個字）'; inp.maxLength = 8; inp.value = IsleH.hireName; inp.style.cssText = 'font-size:15px;padding:6px 8px;border-radius:10px;border:1px solid #c8d8e4;max-width:170px'; inp.addEventListener('input', () => { IsleH.hireName = inp.value; });
    const tr = el('div', 'chipline'); for (const [k, l] of Object.entries(HELPER_TRAIT)){ const b = el('button', 'chip' + (IsleH.hireTrait === k ? ' on' : ''), l); b.addEventListener('click', () => { IsleH.hireTrait = k; renderTab(); }); tr.appendChild(b); }
    const go = el('button', 'tbtn', '請幫手 🪙1500'); go.addEventListener('click', async () => { go.disabled = true; try { const { data, error } = await Cloud.sb.rpc('isle_hire', { p_name: inp.value, p_trait: IsleH.hireTrait }); if (error) throw error; adoptRow(data); flash(`🧑‍🌾 ${inp.value} 來島上幫忙了！`, 1.6); IsleH.hireName = ''; IsleH.at = 0; loadIsleH(null); } catch(e){ toast(cloudErrMsg(e)); go.disabled = false; } });
    row.append(inp, go); body.appendChild(row); body.appendChild(tr); }
}
function renderIslePerms(body, meId){
  if (!IsleP.at || Date.now() - IsleP.at > 20000) loadIsleP();
  const my = PERM_RANK[IsleP.me] || 0;
  body.appendChild(el('div', 'dexhead', '🔑 成員權限')); body.appendChild(el('p', 'sub', '創建者什麼都能做；共同島主可以蓋、拆、邀請、請人搬走、設定管理成員；管理成員可以蓋、拆、邀請、請一般成員搬走、拿儲物箱的魚；一般成員可以一起蓋、擺家具、放魚進儲物箱，只能拿回自己放的。別人來參觀是訪客，只能看。'));
  const ul = el('ul', 'shoplist'); for (const p of IsleP.people){ const isMe = p.id === meId, li = el('li', isMe ? 'on' : ''); li.appendChild(el('span', 'dishic', (PERM_NAME[p.perm] || '🙂').split(' ')[0]));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', (p.name || '釣客') + (isMe ? '（你）' : ''))); d.appendChild(el('div', 'sub2', (PERM_NAME[p.perm] || '').split(' ')[1] || '')); li.appendChild(d);
    const a = el('div', 'tacts'), th = PERM_RANK[p.perm] || 0;
    if (!isMe && th < 4 && (my === 4 || (my === 3 && th < 3))){ for (const k of my === 4 ? ['co', 'admin', 'member'] : ['admin', 'member']){ if (k === p.perm) continue; const b = el('button', 'tbtn ghost vbtn', (PERM_NAME[k] || '').split(' ')[1]); b.addEventListener('click', () => { b.disabled = true; isleCall('isle_set_perm', { p_member: p.id, p_perm: k }, '🔑 權限改好了'); }); a.appendChild(b); } }
    if (!isMe && my >= 2 && my > th){ const k = el('button', 'tbtn ghost vbtn', '請他搬走'); k.addEventListener('click', () => { if (k.dataset.sure !== '1'){ k.dataset.sure = '1'; k.textContent = '確定？'; return; } k.disabled = true; isleCall('kick_home', { p_member: p.id }, '已經請他搬走了'); }); a.appendChild(k); }
    li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
  renderIsleHelpers(body);
  // 公共儲物箱
  body.appendChild(el('div', 'dexhead', `📦 公共儲物箱（${(IsleP.store || []).length} / 60）`)); body.appendChild(el('p', 'sub', '島上大家共用，跟自己的魚缸分開。放進去的魚誰都看得到，誰放的、誰拿的都有紀錄。'));
  const S = IsleP.store || []; if (S.length){ const u2 = el('ul', 'shoplist cols'); for (const x of S){ const f = FISH_BY_ID[x.item.f], li = el('li'); li.appendChild(el('span', 'dishic', '🐟')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${f ? f.name : x.item.f} ${fmtKg(+x.item.w)}`)); d.appendChild(el('div', 'sub2', `${x.by} 放的`)); li.appendChild(d);
      const a = el('div', 'tacts'), b = el('button', 'tbtn ghost vbtn', '拿出來'); b.disabled = !(my >= 2 || x.mine); b.addEventListener('click', () => { b.disabled = true; isleCall('isle_withdraw', { p_id: x.id }, '🐟 放回你的魚缸了'); }); a.appendChild(b); li.appendChild(a); u2.appendChild(li); } body.appendChild(u2); }
  else body.appendChild(el('div', 'empty', '儲物箱是空的。'));
  if (IsleP.me){ const cand = (rec.tank || []).filter(x => FISH_BY_ID[x.f] && !x.rs && !(rec.show || []).includes(x.t)).slice(0, 30); if (cand.length){ const sel = el('select'); sel.style.cssText = 'font-size:14px;padding:6px;border-radius:10px;max-width:220px'; for (const x of cand){ const o = el('option', '', `${FISH_BY_ID[x.f].name} ${fmtKg(x.w)}`); o.value = x.t; sel.appendChild(o); }
    const bar = el('div', 'tankbar'), b = el('button', 'tbtn', '放進儲物箱'); b.addEventListener('click', () => { b.disabled = true; isleCall('isle_deposit', { p_t: +sel.value }, '📦 放進公共儲物箱了'); }); bar.append(sel, b); body.appendChild(bar); } }
}
// ===== 紅樹林（本島東岸、螢光溪出海口；2026-11-04）=====
// 四座小島接在岸邊、用木棧道連起來，東邊有一條碼頭。退潮時島邊的泥灘會露出來，可以走下去慢慢靠近、徒手抓彈塗魚和招潮蟹。
var MANG = { x:55, z:15, isl:[[50, 10, 4.5], [60, 10, 4], [50, 20, 4.5], [59, 20, 3.5]], mud:4.5, y:0.26 };   // 接在本島東岸、螢光溪出海口的南邊
function mangE(x, z){   // 到最近的小島邊緣的距離（正的＝在島上）
  if (!MANG) return -99; if (Math.abs(x - MANG.x) > 24 || Math.abs(z - MANG.z) > 24) return -99; let e = -99;
  for (let i = 0; i < MANG.isl.length; i++){ const [ix, iz, r] = MANG.isl[i], d = Math.hypot(x - ix, z - iz); if (d > r + MANG.mud + 2) continue; const a = Math.atan2(z - iz, x - ix); e = Math.max(e, r + wobble(a * 3, i * 1.7) * 0.5 - d); }
  return e;
}
function mudOut(){ return Env.tide.lv < -0.35; }          // 泥灘露出來（伺服器抓的時候要更低：-0.5）
function mudGrabOk(){ return Env.tide.lv < -0.5; }
var Mang = { mud:[], mudY:-0.4, critters:[], told:0, flies:null, onMud:false };
function mangH(x, z){ if (!Mang) return null; const e = mangE(x, z); if (e > 0) return Math.max(MANG.y, terrainH(x, z)); if (e > -MANG.mud && Mang.mudY > WATER_LEVEL && !isLand(x, z)) return Mang.mudY; return null; }
function mangWalk(x, z){ if (!Mang) return false; const e = mangE(x, z); return e > 0 || (e > -MANG.mud + 0.3 && mudOut()); }
function inMang(x, z){ return !!MANG && Math.hypot(x - MANG.x, z - MANG.z) < 16; }
function islePath(pts, wobA, wobB, k){ const s = new THREE.Shape(); for (let i = 0; i <= 48; i++){ const a = i / 48 * Math.PI * 2, r = pts + wobble(a * 3, wobA) * wobB + (k || 0); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (i === 0) s.moveTo(x, -z); else s.lineTo(x, -z); } return s; }
function buildMangrove(){
  const g = new THREE.Group(); scene.add(g); Mang.g = g; let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const ext = (shape, depth) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:4 }); geo.rotateX(-Math.PI / 2); return geo; };
  const soil = mat('#9c9078', 0.95), grass = mat('#8fae6c', 0.95), mudM = mat('#a39880', 0.45, { emissive:'#3a3428', emissiveIntensity:0.06 });   /* 紅毛港的泥灘是灰色的 */
  MANG.isl.forEach(([ix, iz, r], i) => {
    const top = new THREE.Mesh(ext(islePath(r, i * 1.7, 0.5), 3.0), soil); top.position.set(ix, MANG.y - 3.0, iz); top.receiveShadow = true; g.add(top);
    const gr = new THREE.Mesh(ext(islePath(r - 0.35, i * 1.7, 0.5), 0.04), grass); gr.position.set(ix, MANG.y, iz); gr.receiveShadow = true; g.add(gr);
    const mud = new THREE.Mesh(ext(islePath(r + MANG.mud, i * 1.7 + 0.4, 0.7), 2.6), mudM); mud.position.set(ix, Mang.mudY - 2.6, iz); mud.receiveShadow = true; g.add(mud); Mang.mud.push(mud);
    // 泥灘上的小洞（招潮蟹、彈塗魚的家）
    for (let k = 0; k < 10; k++){ const a = rr() * Math.PI * 2, d = r + 0.6 + rr() * (MANG.mud - 1.1); const h = new THREE.Mesh(new THREE.CircleGeometry(0.07 + rr() * 0.05, 8), new THREE.MeshBasicMaterial({ color:'#4a463c' })); h.rotation.x = -Math.PI / 2; h.position.set(Math.cos(a) * d, 2.605, Math.sin(a) * d); mud.add(h); }
  });
  // 參考新竹新豐紅毛港紅樹林：水筆仔和海茄苳混生，是一片低矮（一兩公尺）、很密的灰綠色灌叢；
  // 海茄苳在泥灘上冒出一根根筆狀的呼吸根，水筆仔掛著細長的胎生苗；泥灘很寬、灰灰的，鷺鷥站在水邊。
  const walks = [[45, 10, 68.6, 10], [50, 10, 50, 20], [50, 20, 59, 20]];   /* 從岸上穿過小島到碼頭的路線：兩邊不長樹 */
  const clumps = [];
  MANG.isl.forEach(([ix, iz, r]) => { for (let gx = -r; gx <= r; gx += 0.95) for (let gz = -r; gz <= r; gz += 0.95){ const x = ix + gx + (rr() - 0.5) * 0.6, z = iz + gz + (rr() - 0.5) * 0.6, e = mangE(x, z);
    if (e < -0.2 || walks.some(w => segD(x, z, w[0], w[1], w[2], w[3]) < 1.35)) continue; if (clumps.some(c => Math.hypot(c[0] - x, c[1] - z) < 0.7)) continue; clumps.push([x, z, 0.75 + rr() * 0.55, e]); } });
  const leafCols = ['#6f8a5c', '#86a070', '#9cb486', '#b4c89a'];
  const tLeaf = leafCols.map(c => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(c, 0.95, { flatShading:true }), clumps.length * 2)); Mang.leaves = tLeaf; Mang.leafInst = tLeaf.map(() => []);
  const tStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.05, 1, 4), mat('#6e6252', 0.9), clumps.length * 3);
  const tProp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 3), mat('#6a8a3a', 0.8), clumps.length * 2);   // 水筆仔的胎生苗
  const D = new THREE.Object3D(); const li = leafCols.map(() => 0); let si = 0, pi = 0;
  clumps.forEach(([x, z, s, e]) => { const base = MANG.y, H = 0.9 + s * 0.9;
    for (let k = 0; k < 3; k++){ D.position.set(x + (rr() - 0.5) * 0.4, base + H * 0.35, z + (rr() - 0.5) * 0.4); D.rotation.set((rr() - 0.5) * 0.5, 0, (rr() - 0.5) * 0.5); D.scale.set(1, H * 0.7, 1); D.updateMatrix(); tStem.setMatrixAt(si++, D.matrix); }
    for (let k = 0; k < 2; k++){ const c = Math.floor(rr() * (k ? leafCols.length : leafCols.length - 1)), m = tLeaf[c]; D.rotation.set(rr() * 0.4, rr() * 6, rr() * 0.4);
      D.position.set(x + (rr() - 0.5) * 0.3, base + H * (k ? 0.95 : 0.72), z + (rr() - 0.5) * 0.3); const sc = s * (k ? 0.6 : 0.85); D.scale.set(sc * 1.1, sc * 0.55, sc * 1.1); D.updateMatrix(); Mang.leafInst[c].push({ i: li[c], mx: D.matrix.clone(), p: D.position.clone(), r: sc * 1.1, hid: false }); m.setMatrixAt(li[c]++, D.matrix); }
    if (rr() < 0.6) for (let k = 0; k < 2; k++){ D.rotation.set((rr() - 0.5) * 0.2, 0, (rr() - 0.5) * 0.2); D.position.set(x + (rr() - 0.5) * s * 1.4, base + H * 0.55 - 0.12, z + (rr() - 0.5) * s * 1.4); D.scale.set(1, 0.28, 1); D.updateMatrix(); tProp.setMatrixAt(pi++, D.matrix); }
    if (e > 0.4 && !walks.some(w => segD(x, z, w[0], w[1], w[2], w[3]) < 1.9)) addCircleCol(x, z, 0.45 * s); });
  tLeaf.forEach((m, k) => { m.count = li[k]; }); tStem.count = si; tProp.count = pi;
  for (const m of [tStem, tProp, ...tLeaf]){ m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // 海茄苳的呼吸根：泥灘上一根根冒出來（跟著泥灘一起被水淹、露出來）；還有剛發芽的小苗
  Mang.mud.forEach((mud, i) => { const [ix, iz, r] = MANG.isl[i], N = Math.round(r * 60), pn = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.02, 1, 4), mat('#7a705c', 0.95), N), sd2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.25, 4), mat('#86a070', 0.9), 30); let n = 0;
    for (let k = 0; k < N; k++){ const a = rr() * Math.PI * 2, d = r - 0.3 + Math.pow(rr(), 1.6) * (MANG.mud - 0.4), h = 0.08 + rr() * 0.2; D.rotation.set((rr() - 0.5) * 0.25, 0, (rr() - 0.5) * 0.25); D.position.set(Math.cos(a) * d, 2.6 + h / 2, Math.sin(a) * d); D.scale.set(1, h, 1); D.updateMatrix(); pn.setMatrixAt(n++, D.matrix); }
    pn.count = n; mud.add(pn);
    for (let k = 0; k < 30; k++){ const a = rr() * Math.PI * 2, d = r + 0.3 + rr() * 1.4; D.rotation.set(0, rr() * 6, 0); D.position.set(Math.cos(a) * d, 2.72, Math.sin(a) * d); D.scale.set(1, 1, 1); D.updateMatrix(); sd2.setMatrixAt(k, D.matrix); }
    mud.add(sd2); });
  // 鷺鷥：站在島邊的淺灘上，偶爾低頭啄一下
  Mang.birds = [];
  { const white = mat('#f6f6f2', 0.6), beak = mat('#e8b730', 0.5), leg = mat('#3a3a36', 0.8);
    for (const [ix, iz, r, a] of [[50, 10, 4.5, -1.2], [60, 10, 4, 2.2], [50, 20, 4.5, 2.6], [59, 20, 3.5, 0.6]]){ const b = new THREE.Group(), x = ix + Math.cos(a) * (r + 0.2), z = iz + Math.sin(a) * (r + 0.2);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white); body.scale.set(1.5, 0.9, 0.9); body.position.y = 0.62; b.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 5), white); neck.position.set(0.18, 0.82, 0); neck.rotation.z = -0.5; b.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), white); head.position.set(0.27, 0.97, 0); b.add(head); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 4), beak); bk.rotation.z = -Math.PI / 2; bk.position.set(0.38, 0.96, 0); b.add(bk);
      for (const sz of [-0.05, 0.05]){ const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 3), leg); l.position.set(0, 0.3, sz); b.add(l); }
      b.position.set(x, MANG.y - 0.05, z); b.rotation.y = -a + Math.PI / 2 + rr(); b.userData.neck = [neck, head, bk]; g.add(b); Mang.birds.push(b); } }
  // 河口的水比較混濁、偏黃褐色
  { const tw = new THREE.Mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshBasicMaterial({ color:'#7a7464', transparent:true, opacity:0.32, depthWrite:false })); tw.rotation.x = -Math.PI / 2; tw.position.set(MANG.x + 1, WATER_LEVEL + 0.02, MANG.z); tw.renderOrder = 1; g.add(tw); }
  // 木棧道（島跟島之間）和南邊的碼頭
  const plank = mat('#a87c52', 0.9), post = mat('#6e4a2f', 0.9), BY = 0.62;
  const walk = (x0, z0, x1, z1) => { const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const dk = new THREE.Mesh(new THREE.BoxGeometry(along ? L : 1.5, 0.12, along ? 1.5 : L), plank); dk.position.set(mx, BY - 0.06, mz); dk.receiveShadow = true; dk.castShadow = true; g.add(dk);
    const n = Math.max(2, Math.round(L / 1.6)); for (let k = 0; k <= n; k++) for (const sd of [-0.68, 0.68]){ const px = along ? x0 + (x1 - x0) * k / n : mx + sd, pz = along ? mz + sd : z0 + (z1 - z0) * k / n; const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), post); p.position.set(px, BY - 0.9, pz); g.add(p);
      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), post); rl.position.set(px, BY + 0.3, pz); g.add(rl); }
    for (const sd of [-0.68, 0.68]){ const r = new THREE.Mesh(new THREE.BoxGeometry(along ? L : 0.07, 0.07, along ? 0.07 : L), post); r.position.set(along ? mx : mx + sd, BY + 0.58, along ? mz + sd : mz); g.add(r); }
    addDeck(mx, mz, along ? L : 1.5, along ? 1.5 : L, BY); if (along){ addBoxCol(mx, mz - 0.8, L, 0.1); addBoxCol(mx, mz + 0.8, L, 0.1); } else { addBoxCol(mx - 0.8, mz, 0.1, L); addBoxCol(mx + 0.8, mz, 0.1, L); } };
  walk(53.8, 10, 56.6, 10); walk(50, 13.8, 50, 16.2); walk(53.8, 20, 56.2, 20); walk(63.4, 10, 68.6, 10);
  // 碼頭尾端的告示牌
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#6e4a2f'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#fff4d6'; c.fillRect(8, 8, 240, 112); c.fillStyle = '#3f6b3a'; c.textAlign = 'center';
    c.font = 'bold 40px sans-serif'; c.fillText('紅樹林', 128, 56); c.font = '22px sans-serif'; c.fillStyle = '#5a3d2b'; c.fillText('退潮時可以下泥灘抓', 128, 96);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tx })); sg.position.set(46.8, MANG.y + 1.4, 10.0); sg.rotation.y = -Math.PI / 2; g.add(sg); { const bk = sg.clone(); bk.rotation.y += Math.PI; g.add(bk); }   /* 兩面都看得懂（以前背面是反的字） */
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), post); sp.position.set(46.85, MANG.y + 0.7, 10.0); g.add(sp); }
  // 螢火蟲（晚上才亮）
  { const N = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); for (let i = 0; i < N; i++){ const [ix, iz, r] = MANG.isl[i % 4], a = rr() * Math.PI * 2, d = rr() * (r + 1.5); pos[i * 3] = ix + Math.cos(a) * d; pos[i * 3 + 1] = 0.8 + rr() * 2.4; pos[i * 3 + 2] = iz + Math.sin(a) * d; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); Mang.flies = new THREE.Points(geo, new THREE.PointsMaterial({ color:'#d8ff7a', size:0.16, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending })); Mang.flies.userData.base = pos.slice(); g.add(Mang.flies); }
  // 紅樹林碼頭的釣點（發光圈）
  { const sp = SPOT_BY_ID.mangrove, r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 36), new THREE.MeshStandardMaterial({ color:sp.color, emissive:sp.color, emissiveIntensity:1.8, transparent:true, opacity:0.86 }));
    r.rotation.x = -Math.PI / 2; r.position.set(sp.pos.x, BY + 0.06, sp.pos.z); g.add(r); sp.ring = r; }
  // 泥灘上的小動物（退潮才出來）
  for (let i = 0; i < 14; i++){ const [ix, iz, r] = MANG.isl[i % 4], a = rr() * Math.PI * 2, d = r + 0.7 + rr() * (MANG.mud - 1.3), kind = i % 3 === 0 ? 'crab' : 'skipper';
    let m; try { m = fishModel(FISH_BY_ID[kind === 'crab' ? 'fiddler' : 'mudskipper'], kind === 'crab' ? 0.32 : 0.36); } catch(e){ continue; } m.visible = false; g.add(m);
    Mang.critters.push({ kind, m, hx: ix + Math.cos(a) * d, hz: iz + Math.sin(a) * d, x: 0, z: 0, hide: 0, hop: rr() * 3, ph: rr() * 6, gone: 0 }); }
  Mang.critters.forEach(c => { c.x = c.hx; c.z = c.hz; });
}
// 南方沙灘（參考墾丁南灣）：白沙、遮陽傘、躺椅、救生員高台、一塊塊的珊瑚礁岩
// 野外繁殖季（春夏）：月灣河岸的淺水底有一個個吳郭魚的窩，公魚守在旁邊；浮標落在窩旁邊，魚會兇兇地來咬
const Nests = [];
function buildNests(){
  if (!breedSeason()) return; const sp = SPOT_BY_ID.river; let sd = 9; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6; i++){ const d = 2.5 + rr() * 3.5, side = (rr() - 0.5) * 5, x = sp.pos.x + sp.dir.x * d + sp.dir.y * side, z = sp.pos.z + sp.dir.y * d - sp.dir.x * side; if (!waterAt(x, z)) continue;
    const y = Math.max(terrainH(x, z), -1.2) + 0.03, ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.55, 18), new THREE.MeshBasicMaterial({ color:'#5a4a32', transparent:true, opacity:0.55, depthWrite:false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, y, z); scene.add(ring);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color:'#3a3022', transparent:true, opacity:0.5, depthWrite:false })); pit.rotation.x = -Math.PI / 2; pit.position.set(x, y - 0.01, z); scene.add(pit);
    let m = null; try { m = fishModel(FISH_BY_ID.tilapia, 0.42); m.position.set(x, Math.min(WATER_LEVEL - 0.25, y + 0.25), z); scene.add(m); } catch(e){}
    Nests.push({ x, z, y, m, ph: rr() * 6 }); }
}
function nestNear(x, z){ return Nests.some(n => Math.hypot(n.x - x, n.z - z) < 1.6); }
function updateNests(t){ for (const n of Nests){ if (!n.m) continue; const a = t * 0.6 + n.ph; n.m.position.x = n.x + Math.cos(a) * 0.45; n.m.position.z = n.z + Math.sin(a) * 0.45; n.m.rotation.y = -a; } }
function buildBeach(){
  const g = new THREE.Group(); scene.add(g); let sd = 5; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gy = (x, z) => groundHeight(x, z);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(9, 32), mat('#f8ecc8', 0.95)); sand.rotation.x = -Math.PI / 2; sand.scale.set(1, 1.6, 1); sand.position.set(40, gy(40, -6) + 0.03, -6); sand.receiveShadow = true; g.add(sand);
  [['#f17b6d', 37, -9], ['#3fbf9d', 41.5, -11], ['#ffd36a', 38.5, -2.5], ['#5fb6e3', 43, -5]].forEach(([c, x, z]) => { const y = gy(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mat('#f6efe2')); pole.position.set(x, y + 1.1, z); pole.rotation.z = 0.12; g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 10, 1, true), mat(c, 0.75, { side:THREE.DoubleSide, flatShading:true })); top.position.set(x + 0.13, y + 2.2, z); top.castShadow = true; g.add(top);
    const towel = box([0.8, 0.02, 1.7], ['#ffffff', '#ffd36a', '#f5a5d8', '#7db7d7'][Math.floor(rr() * 4)], [x + 0.9, y + 0.02, z + 0.4]); towel.rotation.y = rr(); towel.castShadow = false; g.add(towel);
    const ch = new THREE.Group(); ch.position.set(x - 0.9, y, z + 0.3); ch.rotation.y = rr() * 2; g.add(ch); ch.add(box([0.6, 0.06, 1.5], '#e9e2cf', [0, 0.32, 0])); const bk = box([0.6, 0.06, 0.6], '#e9e2cf', [0, 0.55, -0.68]); bk.rotation.x = -0.9; ch.add(bk); for (const sx of [-0.25, 0.25]) for (const sz of [-0.6, 0.6]) ch.add(box([0.04, 0.3, 0.04], '#c9c2b2', [sx, 0.15, sz]));
    addCircleCol(x, z, 0.25); });
  // 救生員高台
  { const x = 44.5, z = -9, y = gy(x, z); for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) g.add(box([0.1, 2.0, 0.1], '#e9e2cf', [x + sx, y + 1.0, z + sz])); g.add(box([1.1, 0.1, 1.1], '#e9e2cf', [x, y + 2.0, z])); g.add(box([1.1, 0.7, 0.08], '#e8473a', [x, y + 2.4, z - 0.55])); addBoxCol(x, z, 1.1, 1.1); }
  // 珊瑚礁岩（墾丁海邊那種黑灰色、坑坑洞洞的石頭）
  for (let i = 0; i < 9; i++){ const x = 45 + rr() * 3.5, z = -13 + rr() * 14; if (!isLand(x, z) && terrainH(x, z) < -0.6) continue; const r = 0.4 + rr() * 0.6, k = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat('#6a665e', 0.98, { flatShading:true })); k.position.set(x, Math.max(gy(x, z), 0) + r * 0.3, z); k.rotation.set(rr() * 3, rr() * 3, 0); k.scale.y = 0.7; k.castShadow = true; g.add(k); if (isLand(x, z)) addCircleCol(x, z, r * 0.8); }
  // 牌子
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#2f89c7'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillText('🏖️ 南方沙灘', 128, 62);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: tx })); const x = 35, z = -6, y = gy(x, z); sg.position.set(x, y + 1.7, z); sg.rotation.y = Math.PI / 2; g.add(sg); { const bk = sg.clone(); bk.rotation.y += Math.PI; g.add(bk); }   /* 兩面都看得懂（以前背面是反的字） */ for (const sz of [-0.8, 0.8]) g.add(box([0.08, 1.6, 0.08], '#8c5d3b', [x, y + 0.8, z + sz])); }
}
// ===== 百年生態池（參考新竹湖口國小，前身大湖口公學校的生態池；2026-11-04）=====
// 原本的城市水圳換成這座小池塘：兩個圓圓的池子中間細細的，上面有一座紅色的拱橋；池邊一圈大石頭，池子裡有一座長滿蕨類的假山、睡蓮和荷花，
// 旁邊有竹子編的茅草小屋和大樹。魚跟原本水圳的一樣（吳郭魚、鯽魚、大肚魚、琵琶鼠魚……）。spot 的 id 還是 'canal'（伺服器的釣點清單不用改）。
var Canal = { g:null, litter:[], next:0, fade:[] };
function buildCanal(){
  const P = POND, g = new THREE.Group(); scene.add(g); Canal.g = g; let sd = 23; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const rockM = [mat('#8a8478', 0.95, { flatShading:true }), mat('#9a9286', 0.95, { flatShading:true }), mat('#76706a', 0.95, { flatShading:true })];
  // 池邊的大石頭（橋頭留空）
  P.lobes.forEach(([cx, cz, r], li) => { const n = Math.round(r * 7);
    for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2 + rr() * 0.2, rad = r + wobble(a * 3, li * 2.1) * 0.35 + 0.15, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      if (pondIn(x, z) > 0.4) continue; if (Math.abs(x - P.bx) < 1.2 && Math.abs(z - P.z) < 3.6) continue;
      const s = 0.32 + rr() * 0.32, k = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockM[i % 3]); k.position.set(x, Math.max(0, terrainH(x, z)) + s * 0.25, z); k.scale.set(1.15, 0.6, 1); k.rotation.y = rr() * 3; k.castShadow = true; k.receiveShadow = true; g.add(k); } });
  // 水：清清的、帶一點綠
  { const w = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color:'#3f7a5e', transparent:true, opacity:0.24, depthWrite:false })); w.rotation.x = -Math.PI / 2; w.scale.set(1, 0.62, 1); w.position.set(P.x, WATER_LEVEL + 0.012, P.z); w.renderOrder = 1; g.add(w); }
  for (let i = 0; i < 16; i++){ const x = P.x + (rr() - 0.5) * 10, z = P.z + (rr() - 0.5) * 6; if (pondIn(x, z) < 0.6 || Math.hypot(x - P.mound[0], z - P.mound[1]) < 1.7 || Math.abs(x - P.bx) < 1.0) continue; const k = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + rr() * 0.2, 0), rockM[i % 3]); k.position.set(x, Math.max(terrainH(x, z), -0.9) + 0.08, z); k.scale.y = 0.6; g.add(k); }
  // 睡蓮葉和花
  const padM = mat('#4f8a3e', 0.8, { side:THREE.DoubleSide }), padM2 = mat('#6aa04a', 0.8, { side:THREE.DoubleSide }), petal = mat('#f6a8c8', 0.7), petal2 = mat('#ffffff', 0.7), core = mat('#f4d050', 0.6);
  for (let i = 0; i < 26; i++){ const x = P.x + (rr() - 0.5) * 12, z = P.z + (rr() - 0.5) * 7; if (pondIn(x, z) < 0.5 || Math.hypot(x - P.mound[0], z - P.mound[1]) < 1.7 || Math.abs(x - P.bx) < 0.9) continue;
    const pd = new THREE.Mesh(new THREE.CircleGeometry(0.22 + rr() * 0.16, 12, 0.3, Math.PI * 2 - 0.5), i % 2 ? padM : padM2); pd.rotation.x = -Math.PI / 2; pd.rotation.z = rr() * 6; pd.position.set(x, WATER_LEVEL + 0.02, z); g.add(pd);
    if (i % 5 === 0){ const fl = new THREE.Group(); fl.position.set(x + 0.05, WATER_LEVEL + 0.06, z); for (let k = 0; k < 6; k++){ const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), i % 10 ? petal : petal2); p.position.set(Math.cos(k) * 0.05, 0.05, Math.sin(k) * 0.05); p.rotation.set(Math.sin(k) * 0.6, 0, -Math.cos(k) * 0.6); fl.add(p); } fl.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), core)); g.add(fl); } }
  // 假山：一堆深色石頭疊起來，上面長著蕨類和小草（不是照抄哪一座，只是那種感覺）
  { const [mx, mz] = P.mound, dark = mat('#4a4640', 0.95, { flatShading:true }), fern = mat('#4f8a3e', 0.9, { side:THREE.DoubleSide }), fern2 = mat('#6a9c48', 0.9, { side:THREE.DoubleSide });
    for (let i = 0; i < 18; i++){ const lv = i < 9 ? 0 : i < 15 ? 1 : 2, a = rr() * Math.PI * 2, r = (2 - lv) * 0.42 + rr() * 0.25, s = 0.28 + rr() * 0.22 - lv * 0.04, k = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 2 ? dark : rockM[2]);
      k.position.set(mx + Math.cos(a) * r, -0.15 + lv * 0.45 + s * 0.5, mz + Math.sin(a) * r); k.rotation.set(rr(), rr() * 3, rr()); k.castShadow = true; g.add(k); }
    for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2, b = new THREE.Group(); b.position.set(mx + Math.cos(a) * 0.55, 0.55 + (i % 3) * 0.25, mz + Math.sin(a) * 0.55); for (let k = 0; k < 5; k++){ const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.55), k % 2 ? fern : fern2); lf.position.y = 0.2; lf.rotation.set(0.5 + rr() * 0.4, k * 1.26 + a, 0); b.add(lf); } g.add(b); }
    const tb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mat('#6a645a', 0.95, { flatShading:true })); tb.scale.set(1.2, 0.8, 0.4); tb.position.set(mx + 0.3, 1.4, mz + 0.55); g.add(tb); }
  // 紅色拱橋（走得上去）
  { const red = mat('#c8322a', 0.6), redD = mat('#9a2420', 0.7), z0 = P.z - 3.0, z1 = P.z + 3.0, W = 1.3, N = 12, H = 0.42, arc = k => Math.sin(k * Math.PI) * H;
    for (let i = 0; i < N; i++){ const k0 = i / N, k1 = (i + 1) / N, zA = z0 + (z1 - z0) * k0, zB = z0 + (z1 - z0) * k1, yA = 0.28 + arc(k0), yB = 0.28 + arc(k1), L = Math.hypot(zB - zA, yB - yA);
      const pl = box([W, 0.07, L + 0.02], '', [P.bx, (yA + yB) / 2, (zA + zB) / 2], red); pl.rotation.x = -Math.atan2(yB - yA, zB - zA); g.add(pl); }
    for (let i = 0; i < 6; i++){ const k0 = i / 6, k1 = (i + 1) / 6, zc = z0 + (z1 - z0) * (k0 + k1) / 2; addDeck(P.bx, zc, W, (z1 - z0) / 6 + 0.02, 0.32 + arc((k0 + k1) / 2)); }
    for (const s of [-1, 1]){ const x = P.bx + s * (W / 2 - 0.04); for (let i = 0; i <= 6; i++){ const k = i / 6, z = z0 + (z1 - z0) * k, y = 0.28 + arc(k); g.add(box([0.07, 0.62, 0.07], '', [x, y + 0.31, z], redD)); }
      for (let i = 0; i < N; i++){ const k0 = i / N, k1 = (i + 1) / N, zA = z0 + (z1 - z0) * k0, zB = z0 + (z1 - z0) * k1, yA = 0.28 + arc(k0) + 0.6, yB = 0.28 + arc(k1) + 0.6, L = Math.hypot(zB - zA, yB - yA); const r = box([0.06, 0.06, L + 0.02], '', [x, (yA + yB) / 2, (zA + zB) / 2], red); r.rotation.x = -Math.atan2(yB - yA, zB - zA); g.add(r); }
      addBoxCol(x, P.z, 0.1, z1 - z0 - 0.6); }
    for (const z of [z0 + 0.3, z1 - 0.3]) for (const s of [-1, 1]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.4, 6), redD); p.position.set(P.bx + s * 0.55, -0.3, z); g.add(p); } }
  // 竹編茅草小屋（池邊乘涼的地方）
  { const [hx, hz] = P.hut, y = groundHeight(hx, hz), bam = mat('#c8b070', 0.8), bamD = mat('#a8904e', 0.8), thatch = mat('#9a7a48', 0.95, { flatShading:true }), w = 2.6, d = 2.0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), bam); p.position.set(hx + sx * w / 2, y + 1.05, hz + sz * d / 2); p.castShadow = true; g.add(p); addCircleCol(hx + sx * w / 2, hz + sz * d / 2, 0.1); }
    for (let k = 0; k < 11; k++){ const t = -w / 2 + k * w / 10; for (const dir of [1, -1]){ const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 4), k % 2 ? bam : bamD); s.position.set(hx + t, y + 1.0, hz + d / 2); s.rotation.z = dir * 0.5; g.add(s); } }   /* 背面的竹編格子牆 */
    addBoxCol(hx, hz + d / 2, w, 0.12);
    for (let k = 0; k < 9; k++){ const t = -d / 2 + k * d / 8; for (const dir of [1, -1]){ const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 4), k % 2 ? bam : bamD); s.position.set(hx - w / 2, y + 1.0, hz + t); s.rotation.x = dir * 0.5; g.add(s); } }
    addBoxCol(hx - w / 2, hz, 0.12, d);
    for (const s of [-1, 1]){ const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.16, d / 2 + 0.55), thatch); r.position.set(hx, y + 2.35, hz + s * (d / 4 + 0.12)); r.rotation.x = s * 0.55; r.castShadow = true; g.add(r); }
    g.add(box([1.6, 0.08, 0.4], '#8c5d3b', [hx + 0.1, y + 0.45, hz + 0.45])); for (const sx of [-0.65, 0.65]) g.add(box([0.08, 0.45, 0.35], '#6e4a2f', [hx + 0.1 + sx, y + 0.22, hz + 0.45]));
    CHAIRS.push({ x: hx + 0.1, z: hz + 0.35, face: Math.PI, y: y + 0.5 }); }
  // 大樹（遮陽）：擋到鏡頭會變透明
  for (const [x, z, s] of P.trees){ const tg = new THREE.Group(); g.add(tg); const y = groundHeight(x, z), tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 2.6 * s, 8), mat('#6a5a46', 0.95)); tr.position.set(x, y + 1.3 * s, z); tr.castShadow = true; tg.add(tr);
    for (let i = 0; i < 5; i++){ const a = i / 5 * 6.28 + rr(), c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 + rr() * 0.5) * s, 1), mat(['#4f8a3e', '#5e9a48', '#6aa850'][i % 3], 0.9, { flatShading:true })); c.position.set(x + Math.cos(a) * 0.9 * s, y + (2.9 + rr() * 0.6) * s, z + Math.sin(a) * 0.9 * s); c.scale.y = 0.75; c.castShadow = true; tg.add(c); }
    addCircleCol(x, z, 0.35 * s); Canal.fade.push({ g: tg, b: new THREE.Box3().setFromObject(tg) }); }
  // 告示牌
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#5a7a3a'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillText('🪷 百年生態池', 128, 62);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: tx })); const x = P.sign[0], z = P.sign[1], y = groundHeight(x, z); sg.position.set(x, y + 1.7, z); sg.rotation.y = Math.PI / 2; g.add(sg); { const bk = sg.clone(); bk.rotation.y = -Math.PI / 2; g.add(bk); } for (const sz of [-0.8, 0.8]) g.add(box([0.08, 1.6, 0.08], '#8c5d3b', [x, y + 0.8, z + sz])); addBoxCol(x, z, 0.3, 1.8); }
  // 釣點的發光圈
  { const sp = SPOT_BY_ID.canal, r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 36), new THREE.MeshStandardMaterial({ color:sp.color, emissive:sp.color, emissiveIntensity:1.8, transparent:true, opacity:0.86 }));
    r.rotation.x = -Math.PI / 2; r.position.set(sp.pos.x, groundHeight(sp.pos.x, sp.pos.z) + 0.07, sp.pos.z); g.add(r); sp.ring = r; }
  spawnLitter(6);
}
// ---- 撿垃圾：池邊偶爾有寶特瓶、塑膠袋、鋁罐，撿起來換愛海點數（伺服器 pick_litter 一天最多 20 個）----
const LITTER = [{ k:'bottle', name:'寶特瓶', icon:'🧴' }, { k:'bag', name:'塑膠袋', icon:'🛍️' }, { k:'can', name:'鋁罐', icon:'🥫' }];
function spawnLitter(n){
  if (!Canal.g) return; const P = POND;
  for (let i = 0, tries = 0; i < n && Canal.litter.length < 8 && tries < 40; tries++){
    const T = LITTER[Math.floor(Math.random() * 3)], L = P.lobes[Math.floor(Math.random() * P.lobes.length)], a = Math.random() * Math.PI * 2, rad = L[2] + 0.9 + Math.random() * 2.2, x = L[0] + Math.cos(a) * rad, z = L[1] + Math.sin(a) * rad;
    if (pondIn(x, z) > -0.5 || !isLand(x, z) || blocked(x, z, 0.25) || deckAt(x, z)) continue; i++;
    const m = new THREE.Group(), y = groundHeight(x, z);
    if (T.k === 'bottle'){ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), new THREE.MeshStandardMaterial({ color:'#bfe4f0', transparent:true, opacity:0.75, roughness:0.2 })); b.rotation.z = Math.PI / 2; b.position.y = 0.07; m.add(b); m.add(box([0.06, 0.06, 0.06], '#2a7ad8', [0.18, 0.07, 0])); }
    else if (T.k === 'bag'){ const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat('#f4f2ec', 0.6, { flatShading:true, transparent:true, opacity:0.9 })); b.scale.set(1.2, 0.45, 0.9); b.position.y = 0.06; m.add(b); }
    else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), mat('#c83a2a', 0.4, { metalness:0.6 })); b.rotation.z = Math.PI / 2; b.position.y = 0.05; m.add(b); }
    m.position.set(x, y, z); m.rotation.y = Math.random() * 6.28; Canal.g.add(m); Canal.litter.push({ m, x, z, T });
  }
}
function nearLitter(){ if (!Canal.g || myBoat || mySeat || F.phase !== 'idle' || Dive.on) return null; let best = null, bd = 1.2; for (const l of Canal.litter){ const d = Math.hypot(me.pos.x - l.x, me.pos.z - l.z); if (d < bd && Math.abs(groundHeight(l.x, l.z) - me.pos.y) < 0.8){ bd = d; best = l; } } return best; }
async function pickLitter(l){
  if (Canal.busy) return; Canal.busy = true; me.dip = 1;
  let ok = true; if (Cloud.on && Cloud.sb){ try { const { data, error } = await Cloud.sb.rpc('pick_litter'); if (error){ ok = false; toast(String(error.message || '').includes('今天') ? '今天已經撿很多了，謝謝你！明天再來 💙' : '等一下再撿'); } else if (data) adoptRow(data); } catch(e){ ok = false; } }
  else { const day = new Date().toDateString(); if (rec.litterDay !== day){ rec.litterDay = day; rec.litterN = 0; } if (rec.litterN >= 20){ ok = false; toast('今天已經撿很多了，謝謝你！明天再來 💙'); } else { rec.litterN++; rec.love = (rec.love || 0) + 1; } }
  Canal.busy = false; if (!ok) return;
  Canal.g.remove(l.m); Canal.litter.splice(Canal.litter.indexOf(l), 1); saveRecLocal(); SFX.chat(); flash(`${l.T.icon} 撿起${l.T.name}，丟進垃圾桶 💙 愛海 +1`, 1.4);
}
function updateCanal(dt, t){
  if (!Canal.g) return; const near = Math.hypot(me.pos.x - POND.x, me.pos.z - POND.z) < 80 && !onIsle && !House.on && !Dive.on; Canal.g.visible = near; if (!near) return;
  if (t > Canal.next){ Canal.next = t + 90; spawnLitter(2); }
  { const head = new THREE.Vector3(me.pos.x, me.pos.y + 1.2, me.pos.z), dir = head.clone().sub(camera.position), L = dir.length(), ray = new THREE.Ray(camera.position, dir.normalize()), hit = new THREE.Vector3();   /* 擋在鏡頭和自己中間的大樹變透明 */
    for (const o of Canal.fade){ const inB = o.b.containsPoint(camera.position), blk = inB || (ray.intersectBox(o.b, hit) && hit.distanceTo(camera.position) < L - 0.3), k = blk ? 0.18 : 1; o.k = o.k == null ? 1 : o.k + (k - o.k) * Math.min(1, dt * 8);
      if (Math.abs(o.k - (o.last == null ? 1 : o.last)) < 0.01) continue; o.last = o.k; o.g.traverse(m => { if (m.material){ m.material.transparent = o.k < 0.99; m.material.opacity = o.k; m.material.depthWrite = o.k > 0.6; } }); } }
}
// ===== 珊瑚礁群島（參考屏東小琉球、澎湖七美雙心石滬；2026-11-04）=====
// 從本島西岸走長長的跨海大橋過去（像澎湖跨海大橋）。島是隆起的珊瑚礁，岸邊是灰白色坑坑洞洞的珊瑚礁岩（咾咕石），
// 有白沙灘、淺淺的藍綠色礁盤、長在水裡的「花瓶岩」；島上有咾咕石砌的老房子和擋風的菜宅，東邊礁盤上有兩個愛心形的石滬：退潮時魚被困在裡面。
var Reef = { g:null, hearts:[] };
function reefE(x, z){ if (!REEF) return -99; const dx = x - REEF.x, dz = z - REEF.z, d = Math.hypot(dx, dz); if (d > REEF.r + 4) return -99; return REEF.r + wobble(Math.atan2(dz, dx) * 3, 2.3) * 0.7 - d; }
function reefH(x, z){ const e = reefE(x, z); if (e < -0.6) return null; return e > 1.2 ? REEF.y : REEF.y - (1.2 - e) * 0.13; }
function nearReef(x, z){ return !!REEF && Math.abs(x - REEF.x) < 32 && Math.abs(z - REEF.z) < 32; }
function inReef(x, z){ return !!REEF && Math.hypot(x - REEF.x, z - REEF.z) < 30; }
function heartPts(cx, cz, s, n){ const pts = []; for (let i = 0; i < n; i++){ const t = i / n * Math.PI * 2, hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pts.push([cx + hy * s, cz + hx * s]); } return pts; }
function inWeir(x, z){ for (const h of Reef.hearts){ let c = false; const P = h; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } if (c) return true; } return false; }
function buildReef(){
  const g = new THREE.Group(); scene.add(g); Reef.g = g; let sd = 31; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const R = REEF;
  const ext = (shape, depth) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:4 }); geo.rotateX(-Math.PI / 2); return geo; };
  // 淺淺的礁盤（看得到底下的白沙和珊瑚）
  { const f = new THREE.Mesh(new THREE.CircleGeometry(24, 48), mat('#d8d0a4', 0.95)); f.rotation.x = -Math.PI / 2; f.position.set(R.x + 2, -0.55, R.z - 1); f.receiveShadow = true; g.add(f);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(25, 48), new THREE.MeshBasicMaterial({ color:'#5fd8c8', transparent:true, opacity:0.22, depthWrite:false })); sh.rotation.x = -Math.PI / 2; sh.position.set(R.x + 2, WATER_LEVEL + 0.015, R.z - 1); sh.renderOrder = 1; g.add(sh); }
  for (let i = 0; i < 70; i++){ const a = rr() * Math.PI * 2, d = R.r + 1 + rr() * 11, x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d; if (Math.abs(x - R.x) < 2.2 && z < R.z) continue;
    const c = ['#f08a9a', '#c87ad8', '#f0a050', '#e8d860', '#6ad0b8', '#f4f0e0'][i % 6], sz = 0.2 + rr() * 0.45, m = new THREE.Mesh(i % 3 ? new THREE.IcosahedronGeometry(sz, 0) : new THREE.ConeGeometry(sz * 0.6, sz * 2, 5), mat(c, 0.8, { flatShading:true })); m.position.set(x, -0.5 + sz * 0.4, z); m.rotation.set(rr(), rr() * 3, rr()); g.add(m); }
  // 島：灰白色的珊瑚礁岩邊、上面是草和白沙
  const lime = mat('#d6cfbc', 0.98, { flatShading:true }), grass = mat('#9cba6e', 0.95), sand = mat('#f4ead0', 0.95);
  { const base = new THREE.Mesh(ext(islePath(R.r + 0.6, 2.3, 0.7), 2.4), lime); base.position.set(R.x, R.y - 2.45, R.z); base.receiveShadow = true; g.add(base);
    const sa = new THREE.Mesh(ext(islePath(R.r + 0.1, 2.3, 0.7), 0.04), sand); sa.position.set(R.x, R.y - 0.02, R.z); sa.receiveShadow = true; g.add(sa);
    const gr = new THREE.Mesh(ext(islePath(R.r - 2.2, 2.3, 0.7), 0.04), grass); gr.position.set(R.x, R.y + 0.005, R.z); gr.receiveShadow = true; g.add(gr); }
  for (let i = 0; i < 46; i++){ const a = rr() * Math.PI * 2; if (Math.abs(Math.sin(a) + 1) < 0.35) continue;   /* 北邊（橋過來的地方）是沙灘，不放石頭 */
    const d = R.r + wobble(a * 3, 2.3) * 0.7 - 0.3 + rr() * 1.2, x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d, r = 0.3 + rr() * 0.6, k = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), lime); k.position.set(x, R.y - 0.15 + r * 0.2, z); k.scale.y = 0.6; k.rotation.set(rr(), rr() * 3, rr()); k.castShadow = true; g.add(k); }
  // 花瓶岩：長在淺水裡、下面細上面粗的礁岩，頂上長著植物（小琉球的地標）
  { const x = R.x - 8.5, z = R.z - 12.5, rock = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.75, 3.6, 9, 3), lime); rock.position.set(x, 1.1, z); rock.castShadow = true; g.add(rock);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), mat('#5e8a46', 0.9, { flatShading:true })); top.position.set(x, 3.2, z); top.scale.y = 0.55; top.castShadow = true; g.add(top);
    const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat('#7aa055', 0.9, { flatShading:true })); b2.position.set(x + 0.6, 3.5, z + 0.3); g.add(b2); }
  // 跨海大橋（白色、中間有拱）
  { const L = R.bz1 - R.bz0, cz = (R.bz0 + R.bz1) / 2, white = mat('#eeebe4', 0.7), rail = mat('#f8f6f0', 0.6), blue = mat('#5a9ad0', 0.6);
    const dk = box([R.bw, 0.3, L], '', [R.x, R.by - 0.15, cz], white); g.add(dk); addDeck(R.x, cz, R.bw, L, R.by);
    for (const s of [-1, 1]){ const x = R.x + s * (R.bw / 2 - 0.06); g.add(box([0.08, 0.08, L], '', [x, R.by + 0.85, cz], rail)); g.add(box([0.06, 0.06, L], '', [x, R.by + 0.45, cz], rail)); for (let z = R.bz0; z <= R.bz1; z += 1.6) g.add(box([0.08, 0.9, 0.08], '', [x, R.by + 0.43, z], rail)); addBoxCol(x, cz, 0.12, L); }
    for (let z = R.bz0 + 4; z < R.bz1 - 1; z += 5.5){ const p = box([R.bw * 0.7, 3.2, 0.6], '', [R.x, R.by - 1.9, z], white); g.add(p); }
    for (const s of [-1, 1]){ const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 0.16, 6, 28, Math.PI), blue); arch.position.set(R.x + s * (R.bw / 2 + 0.1), R.by, cz); arch.rotation.y = Math.PI / 2; g.add(arch);
      for (let k = 1; k < 8; k++){ const a = k / 8 * Math.PI, hz = Math.cos(a) * 7, hy = Math.sin(a) * 7; g.add(box([0.04, hy, 0.04], '#f8f6f0', [R.x + s * (R.bw / 2 + 0.1), R.by + hy / 2, cz + hz])); } } }
  // 咾咕石屋（澎湖的老房子：珊瑚礁石砌的牆、紅瓦）和菜宅（擋東北季風的石牆菜園）
  const coralTex = () => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#b8ab8c'; c.fillRect(0, 0, 128, 64); let s2 = 7; const r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < 64; y += 10) for (let x = -(y % 20); x < 128; x += 16 + r2() * 8){ c.fillStyle = ['#d8ccae', '#c8bc9c', '#e2d8c0', '#cfc2a4'][Math.floor(r2() * 4)]; c.beginPath(); c.ellipse(x + 8, y + 5, 7 + r2() * 3, 4 + r2(), 0, 0, Math.PI * 2); c.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const ctex = coralTex(), cm = new THREE.MeshStandardMaterial({ map: ctex, roughness:0.95 });
  { const x = R.x - 3.2, z = R.z + 3.4; const w = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 3.0), cm); w.position.set(x, R.y + 1.0, z); w.castShadow = true; w.receiveShadow = true; g.add(w);
    for (const s of [-1, 1]){ const r = box([4.5, 0.1, 1.85], '#b0503a', [x, R.y + 2.42, z + s * 0.75]); r.rotation.x = s * 0.45; g.add(r); }
    g.add(box([0.9, 1.4, 0.06], '#7a4a2e', [x, R.y + 0.7, z - 1.52])); for (const s of [-1.3, 1.3]) g.add(box([0.6, 0.6, 0.06], '#3a5a6a', [x + s, R.y + 1.25, z - 1.52])); addBoxCol(x, z, 4.2, 3.0); }
  for (const [x, z] of [[R.x + 2.6, R.z + 4.2], [R.x + 5.8, R.z + 4.2], [R.x + 2.6, R.z + 7.2]]){ const w = 2.8, h = 0.9;
    for (const [dx, dz, sw, sdp] of [[0, -w / 2, w, 0.35], [0, w / 2, w, 0.35], [-w / 2, 0, 0.35, w], [w / 2, 0, 0.35, w]]){ const m = new THREE.Mesh(new THREE.BoxGeometry(sw, h, sdp), cm); m.position.set(x + dx, R.y + h / 2, z + dz); m.castShadow = true; g.add(m); addBoxCol(x + dx, z + dz, sw, sdp); }
    for (let k = 0; k < 6; k++){ const v = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(k % 2 ? '#6aa84a' : '#8ac05a', 0.9, { flatShading:true })); v.position.set(x + (k % 3 - 1) * 0.7, R.y + 0.18, z + (k < 3 ? -0.5 : 0.5)); g.add(v); } }
  // 林投（露兜樹）：海邊常見、葉子細長有刺
  for (const [x, z] of [[R.x - 6.5, R.z - 1], [R.x + 6.8, R.z - 2.5], [R.x - 5, R.z + 6.5], [R.x + 1.5, R.z - 5.8]]){ const y = R.y, tr = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.6, 6), mat('#8a7a5a')); tr.position.set(x, y + 0.8, z); tr.rotation.z = 0.15; g.add(tr);
    for (let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2, lf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.3, 3), mat('#5e8a3e', 0.9)); lf.position.set(x + Math.cos(a) * 0.4, y + 1.75, z + Math.sin(a) * 0.4); lf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(lf); }
    addCircleCol(x, z, 0.3); }
  // 雙心石滬：用咾咕石在礁盤上疊成兩個愛心，漲潮時魚游進去，退潮時被困在裡面
  const stoneM = mat('#9a8e78', 0.98, { flatShading:true });
  R.weir.forEach(([cx, cz, s]) => { const pts = heartPts(cx, cz, s, 72); Reef.hearts.push(pts);
    for (let i = 0; i < pts.length; i++){ const [x, z] = pts[i]; for (let k = 0; k < 2; k++){ const r = 0.2 + rr() * 0.12, st = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stoneM); st.position.set(x + (rr() - 0.5) * 0.25, 0.1 + k * 0.12, z + (rr() - 0.5) * 0.25); st.rotation.set(rr(), rr(), rr()); st.scale.y = 0.6; g.add(st); }
      addDeck(x, z, 0.62, 0.62, 0.3); }
    const tip = pts[Math.round(pts.length / 2)]; for (let x = R.x + R.r - 1.2; x < tip[0]; x += 0.45){ addDeck(x, tip[1], 0.7, 0.9, 0.3); const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), stoneM); st.position.set(x, 0.12, tip[1] + (rr() - 0.5) * 0.3); st.scale.y = 0.6; g.add(st); } });
  // 告示牌
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#2f9ab0'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 38px sans-serif'; c.fillText('🪸 珊瑚礁群島', 128, 62);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: tx })); const x = R.x + 2.2, z = R.bz0 - 0.4, y = groundHeight(x, z); sg.position.set(x, y + 1.7, z); sg.rotation.y = Math.PI; g.add(sg); { const bk = sg.clone(); bk.rotation.y = 0; g.add(bk); } for (const sx of [-0.8, 0.8]) g.add(box([0.08, 1.6, 0.08], '#8c5d3b', [x + sx, y + 0.8, z])); addBoxCol(x, z, 1.8, 0.3); }
  buildCages();
  // 浮潛下水點（小琉球最有名的就是浮潛看海龜）：島北邊的沙灘
  { const x = REEF.x + 3.6, z = REEF.z - REEF.r + 1.6, y = groundHeight(x, z); const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#f0a030'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillText('🤿 浮潛', 128, 62);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshBasicMaterial({ map: tx })); sg.position.set(x, y + 1.5, z); sg.rotation.y = Math.PI; g.add(sg); { const bk = sg.clone(); bk.rotation.y = 0; g.add(bk); } g.add(box([0.08, 1.4, 0.08], '#8c5d3b', [x, y + 0.7, z])); addCircleCol(x, z, 0.12); Reef.diveAt = [x, z]; }
  // 釣點的發光圈
  for (const id of ['reef', 'weir']){ const sp = SPOT_BY_ID[id], r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 36), new THREE.MeshStandardMaterial({ color:sp.color, emissive:sp.color, emissiveIntensity:1.8, transparent:true, opacity:0.86 }));
    r.rotation.x = -Math.PI / 2; r.position.set(sp.pos.x, groundHeight(sp.pos.x, sp.pos.z) + 0.07, sp.pos.z); g.add(r); sp.ring = r; }
}
function updateReef(dt, t){ if (!Reef.g) return; Reef.g.visible = Math.hypot(me.pos.x - REEF.x, me.pos.z - REEF.z) < 95 && !onIsle && !House.on && !Dive.on; if (Reef.g.visible) updateCages(dt, t); }
// ---- 箱網養殖（參考澎湖的圓形箱網）：島的西邊有一排浮在海上的圓形箱網，用浮動步道連到島上 ----
var CageV = { g:null, fish:[] };
function buildCages(){
  const g = new THREE.Group(); Reef.g.add(g); CageV.g = g; const C = CAGE, Y = 0.32;
  const hdpe = mat('#2a2c2e', 0.6), yel = mat('#f0c020', 0.6), netM = new THREE.MeshBasicMaterial({ color:'#3a5a5a', wireframe:true, transparent:true, opacity:0.35 }), plank = mat('#b88a5a', 0.9);
  const deck = (x0, x1, z0, z1) => { const w = x1 - x0, d = z1 - z0; const m = box([w, 0.12, d], '', [(x0 + x1) / 2, Y - 0.06, (z0 + z1) / 2], plank); m.castShadow = false; g.add(m); addDeck((x0 + x1) / 2, (z0 + z1) / 2, w, d, Y);
    for (let x = x0 + 0.3; x < x1; x += 1.6) for (const z of [z0 + 0.1, z1 - 0.1]){ const f = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8), mat('#e8e4d8', 0.7)); f.rotation.x = Math.PI / 2; f.position.set(x, Y - 0.2, z); g.add(f); } };
  deck(-13.6, -10.2, C.z - 0.6, C.z + 0.6); deck(-22.0, -13.6, C.z - 0.6, C.z + 0.6);   /* 浮動步道：從島上走過來，穿過兩排箱網中間 */
  C.pos.forEach(([x, z], i) => {
    for (const [r, h, m] of [[C.r, 0.12, hdpe], [C.r + 0.22, 0.1, hdpe], [C.r - 0.05, 0.95, yel]]){ const t = new THREE.Mesh(new THREE.TorusGeometry(r, h === 0.95 ? 0.025 : h, 6, 32), m); t.rotation.x = Math.PI / 2; t.position.set(x, h === 0.95 ? Y + 0.9 : Y - 0.1, z); g.add(t); }
    for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2, p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), yel); p.position.set(x + Math.cos(a) * (C.r - 0.05), Y + 0.4, z + Math.sin(a) * (C.r - 0.05)); g.add(p); }
    const n = new THREE.Mesh(new THREE.CylinderGeometry(C.r - 0.1, C.r - 0.25, 2.4, 16, 3, true), netM); n.position.set(x, Y - 1.3, z); g.add(n);
    if (i === 0){ const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80; const c = cv.getContext('2d'); c.fillStyle = '#1f6a8a'; c.fillRect(0, 0, 256, 80); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 34px sans-serif'; c.fillText('🐟 你的箱網', 128, 52);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshBasicMaterial({ map: tx })); sg.position.set(x, Y + 1.45, z + C.r + 0.05); g.add(sg); { const bk = sg.clone(); bk.rotation.y = Math.PI; g.add(bk); } } });
  buildCageFish();
}
function buildCageFish(){
  if (!CageV.g) return; for (const m of CageV.fish) CageV.g.remove(m.m); CageV.fish = [];
  const [cx, cz] = CAGE.pos[0];
  (rec.cage || []).forEach((x, i) => { let m = null; try { m = fishModel(FISH_BY_ID[x.f], clamp(0.35 + Math.log(1 + x.w) * 0.22, 0.35, 1.1)); } catch(e){} if (!m) return; CageV.g.add(m); CageV.fish.push({ m, a: i / 6 * Math.PI * 2, r: 0.5 + (i % 3) * 0.35, y: -0.25 - (i % 2) * 0.35, sp: 0.4 + (i % 4) * 0.12, cx, cz }); });
}
function updateCages(dt, t){ for (const f of CageV.fish){ f.a += dt * f.sp; f.m.position.set(f.cx + Math.cos(f.a) * f.r, f.y + Math.sin(t * 2 + f.a) * 0.05, f.cz + Math.sin(f.a) * f.r); f.m.rotation.y = -f.a; } }
function nearSnorkel(){ return !!(Reef.diveAt && !myBoat && !mySeat && F.phase === 'idle' && !Dive.on && Math.hypot(me.pos.x - Reef.diveAt[0], me.pos.z - Reef.diveAt[1]) < 1.8); }
function nearCage(){ if (!CageV.g || myBoat || mySeat || F.phase !== 'idle' || Dive.on) return false; return Math.hypot(me.pos.x - CAGE.pos[0][0], me.pos.z - CAGE.pos[0][1]) < CAGE.r + 1.6 && !!deckAt(me.pos.x, me.pos.z); }
function cageGrowNext(x){ const f = FISH_BY_ID[x.f]; return Math.min(f.max, +(x.w + (f.max - x.w) * CAGE.k).toFixed(2)); }
async function cageCall(fn, args, local){
  const rt = () => { if (!$('#sheet').hidden) renderTab(); };
  if (Cloud.on){ const row = await cloudCall(fn, args || {}); if (row){ buildCageFish(); rt(); } return !!row; }
  const ok = local(); if (ok){ saveRecLocal(); buildTank(); buildCageFish(); rt(); } return ok;
}
function cagePut(x){ if ((rec.cage || []).length >= CAGE.max){ toast(`箱網最多放 ${CAGE.max} 條`); return; }
  cageCall('cage_put', { p_ts: x.t }, () => { rec.tank = rec.tank.filter(y => y.t !== x.t); rec.show = (rec.show || []).filter(t => t !== x.t); const c = Object.assign({}, x, { w0: x.w, at: Date.now() }); delete c.fm; rec.cage = (rec.cage || []).concat([c]); return true; }).then(ok => ok && toast(`🐟 把${esc(FISH_BY_ID[x.f].name)}放進箱網了`)); }
function cageFeed(){ if (!(rec.cage || []).length){ toast('箱網裡還沒有魚'); return; } if (rec.cageFed === taipeiDate()){ toast('今天已經餵過了，明天再來'); return; } if (rec.coins < CAGE.feed){ toast('金幣不夠'); return; }
  const [cx, cz] = CAGE.pos[0]; for (let i = 0; i < 4; i++) setTimeout(() => FX.emit(cx + (Math.random() - 0.5) * 1.6, WATER_LEVEL + 0.4, cz + (Math.random() - 0.5) * 1.6, 8, '#c8a060', 0.4, 0.6, 0.8), i * 120);
  cageCall('cage_feed', {}, () => { rec.cage = rec.cage.map(x => Object.assign({}, x, { w: cageGrowNext(x) })); rec.cageFed = taipeiDate(); addCoins(-CAGE.feed); return true; }).then(ok => ok && toast('🍚 餵好了！魚長大了一點')); }
function cageTake(x){ cageCall('cage_take', { p_ts: x.t }, () => { rec.cage = rec.cage.filter(y => y.t !== x.t); const b = Object.assign({}, x, { fm: true }); delete b.w0; delete b.at; rec.tank.unshift(b); trimTank(); return true; }).then(ok => ok && toast(`🎉 收成${esc(FISH_BY_ID[x.f].name)} ${fmtKg(x.w)}，放進魚缸了`)); }
function renderCage(body){
  const list = rec.cage || [], fed = rec.cageFed === taipeiDate();
  const tip = el('div', 'tipbox'); tip.innerHTML = `<b>🐟 箱網養殖</b><span>把魚缸裡的魚放進來慢慢養大（最多 ${CAGE.max} 條）。每天可以餵一次飼料（🪙${CAGE.feed}），餵一次魚會長大「離最大重量還差的 ${Math.round(CAGE.k * 100)}%」，所以小魚長得快、快長到最大的時候長得慢。養大的魚收成後放回魚缸，可以賣比較多錢。可以養的魚：${[...FARM].map(id => FISH_BY_ID[id] && FISH_BY_ID[id].name).filter(Boolean).join('、')}。</span>`; body.appendChild(tip);
  const bar = el('div', 'tankbar'), fb = el('button', 'tbtn' + (fed || !list.length ? ' ghost' : ''), fed ? '🍚 今天餵過了' : `🍚 餵飼料（🪙${CAGE.feed}）`); fb.disabled = fed || !list.length; fb.addEventListener('click', cageFeed); bar.appendChild(fb); body.appendChild(bar);
  body.appendChild(el('div', 'dexhead', `🐟 箱網裡（${list.length} / ${CAGE.max}）`));
  if (!list.length) body.appendChild(el('div', 'empty', '箱網是空的。從下面挑魚放進來吧！'));
  else { const ul = el('ul', 'shoplist cols'); for (const x of list){ const f = FISH_BY_ID[x.f], li = el('li'); li.appendChild(fishCanvas(f, true, 56, 36)); const d = el('div', 'tinfo');
      d.appendChild(el('div', 'n', `${f.name} ${sexIcon(x)}`)); d.appendChild(el('div', 'meta', `${fmtKg(x.w0)} → ${fmtKg(x.w)}${x.w >= f.max ? '・已經長到最大' : `・明天餵了 ${fmtKg(cageGrowNext(x))}`}・可賣 🪙${fishPrice(f, x.w)}`)); li.appendChild(d);
      const a = el('div', 'tacts'), b = el('button', 'tbtn', '收成'); b.addEventListener('click', () => cageTake(x)); a.appendChild(b); li.appendChild(a); ul.appendChild(li); } body.appendChild(ul); }
  const ok = rec.tank.filter(x => FARM.has(x.f) && !x.rs);
  body.appendChild(el('div', 'dexhead', '🪣 魚缸裡可以放進來的魚'));
  if (!ok.length){ body.appendChild(el('div', 'empty', '魚缸裡沒有可以養的魚。去釣臭肚魚、白毛、虱目魚、吳郭魚這些吧！')); return; }
  const ul = el('ul', 'shoplist cols'); for (const x of ok.slice(0, 40)){ const f = FISH_BY_ID[x.f], li = el('li'); li.appendChild(fishCanvas(f, true, 56, 36)); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${x.k ? '⭐ ' : ''}${f.name} ${sexIcon(x)}`)); d.appendChild(el('div', 'meta', `${fmtKg(x.w)}・最大 ${fmtKg(f.max)}`)); li.appendChild(d);
    const a = el('div', 'tacts'), b = el('button', 'tbtn ghost', '放進箱網'); b.disabled = list.length >= CAGE.max; b.addEventListener('click', () => cagePut(x)); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}

function updateMangrove(dt, t){
  if (!Mang.g) return; const near = Math.hypot(me.pos.x - MANG.x, me.pos.z - MANG.z) < 90 && !onIsle && !House.on && !Dive.on; Mang.g.visible = near; if (!near) return;
  for (const b of Mang.birds || []){ const k = Math.max(0, Math.sin(t * 0.7 + b.position.x)) ; const dip = k > 0.97 ? (k - 0.97) / 0.03 : 0; b.userData.neck.forEach(o => { o.rotation.x = 0; }); b.userData.neck[1].position.y = 0.97 - dip * 0.35; b.userData.neck[2].position.y = 0.96 - dip * 0.38; }
  // 人走進紅樹林時，灌叢變半透明，才不會把人擋住
  if (Mang.leafInst && t > (Mang.occAt || 0)){ Mang.occAt = t + 0.12;   /* 只把擋在鏡頭和自己中間的那幾叢樹葉藏起來（以前是整片變半透明，看起來很怪） */
    const A = camera.position, B = new THREE.Vector3(me.pos.x, me.pos.y + 1.0, me.pos.z), AB = B.clone().sub(A), L2 = AB.lengthSq(), Z = new THREE.Matrix4().makeScale(0, 0, 0), tmp = new THREE.Vector3();
    Mang.leafInst.forEach((arr, k) => { const m = Mang.leaves[k]; let dirty = false;
      for (const o of arr){ const u = clamp(tmp.copy(o.p).sub(A).dot(AB) / (L2 || 1), 0, 1), d = tmp.copy(A).addScaledVector(AB, u).distanceTo(o.p), hide = (u > 0.02 && u < 0.97 && d < o.r + 0.55) || o.p.distanceTo(A) < o.r + 1.4;
        if (hide !== o.hid){ o.hid = hide; m.setMatrixAt(o.i, hide ? Z : o.mx); dirty = true; } }
      if (dirty) m.instanceMatrix.needsUpdate = true; }); }
  // 漲退潮：泥灘慢慢浮出水面／被淹沒
  const want = Env.tide.lv < -0.35 ? 0.16 + (-0.35 - Env.tide.lv) * 0.15 : -0.4 + (1 - Env.tide.lv) * 0.15 - 0.15; Mang.mudY += (want - Mang.mudY) * Math.min(1, dt * 0.5);
  for (const m of Mang.mud) m.position.y = Mang.mudY - 2.6;
  if (Mang.flies){ const op = DayNight.lamp > 0.5 ? 0.85 : 0; Mang.flies.material.opacity += (op - Mang.flies.material.opacity) * Math.min(1, dt * 0.8); if (Mang.flies.material.opacity > 0.02){ const p = Mang.flies.geometry.attributes.position, b = Mang.flies.userData.base; for (let i = 0; i < p.count; i++){ p.array[i * 3] = b[i * 3] + Math.sin(t * 0.7 + i) * 0.4; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 1.3 + i * 2.1) * 0.25; p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 0.6 + i) * 0.4; } p.needsUpdate = true; Mang.flies.material.size = 0.12 + Math.sin(t * 4) * 0.04; } }
  // 漲潮了還站在泥灘上：被水推回島上
  const e = mangE(me.pos.x, me.pos.z), onMud = e <= 0 && e > -MANG.mud && !deckAt(me.pos.x, me.pos.z) && !myBoat && !isLand(me.pos.x, me.pos.z);   /* 只有真的站在泥灘（原本是海）上才算；本島岸邊離小島很近，以前會被當成泥灘、漲潮時被「吸」到島上 */
  if (onMud && !mudOut()){ for (let k = 0; k < 40; k++){ const [ix, iz] = MANG.isl.reduce((b, s) => Math.hypot(me.pos.x - s[0], me.pos.z - s[1]) - s[2] < Math.hypot(me.pos.x - b[0], me.pos.z - b[1]) - b[2] ? s : b); const a = Math.atan2(me.pos.z - iz, me.pos.x - ix); me.pos.x -= Math.cos(a) * 0.15; me.pos.z -= Math.sin(a) * 0.15; if (mangE(me.pos.x, me.pos.z) > 0.3) break; } toast('🌊 漲潮了！泥灘被淹掉，趕快回到島上'); }
  if (onMud && !Mang.onMud && Date.now() - Mang.told > 60000){ Mang.told = Date.now(); toast('🦀 泥灘上的小動物很怕人，搖桿推一點點、慢慢靠近，再按「抓！」'); }
  Mang.onMud = onMud;
  // 小動物
  const out = mudOut(); for (const c of Mang.critters){
    const show = out && t > c.hide && !c.gone; c.m.visible = show; if (!show){ if (c.gone && t > c.gone){ c.gone = 0; c.x = c.hx; c.z = c.hz; } continue; }
    const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z);
    if (d < 2.6 && me.speed > 2.2){ c.hide = t + 8 + Math.random() * 6; SFX.splash && SFX.splash(false); if (!Mang.scared || t - Mang.scared > 10){ Mang.scared = t; toast(c.kind === 'crab' ? '招潮蟹躲回洞裡了…走慢一點' : '彈塗魚跳走了…走慢一點'); } continue; }
    c.hop -= dt; if (c.kind === 'skipper' && c.hop < 0){ c.hop = 1.5 + Math.random() * 3; const a = Math.random() * Math.PI * 2; c.tx = c.hx + Math.cos(a) * 0.6; c.tz = c.hz + Math.sin(a) * 0.6; c.ht = t; }
    if (c.ht && t - c.ht < 0.45){ const k = (t - c.ht) / 0.45; c.x += ((c.tx || c.x) - c.x) * Math.min(1, dt * 6); c.z += ((c.tz || c.z) - c.z) * Math.min(1, dt * 6); c.m.position.y = Mang.mudY + 0.02 + Math.sin(k * Math.PI) * 0.25; } else c.m.position.y = Mang.mudY + 0.02;
    if (c.kind === 'crab'){ c.x = c.hx + Math.sin(t * 0.6 + c.ph) * 0.3; c.m.rotation.z = 0; }
    c.m.position.x = c.x; c.m.position.z = c.z; c.m.rotation.y = c.kind === 'crab' ? c.ph + Math.sin(t * 3 + c.ph) * 0.15 : Math.atan2(me.pos.x - c.x, me.pos.z - c.z) + Math.PI / 2 + Math.sin(t + c.ph) * 0.3;
  }
}
function nearCritter(){ if (!Mang || !Mang.g || !mudOut() || myBoat || mySeat || F.phase !== 'idle' || Grab.busy) return null; let best = null, bd = 1.3; for (const c of Mang.critters){ if (!c.m.visible) continue; const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z); if (d < bd){ bd = d; best = c; } } return best; }
// 徒手抓：跟釣魚一樣由伺服器抽（mudflat），只是不用竿子
var Grab = { busy:false };
async function grabCritter(c){
  if (Grab.busy) return; if (!mudGrabOk()){ toast('水快漲上來了，小動物都躲起來了'); return; }
  Grab.busy = true; me.rot = Math.atan2(c.x - me.pos.x, c.z - me.pos.z); me.say('嘿！', 'alert', 0.8); camShake = Math.max(camShake, 0.08); puff(c.x, Mang.mudY, c.z);
  const kindRig = c.kind === 'crab' ? 'bottom' : 'float', sp = SPOT_BY_ID.mudflat; let f = null, w = 0;
  try {
    if (Cloud.on && Cloud.sb){ const { data, error } = await Cloud.sb.rpc('roll_fish', { p_spot:'mudflat', p_charge:0, p_x:+me.pos.x.toFixed(2), p_z:+me.pos.z.toFixed(2), p_rig:kindRig, p_line:'normal', p_bait:null, p_chum:null, p_boat:false }); if (error) throw error; f = FISH_BY_ID[data.cast_fish]; w = Number(data.cast_w); F.sex = data.cast_sex || null; F.brood = !!data.cast_brood; F.rsTag = null; }
    else { const keep = Rig.rig; Rig.rig = kindRig; F.baitUsed = null; F.buffAt = null; f = pickFish(Object.assign({}, sp, { shore:true }), 0); Rig.rig = keep; F.sex = Math.random() < 0.5 ? 'M' : 'F'; F.brood = false; F.rsTag = null; w = +(f.min + (f.max - f.min) * Math.pow(Math.random(), 1.7)).toFixed(2); }
  } catch(e){ Grab.busy = false; toast(cloudErrMsg(e)); return; }
  // 跟牠的距離越近、動作越慢，越容易抓到
  const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z), okP = clamp(0.85 - d * 0.25 - (f && f.rarity === '稀有' ? 0.15 : 0), 0.3, 0.8);
  setTimeout(() => {
    if (!f || Math.random() > okP){ Grab.busy = false; c.hide = now() + 6 + Math.random() * 6; SFX.fail(); flash(c.kind === 'crab' ? '🦀 縮回洞裡了！差一點' : '💨 跳走了！差一點', 1.2); return; }
    c.gone = now() + 25 + Math.random() * 20; SFX.catch(); const res = recordCatch(f, w); showCatch(f, w, res); announceCatch(f, w, 'mudflat'); me.holdFish(f, w, 4); pushPresence(true);
    setTimeout(() => { Grab.busy = false; }, 1800);
  }, 1650);   // 伺服器規定拋竿後 1.5 秒以上才能算釣到
}
// ---- 海上看得到別人的島（最多 3 座，用讚數排序）----
let neighborGroup = null, Neighbors = { list:null, at:0 };
const NB_POS = [[-78, -30], [70, -48], [10, -92]];
function clearNeighbors(){ if (neighborGroup){ scene.remove(neighborGroup); neighborGroup = null; } }
async function fetchIslands(){
  if (!Cloud.sb) return []; if (Neighbors.list && Date.now() - Neighbors.at < 3 * 60 * 1000) return Neighbors.list;
  try { const { data } = await Cloud.sb.from('players').select('id,nickname,island,likes').order('likes', { ascending:false }).limit(30);
    Neighbors.list = (data || []).filter(p => p.id !== myIdOrMe() && cleanIsland(p.island).items.length > 0).slice(0, 12); Neighbors.at = Date.now(); return Neighbors.list; } catch(e){ return []; }
}
async function loadNeighbors(){
  clearNeighbors(); const list = await fetchIslands(); if (!onIsle) return;
  const others = list.filter(p => p.id !== onIsle.owner).slice(0, 3); if (!others.length) return;
  neighborGroup = new THREE.Group(); scene.add(neighborGroup);
  others.forEach((p, i) => {
    const [ox, oz] = NB_POS[i], g = new THREE.Group(); g.position.set(ox, 0, oz); neighborGroup.add(g);
    const base = new THREE.Group(); base.position.set(ISLE.x, 0, ISLE.z); isleBaseMesh(base, ISLE.r, false); g.add(base);
    const L = cleanIsland(p.island); for (const it of L.items.filter(it => ISLE_ITEMS[it.t].house).concat(L.items.filter(it => !ISLE_ITEMS[it.t].house).slice(0, 18))) placeItemInGroup(g, it, false);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = 'rgba(24,51,74,.82)'; c.beginPath(); c.roundRect ? c.roundRect(8, 16, 496, 96, 48) : c.rect(8, 16, 496, 96); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${String(p.nickname || '釣客').slice(0, 8)} 的島 ❤️${p.likes || 0}`, 256, 66);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthWrite:false })); sp.scale.set(14, 3.5, 1); sp.position.set(ISLE.x, 11, ISLE.z); g.add(sp);
  });
  neighborGroup.traverse(o => { if (o.isMesh){ o.castShadow = false; } });
}
// ---- 小島分頁：商店（拿了就去擺）、逛別人的島 ----
const ItemShot = { kit:null, cache:new Map() };
function itemShot(type, size){
  if (ItemShot.cache.has(type)) return ItemShot.cache.get(type);
  if (!ItemShot.kit){ const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#b8c8a0', 1.6)); const dl = new THREE.DirectionalLight('#ffffff', 2.0); dl.position.set(3, 5, 4); sc.add(dl);
    const rt = new THREE.WebGLRenderTarget(size, size, { samples:4 }); rt.texture.colorSpace = THREE.SRGBColorSpace; ItemShot.kit = { sc, cam: new THREE.PerspectiveCamera(32, 1, 0.05, 60), rt }; }
  const K = ItemShot.kit, T = ISLE_ITEMS[type], g = itemMesh(type, { lite:true }); K.sc.add(g);
  const r = T.house ? 3.4 * (T.scale || 1) : Math.max(1.1, T.rad * 1.4), h = T.house ? 2.2 : ['palm', 'tree', 'flag', 'swing', 'parasol', 'lamp'].includes(type) ? 1.4 : 0.5;
  K.cam.position.set(r * 1.6, h + r * 0.9, r * 2.0); K.cam.lookAt(0, h, 0);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(K.rt); renderer.setClearColor('#eef6e8', 1); renderer.clear(); renderer.render(K.sc, K.cam);
  const px = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(K.rt, 0, 0, size, size, px); renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); K.sc.remove(g);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c2 = cv.getContext('2d'), id = c2.createImageData(size, size);
  for (let y = 0; y < size; y++) id.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  c2.putImageData(id, 0, 0); const url = cv.toDataURL(); ItemShot.cache.set(type, url); return url;
}
let isleTab = 'shop';
function renderIsland(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🏝️ 我的小島</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  const mine = onIsle && onIsle.owner === myIdOrMe(), bar = el('div', 'tankbar');
  const go = el('button', 'tbtn', mine ? '你在小島上' : '前往我的小島'); go.disabled = mine; go.addEventListener('click', () => { closeSheet(); goMyIsle(); }); bar.appendChild(go);
  if (onIsle){ const bk = el('button', 'tbtn ghost', '回村子'); bk.addEventListener('click', () => { closeSheet(); leaveIsle(); }); bar.appendChild(bk); }
  body.appendChild(bar);
  const seg = el('div', 'seg'); [['shop', '🛒 買東西擺島上'], ['home', '🏠 我的家' + (Home.invites.length ? ' 🔴' : '')], ['visit', '🌏 逛別人的島']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(isleTab === k)); b.addEventListener('click', () => { isleTab = k; renderTab(); }); seg.appendChild(b); }); body.appendChild(seg);
  if (isleTab === 'home'){ renderHomeTab(body); return; }
  if (isleTab === 'visit'){
    body.appendChild(el('p', 'sub', '按讚數最多的島。去參觀時可以幫他按讚（每天每座島一次）。'));
    const ul = el('ul', 'shoplist'); body.appendChild(ul);
    if (!Cloud.on){ ul.appendChild(el('li', '', '要連上雲端才能逛別人的島')); return; }
    fetchIslands().then(list => { ul.innerHTML = ''; if (!list.length){ ul.appendChild(el('li', '', '還沒有人布置小島，當第一個吧！')); return; }
      for (const p of list){ const li = el('li'); li.appendChild(el('span', 'dishic', '🏝️')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${p.nickname || '釣客'} 的島`)); d.appendChild(el('div', 'sub2', `❤️ ${p.likes || 0}・${cleanIsland(p.island).items.length} 件東西`)); li.appendChild(d);
        const a = el('div', 'tacts'), b = el('button', 'tbtn', '參觀'); b.addEventListener('click', () => visitIsle(p.id, p.nickname || '釣客')); a.appendChild(b); li.appendChild(a); ul.appendChild(li); } });
    return;
  }
  const items = isleItems(), nh = items.filter(i => ISLE_ITEMS[i.t].house).length;   /* 住在別人家時就是那座島 */
  body.appendChild(el('p', 'sub', `島上有 ${items.length} / ${ISLE_MAX} 件東西、房子 ${nh} / ${ISLE_HOUSE_MAX} 棟。按「拿去擺」之後走路調整位置、「⟲」轉方向、「✔」放下。走到房子門口可以進去！拆掉退一半金幣。`));
  for (const [title, filt] of [['🏠 房子', v => v.house], ['🌷 裝飾和家具', v => !v.house]]){
    body.appendChild(el('div', 'dexhead', title)); const ul = el('ul', 'shoplist cols');
    for (const [k, v] of Object.entries(ISLE_ITEMS).filter(([, v]) => filt(v))){
      const li = el('li'); const ic = el('img', 'gearic'); ic.alt = v.name; try { ic.src = itemShot(k, 96); } catch(e){} li.appendChild(ic);
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', v.name)); d.appendChild(el('div', 'sub2', `🪙 ${v.price.toLocaleString()}・島上 ${items.filter(i => i.t === k).length} 個`)); li.appendChild(d);
      const a = el('div', 'tacts'), b = el('button', 'tbtn' + (rec.coins < v.price ? ' ghost' : ''), '拿去擺'); b.addEventListener('click', () => { if (rec.coins < v.price){ toast(`金幣不夠，還差 🪙${(v.price - rec.coins).toLocaleString()}`); return; } startPlace(k); }); a.appendChild(b); li.appendChild(a); ul.appendChild(li);
    }
    body.appendChild(ul);
  }
}

/* ================= 有新版本時提醒（玩家自己按才重新整理，不會在拉魚時突然重開）================= */
const Upd = { base:null, ready:false, shown:false, snooze:0 };
async function checkUpdate(){
  try {
    const r = await fetch('sw.js?nocache=' + Date.now(), { cache:'no-store' }); if (!r.ok) return;
    const m = (await r.text()).match(/VERSION = '([^']+)'/); if (!m) return;
    if (!Upd.base){ Upd.base = m[1]; return; }
    if (m[1] !== Upd.base) Upd.ready = true;
  } catch(e){}
}
function maybeShowUpdate(){
  if (!Upd.ready || Upd.shown || Date.now() < Upd.snooze) return;
  if (F.phase !== 'idle' || (typeof CookGame !== 'undefined' && CookGame.on)) return;   // 正在釣魚或做料理時先不打擾
  Upd.shown = true;
  let bar = $('#updBar'); if (!bar){ bar = document.createElement('div'); bar.id = 'updBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = '';
  bar.appendChild(el('span', '', '🆕 有新版本了！'));
  const go = el('button', 'tbtn', '更新'); go.addEventListener('click', () => { go.disabled = true; go.textContent = '更新中…'; saveRecLocal(); setTimeout(() => location.reload(), 150); }); bar.appendChild(go);
  const later = el('button', 'tbtn ghost', '等一下'); later.addEventListener('click', () => { bar.hidden = true; Upd.shown = false; Upd.snooze = Date.now() + 10 * 60 * 1000; }); bar.appendChild(later);
}
function initUpdateCheck(){
  checkUpdate();
  setInterval(checkUpdate, 3 * 60 * 1000);
  setInterval(maybeShowUpdate, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
}

/* ================= TAG：鬼抓人（大廳或私人房間裡，2 人以上就能玩，純好玩不給金幣）================= */
// 發起的人是「主持人」：收集報名、選鬼、每 4 秒廣播一次狀態（後來加入的人也能同步）
const TAG_DUR = 180, TAG_RANGE = 1.3, TAG_IMMUNE = 3000;
const Tag = { st:'idle', host:null, me:null, players:[], ghost:null, endAt:0, immune:null, immuneUntil:0, openUntil:0, lastSync:0, tagSent:0 };
function tagReset(){ Object.assign(Tag, { st:'idle', host:null, players:[], ghost:null, endAt:0, immune:null, immuneUntil:0, openUntil:0 }); renderTagBar(); refreshGhostTags(); }
function tagName(k){ if (k === Tag.me) return myDisplayName() === '你' ? '你' : myDisplayName(); const p = peers.get(k); return p ? peerName(p) : '釣客'; }
function tagEmit(d){ if (room && room.connected()) room.emit('tag', d).catch(() => {}); }
function iAmGhost(){ return Tag.st === 'run' && Tag.me && Tag.ghost === Tag.me; }
function tagOpen(){
  if (!room || !room.connected()){ toast('要在大廳或房間裡才能玩鬼抓人'); return; }
  if (Tag.st !== 'idle'){ toast('已經有一局鬼抓人了'); return; }
  tagEmit({ a:'open', ms: 60000 });
}
function tagJoin(){ if (Tag.st === 'lobby') tagEmit({ a:'join' }); }
function tagLeave(){ if (Tag.st !== 'idle') tagEmit({ a:'leave' }); }
function tagStart(){
  if (Tag.st !== 'lobby' || Tag.host !== Tag.me) return;
  const pl = Tag.players.filter(k => k === Tag.me || peers.has(k)); if (pl.length < 2){ toast('至少要 2 個人才能開始'); return; }
  tagEmit({ a:'start', pl, g: pl[Math.floor(Math.random() * pl.length)], left: TAG_DUR * 1000 });
}
function onTagMsg(msg){
  const d = msg && msg.data; if (!d || typeof d.a !== 'string') return;
  if (msg.sameTab) Tag.me = msg.peer;   // 自己發出去的訊息會帶著自己的編號
  let from = msg.peer; const now = Date.now();
  if (!msg.sameTab && isBlockedPeer(from)) return;
  if (d.a === 'open'){
    if (Tag.st !== 'idle') return;
    Object.assign(Tag, { st:'lobby', host:from, players:[from], openUntil: now + clamp(+d.ms || 60000, 10000, 90000) });
    ticker(msg.sameTab ? '👻 你發起了鬼抓人，等大家加入…' : `👻 <b>${esc(tagName(from))}</b> 發起了鬼抓人！按上面的「加入」一起玩`);
  } else if (d.a === 'join'){
    if (Tag.st === 'lobby' && !Tag.players.includes(from)){ Tag.players.push(from); if (!msg.sameTab) ticker(`👻 <b>${esc(tagName(from))}</b> 加入了鬼抓人`); }
  } else if (d.a === 'leave'){
    Tag.players = Tag.players.filter(k => k !== from);
    if (from === Tag.host && Tag.st === 'lobby'){ ticker('👻 鬼抓人取消了'); tagReset(); return; }
    if (Tag.st === 'run' && Tag.players.length < 2){ tagFinish('人數不夠，這局提早結束'); return; }
    if (Tag.st === 'run' && from === Tag.ghost && Tag.host === Tag.me){ const g = Tag.players[Math.floor(Math.random() * Tag.players.length)]; tagEmit({ a:'sync', pl:Tag.players, g, left:Tag.endAt - now }); }
  } else if (d.a === 'start' || d.a === 'sync'){
    if (from !== Tag.host && Tag.host) return;   // 只聽主持人的
    if (!Array.isArray(d.pl) || typeof d.g !== 'string') return;
    const wasRun = Tag.st === 'run', oldGhost = Tag.ghost;
    Object.assign(Tag, { st:'run', host:from, players:d.pl.filter(k => typeof k === 'string').slice(0, 20), ghost:d.g, endAt: now + clamp(+d.left || 0, 0, TAG_DUR * 1000) });
    if (!wasRun){ SFX.bite(); flash(d.g === Tag.me ? '👻 你是鬼！去碰別人' : `👻 ${tagName(d.g)} 是鬼，快跑！`, 2); ticker(`👻 鬼抓人開始！第一個鬼是 <b>${esc(tagName(d.g))}</b>`); }
    else if (oldGhost !== d.g) refreshGhostTags();
    refreshGhostTags();
  } else if (d.a === 'tag'){
    // 鬼說「抓到你了」：只有被抓的人自己確認（用他自己的真實位置和鬼送來的位置比），確認了才算，大家才換鬼
    if (Tag.st !== 'run' || from !== Tag.ghost || d.to !== Tag.me || d.to === from) return;
    if (Tag.immune === d.to && now < Tag.immuneUntil) return;
    if (!isFinite(+d.x) || !isFinite(+d.z) || Math.hypot(me.pos.x - +d.x, me.pos.z - +d.z) > TAG_RANGE + 0.6) return;   // 其實離很遠（網路延遲造成的隔空抓）
    tagEmit({ a:'caught', by: from });
  } else if (d.a === 'caught'){
    if (Tag.st !== 'run' || d.by !== Tag.ghost || !Tag.players.includes(from) || from === d.by) return;
    if (Tag.immune === from && now < Tag.immuneUntil) return;
    d.to = from; from = d.by;
    Tag.ghost = d.to; Tag.immune = from; Tag.immuneUntil = now + TAG_IMMUNE;
    ticker(`👻 <b>${esc(tagName(from))}</b> 抓到了 <b>${esc(tagName(d.to))}</b>！`);
    if (d.to === Tag.me){ SFX.bite(); flash('👻 被抓到了！換你當鬼', 1.6); camShake = Math.max(camShake, 0.15); }
    else if (from === Tag.me) flash('抓到了！快跑 🏃', 1.2);
    refreshGhostTags();
  } else if (d.a === 'end'){
    if (from === Tag.host && Tag.st === 'run') tagFinish();
  }
  renderTagBar(); if (!$('#sheet').hidden && curTab === 'people') renderTab();
}
function tagFinish(why){
  const loser = Tag.ghost;
  if (why) ticker('👻 ' + why);
  else { ticker(`⏰ 鬼抓人結束！最後的鬼是 <b>${esc(tagName(loser))}</b> 😝`); flash(loser === Tag.me ? '時間到…你是最後的鬼 😝' : '時間到！你贏了 🎉', 2.2); if (loser !== Tag.me){ SFX.catch(); FX.emit(me.pos.x, 2, me.pos.z, 20, '#ffd36a', 1.2, 2.2, 1.0); } }
  tagReset();
}
function refreshGhostTags(){
  const g = Tag.st === 'run' ? Tag.ghost : null;
  me.tag.classList.toggle('ghost', !!g && g === Tag.me);
  for (const [k, p] of peers) p.fisher.tag.classList.toggle('ghost', !!g && g === k);
}
function tagTick(){
  const now = Date.now();
  if (Tag.st === 'lobby' && now > Tag.openUntil){ if (Tag.host === Tag.me && Tag.players.length >= 2) tagStart(); else if (Tag.host === Tag.me){ ticker('👻 沒有人加入，鬼抓人取消了'); tagEmit({ a:'leave' }); } else if (now > Tag.openUntil + 8000) tagReset(); }
  if (Tag.st !== 'run') return;
  if (!Tag.players.includes(Tag.me) && Tag.host !== Tag.me){ /* 沒參加的人只看 */ }
  // 主持人：時間到就宣布結束；定期廣播狀態；鬼斷線就換人
  if (Tag.host === Tag.me){
    const alive = Tag.players.filter(k => k === Tag.me || peers.has(k));
    if (alive.length !== Tag.players.length){ Tag.players = alive; if (alive.length < 2){ tagEmit({ a:'end' }); tagFinish('人數不夠，這局提早結束'); return; } if (!alive.includes(Tag.ghost)){ Tag.ghost = alive[Math.floor(Math.random() * alive.length)]; Tag.lastSync = 0; } }
    if (now >= Tag.endAt){ tagEmit({ a:'end' }); return; }
    if (now - Tag.lastSync > 4000){ Tag.lastSync = now; tagEmit({ a:'sync', pl:Tag.players, g:Tag.ghost, left:Tag.endAt - now }); }
  } else if (now > Tag.endAt + 6000) tagFinish();   // 主持人不見了
  // 我是鬼：碰到別人就抓
  if (iAmGhost() && now - Tag.tagSent > 600){
    for (const k of Tag.players){ if (k === Tag.me) continue; if (Tag.immune === k && now < Tag.immuneUntil) continue; const p = peers.get(k); if (!p || !p.fisher.av.g.visible) continue;
      // 用對方最新傳來的位置（不是畫面上慢慢跟過去的位置），而且畫面上也要真的碰到
      if (Math.hypot(p.target.x - me.pos.x, p.target.z - me.pos.z) < TAG_RANGE && Math.hypot(p.fisher.pos.x - me.pos.x, p.fisher.pos.z - me.pos.z) < TAG_RANGE + 0.3){ Tag.tagSent = now; tagEmit({ a:'tag', to:k, x:+me.pos.x.toFixed(2), z:+me.pos.z.toFixed(2) }); break; } }
  }
  renderTagBar(true);
}
function renderTagBar(timeOnly){
  let bar = $('#tagBar');
  if (Tag.st === 'idle'){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'tagBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false;
  const inGame = Tag.players.includes(Tag.me), now = Date.now();
  if (timeOnly && Tag.st === 'run'){ const t = bar.querySelector('.tt'); if (t){ const s = Math.max(0, Math.ceil((Tag.endAt - now) / 1000)); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; return; } }
  if (timeOnly) return;
  bar.innerHTML = ''; bar.classList.toggle('isghost', iAmGhost());
  if (Tag.st === 'lobby'){
    bar.appendChild(el('span', '', `👻 鬼抓人報名中（${Tag.players.length} 人）`));
    if (!inGame){ const b = el('button', 'tbtn', '加入'); b.addEventListener('click', tagJoin); bar.appendChild(b); }
    else { if (Tag.host === Tag.me){ const b = el('button', 'tbtn', '開始'); b.disabled = Tag.players.length < 2; b.addEventListener('click', tagStart); bar.appendChild(b); }
      const x = el('button', 'tbtn ghost', Tag.host === Tag.me ? '取消' : '退出'); x.addEventListener('click', tagLeave); bar.appendChild(x); }
  } else {
    bar.appendChild(el('span', '', iAmGhost() ? '👻 你是鬼！去碰別人' : `👻 鬼：${tagName(Tag.ghost)}`));
    bar.appendChild(el('b', 'tt', ''));
    if (!inGame) bar.appendChild(el('small', '', '（觀戰中）'));
    else { const x = el('button', 'tbtn ghost', '退出'); x.addEventListener('click', tagLeave); bar.appendChild(x); }
    renderTagBar(true);
  }
}


/* ================= 天氣、潮汐、今日情報（全服同步：都用真實時間算，大家看到的一樣）================= */
const WX_BLOCK = 9 * 60 * 1000, TIDE_PERIOD = 18 * 60 * 1000;
const WEATHERS = {
  sunny:  { name:'晴天',   icon:'☀️', w:45, desc:'天氣很好，一切正常。' },
  cloudy: { name:'多雲',   icon:'⛅', w:25, desc:'雲多一點，稀有魚稍微多一些。', rare:1.05, light:0.82 },
  rain:   { name:'下雨',   icon:'🌧️', w:15, desc:'下雨天魚比較好咬，雷魚、鯰魚、鰻魚、黑鱸特別多。', bite:0.8, rare:1.15, light:0.62, rain:700 },
  fog:    { name:'起霧',   icon:'🌫️', w:8,  desc:'霧很濃，看不遠，但稀有魚比較多。', rare:1.25, light:0.75, fog:true },
  storm:  { name:'暴風雨', icon:'⛈️', w:7,  desc:'外海和海邊的傳說魚多很多，但拉線比較吃力。', bite:0.9, rare:1.2, legend:1.6, legendSea:true, tension:1.12, light:0.42, rain:1400, storm:true },
};
const RAIN_FISH = new Set(['catfish', 'eel', 'snakehead', 'tilapia', 'bass', 'loach']);
function hash32(str){ let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function weatherAt(ms){
  const b = Math.floor(ms / WX_BLOCK), r = hash32('wx' + b) % 100; let acc = 0;
  for (const [k, v] of Object.entries(WEATHERS)){ acc += v.w; if (r < acc) return k; } return 'sunny';
}
function tideNow(ms){
  const ph = (ms % TIDE_PERIOD) / TIDE_PERIOD, lv = Math.sin(ph * Math.PI * 2), d = Math.cos(ph * Math.PI * 2);
  const st = lv > 0.8 ? 'high' : lv < -0.8 ? 'low' : d > 0 ? 'rising' : 'falling';
  return { lv, st, name: { high:'滿潮', low:'乾潮', rising:'漲潮', falling:'退潮' }[st], icon: { high:'🌊', low:'🏖️', rising:'🌊↑', falling:'🌊↓' }[st] };
}
const TIDE_FX = { rising:{ bite:0.78, rare:1.15 }, high:{ bite:0.9, rare:1.05 }, falling:{ bite:1.0, rare:1.0 }, low:{ bite:1.25, rare:0.9 } };
function taipeiDate(){ return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function dailyTip(){
  const d = taipeiDate(); if (dailyTip.c && dailyTip.c.d === d) return dailyTip.c;
  const spots = SPOTS.filter(s => s.id !== 'isle'), h = hash32('tip' + d), sp = spots[h % spots.length];
  const pool = sp.fish.map(id => FISH_BY_ID[id]).filter(f => f && f.rarity !== '傳說' && !f.of), f = pool[(h >>> 8) % pool.length];
  return (dailyTip.c = { d, spot: sp.id, fish: f.id, text: `今天${sp.label}的「${f.name}」特別多！` });
}
// 釣魚的加成：給 doCast（等待時間）、pickFish（稀有／傳說／權重）、拉線（張力）用
function envBonus(spotId){
  const W = WEATHERS[Env.wx], sea = SEA_SPOTS.has(spotId), T = sea ? TIDE_FX[Env.tide.st] : { bite:1, rare:1 };
  const crew = crewNear();   // 船隊加成：附近每多一個人在船上，魚快 8% 上鉤（最多 3 人）
  const wk = spotId === 'weir' ? (Env.tide.st === 'low' ? 0.5 : Env.tide.st === 'high' ? 1.35 : 1) : 1;   /* 石滬：退潮時魚被困在裡面，咬得很快；滿潮時魚都游出去了 */
  return { bite: (W.bite || 1) * T.bite * wk * (1 - 0.08 * crew), rare: (W.rare || 1) * T.rare, legend: W.legendSea ? (sea ? W.legend : 1) : (W.legend || 1), tension: W.tension || 1, crew };
}
const Env = { wx:'sunny', tide: tideNow(Date.now()), rain:null, flash:0, k:1, lastWx:null };
function buildRain(){
  const N = 1400, pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++){ const x = (Math.random() - 0.5) * 40, y = Math.random() * 18, z = (Math.random() - 0.5) * 40; pos.set([x, y, z, x + 0.05, y - 0.55, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color:'#cfe6f5', transparent:true, opacity:0.45, depthWrite:false });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.visible = false; scene.add(l); return l;
}
function updateEnv(dt, t){
  const ms = Date.now(); Env.tide = tideNow(ms);
  const wx = (location.hash.match(/wx=(\w+)/) || [])[1]; Env.wx = WEATHERS[wx] ? wx : weatherAt(ms);
  const W = WEATHERS[Env.wx];
  if (Env.lastWx !== Env.wx){ if (Env.lastWx) ticker(`${W.icon} 天氣變成<b>${W.name}</b>了：${W.desc}`); else { Env.k = W.light || 1; setTimeout(() => ticker(`🧔 釣具店老闆的今日情報：${esc(dailyTip().text)}　現在 ${W.icon} ${W.name}、${Env.tide.icon} ${Env.tide.name}`), 4000);
      const chip = $('#wxChip'); if (chip) chip.addEventListener('click', () => { const W2 = WEATHERS[Env.wx]; toast(`${SEASONS[SEASON].icon} ${SEASONS[SEASON].name}：${SEASONS[SEASON].desc}<br>${W2.icon} ${W2.name}：${W2.desc}<br>${Env.tide.icon} ${Env.tide.name}：海邊、外海、小島在漲潮時最好釣，乾潮時比較難。<br>🧔 ${esc(dailyTip().text)}`); }); }
    Env.lastWx = Env.wx; }
  // 畫面：光線變暗、下雨、起霧、打雷
  const dim = House.on || inHall() ? 1 : (W.light || 1); Env.k += (dim - Env.k) * Math.min(1, dt * 0.6);
  sun.intensity *= Env.k; hemi.intensity *= 0.55 + 0.45 * Env.k;
  if (W.fog && !House.on && !inHall()){ scene.fog.near = 8; scene.fog.far = 55; } else { scene.fog.near = 45; scene.fog.far = 140; }
  if (!Env.rain) Env.rain = buildRain();
  const rn = House.on || Dive.on || inHall() ? 0 : (W.rain || 0); Env.rain.visible = rn > 0;
  if (rn > 0){ Env.rain.geometry.setDrawRange(0, rn * 2); Env.rain.position.set(camera.position.x, camera.position.y - 6, camera.position.z); const a = Env.rain.geometry.attributes.position.array, fall = dt * (W.storm ? 26 : 18);
    for (let i = 0; i < rn; i++){ const o = i * 6; a[o + 1] -= fall; a[o + 4] -= fall; if (a[o + 1] < 0){ a[o + 1] += 18; a[o + 4] += 18; } if (W.storm){ a[o + 3] = a[o] + 0.25; } } Env.rain.geometry.attributes.position.needsUpdate = true;
    if (Math.random() < dt * 6) ripple(me.pos.x + (Math.random() - 0.5) * 16, me.pos.z + (Math.random() - 0.5) * 16); }
  if (W.storm && !House.on && !Dive.on && !inHall()){ if (Env.flash <= 0 && Math.random() < dt * 0.08){ Env.flash = 0.25; camShake = Math.max(camShake, 0.04); SFX.fail && 0; } if (Env.flash > 0){ Env.flash -= dt; hemi.intensity += 2.2 * Math.max(0, Env.flash) / 0.25; } }
  if (Dive.on) diveEnvFx();
  updateSeasonFx(dt, t, rn > 0);
  const chip = $('#wxChip'); if (chip){ const txt = `${SEASONS[SEASON].icon} ${W.icon} ${W.name}・${Env.tide.icon} ${Env.tide.name}`; if (chip._t !== txt){ chip.textContent = txt; chip._t = txt; } }
}

/* ---- 定時釣魚大賽：每天台灣時間 12:00、19:00、21:00 各 10 分鐘，比總重量（伺服器 017_tourney.sql 算分、發獎）---- */
const TOURNEY = { hours:[12, 19, 21], mins:10, prize:[3000, 1500, 800], join:100 };
var Tny = { on:false, id:null, myW:0, myN:0, board:[], boardId:null, boardAt:0, warnId:null };
function tnyId(dayStart, h){ const d = new Date(dayStart + 8 * 3600e3 + h * 3600e3); return Number(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(h).padStart(2, '0')}`); }
function tourneyNow(ms){
  ms = ms || Date.now(); const L = new Date(ms + 8 * 3600e3), day0 = Date.UTC(L.getUTCFullYear(), L.getUTCMonth(), L.getUTCDate()) - 8 * 3600e3, dur = TOURNEY.mins * 60e3;
  if (/tny=on/.test(location.hash)){ const h = L.getUTCHours(), st = day0 + h * 3600e3; return { active:true, id:tnyId(day0, h), start:st, end:Math.max(ms + 5 * 60e3, st + dur), test:true }; }
  for (let k = 0; k < 2; k++) for (const h of TOURNEY.hours){ const st = day0 + k * 86400e3 + h * 3600e3; if (ms < st + dur) return { active: ms >= st, id: tnyId(day0 + k * 86400e3, h), start: st, end: st + dur }; }
  return { active:false, id:null, start:Infinity, end:Infinity };
}
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
async function loadTnyBoard(id){
  if (!Cloud.sb || !id) return; Tny.boardAt = Date.now();
  try { const { data, error } = await Cloud.sb.from('players').select('id,nickname,tourney_id,tourney_w,tourney_n').eq('tourney_id', id).gt('tourney_w', 0).order('tourney_w', { ascending:false }).limit(10);
    if (!error && data){ Tny.board = data.filter(r => Number(r.tourney_id) === id).map(r => ({ id:r.id, name:r.nickname, w:Number(r.tourney_w) || 0, n:r.tourney_n || 0 })); Tny.boardId = id; }
    if (!$('#sheet').hidden && curTab === 'rank' && lbMode === 'tny') renderTab(); } catch(e){}
}
function tnyRank(){ const mine = Tny.myW; if (!(mine > 0)) return 0; return 1 + Tny.board.filter(r => r.id !== myId && r.w > mine).length; }
async function claimTourney(){
  if (!Cloud.on) return; const before = rec.coins, row = await cloudCall('claim_tourney'); if (!row) return;
  const got = (Number(row.coins) || 0) - before; if (got <= 0) return;
  const rk = TOURNEY.prize.indexOf(got); SFX.catch();
  flash(rk >= 0 ? `🏆 釣魚大賽第 ${rk + 1} 名！獎金 🪙${got}` : `🎣 參加釣魚大賽的獎勵 🪙${got}`, 2.4);
  ticker(rk >= 0 ? `🏆 <b>你</b> 在釣魚大賽拿到第 ${rk + 1} 名，獎金 🪙${got}！` : `🎣 謝謝參加釣魚大賽，送你 🪙${got}`);
}
function tourneyTick(){
  const T = tourneyNow(), nowMs = Date.now();
  if (T.active && !Tny.on){ Tny.on = true; Tny.id = T.id; Tny.test = !!T.test; if (Tny.myId !== T.id){ Tny.myW = 0; Tny.myN = 0; Tny.myId = T.id; } Tny.board = []; Tny.boardId = T.id;
    flash('🏆 釣魚大賽開始！', 1.8); ticker(`🏆 <b>釣魚大賽開始了！</b>${TOURNEY.mins} 分鐘內釣到的魚，總重量最重的前三名有獎（🪙${TOURNEY.prize.join(' / ')}）`); loadTnyBoard(T.id); }
  if (!T.active && Tny.on){ Tny.on = false; const id = Tny.id; ticker(`🏁 釣魚大賽結束了！${Tny.myN ? `你釣了 ${Tny.myN} 條、${Tny.myW.toFixed(2)}kg，` : ''}名次馬上公布`); setTimeout(() => { loadTnyBoard(id); claimTourney(); }, 25000 + Math.random() * 8000); }
  if (!T.active && T.start - nowMs < 5 * 60e3 && Tny.warnId !== T.id){ Tny.warnId = T.id; ticker(`⏰ 釣魚大賽 ${Math.ceil((T.start - nowMs) / 60000)} 分鐘後開始，先找好釣點吧！`); }
  if (Tny.on && Date.now() - Tny.boardAt > 20000) loadTnyBoard(Tny.id);
  // 大賽倒數（在左上角資訊列）
  let pill = $('#tnyPill'); const soon = !T.active && T.start - nowMs < 15 * 60e3;
  if (!T.active && !soon){ if (pill) pill.hidden = true; return; }
  if (!pill){ pill = document.createElement('button'); pill.id = 'tnyPill'; pill.addEventListener('click', () => { lbMode = 'tny'; openSheet('rank'); }); ($('#online') || document.body).appendChild(pill); }   /* 放進左上角的資訊列，不再單獨一顆 */
  pill.hidden = false; pill.classList.toggle('live', T.active);
  const txt = T.active ? `🏆 大賽 ${mmss(T.end - nowMs)}・${Tny.myW > 0 ? `${Tny.myW.toFixed(1)}kg 第 ${tnyRank()} 名` : Cloud.on ? '快去釣！' : '要連上雲端'}` : `🏆 大賽 ${mmss(T.start - nowMs)} 後開始`;
  if (pill._t !== txt){ pill.textContent = txt; pill._t = txt; }
}
setInterval(tourneyTick, 1000);
/* ---- 好友與送禮（伺服器 018_friends.sql；名單和禮物只有自己看得到）---- */
var Fr = { list:[], req:[], gifts:[], at:0, giftTo:null, notified:'' };
function friendCode(){ return (Cloud.userId || '').slice(0, 8); }
function isFriend(uid){ return Fr.list.some(f => f.id === uid); }
function onlineUids(){ const s = new Set(); for (const p of peers.values()) if (typeof p.pres.u === 'string') s.add(p.pres.u); return s; }
async function frRpc(fn, args){
  if (!Cloud.on || !Cloud.sb) return null;
  try { const { data, error } = await Cloud.sb.rpc(fn, args || {}); if (error){ const m = String(error.message || error), k = CLOUD_ERR.find(x => m.includes(x)); toast(k ? `伺服器：${esc(k)}` : '暫時連不上雲端'); return null; } return data; } catch(e){ toast('暫時連不上雲端'); return null; }
}
function adoptFriends(d){
  if (!d || typeof d !== 'object') return; Fr.list = Array.isArray(d.friends) ? d.friends : []; Fr.req = Array.isArray(d.requests) ? d.requests : []; Fr.gifts = Array.isArray(d.gifts) ? d.gifts : []; Fr.at = Date.now();
  const key = Fr.gifts.map(g => g.id).join(',') + '|' + Fr.req.map(r => r.id).join(',');
  if (key !== Fr.notified){ const newG = Fr.gifts.length && !Fr.notified.startsWith(Fr.gifts.map(g => g.id).join(',')); if (Fr.notified !== '' || Fr.gifts.length || Fr.req.length){ if (Fr.gifts.length && newG) ticker(`🎁 你有 ${Fr.gifts.length} 個禮物還沒打開（玩家分頁）`); else if (Fr.req.length) ticker(`👋 有 ${Fr.req.length} 個人想加你好友（玩家分頁）`); } Fr.notified = key; }
  const dot = Fr.gifts.length + Fr.req.length; $$('[data-tab="people"]').forEach(b => b.classList.toggle('hasdot', dot > 0));
  if (!$('#sheet').hidden && curTab === 'people') renderTab();
}
async function loadFriends(){ const d = await frRpc('get_friends'); if (d) adoptFriends(d); }
async function addFriend(uid, name){ const d = await frRpc('add_friend', { p_uid: uid }); if (d){ adoptFriends(d); const f = Fr.list.find(x => x.id === uid); toast(f && f.mutual ? `🤝 你和 ${esc(name || '對方')} 成為好友了！` : `👋 已經送出好友邀請給 ${esc(name || '對方')}，對方也加你就是好友了`); } }
async function openGift(g){
  const before = rec.coins, row = await cloudCall('open_gift', { p_id: g.id }); if (!row) return;
  SFX.catch(); const from = g.name || '朋友';
  if (g.kind === 'coins') flash(`🎁 ${from} 送你 🪙${(Number(row.coins) || 0) - before}！`, 1.8);
  else { const f = FISH_BY_ID[g.data && g.data.f]; flash(`🎁 ${from} 送你一條${f ? f.name : '魚'}${g.data && g.data.w ? ' ' + Number(g.data.w).toFixed(2) + 'kg' : ''}！`, 1.8); }
  Fr.gifts = Fr.gifts.filter(x => x.id !== g.id); adoptFriends({ friends:Fr.list, requests:Fr.req, gifts:Fr.gifts });
}
async function sendGift(to, kind, val){
  const args = { p_to: to.id, p_kind: kind, p_ts: kind === 'fish' ? val : null, p_amount: kind === 'coins' ? val : null };
  const row = await cloudCall('send_gift', args); if (!row) return;
  SFX.chat(); toast(`🎁 送出去了！${esc(to.name || '朋友')} 打開就會收到`); if (room && room.connected()) room.emit('gift', { to: to.id }).catch(() => {});
  renderTab();
}
setInterval(() => { if (Cloud.on) loadFriends(); }, 60000);
function renderFriends(body){
  if (!Cloud.on){ body.appendChild(el('p', 'sub', '連上雲端以後就能加好友、互相送禮。')); return; }
  if (Date.now() - Fr.at > 15000 && !Fr.loading){ Fr.loading = true; loadFriends().finally(() => { Fr.loading = false; }); }
  // 送禮畫面
  if (Fr.giftTo){ const to = Fr.giftTo;
    const head = el('div', 'tankbar'); head.appendChild(el('b', '', `🎁 送禮給 ${to.name || '朋友'}`)); const bk = el('button', 'tbtn ghost', '返回'); bk.addEventListener('click', () => { Fr.giftTo = null; renderTab(); }); head.appendChild(bk); body.appendChild(head);
    body.appendChild(el('p', 'sub', '金幣每天最多送 1000，魚每天最多送 10 條（展示中的魚不能送）。對方打開禮物就會收到。'));
    body.appendChild(el('div', 'dexhead', `🪙 金幣（你有 ${rec.coins.toLocaleString()}）`)); const cb = el('div', 'tankbar');
    for (const n of [50, 100, 300, 1000]){ const b = el('button', 'tbtn' + (rec.coins < n ? ' ghost' : ''), `送 🪙${n}`); b.disabled = rec.coins < n; b.addEventListener('click', () => { b.disabled = true; sendGift(to, 'coins', n); }); cb.appendChild(b); }
    body.appendChild(cb);
    body.appendChild(el('div', 'dexhead', '🐟 魚缸裡的魚')); const locked = new Set(rec.show || []);
    const list = rec.tank.filter(x => !locked.has(x.t) && !FISH_BY_ID[x.f].rs && !x.k).sort((a, b) => fishPrice(FISH_BY_ID[b.f], b.w) - fishPrice(FISH_BY_ID[a.f], a.w)).slice(0, 24);
    if (!list.length) body.appendChild(el('div', 'empty', '魚缸裡沒有可以送的魚。'));
    const ul = el('ul', 'shoplist cols');
    for (const x of list){ const f = FISH_BY_ID[x.f], li = el('li'); li.appendChild(fishCanvas(f, true, 56, 36)); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', f.name)); d.appendChild(el('div', 'meta', `${fmtKg(x.w)}・${f.rarity}`)); li.appendChild(d);
      const b = el('button', 'tbtn', '送這條'); b.addEventListener('click', () => { b.disabled = true; sendGift(to, 'fish', x.t); }); li.appendChild(b); ul.appendChild(li); }
    body.appendChild(ul); return true;
  }
  const box = el('div', 'tipbox'); box.innerHTML = `<b>🤝 你的好友代碼：<span class="fcode">${esc(friendCode())}</span></b><span>把代碼給朋友，或在下面輸入朋友的代碼。在大廳裡的人也可以直接按「加好友」。互相加好友以後就能送禮。</span>`;
  const row = el('div', 'fadd'), inp = el('input'); inp.placeholder = '輸入朋友的 8 碼代碼'; inp.maxLength = 8; inp.autocapitalize = 'off'; const go = el('button', 'tbtn', '加好友');
  go.addEventListener('click', async () => { const c = inp.value.trim(); if (!/^[0-9a-fA-F]{8}$/.test(c)){ toast('好友代碼是 8 個英文或數字'); return; } go.disabled = true; const d = await frRpc('add_friend_code', { p_code: c }); go.disabled = false; if (d){ adoptFriends(d); inp.value = ''; toast('👋 已經送出好友邀請'); } });
  row.append(inp, go); box.appendChild(row); body.appendChild(box);
  if (Fr.gifts.length){ body.appendChild(el('div', 'dexhead', `🎁 收到的禮物（${Fr.gifts.length}）`)); const ul = el('ul', 'shoplist');
    for (const g of Fr.gifts){ const li = el('li', 'on'), f = g.kind === 'fish' && FISH_BY_ID[g.data && g.data.f]; li.appendChild(el('span', 'dishic', g.kind === 'coins' ? '🪙' : '🐟'));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${g.name || '朋友'} 送的禮物`)); d.appendChild(el('div', 'meta', g.kind === 'coins' ? `金幣 ${g.data && g.data.amount}` : f ? `${f.name} ${Number(g.data.w).toFixed(2)}kg` : '一條魚')); li.appendChild(d);
      const b = el('button', 'tbtn', '打開'); b.addEventListener('click', () => { b.disabled = true; openGift(g); }); li.appendChild(b); ul.appendChild(li); }
    body.appendChild(ul); }
  if (Fr.req.length){ body.appendChild(el('div', 'dexhead', `👋 想加你好友（${Fr.req.length}）`)); const ul = el('ul', 'people');
    for (const r of Fr.req){ const li = el('li'); li.append(el('span', '', r.name || '釣客')); const a = el('button', 'tbtn vbtn', '加回去'); a.addEventListener('click', () => addFriend(r.id, r.name)); const n = el('button', 'tbtn ghost vbtn', '不要'); n.addEventListener('click', async () => { const d = await frRpc('remove_friend', { p_uid: r.id }); if (d) adoptFriends(d); }); li.append(a, n); ul.appendChild(li); }
    body.appendChild(ul); }
  body.appendChild(el('div', 'dexhead', `⭐ 好友（${Fr.list.filter(f => f.mutual).length}）`));
  if (!Fr.list.length) body.appendChild(el('p', 'sub', '還沒有好友。'));
  const on = onlineUids(), ul = el('ul', 'people');
  for (const f of Fr.list.slice().sort((a, b) => (on.has(b.id) - on.has(a.id)) || (b.mutual - a.mutual))){ const li = el('li'), sw = el('span', 'sw'); sw.style.background = on.has(f.id) ? '#3fbf9d' : '#c9d3da';
    const seenM = f.seen ? Math.round((Date.now() - Date.parse(f.seen)) / 60000) : null;
    li.append(sw, el('span', '', f.name || '釣客'), el('span', 'st', !f.mutual ? '等對方加你' : on.has(f.id) ? '在這個大廳' : seenM == null ? '' : seenM < 60 ? `${Math.max(1, seenM)} 分鐘前上線` : seenM < 1440 ? `${Math.round(seenM / 60)} 小時前上線` : `${Math.round(seenM / 1440)} 天前上線`));
    if (f.mutual){ const g = el('button', 'tbtn vbtn', '🎁 送禮'); g.addEventListener('click', () => { Fr.giftTo = f; renderTab(); }); li.appendChild(g); }
    const v = el('button', 'tbtn ghost vbtn', '水族館'); v.addEventListener('click', () => visitAquarium(f.id, f.name)); const vi = el('button', 'tbtn ghost vbtn', '小島'); vi.addEventListener('click', () => { closeSheet(); visitIsle(f.id, f.name); }); li.append(v, vi);
    const rm = el('button', 'tbtn ghost vbtn bk', '刪除'); rm.addEventListener('click', async () => { if (rm.dataset.sure !== '1'){ rm.dataset.sure = '1'; rm.textContent = '確定？'; return; } const d = await frRpc('remove_friend', { p_uid: f.id }); if (d) adoptFriends(d); }); li.appendChild(rm);
    ul.appendChild(li); }
  body.appendChild(ul);
}
/* ---- 組隊出海：跟大家一起搭阿海的船出去；附近有別人也在船上釣魚，大家都有「船隊加成」---- */
var Party = { team:false, inv:null, lead:null, leadName:'', joined:new Map() };
function crewNear(){ if (!myBoat) return 0; let n = 0; for (const p of peers.values()) if (p.pres && p.pres.bt && !p.isle && Math.hypot(p.target.x - me.pos.x, p.target.z - me.pos.z) < 16) n++; return Math.min(3, n); }
function sailInvite(x, z, label){ if (!room || !room.connected()) return; Party.lead = myIdOrMe(); Party.joined.clear(); room.emit('sail', { x:+x.toFixed(1), z:+z.toFixed(1), label: String(label).slice(0, 30), lid: myIdOrMe() }).catch(() => {}); ticker('🚤 你邀請大家一起出海了，有人加入會通知你'); }
function onSail(msg){
  if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const d = msg.data, p = peers.get(msg.peer); if (!p || !isFinite(+d.x) || !isFinite(+d.z) || !waterAt(+d.x, +d.z)) return;
  const name = peerName(p); Party.inv = { x:+d.x, z:+d.z, label: clean(String(d.label || '外海').slice(0, 30)), lid: String(d.lid || ''), peer: msg.peer, name, until: Date.now() + 45000 }; renderSailInv();
  ticker(`🚤 <b>${esc(name)}</b> 要出海去${esc(Party.inv.label)}，按上面的「一起去」加入船隊！`);
}
function onSailJoin(msg){ if (msg.sameTab || !msg.data || msg.data.lid !== myIdOrMe()) return; const p = peers.get(msg.peer); if (!p) return; Party.joined.set(msg.peer, peerName(p)); toast(`🚤 ${esc(peerName(p))} 加入你的船隊了！`); renderFerryBar(); }
function joinSail(){
  const v = Party.inv; Party.inv = null; renderSailInv(); if (!v || Date.now() > v.until) return; if (Dive.on) endDive('', true);
  // 停在隊長旁邊（不會疊在一起）
  const a = Math.random() * Math.PI * 2; let x = v.x + Math.cos(a) * 3.2, z = v.z + Math.sin(a) * 3.2; if (!waterAt(x, z)){ x = v.x; z = v.z; }
  Party.lead = v.lid; Party.leadName = v.name; ferryTo(x, z, `${v.label}（${v.name} 的船隊）`);
  if (room && room.connected()) room.emit('sailjoin', { lid: v.lid }).catch(() => {});
}
function renderSailInv(){
  let b = $('#sailInv'); const v = Party.inv;
  if (!v || Date.now() > v.until || (myBoat && Party.lead === v.lid)){ if (b) b.hidden = true; return; }
  if (!b){ b = document.createElement('div'); b.id = 'sailInv'; b.className = 'panel'; document.body.appendChild(b); }
  b.hidden = false; b.innerHTML = ''; b.appendChild(el('span', '', `🚤 ${v.name} 要出海去${v.label}`));
  const y = el('button', 'tbtn', '一起去'); y.addEventListener('click', joinSail); const n = el('button', 'tbtn ghost', '不用'); n.addEventListener('click', () => { Party.inv = null; renderSailInv(); }); b.append(y, n);
}
setInterval(() => { if (Party.inv && Date.now() > Party.inv.until){ Party.inv = null; renderSailInv(); } }, 2000);
/* ---- 等級、稱號、成就：經驗值全部從伺服器記的紀錄算出來（釣到的魚、放流、水下照片），升級獎金由伺服器 019_levels.sql 發 ---- */
const XP_RARITY = { '常見':10, '稀有':40, '傳說':250 };
function calcXP(r){ r = r || rec; let x = 0; for (const [id, n] of Object.entries(r.count || {})){ const f = FISH_BY_ID[id]; if (f) x += (Number(n) || 0) * XP_RARITY[f.rarity]; } return x + (r.released || 0) * 5 + (r.photos || []).length * 30; }
function lvNeed(L){ return 80 * (L - 1) + 20 * (L - 1) * (L - 2); }   // 到 Lv.L 需要的總經驗
function lvOf(xp){ let L = 1; while (L < 99 && xp >= lvNeed(L + 1)) L++; return L; }
const speciesN = () => Object.keys(rec.count || {}).filter(id => FISH_BY_ID[id]).length;
const spotDone = id => FISH.filter(f => f.spot === id).every(f => rec.count[f.id]);
const ACH = [
  { id:'c1',    icon:'🎣', name:'第一條魚',     desc:'釣到第一條魚',              cur:() => rec.total, goal:1 },
  { id:'c100',  icon:'🪣', name:'百條釣手',     desc:'總共釣到 100 條魚',         cur:() => rec.total, goal:100 },
  { id:'c500',  icon:'🧺', name:'五百條',       desc:'總共釣到 500 條魚',         cur:() => rec.total, goal:500, title:'勤勞釣客' },
  { id:'c2000', icon:'🏆', name:'兩千條',       desc:'總共釣到 2000 條魚',        cur:() => rec.total, goal:2000, title:'釣魚狂人' },
  { id:'s10',   icon:'📗', name:'小小圖鑑',     desc:'圖鑑收集 10 種魚',          cur:speciesN, goal:10 },
  { id:'s40',   icon:'📘', name:'圖鑑達人',     desc:'圖鑑收集 40 種魚',          cur:speciesN, goal:40 },
  { id:'sAll',  icon:'📚', name:'圖鑑全收集',   desc:'所有魚都釣過',              cur:() => FISH.filter(f => !f.of && rec.count[f.id]).length, goal:() => FISH.filter(f => !f.of).length, title:'圖鑑博士' },
  { id:'l1',    icon:'🐉', name:'傳說的開始',   desc:'釣到第一條傳說魚',          cur:() => rec.legend, goal:1 },
  { id:'l10',   icon:'👑', name:'傳說獵人',     desc:'釣到 10 條傳說魚',          cur:() => rec.legend, goal:10, title:'傳說獵人' },
  { id:'w100',  icon:'🐋', name:'巨物',         desc:'釣到 100 公斤以上的魚',     cur:() => rec.bestW, goal:100, kg:true, title:'巨物殺手' },
  { id:'e10k',  icon:'🪙', name:'小有積蓄',     desc:'總共賺到 10,000 金幣',      cur:() => rec.earned, goal:10000 },
  { id:'e100k', icon:'💰', name:'村裡的富翁',   desc:'總共賺到 100,000 金幣',     cur:() => rec.earned, goal:100000, title:'漁村富翁' },
  { id:'r10',   icon:'💙', name:'放流新手',     desc:'放流 10 條魚',              cur:() => rec.released || 0, goal:10 },
  { id:'r100',  icon:'🌊', name:'大海守護者',   desc:'放流 100 條魚',             cur:() => rec.released || 0, goal:100, title:'大海守護者' },
  { id:'dv',    icon:'🤿', name:'潛水員',       desc:'買潛水裝備組',              cur:() => hasDive('dive_suit') ? 1 : 0, goal:1 },
  { id:'p10',   icon:'📸', name:'水下攝影',     desc:'水下圖鑑拍到 10 種魚',      cur:() => (rec.photos || []).length, goal:10 },
  { id:'p25',   icon:'🎞️', name:'海洋攝影師',   desc:'水下圖鑑拍到 25 種魚',      cur:() => (rec.photos || []).length, goal:25, title:'海洋攝影師' },
  { id:'is10',  icon:'🏝️', name:'小島主人',     desc:'小島上放 10 件東西',        cur:() => (rec.island && rec.island.items || []).length, goal:10 },
  { id:'is40',  icon:'🏡', name:'夢想小島',     desc:'小島上放 40 件東西',        cur:() => (rec.island && rec.island.items || []).length, goal:40, title:'島主' },
  { id:'g15',   icon:'👗', name:'愛打扮',       desc:'擁有 15 件服飾',            cur:() => (rec.owned || []).filter(x => !x.startsWith('tool_')).length, goal:15, title:'時尚釣客' },
  { id:'f1',    icon:'🤝', name:'交到朋友',     desc:'互相加 1 位好友',           cur:() => Fr.list.filter(f => f.mutual).length, goal:1 },
  { id:'f10',   icon:'🎉', name:'朋友很多',     desc:'互相加 10 位好友',          cur:() => Fr.list.filter(f => f.mutual).length, goal:10, title:'社交達人' },
].concat(SPOTS.filter(sp => FISH.some(f => f.spot === sp.id)).map(sp => ({ id:'sp_' + sp.id, icon:'📍', name:`${sp.short}全收集`, desc:`${sp.label}的魚全部釣過`, cur:() => FISH.filter(f => f.spot === sp.id && rec.count[f.id]).length, goal:() => FISH.filter(f => f.spot === sp.id).length, title: sp.id === 'harbor' ? '外海霸主' : null })));
const goalOf = a => typeof a.goal === 'function' ? a.goal() : a.goal;
const achDone = a => a.cur() >= goalOf(a);
const LV_TITLES = [[1, '新手釣客'], [5, '見習釣客'], [10, '熟練釣客'], [20, '資深釣客'], [30, '釣魚達人'], [50, '海之傳說']];
function myTitles(){ const L = lvOf(calcXP()), out = LV_TITLES.filter(([l]) => L >= l).map(([l, n]) => ({ id:'lv' + l, name:n, how:`到 Lv.${l}` })); for (const a of ACH) if (a.title && achDone(a)) out.push({ id:'a_' + a.id, name:a.title, how:`成就「${a.name}」` }); return out; }
const ALL_TITLES = new Set(LV_TITLES.map(([, n]) => n).concat(ACH.filter(a => a.title).map(a => a.title)));
var Lv = { L:null, title: LS.get('tide.title', ''), seen: new Set(LS.get('tide.achSeen', [])), init: LS.get('tide.achInit', false) };
function curTitle(){ return myTitles().some(t => t.name === Lv.title) ? Lv.title : ''; }
function renderLvChip(){
  let c = $('#lvChip'); if (!c){ c = document.createElement('span'); c.id = 'lvChip'; c.title = '等級和成就'; c.addEventListener('click', () => openSheet('ach')); const h1 = $('#brand h1'); if (h1) h1.appendChild(c); else return; }
  const xp = calcXP(), L = lvOf(xp), k = L >= 99 ? 1 : (xp - lvNeed(L)) / (lvNeed(L + 1) - lvNeed(L)); let tt = ''; try { tt = curTitle(); } catch(e){} const t = `⭐ Lv.${L}${tt ? `・${tt}` : ''}`; if (c._t !== t){ c.textContent = t; c._t = t; } c.style.setProperty('--k', (k * 100).toFixed(0) + '%');
}
async function claimLevels(){ if (!Cloud.on) return; const before = rec.coins, row = await cloudCall('claim_levels'); if (!row) return; const got = (Number(row.coins) || 0) - before; if (got > 0){ SFX.catch(); flash(`⭐ 升級獎勵 🪙${got.toLocaleString()}！`, 2); } }
function lvTick(){
  if (!rec) return; const L = lvOf(calcXP()); renderLvChip(); { const t = curTitle(); if (t !== Lv.cur){ Lv.cur = t; refreshMyName(); pushPresence(true); } }
  if (Lv.L != null && L > Lv.L){ flash(`🎉 升級了！Lv.${L}`, 2); SFX.catch(); ticker(`🎉 <b>你</b>升到 Lv.${L} 了！${LV_TITLES.some(([l]) => l === L) ? `得到稱號「${LV_TITLES.find(([l]) => l === L)[1]}」` : ''}`); if (room && room.connected()) room.emit('lvup', { L }).catch(() => {}); setTimeout(claimLevels, 1500); }
  Lv.L = L;
  // 成就
  const done = ACH.filter(achDone).map(a => a.id);
  if (!Lv.init){ Lv.init = true; for (const id of done) Lv.seen.add(id); LS.set('tide.achInit', true); LS.set('tide.achSeen', [...Lv.seen]); return; }
  const fresh = done.filter(id => !Lv.seen.has(id));
  if (fresh.length){ for (const id of fresh) Lv.seen.add(id); LS.set('tide.achSeen', [...Lv.seen]); const a = ACH.find(x => x.id === fresh[0]);
    flash(`🏅 成就達成：${a.icon} ${a.name}`, 2); SFX.catch(); ticker(`🏅 成就達成：<b>${esc(a.name)}</b>${a.title ? `，得到稱號「${esc(a.title)}」` : ''}${fresh.length > 1 ? `（還有 ${fresh.length - 1} 個）` : ''}`); }
}
setInterval(lvTick, 2500);
function renderAch(body){
  const xp = calcXP(), L = lvOf(xp), nx = lvNeed(L + 1), k = L >= 99 ? 1 : (xp - lvNeed(L)) / (nx - lvNeed(L));
  const hd = el('div', 'lvhead'); hd.innerHTML = `<b>⭐ Lv.${L}</b><div class="lvbar"><i style="width:${(k * 100).toFixed(1)}%"></i></div><span>${L >= 99 ? '已經滿級了！' : `經驗 ${xp.toLocaleString()} / ${nx.toLocaleString()}`}</span>`; body.appendChild(hd);
  body.appendChild(el('p', 'sub', '經驗值：釣到常見魚 +10、稀有魚 +40、傳說魚 +250，放流 +5，水下照片每種 +30。每升一級都有金幣獎勵（Lv × 50），連上雲端時自動發。'));
  body.appendChild(el('div', 'dexhead', '🏷️ 稱號（顯示在名字上面，大家都看得到）'));
  const tl = el('div', 'titles'), cur = curTitle();
  const none = el('button', 'tbtn' + (cur ? ' ghost' : ''), '不顯示'); none.addEventListener('click', () => { Lv.title = ''; Lv.cur = ''; LS.set('tide.title', ''); refreshMyName(); renderLvChip(); pushPresence(true); renderTab(); }); tl.appendChild(none);
  for (const t of myTitles()){ const b = el('button', 'tbtn' + (cur === t.name ? '' : ' ghost'), t.name); b.title = t.how; b.addEventListener('click', () => { Lv.title = t.name; Lv.cur = t.name; LS.set('tide.title', t.name); refreshMyName(); renderLvChip(); pushPresence(true); renderTab(); toast(`🏷️ 稱號「${t.name}」顯示在你的名字上面了`); }); tl.appendChild(b); }
  body.appendChild(tl);
  const done = ACH.filter(achDone).length; body.appendChild(el('div', 'dexhead', `🏅 成就（${done} / ${ACH.length}）`));
  const ul = el('ul', 'shoplist cols ach');
  for (const a of ACH.slice().sort((x, y) => achDone(y) - achDone(x))){ const ok = achDone(a), g = goalOf(a), c = Math.min(a.cur(), g), li = el('li', ok ? 'on' : 'lock'); li.appendChild(el('span', 'dishic', ok ? a.icon : '🔒'));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', a.name)); d.appendChild(el('div', 'meta', a.desc + (a.title ? `・稱號「${a.title}」` : ''))); 
    if (!ok){ const pb = el('div', 'achbar'); pb.innerHTML = `<i style="width:${(c / g * 100).toFixed(1)}%"></i><span>${a.kg ? c.toFixed(1) : Math.floor(c).toLocaleString()} / ${a.kg ? g : g.toLocaleString()}</span>`; d.appendChild(pb); }
    li.appendChild(d); ul.appendChild(li); }
  body.appendChild(ul);
}
/* ---- 季節的畫面：飄落的花瓣、落葉、雪花，夏天晚上有螢火蟲；廣場旁邊有季節裝飾 ---- */
var SeasonFx = null;
function buildSeasonFx(){
  const S = { spring:{ c:'#ffc4d6', n:160, fall:0.55, size:0.22, sway:1.2 }, autumn:{ c:'#e8873a', n:140, fall:0.8, size:0.26, sway:1.4 }, winter:{ c:'#ffffff', n:260, fall:0.6, size:0.16, sway:0.5 }, summer:{ c:'#fff27a', n:70, fall:0, size:0.2, sway:0.6, glow:true } }[SEASON];
  const N = S.n, pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++){ pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; ph[i] = Math.random() * 6.28; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d');
  if (SEASON === 'spring'){ x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 13, 8, 0.6, 0, Math.PI * 2); x.fill(); }
  else if (SEASON === 'autumn'){ x.fillStyle = '#fff'; x.beginPath(); for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2, r = k % 2 ? 7 : 14; x.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } x.fill(); }
  else { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); }
  const m = new THREE.PointsMaterial({ color:S.c, size:S.size, map:new THREE.CanvasTexture(cv), transparent:true, depthWrite:false, opacity: S.glow ? 0.9 : 0.85, blending: S.glow ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.keep = true; scene.add(pts);
  SeasonFx = { pts, S, ph };
}
function updateSeasonFx(dt, t, raining){
  if (!SeasonFx) buildSeasonFx(); const F2 = SeasonFx, S = F2.S;
  const show = !House.on && !Dive.on && !raining && !(S.glow && DayNight.lamp < 0.5) && Quality.tier !== 'low';
  F2.pts.visible = show; if (!show) return;
  F2.pts.position.set(Math.round(camera.position.x / 4) * 4, 0, Math.round(camera.position.z / 4) * 4);
  if (frameNo % 2) return; const a = F2.pts.geometry.attributes.position.array, k = dt * 2;
  for (let i = 0; i < a.length / 3; i++){ const o = i * 3, p = F2.ph[i];
    if (S.glow){ a[o] += Math.sin(t * 0.7 + p) * k * 0.4; a[o + 1] = 0.6 + Math.abs(Math.sin(t * 0.5 + p)) * 2.2; a[o + 2] += Math.cos(t * 0.6 + p) * k * 0.4; continue; }
    a[o + 1] -= S.fall * k * (0.7 + (i % 5) * 0.12); a[o] += Math.sin(t * S.sway + p) * k * 0.35 + k * 0.15; a[o + 2] += Math.cos(t * S.sway * 0.8 + p) * k * 0.25;
    if (a[o + 1] < 0){ a[o + 1] = 12 + Math.random() * 2; a[o] = (Math.random() - 0.5) * 40; a[o + 2] = (Math.random() - 0.5) * 40; } }
  if (S.glow) F2.pts.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
  F2.pts.geometry.attributes.position.needsUpdate = true;
}
function addSeasonDeco(){
  try {
    const g = new THREE.Group(); scene.add(g); const at = (x, z) => { const [px, pz] = freeSpot(x, z); return [px, groundHeight(px, pz), pz]; };
    const M = (c, r, ex) => mat(c, r == null ? 0.8 : r, ex), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    if (SEASON === 'winter'){ const [x, y, z] = at(-1.8, 10.5), w = M('#ffffff', 0.9);
      add(new THREE.SphereGeometry(0.62, 16, 12), w, x, y + 0.55, z); add(new THREE.SphereGeometry(0.45, 16, 12), w, x, y + 1.38, z); add(new THREE.SphereGeometry(0.32, 14, 10), w, x, y + 1.98, z);
      for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.045, 6, 4), M('#222', 0.4), x + sx * 0.11, y + 2.05, z + 0.28);
      const n = add(new THREE.ConeGeometry(0.06, 0.3, 8), M('#ff8a2a', 0.6), x, y + 1.97, z + 0.42); n.rotation.x = Math.PI / 2;
      const sc = add(new THREE.TorusGeometry(0.33, 0.07, 6, 16), M('#e8473a', 0.7), x, y + 1.7, z); sc.rotation.x = Math.PI / 2;
      for (const sx of [-1, 1]){ const a = add(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 5), M('#6b4a35'), x + sx * 0.62, y + 1.5, z); a.rotation.z = sx * 1.0; }
      const hat = add(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 12), M('#222', 0.5), x, y + 2.35, z); add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 14), M('#222', 0.5), x, y + 2.22, z);
      addCircleCol(x, z, 0.7);
      const [tx, ty, tz] = at(10.5, 9.5); add(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8), M('#6b4a35'), tx, ty + 0.3, tz);
      [[1.1, 0.9], [0.85, 1.6], [0.6, 2.2], [0.35, 2.7]].forEach(([r, h]) => add(new THREE.ConeGeometry(r, 0.9, 10), M('#3f7f52', 0.8), tx, ty + h, tz));
      add(new THREE.OctahedronGeometry(0.18), M('#ffd36a', 0.3, { emissive:'#ffb020', emissiveIntensity:0.8 }), tx, ty + 3.25, tz);
      ['#e8473a', '#2f89c7', '#ffd36a', '#f5a5d8'].forEach((c, i) => { for (let k = 0; k < 4; k++){ const a = k * 1.57 + i * 0.4, h = 0.9 + i * 0.5, r = 1.05 - i * 0.22; add(new THREE.SphereGeometry(0.08, 8, 6), M(c, 0.3, { emissive:c, emissiveIntensity:0.4 }), tx + Math.cos(a) * r, ty + h, tz + Math.sin(a) * r); } });
      addCircleCol(tx, tz, 1.1); }
    else if (SEASON === 'autumn'){ for (const [px, pz, s] of [[-1.8, 10.5, 1], [-0.9, 11.2, 0.7], [15.6, 9.4, 1.2], [16.4, 10.2, 0.8]]){ const [x, y, z] = at(px, pz);
        const pk = add(new THREE.SphereGeometry(0.38 * s, 14, 10), M('#ff8a2a', 0.6), x, y + 0.3 * s, z); pk.scale.y = 0.72; add(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.16 * s, 6), M('#5d7a3a'), x, y + 0.6 * s, z); }   /* 南瓜不擋人，走得過去 */
      for (let i = 0; i < 26; i++){ const [x, y, z] = at(-1.4 + (i % 2 ? 17.4 : 0), 10.8 - (i % 2 ? 1 : 0)); const l = add(new THREE.IcosahedronGeometry(0.16, 0), M(['#e0a14a', '#d9783c', '#c9573a', '#e8c15a'][i % 4], 0.9), x + (Math.random() - 0.5) * 1.6, y + 0.05, z + (Math.random() - 0.5) * 1.6); l.scale.y = 0.25; } }
    else if (SEASON === 'spring'){ for (const [px, pz] of [[-1.8, 10.5], [10.5, 9.5]]){ const [x, y, z] = at(px, pz); add(new THREE.BoxGeometry(1.4, 0.4, 0.6), M('#a8713f'), x, y + 0.2, z);
        for (let i = 0; i < 9; i++){ const c = ['#f7b6c8', '#ffd36a', '#ffffff', '#b48cff', '#ff7fa8'][i % 5]; add(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), M('#5d9c55'), x - 0.55 + i * 0.14, y + 0.55, z); add(new THREE.IcosahedronGeometry(0.08, 0), M(c, 0.6), x - 0.55 + i * 0.14, y + 0.72, z); }
        addBoxCol(x, z, 1.5, 0.7); } }
    else { const [x, y, z] = at(10.5, 9.5); add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), M('#ffffff'), x, y + 1.1, z); const pr = add(new THREE.ConeGeometry(1.3, 0.5, 12), M('#f05a4a', 0.7), x, y + 2.25, z);
      for (let i = 0; i < 6; i++){ const st = add(new THREE.ConeGeometry(1.31, 0.5, 12, 1, true, i * Math.PI / 3, Math.PI / 6), M('#ffffff', 0.7), x, y + 2.251, z); st.material.side = THREE.DoubleSide; }
      const [bx, by, bz] = at(-1.8, 10.5); const ball = add(new THREE.SphereGeometry(0.3, 16, 12), M('#ffd36a', 0.5), bx, by + 0.3, bz); for (let i = 0; i < 3; i++){ const b = add(new THREE.SphereGeometry(0.302, 16, 12, i * 2.09, 0.7), M(['#e8473a', '#2f89c7', '#3fbf9d'][i], 0.5), bx, by + 0.3, bz); b.material.side = THREE.DoubleSide; }
      addCircleCol(x, z, 0.3); }
  } catch(e){ console.warn('season deco', e); }
}

/* ================= 海上釣蝦場、企鵝冰原 ================= */
const Venue = { penguins: [], snow: null, signs: [] };
function signTex(text, bg, fg, w, h){ const cv = document.createElement('canvas'); cv.width = w || 512; cv.height = h || 128; const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = fg; c.font = `bold ${Math.round(cv.height * 0.55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height / 2 + 4); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
// 釣蝦場：室內的蝦池（實際位置在地圖外，從村子裡的釣蝦場門口走進去，跟房子一樣）
const SHRIMP_DOOR = { x:-1, z:-9 };   // 村子裡的門口
const SHRIMP_PRICE = [[30, 200], [60, 350]];
// 蝦竿（只在釣蝦場用）：好的蝦竿浮標比較敏感 → 吃餌時可以反應的時間比較長、拉的時候比較不會鬆鉗。不會改變釣到哪一種蝦的機率。
// 價格要跟 supabase/026_shrimp_rods.sql 一樣
const SHRIMP_RODS = [
  { id:'srod_basic',  name:'基本蝦竿',     price:0,    win:0,   ten:1.35, color:'#d8c07a', desc:'買時段就附的玻璃纖維蝦竿，老闆說「堪用啦」。' },
  { id:'srod_carbon', name:'碳纖維蝦竿',   price:1200, win:0.4, ten:1.15, color:'#2b2f36', desc:'又輕又硬，浮標動一下手上就有感覺。吃餌的反應時間 +0.4 秒，比較不會鬆鉗。' },
  { id:'srod_master', name:'職人手工蝦竿', price:4000, win:0.8, ten:0.95, color:'#a2362a', desc:'老師傅一支一支手工做的竹節蝦竿。反應時間 +0.8 秒，拉蝦最穩。' },
];
/* ---- 老闆的放生活動：每天台灣時間 12～21 點之間的某個整點開始，2 小時，放一隻特別的蝦，全伺服器只有一隻 ----
   伺服器（supabase/027_shrimp_event.sql）決定誰釣到；沒連線的時候用一樣的時間表在自己的遊戲裡玩 */
const SEV_FISH = ['bluelobster'], SEV_P = 0.0015, SEV_HOURS = 2;
const Sev = { ev:null, at:0, told:{}, busy:false };
function twDay(ms){ const d = new Date(ms + 8 * 3600e3); return d.toISOString().slice(0, 10); }
function sevPlan(day){ const h = hash32('sev' + day), hr = 12 + h % 10, [y, m, d] = day.split('-').map(Number), start = Date.UTC(y, m - 1, d, hr - 8); return { id: +day.replace(/-/g, ''), fish: SEV_FISH[Math.floor(h / 16) % SEV_FISH.length], start, end: start + SEV_HOURS * 3600e3, caught: null }; }
function sevNext(){ const t = Date.now(), a = sevPlan(twDay(t)); return t < a.end ? a : sevPlan(twDay(t + 86400e3)); }
function sevActive(){ const e = Sev.ev, t = Date.now(); return !!(e && !e.caught && t >= e.start && t < e.end); }
async function sevRefresh(){
  if (Sev.busy) return; Sev.busy = true;
  try {
    let e = sevNext();
    if (Cloud.on && Cloud.sb){ const { data, error } = await Cloud.sb.rpc('get_shrimp_event'); if (!error && data && data.fish) e = { id: +data.id, fish: data.fish, start: Date.parse(data.start_at), end: Date.parse(data.end_at), caught: data.caught_name || null }; }
    else if (rec.sevGot && rec.sevGot[e.id]) e.caught = '你';
    const was = Sev.ev; Sev.ev = e; Sev.at = Date.now(); const f = FISH_BY_ID[e.fish];
    if (sevActive() && !Sev.told['on' + e.id]){ Sev.told['on' + e.id] = 1; ticker(`🎉 釣蝦場老闆阿忠剛剛放了一隻 <span class="chip r-傳說">活動</span> <b>${esc(f.name)}</b> 進池子！全伺服器只有一隻，快去釣！`); }
    if (!e.caught && was && was.id === e.id && was.caught && was.caught !== '你' && sevActive()) ticker(`💙 <b>${esc(FISH_BY_ID[e.fish].name)}</b> 被放回釣蝦場的池子了！還有機會釣到牠`);
    if (e.caught && was && was.id === e.id && !was.caught && !Sev.told['got' + e.id]){ Sev.told['got' + e.id] = 1; if (e.caught !== '你') ticker(`🦐 今天的 <b>${esc(f.name)}</b> 已經被 <b>${esc(e.caught)}</b> 釣走了！明天再來碰碰運氣`); }
  } finally { Sev.busy = false; }
}
setInterval(() => { if (rec) sevRefresh(); }, 60000); setTimeout(() => sevRefresh(), 5000);
// 放生藍色龍蝦：活動還沒結束的話，牠會回到池子裡，大家又有機會釣到
function sevReleased(f){
  const e = Sev.ev; if (!e || e.fish !== f.id) return;
  if (Date.now() < e.end){ e.caught = null; Sev.told['got' + e.id] = 0; if (rec.sevGot) delete rec.sevGot[e.id]; saveRecLocal(); ticker(`💙 <b>你</b>把 <b>${esc(f.name)}</b> 放回釣蝦場的池子了！大家又有機會釣到牠`); if (room && room.connected() && chatAllowed) room.emit('sevrel', { f: f.id }).catch(() => {}); }
  else ticker(`💙 你把 <b>${esc(f.name)}</b> 交給阿忠，他會送去水族館給大家看`);
}
function sevCaughtByMe(f, w){
  if (!f.sev || !Sev.ev) return; Sev.ev.caught = '你'; Sev.told['got' + Sev.ev.id] = 1; rec.sevGot = Object.assign({}, rec.sevGot, { [Sev.ev.id]: 1 }); saveRecLocal();
  flash(`🎉 你釣到了今天唯一的${f.name}！`, 3); ticker(`🎉 <b>你</b> 釣到了阿忠今天放的 <b>${esc(f.name)}</b> ${fmtKg(w)}！全伺服器只有這一隻`);
}
function curSrod(){ return SHRIMP_RODS.find(r => r.id === rec.srod && (r.price === 0 || (rec.srods || []).includes(r.id))) || SHRIMP_RODS[0]; }
async function buyShrimpRod(id){
  const r = SHRIMP_RODS.find(x => x.id === id); if (!r) return;
  if ((rec.srods || []).includes(id) || r.price === 0){ rec.srod = id; saveRecLocal(); if (Cloud.on) cloudCall('set_shrimp_rod', { p_id: id }); SFX.click(); updateBobberLook(); renderTab(); return; }
  if (rec.coins < r.price){ toast(`金幣不夠，還差 🪙${r.price - rec.coins}`); return; }
  rec.srods = (rec.srods || []).concat(id); rec.srod = id; addCoins(-r.price); saveRecLocal(); if (Cloud.on) cloudCall('buy_shrimp_rod', { p_id: id });
  SFX.coin(); flash(`🎣 買了${r.name}！`, 1.5); updateBobberLook(); renderTab();
}   // [分鐘, 金幣]，跟伺服器 025_shrimp.sql 一樣
function buildShrimpFront(){
  const g = new THREE.Group(), X = SHRIMP_DOOR.x, Z = SHRIMP_DOOR.z, y0 = groundHeight(X, Z); g.position.set(X, y0, Z); scene.add(g);
  const B = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  B(6.4, 3.2, 4.2, mat('#e8e2d2', 0.8), 0, 1.6, -0.6); B(6.8, 0.25, 4.6, mat('#5a6a78', 0.6), 0, 3.3, -0.6);
  for (let i = 0; i < 6; i++) B(6.9, 0.06, 0.4, i % 2 ? mat('#e8473a', 0.6) : mat('#f4f4f0', 0.6), 0, 3.0 - i * 0.02, 1.6 + i * 0.15).rotation.x = 0.35;   // 紅白條紋遮雨棚
  B(1.4, 2.2, 0.08, mat('#3a4a58', 0.5), 0, 1.1, 1.52); B(1.2, 0.9, 0.06, mat('#9fd8f0', 0.2, { emissive:'#5fb6e3', emissiveIntensity:0.3 }), 0, 1.5, 1.57);
  for (const x of [-2.2, 2.2]) B(1.4, 1.0, 0.06, mat('#9fd8f0', 0.2, { emissive:'#5fb6e3', emissiveIntensity:0.3 }), x, 1.7, 1.52);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.0), new THREE.MeshBasicMaterial({ map: signTex('🦐 釣蝦場', '#e8473a', '#fff7e0') })); sg.position.set(0, 4.05, 1.18); g.add(sg); B(4.4, 1.15, 0.12, mat('#3a3a3a', 0.6), 0, 4.05, 1.1);   /* 招牌立在屋頂上，不會被遮雨棚擋住 */
  { const cv = document.createElement('canvas'); cv.width = 384; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#2f3b36'; c.fillRect(0, 0, 384, 256); c.strokeStyle = '#ffd36a'; c.lineWidth = 8; c.strokeRect(8, 8, 368, 240);
    c.fillStyle = '#ffd36a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 64px sans-serif'; c.fillText('時段計費', 192, 82); c.fillStyle = '#ffffff'; c.font = 'bold 38px sans-serif'; c.fillText('30分 🪙200', 192, 160); c.fillText('60分 🪙350', 192, 208);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;   /* 價目板：兩行字，不會被切掉 */
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ map: tx })); pr.position.set(2.25, 1.55, 1.58); g.add(pr); }
  addBoxCol(X, Z - 0.6, 6.4, 4.2);
}
function buildShrimpHall(){
  const S = SHRIMP, g = new THREE.Group(); scene.add(g); Venue.hall = g; g.visible = false; const Y = S.y;
  const floorM = mat('#c9c4b8', 0.9), tile = mat('#7fc8e8', 0.4), tile2 = mat('#5fb0d8', 0.4), white = mat('#f4f4f0', 0.7);
  const B = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(S.x + x, y, S.z + z); o.receiveShadow = true; g.add(o); return o; };
  // 房間（牆壁和天花板從裡面看）
  const H = 4.4, wallM = mat('#eae6dc', 0.9, { emissive:'#eae6dc', emissiveIntensity:0.1 });   /* 四面牆加天花板（不要底面，不然會蓋住蝦池） */
  for (const [w, x, z, ry] of [[S.w, 0, -S.d / 2, 0], [S.w, 0, S.d / 2, Math.PI], [S.d, -S.w / 2, 0, Math.PI / 2], [S.d, S.w / 2, 0, -Math.PI / 2]]){ const o = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallM); o.position.set(S.x + x, Y + H / 2, S.z + z); o.rotation.y = ry; g.add(o); }
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.d), mat('#f2efe8', 0.9, { emissive:'#f2efe8', emissiveIntensity:0.15 })); o.rotation.x = Math.PI / 2; o.position.set(S.x, Y + H, S.z); g.add(o); }
  B(S.w, 0.8, 0.02, mat('#7fb0c8', 0.8), 0, Y + 0.4, -S.d / 2 + 0.02); B(S.w, 0.8, 0.02, mat('#7fb0c8', 0.8), 0, Y + 0.4, S.d / 2 - 0.02);   // 牆腳的藍色磁磚
  // 地板（四條，中間是蝦池）
  const bw = (S.w - S.pw) / 2, bd = (S.d - S.pd) / 2;
  B(S.w, 0.2, bd, floorM, 0, Y - 0.1, -S.pd / 2 - bd / 2); B(S.w, 0.2, bd, floorM, 0, Y - 0.1, S.pd / 2 + bd / 2); B(bw, 0.2, S.pd, floorM, -S.pw / 2 - bw / 2, Y - 0.1, 0); B(bw, 0.2, S.pd, floorM, S.pw / 2 + bw / 2, Y - 0.1, 0);
  // 蝦池：藍色磁磚的池壁和池底，池邊一圈白色；水是淡綠色的池水
  B(S.pw, 0.05, S.pd, tile2, 0, -0.75, 0);
  B(S.pw, 1.7, 0.12, tile, 0, Y - 0.85, -S.pd / 2); B(S.pw, 1.7, 0.12, tile, 0, Y - 0.85, S.pd / 2); B(0.12, 1.7, S.pd, tile, -S.pw / 2, Y - 0.85, 0); B(0.12, 1.7, S.pd, tile, S.pw / 2, Y - 0.85, 0);
  B(S.pw + 0.5, 0.08, 0.3, white, 0, Y + 0.02, -S.pd / 2 - 0.1); B(S.pw + 0.5, 0.08, 0.3, white, 0, Y + 0.02, S.pd / 2 + 0.1); B(0.3, 0.08, S.pd, white, -S.pw / 2 - 0.1, Y + 0.02, 0); B(0.3, 0.08, S.pd, white, S.pw / 2 + 0.1, Y + 0.02, 0);
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(S.pw - 0.1, S.pd - 0.1), new THREE.MeshStandardMaterial({ color:'#5fa8a0', roughness:0.15, metalness:0.1, transparent:true, opacity:0.55 })); w.rotation.x = -Math.PI / 2; w.position.set(S.x, WATER_LEVEL + 0.02, S.z); g.add(w); }
  Venue.pump = [];
  for (const x of [-4, 0, 4]){ B(0.06, 0.06, S.pd - 0.4, mat('#3a3a3a', 0.5), x, -0.6, 0); Venue.pump.push(S.x + x); }
  // 日光燈
  for (const x of [-7, 0, 7]) for (const z of [-3, 3]) B(2.2, 0.06, 0.2, mat('#ffffff', 0.3, { emissive:'#ffffff', emissiveIntensity:1.4 }), x, Y + H - 0.1, z);
  // 塑膠椅（可以坐著釣）：池子四周，面向池子，椅背有號碼
  const chairM = [mat('#3f8fd8', 0.5), mat('#f17b6d', 0.5), mat('#3fbf9d', 0.5)];
  let num = 1;
  const stool = (x, z, face, i) => { const cg = new THREE.Group(); cg.position.set(S.x + x, Y, S.z + z); cg.rotation.y = face; g.add(cg); const m = chairM[i % 3];
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.06, 14), m); st.position.y = 0.42; cg.add(st);
    for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]){ const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), m); l.position.set(lx, 0.21, lz); cg.add(l); }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ map: signTex(String(num), '#ffffff', '#18334a', 128, 96) })); tag.position.set(0, 0.2, -0.22); tag.rotation.y = Math.PI; cg.add(tag);
    CHAIRS.push({ x: S.x + x, z: S.z + z, face, y: Y + 0.02, shrimp: true, no: num++ }); };
  let k = 0; for (let x = -5.5; x <= 5.5; x += 2.2){ stool(x, -S.pd / 2 - 0.75, 0, k++); stool(x, S.pd / 2 + 0.75, Math.PI, k++); }
  for (const z of [-2, 2]){ stool(-S.pw / 2 - 0.75, z, Math.PI / 2, k++); stool(S.pw / 2 + 0.75, z, -Math.PI / 2, k++); }
  // 櫃台（跟老闆買時段）
  B(3.2, 1.0, 0.8, mat('#8c5d3b', 0.8), -S.w / 2 + 2.4, Y + 0.5, -S.d / 2 + 1.2); B(3.3, 0.06, 0.9, mat('#c98a5a', 0.6), -S.w / 2 + 2.4, Y + 1.03, -S.d / 2 + 1.2);
  addBoxCol(S.x - S.w / 2 + 2.4, S.z - S.d / 2 + 1.2, 3.3, 0.9);
  { const pb = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 272; const c = cv.getContext('2d'); c.fillStyle = '#2f3b36'; c.fillRect(0, 0, 512, 272); c.fillStyle = '#ffd36a'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('釣蝦 時段計費', 256, 58); c.fillStyle = '#fff4d6'; c.font = '36px sans-serif'; SHRIMP_PRICE.forEach(([m, p], i) => c.fillText(`${m} 分鐘　🪙 ${p}`, 256, 125 + i * 52)); c.font = '26px sans-serif'; c.fillText('附蝦竿・雞肝餌・免費烤蝦', 256, 245); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
    pb.position.set(S.x - S.w / 2 + 2.4, Y + 2.6, S.z - S.d / 2 + 0.03); g.add(pb); }
  Venue.desk = { x: S.x - S.w / 2 + 2.4, z: S.z - S.d / 2 + 2.0 };
  // 烤蝦區：烤爐、鹽罐、檸檬
  B(1.6, 0.9, 0.7, mat('#5a5a5a', 0.4, { metalness:0.4 }), S.w / 2 - 2.0, Y + 0.45, -S.d / 2 + 1.0); B(1.5, 0.05, 0.6, mat('#2a2a2a', 0.3), S.w / 2 - 2.0, Y + 0.93, -S.d / 2 + 1.0);
  const coal = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.5), mat('#ff7a2a', 0.6, { emissive:'#ff5a1a', emissiveIntensity:1.2 })); coal.position.set(S.x + S.w / 2 - 2.0, Y + 0.91, S.z - S.d / 2 + 1.0); g.add(coal); Venue.coal = coal;
  for (let i = 0; i < 5; i++){ const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 3, 6), mat('#ff7a50', 0.5)); sh.rotation.z = Math.PI / 2; sh.position.set(S.x + S.w / 2 - 2.5 + i * 0.25, Y + 0.98, S.z - S.d / 2 + 1.0); g.add(sh); }
  addBoxCol(S.x + S.w / 2 - 2.0, S.z - S.d / 2 + 1.0, 1.7, 0.8);
  { const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ map: signTex('免費烤蝦', '#e8473a', '#fff7e0', 384, 128) })); sg.position.set(S.x + S.w / 2 - 2.0, Y + 2.2, S.z - S.d / 2 + 0.03); g.add(sg); }
  Venue.grill = { x: S.x + S.w / 2 - 2.0, z: S.z - S.d / 2 + 1.8 };
  B(0.9, 1.6, 0.7, white, S.w / 2 - 4.0, Y + 0.8, -S.d / 2 + 0.6); addBoxCol(S.x + S.w / 2 - 4.0, S.z - S.d / 2 + 0.6, 1.0, 0.8);   // 冰箱
  // 牆上的標語
  for (const [txt, x] of [['浮標沉下去才拉！', -6], ['慢慢拉 蝦子才不會鬆鉗', 6]]){ const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshBasicMaterial({ map: signTex(txt, '#fff7e0', '#e8473a', 640, 140) })); sg.position.set(S.x + x, Y + 2.8, S.z + S.d / 2 - 0.03); sg.rotation.y = Math.PI; g.add(sg); }
  // 出口
  B(1.4, 2.2, 0.06, mat('#3a4a58', 0.5), 0, Y + 1.1, S.d / 2 - 0.04); { const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ map: signTex('出口', '#3fbf9d', '#ffffff', 256, 96) })); sg.position.set(S.x, Y + 2.5, S.z + S.d / 2 - 0.06); sg.rotation.y = Math.PI; g.add(sg); }
  Venue.exit = { x: S.x, z: S.z + S.d / 2 - 0.9 };
  for (const [x, z, w, d] of [[0, -S.d / 2, S.w, 0.3], [0, S.d / 2, S.w, 0.3], [-S.w / 2, 0, 0.3, S.d], [S.w / 2, 0, 0.3, S.d]]) addBoxCol(S.x + x, S.z + z, w, d);
  g.traverse(o => { if (o.isMesh){ o.castShadow = false; o.userData.keep = true; } });
  // 老闆
  const boss = new Fisher({ shirt:'#3f8fd8', hat:'#18334a', name:'釣蝦場老闆 阿忠', kind:'npc' }); boss.pos.set(Venue.desk.x, Y, Venue.desk.z - 1.3); boss.baseY = Y; boss.rot = 0; boss.setGear({ hat:'hat_cap', top:'top_apron' }); boss.nm.classList.add('quest'); Venue.boss = boss;
}
function inHall(){ return inShrimpHall(me.pos.x, me.pos.z, 0); }
function shrimpLeft(){ return Math.max(0, (rec.shrimpUntil || 0) - Date.now()); }
function enterShrimp(){
  const fx = $('#fadeFx'); fx.classList.add('on'); SFX.door(); if (myBoat) leaveFerry(true);
  setTimeout(() => { me.pos.x = Venue.exit.x; me.pos.z = Venue.exit.z - 2.4; me.baseY = SHRIMP.y; Jump.gy = SHRIMP.y; me.rot = Math.PI; cam.yaw = 0; cam.pitch = 0.6; Venue.savedDist = cam.dist; cam.dist = Math.min(cam.dist, 6); pushPresence(true); setTimeout(() => fx.classList.remove('on'), 80);
    flash('🦐 歡迎光臨釣蝦場！', 1.4); sevRefresh(); if (!shrimpLeft()) setTimeout(() => toast('先到左邊的櫃台跟老闆阿忠買時段，才可以釣蝦喔'), 1500); }, 260);
}
function exitShrimp(){
  const fx = $('#fadeFx'); fx.classList.add('on'); SFX.door(); if (mySeat) standUp(); if (F.phase !== 'idle') cancelFishing();
  setTimeout(() => { me.pos.x = SHRIMP_DOOR.x; me.pos.z = SHRIMP_DOOR.z + 2.6; me.baseY = groundHeight(me.pos.x, me.pos.z); Jump.gy = me.baseY; me.rot = 0; cam.yaw = Math.PI; if (Venue.savedDist) cam.dist = Venue.savedDist; pushPresence(true); setTimeout(() => fx.classList.remove('on'), 80); }, 260);
}
async function buyShrimpTime(min){
  const it = SHRIMP_PRICE.find(([m]) => m === min); if (!it) return;
  if (rec.coins < it[1]){ toast(`金幣不夠，還差 🪙${it[1] - rec.coins}`); return; }
  if (Cloud.on){ const row = await cloudCall('buy_shrimp_time', { p_min: min }); if (!row) return; }
  else { addCoins(-it[1]); rec.shrimpUntil = Math.max(Date.now(), rec.shrimpUntil || 0) + min * 60000; saveRecLocal(); }
  SFX.coin(); flash(`🎫 買了 ${min} 分鐘，祝你大豐收！`, 1.6); renderTab();
}
function renderShrimpDesk(body){
  body.appendChild(el('div', 'shophead')).innerHTML = `<b>🦐 釣蝦場櫃台・老闆 阿忠</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`;
  const left = shrimpLeft(); body.appendChild(el('p', 'sub', left ? `你還剩 ${mmss(left)} 可以釣。時間會累加，可以先多買一點。` : '「釣蝦是算時間的喔！買了時段，蝦竿和雞肝餌都附給你，池邊的椅子隨便坐。」'));
  const ul = el('ul', 'shoplist');
  for (const [m, pz] of SHRIMP_PRICE){ const li = el('li'); li.appendChild(el('span', 'dishic', '🎫')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${m} 分鐘`)); d.appendChild(el('div', 'meta', `🪙 ${pz}・附蝦竿和雞肝餌・可以免費烤蝦`)); li.appendChild(d);
    const b = el('button', 'tbtn' + (rec.coins < pz ? ' ghost' : ''), '買'); b.addEventListener('click', () => { b.disabled = true; buyShrimpTime(m); }); li.appendChild(b); ul.appendChild(li); }
  body.appendChild(ul);
  { body.appendChild(el('div', 'dexhead', '🎉 老闆的放生活動')); const e = Sev.ev || sevNext(), f = FISH_BY_ID[e.fish], t = Date.now();
    const hhmm = ms => new Date(ms + 8 * 3600e3).toISOString().slice(11, 16);
    body.appendChild(el('p', 'sub', sevActive() ? `「嘿嘿，我剛剛偷偷放了一隻${f.name}進池子，全伺服器只有這一隻喔！」活動到 ${hhmm(e.end)}，每拋一次竿都有很小的機會碰到牠。`
      : e.caught && t < e.end ? `今天的${f.name}已經被 ${e.caught} 釣走了。「明天我會再放別的，記得來！」`
      : t < e.start ? `「${twDay(e.start) === twDay(t) ? '今天' : '明天'} ${hhmm(e.start)} 左右我會放一隻特別的蝦進池子，全伺服器只有一隻。」`
      : `今天的活動結束了，${f.name}沒有人釣到，被阿忠撈回去了。明天再來！`)); }
  body.appendChild(el('div', 'dexhead', '🎣 蝦竿（只在釣蝦場用）'));
  { const ul2 = el('ul', 'shoplist'), cur = curSrod();
    for (const r of SHRIMP_RODS){ const own = r.price === 0 || (rec.srods || []).includes(r.id), li = el('li', cur.id === r.id ? 'on' : ''); const ic = el('span', 'dishic', '🎣'); ic.style.color = r.color; li.appendChild(ic);
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', r.name + (cur.id === r.id ? '（使用中）' : ''))); d.appendChild(el('div', 'meta', (own ? '' : `🪙 ${r.price.toLocaleString()}・`) + r.desc)); li.appendChild(d);
      if (cur.id !== r.id){ const b = el('button', 'tbtn' + (!own && rec.coins < r.price ? ' ghost' : ''), own ? '換上' : '買'); b.addEventListener('click', () => { b.disabled = true; buyShrimpRod(r.id); }); li.appendChild(b); }
      ul2.appendChild(li); }
    body.appendChild(ul2); }
  body.appendChild(el('div', 'dexhead', '🎣 阿忠教你釣蝦'));
  const tips = el('ul', 'helpul'); for (const t of ['坐在池邊的椅子上按「拋竿」，或站在池邊也可以。', '蝦子會先來試探：浮標輕輕點一下、抖一下，這時候不要拉！', '浮標「整個沉下去、往旁邊跑」才是真的吃餌，馬上提竿。', '拉的時候要慢慢拉，一直按住太用力，蝦子會鬆鉗掉回池子裡。', '三隻泰國蝦可以拿到右邊的烤爐，免費烤成鹽烤泰國蝦。']) tips.appendChild(el('li', '', t)); body.appendChild(tips);
}
// 坐在釣蝦場椅子上：從椅子往池子的方向拋竿
function seatSpot(c){ return Object.assign({}, SPOT_BY_ID.shrimp, { pos: new THREE.Vector3(c.x, 0, c.z), dir: new THREE.Vector2(Math.sin(c.face), Math.cos(c.face)), shore: true, legendBoost: 1 }); }
function makePenguin(big){
  const g = new THREE.Group(), blk = mat('#22262e', 0.5), wht = mat('#f7f7f4', 0.6), org = mat('#ff9f2a', 0.5), s = big ? 1.25 : 0.8 + Math.random() * 0.25;
  const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (sx) o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(0.28, 18, 14), blk, 0, 0.42, 0, 1, 1.35, 0.9);
  add(new THREE.SphereGeometry(0.24, 18, 14), wht, 0, 0.4, 0.07, 0.95, 1.3, 0.8);
  const head = new THREE.Group(); head.position.y = 0.86; g.add(head);
  const hh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), blk); hh.castShadow = true; head.add(hh);
  for (const sx of [-1, 1]){ const pt = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), wht); pt.position.set(sx * 0.08, 0.02, 0.15); pt.scale.set(1, 1.2, 0.5); head.add(pt); const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#111', 0.3)); e.position.set(sx * 0.08, 0.03, 0.19); head.add(e); }
  if (big){ for (const sx of [-1, 1]){ const y = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#ffc83a', 0.5)); y.position.set(sx * 0.15, -0.08, 0.05); y.scale.set(0.6, 1.3, 0.8); head.add(y); } }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), org); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.24); head.add(beak);
  const fl = []; for (const sx of [-1, 1]){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), blk); f.scale.set(0.3, 1.4, 0.7); f.position.set(sx * 0.27, 0.48, 0); f.castShadow = true; g.add(f); fl.push(f); }
  const ft = []; for (const sx of [-1, 1]){ const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), org); f.scale.set(1, 0.35, 1.5); f.position.set(sx * 0.1, 0.03, 0.06); g.add(f); ft.push(f); }
  g.scale.setScalar(s); g.userData = { head, fl, ft }; return g;
}
function buildIceField(){
  const I = ICE, g = new THREE.Group(); scene.add(g);
  const ice = mat('#f4fbff', 0.5, { emissive:'#cfe8ff', emissiveIntensity:0.15 }), ice2 = mat('#d6eefc', 0.4), snow = mat('#ffffff', 0.9);
  // 浮冰：照著地板格子做（一格一塊），冰洞的地方留空
  const geo = new THREE.BoxGeometry(1, 1, 1), list = decks.filter(d => nearIce((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, 0.1) && d.y === I.y);
  const im = new THREE.InstancedMesh(geo, ice, list.length), dm = new THREE.Object3D();
  list.forEach((d, i) => { dm.position.set((d.x0 + d.x1) / 2, I.y - 0.35, (d.z0 + d.z1) / 2); dm.scale.set(d.x1 - d.x0, 0.7 + ((i * 7) % 5) * 0.03, d.z1 - d.z0); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
  im.receiveShadow = true; g.add(im);
  // 冰洞的邊（藍色的一圈）、旁邊的小板凳、魚桶
  for (const [hx, hz] of ICE_HOLES){ const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 6, 20), ice2); r.rotation.x = -Math.PI / 2; r.position.set(I.x + hx + 0.4, I.y + 0.02, I.z + hz - 0.2); r.scale.set(1.1, 1.05, 1); g.add(r);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12), mat('#c98a5a', 0.8)); st.position.set(I.x + hx + 2.0, I.y + 0.18, I.z + hz + 1.6); st.castShadow = true; g.add(st); CHAIRS.push({ x: I.x + hx + 2.0, z: I.z + hz + 1.6, face: Math.PI + 0.6, y: I.y + 0.02 }); }
  // 雪堆、冰塊、雪屋、旗子
  for (let i = 0; i < 26; i++){ const a = i * 2.39, r = 0.55 + (i % 5) * 0.09, x = I.x + Math.cos(a) * I.w / 2 * r, z = I.z + Math.sin(a) * I.d / 2 * r * 0.9; if (ICE_HOLES.some(([hx, hz]) => Math.hypot(x - I.x - hx, z - I.z - hz) < 3.2) || Math.hypot(x - SPOT_BY_ID.ice.pos.x, z - SPOT_BY_ID.ice.pos.z) < 3) continue;
    if (i % 3 === 0){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.7 + (i % 4) * 0.3, 0.6 + (i % 3) * 0.4, 0.7), ice2); b.position.set(x, I.y + 0.3, z); b.rotation.y = i; b.castShadow = true; g.add(b); addCircleCol(x, z, 0.5); }
    else { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (i % 4) * 0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow); b.scale.y = 0.6; b.position.set(x, I.y, z); b.castShadow = true; g.add(b); } }
  { const ix = I.x + 9, iz = I.z + 5.5, dome = new THREE.Mesh(new THREE.SphereGeometry(2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), snow); dome.position.set(ix, I.y, iz); dome.castShadow = true; g.add(dome);
    for (let r = 0; r < 4; r++){ const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(r * 0.35) * 2.01, 0.025, 4, 30), ice2); ring.rotation.x = Math.PI / 2; ring.position.set(ix, I.y + Math.sin(r * 0.35) * 2.01, iz); g.add(ring); }
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 14, 1, false, 0, Math.PI), snow); door.rotation.z = Math.PI / 2; door.rotation.y = Math.PI / 2; door.position.set(ix - 1.9, I.y, iz); g.add(door);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14, 0, Math.PI), mat('#2a3a4a', 0.9)); hole.position.set(ix - 2.62, I.y + 0.02, iz); hole.rotation.y = -Math.PI / 2; g.add(hole); addCircleCol(ix, iz, 2.1); }
  { const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTex('🐧 企鵝冰原', '#2f89c7', '#ffffff'), side: THREE.DoubleSide })); sg.position.set(I.x - 3, I.y + 2.3, I.z + I.d / 2 - 2.5); sg.userData.keep = true; g.add(sg);
    for (const sx of [-1.8, 1.8]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 6), mat('#8c5d3b')); p.position.set(I.x - 3 + sx, I.y + 1.15, I.z + I.d / 2 - 2.5); g.add(p); } }
  // 小碼頭
  addDeck(I.x, I.z + I.d / 2 + 2, 3, 5, I.y); { const d = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 5), mat('#b98a5a', 0.85)); d.position.set(I.x, I.y - 0.1, I.z + I.d / 2 + 2); g.add(d); }
  // 漂在旁邊的小浮冰
  for (let i = 0; i < 9; i++){ const a = i * 0.7 + 0.3, r = 22 + (i % 3) * 5, f = new THREE.Mesh(new THREE.CylinderGeometry(1 + (i % 3), 1.2 + (i % 3), 0.5, 7), ice); f.position.set(I.x + Math.cos(a) * r, 0.05, I.z + Math.sin(a) * r * 0.7); f.rotation.y = i; g.add(f); }
  // 企鵝：在浮冰上走來走去、偶爾肚子貼地滑行、跳進水裡再跳上來
  for (let i = 0; i < 14; i++){ const pg = makePenguin(i < 3); const a = i * 2.1, r = 0.3 + (i % 4) * 0.15; const x = I.x + Math.cos(a) * I.w / 2 * r, z = I.z + Math.sin(a) * I.d / 2 * r;
    pg.position.set(x, I.y, z); pg.rotation.y = a; scene.add(pg); Venue.penguins.push({ g: pg, tx: x, tz: z, wait: Math.random() * 4, mode: 'idle', ph: Math.random() * 6, t0: 0, vy: 0 }); }
  // 下雪
  { const N = 500, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++){ pos[i * 3] = I.x + (Math.random() - 0.5) * 70; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = I.z + (Math.random() - 0.5) * 60; }
    const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo2, new THREE.PointsMaterial({ color:'#ffffff', size:0.14, transparent:true, opacity:0.85, depthWrite:false })); pts.frustumCulled = false; pts.userData.keep = true; scene.add(pts); Venue.snow = pts; }
}
function iceFree(x, z){ const d = deckAt(x, z); return !!d && nearIce(x, z, 0) && !blocked(x, z, 0.3); }
const Amb = { gull: 6, wind: 3, sq: 4, step: 0, bub: 1 };
function updateAmbient(dt, t, nearI){
  if (!soundOn || !actx || document.hidden) return;
  const shoreD = islandEdge(me.pos.x, me.pos.z);
  if (!Dive.on && !House.on && !nearI && shoreD < 8 && shoreD > -18 && DayNight.period !== 'night'){ Amb.gull -= dt; if (Amb.gull < 0){ SFX.gull(); Amb.gull = 9 + Math.random() * 16; } }
  if (nearI && !Dive.on){ Amb.wind -= dt; if (Amb.wind < 0){ SFX.wind(); Amb.wind = 2 + Math.random() * 2; }
    Amb.sq -= dt; if (Amb.sq < 0){ if (Venue.penguins.some(p => Math.hypot(p.g.position.x - me.pos.x, p.g.position.z - me.pos.z) < 9)) SFX.squeak(); Amb.sq = 3 + Math.random() * 6; } }
  if (Dive.on){ Amb.bub -= dt; if (Amb.bub < 0){ SFX.bubble(); Amb.bub = 0.6 + Math.random() * 1.6; } }
  if (!Dive.on && !myBoat && me.speed > 1.5 && Jump.air <= 0){ Amb.step -= dt * me.speed; if (Amb.step < 0){ SFX.step(); Amb.step = 2.3; } }
}
function renderShrimpChip(ih){
  let c = $('#shrimpChip'); if (!ih){ if (c) c.hidden = true; return; }
  if (!c){ c = document.createElement('button'); c.id = 'shrimpChip'; c.className = 'panel'; c.addEventListener('click', () => openSheet('shrimp')); document.body.appendChild(c); }
  c.hidden = false; const l = shrimpLeft(), txt = (l ? `🎫 剩 ${mmss(l)}` : '🎫 還沒買時段') + (sevActive() ? `・🎉 池子裡有${FISH_BY_ID[Sev.ev.fish].name}` : ''); if (c._t !== txt){ c.textContent = txt; c._t = txt; c.classList.toggle('none', !l); }
}
function updateVenues(dt, t){
  const nearI = Venue.penguins.length > 0 && Math.hypot(me.pos.x - ICE.x, me.pos.z - ICE.z) < 70, nearS = Math.hypot(me.pos.x - SHRIMP.x, me.pos.z - SHRIMP.z) < 50; updateAmbient(dt, t, false);
  if (Venue.snow){ Venue.snow.visible = nearI && !Dive.on; if (nearI && frameNo % 2 === 0){ const a = Venue.snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3){ a[i + 1] -= dt * 2 * 1.2; a[i] += Math.sin(t + i) * dt * 0.3; if (a[i + 1] < 0) a[i + 1] = 14; } Venue.snow.geometry.attributes.position.needsUpdate = true; } }
  { const ih = inHall(); if (Venue.hall && Venue.hall.visible !== ih) Venue.hall.visible = ih; if (Venue.boss){ Venue.boss.av.g.visible = ih; if (ih){ Venue.boss.update(dt, t); Venue.boss.placeTag(); } else Venue.boss.tag.style.display = 'none'; }
    renderShrimpChip(ih); if (ih !== Venue.wasIn){ Venue.wasIn = ih; updateBobberLook(); } }
  if (nearS && Venue.coal){ Venue.coal.material.emissiveIntensity = 1 + Math.sin(t * 7) * 0.25; if (Math.random() < dt * 8) ripple(Venue.pump[Math.floor(Math.random() * 3)] + (Math.random() - 0.5) * 0.4, SHRIMP.z + (Math.random() - 0.5) * (SHRIMP.pd - 1)); }
  for (const p of Venue.penguins){ p.g.visible = nearI && !Dive.on; if (!nearI) continue; const g = p.g, U = g.userData;
    if (p.mode === 'idle'){ p.wait -= dt; U.head.rotation.y = Math.sin(t * 0.7 + p.ph) * 0.5; U.fl[0].rotation.z = U.fl[1].rotation.z = 0; g.rotation.z = 0;
      // 有人靠近會轉頭看他
      if (Math.hypot(me.pos.x - g.position.x, me.pos.z - g.position.z) < 3){ g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(me.pos.x - g.position.x, me.pos.z - g.position.z), 1 - Math.exp(-3 * dt)); U.fl[0].rotation.z = Math.sin(t * 9) * 0.5; U.fl[1].rotation.z = -Math.sin(t * 9) * 0.5; }
      if (p.wait <= 0){ const r = Math.random(); let tx, tz, ok = false;
        for (let k = 0; k < 6 && !ok; k++){ tx = g.position.x + (Math.random() - 0.5) * 8; tz = g.position.z + (Math.random() - 0.5) * 8; ok = iceFree(tx, tz); }
        if (r < 0.12){ p.mode = 'dive'; p.t0 = t; }
        else if (ok){ p.tx = tx; p.tz = tz; p.mode = r < 0.3 ? 'slide' : 'walk'; } else p.wait = 1 + Math.random() * 3; } }
    else if (p.mode === 'walk' || p.mode === 'slide'){ const dx = p.tx - g.position.x, dz = p.tz - g.position.z, d = Math.hypot(dx, dz), sp = p.mode === 'slide' ? 2.6 : 0.8;
      if (d < 0.15){ p.mode = 'idle'; p.wait = 2 + Math.random() * 5; g.rotation.x = 0; g.position.y = ICE.y; continue; }
      const nx = g.position.x + dx / d * sp * dt, nz = g.position.z + dz / d * sp * dt; if (!iceFree(nx, nz)){ p.mode = 'idle'; p.wait = 1; g.rotation.x = 0; g.position.y = ICE.y; continue; }
      g.position.x = nx; g.position.z = nz; g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
      if (p.mode === 'walk'){ g.rotation.z = Math.sin(t * 9 + p.ph) * 0.16; U.ft[0].position.z = 0.06 + Math.sin(t * 9 + p.ph) * 0.05; U.ft[1].position.z = 0.06 - Math.sin(t * 9 + p.ph) * 0.05; g.rotation.x = 0; g.position.y = ICE.y; }
      else { g.rotation.x = Math.PI / 2 - 0.2; g.rotation.z = 0; g.position.y = ICE.y + 0.25 * g.scale.y; U.fl[0].rotation.z = 0.9; U.fl[1].rotation.z = -0.9; } }
    else if (p.mode === 'dive'){ const k = t - p.t0;   // 跳進冰洞，過一下再跳出來
      if (k < 0.5){ g.position.y = ICE.y + Math.sin(k / 0.5 * Math.PI) * 0.5; g.rotation.x = k * 2; }
      else if (k < 0.6){ g.visible = false; if (!p.splashed){ p.splashed = true; ripple(g.position.x, g.position.z, true); if (Math.hypot(g.position.x - me.pos.x, g.position.z - me.pos.z) < 12) SFX.splash(); } }
      else if (k < 4){ g.visible = false; }
      else if (k < 4.5){ g.visible = true; g.position.y = ICE.y + Math.sin((k - 4) / 0.5 * Math.PI) * 0.6; g.rotation.x = 0; }
      else { p.mode = 'idle'; p.wait = 3; g.position.y = ICE.y; g.rotation.x = 0; p.splashed = false; } }
  }
}
/* ================= QUESTS：NPC 每日任務（伺服器產生、伺服器檢查）================= */
// 渡船：港口的船夫阿海，可以載你到祕密窩點或外海
const FERRY = { name:'船夫 阿海', at:[27.2, -27.4], dest:[ { id:'deep', name:'外海深處', x:52, z:-46, desc:'大魚最多的深海，離岸很遠' }, { id:'lh', name:'燈塔外的礁岩', x:34, z:-58, desc:'燈塔照得到的地方，晚上月光鯛很多' }, { id:'north', name:'東邊外海', x:-6, z:-66, desc:'海邊再往外，常有成群的鯖魚' } ] };
let ferryNpc = null; const Ferry = { on:false };
function updateFerry(){
  if (!ferryNpc && houseBuilder){ const [x, z] = freeSpot(FERRY.at[0], FERRY.at[1]), f = new Fisher({ shirt:'#2f89c7', hat:'#f6f0dd', name:FERRY.name, kind:'npc' }); f.pos.set(x, 0, z); f.baseY = groundHeight(x, z); f.rot = Math.PI / 2; f.setGear({ hat:'hat_pirate', top:'top_stripe', shoes:'shoes_rain' }); f.nm.classList.add('quest'); ferryNpc = { f, name:FERRY.name }; f.say('🚤', 'emote', 99999); }
  if (ferryNpc){ const d = Math.hypot(me.pos.x - ferryNpc.f.pos.x, me.pos.z - ferryNpc.f.pos.z); if (d < 40){ ferryNpc.f.av.g.visible = !onIsle && !House.on; ferryNpc.f.update(0.016, now()); ferryNpc.f.placeTag(); } else ferryNpc.f.tag.style.display = 'none'; }
  if (Ferry.on && !myBoat){ Ferry.on = false; renderFerryBar(); }
  if (Ferry.on && frameNo % 60 === 0){ const n = crewNear(); if (n !== Ferry.crewN){ Ferry.crewN = n; renderFerryBar(); } }
}
function ferryTo(x, z, label){
  closeSheet(); const b = boats.find(b => b.dock.id === 'harbor'); if (!b) return;
  // 找附近夠深的水
  let px = x, pz = z; if (!waterAt(px, pz)){ for (let r = 1; r < 12; r += 1){ let ok = false; for (let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2, qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (waterAt(qx, qz)){ px = qx; pz = qz; ok = true; break; } } if (ok) break; } }
  if (myBoat) leaveFerry(true);
  const fx = $('#fadeFx'); fx.classList.add('on'); SFX.cast();
  setTimeout(() => { if (F.phase !== 'idle') cancelFishing(); const back = 2.4; b.m.position.set(px - back, WATER_LEVEL, pz); b.m.rotation.set(0, Math.PI / 2, 0); boardBoat(b); me.rot = Math.PI / 2; cam.yaw = me.rot + Math.PI;
    Ferry.on = true; Ferry.label = label; renderFerryBar(); pushPresence(true); if (Party.team && !/祕密窩點|船隊/.test(label)) sailInvite(px, pz, label); setTimeout(() => fx.classList.remove('on'), 120); flash(`🚤 到了：${label}`, 1.4); }, 420);
}
function leaveFerry(silent){
  const b = myBoat; if (!b) return; if (F.phase !== 'idle') cancelFishing();
  myBoat = null; me.sitting = false; b.m.position.set(b.dock.x, WATER_LEVEL, b.dock.z); b.m.rotation.set(0, b.dock.rot, 0); Ferry.on = false; Party.lead = null; Party.joined.clear(); renderFerryBar();
  if (!silent){ const h = TRAVEL.find(t => t.id === 'harbor'); travelTo(h || TRAVEL[0]); toast('🚤 阿海把你載回港口了'); }
}
function renderFerryBar(){
  let bar = $('#ferryBar'); if (!Ferry.on){ if (bar) bar.hidden = true; return; }
  if (!bar){ bar = document.createElement('div'); bar.id = 'ferryBar'; bar.className = 'panel'; document.body.appendChild(bar); }
  bar.hidden = false; bar.innerHTML = ''; bar.appendChild(el('span', '', `🚤 ${Ferry.label}`));
  { const n = crewNear(); if (n || Party.joined.size) bar.appendChild(el('span', 'crew', `👥${Math.max(n, Party.joined.size) + 1}${n ? `・+${8 * n}%` : ''}`)); }
  { const ds = boatDiveSite(); if (ds && hasDive('dive_suit')){ const dv = el('button', 'tbtn', '🤿 下潛'); dv.addEventListener('click', () => startDive(ds)); bar.appendChild(dv); } }
  const b = el('button', 'tbtn ghost', '回港口'); b.addEventListener('click', () => leaveFerry()); bar.appendChild(b);
}
function renderFerry(body){
  body.appendChild(el('div', 'shophead')).innerHTML = `<b>🚤 ${FERRY.name}</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`;
  body.appendChild(el('p', 'sub', '「要去哪裡？我的船很快的！」到了以後可以在船上釣魚、也可以自己划，想回來按「回港口」就好。'));
  if (room && room.connected()){ const tb = el('label', 'teamtgl'), cb = el('input'); cb.type = 'checkbox'; cb.checked = Party.team; cb.addEventListener('change', () => { Party.team = cb.checked; });
    tb.append(cb, el('span', '', '👥 組隊出海：邀請大廳裡的人一起去（祕密窩點不會邀請，別人不會知道）')); body.appendChild(tb);
    body.appendChild(el('p', 'sub', '在船上釣魚時，附近 16 公尺內每多一個人也在船上，大家的魚都會快一點上鉤（每人 8%，最多 3 人）。')); }
  { body.appendChild(el('div', 'dexhead', '⛴️ 海上的好地方')); const ul = el('ul', 'shoplist');
    for (const [id, ic, nm, ds] of [['frostdock', '❄️', '北方冰封群島', '下雪的島，中間結冰的湖可以鑿冰洞釣魚，北邊海岸有流冰。冰湖用手竿、海岸用遠投竿最好'], ['abyssdock', '🌌', '深海浮台', '遠洋上的浮台，底下是很深的海溝，有發光的深海魚和古老的深海鯊。用遠投竿最好'], ['mystdock', '🌋', '遠洋神秘島', '寒流和暖流交會的火山島，住著別的地方沒有的魚，還有海獅和大象龜']]){ const li = el('li'); li.appendChild(el('span', 'dishic', ic));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', nm)); d.appendChild(el('div', 'sub2', ds)); li.appendChild(d);
      const a = el('div', 'tacts'), b = el('button', 'tbtn', '載我去'); b.addEventListener('click', () => { closeSheet(); travelTo(TRAVEL.find(t => t.id === id)); }); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
    body.appendChild(ul); }
  { body.appendChild(el('div', 'dexhead', `🤿 潛水（進階）${hasDive('dive_suit') ? `・氧氣 ${diveO2()} 秒` : ''}`)); const ul = el('ul', 'shoplist');
    for (const [k, S] of Object.entries(DIVE_SITES)){ if (S.boat) continue; const ok = diveSiteOk(k), li = el('li', ok ? '' : 'lock'); li.appendChild(el('span', 'dishic', S.icon));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', S.name)); d.appendChild(el('div', 'sub2', ok ? S.desc : `要先買：${S.need.filter(id => !hasDive(id)).map(id => DIVE_BY_ID[id].name).join('、')}`)); li.appendChild(d);
      const a = el('div', 'tacts'), b = el('button', 'tbtn' + (ok ? '' : ' ghost'), '去潛水'); b.addEventListener('click', () => startDive(k)); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
    body.appendChild(ul); }
  body.appendChild(el('div', 'dexhead', '🤫 你的祕密窩點'));
  const ul = el('ul', 'shoplist');
  if (!secretSpots.length) ul.appendChild(el('li', '', '還沒有祕密窩點。在水邊按「🍚 打窩」→「🤫 提前打」，就能做一個只有你知道的窩點。'));
  for (const sp of secretSpots){ const pw = secretPower(sp), li = el('li'), mins = Math.max(0, Math.round((SECRET_LIFE - (Date.now() - sp.at)) / 60000));
    li.appendChild(el('span', 'dishic', '🍚')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${sp.where}・${CHUM_BY_ID[sp.type].name}`)); d.appendChild(el('div', 'sub2', pw >= 1 ? `🔥 效果最強！還剩 ${mins} 分鐘` : `發酵中 ${Math.round(pw * 100)}%・還剩 ${mins} 分鐘`)); li.appendChild(d);
    const a = el('div', 'tacts'), b = el('button', 'tbtn', '載我去'); b.addEventListener('click', () => ferryTo(sp.x, sp.z, `祕密窩點（${sp.where}）`)); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
  // 在地圖上自己選地點：點哪塊海面就載你去哪裡（到了再自己打窩）
  body.appendChild(el('div', 'dexhead', '🗺️ 自己選地點'));
  body.appendChild(el('p', 'sub', '在地圖上點一塊水面，阿海就載你過去。到了以後可以自己打窩、做一個新的祕密窩點。'));
  const R = 88, S = 360, wrap = el('div', 'mapwrap ferrymap'), cv = el('canvas', 'mapcv'); cv.width = cv.height = S; wrap.appendChild(cv); body.appendChild(wrap);
  const ctx = cv.getContext('2d'), toPx = (x, z) => [(-z + R) / (R * 2) * S, (x + R) / (R * 2) * S], toW = (px, py) => [py / S * R * 2 - R, R - px / S * R * 2];   /* 跟大地圖一樣：上北（-x）右東（-z） */
  const draw = pick => {
    ctx.fillStyle = '#1f5981'; ctx.fillRect(0, 0, S, S);   // 地圖外面都是海（顏色跟地圖的深海一樣）
    const [a0, b0] = toPx(-MAP_VIEW, MAP_VIEW), [a1] = toPx(MAP_VIEW, -MAP_VIEW); ctx.drawImage(getMapImage(), a0, b0, a1 - a0, a1 - a0);
    ctx.textAlign = 'center'; ctx.font = '18px sans-serif';
    const [hx, hy] = toPx(FERRY.at[0], FERRY.at[1]); ctx.fillText('🚤', hx, hy + 6);
    for (const sp of secretSpots){ const [sx, sy] = toPx(sp.x, sp.z); ctx.fillText('🤫', sx, sy + 6); }
    const [mx, my] = toPx(me.pos.x, me.pos.z); ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fillStyle = PALETTE.coral; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (pick){ const [px, py] = toPx(pick[0], pick[1]); ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.setLineDash([4, 3]); ctx.lineWidth = 3; ctx.strokeStyle = pick[2] ? '#ffd36a' : '#f04a3a'; ctx.stroke(); ctx.setLineDash([]); }
  };
  draw(null);
  const info = el('div', 'tankbar'), lbl = el('span', 'sub', '點地圖選一個地方'), go = el('button', 'tbtn', '載我去'); go.disabled = true; info.append(lbl, go); body.appendChild(info);
  let pick = null;
  cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), [x, z] = toW((e.clientX - r.left) / r.width * S, (e.clientY - r.top) / r.height * S), ok = waterAt(x, z) && Math.hypot(x - ISLE.x, z - ISLE.z) > 40;
    pick = [x, z, ok]; draw(pick); go.disabled = !ok; lbl.textContent = ok ? `選好了：${spotName(x, z)}（${x.toFixed(0)}, ${z.toFixed(0)}）` : '那裡不是水面，換一個地方'; });
  go.addEventListener('click', () => { if (pick && pick[2]) ferryTo(pick[0], pick[1], `自選地點（${spotName(pick[0], pick[1])}）`); });
  body.appendChild(el('div', 'dexhead', '🌊 外海'));
  const u2 = el('ul', 'shoplist');
  for (const d0 of FERRY.dest){ const li = el('li'); li.appendChild(el('span', 'dishic', '🌊')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', d0.name)); d.appendChild(el('div', 'sub2', d0.desc)); li.appendChild(d);
    const a = el('div', 'tacts'), b = el('button', 'tbtn', '載我去'); b.addEventListener('click', () => ferryTo(d0.x, d0.z, d0.name)); a.appendChild(b); li.appendChild(a); u2.appendChild(li); }
  body.appendChild(u2);
}
/* ================= DIVE：潛水（進階玩法：要先買潛水裝備，氧氣瓶可以升級）================= */
// 水下場景蓋在外海的正下方（跟房子一樣，外面用一顆大球包起來，看不到上面的世界）
const DIVE = { x:60, y:-70, z:-40, r:30, top:15 };
// 三個潛水點：越深越需要好裝備，寶物也越多（伺服器 022_dive_sites.sql 一樣）
const DIVE_SITES = {
  reef:  { name:'珊瑚礁',   icon:'🪸', need:['dive_suit'], top:15, sky:['#8ee6f7', '#0b4a78'], fog:'#2a9cc8', far:34, coral:90, lush:true, kelp:46, rocks:26, shells:14, chests:[0.55], pearls:0, legendP:0.28, desc:'淺淺的珊瑚礁，有一艘小沉船、很多魚群。' },
  wreck: { name:'沉船深海', icon:'⚓', need:['dive_suit', 'dive_tank3'], top:24, sky:['#2f7fb0', '#04182c'], fog:'#0f4a70', far:22, coral:24, kelp:18, rocks:34, shells:8, chests:[1, 0.7, 0.4], pearls:0, legendP:0.6, big:true, desc:'更深的海底躺著一艘大帆船，寶箱比較多、也比較值錢，大魚和傳說魚常在附近。要大型氧氣瓶。',
    fish:['grouper', 'shark', 'hammer', 'barracuda', 'moonbream', 'kingcrab', 'lobster', 'tuna', 'octopus', 'turtle', 'manta', 'stingray', 'trevally', 'scorpion', 'mackerel', 'bonito'] },
  offshore: { name:'外海', icon:'🌊', need:['dive_suit'], top:20, sky:['#3f9fd0', '#05213a'], fog:'#145a85', far:26, coral:4, kelp:10, rocks:14, shells:0, chests:[], pearls:0, legendP:0, boat:true, desc:'從船上直接潛下去，看看這一帶現在有哪些魚特別多。', get fish(){ return offshoreDiveFish(); } },
  cave:  { name:'海底洞穴', icon:'🕳️', need:['dive_suit', 'dive_tank4', 'dive_light'], top:18, sky:['#1a3550', '#02060c'], fog:'#12324c', far:22, coral:0, kelp:0, rocks:60, shells:4, chests:[0.8], pearls:7, legendP:0.55, cave:true, desc:'又暗又神祕的洞穴，有會發光的水晶和珍珠貝，住著深海的怪魚。要專業雙氧氣瓶和潛水燈。',
    fish:['angler', 'jelly', 'lantern', 'oarfish', 'giantsquid', 'octopus', 'eel', 'moonbream', 'ika', 'squid', 'goby', 'kingcrab'] },
};
function diveSiteOk(k){ return DIVE_SITES[k].need.every(hasDive); }
const DIVE_GEAR = [
  { id:'dive_suit',  name:'潛水裝備組',   icon:'🤿', price:1500, o2:60,  desc:'潛水衣、面鏡、蛙鞋和小氧氣瓶。有了它才能請船夫阿海帶你去潛水，氧氣 60 秒。' },
  { id:'dive_tank2', name:'中型氧氣瓶',   icon:'🫧', price:1200, o2:100, need:'dive_suit',  desc:'氧氣變成 100 秒。' },
  { id:'dive_tank3', name:'大型氧氣瓶',   icon:'🫧', price:3000, o2:150, need:'dive_tank2', desc:'氧氣變成 150 秒。' },
  { id:'dive_tank4', name:'專業雙氧氣瓶', icon:'🫧', price:7000, o2:220, need:'dive_tank3', desc:'氧氣變成 220 秒，可以慢慢逛整片珊瑚礁。' },
  { id:'dive_fins',  name:'競速蛙鞋',     icon:'🦶', price:900,  need:'dive_suit', desc:'在水裡游得快 35%。' },
  { id:'dive_light', name:'潛水燈',       icon:'🔦', price:600,  need:'dive_suit', desc:'晚上潛水也看得清楚。' },
];
const DIVE_BY_ID = Object.fromEntries(DIVE_GEAR.map(g => [g.id, g]));
var Dive = { on:false, up:false, down:false, o2:0, o2max:60, group:null, fish:[], schools:[], loot:[], kelp:null, bubbles:null, shafts:[], seen:new Set(), back:null, warned:0 };
function hasDive(id){ return (rec.dive || []).includes(id); }
function diveO2(){ let o = 0; for (const g of DIVE_GEAR) if (g.o2 && hasDive(g.id)) o = Math.max(o, g.o2); return o; }
function diveBed(x, z){
  const dx = x - DIVE.x, dz = z - DIVE.z, d = Math.hypot(dx, dz);
  return DIVE.y + Math.sin(dx * 0.21) * 0.45 + Math.cos(dz * 0.17 + dx * 0.05) * 0.55 + Math.sin((dx + dz) * 0.09) * 0.8 + Math.max(0, d - DIVE.r * 0.72) * 0.55;
}
let diveSp = null; function diveSpecies(){ return diveSp || (diveSp = FISH.filter(f => SEA_SPOTS.has(f.spot) || DIVE_SITES.cave.fish.includes(f.id))); }
/* ---- 外海的魚情：每 5 分鐘換一次，這段時間有 3 種魚特別活躍（上鉤機率 ×2.5）。潛水下去就看得到是哪幾種 ----
   伺服器（fair_fishing.sql.tpl）用一樣的雜湊算，傳說魚和變種不會出現在魚情裡 */
const INTEL_WIN = 300000;
function intelAt(ms){ const w = Math.floor(ms / INTEL_WIN), h = hash32('intel' + w), pool = SPOT_BY_ID.harbor.fish.map(id => FISH_BY_ID[id]).filter(f => f && f.rarity !== '傳說' && !f.of), n = pool.length;
  return { w, end: (w + 1) * INTEL_WIN, ids: [...new Set([pool[h % n].id, pool[Math.floor(h / 256) % n].id, pool[Math.floor(h / 65536) % n].id])] }; }
const Intel = { seenW: -1 };
function offshoreFish(){ const it = intelAt(Date.now()), others = SPOT_BY_ID.harbor.fish.filter(id => !it.ids.includes(id) && FISH_BY_ID[id] && FISH_BY_ID[id].rarity === '常見' && !FISH_BY_ID[id].of).sort(() => Math.random() - 0.5).slice(0, 3); return [...it.ids, ...it.ids, ...it.ids, ...others]; }
// 外海潛水偶爾遠遠看到一道紅色影子：赤紅霸王鯊還在（海裡沒有了就不會出現）
function offshoreDiveFish(){ const l = offshoreFish(); if (RS.n > 0 && Math.random() < 0.15) l.push('shark_red'); return l; }
function siteSpecies(k){ const S = DIVE_SITES[k]; return S.fish ? S.fish.map(id => FISH_BY_ID[id]).filter(Boolean) : FISH.filter(f => SEA_SPOTS.has(f.spot) && !/^ice|^abyss|^mystic/.test(f.spot) && !f.rs); }   /* 紅鯊不會在一般潛點出現 */
// 把很多小東西合併成少數幾個網格（手機比較順）
function diveMerger(){
  const parts = new Map(), tmp = new THREE.Object3D();
  return {
    add(geo, color, x, y, z, rx, ry, rz, sx, sy, sz, rough){
      tmp.position.set(x, y, z); tmp.rotation.set(rx || 0, ry || 0, rz || 0); tmp.scale.set(sx || 1, sy == null ? (sx || 1) : sy, sz == null ? (sx || 1) : sz); tmp.updateMatrix();
      let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(tmp.matrix); const key = color + '|' + (rough == null ? 0.8 : rough); if (!parts.has(key)) parts.set(key, []); parts.get(key).push(g); geo.dispose();
    },
    build(group){ for (const [key, gs] of parts){ const [c, r] = key.split('|'); const m = new THREE.Mesh(mergeGeometries(gs, false), mat(c, +r)); gs.forEach(g => g.dispose()); group.add(m); } }
  };
}
function buildDive(){
  const S = DIVE_SITES[Dive.site] || DIVE_SITES.reef; DIVE.top = S.top; Dive.crystals = [];
  const g = new THREE.Group(); g.name = 'dive'; scene.add(g); Dive.group = g;
  const X = DIVE.x, Y = DIVE.y, Z = DIVE.z, R = DIVE.r, M = diveMerger(), rnd = mulberry(Math.floor(Date.now() / 60000));
  const onBed = () => { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.92, x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r; return [x, diveBed(x, z), z]; };
  // 外面的大球（上亮下暗）和水面
  { const sg = new THREE.SphereGeometry(R + 16, 28, 16), cs = [], p = sg.attributes.position, c1 = new THREE.Color(S.sky[0]), c0 = new THREE.Color(S.sky[1]), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++){ const k = clamp(p.getY(i) / (R + 16) * 0.5 + 0.5, 0, 1); cc.copy(c0).lerp(c1, Math.pow(k, 1.6)); cs.push(cc.r, cc.g, cc.b); }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    const sp = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false })); sp.position.set(X, Y + 4, Z); sp.renderOrder = -2; g.add(sp); }
  { const s = new THREE.Mesh(new THREE.PlaneGeometry((R + 16) * 2, (R + 16) * 2, 1, 1), new THREE.MeshBasicMaterial({ color:'#bff0ff', transparent:true, opacity:0.5, side:THREE.DoubleSide, fog:false, depthWrite:false }));
    s.rotation.x = Math.PI / 2; s.position.set(X, Y + DIVE.top, Z); g.add(s); Dive.surface = s; }
  // 海底沙地
  { const pg = new THREE.PlaneGeometry(R * 2 + 24, R * 2 + 24, 56, 56); pg.rotateX(-Math.PI / 2); const p = pg.attributes.position, cs = [], a = new THREE.Color(S.cave ? '#5a5a62' : S.big ? '#b8a684' : '#e2d2a4'), b = new THREE.Color(S.cave ? '#3a3c46' : S.big ? '#8f8064' : '#c7b384'), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++){ const x = p.getX(i) + X, z = p.getZ(i) + Z; p.setY(i, diveBed(x, z) - Y); cc.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6)); cs.push(cc.r, cc.g, cc.b); }
    pg.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); pg.computeVertexNormals();
    const bed = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0 })); bed.position.set(X, Y, Z); g.add(bed);
    Dive.caustic = null;
    if (S.lush){ const cg = pg.clone(); cg.translate(0, 0.04, 0); const tx = causticTex(); tx.repeat.set(11, 11); const cm = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: tx, transparent:true, opacity:0.2, blending:THREE.AdditiveBlending, depthWrite:false, fog:true })); cm.position.set(X, Y, Z); cm.renderOrder = 1; g.add(cm); Dive.caustic = cm; } }
  // 石頭
  Dive.rocks = [];
  for (let i = 0; i < S.rocks; i++){ const [x, y, z] = onBed(), s = 0.5 + rnd() * 1.8 * (S.cave ? 1.6 : 1); Dive.rocks.push([x, z, s, y + s * 0.95]); M.add(new THREE.IcosahedronGeometry(s, 0), ['#7d7a72', '#6a6f72', '#8a8170'][i % 3], x, y + s * 0.2, z, rnd(), rnd() * 6, rnd(), 1, 0.55 + rnd() * 0.3, 1, 0.95); }
  // 珊瑚：樹枝、腦紋、扇形、管狀
  const CC = ['#ff6f61', '#ff9f43', '#f5a5d8', '#b48cff', '#ffd36a', '#ff7fa8', '#7fd6c4'];
  for (let i = 0; i < S.coral; i++){ const [x, y, z] = onBed(), c = CC[Math.floor(rnd() * CC.length)], kind = i % 4, s = 0.6 + rnd() * 0.9;
    if (kind === 0){ for (let k = 0; k < 6; k++){ const a = k * 1.1 + rnd(), tl = 0.4 + rnd() * 0.5; M.add(new THREE.CylinderGeometry(0.035 * s, 0.07 * s, tl * s, 5), c, x + Math.cos(a) * 0.12 * s, y + tl * s * 0.45, z + Math.sin(a) * 0.12 * s, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5, 1, 1, 1, 0.6);
        M.add(new THREE.SphereGeometry(0.06 * s, 6, 4), c, x + Math.cos(a) * (0.12 + tl * 0.45) * s, y + tl * s * 0.9, z + Math.sin(a) * (0.12 + tl * 0.45) * s, 0, 0, 0, 1, 1, 1, 0.6); } }
    else if (kind === 1){ M.add(new THREE.SphereGeometry(0.45 * s, 12, 8), ['#c9d36a', '#9fd08a', '#e8b06a'][i % 3], x, y + 0.12 * s, z, 0, 0, 0, 1, 0.62, 1, 1); }
    else if (kind === 2){ const ry = rnd() * 3; M.add(new THREE.CircleGeometry(0.75 * s, 12, 0, Math.PI), c, x, y + 0.05, z, 0, ry, 0, 1, 1, 1, 0.7); M.add(new THREE.CircleGeometry(0.75 * s, 12, 0, Math.PI), c, x, y + 0.05, z, 0, ry + Math.PI, 0, 1, 1, 1, 0.7); }
    else { for (let k = 0; k < 5; k++){ const a = k * 1.25, h = 0.3 + rnd() * 0.5; M.add(new THREE.CylinderGeometry(0.07 * s, 0.08 * s, h * s, 7, 1, true), c, x + Math.cos(a) * 0.13 * s, y + h * s / 2, z + Math.sin(a) * 0.13 * s, 0, 0, 0, 1, 1, 1, 0.7); } } }
  // ---- 珊瑚礁重做（2026-11-05，照使用者給的參考圖：滿滿的珊瑚、陽光、魚群）：一座一座長滿珊瑚的礁丘＋桌形、鹿角、軟珊瑚、大海扇、硨磲貝 ----
  if (S.lush){
    const PAL = ['#ff6f61', '#ff9f43', '#f5a5d8', '#b48cff', '#ffd36a', '#ff7fa8', '#7fd6c4', '#5fb6e3', '#e85d8a'];
    const coral = (x, y, z, s, type, c) => {
      if (type === 0){ for (let k = 0; k < 5; k++){ const a = k * 1.26 + rnd(), tl = 0.45 + rnd() * 0.4, bx = x + Math.cos(a) * 0.1 * s, bz = z + Math.sin(a) * 0.1 * s;   // 鹿角
          M.add(new THREE.CylinderGeometry(0.03 * s, 0.06 * s, tl * s, 5), c, bx + Math.cos(a) * tl * 0.2 * s, y + tl * s * 0.45, bz + Math.sin(a) * tl * 0.2 * s, Math.sin(a) * 0.55, 0, Math.cos(a) * -0.55, 1, 1, 1, 0.6);
          for (const d of [-0.5, 0.5]){ const ex = bx + Math.cos(a) * tl * 0.42 * s, ez = bz + Math.sin(a) * tl * 0.42 * s; M.add(new THREE.CylinderGeometry(0.022 * s, 0.035 * s, 0.32 * s, 4), c, ex + Math.cos(a + d) * 0.08 * s, y + tl * s * 0.9 + 0.1 * s, ez + Math.sin(a + d) * 0.08 * s, Math.sin(a + d) * 0.7, 0, Math.cos(a + d) * -0.7, 1, 1, 1, 0.6);
            M.add(new THREE.SphereGeometry(0.035 * s, 5, 3), shade(c, 0.35), ex + Math.cos(a + d) * 0.17 * s, y + tl * s * 0.9 + 0.24 * s, ez + Math.sin(a + d) * 0.17 * s, 0, 0, 0, 1, 1, 1, 0.5); } } }
      else if (type === 1){ M.add(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 0.45 * s, 6), shade(c, -0.25), x, y + 0.22 * s, z, 0, 0, 0, 1, 1, 1, 0.8);   // 桌形
        M.add(new THREE.CylinderGeometry(0.85 * s, 0.7 * s, 0.09 * s, 14), c, x, y + 0.48 * s, z, (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2, 1, 1, 1, 0.75); }
      else if (type === 2){ for (let k = 0; k < 8; k++){ const a = rnd() * 6.28, r = rnd() * 0.25 * s; M.add(new THREE.SphereGeometry((0.09 + rnd() * 0.08) * s, 6, 4), k % 3 ? c : shade(c, 0.3), x + Math.cos(a) * r, y + (0.12 + rnd() * 0.25) * s, z + Math.sin(a) * r, 0, 0, 0, 1, 1, 1, 0.55); } }   // 軟珊瑚
      else if (type === 3){ const ry = rnd() * 3, sc = 1.2 + rnd() * 0.6; for (const o of [0, Math.PI]) M.add(new THREE.CircleGeometry(0.75 * s * sc, 12, 0, Math.PI), c, x, y + 0.02, z, 0, ry + o, 0, 1, 1.25, 1, 0.7); }   // 大海扇
      else if (type === 4){ M.add(new THREE.SphereGeometry(0.42 * s, 10, 7), ['#c9d36a', '#9fd08a', '#e8b06a', '#d8a8c8'][Math.floor(rnd() * 4)], x, y + 0.1 * s, z, 0, 0, 0, 1, 0.62, 1, 1); }   // 腦紋
      else if (type === 5){ for (let k = 0; k < 6; k++){ const a = k * 1.05, h = 0.25 + rnd() * 0.45; M.add(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, h * s, 6, 1, true), c, x + Math.cos(a) * 0.12 * s, y + h * s / 2, z + Math.sin(a) * 0.12 * s, 0, 0, 0, 1, 1, 1, 0.7); } }   // 管狀
      else { const ry = rnd() * 6; M.add(new THREE.SphereGeometry(0.32 * s, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#d8cfc0', x, y + 0.14 * s, z, 0.2, ry, 0, 1, 0.55, 0.8, 0.5);   // 硨磲貝
        M.add(new THREE.SphereGeometry(0.3 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#d8cfc0', x, y + 0.18 * s, z, -0.5, ry, 0, 1, 0.35, 0.8, 0.5); M.add(new THREE.BoxGeometry(0.5 * s, 0.05 * s, 0.12 * s), ['#3f7fe0', '#2fb8a8', '#8a5fd8'][Math.floor(rnd() * 3)], x, y + 0.17 * s, z, 0, ry, 0, 1, 1, 1, 0.3); }
    };
    // 礁丘：每一座上面長滿珊瑚，魚會繞著游
    for (let b = 0; b < 12; b++){ const a = b / 12 * Math.PI * 2 + rnd() * 0.4, r = R * (0.22 + rnd() * 0.6), bx = X + Math.cos(a) * r, bz = Z + Math.sin(a) * r, by = diveBed(bx, bz), bs = 1.3 + rnd() * 1.5;
      M.add(new THREE.IcosahedronGeometry(bs, 1), ['#b08a8a', '#a8907a', '#9a8aa8', '#b8a080'][b % 4], bx, by + bs * 0.12, bz, 0, rnd() * 6, 0, 1.3, 0.62, 1.15, 0.95);
      Dive.rocks.push([bx, bz, bs * 1.25, by + bs * 0.7]);
      for (let k = 0; k < 20; k++){ const ca = rnd() * Math.PI * 2, cr = Math.sqrt(rnd()) * bs * 1.1, cx = bx + Math.cos(ca) * cr * 1.25, cz = bz + Math.sin(ca) * cr * 1.1, cy = by + bs * 0.12 + bs * 0.6 * Math.sqrt(Math.max(0, 1 - Math.pow(cr / (bs * 1.15), 2))) - 0.05;
        coral(cx, cy, cz, 0.7 + rnd() * 0.7, Math.floor(rnd() * 7), PAL[Math.floor(rnd() * PAL.length)]); } }
    // 礁丘之間也散著珊瑚
    for (let i = 0; i < 70; i++){ const [x, y, z] = onBed(); coral(x, y, z, 0.6 + rnd() * 0.7, Math.floor(rnd() * 7), PAL[Math.floor(rnd() * PAL.length)]); }
  }
  // 海葵（會晃的觸手用小圓錐）
  for (let i = 0; i < (S.cave ? 0 : S.big ? 6 : 18); i++){ const [x, y, z] = onBed(), c = ['#ff9fd0', '#ffd36a', '#a6f0d0'][i % 3]; for (let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2; M.add(new THREE.ConeGeometry(0.035, 0.32, 4), c, x + Math.cos(a) * 0.12, y + 0.16, z + Math.sin(a) * 0.12, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4, 1, 1, 1, 0.5); } M.add(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 9), '#c0587a', x, y + 0.04, z); }
  // 沉船
  if (S.cave){   // 洞穴：四周的岩壁、頂上的岩石（中間有個洞透光）、會發光的水晶
    for (let i = 0; i < 48; i++){ const a = i / 48 * Math.PI * 2 + rnd() * 0.1, r = R * (0.86 + rnd() * 0.12), x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r, s = 3 + rnd() * 3.5;
      M.add(new THREE.IcosahedronGeometry(s, 1), ['#3d3f4a', '#4a4b55', '#34363f'][i % 3], x, diveBed(x, z) + s * 0.6, z, rnd(), rnd() * 6, rnd(), 1, 1.6 + rnd() * 0.8, 1, 0.95); }
    for (let i = 0; i < 30; i++){ const a = rnd() * Math.PI * 2, r = 7 + rnd() * R * 0.8, x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r, s = 3 + rnd() * 4; M.add(new THREE.IcosahedronGeometry(s, 1), '#2f3139', x, Y + DIVE.top + s * 0.3, z, rnd(), rnd() * 6, rnd(), 1, 0.7, 1, 0.95); }
    for (let i = 0; i < 18; i++){ const a = rnd() * Math.PI * 2, r = R * (0.75 + rnd() * 0.12), x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r, s = 1 + rnd() * 2;   // 鐘乳石
      M.add(new THREE.ConeGeometry(0.4 * s, 2.2 * s, 6), '#4a4b55', x, Y + DIVE.top - 1.1 * s, z, Math.PI, 0, 0, 1, 1, 1, 0.9); }
    const cryM = [mat('#7ef0ff', 0.2, { emissive:'#3fd8ff', emissiveIntensity:2.4, fog:false, transparent:true, opacity:0.9 }), mat('#d6a8ff', 0.2, { emissive:'#a56bff', emissiveIntensity:2.4, fog:false, transparent:true, opacity:0.9 })];
    Dive.crystals = [];
    for (let i = 0; i < 22; i++){ const [x, y, z] = onBed(), cg = new THREE.Group(); for (let k = 0; k < 4; k++){ const h = 0.4 + rnd() * 0.9, c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), cryM[i % 2]); c.scale.set(1, h * 3, 1); c.position.set((rnd() - 0.5) * 0.4, h * 0.4, (rnd() - 0.5) * 0.4); c.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); cg.add(c); }
      cg.position.set(x, y, z); g.add(cg); Dive.crystals.push(cg); }
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 4, DIVE.top + 2, 12, 1, true), new THREE.MeshBasicMaterial({ color:'#bfeaff', transparent:true, opacity:0.08, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }));
    hole.position.set(X, Y + DIVE.top / 2, Z); g.add(hole);
  }
  if (!S.cave){ const W = S.big ? 2 : 1, sx = X + 11 * (S.big ? 0.6 : 1), sz = Z - 9 * (S.big ? 0.6 : 1), sy = diveBed(sx, sz), wood = S.big ? '#4f3a2c' : '#6b4a35', dark = '#3a2a1e';
    if (S.big){ M.add(new THREE.BoxGeometry(5.2, 3.0, 16), wood, sx, sy + 1.0, sz, 0.12, 0.5, 0.42, 1, 1, 1, 0.95); M.add(new THREE.BoxGeometry(4.6, 0.2, 14.4), dark, sx + 0.5, sy + 2.55, sz - 0.2, 0.12, 0.5, 0.42, 1, 1, 1, 0.95);
      M.add(new THREE.ConeGeometry(2.7, 4.4, 4), wood, sx + Math.sin(0.5) * 9.2, sy + 0.7, sz + Math.cos(0.5) * 9.2, Math.PI / 2, 0.5 + Math.PI / 4, 0, 1, 1, 0.7, 0.95);
      for (const [mx, mz, h] of [[0.6, 0.4, 9], [-1.4, -4, 7]]){ M.add(new THREE.CylinderGeometry(0.2, 0.28, h, 7), dark, sx + mx, sy + h / 2 + 0.6, sz + mz, 0.45, 0, 0.6, 1, 1, 1, 0.9); M.add(new THREE.PlaneGeometry(3.2, 2.6), '#c9bfa6', sx + mx + 1.2, sy + h * 0.6, sz + mz + 0.6, 0.3, 0.9, 0.5, 1, 1, 1, 1); }
      for (let k = 0; k < 7; k++) M.add(new THREE.TorusGeometry(0.3, 0.07, 6, 12), '#2a2a2a', sx - 1.9 + k * 0.1, sy + 1.6, sz - 5 + k * 1.6, 0, 0.5 + Math.PI / 2, 0.42, 1, 1, 1, 0.6);
      for (let k = 0; k < 10; k++){ const a = rnd() * 6.28, r = 4 + rnd() * 6; M.add(new THREE.BoxGeometry(0.2 + rnd() * 1.5, 0.12, 0.3), wood, sx + Math.cos(a) * r, diveBed(sx + Math.cos(a) * r, sz + Math.sin(a) * r) + 0.06, sz + Math.sin(a) * r, 0, rnd() * 3, 0, 1, 1, 1, 0.95); }
      Dive.wreck = { x: sx, z: sz }; } else {
    M.add(new THREE.BoxGeometry(2.6, 1.5, 8), wood, sx, sy + 0.5, sz, 0.08, 0.5, 0.32, 1, 1, 1, 0.95);
    M.add(new THREE.BoxGeometry(2.3, 0.12, 7.2), dark, sx + 0.25, sy + 1.28, sz - 0.1, 0.08, 0.5, 0.32, 1, 1, 1, 0.95);
    M.add(new THREE.ConeGeometry(1.35, 2.2, 4), wood, sx + Math.sin(0.5) * 4.6, sy + 0.35, sz + Math.cos(0.5) * 4.6, Math.PI / 2, 0.5 + Math.PI / 4, 0, 1, 1, 0.7, 0.95);
    M.add(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 7), dark, sx + 0.6, sy + 3.2, sz + 0.4, 0.5, 0, 0.7, 1, 1, 1, 0.9);
    M.add(new THREE.BoxGeometry(2.2, 0.1, 0.1), dark, sx + 1.4, sy + 4.4, sz + 1.3, 0.5, 0.2, 0.7, 1, 1, 1, 0.9);
    for (let k = 0; k < 4; k++) M.add(new THREE.TorusGeometry(0.22, 0.05, 6, 12), '#3a3a3a', sx - 0.9 + k * 0.1, sy + 0.9, sz - 2.4 + k * 1.4, 0, 0.5 + Math.PI / 2, 0.32, 1, 1, 1, 0.6);
    Dive.wreck = { x: sx, z: sz }; } } else Dive.wreck = { x: X, z: Z };
  M.build(g);
  // 海帶（InstancedMesh，會跟著水流晃）
  { const kg = new THREE.PlaneGeometry(0.34, 3.2, 1, 6); kg.translate(0, 1.6, 0); const p = kg.attributes.position; for (let i = 0; i < p.count; i++){ const yy = p.getY(i); p.setX(i, p.getX(i) * (1 - yy / 4) + Math.sin(yy * 1.6) * 0.12); } kg.computeVertexNormals();
    const N = Math.max(1, S.kelp), im = new THREE.InstancedMesh(kg, mat('#4f9a54', 0.8, { side:THREE.DoubleSide }), N), list = [];
    for (let i = 0; i < N; i++){ let x, z; if (i < 30){ const a = rnd() * Math.PI * 2, r = R * (0.55 + rnd() * 0.35); x = X + Math.cos(a) * r; z = Z + Math.sin(a) * r; } else { const c = Math.floor(i / 4) % 3; x = X - 10 + c * 6 + rnd() * 2; z = Z + 8 + rnd() * 3; }
      list.push({ x, y: diveBed(x, z), z, s: 0.8 + rnd() * 1.1, ry: rnd() * 3, ph: rnd() * 6 }); }
    im.frustumCulled = false; g.add(im); Dive.kelp = { im, list }; }
  // 光束
  Dive.shafts = [];
  const rayTx = (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#8aa8b0'); gr.addColorStop(1, '#000000'); c.fillStyle = gr; c.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(cv); })();   /* 光束越往下越淡 */
  for (let i = 0; i < (S.cave ? 0 : S.big ? 4 : S.lush ? 13 : 7); i++){ const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, S.lush ? 2.0 + rnd() * 1.4 : 2.4, DIVE.top + 2, 10, 1, true), new THREE.MeshBasicMaterial({ color:'#e8fbff', map: rayTx, transparent:true, opacity:0.05, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }));
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * R * 0.7; m.position.set(X + Math.cos(a) * r, Y + DIVE.top / 2 + 0.5, Z + Math.sin(a) * r); m.rotation.z = 0.18; m.rotation.y = rnd(); g.add(m); Dive.shafts.push(m); }
  // 泡泡（往上飄）
  { const N = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); for (let i = 0; i < N; i++){ pos[i * 3] = X + (rnd() - 0.5) * R * 2; pos[i * 3 + 1] = Y + rnd() * DIVE.top; pos[i * 3 + 2] = Z + (rnd() - 0.5) * R * 2; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const b = new THREE.Points(geo, new THREE.PointsMaterial({ color:'#e8fbff', size:0.12, transparent:true, opacity:0.7, depthWrite:false })); b.frustumCulled = false; g.add(b); Dive.bubbles = b; }
  // 魚群（同一種魚一起游）
  const SP = siteSpecies(Dive.site || 'reef'), inst = SP.filter(f => FISH_STYLE[f.id] && !BIG_FISH.has(f.id) && f.rarity === '常見');
  Dive.schools = [];
  const lowQ = Quality.tier === 'low', nS = Math.min(S.lush ? 7 : 5, inst.length); const pool = inst.slice().sort(() => rnd() - 0.5);
  for (let s = 0; s < nS; s++){ const f = pool[s], st = FISH_STYLE[f.id], n = S.lush ? Math.round((16 + Math.floor(rnd() * 9)) * (lowQ ? 0.7 : 1)) : 14 + Math.floor(rnd() * 10), ims = [];
    for (const part of Object.keys(FISH_MESH[st.shape])){ const im = new THREE.InstancedMesh(fishGeo(st.shape, part), fishMat(f.id, part, st.c[part] || f.color, st.glow, st.move, st.shape), n); im.frustumCulled = false; g.add(im); ims.push(im); }
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * (R * 0.55);
    Dive.schools.push({ f, ims, n, zk: /^Fish/.test(st.shape) ? 1.5 : 1, cx: X + Math.cos(a) * r * 0.4, cz: Z + Math.sin(a) * r * 0.4, rad: 4 + rnd() * 7, y: 1.5 + rnd() * 6, sp: (0.08 + rnd() * 0.1) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6, off: Array.from({ length: n }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 6]), pos: new THREE.Vector3() }); }
  // 一大團銀色的小魚（餌球），繞著圈圈游
  if (S.lush){ const small = inst.filter(f => f.max < 1.5).sort((a, b) => a.max - b.max)[0] || pool[0];
    if (small){ const st = FISH_STYLE[small.id], n = lowQ ? 40 : 60, ims = []; for (const part of Object.keys(FISH_MESH[st.shape])){ const im = new THREE.InstancedMesh(fishGeo(st.shape, part), fishMat(small.id, part, st.c[part] || small.color, st.glow, st.move, st.shape), n); im.frustumCulled = false; g.add(im); ims.push(im); }
      Dive.schools.push({ f: small, ims, n, ball: true, zk: 1, cx: X - 4, cz: Z + 3, rad: 3, y: 5, sp: 0.05, ph: 0, off: Array.from({ length: n }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 6.28]), pos: new THREE.Vector3() }); } }
  // 單獨游的魚（稀有魚比較多，傳說魚偶爾出現）
  Dive.fish = [];
  const solo = SP.filter(f => f.rarity !== '常見' || !FISH_STYLE[f.id]); const pickSolo = [];
  for (const f of solo){ if (f.rs){ pickSolo.unshift(f); continue; } if (f.of){ if (rnd() < (f.w || 0.02) * 1.5) pickSolo.unshift(f); continue; } if (rnd() < (f.rarity === '傳說' ? S.legendP : 0.75)) pickSolo.push(f); }   /* 變種很少見：每次潛水大約 1～3% 會遇到一種 */   /* 紅鯊只有在 offshoreDiveFish 抽中時才會在清單裡 */
  for (const f of pickSolo.slice(0, 9)){ let m; try { m = fishModel(f, clamp(0.45 + Math.log10(1 + (f.min + f.max) / 2) * 0.95, 0.5, 7)); } catch(e){ continue; }   /* 照真實的大小：沙丁魚小小的、鯨魚很大 */
    const bottom = ['crab', 'flounder', 'stingray', 'octopus', 'lobster', 'seahorse'].includes(f.id) || /crab|lobster|octo/.test(f.id);
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * R * 0.7; const o = { f, m, bottom, cx: X + Math.cos(a) * r * 0.5, cz: Z + Math.sin(a) * r * 0.5, rad: bottom ? 1.5 + rnd() * 2 : 5 + rnd() * 9, y: bottom ? 0.25 : 2 + rnd() * 8, sp: (bottom ? 0.08 : 0.06 + rnd() * 0.08) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6, pos: new THREE.Vector3() };
    g.add(m); Dive.fish.push(o); }
  Dive.aiOn = false; try { faiDiveInit(); } catch(e){ console.warn('fishAI dive', e); Dive.aiOn = false; }   /* 魚的 AI；出錯的話用原本繞圈圈的游法 */
  // 貝殼和寶箱
  Dive.loot = [];
  for (let i = 0; i < S.shells; i++){ const [x, y, z] = onBed(), sh = new THREE.Group(), c = ['#ffe3d3', '#f5c6a5', '#fff4e0', '#ffc1cc'][i % 4];
    const s1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 9), mat(c, 0.4)); s1.rotation.z = Math.PI / 2.4; sh.add(s1);
    const s2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.05, 6, 10), mat(c, 0.4)); s2.position.x = -0.1; sh.add(s2);
    sh.position.set(x, y + 0.08, z); sh.rotation.y = rnd() * 6; g.add(sh); Dive.loot.push({ kind:'shell', x, y, z, m: sh }); }
  // 珍珠貝（洞穴）：打開的貝殼裡有一顆發光的珍珠
  for (let i = 0; i < S.pearls; i++){ const [x, y, z] = onBed(), cl = new THREE.Group(), sm = mat('#c9b8d8', 0.4);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), sm); lo.scale.y = 0.35; cl.add(lo);
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), sm); up.scale.y = 0.35; up.position.set(0, 0.02, -0.2); up.rotation.x = -0.9; cl.add(up);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat('#ffffff', 0.15, { emissive:'#fff2d8', emissiveIntensity:0.9 })); pearl.position.y = 0.06; cl.add(pearl);
    cl.position.set(x, y + 0.05, z); cl.rotation.y = rnd() * 6; g.add(cl); Dive.loot.push({ kind:'pearl', x, y, z, m: cl, pearl }); }
  for (const pChest of S.chests) if (rnd() < pChest){ const near = rnd() < (S.big ? 0.85 : 0.6), x = near ? Dive.wreck.x - 2.5 * (S.big ? 1.6 : 1) + (rnd() - 0.5) * 4 : onBed()[0], z = near ? Dive.wreck.z + 2.8 * (S.big ? 1.6 : 1) + (rnd() - 0.5) * 4 : onBed()[2], y = diveBed(x, z), ch = new THREE.Group();
    ch.add(box([0.9, 0.5, 0.6], '#8c5d3b', [0, 0.25, 0])); const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); lid.add(box([0.92, 0.22, 0.62], '#a8713f', [0, 0.11, 0.3])); ch.add(lid);
    for (const bx of [-0.3, 0.3]) ch.add(box([0.08, 0.74, 0.64], '#e8b730', [bx, 0.37, 0], mat('#e8b730', 0.3, { metalness:0.6 })));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color:'#ffe27a', transparent:true, opacity:0.0 })); glow.position.y = 0.55; ch.add(glow);
    ch.position.set(x, y, z); ch.rotation.y = rnd() * 6; g.add(ch); Dive.loot.push({ kind:'chest', x, y, z, m: ch, lid, glow }); }
  g.traverse(o => { if (o.isMesh || o.isInstancedMesh){ o.castShadow = false; o.receiveShadow = false; } });
}
// 海底的光紋（陽光穿過水面）：會接起來的格子圖，越靠近兩個點中間的地方越亮
let CAUSTIC = null;
function causticTex(){ if (CAUSTIC) return CAUSTIC; const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), im = c.createImageData(N, N), r = mulberry(7), P = [];
  for (let i = 0; i < 26; i++) P.push([r() * N, r() * N]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ let d1 = 1e9, d2 = 1e9; for (const [px, py] of P){ let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); const d = dx * dx + dy * dy; if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.sqrt(d2) - Math.sqrt(d1), v = Math.max(0, 1 - e / 2.2), b = Math.round(255 * Math.pow(v, 2.2)), k = (y * N + x) * 4; im.data[k] = b * 0.85; im.data[k + 1] = b; im.data[k + 2] = b; im.data[k + 3] = 255; }
  c.putImageData(im, 0, 0); CAUSTIC = new THREE.CanvasTexture(cv); CAUSTIC.wrapS = CAUSTIC.wrapT = THREE.RepeatWrapping; return CAUSTIC; }
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function startDive(site, back){
  site = DIVE_SITES[site] ? site : 'reef'; Dive.back = back || null;   /* back：從岸邊下水的話，浮上來回到這裡 */
  if (Dive.on) return; if (!hasDive('dive_suit')){ toast('要先買潛水裝備才能潛水（商店的「🤿潛水」分頁）'); return; }
  if (!diveSiteOk(site)){ toast(`${DIVE_SITES[site].name}要先買：${DIVE_SITES[site].need.filter(id => !hasDive(id)).map(id => DIVE_BY_ID[id].name).join('、')}`); return; }
  Dive.site = site; Dive.ret = myBoat && Ferry.on ? { x: me.pos.x, z: me.pos.z, label: Ferry.label || '外海' } : null;
  Dive.boat = myBoat && !Ferry.on ? myBoat : null;   /* 自己划的小船：船留在原地，浮上來直接回到船上 */
  if (site === 'offshore' && !Dive.ret && !Dive.boat){ toast('要在外海的船上才能從這裡潛水'); return; }
  closeSheet(); if (F.phase !== 'idle') cancelFishing(); if (mySeat) standUp();
  if (Dive.boat){ Dive.back = { x: myBoat.m.position.x, z: myBoat.m.position.z }; myBoat = null; me.sitting = false; } else if (myBoat) leaveFerry(true);
  const fx = $('#fadeFx'); fx.classList.add('on'); SFX.plop();
  setTimeout(() => {
    buildDive(); diveHideWorld(true); Dive.on = true; Dive.o2max = diveO2(); Dive.o2 = Dive.o2max; Dive.warned = 0; Dive.seen = new Set(); Dive.startAt = now();
    me.pos.x = DIVE.x - 4; me.pos.z = DIVE.z + DIVE.r * 0.45; me.baseY = DIVE.y + DIVE.top - 2.5; Jump.gy = me.baseY; Jump.air = 0; me.rot = Math.PI; cam.yaw = 0; cam.pitch = 0.35; Dive.savedDist = cam.dist; cam.dist = 5.5;
    me.setSwim(true); renderDiveHud(); pushPresence(true); setTimeout(() => fx.classList.remove('on'), 120);
    flash(`${DIVE_SITES[site].icon} ${DIVE_SITES[site].name}・氧氣 ${Dive.o2max} 秒`, 1.6);
  }, 380);
}
function endDive(reason, instant){
  if (!Dive.on || Dive.ending) return; Dive.ending = true; const fx = $('#fadeFx');
  const done = () => {
    Dive.ending = false;
    Dive.on = false; Dive.up = Dive.down = false;
    if (Dive.group){ Dive.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); scene.remove(Dive.group); Dive.group = null; }
    Dive.fish = []; Dive.schools = []; Dive.loot = []; Dive.kelp = null; diveShowWorld();
    me.setSwim(false); const [fx0, fz0] = Dive.back ? [Dive.back.x, Dive.back.z] : freeSpot(FERRY.at[0] - 1.2, FERRY.at[1] + 0.8); Dive.back = null; me.pos.x = fx0; me.pos.z = fz0; me.baseY = groundHeight(fx0, fz0); Jump.gy = me.baseY; me.rot = -Math.PI / 2; cam.yaw = me.rot + Math.PI; if (Dive.savedDist) cam.dist = Dive.savedDist;
    renderDiveHud(); pushPresence(true); if (!instant) setTimeout(() => fx.classList.remove('on'), 120);
    const n = Dive.seen.size; if (!instant) toast(`${reason || '🤿 浮上水面了'}${n ? `　這次看到 ${n} 種魚` : ''}`);
    if (Dive.boat){ const bt = Dive.boat; Dive.boat = null; myBoat = bt; me.pos.x = bt.m.position.x; me.pos.z = bt.m.position.z; me.rot = bt.m.rotation.y; me.sitting = true; cam.yaw = me.rot + Math.PI; pushPresence(true); }
    const onBoat = !!(Dive.ret || myBoat); if (Dive.ret){ const r = Dive.ret; Dive.ret = null; ferryTo(r.x, r.z, r.label); }
    if (Dive.site === 'offshore' && onBoat){ const it = intelAt(Date.now()); Intel.seenW = it.w; Intel.ids = it.ids;
      setTimeout(() => { ticker(`🐟 外海魚情：<b>${it.ids.map(id => esc(FISH_BY_ID[id].name)).join('、')}</b> 正在這一帶活動，接下來 ${Math.max(1, Math.ceil((it.end - Date.now()) / 60000))} 分鐘比較容易上鉤`); }, 900); }
  };
  if (instant){ done(); return; }
  fx.classList.add('on'); setTimeout(done, 380);
}
function diveTargets(){
  const out = []; for (const s of Dive.schools) out.push({ f: s.f, p: s.pos }); for (const o of Dive.fish) out.push({ f: o.f, p: o.pos }); return out;
}
// 鏡頭前面最近的魚
function diveFacing(){
  const fwd = tmpV2.set(0, 0, -1).applyQuaternion(camera.quaternion); let best = null, bd = 8;
  for (const t of diveTargets()){ const dx = t.p.x - me.pos.x, dy = t.p.y - (me.baseY + 0.5), dz = t.p.z - me.pos.z, d = Math.hypot(dx, dy, dz); if (d > bd || d < 0.3) continue;
    const cx = t.p.x - camera.position.x, cy = t.p.y - camera.position.y, cz = t.p.z - camera.position.z, cl = Math.hypot(cx, cy, cz) || 1; if ((cx * fwd.x + cy * fwd.y + cz * fwd.z) / cl < 0.72) continue; bd = d; best = t; }
  return best;
}
const tmpV2 = new THREE.Vector3();
function diveNearLoot(){ let best = null, bd = 1.8; for (const l of Dive.loot){ if (l.got) continue; const d = Math.hypot(me.pos.x - l.x, me.pos.z - l.z, (me.baseY - l.y) * 0.6); if (d < bd){ bd = d; best = l; } } return best; }
function diveAction(){
  const l = diveNearLoot(); if (l){ grabLoot(l); return; }
  const t = diveFacing(); if (t){ divePhoto(t.f); return; }
  toast('靠近魚按「📷 拍照」，靠近貝殼或寶箱可以撿起來');
}
function divePhoto(f){
  rec.photos = rec.photos || []; const isNew = !rec.photos.includes(f.id);
  const fl = $('#fadeFx'); fl.classList.add('flashw'); setTimeout(() => fl.classList.remove('flashw'), 160); SFX.chat();
  if (isNew){ rec.photos.push(f.id); saveRecLocal(); cloudCall('add_photo', { p_fish: f.id }); flash(`📸 拍到了${f.name}！水下圖鑑 ${rec.photos.length}/${diveSpecies().length}`, 1.8); }
  else flash(`📸 ${f.name}（已經拍過了）`, 1.2);
}
const LOOT_TXT = { chest:'🎁 寶箱裡有', shell:'🐚 撿到貝殼，賣了', pearl:'🦪 撿到珍珠，賣了' }, LOOT_FULL = { chest:'🎁 今天的寶箱開夠了（每天 6 個）', shell:'🐚 今天的貝殼撿夠了（每天 40 個）', pearl:'🦪 今天的珍珠撿夠了（每天 15 顆）' };
async function grabLoot(l){
  l.got = true; SFX.catch();
  if (l.kind === 'shell'){ l.m.visible = false; } else if (l.kind === 'pearl'){ l.pearl.visible = false; } else { l.open = now(); }
  if (Cloud.on){ const before = rec.coins, row = await cloudCall('dive_loot', { p_kind: l.kind, p_site: Dive.site || 'reef' }); if (!row) return; const got = (Number(row.coins) || 0) - before;
    flash(got > 0 ? `${LOOT_TXT[l.kind]} 🪙${got}！` : LOOT_FULL[l.kind], 1.6); return; }
  const got = l.kind === 'chest' ? (Dive.site === 'wreck' ? 300 : Dive.site === 'cave' ? 400 : 150) + Math.floor(Math.random() * 200) : l.kind === 'pearl' ? 80 + Math.floor(Math.random() * 81) : 5 + Math.floor(Math.random() * 16); addCoins(got); flash(`${LOOT_TXT[l.kind]} 🪙${got}！`, 1.6);
}
function updateDiveSwim(dt, ix, iz, L){
  if (Dive.ending) return;
  const fins = hasDive('dive_fins') ? 1.35 : 1;
  let speed = 0;
  if (L > 0.08){ const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix, ml = Math.hypot(mx, mz) || 1;
    speed = 3.1 * fins * Math.min(1, L); let nx = me.pos.x + mx / ml * speed * dt, nz = me.pos.z + mz / ml * speed * dt;
    const d = Math.hypot(nx - DIVE.x, nz - DIVE.z); if (d > DIVE.r){ nx = DIVE.x + (nx - DIVE.x) / d * DIVE.r; nz = DIVE.z + (nz - DIVE.z) / d * DIVE.r; }
    me.pos.x = nx; me.pos.z = nz; me.rot = lerpAngle(me.rot, Math.atan2(mx, mz), 1 - Math.exp(-6 * dt)); }
  const up = (Dive.up || keys.Space || keys.KeyE) ? 1 : 0, dn = (Dive.down || keys.KeyC || keys.KeyQ) ? 1 : 0;
  let y = me.baseY + (up - dn) * 2.4 * fins * dt - 0.08 * dt;
  y = clamp(y, diveBed(me.pos.x, me.pos.z) + 0.25, DIVE.y + DIVE.top - 1.0); me.baseY = y; Jump.gy = y; Jump.air = 0;
  me.speed += (Math.max(speed, (up || dn) ? 1.6 : 0) - me.speed) * Math.min(1, dt * 6); me.swimPitch = speed > 0.3 ? 1.25 : up ? 0.5 : 0.3;
  /* 游到水面附近：按著上浮一下下就上去；停在水面不動 1.5 秒也會自己浮出去 */
  if (y >= DIVE.y + DIVE.top - 1.7 && !dn && now() - Dive.startAt > 2){ Dive.surfHold = (Dive.surfHold || 0) + dt * (up ? 2.5 : 1); if (Dive.surfHold > 1.5){ Dive.surfHold = 0; endDive(); } } else Dive.surfHold = 0;
}
function updateDive(dt, t){
  if (!Dive.on || !Dive.group) return;
  // 氧氣
  if (Dive.ending) return; Dive.o2 -= dt; const o = Dive.o2;
  if (o < 15 && Dive.warned < 1){ Dive.warned = 1; flash('⚠️ 氧氣只剩 15 秒，快上去！', 1.6); SFX.bite(); }
  if (o <= 0 && !Dive.ending){ endDive('😮‍💨 氧氣用完了，自動浮上水面'); return; }
  // 海帶
  if (Dive.kelp && frameNo % 2 === 0){ const { im, list } = Dive.kelp, cur = faiCurrent(); for (let i = 0; i < list.length; i++){ const k = list[i]; tankDummy.position.set(k.x, k.y, k.z); tankDummy.rotation.set(Math.sin(t * 0.9 + k.ph) * 0.12 * (0.6 + cur.sp) + cur.lz, k.ry, Math.cos(t * 0.7 + k.ph) * 0.1 * (0.6 + cur.sp) - cur.lx); tankDummy.scale.set(1, k.s, 1); tankDummy.updateMatrix(); im.setMatrixAt(i, tankDummy.matrix); } im.instanceMatrix.needsUpdate = true; }
  // 魚群、單獨的魚：海洋生態 AI（faiDiveUpdate）；出錯的話用原本繞圈圈的游法
  if (Dive.aiOn){ try { faiDiveUpdate(dt, t); } catch(e){ console.warn('fishAI dive', e); Dive.aiOn = false; } }
  if (!Dive.aiOn){
  // 魚群
  for (const s of Dive.schools){ const a = t * s.sp + s.ph, cx = s.cx + Math.cos(a) * s.rad, cz = s.cz + Math.sin(a) * s.rad, cy = Math.max(diveBed(cx, cz) + s.y + Math.sin(t * 0.3 + s.ph) * 0.8, rockLift(cx, cz, 2.2)); s.pos.set(cx, cy, cz);
    const hd = Math.atan2(-Math.cos(a) * Math.sign(s.sp), -Math.sin(a) * Math.sign(s.sp));
    if (s.ball){ for (let i = 0; i < s.n; i++){ const q = s.off[i], rr = 0.8 + Math.abs(q[0]) * 1.5, an = t * (0.7 + Math.abs(q[2]) * 0.4) + q[3]; tankDummy.position.set(cx + Math.cos(an) * rr, cy + q[1] * 1.3, cz + Math.sin(an) * rr); tankDummy.rotation.set(0, -an, 0); tankDummy.scale.set(0.45, 0.45, 0.45); tankDummy.updateMatrix(); for (const im of s.ims) im.setMatrixAt(i, tankDummy.matrix); } for (const im of s.ims) im.instanceMatrix.needsUpdate = true; continue; }
    for (let i = 0; i < s.n; i++){ const q = s.off[i], w = t * 2 + q[3]; tankDummy.position.set(cx + q[0] * 1.6 + Math.sin(w) * 0.15, cy + q[1] * 0.7, cz + q[2] * 1.6 + Math.cos(w) * 0.15); tankDummy.rotation.set(0, hd + Math.sin(w * 0.7) * 0.15, 0); tankDummy.scale.set(0.55, 0.55, 0.55 * s.zk); tankDummy.updateMatrix(); for (const im of s.ims) im.setMatrixAt(i, tankDummy.matrix); }
    for (const im of s.ims) im.instanceMatrix.needsUpdate = true;
    // 靠太近會散開一點
    const d = Math.hypot(me.pos.x - cx, me.pos.z - cz); if (d < 3) s.ph += dt * 0.25 * Math.sign(s.sp); }
  for (const f of Dive.fish){ const a = t * f.sp + f.ph, x = f.cx + Math.cos(a) * f.rad, z = f.cz + Math.sin(a) * f.rad, y0 = diveBed(x, z) + f.y + (f.bottom ? 0 : Math.sin(t * 0.4 + f.ph) * 0.6), y = Math.max(y0, rockLift(x, z, f.bottom ? 0.1 : 0.7)); f.pos.set(x, y, z); f.m.position.copy(f.pos);
    f.m.rotation.y = Math.atan2(-Math.cos(a) * Math.sign(f.sp), -Math.sin(a) * Math.sign(f.sp)); if (f.m.userData.tail) f.m.userData.tail.rotation.y = Math.sin(t * 6 + f.ph) * 0.35; }
  }
  // 看到的魚記下來
  if (frameNo % 20 === 0) for (const tg of diveTargets()) if (Math.hypot(tg.p.x - me.pos.x, tg.p.y - me.baseY, tg.p.z - me.pos.z) < 9) Dive.seen.add(tg.f.id);
  // 泡泡、光束、水面
  if (Dive.bubbles){ const p = Dive.bubbles.geometry.attributes.position, a = p.array; for (let i = 0; i < a.length; i += 3){ a[i + 1] += dt * (0.6 + (i % 7) * 0.08); a[i] += Math.sin(t * 2 + i) * dt * 0.05; if (a[i + 1] > DIVE.y + DIVE.top) a[i + 1] = diveBed(a[i], a[i + 2]); } p.needsUpdate = true; }
  if (Math.random() < dt * 3) { const a = Dive.bubbles.geometry.attributes.position.array, k = Math.floor(Math.random() * a.length / 3) * 3; a[k] = me.pos.x + (Math.random() - 0.5) * 0.3; a[k + 1] = me.baseY + 1.2; a[k + 2] = me.pos.z + (Math.random() - 0.5) * 0.3; }
  { const lush = (DIVE_SITES[Dive.site] || {}).lush; Dive.shafts.forEach((m, i) => { m.material.opacity = ((lush ? 0.05 : 0.022) + (lush ? 0.03 : 0.016) * Math.sin(t * 0.6 + i * 1.7)) * (DayNight.period === 'night' ? 0.3 : 1); if (lush) m.rotation.z = 0.18 + Math.sin(t * 0.25 + i) * 0.05; }); }
  if (Dive.caustic){ const o = Dive.caustic.material.map.offset; o.x = (o.x + dt * 0.013) % 1; o.y = (o.y + dt * 0.008) % 1; Dive.caustic.material.opacity = (0.2 + Math.sin(t * 0.8) * 0.05) * (DayNight.period === 'night' ? 0.25 : 1); }
  if (Dive.surface) Dive.surface.material.opacity = 0.42 + Math.sin(t * 1.3) * 0.08;
  for (const l of Dive.loot){ if (l.kind === 'shell' && !l.got){ l.m.position.y = l.y + 0.08 + Math.sin(t * 2 + l.x) * 0.02; }
    if (l.kind === 'chest'){ const k = l.open ? clamp((now() - l.open) / 0.8, 0, 1) : 0; l.lid.rotation.x = -k * 1.6; l.glow.material.opacity = l.got ? 0 : 0.25 + Math.sin(t * 3) * 0.15; } }
  renderDiveHud(true);
}
// 水下的時候把上面的世界整個藏起來（比較順，也不會從水裡看到陸地）
function diveKeep(){ const k = new Set([Dive.group, me.av.g, me.bob, me.line, me.blob]); for (const p of peers.values()){ const f = p.fisher; k.add(f.av.g); k.add(f.bob); k.add(f.line); if (f.blob) k.add(f.blob); } return k; }
function diveHideWorld(start){
  const keep = diveKeep();
  if (start){ Dive.restore = scene.children.filter(o => o.visible && !o.isLight && !keep.has(o)); }
  for (const o of scene.children) if (o.visible && !o.isLight && !keep.has(o)) o.visible = false;
}
function diveShowWorld(){ for (const o of Dive.restore || []) o.visible = true; Dive.restore = null; }
function diveEnvFx(){
  // 水下的顏色和霧
  const S = DIVE_SITES[Dive.site] || DIVE_SITES.reef, light = hasDive('dive_light'), dark = DayNight.period === 'night' && !light;
  scene.fog.color.set(dark ? '#06223a' : S.fog); scene.fog.near = 2.5; scene.fog.far = dark ? 16 : S.far;
  hemi.color.set(S.cave ? '#8fd8ff' : '#9fe6ff'); hemi.groundColor.set(S.cave ? '#1a2a3a' : '#2b6f8f'); hemi.intensity = Math.max(hemi.intensity * (S.big ? 0.8 : 1), light ? (S.cave ? 1.35 : 1.0) : 0.45); sun.color.set('#d8f6ff'); if (S.cave) sun.intensity *= 0.35; else if (S.big) sun.intensity *= 0.7;
}
function renderDiveHud(tick){
  let h = $('#diveHud');
  if (!Dive.on){ if (h) h.hidden = true; const dn = $('#diveDn'); if (dn) dn.hidden = true; const jb = $('#jumpBtn'); if (jb && jb.dataset.dive){ jb.textContent = '跳'; delete jb.dataset.dive; } return; }
  if (!h){ h = document.createElement('div'); h.id = 'diveHud'; h.className = 'panel'; h.innerHTML = '<div class="o2"><span>O₂</span><div class="bar"><i></i></div><b></b></div><div class="dmeta"></div><button class="tbtn ghost" id="diveBait">🍞 撒餌</button><button class="tbtn ghost" id="diveUp">⬆ 上岸</button>'; h.querySelector('#diveBait').addEventListener('click', () => { try { faiDiveBait(); } catch(e){ console.warn(e); } }); document.body.appendChild(h);
    h.querySelector('#diveUp').addEventListener('click', () => endDive()); }
  if (!$('#diveDn')){ const b = document.createElement('button'); b.id = 'diveDn'; b.className = 'panel'; b.setAttribute('aria-label', '下潛'); b.textContent = '⬇'; $('#jumpBtn').before(b);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Dive.down = true; b.classList.add('down'); }); const off = () => { Dive.down = false; b.classList.remove('down'); }; b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); b.addEventListener('contextmenu', e => e.preventDefault()); }
  const jb = $('#jumpBtn'); if (!jb.dataset.dive){ jb.dataset.dive = '1'; jb.textContent = '⬆'; }
  h.hidden = false; $('#diveDn').hidden = false;
  const k = clamp(Dive.o2 / Dive.o2max, 0, 1), bar = h.querySelector('.bar i'); bar.style.width = (k * 100).toFixed(1) + '%'; bar.className = k < 0.25 ? 'low' : '';
  const s = Math.max(0, Math.ceil(Dive.o2)) + ' 秒'; const b = h.querySelector('.o2 b'); if (b.textContent !== s) b.textContent = s;
  const depth = Math.max(0, DIVE.y + DIVE.top - me.baseY), meta = `深度 ${depth.toFixed(1)}m・看到 ${Dive.seen.size} 種・📸 ${(rec.photos || []).length}/${diveSpecies().length}`; const mm = h.querySelector('.dmeta'); if (mm.textContent !== meta) mm.textContent = meta;
}
// 潛水用品（商店「🤿潛水」分頁）
function buyDive(id){
  const g = DIVE_BY_ID[id]; if (!g || hasDive(id)) return; if (g.need && !hasDive(g.need)){ toast(`要先買「${DIVE_BY_ID[g.need].name}」`); return; }
  if (rec.coins < g.price){ toast(`金幣不夠，還差 🪙${(g.price - rec.coins).toLocaleString()}`); return; }
  rec.dive = (rec.dive || []).concat(id); addCoins(-g.price); saveRecLocal(); cloudCall('buy_dive', { p_item: id }); SFX.catch(); flash(`${g.icon} 買了${g.name}！`, 1.4); renderTab();
}
function renderDiveShop(body){
  body.appendChild(el('p', 'sub', '潛水是進階玩法：買了潛水裝備組，就可以到港口找船夫阿海「🤿 去潛水」。水裡有珊瑚礁、沉船和魚群，可以拍照登錄「水下圖鑑」、撿貝殼和寶箱換金幣。氧氣用完會自動浮上來，升級氧氣瓶就能潛得更久。'));
  const ul = el('ul', 'shoplist');
  for (const g of DIVE_GEAR){ const own = hasDive(g.id), lock = g.need && !hasDive(g.need), li = el('li', own ? 'on' : ''); li.appendChild(el('span', 'dishic', g.icon));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', g.name)); d.appendChild(el('div', 'meta', g.desc + (lock ? `（要先買「${DIVE_BY_ID[g.need].name}」）` : ''))); li.appendChild(d);
    const b = el('button', 'tbtn' + (own || lock ? ' ghost' : ''), own ? '已擁有' : `買 🪙${g.price.toLocaleString()}`); b.disabled = own || lock; b.addEventListener('click', () => buyDive(g.id)); li.appendChild(b); ul.appendChild(li); }
  body.appendChild(ul);
}
const QUEST_NPC = {
  chief: { name:'村長 阿土伯', at:[7.2, 1.2], shirt:'#8c5d3b', hat:'#f6f0dd', gear:{ hat:'hat_bucket', acc:'acc_glasses', face:'face_happy' } },
  wang:  { name:'漁夫 老王',   at:[29.5, -23.2], shirt:'#2f6fb5', hat:'#ffd36a', gear:{ hat:'hat_bucket', top:'top_vest', shoes:'shoes_rain', back:'back_basket' } },
  mei:   { name:'食堂 美雲姨', at:[10.4, 11.2], shirt:'#f5a5d8', hat:'#ffffff', gear:{ hat:'hat_chef', top:'top_apron' } },
};
// 任務 NPC 走近時也會講話：村長多講新手教學，老王講釣法，美雲姨講料理
const QUEST_TALK = {
  chief: ['這個村子才剛開始蓋，遊戲還一直在更新喔！遇到 Bug 或怪怪的地方，記得跟作者講一聲', '遊戲還在一點一點做，常常會有新東西，有 Bug 就告訴作者，大家一起把村子變更好', '想改名字的話，去「造型」分頁就能換喔', '有些魚不在圖鑑裡喔，像變種，要親手釣到才會出現', '圖鑑裡黑黑的影子，就是你還沒釣過的魚', '按住「拋竿」蓄力，放開就拋出去，拋越遠越容易遇到大魚', '浮標整個沉下去就是魚咬了，趕快收線', '拉線的時候張力條快滿了就先放開一下，不然線會斷', '打開「地圖」，去過的地方都能直接傳送', '每天來找我、老王、美雲姨領任務，頭上有 ❗ 的就是還沒做完', '魚缸裡的魚按「展示」，就會放進廣場東邊的大水族館', '小島可以蓋自己的房子，還能邀請朋友一起住', '用 Email 綁定帳號，換手機紀錄也不會不見（在「造型」分頁）', '在聊天框說話，旁邊的村民會回你喔'],
  wang: ['港口外海有大魚，用磯釣竿最好', '漲潮的時候海邊的魚咬得比較快', '暴風雨的時候外海傳說魚多很多', '船夫阿海可以載你出海，也可以帶你去潛水', '魚太小就放流吧，愛海點數比較多'],
  mei: ['釣到的魚可以拿來食堂做料理，吃了釣魚會有加成', '客人頭上有 🔔 就是想點餐了，快來幫忙', '新鮮的魚最好吃，越大條越值錢'],
};
const questNpcs = []; let Quests = { list:null, at:0, loading:false }, questWho = null;
function freeSpot(x, z){ for (let r = 0; r < 6; r += 0.5) for (let a = 0; a < 6.28; a += 0.6){ const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (walkable(px, pz) && !blocked(px, pz, 0.45) && !deckAt(px, pz)) return [px, pz]; } return [x, z]; }
function initQuestNpcs(){
  for (const [who, d] of Object.entries(QUEST_NPC)){
    const [x, z] = freeSpot(d.at[0], d.at[1]), f = new Fisher({ shirt:d.shirt, hat:d.hat, name:d.name, kind:'npc' });
    f.pos.set(x, 0, z); f.baseY = groundHeight(x, z); f.rot = Math.atan2(MAP.plaza[0] - x, MAP.plaza[1] - z); f.setGear(d.gear); f.nm.classList.add('quest');
    f.lines = QUEST_TALK[who] || []; if (who === 'chief') f.wid = 'chief'; questNpcs.push({ who, name:d.name, f });
  }
}
function updateQuestNpcs(dt, t){
  if (!questNpcs.length) initQuestNpcs();
  for (const q of questNpcs){
    const d = Math.hypot(me.pos.x - q.f.pos.x, me.pos.z - q.f.pos.z);
    const wd = worldDrive(q.f, dt, t);
    if (wd){}
    else if (d < 40){ q.f.av.g.visible = !onIsle; if (d < 6) q.f.rot = lerpAngle(q.f.rot, Math.atan2(me.pos.x - q.f.pos.x, me.pos.z - q.f.pos.z), 1 - Math.exp(-3 * dt)); q.f.update(dt, t); q.f.placeTag(); }
    else q.f.tag.style.display = 'none';
    const qs = Quests.list && Quests.list.find(x => x.who === q.who), mark = !Cloud.on ? '' : !qs ? '' : qs.done ? '✔️' : '❗';
    if (!wd && d < 7 && t > (q.talkAt || 0) && !(q.f.replyUntil > now())){ q.talkAt = t + rand(14, 24); const L = q.f.lines; if (L.length){ const ML = q.f.wid && Math.random() < 0.3 ? worldMemLines(q.f) : []; q.f.say(ML.length ? ML[Math.floor(Math.random() * ML.length)] : L[Math.floor(Math.random() * L.length)], '', 6); q.mark = null; q.talkUntil = now() + 6.2; } }   /* 走近會講話，講完再把 ❗ 放回去 */
    else if (d > 14) q.talkAt = Math.min(q.talkAt || 0, t + 3);
    if (q.mark !== mark && !(q.talkUntil > now()) && !(q.f.replyUntil > now())){ q.mark = mark; if (mark) q.f.say(mark, mark === '❗' ? 'alert' : 'emote', 99999); else q.f.bub.hidden = true; }
  }
  if (Cloud.on && !Quests.loading && (!Quests.list || Date.now() - Quests.at > 10 * 60 * 1000)) loadQuests();
}
async function loadQuests(){
  if (!Cloud.sb || !Cloud.on || Quests.loading) return; Quests.loading = true;
  try { const { data, error } = await Cloud.sb.rpc('get_quests'); if (!error && Array.isArray(data)){ Quests.list = data; Quests.at = Date.now(); if (!$('#sheet').hidden && curTab === 'quest') renderTab(); } } catch(e){}
  Quests.loading = false;
}
function questText(q){
  if (q.kind === 'dish'){ const rc = RECIPES[q.target]; return `幫我做 ${q.n} 份 ${rc ? rc.icon + ' ' + rc.name : q.target}，客人一直點，我忙不過來了！`; }
  const f = FISH_BY_ID[q.target], nm = f ? f.name : q.target;
  return Number(q.minw) > 0 ? `我在找一條 ${Number(q.minw)} 公斤以上的「${nm}」，拜託你了！` : `可以幫我釣 ${q.n} 條「${nm}」嗎？我想煮一大鍋魚湯。`;
}
function questItems(q){
  if (q.kind === 'dish') return rec.dishes.filter(d => d.r === q.target).sort((a, b) => a.q - b.q).slice(0, q.n);
  const locked = new Set(rec.show || []);
  return rec.tank.filter(x => !locked.has(x.t) && x.f === q.target && x.w >= Number(q.minw)).sort((a, b) => a.w - b.w).slice(0, q.n);
}
function completeQuest(q){
  const items = questItems(q); if (items.length < q.n || q.done) return; const ts = items.map(x => x.t), set = new Set(ts);
  if (q.kind === 'dish') rec.dishes = rec.dishes.filter(d => !set.has(d.t)); else { rec.tank = rec.tank.filter(x => !set.has(x.t)); buildTank(); }
  rec.earned += q.reward; addCoins(q.reward); saveRecLocal(); q.done = true;
  cloudCall('complete_quest', { p_idx: q.i, p_ts: ts }); setTimeout(loadQuests, 1500);
  SFX.catch(); flash(`📜 任務完成！+${q.reward} 金幣`, 1.6); const npc = questNpcs.find(n => n.who === q.who); if (npc){ npc.f.say('謝謝你！😄', 'emote', 3); npc.mark = null; FX.emit(npc.f.pos.x, 2, npc.f.pos.z, 18, '#ffd36a', 1, 2, 1); }
  renderTab();
}
function renderQuests(body){
  body.appendChild(el('div', 'shophead')).innerHTML = `<b>📜 今天的任務</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`;
  if (!Cloud.on){ body.appendChild(el('p', 'sub', '任務要連上雲端才能接，等一下再試試看。')); return; }
  if (!Quests.list){ body.appendChild(el('p', 'sub', '讀取中…')); loadQuests(); return; }
  body.appendChild(el('p', 'sub', '村子裡的人每天會有新的請求（台灣時間半夜 12 點換）。走到他們旁邊，或在這裡交付都可以。'));
  const ul = el('ul', 'shoplist quests');
  for (const q of Quests.list){
    const npc = QUEST_NPC[q.who], li = el('li', (q.done ? 'on ' : '') + (questWho === q.who ? 'hl' : ''));
    li.appendChild(el('span', 'dishic', q.who === 'chief' ? '👴' : q.who === 'wang' ? '🧔' : '👩‍🍳'));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', npc ? npc.name : q.who)); d.appendChild(el('div', 'qtxt', questText(q)));
    const have = questItems(q).length; d.appendChild(el('div', 'sub2', q.done ? '✔️ 完成了' : `進度 ${Math.min(have, q.n)} / ${q.n}・獎勵 🪙${q.reward}`)); li.appendChild(d);
    const acts = el('div', 'tacts');
    if (!q.done){ const b = el('button', 'tbtn' + (have >= q.n ? '' : ' ghost'), have >= q.n ? '交付' : `還差 ${q.n - have}`); b.disabled = have < q.n; b.addEventListener('click', () => completeQuest(q)); acts.appendChild(b); }
    li.appendChild(acts); ul.appendChild(li);
  }
  body.appendChild(ul);
}

/* ================= COOKING：潮汐食堂（料理與壽司）================= */
// 食譜和價格跟伺服器的 supabase/002_cooking.sql 一樣；伺服器會再檢查一次
const RECIPES = {
  saba:   { name:'鯖魚握壽司', icon:'🍣', fish:'mackerel',  need:1, value:40,  desc:'沙灘小鯖切片，配上一口醋飯。' },
  tai:    { name:'鯛魚握壽司', icon:'🍣', fish:'moonbream', need:1, value:160, desc:'月光鯛最肥美的部位，閃著淡淡的光。' },
  ayu:    { name:'鹽烤香魚',   icon:'🍢', fish:'ayu',       need:1, value:30,  desc:'整條撒鹽烤到金黃，有西瓜般的香氣。' },
  suzuki: { name:'酥炸河鱸',   icon:'🍤', fish:'perch',     need:1, value:35,  desc:'翡翠河鱸裹粉油炸，外酥內嫩。' },
  mori:   { name:'綜合壽司拼盤', icon:'🍱', fish:'*common', need:3, value:120, desc:'任選 3 條常見魚，拼成一大盤。' },
  tako:   { name:'章魚燒',     icon:'🐙', fish:'octopus',  need:1, value:110, desc:'紅石章魚切丁包進麵糊，外脆內軟，撒上滿滿柴魚片。' },
  ikayaki:{ name:'烤魷魚串',   icon:'🦑', fish:'ika',      need:1, value:60,  desc:'劍尖魷魚刷上醬油烤到捲起來，夜市的味道。' },
  sumi:   { name:'墨魚麵',     icon:'🍝', fish:'cuttle',   need:1, value:130, desc:'用墨魚自己的墨汁煮成黑黑的麵，吃完嘴巴也會黑黑的。' },
  sanbei: { name:'三杯小卷',   icon:'🥘', fish:'squid',    need:2, value:55,  desc:'兩隻透光小卷加九層塔、麻油、醬油，香到隔壁都聞得到。' },
  toro:   { name:'鮪魚大腹握壽司', icon:'🍣', fish:'tuna', need:1, value:900, desc:'黑鮪魚最肥的大腹，入口即化。整個村子最高級的一道。' },
  unadon: { name:'鰻魚飯',     icon:'🍱', fish:'eel',      need:1, value:150, desc:'月影鰻刷上甜甜的醬汁，一層層鋪在白飯上。' },
  fugu:   { name:'河豚火鍋',   icon:'🍲', fish:'puffer',   need:1, value:140, desc:'只有食堂老闆會處理的河豚，湯頭非常鮮甜。' },
  tilapia:{ name:'紅燒吳郭魚', icon:'🐟', fish:'tilapia',  need:1, value:30,  desc:'家常的紅燒口味，配白飯剛剛好。' },
  ebi:    { name:'鹽烤泰國蝦', icon:'🦐', fish:'prawn',    need:3, value:75,  desc:'釣蝦場的招牌：三隻泰國蝦撒上粗鹽，烤到紅通通、殼脆脆的。' },
};
const STAR_K = [1, 1, 1.3, 1.6];
// 吃料理的加成：接下來幾次拋竿有效（存在這台裝置）
const BUFFS = {
  saba:   { txt:'稀有魚 ×1.3',       casts:5,  rare:1.3 },
  tai:    { txt:'傳說魚 ×1.5',       casts:5,  legend:1.5 },
  ayu:    { txt:'線比較不容易斷',     casts:5,  tension:0.8 },
  suzuki: { txt:'收線快 20%',         casts:5,  reel:1.2 },
  mori:   { txt:'稀有、傳說魚 ×1.2',  casts:10, rare:1.2, legend:1.2 },
  tako:   { txt:'傳說魚 ×1.3',        casts:6,  legend:1.3 },
  ikayaki:{ txt:'稀有魚 ×1.4',        casts:5,  rare:1.4 },
  sumi:   { txt:'線很難斷',           casts:5,  tension:0.75 },
  sanbei: { txt:'收線快 30%',         casts:4,  reel:1.3 },
  toro:   { txt:'稀有 ×1.3、傳說 ×1.6', casts:8, rare:1.3, legend:1.6 },
  unadon: { txt:'收線快、線不易斷',   casts:6,  reel:1.25, tension:0.85 },
  fugu:   { txt:'傳說魚 ×1.4',        casts:6,  legend:1.4 },
  tilapia:{ txt:'稀有魚 ×1.15',       casts:6,  rare:1.15 },
  ebi:    { txt:'稀有魚 ×1.25',       casts:6,  rare:1.25 },
};
let buff = LS.get('tide.buff', null);   // { r, left }
function curBuff(){ return buff && BUFFS[buff.r] && buff.left > 0 ? Object.assign({ r:buff.r, left:buff.left }, BUFFS[buff.r]) : null; }
function eatDish(ts){
  const d = rec.dishes.find(x => x.t === ts); if (!d) return; const rc = RECIPES[d.r], bf = BUFFS[d.r];
  rec.dishes = rec.dishes.filter(x => x.t !== ts); saveRecLocal();
  buff = { r:d.r, left: bf.casts + (d.q - 1) * 2 }; LS.set('tide.buff', buff); renderBuff();   // 星星越多，效果越久
  cloudCall('eat_dish', { p_ts: ts });
  me.say('😋', 'emote', 3); SFX.catch();
  toast(`吃了 ${rc.icon} <b>${esc(rc.name)}</b>：接下來 ${buff.left} 次拋竿 ${esc(bf.txt)}`);
  renderTab();
}
function useBuffCast(){ const b = curBuff(); if (!b) return; buff.left--; if (buff.left <= 0){ buff = null; toast('料理的加成用完了'); } LS.set('tide.buff', buff); renderBuff(); }
function renderBuff(){ const c = $('#buffChip'); if (!c) return; const b = curBuff(); c.hidden = !b; if (b) c.textContent = `${RECIPES[b.r].icon}${b.left}`; c.title = b ? `${RECIPES[b.r].name}：${b.txt}（剩 ${b.left} 次）` : ''; }
function dishPrice(d){ const rc = RECIPES[d.r]; return rc ? Math.round(rc.value * STAR_K[clamp(d.q, 1, 3)]) : 0; }
// 挑食材：沒有展示、最便宜的那幾條（大魚留著）
function pickIngredients(key){
  const rc = RECIPES[key], locked = new Set(rec.show || []);
  const ok = rec.tank.filter(x => !locked.has(x.t) && (rc.fish === '*common' ? FISH_BY_ID[x.f].rarity === '常見' : x.f === rc.fish));
  ok.sort((a, b) => fishPrice(FISH_BY_ID[a.f], a.w) - fishPrice(FISH_BY_ID[b.f], b.w));
  return { have: ok.length, use: ok.slice(0, rc.need) };
}
let cookMode = 'make';
function renderCook(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🏮 潮汐食堂</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  const seg = el('div', 'seg');
  [['make', '做料理'], ['mine', `我的料理（${rec.dishes.length}）`]].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(cookMode === k)); b.addEventListener('click', () => { cookMode = k; renderTab(); }); seg.appendChild(b); });
  body.appendChild(seg);
  const ws = waitingCustomers();
  if (ws.length){
    const box = el('div', 'field orders'); box.appendChild(el('label', '', '🔔 客人點餐（端給客人多賺 50%）'));
    for (const c of ws){
      const rc = RECIPES[c.order], have = rec.dishes.filter(d => d.r === c.order).length, row = el('div', 'orow');
      row.appendChild(el('span', '', `${c.name} 想吃 ${rc.icon} ${rc.name}`));
      const b = el('button', 'tbtn', have ? '端給他' : '還沒有這道'); b.disabled = !have; b.addEventListener('click', () => serveCustomer(c)); row.appendChild(b); box.appendChild(row);
    }
    body.appendChild(box);
  }
  if (cookMode === 'make'){
    body.appendChild(el('p', 'sub', '用魚缸裡的魚做料理，賣給食堂比直接賣魚更值錢。切魚時抓準時機，星星越多越貴（★★★ ×1.6）。展示中的魚不會被拿來用。'));
    const ul = el('ul', 'shoplist cols');
    for (const [key, rc] of Object.entries(RECIPES)){
      const { have } = pickIngredients(key), can = have >= rc.need, li = el('li', can ? '' : 'dim');
      li.appendChild(el('span', 'dishic', rc.icon));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', rc.name));
      const need = rc.fish === '*common' ? `任意常見魚 ×${rc.need}` : `${FISH_BY_ID[rc.fish].name} ×${rc.need}`;
      d.appendChild(el('div', 'meta', `${need}・你有 ${have} 條・🪙${rc.value}～${Math.round(rc.value * 1.6)}`)); li.appendChild(d);
      const b = el('button', 'tbtn', can ? '開始做' : '食材不夠'); b.disabled = !can;
      b.addEventListener('click', () => startCooking(key)); li.appendChild(b); ul.appendChild(li);
    }
    body.appendChild(ul);
  } else {
    if (!rec.dishes.length){ body.appendChild(el('div', 'empty', '還沒有做好的料理。到「做料理」挑一道開始吧！')); return; }
    body.appendChild(el('p', 'sub', '可以賣給食堂、端給點餐的客人（多賺 50%），或自己吃掉：接下來幾次拋竿有加成，星星越多效果越久。' + Object.entries(BUFFS).map(([k, b]) => `${RECIPES[k].icon}${b.txt}`).join('・')));
    const total = rec.dishes.reduce((a, d) => a + dishPrice(d), 0);
    const bar = el('div', 'tankbar'); const all = el('button', 'tbtn', `全部賣給食堂（+${total}）`);
    all.addEventListener('click', () => sellDishes(rec.dishes.map(d => d.t))); bar.appendChild(all); body.appendChild(bar);
    const ul = el('ul', 'shoplist cols');
    for (const d of rec.dishes){
      const rc = RECIPES[d.r], li = el('li', ''); li.appendChild(el('span', 'dishic', rc.icon));
      const info = el('div', 'tinfo'); info.appendChild(el('div', 'n', rc.name)); info.appendChild(el('div', 'meta stars', '★'.repeat(d.q) + '☆'.repeat(3 - d.q))); li.appendChild(info);
      const acts = el('div', 'tacts');
      const b = el('button', 'tbtn', `賣 🪙${dishPrice(d)}`); b.addEventListener('click', () => sellDishes([d.t])); acts.appendChild(b);
      const e = el('button', 'tbtn ghost', '吃掉'); e.title = `${BUFFS[d.r].txt}，${BUFFS[d.r].casts + (d.q - 1) * 2} 次拋竿`; e.addEventListener('click', () => eatDish(d.t)); acts.appendChild(e);
      li.appendChild(acts); ul.appendChild(li);
    }
    body.appendChild(ul);
  }
}
function sellDishes(ts){
  const set = new Set(ts), sold = rec.dishes.filter(d => set.has(d.t)); if (!sold.length) return;
  const got = sold.reduce((a, d) => a + dishPrice(d), 0);
  rec.dishes = rec.dishes.filter(d => !set.has(d.t)); rec.earned += got; addCoins(got);
  SFX.catch(); flash(`+${got} 金幣`, 1.1); logMsg('', `你賣了 ${sold.length} 道料理，得到 ${got} 金幣`, true);
  cloudCall('sell_dish', { p_ts: ts }); renderTab();
}
// ---- 食堂客人：玩家在食堂附近時，NPC 客人會來坐下點餐，等一陣子沒吃到就離開 ----
const CUST_NAMES = ['小芸', '阿凱', '美美', '大熊', '小葵', '阿嬤', '老王', '小樹', '安安', '阿哲'];
const CUST_LOOK = [['#f5a5d8', '#ffffff'], ['#7db7d7', '#ffd36a'], ['#9fc7a8', '#f17b6d'], ['#f6a96b', '#3fbf9d'], ['#b9a4ff', '#f6f0dd']];
const ORDER_W = { saba:3, ayu:3, suzuki:3, mori:2, tai:1, ikayaki:2, sanbei:2, tilapia:2, tako:1, sumi:1, unadon:1, fugu:1 };
const customers = []; let custNext = 0;
function stallSeat(i){ return cafeSeats[i]; }
function pickOrder(){ const ks = Object.keys(ORDER_W), tot = ks.reduce((a, k) => a + ORDER_W[k], 0); let r = Math.random() * tot; for (const k of ks){ r -= ORDER_W[k]; if (r <= 0) return k; } return 'saba'; }
function spawnCustomer(t){
  const free = cafeSeats.map((_, i) => i).filter(i => !customers.some(c => c.seat === i) && cafeSeats[i] !== mySeat && !customers.some(c => Math.abs(c.seat - i) === 1)); if (!free.length) return;   // 一桌只坐一位客人，泡泡才不會疊在一起
  const seat = free[Math.floor(Math.random() * free.length)], st = stallSeat(seat);
  const ang = Math.random() * Math.PI * 2, sx = st.x + Math.cos(ang) * 14, sz = st.z + Math.sin(ang) * 14;
  if (!isLand(sx, sz)) return;
  const name = CUST_NAMES[Math.floor(Math.random() * CUST_NAMES.length)], lk = CUST_LOOK[Math.floor(Math.random() * CUST_LOOK.length)];
  const f = new Fisher({ shirt:lk[0], hat:lk[1], name:'客人・' + name, kind:'npc' }); f.pos.set(sx, 0, sz); f.baseY = groundHeight(sx, sz);
  customers.push({ f, name, seat, st, order: pickOrder(), state:'in', until: t + 160, from:{ x:sx, z:sz } });
}
function updateCustomers(dt, t){
  if (!cookStall) return;
  const near = Math.hypot(me.pos.x - cookStall.x, me.pos.z - cookStall.z) < 32;
  if (near && t > custNext){ custNext = t + rand(25, 50); if (customers.filter(c => c.state !== 'out').length < 3) spawnCustomer(t); }
  for (let i = customers.length - 1; i >= 0; i--){
    const c = customers[i], f = c.f, tgt = c.state === 'out' ? c.from : c.st;
    const dx = tgt.x - f.pos.x, dz = tgt.z - f.pos.z, d = Math.hypot(dx, dz);
    if (c.state === 'wait'){
      f.speed = 0; f.rot = lerpAngle(f.rot, c.st.face, 1 - Math.exp(-6 * dt));
      if (t > c.until){ c.state = 'out'; f.sitting = false; f.say('等太久了…下次再來 😢', '', 3); }
    } else if (d > 0.15){
      const sp = 2.6; f.pos.x += dx / d * Math.min(d, sp * dt); f.pos.z += dz / d * Math.min(d, sp * dt); f.speed = sp; f.rot = lerpAngle(f.rot, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      f.baseY = groundHeight(f.pos.x, f.pos.z);
    } else if (c.state === 'in'){
      c.state = 'wait'; f.sitting = true; f.baseY = c.st.y; f.pos.x = c.st.x; f.pos.z = c.st.z; const rc = RECIPES[c.order]; f.say(`想吃 ${rc.icon} ${rc.name}`, 'order', 9999); c.until = t + 150;
      if (!c.told){ c.told = true; }   /* 客人來了不用跑馬燈（使用者覺得太吵） */
    } else { f.dispose(); customers.splice(i, 1); continue; }
    f.update(dt, t); f.placeTag();
  }
}
function waitingCustomers(){ return customers.filter(c => c.state === 'wait'); }
function serveCustomer(c){
  const ds = rec.dishes.filter(d => d.r === c.order).sort((a, b) => b.q - a.q); if (!ds.length) return;
  const d = ds[0], got = Math.round(dishPrice(d) * 1.5);
  rec.dishes = rec.dishes.filter(x => x.t !== d.t); rec.earned += got; addCoins(got);
  cloudCall('serve_dish', { p_ts: d.t, p_recipe: d.r });
  c.state = 'out'; c.f.sitting = false; c.f.say(`好好吃！😋 謝謝你～ +${got}`, '', 4);
  FX.emit(c.f.pos.x, 1.8, c.f.pos.z, 14, '#ff9ab0', 0.6, 1.4, 1.0); SFX.catch();
  logMsg('', `${c.name} 吃了 ${RECIPES[d.r].name}，給你 ${got} 金幣`, true); renderTab();
}

// ---- 切魚小遊戲：指針左右來回跑，在綠色區域按下「切！」，切 3 刀 ----
const CookGame = { on:false };
const COOK_MODE = { tako:'flip', ayu:'grill', ikayaki:'grill', unadon:'grill', tilapia:'grill', ebi:'grill', suzuki:'fry', fugu:'pot', sumi:'pot', sanbei:'pot' };
function startCooking(key){
  const rc = RECIPES[key], { use } = pickIngredients(key); if (use.length < rc.need) return;
  if (COOK_MODE[key]){ startMini(key, COOK_MODE[key], use); return; }
  closeSheet(); uiBlocked = true;
  const G = Object.assign(CookGame, { on:true, key, use, cut:0, score:[], x:0, dir:1, speed:0.9, t0:performance.now(), zone:0.16, mode:'cut', q:null });
  let ov = $('#cookGame');
  if (!ov){
    ov = document.createElement('div'); ov.id = 'cookGame';
    ov.innerHTML = '<div class="box panel"><div class="ct"></div><div class="cs"></div><div class="mini" hidden></div><div class="track"><span class="zone"></span><span class="mark"></span></div><div class="cuts"></div><button class="pbtn cutbtn">切！</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('.cutbtn').addEventListener('pointerdown', e => { e.preventDefault(); cookCut(); });
    addEventListener('keydown', e => { if (CookGame.on && (e.code === 'Space' || e.code === 'Enter')){ e.preventDefault(); e.stopPropagation(); cookCut(); } }, true);
  }
  ov.hidden = false; ov.querySelector('.mini').hidden = true; ov.querySelector('.track').hidden = false; ov.querySelector('.cuts').hidden = false; ov.querySelector('.ct').textContent = `${rc.icon} ${rc.name}`;
  ov.querySelector('.cs').textContent = `食材：${use.map(x => FISH_BY_ID[x.f].name).join('、')}。指針跑到中間的綠色區域時按「切！」`;
  ov.querySelector('.cutbtn').textContent = '切！'; ov.querySelector('.cutbtn').disabled = false;
  G.zoneW = G.zone; renderCuts(); requestAnimationFrame(cookTick);
}
// ---- 其他料理的玩法：章魚燒翻面、燒烤／油炸控火、火鍋照順序下料 ----
function startMini(key, mode, use){
  const rc = RECIPES[key]; closeSheet(); uiBlocked = true;
  let ov;
  if (!$('#cookGame')){ const d = document.createElement('div'); d.id = 'cookGame'; d.innerHTML = '<div class="box panel"><div class="ct"></div><div class="cs"></div><div class="mini" hidden></div><div class="track"><span class="zone"></span><span class="mark"></span></div><div class="cuts"></div><button class="pbtn cutbtn">切！</button></div>'; document.body.appendChild(d);
    d.querySelector('.cutbtn').addEventListener('pointerdown', e => { e.preventDefault(); cookCut(); });
    d.querySelector('.cutbtn').addEventListener('pointerup', e => { e.preventDefault(); if (CookGame.release) CookGame.release(); });
    d.querySelector('.cutbtn').addEventListener('pointerleave', () => { if (CookGame.release) CookGame.release(); });
    addEventListener('keydown', e => { if (CookGame.on && (e.code === 'Space' || e.code === 'Enter')){ e.preventDefault(); e.stopPropagation(); if (!e.repeat) cookCut(); } }, true);
    addEventListener('keyup', e => { if (CookGame.on && (e.code === 'Space' || e.code === 'Enter') && CookGame.release) CookGame.release(); }, true); }
  ov = $('#cookGame'); const btn = ov.querySelector('.cutbtn');
  if (!ov.dataset.rel){ ov.dataset.rel = '1'; btn.addEventListener('pointerup', e => { if (CookGame.release) CookGame.release(); }); btn.addEventListener('pointerleave', () => { if (CookGame.release) CookGame.release(); }); addEventListener('keyup', e => { if (CookGame.on && (e.code === 'Space' || e.code === 'Enter') && CookGame.release) CookGame.release(); }, true); }
  ov.hidden = false; ov.querySelector('.track').hidden = true; ov.querySelector('.cuts').hidden = true;
  const mini = ov.querySelector('.mini'); mini.hidden = false; mini.innerHTML = ''; mini.className = 'mini m-' + mode;
  ov.querySelector('.ct').textContent = `${rc.icon} ${rc.name}`; btn.disabled = false;
  const G = Object.assign(CookGame, { on:true, key, use, mode, cut:0, score:[], q:null, press:null, release:null, last:0 });
  const done = q => { G.q = q; G.cut = 3; G.press = G.release = null; finishCooking(); };
  if (mode === 'flip'){
    // 章魚燒：6 顆各自慢慢變熟，金黃色的時候點下去翻面
    ov.querySelector('.cs').textContent = '每顆章魚燒會慢慢變成金黃色，金黃色的時候點它翻面！太早沒熟、太晚會焦。';
    btn.textContent = '全部翻完就完成'; btn.disabled = true;
    const balls = []; const now0 = performance.now();
    for (let i = 0; i < 6; i++){ const b = el('button', 'tball'); b.innerHTML = '<i></i>'; mini.appendChild(b); const o = { b, ready: now0 + 1500 + i * 700 + Math.random() * 900, done:false }; balls.push(o);
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (o.done || !G.on) return; const dtv = (performance.now() - o.ready) / 1000; const sc = Math.abs(dtv) < 0.6 ? 2 : dtv > -1.0 && dtv < 1.1 ? 1 : 0; o.done = true; G.score.push(sc);
        b.classList.add('done', sc === 2 ? 'g' : sc === 1 ? 'o' : 'x'); b.querySelector('i').textContent = sc === 2 ? '完美' : sc === 1 ? '還可以' : dtv < 0 ? '沒熟' : '焦了'; SFX.plop(); if (sc === 2) SFX.bite();
        if (balls.every(x => x.done)){ const sum = G.score.reduce((a, c) => a + c, 0); setTimeout(() => done(sum >= 10 ? 3 : sum >= 6 ? 2 : 1), 450); } }); }
    const tick = () => { if (!G.on || G.mode !== 'flip') return; const t = performance.now();
      for (const o of balls){ if (o.done) continue; const k = (t - o.ready) / 1000; o.b.style.setProperty('--cook', clamp((k + 2.2) / 2.2, 0, 1).toFixed(3)); o.b.classList.toggle('ready', Math.abs(k) < 0.6); o.b.classList.toggle('burnt', k > 1.0);
        if (k > 2.2){ o.done = true; G.score.push(0); o.b.classList.add('done', 'x'); o.b.querySelector('i').textContent = '焦了'; if (balls.every(x => x.done)){ const sum = G.score.reduce((a, c) => a + c, 0); setTimeout(() => done(sum >= 10 ? 3 : sum >= 6 ? 2 : 1), 450); } } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  } else if (mode === 'grill' || mode === 'fry'){
    // 燒烤／油炸：按住加火、放開降溫，讓指針一直待在會移動的綠色區
    const fry = mode === 'fry';
    ov.querySelector('.cs').textContent = fry ? '按住「加熱」讓油溫上升、放開會降溫。讓指針一直留在綠色區，炸得越久越金黃！' : '按住「搧火」讓炭火變旺、放開火會變小。讓指針一直留在綠色區，烤得剛剛好！';
    btn.textContent = fry ? '🔥 按住加熱' : '🪭 按住搧火';
    mini.innerHTML = `<div class="heat"><span class="hz"></span><span class="hm"></span></div><div class="cookp"><i></i><span>${fry ? '炸' : '烤'}熟程度</span></div>`;
    let temp = 0.35, hold = false, zc = 0.5, inT = 0, tot = 0, prog = 0; const DUR = 7;
    G.press = () => { hold = true; btn.classList.add('down'); }; G.release = () => { hold = false; btn.classList.remove('down'); };
    const tick = () => { if (!G.on || (G.mode !== 'grill' && G.mode !== 'fry')) return; const t = performance.now(), dt = Math.min(0.05, (t - (G.last || t)) / 1000); G.last = t;
      temp += (hold ? 0.55 : -0.42) * dt; temp = clamp(temp, 0, 1); tot += dt; zc = 0.5 + Math.sin(tot * 1.3) * 0.22 + Math.sin(tot * 2.9) * 0.06; const zw = 0.2;
      const inZ = Math.abs(temp - zc) < zw / 2; if (inZ) inT += dt; prog = Math.min(1, tot / DUR);
      mini.querySelector('.hz').style.left = ((zc - zw / 2) * 100) + '%'; mini.querySelector('.hz').style.width = (zw * 100) + '%'; mini.querySelector('.hm').style.left = (temp * 100) + '%';
      mini.querySelector('.heat').classList.toggle('hot', !inZ && temp > zc); mini.querySelector('.heat').classList.toggle('ok', inZ);
      mini.querySelector('.cookp i').style.width = (prog * 100) + '%';
      if (Math.random() < dt * (inZ ? 10 : 3) && cookStall) FX.emit(cookStall.grill.x, cookStall.grill.y, cookStall.grill.z, 1, inZ ? '#ffb070' : '#888888', 0.3, 0.9, 0.6);
      if (prog >= 1){ const r = inT / tot; done(r > 0.72 ? 3 : r > 0.45 ? 2 : 1); return; }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  } else if (mode === 'pot'){
    // 火鍋／麵：先記住下料順序，再照順序點
    const pool = { fugu:['🐡','🥬','🍄','🧅','🥕','🌽','🧄'], sumi:['🦑','🍝','🧄','🧈','🧂','🌿','🍅'], sanbei:['🦑','🌿','🧄','🫚','🥢','🌶️','🧅'] }[key] || ['🐟','🥬','🍄','🧅','🥕','🧄'];
    const order = pool.slice().sort(() => Math.random() - 0.5).slice(0, 4), opts = pool.slice().sort(() => Math.random() - 0.5);
    ov.querySelector('.cs').textContent = '記住下料的順序！等一下照同樣的順序點食材。'; btn.textContent = '記住了'; btn.disabled = true;
    mini.innerHTML = '<div class="seq"></div><div class="opts"></div>'; const seq = mini.querySelector('.seq'), op = mini.querySelector('.opts');
    order.forEach(e => { const sp = el('span', 'si', e); seq.appendChild(sp); });
    let step = 0, miss = 0;
    setTimeout(() => { if (!G.on) return; seq.querySelectorAll('.si').forEach(x => { x.textContent = '？'; x.classList.add('hid'); }); ov.querySelector('.cs').textContent = '照剛剛的順序點食材下鍋！'; btn.textContent = '下鍋中…';
      opts.forEach(e => { const b = el('button', 'oi', e); op.appendChild(b); b.addEventListener('pointerdown', ev => { ev.preventDefault(); if (!G.on) return;
        if (e === order[step]){ const sp = seq.children[step]; sp.textContent = e; sp.classList.remove('hid'); sp.classList.add('ok'); step++; SFX.plop(); if (cookStall) FX.emit(cookStall.grill.x, cookStall.grill.y, cookStall.grill.z, 4, '#fff4dc', 0.3, 1, 0.8);
          if (step >= order.length) setTimeout(() => done(miss === 0 ? 3 : miss <= 2 ? 2 : 1), 400); }
        else { miss++; b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 300); SFX.fail(); } }); }); }, 2600);
  }
}
function renderCuts(){ const G = CookGame; $('#cookGame .cuts').innerHTML = [0, 1, 2].map(i => `<span class="${i < G.score.length ? (G.score[i] >= 2 ? 'g' : G.score[i] >= 1 ? 'o' : 'x') : ''}">${i < G.score.length ? (G.score[i] >= 2 ? '完美' : G.score[i] >= 1 ? '不錯' : '歪了') : '🔪'}</span>`).join(''); }
function cookTick(){
  const G = CookGame; if (!G.on || G.cut >= 3) return;
  const t = performance.now(), dt = Math.min(0.05, (t - (G.last || t)) / 1000); G.last = t;
  G.x += G.dir * G.speed * dt; if (G.x > 1){ G.x = 1; G.dir = -1; } if (G.x < 0){ G.x = 0; G.dir = 1; }
  const tr = $('#cookGame .track'); tr.querySelector('.mark').style.left = (G.x * 100) + '%';
  const z = tr.querySelector('.zone'); z.style.left = ((0.5 - G.zoneW / 2) * 100) + '%'; z.style.width = (G.zoneW * 100) + '%';
  requestAnimationFrame(cookTick);
}
function cookCut(){
  const G = CookGame; if (!G.on || G.cut >= 3) return;
  if (G.mode !== 'cut'){ if (G.press) G.press(); return; }
  const d = Math.abs(G.x - 0.5), s = d < G.zoneW / 2 ? 2 : d < G.zoneW ? 1 : 0;
  G.score.push(s); G.cut++; SFX.plop(); if (s === 2) SFX.bite();
  G.speed *= 1.35; G.zoneW *= 0.85; G.x = Math.random() < 0.5 ? 0.05 : 0.95; G.dir = G.x < 0.5 ? 1 : -1;
  renderCuts();
  if (G.cut >= 3) finishCooking();
}
function finishCooking(){
  const G = CookGame, rc = RECIPES[G.key], sum = G.score.reduce((a, b) => a + b, 0), q = G.q != null ? G.q : sum >= 6 ? 3 : sum >= 3 ? 2 : 1;
  const set = new Set(G.use.map(x => x.t));
  rec.tank = rec.tank.filter(x => !set.has(x.t));
  const dish = { r:G.key, q, t:Date.now() }; rec.dishes.unshift(dish); rec.dishes = rec.dishes.slice(0, 100); saveRecLocal(); buildTank();
  cloudCall('cook', { p_recipe: G.key, p_ts: G.use.map(x => x.t), p_quality: q });
  if (room && room.connected()) room.emit('cook', { r:G.key, q }).catch(() => {});
  if (cookStall) FX.emit(cookStall.grill.x, cookStall.grill.y, cookStall.grill.z, 16, '#fff4dc', 0.4, 1.6, 1.2);
  SFX.catch(); me.say(rc.icon, 'emote', 3);
  const btn = $('#cookGame .cutbtn'); btn.disabled = true;
  $('#cookGame .cs').textContent = `做好了！${'★'.repeat(q)}${'☆'.repeat(3 - q)}　可以賣 🪙${dishPrice(dish)}`;
  setTimeout(() => { G.on = false; $('#cookGame').hidden = true; uiBlocked = false; cookMode = 'mine'; openSheet('cook'); }, 1500);
}

/* ================= 打窩：先把窩料丟到水裡，魚會聚過來（更快上鉤、稀有魚更多）================= */
// 價格要跟 supabase/013_chum.sql 的 _bait_info 一樣
const CHUMS = [
  { id:'chum_rice',  name:'酒米窩料',   price:40,  pack:3, color:'#efe3b8', wait:0.6,  rare:1.15, legend:1.0, dur:120, fresh:true,  desc:'用酒泡過的米和粗糠，淡水魚最愛。在河、湖、溪效果比較好。' },
  { id:'chum_krill', name:'南極蝦窩料', price:120, pack:3, color:'#f2a48a', wait:0.5,  rare:1.35, legend:1.15, dur:150, sea:true,   desc:'磨碎的南極蝦，海水魚聞到就會游過來。在海邊、外海、小島效果比較好。' },
  { id:'chum_gold',  name:'黃金特製窩', price:500, pack:2, color:'#ffd36a', wait:0.45, rare:1.5,  legend:1.8, dur:180,              desc:'釣具店老闆的祕方，什麼水域都有效，連傳說魚都會被吸引過來。' },
];
const CHUM_BY_ID = Object.fromEntries(CHUMS.map(c => [c.id, c]));
const SEA_SPOTS = new Set(['sea', 'harbor', 'isle', 'mangrove', 'mudflat', 'reef', 'weir', 'icesea', 'abyss', 'mystic']);
const chumZones = []; let chumTex = null;
function chumTexture(){
  if (chumTex) return chumTex; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.55, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 160; i++){ c.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`; const a = Math.random() * 6.28, r = Math.random() * 56; c.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2, 2); }
  chumTex = new THREE.CanvasTexture(cv); return chumTex;
}
function addChumZone(x, z, type, owner){
  const C = CHUM_BY_ID[type]; if (!C) return null;
  while (chumZones.length >= 6){ removeChumZone(chumZones[0]); }
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(2.8, 32), new THREE.MeshBasicMaterial({ map: chumTexture(), color: C.color, transparent:true, opacity:0, depthWrite:false })); patch.rotation.x = -Math.PI / 2; patch.position.y = WATER_LEVEL + 0.035; patch.renderOrder = 2; g.add(patch);
  const shadowM = new THREE.MeshBasicMaterial({ color:'#123048', transparent:true, opacity:0, depthWrite:false }), fish = [];
  for (let i = 0; i < 6; i++){ const f = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), shadowM); f.scale.set(1.9 + Math.random(), 0.8, 1); f.rotation.x = -Math.PI / 2; f.position.y = WATER_LEVEL + 0.03; g.add(f); fish.push({ m:f, r: 0.6 + Math.random() * 1.6, a: Math.random() * 6.28, sp: (0.5 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1) }); }
  const zn = { x, z, type, owner, born: now(), until: now() + C.dur, g, patch, shadowM, fish };
  chumZones.push(zn); ripple(x, z, true); FX.emit(x, 0.3, z, 18, C.color, 1.0, 2.0, 0.9); return zn;
}
function removeChumZone(zn){ const i = chumZones.indexOf(zn); if (i >= 0) chumZones.splice(i, 1); scene.remove(zn.g); }
function updateChum(dt, t){
  for (let i = chumZones.length - 1; i >= 0; i--){
    const zn = chumZones[i], left = (zn.until - t) / CHUM_BY_ID[zn.type].dur, age = t - zn.born;
    if (left <= 0){ removeChumZone(zn); continue; }
    zn.patch.material.opacity = Math.min(1, age * 1.5) * (0.25 + 0.4 * left); zn.patch.rotation.z += dt * 0.05;
    zn.shadowM.opacity = clamp((age - 2.5) / 4, 0, 1) * 0.45 * (0.4 + 0.6 * left);   // 過幾秒魚影才聚過來
    for (const f of zn.fish){ f.a += f.sp * dt; f.m.position.x = Math.cos(f.a) * f.r; f.m.position.z = Math.sin(f.a) * f.r; f.m.rotation.z = -f.a + (f.sp > 0 ? -Math.PI / 2 : Math.PI / 2); }
    if (Math.random() < dt * 2.5 && Math.hypot(camera.position.x - zn.x, camera.position.z - zn.z) < 40) FX.emit(zn.x + (Math.random() - 0.5) * 3, WATER_LEVEL + 0.05, zn.z + (Math.random() - 0.5) * 3, 1, CHUM_BY_ID[zn.type].color, 0.2, 0.8, 0.6);
    if (Math.random() < dt * 0.8) ripple(zn.x + (Math.random() - 0.5) * 2.5, zn.z + (Math.random() - 0.5) * 2.5);
  }
  if (ChumFly.on){ ChumFly.t += dt / 0.6; const k = Math.min(1, ChumFly.t); ChumFly.m.position.lerpVectors(ChumFly.from, ChumFly.to, k); ChumFly.m.position.y += Math.sin(k * Math.PI) * 2.2;
    if (k >= 1){ ChumFly.on = false; scene.remove(ChumFly.m); SFX.plop();
      if (ChumFly.secret){ ripple(ChumFly.to.x, ChumFly.to.z, true); while (secretSpots.length >= SECRET_MAX){ const old = secretSpots.shift(); const g = secretMarks.get(old.id); if (g) scene.remove(g); secretMarks.delete(old.id); }
        const sp = { id: Date.now(), x: +ChumFly.to.x.toFixed(2), z: +ChumFly.to.z.toFixed(2), type: ChumFly.type, at: Date.now(), where: spotName(ChumFly.to.x, ChumFly.to.z) }; secretSpots.push(sp); saveSecrets(); secretMark(sp);
        toast(`🤫 祕密窩點做好了（${sp.where}）！窩料會慢慢發酵，大約 10 分鐘後效果最強。只有你看得到那顆橘色浮標。`); }
      else { const zn = addChumZone(ChumFly.to.x, ChumFly.to.z, ChumFly.type, 'me'); if (zn) toast(`🍚 打好窩了！在這附近下竿，魚會比較快上鉤（${Math.round(CHUM_BY_ID[ChumFly.type].dur / 60)} 分鐘左右）`); } } }
}
const ChumFly = { on:false };
// ---- 提前打窩：祕密窩點（只有自己知道，存在這台裝置；效果慢慢醞釀，10 分鐘後最強，維持 1 小時）----
const SECRET_GROW = 10 * 60 * 1000, SECRET_LIFE = 60 * 60 * 1000, SECRET_MAX = 3;
const secretSpots = (LS.get('tide.secretChum', []) || []).filter(x => x && CHUM_BY_ID[x.type] && Date.now() - x.at < SECRET_LIFE).slice(0, SECRET_MAX);
const secretMarks = new Map();
// 存在這台裝置＋雲端（雲端那張表只有自己讀得到），換手機登入也找得到
let secretSyncT = 0, secretLoaded = null;
function saveSecrets(){ LS.set('tide.secretChum', secretSpots); clearTimeout(secretSyncT); secretSyncT = setTimeout(() => { if (Cloud.on && Cloud.sb) Cloud.sb.rpc('set_secret_chum', { p_spots: secretSpots }).then(() => {}, () => {}); }, 600); }
async function loadSecretsCloud(){
  secretLoaded = Cloud.userId; try {
    const { data, error } = await Cloud.sb.rpc('get_secret_chum'); if (error || !Array.isArray(data)) return;
    const byId = new Map(); for (const x of data.concat(secretSpots)) if (x && CHUM_BY_ID[x.type] && Date.now() - x.at < SECRET_LIFE) byId.set(+x.id, Object.assign({}, x, { id:+x.id, x:+x.x, z:+x.z, at:+x.at }));
    const merged = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, SECRET_MAX);
    for (const [id, g] of secretMarks){ if (!merged.some(m => m.id === id)){ scene.remove(g); secretMarks.delete(id); } }
    secretSpots.length = 0; secretSpots.push(...merged); LS.set('tide.secretChum', secretSpots);
    if (JSON.stringify(merged.map(m => m.id)) !== JSON.stringify(data.map(m => +m.id))) saveSecrets();
  } catch(e){}
}
function secretPower(sp){ const age = Date.now() - sp.at; return age > SECRET_LIFE ? 0 : clamp(0.15 + 0.85 * age / SECRET_GROW, 0.15, 1); }
function secretMark(sp){
  // 只有自己看得到的小浮標＋淡淡的窩
  const g = new THREE.Group(); g.position.set(sp.x, WATER_LEVEL, sp.z); scene.add(g);
  const bo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#ff7a2a', 0.4, { emissive:'#ff7a2a', emissiveIntensity:0.4 })); bo.position.y = 0.08; g.add(bo);
  const st = box([0.03, 0.55, 0.03], '#333', [0, 0.35, 0]); g.add(st); const fl = box([0.26, 0.16, 0.01], '#ffd36a', [0.14, 0.55, 0]); g.add(fl);
  const pt = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), new THREE.MeshBasicMaterial({ map: chumTexture(), color: CHUM_BY_ID[sp.type].color, transparent:true, opacity:0.18, depthWrite:false })); pt.rotation.x = -Math.PI / 2; pt.position.y = 0.03; g.add(pt);
  g.userData = { bo, pt }; secretMarks.set(sp.id, g); return g;
}
function updateSecrets(t){
  if (Cloud.on && Cloud.sb && secretLoaded !== Cloud.userId) loadSecretsCloud();
  for (let i = secretSpots.length - 1; i >= 0; i--){ const sp = secretSpots[i], pw = secretPower(sp);
    if (pw <= 0){ const g = secretMarks.get(sp.id); if (g) scene.remove(g); secretMarks.delete(sp.id); secretSpots.splice(i, 1); saveSecrets(); toast('🍚 有一個祕密窩點的窩料散掉了'); continue; }
    let g = secretMarks.get(sp.id); if (!g) g = secretMark(sp);
    const vis = !onIsle && !House.on; if (g.visible !== vis) g.visible = vis;
    g.userData.bo.position.y = 0.08 + Math.sin(t * 2 + sp.x) * 0.04; g.userData.pt.material.opacity = 0.08 + 0.22 * pw; }
}
function secretAt(x, z){ let best = null; for (const sp of secretSpots){ if (Math.hypot(x - sp.x, z - sp.z) < 3.0 && (!best || secretPower(sp) > secretPower(best))) best = sp; } return best; }
function spotName(x, z){ const id = waterSpotId(x, z), s = SPOT_BY_ID[id]; return s ? s.short : '水邊'; }
function chumSpot(){ if (F.phase !== 'idle' || ChumFly.on || mySeat || House.on || inHall()) return null;   /* 釣蝦場不能打窩 */ if (myBoat) return boatSpot(); const ns = nearestSpot(); if (ns.d < 1.7) return ns.spot; return shoreSpot(); }
function myChums(){ return CHUMS.filter(c => (rec.bait[c.id] || 0) > 0); }
function throwChum(type, secret){
  if (typeof inHall === 'function' && inHall()){ toast('🦐 釣蝦場不用打窩，老闆會定時放蝦進池子'); return; }
  const C = CHUM_BY_ID[type], sp = chumSpot(); if (!C || !sp){ toast('要在水邊才能打窩'); return; } if (!(rec.bait[type] > 0)){ toast(`沒有${C.name}了，到釣具店買`); return; }
  const cp = castPoint(sp.pos.x, sp.pos.z, sp.dir.x, sp.dir.y, 4.5), to = new THREE.Vector3(cp[0], WATER_LEVEL, cp[1]), from = new THREE.Vector3(); me.av.armR.getWorldPosition(from);
  me.rot = Math.atan2(sp.dir.x, sp.dir.y);
  rec.bait[type]--; if (rec.bait[type] <= 0) delete rec.bait[type]; saveRecLocal(); cloudCall('use_bait', { p_bait: type });
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(C.color, 0.8)); scene.add(m);
  Object.assign(ChumFly, { on:true, t:0, from, to, m, type }); SFX.cast(); me.say('🍚', 'emote', 1.5);
  ChumFly.secret = !!secret;
  if (!secret && room && room.connected()) room.emit('chum', { x:+cp[0].toFixed(2), z:+cp[1].toFixed(2), ty:type }).catch(() => {});   // 祕密窩點不告訴別人
  { const pk = $('#chumPick'); if (pk) pk.hidden = true; }
}
function chumAt(x, z){ let best = null; for (const zn of chumZones){ const d = Math.hypot(x - zn.x, z - zn.z); if (d < 3.2 && (!best || zn.until > best.until)) best = zn; } return best; }
function chumBonus(zn, spotId, secret){
  if (secret){ const C = CHUM_BY_ID[secret.type], pw = secretPower(secret), sea = SEA_SPOTS.has(spotId), fit = C.fresh ? (sea ? 0.45 : 1) : C.sea ? (sea ? 1 : 0.5) : 1, k = pw * fit;
    const b2 = { wait: 1 - (1 - C.wait * 0.85) * k, rare: 1 + (C.rare * 1.25 - 1) * k, legend: 1 + (C.legend * 1.35 - 1) * k, name: `祕密窩點（${Math.round(pw * 100)}%）`, src: 'secret:' + secret.id };
    const b1 = chumBonus(zn, spotId); return b1 && b1.rare > b2.rare ? b1 : b2; }
  if (!zn) return null; const C = CHUM_BY_ID[zn.type], left = clamp((zn.until - now()) / C.dur, 0, 1), sea = SEA_SPOTS.has(spotId);
  const fit = C.fresh ? (sea ? 0.45 : 1) : C.sea ? (sea ? 1 : 0.5) : 1, k = (0.45 + 0.55 * left) * fit;
  return { wait: 1 - (1 - C.wait) * k, rare: 1 + (C.rare - 1) * k, legend: 1 + (C.legend - 1) * k, name: C.name, src: 'live:' + zn.type };
}
function renderChumPick(){
  let pk = $('#chumPick'); if (!pk){ pk = document.createElement('div'); pk.id = 'chumPick'; pk.className = 'panel'; pk.hidden = true; document.body.appendChild(pk); }
  pk.innerHTML = ''; pk.appendChild(el('b', '', '🍚 要用哪一種窩料打窩？'));
  for (const c of myChums()){ const row = el('div', 'cprow'); row.appendChild(el('span', 'cpn', `${c.name} ×${rec.bait[c.id]}`)); row.style.setProperty('--cc', c.color);
    const b = el('button', 'tbtn', '現在打'); b.title = '馬上有效、大家看得到、2～3 分鐘'; b.addEventListener('click', () => throwChum(c.id, false)); row.appendChild(b);
    const s2 = el('button', 'tbtn ghost', '🤫 提前打'); s2.title = '祕密窩點：只有你知道，10 分鐘後最強、維持 1 小時'; s2.addEventListener('click', () => throwChum(c.id, true)); row.appendChild(s2); pk.appendChild(row); }
  pk.appendChild(el('small', 'sub', '「現在打」馬上有效、大家都看得到；「提前打」是祕密窩點，只有你知道，10 分鐘後最強、可以維持 1 小時（最多 3 個）。'));
  const x = el('button', 'tbtn ghost', '取消'); x.addEventListener('click', () => { pk.hidden = true; }); pk.appendChild(x);
  pk.hidden = false;
}

/* ================= ECONOMY：金幣、賣魚、釣竿與魚餌 ================= */
// 目前存在玩家自己的瀏覽器；之後接上伺服器時，賣魚和購買要改由伺服器驗證
// ---- 釣法和釣線（免費，可以隨時換）----
const RIGS = {
  float:  { name:'浮標釣', icon:'🎈', desc:'最穩的釣法，什麼魚都釣得到。' },
  lure:   { name:'路亞',   icon:'🎣', desc:'用假餌，不用魚餌、拋得更遠。等魚時點按鈕「抽竿」讓假餌動，掠食魚（黑鱸、雷魚、鯖魚、鰹魚、梭子魚、鬼頭刀、鮪魚、浪人鰺）特別多，其他魚比較少。' },
  bottom: { name:'沉底釣', icon:'⚓', desc:'鉛錘沉到水底，等比較久，但底棲魚（鯰魚、鰻魚、比目魚、石狗公、螃蟹、龍蝦、石斑、鱘龍、章魚、鮟鱇）特別多。' },
};
const LINES = {
  thin:   { name:'細線',   icon:'🧵', desc:'魚比較快咬，但線比較容易斷。', bite:0.8, tension:1.25, rare:1 },
  normal: { name:'標準線', icon:'〰️', desc:'剛剛好。', bite:1, tension:1, rare:1 },
  thick:  { name:'粗線',   icon:'🪢', desc:'線不容易斷，適合大魚，但魚比較少咬。', bite:1.25, tension:0.75, rare:0.92 },
};
const LURE_FISH = new Set(['barramundi', 'mangsnapper', 'bullshark', 'yellowtail', 'hairtail', 'cod', 'toothfish', 'bass', 'snakehead', 'mackerel', 'bonito', 'barracuda', 'mahi', 'tuna', 'trevally', 'marlin', 'perch', 'trout', 'salmon', 'arowana', 'shark', 'hammer', 'squid', 'ika']);
const BOTTOM_FISH = new Set(['fiddler', 'fiddler_blue', 'mudcrab', 'sawfish', 'cod', 'toothfish', 'crayfish', 'prawn', 'tigerprawn', 'catfish', 'eel', 'flounder', 'scorpion', 'crab', 'kingcrab', 'lobster', 'stingray', 'grouper', 'sturgeon', 'loach', 'goby', 'octopus', 'angler', 'cuttle', 'shrimp', 'crucian', 'carp']);
const Rig = Object.assign({ rig:'float', line:'normal' }, LS.get('tide.rig', {}));
if (!RIGS[Rig.rig]) Rig.rig = 'float'; if (!LINES[Rig.line]) Rig.line = 'normal';
function saveRig(){ LS.set('tide.rig', Rig); updateBobberLook(); }
function updateBobberLook(){
  const b = me && me.bob; if (!b) return; const hall = typeof inHall === 'function' && inHall();
  if (!b.userData.stick){ const st = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.42, 6), mat('#f4f4f0', 0.4)); body.position.y = 0.1; st.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), mat('#ff5a2a', 0.3, { emissive:'#ff5a2a', emissiveIntensity:0.6 })); top.position.y = 0.36; st.add(top);
    const top2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), mat('#ffe14a', 0.3, { emissive:'#ffd020', emissiveIntensity:0.6 })); top2.position.y = 0.27; st.add(top2); b.add(st); b.userData.stick = st; }
  const rtB = rodType(curRod()), stickF = hall || rtB === 'pole';   /* 手竿用細長的立標，跟釣蝦一樣 */
  b.children.forEach(c => c.visible = Rig.rig === 'float' && !stickF); b.userData.stick.visible = stickF && Rig.rig !== 'lure';
  b.scale.setScalar(!hall && rtB === 'iso' ? 1.45 : 1);   /* 磯釣的阿波浮標比較大顆 */
  // 蝦竿：短短的一支
  const a = me.av; if (a && a.pole){ applyRodShape(a, rodType(curRod()), hall); a.pole.material.color.set(hall ? curSrod().color : (RODS.find(r => r.id === rec.rod) || RODS[0]).color); }
  if (!b.userData.lure){ const l = new THREE.Group(); const bd = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#ff7a2a', 0.3, { metalness:0.4 })); bd.scale.set(1.8, 0.8, 0.8); l.add(bd); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat('#ffd36a', 0.4)); tl.rotation.z = Math.PI / 2; tl.position.x = -0.18; l.add(tl); b.add(l); b.userData.lure = l;
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat('#6b6b6b', 0.4, { metalness:0.6 })); b.add(sk); b.userData.sinker = sk; }
  b.userData.lure.visible = Rig.rig === 'lure'; b.userData.sinker.visible = Rig.rig === 'bottom' && !hall; b.userData.sinker.position.y = -0.12;
}
const RODS = [
  { id:'bamboo', name:'竹釣竿',     price:0,    color:'#3b2a1e', desc:'村裡人人都有的入門竿，輕巧好用。', tension:1, reel:1, rare:1, legend:1 },
  { id:'carbon', name:'碳纖維釣竿', price:400,  color:'#2f6fb5', desc:'線比較不容易繃斷、收線快一點，稀有魚機率 ×1.2。', tension:0.85, reel:1.12, rare:1.2, legend:1.05 },
  { id:'lure',   name:'路亞輕竿',   price:1200, color:'#3fbf9d', desc:'輕巧好甩，收線快 30%，稀有魚機率 ×1.25。', tension:0.9, reel:1.3, rare:1.25, legend:1.1 },
  { id:'deep',   name:'深海巨物竿', price:2500, color:'#c9302c', desc:'對付大型魚的專用竿：拉力大減、收線更快，傳說魚機率 ×1.25。', tension:0.72, reel:1.22, rare:1.3, legend:1.25 },
  { id:'moon',   name:'月光夜釣竿', price:5000, color:'#8a7bff', desc:'竿尖會發出淡淡月光，稀有魚機率 ×1.5、傳說魚 ×1.5。', tension:0.75, reel:1.2, rare:1.5, legend:1.3 },
  { id:'king',   name:'黃金王者竿', price:12000, color:'#e8b730', desc:'村裡最強的釣竿：線幾乎不會斷、收線最快，傳說魚機率 ×1.5。', tension:0.6, reel:1.38, rare:1.45, legend:1.5 },
  // ---- 專用竿（2026-11-04）：在對的地方用，稀有魚多一點、魚咬得快一點；在不對的地方用就差一點 ----
  { id:'pole_bamboo', type:'pole', name:'竹手竿', price:300, color:'#b8924a', desc:'台灣溪釣、池釣用的手竿，沒有捲線器。往前輕輕一放、拋不遠，在河、湖、溪、瀑布潭最好用。', tension:0.95, reel:1, rare:1.05, legend:1 },
  { id:'pole_carbon', type:'pole', name:'碳纖維手竿', price:1800, color:'#2a2f3a', desc:'又輕又韌的高級手竿，溪流、湖泊專用，稀有魚機率 ×1.3。', tension:0.8, reel:1.15, rare:1.3, legend:1.1 },
  { id:'surf_basic', type:'surf', name:'遠投竿', price:900, color:'#3a6ad8', desc:'海灘遠投用的長竿，舉過頭用力甩，可以拋得特別遠。在海邊、沙灘最好用。', tension:0.9, reel:1.05, rare:1.1, legend:1.05 },
  { id:'surf_pro', type:'surf', name:'職人遠投竿', price:4000, color:'#1e2a5a', desc:'遠投大會選手用的長竿，拋得最遠，稀有魚機率 ×1.35。', tension:0.75, reel:1.2, rare:1.35, legend:1.2 },
  { id:'iso_basic', type:'iso', name:'磯釣竿', price:1000, color:'#c84a3a', desc:'在礁岩、防波堤上用的長軟竿，配大顆的阿波浮標。在港口外海、小島碼頭最好用。', tension:0.85, reel:1.05, rare:1.15, legend:1.05 },
  { id:'iso_pro', type:'iso', name:'黑鯛磯釣竿', price:4500, color:'#5a1e1e', desc:'釣黑鯛高手用的磯釣竿，竿身很韌，稀有魚機率 ×1.4。', tension:0.7, reel:1.2, rare:1.4, legend:1.2 },
];
// 竿種：甩竿哪裡都可以；手竿、遠投竿、磯釣竿在對的釣點比較好用（伺服器 fair_fishing.sql.tpl 也一樣算）
const ROD_TYPES = { cast:{ name:'甩竿', icon:'🎣', fit:null }, pole:{ name:'手竿', icon:'🎋', fit:['river', 'lake', 'pool', 'creek', 'canal', 'weir', 'icelake'] }, surf:{ name:'遠投竿', icon:'🏖️', fit:['sea', 'icesea', 'abyss'] }, iso:{ name:'磯釣竿', icon:'🪨', fit:['harbor', 'isle', 'reef'] } };
const ROD_FIT = { good:{ rare:1.15, bite:0.85 }, bad:{ rare:0.85, bite:1.2 } };
function rodType(r){ return (r && r.type) || 'cast'; }
// ---- 公母和繁殖（037）----
// 水族館裡會生的魚（真的養得起來、會在魚缸裡繁殖的）；野外會自己繁殖的魚（春夏比較多、小魚比較多）；嘴巴含卵的魚
const TANK_BREED = new Set(['goldfish', 'koi', 'carp', 'crucian', 'tilapia', 'clown', 'medaka', 'prawn', 'crayfish', 'seahorse', 'loach', 'pseudorasbora', 'guppy']);
const WILD_BREED = new Set(['tilapia', 'tilapia_red', 'crucian', 'pseudorasbora', 'medaka', 'mudskipper', 'fiddler', 'crayfish', 'guppy']);
const BROOD = new Set(['tilapia', 'tilapia_red']);
// ---- 孔雀魚（046）：每一條有自己的基因 gp＝「尾巴顏色兩個|尾巴形狀兩個」，顏色 w灰 r紅 b藍 y黃 k黑 p紫、形狀 d扇尾 s劍尾 o圓尾（扇尾＞劍尾＞圓尾）----
const GPY_COL = { w:['#8a9a8a', '灰'], r:['#e8402a', '紅'], b:['#2f7ae8', '藍'], y:['#f2c230', '黃'], k:['#1d1d24', '黑'], p:['#9b5bd8', '紫'] };
const GPY_TAIL = { d:['guppy', '扇尾'], s:['gpy_s', '劍尾'], o:['gpy_o', '圓尾'] };
function isGuppy(id){ return id === 'guppy' || id === 'guppy_albino'; }
function gpyParse(gp){ const m = /^([wrbykp]{2})\|([dso]{2})$/.exec(gp || ''); return m ? { c: m[1].split('').sort((a, b) => 'rbykpw'.indexOf(a) - 'rbykpw'.indexOf(b)), t: m[2] } : null; }
function gpyTail(t){ return t.includes('d') ? 'd' : t.includes('s') ? 's' : 'o'; }
function gpyLabel(x){ const g = gpyParse(x.gp); if (!g) return ''; const [a, b] = g.c; return (a === b ? GPY_COL[a][1] + '色' : GPY_COL[a][1] + GPY_COL[b][1]) + GPY_TAIL[gpyTail(g.t)][1]; }
function fishNameOf(x){ const f = FISH_BY_ID[x.f]; return f && isGuppy(x.f) && gpyParse(x.gp) ? gpyLabel(x) + f.name : f ? f.name : ''; }
function gpyWild(){ const c = 'wwwrby', t = 'ooosd', r = s => s[Math.floor(Math.random() * s.length)]; return r(c) + r(c) + '|' + r(t) + r(t); }
function gpyBaby(a, b){ const A = gpyParse(a) || gpyParse('ww|oo'), B = gpyParse(b) || gpyParse('ww|oo'), h = s => s[Math.random() < 0.5 ? 0 : 1];
  let c = [h(A.c), h(B.c)], t = [h(A.t), h(B.t)]; if (Math.random() < 0.04) c[Math.random() < 0.5 ? 0 : 1] = 'wrbykp'[Math.floor(Math.random() * 6)]; if (Math.random() < 0.03) t[Math.random() < 0.5 ? 0 : 1] = 'dso'[Math.floor(Math.random() * 3)]; return c.join('') + '|' + t.join(''); }
// 每一種品系（顏色＋尾巴形狀＋公母＋白化）用自己的模型顏色；母魚顏色比較淡
function gpyFish(x){ const base = FISH_BY_ID[x.f], g = base && isGuppy(x.f) ? gpyParse(x.gp) : null; if (!g) return base;
  const tl = gpyTail(g.t), fem = x.s === 'F', alb = x.f === 'guppy_albino', key = `gpy~${g.c.join('')}${tl}${fem ? 'F' : 'M'}${alb ? 'a' : ''}`;
  if (!FISH_STYLE[key]){ const B = FISH_STYLE[GPY_TAIL[tl][0]], c = Object.assign({}, B.c), lt = (h, k) => '#' + new THREE.Color(h).lerp(new THREE.Color('#c8ccc0'), k).getHexString();
    if (alb) Object.assign(c, FISH_STYLE.guppy_albino.c); c.Tail = fem ? lt(GPY_COL[g.c[0]][0], 0.55) : GPY_COL[g.c[0]][0]; c.Tail2 = fem ? lt(GPY_COL[g.c[1]][0], 0.6) : GPY_COL[g.c[1]][0];
    FISH_STYLE[key] = Object.assign({}, B, { c }); FISH_BY_ID[key] = Object.assign({}, base, { id: key, color: c.Tail }); }
  return Object.assign({}, FISH_BY_ID[key], { name: fishNameOf(x) }); }
function breedSeason(){ return SEASON === 'spring' || SEASON === 'summer'; }
function sexIcon(x){ return x && x.s === 'M' ? '♂' : x && x.s === 'F' ? '♀' : ''; }
// 水族館繁殖：展示中同一種魚的一公一母，每天一半機會生一條小魚（每天最多 3 條；伺服器 breed_tank 算）
// 變種也會繁殖（043）：V＝變種、C＝帶變種基因（g）、N＝一般；變種算原本那種，變種先跟變種配
function breedBase(id){ const f = FISH_BY_ID[id]; return f && f.of && !f.rs ? f.of : id; }
function geno(x){ return breedBase(x.f) !== x.f ? 'V:' + x.f : x.g ? 'C:' + x.g : 'N'; }
function babyGeno(a, b){ const [ka, va] = a.split(':'), [kb, vb] = b.split(':'), r = Math.random(), h = () => Math.random() < 0.5;
  if (ka === 'N' && kb === 'N') return 'N';
  if (ka !== 'N' && kb !== 'N' && va === vb){ if (ka === 'V' && kb === 'V') return 'V:' + va; if (ka === 'V' || kb === 'V') return r < 0.5 ? 'V:' + va : 'C:' + va; return r < 0.25 ? 'V:' + va : r < 0.75 ? 'C:' + va : 'N'; }
  if (ka === 'V' && (kb !== 'V' || r < 0.5)) return 'C:' + va; if (kb === 'V') return 'C:' + vb;
  if (ka === 'C' && (kb === 'N' || r < 0.5)) return h() ? 'C:' + va : 'N'; return h() ? 'C:' + vb : 'N'; }
function tankPairs(){ const show = new Set(rec.show || []), c = {}, pri = g => g[0] === 'V' ? 0 : g[0] === 'C' ? 1 : 2;
  for (const x of rec.tank){ const b = breedBase(x.f); if (!show.has(x.t) || !TANK_BREED.has(b) || !x.s || x.rs) continue; const k = c[b] || (c[b] = { M:[], F:[] }); k[x.s].push(geno(x) + '#' + (x.gp || '')); }
  return Object.entries(c).map(([f, k]) => { const so = a => a.sort((p, q) => pri(p) - pri(q) || (p < q ? -1 : 1)); so(k.M); so(k.F); const pairs = Math.min(k.M.length, k.F.length);
    return { f, M:k.M.length, F:k.F.length, pairs, list: Array.from({ length: pairs }, (_, i) => [k.M[i], k.F[i]]), vars: k.M.concat(k.F).filter(g => g[0] === 'V').length }; }); }
async function breedTank(){
  if (Date.now() - (breedTank.at || 0) < 60000) return; breedTank.at = Date.now();
  let born = [];
  if (Cloud.on && Cloud.sb){ try { const { data, error } = await Cloud.sb.rpc('breed_tank'); if (error || !data) return; born = data.born || []; breedTank.next = data.next || 0;
      if (born.length && Array.isArray(data.tank)){ rec.tank = normRec(Object.assign({}, rec, { tank: data.tank })).tank; saveRecLocal(); buildTank(); } } catch(e){ return; } }
  else { if (!rec.breedAt){ rec.breedAt = Date.now(); saveRecLocal(); return; } const days = Math.min(3, Math.floor((Date.now() - rec.breedAt) / 86400000)); if (days < 1) return;
    for (let d = 0; d < days; d++) for (const p of tankPairs()) for (let k = 0; k < p.pairs && born.length < 3 * days; k++) if (Math.random() < 0.5){ const f = FISH_BY_ID[p.f], [ga, pa] = p.list[k][0].split('#'), [gb, pb] = p.list[k][1].split('#'), g = babyGeno(ga, gb), v = g[0] === 'V' ? g.slice(2) : null; born.push(Object.assign({ f: v || p.f, w: +f.min.toFixed(2), t: Date.now() + born.length, s: Math.random() < 0.5 ? 'M' : 'F', y: true }, g[0] === 'C' ? { g: g.slice(2) } : {}, v ? { k: true } : {}, p.f === 'guppy' ? { gp: gpyBaby(pa, pb) } : {})); }
    rec.breedAt += days * 86400000; if (born.length){ rec.tank = born.concat(rec.tank); trimTank(); buildTank(); } saveRecLocal(); }
  for (const x of born){ const f = FISH_BY_ID[x.f]; if (!f) continue; if (f.of) ticker(`✨ 水族館生出了變種小魚 <b>${esc(f.name)}</b>！（${sexIcon(x)}，自動收藏）`); else ticker(`🐣 水族館裡的<b>${esc(fishNameOf(x))}</b>出生了！（${sexIcon(x)}${x.g && FISH_BY_ID[x.g] ? `・🧬 帶著${esc(FISH_BY_ID[x.g].name)}的基因` : ''}）`); }
  if (born.length && !$('#sheet').hidden && curTab === 'tank') renderTab();
}
// 公共魚市行情（063_economy.sql）：海邊商店收魚的價錢 × 行情（0.6～1.6 倍，跟伺服器同一份）
var ECON = { m:{}, at:0, busy:false };
async function loadEcon(){ if (ECON.busy || !Cloud.on || !Cloud.sb) return; ECON.busy = true; ECON.at = Date.now(); try { const { data } = await Cloud.sb.rpc('econ_prices'); if (data) ECON.m = data; } catch(e){} ECON.busy = false; if (!$('#sheet').hidden && curTab === 'shop' && shopMode === 'sell') renderTab(); }
function econMult(id){ const e = Cloud.on && ECON.m[id]; return e ? +e.m || 1 : 1; }
function itemPrice(x){ const f = FISH_BY_ID[x.f]; return Math.round(fishPrice(f, x.w) * (x.y ? 0.25 : 1) * econMult(x.f)); }   /* 水族館生的小魚只值四分之一 */
function rodFit(spotId, r){ const T = ROD_TYPES[rodType(r || curRod())]; if (!T.fit || !spotId || spotId === 'shrimp' || spotId === 'mudflat') return null; return T.fit.includes(spotId) ? 'good' : 'bad'; }
const BAITS = [
  { id:'worm', name:'蚯蚓',   price:20,  pack:10, desc:'最便宜的魚餌，稀有魚機率 ×1.25。', rare:1.25, legend:1 },
  { id:'glow', name:'亮光餌', price:60,  pack:5, desc:'會發光的小蝦，稀有魚機率 ×1.8。', rare:1.8, legend:1.1 },
  { id:'squidbait', name:'小卷切片', price:150, pack:5, desc:'大魚最愛的味道，稀有 ×1.4、傳說 ×1.4。', rare:1.4, legend:1.4 },
  { id:'gold', name:'黃金餌', price:300, pack:3, desc:'傳說中的金色魚餌，傳說魚機率 ×1.8。', rare:1.3, legend:1.8 },
  { id:'rainbow', name:'彩虹餌', price:900, pack:2, desc:'七種顏色一閃一閃，稀有 ×2.2、傳說 ×2.2。', rare:2.2, legend:2.2 },
];
const SELL_BASE = { '常見':10, '稀有':60, '傳說':400 };
function fishPrice(f, w){ const rel = clamp((w - f.min) / Math.max(0.01, f.max - f.min), 0, 1); return Math.round(SELL_BASE[f.rarity] * (1 + 1.5 * rel) * (undersized(f, w) ? 0.5 : 1)); }
// 尺寸限制：比「最輕 + 四分之一範圍」還輕就是未達尺寸（賣半價，放流點數比較多）；跟伺服器 015_release.sql 一樣
function sizeMin(f){ return f.spot === 'shrimp' ? 0 : f.min + 0.25 * (f.max - f.min); }   /* 釣蝦場的蝦是老闆放的，沒有尺寸限制 */
function undersized(f, w){ return w < sizeMin(f); }
function lovePts(f, w){ if (f.rs) return 100; if (f.sev) return 50; return Math.max(undersized(f, w) ? 3 : 0, { '常見':1, '稀有':3, '傳說':10 }[f.rarity] || 1); }
// 放流一條魚：拿掉、加愛海點數
function releaseLocal(x){
  const f = FISH_BY_ID[x.f], p = lovePts(f, x.w) + (x.b ? 5 : 0);   /* 嘴裡含著小魚的母魚 */
  rec.tank = rec.tank.filter(y => y.t !== x.t); if (rec.show) rec.show = rec.show.filter(t => t !== x.t);
  rec.love = (rec.love || 0) + p; rec.released = (rec.released || 0) + 1; saveRecLocal(); buildTank();
  if (f.sev) sevReleased(f);
  return p;
}
function curRod(){ return RODS.find(r => r.id === rec.rod) || RODS[0]; }
function curBait(){ const b = BAITS.find(b => b.id === rec.baitOn); return b && (rec.bait[b.id] || 0) > 0 ? b : null; }
function renderCoins(){ const t = $('#coinTxt'); if (t) t.textContent = rec.coins.toLocaleString(); }
function addCoins(n){ rec.coins = Math.max(0, rec.coins + n); saveRecLocal(); renderCoins(); const c = $('#coins'); if (c){ c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
function setFav(x, on){
  if (on && rec.tank.filter(y => y.k).length >= FAV_MAX){ toast(`收藏最多 ${FAV_MAX} 條`); return false; }
  if (on) x.k = true; else delete x.k; saveRecLocal(); cloudCall('set_fav', { p_ts: x.t, p_on: !!on }); return true;
}
function sellFish(ts, batch){
  const i = rec.tank.findIndex(x => x.t === ts); if (i < 0 || FISH_BY_ID[rec.tank[i].f].rs || rec.tank[i].k) return 0;   /* 收藏的魚不能賣 */   /* 赤紅霸王鯊不能賣 */
  const x = rec.tank[i], f = FISH_BY_ID[x.f], price = itemPrice(x);
  rec.tank.splice(i, 1); if (rec.show) rec.show = rec.show.filter(t => t !== ts);
  rec.sold++; rec.earned += price; addCoins(price);
  if (!batch) cloudCall('sell_fish', { p_ts: [ts] });
  return price;
}
const SHOPS = [ { id:'tackle', label:'釣具店', mode:'rod' }, { id:'shop', label:'海邊商店', mode:'sell' }, { id:'cook', label:'潮汐食堂', mode:'cook' }, { id:'tailor', label:'阿綾服裝店', mode:'tailor' }, { id:'mu', label:'阿木木工坊', mode:'mu' }, { id:'fu', label:'阿福海產店', mode:'fu' }, { id:'cai', label:'阿彩畫廊', mode:'cai' }, { id:'market', label:'釣客魚市', mode:'market' } ];
function nearShop(){
  if (myBoat) return null;
  for (const q of questNpcs){ if (Math.hypot(me.pos.x - q.f.pos.x, me.pos.z - q.f.pos.z) < 2.3) return { id:'quest', label:q.name, mode:'quest', who:q.who }; }
  if (ferryNpc && Math.hypot(me.pos.x - ferryNpc.f.pos.x, me.pos.z - ferryNpc.f.pos.z) < 2.3) return { id:'ferry', label:FERRY.name, mode:'ferry' };
  { const g = npcs.find(n => n.shopNpc === 'news'); if (g && Math.hypot(me.pos.x - g.pos.x, me.pos.z - g.pos.z) < 2.3) return { id:'news', label:'阿報・村報', mode:'news' }; }
  { const g = npcs.find(n => n.wid === 'gang'); if (g && !g.wHide && Math.hypot(me.pos.x - g.pos.x, me.pos.z - g.pos.z) < 2.3) return { id:'gang', label:'老港・漁夫', mode:'gang' }; }
  if (inHall()){
    if (Venue.desk && Math.hypot(me.pos.x - Venue.desk.x, me.pos.z - Venue.desk.z) < 2) return { id:'shrimpdesk', label:'買時段', mode:'shrimpdesk' };
    if (Venue.grill && Math.hypot(me.pos.x - Venue.grill.x, me.pos.z - Venue.grill.z) < 1.8) return { id:'grill', label:'烤蝦', mode:'cook' };
    if (Venue.exit && Math.hypot(me.pos.x - Venue.exit.x, me.pos.z - Venue.exit.z) < 1.3) return { id:'shrimpexit', label:'出去', mode:'shrimpexit' };
    return null; }
  if (Math.hypot(me.pos.x - SHRIMP_DOOR.x, me.pos.z - (SHRIMP_DOOR.z + 1.9)) < 1.6) return { id:'shrimpdoor', label:'釣蝦場', mode:'shrimpdoor' };
  for (const sh of SHOPS){ const l = LANDMARKS.find(l => l.id === sh.id); if (l && Math.hypot(me.pos.x - l.pos.x, me.pos.z - l.pos.z) < 4.8) return sh; }
  return null;
}
let shopMode = 'sell', sellConfirm = 0, shopName = '海邊商店';
function openShop(sh){ ensureAudio(); if (sh.mode === 'market'){ Mkt.sell = null; openSheet('market'); loadMarket(); return; } if (sh.mode === 'cai'){ openSheet('cai'); loadCai(); return; } if (sh.mode === 'news'){ News.pick = 0; openSheet('news'); loadNews(); return; } if (sh.mode === 'gang'){ openSheet('gang'); loadGang(); return; } if (sh.mode === 'fu'){ Fu.pick = null; openSheet('fu'); loadFu(); return; } if (sh.mode === 'mu'){ openSheet('mu'); if (!FZ.list || Date.now() - FZ.at > 5 * 60000) loadMu(); return; } if (sh.mode === 'tailor'){ shopName = '阿綾服裝店'; shopMode = 'wear'; openSheet('shop'); return; } if (sh.mode === 'shrimpdoor'){ enterShrimp(); return; } if (sh.mode === 'shrimpexit'){ exitShrimp(); return; } if (sh.mode === 'shrimpdesk'){ openSheet('shrimp'); return; } if (sh.mode === 'ferry'){ openSheet('ferry'); return; } if (sh.mode === 'quest'){ questWho = sh.who; openSheet('quest'); loadQuests(); return; } if (sh.mode === 'cook'){ cookMode = 'make'; openSheet('cook'); return; } shopMode = sh.mode; shopName = sh.label; sellConfirm = 0; openSheet('shop'); }
// ---- 服飾預覽：用另一個小場景把角色畫成圖片（商品小圖、試穿預覽）----
const AvShot = { kit:null, cache:new Map() };
// 預覽也用 3D 角色（模型載好以後才換；換的時候把衣服重新穿一次）
function avKidify(av){ if (!KID.ok || av.kid || av.kidFail) return false; try { const pf = { av, gearKey:'', setGear(g){ applyGear(av, g || {}); } }; kidUpgrade(pf); if (av.kid){ const A = av.kid.acts; for (const k in A) A[k].setEffectiveWeight(k === 'idle' ? 1 : 0); av.kid.mixer.update(0.016); return true; } } catch(e){ av.kidFail = true; } return false; }
function avKit(){
  if (AvShot.kit) return AvShot.kit;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#c9b8a0', 1.6)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(2, 4, 3); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20), av = makeAvatar(look.shirt, look.hat); sc.add(av.g); av.g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const rt = new THREE.WebGLRenderTarget(256, 256, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  return (AvShot.kit = { sc, cam, av, rt, key:'' });
}
const SHOT_VIEW = { hat:[1.55, 1.6, 0.35], face:[1.33, 0.95, 0.15], acc:[1.15, 1.3, 0.4], top:[0.85, 2.0, 0.5], back:[0.95, 2.1, Math.PI - 0.6], pants:[0.45, 1.7, 0.45], shoes:[0.12, 1.15, 0.5], socks:[0.18, 1.05, 0.5], full:[0.95, 3.4, 0.45] };
function avatarShot(gear, view, size){
  const key = JSON.stringify([gear, view, size, look.shirt, look.hat]); if (AvShot.cache.has(key)) return AvShot.cache.get(key);
  const K = avKit(); if (avKidify(K.av)){ K.key = ''; AvShot.cache.clear(); } K.av.shirtM.color.set(look.shirt); K.av.hatM.color.set(look.hat);
  const gk = JSON.stringify(gear); if (K.key !== gk){ applyGear(K.av, gear); K.key = gk; }
  if (K.av.gearAnim) K.av.gearAnim(1.2, 0);
  const [ty, dist, yaw] = SHOT_VIEW[view] || SHOT_VIEW.full; K.cam.position.set(Math.sin(yaw) * dist, ty + 0.12, Math.cos(yaw) * dist); K.cam.lookAt(0, ty, 0);
  if (K.rt.width !== size) K.rt.setSize(size, size);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(K.rt); renderer.setClearColor('#f3efe6', 1); renderer.clear(); renderer.render(K.sc, K.cam);
  const px = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(K.rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c2 = cv.getContext('2d'), id = c2.createImageData(size, size);
  for (let y = 0; y < size; y++) id.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);   // 上下顛倒
  c2.putImageData(id, 0, 0); const url = cv.toDataURL();
  if (AvShot.cache.size > 160) AvShot.cache.clear(); AvShot.cache.set(key, url); return url;
}

// ---- 服飾店：買、穿、試穿 ----
const Wardrobe = { slot:'hat', trying:null, tryTimer:0 };
function ownsGear(id){ const it = GEAR_BY_ID[id]; return !!it && (!paidGear(it) || rec.owned.includes(id)); }
function wearGear(id){
  const it = GEAR_BY_ID[id]; if (!it || !ownsGear(id)) return;
  endTryOn(); rec.gear = Object.assign(cleanGear(rec.gear), { [it.slot]: id }); saveRecLocal(); me.setGear(rec.gear); pushPresence(true);
  cloudCall('set_gear', { p_gear: rec.gear }); renderTab();
}
function buyGear(id){
  const it = GEAR_BY_ID[id]; if (!it || ownsGear(id)) return;
  if (it.love) return redeemLove(id);
  if (rec.coins < it.price){ toast(`金幣不夠，還差 🪙${(it.price - rec.coins).toLocaleString()}`); return; }
  endTryOn(); rec.owned.push(id); rec.gear = Object.assign(cleanGear(rec.gear), { [it.slot]: id }); addCoins(-it.price); saveRecLocal(); me.setGear(rec.gear); pushPresence(true);
  cloudCall('buy_item', { p_item: id }); SFX.catch(); flash(`${it.icon} 買了${it.name}！`, 1.4); renderTab();
}
// 愛海商品：用放流得到的愛海點數換
function redeemLove(id){
  const it = GEAR_BY_ID[id]; if (!it || !it.love || ownsGear(id)) return;
  if ((rec.love || 0) < it.love){ toast(`愛海點數不夠，還差 💙${it.love - (rec.love || 0)}。把魚放流就能得到點數！`); return; }
  endTryOn(); rec.love -= it.love; rec.owned.push(id); rec.gear = Object.assign(cleanGear(rec.gear), { [it.slot]: id }); saveRecLocal(); me.setGear(rec.gear); pushPresence(true);
  cloudCall('redeem_love', { p_item: id }); SFX.catch(); flash(`${it.icon} 換到了${it.name}！`, 1.4); renderTab();
}
const gearCost = it => it.love ? `💙 ${it.love}` : `🪙 ${it.price.toLocaleString()}`;
// 試穿：只在上面的預覽圖換上（不會移動鏡頭，也不會讓別人看到）
function tryOn(id){ const it = GEAR_BY_ID[id]; if (!it) return; Wardrobe.preview = Object.assign(cleanGear(Wardrobe.preview || rec.gear), { [it.slot]: id }); Wardrobe.previewOf = id; renderTab(); }
function endTryOn(){ Wardrobe.preview = null; Wardrobe.previewOf = null; }
// 試穿預覽：可以用手指轉的小 3D 畫面（另外一個小的繪圖器，不影響主畫面）
const PV = { r:null, cv:null, sc:null, cam:null, av:null, key:'', yaw:0.45, drag:null, idleAt:0, raf:0, failed:false };
function pvInit(){
  if (PV.r) return true; if (PV.failed) return false;
  try {
    const cv = document.createElement('canvas'); cv.className = 'pvcv'; cv.setAttribute('aria-label', '試穿預覽，左右拖曳可以轉');
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(150, 170, false);
    r.outputColorSpace = renderer.outputColorSpace; r.toneMapping = renderer.toneMapping; r.toneMappingExposure = renderer.toneMappingExposure; r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#c9b8a0', 1.6)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(2, 4, 3); sc.add(dl); const dl2 = new THREE.DirectionalLight('#ffffff', 0.9); dl2.position.set(-2, 2, -3); sc.add(dl2);
    const cam = new THREE.PerspectiveCamera(30, 150 / 170, 0.05, 20); cam.position.set(0, 1.3, 5.0); cam.lookAt(0, 1.15, 0);
    const av = makeAvatar(look.shirt, look.hat); sc.add(av.g);
    cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); PV.drag = { x: e.clientX, yaw: PV.yaw }; try { cv.setPointerCapture(e.pointerId); } catch(_){} });
    cv.addEventListener('pointermove', e => { if (!PV.drag) return; e.preventDefault(); PV.yaw = PV.drag.yaw + (e.clientX - PV.drag.x) * 0.014; });
    const up = () => { if (PV.drag){ PV.drag = null; PV.idleAt = now() + 2.5; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
    cv.style.touchAction = 'none';
    Object.assign(PV, { r, cv, sc, cam, av }); return true;
  } catch(e){ PV.failed = true; return false; }
}
function pvShow(host, gear){
  if (!pvInit()) return false;
  if (avKidify(PV.av)) PV.key = ''; PV.av.shirtM.color.set(look.shirt); PV.av.hatM.color.set(look.hat);
  const k = JSON.stringify(gear); if (PV.key !== k){ applyGear(PV.av, gear); PV.key = k; }
  host.appendChild(PV.cv); if (!PV.raf) PV.raf = requestAnimationFrame(pvLoop); return true;
}
function pvLoop(){
  if (!PV.cv || !PV.cv.isConnected || $('#sheet').hidden){ PV.raf = 0; return; }
  const t = now(); if (!PV.drag && t > PV.idleAt) PV.yaw += 0.01;
  const a = PV.av; a.g.rotation.y = PV.yaw; if (a.gearAnim) a.gearAnim(t, 0);
  if (a.eyes){ const bt = (t + a.blinkAt) % 4.2; a.eyes[0].scale.y = a.eyes[1].scale.y = bt < 0.12 ? 0.12 : 1.15; }
  PV.r.render(PV.sc, PV.cam); PV.raf = requestAnimationFrame(pvLoop);
}
// ===== 自己設計衣服、褲子（044）：16×16 格子畫布，上衣有正面＋背面；放到「設計師市集」賣 =====
const DESIGN_PAL = ['#ffffff', '#1d1d24', '#e8473a', '#f5a5d8', '#ff9f43', '#ffd36a', '#3fbf9d', '#5d9c55', '#5fb6e3', '#2f89c7', '#18334a', '#9b7bff', '#8c5d3b', '#f1e3c8', '#9fb3bf', '#5b6b7a'];
const Designs = { map: new Map(), mats: new Map(), want: new Set(), timer: 0, ver: 0 };
function designId(item){ const m = /^(top|pants|hat|shoes|back|acc)_dz(\d+)$/.exec(item || ''); return m ? { kind: m[1], id: +m[2] } : null; }
function designCanvas(px, kind, cell){
  cell = cell || 1; const top = kind === 'top', W = top ? 32 : 16, cv = document.createElement('canvas'); cv.width = W * cell; cv.height = 16 * cell; const c = cv.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){
    if (top){ c.fillStyle = DESIGN_PAL[parseInt(px[y * 16 + x], 16)] || '#fff'; c.fillRect((8 + x) * cell, y * cell, cell, cell);   /* 正面在中間 */
      c.fillStyle = DESIGN_PAL[parseInt(px[256 + y * 16 + x], 16)] || '#fff'; c.fillRect(((24 + x) % 32) * cell, y * cell, cell, cell); }   /* 背面在兩邊（繞到後面） */
    else { c.fillStyle = DESIGN_PAL[parseInt(px[y * 16 + x], 16)] || '#fff'; c.fillRect(x * cell, y * cell, cell, cell); } }
  return cv;
}
function designMat(d){
  const k = d.id + ':' + d.kind; let m = Designs.mats.get(k); if (m) return m;
  const D = Designs.map.get(d.id); if (!D || !D.px){ queueDesign(d.id); return null; }
  const tx = new THREE.CanvasTexture(designCanvas(D.px, d.kind, 1)); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.wrapS = THREE.RepeatWrapping;
  if (d.kind === 'top') tx.offset.x = 0.5;   /* 身體的貼圖接縫在正前方：轉半圈讓正面在中間 */
  m = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.75, metalness: 0.02 }); Designs.mats.set(k, m); return m;
}
/* 遊戲剛開始、雲端還沒準備好時（穿著自己設計的衣服進遊戲）先排著，等一下再抓 */
function queueDesign(id){ if (Designs.map.has(id)) return; let on = false; try { on = Cloud.on && !!Cloud.sb; } catch(e){ setTimeout(() => queueDesign(id), 1500); return; } if (!on) return; Designs.want.add(id); clearTimeout(Designs.timer); Designs.timer = setTimeout(fetchDesigns, 300); }
async function fetchDesigns(){ const ids = [...Designs.want].filter(id => !Designs.map.has(id)).slice(0, 40); Designs.want.clear(); if (!ids.length) return;
  try { const { data } = await Cloud.sb.rpc('get_designs', { p_ids: ids }); for (const d of data || []) Designs.map.set(d.id, d); for (const id of ids) if (!Designs.map.has(id)) Designs.map.set(id, { id, px: null }); } catch(e){ return; }
  Designs.ver++; refreshDesignAvatars(); }
function refreshDesignAvatars(){ const all = [me, ...[...peers.values()].map(p => p.fisher), ...npcs]; for (const f of all){ if (f && f.gearKey && /_dz\d+/.test(f.gearKey)){ const g = JSON.parse(f.gearKey); f.gearKey = ''; f.setGear(g); } } AvShot.cache.clear(); if (!$('#sheet').hidden && ['style', 'market', 'shop', 'design'].includes(curTab)) renderTab(); }
const DESIGN_SLOTS = [['top', '上衣'], ['pants', '褲子'], ['hat', '帽子'], ['shoes', '鞋子'], ['back', '披風'], ['acc', '領巾']];
function applyDesigns(av, gear){
  const t = designId(gear.top), p = designId(gear.pants), h = designId(gear.hat), sh = designId(gear.shoes), bk = designId(gear.back), ac = designId(gear.acc);
  av.body.material = (t && designMat(t)) || av.shirtM;
  const pm = (p && designMat(p)) || av.pantsM; for (const L of [av.legL, av.legR]){ if (L.userData.pants) L.userData.pants.material = pm; if (L.userData.pants2) L.userData.pants2.material = pm; } if (av.kid && av.kid.prim.pants) av.kid.prim.pants.material = pm; if (av.kid && av.kid.prim.shin) av.kid.prim.shin.material = av.shortLegs ? av.skinM : pm;
  // 帽子：用草帽的形狀，整頂換成你的圖案
  for (const b of av.hatBase){ if (!b.userData.m0) b.userData.m0 = b.material; const hm = h && designMat(h); if (h) b.visible = true; b.material = hm && b !== av.hatBase[2] ? hm : b.userData.m0; }
  // 鞋子
  const sm = (sh && designMat(sh)) || av.shoeM; for (const L of [av.legL, av.legR]) if (L.userData.shoe) L.userData.shoe.material = sm; if (av.kid && av.kid.prim.shoe) av.kid.prim.shoe.material = sm;
  // 披風（背飾）：背後一塊布
  if (bk){ const m = designMat(bk); if (m){ const mm = m.clone(); mm.side = THREE.DoubleSide; const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62, 1, 4), mm); c.position.set(0, 0.74, -0.25); c.rotation.set(0.12, Math.PI, 0); c.castShadow = true; av.g.add(c); av.gearMeshes.push(c); } }
  // 領巾（配件）：脖子一圈加前面一塊三角巾
  if (ac){ const m = designMat(ac); if (m){ const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 18), m); ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.02, 0); ring.scale.z = 0.9; av.g.add(ring); av.gearMeshes.push(ring);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), m); tri.rotation.set(Math.PI, 0, 0); tri.scale.z = 0.3; tri.position.set(0, 0.93, 0.22); av.g.add(tri); av.gearMeshes.push(tri); } }
}
function ownsDesign(item){ return (rec.owned || []).includes(item); }
function wearDesign(item){ const d = designId(item); if (!d || !ownsDesign(item)) return; endTryOn(); rec.gear = Object.assign(cleanGear(rec.gear), { [d.kind]: item }); saveRecLocal(); me.setGear(rec.gear); pushPresence(true); cloudCall('set_gear', { p_gear: rec.gear }); renderTab(); }
function designThumb(px, kind, h){ const cv = designCanvas(px, kind, kind === 'top' ? 3 : 4); cv.className = 'dzthumb'; cv.style.height = (h || 40) + 'px'; cv.style.imageRendering = 'pixelated'; cv.style.borderRadius = '6px'; cv.style.border = '1px solid rgba(24,51,74,.15)'; return cv; }
// 我的設計（造型分頁的衣服／褲子欄位下面）
function renderMyDesigns(body, slot){
  const mine = (rec.owned || []).filter(id => { const d = designId(id); return d && d.kind === slot; });
  body.appendChild(el('div', 'dexhead', `🎨 自己設計的${(DESIGN_SLOTS.find(([k]) => k === slot) || [, '衣服'])[1]}・設計師市集`));
  const bar = el('div', 'tankbar'), nb = el('button', 'tbtn', '＋ 自己設計'), mk = el('button', 'tbtn ghost', '🛍️ 設計師市集');
  nb.addEventListener('click', () => { if (!Cloud.on){ toast('要連上雲端（登入）才能設計衣服'); return; } DesignEd.kind = slot; DesignEd.px = null; curTab = 'design'; renderTab(); });
  mk.addEventListener('click', () => { Market.mode = 'new'; Market.kind = slot; curTab = 'market'; renderTab(); }); bar.append(nb, mk); body.appendChild(bar);
  if (!mine.length){ body.appendChild(el('p', 'sub', '還沒有自己的設計。可以自己畫，也可以去市集買別人設計的。')); return; }
  const ul = el('ul', 'shoplist cols');
  for (const item of mine){ const d = designId(item), D = Designs.map.get(d.id), on = cleanGear(rec.gear)[slot] === item, li = el('li', on ? 'on' : '');
    if (D && D.px) li.appendChild(designThumb(D.px, slot, 40)); else { queueDesign(d.id); li.appendChild(el('span', 'dishic', '🎨')); }
    const inf = el('div', 'tinfo'); inf.appendChild(el('div', 'n', D ? D.name || '設計' : '載入中…')); inf.appendChild(el('div', 'sub2', D ? (D.mine ? '我設計的' : `${D.by || ''} 設計`) : '')); li.appendChild(inf);
    const a = el('div', 'tacts'); if (!on){ const b = el('button', 'tbtn', '穿上'); b.addEventListener('click', () => wearDesign(item)); a.appendChild(b); } else { const b = el('button', 'tbtn ghost', '脫掉'); b.addEventListener('click', () => { rec.gear = Object.assign(cleanGear(rec.gear), { [slot]: GEAR_DEFAULT[slot] }); saveRecLocal(); me.setGear(rec.gear); pushPresence(true); cloudCall('set_gear', { p_gear: rec.gear }); renderTab(); }); a.appendChild(b); }
    li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}
// 設計室
function designFromImage(im, px, o){
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d', { willReadFrequently: true });
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, sz = Math.min(w, h);   /* 從中間裁成正方形 */
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, (w - sz) / 2, (h - sz) / 2, sz, sz, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data, pal = DESIGN_PAL.map(hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]);
  for (let i = 0; i < 256; i++){ const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3]; if (a < 100){ px[o + i] = 0; continue; }
    let best = 0, bd = 1e9; pal.forEach(([pr, pg, pb], k) => { const rm = (r + pr) / 2, dr = r - pr, dg = gg - pg, db = b - pb, dd = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; if (dd < bd){ bd = dd; best = k; } }); px[o + i] = best; }
}
const DesignEd = { kind:'top', side:0, px:null, col:2, tool:'pen', name:'', price:100, busy:false };
function renderDesignEd(body){
  const E = DesignEd, N = E.kind === 'top' ? 512 : 256; if (!E.px || E.px.length !== N) E.px = Array(N).fill(0);
  const head = el('div', 'shophead'); head.innerHTML = `<b>🎨 設計室・${(DESIGN_SLOTS.find(([k]) => k === E.kind) || [, '上衣'])[1]}</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  body.appendChild(el('p', 'sub', `在格子上畫圖案，畫好按「儲存」就能穿，也可以放到設計師市集賣（別人買了，九成的錢給你）。${E.kind === 'top' ? '上衣有正面和背面。' : E.kind === 'pants' ? '兩隻褲管是同一個圖案。' : E.kind === 'shoes' ? '兩隻鞋子是同一個圖案。' : ''}請不要畫讓人不舒服的東西，被檢舉三次會下架。`));
  const seg = el('div', 'seg'); [['top', '👕 上衣'], ['pants', '👖 褲子'], ['hat', '👒 帽子'], ['shoes', '👟 鞋子'], ['back', '🦸 披風'], ['acc', '🧣 領巾']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(E.kind === k)); b.addEventListener('click', () => { if (E.kind !== k){ E.kind = k; E.px = null; E.side = 0; renderTab(); } }); seg.appendChild(b); });
  if (E.kind === 'top') [[0, '正面'], [1, '背面']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(E.side === k)); b.addEventListener('click', () => { E.side = k; renderTab(); }); seg.appendChild(b); });
  body.appendChild(seg);
  const wrap = el('div', ''); wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start';
  const S = 15, cv = document.createElement('canvas'); cv.width = cv.height = 16 * S; cv.style.cssText = 'width:240px;height:240px;touch-action:none;border-radius:8px;border:2px solid #18334a;image-rendering:pixelated;background:#fff;cursor:crosshair';
  const off = () => E.side * 256;
  const draw = () => { const c = cv.getContext('2d'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ c.fillStyle = DESIGN_PAL[E.px[off() + y * 16 + x]]; c.fillRect(x * S, y * S, S, S); } c.strokeStyle = 'rgba(24,51,74,.12)'; c.lineWidth = 1; for (let i = 1; i < 16; i++){ c.beginPath(); c.moveTo(i * S + 0.5, 0); c.lineTo(i * S + 0.5, 16 * S); c.stroke(); c.beginPath(); c.moveTo(0, i * S + 0.5); c.lineTo(16 * S, i * S + 0.5); c.stroke(); } drawPrev(); };
  const fill = (x, y) => { const o = off(), from = E.px[o + y * 16 + x], to = E.col; if (from === to) return; const st = [[x, y]]; while (st.length){ const [a, b] = st.pop(); if (a < 0 || b < 0 || a > 15 || b > 15 || E.px[o + b * 16 + a] !== from) continue; E.px[o + b * 16 + a] = to; st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); } };
  const at = ev => { const r = cv.getBoundingClientRect(); return [Math.floor((ev.clientX - r.left) / r.width * 16), Math.floor((ev.clientY - r.top) / r.height * 16)]; };
  let down = false; const paint = ev => { const [x, y] = at(ev); if (x < 0 || y < 0 || x > 15 || y > 15) return; if (E.tool === 'fill') fill(x, y); else E.px[off() + y * 16 + x] = E.tool === 'erase' ? 0 : E.col; draw(); };
  cv.addEventListener('pointerdown', ev => { down = true; cv.setPointerCapture(ev.pointerId); paint(ev); ev.preventDefault(); }); cv.addEventListener('pointermove', ev => { if (down && E.tool !== 'fill') paint(ev); }); cv.addEventListener('pointerup', () => { down = false; }); cv.addEventListener('pointercancel', () => { down = false; });
  wrap.appendChild(cv);
  const side = el('div', ''); side.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:150px';
  const pal = el('div', ''); pal.style.cssText = 'display:grid;grid-template-columns:repeat(8,22px);gap:4px';
  DESIGN_PAL.forEach((c, i) => { const b = el('button', ''); b.style.cssText = `width:22px;height:22px;border-radius:5px;background:${c};border:${E.col === i ? '3px solid #18334a' : '1px solid rgba(24,51,74,.25)'};padding:0`; b.setAttribute('aria-label', '顏色 ' + (i + 1)); b.addEventListener('click', () => { E.col = i; if (E.tool === 'erase') E.tool = 'pen'; renderTab(); }); pal.appendChild(b); });
  side.appendChild(pal);
  const tools = el('div', 'seg'); [['pen', '✏️ 畫筆'], ['fill', '🪣 填色'], ['erase', '🧽 橡皮擦']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(E.tool === k)); b.addEventListener('click', () => { E.tool = k; renderTab(); }); tools.appendChild(b); }); side.appendChild(tools);
  const clr = el('button', 'tbtn ghost', '全部清掉'); clr.addEventListener('click', () => { for (let i = 0; i < 256; i++) E.px[off() + i] = 0; draw(); }); side.appendChild(clr);
  /* 用自己的圖片：在手機上把圖片縮成 16×16，每一格換成調色盤裡最接近的顏色（原圖不會上傳，只存格子的顏色） */
  { const fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.hidden = true; const ib = el('button', 'tbtn', '🖼️ 用自己的圖片');
    ib.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { const file = fi.files && fi.files[0]; fi.value = ''; if (!file) return; const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { try { designFromImage(im, E.px, off()); draw(); drawPrev(); toast('🖼️ 圖片變成格子圖了，可以再用畫筆修一修'); } catch(e){ toast('這張圖片讀不出來，換一張試試'); } URL.revokeObjectURL(url); };
      im.onerror = () => { URL.revokeObjectURL(url); toast('這張圖片讀不出來，換一張試試'); }; im.src = url; });
    side.append(ib, fi); }
  const prev = el('img'); prev.alt = '預覽'; prev.style.cssText = 'width:120px;height:120px;border-radius:10px;background:#eef4f7'; side.appendChild(prev);
  const drawPrev = () => { const pxs = E.px.map(v => v.toString(16)).join(''); Designs.map.set(0, { id: 0, kind: E.kind, px: pxs }); for (const [k] of DESIGN_SLOTS) Designs.mats.delete('0:' + k); try { const g = Object.assign(cleanGear(rec.gear), { [E.kind]: E.kind + '_dz0' }); AvShot.cache.clear(); prev.src = avatarShot(g, E.side || E.kind === 'back' ? 'back' : E.kind === 'hat' ? 'hat' : E.kind === 'shoes' ? 'shoes' : 'full', 160); } catch(e){} };
  wrap.appendChild(side); body.appendChild(wrap); draw();
  const f1 = el('div', 'field'); f1.appendChild(el('label', '', '名字（最多 16 個字）')); const ni = el('input'); ni.maxLength = 16; ni.value = E.name; ni.placeholder = '我的設計'; ni.addEventListener('input', () => { E.name = ni.value; }); f1.appendChild(ni); body.appendChild(f1);
  const f2 = el('div', 'field'); f2.appendChild(el('label', '', '在市集賣多少金幣（0 ＝ 免費送大家）')); const pi = el('input'); pi.type = 'number'; pi.min = 0; pi.max = 5000; pi.value = E.price; pi.addEventListener('input', () => { E.price = clamp(Math.round(+pi.value || 0), 0, 5000); }); f2.appendChild(pi); body.appendChild(f2);
  const bar = el('div', 'tankbar'), sv = el('button', 'tbtn', E.busy ? '儲存中…' : '💾 儲存並穿上'), bk = el('button', 'tbtn ghost', '取消');
  sv.disabled = E.busy; sv.addEventListener('click', async () => { if (!Cloud.on || !Cloud.sb){ toast('要連上雲端（登入）才能儲存設計'); return; } E.busy = true; renderTab();
    try { const { data, error } = await Cloud.sb.rpc('save_design', { p_kind: E.kind, p_name: E.name, p_px: E.px.map(v => v.toString(16)).join(''), p_price: E.price }); if (error) throw error;
      Designs.map.set(data.id, data); const item = E.kind + '_dz' + data.id; if (!rec.owned.includes(item)) rec.owned.push(item); E.busy = false; E.px = null; E.name = ''; toast(`🎨 存好了！「${esc(data.name)}」已經放到設計師市集`); wearDesign(item); curTab = 'style'; renderTab(); }
    catch(e){ E.busy = false; toast(String(e.message || '').includes('今天') ? '今天設計太多件了，明天再來' : '存不起來，等一下再試'); renderTab(); } });
  bk.addEventListener('click', () => { curTab = 'style'; renderTab(); }); bar.append(sv, bk); body.appendChild(bar);
}
// 設計師市集
const Market = { mode:'new', kind:'top', list:null, at:0, busy:false };
async function loadMarket(){ if (!Cloud.on || !Cloud.sb) return; Market.busy = true; try { const { data } = await Cloud.sb.rpc('list_designs', { p_mode: Market.mode, p_offset: 0 }); Market.list = data || []; for (const d of Market.list) Designs.map.set(d.id, d); } catch(e){ Market.list = []; } Market.busy = false; Market.at = Date.now(); if (!$('#sheet').hidden && (curTab === 'market' || curTab === 'shop')) renderTab(); }
function renderMarket(body, inShop){
  if (!inShop){ const head = el('div', 'shophead'); head.innerHTML = `<b>🛍️ 設計師市集</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head); }
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能逛市集。')); return; }
  if (inShop){ body.appendChild(el('p', 'sub', '👗 阿綾每天早上 10 點、傍晚 6 點左右會設計一件新的放到店裡。買了就是你的。'));
    const go = el('button', 'tbtn ghost', '🛍️ 去設計師市集看大家的設計'); go.addEventListener('click', () => { Market.mode = 'new'; Market.list = null; curTab = 'market'; renderTab(); }); body.appendChild(go); }
  if (!inShop){
  body.appendChild(el('p', 'sub', '大家自己設計的衣服、帽子、鞋子、披風和領巾。買了就是你的，九成的錢給設計的人（每個設計師一天最多從市集收 3000 金幣）。要錢的設計要先釣到 30 條魚才能買。'));
  if (Market.mode === 'ling') body.appendChild(el('p', 'sub', '👗 阿綾服裝店：村子裡的設計師阿綾每天早上 10 點、傍晚 6 點左右會設計一件新的，設計過的都會一直留在店裡。'));
  const seg = el('div', 'seg'); [['ling', '👗 阿綾的店'], ['new', '🆕 新上架'], ['hot', '🔥 最多人買'], ['mine', '🎨 我的設計']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(Market.mode === k)); b.addEventListener('click', () => { Market.mode = k; Market.list = null; loadMarket(); renderTab(); }); seg.appendChild(b); });
  const nb = el('button', '', '＋ 自己設計'); nb.addEventListener('click', () => { DesignEd.px = null; curTab = 'design'; renderTab(); }); seg.appendChild(nb); body.appendChild(seg); }
  if (!Market.list){ if (!Market.busy) loadMarket(); body.appendChild(el('div', 'empty', '載入中…')); return; }
  if (!Market.list.length){ body.appendChild(el('div', 'empty', Market.mode === 'mine' ? '你還沒有設計。按「＋ 自己設計」開始畫吧！' : '市集還沒有東西，來當第一個設計師吧！')); return; }
  const ul = el('ul', 'shoplist');
  for (const d of Market.list){ const item = d.kind + '_dz' + d.id, own = ownsDesign(item), on = cleanGear(rec.gear)[d.kind] === item, li = el('li', on ? 'on' : '');
    if (d.px) li.appendChild(designThumb(d.px, d.kind, 40)); else li.appendChild(el('span', 'dishic', '🚫'));
    const inf = el('div', 'tinfo'); inf.appendChild(el('div', 'n', `${({ top:'👕', pants:'👖', hat:'👒', shoes:'👟', back:'🦸', acc:'🧣' })[d.kind] || '👕'} ${d.name}`)); inf.appendChild(el('div', 'sub2', `${d.by || ''} 設計・賣出 ${d.sold}・${d.price ? '🪙' + d.price : '免費'}${d.mine && !d.listed ? '・已下架' : ''}`)); li.appendChild(inf);
    const a = el('div', 'tacts');
    if (d.mine){ const pb = el('button', 'tbtn ghost', '改價錢'); pb.addEventListener('click', async () => { const v = prompt('新的價錢（0～5000）', String(d.price)); if (v == null) return; const p = clamp(Math.round(+v || 0), 0, 5000); try { const { data } = await Cloud.sb.rpc('edit_design', { p_id: d.id, p_price: p, p_listed: null }); Object.assign(d, data); renderTab(); } catch(e){} });
      const lb = el('button', 'tbtn ghost', d.listed ? '下架' : '上架'); lb.addEventListener('click', async () => { try { const { data } = await Cloud.sb.rpc('edit_design', { p_id: d.id, p_price: null, p_listed: !d.listed }); Object.assign(d, data); renderTab(); } catch(e){} }); a.append(pb, lb); }
    if (own && !on){ const b = el('button', 'tbtn', '穿上'); b.addEventListener('click', () => wearDesign(item)); a.appendChild(b); }
    if (!own){ const b = el('button', 'tbtn' + (rec.coins < d.price ? ' ghost' : ''), d.price ? `買 🪙${d.price}` : '免費拿'); b.addEventListener('click', async () => { if (rec.coins < d.price){ toast('金幣不夠'); return; } b.disabled = true; const row = await cloudCall('buy_design', { p_id: d.id }); if (row){ SFX.catch(); toast(`買到了「${esc(d.name)}」！`); wearDesign(item); } renderTab(); }); a.appendChild(b);
      const rp = el('button', 'tbtn ghost', '檢舉'); rp.addEventListener('click', async () => { if (!confirmOnce(rp)) return; try { await Cloud.sb.rpc('report_design', { p_id: d.id, p_reason: '不適當的圖案' }); toast('謝謝你，我們收到了'); rp.disabled = true; } catch(e){ toast('今天檢舉太多次了'); } }); a.appendChild(rp); }
    li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}
function confirmOnce(b){ if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; const t = b.textContent; b.textContent = '確定？'; setTimeout(() => { if (b.isConnected){ b.dataset.sure = ''; b.textContent = t; } }, 2500); return false; }
// ===== 推播通知（048、Edge Function tide-push）：遊戲關著時手機也會跳通知 =====
const PUSH_KINDS = [['market', '🐟 你在魚市的魚賣掉了'], ['rs', '🦈 紅鯊（有人釣到、生小鯊）'], ['tourney', '🏆 釣魚大賽快開始'], ['cage', '🐟 箱網還沒餵（晚上 8 點）'], ['design', '👕 有人買了你的設計'], ['visit', '🏝 有人來你的小島'], ['fu', '🐟 阿福的今日收購（早上 6 點）'], ['gang', '⚓ 老港的每週手作（週一早上 9 點）'], ['news', '📰 你上報了'], ['cai', '🎨 阿彩畫了你的魚']];
const Push = { busy:false, sub:null, prefs:null, checked:false, msg:'' };
function pushOk(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function b64u(s){ const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function pushFn(body){ const { data, error } = await Cloud.sb.functions.invoke('tide-push', { body }); if (error) throw error; return data; }
async function pushCheck(){ if (Push.checked || !pushOk() || !Cloud.on) return; Push.checked = true;
  try { const reg = await navigator.serviceWorker.ready, s = await reg.pushManager.getSubscription(); Push.sub = s;
    if (s){ const { data } = await Cloud.sb.from('push_subs').select('uid,prefs').eq('endpoint', s.endpoint).maybeSingle(); if (data) Push.prefs = data.prefs || {}; else await pushSave(s); }   /* 換帳號了：這支手機的訂閱改到現在的帳號 */
  } catch(e){} if (!$('#sheet').hidden && curTab === 'style') renderTab(); }
async function pushSave(s){
  const row = { endpoint: s.endpoint, uid: Cloud.userId, sub: s.toJSON(), prefs: Push.prefs || {} };
  let { error } = await Cloud.sb.from('push_subs').upsert(row);
  if (error){ try { await s.unsubscribe(); } catch(e){} const reg = await navigator.serviceWorker.ready, { pub } = await pushFn({ action:'pub' }); const s2 = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(pub) }); Push.sub = s2; ({ error } = await Cloud.sb.from('push_subs').upsert(Object.assign(row, { endpoint: s2.endpoint, sub: s2.toJSON() }))); }   /* 這支手機以前是別的帳號訂的：重新訂一次 */
  if (error) throw error; Push.prefs = row.prefs;
}
async function pushOn(){
  if (!pushOk()){ Push.msg = '這個瀏覽器不支援通知。iPhone 要先用 Safari「分享 → 加入主畫面」，再從主畫面打開遊戲才能開通知。'; renderTab(); return; }
  if (!Cloud.on){ Push.msg = '要先連上雲端（登入）才能開通知。'; renderTab(); return; }
  Push.busy = true; Push.msg = ''; renderTab();
  try { const perm = await Notification.requestPermission();
    if (perm !== 'granted'){ Push.msg = '通知被擋住了：到瀏覽器的「網站設定 → 通知」把這個網站改成「允許」，再按一次開啟。'; Push.busy = false; renderTab(); return; }
    const reg = await navigator.serviceWorker.ready, { pub } = await pushFn({ action:'pub' }); if (!pub) throw new Error('no key');
    const s = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(pub) });
    Push.sub = s; await pushSave(s); await pushFn({ action:'test' }); Push.msg = '✅ 通知開好了，等一下會收到一則測試通知。'; }
  catch(e){ Push.msg = '通知還沒辦法開（伺服器那邊的通知程式可能還沒裝好），晚一點再試試看。'; console.warn('push', e); }
  Push.busy = false; renderTab();
}
async function pushOff(){ Push.busy = true; renderTab(); try { const s = Push.sub; if (s){ await Cloud.sb.from('push_subs').delete().eq('endpoint', s.endpoint); await s.unsubscribe(); } } catch(e){} Push.sub = null; Push.prefs = null; Push.busy = false; Push.msg = '已經關掉通知了。'; renderTab(); }
async function pushPref(k, on){ Push.prefs = Object.assign({}, Push.prefs || {}, { [k]: on }); renderTab(); try { await Cloud.sb.rpc('set_push_prefs', { p: Push.prefs }); } catch(e){} }
function renderPushBox(body){
  const f = el('div', 'field'); f.appendChild(el('label', '', '🔔 通知（遊戲關著的時候，手機也會跳通知）')); body.appendChild(f);
  pushCheck();
  const bar = el('div', 'tankbar');
  if (Push.sub){ const b = el('button', 'tbtn ghost', '關閉通知'); b.disabled = Push.busy; b.addEventListener('click', pushOff); bar.appendChild(b); }
  else { const b = el('button', 'tbtn', Push.busy ? '設定中…' : '開啟通知'); b.disabled = Push.busy; b.addEventListener('click', pushOn); bar.appendChild(b); }
  body.appendChild(bar);
  if (Push.msg) body.appendChild(el('p', 'sub', Push.msg));
  if (Push.sub){ const ul = el('ul', 'shoplist'); for (const [k, l] of PUSH_KINDS){ const on = !Push.prefs || Push.prefs[k] !== false, li = el('li', on ? 'on' : ''); li.appendChild(el('div', 'tinfo')).appendChild(el('div', 'n', l));
      const b = el('button', 'tbtn' + (on ? '' : ' ghost'), on ? '開' : '關'); b.setAttribute('aria-pressed', String(on)); b.addEventListener('click', () => pushPref(k, !on)); li.appendChild(b); ul.appendChild(li); } body.appendChild(ul); }
}
// 外觀：髮型、髮色、膚色、眼睛顏色（免費，隨時可以換）
function setLook(L){ rec.gear = Object.assign(cleanGear(rec.gear), { look: lookStr(L) }); saveRecLocal(); me.setGear(rec.gear); pushPresence(true); clearTimeout(setLook.t); setLook.t = setTimeout(() => cloudCall('set_gear', { p_gear: rec.gear }), 800); AvShot.cache.clear(); renderTab(); }
function renderLookEd(body){
  const g0 = cleanGear(rec.gear), L = lookParse(g0.look);
  body.appendChild(el('p', 'sub', '外觀全部免費，隨時可以換。戴帽子的時候，頭頂上的頭髮（刺刺頭、飛機頭）會被帽子蓋住。'));
  body.appendChild(el('div', 'dexhead', '💇 髮型'));
  const hs = el('ul', 'shoplist cols');
  LOOK_HAIR.forEach((nm, i) => { const li = el('li', L.h === i ? 'on' : ''), ic = el('img', 'gearic'); ic.alt = nm; try { ic.src = avatarShot(Object.assign({}, g0, { hat:'hat_none', look: lookStr(Object.assign({}, L, { h:i })) }), 'hat', 96); } catch(e){} li.appendChild(ic);
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', nm)); d.appendChild(el('div', 'sub2', L.h === i ? '現在的髮型' : '免費')); li.appendChild(d);
    if (L.h !== i){ const a = el('div', 'tacts'), b = el('button', 'tbtn', '換'); b.addEventListener('click', () => setLook(Object.assign({}, L, { h:i }))); a.appendChild(b); li.appendChild(a); } hs.appendChild(li); });
  body.appendChild(hs);
  const row = (title, cols, key) => { body.appendChild(el('div', 'dexhead', title)); const r = el('div', ''); r.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px';
    cols.forEach((c, i) => { const b = el('button', ''); b.setAttribute('aria-label', title + ' ' + (i + 1)); b.style.cssText = `width:34px;height:34px;border-radius:50%;background:${c};padding:0;border:${L[key] === i ? '3px solid #18334a' : '1px solid rgba(24,51,74,.25)'};box-shadow:${L[key] === i ? '0 0 0 2px #fff inset' : 'none'}`;
      b.addEventListener('click', () => setLook(Object.assign({}, L, { [key]: i }))); r.appendChild(b); }); body.appendChild(r); };
  row('🎨 髮色', LOOK_HC, 'c'); row('🙂 膚色', LOOK_SKIN, 's'); row('👀 眼睛顏色', LOOK_EYE, 'e');
}
function renderWardrobe(body, only){
  const pv = el('div', 'wprev'), showG = cleanGear(Wardrobe.preview || rec.gear), box = el('div', 'pvbox');
  if (pvShow(box, showG)){ box.appendChild(el('small', 'pvhint', '↔ 拖曳可以轉')); if (Wardrobe.preview && Wardrobe.previewOf && GEAR_BY_ID[Wardrobe.previewOf] && GEAR_BY_ID[Wardrobe.previewOf].slot === 'back' && !PV.drag){ PV.yaw = Math.PI + 0.5; PV.idleAt = now() + 2.5; } }
  else { const img = el('img'); img.alt = '試穿預覽'; try { img.src = avatarShot(showG, 'full', 256); } catch(e){} box.appendChild(img); }
  pv.appendChild(box);
  const pi = el('div', 'wpinfo');
  if (Wardrobe.preview){ const it = GEAR_BY_ID[Wardrobe.previewOf]; pi.appendChild(el('b', '', '試穿中')); pi.appendChild(el('span', '', it ? it.name : ''));
    const bk = el('button', 'tbtn ghost', '換回原本'); bk.addEventListener('click', () => { endTryOn(); renderTab(); }); pi.appendChild(bk);
    if (it && !ownsGear(it.id)){ const b = el('button', 'tbtn', `${it.love ? '換' : '買'} ${gearCost(it)}`); b.addEventListener('click', () => buyGear(it.id)); pi.appendChild(b); } }
  else { pi.appendChild(el('b', '', '現在的打扮')); pi.appendChild(el('span', 'sub', '按「試穿」先在這裡看看，買了就是你的，大家都看得到。')); }
  pv.appendChild(pi); body.appendChild(pv);
  if (!only){ const seg = el('div', 'seg wseg');
  for (const [k, l] of GEAR_SLOTS){ const b = el('button', '', l); b.setAttribute('aria-pressed', String(Wardrobe.slot === k)); b.addEventListener('click', () => { Wardrobe.slot = k; renderTab(); }); seg.appendChild(b); }
  body.appendChild(seg); }
  if (!only && Wardrobe.slot === 'look'){ renderLookEd(body); return; }
  const ul = el('ul', 'shoplist cols');
  for (const it of only ? GEAR.filter(only) : GEAR.filter(g => g.slot === Wardrobe.slot && !g.love)){
    const on = cleanGear(rec.gear)[it.slot] === it.id, own = ownsGear(it.id), li = el('li', on ? 'on' : '');
    { const ic = el('img', 'gearic'); ic.alt = it.name; try { ic.src = avatarShot(Object.assign(cleanGear(rec.gear), { [it.slot]: it.id }), it.slot, 96); } catch(e){} li.appendChild(ic); }
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', it.name)); d.appendChild(el('div', 'sub2', on ? '穿著中' : own ? (paidGear(it) ? '已擁有' : '免費') : gearCost(it))); li.appendChild(d);
    const acts = el('div', 'tacts');
    if (!on && own){ const b = el('button', 'tbtn', '穿上'); b.addEventListener('click', () => wearGear(it.id)); acts.appendChild(b); }
    if (!own){ const t = el('button', 'tbtn ghost', '試穿'); t.addEventListener('click', () => tryOn(it.id)); acts.appendChild(t);
      const poor = it.love ? (rec.love || 0) < it.love : rec.coins < it.price;
      const b = el('button', 'tbtn' + (poor ? ' ghost' : ''), it.love ? '換' : '買'); b.addEventListener('click', () => buyGear(it.id)); acts.appendChild(b); }
    li.appendChild(acts); ul.appendChild(li);
  }
  body.appendChild(ul);
  if (!only && DESIGN_SLOTS.some(([k]) => k === Wardrobe.slot)) renderMyDesigns(body, Wardrobe.slot);
}
function renderShop(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>${shopName}</b><span><span class="lovepill">💙 ${(rec.love || 0).toLocaleString()}</span> <span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span></span>`; body.appendChild(head);
  if (shopName === '釣具店'){ const W = WEATHERS[Env.wx], tip = el('div', 'tipbox'); tip.innerHTML = `<b>🧔 老闆的今日情報</b><span>${esc(dailyTip().text)}</span><span>${SEASONS[SEASON].icon} 現在是${SEASONS[SEASON].name}：當季魚有 ${SEASONS[SEASON].fish.map(id => FISH_BY_ID[id] && FISH_BY_ID[id].name).filter(Boolean).join('、')}（比平常多一倍）。</span><span>現在是 ${W.icon} ${W.name}、${Env.tide.icon} ${Env.tide.name}：${esc(W.desc)}${SEA_SPOTS.size ? ' 海邊、外海、小島在漲潮時最好釣，乾潮時比較難。' : ''}</span>`; body.appendChild(tip); }
  const seg = el('div', 'seg'), tailor = shopName === '阿綾服裝店';
  /* 衣服都搬到阿綾服裝店：店裡有原本的服飾，也有阿綾自己設計的 */
  if (tailor && !['wear', 'ling'].includes(shopMode)) shopMode = 'wear'; if (!tailor && ['wear', 'ling'].includes(shopMode)) shopMode = 'sell';
  (tailor ? [['wear', '👕 服飾'], ['ling', '👗 阿綾設計']] : [['sell','賣魚'],['rod','釣竿'],['tool','🧰工具'],['rig','釣法'],['bait','魚餌'],['dive','🤿潛水'],['love','💙愛海']]).forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(shopMode === k)); b.addEventListener('click', () => { shopMode = k; sellConfirm = 0; renderTab(); }); seg.appendChild(b); });
  body.appendChild(seg);
  if (shopMode === 'wear'){ renderWardrobe(body); return; }
  if (shopMode === 'ling'){ if (Market.mode !== 'ling'){ Market.mode = 'ling'; Market.list = null; } renderMarket(body, true); return; }
  if (shopMode === 'dive'){ renderDiveShop(body); return; }
  if (shopMode === 'love'){
    const box = el('div', 'tipbox'); box.innerHTML = `<b>💙 愛海點數：${(rec.love || 0).toLocaleString()}</b><span>把魚放流（釣到時按「放流」，或在魚缸裡放流）就能得到點數：常見魚 1、稀有魚 3、傳說魚 10，<b>未達尺寸的小魚至少 3</b>。你總共放流了 ${rec.released || 0} 條。</span><span>這裡的東西只能用愛海點數換，金幣買不到。</span>`;
    body.appendChild(box); renderWardrobe(body, g => g.love > 0); return;
  }
  if (shopMode === 'tool'){
    body.appendChild(el('p', 'sub', '釣魚用的工具，買一次就一直有，會自動使用。'));
    { body.appendChild(el('div', 'dexhead', '🧰 工具')); const ul = el('ul', 'shoplist'), own = hasNet(), li = el('li', own ? 'on' : ''); li.appendChild(el('span', 'dishic', NET.icon));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', NET.name)); d.appendChild(el('div', 'meta', NET.desc)); li.appendChild(d);
      const b = el('button', 'tbtn' + (own ? ' ghost' : ''), own ? '已經有了' : `買 🪙${NET.price}`); b.disabled = own;
      b.addEventListener('click', async () => { if (rec.coins < NET.price){ toast(`金幣不夠，還差 🪙${(NET.price - rec.coins).toLocaleString()}`); return; }
        if (Cloud.on){ b.disabled = true; const row = await cloudCall('buy_tool', { p_tool: NET.id }); if (row){ SFX.catch(); toast(`買到了 ${NET.icon}<b>${NET.name}</b>！`); } renderTab(); return; }
        rec.owned.push(NET.id); addCoins(-NET.price); saveRecLocal(); SFX.catch(); toast(`買到了 ${NET.icon}<b>${NET.name}</b>！`); renderTab(); });
      li.appendChild(b); ul.appendChild(li); body.appendChild(ul); }
    return;
  }
  if (shopMode === 'rig'){
    body.appendChild(el('p', 'sub', '釣法和釣線都免費，可以隨時換。看你想釣什麼魚就換什麼。'));
    for (const [title, T, key] of [['🎯 釣法', RIGS, 'rig'], ['🧵 釣線', LINES, 'line']]){
      body.appendChild(el('div', 'dexhead', title)); const ul = el('ul', 'shoplist');
      for (const [k, v] of Object.entries(T)){ const on = Rig[key] === k, li = el('li', on ? 'on' : ''); li.appendChild(el('span', 'dishic', v.icon));
        const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', v.name)); d.appendChild(el('div', 'meta', v.desc)); li.appendChild(d);
        const b = el('button', 'tbtn' + (on ? ' ghost' : ''), on ? '使用中' : '換上'); b.disabled = on; b.addEventListener('click', () => { Rig[key] = k; saveRig(); SFX.chat(); renderTab(); }); li.appendChild(b); ul.appendChild(li); }
      body.appendChild(ul); }
    return;
  }
  if (shopMode === 'sell'){
    if (Cloud.on && (!ECON.at || Date.now() - ECON.at > 5 * 60000)) loadEcon();
    { const E = Object.entries(ECON.m || {}).filter(([id]) => FISH_BY_ID[id] && !FISH_BY_ID[id].of).sort((a, b) => b[1].m - a[1].m); if (Cloud.on && E.length){ const hi = E.filter(e => e[1].m >= 1.08).slice(0, 3), lo = E.filter(e => e[1].m <= 0.92).slice(-3);
      const box = el('p', 'sub'); box.textContent = `📈 今日行情：${hi.length ? hi.map(([id, e]) => `${FISH_BY_ID[id].name} ×${(+e.m).toFixed(2)}`).join('、') + ' 比較缺貨，收得比較貴' : '大部分的魚價錢都正常'}${lo.length ? `；${lo.map(([id, e]) => `${FISH_BY_ID[id].name} ×${(+e.m).toFixed(2)}`).join('、')} 最近太多人賣，價錢比較低` : ''}。村民釣的魚也會賣給商店，食堂每小時會用掉一些。`; body.appendChild(box); } }
    const locked = new Set(rec.show || []);
    const favN = rec.tank.filter(x => x.k).length, list = rec.tank.filter(x => !locked.has(x.t) && !FISH_BY_ID[x.f].rs && !x.k).sort((a, b) => fishPrice(FISH_BY_ID[b.f], b.w) - fishPrice(FISH_BY_ID[a.f], a.w));
    body.appendChild(el('p', 'sub', `${favN ? `⭐ 收藏的 ${favN} 條不會出現在這裡，也不會被賣掉。` : '在魚缸分頁按 ☆ 可以收藏魚，收藏的魚不會被賣掉。'}魚缸裡的魚可以賣掉換金幣，越重越值錢。${locked.size ? `水族館展示中的 ${locked.size} 條在最下面，也可以直接賣（會自動從水族館拿出來）。` : ''}`));
    const shownList = rec.tank.filter(x => locked.has(x.t) && !FISH_BY_ID[x.f].rs && !x.k).sort((a, b) => fishPrice(FISH_BY_ID[b.f], b.w) - fishPrice(FISH_BY_ID[a.f], a.w));
    if (!list.length && !shownList.length){ body.appendChild(el('div', 'empty', '沒有可以賣的魚。去釣幾條再回來吧！')); return; }
    const commons = list.filter(x => FISH_BY_ID[x.f].rarity === '常見'), csum = commons.reduce((a, x) => a + itemPrice(x), 0);
    if (commons.length){
      const all = el('button', 'tbtn' + (sellConfirm ? ' warn' : ''), sellConfirm ? `確定賣掉 ${commons.length} 條常見魚？` : `賣掉全部常見魚（${commons.length} 條，+${csum}）`);
      all.addEventListener('click', () => { if (!sellConfirm){ sellConfirm = 1; renderTab(); return; } let got = 0; for (const x of commons) got += sellFish(x.t, true); cloudCall('sell_fish', { p_ts: commons.map(x => x.t) }); sellConfirm = 0; afterSell(got, commons.length); });
      const bar = el('div', 'tankbar'); bar.appendChild(all); body.appendChild(bar);
    }
    const ul = el('ul', 'shoplist cols');
    for (const x of list){
      const f = FISH_BY_ID[x.f], price = itemPrice(x), li = el('li', ''); li.appendChild(fishCanvas(f, true, 56, 36));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${f.name} ${sexIcon(x)}${x.y ? ' 🍼' : ''}`)); d.appendChild(el('div', 'meta', `${fmtKg(x.w)}・${f.rarity}`)); li.appendChild(d);
      const acts = el('div', 'tacts'), b = el('button', 'tbtn', `賣 🪙${price}`);
      b.addEventListener('click', () => afterSell(sellFish(x.t), 1));
      acts.appendChild(b); li.appendChild(acts); ul.appendChild(li);
    }
    body.appendChild(ul);
    if (shownList.length){   // 展示中的魚也能賣：先從水族館拿出來再賣（不用跑去魚缸分頁）
      body.appendChild(el('div', 'dexhead', '🏛️ 水族館展示中')); const u2 = el('ul', 'shoplist cols');
      for (const x of shownList){ const f = FISH_BY_ID[x.f], price = itemPrice(x), li = el('li', 'on'); li.appendChild(fishCanvas(f, true, 56, 36));
        const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', f.name)); d.appendChild(el('div', 'meta', `${fmtKg(x.w)}・${f.rarity}・展示中`)); li.appendChild(d);
        const acts = el('div', 'tacts'), b = el('button', 'tbtn', `賣 🪙${price}`);
        b.addEventListener('click', () => { rec.show = (rec.show || []).filter(t => t !== x.t); saveRecLocal(); cloudCall('set_show', { p_show: rec.show.slice() }); buildTank(); afterSell(sellFish(x.t), 1); });
        acts.appendChild(b); li.appendChild(acts); u2.appendChild(li); }
      body.appendChild(u2); }
  } else if (shopMode === 'rod'){
    body.appendChild(el('p', 'sub', '換一支好竿子，拉線時比較不容易斷，也更容易遇到稀有魚。甩竿哪裡都能用；手竿、遠投竿、磯釣竿在對的地方用，稀有魚多一點、魚咬得快一點，用錯地方就差一點。買過的竿子都放在包包裡，隨時可以換。'));
    let ul = null, lastT = null;
    for (const r of RODS){
      if (rodType(r) !== lastT){ lastT = rodType(r); const T = ROD_TYPES[lastT]; const h = el('div', 'dexhead', `${T.icon} ${T.name}`); h.appendChild(el('small', '', T.fit ? '最適合：' + T.fit.map(id => SPOT_BY_ID[id].label).join('、') : '哪裡都可以用')); body.appendChild(h); ul = el('ul', 'shoplist'); body.appendChild(ul); }
      const owned = rec.rods.includes(r.id), using = rec.rod === r.id, li = el('li', using ? 'on' : '');
      const sw = el('span', 'rodsw'); sw.style.background = r.color; li.appendChild(sw);
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', r.name)); d.appendChild(el('div', 'meta', r.desc)); li.appendChild(d);
      const b = el('button', 'tbtn' + (using ? ' ghost' : ''), using ? '使用中' : owned ? '換上' : `買 🪙${r.price.toLocaleString()}`);
      b.disabled = using;
      b.addEventListener('click', async () => {
        if (!owned && rec.coins < r.price){ toast(`金幣不夠，還差 🪙${(r.price - rec.coins).toLocaleString()}`); return; }
        if (Cloud.on){ b.disabled = true; b.textContent = '處理中…'; const row = await cloudCall('buy_rod', { p_rod: r.id }); if (row && !owned){ SFX.catch(); toast(`買到了 <b>${esc(r.name)}</b>！`); } renderTab(); return; }   // 由伺服器確認金幣
        if (!owned){ rec.rods.push(r.id); addCoins(-r.price); SFX.catch(); toast(`買到了 <b>${esc(r.name)}</b>！`); }
        rec.rod = r.id; saveRecLocal(); me.setRod(r.id); updateBobberLook(); pushPresence(true); renderTab();
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
    body.appendChild(el('div', 'dexhead', '🍚 打窩用的窩料')); body.appendChild(el('p', 'sub', '在水邊按「🍚 打窩」把窩料丟到水裡，過幾秒魚會聚過來。在窩點裡下竿，魚更快上鉤、稀有魚更多。效果會慢慢變弱，大廳裡的人也能來你的窩點一起釣。'));
    const uc = el('ul', 'shoplist');
    for (const c of CHUMS){ const n = rec.bait[c.id] || 0, li = el('li'); const sw = el('span', 'rodsw'); sw.style.background = c.color; li.appendChild(sw);
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${c.name}　×${n}`)); d.appendChild(el('div', 'meta', `${c.desc} 一包 ${c.pack} 份。`)); li.appendChild(d);
      const a = el('div', 'tacts'), buy = el('button', 'tbtn', `買一包 🪙${c.price}`);
      buy.addEventListener('click', async () => { if (rec.coins < c.price){ toast(`金幣不夠，還差 🪙${c.price - rec.coins}`); return; }
        if (Cloud.on){ buy.disabled = true; buy.textContent = '處理中…'; const row = await cloudCall('buy_bait', { p_bait: c.id }); if (row) SFX.chat(); renderTab(); return; }
        rec.bait[c.id] = n + c.pack; addCoins(-c.price); saveRecLocal(); SFX.chat(); renderTab(); });
      a.appendChild(buy); li.appendChild(a); uc.appendChild(li); }
    body.appendChild(uc);
  }
}
function afterSell(got, n){ if (got > 0) SFX.coin();
  if (!got) return;
  buildTank(); SFX.catch(); flash(`+${got} 金幣`, 1.1);
  logMsg('', `你賣了 ${n} 條魚，得到 ${got} 金幣`, true); renderTab();
}

function emptyRec(){ return { gear:{}, owned:[], island:{ v:2, items:[] }, dishes:[], total:0, bestW:0, bestFish:null, best:{}, count:{}, tank:[], show:[], legend:0, updatedAt:0, coins:0, rod:'bamboo', rods:['bamboo'], bait:{}, baitOn:null, sold:0, earned:0, love:0, released:0, dive:[], photos:[] }; }
const SHOW_MAX = 100, KEEP_MAX = 200, FAV_MAX = 100;
// 箱網養殖（參考澎湖的圓形箱網；伺服器 041）：一個人一個箱網、最多 6 條；每天餵一次（20 金幣），每條魚往最大重量長 12%
var CAGE = { x:-17.6, z:92.8, max:6, feed:20, k:0.12, pos:[[-15.6, 90.6], [-15.6, 95.0], [-20.0, 90.6], [-20.0, 95.0]], r:1.7 };
const FARM = new Set(['grouper','amberjack','blackbream','girella','rabbitfish','lethrinus','milkfish','tilapia','mullet','barramundi','scat','mangsnapper','trevally']);   /* FAV：打星號收藏的魚（不能賣、不會被擠掉；伺服器 039） */
// 魚缸保留最新 200 條；有被選去展示的魚不會被擠掉
function trimTank(){ const keep = new Set(rec.show || []); let others = 0; rec.tank = rec.tank.filter(x => keep.has(x.t) || x.rs || x.k || ++others <= KEEP_MAX); }   /* 赤紅霸王鯊不會被擠掉 */
function shownFish(){ if (visiting) return visiting.list; const set = new Set(rec.show || []); return rec.tank.filter(x => set.has(x.t)); }   /* 只放玩家自己選的魚（不再自動展示最新的魚） */
function saveRecLocal(){ rec.updatedAt = Date.now(); LS.set('tide.rec', rec); }
function normRec(r){
  const e = emptyRec(); if (!r || typeof r !== 'object') return e;
  e.breedAt = Number(r.breedAt) || 0;   /* 水族館繁殖上次算到哪 */
  e.total = Number(r.total) || 0; e.bestW = Number(r.bestW) || 0; e.bestFish = FISH_BY_ID[r.bestFish] ? r.bestFish : null; e.legend = Number(r.legend) || 0; e.updatedAt = Number(r.updatedAt) || 0;
  for (const f of FISH){ if (r.best && Number(r.best[f.id]) > 0) e.best[f.id] = Number(r.best[f.id]); if (r.count && Number(r.count[f.id]) > 0) e.count[f.id] = Number(r.count[f.id]); }
  if (Array.isArray(r.tank)) e.tank = r.tank.filter(x => x && FISH_BY_ID[x.f]).slice(0, KEEP_MAX + SHOW_MAX + FAV_MAX).map(x => Object.assign({ f:x.f, w:Number(x.w)||0, t:Number(x.t)||0 }, typeof x.rs === 'string' && /^\d+:[MF]:\d+$/.test(x.rs) ? { rs:x.rs } : {}, { s: x.s === 'M' || x.s === 'F' ? x.s : (Math.floor(Number(x.t) || 0) % 2 === 0 ? 'M' : 'F') },   /* 以前釣的魚沒有記公母：用時間決定（跟 037 一樣） */ x.b ? { b:true } : {}, x.y ? { y:true } : {}, x.k ? { k:true } : {}, x.fm ? { fm:true } : {}, typeof x.g === 'string' && FISH_BY_ID[x.g] ? { g:x.g } : {}, typeof x.gp === 'string' && /^[wrbykp]{2}\|[dso]{2}$/.test(x.gp) ? { gp:x.gp } : {}));   /* k：打星號收藏；fm：箱網養大的；rs：赤紅霸王鯊的編號、性別、叉叉 */
  if (Array.isArray(r.show)){ const ts = new Set(e.tank.map(x => x.t)); e.show = r.show.map(Number).filter(t => ts.has(t)).slice(0, SHOW_MAX); }
  // 經濟（金幣、釣竿、魚餌）
  if (r.island && typeof r.island === 'object') e.island = cleanIsland(r.island);
  if (Array.isArray(r.owned)) e.owned = [...new Set(r.owned.filter(id => paidGear(GEAR_BY_ID[id]) || /^(top|pants|hat|shoes|back|acc)_dz\d+$/.test(id) || /^tool_/.test(id)))];
  { const g = cleanGear(r.gear); for (const k in g){ const it = GEAR_BY_ID[g[k]]; if (paidGear(it) && !e.owned.includes(it.id)) g[k] = GEAR_DEFAULT[k]; } e.gear = g; }
  if (Array.isArray(r.dishes)) e.dishes = r.dishes.filter(d => d && RECIPES[d.r]).slice(0, 100).map(d => ({ r:d.r, q:clamp(Math.round(Number(d.q) || 1), 1, 3), t:Number(d.t) || 0 }));
  e.coins = Math.max(0, Math.floor(Number(r.coins) || 0)); e.love = Math.max(0, Math.floor(Number(r.love) || 0)); e.released = Math.max(0, Math.floor(Number(r.released) || 0)); e.shrimpUntil = Number(r.shrimpUntil) || 0; e.sevGot = r.sevGot && typeof r.sevGot === 'object' ? r.sevGot : {}; e.srods = Array.isArray(r.srods) ? r.srods.filter(x => SHRIMP_RODS.some(y => y.id === x)) : []; e.srod = typeof r.srod === 'string' ? r.srod : 'srod_basic'; e.dive = Array.isArray(r.dive) ? [...new Set(r.dive.filter(id => DIVE_BY_ID[id]))] : []; e.photos = Array.isArray(r.photos) ? [...new Set(r.photos.filter(id => FISH_BY_ID[id]))] : []; e.sold = Number(r.sold) || 0; e.earned = Number(r.earned) || 0;
  if (Array.isArray(r.rods)) e.rods = ['bamboo', ...r.rods.filter(id => id !== 'bamboo' && RODS.some(x => x.id === id))];
  e.rod = e.rods.includes(r.rod) ? r.rod : 'bamboo';
  if (r.bait && typeof r.bait === 'object') for (const b of BAITS.concat(CHUMS)){ const n = Math.floor(Number(r.bait[b.id]) || 0); if (n > 0) e.bait[b.id] = Math.min(999, n); }
  e.baitOn = BAITS.some(b => b.id === r.baitOn) ? r.baitOn : null;
  e.cage = Array.isArray(r.cage) ? r.cage.filter(x => x && FISH_BY_ID[x.f]).slice(0, CAGE.max).map(x => Object.assign({ f:x.f, w:Number(x.w)||0, w0:Number(x.w0)||Number(x.w)||0, t:Number(x.t)||0, at:Number(x.at)||0 }, x.s === 'M' || x.s === 'F' ? { s:x.s } : {}, x.k ? { k:true } : {})) : [];
  e.cageFed = typeof r.cageFed === 'string' ? r.cageFed.slice(0, 10) : null;
  return e;
}
let rec = normRec(LS.get('tide.rec', null));
if (!LS.get('tide.favInit', 0)){ for (const x of rec.tank) if (FISH_BY_ID[x.f].of && rec.tank.filter(y => y.k).length < FAV_MAX) x.k = true; LS.set('tide.favInit', 1); LS.set('tide.rec', rec); }   /* 以前釣到的變種也自動收藏（只做一次；雲端由 039 做） */
me.setRod(rec.rod); updateBobberLook(); me.setGear(rec.gear); updateBobberLook(); renderCoins(); setTimeout(renderBuff, 0);
function recordCatch(f, w){
  const isNew = !rec.count[f.id]; const isBest = w > (rec.best[f.id] || 0);
  rec.total++; rec.count[f.id] = (rec.count[f.id] || 0) + 1; if (isBest) rec.best[f.id] = w;
  const isTop = w > rec.bestW; if (isTop){ rec.bestW = w; rec.bestFish = f.id; }
  if (f.rarity === '傳說') rec.legend++;
  rec.tank.unshift(Object.assign({ f: f.id, w, t: Date.now() }, f.rs && F.rsTag ? { rs: F.rsTag } : {}, F.sex ? { s: F.sex } : {}, F.brood ? { b: true } : {}, f.of ? { k: true } : {}, isGuppy(f.id) && F.gp ? { gp: F.gp } : {})); trimTank();   /* 變種超級稀有：釣到自動打星號收藏 */
  rec.updatedAt = Date.now();
  LS.set('tide.rec', rec); saveRemote(); buildTank();
  cloudCall('record_catch', { p_fish: f.id, p_weight: w });
  if (Tny.on){ Tny.myW += w; Tny.myN++; }
  return { isNew, isBest: isBest && !isNew };
}

function shade(hex, amt){ const c = new THREE.Color(hex); if (amt < 0) c.lerp(new THREE.Color('#000'), -amt); else c.lerp(new THREE.Color('#fff'), amt); return '#' + c.getHexString(); }
function drawFish(cv, color, known, id){
  if (id === 'marlin' && !FISH_STYLE.marlin) return drawMarlin(cv, known);
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
// 圖鑑的魚圖：畫一次就記起來（新模型三角形比較多，每次重畫手機會卡）
const fishCvCache = new Map();
function fishCanvas(f, known, w, h){ const cv = document.createElement('canvas'); cv.width = w*2; cv.height = h*2; const key = f.id + (known ? 1 : 0) + 'x' + cv.width + 'x' + cv.height;
  let src = fishCvCache.get(key); if (!src){ src = document.createElement('canvas'); src.width = cv.width; src.height = cv.height; drawFish(src, f.color, known, f.id); if (fishCvCache.size > 400) fishCvCache.clear(); fishCvCache.set(key, src); }
  cv.getContext('2d').drawImage(src, 0, 0); return cv; }
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
// 水族館裡住在底下的：螃蟹、龍蝦、蝦子、章魚、比目魚、魟魚…會貼著沙子慢慢爬，不會在水中間游
const TANK_BOTTOM = new Set(['mudcrab', 'fiddler', 'fiddler_blue', 'sawfish', 'mudskipper', 'bigskipper', 'mudskipper_albino', 'crab', 'kingcrab', 'lobster', 'bluelobster', 'crayfish', 'prawn', 'blueclaw', 'goldprawn', 'whiteshrimp', 'tigerprawn', 'octopus', 'flounder', 'stingray', 'hillstream', 'loach', 'angler', 'catfish']);
// 水族館裡魚的大小：不同種類照真實的大小差很多（壓縮過），同一種也會因為重量不同有大有小
function tankScale(f, w){ const avg = (f.min + f.max) / 2, base = 0.2 + 0.13 * Math.log(1 + avg * 4), k = clamp(Math.cbrt(Math.max(0.0001, w) / avg), 0.7, 1.35); return clamp(base * k, 0.16, 1.2); }
// 模型在 1 倍大小時的範圍：水平半徑（會轉向所以前後左右都要算）、上下
const shapeExtCache = {};
function shapeExt(shape, zk){
  const key = shape + '/' + zk; if (shapeExtCache[key]) return shapeExtCache[key];
  let r = 0, y0 = 0, y1 = 0;
  for (const part of Object.keys(FISH_MESH[shape])){ const a = fishGeo(shape, part).attributes.position.array;
    for (let i = 0; i < a.length; i += 3){ r = Math.max(r, Math.hypot(a[i], a[i + 2] * zk)); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); } }
  return (shapeExtCache[key] = { r, y0, y1 });
}
// 水族館的水：x ±5.3、y -1.27（沙面）~ 1.4、z ±1.5，魚整隻都要待在裡面，不會穿出玻璃
const TANK_IN = { x:5.2, z:1.42, y0:-1.26, y1:1.32 };
function tankFit(fish, ext){
  let s = fish.scale; const maxR = TANK_IN.z - 0.12, maxH = (TANK_IN.y1 - TANK_IN.y0) * 0.8;
  s = Math.min(s, maxR / Math.max(0.01, ext.r), maxH / Math.max(0.01, ext.y1 - ext.y0)); fish.scale = s;
  const R = ext.r * s;
  fish.az = Math.max(0, Math.min(fish.az, TANK_IN.z - R));
  fish.cx = clamp(fish.cx, -1, 1) * Math.max(0, Math.min(0.4, TANK_IN.x - R - 2));
  fish.ax = Math.max(0, Math.min(fish.ax, TANK_IN.x - R - Math.abs(fish.cx)));
  fish.ylo = TANK_IN.y0 - ext.y0 * s; fish.yhi = Math.max(fish.ylo, TANK_IN.y1 - ext.y1 * s);
  fish.y = fish.bottom ? fish.ylo : clamp(fish.y, fish.ylo + 0.12, Math.max(fish.ylo + 0.12, fish.yhi - 0.12));
}
function buildTank(){
  if (!tankGroup) return;
  for (const m of tankInst){ tankGroup.remove(m); if (m.isInstancedMesh) m.dispose(); } tankInst = []; tankFish = [];
  const list = shownFish();
  const bySpecies = new Map();
  list.forEach((x, i) => {
    const f = gpyFish(x); const big = BIG_FISH.has(f.id);   /* 孔雀魚每個品系顏色不一樣 */
    const fish = { f, scale: tankScale(f, x.w), zk: FISH_STYLE[f.id] && /^Fish/.test(FISH_STYLE[f.id].shape) ? 1.5 : 1,
      ph: i * 1.7 + Math.random() * 3, ph2: Math.random() * 6, sp: rand(0.15, 0.36), ax: rand(2.4, 4.5), az: rand(0.4, 1.1), y: rand(-0.9, 0.95), cx: rand(-0.4, 0.4), slots: [] };
    if (TANK_BOTTOM.has(f.id)){ fish.bottom = true; fish.y = -1.22; fish.sp *= 0.35; fish.az = rand(0.3, 1.0); }
    tankFish.push(fish);
    if (!FISH_STYLE[f.id] || x.rs){ fish.m = fishModel(f, fish.scale);   // 旗魚：專屬模型；紅鯊每一隻身上的叉叉不一樣，也單獨畫
      const bb = new THREE.Box3().setFromObject(fish.m), k = 1 / fish.scale;
      const ext = { r: Math.max(Math.abs(bb.min.x), bb.max.x, Math.abs(bb.min.z), bb.max.z) * k * 1.05, y0: bb.min.y * k, y1: bb.max.y * k };
      tankFit(fish, ext); fish.m.scale.multiplyScalar(fish.scale * k); if (x.rs) addScars(fish.m, rsInfo(x.rs).scars); tankGroup.add(fish.m); tankInst.push(fish.m); return; }
    tankFit(fish, shapeExt(FISH_STYLE[f.id].shape, fish.zk));
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
// 魚遇到石頭會從上面游過去（螃蟹這類會爬過去），不會穿過石頭
function rockLift(x, z, clear){ let h = -1e9; for (const [rx, rz, s, top] of Dive.rocks || []){ const d = Math.hypot(x - rx, z - rz), k = 1 - d / (s * 1.5); if (k > 0) h = Math.max(h, top + clear - (1 - Math.min(1, k * 2)) * (s + clear)); } return h; }
function tankRockY(x, z, y, bottom){ for (const [rx, rz, r] of TANK_ROCKS){ const d = Math.hypot(x - rx, z - rz), k = 1 - d / (r + (bottom ? 0.15 : 0.35)); if (k > 0){ const top = -1.2 + r * 0.9 + (bottom ? 0.02 : 0.22); y = Math.max(y, y + (top - y) * Math.min(1, k * 2.5)); } } return y; }
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
    const y = clamp(tankRockY(x, z, fish.bottom ? fish.y : fish.y + Math.sin(a * 1.3) * 0.12, fish.bottom), fish.ylo, fish.yhi), ry = Math.atan2(-vz, vx);
    if (fish.m){ fish.m.position.set(x, y, z); fish.m.rotation.y = ry; if (fish.m.userData.tail) fish.m.userData.tail.rotation.y = Math.sin(t * 8 + fish.ph) * 0.4; continue; }
    tankDummy.position.set(x, y, z); tankDummy.rotation.set(0, ry, 0); tankDummy.scale.set(fish.scale, fish.scale, fish.scale * fish.zk); tankDummy.updateMatrix();
    for (const [im, k] of fish.slots){ im.setMatrixAt(k, tankDummy.matrix); touched.add(im); }
  }
  for (const im of touched) im.instanceMatrix.needsUpdate = true;
}

/* ================= 新介面（ui2）：彩色圓形大圖示、左上角頭像、聊天列在下面中間 ================= */
const UI2 = !/ui1/.test(location.hash) && LS.get('tide.ui2', true);   /* 新介面（2026-11-04 使用者確認）；網址加 #ui1 可以看舊的 */
if (UI2) document.body.classList.add('ui2');
function ui2Tick(){
  if (!UI2) return;
  // 左上角的頭像：用自己的角色拍一張大頭照
  try { const mk = $('#brand .mark'); if (mk){ const src = avatarShot(cleanGear(rec.gear), 'face', 96); if (src && mk._src !== src){ mk._src = src; mk.innerHTML = ''; const im = document.createElement('img'); im.src = src; im.alt = ''; mk.appendChild(im); } } } catch(e){}
  { const h = $('#brand h1'); const nm = nickname || '潮汐釣魚村'; if (h && h._nm !== nm){ h._nm = nm; h.textContent = nm; } }   // 左上角顯示自己的名字
  // 紅點：有禮物或好友邀請、有任務可以交
  const dot = (tab, n) => { const b = $(`#menu .mbtn[data-tab="${tab}"]`); if (!b) return; let d = $('.rdot', b); if (!n){ if (d) d.remove(); return; } if (!d){ d = document.createElement('i'); d.className = 'rdot'; b.appendChild(d); } d.textContent = n > 9 ? '9+' : String(n); };
  dot('people', (Fr.gifts || []).length + (Fr.req || []).length);
}
setInterval(ui2Tick, 2000); setTimeout(ui2Tick, 1200);

/* ================= 包包：身上帶的東西（釣竿、魚餌、窩料、料理、潛水用品、蝦竿…）================= */
function renderBag(body){
  const sec = (title, sub) => { const h = el('div', 'dexhead', title); if (sub) h.appendChild(el('small', '', sub)); body.appendChild(h); const ul = el('ul', 'shoplist bag'); body.appendChild(ul); return ul; };
  const row = (ul, ic, name, meta, btnTxt, fn, on) => { const li = el('li', on ? 'on' : ''); const i = el('span', 'dishic', ic); li.appendChild(i); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', name)); if (meta) d.appendChild(el('div', 'meta', meta)); li.appendChild(d);
    if (btnTxt){ const b = el('button', 'tbtn' + (on ? ' ghost' : ''), btnTxt); b.disabled = !fn; if (fn) b.addEventListener('click', () => { b.disabled = true; fn(); }); li.appendChild(b); } ul.appendChild(li); return li; };
  { const w = el('div', 'bagwallet'); w.innerHTML = `<span>🪙 <b>${rec.coins.toLocaleString()}</b> 金幣</span><span>💙 <b>${rec.love || 0}</b> 愛海點數</span>${shrimpLeft() ? `<span>🎫 釣蝦 <b>${mmss(shrimpLeft())}</b></span>` : ''}<span>🐟 魚缸 <b>${rec.tank.length}</b> 條</span>`; body.appendChild(w); }
  // 釣竿
  { const ul = sec('🎣 釣竿', '點「換上」就會拿在手上'); for (const r of RODS.filter(r => r.price === 0 || (rec.rods || []).includes(r.id))){ const using = rec.rod === r.id;
      const li = row(ul, '', `${ROD_TYPES[rodType(r)].icon} ${r.name}`, r.desc, using ? '使用中' : '換上', using ? null : async () => { if (Cloud.on){ await cloudCall('buy_rod', { p_rod: r.id }); } else { rec.rod = r.id; saveRecLocal(); } me.setRod(rec.rod); updateBobberLook(); pushPresence(true); renderTab(); }, using);
      li.firstChild.textContent = ''; const dot = el('span'); dot.style.cssText = `display:inline-block;width:10px;height:34px;border-radius:5px;background:${r.color};transform:rotate(20deg)`; li.firstChild.appendChild(dot); } }
  // 魚餌和窩料
  { const ul = sec('🪱 魚餌', '一次只能掛一種；路亞釣法不用魚餌'); const cur = curBait();
    row(ul, '🪝', '不用魚餌', '一般的釣法', !cur ? '使用中' : '換上', cur ? () => { rec.baitOn = null; saveRecLocal(); cloudCall('set_bait', { p_bait: null }); renderTab(); } : null, !cur);
    const baits = BAITS.filter(b => (rec.bait[b.id] || 0) > 0); for (const b of baits){ const using = cur && cur.id === b.id; row(ul, '🪱', `${b.name} ×${rec.bait[b.id]}`, b.desc, using ? '使用中' : '換上', using ? null : () => { rec.baitOn = b.id; saveRecLocal(); cloudCall('set_bait', { p_bait: b.id }); renderTab(); }, using); }
    if (!baits.length) ul.appendChild(el('li', 'empty', '沒有魚餌，可以到釣具店買。'));
    const chums = CHUMS.filter(c => (rec.bait[c.id] || 0) > 0); if (chums.length){ const u2 = sec('🍚 窩料', '在水邊按「打窩」丟下去'); for (const c of chums) row(u2, '🍚', `${c.name} ×${rec.bait[c.id]}`, c.desc); } }
  // 料理
  { const ds = rec.dishes || []; if (ds.length){ const ul = sec('🍱 料理', '吃了以後接下來幾次拋竿有加成'); const by = new Map(); for (const d of ds){ const k = d.r + ':' + d.q; if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
      for (const [, list] of by){ const d = list[0], rc = RECIPES[d.r]; if (!rc) continue; row(ul, rc.icon, `${rc.name} ${'★'.repeat(d.q || 1)} ×${list.length}`, rc.desc, '吃', () => { eatDish(d.t); renderTab(); }); } } }
  // 潛水用品、蝦竿
  { const dv = DIVE_GEAR.filter(g => hasDive(g.id)); if (dv.length){ const ul = sec('🤿 潛水用品'); for (const g of dv) row(ul, g.icon, g.name, g.desc); } }
  { const own = SHRIMP_RODS.filter(r => r.price === 0 || (rec.srods || []).includes(r.id)), cur = curSrod(); const ul = sec('🦐 蝦竿', '只在釣蝦場用');
    for (const r of own){ const using = cur.id === r.id; row(ul, '🎣', r.name, r.desc, using ? '使用中' : '換上', using ? null : () => buyShrimpRod(r.id), using); } }
  // 釣法、釣線
  { const ul = sec('🧵 釣法和釣線', '在釣具店的「釣法」分頁可以換'); const rg = RIGS[Rig.rig] || {}, ln = LINES[Rig.line] || {}; row(ul, '🎯', `釣法：${rg.name || Rig.rig}`, rg.desc || ''); row(ul, '🧵', `釣線：${ln.name || Rig.line}`, ln.desc || ''); }
  { const b = el('div', 'bagmore'); const t = el('button', 'tbtn ghost', '🐟 打開魚缸'); t.addEventListener('click', () => { curTab = 'tank'; renderTab(); }); const st = el('button', 'tbtn ghost', '👕 打開造型（衣服、帽子）'); st.addEventListener('click', () => { curTab = 'style'; renderTab(); }); b.append(t, st); body.appendChild(b); }
}

/* ================= CATCH CARD ================= */
function showCatch(f, w, res){
  const gx = isGuppy(f.id) && F.gp ? gpyFish({ f: f.id, gp: F.gp, s: F.sex }) : null;
  drawFish($('#ccCanvas'), (gx || f).color, true, (gx || f).id);
  const b = $('#ccBadges'); b.textContent = '';
  const chip = document.createElement('span'); chip.className = 'chip r-' + f.rarity; chip.textContent = f.rarity + '・' + SPOT_BY_ID[f.spot].label; b.appendChild(chip);
  if (F.sex){ const x = document.createElement('span'); x.className = 'badge'; x.textContent = F.sex === 'M' ? '♂ 公' : '♀ 母'; b.appendChild(x); }
  if (F.brood){ const x = document.createElement('span'); x.className = 'badge var'; x.textContent = '🐣 嘴裡含著小魚・放流多 💙5'; b.appendChild(x); }
  if (f.rs && F.rsTag){ const x = document.createElement('span'); x.className = 'badge var'; x.textContent = `🦈 ${rsLabel(F.rsTag)}・身上 ${rsInfo(F.rsTag).scars} 道叉叉・整片海只有一小群`; b.appendChild(x); }
  if (f.of){ const x = document.createElement('span'); x.className = 'badge var'; x.textContent = `✨ 罕見變種（${FISH_BY_ID[f.of].name}）`; b.appendChild(x); if (res.isNew){ SFX.catch(); flash(`✨ 發現新的變種：${f.name}！`, 2.4); } }
  if (res.isNew){ const x = document.createElement('span'); x.className = 'badge new'; x.textContent = '圖鑑新登錄'; b.appendChild(x); }
  if (res.isBest){ const x = document.createElement('span'); x.className = 'badge'; x.textContent = '個人新紀錄'; b.appendChild(x); }
  if (Cloud.contest && Cloud.contest.fish === f.id){ const x = document.createElement('span'); x.className = 'badge new'; x.textContent = '🏆 本週比賽魚'; b.appendChild(x); }
  if (Tny.on){ const x = document.createElement('span'); x.className = 'badge new'; x.textContent = `⏱️ 大賽 +${w.toFixed(2)}kg`; b.appendChild(x); }
  $('#ccName').textContent = gx ? gx.name : f.name;
  if (gx){ const x = document.createElement('span'); x.className = 'badge var'; x.textContent = `🧬 ${gpyLabel({ gp: F.gp })}・可以配種`; b.appendChild(x); }
  const small = undersized(f, w), lp = lovePts(f, w);
  if (small){ const x = document.createElement('span'); x.className = 'badge small'; x.textContent = `📏 未達尺寸（${sizeMin(f).toFixed(2)}kg 以上）`; b.appendChild(x); }
  $('#ccW').innerHTML = w.toFixed(2) + '<small>kg</small>' + (f.rs ? `<small class="ccp">・不能賣</small>` : `<small class="ccp">・可賣 🪙${fishPrice(f, w)}${small ? '（半價）' : ''}</small>`);
  $('#ccDesc').textContent = small ? '這條還太小，放牠回去長大吧！放流可以得到比較多愛海點數，帶走只能賣半價。' : f.desc;
  ccFish = f; const rb = $('#ccRel'); rb.innerHTML = `放流 💙+${lp}`; rb.classList.toggle('hot', small);
  $('#ccOk').textContent = small ? '還是帶走' : '放進魚缸';
  $('#catchCard').hidden = false; uiBlocked = true;
  setTimeout(() => $('#ccOk').focus(), 50);
}
var ccFish = null;
function releaseCaught(){
  const f = ccFish, x = f && rec.tank.find(y => y.f === f.id); if (!x) { closeCatch(); return; }
  const p = releaseLocal(x); if (me.held) me.held.until = 0;
  SFX.chat(); ticker(`💙 <b>${esc(f.name)}</b> 游回大海了！愛海點數 +${p}`); cloudCall('release_catch', { p_fish: f.id }); closeCatch();
}
function closeCatch(){ if ($('#catchCard').hidden) return; $('#catchCard').hidden = true; uiBlocked = !$('#sheet').hidden; if (F.phase === 'result') F.phase = 'idle'; }
$('#ccOk').addEventListener('click', closeCatch);
$('#ccRel').addEventListener('click', releaseCaught);
$('#ccShow').addEventListener('click', () => {   // 釣到時直接選「放進水族館展示」
  const f = ccFish, x = f && rec.tank.find(y => y.f === f.id); if (!x){ closeCatch(); return; }
  rec.show = (rec.show || []).filter(t => t !== x.t); if (rec.show.length >= SHOW_MAX){ toast(`水族館最多放 ${SHOW_MAX} 條，先到魚缸拿出一條`); return; }
  rec.show.push(x.t); saveRecLocal(); buildTank(); cloudCall('set_show', { p_show: rec.show.slice() }); ticker(`🏛️ <b>${esc(f.name)}</b> 放進廣場的水族館展示了`); closeCatch(); });
$('#chumBtn').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ensureAudio(); const pk = $('#chumPick'); if (pk && !pk.hidden){ pk.hidden = true; return; } renderChumPick(); });
(function(){ const j = $('#jumpBtn');
  j.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); j.classList.add('down'); if (Dive.on){ Dive.up = true; return; } jump(); });
  const off = () => { j.classList.remove('down'); Dive.up = false; }; j.addEventListener('pointerup', off); j.addEventListener('pointercancel', off); j.addEventListener('pointerleave', off);
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
  setTimeout(() => d.classList.add('fade'), sys ? 5000 : 14000);   /* 系統訊息 5 秒就淡掉；玩家說的話留久一點（14 秒） */
  setTimeout(() => d.classList.add('gone'), sys ? 5700 : 14700);
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
  if (mutedUntil > Date.now()){ const d = new Date(mutedUntil); toast(`你被禁言到 ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}，其他人看不到你說的話。`); return; }
  if (room && room.connected() && chatAllowed){
    try { await room.emit('chat', { t: text }); }
    catch(err){ if (err && err.code === 'not_permitted'){ chatAllowed = false; logMsg('系統', '你目前是檢視者，聊天只有你自己看得到。', true); } me.say(text); logMsg('你', text); }
  } else { me.say(text); logMsg('你', text + (room ? '' : '（單人模式）')); }
  npcHear(text);   /* 旁邊的村民會回話 */
  if (isTouch){ inp.blur(); document.body.classList.remove('chatting'); }
});
// 手機鍵盤跳出來時，把聊天輸入框往上推到鍵盤上面
if (window.visualViewport){ const kb = () => { const v = visualViewport, h = Math.max(0, innerHeight - (v.height + v.offsetTop)); document.documentElement.style.setProperty('--kb', (h > 60 ? h : 0) + 'px'); }; visualViewport.addEventListener('resize', kb); visualViewport.addEventListener('scroll', kb); }
if (isTouch && $('#chatIn')) $('#chatIn').placeholder = '點這裡跟大家聊天…';
if ($('#chatIn')){ $('#chatIn').addEventListener('focus', () => document.body.classList.add('chatting')); $('#chatIn').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('#chatIn')) document.body.classList.remove('chatting'); }, 150)); }
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
function isBlockedPeer(peerId){ const u = peerUid.get(peerId); return !!(u && (blockList[u] || mutedSet.has(u))); }
// 禁言：你在 Supabase 後台的 muted 表加人，所有玩家的遊戲都會把他藏起來
let mutedSet = new Set(), mutedUntil = 0;
async function loadMuted(){
  if (!Cloud.sb) return;
  try {
    const { data, error } = await Cloud.sb.from('muted').select('user_id,until'); if (error || !Array.isArray(data)) return;
    const nowT = Date.now(), act = data.filter(r => Date.parse(r.until) > nowT);
    mutedSet = new Set(act.map(r => r.user_id)); const mine = act.find(r => r.user_id === Cloud.userId); mutedUntil = mine ? Date.parse(mine.until) : 0;
    for (const [pid, p] of peers) if (isBlockedPeer(pid)){ p.fisher.dispose(); peers.delete(pid); }
  } catch(e){}
}
// 檢舉：把對方最近說的話一起送給管理者
const recentChat = new Map();
async function reportPeer(peerId, name, reason){
  const u = peerUid.get(peerId); if (!Cloud.on || !u){ toast('要連上雲端才能檢舉'); return; }
  try {
    const { error } = await Cloud.sb.rpc('report_player', { p_target: u, p_name: name, p_reason: reason, p_chat: (recentChat.get(peerId) || []).join('\n') });
    if (error) toast(/太多/.test(error.message) ? '今天檢舉太多次了' : '檢舉沒有送出，等一下再試');
    else toast('已送出檢舉，謝謝你。管理者會看過再處理；你也可以先封鎖他。');
  } catch(e){ toast('檢舉沒有送出，等一下再試'); }
}
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

function peerName(p){ const pr = p.pres || {}; const n = typeof pr.n === 'string' && pr.n.trim() ? clean(pr.n.trim().slice(0, 16)) : (p.by && profileNames[p.by]) || '釣客'; const hm = typeof homeMate === 'function' && homeMate(p.by); return hm ? `${n}・${homeTitle(hm)}` : n; }   /* 一起住的人名字後面加稱呼 */
function myDisplayName(){ return nickname || (myId && profileNames[myId]) || '你'; }

let lastPres = '', lastPresAt = 0;
function presenceObj(){
  const o = { p:[+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.baseY.toFixed(2)], r:+me.rot.toFixed(2), sh:look.shirt, ht:look.hat };
  if (nickname) o.n = nickname;
  if (myId) o.u = myId;
  if (myBoat) o.bt = 1;
  if (mySeat) o.st = 1;
  { const g = Wardrobe.trying || rec.gear, gr = {}; for (const k in g) if (g[k] !== GEAR_DEFAULT[k]) gr[k] = g[k]; if (Object.keys(gr).length) o.gr = gr; }
  if (onIsle) o.is = onIsle.owner;
  if (House.on) o.hs = House.it ? House.it.id : 1;   /* 在哪一棟房子裡（不同房子的人互相看不到） */
  if (Dive.on) o.dv = 1;
  if (typeof Lv !== 'undefined' && Lv.cur) o.ti = Lv.cur;   /* 稱號（每 2.5 秒算一次，見 lvTick） */
  if (me.fishing && me.bobState !== 'none') o.f = { ph: F.phase === 'bite' ? 'bite' : F.phase === 'reeling' ? 'reel' : 'wait', b:[+me.bobPos.x.toFixed(2), +me.bobPos.z.toFixed(2)] }; if (F.phase === 'reeling' && F.fish && !F.fish.rs) o.f.fi = F.fish.id;   /* 旁邊的人看得到你在拉什麼魚 */
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
  if (pos){ p.target.set(clamp(+pos[0]||0, -160, ISLE.x + ISLE.r + 25), 0, clamp(+pos[1]||0, -110, 90)); p.y = clamp(+pos[2]||0, DIVE.y - 2, 8); }
  p.rot = Number.isFinite(+pr.r) ? +pr.r : p.rot;
  p.fisher.setLook(isHex(pr.sh) ? pr.sh : '#9fb3bf', isHex(pr.ht) ? pr.ht : '#ffd36a');
  p.fisher.setGear(cleanGear(pr.gr));
  p.fisher.setName(peerName(p) + (pp.guest ? '・訪客' : ''));
  { let ok = false; try { ok = typeof pr.ti === 'string' && ALL_TITLES.has(pr.ti); } catch(e){} const t = ok ? pr.ti : ''; if (t) p.fisher.nm.dataset.title = t; else delete p.fisher.nm.dataset.title; }
  p.fisher.sitting = !!pr.bt || !!pr.st;
  { const was = p.isle, now = typeof pr.is === 'string' ? pr.is : null; if (now && now !== was && Home.owner && now === Home.owner && homeMate(p.by) && onIsle && onIsle.owner === Home.owner && p.seenIsle) ticker(`🏠 <b>${esc(peerName(p))}</b> 回家了`); p.seenIsle = 1; }
  p.isle = typeof pr.is === 'string' ? pr.is : null; p.inHouse = Number(pr.hs) || 0; p.diving = !!pr.dv; p.fisher.setSwim(p.diving);   // 不在同一座島上的人看不到
  p.fisher.setRod(typeof pr.rd === 'string' ? pr.rd : 'bamboo');
  if (pr.bt && !p.fisher.boatMesh){ p.fisher.boatMesh = makeBoatMesh('#c98b55'); scene.add(p.fisher.boatMesh); }
  if (!pr.bt && p.fisher.boatMesh){ scene.remove(p.fisher.boatMesh); p.fisher.boatMesh = null; }
  const fi = pr.f && typeof pr.f === 'object' ? pr.f : null;
  p.fisher.fishing = !!fi;
  if (fi && Array.isArray(fi.b)){
    const tx = p.target.x, tz = p.target.z, nb = new THREE.Vector3(clamp(+fi.b[0]||tx, tx - 30, tx + 30), 0.12, clamp(+fi.b[1]||tz, tz - 30, tz + 30));   // 浮標一定在這個人附近（以前限制在 ±36 公尺，船划到外海時線會拉得很長）
    if (p.fisher.bobState === 'none'){ const from = new THREE.Vector3(); p.fisher.av.tip.getWorldPosition(from); p.fisher.bobPos.copy(nb); p.fisher.bobState = 'fly'; p.fisher.flying = { from, to: nb.clone(), t:0, dur:0.6, h:1.8 }; }
    else p.fisher.bobPos.copy(nb);
    p.ph = fi.ph; p.lastBob = nb.clone(); p.lastBobAt = Date.now();
    { const rf = fi.ph === 'reel' && typeof fi.fi === 'string' ? FISH_BY_ID[fi.fi] : null; if (rf && (!p.reelFish || p.reelFish.id !== rf.id) && camera.position.distanceTo(p.fisher.pos) < 30) p.fisher.say(`🎣 正在拉：${rf.name}`, 'emote', 4); p.reelFish = rf || null; }
  } else { p.fisher.bobState = 'none'; p.fisher.flying = null; p.ph = null; p.reelFish = null; }
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
    { const same = (p.isle || null) === (onIsle ? onIsle.owner : null) && (p.inHouse || 0) === (House.on ? (House.it ? House.it.id : 1) : 0) && !!p.diving === Dive.on; if (f.av.g.visible !== same){ f.av.g.visible = same; f.tag.style.display = same ? '' : 'none'; if (f.blob) f.blob.visible = same; } }
    if (f.boatMesh){ f.boatMesh.position.set(f.pos.x, WATER_LEVEL + Math.sin(t * 1.6) * 0.04, f.pos.z); f.boatMesh.rotation.y = f.rot; }
    f.dip = p.ph === 'bite' ? 0.9 + Math.sin(t*30)*0.1 : p.ph === 'reel' ? 0.5 + Math.sin(t*7)*0.2 : f.dip * Math.pow(0.05, dt);
    f.bend = p.ph === 'reel' ? 0.55 + Math.sin(t*5)*0.25 : f.bend * 0.9;
    { const rf = p.ph === 'reel' && f.av.g.visible && camera.position.distanceTo(f.pos) < 35 ? p.reelFish : null;   /* 別人上鉤的魚在浮標那裡掙扎、偶爾跳出水面 */
      if (rf && (!f.hookM || f.hookM.userData.id !== rf.id)){ if (f.hookM) scene.remove(f.hookM); let m = null; try { m = fishModel(rf, clamp(0.45 + Math.log(1 + (rf.min + rf.max) / 2) * 0.25, 0.45, 1.3)); } catch(e){} if (m){ m.userData.id = rf.id; scene.add(m); } f.hookM = m; f.hookJ = 0; }
      if (!rf && f.hookM){ scene.remove(f.hookM); f.hookM = null; }
      if (f.hookM){ const b = f.bobPos, m = f.hookM; if (f.hookJ <= 0 && Math.random() < dt * 0.35){ f.hookJ = 1; ripple(b.x, b.z, true); } f.hookJ = Math.max(0, f.hookJ - dt * 1.6);
        const jy = Math.sin(f.hookJ * Math.PI) * 0.7; m.position.set(b.x + Math.sin(t * 3.1) * 0.25, WATER_LEVEL - 0.12 + jy + Math.sin(t * 9) * 0.03, b.z + Math.cos(t * 2.7) * 0.25); m.rotation.y = Math.atan2(f.pos.x - b.x, f.pos.z - b.z) - Math.PI / 2 + Math.sin(t * 6) * 0.5; m.rotation.z = Math.sin(t * 11) * 0.3 + (f.hookJ > 0 ? Math.sin(f.hookJ * 6) * 0.6 : 0);
        if (Math.random() < dt * 3) ripple(b.x + (Math.random() - 0.5) * 0.5, b.z + (Math.random() - 0.5) * 0.5); } }
    f.update(dt, t); f.placeTag();
  }
}

let pjMode = false, roomTimer = null, roomJoinAt = 0, roomGreeted = false; const seenPeers = new Map();   /* 剛進大廳時，本來就在的人不要報「來到了村子」 */
function useRoom(r){
  room = r; tagReset(); roomJoinAt = Date.now(); roomGreeted = false;
    room.onPeers(ch => { for (const pp of ch.joined) applyPeer(pp); for (const pp of ch.updated) applyPeer(pp);
      for (const pp of ch.left){ const p = peers.get(pp.peer); if (p){ seenPeers.set((p.pres && typeof p.pres.u === 'string' && p.pres.u) || pp.peer, Date.now()); visitLog(p, true); p.fisher.dispose(); peers.delete(pp.peer); } }
      for (const pp of ch.joined){ if (!pp.isMe && pp.kind === 'viewer') setTimeout(() => { const p = peers.get(pp.peer); if (!p) return; visitLog(p);
        const key = (p.pres && typeof p.pres.u === 'string' && p.pres.u) || pp.peer, last = seenPeers.get(key); seenPeers.set(key, Date.now());
        if (Date.now() - roomJoinAt < 6000) return;                  // 我剛進來：他們本來就在了
        if (last && Date.now() - last < 3 * 60e3) return;             // 斷線一下又回來的，不重複報
        logMsg('', `${peerName(p)} 來到了村子`, true); ticker(`👋 <b>${esc(peerName(p))}</b> 來到了村子`); }, 600); }
      if (!roomGreeted && Date.now() - roomJoinAt < 6000){ roomGreeted = true; setTimeout(() => { const n = [...peers.values()].length; if (n > 0) ticker(`👋 村子裡已經有 <b>${n}</b> 個人在了，去打個招呼吧！`); }, 2500); }
      setOnline(); }, () => { room = null; setOnline(); });
    room.on('chat', msg => {
      let text = msg && msg.data && typeof msg.data.t === 'string' ? msg.data.t.slice(0, 120) : ''; if (!text) return;
      if (msg.sameTab){ me.say(text); logMsg(myDisplayName() === '你' ? '你' : myDisplayName(), text); return; }
      if (isBlockedPeer(msg.peer) || tooChatty(msg.peer)) return;
      text = clean(text);
      const p = peers.get(msg.peer); const name = p ? peerName(p) : '釣客';
      { const a = recentChat.get(msg.peer) || []; a.push(msg.data.t.slice(0, 120)); recentChat.set(msg.peer, a.slice(-5)); }
      if (p) p.fisher.say(text); logMsg(name, text); SFX.chat();
    }, () => {});
    room.on('cook', msg => {
      if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const rc = RECIPES[msg.data.r]; if (!rc) return; const q = clamp(Math.round(Number(msg.data.q) || 1), 1, 3);
      const p = peers.get(msg.peer); ticker(`${rc.icon} <b>${esc(p ? peerName(p) : '有人')}</b> 做出了 ${'★'.repeat(q)} ${esc(rc.name)}`);
      if (p) p.fisher.say(rc.icon, 'emote', 3);
    }, () => {});
    room.on('tag', onTagMsg, () => {});
    room.on('sail', onSail, () => {}); room.on('sailjoin', onSailJoin, () => {});
    room.on('lvup', msg => { if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const p = peers.get(msg.peer), L = Math.floor(+msg.data.L); if (!p || !(L > 1 && L < 100)) return; /* 別人升級不用跑馬燈 */ void 0; }, () => {});
    room.on('gift', msg => { if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; if (msg.data.to === Cloud.userId) setTimeout(loadFriends, 800); }, () => {});
    room.on('chum', msg => { if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const d = msg.data, p = peers.get(msg.peer); if (!CHUM_BY_ID[d.ty] || !isFinite(+d.x) || !isFinite(+d.z)) return;
      if (p && (p.isle || null) !== (onIsle ? onIsle.owner : null)) return; addChumZone(+d.x, +d.z, d.ty, msg.peer); if (p && Math.hypot(me.pos.x - d.x, me.pos.z - d.z) < 25) p.fisher.say('🍚', 'emote', 1.5); }, () => {});
    room.on('isle', msg => {
      if (msg.sameTab || !msg.data || msg.data.to !== myId || isBlockedPeer(msg.peer)) return;
      const p = peers.get(msg.peer); ticker(`🏝️ <b>${esc(p ? peerName(p) : '有人')}</b> 來參觀你的小島了`);
    }, () => {});
    room.on('visit', msg => {
      if (msg.sameTab || !msg.data || msg.data.to !== myId || isBlockedPeer(msg.peer)) return;
      const p = peers.get(msg.peer); ticker(`👀 <b>${esc(p ? peerName(p) : '有人')}</b> 正在參觀你的水族館`);
    }, () => {});
    room.on('sevrel', msg => { if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const f = FISH_BY_ID[msg.data.f]; if (!f || !f.sev) return; const p = peers.get(msg.peer);
      ticker(`💙 <b>${esc(p ? peerName(p) : '有人')}</b> 把 <b>${esc(f.name)}</b> 放回釣蝦場的池子了！大家又有機會釣到牠`); setTimeout(sevRefresh, 1500); }, () => {});
    room.on('catch', msg => {
      if (msg.sameTab || !msg.data || isBlockedPeer(msg.peer)) return; const f = FISH_BY_ID[msg.data.f]; const w = Number(msg.data.w); if (!f || !(w > 0) || w > f.max + 0.01) return;
      const p = peers.get(msg.peer); const name = p ? peerName(p) : '有人';
      if (f.rs){ setTimeout(rsPoll, 1500); }   /* 紅鯊的公告由伺服器紀錄發（每個大廳都看得到，不會重複） */
      else if (f.sev){ ticker(`🎉 <b>${esc(name)}</b> 釣到了阿忠今天放的 <b>${esc(f.name)}</b> ${fmtKg(w)}！全伺服器只有這一隻`); if (Sev.ev && Sev.ev.fish === f.id){ Sev.ev.caught = name; Sev.told['got' + Sev.ev.id] = 1; } }
      if (f.rarity !== '常見' && !f.rs) Talk.recent.unshift({ who: name, name: f.name, at: Date.now() });
      else if (f.rarity !== '常見') ticker(`${f.rarity === '傳說' ? '🎉' : '🎣'} <b>${esc(name)}</b> 在${esc(SPOT_BY_ID[f.spot].short)}釣到 <span class="chip r-${f.rarity}">${f.rarity}</span> <b>${esc(f.name)}</b> ${fmtKg(w)}`);
      if (p){ const pf = p.fisher, done = () => { pf.holdFish(f, w, 5); if (f.rarity === '傳說') pf.say('🎉 ' + f.name + ' ' + fmtKg(w), 'emote', 5); };
        if (pf.hookM){ scene.remove(pf.hookM); pf.hookM = null; }
        if (p.lastBob && Date.now() - (p.lastBobAt || 0) < 15000 && pf.av.g.visible && camera.position.distanceTo(pf.pos) < 35){   /* 看得到他把魚從水裡拉起來、甩到手上 */
          let fm = null; try { fm = fishModel(f, clamp(0.5 + Math.log(1 + w) * 0.35, 0.5, 1.8)); } catch(e){}
          if (fm){ const from = p.lastBob.clone(); from.y = 0.1; fm.position.copy(from); scene.add(fm); jumpers.push({ m: fm, from, to: new THREE.Vector3(pf.pos.x, pf.baseY + 2.2, pf.pos.z), t: 0, end: 0.92 }); ripple(from.x, from.z, true); pf.bend = 0.9; setTimeout(done, 900); }
          else done(); }
        else done(); }   // 大家都看得到他捧著剛釣到的魚
    }, () => {});
    room.onConnection(() => setOnline(), () => {});
    clearInterval(roomTimer); roomTimer = setInterval(() => pushPresence(false), 120);
    pushPresence(true); setOnline();
}
/* ---- 公共大廳：用 Supabase Realtime，打開遊戲就會看到其他正在玩的人 ---- */
// 和 PJRoom 一樣的介面（connected／on／onPeers／onConnection／presence／emit／leave），所以 useRoom() 不用改。
// 位置用 broadcast 送（最多每秒 4 次、只有變動時才送）；presence 只拿來知道誰進來、誰離開。
const LOBBY_MAX = 12, LOBBY_COUNT = 30;   // 架構第四階段：每個公共大廳最多 12 人，伺服器分配（061_lobby.sql）
const Lobby = { list:null, at:0, beat:0 };
function SBRoom(sb, name, key, myName){
  const R = { isLobby:true, code:null, lobbyNo:0 }; let ch = null, live = false, myPres = null, lastSent = '', flushT = 0, lastAt = 0;
  const lis = {}, peerFns = [], connFns = [], pres = {}, seen = {};
  const fire = (t, m) => (lis[t] || []).forEach(f => { try { f(m); } catch(e){} });
  const firePeers = c => peerFns.forEach(f => { try { f(c); } catch(e){} });
  const fireConn = () => connFns.forEach(f => { try { f(live); } catch(e){} });
  const pp = id => ({ peer:id, isMe:false, kind:'viewer', presence: pres[id] || {}, by: (pres[id] && pres[id].u) || id, guest:false });
  function send(force){
    if (!live || !myPres) return; const t = performance.now();
    if (!force && t - lastAt < 380){ if (!flushT) flushT = setTimeout(() => { flushT = 0; send(); }, 390); return; }   /* 每秒最多送 2～3 次，省雲端流量 */
    const sv = JSON.stringify(myPres); if (!force && sv === lastSent) return; lastSent = sv; lastAt = t;
    ch.send({ type:'broadcast', event:'p', payload:{ id:key, p:myPres } }).catch(() => {});
  }
  R.connected = () => live;
  R.on = (t, fn) => { (lis[t] = lis[t] || []).push(fn); return () => {}; };
  R.onPeers = fn => { peerFns.push(fn); const j = Object.keys(pres).map(pp); if (j.length) setTimeout(() => fn({ joined:j, updated:[], left:[] }), 0); return () => {}; };   // 補上已經在大廳裡的人
  R.onConnection = fn => { connFns.push(fn); return () => {}; };
  R.presence = o => { myPres = o; send(); return Promise.resolve(); };
  R.emit = (topic, data) => { if (!live) return Promise.reject({ code:'not_connected' }); ch.send({ type:'broadcast', event:'ev', payload:{ id:key, topic, data } }).catch(() => {}); fire(topic, { peer:key, data, sameTab:true }); return Promise.resolve(); };
  R.leave = () => { live = false; clearTimeout(flushT); clearInterval(R._hb); try { sb.removeChannel(ch); } catch(e){} fireConn(); };
  R.size = () => { try { return Object.keys(ch.presenceState()).length; } catch(e){ return 1; } };
  R.start = () => new Promise((res, rej) => {
    ch = sb.channel(name, { config:{ broadcast:{ self:false, ack:false }, presence:{ key } } });
    ch.on('broadcast', { event:'p' }, ({ payload }) => {
      if (!payload || payload.id === key || !payload.p || typeof payload.p !== 'object') return;
      const isNew = !pres[payload.id]; pres[payload.id] = payload.p; seen[payload.id] = Date.now();
      firePeers(isNew ? { joined:[pp(payload.id)], updated:[], left:[] } : { joined:[], updated:[pp(payload.id)], left:[] });
    });
    ch.on('broadcast', { event:'ev' }, ({ payload }) => { if (!payload || payload.id === key || typeof payload.topic !== 'string') return; fire(payload.topic, { peer:payload.id, data:payload.data, sameTab:false }); });
    // 有新的人進來：重送一次自己的狀態，對方才看得到站著不動的人
    ch.on('presence', { event:'join' }, ({ key:k }) => { if (k !== key) setTimeout(() => send(true), 150 + Math.random() * 600); });
    const drop = k => { if (pres[k]){ const x = pp(k); delete pres[k]; delete seen[k]; firePeers({ joined:[], updated:[], left:[x] }); } };
    ch.on('presence', { event:'leave' }, ({ key:k }) => drop(k));
    // 心跳：每 12 秒送一次自己的狀態；超過 40 秒沒消息、或已經不在大廳名單裡的人就拿掉（下線、手機鎖螢幕、斷線都會消失）
    R._hb = setInterval(() => { if (!live) return; send(true); const nowMs = Date.now(); let st = null; try { st = ch.presenceState(); } catch(e){}
      for (const k of Object.keys(pres)){ const gone = nowMs - (seen[k] || 0) > 40000 || (st && Object.keys(st).length && !st[k] && nowMs - (seen[k] || 0) > 15000); if (gone) drop(k); } }, 12000);
    let done = false;
    ch.subscribe(async st => {
      if (st === 'SUBSCRIBED'){ live = true; fireConn(); try { await ch.track({ n: myName || '' }); } catch(e){} send(true); if (!done){ done = true; res(R); } }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED'){ const was = live; live = false; if (was) fireConn(); if (!done){ done = true; rej(new Error(st)); } }
    });
  });
  return R;
}
// 關掉頁面時馬上離開大廳，別人那邊就不會留著你的角色
addEventListener('pagehide', () => { try { if (room && room.isLobby){ room.leave(); Cloud.sb.rpc('lobby_leave').then(() => {}, () => {}); } } catch(e){} });
addEventListener('pageshow', e => { if (e.persisted && room && room.isLobby && !room.connected()){ for (const p of peers.values()) p.fisher.dispose(); peers.clear(); room = null; joinLobby(); } });
// 來訪紀錄：誰來過村子（存在這台裝置，最多 60 筆、保留 7 天）
const Visits = { list: LS.get('tide.visits', []) };
function visitLog(p, left){
  const uid = typeof p.pres.u === 'string' ? p.pres.u : (p.by || ''), name = peerName(p); if (!uid || name === '釣客' && !p.pres.n) return;
  const nowMs = Date.now(); let v = Visits.list.find(x => x.u === uid);
  if (!v){ v = { u: uid, n: name, first: nowMs, last: nowMs, times: 0, ak: p.pres.ak || '' }; Visits.list.unshift(v); }
  v.n = name;  v.last = nowMs; if (!left){ v.times++; v.in = nowMs; } else v.out = nowMs;
  Visits.list = Visits.list.filter(x => nowMs - x.last < 7 * 86400e3).sort((a, b) => b.last - a.last).slice(0, 60); LS.set('tide.visits', Visits.list);
}
function agoText(ms){ const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`; }
var CVisits = { list:null, at:0, loading:false };
async function loadCloudVisits(){ if (!Cloud.on || CVisits.loading) return; CVisits.loading = true; try { const { data, error } = await Cloud.sb.rpc('get_visits'); if (!error && Array.isArray(data)){ const was = CVisits.list; CVisits.list = data; CVisits.at = Date.now();
  const seenAt = LS.get('tide.visitSeen', 0), fresh = data.filter(v => Date.parse(v.at) > seenAt); if (!was && fresh.length) ticker(`👣 你不在的時候，有 ${new Set(fresh.map(v => v.id)).size} 個人來逛過你的小島或水族館（玩家分頁）`);
  if (!$('#sheet').hidden && curTab === 'people') renderTab(); } } catch(e){} CVisits.loading = false; }
function renderCloudVisits(body){
  if (!Cloud.on) return; if (Date.now() - CVisits.at > 30000) loadCloudVisits();
  const list = CVisits.list || []; body.appendChild(el('div', 'dexhead', `👣 誰來逛過你的小島、水族館（最近 14 天）`));
  if (!list.length){ body.appendChild(el('p', 'sub', CVisits.list ? '還沒有人來逛過。把小島佈置得漂亮一點，別人在「逛別人的島」就比較容易看到你！' : '讀取中…')); return; }
  const seenAt = LS.get('tide.visitSeen', 0), ul = el('ul', 'people');
  for (const v of list.slice(0, 30)){ const li = el('li'), sw = el('span', 'sw'); sw.style.background = Date.parse(v.at) > seenAt ? '#f17b6d' : '#c9d3da';
    li.append(sw, el('span', '', `${v.kind === 'isle' ? '🏝️' : '🐠'} ${v.name || '釣客'}`), el('span', 'st', `${agoText(Date.parse(v.at))}逛了你的${v.kind === 'isle' ? '小島' : '水族館'}${v.n > 1 ? `（${v.n} 次）` : ''}`));
    if (typeof isFriend === 'function' && !isFriend(v.id)){ const af = el('button', 'tbtn ghost vbtn', '加好友'); af.addEventListener('click', () => { af.disabled = true; addFriend(v.id, v.name); }); li.appendChild(af); }
    const vi = el('button', 'tbtn ghost vbtn', '回訪小島'); vi.addEventListener('click', () => { closeSheet(); visitIsle(v.id, v.name); }); li.appendChild(vi); ul.appendChild(li); }
  body.appendChild(ul); setTimeout(() => LS.set('tide.visitSeen', Date.now()), 1500);
}
function renderVisits(body){
  const online = onlineUids(), list = Visits.list.filter(v => v.u !== Cloud.userId);
  body.appendChild(el('div', 'dexhead', `🕒 最近來過村子的人（${list.length}）`));
  if (!list.length){ body.appendChild(el('p', 'sub', '還沒有紀錄。有人進到你在的大廳時，就會記在這裡（存在這台裝置，保留 7 天）。')); return; }
  const ul = el('ul', 'people');
  for (const v of list.slice(0, 30)){ const li = el('li'), sw = el('span', 'sw'); sw.style.background = online.has(v.u) ? '#3fbf9d' : '#c9d3da';
    li.append(sw, el('span', '', `${v.n}`), el('span', 'st', online.has(v.u) ? '現在在線上' : `${agoText(v.out || v.last)}離開・來過 ${v.times} 次`));
    if (Cloud.on && typeof isFriend === 'function' && !isFriend(v.u)){ const af = el('button', 'tbtn ghost vbtn', '加好友'); af.addEventListener('click', () => { af.disabled = true; addFriend(v.u, v.n); }); li.appendChild(af); }
    if (Cloud.on){ const vi = el('button', 'tbtn ghost vbtn', '參觀小島'); vi.addEventListener('click', () => { closeSheet(); visitIsle(v.u, v.n); }); li.appendChild(vi); }
    ul.appendChild(li); }
  body.appendChild(ul);
  const clr = el('button', 'tbtn ghost', '清除紀錄'); clr.addEventListener('click', () => { if (clr.dataset.sure !== '1'){ clr.dataset.sure = '1'; clr.textContent = '確定清除？'; return; } Visits.list = []; LS.set('tide.visits', []); renderTab(); }); body.appendChild(clr);
}
let lobbyJoining = false;
async function joinLobby(want, isNew){
  if (!Cloud.on || room || pjMode || lobbyJoining) return;
  lobbyJoining = true;
  try {
    // 先問伺服器：想去的大廳有沒有位子、好友在哪一個（伺服器一次只讓一個人挑，不會超過 12 人）
    let no = 0; { const last = LS.get('tide.lobby', null); const w = want || (last && Date.now() - last.at < 10 * 60000 ? last.no : 0);   /* 斷線、重新整理：10 分鐘內回到原本的大廳 */
      try { const { data, error } = await Cloud.sb.rpc('lobby_pick', { p_want: w || 0, p_new: !!isNew }); if (error) throw error; no = +data || 0; } catch(e){ if (e && /滿了/.test(e.message || '')) toast(e.message); no = 0; } }
    if (no){ const r = SBRoom(Cloud.sb, 'tide-lobby-' + no, (Cloud.userId || 'x').slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6), nickname);
      try { await r.start(); } catch(e){ console.warn('lobby', e); no = 0; }
      if (no){ if (room || pjMode){ r.leave(); return; } r.lobbyNo = no; useRoom(r); LS.set('tide.lobby', { no, at: Date.now() }); lobbyBeat(true);
        const n = r.size() - 1; logMsg('系統', n > 0 ? `進入公共大廳 ${no}，現在有 ${n} 位釣客在村子裡（最多 ${LOBBY_MAX} 人）。` : `進入公共大廳 ${no}。現在只有你，有人進來時你就會看到他。`, true); return; } }
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
// 每 30 秒跟伺服器報到；斷線了自動回到原本的大廳
function lobbyBeat(force){ if (!Cloud.on || !room || !room.isLobby || !room.lobbyNo) return; if (!force && Date.now() - Lobby.beat < 30000) return; Lobby.beat = Date.now(); LS.set('tide.lobby', { no: room.lobbyNo, at: Date.now() }); Cloud.sb.rpc('lobby_beat', { p_no: room.lobbyNo }).then(() => {}, () => {}); }
setInterval(() => { try { lobbyBeat(false); if (Cloud.on && room && room.isLobby && !room.connected() && !lobbyJoining && Date.now() - roomJoinAt > 8000){ const no = room.lobbyNo; leaveLobby(); logMsg('系統', '連線斷了，正在回到原本的大廳…', true); joinLobby(no); } } catch(e){} }, 10000);
function switchLobby(no, isNew){ if (room && room.isLobby && room.lobbyNo === no && !isNew) return; leaveLobby(); LS.set('tide.lobby', null); joinLobby(no, isNew).then(() => { Lobby.at = 0; if (!$('#sheet').hidden && curTab === 'people') renderTab(); }); }
async function loadLobbies(){ if (!Cloud.on || Lobby.busy) return; Lobby.busy = true; try { const { data } = await Cloud.sb.rpc('lobby_list'); if (data) Lobby.list = data; } catch(e){} Lobby.busy = false; Lobby.at = Date.now(); if (!$('#sheet').hidden && curTab === 'people') renderTab(); }
function lobbyBox(){ const box = el('div', 'lobbybox'); if (!Lobby.list || Date.now() - Lobby.at > 20000) loadLobbies();
  box.appendChild(el('div', 'dexhead', `🏘️ 公共大廳（每個最多 ${LOBBY_MAX} 人）`)); const L = Lobby.list; if (!L){ box.appendChild(el('p', 'sub', '讀取中…')); return box; }
  const rooms = (L.rooms || []).slice(), cur = room && room.isLobby ? room.lobbyNo : 0; if (cur && !rooms.some(r => r.no === cur)) rooms.push({ no: cur, n: 1, friends: [] }); rooms.sort((a, b) => a.no - b.no);
  const ul = el('ul', 'people'); for (const r of rooms){ const li = el('li'), sw = el('span', 'sw'); sw.style.background = r.no === cur ? '#f17b6d' : r.n >= LOBBY_MAX ? '#c9d3da' : '#3fbf9d';
    li.append(sw, el('span', '', `大廳 ${r.no}${r.no === cur ? '（你在這裡）' : ''}`), el('span', 'st', `${r.n}/${LOBBY_MAX} 人${(r.friends || []).length ? '・好友：' + r.friends.slice(0, 3).join('、') : ''}`));
    if (r.no !== cur){ const b = el('button', 'tbtn ghost vbtn', r.n >= LOBBY_MAX ? '滿了' : '換過去'); b.disabled = r.n >= LOBBY_MAX; b.addEventListener('click', () => { b.disabled = true; switchLobby(r.no); }); li.appendChild(b); } ul.appendChild(li); }
  box.appendChild(ul); const nb = el('button', 'tbtn ghost', '➕ 開一個新的大廳'); nb.addEventListener('click', () => { nb.disabled = true; switchLobby(0, true); }); box.appendChild(nb); return box; }

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
    gear:r.gear, owned:r.owned, island:r.island, dishes:r.dishes, coins:r.coins, rod:r.rod, rods:r.rods, bait:r.bait, baitOn:r.bait_on, sold:r.sold, earned:r.earned, love:r.love, released:r.released, shrimpUntil: r.shrimp_until ? Date.parse(r.shrimp_until) : 0, srods: r.srods, srod: r.srod, dive:r.dive, photos:r.photos, cage:r.cage, cageFed:r.cage_fed, updatedAt:Date.parse(r.updated_at) || Date.now() });
}
function adoptRow(row){
  if (!row || typeof row !== 'object') return;
  Cloud.myWeekW = Cloud.contest && row.week_id === Cloud.contest.week_id ? Number(row.week_best_w) || 0 : 0;
  if (Tny.on && !Tny.test && Number(row.tourney_id) === Tny.id){ Tny.myW = Number(row.tourney_w) || 0; Tny.myN = row.tourney_n || 0; }
  rec = rowToRec(row); rec.island = cleanIsland(rec.island); Cloud.myLikes = Number(row.likes) || 0; LS.set('tide.rec', rec); buildTank(); buildCageFish();
  if (onIsle && onIsle.owner === myIdOrMe() && JSON.stringify(onIsle.layout) !== JSON.stringify(rec.island)){ onIsle.layout = rec.island; buildIsle(rec.island, onIsle.name); } renderCoins(); me.setRod(rec.rod); updateBobberLook(); if (!Wardrobe.trying) me.setGear(rec.gear); pushPresence(true);
  if (!$('#sheet').hidden && ['shop', 'tank', 'dex', 'rank', 'style', 'island'].includes(curTab) && !Cloud.ui.busy) renderTab();
}
const CLOUD_ERR = ['要先釣到 30 條魚才能買要錢的設計', '這件設計已經下架了', '這條魚對不上伺服器，請重新整理遊戲', '這隻已經被別人釣走了', '要先買釣蝦時段', '沒有這支蝦竿', '還沒有買這支蝦竿', '一次可以買 30 或 60 分鐘', '拋太快了', '不能加自己當好友', '找不到這位玩家', '好友最多 100 位', '好友代碼是 8 個英文或數字', '要互相加好友才能送禮', '對方的禮物箱滿了', '一次可以送 10～1000 金幣', '今天送的金幣到上限了（每天 1000）', '今天送的魚到上限了（每天 10 條）', '找不到這條魚', '展示中的魚不能送', '找不到這個禮物', '要先買前一級的潛水用品', '要先買潛水裝備', '撿太快了', '愛海點數不夠', '今天客人都吃飽了', '還沒登入', '沒有這種魚', '重量不合理', '釣太快了', '金幣不夠', '沒有這支釣竿', '沒有這種魚餌', '今天做太多了', '做太快了', '食材不對', '沒有這道料理', '窩料不能掛在鉤子上', '沒有這個商品', '還沒有買這個', '沒有這個任務', '這個任務今天已經完成了', '交的東西不對', '沒有這種建築', '位置不對', '這個位置已經有東西了', '這裡沒有東西', '沒有這種東西', '放在島外面了', '會擋住碼頭的路', '跟別的東西疊在一起了', '島上已經放滿了', '房子最多 6 棟', '找不到這個東西', '請重新整理遊戲（小島改版了）'];
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
/* ---- 參觀別人的水族館：把廣場東邊的大水族館換成對方展示的魚 ---- */
var visiting = null;   // { id, name, list }（用 var：水族館在這之前就會先建一次）
async function visitAquarium(id, name){
  if (!Cloud.sb || !id){ toast('要連上雲端才能參觀別人的水族館'); return; }
  if (id === Cloud.userId){ leaveVisit(); return; }
  try {
    const { data, error } = await Cloud.sb.from('players').select('nickname,tank,show').eq('id', id).maybeSingle();
    if (error || !data){ toast('找不到這位玩家的水族館'); return; }
    const r = normRec({ tank:data.tank, show:data.show });
    const set = new Set(r.show || []), list = r.tank.filter(x => set.has(x.t));
    visiting = { id, name: data.nickname || name || '釣客', list }; Cloud.sb.rpc('log_visit', { p_owner: id, p_kind: 'aqua' }).then(() => {}, () => {});
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
  // 這台裝置第一次玩：用雲端存的衣服顏色（換手機、清掉資料也不會變）；不然以這台裝置的設定為準
  if (row && lookFresh && !Cloud.lookAdopted && isHex(row.shirt) && isHex(row.hat)){ Cloud.lookAdopted = true; look.shirt = row.shirt; look.hat = row.hat; LS.set('tide.look', look); me.setLook(look.shirt, look.hat); pushPresence(true); }
  if (row && (nickname && row.nickname !== nickname || row.shirt !== look.shirt || row.hat !== look.hat)) cloudProfile();
}
let profTimer = 0;
function cloudProfile(){ if (!Cloud.on && !Cloud.sb) return; clearTimeout(profTimer); profTimer = setTimeout(() => { if (Cloud.sb) Cloud.sb.rpc('set_profile', { p_nick: nickname || '', p_shirt: look.shirt, p_hat: look.hat }).then(() => loadBoard()).catch(() => {}); }, 800); }
async function loadContest(){
  try {
    const { data, error } = await Cloud.sb.rpc('current_contest'); if (error || !data) return;
    const c = Array.isArray(data) ? data[0] : data; if (!c || !FISH_BY_ID[c.fish]) return;
    const fresh = !Cloud.contest || Cloud.contest.week_id !== c.week_id; Cloud.contest = c;
    if (fresh) setTimeout(() => ticker(`🏆 本週釣魚比賽：釣最重的 <b>${esc(FISH_BY_ID[c.fish].name)}</b>（${esc(SPOT_BY_ID[FISH_BY_ID[c.fish].spot].short)}），週一 00:00 結算！`), 4000);
  } catch(e){}
}
async function loadBoard(){
  if (!Cloud.sb) return;
  const cols = 'id,nickname,best_w,best_fish,total,legend,fish_count,earned';
  const q = (col) => Cloud.sb.from('players').select(cols).gt('total', 0).order(col, { ascending:false }).limit(20);
  try {
    const [a, b, c] = await Promise.all([q('best_w'), q('total'), q('earned')]);
    const map = r => ({ id:r.id, name:r.nickname, bestW:Number(r.best_w) || 0, bestFish:r.best_fish, total:r.total, legend:r.legend, count:r.fish_count || {}, earned:r.earned || 0 });
    if (!a.error) Cloud.board.best = a.data.map(map); if (!b.error) Cloud.board.total = b.data.map(map); if (!c.error) Cloud.board.earned = c.data.map(map);
    if (Cloud.contest){ const w = await Cloud.sb.from('players').select(cols + ',week_id,week_best_w').eq('week_id', Cloud.contest.week_id).gt('week_best_w', 0).order('week_best_w', { ascending:false }).limit(20);
      if (!w.error) Cloud.board.week = w.data.filter(r => r.week_id === Cloud.contest.week_id).map(r => Object.assign(map(r), { weekW: Number(r.week_best_w) || 0 })); }
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
    await loadContest(); loadBoard(); setTimeout(claimTourney, 6000); setTimeout(loadFriends, 3000); setTimeout(loadHome, 4500); setTimeout(breedTank, 7000); setInterval(loadHome, 180000); setTimeout(loadCloudVisits, 5000); setTimeout(claimLevels, 9000); setInterval(loadBoard, 60000); setInterval(loadContest, 10 * 60000); loadMuted(); setInterval(loadMuted, 3 * 60000);
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
function refreshMyName(){ me.setName(nickname || (myId && profileNames[myId]) || '你'); if (me.nm){ let t = ''; try { t = curTitle(); } catch(e){} if (t) me.nm.dataset.title = t; else delete me.nm.dataset.title; } }
let saving = false, saveAgain = false;
async function saveRemote(){
  if (!db || !myId || !dbWritable) return;
  if (saving){ saveAgain = true; return; }
  saving = true;
  try { await db.doc('records/' + myId).set(JSON.parse(JSON.stringify(rec))); }
  catch(e){ if (e && e.code === 'invalid_argument') dbWritable = false; }
  saving = false; if (saveAgain){ saveAgain = false; saveRemote(); }
}
// 紅鯊身上的叉叉：掙脫過幾次就有幾道（越多道，下次越容易掙脫）
function addScars(m, n){
  if (!m || !(n > 0)) return; m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = 1 / (m.scale.x || 1);
  const L = sz.x * k, H = sz.y * k, Z = sz.z * k, mt = new THREE.MeshBasicMaterial({ color:'#f4e6d8' }), g = new THREE.Group(); g.position.copy(c.sub(m.position)).multiplyScalar(k);
  for (let i = 0; i < Math.min(n, 9); i++){ const s = L * (0.045 + 0.006 * Math.min(n, 9)), x = L * (0.18 - i * 0.07), y = H * (0.08 + (i % 2) * 0.1);
    for (const side of [-1, 1]) for (const a of [0.785, -0.785]){ const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.18, 0.004), mt); b.position.set(x, y, side * Z * 0.36); b.rotation.z = a; g.add(b); } }
  m.add(g);
}
// ---- 赤紅霸王鯊（032）：整個伺服器共用一群，一開始一公一母，會繁殖，被釣光就絕種 ----
const RS = { n: null, seenAt: Number(LS.get('tide.rsSeen', 0)) || 0, mine: new Set() };
const CNUM = ['零','一','二','三','四','五','六','七','八','九','十'];
function rsNo(n){ n = +n; return n <= 10 ? CNUM[n] : n < 20 ? '十' + CNUM[n - 10] : n < 100 ? CNUM[Math.floor(n / 10)] + '十' + (n % 10 ? CNUM[n % 10] : '') : String(n); }
function rsInfo(tag){ const [id, sx, sc, x] = String(tag || '').split(':'); const esc = x === 'x'; return { id, sx, esc, scars: Math.max(0, (Number(sc) || 0) - (esc ? 1 : 0)) }; }   /* 伺服器先決定好會不會掙脫（:x），掙脫的那次叉叉已經先加上去了 */
function rsLabel(tag){ const [id, sx] = String(tag || '').split(':'); return `${sx === 'F' ? '♀' : '♂'} ${rsNo(id)}號`; }
async function rsPoll(){
  if (!Cloud.on || !Cloud.sb) return;
  try { const { data, error } = await Cloud.sb.rpc('get_red_shark'); if (error || !data) return; RS.n = Number(data.n) || 0;
    const l = data.last; if (l && l.at > RS.seenAt){ const fresh = Date.now() - l.at < 3600e3; RS.seenAt = l.at; LS.set('tide.rsSeen', l.at);
      if (fresh && l.caught) Talk.recent.unshift({ who: l.name || '有人', name: l.a ? '白化赤紅霸王鯊' : '赤紅霸王鯊', at: l.at });
      if (fresh && l.caught && !RS.mine.has(String(l.id))) ticker(`🦈 <b>${esc(l.name || '有人')}</b> 在外海釣到了 <b>${l.a ? '白化赤紅霸王鯊' : '赤紅霸王鯊'}</b>（${rsLabel(l.id + ':' + l.sex)}）${fmtKg(Number(l.w))}！${RS.n ? `海裡還剩 ${RS.n} 隻` : '海裡已經一隻都不剩了……'}`); } } catch(e){}
}
setInterval(rsPoll, 120000); setTimeout(rsPoll, 8000);
function announceCatch(f, w, spot){ if (room && room.connected() && chatAllowed) room.emit('catch', { f: f.id, w, s: spot }).catch(() => {});
  if (f.rarity !== '常見') ticker(`${f.rarity === '傳說' ? '🎉' : '🎣'} <b>你</b> 在${esc(SPOT_BY_ID[f.spot].short)}釣到 <span class="chip r-${f.rarity}">${f.rarity}</span> <b>${esc(f.name)}</b> ${fmtKg(w)}`);   /* 跑馬燈只報稀有和傳說，自己的也會出現 */ logMsg('', `你釣到了 ${f.name} ${w.toFixed(2)}kg`, true); }
const Rare = { rows: null, at: 0 };
const lb = { best: [], total: [] }; let lbLoading = false, lbSlow = false, lbMode = 'best';

/* ================= NPC villagers ================= */
const npcs = [
  { name:'阿潮・村民', shirt:'#7db7d7', hat:'#f6f0dd', x:1.1, z:-49.2, y:0.28, dir:new THREE.Vector2(0.15,-1).normalize() },
  { name:'小溪・村民', shirt:'#d896c3', hat:'#3fbf9d', x:-19.4, z:-10.2, y:0.28, dir:new THREE.Vector2(-1,0.1).normalize() },
  { name:'老港・漁夫', shirt:'#5b6b7a', hat:'#ffd36a', x:31.4, z:-34.4, y:0.3, dir:new THREE.Vector2(1,-0.1).normalize() },
  { name:'阿蘭・紅樹林巡守員', shirt:'#4f7f44', hat:'#e8d8a8', x:65.6, z:10.55, y:0.62, dir:new THREE.Vector2(0.35, 1).normalize(), lines:['退潮的時候泥灘會露出來，可以下去抓彈塗魚喔', '走慢一點，招潮蟹很膽小的', '鋸鰩已經很少了，釣到記得放流', '漲潮的時候，烏魚和黑鯛會游進樹根裡', '晚上這裡會有螢火蟲'] },
  // 阿默：一輩子的夢想就是釣到赤紅霸王鯊（紅鯊這個點子是使用者的朋友想出來的）
  { name:'阿默・追紅鯊的人', shirt:'#c8161c', hat:'#18334a', x:31.4, z:-26.1, y:0.3, dir:new THREE.Vector2(0.35, 1).normalize(), amo:true,
    lines:['我從小就天天望著這片海', '小時候有一天，我看到一隻紅色的鯊魚浮出水面……從那天起，我就決定一定要釣到牠', '那天牠的背鰭劃過海面，紅得像夕陽一樣，我到現在都忘不了', '大人都說我看錯了，可是我知道牠真的在', '赤紅霸王鯊……我每天都在這裡等牠', '聽說牠背上有黑色的虎紋，眼睛是金色的', '牠的力氣大到會把竿子拉彎，我一定要親手感受一次', '有人說紅鯊只是傳說，我不信', '總有一天，跑馬燈上會出現我的名字', '我不會賣牠，也不會送人，釣到了我要好好看著牠', '如果你先釣到了……也要告訴我喔', '港口裡面不會有紅鯊，要開船到外海才有機會', '我的小船是紅色的，跟紅鯊一樣'],
    catchLines:['唉……又不是紅鯊', '這隻也很好，但我要的是紅色的', '還沒，還沒……', '今天的海好安靜，紅鯊在睡覺嗎'] },
  { name:'阿嬤・石滬人家', shirt:'#d8708a', hat:'#f4e8c8', x:9.6, z:83.6, y:0.42, dir:new THREE.Vector2(1, -0.2).normalize(), lines:['石滬是以前的人一顆一顆咾咕石疊起來的', '退潮的時候來，魚都被關在愛心裡面', '滿潮的時候魚都游出去了，要等', '臭肚魚背上的刺有毒，抓的時候小心', '菜宅的石牆是擋東北季風用的', '橋那邊的花瓶岩，是海浪慢慢磨出來的'] },
  // 阿綾：服裝店的設計師，站在店門口櫃台的旁邊；每天早上和傍晚會設計一件新衣服放到市集（050_ling.sql）
  (() => { const r = SHOPLOT.ling.r, [x, z] = lotAt('ling', -1.75, 2.75); return { name:'阿綾・服裝設計師', shirt:'#f5a5d8', hat:'#8a3a6a', x, z, y:0.02, dir:new THREE.Vector2(Math.sin(r), Math.cos(r)), tailor:true,
    lines:['歡迎光臨阿綾服裝店！店裡的衣服都是我自己畫的喔', '我每天早上和傍晚都會設計一件新衣服，記得常常來看', '你也可以自己設計衣服，在設計師市集賣給大家', '海浪、晚霞、小魚……村子裡到處都是靈感', '想要什麼顏色的衣服？我下次畫給你', '用自己的照片也可以變成衣服的圖案喔，在設計室試試看'] }; })(),
  // 阿木：木工坊的家具木匠，站在門口左邊那件展示家具後面；每天早上 9 點、下午 5 點會做一件新家具放到店裡（052_mu.sql）
  (() => { const r = SHOPLOT.mu.r, [x, z] = lotAt('mu', -2.55, 0.55); return { name:'阿木・家具木匠', shirt:'#8a6a4a', hat:'#5a3d2b', x, z, y:0.02, dir:new THREE.Vector2(Math.sin(r), Math.cos(r)), shopNpc:'mu',
    lines:['歡迎來阿木木工坊！每一件家具都是我親手做的', '我每天早上和傍晚都會做一件新的，做過的都會留在店裡', '木頭要曬過、磨過，坐起來才舒服', '買了以後回家按「擺家具」，在「阿木的作品」裡面就找得到', '漂流木是我在南方沙灘撿的，每一塊紋路都不一樣'] }; })(),
  // 阿福：碼頭邊海產店的老闆，每天早上 6 點公布今日收購、傍晚 6 點做特餐（053_fu.sql）
  (() => { const r = Math.atan2(4 - 20.5, 4 + 25.5), lz = 2.75, lx = -1.75; return { name:'阿福・海產店老闆', shirt:'#2f89c7', hat:'#ffffff', x:20.5 + Math.sin(r) * lz + Math.cos(r) * lx, z:-25.5 + Math.cos(r) * lz - Math.sin(r) * lx, y:0.02, dir:new THREE.Vector2(Math.sin(r), Math.cos(r)), shopNpc:'fu',
    lines:['來來來，今天的收購單貼在櫃台上囉！', '箱網養的和魚缸生的我不收，我只要海裡、河裡釣上來的', '前一天大家都釣很多的魚，我今天就不收了', '傍晚 6 點我會用今天收最多的魚做特餐，吃了釣魚有加成', '魚要新鮮！釣到了就快拿來'] }; })(),
  // 阿彩：畫廊的畫家，每天早上 8 點畫一幅魚（058_cai.sql）
  (() => { const r = SHOPLOT.cai.r, [x, z] = lotAt('cai', -1.75, 2.75); return { name:'阿彩・畫家', shirt:'#9b7bff', hat:'#2b2f36', x, z, y:0.02, dir:new THREE.Vector2(Math.sin(r), Math.cos(r)), shopNpc:'cai',
    lines:['歡迎來阿彩畫廊！每一幅都是我親手畫的', '我每天早上 8 點，會畫昨天全村最厲害的那條魚', '被我畫的人，我會送他一幅喔', '畫可以擺在家裡，像家具一樣', '清晨、晚霞、月夜……同一條魚，顏色不一樣感覺就不一樣'] }; })(),
  // 阿報：廣場的報童，每天早上 7 點出《潮汐村報》（057_news.sql）
  { name:'阿報・村報記者', shirt:'#f1e3c8', hat:'#2b2f36', x:-0.6, z:1.2, y:0.02, dir:new THREE.Vector2(0.6, 0.8).normalize(), shopNpc:'news',
    lines:['號外號外！今天的《潮汐村報》出來了', '每天早上 7 點出報，昨天發生什麼事都寫在上面', '釣到稀有的魚，明天就會上報喔，名字還是金色的', '報紙我都留 7 天，想看以前的也可以', '我到處跑新聞，村民的八卦我最清楚了'] },
  { name:'阿伯・老校工', shirt:'#c8b48a', hat:'#5a6a3a', x:21.6, z:-41.0, y:0.02, dir:new THREE.Vector2(-0.2, 1).normalize(), lines:['這個池子比我年紀還大，學校一百多年前就有了', '以前的學生下課都蹲在池邊看魚', '琵琶鼠魚是有人亂放生的，現在池子裡到處都是', '大肚魚是以前放來吃孑孓的', '紅色的拱橋走上去看魚最清楚', '看到垃圾就順手撿一下啦', '假山上的蕨類是老師們一棵一棵種的'] },
].map(n => { const f = new Fisher({ shirt:n.shirt, hat:n.hat, name:n.name, kind:'npc' }); f.pos.set(n.x, n.y, n.z); f.baseY = n.y; f.rot = Math.atan2(n.dir.x, n.dir.y); f.fishing = true; f.bobState = 'water'; { const cp = castPoint(n.x, n.z, n.dir.x, n.dir.y, 4.5); f.bobPos.set(cp[0], 0.12, cp[1]); } f.next = now() + rand(4, 12); f.amo = !!n.amo; f.tailor = !!n.tailor; f.shopNpc = n.shopNpc || null; if (n.tailor || n.shopNpc){ f.fishing = false; f.bobState = 'none'; f.baseY = groundHeight(n.x, n.z); f.pos.y = f.baseY; f.setGear({ hat:'hat_bucket', acc:'acc_glasses', face:'face_happy' }); } f.catchLines = n.catchLines || null; f.lines = n.lines || ['今天的浪很溫柔呢', '聽說溪裡有會發光的魚…', '慢慢來，魚會來的', '燈塔亮的時候，月光鯛最多']; return f; });
for (const n of npcs){ const nm = n.nm.textContent; n.wid = nm.startsWith('阿綾') ? 'ling' : nm.startsWith('阿木') ? 'mu' : nm.startsWith('阿福') ? 'fu' : nm.startsWith('老港') ? 'gang' : null; }
// 老闆不在店裡的時候，店裡的東西照樣要更新（店一直都開著，可以自己逛）
function worldShopLoad(n){ if (!Cloud.on || !n.post || Math.hypot(me.pos.x - n.post.x, me.pos.z - n.post.z) > 40) return;
  if (n.tailor && (!Ling.at || Date.now() - Ling.at > 10 * 60000)) loadLing(); else if (n.shopNpc === 'mu' && (!FZ.at || Date.now() - FZ.at > 10 * 60000)) loadMu(); else if (n.shopNpc === 'fu' && (!Fu.at || Date.now() - Fu.at > 5 * 60000)) loadFu(); }
// ---- 阿綾：站在服裝店櫃台後面，看到人會轉過來；穿著自己最新設計的衣服，門口衣架掛著最新的三件上衣 ----
async function loadLing(){
  if (Ling.busy || !Cloud.on || !Cloud.sb) return; Ling.busy = true; Ling.at = Date.now();
  try { const { data } = await Cloud.sb.rpc('list_designs', { p_mode: 'ling', p_offset: 0 }); Ling.list = (data || []).filter(d => d && d.px); for (const d of Ling.list) Designs.map.set(d.id, d); } catch(e){}
  Ling.busy = false; applyLing();
}
function applyLing(){
  const L = Ling.list || [], n = npcs.find(x => x.tailor); if (!L.length) return;
  const latest = k => L.find(d => d.kind === k), g = { face:'face_happy' }; for (const k of ['top', 'pants', 'hat', 'shoes', 'acc']){ const d = latest(k); if (d) g[k] = k + '_dz' + d.id; } if (!g.hat) g.hat = 'hat_bucket';
  const key = JSON.stringify(g); if (n && key !== Ling.gearSet){ Ling.gearSet = key; n.setGear(g); }
  if (Ling.rack){ const tops = L.filter(d => d.kind === 'top').slice(0, 3); Ling.rack.forEach((r, i) => { const d = tops[i]; if (!d || r.id === d.id) return; r.id = d.id;
    const tx = new THREE.CanvasTexture(designCanvas(d.px.slice(0, 256), 'pants', 1)); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = tx.minFilter = THREE.NearestFilter;
    const m = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }); r.sh.material = m; r.sl.material = new THREE.MeshStandardMaterial({ color: DESIGN_PAL[parseInt(d.px[0], 16)] || '#fff', roughness: 0.8 }); }); }
}
function lingLines(){ const L = Ling.list || []; if (!L.length) return []; const d = L[0], out = [`我最新的作品是「${d.name}」，${d.price ? `🪙${d.price}` : '免費送'}，來看看吧！`];
  const hot = L.slice().sort((a, b) => b.sold - a.sold)[0]; if (hot && hot.sold > 0) out.push(`「${hot.name}」已經賣出 ${hot.sold} 件了，謝謝大家！`);
  out.push(`店裡現在有 ${L.length} 件我設計的東西，衣服都不會下架，走到櫃台前面就能逛`); return out; }
function muLines(){ const L = FZ.list || [], out = []; if (L.length){ const d = L[0]; out.push(`${d.story}，叫做「${d.name}」，${d.price ? `🪙${d.price}` : '免費送'}，來看看吧！`); out.push(`店裡現在有 ${L.length} 件我做的家具，走到門口就能逛`); }
  const mine = []; try { for (const it of (rec.island && rec.island.items) || []) for (const o of it.f || []){ const d = FZ.map.get(fzId(o.t)); if (d) mine.push(d); } } catch(e){}
  if (mine.length){ const d = mine[Math.floor(Math.random() * mine.length)]; out.push(`謝謝你把我做的「${d.name}」擺在家裡！放得很好看`); if (mine.length >= 3) out.push(`你家已經有 ${mine.length} 件我的作品了，快變成阿木展示間了`); }
  return out; }
function updateShopNpc(n, dt, t, load){
  const d = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z);
  if (d < 40 && Cloud.on) load();
  if (d < 7) n.rot = lerpAngle(n.rot, Math.atan2(me.pos.x - n.pos.x, me.pos.z - n.pos.z), 1 - Math.exp(-3 * dt));
  if (d < 9 && t > (n.talkAt || 0) && !(n.replyUntil > now()) && !Dive.on && !House.on){ n.say(npcLine(n), '', 6); n.talkAt = t + rand(18, 35); } else if (d > 18 && n.talkAt) n.talkAt = Math.min(n.talkAt, t + 5);
  n.update(dt, t); n.placeTag();
}
// ---- 釣客魚市（060_fishmarket.sql）：玩家之間買賣魚，伺服器保管、成交 ----
async function loadMarket(){ if (Mkt.busy || !Cloud.on || !Cloud.sb) return; Mkt.busy = true; Mkt.at = Date.now();
  try { const mode = Mkt.tab === 'mine' ? 'mine' : Mkt.tab === 'cheap' ? 'cheap' : 'new'; const [a, b] = await Promise.all([Cloud.sb.rpc('market_browse', { p_mode: mode, p_fish: Mkt.fish, p_offset: 0 }), Mkt.stats ? Promise.resolve({ data: Mkt.stats }) : Cloud.sb.rpc('market_stats')]);
    if (mode === 'mine') Mkt.mine = a.data || []; else Mkt.list = a.data || []; Mkt.stats = b.data || {}; } catch(e){}
  Mkt.busy = false; if (!$('#sheet').hidden && curTab === 'market') renderTab(); }
function mktFishName(x){ const f = FISH_BY_ID[x.fish || x.f]; return (f ? f.name : (x.fish || x.f)) + (x.item && x.item.s ? (x.item.s === 'M' ? ' ♂' : ' ♀') : x.s ? (x.s === 'M' ? ' ♂' : ' ♀') : ''); }
async function mktCall(fn, args, msg){ try { const { data, error } = await Cloud.sb.rpc(fn, args); if (error) throw error; adoptRow(data); buildTank(); SFX.catch(); flash(msg, 1.6); Mkt.stats = null; Mkt.sell = null; loadMarket(); } catch(e){ toast(cloudErrMsg(e)); loadMarket(); } }
function renderMarketFish(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🐟 釣客魚市</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能買賣魚。')); return; }
  const seg = el('div', 'seg'); [['new', '🛒 最新'], ['cheap', '💰 最划算'], ['sell', '🏷️ 我要賣'], ['mine', '📦 我的攤位']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(Mkt.tab === k)); b.addEventListener('click', () => { Mkt.tab = k; Mkt.sell = null; if (k !== 'sell') loadMarket(); renderTab(); }); seg.appendChild(b); }); body.appendChild(seg);
  const S = Mkt.stats || {};
  if (Mkt.tab === 'sell'){
    if (Mkt.sell){ const x = Mkt.sell, f = FISH_BY_ID[x.f], base = Math.max(1, fishPrice(f, x.w)), lo = Math.max(5, Math.round(base * 0.5)), hi = Math.max(50, base * 5), st = S[x.f];
      body.appendChild(el('div', 'dexhead', `把「${mktFishName(x)} ${fmtKg(x.w)}」擺上魚市`));
      body.appendChild(el('p', 'sub', `海邊商店收購價 🪙${base}。你可以訂 🪙${lo}～${hi}。${st && st.avg ? `最近 7 天這種魚在魚市平均賣 🪙${st.avg}（賣掉 ${st.sold} 條）。` : ''}${st && st.open ? `現在魚市還擺著 ${st.open} 條。` : ''}賣掉以後你拿 95%。`));
      const row = el('div', 'tankbar'), inp = el('input'); inp.type = 'number'; inp.min = lo; inp.max = hi; inp.value = Math.min(hi, Math.max(lo, (st && st.avg) || Math.round(base * 1.5))); inp.style.cssText = 'width:110px;font-size:16px;padding:6px 8px;border-radius:10px;border:1px solid #c8d8e4';
      row.appendChild(inp); for (const k of [1, 1.5, 2, 3]){ const q = el('button', 'tbtn ghost', `×${k}`); q.addEventListener('click', () => { inp.value = Math.min(hi, Math.max(lo, Math.round(base * k))); }); row.appendChild(q); } body.appendChild(row);
      const bar = el('div', 'tankbar'), ok = el('button', 'tbtn', '擺上去'), bk = el('button', 'tbtn ghost', '返回'); ok.addEventListener('click', () => { const v = Math.round(+inp.value); if (!(v >= lo && v <= hi)){ toast(`價錢要在 ${lo}～${hi} 之間`); return; } ok.disabled = true; mktCall('market_list', { p_t: x.t, p_price: v }, `🏷️ 擺上魚市了！🪙${v}`); });
      bk.addEventListener('click', () => { Mkt.sell = null; renderTab(); }); bar.append(ok, bk); body.appendChild(bar); return; }
    body.appendChild(el('p', 'sub', '選一條魚擺上魚市，自己訂價（收購價的 0.5～5 倍）。魚會先交給魚市保管，3 天沒賣掉會退回你的魚缸，也可以隨時收回來。每人最多同時擺 6 條。展示中的魚、紅鯊不能賣。'));
    const cand = (rec.tank || []).filter(x => FISH_BY_ID[x.f] && !x.rs && !(rec.show || []).includes(x.t)).sort((a, b) => (RARITY_ORDER[FISH_BY_ID[b.f].rarity] - RARITY_ORDER[FISH_BY_ID[a.f].rarity]) || b.w - a.w).slice(0, 80);
    if (!cand.length) body.appendChild(el('div', 'empty', '魚缸裡沒有可以賣的魚。'));
    const ul = el('ul', 'shoplist cols'); for (const x of cand){ const f = FISH_BY_ID[x.f], li = el('li'); li.appendChild(el('span', 'dishic', x.k ? '⭐' : '🐟')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${mktFishName(x)} ${fmtKg(x.w)}`)); d.appendChild(el('div', 'sub2', `${f.rarity}・收購 🪙${fishPrice(f, x.w)}`)); li.appendChild(d); li.addEventListener('click', () => { Mkt.sell = x; renderTab(); }); ul.appendChild(li); }
    body.appendChild(ul); return; }
  const L = Mkt.tab === 'mine' ? Mkt.mine : Mkt.list; if (!L){ body.appendChild(el('div', 'empty', '載入中…')); return; }
  if (Mkt.tab !== 'mine' && Mkt.fish){ const b = el('button', 'tbtn ghost', `只看：${(FISH_BY_ID[Mkt.fish] || {}).name || Mkt.fish} ✕`); b.addEventListener('click', () => { Mkt.fish = null; loadMarket(); }); body.appendChild(b); }
  if (!L.length){ body.appendChild(el('div', 'empty', Mkt.tab === 'mine' ? '你還沒有擺魚。到「我要賣」選一條吧！' : '魚市現在沒有魚，你可以當第一個擺攤的人！')); return; }
  const ul = el('ul', 'shoplist'); for (const m of L){ const f = FISH_BY_ID[m.fish], li = el('li', m.status === 'sold' ? 'on' : ''); li.appendChild(el('span', 'dishic', f && f.of ? '✨' : '🐟'));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${mktFishName(m)} ${fmtKg(+m.w)}・🪙${m.price}`)); const rel = m.price / Math.max(1, m.base);
    d.appendChild(el('div', 'sub2', Mkt.tab === 'mine' ? (m.status === 'open' ? '擺著賣中' : m.status === 'sold' ? `✅ 賣掉了，拿到 🪙${Math.floor(m.price * 0.95)}` : m.status === 'expired' ? '3 天沒賣掉，已經退回魚缸' : '已經收回') : `${f ? f.rarity : ''}・賣家 ${m.seller}・收購價的 ${rel.toFixed(1)} 倍${S[m.fish] && S[m.fish].avg ? `・最近平均 🪙${S[m.fish].avg}` : ''}`)); li.appendChild(d);
    const a = el('div', 'tacts');
    if (Mkt.tab === 'mine'){ if (m.status === 'open'){ const b = el('button', 'tbtn ghost', '收回'); b.addEventListener('click', () => { b.disabled = true; mktCall('market_cancel', { p_id: m.id }, '📦 收回魚缸了'); }); a.appendChild(b); } }
    else if (m.mine) a.appendChild(el('span', 'sub2', '你的'));
    else { const b = el('button', 'tbtn', '買'); b.disabled = rec.coins < m.price; b.addEventListener('click', () => { b.disabled = true; mktCall('market_buy', { p_id: m.id }, `🐟 買到${mktFishName(m)}了！放進魚缸囉`); }); a.appendChild(b);
      const s2 = el('button', 'tbtn ghost', '同種'); s2.addEventListener('click', () => { Mkt.fish = m.fish; loadMarket(); }); a.appendChild(s2); }
    li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}
// ---- 阿報的《潮汐村報》（057_news.sql）：每天早上 7 點出報、留 7 天；上報的玩家名字是金色的 ----
var News = { list:null, at:0, busy:false, pick:0 };
async function loadNews(){ if (News.busy || !Cloud.on || !Cloud.sb) return; News.busy = true; News.at = Date.now();
  try { const { data, error } = await Cloud.sb.rpc('get_news'); if (!error && data) News.list = data; } catch(e){}
  News.busy = false; if (!$('#sheet').hidden && curTab === 'news') renderTab(); }
function newsLines(){ const P = (News.list || [])[0]; if (!P) return []; const out = (P.items || []).filter(it => it.k !== 'wx').slice(0, 3).map(it => '號外！' + it.text); if (P.me) out.push('你今天上報了！快來看看'); return out; }
function newsHtml(it){ let h = esc(it.text); for (const nm of it.names || []) if (nm) h = h.split(esc(nm)).join(`<b class="gold">${esc(nm)}</b>`); return h; }
function renderNews(body){
  const head = el('div', 'shophead'); head.innerHTML = '<b>📰 潮汐村報</b>'; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能看村報。')); return; }
  const L = News.list; if (!L){ body.appendChild(el('div', 'empty', '載入中…')); return; } if (!L.length){ body.appendChild(el('div', 'empty', '阿報還在寫第一份報紙。')); return; }
  const seg = el('div', 'seg'); L.forEach((P, i) => { const d = new Date(P.day + 'T00:00:00'), b = el('button', '', i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`); b.setAttribute('aria-pressed', String(News.pick === i)); b.addEventListener('click', () => { News.pick = i; renderTab(); }); seg.appendChild(b); }); body.appendChild(seg);
  const P = L[Math.min(News.pick, L.length - 1)], paper = el('div', 'paper');
  paper.appendChild(el('div', 'pmast', `潮汐村報　${P.day.replace(/-/g, '/')}`));
  if (P.me) paper.appendChild(el('div', 'pme', '⭐ 今天的報紙有寫到你！'));
  for (const it of P.items || []){ const sec = el('div', 'psec' + (it.k === 'head' ? ' big' : '')); sec.appendChild(el('div', 'pt', it.title)); const tx = el('div', 'px'); tx.innerHTML = newsHtml(it); sec.appendChild(tx); paper.appendChild(sec); }
  body.appendChild(paper); body.appendChild(el('p', 'sub', '每天早上 7 點出報，寫的都是前一天村子裡真正發生的事。釣到稀有的魚或是一天釣很多，隔天就會上報。'));
}
// ---- 老港的每週限定手作（056_gang.sql）：每週一早上 9 點做一件，只有 5 件，每人每週 1 件 ----
var Gang = { data:null, at:0, busy:false };
async function loadGang(){ if (Gang.busy || !Cloud.on || !Cloud.sb) return; Gang.busy = true; Gang.at = Date.now();
  try { const { data, error } = await Cloud.sb.rpc('gang_week'); if (!error && data){ Gang.data = data; if (data.item) Designs.map.set(data.item.id, data.item); } } catch(e){}
  Gang.busy = false; if (!$('#sheet').hidden && curTab === 'gang') renderTab(); }
function gangLines(){ const D = Gang.data; if (!D || !D.item) return []; const left = D.stock - D.sold;
  return [left > 0 ? `這週我做了「${D.item.name}」，只有 ${D.stock} 件，還剩 ${left} 件` : '這週做的已經賣完了，下週一早上再來', '舊漁網、船纜都捨不得丟，拿來做成衣服剛剛好', '每個人一週只能買一件，要留給別人喔']; }
function renderGangShop(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>⚓ 老港的每週限定手作</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能跟老港買。')); return; }
  const D = Gang.data; if (!D){ body.appendChild(el('div', 'empty', '載入中…')); return; }
  body.appendChild(el('p', 'sub', '老港每週一早上 9 點用舊漁網、船纜、浮球的顏色做一件，全村只有 5 件，每人每週一件，賣完就沒了。帳號要建立滿 2 天、總共釣過 50 條魚才能買。'));
  const it = D.item, left = D.stock - D.sold, ul = el('ul', 'shoplist'), li = el('li', D.mine ? 'on' : '');
  if (it && it.px){ const cv = designCanvas(it.px.slice(0, 256), 'pants', 3); cv.className = 'dishic'; cv.style.cssText = 'width:44px;height:44px;border-radius:10px;image-rendering:pixelated'; li.appendChild(cv); }
  const inf = el('div', 'tinfo'); inf.appendChild(el('div', 'n', it ? it.name : '')); inf.appendChild(el('div', 'sub2', `🪙${D.price}・還剩 ${left}/${D.stock} 件${D.why && !D.mine ? '・' + D.why : ''}`)); li.appendChild(inf);
  const a = el('div', 'tacts'), b = el('button', 'tbtn' + (D.mine || left <= 0 || D.why ? ' ghost' : ''), D.mine ? '買過了' : left <= 0 ? '賣完了' : `買 🪙${D.price}`); b.disabled = !!(D.mine || left <= 0 || D.why || rec.coins < D.price);
  b.addEventListener('click', async () => { b.disabled = true; try { const { data, error } = await Cloud.sb.rpc('gang_buy'); if (error) throw error; adoptRow(data); SFX.catch(); flash(`⚓ 買到老港的「${it.name}」了！去「造型」穿穿看`, 2); } catch(e){ toast(cloudErrMsg(e)); } loadGang(); });
  a.appendChild(b); li.appendChild(a); ul.appendChild(li); body.appendChild(ul);
  if ((D.past || []).length){ body.appendChild(el('div', 'dexhead', '之前做過的')); const u2 = el('ul', 'wlist old'); for (const p of D.past) u2.appendChild(el('li', '', `${p.week}　${p.name}（賣了 ${p.sold}/${p.stock}）`)); body.appendChild(u2); }
}
// ---- 阿福海產店：今日收購、交魚、今日特餐 ----
async function loadFu(){ if (Fu.busy || !Cloud.on || !Cloud.sb) return; Fu.busy = true; Fu.at = Date.now();
  try { const { data, error } = await Cloud.sb.rpc('fu_today'); if (!error && data) Fu.data = data; } catch(e){}
  Fu.busy = false; applyFuIce(); if (!$('#sheet').hidden && curTab === 'fu') renderTab(); }
function applyFuIce(){ const D = Fu.data; if (!D || !Fu.ice) return; const ids = (D.orders || []).map(o => o.fish).filter(id => FISH_BY_ID[id]).slice(0, 4), key = ids.join(','); if (key === Fu.iceKey) return; Fu.iceKey = key;
  for (const c of [...Fu.ice.children]) if (c.userData.fuFish) Fu.ice.remove(c);
  ids.forEach((id, i) => { try { const m = fishModel(FISH_BY_ID[id], 0.32); m.position.set(-0.8 + i * 0.53, 0.2, 0); m.rotation.set(0, Math.PI / 2 + (i % 2 ? 0.2 : -0.2), Math.PI / 2 * 0); m.userData.fuFish = 1; Fu.ice.add(m); } catch(e){} }); }
function fuDesc(o){ const f = FISH_BY_ID[o.fish], nm = f ? f.name : o.fish; return o.kind === 'bonus' ? `今天高價收「${nm}」：一條 ×${(+o.mult).toFixed(1)} 倍（一次最多 3 條）` : `收 ${o.need} 條 ${fmtKg(+o.minw)} 以上的「${nm}」，給 🪙${o.reward}（全村前 ${o.cap} 個人）`; }
function fuLines(){ const D = Fu.data; if (!D) return []; const out = [], O = D.orders || [];
  for (const o of O){ const f = FISH_BY_ID[o.fish]; if (!f) continue; if (o.kind === 'bonus') out.push(`今天的${f.name}好少啊，誰幫我釣幾條？一條給 ${(+o.mult).toFixed(1)} 倍的價錢！`);
    else { const left = o.cap - o.done; out.push(left > 0 ? `收 ${o.need} 條${fmtKg(+o.minw)}以上的${f.name}，名額只剩 ${left} 個囉！` : `${f.name}的委託今天已經收滿了，謝謝大家！`); } }
  if (D.special) out.push(`今天的特餐是「${(RECIPES[D.special.r] || {}).name || '綜合壽司拼盤'}」，吃了釣魚有加成喔`); else out.push('傍晚 6 點會有今日特餐，記得來吃');
  return out; }
function fuOk(o, x){ return x.f === o.fish && x.w >= +o.minw && !x.fm && !x.y && !x.rs && !x.k && !(rec.show || []).includes(x.t); }
async function fuDeliver(o, ts){ try { const { data, error } = await Cloud.sb.rpc('fu_deliver', { p_idx: o.idx, p_ts: ts }); if (error) throw error; const before = rec.coins; adoptRow(data); buildTank();
    SFX.catch(); flash(`🐟 阿福收下了！🪙 +${Math.max(0, rec.coins - before)}`, 1.6); Fu.pick = null; loadFu(); } catch(e){ toast(cloudErrMsg(e)); } }
function renderFuShop(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🐟 阿福海產店</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能賣魚給阿福。')); return; }
  const D = Fu.data; if (!D){ body.appendChild(el('div', 'empty', '載入中…')); return; }
  body.appendChild(el('p', 'sub', '每天早上 6 點換新的收購單。阿福只收野生的魚：箱網養的、魚缸生的、收藏⭐或展示中的魚都不收。每一項每人每天只能交一次。'));
  const P = Fu.pick;
  if (P){ const o = (D.orders || []).find(x => x.idx === P.idx); if (!o){ Fu.pick = null; renderTab(); return; }
    body.appendChild(el('div', 'dexhead', fuDesc(o)));
    const cand = (rec.tank || []).filter(x => fuOk(o, x)).sort((a, b) => a.w - b.w), max = o.kind === 'quest' ? o.need : 3;
    if (!cand.length){ body.appendChild(el('div', 'empty', '魚缸裡沒有阿福要的魚。')); }
    const ul = el('ul', 'shoplist cols');
    for (const x of cand){ const on = P.sel.includes(x.t), li = el('li', on ? 'on' : ''); li.appendChild(el('span', 'dishic', '🐟')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${FISH_BY_ID[x.f].name} ${fmtKg(x.w)}`)); d.appendChild(el('div', 'sub2', on ? '要交這條' : '點一下選')); li.appendChild(d);
      li.addEventListener('click', () => { if (on) P.sel = P.sel.filter(t => t !== x.t); else if (P.sel.length < max) P.sel.push(x.t); else toast(`最多選 ${max} 條`); renderTab(); }); ul.appendChild(li); }
    body.appendChild(ul);
    const bar = el('div', 'tankbar'), ok = el('button', 'tbtn', o.kind === 'quest' ? `交 ${P.sel.length}/${o.need} 條` : `賣 ${P.sel.length} 條`), bk = el('button', 'tbtn ghost', '返回');
    ok.disabled = o.kind === 'quest' ? P.sel.length !== o.need : !P.sel.length; ok.addEventListener('click', () => { ok.disabled = true; fuDeliver(o, P.sel.slice()); });
    bk.addEventListener('click', () => { Fu.pick = null; renderTab(); }); bar.append(ok, bk); body.appendChild(bar); return; }
  body.appendChild(el('div', 'dexhead', `📋 今日收購（${D.day}）`));
  const ul = el('ul', 'shoplist');
  for (const o of D.orders || []){ const f = FISH_BY_ID[o.fish]; if (!f) continue; const li = el('li', o.mine ? 'on' : ''); li.appendChild(el('span', 'dishic', o.kind === 'bonus' ? '💰' : '📦'));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', fuDesc(o))); d.appendChild(el('div', 'sub2', o.mine ? '✅ 你今天交過了' : o.kind === 'quest' ? `已經有 ${o.done}/${o.cap} 個人完成・魚缸裡符合的：${(rec.tank || []).filter(x => fuOk(o, x)).length} 條` : `魚缸裡符合的：${(rec.tank || []).filter(x => fuOk(o, x)).length} 條`)); li.appendChild(d);
    const a = el('div', 'tacts'), full = o.kind === 'quest' && o.done >= o.cap, b = el('button', 'tbtn' + (o.mine || full ? ' ghost' : ''), o.mine ? '交過了' : full ? '名額滿了' : '交魚'); b.disabled = o.mine || full;
    b.addEventListener('click', () => { const cand = (rec.tank || []).filter(x => fuOk(o, x)).sort((p, q) => p.w - q.w); Fu.pick = { idx: o.idx, sel: cand.slice(0, o.kind === 'quest' ? o.need : Math.min(3, cand.length)).map(x => x.t) }; renderTab(); }); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
  body.appendChild(el('div', 'dexhead', '🍱 今日特餐'));
  if (!D.special) body.appendChild(el('div', 'empty', '傍晚 6 點，阿福會用今天收到最多的魚做一道特餐。'));
  else { const R = RECIPES[D.special.r] || RECIPES.mori, li = el('li', D.special.bought ? 'on' : ''), ul2 = el('ul', 'shoplist'); li.appendChild(el('span', 'dishic', R.icon));
    const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', R.name)); d.appendChild(el('div', 'sub2', `${D.special.fish && FISH_BY_ID[D.special.fish] ? `用今天收最多的${FISH_BY_ID[D.special.fish].name}做的。` : ''}吃了接下來幾次拋竿有跟這道料理一樣的加成・🪙150・每人每天一份`)); li.appendChild(d);
    const a = el('div', 'tacts'), b = el('button', 'tbtn' + (D.special.bought ? ' ghost' : ''), D.special.bought ? '吃過了' : '吃 🪙150'); b.disabled = D.special.bought || rec.coins < 150;
    b.addEventListener('click', async () => { b.disabled = true; try { const { data, error } = await Cloud.sb.rpc('fu_special_buy'); if (error) throw error; adoptRow(data); { const bf = BUFFS[D.special.r]; if (bf){ buff = { r: D.special.r, left: Number(data && data.buff_left) || bf.casts }; LS.set('tide.buff', buff); renderBuff(); } } SFX.catch(); flash(`${R.icon} 吃了${R.name}！釣魚有加成`, 1.6); loadFu(); } catch(e){ toast(cloudErrMsg(e)); } }); a.appendChild(b); li.appendChild(a); ul2.appendChild(li); body.appendChild(ul2); }
  if ((D.got || []).length) body.appendChild(el('p', 'sub', '今天阿福收到：' + D.got.slice(0, 6).map(g => `${(FISH_BY_ID[g.fish] || {}).name || g.fish} ${g.n} 條`).join('、')));
}
function updateMu(n, dt, t){
  const d = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z);
  if (d < 40 && Cloud.on && (!FZ.at || Date.now() - FZ.at > 10 * 60000)) loadMu();
  if (d < 7) n.rot = lerpAngle(n.rot, Math.atan2(me.pos.x - n.pos.x, me.pos.z - n.pos.z), 1 - Math.exp(-3 * dt));
  if (d < 9 && t > (n.talkAt || 0) && !(n.replyUntil > now()) && !Dive.on && !House.on){ n.say(npcLine(n), '', 6); n.talkAt = t + rand(18, 35); } else if (d > 18 && n.talkAt) n.talkAt = Math.min(n.talkAt, t + 5);
  n.update(dt, t); n.placeTag();
}
// 阿木的店：每件家具的樣子、故事、價格；買了回家用「擺家具」擺
function renderMuShop(body){
  const head = el('div', 'shophead'); head.innerHTML = `<b>🪑 阿木木工坊</b><span class="coinpill">🪙 ${rec.coins.toLocaleString()}</span>`; body.appendChild(head);
  if (!Cloud.on){ body.appendChild(el('div', 'empty', '要連上雲端（登入）才能逛阿木的店。')); return; }
  body.appendChild(el('p', 'sub', '阿木每天早上 9 點、下午 5 點會做一件新家具，做過的都會一直留在店裡。想要的話，走進你小島上的房子，按「擺家具」→「🪵 阿木的作品」，擺下去的時候才付錢。'));
  if (!FZ.list){ if (!FZ.busy) loadMu(); body.appendChild(el('div', 'empty', '載入中…')); return; }
  if (!FZ.list.length){ body.appendChild(el('div', 'empty', '阿木還在做第一件家具，晚一點再來。')); return; }
  const icons = { table:'🍽️', chair:'🪑', desk:'🖥️', shelf:'📚', ward:'🚪', sofa:'🛋️', arm:'💺', rug:'🟣', lamp:'💡', clock:'🕰️', bed:'🛏️', dbed:'🛏️' };
  const ul = el('ul', 'shoplist');
  for (const d of FZ.list){ const li = el('li'), sw = el('span', 'dishic', icons[d.base] || '🪑'); sw.style.cssText = `background:linear-gradient(135deg, ${d.main} 0 50%, ${d.accent} 50% 100%);border-radius:10px`; li.appendChild(sw);
    const inf = el('div', 'tinfo'); inf.appendChild(el('div', 'n', d.name)); inf.appendChild(el('div', 'sub2', `${d.story}・${d.price ? '🪙' + d.price : '免費'}`)); li.appendChild(inf);
    const a = el('div', 'tacts'), b = el('button', 'tbtn', House.on && canEditIsle() ? '拿去擺' : '回家擺'); b.addEventListener('click', () => { if (House.on && canEditIsle()){ closeSheet(); startFurn('fz' + d.id); } else toast('走進你小島上的房子，按「擺家具」→「🪵 阿木的作品」就能擺'); }); a.appendChild(b); li.appendChild(a); ul.appendChild(li); }
  body.appendChild(ul);
}
function updateLing(n, dt, t){
  const d = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z);
  if (d < 40 && Cloud.on && (!Ling.at || Date.now() - Ling.at > 10 * 60000)) loadLing();
  if (d < 7) n.rot = lerpAngle(n.rot, Math.atan2(me.pos.x - n.pos.x, me.pos.z - n.pos.z), 1 - Math.exp(-3 * dt));
  if (d < 9 && t > (n.talkAt || 0) && !(n.replyUntil > now()) && !Dive.on && !House.on){ n.say(npcLine(n), '', 6); n.talkAt = t + rand(18, 35); } else if (d > 18 && n.talkAt) n.talkAt = Math.min(n.talkAt, t + 5);
  n.update(dt, t); n.placeTag();
}
// ---- 村民聊天（2026-11-04）：玩家走近時偶爾講一句。有自己的話、玩法小提示，還有「現在正在發生的事」（天氣、潮汐、季節、活動、紅鯊）。說的內容都要跟遊戲真正的規則一樣 ----
const NPC_TIPS = [
  '按住拋竿可以蓄力，放開就拋出去',
  '拉線的時候張力條快滿了就先鬆手，不然線會斷',
  '手竿適合河、湖、溪、池塘；海邊用遠投竿；外海用磯釣竿',
  '太小的魚放流，愛海點數比較多',
  '愛海點數可以去商店換限定的衣服',
  '水族館裡同一種魚一公一母，每天有機會生小魚',
  '在高高的岸上釣大魚要有撈網，釣具店「🧰工具」那裡有賣',
  '窩料丟下去，附近的魚會聚過來',
  '去港口找船夫阿海，可以出海或去潛水',
  '去過的地方，打開地圖就能直接傳送過去',
  '釣蝦場要先跟老闆買時段才能釣',
  '圖鑑裡還沒釣過的魚，都是黑黑的影子',
  '變種的魚很少見，釣到才會出現在圖鑑裡',
  '幫村民完成任務，可以拿到金幣',
];
// ---- 動態海洋生態（066_ocean.sql）：水溫、海流、魚類洄游、魚群、保育週（伺服器每小時更新，抽魚時直接算進去）----
var Ocean = { d:null, at:0, busy:false };
async function loadOcean(){ if (Ocean.busy || !Cloud.on || !Cloud.sb) return; Ocean.busy = true; Ocean.at = Date.now(); try { const { data } = await Cloud.sb.rpc('ocean_now'); if (data) Ocean.d = data; } catch(e){} Ocean.busy = false; if (!$('#sheet').hidden && curTab === 'map') renderTab(); }
setInterval(() => { try { if (Cloud.on && (!Ocean.at || Date.now() - Ocean.at > 10 * 60000)) loadOcean(); } catch(e){} }, 20000);
function oceanLines(){ const D = Ocean.d; if (!D) return []; const out = []; for (const e of D.eco || []){ const f = FISH_BY_ID[e.fish], sp = SPOT_BY_ID[e.spot]; if (!f || !sp) continue; out.push(e.kind === 'protect' ? `${e.label}` : `聽說${e.label}，去${sp.short}看看`); }
  const c = D.state && D.state.coast; if (c) out.push(`今天海水 ${c.temp} 度${c.spd > 1 ? '，海流很強' : ''}`); return out; }
function renderOcean(body){ const D = Ocean.d; if (!D){ if (Cloud.on) loadOcean(); return; } const S = D.state || {}, dir = d => ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(((+d % 360) + 360) % 360 / 45) % 8];
  body.appendChild(el('div', 'dexhead', '🌊 海洋現況（每小時更新）')); const ul = el('ul', 'wlist');
  for (const [k, nm] of [['coast', '本島沿海'], ['north', '冰封群島海岸'], ['fresh', '河湖溪流']]){ const s = S[k]; if (!s) continue; ul.appendChild(el('li', '', `${nm}：水溫 ${s.temp}°C・${k === 'fresh' ? '水流' : '海流'}往${dir(s.dir)} ${s.spd} 節・浮游生物 ${Math.round(s.pk * 100)}%`)); }
  for (const e of D.eco || []){ const f = FISH_BY_ID[e.fish], sp = SPOT_BY_ID[e.spot]; if (!f || !sp) continue; ul.appendChild(el('li', '', `${e.kind === 'protect' ? '🛡️' : e.kind === 'school' ? '🐟' : '🧭'} ${sp.short}：${e.label}${e.kind === 'protect' ? '' : `（${f.name}比較多 ×${(+e.mult).toFixed(1)}）`}`)); }
  body.appendChild(ul); }
function npcEventLines(n){
  const L = [], W = WEATHERS[Env.wx], tip = dailyTip();
  for (const x of oceanLines()) L.push(x);
  L.push(`現在${W.name}：${W.desc}`);
  L.push(`聽釣具店老闆說，${tip.text}`);
  if (Env.tide.st === 'low') L.push('退潮的時候海邊的魚比較不愛咬，不過紅樹林的泥灘會露出來，可以去抓彈塗魚');
  if (Env.tide.st === 'rising') L.push('漲潮了！海邊的魚咬得比較快，稀有魚也多一點');
  if (breedSeason()) L.push('現在是繁殖季，吳郭魚、鯽魚這些會自己生的魚特別多');
  if (Env.wx === 'rain') L.push('下雨天雷魚、鯰魚、鰻魚特別愛吃');
  if (Env.wx === 'storm') L.push('暴風雨的時候外海傳說魚多很多，但是拉線很吃力');
  { const night = FISH.filter(f => f.time === 'night' && !f.of && SPOT_BY_ID[f.spot] && !SPOT_BY_ID[f.spot].hidden); if (night.length){ const f = night[Math.floor(Math.random() * night.length)]; L.push(`${f.name}只有晚上才會出來，在${SPOT_BY_ID[f.spot].short}`); } }
  if (Sev.ev && !Sev.ev.caught && FISH_BY_ID[Sev.ev.fish]) L.push(`阿忠今天放了一條${FISH_BY_ID[Sev.ev.fish].name}，還沒有人釣到喔！`);
  if (RS.n > 0 && Math.random() < 0.4) L.push(`聽說外海還有 ${RS.n} 隻赤紅霸王鯊…`);
  if (Talk.recent.length && Date.now() - Talk.recent[0].at < 20 * 60000){ const r = Talk.recent[0]; L.push(`剛剛${r.who}釣到一條${r.name}，好厲害`); }
  return L;
}
const Talk = { recent: [] };
function amoLines(){ const L = [], mine = rec.tank.find(x => FISH_BY_ID[x.f] && FISH_BY_ID[x.f].rs);   /* 阿默看現在紅鯊的狀況講話 */
  if (mine){ const f = FISH_BY_ID[mine.f]; L.push(`你……你的魚缸裡有${f.name}？！讓我看一下好不好！`, `${f.name}${fmtKg(mine.w)}……你是我的偶像`, '恭喜你……我也要加油了'); }
  if (RS.n === 0) L.push('海裡……一隻紅鯊都不剩了嗎……', '沒關係，我會等，說不定還有一隻躲在哪裡');
  else if (RS.n > 0) L.push(`聽說海裡還有 ${RS.n} 隻紅鯊，其中一隻一定是在等我`, RS.n >= 4 ? '最近紅鯊好像變多了，機會來了！' : '紅鯊那麼少，每一次拋竿都要認真');
  if (Talk.recent.some(r => /赤紅霸王鯊/.test(r.name) && Date.now() - r.at < 3600e3)) L.push('剛剛有人釣到紅鯊了！好羨慕……下一隻是我的');
  if (Env.wx === 'storm') L.push('暴風雨的晚上，紅鯊最愛出來，我才不回家');
  return L; }
// ---- 村民回話：你在聊天框說話，旁邊 9 公尺內最近的村民會看你說了什麼回一句（照關鍵字，回的內容都要跟遊戲規則一樣）----
function npcReply(n, text){
  const has = (...w) => w.some(x => text.includes(x)), pick = a => a[Math.floor(Math.random() * a.length)], nm = myDisplayName && myDisplayName() !== '你' ? myDisplayName() : '';
  if (n.amo){
    if (has('比你先', '我先釣', '我會先', '搶', '比賽')) return pick(['哈哈，那我們來比賽！不過最後釣到的一定是我', '好啊，比比看！但我已經等很多年了喔', '你先釣到的話……記得讓我摸一下牠']);
    if (has('幾隻', '還有', '剩')) return RS.n > 0 ? `聽說海裡還有 ${RS.n} 隻紅鯊` : RS.n === 0 ? '海裡……一隻都不剩了' : '我也不知道還有幾隻，只知道牠在等我';
    if (has('白化', '白色')) return '白化的紅鯊？聽說生小鯊的時候極少數會出現……如果能看到一次就好了';
    if (has('紅鯊', '鯊', '霸王')) return pick(['紅鯊只在外海出沒，偶爾會跑到珊瑚礁外面的深水', '牠的力氣大到會把線拉進礁石裡，要用好一點的竿子', '上鉤以後很容易甩頭掙脫，掙脫一次身上就多一道叉叉']);
    if (has('加油', '你可以', '相信')) return pick(['謝謝你！有你這句話我又可以多等十年', '嗯！總有一天跑馬燈上會是我的名字']);
    if (has('放棄', '不可能', '傳說', '假的')) return pick(['我才不會放棄，我小時候真的看過牠', '大人也說我看錯了，可是我知道牠真的在']);
    if (has('船', '出海')) return '港口裡不會有紅鯊，我每隔幾分鐘就會開船到外海';
  }
  if (has('你好', '嗨', 'hi', 'Hi', '哈囉', '安安', '早安', '午安', '晚安')) return pick([`${nm ? nm + '，' : ''}你好啊！`, '嗨～今天釣得怎麼樣？', '你好！慢慢釣，魚會來的']);
  if (has('謝謝', '感謝')) return pick(['不客氣～', '小事情啦']);
  if (has('釣到', '大魚', '傳說')) return pick(['恭喜啊！讓我看看', '好厲害！今天運氣真好', '釣到好魚記得放流小魚喔']);
  if (has('沒魚', '釣不到', '不咬', '好難')) return pick(['換個釣法或魚餌試試看，也可以丟窩料', '漲潮的時候海邊的魚咬得比較快', '手竿在河、湖、溪、池塘比較好用']);
  if (has('天氣', '下雨', '颱風')) return `現在${WEATHERS[Env.wx].name}：${WEATHERS[Env.wx].desc}`;
  if (has('?', '？', '什麼', '怎麼', '哪裡')) return pick(NPC_TIPS);
  return pick(['嗯嗯', '真的嗎？', '哈哈', '原來是這樣', ...(n.lines || []).slice(0, 3)]);
}
function npcHear(text){
  let best = null, bd = 9; for (const n of npcs.concat(questNpcs.map(q => q.f))){ const d = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z); if (d < bd){ bd = d; best = n; } }
  if (!best) return; worldTalk(best); const r = npcReply(best, text); { const q = questNpcs.find(q => q.f === best); if (q){ q.mark = null; q.talkUntil = now() + 10; } } best.replyUntil = now() + 9;
  setTimeout(() => { best.say(r, '', 6); logMsg(best.nm.textContent || '村民', r); }, 900 + Math.random() * 600);
}
function npcLine(n){ const r = Math.random(), pick = a => a[Math.floor(Math.random() * a.length)]; if (n.wid && r < 0.3){ const m = worldMemLines(n); if (m.length) return pick(m); } if (n.shopNpc === 'cai'){ const a = caiLines(); if (a.length && r < 0.55) return pick(a); return r < 0.9 ? pick(n.lines) : pick(npcEventLines(n)); } if (n.shopNpc === 'news'){ const a = newsLines(); if (a.length && r < 0.6) return pick(a); return r < 0.9 ? pick(n.lines) : pick(npcEventLines(n)); } if (n.wid === 'gang'){ const a = gangLines(); if (a.length && r < 0.45) return pick(a); } if (n.shopNpc === 'fu'){ const a = fuLines(); if (a.length && r < 0.6) return pick(a); return r < 0.9 ? pick(n.lines) : pick(npcEventLines(n)); } if (n.shopNpc === 'mu'){ const a = muLines(); if (a.length && r < 0.5) return pick(a); return r < 0.85 ? pick(n.lines) : pick(npcEventLines(n)); } if (n.tailor){ const a = lingLines(); if (a.length && r < 0.45) return pick(a); return r < 0.8 ? pick(n.lines) : pick(npcEventLines(n)); } if (n.amo){ const a = amoLines(); if (a.length && r < 0.5) return pick(a); return pick(n.lines); } if (r < 0.4) return pick(npcEventLines(n)); if (r < 0.7) return pick(NPC_TIPS); return pick(n.lines); }
// 阿默：港口裡不會有紅鯊，所以他每一趟都開自己的紅色小船，繞著島到外海隨便一個地方釣（每一趟去哪裡大家看到的都一樣）
// 每 7 分鐘一趟：從碼頭開到外海的環線 → 沿著環線繞到這次的釣點 → 釣魚 → 原路開回來 → 在碼頭休息一下。環線離岸邊 22 公尺，不會撞到紅樹林；不會經過往珊瑚礁群島的跨海大橋那一側
const AMO = { dock:[35.6, -27.2], cycle:420, pier:50, speed:4.2, off:22 };
function amoRing(a){ const r = islandR(a) + AMO.off + 12 * Math.exp(-Math.pow((a - 0.4) / 0.4, 2)); return [Math.cos(a) * r, Math.sin(a) * r]; }   /* 紅樹林那一段繞遠一點 */
function amoTrip(k){
  if (amoTrip.k === k) return amoTrip.c;
  const aD = Math.atan2(AMO.dock[1], AMO.dock[0]), bridge = Math.PI / 2, h = hash32('amo' + k);
  let aT; for (let tries = 0; tries < 20; tries++){ aT = -Math.PI + ((h >>> (tries % 16)) % 1000) / 1000 * Math.PI * 2 + tries * 0.37; aT = Math.atan2(Math.sin(aT), Math.cos(aT)); if (Math.abs(aT - bridge) > 0.45 && Math.abs(aT - aD) > 0.3) break; }
  // 往不會經過大橋的那個方向繞
  let d = aT - aD; const crosses = (from, delta) => { for (let u = 0; u <= 1; u += 0.02){ const a = Math.atan2(Math.sin(from + delta * u), Math.cos(from + delta * u)); if (Math.abs(a - bridge) < 0.4) return true; } return false; };
  if (crosses(aD, d)) d = d > 0 ? d - Math.PI * 2 : d + Math.PI * 2;
  const pts = [AMO.dock.slice()], n = Math.max(2, Math.ceil(Math.abs(d) / 0.06)); for (let i = 0; i <= n; i++) pts.push(amoRing(aD + d * i / n));
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  amoTrip.k = k; amoTrip.c = { pts, cum, len: cum[cum.length - 1], aT, sail: cum[cum.length - 1] / AMO.speed }; return amoTrip.c;
}
function amoAt(c, s){ s = clamp(s, 0, c.len); let i = 1; while (i < c.cum.length - 1 && c.cum[i] < s) i++; const a = c.pts[i - 1], b = c.pts[i], seg = c.cum[i] - c.cum[i - 1] || 1, u = (s - c.cum[i - 1]) / seg; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], b[1] - a[1])]; }
function amoRecast(n, t){ const a = n.rot, dx = Math.sin(a), dz = Math.cos(a), cp = castPoint(n.pos.x, n.pos.z, dx, dz, 4.5); n.bobPos.set(cp[0], 0.12, cp[1]); n.fishing = true; n.bobState = 'water'; n.flying = null; n.st = 'wait'; n.next = t + rand(4, 10); }
function updateAmo(n, dt, t){
  if (!n.boat){ n.boat = makeBoatMesh('#c8161c'); scene.add(n.boat); n.home = n.pos.clone(); n.homeRot = n.rot; n.homeY = n.baseY; }
  const T = Date.now() / 1000, k = Math.floor(T / AMO.cycle), ph = T - k * AMO.cycle, c = amoTrip(k), S = c.sail, fishEnd = AMO.cycle - AMO.pier - S;
  let mode, s; if (ph < S){ mode = 'go'; s = ph * AMO.speed; } else if (ph < fishEnd){ mode = 'sea'; s = c.len; } else if (ph < fishEnd + S){ mode = 'back'; s = c.len - (ph - fishEnd) * AMO.speed; } else mode = 'pier';
  if (mode === 'pier'){ n.boat.position.set(AMO.dock[0], WATER_LEVEL, AMO.dock[1]); n.boat.rotation.set(0, Math.PI / 2, 0);
    if (n.amoMode !== 'pier'){ n.pos.copy(n.home); n.baseY = n.homeY; n.rot = n.homeRot; n.sitting = false; amoRecast(n, t); if (n.amoMode && camera.position.distanceTo(n.pos) < 25) n.say('今天又沒遇到……下一趟換個地方', '', 4); } }
  else { const [x, z, hd0] = amoAt(c, s), bob = Math.sin(t * 1.6 + 1) * 0.04, out = Math.atan2(Math.cos(c.aT), Math.sin(c.aT)) * 0 + Math.atan2(x, z);   /* 釣魚的時候面向外海（背對島） */
    const hd = mode === 'sea' ? out : hd0 + (mode === 'back' ? Math.PI : 0);
    n.boat.position.set(x, WATER_LEVEL + bob, z); n.boat.rotation.set(Math.sin(t * 1.1) * 0.02, hd, Math.sin(t * 1.3) * 0.03);
    n.pos.set(x, 0, z); n.baseY = WATER_LEVEL - 0.08 + bob; n.sitting = true; n.rot = hd;
    if (mode !== 'sea'){ n.fishing = false; n.bobState = 'none'; n.flying = null; n.st = 'wait'; n.next = t + 3; }
    else if (n.amoMode !== 'sea'){ amoRecast(n, t); if (camera.position.distanceTo(n.pos) < 30) n.say('今天來這裡試試看……紅鯊，我來了', '', 4); } }
  if (n.amoMode === 'pier' && mode === 'go' && camera.position.distanceTo(n.pos) < 25) n.say('我要開船出海了，港口裡不會有紅鯊的', '', 4);
  n.amoMode = mode;
}
function updateNpcs(dt, t){
  for (const n of npcs){
    if (n.wid === 'gang' && Cloud.on && (!Gang.at || Date.now() - Gang.at > 10 * 60000) && Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z) < 30) loadGang();
    if (worldDrive(n, dt, t)){ worldShopLoad(n); continue; }
    if (n.tailor){ updateLing(n, dt, t); continue; }
    if (n.shopNpc === 'mu'){ updateMu(n, dt, t); continue; }
    if (n.shopNpc === 'cai'){ updateShopNpc(n, dt, t, () => (!Cai.at || Date.now() - Cai.at > 10 * 60000) && loadCai()); continue; }
    if (n.shopNpc === 'news'){ updateShopNpc(n, dt, t, () => (!News.at || Date.now() - News.at > 10 * 60000) && loadNews()); continue; }
    if (n.shopNpc === 'fu'){ updateShopNpc(n, dt, t, () => (!Fu.at || Date.now() - Fu.at > 5 * 60000) && loadFu()); continue; }
    if (n.amo) updateAmo(n, dt, t);
    // 村民也會釣魚：等一陣子 → 有魚咬（浮標沉）→ 有時候拉上來捧著魚給大家看 → 舉竿、甩出去
    const st = n.st || 'wait';
    if (st === 'wait' && t > n.next){ n.dip = 1; n.bend = 0.6; ripple(n.bobPos.x, n.bobPos.z);
      if (Math.random() < 0.4){ n.st = 'reel'; n.stT = t + rand(1.6, 3.2); }
      else n.next = t + rand(6, 15); }
    { const d = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z); if (d < 9 && t > (n.talkAt || 0) && !(n.replyUntil > now()) && n.st !== 'show' && !Dive.on && !House.on){ n.say(npcLine(n), '', 6); n.talkAt = t + rand(20, 40); } else if (d > 18 && n.talkAt) n.talkAt = Math.min(n.talkAt, t + 5); }   /* 走近才講話，講完隔一陣子再講 */
    if (st === 'reel'){ n.bend = 0.75 + Math.sin(t * 6) * 0.2; n.dip = 0.6 + Math.sin(t * 9) * 0.3; if (Math.random() < dt * 3) ripple(n.bobPos.x + (Math.random() - 0.5) * 0.6, n.bobPos.z + (Math.random() - 0.5) * 0.6);
      if (t > n.stT){ const sid = waterSpotId(n.bobPos.x, n.bobPos.z), pool = (SPOT_BY_ID[sid] || SPOT_BY_ID.sea).fish.map(id => FISH_BY_ID[id]).filter(f => f && f.rarity === '常見' && !BIG_FISH.has(f.id));
        const f = pool[Math.floor(Math.random() * pool.length)]; ripple(n.bobPos.x, n.bobPos.z, true); n.fishing = false; n.bobState = 'none'; n.flying = null; n.dip = 0; n.bend = 0;
        if (f){ n.holdFish(f, +(f.min + (f.max - f.min) * Math.random() * 0.6).toFixed(2), 4); if (camera.position.distanceTo(n.pos) < 25 && Math.random() < 0.6) n.say((n.catchLines || ['釣到了！', `是${f.name}！`, '今天運氣不錯～', '嘿咻！'])[Math.floor(Math.random() * (n.catchLines ? n.catchLines.length : 4))], '', 3); }
        n.st = 'show'; n.stT = t + 4.2; } }
    if (st === 'show' && t > n.stT){ n.fishing = true; n.windup = 0; n.st = 'windup'; n.stT = t + 0.7; }
    if (st === 'windup'){ n.windup = Math.min(1, (n.windup || 0) + dt / 0.6);
      if (t > n.stT){ n.windup = 0; n.castT = 0; const from = new THREE.Vector3(); n.av.tip.getWorldPosition(from); n.bobState = 'fly'; n.flying = { from, to: n.bobPos.clone(), t:0, delay:0.17, dur:0.75, h:1.6 }; n.st = 'wait'; n.next = t + rand(6, 15); } }
    if (st === 'wait'){ n.dip *= Math.pow(0.08, dt); n.bend *= Math.pow(0.2, dt); }
    n.update(dt, t); n.placeTag();
  }
}

/* ================= 村民自己過日子（架構第二階段，054_world.sql）=================
   伺服器每分鐘推進一次「世界時間」：5 位公共 NPC（村長、阿綾、阿木、阿福、老港）的肚子餓、累、想聊天、想玩，照個性和作息決定現在要做什麼、去哪裡、幾點出發、幾點到。
   手機只照伺服器的狀態畫：大家用同一張地圖算同一條路，所以不同房間、不同手機看到的村民都在同一個地方、做同一件事。
   沒連上雲端的時候，村民就跟以前一樣站在原本的位置（不會用假的資料假裝在動）。 */
var World = { rows:null, places:null, log:[], rel:[], mem:[], me:{}, talkAt:{}, at:0, busy:false, off:0, fails:0 };
var WORLD_WHO = { chief:'村長', ling:'阿綾', mu:'阿木', fu:'阿福', gang:'老港' };
var WORLD_ACT = { sleep:['💤', '睡覺'], rest:['🏠', '在家休息'], work:['🛠️', '工作'], eat:['🍚', '吃飯'], chat:['💬', '聊天'], fish:['🎣', '釣魚'], stroll:['🚶', '散步'] };
async function loadWorld(){
  if (World.busy || !Cloud.on || !Cloud.sb) return; World.busy = true; World.at = Date.now();
  try { const t0 = Date.now(), { data, error } = await Cloud.sb.rpc('npc_world'); if (error) throw error;
    if (data && data.now){ World.off = Date.parse(data.now) + (Date.now() - t0) / 2 - Date.now(); if (data.places){ World.places = {}; for (const p of data.places) World.places[p.id] = p; } World.rows = {}; for (const r of data.npcs || []) World.rows[r.id] = r; World.log = data.log || []; World.rel = data.rel || []; World.mem = data.mem || []; World.me = data.me || {}; World.fails = 0; } }
  catch(e){ World.fails++; }
  World.busy = false;
}
function worldNow(){ return Date.now() + World.off; }
// ---- 尋路：0.6 公尺一格，格子能不能走是照遊戲本來的 walkable／blocked 算（第一次用到才算、算過記住）。兩個地點之間的路算一次就記住 ----
var NAV = { c:0.6, x0:-52, z0:-66, nx:190, nz:190, m:null, paths:new Map() };
function navOk(i, j){
  if (i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) return false;
  if (!NAV.m) NAV.m = new Int8Array(NAV.nx * NAV.nz); const k = j * NAV.nx + i; let v = NAV.m[k];
  if (!v){ const x = NAV.x0 + (i + 0.5) * NAV.c, z = NAV.z0 + (j + 0.5) * NAV.c; v = walkable(x, z) && !blocked(x, z, 0.3) && groundHeight(x, z) < 6 ? 1 : 2; NAV.m[k] = v; }
  return v === 1;
}
function navCell(x, z){ return [Math.floor((x - NAV.x0) / NAV.c), Math.floor((z - NAV.z0) / NAV.c)]; }
function navNear(x, z){ const [i0, j0] = navCell(x, z); for (let r = 0; r < 8; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++){ if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (navOk(i0 + di, j0 + dj)) return [i0 + di, j0 + dj]; } return null; }
function navLine(ax, az, bx, bz){ const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25); for (let k = 1; k < n; k++){ const u = k / n, [i, j] = navCell(ax + (bx - ax) * u, az + (bz - az) * u); if (!navOk(i, j)) return false; } return true; }
function navFind(ax, az, bx, bz){
  const s = navNear(ax, az), g = navNear(bx, bz); if (!s || !g) return null;
  const W = NAV.nx, key = (i, j) => j * W + i, gk = key(g[0], g[1]), h = (i, j) => Math.hypot(i - g[0], j - g[1]);
  const G = new Map(), from = new Map(), heap = [[h(s[0], s[1]), s[0], s[1]]]; G.set(key(s[0], s[1]), 0);
  const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let found = false, guard = 0;
  while (heap.length && guard++ < 60000){ const [, i, j] = pop(), k = key(i, j); if (k === gk){ found = true; break; } const gc = G.get(k);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++){ if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!navOk(ni, nj)) continue; if (di && dj && (!navOk(i + di, j) || !navOk(i, j + dj))) continue;
      const nk = key(ni, nj), ng = gc + (di && dj ? 1.414 : 1); if (G.has(nk) && G.get(nk) <= ng) continue; G.set(nk, ng); from.set(nk, k); push([ng + h(ni, nj), ni, nj]); } }
  if (!found) return null;
  const cells = []; for (let k = gk; k != null; k = from.get(k)) cells.push([NAV.x0 + ((k % W) + 0.5) * NAV.c, NAV.z0 + (Math.floor(k / W) + 0.5) * NAV.c]); cells.reverse();
  const pts = [[ax, az]]; let a = cells[0]; pts.push(a);   /* 拉直：看得到下一個轉角就直接走過去 */
  for (let k = 1; k < cells.length; k++){ if (k === cells.length - 1 || !navLine(a[0], a[1], cells[k + 1][0], cells[k + 1][1])){ a = cells[k]; pts.push(a); } }
  pts.push([bx, bz]); return pts;
}
function navPath(pa, pb){
  const k = pa.id + '>' + pb.id; let c = NAV.paths.get(k); if (c) return c;
  const pts = navFind(pa.x, pa.z, pb.x, pb.z) || [[pa.x, pa.z], [pb.x, pb.z]], cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  c = { pts, cum, len: cum[cum.length - 1] }; NAV.paths.set(k, c); return c;
}
function navAt(c, s){ s = clamp(s, 0, c.len); let i = 1; while (i < c.cum.length - 1 && c.cum[i] < s) i++; const a = c.pts[i - 1], b = c.pts[i], u = (s - c.cum[i - 1]) / ((c.cum[i] - c.cum[i - 1]) || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], b[1] - a[1])]; }
// 這個 NPC 現在應該在哪裡、在做什麼（純粹照伺服器的資料算，不會自己亂改）
function worldPose(wid){
  const r = World.rows && World.rows[wid], P = World.places; if (!r || !P || !P[r.place]) return null;
  const T = worldNow(), to = P[r.place], fr = P[r.from] || to, dep = Date.parse(r.dep), arr = Date.parse(r.arr);
  if (fr !== to && T < arr){ const c = navPath(fr, to), u = clamp((T - dep) / Math.max(1, arr - dep), 0, 1), [x, z, h] = navAt(c, u * c.len); return { walk:true, x, z, rot:h, v: c.len / Math.max(1, (arr - dep) / 1000), r, to }; }
  // 到了：同一個地方有好幾個人的話，大家站開一點、面向彼此
  const here = Object.values(World.rows).filter(o => o.place === r.place && (o.place === o.from || T >= Date.parse(o.arr))).map(o => o.id).sort(), n = here.length, k = Math.max(0, here.indexOf(wid));
  let x = to.x, z = to.z, rot = to.r == null ? 0 : +to.r;
  if (n > 1 && !to.solo){ const a = k / n * Math.PI * 2 + 0.6, rr = 0.75 + n * 0.12; x += Math.cos(a) * rr; z += Math.sin(a) * rr; rot = Math.atan2(to.x - x, to.z - z); }
  return { walk:false, x, z, rot, v:0, r, to };
}
var WORLD_LINES = {
  walk: { eat:['肚子好餓，去食堂吃飯', '今天中午吃什麼好呢'], sleep:['好睏……回家睡覺了', '晚安，明天見'], rest:['有點累，回家休息一下'], work:['要去上班了！', '工作的時間到了'], chat:['去找大家聊聊天', '好想跟人說說話'], fish:['去釣一下魚放鬆', '今天的魚應該很會咬'], stroll:['出去走走', '天氣不錯，散個步'] },
  eat: ['美雲姨煮的魚湯最好喝了', '吃飽了才有力氣', '這道菜好香'], chat: ['今天村子好熱鬧', '你也來一起聊天嗎？'], fish: ['噓……魚快咬了', '今天換我來釣看看'], stroll: ['這裡的風好舒服', '散散步，心情會變好'], rest: ['在家裡休息一下'],
};
function worldLine(n, wp){ const pick = a => a[Math.floor(Math.random() * a.length)]; if (wp.walk) return pick(WORLD_LINES.walk[wp.r.act] || ['出門囉']); return pick(WORLD_LINES[wp.r.act] || ['嗯嗯']); }
function worldTag(n, wp){ const ic = wp ? (wp.walk ? '🚶' : (WORLD_ACT[wp.r.act] || [''])[0]) : ''; if (n.nm.dataset.st !== ic){ if (ic) n.nm.dataset.st = ic; else delete n.nm.dataset.st; } }
// 每一幀：回傳 true 表示這一幀已經處理完（走路中、在家、不在工作的地方），false 表示「在原本的位置做原本的事」，讓原本的程式接手
function worldDrive(n, dt, t){
  if (!n.wid) return false;
  { const fd = Math.hypot(camera.position.x - n.pos.x, camera.position.z - n.pos.z); if (fd > 70 && n.wMode && n.wMode !== 'post'){ n.wSkip = (n.wSkip || 0) + dt; if (frameNo % 6) return true; dt = n.wSkip; n.wSkip = 0; } }   /* 遠的村民 6 幀才算一次 */
  if (Cloud.on && (!World.at || Date.now() - World.at > (World.fails ? 90000 : 30000))) loadWorld();
  const wp = Cloud.on ? worldPose(n.wid) : null;
  if (!n.post) n.post = { x:n.pos.x, z:n.pos.z, y:n.baseY, rot:n.rot, fishing:n.fishing, bob:n.bobPos.clone() };
  worldTag(n, wp);
  if (!wp){ if (n.wMode){ n.wMode = null; n.wHide = false; n.pos.set(n.post.x, n.post.y, n.post.z); n.baseY = n.post.y; n.rot = n.post.rot; n.av.g.visible = true; } return false; }
  const P = n.post, atPost = !wp.walk && Math.hypot(wp.x - P.x, wp.z - P.z) < 0.6 && (wp.r.act === 'work' || wp.r.act === 'fish' && n.post.fishing);
  const mode = wp.walk ? 'walk' : atPost ? 'post' : (wp.r.act === 'sleep' || wp.r.act === 'rest') && wp.to.kind === 'home' ? 'home' : 'away';
  const d = Math.hypot(n.pos.x - wp.x, n.pos.z - wp.z);
  if (d > 12 || !n.wMode) n.pos.x = wp.x, n.pos.z = wp.z;   /* 剛載入、或差太多：直接放到正確的位置 */
  else { const k = Math.min(1, dt * 6); n.pos.x += (wp.x - n.pos.x) * k; n.pos.z += (wp.z - n.pos.z) * k; }
  if (mode !== n.wMode){
    if (mode !== 'post'){ n.fishing = false; n.bobState = 'none'; n.flying = null; n.st = 'wait'; n.next = t + 3; n.sitting = false; }
    if (mode === 'post'){ n.pos.set(P.x, P.y, P.z); n.baseY = P.y; n.rot = P.rot; if (P.fishing){ n.fishing = true; n.bobState = 'water'; n.bobPos.copy(P.bob); n.st = 'wait'; n.next = t + rand(3, 8); } }
    else if (mode !== 'walk' && wp.to.fishDir != null){ const a = +wp.to.fishDir, cp = castPoint(wp.x, wp.z, Math.sin(a), Math.cos(a), 4.2); n.rot = a; n.bobPos.set(cp[0], 0.12, cp[1]); n.fishing = wp.r.act === 'fish'; n.bobState = n.fishing ? 'water' : 'none'; }
    n.wHide = mode === 'home'; n.av.g.visible = !n.wHide; if (n.blob) n.blob.visible = !n.wHide; n._culled = false;
    n.wMode = mode;
  }
  if (mode === 'post') return false;
  if (mode !== 'home' && !n._culled) n.av.g.visible = !onIsle;
  n.baseY = groundHeight(n.pos.x, n.pos.z); n.pos.y = n.baseY;
  if (mode === 'walk'){ n.rot = lerpAngle(n.rot, wp.rot, 1 - Math.exp(-8 * dt)); n.speed = wp.v; }
  else { n.speed = 0; if (mode === 'away' && !n.fishing) n.rot = lerpAngle(n.rot, wp.rot, 1 - Math.exp(-3 * dt)); }
  // 走近的時候講一句現在在做的事
  const pd = Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z);
  if (mode !== 'home'){
    if (pd < 7 && !wp.walk && !n.fishing) n.rot = lerpAngle(n.rot, Math.atan2(me.pos.x - n.pos.x, me.pos.z - n.pos.z), 1 - Math.exp(-3 * dt));
    if (pd < 9 && t > (n.talkAt || 0) && !(n.replyUntil > now()) && !Dive.on && !House.on){ n.say(Math.random() < 0.6 ? worldLine(n, wp) : npcLine(n), '', 5); n.talkAt = t + rand(16, 30); } else if (pd > 18 && n.talkAt) n.talkAt = Math.min(n.talkAt, t + 5);
    // 一起聊天的人：偶爾互相講一句
    if (wp.r.act === 'chat' && !wp.walk && pd < 30 && t > (n.chatAt || 0)){ n.chatAt = t + rand(9, 20); const others = Object.values(World.rows).filter(o => o.id !== n.wid && o.place === wp.r.place && o.act === 'chat'); if (others.length && Math.random() < 0.7){ const o = others[Math.floor(Math.random() * others.length)], nm = WORLD_WHO[o.id] || '';
      const rl = worldRel(n.wid, o.id), lb = rl ? rl.label : '不熟', A = lb === '不合' ? ['哼', `${nm}，你又來了`, '我不想跟你說話'] : lb === '競爭對手' ? [`${nm}，今天釣得過我嗎？`, '這次我一定贏你', '哼，運氣好而已'] : lb === '家人' ? [`${nm}，晚餐回家吃嗎？`, '媽打電話來說想我們了', `${nm}，今天的魚很新鮮喔`] : lb === '好友' || lb === '朋友' || lb === '同事・朋友' ? [`${nm}，最近好嗎？`, `${nm}你看今天的海`, '哈哈哈，你太好笑了', '真的假的！', '下次一起去釣魚吧'] : [`${nm}……你好`, '今天天氣不錯呢', '嗯嗯'];
      n.say(A[Math.floor(Math.random() * A.length)], '', 4); } }
  }
  if (n.fishing && mode === 'away'){ const st = n.st || 'wait'; if (st === 'wait' && t > n.next){ n.dip = 1; n.bend = 0.6; ripple(n.bobPos.x, n.bobPos.z); n.next = t + rand(6, 15); } n.dip *= Math.pow(0.08, dt); n.bend *= Math.pow(0.2, dt); }
  if (mode !== 'home') n.update(dt, t);
  n.placeTag(); return true;
}
// ---- 第三階段：記憶和關係變成台詞（全部照伺服器記得的事講） ----
function worldRel(x, y){ return (World.rel || []).find(r => (r.a === x && r.b === y) || (r.a === y && r.b === x)); }
function worldMemLines(n){
  const id = n.wid, out = [], nm = myDisplayName && myDisplayName() !== '你' ? myDisplayName() : '', M = (World.mem || []).filter(m => m.npc === id), me = (World.me || {})[id];
  if (me && me.talks > 0){ out.push(me.score >= 60 ? `${nm || '你'}！看到你真開心，我們是好朋友了吧` : me.score >= 25 ? `${nm || '你'}又來啦！我們已經聊過 ${me.talks} 次了` : `${nm ? nm + '，' : ''}我記得你，上次我們有聊天`); }
  for (const m of M.filter(m => m.about === 'me')){ if (m.kind === 'gift') out.push(m.txt.replace(/^.*?送了我/, '謝謝你送我') + '，我好開心'); }
  for (const m of M.filter(m => m.about !== 'me' && m.about !== 'player').slice(0, 4)){
    if (m.kind === 'quarrel') out.push(`唉，我${m.txt}……`); else if (m.kind === 'fallout') out.push(`我${m.txt}，現在不太想看到他`); else if (m.kind === 'friend' || m.kind === 'bestie') out.push(`告訴你，我最近${m.txt}！`); else if (m.kind === 'weather') out.push(`之前${m.txt}`); }
  const rels = (World.rel || []).filter(r => r.a === id || r.b === id).map(r => ({ o: r.a === id ? r.b : r.a, l: r.label, s: r.score })).sort((a, b) => b.s - a.s);
  if (rels[0] && rels[0].s >= 30) out.push(`我跟${WORLD_WHO[rels[0].o]}是${rels[0].l === '家人' ? '一家人' : rels[0].l}，常常一起聊天`);
  const riv = rels.find(r => r.l === '競爭對手' || r.l === '不合'); if (riv) out.push(riv.l === '不合' ? `${WORLD_WHO[riv.o]}？別跟我提他` : `${WORLD_WHO[riv.o]}那傢伙，釣魚一定贏不過我`);
  return out;
}
// 跟村民說話：伺服器記得你跟他聊過幾次（每個村民 10 分鐘算一次）
function worldTalk(n){ if (!n || !n.wid || !Cloud.on || !Cloud.sb) return; const k = n.wid; if (World.talkAt[k] && Date.now() - World.talkAt[k] < 10 * 60000) return; World.talkAt[k] = Date.now();
  Cloud.sb.rpc('npc_talk', { p_npc: k }).then(({ data }) => { if (data && World.me){ World.me[k] = Object.assign({}, World.me[k], data); } }).catch(() => {}); }
async function worldGift(k, t){ try { const { data, error } = await Cloud.sb.rpc('npc_gift', { p_npc: k, p_t: t }); if (error) throw error; adoptRow(data); buildTank(); SFX.catch(); flash(`🎁 ${WORLD_WHO[k]}收下了你的禮物！`, 1.6);
    const n = npcs.concat(questNpcs.map(q => q.f)).find(f => f.wid === k); if (n) n.say('哇！謝謝你～我會好好珍惜的', 'emote', 4); World.at = 0; loadWorld(); } catch(e){ toast(cloudErrMsg(e)); } }
function worldNear(k){ const n = npcs.concat(questNpcs.map(q => q.f)).find(f => f.wid === k); return n && !n.wHide && Math.hypot(me.pos.x - n.pos.x, me.pos.z - n.pos.z) < 8; }
function renderWorldGift(body){ const k = World.giftTo; body.appendChild(el('div', 'dexhead', `🎁 送一條魚給${WORLD_WHO[k] || ''}`));
  body.appendChild(el('p', 'sub', '每個村民每天收一條。要野生的魚（收藏⭐、展示中、箱網養的、魚缸生的不行）。越稀有的魚，他會越開心、越記得你。'));
  const cand = (rec.tank || []).filter(x => FISH_BY_ID[x.f] && !x.fm && !x.y && !x.rs && !x.k && !(rec.show || []).includes(x.t)).sort((a, b) => b.w - a.w).slice(0, 60);
  if (!cand.length) body.appendChild(el('div', 'empty', '魚缸裡沒有可以送的魚。'));
  const ul = el('ul', 'shoplist cols'); for (const x of cand){ const f = FISH_BY_ID[x.f], li = el('li'); li.appendChild(el('span', 'dishic', '🐟')); const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${f.name} ${fmtKg(x.w)}`)); d.appendChild(el('div', 'sub2', f.rarity)); li.appendChild(d);
    li.addEventListener('click', () => { if (!worldNear(k)){ toast(`走到${WORLD_WHO[k]}旁邊才能送喔`); return; } closeSheet(); worldGift(k, x.t); }); ul.appendChild(li); }
  body.appendChild(ul); const bk = el('button', 'tbtn ghost', '返回'); bk.addEventListener('click', () => { curTab = 'map'; renderTab(); }); body.appendChild(bk); }
// 地圖、看板用：每個村民現在在做什麼
function worldSummary(){ if (!World.rows || !World.places) return []; return Object.keys(WORLD_WHO).filter(k => World.rows[k]).map(k => { const wp = worldPose(k), r = World.rows[k], pl = World.places[r.place] || {}; return { id:k, name:WORLD_WHO[k], icon: wp && wp.walk ? '🚶' : (WORLD_ACT[r.act] || ['❔'])[0], text: wp && wp.walk ? `正在走去${pl.name || ''}（要${(WORLD_ACT[r.act] || ['', ''])[1]}）` : `在${pl.name || ''}${(WORLD_ACT[r.act] || ['', ''])[1]}`, x: wp ? wp.x : pl.x, z: wp ? wp.z : pl.z }; }); }

// 手機效能：畫質「低／中」時，離鏡頭太遠的 NPC 和客人先不畫（每個角色有 20～40 個零件，很吃效能）
const AV_CULL = { low: 30, mid: 48 };
function cullAvatars(){
  const R = AV_CULL[Quality.tier]; if (!R) return; const cx = camera.position.x, cz = camera.position.z, R2 = R * R;
  const far = f => { const dx = f.pos.x - cx, dz = f.pos.z - cz; return dx * dx + dz * dz > R2; };
  const own = f => { if (f.wHide){ f.av.g.visible = false; if (f.blob) f.blob.visible = false; return; } const fr = far(f); if (fr && f.av.g.visible){ f.av.g.visible = false; f._culled = true; } else if (!fr && f._culled){ f.av.g.visible = true; f._culled = false; } if (f.blob) f.blob.visible = f.av.g.visible; };
  for (const n of npcs) own(n); for (const c of customers) if (c.f) own(c.f);
  for (const q of questNpcs) if (q.f.av.g.visible && far(q.f)){ q.f.av.g.visible = false; if (q.f.blob) q.f.blob.visible = false; }
  if (ferryNpc && ferryNpc.f.av.g.visible && far(ferryNpc.f)){ ferryNpc.f.av.g.visible = false; if (ferryNpc.f.blob) ferryNpc.f.blob.visible = false; }
}
/* ================= SHEET ================= */
let curTab = 'dex', tankSort = 'new';
function openSheet(tab){ SFX.click(); sheetOpenedAt = performance.now(); curTab = tab; $('#sheet').hidden = false; uiBlocked = true; for (const k in keys) keys[k] = false; renderTab(); }
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
  if (curTab === 'wgift'){ renderWorldGift(body); return; }
  if (curTab === 'cldesign'){ renderClDesign(body); return; }
  if (curTab === 'shop'){ renderShop(body); return; }
  if (curTab === 'cook'){ renderCook(body); return; }
  if (curTab === 'island'){ renderIsland(body); return; }
  if (curTab === 'furn'){ renderFurnSheet(body); return; }
  if (curTab === 'quest'){ renderQuests(body); return; }
  if (curTab === 'ferry'){ renderFerry(body); return; }
  if (curTab === 'shrimp'){ renderShrimpDesk(body); return; }
  if (curTab === 'dex'){
    const base = FISH.filter(f => !f.of), got = base.filter(f => rec.count[f.id]).length, vgot = FISH.filter(f => f.of && rec.count[f.id]).length;   /* 變種不算在總數裡（不然就知道有幾種了） */
    body.appendChild(el('p', 'sub', `已收集 ${got} / ${base.length} 種${vgot ? `・✨ 找到 ${vgot} 種變種` : ''}・總共釣到 ${rec.total} 條・傳說 ${rec.legend} 條。拋得越遠，越容易遇到稀有魚。${hasDive('dive_suit') || (rec.photos || []).length ? `📸 水下圖鑑（潛水時拍到的）${(rec.photos || []).length} / ${diveSpecies().length} 種。` : ''}`));
    for (const s of SPOTS){
      if (!FISH.some(f => f.spot === s.id)) continue;
      const sf = FISH.filter(f => f.spot === s.id && !f.of), sg = sf.filter(f => rec.count[f.id]).length, sn = sf.reduce((a, f) => a + (rec.count[f.id] || 0), 0);
      const h = el('div', 'dexhead', s.label); h.appendChild(el('span', 'dexcnt' + (sg === sf.length ? ' all' : ''), `${sg} / ${sf.length} 種${sn ? `・${sn} 條` : ''}${sg === sf.length ? ' ✨' : ''}`)); h.appendChild(el('small', '', s.subtitle)); body.appendChild(h);
      const g = el('div', 'dex');
      FISH.filter(f => f.spot === s.id && (!f.of || rec.count[f.id])).sort((a,b) => (a.of ? 1 : 0) - (b.of ? 1 : 0) || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]).forEach(f => {   // 變種要釣到才會出現在圖鑑
        const known = !!rec.count[f.id]; const it = el('div', 'it' + (known ? '' : ' lock'));
        it.appendChild(fishCanvas(f, known, 96, 60)); it.appendChild(el('div', 'n', known ? f.name : '？？？'));
        it.appendChild(el('span', 'chip r-' + f.rarity, f.rarity)); if (f.of){ it.classList.add('var'); it.appendChild(el('span', 'chip var', `✨ ${FISH_BY_ID[f.of].name}的變種`)); } if (SEASON_FISH.has(f.id)) it.appendChild(el('span', 'chip season', SEASONS[SEASON].icon + '當季'));
        it.appendChild(el('div', 'meta', known ? `最大 ${rec.best[f.id].toFixed(2)}kg・${rec.count[f.id]} 條` : '尚未釣到'));
        if (f.time) it.appendChild(el('div', 'meta tm', PERIOD_LABEL[f.time].split(' ')[0] + ' ' + PERIOD_FISH[f.time]));
        g.appendChild(it);
      });
      body.appendChild(g);
    }
  } else if (curTab === 'rank'){
    const seg = el('div', 'seg');
    (Cloud.contest ? [['week','🏆本週比賽']] : []).concat(Cloud.on ? [['tny','⏱️定時大賽']] : []).concat([['best','最大的魚']]).concat(Cloud.on ? [['rare','💎最稀有的魚']] : []).concat([['total','釣魚總數']]).concat(Cloud.on ? [['earned','賺最多金幣']] : []).forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(lbMode === k)); b.addEventListener('click', () => { lbMode = k; renderTab(); }); seg.appendChild(b); });
    body.appendChild(seg);
    if (lbMode === 'week' && !Cloud.contest) lbMode = 'best';
    if ((lbMode === 'tny' || lbMode === 'rare') && !Cloud.on) lbMode = 'best';
    if (lbMode === 'rare'){   // 最稀有的魚：全服總共被釣到最少次的魚（伺服器 033_rare_board.sql）
      body.appendChild(el('p', 'sub', '每個人釣過的魚裡面，全服被釣到最少次的那一種。越少人釣到的越稀有；同樣少的話，傳說 > 稀有 > 常見。'));
      if (!Rare.at || Date.now() - Rare.at > 60000){ Rare.at = Date.now(); Cloud.sb.rpc('get_rare_board').then(({ data }) => { if (Array.isArray(data)){ Rare.rows = data; if (curTab === 'rank' && lbMode === 'rare' && !$('#sheet').hidden) renderTab(); } }, () => {}); }
      const rows = Rare.rows || [];
      if (!rows.length){ body.appendChild(el('div', 'empty', Rare.rows ? '還沒有人上榜。' : '正在讀取排行榜…')); return; }
      const ul = el('ol', 'rank'); rows.slice(0, 20).forEach((r, i) => { const f = FISH_BY_ID[r.f]; if (!f) return; const isMe = r.id === myId, li = el('li', 'rk4' + (isMe ? ' me' : ''));
        li.appendChild(el('span', 'pos', String(i + 1))); const known = rec.count[f.id] > 0; const cv = fishCanvas(f, known, 56, 36); cv.className = 'rkfish'; li.appendChild(cv);   /* 自己沒釣過的只看得到黑影（變種也不會被看光） */
        const who = el('span', 'who', isMe ? `${myDisplayName() === '你' ? '你' : myDisplayName() + '（你）'}` : (r.name || '釣客')); who.appendChild(el('small', '', known ? `${f.name}・${f.rarity}${f.of ? '・✨變種' : ''}` : `？？？・${f.rarity}${f.of ? '・✨神秘變種' : ''}`));
        if (!isMe && r.id){ who.classList.add('canvisit'); who.addEventListener('click', () => visitAquarium(r.id, r.name)); who.appendChild(el('small', 'vlink', '🐠 點一下參觀他的水族館')); }
        li.appendChild(who); li.appendChild(el('span', 'val', r.n <= 1 ? '全服唯一' : `全服 ${r.n} 條`)); ul.appendChild(li); });
      body.appendChild(ul); return;
    }
    if (lbMode === 'tny'){
      const T = tourneyNow(), st = new Date(T.start), hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      body.appendChild(el('p', 'sub', `每天台灣時間 ${TOURNEY.hours.map(h => h + ':00').join('、')} 開始，每場 ${TOURNEY.mins} 分鐘。比賽時間內釣到的魚全部加起來，總重量最重的前三名拿 🪙${TOURNEY.prize.join(' / ')}，有參加的人也有 🪙${TOURNEY.join}。結束後會自動發獎。`));
      body.appendChild(el('div', 'tipbox')).innerHTML = T.active ? `<b>🏆 比賽進行中！還剩 ${mmss(T.end - Date.now())}</b><span>${Tny.myW > 0 ? `你目前 ${Tny.myN} 條・${Tny.myW.toFixed(2)}kg，第 ${tnyRank()} 名` : '你還沒釣到魚，快去拋竿！'}</span>` : `<b>⏰ 下一場：${st.getMonth() + 1}/${st.getDate()} ${hm(st)}</b><span>${Tny.boardId ? '下面是上一場的成績。' : '還沒有比賽紀錄。'}</span>`;
      if (!Tny.boardId && !Tny.loadedPrev){ Tny.loadedPrev = true; const last = (() => { const ms = Date.now(); for (let back = 0; back < 48; back++){ const tt = tourneyNow(ms - back * 3600e3 - 11 * 60e3); if (tt.end <= ms) return tt.id; } return null; })(); if (last) loadTnyBoard(last); }
      const rows = Tny.board.slice(); if (T.active && Tny.myW > 0 && !rows.some(r => r.id === myId)) rows.push({ id: myId, name: myDisplayName(), w: Tny.myW, n: Tny.myN });
      rows.forEach(r => { if (r.id === myId && T.active) r.w = Math.max(r.w, Tny.myW); }); rows.sort((a, b) => b.w - a.w);
      if (!rows.length){ body.appendChild(el('div', 'empty', T.active ? '還沒有人釣到魚，第一名是你的！' : '上一場還沒有成績。')); return; }
      const ul = el('ol', 'rank'); rows.slice(0, 10).forEach((r, i) => { const isMe = r.id === myId, li = el('li', isMe ? 'me' : ''); li.appendChild(el('span', 'pos', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)));
        const who = el('span', 'who', isMe ? `${myDisplayName() === '你' ? '你' : myDisplayName() + '（你）'}` : (r.name || '釣客')); who.appendChild(el('small', '', `${r.n} 條${i < 3 ? `・獎金 🪙${TOURNEY.prize[i]}` : ''}`)); li.appendChild(who);
        li.appendChild(el('span', 'val', r.w.toFixed(2) + ' kg')); ul.appendChild(li); });
      body.appendChild(ul); return;
    }
    if (Cloud.on && lbMode === 'week'){ Object.assign(lb, Cloud.board); const cf = FISH_BY_ID[Cloud.contest.fish], end = new Date(Cloud.contest.ends_at);
      body.appendChild(el('p', 'sub', `本週目標：在${SPOT_BY_ID[cf.spot].label}釣最重的「${cf.name}」。比賽到 ${end.getMonth() + 1}/${end.getDate()}（週一）00:00 結束，之後換新的魚。`)); }
    else if (Cloud.on){ Object.assign(lb, Cloud.board); body.appendChild(el('p', 'sub', '全服排行榜：所有玩家的紀錄都經過伺服器檢查，每分鐘更新一次。')); }
    else if (!db){ body.appendChild(el('p', 'sub', '排行榜會跟所有打開這個村子的人同步。目前沒有連上共享資料，下面只顯示你自己的紀錄。')); }
    else if (lbSlow){ body.appendChild(el('p', 'sub', '暫時連不上排行榜，資料可能不是最新的。')); }
    const shared = db || Cloud.on;
    let rows = (lbMode === 'best' ? lb.best : lbMode === 'earned' ? (lb.earned || []) : lbMode === 'week' ? (lb.week || []) : lb.total).filter(r => r.total > 0);
    if (Cloud.on) rows = rows.map(r => r.id === myId ? Object.assign({}, r, rec, { name:r.name }) : r);   // 自己那一列用最新的資料
    if (lbMode === 'week'){ if (!rows.some(r => r.id === myId) && Cloud.myWeekW > 0) rows = rows.concat([{ id: myId, ...rec, weekW: Cloud.myWeekW, _me: true }]); rows = rows.map(r => r.id === myId ? Object.assign({}, r, { weekW: Math.max(r.weekW || 0, Cloud.myWeekW || 0) }) : r); }
    else if (!shared || (!rows.some(r => r.id === myId) && rec.total > 0)) rows = rows.concat([{ id: myId || 'me', ...rec, _me: true }]);
    rows.sort((a, b) => lbMode === 'week' ? (b.weekW || 0) - (a.weekW || 0) : lbMode === 'best' ? b.bestW - a.bestW : lbMode === 'earned' ? (b.earned || 0) - (a.earned || 0) : b.total - a.total);
    if (!rows.length && lbMode === 'week'){ body.appendChild(el('div', 'empty', '這週還沒有人釣到比賽魚，快去搶第一！')); return; }
    if (!rows.length){ body.appendChild(el('div', 'empty', lbLoading ? '正在讀取排行榜…' : '還沒有人上榜。走到任何一個發光圈拋竿，成為村子裡第一個上榜的釣客吧！')); return; }
    const ul = el('ol', 'rank'); const ids = rows.map(r => r.id).filter(id => id && id !== 'me');
    rows.slice(0, 20).forEach((r, i) => {
      const isMe = r._me || r.id === myId; const li = el('li', isMe ? 'me' : '');
      li.appendChild(el('span', 'pos', String(i + 1)));
      const who = el('span', 'who', isMe ? `${myDisplayName() === '你' ? '你' : myDisplayName() + '（你）'}` : (r.name || profileNames[r.id] || '釣客'));
      who.dataset.id = r.id;
      const bf = r.bestFish && FISH_BY_ID[r.bestFish];
      who.appendChild(el('small', '', lbMode === 'week' ? (i === 0 ? '👑 目前第一名' : '') : lbMode === 'best' ? (bf ? `${bf.name}・${bf.rarity}` : '') : `收集 ${Object.keys(r.count || {}).length} 種・傳說 ${r.legend || 0} 條`));
      li.appendChild(who);
      if (Cloud.on && !isMe && r.id){ who.classList.add('canvisit'); who.title = '參觀水族館'; who.addEventListener('click', () => visitAquarium(r.id, r.name)); who.appendChild(el('small', 'vlink', '🐠 點一下參觀他的水族館')); const vi = el('button', 'tbtn ghost vbtn', '🏝️ 小島'); vi.addEventListener('click', e => { e.stopPropagation(); visitIsle(r.id, r.name); }); who.appendChild(vi); }
      li.appendChild(el('span', 'val', lbMode === 'week' ? (r.weekW || 0).toFixed(2) + ' kg' : lbMode === 'best' ? r.bestW.toFixed(2) + ' kg' : lbMode === 'earned' ? '🪙' + (r.earned || 0).toLocaleString() : r.total + ' 條'));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    const missing = ids.filter(id => !(id in profileNames));
    if (missing.length) resolveNames(missing).then(() => { if (curTab === 'rank' && !$('#sheet').hidden) $$('.rank .who', body).forEach(w => { const id = w.dataset.id; if (id !== myId && profileNames[id]) w.firstChild.textContent = profileNames[id]; }); });
  } else if (curTab === 'bag'){ renderBag(body);
  } else if (curTab === 'tank'){
    const nShow = (rec.show || []).length;
    body.appendChild(el('p', 'sub', nShow ? `你選了 ${nShow} / ${SHOW_MAX} 條魚放進廣場東邊的大水族館。點「展示」可以放進去或拿出來，「放流」會把這條魚放回大自然。`
      : `廣場東邊的大水族館現在是空的。想讓大家看到哪條魚，就按那條魚的「展示」（最多 ${SHOW_MAX} 條）。`));
    if (!rec.tank.length){ body.appendChild(el('div', 'empty', '魚缸還是空的。去任何一個釣點釣第一條魚吧！')); return; }
    breedTank();
    { const pairs = tankPairs(), tip = el('div', 'tipbox'); const ok = pairs.filter(p => p.pairs > 0), half = pairs.filter(p => !p.pairs);
      tip.innerHTML = `<b>🐣 水族館繁殖</b><span>${ok.length ? '正在配對：' + ok.map(p => `${FISH_BY_ID[p.f].name}（♂${p.M} ♀${p.F}）`).join('、') + '。每天有機會生小魚（🍼），小魚賣的錢只有四分之一。' + (half.length ? '還差一隻：' + half.map(p => `${FISH_BY_ID[p.f].name}${p.M ? '要一隻 ♀' : '要一隻 ♂'}`).join('、') + '。' : '') : half.length ? '還差一隻：' + half.map(p => `${FISH_BY_ID[p.f].name}${p.M ? '要一隻 ♀' : '要一隻 ♂'}`).join('、') + '。' : '把同一種魚的一公一母放進水族館展示，就有機會生小魚。會生的有：金魚、錦鯉、鯉魚、鯽魚、吳郭魚、小丑魚、青鱂魚、泰國蝦、小龍蝦、海馬、泥鰍、羅漢魚。'}</span><br>✨ 變種也會生：同一種變種一公一母，小魚就是變種；變種配一般的，小魚會「🧬 帶著變種的基因」，帶基因的再配變種，一半會是變種；兩條帶同樣基因的配在一起，四分之一會是變種。`; body.appendChild(tip); }
    const bar = el('div', 'tankbar');
    const sortSel = el('div', 'seg');
    [['new','最新'],['big','最重'],['rare','最稀有'],['fav','⭐收藏']].forEach(([k, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String((tankSort || 'new') === k)); b.addEventListener('click', () => { tankSort = k; renderTab(); }); sortSel.appendChild(b); });
    bar.appendChild(sortSel); body.appendChild(bar);
    const shown = new Set(shownFish().map(x => x.t));
    let list = rec.tank.slice();
    if (tankSort === 'fav') list = list.filter(x => x.k);
    if (tankSort === 'big') list.sort((a, b) => b.w - a.w);
    else if (tankSort === 'rare') list.sort((a, b) => RARITY_ORDER[FISH_BY_ID[b.f].rarity] - RARITY_ORDER[FISH_BY_ID[a.f].rarity] || b.w - a.w);
    const ul = el('ul', 'tank');
    list.forEach(x => {
      const f = FISH_BY_ID[x.f]; const li = el('li' , shown.has(x.t) ? 'on' : ''); li.appendChild(fishCanvas(gpyFish(x), true, 56, 36));
      const d = el('div', 'tinfo'); d.appendChild(el('div', 'n', `${x.k ? '⭐ ' : ''}${fishNameOf(x)} ${sexIcon(x)}${f.of ? ' ✨變種' : ''}${x.g ? ' 🧬' : ''}${x.b ? ' 🐣' : ''}${x.y ? ' 🍼' : ''}`)); const dt = new Date(x.t);
      d.appendChild(el('div', 'meta', `${x.g && FISH_BY_ID[x.g] ? `帶著${FISH_BY_ID[x.g].name}的基因・` : ''}${x.y ? '水族館出生・' : x.b ? '嘴裡含著小魚・' : ''}${x.w.toFixed(2)}kg・${f.rarity}・${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`)); li.appendChild(d);
      const acts = el('div', 'tacts');
      const show = el('button', 'tbtn' + (shown.has(x.t) ? '' : ' ghost'), shown.has(x.t) ? '展示中' : '展示'); show.setAttribute('aria-pressed', String(shown.has(x.t)));
      show.addEventListener('click', () => {
        if (!rec.show) rec.show = [];
        const i = rec.show.indexOf(x.t);
        if (i >= 0) rec.show.splice(i, 1);
        else { if (rec.show.length >= SHOW_MAX){ toast(`水族館最多放 ${SHOW_MAX} 條，先拿出一條再放。`); return; } rec.show.push(x.t); }
        saveRecLocal(); buildTank(); renderTab(); cloudCall('set_show', { p_show: rec.show.slice() });
      });
      const rel = el('button', 'tbtn ghost', `放流 💙${lovePts(f, x.w)}`);
      rel.addEventListener('click', () => {
        if (rel.dataset.sure !== '1'){ rel.dataset.sure = '1'; rel.textContent = '確定放流？'; setTimeout(() => { if (rel.isConnected){ rel.dataset.sure = ''; rel.textContent = `放流 💙${lovePts(f, x.w)}`; } }, 2500); return; }
        const p = releaseLocal(x); renderTab(); toast(`${esc(f.name)} 游回大海了 💙 愛海點數 +${p}`); cloudCall('release_fish', { p_ts: x.t });
      });
      const star = el('button', 'tbtn' + (x.k ? '' : ' ghost'), x.k ? '⭐' : '☆'); star.title = x.k ? '取消收藏' : '收藏（不能賣）'; star.setAttribute('aria-pressed', String(!!x.k)); star.style.minWidth = '42px';
      star.addEventListener('click', () => { if (setFav(x, !x.k)){ toast(x.k ? `⭐ 收藏了${esc(f.name)}，不會被賣掉` : `取消收藏${esc(f.name)}`); renderTab(); } });
      if (x.k) rel.disabled = true, rel.title = '收藏中的魚要先取消收藏才能放流';
      acts.append(star, show, rel); li.appendChild(acts); ul.appendChild(li);
    });
    body.appendChild(ul);
  } else if (curTab === 'cage'){ renderCage(body);
  } else if (curTab === 'design'){ renderDesignEd(body);
  } else if (curTab === 'mu'){ renderMuShop(body);
  } else if (curTab === 'market'){ renderMarketFish(body);
  } else if (curTab === 'cai'){ renderCaiShop(body);
  } else if (curTab === 'news'){ renderNews(body);
  } else if (curTab === 'gang'){ renderGangShop(body);
  } else if (curTab === 'fu'){ renderFuShop(body);
  } else if (curTab === 'market'){ renderMarket(body);
  } else if (curTab === 'people'){
    if (Cloud.on){ if (renderFriends(body)) return; body.appendChild(el('div', 'dexhead', '🏘️ 現在在村子裡的人')); }
    if (room && room.isLobby){ body.appendChild(el('p', 'sub', `你在公共大廳 ${room.lobbyNo}：打開遊戲的人都會自動分到有位子的大廳（每個大廳最多 ${LOBBY_MAX} 人，會先找有好友的大廳）。可以換到別的大廳、自己開一個新的，或開私人房間只跟朋友玩。村民、魚市、村報這些資料每個大廳都一樣。`)); body.appendChild(lobbyBox()); body.appendChild(pjBox()); }
    else if (room && !pjMode) body.appendChild(el('p', 'sub', '現在在村子裡的人。分享這個頁面的連結給朋友，就能一起釣魚、聊天。'));
    else if (pjAvailable()) body.appendChild(pjBox());
    else body.appendChild(el('p', 'sub', '目前是單人模式。在 claude.ai 上開啟並分享這個頁面，朋友加入後就會出現在這裡。'));
    if (room && room.connected()){
      const tb = el('div', 'tankbar'); const b = el('button', 'tbtn', Tag.st === 'idle' ? '👻 發起鬼抓人' : Tag.st === 'lobby' ? '👻 鬼抓人報名中' : '👻 鬼抓人進行中');
      b.disabled = Tag.st !== 'idle'; b.addEventListener('click', () => { closeSheet(); tagOpen(); }); tb.appendChild(b);
      tb.appendChild(el('small', 'sub', '2 人以上就能玩：被鬼碰到就換你當鬼，3 分鐘後還是鬼的人輸。')); body.appendChild(tb);
    }
    const ul = el('ul', 'people');
    const add = (name, color, st, isMe, uid, peerId) => { const li = el('li'); const sw = el('span', 'sw'); sw.style.background = color; li.append(sw, el('span', '', name + (isMe ? '（你）' : '')), el('span', 'st', st));
      if (uid && Cloud.on && !isMe && !isFriend(uid)){ const af = el('button', 'tbtn vbtn', '加好友'); af.addEventListener('click', () => { af.disabled = true; addFriend(uid, name); }); li.appendChild(af); }
      if (uid && Cloud.on && !isMe){ const v = el('button', 'tbtn ghost vbtn', '參觀水族館'); v.addEventListener('click', () => visitAquarium(uid, name)); li.appendChild(v); const vi = el('button', 'tbtn ghost vbtn', '參觀小島'); vi.addEventListener('click', () => visitIsle(uid, name)); li.appendChild(vi); }
      if (peerId && Cloud.on){ const rp = el('button', 'tbtn ghost vbtn', '檢舉'); rp.addEventListener('click', () => {
          const box = el('div', 'rpbox'); box.appendChild(el('span', '', '檢舉原因：'));
          for (const r of ['罵人／不禮貌', '洗版', '取不雅的名字', '其他']){ const b = el('button', 'tbtn ghost vbtn', r); b.addEventListener('click', () => { reportPeer(peerId, name, r); box.remove(); }); box.appendChild(b); }
          li.after(box); rp.disabled = true; }); li.appendChild(rp); }
      if (peerId){ const bk = el('button', 'tbtn ghost vbtn bk', '封鎖'); bk.addEventListener('click', () => { if (bk.dataset.sure !== '1'){ bk.dataset.sure = '1'; bk.textContent = '確定封鎖？'; bk.classList.add('warn'); return; } blockPeer(peerId, name); renderTab(); }); li.appendChild(bk); }
      ul.appendChild(li); };
    const stOf = (ph, x, z) => { if (ph){ const s = SPOTS.reduce((a, b) => Math.hypot(x-a.pos.x, z-a.pos.z) < Math.hypot(x-b.pos.x, z-b.pos.z) ? a : b); return `在${s.short}釣魚中`; } return '散步中'; };
    add(myDisplayName() === '你' ? '你' : myDisplayName(), look.shirt, stOf(me.fishing, me.pos.x, me.pos.z), true);
    for (const p of peers.values()) add(peerName(p) + (p.guest ? '・訪客' : ''), isHex(p.pres.sh) ? p.pres.sh : '#9fb3bf', stOf(!!p.pres.f, p.target.x, p.target.z), false, typeof p.pres.u === 'string' ? p.pres.u : null, [...peers.entries()].find(([k, v]) => v === p)[0]);
    /* NPC 不列在玩家清單裡（這裡只放真人） */
    body.appendChild(ul);
    const bl = Object.entries(blockList);
    if (bl.length){
      const h = el('div', 'dexhead', `已封鎖（${bl.length}）`); body.appendChild(h);
      const ub = el('ul', 'people');
      for (const [u, n] of bl){ const li = el('li'); li.append(el('span', '', n)); const b = el('button', 'tbtn ghost vbtn', '解除封鎖'); b.addEventListener('click', () => { unblock(u); renderTab(); }); li.appendChild(b); ub.appendChild(li); }
      body.appendChild(ub);
    }
    renderCloudVisits(body); renderVisits(body);
    body.appendChild(el('p', 'sub', '有人講話不禮貌，按「封鎖」後就看不到他的角色、聊天和動態（只對你自己有效）。'));
  } else if (curTab === 'map'){
    renderMap(body);
  } else if (curTab === 'style'){
    renderCloudBox(body);
    renderPushBox(body);
    const f1 = el('div', 'field'); f1.appendChild(el('label', '', '衣服顏色')); const s1 = el('div', 'swatches');
    SHIRTS.forEach(c => { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', '衣服 ' + c); b.setAttribute('aria-pressed', String(look.shirt === c)); b.addEventListener('click', () => { look.shirt = c; saveLook(); renderTab(); }); s1.appendChild(b); });
    f1.appendChild(s1); body.appendChild(f1);
    const f2 = el('div', 'field'); f2.appendChild(el('label', '', '帽子顏色')); const s2 = el('div', 'swatches');
    HATS.forEach(c => { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', '帽子 ' + c); b.setAttribute('aria-pressed', String(look.hat === c)); b.addEventListener('click', () => { look.hat = c; saveLook(); renderTab(); }); s2.appendChild(b); });
    f2.appendChild(s2); body.appendChild(f2);
    { const fw = el('div', 'field'); fw.appendChild(el('label', '', `👗 服裝（🪙 ${rec.coins.toLocaleString()}）`)); body.appendChild(fw); renderWardrobe(body); }
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
  } else if (curTab === 'ach'){
    renderAch(body);
  } else if (curTab === 'help'){
    body.appendChild(el('p', 'sub', '歡迎來到潮汐釣魚村！下面是全部的玩法，點標題可以打開或收起來。'));
    const k = el('div', 'kbd');
    [['移動', isTouch ? '左下搖桿（推到底會跑步）' : 'WASD / 方向鍵（Shift 跑步）'], ['轉視角', isTouch ? '在畫面上拖曳・兩指縮放' : '拖曳滑鼠・滾輪縮放'], ['跳', isTouch ? '「跳」按鈕' : '空白鍵或 J'],
     ['拋竿', '走到水邊，按住右下按鈕蓄力、放開拋出；拋越遠越容易遇到稀有魚'], ['提竿', '浮標猛沉、出現「!」時馬上按'], ['拉線', '按住收線、放開卸力，讓下面的張力條停在黃色、不要到紅色'],
     ['聊天', isTouch ? '💬 按鈕' : 'Enter'], ['互動', '走到商店、NPC、椅子、門口旁邊，右下按鈕會變成對應的動作']].forEach(([a, b]) => k.append(el('kbd', '', a), el('span', '', b)));
    body.appendChild(k);
    const sec = (title, lines, open) => { const d = el('details', 'help'); if (open) d.open = true; d.appendChild(el('summary', '', title)); const ul = el('ul'); for (const l of lines) ul.appendChild(el('li', '', l)); d.appendChild(ul); body.appendChild(d); };
    sec('🎣 釣魚', [
      '水邊哪裡都能釣：面前幾公尺內有水，按鈕就會變成「拋竿」。每一片水的魚都不一樣（河岸、鏡湖、瀑布潭、螢光溪、晴潮海邊、港口外海、小島碼頭）。',
      '地上的發光圈是「好釣點」：稀有魚和傳說魚比較多。',
      '有些魚只在白天、清晨黃昏或晚上比較常出現，圖鑑會標出來。',
      '天氣（左上角）：晴天、多雲、下雨、起霧、暴風雨，大約每 9 分鐘換一次，大家看到的都一樣。下雨魚比較好咬、雷魚鯰魚鰻魚特別多；起霧稀有魚多；暴風雨時海邊和外海的傳說魚多很多，但拉線比較吃力。',
      '潮汐（左上角）：大約 18 分鐘漲退一次。海邊、外海、小島在漲潮時最好釣，乾潮時比較難。',
      `季節跟著現實的月份（台灣）：3～5 月春天 🌸、6～8 月夏天 🌻、9～11 月秋天 🍁、12～2 月冬天 ❄️。每季有 6 種「當季魚」比平常多一倍（圖鑑會標「當季」），樹的顏色、飄落的花瓣落葉雪花、廣場旁邊的裝飾也會跟著換。現在是${SEASONS[SEASON].name}。`,
      '釣具店老闆每天會給「今日情報」：說哪個釣點的哪種魚今天特別多（機率 2.5 倍）。',
      '魚上鉤的快慢跟現實一樣有快有慢：大多幾秒鐘，偶爾一丟下去就咬，偶爾要等很久。清晨和黃昏「魚口」最好；海邊乾潮時咬得快、漲潮時慢一點但稀有魚多；下雨天也比較好釣。',
      '等魚的時候，可以看到魚從旁邊游過來試探、咬餌（大型魚除外）。釣過的魚看得到顏色，上鉤時也會直接說是什麼魚；沒釣過的只看得到黑影。',
      '魚上鉤後：上面是魚的體力和距離，下面是張力條。按住收線，張力太高（紅色）要放開，不然線會斷。',
      '魚往左衝時畫面會出現「往右拉 ➡」，把搖桿往反方向推，魚會累得更快。稀有魚會跳出水面，跳的時候要放開！',
      '大魚搏鬥：釣到大型魚或傳說魚時會出現「巨大魚影」和 Boss 血條，大魚會浮出水面、破水而出。血條快沒的時候出現「連打！」，狂按拉線把牠拉上來。',
      '傳說魚很少見：港口外海大約 3%，其他地方不到 1%。好的釣竿、魚餌、窩料和料理加成都能提高機率。',
      '在港口和鏡湖可以「上船」，划到水上任何地方釣魚。',
      '釣法（釣具店「釣法」分頁，免費隨時換）：浮標釣什麼都能釣；路亞不用魚餌、拋得遠，等魚時點按鈕「抽竿」讓假餌動，掠食魚特別多；沉底釣等比較久，但底棲魚（鯰魚、鰻魚、螃蟹、龍蝦、石斑…）特別多。釣線：細線咬口快但容易斷、粗線不容易斷但咬口少。',
    ], true);
    sec('🦐 室內釣蝦場', [
      '在村子廣場東邊的街上，招牌寫「🦐 釣蝦場」，走到門口按按鈕就能進去。也可以從「地圖」傳送到門口。',
      '釣蝦是算時間的：先到門口左邊的櫃台跟老闆阿忠買時段（30 分鐘 🪙200、60 分鐘 🪙350，可以累加）。蝦竿和雞肝餌都附，不用自己帶。右上角會顯示還剩多久。',
      '池邊有編號的塑膠板凳，坐下來就能拋竿；站在池邊也可以釣。蝦竿很短，只能拋到前面一點點。',
      '櫃台也有賣蝦竿：碳纖維蝦竿（🪙1200）、職人手工蝦竿（🪙4000）。好的蝦竿浮標比較敏感，吃餌時可以反應的時間比較長，拉的時候也比較不會鬆鉗（不會改變釣到哪一種蝦的機率）。',
      '釣蝦場不用打窩：老闆會定時放蝦進池子，窩料在這裡不能用。拉蝦的時候，畫面上的圖示會變成 🦐。',
      '老闆的放生活動：每天中午到晚上之間的某個時間，阿忠會放一隻藍色龍蝦進池子，持續 2 小時，全伺服器只有一隻。每拋一次竿只有大約 0.15% 的機會碰到，有人釣到活動就結束。釣到的人可以選擇放生：會得到 💙50 愛海點數，活動還沒結束的話牠會回到池子裡，其他人又有機會釣到。櫃台可以看到下一次大概什麼時候。',
      '釣蝦場：不會跳「!」提示，要自己看浮標。蝦子會先來試探，浮標只是輕輕點一下、抖一下，這時候拉會把蝦嚇跑；等浮標「整個沉下去、一直抖」再按提竿。太慢的話蝦子會把餌吃掉跑掉。',
      '拉蝦的時候要慢慢拉，一直按住太用力，蝦子會鬆鉗掉回池子裡。釣蝦場不會跟大魚搏鬥。',
      '釣蝦場的蝦是老闆放的，沒有尺寸限制，而且比外面的釣點更快上鉤。有泰國蝦、白蝦、草蝦、小龍蝦、藍鉗泰國蝦，還有傳說中的金鉤蝦王。三隻泰國蝦可以拿到池邊的烤爐免費烤，也可以在食堂做「鹽烤泰國蝦」。',
    ]);
    sec('🍚 打窩、祕密窩點、渡船', [
      '先到釣具店的「魚餌」分頁買窩料：酒米窩料（淡水好用）、南極蝦窩料（海水好用）、黃金特製窩（哪裡都有效，傳說魚也會被吸引）。',
      '在水邊按「🍚 打窩」：「現在打」馬上有效，大家都看得到，維持 2～3 分鐘；在窩點裡下竿，魚更快上鉤、稀有魚更多。',
      '「🤫 提前打」是祕密窩點：只有你自己知道（橘色浮標和地圖上的 🤫 只有你看得到）。窩料會慢慢發酵，10 分鐘後最強，可以維持 1 小時，最多 3 個。祕密窩點存在雲端，換手機登入也找得到。',
      '祕密窩點就是你自己走到或划船到一個地方，在那裡「🤫 提前打」。',
      '港口的船夫阿海可以用小船載你到祕密窩點、外海深處、燈塔外的礁岩、東邊外海，也可以「在地圖上選地點」：點任何一片水，他就載你過去，到了再自己打窩。按「回港口」就會載你回來。',
      '👥 組隊出海：在阿海的選單勾「組隊出海」再選目的地，大廳裡的人會收到邀請，按「一起去」就會一起到那裡（祕密窩點不會邀請別人）。在船上釣魚時，附近每多一個人也在船上，大家的魚都會快一點上鉤（每人 8%，最多 3 人）。',
    ]);
    sec('💙 尺寸限制、放流、愛海點數', [
      '每種魚都有「建議尺寸」：比最輕的再重四分之一以上才算夠大。太小的魚釣到時會標「📏 未達尺寸」，帶走只能賣半價。',
      '釣到魚時可以按「放流」讓牠回到大海，魚缸裡的魚也可以放流。放流會得到愛海點數：常見魚 1、稀有魚 3、傳說魚 10，未達尺寸的小魚至少 3。',
      '愛海點數在商店的「💙愛海」分頁換限定服飾（海龜帽、海洋守護衫、珊瑚項鍊、鯊魚背鰭），金幣買不到。',
    ]);
    sec('🤿 潛水（進階玩法）', [
      '先在商店的「🤿潛水」分頁買「潛水裝備組」，再到港口找船夫阿海按「去潛水」，就能潛到珊瑚礁。也可以走到珊瑚礁群島北邊沙灘的「🤿 浮潛」牌子，直接從岸邊下水。潛水時偶爾會看到很少見的變種魚。',
      '🏠 家：走進小島上的房子，按「🛋️ 擺家具」可以買家具、移動、收掉，按「🏠 格局」可以換成一房一廳、兩房一廳、三房一廳。到「小島」分頁的「🏠 我的家」可以邀請互相加好友的人搬進來一起住（含島主最多 6 人），住戶可以一起蓋島、一起擺家具、認領自己的床（房門上會掛名字），也可以選自己是室友、家人還是情侶，取一個稱呼（例如哥哥、媽媽）。',
      '♂♀ 公母和繁殖：每條魚都有公母（卡片、魚缸會顯示 ♂／♀）。春天和夏天是野外繁殖季，吳郭魚、鯽魚、羅漢魚、青鱂魚、彈塗魚、招潮蟹、小龍蝦這些會自己繁殖的魚比較多、小魚也比較多；月灣河岸的淺水底會有吳郭魚的窩，浮標落在窩旁邊，守窩的公魚會馬上衝來咬。有些母吳郭魚嘴裡含著小魚（🐣），放流會多 💙5。水族館裡展示同一種魚的一公一母，每天有機會生小魚（🍼，每天最多 3 條），會生的有金魚、錦鯉、鯉魚、鯽魚、吳郭魚、小丑魚、青鱂魚、泰國蝦、小龍蝦、海馬、泥鰍、羅漢魚。',
      '🎨 自己設計衣服：在「造型」分頁選「衣服」或「褲子」等，最下面按「＋ 自己設計」，就能在 16×16 的格子上畫圖案（上衣有正面和背面），存好就能穿。設計會放到「🛍️ 設計師市集」，自己定價，別人買了九成的錢給你。帽子、鞋子、披風、領巾也可以自己設計，件數沒有上限；不適當的圖案被檢舉三次會下架。',
      '🐟 孔雀魚配種：生態池和螢光溪釣得到孔雀魚。每一條的尾巴顏色和形狀都不一樣（顏色有灰、紅、藍、黃，形狀有圓尾、劍尾、扇尾），公魚很花、母魚比較淡。一公一母放在水族館展示會生小魚，小魚從爸爸媽媽各遺傳一半，偶爾會突變出黑色、紫色或新的尾巴，看你能配出幾種品系！',
      '🧬 變種也會繁殖（照真實的隱性遺傳）：同一種變種一公一母放在水族館展示，生出來的小魚是變種；變種配一般的，小魚看起來一般，但會「🧬 帶著變種的基因」；帶基因的再配變種，一半是變種；兩條帶同樣基因的配，四分之一是變種。',
      '🎣 釣竿有分種類：甩竿哪裡都能用；🎋 手竿（台灣溪釣、池釣，沒有捲線器，拋不遠）最適合河、湖、溪、瀑布潭；🏖️ 遠投竿（舉過頭甩，拋得最遠）最適合海邊；🪨 磯釣竿（大顆的阿波浮標）最適合港口外海、小島碼頭。用在對的地方稀有魚多一點、魚咬得快一點，用錯地方就差一點。買過的竿子都在「包包」裡，隨時可以換。',
      '🐟 箱網養殖：珊瑚礁島西邊有一排浮在海上的箱網，走浮動步道過去，在「你的箱網」旁邊按「箱網」。可以把魚缸裡的臭肚魚、白毛、虱目魚、吳郭魚、石斑、紅甘這些放進去（最多 6 條），每天餵一次飼料，魚就會慢慢長大；收成後放回魚缸，可以賣比較多錢。',
      '🪸 珊瑚礁群島：從村子往西邊走，過一座很長的跨海大橋就到了。島邊的礁岩用磯釣竿最好，有臭肚魚、白毛、黑毛、青嘴龍占，運氣好會遇到紅甘。島東邊有兩個用咾咕石疊成的愛心石滬：退潮的時候魚被困在裡面，咬得特別快；滿潮時魚都游出去了。',
      '🪷 百年生態池：在村子東邊、往東海灘的路旁邊。兩個圓圓的池子中間有紅色拱橋，池子裡有假山和睡蓮。有吳郭魚、琵琶鼠魚、食蚊魚（大肚魚），運氣好會遇到泰國鱧（魚虎）和很大的革胡子鯰。手竿最適合。',
      '🥅 撈網：站在比水面高很多的地方（例如高高的岸壁）釣到 1.5 公斤以上的魚，要用撈網撈上來，不然硬拔線會斷（在釣具店「🧰工具」分頁買，買了會自動用）。',
      '🧴 撿垃圾：生態池旁邊常常有寶特瓶、塑膠袋、鋁罐，走過去按「撿起來」，每撿一個愛海點數 +1（一天最多 20 個）。',
      '🌿 紅樹林：在本島南岸、南方沙灘再往南，從岸上走進去就到了（地圖下方深綠色那一片）。漲潮時魚會游進樹根之間，在紅樹林碼頭的發光圈或岸邊釣得到烏魚、虱目魚、金錢魚、黑鯛，運氣好還有尖吻鱸、鬥牛鯊、鋸鰩。退潮（乾潮）時島邊的泥灘會露出來，可以走下去：搖桿推一點點慢慢靠近彈塗魚或招潮蟹，再按「抓！」。跑太快會把牠們嚇跑，水漲回來要趕快回到島上。',
      '外海魚情：在外海的船上按「🤿 下潛看魚」，可以直接潛下去看這一帶現在有哪些魚。外海每 5 分鐘會有 3 種魚特別活躍（上鉤機率 ×2.5），浮上來之後跑馬燈會告訴你是哪幾種、還剩幾分鐘。',
      isTouch ? '水裡：搖桿游泳，⬆ 往上、⬇ 往下。一直往上浮到水面就會上岸，也可以按左上「⬆ 上岸」。' : '水裡：WASD 游泳，空白鍵或 E 往上、C 或 Q 往下，F 拍照或撿東西。一直往上浮到水面就會上岸。',
      '氧氣用完會自動浮上來。氧氣瓶可以升級：60 → 100 → 150 → 220 秒。競速蛙鞋游得更快，潛水燈讓晚上也看得清楚。',
      '靠近魚、讓牠在畫面中間時按「📷 拍照」，就會登錄進「水下圖鑑」（圖鑑分頁看得到數量）。傳說魚偶爾也會出現在水裡。',
      '有三個潛水點（在阿海的選單選）：🪸 珊瑚礁（有潛水裝備就能去）、⚓ 沉船深海（要大型氧氣瓶，大帆船旁邊寶箱多又值錢，大魚和傳說魚常出沒）、🕳️ 海底洞穴（要專業雙氧氣瓶＋潛水燈，有發光水晶、珍珠貝和深海怪魚）。',
      '海底有貝殼（每天最多 40 個）、寶箱（每天最多 6 個，越深越值錢）、洞穴裡的珍珠（每天最多 15 顆）。',
      '一起潛水的人在水裡看得到彼此。',
    ]);
    sec('🐠 魚缸、水族館、圖鑑', [
      `釣到的魚會放進魚缸（最多保留 ${KEEP_MAX} 條，滿了最舊的會被擠掉；展示中的不算）。`,
      `廣場東邊的大水族館只放你自己選的魚（最多 ${SHOW_MAX} 條）：釣到時按「🏛️ 展示」，或在「魚缸」分頁按「展示」。展示中的魚不會被賣掉或拿去做菜。`,
      '「包包」（上面的 🎒 按鈕）可以看身上帶的東西：金幣、愛海點數、釣竿、魚餌、窩料、料理、潛水用品、蝦竿，還可以直接換釣竿、換魚餌、吃料理。',
      '🦈 赤紅霸王鯊：外海深處住著一小群紅色的鯊魚，整個伺服器共用，一開始只有一公一母。沒被釣走的話，每一對（一公一母）每 7 天有一半機會生一隻小鯊（極少數是白化的）。主要在港口外海出沒，偶爾也會到珊瑚礁群島外側的深水邊巡游（機率更低）（最多 8 隻），隻數越多越容易遇到，但還是非常非常少見。就算上鉤，牠大部分都會掙脫，每掙脫一次身上就多一道叉叉，叉叉越多越難拉上來。釣到的紅鯊不能賣也不能送，放回海裡可以得到 💙100 愛海點數；全部被釣光就絕種了。',
      '✨ 變種：有些魚會有長得不一樣的稀有個體（例如不同花色的錦鯉、獅子頭金魚、白化鯰魚），機率非常低，要釣到才會出現在圖鑑裡。',
      '「圖鑑」記錄你釣過的每一種魚和最重紀錄。按 🐟 可以把魚捧起來炫耀給大家看。',
      '可以參觀別人的水族館（玩家分頁或排行榜點他的名字）。',
    ]);
    sec('🪙 金幣與商店', [
      '海邊商店：把魚缸裡的魚賣掉，越稀有、越重越值錢。',
      '釣具店：釣竿（越好越不容易斷線、收線越快、稀有傳說機率越高）、魚餌（每拋一次用掉一個）、窩料。',
      '服飾：兩間店都有「服飾」分頁（造型分頁也有）。帽子、衣服、褲子、鞋子、襪子、配件、背飾、表情共 54 件，可以先試穿看看，大家都看得到你的打扮。',
      '所有價格都由伺服器檢查，金幣不會亂跳。連上雲端時，上鉤的是什麼魚、多重，也是伺服器用一樣的機率抽的，沒辦法作弊刷排行榜。',
    ]);
    sec('🍳 潮汐食堂（料理）', [
      '在食堂用魚缸裡的魚做料理，共 13 道。不同料理玩法不一樣：壽司類切魚、章魚燒翻面、燒烤和油炸控制火候、火鍋和麵記住下料順序。做得越好星星越多、越值錢。',
      '料理可以賣掉，也可以「吃掉」：接下來幾次拋竿會有加成（例如稀有魚變多、線比較不容易斷）。',
      '食堂露台會有客人來點餐，端給他可以拿到 1.5 倍的錢（每天最多 60 位）。每天最多做 150 道。',
    ]);
    sec('📜 每日任務', [
      '村長阿土伯（廣場）、漁夫老王（港口）、食堂美雲姨（食堂旁）每天各有一個請求，頭上有 ❗ 的就是還沒完成。',
      '走到他們旁邊、或在選單的「任務」分頁交付魚或料理，就能拿到金幣。每天台灣時間半夜 12 點換新任務。',
    ]);
    sec('🏆 每週比賽與排行榜', [
      '每週一半夜 12 點（台灣時間）換一種比賽魚，比誰釣到最重的那一條。排行榜第一個分頁就是本週比賽。',
      '排行榜還有最重的魚、總共釣到幾條、賺最多錢，是全服的。',
      `⏱️ 定時釣魚大賽：每天台灣時間 ${TOURNEY.hours.map(h => h + ':00').join('、')} 開始，每場 ${TOURNEY.mins} 分鐘。比賽時間內釣到的魚總重量最重的前三名拿 🪙${TOURNEY.prize.join(' / ')}，有參加就有 🪙${TOURNEY.join}。開始前 15 分鐘右上角會倒數，點一下可以看即時排名。`,
    ]);
    sec('🏝️ 私人小島', [
      '選單的「小島」可以去自己的島。在「買東西擺島上」挑房子或家具，拿著半透明預覽走路調位置（綠色可以放、紅色不行），「⟲」轉方向、「✔」放下。',
      '按「🔨 建造」後走到東西旁邊，可以移動或拆掉（退一半金幣）。島上最多 60 件東西、房子 6 棟。',
      '走到房子門口可以「進屋」，屋裡的魚缸會游著你展示的魚。長椅、野餐桌、鞦韆、屋裡的椅子都可以坐。',
      '海上看得到其他人的島。在小島分頁「逛別人的島」可以去參觀，幫喜歡的島按 ❤️（每天每座島一次）。',
    ]);
    sec('👥 跟大家一起玩', [
      `打開遊戲會自動進入公共大廳（每個大廳最多 ${LOBBY_MAX} 人），看得到其他人釣魚、聊天、穿什麼。想只跟朋友玩，可以在「玩家」分頁開私人房間。`,
      '跑馬燈會報出大家釣到的稀有魚和傳說魚，還有做出來的料理。',
      '鬼抓人：在「玩家」分頁發起，2 個人以上就能玩。被鬼碰到就換你當鬼，3 分鐘後還是鬼的人輸。',
      '好友：在「玩家」分頁按「加好友」，或輸入朋友的 8 碼好友代碼。互相加好友以後可以送金幣（每天最多 1000）或魚缸裡的魚（每天 10 條），對方在玩家分頁打開禮物就會收到。也可以從好友名單去參觀他的水族館和小島。',
      '遇到不友善的人可以在「玩家」分頁封鎖或檢舉。聊天會自動過濾不雅字。',
      '「玩家」分頁有「誰來逛過你的小島、水族館」：就算你不在線上也會記在雲端（保留 14 天），可以按「回訪小島」去他的島。別人的名字被房子、樹擋住或離太遠時會變淡。',
      '「玩家」分頁最下面有「最近來過村子的人」：誰進過你在的大廳、什麼時候離開、來過幾次（記在這台裝置，保留 7 天），也可以直接加好友或參觀他的小島。',
    ]);
    sec('⭐ 等級、稱號、成就', [
      '經驗值從你的紀錄算出來：釣到常見魚 +10、稀有魚 +40、傳說魚 +250，放流 +5，水下照片每種 +30。左上角的 ⭐ Lv 點一下就能看進度。',
      '每升一級都有金幣獎勵（Lv × 50），由伺服器自動發。',
      `成就有 ${ACH.length} 個（釣魚數量、圖鑑、傳說魚、巨物、賺錢、放流、潛水、小島、服飾、好友、每個釣點全收集）。有些成就和等級會給稱號，在「成就」分頁選一個，名字上面就會顯示，大家都看得到。`,
    ]);
    sec('☁️ 存檔、時間、其他', [
      '紀錄自動存在雲端。到「造型」分頁綁定 Email，換手機或換瀏覽器時就能接回同一份紀錄。',
      '遊戲裡的一天是現實 36 分鐘，大家看到的時間都一樣；晚上路燈、窗戶和燈塔會亮。',
      '背景音樂會跟著地方和狀況換：白天的海島、夜晚的海邊、釣蝦場、海底、拉魚時變緊張、跟大魚搏鬥時更激烈。右上角 ♫ 可以關掉音樂，喇叭可以關掉音效。',
      '右上角相機按鈕是拍照模式；畫質可以在「造型」分頁調整，舊手機選「低」會比較順。',
      '遊戲更新時畫面上方會出現「有新版本」，按「更新」就好，不會在你拉魚時突然重開。',
    ]);
    body.appendChild(el('p', 'sub', '© 2026 潮汐釣魚村作者，保留所有權利；未經同意禁止複製、修改或轉載。部分魚的 3D 模型：Animated Fish Pack by Quaternius（CC0 授權，quaternius.com）。'));
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
  setTimeout(() => { if (portraitMQ.matches) rotHelp(); }, 700);
}
// Threads、IG、FB、LINE 裡面開的網頁（App 內建瀏覽器）不能全螢幕也不能自動轉向：直接說明怎麼辦
const inApp = /Barcelona|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Messenger|TikTok|musical_ly/i.test(navigator.userAgent), inAppName = /Barcelona/i.test(navigator.userAgent) ? 'Threads' : /Instagram/i.test(navigator.userAgent) ? 'Instagram' : /FBAN|FBAV|FB_IAB|Messenger/i.test(navigator.userAgent) ? 'Facebook' : /Line\//i.test(navigator.userAgent) ? 'LINE' : 'App';
function rotHelp(){
  const r = $('#rotate'); if (!r || r.querySelector('.rothelp')) return;
  const box = document.createElement('div'); box.className = 'rothelp';
  box.innerHTML = inApp ? `<b>你是在 ${inAppName} 裡面打開的，這裡不能自動轉向</b><span>① 點右上角「⋯」→「在瀏覽器中開啟」（用 Chrome 玩最順）<br>② 或是直接把手機轉成橫向（要先關掉手機的「螢幕旋轉鎖定」）</span>`
    : `<b>這個瀏覽器不能自動轉向</b><span>請直接把手機轉成橫向。轉不過去的話，從手機上方往下滑，關掉「螢幕旋轉鎖定／自動旋轉」。</span>`;
  const cp = document.createElement('button'); cp.textContent = '複製遊戲網址'; cp.addEventListener('click', async e => { e.stopPropagation(); const u = location.href.split('#')[0]; try { await navigator.clipboard.writeText(u); cp.textContent = '已複製，貼到 Chrome 開'; } catch(_){ prompt('複製這個網址，貼到 Chrome 打開：', u); } });
  if (inApp) box.appendChild(cp); r.appendChild(box);
}
if (inApp && isTouch) setTimeout(() => { const r = $('#rotate'); if (r){ const h = r.querySelector('h2'), pp = r.querySelector('p'); if (h) h.textContent = '請把手機轉成橫向來玩'; if (pp) pp.textContent = '潮汐釣魚村是橫向遊戲，左手搖桿、右手拋竿最順手。'; } if (portraitMQ.matches) rotHelp(); }, 300);
$('#rotFull').addEventListener('click', goLandscape);
$('#rotate').addEventListener('click', e => { if (e.target.id !== 'rotSkip') goLandscape(); });
$('#rotSkip').addEventListener('click', () => document.body.classList.add('allowPortrait'));
$('#fsBtn').addEventListener('click', () => { if (document.fullscreenElement){ document.exitFullscreen().catch(() => {}); } else goLandscape(); });

// hint
if (isTouch) $('#hintTxt').textContent = '左下搖桿移動・拖曳畫面轉視角・走到水邊按住右下按鈕拋竿（發光圈是好釣點）・不會玩看選單的「玩法」';
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
  // 太陽（晚上換成月亮）的方向：白天從東邊升起、西邊落下（世界的東邊是 -z）
  const dayK = clamp((h - 5.5) / 14.5, 0, 1), night = h < 5.5 || h >= 20;
  let ang; if (!night) ang = dayK * Math.PI; else { const nh = h >= 20 ? h - 20 : h + 4; ang = clamp(nh / 9.5, 0, 1) * Math.PI; }
  _sunDir.set(-0.55, Math.max(0.18, Math.sin(ang)) * 0.75, -Math.cos(ang) * 0.8).normalize();
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
  if (rainbow) rainbow.visible = DayNight.period === 'day';
  if (aquaVane) aquaVane.rotation.y = Math.sin(t * 0.3) * 0.8 + Math.sin(t * 1.1) * 0.15;
  if (lhBeam){ lhBeam.visible = lamp > 0.3; lhBeam.material.opacity = lamp * 0.09; lhBeam.rotation.y = t * 0.7; }
  // 陰影跟著太陽／月亮的方向
  sun.position.set(me.pos.x + _sunDir.x * 40, _sunDir.y * 40, me.pos.z + _sunDir.z * 40); sun.target.position.set(me.pos.x, 0, me.pos.z);
  // 左上角的時間
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10, txt = `${DayNight.period === 'twilight' && h < 12 ? '🌅 清晨' : PERIOD_LABEL[DayNight.period]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const ck = $('#clock'); if (ck && ck._t !== txt){ ck.textContent = txt; ck._t = txt; }
  if (DayNight.period !== DayNight._last){ if (DayNight._last) ticker(DayNight.period === 'night' ? '天黑了，<b>晚上</b>出沒的魚開始活動 🌙' : DayNight.period === 'twilight' ? (h < 12 ? '天快亮了，清晨的魚正活躍 🌅' : '黃昏了，有些魚只在這時候出現 🌇') : '天亮了 ☀️'); DayNight._last = DayNight.period; }
}

/* ================= 海洋生態與魚類 AI（2026-11-05）=================
   水裡的魚不再只是背景：每一條魚有自己的狀態（閒逛、覓食、被嚇跑、好奇靠近、被魚餌吸引、追獵物、咬餌），用「轉向力」慢慢轉彎、加速、減速。
   小魚成群（boids：分開、對齊、靠攏，跟著帶頭的那一條），大魚單獨游；掠食魚會追比自己小很多的魚。
   兩個地方都有：
   1. 岸上看得到的水裡（本島、各個區域的海邊、河湖）：玩家附近的水裡會有魚游來游去，照釣點、時間、天氣、季節、海洋生態（洄游）決定是哪些魚；
      拋竿以後，伺服器抽好的那條魚會真的游過來咬餌（跟原本的釣魚系統接在一起），浮標、窩料會把附近的魚吸過來。
   2. 潛水：原本繞圈圈的魚群和單獨的魚都換成這套 AI，會避開海底、礁丘，可以撒魚餌，被追的魚會躲到岩石旁邊。
   效能：魚的模型用物件池重複使用；離鏡頭遠的魚降低更新頻率、太遠就不畫；手機畫質越低，魚越少。 */
const FAI = { agents:[], pool:new Map(), spawnAt:0, hooked:null, schools:[], obsAt:0, events:[], bait:null, baitCd:0 };
const FAI_MAX = { low:5, mid:8, high:12 }, FAI_SCHOOL = { low:9, mid:12, high:16 };
const FAI_SIL = new THREE.MeshBasicMaterial({ color:'#0d2233', transparent:true, opacity:0.45, depthWrite:false });   /* 還沒釣過的魚：只看到黑黑的影子 */
const FAI_CURIOUS = new Set(['butterfly', 'sergeant', 'idol', 'bluetang', 'turtle', 'clown', 'parrot', 'rabbitfish', 'razorsurgeon', 'creolefish', 'goldfish', 'koi', 'carp', 'tilapia', 'dolphin', 'moonwrasse', 'girella']);
const FAI_STATE = { wander:'慢慢游著', flee:'被嚇跑了！', curious:'好奇地靠過來看你', bait:'被魚餌吸引過來了', hooked:'在咬你的餌…', chase:'正在追獵物！', forage:'在找東西吃', hide:'躲在岩石旁邊', circle:'在你附近繞圈圈', school:'成群游過去', eat:'吃得飽飽的' };
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
function faiTraits(f){ if (f._fai) return f._fai; const id = f.of || f.id, size = (f.min + f.max) / 2;
  const pred = LURE_FISH.has(id) || /shark|barracuda|grouper|tuna|marlin|trevally|amberjack|mahi|ito|sixgill|orca|snakehead|bass|arowana|lionfish/.test(id);
  const bottom = BOTTOM_FISH.has(id) || /flounder|stingray|crab|lobster|octopus|goby|rattail|batfish|blobfish|catfish|loach|pleco|turbot|mudskipper|fiddler|shrimp|prawn|crayfish/.test(id);
  return (f._fai = { size, pred, bottom, curious: FAI_CURIOUS.has(id), circle: /shark/.test(id), maxV: clamp(0.8 + Math.log10(1 + size) * 1.1, 0.6, 2.8), scale: clamp(0.3 + Math.log10(1 + size) * 0.62, 0.28, 2.6) }); }
// ---- 物件池：同一種魚的模型用完放回去，下次直接拿來用 ----
function faiTake(f, scale){ const sil = !rec.count[f.id], k = f.id + '|' + scale.toFixed(2) + (sil ? 's' : ''), P = FAI.pool.get(k); let m = P && P.pop(); if (!m){ m = fishModel(f, scale); m.userData.poolKey = k; m.traverse(o => { if (o.isMesh){ o.castShadow = false; o.frustumCulled = true; o.renderOrder = -1; if (sil) o.material = FAI_SIL; } }); } m.visible = true; return m; }
function faiGive(m){ if (!m) return; if (m.parent) m.parent.remove(m); const k = m.userData.poolKey; if (!k) return; if (!FAI.pool.has(k)) FAI.pool.set(k, []); const P = FAI.pool.get(k); if (P.length < 4) P.push(m); }
// ---- 岸上看得到的水：這裡多深、可不可以游 ----
function faiDepth(x, z){ if (!waterAt(x, z)) return 0; if (Math.hypot(x - FROST.x, z - FROST.z) < FROST.r + 2) return 0; if (inShrimpHall(x, z, 3)) return 0; return clamp(WATER_LEVEL - terrainH(x, z), 0, 8); }
function faiSurfaceY(a, depth){ const d = Math.max(0.3, depth); return a.tr.bottom ? WATER_LEVEL - Math.min(0.75, d - 0.12) : WATER_LEVEL - clamp(d * 0.3, 0.2, 0.5); }   /* 不要太深，不然水面擋住就看不到了 */
// 這個釣點現在比較可能出現哪些魚（時間、天氣、季節、海洋生態都算進去）
function faiPick(spotId, depth){
  const sp = SPOT_BY_ID[spotId]; if (!sp || !sp.fish) return null; const per = periodOf(gameHour()), eco = {}; for (const e of (Ocean.d && Ocean.d.eco) || []) if (e.spot === spotId) eco[e.fish] = +e.mult;
  const rainy = WEATHERS[Env.wx] && WEATHERS[Env.wx].rain > 0, list = [], w = [];
  for (const id of sp.fish){ const f = FISH_BY_ID[id]; if (!f || f.rs || f.of) continue; if (BIG_FISH.has(id) || (f.min + f.max) / 2 > 40) continue;   /* 鯨魚、大鯊魚這種大傢伙不會游到岸邊 */   /* 變種不會在岸邊游給你看（釣到才知道） */
    let k = f.rarity === '常見' ? 1 : f.rarity === '稀有' ? 0.18 : 0;
    if (f.time && f.time !== per) k *= 0.12;   /* 白天的魚晚上很少出來，晚上的魚白天躲著 */
    if (rainy && RAIN_FISH.has(id)) k *= 2; if (SEASON_FISH.has(id)) k *= 1.6; if (eco[id] != null) k *= eco[id]; if (k > 0){ list.push(f); w.push(k); } }
  if (!list.length) return null; let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++){ r -= w[i]; if (r <= 0) return list[i]; } return list[0]; }
// ---- 一條魚 ----
function faiAgent(f, x, z, opt){ const tr = faiTraits(f), sc = opt && opt.scale || tr.scale, m = faiTake(f, sc); scene.add(m);
  const a = { f, tr, m, pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4), tgt: new THREE.Vector3(x, 0, z), home: new THREE.Vector3(x, 0, z), state:'wander', st:0, cd:0, lod:0, acc:0, id: Math.random(), depth: opt && opt.depth || faiDepth(x, z) };
  a.pos.y = faiSurfaceY(a, a.depth); faiNewWander(a); FAI.agents.push(a); return a; }
function faiFree(a){ faiGive(a.m); a.dead = true; }
function faiNewWander(a){ for (let k = 0; k < 6; k++){ const ang = Math.random() * 6.283, r = 2 + Math.random() * 6, x = a.home.x + Math.cos(ang) * r, z = a.home.z + Math.sin(ang) * r; if (faiDepth(x, z) > 0.35){ a.tgt.set(x, 0, z); return; } } a.tgt.copy(a.home); }
function faiSet(a, s, secs){ a.state = s; a.st = secs || 0; }
// 轉向：慢慢轉過去、慢慢加速減速；碰到岸邊就轉開
function faiSteer(a, dt, speed, tx, tz){
  const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz) || 1, arrive = Math.min(1, d / 1.2);
  const dvx = dx / d * speed * arrive - a.vel.x, dvz = dz / d * speed * arrive - a.vel.z, acc = a.tr.maxV * 2.2;
  const dl = Math.hypot(dvx, dvz) || 1, k = Math.min(1, acc * dt / dl); a.vel.x += dvx * k; a.vel.z += dvz * k;
  const nx = a.pos.x + a.vel.x * dt, nz = a.pos.z + a.vel.z * dt, dep = faiDepth(nx + a.vel.x * 0.4, nz + a.vel.z * 0.4);
  if (dep < 0.35){ a.vel.multiplyScalar(-0.4); if (a.state === 'wander' || a.state === 'flee') faiNewWander(a); return d; }
  a.pos.x = nx; a.pos.z = nz; a.depth += (dep - a.depth) * Math.min(1, dt * 2); return d; }
function faiPlace(a, dt, t){ const ty = a.state === 'forage' ? WATER_LEVEL - Math.min(0.7, Math.max(0.3, a.depth) - 0.1) : faiSurfaceY(a, a.depth); a.pos.y += (ty - a.pos.y) * Math.min(1, dt * 1.5);
  const sp = Math.hypot(a.vel.x, a.vel.z); a.m.position.copy(a.pos); if (sp > 0.02) a.m.rotation.y = lerpAngle(a.m.rotation.y, Math.atan2(-a.vel.z, a.vel.x), Math.min(1, dt * 6));
  a.m.rotation.z = a.state === 'forage' ? -0.35 : Math.sin(t * 2 + a.id * 9) * 0.05; }
// ---- 岸上看得到的水裡：每一幀 ----
function updateFishAI(dt0, t){
  if (Dive.on || House.on){ if (FAI.agents.length){ for (const a of FAI.agents) faiFree(a); FAI.agents = []; } faiSchoolsClear(); return; }
  const max = FAI_MAX[Quality.tier] || 10, px = me.pos.x, pz = me.pos.z;
  // 生出新的魚（玩家附近、看得到的水裡），離太遠的收回物件池
  if (t > FAI.spawnAt){ FAI.spawnAt = t + 0.8;
    for (const a of FAI.agents) if (Math.hypot(a.pos.x - px, a.pos.z - pz) > 32 || faiDepth(a.pos.x, a.pos.z) <= 0) faiFree(a);   /* 太遠、跑到岸上（不應該發生）就收回 */
    FAI.agents = FAI.agents.filter(a => !a.dead);
    if (FAI.agents.length < max) for (let k = 0; k < 4; k++){ const ang = Math.random() * 6.283, r = 7 + Math.random() * 16, x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r, dep = faiDepth(x, z);
      if (dep < 0.6) continue; const f = faiPick(waterSpotId(x, z), dep); if (f){ faiAgent(f, x, z, { depth: dep }); break; } }
    faiSchoolSpawn(px, pz); }
  // 拋竿以後：上鉤的那條魚由原本的 BiteFish 游過來咬（伺服器抽的魚）；附近的魚會被浮標吸引過去，咬到、拉魚、水花大的時候，旁邊的魚會嚇跑
  const bob = me.bobState === 'water' && F.phase === 'waiting' && !Dive.on ? me.bobPos : null, splash = (F.phase === 'bite' || F.phase === 'reeling') && me.bobPos ? me.bobPos : null;
  const pSpeed = me.speed || 0, jump = Jump.air > 0;
  for (const a of FAI.agents){ if (a.dead) continue;
    const dc = Math.hypot(a.pos.x - camera.position.x, a.pos.z - camera.position.z); let dt = dt0;
    a.m.visible = dc < 40; a.acc += dt; if (dc > 24 && (frameNo + Math.floor(a.id * 7)) % 4) continue; dt = Math.min(0.2, a.acc); a.acc = 0;   /* 遠的魚 4 幀才算一次 */
    const dP = Math.hypot(a.pos.x - px, a.pos.z - pz), V = a.tr.maxV; a.st -= dt; a.cd -= dt;
    // 感知玩家：跑過來、跳、太靠近會被嚇跑；好奇的魚在玩家站著不動時會靠過來
    if (splash && a.state !== 'flee' && Math.hypot(a.pos.x - splash.x, a.pos.z - splash.z) < 3.5){ faiSet(a, 'flee', 2); a.tgt.set(a.pos.x + (a.pos.x - splash.x) * 3, 0, a.pos.z + (a.pos.z - splash.z) * 3); }
    if (a.state !== 'flee'){ const scare = a.tr.curious ? 1.4 : 3.2;
      if (dP < scare && (pSpeed > 1.2 || jump || dP < 1.1)){ faiSet(a, 'flee', 1.6 + Math.random()); a.tgt.set(a.pos.x + (a.pos.x - px) / (dP || 1) * 7, 0, a.pos.z + (a.pos.z - pz) / (dP || 1) * 7); }
      else if (a.tr.curious && a.state === 'wander' && dP < 7 && pSpeed < 0.2 && a.cd <= 0 && Math.random() < dt * 0.3){ faiSet(a, 'curious', 4 + Math.random() * 4); a.cd = 12; } }
    // 浮標、窩料會吸引附近的魚
    if (a.state === 'wander' && a.cd <= 0){ if (bob && Math.hypot(a.pos.x - bob.x, a.pos.z - bob.z) < 8 && Math.random() < dt * 0.5){ faiSet(a, 'bait', 5 + Math.random() * 5); a.cd = 10; }
      else for (const zn of chumZones) if (zn.until > now() && Math.hypot(a.pos.x - zn.x, a.pos.z - zn.z) < 12){ faiSet(a, 'bait', 8); a.baitZ = zn; a.cd = 4; break; } }
    // 掠食魚：偶爾追比自己小很多的魚
    if (a.tr.pred && a.state === 'wander' && a.cd <= 0 && Math.random() < dt * 0.15){ const prey = FAI.agents.find(b => b !== a && !b.dead && b.tr.size < a.tr.size * 0.3 && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < 9); if (prey){ faiSet(a, 'chase', 5); a.prey = prey; a.cd = 25; } }
    if (!a.tr.bottom && a.state === 'wander' && a.cd <= 0 && Math.random() < dt * 0.05){ faiSet(a, 'forage', 3 + Math.random() * 3); a.cd = 15; }
    if (a.tr.bottom && a.state === 'wander' && Math.random() < dt * 0.1) faiSet(a, 'forage', 2 + Math.random() * 3);
    // 狀態
    switch (a.state){
      case 'wander': if (faiSteer(a, dt, V * 0.45, a.tgt.x, a.tgt.z) < 0.6) faiNewWander(a); break;
      case 'forage': faiSteer(a, dt, V * 0.12, a.pos.x + Math.cos(t + a.id) * 0.5, a.pos.z + Math.sin(t + a.id) * 0.5); if (a.st <= 0) faiSet(a, 'wander'); break;
      case 'flee': faiSteer(a, dt, V * 1.9, a.tgt.x, a.tgt.z); if (a.st <= 0){ faiSet(a, 'wander'); a.home.copy(a.pos); faiNewWander(a); } break;
      case 'curious': { const ang = Math.atan2(a.pos.z - pz, a.pos.x - px); faiSteer(a, dt, V * 0.4, px + Math.cos(ang) * 2.2, pz + Math.sin(ang) * 2.2); if (a.st <= 0) faiSet(a, 'wander'); break; }
      case 'bait': { const c = a.baitZ && a.baitZ.until > now() ? a.baitZ : bob; if (!c){ faiSet(a, 'wander'); break; } const ang = t * 0.9 + a.id * 6; faiSteer(a, dt, V * 0.55, c.x + Math.cos(ang) * 1.1, c.z + Math.sin(ang) * 1.1); if (a.st <= 0){ a.baitZ = null; faiSet(a, 'wander'); } break; }
      case 'chase': { const p = a.prey; if (!p || p.dead || a.st <= 0){ faiSet(a, 'wander'); break; } if (p.state !== 'flee'){ faiSet(p, 'flee', 3); p.tgt.set(p.pos.x + (p.pos.x - a.pos.x) * 3, 0, p.pos.z + (p.pos.z - a.pos.z) * 3); }
        if (faiSteer(a, dt, V * 1.6, p.pos.x, p.pos.z) < 0.35 + a.tr.scale * 0.2){ faiFree(p); faiSet(a, 'eat', 6); faiEvent(a, `${a.f.name}吃掉了一條${p.f.name}`); ripple(p.pos.x, p.pos.z); } break; }
      case 'eat': faiSteer(a, dt, V * 0.2, a.tgt.x, a.tgt.z); if (a.st <= 0) faiSet(a, 'wander'); break;
    }
    faiPlace(a, dt, t);
  }
  FAI.agents = FAI.agents.filter(a => !a.dead);
  faiSchoolsUpdate(dt0, t, false);
  faiObserve(t);
}
// ---- 小魚群（instanced）：boids ----
function faiSchoolsClear(){ for (const s of FAI.schools){ for (const im of s.ims){ if (im.parent) im.parent.remove(im); } } FAI.schools = []; }
function faiSchoolSpawn(px, pz){ FAI.schools = FAI.schools.filter(s => { const far = Math.hypot(s.lead.x - px, s.lead.z - pz) > 40; if (far) for (const im of s.ims) if (im.parent) im.parent.remove(im); return !far; });
  if (FAI.schools.length >= (Quality.tier === 'low' ? 1 : 2)) return;
  for (let k = 0; k < 3; k++){ const ang = Math.random() * 6.283, r = 10 + Math.random() * 14, x = px + Math.cos(ang) * r, z = pz + Math.sin(ang) * r, dep = faiDepth(x, z); if (dep < 1.0) continue;
    const sid = waterSpotId(x, z), sp = SPOT_BY_ID[sid]; if (!sp) continue; const pool = sp.fish.map(id => FISH_BY_ID[id]).filter(f => f && !f.of && f.rarity === '常見' && FISH_STYLE[f.id] && f.max < 3 && !BIG_FISH.has(f.id)); if (!pool.length) continue;
    const f = pool[Math.floor(Math.random() * pool.length)], n = FAI_SCHOOL[Quality.tier] || 14; FAI.schools.push(faiMakeSchool(f, n, x, z, scene, { surface: true, scale: 0.42 })); return; } }
function faiMakeSchool(f, n, x, z, parent, o){ const st = FISH_STYLE[f.id], ims = [];
  for (const part of Object.keys(FISH_MESH[st.shape])){ const im = new THREE.InstancedMesh(fishGeo(st.shape, part), fishMat(f.id, part, st.c[part] || f.color, st.glow, st.move, st.shape), n); im.frustumCulled = false; parent.add(im); ims.push(im); }
  const P = [], V = []; for (let i = 0; i < n; i++){ P.push(new THREE.Vector3(x + (Math.random() - 0.5) * 2, WATER_LEVEL - 0.3, z + (Math.random() - 0.5) * 2)); V.push(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)); }
  return { f, n, ims, P, V, alive: new Array(n).fill(true), respawn: new Array(n).fill(0), lead: new THREE.Vector3(x, P[0].y, z), lv: new THREE.Vector3(0.6, 0, 0), tgt: new THREE.Vector3(x, P[0].y, z), zk: /^Fish/.test(st.shape) ? 1.5 : 1, surface: !!o.surface, scale: o.scale || 0.55, state:'school', st:0, pos: new THREE.Vector3(x, P[0].y, z) }; }
// dive：海底高度、礁丘、天花板（水面）；岸上：水深
function faiOk(s, x, y, z){ if (s.surface){ const d = faiDepth(x, z); return d > 0.7; } const R = DIVE.r * 0.95; return Math.hypot(x - DIVE.x, z - DIVE.z) < R; }
function faiYRange(s, x, z){ if (s.surface){ const d = faiDepth(x, z); return [WATER_LEVEL - Math.min(0.5, d * 0.4), WATER_LEVEL - 0.18]; } const bed = Math.max(diveBed(x, z), rockLift(x, z, 0.4)) + 0.6; return [bed, DIVE.y + DIVE.top - 0.8]; }
function faiSchoolsUpdate(dt, t, dive){
  const L = dive ? Dive.schools.filter(s => s.P) : FAI.schools, threats = [];
  threats.push({ x: me.pos.x, y: dive ? me.baseY + 0.8 : WATER_LEVEL, z: me.pos.z, r: dive ? 3 : 2.6, k: 1 });
  const preds = dive ? Dive.fish.filter(o => o.ai && o.ai.state === 'chase') : FAI.agents.filter(a => a.tr.pred);
  for (const p of preds){ const sc = (p.ai ? p.ai.tr : p.tr).scale; threats.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, r: 2.2 + sc * 0.4, k: 1.2, p, eat: 0.55 + Math.min(1.4, sc * 0.35) }); }
  for (const s of L){
    const dc = Math.hypot(s.lead.x - camera.position.x, s.lead.z - camera.position.z); if (dc > 45){ for (const im of s.ims) im.visible = false; continue; } for (const im of s.ims) im.visible = true;
    if (dc > 25 && (frameNo % 3)) continue; const sdt = dc > 25 ? dt * 3 : dt;
    // 帶頭的：慢慢在海域裡移動；被嚇到就整群一起轉開；被魚餌吸引就過去
    s.st -= sdt; let speed = 0.9, bait = dive ? Dive.bait : null;
    if (bait && bait.until > t && Math.hypot(bait.x - s.lead.x, bait.z - s.lead.z) < 14){ s.tgt.set(bait.x, bait.y, bait.z); s.state = 'bait'; speed = 1.1; }
    else if (s.state === 'bait') s.state = 'school';
    for (const th of threats){ const d = Math.hypot(s.lead.x - th.x, s.lead.z - th.z); if (d < th.r * 1.5){ s.tgt.set(s.lead.x + (s.lead.x - th.x) / (d || 1) * 8, s.lead.y, s.lead.z + (s.lead.z - th.z) / (d || 1) * 8); speed = 2.2; s.state = 'flee'; s.st = 1.5; } }
    if (s.state !== 'bait' && (s.st <= 0 || Math.hypot(s.tgt.x - s.lead.x, s.tgt.z - s.lead.z) < 1.2)){ s.state = 'school'; s.st = 6 + Math.random() * 6;
      const cur = Ocean.d && Ocean.d.state && Ocean.d.state.coast, drift = cur ? (+cur.dir) * Math.PI / 180 : 0;   /* 魚群順著海流慢慢移動 */
      for (let k = 0; k < 6; k++){ const ang = drift + (Math.random() - 0.5) * 2.4, r = 3 + Math.random() * 7, x = s.lead.x + Math.sin(ang) * r, z = s.lead.z + Math.cos(ang) * r; if (faiOk(s, x, 0, z)){ const [y0, y1] = faiYRange(s, x, z); s.tgt.set(x, y0 + (y1 - y0) * (0.3 + Math.random() * 0.5), z); break; } } }
    _v1.subVectors(s.tgt, s.lead); const dl = _v1.length() || 1; _v1.multiplyScalar(speed / dl).sub(s.lv).clampLength(0, 2.5 * sdt); s.lv.add(_v1);
    const nx = s.lead.x + s.lv.x * sdt, nz = s.lead.z + s.lv.z * sdt; if (faiOk(s, nx, 0, nz)){ s.lead.x = nx; s.lead.z = nz; } else { s.lv.multiplyScalar(-0.5); s.st = 0; }
    { const [y0, y1] = faiYRange(s, s.lead.x, s.lead.z); s.lead.y = clamp(s.lead.y + s.lv.y * sdt, y0, y1); }
    // 每一條：靠攏帶頭的、跟大家分開、方向對齊；自己被嚇到就散開；被吃掉的過一陣子從帶頭的旁邊補回來
    let cx = 0, cy = 0, cz = 0, cnt = 0;
    for (let i = 0; i < s.n; i++){ if (!s.alive[i]){ if (t > s.respawn[i] && Math.hypot(s.lead.x - me.pos.x, s.lead.z - me.pos.z) > 10){ s.alive[i] = true; s.P[i].copy(s.lead); } else { tankDummy.scale.set(0, 0, 0); tankDummy.updateMatrix(); for (const im of s.ims) im.setMatrixAt(i, tankDummy.matrix); continue; } }
      const p = s.P[i], v = s.V[i]; _v1.subVectors(s.lead, p).multiplyScalar(0.9);
      for (let j = Math.max(0, i - 4); j < Math.min(s.n, i + 5); j++){ if (j === i || !s.alive[j]) continue; _v2.subVectors(p, s.P[j]); const d = _v2.length(); if (d < 0.45 && d > 0.001) _v1.addScaledVector(_v2, (0.45 - d) / d * 4); }
      _v1.addScaledVector(s.lv, 0.6);
      for (const th of threats){ _v2.set(p.x - th.x, (p.y - th.y) * 0.5, p.z - th.z); const d = _v2.length(); if (d < th.r){ _v1.addScaledVector(_v2, (th.r - d) / (d || 1) * 6 * th.k);
        if (th.p && th.eat && d < th.eat && th.p.ai){ s.alive[i] = false; s.respawn[i] = t + 20; th.p.ai.state = 'eat'; th.p.ai.st = 5; faiEvent(th.p, `${th.p.f.name}吃掉了一條${s.f.name}`); } } }
      v.addScaledVector(_v1, sdt * 2.2); const sp = v.length(), mx = s.state === 'flee' ? 3.2 : 1.6; if (sp > mx) v.multiplyScalar(mx / sp); if (sp < 0.35) v.multiplyScalar(0.35 / (sp || 1));
      const nxp = p.x + v.x * sdt, nzp = p.z + v.z * sdt; if (faiOk(s, nxp, 0, nzp)){ p.x = nxp; p.z = nzp; } else { v.x *= -0.6; v.z *= -0.6; }
      const [y0, y1] = faiYRange(s, p.x, p.z); p.y = clamp(p.y + v.y * sdt, y0, y1);
      _e.set(0, Math.atan2(-v.z, v.x), clamp(v.y * 0.4, -0.5, 0.5)); tankDummy.position.copy(p); tankDummy.rotation.copy(_e); const ss = s.scale; tankDummy.scale.set(ss, ss, ss * s.zk); tankDummy.updateMatrix(); for (const im of s.ims) im.setMatrixAt(i, tankDummy.matrix);
      cx += p.x; cy += p.y; cz += p.z; cnt++; }
    for (const im of s.ims) im.instanceMatrix.needsUpdate = true;
    if (cnt) s.pos.set(cx / cnt, cy / cnt, cz / cnt); }
}
// ---- 觀察：面前幾公尺內的魚，告訴你牠在做什麼 ----
function faiEvent(a, text){ if (Math.hypot(a.pos.x - me.pos.x, a.pos.z - me.pos.z) < 14) FAI.events.push({ text, at: now() }); }
function faiObserve(t){
  if (t < FAI.obsAt) return; FAI.obsAt = t + 0.3; let el2 = $('#obsTip'); if (!el2){ el2 = document.createElement('div'); el2.id = 'obsTip'; document.body.appendChild(el2); }
  const ev = FAI.events.shift(); if (ev && now() - ev.at < 3){ el2.textContent = '👀 ' + ev.text; el2.hidden = false; el2.dataset.until = now() + 2.5; return; }
  if (+el2.dataset.until > now()) return;
  const fx = Math.sin(me.rot), fz = Math.cos(me.rot), list = Dive.on ? Dive.fish.filter(o => o.ai).map(o => ({ f: o.f, pos: o.pos, state: o.ai.state })) : FAI.agents;
  let best = null, bd = Dive.on ? 7 : 5.5; for (const a of list){ const dx = a.pos.x - me.pos.x, dz = a.pos.z - me.pos.z, d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.3){ bd = d; best = a; } }
  if (!best || F.phase === 'reeling' || !$('#sheet').hidden){ el2.hidden = true; return; }
  el2.textContent = `🔍 ${rec.count[best.f.id] ? best.f.name : '沒看過的魚'}・${FAI_STATE[best.state] || ''}`; el2.hidden = false; }
// ---- 潛水的魚：換成 AI ----
function faiCurrent(){ const c = Ocean.d && Ocean.d.state && Ocean.d.state.coast, sp = c ? clamp(+c.spd || 0.3, 0.1, 1) : 0.3, a = c ? (+c.dir || 0) * Math.PI / 180 : 0.6; return { sp, lx: Math.cos(a) * sp * 0.12, lz: Math.sin(a) * sp * 0.12 }; }   /* 海流：海帶、海草往海流的方向倒一點 */
function faiDiveInit(){ Dive.bait = null; Dive.baitFx = null;
  for (const s of Dive.schools){ if (s.ball) continue; const n = s.n; s.P = []; s.V = []; s.alive = new Array(n).fill(true); s.respawn = new Array(n).fill(0); const y = diveBed(s.cx, s.cz) + s.y;
    for (let i = 0; i < n; i++){ s.P.push(new THREE.Vector3(s.cx + s.off[i][0] * 1.6, y + s.off[i][1] * 0.7, s.cz + s.off[i][2] * 1.6)); s.V.push(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)); }
    s.lead = new THREE.Vector3(s.cx, y, s.cz); s.lv = new THREE.Vector3(); s.tgt = s.lead.clone(); s.state = 'school'; s.st = 0; s.scale = 0.55; s.surface = false; }
  for (const o of Dive.fish){ const tr = faiTraits(o.f); o.ai = { state:'wander', st:0, cd: Math.random() * 5, vel: new THREE.Vector3(), tgt: new THREE.Vector3(o.cx, diveBed(o.cx, o.cz) + o.y, o.cz), tr, id: Math.random(), prey:null };
    o.pos.set(o.cx + Math.cos(o.ph) * o.rad, diveBed(o.cx, o.cz) + o.y, o.cz + Math.sin(o.ph) * o.rad); faiDiveWander(o); }
  Dive.aiOn = true; }
function faiDiveWander(o){ const A = o.ai; for (let k = 0; k < 6; k++){ const ang = Math.random() * 6.283, r = 3 + Math.random() * 8, x = o.cx + Math.cos(ang) * r, z = o.cz + Math.sin(ang) * r; if (Math.hypot(x - DIVE.x, z - DIVE.z) > DIVE.r * 0.9) continue;
    const bed = Math.max(diveBed(x, z), rockLift(x, z, 0.3)); A.tgt.set(x, o.bottom ? bed + 0.3 : clamp(bed + 1 + Math.random() * 6, bed + 0.6, DIVE.y + DIVE.top - 1), z); return; } }
function faiDiveUpdate(dt, t){
  for (const s of Dive.schools){ if (!s.ball) continue; const a = t * s.sp + s.ph, cx = s.cx + Math.cos(a) * s.rad, cz = s.cz + Math.sin(a) * s.rad, cy = Math.max(diveBed(cx, cz) + s.y, rockLift(cx, cz, 2.2)); s.pos.set(cx, cy, cz);
    for (let i = 0; i < s.n; i++){ const q = s.off[i], rr = 0.8 + Math.abs(q[0]) * 1.5, an = t * (0.7 + Math.abs(q[2]) * 0.4) + q[3]; tankDummy.position.set(cx + Math.cos(an) * rr, cy + q[1] * 1.3, cz + Math.sin(an) * rr); tankDummy.rotation.set(0, -an, 0); tankDummy.scale.set(0.45, 0.45, 0.45); tankDummy.updateMatrix(); for (const im of s.ims) im.setMatrixAt(i, tankDummy.matrix); } for (const im of s.ims) im.instanceMatrix.needsUpdate = true;
    if (Math.hypot(me.pos.x - cx, me.pos.z - cz) < 3) s.ph += dt * 0.4; }   /* 餌球：一大團一起轉，靠太近會轉開 */
  faiSchoolsUpdate(dt, t, true);
  const py = me.baseY + 0.8, bait = Dive.bait && Dive.bait.until > t ? Dive.bait : null, pSpeed = me.speed || 0;
  for (const o of Dive.fish){ const A = o.ai; if (!A) continue; const tr = A.tr, V = tr.maxV * 0.8; A.st -= dt; A.cd -= dt;
    const dP = Math.hypot(o.pos.x - me.pos.x, o.pos.y - py, o.pos.z - me.pos.z);
    if (A.state !== 'flee' && A.state !== 'hide' && A.state !== 'chase'){
      if (!tr.circle && dP < (tr.curious ? 1.6 : 3.5) && (pSpeed > 1.5 || dP < 1.2)){ const rock = (Dive.rocks || []).find(r => Math.hypot(r[0] - o.pos.x, r[1] - o.pos.z) < 8);
        if (rock && !tr.pred){ A.state = 'hide'; A.st = 4 + Math.random() * 3; const ang = Math.atan2(rock[1] - me.pos.z, rock[0] - me.pos.x); A.tgt.set(rock[0] + Math.cos(ang) * (rock[2] + 0.6), Math.max(diveBed(rock[0], rock[1]) + 0.5, Math.min(rock[3] - 0.3, o.pos.y)), rock[1] + Math.sin(ang) * (rock[2] + 0.6)); }
        else { A.state = 'flee'; A.st = 2; A.tgt.set(o.pos.x + (o.pos.x - me.pos.x) * 3, o.pos.y + 1, o.pos.z + (o.pos.z - me.pos.z) * 3); } }
      else if (tr.circle && dP < 9 && A.state !== 'circle' && A.cd <= 0){ A.state = 'circle'; A.st = 8; A.cd = 20; }
      else if (tr.curious && dP < 8 && pSpeed < 0.3 && A.state === 'wander' && A.cd <= 0 && Math.random() < dt * 0.4){ A.state = 'curious'; A.st = 5; A.cd = 12; }
      else if (bait && A.state !== 'bait' && Math.hypot(bait.x - o.pos.x, bait.z - o.pos.z) < 14 && Math.random() < dt * 1.5){ A.state = 'bait'; A.st = bait.until - t; }
      else if (tr.pred && A.state === 'wander' && A.cd <= 0 && Math.random() < dt * 0.12){ const S = Dive.schools.filter(s => s.P && Math.hypot(s.lead.x - o.pos.x, s.lead.z - o.pos.z) < 15); if (S.length){ A.state = 'chase'; A.st = 6; A.cd = 30; A.prey = S[0]; } }
      else if (A.state === 'wander' && A.cd <= 0 && Math.random() < dt * 0.08){ A.state = 'forage'; A.st = 3 + Math.random() * 3; A.cd = 10; } }
    let speed = V * 0.45, tx = A.tgt.x, ty = A.tgt.y, tz = A.tgt.z;
    switch (A.state){
      case 'wander': if (Math.hypot(tx - o.pos.x, tz - o.pos.z) < 0.8) faiDiveWander(o); break;
      case 'forage': { const bed = Math.max(diveBed(o.pos.x, o.pos.z), rockLift(o.pos.x, o.pos.z, 0.2)); tx = o.pos.x + Math.cos(t * 0.5 + A.id * 7) * 0.4; tz = o.pos.z + Math.sin(t * 0.5 + A.id * 7) * 0.4; ty = bed + 0.25; speed = V * 0.15; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break; }
      case 'flee': speed = V * 2; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break;
      case 'hide': speed = V * 1.2; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break;
      case 'curious': { const ang = Math.atan2(o.pos.z - me.pos.z, o.pos.x - me.pos.x); tx = me.pos.x + Math.cos(ang) * 1.8; tz = me.pos.z + Math.sin(ang) * 1.8; ty = py; speed = V * 0.4; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break; }
      case 'circle': { const ang = t * 0.35 + A.id * 6; tx = me.pos.x + Math.cos(ang) * 5; tz = me.pos.z + Math.sin(ang) * 5; ty = py + 0.5; speed = V * 0.5; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break; }
      case 'bait': { if (!bait){ A.state = 'wander'; faiDiveWander(o); break; } const ang = t * 0.8 + A.id * 6; tx = bait.x + Math.cos(ang) * 0.9; tz = bait.z + Math.sin(ang) * 0.9; ty = bait.y; speed = V * 0.7; break; }
      case 'chase': { const s = A.prey; if (!s || A.st <= 0){ A.state = 'wander'; faiDiveWander(o); break; } tx = s.pos.x; ty = s.pos.y; tz = s.pos.z; speed = V * 1.7; break; }
      case 'eat': speed = V * 0.15; if (A.st <= 0){ A.state = 'wander'; faiDiveWander(o); } break;
    }
    // 轉向＋避開海底、礁丘、水面、邊界
    _v1.set(tx - o.pos.x, ty - o.pos.y, tz - o.pos.z); const d = _v1.length() || 1; _v1.multiplyScalar(speed * Math.min(1, d / 1.0) / d).sub(A.vel).clampLength(0, V * 2.4 * dt); A.vel.add(_v1);
    o.pos.addScaledVector(A.vel, dt);
    { const bed = Math.max(diveBed(o.pos.x, o.pos.z), rockLift(o.pos.x, o.pos.z, o.bottom ? 0.1 : 0.5)) + (o.bottom ? 0.15 : 0.35), top = DIVE.y + DIVE.top - 0.7; if (o.pos.y < bed){ o.pos.y = bed; A.vel.y = Math.abs(A.vel.y) * 0.3; } if (o.pos.y > top){ o.pos.y = top; A.vel.y = -Math.abs(A.vel.y) * 0.3; }
      const R = Math.hypot(o.pos.x - DIVE.x, o.pos.z - DIVE.z); if (R > DIVE.r * 0.95){ o.pos.x = DIVE.x + (o.pos.x - DIVE.x) * DIVE.r * 0.95 / R; o.pos.z = DIVE.z + (o.pos.z - DIVE.z) * DIVE.r * 0.95 / R; A.vel.multiplyScalar(-0.5); faiDiveWander(o); } }
    o.m.position.copy(o.pos); const hs = Math.hypot(A.vel.x, A.vel.z); if (hs > 0.03) o.m.rotation.y = lerpAngle(o.m.rotation.y, Math.atan2(-A.vel.z, A.vel.x), Math.min(1, dt * 5));
    o.m.rotation.z = A.state === 'forage' ? -0.4 : clamp(Math.atan2(A.vel.y, hs + 0.01) * 0.6, -0.5, 0.5);
    if (o.m.userData.tail) o.m.userData.tail.rotation.y = Math.sin(t * (6 + hs * 4) + o.ph) * 0.35; }
  // 撒魚餌：一小團飼料慢慢往下沉
  if (Dive.baitFx){ const b = Dive.bait; Dive.baitFx.visible = !!(b && b.until > t); if (Dive.baitFx.visible){ b.y = Math.max(diveBed(b.x, b.z) + 0.3, b.y - dt * 0.15); Dive.baitFx.position.set(b.x, b.y, b.z); Dive.baitFx.rotation.y += dt * 0.5; } }
  faiObserve(t);
}
function faiDiveBait(){ const t = now(); if (FAI.baitCd > now()){ toast(`魚餌還要 ${Math.ceil(FAI.baitCd - now())} 秒才能再撒`); return; } FAI.baitCd = now() + 12;
  const x = me.pos.x + Math.sin(me.rot) * 1.6, z = me.pos.z + Math.cos(me.rot) * 1.6; Dive.bait = { x, y: me.baseY + 1, z, until: t + 18 };
  if (!Dive.baitFx){ const g = new THREE.Group(); const m = mat('#e8c88a', 0.8); for (let i = 0; i < 18; i++){ const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), m); b.position.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6); g.add(b); } Dive.group.add(g); Dive.baitFx = g; }
  flash('🍞 撒了一把魚餌，附近的魚會游過來', 1.4); SFX.plop(); }


addSeasonDeco(); try { buildShrimpHall(); buildShrimpFront(); } catch(e){ console.warn('venues', e); }
try { buildMangrove(); buildBeach(); buildNests(); buildCanal(); } catch(e){ console.warn('mangrove', e); }
try { buildReef(); } catch(e){ console.warn('mangrove', e); }
camera.position.set(4, 5, 18);
function frame(){
  const t = now(); const dt = Math.min(0.05, t - last); last = t; frameNo++;
  updatePlayer(dt); updateFishing(dt, t); try { updateBiteFish(dt, t); } catch(e){} me.update(dt, t); updateCamera(dt); me.placeTag();
  updatePeers(dt, t); updateNpcs(dt, t); updateCustomers(dt, t); updateQuestNpcs(dt, t); updateChum(dt, t); updateSecrets(t); updateFerry(); updateIsle(t); updateIsleHelpers(dt, t); updateFrost(dt, t); updateFar(dt, t); try { updateFishAI(dt, t); } catch(e){ if (!FAI.err){ FAI.err = String(e && e.stack || e).slice(0, 300); console.warn('fishAI', e); } } updateMangrove(dt, t); updateCanal(dt, t); updateReef(dt, t); updateNests(t); checkIsle(); tagTick(); updateJumpers(dt, t); updateTank(t); updateDive(dt, t); updateVenues(dt, t);
  // water
  if (frameNo % TIERS[Quality.tier].waterEvery === 0) for (const w of animWater){ const pos = w.m.geometry.attributes.position; const a = pos.array; const ox = w.m.position.x, oz = w.m.position.z; for (let i = 0; i < a.length; i += 3) a[i+1] = waterY(a[i] + ox, a[i+2] + oz, t) - 0.01; pos.needsUpdate = true; if (frameNo % 2 === 0) w.m.geometry.computeVertexNormals(); }
  for (const s of schools){
    // 魚群不會一直待在同一個地方：偶爾游上來一陣子，然後潛下去（以後潛水可以看到牠們）
    if (s.next == null){ s.on = false; s.next = t + rand(30, 120); s.home = s.home || s.g.position.clone(); s.k = s.on ? 1 : 0; }
    if (t > s.next){ s.on = !s.on; s.next = t + (s.on ? rand(8, 14) : rand(100, 220));   /* 偶爾出來一下就好（使用者覺得一直游很煩） */ if (s.on){ const a = Math.random() * 6.28, r = Math.random() * 2.5, nx = s.home.x + Math.cos(a) * r, nz = s.home.z + Math.sin(a) * r; if (waterAt(nx, nz)){ s.g.position.x = nx; s.g.position.z = nz; } } }
    s.k += ((s.on ? 1 : 0) - s.k) * Math.min(1, dt * 0.8); s.g.position.y = s.home.y - (1 - s.k) * 1.2;
    s.g.visible = s.k > 0.03 && Math.hypot(me.pos.x - s.g.position.x, me.pos.z - s.g.position.z) < 40; if (!s.g.visible) continue; s.g.rotation.y += dt * 0.28; s.g.children.forEach((f, i) => { if (f.userData.tail) f.userData.tail.rotation.y = Math.sin(t*7 + i)*0.5; }); }
  updateDayNight(t); updateEnv(dt, t);
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
  if (Dive.on) diveHideWorld(); else cullAvatars();
  renderer.render(scene, camera);
  if (debugEl && frameNo % 15 === 0) updateDebug();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
logMsg('', '歡迎來到潮汐釣魚村！走進任一個發光圈就可以拋竿。', true);
initSocial().catch(() => {});
cloudInit();
initUpdateCheck();
})();
