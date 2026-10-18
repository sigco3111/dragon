// Actual frozen publisher -> owned workerd/R2 -> actual reader, with Node SQLite.
// Opaque runtime fixtures, not HTTP authority, playable game, physical deletion,
// S3, production migration or announcement firstOnlineAt producer evidence.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { openStorage } from '../vps/sqlite-port.mjs';
import { createDistributionPublisher } from '../vps/distribution-publisher.mjs';
import { uploadRelease } from '../vps/publish_to_r2.mjs';
import { validatePublicationRoot } from '../reader/publicationroot.js';
import reader from '../reader/worker.js';
import { publication, unlisted, GAME, OTHER_GAME, PORTRAIT, TEMPLATE_PORTRAIT } from './fixtures/publication.mjs';
const require = createRequire(import.meta.url);
let modulePath;
try { modulePath = require.resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) throw new Error('installed Miniflare required; no automatic install');
const { Miniflare } = await import(pathToFileURL(modulePath).href);
const own = mkdtempSync(join(tmpdir(), 'dragon-reader-frozen-'));
const bindings = { PLAYER_ORIGIN: 'https://reader.test', PLAYER_ADMISSION_ACTIVE_KEY: 'owned', PLAYER_ADMISSION_KEYS: JSON.stringify({ owned: '11'.repeat(32) }) };
const AUTHORITY = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
const rootKey = 'control/current.json', chapter = `${GAME}#upper-1`;
const project = source => ({ runtimeVersion: 1, directory: source.directory, releases: source.releases, gameStates: source.gameStates, announcements: source.announcements });
const runtime = source => { const r = source.releases[0]; return { gameId: r.game_id, releaseId: r.release_id, ordinal: r.ordinal, revision: r.draft_revision, sourceDigest: r.source_digest, chapters: source.directory[0].chapters, runtime: r.runtime }; };
let mf, storage, bucket, outbound = 0, checks = 0, serial = 0, rootWrites = 0, receiptWrites = 0;
const check = (name, value) => { assert.ok(value, name); checks++; };
try {
  storage = openStorage(join(own, 'ledger.sqlite'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }], scriptPath: resolve('reader/worker.js'), compatibilityDate: '2024-01-01', host: '127.0.0.1', port: 0, r2Buckets: ['PUBLISH_BUCKET'], r2Persist: join(own, 'r2'), bindings, outboundService: () => { outbound++; return new Response('forbidden', { status: 403 }); } });
  await mf.ready; bucket = await mf.getR2Bucket('PUBLISH_BUCKET');
  const r2 = {
    async get(key, options) {
      const row = await bucket.get(key); if (row === null) return null;
      if (options) assert.ok(row.size <= options.maxBytes, 'bounded provider read');
      return { bytes: new Uint8Array(await row.arrayBuffer()), headers: { etag: row.httpEtag, 'content-type': row.httpMetadata.contentType, 'last-modified': row.uploaded.toUTCString() } };
    },
    async putImmutable(key, bytes, contentType) {
      assert.equal(arguments.length, 3); assert.notEqual(key, rootKey); assert.ok(!key.startsWith('kao/'));
      if (key.startsWith('control/receipts/')) receiptWrites++;
      return await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType } }) !== null;
    },
    async putControl(key, bytes, etag) {
      assert.equal(arguments.length, 3); assert.equal(key, rootKey); rootWrites++;
      if (etag !== null) assert.match(etag, /^"[^"\r\n]+"$/);
      return await bucket.put(key, bytes, { onlyIf: etag === null ? { etagDoesNotMatch: '*' } : { etagMatches: etag.slice(1, -1) }, httpMetadata: { contentType: 'application/json' } }) !== null;
    },
  };
  let publisher = createDistributionPublisher({ storage, r2, authorityId: AUTHORITY }); // Default real resource verifier, no override.
  const enqueue = (kind, source, prepared = null) => {
    const payload = Buffer.from(JSON.stringify({ version: 1, projection: project(source), ...(prepared ? { runtime: runtime(prepared) } : {}) }));
    return storage.transactionSync(() => publisher.ledger.enqueueInTxn({ operationId: `eeeeeeee-eeee-4eee-aeee-${String(++serial).padStart(12, '0')}`, kind, gameId: GAME, payload }));
  };
  const drain = async () => {
    const result = await publisher.drainOne(); assert.equal(result.state, 'VISIBLE_CONFIRMED');
    assert.equal(publisher.ledger.status().confirmedGeneration, serial);
    const control = validatePublicationRoot(JSON.parse(Buffer.from((await r2.get(rootKey)).bytes).toString('utf8')));
    assert.equal(control.version, 2); assert.equal(control.authorityId, AUTHORITY); assert.equal(control.generation, serial);
    assert.ok(await bucket.get(`control/receipts/${AUTHORITY}/${serial}/${control.operationDigest}.json`));
    checks++; return result;
  };
  const call = (path, ticket = null) => mf.dispatchFetch(`https://reader.test${path}`, { headers: ticket ? { Authorization: `Bearer ${ticket}` } : {} });
  const admit = n => `/play-api/v1/admissions?game=${GAME}&ordinal=1.${n}&chapter=${encodeURIComponent(chapter)}`;
  const filePath = role => `/play-api/v1/file?role=${encodeURIComponent(role)}`;
  const chapterFile = filePath(`chapter:${chapter}`);
  const seed = async source => { for (const file of source.files) await r2.putImmutable(file.key, file.bytes, file.contentType); };
  const v1 = publication(0, GAME, [chapter]), v2 = publication(1, GAME, [chapter]);
  await seed(v1);
  check('staged files alone cannot admit', (await call(admit(0))).status === 503);
  enqueue('publish', unlisted(), v1);
  check('queued SQL alone cannot admit', (await call(admit(0))).status === 503);
  check('missing portrait keeps frozen publish pending', (await publisher.drainOne()).state === 'COMMITTED_SYNC_PENDING' && rootWrites === 0);
  await bucket.put('kao/0.png', PORTRAIT, { httpMetadata: { contentType: 'image/png' } });
  check('second portrait also required before hidden publication', (await publisher.drainOne()).state === 'COMMITTED_SYNC_PENDING' && rootWrites === 0);
  await bucket.put('kao/p0001.png', TEMPLATE_PORTRAIT, { httpMetadata: { contentType: 'image/png' } });
  await drain();
  check('hidden publication has no directory or ticket', (await (await call('/play-api/v1/registry')).json()).directory.length === 0 && (await call(admit(0))).status === 403);
  enqueue('listing', v1); await drain();
  let response = await call('/play-api/v1/registry'), body = await response.json();
  check('frozen root yields current public directory', response.status === 200 && body.generation === 2 && body.directory[0].ordinal === '1.0' && body.announcements.length === 1);
  check('no private authority/operation/payload fields in registry', !/authorityId|operationId|payloadDigest|gameStates|runtime-/.test(JSON.stringify(body)));
  response = await call(admit(0)); body = await response.json();
  check('actual worker signs scoped chapter', response.status === 200 && body.chapterId === chapter && typeof body.ticket === 'string');
  const oldTicket = body.ticket;
  response = await call(chapterFile, oldTicket);
  check('actual worker reads fixed old chapter', response.status === 200 && (await response.json()).fixture === `0:${chapter}`);
  await seed(v2); enqueue('publish', v2, v2);
  check('pending update is not publicly current', (await call(admit(1))).status === 409 && (await call(admit(0))).status === 200);
  await drain();
  response = await call(admit(1)); body = await response.json(); const newTicket = body.ticket;
  check('only new version receives fresh ticket', response.status === 200 && (await call(admit(0))).status === 409);
  response = await call(chapterFile, oldTicket);
  check('old ticket keeps old bytes after actual v2 switch', response.status === 200 && (await response.json()).fixture === `0:${chapter}`);
  response = await call(chapterFile, newTicket);
  check('new ticket reads new bytes', response.status === 200 && (await response.json()).fixture === `1:${chapter}`);
  enqueue('listing', unlisted()); await drain();
  check('unlist denies new admissions and hides announcements', (await call(admit(1))).status === 403 && (await (await call('/play-api/v1/registry')).json()).announcements.length === 0);
  response = await call(chapterFile, oldTicket);
  check('unlist retains already admitted bytes', response.status === 200 && (await response.json()).fixture === `0:${chapter}`);
  check('unlist retains shared portrait access', (await call(filePath('asset:p0001'), oldTicket)).status === 200);
  enqueue('listing', v2); await drain();
  const writesBeforeRestart = rootWrites;
  storage.close(); storage = openStorage(join(own, 'ledger.sqlite'));
  publisher = createDistributionPublisher({ storage, r2, authorityId: AUTHORITY });
  check('reopened durable ledger idle does not rewrite root', (await publisher.drainOne()).state === 'IDLE' && rootWrites === writesBeforeRestart);
  check('ticket survives publisher restart without renewal', (await call(chapterFile, oldTicket)).status === 200);
  const prior = await r2.get(rootKey), root = JSON.parse(Buffer.from(prior.bytes).toString('utf8'));
  let forbiddenIO = 0;
  const forbiddenPort = new Proxy({}, { get() { return () => { forbiddenIO++; throw new Error('legacy writer performed I/O'); }; } });
  await assert.rejects(() => uploadRelease(forbiddenPort, '', v2, { ...prior, bytes: Buffer.from(prior.bytes) }), /CONTROL_PROTOCOL_MISMATCH/);
  check('legacy publisher cannot downgrade v2 even before dependency reads', forbiddenIO === 0);
  // Node invocation of the SAME reader + actual bucket. Only the final root
  // representation is injected; no tampering with the publisher's durable head.
  for (const [field, changed] of [['authorityId', OTHER_GAME], ['operationId', OTHER_GAME], ['operationDigest', 'a'.repeat(64)], ['payloadDigest', 'b'.repeat(64)], ['previousOperationDigest', 'c'.repeat(64)]]) {
    let indexRead = false;
    const altered = Buffer.from(JSON.stringify({ ...root, [field]: changed }));
    const env = { ...bindings, PUBLISH_BUCKET: { async get(key) {
      if (key === rootKey && indexRead) return { size: altered.length, arrayBuffer: async () => Uint8Array.from(altered).buffer };
      const value = await bucket.get(key); if (key === v2.releases[0].runtime.key) indexRead = true; return value;
    } } };
    response = await reader.fetch(new Request(`https://reader.test${admit(1)}`), env); body = await response.json();
    check(`same generation/digest but changed ${field} refuses ticket`, indexRead && response.status === 409 && body.error === 'REGISTRY_CHANGED' && !body.ticket);
  }
  // Real publisher unlists during the final file await, then tombstones during
  // another await. Updates/unlisting do not revoke an old ticket; deletion does.
  let changed = false;
  const oldChapterKey = v1.files.find(f => f.key.endsWith(`/chapters/${chapter}.json`)).key;
  const racingEnv = action => ({ ...bindings, PUBLISH_BUCKET: { async get(key) {
    const value = await bucket.get(key);
    if (!changed && key === oldChapterKey) { changed = true; await action(); }
    return value;
  } } });
  const fileRequest = () => new Request(`https://reader.test${chapterFile}`, { headers: { Authorization: `Bearer ${oldTicket}` } });
  response = await reader.fetch(fileRequest(), racingEnv(async () => { enqueue('listing', unlisted()); await drain(); }));
  check('real unlist during read still returns fixed bytes', changed && response.status === 200 && (await response.json()).fixture === `0:${chapter}`);
  changed = false;
  response = await reader.fetch(fileRequest(), racingEnv(async () => { enqueue('delete-fence', unlisted(true)); await drain(); }));
  check('real delete-fence root suppresses late bytes', changed && response.status === 410 && (await response.json()).error === 'GAME_DELETED');
  check('worker denies old and current tickets after explicit tombstone', (await call(chapterFile, oldTicket)).status === 410 && (await call(chapterFile, newTicket)).status === 410);
  check('unknown game not falsely deleted', (await call(`/play-api/v1/status?game=${OTHER_GAME}`)).status === 200);
  check('no resource deletion implied by deletion fence', await bucket.get(oldChapterKey) !== null);
  check('all seven generations confirmed with minimal receipts', rootWrites === 7 && receiptWrites === 7 && publisher.ledger.status().confirmedGeneration === 7);
  // Owned bucket corruption negatives only, AFTER the final publisher action.
  // Restoring bytes here is test setup, never a permitted production recovery.
  const final = await r2.get(rootKey), valid = JSON.parse(Buffer.from(final.bytes).toString('utf8'));
  const negatives = [null, [], { ...valid, version: 3 }, { ...valid, version: 1 }, { ...valid, version: '2' }, { ...valid, extra: 'private' }, { ...valid, authorityId: 'bad' }, { ...valid, operationId: 'bad' }, { ...valid, operationDigest: 'bad' }, { ...valid, payloadDigest: 'bad' }, { ...valid, previousOperationDigest: null }, { ...valid, generation: 0 }, { ...valid, generation: 1.5 }, { ...valid, generation: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, digest: 'bad' }, { ...valid, generation: 1 }, { ...valid, previousDigest: null }];
  for (const field of Object.keys(valid)) { const missing = { ...valid }; delete missing[field]; negatives.push(missing); }
  for (const invalid of negatives) {
    await bucket.put(rootKey, JSON.stringify(invalid));
    check('invalid frozen envelope cannot return registry', (await call('/play-api/v1/registry')).status === 503);
    check('invalid envelope is outage not deletion even with valid bearer', (await call(chapterFile, oldTicket)).status === 503);
  }
  await bucket.put(rootKey, final.bytes);
  check('valid explicit tombstone still distinguishable from corruption', (await call(chapterFile, oldTicket)).status === 410);
  check('no outbound network', outbound === 0);
  process.stdout.write(`reader distribution: ${checks} checks green; seven actual v2 roots/receipts, durable Node ledger reopen, actual workerd reader/R2, scoped old tickets; not common authority, playable game or production proof\n`);
} finally {
  try { await mf?.dispose(); } finally { storage?.close(); rmSync(own, { recursive: true, force: true }); }
}
