// C-1: formal release ordinals (Q18/Q24) + no-rollback ledger (Q42).
// Standalone core; publish wiring is C-2. Usage:
// node tools/verify_vps_releases.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { GameMetadataStore } from '../server/metadata.js';
import { bumpOrdinal, ReleaseLedger } from '../server/releases.js';
import { PublishedGames } from '../server/published.js';
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

// Pure sequence: string steps, never floats.
check('first', bumpOrdinal('0') === '1.0');
check('minor', bumpOrdinal('1.0') === '1.1');
check('nine-ten', bumpOrdinal('1.9') === '1.10');
check('carry', bumpOrdinal('1.99') === '1.100');
check('multi', bumpOrdinal('2.3.9') === '2.3.10');
for (const bad of ['1', 'a.b', '1.0 ', '', '1.x', null]) {
  try { bumpOrdinal(bad); check(`reject ${bad}`, false); }
  catch (e) { check(`reject ${bad}`, e instanceof HttpError && e.code === 'RELEASE_ORDINAL'); }
}

// Ledger flow on a real game row (kernel seam: direct row insert like S8;
// full creation is proved in S2).
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', 'u1', 'author_r', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), draft_name TEXT NOT NULL, draft_introduction TEXT NOT NULL, formal_name TEXT, formal_introduction TEXT, draft_revision TEXT NOT NULL, row_revision TEXT NOT NULL, current_release_id TEXT, next_ordinal TEXT NOT NULL, listed INTEGER NOT NULL, restricted INTEGER NOT NULL, created_at TEXT NOT NULL, modified_at TEXT NOT NULL)');
  storage.sql.exec("INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'u1', 'Rel', '', null, null, '5', '3', null, '0', 0, 0, 't', 't');
});
const principal = h => { if (h !== 'h1') { fail(401, 'SESSION_INVALID'); } return { id: 'u1', role: 'author', epoch: 1, must_change: 0 }; };
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: undefined, recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
const ledger = new ReleaseLedger({ storage, principal, games });
check('construct', !!ledger);
const G = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const r1 = ledger.issue('h1', G, '5', 'b'.repeat(64));
check('first ordinal', r1.ordinal === '1.0' && typeof r1.releaseId === 'string');
const r2 = ledger.issue('h1', G, '6', 'c'.repeat(64));
check('second ordinal', r2.ordinal === '1.1' && r2.releaseId !== r1.releaseId);
check('current pointer', ledger.current('h1', G)?.ordinal === '1.1');
const hist = ledger.history('h1', G);
check('history kept', hist.length === 2 && hist[0].ordinal === '1.0' && hist[1].ordinal === '1.1');
check('no delete API', typeof ledger.delete !== 'function' && typeof ledger.retire !== 'function');
await fails('builtin 403', async () => ledger.issue('h1', 'wolong-builtin', '5', 'b'.repeat(64)), 'BUILTIN_PROTECTED');
await fails('unknown game 404', async () => ledger.issue('h1', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '5', 'b'.repeat(64)), 'GAME_NOT_FOUND');
await fails('bad revision 422', async () => ledger.issue('h1', G, '0', 'b'.repeat(64)), 'RELEASE_REVISION');
await fails('bad digest 422', async () => ledger.issue('h1', G, '5', 'zz'), 'RELEASE_DIGEST');
await fails('bad principal 401', async () => ledger.issue('hx', G, '5', 'b'.repeat(64)), 'SESSION_INVALID');

// C-2 atomic commit: ordinal + pin land or roll back together.
const registry = new PublishedGames({ storage, principal });
const pinIn = { gameId: G, name: 'Agame', revision: '6', sourceDigest: 'c'.repeat(64), chapters: ['c1'] };
const committed = storage.transactionSync(() => {
  const rel = ledger.issueInTxn('h1', G, '6', 'c'.repeat(64));
  const pin = registry.publishInTxn('h1', { ...pinIn, ordinal: rel.ordinal });
  return { rel, pin };
});
check('commit ordinal+pin', committed.rel.ordinal === '1.2' && committed.pin.revision === '6');
try {
  storage.transactionSync(() => {
    const rel = ledger.issueInTxn('h1', G, '7', 'd'.repeat(64));
    registry.publishInTxn('h1', { ...pinIn, revision: '7', sourceDigest: 'd'.repeat(64), ordinal: rel.ordinal });
    throw new Error('simulated post-commit failure');
  });
  check('rollback throws', false);
} catch (e) { check('rollback throws', e.message === 'simulated post-commit failure'); }
check('rollback consumes nothing', ledger.history('h1', G).length === 3 && ledger.current('h1', G)?.ordinal === '1.2');
const retainedPin = storage.sql.exec('SELECT pin_json FROM published_games WHERE game_id=?', G).toArray()[0].pin_json;
check('pin still rev6', retainedPin === JSON.stringify(committed.pin));
check('unlisted pin remains private', registry.list().length === 0);
storage.close();

console.log(`passed ${passed} checks`);
