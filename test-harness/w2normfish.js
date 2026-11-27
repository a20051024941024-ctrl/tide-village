// 一般玩家（沒有 #map2）：舊島釣魚不受影響；別人等魚的時候看得到浮標（v922 修）
// HASH='&nobb' node w2normfish.js     HASHONLY=1 只算指紋   GAMEJS=/路徑/舊版game.js 可以拿舊版來比   WAITW2=1 配 HASH='&nobb&map2'
const fs=require('fs');const path=require('path');const lib=require('./lib.js');const D=path.resolve(__dirname,'..')+'/w2/fish/';fs.mkdirSync(D,{recursive:true});
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:800,height:450},dsf:1,ls:{'tide.quality':'"mid"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3}});const {p,b,go,errs,snap}=r;
 const T0=Date.now(),lg=m=>console.log('  t'+((Date.now()-T0)/1000).toFixed(0),m);
 const reqs=[];p.on('request',q=>{if(/world2/.test(q.url()))reqs.push(q.url())});
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(60);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 if(process.env.WAITW2){for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;}}
 console.log('mode',await ev(`JSON.stringify({W2:!!W2,MAP2:MAP2})`),'world2 requests',reqs.length);
 // 舊世界整片量一次，算一個指紋（跟上一版、跟 #map2 模式比）
 console.log('hash',await p.evaluate(()=>{const E=__T.ev,waterAt=E('waterAt'),sid=E('waterSpotId'),ti=E('terrainInfo'),isLand=E('isLand');const Tide=E('Env').tide,lv0=Tide.lv;Tide.lv=0.5;/* 舊島紅樹林的泥灘跟著潮汐露出來，量的時候固定在漲潮，不然每次跑的結果不一樣 */let h=2166136261>>>0,n=0,w=0;const add=v=>{h^=v&255;h=Math.imul(h,16777619)>>>0;h^=(v>>8)&255;h=Math.imul(h,16777619)>>>0};
  for(let z=-210;z<=210;z+=2.5)for(let x=-210;x<=210;x+=2.5){const a=waterAt(x,z),q=ti(x,z);add(a?1:0);add(isLand(x,z)?1:0);add(Math.round((q.h+5)*100));add(q.region|0);add(q.water?1:0);if(a){w++;const s=sid(x,z);for(let i=0;i<s.length;i++)add(s.charCodeAt(i));}n++;}Tide.lv=lv0;return JSON.stringify({h,n,w,lv0:+lv0.toFixed(2)})}));
 if(process.env.HASHONLY){console.log('errs',JSON.stringify(errs.slice(0,8)));await b.close();process.exit(0);}
 await p.evaluate(()=>{__T.DayNight.fixed=10;});
 // 「找釣點」：舊島照舊（講最近的釣點在哪個方向，不會開帶路）
 console.log('gofish',await p.evaluate(()=>{const E=__T.ev;for(const e of document.querySelectorAll('#toasts > *'))e.remove();E('goFishing')();const t=document.querySelector('#toasts');return JSON.stringify({toast:t?t.innerText.replace(/\s+/g,' ').trim().slice(-80):null,nav:!!E('Nav').t})}));
 // 帶路（點地圖上的店）：照舊走到 3.4 公尺內算到
 console.log('nav',await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy'),s=E('SPOT_BY_ID').harbor;me.pos.x=s.pos.x-9;me.pos.z=s.pos.z+2;me.baseY=E('groundHeight')(me.pos.x,me.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;E('navTo')('測試點',s.pos.x,s.pos.z);let f=0,dEnd=null;for(;f<400;f++){const t=E('Nav').t;if(!t){dEnd=+Math.hypot(s.pos.x-me.pos.x,s.pos.z-me.pos.z).toFixed(2);break;}const dx=t.x-me.pos.x,dz=t.z-me.pos.z;cam.yaw=Math.atan2(-dx,-dz);joy.x=0;joy.z=-1;__step(1,50);}joy.z=0;return JSON.stringify({frames:f,arrivedAt:dEnd})}));
 const one=async(tag,setup)=>{lg(tag+' start');
  await p.evaluate(setup);await p.evaluate(()=>{for(let i=0;i<24;i++)__step(1,50)});await go(2);
  const pre=await p.evaluate(()=>{const E=__T.ev,ns=E('nearestSpot')();E('Shore').at=0;const s=E('shoreSpot')();return {near:ns.d<1.7?ns.spot.id:null,shore:s?s.id:null,btn:document.getElementById('act').innerText.replace(/\s+/g,' ').trim()}});
  await p.evaluate(()=>{const T=__T;T.actionDown();for(let i=0;i<22;i++)__step(1,50);T.actionUp();});
  let st=null;for(let i=0;i<60;i++){st=await p.evaluate(()=>{const E=__T.ev,me=E('me'),F=E('F');for(let i=0;i<3;i++)__step(1,50);return {ph:F.phase,bob:me.bobState,bx:me.bobPos.x,bz:me.bobPos.z,spot:F.spot&&F.spot.id}});if(st.bob==='water'||st.ph==='idle')break;}
  const o={pre,cast:st&&{ph:st.ph,bob:st.bob,spot:st.spot},water:await p.evaluate(([x,z])=>__T.ev('waterAt')(x,z),[st.bx,st.bz])};lg('cast done');
  // 等魚的時候：別人看到的我（把我的狀態當成另一個玩家送進來）
  o.peerWait=await p.evaluate(nm=>{const E=__T.ev,me=E('me');const pr=JSON.parse(JSON.stringify(E('presenceObj')()));for(let i=0;i<24;i++){E('applyPeer')({peer:'t_'+nm,kind:'viewer',by:'u_'+nm,presence:pr});__step(1,50);}const q=E('peers').get('t_'+nm);return {f:pr.f,peerBob:q&&q.fisher.bobState,dBob:q?+Math.hypot(q.fisher.bobPos.x-me.bobPos.x,q.fisher.bobPos.z-me.bobPos.z).toFixed(2):null,ph:q&&q.ph}},tag);
  lg('peer done'); await snap(D+'norm_'+tag+'_wait.jpg'); lg('snap done');
  let bite=false;for(let f=0;f<700;f++){const s=await p.evaluate(()=>{const F=__T.ev('F');for(let i=0;i<2;i++)__step(1,50);return F.phase});if(s==='bite'){bite=true;break;}if(s==='idle')break;}
  o.bite=bite;lg('bite '+bite);
  if(bite){o.peerBite=await p.evaluate(nm=>{const E=__T.ev;const pr=JSON.parse(JSON.stringify(E('presenceObj')()));E('applyPeer')({peer:'t_'+nm,kind:'viewer',by:'u_'+nm,presence:pr});const q=E('peers').get('t_'+nm);return [pr.f&&pr.f.ph,q&&q.ph,q&&q.fisher.bobState]},tag);
   await p.evaluate(()=>{__T.actionDown();__step(2,50)});await go(3);
   o.peerReel=await p.evaluate(()=>{const E=__T.ev;const pr=E('presenceObj')();return pr.f&&[pr.f.ph,pr.f.fi,Array.isArray(pr.f.b)]});
   let end=null;for(let k=0;k<500;k++){end=await p.evaluate(k=>{const T=__T,E=T.ev,F=E('F');if(F.phase==='reeling'){if(k>220)F.P=1;if(F.T<0.5)T.actionDown();else T.actionUp();}for(let i=0;i<2;i++)__step(1,50);return {ph:F.phase,fish:F.fish&&F.fish.id}},k);if(end.ph==='result'||end.ph==='idle')break;}
   await go(10);o.end=end;o.card=await p.evaluate(()=>{const c=document.getElementById('catchCard');return c&&!c.hidden?c.innerText.replace(/\s+/g,' ').trim().slice(0,60):null});
   o.inList=await p.evaluate(([id,f])=>{const S=__T.ev('SPOT_BY_ID')[id];return !!(S&&f&&S.fish.includes(f))},[st.spot,end&&end.fish]);
   o.peerAfter=await p.evaluate(()=>{const E=__T.ev;try{E('closeCatch')()}catch(e){};try{E('cancelFishing')()}catch(e){};__step(10,50);const pr=E('presenceObj')();return pr.f||null});}
  console.log('fish',tag,JSON.stringify(o));};
 // 固定釣點：港口外海
 await one('harbor',()=>{const E=__T.ev,me=E('me'),s=E('SPOT_BY_ID').harbor;try{E('cancelFishing')()}catch(e){};me.pos.x=s.pos.x;me.pos.z=s.pos.z;me.baseY=E('groundHeight')(s.pos.x,s.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=Math.atan2(s.dir.x,s.dir.y);E('cam').yaw=me.rot+Math.PI;});
 // 固定釣點：月灣河岸（窄的河，拋過頭的落點要在水裡）
 await one('river',()=>{const E=__T.ev,me=E('me'),s=E('SPOT_BY_ID').river;try{E('cancelFishing')()}catch(e){};try{E('closeCatch')()}catch(e){};me.pos.x=s.pos.x;me.pos.z=s.pos.z;me.baseY=E('groundHeight')(s.pos.x,s.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=Math.atan2(s.dir.x,s.dir.y);E('cam').yaw=me.rot+Math.PI;});
 // 岸邊：找一個離固定釣點遠、面前有水的岸邊
 await one('shore',()=>{const E=__T.ev,me=E('me'),waterAt=E('waterAt'),walkable=E('walkable'),blocked=E('blocked'),SP=E('SPOTS');try{E('cancelFishing')()}catch(e){};try{E('closeCatch')()}catch(e){};let best=null;
  for(let a=0;a<6.28&&!best;a+=0.05)for(let r=20;r<70&&!best;r+=0.5){const x=Math.cos(a)*r,z=Math.sin(a)*r;if(!walkable(x,z)||waterAt(x,z)||blocked(x,z,0.45)||E('deckAt')(x,z))continue;if(SP.some(s=>Math.hypot(s.pos.x-x,s.pos.z-z)<8))continue;for(let k=0;k<16;k++){const b=k/16*6.2832,dx=Math.sin(b),dz=Math.cos(b);if(waterAt(x+dx*1.8,z+dz*1.8)&&waterAt(x+dx*3.3,z+dz*3.3)&&waterAt(x+dx*7,z+dz*7)){best=[x,z,b];break;}}}
  me.pos.x=best[0];me.pos.z=best[1];me.baseY=E('groundHeight')(best[0],best[1]);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=best[2];E('cam').yaw=me.rot+Math.PI;E('Shore').at=0;});
 // 舊島的河：各種力道拋 12 次，浮標都要在水裡
 console.log('rep',await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),F=E('F'),o={n:0,dry:0,idle:0,d:[]};for(const id of ['river','creek','pool','lake'])for(const fr of [5,14,26]){const s=E('SPOT_BY_ID')[id];try{E('closeCatch')()}catch(e){};try{E('cancelFishing')()}catch(e){};me.pos.x=s.pos.x;me.pos.z=s.pos.z;me.baseY=E('groundHeight')(s.pos.x,s.pos.z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=Math.atan2(s.dir.x,s.dir.y);for(let i=0;i<6;i++)__step(1,50);T.actionDown();for(let i=0;i<fr;i++)__step(1,50);T.actionUp();for(let i=0;i<40&&me.bobState!=='water'&&F.phase!=='idle';i++)__step(1,80);o.n++;if(F.phase==='idle'||me.bobState!=='water')o.idle++;else{if(!E('waterAt')(me.bobPos.x,me.bobPos.z))o.dry++;o.d.push(+Math.hypot(me.bobPos.x-me.pos.x,me.bobPos.z-me.pos.z).toFixed(1));}}try{E('cancelFishing')()}catch(e){};return JSON.stringify(o)}));
 console.log('errs',JSON.stringify(errs.slice(0,8))); await b.close(); process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
