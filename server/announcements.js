// D组公告后端（Q31–Q36，工程合同§8.3）：唯一(gameId,releaseId)公告事务。
// 生成点：发版时若已上架、或上架时取当前版本；下架只隐藏（listed 过滤在读时执行），
// 同版本重上不改 first_online_at、不重复插；Q32保留全部已公开版本的公告，
// 当前版可选不等于删旧公告。快照字段 name/version/creatorAccount 生成时冻结，无手改入口；
// 私人资料（display_name/email/phone/note）永不进公告 DTO。registry revision 供游标用。
import { fail } from './security.js';

export class AnnouncementStore {
  #sql;
  constructor({ storage }) {
    if (!storage?.sql || typeof storage.transactionSync !== 'function') throw new TypeError('actual SQLite storage required');
    this.#sql = storage.sql;
    this.#sql.exec('CREATE TABLE IF NOT EXISTS content_announcements (announcement_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, release_id TEXT NOT NULL, ordinal TEXT NOT NULL, name TEXT NOT NULL, creator_account TEXT NOT NULL, published_at TEXT NOT NULL, first_online_at TEXT NOT NULL, UNIQUE(game_id,release_id))');
    this.#sql.exec('CREATE TABLE IF NOT EXISTS content_registry (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL)');
    this.#sql.exec('INSERT OR IGNORE INTO content_registry VALUES(1,0)');
  }
  // D-上架公告当前版本（Q31）：取当前 release＋冻结名/账户；无 release
  // （从未发版）则跳过。INSERT OR IGNORE 保证同版本重上不重复、
  // first_online_at 不变（Q35）。Ambient-transaction 专用，调用方须在事务内调用。
  announceCurrentInTxn(gameId) {
    const rel = this.#sql.exec('SELECT r.release_id,r.ordinal,r.created_at FROM content_releases r JOIN content_games g ON g.game_id=r.game_id WHERE r.game_id=? AND r.release_id=g.current_release_id', gameId).toArray()[0];
    if (!rel) { return false; }
    const pinRow = this.#sql.exec('SELECT pin_json FROM published_games WHERE game_id=?', gameId).toArray()[0];
    let name = null;
    if (pinRow) { try { name = JSON.parse(pinRow.pin_json)?.name ?? null; } catch { name = null; } }
    const meta = this.#sql.exec('SELECT g.formal_name,g.draft_name,u.account FROM content_games g JOIN users u ON u.id=g.owner_id WHERE g.game_id=?', gameId).toArray()[0];
    if (typeof name !== 'string' || !name) { name = meta?.formal_name || meta?.draft_name; }
    if (typeof name !== 'string' || !name || !meta) { return false; }
    const nowIso = new Date().toISOString();
    if (this.announceInTxn({ gameId, releaseId: rel.release_id, ordinal: rel.ordinal, name, creatorAccount: meta.account, publishedAt: rel.created_at, firstOnlineAt: nowIso })) {
      this.bumpRegistryInTxn();
      return true;
    }
    return false;
  }
  // Ambient-transaction form (see above). Pre-SELECT then plain INSERT:
  // DO transactions run exclusively, so the check-then-insert is exact;
  // the UNIQUE backstops any race loudly instead of silently ignoring it.
  announceInTxn({ gameId, releaseId, ordinal, name, creatorAccount, publishedAt, firstOnlineAt }) {
    if (typeof gameId !== 'string' || typeof releaseId !== 'string' || typeof ordinal !== 'string'
      || typeof name !== 'string' || !name || typeof creatorAccount !== 'string' || !creatorAccount
      || typeof publishedAt !== 'string' || typeof firstOnlineAt !== 'string') fail(422, 'ANNOUNCE_INPUT');
    const old = this.#sql.exec('SELECT announcement_id FROM content_announcements WHERE game_id=? AND release_id=?', gameId, releaseId).toArray()[0];
    if (old) { return false; }
    this.#sql.exec('INSERT INTO content_announcements(game_id,release_id,ordinal,name,creator_account,published_at,first_online_at) VALUES(?,?,?,?,?,?,?)',
      gameId, releaseId, ordinal, name, creatorAccount, publishedAt, firstOnlineAt);
    return true;
  }
  bumpRegistryInTxn() {
    this.#sql.exec('UPDATE content_registry SET revision=revision+1 WHERE id=1');
  }
  revision() {
    return this.#sql.exec('SELECT revision FROM content_registry WHERE id=1').toArray()[0]?.revision ?? 0;
  }
  // Anonymous player read (Q32/Q35): only currently listed games surface;
  // delisted rows stay but are filtered here, relist restores original order
  // (first_online_at untouched). Sort (first_online_at DESC, id DESC), page 30.
  // A stale cursor revision returns the first page (directory changed → refetch).
  list({ cursor } = {}) {
    const rev = this.revision();
    let rows;
    if (cursor !== undefined) {
      let key;
      try { key = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8')); }
      catch { fail(422, 'ANNOUNCE_CURSOR'); }
      if (!key || typeof key !== 'object' || typeof key.t !== 'string' || typeof key.id !== 'number' || key.rev !== rev) {
        key = null;
      }
      rows = key
        ? this.#sql.exec('SELECT a.* FROM content_announcements a JOIN content_games g ON g.game_id=a.game_id WHERE g.listed=1 AND (a.first_online_at<? OR (a.first_online_at=? AND a.announcement_id<?)) ORDER BY a.first_online_at DESC,a.announcement_id DESC LIMIT 31', key.t, key.t, key.id).toArray()
        : this.#firstPage();
    } else {
      rows = this.#firstPage();
    }
    const page = rows.slice(0, 30);
    const last = page.at(-1);
    return Object.freeze({
      revision: rev,
      announcements: Object.freeze(page.map(r => this.#dto(r))),
      nextCursor: rows.length > 30 && last ? Buffer.from(JSON.stringify({ t: last.first_online_at, id: last.announcement_id, rev })).toString('base64url') : null,
    });
  }
  #firstPage() {
    return this.#sql.exec('SELECT a.* FROM content_announcements a JOIN content_games g ON g.game_id=a.game_id WHERE g.listed=1 ORDER BY a.first_online_at DESC,a.announcement_id DESC LIMIT 31').toArray();
  }
  #dto(row) {
    return Object.freeze({ announcementId: row.announcement_id, gameId: row.game_id, releaseId: row.release_id, ordinal: row.ordinal, name: row.name, creatorAccount: row.creator_account, publishedAt: row.published_at, firstOnlineAt: row.first_online_at });
  }
}
