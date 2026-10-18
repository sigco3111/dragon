// Owned loopback/file SQLite/FileBucket + conditional memory R2 only.
// Uses the default publisher resource validator, but empty synthetic projections:
// not a compiled-game, browser, TLS/S3, production CLI or physical-delete proof.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, createServer } from 'node:http';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { FrozenDistributionLedger } from '../server/distributionledger.js';
import { startPublicationServer } from '../vps/publication-server.mjs';
const own = mkdtempSync(join(tmpdir(), 'dragon-publication-service-'));
const env = { EDITOR_ORIGIN: 'https://owned-editor.invalid', EDITOR_REQUEST_KEY: 'a'.repeat(64), EDITOR_DEFAULT_PASSWORD: 'Owned publication password only!' };
const prefix = 'test/lifecycle/';
let checks = 0;
const check = () => checks++;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const emptyPayload = () => Buffer.from(JSON.stringify({ version: 1, projection: { runtimeVersion: 1, directory: [], releases: [], announcements: [], gameStates: [] } }));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function until(test) {
  const deadline = Date.now() + 5000;
  while (!test()) { if (Date.now() >= deadline) throw new Error('owned service deadline'); await delay(5); }
}
function memoryR2() {
  const objects = new Map(); let reads = 0, controls = 0, immutable = 0;
  let beforeGet = async () => {}, beforeImmutable = async () => {};
  const put = (key, bytes, type) => objects.set(key, { bytes: Buffer.from(bytes), headers: { etag: '"' + sha(bytes) + '"', 'content-type': type, 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } });
  const r2 = {
    async get(key, options) { reads++; assert.ok(options.maxBytes > 0); await beforeGet(key); const value = objects.get(key); return value ? { bytes: Buffer.from(value.bytes), headers: { ...value.headers } } : null; },
    async putImmutable(key, bytes, type) { assert.equal(arguments.length, 3); await beforeImmutable(key); immutable++; if (!objects.has(key)) put(key, bytes, type); else assert.deepEqual(objects.get(key).bytes, Buffer.from(bytes)); },
    async putControl(key, bytes, etag) { assert.equal(arguments.length, 3); const prior = objects.get(key); if (etag === null ? prior !== undefined : prior?.headers.etag !== etag) return false; controls++; put(key, bytes, 'application/json'); return true; },
  };
  return { r2, objects, put, counts: () => ({ reads, controls, immutable }), onGet(fn) { beforeGet = fn; }, onImmutable(fn) { beforeImmutable = fn; } };
}
function ledger(storage) { return new FrozenDistributionLedger({ storage, verifyReceipt() { throw new Error('no test acknowledgement capability'); } }); }
function enqueue(storage, payload = emptyPayload(), kind = 'bootstrap') {
  const value = ledger(storage);
  storage.transactionSync(() => value.enqueueInTxn({ operationId: randomUUID(), kind, gameId: kind === 'bootstrap' ? null : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', payload }));
  return value;
}
function http(port, path = '/api/health', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { Host: 'owned-editor.invalid', Connection: 'close', ...headers } }, res => {
      const chunks = []; res.on('data', bytes => chunks.push(bytes)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(3000, () => req.destroy(new Error('owned HTTP deadline'))); req.on('error', reject); req.end();
  });
}
let storage, service, blocker, slow, receiptGate;
try {
  const bucket = new FileBucket({ root: join(own, 'private') });
  const defaults = s => ({ storage: s, bucket, env, r2: memoryR2().r2, verifyStaticResources: async () => { throw new Error('empty projection must not request static files'); }, intervalMs: 10, prefix, port: 0 });
  for (const changes of [{ intervalMs: 0 }, { intervalMs: '10' }, { intervalMs: 2147483648 }, { verifyStaticResources: undefined }, { r2: {} }, { bucket: {} }, { host: 'foreign.invalid' }, { port: -1 }, { prefix: '../escape/' }, { env: { ...env, EDITOR_ORIGIN: 'http://owned-editor.invalid' } }]) {
    storage = openStorage(':memory:');
    await assert.rejects(startPublicationServer({ ...defaults(storage), ...changes }));
    assert.equal(storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table'").toArray().length, 0);
    storage.close(); storage = null; check();
  }
  // Preflight transport failure cannot start listening or initialize auth tables.
  storage = openStorage(':memory:'); let remote = memoryR2();
  remote.onGet(async () => { throw new Error('owned preflight outage'); });
  await assert.rejects(startPublicationServer({ ...defaults(storage), r2: remote.r2 }), /owned preflight outage/);
  assert.equal(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='users'").toArray().length, 0);
  assert.equal(remote.counts().controls, 0); storage.close(); storage = null; check();
  // Legacy roots and existing recovery locks are never silently migrated/unlocked.
  storage = openStorage(':memory:'); remote = memoryR2();
  remote.put(prefix + 'control/current.json', Buffer.from('{"version":1}'), 'application/json');
  await assert.rejects(startPublicationServer({ ...defaults(storage), r2: remote.r2 }), /LEGACY_PENDING/);
  assert.equal(ledger(storage).status().blockedReason, 'LEGACY_PENDING');
  assert.equal(storage.sql.exec("SELECT name FROM sqlite_master WHERE name='users'").toArray().length, 0);
  const reads = remote.counts().reads;
  await assert.rejects(startPublicationServer({ ...defaults(storage), r2: remote.r2 }), /LEGACY_PENDING/);
  assert.equal(remote.counts().reads, reads); assert.equal(remote.counts().controls, 0);
  storage.close(); storage = null; check();
  // Bind failure must not start a drainer or publish an existing pending row.
  blocker = createServer(); await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve));
  storage = openStorage(':memory:'); remote = memoryR2(); const pending = enqueue(storage);
  await assert.rejects(startPublicationServer({ ...defaults(storage), r2: remote.r2, port: blocker.address().port }), error => error.code === 'EADDRINUSE');
  await delay(25); assert.equal(pending.status().confirmedGeneration, 0); assert.equal(remote.counts().controls, 0);
  await new Promise(resolve => blocker.close(resolve)); blocker = null; storage.close(); storage = null; check();
  // Actual Node listener + real platform timers; no direct drainOne calls.
  const database = join(own, 'authority.sqlite'); storage = openStorage(database); remote = memoryR2();
  const value = enqueue(storage), frozen = value.entry(1).payload;
  receiptGate = deferred(); const reachedReceipt = deferred();
  remote.onImmutable(async key => { if (key.includes('/receipts/')) { reachedReceipt.resolve(); await receiptGate.promise; throw new Error('owned lost receipt'); } });
  service = await startPublicationServer({ ...defaults(storage), r2: remote.r2 });
  const port = service.address.port;
  const health = await http(port); assert.equal(health.status, 200); assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal((await http(port, '/api/session')).status, 401);
  assert.equal((await http(port, '/api/health', { Host: 'foreign.invalid' })).status, 403);
  assert.equal((await http(port, '/publish.js')).status, 200);
  await until(() => remote.counts().controls === 1); await reachedReceipt.promise;
  assert.equal(value.status().confirmedGeneration, 0); assert.equal(service.status().distribution.state, 'running'); check();
  // Keep an actual accepted HTTP body in flight as well as the receipt write.
  const slowConnected = deferred(), slowReply = deferred();
  slow = request({ host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers: { Host: 'owned-editor.invalid', Origin: env.EDITOR_ORIGIN, 'Content-Type': 'application/json', 'Content-Length': 2, Connection: 'close' } }, res => { res.resume(); res.on('end', () => slowReply.resolve(res.statusCode)); });
  slow.on('error', () => slowReply.resolve('request-error'));
  slow.on('socket', socket => socket.once('connect', () => slowConnected.resolve()));
  slow.write('{'); await slowConnected.promise; await http(port);
  let finished = false; const closing = service.close(); assert.equal(service.close(), closing);
  void closing.then(() => { finished = true; });
  await setImmediate(); assert.equal(finished, false); assert.equal(service.status().state, 'stopping');
  await assert.rejects(http(port), error => error.code === 'ECONNREFUSED');
  receiptGate.resolve(); await until(() => service.status().distribution.state === 'stopped');
  assert.equal(finished, false, 'HTTP body must also settle before storage can be closed');
  slow.end('}'); assert.equal(await slowReply.promise, 422); slow = null;
  await closing; assert.equal(service.status().state, 'stopped'); assert.equal(value.status().confirmedGeneration, 0);
  assert.deepEqual(value.entry(1).payload, frozen); assert.equal(remote.counts().controls, 1);
  service = null; storage.close(); storage = null; check();
  // Reopen actual file SQLite: observe/ack the same root; never allocate a new op.
  storage = openStorage(database); remote.onImmutable(async () => {});
  service = await startPublicationServer({ ...defaults(storage), r2: remote.r2 });
  await until(() => ledger(storage).status().confirmedGeneration === 1);
  assert.equal(remote.counts().controls, 1); assert.deepEqual(ledger(storage).entry(1).payload, frozen);
  assert.equal((await http(service.address.port)).status, 200); check();
  // Default resource checking is still active, not an injectable bypass verifier.
  enqueue(storage, Buffer.from(JSON.stringify({ version: 1, projection: { marker: 'invalid graph' } })), 'listing');
  await until(() => service.status().distribution.lastResult === 'COMMITTED_SYNC_PENDING');
  assert.equal(ledger(storage).status().confirmedGeneration, 1); assert.equal(remote.counts().controls, 1); check();
  // A subsequently missing remote root latches recovery and stops the mounted loop.
  remote.objects.delete(prefix + 'control/current.json');
  await until(() => service.status().distribution.state === 'blocked');
  assert.equal(ledger(storage).status().blockedReason, 'REMOTE_GAP');
  assert.equal(service.status().distribution.blockedReason, 'REMOTE_GAP');
  assert.equal(remote.counts().controls, 1); check();
  await service.close(); service = null; storage.close(); storage = null;
  process.stdout.write(JSON.stringify({ checks, scope: 'mounted real Node HTTP/SQLite/default publisher and timers; conditional memory R2, synthetic empty projection, no full-game/browser/TLS/cloud/CLI proof' }) + '\n');
} finally {
  slow?.destroy(); receiptGate?.resolve(); await service?.close(); storage?.close();
  if (blocker) await new Promise(resolve => blocker.close(resolve));
  rmSync(own, { recursive: true, force: true });
}
