// Formal release ledger (Q18/Q24/Q42): integer-sequence release ordinals
// ("1.0"→"1.1"…→"1.9"→"1.10", string steps, never floats) with full history.
// Failed publishes must not consume ordinals: wire issue() inside the
// publish transaction (publish wiring is C-2; standalone commits here).
// No rollback API by design (Q42); retire() clears packs, never releases.
import { fail } from './security.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const revision = value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function bumpOrdinal(current) {
  if (current === '0') { return '1.0'; }
  if (typeof current !== 'string' || !/^[0-9]+(\.[0-9]+)+$/.test(current)) { fail(422, 'RELEASE_ORDINAL'); }
  const parts = current.split('.');
  parts[parts.length - 1] = String(BigInt(parts[parts.length - 1]) + 1n);
  return parts.join('.');
}

export class ReleaseLedger {
  #storage; #sql; #principal; #games;
  constructor({ storage, principal, games }) {
    if (!storage?.sql || typeof principal !== 'function' || typeof games?.listOwn !== 'function' || typeof games?.assertNotDeleting !== 'function') {
      throw new TypeError('actual SQL, principal and game directory required');
    }
    this.#storage = storage; this.#sql = storage.sql; this.#principal = principal; this.#games = games;
    storage.transactionSync(() => {
      this.#sql.exec('CREATE TABLE IF NOT EXISTS content_releases (game_id TEXT NOT NULL, release_id TEXT NOT NULL, ordinal TEXT NOT NULL, draft_revision TEXT NOT NULL, source_digest TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(game_id,ordinal))');
      this.#sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS content_releases_by_id ON content_releases(release_id)');
    });
  }
  #one(query, ...values) { return this.#sql.exec(query, ...values).toArray()[0]; }
  #owned(tokenHash, gameId) {
    const actor = this.#principal(tokenHash);
    if (actor.must_change) fail(403, 'PASSWORD_CHANGE_REQUIRED');
    if (gameId === 'wolong-builtin') fail(403, 'BUILTIN_PROTECTED');
    if (!uuid(gameId)) fail(422, 'RELEASE_GAME_ID');
    const entry = this.#games.listOwn(tokenHash).find(g => g.gameId === gameId);
    if (!entry) fail(404, 'GAME_NOT_FOUND');
    this.#games.assertNotDeleting(gameId);
    return { actor, entry };
  }
  // Issues the next ordinal for a verified draft revision. Runs in its own
  // transaction here; the publish route calls the inner form inside the
  // publish transaction so failures roll the ordinal back (C-2).
  issue(tokenHash, gameId, draftRevision, sourceDigest) {
    return this.#storage.transactionSync(() => this.issueInTxn(tokenHash, gameId, draftRevision, sourceDigest));
  }
  issueInTxn(tokenHash, gameId, draftRevision, sourceDigest) {
    if (!revision(draftRevision)) fail(422, 'RELEASE_REVISION');
    if (!digest(sourceDigest)) fail(422, 'RELEASE_DIGEST');
    const { actor } = this.#owned(tokenHash, gameId);
    const row = this.#one('SELECT next_ordinal, current_release_id FROM content_games WHERE game_id=?', gameId);
    if (!row) fail(404, 'GAME_NOT_FOUND');
    const ordinal = bumpOrdinal(row.next_ordinal);
    const releaseId = crypto.randomUUID(), time = new Date().toISOString();
    this.#sql.exec('UPDATE content_games SET next_ordinal=?,current_release_id=?,modified_at=? WHERE game_id=? AND next_ordinal=?',
      ordinal, releaseId, time, gameId, row.next_ordinal);
    const check = this.#one('SELECT next_ordinal FROM content_games WHERE game_id=?', gameId);
    if (!check || check.next_ordinal !== ordinal) fail(409, 'RELEASE_CONFLICT');
    this.#sql.exec('INSERT INTO content_releases VALUES(?,?,?,?,?,?)', gameId, releaseId, ordinal, draftRevision, sourceDigest, time);
    void actor;
    return Object.freeze({ gameId, releaseId, ordinal, draftRevision, sourceDigest, createdAt: time });
  }
  history(tokenHash, gameId) {
    this.#owned(tokenHash, gameId);
    return Object.freeze(this.#sql.exec('SELECT release_id, ordinal, draft_revision, source_digest, created_at FROM content_releases WHERE game_id=? ORDER BY created_at, ordinal', gameId).toArray()
      .map(row => Object.freeze({ gameId, releaseId: row.release_id, ordinal: row.ordinal, draftRevision: row.draft_revision, sourceDigest: row.source_digest, createdAt: row.created_at })));
  }
  current(tokenHash, gameId) {
    const { entry } = this.#owned(tokenHash, gameId);
    if (!entry.currentReleaseId) return null;
    const row = this.#one('SELECT release_id, ordinal, draft_revision, source_digest, created_at FROM content_releases WHERE game_id=? AND release_id=?', gameId, entry.currentReleaseId);
    if (!row) fail(503, 'RELEASE_POINTER_CORRUPT');
    return Object.freeze({ gameId, releaseId: row.release_id, ordinal: row.ordinal, draftRevision: row.draft_revision, sourceDigest: row.source_digest, createdAt: row.created_at });
  }
  // Single live version per game (product decision): after issuing the new
  // ordinal, delete superseded release rows. Ambient-transaction form only;
  // the publish route calls it inside the publish commit so a later failure
  // still rolls everything back. next_ordinal keeps incrementing.
  pruneExceptInTxn(tokenHash, gameId, keepReleaseId) {
    this.#owned(tokenHash, gameId);
    if (typeof keepReleaseId !== 'string' || !uuid(keepReleaseId)) fail(422, 'RELEASE_GAME_ID');
    this.#sql.exec('DELETE FROM content_releases WHERE game_id=? AND release_id<>?', gameId, keepReleaseId);
  }
}
