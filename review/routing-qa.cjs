const { chromium } = require('/home/jeremex/Desktop/PROJETCS/Yatchslifemaster/node_modules/playwright');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page = await browser.newPage();
 await page.route('**/*', r => new URL(r.request().url()).hostname==='127.0.0.1' ? r.continue() : r.abort());
 // The preview serves actual files and emits HTTP 404 for missing paths.
 let deleted = execFileSync('git',['diff','HEAD','--name-only','--diff-filter=D'],{encoding:'utf8'}).trim();
 if (!deleted) deleted = execFileSync('git',['show','HEAD','--format=','--name-only','--diff-filter=D'],{encoding:'utf8'}).trim();
 const removed = deleted.split('\n').filter(Boolean).map(p=>'/'+p);
 const missing = [...removed,...removed.filter(p=>p.endsWith('.html')).map(p=>p.slice(0,-5)),'/missing-page'];
 for (const path of missing) {
   const response = await page.request.get('http://127.0.0.1:4180'+path);
   assert.equal(response.status(),404,path);
 }
 for (const width of [390,1440]) {
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:4180/404.html');
   assert(await page.locator('h1').isVisible());
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.goto('http://127.0.0.1:4180/');
 assert.deepEqual(await page.locator('#work h3').allTextContents().then(a=>a.map(t=>t.trim())),['Yachts Life Master','Tu Agente Seguro','Metanoia','Covenant','Ocean Majesty Cancún']);
 console.log('PASS: 5 removed/missing URLs return HTTP 404; responsive noindex 404; prioritized project order');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
