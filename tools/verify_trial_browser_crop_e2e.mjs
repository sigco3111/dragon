// TRIAL-PORTRAIT-E2E-1: browser-driven Trial crop round-trip against the real endpoint.
// Phase 1 (Node): C-slice bootstrap verbatim (loopback HTTPS workerd + R2 install +
// login/rotate + full copy + draft read + trial issue). Phase 2: loopback HTTP server
// serving web/ for real, an E harness page importing the real servertrialapp.js module,
// and an /api/* reverse proxy into workerd that injects the Node-held proven admin
// Cookie + X-CSRF-Token (zero prod change; auth itself was proven in C). Phase 3: real
// Chromium + fresh profile drives the true UI (select/confirm/upload with fixed name).
// Phase 4 (Node): pack read + asset serve + Node exact + Pillow oracle + trial end.
// NOT covered: App boot (session/login UI, faction select, engine), concurrent play,
// publish UI, game-library public side.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { stageInstalledEditorSource } from './editor_stage_source.mjs';
import { stageInstalledAvailableLibrary } from './editor_stage_library.mjs';
import { encodePNG, decodePNG } from '../server/pngio.js';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-e2e-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const parse = text => { try { return JSON.parse(text); } catch (cause) { throw new Error('owned e2e JSON', { cause }); } };
const inputs = ['server/worker.js', 'server/trials.js', 'server/portraitcrop.js', 'server/pngio.js', 'server/security.js', 'server/wrangler.jsonc', 'web/src/editor/servertrialapp.js', 'tools/verify_trial_browser_crop_e2e.mjs', 'tools/editor_stage_source.mjs', 'tools/editor_stage_library.mjs', 'tools/fixtures/trial_e2e_check.py'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
const checks = [], oracle = [];
const port = 18979, origin = `https://127.0.0.1:${port}`;
const own = mkdtempSync(join(tmpdir(), 'trial-e2e-'));
const initial = randomBytes(16).toString('hex'), password = randomBytes(16).toString('hex');
let mf = null, server = null;
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
try {
  const location = process.env.MINIFLARE_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const { Miniflare } = await import(pathToFileURL(location).href);
  let stage = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("stage")}}', compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], r2Buckets: ['EDITOR_BLOBS'], r2Persist: own });
  const bucket = await stage.getR2Bucket('EDITOR_BLOBS');
  const source = await stageInstalledEditorSource(bucket), library = await stageInstalledAvailableLibrary(bucket);
  writeFileSync(`${out}/staged.json`, JSON.stringify({ source, library }, null, 2), { flag: 'wx' });
  await stage.dispose(); stage = null;
  mf = new Miniflare({ modules: true, scriptPath: resolve('server/worker.js'), rootPath: resolve('server'), modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt', '**/*.html', '**/*.css'] }], compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], durableObjects: { EDITOR_METADATA: { className: 'EditorMetadata', useSQLite: true } }, r2Buckets: ['EDITOR_BLOBS'], r2Persist: own, durableObjectsPersist: own, bindings: { EDITOR_ORIGIN: origin, EDITOR_REQUEST_KEY: randomBytes(32).toString('hex'), EDITOR_DEFAULT_PASSWORD: initial, EDITOR_INSTALLED_SOURCE_ROOT: JSON.stringify(source), EDITOR_AVAILABLE_LIBRARY_ROOT: JSON.stringify(library) }, https: true, port, host: '127.0.0.1' });
  await mf.ready;
  const ok = async (name, path, value, session, status = 200, extra, timeoutMs) => {
    const r = await req(path, value, session, extra, timeoutMs);
    writeFileSync(`${out}/http-${checks.length}.json`, JSON.stringify({ path, status: r.status, ms: r.ms, shaHeader: r.shaHeader ?? null, body: (r.mime ?? '').includes('json') ? r.bytes.toString('utf8').slice(0, 400) : `<${r.bytes.length} bytes>` }, null, 2), { flag: 'wx' });
    assert.equal(r.status, status, `${name}: ${r.bytes.toString('utf8').slice(0, 200)}`);
    check(name); return r;
  };
  const check = name => { checks.push(name); writeFileSync(`${out}/partial.json`, JSON.stringify({ checks }, null, 2)); };
  const login = await ok('real-login', '/api/auth/login', { account: 'tianyi', password: initial }, null);
  const first = { cookie: login.cookie, csrf: parse(login.bytes.toString('utf8')).csrf };
  const rotated = await ok('real-rotate', '/api/auth/password', { oldPassword: initial, newPassword: password }, first);
  const admin = { cookie: rotated.cookie, csrf: parse(rotated.bytes.toString('utf8')).csrf };
  await ok('real-install-source', '/api/admin/source/install', {}, admin);
  await ok('real-install-library', '/api/admin/library/install', {}, admin);
  const def = parse((await ok('real-source-def', '/api/admin/source', undefined, admin)).bytes.toString('utf8')).definition;
  const key = randomUUID();
  await ok('real-copy-reserve', '/api/admin/copies', { registryId: def.registryId, name: '端到端裁剪验证', introduction: '' }, admin, 202, { 'Idempotency-Key': key });
  const copied = parse((await ok('real-copy-run', `/api/admin/copies/${key}/run`, {}, admin, 200, { 'If-Match': '"1"' }, 600000)).bytes.toString('utf8'));
  const gameId = copied.gameId;
  const draft = parse((await ok('real-draft-read', `/api/games/${gameId}/draft?revision=1`, undefined, admin, 200, {}, 600000)).bytes.toString('utf8'));
  assert.ok(Array.isArray(draft.chapters) && draft.chapters.length > 0, 'draft has chapters');
  const trial = parse((await ok('real-trial-start', `/api/games/${gameId}/trials`, { expectedRevision: draft.draftRevision, chapterId: draft.chapters[0].chapterId }, admin, 200, {}, 600000)).bytes.toString('utf8'));
  assert.match(trial.trialId, /^[a-f0-9-]{36}$/);
  check('bootstrap-trial-issued');
  const seedPack = parse((await ok('real-pack-seed', `/api/trials/${trial.trialId}/pack`, undefined, admin)).bytes.toString('utf8'));
  assert.ok(Array.isArray(seedPack.manifest.portraits) && seedPack.manifest.portraits.length === 0, 'seed pack portrait-clean');
  // Owned 200x100 fixture (production PNG encoder, same pattern family as C).
  const W = 200, H = 100, pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { pixels.set([(x * 3) & 240, (y * 5) & 240, 200, 255], (y * W + x) * 4); } }
  writeFileSync(`${out}/select.png`, Buffer.from(encodePNG(pixels, W, H)), { flag: 'wx' });
  const expected = new Uint8Array(128 * 128 * 4);
  for (let dy = 0; dy < 128; dy++) { for (let dx = 0; dx < 128; dx++) { const sx = 50 + Math.floor(dx * 100 / 128), sy = Math.floor(dy * 100 / 128); expected.set([(sx * 3) & 240, (sy * 5) & 240, 200, 255], (dy * 128 + dx) * 4); } }
  // Same-origin proxy: browser talks plain HTTP to this server; /api/* is
  // forwarded byte-identical to workerd with the proven admin session injected.
  const jar = { cookie: admin.cookie, csrf: admin.csrf };
  const forwarded = [];
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const seedJson = JSON.stringify(seedPack).replace(/</g, '\\u003c');
  server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/harness.html') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><body><div id="host"></div><script type="module">\n' +
        "import { mountPortraitUploads } from '/src/editor/servertrialapp.js';\n" +
        'let pack = ' + seedJson + ';\n' +
        'const ui = mountPortraitUploads({ documentTarget: document, fetchImpl: (...args) => window.fetch(...args), trialId: ' + JSON.stringify(trial.trialId) + ", getPack: () => pack, setPack: (next) => { pack = next; globalThis.__pack = next; } });\n" +
        "document.getElementById('host').append(ui.element);\n" +
        'globalThis.__pack = pack;\n' +
        '</script></body></html>');
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      request.on('data', b => chunks.push(b));
      request.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers = { Origin: origin, Cookie: jar.cookie, 'X-CSRF-Token': jar.csrf };
        if (body.length > 0) { headers['Content-Type'] = request.headers['content-type'] ?? 'application/json'; headers['Content-Length'] = body.length; }
        if (request.headers['idempotency-key']) { headers['Idempotency-Key'] = request.headers['idempotency-key']; }
        else if (request.method !== 'GET') { headers['Idempotency-Key'] = randomUUID(); }
        const q = httpsRequest(origin + url.pathname + url.search, { method: request.method, headers, rejectUnauthorized: false, agent: false }, upstream => {
          if (upstream.headers['set-cookie']?.[0]) { jar.cookie = upstream.headers['set-cookie'][0].split(';')[0]; }
          const pieces = [];
          upstream.on('data', b => pieces.push(b));
          upstream.on('end', () => {
            const bytes = Buffer.concat(pieces);
            if (request.method === 'POST' && url.pathname.endsWith('/portraits')) { forwarded.push({ status: upstream.statusCode, body: bytes.toString('utf8').slice(0, 2000) }); writeFileSync(`${out}/forwarded.json`, JSON.stringify(forwarded, null, 2)); }
            response.writeHead(upstream.statusCode, { 'Content-Type': upstream.headers['content-type'] ?? 'application/octet-stream' });
            response.end(bytes);
          });
          upstream.on('error', () => { response.writeHead(502); response.end(); });
        });
        q.on('error', () => { response.writeHead(502); response.end(); });
        q.end(body.length > 0 ? body : undefined);
      });
      return;
    }
    const path = resolve('web', url.pathname.slice(1));
    if (!path.startsWith(resolve('web'))) { response.writeHead(403); response.end(); return; }
    try {
      const bytes = readFileSync(path);
      response.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' }); response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const pageOrigin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
  const browser = await chromium.launch(), page = await browser.newPage();
  const errors = [], consoleLog = [], failedRequests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => consoleLog.push(`${message.type()}: ${message.text()}`.slice(0, 300)));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.slice(0, 300)));
  try {
    await page.goto(pageOrigin + '/harness.html');
    await page.waitForFunction(() => document.querySelector('#host canvas'));
    const file = page.locator('#host input[type=file]').first();
    const name = page.locator('#host input[placeholder]').first();
    const note = page.locator('#host p').nth(1);
    const boxes = page.locator('#host input[type=number]');
    const confirm = page.getByRole('button', { name: '确认裁剪' });
    const upload = page.getByRole('button', { name: '上传头像' });
    await file.setInputFiles(`${out}/select.png`);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#host button')).some(b => b.textContent.includes('确认裁剪') && !b.disabled));
    assert.equal(await boxes.nth(0).inputValue(), '50');
    assert.equal(await boxes.nth(1).inputValue(), '0');
    assert.equal(await boxes.nth(2).inputValue(), '100');
    check('browser-crop-defaults-centered');
    await name.fill('BrowserCrop');
    await confirm.click();
    await upload.click();
    try {
      await page.waitForFunction(() => document.querySelectorAll('#host p')[1].textContent.includes('已上传 BrowserCrop'), null, { timeout: 120000 });
    } catch (cause) {
      writeFileSync(`${out}/browser-failure.json`, JSON.stringify({ note: await note.textContent(), consoleLog, failedRequests, forwarded }, null, 2), { flag: 'wx' });
      throw cause;
    }
    check('browser-upload-lands-on-real-endpoint');
    const manifest = await page.evaluate(() => globalThis.__pack.manifest.portraits);
    assert.equal(manifest.length, 1);
    assert.equal(manifest[0].assetId, 'BrowserCrop');
    assert.equal(manifest[0].mime, 'image/png');
    check('browser-pack-manifest-refreshed');
    await page.waitForFunction(() => { const img = document.querySelector('#host img'); return img && img.complete && img.naturalWidth === 128 && img.naturalHeight === 128; }, null, { timeout: 120000 });
    check('browser-paint-serves-128');
    assert.deepEqual(errors, []);
    check('no-page-errors');
  } finally { await browser.close(); }
  assert.equal(forwarded.length, 1, 'exactly one proxied portrait POST');
  const created = parse(forwarded[0].body);
  assert.equal(forwarded[0].status, 200);
  assert.equal(created.mime, 'image/png');
  check('proxy-upload-response');
  const pack = parse((await ok('real-pack-manifest', `/api/trials/${trial.trialId}/pack`, undefined, admin)).bytes.toString('utf8'));
  assert.deepEqual(pack.manifest.portraits.find(row => row.assetId === 'BrowserCrop'), created);
  check('node-manifest-matches-upload');
  const served = await ok('real-asset-serve', `/api/trials/${trial.trialId}/assets/BrowserCrop`, undefined, admin);
  assert.equal(served.shaHeader, created.sha256); assert.equal(sha(served.bytes), created.sha256);
  const decoded = decodePNG(served.bytes);
  assert.equal(decoded.width, 128); assert.equal(decoded.height, 128);
  assert.ok(Buffer.from(decoded.pixels).equals(Buffer.from(expected)), 'served-crop-pixels');
  check('served-crop-exact-128');
  const file = `e2e-0.png`; writeFileSync(`${out}/${file}`, served.bytes, { flag: 'wx' });
  oracle.push({ file, width: 128, height: 128, pixelSHA: sha(expected) });
  writeFileSync(`${out}/oracle.json`, JSON.stringify(oracle, null, 2), { flag: 'wx' });
  {
    const reply = spawnSync('python', ['-B', 'tools/fixtures/trial_e2e_check.py', out, 'check'], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
    writeFileSync(`${out}/check.log`, reply.stdout ?? '', { flag: 'wx' }); writeFileSync(`${out}/check.err`, reply.stderr ?? '', { flag: 'wx' }); assert.equal(reply.status, 0, reply.stderr);
  }
  check('pillow-oracle-exact');
  await ok('real-trial-end', `/api/trials/${trial.trialId}/end`, {}, admin);
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, pins, oracleImages: oracle.length, gameId, trialId: trial.trialId, limits: 'Real Chromium drives the true UI module; /api proxied byte-identical to loopback HTTPS workerd with C-proven admin session injected server-side. No App boot (session/login UI, faction select, engine), no concurrent play, no publish UI; game-library public side not reclaimed.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Trial browser crop E2E PASS ${checks.length} checks ${oracle.length} Pillow images\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks }, null, 2)); server?.close(); await mf?.dispose(); }
