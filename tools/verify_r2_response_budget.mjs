// Actual signed HTTPS client, in-process exact dummy-host interception only.
// No sockets, cloud credentials or real objects; always restore the builtin.
import assert from 'node:assert/strict';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { r2client } from '../vps/r2client.mjs';
import { MAX_METADATA_BYTES, MAX_RESOURCE_BYTES } from '../reader/runtimecontract.js';
const original = https.request;
const credentials = { accountId: '00000000000000000000000000000000', accessKeyId: 'owned-access', secretAccessKey: 'owned-secret', bucket: 'owned-fixture' };
const url = 'https://00000000000000000000000000000000.r2.cloudflarestorage.com/owned-fixture/test/budget/object';
let plan, calls = 0, checks = 0, last, interval;
https.request = (target, options, callback) => {
  assert.equal(target, url); assert.equal(options.rejectUnauthorized, true);
  assert.ok(['GET', 'PUT', 'DELETE'].includes(options.method));
  assert.ok(options.headers.Authorization ?? options.headers.authorization);
  calls++; const spec = plan;
  const req = new EventEmitter(), state = { requestDestroyed: false, responseDestroyed: false, bodyEvents: 0, applied: false };
  last = state;
  req.destroy = () => { state.requestDestroyed = true; clearInterval(interval); };
  req.end = () => queueMicrotask(() => {
    if (spec.noResponse) return;
    const res = new EventEmitter(); res.statusCode = spec.status ?? 200; res.headers = spec.headers ?? {}; res.complete = spec.complete ?? true;
    res.destroy = () => { if (!state.responseDestroyed) { state.responseDestroyed = true; res.emit('close'); } };
    callback(res); if (state.responseDestroyed) return;
    const data = bytes => { state.bodyEvents++; res.emit('data', bytes); };
    if (spec.stream) {
      data(Buffer.from('a')); interval = setInterval(() => data(Buffer.from('b')), 3); return;
    }
    if (spec.applied) state.applied = true;
    for (const bytes of spec.chunks ?? []) data(bytes);
    if (spec.event) {
      if (spec.event === 'request-error') req.emit('error', new Error('owned request error'));
      else res.emit(spec.event, spec.event === 'error' ? new Error('owned response error') : undefined);
    } else { res.emit('end'); res.emit('close'); }
    // Late events cannot turn a rejected/aborted read into success.
    if (spec.lateEnd) { data(Buffer.from('late')); res.emit('end'); }
  });
  return req;
};
syncBuiltinESMExports();
try {
  const client = r2client(credentials), key = 'test/budget/object';
  plan = { headers: { 'content-length': '4' }, chunks: [Buffer.from('ab'), Buffer.from('cd')] };
  assert.equal((await client.get(key, { maxBytes: 4 })).bytes.toString(), 'abcd'); assert.equal(last.requestDestroyed, false); checks++;
  plan = { chunks: [Buffer.from('ab'), Buffer.from('cd')] };
  assert.equal((await client.get(key, { maxBytes: 4 })).bytes.toString(), 'abcd'); checks++;
  plan = { headers: { 'content-length': '0' } };
  assert.equal((await client.get(key)).bytes.length, 0); checks++;
  plan = { headers: { 'content-length': '5' }, chunks: [Buffer.alloc(5)] };
  await assert.rejects(client.get(key, { maxBytes: 4 }), /R2_RESPONSE_BUDGET/);
  assert.equal(last.bodyEvents, 0); assert.equal(last.responseDestroyed, true); assert.equal(last.requestDestroyed, true); checks++;
  plan = { chunks: [Buffer.from('abc'), Buffer.from('de')], lateEnd: true };
  await assert.rejects(client.get(key, { maxBytes: 4 }), /R2_RESPONSE_BUDGET/); assert.equal(last.requestDestroyed, true); checks++;
  for (const header of ['-1', '1.5', 'bad', ['4', '4'], '9007199254740992']) {
    plan = { headers: { 'content-length': header } };
    await assert.rejects(client.get(key), /R2_RESPONSE_LENGTH/); assert.equal(last.bodyEvents, 0); checks++;
  }
  plan = { headers: { 'content-length': '4' }, chunks: [Buffer.from('abc')] };
  await assert.rejects(client.get(key), /R2_RESPONSE_TRUNCATED/); checks++;
  plan = { headers: { 'content-length': '2' }, chunks: [Buffer.from('abc')] };
  await assert.rejects(client.get(key), /R2_RESPONSE_LENGTH/); checks++;
  for (const event of ['aborted', 'close', 'error', 'request-error']) {
    plan = { event, chunks: [Buffer.from('a')], lateEnd: true };
    await assert.rejects(client.get(key)); assert.equal(last.requestDestroyed, true); checks++;
  }
  plan = { complete: false, chunks: [Buffer.from('abc')] };
  await assert.rejects(client.get(key), /R2_RESPONSE_TRUNCATED/); checks++;
  plan = { chunks: ['string-chunk-not-native-bytes'] };
  await assert.rejects(client.get(key), /R2_RESPONSE_CHUNK/); checks++;
  plan = { noResponse: true };
  await assert.rejects(r2client({ ...credentials, timeoutMs: 25 }).get(key), /R2_REQUEST_TIMEOUT/);
  assert.equal(last.requestDestroyed, true); checks++;
  plan = { stream: true };
  await assert.rejects(r2client({ ...credentials, timeoutMs: 25 }).get(key), /R2_REQUEST_TIMEOUT/);
  assert.ok(last.bodyEvents > 0); assert.equal(last.responseDestroyed, true); assert.equal(last.requestDestroyed, true); checks++;
  for (const maxBytes of [0, -1, 1.2, Infinity, MAX_RESOURCE_BYTES + 1, '4']) {
    const before = calls;
    await assert.rejects(client.get(key, { maxBytes }), TypeError); assert.equal(calls, before);
  } checks++;
  for (const timeoutMs of [0, -1, 1.2, Infinity, 120001, '25']) assert.throws(() => r2client({ ...credentials, timeoutMs }), TypeError);
  checks++;
  plan = { headers: { 'content-length': String(MAX_RESOURCE_BYTES + 1) } };
  await assert.rejects(client.get(key), /R2_RESPONSE_BUDGET/); assert.equal(last.bodyEvents, 0); checks++;
  plan = { headers: { 'content-length': String(MAX_METADATA_BYTES + 1) } };
  await assert.rejects(client.putImmutable(key, Buffer.from('owned')), /R2_RESPONSE_BUDGET/); checks++;
  plan = { applied: true, event: 'aborted' };
  await assert.rejects(client.putControl(key, Buffer.from('owned')), /R2_RESPONSE_ABORTED/);
  assert.equal(last.applied, true); checks++; // Unknown write result, NOT rollback.
  plan = { status: 404, headers: { 'content-length': '0' } };
  assert.equal(await client.get(key), null); checks++;
  plan = { status: 404, headers: { 'content-length': '2' }, chunks: [Buffer.from('a')] };
  await assert.rejects(client.get(key), /R2_RESPONSE_TRUNCATED/); checks++;
  for (const status of [302, 403, 412, 500]) {
    plan = { status }; const before = calls;
    await assert.rejects(client.get(key), new RegExp('R2 get ' + status)); assert.equal(calls, before + 1);
  } checks++;
} finally { clearInterval(interval); https.request = original; syncBuiltinESMExports(); }
assert.equal(checks, 28);
process.stdout.write('R2 response budgets: 28 groups green; actual signed client with in-process HTTPS interception, no sockets/cloud; response limit, total deadline, abort/length checks, unknown-write distinction\n');
