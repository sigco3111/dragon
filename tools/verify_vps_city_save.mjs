// N3-2: city op end-to-end. (a) FixedCopyProfile accepts a city edit only
// with its op in history, else COPY_PROTECTED_DELTA. (b) Full draft save
// round-trip with a city op on VPS ports. Usage:
// node tools/verify_vps_city_save.mjs
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
import { FixedCopyProfile, FIXED_COPY_PROFILE } from '../server/copyprofile.js';
import { editChapterCity } from '../web/src/content/authoring/gamesource.js';
import { encodeSourceChunks, canonicalSourceTokens } from '../web/src/content/authoring/sourcejson.js';
import { HttpError, fail } from '../server/security.js';
import { createPinnedCopyLoader } from './editor_trusted_copy.mjs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const fails = async (name, fn, code) => {
  try { await fn(); } catch (e) {
    check(name, e instanceof HttpError && e.code === code, e?.code);
    return;
  }
  check(name, false);
};

// (a) Profile level, no backend.
const loader = createPinnedCopyLoader();
const { game: baseGame } = await loader({ gameId: 'city-prof', ownerId: 'o' });
const profile = new FixedCopyProfile({ loadCopy: async () => ({ game: baseGame, provenance: { registryId: 'x' } }) });
const captured = await profile.capture({ gameId: 'city-prof', ownerId: 'o' });
const ch0 = baseGame.chapterOrder[0];
const rec0 = baseGame.chapters[ch0].state.cities[0];
const op = { op: 'city', chapterId: ch0, cityIdx: rec0.idx, values: { troops: rec0.troops - 1 } };
const candidate = editChapterCity(baseGame, ch0, rec0.idx, { troops: rec0.troops - 1 });
const proof = profile.verify(captured.capability, candidate, [op]);
check('profile accepts city op', proof.sourceDigest !== captured.baselineDigest);
await fails('profile rejects unlisted edit', async () => profile.verify(captured.capability, candidate, []), 'COPY_PROTECTED_DELTA');
await fails('profile rejects bad keys', async () => profile.verify(captured.capability, candidate, [{ op: 'city', chapterId: ch0, cityIdx: rec0.idx, values: { owner: 1 } }]), 'COPY_PROTECTED_DELTA');

// (b) Save round-trip on VPS ports.
const OWNER = '99999999-9999-4999-8999-999999999999';
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', OWNER, 'author_city', 'author', '{}', 0, 0, 1, 1);
});
const principal = h => { if (h !== 'h1') { fail(401, 'SESSION_INVALID'); } return { id: OWNER, role: 'author', epoch: 1, must_change: 0 }; };
const bucket = new FileBucket({ root: join(mkdtempSync(join(tmpdir(), 'vps-city-')), 'data') });
const journal = new PrivateWriteJournal({ storage, bucket });
const authority = () => ({ ownerId: OWNER, epoch: 1 });
const blobs = new ImmutableBlobStore({ bucket: journal, authority, storage });
const verifier = new GameSnapshotVerifier({ blobs });
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: input => verifier.verify(input.tokenHash, input),
  recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
const allocation = games.allocateGameId('h1');
const GAME = allocation.gameId;
const { game } = await loader({ gameId: GAME, ownerId: OWNER });
const stageGame = async bytes => {
  const put = await blobs.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array(bytes) });
  return { sha256: put.sha256, byteLength: put.byteLength };
};
const depDigestOf = (chunks, dependencies) => { const h = createHash('sha256'); for (const t of canonicalSourceTokens({ chunks, dependencies })) h.update(t, 'utf8'); return h.digest('hex'); };
const hAll = createHash('sha256'), chunks = [];
for (const part of encodeSourceChunks(game)) { hAll.update(part); chunks.push(await stageGame(part)); }
const sourceDigest = hAll.digest('hex');
const gIndex = { schema: 'dragon-game-source-index-1', gameId: GAME, sourceDigest, sourceByteLength: chunks.reduce((n, c) => n + c.byteLength, 0), chunks, dependencies: [] };
const gRoot = await stageGame(Buffer.concat(encodeSourceChunks(gIndex)));
const REG = 'test-reg-city-1', DEF = 'd'.repeat(64), CAT = 'c'.repeat(64);
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_objects (game_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, state TEXT NOT NULL, PRIMARY KEY(game_id,sha256))');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_origins (game_id TEXT PRIMARY KEY, registry_id TEXT NOT NULL, definition_digest TEXT NOT NULL, catalog_root TEXT NOT NULL, profile_revision TEXT NOT NULL, baseline_root TEXT NOT NULL, baseline_length INTEGER NOT NULL, baseline_digest TEXT NOT NULL, source_digest TEXT NOT NULL, dependency_digest TEXT NOT NULL)');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS installed_sources (registry_id TEXT PRIMARY KEY, definition_digest TEXT NOT NULL, root_digest TEXT NOT NULL, root_byte_length INTEGER NOT NULL, row_revision TEXT NOT NULL, registered_by TEXT NOT NULL, registered_at TEXT NOT NULL)');
  storage.sql.exec('INSERT INTO installed_sources VALUES(?,?,?,?,?,?,?)', REG, DEF, CAT, 1, '1', OWNER, new Date().toISOString());
  storage.sql.exec('INSERT INTO copy_objects VALUES(?,?,?,?)', GAME, gRoot.sha256, gRoot.byteLength, 'committed');
  storage.sql.exec('INSERT INTO copy_origins VALUES(?,?,?,?,?,?,?,?,?,?)', GAME, REG, DEF, CAT, FIXED_COPY_PROFILE, gRoot.sha256, gRoot.byteLength, sourceDigest, sourceDigest, depDigestOf(chunks, []));
});
const definition = () => ({ registryId: REG, profileRevision: FIXED_COPY_PROFILE, definitionDigest: DEF });
const drafts = new PrivateDrafts({ storage, principal, games, blobs, definition, operationGuard: () => {} });
const snap1 = await games.prepareSnapshot('h1', { gameId: GAME, draftRevision: '1', metadata: { ...game.metadata }, source: { sha256: gRoot.sha256, byteLength: gRoot.byteLength }, allocation });
games.transaction('h1', { key: 'city-create-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));

const gch = game.chapterOrder[0];
const grec = game.chapters[gch].state.cities[0];
const cityOp = { op: 'city', chapterId: gch, cityIdx: grec.idx, values: { troops: grec.troops - 2, prod: grec.prod - 50 } };
const saved = await drafts.save('h1', GAME, '1', 'city-save-0000000001', 'e'.repeat(64),
  { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [cityOp] });
check('city save rev2', saved.draftRevision === '2');
const readGame = (await drafts.captureForCompile('h1', GAME, '2')).game;
const gotCity = readGame.chapters[gch].state.cities.find(c => c.idx === grec.idx);
check('city values visible', gotCity.troops === grec.troops - 2 && gotCity.prod === grec.prod - 50);
const readCap = (await drafts.read('h1', GAME, '2')).chapters.find(c => c.chapterId === gch).cities.find(c => c.idx === grec.idx);
check('read projection caps', readCap.troopsCap === grec.troops_cap && readCap.maxProd === grec.max_prod);
await fails('city over cap 422', async () => drafts.save('h1', GAME, '2', 'city-save-0000000002', 'e'.repeat(64),
  { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [{ op: 'city', chapterId: gch, cityIdx: grec.idx, values: { troops: grec.troops_cap + 1 } }] }), 'DRAFT_CHAPTER_EDIT');
await fails('city bad shape 422', async () => drafts.save('h1', GAME, '2', 'city-save-0000000003', 'e'.repeat(64),
  { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [{ op: 'city', chapterId: gch, cityIdx: grec.idx, values: { owner: 1 } }] }), 'DRAFT_CHAPTER_EDITS');

console.log(`passed ${passed} checks`);
