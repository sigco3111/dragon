// Owned conditional archive; the same reader cases run against memory/workerd.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildStaticRelease } from '../vps/static-release.mjs';
import { createStaticArchiver } from '../vps/static-archive.mjs';
import { createStaticArchiveReader } from '../vps/static-archive-reader.mjs';
assert.ok(process.argv.slice(2).every(arg => arg === '--workerd'));
const workerd = process.argv.includes('--workerd'), hash = bytes => createHash('sha256').update(bytes).digest('hex');
let mf, own, bucket, outbound = 0, checks = 0, serial = 0;
try {
  if (workerd) {
    let modulePath;
    try { modulePath = createRequire(import.meta.url).resolve('miniflare'); }
    catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
    assert.ok(existsSync(modulePath), 'installed Miniflare required; never install');
    const { Miniflare } = await import(pathToFileURL(modulePath).href);
    mkdirSync('.dragon-analysis', { recursive: true }); own = mkdtempSync(resolve('.dragon-analysis/static-read-r2-'));
    mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("owned");}}', compatibilityDate: '2026-01-01', r2Buckets: ['OWNED'], r2Persist: join(own, 'r2'), host: '127.0.0.1', port: 0, outboundService: () => { outbound++; return new Response('forbidden', { status: 403 }); } });
    bucket = await mf.getR2Bucket('OWNED');
  }
  async function fixture() {
    const prefix = `test/static-read-${++serial}/`, objects = new Map(), calls = [], allowed = new Set();
    const files = new Map([['src/entry.js', Buffer.from('export const value=1;')], ['music.dat', Buffer.from([0,1,2,3])], ['empty.txt', Buffer.alloc(0)], ['_headers', Buffer.from('not public')]]);
    const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), byteLength: bytes.length })));
    const base = `${prefix}artifacts/programs/${built.sha256}/`, manifestKey = base + 'static-release.json'; allowed.add(base);
    const keyCheck = key => assert.ok([...allowed].some(value => key.startsWith(value)));
    let writes = 0, sourceReads = 0;
    const r2 = {
      async get(key, { maxBytes }) {
        keyCheck(key); calls.push({ key, maxBytes });
        if (!bucket) return objects.has(key) ? structuredClone(objects.get(key)) : null;
        const value = await bucket.get(key);
        return value === null ? null : { bytes: new Uint8Array(await value.arrayBuffer()), headers: { 'content-type': value.httpMetadata.contentType } };
      },
      async putImmutable(key, bytes, type) {
        keyCheck(key); writes++;
        if (bucket) await bucket.put(key, bytes, { httpMetadata: { contentType: type }, onlyIf: { etagDoesNotMatch: '*' } });
        else if (!objects.has(key)) objects.set(key, { bytes: Buffer.from(bytes), headers: { 'content-type': type } });
      },
    };
    const readStatic = async path => { sourceReads++; return Buffer.from(path === 'static-release.json' ? built.bytes : files.get(path)); };
    await createStaticArchiver({ r2, readStatic, prefix, expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest, maxTotalBytes: 10000 }).stage(() => {});
    const count = sourceReads; files.clear(); calls.length = 0;
    const options = { r2: { get: r2.get }, prefix, expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest, assertCurrent: () => {} };
    return { options, r2, calls, built, base, manifestKey, allowed, unchanged: () => { assert.equal(writes, 4); assert.equal(sourceReads, count); }, reader: () => createStaticArchiveReader(options) };
  }
  for (const override of [{ r2: {} }, { expectedDigest: 'A'.repeat(64) }, { sourceTreeDigest: null }, { prefix: '../' }, { prefix: 'https://outside/' }, { assertCurrent: null }, { assertCurrent: async () => {} }]) {
    const f = await fixture(); assert.throws(() => createStaticArchiveReader({ ...f.options, ...override }), TypeError); assert.deepEqual(f.calls, []); f.unchanged(); checks++;
  }
  for (const path of ['', '../music.dat', '/music.dat', 'src//entry.js', 'src/./entry.js', 'src/../entry.js', 'src\\entry.js', 'music.dat?x=1', 'music.dat#x', 'https://outside/x', '%6dusic.dat', '.hidden', 'x'.repeat(513)]) {
    const f = await fixture(); await assert.rejects(f.reader()(path, { maxBytes: 1000 }), TypeError); assert.deepEqual(f.calls, []); checks++;
  }
  for (const maxBytes of [undefined, 0, -1, 1.5, NaN, 25 * 1024 * 1024 + 1]) {
    const f = await fixture(); await assert.rejects(f.reader()('music.dat', { maxBytes }), TypeError); assert.deepEqual(f.calls, []); checks++;
  }
  {
    const f = await fixture(), read = f.reader();
    assert.deepEqual(await read('static-release.json', { maxBytes: f.built.bytes.length }), f.built.bytes);
    const first = await read('music.dat', { maxBytes: 4 }); assert.deepEqual(first, Buffer.from([0,1,2,3])); first[0] = 255;
    assert.deepEqual(await read('music.dat', { maxBytes: 4 }), Buffer.from([0,1,2,3]));
    assert.deepEqual(await read('empty.txt', { maxBytes: 1 }), Buffer.alloc(0));
    assert.equal((await read('src/entry.js', { maxBytes: 100 })).toString(), 'export const value=1;');
    assert.ok(f.calls.every(call => call.maxBytes > 0 && call.maxBytes <= 2 * 1024 * 1024)); f.unchanged(); checks++;
  }
  for (const path of ['missing', '_headers', '_redirects', 'Music.dat']) {
    const f = await fixture(); await assert.rejects(f.reader()(path, { maxBytes: 1000 })); assert.equal(f.calls.length, 1); f.unchanged(); checks++;
  }
  {
    const f = await fixture(); await assert.rejects(f.reader()('music.dat', { maxBytes: 3 })); assert.equal(f.calls.length, 1);
    f.calls.length = 0; await assert.rejects(f.reader()('static-release.json', { maxBytes: 1 })); assert.equal(f.calls[0].maxBytes, 1); checks++;
  }
  for (const fault of ['missing', 'type', 'duplicate-type', 'bytes', 'oversize', 'source-pin', 'throw']) {
    const f = await fixture(); f.options.r2.get = async (key, options) => {
      const value = await f.r2.get(key, options);
      if (key !== f.manifestKey) return value;
      if (fault === 'missing') return null;
      if (fault === 'throw') throw new Error('unknown transport');
      if (fault === 'type') value.headers['content-type'] = 'text/html';
      if (fault === 'duplicate-type') value.headers['Content-Type'] = 'application/json';
      if (fault === 'bytes') value.bytes[0] ^= 1;
      if (fault === 'oversize') value.bytes = new Uint8Array(2 * 1024 * 1024 + 1);
      return value;
    };
    if (fault === 'source-pin') f.options.sourceTreeDigest = 'f'.repeat(64);
    await assert.rejects(f.reader()('music.dat', { maxBytes: 4 })); assert.equal(f.calls.length, 1); f.unchanged(); checks++;
  }
  for (const fault of ['missing', 'type', 'duplicate-type', 'bytes', 'short', 'oversize', 'throw']) {
    const f = await fixture(); f.options.r2.get = async (key, options) => {
      const value = await f.r2.get(key, options);
      if (!key.endsWith('/music.dat')) return value;
      if (fault === 'missing') return null;
      if (fault === 'throw') throw new Error('unknown transport');
      if (fault === 'type') value.headers['content-type'] = 'audio/flac';
      if (fault === 'duplicate-type') value.headers['Content-Type'] = 'application/octet-stream';
      if (fault === 'bytes') value.bytes[0] ^= 1;
      if (fault === 'short') value.bytes = value.bytes.slice(1);
      if (fault === 'oversize') value.bytes = new Uint8Array(5);
      return value;
    };
    await assert.rejects(f.reader()('music.dat', { maxBytes: 4 })); assert.equal(f.calls.length, 2); f.unchanged(); checks++;
  }
  for (const fault of ['missing', 'changed', 'type']) {
    const f = await fixture(); let manifests = 0;
    f.options.r2.get = async (key, options) => {
      const value = await f.r2.get(key, options);
      if (key === f.manifestKey && ++manifests === 2) {
        if (fault === 'missing') return null;
        if (fault === 'changed') value.bytes[0] ^= 1;
        if (fault === 'type') value.headers['content-type'] = 'text/plain';
      }
      return value;
    };
    await assert.rejects(f.reader()('music.dat', { maxBytes: 4 })); assert.equal(f.calls.length, 3); f.unchanged(); checks++;
  }
  for (const after of [0, 1, 2, 3]) {
    const f = await fixture(); let active = after !== 0;
    f.options.assertCurrent = () => { if (!active) throw new Error('retired'); };
    f.options.r2.get = async (key, options) => { const value = await f.r2.get(key, options); if (f.calls.length === after) active = false; return value; };
    await assert.rejects(f.reader()('music.dat', { maxBytes: 4 }), /retired/); assert.equal(f.calls.length, after); f.unchanged(); checks++;
  }
  {
    const f = await fixture(); f.options.assertCurrent = () => true;
    await assert.rejects(f.reader()('music.dat', { maxBytes: 4 }), /return undefined/); assert.deepEqual(f.calls, []); checks++;
  }
  {
    const f = await fixture(), read = f.reader(); let missing = false;
    const get = f.options.r2.get; f.options.r2.get = () => { throw new Error('changed caller port'); };
    assert.deepEqual(await read('music.dat', { maxBytes: 4 }), Buffer.from([0,1,2,3])); // captured method
    f.options.r2.get = async (key, options) => key.endsWith('/music.dat') && missing ? null : get(key, options);
    const live = f.reader(); await live('music.dat', { maxBytes: 4 }); missing = true;
    await assert.rejects(live('music.dat', { maxBytes: 4 })); f.unchanged(); checks++;
  }
  assert.equal(outbound, 0);
  process.stdout.write(JSON.stringify({ checks, workerd, outbound, scope: 'cold pinned archive byte port; no source fallback/writes, HTTP serving, admission, compatibility or live old-session proof' }) + '\n');
} finally { await mf?.dispose(); if (own) rmSync(own, { recursive: true, force: true }); }
