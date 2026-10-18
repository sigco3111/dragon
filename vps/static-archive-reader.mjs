// Caller-pinned software bytes only. No HTTP serving, admission, mutable head,
// default transport, writes or inference that a missing object means deletion.
import { createHash } from 'node:crypto';
import { parseStaticRelease, STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES } from './static-release.mjs';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pathValid = path => typeof path === 'string' && path.length <= 512 &&
  /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(path) &&
  path.split('/').every(part => part.length > 0 && !part.startsWith('.'));
const check = value => { if (!value) throw new Error('STATIC_ARCHIVE_READ_INVALID'); };

export function createStaticArchiveReader({ r2, expectedDigest, sourceTreeDigest, assertCurrent, prefix = '' } = {}) {
  if (typeof r2?.get !== 'function' || !digest(expectedDigest) || !digest(sourceTreeDigest) ||
      typeof assertCurrent !== 'function' || assertCurrent.constructor?.name === 'AsyncFunction' ||
      typeof prefix !== 'string' || !(prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)))
    throw new TypeError('read-only bucket, trusted build/source pins and synchronous owner assertion required');
  const get = r2.get.bind(r2), base = `${prefix}artifacts/programs/${expectedDigest}/`;
  const current = () => { if (assertCurrent() !== undefined) throw new TypeError('owner assertion must return undefined'); };
  async function bytes(key, maxBytes, type) {
    current(); const result = await get(key, { maxBytes }); current();
    check(result?.bytes instanceof Uint8Array && result.bytes.length <= maxBytes);
    const copy = Buffer.from(result.bytes);
    const types = Object.entries(result.headers ?? {}).filter(([name]) => name.toLowerCase() === 'content-type');
    check(types.length === 1 && types[0][1] === type);
    return copy;
  }
  return async function readStatic(path, { maxBytes } = {}) {
    if (!pathValid(path) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 25 * 1024 * 1024)
      throw new TypeError('canonical package path and bounded byte budget required');
    current();
    const manifestKey = base + STATIC_RELEASE_FILE;
    const first = await bytes(manifestKey, path === STATIC_RELEASE_FILE ? Math.min(maxBytes, STATIC_RELEASE_MAX_BYTES) : STATIC_RELEASE_MAX_BYTES, 'application/json');
    const release = parseStaticRelease(first, expectedDigest);
    check(release.sourceTreeDigest === sourceTreeDigest && release.files.some(file => file.path.startsWith('src/') && file.path.endsWith('.js')));
    if (path === STATIC_RELEASE_FILE) { current(); return first; }
    const file = release.files.find(entry => entry.path === path);
    // Membership, not caller-controlled path concatenation, grants the GET.
    // Deployment configuration is never an archive asset, even if seeded there.
    check(file?.kind === 'asset' && file.byteLength <= maxBytes);
    const value = await bytes(base + 'files/' + file.path, Math.max(1, file.byteLength), 'application/octet-stream');
    check(value.length === file.byteLength && hash(value) === file.sha256);
    // No cached success: removal/change during the asset await also fails closed.
    check((await bytes(manifestKey, first.length, 'application/json')).equals(first));
    current(); return value;
  };
}
