import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TrialStrategicClock } from "../web/src/editor/trialruleboundaries.js";

const { Clock, STRATEGIC_SPEEDS, MAX_TICKS_PER_FRAME } = await import("../web/src/game/clock.js");

assert.deepEqual(
  STRATEGIC_SPEEDS,
  [30, 17.5, 10, 5, 1.5625],
  "本轮战略五档墙钟间隔再次减半，普通档每主更新10ms",
);
assert.equal(MAX_TICKS_PER_FRAME, 12);

// Both entry points must consume the same source, including the generated
// server trial bundle. Read only these explicit source/bundle paths; no saves.
let bundle;
try {
  bundle = JSON.parse(readFileSync(new URL("../server/public/trialweb.txt", import.meta.url), "utf8"));
} catch (cause) {
  throw new Error("Cannot read generated Trial bundle", { cause });
}
for (const path of ["src/game/clock.js", "src/editor/trialruleboundaries.js"]) {
  const source = readFileSync(new URL(`../web/${path}`, import.meta.url));
  const packed = bundle.files.find((file) => file.path === path);
  assert.equal(packed.text, source.toString("utf8"), `${path}: trial bundle current`);
  assert.equal(packed.byteLength, source.length);
  assert.equal(packed.sha256, createHash("sha256").update(source).digest("hex"));
}

// Simulated 60Hz: each speed delivers twice the old wall-clock throughput
// (within one fractional update), without a six-step ceiling at top speed.
for (const speed of [0, 1, 2, 3, 4]) {
  const options = { startYear: 196, startMonth: 1 };
  const base = new Clock(options);
  const trial = new TrialStrategicClock({
    ...options, gate: { canAdvanceRules: true, rulePermit: {} },
  });
  const old = new Clock(options);
  old.SPEEDS = [60, 35, 20, 10, 3.125];
  for (const c of [base, trial, old]) c.strategicSpeed = speed;
  for (let frame = 0; frame < 600; frame++) {
    base.advanceFrame(1000 / 60);
    trial.advanceFrame(1000 / 60);
    old.advanceFrame(1000 / 60);
  }
  const expected = 10000 / STRATEGIC_SPEEDS[speed];
  assert.ok(Math.abs(base.strategicTickSerial - expected) < 1.001);
  assert.ok(Math.abs(base.strategicTickSerial - old.strategicTickSerial * 2) <= 1);
  assert.equal(trial.strategicTickSerial, base.strategicTickSerial);
  assert.deepEqual(trial.serialize(), base.serialize());
  assert.equal(trial.sub, base.sub);
  assert.equal(trial.hour, base.hour);
  // Strategic speed does not change the calendar per completed update.
  const singleStep = new Clock(options);
  for (let i = 0; i < base.strategicTickSerial; i++) singleStep.advance(singleStep.currentStep);
  assert.deepEqual(singleStep.serialize(), base.serialize());
  assert.equal(singleStep.sub, base.sub);
  assert.equal(singleStep.hour, base.hour);
}

let days = 0;
const clock = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onDay(current) {
    days++;
    current.hold = true;
  },
});
clock.strategicSpeed = 4;
clock.sub = 8;
clock.hour = 23;
clock._acc = 0;
clock.advance(clock.currentStep * 20);
assert.equal(days, 1, "large dt stops after onDay obtains hold");
assert.equal(clock.hour, 0);
assert.equal(clock._acc, 0);

const legacy = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onDay(current) {
    current._legacyPaused = true;
  },
});
legacy.strategicSpeed = 4;
legacy.sub = 8;
legacy.hour = 23;
legacy.advance(legacy.currentStep * 20);
assert.equal(legacy.hour, 0);
assert.equal(legacy._acc, 0);

// 高速档的大dt中，战略tick刚建立委任过渡后必须在同一catch-up循环
// 同步hold；不能等下一浏览器RAF才由GameBar发现，否则日期仍继续跑。
let transitionActive = false;
let transitionTicks = 0;
const transitionClock = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onStrategicTick() {
    transitionTicks++;
    transitionActive = true;
  },
  onSyncHold() {
    transitionClock.hold = transitionActive;
  },
});
transitionClock.strategicSpeed = 4;
transitionClock.advance(transitionClock.currentStep * 20);
assert.equal(transitionTicks, 1, "委任过渡建立后必须立即停止高速追赶");
assert.equal(transitionClock.sub, 1, "仅当前0x1D0B完成，后续日历追赶必须冻结");
assert.equal(transitionClock._acc, 0);

// 浏览器RAF不得追赶整帧欠账；即使最高速遇到大dt，每次Canvas提交前
// 单个RAF至多执行MAX_TICKS_PER_FRAME次（60Hz喂饱最高速），超额欠账丢弃；
// hold在每次更新后检查，任一接战即停（advanceFrame内单测用hold变体另覆盖）。
let frameTicks = 0;
const frameClock = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onStrategicTick() {
    frameTicks++;
  },
});
frameClock.strategicSpeed = 4;
assert.equal(frameClock.advanceFrame(frameClock.currentStep * 20), true);
assert.equal(frameTicks, MAX_TICKS_PER_FRAME, "大dt单个RAF按上限执行后停");
assert.ok(frameClock._acc < frameClock.currentStep, "超额欠账丢弃，只保留小于step的相位");
assert.equal(frameClock.advanceFrame(frameClock.currentStep / 2), false);
assert.equal(frameClock.advanceFrame(frameClock.currentStep / 2), true);
assert.equal(frameTicks, MAX_TICKS_PER_FRAME + 1, "小数相位跨RAF累积后正常执行下一更新");

// 首tick置hold：同一RAF内不再执行后续更新（接战四相即停）。
let holdTicks = 0;
const holdClock = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onStrategicTick() {
    holdTicks++;
    holdClock.hold = true;
  },
});
holdClock.strategicSpeed = 4;
assert.equal(holdClock.advanceFrame(holdClock.currentStep * 20), true);
assert.equal(holdTicks, 1, "hold后同一RAF不再推进");

// 月末当天onDay取得hold时，同一_tick不能继续月进位或触发月结算。
let months = 0;
let holdMonthOnce = true;
const monthHold = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 31,
  onDay(current) {
    if (holdMonthOnce) {
      holdMonthOnce = false;
      current.hold = true;
    }
  },
  onMonthEnd() {
    months++;
  },
});
monthHold.sub = 8;
monthHold.hour = 23;
monthHold.advance(monthHold.currentStep);
assert.equal(monthHold.day, 31);
assert.equal(monthHold.month, 1);
assert.equal(months, 0);
monthHold.hold = false;
monthHold.advance(monthHold.currentStep);
assert.equal(monthHold.day, 1);
assert.equal(monthHold.month, 2);
assert.equal(monthHold.hour, 1, "1DDB清零后1DE0仍会把新日时刻加到1");
assert.equal(months, 1);

// 1DA3..1DD7：5358看到新年月与day低字节0，真实返回后day才加一。
for (const [startYear, expectedYear] of [
  [999, 1000],
  [1000, 999],
  [1001, 999],
  [0xffff, 999],
]) {
  const calls = [];
  const boundary = new Clock({
    startYear,
    startMonth: 12,
    startDay: 31,
    onYearEnd: (current) =>
      calls.push(["year", current.year, current.month, current.day]),
    onMonthEnd: (current) =>
      calls.push(["month", current.year, current.month, current.day]),
  });
  boundary._advanceDayCalendar();
  assert.deepEqual(
    [boundary.year, boundary.month, boundary.day],
    [expectedYear, 1, 1],
  );
  assert.deepEqual(calls, [
    ["year", expectedYear, 1, 0],
    ["month", expectedYear, 1, 0],
  ]);
}
{
  const calls = [];
  const boundary = new Clock({
    startYear: 190,
    startMonth: 1,
    startDay: 31,
    onMonthEnd: (current) =>
      calls.push([current.year, current.month, current.day]),
  });
  boundary._advanceDayCalendar();
  assert.deepEqual(calls, [[190, 2, 0]]);
  assert.deepEqual([boundary.year, boundary.month, boundary.day], [190, 2, 1]);
}

// 0x1D8E：CF2必须经历0..8共9次主更新才进一时刻；onStrategicTick每次执行。
let strategicTicks = 0;
let hours = 0;
const layered = new Clock({
  startYear: 190,
  startMonth: 1,
  startDay: 1,
  onStrategicTick() {
    strategicTicks++;
  },
  onHour() {
    hours++;
  },
});
for (let i = 0; i < 8; i++) layered.advance(layered.currentStep);
assert.equal(layered.sub, 8);
assert.equal(layered.hour, 0);
layered.advance(layered.currentStep);
assert.equal(layered.sub, 0);
assert.equal(layered.hour, 1);
assert.equal(strategicTicks, 9);
assert.equal(hours, 1);

process.stdout.write(
  "clock transition OK: 9 strategic ticks/hour + bounded RAF + catch-up and month rollover holds\n",
);
