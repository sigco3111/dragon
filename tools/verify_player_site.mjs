// Local-only actual Assets router + read-only reader/workerd/R2. Minimal static
// and opaque release fixtures test routing, NOT production bytes or game UI.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import site from '../reader/site.js';
import {createHash} from 'node:crypto';
import {buildStaticRelease} from '../vps/static-release.mjs';
import {programRegistrationKey,programRegistrationBytes} from '../reader/programregistration.js';
import {createPlayerReader} from '../reader/playerclient.js';
import {uploadRelease} from '../vps/publish_to_r2.mjs';
import {GAME,PORTRAIT,TEMPLATE_PORTRAIT,publication,unlisted} from './fixtures/publication.mjs';
const parse=s=>{try{return JSON.parse(s);}catch(cause){throw new Error('owned JSON invalid',{cause});}};
const config=parse(readFileSync('wrangler.jsonc','utf8'));
assert.deepEqual(config,{name:'dragon',main:'reader/site.js',compatibility_date:'2025-04-01',build:{command:'node tools/prepare_deploy.mjs'},assets:{directory:'./dist',binding:'ASSETS',not_found_handling:'404-page',run_worker_first:['/play-api','/play-api/*','/program-assets','/program-assets/*','/','/index.html']},r2_buckets:[{binding:'PUBLISH_BUCKET',bucket_name:'dragon'}],vars:{PLAYER_ORIGIN:'https://dragon.720108.xyz',PLAYER_ADMISSION_ACTIVE_KEY:'primary'}});
assert.equal(Object.hasOwn(config.vars,'PLAYER_ADMISSION_KEYS'),false);
let checks=1,assetCalls=0,bucketReads=0;
const sentinel=new Response('owned static port'),env={ASSETS:{fetch(request){assetCalls++;assert.ok(request instanceof Request);return sentinel;}},get PUBLISH_BUCKET(){bucketReads++;throw new Error('owned unavailable binding');}};
assert.equal(await site.fetch({url:'not a URL'},env).then(r=>r.status),404);assert.equal(assetCalls,0);assert.equal(bucketReads,0);checks++;
for(const path of ['/','/index.html','/src/marker.js','/play-api-shadow.txt'])assert.equal(await site.fetch(new Request('https://site.test'+path),env),sentinel);
assert.equal(assetCalls,4);assert.equal(bucketReads,0);checks++;
for(const path of ['/play-api','/play-api/','/play-api/v1/unknown','/play-api/v2/registry'])assert.equal((await site.fetch(new Request('https://site.test'+path),env)).status,404);
for(const method of ['POST','HEAD','OPTIONS'])assert.equal((await site.fetch(new Request('https://site.test/play-api/v1/registry',{method}),env)).status,404);
assert.equal(assetCalls,4);assert.equal(bucketReads,0);checks++;
const unavailable=await site.fetch(new Request('https://site.test/play-api/v1/registry'),env);assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).error,'READER_UNAVAILABLE');assert.equal(assetCalls,4);assert.equal(bucketReads,1);checks++;
const require=createRequire(import.meta.url);let modulePath=process.env.MINIFLARE_MODULE;
if(!modulePath){try{modulePath=require.resolve('miniflare');}catch{modulePath=join(process.env.APPDATA??'','npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js');}}
if(!existsSync(modulePath))throw new Error('existing Miniflare required');
const {Miniflare}=await import(pathToFileURL(modulePath).href);
const programBytes=Buffer.from('export const archived = true;'),programPath='src/archived.js';
const shell=readFileSync('web/index.html');
const software=buildStaticRelease([{path:programPath,byteLength:programBytes.length,sha256:createHash('sha256').update(programBytes).digest('hex')},{path:'index.html',byteLength:shell.length,sha256:createHash('sha256').update(shell).digest('hex')}]);
const programURL='/program-assets/'+software.sha256+'/'+programPath;
const own=mkdtempSync(join(tmpdir(),'dragon-player-site-')),directory=join(own,'assets');let mf,outbound=0;
try{
 mkdirSync(directory);for(const[path,text]of Object.entries({'index.html':'<!doctype html><title>Owned builtin static</title>','404.html':'<!doctype html><title>Owned missing</title>','src/marker.js':'export const owned = true;','play-api/index.html':'DO NOT SERVE API SHADOW','play-api/v1/registry':'DO NOT SERVE API SHADOW','play-api/v1/unknown':'DO NOT SERVE API SHADOW','play-api-shadow.txt':'owned near-prefix static','program-assets/index.html':'DO NOT SERVE PROGRAM SHADOW','program-assets/not-a-program/x.js':'DO NOT SERVE PROGRAM SHADOW',[programURL.slice(1)]:'DO NOT SERVE REGISTERED PROGRAM SHADOW'})){const p=join(directory,path);mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,text,{flag:'wx'});}
 writeFileSync(join(directory,'static-release.json'),software.bytes,{flag:'wx'});
 const options={modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:resolve(config.main),compatibilityDate:config.compatibility_date,host:'127.0.0.1',port:0,
  assets:{directory,binding:config.assets.binding,routerConfig:{has_user_worker:true,static_routing:{user_worker:config.assets.run_worker_first}},assetConfig:{not_found_handling:config.assets.not_found_handling}},
  r2Buckets:[config.r2_buckets[0].binding],r2Persist:join(own,'r2'),bindings:{...config.vars,PLAYER_ORIGIN:'https://site.test'},outboundService:()=>{outbound++;return new Response('denied',{status:403});}};
 mf=new Miniflare(options);await mf.ready;
 const request=(path,init)=>mf.dispatchFetch('https://site.test'+path,init);
 const root=await request('/');assert.equal(root.status,200);assert.match(await root.text(),/Owned builtin static/);const head=await request('/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');checks++;
 const module=await request('/src/marker.js');assert.equal(module.status,200);assert.equal(await module.text(),'export const owned = true;');assert.equal(await (await request('/play-api-shadow.txt')).text(),'owned near-prefix static');checks++;
 const missing=await request('/unknown-owned-page');assert.equal(missing.status,404);assert.match(await missing.text(),/Owned missing/);checks++;
 for(const path of ['/play-api','/play-api/','/play-api/v1/unknown']){const r=await request(path,{redirect:'manual'});assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);assert.equal((await r.json()).error,'NOT_FOUND');}checks++;
 const empty=await request('/play-api/v1/registry');assert.equal(empty.status,503);assert.equal((await empty.json()).error,'REGISTRY_EMPTY');assert.equal(empty.headers.get('cache-control'),'no-store');checks++;
 for(const method of ['POST','HEAD','OPTIONS']){const r=await request('/play-api/v1/registry',{method});assert.equal(r.status,404);}checks++;
 let bucket=await mf.getR2Bucket('PUBLISH_BUCKET');
 const programBase='artifacts/programs/'+software.sha256+'/';
 await bucket.put(programBase+'files/'+programPath,programBytes,{httpMetadata:{contentType:'application/octet-stream'}});
 await bucket.put(programBase+'static-release.json',software.bytes,{httpMetadata:{contentType:'application/json'}});
 const entryQuery='?formalGame='+GAME+'&mode=new';
 const missingEntry=await request('/'+entryQuery);assert.equal(missingEntry.status,503);assert.doesNotMatch(await missingEntry.text(),/Owned builtin static|<script/);assert.equal((await request('/')).status,200);checks++;
 await bucket.put(programBase+'files/index.html',shell,{httpMetadata:{contentType:'application/octet-stream'}});
 const beforeRegistration=await request(programURL);assert.equal(beforeRegistration.status,503);assert.equal((await beforeRegistration.json()).error,'PROGRAM_ASSET_UNAVAILABLE');
 await bucket.put(programRegistrationKey(software.sha256),programRegistrationBytes(software.sha256,software.manifest.sourceTreeDigest),{httpMetadata:{contentType:'application/json'}});
 const archived=await request(programURL);assert.equal(archived.status,200);assert.equal(await archived.text(),programBytes.toString());assert.equal(archived.headers.get('content-type'),'text/javascript; charset=utf-8');checks++;
 for(const path of ['/'+entryQuery,'/index.html'+entryQuery]){
  const r=await request(path,{redirect:'manual'});assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('x-program-digest'),software.sha256);
  assert.equal(await r.text(),shell.toString().replace('<head>','<head>\n    <base href="/program-assets/'+software.sha256+'/" />'));
  const head=await request(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('x-program-digest'),software.sha256);
 }checks++;
 for(const path of ['/?mode=new','/?formalGame=invalid&mode=new','/?formalGame='+GAME+'&mode=new&mode=load','/index.html'+entryQuery+'&program='+software.sha256]){
  const r=await request(path,{redirect:'manual'});assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);
 }checks++;
 const r2={async get(key){const row=await bucket.get(key);return row?{bytes:Buffer.from(await row.arrayBuffer()),headers:{etag:row.httpEtag}}:null;},putImmutable:(key,bytes,mime)=>bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:mime}}),putControl:(key,bytes,etag)=>bucket.put(key,bytes,{onlyIf:etag===null?{etagDoesNotMatch:'*'}:{etagMatches:etag.replaceAll('"','')}})};
 const commit=async value=>uploadRelease(r2,'',value,await r2.get('control/current.json'));
 await bucket.put('kao/0.png',PORTRAIT);await bucket.put('kao/p0001.png',TEMPLATE_PORTRAIT);
 const chapter=GAME+'#c1',v1=publication(0,GAME,[chapter]),v2=publication(1,GAME,[chapter]);await commit(v1);
 let admissions=0;const client=createPlayerReader({origin:'https://site.test',fetch:(url,options)=>{if(url.includes('/admissions?'))admissions++;return mf.dispatchFetch(url,options);}});
 assert.equal((await client.registry()).directory[0].gameId,GAME);
 await assert.rejects(()=>client.admit({gameId:GAME,ordinal:'1.0',chapterId:chapter}),e=>e.code==='ADMISSION_NOT_CONFIGURED');
 assert.equal((await request('/')).status,200);checks++;
 // Only fixture keys, scoped to this owned workerd; never read cloud credentials.
 await mf.setOptions({...options,bindings:{...options.bindings,PLAYER_ADMISSION_KEYS:JSON.stringify({primary:'11'.repeat(32)})}});await mf.ready;bucket=await mf.getR2Bucket('PUBLISH_BUCKET');
 const first=await client.admit({gameId:GAME,ordinal:'1.0',chapterId:chapter});assert.equal(parse(new TextDecoder().decode((await first.read('chapter:'+chapter)).bytes)).fixture,'0:'+chapter);checks++;
 await commit(v2);assert.equal((await first.status()).ordinal,'1.1');assert.equal(first.identity.ordinal,'1.0');
 await assert.rejects(()=>client.admit({gameId:GAME,ordinal:'1.0',chapterId:chapter}),e=>e.code==='RELEASE_CHANGED');
 assert.equal(parse(new TextDecoder().decode((await first.read('chapter:'+chapter)).bytes)).fixture,'0:'+chapter);checks++;
 await commit(unlisted());assert.equal((await first.status()).listed,false);assert.equal((await first.read('manifest')).contentType,'application/json');
 await assert.rejects(()=>client.admit({gameId:GAME,ordinal:'1.1',chapterId:chapter}),e=>e.code==='GAME_NOT_LISTED');checks++;
 const oldFile=v1.files.find(row=>row.key.endsWith('/chapters/'+chapter+'.json'));await bucket.delete(oldFile.key);
 await assert.rejects(()=>first.read('chapter:'+chapter),e=>e.code==='RUNTIME_UNAVAILABLE'&&e.status===503);assert.equal(first.state(),'active');assert.equal((await request('/')).status,200);await bucket.put(oldFile.key,oldFile.bytes,{httpMetadata:{contentType:oldFile.contentType}});checks++;
 await commit(unlisted(true));await assert.rejects(first.status,e=>e.code==='GAME_DELETED'&&e.status===410);assert.equal(first.state(),'deleted');assert.ok(await bucket.get(oldFile.key));assert.equal((await request('/')).status,200);checks++;
 for(const path of ['/program-assets','/program-assets/','/program-assets/not-a-program/x.js']){const r=await request(path,{redirect:'manual'});assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);assert.equal((await r.json()).error,'PROGRAM_ASSET_NOT_FOUND');}checks++;
 const unregistered=await request('/program-assets/'+'a'.repeat(64)+'/src/main.js');assert.equal(unregistered.status,503);assert.equal((await unregistered.json()).error,'PROGRAM_ASSET_UNAVAILABLE');assert.equal((await request('/')).status,200);checks++;
 assert.equal((await request('/play-api/v1/file')).status,403);assert.equal((await request('/api/published-games')).status,404);assert.equal((await request('/play')).status,404);assert.equal(outbound,0);checks++;
 process.stdout.write(JSON.stringify({checks,admissions,outbound,scope:'Actual owned Miniflare Static Assets router and reader/workerd/R2 with minimal static/opaque runtime fixtures. Config path mapping explicit; no cloud, production asset build, browser App/public chooser or secret configuration proof.'})+'\n');
}finally{await mf?.dispose();rmSync(own,{recursive:true,force:true});}
