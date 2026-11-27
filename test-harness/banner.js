// 活動大圖：用遊戲自己的人物和場景拍（臉朝鏡頭、人在畫面右邊、左邊留給字），輸出 1200x600
const lib=require('./lib.js');const path=require('path');const OUT=path.resolve(__dirname,'..')+'/w2/banner/';require('fs').mkdirSync(OUT,{recursive:true});
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
// 名字: 規劃圖x,y, 人面朝(弧度), 時間, 動作, 鏡頭距離, 鏡頭高
const S=(process.env.SCENES||'').split(';').filter(Boolean).map(s=>{const [n,r]=s.split(':');const a=r.split(',');return {n,px:+a[0],py:+a[1],rot:+a[2],hour:+a[3],emo:a[4],dist:+(a[5]||3.4),ch:+(a[6]||1.2),sh:+(a[7]||1.5),f:+(a[8]||32)};});
(async()=>{const r=await lib({vp:{width:1200,height:600},dsf:1,ls:{'tide.quality':'"high"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.hintTrain':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(20);
 await p.evaluate(()=>{const st=document.createElement('style');st.textContent='#guideCard,#today3,#w2nav,.ntag,.tag,#labels{display:none!important}';document.head.appendChild(st);document.body.classList.add('clean');__T.ev('Env').tideTest=0;for(const e of document.body.children){if(e.tagName!=='CANVAS'&&!e.querySelector('canvas'))e.style.visibility='hidden';}});
 for(const s of S){
  await p.evaluate((s)=>{const E=__T.ev,T=__T;T.DayNight.fixed=s.hour;const W=E('W2'),me=E('me'),x=W.ox+(s.px-965)*0.2,z=W.oz+(s.py-505)*0.2;W.warm(x,z);me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=s.rot;E('cam').yaw=s.rot;
   for(const e of document.querySelectorAll('#toasts > *'))e.remove();
   window.__landCam=()=>{const cam=E('camera'),fx=Math.sin(s.rot),fz=Math.cos(s.rot),hy=me.baseY+s.ch,dx=-fx,dz=-fz,rx=-dz,rz=dx;cam.position.set(x+fx*s.dist+rx*0.3,hy+0.15,z+fz*s.dist+rz*0.3);cam.lookAt(x-rx*s.sh,hy+0.35,z-rz*s.sh);cam.updateMatrixWorld(true);};},s);
  await go(50);await p.waitForTimeout(200);await ev(`(()=>{me.aspd=0;startEmote(me,'${s.emo}');})()`);await go(+(s.f||32));await snap(OUT+s.n+'.jpg',90);console.log('shot',s.n);}
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
