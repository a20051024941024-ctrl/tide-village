// 新主島預覽：釣魚測試（哪裡算水、算哪個釣點；站在各種岸邊真的拋竿、等咬、拉上來；找釣點帶路；別人看得到浮標）
// HASH='&nobb&map2' node w2fish.js   環境變數：PARTS=map,dry,fish,fai,peer,nav,old（預設全部） ONLY=harbor,sea,...  FULL=0 只拋不拉  Q=low|mid|high
const fs=require('fs');const path=require('path');const lib=require('./lib.js');const Q=process.env.Q||'mid';const D=path.resolve(__dirname,'..')+'/w2/fish/';fs.mkdirSync(D,{recursive:true});
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);const FULL=process.env.FULL!=='0';const PARTS=(process.env.PARTS||'map,dry,fish,fai,peer,nav,old').split(',');const has=k=>PARTS.includes(k);
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':JSON.stringify(Q),'tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3}});const {p,b,go,errs,snap}=r;
 const T0=Date.now(),lg=m=>console.log('  t'+((Date.now()-T0)/1000).toFixed(0),m);
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 let ok=false;for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2')){ok=true;break;}}
 if(!ok){console.log('NO W2',JSON.stringify(errs.slice(0,6)));await b.close();process.exit(1);}
 await go(20);
 await p.evaluate(()=>{const T=__T;T.DayNight.fixed=10;for(const e of document.querySelectorAll('#toasts > *'))e.remove();});
 await p.evaluate(lv=>{__T.ev('Env').tideTest=lv;for(let i=0;i<6;i++)__step(1,50)},+(process.env.TIDE||0));
 console.log('wl',await ev(`JSON.stringify({WL:waterSurface.position.y,WATER_LEVEL,cloud:!!Cloud.on,total:rec.total})`));
 const P=(x,y)=>[(x-965)*0.2,(y-505)*0.2];
 const tp=async(lx,lz,rot)=>p.evaluate(([lx,lz,rot])=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),x=W.ox+lx,z=W.oz+lz;try{E('cancelFishing')()}catch(e){};try{E('closeCatch')()}catch(e){};me.pos.x=x;me.pos.z=z;try{W.warm(x,z)}catch(e){};me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;me.rot=rot||0;E('cam').yaw=(rot||0)+Math.PI;E('Shore').at=0;for(let i=0;i<6;i++)__step(1,50);E('Shore').at=0;},[lx,lz,rot]);
 const btn=()=>p.evaluate(()=>{const a=document.getElementById('act');return a?a.innerText.replace(/\s+/g,' ').trim():''});
 // 1) 整座島量一次：每半公尺是水還是地、算哪個釣點；畫成一張圖
 if(has('map')){const map=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),waterAt=E('waterAt'),sid=E('waterSpotId'),isLand=E('isLand'),ti=E('terrainInfo');const X0=-226,X1=218,Z0=-142,Z1=134,S=2,cv=document.createElement('canvas');cv.width=(X1-X0)*S;cv.height=(Z1-Z0)*S;const g=cv.getContext('2d');
   const COL={sea:'#7fd0ee',harbor:'#1c5d8c',river:'#ff9a3c',creek:'#e040fb',lake:'#ffe04a',mangrove:'#3fa85a'};const cnt={},bad=[];let landWater=0,reg={};
   for(let z=Z0;z<Z1;z+=0.5)for(let x=X0;x<X1;x+=0.5){const wx=W.ox+x,wz=W.oz+z,w=waterAt(wx,wz),l=isLand(wx,wz);let c='#d9d2b8';if(w){const id=sid(wx,wz);cnt[id]=(cnt[id]||0)+1;c=COL[id]||'#f00';if(!COL[id])bad.push(id);if(l)landWater++;const q=ti(wx,wz);reg[q.region]=(reg[q.region]||0)+1;}else if(!l)c='#b9c7c9';g.fillStyle=c;g.fillRect((x-X0)*S,(z-Z0)*S,1,1);}
   return {cnt,bad:[...new Set(bad)],landWater,reg,png:cv.toDataURL('image/png')};});
  fs.writeFileSync(D+'map.png',Buffer.from(map.png.split(',')[1],'base64'));console.log('map',JSON.stringify({cnt:map.cnt,bad:map.bad,landWater:map.landWater,reg:map.reg}));lg('map done');}
 // 2) 不該出現「拋竿」的地方：有名字的地點各轉四個方向；再亂數抽 600 個離水 6 公尺以上的點
 if(has('dry')){const spots=JSON.parse(await ev('JSON.stringify(W2.spots.map(s=>[s[0],s[1],s[2]]))'));
  const dry={};for(const [n,lx,lz] of spots){ if(['港口','紅樹林','沙灘','瀑布','森林步道'].includes(n))continue; await tp(lx,lz,0); let any=null;for(const rot of [0,1.57,3.14,4.71]){await p.evaluate(rot=>{const E=__T.ev;E('me').rot=rot;E('Shore').at=0;},rot);const s=await ev('(()=>{const s=shoreSpot();return s?s.id:null})()');if(s)any=s;} dry[n]=any||'-'; }
  await p.evaluate(()=>{for(let i=0;i<24;i++)__step(1,50)});console.log('dry',JSON.stringify(dry),'btn',await btn());
  console.log('dry2',await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),waterAt=E('waterAt'),walkable=E('walkable'),gh=E('groundHeight'),Shore=E('Shore'),shoreSpot=E('shoreSpot');let seed=7;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};const sx=me.pos.x,sz=me.pos.z,sr=me.rot,sb=me.baseY;
   let far=0,farBad=0,nearN=0,nearHit=0;const bad=[];for(let i=0;i<4000&&far<600;i++){const lx=-190+rnd()*376,lz=-108+rnd()*208,x=W.ox+lx,z=W.oz+lz;if(!walkable(x,z)||waterAt(x,z))continue;let wd=99;for(let k=0;k<24;k++){const a=k/24*6.2832;for(let d=0.4;d<=6.4;d+=0.4)if(waterAt(x+Math.sin(a)*d,z+Math.cos(a)*d)){wd=Math.min(wd,d);break;}}
    me.pos.x=x;me.pos.z=z;me.baseY=gh(x,z);me.rot=rnd()*6.2832;Shore.at=0;Shore.x=1e9;const s=shoreSpot();if(wd>6.2){far++;if(s){farBad++;if(bad.length<5)bad.push([+lx.toFixed(1),+lz.toFixed(1),s.id]);}}else if(wd<2.4){nearN++;if(s)nearHit++;}}
   me.pos.x=sx;me.pos.z=sz;me.rot=sr;me.baseY=sb;Shore.at=0;Shore.x=1e9;return JSON.stringify({far,farBad,bad,nearN,nearHit})}));lg('dry done');}
 // 3) 找各種水邊站的位置
 const cand=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),waterAt=E('waterAt'),sid=E('waterSpotId'),walkable=E('walkable'),blocked=E('blocked'),gh=E('groundHeight');const out={};
  for(let lz=-110;lz<104;lz+=1)for(let lx=-194;lx<188;lx+=1){const x=W.ox+lx,z=W.oz+lz;if(!walkable(x,z)||waterAt(x,z)||blocked(x,z,0.45))continue;
   for(let k=0;k<16;k++){const a=k/16*6.2832,dx=Math.sin(a),dz=Math.cos(a);if(waterAt(x+dx*1.8,z+dz*1.8)&&waterAt(x+dx*3.3,z+dz*3.3)){const id=sid(x+dx*1.8,z+dz*1.8);(out[id]=out[id]||[]).push([lx,lz,+a.toFixed(3),+gh(x,z).toFixed(2)]);break;}}}
  return out;});
 console.log('cand',JSON.stringify(Object.fromEntries(Object.entries(cand).map(([k,v])=>[k,v.length]))));
 const near=(L,px,pz)=>L.slice().sort((a,b)=>Math.hypot(a[0]-px,a[1]-pz)-Math.hypot(b[0]-px,b[1]-pz))[0];
 const pick={
  harbor: cand.harbor&&cand.harbor.filter(c=>c[3]>0.6).sort((a,b)=>b[1]-a[1])[0],             // 棧橋走到底
  sea: cand.sea&&near(cand.sea,...P(1490,790)),                                                // 沙灘
  river: cand.river&&near(cand.river,...P(640,318)),                                           // 河邊（橋的西邊）
  creek: cand.creek&&near(cand.creek,...P(770,250)),                                           // 森林裡的溪
  lake: cand.lake&&near(cand.lake,...P(900,225)),                                              // 山上的湖（步道那一側）
  mangrove: cand.mangrove&&near(cand.mangrove.filter(c=>c[3]>0.4),...P(340,398)),              // 紅樹林木棧道上
 };
 console.log('pick',JSON.stringify(pick));
 const castNow=()=>p.evaluate(()=>{const T=__T;T.actionDown();for(let i=0;i<22;i++)__step(1,50);T.actionUp();});
 if(has('fish'))for(const id of ['harbor','sea','river','creek','lake','mangrove']){ if(ONLY.length&&!ONLY.includes(id))continue; const c=pick[id]; if(!c){console.log('fish',id,'NO SPOT');continue;}
  await tp(c[0],c[1],c[2]); await p.evaluate(()=>{for(let i=0;i<24;i++)__step(1,50)}); await go(2);
  const pre=await p.evaluate(()=>{const E=__T.ev;E('Shore').at=0;const s=E('shoreSpot')();return {s:s?s.id:null,dir:s?[+s.dir.x.toFixed(2),+s.dir.y.toFixed(2)]:null,y:+E('me').pos.y.toFixed(2)}});
  const lab=await btn(); await snap(D+id+'_1btn.jpg');
  await castNow();   // 拋竿：按住 1.1 秒放開
  let st=null;for(let i=0;i<60;i++){st=await p.evaluate(()=>{const E=__T.ev,me=E('me'),F=E('F');for(let i=0;i<3;i++)__step(1,50);return {ph:F.phase,bob:me.bobState,bx:me.bobPos.x,bz:me.bobPos.z,spot:F.spot&&F.spot.id,pre:F.pre&&F.pre.id}});if(st.bob==='water'||st.ph==='idle')break;}
  const bobOk=await p.evaluate(([x,z])=>{const E=__T.ev,W=E('W2');return {water:E('waterAt')(x,z),sid:E('waterSpotId')(x,z),d:+Math.hypot(x-E('me').pos.x,z-E('me').pos.z).toFixed(1),l:[+(x-W.ox).toFixed(1),+(z-W.oz).toFixed(1)]}},[st.bx,st.bz]);
  await go(6); await snap(D+id+'_2wait.jpg');
  const o={pre,lab,cast:{ph:st.ph,bob:st.bob,spot:st.spot,fish:st.pre},bobOk};
  if(FULL&&st.ph==='waiting'){
   // 等咬 → 揚竿 → 拉（張力低就按住、高就放開；太久就直接拉滿）
   let bite=false,f=0;for(;f<700;f++){const s=await p.evaluate(()=>{const E=__T.ev,F=E('F');for(let i=0;i<2;i++)__step(1,50);return F.phase});if(s==='bite'){bite=true;break;}if(s==='idle')break;}
   o.bite=bite;o.waitF=f;
   if(bite){await p.evaluate(()=>{__T.actionDown();__step(2,50)});await go(3);await snap(D+id+'_3fight.jpg');
    let end=null;for(let k=0;k<500;k++){end=await p.evaluate(k=>{const T=__T,E=T.ev,F=E('F');if(F.phase==='reeling'){if(k>220)F.P=1;if(F.T<0.5)T.actionDown();else T.actionUp();}for(let i=0;i<2;i++)__step(1,50);return {ph:F.phase,fish:F.fish&&F.fish.id,T:+F.T.toFixed(2),P:+F.P.toFixed(2)}},k);if(end.ph==='result'||end.ph==='idle')break;}
    await go(10);
    o.end=end;o.card=await p.evaluate(()=>{const c=document.getElementById('catchCard');return c&&!c.hidden?c.innerText.replace(/\s+/g,' ').trim().slice(0,90):null});
    o.inList=await p.evaluate(([id,f])=>{const S=__T.ev('SPOT_BY_ID')[id];return !!(S&&f&&S.fish.includes(f))},[id,end&&end.fish]);
    await snap(D+id+'_4card.jpg');
    await p.evaluate(()=>{try{__T.ev('closeCatch')()}catch(e){};try{__T.ev('cancelFishing')()}catch(e){};__step(10,50)});}
  } else await p.evaluate(()=>{try{__T.ev('cancelFishing')()}catch(e){};__step(6,50)});
  console.log('fish',id,JSON.stringify(o));lg(id+' done');
 }
 // 3b) 每一種水邊挑 5 個位置、各用四種力道拋：浮標一定要落在水裡（窄的河以前會落在對岸草地上）
 if(has('rep')){const rep={};for(const id of ['river','creek','mangrove','lake','sea','harbor']){const L=cand[id]||[];const o={n:0,dry:0,idle:0,bad:[]};const NJ=/river|creek|mangrove/.test(id)?4:2;for(let j=0;j<NJ;j++){const c=L[Math.floor((j+0.5)/NJ*L.length)];if(!c)continue;for(const fr of (/river|creek|mangrove/.test(id)?[5,14,26]:[8,24])){await tp(c[0],c[1],c[2]);
    const st=await p.evaluate(fr=>{const T=__T,E=T.ev,me=E('me'),F=E('F'),W=E('W2');T.actionDown();for(let i=0;i<fr;i++)__step(1,50);T.actionUp();for(let i=0;i<40&&me.bobState!=='water'&&F.phase!=='idle';i++)__step(1,80);const r={ph:F.phase,bob:me.bobState,w:E('waterAt')(me.bobPos.x,me.bobPos.z),d:+Math.hypot(me.bobPos.x-me.pos.x,me.bobPos.z-me.pos.z).toFixed(1),l:[+(me.bobPos.x-W.ox).toFixed(1),+(me.bobPos.z-W.oz).toFixed(1)],sp:F.spot&&F.spot.id};try{E('cancelFishing')()}catch(e){};for(let i=0;i<4;i++)__step(1,50);return r},fr);
    o.n++;if(st.ph==='idle'||st.bob!=='water')o.idle++;else if(!st.w){o.dry++;if(o.bad.length<4)o.bad.push([c[0],c[1],fr,st.l,st.d]);}}}rep[id]=o;console.log('rep1',id,JSON.stringify(o));}
  console.log('rep',JSON.stringify(rep));lg('rep done');}
 // 3c) 退潮：海水退掉的那一圈不算水（浮標不會落在露出來的沙上）；露出來的沙可以走上去、在上面拋竿；漲回來會被推回岸上
 if(has('tide')&&pick.sea){const c=pick.sea;const setT=lv=>p.evaluate(lv=>{__T.ev('Env').tideTest=lv;for(let i=0;i<8;i++)__step(1,50)},lv);
  const prof=async lv=>{await setT(lv);await tp(c[0],c[1],c[2]);return p.evaluate(()=>{const E=__T.ev,me=E('me'),W=E('W2'),dx=Math.sin(me.rot),dz=Math.cos(me.rot),U=E('waterSurface').material.uniforms;let first=null,walkTo=0;for(let d=0.2;d<8;d+=0.2){const x=me.pos.x+dx*d,z=me.pos.z+dz*d;if(first==null&&E('waterAt')(x,z))first=+d.toFixed(1);if(E('walkable')(x,z)&&walkTo>=d-0.21)walkTo=+d.toFixed(1);}E('Shore').at=0;const s=E('shoreSpot')();return {tideD:+U.uTideD.value.toFixed(2),up:+U.uTideUp.value.toFixed(2),firstWater:first,walkTo,shore:s?s.id:null}})};
  const o={pick:c,mid:await prof(0),high:await prof(1),low:await prof(-1)};
  // 乾潮：用搖桿往海裡走，走到走不動（應該停在水邊的濕沙上），在那裡拋竿
  await tp(c[0],c[1],c[2]);
  o.walk=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy'),x0=me.pos.x,z0=me.pos.z,r0=me.rot;cam.yaw=r0+Math.PI;joy.x=0;joy.z=-1;for(let i=0;i<120;i++)__step(1,50);joy.z=0;for(let i=0;i<6;i++)__step(1,50);E('Shore').at=0;const s=E('shoreSpot')();return {moved:+Math.hypot(me.pos.x-x0,me.pos.z-z0).toFixed(1),y:+me.pos.y.toFixed(2),dry:E('W2').dry(me.pos.x,me.pos.z),walk:E('walkable')(me.pos.x,me.pos.z),shore:s?s.id:null}});
  // 慢慢走（搖桿只推一點點）也要走得下去：岸邊和濕沙中間不能有一條走不過去的縫；沿著整條海岸抽 40 個點看有沒有縫
  await tp(c[0],c[1],c[2]);
  o.slow=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy'),x0=me.pos.x,z0=me.pos.z;cam.yaw=me.rot+Math.PI;joy.x=0;joy.z=-0.22;for(let i=0;i<400;i++)__step(1,50);joy.z=0;return {moved:+Math.hypot(me.pos.x-x0,me.pos.z-z0).toFixed(1),y:+me.pos.y.toFixed(2),dry:E('W2').dry(me.pos.x,me.pos.z)}});
  o.gap=await p.evaluate(()=>{const E=__T.ev,W=E('W2'),walkable=E('walkable');let n=0,gaps=0,maxGap=0;const bad=[];for(let k=0;k<400&&n<40;k++){const a=k*0.61803*6.2832,r0=40+((k*37)%160);let x=W.ox+Math.sin(a)*r0*0.9,z=W.oz+Math.cos(a)*r0*0.5;if(W.kind(x,z)!==6&&W.kind(x,z)!==4)continue;
    /* 從這個岸邊的點往外找最近的海，沿著那條線每 2 公分量一次 */ let best=null;for(let j=0;j<24;j++){const b=j/24*6.2832;for(let d=0.5;d<9;d+=0.5)if(W.water(x+Math.sin(b)*d,z+Math.cos(b)*d)&&W.spot(x+Math.sin(b)*d,z+Math.cos(b)*d)==='sea'){if(!best||d<best[1])best=[b,d];break;}}if(!best)continue;n++;
    const dx=Math.sin(best[0]),dz=Math.cos(best[0]);let run=0,worst=0,seenDry=false;for(let d=0;d<best[1];d+=0.02){const px=x+dx*d,pz=z+dz*d;if(walkable(px,pz)){if(run>0&&seenDry===false&&W.dry(px,pz)){}run=0;if(W.dry(px,pz))seenDry=true;}else{run+=0.02;worst=Math.max(worst,run);if(!seenDry){}}}
    /* 只算「後面還有可以走的濕沙」的縫 */ let gap=0,cur=0;const flags=[];for(let d=0;d<best[1];d+=0.02)flags.push(walkable(x+dx*d,z+dz*d));const last=flags.lastIndexOf(true);for(let i=0;i<=last;i++){if(!flags[i]){cur+=0.02;gap=Math.max(gap,cur);}else cur=0;}
    if(gap>0.001){gaps++;maxGap=Math.max(maxGap,gap);if(bad.length<4)bad.push([+(x-W.ox).toFixed(1),+(z-W.oz).toFixed(1),+gap.toFixed(2)]);}}
   return {n,gaps,maxGap:+maxGap.toFixed(2),bad}});
  await tp(c[0],c[1],c[2]);await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy');cam.yaw=me.rot+Math.PI;joy.x=0;joy.z=-1;for(let i=0;i<120;i++)__step(1,50);joy.z=0;for(let i=0;i<6;i++)__step(1,50);});
  await p.evaluate(()=>{for(let i=0;i<24;i++)__step(1,50)});await go(2);o.btn=await btn();await snap(D+'tide_low_sand.jpg');
  o.casts=[];for(const fr of [4,12,26]){o.casts.push(await p.evaluate(fr=>{const T=__T,E=T.ev,me=E('me'),F=E('F'),W=E('W2'),U=E('waterSurface').material.uniforms;T.actionDown();for(let i=0;i<fr;i++)__step(1,50);T.actionUp();for(let i=0;i<40&&me.bobState!=='water'&&F.phase!=='idle';i++)__step(1,80);const h=W.tinfo(me.bobPos.x,me.bobPos.z).h;return {ph:F.phase,w:E('waterAt')(me.bobPos.x,me.bobPos.z),depth:+(-h).toFixed(2),wet:-h>U.uTideD.value+0.06,d:+Math.hypot(me.bobPos.x-me.pos.x,me.bobPos.z-me.pos.z).toFixed(1)}},fr));
   if(fr===12){await go(4);await snap(D+'tide_low_cast.jpg');} await p.evaluate(()=>{try{__T.ev('cancelFishing')()}catch(e){};for(let i=0;i<4;i++)__step(1,50)});}
  // 漲回來：站在濕沙上的人要被推回岸上
  const before=await p.evaluate(()=>{const me=__T.ev('me');return [me.pos.x,me.pos.z]});await setT(1);
  o.flood=await p.evaluate(b=>{const E=__T.ev,me=E('me');for(let i=0;i<70;i++)__step(1,50);return {pushed:+Math.hypot(me.pos.x-b[0],me.pos.z-b[1]).toFixed(1),walk:E('walkable')(me.pos.x,me.pos.z),dry:E('W2').dry(me.pos.x,me.pos.z),y:+me.pos.y.toFixed(2)}},before);
  // 乾潮時按「找釣點」：帶到水邊（可能在濕沙上），到了要能拋竿
  await setT(-1);o.nav=[];for(const [nm,lx,lz] of [['活動場地',...P(1112,730)],['主城廣場',...P(975,560)]]){await tp(lx,lz,0);
   const nav=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),me=E('me');E('goFishing')();const t=E('Nav').t;return t?{label:t.label,l:[+(t.x-W.ox).toFixed(1),+(t.z-W.oz).toFixed(1)],d:+Math.hypot(t.x-me.pos.x,t.z-me.pos.z).toFixed(1),dry:W.dry(t.x,t.z)}:null});
   let w=null;if(nav){for(let f=0;f<1500;f++){w=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy'),t=E('Nav').t;if(!t){joy.x=0;joy.z=0;__step(1,50);E('Shore').at=0;const s=E('shoreSpot')();return {done:1,s:s?s.id:null,y:+me.pos.y.toFixed(2)}}const dx=t.x-me.pos.x,dz=t.z-me.pos.z;cam.yaw=Math.atan2(-dx,-dz);joy.x=0;joy.z=-1;__step(1,50);return {d:+Math.hypot(dx,dz).toFixed(1)}});if(w.done)break;}}
   await p.evaluate(()=>{const E=__T.ev;E('joy').z=0;E('Nav').t=null;for(let i=0;i<6;i++)__step(1,50)});o.nav.push([nm,nav,w]);}
  await setT(+(process.env.TIDE||0));
  console.log('tide',JSON.stringify(o));lg('tide done');}
 // 4) 水裡的魚影：站在港口棧橋上一下子，數一數在新主島水裡游的魚
 if(has('fai')&&pick.harbor){await tp(pick.harbor[0],pick.harbor[1],pick.harbor[2]);const fai=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2');for(let i=0;i<400;i++)__step(1,50);const A=E('FAI').agents.filter(a=>!a.dead);return {n:A.length,inW2:A.filter(a=>W.near(a.pos.x,a.pos.z)&&E('waterAt')(a.pos.x,a.pos.z)).length,ids:[...new Set(A.map(a=>a.f.id))].slice(0,8),y:A.slice(0,4).map(a=>+a.pos.y.toFixed(2))}});console.log('fai',JSON.stringify(fai));lg('fai done');}
 // 5) 別人看我釣魚：把我現在的狀態當成另一個玩家送進來，浮標要在新主島；打窩同步給晚到的人
 if(has('peer')&&pick.harbor){await tp(pick.harbor[0],pick.harbor[1],pick.harbor[2]);await castNow();await p.evaluate(()=>{for(let i=0;i<40;i++)__step(1,50);});
  console.log('peer',await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),W=E('W2');const pr=JSON.parse(JSON.stringify(E('presenceObj')()));for(let i=0;i<30;i++){E('applyPeer')({peer:'t_fish',kind:'viewer',by:'u_fish',presence:pr});__step(1,50);}const q=E('peers').get('t_fish');return JSON.stringify({f:pr.f,ph:E('F').phase,fishing:me.fishing,bs:me.bobState,pf:q&&q.fisher.fishing,me:[+(me.pos.x-W.ox).toFixed(1),+(me.pos.z-W.oz).toFixed(1)],peer:q?[+(q.fisher.pos.x-W.ox).toFixed(1),+(q.fisher.pos.z-W.oz).toFixed(1)]:null,myBob:[+(me.bobPos.x-W.ox).toFixed(1),+(me.bobPos.z-W.oz).toFixed(1)],peerBob:q?[+(q.fisher.bobPos.x-W.ox).toFixed(1),+(q.fisher.bobPos.z-W.oz).toFixed(1)]:null,peerBobState:q&&q.fisher.bobState})}));
  await p.evaluate(()=>{try{__T.ev('cancelFishing')()}catch(e){};__step(6,50)});
  console.log('chum',await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),me=E('me'),Z=E('chumZones'),n0=Z.length;E('syncPeerChum')('t_fish',[[me.pos.x,me.pos.z+6,0,Date.now()/1000+90],[0,900,0,Date.now()/1000+90]]);const z=Z[Z.length-1];return JSON.stringify({added:Z.length-n0,at:z?[+(z.x-W.ox).toFixed(1),+(z.z-W.oz).toFixed(1)]:null,inW:E('inWorldXZ')(0,900),inW2:E('inWorldXZ')(W.ox,W.oz),old:E('inWorldXZ')(30,-20)})}));lg('peer done');}
 // 5c) 「找釣點」按鈕：在各個地方按，帶路到最近的水邊；跟著走過去，到了以後要能拋竿
 if(has('nav'))for(const [nm,lx,lz] of [['主城廣場',...P(975,560)],['居民區',...P(482,580)],['森林步道',...P(696,262)],['村公所',...P(965,372)],['遊樂園',...P(1255,372)],['活動場地',...P(1112,730)]]){ await tp(lx,lz,0);
  const nav=await p.evaluate(()=>{const T=__T,E=T.ev,W=E('W2'),me=E('me');E('goFishing')();const t=E('Nav').t;return t?{label:t.label,l:[+(t.x-W.ox).toFixed(1),+(t.z-W.oz).toFixed(1)],d:+Math.hypot(t.x-me.pos.x,t.z-me.pos.z).toFixed(1)}:null});
  if(nm==='主城廣場'){await p.evaluate(()=>{for(let i=0;i<30;i++)__step(1,50)});await go(3);await snap(D+'nav_plaza.jpg');}
  let w=null;if(nav){for(let f=0;f<1500;f++){w=await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),cam=E('cam'),joy=E('joy'),t=E('Nav').t;if(!t){joy.x=0;joy.z=0;__step(1,50);E('Shore').at=0;const s=E('shoreSpot')();return {done:1,s:s?s.id:null}}const dx=t.x-me.pos.x,dz=t.z-me.pos.z;cam.yaw=Math.atan2(-dx,-dz);joy.x=0;joy.z=-1;__step(1,50);return {d:+Math.hypot(dx,dz).toFixed(1)}});if(w.done)break;}}
  await p.evaluate(()=>{const E=__T.ev;E('joy').z=0;E('Nav').t=null;for(let i=0;i<24;i++)__step(1,50)});
  console.log('nav',nm,JSON.stringify(nav),JSON.stringify(w),'btn',await btn());lg('nav '+nm); }
 // 6) 舊島不受影響（同一個 #map2 的畫面裡，舊島的座標）：固定釣點、岸邊；整片指紋
 if(has('old')){console.log('old',await p.evaluate(()=>{const T=__T,E=T.ev,me=E('me'),S=E('SPOT_BY_ID'),o={};for(const id of ['harbor','sea','river','lake']){const s=S[id];o[id]=[E('waterAt')(s.pos.x+s.dir.x*3,s.pos.z+s.dir.y*3),E('waterSpotId')(s.pos.x+s.dir.x*3,s.pos.z+s.dir.y*3)];}o.plaza=E('waterAt')(E('MAP').plaza[0],E('MAP').plaza[1]);return JSON.stringify(o)}));
  console.log('hash',await p.evaluate(()=>{const E=__T.ev,waterAt=E('waterAt'),sid=E('waterSpotId'),ti=E('terrainInfo'),isLand=E('isLand');const Tide=E('Env').tide,lv0=Tide.lv;Tide.lv=0.5;/* 舊島紅樹林的泥灘跟著潮汐露出來，量的時候固定在漲潮，不然每次跑的結果不一樣 */let h=2166136261>>>0,n=0,w=0;const add=v=>{h^=v&255;h=Math.imul(h,16777619)>>>0;h^=(v>>8)&255;h=Math.imul(h,16777619)>>>0};
   for(let z=-210;z<=210;z+=2.5)for(let x=-210;x<=210;x+=2.5){const a=waterAt(x,z),q=ti(x,z);add(a?1:0);add(isLand(x,z)?1:0);add(Math.round((q.h+5)*100));add(q.region|0);add(q.water?1:0);if(a){w++;const s=sid(x,z);for(let i=0;i<s.length;i++)add(s.charCodeAt(i));}n++;}Tide.lv=lv0;return JSON.stringify({h,n,w,lv0:+lv0.toFixed(2)})}));}
 console.log('errs',JSON.stringify(errs.slice(0,8))); await b.close(); process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,900));process.exit(1)});
