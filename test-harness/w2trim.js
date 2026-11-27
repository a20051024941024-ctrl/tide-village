const lib=require('./lib.js');
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:Object.assign({'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.hintTrain':'1','tide.guideHide':'true'},process.env.NOK3?{}:{'tide.k3':K3})});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;}
 await go(30);
 const step=async(nm,code)=>{const n0=errs.length;const out=await p.evaluate(code);const g=await p.evaluate(()=>{const E=__T.ev,R=E('renderer');return [E('frameNo'),R.info.programs.length,R.getContext().isContextLost(),R.info.memory.geometries,R.info.memory.textures,R.info.render.calls,R.info.render.triangles]});console.log(nm,JSON.stringify(out),'gl',JSON.stringify(g),'newErrs',errs.length-n0,errs.slice(n0).map(e=>e.slice(0,90)));};
 await p.evaluate(()=>{window.__tp=(x,z)=>{const E=__T.ev,me=E('me');me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;}});
 if(process.env.FIX)await p.evaluate(()=>{__T.DayNight.fixed=10;__T.ev('Env').tideTest=0;});
 if(process.env.WARM)await p.evaluate(()=>{const tp0=window.__tp;window.__tp=(x,z)=>{try{__T.ev('W2').warm(x,z)}catch(e){};tp0(x,z);}});
 await step('toVillage',()=>{__tp(0,8);__T.ev('me').rot=0;__T.ev('cam').yaw=Math.PI;for(let i=0;i<40;i++)__step(1,50);return [__T.ev('frameNo'),__T.ev('typeof W2S!=="undefined"&&W2S.on')]});
 await step('board',()=>{const B=__T.ev('BOARD');__tp(B.x+Math.sin(B.rot)*1.6,B.z+Math.cos(B.rot)*1.6);const me=__T.ev('me');me.rot=B.rot+Math.PI;__T.ev('cam').yaw=B.rot+2*Math.PI;for(let i=0;i<30;i++)__step(1,50);return __T.ev('nearShop')().mode});
 await step('orders',()=>{const B=__T.ev('ORDB');__tp(B.x+Math.sin(B.rot)*1.6,B.z+Math.cos(B.rot)*1.6);const me=__T.ev('me');me.rot=B.rot+Math.PI;__T.ev('cam').yaw=B.rot+2*Math.PI;for(let i=0;i<30;i++)__step(1,50);return __T.ev('nearShop')().mode});
 await step('wait30',()=>{for(let i=0;i<600;i++)__step(1,50);return 1});
 await step('toW2',()=>{const W=__T.ev('W2');__tp(W.spawn[0],W.spawn[1]);__T.ev('me').rot=Math.PI;__T.ev('cam').yaw=2*Math.PI;for(let i=0;i<40;i++)__step(1,50);return __T.ev('typeof W2S!=="undefined"&&W2S.on')});
 await step('toVillage2',()=>{__tp(0,8);__T.ev('me').rot=0;__T.ev('cam').yaw=Math.PI;for(let i=0;i<40;i++)__step(1,50);return 1});
 for(let k=0;k<5;k++){await step('v'+k,()=>{__tp(0,8);__T.ev('me').rot=0;__T.ev('cam').yaw=Math.PI;for(let i=0;i<30;i++)__step(1,50);return 1});await step('w'+k,()=>{const W=__T.ev('W2');__tp(W.spawn[0],W.spawn[1]);__T.ev('me').rot=Math.PI;__T.ev('cam').yaw=2*Math.PI;for(let i=0;i<30;i++)__step(1,50);return 1});}
 console.log('lost',await p.evaluate(()=>__T.ev('renderer').getContext().isContextLost()),'progs',await p.evaluate(()=>__T.ev('renderer').info.programs.length),'mem',JSON.stringify(await p.evaluate(()=>__T.ev('renderer').info.memory)));
 console.log('errs',JSON.stringify(errs.slice(0,3)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
