// Fixed JPEG candidate/library slice: synthetic game/actors, actual Node and
// workerd SQLite. Not public auth/API/R2/App or JPEG Part-2 conformance.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { GamePortraits } from '../server/portraits.js';
import { decodePortraitJPEG, preflightPortraitJPEG, PortraitJPEGError } from '../server/portraitjpeg.js';
import { encodePNG, decodePNG } from '../server/pngio.js';
import { HttpError } from '../server/security.js';

const [round, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.ok(['candidate', 'library'].includes(mode));
const out = `.dragon-analysis/editor-phase/portrait-jpeg-candidate-r1/attempt${round}`; mkdirSync(out);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => { try { return JSON.parse(bytes); } catch (cause) { throw new Error('owned JPEG fixture JSON', { cause }); } };
const inputs = ['server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/vendor/jpeg-js/LICENSE-BSD-3-Clause.txt', 'server/vendor/jpeg-js/LICENSE-Apache-2.0.txt', 'server/portraits.js', 'server/pngio.js', 'server/security.js', 'server/wrangler.jsonc', 'tools/fixtures/portrait_jpeg_worker.mjs', 'tools/verify_portrait_jpeg_safety.mjs', 'tools/verify_portrait_jpeg_oracle.py', '.dragon-analysis/editor-phase/portrait-jpeg-path-r1/candidate-decoder.txt'];
const pins = {};
for (const [index, path] of inputs.entries()) { const bytes = readFileSync(path); pins[path] = sha(bytes); writeFileSync(`${out}/input-${index}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {}, allowed = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata', 'homedrive', 'homepath']);
for (const [key, value] of Object.entries(process.env)) { if (allowed.has(key.toLowerCase())) { env[key] = value; } }
env.PYTHONUTF8 = '1'; env.PYTHONDONTWRITEBYTECODE = '1';
const segment = (kind, data) => { const head = Buffer.from([255, kind, 0, 0]); head.writeUInt16BE(data.length + 2, 2); return Buffer.concat([head, data]); };
const sos = (components, ss = 0, se = 63, aa = 0) => segment(0xda, Buffer.from([components, ...Array.from({ length: components }, (_, i) => [i + 1, 0]).flat(), ss, se, aa]));
function coded(bits) {
  const padded = bits.padEnd(Math.ceil(bits.length / 8) * 8, '1'), bytes = [];
  for (let at = 0; at < padded.length; at += 8) { const byte = Number.parseInt(padded.slice(at, at + 8), 2); bytes.push(byte); if (byte === 255) { bytes.push(0); } }
  return Buffer.from(bytes);
}
function manual({ progressive = false, extended = false, restart = 0, components = 1, ac = 0, refine = false, spectralBands = false, bitUnit } = {}) {
  let frameMarker = 0xc0;
  if (progressive) { frameMarker = 0xc2; } else if (extended) { frameMarker = 0xc1; }
  const sof = segment(frameMarker, Buffer.from([8, 0, 128, 0, 128, components, ...Array.from({ length: components }, (_, i) => [i + 1, 0x11, 0]).flat()]));
  const dqt = segment(0xdb, Buffer.from([0, ...Array(64).fill(1)]));
  const dht = segment(0xc4, Buffer.from([0, 1, ...Array(15).fill(0), 0, 0x10, 1, ...Array(15).fill(0), ac]));
  const scan = (head, unit) => {
    const pieces = [head], size = restart || 256; let rst = 0;
    for (let done = 0; done < 256; done += size) { pieces.push(coded(unit.repeat(Math.min(size, 256 - done)))); if (done + size < 256) { pieces.push(Buffer.from([255, 0xd0 + (rst++ & 7)])); } }
    return pieces;
  };
  const pieces = [Buffer.from([255, 0xd8]), dqt, sof, dht];
  if (restart) { const ri = Buffer.alloc(2); ri.writeUInt16BE(restart); pieces.push(segment(0xdd, ri)); }
  if (progressive) {
    pieces.push(...scan(sos(components, 0, 0, refine ? 1 : 0), '0'.repeat(components)));
    if (refine) { pieces.push(...scan(sos(components, 0, 0, 0x10), '0'.repeat(components))); }
    if (spectralBands) { for (let band = 1; band <= 63; band++) { pieces.push(...scan(sos(1, band, band), '0')); } }
    else { pieces.push(...scan(sos(1, 1, 63), bitUnit ?? '0')); }
  } else { pieces.push(...scan(sos(components), bitUnit ?? '00'.repeat(components))); }
  pieces.push(Buffer.from([255, 0xd9])); return Buffer.concat(pieces);
}
function headers(bytes) {
  const records = []; let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 255) { at++; continue; }
    if (bytes[at + 1] === 0 || (bytes[at + 1] >= 0xd0 && bytes[at + 1] <= 0xd7)) { at += 2; continue; }
    if (bytes[at + 1] === 0xd9) { break; }
    const size = bytes.readUInt16BE(at + 2); records.push({ at, kind: bytes[at + 1], end: at + size + 2 }); at += size + 2;
  }
  return records;
}
const checks = [], calls = [], references = [], diagnostics = [], pillowChecks = [];
let mf, db;
try {
  const oracle = spawnSync('python', ['-B', 'tools/verify_portrait_jpeg_oracle.py', out], { env, encoding: 'utf8', timeout: 60000 });
  writeFileSync(`${out}/oracle.stdout`, oracle.stdout, { flag: 'wx' }); writeFileSync(`${out}/oracle.stderr`, oracle.stderr, { flag: 'wx' }); assert.equal(oracle.status, 0, oracle.stderr);
  const reference = parse(oracle.stdout), positives = reference.records.map(record => ({ name: `${record.mode}-${record.progressive}-${record.subsampling}-${record.pattern}`, bytes: readFileSync(record.path), reference: readFileSync(record.reference), exact: record.pattern === 'neutral-blocks' }));
  for (const options of [{}, { extended: true }, { progressive: true }, { progressive: true, refine: true }, { progressive: true, spectralBands: true }, { restart: 1 }, { restart: 7 }, { restart: 256 }, { restart: 500 }, { components: 3, restart: 7 }]) {
    const pixels = Buffer.from(Array.from({ length: 128 * 128 }, () => [128, 128, 128, 255]).flat()); positives.push({ name: 'manual-' + JSON.stringify(options), bytes: manual(options), reference: pixels, exact: true, upstreamRemainderBug: Boolean(options.restart && 256 % options.restart && !options.components) });
  }
  const plain = manual(), progressive = manual({ progressive: true }), metadata = Buffer.concat([plain.subarray(0, 2), segment(0xe1, Buffer.from('Exif\0\0II*\0strip me')), segment(0xfe, Buffer.from('<script>metadata only</script>')), plain.subarray(2)]);
  positives.push({ ...positives.at(-10), name: 'metadata-stripped', bytes: metadata });
  const padding = 100 * 1024 - plain.length - 4, boundary = Buffer.concat([plain.subarray(0, 2), segment(0xe1, Buffer.alloc(50000)), segment(0xe3, Buffer.alloc(padding - 50004)), plain.subarray(2)]);
  assert.equal(boundary.length, 100 * 1024); positives.push({ ...positives.at(-1), name: 'exact-input-budget', bytes: boundary });
  // Trusted fixed upstream arithmetic oracle: ESM adaptation only, never run on negative/untrusted data.
  const upstream = readFileSync(inputs.at(-1), 'utf8'); assert.equal(sha(Buffer.from(upstream)), 'a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f');
  const exportBlock = "if (typeof module !== 'undefined') {\n\tmodule.exports = decode;\n} else if (typeof window !== 'undefined') {\n\twindow['jpeg-js'] = window['jpeg-js'] || {};\n\twindow['jpeg-js'].decode = decode;\n}";
  assert.equal(upstream.split(exportBlock).length, 2); writeFileSync(`${out}/trusted-upstream.mjs`, upstream.replace(exportBlock, 'export { decode };'), { flag: 'wx' });
  const { decode: original } = await import(pathToFileURL(resolve(`${out}/trusted-upstream.mjs`)).href);
  const negatives = [], invalid = (name, bytes) => negatives.push({ name, bytes });
  invalid('fake-header-no-pixels', Buffer.from('ffd8ffc00008080080008001', 'hex')); invalid('truncated', plain.subarray(0, -1)); invalid('missing-eoi', plain.subarray(0, -2)); invalid('tail-html', Buffer.concat([plain, Buffer.from('<html>')])); invalid('second-frame', Buffer.concat([plain, plain]));
  const sof = headers(plain).find(r => r.kind === 0xc0), scan = headers(plain).find(r => r.kind === 0xda), dht = headers(plain).find(r => r.kind === 0xc4), dqt = headers(plain).find(r => r.kind === 0xdb);
  function change(name, at, value, bytes = plain) { const altered = Buffer.from(bytes); altered[at] = value; invalid(name, altered); }
  change('zero-height', sof.at + 6, 0); change('wrong-width', sof.at + 8, 64); change('precision12', sof.at + 4, 12); change('four-components', sof.at + 9, 4); change('sampling-zero', sof.at + 11, 0); change('sampling5', sof.at + 11, 0x51); change('q-missing', sof.at + 12, 3); change('q-zero', dqt.at + 5, 0); change('q16bit', dqt.at + 4, 16);
  change('huffman-all-one', dht.at + 5, 2); change('huffman-invalid-dc-symbol', dht.at + 21, 12); change('huffman-invalid-ac-symbol', dht.at + 39, 11); change('huffman-empty', dht.at + 5, 0); change('missing-dc-table', scan.at + 6, 0x10); change('unknown-component', scan.at + 5, 2); change('sequential-ss', scan.end - 3, 1); change('sequential-se', scan.end - 2, 62); change('sequential-ah', scan.end - 1, 0x10); change('unknown-marker', sof.at + 1, 0xc3); change('segment-underflow', sof.at + 3, 1); change('segment-truncated', sof.at + 2, 255);
  invalid('duplicate-frame', Buffer.concat([plain.subarray(0, scan.at), plain.subarray(sof.at, sof.end), plain.subarray(scan.at)])); invalid('entropy-empty', Buffer.concat([plain.subarray(0, scan.end), plain.subarray(-2)])); invalid('entropy-short', Buffer.concat([plain.subarray(0, scan.end), Buffer.alloc(1), plain.subarray(-2)])); invalid('entropy-extra', Buffer.concat([plain.subarray(0, -2), Buffer.from([0]), plain.subarray(-2)])); invalid('unescaped-ff', Buffer.concat([plain.subarray(0, scan.end), Buffer.from([255, 1]), plain.subarray(scan.end)]));
  const ri = manual({ restart: 7 }), firstRST = ri.indexOf(Buffer.from([255, 0xd0])); assert.ok(firstRST > 0);
  change('restart-wrong-order', firstRST + 1, 0xd1, ri); change('restart-bad-padding', firstRST - 1, ri[firstRST - 1] & 0xfc, ri);
  invalid('restart-missing', Buffer.concat([ri.subarray(0, firstRST), ri.subarray(firstRST + 2)])); invalid('restart-extra-final', Buffer.concat([plain.subarray(0, -2), Buffer.from([255, 0xd0]), plain.subarray(-2)]));
  invalid('baseline-run-overflow', manual({ ac: 0xf0, bitUnit: '00000' })); invalid('baseline-nonzero-overflow', manual({ ac: 0xf1, bitUnit: '00101010101' })); invalid('baseline-illegal-eob', manual({ ac: 0x10 }));
  const progressiveScans = headers(progressive).filter(r => r.kind === 0xda), firstScan = progressiveScans[0], secondScan = progressiveScans[1];
  change('progressive-refine-without-first', firstScan.end - 1, 0x10, progressive); change('progressive-se0-invalid', firstScan.end - 2, 1, progressive); change('progressive-ah-al-gap', secondScan.end - 1, 0x20, progressive); change('progressive-band-outside', secondScan.end - 2, 64, progressive);
  const refinePrefix = Buffer.from(progressive.subarray(0, -2)); refinePrefix[secondScan.end - 1] = 1;
  invalid('progressive-refinement-crosses-block', Buffer.concat([refinePrefix, segment(0xc4, Buffer.from([0x10, 1, ...Array(15).fill(0), 0xf0])), sos(1, 1, 63, 0x10), coded('0000'.repeat(256)), Buffer.from([255, 0xd9])]));
  invalid('progressive-incomplete-bands', Buffer.concat([progressive.subarray(0, secondScan.at), Buffer.from([255, 0xd9])])); invalid('progressive-eob-run-overflow', manual({ progressive: true, ac: 0x90, bitUnit: '0000000000' }));
  invalid('icc-profile-unsupported', Buffer.concat([plain.subarray(0, 2), segment(0xe2, Buffer.from('ICC_PROFILE\0data')), plain.subarray(2)])); invalid('mpo-unsupported', Buffer.concat([plain.subarray(0, 2), segment(0xe2, Buffer.from('MPF\0data')), plain.subarray(2)]));
  invalid('scan-budget', manual({ progressive: true, refine: true, spectralBands: true }));
  invalid('segment-budget', Buffer.concat([plain.subarray(0, 2), ...Array.from({ length: 256 }, () => segment(0xfe, Buffer.alloc(0))), plain.subarray(2)])); invalid('input-budget', Buffer.alloc(100 * 1024 + 1));
  const rgbFrame = manual({ components: 3 }), rgbSOF = headers(rgbFrame).find(r => r.kind === 0xc0), rgbSOS = headers(rgbFrame).find(r => r.kind === 0xda);
  change('duplicate-component', rgbSOF.at + 13, 1, rgbFrame); change('too-many-mcu-blocks', rgbSOF.at + 11, 0x44, rgbFrame); change('unordered-sos', rgbSOS.at + 5, 2, rgbFrame);
  change('unknown-colorspace', rgbSOF.at + 16, 7, rgbFrame);
  invalid('quant-redefined-after-scan', Buffer.concat([progressive.subarray(0, secondScan.at), plain.subarray(dqt.at, dqt.end), progressive.subarray(secondScan.at)]));
  invalid('adobe-transform2', Buffer.concat([plain.subarray(0, 2), segment(0xee, Buffer.concat([Buffer.from('Adobe'), Buffer.from([0, 100, 0, 0, 0, 0, 2])])), plain.subarray(2)]));
  const directRGB = Buffer.from(rgbFrame); [82, 71, 66].forEach((id, i) => { directRGB[rgbSOF.at + 10 + i * 3] = id; directRGB[rgbSOS.at + 5 + i * 2] = id; });
  const neutralRGB = Buffer.from(Array.from({ length: 128 * 128 }, () => [128, 128, 128, 255]).flat());
  positives.push({ name: 'direct-rgb-identifiers', bytes: directRGB, reference: neutralRGB, exact: true }); assert.equal(preflightPortraitJPEG(directRGB).colorTransform, false);
  const adobeRGB = Buffer.concat([rgbFrame.subarray(0, 2), segment(0xee, Buffer.concat([Buffer.from('Adobe'), Buffer.from([0, 100, 0, 0, 0, 0, 0])])), rgbFrame.subarray(2)]);
  positives.push({ name: 'adobe-rgb-transform0', bytes: adobeRGB, reference: neutralRGB, exact: true }); assert.equal(preflightPortraitJPEG(adobeRGB).colorTransform, false);
  const gameId = '11111111-1111-4111-8111-111111111111'; db = new DatabaseSync(':memory:');
  const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
  db.exec('CREATE TABLE content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL)'); db.prepare('INSERT INTO content_games VALUES(?,?)').run(gameId, 'owner');
  const library = new GamePortraits({ storage, principal: actor => { if (actor === 'invalid') { throw new HttpError(401, 'SESSION_INVALID'); } return { id: actor === 'foreign' ? 'foreign' : 'owner', must_change: actor === 'change' }; }, reservedIds: ['terrain'] });
  const snapshot = () => db.prepare('SELECT * FROM game_portraits ORDER BY asset_id').all().map(row => ({ ...row, bytes: sha(row.bytes) }));
  function node(input) {
    const before = snapshot();
    try {
      const bytes = Buffer.from(input.dataBase64, 'base64');
      if (mode === 'candidate') { const decoded = decodePortraitJPEG(bytes); return { status: 200, body: { pixelSha: sha(decoded.pixels), png: encodePNG(decoded.pixels, 128, 128).toString('base64'), before, after: snapshot() } }; }
      const entry = library.upload(input.actor ?? 'owner', input.gameId ?? gameId, input.assetId, bytes), stored = library.forPublish(gameId).find(row => row.assetId === entry.assetId);
      return { status: 200, body: { entry, stored: { ...stored, bytes: Buffer.from(stored.bytes).toString('base64') }, before, after: snapshot() } };
    } catch (error) { if (error instanceof PortraitJPEGError) { return { status: 422, body: { error: 'PORTRAIT_JPEG_INVALID', before, after: snapshot() } }; } if (!(error instanceof HttpError)) { throw error; } return { status: error.status, body: { error: error.code, before, after: snapshot() } }; }
  }
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href), config = parse(readFileSync('server/wrangler.jsonc'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }], scriptPath: resolve('tools/fixtures/portrait_jpeg_worker.mjs'), compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags, durableObjects: { PORTRAIT_JPEG: { className: 'PortraitJPEGFixture', useSQLite: true } }, host: '127.0.0.1', port: 0 });
  const origin = await mf.ready;
  async function worker(input) { const response = await fetch(origin, { method: 'POST', body: JSON.stringify(input) }), body = parse(await response.text()); calls.push({ assetId: input.assetId, status: response.status }); return { status: response.status, body }; }
  let index = 0; const assetId = () => 'Image' + String.fromCharCode(65 + Math.floor(index / 26), 65 + index++ % 26);
  for (const test of positives) {
    const sourcePath = `${out}/positive-${references.length + 1}.jpg`; writeFileSync(sourcePath, test.bytes, { flag: 'wx' });
    pillowChecks.push({ path: sourcePath, exact: test.exact, pixelSha: sha(test.reference) });
    const input = { mode, assetId: assetId(), dataBase64: test.bytes.toString('base64') }, local = node(input), remote = await worker(input); assert.deepEqual(remote, local, test.name); assert.equal(local.status, 200, test.name);
    let png;
    if (mode === 'candidate') { png = Buffer.from(local.body.png, 'base64'); assert.deepEqual(local.body.before, local.body.after); }
    else { const { entry, stored } = local.body; png = Buffer.from(stored.bytes, 'base64'); assert.equal(entry.mime, 'image/png'); assert.equal(entry.sha256, sha(png)); assert.equal(entry.byteLength, png.length); assert.ok(png.length <= 100 * 1024); assert.equal(local.body.after.length, local.body.before.length + 1); }
    const pixels = decodePNG(png).pixels, safe = preflightPortraitJPEG(test.bytes);
    const upstreamDecode = () => original(safe.data, { useTArray: true, tolerantDecoding: false, colorTransform: safe.colorTransform, maxResolutionInMP: 0.016384, maxMemoryUsageInMB: 4 });
    if (test.upstreamRemainderBug) {
      // Explicit known upstream final-interval overshoot, not a blanket catch.
      assert.throws(upstreamDecode, { name: 'TypeError', message: "Cannot read properties of undefined (reading '0')" });
    } else { assert.deepEqual(pixels, upstreamDecode().data, 'unchanged upstream arithmetic ' + test.name); }
    if (test.exact) { assert.equal(sha(pixels), sha(test.reference), 'independent exact reference ' + test.name); }
    else { let max = 0, changed = 0; for (let i = 0; i < pixels.length; i++) { const diff = Math.abs(pixels[i] - test.reference[i]); max = Math.max(max, diff); if (diff) { changed++; } } diagnostics.push({ name: test.name, maxAbsoluteDifference: max, changedChannels: changed, note: 'Independent libjpeg comparison characterized, not made exact by an epsilon or counted as Part-2 conformance.' }); }
    references.push({ name: test.name, exactIndependent: test.exact, upstreamRemainderBug: test.upstreamRemainderBug ?? false, pixelSha: sha(pixels) }); writeFileSync(`${out}/stored-${references.length}.png`, png, { flag: 'wx' }); pillowChecks.push({ path: `${out}/stored-${references.length}.png`, exact: true, pixelSha: sha(pixels) }); checks.push('accept-' + test.name);
  }
  for (const test of negatives) { const input = { mode, assetId: assetId(), dataBase64: test.bytes.toString('base64') }, local = node(input), remote = await worker(input); assert.deepEqual(remote, local, test.name); assert.equal(local.status, 422, test.name); assert.deepEqual(local.body.before, local.body.after, test.name); checks.push('reject-' + test.name); }
  if (mode === 'library') {
    for (const [name, extra, status, code] of [['foreign', { actor: 'foreign' }, 404, 'GAME_NOT_FOUND'], ['change', { actor: 'change' }, 403, 'PASSWORD_CHANGE_REQUIRED'], ['invalid', { actor: 'invalid' }, 401, 'SESSION_INVALID'], ['builtin', { gameId: 'wolong-builtin' }, 403, 'BUILTIN_PROTECTED'], ['reserved', { assetId: 'terrain' }, 422, 'PORTRAIT_RESERVED'], ['duplicate', { assetId: 'ImageAA' }, 409, 'PORTRAIT_EXISTS']]) {
      const input = { mode, assetId: assetId(), dataBase64: plain.toString('base64'), ...extra }, local = node(input), remote = await worker(input); assert.deepEqual(remote, local); assert.equal(local.status, status); assert.equal(local.body.error, code); assert.deepEqual(local.body.before, local.body.after); checks.push('gate-before-decode-' + name);
    }
  }
  const independent = spawnSync('python', ['-B', 'tools/verify_portrait_jpeg_oracle.py', out, 'check'], { input: JSON.stringify(pillowChecks), env, encoding: 'utf8', timeout: 60000 });
  writeFileSync(`${out}/independent.stdout`, independent.stdout, { flag: 'wx' }); writeFileSync(`${out}/independent.stderr`, independent.stderr, { flag: 'wx' }); assert.equal(independent.status, 0, independent.stderr);
  assert.equal(parse(independent.stdout).results.length, pillowChecks.length); checks.push('independent-Pillow-inputs-and-canonical-outputs');
  for (const [path, hash] of Object.entries(pins)) { assert.equal(sha(readFileSync(path)), hash, path); }
  const report = { result: 'PASS-PORTRAIT-JPEG-' + mode.toUpperCase(), checks, calls, pins, positives: positives.length, negatives: negatives.length, oracleImages: pillowChecks.length, references, diagnostics, pillow: reference.pillow, limits: 'Fixed 128, supported JPEG subset only; synthetic actors/game on real Node/workerd SQLite. No real auth/API/R2/Trial/App, OS process isolation, hard CPU/RSS guarantee, arbitrary colors/profiles, full Part-2 conformance or migration of old assets. Exact independent neutral/grayscale references and unchanged upstream arithmetic on colored fixtures are distinct evidence.' };
  writeFileSync(`${out}/receipt.json`, JSON.stringify(report, null, 2), { flag: 'wx' }); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} catch (error) { writeFileSync(`${out}/failure.json`, JSON.stringify({ error: error.message, stack: error.stack, checks, calls, pins }, null, 2), { flag: 'wx' }); throw error; }
finally { db?.close(); await mf?.dispose(); }
