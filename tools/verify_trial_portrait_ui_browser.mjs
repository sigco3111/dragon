// TRIAL-PORTRAIT-UI-1: Trial shell author-confirmed square crop UI.
// Real Chromium + fresh profile + owned loopback static server serving web/.
// The module under test is imported for real; network is a stub fetchImpl, the
// pack is a stub object: this lane proves UI behavior (defaults, confirm gate,
// crop payload, rejection messages), NOT workerd auth or decode (A/C lanes).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-ui-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const inputs = ['web/src/editor/servertrialapp.js', 'server/public/trialweb.txt', 'tools/verify_trial_portrait_ui_browser.mjs'];
const pins = {};
for (const [i, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${i}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata'].includes(key.toLowerCase())) { env[key] = value; } }
env.PYTHONDONTWRITEBYTECODE = '1'; env.PYTHONUTF8 = '1';
{ // Owned 200x100 PNG select fixture (quantized blocks, well under 100KiB).
  const reply = spawnSync('python', ['-B', '-c', `from PIL import Image
img = Image.new('RGB', (200, 100))
px = img.load()
for y in range(100):
    for x in range(200):
        px[x, y] = ((x * 3) & 240, (y * 5) & 240, 200)
img.save('${out}/select.png')`], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(reply.status, 0, reply.stderr);
}
const big = Buffer.alloc(100 * 1024 + 1, 7); writeFileSync(`${out}/big.jpg`, big, { flag: 'wx' });
writeFileSync(`${out}/bad.txt`, 'not an image', { flag: 'wx' });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/harness.html') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><html><body><div id="host"></div><script type="module">
import { mountPortraitUploads } from '/src/editor/servertrialapp.js';
const calls = [];
let pack = { manifest: { portraits: [] } };
const ui = mountPortraitUploads({ documentTarget: document, fetchImpl: async (url, init) => {
  calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
  if (url.endsWith('/pack')) { return { ok: true, json: async () => pack }; }
  const created = { assetId: JSON.parse(init.body).assetId, mime: 'image/png', byteLength: 1000, url: '/asset' };
  pack = { manifest: { portraits: [created] } };
  return { ok: true, json: async () => created };
}, trialId: '33333333-3333-4333-8333-333333333333', getPack: () => pack, setPack: (next) => { pack = next; } });
document.getElementById('host').append(ui.element);
globalThis.__calls = calls;
</script></body></html>`);
    return;
  }
  const path = resolve('web', url.pathname.slice(1));
  if (!path.startsWith(resolve('web'))) { response.writeHead(403); response.end(); return; }
  try {
    const bytes = readFileSync(path);
    response.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
const checks = [];
try {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
  const browser = await chromium.launch(), page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin + '/harness.html');
  await page.waitForFunction(() => document.querySelector('#host canvas'));
  const file = page.locator('#host input[type=file]').first();
  const note = page.locator('#host p').nth(1);
  const status = page.locator('#host p').last();
  const boxes = page.locator('#host input[type=number]');
  const confirm = page.getByRole('button', { name: '确认裁剪' });
  const upload = page.getByRole('button', { name: '上传头像' });
  const calls = () => page.evaluate(() => globalThis.__calls.length);
  // 1. Defaults for the 200x100 fixture: centered max square + preview ready.
  await file.setInputFiles(`${out}/select.png`);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#host button')).some(b => b.textContent.includes('确认裁剪') && !b.disabled));
  assert.equal(await boxes.nth(0).inputValue(), '50');
  assert.equal(await boxes.nth(1).inputValue(), '0');
  assert.equal(await boxes.nth(2).inputValue(), '100');
  assert.match(await status.textContent(), /200×100.*\(50, 0\) 100×100/);
  checks.push('crop-defaults-centered');
  // 2. Upload before confirm is blocked with guidance, no fetch.
  await upload.click();
  assert.match(await note.textContent(), /确认裁剪/);
  assert.equal(await calls(), 0);
  checks.push('upload-blocked-before-confirm');
  // 3. Confirm then upload posts source bytes + the rectangle.
  await confirm.click();
  await upload.click();
  await page.waitForFunction(() => globalThis.__calls.length === 2);
  const posted = await page.evaluate(() => globalThis.__calls[0].body);
  assert.deepEqual(posted.crop, { x: 50, y: 0, side: 100 });
  assert.equal(posted.dataBase64, readFileSync(`${out}/select.png`).toString('base64'));
  assert.match(posted.assetId, /^[A-Za-z]{1,32}$/);
  assert.match(await note.textContent(), /已上传/);
  checks.push('confirmed-upload-posts-source-and-crop');
  // 4. Editing the rectangle clears confirmation and blocks upload again.
  // (Upload success resets the crop state, so select the file afresh.)
  await file.setInputFiles(`${out}/select.png`);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#host button')).some(b => b.textContent.includes('确认裁剪') && !b.disabled));
  await confirm.click();
  await boxes.nth(2).fill('60');
  assert.match(await status.textContent(), /60×60.*请确认/);
  await upload.click();
  assert.match(await note.textContent(), /确认裁剪/);
  assert.equal(await calls(), 2);
  checks.push('edit-clears-confirmation');
  // 5. Rejections: wrong type and oversize never reach fetch.
  await file.setInputFiles(`${out}/bad.txt`);
  await page.waitForFunction(() => [...document.querySelectorAll('#host p')].at(-1).textContent.includes('JPG'));
  assert.equal(await calls(), 2);
  checks.push('reject-wrong-type');
  await file.setInputFiles(`${out}/big.jpg`);
  await page.waitForFunction(() => [...document.querySelectorAll('#host p')].at(-1).textContent.includes('100KB'));
  assert.equal(await calls(), 2);
  checks.push('reject-oversize');
  assert.deepEqual(errors, []);
  checks.push('no-page-errors');
  await browser.close();
  for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], name); }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, pins, limits: 'Real Chromium UI behavior only: stub network/pack, no workerd auth, no decode, no App boot.' }, null, 2), { flag: 'wx' });
  process.stdout.write(`Trial portrait UI PASS ${checks.length} checks\n`);
} finally { writeFileSync(`${out}/partial.json`, JSON.stringify({ checks }, null, 2)); server.close(); }
