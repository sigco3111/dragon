// Exact EOF correlation only. No browser, network or application privileges.
import assert from 'node:assert/strict';
import { assertCompletedStreamObservation } from './fixtures/player-client-browser.mjs';
const origin='https://reader.test';
const observe=f=>assertCompletedStreamObservation(f.event,f.traces,f.calls,origin);
let checks=0;
for(const path of ['/play-api/v1/file','/play-api/v1/registry']){
const base=()=>({event:{sequence:'1',path,error:'net::ERR_ABORTED'},traces:[{sequence:'1',completed:true,cancelled:false,bytes:24,status:200}],calls:[{sequence:'1',origin,path,bytes:24,status:200}]});
for(const status of [200,410]){const f=base();f.traces[0].status=status;f.calls[0].status=status;assert.equal(observe(f).status,status);assert.ok(Object.isFrozen(observe(f)));checks++;}
for(const mutate of [
 f=>{f.event.error='net::ERR_FAILED';}, f=>{f.event.sequence=null;}, f=>{f.event.sequence='2';},
 f=>{f.event.path='/api/publish';}, f=>{f.traces=[];}, f=>{f.traces.push({...f.traces[0]});},
 f=>{f.calls=[];}, f=>{f.calls.push({...f.calls[0]});}, f=>{f.calls[0].origin='https://foreign.test';},
 f=>{f.calls[0].path='/play-api/v1/admissions';}, f=>{f.traces[0].completed=false;},
 f=>{f.traces[0].cancelled=true;}, f=>{f.traces[0].status=503;}, f=>{f.traces[0].bytes--;},
 f=>{f.traces[0].bytes=0;f.calls[0].bytes=0;}, f=>{f.traces[0].bytes=1.5;f.calls[0].bytes=1.5;},
]){const f=base();mutate(f);assert.throws(()=>observe(f),assert.AssertionError);checks++;}
}
process.stdout.write(JSON.stringify({checks,scope:'Reject incomplete, cancelled, mismatched, duplicate or unrelated browser EOF observations; no network/game proof'})+'\n');
