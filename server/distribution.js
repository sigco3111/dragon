// 分发账本 Outbox（V5 前置）：VPS 权威提交与 R2 公开投影之间的崩溃恢复。
// 发布事务内 enqueue（与发号/pin/剪枝同原子）；publisher 排空后 confirm。
// 重放安全：不可变 key＋CAS，重复排空只核对不重写。
import { fail } from './security.js';

export class DistributionOutbox {
  #sql;
  constructor({ storage }) {
    if (!storage?.sql) { throw new TypeError('actual SQLite required'); }
    this.#sql = storage.sql;
    storage.transactionSync(() => {
      this.#sql.exec("CREATE TABLE IF NOT EXISTS content_distribution_outbox (op_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, ordinal TEXT NOT NULL, release_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','confirmed')), attempts INTEGER NOT NULL, created_at TEXT NOT NULL, confirmed_at TEXT, receipt_json TEXT)");
    });
  }
  // Ambient-transaction only: caller owns the outer commit.
  enqueueInTxn({ gameId, ordinal, releaseId }) {
    if (typeof gameId !== 'string' || !gameId || typeof ordinal !== 'string' || !ordinal || typeof releaseId !== 'string' || !releaseId) { fail(422, 'DISTRIBUTION_INPUT'); }
    const opId = `${gameId}:${ordinal}`;
    const existing = this.#sql.exec('SELECT state FROM content_distribution_outbox WHERE op_id=?', opId).toArray()[0];
    if (existing) { return Object.freeze({ opId, deduped: true }); }
    this.#sql.exec(`INSERT INTO content_distribution_outbox (op_id,game_id,ordinal,release_id,state,attempts,created_at,confirmed_at,receipt_json) VALUES(?,?,?,?, 'pending',0,?,NULL,NULL)`, opId, gameId, ordinal, releaseId, new Date().toISOString());
    return Object.freeze({ opId, deduped: false });
  }
  pending() {
    return Object.freeze(this.#sql.exec(`SELECT op_id,game_id,ordinal,release_id,attempts,created_at FROM content_distribution_outbox WHERE state='pending' ORDER BY created_at`).toArray().map(r => Object.freeze({ ...r })));
  }
  noteAttempt(opId) {
    this.#sql.exec(`UPDATE content_distribution_outbox SET attempts=attempts+1 WHERE op_id=?`, opId);
  }
  confirmInTxn(opId, receipt) {
    if (typeof opId !== 'string' || !opId || !receipt || typeof receipt !== 'object') { fail(422, 'DISTRIBUTION_INPUT'); }
    const row = this.#sql.exec('SELECT state FROM content_distribution_outbox WHERE op_id=?', opId).toArray()[0];
    if (!row) { fail(404, 'DISTRIBUTION_UNKNOWN'); }
    if (row.state === 'confirmed') { return Object.freeze({ opId, deduped: true }); }
    this.#sql.exec(`UPDATE content_distribution_outbox SET state='confirmed',confirmed_at=?,receipt_json=? WHERE op_id=?`, new Date().toISOString(), JSON.stringify(receipt), opId);
    return Object.freeze({ opId, deduped: false });
  }
}
