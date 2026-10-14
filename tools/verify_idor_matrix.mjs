// F-1 IDOR matrix: cross-author vs unknown-id must be indistinguishable
// (404/401 sameness, no existence leak) across games/drafts/portraits/
// blobs/jobs/trials. Real classes on VPS ports. Usage:
// node tools/verify_idor_matrix.mjs
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { ImmutableBlobStore } from '../server/blobs.js';
import { PrivateWriteJournal } from '../server/privatewrites.js';
import { GameMetadataStore } from '../server/metadata.js';
import { GameSnapshotVerifier } from '../server/snapshots.js';
import { PrivateDrafts } from '../server/drafts.js';
import { GamePortraits } from '../server/portraits.js';
import { CompileJobs } from '../server/jobs.js';
import { TrialSessions } from '../server/trials.js';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { FIXED_COPY_PROFILE } from '../server/copyprofile.js';
import { encodeSourceChunks, canonicalSourceTokens } from '../web/src/content/authoring/sourcejson.js';
import { fail } from '../server/security.js';
import { createPinnedCopyLoader } from './editor_trusted_copy.mjs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const sameCode = async (name, fnA, fnB) => {
  const code = async fn => { try { await fn(); return 'NO_THROW'; } catch (e) { return e?.code ?? 'NO_CODE'; } };
  const [a, b] = [await code(fnA), await code(fnB)];
  check(name, a === b && a !== 'NO_THROW' && a !== 'NO_CODE', `${a} vs ${b}`);
};

const UA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa01';
const UB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1';
const UNKNOWN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', UA, 'author_a', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', UB, 'author_b', 'author', '{}', 0, 0, 1, 1);
});
const actors = {
  ha: { id: UA, role: 'author', epoch: 1, must_change: 0 },
  hb: { id: UB, role: 'author', epoch: 1, must_change: 0 },
};
const principal = h => { if (!actors[h]) { fail(401, 'SESSION_INVALID'); } return actors[h]; };
const bucket = new FileBucket({ root: join(mkdtempSync(join(tmpdir(), 'vps-idor-')), 'data') });
const journal = new PrivateWriteJournal({ storage, bucket });
const authority = (t, _c) => {
  if (t !== 'ha' && t !== 'hb') { fail(401, 'SESSION_INVALID'); }
  return { ownerId: t === 'ha' ? UA : UB, epoch: 1 };
};
const blobs = new ImmutableBlobStore({ bucket: journal, authority, storage });
const verifier = new GameSnapshotVerifier({ blobs });
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: input => verifier.verify(input.tokenHash, input),
  recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });

// Stage A's game (S5 pattern, compact).
const allocation = games.allocateGameId('ha');
const GAME = allocation.gameId;
const loader = createPinnedCopyLoader();
const { game } = await loader({ gameId: GAME, ownerId: UA });
const stageGame = async bytes => {
  const put = await blobs.putImmutable('ha', { gameId: GAME, allocation: {}, bytes: new Uint8Array(bytes) });
  return { sha256: put.sha256, byteLength: put.byteLength };
};
const depDigestOf = (chunks, dependencies) => { const h = createHash('sha256'); for (const t of canonicalSourceTokens({ chunks, dependencies })) h.update(t, 'utf8'); return h.digest('hex'); };
const hAll = createHash('sha256'), chunks = [];
for (const part of encodeSourceChunks(game)) { hAll.update(part); chunks.push(await stageGame(part)); }
const sourceDigest = hAll.digest('hex');
const gIndex = { schema: 'dragon-game-source-index-1', gameId: GAME, sourceDigest, sourceByteLength: chunks.reduce((n, c) => n + c.byteLength, 0), chunks, dependencies: [] };
const gRoot = await stageGame(Buffer.concat(encodeSourceChunks(gIndex)));
const REG = 'test-reg-idor-1', DEF = 'd'.repeat(64), CAT = 'c'.repeat(64);
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_objects (game_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, state TEXT NOT NULL, PRIMARY KEY(game_id,sha256))');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_origins (game_id TEXT PRIMARY KEY, registry_id TEXT NOT NULL, definition_digest TEXT NOT NULL, catalog_root TEXT NOT NULL, profile_revision TEXT NOT NULL, baseline_root TEXT NOT NULL, baseline_length INTEGER NOT NULL, baseline_digest TEXT NOT NULL, source_digest TEXT NOT NULL, dependency_digest TEXT NOT NULL)');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS installed_sources (registry_id TEXT PRIMARY KEY, definition_digest TEXT NOT NULL, root_digest TEXT NOT NULL, root_byte_length INTEGER NOT NULL, row_revision TEXT NOT NULL, registered_by TEXT NOT NULL, registered_at TEXT NOT NULL)');
  storage.sql.exec('INSERT INTO copy_objects VALUES(?,?,?,?)', GAME, gRoot.sha256, gRoot.byteLength, 'committed');
  storage.sql.exec('INSERT INTO copy_origins VALUES(?,?,?,?,?,?,?,?,?,?)', GAME, REG, DEF, CAT, FIXED_COPY_PROFILE, gRoot.sha256, gRoot.byteLength, sourceDigest, sourceDigest, depDigestOf(chunks, []));
  storage.sql.exec('INSERT INTO installed_sources VALUES(?,?,?,?,?,?,?)', REG, DEF, CAT, 1, '1', UA, new Date().toISOString());
});
const drafts = new PrivateDrafts({ storage, principal, games, blobs, definition: () => ({ registryId: REG, profileRevision: FIXED_COPY_PROFILE, definitionDigest: DEF }), operationGuard: () => {} });
const snap1 = await games.prepareSnapshot('ha', { gameId: GAME, draftRevision: '1', metadata: { ...game.metadata }, source: { sha256: gRoot.sha256, byteLength: gRoot.byteLength }, allocation });
games.transaction('ha', { key: 'idor-create-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));
const portraits = new GamePortraits({ storage, principal, reservedIds: [] });
const jobs = new CompileJobs({ storage, principal, metadata: games,
  verifyCheckpoint: async ({ digest }) => ({ digest }), compilerRevision: 'c1', profileRevision: 'p1' });
const policy = installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt'));
const trials = new TrialSessions({ storage, principal, games, drafts,
  catalog: { loadFull: async () => { fail(503, 'IDOR_STUB'); }, definition: () => ({}) }, policy });

const input1 = { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [] };
await sameCode('snapshot cross==unknown', () => games.snapshotReference('hb', GAME, '1'), () => games.snapshotReference('hb', UNKNOWN, '1'));
await sameCode('draft read cross==unknown', () => drafts.read('hb', GAME, '1'), () => drafts.read('hb', UNKNOWN, '1'));
await sameCode('draft save cross==unknown', () => drafts.save('hb', GAME, '1', 'idor-k1-0000000001', 'e'.repeat(64), input1), () => drafts.save('hb', UNKNOWN, '1', 'idor-k1-0000000002', 'e'.repeat(64), input1));
await sameCode('portrait upload cross==unknown', () => portraits.upload('hb', GAME, 'x', new Uint8Array([1])), () => portraits.upload('hb', UNKNOWN, 'x', new Uint8Array([1])));
await sameCode('portrait list cross==unknown', () => portraits.list('hb', GAME), () => portraits.list('hb', UNKNOWN));
await sameCode('blob authority cross==unknown', () => games.blobAuthority('hb', { gameId: GAME, allocation: {} }), () => games.blobAuthority('hb', { gameId: UNKNOWN, allocation: {} }));
await sameCode('job enqueue cross==unknown', () => jobs.enqueue('hb', { key: 'idor-k2-0000000001', gameId: GAME, draftRevision: '1', scope: 'all' }), () => jobs.enqueue('hb', { key: 'idor-k2-0000000002', gameId: UNKNOWN, draftRevision: '1', scope: 'all' }));
await sameCode('trial auth known==unknown', () => trials.authorize('ha', randomUUID()), () => trials.authorize('ha', UNKNOWN));
check('trial unknown 401', (await (async () => { try { await trials.authorize('ha', UNKNOWN); return ''; } catch (e) { return e?.code; } })()) === 'TRIAL_INVALID');
await sameCode('unauthenticated always 401', () => games.snapshotReference('hx', GAME, '1'), () => games.snapshotReference('hx', UNKNOWN, '1'));

console.log(`passed ${passed} checks`);
