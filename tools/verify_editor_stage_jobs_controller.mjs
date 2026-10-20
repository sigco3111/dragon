import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
const source = await readFile(new URL('../server/public/stage.txt', import.meta.url), 'utf8');
const { installStageJobs } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const purposes=['data','images','fallback-spring','fallback-summer','fallback-autumn','fallback-winter'];
const bytes=new Uint8Array([1,2,3]), sha256=createHash('sha256').update(bytes).digest('hex');
function reply(purpose='data', state='queued', id=uuid(2), draftRevision='7') {
  return {admission:'stage-only',purpose,job:{operationId:id,gameId:uuid(1),draftRevision,scope:'all',rowRevision:'3',state,retryable:true,stage:state==='ready'?1:0,checkpoint:state==='ready'?[{outputs:[{assetId:'test',byteLength:3,sha256}]}]:[]}};
}
function harness(storage=new Map()) {
  let user={user:{id:'admin',role:'admin',mustChangePassword:false}}, context={gameId:uuid(1),draftRevision:'7',dirty:false}, model,busy=false,confirm=true;
  const calls=[],files=[],prompts=[];let handler=async()=>reply();
  const controller=installStageJobs({authority:()=>user,savedContext:()=>context,isBusy:()=>busy,publish:v=>{model=v;},
    storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},confirm:text=>{prompts.push(text);return confirm;},saveFile:(...args)=>files.push(args),
    api:async(...args)=>{calls.push(args);return handler(...args);},
    work:async action=>{if(busy)return;busy=true;try{return await action();}finally{busy=false;controller.render();}},
  });controller.setIdentity(user);
  return {controller,calls,files,prompts,storage,get model(){return model;},set handler(v){handler=v;},set confirm(v){confirm=v;},get user(){return user;},set user(v){user=v;controller.setIdentity(v);},set context(v){context=v;controller.render();}};
}
test('explicit reservation uses saved revision; projection/storage contain no raw job or credentials',async()=>{
  const h=harness();assert.equal(h.calls.length,0);await h.controller.actions.create();
  assert.deepEqual(h.calls[0][1],{draftRevision:'7',scope:'all'});assert.ok(h.calls[0][2].key);
  assert.equal(h.model.runDisabled,false);assert.equal(h.controller.canLeave(true),true);
  assert.ok(!JSON.stringify(h.model).includes('enqueueKey'));assert.ok(!h.storage.get('editor-stage-jobs:admin').includes('checkpoint'));
});
test('unknown reservation preserves original key/body across context change and reload',async()=>{
  const h=harness();h.handler=async()=>{throw new Error('lost');};await assert.rejects(h.controller.actions.create(),/lost/);
  assert.equal(h.controller.canLeave(true),false);const original=structuredClone(h.calls[0]);
  h.context={gameId:uuid(5),draftRevision:'8'};await assert.rejects(h.controller.actions.create(),/原操作/);assert.equal(h.calls.length,1);
  const restored=harness(h.storage);assert.equal(restored.calls.length,0);await restored.controller.actions.query();assert.deepEqual(restored.calls[0],original);
  assert.equal(restored.model.runDisabled,false);
});
test('command failure is not automatically replayed; GET resolves original ID and row revision',async()=>{
  const h=harness();await h.controller.actions.create();h.handler=async()=>{throw new Error('lost');};await assert.rejects(h.controller.actions.run(),/lost/);
  assert.deepEqual(h.calls[1][1],{});assert.equal(h.calls[1][2].revision,'3');assert.equal(h.controller.canLeave(true),false);
  await assert.rejects(h.controller.actions.run(),/先查詢/);assert.equal(h.calls.length,2);
  h.handler=async()=>reply('data','ready');await h.controller.actions.query();assert.equal(h.calls[2][1],undefined);assert.ok(h.calls[2][0].endsWith(uuid(2)));
  assert.equal(h.controller.canLeave(true),true);assert.equal(h.model.artifacts.length,1);
  h.model.artifacts[0].assetId='tampered';h.controller.render();assert.equal(h.model.artifacts[0].assetId,'test');
});
test('cancel dirty reservation, command, unknown query and leaving sends no extra requests',async()=>{
  const h=harness();h.context={gameId:uuid(1),draftRevision:'7',dirty:true};h.confirm=false;await h.controller.actions.create();assert.equal(h.calls.length,0);
  h.confirm=true;await h.controller.actions.create();h.confirm=false;await h.controller.actions.run();assert.equal(h.calls.length,1);
  const lost=harness();lost.handler=async()=>{throw new Error('lost');};await assert.rejects(lost.controller.actions.create());lost.confirm=false;await lost.controller.actions.query();assert.equal(lost.calls.length,1);assert.equal(lost.controller.canLeave(),false);
});
test('role/identity guards and late responses never revive another account display',async()=>{
  const h=harness();let resolve;h.handler=()=>new Promise(r=>{resolve=r;});const pending=h.controller.actions.create();
  h.user={user:{id:'author',role:'author'}};resolve(reply());await pending;assert.equal(h.model.artifacts.length,0);assert.equal(h.model.task,'此用途尚無操作關聯');
  assert.equal(h.controller.actions.choosePurpose('images'),false);
  for(const user of [null,{user:{id:'admin',role:'admin',mustChangePassword:true}}]){h.user=user;await h.controller.actions.create();await h.controller.actions.query();assert.equal(h.model.context,'');}
  assert.equal(h.calls.length,1);
});
test('validated binary only, fixed name, stale operation ID cannot download',async()=>{
  const h=harness();h.handler=async()=>reply('data','ready');await h.controller.actions.create();
  await h.controller.actions.download('test',uuid(9));assert.equal(h.calls.length,1);
  h.handler=async()=>({bytes,sha256});await h.controller.actions.download('test',uuid(2));assert.equal(h.files.length,1);assert.equal(h.files[0][1],'test.bin');assert.deepEqual(h.calls[1][2],{binary:true,maxBytes:3});
  h.handler=async()=>({bytes:new Uint8Array([4,5,6]),sha256});await assert.rejects(h.controller.actions.download('test',uuid(2)),/SHA/);assert.equal(h.files.length,1);
});
test('late binary after identity change produces no file',async()=>{
  const h=harness();h.handler=async()=>reply('data','ready');await h.controller.actions.create();let resolve;h.handler=()=>new Promise(r=>{resolve=r;});const pending=h.controller.actions.download('test',uuid(2));h.user=null;resolve({bytes,sha256});await pending;assert.equal(h.files.length,0);assert.equal(h.model.artifacts.length,0);
});
test('six-purpose structural context requires same exact revision, distinct IDs and no pending command',async()=>{
  const h=harness();for(const [index,purpose] of purposes.entries()){h.controller.actions.choosePurpose(purpose);h.handler=async()=>reply(purpose,'queued',uuid(index+2));await h.controller.actions.create();}
  assert.equal(Object.keys(h.controller.assetContext().operations).length,6);assert.equal(h.controller.assetContext().draftRevision,'7');
  h.handler=async()=>{throw new Error('lost');};await assert.rejects(h.controller.actions.run());assert.equal(h.controller.assetContext(),null);
  h.controller.passwordChanged(h.user);assert.equal(h.controller.assetContext(),null);assert.equal(h.model.runDisabled,true);assert.equal(h.model.createDisabled,false);
});
test('corrupt stored association blocks API; actual password acknowledgement permits explicit new reservation',async()=>{
  const h=harness(new Map([['editor-stage-jobs:admin','{broken']]));assert.equal(h.model.locked,true);await h.controller.actions.create();assert.equal(h.calls.length,0);
  h.controller.passwordChanged(h.user);await h.controller.actions.create();assert.equal(h.calls.length,1);
});
test('malformed response keeps original association; retry restricted to confirmed retryable failure',async()=>{
  const h=harness();h.handler=async()=>({...reply(),admission:'runtime'});await assert.rejects(h.controller.actions.create(),/上下文/);assert.equal(h.controller.canLeave(true),false);
  h.handler=async()=>reply('data','failed');await h.controller.actions.query();assert.equal(h.model.retryDisabled,false);
  h.handler=async()=>reply();await h.controller.actions.retry();assert.ok(h.calls[2][0].endsWith('/retry'));assert.equal(h.calls[2][2].revision,'3');await assert.rejects(h.controller.actions.retry(),/先查詢/);
});
