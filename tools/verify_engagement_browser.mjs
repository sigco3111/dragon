// Fresh browser/static root. Synthetic rule-poll input + real Clock/RAF/Canvas/audio;
// actual native 286C/28B4 integration is covered by verify_native_road_movement. No SAVE/API.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright",
);
const root = fileURLToPath(new URL("../web/", import.meta.url));
// pi-lens-ignore: hardcoded-url-js
const server = http.createServer(async (request, response) => {
  try {
    // pi-lens-ignore: hardcoded-url-js
    const url = new URL(request.url, "http://127.0.0.1");
    const file = path.resolve(
      root,
      `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
    );
    assert.ok(file.startsWith(root));
    const body = await fs.readFile(file);
    const types = {
      ".js": "text/javascript",
      ".json": "application/json",
      ".html": "text/html",
      ".css": "text/css",
    };
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !!window.__app?.startMenu?._onClick);
  async function rebind(x, y) {
    await page.evaluate(() => {
      window.__engagementMenuHandler = window.__app.startMenu._onClick;
    });
    await page.mouse.click(x, y);
    await page.waitForFunction(
      () =>
        window.__app.startMenu._onClick &&
        window.__app.startMenu._onClick !== window.__engagementMenuHandler,
    );
  }
  await rebind(468, 360);
  await rebind(512, 234);
  await rebind(512, 234);
  await page.mouse.click(584, 455);
  await page.waitForFunction(
    () => window.__app.gameStarted && window.__app.runtimeEnabled,
  );
  await page.evaluate(async () => {
    const app = window.__app;
    await app.prepareEngageAudio();
    app.music.setType(0); // CF9 OFF does not silence engagement SFX.
    // Isolate presentation from AI: real Clock/RAF/hold/render/audio remain active.
    app.clock.onStrategicTick = null;
    app.clock.onHour = null;
    app.gamebar.miniOpen = true;
    const player = app.scenario.factions.find(
      (f) => f.idx === app.scenario.player_faction,
    );
    const city = app.scenario.cities[player.capital];
    const army = {
      faction: player.idx,
      slot: 0,
      status: 0xe0,
      _active: true,
      x: city.x - 2,
      y: city.y,
      prevX: city.x - 2,
      prevY: city.y,
      troops: 100,
      morale: 200,
      _markerFrame: 1,
      _engagement: {
        kind: "siege",
        countdown: 11,
        target: { cityIdx: city.idx },
      },
    };
    window.__engagementVerify = {
      army,
      records: [],
      frames: [],
      stops: 0,
      rng: app.originalRng.snapshot(),
    };
    const state = window.__engagementVerify;
    app.clock.onStrategicTick = c => {
      if (!state.running) return;
      const tick = c.strategicTickSerial - state.origin;
      if ((tick - 1) % 8) return;
      const visit = (tick - 1) / 8;
      if (visit === 12) {
        state.running = false;
        state.done = true;
        app.gamebar.settingsOpen = true;
        app.gamebar.syncClock();
        return;
      }
      if (visit > 0 && visit % state.period === 0) app.engagementFx.requestSound(app.scenario);
      army._engagement.countdown = Math.max(1, 11 - visit);
    };
    const play = app.engagementFx.playSound;
    app.engagementFx.playSound = () => {
      const ok = play();
      state.records.push({
        t: performance.now(),
        frame: app.engagementFx.frameOf(army),
        tick: app.clock.strategicTickSerial - state.origin,
        countdown: army._engagement.countdown,
        ok,
      });
      return ok;
    };
    const stop = app.engagementFx.stopSound;
    app.engagementFx.stopSound = () => {
      state.stops++;
      stop();
    };
    const draw = app.view._drawEngagement;
    app.view._drawEngagement = function (ctx, x, y, frame) {
      if (state.frames.at(-1)?.frame !== frame)
        state.frames.push({ t: performance.now(), frame });
      draw.call(this, ctx, x, y, frame);
    };
  });
  // Let the existing pointer-motion hold expire; do not bypass product input holds.
  await page.waitForFunction(() => !window.__app.clock.hold);
  const matrix = [];
  for (const period of [2, 3]) for (let speed = 0; speed < 5; speed++) {
    await page.evaluate(({ value, period }) => {
      const app = window.__app,
        state = window.__engagementVerify;
      app.engagementFx.reset();
      state.records = [];
      state.frames = [];
      app.clock.strategicSpeed = value;
      state.origin = app.clock.strategicTickSerial;
      state.period = period;
      state.done = false;
      state.running = true;
      state.army._engagement.countdown = 11;
      app.scenario.legions = [state.army];
    }, { value: speed, period });
    await page.waitForFunction(() => window.__engagementVerify.done);
    const run = await page.evaluate(() => {
      const app = window.__app,
        state = window.__engagementVerify;
      app.gamebar.settingsOpen = true;
      app.gamebar.syncClock();
      return {
        records: state.records,
        frames: state.frames,
        countdown: state.army._engagement.countdown,
        rng: app.originalRng.snapshot(),
        initialRng: state.rng,
        step: app.clock.currentStep,
      };
    });
    assert.deepEqual(run.records.map(r => r.tick), period === 2 ? [17, 33, 49, 65, 81] : [25, 49, 73]);
    assert.ok(run.records.every(r => r.ok), "real unlocked WebAudio accepts every due request");
    assert.ok(new Set(run.frames.map(r => r.frame)).size === 4, "all four rule phases are displayed");
    assert.equal(run.countdown, 1);
    assert.deepEqual(run.rng, run.initialRng);
    const median = (items) =>
      items.toSorted((a, b) => a - b)[Math.floor(items.length / 2)];
    const intervals = (items) => items.slice(1).map((x, i) => x.t - items[i].t);
    const frameMs = median(intervals(run.frames)),
      soundMs = median(intervals(run.records));
    const expectedSoundMs = 8 * period * run.step;
    assert.ok(soundMs >= expectedSoundMs * 0.65 && soundMs < expectedSoundMs * 3,
      `period${period}/speed${speed}: ${soundMs}ms request interval vs ${expectedSoundMs}ms budget`);
    matrix.push({ period, speed, frameMs, soundMs });
    await page.waitForFunction(() => window.__app.engagementFx.paused);
    const held = await page.evaluate(() => ({
      phase: window.__app.engagementFx.frameOf(window.__engagementVerify.army),
      count: window.__engagementVerify.records.length,
      stops: window.__engagementVerify.stops,
    }));
    await page.waitForTimeout(250);
    assert.deepEqual(
      await page.evaluate(() => ({
        phase: window.__app.engagementFx.frameOf(window.__engagementVerify.army),
        count: window.__engagementVerify.records.length,
        stops: window.__engagementVerify.stops,
      })),
      held,
    );
    await page.evaluate(() => {
      window.__app.gamebar.settingsOpen = false;
      window.__app.gamebar.syncClock();
    });
  }
  await page.screenshot({
    path: path.join(os.tmpdir(), "dragon-rule-engagement.png"),
  });
  await page.evaluate(() => {
    window.__app.scenario.legions = [];
  });
  await page.waitForFunction(
    () => window.__app.engagementFx.contacts.size === 0,
  );
  const ended = await page.evaluate(() => ({
    count: window.__engagementVerify.records.length,
    frame: window.__app.engagementFx.frameOf(window.__engagementVerify.army),
  }));
  await page.waitForTimeout(300);
  assert.equal(ended.frame, null);
  assert.equal(
    await page.evaluate(() => window.__engagementVerify.records.length),
    ended.count,
  );
  await page.evaluate(() => {
    void window.__app.returnToTitle();
  });
  await page.waitForFunction(() => window.__app.scenario == null);
  assert.deepEqual(errors, []);
  process.stdout.write(
    JSON.stringify(matrix) +
      "\nengagement browser OK: real RAF/Canvas/WebAudio, five speeds × period2/3 rule-poll input, hold/end/title and unchanged RNG\n",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
