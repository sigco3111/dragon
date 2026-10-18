// Owned byte sources / conditional bucket only; optional actual local workerd.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildStaticRelease } from '../vps/static-release.mjs';
import { createStaticArchiver } from '../vps/static-archive.mjs';
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
    mkdirSync('.dragon-analysis', { recursive: true }); own = mkdtempSync(resolve('.dragon-analysis/static-archive-r2-'));
    mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("owned");}}', compatibilityDate: '2026-01-01', r2Buckets: ['OWNED'], r2Persist: join(own, 'r2'), host: '127.0.0.1', port: 0, outboundService: () => { outbound++; return new Response('forbidden', { status: 403 }); } });
    bucket = await mf.getR2Bucket('OWNED');
  }
  function fixture() {
    const prefix = `test/static-archive-${++serial}/`, objects = new Map(), keys = new Set(), puts = [], reads = [];
    const files = new Map([['src/entry.js', Buffer.from('export const value=1;')], ['music.dat', Buffer.from([0,1,2,3])], ['empty.txt', Buffer.alloc(0)], ['_headers', Buffer.from('owned configuration')]]);
    const built = buildStaticRelease([...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), byteLength: bytes.length })));
    files.set('static-release.json', built.bytes);
    const base = `${prefix}artifacts/programs/${built.sha256}/`, manifestKey = base + 'static-release.json';
    const allowedBases = new Set([base]);
    const keyCheck = key => assert.ok([...allowedBases].some(allowed => key.startsWith(allowed)));
    const raw = {
      async get(key) {
        keyCheck(key);
        if (!bucket) return objects.has(key) ? structuredClone(objects.get(key)) : null;
        const object = await bucket.get(key);
        return object === null ? null : { bytes: new Uint8Array(await object.arrayBuffer()), headers: { 'content-type': object.httpMetadata.contentType } };
      },
      async seed(key, bytes, type) {
        keyCheck(key); keys.add(key);
        if (bucket) await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
        else objects.set(key, { bytes: Buffer.from(bytes), headers: { 'content-type': type } });
      },
      async putImmutable(key, bytes, type) {
        keyCheck(key); puts.push(key);
        if (bucket) { const result = await bucket.put(key, bytes, { httpMetadata: { contentType: type }, onlyIf: { etagDoesNotMatch: '*' } }); if (result) keys.add(key); }
        else if (!objects.has(key)) { keys.add(key); objects.set(key, { bytes: Buffer.from(bytes), headers: { 'content-type': type } }); }
      },
    };
    const r2 = { get: raw.get, putImmutable: raw.putImmutable };
    const options = { r2, prefix, readStatic: async (path, { maxBytes }) => {
      reads.push(path); assert.ok(files.has(path)); assert.ok(maxBytes >= Math.max(1, files.get(path).length)); return Buffer.from(files.get(path));
    }, expectedDigest: built.sha256, sourceTreeDigest: built.manifest.sourceTreeDigest,
    maxTotalBytes: built.bytes.length + [...files].filter(([path]) => path !== 'static-release.json' && path !== '_headers').reduce((sum, [, bytes]) => sum + bytes.length, 0) };
    return { options, r2, raw, files, built, base, manifestKey, puts, reads, keys, allowedBases, stage: (guard = () => {}) => createStaticArchiver(options).stage(guard) };
  }
  for (const override of [{ r2: {} }, { readStatic: null }, { expectedDigest: 'A'.repeat(64) }, { sourceTreeDigest: null }, { maxTotalBytes: 0 }, { maxTotalBytes: NaN }, { maxTotalBytes: 1.5 }, { prefix: '../' }, { prefix: 'https://outside/' }]) {
    const f = fixture(); assert.throws(() => createStaticArchiver({ ...f.options, ...override }), TypeError); assert.equal(f.reads.length + f.puts.length, 0); checks++;
  }
  for (const guard of [null, async () => {}, () => true, () => { throw new Error('retired'); }]) {
    const f = fixture(); await assert.rejects(f.stage(guard)); assert.equal(f.reads.length + f.puts.length, 0); checks++;
  }
  {
    const f = fixture(), result = await f.stage();
    assert.deepEqual(result, { releaseDigest: f.built.sha256, sourceTreeDigest: f.built.manifest.sourceTreeDigest, manifestKey: f.manifestKey, filesVerified: 3, bytesVerified: f.options.maxTotalBytes });
    assert.ok(Object.isFrozen(result)); assert.equal(f.puts.at(-1), f.manifestKey); assert.equal(f.puts.length, 4); assert.equal(f.keys.size, 4);
    assert.ok(!f.puts.some(key => key.endsWith('_headers'))); assert.deepEqual(Buffer.from((await f.raw.get(f.manifestKey)).bytes), f.built.bytes); checks++;
    const reads = f.reads.length; assert.deepEqual(await f.stage(), result); assert.equal(f.puts.length, 4); assert.ok(f.reads.length > reads); checks++;
  }
  for (const fault of ['digest', 'source', 'budget', 'manifest']) {
    const f = fixture();
    if (fault === 'digest') f.options.expectedDigest = 'f'.repeat(64);
    if (fault === 'source') f.options.sourceTreeDigest = 'f'.repeat(64);
    if (fault === 'budget') f.options.maxTotalBytes--;
    if (fault === 'manifest') f.options.readStatic = async () => null;
    await assert.rejects(f.stage()); assert.equal(f.puts.length, 0); checks++;
  }
  for (const value of [null, 'not bytes', Buffer.from('wrong'), new Uint8Array(100)]) {
    const f = fixture(), read = f.options.readStatic;
    f.options.readStatic = async (path, options) => path === 'music.dat' ? value : read(path, options);
    await assert.rejects(f.stage()); assert.equal(await f.raw.get(f.manifestKey), null); checks++;
  }
  for (const type of ['wrong-bytes', 'wrong-type', 'duplicate-type']) {
    const f = fixture(), key = f.base + 'files/empty.txt';
    await f.raw.seed(key, type === 'wrong-bytes' ? Buffer.from('collision') : Buffer.alloc(0), type === 'wrong-type' ? 'text/plain' : 'application/octet-stream');
    if (type === 'duplicate-type') f.r2.get = async k => { const value = await f.raw.get(k); if (k === key && value) value.headers['Content-Type'] = 'application/octet-stream'; return value; };
    await assert.rejects(f.stage()); assert.equal(f.puts.length, 0); assert.equal(await f.raw.get(f.manifestKey), null); checks++;
  }
  {
    const f = fixture(); f.r2.putImmutable = async (...args) => { await f.raw.putImmutable(...args); throw new Error('lost response'); };
    await f.stage(); assert.equal(f.puts.length, 4); checks++;
  }
  {
    const f = fixture(); f.r2.putImmutable = async () => { throw new Error('before upload'); };
    await assert.rejects(f.stage()); assert.equal(f.keys.size, 0); checks++;
  }
  {
    const f = fixture(); f.r2.get = async () => { throw new Error('not absence'); };
    await assert.rejects(f.stage()); assert.equal(f.puts.length, 0); checks++;
  }
  {
    const f = fixture(), read = f.options.readStatic; let manifests = 0;
    f.options.readStatic = async (path, options) => path === 'static-release.json' && ++manifests > 1 ? Buffer.from('changed') : read(path, options);
    // Counter applies only when path is the manifest (short-circuit).
    await assert.rejects(f.stage()); assert.equal(await f.raw.get(f.manifestKey), null); assert.equal(f.keys.size, 3);
    f.options.readStatic = read; await f.stage(); assert.equal(f.keys.size, 4); checks++;
  }
  {
    const f = fixture(); let reads = 0; const key = f.base + 'files/empty.txt';
    f.r2.get = async k => { const value = await f.raw.get(k); if (k === key && ++reads === 3) return { bytes: Buffer.from('changed'), headers: { 'content-type': 'application/octet-stream' } }; return value; };
    await assert.rejects(f.stage()); assert.equal(await f.raw.get(f.manifestKey), null); checks++;
  }
  {
    const f = fixture(); let active = true;
    f.r2.putImmutable = async (...args) => { await f.raw.putImmutable(...args); active = false; };
    await assert.rejects(f.stage(() => { if (!active) throw new Error('retired'); }));
    assert.equal(f.keys.size, 1); assert.equal(await f.raw.get(f.manifestKey), null); checks++;
  }
  {
    const f = fixture(), raw = f.raw.get; let active = true;
    f.r2.get = async key => { const value = await raw(key); if (key === f.manifestKey && value) active = false; return value; };
    await assert.rejects(f.stage(() => { if (!active) throw new Error('retired'); }));
    assert.equal(f.keys.size, 4); // Real write remains; no false success/rollback.
    checks++;
  }
  {
    const f = fixture(), old = await f.stage(), originals = new Map();
    for (const key of f.keys) originals.set(key, await f.raw.get(key));
    f.files.set('src/entry.js', Buffer.from('export const value=2;'));
    const next = buildStaticRelease([...f.files].filter(([path]) => path !== 'static-release.json').map(([path, bytes]) => ({ path, sha256: hash(bytes), byteLength: bytes.length })));
    f.files.set('static-release.json', next.bytes);
    f.allowedBases.add(`${f.options.prefix}artifacts/programs/${next.sha256}/`);
    Object.assign(f.options, { expectedDigest: next.sha256, sourceTreeDigest: next.manifest.sourceTreeDigest, maxTotalBytes: f.options.maxTotalBytes + 1024 });
    const newer = await f.stage(); assert.notEqual(newer.manifestKey, old.manifestKey); assert.equal(f.keys.size, 8);
    for (const [key, value] of originals) assert.deepEqual(await f.raw.get(key), value);
    checks++;
  }
  assert.equal(outbound, 0);
  process.stdout.write(JSON.stringify({ checks, workerd, outbound, scope: 'owned immutable static archive, not publication, runtime binding, compatibility or old-session serving' }) + '\n');
} finally { await mf?.dispose(); if (own) rmSync(own, { recursive: true, force: true }); }
