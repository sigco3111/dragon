import assert from 'node:assert/strict';
import { attachMobileControls } from '../web/src/ui/mobilecontrols.js';
import { attachInput } from '../web/src/core/input.js';
import { HUD } from '../web/src/ui/hud.js';
{
const originalInterval = globalThis.setInterval;
globalThis.setInterval = () => 1;
function fixture(matches) {
  const nodes = new Map();
  const listeners = new Set();
  const query = { matches, addEventListener(t, f) { listeners.add(f); }, removeEventListener(t, f) { listeners.delete(f); } };
  const doc = {
    querySelector(s) { return nodes.get(s); },
    createElement() { return { style: {}, dataset: {}, addEventListener() {}, appendChild() {}, append() {} }; },
    body: { appendChild(el) { nodes.set('#'+el.id, el); } },
  };
  return { doc, nodes, listeners, query, env: { document: doc, matchMedia: () => query, search: '' } };
}
try {
  const f = fixture(false);
  assert.equal(attachMobileControls({}, f.env), null);
  assert.equal(attachMobileControls({}, f.env), null);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.nodes.size, 0);
  for (const fn of f.listeners) fn({ matches: false });
  assert.equal(f.nodes.size, 0);
  f.query.matches = true;
  for (const fn of [...f.listeners]) fn({ matches: true });
  assert.equal(f.listeners.size, 0);
  assert.equal(f.nodes.size, 3);
  const root = f.nodes.get('#mobilecontrols');
  assert.equal(attachMobileControls({}, f.env), root);
  assert.equal(f.nodes.size, 3);
  const direct = fixture(true);
  assert.ok(attachMobileControls({}, direct.env));
  assert.equal(direct.listeners.size, 0);
  const forced = fixture(false);
  assert.ok(attachMobileControls({}, { ...forced.env, search: '?mobileui=1' }));
  assert.equal(forced.listeners.size, 0);
  console.log('mobile pointer: late touch, no duplicate listeners/DOM, direct touch and forced mode passed');
} finally { globalThis.setInterval = originalInterval; }
}
{
const events = new Map();
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => events.set(type, fn);
let commands = 0, prevented = 0;
attachInput({ cv: { style: {}, addEventListener() {} } }, { onWheel() { commands++; } });
const wheel = events.get('wheel');
for (const target of [{ closest() { return {}; } }, { closest() { return null; } }, null]) {
  wheel({ target, preventDefault() { prevented++; } });
}
assert.equal(commands, 2);
assert.equal(prevented, 2);
console.log('mobile wheel: DOM scroll bypasses map handler; canvas/unknown preserve routing');
}
{
const nodes = new Map();
let mobile = false;
globalThis.document = {
  querySelector(s) { return s === '#mobilecontrols' ? (mobile ? {} : null) : nodes.get(s); },
  createElement() { return { style: {}, attrs: {}, setAttribute(k,v) { this.attrs[k]=v; }, remove() { nodes.delete('#'+this.id); } }; },
  body: { append(e) { nodes.set('#'+e.id,e); } },
};
const failure = {error:new Error('Invalid native faction slot')};
const hud = {app:{_strategicBattleFailure:failure}};
HUD.prototype._syncFailureBanner.call(hud);
let b=nodes.get('#failurebanner');
assert.equal(b.attrs.role,'alert');
assert.match(b.style.cssText,/bottom:8px/);
assert.match(b.style.cssText,/z-index:10001/);
assert.match(b.textContent,/Invalid native faction slot/);
mobile=true;
HUD.prototype._syncFailureBanner.call(hud);
assert.equal(nodes.get('#failurebanner'),b);
assert.match(b.style.cssText,/bottom:104px/);
assert.match(b.style.cssText,/font-size:22px/);
assert.equal(hud.app._strategicBattleFailure,failure);
hud.app._strategicBattleFailure=null;
HUD.prototype._syncFailureBanner.call(hud);
assert.equal(nodes.has('#failurebanner'),false);
console.log('failure banner: desktop/mobile/live transition/removal/state preservation passed');
}
