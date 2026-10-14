// V1 slice 2: run the REAL server/metadata.js GameMetadataStore on the
// vps/sqlite-port.mjs adapter with stub principal/snapshot ports.
// Usage: node tools/verify_vps_metadata_port.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { GameMetadataStore } from '../server/metadata.js';
import { HttpError } from '../server/security.js';

let passed = 0;
const check = (name, cond) => {
  if (!cond) { console.error(`FAIL ${name}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const fails = async (name, fn, code) => {
  try { await fn(); } catch (e) {
    check(name, e instanceof HttpError && e.code === code);
    return;
  }
  check(name, false);
};

const storage = openStorage(':memory:');
// users DDL mirrors server/worker.js:108 (12-col form; ALTER path unneeded fresh).
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','author')), password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL, display_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '')");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', 'u1', 'tester', 'author', '{}', 0, 0, 1, 1, '', '', '', '');
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', 'u2', 'tester2', 'author', '{}', 0, 0, 1, 1, '', '', '', '');
});
const actors = { h1: { id: 'u1', role: 'author', epoch: 1, must_change: 0 }, h2: { id: 'u2', role: 'author', epoch: 1, must_change: 0 } };
const DIG = { root: 'a'.repeat(64), source: 'b'.repeat(64), dep: 'c'.repeat(64) };
const games = new GameMetadataStore({
  storage,
  principal: h => { if (!actors[h]) throw new HttpError(401, 'SESSION_INVALID'); return actors[h]; },
  verifySnapshot: async ({ gameId }) => ({ rootDigest: DIG.root, sourceDigest: DIG.source, dependencyDigest: DIG.dep, rootKey: `private/${gameId}/${DIG.root}` }),
  recoverAllocation: () => { throw new HttpError(503, 'COPY_NOT_CONFIGURED'); },
});
check('construct', !!games);

const allocation = games.allocateGameId('h1');
check('allocate', typeof allocation.gameId === 'string' && allocation.ownerId === 'u1');
const snap1 = await games.prepareSnapshot('h1', { gameId: allocation.gameId, draftRevision: '1', metadata: { name: 'V1測試', introduction: 'port試驗' }, source: {}, allocation });
const created = games.transaction('h1', { key: 'create-op-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));
check('create rev1', created.draftRevision === '1' && created.gameId === allocation.gameId);
check('listOwn one', games.listOwn('h1').length === 1);

const snap2 = await games.prepareSnapshot('h1', { gameId: allocation.gameId, draftRevision: '2', metadata: { name: 'V1測試二', introduction: 'port2' }, source: {}, allocation });
const saved = games.transaction('h1', { key: 'save-op-0000000001', method: 'save', target: allocation.gameId, digest: 'e'.repeat(64) }, api => api.compareAndSwap(allocation.gameId, '1', snap2));
check('save CAS rev2', saved.draftRevision === '2' && saved.metadata.name === 'V1測試二');

await fails('stale save 409', async () => games.transaction('h1', { key: 'save-op-0000000002', method: 'save', target: allocation.gameId, digest: 'e'.repeat(64) }, api => api.compareAndSwap(allocation.gameId, '1', snap2)), 'DRAFT_CHANGED');

const replay = games.transaction('h1', { key: 'create-op-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));
check('idempotent replay same game', replay.gameId === allocation.gameId && games.listOwn('h1').length === 1);

const listed = games.setListed('h1', allocation.gameId, true, saved.rowRevision);
check('setListed true', listed.listed === true);
await fails('setListed stale 409', async () => games.setListed('h1', allocation.gameId, false, saved.rowRevision), 'GAME_CHANGED');
await fails('builtin protected', async () => games.setListed('h1', 'wolong-builtin', true, '1'), 'BUILTIN_PROTECTED');

const ref = games.snapshotReference('h1', allocation.gameId, '1');
check('snapshotReference rev1', ref.rootKey === `private/${allocation.gameId}/${DIG.root}`);
await fails('snapshotReference unknown 404', async () => games.snapshotReference('h1', allocation.gameId, '9'), 'SNAPSHOT_NOT_FOUND');
await fails('async callback rejected', async () => games.transaction('h1', { key: 'save-op-0000000003', method: 'save', target: allocation.gameId, digest: 'e'.repeat(64) }, async () => null), 'SYNC_TRANSACTION_REQUIRED');

// Q26 author-scoped name occupancy.
const allocation2 = games.allocateGameId('h1');
const snapDup = await games.prepareSnapshot('h1', { gameId: allocation2.gameId, draftRevision: '1', metadata: { name: 'V1測試二', introduction: 'other' }, source: {}, allocation: allocation2 });
await fails('same-author same name 409', async () => games.transaction('h1', { key: 'create-op-00000002', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation2, snapDup)), 'GAME_NAME_OCCUPIED');
const allocation3 = games.allocateGameId('h2');
const snapCross = await games.prepareSnapshot('h2', { gameId: allocation3.gameId, draftRevision: '1', metadata: { name: 'V1測試', introduction: 'other' }, source: {}, allocation: allocation3 });
const created3 = games.transaction('h2', { key: 'create-op-00000003', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation3, snapCross));
check('cross-author same name ok', created3.gameId === allocation3.gameId && games.listOwn('h2').length === 1);

console.log(`passed ${passed} checks`);
