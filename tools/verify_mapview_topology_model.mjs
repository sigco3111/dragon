// B-3b mapview overlay model: fake DOM + recording canvas for
// server/public/mapview.txt topology overlay (NOT a browser certificate).
// Usage: node tools/verify_mapview_topology_model.mjs
import { readFileSync } from 'node:fs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};

class Element {
  children = []; textContent = ''; hidden = false; disabled = false;
  onclick = null; value = ''; width = 0; height = 0;
  append(...v) { this.children.push(...v); }
  replaceChildren(...v) { this.children = [...v]; }
}
const makeCtx = log => ({
  log,
  clearRect(...a) { log.push(['clearRect']); },
  fillRect(...a) { log.push(['fillRect', ...a]); },
  beginPath() { log.push(['beginPath']); },
  moveTo(...a) { log.push(['moveTo', ...a]); },
  lineTo(...a) { log.push(['lineTo', ...a]); },
  stroke() { log.push(['stroke']); },
  set fillStyle(v) { log.push(['fillStyle', v]); },
  set strokeStyle(v) { log.push(['strokeStyle', v]); },
  set lineWidth(v) {},
});
const GAME = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
const apiGame = { gameId: GAME, metadata: { name: 'M3UI', introduction: '' }, draftRevision: '1' };
const road = { id: 'road-0', fromCityId: 'city-000', toCityId: 'city-002', travelKind: 'land', geometry: [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
const apiDetail = {
  gameId: GAME, draftRevision: '1', map: { placements: 2, roads: [road] },
  strongholds: [{ cityId: 'city-000', runtimeSlot: 0, x: 5, y: 5, placed: true, roads: ['road-0'], chapters: [] }],
  chapters: [],
};
const apiTopo = { gameId: GAME, moves: [{ cityId: 'city-000', x: 9, y: 9, updatedAt: 't' }], rebuilds: [], blocked: true };
function setup({ topo = apiTopo, topoFail = false } = {}) {
  const nodes = {};
  for (const id of ['mapview-editor', 'mapview-games', 'mapview-inspect', 'mapview-refresh', 'mapview-canvas', 'mapview-roads', 'mapview-message']) {
    nodes[id] = new Element();
  }
  nodes['mapview-canvas'].width = 384; nodes['mapview-canvas'].height = 256;
  const log = [];
  nodes['mapview-canvas'].getContext = () => makeCtx(log);
  const calls = [];
  globalThis.document = {
    querySelector: q => nodes[q.slice(1)] ?? null,
    createElement: () => new Element(),
  };
  const api = async path => {
    calls.push(path);
    if (path === '/api/games') return { games: [apiGame] };
    if (path.includes('/draft?revision=')) return structuredClone(apiDetail);
    if (path.endsWith('/topology')) {
      if (topoFail) { const e = new Error('down'); e.status = 503; throw e; }
      return structuredClone(topo);
    }
    throw new Error('unexpected ' + path);
  };
  return { nodes, calls, log, api };
}
const source = readFileSync('server/public/mapview.txt', 'utf8');
const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const admin = { user: { id: 'u', role: 'admin', mustChangePassword: false } };

{
  const { nodes, api } = setup();
  const ui = module.installMapViewer({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(null);
  check('hidden pre-login', nodes['mapview-editor'].hidden === true);
  ui.setIdentity(admin);
  await nodes['mapview-refresh'].onclick();
  check('summary line', nodes['mapview-roads'].children.some(c => c.textContent.includes('道路 1')));
}
{
  const { nodes, api, log } = setup();
  const ui = module.installMapViewer({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['mapview-refresh'].onclick();
  check('amber marker', log.some(e => e[0] === 'fillStyle' && e[1] === '#d08000') && log.some(e => e[0] === 'fillRect' && e[3] === 5 && e[4] === 5));
  const strokes = log.filter(e => e[0] === 'strokeStyle').map(e => e[1]);
  check('broken red overlay', strokes.includes('#d00000'));
  check('status counts', nodes['mapview-roads'].children.some(c => c.textContent.includes('拓撲意向 1') && c.textContent.includes('斷路 1') && c.textContent.includes('存盘发布阻挡')));
  check('topology fetched', true);
}
{
  const { nodes, api, log } = setup({ topoFail: true });
  const ui = module.installMapViewer({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['mapview-refresh'].onclick();
  check('degrades without topo', !log.some(e => e[0] === 'fillStyle' && e[1] === '#d08000') &&
    nodes['mapview-roads'].children.some(c => c.textContent.includes('道路 1')));
}

console.log(`passed ${passed} checks`);
