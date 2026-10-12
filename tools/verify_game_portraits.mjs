// B4e game portrait library unit: mime/dimensions parse + upload/list/remove
// validation (id/mime/size/128×128/reserved/dup/in-use/missing/ownership).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { GamePortraits, sniffPortraitMime, portraitDimensions, PORTRAIT_MAX_BYTES } from '../server/portraits.js';

function makeStorage() {
  const db = new DatabaseSync(':memory:');
  const sql = { exec: (q, ...v) => { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } };
  const transactionSync = fn => { db.exec('BEGIN'); try { const out = fn(); db.exec('COMMIT'); return out; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  return { sql, transactionSync, db };
}
// Minimal PNG: sig + IHDR(len 13, w, h) — no IDAT needed for header parse.
const png = (w, h) => {
  const head = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0);
  head.writeUInt32BE(13, 8);
  head.write('IHDR', 12);
  head.writeUInt32BE(w, 16); head.writeUInt32BE(h, 20);
  return new Uint8Array(head);
};
// Minimal JPEG: SOI + APP0 + SOF0 (precision, h, w).
const jpeg = (w, h) => {
  const head = Buffer.alloc(2 + 2 + 16 + 2 + 7);
  let at = 0;
  head[at++] = 0xff; head[at++] = 0xd8;
  head[at++] = 0xff; head[at++] = 0xe0; head[at++] = 0x00; head[at++] = 0x10;
  at += 14; // APP0 body skipped
  head[at++] = 0xff; head[at++] = 0xc0; head[at++] = 0x00; head[at++] = 0x08; head[at++] = 0x08;
  head.writeUInt16BE(h, at); at += 2; head.writeUInt16BE(w, at); at += 2; head[at++] = 0x01;
  return new Uint8Array(head);
};
const gif = () => new Uint8Array(Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(32)]));

const checks = [];
const check = (name, fn, code) => {
  try { fn(); assert.fail(`expected throw ${name}`); }
  catch (error) { assert.equal(error.code, code, `${name}: ${error.code}`); checks.push(name); }
};

// Pure parse.
assert.equal(sniffPortraitMime(png(128, 128)), 'image/png');
assert.equal(sniffPortraitMime(jpeg(128, 128)), 'image/jpeg');
assert.equal(sniffPortraitMime(gif()), null);
assert.deepEqual(portraitDimensions(png(128, 128)), { mime: 'image/png', width: 128, height: 128 });
assert.deepEqual(portraitDimensions(png(64, 128)), { mime: 'image/png', width: 64, height: 128 });
assert.deepEqual(portraitDimensions(jpeg(128, 128)), { mime: 'image/jpeg', width: 128, height: 128 });
assert.equal(portraitDimensions(gif()), null);
assert.equal(portraitDimensions(new Uint8Array([0xff, 0xd8, 0xff])), null);
checks.push('parse');

// Store flow.
const storage = makeStorage();
const owner = randomUUID(), other = randomUUID(), gameId = randomUUID();
storage.db.exec('CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL)');
storage.db.prepare('INSERT INTO content_games VALUES(?,?)').run(gameId, owner);
const principal = (id) => () => ({ id, epoch: 1, must_change: 0 });
const portraits = new GamePortraits({ storage, principal: principal(owner), reservedIds: ['terrain', 'minimapBase'] });
const up = portraits.upload('tok', gameId, 'Zhaoyun', png(128, 128));
assert.equal(up.mime, 'image/png');
assert.equal(up.width, 128);
checks.push('upload-png');
portraits.upload('tok', gameId, 'Zhaojun', jpeg(128, 128));
checks.push('upload-jpeg');
check('bad-id', () => portraits.upload('tok', gameId, 'has space', png(128, 128)), 'PORTRAIT_ID');
check('reserved', () => portraits.upload('tok', gameId, 'terrain', png(128, 128)), 'PORTRAIT_RESERVED');
check('bad-type', () => portraits.upload('tok', gameId, 'Gif', gif()), 'PORTRAIT_TYPE');
check('bad-dims', () => portraits.upload('tok', gameId, 'Small', png(64, 64)), 'PORTRAIT_DIMENSIONS');
check('too-big', () => portraits.upload('tok', gameId, 'Big', new Uint8Array(PORTRAIT_MAX_BYTES + 1)), 'PORTRAIT_BYTES');
check('dup', () => portraits.upload('tok', gameId, 'Zhaoyun', png(128, 128)), 'PORTRAIT_EXISTS');
check('builtin', () => portraits.upload('tok', 'wolong-builtin', 'Zhaoyun', png(128, 128)), 'BUILTIN_PROTECTED');
const foreign = new GamePortraits({ storage, principal: principal(other), reservedIds: [] });
check('not-owner', () => foreign.upload('tok', gameId, 'Other', png(128, 128)), 'GAME_NOT_FOUND');
const list = portraits.list('tok', gameId);
assert.equal(list.map(e => e.assetId).join(','), 'Zhaojun,Zhaoyun');
checks.push('list');
check('in-use', () => portraits.remove('tok', gameId, 'Zhaoyun', ['Zhaoyun']), 'PORTRAIT_IN_USE');
const gone = portraits.remove('tok', gameId, 'Zhaoyun', ['Zhaojun']);
assert.equal(gone.removed, true);
const missing = portraits.remove('tok', gameId, 'Nobody', []);
assert.equal(missing.removed, false);
checks.push('remove');
const rows = portraits.forPublish(gameId);
assert.equal(rows.length, 1);
assert.ok(rows[0].bytes instanceof Uint8Array);
checks.push('for-publish');
process.stdout.write(`portrait unit PASS ${checks.length} checks\n`);
