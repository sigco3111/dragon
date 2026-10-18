// Owned memory ports and opaque transport fixtures only. No HTTP/cloud/game IO.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildStaticRelease, STATIC_RELEASE_FILE } from '../vps/static-release.mjs';
import { createStaticResourceVerifier } from '../vps/static-resources.mjs';
import { createDistributionResourceVerifier } from '../vps/distribution-resources.mjs';
import { createDistributionPublisher } from '../vps/distribution-publisher.mjs';
import { createDistributionReceipts } from '../vps/distribution-receipts.mjs';
import { openStorage } from '../vps/sqlite-port.mjs';
import { publication, GAME, OTHER_GAME, PORTRAIT, TEMPLATE_PORTRAIT } from './fixtures/publication.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function json(bytes) {
  try { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch (cause) { throw new Error('invalid owned fixture JSON', { cause }); }
}
function fixture() {
  const files = new Map([
    ['src/core.js', Buffer.from('export const owned = true;')],
    ['grf/music/test.flac', Buffer.from('opaque audio')],
    ['empty.bin', Buffer.alloc(0)], ['_headers', Buffer.from('configuration')],
  ]);
  const visualAssets = {};
  for (const [group, stem] of [['seasonAtlases', 'map_atlas_'], ['seasons', 'map_tiles_']]) {
    visualAssets[group] = {};
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const path = `content/builtin/compiled/owned/${stem}${season}.png`, bytes = Buffer.from(path);
      files.set(path, bytes); visualAssets[group][season] = { path, url: path, sha256: sha(bytes), byteLength: bytes.length };
    }
  }
  const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: sha(bytes) })));
  files.set(STATIC_RELEASE_FILE, Buffer.from(built.bytes));
  const reads = [], hooks = {};
  const verify = createStaticResourceVerifier({ expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest,
    async readStatic(path, { maxBytes }) {
      assert.ok(files.has(path)); assert.notEqual(path, '_headers');
      reads.push({ path, maxBytes }); await hooks.read?.(path);
      return files.get(path);
    },
  });
  return { files, built, reads, hooks, verify, manifests: Array.from({ length: 4 }, () => ({ visualAssets: structuredClone(visualAssets) })) };
}
function runtimeFixture(f, { hidden = false, badGame = -1, noVisuals = false, empty = false } = {}) {
  const objects = new Map([
    ['kao/0.png', { bytes: PORTRAIT, headers: { 'content-type': 'image/png' } }],
    ['kao/p0001.png', { bytes: TEMPLATE_PORTRAIT, headers: { 'content-type': 'image/png' } }],
  ]);
  const projection = { runtimeVersion: 1, directory: [], releases: [], gameStates: [], announcements: [] };
  const games = [GAME, OTHER_GAME, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
  let candidate;
  for (const [i, game] of (empty ? [] : games).entries()) {
    const p = publication(0, game);
    for (const file of p.files) objects.set(file.key, { bytes: Buffer.from(file.bytes), headers: { 'content-type': file.contentType } });
    const prior = p.releases[0].runtime, index = json(objects.get(prior.key).bytes);
    const manifest = json(objects.get(index.resources.manifest.key).bytes);
    if (!noVisuals) manifest.visualAssets = structuredClone(f.manifests[i].visualAssets);
    if (i === badGame) manifest.visualAssets.seasons.winter.sha256 = '0'.repeat(64);
    const body = Buffer.from(JSON.stringify(manifest));
    objects.set(index.resources.manifest.key, { bytes: body, headers: { 'content-type': 'application/json' } });
    index.resources.manifest = { ...index.resources.manifest, byteLength: body.length, sha256: sha(body) };
    const indexBytes = Buffer.from(JSON.stringify(index)), hash = sha(indexBytes);
    const runtime = { ...prior, key: prior.key.replace(/runtime-[a-f0-9]{64}\.json$/, `runtime-${hash}.json`), byteLength: indexBytes.length, sha256: hash };
    objects.set(runtime.key, { bytes: indexBytes, headers: { 'content-type': 'application/json' } });
    p.releases[0].runtime = runtime;
    if (hidden && i === 3) {
      projection.gameStates.push({ gameId: game, listed: false });
      const r = p.releases[0];
      candidate = { gameId: game, releaseId: r.release_id, ordinal: r.ordinal, revision: r.draft_revision, sourceDigest: r.source_digest, chapters: p.directory[0].chapters, runtime };
    } else for (const key of ['directory', 'releases', 'gameStates', 'announcements']) projection[key].push(...p[key]);
  }
  const payload = Buffer.from(JSON.stringify({ version: 1, projection, ...(candidate ? { runtime: candidate } : {}) }));
  const record = { kind: candidate ? 'publish' : 'bootstrap', gameId: candidate?.gameId ?? null, payload, payloadDigest: sha(payload) };
  let gets = 0;
  const r2 = { async get(key, { maxBytes }) {
    gets++; assert.ok(objects.has(key), 'exact owned object set');
    await f.hooks.r2?.(key);
    const value = objects.get(key);
    if (value) assert.ok(value.bytes.length <= maxBytes);
    return value;
  } };
  return { record, r2, objects, gets: () => gets };
}
let checks = 0;
async function check(name, test) { await test(); checks++; process.stdout.write(`ok ${name}\n`); }
await check('four games: legacy 52 static reads versus batch 13, same R2 coverage and all visual bindings', async () => {
  const f = fixture(), r = runtimeFixture(f);
  const legacy = createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: value => f.verify(value) });
  const before = await legacy(r.record), legacyReads = f.reads.length;
  assert.equal(before.runtimes, 4); assert.equal(legacyReads, 52);
  const g = fixture(), s = runtimeFixture(g);
  assert.deepEqual(await createDistributionResourceVerifier({ r2: s.r2, verifyStaticResources: g.verify })(s.record), before);
  assert.equal(g.reads.length, 13); assert.equal(s.gets(), r.gets());
  assert.deepEqual(g.reads, f.reads.slice(0, 13));
});
await check('batch proof counts manifests but scans each asset once; immutable capability', async () => {
  const f = fixture(), proof = await f.verify.batch({ manifests: f.manifests });
  assert.equal(proof.manifestsVerified, 4); assert.equal(proof.filesVerified, 11);
  assert.equal(proof.bytesVerified, [...f.files].filter(([path]) => !['_headers', STATIC_RELEASE_FILE].includes(path)).reduce((n, [, bytes]) => n + bytes.length, 0));
  assert.equal(Object.isFrozen(proof), true); assert.equal(Object.isFrozen(f.verify), true);
  assert.equal(f.reads.filter(row => row.path === STATIC_RELEASE_FILE).length, 2);
  assert.equal(f.reads.find(row => row.path === 'empty.bin').maxBytes, 1);
});
for (const manifests of [undefined, null, {}, [], [undefined], Array(2)]) await check('invalid batch rejects before reads', async () => {
  const f = fixture(); await assert.rejects(f.verify.batch({ manifests })); assert.equal(f.reads.length, 0);
});
for (let i = 0; i < 4; i++) await check(`binding mismatch in member ${i} rejects before asset scan`, async () => {
  const f = fixture(); f.manifests[i].visualAssets.seasons.winter.sha256 = '0'.repeat(64);
  await assert.rejects(f.verify.batch({ manifests: f.manifests }), /STATIC_VISUAL_BINDING/); assert.equal(f.reads.length, 1);
});
await check('all members captured before first IO, including batch length', async () => {
  const f = fixture(); f.hooks.read = () => { f.manifests.length = 0; };
  assert.equal((await f.verify.batch({ manifests: f.manifests })).manifestsVerified, 4);
});
await check('later malformed member rejects with zero IO', async () => {
  const f = fixture(); delete f.manifests[3].visualAssets.seasons.winter;
  await assert.rejects(f.verify.batch({ manifests: f.manifests }), /STATIC_VISUAL_BINDING/); assert.equal(f.reads.length, 0);
});
for (const path of [...fixture().files.keys()].filter(path => path !== '_headers')) await check(`batch requires ${path}`, async () => {
  const f = fixture(); f.files.set(path, null);
  await assert.rejects(f.verify.batch({ manifests: f.manifests }), /STATIC_RESOURCE_MISSING/);
});
await check('final manifest drift rejects', async () => {
  const f = fixture(); f.hooks.read = path => {
    if (path === STATIC_RELEASE_FILE && f.reads.length > 1) f.files.set(path, Buffer.from('changed manifest'));
  };
  await assert.rejects(f.verify.batch({ manifests: f.manifests }), /STATIC_RELEASE_CHANGED/);
});
await check('no cross-call success cache or concurrent shared in-flight scan', async () => {
  const f = fixture(); await Promise.all([f.verify.batch({ manifests: f.manifests }), f.verify.batch({ manifests: f.manifests })]);
  assert.equal(f.reads.length, 26);
  f.files.set('grf/music/test.flac', null);
  await assert.rejects(f.verify.batch({ manifests: f.manifests }), /STATIC_RESOURCE_MISSING/);
});
await check('hidden publish candidate is included and mismatch blocks whole projection', async () => {
  const f = fixture(), r = runtimeFixture(f, { hidden: true });
  assert.equal((await createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: f.verify })(r.record)).runtimes, 4);
  assert.equal(f.reads.length, 13);
  const g = fixture(), s = runtimeFixture(g, { hidden: true, badGame: 3 });
  await assert.rejects(createDistributionResourceVerifier({ r2: s.r2, verifyStaticResources: g.verify })(s.record), /STATIC_VISUAL_BINDING/);
});
await check('later visible game mismatch cannot be skipped', async () => {
  const f = fixture(), r = runtimeFixture(f, { badGame: 2 });
  await assert.rejects(createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: f.verify })(r.record), /STATIC_VISUAL_BINDING/);
});
await check('missing configuration still rejects; malformed optional port rejected at construction', async () => {
  const f = fixture(), r = runtimeFixture(f);
  await assert.rejects(createDistributionResourceVerifier({ r2: r.r2 })(r.record), /DISTRIBUTION_STATIC_NOT_CONFIGURED/);
  const plain = async () => {}; plain.batch = false;
  assert.throws(() => createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: plain }), /static batch port/);
});
await check('captured batch port; no fallback on error; only compact visual references retained', async () => {
  const f = fixture(), r = runtimeFixture(f); let legacy = 0, batch = 0;
  const port = async () => { legacy++; };
  port.batch = async ({ manifests }) => {
    batch++; assert.equal(manifests.length, 4);
    for (const item of manifests) assert.deepEqual(Object.keys(item), ['visualAssets']);
    throw new Error('owned batch failure');
  };
  const verify = createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: port });
  port.batch = async () => { throw new Error('replacement must not run'); };
  await assert.rejects(verify(r.record), /owned batch failure/); assert.equal(batch, 1); assert.equal(legacy, 0);
});
for (const options of [{ noVisuals: true }, { empty: true }]) await check('no static references means no static IO', async () => {
  const f = fixture(), r = runtimeFixture(f, options);
  await createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: f.verify })(r.record);
  assert.equal(f.reads.length, 0);
});
await check('runtime resource failure cannot return successful proof or trigger fallback', async () => {
  const f = fixture(), r = runtimeFixture(f);
  // Select by actual index role rather than relying on a filename convention.
  const indexKey = json(r.record.payload).projection.releases[0].runtime.key;
  const index = json(r.objects.get(indexKey).bytes);
  r.objects.set(index.resources['asset:terrain'].key, null);
  await assert.rejects(createDistributionResourceVerifier({ r2: r.r2, verifyStaticResources: f.verify })(r.record), /DISTRIBUTION_RESOURCES/);
  assert.equal(f.reads.length, 0);
});
await check('actual default publisher: batch failure cannot write roots or acknowledge; retries recheck all static bytes', async () => {
  const f = fixture(), r = runtimeFixture(f), storage = openStorage(':memory:');
  const allowed = new Set([...r.objects.keys(), 'control/current.json']), writes = [];
  const save = (key, bytes, contentType) => {
    r.objects.set(key, { bytes: Buffer.from(bytes), headers: { 'content-type': contentType,
      etag: '"' + sha(bytes) + '"', 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } });
    writes.push(key); return true;
  };
  const r2 = {
    async get(key, { maxBytes }) {
      assert.ok(allowed.has(key), key); const value = r.objects.get(key);
      if (!value) return null;
      assert.ok(value.bytes.length <= maxBytes);
      return { bytes: Buffer.from(value.bytes), headers: { ...value.headers } };
    },
    async putImmutable(key, bytes, type) {
      assert.ok(allowed.has(key), key);
      if (r.objects.has(key)) return false;
      return save(key, bytes, type);
    },
    async putControl(key, bytes, etag) {
      assert.equal(arguments.length, 3); assert.equal(key, 'control/current.json');
      const old = r.objects.get(key);
      if (etag === null ? old !== undefined : old?.headers.etag !== etag) return false;
      return save(key, bytes, 'application/json');
    },
  };
  try {
    const publisher = createDistributionPublisher({ storage, r2, authorityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', verifyStaticResources: f.verify });
    const receipts = createDistributionReceipts({ r2 });
    const audio = f.files.get('grf/music/test.flac');
    for (let generation = 1; generation <= 2; generation++) {
      const record = { ...r.record, operationId: `ffffffff-ffff-4fff-8fff-${String(generation).padStart(12, '0')}` };
      if (generation > 1) { record.kind = 'listing'; record.gameId = GAME; }
      storage.transactionSync(() => publisher.ledger.enqueueInTxn(record));
      const expected = receipts.expectedObjects(publisher.ledger.entry(generation));
      for (const key of [expected.root.key, expected.rootArchive.key, expected.projection.key, expected.receiptKey]) allowed.add(key);
      const writesBefore = writes.length;
      f.files.set('grf/music/test.flac', null);
      assert.equal((await publisher.drainOne()).state, 'COMMITTED_SYNC_PENDING');
      assert.equal(writes.length, writesBefore);
      assert.equal(publisher.ledger.status().confirmedGeneration, generation - 1);
      f.files.set('grf/music/test.flac', audio); f.reads.length = 0;
      assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED');
      assert.equal(f.reads.length, 13);
      assert.equal(publisher.ledger.status().confirmedGeneration, generation);
      assert.equal(writes.filter(key => key === 'control/current.json').length, generation);
      assert.equal(publisher.ledger.entry(generation).payloadDigest, r.record.payloadDigest);
    }
  } finally { storage.close(); }
});
process.stdout.write(JSON.stringify({ checks, games: 4, legacyStaticReads: 52, batchStaticReads: 13, scope: 'owned memory transport plus actual SQLite/default publisher; exact read-count reduction, not a latency/game/cloud/retention certificate' }) + '\n');
