// 新主島：小火車在開的時候走到車廂旁邊，看大按鈕會不會變「跳上車」、按了坐不坐得上去；順便量車頭方向一格最多轉幾度
const lib=require('./lib.js');
(async()=>{const r=await lib({vp:{width:960,height:540},dsf:1,ls:{'tide.quality':'"low"','tide.welcomed':'1','tide.ageY':'"1990"','tide.tutDone':'1','tide.guideHide':'true','tide.hintTrain':'1'}});const {p,b,go,errs}=r;
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});await go(12);
 const ev=s=>p.evaluate(s=>__T.ev(s),s);
 for(let i=0;i<40;i++){await go(31);await p.waitForTimeout(400);if(await ev('!!W2'))break;} await go(10);
 // 等到有一班在開、速度 3 以上
 let k=-1;for(let i=0;i<60&&k<0;i++){await go(10);k=await ev("(()=>{const T=W2.train;for(let k=0;k<T.n;k++){const s=T.state(k);if(s&&s.at<0&&s.v>3&&s.v<6.5)return k;}return -1})()");}
 console.log('moving',k);
 // 每格把人放到第 0 號座位旁邊 1.8 公尺
 const put=`(()=>{const T=W2.train,q=T.seat(${k},0);const ox=Math.cos(q.face)*1.8,oz=-Math.sin(q.face)*1.8;me.pos.x=q.x+ox;me.pos.z=q.z+oz;me.baseY=groundHeight(me.pos.x,me.pos.z);me.pos.y=me.baseY;Jump.gy=me.baseY;const s=nearShop();return JSON.stringify({lab:s&&s.label,sub:s&&s.sub,v:T.state(${k}).v.toFixed(1)});})()`;
 let o;for(let i=0;i<3;i++){o=await ev(put);await go(1);} console.log('near',o);
 const sh=await ev(`(()=>{const s=nearShop();if(s&&s.mode==='w2train'){openShop(s);return 'opened';}return 'none'})()`);
 await go(30);
 console.log('board',sh,await ev("JSON.stringify({seat:!!(mySeat&&mySeat.train),k:mySeat&&mySeat.k,hop:!!Ride.hop,sit:me.sitting,d:mySeat?+Math.hypot(me.pos.x-mySeat.x,me.pos.z-mySeat.z).toFixed(2):null})"));
 // 量方向：連續 120 格，車頭每格轉的角度最大多少
 const rot=await ev(`(()=>{return 1})()`);
 let prev=null,maxd=0,maxp=0;for(let i=0;i<120;i++){await go(1);const a=await ev(`JSON.stringify(((T)=>{const q=T.seat(${k},0);return [q.face,q.x,q.z]})(W2.train))`);const v=JSON.parse(a);if(prev){let d=Math.abs(Math.atan2(Math.sin(v[0]-prev[0]),Math.cos(v[0]-prev[0])));maxd=Math.max(maxd,d);maxp=Math.max(maxp,Math.hypot(v[1]-prev[1],v[2]-prev[2]));}prev=v;}
 console.log('smooth',JSON.stringify({maxTurnDegPerFrame:+(maxd*57.3).toFixed(2),maxMovePerFrame:+maxp.toFixed(3)}));
 console.log('errs',JSON.stringify(errs.slice(0,5)));await b.close();process.exit(0)})().catch(e=>{console.log('FAIL',String(e.stack||e).slice(0,600));process.exit(1)});
