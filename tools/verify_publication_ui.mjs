// Real UI module; isolated DOM, transport and sessionStorage seams, no browser certificate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('server/public/publish.txt', 'utf8');
const { installPublish } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const G = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', A = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', R = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const time = '2026-10-15T00:00:00.000Z', key = 'editor-publication-operation:' + A;
const actor = { user: { id: A, role: 'author', version: 1, mustChangePassword: false } };
const pin = { gameId: G, name: '原名稱', revision: '3', sourceDigest: 'd'.repeat(64), chapters: [G + '#chapter-1'], publishedAt: time, ordinal: '1.0' };
const receipt = state => ({ version: 1, gameId: G, releaseId: R, pin: structuredClone(pin), distribution: { gameId: G, operationId: R, generation: 1, kind: 'publish', state, visibleAt: state === 'pending' ? null : time, recoveryRequired: false } });
const failure = (status, code) => Object.assign(new Error(code), { status, code });
class Element {
 constructor(id = '') { this.id = id; this.children = []; this.value = ''; this.textContent = ''; this.disabled = false; }
 append(...nodes) { this.children.push(...nodes); if (this.id === 'publish-game' && !this.value) this.value = nodes[0]?.value ?? ''; }
 replaceChildren(...nodes) { this.children = [...nodes]; if (this.id === 'publish-game') this.value = nodes[0]?.value ?? ''; }
}
function savedRecord(text) { try { return JSON.parse(text); } catch (cause) { throw new Error('invalid owned journal', { cause }); } }
let checks = 0;
function setup() {
 const nodes = Object.fromEntries([...readFileSync('server/public/index.html', 'utf8').matchAll(/id="(publish-[^"]+)"/g)].map(m => [m[1], new Element(m[1])]));
 const journal = new Map(), calls = [], confirmations = [];
 let identity = structuredClone(actor), post = async () => structuredClone(pin), status = async () => receipt('pending'), consent = true, storeFails = false;
 globalThis.document = { querySelector: selector => nodes[selector.slice(1)], createElement: () => new Element() };
 globalThis.sessionStorage = { getItem: k => journal.get(k) ?? null, setItem(k, v) { if (storeFails) throw new Error('owned quota'); journal.set(k, v); }, removeItem: k => journal.delete(k) };
 globalThis.confirm = text => { confirmations.push(text); return consent; };
 const api = async (path, value, options) => {
  calls.push({ path, value: value && structuredClone(value), options });
  if (path === '/api/games') return { games: [{ gameId: G, metadata: { name: '原名稱' }, listed: false, draftRevision: '3' }] };
  if (path === '/api/games/' + G + '/releases') return { releases: [] };
  if (path === '/api/announcements') return { announcements: [] };
  if (path === '/api/publish') return post();
  if (path.startsWith('/api/games/' + G + '/publish-operations/')) return status();
  throw new Error('unexpected path ' + path);
 };
 let ui;
 const mount = () => { ui = installPublish({ api, authority: () => identity, work: fn => fn(), isBusy: () => false }); ui.setIdentity(identity); return ui; };
 mount();
 return { nodes, journal, calls, confirmations, mount, get ui() { return ui; }, post(fn) { post = fn; }, status(fn) { status = fn; }, consent(v) { consent = v; }, storeFails(v) { storeFails = v; }, identity(v) { identity = v; ui.setIdentity(v); }, load: () => nodes['publish-games-refresh'].onclick(), submit: () => nodes['publish-form'].onsubmit({ preventDefault() {} }), query: () => nodes['publish-query'].onclick(), retry: () => nodes['publish-retry'].onclick(), forget: () => nodes['publish-forget'].onclick(), text: () => nodes['publish-result'].children.map(n => n.textContent).join(''), posts: () => calls.filter(c => c.path === '/api/publish') };
}
{
 const f = setup(); await f.load(); f.nodes['publish-name'].value = '原名稱';
 f.post(async () => { assert.ok(f.journal.has(key)); return structuredClone(pin); });
 await f.submit(); assert.equal(f.posts().length, 1); const saved = savedRecord(f.journal.get(key));
 assert.equal(saved.name, '原名稱'); assert.equal(saved.key, f.posts()[0].options.key); assert.equal(f.nodes['publish-button'].disabled, true);
 assert.match(f.text(), /本地已提交/); assert.match(f.text(), /分發待確認/); assert.equal(f.nodes['publish-retry'].disabled, true); checks++;
 await f.load(); assert.match(f.text(), /本地已提交/); assert.equal(savedRecord(f.journal.get(key)).key, saved.key); checks++;
 f.status(async () => receipt('confirmed')); await f.query(); assert.match(f.text(), /此次分發曾於/); assert.match(f.text(), /不是目前上架/); checks++;
 f.status(async () => ({ ...receipt('confirmed'), distribution: { ...receipt('confirmed').distribution, recoveryRequired: true } })); await f.query(); assert.match(f.text(), /恢復鎖/); checks++;
 const before = f.calls.length; f.mount(); assert.equal(f.calls.length, before); assert.equal(f.text(), ''); assert.equal(f.nodes['publish-retry'].disabled, true); await f.query(); assert.match(f.text(), /恢復鎖/); checks++;
 const prompts = f.confirmations.length; assert.equal(f.ui.canLeave(true), false); assert.equal(f.confirmations.length, prompts, 'beforeunload must not call confirm'); checks++;
 f.consent(false); assert.equal(f.ui.canLeave(), false); f.forget(); assert.ok(f.journal.has(key)); f.consent(true); f.forget(); assert.equal(f.journal.has(key), false); assert.equal(f.posts().length, 1); checks++;
}
{
 const f = setup(); await f.load(); f.post(async () => { throw failure(503, 'LOST_RESPONSE'); }); await assert.rejects(f.submit()); const first = f.posts()[0];
 assert.equal(f.nodes['publish-retry'].disabled, true); await assert.rejects(f.retry()); assert.equal(f.posts().length, 1); checks++;
 f.mount(); await f.load(); assert.equal(f.posts().length, 1); f.status(async () => { throw failure(404, 'PUBLISH_OPERATION_NOT_FOUND'); }); await assert.rejects(f.query());
 assert.equal(f.nodes['publish-retry'].disabled, false); f.nodes['publish-name'].value = '不可夾帶'; f.post(async () => structuredClone(pin)); f.status(async () => receipt('pending')); await f.retry();
 assert.deepEqual(f.posts()[1], first); assert.match(f.confirmations.at(-1), /當時的已保存草稿/); checks++;
 f.status(async () => { throw failure(404, 'PUBLISH_OPERATION_NOT_FOUND'); }); await assert.rejects(f.query()); assert.equal(f.nodes['publish-retry'].disabled, true, 'known commit is not erased by a missing observation'); checks++;
}
for (const [status, code] of [[404,'GAME_NOT_FOUND'],[503,'DISTRIBUTION_NOT_CONFIGURED'],[503,'DISTRIBUTION_STATUS_UNAVAILABLE'],[401,'SESSION_INVALID'],[409,'OPERATION_REVOKED'],[409,'GAME_DELETING']]) {
 const f = setup(); await f.load(); f.post(async () => { throw failure(503, 'LOST'); }); await assert.rejects(f.submit()); f.status(async () => { throw failure(status, code); }); await assert.rejects(f.query()); assert.equal(f.nodes['publish-retry'].disabled, true); assert.ok(f.journal.has(key)); assert.equal(f.posts().length, 1); checks++;
}
for (const mutate of [r=>{r.gameId=R;},r=>{r.releaseId=G;},r=>{r.distribution.kind='listing';},r=>{r.distribution.operationId=G;},r=>{r.distribution.generation=0;},r=>{r.distribution.state='done';},r=>{r.distribution.visibleAt=time;},r=>{r.distribution.recoveryRequired=0;},r=>{r.distribution.extra=true;},r=>{r.pin.gameId=R;},r=>{r.pin.sourceDigest='x';},r=>{r.pin.ordinal='1.01';},r=>{r.pin.chapters=[];},r=>{r.extra=true;}]) {
 const f = setup(); await f.load(); await f.submit(); const r = receipt('pending'); mutate(r); f.status(async () => r); await assert.rejects(f.query()); assert.doesNotMatch(f.text(), /此次分發曾於/); assert.ok(f.journal.has(key)); assert.equal(f.posts().length, 1); checks++;
}
{
 const f = setup(); await f.load(); f.storeFails(true); await assert.rejects(f.submit(), /無法保留/); assert.equal(f.posts().length, 0); assert.equal(f.nodes['publish-button'].disabled, true); checks++;
}
for (const bad of ['{', JSON.stringify({ actorId: A }), 'x'.repeat(4097)]) {
 const f = setup(); f.journal.set(key, bad); f.mount(); await f.load(); assert.equal(f.nodes['publish-button'].disabled, true); await assert.rejects(f.submit()); assert.equal(f.posts().length, 0); checks++;
}
{
 const f = setup(); await f.load(); await f.submit(); f.identity({ user: { ...actor.user, version: 2 } }); f.status(async () => { throw failure(404,'PUBLISH_OPERATION_NOT_FOUND'); }); await assert.rejects(f.query()); assert.equal(f.nodes['publish-retry'].disabled, true); await assert.rejects(f.retry()); checks++;
 f.identity({ user: { ...actor.user, id: R } }); assert.equal(f.nodes['publish-name'].value, '', 'actor switch clears the prior author input'); assert.equal(f.text(), ''); assert.equal(f.nodes['publish-operation'].textContent.includes(savedRecord(f.journal.get(key)).key), false); assert.ok(f.journal.has(key)); checks++;
}
{
 const f = setup(); await f.load(); let release; f.post(() => new Promise(resolve => { release = resolve; })); const inFlight = f.submit();
 f.identity(null); release(structuredClone(pin)); await inFlight; assert.equal(f.text(), ''); assert.ok(f.journal.has(key)); assert.equal(f.calls.filter(c=>c.path.includes('/publish-operations/')).length, 0); checks++;
}
{
 const f = setup(); await f.load(); await f.submit(); let release; f.status(() => new Promise(resolve => { release = resolve; })); const old = f.query();
 f.status(async () => receipt('confirmed')); await f.query(); release(receipt('pending')); await old; assert.match(f.text(), /此次分發曾於/); checks++;
}
{
 const f = setup(); await f.load(); f.consent(false); await f.submit(); assert.equal(f.posts().length, 0); assert.equal(f.journal.size, 0); checks++;
}
process.stdout.write(JSON.stringify({ checks, scope: 'real publish UI with owned DOM/session/transport seams; no browser or authority proof' }) + '\n');
