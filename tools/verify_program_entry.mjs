// Current software entry only: real archive/registration and owned Static
// Assets/workerd when requested. Browser/gameplay binding is not certified here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import entry from '../reader/programentry.js';
import program from '../reader/programassets.js';
import { buildStaticRelease } from '../vps/static-release.mjs';
import { createStaticArchiver } from '../vps/static-archive.mjs';
import { registerStaticProgram } from '../vps/program-registration.mjs';
import { programRegistrationKey } from '../reader/programregistration.js';
assert.ok(process.argv.slice(2).every(arg => arg === '--workerd'));
const workerd = process.argv.includes('--workerd'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const shell = readFileSync('web/index.html'), game = '12345678-1234-4123-8123-123456789abc';
const query = '?formalGame=' + game + '&mode=new';
const memory = new Map(), allowed = new Set();
let bucket, mf, own, Miniflare, outbound = 0, checks = 0, puts = 0, assetCalls = 0, r2Calls = 0;
const count = () => checks++;
const raw = {
  async get(key) {
    assert.ok(allowed.has(key), 'owned exact archive key');
    if (bucket) { const row = await bucket.get(key); return row ? { bytes: Buffer.from(await row.arrayBuffer()), mime: row.httpMetadata.contentType } : null; }
    const row = memory.get(key); return row ? { bytes: Buffer.from(row.bytes), mime: row.mime } : null;
  },
  async seed(key, bytes, mime = 'application/json') {
    assert.ok(allowed.has(key));
    if (bucket) await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
    else memory.set(key, { bytes: Buffer.from(bytes), mime });
  },
  async remove(key) { assert.ok(allowed.has(key)); if (bucket) await bucket.delete(key); else memory.delete(key); },
};
const port = { async get(key) {
  r2Calls++; const row = await raw.get(key);
  return row ? { size: row.bytes.length, httpMetadata: { contentType: row.mime }, body: new Response(row.bytes).body } : null;
} };
function fixture(version, html = shell) {
  const files = new Map([['index.html', Buffer.from(html)], ['src/boot.js', Buffer.from('export const version = ' + version + ';')], ['late.txt', Buffer.from('late-' + version)]]);
  const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: sha(bytes) })));
  const base = 'artifacts/programs/' + built.sha256 + '/', key = programRegistrationKey(built.sha256);
  for (const path of files.keys()) allowed.add(base + 'files/' + path);
  allowed.add(key); allowed.add(base + 'static-release.json');
  return { ...built, files, base, key };
}
async function stage(f) {
  const r2 = {
    async get(key) { const row = await raw.get(key); return row ? { bytes: row.bytes, headers: { 'content-type': row.mime } } : null; },
    async putImmutable(key, bytes, mime) {
      puts++; assert.ok(allowed.has(key));
      if (bucket) return bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: mime } });
      if (!memory.has(key)) await raw.seed(key, bytes, mime);
    },
  };
  await createStaticArchiver({ r2, expectedDigest: f.sha256, sourceTreeDigest: f.manifest.sourceTreeDigest,
    readStatic: async path => path === 'static-release.json' ? f.bytes : f.files.get(path), maxTotalBytes: 2 * 1024 * 1024 }).stage(() => {});
  await registerStaticProgram({ r2, releaseDigest: f.sha256, sourceTreeDigest: f.manifest.sourceTreeDigest, assertCurrent() {} });
  f.files.clear();
}
function assets(f) { return { async fetch(request) {
  assetCalls++; assert.equal(request.url, 'https://entry.test/static-release.json'); assert.equal(request.method, 'GET'); assert.equal(request.redirect, 'manual');
  assert.equal(request.headers.get('cache-control'), 'no-cache');
  return new Response(f.bytes, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(f.bytes.length) } });
} }; }
const req = (path = '/index.html' + query, options) => new Request('https://entry.test' + path, options);
const failed = async (response, status = 503, head = false) => {
  assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-program-digest'), null);
  const text = await response.text();
  if (head || status === 404) assert.equal(text, '');
  else { assert.match(text, /沒有刪除存檔/); assert.doesNotMatch(text, /<script|<base|program-assets|12345678/); }
};
async function start(f, suffix) {
  const directory = join(own, suffix); mkdirSync(directory);
  writeFileSync(join(directory, 'static-release.json'), f.bytes, { flag: 'wx' });
  writeFileSync(join(directory, 'index.html'), '<!doctype html>DO NOT USE UNPINNED ENTRY', { flag: 'wx' });
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }], scriptPath: resolve('reader/programentry.js'), compatibilityDate: '2025-04-01', host: '127.0.0.1', port: 0,
    assets: { directory, binding: 'ASSETS', routerConfig: { has_user_worker: true, static_routing: { user_worker: ['/*'] } }, assetConfig: { not_found_handling: '404-page' } },
    r2Buckets: ['PUBLISH_BUCKET'], r2Persist: join(own, 'r2'), outboundService() { outbound++; return new Response('denied', { status: 403 }); } });
  bucket = await mf.getR2Bucket('PUBLISH_BUCKET');
}
try {
  const first = fixture(1), second = fixture(2);
  if (workerd) {
    let path;
    try { path = createRequire(import.meta.url).resolve('miniflare'); }
    catch { path = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
    assert.ok(existsSync(path)); ({ Miniflare } = await import(pathToFileURL(path).href));
    own = mkdtempSync(join(tmpdir(), 'dragon-program-entry-')); await start(first, 'first');
  }
  await stage(first); await stage(second);
  let deployed = first;
  const send = (path = '/index.html' + query, options) => workerd ? mf.dispatchFetch('https://entry.test' + path, options) : entry.fetch(req(path, options), { ASSETS: assets(deployed), PUBLISH_BUCKET: port });
  const originalPuts = puts;
  for (const path of ['/index.html' + query, '/' + query, '/index.html' + query.replace('mode=new', 'mode=load')]) {
    const response = await send(path); assert.equal(response.status, 200); assert.equal(response.headers.get('x-program-digest'), first.sha256);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const html = await response.text(), base = `<base href="/program-assets/${first.sha256}/" />`;
    assert.equal(html.split(base).length, 2);
    assert.equal(html.replace('\n    ' + base, ''), shell.toString(), 'only reviewed base insertion; all shell bytes otherwise unchanged'); count();
  }
  const head = await send('/index.html' + query, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('x-program-digest'), first.sha256); count();
  for (const path of ['/index.html', '/', '/old/index.html' + query, '/program-assets/' + first.sha256 + '/index.html' + query,
    '/index.html' + query + '&program=' + first.sha256, '/index.html' + query + '&mode=load', '/index.html' + query + '&formalGame=' + game,
    '/index.html?formalGame=' + game, '/index.html?mode=new', '/index.html' + query.replace(game, 'unknown'), '/index.html' + query.replace('mode=new', 'mode=old')]) {
    assetCalls = r2Calls = 0; await failed(await send(path), 404); if (!workerd) assert.equal(assetCalls + r2Calls, 0); count();
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) { await failed(await send('/index.html' + query, { method }), 404); count(); }
  for (const key of [first.key, first.base + 'static-release.json', first.base + 'files/index.html']) {
    const saved = await raw.get(key);
    for (const fault of ['missing', 'mime', 'bytes']) {
      if (fault === 'missing') await raw.remove(key);
      else await raw.seed(key, fault === 'bytes' ? Buffer.from('bad') : saved.bytes, fault === 'mime' ? 'text/plain' : saved.mime);
      await failed(await send()); await raw.seed(key, saved.bytes, saved.mime); count();
    }
  }
  // Faults and controlled awaits below execute the Node handler over the same
  // owned bucket even under --workerd, not workerd scheduling/stream proofs.
  for (const fault of ['status', 'mime', 'redirect', 'url', 'length', 'overflow', 'truncated', 'chunk', 'error', 'canonical']) {
    let cancelled = 0;
    const bad = { async fetch() {
      const h = { 'Content-Type': fault === 'mime' ? 'text/plain' : 'application/json' };
      if (fault === 'length') h['Content-Length'] = String(2 * 1024 * 1024 + 1);
      let body = first.bytes;
      if (fault === 'canonical') body = Buffer.from(first.bytes.toString() + ' ');
      if (fault === 'truncated') h['Content-Length'] = String(first.bytes.length + 1);
      if (['overflow', 'chunk', 'error'].includes(fault)) body = new ReadableStream({ start(c) {
        if (fault === 'error') c.error(new Error('owned stream fault'));
        else c.enqueue(fault === 'chunk' ? 'bad chunk' : new Uint8Array(2 * 1024 * 1024 + 1));
      }, cancel() { cancelled++; } });
      const response = new Response(body, { status: fault === 'status' ? 404 : 200, headers: h });
      if (fault === 'redirect') Object.defineProperty(response, 'redirected', { value: true });
      if (fault === 'url') Object.defineProperty(response, 'url', { value: 'https://other.test/static-release.json' });
      return response;
    } };
    r2Calls = 0; await failed(await entry.fetch(req(), { ASSETS: bad, PUBLISH_BUCKET: port }));
    assert.equal(r2Calls, 0); if (fault === 'overflow' || fault === 'chunk') assert.equal(cancelled, 1); count();
  }
  let calls = 0;
  await failed(await entry.fetch(req(), { ASSETS: { fetch: r => assets(++calls === 1 ? first : second).fetch(r) }, PUBLISH_BUCKET: port }));
  assert.equal(calls, 2); count();
  for (const abortAt of [1, 2, 3, 4, 5, 6, 7]) {
    const controller = new AbortController(); let calls = 0;
    const tick = value => { if (++calls === abortAt) controller.abort(); return value; };
    const response = await entry.fetch(req(undefined, { signal: controller.signal }), {
      ASSETS: { async fetch(r) { return tick(await assets(first).fetch(r)); } },
      PUBLISH_BUCKET: { async get(key) { return tick(await port.get(key)); } },
    });
    await failed(response); assert.equal(calls, abortAt); count();
  }
  for (const html of [shell.toString().replace('<head>', '<head><base href="https://other.test/">'), shell.toString().replace('<head>', '<head><meta http-equiv="refresh" content="0;url=/">'), '<html><head></head></html>', Buffer.from([255])]) {
    const bad = fixture(3, html); await stage(bad);
    await failed(await entry.fetch(req(), { ASSETS: assets(bad), PUBLISH_BUCKET: port })); count();
  }
  const big = fixture(4, Buffer.alloc(512 * 1024 + 1)); await stage(big);
  let readHTML = 0;
  await failed(await entry.fetch(req(), { ASSETS: assets(big), PUBLISH_BUCKET: { get(key) { if (key.endsWith('/files/index.html')) readHTML++; return port.get(key); } } }));
  assert.equal(readHTML, 0); count();
  // A deployment swap selects only the new registered archive. Existing old
  // program resources remain addressable, but no old HTML can be selected.
  if (workerd) { await mf.dispose(); mf = null; bucket = null; await start(second, 'second'); }
  deployed = second;
  const newer = await send(); assert.equal(newer.status, 200); assert.equal(newer.headers.get('x-program-digest'), second.sha256); count();
  for (const f of [first, second]) {
    const response = await program.fetch(req('/program-assets/' + f.sha256 + '/late.txt'), { PUBLISH_BUCKET: port });
    assert.equal(response.status, 200); assert.equal(await response.text(), f === first ? 'late-1' : 'late-2'); count();
    const denied = await program.fetch(req('/program-assets/' + f.sha256 + '/index.html'), { PUBLISH_BUCKET: port }); assert.equal(denied.status, 404); count();
  }
  await raw.remove(second.key); await failed(await send());
  await failed(await send('/index.html' + query, { method: 'HEAD' }), 503, true); count();
  assert.ok(originalPuts > 0); assert.equal(outbound, 0);
  process.stdout.write(JSON.stringify({ checks, workerd, outbound, scope: 'Unmounted current-deployment HTML handler; real staged archives, unchanged production shell plus one base, two owned Static Assets deployments in workerd mode. Controlled races/stream faults use Node. No site routing, browser, shared App, late consumer, game admission or two-host compatibility proof.' }) + '\n');
} finally { await mf?.dispose(); if (own) rmSync(own, { recursive: true, force: true }); }
