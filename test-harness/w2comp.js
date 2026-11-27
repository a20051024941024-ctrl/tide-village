// 新主島：鋪面（路、廣場）分成幾塊互相走不到的；每塊不同顏色存成圖（COMPOUT）
const lib=require('./lib.js');const fs=require('fs');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(10);
 const res=await ev(`const process_NORAIL=${process.env.NORAIL?1:0};(()=>{const M=W2.mapImg(),W=M.w,H=M.h,G=new Int32Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++){const x=M.x0+i+0.5,z=M.z0+j+0.5;G[j*W+i]=(W2.kind(x,z)===2&&!W2.water(x,z)&&!(process_NORAIL&&W2.railNear(x,z,2.4)))?-1:0;}
  let n=0;const sz=[];for(let s=0;s<W*H;s++){if(G[s]!==-1)continue;n++;let c=0;const st=[s];G[s]=n;while(st.length){const q=st.pop();c++;const i=q%W,j=(q/W)|0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=W||b>=H)continue;const o=b*W+a;if(G[o]===-1){G[o]=n;st.push(o);}}}sz.push(c);}
  const c=document.createElement('canvas');c.width=W*4;c.height=H*4;const g=c.getContext('2d');g.drawImage(M.cv,0,0,c.width,c.height);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(0,0,c.width,c.height);
  const big=sz.indexOf(Math.max(...sz))+1;for(let s=0;s<W*H;s++){const k=G[s];if(k<=0)continue;g.fillStyle=k===big?'rgba(40,160,60,.9)':'hsl('+((k*67)%360)+',90%,50%)';g.fillRect((s%W)*4,((s/W)|0)*4,4,4);}
  g.font='bold 14px sans-serif';g.fillStyle='#000';for(let px=0;px<=1920;px+=100){g.fillText(px,px*0.8+12,14);}for(let py=0;py<=1080;py+=100){g.fillText(py,2,py*0.8+44);}
  return JSON.stringify({n,sz:sz.map((v,i)=>[i+1,v]).sort((a,b)=>b[1]-a[1]).slice(0,30),url:c.toDataURL('image/png')});})()`);
 const o=JSON.parse(res);fs.writeFileSync(process.env.COMPOUT||'comp.png',Buffer.from(o.url.split(',')[1],'base64'));console.log('comp',o.n,JSON.stringify(o.sz));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
