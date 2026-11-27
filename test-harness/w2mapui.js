// 新主島：打開地圖拍一張、點一個圖示看會不會帶路
const lib=require('./lib.js');const OUT=require('path').resolve(__dirname,'..')+'/w2/shot/';
(async()=>{const r=await lib({vp:{width:+(process.env.VW||960),height:+(process.env.VH||540)},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(30);
 console.log('pre',await ev("JSON.stringify({on:W2S.on,me:[me.pos.x|0,me.pos.z|0]})"));
 await ev("openSheet('map')"); await go(10); await p.waitForTimeout(600); await go(4);
 await snap(OUT+'map_a.jpg',85);
 console.log('tip',await ev("(()=>{const cv=document.querySelector('.mapcv');const r=cv.getBoundingClientRect();return JSON.stringify([r.width|0,r.height|0])})()"));
 // 點地圖上的魚市場附近：找 hits 沒辦法拿，直接點每一個 W2 門的位置
 const res=await p.evaluate(()=>{const E=__T.ev,W=E('W2'),d=(W.doors||[]).find(q=>q.k==='market');const cv=document.querySelector('.mapcv'),r=cv.getBoundingClientRect(),M=W.mapImg(),sc=r.width/M.w;const x=r.left+(d.x-M.x0)*sc,y=r.top+r.width/2+(d.z-M.z0-M.h/2)*sc;return [x,y,d.label];});
 await p.mouse.click(res[0],res[1]); await go(6);
 console.log('nav',await ev("JSON.stringify(Nav.t&&{l:Nav.t.label,x:Nav.t.x|0,z:Nav.t.z|0})"), res[2]);
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
