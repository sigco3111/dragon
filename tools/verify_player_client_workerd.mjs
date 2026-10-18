// Real reader/workerd/R2 plus the browser-compatible client in Node. Opaque
// transport fixtures, not a browser/game/save or production deployment proof.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createPlayerReader } from '../reader/playerclient.js';
import { uploadRelease } from '../vps/publish_to_r2.mjs';
import { GAME, PORTRAIT, TEMPLATE_PORTRAIT, publication, unlisted } from './fixtures/publication.mjs';
const require=createRequire(import.meta.url);let modulePath=process.env.MINIFLARE_MODULE;
if(!modulePath){try{modulePath=require.resolve('miniflare');}catch{modulePath=join(process.env.APPDATA??'','npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js');}}
if(!existsSync(modulePath))throw new Error('existing Miniflare required');
const {Miniflare}=await import(pathToFileURL(modulePath).href);
const own=mkdtempSync(join(tmpdir(),'dragon-player-client-'));let mf,outbound=0,checks=0;
const parse=bytes=>{try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('bad owned JSON');}};
try{
 mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:resolve('reader/worker.js'),compatibilityDate:'2024-01-01',host:'127.0.0.1',port:0,r2Buckets:['PUBLISH_BUCKET'],r2Persist:join(own,'r2'),bindings:{PLAYER_ORIGIN:'https://reader.test',PLAYER_ADMISSION_ACTIVE_KEY:'owned',PLAYER_ADMISSION_KEYS:JSON.stringify({owned:'11'.repeat(32)})},outboundService:()=>{outbound++;return new Response('denied',{status:403});}});
 await mf.ready;const bucket=await mf.getR2Bucket('PUBLISH_BUCKET');
 const r2={async get(key){const row=await bucket.get(key);return row?{bytes:Buffer.from(await row.arrayBuffer()),headers:{etag:row.httpEtag}}:null;},putImmutable:(key,bytes,mime)=>bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:mime}}),putControl:(key,bytes,etag)=>bucket.put(key,bytes,{onlyIf:etag===null?{etagDoesNotMatch:'*'}:{etagMatches:etag.replaceAll('"','')}})};
 const commit=async value=>uploadRelease(r2,'',value,await r2.get('control/current.json'));
 await bucket.put('kao/0.png',PORTRAIT);await bucket.put('kao/p0001.png',TEMPLATE_PORTRAIT);
 const chapter=GAME+'#c1',v1=publication(0,GAME,[chapter]),v2=publication(1,GAME,[chapter]);await commit(v1);
 let admissions=0,files=0;
 const client=createPlayerReader({origin:'https://reader.test',fetch:(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');if(url.includes('/admissions?'))admissions++;if(url.includes('/file?'))files++;return mf.dispatchFetch(url,options);}});
 const first=await client.admit({gameId:GAME,ordinal:'1.0',chapterId:chapter});
 assert.equal(parse((await first.read('manifest')).bytes).identity.sourceDigest,first.identity.sourceDigest);
 assert.equal(parse((await first.read('chapter:'+chapter)).bytes).fixture,'0:'+chapter);assert.deepEqual(Buffer.from((await first.read('asset:p0001')).bytes),TEMPLATE_PORTRAIT);checks++;
 await commit(v2);assert.equal((await first.status()).ordinal,'1.1');assert.equal(first.identity.ordinal,'1.0');await assert.rejects(()=>first.read('chapter:'+chapter),e=>e.code==='RELEASE_CHANGED'&&e.status===409);assert.equal(first.state(),'outdated');
 await assert.rejects(()=>client.admit({gameId:GAME,ordinal:'1.0',chapterId:chapter}),e=>e.code==='RELEASE_CHANGED');checks++;
 const second=await client.admit({gameId:GAME,ordinal:'1.1',chapterId:chapter});assert.equal(parse((await second.read('chapter:'+chapter)).bytes).fixture,'1:'+chapter);checks++;
 await commit(unlisted(false,v2.directory[0]));assert.deepEqual((await second.status()).currentRelease,{releaseId:'r1',ordinal:'1.1'});assert.equal(parse((await second.read('chapter:'+chapter)).bytes).fixture,'1:'+chapter);
 await assert.rejects(()=>client.admit({gameId:GAME,ordinal:'1.1',chapterId:chapter}),e=>e.code==='GAME_NOT_LISTED');assert.equal(admissions,4);checks++;
 const oldFile=v2.files.find(row=>row.key.endsWith('/chapters/'+chapter+'.json'));await bucket.delete(oldFile.key);
 await assert.rejects(()=>second.read('chapter:'+chapter),e=>e.code==='RUNTIME_UNAVAILABLE'&&e.status===503);assert.equal(second.state(),'active');await bucket.put(oldFile.key,oldFile.bytes,{httpMetadata:{contentType:oldFile.contentType}});assert.equal(parse((await second.read('chapter:'+chapter)).bytes).fixture,'1:'+chapter);checks++;
 await commit(unlisted(true));await assert.rejects(()=>second.read('manifest'),e=>e.code==='GAME_DELETED'&&e.status===410);assert.equal(second.state(),'deleted');const count=files;await assert.rejects(()=>second.read('manifest'),e=>e.code==='GAME_DELETED');assert.equal(files,count);assert.ok(await bucket.get(oldFile.key),'deletion fact does not prove physical purge');checks++;
 await assert.rejects(first.status,e=>e.code==='RELEASE_CHANGED');assert.equal(first.state(),'outdated');assert.equal(admissions,4);assert.equal(outbound,0);checks++;
 process.stdout.write(JSON.stringify({checks,admissions,files,outbound,scope:'Real owned workerd/R2; client runs in Node, opaque fixtures, no engine/browser/save proof'})+'\n');
}finally{await mf?.dispose();rmSync(own,{recursive:true,force:true});}
