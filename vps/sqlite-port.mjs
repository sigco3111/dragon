// VPS SQLite platform port: adapt node:sqlite DatabaseSync to the
// Durable-Object storage.sql surface used by server/*.js:
//   storage.sql.exec(query, ...values) -> cursor with .toArray()
//   storage.transactionSync(fn)        -> BEGIN/COMMIT/ROLLBACK, no nesting
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
      return { toArray: () => rows };
    },
    get _db() { return db; },
  };
  const storage = {
    sql,
    transactionSync(fn) {
      // The worker relies on nesting (drafts.save wraps games.transaction).
      // Durable-Object SQLite nests via savepoints; mirror that here: outer
      // level uses BEGIN/COMMIT/ROLLBACK, inner levels use SAVEPOINTs.
      const level = depth++;
      db.exec(level === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT vps_${level}`);
      try {
        const result = fn();
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
