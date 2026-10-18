// Owned transport DTOs + memory bucket + actual reader. No database, network,
// real compiled game, physical cleanup, authority commit or production receipt.
import assert from 'node:assert/strict';
import { publication, GAME, PORTRAIT, TEMPLATE_PORTRAIT, sha } from './fixtures/publication.mjs';
import { buildRuntimeIndex } from '../vps/runtime-index.mjs';
import { uploadRelease } from '../vps/publish_to_r2.mjs';
import { parseJSON, validateIndex, validateRuntimeReference } from '../reader/runtimecontract.js';
import reader from '../reader/worker.js';
let checks = 0;
const check = (label, action) => { try { action(); checks++; } catch (cause) { throw new Error(label, { cause }); } };
function candidate(releaseId, content = releaseId) {
  const seed = publication(1), pin = { ...seed.directory[0], releaseId, sourceDigest: sha(content) };
  const release = { ...seed.releases[0], release_id: releaseId, source_digest: pin.sourceDigest };
  const manifest = parseJSON(seed.files.find(file => file.key.endsWith('/manifest.json')).bytes);
  manifest.identity.sourceDigest = pin.sourceDigest;
  const bytes = Buffer.from(`owned terrain ${content}`), asset = { asset_id: 'terrain', sha256: sha(bytes), byte_length: bytes.length, bytes };
  manifest.assets = [{ assetId: 'terrain', sha256: asset.sha256, byteLength: bytes.length, url: `/api/trial-asset?game=${GAME}&revision=${pin.revision}&digest=${pin.sourceDigest}&asset=terrain` }];
  const chapters = pin.chapters.map(chapter_id => ({ chapter_id, state_json: JSON.stringify({ fixture: `${content}:${chapter_id}` }) }));
  const built = buildRuntimeIndex(pin, release, { revision: pin.revision, source_digest: pin.sourceDigest, manifest_json: JSON.stringify(manifest) }, chapters, [asset]);
  return { ...seed, files: built.files, dependencies: built.dependencies, directory: [pin], releases: [{ ...release, runtime: built.reference }] };
}
const abandoned = candidate('attempt-abandoned'), winner = candidate('attempt-winner');
check('different attempts for one candidate ordinal have disjoint artifact keys', () => {
  assert.equal(abandoned.directory[0].ordinal, winner.directory[0].ordinal);
  const keys = new Set(abandoned.files.map(file => file.key));
  assert.equal(winner.files.filter(file => keys.has(file.key)).length, 0);
  assert.deepEqual(abandoned.dependencies, winner.dependencies, 'shared kao dependencies stay shared');
});
const winnerIndex = parseJSON(winner.files.find(file => file.key === winner.releases[0].runtime.key).bytes);
for (const role of Object.keys(winnerIndex.resources).filter(role => !winnerIndex.resources[role].key.startsWith('kao/'))) {
  check(`cross-release role ${role} rejected`, () => {
    const bad = structuredClone(winnerIndex);
    bad.resources[role].key = bad.resources[role].key.replace('/attempt-winner/', '/attempt-abandoned/');
    assert.throws(() => validateIndex(bad), /RUNTIME_CORRUPT/);
  });
}
check('cross-release and old ordinal-only index references rejected', () => {
  const ref = winner.releases[0].runtime;
  assert.throws(() => validateRuntimeReference({ ...winnerIndex, releaseId: 'attempt-abandoned' }, ref), /RUNTIME_CORRUPT/);
  assert.throws(() => validateRuntimeReference(winnerIndex, { ...ref, key: ref.key.replace('/attempt-winner/', '/') }), /RUNTIME_CORRUPT/);
});
check('old ordinal-only manifest alias rejected', () => {
  const bad = structuredClone(winnerIndex);
  bad.resources.manifest.key = bad.resources.manifest.key.replace('/attempt-winner/', '/');
  assert.throws(() => validateIndex(bad), /RUNTIME_CORRUPT/);
});
const objects = new Map(), prefix = 'test/release-namespace/';
let rootWrites = 0;
const put = (key, bytes) => { const copy = Buffer.from(bytes); objects.set(key, { bytes: copy, headers: { etag: `"${sha(copy)}"` } }); };
const r2 = {
  async get(key) { const row = objects.get(key); return row ? { bytes: Buffer.from(row.bytes), headers: { ...row.headers } } : null; },
  async putImmutable(key, bytes) { if (objects.has(key)) return null; put(key, bytes); return {}; },
  async putControl(key, bytes, etag) { if ((objects.get(key)?.headers.etag ?? null) !== etag) return null; put(key, bytes); rootWrites++; return {}; },
};
// Match buildPayload's physical prefix adapter; index references stay logical.
const publish = (payload, prior) => uploadRelease(r2, prefix, { ...payload,
  files: payload.files.map(file => ({ ...file, key: prefix + file.key })),
  dependencies: payload.dependencies.map(ref => ({ ...ref, key: prefix + ref.key })),
}, prior);
put(`${prefix}kao/0.png`, PORTRAIT); put(`${prefix}kao/p0001.png`, TEMPLATE_PORTRAIT);
await publish(publication(), null);
const env = {
  PLAYER_ORIGIN: 'https://owned.invalid', PLAYER_ADMISSION_ACTIVE_KEY: 'owned', PLAYER_ADMISSION_KEYS: JSON.stringify({ owned: '11'.repeat(32) }),
  PUBLISH_BUCKET: { async get(key) { const row = await r2.get(prefix + key); return row ? { size: row.bytes.length, arrayBuffer: async () => Uint8Array.from(row.bytes).buffer } : null; } },
};
const get = (path, ticket) => reader.fetch(new Request(env.PLAYER_ORIGIN + path, ticket ? { headers: { Authorization: `Bearer ${ticket}` } } : {}), env);
const admissionPath = ordinal => `/play-api/v1/admissions?game=${GAME}&ordinal=${ordinal}&chapter=c1`;
const previous = await get(admissionPath('1.0'));
assert.equal(previous.status, 200); const oldTicket = (await previous.json()).ticket;
const prior = await r2.get(prefix + 'control/current.json');
for (const file of abandoned.files) await r2.putImmutable(prefix + file.key, file.bytes);
check('staging alone cannot switch the published root', () => {
  assert.equal(rootWrites, 1); assert.deepEqual(objects.get(prefix + 'control/current.json').bytes, prior.bytes);
});
assert.equal((await get(admissionPath('1.1'))).status, 409); checks++;
assert.equal((await get('/play-api/v1/file?key=' + encodeURIComponent(abandoned.releases[0].runtime.key), oldTicket)).status, 403); checks++;
const visible = await publish(winner, prior);
check('another attempt can publish the same candidate ordinal despite orphaned first bytes', () => {
  assert.equal(visible.generation, 2); assert.equal(rootWrites, 2);
  for (const file of abandoned.files) assert.deepEqual(objects.get(prefix + file.key).bytes, Buffer.from(file.bytes));
});
const admitted = await get(admissionPath('1.1'));
assert.equal(admitted.status, 200); const current = await admitted.json();
assert.equal(current.releaseId, 'attempt-winner'); checks++;
const chapter = await get('/play-api/v1/file?role=chapter%3Ac1', current.ticket);
assert.equal(chapter.status, 200); assert.deepEqual(await chapter.json(), { fixture: 'attempt-winner:c1' }); checks++;
const oldChapter = await get('/play-api/v1/file?role=chapter%3Ac1', oldTicket);
assert.equal(oldChapter.status, 200); assert.deepEqual(await oldChapter.json(), { fixture: '0:c1' }); checks++;
const beforeMismatch = await r2.get(prefix + 'control/current.json');
await assert.rejects(() => publish(candidate('attempt-winner', 'changed-body'), beforeMismatch), /immutable mismatch/);
check('reusing an attempt with different bytes is not an idempotent retry', () => {
  assert.equal(rootWrites, 2); assert.deepEqual(objects.get(prefix + 'control/current.json').bytes, beforeMismatch.bytes);
});
process.stdout.write(`runtime release namespace: ${checks} checks green\n`);
