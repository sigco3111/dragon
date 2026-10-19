// Owned transport graphs with opaque image bytes, NOT compiled playable games.
import assert from 'node:assert/strict';
import { openStorage } from '../../vps/sqlite-port.mjs';
import { createDistributionResourceVerifier } from '../../vps/distribution-resources.mjs';
import { createDistributionPublisher } from '../../vps/distribution-publisher.mjs';
import { publication, GAME, OTHER_GAME, PORTRAIT, TEMPLATE_PORTRAIT, sha } from './publication.mjs';
function fixtureJSON(bytes) {
  try { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch (cause) { throw new Error('owned fixture JSON invalid', { cause }); }
}
const AUTHORITY = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
const operationId = n => `eeeeeeee-eeee-4eee-aeee-${String(n).padStart(12, '0')}`;
const project = source => ({ runtimeVersion: 1, directory: source.directory, releases: source.releases, gameStates: source.gameStates, announcements: source.announcements });
const candidate = source => {
  const row = source.releases[0];
  return { gameId: row.game_id, releaseId: row.release_id, ordinal: row.ordinal, revision: row.draft_revision, sourceDigest: row.source_digest, chapters: source.directory[0].chapters, runtime: row.runtime };
};
export async function exerciseDistributionResources(makeStore) {
  let serial = 0, groups = 0;
  async function fixture() {
    const prefix = `test/resources-${++serial}/`, store = await makeStore(prefix), source = publication();
    const gets = [], writes = [], budgets = [];
    const r2 = {
      async get(key, options) { gets.push(key); budgets.push([key, options?.maxBytes]); return store.get(key); },
      async putImmutable(key, bytes, contentType) { writes.push(key); return store.putIfMatch(key, bytes, contentType, null); },
      async putControl(key, bytes, etag) { assert.equal(arguments.length, 3); writes.push(key); return store.putIfMatch(key, bytes, 'application/json', etag); },
    };
    async function seed(value) {
      for (const file of value.files) await store.put(prefix + file.key, file.bytes, file.contentType);
      await store.put(prefix + 'kao/0.png', PORTRAIT, 'image/png');
      await store.put(prefix + 'kao/p0001.png', TEMPLATE_PORTRAIT, 'image/png');
    }
    await seed(source);
    let envelope = { version: 1, projection: project(source), runtime: candidate(source) };
    const record = (kind = 'publish') => {
      const payload = Buffer.from(JSON.stringify(envelope));
      return { kind, gameId: kind === 'bootstrap' ? null : GAME, payload, payloadDigest: sha(payload) };
    };
    async function rewriteIndex(change) {
      const ref = source.releases[0].runtime, stored = await store.get(prefix + ref.key), index = fixtureJSON(stored.bytes);
      await change(index);
      const bytes = Buffer.from(JSON.stringify(index)), digest = sha(bytes);
      const updated = { key: ref.key.replace(/runtime-[a-f0-9]{64}\.json$/, `runtime-${digest}.json`), sha256: digest, byteLength: bytes.length };
      await store.put(prefix + updated.key, bytes, 'application/json');
      source.releases[0].runtime = updated; envelope.runtime.runtime = updated;
    }
    async function rewriteManifest(change) {
      await rewriteIndex(async index => {
        const ref = index.resources.manifest, stored = await store.get(prefix + ref.key), manifest = fixtureJSON(stored.bytes);
        change(manifest);
        const bytes = Buffer.from(JSON.stringify(manifest));
        await store.put(prefix + ref.key, bytes, 'application/json');
        index.resources.manifest = { ...ref, sha256: sha(bytes), byteLength: bytes.length };
      });
    }
    return { prefix, store, source, r2, gets, writes, budgets, seed, record, rewriteIndex, rewriteManifest, get envelope() { return envelope; }, set envelope(value) { envelope = value; }, verify: createDistributionResourceVerifier({ r2, prefix }) };
  }
  {
    const f = await fixture(), result = await f.verify(f.record());
    assert.deepEqual(result, { runtimes: 1, objects: 7, reads: 7 }); assert.equal(f.writes.length, 0);
    const expected = new Map([...f.source.files.map(file => [f.prefix + file.key, file.bytes.length]), ...f.source.dependencies.map(ref => [f.prefix + ref.key, ref.byteLength])]);
    assert.equal(f.budgets.length, 7);
    for (const [key, budget] of f.budgets) assert.equal(budget, expected.get(key));
    groups++;
  }
  {
    const f = await fixture(), id = `${GAME}#upper-1`, scoped = publication(0, GAME, [id, `${GAME}#custom-21`]);
    await f.seed(scoped);
    f.envelope = { version: 1, projection: project(scoped), runtime: candidate(scoped) };
    assert.deepEqual(await f.verify(f.record()), { runtimes: 1, objects: 7, reads: 7 });
    assert.ok(f.gets.some(key => key.endsWith(`/chapters/${id}.json`)));
    assert.ok(f.gets.every(key => !key.includes('%23')));
    f.envelope.runtime.chapters = [`${OTHER_GAME}#upper-1`]; f.gets.length = 0;
    await assert.rejects(f.verify(f.record())); assert.equal(f.gets.length, 0); groups++;
  }
  {
    const f = await fixture(), ref = f.envelope.runtime.runtime;
    f.envelope.runtime.runtime = { byteLength: ref.byteLength, sha256: ref.sha256, key: ref.key };
    assert.equal((await f.verify(f.record())).objects, 7); groups++;
  }
  {
    const f = await fixture(); f.envelope.projection = { runtimeVersion: 1, directory: [], releases: [], announcements: [], gameStates: [{ gameId: GAME, listed: false }] };
    assert.equal((await f.verify(f.record())).objects, 7); groups++;
  }
  {
    const f = await fixture(); f.envelope = { version: 1, projection: { runtimeVersion: 1, directory: [], releases: [], announcements: [], gameStates: [] } };
    assert.equal((await f.verify(f.record('bootstrap'))).reads, 0); groups++;
  }
  // Current-only policy metadata is optional for retained legacy projections,
  // but when present it must match listed/hidden publish identity exactly.
  for (const listed of [true, false]) {
    const f = await fixture(), { releaseId, ordinal } = f.envelope.runtime;
    f.envelope.projection.gameStates[0].currentRelease = { releaseId, ordinal };
    if (!listed) {
      f.envelope.projection.directory = []; f.envelope.projection.releases = []; f.envelope.projection.announcements = [];
      f.envelope.projection.gameStates[0].listed = false;
    }
    assert.equal((await f.verify(f.record())).objects, 7); assert.equal(f.writes.length, 0); groups++;
  }
  for (const change of [
    row => { row.currentRelease = null; },
    row => { row.currentRelease = {}; },
    row => { row.currentRelease.extra = true; },
    row => { row.currentRelease.releaseId = '../invalid'; },
    row => { row.currentRelease.ordinal = '01.1'; },
    row => { row.currentRelease.releaseId = OTHER_GAME; },
    row => { row.currentRelease.ordinal = '1.999'; },
  ]) {
    const f = await fixture(), { releaseId, ordinal } = f.envelope.runtime;
    f.envelope.projection.gameStates[0].currentRelease = { releaseId, ordinal }; change(f.envelope.projection.gameStates[0]);
    await assert.rejects(f.verify(f.record())); assert.equal(f.gets.length, 0); assert.equal(f.writes.length, 0); groups++;
  }
  {
    const f = await fixture(), { releaseId, ordinal } = f.envelope.runtime;
    f.envelope.projection = { runtimeVersion: 1, directory: [], releases: [], announcements: [], gameStates: [{ gameId: GAME, listed: false, currentRelease: { releaseId, ordinal } }] };
    // An unlisted current version is metadata, not a historical runtime grant.
    assert.equal((await f.verify(f.record())).objects, 7);
    f.envelope.projection.gameStates[0].currentRelease.releaseId = OTHER_GAME;
    f.gets.length = 0; await assert.rejects(f.verify(f.record())); assert.equal(f.gets.length, 0);
    f.envelope.projection.gameStates[0].currentRelease.releaseId = releaseId;
    delete f.envelope.runtime; assert.equal((await f.verify(f.record('listing'))).reads, 0);
    f.envelope.projection.gameStates[0].deleted = true;
    await assert.rejects(f.verify(f.record('delete-fence'))); groups++;
  }
  // Every runtime role, including both shared portrait forms, must exist.
  for (let position = 0; position < 7; position++) {
    const f = await fixture(), keys = [...f.source.files.map(file => file.key), 'kao/0.png', 'kao/p0001.png'];
    await f.store.remove(f.prefix + keys[position]);
    await assert.rejects(f.verify(f.record())); assert.equal(f.writes.length, 0); groups++;
  }
  for (const mode of ['bytes', 'mime']) {
    const f = await fixture(), key = f.prefix + 'kao/p0001.png', value = await f.store.get(key);
    const bytes = Buffer.from(value.bytes); if (mode === 'bytes') bytes[0] ^= 1;
    await f.store.put(key, bytes, mode === 'mime' ? 'text/html' : 'image/png');
    await assert.rejects(f.verify(f.record())); groups++;
  }
  {
    const f = await fixture();
    const r2 = { async get(key) { const value = await f.r2.get(key); return value && { ...value, headers: { ...value.headers, 'Content-Type': 'application/json' } }; } };
    await assert.rejects(createDistributionResourceVerifier({ r2, prefix: f.prefix })(f.record())); groups++;
  }
  for (const change of [
    manifest => { manifest.portraits.pop(); },
    manifest => { manifest.assets.push({ ...manifest.assets[0], assetId: 'roadGraph' }); },
    manifest => { manifest.portraits[0].url = 'https://invalid.test/private'; },
    manifest => { manifest.assets[0].sha256 = '0'.repeat(64); },
    manifest => { manifest.identity.gameId = OTHER_GAME; },
    manifest => { manifest.chapters = manifest.chapters.toReversed(); }
  ]) {
    const f = await fixture(); await f.rewriteManifest(change);
    await assert.rejects(f.verify(f.record()), /DISTRIBUTION_RESOURCES/); groups++;
  }
  {
    const f = await fixture(); await f.rewriteIndex(index => { index.resources['asset:0'].key = 'private/not-a-public-role'; });
    await assert.rejects(f.verify(f.record())); assert.ok(f.gets.every(key => !key.includes('private/'))); groups++;
  }
  for (const change of [
    envelope => { envelope.projection.privateSource = 'must-not-be-published'; },
    envelope => { envelope.projection.directory.push(envelope.projection.directory[0]); },
    envelope => { envelope.projection.gameStates[0].listed = false; },
    envelope => { envelope.projection.announcements[0].ordinal = '1.9'; },
    envelope => { delete envelope.runtime; },
    envelope => { envelope.runtime.releaseId = 'other-release'; },
  ]) {
    const f = await fixture(); change(f.envelope);
    await assert.rejects(f.verify(f.record())); assert.equal(f.gets.length, 0); groups++;
  }
  {
    const f = await fixture();
    await f.rewriteIndex(async index => {
      const ref = index.resources['chapter:c1'], bytes = Buffer.from([0xff]);
      await f.store.put(f.prefix + ref.key, bytes, 'application/json');
      index.resources['chapter:c1'] = { ...ref, sha256: sha(bytes), byteLength: bytes.length };
    });
    await assert.rejects(f.verify(f.record())); groups++;
  }
  {
    const f = await fixture(), other = publication(0, OTHER_GAME); await f.seed(other);
    for (const key of ['directory', 'releases', 'gameStates', 'announcements']) f.envelope.projection[key].push(...other[key]);
    delete f.envelope.runtime;
    assert.deepEqual(await f.verify(f.record('listing')), { runtimes: 2, objects: 12, reads: 12 }); groups++;
  }
  {
    const f = await fixture(); await f.verify(f.record());
    await f.store.remove(f.prefix + 'kao/0.png'); await assert.rejects(f.verify(f.record())); groups++;
  }
  {
    const f = await fixture(), selected = f.record(); let changed = false;
    const r2 = { async get(key) { if (!changed) { changed = true; selected.payload.fill(0); selected.kind = 'bootstrap'; selected.gameId = null; } return f.r2.get(key); } };
    assert.equal((await createDistributionResourceVerifier({ r2, prefix: f.prefix })(selected)).objects, 7); groups++;
  }
  {
    const f = await fixture(); await f.rewriteManifest(manifest => { manifest.visualAssets = { fixture: 'static closure still required' }; });
    await assert.rejects(f.verify(f.record()), /DISTRIBUTION_STATIC_NOT_CONFIGURED/);
    let calls = 0;
    const verify = createDistributionResourceVerifier({ r2: f.r2, prefix: f.prefix, verifyStaticResources: async captured => { calls++; captured.index.resources = {}; } });
    assert.equal((await verify(f.record())).objects, 7); assert.equal(calls, 1); groups++;
  }
  {
    const f = await fixture(), storage = openStorage(':memory:');
    try {
      // No resource override: this is the actual default publisher composition.
      const publisher = createDistributionPublisher({ storage, r2: f.r2, prefix: f.prefix, authorityId: AUTHORITY });
      const first = f.record(); storage.transactionSync(() => publisher.ledger.enqueueInTxn({ ...first, operationId: operationId(1) }));
      const missing = f.prefix + 'kao/p0001.png'; await f.store.remove(missing);
      assert.equal((await publisher.drainOne()).state, 'COMMITTED_SYNC_PENDING');
      assert.equal(f.writes.length, 0); assert.equal(publisher.ledger.status().confirmedGeneration, 0);
      await f.store.put(missing, TEMPLATE_PORTRAIT, 'image/png');
      assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED');
      assert.equal(publisher.ledger.status().confirmedGeneration, 1);
      const controlWrites = f.writes.filter(key => key.endsWith('/control/current.json')).length;
      delete f.envelope.runtime; const second = f.record('listing');
      storage.transactionSync(() => publisher.ledger.enqueueInTxn({ ...second, operationId: operationId(2) }));
      await f.store.remove(missing);
      assert.equal((await publisher.drainOne()).state, 'COMMITTED_SYNC_PENDING');
      assert.equal(f.writes.filter(key => key.endsWith('/control/current.json')).length, controlWrites);
      assert.equal(publisher.ledger.status().confirmedGeneration, 1);
      await f.store.put(missing, TEMPLATE_PORTRAIT, 'image/png');
      assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED');
      assert.equal(publisher.ledger.status().confirmedGeneration, 2); groups++;
    } finally { storage.close(); }
  }
  assert.throws(() => createDistributionResourceVerifier({ r2: { get() {} }, prefix: '../' }), TypeError); groups++;
  return groups;
}
