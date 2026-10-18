// Fresh owned profile/native IDB. Controlled reader, real complete Web snapshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,relative} from 'node:path';
import {startBrowserTestServer} from './browser_test_server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const largeOrdinal=process.argv.includes('--large-ordinal');
assert.ok(process.argv.slice(2).every(arg=>arg==='--large-ordinal'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const parent='.dragon-analysis/release-readiness';await mkdir(parent,{recursive:true});const artifact=await mkdtemp(join(parent,'player-restore-browser-'));
const server=await startBrowserTestServer();let browser;const errors=[],failed=[],forbidden=[],sources={};let checks=0;
try{
 const origin=`http://127.0.0.1:${server.port}`,files=new Map();
 for(const name of ['player-restore-browser.mjs','formal-app-browser.mjs']){const path='tools/fixtures/'+name,body=await readFile(path);files.set('/__owned-fixtures/'+name,body);sources[path]=sha(body);}
 let html=await readFile('web/index.html','utf8');sources['web/index.html']=sha(html);
 const anchor='<script type="module" src="src/boot.js"></script>';assert.equal(html.split(anchor).length,2);
 html=html.replace(anchor,'<script type="module" src="/__owned-fixtures/player-restore-browser.mjs"></script>');
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'});
 await context.addInitScript(()=>{const open=indexedDB.open.bind(indexedDB);window.__ownedDatabases=[];indexedDB.open=(name,...args)=>{if(name!=='owned-formal-app')throw new Error('non-owned IDB forbidden');window.__ownedDatabases.push(name);return open(name,...args);};});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==origin||/\/api\/|save\.dat|\.dragon-runtime|\/reader\/|\/web\/src\//i.test(u.pathname)){forbidden.push(u.origin===origin?u.pathname:'outside');return route.abort();}
  if(u.pathname==='/index.html')return route.fulfill({contentType:'text/html',body:html});
  if(files.has(u.pathname))return route.fulfill({contentType:'text/javascript',body:files.get(u.pathname)});
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(m.text());});
 page.on('requestfailed',r=>failed.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
 await page.goto(origin+'/index.html'+(largeOrdinal?'?large=1':''));await page.waitForFunction(()=>window.__restore?.ready);
 const root=page.locator('.player-restore'),row=page.locator('[data-save-slot="0"]');
 async function mount(){await page.evaluate(()=>window.__restore.mount());await root.getByRole('button',{name:'重新檢查',exact:true}).waitFor();}
 async function reset(){await page.evaluate(()=>window.__restore.reset());}
 const invalid=await page.evaluate(()=>{const before=window.__ownedDatabases.length;return{count:window.__restore.bad(),unchanged:window.__ownedDatabases.length===before,dialogs:document.querySelectorAll('.player-restore').length};});
 assert.deepEqual(invalid,{count:7,unchanged:true,dialogs:0});checks++;
 await page.evaluate(()=>window.__restore.seed(10,{releaseId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}));
 if(largeOrdinal){
  await page.evaluate(()=>window.__restore.seed(11,{releaseOrdinal:'9007199254740992'}));
 }
 const before=await page.evaluate(()=>window.__restore.before());await mount();
 if(largeOrdinal){
  assert.equal(before.find(row=>row.slot===0).releaseOrdinal,'9007199254740993');
  assert.equal(await page.locator('[data-unavailable-slot="11"]').count(),1);
  assert.equal(await page.evaluate(()=>window.__restore.gets.includes(11)),false);checks++;
 }
 assert.equal(await row.count(),1);assert.equal(await page.locator('[data-unavailable-slot="10"]').count(),1);
 assert.equal(await row.locator('img').count(),0);assert.match(await row.textContent(),/<img src=x/);
 assert.equal(await page.evaluate(()=>window.__restore.gets.includes(10)),false);checks++;
 await page.locator('[data-unavailable-slot="10"]').hover();await page.locator('[data-unavailable-slot="10"]').click();
 assert.equal(await page.evaluate(()=>window.__restore.settled||window.__restore.gets.includes(10)),false);assert.deepEqual(await page.evaluate(()=>window.__restore.before()),before);checks++;
 await root.getByRole('button',{name:'不可用存檔說明',exact:true}).click();assert.match(await root.textContent(),/不會刪除任何存檔/);
 assert.equal(await root.locator('[data-save-slot]').count(),0);await root.click({button:'right'});
 assert.equal(await row.count(),1);assert.deepEqual(await page.evaluate(()=>window.__restore.before()),before);checks++;
 await page.screenshot({path:join(artifact,'choices.png')});
 await row.click();await page.waitForFunction(()=>window.__restore.settled);
 const transferred=await page.evaluate(async()=>{const c=window.__restore,v=c.chosen;c.view.close();const snapshot=await v.saveRepository.load();let consumed=false;try{await v.saveRepository.load();}catch{consumed=true;}return{slot:v.savedSlot,player:v.environment.player,label:snapshot.slots.find(r=>r.slot===0).label,active:v.session.state(),consumed,unchanged:await c.before()};});
 assert.equal(transferred.slot,0);assert.equal(transferred.label,'<img src=x onerror=alert(1)>');assert.equal(transferred.active,'active');assert.equal(transferred.consumed,true);assert.deepEqual(transferred.unchanged,before);checks++;
 await reset();await page.evaluate(()=>window.__restore.seed(4));await mount();await page.locator('[data-save-slot="4"]').click();await page.waitForFunction(()=>window.__restore.settled);
 const nonfirst=await page.evaluate(async()=>{const v=window.__restore.chosen;return{slot:v.savedSlot,slots:(await v.saveRepository.load()).slots.filter(s=>s.played).map(s=>s.slot)};});
 assert.deepEqual(nonfirst,{slot:4,slots:[0,4]});checks++;
 await reset();await mount();await page.evaluate(()=>window.__restore.seed());const replaced=await page.evaluate(()=>window.__restore.before());await row.click();
 await root.getByRole('button',{name:'重試',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__restore.settled),false);assert.deepEqual(await page.evaluate(()=>window.__restore.before()),replaced);checks++;
 await reset();await page.evaluate(()=>window.__restore.seed(1,{snapshot:{slot:1,played:true,scenario_idx:0,state:{player_faction:0}}}));await mount();
 assert.equal(await page.locator('[data-save-slot]').count(),0);assert.equal(await page.locator('[data-unavailable-slot]').count(),2);checks++;
 await reset();await page.evaluate(()=>{window.__restore.staticFailure=true;});const staticBefore=await page.evaluate(()=>window.__restore.before());await mount();
 assert.equal(await row.count(),0);assert.deepEqual(await page.evaluate(()=>window.__restore.before()),staticBefore);
 await page.evaluate(()=>{window.__restore.staticFailure=false;});await root.getByRole('button',{name:'重新檢查',exact:true}).click();await row.waitFor();checks++;
 await reset();await page.evaluate(()=>window.__restore.empty());await mount();assert.match(await root.textContent(),/目前沒有本機存檔/);assert.equal(await row.count(),0);checks++;
 await reset();await page.evaluate(()=>{const c=window.__restore;c.hold=true;c.mount();});await page.waitForFunction(()=>!!window.__restore.release);
 const readsBeforeCancel=await page.evaluate(()=>window.__ownedDatabases.length);await root.click({button:'right'});await page.evaluate(()=>{window.__restore.hold=false;window.__restore.release();});
 await page.waitForFunction(()=>window.__restore.settled&&window.__restore.sessions.every(s=>s.state()==='closed'));
 assert.equal(await page.evaluate(()=>window.__ownedDatabases.length),readsBeforeCancel);assert.equal(await root.count(),0);checks++;
 await reset();await mount();await page.evaluate(()=>{window.__restore.hold=true;});await row.click();await page.waitForFunction(()=>!!window.__restore.release);
 await root.click({button:'right'});await page.evaluate(()=>{window.__restore.hold=false;window.__restore.release();});
 await row.waitFor();await page.waitForFunction(()=>window.__restore.sessions.every(s=>s.state()==='closed'));assert.equal(await page.evaluate(()=>window.__restore.settled),false);checks++;
 await page.evaluate(()=>{window.__restore.changed=true;});await row.click();await root.getByRole('button',{name:'重試',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__restore.chosen),null);checks++;
 await reset();await mount();await page.evaluate(()=>{window.__restore.holdGet=true;});await row.click();await page.waitForFunction(()=>!!window.__restore.releaseGet);
 await root.click({button:'right'});await page.evaluate(()=>{window.__restore.holdGet=false;window.__restore.releaseGet();});await row.waitFor();
 await page.waitForFunction(()=>window.__restore.sessions.every(s=>s.state()==='closed'));assert.equal(await page.evaluate(()=>window.__restore.settled),false);checks++;
 await reset();await mount();await root.focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'重新檢查');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.saveSlot),'0');checks++;
 await root.click({button:'right'});await page.waitForFunction(()=>window.__restore.settled);assert.equal(await page.evaluate(()=>window.__restore.chosen),null);checks++;
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(forbidden,[]);assert.ok(await page.evaluate(()=>window.__ownedDatabases.every(name=>name==='owned-formal-app')));checks++;
 for(const path of ['web/src/player/playerrestore.js','web/src/player/playerrepository.js'])sources[path]=sha(await readFile(path));
 await writeFile(join(artifact,'result.json'),JSON.stringify({checks,largeOrdinal,invalid,transferred,errors,failed,forbidden,sources,screenshotSHA:sha(await readFile(join(artifact,'choices.png'))),scope:'Actual complete Web snapshots/native owned IDB/real preflight and chooser; controlled reader ports, no signed admission, production bootstrap or deletion authorization.'},null,2));
 process.stdout.write(JSON.stringify({checks,artifact:relative('.',artifact)})+'\n');
}catch(error){await writeFile(join(artifact,'failure.json'),JSON.stringify({error:String(error),errors,failed,forbidden},null,2));throw error;}
finally{await browser?.close();await server.close();}
