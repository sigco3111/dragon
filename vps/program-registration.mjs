// Operator software installation only. Call AFTER the pinned full archive and
// installation checks. Not part of an author's content publication transaction.
import { programRegistrationKey, programRegistrationBytes, parseProgramRegistration, PROGRAM_REGISTRATION_MAX_BYTES } from '../reader/programregistration.js';
export async function registerStaticProgram({ r2, releaseDigest, sourceTreeDigest, prefix = '', assertCurrent } = {}) {
  if (typeof r2?.get !== 'function' || typeof r2?.putImmutable !== 'function' ||
      typeof assertCurrent !== 'function' || assertCurrent.constructor?.name === 'AsyncFunction' ||
      typeof prefix !== 'string' || !(prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)))
    throw new TypeError('trusted software registration ports required');
  const bytes = programRegistrationBytes(releaseDigest, sourceTreeDigest), key = prefix + programRegistrationKey(releaseDigest);
  const get = r2.get.bind(r2), put = r2.putImmutable.bind(r2);
  const current = () => { if (assertCurrent() !== undefined) throw new TypeError('synchronous owner assertion required'); };
  async function read() {
    current(); const object = await get(key, { maxBytes: PROGRAM_REGISTRATION_MAX_BYTES }); current();
    if (object === null) return null;
    const types = Object.entries(object?.headers ?? {}).filter(([name]) => name.toLowerCase() === 'content-type');
    if (types.length !== 1 || types[0][1] !== 'application/json') throw new Error('PROGRAM_REGISTRATION_INVALID');
    const value = parseProgramRegistration(object.bytes, releaseDigest);
    if (value.sourceTreeDigest !== sourceTreeDigest) throw new Error('PROGRAM_REGISTRATION_CONFLICT');
    return value;
  }
  const existing = await read();
  if (existing) return existing;
  current();
  try { await put(key, new Uint8Array(bytes), 'application/json'); }
  catch { /* A lost response is resolved only by exact bounded readback. */ }
  current();
  const installed = await read();
  if (!installed) throw new Error('PROGRAM_REGISTRATION_UNAVAILABLE');
  return installed;
}
