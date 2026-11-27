// 新主島：站到某個位置拍一張（挑位置、檢查擺得對不對用）
// HASH='&nobb&map2' SHOTS='名字:規劃圖x,規劃圖y,鏡頭方向,俯角,距離;…' node w2shot.js      PRE='程式碼'：拍之前先跑；Q=high；CLEAN=1 拿掉介面；HOUR=10
const fs=require('fs');const path=require('path');const lib=require('./lib.js');
const OUT=path.resolve(__dirname,'..')+'/w2/shot/';fs.mkdirSync(OUT,{recursive:true});
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:+(process.env.VW||960),height:+(process.env.VH||540)},dsf:+(process.env.DSF||1),ls:{'tide.quality':JSON.stringify(process.env.Q||'high'),'tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.hintTrain':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2');await b.close();process.exit(1);}
 await go(20);
 await p.evaluate(([clean,hour])=>{const T=__T;T.DayNight.fixed=hour;__T.ev('Env').tideTest=0;const st=document.createElement('style');st.textContent='#guideCard,#today3{display:none!important}'+(clean?'#w2nav{display:none!important}':'');document.head.appendChild(st);if(clean)document.body.classList.add('clean');},[!!process.env.CLEAN,+(process.env.HOUR||10)]);
 if(process.env.PRE){console.log('pre',JSON.stringify(await ev(process.env.PRE)));}
 for(const sh of (process.env.SHOTS==null?'spawn:975,560,3.14,0.35,7':process.env.SHOTS).split(';').filter(Boolean)){const [nm,cs]=sh.split(':'),[px,py,yaw,pitch,dist,wait]=cs.split(',').map(Number);
  await p.evaluate(([px,py,yaw,pitch,dist])=>{const E=__T.ev,W=E('W2'),me=E('me'),cam=E('cam'),x=W.ox+(px-965)*0.2,z=W.oz+(py-505)*0.2;W.warm(x,z);me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=yaw+Math.PI;cam.yaw=yaw;cam.pitch=pitch;cam.dist=dist;for(const e of document.querySelectorAll('#toasts > *'))e.remove();},[px,py,yaw,pitch,dist]);
  await go(wait||45);await p.waitForTimeout(300);await go(6);
  const info=await p.evaluate(()=>{const E=__T.ev;const a=document.getElementById('act');return {btn:a?a.innerText.replace(/\s+/g,' '):'',y:+E('me').pos.y.toFixed(2)}});
  await snap(OUT+nm+'.jpg',90);console.log('shot',nm,JSON.stringify(info));}
 // 自由鏡頭：名字:人站的x,y,人面朝,鏡頭x,y,高度,看哪裡x,y,高度（x,y 是規劃圖的像素）
 for(const sh of (process.env.FREE||'').split(';').filter(Boolean)){const [nm,cs]=sh.split(':'),[px,py,rot,cx,cy,ch,tx,ty,th,wait]=cs.split(',').map(Number);
  await p.evaluate(([px,py,rot,cx,cy,ch,tx,ty,th])=>{const E=__T.ev,W=E('W2'),me=E('me'),L=(a,b)=>[W.ox+(a-965)*0.2,W.oz+(b-505)*0.2],[x,z]=L(px,py),[c0,c1]=L(cx,cy),[t0,t1]=L(tx,ty);W.warm(x,z);W.warm(c0,c1);me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=rot;E('cam').yaw=rot+Math.PI;
   window.__landCam=()=>{const cam=E('camera');cam.position.set(c0,ch,c1);cam.lookAt(t0,th,t1);cam.updateMatrixWorld(true);};for(const e of document.querySelectorAll('#toasts > *'))e.remove();},[px,py,rot,cx,cy,ch,tx,ty,th]);
  await go(wait||45);await p.waitForTimeout(300);await go(6);await snap(OUT+nm+'.jpg',90);await p.evaluate(()=>{window.__landCam=null});console.log('free',nm);}
 if(process.env.POST){console.log('post',JSON.stringify(await ev(process.env.POST)));}
 console.log('errs',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
