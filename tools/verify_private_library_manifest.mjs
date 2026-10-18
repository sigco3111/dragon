// Narrow private library service regression, not HTTP/source-install/runtime admission.
// Actual pinned manifest and Web role bytes; explicit in-memory authority/catalog seams.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PrivateLibraryAssets } from '../server/libraryassets.js';
import { installedAvailableLibraryPolicy } from '../server/sourcecatalogpolicy.js';
import { HttpError } from '../server/security.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = readFileSync(new URL('../server/available-library.txt', import.meta.url));
const policy = installedAvailableLibraryPolicy(manifestBytes);
let manifest;
try { manifest = JSON.parse(manifestBytes.toString('utf8')); }
catch (cause) { throw new Error('pinned library JSON invalid', { cause }); }
const files = new Map();
for (const role of policy.roles) {
  const bytes = role.path === 'available-library-manifest.json' ? manifestBytes : readFileSync(new URL('../web/' + role.path, import.meta.url));
  assert.equal(bytes.length, role.byteLength); assert.equal(sha(bytes), role.sha256);
  files.set(role.path, bytes);
}
for (const [path, digest] of Object.entries(policy.programHashes)) assert.equal(sha(readFileSync(new URL('../' + path, import.meta.url))), digest, path);
const GAME = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const reference = { gameId: GAME, draftRevision: '1', sourceDigest: '1'.repeat(64) };
function fixture() {
  const actor = { id: 'owned-admin', role: 'admin', epoch: 1, must_change: 0 };
  let owner = actor.id, capturedRaw = manifestBytes, loads = 0, afterDraft, afterCatalog;
  const origin = { registry_id: 'owned-fixed-source', definition_digest: '2'.repeat(64) };
  const registered = { registry_id: origin.registry_id, root_digest: '3'.repeat(64) };
  const principal = token => { if (token !== 'owned-token') throw new HttpError(401, 'SESSION_INVALID'); return { ...actor }; };
  const storage = { sql: { exec(query, id) {
    if (query === 'SELECT * FROM copy_origins WHERE game_id=?' && id === GAME) return { toArray: () => [{ ...origin }] };
    if (query === 'SELECT * FROM installed_sources WHERE registry_id=?' && id === origin.registry_id) return { toArray: () => [{ ...registered }] };
    throw new Error('unexpected SQL / mutation in read-only fixture');
  } } };
  const games = { snapshotReference(token, id, revision) {
    const user = principal(token);
    if (owner !== user.id || id !== GAME || revision !== '1') throw new HttpError(404, 'GAME_NOT_FOUND');
    return { ...reference };
  } };
  const drafts = { async captureForCompile() {
    const result = { ownerId: actor.id, authEpoch: actor.epoch, reference: { ...reference } };
    afterDraft?.(); return result;
  } };
  const capture = { rootDigest: '4'.repeat(64), readWeb(path) {
    assert.ok(files.has(path));
    return Buffer.from(path === 'available-library-manifest.json' ? capturedRaw : files.get(path));
  } };
  const catalog = {
    definition: () => ({ registryId: policy.registryId, profileRevision: policy.profileRevision }),
    status: () => ({ rootDigest: capture.rootDigest }),
    async loadFull() { loads++; afterCatalog?.(); return capture; },
    assertCapture(token, value) { principal(token); assert.equal(value, capture); },
  };
  const service = new PrivateLibraryAssets({ storage, principal, games, drafts, catalog, policy });
  return { service, actor, origin, registered, setOwner: value => { owner = value; }, setRaw: value => { capturedRaw = value; }, afterDraft: fn => { afterDraft = fn; }, afterCatalog: fn => { afterCatalog = fn; }, loads: () => loads };
}
let n = 0;
function check(label, action) { return Promise.resolve().then(action).then(() => { n++; }, cause => { throw new Error(label, { cause }); }); }
const read = (f, assetId) => f.service.read('owned-token', { gameId: GAME, assetId }, '1');
const rejects = (action, code) => assert.rejects(action, error => error.code === code);
await check('all 400 pinned roles and consumer hashes match', () => { assert.equal(files.size, 400); assert.equal(manifestBytes.length, policy.roles.find(role => role.path === 'available-library-manifest.json').byteLength); });
const good = fixture(), listed = await read(good);
await check('current exact manifest is accepted without a second stale length pin', () => {
  assert.equal(listed.body.admission, 'private-available-bytes-only');
  assert.equal(listed.body.assets.length, 398);
  assert.equal(listed.body.unresolvedReferences.length, 20);
  assert.equal(listed.body.mode, 'STAGED_AVAILABLE_LIBRARY_NOT_Q69_CLOSURE');
  assert.equal(good.loads(), 1); listed.assertCurrent();
  for (const row of listed.body.assets) {
    const declared = manifest.resources[row.logicalURL];
    assert.equal(row.sha256, declared.sha256); assert.equal(row.byteLength, declared.byteLength); assert.equal(row.mime, declared.mime);
  }
});
await check('selected fixed attachment still requires whole-catalog capture', async () => {
  const selected = listed.body.assets.find(row => row.logicalURL === 'kao/0.png');
  const result = await read(good, selected.assetId);
  assert.deepEqual(result.artifact.bytes, files.get(selected.logicalURL)); assert.equal(result.artifact.sha256, selected.sha256);
  assert.equal(good.loads(), 2); result.assertCurrent();
});
await check('author gate unchanged and runs before source reads', async () => {
  const f = fixture(); f.actor.role = 'author'; await rejects(() => read(f), 'FIXED_LIBRARY_ADMIN_REQUIRED'); assert.equal(f.loads(), 0);
});
await check('must-change gate unchanged', async () => { const f = fixture(); f.actor.must_change = 1; await rejects(() => read(f), 'PASSWORD_CHANGE_REQUIRED'); });
await check('admin cannot read another owner', async () => { const f = fixture(); f.setOwner('other'); await rejects(() => read(f), 'GAME_NOT_FOUND'); });
await check('invalid role rejected before catalogue', async () => { const f = fixture(); await rejects(() => read(f, 'library-999'), 'LIBRARY_ASSET_NOT_FOUND'); assert.equal(f.loads(), 0); });
await check('old 93530-byte value is not a compatibility fallback', async () => { const f = fixture(); f.setRaw(manifestBytes.subarray(0, 93530)); await rejects(() => read(f), 'LIBRARY_MANIFEST_CORRUPT'); });
await check('same-size altered manifest rejected by SHA', async () => { const f = fixture(), bytes = Buffer.from(manifestBytes); bytes[0] ^= 1; f.setRaw(bytes); await rejects(() => read(f), 'LIBRARY_MANIFEST_CORRUPT'); });
await check('appended manifest rejected', async () => { const f = fixture(); f.setRaw(Buffer.concat([manifestBytes, Buffer.from(' ')])); await rejects(() => read(f), 'LIBRARY_MANIFEST_CORRUPT'); });
await check('epoch during draft await rejected', async () => { const f = fixture(); f.afterDraft(() => { f.actor.epoch++; }); await rejects(() => read(f), 'SESSION_INVALID'); });
await check('epoch during catalog await rejected', async () => { const f = fixture(); f.afterCatalog(() => { f.actor.epoch++; }); await rejects(() => read(f), 'SESSION_INVALID'); });
await check('source origin during catalog await rejected', async () => { const f = fixture(); f.afterCatalog(() => { f.origin.definition_digest = '5'.repeat(64); }); await rejects(() => read(f), 'DRAFT_SOURCE_CHANGED'); });
await check('returned assertion still rechecks ownership', async () => { const f = fixture(), value = await read(f); f.setOwner('other'); assert.throws(() => value.assertCurrent(), error => error.code === 'GAME_NOT_FOUND'); });
process.stdout.write(`private library manifest: ${n} groups; ${files.size} pinned roles, ${Object.keys(policy.programHashes).length} consumer hashes; authority/catalog seams only\n`);
