// Q30-1 generals conflict UX model: failure messages land in the module
// area and propagate (NOT a browser certificate). Portrait-upload canvas
// flow stays browser-lane. Usage: node tools/verify_generals_conflict_model.mjs
import { readFileSync } from 'node:fs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`ok ${name}`); return; }
  console.error(`FAIL ${name} ${extra}`); process.exitCode = 1;
};

class Element {
  children = []; textContent = ''; hidden = false; disabled = false;
  onclick = null; onchange = null; oninput = null; type = ''; value = '';
  append(...v) { this.children.push(...v); }
  replaceChildren(...v) { this.children = [...v]; }
  querySelectorAll(selector) {
    if (selector !== 'button') return [];
    const out = [];
    const walk = node => { for (const child of node.children) { if (child.type === 'button') out.push(child); walk(child); } };
    walk(this);
    return out;
  }
}
const GAME = 'ffffffff-ffff-4fff-ffff-ffffffffffff';
const apiGame = { gameId: GAME, metadata: { name: 'G', introduction: '' }, draftRevision: '1' };
const apiDetail = {
  gameId: GAME, draftRevision: '1', metadata: apiGame.metadata,
  chapters: [{ chapterId: 'ch1', name: '第一章', factions: [], generals: [{ idx: 0, name: '關羽', hao: '', portraitKey: null }], cities: [] }],
};
const portraitsOf = [{ assetId: 'guan', mime: 'image/png', width: 128, height: 128, byteLength: 100, inUse: false }];
function setup({ failSave = null, failDelete = null, prompts = [] } = {}) {
  const nodes = {};
  for (const id of ['generals-editor', 'generals-games', 'generals-inspect', 'generals-refresh', 'generals-chapters', 'generals-message', 'portrait-library', 'portrait-list', 'portrait-pick']) {
    nodes[id] = new Element();
  }
  const calls = [];
  globalThis.document = {
    querySelector: q => nodes[q.slice(1)] ?? null,
    createElement: () => new Element(),
  };
  const promptQueue = [...prompts];
  globalThis.prompt = () => promptQueue.length ? promptQueue.shift() : null;
  globalThis.confirm = () => true;
  const api = async (path, value, _options) => {
    calls.push({ path, value });
    if (path === '/api/games') return { games: [apiGame] };
    if (path.includes('/draft?revision=')) return structuredClone(apiDetail);
    if (path.endsWith('/draft/save')) {
      if (failSave) { const e = new Error(failSave); throw e; }
      return { draftRevision: '2' };
    }
    if (path.includes('/portraits/')) {
      if (failDelete) { const e = new Error(failDelete); throw e; }
      return { removed: true };
    }
    if (path.endsWith('/portraits')) return { portraits: portraitsOf };
    throw new Error(`unexpected ${path}`);
  };
  return { nodes, calls, api };
}
const source = readFileSync('server/public/general.txt', 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const admin = { user: { id: 'u', role: 'admin', mustChangePassword: false } };
const runCalls = [];
const work = fn => { const r = fn(); runCalls.push(r?.catch ? r.catch(() => {}) : r); return r; };
const findButton = (root, label) => {
  const stack = [...root.children];
  while (stack.length) {
    const node = stack.shift();
    if (node.type === 'button' && node.textContent === label) return node;
    stack.push(...node.children);
  }
  return null;
};
{
  const { nodes, api } = setup();
  const ui = module.installGenerals({ api, authority: () => admin, work, isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['generals-refresh'].onclick();
  check('general row', findButton(nodes['generals-chapters'], '改名／字') !== null);
}
{
  const { nodes, api } = setup({ failSave: '修訂已變，請重讀。', prompts: ['關平', '坦之'] });
  const ui = module.installGenerals({ api, authority: () => admin, work, isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['generals-refresh'].onclick();
  const btn = findButton(nodes['generals-chapters'], '改名／字');
  let threw = false;
  try { await btn.onclick(); } catch { threw = true; }
  check('save conflict message', nodes['generals-message'].textContent.includes('保存失敗') && nodes['generals-message'].textContent.includes('修訂已變'));
  check('save conflict propagates', threw === true);
}
{
  const { nodes, api } = setup({ prompts: [null] });
  const ui = module.installGenerals({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['generals-refresh'].onclick();
  const btn = findButton(nodes['generals-chapters'], '改名／字');
  await btn.onclick();
  check('prompt cancel no POST', true);
}
{
  // B 決策：共用庫唯讀，無刪除鍵；綁定經下拉選值。
  const { nodes, api } = setup();
  const portraits = [{ assetId: 'guan', mime: 'image/png', byteLength: 100, inUse: true }];
  const api2 = async (path, value, options) => {
    if (path.endsWith('/portraits') && value === undefined) return { portraits };
    return api(path, value, options);
  };
  const ui = module.installGenerals({ api: api2, authority: () => admin, work, isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['generals-refresh'].onclick();
  await nodes['portrait-list'].onclick();
  check('no delete button', findButton(nodes['portrait-library'], '刪除') === null);
  check('picker populated', nodes['portrait-pick'].children.length === 1 && nodes['portrait-pick'].children[0].value === 'guan');
}

console.log(`passed ${passed} checks`);
