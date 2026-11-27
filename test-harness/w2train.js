// 新主島預覽：小火車（時刻表、月台、上車、坐車、下車、別人看得到）
// HASH='&nobb&map2' node w2train.js   PARTS=sched,plat,ride,peer,all,shots（預設 sched,plat,ride,peer）  Q=low|mid
const fs=require('fs');const path=require('path');const lib=require('./lib.js');const Q=process.env.Q||'mid';const D=path.resolve(__dirname,'..')+'/w2/train/';fs.mkdirSync(D,{recursive:true});
const PARTS=(process.env.PARTS||'sched,plat,ride,peer').split(',');const has=k=>PARTS.includes(k);
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':JSON.stringify(Q),'tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.hintTrain':'1','tide.guideHide':'true'}});const {p,b,go,errs,snap}=r;
 const T0=Date.now(),lg=m=>console.log('  t'+((Date.now()-T0)/1000).toFixed(0),m);
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(1);}
 await go(20);
 await p.evaluate(()=>{const T=__T;T.DayNight.fixed=10;__T.ev('Env').tideTest=0;for(const e of document.querySelectorAll('#toasts > *'))e.remove();});
 console.log('train',await ev(`JSON.stringify({has:!!W2.train,n:W2.train&&W2.train.n,seats:W2.train&&W2.train.seats,cycle:W2.train&&+W2.train.cycle.toFixed(1),len:W2.train&&+W2.train.len.toFixed(1),stops:W2.train&&W2.train.stops.map(s=>s.name)})`));
 const btn=()=>p.evaluate(()=>{const a=document.getElementById('act');return a?a.innerText.replace(/\s+/g,' ').trim():''});
 const tpStop=i=>p.evaluate(i=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),q=W.train.stops[i];try{W.warm(q.x,q.z)}catch(e){};me.pos.x=q.x+q.nx*0.3;me.pos.z=q.z+q.nz*0.3;me.baseY=E('groundHeight')(me.pos.x,me.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=Math.atan2(-q.nx,-q.nz);E('cam').yaw=me.rot+Math.PI;for(let k=0;k<6;k++)__step(1,50);},i);
 // 1) 時刻表：把時間一格一格往前推一整圈，看每班車有沒有瞬間移動、有沒有超速、每一站是不是都停滿
 if(has('sched')){console.log('sched',await p.evaluate(()=>{const E=__T.ev,W=E('W2'),T=W.train,t0=Math.floor(E('bossNow')()/1000),o={maxV:0,maxJump:0,dwell:{},stops:0,carGap:[9,0],bad:[]};const NS=T.stops.length;
   for(let k=0;k<T.n;k++){let prev=null,at=-1,since=0;for(let i=0;i<=Math.ceil(T.cycle*10)+5;i++){const t=t0+i*0.1;W.trainStep(t,0.1);const s=T.state(k);o.maxV=Math.max(o.maxV,s.v);if(prev){let d=s.s-prev.s;if(d<-T.len/2)d+=T.len;if(Math.abs(d)>0.82&&o.bad.length<4)o.bad.push([k,i,+d.toFixed(2)]);o.maxJump=Math.max(o.maxJump,Math.abs(d));}
     if(s.at>=0){if(at!==s.at){at=s.at;since=0;}since+=0.1;}else if(at>=0){const key=k+':'+at;o.dwell[key]=+since.toFixed(1);at=-1;}prev={s:s.s};
     if(k===0&&i%7===0){const a=T.seat(0,0),c=T.seat(0,4);const g=Math.hypot(a.x-c.x,a.z-c.z);o.carGap[0]=Math.min(o.carGap[0],g);o.carGap[1]=Math.max(o.carGap[1],g);}}}
   const dv=Object.values(o.dwell);o.dwellN=dv.length;o.dwellMin=Math.min(...dv);o.dwellMax=Math.max(...dv);delete o.dwell;o.maxV=+o.maxV.toFixed(2);o.maxJump=+o.maxJump.toFixed(2);o.carGap=o.carGap.map(v=>+v.toFixed(2));
   // 每一站：等下一班最久要多久（一整圈裡每秒問一次）
   let worst=0;for(let i=0;i<T.cycle;i+=1){W.trainStep(t0+i,1);for(let st=0;st<NS;st++){if(!T.atStop(st))worst=Math.max(worst,T.arrive(st));}}o.worstWait=+worst.toFixed(1);
   W.trainStep(E('bossNow')()/1000,0);return JSON.stringify(o)}));lg('sched done');}
 // 2) 月台：每一站都站得上去（高度對、可以走）、從旁邊用搖桿走得上去；月台上會出現「等小火車／上車」
 if(has('plat')){console.log('plat',await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),cam=E('cam'),joy=E('joy'),gh=E('groundHeight'),walkable=E('walkable'),S=W.train.stops,o={n:S.length,onTop:0,walk:0,stepUp:0,prompt:0,bad:[]};
   for(let i=0;i<S.length;i++){const q=S[i];try{W.warm(q.x,q.z)}catch(e){};const h=gh(q.x,q.z),h2=gh(q.x+q.tx*2.2,q.z+q.tz*2.2),out=gh(q.x+q.nx*2.6,q.z+q.nz*2.6);if(Math.abs(h-q.y)<0.01&&Math.abs(h2-q.y)<0.01)o.onTop++;else o.bad.push([q.name,'h',+h.toFixed(2),+q.y.toFixed(2)]);if(walkable(q.x,q.z)&&walkable(q.x+q.tx*2.2,q.z+q.tz*2.2))o.walk++;
    // 從月台外面（離軌道比較遠的那一邊）走上去
    const sx=q.x+q.nx*3.4,sz=q.z+q.nz*3.4;me.pos.x=sx;me.pos.z=sz;me.baseY=gh(sx,sz);me.pos.y=me.baseY;E('Jump').gy=me.baseY;cam.yaw=Math.atan2(q.nx,q.nz);joy.x=0;joy.z=-1;let on=false;for(let k=0;k<22&&!on;k++){__step(1,50);if(Math.hypot(me.pos.x-q.x,me.pos.z-q.z)<1.0)on=true;}joy.z=0;for(let k=0;k<5;k++)__step(1,50);
    const d=Math.hypot(me.pos.x-q.x,me.pos.z-q.z);if(d<1.6&&Math.abs(me.baseY-q.y)<0.06)o.stepUp++;else o.bad.push([q.name,'step',+d.toFixed(2),+me.baseY.toFixed(2),+out.toFixed(2),+q.y.toFixed(2)]);
    const ns=E('nearShop')();if(ns&&ns.mode==='w2train'&&ns.st===i)o.prompt++;else o.bad.push([q.name,'prompt',ns&&ns.mode]);}
   return JSON.stringify(o)}));lg('plat done');}
 // 等某一站有車進站（一格一格走，最多等一整圈）
 const waitTrain=async(i,maxS)=>{let st=null;for(let f=0;f<(maxS||120)*10;f++){st=await p.evaluate(i=>{const E=__T.ev,T=E('W2').train;__step(1,100);const a=T.atStop(i);return a?{k:a.k,leave:+a.leave.toFixed(1)}:{eta:+T.arrive(i).toFixed(1)}},i);if(st.k!=null&&st.leave>3)return st;}return st;};
 // 3) 上車 → 坐一站 → 下車
 if(has('ride')){const o={};const i0=await p.evaluate(()=>__T.ev('W2').train.stops.findIndex(s=>s.name==='村公所'));await tpStop(i0);
  await p.evaluate(()=>{for(let k=0;k<20;k++)__step(1,50)});o.waitBtn=await btn();await snap(D+'1_wait.jpg');
  // 車快進站的時候拍一張
  for(let f=0;f<1200;f++){const e=await p.evaluate(i=>{__step(1,100);const T=__T.ev('W2').train;return T.atStop(i)?0:T.arrive(i)},i0);if(e<2.2)break;}
  await go(2);await snap(D+'2_arriving.jpg');
  const tr=await waitTrain(i0,140);o.train=tr;await p.evaluate(()=>{for(let k=0;k<14;k++)__step(1,50)});o.boardBtn=await btn();await snap(D+'3_board_btn.jpg');
  // 按大按鈕上車
  o.board=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me');T.actionDown();__step(1,50);T.actionUp();const s=E('mySeat'),R=E('Ride');const r={seat:!!(s&&s.train),k:s&&s.k,i:s&&s.i,hop:!!R.hop,sit0:me.sitting};for(let k=0;k<14;k++)__step(1,50);const q=E('W2').train.seat(s.k,s.i);r.sit=me.sitting;r.dSeat=+Math.hypot(me.pos.x-q.x,me.pos.z-q.z).toFixed(3);r.dy=+(me.baseY-q.y).toFixed(3);r.pres=E('presenceObj')().tr;r.st=E('presenceObj')().st;return r});
  await go(4);o.sitBtn=await btn();await snap(D+'4_seated.jpg');
  // 開車中想下車：不行
  let moving=null;for(let f=0;f<200;f++){moving=await p.evaluate(()=>{__step(1,100);const E=__T.ev,s=E('mySeat'),st=E('W2').train.state(s.k);return {at:st.at,v:+st.v.toFixed(1)}});if(moving.at<0&&moving.v>3)break;}
  o.offWhileMoving=await p.evaluate(()=>{const T=__T,E=T.ev;E('w2TrainOff')();T.actionDown();__step(1,50);T.actionUp();E('joy').z=-1;for(let k=0;k<6;k++)__step(1,50);E('joy').z=0;E('jump')();__step(2,50);return {stillSeated:!!(E('mySeat')&&E('mySeat').train)}});
  await p.evaluate(()=>{for(let k=0;k<12;k++)__step(1,50)});o.rideBtn=await btn();await go(3);await snap(D+'5_riding.jpg');
  // 坐到下一站：一路上人都貼在位子上、鏡頭跟著車轉
  o.ride=await p.evaluate(()=>{const E=__T.ev,me=E('me'),cam=E('cam'),W=E('W2'),T=W.train,s=E('mySeat');let maxD=0,maxV=0,frames=0,yaw0=cam.yaw,h0=T.seat(s.k,s.i).face,x0=me.pos.x,z0=me.pos.z,arr=-1;for(let f=0;f<900;f++){__step(1,100);frames++;const q=T.seat(s.k,s.i),st=T.state(s.k);maxD=Math.max(maxD,Math.hypot(me.pos.x-q.x,me.pos.z-q.z));maxV=Math.max(maxV,st.v);if(st.at>=0){arr=st.at;break;}}
   const q=T.seat(s.k,s.i);let dh=q.face-h0,dy=cam.yaw-yaw0;dh=Math.atan2(Math.sin(dh),Math.cos(dh));dy=Math.atan2(Math.sin(dy),Math.cos(dy));return {frames,maxD:+maxD.toFixed(3),maxV:+maxV.toFixed(1),moved:+Math.hypot(me.pos.x-x0,me.pos.z-z0).toFixed(1),arrived:T.stops[arr]&&T.stops[arr].name,headTurn:+dh.toFixed(2),camTurn:+dy.toFixed(2)}});
  await p.evaluate(()=>{for(let k=0;k<16;k++)__step(1,50)});o.offBtn=await btn();await go(2);await snap(D+'6_arrived.jpg');
  // 下車
  o.off=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),W=E('W2'),s=E('mySeat'),st=W.train.state(s.k),sp=W.train.stops[st.at];T.actionDown();__step(1,50);T.actionUp();const r={seated:!!E('mySeat'),out:!!E('Ride').out};for(let k=0;k<14;k++)__step(1,50);r.out2=!!E('Ride').out;r.sit=me.sitting;r.d=+Math.hypot(me.pos.x-sp.x,me.pos.z-sp.z).toFixed(2);r.y=+me.baseY.toFixed(2);r.platY=+sp.y.toFixed(2);r.walk=E('walkable')(me.pos.x,me.pos.z);r.pres=E('presenceObj')().tr||null;r.stop=sp.name;
   // 下車以後可以正常走路
   const x0=me.pos.x,z0=me.pos.z;E('cam').yaw=Math.atan2(sp.nx,sp.nz)+Math.PI;E('joy').z=-1;for(let k=0;k<30;k++)__step(1,50);E('joy').z=0;r.walked=+Math.hypot(me.pos.x-x0,me.pos.z-z0).toFixed(1);return r});
  await go(3);await snap(D+'7_off.jpg');
  console.log('ride',JSON.stringify(o));lg('ride done');}
 // 4) 別人坐車：假的另一個玩家帶著 tr，他要一路貼在我這邊那班車的位子上；我上車時不會坐到他的位子
 if(has('peer')){const i0=await p.evaluate(()=>__T.ev('W2').train.stops.findIndex(s=>s.name==='水族館'));await tpStop(i0);const tr=await waitTrain(i0,140);
  const o=await p.evaluate(k=>{const T=__T,E=T.ev,W=E('W2'),Tr=W.train,me=E('me');const mk=(id,seat)=>{const q=Tr.seat(k,seat);E('applyPeer')({peer:id,kind:'viewer',by:'u_'+id,presence:{p:[+q.x.toFixed(2),+q.z.toFixed(2),+q.y.toFixed(2)],r:0,st:1,tr:[k,seat],sh:'#e06a8a',ht:'#ffd36a'}});};
   // 把離我最近的四個位子都給假玩家坐
   const order=[...Array(Tr.seats).keys()].sort((a,b)=>{const A=Tr.seat(k,a),B=Tr.seat(k,b);return Math.hypot(A.x-me.pos.x,A.z-me.pos.z)-Math.hypot(B.x-me.pos.x,B.z-me.pos.z)});const taken=order.slice(0,4);taken.forEach((s,j)=>mk('tp'+j,s));for(let f=0;f<10;f++)__step(1,50);
   T.actionDown();__step(1,50);T.actionUp();const s=E('mySeat');const r={k,taken,mine:s&&s.i,clash:!!(s&&taken.includes(s.i))};for(let f=0;f<14;f++)__step(1,50);
   // 開車：假玩家的位置不再更新（模擬對方的位置晚到），他們還是要貼在位子上
   let maxD=0,n=0,vis=0;for(let f=0;f<260;f++){__step(1,100);const st=Tr.state(k);if(st.at<0){for(let j=0;j<4;j++){const P=E('peers').get('tp'+j),q=Tr.seat(k,taken[j]);/* 對方每 0.5 秒才傳一次位置 */if(f%5===0)E('applyPeer')({peer:'tp'+j,kind:'viewer',by:'u_tp'+j,presence:{p:[+q.x.toFixed(2),+q.z.toFixed(2),+q.y.toFixed(2)],r:0,st:1,tr:[k,taken[j]],sh:'#e06a8a',ht:'#ffd36a'}});maxD=Math.max(maxD,Math.hypot(P.fisher.pos.x-q.x,P.fisher.pos.z-q.z));n++;if(P.fisher.av.g.visible)vis++;}}if(st.at>=0&&f>60)break;}
   r.peerMaxD=+maxD.toFixed(3);r.samples=n;r.visible=vis;r.sitting=E('peers').get('tp0').fisher.sitting;return r},tr.k);
  await go(3);await snap(D+'8_peers.jpg');
  // 假玩家「下車」：tr 不見了，回到一般的位置
  o.after=await p.evaluate(()=>{const E=__T.ev,P=E('peers').get('tp0');E('applyPeer')({peer:'tp0',kind:'viewer',by:'u_tp0',presence:{p:[+P.fisher.pos.x.toFixed(2),+P.fisher.pos.z.toFixed(2)+3,0.6],r:0,sh:'#e06a8a',ht:'#ffd36a'}});for(let f=0;f<30;f++)__step(1,50);return {tr:P.tr,sitting:P.fisher.sitting}});
  await p.evaluate(()=>{const E=__T.ev;const s=E('mySeat');if(s){for(let f=0;f<400;f++){__step(1,100);if(E('W2').train.state(s.k).at>=0)break;}E('w2TrainOff')();for(let f=0;f<14;f++)__step(1,50);}for(let j=0;j<4;j++){const P=E('peers').get('tp'+j);if(P){try{P.fisher.dispose()}catch(e){};E('peers').delete('tp'+j);}}});
  console.log('peer',JSON.stringify(o));lg('peer done');}
 // 5) 十一站每一站都上車、坐到下一站、下車
 if(has('all')){const n=await ev('W2.train.stops.length');const res=[];for(let i=0;i<n;i++){await tpStop(i);const tr=await waitTrain(i,140);if(!tr||tr.k==null){res.push([i,'NO TRAIN',tr]);continue;}
   const r1=await p.evaluate(i=>{const T=__T,E=T.ev,me=E('me'),W=E('W2'),Tr=W.train;const ns=E('nearShop')();if(!ns||ns.mode!=='w2train')return {err:'no prompt',ns:ns&&ns.mode};E('openShop')(ns);const s=E('mySeat');if(!s||!s.train)return {err:'not seated'};for(let f=0;f<12;f++)__step(1,50);let arr=-1,maxD=0;for(let f=0;f<900;f++){__step(1,100);const st=Tr.state(s.k),q=Tr.seat(s.k,s.i);maxD=Math.max(maxD,Math.hypot(me.pos.x-q.x,me.pos.z-q.z));if(st.at>=0&&st.at!==i){arr=st.at;break;}}
    if(arr<0)return {err:'never arrived'};for(let f=0;f<6;f++)__step(1,50);E('w2TrainOff')();for(let f=0;f<14;f++)__step(1,50);const sp=Tr.stops[arr];return {from:Tr.stops[i].name,to:sp.name,next:arr===(i+1)%Tr.stops.length,maxD:+maxD.toFixed(3),off:!E('mySeat'),d:+Math.hypot(me.pos.x-sp.x,me.pos.z-sp.z).toFixed(2),dy:+(me.baseY-sp.y).toFixed(2),walk:E('walkable')(me.pos.x,me.pos.z)}},i);res.push(r1);}
  console.log('all',JSON.stringify(res));lg('all done');}
 console.log('errs',JSON.stringify(errs.slice(0,8))); await b.close(); process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
