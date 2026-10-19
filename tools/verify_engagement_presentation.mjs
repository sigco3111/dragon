// Original countdown/request branch is covered by verify_native_road_movement.
// This test covers only the read-only presentation and audio lifecycle adapter.
import assert from "node:assert/strict";
import { EngagementPresentation } from "../web/src/render/engagementpresentation.js";
const contact = (countdown = 11) => ({
  faction: 0, x: 1, y: 2,
  _engagement: { kind: "field", countdown, target: { x: 3, y: 4 } },
});
const a = contact(), b = contact(10);
const scenario = { legions: [a] };
let plays = 0, stops = 0;
const fx = new EngagementPresentation({
  playSound: () => { plays++; return true; },
  stopSound: () => { stops++; },
});
fx.update(scenario, 0);
assert.equal(plays, 0, "first visible contact does not invent an ID3 request");
assert.equal(fx.frameOf(a), 3);
const before = structuredClone(scenario);
for (const now of [20, 30, 100, 9000]) fx.update(scenario, now);
assert.equal(plays, 0, "RAF/wall time never creates a rule sound event");
assert.equal(fx.frameOf(a), 3, "no timer-driven animation on a stationary countdown");
assert.deepEqual(scenario, before);

for (const count of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
  a._engagement.countdown = count;
  fx.update(scenario, 9001);
  assert.equal(fx.frameOf(a), count & 3);
}
a._engagement = { ...a._engagement, countdown: 2, target: { x: 30, y: 40 } };
scenario.legions.push(b);
fx.update(scenario, 9010);
assert.equal(fx.frameOf(a), 2);
assert.equal(fx.frameOf(b), 2);
b._engagement.countdown = 9;
fx.update(scenario, 9020);
assert.equal(fx.frameOf(b), 1, "each contact owns its original counter phase");
for (let n = 0; n < 7; n++) fx.requestSound(scenario);
assert.equal(plays, 7, "no shared five-sound budget; the audio driver owns same-ID retriggering");
fx.update(scenario, 9021, { paused: true });
assert.equal(stops, 1);
const frozen = fx.frameOf(a);
fx.update(scenario, 50000, { paused: true });
assert.equal(fx.frameOf(a), frozen);
assert.equal(stops, 1);
fx.update(scenario, 50001);
assert.equal(plays, 7, "resuming does not replay missed wall-time beats");
fx.requestSound(scenario);
assert.equal(plays, 8);
a._engagement = null;
assert.equal(fx.frameOf(a), null);
fx.update(scenario, 50002);
assert.equal(stops, 1, "remaining contact still owns the sound");
b.dead = true;
fx.update(scenario, 50003);
assert.equal(stops, 2);
assert.equal(fx.frameOf(b), null);

// A request emitted during the first rule batch must survive the following RAF.
const fresh = { legions: [contact()] };
fx.requestSound(fresh);
fx.update(fresh, 60000);
assert.equal(stops, 2);
assert.equal(plays, 9);
fx.update(fresh, 60001, { enabled: false });
assert.equal(stops, 3);
assert.equal(fx.contacts.size, 0);
for (const mode of ["false", "throw"]) {
  let attempts = 0, cleanup = 0;
  const interrupted = new EngagementPresentation({
    playSound: () => {
      if (++attempts === 1) return true;
      if (mode === "throw") throw new Error("interrupted audio fixture");
      return false;
    },
    stopSound: () => { cleanup++; },
  });
  interrupted.requestSound(fresh);
  assert.doesNotThrow(() => interrupted.requestSound(fresh));
  interrupted.reset();
  assert.equal(cleanup, 1, "failed retrigger retains cleanup ownership");
}
process.stdout.write("engagement presentation OK: counter phases, event-driven sound, no invented beats/cap/backlog, lifecycle and audio failure isolation\n");
