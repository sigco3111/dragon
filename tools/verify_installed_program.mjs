// Owned installation fixtures; never modify the repository's source or bundle.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync, linkSync, symlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyInstalledProgram } from '../vps/installed-program.mjs';
import { buildStaticRelease } from '../vps/static-release.mjs';
const own = mkdtempSync(join(tmpdir(), 'dragon-installed-program-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let checks = 0, sequence = 0;
function fixture() {
  const root = join(own, String(sequence++)), webRoot = join(root, 'web'), bundlePath = join(root, 'trialweb.txt');
  mkdirSync(join(webRoot, 'src', 'game'), { recursive: true }); mkdirSync(join(webRoot, 'intro'));
  const files = [['src/game/rule.js', 'export const rule = "測試";\n'], ['src/main.js', 'import "./game/rule.js";\n'], ['intro/styles.css', 'body {color: black}\n']].map(([path, text]) => {
    writeFileSync(join(webRoot, path), text); return { path, sha256: sha(text), byteLength: Buffer.byteLength(text), text };
  });
  const bundle = { schema: 'dragon-trial-web-bundle-1', fileCount: files.length, files };
  const saveBundle = () => writeFileSync(bundlePath, JSON.stringify(bundle) + '\n'); saveBundle();
  const expectedSourceTreeDigest = buildStaticRelease(files.slice(0, 2).map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))).manifest.sourceTreeDigest;
  return { root, webRoot, bundlePath, expectedSourceTreeDigest, bundle, saveBundle };
}
try {
  const original = fixture(), options = { webRoot: original.webRoot, bundlePath: original.bundlePath, expectedSourceTreeDigest: original.expectedSourceTreeDigest };
  for (const bad of [undefined, {}, { ...options, webRoot: '.' }, { ...options, bundlePath: 'relative' }, { ...options, expectedSourceTreeDigest: 'F'.repeat(64) }, { ...options, expectedSourceTreeDigest: { toString: () => options.expectedSourceTreeDigest } }]) {
    assert.throws(() => verifyInstalledProgram(bad), TypeError); checks++;
  }
  const good = verifyInstalledProgram(options);
  assert.deepEqual(good, { sourceTreeDigest: options.expectedSourceTreeDigest, sourceFiles: 2, bundleFiles: 3 }); assert.ok(Object.isFrozen(good)); checks++;
  assert.deepEqual(verifyInstalledProgram(options), good); checks++;
  for (const mutate of [
    f => { f.expectedSourceTreeDigest = '0'.repeat(64); },
    f => rmSync(join(f.webRoot, 'src/main.js')),
    f => writeFileSync(join(f.webRoot, 'src/extra.js'), 'export const x = 1;'),
    f => writeFileSync(join(f.webRoot, 'src/game/rule.js'), 'changed'),
    f => writeFileSync(join(f.webRoot, 'intro/styles.css'), 'changed'),
    f => rmSync(f.bundlePath),
    f => writeFileSync(f.bundlePath, '{}'),
    f => writeFileSync(f.bundlePath, Buffer.from([0xff])),
    f => writeFileSync(f.bundlePath, '{"broken"'),
    f => { f.bundle.schema = 'other'; f.saveBundle(); },
    f => { f.bundle.fileCount++; f.saveBundle(); },
    f => { f.bundle.extra = true; f.saveBundle(); },
    f => { f.bundle.files.pop(); f.saveBundle(); },
    f => { f.bundle.files[0] = f.bundle.files[1]; f.saveBundle(); },
    f => { f.bundle.files[0].path = '../outside.js'; f.saveBundle(); },
    f => { f.bundle.files[0].text += 'bad'; f.saveBundle(); },
    f => { f.bundle.files[0].sha256 = '0'.repeat(64); f.saveBundle(); },
    f => { f.bundle.files[0].byteLength++; f.saveBundle(); },
    f => { f.bundle.files[0].extra = true; f.saveBundle(); },
    f => { f.bundle.files[0].byteLength = -1; f.saveBundle(); },
    f => { f.bundle.files[0].text = null; f.saveBundle(); },
    f => truncateSync(join(f.webRoot, 'src/main.js'), 25 * 1024 * 1024 + 1),
    f => truncateSync(f.bundlePath, 64 * 1024 * 1024 + 1),
    f => { const path = join(f.webRoot, 'src/main.js'); renameSync(path, join(f.root, 'source')); linkSync(join(f.root, 'source'), path); },
    f => { const path = join(f.webRoot, 'src/game'); renameSync(path, join(f.root, 'linked')); symlinkSync(join(f.root, 'linked'), path, process.platform === 'win32' ? 'junction' : 'dir'); },
    f => { const path = join(f.root, 'web-link'); symlinkSync(f.webRoot, path, process.platform === 'win32' ? 'junction' : 'dir'); f.webRoot = path; },
  ]) {
    const f = fixture(); mutate(f); assert.throws(() => verifyInstalledProgram(f)); checks++;
  }
  // A well-formed alternative bundle is still rejected by the independently
  // configured program pin, not blessed by its internally consistent hashes.
  const changed = fixture(); changed.bundle.files[1].text += '// changed\n';
  const file = changed.bundle.files[1]; file.byteLength = Buffer.byteLength(file.text); file.sha256 = sha(file.text);
  writeFileSync(join(changed.webRoot, file.path), file.text); changed.saveBundle();
  assert.throws(() => verifyInstalledProgram(changed), /INSTALLED_PROGRAM_INVALID/); checks++;
  const realBundle = JSON.parse(readFileSync('server/public/trialweb.txt', 'utf8'));
  const pin = buildStaticRelease(realBundle.files.filter(f => f.path.startsWith('src/') && f.path.endsWith('.js')).map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))).manifest.sourceTreeDigest;
  const installed = verifyInstalledProgram({ webRoot: resolve('web'), bundlePath: resolve('server/public/trialweb.txt'), expectedSourceTreeDigest: pin });
  assert.equal(installed.bundleFiles, realBundle.fileCount); assert.equal(installed.sourceFiles + 1, installed.bundleFiles); checks++;
  process.stdout.write(JSON.stringify({ checks, installed, scope: 'owned filesystem negatives and read-only installed-source/Trial-bundle equality; no loaded-ESM, Linux deployment, compatibility or lazy-resource certificate' }) + '\n');
} finally { rmSync(own, { recursive: true, force: true }); }
