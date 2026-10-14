// V1 slice 8: run the REAL server/portraits.js GamePortraits on the VPS
// SQLite port: PNG normalize/store/list/remove/forPublish plus every
// rejection gate. (Valid-JPEG ingestion needs an encoder fixture; only
// the JPEG rejection gates are covered here.) Usage:
// node tools/verify_vps_portraits.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { GamePortraits } from '../server/portraits.js';
import { encodePNG } from '../server/pngio.js';
import { HttpError, fail } from '../server/security.js';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const fails = (name, fn, code) => {
  try { fn(); } catch (e) {
    check(name, e instanceof HttpError && e.code === code, e?.code);
    return;
  }
  check(name, false);
};

const OWNER = '55555555-5555-4555-8555-555555555555';
const GAME = '66666666-6666-4666-8666-666666666666';
const storage = openStorage(':memory:');
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', OWNER, 'author_s8', 'author', '{}', 0, 0, 1, 1);
  // Kernel seam: game row written directly (full creation proved in S2/S5).
  storage.sql.exec('CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), draft_name TEXT NOT NULL, draft_introduction TEXT NOT NULL, formal_name TEXT, formal_introduction TEXT, draft_revision TEXT NOT NULL, row_revision TEXT NOT NULL, current_release_id TEXT, next_ordinal TEXT NOT NULL, listed INTEGER NOT NULL, restricted INTEGER NOT NULL, created_at TEXT NOT NULL, modified_at TEXT NOT NULL)');
  storage.sql.exec("INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", GAME, OWNER, 'S8', '', null, null, '1', '1', null, '0', 0, 0, 't', 't');
});
const principal = h => { if (h !== 'h1') { fail(401, 'SESSION_INVALID'); } return { id: OWNER, role: 'author', epoch: 1, must_change: 0 }; };
const portraits = new GamePortraits({ storage, principal, reservedIds: ['kao'] });
check('construct', !!portraits);

const pixels128 = new Uint8Array(128 * 128 * 4);
for (let i = 0; i < pixels128.length; i += 4) { pixels128[i] = 200; pixels128[i + 1] = 100; pixels128[i + 2] = 50; pixels128[i + 3] = 255; }
const png128 = Buffer.from(encodePNG(pixels128, 128, 128));
const up = portraits.upload('h1', GAME, 'hero', new Uint8Array(png128));
check('png upload normalized', up.mime === 'image/png' && up.width === 128 && up.height === 128 && up.byteLength > 0);
const stored = storage.sql.exec('SELECT bytes FROM game_portraits WHERE game_id=? AND asset_id=?', GAME, 'hero').toArray()[0].bytes;
check('bytes round-trip + sha', Buffer.from(stored).equals(Buffer.from(up.sha256, 'hex')) === false && Buffer.from(stored).length === up.byteLength);

import { createHash } from 'node:crypto';
check('sha honest', createHash('sha256').update(Buffer.from(stored)).digest('hex') === up.sha256);
check('list one', portraits.list('h1', GAME).length === 1 && portraits.list('h1', GAME)[0].assetId === 'hero');

fails('duplicate 409', () => portraits.upload('h1', GAME, 'hero', new Uint8Array(png128)), 'PORTRAIT_EXISTS');
fails('reserved 422', () => portraits.upload('h1', GAME, 'kao', new Uint8Array(png128)), 'PORTRAIT_RESERVED');
fails('bad id 422', () => portraits.upload('h1', GAME, 'has space!', new Uint8Array(png128)), 'PORTRAIT_ID');
fails('garbage type 422', () => portraits.upload('h1', GAME, 'junk', new Uint8Array([1, 2, 3, 4])), 'PORTRAIT_TYPE');
const pixels64 = new Uint8Array(64 * 64 * 4).fill(255);
fails('wrong dims 422', () => portraits.upload('h1', GAME, 'small', new Uint8Array(Buffer.from(encodePNG(pixels64, 64, 64)))), 'PORTRAIT_DIMENSIONS');
fails('oversize 422', () => portraits.upload('h1', GAME, 'big', new Uint8Array(101 * 1024)), 'PORTRAIT_BYTES');
fails('builtin 403', () => portraits.upload('h1', 'wolong-builtin', 'hero', new Uint8Array(png128)), 'BUILTIN_PROTECTED');
fails('cross-owner 404', () => portraits.upload('hx', GAME, 'hero', new Uint8Array(png128)), 'SESSION_INVALID');

fails('in-use 409', () => portraits.remove('h1', GAME, 'hero', ['hero']), 'PORTRAIT_IN_USE');
const frozen = portraits.forPublish(GAME);
check('forPublish rows', frozen.length === 1 && frozen[0].bytes.length === up.byteLength);
const rm = portraits.remove('h1', GAME, 'hero', []);
check('remove true', rm.removed === true && portraits.list('h1', GAME).length === 0);
check('remove missing false', portraits.remove('h1', GAME, 'hero', []).removed === false);

console.log(`passed ${passed} checks`);
