const open=require('./h.js');
module.exports=async(o={})=>{const r=await open(o);const p=r.p;await p.waitForTimeout(9000);
 await p.evaluate(()=>{for(const e of document.querySelectorAll('button,a,span'))if(e.textContent.trim()==='知道了')e.click();
  const T=__T;try{T.rec.coins=12800;T.rec.dive=[...new Set(Object.values(T.DIVE_SITES).flatMap(s=>s.need).concat(['dive_suit']))];}catch(e){}__virt();const st=document.createElement('style');st.textContent='body.clean #top,body.clean #menu,body.clean #joyZone,body.clean #joy,body.clean #emotes,body.clean #actWrap,body.clean #chat,body.clean #ticker,body.clean #spotCard,body.clean #hint,body.clean #labels,body.clean #toasts,body.clean #chatToggle,body.clean #showBtn,body.clean #isleBar,body.clean #diveHud,body.clean #diveDn,body.clean #chargeHud,body.clean #bigMsg,body.clean #w2nav,body.clean #guideCard{opacity:0!important;pointer-events:none}';document.head.appendChild(st);});
 r.st=async n=>{await p.evaluate(n=>__step(n),n)};
 r.go=async(n=40)=>{for(let i=0;i<n;i++){await p.evaluate(()=>__step(1));await p.waitForTimeout(60);}};
 // 截圖：時間是假的，瀏覽器截圖前會等兩格畫面，所以截圖的同時要一直推進畫面，不然會卡住
 r.snap=async(f,q)=>{let done=false;const pr=p.screenshot({path:f,type:'jpeg',quality:q||88,timeout:60000}).finally(()=>{done=true});pr.catch(()=>{});while(!done){await p.evaluate(()=>__step(1,1)).catch(()=>{});await p.waitForTimeout(70);}return pr;};
 r.shot=r.snap;
 return r;};
