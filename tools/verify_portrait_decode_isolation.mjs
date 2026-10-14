// PORTRAIT-DECODE-ISOLATION-1: standalone Node child EXPERIMENT + direct API
// compatibility. NOT production isolation, hard RSS/CPU or a permission sandbox.
// All inputs synthetic; real workerd SQLite, stub identity/content ports. The
// production Trial API still decodes directly; expected output is reconstructed
// separately from the experimental child's pixels. No retry masks HTTP errors.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { encodePNG, decodePNG, PNGError } from '../server/pngio.js';
import { decodePortraitJPEG, decodeTrialPortraitJPEG, PortraitJPEGError } from '../server/portraitjpeg.js';
import { decodePortraitPixels, DecodeProcessError, PROBE_LIMITS } from './fixtures/portrait_decode_isolate.mjs';
import { trialPortraitFixture } from './fixtures/trial_portrait_fixture.mjs';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/portrait-decode-isolation-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const inputs = ['tools/fixtures/portrait_decode_isolate.mjs', 'tools/fixtures/portrait_decode_child.mjs', 'server/trials.js', 'server/portraits.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_portrait_decode_isolation.mjs', 'tools/fixtures/trial_portrait_fixture.mjs', 'tools/fixtures/trial_portrait_png_worker.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
const checks = [], kills = [];
const check = name => { checks.push(name); process.stdout.write(`${name}\n`); };
const pattern = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) pattern.set([(x * 3) & 240, (y * 5) & 240, (x + y) & 240, 255], (y * 128 + x) * 4);
const pngBytes = Buffer.from(encodePNG(pattern, 128, 128));
writeFileSync(`${out}/source.png`, pngBytes, { flag: 'wx' });
const gen = spawnSync('python', ['-B', '-c', `from PIL import Image\nimg = Image.new('RGB', (128, 128))\npx = img.load()\nfor y in range(128):\n    for x in range(128):\n        px[x, y] = ((x * 3) & 240, (y * 5) & 240, 200)\nimg.save('${out}/source.jpg', quality=90)\nImage.new('RGBA', (2048, 2048), (20, 40, 60, 255)).save('${out}/max.png')\nImage.new('RGB', (8192, 2), (128, 128, 128)).save('${out}/max.jpg', quality=90)`], { env, encoding: 'utf8', timeout: 60000 });
writeFileSync(`${out}/generate.log`, (gen.stdout ?? '') + (gen.stderr ?? ''), { flag: 'wx' });
assert.equal(gen.status, 0, gen.stderr);
const jpgBytes = readFileSync(`${out}/source.jpg`);
const sources = { png: pngBytes, 'trial-jpeg': jpgBytes, 'game-jpeg': jpgBytes };
const direct = { png: decodePNG, 'trial-jpeg': decodeTrialPortraitJPEG, 'game-jpeg': decodePortraitJPEG };
const normalized = {};
for (const kind of Object.keys(sources)) {
  const isolated = decodePortraitPixels(kind, sources[kind]), normal = direct[kind](sources[kind]);
  assert.equal(isolated.width, normal.width); assert.equal(isolated.height, normal.height);
  assert.ok(Buffer.from(isolated.pixels).equals(Buffer.from(normal.pixels)));
  normalized[kind] = Buffer.from(encodePNG(isolated.pixels, isolated.width, isolated.height));
  writeFileSync(`${out}/${kind}-normalized.png`, normalized[kind], { flag: 'wx' });
  check(`probe-${kind}-shared-decoder-exact`);
  const ErrorClass = kind === 'png' ? PNGError : PortraitJPEGError;
  assert.throws(() => direct[kind](sources[kind].subarray(0, 200)), ErrorClass);
  assert.throws(() => decodePortraitPixels(kind, sources[kind].subarray(0, 200)), ErrorClass);
  check(`probe-${kind}-corrupt-class-fidelity`);
  const t0 = Date.now();
  assert.throws(() => decodePortraitPixels(kind, sources[kind], { timeoutMs: 1500, fault: 'hang' }), DecodeProcessError);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 1400 && elapsed < 10000);
  kills.push({ kind, elapsed, fault: 'hang' });
  check(`probe-${kind}-timeout-no-fallback`);
}
for (const [kind, name] of [['png', 'max.png'], ['trial-jpeg', 'max.jpg']]) {
  const bytes = readFileSync(`${out}/${name}`);
  assert.ok(bytes.length <= PROBE_LIMITS.inputBytes);
  const isolated = decodePortraitPixels(kind, bytes), normal = direct[kind](bytes);
  assert.equal(isolated.width, normal.width); assert.equal(isolated.height, normal.height);
  assert.ok(Buffer.from(isolated.pixels).equals(Buffer.from(normal.pixels)));
  check(`probe-${kind}-existing-max-budget-transport-exact`);
}
for (const fault of ['crash', 'bad-reply', 'bad-pixels']) {
  assert.throws(() => decodePortraitPixels('png', pngBytes, { fault }), DecodeProcessError);
  check(`probe-${fault}-fail-closed`);
}
assert.throws(() => decodePortraitPixels('png', pngBytes, { executable: resolve(out, 'missing-node.exe') }), DecodeProcessError);
check('probe-spawn-failure-no-direct-fallback');
for (const timeoutMs of [0, NaN, Infinity, 30001]) { assert.throws(() => decodePortraitPixels('png', pngBytes, { timeoutMs }), TypeError); }
check('probe-invalid-timeout-rejected');
for (const oldSpaceMiB of [0, NaN, Infinity, 257]) { assert.throws(() => decodePortraitPixels('png', pngBytes, { oldSpaceMiB }), TypeError); }
check('probe-invalid-old-space-cap-rejected');
assert.ok(Buffer.from(decodePortraitPixels('png', pngBytes).pixels).equals(Buffer.from(pattern)));
check('probe-parent-survives-failed-children');

// Existing upload API (unchanged): no production adapter installed. Node and
// workerd still use the direct decoder; only expectation uses child output.
const db = new DatabaseSync(':memory:');
const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
const nodeCall = trialPortraitFixture(storage, installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt')));
let mf, requests = 0;
try {
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href), config = JSON.parse(readFileSync('server/wrangler.jsonc', 'utf8'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt'] }], scriptPath: resolve('tools/fixtures/trial_portrait_png_worker.mjs'), compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags, durableObjects: { TRIAL_PNG: { className: 'TrialPortraitPNGFixture', useSQLite: true } }, host: '127.0.0.1', port: 0 });
  const origin = await mf.ready;
  async function call(input) {
    const node = nodeCall(input);
    // Synchronous probes can starve Node's idle-socket cleanup; never reuse
    // a keep-alive socket across deliberate blocking. Drain every response.
    const response = await fetch(origin, { method: 'POST', headers: { connection: 'close' }, body: JSON.stringify(input), signal: AbortSignal.timeout(30000) });
    const text = await response.text(), worker = JSON.parse(text);
    requests += 1;
    writeFileSync(`${out}/call-${requests}.json`, JSON.stringify({ input, node, worker, httpStatus: response.status }, null, 2), { flag: 'wx' });
    assert.equal(response.status, worker.status); assert.deepEqual(worker, node); return worker;
  }
  for (const [kind, assetId, code] of [['png', 'First', 'TRIAL_PORTRAIT_PNG_INVALID'], ['trial-jpeg', 'Second', 'TRIAL_PORTRAIT_JPEG_INVALID']]) {
    const good = await call({ op: 'preview', assetId, dataBase64: sources[kind].toString('base64') });
    assert.equal(good.status, 200); assert.equal(good.data.sha256, sha(normalized[kind])); assert.equal(good.data.byteLength, normalized[kind].length);
    check(`unchanged-api-${kind}-matches-probe-output`);
    const bad = await call({ op: 'preview', assetId, dataBase64: sources[kind].subarray(0, 200).toString('base64') });
    assert.equal(bad.status, 422); assert.equal(bad.error, code); assert.deepEqual(bad.before, bad.after);
    check(`unchanged-api-${kind}-corrupt-no-write`);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 6500);
  const reseed = await call({ op: 'seed' });
  assert.equal(reseed.status, 200);
  check('workerd-http-after-blocking-close-connection');
} finally { if (mf) { await mf.dispose(); } db.close(); }
for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], `input drift: ${name}`); }
writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, requests, kills, pins, probeLimits: PROBE_LIMITS, limitations: 'Standalone Node fixture only; shared-decoder parity not independent color precision. V8 old-space cap is NOT hard RSS; wall timeout is NOT CPU quota. No permission sandbox or production API isolation. Upload API remains direct; Node/workerd ports stub identity/content. No fallback on probe failure, no cloud resources/deployment.' }, null, 2), { flag: 'wx' });
process.stdout.write(`decode isolation PROBE PASS ${checks.length} checks / ${requests} HTTP\n`);
