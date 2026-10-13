// TRIAL-PORTRAIT-PUBLIC-1 (C slice): current-SHA public Trial chain for the
// server-side crop, end to end without stub ports and without browser App boot.
// Real loopback HTTPS workerd + R2-backed staged source install + real login +
// rotate + full copy + draft read + trial issue + crop upload through the true
// route + asset serve (sha header) + pack manifest + trial end. No browser,
// no concurrent play, no publish UI: those stay open and are stated as such.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { spawnSync } from 'node:child_process';
import { stageInstalledEditorSource } from './editor_stage_source.mjs';
import { stageInstalledAvailableLibrary } from './editor_stage_library.mjs';
import { encodePNG, decodePNG } from '../server/pngio.js';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-public-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const parse = text => { try { return JSON.parse(text); } catch (cause) { throw new Error('owned public-chain JSON', { cause }); } };
const inputs = ['server/worker.js', 'server/trials.js', 'server/portraitcrop.js', 'server/pngio.js', 'server/portraitjpeg.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_trial_crop_public_chain.mjs', 'tools/fixtures/trial_public_check.py', 'tools/editor_stage_source.mjs', 'tools/editor_stage_library.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
const checks = [], oracle = [];
const port = 18978, origin = `https://127.0.0.1:${port}`;
const own = mkdtempSync(join(tmpdir(), 'trial-public-'));
const initial = randomBytes(16).toString('hex'), password = randomBytes(16).toString('hex');
let mf;
// Heavy calls (full-copy run, trial issue compile) get a 600s budget; light
// calls keep 120s so a hang is still observable instead of silent.
function req(path, value, session, extra = {}, timeoutMs = 120000) {
  return new Promise((done, reject) => {
    const started = Date.now();
    const headers = { Origin: origin, ...extra };
    if (session) { headers.Cookie = session.cookie; headers['X-CSRF-Token'] = session.csrf; }
    if (value !== undefined) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] ??= randomUUID(); }
    const q = httpsRequest(origin + path, { method: value === undefined ? 'GET' : 'POST', headers, rejectUnauthorized: false, agent: false }, response => {
      const chunks = []; response.on('data', b => chunks.push(b)); response.on('error', reject);
      response.on('end', () => done({ status: response.statusCode, bytes: Buffer.concat(chunks), cookie: response.headers['set-cookie']?.[0]?.split(';')[0], shaHeader: response.headers['x-content-sha256'], mime: response.headers['content-type'], ms: Date.now() - started }));
    });
    q.on('error', reject); q.setTimeout(timeoutMs, () => q.destroy(new Error('owned HTTPS timeout')));
    q.end(value === undefined ? undefined : JSON.stringify(value));
  });
}
const check = name => { checks.push(name); writeFileSync(`${out}/partial.json`, JSON.stringify({ checks }, null, 2)); };
try {
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href);
  let stage = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("stage")}}', compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], r2Buckets: ['EDITOR_BLOBS'], r2Persist: own });
  const bucket = await stage.getR2Bucket('EDITOR_BLOBS');
  const source = await stageInstalledEditorSource(bucket), library = await stageInstalledAvailableLibrary(bucket);
  writeFileSync(`${out}/staged.json`, JSON.stringify({ source, library }, null, 2), { flag: 'wx' });
  await stage.dispose(); stage = null;
  check('fresh-approved-source-and-library-staged');
  mf = new Miniflare({ modules: true, scriptPath: resolve('server/worker.js'), rootPath: resolve('server'), modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt', '**/*.html', '**/*.css'] }], compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], durableObjects: { EDITOR_METADATA: { className: 'EditorMetadata', useSQLite: true } }, r2Buckets: ['EDITOR_BLOBS'], r2Persist: own, durableObjectsPersist: own, bindings: { EDITOR_ORIGIN: origin, EDITOR_REQUEST_KEY: randomBytes(32).toString('hex'), EDITOR_DEFAULT_PASSWORD: initial, EDITOR_INSTALLED_SOURCE_ROOT: JSON.stringify(source), EDITOR_AVAILABLE_LIBRARY_ROOT: JSON.stringify(library) }, https: true, port, host: '127.0.0.1' });
  await mf.ready;
  const ok = async (name, path, value, session, status = 200, extra, timeoutMs) => {
    const r = await req(path, value, session, extra, timeoutMs);
    writeFileSync(`${out}/http-${checks.length}.json`, JSON.stringify({ path, status: r.status, ms: r.ms, shaHeader: r.shaHeader ?? null, body: (r.mime ?? '').includes('json') ? r.bytes.toString('utf8').slice(0, 400) : `<${r.bytes.length} bytes>` }, null, 2), { flag: 'wx' });
    assert.equal(r.status, status, `${name}: ${r.bytes.toString('utf8').slice(0, 200)}`);
    check(name); return r;
  };
  const login = await ok('real-login', '/api/auth/login', { account: 'tianyi', password: initial }, null);
  const first = { cookie: login.cookie, csrf: parse(login.bytes.toString('utf8')).csrf };
  const rotated = await ok('real-rotate', '/api/auth/password', { oldPassword: initial, newPassword: password }, first);
  const admin = { cookie: rotated.cookie, csrf: parse(rotated.bytes.toString('utf8')).csrf };
  await ok('real-install-source', '/api/admin/source/install', {}, admin);
  await ok('real-install-library', '/api/admin/library/install', {}, admin);
  const def = parse((await ok('real-source-def', '/api/admin/source', undefined, admin)).bytes.toString('utf8')).definition;
  const key = randomUUID();
  await ok('real-copy-reserve', '/api/admin/copies', { registryId: def.registryId, name: '公开链裁剪验证', introduction: '' }, admin, 202, { 'Idempotency-Key': key });
  const copied = parse((await ok('real-copy-run', `/api/admin/copies/${key}/run`, {}, admin, 200, { 'If-Match': '"1"' }, 600000)).bytes.toString('utf8'));
  const gameId = copied.gameId;
  const draft = parse((await ok('real-draft-read', `/api/games/${gameId}/draft?revision=1`, undefined, admin, 200, {}, 600000)).bytes.toString('utf8'));
  assert.ok(Array.isArray(draft.chapters) && draft.chapters.length > 0, 'draft has chapters');
  const chapterId = draft.chapters[0].chapterId;
  const trial = parse((await ok('real-trial-start', `/api/games/${gameId}/trials`, { expectedRevision: draft.draftRevision, chapterId }, admin, 200, {}, 600000)).bytes.toString('utf8'));
  // Owned flat source (production-encoded): crop center square to 128.
  const W = 200, H = 100, pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { pixels.set([(x * 3) & 240, (y * 5) & 240, 200, 255], (y * W + x) * 4); } }
  const sourceBytes = Buffer.from(encodePNG(pixels, W, H));
  const crop = { x: 50, y: 0, side: 100 };
  const expected = new Uint8Array(128 * 128 * 4);
  for (let dy = 0; dy < 128; dy++) { for (let dx = 0; dx < 128; dx++) { const sx = 50 + Math.floor(dx * 100 / 128), sy = Math.floor(dy * 100 / 128); expected.set([(sx * 3) & 240, (sy * 5) & 240, 200, 255], (dy * 128 + dx) * 4); } }
  const uploaded = parse((await ok('real-crop-upload', `/api/trials/${trial.trialId}/portraits`, { assetId: 'PublicCrop', dataBase64: sourceBytes.toString('base64'), crop }, admin)).bytes.toString('utf8'));
  assert.equal(uploaded.mime, 'image/png');
  const served = await ok('real-asset-serve', `/api/trials/${trial.trialId}/assets/PublicCrop`, undefined, admin);
  assert.equal(served.shaHeader, uploaded.sha256); assert.equal(sha(served.bytes), uploaded.sha256);
  const decoded = decodePNG(served.bytes);
  assert.equal(decoded.width, 128); assert.equal(decoded.height, 128);
  assert.ok(Buffer.from(decoded.pixels).equals(Buffer.from(expected)), 'served-crop-pixels');
  check('served-crop-exact-128');
  const file = `public-${oracle.length}.png`; writeFileSync(`${out}/${file}`, served.bytes, { flag: 'wx' });
  oracle.push({ file, width: 128, height: 128, pixelSHA: sha(expected) });
  const pack = parse((await ok('real-pack-manifest', `/api/trials/${trial.trialId}/pack`, undefined, admin)).bytes.toString('utf8'));
  assert.deepEqual(pack.manifest.portraits.find(row => row.assetId === 'PublicCrop'), uploaded);
  await ok('real-trial-end', `/api/trials/${trial.trialId}/end`, {}, admin);
  writeFileSync(`${out}/oracle.json`, JSON.stringify(oracle, null, 2), { flag: 'wx' });
  {
    const reply = spawnSync('python', ['-B', 'tools/fixtures/trial_public_check.py', out, 'check'], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
    writeFileSync(`${out}/check.log`, reply.stdout ?? '', { flag: 'wx' }); writeFileSync(`${out}/check.err`, reply.stderr ?? '', { flag: 'wx' }); assert.equal(reply.status, 0, reply.stderr);
  }
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, pins, oracleImages: oracle.length, gameId, trialId: trial.trialId, chapterId, limits: 'Real Root auth + R2-backed install + trial chain + crop upload/serve/manifest/end on current SHA. No browser App boot, no concurrent play, no publish UI; game-library public side relies on the older safety lane and is not reclaimed here.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Trial public chain PASS ${checks.length} checks ${oracle.length} Pillow images\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks }, null, 2)); await mf?.dispose(); }
