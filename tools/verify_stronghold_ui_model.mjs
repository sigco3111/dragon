// N3-3 stronghold UI model: fake DOM/storage/API ports for
// server/public/stronghold.txt (NOT a browser certificate).
// Usage: node tools/verify_stronghold_ui_model.mjs
import { readFileSync } from 'node:fs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};

class Element {
  children = []; textContent = ''; hidden = false; disabled = false;
  onclick = null; onchange = null; type = ''; value = '';
  dataset = {}; min = ''; max = '';
  append(...v) { this.children.push(...v); }
  replaceChildren(...v) { this.children = [...v]; }
}
const GAME = '77777777-7777-4777-8777-777777777777';
const CH = 'chapter-1';
const cityRow = { idx: 3, name: '北平', faction: 14, troops: 118, prod: 20714, troopsCap: 169, maxProd: 21000 };
const apiGame = { gameId: GAME, metadata: { name: 'S3UI', introduction: '' }, draftRevision: '1' };
const apiDetail = {
  gameId: GAME, draftRevision: '1', metadata: apiGame.metadata,
  chapters: [{ chapterId: CH, name: '第一章', cities: [{ ...cityRow }] }],
  strongholds: [{ cityId: 'city-003', runtimeSlot: 3, x: 1, y: 2, placed: true, roads: ['road-0'], chapters: [CH] }],
};
function setup({ games = [apiGame], detail = apiDetail, save = null, failSave = null } = {}) {
  const nodes = {};
  const ids = ['stronghold-editor', 'stronghold-games', 'stronghold-inspect', 'stronghold-refresh', 'stronghold-chapters', 'stronghold-cities', 'stronghold-message'];
  for (const id of ids) nodes[id] = new Element();
  const calls = [];
  globalThis.document = {
    querySelector: q => nodes[q.slice(1)] ?? null,
    querySelectorAll: q => {
      if (q === '#stronghold-cities input') {
        const out = [];
        const walk = el => { for (const c of el.children) { if (c.type === 'number') out.push(c); walk(c); } };
        walk(nodes['stronghold-cities']);
        return out;
      }
      return [];
    },
    createElement: () => new Element(),
  };
  globalThis.crypto ??= { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' };
  const api = async (path, value, options) => {
    calls.push({ path, value, options });
    if (path === '/api/games') return { games };
    if (path.startsWith('/api/games/') && path.includes('/draft?revision=')) return structuredClone(detail);
    if (path.endsWith('/draft/save')) {
      if (failSave) { const e = new Error(failSave.message); e.status = failSave.status; throw e; }
      if (save) return save(value, options);
      return { draftRevision: '2' };
    }
    throw new Error('unexpected path ' + path);
  };
  return { nodes, calls, api };
}
const source = readFileSync('server/public/stronghold.txt', 'utf8');
const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const admin = { user: { id: 'u', role: 'admin', mustChangePassword: false } };
const author = () => ({ user: { id: 'u', role: 'author', mustChangePassword: false } });

{
  const { nodes, api } = setup();
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(null);
  check('hidden pre-login', nodes['stronghold-editor'].hidden === true);
  ui.setIdentity(admin);
  check('shown post-login', nodes['stronghold-editor'].hidden === false);
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['stronghold-refresh'].onclick();
  check('games listed', nodes['stronghold-games'].children.length === 1);
  check('chapter selected', nodes['stronghold-chapters'].children.length === 1 && nodes['stronghold-chapters'].value === CH);
  check('city row + inputs', nodes['stronghold-cities'].children.length === 1);
  const rowText = nodes['stronghold-cities'].children[0].children[0].textContent;
  check('refs shown', rowText.includes('道路 1') && rowText.includes('章節 1') && rowText.includes('北平'));
  check('no auto save POST', calls.filter(c => c.path.endsWith('/draft/save')).length === 0);
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['stronghold-refresh'].onclick();
  const saveBtn = nodes['stronghold-cities'].children[0].children.find(c => c.type === 'button' && c.textContent === '保存據點數值');
  const inputs = [];
  const walk = el => { for (const c of el.children) { if (c.type === 'number') inputs.push(c); walk(c); } };
  walk(nodes['stronghold-cities']);
  inputs.find(i => i.dataset.field === 'troops').value = '100';
  inputs.find(i => i.dataset.field === 'prod').value = '20000';
  await saveBtn.onclick();
  const post = calls.find(c => c.path.endsWith('/draft/save'));
  check('save POST shape', !!post && post.value.chapterEdits.length === 1 && post.value.chapterEdits[0].op === 'city' &&
    post.value.chapterEdits[0].chapterId === CH && post.value.chapterEdits[0].cityIdx === 3 &&
    post.value.chapterEdits[0].values.troops === 100 && post.value.chapterEdits[0].values.prod === 20000 &&
    Array.isArray(post.value.resourceEdits) && post.options.revision === '1' && typeof post.options.key === 'string');
  check('success message', nodes['stronghold-message'].textContent.includes('修訂 2'));
  check('re-inspected', calls.filter(c => c.path.includes('/draft?revision=2')).length === 1);
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['stronghold-refresh'].onclick();
  const walk = el => { const out = []; const go = n => { for (const c of n.children) { if (c.type === 'number') out.push(c); go(c); } }; go(el); return out; };
  const inputs = walk(nodes['stronghold-cities']);
  inputs.find(i => i.dataset.field === 'troops').value = '99999';
  const saveBtn = nodes['stronghold-cities'].children[0].children.find(c => c.type === 'button' && c.textContent === '保存據點數值');
  await saveBtn.onclick().catch(() => {});
  check('over-cap blocked pre-POST', calls.filter(c => c.path.endsWith('/draft/save')).length === 0 &&
    nodes['stronghold-message'].textContent.includes('上限'));
  inputs.find(i => i.dataset.field === 'troops').value = '100';
  inputs.find(i => i.dataset.field === 'prod').value = 'abc';
  await saveBtn.onclick().catch(() => {});
  check('non-int blocked pre-POST', calls.filter(c => c.path.endsWith('/draft/save')).length === 0);
}
{
  const { nodes, api } = setup({ failSave: { message: '修訂已變，請重讀。', status: 412 } });
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['stronghold-refresh'].onclick();
  const walk = el => { const out = []; const go = n => { for (const c of n.children) { if (c.type === 'number') out.push(c); go(c); } }; go(el); return out; };
  const inputs = walk(nodes['stronghold-cities']);
  inputs.find(i => i.dataset.field === 'troops').value = '100';
  const saveBtn = nodes['stronghold-cities'].children[0].children.find(c => c.type === 'button' && c.textContent === '保存據點數值');
  await saveBtn.onclick().catch(() => {});
  check('conflict message', nodes['stronghold-message'].textContent.includes('修訂已變'));
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installStronghold({ api, authority: () => admin, work: fn => fn(), isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['stronghold-refresh'].onclick();
  const delBtn = nodes['stronghold-cities'].children[0].children.find(c => c.type === 'button' && c.textContent === '刪除檢查');
  await delBtn.onclick();
  check('delete-check lists blockers', nodes['stronghold-message'].textContent.includes('道路引用') && nodes['stronghold-message'].textContent.includes('192 座'));
  check('delete-check no POST', calls.filter(c => c.path.endsWith('/draft/save')).length === 0);
}
{
  const { nodes, api } = setup();
  const ui = module.installStronghold({ api, authority: () => author(), work: fn => fn(), isBusy: () => false });
  ui.setIdentity(author());
  await nodes['stronghold-refresh'].onclick();
  check('author sees own list', nodes['stronghold-games'].children.length === 1);
}

console.log(`passed ${passed} checks`);
