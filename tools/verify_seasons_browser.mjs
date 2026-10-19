// Isolated profile; actual App calendar/season loader/Canvas. No user saves.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startBrowserTestServer } from './browser_test_server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const server = await startBrowserTestServer();
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) errors.push(message.text());
  });
  page.on('requestfailed', request => {
    // The explicit Skip below disposes only the title's single-play audio.
    if (new URL(request.url()).pathname === '/intro/assets/opening.mp3' &&
        request.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.goto(`http://127.0.0.1:${server.port}/index.html`);
  await page.locator('#skip-button').click();
  await page.waitForFunction(() => !!window.__app?.startMenu?._onClick);
  async function rebind(x, y) {
    await page.evaluate(() => { window.__seasonMenuHandler = window.__app.startMenu._onClick; });
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.__app.startMenu._onClick &&
      window.__app.startMenu._onClick !== window.__seasonMenuHandler);
  }
  await rebind(468, 360);
  await rebind(512, 234);
  await rebind(512, 234);
  await page.mouse.click(584, 455);
  await page.waitForFunction(() => window.__app.gameStarted && window.__app.runtimeEnabled);
  const result = await page.evaluate(async () => {
    const app = window.__app;
    app.setRuntimeEnabled(false);
    const names = ['spring', 'summer', 'autumn', 'winter'];
    const world = app.world, clock = app.clock;
    const scratch = document.createElement('canvas');
    scratch.width = scratch.height = 256;
    const ctx = scratch.getContext('2d');
    function pixels(image) {
      ctx.clearRect(0, 0, 256, 256); ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, 256, 256).data;
    }
    const endpoints = [];
    for (const name of names) {
      const terrain = await world.loadSeason(name);
      endpoints.push(pixels(terrain.atlasImage));
    }
    const before = JSON.stringify(app.scenario), rng = JSON.stringify(app.originalRng.snapshot());
    let phases = 0, mismatches = 0;
    for (let season = 0; season < 4; season++) {
      const from = endpoints[(season + 3) % 4], to = endpoints[season];
      for (const day of [0, 1, 2, 8, 15, 16]) {
        await app.setSeason(season, () => true, day);
        const actual = pixels(app.view.seasonImg.atlasImage);
        for (let i = 0; i < actual.length; i++)
          if (actual[i] !== Math.round(from[i] + (to[i] - from[i]) * day / 16)) mismatches++;
        app.view.draw();
        const cached = app.view.ctx.getImageData(0, 0, 1024, 768).data;
        app.view.draw({ uncached: true });
        const direct = app.view.ctx.getImageData(0, 0, 1024, 768).data;
        for (let i = 0; i < cached.length; i++) if (cached[i] !== direct[i]) mismatches++;
        phases++;
      }
    }
    const readonly = before === JSON.stringify(app.scenario) && rng === JSON.stringify(app.originalRng.snapshot());
    // Same target season, different date: a late earlier phase cannot overwrite it.
    const releases = [];
    app.world = { ...world, loadSeason: () => new Promise(resolve => releases.push(resolve)) };
    const older = app.setSeason(0, () => true, 2), newer = app.setSeason(0, () => true, 3);
    const latest = app.view.seasonImg;
    releases[1](latest); await newer;
    releases[0]({ stale: true }); await older;
    const ordered = app.view.seasonImg === latest;
    app.world = world;
    // Actual App onHour entry; isolate the city/army/weather pump, not the calendar
    // callback or its existing faction-event tail. Empty the fixture event page
    // so startup-RNG-dependent diplomacy cannot leave a modal during date jumps.
    // Explicit date fixtures are not a natural campaign history.
    app.scenario.strategicEventSlots.fill(null);
    const monthEnd = clock.onMonthEnd, prepare = clock.onStrategicUpdateComplete;
    clock.onStrategicTick = null;
    clock.onStrategicUpdateComplete = null;
    clock.onSyncHold = null;
    clock.onMonthEnd = null;
    const requests = [];
    const setSeason = app.setSeason.bind(app);
    let loaded = Promise.resolve();
    app.setSeason = (season, guard, day) => {
      requests.push([clock.strategicSpeed, clock.month, day, season]);
      return loaded = setSeason(season, guard, day);
    };
    const intents = [];
    app.score.music = { select: track => intents.push(['select', clock.month, clock.day, track]),
      fadeOut: () => intents.push(['fade', clock.month, clock.day]) };
    for (let speed = 0; speed < 5; speed++) for (const month of [3, 6, 9, 12]) {
      clock.strategicSpeed = speed; clock.speed = speed + 1;
      for (const day of [1, 2, 8, 15, 16, 17]) {
        clock.month = month; clock.day = day; clock.hour = 0; clock.sub = 8;
        clock._acc = 0; clock.hold = true;
        const prior = requests.length;
        clock.advanceFrame(100000);
        if (requests.length !== prior) throw new Error('held calendar selected a season');
        clock.hold = false;
        clock.advanceFrame(clock.currentStep);
        await loaded;
        const expected = day <= 16 ? 1 : 0;
        if (requests.length - prior !== expected) throw new Error('wrong calendar phase count');
        if (day <= 16 && (app._seasonRequest.day !== day || app._seasonRequest.i !== (month / 3 - 1)))
          throw new Error('wrong actual App season request');
      }
    }
    const independent = app._seasonRequest;
    await new Promise(resolve => setTimeout(resolve, 150));
    const noWallClock = independent === app._seasonRequest;
    const dateRequests = requests.length, dateIntents = intents.slice();
    // Actual App 5358 callback and GameBar FIFO, with explicit in-memory
    // recruits/RNG. No city/legion pump or claim of a natural campaign history.
    const { canSnapshotState } = await import('/src/game/savegame.js');
    const sc = app.scenario, bar = app.gamebar;
    if (bar._strategicMessageActive || bar._strategicMessageQueue.length || bar.generalCard)
      throw new Error('monthly fixture must begin without an earlier message');
    const recruits = sc.generals.filter(g => g.idx < 127 && g.faction == null).slice(0, 2);
    if (recruits.length !== 2) throw new Error('fixture requires two unowned generals');
    for (const g of sc.generals) g.appear_months = 1;
    for (const g of recruits) Object.assign(g, { attr: 128, active: true,
      appear_months: 0, join_faction: sc.player_faction, origFaction: null, status: 0 });
    const nextByte = app.originalRng.nextByte;
    let randomCalls = 0, monthCalls = 0, prepared = 0;
    app.originalRng.nextByte = () => { randomCalls++; return 0; };
    clock.onMonthEnd = c => { monthCalls++; monthEnd(c); };
    clock.onStrategicUpdateComplete = c => { prepared++; prepare(c); };
    clock.month = 2; clock.day = 28; clock.hour = 23; clock.sub = 8;
    clock._acc = 0; clock.hold = false;
    const serial = clock.strategicTickSerial, player = sc.factions[sc.player_faction];
    const countBefore = player.nativeGeneralCount;
    clock.advanceFrame(clock.currentStep);
    const date = () => [clock.month, clock.day, clock.hour, clock.sub].join(',');
    for (let i = 0; i < 2; i++) {
      for (let tries = 0; !bar.generalCard && tries < 100; tries++)
        await new Promise(resolve => setTimeout(resolve, 10));
      if (bar.generalCard?.gen !== recruits[i] || date() !== '3,0,23,8' ||
          !clock.hold || !clock._pendingMonthAdvance || canSnapshotState(app))
        throw new Error(`wrong monthly message boundary ${i}: ${date()} ${JSON.stringify({
          monthCalls, randomCalls, player: sc.player_faction, pointer: sc.nativePlayerFactionPointer,
          recruits: recruits.map(g => ({ idx: g.idx, attr: g.attr, faction: g.faction,
            join: g.join_faction, wait: g.appear_months })),
          pending: app._nativeMonthlyFateContinuation?.kind,
        })}`);
      const frozenCalls = randomCalls;
      clock.advanceFrame(100000);
      if (randomCalls !== frozenCalls || requests.length !== dateRequests ||
          intents.length !== dateIntents.length || prepared !== 0)
        throw new Error('month message advanced rules, palette, music or objects');
      bar.closeGeneralCard(); // Actual FIFO callback; next recruit or remaining5358.
    }
    if (app._nativeMonthlyFateContinuation || date() !== '3,0,23,8' ||
        player.nativeGeneralCount !== ((countBefore + 2) & 255) || monthCalls !== 1 ||
        canSnapshotState(app)) throw new Error('monthly tail or pending save boundary');
    const afterTailCalls = randomCalls;
    clock.hold = false; // only the test-owned runtime=false hold remains
    clock.advanceFrame(clock.currentStep);
    await loaded;
    app.originalRng.nextByte = nextByte;
    if (date() !== '3,1,1,0' || clock.strategicTickSerial !== serial + 1 ||
        monthCalls !== 1 || prepared !== 1 || requests.length !== dateRequests + 1 ||
        intents.length !== dateIntents.length + 1 || randomCalls !== afterTailCalls ||
        !canSnapshotState(app)) throw new Error('monthly return replayed or skipped a stage');
    return { phases, mismatches, readonly, ordered, requests: dateRequests,
      intents: dateIntents, noWallClock, monthMessages: 2 };
  });
  assert.equal(result.phases, 24);
  assert.equal(result.mismatches, 0, 'all atlas RGBA and cached/direct viewport pixels');
  assert.equal(result.readonly, true, 'season loading/drawing does not write Scenario/RNG');
  assert.equal(result.ordered, true, 'late old phase discarded');
  assert.equal(result.requests, 100, 'five speeds, four months, five eligible dates');
  assert.equal(result.noWallClock, true, 'no 100ms UI timer replaces calendar phase');
  assert.equal(result.monthMessages, 2, 'actual App monthly FIFO completes before day1/season/music/objects');
  const expected = [];
  for (let speed = 0; speed < 5; speed++) for (const month of [3, 6, 9, 12])
    expected.push(['fade', month, 1], ['select', month, 2, month / 3 + 1]);
  assert.deepEqual(result.intents, expected, 'existing independent BGM follows 93D7 dates');
  assert.deepEqual(errors, []);
  process.stdout.write('seasons OK: 24 pixel phases, actual App five-speed dates/BGM, hold, stale phase and readonly draw\n');
} finally {
  await browser?.close();
  server.close();
}
