// Shared bounded raw HTTPS transport. No redirects, retries or decompression.
// Endpoint selection/authentication belong to the trusted caller. Completion
// means a complete HTTP response, not successful publication or PUT rollback.
import { request as httpsRequest } from 'node:https';
import { MAX_RESOURCE_BYTES } from '../reader/runtimecontract.js';

export function requestHTTPSBytes({ url, method, headers, body = null, maxBytes, timeoutMs, errorPrefix }) {
  if (!['R2', 'STATIC'].includes(errorPrefix)) throw new TypeError('HTTPS error namespace invalid');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_RESOURCE_BYTES) throw new TypeError(`${errorPrefix} response budget invalid`);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new TypeError(`${errorPrefix} deadline invalid`);
  let parsed;
  try { parsed = new URL(url); }
  catch (cause) { throw new TypeError('HTTPS endpoint invalid', { cause }); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new TypeError('HTTPS endpoint invalid');
  return new Promise((done, reject) => {
    let req, response, settled = false;
    const chunks = [];
    const fail = cause => {
      if (settled) return;
      settled = true; clearTimeout(timer); chunks.length = 0;
      reject(cause); response?.destroy?.(); req?.destroy?.();
    };
    // Absolute deadline includes connection, upload and response; an endless
    // slow stream cannot reset it by sending occasional chunks.
    const timer = setTimeout(() => fail(new Error(`${errorPrefix}_REQUEST_TIMEOUT`)), timeoutMs);
    try {
      req = httpsRequest(url, { method, headers, rejectUnauthorized: true }, res => {
        response = res;
        if (settled) { res.destroy(); return; }
        let length = 0, ended = false, declared = null;
        res.on('error', fail);
        res.on('aborted', () => fail(new Error(`${errorPrefix}_RESPONSE_ABORTED`)));
        res.on('close', () => { if (!ended) fail(new Error(`${errorPrefix}_RESPONSE_TRUNCATED`)); });
        const header = res.headers['content-length'];
        if (header !== undefined) {
          if (typeof header !== 'string' || !/^[0-9]+$/.test(header) || !Number.isSafeInteger(Number(header))) { fail(new Error(`${errorPrefix}_RESPONSE_LENGTH`)); return; }
          declared = Number(header);
          if (declared > maxBytes) { fail(new Error(`${errorPrefix}_RESPONSE_BUDGET`)); return; }
        }
        res.on('data', bytes => {
          if (settled) return;
          if (!(bytes instanceof Uint8Array)) { fail(new Error(`${errorPrefix}_RESPONSE_CHUNK`)); return; }
          if (bytes.byteLength > maxBytes - length) { fail(new Error(`${errorPrefix}_RESPONSE_BUDGET`)); return; }
          length += bytes.byteLength;
          if (declared !== null && length > declared) { fail(new Error(`${errorPrefix}_RESPONSE_LENGTH`)); return; }
          chunks.push(Buffer.from(bytes));
        });
        res.on('end', () => {
          ended = true;
          if (settled) return;
          if (declared !== null && length !== declared || res.complete === false) { fail(new Error(`${errorPrefix}_RESPONSE_TRUNCATED`)); return; }
          settled = true; clearTimeout(timer);
          done({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks, length) });
        });
      });
      req.on('error', fail);
      if (settled) req.destroy();
      else req.end(body ?? undefined);
    } catch (cause) { fail(cause); }
  });
}
