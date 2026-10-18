// Canonical format-3 ordinal extension. Owned IDB mock, no engine/network/user data.
import assert from 'node:assert/strict';
import {saveReleaseOrdinal,saveReleaseOrdinalFromVersion,saveInput,saveJSON,saveRecord,checkSaveToken,gameSaveKeys} from '../web/src/core/gamesavecodec.js';
import {createGameSaveStore} from '../web/src/core/gamesavestore.js';
import {gameSaveMemoryIDB} from './gamesave_mock.mjs';
const G='owned-game',large='9007199254740992',next='9007199254740993',maximum='9'.repeat(31);
const memory=gameSaveMemoryIDB([['slots',{ownedLegacy:true}]]),store=createGameSaveStore({gameId:G,databaseName:'owned-ordinal',getIndexedDB:()=>memory.indexedDB});
const input=(releaseOrdinal,slot=0)=>({gameId:G,releaseId:'owned-release',releaseOrdinal,chapterId:'owned-chapter',manifestDigest:'a'.repeat(64),slot,snapshot:{slot,owned:true}});
let checks=0;
for(const value of [0,1,10,Number.MAX_SAFE_INTEGER,large,next,maximum]){
 assert.equal(saveReleaseOrdinal(value),value);assert.equal(saveReleaseOrdinalFromVersion('1.'+value),value);
 assert.equal(saveInput(input(value),G).releaseOrdinal,value);checks++;
}
for(const value of [-0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,1e30,0n,BigInt(large),null,undefined,true,{},[],'0','1',String(Number.MAX_SAFE_INTEGER),'09007199254740992','+9007199254740992','9007199254740992.0','9.007199254740992e15',' 9007199254740992','9007199254740992 ','1.'+large,'9'.repeat(32)]){
 const before=memory.stats.opens.length;assert.throws(()=>saveReleaseOrdinal(value),TypeError);await assert.rejects(()=>store.put(input(value)),TypeError);assert.equal(memory.stats.opens.length,before);checks++;
}
for(const version of ['1.00','1.-0','1.-1','1.01','2.0','1.1e20','1.1.0','1.'+'9'.repeat(32),1,null]){assert.throws(()=>saveReleaseOrdinalFromVersion(version),TypeError);checks++;}
const records=[];
for(const [slot,ordinal]of [0,Number.MAX_SAFE_INTEGER,large,next,maximum].entries()){
 const receipt=await store.put(input(ordinal,slot)),read=await store.get(slot);records.push(read);
 assert.equal(read.record.format,3);assert.equal(read.record.releaseOrdinal,ordinal);assert.deepEqual(read.token,receipt.token);
 assert.equal(saveRecord(read.token.bodyText,G).releaseOrdinal,ordinal);assert.deepEqual(checkSaveToken(read.token,G),read.token);checks++;
}
assert.deepEqual((await store.list()).map(row=>row.releaseOrdinal),[0,Number.MAX_SAFE_INTEGER,large,next,maximum]);
assert.ok(records[0].token.bodyText.includes('"releaseOrdinal":0'));assert.ok(records[2].token.bodyText.includes('"releaseOrdinal":"'+large+'"'));
assert.notEqual(records[2].token.bodyDigest,records[3].token.bodyDigest);checks++;
const overwritten=await store.put({...input(large,2),snapshot:{slot:2,owned:'new'}},records[2].token);
await assert.rejects(()=>store.put(input(large,2),records[2].token),/changed/);
await assert.rejects(()=>store.compareDelete(records[2].token),/changed/);
assert.deepEqual((await store.get(2)).token,overwritten.token);checks++;
const before=memory.records();memory.configure({failAt:3,outcome:'abort'});await assert.rejects(()=>store.put(input(next,2),overwritten.token),/abort/);memory.configure({});assert.deepEqual(memory.records(),before);checks++;
// Explicit primitive exercised only on owned records, not remote deletion policy.
await store.compareDelete(overwritten.token);assert.equal(await store.get(2),null);assert.equal((await store.get(3)).record.releaseOrdinal,next);checks++;
for(const [key,value]of [['slot',large],['writeRevision',large]]){
 const bad={...records[4].record,[key]:value};assert.throws(()=>saveRecord(saveJSON(bad),G),TypeError);checks++;
}
assert.throws(()=>gameSaveKeys(G,large),TypeError);
assert.deepEqual(memory.records().find(([key])=>key==='slots'),['slots',{ownedLegacy:true}]);checks++;
process.stdout.write(JSON.stringify({checks,scope:'Exact ordinal grammar/JSON/header/catalog/token/CAS and owned mock abort; no semantic scenario, historical recognition or delete authorization'})+'\n');
