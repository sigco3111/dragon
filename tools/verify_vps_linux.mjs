// Explicit Linux-only integration. Never run against an operator data directory.
// WSL ext4 is acceptable execution evidence, NOT a VPS/power-loss certificate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir, release } from 'node:os';
import { fork } from 'node:child_process';
import { createServer, request } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { FileBucket } from '../vps/file-bucket.mjs';
import { openStorage } from '../vps/sqlite-port.mjs';
import { buildStaticRelease } from '../vps/static-release.mjs';
assert.equal(process.platform, 'linux', 'must execute on Linux, not simulate process.platform');
assert.notEqual(process.getuid(), 0, 'run as unprivileged user');
assert.equal(process.argv.length, 2, 'no operator paths or other arguments');
const own = fs.mkdtempSync(join(tmpdir(), 'dragon-linux-'));
const fileSystem = fs.statfsSync(own).type;
assert.ok([0xef53, 0x58465342, 0x9123683e, 0x01021994].includes(fileSystem), 'owned temp storage must be a native Linux filesystem, not a Windows mount');
const env = { PATH: process.env.PATH, TMPDIR: own, LANG: 'C.UTF-8' };
let bundle;
try { bundle = JSON.parse(fs.readFileSync('server/public/trialweb.txt', 'utf8')); }
catch (cause) { throw new Error('installed bundle required', { cause }); }
const source = buildStaticRelease(bundle.files.filter(f => f.path.startsWith('src/') && f.path.endsWith('.js')).map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))).manifest.sourceTreeDigest;
const sha = b => createHash('sha256').update(b).digest('hex'), bytes = Buffer.alloc(65537, 71);
const game = '11111111-1111-4111-8111-111111111111', key = `private/${game}/${sha(bytes)}`;
const children = new Set(), checks = [], childRuns = [];
const check = label => { checks.push(label); process.stdout.write('ok ' + label + '\n'); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 30000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'owned child deadline'); await wait(10); }
}
async function freePort() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function directory(name) { const path = join(own, name); fs.mkdirSync(path, { mode: 0o700 }); return path; }
function launch(mode, root, port = 8788) {
  const child = fork(new URL('./fixtures/vps-linux-child.mjs', import.meta.url), [mode, root, String(port), source], { env, execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  children.add(child);
  const messages = [], output = { stdout: '', stderr: '' }; let exit;
  child.stdout.on('data', b => { output.stdout += b; }); child.stderr.on('data', b => { output.stderr += b; });
  child.on('message', value => messages.push(value));
  child.once('exit', (code, signal) => { exit = { code, signal }; children.delete(child); });
  child.once('error', error => { exit = { error: error.message }; });
  return { child, messages, output, get exit() { return exit; }, async phase(name) {
    await until(() => messages.some(m => m.phase === name) || exit);
    assert.ok(messages.some(m => m.phase === name), JSON.stringify({ name, exit, output }));
    return messages.find(m => m.phase === name);
  }, async done(expected) {
    await until(() => exit); assert.deepEqual(exit, expected, JSON.stringify(output));
    for (const marker of ['Owned Linux password only!', 'c'.repeat(64), 'd'.repeat(64)]) assert.ok(!(output.stdout + output.stderr).includes(marker));
    childRuns.push({ mode, exit, messages, stdout: output.stdout, stderr: output.stderr });
  } };
}
function call(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers: { Host: 'owned-editor.invalid' }, ...options }, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('owned HTTP timeout'))); req.end();
  });
}
try {
  for (const mode of ['file-before-link', 'file-after-link']) {
    const root = directory(mode), run = launch(mode, root); await run.phase(mode);
    assert.equal(run.child.kill('SIGKILL'), true); await run.done({ code: null, signal: 'SIGKILL' });
    const bucket = new FileBucket({ root: join(root, 'objects') }), dir = join(root, 'objects', 'private', game);
    const temps = fs.readdirSync(dir).filter(n => n.endsWith('.tmp')); assert.equal(temps.length, 1);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700); assert.equal(fs.statSync(join(dir, temps[0])).mode & 0o777, 0o600);
    const before = await bucket.get(key); assert.equal(before !== null, mode === 'file-after-link');
    if (before) assert.deepEqual(Buffer.from(await before.arrayBuffer()), bytes);
    assert.equal((await bucket.put(key, bytes)) !== null, mode === 'file-before-link');
    assert.deepEqual(Buffer.from(await (await bucket.get(key)).arrayBuffer()), bytes);
    assert.deepEqual(fs.readdirSync(dir).filter(n => n.endsWith('.tmp')), temps, 'retry must not purge another operation temporary');
    assert.deepEqual((await bucket.list()).objects, [{ key, size: bytes.length }]);
    check('SIGKILL ' + mode + ': no partial final, exact retry and orphan preserved');
  }
  const faultRoot = directory('directory-sync'), faultBucket = new FileBucket({ root: faultRoot });
  // Create the namespace first so the injected failure is the final install sync.
  await faultBucket.put(`private/${game}/${sha(Buffer.from('seed'))}`, Buffer.from('seed'));
  const originalSync = fs.fsyncSync;
  fs.fsyncSync = fd => { if (fs.fstatSync(fd).isDirectory()) throw Object.assign(new Error('owned directory sync failure'), { code: 'EINVAL' }); return originalSync(fd); };
  syncBuiltinESMExports();
  try { await assert.rejects(faultBucket.put(key, bytes), /owned directory sync failure/); }
  finally { fs.fsyncSync = originalSync; syncBuiltinESMExports(); }
  assert.deepEqual(Buffer.from(await (await faultBucket.get(key)).arrayBuffer()), bytes);
  assert.equal(await faultBucket.put(key, bytes), null);
  check('Linux directory fsync EINVAL propagates; complete installed object is not falsely rolled back');
  const crashRoot = directory('sqlite'), crashed = launch('sqlite-crash', crashRoot); await crashed.phase('sqlite-crash');
  assert.equal(crashed.child.kill('SIGKILL'), true); await crashed.done({ code: null, signal: 'SIGKILL' });
  const recovered = openStorage(join(crashRoot, 'editor.sqlite'));
  try {
    assert.deepEqual(recovered.sql.exec('SELECT * FROM owned_probe').toArray().map(row => ({ ...row })), [{ id: 1, value: 'committed' }]);
    assert.equal(recovered.sql.exec('PRAGMA integrity_check').toArray()[0].integrity_check, 'ok');
  } finally { recovered.close(); }
  check('real SQLite process crash retains committed row, rolls back open transaction and passes integrity_check');
  for (const bad of ['root-mode', 'database-mode', 'wal-mode', 'shm-mode', 'journal-mode']) {
    const root = directory(bad);
    if (bad === 'root-mode') fs.chmodSync(root, 0o755);
    else {
      const suffix = { 'database-mode': '', 'wal-mode': '-wal', 'shm-mode': '-shm', 'journal-mode': '-journal' }[bad];
      const path = join(root, 'editor.sqlite' + suffix); fs.writeFileSync(path, 'owned unsafe permissions'); fs.chmodSync(path, 0o644);
    }
    const before = fs.readdirSync(root).map(name => [name, sha(fs.readFileSync(join(root, name)))]);
    const run = launch('reject', root); await run.done({ code: 1, signal: null });
    assert.deepEqual(run.messages, [{ event: 'startup-failed' }]);
    assert.deepEqual(fs.readdirSync(root).map(name => [name, sha(fs.readFileSync(join(root, name)))]), before);
    check('private permission rejection preserves existing ' + bad);
  }
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const root = directory(signal), port = await freePort(), run = launch('publication', root, port);
    await run.phase('ready'); assert.equal((await call(port, '/api/health')).status, 200);
    assert.equal((await call(port, '/play')).status, 503);
    for (const name of fs.readdirSync(root).filter(n => n.startsWith('editor.sqlite'))) {
      const stat = fs.statSync(join(root, name)); assert.equal(stat.mode & 0o777, 0o600); assert.equal(stat.uid, process.getuid()); assert.equal(stat.nlink, 1);
    }
    assert.equal(fs.statSync(join(root, 'private-objects')).mode & 0o777, 0o700);
    const body = JSON.stringify({ account: 'nonexistent-owned-user', password: 'Owned rejected login only!' });
    let pending;
    const reply = new Promise((resolve, reject) => {
      pending = request({ hostname: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers: {
        Host: 'owned-editor.invalid', Origin: 'https://owned-editor.invalid', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Idempotency-Key': randomUUID(), Connection: 'close',
      } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      pending.on('error', reject); pending.setTimeout(10000, () => pending.destroy(new Error('owned pending request timeout'))); pending.write(body.slice(0, 1));
    });
    await run.phase('request-accepted'); assert.equal(run.child.kill(signal), true); await run.phase('signal-observed');
    await wait(100); assert.equal(run.exit, undefined); assert.ok(!run.messages.some(m => m.event === 'stopped'));
    pending.end(body.slice(1)); assert.equal(await reply, 401, 'accepted login still has working SQLite during shutdown');
    await run.done({ code: 0, signal: null });
    assert.equal(run.messages.filter(m => m.event === 'stopped').length, 1);
    await assert.rejects(call(port, '/api/health'), { code: 'ECONNREFUSED' });
    const db = openStorage(join(root, 'editor.sqlite'));
    try { assert.equal(db.sql.exec('PRAGMA integrity_check').toArray()[0].integrity_check, 'ok'); assert.ok(db.sql.exec('SELECT * FROM login_rates').toArray().length > 0); }
    finally { db.close(); }
    check(signal + ' waits for accepted HTTP/SQL work, exits cleanly and preserves private modes under umask 000');
  }
  const earlyRoot = directory('early'), early = launch('early', earlyRoot, await freePort());
  await early.phase('preflight-held'); assert.equal(early.child.kill('SIGTERM'), true); await early.phase('signal-observed');
  assert.equal(early.exit, undefined); early.child.send({ release: true }); await early.done({ code: 0, signal: null });
  assert.deepEqual(early.messages.filter(m => m.event), [{ event: 'stopped' }]);
  check('real SIGTERM during held startup is remembered; no started claim and no surviving monitor/listener');
  for (const mode of ['archive-source', 'archive-put']) for (const signal of ['SIGTERM', 'SIGINT']) {
    const root = directory(mode + '-' + signal), port = await freePort(), run = launch(mode, root, port);
    const held = await run.phase('archive-held'), expectedObjects = mode === 'archive-put' ? 1 : 0;
    assert.equal(held.objects, expectedObjects); assert.equal(held.manifest, false);
    assert.deepEqual(fs.readdirSync(root), []);
    await assert.rejects(call(port, '/api/health'), { code: 'ECONNREFUSED' });
    assert.equal(run.child.kill(signal), true); await run.phase('signal-observed');
    await wait(100); assert.equal(run.exit, undefined); assert.ok(!run.messages.some(m => m.event));
    run.child.send({ release: true }); await run.done({ code: 0, signal: null });
    assert.deepEqual(run.messages.filter(m => m.event), [{ event: 'stopped' }]);
    const final = await run.phase('archive-final');
    assert.equal(final.objects, expectedObjects); assert.equal(final.manifest, false);
    assert.equal(final.additionalRequests, 0); assert.equal(final.controlGets, 0); assert.equal(final.servers, 0);
    assert.deepEqual(fs.readdirSync(root), []);
    await assert.rejects(call(port, '/api/health'), { code: 'ECONNREFUSED' });
    check(signal + ' during ' + mode + ': wait for bounded response, retain exact committed bytes, no database/listener/follow-up IO');
  }
  for (const changed of ['root-mode', 'database-mode', 'root-symlink']) {
    const root = directory('archive-' + changed), port = await freePort(), run = launch('archive-recheck', root, port);
    const held = await run.phase('archive-held'); assert.equal(held.manifest, true); assert.ok(held.objects > 200);
    assert.deepEqual(fs.readdirSync(root), []);
    let target, parked;
    if (changed === 'root-mode') fs.chmodSync(root, 0o755);
    else if (changed === 'database-mode') {
      fs.writeFileSync(join(root, 'editor.sqlite'), 'owned late unsafe database', { mode: 0o644 });
      fs.chmodSync(join(root, 'editor.sqlite'), 0o644);
    } else {
      parked = root + '-parked'; fs.renameSync(root, parked);
      target = directory('archive-owned-target'); fs.writeFileSync(join(target, 'sentinel'), 'owned untouched target');
      fs.symlinkSync(target, root);
    }
    const before = fs.readdirSync(root).map(name => [name, sha(fs.readFileSync(join(root, name)))]);
    run.child.send({ release: true }); await run.done({ code: 1, signal: null });
    assert.deepEqual(run.messages.filter(m => m.event), [{ event: 'startup-failed' }]);
    const final = await run.phase('archive-final');
    assert.equal(final.objects, held.objects); assert.equal(final.objects, final.expectedObjects); assert.equal(final.manifest, true);
    assert.equal(final.additionalRequests, 1, 'only the final manifest readback may follow the held PUT');
    assert.equal(final.controlGets, 0); assert.equal(final.servers, 0);
    assert.deepEqual(fs.readdirSync(root).map(name => [name, sha(fs.readFileSync(join(root, name)))]), before);
    if (changed === 'root-mode') assert.equal(fs.statSync(root).mode & 0o777, 0o755);
    if (changed === 'database-mode') assert.equal(fs.statSync(join(root, 'editor.sqlite')).mode & 0o777, 0o644);
    if (changed === 'root-symlink') { assert.equal(fs.readlinkSync(root), target); assert.deepEqual(fs.readdirSync(parked), []); }
    await assert.rejects(call(port, '/api/health'), { code: 'ECONNREFUSED' });
    check('after archive await, changed ' + changed + ' refuses before private writes/preflight/listen; complete archive is retained');
  }
  process.stdout.write(JSON.stringify({ checks, childRuns, node: process.version, kernel: release(), fileSystem, sourceTreeDigest: source,
    scope: 'Unprivileged Linux owned temp files, real OS signals/SQLite/loopback HTTP. HTTPS static/archive and empty-root seams only. No power loss, remote R2, VPS, TLS, container or deployment certificate.' }) + '\n');
} finally {
  for (const child of children) child.kill('SIGKILL');
  await until(() => children.size === 0);
  fs.rmSync(own, { recursive: true, force: true });
}
