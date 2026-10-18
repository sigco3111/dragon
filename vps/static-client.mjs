// Public static byte port for a server-configured HTTPS endpoint. Never accepts
// request-selected origins, credentials, arbitrary headers or redirect targets.
// A complete GET here is not build provenance or old-resource retention proof.
import { requestHTTPSBytes } from './https-bytes.mjs';
const types = Object.freeze({
  js: ['text/javascript', 'application/javascript'], mjs: ['text/javascript', 'application/javascript'],
  json: ['application/json'], html: ['text/html'], css: ['text/css'], txt: ['text/plain'], md: ['text/markdown', 'text/plain'],
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], gif: ['image/gif'], svg: ['image/svg+xml'], webp: ['image/webp'],
  ico: ['image/x-icon', 'image/vnd.microsoft.icon'], woff2: ['font/woff2'],
  flac: ['audio/flac', 'audio/x-flac'], mp3: ['audio/mpeg'], wav: ['audio/wav', 'audio/x-wav'], mid: ['audio/midi', 'audio/x-midi'],
});
function pathValid(path) {
  return typeof path === 'string' && path.length <= 512 &&
    /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(path) &&
    path.split('/').every(part => part.length > 0 && !part.startsWith('.'));
}
function checkRepresentation(path, headers) {
  const encoding = headers['content-encoding'];
  if (encoding !== undefined && (typeof encoding !== 'string' || encoding.toLowerCase() !== 'identity')) throw new Error('STATIC_CONTENT_ENCODING');
  const mime = headers['content-type'];
  if (typeof mime !== 'string' || mime.length > 256 || /[\r\n]/.test(mime)) throw new Error('STATIC_CONTENT_TYPE');
  const parts = mime.toLowerCase().split(';').map(part => part.trim());
  const extension = path.split('/').at(-1).split('.').at(-1).toLowerCase();
  const allowed = Object.hasOwn(types, extension) ? types[extension] : ['application/octet-stream'];
  if (!allowed.includes(parts[0]) || parts.length > 2 ||
      parts.length === 2 && !/^charset\s*=\s*(?:utf-8|"utf-8")$/.test(parts[1])) throw new Error('STATIC_CONTENT_TYPE');
}
export function createStaticByteReader({ origin, pathPrefix = '', timeoutMs = 60000 } = {}) {
  let parsed;
  try { parsed = new URL(origin); }
  catch (cause) { throw new TypeError('STATIC_ORIGIN_INVALID', { cause }); }
  if (typeof origin !== 'string' || parsed.protocol !== 'https:' || parsed.origin !== origin ||
      parsed.username || parsed.password) throw new TypeError('STATIC_ORIGIN_INVALID');
  if (typeof pathPrefix !== 'string' || pathPrefix !== '' &&
      (!pathPrefix.endsWith('/') || !pathValid(pathPrefix.slice(0, -1)))) throw new TypeError('STATIC_PREFIX_INVALID');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new TypeError('STATIC deadline invalid');
  return async function readStatic(path, { maxBytes } = {}) {
    if (!pathValid(path)) throw new TypeError('STATIC_PATH_INVALID');
    const response = await requestHTTPSBytes({
      url: `${origin}/${pathPrefix}${path}`, method: 'GET',
      headers: { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' },
      maxBytes, timeoutMs, errorPrefix: 'STATIC',
    });
    if (response.status === 404) return null; // Only complete responses reach here.
    if (response.status !== 200) throw new Error(`STATIC_HTTP_STATUS_${response.status}`);
    checkRepresentation(path, response.headers);
    return response.bytes;
  };
}
