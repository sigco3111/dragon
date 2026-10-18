// Internal registered-program reader. The caller, not this module, decides
// which files may be exposed by an HTTP route (HTML is never an asset route).
import { PROGRAM_REGISTRATION_MAX_BYTES, programRegistrationKey, parseProgramRegistration } from './programregistration.js';
import { STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES, staticAssetPath, staticSourceBytes, parseStaticReleaseShape } from './staticreleaseformat.js';
export const programDigest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
export const sameProgramBytes = (a, b) => a.length === b.length && a.every((byte, index) => byte === b[index]);
const check = value => { if (!value) throw new Error('PROGRAM_ASSET_UNAVAILABLE'); };
export class ProgramFileNotFound extends Error {}
export async function readRegisteredProgramFile({ get, digest, path, signal, maxBytes = 25 * 1024 * 1024 }) {
  if (typeof get !== 'function' || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest) || !staticAssetPath(path) || typeof signal?.throwIfAborted !== 'function' ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 25 * 1024 * 1024)
    throw new TypeError('explicit registered program and owner required');
  const current = () => signal.throwIfAborted();
  async function read(key, maxBytes, contentType) {
    current(); const object = await get(key); current();
    check(object && Number.isSafeInteger(object.size) && object.size >= 0 && object.size <= maxBytes && object.httpMetadata?.contentType === contentType);
    const bytes = new Uint8Array(object.size), stream = object.body.getReader();
    let at = 0, complete = false;
    try {
      while (true) {
        current(); const chunk = await stream.read(); current();
        if (chunk.done) { complete = true; break; }
        check(chunk.value instanceof Uint8Array && chunk.value.length <= bytes.length - at);
        bytes.set(chunk.value, at); at += chunk.value.length;
      }
      check(at === bytes.length); return bytes;
    } finally {
      if (!complete) { try { await stream.cancel(); } catch { /* Preserve original failure. */ } }
      stream.releaseLock();
    }
  }
  const key = programRegistrationKey(digest);
  const registered = await read(key, PROGRAM_REGISTRATION_MAX_BYTES, 'application/json');
  const registration = parseProgramRegistration(registered, digest);
  const base = `artifacts/programs/${digest}/`, manifestKey = base + STATIC_RELEASE_FILE;
  const first = await read(manifestKey, STATIC_RELEASE_MAX_BYTES, 'application/json');
  check(await programDigest(first) === digest); current();
  const manifest = parseStaticReleaseShape(first);
  check(manifest.sourceTreeDigest === registration.sourceTreeDigest &&
    manifest.files.some(file => file.path.startsWith('src/') && file.path.endsWith('.js')) &&
    await programDigest(staticSourceBytes(manifest.files)) === registration.sourceTreeDigest);
  current();
  const file = manifest.files.find(file => file.path === path && file.kind === 'asset');
  if (!file) throw new ProgramFileNotFound();
  check(file.byteLength <= maxBytes);
  const bytes = await read(base + 'files/' + path, file.byteLength, 'application/octet-stream');
  check(bytes.length === file.byteLength && await programDigest(bytes) === file.sha256); current();
  check(sameProgramBytes(first, await read(manifestKey, STATIC_RELEASE_MAX_BYTES, 'application/json')));
  check(sameProgramBytes(registered, await read(key, PROGRAM_REGISTRATION_MAX_BYTES, 'application/json'))); current();
  return Object.freeze({ bytes, manifest });
}
