// Q45/Q9/Q20 publish-permission matrix, backend-assembly-free parts:
// real PublishedGames.unpublish owner/admin matrix, owner-scoped directory
// (the exact predicate #publishPin relies on), must-change gates.
// Route-level publish with full pipeline stays B-3b2 (workerd assembly).
// Usage: node tools/verify_publish_matrix.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { GameMetadataStore } from '../server/metadata.js';
import { PublishedGames } from '../server/published.js';
import { PrivateDrafts } from '../server/drafts.js';
import { HttpError, fail } from '../server/security.js';

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

const GA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const GB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u1', 'author_a', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u2', 'author_b', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u9', 'tianyi', 'admin', '{}', 0, 0, 1, 1);
});
const actors = {
  ha: { id: 'u1', role: 'author', epoch: 1, must_change: 0 },
  hb: { id: 'u2', role: 'author', epoch: 1, must_change: 0 },
  hadmin: { id: 'u9', role: 'admin', epoch: 1, must_change: 0 },
  hmust: { id: 'u1', role: 'author', epoch: 1, must_change: 1 },
};
const principal = h => { if (!actors[h]) { fail(401, 'SESSION_INVALID'); } return actors[h]; };
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: undefined, recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
const registry = new PublishedGames({ storage, principal });

// Owner-scoped directory: the exact predicate #publishPin gates on.
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), draft_name TEXT NOT NULL, draft_introduction TEXT NOT NULL, formal_name TEXT, formal_introduction TEXT, draft_revision TEXT NOT NULL, row_revision TEXT NOT NULL, current_release_id TEXT, next_ordinal TEXT NOT NULL, listed INTEGER NOT NULL, restricted INTEGER NOT NULL, created_at TEXT NOT NULL, modified_at TEXT NOT NULL)');
  storage.sql.exec("INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", GA, 'u1', 'A', '', null, null, '1', '1', null, '0', 0, 0, 't', 't');
  storage.sql.exec("INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", GB, 'u2', 'B', '', null, null, '1', '1', null, '0', 0, 0, 't', 't');
});
const findOwn = (h, id) => games.listOwn(h).find(g => g.gameId === id);
check('A finds own', !!findOwn('ha', GA) && !findOwn('ha', GB));
check('B finds own', !!findOwn('hb', GB) && !findOwn('hb', GA));
check('author cannot publish route for other (predicate)', findOwn('hb', GA) === undefined);
check('admin cannot publish route for other (predicate)', games.listOwn('hadmin').length === 0);

// Unpublish matrix on real pins.
const pinA = registry.publish('ha', { gameId: GA, name: 'Agame', revision: '1', sourceDigest: 'b'.repeat(64), chapters: ['c1'], ordinal: '1.0' });
check('owner pin', pinA.gameId === GA);
await fails('other-author unpublish 403', async () => registry.unpublish('hb', GA), 'PUBLISH_OWNER');
const unAdmin = registry.unpublish('hadmin', GA);
check('admin unpublish ok', unAdmin.unpublished === true);
check('unpublish missing idempotent', registry.unpublish('ha', GA).unpublished === true);
check('builtin unpublish noop', registry.unpublish('ha', 'wolong-builtin').unpublished === true);
registry.publish('ha', { gameId: GA, name: 'Agame', revision: '1', sourceDigest: 'b'.repeat(64), chapters: ['c1'], ordinal: '1.0' });
const unOwn = registry.unpublish('ha', GA);
check('owner unpublish ok', unOwn.unpublished === true);
registry.publish('ha', { gameId: GA, name: 'Agame', revision: '1', sourceDigest: 'b'.repeat(64), chapters: ['c1'], ordinal: '1.0' });
await fails('must-change unpublish 403', async () => registry.unpublish('hmust', GA), 'PASSWORD_CHANGE_REQUIRED');

// Must-change gate at drafts entry (publish pipeline entry point).
const drafts = new PrivateDrafts({ storage, principal,
  games: { listOwn: () => [], assertNotDeleting: () => {}, prepareSnapshot: async () => ({}) },
  blobs: { read: async () => ({}) }, definition: () => ({}), operationGuard: () => {} });
await fails('must-change save 403', async () => drafts.save('hmust', GA, '1', 'mk-0000000000000001', 'e'.repeat(64), {}), 'PASSWORD_CHANGE_REQUIRED');

console.log(`passed ${passed} checks`);
