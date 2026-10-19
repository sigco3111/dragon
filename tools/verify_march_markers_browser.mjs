import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { startBrowserTestServer } from "./browser_test_server.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright");
const server = await startBrowserTestServer();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const deviceScaleFactor of [1, 1.25, 2]) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor });
  const origin = `http://127.0.0.1:${server.port}`;
  await context.addInitScript((origin) => {
    if (location.origin === origin) sessionStorage.setItem("wolong.intro.seen.v1", "1");
  }, origin);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", r => errors.push(r.url()));
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  await page.waitForFunction(() => !!window.__app?.startMenu?._onClick);
  const result = await page.evaluate(async () => {
    const app = window.__app;
    await app.ensureGameAssets();
    app.setRuntimeEnabled(false);
    const { MapView } = await import("./src/render/mapview.js");
    const canvas = document.createElement("canvas");
    const sc = structuredClone(app.content.chapter(16).template);
    const city = sc.cities.find(c => /[許许]昌/.test(c.name));
    if (!city) throw new Error("missing Xuchang fixture");
    city.faction = 0;
    sc.factionOf = c => sc.factions.find(f => f.idx === c.faction);
    sc.legions = [];
    sc.disasterMapObjects = [];
    const view = new MapView(canvas, () => sc);
    view.app = { gameStarted: true, clock: { strategicTickSerial: 0, dayProgress: () => 0 } };
    view.cam.x = 300 - city.x * 16;
    view.cam.y = 200 - city.y * 16;
    let ready = 0;
    for (let style = 0; style < 24; style++) for (let frame = 0; frame < 5; frame++) {
      view._drawMarchingIcon({ drawImage(image) {
        if (image.complete && image.naturalWidth === 16 && image.naturalHeight === 16) ready++;
      } }, 100, 100, style, frame);
    }
    // All 192 source nodes retain their actual tile center, not +2/+3 road compensation.
    for (const c of sc.cities) {
      const p = view.cityPixel(c);
      if (p[0] !== c.x * 16 + 8 || p[1] !== c.y * 16 + 8)
        throw new Error(`shifted city ${c.idx}`);
    }
    sc.cities = [city];
    const drawMarker = view._drawMarchingIcon.bind(view);
    const draws = [];
    view._drawMarchingIcon = (ctx, x, y, style, frame) => {
      draws.push({ x, y, style, frame });
      drawMarker(ctx, x, y, style, frame);
    };
    // Observe actual raster destinations, including the city tile and all marker frames.
    const images = [];
    const nativeDraw = view.ctx.drawImage.bind(view.ctx);
    view.ctx.drawImage = (image, ...args) => {
      images.push({ src: image.src ?? '', args });
      nativeDraw(image, ...args);
    };
    // Standalone MapView uses its lazy city-icon cache (not App resource ports).
    // Wait for that first read before the synchronous raster assertions below.
    for (let tries = 0; tries < 100 && !images.some(i => /icon-.*_city\.png$/.test(i.src)); tries++) {
      view.draw({ uncached: true });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const army = { faction: city.faction ?? sc.player_faction, prevX: city.x, prevY: city.y,
      x: city.x + 1, y: city.y, movePeriod: 3, _renderMoveSerial: 0,
      _markerFrame: 3, target: { x: city.x + 10, y: city.y } };
    sc.legions = [army];
    const departure = [];
    for (let tick = 0; tick < 24; tick++) {
      view.app.clock.strategicTickSerial = tick;
      draws.length = 0;
      view.draw({ uncached: true });
      departure.push(draws.map(d => ({ frame: d.frame, x: d.x, y: d.y })));
    }
    army.prevX = city.x - 1; army.x = city.x;
    army._renderMoveSerial = 24; army._markerFrame = 4; army.target = null;
    const arrival = [];
    for (let tick = 24; tick <= 48; tick++) {
      view.app.clock.strategicTickSerial = tick;
      draws.length = 0;
      view.draw({ uncached: true });
      arrival.push(draws.map(d => ({ frame: d.frame, x: d.x, y: d.y })));
    }
    const cityDraws = images.filter(i => /icon-.*_city\.png$/.test(i.src));
    const lastMarker = images.filter(i => /style_.*_frame_4\.png$/.test(i.src)).at(-1);
    // Clear prev after arrival, pan, then verify garrison/pick/snap/selection alignment.
    army.prevX = army.x; army.prevY = army.y;
    view.cam.x -= 37; view.cam.y -= 19;
    view.selectedCity = city;
    view.setPointer(271, 189);
    const picked = view.pick(271, 189)?.city === city;
    const snapped = { ...view.pointer };
    draws.length = 0;
    view.draw();
    const parked = draws.map(d => ({ frame: d.frame, x: d.x, y: d.y }));
    return { ready, departure, arrival, cityDraws, lastMarker, picked, snapped, parked };
  });
  await page.waitForLoadState("networkidle");
  assert.equal(result.ready, 120);
  const checkDraw = (draws, frame, x) => {
    assert.equal(draws.length, 1);
    assert.equal(draws[0].frame, frame);
    assert.ok(Math.abs(draws[0].x - x) < 1e-9, "continuous tile-center projection");
    assert.equal(draws[0].y, 208);
  };
  for (const [tick, draws] of result.departure.entries())
    checkDraw(draws, 1, 308 + tick * 16 / 24);
  for (const [tick, draws] of result.arrival.entries())
    checkDraw(draws, tick === 24 ? 4 : 1, 292 + tick * 16 / 24);
  assert.ok(result.cityDraws.length > 0);
  assert.ok(result.cityDraws.every(d => JSON.stringify(d.args) === '[300,200,16,16]'));
  assert.deepEqual(result.lastMarker.args, [300, 200]);
  assert.equal(result.picked, true);
  assert.deepEqual(result.snapped, { x: 271, y: 189 });
  assert.deepEqual(result.parked, [{ frame: 4, x: 271, y: 189 }]);
  if (deviceScaleFactor === 1) {
    // Reuse the real App/RAF, but isolate its native slot pump from city AI and
    // hourly diplomacy. Explicit moving records are not a natural campaign.
    await page.evaluate(() => window.__app.setRuntimeEnabled(true));
    async function choose(x, y) {
      await page.evaluate(() => { window.__marchMenu = window.__app.startMenu._onClick; });
      await page.mouse.click(x, y);
      await page.waitForFunction(() => window.__app.startMenu._onClick &&
        window.__app.startMenu._onClick !== window.__marchMenu);
    }
    await choose(468, 360); await choose(512, 234); await choose(512, 234);
    await page.mouse.click(584, 455);
    await page.waitForFunction(() => window.__app.gameStarted && window.__app.runtimeEnabled);
    await page.evaluate(async () => {
      const app = window.__app;
      app.setRuntimeEnabled(false);
      const { aiTick } = await import('./src/game/ai.js');
      const { scenarioNativeRoadContext } = await import('./src/game/scenarioassembly.js');
      const { rebindNativeLegionViews } = await import('./src/game/nativelegions.js');
      const sc = app.scenario, native = scenarioNativeRoadContext(sc);
      const graph = await (await fetch(app.world.definition.assets.roadGraph)).json();
      const edge = graph.edges.find(e => e.points.length >= 32);
      if (!edge) throw new Error('missing long original edge');
      const address = 0x800 + edge.id * 16;
      const first = native.memory.readByte(address) | (native.memory.readByte(address + 1) << 8);
      const armies = [sc.nativeLegionSlots.records[0], sc.nativeLegionSlots.records[17]];
      const enemy = sc.nativeLegionSlots.records[64];
      const saved = armies.map(a => structuredClone(a));
      sc.cities[edge.target].faction = sc.player_faction; // fixed friendly endpoint fixture
      for (const obj of [...sc.weatherClouds, ...sc.disasterMapObjects]) obj.status = 0;
      app.clock.onHour = null;
      app.clock.onMonthEnd = null;
      const state = window.__nativeMarch = { rows: [], ticks: [], sounds: 0, contacts: 0,
        running: false, done: false, pause: false, paused: false, contact: false, removed: false,
        origin: 0, rng: null };
      const draw = app.view._drawMarchingIcon;
      app.view._drawMarchingIcon = function(ctx, x, y, style, frame) {
        if (state.running) {
          const positions = armies.map(a => this.getLegionRenderPos(a, app.clock.dayProgress()));
          const army = positions.findIndex(p => Math.abs(p.sx - x) < 1e-8 && Math.abs(p.sy - y) < 1e-8);
          if (army >= 0) state.rows.push({ tick: app.clock.strategicTickSerial - state.origin,
            army, x, y, frame, progress: (armies[army].roadPointAddress - first) / 4 - 1 + positions[army].curT });
        }
        return draw.call(this, ctx, x, y, style, frame);
      };
      const play = app.engagementFx.playSound;
      await app.prepareEngageAudio();
      app.engagementFx.playSound = () => { state.sounds++; return play(); };
      state.begin = (speed, { contact = false, pause = false } = {}) => {
        for (const record of [...armies, enemy]) {
          if (record.status >= 128) native.movement.writeByte(record.occupancyRowParagraph, record.occupancyOffset, 0);
        }
        enemy.status = 0;
        armies.forEach((army, i) => {
          const pointIndex = i ? 18 : 4, p = edge.points[pointIndex];
          for (const key of Object.keys(army)) if (!(key in saved[i])) delete army[key];
          Object.assign(army, saved[i], { status: 0xc1, faction: sc.player_faction,
            generalIdx: sc.factions[sc.player_faction].monarch_idx, x: p.x, y: p.y,
            prevX: p.x, prevY: p.y, roadEdgeOrNode: address,
            roadPointAddress: first + pointIndex * 4, roadStride: 4, targetNode: edge.target,
            targetCity: edge.target, commandState: 0, moveDelay: 1, movePeriod: i + 2,
            occupancyOffset: p.x, occupancyRowParagraph: p.y * 24, troops: 600, morale: 200,
            units: Array.from({ length: 6 }, () => ({ type: i ? 3 : 1, troops: 1000 })) });
          native.movement.writeByte(p.y * 24, p.x, 1);
        });
        if (contact) {
          const p = edge.points[5];
          Object.assign(enemy, { status: 0xc1, faction: (sc.player_faction + 1) % 22,
            x: p.x, y: p.y, occupancyOffset: p.x, occupancyRowParagraph: p.y * 24,
            moveDelay: 255, movePeriod: 3 });
          native.movement.writeByte(p.y * 24, p.x, 1);
        }
        sc.legionSlotCounters.fill(0);
        rebindNativeLegionViews(sc);
        app.engagementFx.reset();
        Object.assign(state, { rows: [], ticks: [], sounds: 0, contacts: 0, running: true,
          done: false, pause, paused: false, contact, removed: false, origin: app.clock.strategicTickSerial,
          rng: app.originalRng.snapshot() });
        app.clock.strategicSpeed = speed;
        app.clock._acc = 0;
        app.gamebar.settingsOpen = false;
        app.mapPointerHold = false;
        app.view.cam.x = 350 - edge.points[4].x * 16;
        app.view.cam.y = 260 - edge.points[4].y * 16;
        app.setRuntimeEnabled(true);
      };
      app.clock.onStrategicTick = c => {
        const tick = c.strategicTickSerial - state.origin;
        aiTick(app, { legionBatchStart: ((tick - 1) % 8) * 16, runCityDaily: false, settleDaily: false });
        if (app._strategicBattleFailure) throw app._strategicBattleFailure.error;
        state.ticks.push(armies.map(a => a.roadPointAddress));
        if (armies[0]._engagement) state.contacts++;
      };
      const prepare = app.clock.onStrategicUpdateComplete;
      app.clock.onStrategicUpdateComplete = c => {
        prepare(c);
        const tick = c.strategicTickSerial - state.origin;
        if (state.contact && !state.removed && tick >= 25) {
          native.movement.writeByte(enemy.occupancyRowParagraph, enemy.occupancyOffset, 0);
          enemy.status = 0; rebindNativeLegionViews(sc); state.removed = true;
        }
        if (state.pause && !state.paused && tick >= 40) {
          state.paused = true; app.gamebar.settingsOpen = true; app.mapPointerHold = true;
          app.gamebar.syncClock();
        }
        if (tick >= 160) {
          state.done = true; state.running = false;
          app.gamebar.settingsOpen = true; app.gamebar.syncClock();
        }
      };
    });
    const runs = [];
    for (let run = 0; run < 7; run++) {
      await page.evaluate(run => window.__nativeMarch.begin(run < 5 ? run : 2, { contact: run === 6, pause: run === 5 }), run);
      if (run === 5) {
        await page.waitForFunction(() => window.__nativeMarch.paused);
        const held = await page.evaluate(() => ({ tick: window.__app.clock.strategicTickSerial,
          phase: window.__app.clock.dayProgress(), rows: window.__nativeMarch.rows.length }));
        await page.evaluate(() => {
          window.__app.clock.strategicSpeed = 4;
          window.__app.gamebar.settingsOpen = false;
          window.__app.gamebar.syncClock();
        });
        await page.waitForTimeout(200);
        assert.deepEqual(await page.evaluate(() => ({ tick: window.__app.clock.strategicTickSerial,
          phase: window.__app.clock.dayProgress(), rows: window.__nativeMarch.rows.length })), held,
          'remaining pointer hold freezes rules and already published positions after speed change');
        await page.evaluate(() => { window.__app.mapPointerHold = false; window.__app.gamebar.syncClock(); });
      }
      await page.waitForFunction(() => window.__nativeMarch.done);
      const trace = await page.evaluate(() => {
        const state = window.__nativeMarch, app = window.__app;
        return { rows: state.rows, ticks: state.ticks, sounds: state.sounds, contacts: state.contacts,
          initialRng: state.rng, rng: app.originalRng.snapshot(),
          contactEnded: !app.scenario.legions[0]._engagement, failure: Boolean(app._strategicBattleFailure) };
      });
      assert.equal(trace.failure, false);
      assert.equal(trace.ticks.length, 160);
      assert.deepEqual(trace.rng, trace.initialRng);
      for (let army = 0; army < 2; army++) {
        const addresses = trace.ticks.map(t => t[army]);
        const changes = addresses.map((p, i) => i && p !== addresses[i - 1] ? i + 1 : 0).filter(Boolean);
        const visible = trace.rows.filter(row => row.army === army);
        for (let i = 1; i < visible.length; i++) {
          const delta = visible[i].progress - visible[i - 1].progress;
          assert.ok(delta >= -1e-8 && delta <= 1 + 1e-8, 'visible native path never rewinds or skips a whole segment');
        }
        for (const tick of changes) {
          assert.equal(addresses[tick - 1] - addresses[tick - 2], 4, 'native action consumes one original point');
          if (tick < 150) assert.ok(visible.some(row => row.tick >= tick && row.tick < tick + 8),
            'each army point submission has a Canvas draw within one slot sweep');
        }
        assert.ok(changes.length >= 5);
      }
      assert.ok(trace.rows.length > 10, 'real RAF rendered multiple native positions');
      if (run === 6) {
        assert.ok(trace.contacts > 0); assert.equal(trace.sounds, 1);
        assert.equal(trace.contactEnded, true, 'removed native opponent cancels contact and movement resumes');
      }
      runs.push({ run, draws: trace.rows.length, sounds: trace.sounds });
    }
    process.stdout.write(`native march RAF five speeds, two periods, hold/speed/cancel: ${JSON.stringify(runs)}\n`);
  }
  assert.deepEqual(errors, []);
  await context.close();
  process.stdout.write(`march markers browser OK DPR=${deviceScaleFactor}: 120 images, 192 city anchors, departure/arrival origins, panned garrison/pick/snap\n`);
  }
} finally {
  await browser?.close();
  await server.close();
}
