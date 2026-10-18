// Owned memory byte port only. No HTTP/TLS, publisher admission or retention proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildStaticRelease, STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES } from '../vps/static-release.mjs';
import { createStaticResourceVerifier } from '../vps/static-resources.mjs';
import { createDistributionResourceVerifier } from '../vps/distribution-resources.mjs';
import { publication, GAME, PORTRAIT, TEMPLATE_PORTRAIT } from './fixtures/publication.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const seasons = ['spring', 'summer', 'autumn', 'winter'];
function fixtureJSON(bytes) {
  try { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch (cause) { throw new Error('owned fixture JSON invalid', { cause }); }
}
function fixture() {
  const files = new Map([
    ['src/core.js', Buffer.from('export const fixture = true;')],
    ['src/lazy.js', Buffer.from('export const later = true;')],
    ['grf/music/loops/test.flac', Buffer.from('opaque transport music')],
    ['empty.bin', Buffer.alloc(0)], ['_headers', Buffer.from('deployment config')],
  ]);
  const visualAssets = {};
  for (const [group, stem] of [['seasonAtlases', 'map_atlas_'], ['seasons', 'map_tiles_']]) {
    visualAssets[group] = {};
    for (const season of seasons) {
      const path = `content/builtin/compiled/test-revision/${stem}${season}.png`;
      const bytes = Buffer.from('opaque transport image ' + path);
      files.set(path, bytes);
      visualAssets[group][season] = { path, url: path, sha256: sha(bytes), byteLength: bytes.length };
    }
  }
  const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: sha(bytes) })));
  files.set(STATIC_RELEASE_FILE, Buffer.from(built.bytes));
  const calls = [], hooks = {};
  const readStatic = async (path, options) => {
    assert.ok(files.has(path), 'only trusted package paths may be read');
    assert.notEqual(path, '_headers', 'configuration is not an HTTP asset');
    calls.push({ path, maxBytes: options.maxBytes });
    await hooks.beforeRead?.(path, calls.length);
    return files.get(path);
  };
  const options = { readStatic, expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest };
  return { files, built, calls, hooks, options, manifest: { visualAssets }, verify: createStaticResourceVerifier(options) };
}
let checks = 0;
async function check(fn) { await fn(); checks++; }
await check(async () => {
  const f = fixture(), result = await f.verify({ manifest: f.manifest });
  assert.equal(result.filesVerified, 12); assert.equal(Object.isFrozen(result), true);
  assert.equal(result.releaseDigest, f.built.sha256);
  assert.equal(result.bytesVerified, [...f.files].filter(([path]) => !['_headers', STATIC_RELEASE_FILE].includes(path)).reduce((n, [, bytes]) => n + bytes.length, 0));
  assert.equal(f.calls.length, 14);
  assert.equal(f.calls[0].maxBytes, STATIC_RELEASE_MAX_BYTES);
  assert.equal(f.calls.at(-1).maxBytes, f.built.bytes.length);
  for (const call of f.calls.slice(1, -1)) assert.equal(call.maxBytes, Math.max(1, f.files.get(call.path).length));
});
for (const path of [...fixture().files.keys()].filter(path => path !== '_headers')) {
  await check(async () => {
    const f = fixture(); f.files.set(path, null);
    await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RESOURCE_MISSING/);
  });
}
await check(async () => {
  const f = fixture(); f.files.set('src/lazy.js', Buffer.from('wrong same namespace'));
  await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RESOURCE_BYTES/);
});
await check(async () => {
  const f = fixture(); f.files.set('empty.bin', Buffer.from('x'));
  await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RESOURCE_BYTES/);
});
await check(async () => {
  const f = fixture(); f.files.set('src/core.js', 'not byte view');
  await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RESOURCE_BYTES/);
});
await check(async () => {
  const f = fixture(), verify = createStaticResourceVerifier({ ...f.options, expectedDigest: '0'.repeat(64) });
  await assert.rejects(verify({ manifest: f.manifest }), /STATIC_RELEASE_INVALID/); assert.equal(f.calls.length, 1);
});
await check(async () => {
  const f = fixture(), verify = createStaticResourceVerifier({ ...f.options, sourceTreeDigest: '0'.repeat(64) });
  await assert.rejects(verify({ manifest: f.manifest }), /STATIC_SOURCE_MISMATCH/); assert.equal(f.calls.length, 1);
});
for (const change of [
  manifest => { delete manifest.visualAssets; },
  manifest => { delete manifest.visualAssets.seasons.winter; },
  manifest => { manifest.visualAssets.extra = {}; },
  manifest => { manifest.visualAssets.seasons.winter.url = 'https://untrusted.invalid/image.png'; },
  manifest => { manifest.visualAssets.seasons.winter.extra = 'private'; },
  manifest => { const v = manifest.visualAssets.seasons.winter; v.path = v.url = '../private/secret'; },
  manifest => { const v = manifest.visualAssets.seasons.winter; v.path = v.url = v.path.replace('test-revision', 'other'); },
]) {
  await check(async () => {
    const f = fixture(); change(f.manifest);
    await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_VISUAL_BINDING/); assert.equal(f.calls.length, 0);
  });
}
for (const field of ['sha256', 'byteLength']) {
  await check(async () => {
    const f = fixture(); f.manifest.visualAssets.seasons.winter[field] = field === 'sha256' ? '0'.repeat(64) : 1;
    await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_VISUAL_BINDING/); assert.equal(f.calls.length, 1);
  });
}
await check(async () => {
  const f = fixture(); f.hooks.beforeRead = path => {
    if (path === STATIC_RELEASE_FILE && f.calls.length > 1) f.files.set(path, Buffer.from('changed deployment'));
  };
  await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RELEASE_CHANGED/);
});
await check(async () => {
  const f = fixture(); f.hooks.beforeRead = () => { delete f.manifest.visualAssets; };
  assert.equal((await f.verify({ manifest: f.manifest })).filesVerified, 12, 'visuals captured before await');
});
await check(async () => {
  const f = fixture(); await f.verify({ manifest: f.manifest });
  f.files.set('grf/music/loops/test.flac', null);
  await assert.rejects(f.verify({ manifest: f.manifest }), /STATIC_RESOURCE_MISSING/, 'no cross-call success cache');
});
await check(async () => {
  const f = fixture(); f.hooks.beforeRead = () => { throw new Error('port interrupted'); };
  await assert.rejects(f.verify({ manifest: f.manifest }), /port interrupted/);
});
await check(() => {
  const f = fixture();
  for (const options of [undefined, {}, { ...f.options, readStatic: null }, { ...f.options, expectedDigest: null }, { ...f.options, sourceTreeDigest: null }]) {
    assert.throws(() => createStaticResourceVerifier(options), /trusted byte port/);
  }
});
await check(async () => {
  const f = fixture(), entries = f.built.manifest.files.filter(file => !file.path.startsWith('src/')).map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }));
  const built = buildStaticRelease(entries); f.files.set(STATIC_RELEASE_FILE, built.bytes);
  const verify = createStaticResourceVerifier({ ...f.options, expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest });
  await assert.rejects(verify({ manifest: f.manifest }), /STATIC_SOURCE_MISMATCH/);
});
await check(async () => {
  // Actual runtime verifier with this static byte verifier, not a success stub.
  // Runtime/image bytes are still opaque transport fixtures, not a game.
  const f = fixture(), source = publication(), prefix = 'test/static-integration/';
  const objects = new Map(source.files.map(file => [file.key, { bytes: file.bytes, headers: { 'content-type': file.contentType } }]));
  objects.set('kao/0.png', { bytes: PORTRAIT, headers: { 'content-type': 'image/png' } });
  objects.set('kao/p0001.png', { bytes: TEMPLATE_PORTRAIT, headers: { 'content-type': 'image/png' } });
  const old = source.releases[0].runtime, index = fixtureJSON(objects.get(old.key).bytes);
  const manifest = fixtureJSON(objects.get(index.resources.manifest.key).bytes);
  manifest.visualAssets = structuredClone(f.manifest.visualAssets);
  const body = Buffer.from(JSON.stringify(manifest));
  objects.set(index.resources.manifest.key, { bytes: body, headers: { 'content-type': 'application/json' } });
  index.resources.manifest = { ...index.resources.manifest, byteLength: body.length, sha256: sha(body) };
  const indexBytes = Buffer.from(JSON.stringify(index)), hash = sha(indexBytes);
  const runtime = { key: old.key.replace(/runtime-[a-f0-9]{64}\.json$/, `runtime-${hash}.json`), byteLength: indexBytes.length, sha256: hash };
  objects.set(runtime.key, { bytes: indexBytes, headers: { 'content-type': 'application/json' } });
  source.releases[0].runtime = runtime;
  const { runtimeVersion, directory, releases, gameStates, announcements } = source, release = releases[0];
  const payload = Buffer.from(JSON.stringify({ version: 1, projection: { runtimeVersion, directory, releases, gameStates, announcements }, runtime: { gameId: GAME, releaseId: release.release_id, ordinal: release.ordinal, revision: release.draft_revision, sourceDigest: release.source_digest, chapters: directory[0].chapters, runtime } }));
  const record = { kind: 'publish', gameId: GAME, payload, payloadDigest: sha(payload) };
  const r2 = { async get(key, { maxBytes }) {
    assert.ok(key.startsWith(prefix)); const value = objects.get(key.slice(prefix.length));
    if (value) assert.equal(maxBytes, value.bytes.length); return value ?? null;
  } };
  await assert.rejects(createDistributionResourceVerifier({ r2, prefix })(record), /DISTRIBUTION_STATIC_NOT_CONFIGURED/);
  const verify = createDistributionResourceVerifier({ r2, prefix, verifyStaticResources: f.verify });
  assert.deepEqual(await verify(record), { runtimes: 1, objects: 7, reads: 7 });
  f.files.set('grf/music/loops/test.flac', null);
  await assert.rejects(verify(record), /STATIC_RESOURCE_MISSING/);
});
process.stdout.write(JSON.stringify({ checks, scope: 'owned memory byte port; no HTTP/core-compatibility/retention or production wiring proof' }) + '\n');
