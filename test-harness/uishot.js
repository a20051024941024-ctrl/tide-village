// 打開某一頁拍一張：SHEET=settings OUT=檔名 VW VH；CODE= 打開前先跑
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:+(process.env.VW||844),height:+(process.env.VH||390)},dsf:2,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 if(process.env.CODE) await ev(process.env.CODE);
 await ev(`openSheet('${process.env.SHEET||'settings'}')`);await go(10);await p.waitForTimeout(500);await go(4);
 if(process.env.CLICK) await ev(process.env.CLICK);
 await go(4);await snap(process.env.OUT||'ui.jpg',88);
 if(process.env.SCROLL){await p.evaluate(()=>{const b=document.querySelector('#sheetBody');if(b)b.scrollTop=b.scrollHeight;});await go(4);await snap((process.env.OUT||'ui.jpg').replace('.jpg','_2.jpg'),88);}
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
