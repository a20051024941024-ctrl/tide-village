const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:640,height:360},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 if(!process.env.NOW2)for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} else await go(60);
 console.log(await ev(process.env.CODE));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
