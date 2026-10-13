// TRIAL-PORTRAIT-CROP-1: server-side square crop + normalized 128x128 output.
// Phase 1: production TrialSessions on Node SQLite and a real workerd SQLite DO
// (explicit stub ports, no Root/R2/App): crop positives exact, legacy no-crop
// preserved, malformed rectangles fail closed with no write, commit binding.
// Phase 2: real worker.js route gates over loopback HTTPS (login+rotate, random
// trial UUID): legacy shape reaches auth, crop key passes the fields gate,
// malformed crop is 422 before auth, unknown fields are rejected.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { encodePNG, decodePNG } from '../server/pngio.js';
import { trialPortraitFixture } from './fixtures/trial_portrait_fixture.mjs';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-crop-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const parse = text => { try { return JSON.parse(text); } catch (cause) { throw new Error('owned crop fixture JSON', { cause }); } };
const inputs = ['server/trials.js', 'server/portraitcrop.js', 'server/worker.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_trial_portrait_crop.mjs', 'tools/fixtures/trial_portrait_crop.py', 'tools/fixtures/trial_portrait_fixture.mjs', 'tools/fixtures/trial_portrait_png_worker.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
function python(mode) {
  const reply = spawnSync('python', ['-B', 'tools/fixtures/trial_portrait_crop.py', out, mode], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  writeFileSync(`${out}/${mode}.log`, reply.stdout ?? '', { flag: 'wx' }); writeFileSync(`${out}/${mode}.err`, reply.stderr ?? '', { flag: 'wx' }); assert.equal(reply.status, 0, reply.stderr);
}
python('generate');
const jpegSources = parse(readFileSync(`${out}/crop-jpeg.json`, 'utf8'));
// Independent expectation: integer nearest-neighbor, written separately from
// server/portraitcrop.js (same contract, no shared code path).
function expect128(pattern, crop) {
  const outPixels = new Uint8Array(128 * 128 * 4);
  for (let dy = 0; dy < 128; dy++) {
    const sy = crop.y + Math.floor(dy * crop.side / 128);
    for (let dx = 0; dx < 128; dx++) {
      const sx = crop.x + Math.floor(dx * crop.side / 128);
      outPixels.set(pattern(sx, sy), (dy * 128 + dx) * 4);
    }
  }
  return outPixels;
}
const pngCases = [
  // Quantized-block patterns: deterministic per-pixel variation while staying
  // under the preserved 100KiB source-input budget (raw gradients do not).
  { name: 'png-256x128-center', width: 256, height: 128, pattern: (x, y) => [x & 240, y & 240, (x + y) & 240, 255], crop: { x: 64, y: 0, side: 128 } },
  { name: 'png-200x100-corner', width: 200, height: 100, pattern: (x, y) => [(x * 3 + y * 5) & 240, (x * 7 + y) & 240, (x + y * 11) & 240, 255], crop: { x: 50, y: 0, side: 100 } },
  { name: 'png-64x64-upscale', width: 64, height: 64, pattern: (x, y) => [(x * 4) & 255, (y * 4) & 255, 128, 255], crop: { x: 0, y: 0, side: 64 } },
  { name: 'png-129x127-offset', width: 129, height: 127, pattern: (x, y) => [y & 240, x & 240, (x ^ y) & 240, 255], crop: { x: 1, y: 0, side: 127 } },
];
const db = new DatabaseSync(':memory:');
const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
const nodeCall = trialPortraitFixture(storage, installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt')));
const checks = [], calls = [], oracle = [];
let mf, index = 0;
const id = prefix => prefix + String.fromCharCode(65 + Math.floor(index / 26), 65 + index++ % 26);
const pngKinds = png => { const kinds = []; for (let at = 8; at < png.length; at += png.readUInt32BE(at) + 12) { kinds.push(png.toString('ascii', at + 4, at + 8)); } return kinds; };
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
  for (const test of pngCases) {
    const pattern = (x, y) => test.pattern(x, y);
    const pixels = new Uint8Array(test.width * test.height * 4);
    for (let y = 0; y < test.height; y++) { for (let x = 0; x < test.width; x++) { pixels.set(pattern(x, y), (y * test.width + x) * 4); } }
    const bytes = Buffer.from(encodePNG(pixels, test.width, test.height));
    const expected = expect128(pattern, test.crop);
    const assetId = id('Crop'), preview = await call({ op: 'preview', assetId, dataBase64: bytes.toString('base64'), crop: test.crop });
    assert.equal(preview.status, 200, test.name); assert.equal(preview.data.mime, 'image/png'); assert.deepEqual(preview.before, preview.after);
    const again = await call({ op: 'preview', assetId: id('Crop'), dataBase64: bytes.toString('base64'), crop: test.crop });
    assert.equal(again.data.sha256, preview.data.sha256, test.name + '-deterministic');
    const commit = await call({ op: 'transaction', assetId, dataBase64: bytes.toString('base64'), expected: preview.data, crop: test.crop });
    assert.equal(commit.status, 200); assert.deepEqual(commit.data, preview.data);
    const served = await call({ op: 'asset', assetId }), png = Buffer.from(served.data.bytes, 'base64');
    assert.equal(served.status, 200); assert.equal(png.length, preview.data.byteLength); assert.equal(sha(png), preview.data.sha256);
    assert.deepEqual(pngKinds(png), ['IHDR', 'IDAT', 'IEND']);
    // Buffer comparison: assert.deepEqual on 64K arrays blows up myers diff.
    assert.ok(Buffer.from(decodePNG(png).pixels).equals(Buffer.from(expected)), test.name + '-pixels');
    const manifest = parse(Buffer.from(commit.after.find(row => row.asset_id === 'manifest').bytes, 'base64').toString('utf8'));
    assert.deepEqual(manifest.portraits.find(row => row.assetId === assetId), preview.data);
    for (const output of [png, Buffer.from(served.worker.data.bytes, 'base64')]) {
      const file = `crop-${oracle.length}.png`; writeFileSync(`${out}/${file}`, output, { flag: 'wx' });
      oracle.push({ file, width: 128, height: 128, pixelSHA: sha(expected) });
    }
    checks.push('accept-' + test.name);
  }
  for (const test of jpegSources) {
    const bytes = readFileSync(`${out}/${test.file}`);
    const flat = Buffer.from(test.flat), expected = Buffer.concat(Array.from({ length: 128 * 128 }, () => flat));
    const assetId = id('Crop'), preview = await call({ op: 'preview', assetId, dataBase64: bytes.toString('base64'), crop: test.crop });
    assert.equal(preview.status, 200, test.name); assert.deepEqual(preview.before, preview.after);
    const commit = await call({ op: 'transaction', assetId, dataBase64: bytes.toString('base64'), expected: preview.data, crop: test.crop });
    assert.equal(commit.status, 200);
    const served = await call({ op: 'asset', assetId }), png = Buffer.from(served.data.bytes, 'base64');
    assert.equal(sha(png), preview.data.sha256);
    assert.ok(Buffer.from(decodePNG(png).pixels).equals(Buffer.from(expected)), test.name + '-pixels');
    const file = `crop-${oracle.length}.png`; writeFileSync(`${out}/${file}`, png, { flag: 'wx' });
    oracle.push({ file, width: 128, height: 128, pixelSHA: sha(expected) });
    checks.push('accept-' + test.name);
  }
  { // Legacy no-crop path preserves source geometry.
    const test = pngCases[0], pixels = new Uint8Array(test.width * test.height * 4);
    for (let y = 0; y < test.height; y++) { for (let x = 0; x < test.width; x++) { pixels.set(test.pattern(x, y), (y * test.width + x) * 4); } }
    const bytes = Buffer.from(encodePNG(pixels, test.width, test.height));
    const legacyId = id('Legacy');
    const preview = await call({ op: 'preview', assetId: legacyId, dataBase64: bytes.toString('base64') });
    assert.equal(preview.status, 200);
    const commit = await call({ op: 'transaction', assetId: legacyId, dataBase64: bytes.toString('base64'), expected: preview.data });
    assert.equal(commit.status, 200);
    const served = await call({ op: 'asset', assetId: commit.data.assetId });
    const decoded = decodePNG(Buffer.from(served.data.bytes, 'base64'));
    assert.equal(decoded.width, test.width); assert.equal(decoded.height, test.height);
    checks.push('legacy-no-crop-preserved');
  }
  { // Malformed rectangles fail closed with no write (shape gate pre-auth,
    // bounds gate post-decode); null stays legacy.
    const test = pngCases[0], pixels = new Uint8Array(test.width * test.height * 4);
    for (let y = 0; y < test.height; y++) { for (let x = 0; x < test.width; x++) { pixels.set(test.pattern(x, y), (y * test.width + x) * 4); } }
    const bytes = Buffer.from(encodePNG(pixels, test.width, test.height));
    const bad = [
      ['missing-side', { x: 0, y: 0 }], ['zero-side', { x: 0, y: 0, side: 0 }], ['negative-x', { x: -1, y: 0, side: 8 }],
      ['negative-side', { x: 0, y: 0, side: -8 }], ['overflow-x', { x: 200, y: 0, side: 128 }], ['overflow-y', { x: 0, y: 100, side: 64 }],
      ['over-min-dim', { x: 0, y: 0, side: 129 }], ['float-side', { x: 0, y: 0, side: 8.5 }], ['string-x', { x: '0', y: 0, side: 8 }],
      ['extra-key', { x: 0, y: 0, side: 8, w: 8 }], ['array', [0, 0, 8]], ['string', 'crop'], ['number', 8],
    ];
    for (const [name, crop] of bad) {
      const reply = await call({ op: 'preview', assetId: id('Neg'), dataBase64: bytes.toString('base64'), crop });
      assert.equal(reply.status, 422, name); assert.equal(reply.error, 'TRIAL_PORTRAIT_CROP', name); assert.deepEqual(reply.before, reply.after);
      checks.push('reject-crop-' + name);
    }
    const legacyNull = await call({ op: 'preview', assetId: id('Null'), dataBase64: bytes.toString('base64'), crop: null });
    assert.equal(legacyNull.status, 200, 'null-crop-legacy');
    checks.push('null-crop-legacy');
  }
  { // Commit binding covers the crop: a different rectangle changes the digest.
    const test = pngCases[2], pixels = new Uint8Array(test.width * test.height * 4);
    for (let y = 0; y < test.height; y++) { for (let x = 0; x < test.width; x++) { pixels.set(test.pattern(x, y), (y * test.width + x) * 4); } }
    const bytes = Buffer.from(encodePNG(pixels, test.width, test.height));
    const preview = await call({ op: 'preview', assetId: id('Bind'), dataBase64: bytes.toString('base64'), crop: { x: 0, y: 0, side: 64 } });
    assert.equal(preview.status, 200);
    const moved = await call({ op: 'commit', assetId: preview.data.assetId, dataBase64: bytes.toString('base64'), expected: preview.data, crop: { x: 0, y: 0, side: 32 } });
    assert.equal(moved.error, 'TRIAL_CHANGED'); assert.deepEqual(moved.before, moved.after); checks.push('moved-crop-commit-mismatch');
    const tampered = await call({ op: 'commit', assetId: preview.data.assetId, dataBase64: bytes.toString('base64'), expected: { ...preview.data, byteLength: 1 }, crop: { x: 0, y: 0, side: 64 } });
    assert.equal(tampered.error, 'TRIAL_CHANGED'); assert.deepEqual(tampered.before, tampered.after); checks.push('crop-commit-field-mismatch');
  }
  writeFileSync(`${out}/oracle.json`, JSON.stringify(oracle, null, 2), { flag: 'wx' }); python('check');
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, calls: calls.length, pins, oracleImages: oracle.length, limits: 'Crop runs after bounded decode inside existing PNG/JPEG budgets; 128x128 nearest-neighbor integer resample, no smoothing kernel, no metadata. Real SQLite both sides, stub service ports; no Root/R2/App, no Trial UI, no larger-source budget change.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Trial crop phase1 PASS ${checks.length} checks ${calls.length} HTTP ${oracle.length} Pillow images\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks, calls: calls.length }, null, 2), { flag: 'wx' }); await mf?.dispose(); db.close(); }
// Phase 2: real worker.js route gates over loopback HTTPS with a rotated admin
// session and a random trial UUID (no trial exists: the auth stage answers 401
// TRIAL_INVALID, so gates before it are observable at the true route).
{
  const port = 18979, origin = `https://127.0.0.1:${port}`;
  const own = mkdtempSync(join(tmpdir(), 'trial-crop-route-'));
  const initial = randomBytes(16).toString('hex'), password = randomBytes(16).toString('hex');
  const { randomUUID } = await import('node:crypto');
  const { Miniflare } = await import(pathToFileURL(process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js').href);
  const routeOut = `${out}/route`; mkdirSync(routeOut);
  const routeChecks = [];
  let routeMf;
  const httpsCall = (path, value, session) => new Promise((done, reject) => {
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() };
    if (session) { headers.Cookie = session.cookie; headers['X-CSRF-Token'] = session.csrf; }
    const req = httpsRequest(origin + path, { method: 'POST', headers, rejectUnauthorized: false, agent: false }, response => {
      const chunks = []; response.on('data', b => chunks.push(b)); response.on('error', reject);
      response.on('end', () => done({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8'), cookie: response.headers['set-cookie']?.[0]?.split(';')[0] }));
    });
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('owned HTTPS timeout')));
    req.end(JSON.stringify(value));
  });
  try {
    routeMf = new Miniflare({ modules: true, scriptPath: resolve('server/worker.js'), rootPath: resolve('server'), modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt', '**/*.html', '**/*.css'] }], compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], durableObjects: { EDITOR_METADATA: { className: 'EditorMetadata', useSQLite: true } }, r2Buckets: ['EDITOR_BLOBS'], r2Persist: own, durableObjectsPersist: own, bindings: { EDITOR_ORIGIN: origin, EDITOR_REQUEST_KEY: randomBytes(32).toString('hex'), EDITOR_DEFAULT_PASSWORD: initial }, https: true, port, host: '127.0.0.1' });
    await routeMf.ready;
    const trialId = '33333333-3333-4333-8333-333333333333';
    const path = `/api/trials/${trialId}/portraits`;
    const magic = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    const login = await httpsCall('/api/auth/login', { account: 'tianyi', password: initial });
    assert.equal(login.status, 200, 'route-login ' + login.body.slice(0, 160));
    const first = { cookie: login.cookie, csrf: parse(login.body).csrf };
    const rotated = await httpsCall('/api/auth/password', { oldPassword: initial, newPassword: password }, first);
    assert.equal(rotated.status, 200, 'route-rotate ' + rotated.body.slice(0, 160));
    const admin = { cookie: rotated.cookie, csrf: parse(rotated.body).csrf };
    routeChecks.push('real-login-rotate');
    const gate = async (name, value, status, error) => {
      const reply = await httpsCall(path, value, admin);
      writeFileSync(`${routeOut}/${name}.json`, JSON.stringify({ status: reply.status, body: reply.body }, null, 2), { flag: 'wx' });
      assert.equal(reply.status, status, name + ' ' + reply.body.slice(0, 160));
      assert.equal(parse(reply.body).error, error, name);
      routeChecks.push(name);
    };
    // Legacy exact shape passes the fields gate and reaches auth (no trial).
    await gate('legacy-reaches-auth', { assetId: 'Legacy', dataBase64: magic }, 401, 'TRIAL_INVALID');
    // Opt-in crop key passes the fields gate and reaches auth as well.
    await gate('crop-reaches-auth', { assetId: 'CropRoute', dataBase64: magic, crop: { x: 0, y: 0, side: 1 } }, 401, 'TRIAL_INVALID');
    // Malformed crop is refused before auth; unknown fields stay refused.
    await gate('malformed-crop-refused', { assetId: 'Bad', dataBase64: magic, crop: { x: 0, y: 0 } }, 422, 'TRIAL_PORTRAIT_CROP');
    await gate('unknown-field-refused', { assetId: 'Bad', dataBase64: magic, evil: 1 }, 422, 'REQUEST_FIELDS');
    for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
    writeFileSync(`${routeOut}/receipt.json`, JSON.stringify({ routeChecks, origin, trialId }, null, 2), { flag: 'wx' });
    process.stdout.write(`Trial crop phase2 PASS ${routeChecks.length} route gates\n`);
  } finally { await routeMf?.dispose(); }
}
