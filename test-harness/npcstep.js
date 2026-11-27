// 村民散步有沒有平移／瞬移：每一格每個村民移動多少（一般模式的舊村子，或 #map2 的新主島）
// HASH='&nobb' node npcstep.js      AT='x,z'：人站哪裡（預設村子的潮汐廣場）  CH=12：幾段（一段 150 格、7.5 秒）  F0=520：先空跑到第幾格（散步要第 500 格以後才開始算）
const lib=require('./lib.js');
const K3=JSON.stringify({on:true,sex:'b',hair:'short',top:'tee',bot:'shorts',shoes:'sneak',mask:'none',ear:'none',hat:'none',eye:'b2',brow:'thick',mouth:'smile',blush:'line',c:{},v:2});
(async()=>{const r=await lib({vp:{width:640,height:360},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.k3':K3,'tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 if(/map2/.test(process.env.HASH||'')){for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;}}
 await go(30);
 const at=(process.env.AT||'0,8').split(',').map(Number);
 await p.evaluate(([x,z])=>{const E=__T.ev,me=E('me');if(isFinite(x)){me.pos.x=x;me.pos.z=z;me.baseY=E('groundHeight')(x,z);me.pos.y=me.baseY;E('Jump').gy=me.baseY;}window.__ns={};for(const n of E('npcs'))__ns[n.npcName]={x:n.pos.x,z:n.pos.z,max:0,snap:0,hurry:0,walk:0,slide:0};},at);
 // 先空跑（不記錄）到散步開始算的時候，之後才記
 const F0=+(process.env.F0||520);for(let g=0;g<40;g++){const f=await p.evaluate(F0=>{const E=__T.ev;for(let i=0;i<100&&E('frameNo')<F0;i++)__step(1,50);for(const n of E('npcs')){const s=__ns[n.npcName];s.x=n.pos.x;s.z=n.pos.z;}return E('frameNo')},F0);if(f>=F0)break;await p.waitForTimeout(40);}
 for(let g=0;g<+(process.env.CH||12);g++){await p.evaluate(()=>{const E=__T.ev;for(let i=0;i<150;i++){__step(1,50);for(const n of E('npcs')){const s=__ns[n.npcName],d=Math.hypot(n.pos.x-s.x,n.pos.z-s.z);if(d>3)s.snap++;else{if(d>s.max)s.max=d;if(d>0.02){s.walk++;if(!(n.speed>0.05)&&!n.aspd)s.slide++;}}if(n.speed>2.3&&n.speed<2.5)s.hurry++;s.x=n.pos.x;s.z=n.pos.z;}}});await p.waitForTimeout(40);}
 const out=await p.evaluate(()=>{const o={};for(const k in __ns){const s=__ns[k];if(s.walk||s.snap)o[k.split('・')[0]]=[+s.max.toFixed(3),s.snap,s.hurry,s.walk,s.slide];}return o});
 console.log('step [最大一步, 瞬移次數, 小跑格數, 有在動的格數, 沒走路動作卻在動的格數]',JSON.stringify(out));
 console.log('lost',await p.evaluate(()=>__T.ev('renderer').getContext().isContextLost()),'frame',await ev('frameNo'));
 console.log('errs',JSON.stringify(errs.slice(0,4)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
