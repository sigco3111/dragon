// A2 publish UX model: author release dialog, version list and announcement
// preview (NOT a browser certificate). Usage: node tools/verify_publish_ui_model.mjs
import { readFileSync } from 'node:fs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`ok ${name}`); return; }
  console.error(`FAIL ${name} ${extra}`); process.exitCode = 1;
};

class Element {
  children = []; textContent = ''; hidden = false; disabled = false;
  onclick = null; onsubmit = null; type = ''; value = '';
  append(...v) { this.children.push(...v); }
  replaceChildren(...v) { this.children = [...v]; }
}
const GAME = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const gameRow = { gameId: GAME, metadata: { name: '臥龍', introduction: '自建' }, listed: false, draftRevision: '3' };
const releaseRow = { gameId: GAME, releaseId: 'dddddddd-dddd-4ddd-addd-dddddddddddd', ordinal: '1.2', draftRevision: '3', sourceDigest: 'd'.repeat(64), createdAt: '2026-10-15T00:00:00.000Z' };
const pinRow = { gameId: GAME, name: '臥龍', revision: '3', sourceDigest: 'd'.repeat(64), chapters: ['ch1'], publishedAt: '2026-10-15T01:00:00.000Z', ordinal: '1.2' };
const annRow = { announcementId: 7, gameId: GAME, releaseId: releaseRow.releaseId, ordinal: '1.2', name: '臥龍', creatorAccount: 'author1', publishedAt: releaseRow.createdAt, firstOnlineAt: '2026-10-15T02:00:00.000Z' };
function setup({ games = [gameRow], releases = [releaseRow], publish = pinRow, publishError = null, announcements = [annRow], confirmValue = true } = {}) {
  const nodes = {};
  for (const id of ['publish-editor', 'publish-game', 'publish-name', 'publish-button', 'publish-games-refresh', 'publish-versions-refresh', 'publish-versions', 'publish-form', 'publish-result', 'publish-message', 'publish-ann-preview', 'publish-announcement']) {
    nodes[id] = new Element();
  }
  const calls = [];
  globalThis.document = { querySelector: q => nodes[q.slice(1)] ?? null, createElement: () => new Element() };
  globalThis.confirm = () => confirmValue;
  const api = async (path, value, _options) => {
    calls.push({ path, value });
    if (path === '/api/games') return { games };
    if (path === `/api/games/${GAME}/releases`) return { releases };
    if (path === '/api/publish') {
      if (publishError) { const e = new Error(publishError.message); e.status = publishError.status; e.code = publishError.code; throw e; }
      if (value?.gameId !== GAME) { const e = new Error('GAME_NOT_FOUND'); e.status = 404; e.code = 'GAME_NOT_FOUND'; throw e; }
      return publish;
    }
    if (path === '/api/announcements') return { revision: 5, announcements, nextCursor: null };
    throw new Error(`unexpected ${path}`);
  };
  return { nodes, calls, api };
}
const source = readFileSync('server/public/publish.txt', 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const author = { user: { id: 'a', role: 'author', version: 1, mustChangePassword: false } };
const admin = { user: { id: 'u', role: 'admin', version: 1, mustChangePassword: false } };
const stale = { user: { id: 'a', role: 'author', version: 1, mustChangePassword: true } };
const work = fn => fn();
{
  const { nodes, api } = setup();
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  check('author section visible', nodes['publish-editor'].hidden === false);
  check('game option rendered', nodes['publish-game'].children.length === 1 && nodes['publish-game'].children[0].value === GAME);
}
{
  const { nodes, api } = setup();
  const ui = module.installPublish({ api, authority: () => stale, work, isBusy: () => false });
  ui.setIdentity(stale);
  check('must-change hidden', nodes['publish-editor'].hidden === true);
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  await nodes['publish-versions-refresh'].onclick();
  check('versions fetched', calls.some(c => c.path === `/api/games/${GAME}/releases`));
  check('version row rendered', nodes['publish-versions'].children.some(n => n.textContent.includes('1.2') && n.textContent.includes('草稿修訂 3')));
}
{
  const { nodes, api, calls } = setup();
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  await nodes['publish-form'].onsubmit({ preventDefault() {} });
  check('publish POST sent', calls.some(c => c.path === '/api/publish' && c.value?.gameId === GAME));
  check('publish result rendered', nodes['publish-result'].children.some(n => n.textContent.includes('版本 1.2') && n.textContent.includes('發布≠上架')));
}
{
  const { nodes, api } = setup({ publishError: { message: 'stale', status: 409, code: 'PUBLISH_STALE' } });
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  let threw = false;
  try { await nodes['publish-form'].onsubmit({ preventDefault() {} }); } catch { threw = true; }
  check('stale message mapped', nodes['publish-message'].textContent.includes('草稿已變更'));
  check('stale propagates', threw === true);
}
{
  const { nodes, api, calls } = setup({ confirmValue: false });
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  await nodes['publish-form'].onsubmit({ preventDefault() {} });
  check('confirm cancel no POST', !calls.some(c => c.path === '/api/publish'));
}
{
  const { nodes, api } = setup();
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  await nodes['publish-ann-preview'].onclick();
  check('announcement preview hit', nodes['publish-announcement'].children.some(n => n.textContent.includes('公告：臥龍') && n.textContent.includes('作者 author1')));
}
{
  const { nodes, api } = setup({ announcements: [] });
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  await nodes['publish-ann-preview'].onclick();
  check('unlisted no announcement', nodes['publish-announcement'].children.some(n => n.textContent.includes('無公告')));
}
{
  const { nodes, api } = setup({ games: [{ ...gameRow, gameId: OTHER }] });
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  ui.setIdentity(author);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  check('other game listed', nodes['publish-game'].children.length === 1);
}
{
  const { nodes, api } = setup();
  const ui = module.installPublish({ api, authority: () => admin, work, isBusy: () => false });
  ui.setIdentity(admin);
  await nodes['publish-games-refresh'].onclick();
  nodes['publish-game'].value = GAME;
  check('admin section visible', nodes['publish-editor'].hidden === false);
}
{
  const { nodes, api } = setup();
  const ui = module.installPublish({ api, authority: () => author, work, isBusy: () => false });
  check('canLeave always true', ui.canLeave() === true);
  check('empty versions text', nodes['publish-versions'].children.length === 0);
}

console.log(`passed ${passed} checks`);
