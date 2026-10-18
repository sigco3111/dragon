// Actual published runtime -> shared App, in a separate owned native-IDB context.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bootPath = '/__owned-published-app.mjs';
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.flac': 'audio/flac', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
export function createPublishedAppBrowserProbe({ browser, origin, gameId, chapterId, root, bridge, observeContext }) {
  const manifestBytes = readFileSync(join(root, 'dist/static-release.json'));
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch (cause) { throw new Error('owned static manifest invalid', { cause }); }
  const allowed = new Map(manifest.files.map(row => [row.path, row]));
  const boot = readFileSync('tools/fixtures/published-app-boot.mjs');
  const sources = { 'tools/fixtures/published-app-boot.mjs': sha(boot), 'static-release.json': sha(manifestBytes) };
  const checks = [], pages = [], observations = []; let page, context, identity, initialMetadata, savedDigest;
  function bytes(path) {
    assert.ok(allowed.has(path), 'undeclared static path: ' + path);
    const body = readFileSync(join(root, 'dist', path)), row = allowed.get(path);
    assert.equal(body.length, row.byteLength); assert.equal(sha(body), row.sha256);
    sources[path] = row.sha256; return body;
  }
  return {
    async serve(route, url) {
      if (url.pathname.startsWith('/play-api/')) return false;
      assert.equal(url.origin, origin); assert.equal(route.request().method(), 'GET');
      if (url.pathname === bootPath) { await route.fulfill({ contentType: 'text/javascript', body: boot }); return true; }
      if (url.pathname === '/favicon.ico') { await route.fulfill({ status: 204 }); return true; }
      const path = url.pathname.slice(1); assert.ok(path && !path.includes('..') && !path.includes('%') && !path.startsWith('reader/') && !path.startsWith('web/'));
      assert.ok(!url.search || url.search === '?v=original-sprites-1');
      let body = bytes(path);
      if (path === 'index.html') {
        const anchor = '<script type="module" src="src/boot.js"></script>', text = body.toString();
        assert.equal(text.split(anchor).length, 2); assert.ok(!text.includes('type="importmap"'));
        body = Buffer.from(text.replace(anchor, `<script type="module" src="${bootPath}"></script>`));
      }
      const type = mime[extname(path)]; assert.ok(type, 'unclassified static MIME: ' + path);
      await route.fulfill({ contentType: type, body }); return true;
    },
    async start(index, expectedChapter) {
      context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        const open = indexedDB.open.bind(indexedDB); window.__ownedDatabases = [];
        indexedDB.open = (name, ...args) => { if (name !== 'owned-published-app') throw new Error('non-owned database forbidden'); window.__ownedDatabases.push(name); return open(name, ...args); };
      });
      observeContext(context); await context.route('**/*', bridge);
      const open = async restore => {
        page = await context.newPage(); pages.push(page); page.setDefaultTimeout(90000);
        await page.goto(origin + '/index.html'); await page.waitForFunction(() => !!window.__ownedPublishedApp?.start);
        const started = page.evaluate(args => window.__ownedPublishedApp.start(args), { gameId, chapterId, restore, sequenceBase: pages.length * 1000000 });
        if (restore) await page.locator('[data-save-slot="0"]').click();
        else {
          await page.locator('[data-chapter-id]').first().waitFor();
          assert.equal(await page.locator('[data-chapter-id]').count(), 20);
          const selectedRow = await page.locator('[data-chapter-id]').evaluateAll((nodes, id) => nodes.findIndex(node => node.dataset.chapterId === id), chapterId);
          assert.ok(selectedRow >= 0);
          await page.locator('[data-chapter-id]').nth(selectedRow).click();
          await page.locator('[data-faction-slot]').first().click();
        }
        return started;
      };
      const first = await open(false); identity = first.identity; initialMetadata = first.metadata;
      assert.equal(identity.gameId, gameId); assert.equal(identity.ordinal, '1.0'); assert.equal(identity.chapterId, chapterId);
      assert.equal(identity.manifestDigest, index.resources.manifest.sha256); assert.equal(first.chapterDigest, expectedChapter.digest);
      assert.deepEqual(first.chapterPreviews.map(row => row.chapterId), identity.chapters);
      assert.equal(first.chapterPreviews.length, 20);
      assert.ok(first.chapterPreviews.every(row => typeof row.name === 'string' && row.name && Number.isSafeInteger(row.start.year)));
      assert.equal(first.resources, Object.keys(index.resources).filter(role => role.startsWith('asset:')).length + 8);
      assert.equal(first.cities, 192); assert.equal(first.trial, null); assert.equal(first.staticReads.length, 8);
      for (const row of first.staticReads) { assert.equal(row.digest, allowed.get(row.path)?.sha256); assert.equal(row.bytes, allowed.get(row.path)?.byteLength); }
      const saved = await page.evaluate(async () => {
        const c = window.__ownedPublishedApp, a = window.__app;
        const result = await a.saveGame(0, 'published App first save'), record = await c.store.get(0);
        await a.returnToTitle('load');
        return { result, identity: { releaseId: record.record.releaseId, ordinal: record.record.releaseOrdinal }, digest: record.token.bodyDigest, exits: c.exits, databases: window.__ownedDatabases };
      });
      assert.deepEqual(saved.result, { saved: 'local' }); assert.deepEqual(saved.identity, { releaseId: identity.releaseId, ordinal: 0 });
      assert.deepEqual(saved.exits, [{ reason: 'title', initialAction: 'load' }]); assert.ok(saved.databases.length && saved.databases.every(name => name === 'owned-published-app'));
      savedDigest = saved.digest; observations.push({ first, saved }); checks.push('actual reader/compiled chapter/152 assets/8 static maps -> same App fresh and native IDB save');
      const restored = await open(true);
      assert.deepEqual(restored.identity, identity); assert.deepEqual(restored.metadata, initialMetadata); assert.equal(restored.slot, 0);
      assert.deepEqual(restored.chapterPreviews, first.chapterPreviews);
      assert.equal(await page.evaluate(async () => (await window.__ownedPublishedApp.store.get(0)).token.bodyDigest), savedDigest);
      observations.push({ restored }); checks.push('title exit then fresh page/current reader admission restores the same owned native IDB archive');
    },
    async unavailable() {
      const result = await page.evaluate(async () => {
        const c = window.__ownedPublishedApp; let error;
        try { await c.session.read('chapter:' + c.session.identity.chapterId); } catch (e) { error = { code: e.code, status: e.status }; }
        return { error, state: c.session.state(), allowed: window.__app.checkFormalCurrent(), exits: c.exits.length };
      });
      assert.deepEqual(result, { error: { code: 'RUNTIME_UNAVAILABLE', status: 503 }, state: 'active', allowed: true, exits: 0 });
      checks.push('missing R2 chapter is 503; assembled App retains its active owner');
    },
    async observe(listed) {
      // Opening the actual save dialog must discover the update before any
      // write. No probe calls host.checkStatus or App.refreshFormalStatus.
      if (listed) {
        assert.equal(await page.evaluate(() => window.__app.gamebar.openSystemSaveDialog()), true);
        await page.waitForFunction(() => window.__ownedPublishedApp.host.warning());
        assert.equal(await page.evaluate(async () => (await window.__ownedPublishedApp.store.get(0)).token.bodyDigest), savedDigest);
        assert.match(await page.locator('.player-session-host [role="status"]').textContent(), /保存後將無法在新版讀取/);
      }
      const result = await page.evaluate(async listed => {
        const c = window.__ownedPublishedApp, a = window.__app, status = await c.session.status();
        const saved = await a.saveGame(0, listed ? 'saved after update' : 'saved after unlist'), record = await c.store.get(0);
        const checked = c.statusChecks.at(-1), warned = c.host.warning();
        return { status, checked, warned, identity: c.session.identity, saved, releaseId: record.record.releaseId, ordinal: record.record.releaseOrdinal,
          digest: record.token.bodyDigest, state: c.session.state(), scenario: !!a.scenario, exits: c.exits.length };
      }, listed);
      assert.equal(result.status.listed, listed); if (listed) assert.equal(result.status.ordinal, '1.1');
      assert.equal(result.checked.kind, listed ? 'updated' : 'unlisted'); assert.equal(result.warned, true);
      assert.deepEqual(result.identity, identity); assert.deepEqual(result.saved, { saved: 'local' }); assert.equal(result.releaseId, identity.releaseId); assert.equal(result.ordinal, 0);
      assert.equal(result.state, 'active'); assert.equal(result.scenario, true); assert.equal(result.exits, 0); savedDigest = result.digest;
      observations.push(result); checks.push(listed ? 'new publication does not replace App owner or save release' : 'unlisted old App can save under its original release');
    },
    async deleted() {
      const attempted = await page.evaluate(async () => {
        const before = window.__ownedDatabases.length;
        const saved = await window.__app.saveGame(0, 'must not write after deletion');
        return { saved, noSaveIO: before === window.__ownedDatabases.length, checked: window.__ownedPublishedApp.statusChecks.at(-1) };
      });
      assert.deepEqual(attempted, { saved: { saved: 'blocked', reason: 'superseded' }, noSaveIO: true, checked: { kind: 'deleted' } });
      const dialog = page.getByRole('dialog', { name: '遊戲結束' });
      await dialog.waitFor();
      const beforeConfirmation = await page.evaluate(() => ({ exits: window.__ownedPublishedApp.exits.length, enabled: window.__app.runtimeEnabled, scenario: window.__app.scenario }));
      assert.deepEqual(beforeConfirmation, { exits: 0, enabled: false, scenario: null });
      assert.match(await dialog.textContent(), /遊戲已刪除/);
      await dialog.click({ button: 'right' });
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await page.evaluate(() => window.__ownedPublishedApp.exits.length), 0);
      await dialog.getByRole('button', { name: '確認', exact: true }).click();
      await page.waitForFunction(() => window.__ownedPublishedApp.exits.length === 1);
      assert.equal(await dialog.count(), 0);
      const result = await page.evaluate(async () => {
        const c = window.__ownedPublishedApp, a = window.__app, before = window.__ownedDatabases.length;
        const saved = await a.saveGame(0, 'must not save'), noSaveIO = before === window.__ownedDatabases.length;
        return { saved, noSaveIO, exits: c.exits, scenario: a.scenario, enabled: a.runtimeEnabled, state: c.session.state(), digest: (await c.store.get(0)).token.bodyDigest };
      });
      assert.deepEqual(result.saved, { saved: 'blocked', reason: 'superseded' }); assert.equal(result.noSaveIO, true);
      assert.deepEqual(result.exits, [{ reason: 'deleted', initialAction: undefined }]); assert.equal(result.scenario, null); assert.equal(result.enabled, false); assert.equal(result.state, 'deleted'); assert.equal(result.digest, savedDigest);
      observations.push({ ...result, beforeConfirmation, attempted }); checks.push('actual save preflight reader 410 -> App retirement before IDB, real host right-click ignored/left confirmation before navigation port, no local archive deletion');
    },
    async traces() { return (await Promise.all(pages.map(p => p.evaluate(() => window.__ownedPublishedApp.traces)))).flat(); },
    async screenshot(path) { await page.screenshot({ path }); },
    report() { return { checks, observations, sources, sourceTreeDigest: manifest.sourceTreeDigest, scope: 'One selected compiled chapter; actual reader-to-App/native IDB and real lifecycle host warning/deletion confirmation. Test startup and recording navigation port/owned static-package bridge, not production selectors or actual page navigation, campaign or retention proof.' }; },
  };
}
