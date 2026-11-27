// 每一頁打開，數直接放在頁面裡的段落標題（.dexhead）有幾個、頁面多高；SHOT=1 每頁拍一張
const lib=require('./lib.js');const OUT=require('path').resolve(__dirname,'..')+'/w2/tabs/';require('fs').mkdirSync(OUT,{recursive:true});
(async()=>{const r=await lib({vp:{width:844,height:390},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,snap,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 const tabs=JSON.parse(await ev("JSON.stringify([...new Set(UI_GROUPS.flatMap(g=>g.tabs.map(t=>t[0])).concat(PHONE_APPS.flatMap(g=>g[1].map(a=>a[0]))))])"));
 for(const t of (process.env.TABS?process.env.TABS.split(','):tabs)){try{await ev(`openSheet('${t}')`);await go(4);
  const o=await ev(`(()=>{const b=document.querySelector('#sheetBody');return JSON.stringify({heads:b.querySelectorAll(':scope > .dexhead').length,side:!!b.querySelector('.sidewrap'),h:b.scrollHeight,cur:curTab})})()`);console.log(t,o);
  if(process.env.SHOT){await snap(OUT+t+'.jpg',80);}
 }catch(e){console.log(t,'ERR',String(e).slice(0,120));}}
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
