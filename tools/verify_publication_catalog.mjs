// Pure frozen metadata/transport negatives, not an authority or game fixture.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectPublicationCatalog } from '../server/publicationcatalog.js';
import { createDistributionResourceVerifier } from '../vps/distribution-resources.mjs';
const G='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',H='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',R='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const context={authorityId:G,generation:1},time='2026-10-15T00:00:00.000Z',digest='a'.repeat(64);
const current=gameId=>({gameId,releaseId:R,ordinal:'1.0',revision:'1',sourceDigest:digest,chapters:[gameId+'#upper-1'],runtime:{key:`artifacts/${gameId}/1.0/${R}/runtime-${digest}.json`,sha256:digest,byteLength:1},name:'Private name',publishedAt:time,createdAt:time});
const fixture=()=>({version:1,games:[{gameId:G,listed:true,deleted:false,current:current(G),announcements:[{releaseId:R,ordinal:'1.0',name:'Public snapshot',creatorAccount:'public-author',publishedAt:time,firstOnline:{generation:1}}]},{gameId:H,listed:false,deleted:false,current:current(H),announcements:[]}]});
let groups=0;
const original=fixture(),unchanged=structuredClone(original),projection=projectPublicationCatalog(original,context);
assert.deepEqual(original,unchanged);assert.equal(projection.runtimeVersion,2);assert.equal(projection.directory.length,1);assert.equal(projection.gameStates.length,2);
assert.equal(projection.directory[0].gameId,G);assert.equal(projection.releases.length,1);assert.equal(projection.announcements.length,1);assert.equal(Object.hasOwn(projection,'catalog'),false);groups++;
projection.directory[0].chapters.push('changed');projection.releases[0].runtime.key='changed';projection.announcements[0].firstOnline.generation=999;assert.deepEqual(original,unchanged);groups++;
assert.deepEqual(projectPublicationCatalog({...original,games:original.games.toReversed()},context),projectPublicationCatalog(original,context));groups++;
for(const mutate of [
 c=>{c.extra=true;},c=>{c.version=2;},c=>{c.games.push(structuredClone(c.games[0]));},c=>{c.games[0].listed=1;},
 c=>{c.games[0].deleted=true;},c=>{c.games[0].current=null;},c=>{c.games[0].current.gameId=H;},c=>{c.games[0].current.releaseId='r0';},
 c=>{c.games[0].current.runtime.key='control/current.json';},c=>{c.games[0].current.runtime.extra=1;},c=>{c.games[0].current.chapters=[H+'#upper-1'];},
 c=>{c.games[0].current.chapters=[];},c=>{c.games[0].current.createdAt='bad';},c=>{c.games[0].announcements=[];},
 c=>{c.games[0].announcements.push(structuredClone(c.games[0].announcements[0]));},c=>{c.games[0].announcements[0].ordinal='1.1';},
 c=>{c.games[0].announcements[0].releaseId=H;},c=>{c.games[0].announcements[0].firstOnlineAt=time;},
 c=>{c.games[0].announcements[0].firstOnline.generation=2;},c=>{c.games[0].listed=false;},
 c=>{c.games[1].current=null;c.games[1].announcements=[structuredClone(c.games[0].announcements[0])];},
]){const c=fixture();mutate(c);assert.throws(()=>projectPublicationCatalog(c,context));groups++;}
for(const invalid of [{},{authorityId:'bad',generation:1},{authorityId:G,generation:0},{authorityId:G,generation:Number.MAX_SAFE_INTEGER+1}]){assert.throws(()=>projectPublicationCatalog({version:1,games:[]},invalid));groups++;}
const next=fixture();next.games[0].listed=false;next.games[0].announcements[0].firstOnline={generation:1,operationId:R,operationDigest:digest,payloadDigest:digest};
assert.deepEqual(projectPublicationCatalog(next,{...context,generation:2}).announcements,[]);next.games[0].listed=true;
assert.deepEqual(projectPublicationCatalog(next,{...context,generation:2}).announcements[0].firstOnline,next.games[0].announcements[0].firstOnline);groups++;
next.games[0]={gameId:G,listed:false,deleted:true,current:null,announcements:[]};assert.deepEqual(projectPublicationCatalog(next,{...context,generation:2}).gameStates[0],{gameId:G,listed:false,deleted:true});groups++;
let reads=0;const verify=createDistributionResourceVerifier({r2:{get(){reads++;throw new Error('unexpected I/O');}}});
for(const change of [p=>{p.catalog.games[0].current.name='different';},p=>{p.catalog.games[1].current.runtime.key='wrong';},p=>{p.projection.announcements=[];},p=>{p.catalog.games[0].announcements[0].firstOnline.generation=999;}]){
 const catalog=fixture(),value={version:1,catalog,projection:projectPublicationCatalog(catalog,context)};change(value);const payload=Buffer.from(JSON.stringify(value));
 await assert.rejects(verify({...context,kind:'listing',gameId:G,payload,payloadDigest:createHash('sha256').update(payload).digest('hex')}));assert.equal(reads,0);groups++;
}
process.stdout.write(`publication catalog: ${groups} groups passed (metadata-only)\n`);
