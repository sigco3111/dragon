// Focused portrait UI contract test: actual served HTML/general.txt, fresh Chromium.
// API/session data are injected IN-MEMORY fixtures, not workerd/auth/publish proof.
// No game engine, DOS files, user profile or IndexedDB. Only owned loopback server.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const files = ['server/public/index.html', 'server/public/general.txt'];
const inputs = Object.fromEntries(files.map(path => [path, readFileSync(path)]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = Object.fromEntries(files.map(path => [path, sha(inputs[path])]));
const html = inputs[files[0]].toString('utf8').replace('<script src="/client.js" type="module"></script>', '').replace('<link rel="stylesheet" href="/style.css">', '');
const outside = [], errors = [], checks = [];
const server = createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (!['/', '/general.js'].includes(req.url)) { outside.push(req.url); res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(req.url === '/' ? html : inputs[files[1]]);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
let browser;
const check = async (name, fn) => { await fn(); checks.push(name); };
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    window.idbCalls = 0;
    window.objectUrls = []; window.revokedUrls = [];
    const makeUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = makeUrl(value); window.objectUrls.push(url); return url; };
    URL.revokeObjectURL = url => { window.revokedUrls.push(url); revokeUrl(url); };
    indexedDB.open = () => { window.idbCalls++; throw new Error('IDB forbidden'); };
    const { installGenerals } = await import('/general.js');
    const user = { user: { id: 'owner', mustChangePassword: false } };
    const games = [{ gameId: 'first', draftRevision: '1', metadata: { name: '甲' } }, { gameId: 'second', draftRevision: '1', metadata: { name: '乙' } }];
    const rosters = { first: [{ idx: 0, name: '甲將', portraitKey: 'Bound' }, { idx: 1, name: '乙將' }], second: [{ idx: 0, name: '丙將' }] };
    window.calls = []; window.failSave = false; window.busy = false; window.actionErrors = [];
    const api = async (path, body, options) => {
      window.calls.push({ path, body, options });
      if (path === '/api/games') return structuredClone({ games });
      const game = games.find(g => path.startsWith(`/api/games/${g.gameId}/`));
      if (!game) throw new Error('unexpected API fixture path');
      if (path.includes('/draft/save')) {
        if (window.failSave) throw new Error('fixture save rejected');
        for (const edit of body.chapterEdits) {
          const general = rosters[game.gameId].find(g => g.idx === edit.generalIdx);
          if (edit.portraitKey === null) delete general.portraitKey;
          else general.portraitKey = edit.portraitKey;
        }
        game.draftRevision = String(BigInt(game.draftRevision) + 1n);
        return {};
      }
      if (path.includes('/draft?')) return structuredClone({ metadata: game.metadata, chapters: [{ chapterId: 'chapter', name: '一', generals: rosters[game.gameId], factions: [] }] });
      if (path.endsWith('/portraits')) {
        if (body) {
          const bytes = Uint8Array.from(atob(body.dataBase64), c => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
          window.uploaded = { gameId: game.gameId, width: bitmap.width, height: bitmap.height, center: Array.from(ctx.getImageData(64, 64, 1, 1).data), length: bytes.length };
          bitmap.close();
          return {};
        }
        return { portraits: [] };
      }
      throw new Error('unexpected API fixture operation');
    };
    const work = async fn => {
      if (window.busy) return;
      window.busy = true;
      const controls = [...document.querySelectorAll('button,input,select,textarea')];
      controls.forEach(el => { el.disabled = true; });
      try { await fn(); } catch (error) { window.actionErrors.push(error.message); }
      finally { window.busy = false; controls.forEach(el => { el.disabled = false; }); window.ui.render(); }
    };
    window.ui = installGenerals({ api, authority: () => user, work, isBusy: () => window.busy });
    window.user = user;
    window.ui.setIdentity(user);
    document.querySelector('#session').hidden = false;
    document.querySelector('#admin').hidden = false;
    window.originalImage = window.Image;
    window.originalToBlob = HTMLCanvasElement.prototype.toBlob;
    window.postCount = () => window.calls.filter(call => call.body !== undefined).length;
    window.uploadCount = () => window.calls.filter(call => call.body?.dataBase64).length;
  });
  const idle = () => page.waitForFunction(() => !window.busy);
  const invokeUpload = () => page.evaluate(() => document.querySelector('#portrait-upload').onclick());
  const choose = async (buffer, mimeType = 'image/png') => { await page.setInputFiles('#portrait-file', { name: 'source.png', mimeType, buffer }); };
  const reset = async () => {
    await page.evaluate(() => { window.ui.setIdentity(null); window.ui.setIdentity(window.user); });
    await page.click('#generals-refresh'); await idle();
  };
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = '#0000ff'; ctx.fillRect(128, 0, 128, 128);
    return Array.from(new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()));
  }));
  const ready = () => page.waitForFunction(() => !document.querySelector('#portrait-confirm').disabled);
  const move = (id, value) => page.evaluate(({ id, value }) => { const el = document.querySelector('#' + id); el.value = String(value); el.dispatchEvent(new Event('input')); }, { id, value });
  await page.click('#generals-refresh'); await idle();
  await check('clear-binding-button-sends-null-and-refreshes', async () => {
    await page.getByRole('button', { name: '清除頭像綁定' }).click(); await idle();
    const saves = await page.evaluate(() => window.calls.filter(c => c.body?.chapterEdits));
    assert.equal(saves.length, 1); assert.deepEqual(saves[0].body.chapterEdits, [{ op: 'portrait', chapterId: 'chapter', generalIdx: 0, portraitKey: null }]);
    assert.equal(saves[0].options.revision, '1');
    assert.equal(await page.getByRole('button', { name: '清除頭像綁定' }).count(), 0);
  });
  await check('cancel-and-empty-bind-do-not-save', async () => {
    const before = await page.evaluate(() => window.postCount());
    for (const result of [null, '', '  ']) {
      await page.evaluate(value => { window.prompt = () => value; }, result);
      await page.getByRole('button', { name: '綁定頭像', exact: true }).first().click(); await idle();
    }
    assert.equal(await page.evaluate(() => window.postCount()), before);
  });
  await check('bind-trims-key-and-clear-failure-keeps-binding', async () => {
    await page.evaluate(() => { window.prompt = () => ' NewPortrait '; });
    await page.getByRole('button', { name: '綁定頭像', exact: true }).first().click(); await idle();
    await page.evaluate(() => { window.failSave = true; });
    await page.getByRole('button', { name: '清除頭像綁定' }).click(); await idle();
    assert.equal(await page.getByRole('button', { name: '清除頭像綁定' }).count(), 1);
    assert.match(await page.evaluate(() => window.actionErrors.at(-1)), /save rejected/);
    await page.evaluate(() => { window.failSave = false; });
  });
  await check('empty-preview-disabled-and-direct-call-no-post', async () => {
    const before = await page.evaluate(() => window.uploadCount());
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true);
    await invokeUpload(); assert.equal(await page.evaluate(() => window.uploadCount()), before);
  });
  await check('reject-source-too-large-zero-and-gif-before-decode', async () => {
    await page.evaluate(() => { window.fakeImages = []; window.Image = class { constructor() { window.fakeImages.push(this); } }; });
    for (const [bytes, mime] of [[Buffer.alloc(100 * 1024 + 1), 'image/png'], [Buffer.alloc(0), 'image/png'], [Buffer.from('GIF89a'), 'image/gif']]) {
      await choose(bytes, mime); await invokeUpload();
    }
    assert.equal(await page.evaluate(() => window.fakeImages.length), 0);
    await page.evaluate(() => { window.Image = window.originalImage; });
  });
  await check('pending-and-stale-image-generation-no-upload-or-draw', async () => {
    const before = await page.evaluate(() => window.uploadCount());
    await page.evaluate(() => { window.Image = class { constructor() { this.naturalWidth = 256; this.naturalHeight = 128; window.fakeImages.push(this); } }; });
    await choose(png); await page.evaluate(() => { window.lateLoad = window.fakeImages.at(-1).onload; });
    await invokeUpload();
    await page.setInputFiles('#portrait-file', []);
    await page.evaluate(() => window.lateLoad());
    assert.equal(await page.locator('#portrait-confirm').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => Array.from(document.querySelector('#portrait-preview').getContext('2d').getImageData(64, 64, 1, 1).data)), [0, 0, 0, 0]);
    assert.equal(await page.evaluate(() => window.uploadCount()), before);
    // A's captured handler must not draw over pending B; identity loss must
    // discard B too. Fake images cannot be drawn, so a stale draw would fail.
    await choose(png); await page.evaluate(() => { window.loadA = window.fakeImages.at(-1).onload; });
    await choose(png); await page.evaluate(() => { window.loadB = window.fakeImages.at(-1).onload; window.loadA(); });
    assert.equal(await page.locator('#portrait-confirm').isDisabled(), true);
    await page.evaluate(() => { window.ui.setIdentity(null); window.loadB(); window.Image = window.originalImage; });
    assert.equal(await page.locator('#portrait-confirm').isDisabled(), true);
    await reset();
  });
  await check('bad-png-decode-remains-unready', async () => {
    await choose(Buffer.from('not actually png')); await page.waitForFunction(() => document.querySelector('#portrait-crop-status').textContent.includes('讀取失敗'));
    assert.equal(await page.locator('#portrait-confirm').isDisabled(), true); await invokeUpload();
  });
  await check('source-size-exact-100KiB-accepted', async () => {
    const padded = Buffer.alloc(100 * 1024); png.copy(padded);
    await choose(padded); await ready();
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true);
  });
  await check('rectangular-source-crop-adjust-confirm-upload-pixels', async () => {
    await choose(png); await ready();
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true);
    assert.equal(await page.locator('#portrait-x').inputValue(), '64', 'default crop centered after source change');
    assert.equal(await page.locator('#portrait-y').inputValue(), '0');
    const edges = await page.evaluate(() => {
      const ctx = document.querySelector('#portrait-preview').getContext('2d');
      return [Array.from(ctx.getImageData(0, 64, 1, 1).data), Array.from(ctx.getImageData(127, 64, 1, 1).data)];
    });
    assert.deepEqual(edges, [[255, 0, 0, 255], [0, 0, 255, 255]]);
    await move('portrait-x', 128);
    await page.fill('#portrait-id', 'Blue'); await page.click('#portrait-confirm');
    assert.equal(await page.locator('#portrait-upload').isDisabled(), false);
    await page.click('#portrait-upload'); await idle();
    const actual = await page.evaluate(() => window.uploaded);
    assert.equal(actual.gameId, 'first'); assert.equal(actual.width, 128); assert.equal(actual.height, 128); assert.deepEqual(actual.center, [0, 0, 255, 255]); assert.ok(actual.length <= 100 * 1024);
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true);
  });
  await check('crop-change-invalidates-confirmation', async () => {
    await page.click('#portrait-confirm'); await move('portrait-side', 64);
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true); await invokeUpload();
  });
  await check('game-selection-clears-preview-library-and-loads-correct-roster', async () => {
    await page.selectOption('#generals-games', 'second');
    assert.equal(await page.locator('#portrait-upload').isDisabled(), true);
    assert.equal(await page.locator('#portrait-file').inputValue(), '');
    await page.click('#generals-inspect'); await idle();
    assert.match(await page.locator('#generals-chapters').textContent(), /丙將/);
  });
  await check('logout-during-encode-prevents-post', async () => {
    await choose(png); await ready(); await page.click('#portrait-confirm');
    const before = await page.evaluate(() => window.uploadCount());
    await page.evaluate(() => {
      document.querySelector('#portrait-preview').toBlob = cb => { window.encodeCallback = cb; };
      window.pendingUpload = document.querySelector('#portrait-upload').onclick();
    });
    await page.waitForFunction(() => Boolean(window.encodeCallback));
    await page.evaluate(async () => { window.ui.setIdentity(null); window.encodeCallback(new Blob(['x'])); await window.pendingUpload; document.querySelector('#portrait-preview').toBlob = window.originalToBlob; });
    assert.equal(await page.evaluate(() => window.uploadCount()), before);
  });
  await reset();
  await check('game-change-during-arraybuffer-prevents-post', async () => {
    await choose(png); await ready(); await page.click('#portrait-confirm');
    const before = await page.evaluate(() => window.uploadCount());
    await page.evaluate(() => {
      document.querySelector('#portrait-preview').toBlob = cb => cb({ size: 1, arrayBuffer: () => new Promise(r => { window.bytesCallback = r; }) });
      window.pendingUpload = document.querySelector('#portrait-upload').onclick();
    });
    await page.waitForFunction(() => Boolean(window.bytesCallback));
    await page.evaluate(async () => {
      const select = document.querySelector('#generals-games'); select.value = 'second'; select.onchange();
      window.bytesCallback(new ArrayBuffer(1)); await window.pendingUpload;
      document.querySelector('#portrait-preview').toBlob = window.originalToBlob;
    });
    assert.equal(await page.evaluate(() => window.uploadCount()), before);
  });
  await reset();
  await check('normalized-output-limit-and-null-blob-no-post', async () => {
    await choose(png); await ready(); await page.click('#portrait-confirm');
    const before = await page.evaluate(() => window.uploadCount());
    for (const size of [null, 0, 100 * 1024 + 1]) {
      await page.evaluate(size => { document.querySelector('#portrait-preview').toBlob = cb => cb(size === null ? null : { size }); }, size);
      await invokeUpload();
    }
    assert.equal(await page.evaluate(() => window.uploadCount()), before);
    await page.evaluate(() => { document.querySelector('#portrait-preview').toBlob = window.originalToBlob; });
  });
  await check('jpeg-source-normalizes-after-real-decode', async () => {
    const jpeg = Buffer.from(await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 64;
      canvas.getContext('2d').fillRect(0, 0, 32, 64);
      return Array.from(new Uint8Array(await (await new Promise(r => canvas.toBlob(r, 'image/jpeg'))).arrayBuffer()));
    }));
    await choose(jpeg, 'image/jpeg'); await ready(); await page.click('#portrait-confirm');
    await page.click('#portrait-upload'); await idle();
    const actual = await page.evaluate(() => window.uploaded); assert.equal(actual.width, 128); assert.equal(actual.height, 128);
  });
  await check('no-idb-console-page-or-outside-errors', async () => {
    assert.equal(await page.evaluate(() => window.idbCalls), 0); assert.deepEqual(errors, []); assert.deepEqual(outside, []);
    assert.equal(await page.evaluate(() => window.objectUrls.every(url => window.revokedUrls.includes(url))), true, 'all owned object URLs revoked');
  });
  for (const path of files) assert.equal(sha(readFileSync(path)), pins[path], `source drift: ${path}`);
  process.stdout.write(JSON.stringify({ checks, pins, testSha256: sha(readFileSync(resolve('tools/verify_editor_portrait_ui_browser.mjs'))), limits: 'Injected API/session fixtures; not workerd authorization, server image safety, publish or runtime identity proof.', idbCalls: 0, errors, outside }, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
