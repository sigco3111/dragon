// UI-controller checks only. Transport/backend authorization are tested separately.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
const { installDraftEditor } = await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../server/public/draft.txt', import.meta.url))).toString('base64'));
const gameId = '11111111-1111-4111-8111-111111111111', otherId = '22222222-2222-4222-8222-222222222222';
const game = (id = gameId) => ({ gameId: id, draftRevision: '1', metadata: { name: '<img>', introduction: '原稿' } });
const receipt = (revision = '1') => ({ ...game(), draftRevision: revision, profileRevision: 'fixed-copy-resources-1', chapters: [{ chapterId: 'chapter#1', name: '<章>', gaps: { saveGaps: 0, activeGaps: 2 }, factions: [{ slot: 0, money: 100, reserve_cav: 2, reserve_arc: 3, reserve_inf: 4 }] }] });
function harness({ stored, openTrial } = {}) {
  let identity = { user: { id: 'author', mustChangePassword: false }, csrf: 'never-project' }, busy = false, model, response = null;
  const calls = [], errors = [], records = stored ?? new Map();
  const h = { calls, errors, records, confirmValue: true, promptValue: null, response: handler => { response = handler; }, model: () => model };
  const controller = installDraftEditor({
    api: async (path, body, options) => { calls.push({ path, body, options }); if (response) return response(path, body, options); if (path === '/api/games') return { games: [game(), game(otherId)] }; return receipt(); },
    authority: () => identity, isBusy: () => busy, publish: value => { model = value; },
    work: async fn => { if (busy) return; busy = true; try { return await fn(); } catch (error) { errors.push(error); } finally { busy = false; controller.render(); } },
    storage: { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) },
    confirm: () => h.confirmValue, prompt: () => h.promptValue, openTrial,
  });
  controller.setIdentity(identity);
  Object.assign(h, { controller, actions: controller.actions, identity: next => { identity = next; controller.setIdentity(next); }, current: () => identity, busy: value => { busy = value; } });
  h.load = async () => { await h.actions.refresh(); await h.actions.load(); };
  return h;
}
test('explicit read projects display copies, dirty fields do not alter saved revision, refresh is not load', async () => {
  const h = harness(); await h.load(); const model = h.model();
  assert.equal(model.context.draftRevision, '1'); assert.equal(model.fields.chapterId, 'chapter#1');
  assert.equal(JSON.stringify(model).includes('never-project'), false);
  model.resources[0].factions[0].money = 999; model.chapters[0].gaps.saveGaps = 999; h.controller.render();
  assert.equal(h.model().resources[0].factions[0].money, 100); assert.equal(h.model().chapters[0].gaps.saveGaps, 0);
  h.actions.setField('name', '未保存'); assert.equal(h.model().context.dirty, true);
  h.response(() => ({ games: [{ ...game(), draftRevision: '99' }] })); await h.actions.refresh();
  assert.equal(h.model().context.draftRevision, '1'); assert.equal(h.model().fields.revision, '1'); assert.equal(h.model().fields.name, '未保存');
});
test('dirty switch cancel preserves all fields and context; identity change clears projection', async () => {
  const h = harness(); await h.load(); h.actions.setField('name', '未保存'); h.confirmValue = false; h.actions.chooseGame(otherId);
  assert.equal(h.model().fields.gameId, gameId); assert.equal(h.model().fields.name, '未保存'); assert.equal(h.controller.canLeave(true), false);
  h.confirmValue = true; h.actions.chooseGame(otherId); assert.equal(h.model().context, null); assert.equal(h.model().fields.gameId, otherId);
  h.identity(null); assert.deepEqual(h.model().games, []); assert.deepEqual(h.model().resources, []); assert.equal(h.model().fields.gameId, '');
  h.identity({ user: { id: 'other', mustChangePassword: false } }); assert.equal(h.model().fields.name, '');
});
test('lost save response keeps fields and original key; explicit query acknowledges only that revision', async () => {
  const h = harness(); await h.load(); h.actions.setField('name', '資料二'); h.actions.setField('introduction', 'e\u0301');
  h.response(() => { throw new Error('response lost'); }); await h.actions.save();
  const save = h.calls.at(-1); assert.equal(save.options.revision, '1'); assert.equal(save.body.metadata.introduction, 'é');
  assert.equal(h.model().fields.introduction, 'e\u0301'); assert.equal(h.model().editLocked, true); assert.equal(h.model().retryLocked, true);
  let association;
  try { association = JSON.parse([...h.records.values()][0]); } catch (cause) { throw new Error('Invalid stored UI association', { cause }); }
  assert.deepEqual(Object.keys(association).sort(), ['gameId', 'key', 'revision']);
  h.response(path => { assert.ok(path.endsWith('/' + save.options.key)); return { state: 'committed', result: { ...game(), draftRevision: '2', metadata: save.body.metadata } }; });
  await h.actions.query(); assert.equal(h.model().fields.introduction, 'é'); assert.equal(h.model().context.draftRevision, '2'); assert.equal(h.records.size, 0);
});
test('recorded failure retries exact key/body/revision, not refreshed latest', async () => {
  const h = harness(); await h.load(); h.actions.setField('name', '本頁'); h.response(() => { throw new Error('conflict'); }); await h.actions.save();
  const original = structuredClone(h.calls.at(-1));
  h.response(() => ({ state: 'failed', gameId, expectedRevision: '1', error: 'CONFLICT' })); await h.actions.query(); assert.equal(h.model().retryLocked, false);
  h.response(() => { throw new Error('same conflict'); }); await h.actions.retry(); assert.deepEqual(h.calls.at(-1), original); assert.equal(h.model().fields.name, '本頁');
});
test('restored association has no reconstructed body; receipt alone does not allow editing', async () => {
  const stored = new Map([['editor-draft-operation:author', JSON.stringify({ gameId, revision: '1', key: 'original_operation_key' })]]);
  const h = harness({ stored }); assert.equal(h.model().retryLocked, true); assert.equal(h.model().loadLocked, true); assert.equal(h.calls.length, 0);
  h.response(() => ({ state: 'committed', result: { ...game(), draftRevision: '2' } })); await h.actions.query();
  assert.equal(h.model().context.verified, false); assert.equal(h.model().editLocked, true); assert.equal(h.model().loadLocked, false);
});
test('404 after reload cannot retry; actual password-change acknowledgement unlocks explicit recovery', async () => {
  const h = harness({ stored: new Map([['editor-draft-operation:author', JSON.stringify({ gameId, revision: '1', key: 'original_operation_key' })]]) });
  h.response(() => { throw Object.assign(new Error('not found'), { status: 404 }); }); await h.actions.query();
  assert.equal(h.model().loadLocked, true); assert.equal(h.model().retryLocked, true);
  h.controller.passwordChanged(h.current()); assert.equal(h.model().loadLocked, false);
  await h.actions.query(); assert.match(h.model().message, /舊會話已由實際改密撤銷/); assert.equal(h.model().editLocked, true);
});
test('malformed draft does not partly replace previously loaded context or fields', async () => {
  const h = harness(); await h.load(); h.actions.setField('revision', '2');
  h.response(() => ({ ...receipt('2'), metadata: { name: '無效回應', introduction: '' }, chapters: [{ chapterId: 'x', gaps: {} }] })); await h.actions.load();
  assert.equal(h.model().context.draftRevision, '1'); assert.equal(h.model().fields.name, '<img>'); assert.equal(h.model().chapters.length, 1); assert.equal(h.errors.length, 1);
});
test('late read on identity change cannot publish old private data', async () => {
  const h = harness(); await h.actions.refresh(); let release;
  h.response(() => new Promise(resolve => { release = resolve; })); const pending = h.actions.load();
  h.identity({ user: { id: 'second', mustChangePassword: false } }); release(receipt()); await pending;
  assert.equal(h.model().context, null); assert.equal(h.model().fields.name, ''); assert.deepEqual(h.model().resources, []);
});
test('chapter cancel sends nothing; confirmed edits retain stable ID and exact saved revision', async () => {
  const h = harness(); await h.load(); const before = h.calls.length;
  h.confirmValue = false; await h.actions.chapter('delete', 'chapter#1'); h.promptValue = null; await h.actions.chapter('rename', 'chapter#1'); assert.equal(h.calls.length, before);
  h.confirmValue = true; h.response((path, body) => {
    if (body) return { ...game(), draftRevision: '2' };
    if (path === '/api/games') return { games: [game()] };
    return receipt('2');
  });
  await h.actions.chapter('copy', 'chapter#1');
  const save = h.calls.find(call => call.body?.chapterEdits); assert.deepEqual(save.body.chapterEdits, [{ op: 'copy', chapterId: 'chapter#1' }]); assert.equal(save.options.revision, '1'); assert.equal(h.model().context.draftRevision, '2');
});
test('Trial opens synchronously then uses selected chapter/saved revision; late response closes child', async () => {
  const child = { closed: false, opener: {}, close() { this.closed = true; }, location: { replace() { throw new Error('should not navigate'); } } };
  let opens = 0; const h = harness({ openTrial: () => { opens++; return child; } }); await h.load(); let release;
  h.response(() => new Promise(resolve => { release = resolve; })); const pending = h.actions.trial(); assert.equal(opens, 1); assert.equal(child.opener, null);
  assert.deepEqual(h.calls.at(-1).body, { expectedRevision: '1', chapterId: 'chapter#1' }); h.identity(null); release({}); await pending; assert.equal(child.closed, true);
});
test('copy-list jump works inside existing serial work, but direct busy selection stays locked', async () => {
  const h = harness(); await h.load(); h.busy(true);
  h.actions.chooseGame(otherId); assert.equal(h.model().fields.gameId, gameId);
  await h.controller.gotoGame(otherId); assert.equal(h.model().fields.gameId, otherId); assert.equal(h.model().context, null); h.busy(false);
});
test('successful Trial uses validated receipt and preserves dirty unsaved metadata', async () => {
  let target; const child = { closed: false, opener: {}, close() { this.closed = true; }, location: { replace(path) { target = path; } } };
  const h = harness({ openTrial: () => child }); await h.load(); h.actions.setField('name', '未保存');
  h.response(() => ({ state: 'active', trialId: otherId, gameId, draftRevision: '1', chapterId: 'chapter#1', ownerId: 'author', manifestDigest: 'a'.repeat(64) }));
  await h.actions.trial(); assert.equal(target, '/api/trial/web/?trial=' + otherId); assert.equal(h.model().fields.name, '未保存'); assert.equal(h.model().context.dirty, true); assert.equal(h.calls.some(call => call.path.endsWith('/draft/save')), false);
});
test('unauthenticated/forced UI actions and invalid metadata cannot issue writes', async () => {
  const h = harness(); await h.load(); h.actions.setField('name', '九個字ABCDEFGHI'); const before = h.calls.length; await h.actions.save(); assert.equal(h.calls.length, before);
  h.identity({ user: { id: 'author', mustChangePassword: true } }); await h.actions.refresh(); await h.actions.chapter('add-blank'); assert.equal(h.calls.length, before); assert.equal(h.model().allowed, false);
});
