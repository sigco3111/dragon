// Trusted HTTPS origin + fixed program base -> bounded season PNG bytes.
// No program discovery/admission: the pack still verifies its signed manifest.
import { MAX_RESOURCE_BYTES, sha256 } from './runtimecontract.js';
import { PlayerReaderError } from './playerclient.js';
const pathPattern = /^content\/builtin\/compiled\/map-2-[a-f0-9]{64}\/(?:map_atlas_|map_tiles_)(?:spring|summer|autumn|winter)\.png$/;
class StaticReadError extends PlayerReaderError {}
const fail = (code, status = 0) => { throw new StaticReadError(code, status); };
export function createPlayerStaticReader({ origin, basePath = '/', fetch: transport = globalThis.fetch, timeoutMs = 60000 }) {
  let parsed;
  try { parsed = new URL(origin); } catch { throw new TypeError('static HTTPS origin required'); }
  if (parsed.protocol !== 'https:' || parsed.origin !== origin || typeof transport !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    throw new TypeError('static HTTPS origin, fetch and bounded timeout required');
  if (typeof basePath !== 'string' || !(basePath === '/' || /^\/program-assets\/[a-f0-9]{64}\/$/.exec(basePath)?.[0] === basePath))
    throw new TypeError('fixed static program base required');
  return async function readStatic(path, { maxBytes } = {}) {
    if (typeof path !== 'string' || !pathPattern.test(path) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_RESOURCE_BYTES)
      throw new TypeError('fixed season path and explicit resource budget required');
    const url = origin + basePath + path, controller = new AbortController();
    let reader, timer, complete = false, expired = false;
    const cancel = () => { if (reader) { try { void reader.cancel().catch(() => {}); } catch { /* Already released. */ } } };
    function alive() { if (expired) fail('PLAYER_STATIC_TIMEOUT'); }
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        if (!complete) { controller.abort(); cancel(); }
        reject(new StaticReadError('PLAYER_STATIC_TIMEOUT'));
      }, timeoutMs);
    });
    async function run() {
      const response = await transport(url, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
      if (expired) {
        try { void response.body?.cancel().catch(() => {}); } catch { /* Closed response. */ }
        alive();
      }
      if (!response.body || typeof response.body.getReader !== 'function') fail('PLAYER_STATIC_INVALID');
      reader = response.body.getReader();
      if (response.redirected || response.url && response.url !== url) fail('PLAYER_STATIC_INVALID');
      // Static errors, even HTTP 410, never establish game deletion.
      if (!response.ok) fail('PLAYER_STATIC_UNAVAILABLE', response.status);
      const length = response.headers.get('content-length');
      const encoding = response.headers.get('content-encoding')?.toLowerCase();
      if (response.headers.get('content-type') !== 'image/png' ||
          length !== null && (!/^[0-9]+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) < 1 || Number(length) > maxBytes))
        fail('PLAYER_STATIC_INVALID');
      const chunks = []; let size = 0;
      for (;;) {
        const row = await reader.read(); alive();
        if (row.done) { complete = true; break; }
        if (!(row.value instanceof Uint8Array) || !row.value.length || row.value.length > maxBytes - size) fail('PLAYER_STATIC_INVALID');
        size += row.value.length; chunks.push(row.value);
      }
      // Fetch exposes decoded bytes; encoded Content-Length describes the wire.
      if (!size || length !== null && (!encoding || encoding === 'identity') && Number(length) !== size) fail('PLAYER_STATIC_INVALID');
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const digest = await sha256(bytes); alive();
      // The pack separately compares this measured digest/length to its signed
      // manifest. A static response/header cannot certify its own identity.
      return Object.freeze({ bytes, sha256: digest, contentType: 'image/png' });
    }
    try { return await Promise.race([run(), timeout]); }
    catch (error) { if (error instanceof StaticReadError) throw error; fail('PLAYER_STATIC_NETWORK_UNAVAILABLE'); }
    finally {
      clearTimeout(timer);
      if (!complete) { controller.abort(); cancel(); }
      try { reader?.releaseLock(); } catch { /* A timed-out read can still be pending. */ }
    }
  };
}
