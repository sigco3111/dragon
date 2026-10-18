// Trusted software registration format. A valid shape alone is NOT authority:
// readers must obtain it from the operator-only control key, never a client or
// an arbitrary archive object. No game identity, admission or compatibility grant.
export const PROGRAM_REGISTRATION_MAX_BYTES = 512;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const schema = 'dragon-program-registration-1';
const fail = () => { throw new TypeError('PROGRAM_REGISTRATION_INVALID'); };
export function programRegistrationKey(releaseDigest) {
  if (!digest(releaseDigest)) fail();
  return `control/programs/${releaseDigest}.json`;
}
export function programRegistrationBytes(releaseDigest, sourceTreeDigest) {
  if (!digest(releaseDigest) || !digest(sourceTreeDigest)) fail();
  return new TextEncoder().encode(JSON.stringify({ schema, releaseDigest, sourceTreeDigest }));
}
export function parseProgramRegistration(input, expectedDigest) {
  if (!(input instanceof Uint8Array) || input.length < 1 || input.length > PROGRAM_REGISTRATION_MAX_BYTES || !digest(expectedDigest)) fail();
  const bytes = new Uint8Array(input);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(); }
  if (!value || value.schema !== schema || value.releaseDigest !== expectedDigest) fail();
  const canonical = programRegistrationBytes(value.releaseDigest, value.sourceTreeDigest);
  if (canonical.length !== bytes.length || !canonical.every((byte, index) => bytes[index] === byte)) fail();
  return Object.freeze(value);
}
