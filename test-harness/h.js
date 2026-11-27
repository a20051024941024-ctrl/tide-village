// 測試用：無頭瀏覽器開遊戲。遊戲檔從 repo 直接讀、three.js 從 vendor 讀、雲端全部擋掉（離線模式），時間用假的（__step 一格一格走）
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const S=path.resolve(__dirname,'..')+'/';
const V=S+'vendor/three/';
const R=process.env.REPO||'/home/claude/tide-village/';
const NAMES='THREE scene camera renderer me rec F Rig Env DayNight cam joy keys Jump actionDown actionUp cancelFishing closeCatch SPOT_BY_ID SPOTS FISH_BY_ID npcs peers Cloud DIVE_SITES colliders groundHeight walkable blocked isLand waterAt terrainInfo deckAt nearShop openShop Venue inIndoor applyPeer presenceObj CHAIRS sitDown Quality'.split(' ');
const hook='\n;window.__T={};'+NAMES.map(n=>`try{__T.${n}=${n}}catch(e){}`).join('')+';__T.ev=s=>eval(s);\n';
module.exports=async function open(opts={}){
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await b.newContext({viewport:opts.vp||{width:720,height:405},deviceScaleFactor:opts.dsf||1.5,isMobile:true,hasTouch:true});
 await ctx.route(/^http:\/\/localhost:8131\//,async r=>{let u=decodeURIComponent(new URL(r.request().url()).pathname);if(u==='/')u='/index.html';const f=path.join(R,u);if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});const ext=path.extname(f).toLowerCase();const ct={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.mp3':'audio/mpeg','.mp4':'video/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'}[ext]||'application/octet-stream';return r.fulfill({path:f,contentType:ct});});
 await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.158\.0\/(.*)$/,async r=>{const m=/three@0\.158\.0\/(.*)$/.exec(r.request().url());const f=path.join(V,m[1]);if(fs.existsSync(f))return r.fulfill({path:f,contentType:'application/javascript'});return r.fulfill({status:404,body:''});});
 await ctx.route(/fonts\.(googleapis|gstatic)\.com|supabase|peerjs|unpkg/,r=>r.abort());
 await ctx.route(/localhost:8131\/js\/game\.js/,r=>{const src=fs.readFileSync(process.env.GAMEJS||(R+'js/game.js'),'utf8');const a='\nrequestAnimationFrame(frame);\n',c='placeLabelsUpdate();\n  if (Dive.on)';if(!src.includes(a)||!src.includes(c))console.log('HOOK ANCHOR MISSING');return r.fulfill({body:src.replace(c,'placeLabelsUpdate(); if(window.__landCam) window.__landCam(dt,t);\n  if (Dive.on)').replace(a,'\nrequestAnimationFrame(frame);'+hook),contentType:'application/javascript'});});
 await ctx.addInitScript(({ls})=>{
  for(const k in ls)localStorage.setItem(k,ls[k]);
  let T=performance.now();const q=[];let virt=false;
  const pn=performance.now.bind(performance);performance.now=()=>virt?T:pn();const dn=Date.now.bind(Date);let D0=0,T0=0;Date.now=()=>virt?D0+(T-T0):dn();
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>{if(virt){q.push(cb);return q.length}return raf(t=>cb(virt?T:t))};
  window.__virt=()=>{T=pn();T0=T;D0=dn();virt=true};window.__setDate=d=>{D0=d;T0=T};
  window.__step=(n=1,ms=1000/30)=>{for(let i=0;i<n;i++){T+=ms;const c=q.splice(0);for(const f of c){try{f(T)}catch(e){console.error('raf',e.message,String(e.stack||'').split('\n').slice(1,4).map(x=>x.trim().replace(/http:\/\/localhost:8131\//,'')).join(' | '))}}}};
 },{ls:opts.ls||{}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push((e.stack||e.message).slice(0,400)));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load|ERR_/.test(m.text()))errs.push('c: '+m.text().slice(0,420))});
 await p.goto('http://localhost:8131/#wx=sunny'+(process.env.HASH||''),{timeout:120000});return {b,ctx,p,errs};
};
