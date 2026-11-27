// 新主島：村長看不到，但走到村公所門口一樣跳出跟村長講話的按鈕
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(20);
 await ev("(()=>{const q=questNpcs.find(q=>q.who==='chief');me.pos.x=q.f.pos.x+Math.sin(q.f.rot)*1.6;me.pos.z=q.f.pos.z+Math.cos(q.f.rot)*1.6;me.baseY=groundHeight(me.pos.x,me.pos.z);Jump.gy=me.baseY;})()");await go(20);
 console.log('chief',await ev("(()=>{const q=questNpcs.find(q=>q.who==='chief');const a=document.getElementById('act');return JSON.stringify({vis:q.f.av.g.visible,tag:q.f.tag.style.display,btn:a?a.innerText.replace(/\\s+/g,' '):''})})()"));
 console.log('board',await ev("JSON.stringify(W2.posts.board)"));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
