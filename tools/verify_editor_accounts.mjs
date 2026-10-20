// In-memory UI adapter tests: no network, database, user files or game state.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountController } from '../editor-ui/src/accounts.js';
const row = (id = 'author') => ({ id, account: id, role: id === 'admin' ? 'admin' : 'author', version: 1, disabled: false, mustChangePassword: false, displayName: '', email: '', phone: '', note: '' });
function fixture() {
  const f = { actor: { user: row('admin') }, data: [row('admin'), row()], calls: [], model: null, error: null, confirm: true, busy: false };
  f.api = async (path, value) => { f.calls.push({ path, value }); if (f.fail) throw new Error(f.fail); return { accounts: f.data }; };
  f.controller = createAccountController({ api: (...args) => f.api(...args), authority: () => f.actor, publish: model => { f.model = model; }, confirm: () => f.confirm,
    work: async action => { if (f.busy) return; f.busy = true; try { return await action(); } catch (error) { f.error = error; } finally { f.busy = false; } },
  });
  f.controller.setIdentity(f.actor); return f;
}
test('allowlisted display DTOs only; no caller object aliases or credentials', async () => {
  const f = fixture(); f.data[1].csrf = 'not-for-ui'; await f.controller.load();
  assert.equal(f.model.rows[1].csrf, undefined); assert.notEqual(f.model.rows[1], f.data[1]); assert.ok(Object.isFrozen(f.model.rows[1])); assert.equal(f.model.loaded, true);
});
test('author/forced/anonymous cannot load, create or mutate', async () => {
  for (const actor of [null, { user: row() }, { user: { ...row('admin'), mustChangePassword: true } }]) {
    const f = fixture(); f.actor = actor; f.controller.setIdentity(actor);
    await assert.rejects(f.controller.load()); await f.controller.create('someone'); await f.controller.mutate('author', 'reset'); assert.equal(f.calls.length, 0);
  }
});
test('stable row identity/version, cancel, admin exclusion and explicit mutation bodies', async () => {
  const f = fixture(); await f.controller.load(); f.confirm = false; await f.controller.mutate('author', 'disable'); assert.equal(f.calls.length, 1);
  f.confirm = true; await f.controller.mutate('admin', 'disable'); await f.controller.mutate('author', 'delete'); assert.equal(f.calls.length, 1);
  await f.controller.mutate('author', 'disable'); assert.deepEqual(f.calls[1], { path: '/api/admin/accounts/author/disable', value: { expectedVersion: 1, disabled: true } });
  f.data[1] = { ...row(), version: 2, disabled: true }; await f.controller.load(); await f.controller.mutate('author', 'disable');
  assert.deepEqual(f.calls.at(-2).value, { expectedVersion: 2, disabled: false });
  await f.controller.mutate('author', 'reset'); assert.deepEqual(f.calls.at(-2).value, { expectedVersion: 2 });
});
test('conflict keeps display rows, locks mutations until manual refresh, never auto retries', async () => {
  const f = fixture(); await f.controller.load(); const before = f.model.rows;
  f.fail = '409 version conflict'; await f.controller.mutate('author', 'disable');
  assert.equal(f.model.rows, before); assert.equal(f.model.stale, true); assert.match(f.model.message, /不自動重試/); const count = f.calls.length;
  await f.controller.mutate('author', 'reset'); await f.controller.create('another'); assert.equal(f.calls.length, count);
  f.fail = null; await f.controller.refresh(); assert.equal(f.model.stale, false);
});
test('invalid/duplicate/partial DTO does not replace the previous table', async () => {
  const f = fixture(); await f.controller.load(); const before = f.model.rows;
  for (const data of [[row(), row()], [{ ...row(), version: '2' }], [{ ...row(), note: null }]]) {
    f.data = data; await f.controller.refresh(); assert.equal(f.model.rows, before); assert.equal(f.model.stale, true);
  }
});
test('create acknowledgment is retained if follow-up read fails; unknown write is not retried', async () => {
  const f = fixture(); await f.controller.load();
  f.api = async (path, value) => { f.calls.push({ path, value }); if (!value) throw new Error('read offline'); return { ok: true }; };
  assert.equal(await f.controller.create('new-author'), true); assert.equal(f.model.stale, true); assert.match(f.model.message, /清單未更新/);
  assert.deepEqual(f.calls[1].value, { account: 'new-author' });
  const g = fixture(); g.fail = 'unknown write'; await g.controller.create('new-author'); await g.controller.create('new-author'); assert.equal(g.calls.length, 1); assert.match(g.model.message, /建立未確認/);
});
test('late read after logout or account switch cannot repopulate private rows', async () => {
  for (const next of [null, { user: { ...row('admin'), id: 'other-admin' } }]) {
    const f = fixture(); let release; f.api = () => new Promise(resolve => { release = resolve; }); const pending = f.controller.load();
    f.actor = next; f.controller.setIdentity(next); release({ accounts: [row('author')] }); assert.equal(await pending, false); assert.deepEqual(f.model.rows, []); assert.equal(f.model.loaded, false);
  }
});
test('latest read wins and duplicate UI writes are serialized by existing work port', async () => {
  const f = fixture(), resolves = []; f.api = () => new Promise(resolve => resolves.push(resolve));
  const a = f.controller.load(), b = f.controller.load(); resolves[1]({ accounts: [row('latest')] }); await b; resolves[0]({ accounts: [row('old')] }); await a;
  assert.equal(f.model.rows[0].id, 'latest');
  const pending = f.controller.create('new'); const count = resolves.length; await f.controller.create('duplicate'); assert.equal(resolves.length, count);
  f.actor = null; f.controller.setIdentity(null); resolves.at(-1)({ ok: true }); assert.equal(await pending, false); assert.deepEqual(f.model.rows, []);
});
