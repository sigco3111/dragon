// Actual shared editor static routing/headers/HTML/modules in a fresh browser;
// controlled API responses. No real login, authority DB, cloud, game or user profile.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
register('../vps/text-loader.mjs', import.meta.url);
const { default: gateway } = await import('../server/editorapp.js');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const root = '.dragon-analysis/release-readiness'; mkdirSync(root, { recursive: true }); const out = mkdtempSync(join(root, 'publication-ui-browser-'));
const origin = 'https://owned-editor.invalid', G = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', A = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', R = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const time = '2026-10-15T00:00:00.000Z', journalKey = 'editor-publication-operation:' + A;
const files = { '/': 'index.html', '/style.css': 'style.css', '/client.js':'client.txt', '/draft.js':'draft.txt', '/stage.js':'stage.txt', '/library.js':'library.txt', '/catalog.js':'catalog.txt', '/management.js':'management.txt', '/publish.js':'publish.txt', '/stronghold.js':'stronghold.txt', '/general.js':'general.txt', '/mapview.js':'mapview.txt', '/stage-assets.js':'stageassets.txt' };
const payloads = new Map(Object.entries(files).map(([url, file]) => [url, readFileSync('server/public/' + file)]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(systemroot|windir|path|pathext|temp|tmp|comspec|appdata|localappdata)$/i.test(k)));
const errors = [], outside = [], failed = [], posts = [], calls = [], expectedErrors = [], checks = [], consoleErrors = [];
let browser, stage = 'launch', responseMode = 'lost', statusMode = 'pending', sessionId = A, sessionVersion = 1, queryCount = 0;
const records = new Map();
function parsed(text) { try { return JSON.parse(text); } catch (cause) { throw new Error('bad owned request', { cause }); } }
try {
 for (const [path, expected] of payloads) {
  const response = await gateway.fetch(new Request(origin + path), {});
  assert.equal(response.status, 200, path);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, path);
  let mime = /^text\/javascript/;
  if (path === '/') mime = /^text\/html/;
  else if (path.endsWith('.css')) mime = /^text\/css/;
  assert.match(response.headers.get('Content-Type'), mime);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self'/);
 }
 browser = await chromium.launch({ headless: true, env }); const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
 await context.addInitScript(() => { window.__ownedIDB = 0; indexedDB.open = () => { window.__ownedIDB++; throw new Error('IDB forbidden'); }; });
 await context.route('**/*', async route => {
  const request = route.request(); let url; try { url = new URL(request.url()); } catch { outside.push(request.url()); return route.abort(); }
  calls.push({ path: url.pathname, method: request.method() });
  if (url.origin !== origin) { outside.push(url.href); return route.abort(); }
  const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(value) });
  if (payloads.has(url.pathname)) {
   const response = await gateway.fetch(new Request(request.url(), { method: request.method() }), {});
   return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  }
  if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
  if (url.pathname === '/api/session') return json({ user: { id: sessionId, account: 'owned_author', role: 'author', version: sessionVersion, mustChangePassword: false }, csrf: 'owned-csrf-only' });
  if (url.pathname === '/api/games') return json({ games: [{ gameId: G, metadata: { name: '原名稱', introduction: '' }, listed: false, draftRevision: '3' }] });
  if (url.pathname === '/api/publish') {
   assert.equal(request.method(), 'POST'); assert.equal(request.headers()['x-csrf-token'], 'owned-csrf-only');
   const key = request.headers()['idempotency-key'], body = parsed(request.postData()); posts.push({ key, body }); assert.match(key, /^[a-f0-9-]{36}$/);
   if (responseMode === 'uncommitted') { expectedErrors.push(503); return json({ error: 'OWNED_UNKNOWN_RESPONSE' }, 503); }
   if (!records.has(key)) records.set(key, { gameId: G, name: body.name.trim(), revision: '3', sourceDigest: 'd'.repeat(64), chapters: [G + '#chapter-1'], publishedAt: time, ordinal: '1.0' });
   if (responseMode === 'lost') { expectedErrors.push(503); return json({ error: 'OWNED_LOST_RESPONSE' }, 503); }
   return json(records.get(key));
  }
  if (url.pathname.startsWith('/api/games/' + G + '/publish-operations/')) {
   queryCount++; const key = url.pathname.split('/').at(-1);
   if (statusMode === 'unavailable') { expectedErrors.push(503); return json({ error: 'DISTRIBUTION_NOT_CONFIGURED' }, 503); }
   if (!records.has(key) || statusMode === 'absent') { expectedErrors.push(404); return json({ error: 'PUBLISH_OPERATION_NOT_FOUND' }, 404); }
   return json({ version: 1, gameId: G, releaseId: R, pin: records.get(key), distribution: { gameId: G, operationId: R, generation: 1, kind: 'publish', state: statusMode, visibleAt: statusMode === 'confirmed' ? time : null, recoveryRequired: false } });
  }
  outside.push(url.href); return route.abort();
 });
 const page = await context.newPage(); page.setDefaultTimeout(15000);
 page.on('pageerror', e => errors.push(String(e))); page.on('requestfailed', r => failed.push(r.url()));
 page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
 page.on('dialog', d => d.accept());
 const show = async () => { await page.waitForSelector('#menu button[data-view="publish-editor"]'); await page.click('#menu button[data-view="publish-editor"]'); await page.waitForSelector('#publish-form'); };
 const idle = () => page.waitForFunction(() => !document.querySelector('#publish-games-refresh').disabled);
 const journal = () => page.evaluate(k => sessionStorage.getItem(k), journalKey);
 stage = 'lost POST retains exact key and raw body'; await page.goto(origin); await show(); await page.click('#publish-games-refresh'); await idle();
 await page.fill('#publish-name', '  原名稱  '); await page.click('#publish-button'); await idle();
 assert.equal(posts.length, 1); assert.equal(queryCount, 0); assert.equal(parsed(await journal()).name, '  原名稱  '); assert.equal(parsed(await journal()).key, posts[0].key);
 assert.equal(await page.isDisabled('#publish-button'), true); assert.equal(await page.isDisabled('#publish-retry'), true); checks.push(stage);
 stage = 'reload restores only association, sends no POST or automatic status'; const before = calls.length; await page.reload(); await show();
 assert.equal(posts.length, 1); assert.equal(queryCount, 0); assert.equal(calls.slice(before).some(c => c.path === '/api/publish'), false); assert.match(await page.locator('#publish-operation').textContent(), new RegExp(posts[0].key)); checks.push(stage);
 stage = 'read-only recovery distinguishes local commit from visibility'; await page.click('#publish-query'); await idle(); assert.match(await page.locator('#publish-result').textContent(), /本地已提交.*分發待確認/); assert.equal(posts.length, 1); await page.locator('#publish-editor').screenshot({ path: join(out, 'pending.png') }); checks.push(stage);
 stage = 'unconfigured status does not authorize retry'; statusMode = 'unavailable'; await page.click('#publish-query'); await idle(); assert.match(await page.locator('#publish-message').textContent(), /尚未配置/); assert.equal(await page.isDisabled('#publish-retry'), true); checks.push(stage);
 stage = 'confirmed is historical, never claims currently listed'; statusMode = 'confirmed'; await page.click('#publish-query'); await idle(); assert.match(await page.locator('#publish-result').textContent(), /此次分發曾於.*不是目前上架/); await page.locator('#publish-editor').screenshot({ path: join(out, 'confirmed.png') }); checks.push(stage);
 stage = 'forget is local only'; await page.click('#publish-forget'); await idle(); assert.equal(await journal(), null); assert.equal(posts.length, 1); checks.push(stage);
 stage = '404 explicitly permits only exact-key/body retry'; await page.click('#publish-games-refresh'); await idle(); responseMode = 'uncommitted'; await page.fill('#publish-name', '  原名稱  '); await page.click('#publish-button'); await idle();
 assert.equal(posts.length, 2); const request = structuredClone(posts[1]); await page.click('#publish-query'); await idle(); assert.equal(await page.isDisabled('#publish-retry'), false);
 await page.fill('#publish-name', '不得夾帶'); responseMode = 'success'; statusMode = 'pending'; await page.click('#publish-retry'); await idle(); assert.equal(posts.length, 3); assert.deepEqual(posts[2], request); assert.match(await page.locator('#publish-result').textContent(), /分發待確認/); checks.push(stage);
 stage = 'identity version changes forbid resending original request'; sessionVersion = 2; statusMode = 'absent'; await page.reload(); await show(); await page.click('#publish-query'); await idle(); assert.equal(await page.isDisabled('#publish-retry'), true); assert.equal(posts.length, 3); checks.push(stage);
 stage = 'other actor does not see or consume the previous journal'; sessionId = R; sessionVersion = 1; await page.reload(); await show(); assert.equal(await page.locator('#publish-result').textContent(), ''); assert.equal((await page.locator('#publish-operation').textContent()).includes(request.key), false); assert.ok(await journal()); checks.push(stage);
 assert.equal(await page.evaluate(() => window.__ownedIDB), 0); assert.deepEqual(errors, []); assert.deepEqual(outside, []); assert.deepEqual(failed, []);
 assert.equal(consoleErrors.length, expectedErrors.length); for (const text of consoleErrors) assert.match(text, /Failed to load resource: the server responded with a status of (404|503)/);
 await page.screenshot({ path: join(out, 'isolated-editor.png') });
 const result = { checks, posts: posts.length, queryCount, expectedHTTPFailures: expectedErrors.length, unexpectedErrors: errors, outside, failed, browser: browser.version(), sources: Object.fromEntries(Object.entries(files).map(([url, name]) => ['server/public/' + name, sha(payloads.get(url))])), screenshotSHA: sha(readFileSync(join(out, 'isolated-editor.png'))), stateScreenshots: Object.fromEntries(['pending.png','confirmed.png'].map(name => [name, sha(readFileSync(join(out, name)))])), staticRoutes: payloads.size, scope: 'actual common static routing/headers/HTML/client in fresh browser; API responses controlled, no authority/compiler/R2/browser full-chain claim' };
 writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' }); process.stdout.write(JSON.stringify({ ...result, sources: 'in owned artifact', artifact: out }) + '\n');
} catch (error) { writeFileSync(join(out, 'failure.json'), JSON.stringify({ stage, error: String(error), stack: error.stack, errors, consoleErrors, outside, failed, posts: posts.length }, null, 2), { flag: 'wx' }); throw error; }
finally { await browser?.close(); }
