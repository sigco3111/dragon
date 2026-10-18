// V1 slice 1: differential checks for vps/sqlite-port.mjs against the
// Durable-Object storage.sql semantics server/*.js relies on.
// Usage: node tools/verify_vps_sqlite_port.mjs
import { mkdtempSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '../vps/sqlite-port.mjs';

let passed = 0;
const check = (name, cond) => {
  if (!cond) { console.error(`FAIL ${name}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};

const mem = openStorage(':memory:');
mem.transactionSync(() => {
  mem.sql.exec('CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY, n INTEGER NOT NULL CHECK(n IN(0,1)), name TEXT COLLATE BINARY NOT NULL)');
  mem.sql.exec('INSERT OR IGNORE INTO t VALUES(?,?,?)', 'a', 1, 'X');
  mem.sql.exec('INSERT OR IGNORE INTO t VALUES(?,?,?)', 'a', 1, 'X');
});
check('insert-or-ignore dedup', mem.sql.exec('SELECT * FROM t').toArray().length === 1);
check('toArray row shape', JSON.stringify(mem.sql.exec('SELECT id,n FROM t WHERE id=?', 'a').toArray()) === '[{"id":"a","n":1}]');
check('empty toArray', Array.isArray(mem.sql.exec('SELECT * FROM t WHERE id=?', 'zzz').toArray()) && mem.sql.exec('SELECT * FROM t WHERE id=?', 'zzz').toArray().length === 0);

let threw = false;
try {
  mem.transactionSync(() => {
    mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'b', 1, 'Y');
    mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'bad', 7, 'Z');
  });
} catch { threw = true; }
check('check-violation throws', threw);
check('rollback restores', mem.sql.exec('SELECT * FROM t WHERE id=?', 'b').toArray().length === 0);

mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'c', 0, 'low');
const ret = mem.sql.exec('UPDATE t SET n=?,name=? WHERE id=? AND n=? RETURNING *', 1, 'high', 'c', 0).toArray();
check('update-returning row', ret.length === 1 && ret[0].n === 1 && ret[0].name === 'high');
check('update-returning empty on mismatch', mem.sql.exec('UPDATE t SET n=? WHERE id=? AND n=? RETURNING *', 1, 'c', 0).toArray().length === 0);

mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'd', 1, 'abc');
mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'e', 1, 'ABC');
const names = mem.sql.exec('SELECT name FROM t WHERE id IN(?,?) ORDER BY name', 'd', 'e').toArray().map(r => r.name);
check('collate binary case-distinct order', JSON.stringify(names) === '["ABC","abc"]');

mem.transactionSync(() => {
  mem.sql.exec('CREATE TABLE IF NOT EXISTS p (id TEXT PRIMARY KEY)');
  mem.sql.exec('CREATE TABLE IF NOT EXISTS ch (id TEXT PRIMARY KEY, pid TEXT NOT NULL REFERENCES p(id))');
});
let fkThrew = false;
try { mem.sql.exec('INSERT INTO ch VALUES(?,?)', 'x', 'nope'); } catch { fkThrew = true; }
check('foreign-key enforced', fkThrew);

mem.transactionSync(() => {
  mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'n1', 1, 'outer');
  mem.transactionSync(() => mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'n2', 1, 'inner'));
});
check('nested commit persists both', mem.sql.exec("SELECT id FROM t WHERE id IN('n1','n2')").toArray().length === 2);
mem.transactionSync(() => {
  mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'n3', 1, 'keep');
  try { mem.transactionSync(() => { mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'n4', 1, 'drop'); throw new Error('inner'); }); } catch { /* inner rolls back */ }
});
check('inner rollback keeps outer', mem.sql.exec("SELECT id FROM t WHERE id='n3'").toArray().length === 1 && mem.sql.exec("SELECT id FROM t WHERE id='n4'").toArray().length === 0);
let asyncEntered = false;
assert.throws(() => mem.transactionSync(async () => { asyncEntered = true; }), /SYNC_TRANSACTION_REQUIRED/);
check('async callback rejected before invocation', !asyncEntered);
assert.throws(() => mem.transactionSync(() => {
  mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'promise', 1, 'rollback');
  return Promise.resolve();
}), /SYNC_TRANSACTION_REQUIRED/);
check('thenable result rolls back synchronous prefix', mem.sql.exec("SELECT id FROM t WHERE id='promise'").toArray().length === 0);
mem.transactionSync(() => mem.sql.exec('INSERT INTO t VALUES(?,?,?)', 'after', 1, 'valid'));
check('transaction usable after async rejection', mem.sql.exec("SELECT id FROM t WHERE id='after'").toArray().length === 1);
const cursor = mem.sql.exec('SELECT id FROM t ORDER BY id');
assert.equal(cursor[Symbol.iterator](), cursor);
assert.equal(cursor.next().value.id, 'a');
const remainder = cursor.toArray();
check('iterator and toArray share one consuming cursor', remainder.length > 0 && remainder.every(row => row.id !== 'a') && cursor.toArray().length === 0 && cursor.next().done);
check('spread consumes query cursor', [...mem.sql.exec('SELECT id FROM t')].length === remainder.length + 1);
const beforePages = mem.sql.databaseSize;
assert.ok(Number.isSafeInteger(beforePages) && beforePages > 0);
assert.throws(() => mem.transactionSync(() => {
  mem.sql.exec('CREATE TABLE page_probe (bytes BLOB)');
  mem.sql.exec('INSERT INTO page_probe VALUES(?)', new Uint8Array(128 * 1024));
  assert.ok(mem.sql.databaseSize > beforePages);
  throw new Error('size rollback');
}), /size rollback/);
check('logical page bytes include active writes and restore on rollback', mem.sql.databaseSize === beforePages);
mem.close();
assert.throws(() => mem.sql.databaseSize);
check('closed database size cannot appear as zero', true);

const dir = mkdtempSync(join(tmpdir(), 'vps-sqlite-'));
const file = openStorage(join(dir, 'test.db'));
check('file open', !!file);
const mode = file.sql.exec('PRAGMA journal_mode').toArray()[0]?.journal_mode;
check('wal mode on file db', mode === 'wal');
file.transactionSync(() => file.sql.exec('CREATE TABLE k (v TEXT)'));
const concurrent = openStorage(join(dir, 'test.db'));
const sqlCalls = [], exec = file.sql._db.exec.bind(file.sql._db);
file.sql._db.exec = query => { sqlCalls.push(query); return exec(query); };
try {
  concurrent.sql.exec('BEGIN IMMEDIATE');
  assert.throws(() => file.transactionSync(() => {}), /locked/);
  concurrent.sql.exec('ROLLBACK');
  sqlCalls.length = 0;
  file.transactionSync(() => file.sql.exec("INSERT INTO k VALUES('after-lock')"));
  check('failed BEGIN preserves root transaction depth', sqlCalls[0] === 'BEGIN IMMEDIATE' && sqlCalls.at(-1) === 'COMMIT');
} finally { concurrent.close(); }
file.close();
const reopen = openStorage(join(dir, 'test.db'));
check('restart persistence', reopen.sql.exec("SELECT name FROM sqlite_master WHERE name='k'").toArray().length === 1);
reopen.close();
rmSync(dir, { recursive: true, force: true });

console.log(`passed ${passed} checks`);
