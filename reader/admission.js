// Stateless bearer capability, held only by the running page. It authorizes
// fixed resources, NOT a fresh new-game/restore admission. No TTL silently kills
// an old game: retain verification keys and immutable bytes until explicit policy
// changes. This is not DRM against replay of already admitted public content.
import { isId, isChapterId, parseJSON, requireValue, validateRuntimeReference } from './runtimecontract.js';
const encoder = new TextEncoder();
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function decode(value) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), 'ADMISSION_INVALID');
  const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  requireValue(base64url(bytes) === value, 'ADMISSION_INVALID');
  return bytes;
}
function configuration(env, origin) {
  requireValue(typeof env.PLAYER_ADMISSION_KEYS === 'string' && env.PLAYER_ADMISSION_KEYS.length <= 4096, 'ADMISSION_NOT_CONFIGURED');
  let keys, audience;
  try { keys = JSON.parse(env.PLAYER_ADMISSION_KEYS); audience = new URL(env.PLAYER_ORIGIN); }
  catch { throw new Error('ADMISSION_NOT_CONFIGURED'); }
  requireValue(audience.protocol === 'https:' && audience.origin === env.PLAYER_ORIGIN && audience.origin === origin && keys && typeof keys === 'object' && !Array.isArray(keys), 'ADMISSION_NOT_CONFIGURED');
  const entries = Object.entries(keys);
  requireValue(entries.length >= 1 && entries.length <= 8 && entries.every(([id, key]) => isId(id) && typeof key === 'string' && /^[a-f0-9]{64}$/.test(key)), 'ADMISSION_NOT_CONFIGURED');
  return { keys, audience: audience.origin };
}
async function hmacKey(hex) {
  const bytes = Uint8Array.from(hex.match(/../g), value => Number.parseInt(value, 16));
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function issueAdmission(env, origin, identity, chapterId, runtime) {
  const { keys, audience } = configuration(env, origin), kid = env.PLAYER_ADMISSION_ACTIVE_KEY;
  requireValue(isId(kid) && Object.hasOwn(keys, kid), 'ADMISSION_NOT_CONFIGURED');
  validateRuntimeReference(identity, runtime);
  requireValue(isChapterId(chapterId, identity.gameId), 'ADMISSION_INVALID');
  const claims = { v: 1, purpose: 'runtime-read', kid, aud: audience, gameId: identity.gameId, releaseId: identity.releaseId, ordinal: identity.ordinal, revision: identity.revision, sourceDigest: identity.sourceDigest, chapterId, runtime };
  const body = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(keys[kid]), encoder.encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyAdmission(env, origin, token) {
  const { keys, audience } = configuration(env, origin);
  try {
    requireValue(typeof token === 'string' && token.length <= 4096, 'ADMISSION_INVALID');
    const parts = token.split('.');
    requireValue(parts.length === 2 && parts[1].length === 43, 'ADMISSION_INVALID');
    const claims = parseJSON(decode(parts[0]));
    requireValue(claims?.v === 1 && claims.purpose === 'runtime-read' && claims.aud === audience && isId(claims.kid) && Object.hasOwn(keys, claims.kid) && isChapterId(claims.chapterId, claims.gameId), 'ADMISSION_INVALID');
    validateRuntimeReference(claims, claims.runtime);
    requireValue(await crypto.subtle.verify('HMAC', await hmacKey(keys[claims.kid]), decode(parts[1]), encoder.encode(parts[0])), 'ADMISSION_INVALID');
    return claims;
  } catch { throw new Error('ADMISSION_INVALID'); }
}
