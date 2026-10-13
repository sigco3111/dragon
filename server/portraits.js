// Game-level portrait library (§4.3/Q37): uploaded portraits enter the owning
// game's resource library, reusable by many generals of that game, never
// shared across games. Draft save binds portraitKey; bytes live here (outside
// the fixed-copy source, like trial uploads). Publish freezes them into the
// pack; serve-time sha+mime rechecked. PNG: bounded full decode and canonical
// RGBA re-encode at the existing 128×128 boundary. Supported JPEG inputs also
// decode/re-encode to PNG; this does NOT supply process isolation or Trial safety.
import { createHash } from 'node:crypto';
import { decodePNG, encodePNG, PNGError } from './pngio.js';
import { decodePortraitJPEG, PortraitJPEGError } from './portraitjpeg.js';
import { fail } from './security.js';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sha = b => createHash('sha256').update(b).digest('hex');
export const PORTRAIT_MAX_BYTES = 100 * 1024;
export const PORTRAIT_SIZE = 128;
const ID = /^[A-Za-z]{1,32}$/;
export function sniffPortraitMime(bytes) {
  if (bytes instanceof Uint8Array && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) { return 'image/png'; }
  if (bytes instanceof Uint8Array && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) { return 'image/jpeg'; }
  return null;
}
// Header-only dimensions (never decode pixels): PNG IHDR width/height BE at
// 16..23; JPEG scans segments for SOF0/1/2 (height/width BE after precision).
export function portraitDimensions(bytes) {
  if (!(bytes instanceof Uint8Array)) { return null; }
  const mime = sniffPortraitMime(bytes);
  if (mime === 'image/png') {
    if (bytes.length < 24) { return null; }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(12) < 13 || String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') { return null; }
    return { mime, width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === 'image/jpeg') {
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 0xff) { return null; }
      const marker = bytes[at + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
      if (at + 4 > bytes.length) { return null; }
      const length = (bytes[at + 2] << 8) | bytes[at + 3];
      if (length < 2) { return null; }
      if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && length >= 7 && at + 9 <= bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + at + 4, 5);
        return { mime, width: view.getUint16(3), height: view.getUint16(1) };
      }
      if (marker === 0xda) { return null; }
      at += 2 + length;
    }
    return null;
  }
  return null;
}
export class GamePortraits {
  #sql; #principal; #reserved;
  constructor({ storage, principal, reservedIds = [] }) {
    if (!storage?.sql || typeof principal !== 'function') { throw new TypeError('actual SQLite and trusted principal required'); }
    this.#sql = storage.sql; this.#principal = principal;
    this.#reserved = new Set(reservedIds);
    storage.transactionSync(() => {
      this.#sql.exec('CREATE TABLE IF NOT EXISTS game_portraits (game_id TEXT NOT NULL, asset_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(game_id,asset_id))');
    });
  }
  #one(q, ...v) { return this.#sql.exec(q, ...v).toArray()[0]; }
  #owned(tokenHash, gameId) {
    const actor = this.#principal(tokenHash);
    if (actor.must_change) { fail(403, 'PASSWORD_CHANGE_REQUIRED'); }
    if (gameId === 'wolong-builtin') { fail(403, 'BUILTIN_PROTECTED'); }
    if (!uuid(gameId)) { fail(422, 'PORTRAIT_GAME_ID'); }
    const row = this.#one('SELECT * FROM content_games WHERE game_id=?', gameId);
    if (!row || row.owner_id !== actor.id) { fail(404, 'GAME_NOT_FOUND'); }
    return actor;
  }
  #checkId(assetId) {
    if (typeof assetId !== 'string' || !ID.test(assetId)) { fail(422, 'PORTRAIT_ID'); }
    if (this.#reserved.has(assetId)) { fail(422, 'PORTRAIT_RESERVED'); }
    return assetId;
  }
  upload(tokenHash, gameId, assetId, bytes) {
    this.#owned(tokenHash, gameId);
    this.#checkId(assetId);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > PORTRAIT_MAX_BYTES) { fail(422, 'PORTRAIT_BYTES'); }
    const dims = portraitDimensions(bytes);
    if (!dims) { fail(422, 'PORTRAIT_TYPE'); }
    if (dims.width !== PORTRAIT_SIZE || dims.height !== PORTRAIT_SIZE) { fail(422, 'PORTRAIT_DIMENSIONS'); }
    if (this.#one('SELECT asset_id FROM game_portraits WHERE game_id=? AND asset_id=?', gameId, assetId)) { fail(409, 'PORTRAIT_EXISTS'); }
    let stored = Buffer.from(bytes), mime = dims.mime;
    if (dims.mime === 'image/png') {
      try {
        // Dimensions were checked before inflation; at most 128×128 RGBA samples.
        // The shared adapter checks CRC/order, exact zlib consumption and output
        // length, and rejects animation/unsupported profiles. Only pixels leave
        // this boundary: no uploaded ancillary chunks or trailing bytes persist.
        const decoded = decodePNG(stored);
        stored = encodePNG(decoded.pixels, decoded.width, decoded.height);
      } catch (error) {
        if (!(error instanceof PNGError)) { throw error; }
        fail(422, 'PORTRAIT_PNG_INVALID');
      }
    } else {
      try {
        const decoded = decodePortraitJPEG(stored);
        stored = encodePNG(decoded.pixels, decoded.width, decoded.height);
        mime = 'image/png';
      } catch (error) {
        if (!(error instanceof PortraitJPEGError)) { throw error; }
        fail(422, 'PORTRAIT_JPEG_INVALID');
      }
    }
    if (stored.length > PORTRAIT_MAX_BYTES) { fail(422, 'PORTRAIT_BYTES'); }
    const digest = sha(stored);
    this.#sql.exec('INSERT INTO game_portraits VALUES(?,?,?,?,?,?,?,?)', gameId, assetId, digest, stored.length, mime, dims.width, dims.height, stored);
    return Object.freeze({ gameId, assetId, sha256: digest, byteLength: stored.length, mime, width: dims.width, height: dims.height });
  }
  list(tokenHash, gameId) {
    this.#owned(tokenHash, gameId);
    return Object.freeze(this.#sql.exec('SELECT asset_id, sha256, byte_length, mime, width, height FROM game_portraits WHERE game_id=? ORDER BY asset_id', gameId).toArray().map(row => Object.freeze({ gameId, assetId: row.asset_id, sha256: row.sha256, byteLength: row.byte_length, mime: row.mime, width: row.width, height: row.height })));
  }
  // Removal refuses while the current draft binds the key (usedKeys from the
  // draft read receipt). Older revisions fall back to kao by design.
  remove(tokenHash, gameId, assetId, usedKeys = []) {
    this.#owned(tokenHash, gameId);
    this.#checkId(assetId);
    const row = this.#one('SELECT asset_id FROM game_portraits WHERE game_id=? AND asset_id=?', gameId, assetId);
    if (!row) { return Object.freeze({ gameId, assetId, removed: false }); }
    if (Array.isArray(usedKeys) && usedKeys.includes(assetId)) { fail(409, 'PORTRAIT_IN_USE'); }
    this.#sql.exec('DELETE FROM game_portraits WHERE game_id=? AND asset_id=?', gameId, assetId);
    return Object.freeze({ gameId, assetId, removed: true });
  }
  // Publish-time freeze: full rows incl. bytes, sha rechecked at serve time.
  forPublish(gameId) {
    return Object.freeze(this.#sql.exec('SELECT asset_id, sha256, byte_length, mime, bytes FROM game_portraits WHERE game_id=? ORDER BY asset_id', gameId).toArray().map(row => Object.freeze({ assetId: row.asset_id, sha256: row.sha256, byteLength: row.byte_length, mime: row.mime, bytes: row.bytes })));
  }
}
