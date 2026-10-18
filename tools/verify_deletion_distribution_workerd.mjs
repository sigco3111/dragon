// Owned workerd SQLite, fixed fixture and exact persisted receipt across restart.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let modulePath;
try {modulePath=createRequire(import.meta.url).resolve('miniflare');}
catch {modulePath=join(process.env.APPDATA??'','npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js');}
if(!existsSync(modulePath)) {throw new Error('installed Miniflare required');}
const {Miniflare}=await import(pathToFileURL(modulePath).href);
mkdirSync('.dragon-analysis',{recursive:true});
const own=mkdtempSync(join(resolve('.dragon-analysis'),'deletion-distribution-'));
let mf,outbound=0;
try {
  writeFileSync(join(own,'fixture.mjs'),`
import {DurableObject} from 'cloudflare:workers';
import {exerciseDeletionDistribution,deletionModel,actorId,gameId} from '../../tools/fixtures/deletion-distribution.mjs';
export class Fixture extends DurableObject {
 async fetch(request) {
  const storage={sql:this.ctx.storage.sql,transactionSync:fn=>this.ctx.storage.transactionSync(fn)};
  try {
   if(new URL(request.url).pathname==='/run') return Response.json(exerciseDeletionDistribution(storage));
   return Response.json(deletionModel(storage).queryDistribution(actorId,'owned-deletion-binding-01',gameId));
  } catch(error) {return Response.json({error:String(error),stack:error.stack},{status:500});}
 }
}
export default {fetch(request,env){return env.OWNED.get(env.OWNED.idFromName('owned')).fetch(request);}};
`,{flag:'wx'});
  const options={modules:true,scriptPath:join(own,'fixture.mjs'),compatibilityDate:'2026-01-01',compatibilityFlags:['nodejs_compat'],modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],durableObjects:{OWNED:{className:'Fixture',useSQLite:true}},durableObjectsPersist:join(own,'state'),host:'127.0.0.1',port:0,outboundService:()=>{outbound++;return new Response('forbidden',{status:403});}};
  mf=new Miniflare(options);
  let reply=await mf.dispatchFetch('https://owned.test/run');assert.equal(reply.status,200,await reply.clone().text());
  const result=await reply.json();assert.equal(result.checks,31);
  await mf.dispose();mf=null;mf=new Miniflare(options);
  reply=await mf.dispatchFetch('https://owned.test/receipt');assert.equal(reply.status,200,await reply.clone().text());
  assert.deepEqual(await reply.json(),result.expected);assert.equal(outbound,0);
  process.stdout.write('deletion distribution: 31 shared groups and durable receipt restart; outbound zero\n');
} finally {await mf?.dispose();rmSync(own,{recursive:true,force:true});}
