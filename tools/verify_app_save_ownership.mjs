// Actual shared App + native IndexedDB in a fresh browser/profile. Owned static
// server only; no original DOS file access, user profile or developer service.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { startBrowserTestServer, mockBuiltinOnlyCatalog } from './browser_test_server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parent = '.dragon-analysis/release-readiness'; await mkdir(parent, { recursive: true });
const artifact = await mkdtemp(join(parent, 'app-save-ownership-browser-'));
const server = await startBrowserTestServer(); let browser;
const errors = [], forbidden = [], failed = [];
try {
  const origin = `http://127.0.0.1:${server.port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || /\/api\/|save\.dat|\.dragon-runtime/i.test(url.pathname)) { forbidden.push(url.origin === origin ? url.pathname : 'outside-origin'); return route.abort(); }
    return route.continue();
  });
  await mockBuiltinOnlyCatalog(context, origin);
  // Select the product's already-seen opening path in this OWNED fresh profile.
  // This save lifecycle test does not exercise decorative streamed intro music.
  await context.addInitScript(() => sessionStorage.setItem('wolong.intro.seen.v1', '1'));
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if(m.type() === 'error' && !m.location().url?.endsWith('/favicon.ico')) errors.push(m.text()); });
  page.on('requestfailed', r => failed.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
  await page.goto(`${origin}/index.html`); await page.locator('#skip-button').click();
  await page.waitForFunction(() => !!window.__app?.startMenu?._onClick);
  async function rebind(x, y) {
    await page.evaluate(() => { window.__ownedMenu = window.__app.startMenu._onClick; });
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.__app.startMenu._onClick && window.__app.startMenu._onClick !== window.__ownedMenu);
  }
  await rebind(468, 360); await rebind(512, 234); await rebind(512, 234); await page.mouse.click(584, 455);
  await page.waitForFunction(() => window.__app.gameStarted && window.__app.runtimeEnabled && !window.__app._scenarioAssemblyPending);
  const observations = await page.evaluate(async () => {
    const app = window.__app, messages = [];
    app.gamebar._clockHoldRequested = true; app.gamebar.syncClock();
    const first = await app.saveGame(0, 'owned baseline');
    const queueChecks = [];
    for (const field of ['scenario', 'scenarioIdx', 'world', 'content', 'clock', 'saveRepository', '_gameEntryRequest', '_scenarioAssemblyPending', '_scenarioAssemblyIncomplete', 'canPersist', 'runtimeEnabled']) {
      let releaseQueue; const waiting = new Promise(resolve => { releaseQueue = resolve; });
      app._saveQueue = waiting;
      const old = app[field], before = app.saves, slot = app.loadedSaveSlot;
      const queued = app.saveGame(9, 'queued owner must match');
      app[field] = field === 'canPersist' || field === 'runtimeEnabled' ? false : {};
      releaseQueue();
      try { queueChecks.push({ field, result: await queued, unchanged: app.saves === before && app.loadedSaveSlot === slot }); }
      finally { app[field] = old; }
    }
    const repo = app.saveRepository, originalFlash = app.hud.flashEvent;
    let release, entered; const wait = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
    let writes = 0;
    // Real IDB transaction completes BEFORE its response is withheld.
    app.saveRepository = { ...repo,
      async put(snapshot) { writes++; const committed = await repo.put(snapshot); entered(); await wait; return committed; },
      async add(snapshot) { writes++; return repo.add(snapshot); },
    };
    app.hud.flashEvent = text => messages.push(text);
    const pending = app.saveGame(0, 'owned committed'), queued = app.saveGame(1, 'must not save');
    await started;
    const diskBeforeExit = await repo.get(0);
    // Actual App exit invalidates its entry ticket and clears the Scenario.
    const title = app.returnToTitle(); title.catch(error => { window.__ownedTitleError = String(error); });
    while(app.scenario !== null) await new Promise(resolve => setTimeout(resolve, 0));
    const nextSaves = app.saves, nextSlot = app.loadedSaveSlot;
    release(); const completion = await pending, skipped = await queued;
    const liveUnchanged = app.saves === nextSaves && app.loadedSaveSlot === nextSlot;
    const stored = await repo.load();
    app.saveRepository = repo; app.hud.flashEvent = originalFlash;
    return { first, queueChecks, completion, skipped, writes, messages, liveUnchanged, diskBeforeExit: diskBeforeExit.label,
      stored: stored.slots.filter(s => s.played).map(s => ({ slot: s.slot, label: s.label })), titleError: window.__ownedTitleError ?? null };
  });
  await writeFile(join(artifact, 'observations.json'), JSON.stringify(observations, null, 2));
  assert.deepEqual(observations.first, { saved: 'local' });
  assert.equal(observations.queueChecks.length, 11);
  for(const { field, result, unchanged } of observations.queueChecks) {
    assert.deepEqual(result, field === 'runtimeEnabled' ? { saved: 'blocked' } : { saved: 'blocked', reason: 'superseded' }, field);
    assert.equal(unchanged, true, field);
  }
  assert.equal(observations.diskBeforeExit, 'owned committed');
  assert.deepEqual(observations.completion, { saved: 'superseded', committed: true, slot: 0 });
  assert.deepEqual(observations.skipped, { saved: 'blocked', reason: 'superseded' });
  assert.equal(observations.writes, 1); assert.equal(observations.liveUnchanged, true);
  assert.deepEqual(observations.messages, []); assert.equal(observations.titleError, null);
  assert.deepEqual(observations.stored, [{ slot: 0, label: 'owned committed' }]);
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); assert.deepEqual(failed, []);
  await page.screenshot({ path: join(artifact, 'title-after-commit.png') });
  const sourceSHA = sha(await readFile('web/src/main.js'));
  const result = { checks: 17, sourceSHA, observations, errors, forbidden, failed, screenshotSHA: sha(await readFile(join(artifact, 'title-after-commit.png'))),
    scope: 'Actual built-in App, fresh browser and native IDB: completed transaction after real title exit, stale queued save rejected. No formal R2 App mount or campaign proof.' };
  await writeFile(join(artifact, 'result.json'), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify({ checks: result.checks, artifact: relative('.', artifact), sourceSHA }) + '\n');
} catch(error) {
  await writeFile(join(artifact, 'failure.json'), JSON.stringify({ error: String(error), errors, forbidden, failed }, null, 2)); throw error;
} finally { await browser?.close(); await server.close(); }
