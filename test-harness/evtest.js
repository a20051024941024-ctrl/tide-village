// 活動頁：卡片數、點卡片換右邊、分頁切換、帶我去、打開任務
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:844,height:390},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 await ev("openSheet('events')");await go(4);
 const st=()=>ev("JSON.stringify({cards:[...document.querySelectorAll('#sheetBody .evcard .evt')].map(x=>x.textContent),sel:(document.querySelector('#sheetBody .evbt')||{}).textContent,go:(document.querySelector('#sheetBody .evgo')||{}).textContent||null,tab:curTab})");
 console.log('a',await st());
 await ev("[...document.querySelectorAll('#sheetBody .evcard')].find(c=>c.textContent.includes('全服大魚')).click()");await go(2);console.log('b',await st());
 await ev("document.querySelector('#sheetBody .evgo').click()");await go(2);console.log('nav',await ev("JSON.stringify(Nav.t&&{l:Nav.t.label})"),await ev("$('#sheet').hidden"));
 await ev("openSheet('events')");await go(2);await ev("[...document.querySelectorAll('#sheetBody .evtab')][1].click()");await go(2);console.log('c',await st());
 await ev("[...document.querySelectorAll('#sheetBody .evcard')].find(c=>c.textContent.includes('每日任務')).click()");await go(2);await ev("document.querySelector('#sheetBody .evgo').click()");await go(3);console.log('quest',await ev('curTab'));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
