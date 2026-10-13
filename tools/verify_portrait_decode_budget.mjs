// TRIAL-PORTRAIT-BUDGET-1 (B slice): decode resource-budget verification only.
// Zero production change: the default codec budgets are NOT raised here.
// The probe decodes worst-case in-budget inputs on Node directly and through
// production TrialSessions on Node SQLite + a real workerd SQLite DO (stub
// service ports, no Root/R2/App), recording wall time, heap churn and output
// exactness. Repeat、上限内完成＋像素 exact 即通过；OS 进程隔离／硬 RSS／CPU
// 上限仍 open（见维护源），本探针不冒此证。
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { decodePNG } from '../server/pngio.js';
import { decodeTrialPortraitJPEG } from '../server/portraitjpeg.js';
import { trialPortraitFixture } from './fixtures/trial_portrait_fixture.mjs';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
assert.equal(typeof globalThis.gc, 'function', 'invoke with node --expose-gc');
const base = '.dragon-analysis/editor-phase/trial-portrait-budget-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const parse = text => { try { return JSON.parse(text); } catch (cause) { throw new Error('owned budget fixture JSON', { cause }); } };
const inputs = ['server/trials.js', 'server/portraitcrop.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_portrait_decode_budget.mjs', 'tools/fixtures/portrait_decode_budget.py', 'tools/fixtures/trial_portrait_fixture.mjs', 'tools/fixtures/trial_portrait_png_worker.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
{
  const reply = spawnSync('python', ['-B', 'tools/fixtures/portrait_decode_budget.py', out, 'generate'], { env, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
  writeFileSync(`${out}/generate.log`, reply.stdout ?? '', { flag: 'wx' }); writeFileSync(`${out}/generate.err`, reply.stderr ?? '', { flag: 'wx' }); assert.equal(reply.status, 0, reply.stderr);
}
const fixtures = parse(readFileSync(`${out}/budget-fixtures.json`, 'utf8'));
const heapMB = () => globalThis.gc() ?? undefined;
const rssMB = () => Math.round(process.memoryUsage().heapUsed / 1048576 * 100) / 100;
const checks = [], measurements = [];
let mf, index = 0;
const id = () => 'Budget' + String.fromCharCode(65 + Math.floor(index / 26), 65 + index++ % 26);
const db = new DatabaseSync(':memory:');
const storage = { sql: { exec(q, ...v) { const rows = db.prepare(q).all(...v); return { toArray: () => rows }; } }, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
const nodeCall = trialPortraitFixture(storage, installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt')));
try {
  // Direct-decoder maxima on Node with heap accounting.
  for (const test of fixtures) {
    const bytes = readFileSync(`${out}/${test.file}`);
    assert.ok(bytes.length <= 100 * 1024, test.file + ' input budget ' + bytes.length);
    heapMB(); const before = rssMB(), start = Date.now();
    const decoded = test.file.endsWith('.jpg') ? decodeTrialPortraitJPEG(bytes) : decodePNG(bytes);
    const ms = Date.now() - start;
    assert.equal(decoded.width, test.width); assert.equal(decoded.height, test.height);
    assert.equal(sha(Buffer.from(decoded.pixels)), test.pixelSHA, test.file + ' exact');
    heapMB(); const after = rssMB();
    measurements.push({ phase: 'direct', file: test.file, inputBytes: bytes.length, ms, heapBeforeMB: before, heapAfterMB: after });
    checks.push('direct-' + test.kind);
  }
  // Production TrialSessions preview path on both SQLite sides with per-call ms.
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href), config = parse(readFileSync('server/wrangler.jsonc', 'utf8'));
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt'] }], scriptPath: resolve('tools/fixtures/trial_portrait_png_worker.mjs'), compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags, durableObjects: { TRIAL_PNG: { className: 'TrialPortraitPNGFixture', useSQLite: true } }, host: '127.0.0.1', port: 0 });
  const origin = await mf.ready;
  let calls = 0;
  async function call(input) {
    const start = Date.now();
    const node = nodeCall(input), response = await fetch(origin, { method: 'POST', body: JSON.stringify(input), signal: AbortSignal.timeout(30000) }), text = await response.text();
    const ms = Date.now() - start; calls++;
    writeFileSync(`${out}/http-${calls}.json`, JSON.stringify({ status: response.status, ms, body: text.slice(0, 200) }, null, 2), { flag: 'wx' });
    const worker = parse(text);
    assert.equal(response.status, worker.status); assert.deepEqual(worker, node); return { ...node, ms };
  }
  for (const test of fixtures) {
    const bytes = readFileSync(`${out}/${test.file}`);
    const preview = await call({ op: 'preview', assetId: id(), dataBase64: bytes.toString('base64') });
    assert.equal(preview.status, 200, test.file); assert.deepEqual(preview.before, preview.after);
    measurements.push({ phase: 'sessions', file: test.file, ms: preview.ms, byteLength: preview.data.byteLength });
    checks.push('sessions-' + test.kind);
  }
  // Repeat stability: 30x max-JPEG previews, post-GC growth must stay below
  // half the pixel churn (probe-local retention bound, not a product SLA;
  // the wider window dilutes one-off harness noise).
  {
    const bytes = readFileSync(`${out}/budget-max.jpg`);
    heapMB(); const before = rssMB();
    for (let i = 0; i < 30; i++) {
      const reply = await call({ op: 'preview', assetId: id(), dataBase64: bytes.toString('base64') });
      assert.equal(reply.status, 200, 'repeat-' + i);
    }
    heapMB(); const after = rssMB(), growth = Math.round((after - before) * 100) / 100;
    const churnMB = 30 * 8192 * 2 * 4 / 1048576;
    measurements.push({ phase: 'repeat', decodes: 30, heapBeforeMB: before, heapAfterMB: after, growthMB: growth, churnMB: Math.round(churnMB * 100) / 100 });
    assert.ok(growth < churnMB / 2, `heap retention ${growth}MB over 30 max decodes`);
    checks.push('repeat-no-retention');
  }
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, httpCalls: calls, pins, measurements, limits: 'Default budgets unchanged (Trial JPEG <=16384px/8192 side, PNG adapter <=4MP, input <=100KiB). Probe-local only: no OS/CPU/RSS isolation, no larger-source acceptance, no color-precision or UI certificate.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Portrait budget PASS ${checks.length} checks ${calls} HTTP\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks, measurements }, null, 2), { flag: 'wx' }); await mf?.dispose(); db.close(); }
