// 新主島：自己的小船停在棧橋邊、上得去、划得動、不會划上岸、下得了船
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(20);
 console.log('docks',await ev("JSON.stringify({k:W2.posts.kayak,boats:boats.map(b=>[+b.m.position.x.toFixed(1),+b.m.position.z.toFixed(1),boatWater(b.m.position.x,b.m.position.z)])})"));
 // 走到第一艘旁邊的棧橋上
 await ev("(()=>{const b=boats[0];me.pos.x=b.m.position.x+2.2;me.pos.z=b.m.position.z;me.baseY=groundHeight(me.pos.x,me.pos.z);Jump.gy=me.baseY;})()");await go(10);
 console.log('near',await ev("(()=>{const a=document.getElementById('act');return JSON.stringify({nb:!!nearBoat(),btn:a?a.innerText.replace(/\\s+/g,' '):''})})()"));
 await ev("boardBoat(boats[0])");await go(5);
 // 往南划 6 秒，再往西划 6 秒、往北划 10 秒（往岸邊）
 const row=async(ix,iz,n)=>{for(let i=0;i<n;i++){await ev(`(()=>{cam.yaw=0;updateBoat(1/30,${ix},${iz},1,false);})()`);await go(1);}};
 const pos=()=>ev("JSON.stringify([+me.pos.x.toFixed(1),+me.pos.z.toFixed(1),boatWater(me.pos.x,me.pos.z)])");
 const p0=await pos();await row(0,1,180);const p1=await pos();await row(-1,0,180);const p2=await pos();await row(0,-1,400);const p3=await pos();
 console.log('row',p0,p1,p2,p3);
 await snap(require('path').resolve(__dirname,'..')+'/w2/shot/kayak.jpg',85);
 await ev("leaveBoat()");await go(5);console.log('off',await ev("JSON.stringify({my:!!myBoat,x:+me.pos.x.toFixed(1),z:+me.pos.z.toFixed(1),walk:walkable(me.pos.x,me.pos.z),boat:[+boats[0].m.position.x.toFixed(1),+boats[0].m.position.z.toFixed(1)]})"));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
