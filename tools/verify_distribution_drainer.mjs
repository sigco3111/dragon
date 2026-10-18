// Owned clocks and memory SQLite/R2 only. Not a service deployment or game proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { createDistributionDrainer } from '../vps/distribution-drainer.mjs';
import { createDistributionPublisher } from '../vps/distribution-publisher.mjs';
import { openStorage } from '../vps/sqlite-port.mjs';
let checks = 0;
const check = () => checks++;
function clock() {
  let serial = 0;
  const tasks = new Map();
  return {
    tasks,
    setTimeout(fn, delay) { const id = ++serial; tasks.set(id, { fn, delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    async fire() { assert.equal(tasks.size, 1); const [id, task] = [...tasks][0]; tasks.delete(id); task.fn(); await setImmediate(); },
    delay() { assert.equal(tasks.size, 1); return [...tasks.values()][0].delay; },
  };
}
function fixture() {
  const timers = clock(); let calls = 0, reason = null, unreadable = false;
  let run = async () => ({ state: 'IDLE' });
  const publisher = {
    ledger: { status() { if (unreadable) throw new Error('private SQL detail'); return { blockedReason: reason }; } },
    async drainOne() { calls++; return run(); },
  };
  const loop = createDistributionDrainer({ publisher, intervalMs: 37, timers });
  return { timers, publisher, loop, calls: () => calls, run(fn) { run = fn; }, block(value) { reason = value; }, unreadable() { unreadable = true; } };
}
for (const intervalMs of [undefined, null, 0, -1, 0.5, NaN, Infinity, 2147483648, '37']) {
  assert.throws(() => createDistributionDrainer({ publisher: fixture().publisher, intervalMs }), TypeError); check();
}
assert.throws(() => createDistributionDrainer({ publisher: {}, intervalMs: 1 }), TypeError);
assert.throws(() => createDistributionDrainer({ publisher: fixture().publisher, intervalMs: 1, timers: {} }), TypeError); check();
{
  const f = fixture(); assert.equal(f.calls(), 0); assert.equal(f.timers.tasks.size, 0);
  assert.equal(f.loop.status().state, 'created'); assert.ok(Object.isFrozen(f.loop.status()));
  await f.loop.stop(); assert.equal(f.loop.start(), false); assert.equal(f.loop.status().state, 'stopped'); check();
}
{
  const f = fixture(); assert.equal(f.loop.start(), true); assert.equal(f.loop.start(), false); assert.equal(f.timers.delay(), 0);
  await f.timers.fire(); assert.equal(f.calls(), 1); assert.equal(f.timers.delay(), 37); assert.equal(f.loop.status().lastResult, 'IDLE');
  await f.loop.stop(); assert.equal(f.timers.tasks.size, 0); assert.equal(f.loop.start(), false); check();
}
for (const outcome of ['VISIBLE_CONFIRMED', 'COMMITTED_SYNC_PENDING', 'RETRYABLE_ERROR']) {
  const f = fixture(); f.run(async () => { if (outcome === 'RETRYABLE_ERROR') throw new Error('private transport detail'); return { state: outcome }; });
  f.loop.start(); await f.timers.fire();
  assert.equal(f.loop.status().lastResult, outcome); assert.equal(f.timers.delay(), outcome === 'VISIBLE_CONFIRMED' ? 0 : 37);
  assert.equal(f.loop.status().attempts, 1); assert.equal(JSON.stringify(f.loop.status()).includes('private'), false);
  await f.loop.stop(); check();
}
for (const reason of ['REMOTE_AHEAD', 'AUTHORITY_MISMATCH', 'REMOTE_GAP', 'LEGACY_PENDING']) {
  const f = fixture(); f.block(reason); f.loop.start(); await f.timers.fire();
  assert.equal(f.calls(), 0); assert.equal(f.loop.status().state, 'blocked'); assert.equal(f.loop.status().blockedReason, reason); assert.equal(f.timers.tasks.size, 0);
  f.block(null); assert.equal(f.loop.start(), false, 'no auto-unblock/restart'); await f.loop.stop(); check();
}
{
  const f = fixture(); f.run(async () => { f.block('REMOTE_AHEAD'); throw new Error('network-looking failure'); });
  f.loop.start(); await f.timers.fire(); assert.equal(f.loop.status().lastResult, 'RECOVERY_REQUIRED'); assert.equal(f.timers.tasks.size, 0); await f.loop.stop(); check();
}
for (const after of [false, true]) {
  const f = fixture(); if (after) f.run(async () => { f.unreadable(); return { state: 'IDLE' }; }); else f.unreadable();
  f.loop.start(); await f.timers.fire(); assert.equal(f.calls(), after ? 1 : 0); assert.equal(f.loop.status().state, 'faulted');
  assert.equal(f.loop.status().lastResult, 'STATUS_UNAVAILABLE'); assert.equal(f.timers.tasks.size, 0); await f.loop.stop(); check();
}
{
  const f = fixture(); f.block('UNRECOGNIZED'); f.loop.start(); await f.timers.fire();
  assert.equal(f.calls(), 0); assert.equal(f.loop.status().lastResult, 'STATUS_UNAVAILABLE'); await f.loop.stop(); check();
}
{
  const f = fixture(); f.run(async () => ({ state: 'pretend-success' })); f.loop.start(); await f.timers.fire();
  assert.equal(f.loop.status().lastResult, 'INVALID_RESULT'); assert.equal(f.timers.tasks.size, 0); await f.loop.stop(); check();
}
{
  const f = fixture(); f.timers.setTimeout = () => { throw new Error('timer unavailable'); };
  assert.equal(f.loop.start(), false); assert.equal(f.loop.status().lastResult, 'SCHEDULER_UNAVAILABLE'); await f.loop.stop(); check();
}
{
  const f = fixture(); f.run(async () => { f.timers.setTimeout = () => { throw new Error('timer retired'); }; return { state: 'IDLE' }; });
  f.loop.start(); await f.timers.fire(); assert.equal(f.loop.status().lastResult, 'SCHEDULER_UNAVAILABLE');
  assert.equal(f.timers.tasks.size, 0); await f.loop.stop(); check();
}
{
  const f = fixture(); f.loop.start(); const queued = [...f.timers.tasks.values()][0].fn;
  await f.loop.stop(); queued(); await setImmediate();
  assert.equal(f.calls(), 0); assert.equal(f.loop.status().state, 'stopped'); assert.equal(f.timers.tasks.size, 0); check();
}
for (const result of ['VISIBLE_CONFIRMED', 'COMMITTED_SYNC_PENDING', 'RETRYABLE_ERROR']) {
  const f = fixture(); let release, acknowledged = false, stopped = false;
  const gate = new Promise(resolve => { release = resolve; });
  f.run(async () => { await gate; acknowledged = true; if (result === 'RETRYABLE_ERROR') throw new Error('owned in-flight error'); return { state: result }; });
  f.loop.start(); await f.timers.fire(); assert.equal(f.loop.status().state, 'running'); assert.equal(f.timers.tasks.size, 0);
  assert.equal(f.loop.start(), false); assert.equal(f.calls(), 1);
  const stop = f.loop.stop(); assert.equal(f.loop.stop(), stop); void stop.then(() => { stopped = true; });
  await setImmediate(); assert.equal(stopped, false); assert.equal(acknowledged, false);
  release(); await stop; assert.equal(acknowledged, true); assert.equal(f.loop.status().state, 'stopped'); assert.equal(f.timers.tasks.size, 0); check();
}
// Actual platform timers: no manual wake or polling call drives the three attempts.
{
  let calls = 0, done;
  const finished = new Promise(resolve => { done = resolve; });
  const publisher = { ledger: { status: () => ({ blockedReason: null }) }, async drainOne() {
    calls++; if (calls === 1) return { state: 'COMMITTED_SYNC_PENDING' };
    if (calls === 2) return { state: 'VISIBLE_CONFIRMED' };
    done(); return { state: 'IDLE' };
  } };
  const loop = createDistributionDrainer({ publisher, intervalMs: 5 });
  let deadline;
  try {
    loop.start(); await Promise.race([finished, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('owned timer deadline')), 3000); })]);
    await loop.stop(); assert.equal(calls, 3); check();
  } finally { clearTimeout(deadline); await loop.stop(); }
}
// Real publisher and ledger: exact retained operations survive a receipt outage;
// the scheduler never performs its own SQL ack, regeneration or rollback.
{
  const storage = openStorage(':memory:'), objects = new Map(), timers = clock();
  let receiptOutage = true, controls = 0;
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const put = (key, bytes, type) => objects.set(key, { bytes: Buffer.from(bytes), headers: { etag: '"' + sha(bytes) + '"', 'content-type': type, 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } });
  const r2 = {
    async get(key) { const value = objects.get(key); return value ? { bytes: Buffer.from(value.bytes), headers: { ...value.headers } } : null; },
    async putImmutable(key, bytes, type) {
      if (receiptOutage && key.startsWith('control/receipts/')) throw new Error('owned receipt outage');
      if (!objects.has(key)) put(key, bytes, type); else assert.deepEqual(objects.get(key).bytes, Buffer.from(bytes));
    },
    async putControl(key, bytes, etag) {
      const old = objects.get(key); if (etag === null ? old !== undefined : old?.headers.etag !== etag) return false;
      controls++; put(key, bytes, 'application/json'); return true;
    },
  };
  const make = () => createDistributionPublisher({ storage, r2, verifyResources: async () => {} });
  const publisher = make(), loop = createDistributionDrainer({ publisher, intervalMs: 37, timers });
  let resumed;
  try {
    for (const n of [1, 2]) storage.transactionSync(() => publisher.ledger.enqueueInTxn({ operationId: 'cccccccc-cccc-4ccc-8ccc-' + String(n).padStart(12, '0'), kind: 'listing', gameId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', payload: Buffer.from(JSON.stringify({ version: 1, projection: { marker: 'retained-' + n } })) }));
    const payload = publisher.ledger.entry(1).payload;
    loop.start(); await timers.fire(); assert.equal(loop.status().lastResult, 'COMMITTED_SYNC_PENDING');
    assert.equal(controls, 1); assert.equal(publisher.ledger.status().confirmedGeneration, 0); assert.equal(timers.delay(), 37);
    await loop.stop(); assert.equal(timers.tasks.size, 0); check();
    receiptOutage = false;
    const next = make(); resumed = createDistributionDrainer({ publisher: next, intervalMs: 37, timers }); resumed.start();
    await timers.fire(); assert.equal(next.ledger.status().confirmedGeneration, 1); assert.equal(controls, 1); assert.equal(timers.delay(), 0);
    assert.deepEqual(next.ledger.entry(1).payload, payload); check();
    await timers.fire(); assert.equal(next.ledger.status().confirmedGeneration, 2); assert.equal(controls, 2); assert.equal(timers.delay(), 0);
    await timers.fire(); assert.equal(resumed.status().lastResult, 'IDLE'); assert.equal(timers.delay(), 37); check();
    objects.delete('control/current.json'); await timers.fire();
    assert.equal(next.ledger.status().blockedReason, 'REMOTE_GAP'); assert.equal(resumed.status().state, 'blocked'); assert.equal(timers.tasks.size, 0); assert.equal(controls, 2); check();
  } finally { await resumed?.stop(); await loop.stop(); storage.close(); }
}
process.stdout.write(JSON.stringify({ checks, scope: 'process-local single-flight timers; actual memory SQLite/publisher with conditional memory R2 and explicit resource-verifier seam, no production/game/HTTP proof' }) + '\n');
