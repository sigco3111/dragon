// V1 slice 5: end-to-end PrivateDrafts.save/read/captureForCompile with
// REAL classes on VPS ports: pinned builtin baseline (tools/
// editor_trusted_copy.mjs) -> file blobs -> real GameSnapshotVerifier ->
// seeded copy origin -> save x2 -> read/compile/query. Usage:
// node tools/verify_vps_draft_save.mjs
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { ImmutableBlobStore } from '../server/blobs.js';
import { PrivateWriteJournal } from '../server/privatewrites.js';
import { GameMetadataStore } from '../server/metadata.js';
import { GameSnapshotVerifier } from '../server/snapshots.js';
import { PrivateDrafts } from '../server/drafts.js';
import { FIXED_COPY_PROFILE } from '../server/copyprofile.js';
import { encodeSourceChunks, canonicalSourceTokens } from '../web/src/content/authoring/sourcejson.js';
import { HttpError, fail } from '../server/security.js';
import { createPinnedCopyLoader } from './editor_trusted_copy.mjs';

let passed = 0;
const check = (name, cond) => {
  if (!cond) { console.error(`FAIL ${name}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const fails = async (name, fn, code) => {
  try { await fn(); } catch (e) {
    check(name, e instanceof HttpError && e.code === code, e?.code ?? e?.message);
    return;
  }
  check(name, false);
};
const OWNER = '33333333-3333-4333-8333-333333333333';
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL, display_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '')");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', OWNER, 'author_s5', 'author', '{}', 0, 0, 1, 1, '', '', '', '');
});
const principal = h => { if (h !== 'h1') { fail(401, 'SESSION_INVALID'); } return { id: OWNER, role: 'author', epoch: 1, must_change: 0 }; };
const bucket = new FileBucket({ root: join(mkdtempSync(join(tmpdir(), 'vps-draft-')), 'data') });
const journal = new PrivateWriteJournal({ storage, bucket });
const authority = (_t, _c) => ({ ownerId: OWNER, epoch: 1 });
const blobs = new ImmutableBlobStore({ bucket: journal, authority, storage });
const verifier = new GameSnapshotVerifier({ blobs });
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: input => verifier.verify(input.tokenHash, input),
  recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
const allocation = games.allocateGameId('h1');
const GAME = allocation.gameId;

// 1. Pinned baseline game + stage all parts + index into blobs.
const loader = createPinnedCopyLoader();
const { game, provenance } = await loader({ gameId: GAME, ownerId: OWNER });
check('pinned baseline', game.chapterOrder.length === 20 && game.gameId === GAME);
const stagePart = async bytes => {
  const put = await blobs.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array(bytes) });
  return { sha256: put.sha256, byteLength: put.byteLength };
};
const depDigestOf = (chunks, dependencies) => { const h = createHash('sha256'); for (const t of canonicalSourceTokens({ chunks, dependencies })) h.update(t, 'utf8'); return h.digest('hex'); };
const hAll = createHash('sha256'), chunks = [];
for (const part of encodeSourceChunks(game)) { hAll.update(part); chunks.push(await stagePart(part)); }
const sourceDigest = hAll.digest('hex');
const sourceLength = chunks.reduce((n, c) => n + c.byteLength, 0);
const index = { schema: 'dragon-game-source-index-1', gameId: GAME, sourceDigest, sourceByteLength: sourceLength, chunks, dependencies: [] };
const root = await stagePart(Buffer.concat(encodeSourceChunks(index)));
const dependencyDigest = depDigestOf(chunks, []);

// 2. Seed admin-copy completion rows (what AdminFullCopy.execute persists).
const REG = provenance.registryId, DEF = 'd'.repeat(64), CAT = 'c'.repeat(64);
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_objects (game_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, state TEXT NOT NULL, PRIMARY KEY(game_id,sha256))');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_origins (game_id TEXT PRIMARY KEY, registry_id TEXT NOT NULL, definition_digest TEXT NOT NULL, catalog_root TEXT NOT NULL, profile_revision TEXT NOT NULL, baseline_root TEXT NOT NULL, baseline_length INTEGER NOT NULL, baseline_digest TEXT NOT NULL, source_digest TEXT NOT NULL, dependency_digest TEXT NOT NULL)');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS installed_sources (registry_id TEXT PRIMARY KEY, definition_digest TEXT NOT NULL, root_digest TEXT NOT NULL, root_byte_length INTEGER NOT NULL, row_revision TEXT NOT NULL, registered_by TEXT NOT NULL, registered_at TEXT NOT NULL)');
  storage.sql.exec("INSERT INTO copy_objects VALUES(?,?,?,?)", GAME, root.sha256, root.byteLength, 'committed');
  storage.sql.exec('INSERT INTO copy_origins VALUES(?,?,?,?,?,?,?,?,?,?)', GAME, REG, DEF, CAT, FIXED_COPY_PROFILE, root.sha256, root.byteLength, sourceDigest, sourceDigest, dependencyDigest);
  storage.sql.exec('INSERT INTO installed_sources VALUES(?,?,?,?,?,?,?)', REG, DEF, CAT, 1, '1', OWNER, new Date().toISOString());
});
const definition = () => ({ registryId: REG, profileRevision: FIXED_COPY_PROFILE, definitionDigest: DEF });
const drafts = new PrivateDrafts({ storage, principal, games, blobs, definition, operationGuard: () => {} });
check('wiring', !!drafts);

// 3. Create rev1 through the real snapshot verifier.
const snap1 = await games.prepareSnapshot('h1', { gameId: GAME, draftRevision: '1', metadata: { ...game.metadata }, source: { sha256: root.sha256, byteLength: root.byteLength }, allocation });
const created = games.transaction('h1', { key: 's5-create-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));
check('create rev1 real-verify', created.draftRevision === '1');

// 4. No-op save returns the CURRENT revision without rewriting (production
// semantics: identical content is not a new revision).
const input1 = { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [] };
const saved1 = await drafts.save('h1', GAME, '1', 's5-save-0000000001', 'e'.repeat(64), input1);
check('save no-op stays rev1', saved1.draftRevision === '1');

// 5. Resource edit save -> rev2 with new digests.
const read1 = await drafts.read('h1', GAME, '1');
const ch0 = read1.chapters[0], f0 = ch0.factions[0];
const input2 = { metadata: { ...game.metadata }, resourceEdits: [{ chapterId: ch0.chapterId, slot: 0, values: { money: f0.money + 1, reserve_cav: f0.reserve_cav + 1, reserve_arc: f0.reserve_arc + 1, reserve_inf: f0.reserve_inf + 1 } }], chapterEdits: [] };
const saved2 = await drafts.save('h1', GAME, '1', 's5-save-0000000002', 'e'.repeat(64), input2);
check('save edit rev2', saved2.draftRevision === '2');
const read2 = await drafts.read('h1', GAME, '2');
check('edit visible', read2.chapters[0].factions[0].money === f0.money + 1);
check('digests move', read2.sourceDigest !== read1.sourceDigest);

// 6. Gates: stale, bad input, idempotent replay, receipt, cross-author.
await fails('stale expected 412', async () => drafts.save('h1', GAME, '1', 's5-save-0000000003', 'e'.repeat(64), input1), 'DRAFT_CHANGED');
await fails('bad input 422', async () => drafts.save('h1', GAME, '2', 's5-save-0000000004', 'e'.repeat(64), { metadata: { name: 'x' } }), 'REQUEST_FIELDS');
const replay = await drafts.save('h1', GAME, '1', 's5-save-0000000001', 'e'.repeat(64), input1);
check('save replay rev1', replay.draftRevision === '1');
const q = drafts.query('h1', GAME, 's5-save-0000000002');
check('query committed receipt', q.state === 'committed' && q.result.draftRevision === '2');
const compiled = await drafts.captureForCompile('h1', GAME, '2');
check('capture compile', compiled.game.chapterOrder.length === 20 && compiled.reference.draftRevision === '2' && compiled.ownerId === OWNER);
await fails('cross-author 404', async () => drafts.read('hx', GAME, '2'), 'SESSION_INVALID');

console.log(`passed ${passed} checks`);
