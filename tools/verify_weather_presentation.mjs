// Synthetic fixed-slot weather + the real Clock/2459/2533 chain; no saves.
import assert from "node:assert/strict";
import { Clock } from "../web/src/game/clock.js";
import { tickOriginalStrategicWeather, prepareOriginalStrategicMapObjects } from "../web/src/game/weather.js";
import { WeatherPresentation } from "../web/src/render/weatherpresentation.js";

for (let speed = 0; speed < 5; speed++) {
  const source = { status: 0x80, active: true, group: 0, frame: 0,
    x: 100, y: 100, phaseX: 14, velocityX: 1, phaseY: 0, velocityY: 0,
    timer: 1, interval: 16 };
  const sc = { weatherClouds: [source, ...Array.from({ length: 15 }, () => ({ status: 0 }))],
    disasterMapObjects: Array.from({ length: 16 }, () => ({ status: 0 })),
    weatherCloudBounds: { minX: -16, maxX: 400, minY: -16, maxY: 272 } };
  let rngCalls = 0;
  const fx = new WeatherPresentation();
  const clock = new Clock({ startYear: 190, startMonth: 1, startDay: 1,
    onStrategicTick: () => tickOriginalStrategicWeather(sc, { nextByte: () => { rngCalls++; return 3; } }),
    onStrategicUpdateComplete: c => fx.capture(sc, c, prepareOriginalStrategicMapObjects(sc)) });
  clock.strategicSpeed = speed;
  fx.capture(sc, clock, prepareOriginalStrategicMapObjects(sc));
  fx.update(sc, 0, { clock });
  clock.advance(clock.currentStep);
  fx.update(sc, 1, { clock });
  assert.equal(source.x, 101);
  assert.equal(source.frame, 1);
  assert.equal(fx.clouds[0].frame, 0, "expiry draw selects old frame before dirty is consumed");
  assert.equal(fx.clouds[0].x, 100);
  clock.advance(clock.currentStep * 8);
  fx.update(sc, 2, { clock });
  assert.equal(fx.clouds[0].frame, 1);
  assert.equal(fx.clouds[0].x, 100.5, "interpolation follows shared strategic progress, not wall time");
  const before = JSON.stringify(sc), calls = rngCalls, frozen = JSON.stringify(fx.clouds);
  clock.hold = true;
  clock.advanceFrame(100000);
  fx.update(sc, 100000, { enabled: false, clock });
  assert.equal(JSON.stringify(fx.clouds), frozen);
  clock.hold = false;
  fx.update(sc, 200000, { clock });
  assert.equal(JSON.stringify(fx.clouds), frozen, "no independent wall animation or resume debt");
  assert.equal(JSON.stringify(sc), before);
  assert.equal(rngCalls, calls, "projection must not consume RNG");
  source.x = -16;
  fx.capture(sc, clock, prepareOriginalStrategicMapObjects(sc));
  fx.update(sc, 200001, { clock });
  assert.equal(fx.clouds[0].x, -16, "physical wrap snaps, not world-crossing interpolation");
  source.status = 0;
  fx.capture(sc, clock, prepareOriginalStrategicMapObjects(sc));
  fx.update(sc, 200002, { clock });
  assert.equal(fx.clouds[0], null, "inactive objects have no invented fade tail");
  fx.reset();
  assert.ok(fx.clouds.every(cloud => cloud === null));
  assert.equal(fx.objectFrames.size, 0);
}
// pi-lens-ignore: no-console-except-error-js
console.log("weather presentation OK: five shared speeds, old-frame snapshot, strategic interpolation, holds, no wall debt/RNG, wrap and removal");
