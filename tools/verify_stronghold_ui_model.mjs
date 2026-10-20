// Projection/controller regression, not a browser or original-rule certificate.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const {installStronghold} = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('server/public/stronghold.txt')).toString('base64'));
const GAME = '77777777-7777-4777-8777-777777777777', CH = 'chapter-1';
const game = {gameId:GAME,metadata:{name:'<img>',introduction:''},draftRevision:'1'};
const city = {idx:3,name:'北平',faction:14,troops:118,prod:20714,troopsCap:169,maxProd:21000};
const detail = {gameId:GAME,draftRevision:'1',metadata:game.metadata,privateSource:'not-reactive',chapters:[{chapterId:CH,name:'第一章',cities:[city,{...city,idx:4}]}],strongholds:[{runtimeSlot:3,placed:true,roads:['road-0'],chapters:[CH]}]};
function setup() {
  let actor = {user:{id:'u',role:'author',mustChangePassword:false}}, model, busy = false, confirmResult = true, hook = null;
  const rows = [structuredClone(game)], body = structuredClone(detail), calls = [];
  const ui = installStronghold({authority:()=>actor,isBusy:()=>busy,publish:m=>{model=m;},confirm:()=>confirmResult,
    work:async fn=>{if(busy)return;busy=true;try{return await fn();}finally{busy=false;ui.render();}},
    api:async(path,value,options)=>{calls.push({path,value,options});if(hook){const result=await hook(path,value,options);if(result!==undefined)return result;}
      if(path==='/api/games')return {games:rows};
      if(path.includes('/draft?revision='))return structuredClone(body);
      if(path.endsWith('/draft/save')) { assert.equal(options.revision,body.draftRevision);for(const edit of value.chapterEdits)Object.assign(body.chapters[0].cities.find(c=>c.idx===edit.cityIdx),edit.values);body.draftRevision=String(Number(body.draftRevision)+1);return {draftRevision:body.draftRevision}; }
      throw new Error('Unexpected API');
    }});
  ui.setIdentity(actor);
  return {ui,a:ui.actions,calls,body,rows,get model(){return model;},set confirm(value){confirmResult=value;},set hook(value){hook=value;},set identity(value){actor=value;ui.setIdentity(value);}};
}
test('explicit own-list read, display-only copies, references and no automatic POST',async()=>{
  const s=setup();assert.equal(s.calls.length,0);await s.a.refresh();assert.equal(s.model.games.length,1);assert.equal(s.model.chapterId,CH);assert.equal(s.model.cities[0].roadCount,1);assert.equal(s.model.cities[0].chapterCount,1);assert.equal(s.model.cities[0].name,'北平');assert.ok(!JSON.stringify(s.model).includes('not-reactive'));s.model.cities[0].name='changed';s.ui.render();assert.equal(s.model.cities[0].name,'北平');assert.equal(s.calls.filter(c=>c.value).length,0);
});
test('bounded absolute values use original chapter/slot/revision; save rereads receipt revision and preserves other dirty rows',async()=>{
  const s=setup();await s.a.refresh();s.a.edit(3,'troops','100');s.a.edit(3,'prod','20000');s.a.edit(4,'troops','101');await s.a.save(3);
  const post=s.calls.find(c=>c.value);assert.deepEqual(post.value.chapterEdits,[{op:'city',chapterId:CH,cityIdx:3,values:{troops:100,prod:20000}}]);assert.deepEqual(post.value.resourceEdits,[]);assert.equal(post.options.revision,'1');assert.match(post.options.key,/^[a-f0-9-]{36}$/);assert.ok(s.calls.some(c=>c.path.endsWith('/draft?revision=2')));assert.match(s.model.message,/修訂 2/);assert.equal(s.model.cities[1].troops,'101');assert.equal(s.model.dirty,true);
  await s.a.save(3);assert.equal(s.calls.filter(c=>c.value).length,1);assert.match(s.model.message,/未發送/);
});
test('caps, blank, noninteger, negative and unknown caps reject before POST',async()=>{
  const s=setup();await s.a.refresh();for(const value of ['99999','','abc','-1','1.5']){s.a.edit(3,'troops',value);await assert.rejects(s.a.save(3));assert.equal(s.calls.filter(c=>c.value).length,0);assert.equal(s.model.cities[0].troops,value);}
  s.body.chapters[0].cities[0].troopsCap=null;await s.a.inspect();s.a.edit(3,'troops','100');await assert.rejects(s.a.save(3),/上限未知/);assert.equal(s.calls.filter(c=>c.value).length,0);
});
test('conflict or unknown write keeps typed values and queried revision, no implicit retry',async()=>{
  const s=setup();await s.a.refresh();s.a.edit(3,'troops','100');s.hook=async(_p,v)=>{if(v)throw new Error('修訂已變，請重讀。');};await assert.rejects(s.a.save(3),/修訂已變/);s.ui.render();assert.equal(s.model.cities[0].troops,'100');assert.match(s.model.context,/修訂 1/);assert.match(s.model.message,/修訂已變/);assert.equal(s.calls.filter(c=>c.value).length,1);assert.equal(s.ui.canLeave(true),false);
});
test('dirty cancel protects read/refresh/selection; delete report cannot POST',async()=>{
  const s=setup();s.body.chapters.push({chapterId:'other',name:'第二章',cities:[]});await s.a.refresh();s.a.edit(3,'troops','100');s.confirm=false;const n=s.calls.length;await s.a.inspect();await s.a.refresh();s.a.selectChapter('other');assert.equal(s.calls.length,n);assert.equal(s.model.chapterId,CH);assert.equal(s.model.cities[0].troops,'100');await s.a.blockers(3);assert.match(s.model.message,/道路引用/);assert.match(s.model.message,/192 座/);assert.equal(s.calls.filter(c=>c.value).length,0);s.confirm=true;s.a.selectChapter('other');assert.equal(s.model.cities.length,0);
});
test('invalid reply cannot partly install; acknowledged save/read failure locks further writes and retains inputs',async()=>{
  const s=setup();await s.a.refresh();s.hook=async path=>path.includes('/draft?')?{...s.body,draftRevision:'999'}:undefined;await assert.rejects(s.a.inspect(),/修訂無效/);assert.equal(s.model.cities[0].troops,'118');s.hook=null;s.a.edit(3,'troops','100');s.hook=async path=>{if(path.endsWith('revision=2'))throw new Error('read unavailable');};await assert.rejects(s.a.save(3),/read unavailable/);assert.equal(s.model.saveDisabled,true);assert.equal(s.model.cities[0].troops,'100');assert.match(s.model.context,/保存已確認/);await assert.rejects(s.a.save(3));assert.equal(s.calls.filter(c=>c.value).length,1);s.hook=null;await s.a.inspect();assert.equal(s.model.saveDisabled,false);assert.equal(s.model.dirty,false);
});
test('anonymous/forced identity and late replies never expose another user display',async()=>{
  const s=setup();await s.a.refresh();let finish;s.hook=path=>path.includes('/draft?')?new Promise(resolve=>{finish=resolve;}):undefined;const pending=s.a.inspect();s.identity={user:{id:'other',role:'author',mustChangePassword:false}};finish(structuredClone(s.body));await pending;assert.deepEqual(s.model.cities,[]);assert.deepEqual(s.model.games,[]);s.identity=null;const n=s.calls.length;await assert.rejects(s.a.refresh());assert.equal(s.calls.length,n);s.identity={user:{id:'u',role:'admin',mustChangePassword:true}};await assert.rejects(s.a.refresh());assert.equal(s.calls.length,n);
});
