// 共用画像庫讀取器（B 決策，V2 簡化）：禁上傳，武將一對一取自 `web/kao`
// manifest（620 PNG，lane 核磁碟一致）。發版只記 ID＋SHA，玩家經 R2
// `kao/<file>` 取數；pack 不嵌位元組。無 SQL 表、無解碼、無上傳管線。
import { KAO_MANIFEST } from '../web/kao/manifest.js';
import { fail } from './security.js';

const BY_ID = new Map(KAO_MANIFEST.map(entry => [entry.id, entry]));
const LIST = Object.freeze(KAO_MANIFEST.map(entry => Object.freeze({
  assetId: entry.id, sha256: entry.sha256, byteLength: entry.bytes, mime: 'image/png',
})));

export class GamePortraits {
  #reserved;
  constructor({ reservedIds = [] } = {}) {
    if (!Array.isArray(reservedIds)) { throw new TypeError('reserved id list required'); }
    this.#reserved = new Set(reservedIds);
  }
  list() { return LIST; }
  get(assetId) {
    const entry = BY_ID.get(assetId);
    if (!entry || this.#reserved.has(assetId)) { fail(404, 'PORTRAIT_NOT_FOUND'); }
    return Object.freeze({ assetId: entry.id, sha256: entry.sha256, byteLength: entry.bytes, mime: 'image/png' });
  }
  // 發版凍結：只收錄本局實際使用的 ID（數字 byte 轉字串＋portraitKey），
  // 無位元組；serve 端經 R2 取數時以 sha256 核對。
  forPublish(usedIds) {
    if (!Array.isArray(usedIds)) { fail(500, 'PLAY_PORTRAIT_CORRUPT'); }
    const seen = new Set(), rows = [];
    for (const rawId of usedIds) {
      const assetId = typeof rawId === 'number' ? String(rawId) : rawId;
      // Trial sentinel 255 = intentional blank (trials.js gap exclusion),
      // never bundled, never failed. Other unknowns fail closed.
      if (assetId === '255') { continue; }
      if (typeof assetId !== 'string' || seen.has(assetId)) { continue; }
      seen.add(assetId);
      rows.push(this.get(assetId));
    }
    return Object.freeze(rows);
  }
}
