// 設定頁：按震動、深海驚嚇、音效的開關，看設定有沒有真的改、按鈕字有沒有變
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:844,height:390},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 await ev("openSheet('settings')");await go(5);
 const st=()=>ev("JSON.stringify({vib:LS.get('tide.vib',true),scare:subScareOn(),sound:soundOn,tg:[...document.querySelectorAll('#sheetBody .tgl')].map(b=>b.textContent),cards:[...document.querySelectorAll('#sheetBody .sethead')].map(h=>h.textContent),info:document.querySelectorAll('#sheetBody .setinfo').length})");
 console.log('before',await st());
 for(const lab of ['震動','深海驚嚇效果','音效']){await ev(`[...document.querySelectorAll('#sheetBody .setcard .field')].find(f=>f.querySelector('label').textContent.includes('${lab}')).querySelector('.tgl').click()`);await go(3);}
 console.log('after',await st());
 await ev("document.querySelector('#sheetBody .setinfo').click()");console.log('info open',await ev("document.querySelectorAll('#sheetBody .field.open').length"));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
