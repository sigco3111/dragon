// VPS SQLite platform port: adapt node:sqlite DatabaseSync to the
// Durable-Object storage.sql surface used by server/*.js:
//   storage.sql.exec(query, ...values) -> consuming iterable cursor / .toArray()
//   storage.sql.databaseSize          -> SQLite logical allocated page bytes
//   storage.transactionSync(fn)        -> sync BEGIN/COMMIT/ROLLBACK + savepoints
// No business logic here; differential checks live in
// tools/verify_vps_sqlite_port.mjs.
import { DatabaseSync } from 'node:sqlite';

export function openStorage(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA foreign_keys=ON');
  let depth = 0;
  const sql = {
    exec(query, ...values) {
      // DO storage.sql.exec executes eagerly: even callers that never touch
      // the cursor (e.g. bare CREATE TABLE / INSERT) take effect. Run now
      // and buffer rows for toArray().
      if (typeof query !== 'string' || !query.trim()) throw new TypeError('query required');
      const rows = db.prepare(query).all(...values);
      let offset = 0;
      return {
        [Symbol.iterator]() { return this; },
        next() { return offset < rows.length ? { value: rows[offset++], done: false } : { value: undefined, done: true }; },
        toArray() { const rest = rows.slice(offset); offset = rows.length; return rest; },
      };
    },
    get databaseSize() {
      // Includes allocated/free pages and the connection's current transaction;
      // not filesystem stat/WAL-file length, quota or a durability certificate.
      const pages = db.prepare('PRAGMA page_count').get().page_count;
      const pageSize = db.prepare('PRAGMA page_size').get().page_size;
      const bytes = pages * pageSize;
      if (!Number.isSafeInteger(pages) || pages < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(bytes)) throw new RangeError('SQLITE_DATABASE_SIZE');
      return bytes;
    },
    get _db() { return db; },
  };
  const storage = {
    sql,
    transactionSync(fn) {
      // The worker relies on nesting (drafts.save wraps games.transaction).
      // Durable-Object SQLite nests via savepoints; mirror that here: outer
      // level uses BEGIN/COMMIT/ROLLBACK, inner levels use SAVEPOINTs.
      if (typeof fn !== 'function' || fn.constructor?.name === 'AsyncFunction') throw new TypeError('SYNC_TRANSACTION_REQUIRED');
      const level = depth;
      db.exec(level === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT vps_${level}`);
      depth = level + 1; // A failed BEGIN must not corrupt the nesting depth.
      try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new TypeError('SYNC_TRANSACTION_REQUIRED');
        db.exec(level === 0 ? 'COMMIT' : `RELEASE vps_${level}`);
        depth = level;
        return result;
      } catch (error) {
        try {
          if (level === 0) { db.exec('ROLLBACK'); }
          else { db.exec(`ROLLBACK TO SAVEPOINT vps_${level}`); db.exec(`RELEASE vps_${level}`); }
        } catch { /* keep original error */ }
        depth = level;
        throw error;
      }
    },
    close() { db.close(); },
  };
  return storage;
}
