// 長頁面左邊分段：點第三段，右邊換成第三段；重開頁面還記得；右邊的按鈕按得到
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:844,height:390},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(20);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 const st=()=>ev("JSON.stringify({cats:document.querySelectorAll('#sheetBody .sidecats .bagcat').length,sel:(document.querySelector('#sheetBody .sidecats .bagcat.sel')||{}).textContent,pane:(document.querySelector('#sheetBody .sidepane .dexhead')||{}).textContent,btns:document.querySelectorAll('#sheetBody .sidepane button').length})");
 for(const t of ['dex','rig2','ach']){await ev(`openSheet('${t}')`);await go(3);const a=await st();await ev("document.querySelectorAll('#sheetBody .sidecats .bagcat')[2].click()");await go(3);const b2=await st();await ev('closeSheet()');await go(2);await ev(`openSheet('${t}')`);await go(3);console.log(t,a,'->',b2,'reopen',await st());}
 await ev("openSheet('dex')");await go(2);await ev("SideNav.dex=null;renderTab()");await go(2);const r2=await ev("(()=>{const b=document.querySelector('#sheetBody .sidepane button');if(!b)return 'none';b.click();return JSON.stringify({sheet:$('#sheet').hidden,nav:Nav.t&&Nav.t.label})})()");console.log('btn',r2);
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
