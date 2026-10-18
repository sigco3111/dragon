// Owned R2 metadata/transport tests. No local archives, deletion or old admission.
import assert from 'node:assert/strict';
import reader from '../../reader/worker.js';
import { createPlayerReader, PlayerReaderError } from '../../reader/playerclient.js';
import { publicationRootArchiveKey } from '../../reader/publicationroot.js';
import { firstOnlineReceiptKey } from '../../reader/firstonline.js';
import { sha } from './publication.mjs';
function parse(value) { try { return JSON.parse(value); } catch (cause) { throw new Error('invalid owned history fixture JSON', { cause }); } }
export async function exerciseReleaseHistory({ call, bucket, bindings, source, newer, ref, authority }) {
  let checks = 0;
  const client = createPlayerReader({ origin: 'https://reader.test', fetch: url => {
    let parsed;
    try { parsed = new URL(url); } catch (cause) { throw new Error('invalid owned release URL', { cause }); }
    return call(parsed.pathname + parsed.search);
  } });
  const old = source.directory[0], current = newer.directory[0];
  const query = row => '/play-api/v1/releases?' + new URLSearchParams({ game: row.gameId, release: row.releaseId, ordinal: row.ordinal });
  const path = query(old), rootObject = await bucket.get('control/current.json');
  const rootBytes = new Uint8Array(await rootObject.arrayBuffer()), root = parse(new TextDecoder().decode(rootBytes));
  const archiveKey = publicationRootArchiveKey({ ...ref, authorityId: authority });
  const receiptKey = firstOnlineReceiptKey(ref, root);
  const archiveBytes = new Uint8Array(await (await bucket.get(archiveKey)).arrayBuffer());
  const receiptBytes = new Uint8Array(await (await bucket.get(receiptKey)).arrayBuffer());
  const restore = async () => {
    await bucket.put(archiveKey, archiveBytes, { httpMetadata: { contentType: 'application/json' } });
    await bucket.put(receiptKey, receiptBytes, { httpMetadata: { contentType: 'application/json' } });
  };
  const expectedManifest = data => parse(Buffer.from(data.files.find(file => file.key === data.releases[0].runtime.key).bytes)).resources.manifest.sha256;
  for (const [row, data] of [[old, source], [current, newer]]) {
    const response = await call(query(row)), body = await response.json();
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, { saved: { ...row, manifestDigest: expectedManifest(data) }, current });
    assert.ok(!/ticket|fileEndpoint|authorityId|operationDigest|runtime\.json/.test(JSON.stringify(body))); checks++;
    const recognized = await client.release({ gameId: row.gameId, releaseId: row.releaseId, ordinal: row.ordinal });
    assert.deepEqual(recognized, body);
    assert.ok(Object.isFrozen(recognized) && Object.isFrozen(recognized.saved.chapters) && Object.isFrozen(recognized.current)); checks++;
  }
  for (const tail of ['', '?game=bad', '?game=' + old.gameId, '?' + new URLSearchParams({ game: old.gameId, release: 'bad', ordinal: old.ordinal }), '?' + new URLSearchParams({ game: old.gameId, release: old.releaseId, ordinal: '1.00' })]) {
    assert.equal((await call('/play-api/v1/releases' + tail)).status, 422); checks++;
  }
  for (const extra of ['&game=' + old.gameId, '&release=' + old.releaseId, '&ordinal=' + old.ordinal, '&extra=1']) {
    assert.equal((await call(path + extra)).status, 422); checks++;
  }
  for (const row of [{ ...old, releaseId: current.releaseId }, { ...current, releaseId: old.releaseId }, { ...old, ordinal: '1.99' }]) {
    assert.equal((await call(query(row))).status, 404); checks++;
  }
  // The archived candidate alone is never sufficient. Unavailable proofs leave
  // current admissions and already-issued capabilities under their own policy.
  await bucket.delete(receiptKey); assert.equal((await call(path)).status, 503); checks++; await restore();
  for (const damaged of [null, { bytes: new Uint8Array() }, { bytes: Buffer.from('{}') }, { bytes: Buffer.alloc(4097) }, { bytes: archiveBytes, type: 'text/plain' }, { bytes: Buffer.concat([Buffer.from(archiveBytes), Buffer.from('\n')]) }]) {
    if (damaged === null) await bucket.delete(archiveKey);
    else await bucket.put(archiveKey, damaged.bytes, { httpMetadata: { contentType: damaged.type ?? 'application/json' } });
    assert.equal((await call(path)).status, 503);
    assert.equal((await call(query(current))).status, 200); checks++; await restore();
  }
  // Even a matching receipt digest cannot change the authority/reference tuple.
  const archived = parse(new TextDecoder().decode(archiveBytes));
  const receipt = parse(new TextDecoder().decode(receiptBytes));
  for (const [field, value] of [['authorityId', old.gameId], ['operationId', old.gameId], ['generation', ref.generation + 1], ['operationDigest', 'a'.repeat(64)], ['payloadDigest', 'b'.repeat(64)]]) {
    const bytes = Buffer.from(JSON.stringify({ ...archived, [field]: value }));
    await bucket.put(archiveKey, bytes, { httpMetadata: { contentType: 'application/json' } });
    await bucket.put(receiptKey, JSON.stringify({ ...receipt, rootDigest: sha(bytes) }), { httpMetadata: { contentType: 'application/json' } });
    assert.equal((await call(path)).status, 503); checks++; await restore();
  }
  const runtimeKey = source.releases[0].runtime.key, runtime = await bucket.get(runtimeKey);
  const runtimeBytes = new Uint8Array(await runtime.arrayBuffer());
  await bucket.delete(runtimeKey); assert.equal((await call(path)).status, 503); checks++;
  await bucket.put(runtimeKey, runtimeBytes, { httpMetadata: { contentType: 'application/json' } });
  const currentProjectionKey = `projections/${root.generation}/${root.digest}/projection.json`;
  const projection = parse(await (await bucket.get(currentProjectionKey)).text());
  const object = bytes => ({ size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
  for (const mode of ['changed', 'unlisted', 'deleted', 'unknown']) {
    let readIndex = false;
    const p = { ...projection, directory: [], releases: [], gameStates: mode === 'unknown' ? [] : [{ gameId: old.gameId, listed: false, ...(mode === 'deleted' ? { deleted: true } : {}) }] };
    const bytes = Buffer.from(JSON.stringify(p)), digest = sha(bytes);
    const changedRoot = mode === 'changed' ? { ...root, operationDigest: 'e'.repeat(64) } : { ...root, digest };
    const transport = (url, options) => reader.fetch(new Request(url, options), { ...bindings, PUBLISH_BUCKET: { async get(key) {
      if (readIndex && key === 'control/current.json') return object(Buffer.from(JSON.stringify(changedRoot)));
      if (readIndex && key === `projections/${root.generation}/${digest}/projection.json`) return object(bytes);
      const value = await bucket.get(key); if (key === runtimeKey) readIndex = true; return value;
    } } });
    const response = await transport('https://reader.test' + path);
    assert.equal(readIndex, true);
    const expected = { changed: [409, 'REGISTRY_CHANGED'], unlisted: [403, 'GAME_NOT_LISTED'], deleted: [410, 'GAME_DELETED'], unknown: [503, 'GAME_STATE_UNAVAILABLE'] }[mode];
    assert.equal(response.status, expected[0]); assert.equal((await response.json()).error, expected[1]); checks++;
    readIndex = false;
    const racing = createPlayerReader({ origin: 'https://reader.test', fetch: transport });
    await assert.rejects(() => racing.release({ gameId: old.gameId, releaseId: old.releaseId, ordinal: old.ordinal }),
      error => error instanceof PlayerReaderError && error.status === expected[0] && error.code === expected[1]);
    assert.equal(readIndex, true); checks++;
  }
  assert.deepEqual(new Uint8Array(await (await bucket.get('control/current.json')).arrayBuffer()), rootBytes);
  assert.equal((await call(path)).status, 200); checks++;
  return checks;
}
