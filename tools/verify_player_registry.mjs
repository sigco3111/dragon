// Client directory/announcement isolation. Owned Fetch responses only; no UI,
// persistence, network or admission authority is inferred from this fixture.
import assert from 'node:assert/strict';
import { createPlayerReader } from '../reader/playerclient.js';
const G='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', O='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const current={gameId:G,releaseId:O,ordinal:'1.10',revision:'3',sourceDigest:'a'.repeat(64),name:'原名',publishedAt:'2026-01-01T00:00:00.000Z',chapters:[G+'#c1']};
const notice={gameId:G,ordinal:'1.0',name:'歷史名稱',creatorAccount:'author',publishedAt:'2025-01-01T00:00:00.000Z',firstOnlineAt:'2025-01-02T00:00:00.000Z'};
const base={generation:12,digest:'b'.repeat(64),directory:[current],announcements:[notice,{...notice,ordinal:'1.10',name:current.name}]};
let value=structuredClone(base),calls=[],mode=200;
const client=createPlayerReader({origin:'https://owned-reader.invalid',fetch:async(url,options)=>{
 calls.push({url,options});
 if(url.includes('/admissions?'))return Response.json({...current,chapterId:current.chapters[0],manifestDigest:'c'.repeat(64),fileEndpoint:'/play-api/v1/file',ticket:'owned.ticket'});
 assert.equal(url,'https://owned-reader.invalid/play-api/v1/registry');return Response.json(value,{status:mode});
}});
let checks=0;
{
 const result=await client.registry();assert.deepEqual(result,{...base,announcementsError:null});
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.directory)&&Object.isFrozen(result.directory[0])&&Object.isFrozen(result.directory[0].chapters)&&Object.isFrozen(result.announcements)&&Object.isFrozen(result.announcements[0]));
 const {options}=calls.at(-1);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.deepEqual(options.headers,{});checks++;
}
{
 value={...structuredClone(base),ticket:'private',email:'private'};value.directory[0].secret='private';value.announcements[0].phone='private';
 const result=await client.registry();assert.equal(JSON.stringify(result).includes('private'),false);assert.deepEqual(result.announcements,base.announcements);checks++;
}
for(const mutate of [v=>{v.generation=0;},v=>{v.generation=1.2;},v=>{v.generation=Number.MAX_SAFE_INTEGER+1;},v=>{v.digest='bad';},v=>{v.directory=null;},v=>{v.directory.push(v.directory[0]);},v=>{v.directory[0].gameId='wolong-builtin';},v=>{v.directory[0].ordinal='1.01';},v=>{v.directory[0].chapters=[O+'#c1'];},v=>{v.directory[0].chapters.push(v.directory[0].chapters[0]);},v=>{v.directory[0].name=null;}]){
 value=structuredClone(base);mutate(value);value.announcements=null;await assert.rejects(client.registry,e=>e.code==='PLAYER_RESPONSE_INVALID');checks++;
}
for(const mutate of [v=>delete v.announcements,v=>{v.announcements=null;},v=>{v.announcements={};},v=>{v.announcementsError='ANNOUNCEMENTS_UNAVAILABLE';},v=>{v.announcementsError='private-error';},v=>{v.announcements[0].ordinal='1.11';},v=>{v.announcements[0].ordinal='1.01';},v=>{v.announcements.push(v.announcements[0]);},v=>{v.announcements[0].name=null;},v=>{v.announcements[0].creatorAccount=null;},v=>{v.announcements[0].publishedAt=null;},v=>{v.announcements[0].firstOnlineAt=null;}]){
 value=structuredClone(base);mutate(value);const result=await client.registry();assert.deepEqual(result.directory,base.directory);assert.equal(result.announcementsError,'ANNOUNCEMENTS_UNAVAILABLE');assert.deepEqual(result.announcements,[]);assert.equal(JSON.stringify(result).includes('private-error'),false);checks++;
}
{
 value={...structuredClone(base),announcements:[]};assert.equal((await client.registry()).announcementsError,null);
 value.announcements=[null,{gameId:O,name:'private',ordinal:null}];assert.deepEqual((await client.registry()).announcements,[]);checks++;
 value={...structuredClone(base),directory:[]};const result=await client.registry();assert.deepEqual(result.directory,[]);assert.deepEqual(result.announcements,[]);assert.equal(result.announcementsError,null);assert.equal(Object.hasOwn(result,'deleted'),false);checks++;
}
{
 value={error:'REGISTRY_MISSING'};mode=503;await assert.rejects(client.registry,e=>e.code==='REGISTRY_MISSING'&&e.status===503);mode=200;value=structuredClone(base);assert.equal((await client.registry()).directory.length,1);checks++;
}
{
 const session=await client.admit({gameId:G,ordinal:'1.10',chapterId:current.chapters[0]});
 const old=session.identity;value=structuredClone(base);value.generation++;value.directory[0].ordinal='1.11';value.directory[0].releaseId=G;
 assert.equal((await client.registry()).directory[0].ordinal,'1.11');assert.equal(session.identity,old);assert.equal(session.identity.ordinal,'1.10');assert.equal(session.state(),'active');
 value.directory=[];await client.registry();assert.equal(session.state(),'active');assert.equal(calls.filter(c=>c.url.includes('/admissions?')).length,1);session.close();checks++;
}
process.stdout.write(JSON.stringify({checks,requests:calls.length,scope:'Owned transport fixture; public whitelist, current directory, historical announcements and isolated errors; no UI/storage/automatic admission'})+'\n');
