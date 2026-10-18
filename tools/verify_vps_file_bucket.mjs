// Owned filesystem/worker-thread faults only. No cloud or real editor storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { FileBucket } from '../vps/file-bucket.mjs';
const own = fs.mkdtempSync(join(tmpdir(), 'dragon-file-bucket-'));
const root = join(own, 'objects'), bucket = new FileBucket({ root });
const game = '11111111-1111-4111-8111-111111111111';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const key = bytes => `private/${game}/${sha(bytes)}`;
const disk = k => join(root, ...k.split('/').slice(0, -1), k.split('/').at(-1) + '.bin');
const bytes = Buffer.alloc(65537, 71), k = key(bytes);
let checks = 0;
const check = label => { checks++; process.stdout.write('ok ' + label + '\n'); };
function fault(name, replacement, action) {
  const original = fs[name];
  fs[name] = replacement(original); syncBuiltinESMExports();
  return Promise.resolve().then(action).finally(() => { fs[name] = original; syncBuiltinESMExports(); });
}
try {
  assert.notEqual(await bucket.put(k, bytes), null);
  assert.deepEqual(Buffer.from(await (await bucket.get(k)).arrayBuffer()), bytes);
  assert.deepEqual(Buffer.from(await new Response((await bucket.get(k)).body).arrayBuffer()), bytes);
  check('body and arrayBuffer read exact immutable bytes');
  assert.equal(await bucket.put(k, Buffer.from('wrong')), null);
  assert.equal(await bucket.put(k, Buffer.from('wrong'), { onlyIf: new Headers({ 'If-None-Match': '*' }) }), null);
  assert.deepEqual(fs.readFileSync(disk(k)), bytes);
  check('conditional and unconditional calls never overwrite');
  const zero = Buffer.alloc(0);
  await bucket.put(key(zero), zero);
  assert.equal((await (await bucket.get(key(zero))).arrayBuffer()).byteLength, 0);
  check('empty object installs and reads');
  for (const invalid of ['../../escape', `installed/../${sha(bytes)}`, `installed/./${sha(bytes)}`, `private/${game}/${sha(bytes)}/extra`, null, { toString: () => k }]) {
    await assert.rejects(() => bucket.put(invalid, bytes), /bucket key shape/);
    assert.equal(await bucket.get(invalid), null);
  }
  await assert.rejects(() => bucket.put(k, 'string'), /bucket bytes/);
  await assert.rejects(() => bucket.put(k, bytes, { onlyIf: new Headers({ 'If-Match': '*' }) }), /bucket condition/);
  await assert.rejects(() => bucket.list({ prefix: 1 }), /bucket prefix/);
  check('key namespace/dot segments/input/condition rejected');
  const installed = `installed/owned-registry-1/${sha(bytes)}`;
  await bucket.put(installed, bytes);
  assert.deepEqual((await bucket.list({ prefix: 'installed/' })).objects, [{ key: installed, size: bytes.length }]);
  assert.equal(await bucket.get(`installed/missing/${sha(bytes)}`), null);
  check('installed namespace and missing object');

  const partial = Buffer.alloc(8097, 32), pk = key(partial);
  let writes = 0;
  await fault('writeSync', original => (fd, value, offset, length, position) => {
    writes++; assert.equal(fs.existsSync(disk(pk)), false, 'no partially visible final object');
    return original(fd, value, offset, Math.min(length, 13), position);
  }, () => bucket.put(pk, partial));
  assert.ok(writes > 1); assert.deepEqual(fs.readFileSync(disk(pk)), partial);
  check('partial writes loop; final key absent until completed');

  for (const kind of ['write', 'zero-write', 'file-sync', 'link']) {
    const value = Buffer.from(`fault-${kind}`), fk = key(value);
    const method = { write: 'writeSync', 'zero-write': 'writeSync', 'file-sync': 'fsyncSync', link: 'linkSync' }[kind];
    await fault(method, original => (...args) => {
      if (kind === 'zero-write') return 0;
      if (kind === 'file-sync' && !fs.fstatSync(args[0]).isFile()) return original(...args);
      throw new Error('OWNED_INJECTED_FAILURE');
    }, () => assert.rejects(() => bucket.put(fk, value), /OWNED_INJECTED_FAILURE|bucket short write/));
    assert.equal(await bucket.get(fk), null);
    assert.ok(fs.readdirSync(join(root, 'private', game)).every(name => !name.endsWith('.tmp')));
  }
  check('write/zero-progress/fsync/link faults leave no partial final or owned temporary');

  const uncertain = Buffer.from('linked-but-response-failed'), uk = key(uncertain);
  await fault('linkSync', original => (...args) => { original(...args); throw new Error('OWNED_CONFIRMATION_LOST'); },
    () => assert.rejects(() => bucket.put(uk, uncertain), /OWNED_CONFIRMATION_LOST/));
  assert.deepEqual(fs.readFileSync(disk(uk)), uncertain);
  assert.equal(await bucket.put(uk, uncertain), null);
  check('post-install unknown result preserves complete object and supports retry');

  const threadRoot = join(own, 'threads'), contenderA = Buffer.alloc(131071, 65), contenderB = Buffer.alloc(131071, 66);
  const threadKey = key(contenderA);
  function contender(value) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(`const {workerData,parentPort}=require('node:worker_threads');(async()=>{const {FileBucket}=await import(workerData.module);const b=new FileBucket({root:workerData.root});const r=await b.put(workerData.key,new Uint8Array(workerData.value));parentPort.postMessage({created:r!==null});})().catch(e=>{throw e});`, {
        eval: true, workerData: { module: new URL('../vps/file-bucket.mjs', import.meta.url).href, root: threadRoot, key: threadKey, value },
      });
      let result;
      worker.on('message', row => { result = row; }); worker.once('error', reject);
      worker.once('exit', code => code === 0 && result ? resolve(result) : reject(new Error('owned worker failed')));
    });
  }
  const winners = await Promise.all([contender(contenderA), contender(contenderB)]);
  assert.equal(winners.filter(result => result.created).length, 1);
  const won = Buffer.from(await (await new FileBucket({ root: threadRoot }).get(threadKey)).arrayBuffer());
  assert.deepEqual(won, winners[0].created ? contenderA : contenderB);
  check('independent worker writers: one complete winner, no overwrite');

  const target = join(own, 'owned-target'); fs.mkdirSync(target);
  const alias = join(own, 'alias'); fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => new FileBucket({ root: alias }), /bucket directory unsafe/);
  const attackRoot = join(own, 'attack'), attack = new FileBucket({ root: attackRoot });
  fs.symlinkSync(target, join(attackRoot, 'private'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => attack.put(k, bytes), /bucket directory unsafe/);
  await assert.rejects(() => attack.get(k), /bucket directory unsafe/);
  await assert.rejects(() => attack.list(), /bucket directory unsafe/);
  assert.deepEqual(fs.readdirSync(target), []);
  check('root and namespace symlink/junction rejected without touching target');

  const tampered = await bucket.get(k);
  fs.appendFileSync(disk(k), Buffer.from([0]));
  assert.throws(() => tampered.body, /bucket object changed/);
  check('lazy stream rejects file changed after metadata observation');
  const noFile = Buffer.from('directory-in-object-slot'), nk = key(noFile);
  fs.mkdirSync(disk(nk));
  await assert.rejects(() => bucket.get(nk), /bucket object unsafe/);
  await assert.rejects(() => bucket.put(nk, noFile), /bucket object unsafe/);
  await assert.rejects(() => bucket.list({ prefix: `private/${game}/` }), /bucket object unsafe/);
  check('non-regular object is corruption, never absent or overwritten');
  process.stdout.write(`file bucket: ${checks} groups green (${process.platform}; Linux directory durability still requires Linux execution)\n`);
} finally { fs.rmSync(own, { recursive: true, force: true }); }
