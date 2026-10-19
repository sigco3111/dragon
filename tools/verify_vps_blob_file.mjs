// V1 slice 4: run the REAL server/blobs.js ImmutableBlobStore and
// server/privatewrites.js PrivateWriteJournal on vps/file-bucket.mjs.
// Usage: node tools/verify_vps_blob_file.mjs
import { mkdtempSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { ImmutableBlobStore } from '../server/blobs.js';
import { GameMetadataStore } from '../server/metadata.js';
import { PrivateWriteJournal } from '../server/privatewrites.js';
import { HttpError, fail } from '../server/security.js';

let passed = 0;
const check = (name, cond) => {
  // pi-lens-ignore: no-console-except-error-js
  if (!cond) { console.error(`FAIL ${name}`); process.exitCode = 1; }
  // pi-lens-ignore: no-console-except-error-js
  else { passed++; console.log(`ok ${name}`); }
};
const fails = async (name, fn, code) => {
  try { await fn(); } catch (e) {
    check(name, (e instanceof HttpError || e?.code) && (e.code === code || e.message?.includes(code)));
    return;
  }
  check(name, false);
};

const GAME = '11111111-1111-4111-8111-111111111111';
const storage = openStorage(':memory:');
const games = new GameMetadataStore({ storage,
  principal: h => { if (h !== 'h1') { fail(401, 'SESSION_INVALID'); } return { id: 'u1', role: 'author', epoch: 1, must_change: 0 }; },
  verifySnapshot: undefined, recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
void games;
const own = mkdtempSync(join(tmpdir(), 'vps-blob-'));
const blobRoot = join(own, 'data');
try {
const bucket = new FileBucket({ root: blobRoot });
const journal = new PrivateWriteJournal({ storage, bucket });
const authority = (tokenHash, _context) => {
  if (tokenHash !== 'h1') { fail(401, 'SESSION_INVALID'); }
  return { ownerId: '22222222-2222-4222-8222-222222222222', epoch: 1 };
};
const store = new ImmutableBlobStore({ bucket: journal, authority, storage });
const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

const put1 = await store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes });
check('put created', put1.created === true && put1.key === `private/${GAME}/${put1.sha256}` && put1.byteLength === 8);
const read1 = await store.read('h1', { gameId: GAME, sha256: put1.sha256, byteLength: 8 });
check('read bytes equal', Buffer.from(read1.bytes).equals(Buffer.from(bytes)));
const put2 = await store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes });
check('reput conditional miss', put2.created === false && put2.key === put1.key);

const rows = storage.sql.exec("SELECT state FROM content_private_writes WHERE game_id=? AND sha256=?", GAME, put1.sha256).toArray();
check('journal settled', rows.length >= 1 && rows.every(r => r.state === 'settled'));

const [c1, c2] = await Promise.all([
  store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array([9]) }),
  store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array([9]) }),
]);
check('concurrent one-wins', c1.created !== c2.created && c1.key === c2.key);

await fails('unknown sha 404', async () => store.read('h1', { gameId: GAME, sha256: 'f'.repeat(64), byteLength: 8 }), 'BLOB_NOT_FOUND');
await fails('wrong length corrupt', async () => store.read('h1', { gameId: GAME, sha256: put1.sha256, byteLength: 9 }), 'BLOB_CORRUPT');
await fails('builtin 403', async () => store.putImmutable('h1', { gameId: 'wolong-builtin', allocation: {}, bytes }), 'BUILTIN_PROTECTED');
await fails('bad game 422', async () => store.putImmutable('h1', { gameId: 'nope', allocation: {}, bytes }), 'BLOB_GAME_ID');
await fails('bad principal 401', async () => store.putImmutable('hx', { gameId: GAME, allocation: {}, bytes }), 'SESSION_INVALID');
const tiny = new ImmutableBlobStore({ bucket: journal, authority, storage, maxBytes: 16 });
await fails('oversize 413', async () => tiny.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array(17) }), 'BLOB_TOO_LARGE');
await fails('non-bytes 422', async () => store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: 'nope' }), 'BLOB_BYTES');

// Tamper the stored file: the store must catch it on re-read (no etag trust).
const tampered = await store.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array([7, 7]) });
const diskPath = join(blobRoot, 'private', GAME, `${tampered.sha256}.bin`);
appendFileSync(diskPath, new Uint8Array([0]));
await fails('tamper corrupt', async () => store.read('h1', { gameId: GAME, sha256: tampered.sha256, byteLength: 2 }), 'BLOB_CORRUPT');

const listed = await journal.list({ prefix: `private/${GAME}/` });
check('list prefix', listed.objects.some(o => o.key === put1.key && o.size === 8));

let traversal = false;
try { await bucket.put('../../evil', new Uint8Array([1]), {}); } catch { traversal = true; }
check('bucket traversal rejected', traversal);
await fails('journal bad key 422', async () => journal.put('evil', new Uint8Array([1]), {}), 'PRIVATE_WRITE_KEY');

// pi-lens-ignore: no-console-except-error-js
console.log(`passed ${passed} checks`);
} finally { storage.close(); rmSync(own, { recursive: true, force: true }); }
