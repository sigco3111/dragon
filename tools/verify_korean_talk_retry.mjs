// Synthetic transient fetch failures, not a claim about the past Chinese line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOptionalJSONWithRetry } from '../web/src/core/assets.js';

test('Korean optional JSON retries one failed response then recovers', async () => {
  let calls=0;
  globalThis.fetch=async () => (++calls===1 ? {ok:false} : {ok:true,json:async()=>({records:{559:['한국어']}})});
  assert.deepEqual(await loadOptionalJSONWithRetry('retry-ko-test.json'), {records:{559:['한국어']}});
  assert.equal(calls,2);
});
test('Korean optional JSON fails boundedly and can recover on next call', async () => {
  let calls=0;
  globalThis.fetch=async () => {calls++;throw new Error('synthetic offline');};
  assert.equal(await loadOptionalJSONWithRetry('retry-ko-offline.json'), null);
  assert.equal(calls,2);
  globalThis.fetch=async () => {calls++;return {ok:true,json:async()=>({582:['복구']})};};
  assert.deepEqual(await loadOptionalJSONWithRetry('retry-ko-offline.json'), {582:['복구']});
  assert.equal(calls,3);
});

test('strategy quote does not permanently cache Chinese fallback after two Korean failures', async () => {
  const {readFile}=await import('node:fs/promises');
  const original=JSON.parse(await readFile(new URL('../web/talk.json',import.meta.url)));
  const korean=JSON.parse(await readFile(new URL('../web/talk_ko.json',import.meta.url)));
  let koCalls=0;
  globalThis.fetch=async (url) => {
    if(url==='talk_ko.json'){
      koCalls++;
      if(koCalls<=2)throw new Error('synthetic Korean offline');
      return {ok:true,json:async()=>korean};
    }
    assert.equal(url,'talk.json');
    return {ok:true,json:async()=>original};
  };
  const {quoteFor}=await import('../web/src/game/talk.js');
  const general={idx:1,talk_idx:1,status:0,ability:{siege:8,field:1,naval:1}};
  const fallback=await quoteFor(general);
  assert.deepEqual(fallback.lines, original.strings[559]);
  assert.equal(koCalls,2);
  const recovered=await quoteFor(general);
  assert.deepEqual(recovered.lines, korean.records[559]);
  assert.equal(koCalls,3);
});
