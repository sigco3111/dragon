// Owned fresh browser + actual common static gateway/CSP. API responses are
// explicit fixtures; this is UI integration, not a server authorization proof.
import assert from 'node:assert/strict';
import { register, createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
register('../vps/text-loader.mjs', import.meta.url);
const { createEditorGateway } = await import('../server/editorapp.js');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
await mkdir('.dragon-analysis/editor-workbench', { recursive: true });
const output = await mkdtemp('.dragon-analysis/editor-workbench/run-');
const gateway = createEditorGateway();
let origin;
const unexpected = [], errors = [], failed = [];
const server = createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    const reply = await gateway.fetch(new Request(origin + req.url), { EDITOR_METADATA: { idFromName() { throw new Error('Unexpected API request'); } } });
    res.writeHead(reply.status, Object.fromEntries(reply.headers)); res.end(Buffer.from(await reply.arrayBuffer()));
  } catch (error) { unexpected.push(String(error)); res.writeHead(500); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const gameId = '11111111-1111-4111-8111-111111111111', otherGameId = '22222222-2222-4222-8222-222222222222';
const stagePurposes = ['data', 'images', 'fallback-spring', 'fallback-summer', 'fallback-autumn', 'fallback-winter'];
const stageOperations = Object.fromEntries(stagePurposes.map((purpose, index) => [purpose, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
function stagePlan() {
  const flags = { runtimeAllowed: false, trialAllowed: false, releaseAllowed: false, deleteAllowed: false };
  const reference = { gameId, draftRevision: '1', sourceDigest: 'a'.repeat(64), dependencyDigest: 'b'.repeat(64), rootKey: 'fixture-private-root' };
  return { admission: 'stage-plan-collection-not-runtime', ...flags, plan: {
    schema: 'dragon-stage-asset-plan-1', admission: 'structural-stage-plan-not-runtime', ...flags, reference,
    artifacts: Array.from({ length: 44 }, (_, index) => ({ purpose: 'data', operationId: stageOperations.data, assetId: `asset-${index}`, byteLength: 1, sha256: 'c'.repeat(64) })),
    reports: stagePurposes.map(purpose => ({ purpose, binding: { ...reference, operationId: stageOperations[purpose] } })),
    roles: { shared: Array(398).fill(null), chapters: Array(20).fill(null) },
    unresolvedReferences: Array.from({ length: 20 }, () => ({ note: '<img src=x onerror=alert(1)>' })),
    missing: ['complete-runtime-dependencies', 'runtime-manifest-and-loader-binding', 'a', 'b', 'c', 'd'],
  } };
}
let draftRevision = 1;
const chapterRow = (chapterId, name) => ({ chapterId, name, gaps: { saveGaps: 0, activeGaps: 2 }, factions: [{ slot: 0, money: 100, reserve_cav: 2, reserve_arc: 3, reserve_inf: 4 }] });
const draftChapters = [chapterRow('chapter#first', '<img src=x>'), chapterRow('chapter#second', '第二章')];
const user = (role, forced = false) => ({ id: role, account: role === 'admin' ? 'tianyi' : 'author', role, disabled: false, version: 1, mustChangePassword: forced, displayName: '', email: '', phone: '', note: '' });
let session = null, role = 'admin', forced = true, checks = 0, gamesBarrier = null;
const calls = [];
const accountRows = [{ ...user('admin') }, { ...user('author'), id: 'author-one', account: 'Alpha', version: 7, note: '<img src=x onerror=alert(1)>' }, { ...user('author'), id: 'author-two', account: 'Zulu', version: 9, disabled: true }];
let accountConflict = false;
let browser;
try {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(systemroot|windir|path|pathext|temp|tmp|comspec|appdata|localappdata)$/i.test(key)));
  browser = await chromium.launch({ headless: true, env });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.addInitScript(() => { indexedDB.open = () => { throw new Error('Formal storage forbidden'); }; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname; calls.push([request.method(), path, request.method() === 'POST' ? request.postDataJSON() : null]);
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/session') return session ? reply(session) : reply({ error: 'LOGIN_REQUIRED' }, 401);
    if (path === '/api/auth/login') { session = { user: user(role, forced), csrf: 'fixture-csrf' }; return reply(session); }
    if (!session) return reply({ error: 'SESSION_INVALID' }, 401);
    if (request.method() === 'POST') { assert.equal(request.headers()['x-csrf-token'], 'fixture-csrf'); assert.ok(request.headers()['idempotency-key']); }
    if (path === '/api/auth/password') { session.user.mustChangePassword = false; return reply(session); }
    if (path === '/api/auth/profile') { Object.assign(session.user, request.postDataJSON()); return reply({ user: session.user }); }
    if (path === '/api/auth/logout') { session = null; return reply({ ok: true }); }
    if (path === '/api/admin/accounts') {
      assert.equal(session.user.role, 'admin'); assert.equal(session.user.mustChangePassword, false);
      if (request.method() === 'POST') { const { account } = request.postDataJSON(); accountRows.push({ ...user('author', true), id: account, account }); return reply({ ok: true }); }
      return reply({ accounts: accountRows });
    }
    const accountAction = /^\/api\/admin\/accounts\/([^/]+)\/(disable|reset)$/.exec(path);
    if (accountAction) {
      assert.equal(session.user.role, 'admin'); const target = accountRows.find(row => row.id === accountAction[1]); assert.ok(target); const value = request.postDataJSON();
      assert.equal(value.expectedVersion, target.version);
      if (accountConflict) { accountConflict = false; target.version++; return reply({ error: 'ACCOUNT_CONFLICT' }, 409); }
      if (accountAction[2] === 'disable') target.disabled = value.disabled; else target.mustChangePassword = true;
      target.version++; return reply({ ok: true });
    }
    if (path === `/api/games/${gameId}/stage-assets`) {
      assert.equal(request.method(), 'GET'); assert.equal(session.user.role, 'admin');
      assert.equal(url.searchParams.get('revision'), '1');
      for (const purpose of stagePurposes) assert.equal(url.searchParams.get(purpose), stageOperations[purpose]);
      return reply(stagePlan());
    }
    if (path === '/api/games') { if (gamesBarrier) await gamesBarrier; return reply({ games: [{ gameId, draftRevision: String(draftRevision), metadata: { name: '測試遊戲', introduction: '' } }, { gameId: otherGameId, draftRevision: '1', metadata: { name: '另一遊戲', introduction: '' } }] }); }
    if (path === `/api/games/${gameId}/draft`) { assert.equal(url.searchParams.get('revision'), String(draftRevision)); return reply({ gameId, draftRevision: String(draftRevision), profileRevision: 'fixed-copy-resources-1', metadata: { name: '測試遊戲', introduction: '' }, chapters: draftChapters }); }
    if (path === `/api/games/${gameId}/draft/save`) {
      const body = request.postDataJSON();
      if (!body.chapterEdits) return reply({ error: 'DRAFT_REVISION_CONFLICT' }, 409);
      assert.equal(request.headers()['if-match'], '"' + draftRevision + '"');
      assert.equal(body.chapterEdits.length, 1); const edit = body.chapterEdits[0];
      const index = draftChapters.findIndex(chapter => chapter.chapterId === edit.chapterId);
      if (edit.op === 'copy') { assert.ok(index >= 0); draftChapters.push(chapterRow('chapter#copy', draftChapters[index].name)); }
      else if (edit.op === 'rename') { assert.ok(index >= 0); draftChapters[index].name = edit.name; }
      else if (edit.op === 'delete') { assert.ok(index >= 0); draftChapters.splice(index, 1); }
      else { assert.equal(edit.op, 'add-blank'); draftChapters.push(chapterRow('chapter#blank', '空白章')); }
      draftRevision++; return reply({ gameId, draftRevision: String(draftRevision), metadata: body.metadata });
    }
    unexpected.push(request.method() + ' ' + path); return reply({ error: 'UNEXPECTED' }, 500);
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/\b(401|409)\b/.test(message.text())) errors.push(message.text()); });
  page.on('requestfailed', request => failed.push(request.url()));
  const response = await page.goto(origin);
  assert.equal(response.headers()['content-security-policy'].includes('unsafe'), false);
  await page.locator('#login').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#session').isVisible(), false);
  assert.equal(await page.locator('#menu').isVisible(), false);
  assert.equal(await page.locator('#main').count(), 0); checks++;
  await page.screenshot({ path: join(output, 'login.png') });
  async function login() {
    await page.locator('#login [name=account]').fill(role === 'admin' ? 'tianyi' : 'author');
    await page.locator('#login [name=password]').fill('FixturePass1!');
    await page.locator('#login button').click();
    await page.locator('#session').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#logout').disabled);
  }
  const nav = id => page.locator(`#menu button[data-view="${id}"]`);
  const idle = () => page.waitForFunction(() => !document.querySelector('#logout').disabled);
  await login();
  assert.equal(await page.locator('#password').isVisible(), true);
  assert.equal(await page.locator('#profile').isVisible(), false);
  assert.equal(await page.locator('#menu').isVisible(), false);
  assert.equal(await page.locator('#main').count(), 0);
  assert.equal(calls.some(([, path]) => path.startsWith('/api/admin/')), false); checks++;
  await page.screenshot({ path: join(output, 'forced-password.png') });
  await page.locator('[name=oldPassword]').fill('FixturePass1!');
  await page.locator('[name=newPassword]').fill('ChangedPass1!');
  await page.locator('[name=confirmPassword]').fill('ChangedPass1!');
  await page.locator('#password button').click();
  await page.locator('#menu').waitFor({ state: 'visible' }); await idle();
  assert.equal(await page.locator('#password').isVisible(), false);
  assert.equal(await page.locator('#login [name=password]').inputValue(), '');
  assert.equal(await page.locator('#draft-editor:visible').count(), 1); checks++;
  const beforeNavigation = calls.length;
  for (const id of ['admin', 'management-editor', 'catalog-editor', 'mapview-editor', 'stronghold-editor', 'generals-editor', 'copy', 'library-editor', 'stage-editor', 'stage-assets-editor', 'publish-editor', 'deletion-editor', 'draft-editor']) {
    await nav(id).click(); await page.locator(`#${id}`).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#session > section:visible').count(), 1);
    assert.equal(await page.locator('#profile').isVisible(), false);
    assert.equal(await page.locator('#password').isVisible(), false); checks++;
  }
  assert.equal(calls.length, beforeNavigation, 'all thirteen module navigations perform no API request'); checks++;
  await nav('stage-assets-editor').click();
  assert.equal(await page.locator('#stage-assets-load').isDisabled(), true);
  assert.equal(await page.locator('#stage-assets-clear').isDisabled(), true);
  assert.equal(calls.some(([, path]) => path.includes('/stage-assets')), false); checks++;
  await page.screenshot({ path: join(output, 'stage-assets-empty.png'), fullPage: true });
  // Seed only explicit operation associations in this isolated profile. No job is executed.
  await page.evaluate(({ gameId, operations }) => {
    sessionStorage.setItem('editor-stage-jobs:admin', JSON.stringify(Object.fromEntries(Object.entries(operations).map(([purpose, id]) => [purpose, { gameId, draftRevision: '1', purpose, enqueueKey: 'fixture-original-key-123', id, command: null }]))));
  }, { gameId, operations: stageOperations });
  await page.reload(); await page.locator('#stage-assets-editor').waitFor({ state: 'visible' }); await idle();
  assert.equal(calls.some(([, path]) => path.includes('/stage-assets')), false);
  await page.locator('#stage-assets-load').click(); await idle();
  assert.equal(await page.locator('#stage-assets-outputs p').count(), 44);
  assert.equal(await page.locator('#stage-assets-missing p').count(), 26);
  assert.equal(await page.locator('#stage-assets-editor img').count(), 0);
  assert.match(await page.locator('#stage-assets-missing').textContent(), /<img src=x/);
  assert.equal((await page.locator('#stage-assets-editor').textContent()).includes('fixture-private-root'), false); checks++;
  await page.screenshot({ path: join(output, 'stage-assets-loaded.png'), fullPage: true });
  const stageCalls = calls.length; await page.locator('#stage-assets-clear').click();
  assert.equal(await page.locator('#stage-assets-outputs p').count(), 0);
  assert.equal(calls.length, stageCalls); checks++;
  await nav('draft-editor').click();
  await page.screenshot({ path: join(output, 'workspace.png'), fullPage: true });
  await nav('admin').click();
  const rows = page.locator('#accounts tbody tr[data-account-id]');
  const alpha = page.locator('[data-account-id="author-one"]');
  const zulu = page.locator('[data-account-id="author-two"]');
  assert.equal(await rows.count(), 3); assert.equal(await page.locator('#accounts img').count(), 0);
  assert.match(await alpha.textContent(), /<img src=x/); assert.equal(await page.locator('[data-account-id=admin] button').count(), 0); checks++;
  await page.locator('#account-search').fill('Zulu'); assert.equal(await rows.count(), 1);
  page.once('dialog', dialog => dialog.accept()); await zulu.getByRole('button', { name: '恢復', exact: true }).click(); await idle();
  assert.deepEqual(calls.find(([, path]) => path === '/api/admin/accounts/author-two/disable')[2], { expectedVersion: 9, disabled: false }); checks++;
  await page.locator('#account-search').fill(''); await page.locator('#account-filter').selectOption('disabled'); assert.equal(await rows.count(), 0);
  assert.match(await page.locator('#accounts').textContent(), /沒有符合條件/); await page.locator('#account-filter').selectOption('all'); checks++;
  accountConflict = true; page.once('dialog', dialog => dialog.accept()); await alpha.getByRole('button', { name: '停用', exact: true }).click(); await idle();
  assert.match(await page.locator('#accounts-message').textContent(), /不自動重試/); assert.equal(await alpha.getByRole('button', { name: '停用', exact: true }).isDisabled(), true);
  assert.equal(calls.filter(([, path]) => path === '/api/admin/accounts/author-one/disable').length, 1);
  await page.locator('#refresh').click(); await idle(); assert.equal(await alpha.getByRole('button', { name: '停用', exact: true }).isEnabled(), true); checks++;
  page.once('dialog', dialog => dialog.dismiss()); await alpha.getByRole('button', { name: '重設密碼' }).click(); await idle();
  assert.equal(calls.filter(([, path]) => path === '/api/admin/accounts/author-one/reset').length, 0); checks++;
  await page.locator('#new-account').fill('FreshAuthor'); page.once('dialog', dialog => dialog.dismiss()); await nav('draft-editor').click();
  assert.equal(await page.locator('#admin').isVisible(), true); assert.equal(await page.locator('#new-account').inputValue(), 'FreshAuthor'); checks++;
  await page.locator('#create button').click(); await idle(); assert.equal(await page.locator('#new-account').inputValue(), ''); assert.equal(await rows.count(), 4); checks++;
  await page.screenshot({ path: join(output, 'accounts.png'), fullPage: true });
  await page.locator('.user-menu summary').click();
  await page.locator('.user-menu-items').getByRole('button', { name: '個人資料' }).click();
  await page.locator('#profile').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#main').count(), 0);
  await page.locator('[name=displayName]').fill('測試作者');
  page.once('dialog', dialog => dialog.dismiss()); await nav('draft-editor').click();
  assert.equal(await page.locator('#profile').isVisible(), true); checks++;
  await page.screenshot({ path: join(output, 'profile.png') });
  await page.locator('#profile button').click(); await idle();
  assert.equal(await page.locator('#profile-status').textContent(), '已保存。');
  await nav('draft-editor').click(); await page.goBack();
  await page.locator('#profile').waitFor({ state: 'visible' }); checks++;
  await page.locator('.user-menu summary').click();
  await page.locator('.user-menu-items').getByRole('button', { name: '變更密碼' }).click();
  await page.locator('#password').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#profile').isVisible(), false);
  assert.equal(await page.locator('#main').count(), 0); checks++;
  await nav('draft-editor').click();
  let releaseGames;
  gamesBarrier = new Promise(resolve => { releaseGames = resolve; });
  await page.locator('#draft-games-refresh').click();
  await page.waitForFunction(() => document.querySelector('#menu button').disabled);
  assert.equal(await nav('mapview-editor').isDisabled(), true);
  releaseGames(); gamesBarrier = null; await idle(); checks++;
  await page.locator('#draft-load').click(); await idle();
  const chapter = id => page.locator(`[data-chapter-id="${id}"]`);
  assert.equal(await page.locator('#draft-chapters img').count(), 0);
  assert.equal(await page.locator('#draft-resources details').count(), 2);
  assert.equal(await page.locator('#draft-resources input').count(), 0); checks++;
  const writesBeforeCancel = calls.filter(([method]) => method === 'POST').length;
  page.once('dialog', dialog => dialog.dismiss()); await chapter('chapter#first').getByRole('button', { name: '刪除本章' }).click(); await idle();
  page.once('dialog', dialog => dialog.dismiss()); await chapter('chapter#first').getByRole('button', { name: '改名', exact: true }).click(); await idle();
  assert.equal(calls.filter(([method]) => method === 'POST').length, writesBeforeCancel); checks++;
  await chapter('chapter#second').getByRole('button', { name: '複製本章' }).click(); await idle();
  assert.equal(await page.locator('[data-chapter-id]').count(), 3);
  assert.deepEqual(calls.filter(([, path, body]) => path.endsWith('/draft/save') && body?.chapterEdits).at(-1)[2].chapterEdits, [{ op: 'copy', chapterId: 'chapter#second' }]); checks++;
  page.once('dialog', dialog => dialog.accept('<新章>')); await chapter('chapter#copy').getByRole('button', { name: '改名', exact: true }).click(); await idle();
  assert.match(await chapter('chapter#copy').textContent(), /<新章>/); checks++;
  page.once('dialog', dialog => dialog.accept()); await chapter('chapter#first').getByRole('button', { name: '刪除本章' }).click(); await idle();
  assert.equal(await chapter('chapter#first').count(), 0); checks++;
  await page.locator('#draft-chapters').getByRole('button', { name: '新增空白章節' }).click(); await idle();
  assert.equal(await chapter('chapter#blank').count(), 1); assert.equal(await page.locator('#draft-trial-chapter').inputValue(), 'chapter#second'); checks++;
  await page.screenshot({ path: join(output, 'draft-loaded.png'), fullPage: true });
  await page.locator('#draft-name').fill('未保存');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#draft-game').selectOption(otherGameId);
  assert.equal(await page.locator('#draft-game').inputValue(), gameId); assert.equal(await page.locator('#draft-name').inputValue(), '未保存'); checks++;
  assert.equal(await page.locator('#draft-editor:visible').count(), 1);
  assert.match(await page.locator('#workspace-context').textContent(), /修訂 5.*有未保存修改/);
  page.once('dialog', dialog => dialog.dismiss()); await nav('mapview-editor').click();
  assert.equal(await page.locator('#draft-editor').isVisible(), true); checks++;
  await page.locator('#draft-save-button').click(); await idle();
  assert.equal(await page.locator('#draft-name').inputValue(), '未保存');
  assert.match(await page.locator('#draft-status').textContent(), /保存未確認/); checks++;
  await page.locator('.user-menu summary').click();
  page.once('dialog', dialog => dialog.accept()); await page.locator('.user-menu-items').getByRole('button', { name: '登出', exact: true }).click();
  await page.locator('#login').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[name=displayName]').inputValue(), ''); assert.equal(await rows.count(), 0); assert.equal(await page.locator('#account-search').inputValue(), ''); checks++;
  role = 'author'; forced = false; await login();
  assert.equal(await nav('admin').count(), 0); assert.equal(await nav('copy').count(), 0);
  assert.equal(await nav('management-editor').count(), 0); checks++;
  await page.goto(origin + '/#admin'); await page.locator('#draft-editor').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#admin').isVisible(), false); checks++;
  await page.locator('#draft-games-refresh').click(); await idle(); await page.locator('#draft-load').click(); await idle();
  await page.locator('#draft-name').fill('到期保留'); await page.locator('#draft-save-button').click(); await idle();
  session = null; await page.locator('#draft-operation-query').click(); await idle();
  await page.locator('#login').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#main').count(), 0);
  assert.equal(await page.locator('#draft-name').inputValue(), '');
  assert.equal(await page.locator('#draft-resources details').count(), 0); checks++;
  const expiredUnload = new Promise((resolve, reject) => page.once('dialog', async dialog => { try { assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss(); resolve(); } catch (error) { reject(error); } }));
  await page.evaluate(() => location.reload()); await expiredUnload;
  assert.equal(await page.locator('#login').isVisible(), true); checks++;
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); assert.deepEqual(failed, []); checks++;
  await writeFile(join(output, 'result.json'), JSON.stringify({ checks, errors, unexpected, failed, calls, scope: 'Actual gateway assets/CSP, fresh browser, fixture API only; not server authorization or production acceptance.' }, null, 2));
  process.stdout.write(JSON.stringify({ checks, output }) + '\n');
} catch (error) {
  await writeFile(join(output, 'failure.json'), JSON.stringify({ error: String(error), errors, unexpected, failed, calls }, null, 2));
  throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
