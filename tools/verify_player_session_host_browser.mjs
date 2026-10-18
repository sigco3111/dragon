// Owned browser/DOM and explicit lifetime ports. Actual reader/App joint proof
// remains verify_publication_chain_browser --player-client --player-app.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startBrowserTestServer} from './browser_test_server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir('.dragon-analysis/release-readiness',{recursive:true});const artifact=await mkdtemp('.dragon-analysis/release-readiness/player-session-host-browser-');
const server=await startBrowserTestServer(),origin=`http://127.0.0.1:${server.port}`;
let browser,checks=0,initialVisits=0;const errors=[],failed=[],forbidden=[];
try{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(systemroot|windir|path|pathext|temp|tmp|comspec|appdata|localappdata)$/i.test(k)));
 browser=await chromium.launch({headless:true,env});const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__idb=0;indexedDB.open=()=>{window.__idb++;throw new Error('storage forbidden');};});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin||/save\.dat|\/api\/|\/play-api\//i.test(u.pathname)){forbidden.push(u.pathname);return route.abort();}
  if(['/__owned-host','/__owned-initial'].includes(u.pathname)){
   if(u.pathname==='/__owned-initial')initialVisits++;
   return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><main id="owned"></main><p>隔離宿主</p>'});
  }
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));
 async function setup(){
  assert.equal(await page.evaluate(()=>window.__idb??0),0);
  await page.goto(origin+'/__owned-host');
  return page.evaluate(async()=>{
   const {createPlayerSessionHost}=await import('/src/player/playersessionhost.js');
   const identity={gameId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',releaseId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',ordinal:'1.0',revision:'1',sourceDigest:'a'.repeat(64),chapterId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa#one',manifestDigest:'c'.repeat(64)};
   const c=window.__host={identity,state:'active',statusCalls:0,packCalls:0,sessionCalls:0,navigations:[],reply:{...identity,listed:true},hold:false,throwStatus:false,throwPack:0,throwNavigation:0,holdNavigation:false,realNavigation:false,releaseNavigation:null,releaseStatus:null};
   const session={identity,state:()=>c.state,close(){c.sessionCalls++;if(c.state==='active')c.state='closed';},async status(){c.statusCalls++;if(c.hold)return new Promise(resolve=>{c.releaseStatus=resolve;});if(c.throwStatus)throw Object.assign(new Error('GAME_DELETED'),{code:'GAME_DELETED',status:410});return c.reply;}};
   const pack={identity:{...identity},close(){c.packCalls++;if(c.throwPack-->0)throw new Error('owned release failure');}};
   const options={session,pack,root:document.querySelector('#owned'),navigate:async result=>{c.navigations.push(result);if(c.throwNavigation-->0)throw new Error('owned navigation failure');if(c.holdNavigation)await new Promise(resolve=>{c.releaseNavigation=resolve;});if(c.realNavigation)location.assign('/__owned-initial');}};
   let invalid=0;for(const key of ['gameId','releaseId','ordinal','revision','sourceDigest','chapterId','manifestDigest']){try{createPlayerSessionHost({...options,pack:{...pack,identity:{...identity,[key]:'bad'}}});}catch{invalid++;}}
   for(const key of ['root','navigate','session','pack']){try{createPlayerSessionHost({...options,[key]:null});}catch{invalid++;}}
   if(document.querySelector('.player-session-host'))throw new Error('invalid constructor mounted DOM');
   c.h=createPlayerSessionHost(options);return invalid;
  });
 }
 assert.equal(await setup(),11);assert.equal(await page.evaluate(()=>window.__host.statusCalls),0);checks++;
 assert.deepEqual(await page.evaluate(()=>window.__host.h.checkStatus()),{kind:'current',updated:false});checks++;
 assert.deepEqual(await page.evaluate(async()=>{const c=window.__host;c.hold=true;const a=c.h.checkStatus(),b=c.h.checkStatus();const calls=c.statusCalls;c.releaseStatus(c.reply);return{results:await Promise.all([a,b]),calls};}),{results:[{kind:'current',updated:false},{kind:'current',updated:false}],calls:2});checks++;
 assert.deepEqual(await page.evaluate(()=>{const c=window.__host;c.hold=false;c.throwStatus=true;return c.h.checkStatus();}),{kind:'unavailable'});assert.equal(await page.getByRole('dialog').count(),0);checks++;
 for(const delta of [{listed:undefined},{gameId:'wrong'},{ordinal:'1.1'},{ordinal:'1.0',releaseId:'cccccccc-cccc-4ccc-accc-cccccccccccc'}]){
  assert.deepEqual(await page.evaluate(delta=>{const c=window.__host;c.throwStatus=false;c.reply={...c.identity,listed:true,...delta};return c.h.checkStatus();},delta),{kind:'unavailable'});
 }checks++;
 const updated=await page.evaluate(()=>{const c=window.__host;c.reply={...c.identity,listed:true,ordinal:'1.10000000000000000000000',releaseId:'cccccccc-cccc-4ccc-accc-cccccccccccc'};return c.h.checkStatus();});
 assert.deepEqual(updated,{kind:'updated'});assert.match(await page.getByRole('status').textContent(),/舊版本/);assert.equal(await page.evaluate(()=>window.__host.state),'closed');assert.equal(await page.evaluate(()=>window.__host.packCalls),1);checks++;
 assert.deepEqual(await page.evaluate(()=>{const c=window.__host;c.reply={gameId:c.identity.gameId,listed:false};return c.h.checkStatus();}),{kind:'updated'});
 assert.equal(await page.evaluate(()=>window.__host.h.warning()),true);assert.equal(await page.getByRole('status').isVisible(),true);assert.equal(await page.evaluate(()=>window.__host.navigations.length),0);checks++;
 await page.evaluate(()=>{const c=window.__host;c.throwStatus=true;return c.h.checkStatus();});assert.equal(await page.evaluate(()=>window.__host.h.warning()),true);checks++;
 await page.evaluate(()=>{const c=window.__host;c.exit=c.h.onExit({reason:'title'});});
 assert.match(await page.getByRole('dialog').textContent(),/版本已更新/);assert.equal(await page.evaluate(()=>window.__host.navigations.length),0);
 await page.getByRole('button',{name:'確認',exact:true}).click();assert.equal((await page.evaluate(()=>window.__host.exit)).reason,'updated');assert.equal(await page.evaluate(()=>window.__host.packCalls),1);checks++;
 await setup();
 assert.deepEqual(await page.evaluate(()=>{const c=window.__host;c.reply={gameId:c.identity.gameId,listed:false};return c.h.checkStatus();}),{kind:'unlisted',updated:false});assert.equal(await page.evaluate(()=>window.__host.state),'active');checks++;
 assert.deepEqual(await page.evaluate(()=>{const c=window.__host;c.reply={gameId:c.identity.gameId,listed:false,currentRelease:{releaseId:'cccccccc-cccc-4ccc-accc-cccccccccccc',ordinal:'1.1'}};return c.h.checkStatus();}),{kind:'updated'});assert.equal(await page.evaluate(()=>window.__host.state),'closed');checks++;
 await setup();
 assert.deepEqual(await page.evaluate(()=>{const c=window.__host;c.state='outdated';c.throwStatus=true;return c.h.checkStatus();}),{kind:'updated'});assert.equal(await page.evaluate(()=>window.__host.packCalls),1);checks++;
 await setup();
 await page.evaluate(()=>{const c=window.__host;c.state='outdated';c.exit=c.h.onExit({reason:'unavailable'});});assert.match(await page.getByRole('dialog').textContent(),/版本已更新/);
 await page.getByRole('button',{name:'確認',exact:true}).click();assert.equal((await page.evaluate(()=>window.__host.exit)).reason,'updated');checks++;
 await setup();
 // A claimed deletion reason/error without the reader's terminal state is not proof.
 await page.evaluate(()=>{const c=window.__host;c.exit=c.h.onExit({reason:'deleted'});c.same=c.exit===c.h.onExit({reason:'title'});});
 const dialog=page.getByRole('dialog',{name:'遊戲結束'}),confirm=dialog.getByRole('button',{name:'確認',exact:true});
 assert.match(await dialog.textContent(),/無法繼續/);assert.doesNotMatch(await dialog.textContent(),/已刪除/);assert.equal(await page.evaluate(()=>window.__host.same),true);checks++;
 await dialog.click({button:'right'});await page.waitForTimeout(3200);assert.equal(await dialog.isVisible(),true);assert.equal(await page.evaluate(()=>window.__host.navigations.length),0);
 assert.deepEqual(await page.evaluate(()=>window.__host.h.checkStatus()),{kind:'retired'});checks++;
 await confirm.click();const generic=await page.evaluate(()=>window.__host.exit);assert.equal(generic.reason,'unavailable');assert.equal(await page.getByRole('dialog').count(),0);checks++;
 await setup();
 // Actual terminal state, a failed resource disposal, and a failed navigation
 // keep the confirmation available. No duplicate parallel navigation.
 await page.evaluate(()=>{const c=window.__host;c.state='deleted';c.throwPack=1;c.throwNavigation=1;c.exit=c.h.onExit({reason:'title'});});
 assert.match(await dialog.textContent(),/遊戲已刪除/);assert.equal(await page.evaluate(()=>window.__host.navigations.length),0);
 await confirm.click();await page.waitForFunction(()=>document.querySelector('[role=dialog] [role=status]').textContent.length>0);
 assert.equal(await page.evaluate(()=>window.__host.packCalls),2);assert.equal(await confirm.isEnabled(),true);checks++;
 await page.screenshot({path:join(artifact,'confirmation.png')});
 await page.evaluate(()=>{window.__host.holdNavigation=true;});await confirm.click();assert.equal(await confirm.isDisabled(),true);
 await page.evaluate(()=>{const c=window.__host;c.h.onExit({reason:'title'});document.querySelector('[role=dialog] button').dispatchEvent(new MouseEvent('click',{button:0,bubbles:true}));});
 assert.equal(await page.evaluate(()=>window.__host.navigations.length),2);await page.evaluate(()=>window.__host.releaseNavigation());assert.equal((await page.evaluate(()=>window.__host.exit)).reason,'deleted');checks++;
 await setup();
 const late=await page.evaluate(async()=>{const c=window.__host;c.hold=true;const pending=c.h.checkStatus();const exit=c.h.onExit({reason:'title',initialAction:'load'});c.releaseStatus({...c.identity,listed:true,ordinal:'1.1',releaseId:'cccccccc-cccc-4ccc-accc-cccccccccccc'});return{status:await pending,exit:await exit,warning:c.h.warning(),packs:c.packCalls,navigations:c.navigations.length};});
 assert.equal(late.status.kind,'retired');assert.equal(late.exit.reason,'title');assert.equal(late.exit.initialAction,'load');assert.equal(late.warning,false);assert.equal(late.packs,1);assert.equal(late.navigations,1);checks++;
 await setup();await page.evaluate(()=>{const c=window.__host;c.state='deleted';c.realNavigation=true;c.exit=c.h.onExit({reason:'deleted'});});
 assert.equal(await page.evaluate(()=>window.__idb),0);
 assert.equal(initialVisits,0);await dialog.click({button:'right'});assert.equal(initialVisits,0);
 await Promise.all([page.waitForURL(origin+'/__owned-initial'),confirm.click()]);assert.equal(initialVisits,1);checks++;
 assert.equal(await page.evaluate(()=>window.__idb),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(forbidden,[]);checks++;
 const sources=Object.fromEntries(await Promise.all(['web/src/player/playersessionhost.js','web/src/player/runtimecontract.js','tools/verify_player_session_host_browser.mjs'].map(async p=>[p,sha(await readFile(p))])));
 await writeFile(join(artifact,'result.json'),JSON.stringify({checks,sources,errors,failed,forbidden,initialVisits,screenshotSHA:sha(await readFile(join(artifact,'confirmation.png'))),scope:'Actual DOM/lifetime host with controlled session/resource/navigation ports, including one actual owned-page navigation. No real reader/App in this fixture and no storage; joint chain covers those separately.'},null,2));process.stdout.write(JSON.stringify({checks,artifact})+'\n');
}catch(error){await writeFile(join(artifact,'failure.json'),JSON.stringify({error:String(error),errors,failed,forbidden},null,2));throw error;}
finally{await browser?.close();await server.close();}
