// 新主島：從上面看的示意圖（地是什麼、哪裡被擋住、門、車站、攤子、人站的位置），挑位置用
// HASH='&nobb&map2' REG='820,380,1260,900' OUT=town node w2map.js     REG 是規劃圖的像素範圍；SC 一公尺幾個點
const fs=require('fs');const path=require('path');const lib=require('./lib.js');
const OUT=path.resolve(__dirname,'..')+'/w2/map_'+(process.env.OUT||'a')+'.png';fs.mkdirSync(path.dirname(OUT),{recursive:true});
(async()=>{const r=await lib({vp:{width:640,height:360},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2');await b.close();process.exit(1);}
 await go(40);
 const SC=+(process.env.SC||4);
 for(const rg of (process.env.REGS||('a:'+(process.env.REG||'820,380,1260,900'))).split(';')){const [nm,cs]=rg.split(':'),[x0,y0,x1,y1]=cs.split(',').map(Number),OUT2=path.resolve(__dirname,'..')+'/w2/map_'+nm+'.png';
 const res=await p.evaluate(async([x0,y0,x1,y1,SC])=>{const E=__T.ev,W=E('W2'),blocked=E('blocked'),gh=E('groundHeight'),walkable=E('walkable'),waterAt=E('waterAt');
  const P=(x,y)=>[(x-965)*0.2,(y-505)*0.2],[ax,az]=P(x0,y0),[bx,bz]=P(x1,y1),w=Math.round((bx-ax)*SC),h=Math.round((bz-az)*SC);
  // 把這一塊的地都蓋出來（樹的碰撞要蓋了才有）
  for(let z=az;z<=bz;z+=40)for(let x=ax;x<=bx;x+=40)W.warm(W.ox+x,W.oz+z);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');const im=c.createImageData(w,h);
  const KC=[[40,90,150],[60,130,190],[226,214,189],[70,140,80],[240,225,170],[200,170,140],[150,200,120],[160,215,120]];
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const lx=ax+(i+0.5)/SC,lz=az+(j+0.5)/SC,X=W.ox+lx,Z=W.oz+lz;let k=W.kind(X,Z),col=KC[k]||[0,0,0];if(k<=1&&!waterAt(X,Z)&&walkable(X,Z))col=[185,138,90];
   if(blocked(X,Z,0.05))col=[70,60,60];const o=(j*w+i)*4;im.data[o]=col[0];im.data[o+1]=col[1];im.data[o+2]=col[2];im.data[o+3]=255;}
  c.putImageData(im,0,0);
  const T=(lx,lz)=>[(lx-ax)*SC,(lz-az)*SC];
  // 鐵軌
  c.strokeStyle='#111';c.lineWidth=2;c.beginPath();W.rail.forEach((q,i)=>{const [u,v]=T(q[0],q[1]);i?c.lineTo(u,v):c.moveTo(u,v)});c.closePath();c.stroke();
  // 規劃圖的格線（每 50 像素＝10 公尺）
  c.font='11px sans-serif';c.textBaseline='top';for(let gx=Math.ceil(x0/50)*50;gx<=x1;gx+=50){const [u]=T(P(gx,0)[0],0);c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=1;c.beginPath();c.moveTo(u,0);c.lineTo(u,h);c.stroke();c.fillStyle='#000';c.fillText(gx,u+2,2);}
  for(let gy=Math.ceil(y0/50)*50;gy<=y1;gy+=50){const [,v]=T(0,P(0,gy)[1]);c.strokeStyle='rgba(0,0,0,.25)';c.beginPath();c.moveTo(0,v);c.lineTo(w,v);c.stroke();c.fillStyle='#000';c.fillText(gy,2,v+2);}
  const dot=(X,Z,col,txt,face)=>{const [u,v]=T(X-W.ox,Z-W.oz);if(u<-20||v<-20||u>w+20||v>h+20)return;c.fillStyle=col;c.beginPath();c.arc(u,v,4,0,7);c.fill();c.strokeStyle='#fff';c.lineWidth=1;c.stroke();if(face!=null){c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(u,v);c.lineTo(u+Math.sin(face)*12,v+Math.cos(face)*12);c.stroke();}if(txt){c.font='bold 12px sans-serif';c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=3;c.strokeText(txt,u+6,v-6);c.fillText(txt,u+6,v-6);}};
  for(const d of W.doors)dot(d.x,d.z,'#e33',d.k,d.face);
  for(const s of W.train.stops)dot(s.x,s.z,'#000','站:'+s.name);
  const PO=W.posts||{};for(const q of PO._cots||[])dot(W.ox+q.x,W.oz+q.z,'#a3f','屋:'+q.k,q.face);for(const q of PO._stands||[])dot(W.ox+q.x,W.oz+q.z,'#f80','攤',q.ry);
  for(const k in PO){if(k[0]==='_')continue;const q=PO[k];dot(q.x,q.z,'#0cf',k,q.face);}
  if(W.bb)dot(W.bb.x,W.bb.z,'#ff0','看板');dot(W.spawn[0],W.spawn[1],'#fff','出生');
  return {url:cv.toDataURL('image/png'),w,h,cots:(PO._cots||[]).map(q=>[q.k,Math.round(q.x/0.2+965),Math.round(q.z/0.2+505),+q.face.toFixed(2)]),stands:(PO._stands||[]).map(q=>[Math.round(q.x/0.2+965),Math.round(q.z/0.2+505)]),doors:W.doors.map(d=>[d.k,Math.round((d.x-W.ox)/0.2+965),Math.round((d.z-W.oz)/0.2+505),+d.face.toFixed(2)])};
 },[x0,y0,x1,y1,SC]);
 fs.writeFileSync(OUT2,Buffer.from(res.url.split(',')[1],'base64'));console.log('saved',OUT2,res.w,res.h);if(process.env.LIST){console.log('cots',JSON.stringify(res.cots));console.log('stands',JSON.stringify(res.stands));console.log('doors',JSON.stringify(res.doors));}}
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
