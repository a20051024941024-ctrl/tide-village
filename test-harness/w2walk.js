// 新主島預覽：走路測試（木棧道、棧橋、小橋、森林步道能走；水裡不能走）。TIDE=0 中潮（預設）、-1 乾潮、1 滿潮
const lib=require('./lib.js');const Q=process.env.Q||'mid';
(async()=>{const r=await lib({vp:{width:800,height:450},dsf:1,ls:{'tide.quality':JSON.stringify(Q),'tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(1);}
 await go(20);
 for(const lv of (process.env.TIDES||'0,-1').split(',').map(Number)){
  await p.evaluate(lv=>{__T.ev('Env').tideTest=lv;for(let i=0;i<8;i++)__step(1,50)},lv);
  console.log('tide',lv,await ev('waterSurface.material.uniforms.uTideD.value.toFixed(2)'));
  // 1) 函式層：木棧道每一點都能走、旁邊的水不能走；小橋能走
  console.log('fn',await ev(`(()=>{const B=W2.board,o={n:B.length,walkAll:true,hMin:9,hMax:-9,sideWater:0,sideLand:0};for(let i=0;i<B.length;i++){const x=W2.ox+B[i][0],z=W2.oz+B[i][1];if(!walkable(x,z))o.walkAll=false;const h=groundHeight(x,z);o.hMin=Math.min(o.hMin,h);o.hMax=Math.max(o.hMax,h);const a=B[Math.max(0,i-1)],c=B[Math.min(B.length-1,i+1)],l=Math.hypot(c[0]-a[0],c[1]-a[1])||1,nx=-(c[1]-a[1])/l,nz=(c[0]-a[0])/l;for(const s of[-1,1]){if(walkable(x+nx*s*1.6,z+nz*s*1.6))o.sideLand++;else o.sideWater++;}}
    o.hMin=+o.hMin.toFixed(2);o.hMax=+o.hMax.toFixed(2);o.bridge=[walkable(W2.ox-53,W2.oz-40.8),+groundHeight(W2.ox-53,W2.oz-40.8).toFixed(2),walkable(W2.ox-50,W2.oz-40.8),walkable(W2.ox-56,W2.oz-40.8)];o.lagoonWater=walkable(W2.ox-125,W2.oz-30);o.sea=walkable(W2.ox,W2.oz+150);o.plaza=[walkable(W2.ox,W2.oz),+groundHeight(W2.ox,W2.oz).toFixed(2)];o.pierSide=[walkable(W2.ox+5+2.6,W2.oz+66),walkable(W2.ox+5+3.5,W2.oz+62.5),+groundHeight(W2.ox+5,W2.oz+80).toFixed(2)];return JSON.stringify(o)})()`));
  // 2) 真的用搖桿走
  const follow=async(name,pts,maxF)=>{await p.evaluate(pts=>{window.__wp=pts;window.__wi=1;const T=__T,W=T.ev('W2');const me=T.ev('me');try{W.warm(W.ox+pts[0][0],W.oz+pts[0][1])}catch(e){};me.pos.set(W.ox+pts[0][0],T.ev('groundHeight')(W.ox+pts[0][0],W.oz+pts[0][1]),W.oz+pts[0][1]);me.baseY=me.pos.y;T.ev('Jump').gy=me.baseY;},pts);
   let f=0,yMin=9,yMax=-9,wet=0,last=null;for(;f<maxF;f++){const s=await p.evaluate(()=>{const T=__T,W=T.ev('W2'),me=T.ev('me'),cam=T.ev('cam'),joy=T.ev('joy');const t=window.__wp[window.__wi];if(!t){joy.x=0;joy.z=0;return {done:1,x:me.pos.x-W.ox,z:me.pos.z-W.oz,y:me.pos.y};}const dx=W.ox+t[0]-me.pos.x,dz=W.oz+t[1]-me.pos.z,d=Math.hypot(dx,dz);if(d<0.7){window.__wi++;}cam.yaw=Math.atan2(-dx,-dz);joy.x=0;joy.z=-1;__step(1,50);return {x:me.pos.x-W.ox,z:me.pos.z-W.oz,y:me.pos.y,w:T.ev('walkable')(me.pos.x,me.pos.z)}});
    if(s.done){last=s;break;} yMin=Math.min(yMin,s.y);yMax=Math.max(yMax,s.y);if(!s.w)wet++; last=s;}
   await p.evaluate(()=>{const j=__T.ev('joy');j.x=0;j.z=0;});
   console.log('walk',name,JSON.stringify({frames:f,end:[+last.x.toFixed(1),+last.z.toFixed(1)],target:pts[pts.length-1].map(v=>+v.toFixed(1)),y:[+yMin.toFixed(2),+yMax.toFixed(2)],wet,done:!!last.done}));};
  const board=JSON.parse(await ev('JSON.stringify(W2.board)'));
  await follow('木棧道 東→西',board.filter((q,i)=>i%2===0||i===board.length-1),900); await follow('棧橋 岸→外',[[5,60.5],[5,66.5],[5,80],[5,93]],500);
  await follow('小橋 南→北',[[-53,-31.5],[-53,-36],[-53,-45.5],[-53.5,-49]],400);
  await follow('村公所後面→瀑布步道',[[-6.2,-46.6],[-7,-52.2],[-9.4,-59],[-19,-63.8],[-28.6,-63]],900);
  // 3) 從木棧道中間往旁邊走：會被水擋住；從棧橋中段往旁邊走：不會掉下去
  console.log('side',await p.evaluate(()=>{const T=__T,W=T.ev('W2'),me=T.ev('me'),cam=T.ev('cam'),joy=T.ev('joy'),B=W.board,i=B.length>>1,x=W.ox+B[i][0],z=W.oz+B[i][1];me.pos.set(x,T.ev('groundHeight')(x,z),z);me.baseY=me.pos.y;T.ev('Jump').gy=me.baseY;cam.yaw=0;joy.x=0;joy.z=-1;for(let k=0;k<80;k++)__step(1,50);joy.z=0;const d=Math.hypot(me.pos.x-x,me.pos.z-z);const o={board:{moved:+d.toFixed(2),stillWalkable:T.ev('walkable')(me.pos.x,me.pos.z),y:+me.pos.y.toFixed(2)}};
   const px=W.ox+5,pz=W.oz+63;me.pos.set(px,T.ev('groundHeight')(px,pz),pz);me.baseY=me.pos.y;T.ev('Jump').gy=me.baseY;cam.yaw=Math.PI/2;joy.z=-1;for(let k=0;k<80;k++)__step(1,50);joy.z=0;o.pier={dx:+(me.pos.x-px).toFixed(2),dz:+(me.pos.z-pz).toFixed(2),y:+me.pos.y.toFixed(2),walk:T.ev('walkable')(me.pos.x,me.pos.z)};return JSON.stringify(o)}));
 }
 console.log('errs',JSON.stringify(errs.slice(0,8))); await b.close(); process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
