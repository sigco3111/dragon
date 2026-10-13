// Isolated real workerd/SQLite/R2 + fresh Chromium portrait lifecycle.
// No user profile/SAVE, no mock API/SQL writes, no old evidence root reuse.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { request } from 'node:https';
import { spawnSync } from 'node:child_process';
import { stageInstalledEditorSource } from './editor_stage_source.mjs';
import { stageInstalledAvailableLibrary } from './editor_stage_library.mjs';
import { encodePNG, decodePNG } from '../server/pngio.js';

const scope = process.argv[2];
assert.match(scope ?? '', /^[a-zA-Z0-9-]{1,64}$/);
const safety = process.argv[3] === 'safety';
assert.equal(process.argv.length, safety ? 4 : 3);
const out = resolve('.dragon-analysis/editor-phase', scope);
mkdirSync(out); // Exclusive evidence root, never overwrite a sealed lane.
const own = mkdtempSync(join(tmpdir(), 'dragon-workerd-portrait-'));
const origin = 'https://127.0.0.1:18977';
const require = createRequire(import.meta.url);
const { Miniflare } = await import(process.env.MINIFLARE_MODULE || 'file:///C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const initial = randomBytes(16).toString('hex'), password = randomBytes(16).toString('hex');
const checks = [], calls = [], pageErrors = [], consoleErrors = [], outside = [], failedRequests = [], browserResponses = [];
let consolePhase = 'bootstrap';
const started = Date.now();
writeFileSync(join(out, 'browser-responses.ndjson'), '', { flag: 'wx' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = name => { checks.push(name); process.stdout.write(`${name}\n`); writeFileSync(join(out, 'partial.json'), JSON.stringify({ elapsedMs: Date.now() - started, checks, calls, pageErrors, consoleErrors, outside }, null, 2)); };
const parse = bytes => { try { return JSON.parse(bytes); } catch (cause) { throw new Error('owned workerd response JSON', { cause }); } };
function req(path, value, session, extra = {}) {
  return new Promise((done, reject) => {
    const headers = { Origin: origin, ...extra };
    if (session) { headers.Cookie = session.cookie; headers['X-CSRF-Token'] = session.csrf; }
    if (value !== undefined) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] ??= randomUUID(); }
    const q = request(origin + path, { method: value === undefined ? 'GET' : 'POST', headers, rejectUnauthorized: false, agent: false }, response => {
      const chunks = []; response.on('data', b => chunks.push(b)); response.on('error', reject);
      response.on('end', () => { const bytes = Buffer.concat(chunks); calls.push({ path, status: response.statusCode }); done({ status: response.statusCode, bytes, cookie: response.headers['set-cookie']?.[0]?.split(';')[0], mime: response.headers['content-type'], contentSha: response.headers['x-content-sha256'] }); });
    });
    q.on('error', reject); q.setTimeout(300000, () => q.destroy(new Error('owned HTTPS timeout')));
    q.end(value === undefined ? undefined : JSON.stringify(value));
  });
}
const ok = async (path, value, session, status = 200, extra) => { const r = await req(path, value, session, extra); assert.equal(r.status, status, `${path}: ${r.bytes.toString().slice(0, 160)}`); return parse(r.bytes); };
let mf, browser, playPage;
let rawJPEG, jpegReference, uploadedJPEG;
try {
  if (safety) {
    const allowedEnv = new Set(['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata']);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowedEnv.has(key.toLowerCase())));
    Object.assign(env, { PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' });
    const generated = spawnSync('python', ['-B', 'tools/fixtures/portrait_api_jpeg.py', scope], { env, encoding: 'utf8', timeout: 30000 });
    assert.equal(generated.status, 0, generated.stderr);
    jpegReference = parse(generated.stdout);
    rawJPEG = readFileSync(join(out, 'raw-api-jpeg.jpg'));
    assert.equal(sha(rawJPEG), jpegReference.sourceSha256);
    writeFileSync(join(out, 'jpeg-reference.json'), JSON.stringify(jpegReference, null, 2), { flag: 'wx' });
  }
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("stage")}}', compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], r2Buckets: ['EDITOR_BLOBS'], r2Persist: own });
  const bucket = await mf.getR2Bucket('EDITOR_BLOBS');
  const source = await stageInstalledEditorSource(bucket);
  const library = await stageInstalledAvailableLibrary(bucket);
  writeFileSync(join(out, 'staged.json'), JSON.stringify({ source, library }, null, 2), { flag: 'wx' });
  check('fresh-approved-source-and-library-staged');
  await mf.dispose(); mf = null;
  mf = new Miniflare({ modules: true, scriptPath: resolve('server/worker.js'), rootPath: resolve('server'), modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.txt', '**/*.html', '**/*.css'] }], compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'], durableObjects: { EDITOR_METADATA: { className: 'EditorMetadata', useSQLite: true } }, r2Buckets: ['EDITOR_BLOBS'], r2Persist: own, durableObjectsPersist: own, bindings: { EDITOR_ORIGIN: origin, EDITOR_REQUEST_KEY: randomBytes(32).toString('hex'), EDITOR_DEFAULT_PASSWORD: initial, EDITOR_INSTALLED_SOURCE_ROOT: JSON.stringify(source), EDITOR_AVAILABLE_LIBRARY_ROOT: JSON.stringify(library) }, https: true, port: 18977, host: '127.0.0.1' });
  await mf.ready;
  const lr = await req('/api/auth/login', { account: 'tianyi', password: initial }); assert.equal(lr.status, 200);
  const session = { cookie: lr.cookie, csrf: parse(lr.bytes).csrf };
  const rotated = await req('/api/auth/password', { oldPassword: initial, newPassword: password }, session); assert.equal(rotated.status, 200);
  const admin = { cookie: rotated.cookie, csrf: parse(rotated.bytes).csrf };
  await ok('/api/admin/source/install', {}, admin);
  await ok('/api/admin/library/install', {}, admin);
  const def = (await ok('/api/admin/source', undefined, admin)).definition;
  const key = randomUUID();
  await ok('/api/admin/copies', { registryId: def.registryId, name: '頭像鏈驗證', introduction: '' }, admin, 202, { 'Idempotency-Key': key });
  const copied = await ok(`/api/admin/copies/${key}/run`, {}, admin, 200, { 'If-Match': '"1"' });
  const gameId = copied.gameId;
  check('real-auth-rotate-install-full-copy');
  if (safety) {
    uploadedJPEG = await ok(`/api/games/${gameId}/portraits`, { assetId: 'RawJPEG', dataBase64: rawJPEG.toString('base64') }, admin, 201);
    assert.equal(uploadedJPEG.mime, 'image/png');
    assert.notEqual(uploadedJPEG.sha256, jpegReference.sourceSha256);
    assert.equal(uploadedJPEG.width, 128); assert.equal(uploadedJPEG.height, 128);
    const visible = await ok(`/api/games/${gameId}/portraits/RawJPEG`, undefined, admin);
    assert.deepEqual(visible, uploadedJPEG);
    check('public-api-raw-exif-jpeg-stored-as-canonical-png');
    const sof = rawJPEG.indexOf(Buffer.from([0xff, 0xc0]));
    assert.ok(sof >= 0);
    const malformed = [
      ['BadJPEGHeader', rawJPEG.subarray(0, sof + 19), 'PORTRAIT_JPEG_INVALID'],
      ['BadJPEGTail', Buffer.concat([rawJPEG, Buffer.from([1])]), 'PORTRAIT_JPEG_INVALID'],
      ['BadPNGHeader', encodePNG(new Uint8Array(128 * 128 * 4), 128, 128).subarray(0, 24), 'PORTRAIT_PNG_INVALID'],
    ];
    for (const [assetId, bytes, error] of malformed) {
      const rejected = await ok(`/api/games/${gameId}/portraits`, { assetId, dataBase64: bytes.toString('base64') }, admin, 422);
      assert.equal(rejected.error, error);
      const missing = await ok(`/api/games/${gameId}/portraits/${assetId}`, undefined, admin, 404);
      assert.equal(missing.error, 'PORTRAIT_NOT_FOUND');
    }
    assert.deepEqual(await ok(`/api/games/${gameId}/portraits/RawJPEG`, undefined, admin), uploadedJPEG);
    check('public-api-malformed-png-jpeg-rejected-assets-absent');
  }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__idbOpens = 0; const open = indexedDB.open.bind(indexedDB); indexedDB.open = (...args) => { window.__idbOpens++; return open(...args); }; });
  const watchContext = context => {
    context.on('request', r => { if (r.url().startsWith('http') && new URL(r.url()).origin !== origin) outside.push(r.url()); });
    context.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
    context.on('response', r => { if (new URL(r.url()).origin === origin && new URL(r.url()).pathname.startsWith('/api/')) { const event = { path: new URL(r.url()).pathname, status: r.status(), elapsedMs: Date.now() - started }; browserResponses.push(event); appendFileSync(join(out, 'browser-responses.ndjson'), JSON.stringify(event) + '\n'); } });
  };
  watchContext(ctx);
  const watch = page => { page.on('pageerror', e => pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), url: m.location().url, phase: consolePhase }); }); };
  const page = await ctx.newPage(); watch(page);
  const home = await page.goto(origin + '/');
  const csp = home.headers()['content-security-policy'];
  assert.ok(csp.includes("img-src 'self' blob:") && csp.includes("script-src 'self';") && !csp.includes('data:') && !csp.includes('unsafe-eval'));
  await page.fill('#login input[name=account]', 'tianyi'); await page.fill('#login input[name=password]', password); await page.click('#login button');
  await page.waitForSelector('#session:not([hidden])');
  for (const id of ['stronghold-editor', 'generals-editor', 'mapview-editor', 'copy', 'admin', 'draft-editor']) {
    await page.locator(`#menu button[data-view="${id}"]`).click();
    assert.equal(await page.locator('#' + id).isVisible(), true, `menu view visible: ${id}`);
  }
  await page.locator('#menu button[data-view="copy"]').click();
  await page.click('#source-refresh');
  await page.waitForFunction(() => document.querySelector('#own-games').textContent.includes('頭像鏈驗證'), null, { timeout: 180000 });
  assert.equal(await page.locator('#generals-editor').isVisible(), false);
  await page.waitForFunction(() => !document.querySelector('#source-refresh').disabled);
  assert.equal(await page.locator('#own-games button').first().isEnabled(), true);
  check('real-shell-menu-and-game-list-owner-view');
  await page.locator('#menu button[data-view="generals-editor"]').click();
  assert.equal(await page.locator('#generals-editor').isVisible(), true, 'generals visible through real shell menu');
  check('real-shell-generals-visible');
  await page.click('#generals-refresh');
  await page.waitForFunction(() => document.querySelector('#generals-chapters')?.children.length > 0, null, { timeout: 180000 });
  assert.equal(await page.locator('#copy').isVisible(), false, 'render does not reopen other views');
  const chapterId = `${gameId}#upper-1`;
  const draft = await ok(`/api/games/${gameId}/draft?revision=1`, undefined, admin);
  const chapter = draft.chapters.find(c => c.chapterId === chapterId);
  assert.ok(chapter);
  const first = chapter.generals.find(g => g.idx === 7), second = chapter.generals.find(g => g.idx === 93);
  const third = safety ? chapter.generals.find(g => g.idx === 94) : null;
  assert.ok(first && second && (!safety || third));
  const paint = async (assetId, color) => {
    const pixels = new Uint8Array(256 * 128 * 3); for (let at = 0; at < pixels.length; at += 3) pixels.set(color, at);
    await page.setInputFiles('#portrait-file', { name: `${assetId}.png`, mimeType: 'image/png', buffer: encodePNG(pixels, 256, 128, 3) });
    await page.waitForFunction(() => !document.querySelector('#portrait-confirm').disabled);
    await page.fill('#portrait-id', assetId); await page.click('#portrait-confirm');
    const response = page.waitForResponse(r => r.url().endsWith(`/api/games/${gameId}/portraits`) && r.request().method() === 'POST', { timeout: 60000 });
    await page.click('#portrait-upload'); assert.equal((await response).status(), 201);
    await page.waitForFunction(id => document.querySelector('#portrait-library').textContent.includes(id), assetId, { timeout: 180000 });
  };
  await paint('First', [255, 0, 0]); await paint('Second', [0, 0, 255]);
  check('ui-source-crop-confirm-two-uploads');
  const bind = async (general, keyValue, clear = false) => {
    const row = page.locator('#generals-chapters > div').filter({ has: page.locator('p', { hasText: `#${general.idx} ${general.name}（` }) }).first();
    if (!clear) page.once('dialog', d => d.accept(keyValue));
    const saved = page.waitForResponse(r => r.url().endsWith(`/api/games/${gameId}/draft/save`), { timeout: 180000 });
    await row.getByRole('button', { name: clear ? '清除頭像綁定' : '綁定頭像', exact: true }).click();
    assert.equal((await saved).status(), 200);
    // The same idx exists in twenty chapters: only this target row proves UI refresh.
    // In particular, another chapter's unbound row must not satisfy the clear check.
    await row.locator('p').filter({ hasText: `頭像 ${clear ? '原圖' : keyValue}` }).waitFor({ state: 'visible', timeout: 180000 });
    await page.waitForFunction(() => !document.querySelector('#generals-refresh').disabled, null, { timeout: 180000 });
  };
  await bind(first, 'First'); await bind(second, 'Second');
  if (safety) { await bind(third, 'RawJPEG'); }
  const publishedRevision = safety ? '4' : '3', clearedRevision = safety ? '5' : '4';
  const saved = await ok(`/api/games/${gameId}/draft?revision=${publishedRevision}`, undefined, admin);
  assert.equal(saved.chapters.find(c => c.chapterId === chapterId).generals.find(g => g.idx === first.idx).portraitKey, 'First');
  assert.equal(saved.chapters.find(c => c.chapterId === chapterId).generals.find(g => g.idx === second.idx).portraitKey, 'Second');
  if (safety) { assert.equal(saved.chapters.find(c => c.chapterId === chapterId).generals.find(g => g.idx === third.idx).portraitKey, 'RawJPEG'); }
  check(safety ? 'ui-bind-three-generals-saved-revision-four' : 'ui-bind-two-generals-saved-revision-three');
  // Existing publishing API has no workbench publish button: explicit scope limit.
  const pin = await ok('/api/publish', { gameId, name: '頭像鏈驗證' }, admin);
  const pack = await ok(`/api/trial-pack?game=${gameId}&chapter=${encodeURIComponent(chapterId)}`, undefined, null);
  assert.equal(pack.manifest.identity.draftRevision, publishedRevision);
  assert.equal(pack.manifest.portraits.length, safety ? 3 : 2);
  for (const entry of pack.manifest.portraits) {
    const r = await req(entry.url); assert.equal(r.status, 200); assert.equal(sha(r.bytes), entry.sha256);
    if (safety) {
      assert.equal(entry.mime, 'image/png'); assert.equal(r.mime, 'image/png');
      assert.equal(r.bytes.length, entry.byteLength);
      if (entry.assetId === 'RawJPEG') {
        assert.equal(entry.sha256, uploadedJPEG.sha256);
        assert.equal(entry.byteLength, uploadedJPEG.byteLength);
        const decoded = decodePNG(r.bytes);
        assert.equal(sha(decoded.pixels), jpegReference.referenceRGBASha256);
        assert.equal(r.bytes.includes(Buffer.from('Exif\0\0')), false);
        writeFileSync(join(out, 'published-jpeg-as-png.png'), r.bytes, { flag: 'wx' });
      }
    }
  }
  if (safety) { check('anonymous-frozen-jpeg-png-mime-length-sha-and-exact-rgba'); }
  check('real-publish-api-frozen-pack-and-anonymous-bytes');
  const fixed = parse(readFileSync('server/available-library.txt')).resources;
  for (const path of ['kao/7.png', 'grf/sfx/ynsound-record3.wav', 'grf/sfx/ynsound-record13.wav']) {
    const r = await req('/api/play/web/' + path);
    assert.equal(r.status, 200); assert.equal(sha(r.bytes), fixed[path].sha256); assert.equal(r.contentSha, fixed[path].sha256); assert.equal(r.mime, fixed[path].mime);
  }
  for (const path of ['server/pinned/world-manifest.txt', 'grf/not-in-library.png', 'content/builtin/compiled/not-a-public-role.json']) assert.equal((await req('/api/play/web/' + path)).status, 404);
  assert.equal((await req('/api/play/web/kao/7.png?v=unknown')).status, 422);
  check('anonymous-shared-registry-bytes-and-unknown-path-query-rejection');
  // Complete authoring first, then boot the immutable published revision.
  // This serial lifecycle does NOT certify simultaneous gameplay/save transport.
  await page.click('#portrait-list');
  await page.waitForFunction(() => document.querySelector('#portrait-library').textContent.includes('使用中'), null, { timeout: 180000 });
  const libRow = page.locator('#portrait-library > div').filter({ hasText: 'First／' });
  consolePhase = 'delete-inuse';
  // Deletion rereads the current saved source to check all portrait references.
  const rejected = page.waitForResponse(r => r.url().endsWith(`/portraits/First`) && r.request().method() === 'POST', { timeout: 180000 });
  await libRow.getByRole('button', { name: '刪除', exact: true }).click(); assert.equal((await rejected).status(), 409);
  check('ui-in-use-delete-rejected');
  await bind(first, null, true);
  const finalDraft = await ok(`/api/games/${gameId}/draft?revision=${clearedRevision}`, undefined, admin);
  assert.equal(finalDraft.chapters.find(c => c.chapterId === chapterId).generals.find(g => g.idx === first.idx).portraitKey, null);
  check(safety ? 'ui-clear-binding-committed-revision-five' : 'ui-clear-binding-committed-revision-four');
  consolePhase = 'anonymous-boot';
  const playCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  watchContext(playCtx);
  const play = await playCtx.newPage(); playPage = play; watch(play);
  const playHome = await play.goto(`${origin}/play?game=${gameId}`);
  assert.ok(playHome.headers()['content-security-policy'].includes("base-uri 'self'"));
  assert.equal(await play.evaluate(() => document.baseURI), origin + '/api/play/web/');
  await play.waitForFunction(() => document.querySelector('#play-faction')?.options.length > 0, null, { timeout: 180000 });
  check('anonymous-real-faction-selection-ready');
  await play.click('#start-play');
  await play.waitForFunction(() => window.__dragonApp?.scenario && document.querySelector('#play-status').textContent.includes('進行中'), null, { timeout: 180000 });
  check('anonymous-real-app-running');
  const resolved = await play.evaluate(async includeJPEG => Promise.race([(async () => {
    const app = window.__dragonApp;
    const { portrait, portraitURL } = await import('/api/play/web/src/core/assets.js');
    const generals = app.scenario.generals.filter(g => g.idx === 7 || g.idx === 93 || (includeJPEG && g.idx === 94));
    return Promise.all(generals.map(async g => {
      const img = await portrait(g, app.world); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      canvas.getContext('2d').drawImage(img, 0, 0, 128, 128);
      const pixels = canvas.getContext('2d').getImageData(0, 0, 128, 128).data;
      let color = [96, 96, 96, 255];
      if (g.idx === 7) { color = [255, 0, 0, 255]; }
      else if (g.idx === 93) { color = [0, 0, 255, 255]; }
      return { idx: g.idx, key: g.portraitKey, byte: g.portrait, url: portraitURL(g, app.world), pixelMatch: pixels.every((v, i) => v === color[i % 4]) };
    }));
  })(), new Promise((_, reject) => setTimeout(() => reject(new Error('owned anonymous portrait resolution timeout')), 180000))]), safety);
  assert.equal(resolved.length, safety ? 3 : 2); assert.equal(resolved[0].byte, resolved[1].byte); assert.ok(resolved.every(r => r.pixelMatch)); assert.notEqual(resolved[0].url, resolved[1].url);
  assert.equal(resolved.find(r => r.idx === 7).key, 'First'); assert.equal(resolved.find(r => r.idx === 93).key, 'Second');
  if (safety) { assert.equal(resolved.find(r => r.idx === 94).key, 'RawJPEG'); }
  check(safety ? 'anonymous-real-app-three-entity-png-jpeg-portraits-all-pixels' : 'anonymous-real-app-two-entity-portraits-all-pixels');
  assert.equal(await page.evaluate(() => window.__idbOpens), 0); assert.deepEqual(pageErrors, []); assert.deepEqual(outside, []);
  const unexpectedConsole = consoleErrors.filter(e => !(
    (e.phase === 'bootstrap' && e.url === `${origin}/api/session` && /401/.test(e.text)) ||
    (e.phase === 'delete-inuse' && e.url === `${origin}/api/games/${gameId}/portraits/First` && /409/.test(e.text))
  ));
  assert.deepEqual(unexpectedConsole, []); assert.deepEqual(failedRequests, []);
  check('editor-idb-zero-errors-outside-zero');
  writeFileSync(join(out, 'receipt.json'), JSON.stringify({ checks, calls, gameId, pin, resolved, jpegReference, uploadedJPEG, safetyPublicAPI: safety, pageErrors, consoleErrors, outside, failedRequests, browserResponses, limits: 'UI upload/bind/clear + real publishing API + anonymous App. Serial lifecycle only; no simultaneous gameplay/save transport certificate. No publish UI, image-safety/full-release/whole-consumer certification; fresh anonymous profile only.', inputHashes: Object.fromEntries(['server/public/index.html', 'server/public/client.txt', 'server/public/general.txt', 'server/public/trialweb.txt', 'server/available-library.txt', 'server/worker.js', 'server/portraits.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js', 'server/pngio.js', 'tools/verify_workerd_portrait_browser.mjs', ...(safety ? ['tools/fixtures/portrait_api_jpeg.py'] : [])].map(p => [p, sha(readFileSync(p))])) }, null, 2), { flag: 'wx' });
  process.stdout.write(`workerd portrait browser PASS ${checks.length} checks\n`);
} catch (error) {
  const playState = playPage && !playPage.isClosed() ? await playPage.evaluate(() => ({ status: document.querySelector('#play-status')?.textContent, hasScenario: Boolean(window.__dragonApp?.scenario) })).catch(() => null) : null;
  writeFileSync(join(out, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, playState, checks, calls, pageErrors, consoleErrors, outside, failedRequests, browserResponses }, null, 2), { flag: 'wx' });
  throw error;
} finally { if (browser) await browser.close(); if (mf) await mf.dispose(); }
