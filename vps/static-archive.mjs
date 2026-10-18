// Trusted software-package staging, not publication/admission or a compatibility
// certificate. No mutable pointer, overwrite, expiry, deletion or default fetch.
import { createHash } from 'node:crypto';
import { parseStaticRelease, STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES } from './static-release.mjs';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = value => { if (!value) throw new Error('STATIC_ARCHIVE_INVALID'); };

export function createStaticArchiver({ r2, readStatic, expectedDigest, sourceTreeDigest, maxTotalBytes, prefix = '' } = {}) {
  if (typeof r2?.get !== 'function' || typeof r2?.putImmutable !== 'function' ||
      typeof readStatic !== 'function' || !digest(expectedDigest) || !digest(sourceTreeDigest) ||
      !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1 ||
      typeof prefix !== 'string' || !(prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)))
    throw new TypeError('trusted immutable bucket, bounded source port and explicit build/source/budget pins required');
  const get = r2.get.bind(r2), put = r2.putImmutable.bind(r2);
  const base = `${prefix}artifacts/programs/${expectedDigest}/`, manifestKey = base + STATIC_RELEASE_FILE;
  return Object.freeze({ async stage(assertCurrent) {
    if (typeof assertCurrent !== 'function' || assertCurrent.constructor?.name === 'AsyncFunction')
      throw new TypeError('synchronous owner assertion required');
    const current = () => { if (assertCurrent() !== undefined) throw new TypeError('owner assertion must return undefined'); };
    async function source(path, maxBytes) {
      current(); const value = await readStatic(path, { maxBytes }); current();
      check(value instanceof Uint8Array && value.length <= maxBytes);
      return Buffer.from(value);
    }
    async function stored(key, bytes, contentType) {
      current(); const value = await get(key, { maxBytes: Math.max(1, bytes.length) }); current();
      if (value === null) return false;
      check(value?.bytes instanceof Uint8Array);
      const copy = Buffer.from(value.bytes);
      const types = Object.entries(value.headers ?? {}).filter(([name]) => name.toLowerCase() === 'content-type');
      check(types.length === 1 && types[0][1] === contentType && copy.equals(bytes));
      return true;
    }
    async function install(key, bytes, type) {
      // An existing different object is a collision, not permission to repair it.
      if (await stored(key, bytes, type)) return;
      current();
      try { await put(key, Buffer.from(bytes), type); }
      catch { /* Lost response is decided only by exact bounded readback. */ }
      current(); check(await stored(key, bytes, type));
    }
    const first = await source(STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES);
    const release = parseStaticRelease(first, expectedDigest);
    check(release.sourceTreeDigest === sourceTreeDigest && release.files.some(file => file.path.startsWith('src/') && file.path.endsWith('.js')));
    const files = release.files.filter(file => file.kind === 'asset');
    let total = first.length;
    for (const file of files) { check(file.byteLength <= maxTotalBytes - total); total += file.byteLength; }
    check(total <= maxTotalBytes);
    for (const file of files) {
      const bytes = await source(file.path, Math.max(1, file.byteLength));
      check(bytes.length === file.byteLength && hash(bytes) === file.sha256);
      // Exact transport bytes, not guessed HTTP MIME. A future serving adapter
      // must supply its own trusted content-type and execution/path policy.
      await install(base + 'files/' + file.path, bytes, 'application/octet-stream');
    }
    check((await source(STATIC_RELEASE_FILE, first.length)).equals(first));
    // Recheck the complete remote asset set before installing the manifest last.
    for (const file of files) {
      current(); const value = await get(base + 'files/' + file.path, { maxBytes: Math.max(1, file.byteLength) }); current();
      check(value?.bytes instanceof Uint8Array);
      const bytes = Buffer.from(value.bytes);
      check(bytes.length === file.byteLength && hash(bytes) === file.sha256);
      const types = Object.entries(value.headers ?? {}).filter(([name]) => name.toLowerCase() === 'content-type');
      check(types.length === 1 && types[0][1] === 'application/octet-stream');
    }
    await install(manifestKey, first, 'application/json');
    current();
    return Object.freeze({ releaseDigest: expectedDigest, sourceTreeDigest, manifestKey,
      filesVerified: files.length, bytesVerified: total });
  } });
}
