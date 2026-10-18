// Actual HTTPS client code with an in-process native HTTPS seam. No sockets,
// credentials, Cloudflare responses, TLS handshake or retention proof.
import assert from 'node:assert/strict';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { createStaticByteReader } from '../vps/static-client.mjs';
import { createStaticResourceVerifier } from '../vps/static-resources.mjs';
import { buildStaticRelease, STATIC_RELEASE_FILE } from '../vps/static-release.mjs';
const origin = 'https://owned-static.invalid';
const original = https.request;
const calls = [];
let plan, checks = 0;
const data = Buffer.from('data');
function reply({ status = 200, headers = {}, bytes = data, chunks = [bytes], finish = 'end' } = {}) {
  return ({ response, request, callback }) => {
    response.statusCode = status;
    response.headers = { 'content-type': 'application/octet-stream', ...headers };
    callback(response);
    for (const chunk of chunks) if (!response.destroyed) response.emit('data', chunk);
    if (finish === 'end') { response.complete = true; response.emit('end'); }
    else if (finish === 'aborted') response.emit('aborted');
    else if (finish === 'close') response.emit('close');
    else if (finish === 'error') request.emit('error', new Error('owned request failure'));
  };
}
async function check(fn) { await fn(); checks++; }
function reader(options = {}) { return createStaticByteReader({ origin, ...options }); }
https.request = (url, options, callback) => {
  assert.equal(typeof url, 'string');
  assert.ok(url.startsWith(origin + '/'), 'only exact owned virtual host');
  assert.equal(options.method, 'GET');
  assert.equal(options.rejectUnauthorized, true);
  assert.deepEqual(options.headers, { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' });
  const request = new EventEmitter(), response = new EventEmitter();
  request.destroy = () => { request.destroyed = true; };
  response.destroy = () => { response.destroyed = true; };
  calls.push({ url, request, response });
  request.end = body => {
    assert.equal(body, undefined);
    queueMicrotask(() => {
      try { plan({ url, options, request, response, callback }); }
      catch (cause) { request.emit('error', cause); }
    });
  };
  return request;
};
syncBuiltinESMExports();
try {
  await check(async () => {
    plan = reply({ headers: { 'content-length': '4' } });
    assert.deepEqual(await reader({ pathPrefix: 'owned/release/' })('empty.bin', { maxBytes: 4 }), data);
    assert.equal(calls.at(-1).url, origin + '/owned/release/empty.bin');
  });
  for (const [path, mime] of [
    ['src/main.js', 'text/javascript; charset=UTF-8'], ['src/module.mjs', 'application/javascript'],
    ['static-release.json', 'application/json; charset="utf-8"'], ['index.html', 'text/html'],
    ['styles.css', 'text/css'], ['image.PNG', 'image/png'], ['loop.flac', 'audio/flac'],
    ['font.woff2', 'font/woff2'], ['readme.md', 'text/markdown'], ['x.__proto__', 'application/octet-stream'],
  ]) await check(async () => {
    plan = reply({ headers: { 'content-type': mime } });
    assert.deepEqual(await reader()(path, { maxBytes: 4 }), data);
  });
  await check(async () => {
    const before = calls.length;
    for (const value of [undefined, '', 'http://owned-static.invalid', origin + '/', origin + '/path', origin + '?a=1', origin + '#x', 'https://u:p@owned-static.invalid']) {
      assert.throws(() => createStaticByteReader({ origin: value }), /STATIC_ORIGIN_INVALID/);
    }
    for (const pathPrefix of ['/', '../', 'a//', 'a/%2e/', 'a/../', 'a', 'a\\b/', null]) assert.throws(() => reader({ pathPrefix }), /STATIC_PREFIX_INVALID/);
    for (const timeoutMs of [0, -1, 120001, 1.1, '50', NaN]) assert.throws(() => reader({ timeoutMs }), /deadline invalid/);
    assert.equal(calls.length, before);
  });
  await check(async () => {
    const before = calls.length;
    for (const path of ['', '/a.bin', '../a.bin', 'a/../b', 'a//b', 'a\\b', 'a?x=1', 'a#x', 'a/%2f/b', 'https://other.invalid/a', '.hidden', 'a/'.repeat(257)]) {
      await assert.rejects(reader()(path, { maxBytes: 4 }), /STATIC_PATH_INVALID/);
    }
    for (const maxBytes of [undefined, 0, -1, 1.1, '4', 25 * 1024 * 1024 + 1]) await assert.rejects(reader()('a.bin', { maxBytes }), /response budget invalid/);
    assert.equal(calls.length, before);
  });
  for (const status of [206, 301, 302, 307, 403, 500]) await check(async () => {
    const before = calls.length;
    plan = reply({ status, headers: { location: 'https://not-allowed.invalid/' } });
    await assert.rejects(reader()('a.bin', { maxBytes: 4 }), new RegExp('STATIC_HTTP_STATUS_' + status));
    assert.equal(calls.length, before + 1, 'no redirect or retry');
  });
  await check(async () => {
    plan = reply({ status: 404 });
    assert.equal(await reader()('missing.bin', { maxBytes: 4 }), null);
    plan = reply({ status: 404, headers: { 'content-length': '5' } });
    await assert.rejects(reader()('missing.bin', { maxBytes: 5 }), /STATIC_RESPONSE_TRUNCATED/);
  });
  for (const mime of [undefined, ['application/json'], 'text/html', 'application/json; charset=latin1', 'application/json; charset=utf-8; x=1', 'application/json\n']) await check(async () => {
    plan = reply({ headers: { 'content-type': mime } });
    await assert.rejects(reader()('a.json', { maxBytes: 4 }), /STATIC_CONTENT_TYPE/);
  });
  await check(async () => {
    for (const encoding of ['gzip', 'br', ['identity'], 'identity, identity']) {
      plan = reply({ headers: { 'content-encoding': encoding } });
      await assert.rejects(reader()('a.bin', { maxBytes: 4 }), /STATIC_CONTENT_ENCODING/);
    }
    plan = reply({ headers: { 'content-encoding': 'identity' } });
    assert.deepEqual(await reader()('a.bin', { maxBytes: 4 }), data);
  });
  await check(async () => {
    plan = reply({ headers: { 'content-length': '5' } });
    await assert.rejects(reader()('a.bin', { maxBytes: 4 }), /STATIC_RESPONSE_BUDGET/);
    assert.equal(calls.at(-1).response.destroyed, true);
    assert.equal(calls.at(-1).request.destroyed, true);
    plan = reply({ bytes: Buffer.alloc(5) });
    await assert.rejects(reader()('a.bin', { maxBytes: 4 }), /STATIC_RESPONSE_BUDGET/);
  });
  await check(async () => {
    for (const finish of ['aborted', 'close', 'error']) {
      plan = reply({ finish });
      await assert.rejects(reader()('a.bin', { maxBytes: 4 }), /STATIC_RESPONSE_ABORTED|STATIC_RESPONSE_TRUNCATED|owned request failure/);
    }
  });
  await check(async () => {
    plan = () => {}; // No response at all; bounded connection phase.
    await assert.rejects(reader({ timeoutMs: 25 })('a.bin', { maxBytes: 4 }), /STATIC_REQUEST_TIMEOUT/);
    assert.equal(calls.at(-1).request.destroyed, true);
  });
  await check(async () => {
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const files = new Map([['src/main.js', Buffer.from('export {};')], ['music.flac', Buffer.from('opaque music')]]);
    const visualAssets = {};
    for (const [group, stem] of [['seasonAtlases', 'map_atlas_'], ['seasons', 'map_tiles_']]) {
      visualAssets[group] = {};
      for (const season of ['spring', 'summer', 'autumn', 'winter']) {
        const path = `content/builtin/compiled/owned/${stem}${season}.png`, bytes = Buffer.from('opaque ' + path);
        files.set(path, bytes);
        visualAssets[group][season] = { path, url: path, byteLength: bytes.length, sha256: sha(bytes) };
      }
    }
    const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: sha(bytes) })));
    files.set(STATIC_RELEASE_FILE, Buffer.from(built.bytes));
    plan = context => {
      const path = context.url.slice((origin + '/').length), bytes = files.get(path);
      assert.ok(bytes, 'only owned fixture package');
      let mime = 'image/png';
      if (path.endsWith('.js')) mime = 'text/javascript';
      else if (path.endsWith('.json')) mime = 'application/json';
      else if (path.endsWith('.flac')) mime = 'audio/flac';
      reply({ bytes, headers: { 'content-type': mime, 'content-length': String(bytes.length) } })(context);
    };
    const verify = createStaticResourceVerifier({ readStatic: reader(), expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest });
    const before = calls.length, result = await verify({ manifest: { visualAssets } });
    assert.equal(result.filesVerified, 10);
    assert.equal(calls.length, before + 12);
    files.set('src/main.js', Buffer.from('wrong!'));
    await assert.rejects(verify({ manifest: { visualAssets } }), /STATIC_RESOURCE_BYTES/);
  });
  process.stdout.write(JSON.stringify({ checks, requests: calls.length, sockets: 0, scope: 'native HTTPS seam, not TLS or deployed static retention' }) + '\n');
} finally {
  https.request = original;
  syncBuiltinESMExports();
}
