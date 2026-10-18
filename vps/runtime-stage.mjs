// Precommit immutable runtime upload. No SQL, public projection/root writes,
// version allocation, shared-library writes or cleanup. The caller still owns
// current authority and the final same-SQLite commit; this is not visibility.
import { createHash } from 'node:crypto';
import { buildRuntimeIndex } from './runtime-index.mjs';
import { createDistributionResourceVerifier } from './distribution-resources.mjs';
import { isGameId, parseJSON, sameIdentity } from '../reader/runtimecontract.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function check(value) { if (!value) throw new Error('RUNTIME_STAGE'); }
function identityOf(value) {
  check(value && isGameId(value.releaseId));
  return { gameId: value.gameId, releaseId: value.releaseId, ordinal: value.ordinal, revision: value.draftRevision, sourceDigest: value.sourceDigest };
}
function checkObject(stored, ref) {
  check(stored?.bytes instanceof Uint8Array);
  const bytes = Buffer.from(stored.bytes);
  const types = Object.entries(stored.headers ?? {}).filter(([key]) => key.toLowerCase() === 'content-type');
  check(types.length === 1 && (types[0][1] === ref.contentType || ref.contentType === 'application/json' && types[0][1] === 'application/json; charset=utf-8'));
  check(bytes.length === ref.byteLength && sha(bytes) === ref.sha256);
}
export function createRuntimeStager({ r2, prefix = '', verifyStaticResources }) {
  if (typeof r2?.get !== 'function' || typeof r2?.putImmutable !== 'function' || typeof prefix !== 'string' || !(prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)) || verifyStaticResources !== undefined && typeof verifyStaticResources !== 'function') throw new TypeError('trusted immutable R2 ports and prefix required');
  const proofs = new WeakMap();
  async function stage(candidate, snapshot, assertCurrent) {
    if (typeof assertCurrent !== 'function' || assertCurrent.constructor?.name === 'AsyncFunction') throw new TypeError('synchronous current-authority assertion required');
    const current = () => { if (assertCurrent() !== undefined) throw new TypeError('current-authority assertion must return undefined'); };
    current();
    // buildRuntimeIndex copies every payload before the first await. No caller
    // mutations can change the keys, expected bytes or proof of this attempt.
    const identity = identityOf(candidate);
    check(snapshot?.identity?.gameId === identity.gameId && snapshot.identity.draftRevision === identity.revision && snapshot.identity.sourceDigest === identity.sourceDigest && snapshot.pack?.game_id === identity.gameId);
    const manifest = parseJSON(Buffer.from(snapshot.pack.manifest_json));
    if (Object.hasOwn(manifest, 'visualAssets') && !verifyStaticResources) throw new Error('DISTRIBUTION_STATIC_NOT_CONFIGURED');
    const built = buildRuntimeIndex({ ...identity, chapters: manifest.chapters }, { game_id: identity.gameId, release_id: identity.releaseId, ordinal: identity.ordinal, draft_revision: identity.revision, source_digest: identity.sourceDigest }, snapshot.pack, snapshot.chapters, snapshot.assets);
    const runtime = Object.freeze({ ...identity, chapters: Object.freeze([...manifest.chapters]), runtime: Object.freeze({ ...built.reference }) });
    const guarded = {
      async get(key, options) {
        current();
        try { return await r2.get(key, options); }
        finally { current(); }
      },
    };
    // Missing shared portraits must not cause PUTs to kao/ or fallback copying.
    for (const dependency of built.dependencies) checkObject(await guarded.get(prefix + dependency.key, { maxBytes: dependency.byteLength }), dependency);
    for (const file of built.files) {
      current();
      // A lost PUT response can still have installed the exact immutable bytes.
      // Only the following bounded readback decides; never overwrite or delete.
      try { await r2.putImmutable(prefix + file.key, Buffer.from(file.bytes), file.contentType); }
      catch { /* Unknown result; read it back below. */ }
      finally { current(); }
      checkObject(await guarded.get(prefix + file.key, { maxBytes: file.bytes.length }), { sha256: sha(file.bytes), byteLength: file.bytes.length, contentType: file.contentType });
    }
    const payload = Buffer.from(JSON.stringify({ version: 1, projection: { runtimeVersion: 1, directory: [], releases: [], announcements: [], gameStates: [{ gameId: identity.gameId, listed: false }] }, runtime }));
    const verify = createDistributionResourceVerifier({ r2: guarded, prefix, verifyStaticResources: verifyStaticResources && (async value => {
      current();
      try { return await verifyStaticResources(value); }
      finally { current(); }
    }) });
    // Re-read the complete graph after all uploads, including shared objects and
    // the configured static closure. A set of successful PUTs is not this proof.
    await verify({ kind: 'publish', gameId: identity.gameId, payload, payloadDigest: sha(payload) });
    current();
    const ticket = Object.freeze({}); proofs.set(ticket, runtime);
    return Object.freeze({ ticket, runtime });
  }
  function verifyStaged(ticket, candidate) {
    const runtime = proofs.get(ticket);
    check(runtime && sameIdentity(runtime, identityOf(candidate)));
    return runtime;
  }
  return Object.freeze({ stage, verifyStaged });
}
