// Bounded Trial JPEG subset on actual Node/workerd SQLite. Explicit stub ports,
// no Root auth/R2/App, crop output, arbitrary source/color precision certificate.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { decodePortraitJPEG, PortraitJPEGError } from '../server/portraitjpeg.js';
import { trialPortraitFixture } from './fixtures/trial_portrait_fixture.mjs';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-jpeg-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const parse = text => { try { return JSON.parse(text); } catch (cause) { throw new Error('owned JPEG fixture JSON', { cause }); } };
const inputs = ['server/trials.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_trial_portrait_jpeg_safety.mjs', 'tools/fixtures/trial_portrait_jpeg.py', 'tools/fixtures/trial_portrait_fixture.mjs', 'tools/fixtures/trial_portrait_png_worker.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
function python(mode) {
  const reply = spawnSync('python', ['-B', 'tools/fixtures/trial_portrait_jpeg.py', out, mode], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  writeFileSync(`${out}/${mode}.log`, reply.stdout ?? '', { flag: 'wx' }); writeFileSync(`${out}/${mode}.err`, reply.stderr ?? '', { flag: 'wx' }); assert.equal(reply.status, 0, reply.stderr);
}
python('generate');
const positives = parse(readFileSync(`${out}/fixtures.json`, 'utf8'));
const source = readFileSync(`${out}/${positives[0].file}`), fake = Buffer.from('ffd8ffe000000000', 'hex');
function records(bytes) {
  const result = []; let at = 2;
  while (at < bytes.length) {
    assert.equal(bytes[at], 255); const kind = bytes[at + 1]; if (kind === 0xda || kind === 0xd9) { break; }
    const end = at + 2 + bytes.readUInt16BE(at + 2); result.push({ at, kind, end }); at = end;
  }
  return result;
}
const headers = records(source), sof = headers.find(r => r.kind === 0xc0), dqt = headers.find(r => r.kind === 0xdb), dht = headers.find(r => r.kind === 0xc4);
assert.ok(sof && dqt && dht);
const negatives = [['fake-header', fake], ['complete-sof-only', source.subarray(0, sof.end)], ['no-eoi', source.subarray(0, -2)], ['truncated', source.subarray(0, -1)], ['tail-html', Buffer.concat([source, Buffer.from('<html>')])], ['second-image', Buffer.concat([source, source])]];
function change(name, at, value) { const altered = Buffer.from(source); altered[at] = value; negatives.push([name, altered]); }
change('zero-height', sof.at + 6, 0); change('over-pixel-budget', sof.at + 8, 129); change('over-side', sof.at + 7, 0x20); change('precision12', sof.at + 4, 12); change('sampling-zero', sof.at + 11, 0); change('missing-quant-table', sof.at + 12, 3); change('quant-zero', dqt.at + 5, 0); change('segment-underflow', sof.at + 3, 1); change('huffman-overfull', dht.at + 5, 255);
const segment = (kind, data) => { const head = Buffer.from([255, kind, 0, 0]); head.writeUInt16BE(data.length + 2, 2); return Buffer.concat([head, data]); };
for (const text of ['ICC_PROFILE\0data', 'MPF\0data']) { negatives.push([text.slice(0, 3), Buffer.concat([source.subarray(0, 2), segment(0xe2, Buffer.from(text)), source.subarray(2)])]); }
negatives.push(['segment-budget', Buffer.concat([source.subarray(0, 2), ...Array.from({ length: 256 }, () => segment(0xfe, Buffer.alloc(0))), source.subarray(2)])]);
const db = new DatabaseSync(':memory:');
const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
const nodeCall = trialPortraitFixture(storage, installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt')));
const checks = [], calls = [], oracle = []; let mf, index = 0;
const id = () => 'JPEG' + String.fromCharCode(65 + Math.floor(index / 26), 65 + index++ % 26);
const payload = (assetId, bytes, op = 'preview', extra = {}) => ({ op, assetId, dataBase64: bytes.toString('base64'), ...extra });
try {
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href), config = parse(readFileSync('server/wrangler.jsonc', 'utf8'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt'] }], scriptPath: resolve('tools/fixtures/trial_portrait_png_worker.mjs'), compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags, durableObjects: { TRIAL_PNG: { className: 'TrialPortraitPNGFixture', useSQLite: true } }, host: '127.0.0.1', port: 0 });
  const origin = await mf.ready;
  async function call(input) {
    const node = nodeCall(input), response = await fetch(origin, { method: 'POST', body: JSON.stringify(input), signal: AbortSignal.timeout(30000) }), text = await response.text();
    calls.push({ op: input.op, assetId: input.assetId ?? null, status: response.status });
    writeFileSync(`${out}/http-${calls.length}.json`, JSON.stringify({ status: response.status, body: text }, null, 2), { flag: 'wx' });
    const worker = parse(text); writeFileSync(`${out}/call-${calls.length}.json`, JSON.stringify({ input, node, worker }, null, 2), { flag: 'wx' });
    assert.equal(response.status, worker.status); assert.deepEqual(worker, node); return { ...node, worker };
  }
  for (const test of positives) {
    const bytes = readFileSync(`${out}/${test.file}`), assetId = id(), preview = await call(payload(assetId, bytes));
    assert.equal(preview.status, 200, test.name); assert.equal(preview.data.mime, 'image/png'); assert.deepEqual(preview.before, preview.after);
    const commit = await call(payload(assetId, bytes, 'transaction', { expected: preview.data })); assert.equal(commit.status, 200); assert.deepEqual(commit.data, preview.data);
    const served = await call({ op: 'asset', assetId }), png = Buffer.from(served.data.bytes, 'base64'); assert.equal(served.status, 200); assert.equal(served.data.mime, 'image/png'); assert.equal(png.length, preview.data.byteLength); assert.equal(sha(png), preview.data.sha256);
    const kinds = []; for (let at = 8; at < png.length; at += png.readUInt32BE(at) + 12) { kinds.push(png.toString('ascii', at + 4, at + 8)); } assert.deepEqual(kinds, ['IHDR', 'IDAT', 'IEND']);
    const manifest = parse(Buffer.from(commit.after.find(row => row.asset_id === 'manifest').bytes, 'base64').toString('utf8')); assert.deepEqual(manifest.portraits.find(row => row.assetId === assetId), preview.data);
    const { name, ...reference } = test; void name; oracle.push(reference);
    for (const output of [png, Buffer.from(served.worker.data.bytes, 'base64')]) { const file = `image-${oracle.length}.png`; writeFileSync(`${out}/${file}`, output, { flag: 'wx' }); oracle.push({ ...reference, file }); }
    if (test.width !== 128 || test.height !== 128) { assert.throws(() => decodePortraitJPEG(bytes), PortraitJPEGError); }
    checks.push('accept-' + test.name);
  }
  for (const [name, bytes] of negatives) { const reply = await call(payload(id(), bytes)); assert.equal(reply.status, 422, name); assert.equal(reply.error, 'TRIAL_PORTRAIT_JPEG_INVALID', name); assert.deepEqual(reply.before, reply.after); checks.push('reject-' + name); }
  const preview = await call(payload('Mismatch', source));
  for (const [field, value] of [['mime', 'image/jpeg'], ['sha256', sha(source)], ['byteLength', source.length], ['assetId', 'Other']]) {
    const reply = await call(payload('Mismatch', source, 'commit', { expected: { ...preview.data, [field]: value } })); assert.equal(reply.error, 'TRIAL_CHANGED'); assert.deepEqual(reply.before, reply.after); checks.push('bare-commit-mismatch-' + field);
  }
  const corrupt = await call(payload('Mismatch', fake, 'commit', { expected: preview.data })); assert.equal(corrupt.error, 'TRIAL_PORTRAIT_JPEG_INVALID'); assert.deepEqual(corrupt.before, corrupt.after); checks.push('changed-source-after-preview');
  for (const [token, code] of [['foreign', 'TRIAL_INVALID'], ['invalid', 'SESSION_INVALID']]) { const reply = await call(payload(id(), fake, 'preview', { token })); assert.equal(reply.status, 401); assert.equal(reply.error, code); assert.deepEqual(reply.before, reply.after); checks.push('auth-before-decode-' + token); }
  await call({ op: 'seed' }); const valid = await call(payload('NoManifest', source)); await call({ op: 'manifest', mode: 'missing' });
  const missing = await call(payload('NoManifest', source, 'commit', { expected: valid.data })); assert.equal(missing.error, 'TRIAL_DERIVED_MISSING'); assert.deepEqual(missing.before, missing.after); checks.push('missing-manifest-no-write');
  await call({ op: 'seed' }); const validRollback = await call(payload('Rollback', source)); await call({ op: 'abort' });
  const rollback = await call(payload('Rollback', source, 'transaction', { expected: validRollback.data })); assert.equal(rollback.error, 'FIXTURE_SQL_ABORT'); assert.deepEqual(rollback.before, rollback.after); checks.push('outer-sql-rollback');
  for (const op of ['epoch', 'deleting', 'ended']) { await call({ op: 'seed' }); const reply = await call(payload('Guarded', source, op)); assert.equal(reply.error, 'TRIAL_INVALID'); assert.ok(!reply.after.some(row => row.asset_id === 'Guarded')); checks.push(op + '-reject-no-new-portrait'); }
  writeFileSync(`${out}/oracle.json`, JSON.stringify(oracle, null, 2), { flag: 'wx' }); python('check');
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, calls, pins, oracleImages: oracle.length, positives: positives.length, negatives: negatives.length, limits: 'Source JPEG subset <=16384 pixels/8192 side/4MiB estimated codec budget. Real SQLite, stub service ports; neutral exact RGBA only, no crop, larger arbitrary sources, full color precision, Root/R2/App or OS CPU/RSS isolation certificate.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Trial JPEG PASS ${checks.length} checks ${calls.length} HTTP ${oracle.length} Pillow images\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks, calls }, null, 2), { flag: 'wx' }); await mf?.dispose(); db.close(); }
