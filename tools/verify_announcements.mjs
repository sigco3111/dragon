// D组公告后端（Q31–Q36，§8.3）：node-memory lane over the real classes.
// Drives GameMetadataStore/ReleaseLedger/PublishedGames/AnnouncementStore/
// GameManagement on :memory: SQLite in worker-route order (publish txn,
// listing txn, management unlist). Route auth/shape stays workerd-side.
// Usage: node tools/verify_announcements.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { GameMetadataStore } from '../server/metadata.js';
import { PublishedGames } from '../server/published.js';
import { ReleaseLedger } from '../server/releases.js';
import { AnnouncementStore } from '../server/announcements.js';
import { GameManagement } from '../server/management.js';
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
const actors = {
  ha: { id: 'u1', role: 'author', epoch: 1, must_change: 0 },
  hadmin: { id: 'u9', role: 'admin', epoch: 1, must_change: 0 },
};
const principal = h => { if (!actors[h]) { fail(401, 'SESSION_INVALID'); } return actors[h]; };
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)');
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u1', 'author_a', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u9', 'tianyi', 'admin', '{}', 0, 0, 1, 1);
  storage.sql.exec('CREATE TABLE content_deletion_fences (game_id TEXT PRIMARY KEY)');
  storage.sql.exec('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, epoch INTEGER NOT NULL, absolute_until INTEGER NOT NULL, idle_until INTEGER NOT NULL)');
});
const games = new GameMetadataStore({ storage, principal, verifySnapshot: undefined, recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
const releases = new ReleaseLedger({ storage, principal, games });
const pins = new PublishedGames({ storage, principal });
const ann = new AnnouncementStore({ storage });
const mgmt = new GameManagement({ storage, principal, operationGuard: () => {} });
const DIG = 'b'.repeat(64);
const mkGame = (id, draftName) => storage.sql.exec(
  'INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  id, 'u1', draftName, '', null, null, '1', '1', null, '0', 0, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
storage.transactionSync(() => { mkGame(GA, 'DraftA'); mkGame(GB, 'DraftB'); });
// Worker #publishPin order, unlisted: issue → pin → prune → prune-ann → no announce.
const issued1 = storage.transactionSync(() => {
  const issued = releases.issueInTxn('ha', GA, '1', DIG);
  const pin = pins.publishInTxn('ha', { gameId: GA, name: 'AGame', revision: '1', sourceDigest: DIG, chapters: ['c1'], ordinal: issued.ordinal });
  releases.pruneExceptInTxn('ha', GA, issued.releaseId);
  ann.pruneExceptInTxn(GA, issued.releaseId);
  return { issued, pin };
});
check('unlisted publish pins 1.0', issued1.pin.ordinal === '1.0');
check('unlisted publish announces nothing', ann.list().announcements.length === 0 && ann.revision() === 0);
// Worker listing route order, 0→1: setListedInTxn + announceCurrentInTxn
// (+registry bump on a flip that inserts nothing).
const listed1 = storage.transactionSync(() => {
  const done = games.setListedInTxn('ha', GA, true, '1');
  if (done.becameListed) { if (!ann.announceCurrentInTxn(GA)) { ann.bumpRegistryInTxn(); } }
  else if (done.changed) { ann.bumpRegistryInTxn(); }
  return done;
});
check('listing flips', listed1.changed && listed1.becameListed && listed1.summary.rowRevision === '2');
const first = ann.list();
check('listing announces current', first.announcements.length === 1
  && first.announcements[0].ordinal === '1.0' && first.announcements[0].name === 'AGame'
  && first.announcements[0].creatorAccount === 'author_a'
  && first.announcements[0].publishedAt === issued1.issued.createdAt
  && typeof first.announcements[0].firstOnlineAt === 'string' && first.revision === 1);
const frozenAt = first.announcements[0].firstOnlineAt;
// Frozen snapshot: later live renames do not rewrite the announcement (Q33).
storage.transactionSync(() => { storage.sql.exec('UPDATE content_games SET draft_name=? WHERE game_id=?', 'Renamed', GA); });
check('announcement keeps frozen name', ann.list().announcements[0].name === 'AGame');
// Publish v2 while listed: single-version replacement, one row, revision+1 (Q31).
const issued2 = storage.transactionSync(() => {
  const issued = releases.issueInTxn('ha', GA, '2', DIG);
  pins.publishInTxn('ha', { gameId: GA, name: 'AGame2', revision: '2', sourceDigest: DIG, chapters: ['c1'], ordinal: issued.ordinal });
  releases.pruneExceptInTxn('ha', GA, issued.releaseId);
  ann.pruneExceptInTxn(GA, issued.releaseId);
  const live = storage.sql.exec('SELECT listed FROM content_games WHERE game_id=?', GA).toArray()[0];
  if (Number(live.listed) === 1) {
    if (ann.announceInTxn({ gameId: GA, releaseId: issued.releaseId, ordinal: issued.ordinal, name: 'AGame2', creatorAccount: 'author_a', publishedAt: issued.createdAt, firstOnlineAt: new Date().toISOString() })) { ann.bumpRegistryInTxn(); }
  }
  return issued;
});
const second = ann.list();
check('listed publish replaces with 1.1', second.announcements.length === 1 && second.announcements[0].ordinal === issued2.ordinal && second.revision === 2);
check('old release row pruned', storage.sql.exec('SELECT release_id FROM content_releases WHERE game_id=?', GA).toArray().length === 1);
// 下架 hides but keeps the row; relist of the same version neither dups
// nor retops (first_online_at preserved) — Q32/Q35.
const unlisted = storage.transactionSync(() => {
  const done = games.setListedInTxn('ha', GA, false, '2');
  if (!done.becameListed && done.changed) { ann.bumpRegistryInTxn(); }
  return done;
});
check('unlist flips down', unlisted.changed && !unlisted.becameListed);
check('delisted hidden, row kept', ann.list().announcements.length === 0
  && storage.sql.exec('SELECT COUNT(*) AS n FROM content_announcements WHERE game_id=?', GA).toArray()[0].n === 1
  && ann.revision() === 3);
const relisted = storage.transactionSync(() => {
  const done = games.setListedInTxn('ha', GA, true, '3');
  if (done.becameListed) { if (!ann.announceCurrentInTxn(GA)) { ann.bumpRegistryInTxn(); } }
  else if (done.changed) { ann.bumpRegistryInTxn(); }
  return done;
});
const third = ann.list();
check('relist restores same row/order', relisted.becameListed && third.announcements.length === 1
  && third.announcements[0].firstOnlineAt !== frozenAt // v2 row, not v1
  && third.revision === 4);
check('relist same version is idempotent', ann.announceCurrentInTxn(GA) === false
  && ann.list().announcements[0].firstOnlineAt === third.announcements[0].firstOnlineAt);
// No release yet → 上架 announces nothing (GB listed, never published).
storage.transactionSync(() => {
  const done = games.setListedInTxn('ha', GB, true, '1');
  if (done.becameListed) { check('unpublished listing announces nothing', ann.announceCurrentInTxn(GB) === false); }
  else { check('GB became listed', false); }
});
// Paging: 30 per page, (first_online_at DESC, id DESC), stale rev → first page.
for (let i = 0; i < 32; i++) {
  const id = `cccccccc-cccc-4ccc-accc-${String(i).padStart(12, '0')}`;
  storage.transactionSync(() => {
    mkGame(id, 'P' + i);
    const issued = releases.issueInTxn('ha', id, '1', DIG);
    pins.publishInTxn('ha', { gameId: id, name: 'P' + i, revision: '1', sourceDigest: DIG, chapters: ['c1'], ordinal: issued.ordinal });
    const done = games.setListedInTxn('ha', id, true, '1');
    if (done.becameListed) { ann.announceCurrentInTxn(id); }
  });
}
const page1 = ann.list();
check('page1 holds 30 + cursor', page1.announcements.length === 30 && typeof page1.nextCursor === 'string');
const ordered = page1.announcements.every((r, i, a) => i === 0 || a[i - 1].firstOnlineAt > r.firstOnlineAt || (a[i - 1].firstOnlineAt === r.firstOnlineAt && a[i - 1].announcementId > r.announcementId));
check('sort key honored', ordered);
const page2 = ann.list({ cursor: page1.nextCursor });
check('page2 holds the rest, no cursor', page2.announcements.length === 3 && page2.nextCursor === null);
const stale = ann.list({ cursor: Buffer.from(JSON.stringify({ t: page1.announcements[0].firstOnlineAt, id: page1.announcements[0].announcementId, rev: -1 })).toString('base64url') });
check('stale revision returns first page', stale.announcements.length === 30 && stale.revision === page1.revision);
await fails('malformed cursor 422', async () => ann.list({ cursor: '!!!' }), 'ANNOUNCE_CURSOR');
await fails('bad announce input 422', async () => storage.transactionSync(() => ann.announceInTxn({ gameId: GA, releaseId: 'x' })), 'ANNOUNCE_INPUT');
// DTO carries no private profile fields (Q33).
const dtoKeys = Object.keys(page1.announcements[0]).sort().join(',');
check('DTO shape frozen-public only', dtoKeys === 'announcementId,creatorAccount,firstOnlineAt,gameId,name,ordinal,publishedAt,releaseId', dtoKeys);
// Admin unlist bumps the registry (management.apply path).
storage.transactionSync(() => {
  storage.sql.exec('INSERT INTO content_used_ids VALUES(?)', GA);
  storage.sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?)', 'hadmin', 'u9', 1, Date.now() + 3600000, Date.now() + 3600000);
});
const before = ann.revision();
const applied = mgmt.apply('hadmin', { actor: 'u9', key: 'k9'.padEnd(16, '0'), digest: 'c'.repeat(64), epoch: 1 },
  { gameId: GA, action: 'unlist', expectedRowRevision: '4' });
check('admin unlist applies', applied.listed === false);
check('admin unlist bumps registry', ann.revision() === before + 1);
check('admin-unlisted game hidden', ann.list().announcements.every(r => r.gameId !== GA));

console.log(`passed ${passed} checks`);
