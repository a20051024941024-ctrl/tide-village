// 新主島預覽：小火車的影片（等車進站 → 上車 → 開車 → 到站下車），30 fps，一格一格拍
// HASH='&nobb&map2' node w2trainvid.js    FROM=港口（哪一站上車）
const fs=require('fs');const path=require('path');const lib=require('./lib.js');const {execFileSync}=require('child_process');
const OUT=path.resolve(__dirname,'..')+'/w2/trainvid/';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});const FROM=process.env.FROM||'港口';const FPS=30;
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"high"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.hintTrain':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2');await b.close();process.exit(1);}
 await go(20);
 await p.evaluate(()=>{const T=__T;T.DayNight.fixed=10;__T.ev('Env').tideTest=0.4;for(const e of document.querySelectorAll('#toasts > *'))e.remove();const g=document.getElementById('guideCard');if(g)g.style.display='none';const st=document.createElement('style');st.textContent='#guideCard,#today3,#w2nav{display:none!important}';document.head.appendChild(st);});
 const i0=await p.evaluate(nm=>__T.ev('W2').train.stops.findIndex(s=>s.name===nm),FROM);
 // 站到月台上（靠軌道那一邊），鏡頭放低一點從月台後面看過去
 await p.evaluate(([i,SIDE])=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),cam=E('cam'),q=W.train.stops[i];W.warm(q.x,q.z);me.pos.x=q.x-q.nx*0.5+q.tx*0.6;me.pos.z=q.z-q.nz*0.5+q.tz*0.6;me.baseY=E('groundHeight')(me.pos.x,me.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=Math.atan2(-q.nx,-q.nz);cam.yaw=me.rot+Math.PI+SIDE;cam.pitch=0.3;cam.dist=6.6;for(let k=0;k<30;k++)__step(1,33);},[i0,+(process.env.SIDE||0.5)]);
 // 把時間調到「車再 4.5 秒進站」
 await p.evaluate(i=>{const E=__T.ev,T=E('W2').train;for(let k=0;k<3;k++)__step(1,33);const a=T.atStop(i)?T.arrive(i)+0:T.arrive(i);__setDate(Date.now()+(a-4.5)*1000);for(let k=0;k<8;k++)__step(1,33);},i0);
 let n=0;const frame=async()=>{const f=OUT+'f'+String(n++).padStart(5,'0')+'.jpg';let done=false;const pr=p.screenshot({path:f,type:'jpeg',quality:92,timeout:60000}).finally(()=>{done=true});pr.catch(()=>{});await p.evaluate(ms=>__step(1,ms),1000/FPS);while(!done){await p.waitForTimeout(25);if(!done)await p.evaluate(()=>__step(1,0.001)).catch(()=>{});}await pr;};
 const marks={};const T0=Date.now();
 // A：等車、車進站、上車、坐下
 for(let f=0;f<FPS*4.5+FPS*1.2;f++)await frame();marks.board=n;
 await p.evaluate(()=>{const T=__T;T.actionDown();__step(1,1);T.actionUp();});
 for(let f=0;f<FPS*0.8;f++)await frame();marks.cam2=n;
 await p.evaluate(()=>{const E=__T.ev,s=E('mySeat'),cam=E('cam'),st=E('W2').train.state(s.k),q=E('W2').train.stops[st.at];cam.yaw=Math.atan2(-q.nx,-q.nz)+0.55;cam.pitch=0.4;cam.dist=8.5;for(let k=0;k<3;k++)__step(1,1);});
 for(let f=0;f<FPS*1.8;f++)await frame();marks.cut=n;
 console.log('A frames',n,'sec',((Date.now()-T0)/1000).toFixed(0),JSON.stringify(await p.evaluate(()=>{const E=__T.ev,s=E('mySeat');return {seated:!!(s&&s.train),btn:document.getElementById('act').innerText.replace(/\s+/g,' ')}})));
 // 跳過停車的時間，剩 1.2 秒開車
 await p.evaluate(()=>{const E=__T.ev,s=E('mySeat'),st=E('W2').train.state(s.k);__setDate(Date.now()+Math.max(0,st.leave-1.2)*1000);for(let k=0;k<4;k++)__step(1,33);const cam=E('cam');cam.pitch=0.46;cam.dist=8.5;E('Ride').head=s.face;window.__side=Math.sign(Math.sin(cam.yaw-s.face))||1;cam.yaw=s.face+Math.PI-0.8*window.__side;});
 // B：開車 → 到下一站 → 下車走兩步
 let arrived=false,after=0;for(let f=0;f<FPS*40;f++){await frame();const st=await p.evaluate(()=>{const E=__T.ev,s=E('mySeat');if(!s)return {off:1};const T=E('W2').train,q=T.state(s.k),cam=E('cam');if(q.at>=0||q.eta<3.2){const sp=T.stops[q.at>=0?q.at:q.next],ty=Math.atan2(-sp.nx,-sp.nz)+0.5;let d=ty-cam.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));cam.yaw+=d*0.07;cam.pitch+=(0.4-cam.pitch)*0.07;}return {at:q.at,v:q.v}});if(st.off){after++;if(after>FPS*1.6)break;continue;}if(st.at>=0&&f>FPS*2){if(!arrived){arrived=true;marks.arr=n;}if(n-marks.arr>FPS*1.3){marks.off=n;await p.evaluate(()=>{const T=__T;T.actionDown();__step(1,1);T.actionUp();});}}}
 console.log('B frames',n,'sec',((Date.now()-T0)/1000).toFixed(0),JSON.stringify(marks),'errs',JSON.stringify(errs.slice(0,4)));
 fs.writeFileSync(OUT+'marks.json',JSON.stringify({marks,n,FPS}));
 await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
