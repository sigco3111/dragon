// Owned Fetch/stream/crypto seams only; no network, PNG decoding or browser DB.
import assert from 'node:assert/strict';
import {createPlayerStaticReader} from '../web/src/player/playerstatic.js';
import {PlayerReaderError} from '../reader/playerclient.js';
import {sha256,MAX_RESOURCE_BYTES} from '../reader/runtimecontract.js';
const origin='https://static.test',path='content/builtin/compiled/map-2-'+ 'a'.repeat(64)+'/map_tiles_spring.png';
const bytes=Uint8Array.of(1,2,3,4),digest=await sha256(bytes),secret='must-not-expose-owned-error';let checks=0;
const response=(data=bytes,headers={})=>new Response(data,{headers:{'content-type':'image/png',...headers}});
const defer=()=>{let resolve;return{promise:new Promise(r=>{resolve=r;}),resolve:value=>resolve(value)};};
const rejected=(fn,code)=>assert.rejects(fn,e=>e instanceof PlayerReaderError&&e.code===code&&!e.message.includes(secret));
function fixture(timeoutMs=1000){const calls=[];let next=()=>response();const read=createPlayerStaticReader({origin,timeoutMs,fetch:async(url,options)=>{calls.push({url,options});return next();}});return{read,calls,set:fn=>{next=fn;},get:()=>read(path,{maxBytes:4})};}
for(const value of ['http://static.test','https://static.test/','https://u:p@static.test','https://static.test/a','https://static.test?x','https://static.test#x','not-origin']){assert.throws(()=>createPlayerStaticReader({origin:value}),TypeError);checks++;}
for(const timeoutMs of [0,-1,NaN,1.1,120001,'2']){assert.throws(()=>createPlayerStaticReader({origin,timeoutMs}),TypeError);checks++;}
assert.throws(()=>createPlayerStaticReader({origin,fetch:null}),TypeError);checks++;
{
 const f=fixture();for(const p of ['/'+path,path+'?x',path+'#x',path.replace('map_tiles_','other_'),path.replace('spring','unknown'),path.replace('a'.repeat(64),'a'.repeat(63)),path.replace('compiled/','compiled/../'),path.replace('compiled/','compiled/%2e%2e/'),'https://other.test/'+path,'control/current.json',null])await assert.rejects(()=>f.read(p,{maxBytes:4}),TypeError);
 for(const maxBytes of [0,-1,1.1,NaN,Infinity,'4',MAX_RESOURCE_BYTES+1])await assert.rejects(()=>f.read(path,{maxBytes}),TypeError);
 await assert.rejects(()=>f.read(path),TypeError);assert.equal(f.calls.length,0);checks++;
}
{
 const f=fixture();for(const stem of ['map_tiles_','map_atlas_'])for(const season of ['spring','summer','autumn','winter']){
  const p=path.replace('map_tiles_spring',stem+season),got=await f.read(p,{maxBytes:4});assert.deepEqual(got.bytes,bytes);assert.equal(got.sha256,digest);assert.equal(got.contentType,'image/png');assert.ok(Object.isFrozen(got));
  const call=f.calls.at(-1);assert.equal(call.url,origin+'/'+p);for(const[k,v]of Object.entries({method:'GET',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}))assert.equal(call.options[k],v);assert.equal(call.options.headers,undefined);assert.equal(call.options.signal.aborted,false);
 }checks++;
 const got=await f.get();got.bytes[0]=0;assert.deepEqual((await f.get()).bytes,bytes);assert.deepEqual(bytes,Uint8Array.of(1,2,3,4));checks++;
}
for(const headers of [{'content-type':'text/html'},{'content-type':'image/png; charset=utf-8'},{'content-length':'0'},{'content-length':'-1'},{'content-length':'1.1'},{'content-length':'1e1'},{'content-length':'5'},{'content-length':'9007199254740992'},{'content-length':'2, 2'}]){
 const f=fixture();let cancelled=false;f.set(()=>response(new ReadableStream({cancel(){cancelled=true;}}),headers));await rejected(f.get,'PLAYER_STATIC_INVALID');assert.equal(cancelled,true);assert.equal(f.calls[0].options.signal.aborted,true);checks++;
}
for(const metadata of [{url:origin+'/other'},{redirected:true}]){const f=fixture();f.set(()=>{const r=response();for(const[k,v]of Object.entries(metadata))Object.defineProperty(r,k,{value:v});return r;});await rejected(f.get,'PLAYER_STATIC_INVALID');checks++;}
for(const status of [404,410,503]){const f=fixture();f.set(()=>Response.json({error:'GAME_DELETED',message:secret},{status}));await assert.rejects(f.get,e=>e.code==='PLAYER_STATIC_UNAVAILABLE'&&e.status===status);checks++;}
{
 const f=fixture();f.set(()=>new Response(null));await rejected(f.get,'PLAYER_STATIC_INVALID');f.set(()=>response(new Uint8Array()));await rejected(f.get,'PLAYER_STATIC_INVALID');assert.equal(f.calls.at(-1).options.signal.aborted,false);checks++;
 for(const length of ['3','4']){f.set(()=>response(Uint8Array.of(1,2),{'content-length':length}));await rejected(f.get,'PLAYER_STATIC_INVALID');assert.equal(f.calls.at(-1).options.signal.aborted,false);}checks++;
 f.set(()=>response(Uint8Array.of(1,2),{'content-encoding':'IDENTITY','content-length':'4'}));await rejected(f.get,'PLAYER_STATIC_INVALID');checks++;
 f.set(()=>response(bytes,{'content-length':'4'}));assert.equal((await f.get()).sha256,digest);checks++;
 // This seam supplies already-decoded bytes like Fetch, NOT a gzip decoder test.
 f.set(()=>response(bytes,{'content-encoding':'gzip','content-length':'2'}));assert.equal((await f.get()).sha256,digest);checks++;
}
for(const chunks of [[Uint8Array.of(1,2),Uint8Array.of(3,4,5)],[new Uint8Array()],['invalid chunk']]){
 const f=fixture();let cancelled=false;f.set(()=>response(new ReadableStream({start(c){for(const row of chunks)c.enqueue(row);},cancel(){cancelled=true;}})));await rejected(f.get,'PLAYER_STATIC_INVALID');assert.equal(cancelled,true);checks++;
}
{
 const f=fixture();f.set(()=>response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,2));c.enqueue(bytes.slice(2));c.close();}})));assert.equal((await f.get()).sha256,digest);assert.equal(f.calls.at(-1).options.signal.aborted,false);checks++;
 f.set(()=>{throw new Error(secret);});await rejected(f.get,'PLAYER_STATIC_NETWORK_UNAVAILABLE');checks++;
 f.set(()=>{throw new PlayerReaderError('GAME_DELETED',410);});await rejected(f.get,'PLAYER_STATIC_NETWORK_UNAVAILABLE');checks++;
 f.set(()=>response(new ReadableStream({start(c){c.error(new Error(secret));}})));await rejected(f.get,'PLAYER_STATIC_NETWORK_UNAVAILABLE');checks++;
}
{
 const f=fixture(25);let cancelled=false;f.set(()=>response(new ReadableStream({cancel(){cancelled=true;}})));await rejected(f.get,'PLAYER_STATIC_TIMEOUT');assert.equal(cancelled,true);assert.equal(f.calls[0].options.signal.aborted,true);checks++;
}
{
 const f=fixture(25),gate=defer();let cancelled=false;f.set(()=>gate.promise);await rejected(f.get,'PLAYER_STATIC_TIMEOUT');gate.resolve(response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);checks++;
}
{
 // The deadline includes hashing, but an already-complete Fetch is not aborted.
 const f=fixture(25),gate=defer(),started=defer(),subtle=crypto.subtle,prior=Object.getOwnPropertyDescriptor(subtle,'digest');
 Object.defineProperty(subtle,'digest',{configurable:true,value:async()=>{started.resolve();return gate.promise;}});
 try{const pending=f.get();await started.promise;await rejected(()=>pending,'PLAYER_STATIC_TIMEOUT');assert.equal(f.calls[0].options.signal.aborted,false);gate.resolve(new Uint8Array(32).buffer);await new Promise(r=>setImmediate(r));checks++;}
 finally{if(prior)Object.defineProperty(subtle,'digest',prior);else delete subtle.digest;}
}
assert.equal(await sha256(bytes),digest);checks++;
// Program roots are explicit constructor values, not caller paths or discovery.
const baseA='/program-assets/'+'b'.repeat(64)+'/',baseB='/program-assets/'+'c'.repeat(64)+'/';
for(const basePath of [null,0,{},'', '//static.test/',origin+'/', 'program-assets/'+'b'.repeat(64)+'/',baseA.slice(0,-1),baseA.toUpperCase(),baseA+'x',baseA+'?',baseA+'#',baseA+'\n',baseA+'\r',baseA+' ',baseA.replace('/program-assets/','/%70rogram-assets/'),baseA.replace('b'.repeat(64),'b'.repeat(63)),baseA+'../', '/src/']){
 let calls=0;assert.throws(()=>createPlayerStaticReader({origin,basePath,fetch:()=>{calls++;}}),TypeError);assert.equal(calls,0);checks++;
}
for(const basePath of [baseA,baseB]){
 const calls=[],options={origin,basePath,fetch:async(url,init)=>{calls.push({url,init});return response();}};
 const read=createPlayerStaticReader(options);options.basePath=basePath===baseA?baseB:baseA;
 for(const stem of ['map_tiles_','map_atlas_'])for(const season of ['spring','summer','autumn','winter']){
  const p=path.replace('map_tiles_spring',stem+season),got=await read(p,{maxBytes:4});assert.deepEqual(got.bytes,bytes);assert.equal(got.sha256,digest);
  assert.equal(calls.at(-1).url,origin+basePath+p);assert.equal(calls.at(-1).init.credentials,'omit');assert.equal(calls.at(-1).init.headers,undefined);checks++;
 }
 for(const p of [basePath+path,path+'?v=original-sprites-1',path+'#x',path.replace('spring','unknown')])await assert.rejects(()=>read(p,{maxBytes:4}),TypeError);
 assert.equal(calls.length,8);checks++;
}
for(const status of [404,410,503]){
 const calls=[];const read=createPlayerStaticReader({origin,basePath:baseA,fetch:async url=>{calls.push(url);return Response.json({error:'GAME_DELETED'},{status});}});
 await assert.rejects(()=>read(path,{maxBytes:4}),e=>e.code==='PLAYER_STATIC_UNAVAILABLE'&&e.status===status);
 assert.deepEqual(calls,[origin+baseA+path]);checks++;
}
{
 const calls=[];const read=createPlayerStaticReader({origin,basePath:baseA,fetch:async url=>{calls.push(url);const r=response();Object.defineProperty(r,'url',{value:origin+'/'+path});return r;}});
 await rejected(()=>read(path,{maxBytes:4}),'PLAYER_STATIC_INVALID');assert.deepEqual(calls,[origin+baseA+path]);checks++;
}
process.stdout.write(JSON.stringify({checks,scope:'Owned Fetch/stream/crypto seams, no sockets/PNG decoding/IDB. Manifest digest comparison remains in loadPlayerPack; no deletion inferred from static status.'})+'\n');
