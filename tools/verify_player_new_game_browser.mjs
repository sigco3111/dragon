import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startBrowserTestServer} from './browser_test_server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir('.dragon-analysis/release-readiness',{recursive:true});const artifact=await mkdtemp('.dragon-analysis/release-readiness/player-new-game-browser-');
const server=await startBrowserTestServer(),origin=`http://127.0.0.1:${server.port}`;
let browser,checks=0;const errors=[],failed=[],forbidden=[],sources={};
try{
 const fixturePath='tools/fixtures/player-new-game-browser.mjs',fixture=await readFile(fixturePath);sources[fixturePath]=sha(fixture);
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(systemroot|windir|path|pathext|temp|tmp|comspec|appdata|localappdata)$/i.test(k)));
 browser=await chromium.launch({headless:true,env});const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__idb=0;indexedDB.open=()=>{window.__idb++;throw new Error('storage forbidden');};});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin||/save\.dat|\/api\/|\/play-api\//i.test(u.pathname)){forbidden.push(u.pathname);return route.abort();}
  if(u.pathname==='/__owned-new-game')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><main id="owned"></main>'});
  if(u.pathname==='/__owned-fixture.mjs')return route.fulfill({contentType:'text/javascript',body:fixture});
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));
 async function setup(options={}){assert.equal(await page.evaluate(()=>window.__idb??0),0);await page.goto(origin+'/__owned-new-game');return page.evaluate(async options=>(await import('/__owned-fixture.mjs')).setup(options),options);}
 const chapter=()=>page.locator('[data-chapter-id]'),faction=()=>page.locator('[data-faction-slot]'),dialog=()=>page.getByRole('dialog',{name:'正式新局'});
 const ready=()=>chapter().first().waitFor();
 await setup();await ready();
 assert.equal(await page.evaluate(async()=>{const {mountPlayerNewGame}=await import('/src/player/playernewgame.js'),c=window.__choice;let n=0;for(const key of['root','reader','compilerRevision','maxTotalBytes','readStatic'])try{mountPlayerNewGame({...c.config,[key]:null});}catch{n++;}return n;}),5);assert.equal(await dialog().count(),1);checks++;
 assert.equal(await chapter().count(),2);assert.match(await chapter().first().textContent(),/<b>第一章<\/b>/);assert.equal(await page.locator('.player-new-game b,.player-new-game img').count(),0);
 assert.deepEqual(await page.evaluate(()=>({closed:window.__choice.sessions.map(s=>s.state),settled:window.__choice.settled,urls:window.__choice.urls.length})),{closed:['closed','closed'],settled:false,urls:0});checks++;
 await chapter().nth(1).click();await faction().first().waitFor();assert.deepEqual(await faction().evaluateAll(nodes=>nodes.map(n=>n.dataset.factionSlot)),['3','7']);assert.equal(await page.evaluate(()=>window.__choice.settled),false);checks++;
 await dialog().focus();await page.keyboard.press('Shift+Tab');assert.equal(await faction().nth(1).evaluate(node=>node===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await faction().first().evaluate(node=>node===document.activeElement),true);checks++;
 await page.screenshot({path:join(artifact,'factions.png')});
 await faction().nth(1).click();await page.waitForFunction(()=>window.__choice.settled);
 assert.deepEqual(await page.evaluate(()=>{const c=window.__choice;return{slot:c.selected.playerFaction,chapter:c.selected.pack.identity.chapterId.endsWith('#two'),state:c.selected.session.state(),urls:c.urls.length,revoked:c.revoked.length,rows:c.selected.chapters.length};}),{slot:7,chapter:true,state:'active',urls:14,revoked:0,rows:2});checks++;
 assert.equal(await page.evaluate(()=>{const c=window.__choice;c.view.close();c.view.close();return c.selected.session.state();}),'active');await page.evaluate(()=>{window.__choice.selected.pack.close();window.__choice.selected.session.close();});assert.equal(await page.evaluate(()=>window.__choice.revoked.length),14);checks++;
 await setup();await ready();await chapter().first().click();await faction().first().waitFor();await dialog().click({button:'right'});await ready();
 assert.deepEqual(await page.evaluate(()=>({urls:window.__choice.urls.length,revoked:window.__choice.revoked.length,state:window.__choice.sessions.at(-1).state,settled:window.__choice.settled})),{urls:14,revoked:14,state:'closed',settled:false});
 await chapter().nth(1).click();await faction().first().waitFor();await faction().first().click();assert.equal(await page.evaluate(()=>window.__choice.selected.playerFaction),3);await page.evaluate(()=>{window.__choice.selected.pack.close();window.__choice.selected.session.close();});checks++;
 await setup();await ready();await dialog().click({button:'right'});assert.equal(await page.evaluate(()=>window.__choice.selected),null);assert.equal(await dialog().count(),0);checks++;
 for(const hold of['admit','status']){
  await setup({hold});await page.waitForFunction(()=>window.__choice.entered);await dialog().click({button:'right'});await page.evaluate(()=>window.__choice.release());
  await page.waitForFunction(()=>window.__choice.sessions.every(s=>s.state==='closed'));
  assert.deepEqual(await page.evaluate(()=>({settled:window.__choice.settled,result:window.__choice.selected,urls:window.__choice.urls.length})),{settled:true,result:null,urls:0});assert.equal(await dialog().count(),0);checks++;
 }
 for(const hold of['manifest','static']){
  await setup();await ready();await page.evaluate(hold=>{window.__choice.options.hold=hold;},hold);await chapter().first().click();await page.waitForFunction(()=>window.__choice.entered);
  await dialog().click({button:'right'});await ready();await page.evaluate(()=>{window.__choice.options.hold=null;window.__choice.release();});
  await chapter().nth(1).click();await faction().first().waitFor();assert.equal(await page.evaluate(()=>window.__choice.settled),false);
  await faction().nth(1).click();assert.equal(await page.evaluate(()=>window.__choice.selected.pack.identity.chapterId.endsWith('#two')),true);
  await page.evaluate(()=>{window.__choice.selected.pack.close();window.__choice.selected.session.close();});assert.equal(await page.evaluate(()=>window.__choice.urls.length===window.__choice.revoked.length),true);checks++;
 }
 await setup();await ready();await page.evaluate(()=>{window.__choice.options.changed=true;window.__choice.selection.ordinal='1.99';});await chapter().first().click();await page.getByRole('button',{name:'重試',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__choice.settled),false);assert.equal(await page.evaluate(()=>window.__choice.urls.length),0);
 await page.evaluate(()=>{window.__choice.options.changed=false;window.__choice.selection.ordinal='1.0';});await page.getByRole('button',{name:'重試',exact:true}).click();await ready();checks++;
 await page.evaluate(()=>{window.__choice.options.failRole='manifest';});await chapter().first().click();await page.getByRole('button',{name:'重試',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__choice.sessions.at(-1).state),'closed');assert.equal(await page.evaluate(()=>window.__choice.selected),null);checks++;
 await setup();await ready();await chapter().first().click();await faction().first().waitFor();await page.evaluate(()=>{window.__choice.sessions.at(-1).state='deleted';});await faction().first().click();await page.getByRole('button',{name:'重試',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__choice.settled),false);assert.equal(await page.evaluate(()=>window.__choice.urls.length===window.__choice.revoked.length),true);checks++;
 await page.evaluate(()=>window.__choice.view.close());
 for(const factions of [[],[{idx:3,monarch:'甲'},{idx:3,monarch:'乙'}],[{idx:-1,monarch:'甲'}],[{idx:0.5,monarch:'甲'}]]){
  await setup({factions});await ready();await chapter().first().click();await page.getByRole('button',{name:'重試',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__choice.settled),false);assert.equal(await faction().count(),0);assert.equal(await page.evaluate(()=>window.__choice.urls.length===window.__choice.revoked.length),true);
  await page.evaluate(()=>window.__choice.view.close());checks++;
 }
 assert.equal(await page.evaluate(()=>window.__idb),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(forbidden,[]);checks++;
 for(const path of['web/src/player/playernewgame.js','web/src/player/playerchapters.js','web/src/player/playerpack.js','web/src/player/playerclient.js','web/src/player/runtimecontract.js'])sources[path]=sha(await readFile(path));
 const report={checks,errors,failed,forbidden,sources,screenshotSHA:sha(await readFile(join(artifact,'factions.png'))),scope:'Actual DOM chooser and real chapter/pack adapters with owned opaque byte ports and native Blob URLs; no engine, signed reader, storage or production boot.'};
 await writeFile(join(artifact,'result.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify({checks,artifact})+'\n');
}catch(error){await writeFile(join(artifact,'failure.json'),JSON.stringify({error:String(error),errors,failed,forbidden},null,2));throw error;}
finally{await browser?.close();await server.close();}
