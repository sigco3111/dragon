// Owned Fetch/stream seams; metadata recognition is NOT archive/delete authority.
import assert from 'node:assert/strict';
import { createPlayerReader, PlayerReaderError } from '../reader/playerclient.js';
import { MAX_METADATA_BYTES, sha256 } from '../reader/runtimecontract.js';
const G='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', R='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', N='cccccccc-cccc-4ccc-8ccc-cccccccccccc', origin='https://reader.test';
const bytes=new TextEncoder().encode('{"owned":true}'), digest=await sha256(bytes);
const saved={gameId:G,releaseId:R,ordinal:'1.0',revision:'1',sourceDigest:'a'.repeat(64),name:'Old <script>',publishedAt:'2037-01-01T00:00:00Z',chapters:[G+'#c1'],manifestDigest:digest};
const current={...saved,releaseId:N,ordinal:'1.1',name:'Current'};delete current.manifestDigest;
const input={gameId:G,releaseId:R,ordinal:'1.0'};
const fresh=()=>({saved:structuredClone(saved),current:structuredClone(current)});
function fixture(timeoutMs=1000){const calls=[];let next=()=>Response.json(fresh());const client=createPlayerReader({origin,timeoutMs,fetch:async(url,options)=>{calls.push({url,options});return next(url,options);}});return{client,calls,set(fn){next=fn;},read:()=>client.release(input)};}
const rejected=(fn,code,status)=>assert.rejects(fn,e=>e instanceof PlayerReaderError&&e.code===code&&(status===undefined||e.status===status));
let checks=0;
for(const patch of [{gameId:'bad'},{gameId:undefined},{releaseId:'r0'},{releaseId:'../x'},{ordinal:'1.00'},{ordinal:'1.9007199254740992x'}, {ordinal:1}]){const f=fixture();await assert.rejects(()=>f.client.release({...input,...patch}),TypeError);assert.equal(f.calls.length,0);checks++;}
{
 const f=fixture(),request={...input},pending=f.client.release(request);request.releaseId=N;request.ordinal='1.1';
 const result=await pending;assert.deepEqual(result,fresh());assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.saved)&&Object.isFrozen(result.saved.chapters)&&Object.isFrozen(result.current)&&Object.isFrozen(result.current.chapters));
 assert.throws(()=>result.saved.chapters.push('other'),TypeError);
 const {url,options}=f.calls[0];assert.equal(url,origin+'/play-api/v1/releases?'+new URLSearchParams({game:G,release:R,ordinal:'1.0'}));
 assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.deepEqual(options.headers,{});assert.equal(options.signal.aborted,false);checks++;
 const extra={...fresh(),ticket:'must-not-escape'};extra.saved.ticket='must-not-escape';extra.current.privateEmail='must-not-escape';f.set(()=>Response.json(extra));assert.deepEqual(await f.read(),fresh());assert.equal(f.calls.length,2);checks++;
 const value=fresh();value.current={...value.saved};delete value.current.manifestDigest;f.set(()=>Response.json(value));assert.deepEqual(await f.read(),value);checks++;
 // Same source/revision/manifest is still a different formal release.
 f.set(()=>Response.json(fresh()));assert.equal((await f.read()).current.sourceDigest,saved.sourceDigest);checks++;
}
for(const mutate of [
 v=>{v.saved.gameId=N;},v=>{v.saved.releaseId=N;},v=>{v.saved.ordinal='1.1';},v=>{v.saved.manifestDigest='bad';},v=>{delete v.saved.manifestDigest;},
 v=>{v.current.gameId=N;},v=>{v.current.releaseId='r1';},v=>{v.current.ordinal='1.00';},v=>{v.current.sourceDigest='bad';},v=>{v.current.chapters=[];},
 v=>{v.saved.chapters.push(v.saved.chapters[0]);},v=>{v.saved.chapters=[N+'#wrong'];},v=>{v.saved.revision='0';},v=>{v.saved.name=null;},v=>{v.current.publishedAt=null;},
 v=>{v.current.releaseId=R;},v=>{v.current.ordinal='1.0';},
 ...Object.entries({revision:'2',sourceDigest:'b'.repeat(64),name:'changed',publishedAt:'changed',chapters:[G+'#other']}).map(([key,value])=>v=>{v.current={...v.saved,[key]:value};}),
 v=>{delete v.saved;},v=>{delete v.current;}
]){const f=fixture(),value=fresh();mutate(value);f.set(()=>Response.json(value));await rejected(f.read,'PLAYER_RESPONSE_INVALID');assert.equal(f.calls.length,1);checks++;}
{
 const f=fixture(),value=fresh();value.saved.ordinal='1.9007199254740992';value.current.ordinal='1.9007199254740993';f.set(()=>Response.json(value));
 const query={...input,ordinal:value.saved.ordinal};assert.deepEqual(await f.client.release(query),value);checks++;
 value.current.ordinal='1.9007199254740991';await rejected(()=>f.client.release(query),'PLAYER_RESPONSE_INVALID');checks++;
}
for(const [status,error,code]of [[404,'RELEASE_UNRECOGNIZED','RELEASE_UNRECOGNIZED'],[503,'RELEASE_HISTORY_UNAVAILABLE','RELEASE_HISTORY_UNAVAILABLE'],[403,'GAME_NOT_LISTED','GAME_NOT_LISTED'],[409,'REGISTRY_CHANGED','REGISTRY_CHANGED'],[503,'GAME_DELETED','PLAYER_REQUEST_FAILED'],[410,'OTHER','PLAYER_REQUEST_FAILED'],[410,'GAME_DELETED','GAME_DELETED']]){
 const f=fixture();f.set(()=>Response.json({error,gameId:G},{status}));await rejected(f.read,code,status);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.signal.aborted,false);checks++;
}
{
 const f=fixture();f.set(()=>Response.json({error:'GAME_DELETED',gameId:N},{status:410}));await rejected(f.read,'PLAYER_REQUEST_FAILED',410);checks++;
 f.set(()=>{throw new Error('private transport failure');});await rejected(f.read,'PLAYER_NETWORK_UNAVAILABLE');checks++;
 f.set(()=>new Response('{}',{headers:{'content-type':'text/html'}}));await rejected(f.read,'PLAYER_RESPONSE_INVALID');checks++;
 f.set(()=>new Response('{}',{headers:{'content-type':'application/json','content-length':String(MAX_METADATA_BYTES+1)}}));await rejected(f.read,'PLAYER_RESPONSE_INVALID');checks++;
 let cancelled=false;f.set(()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_METADATA_BYTES+1));},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));await rejected(f.read,'PLAYER_RESPONSE_INVALID');assert.equal(cancelled,true);checks++;
}
{
 const f=fixture(25);let cancelled=false;f.set(()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));await rejected(f.read,'PLAYER_TIMEOUT');assert.equal(cancelled,true);checks++;
}
{
 // This read-only client call does not mutate or replace a separately admitted
 // session. Its owner discovers terminal state through that session's own I/O.
 const f=fixture();f.set(()=>Response.json({...saved,chapterId:saved.chapters[0],ticket:'owned.ticket',fileEndpoint:'/play-api/v1/file'}));
 const session=await f.client.admit({gameId:G,ordinal:'1.0',chapterId:saved.chapters[0]});
 f.set(()=>Response.json({error:'GAME_DELETED',gameId:G},{status:410}));await rejected(f.read,'GAME_DELETED',410);assert.equal(session.state(),'active');assert.equal(session.identity.ordinal,'1.0');
 f.set(()=>new Response(bytes,{headers:{'content-type':'application/json','x-content-sha256':digest}}));await session.read('manifest');assert.equal(f.calls.length,3);session.close();checks++;
}
process.stdout.write(JSON.stringify({checks,scope:'Owned metadata transport/validation; no archive semantics, IndexedDB, deletion permission, browser or cloud proof'})+'\n');
