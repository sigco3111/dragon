// PORTRAIT-DECODE-JOB-1: Windows kernel resource-limit probe, test-only.
// Native committed memory/user-CPU limits are NOT RSS or permission isolation.
// No production hookup, cloud resource, deployment, real image/profile/save.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { decodePNG, encodePNG } from '../server/pngio.js';
import { decodePortraitJPEG, decodeTrialPortraitJPEG } from '../server/portraitjpeg.js';
assert.equal(process.platform, 'win32', 'Windows Job Object probe only');
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/portrait-decode-job-r1'; mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = ['tools/verify_portrait_decode_job.mjs', 'tools/fixtures/portrait_decode_job.cs', 'tools/fixtures/portrait_decode_job.ps1', 'tools/fixtures/portrait_decode_job_child.mjs', 'server/pngio.js', 'server/portraitjpeg.js', 'server/vendor/jpeg-js/decoder.js'];
const pins = {};
for (const [index, name] of inputs.entries()) { const bytes = readFileSync(name); pins[name] = sha(bytes); writeFileSync(`${out}/input-${index}.txt`, bytes, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const env = {};
for (const [key, value] of Object.entries(process.env)) { if (['path', 'systemroot', 'windir', 'temp', 'tmp'].includes(key.toLowerCase())) { env[key] = value; } }
const checks = [], cases = [];
const check = name => { checks.push(name); process.stdout.write(`${name}\n`); };
const parse = text => { try { return JSON.parse(text); } catch (error) { throw new Error('Invalid probe JSON', { cause: error }); } };
const pattern = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) pattern.set([(x * 3) & 240, (y * 5) & 240, (x + y) & 240, 255], (y * 128 + x) * 4);
const pngBytes = Buffer.from(encodePNG(pattern, 128, 128));
writeFileSync(`${out}/source.png`, pngBytes, { flag: 'wx' });
const generate = spawnSync('python', ['-B', '-c', `from PIL import Image\nimg=Image.new('RGB',(128,128))\npx=img.load()\nfor y in range(128):\n    for x in range(128):\n        px[x,y]=((x*3)&240,(y*5)&240,200)\nimg.save('${out}/source.jpg',quality=90)\nImage.new('RGBA',(2048,2048),(20,40,60,255)).save('${out}/max.png')\nImage.new('RGB',(8192,2),(128,128,128)).save('${out}/max.jpg',quality=90)`], { env: { ...env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' }, encoding: 'utf8', timeout: 60000 });
writeFileSync(`${out}/generate.log`, (generate.stdout ?? '') + (generate.stderr ?? ''), { flag: 'wx' });
assert.equal(generate.status, 0, generate.stderr);
let counter = 0;
function run(name, request, { memoryBytes = 512 * 1024 * 1024, cpuSeconds = 5, wallMs = 15000, node = process.execPath } = {}) {
  assert.match(name, /^[a-z0-9-]+$/);
  const dir = `${out}/case-${++counter}-${name}`; mkdirSync(dir);
  writeFileSync(`${dir}/stdin.json`, JSON.stringify(request), { flag: 'wx' });
  const command = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', resolve('tools/fixtures/portrait_decode_job.ps1'), '-NodePath', node, '-ChildPath', resolve('tools/fixtures/portrait_decode_job_child.mjs'), '-InputPath', resolve(`${dir}/stdin.json`), '-OutputPath', resolve(`${dir}/stdout.txt`), '-ErrorPath', resolve(`${dir}/stderr.txt`), '-ReportPath', resolve(`${dir}/job.json`), '-WorkingDirectory', resolve('.'), '-MemoryBytes', String(memoryBytes), '-CpuSeconds', String(cpuSeconds), '-WallMs', String(wallMs)], { env, encoding: 'utf8', timeout: wallMs + 20000, maxBuffer: 1024 * 1024 });
  writeFileSync(`${dir}/launcher.json`, JSON.stringify({ status: command.status, signal: command.signal, error: String(command.error ?? ''), stdout: command.stdout, stderr: command.stderr }, null, 2), { flag: 'wx' });
  if (command.status !== 0 || command.error) { return { launcherFailed: true, dir }; }
  const report = parse(readFileSync(`${dir}/job.json`, 'utf8'));
  assert.equal(report.assignedBeforeResume, true); assert.equal(report.limitFlags, 0x2304);
  assert.equal(report.memoryBytes, memoryBytes); assert.equal(report.cpuSeconds, cpuSeconds); assert.equal(report.wallMs, wallMs);
  assert.equal(report.activeAfterCleanup, 0);
  assert.ok(report.peakProcessCommitBytes <= memoryBytes); assert.ok(report.peakJobCommitBytes <= memoryBytes);
  assert.equal(report.rssHardCap, false); assert.equal(report.permissionSandbox, false); assert.equal(report.productionInstalled, false);
  assert.ok(statSync(`${dir}/stdout.txt`).size <= 32 * 1024 * 1024);
  const result = { launcherFailed: false, dir, report, stdout: readFileSync(`${dir}/stdout.txt`, 'utf8'), stderr: readFileSync(`${dir}/stderr.txt`, 'utf8') };
  cases.push({ name, dir, report, stdoutSha256: sha(Buffer.from(result.stdout)), stderrSha256: sha(Buffer.from(result.stderr)) });
  return result;
}
function pixels(result) {
  assert.equal(result.launcherFailed, false); assert.equal(result.report.wallKilled, false); assert.equal(result.report.exitCode, 0);
  const data = parse(result.stdout);
  if (data.ok !== true) { throw new Error('Decoder did not succeed'); }
  assert.ok(Number.isSafeInteger(data.width) && data.width > 0 && data.width <= 8192);
  assert.ok(Number.isSafeInteger(data.height) && data.height > 0 && data.height <= 8192);
  assert.ok(data.width * data.height <= 4 * 1024 * 1024);
  assert.equal(typeof data.pixels, 'string');
  const bytes = Buffer.from(data.pixels, 'base64'); assert.equal(bytes.toString('base64'), data.pixels); assert.equal(bytes.length, data.width * data.height * 4);
  return { width: data.width, height: data.height, pixels: bytes };
}
const jpegBytes = readFileSync(`${out}/source.jpg`);
for (const [kind, bytes, decode] of [['png', pngBytes, decodePNG], ['trial-jpeg', jpegBytes, decodeTrialPortraitJPEG], ['game-jpeg', jpegBytes, decodePortraitJPEG], ['png', readFileSync(`${out}/max.png`), decodePNG], ['trial-jpeg', readFileSync(`${out}/max.jpg`), decodeTrialPortraitJPEG]]) {
  assert.ok(bytes.length <= 100 * 1024);
  const native = pixels(run(`${kind}-exact`, { kind, bytes: bytes.toString('base64') })), direct = decode(bytes);
  assert.equal(native.width, direct.width); assert.equal(native.height, direct.height); assert.ok(native.pixels.equals(Buffer.from(direct.pixels)));
  check(`${kind}-${native.width}x${native.height}-kernel-job-shared-codec-exact`);
}
for (const [kind, bytes, errorClass] of [['png', pngBytes, 'PNGError'], ['trial-jpeg', jpegBytes, 'PortraitJPEGError']]) {
  const result = run(`${kind}-corrupt`, { kind, bytes: bytes.subarray(0, 200).toString('base64') });
  assert.equal(result.launcherFailed, false); assert.equal(result.report.exitCode, 0);
  const data = parse(result.stdout); assert.equal(data.ok, false); assert.equal(data.errorClass, errorClass);
  check(`${kind}-corrupt-class-preserved`);
}
const memory = run('memory', { fault: 'memory' }, { memoryBytes: 96 * 1024 * 1024, wallMs: 15000 });
assert.equal(memory.launcherFailed, false); assert.equal(memory.report.wallKilled, false); assert.notEqual(memory.report.exitCode, 0);
assert.ok(memory.stdout.includes('MEMORY_PROBE_READY')); assert.match(memory.stderr, /ERR_MEMORY_ALLOCATION_FAILED|allocation failed|out of memory|ENOMEM/i);
assert.ok(memory.report.peakJobCommitBytes > 32 * 1024 * 1024);
check('native-external-buffer-commit-limit-denies-allocation');
const memoryControl = run('memory-control', { fault: 'memory' }, { memoryBytes: 192 * 1024 * 1024, wallMs: 15000 });
assert.equal(memoryControl.launcherFailed, false); assert.equal(memoryControl.report.wallKilled, false); assert.notEqual(memoryControl.report.exitCode, 0);
assert.match(memoryControl.stderr, /ERR_MEMORY_ALLOCATION_FAILED|allocation failed|out of memory|ENOMEM/i);
assert.ok(memoryControl.report.peakJobCommitBytes > memory.report.peakJobCommitBytes + 48 * 1024 * 1024);
check('same-native-allocation-fault-tracks-two-kernel-memory-caps');
const cpu = run('cpu', { fault: 'cpu' }, { cpuSeconds: 1, wallMs: 15000 });
assert.equal(cpu.launcherFailed, false); assert.equal(cpu.report.wallKilled, false);
assert.equal(cpu.report.exitCode, 0xC0000044, 'STATUS_QUOTA_EXCEEDED, not an arbitrary crash');
assert.ok(cpu.stdout.includes('CPU_PROBE_READY')); assert.ok(cpu.report.userCpu100ns >= 8000000);
assert.ok(cpu.report.elapsedMs < 15000);
check('kernel-user-cpu-budget-terminates-busy-loop-before-wall');
const wall = run('wall', { fault: 'wall' }, { wallMs: 1000 });
assert.equal(wall.launcherFailed, false); assert.equal(wall.report.wallKilled, true); assert.equal(wall.report.exitCode, 0xE001);
assert.ok(wall.stdout.includes('WALL_PROBE_READY'));
check('wall-deadline-terminates-whole-owned-job');
const descendant = run('descendant', { fault: 'descendant' });
assert.equal(descendant.launcherFailed, false); assert.equal(descendant.report.exitCode, 0);
assert.ok(parse(descendant.stdout).descendantPid > 0); assert.equal(parse(descendant.stdout).descendantReady, true);
assert.ok(descendant.report.totalProcesses >= 2);
assert.ok(descendant.report.activeBeforeCleanup >= 1); assert.equal(descendant.report.activeAfterCleanup, 0);
check('inherited-descendant-membership-and-zero-survivors');
for (const fault of ['crash', 'bad-reply']) {
  const result = run(fault, { fault });
  assert.throws(() => pixels(result)); check(`${fault}-protocol-fails-without-direct-fallback`);
}
const missing = run('missing-node', { kind: 'png', bytes: pngBytes.toString('base64') }, { node: resolve(out, 'missing-node.exe') });
assert.equal(missing.launcherFailed, true); assert.throws(() => pixels(missing));
check('native-create-process-failure-no-uncontained-fallback');
const invalid = run('invalid-budget', {}, { memoryBytes: 0 });
assert.equal(invalid.launcherFailed, true); check('invalid-resource-budget-rejected');
assert.ok(pixels(run('after-failures', { kind: 'png', bytes: pngBytes.toString('base64') })).pixels.equals(Buffer.from(pattern)));
check('parent-remains-healthy-and-next-job-decodes');
for (const name of inputs) { assert.equal(sha(readFileSync(name)), pins[name], `Input drift: ${name}`); }
writeFileSync(`${out}/receipt.json`, JSON.stringify({ checks, cases, pins, productionOSIsolationPassed: false, hardRSSVerified: false, nativeCommittedMemoryVerified: true, nativeUserCPUVerified: true, permissionSandboxVerified: false, limitations: 'Windows Job Object test-only; limits read back before CREATE_SUSPENDED child resumes. Native committed memory (not RSS), total user CPU (periodically checked by Windows, measured overshoot retained; not an exact cutoff, kernel CPU or cloud SLA); no filesystem/network sandbox. No Worker hookup, no cloud deployment, shared-codec parity not independent color certification. All images synthetic; frozen old assets not accessed.' }, null, 2), { flag: 'wx' });
process.stdout.write(`Windows decode Job PROBE PASS ${checks.length} checks / ${cases.length} native jobs\n`);
