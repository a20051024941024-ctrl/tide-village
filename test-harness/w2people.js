// 新主島預覽：村子戶外的人和板子搬過來（站位、按鈕、開的畫面、釣魚、散步、回舊村子再回來、進店再出來）
// HASH='&nobb&map2' node w2people.js   PARTS=site,open,gang,roam,hop,indoor（預設全部）   Q=low|mid
const fs=require('fs');const path=require('path');const lib=require('./lib.js');const Q=process.env.Q||'low';
const PARTS=(process.env.PARTS||'site,open,gang,roam,hop,nav,indoor').split(',');const has=k=>PARTS.includes(k);
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':JSON.stringify(Q),'tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.hintTrain':'1','tide.guideHide':'true'}});const {p,b,go,errs,snap}=r;
 const T0=Date.now(),lg=m=>console.log('  t'+((Date.now()-T0)/1000).toFixed(0),m);
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(1);}
 await go(30);
 await p.evaluate(()=>{const T=__T;T.DayNight.fixed=10;__T.ev('Env').tideTest=0;for(const e of document.querySelectorAll('#toasts > *'))e.remove();
  window.__errAt=[];{const oe=console.error;console.error=(...a)=>{try{const E=__T.ev,me=E('me');window.__errAt.push({f:E('frameNo'),x:+me.pos.x.toFixed(1),z:+me.pos.z.toFixed(1),yaw:+E('cam').yaw.toFixed(2),on:E('W2S').on,m:String(a[1]).slice(0,50),lost:E('renderer').getContext().isContextLost(),progs:E('renderer').info.programs.length})}catch(e){};oe(...a)};}
  // 共用的小工具
  window.__pp={ K:()=>Object.keys(__T.ev('W2').posts),
   npc:k=>{const E=__T.ev;return E('npcs').find(E('W2_NPC')[k])},
   tp:(x,z,rot)=>{const E=__T.ev,me=E('me');try{E('W2').warm(x,z)}catch(e){};me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;E('Jump').air=0;if(rot!=null){me.rot=rot;E('cam').yaw=rot+Math.PI;}},
   front:(p,d)=>[p.x+Math.sin(p.face)*d,p.z+Math.cos(p.face)*d] };});
 console.log('posts',await ev(`JSON.stringify(Object.fromEntries(Object.entries(W2.posts).map(([k,q])=>[k,[+((q.x-W2.ox)/0.2+965).toFixed(0),+((q.z-W2.oz)/0.2+505).toFixed(0),+q.face.toFixed(2)]])))`));
 // 1) 站位：人在新主島 → 開關開著；板子、村民都在排好的位置；板子有碰撞；走到前面會出現對的按鈕
 if(has('site')){console.log('site',await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),PO=W.posts,S=E('W2S'),me=E('me'),gh=E('groundHeight'),o={on:S.on,fix:{},npc:{},btn:{},bad:[]};
   for(const F of E('W2_FIX')){const q=PO[F.k];if(!q)continue;const g=F.g(),[x,z,r]=F.get();o.fix[F.k]={mesh:!!g,at:g?+Math.hypot(g.position.x-q.x,g.position.z-q.z).toFixed(3):-1,c:+Math.hypot(x-q.x,z-q.z).toFixed(3),y:g?+g.position.y.toFixed(2):0,gy:+gh(q.x,q.z).toFixed(2),rot:g?+g.rotation.y.toFixed(2):0,vis:g?g.visible:false,col:E('blocked')(q.x,q.z,0.2),walk:E('walkable')(q.x,q.z),kind:W.kind(q.x,q.z)};
    // 站到板子正前面 1.6 公尺
    const [fx,fz]=__pp.front(q,1.6);__pp.tp(fx,fz,q.face+Math.PI);for(let k=0;k<30;k++)__step(1,50);const ns=E('nearShop')();o.btn[F.k]={mode:ns&&ns.mode,label:ns&&ns.label,free:!E('blocked')(fx,fz,0.3),land:E('walkable')(fx,fz),txt:document.getElementById('act').innerText.replace(/\s+/g,' ').trim()};}
   for(const k in E('W2_NPC')){const q=PO[k],n=__pp.npc(k);if(!q||!n){o.bad.push([k,'missing',!!q,!!n]);continue;}
    __pp.tp(q.x+Math.sin(q.face)*1.5+Math.cos(q.face)*0.6,q.z+Math.cos(q.face)*1.5-Math.sin(q.face)*0.6,q.face+Math.PI);for(let k2=0;k2<30;k2++)__step(1,50);const ns=E('nearShop')();
    o.npc[k]={d:+Math.hypot(n.pos.x-q.x,n.pos.z-q.z).toFixed(2),y:+n.pos.y.toFixed(2),gy:+gh(q.x,q.z).toFixed(2),vis:n.av.g.visible,w2on:!!n.w2on,fishing:!!n.fishing,name:n.npcName,mode:ns&&ns.mode,label:ns&&ns.label,txt:document.getElementById('act').innerText.replace(/\s+/g,' ').trim(),inWall:E('blocked')(n.pos.x,n.pos.z,0.2)};}
   return JSON.stringify(o)}));lg('site done');}
 // 2) 按下去開的是原本的畫面
 if(has('open')){console.log('open',await p.evaluate(async()=>{const T=__T,E=T.ev,W=E('W2'),PO=W.posts,o={};
   const run=(k,x,z,rot)=>{__pp.tp(x,z,rot);for(let i=0;i<30;i++)__step(1,50);const ns=E('nearShop')();if(!ns){o[k]='no shop';return;}E('openShop')(ns);for(let i=0;i<10;i++)__step(1,50);const sh=document.getElementById('sheet');o[k]={mode:ns.mode,open:!sh.hidden,tab:E('curTab'),title:(sh.querySelector('.shophead b,.dexhead,h2,h3,.wstop')||{}).textContent||'',txt:sh.innerText.replace(/\s+/g,' ').slice(0,60)};try{E('closeSheet')()}catch(e){};for(let i=0;i<6;i++)__step(1,50);};
   for(const F of E('W2_FIX')){const q=PO[F.k];if(!q)continue;const [fx,fz]=__pp.front(q,1.6);run(F.k,fx,fz,q.face+Math.PI);}
   for(const k in E('W2_NPC')){const q=PO[k];if(!q)continue;run(k,q.x+Math.sin(q.face)*1.5+Math.cos(q.face)*0.6,q.z+Math.cos(q.face)*1.5-Math.sin(q.face)*0.6,q.face+Math.PI);}
   return JSON.stringify(o)}));lg('open done');}
 // 3) 老港釣魚：浮標在水裡、會咬、會拉上來
 if(has('gang')){console.log('gang',await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),q=W.posts.gang,n=__pp.npc('gang'),o={st:{},bobWater:0,bobN:0,moved:0,maxD:0};if(!q||!n)return 'none';
   __pp.tp(q.x-2.2,q.z+3,0);for(let i=0;i<1800;i++){__step(1,50);o.st[n.st||'wait']=(o.st[n.st||'wait']||0)+1;if(n.bobState==='water'){o.bobN++;if(E('waterAt')(n.bobPos.x,n.bobPos.z))o.bobWater++;}o.maxD=Math.max(o.maxD,Math.hypot(n.pos.x-q.x,n.pos.z-q.z));}
   o.maxD=+o.maxD.toFixed(2);o.rot=+n.rot.toFixed(2);o.fishing=n.fishing;o.bob=[+((n.bobPos.x-W.ox)/0.2+965).toFixed(0),+((n.bobPos.z-W.oz)/0.2+505).toFixed(0)];o.spot=E('waterSpotId')(n.bobPos.x,n.bobPos.z);o.onDeck=+E('groundHeight')(n.pos.x,n.pos.z).toFixed(2);return JSON.stringify(o)}));lg('gang done');}
 // 4) 阿鐵在攤位附近走動：去處都在鋪了路的地方、不靠鐵軌、沒被擋住；走 6 分鐘都離攤位不遠、不會瞬移
 if(has('roam')){const out={};const keys=await p.evaluate(()=>Object.keys(__T.ev('W2_NPC')).filter(k=>__T.ev('W2').posts[k]));
  for(const k of keys){const r0=await p.evaluate(k=>{const E=__T.ev,W=E('W2'),q=W.posts[k],n=__pp.npc(k),kind=E('roamKind')(n);if(!kind)return {kind:null};__pp.tp(q.x+Math.sin(q.face)*6,q.z+Math.cos(q.face)*6,q.face+Math.PI);window.__rm={k,px:n.pos.x,pz:n.pos.z,r:{kind,ready:false,c:0,bad:0,maxD:0,jump:0,rail:0,blk:0,walked:0,away:0}};return {kind}},k);
   if(!r0.kind){out[k]=r0;continue;}
   for(let g=0;g<40;g++){const rd=await p.evaluate(k=>{const n=__pp.npc(k);for(let i=0;i<150&&!(n.roam&&n.roam.ready);i++)__step(1,33);return !!(n.roam&&n.roam.ready)},k);if(rd)break;await p.waitForTimeout(60);}
   await p.evaluate(k=>{const E=__T.ev,W=E('W2'),n=__pp.npc(k),R=n.roam,r=__rm.r;r.ready=!!(R&&R.ready);r.c=R?R.c.length:0;if(R)for(const c of R.c){if(!W.stroll(c.x,c.z,r.kind==='shop')||E('blocked')(c.x,c.z,0.3))r.bad++;}},k);
   for(let g=0;g<20;g++){if(g%5===0)lg("roam "+k+" "+g);await p.evaluate(k=>{const E=__T.ev,W=E("W2"),q=W.posts[k],n=__pp.npc(k),R=n.roam,r=__rm.r;for(let i=0;i<200;i++){__step(1,50);const d=Math.hypot(n.pos.x-q.x,n.pos.z-q.z),st=Math.hypot(n.pos.x-__rm.px,n.pos.z-__rm.pz);r.maxD=Math.max(r.maxD,d);r.jump=Math.max(r.jump,st);if(st>0.01)r.walked++;if(R&&R.away)r.away++;if(W.rail(n.pos.x,n.pos.z,1.2))r.rail++;if(E('blocked')(n.pos.x,n.pos.z,0.05))r.blk++;__rm.px=n.pos.x;__rm.pz=n.pos.z;}},k);await p.waitForTimeout(40);}
   out[k]=await p.evaluate(()=>{const r=__rm.r;r.maxD=+r.maxD.toFixed(2);r.jump=+r.jump.toFixed(2);return r});}
  console.log('roam',JSON.stringify(out),'lost',await p.evaluate(()=>__T.ev('renderer').getContext().isContextLost()));lg('roam done');}
 // 5) 回舊村子：板子、村民回原位；再回新主島：又搬過來
 if(has('hop')){const gl=()=>p.evaluate(()=>{const E=__T.ev,R=E('renderer');return [E('frameNo'),R.info.programs.length,R.getContext().isContextLost(),R.info.memory.geometries,R.info.memory.textures]});const o={};
  o.a=await p.evaluate(()=>{const T=__T,E=T.ev,S=E('W2S'),o={};__pp.tp(0,8,0);for(let i=0;i<40;i++)__step(1,50);o.offOn=S.on;o.vil={};
   for(const F of E('W2_FIX')){const g=F.g(),[x,z,r]=F.get();o.vil[F.k]=[+x.toFixed(1),+z.toFixed(1),+r.toFixed(2),g?+Math.hypot(g.position.x-x,g.position.z-z).toFixed(3):-1,F.v?+Math.hypot(F.v[0]-x,F.v[1]-z).toFixed(3):-1];}
   for(const k in E('W2_NPC')){const n=__pp.npc(k);if(n)o.vil[k]=[+Math.hypot(n.pos.x-n.v0.x,n.pos.z-n.v0.z).toFixed(2),!!n.w2on,n.fishing,n.av.g.visible];}return o});o.g1=await gl();
  o.b=await p.evaluate(()=>{const E=__T.ev,o={};
   { const B=E('BOARD');__pp.tp(B.x+Math.sin(B.rot)*1.6,B.z+Math.cos(B.rot)*1.6,B.rot+Math.PI);for(let i=0;i<30;i++)__step(1,50);const ns=E('nearShop')();o.vilBoard=ns&&ns.mode; }
   { const B=E('ORDB');__pp.tp(B.x+Math.sin(B.rot)*1.6,B.z+Math.cos(B.rot)*1.6,B.rot+Math.PI);for(let i=0;i<30;i++)__step(1,50);const ns=E('nearShop')();o.vilOrders=ns&&ns.mode; }return o});o.g2=await gl();
  for(let k=0;k<6;k++){await p.evaluate(()=>{for(let i=0;i<40;i++)__step(1,50)});await p.waitForTimeout(150);}
  o.c=await p.evaluate(()=>{const E=__T.ev,o={};for(const k in E('W2_NPC')){const n=__pp.npc(k);if(n)o[k]=+Math.hypot(n.pos.x-n.v0.x,n.pos.z-n.v0.z).toFixed(2);}return o});o.g3=await gl();
  o.d=await p.evaluate(()=>{const E=__T.ev,W=E('W2'),PO=W.posts,S=E('W2S'),o={};__pp.tp(W.spawn[0],W.spawn[1],Math.PI);for(let i=0;i<40;i++)__step(1,50);o.backOn=S.on;o.back={};
   for(const F of E('W2_FIX')){const q=PO[F.k];if(!q)continue;const g=F.g();o.back[F.k]=+Math.hypot(g.position.x-q.x,g.position.z-q.z).toFixed(3);}
   for(const k in E('W2_NPC')){const q=PO[k],n=__pp.npc(k);if(q&&n)o.back[k]=+Math.hypot(n.pos.x-q.x,n.pos.z-q.z).toFixed(2);}o.cols=E('colliders').length;return o});o.g4=await gl();
  console.log('hop',JSON.stringify(o));
  // 來回 5 次：碰撞不會越加越多
  const h5={g:[]};for(let k=0;k<5;k++){await p.evaluate(()=>{__pp.tp(0,8,0);for(let i=0;i<30;i++)__step(1,50);});h5.g.push(await gl());await p.evaluate(()=>{const W=__T.ev('W2');__pp.tp(W.spawn[0],W.spawn[1],Math.PI);for(let i=0;i<30;i++)__step(1,50);});h5.g.push(await gl());}
  h5.end=await p.evaluate(()=>({on:__T.ev('W2S').on,cols:__T.ev('colliders').length}));console.log('hop5',JSON.stringify(h5));lg('hop done');}
 // 5b) 地圖下面的「找人、找店」：在新主島是新主島那一份（每一個點都在新主島上、走得到），按了箭頭會指過去
 if(has('nav')){console.log('nav',await p.evaluate(()=>{const E=__T.ev,W=E('W2'),o={};__pp.tp(W.spawn[0],W.spawn[1],Math.PI);for(let i=0;i<20;i++)__step(1,50);const L=E('navList')();o.n=L.length;o.names=L.map(q=>q[0]+q[1].replace(/（.*$/,''));o.bad=L.filter(q=>!W.near(q[2][0],q[2][1])).length;
   const q=L.find(q=>/阿鐵/.test(q[1]));if(q){E('navTo')(q[1].replace(/（.*$/,''),q[2][0],q[2][1]);for(let i=0;i<10;i++)__step(1,50);const N=E('Nav').t;o.nav=N&&[N.label,+Math.hypot(N.x-W.posts.craft.x,N.z-W.posts.craft.z).toFixed(1)];E('Nav').t=null;}
   return JSON.stringify(o)}));lg('nav done');}
 // 6) 從新主島的門走進釣具店：板子、村民不動；出來還在新主島
 if(has('indoor')){const o={};o.a=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),d=W.doors.find(q=>q.k==='tackle');if(!d)return 'no door';__pp.tp(d.x,d.z,d.face+Math.PI);for(let i=0;i<30;i++)__step(1,50);const ns=E('nearShop')();E('openShop')(ns);return ns&&ns.mode});
   for(let i=0;i<14;i++){await p.waitForTimeout(120);await p.evaluate(()=>{for(let i=0;i<4;i++)__step(1,50)});}
   o.b=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),S=E('W2S'),me=E('me'),o={};o.inside=E('inShopHall')();o.onInside=S.on;o.near=W.near(me.pos.x,me.pos.z);const n=__pp.npc('craft');o.craftStays=+Math.hypot(n.pos.x-W.posts.craft.x,n.pos.z-W.posts.craft.z).toFixed(1);o.ordAt=+Math.hypot(E('ORDB').x-W.posts.orders.x,E('ORDB').z-W.posts.orders.z).toFixed(1);
    const hk=E('inShopHall')(),X=hk&&E('SHOPH')[hk].exit;if(X){__pp.tp(X.x,X.z,0);for(let i=0;i<20;i++)__step(1,50);const ex=E('nearShop')();o.exit=ex&&ex.mode;if(ex)E('openShop')(ex);}return o});
   for(let i=0;i<16;i++){await p.waitForTimeout(120);await p.evaluate(()=>{for(let i=0;i<4;i++)__step(1,50)});}
   o.c=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),S=E('W2S'),me=E('me'),d=W.doors.find(q=>q.k==='tackle');return {out:W.near(me.pos.x,me.pos.z),backAt:+Math.hypot(me.pos.x-d.x,me.pos.z-d.z).toFixed(1),onAfter:S.on,inside:E('inShopHall')()}});
   console.log('indoor',JSON.stringify(o));lg('indoor done');}
 console.log('errAt',JSON.stringify(await p.evaluate(()=>window.__errAt.slice(0,5))));
 console.log('errs',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
