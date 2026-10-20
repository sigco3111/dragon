import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { installLibraryBrowser } = await import('data:text/javascript;base64,' + readFileSync('server/public/library.txt').toString('base64'));
const gameId = '11111111-1111-4111-8111-111111111111', bytes = new Uint8Array([1,2,3]);
const digest = createHash('sha256').update(bytes).digest('hex');
function dto() { return { gameId, draftRevision:'1', registryId:'approved-available-library-f4ba804b-1', admission:'private-available-bytes-only', mode:'STAGED_AVAILABLE_LIBRARY_NOT_Q69_CLOSURE', sourceDigest:'a'.repeat(64), catalogRoot:'b'.repeat(64), assets:Array.from({length:398},(_,i)=>({assetId:'library-'+String(i).padStart(3,'0'),logicalURL:i===0?'<img src=x>':'assets/'+i,sha256:digest,byteLength:3,mime:'application/octet-stream'})), unresolvedReferences:Array.from({length:20},(_,i)=>({chapterId:'章'+i,slot:127,portrait:255,logicalURL:'kao/255.png'})) }; }
function binary() { return {bytes,sha256:digest,draftRevision:'1',sourceDigest:'a'.repeat(64),catalogRoot:'b'.repeat(64),admission:'private-available-bytes-only',disposition:'attachment; filename="library-000.bin"'}; }
function setup() {
  let actor={user:{id:'admin',role:'admin',mustChangePassword:false}},context={gameId,draftRevision:'1'},busy=false,model,handler=async(_p,_v,o)=>o?.libraryBinary?binary():dto(),confirmed=true;
  const requests=[],files=[];
  const controller=installLibraryBrowser({api:(...args)=>{requests.push(args);return handler(...args);},authority:()=>actor,savedContext:()=>context,isBusy:()=>busy,publish:value=>{model=value;},confirm:()=>confirmed,saveFile:(data,name)=>files.push({data,name}),work:async callback=>{if(busy)return;busy=true;try{return await callback();}finally{busy=false;controller.render();}}});
  controller.setIdentity(actor);
  return {controller,requests,files,get model(){return model;},setHandler:value=>{handler=value;},setContext:value=>{context=value;controller.render();},setActor:value=>{actor=value;controller.setIdentity(actor);},cancel:()=>{confirmed=false;}};
}
test('explicit exact GET, display projection has no digest/root/aliases; no automatic request',async()=>{
  const s=setup(),data=dto();s.setHandler(async()=>data);assert.equal(s.requests.length,0);await s.controller.actions.load();
  assert.equal(s.requests[0][0],'/api/games/'+gameId+'/draft/library-assets?revision=1');assert.equal(s.model.assets.length,398);assert.equal(s.model.missing.length,20);
  assert.deepEqual(Object.keys(s.model.assets[0]).sort(),['assetId','byteLength','logicalURL','mime']);data.assets[0].logicalURL='changed';assert.equal(s.model.assets[0].logicalURL,'<img src=x>');s.model.assets[0].assetId='evil';s.controller.render();assert.equal(s.model.assets[0].assetId,'library-000');assert.ok(!JSON.stringify(s.model).includes('catalogRoot'));
});
test('dirty cancellation and author/forced/anonymous guards issue no requests',async()=>{
  const s=setup();s.setContext({gameId,draftRevision:'1',dirty:true});s.cancel();await s.controller.actions.load();assert.equal(s.requests.length,0);
  for(const actor of [null,{user:{id:'author',role:'author'}},{user:{id:'admin',role:'admin',mustChangePassword:true}}]){s.setActor(actor);await assert.rejects(s.controller.actions.load());assert.equal(s.model.assets.length,0);assert.equal(s.model.loadDisabled,true);assert.equal(s.requests.length,0);}
});
test('validated download only; stable serial/asset ID, bytes and all response bindings checked',async()=>{
  const s=setup();await s.controller.actions.load();const serial=s.model.serial;await s.controller.actions.download(serial,'library-000');assert.equal(s.files.length,1);assert.equal(s.files[0].name,'library-000.bin');
  for(const [key,value] of Object.entries({bytes:new Uint8Array([3,2,1]),sha256:'c'.repeat(64),draftRevision:'2',sourceDigest:'c'.repeat(64),catalogRoot:'c'.repeat(64),admission:'runtime',disposition:'inline'})){s.setHandler(async()=>({...binary(),[key]:value}));await assert.rejects(s.controller.actions.download(serial,'library-000'));assert.equal(s.files.length,1);}
  const count=s.requests.length;await assert.rejects(s.controller.actions.download(serial,'../../other'));assert.equal(s.requests.length,count);
  s.setHandler(async()=>dto());await s.controller.actions.load();await assert.rejects(s.controller.actions.download(serial,'library-000'));assert.equal(s.files.length,1);
});
test('late reads/downloads after identity, context or pagehide cannot repopulate or create files',async()=>{
  for(const invalidate of [s=>s.setActor(null),s=>s.setContext({gameId,draftRevision:'2'}),s=>s.controller.pagehide()]){
    const s=setup();let finish;s.setHandler(()=>new Promise(resolve=>{finish=resolve;}));const pending=s.controller.actions.load();invalidate(s);finish(dto());await pending;assert.equal(s.model.assets.length,0);
    const d=setup();await d.controller.actions.load();d.setHandler(()=>new Promise(resolve=>{finish=resolve;}));const download=d.controller.actions.download(d.model.serial,'library-000');invalidate(d);finish(binary());await download;assert.equal(d.files.length,0);assert.equal(d.model.assets.length,0);
  }
});
test('malformed catalogue rejects atomically, never auto retries or grants runtime admission',async()=>{
  const s=setup();await s.controller.actions.load();const invalid=dto();invalid.assets[1].logicalURL=invalid.assets[0].logicalURL;s.setHandler(async()=>invalid);await assert.rejects(s.controller.actions.load());assert.equal(s.model.assets.length,0);assert.equal(s.requests.length,2);assert.equal(s.model.downloadDisabled,true);
  const wrong=dto();wrong.registryId='other';s.setHandler(async()=>wrong);await assert.rejects(s.controller.actions.load());assert.equal(s.requests.length,3);assert.equal(s.model.assets.length,0);
});
test('late rejected read cannot overwrite a new session or pagehide message',async()=>{
  for(const invalidate of [s=>s.setActor(null),s=>s.controller.pagehide()]){const s=setup();let fail;s.setHandler(()=>new Promise((_resolve,reject)=>{fail=reject;}));const pending=s.controller.actions.load();invalidate(s);const message=s.model.message;fail(new Error('old private failure'));await assert.rejects(pending);assert.equal(s.model.message,message);}
});
