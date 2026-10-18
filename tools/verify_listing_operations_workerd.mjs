// Owned actual workerd SQLite; same model probes, then durable receipt replay
// after disposing/recreating the worker. No production credentials or stores.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let modulePath;
try { modulePath=createRequire(import.meta.url).resolve('miniflare'); }
catch { modulePath=join(process.env.APPDATA??'', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if(!existsSync(modulePath))throw new Error('installed Miniflare required; no automatic install');
const {Miniflare}=await import(pathToFileURL(modulePath).href);
const scratch=resolve('.dragon-analysis');mkdirSync(scratch,{recursive:true});
const own=mkdtempSync(join(scratch,'listing-operations-workerd-'));
let mf,outbound=0;
try {
 writeFileSync(join(own,'fixture.mjs'),`
import { DurableObject } from 'cloudflare:workers';
import { GameManagement } from '../../server/management.js';
import { exerciseListingOperations } from '../../tools/fixtures/listing-operations.mjs';
export class ListingFixture extends DurableObject {
 async fetch(request) {
  const storage={sql:this.ctx.storage.sql,transactionSync:fn=>this.ctx.storage.transactionSync(fn)};
  if(new URL(request.url).pathname==='/run') {
   try { return Response.json(exerciseListingOperations(storage)); }
   catch(error) { return Response.json({error:String(error),stack:error.stack},{status:500}); }
  }
  const principal=()=>storage.sql.exec('SELECT * FROM users').toArray()[0];
  const manager=new GameManagement({storage,principal,operationGuard:()=>{}});
  if(new URL(request.url).pathname==='/bound-receipt') return Response.json(manager.queryDistribution('owned','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','owned-bound-listing-retained'));
  return Response.json(manager.query('owned','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','owned-listing-operation-1'));
 }
}
export default {fetch(request,env){return env.OWNED.get(env.OWNED.idFromName('owned')).fetch(request);}};
`,{flag:'wx'});
 const options={modules:true,scriptPath:join(own,'fixture.mjs'),compatibilityDate:'2026-01-01',compatibilityFlags:['nodejs_compat'],modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],durableObjects:{OWNED:{className:'ListingFixture',useSQLite:true}},durableObjectsPersist:join(own,'state'),host:'127.0.0.1',port:0,outboundService:()=>{outbound++;return new Response('forbidden',{status:403});}};
 mf=new Miniflare(options);
 let response=await mf.dispatchFetch('https://owned.test/run');assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.equal(result.checks,25);assert.equal(result.binding.checks,24);
 await mf.dispose();mf=null;mf=new Miniflare(options);
 response=await mf.dispatchFetch('https://owned.test/receipt');assert.equal(response.status,200,await response.clone().text());
 assert.deepEqual(await response.json(),result.first);assert.equal(outbound,0);
 response=await mf.dispatchFetch('https://owned.test/bound-receipt');assert.equal(response.status,200,await response.clone().text());
 assert.deepEqual(await response.json(),result.binding.expected);assert.equal(outbound,0);
 process.stdout.write('listing operations workerd: 25 legacy + 24 association groups and both durable receipt restarts; outbound zero\n');
} finally {await mf?.dispose();rmSync(own,{recursive:true,force:true});}
