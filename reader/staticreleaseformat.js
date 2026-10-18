// Portable canonical inventory SHAPE only. Callers must independently verify
// both the complete-byte digest and source-tree digest; this is not authority.
export const STATIC_RELEASE_FILE = 'static-release.json';
export const STATIC_RELEASE_MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const configuration = new Set(['_headers', '_redirects']);
function fail() { throw new Error('STATIC_RELEASE_INVALID'); }
function fields(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail();
}
export function staticAssetPath(path) {
  return typeof path === 'string' && path.length <= 512 &&
    /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(path) &&
    path.split('/').every(part => part.length > 0 && !part.startsWith('.')) &&
    path.toLowerCase() !== STATIC_RELEASE_FILE;
}
export function staticReleaseFiles(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 20000) fail();
  const seen = new Set();
  return Object.freeze(entries.map(entry => {
    fields(entry, ['path', 'byteLength', 'sha256']);
    const { path, byteLength, sha256 } = entry;
    if (!staticAssetPath(path) || !Number.isSafeInteger(byteLength) || byteLength < 0 ||
        byteLength > MAX_FILE_BYTES || !digest(sha256) || seen.has(path.toLowerCase())) fail();
    seen.add(path.toLowerCase());
    return Object.freeze({ path, byteLength, sha256, kind: configuration.has(path) ? 'configuration' : 'asset' });
  }).sort((a, b) => {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  }));
}
export function staticSourceBytes(files) {
  return new TextEncoder().encode(JSON.stringify(files.filter(file => file.path.startsWith('src/') && file.path.endsWith('.js'))));
}
export function staticManifest(files, sourceTreeDigest) {
  if (!digest(sourceTreeDigest)) fail();
  return Object.freeze({ version: 1, sourceTreeDigest, files });
}
export function parseStaticReleaseShape(input) {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > STATIC_RELEASE_MAX_BYTES) fail();
  const bytes = new Uint8Array(input);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(); }
  fields(value, ['version', 'sourceTreeDigest', 'files']);
  if (value.version !== 1 || !digest(value.sourceTreeDigest) || !Array.isArray(value.files) || value.files.length > 20000) fail();
  const files = staticReleaseFiles(value.files.map(file => {
    fields(file, ['path', 'byteLength', 'sha256', 'kind']);
    if (file.kind !== (configuration.has(file.path) ? 'configuration' : 'asset')) fail();
    return { path: file.path, byteLength: file.byteLength, sha256: file.sha256 };
  }));
  const manifest = staticManifest(files, value.sourceTreeDigest);
  const canonical = new TextEncoder().encode(JSON.stringify(manifest));
  if (canonical.length !== bytes.length || !canonical.every((byte, index) => bytes[index] === byte)) fail();
  return manifest;
}
