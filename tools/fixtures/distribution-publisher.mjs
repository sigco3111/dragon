// Same protocol cases on deterministic memory and real owned workerd R2 CAS.
// Resource verifier is an explicit seam; these envelopes are NOT playable games.
import assert from 'node:assert/strict';
import { openStorage } from '../../vps/sqlite-port.mjs';
import { createDistributionPublisher } from '../../vps/distribution-publisher.mjs';
import { createDistributionReceipts } from '../../vps/distribution-receipts.mjs';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', G = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const op = n => 'cccccccc-cccc-4ccc-8ccc-' + String(n).padStart(12, '0');
export async function exerciseDistributionPublisher(makeStore) {
  let sequence = 0, checks = 0; const storages = [];
  async function fixture() {
    const prefix = `test/publisher-${++sequence}/`, store = await makeStore(prefix);
    const storage = openStorage(':memory:'); storages.push(storage);
    const hooks = {}, writes = [], controls = [], reads = [];
    const r2 = {
      async get(key) { reads.push(key); const value = await store.get(key); return hooks.get ? hooks.get(key, value) : value; },
      async putImmutable(key, bytes, type) {
        writes.push(key); if (hooks.beforeImmutable) await hooks.beforeImmutable(key);
        const inserted = await store.putIfMatch(key, bytes, type, null);
        if (!inserted) {
          const old = await store.get(key);
          assert.deepEqual(Buffer.from(old.bytes), Buffer.from(bytes), 'immutable collision');
          assert.equal(old.headers['content-type'], type);
        }
        if (hooks.afterImmutable) await hooks.afterImmutable(key);
      },
      async putControl(key, bytes, priorETag) {
        assert.equal(arguments.length, 3, 'actual r2client control port has three arguments');
        const type = 'application/json';
        controls.push({ key, bytes: Buffer.from(bytes), priorETag });
        if (hooks.beforeControl) await hooks.beforeControl(key, bytes, type, priorETag);
        if (hooks.control) return hooks.control(key, bytes, type, priorETag);
        const result = await store.putIfMatch(key, bytes, type, priorETag);
        if (hooks.afterControl) await hooks.afterControl(key);
        return result;
      },
    };
    const make = () => createDistributionPublisher({ storage, r2, prefix, authorityId: A, verifyResources: async record => { if (hooks.resources) await hooks.resources(record); } });
    const publisher = make(), ledger = publisher.ledger, proof = createDistributionReceipts({ r2, prefix });
    const enqueue = (n, kind = 'listing') => storage.transactionSync(() => ledger.enqueueInTxn({ operationId: op(n), kind, gameId: G, payload: Buffer.from(JSON.stringify({ version: 1, projection: { marker: 'frozen-' + n } })) }));
    const objects = n => proof.expectedObjects(ledger.entry(n));
    const seed = async n => { for (const entry of [objects(n).projection, objects(n).root]) await store.put(entry.key, entry.bytes, entry.contentType); };
    return { prefix, store, storage, hooks, writes, controls, reads, r2, publisher, ledger, proof, enqueue, objects, seed, make, rootKey: prefix + 'control/current.json' };
  }
  const visible = async publisher => assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED');
  const pending = async publisher => assert.equal((await publisher.drainOne()).state, 'COMMITTED_SYNC_PENDING');
  async function refused(f, reason) {
    const before = f.controls.length + f.writes.length;
    await assert.rejects(() => f.publisher.drainOne(), /DISTRIBUTION_RECOVERY_REQUIRED/);
    assert.equal(f.ledger.status().blockedReason, reason);
    assert.equal(f.controls.length + f.writes.length, before);
    await assert.rejects(() => f.make().checkHead(), /DISTRIBUTION_RECOVERY_REQUIRED/);
  }
  try {
    {
      const f = await fixture(); assert.equal((await f.publisher.drainOne()).state, 'IDLE');
      assert.equal(f.controls.length + f.writes.length, 0); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1, 'publish'); await visible(f.publisher);
      assert.equal(f.controls.length, 1); assert.equal(f.controls[0].priorETag, null);
      assert.deepEqual(f.writes, [f.objects(1).rootArchive.key, f.objects(1).projection.key, f.objects(1).receiptKey]);
      assert.deepEqual(Buffer.from((await f.store.get(f.objects(1).rootArchive.key)).bytes), f.controls[0].bytes);
      assert.equal((await f.publisher.drainOne()).state, 'IDLE'); assert.equal(f.controls.length, 1);
      const entry = f.ledger.entry(1); assert.equal(entry.state, 'confirmed');
      assert.equal(entry.receipt.visibleAt, new Date((await f.store.get(f.rootKey)).headers['last-modified']).toISOString());
      entry.payload.fill(0); assert.notEqual(f.ledger.entry(1).payload[0], 0);
      assert.throws(() => f.ledger.entry(0), /DISTRIBUTION_GENERATION/);
      assert.throws(() => f.ledger.entry(2), /DISTRIBUTION_UNKNOWN/);
      f.ledger.block('REMOTE_AHEAD'); assert.equal(f.ledger.entry(1).state, 'confirmed'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2);
      f.hooks.beforeControl = async (_key, bytes) => {
        const root = JSON.parse(Buffer.from(bytes));
        if (root.generation === 2) { assert.ok(await f.store.get(f.objects(1).receiptKey)); assert.equal(f.ledger.status().confirmedGeneration, 1); }
      };
      await visible(f.publisher); await visible(f.publisher);
      assert.deepEqual(f.controls.map(c => JSON.parse(c.bytes).generation), [1, 2]);
      assert.equal(f.controls[1].priorETag, f.ledger.entry(1).receipt.rootETag); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.afterControl = () => { throw new Error('response lost after actual CAS'); };
      await visible(f.publisher); assert.equal(f.controls.length, 1); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); let unavailable = false;
      f.hooks.afterControl = () => { unavailable = true; throw new Error('response lost'); };
      f.hooks.get = (_key, value) => { if (unavailable) throw new Error('network down'); return value; };
      await pending(f.publisher); assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks.get; delete f.hooks.afterControl;
      await visible(f.make()); assert.equal(f.controls.length, 1); checks++;
    }
    for (const point of ['beforeImmutable', 'afterImmutable']) {
      const f = await fixture(); f.enqueue(1);
      f.hooks[point] = key => { if (key === f.objects(1).receiptKey) throw new Error('receipt write interrupted'); };
      await pending(f.publisher); assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks[point]; await visible(f.make()); assert.equal(f.controls.length, 1); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2);
      f.storage.sql.exec("CREATE TRIGGER fixture_ack BEFORE UPDATE ON content_distribution_state WHEN NEW.confirmed_generation>OLD.confirmed_generation BEGIN SELECT RAISE(ABORT,'fixture ack'); END");
      await pending(f.publisher); await pending(f.make());
      assert.equal(f.controls.length, 1); assert.ok(await f.store.get(f.objects(1).receiptKey));
      assert.equal(f.ledger.status().confirmedGeneration, 0);
      f.storage.sql.exec('DROP TRIGGER fixture_ack'); await visible(f.make()); await visible(f.publisher);
      assert.equal(f.controls.length, 2); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.resources = record => { record.payload.fill(0); throw new Error('resource missing'); };
      await pending(f.publisher); assert.equal(f.controls.length + f.writes.length, 0);
      delete f.hooks.resources; await visible(f.publisher); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.get = (key, value) => key === f.objects(1).projection.key ? { ...value, bytes: Buffer.from('{}') } : value;
      await pending(f.publisher); assert.equal(f.controls.length, 0); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.hooks.control = async () => false;
      await pending(f.publisher); assert.equal(f.ledger.status().tailGeneration, 1);
      delete f.hooks.control; await visible(f.publisher); assert.equal(f.controls.length, 2); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.control = async (key, bytes, type, etag) => { assert.equal(await f.store.putIfMatch(key, bytes, type, etag), true); return false; };
      await visible(f.publisher); assert.equal(f.controls.length, 1); checks++;
    }
    for (const [patch, reason] of [
      [{ version: 1 }, 'LEGACY_PENDING'],
      [{ authorityId: G }, 'AUTHORITY_MISMATCH'],
      [{ generation: 2 }, 'REMOTE_AHEAD'],
      [{ digest: 'f'.repeat(64) }, 'REMOTE_GAP'],
    ]) {
      const f = await fixture(); f.enqueue(1);
      const root = JSON.parse(Buffer.from(f.objects(1).root.bytes));
      await f.store.put(f.rootKey, Buffer.from(JSON.stringify({ ...root, ...patch })), 'application/json');
      await refused(f, reason); assert.equal(f.ledger.entry(1).attempts, 0); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); await visible(f.publisher);
      await f.store.remove(f.rootKey); await refused(f, 'REMOTE_GAP'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2); await visible(f.publisher); await visible(f.publisher);
      await f.seed(1); await refused(f, 'REMOTE_GAP'); checks++;
    }
    for (const patch of [{ etag: 'rewritten' }, { 'last-modified': 'Wed, 02 Jan 2030 00:00:00 GMT' }]) {
      const f = await fixture(); f.enqueue(1); await visible(f.publisher);
      f.hooks.get = (key, value) => key === f.rootKey ? { ...value, headers: { ...value.headers, ...patch } } : value;
      await refused(f, 'REMOTE_GAP'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2); await visible(f.publisher);
      await f.store.remove(f.objects(1).receiptKey); const writes = f.writes.length;
      await pending(f.publisher); assert.equal(f.controls.length, 1); assert.equal(f.writes.length, writes);
      assert.equal(f.ledger.status().confirmedGeneration, 1); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2);
      // A backup has known operations but lost more than a single in-flight ack.
      await f.seed(2); await refused(f, 'REMOTE_AHEAD'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); await f.seed(1);
      await f.proof.observe(f.ledger.entry(1)); await f.store.remove(f.rootKey);
      await refused(f, 'REMOTE_GAP'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); const second = f.make();
      let arrived = 0, release; const gate = new Promise(resolve => { release = resolve; });
      f.hooks.beforeControl = async () => { if (++arrived === 2) release(); await gate; };
      const results = await Promise.all([f.publisher.drainOne(), second.drainOne()]);
      assert.ok(results.every(r => r.state === 'VISIBLE_CONFIRMED'));
      assert.equal(f.controls.length, 2); assert.equal(f.ledger.status().confirmedGeneration, 1);
      assert.equal(f.ledger.status().blockedReason, null); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); const second = f.make(); let once = true;
      f.hooks.get = async (key, value) => { if (once && key === f.rootKey) { once = false; await visible(second); } return value; };
      await f.publisher.drainOne(); assert.equal(f.ledger.status().blockedReason, null);
      assert.equal(f.ledger.status().confirmedGeneration, 1); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); const second = f.make(); let once = true;
      f.hooks.get = async (key, value) => {
        if (once && key === f.objects(1).receiptKey) { once = false; await visible(second); return f.store.get(key); }
        return value;
      };
      await f.publisher.drainOne(); assert.equal(f.ledger.status().blockedReason, null);
      assert.equal(f.ledger.status().confirmedGeneration, 1); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1); f.enqueue(2); await visible(f.publisher);
      const second = f.make(); let once = true;
      f.hooks.get = async (key, value) => { if (once && key === f.rootKey) { once = false; await visible(second); } return value; };
      assert.equal((await f.publisher.checkHead()).generation, 2);
      assert.equal(f.ledger.status().blockedReason, null); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      await f.store.put(f.rootKey, Buffer.from(' ' + Buffer.from(f.objects(1).root.bytes).toString()), 'application/json');
      await refused(f, 'REMOTE_GAP'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.get = () => { throw new Error('unreachable'); };
      await pending(f.publisher); assert.equal(f.ledger.status().blockedReason, null);
      assert.equal(f.controls.length + f.writes.length, 0); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.resources = record => { record.payload.fill(0); };
      await visible(f.publisher);
      assert.deepEqual(JSON.parse(Buffer.from((await f.store.get(f.objects(1).projection.key)).bytes)), { marker: 'frozen-1' }); checks++;
    }
    for (const point of ['beforeImmutable', 'afterImmutable']) {
      const f = await fixture(); f.enqueue(1);
      f.hooks[point] = key => { if (key === f.objects(1).rootArchive.key) throw new Error('archive write interrupted'); };
      await pending(f.publisher); assert.equal(f.controls.length, 0); assert.equal(f.ledger.status().confirmedGeneration, 0);
      assert.equal(await f.store.get(f.objects(1).receiptKey), null);
      delete f.hooks[point]; await visible(f.make()); assert.equal(f.controls.length, 1); checks++;
    }
    for (const alter of [() => null, value => ({ ...value, bytes: Buffer.from('{}') }), value => ({ ...value, headers: { ...value.headers, 'content-type': 'text/plain' } })]) {
      const f = await fixture(); f.enqueue(1);
      f.hooks.get = (key, value) => key === f.objects(1).rootArchive.key ? alter(value) : value;
      await pending(f.publisher); assert.equal(f.controls.length, 0); assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks.get; await visible(f.make()); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      await f.store.put(f.objects(1).rootArchive.key, Buffer.from('{}'), 'application/json');
      await pending(f.publisher); assert.equal(f.controls.length, 0); assert.equal(f.ledger.status().confirmedGeneration, 0);
      assert.equal(Buffer.from((await f.store.get(f.objects(1).rootArchive.key)).bytes).toString(), '{}'); checks++;
    }
    {
      const f = await fixture(); f.enqueue(1);
      f.hooks.beforeImmutable = key => { if (key === f.objects(1).receiptKey) throw new Error('receipt unavailable after CAS'); };
      await pending(f.publisher); assert.equal(f.controls.length, 1);
      f.hooks.beforeImmutable = key => { if (key === f.objects(1).rootArchive.key) throw new Error('recovery archive unavailable'); };
      await pending(f.make()); assert.equal(f.controls.length, 1); assert.equal(f.ledger.status().confirmedGeneration, 0);
      delete f.hooks.beforeImmutable; await visible(f.make()); assert.equal(f.controls.length, 1); checks++;
    }
  } finally { for (const storage of storages) storage.close(); }
  assert.equal(checks, 37); return checks;
}
