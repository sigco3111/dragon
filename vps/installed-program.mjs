// Startup measurement of installed Web sources and the actual Trial bundle.
// Not a running-module attestation, import/lazy-asset closure or compatibility
// certificate. Installation files must remain immutable while the process runs.
import { lstatSync, readdirSync, openSync, closeSync, fstatSync, readFileSync, constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { buildStaticRelease } from './static-release.mjs';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = value => { if (!value) throw new Error('INSTALLED_PROGRAM_INVALID'); };
function fields(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
function directory(path) { const value = lstatSync(path); check(value.isDirectory() && !value.isSymbolicLink()); }
function bytes(path, maxBytes) {
  const named = lstatSync(path); check(named.isFile() && !named.isSymbolicLink() && named.nlink === 1 && named.size <= maxBytes);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = fstatSync(fd); check(before.isFile() && before.nlink === 1 && before.size <= maxBytes && before.dev === named.dev && before.ino === named.ino);
    const value = readFileSync(fd); check(value.length === before.size);
    const after = fstatSync(fd), last = lstatSync(path);
    check(after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs && last.isFile() && !last.isSymbolicLink() && last.dev === before.dev && last.ino === before.ino && last.nlink === 1);
    return value;
  } finally { closeSync(fd); }
}
export function verifyInstalledProgram({ webRoot, bundlePath, expectedSourceTreeDigest } = {}) {
  if (typeof webRoot !== 'string' || !isAbsolute(webRoot) || typeof bundlePath !== 'string' || !isAbsolute(bundlePath) || typeof expectedSourceTreeDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSourceTreeDigest))
    throw new TypeError('explicit installed roots and trusted source-tree pin required');
  directory(webRoot); directory(join(webRoot, 'src')); directory(join(webRoot, 'intro'));
  function paths() {
    const out = [];
    function walk(relative) {
      for (const name of readdirSync(join(webRoot, relative)).sort()) {
        check(/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name) && !name.includes('..'));
        const path = relative + '/' + name, value = lstatSync(join(webRoot, path));
        check(!value.isSymbolicLink());
        if (value.isDirectory()) walk(path);
        else { check(value.isFile()); if (name.endsWith('.js')) { out.push(path); check(out.length <= 19999); } }
      }
    }
    walk('src'); check(out.length > 0); return out.sort();
  }
  const sources = paths(), expectedPaths = [...sources, 'intro/styles.css'];
  const bundleBytes = bytes(bundlePath, 64 * 1024 * 1024);
  let bundle;
  try { bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bundleBytes)); }
  catch { throw new Error('INSTALLED_PROGRAM_INVALID'); }
  fields(bundle, ['schema', 'fileCount', 'files']);
  check(bundle.schema === 'dragon-trial-web-bundle-1' && Array.isArray(bundle.files) && bundle.fileCount === expectedPaths.length && bundle.files.length === expectedPaths.length);
  const entries = []; let total = 0;
  for (let index = 0; index < expectedPaths.length; index++) {
    const file = bundle.files[index]; fields(file, ['path', 'sha256', 'byteLength', 'text']);
    check(file.path === expectedPaths[index] && typeof file.text === 'string' && Number.isSafeInteger(file.byteLength) && file.byteLength >= 0);
    const source = bytes(join(webRoot, file.path), 25 * 1024 * 1024);
    total += source.length; check(total <= 64 * 1024 * 1024);
    check(source.length === file.byteLength && sha(source) === file.sha256 && Buffer.from(file.text, 'utf8').equals(source));
    if (file.path.startsWith('src/')) entries.push({ path: file.path, byteLength: source.length, sha256: file.sha256 });
  }
  const sourceTreeDigest = buildStaticRelease(entries).manifest.sourceTreeDigest;
  check(sourceTreeDigest === expectedSourceTreeDigest && JSON.stringify(paths()) === JSON.stringify(sources));
  check(bytes(bundlePath, bundleBytes.length).equals(bundleBytes));
  return Object.freeze({ sourceTreeDigest, sourceFiles: sources.length, bundleFiles: bundle.fileCount });
}
