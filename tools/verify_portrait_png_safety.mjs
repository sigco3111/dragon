// PNG library boundary: real Node SQLite + workerd SQLite DO, synthetic actors,
// and independently installed Pillow. No source/R2/auth/Trial/UI/full-App claim.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync, crc32 } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { GamePortraits, PORTRAIT_MAX_BYTES } from '../server/portraits.js';
import { HttpError } from '../server/security.js';

const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const out = `.dragon-analysis/editor-phase/portrait-png-safety-r1/attempt${round}`;
mkdirSync(out); // Fail rather than overwrite failed or sealed evidence.
const inputs = ['server/portraits.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/security.js', 'server/wrangler.jsonc', 'tools/fixtures/portrait_png_worker.mjs', 'tools/verify_portrait_png_safety.mjs', 'tools/verify_portrait_png_oracle.py'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {};
for (const [index, path] of inputs.entries()) {
  const bytes = readFileSync(path); pins[path] = sha(bytes);
  writeFileSync(`${out}/input-${index}.txt`, bytes, { flag: 'wx' });
}
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function chunk(kind, bytes) {
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(kind), bytes]);
  size.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, checksum]);
}
function header(type = 6, depth = 8, width = 128, height = 128, interlace = 0) {
  const h = Buffer.alloc(13); h.writeUInt32BE(width); h.writeUInt32BE(height, 4); h[8] = depth; h[9] = type; h[12] = interlace; return h;
}
function png(h, raw, prefix = [], tail = [], compressed = deflateSync(raw)) {
  return Buffer.concat([signature, chunk('IHDR', h), ...prefix, chunk('IDAT', compressed), ...tail, chunk('IEND', Buffer.alloc(0))]);
}
// Independent fixture encoder, not the production decoder/filter implementation.
function filters(rows, bpp) {
  const raw = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y], prior = rows[y - 1], filter = y % 5; raw.push(filter);
    for (let x = 0; x < row.length; x++) {
      const a = row[x - bpp] ?? 0, b = prior?.[x] ?? 0, c = prior?.[x - bpp] ?? 0;
      const predictors = [0, a, b, Math.floor((a + b) / 2), [a, b, c].map((n, i) => ({ n, i, distance: Math.abs(a + b - c - n) })).sort((l, r) => l.distance - r.distance || l.i - r.i)[0].n];
      raw.push((row[x] - predictors[filter]) & 255);
    }
  }
  return Buffer.from(raw);
}
const positives = [], oracleFiles = [], oracleExpected = [], checks = [], calls = [];
function fixture(bytes, pixelSha) {
  const path = `${out}/fixture-${oracleFiles.length}.png`; writeFileSync(path, bytes, { flag: 'wx' }); oracleFiles.push(path); oracleExpected.push(pixelSha);
}
for (const [type, depth] of [[0, 8], [2, 8], [3, 1], [3, 2], [3, 4], [3, 8], [4, 8], [6, 8]]) {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], rows = [], pixels = [], prefix = [];
  const palette = Buffer.from(Array.from({ length: 3 * 2 ** depth }, (_, i) => (i * 11) % 256));
  const alpha = Buffer.from(Array.from({ length: 2 ** depth }, (_, i) => (i * 17) % 256));
  if (type === 3) { prefix.push(chunk('PLTE', palette), chunk('tRNS', alpha)); }
  if (type === 0) { prefix.push(chunk('tRNS', Buffer.from([0, 0]))); }
  if (type === 2) { prefix.push(chunk('tRNS', Buffer.from([0, 0, 0, 1, 0, 2]))); }
  for (let y = 0; y < 128; y++) {
    const row = Buffer.alloc(128 * channels * depth / 8);
    for (let x = 0; x < 128; x++) {
      const sample = (x + y * 3) % 256;
      if (type === 3) {
        const index = sample % 2 ** depth, bit = x * depth;
        row[bit >>> 3] |= index << (8 - depth - (bit & 7)); pixels.push(...palette.subarray(index * 3, index * 3 + 3), alpha[index]);
      } else if (type === 0 || type === 4) {
        row[x * channels] = sample; if (type === 4) { row[x * channels + 1] = (x * 5 + y) % 256; }
        let opacity = sample === 0 ? 0 : 255;
        if (type === 4) { opacity = row[x * channels + 1]; }
        pixels.push(sample, sample, sample, opacity);
      } else {
        const rgb = [sample, (sample + 1) % 256, (sample + 2) % 256]; row.set(rgb, x * channels);
        if (type === 6) { row[x * channels + 3] = (x * 5 + y) % 256; }
        let opacity = sample === 0 ? 0 : 255;
        if (type === 6) { opacity = row[x * channels + 3]; }
        pixels.push(...rgb, opacity);
      }
    }
    rows.push(row);
  }
  const bytes = png(header(type, depth), filters(rows, Math.ceil(channels * depth / 8)), prefix), pixelSha = sha(Buffer.from(pixels));
  positives.push({ name: `type${type}-depth${depth}`, bytes, pixelSha }); fixture(bytes, pixelSha);
}
const base = positives.at(-1), raw = Buffer.alloc((128 * 4 + 1) * 128);
const metadata = png(header(), raw, [chunk('tEXt', Buffer.from('Comment\0<script>not executable</script>')), chunk('eXIf', Buffer.from('49492a0008000000000000000000', 'hex'))]);
positives.push({ name: 'metadata-stripped', bytes: metadata, pixelSha: sha(Buffer.alloc(128 * 128 * 4)) }); fixture(metadata, positives.at(-1).pixelSha);
const padding = PORTRAIT_MAX_BYTES - png(header(), raw).length - 12;
const boundary = png(header(), raw, [chunk('tEXt', Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(padding - 8, 65)]))]);
assert.equal(boundary.length, PORTRAIT_MAX_BYTES);
positives.push({ name: 'exact-100KiB-input', bytes: boundary, pixelSha: sha(Buffer.alloc(128 * 128 * 4)) }); fixture(boundary, positives.at(-1).pixelSha);
const negatives = [];
const invalid = (name, bytes, code = 'PORTRAIT_PNG_INVALID') => negatives.push({ name, bytes, code });
const broken = Buffer.from(base.bytes); broken[29] ^= 1;
invalid('header-without-pixels', base.bytes.subarray(0, 24)); invalid('crc', broken);
invalid('truncated', base.bytes.subarray(0, -1)); invalid('trailing-html', Buffer.concat([base.bytes, Buffer.from('<html>bad</html>')]));
invalid('missing-iend', base.bytes.subarray(0, -12)); invalid('empty-idat', png(header(), raw, [], [], Buffer.alloc(0)));
invalid('short-scanlines', png(header(), raw.subarray(0, -1))); invalid('long-scanlines', png(header(), Buffer.alloc(raw.length + 1)));
invalid('inflate-bomb', png(header(), Buffer.alloc(1024 * 1024)));
const badFilter = Buffer.from(raw); badFilter[0] = 5; invalid('filter', png(header(), badFilter));
invalid('deflate-trailing', png(header(), raw, [], [], Buffer.concat([deflateSync(raw), Buffer.from([1])])));
invalid('second-zlib', png(header(), raw, [], [], Buffer.concat([deflateSync(raw), deflateSync(raw)])));
const badAdler = deflateSync(raw); badAdler.set([badAdler.at(-1) ^ 1], badAdler.length - 1); invalid('adler', png(header(), raw, [], [], badAdler));
invalid('duplicate-ihdr', png(header(), raw, [chunk('IHDR', header())]));
invalid('unknown-critical', png(header(), raw, [chunk('ABCD', Buffer.alloc(0))]));
invalid('chunk-reserved-bit', png(header(), raw, [chunk('abca', Buffer.alloc(0))]));
for (const kind of ['acTL', 'fcTL', 'fdAT', 'iCCP', 'gAMA', 'cHRM', 'cICP', 'mDCV', 'cLLI']) { invalid(kind, png(header(), raw, [chunk(kind, Buffer.alloc(32))])); }
invalid('interlace', png(header(6, 8, 128, 128, 1), raw)); invalid('depth16', png(header(6, 16), raw));
invalid('no-palette', png(header(3, 1), Buffer.alloc(128 * 17)));
invalid('bad-palette-index', png(header(3, 8), Buffer.alloc(128 * 129, 1), [chunk('PLTE', Buffer.from([1, 2, 3]))]));
invalid('chunk-budget', png(header(), raw, Array.from({ length: 4096 }, () => chunk('tEXt', Buffer.from('a\0b')))));
invalid('large-dimensions-before-inflate', png(header(6, 8, 8192, 8192), raw), 'PORTRAIT_DIMENSIONS');
invalid('zero-dimensions', png(header(6, 8, 0, 128), raw), 'PORTRAIT_DIMENSIONS');
invalid('wrong-output-size', png(header(6, 8, 64, 128), raw), 'PORTRAIT_DIMENSIONS');
invalid('input-budget', Buffer.alloc(PORTRAIT_MAX_BYTES + 1), 'PORTRAIT_BYTES');
invalid('empty', Buffer.alloc(0), 'PORTRAIT_BYTES'); invalid('svg', Buffer.from('<svg></svg>'), 'PORTRAIT_TYPE');
// JPEG follow-up now closes this fake-header upload hole; old sealed rounds
// remain historical. This negative still does not certify all JPEG safety.
const jpegHeader = Buffer.from('ffd8ffc00008080080008001', 'hex');
const gameId = '11111111-1111-4111-8111-111111111111';
const db = new DatabaseSync(':memory:');
const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
db.exec('CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL)'); db.prepare('INSERT INTO content_games VALUES(?,?)').run(gameId, 'owner');
const library = new GamePortraits({ storage, principal: actor => { if (actor === 'invalid') { throw new HttpError(401, 'SESSION_INVALID'); } return { id: actor === 'foreign' ? 'foreign' : 'owner', must_change: actor === 'change' }; }, reservedIds: ['terrain'] });
const snapshot = () => db.prepare('SELECT * FROM game_portraits ORDER BY asset_id').all().map(row => ({ ...row, bytes: sha(row.bytes) }));
function nodeUpload(input) {
  const before = snapshot();
  try {
    const entry = library.upload(input.actor ?? 'owner', input.gameId ?? gameId, input.assetId, Buffer.from(input.dataBase64, 'base64'));
    const stored = library.forPublish(gameId).find(row => row.assetId === entry.assetId);
    return { status: 200, body: { entry, stored: { ...stored, bytes: Buffer.from(stored.bytes).toString('base64') }, before, after: snapshot() } };
  } catch (error) { if (!(error instanceof HttpError)) { throw error; } return { status: error.status, body: { error: error.code, before, after: snapshot() } }; }
}
const parse = bytes => { try { return JSON.parse(bytes); } catch (cause) { throw new Error('owned portrait safety JSON', { cause }); } };
let mf;
try {
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href), config = parse(readFileSync('server/wrangler.jsonc'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }], scriptPath: resolve('tools/fixtures/portrait_png_worker.mjs'), compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags, durableObjects: { PORTRAIT_PNG: { className: 'PortraitPNGFixture', useSQLite: true } }, host: '127.0.0.1', port: 0 });
  const origin = await mf.ready;
  async function workerUpload(input) {
    const response = await fetch(origin, { method: 'POST', body: JSON.stringify(input) });
    const body = parse(await response.text()); calls.push({ assetId: input.assetId, status: response.status }); return { status: response.status, body };
  }
  let index = 0;
  const assetId = () => 'Image' + String.fromCharCode(65 + Math.floor(index / 26), 65 + index++ % 26);
  for (const test of positives) {
    const input = { assetId: assetId(), dataBase64: test.bytes.toString('base64') };
    const node = nodeUpload(input), worker = await workerUpload(input); assert.deepEqual(worker, node, test.name); assert.equal(node.status, 200);
    const { entry, stored } = node.body, bytes = Buffer.from(stored.bytes, 'base64');
    assert.equal(entry.sha256, sha(bytes)); assert.equal(entry.byteLength, bytes.length); assert.ok(bytes.length <= PORTRAIT_MAX_BYTES); assert.equal(entry.mime, 'image/png');
    const kinds = []; for (let at = 8; at < bytes.length; at += bytes.readUInt32BE(at) + 12) { kinds.push(bytes.toString('ascii', at + 4, at + 8)); }
    assert.deepEqual(kinds, ['IHDR', 'IDAT', 'IEND']); assert.equal(node.body.after.length, node.body.before.length + 1);
    if (test.name.includes('metadata') || test.name.includes('100KiB')) { assert.notEqual(sha(bytes), sha(test.bytes)); }
    fixture(bytes, test.pixelSha); fixture(Buffer.from(worker.body.stored.bytes, 'base64'), test.pixelSha); checks.push(test.name);
  }
  for (const test of negatives) {
    const input = { assetId: assetId(), dataBase64: test.bytes.toString('base64') }, node = nodeUpload(input), worker = await workerUpload(input);
    assert.deepEqual(worker, node, test.name); assert.equal(node.status, 422, test.name); assert.equal(node.body.error, test.code, test.name); assert.deepEqual(node.body.before, node.body.after, test.name); checks.push('reject-' + test.name);
  }
  for (const [name, extra, code, status] of [['foreign-before-decode', { actor: 'foreign' }, 'GAME_NOT_FOUND', 404], ['change-before-decode', { actor: 'change' }, 'PASSWORD_CHANGE_REQUIRED', 403], ['invalid-before-decode', { actor: 'invalid' }, 'SESSION_INVALID', 401], ['builtin-before-decode', { gameId: 'wolong-builtin' }, 'BUILTIN_PROTECTED', 403], ['reserved-before-decode', { assetId: 'terrain' }, 'PORTRAIT_RESERVED', 422], ['duplicate-before-decode', { assetId: 'ImageAA' }, 'PORTRAIT_EXISTS', 409]]) {
    const input = { assetId: assetId(), dataBase64: base.bytes.subarray(0, 24).toString('base64'), ...extra }, node = nodeUpload(input), worker = await workerUpload(input);
    assert.deepEqual(worker, node); assert.equal(node.status, status); assert.equal(node.body.error, code); assert.deepEqual(node.body.before, node.body.after); checks.push(name);
  }
  const legacy = { assetId: assetId(), dataBase64: jpegHeader.toString('base64') }, node = nodeUpload(legacy), worker = await workerUpload(legacy);
  assert.deepEqual(worker, node); assert.equal(node.status, 422); assert.equal(node.body.error, 'PORTRAIT_JPEG_INVALID'); assert.deepEqual(node.body.before, node.body.after); checks.push('jpeg-fake-header-rejected-after-followup');
  const env = {}, allowedEnv = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata', 'homedrive', 'homepath']);
  for (const [key, value] of Object.entries(process.env)) { if (allowedEnv.has(key.toLowerCase())) { env[key] = value; } }
  env.PYTHONUTF8 = '1'; env.PYTHONDONTWRITEBYTECODE = '1';
  const oracle = spawnSync('python', ['-B', 'tools/verify_portrait_png_oracle.py'], { input: JSON.stringify(oracleFiles), encoding: 'utf8', env, timeout: 60000 });
  writeFileSync(`${out}/oracle.stderr`, oracle.stderr, { flag: 'wx' }); writeFileSync(`${out}/oracle.json`, oracle.stdout, { flag: 'wx' }); assert.equal(oracle.status, 0, oracle.stderr);
  const reference = parse(oracle.stdout); assert.equal(reference.results.length, oracleExpected.length);
  reference.results.forEach((record, i) => assert.equal(record.pixelSha, oracleExpected[i], record.path)); checks.push('independent-Pillow-all-input-and-stored-pixels');
  for (const [path, hash] of Object.entries(pins)) { assert.equal(sha(readFileSync(path)), hash, path); }
  const report = { result: 'PASS-PORTRAIT-PNG-LIBRARY-SLICE', checks, calls, pins, positives: positives.length, negatives: negatives.length, oracleImages: oracleFiles.length, limits: 'GamePortraits PNG only. Node/workerd real SQLite with synthetic actors and fixture game rows, NOT real worker routing/auth/UI/R2/publish/App. JPEG uses its separate bounded supported-subset follow-up; Trial raw uploads unchanged and unsafe; process sandbox/color-management/interlace/16bit not supplied. No npm runtime dependency, deployment, user profiles, SAVE or rule changes.' };
  writeFileSync(`${out}/receipt.json`, JSON.stringify(report, null, 2), { flag: 'wx' }); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  writeFileSync(`${out}/failure.json`, JSON.stringify({ error: error.message, stack: error.stack, checks, calls, pins }, null, 2), { flag: 'wx' }); throw error;
} finally { db.close(); await mf?.dispose(); }
