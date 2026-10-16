// VPS publisher dry-run (no network): payload layout + CAS branches + fail-closed.
// Live R2 execution is an operator step under a test/ prefix (journal).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { buildPayload, uploadRelease, drainOutbox, nodeStorage, parseArgs } from '../vps/publish_to_r2.mjs';
import { DistributionOutbox } from '../server/distribution.js';

const sha = b => createHash('sha256').update(b).digest('hex');
function parseFixture(value) {
  try { return JSON.parse(value); }
  catch (cause) { throw new Error('invalid owned publisher fixture JSON', { cause }); }
}
let n = 0;
const check = (label, cond) => { assert.ok(cond, label); n++; };

function fixtureDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, draft_name TEXT NOT NULL, draft_revision TEXT NOT NULL, listed INTEGER NOT NULL);
    CREATE TABLE published_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, pin_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE published_packs (game_id TEXT PRIMARY KEY, revision TEXT NOT NULL, source_digest TEXT NOT NULL, manifest_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE published_pack_assets (game_id TEXT NOT NULL, asset_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(game_id,asset_id));
    CREATE TABLE published_pack_chapters (game_id TEXT NOT NULL, chapter_id TEXT NOT NULL, state_json TEXT NOT NULL, PRIMARY KEY(game_id,chapter_id));
    CREATE TABLE content_announcements (announcement_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, release_id TEXT NOT NULL, ordinal TEXT NOT NULL, name TEXT NOT NULL, creator_account TEXT NOT NULL, published_at TEXT NOT NULL, first_online_at TEXT NOT NULL, UNIQUE(game_id,release_id));
    CREATE TABLE content_releases (game_id TEXT NOT NULL, release_id TEXT NOT NULL, ordinal TEXT NOT NULL, draft_revision TEXT NOT NULL, source_digest TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(game_id,ordinal))`);
  const gid = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const pin = { gameId: gid, name: '乾', revision: '1', sourceDigest: sha('src'), chapters: ['c1'], publishedAt: '2026-10-16T00:00:00.000Z', ordinal: '1.0' };
  db.prepare(`INSERT INTO content_games VALUES(?,?,?,?,?)`).run(gid, 'u1', '乾', '1', 1);
  db.prepare(`INSERT INTO published_games VALUES(?,?,?,?)`).run(gid, 'u1', JSON.stringify(pin), '2026-10-16T00:00:00.000Z');
  db.prepare(`INSERT INTO published_packs VALUES(?,?,?,?,?)`).run(gid, '1', sha('src'), JSON.stringify({ schemaVersion: 1 }), '2026-10-16T00:00:00.000Z');
  const asset = Buffer.from('terrain-bytes');
  db.prepare(`INSERT INTO published_pack_assets VALUES(?,?,?,?,?)`).run(gid, 'terrain', sha(asset), asset.length, asset);
  db.prepare(`INSERT INTO published_pack_chapters VALUES(?,?,?)`).run(gid, 'c1', JSON.stringify({ cities: [] }));
  db.prepare(`INSERT INTO content_announcements VALUES(?,?,?,?,?,?,?,?)`).run(1, gid, 'r1', '1.0', '乾', 'tianyi', '2026-10-16T00:00:00.000Z', '2026-10-16T00:00:00.000Z');
  db.prepare(`INSERT INTO content_releases VALUES(?,?,?,?,?,?)`).run(gid, 'r1', '1.0', '1', sha('src'), '2026-10-16T00:00:00.000Z');
  return { db, gid };
}

function fakeR2() {
  const store = new Map();
  return {
    store,
    async putImmutable(key, bytes) {
      if (store.has(key)) { return null; }
      store.set(key, { bytes: Buffer.from(bytes), etag: `"${sha(bytes).slice(0, 32)}"` });
      return { headers: {} };
    },
    async putControl(key, bytes, ifMatch) {
      const prior = store.get(key);
      if (ifMatch === null && prior) { throw new Error('control exists'); }
      if (ifMatch !== null && prior?.etag !== ifMatch) { return null; }
      store.set(key, { bytes: Buffer.from(bytes), etag: `"${sha(bytes).slice(0, 32)}"` });
      return { headers: {} };
    },
    async get(key) {
      const row = store.get(key);
      return row ? { bytes: row.bytes, headers: { etag: row.etag } } : null;
    },
  };
}

const { db, gid } = fixtureDb();
const payload = buildPayload(db, { prefix: 'test/x/', onlyGame: gid });
check('manifest key', payload.files.some(f => f.key === `test/x/artifacts/${gid}/1.0/manifest.json`));
check('chapter key', payload.files.some(f => f.key === `test/x/artifacts/${gid}/1.0/chapters/c1.json`));
check('asset keyed by sha', payload.files.some(f => f.key === `test/x/artifacts/${gid}/1.0/${sha(Buffer.from('terrain-bytes'))}`));
check('directory single version', payload.directory.length === 1 && payload.directory[0].ordinal === '1.0');
check('announcement projected', payload.announcements.length === 1 && payload.announcements[0].creatorAccount === 'tianyi');
check('release projected', payload.releases.length === 1);

const r2 = fakeR2();
const first = await uploadRelease(r2, 'test/x/', payload, null);
check('generation 1', first.generation === 1);
check('control root', r2.store.has('test/x/control/current.json'));
const second = await uploadRelease(r2, 'test/x/', payload, { bytes: Buffer.from(JSON.stringify({ generation: 1, digest: first.digest })), headers: { etag: r2.store.get('test/x/control/current.json').etag } });
check('generation 2 chains', second.generation === 2);
const stale = await uploadRelease(r2, 'test/x/', payload, { bytes: Buffer.from(JSON.stringify({ generation: 1, digest: first.digest })), headers: { etag: '"stale"' } }).catch(e => e);
check('CAS conflict surfaces', stale instanceof Error && stale.message === 'CONTROL_CAS_CONFLICT');
const retry = await uploadRelease(r2, 'test/x/', payload, { bytes: Buffer.from(JSON.stringify({ generation: 2, digest: second.digest })), headers: { etag: r2.store.get('test/x/control/current.json').etag } });
check('idempotent retry verifies', retry.generation === 3);
r2.store.set(`test/x/artifacts/${gid}/1.0/manifest.json`, { bytes: Buffer.from('tampered'), etag: '"x"' });
const tampered = await uploadRelease(r2, 'test/x/', payload, { bytes: Buffer.from(JSON.stringify({ generation: 3, digest: retry.digest })), headers: { etag: r2.store.get('test/x/control/current.json').etag } }).catch(e => e);
check('immutable mismatch fail-closed', tampered instanceof Error && String(tampered.message).startsWith('immutable mismatch'));

const badDb = fixtureDb().db;
badDb.exec(`UPDATE published_games SET pin_json='{' WHERE game_id='${gid}'`);
assert.throws(() => buildPayload(badDb, {}), /pin corrupt/);
check('corrupt pin fail-closed', true);
const badAsset = fixtureDb().db;
badAsset.exec(`UPDATE published_pack_assets SET bytes=x'00' WHERE game_id='${gid}'`);
assert.throws(() => buildPayload(badAsset, {}), /asset corrupt/);
check('corrupt asset fail-closed', true);
const unlisted = fixtureDb().db;
unlisted.exec(`UPDATE content_games SET listed=0 WHERE game_id='${gid}'`);
assert.throws(() => buildPayload(unlisted, {}), /no listed published games/);
check('unlisted excluded', true);

assert.equal(parseArgs(['--db', 'owned.db', '--drain']).drain, true);
assert.equal(parseArgs(['--drain', '--db', 'owned.db']).drain, true);
assert.throws(() => parseArgs(['--drain', '--game', gid]), /cannot be combined/);
assert.throws(() => parseArgs(['--db']), /invalid publisher arguments/);
check('drain boolean and CLI argument validation', true);
assert.throws(() => buildPayload(db, { onlyGame: gid }), /isolated test prefix/);
check('partial directory cannot replace production root', true);

const multi = fixtureDb().db;
const other = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const oldPin = parseFixture(multi.prepare('SELECT pin_json FROM published_games').get().pin_json);
multi.prepare('INSERT INTO content_games VALUES(?,?,?,?,?)').run(other, 'u2', '坤', '1', 1);
multi.prepare('INSERT INTO published_games VALUES(?,?,?,?)').run(other, 'u2', JSON.stringify({ ...oldPin, gameId: other, name: '坤' }), oldPin.publishedAt);
multi.prepare('INSERT INTO published_packs SELECT ?,revision,source_digest,manifest_json,updated_at FROM published_packs WHERE game_id=?').run(other, gid);
multi.prepare('INSERT INTO published_pack_chapters SELECT ?,chapter_id,state_json FROM published_pack_chapters WHERE game_id=?').run(other, gid);
multi.prepare('INSERT INTO published_pack_assets SELECT ?,asset_id,sha256,byte_length,bytes FROM published_pack_assets WHERE game_id=?').run(other, gid);
multi.prepare('INSERT INTO content_releases VALUES(?,?,?,?,?,?)').run(other, 'r2', '1.0', '1', sha('src'), oldPin.publishedAt);
multi.prepare('INSERT INTO content_announcements VALUES(?,?,?,?,?,?,?,?)').run(2, other, 'r2', '1.0', '坤', 'u2', oldPin.publishedAt, oldPin.publishedAt);
const partial = buildPayload(multi, { prefix: 'test/partial/', onlyGame: gid });
assert.deepEqual(partial.releases.map(r => r.game_id), [gid]);
assert.deepEqual(partial.announcements.map(r => r.gameId), [gid]);
check('isolated projection excludes other game metadata', true);
multi.prepare('UPDATE content_games SET listed=0 WHERE game_id=?').run(other);
assert.deepEqual(buildPayload(multi).releases.map(r => r.game_id), [gid]);
check('unlisted release metadata not projected', true);
multi.prepare('UPDATE content_games SET listed=1 WHERE game_id=?').run(other);
const storage = nodeStorage(multi), outbox = new DistributionOutbox({ storage });
storage.transactionSync(() => outbox.enqueueInTxn({ gameId: gid, ordinal: '1.0', releaseId: 'r1' }));
storage.transactionSync(() => outbox.enqueueInTxn({ gameId: other, ordinal: '1.0', releaseId: 'r2' }));
const multiR2 = fakeR2(), drained = await drainOutbox(multi, multiR2, 'test/drain/');
assert.equal(drained.length, 2);
assert.equal(outbox.pending().length, 0);
const root = parseFixture(multiR2.store.get('test/drain/control/current.json').bytes);
const projected = parseFixture(multiR2.store.get(`test/drain/projections/${root.generation}/${root.digest}/projection.json`).bytes);
assert.deepEqual(projected.directory.map(g => g.gameId), [gid, other]);
check('real drain constructor, confirmations and complete two-game directory', true);
assert.deepEqual(await drainOutbox(multi, multiR2, 'test/drain/'), []);
check('confirmed drain is no-op', true);
storage.transactionSync(() => outbox.enqueueInTxn({ gameId: gid, ordinal: '0.9', releaseId: 'obsolete' }));
const beforeKeys = [...multiR2.store.keys()];
await assert.rejects(() => drainOutbox(multi, multiR2, 'test/drain/'), /DISTRIBUTION_RELEASE_CHANGED/);
assert.deepEqual([...multiR2.store.keys()], beforeKeys);
assert.equal(outbox.pending()[0].attempts, 1);
check('obsolete outbox never acknowledges newer release or writes remote', true);
const failure = fixtureDb().db, failureStore = nodeStorage(failure);
const failureOutbox = new DistributionOutbox({ storage: failureStore });
failureStore.transactionSync(() => failureOutbox.enqueueInTxn({ gameId: gid, ordinal: '1.0', releaseId: 'r1' }));
const conflictR2 = fakeR2();
conflictR2.putControl = async () => null;
await assert.rejects(() => drainOutbox(failure, conflictR2, 'test/conflict/'), /CONTROL_CAS_CONFLICT/);
assert.equal(failureOutbox.pending()[0].attempts, 1);
check('drain CAS failure retains pending row and counts attempt', true);
for (const database of [db, badDb, badAsset, unlisted, multi, failure]) database.close();
process.stdout.write(`publisher dry-run: ${n} checks green\n`);
