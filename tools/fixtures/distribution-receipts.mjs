// Shared owned-store contract. Backend authority and CAS sequencing are NOT exercised.
import assert from 'node:assert/strict';
import { openStorage } from '../../vps/sqlite-port.mjs';
import { FrozenDistributionLedger } from '../../server/distributionledger.js';
import { createDistributionReceipts } from '../../vps/distribution-receipts.mjs';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const G = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const O = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export async function exerciseDistributionReceipts(makeStore) {
  let sequence = 0, checks = 0;
  const stores = [];
  async function fixture(projection = { runtimeVersion: 1, directory: [], gameStates: [], releases: [], announcements: [], generatedAt: '2020-01-01T00:00:00.000Z' }) {
    const prefix = `test/receipt-${++sequence}/`, store = await makeStore(prefix);
    const storage = openStorage(':memory:'); stores.push(storage);
    const calls = [], writes = [], hooks = {};
    const r2 = {
      async get(key) { calls.push(key); const value = await store.get(key); return hooks.get ? hooks.get(key, value) : value; },
      async putImmutable(key, bytes, type) {
        writes.push(key);
        if (hooks.beforePut) await hooks.beforePut(key);
        const old = await store.get(key);
        if (old) assert.deepEqual(Buffer.from(old.bytes), Buffer.from(bytes), 'immutable collision');
        else await store.put(key, bytes, type);
        if (hooks.afterPut) await hooks.afterPut(key);
      },
    };
    const proof = createDistributionReceipts({ r2, prefix });
    const ledger = new FrozenDistributionLedger({ storage, authorityId: A, verifyReceipt: proof.verifyReceipt });
    const payload = Buffer.from(JSON.stringify({ version: 1, projection }));
    storage.transactionSync(() => ledger.enqueueInTxn({ operationId: O, kind: 'publish', gameId: G, payload }));
    const record = ledger.next(), objects = proof.expectedObjects(record);
    async function seed() { for (const entry of [objects.root, objects.projection]) await store.put(entry.key, entry.bytes, entry.contentType); }
    const confirm = (ticket, target = ledger) => storage.transactionSync(() => target.confirmInTxn(O, ticket));
    return { prefix, store, storage, calls, writes, hooks, r2, proof, ledger, record, objects, seed, confirm };
  }
  try {
    {
      const f = await fixture();
      assert.equal(await f.proof.recover(f.record), null);
      await assert.rejects(() => f.proof.observe(f.record));
      assert.equal(f.writes.length, 0); assert.equal(f.ledger.status().confirmedGeneration, 0); checks++;
    }
    {
      const f = await fixture(); await f.seed();
      const root = await f.store.get(f.objects.root.key);
      const ticket = await f.proof.observe(f.record);
      assert.deepEqual(ticket, {}); assert.ok(Object.isFrozen(ticket));
      assert.throws(() => f.confirm({}), /DISTRIBUTION_RECEIPT/);
      const saved = f.confirm(ticket);
      assert.equal(saved.visibleAt, new Date(root.headers['last-modified']).toISOString());
      assert.notEqual(saved.visibleAt, '2020-01-01T00:00:00.000Z');
      assert.equal(saved.rootETag, root.headers.etag);
      assert.equal(f.calls.filter(k => k === f.objects.root.key).length, 2);
      assert.deepEqual(f.writes, [f.objects.receiptKey]);
      assert.equal(f.ledger.status().confirmedGeneration, 1);
      assert.equal(f.confirm(ticket).deduped, true);
      const raw = JSON.parse(Buffer.from((await f.store.get(f.objects.receiptKey)).bytes));
      assert.throws(() => f.confirm(raw), /DISTRIBUTION_RECEIPT/); checks++;
      // Process-local capability gone; recover solely from immutable minimal receipt.
      const restarted = createDistributionReceipts({ r2: f.r2, prefix: f.prefix });
      const restoredLedger = new FrozenDistributionLedger({ storage: f.storage, verifyReceipt: restarted.verifyReceipt });
      assert.throws(() => f.confirm(ticket, restoredLedger), /DISTRIBUTION_RECEIPT/);
      await f.store.remove(f.objects.root.key); await f.store.remove(f.objects.projection.key);
      const recovered = await restarted.recover(f.record);
      assert.equal(f.confirm(recovered, restoredLedger).deduped, true);
      assert.equal(f.writes.length, 1); checks++;
    }
    for (const mutate of [
      o => ({ ...o, bytes: Buffer.from('{"generation":1,"digest":"legacy"}') }),
      o => ({ ...o, headers: { ...o.headers, etag: '' } }),
      o => ({ ...o, headers: { ...o.headers, etag: 'bad\r\nvalue' } }),
      o => ({ ...o, headers: { ...o.headers, 'last-modified': 'not a server date' } }),
      o => ({ ...o, headers: { ...o.headers, 'last-modified': '2020-01-01T00:00:00.000Z' } }),
      o => ({ ...o, headers: { ...o.headers, 'content-type': 'text/plain' } }),
      o => ({ ...o, headers: { ...o.headers, ETag: o.headers.etag } }),
    ]) {
      const f = await fixture(); await f.seed();
      f.hooks.get = (key, value) => key === f.objects.root.key ? mutate(value) : value;
      await assert.rejects(() => f.proof.observe(f.record));
      assert.equal(f.writes.length, 0); assert.equal(f.ledger.status().confirmedGeneration, 0); checks++;
    }
    {
      const f = await fixture(); await f.seed();
      await f.store.put(f.objects.projection.key, Buffer.from('{}'), 'application/json');
      await assert.rejects(() => f.proof.observe(f.record)); assert.equal(f.writes.length, 0); checks++;
    }
    {
      const f = await fixture(); await f.seed(); let roots = 0;
      f.hooks.get = (key, value) => key === f.objects.root.key && ++roots === 2 ? { ...value, headers: { ...value.headers, etag: 'changed' } } : value;
      await assert.rejects(() => f.proof.observe(f.record), /DISTRIBUTION_READBACK_CHANGED/);
      assert.equal(f.writes.length, 0); checks++;
    }
    {
      const f = await fixture(); await f.seed();
      f.hooks.afterPut = () => { throw new Error('lost response after actual immutable write'); };
      await assert.rejects(() => f.proof.observe(f.record), /lost response/);
      assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks.afterPut;
      const ticket = await f.proof.recover(f.record); f.confirm(ticket);
      assert.equal(f.writes.length, 1); checks++;
    }
    {
      const f = await fixture(); await f.seed(); let reads = 0;
      f.hooks.get = (key, value) => key === f.objects.receiptKey && ++reads === 2 ? null : value;
      await assert.rejects(() => f.proof.observe(f.record));
      assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks.get; f.confirm(await f.proof.recover(f.record));
      assert.equal(f.writes.length, 1); checks++;
    }
    {
      const f = await fixture(); await f.seed();
      f.hooks.beforePut = () => { throw new Error('write never reached store'); };
      await assert.rejects(() => f.proof.observe(f.record));
      assert.equal(await f.proof.recover(f.record), null);
      delete f.hooks.beforePut; f.confirm(await f.proof.observe(f.record));
      assert.ok(f.writes.every(k => k === f.objects.receiptKey)); checks++;
    }
    for (const patch of [{ operationId: G }, { rootDigest: 'f'.repeat(64) }, { visibleAt: 'invalid' }, { secret: 'unexpected-field' }]) {
      const f = await fixture(); await f.seed(); await f.proof.observe(f.record);
      const original = JSON.parse(Buffer.from((await f.store.get(f.objects.receiptKey)).bytes));
      await f.store.put(f.objects.receiptKey, Buffer.from(JSON.stringify({ ...original, ...patch })), 'application/json');
      await assert.rejects(() => f.proof.recover(f.record));
      await assert.rejects(() => f.proof.observe(f.record));
      assert.equal(f.writes.length, 1); assert.equal(f.ledger.status().confirmedGeneration, 0); checks++;
    }
    {
      const f = await fixture(); await f.seed();
      f.hooks.get = (_key, value) => { f.record.payload.fill(0); return value; };
      f.confirm(await f.proof.observe(f.record));
      assert.equal(f.ledger.status().confirmedGeneration, 1); checks++;
    }
    {
      const f = await fixture();
      await assert.rejects(() => f.proof.observe({ ...f.record, generation: 2 }));
      await assert.rejects(() => f.proof.observe({ ...f.record, payload: Buffer.from('{"version":1}') }));
      assert.equal(f.calls.length, 0); checks++;
    }
    await assert.rejects(() => fixture({ text: 'x'.repeat(2 * 1024 * 1024) }), /DISTRIBUTION_READBACK/); checks++;
    assert.throws(() => createDistributionReceipts({ r2: {}, prefix: '' }), /private R2 port/);
    for (const prefix of ['../', 'test/../', 'artifacts/', 'test/a//']) assert.throws(() => createDistributionReceipts({ r2: { get() {}, putImmutable() {} }, prefix }), /private R2 port/);
    checks++;
  } finally { for (const storage of stores) storage.close(); }
  return checks;
}
