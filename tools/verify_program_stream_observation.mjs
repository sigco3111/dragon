// Negative controls for the test-only completed-stream classifier. No I/O.
import assert from 'node:assert/strict';
import { assertCompletedProgramStream } from './fixtures/player-client-browser.mjs';
const origin='https://reader.test',basePath='/program-assets/'+'a'.repeat(64)+'/',path='content/builtin/compiled/map-2-'+'b'.repeat(64)+'/map_tiles_spring.png',sha256='c'.repeat(64);
let checks=0;
function fixture(){return{event:{path:basePath+path,error:'net::ERR_ABORTED',sequence:'4000001'},traces:[{sequence:'4000001',completed:true,cancelled:false,status:200,bytes:4}],calls:[{sequence:'4000001',origin,path:basePath+path,status:200,bytes:4,sha256}],policy:{origin,basePath,files:new Map([[path,{kind:'asset',sha256,byteLength:4}]])}};}
const run=f=>assertCompletedProgramStream(f.event,f.traces,f.calls,f.policy);
const good=run(fixture());assert.equal(good.bytes,4);assert.ok(Object.isFrozen(good));checks++;
for(const mutate of [
 f=>{f.event.error='net::ERR_FAILED';}, f=>{f.event.sequence=null;}, f=>{f.event.sequence='0';},
 f=>{f.traces=[];}, f=>{f.traces.push({...f.traces[0]});}, f=>{f.calls=[];}, f=>{f.calls.push({...f.calls[0]});},
 f=>{f.traces[0].completed=false;}, f=>{f.traces[0].cancelled=true;}, f=>{f.traces[0].status=503;},
 f=>{f.calls[0].status=503;}, f=>{f.calls[0].origin='https://other.test';}, f=>{f.calls[0].path+='/extra';},
 f=>{f.calls[0].sha256='d'.repeat(64);}, f=>{f.calls[0].bytes=3;}, f=>{f.traces[0].bytes=3;},
 f=>{f.traces[0].bytes=f.calls[0].bytes=0;f.policy.files.get(path).byteLength=0;},
 f=>{f.traces[0].bytes=f.calls[0].bytes=NaN;f.policy.files.get(path).byteLength=NaN;},
 f=>{f.traces[0].bytes=f.calls[0].bytes=Number.MAX_SAFE_INTEGER+1;f.policy.files.get(path).byteLength=f.calls[0].bytes;},
 f=>{f.policy.files.clear();},f=>{f.policy.files.get(path).kind='configuration';},
 f=>{delete f.policy.files.get(path).sha256;delete f.calls[0].sha256;},
 f=>{f.event.path='/'+path;},f=>{f.policy.basePath='/program-assets/'+'d'.repeat(64)+'/';},
 f=>{f.event.path=basePath+'src/boot.js';},f=>{f.event.path+='?x=1';},f=>{f.event.path=basePath+path.replace('spring','unknown');},
 f=>{f.policy.basePath+='\n';f.event.path=f.policy.basePath+path;f.calls[0].path=f.event.path;},
]){const f=fixture();mutate(f);assert.throws(()=>run(f),assert.AssertionError);checks++;}
process.stdout.write(JSON.stringify({checks,scope:'Exact positive and independent negative controls for test-only PNG EOF observation; no suppression of incomplete/cancelled/error/mismatched or unrecognized requests.'})+'\n');
