// App-shaped adapter with actual v3 CAS storage and owned IDB protocol mock.
// Minimal JSON snapshots / trusted formal-port seam, NOT semantic admission.
import assert from 'node:assert/strict';
import { createPlayerSaveRepository, capturePlayerSaveRepository } from '../reader/playerrepository.js';
import { createGameSaveStore } from '../web/src/core/gamesavestore.js';
import { gameSaveMemoryIDB } from './gamesave_mock.mjs';
const identity={gameId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',releaseId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',releaseOrdinal:0,chapterId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa#c1',manifestDigest:'a'.repeat(64)};
const snapshot=(slot=0,label='owned')=>({slot,label,played:true,scenario_idx:0,state:{save_date:{year:190},factions:[]},webMeta:{}});
const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return{promise,release};};
let checks=0;
function setup(){
 const memory=gameSaveMemoryIDB([['slots',{ownedLegacy:true}]]);
 const store=createGameSaveStore({gameId:identity.gameId,databaseName:'owned-app-adapter',getIndexedDB:()=>memory.indexedDB});
 let retired=false,gets=0;
 const current=()=>{if(retired)throw new Error('owned retired');};
 const saves={identity,list:()=>store.list(),async get(slot){gets++;const value=await store.get(slot);return value&&{snapshot:value.record.snapshot,token:value.token};},async put(value,token){const result=await store.put({...identity,slot:value.slot,snapshot:value},token);return{committed:true,snapshot:result.record.snapshot,token:result.token};}};
 return{memory,store,saves,current,retire:()=>{retired=true;},get gets(){return gets;},repo:createPlayerSaveRepository({saves,assertCurrent:current})};
}
for(const options of [{},{saves:{}},{saves:{identity},assertCurrent:()=>{}}]){assert.throws(()=>createPlayerSaveRepository(options),/explicit/);checks++;}
{
 const f=setup();await assert.rejects(f.repo.list);await assert.rejects(()=>f.repo.get(0));await assert.rejects(()=>f.repo.put(snapshot()));await assert.rejects(()=>f.repo.add(snapshot()));assert.equal(f.memory.stats.opens.length,0);checks++;
 const loaded=await f.repo.load();assert.deepEqual(loaded.slots.map(s=>s.slot),[0,1,2,3]);assert.ok(loaded.slots.every(s=>s.played===false));checks++;
 const input=snapshot(),pending=f.repo.put(input);input.label='mutated';const committed=await pending;assert.equal(committed.label,'owned');assert.equal((await f.repo.get(0)).label,'owned');checks++;
 committed.label='returned mutation';const read=await f.repo.get(0);read.label='read mutation';assert.equal((await f.repo.get(0)).label,'owned');checks++;
 const before=f.memory.stats.opens.length,rows=await f.repo.list();assert.equal(f.memory.stats.opens.length,before);rows[0].label='summary mutation';assert.equal((await f.repo.list())[0].label,'owned');checks++;
 const added=await f.repo.add(snapshot(0,'append'));assert.equal(added.slot,4);assert.equal((await f.store.get(0)).record.snapshot.label,'owned');assert.equal((await f.repo.get(4)).label,'append');checks++;
 const a=f.repo.put(snapshot(0,'first')),b=f.repo.put(snapshot(0,'second'));await a;await b;assert.equal((await f.repo.get(0)).label,'second');assert.equal((await f.store.get(0)).token.writeRevision,4);checks++;
 assert.equal('compareDelete' in f.repo,false);assert.equal('delete' in f.repo,false);assert.equal(f.memory.stats.deletes.length,0);assert.deepEqual(f.memory.records().find(([key])=>key==='slots'),['slots',{ownedLegacy:true}]);checks++;
}
for(const patch of [{releaseId:'cccccccc-cccc-4ccc-accc-cccccccccccc'},{releaseOrdinal:1},{chapterId:`${identity.gameId}#other`},{manifestDigest:'b'.repeat(64)}]){
 const f=setup();await f.store.put({...identity,...patch,slot:7,snapshot:snapshot(7)});const before=f.memory.records();
 const loaded=await f.repo.load();assert.equal(loaded.slots.find(s=>s.slot===7).unavailable,true);assert.equal(f.gets,0);
 await assert.rejects(()=>f.repo.get(7));await assert.rejects(()=>f.repo.put(snapshot(7)));assert.deepEqual(f.memory.records(),before);
 assert.equal((await f.repo.add(snapshot())).slot,8);assert.equal(f.memory.stats.deletes.length,0);checks++;
}
{
 const f=setup();await f.repo.load();await f.repo.put(snapshot());const original=await f.store.get(0);
 await f.store.put({...identity,slot:0,snapshot:snapshot(0,'another tab')},original.token);
 const before=f.memory.records();await assert.rejects(()=>f.repo.put(snapshot()),/changed/);await assert.rejects(()=>f.repo.get(0),/changed/);assert.deepEqual(f.memory.records(),before);checks++;
 await f.repo.load();assert.equal((await f.repo.get(0)).label,'another tab');await f.repo.put(snapshot(0,'explicitly refreshed'));assert.equal((await f.repo.get(0)).label,'explicitly refreshed');checks++;
}
{
 const f=setup();await f.repo.load();await f.store.put({...identity,slot:4,snapshot:snapshot(4,'other window')});
 const before=f.memory.records();await assert.rejects(()=>f.repo.add(snapshot()),/changed/);assert.deepEqual(f.memory.records(),before);assert.equal(await f.store.get(5),null);checks++;
}
{
 const f=setup();await f.store.put({...identity,releaseOrdinal:1,slot:Number.MAX_SAFE_INTEGER,snapshot:snapshot(Number.MAX_SAFE_INTEGER)});await f.repo.load();const before=f.memory.records();await assert.rejects(()=>f.repo.add(snapshot()),/identity/);assert.deepEqual(f.memory.records(),before);checks++;
}
{
 const f=setup();await f.repo.load();await f.repo.put(snapshot());
 const originalGet=f.saves.get;let first=true;
 f.saves.get=async slot=>{if(first){first=false;const value=await f.store.get(slot);await f.store.put({...identity,slot,snapshot:snapshot(slot,'race')},value.token);}return originalGet(slot);};
 await assert.rejects(f.repo.load,/changed/);assert.equal((await f.repo.list())[0].label,'owned');await assert.rejects(()=>f.repo.put(snapshot()),/changed/);checks++;
}
{
 const f=setup();await f.repo.load();await f.repo.put(snapshot());const before=f.memory.records();f.memory.configure({failAt:3,outcome:'abort'});await assert.rejects(()=>f.repo.put(snapshot(0,'aborted')),/abort/);f.memory.configure({});assert.deepEqual(f.memory.records(),before);assert.equal((await f.repo.get(0)).label,'owned');checks++;
}
{
 const f=setup(),wait=gate(),entered=gate(),list=f.saves.list;f.saves.list=async()=>{entered.release();await wait.promise;return list();};
 const pending=f.repo.load();await entered.promise;f.retire();wait.release();await assert.rejects(pending,/retired/);checks++;
}
{
 const f=setup();await f.repo.load();const wait=gate(),entered=gate(),put=f.saves.put;
 f.saves.put=async(...args)=>{const receipt=await put(...args);entered.release();await wait.promise;return receipt;};
 const writing=f.repo.put(snapshot()),queued=f.repo.put(snapshot(1));await entered.promise;f.retire();wait.release();
 assert.equal((await writing).label,'owned');await assert.rejects(queued,/retired/);assert.equal((await f.store.get(0)).record.snapshot.label,'owned');assert.equal(await f.store.get(1),null);checks++;
}
{
 const f=setup();f.retire();const before=f.memory.stats.opens.length;for(const action of [f.repo.load,f.repo.list,()=>f.repo.get(0),()=>f.repo.put(snapshot()),()=>f.repo.add(snapshot())])await assert.rejects(action,/retired/);assert.equal(f.memory.stats.opens.length,before);checks++;
}
// Explicit restore capture: all archive checks happen before returning a
// single-use App load port; later writes retain the captured CAS token.
for (const expectedToken of [null, {}, {slot:0}]) {
 const f=setup();await assert.rejects(()=>capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken}));assert.equal(f.memory.stats.opens.length,0);checks++;
}
{
 const f=setup();const original=await f.store.put({...identity,slot:0,snapshot:snapshot()});
 const expectedToken=structuredClone(original.token),pending=capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken});expectedToken.bodyText='mutated';
 const repo=await pending,opens=f.memory.stats.opens.length;
 const loaded=await repo.load();assert.equal(loaded.slots[0].label,'owned');assert.equal(f.memory.stats.opens.length,opens);loaded.slots[0].label='mutated';assert.equal((await repo.list())[0].label,'owned');checks++;
 await assert.rejects(repo.load,/consumed/);assert.equal(f.memory.stats.opens.length,opens);checks++;
 await repo.put(snapshot(0,'own next'));assert.equal((await repo.get(0)).label,'own next');checks++;
}
{
 const f=setup();const original=await f.store.put({...identity,slot:0,snapshot:snapshot()});
 const repo=await capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken:original.token});
 await f.store.put({...identity,slot:0,snapshot:snapshot(0,'external later')},original.token);const before=f.memory.records();
 assert.equal((await repo.load()).slots[0].label,'owned');await assert.rejects(()=>repo.get(0),/changed/);await assert.rejects(()=>repo.put(snapshot()),/changed/);assert.deepEqual(f.memory.records(),before);checks++;
}
{
 const f=setup();const original=await f.store.put({...identity,slot:0,snapshot:snapshot()});
 // Identical gameplay bytes are still a different writeRevision, not consent.
 await f.store.put({...identity,slot:0,snapshot:snapshot()},original.token);const before=f.memory.records();
 await assert.rejects(()=>capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken:original.token}),/changed/);assert.deepEqual(f.memory.records(),before);checks++;
}
for(const unavailable of ['missing','chapter']){
 const f=setup();const original=await f.store.put({...identity,slot:0,snapshot:snapshot()});
 if(unavailable==='missing')await f.store.compareDelete(original.token);
 else await f.store.put({...identity,chapterId:identity.gameId+'#other',slot:0,snapshot:snapshot()},original.token);
 const before=f.memory.records();await assert.rejects(()=>capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken:original.token}),/changed/);assert.deepEqual(f.memory.records(),before);checks++;
}
{
 const f=setup();const original=await f.store.put({...identity,slot:0,snapshot:snapshot()});
 const repo=await capturePlayerSaveRepository({saves:f.saves,assertCurrent:f.current,expectedToken:original.token});f.retire();const before=f.memory.stats.opens.length;
 await assert.rejects(repo.load,/retired/);assert.equal(f.memory.stats.opens.length,before);checks++;
}
process.stdout.write(`${JSON.stringify({checks,scope:'Actual v3 CAS with owned mock IDB and minimal trusted formal-port seam; no semantic scenario gate, App/native browser/latest-release/delete UI proof'})}\n`);
