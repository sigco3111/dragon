// Operator metadata primitive: conditional memory or owned real workerd R2.
// Synthetic digests here are NOT evidence of an archived/executable program.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { registerStaticProgram } from '../vps/program-registration.mjs';
import { programRegistrationKey, programRegistrationBytes, parseProgramRegistration, PROGRAM_REGISTRATION_MAX_BYTES } from '../reader/programregistration.js';
assert.ok(process.argv.slice(2).every(arg => arg === '--workerd'));
const workerd = process.argv.includes('--workerd'), releaseDigest = 'a'.repeat(64), sourceTreeDigest = 'b'.repeat(64);
let mf, own, bucket, serial = 0, checks = 0, outbound = 0;
try {
  if (workerd) {
    let modulePath;
    try { modulePath = createRequire(import.meta.url).resolve('miniflare'); }
    catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
    assert.ok(existsSync(modulePath), 'existing Miniflare required');
    const { Miniflare } = await import(pathToFileURL(modulePath).href);
    own = mkdtempSync(join(tmpdir(), 'dragon-program-registration-'));
    mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("owned");}}', compatibilityDate: '2026-01-01', r2Buckets: ['OWNED'], r2Persist: join(own, 'r2'), host: '127.0.0.1', port: 0, outboundService: () => { outbound++; return new Response('denied', { status: 403 }); } });
    bucket = await mf.getR2Bucket('OWNED');
  }
  const bytes = programRegistrationBytes(releaseDigest, sourceTreeDigest);
  assert.ok(bytes.length <= PROGRAM_REGISTRATION_MAX_BYTES);
  assert.deepEqual(parseProgramRegistration(bytes, releaseDigest), { schema: 'dragon-program-registration-1', releaseDigest, sourceTreeDigest });
  assert.ok(Object.isFrozen(parseProgramRegistration(bytes, releaseDigest))); checks++;
  for (const bad of [null, '', 'A'.repeat(64), 'a'.repeat(63), '../' + releaseDigest, 1]) {
    assert.throws(() => programRegistrationKey(bad));
    assert.throws(() => programRegistrationBytes(bad, sourceTreeDigest));
    assert.throws(() => programRegistrationBytes(releaseDigest, bad)); checks++;
  }
  for (const bad of [null, 'text', new Uint8Array(), new Uint8Array(513), new Uint8Array([255]), Buffer.from('null'), Buffer.from('{}'), Buffer.from('['), Buffer.concat([bytes, Buffer.from('\n')]), Buffer.from(new TextDecoder().decode(bytes).replace('dragon-program-registration-1', 'dragon-program-registration-2')), Buffer.from(new TextDecoder().decode(bytes).replace('"schema"', '"other"'))]) {
    assert.throws(() => parseProgramRegistration(bad, releaseDigest)); checks++;
  }
  assert.throws(() => parseProgramRegistration(bytes, 'c'.repeat(64))); checks++;
  function fixture() {
    const prefix = `test/program-registration-${++serial}/`, key = prefix + programRegistrationKey(releaseDigest);
    const keys = new Set([key]), memory = new Map(), reads = [], puts = [];
    const raw = {
      async get(key, { maxBytes } = {}) {
        assert.ok(keys.has(key)); if (maxBytes !== undefined) assert.equal(maxBytes, PROGRAM_REGISTRATION_MAX_BYTES);
        reads.push(key);
        if (!bucket) return memory.has(key) ? structuredClone(memory.get(key)) : null;
        const object = await bucket.get(key);
        return object ? { bytes: new Uint8Array(await object.arrayBuffer()), headers: { 'content-type': object.httpMetadata.contentType } } : null;
      },
      async seed(key, value, type = 'application/json') {
        assert.ok(keys.has(key));
        if (bucket) await bucket.put(key, value, { httpMetadata: { contentType: type } });
        else memory.set(key, { bytes: new Uint8Array(value), headers: { 'content-type': type } });
      },
      async putImmutable(key, value, type) {
        assert.ok(keys.has(key)); assert.equal(type, 'application/json'); puts.push(key);
        if (bucket) await bucket.put(key, value, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: type } });
        else if (!memory.has(key)) await raw.seed(key, value, type);
      },
    };
    const options = { r2: { get: raw.get, putImmutable: raw.putImmutable }, releaseDigest, sourceTreeDigest, prefix, assertCurrent() {} };
    return { options, raw, key, keys, reads, puts, run: overrides => registerStaticProgram({ ...options, ...overrides }) };
  }
  for (const bad of [{ r2: {} }, { prefix: 'control/' }, { prefix: '../' }, { releaseDigest: null }, { sourceTreeDigest: 'C'.repeat(64) }, { assertCurrent: null }, { assertCurrent: async () => {} }, { assertCurrent: () => true }]) {
    const f = fixture(); await assert.rejects(f.run(bad)); assert.equal(f.reads.length + f.puts.length, 0); checks++;
  }
  {
    const f = fixture(), first = await f.run(); assert.deepEqual(first, parseProgramRegistration(bytes, releaseDigest)); assert.ok(Object.isFrozen(first));
    assert.deepEqual(Buffer.from((await f.raw.get(f.key)).bytes), Buffer.from(bytes));
    await f.run(); assert.equal(f.puts.length, 1); checks++;
    await f.raw.seed(f.key, Buffer.from('corrupt'));
    await assert.rejects(f.run()); assert.equal(f.puts.length, 1); checks++;
  }
  for (const bad of ['bytes', 'mime', 'duplicate', 'source']) {
    const f = fixture();
    let seededBytes = bytes;
    if (bad === 'bytes') seededBytes = Buffer.from('bad');
    else if (bad === 'source') seededBytes = programRegistrationBytes(releaseDigest, 'c'.repeat(64));
    await f.raw.seed(f.key, seededBytes, bad === 'mime' ? 'text/plain' : 'application/json');
    if (bad === 'duplicate') f.options.r2.get = async (...args) => { const result = await f.raw.get(...args); result.headers['Content-Type'] = 'application/json'; return result; };
    const before = await f.raw.get(f.key); await assert.rejects(f.run()); assert.equal(f.puts.length, 0); assert.deepEqual(await f.raw.get(f.key), before); checks++;
  }
  {
    const f = fixture(); f.options.r2.putImmutable = async (...args) => { await f.raw.putImmutable(...args); throw new Error('lost response'); };
    await f.run(); assert.equal(f.puts.length, 1); checks++;
  }
  {
    const f = fixture(); f.options.r2.putImmutable = async () => { throw new Error('before write'); };
    await assert.rejects(f.run(), /PROGRAM_REGISTRATION_UNAVAILABLE/); assert.equal(await f.raw.get(f.key), null); checks++;
  }
  {
    const f = fixture(); f.options.r2.get = async () => { throw new Error('read failure'); };
    await assert.rejects(f.run(), /read failure/); assert.equal(f.puts.length, 0); checks++;
  }
  for (const stage of ['initial', 'get', 'put']) {
    const f = fixture(); let active = stage !== 'initial';
    f.options.assertCurrent = () => { if (!active) throw new Error('retired'); };
    if (stage === 'get') f.options.r2.get = async (...args) => { const result = await f.raw.get(...args); active = false; return result; };
    if (stage === 'put') f.options.r2.putImmutable = async (...args) => { await f.raw.putImmutable(...args); active = false; };
    await assert.rejects(f.run(), /retired/); assert.equal(f.puts.length, stage === 'put' ? 1 : 0);
    if (stage === 'put') assert.deepEqual(Buffer.from((await f.raw.get(f.key)).bytes), Buffer.from(bytes)); checks++;
  }
  {
    const f = fixture(), second = 'd'.repeat(64), secondKey = f.options.prefix + programRegistrationKey(second); f.keys.add(secondKey);
    await f.run(); const before = await f.raw.get(f.key);
    await f.run({ releaseDigest: second, sourceTreeDigest: 'e'.repeat(64) });
    assert.deepEqual(await f.raw.get(f.key), before); assert.equal(f.puts.length, 2); checks++;
  }
  assert.equal(outbound, 0);
  process.stdout.write(JSON.stringify({ checks, workerd, outbound, scope: 'Operator registration metadata and conditional owned R2 only; not an archive, public route, program selection, game admission or compatibility certificate.' }) + '\n');
} finally { await mf?.dispose(); if (own) rmSync(own, { recursive: true, force: true }); }
