// 鏡頭慣性：滑鼠快速拖一下放開，看 yaw 放開後還會不會再轉一點、最後停住
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 const y0=await ev('cam.yaw');await p.mouse.move(600,300);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(600-i*25,300);await p.waitForTimeout(16);}await p.mouse.up();
 const y1=await ev('cam.yaw');await go(30);const y2=await ev('cam.yaw');await go(60);const y3=await ev('cam.yaw');
 console.log('inertia',JSON.stringify({drag:+(y1-y0).toFixed(3),after30:+(y2-y1).toFixed(3),after90:+(y3-y2).toFixed(4),vy:await ev('CamIn.vy')}));
 // 慢慢拖、停住再放開：不應該有慣性
 await p.mouse.down();await p.mouse.move(500,300);await go(12);await p.mouse.up();const z1=await ev('cam.yaw');await go(30);console.log('slow',+(await ev('cam.yaw')-z1).toFixed(4));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
