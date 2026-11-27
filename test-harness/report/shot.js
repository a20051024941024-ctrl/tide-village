const {chromium}=require('playwright');const path=require('path');
(async()=>{const [,, html, out, w]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+(w||1920),height:1000},deviceScaleFactor:1});
 await p.goto('file://'+path.resolve(html));await p.waitForTimeout(600);await p.screenshot({path:out,type:'jpeg',quality:90,fullPage:true});await b.close();console.log('ok',out)})().catch(e=>{console.log('FAIL',e.message);process.exit(1)});
