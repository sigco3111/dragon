// Durable, ordered transport envelopes. No authority/ACL decisions or R2 I/O here.
// The caller owns the SAME outer transaction as its authoritative mutation.
// Receipt verification is a required synchronous trusted capability, not client JSON.
import { createHash, randomUUID } from 'node:crypto';
import { fail } from './security.js';

export const DISTRIBUTION_PAYLOAD_LIMIT = 4 * 1024 * 1024;
export const DISTRIBUTION_CHUNK_BYTES = 128 * 1024;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sha = value => createHash('sha256').update(value).digest('hex');
const kinds = new Set(['publish', 'listing', 'restriction', 'delete-fence', 'bootstrap']);
const blocks = new Set(['REMOTE_AHEAD', 'AUTHORITY_MISMATCH', 'REMOTE_GAP', 'LEGACY_PENDING']);
const requireRecord = condition => { if (!condition) fail(503, 'DISTRIBUTION_LEDGER_CORRUPT'); };
function payloadBytes(value) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 || value.byteLength > DISTRIBUTION_PAYLOAD_LIMIT) fail(422, 'DISTRIBUTION_PAYLOAD');
  const bytes = Buffer.from(value);
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(422, 'DISTRIBUTION_PAYLOAD'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || parsed.version !== 1) fail(422, 'DISTRIBUTION_PAYLOAD');
  return bytes;
}
function receiptFields(value, identity, operationDigest) {
  if (!value || typeof value.then === 'function' || value.authorityId !== identity.authorityId || value.generation !== identity.generation || value.operationId !== identity.operationId || value.operationDigest !== operationDigest || value.payloadDigest !== identity.payloadDigest || !digest(value.rootDigest) || typeof value.rootETag !== 'string' || !value.rootETag || value.rootETag.length > 256 || /[\r\n]/.test(value.rootETag) || !iso(value.visibleAt)) fail(503, 'DISTRIBUTION_RECEIPT');
  return { authorityId: value.authorityId, generation: value.generation, operationId: value.operationId, operationDigest: value.operationDigest, payloadDigest: value.payloadDigest, rootDigest: value.rootDigest, rootETag: value.rootETag, visibleAt: value.visibleAt };
}
function descriptor(authorityId, row) {
  return { version: 1, authorityId, generation: row.generation, operationId: row.operation_id, kind: row.kind, gameId: row.game_id, payloadDigest: row.payload_digest, previousDigest: row.previous_digest, createdAt: row.created_at };
}

export class FrozenDistributionLedger {
  #storage; #sql; #verifyReceipt;
  constructor({ storage, authorityId, verifyReceipt }) {
    if (!storage?.sql || typeof storage.transactionSync !== 'function' || typeof verifyReceipt !== 'function' || verifyReceipt.constructor?.name === 'AsyncFunction') throw new TypeError('same SQLite and synchronous trusted receipt verifier required');
    if (authorityId !== undefined && !uuid(authorityId)) throw new TypeError('authority UUID required');
    this.#storage = storage; this.#sql = storage.sql; this.#verifyReceipt = verifyReceipt;
    storage.transactionSync(() => {
      this.#sql.exec("CREATE TABLE IF NOT EXISTS content_distribution_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), authority_id TEXT NOT NULL, tail_generation INTEGER NOT NULL CHECK(tail_generation>=0), tail_digest TEXT, confirmed_generation INTEGER NOT NULL CHECK(confirmed_generation>=0), confirmed_digest TEXT, blocked_reason TEXT, version INTEGER NOT NULL CHECK(version=1))");
      this.#sql.exec("CREATE TABLE IF NOT EXISTS content_distribution_events (generation INTEGER PRIMARY KEY CHECK(generation>0), operation_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, game_id TEXT, previous_digest TEXT, operation_digest TEXT NOT NULL, payload_digest TEXT NOT NULL, payload_length INTEGER NOT NULL, chunk_count INTEGER NOT NULL, created_at TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','confirmed')), attempts INTEGER NOT NULL CHECK(attempts>=0), confirmed_at TEXT, receipt_json TEXT)");
      this.#sql.exec("CREATE TABLE IF NOT EXISTS content_distribution_chunks (generation INTEGER NOT NULL REFERENCES content_distribution_events(generation), part INTEGER NOT NULL CHECK(part>=0), bytes BLOB NOT NULL, PRIMARY KEY(generation,part))");
      const existing = this.#one('SELECT authority_id FROM content_distribution_state WHERE singleton=1');
      if (existing && authorityId !== undefined && existing.authority_id !== authorityId) fail(503, 'DISTRIBUTION_AUTHORITY_CHANGED');
      if (!existing) this.#sql.exec('INSERT INTO content_distribution_state(singleton,authority_id,tail_generation,tail_digest,confirmed_generation,confirmed_digest,blocked_reason,version) VALUES(1,?,0,NULL,0,NULL,NULL,1)', authorityId ?? randomUUID());
      this.#state();
    });
  }
  #one(query, ...values) { return this.#sql.exec(query, ...values).toArray()[0]; }
  #metadata(row, state) {
    requireRecord(row && Number.isSafeInteger(row.generation) && row.generation > 0 && uuid(row.operation_id) && kinds.has(row.kind));
    requireRecord(row.kind === 'bootstrap' ? row.game_id === null && row.generation === 1 : uuid(row.game_id));
    requireRecord((row.generation === 1 ? row.previous_digest === null : digest(row.previous_digest)) && digest(row.operation_digest) && digest(row.payload_digest));
    requireRecord(Number.isSafeInteger(row.payload_length) && row.payload_length > 0 && row.payload_length <= DISTRIBUTION_PAYLOAD_LIMIT && row.chunk_count === Math.ceil(row.payload_length / DISTRIBUTION_CHUNK_BYTES));
    requireRecord(iso(row.created_at) && ['pending', 'confirmed'].includes(row.state) && integer(row.attempts));
    requireRecord(row.generation <= state.tail_generation && (row.state === 'confirmed') === (row.generation <= state.confirmed_generation));
    requireRecord(row.state === 'pending' ? row.confirmed_at === null && row.receipt_json === null : iso(row.confirmed_at) && typeof row.receipt_json === 'string');
    const value = descriptor(state.authority_id, row);
    requireRecord(sha(JSON.stringify(value)) === row.operation_digest);
    if (row.state === 'confirmed') {
      try { requireRecord(JSON.stringify(receiptFields(JSON.parse(row.receipt_json), value, row.operation_digest)) === row.receipt_json); }
      catch { fail(503, 'DISTRIBUTION_LEDGER_CORRUPT'); }
    }
    return value;
  }
  #state() {
    const state = this.#one('SELECT * FROM content_distribution_state WHERE singleton=1');
    requireRecord(state && state.version === 1 && uuid(state.authority_id) && integer(state.tail_generation) && integer(state.confirmed_generation) && state.confirmed_generation <= state.tail_generation);
    requireRecord(state.tail_generation === 0 ? state.tail_digest === null : digest(state.tail_digest));
    requireRecord(state.confirmed_generation === 0 ? state.confirmed_digest === null : digest(state.confirmed_digest));
    requireRecord(state.blocked_reason === null || blocks.has(state.blocked_reason));
    const extent = this.#one('SELECT COUNT(*) AS n,MIN(generation) AS lo,MAX(generation) AS hi FROM content_distribution_events');
    requireRecord(extent.n === state.tail_generation && (state.tail_generation === 0 ? extent.lo === null && extent.hi === null : extent.lo === 1 && extent.hi === state.tail_generation));
    for (const [generation, hash, confirmed] of [[state.tail_generation, state.tail_digest, false], [state.confirmed_generation, state.confirmed_digest, true]]) if (generation > 0) {
      const row = this.#one('SELECT * FROM content_distribution_events WHERE generation=?', generation);
      this.#metadata(row, state); requireRecord(row.operation_digest === hash && (!confirmed || row.state === 'confirmed'));
    }
    return state;
  }
  status() {
    return this.#storage.transactionSync(() => {
      const s = this.#state();
      return Object.freeze({ authorityId: s.authority_id, tailGeneration: s.tail_generation, tailDigest: s.tail_digest, confirmedGeneration: s.confirmed_generation, confirmedDigest: s.confirmed_digest, blockedReason: s.blocked_reason });
    });
  }
  // Metadata-only observation of one exact operation. Callers own ACL checks.
  // Confirmed means a historical root/readback was confirmed, NOT that this
  // game is currently listed or that this operation is still the remote head.
  operationStatus(gameId, operationId) {
    if (!uuid(gameId) || !uuid(operationId)) fail(422, 'DISTRIBUTION_OPERATION');
    return this.#storage.transactionSync(() => {
      const state = this.#state();
      const row = this.#one('SELECT * FROM content_distribution_events WHERE operation_id=? AND game_id=?', operationId, gameId);
      if (!row) fail(404, 'DISTRIBUTION_UNKNOWN');
      this.#metadata(row, state);
      let receipt = null;
      if (row.receipt_json !== null) {
        try { receipt = JSON.parse(row.receipt_json); }
        catch { fail(503, 'DISTRIBUTION_LEDGER_CORRUPT'); }
      }
      return Object.freeze({ gameId, operationId, generation: row.generation, kind: row.kind, state: row.state, visibleAt: receipt?.visibleAt ?? null, recoveryRequired: state.blocked_reason !== null });
    });
  }
  // No automatic unblock API: a remote-ahead/foreign/missing root needs recovery.
  block(reason) {
    if (!blocks.has(reason)) fail(422, 'DISTRIBUTION_BLOCK_REASON');
    return this.#storage.transactionSync(() => {
      this.#state(); this.#sql.exec('UPDATE content_distribution_state SET blocked_reason=COALESCE(blocked_reason,?) WHERE singleton=1', reason);
      return this.status();
    });
  }
  pendingForGame(gameId) {
    if (!uuid(gameId)) fail(422, 'DISTRIBUTION_GAME');
    return this.#storage.transactionSync(() => { this.#state(); return !!this.#one("SELECT generation FROM content_distribution_events WHERE game_id=? AND state='pending' LIMIT 1", gameId); });
  }
  // Ambient transaction required to join release/pin/ordinal/current snapshot.
  enqueueInTxn({ operationId, kind, gameId = null, payload }) {
    if (!uuid(operationId) || !kinds.has(kind) || (kind === 'bootstrap' ? gameId !== null : !uuid(gameId))) fail(422, 'DISTRIBUTION_OPERATION');
    const bytes = payloadBytes(payload), payloadDigest = sha(bytes), state = this.#state();
    if (state.blocked_reason !== null) fail(503, 'DISTRIBUTION_RECOVERY_REQUIRED');
    const prior = this.#one('SELECT * FROM content_distribution_events WHERE operation_id=?', operationId);
    if (prior) {
      const identity = this.#metadata(prior, state);
      if (prior.kind !== kind || prior.game_id !== gameId || prior.payload_digest !== payloadDigest) fail(409, 'DISTRIBUTION_OPERATION_CONFLICT');
      this.#payload(prior);
      return Object.freeze({ ...identity, operationDigest: prior.operation_digest, deduped: true });
    }
    if (kind === 'publish' && this.#one("SELECT generation FROM content_distribution_events WHERE game_id=? AND state='pending' LIMIT 1", gameId)) fail(409, 'DISTRIBUTION_GAME_PENDING');
    if (state.tail_generation >= Number.MAX_SAFE_INTEGER || kind === 'bootstrap' && state.tail_generation !== 0) fail(409, 'DISTRIBUTION_GENERATION');
    const row = { generation: state.tail_generation + 1, operation_id: operationId, kind, game_id: gameId, previous_digest: state.tail_digest, payload_digest: payloadDigest, created_at: new Date().toISOString() };
    const identity = descriptor(state.authority_id, row), operationDigest = sha(JSON.stringify(identity));
    const count = Math.ceil(bytes.length / DISTRIBUTION_CHUNK_BYTES);
    this.#sql.exec("INSERT INTO content_distribution_events(generation,operation_id,kind,game_id,previous_digest,operation_digest,payload_digest,payload_length,chunk_count,created_at,state,attempts,confirmed_at,receipt_json) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',0,NULL,NULL)", row.generation, operationId, kind, gameId, state.tail_digest, operationDigest, payloadDigest, bytes.length, count, row.created_at);
    for (let part = 0; part < count; part++) this.#sql.exec('INSERT INTO content_distribution_chunks(generation,part,bytes) VALUES(?,?,?)', row.generation, part, new Uint8Array(bytes.subarray(part * DISTRIBUTION_CHUNK_BYTES, (part + 1) * DISTRIBUTION_CHUNK_BYTES)));
    this.#sql.exec('UPDATE content_distribution_state SET tail_generation=?,tail_digest=? WHERE singleton=1 AND tail_generation=? AND tail_digest IS ?', row.generation, operationDigest, state.tail_generation, state.tail_digest);
    requireRecord(this.#one('SELECT changes() AS n').n === 1);
    return Object.freeze({ ...identity, operationDigest, deduped: false });
  }
  #payload(row) {
    const parts = this.#sql.exec('SELECT part,bytes FROM content_distribution_chunks WHERE generation=? ORDER BY part', row.generation).toArray();
    requireRecord(parts.length === row.chunk_count);
    const buffers = parts.map((part, i) => {
      requireRecord(part.part === i && (part.bytes instanceof ArrayBuffer || part.bytes instanceof Uint8Array));
      const bytes = Buffer.from(part.bytes);
      requireRecord(bytes.length === Math.min(DISTRIBUTION_CHUNK_BYTES, row.payload_length - i * DISTRIBUTION_CHUNK_BYTES));
      return bytes;
    });
    const bytes = Buffer.concat(buffers);
    requireRecord(bytes.length === row.payload_length && sha(bytes) === row.payload_digest);
    try { payloadBytes(bytes); } catch { fail(503, 'DISTRIBUTION_LEDGER_CORRUPT'); }
    return new Uint8Array(bytes);
  }
  next() {
    return this.#storage.transactionSync(() => {
      const state = this.#state();
      if (state.blocked_reason !== null) fail(503, 'DISTRIBUTION_RECOVERY_REQUIRED');
      if (state.confirmed_generation === state.tail_generation) return null;
      const row = this.#one('SELECT * FROM content_distribution_events WHERE generation=?', state.confirmed_generation + 1);
      const identity = this.#metadata(row, state);
      requireRecord(row.state === 'pending' && row.previous_digest === state.confirmed_digest);
      return Object.freeze({ ...identity, operationDigest: row.operation_digest, attempts: row.attempts, payload: this.#payload(row) });
    });
  }
  // Read an exact retained operation for head reconciliation, not a current-game
  // reconstruction. Read-only inspection remains available under a recovery lock.
  entry(generation) {
    if (!Number.isSafeInteger(generation) || generation < 1) fail(422, 'DISTRIBUTION_GENERATION');
    return this.#storage.transactionSync(() => {
      const state = this.#state(), row = this.#one('SELECT * FROM content_distribution_events WHERE generation=?', generation);
      if (!row) fail(404, 'DISTRIBUTION_UNKNOWN');
      const identity = this.#metadata(row, state);
      if (generation > 1) {
        const prior = this.#one('SELECT * FROM content_distribution_events WHERE generation=?', generation - 1);
        this.#metadata(prior, state); requireRecord(row.previous_digest === prior.operation_digest);
      }
      let receipt = null;
      if (row.receipt_json !== null) {
        try { receipt = Object.freeze(JSON.parse(row.receipt_json)); }
        catch { fail(503, 'DISTRIBUTION_LEDGER_CORRUPT'); }
      }
      return Object.freeze({ ...identity, operationDigest: row.operation_digest, attempts: row.attempts, state: row.state, receipt, payload: this.#payload(row) });
    });
  }
  noteAttemptInTxn(operationId) {
    const next = this.next();
    if (!next || next.operationId !== operationId || next.attempts >= Number.MAX_SAFE_INTEGER) fail(409, 'DISTRIBUTION_ORDER');
    this.#sql.exec('UPDATE content_distribution_events SET attempts=attempts+1 WHERE operation_id=?', operationId);
  }
  confirmInTxn(operationId, receipt) {
    const state = this.#state(), row = this.#one('SELECT * FROM content_distribution_events WHERE operation_id=?', operationId);
    if (!row) fail(404, 'DISTRIBUTION_UNKNOWN');
    const identity = this.#metadata(row, state);
    // The verifier must authenticate a server-owned readback capability. Merely
    // parsing receipt fields is not sufficient and no default verifier exists.
    const value = this.#verifyReceipt(receipt, Object.freeze({ ...identity, operationDigest: row.operation_digest }));
    const saved = receiptFields(value, identity, row.operation_digest);
    const text = JSON.stringify(saved);
    if (row.state === 'confirmed') {
      if (row.receipt_json !== text) fail(409, 'DISTRIBUTION_RECEIPT_CONFLICT');
      return Object.freeze({ ...saved, deduped: true });
    }
    if (state.blocked_reason !== null) fail(503, 'DISTRIBUTION_RECOVERY_REQUIRED');
    if (row.generation !== state.confirmed_generation + 1 || row.previous_digest !== state.confirmed_digest) fail(409, 'DISTRIBUTION_ORDER');
    this.#payload(row);
    this.#sql.exec("UPDATE content_distribution_events SET state='confirmed',confirmed_at=?,receipt_json=? WHERE operation_id=? AND state='pending'", new Date().toISOString(), text, operationId);
    requireRecord(this.#one('SELECT changes() AS n').n === 1);
    this.#sql.exec('UPDATE content_distribution_state SET confirmed_generation=?,confirmed_digest=? WHERE singleton=1 AND confirmed_generation=? AND confirmed_digest IS ?', row.generation, row.operation_digest, state.confirmed_generation, state.confirmed_digest);
    requireRecord(this.#one('SELECT changes() AS n').n === 1);
    return Object.freeze({ ...saved, deduped: false });
  }
}
