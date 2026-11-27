// 新主島：把從上面看的地圖存成圖（MAPOUT=檔名）
const lib=require('./lib.js');const fs=require('fs');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(10);
 const u=await ev("(()=>{const M=W2.mapImg();const c=document.createElement('canvas');c.width=M.cv.width*2;c.height=M.cv.height*2;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(M.cv,0,0,c.width,c.height);g.font='bold 14px sans-serif';g.fillStyle='#c00';const T=W2.train;if(T)for(const q of T.stops){const x=(q.x-M.x0)*4,y=(q.z-M.z0)*4;g.fillRect(x-4,y-4,8,8);g.fillText(q.name,x+6,y);}g.fillStyle='rgba(0,0,0,.35)';for(let px=0;px<=1920;px+=100){const x=px*0.2*4;g.fillRect(x,0,1,c.height);g.fillText(px,x+2,12);}for(let py=0;py<=1080;py+=100){const y=py*0.2*4;g.fillRect(0,y,c.width,1);g.fillText(py,2,y+12);}return c.toDataURL('image/png');})()");
 fs.writeFileSync(process.env.MAPOUT||'map.png',Buffer.from(u.split(',')[1],'base64'));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
