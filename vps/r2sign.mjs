// R2 S3-compatible request signer (SigV4, no dependencies).
// Proven live against the `dragon` bucket 2026-10-16 (ListObjects 200);
// earlier hand attempts failed only on an empty canonical query string.
// PUTs use real payload SHA; GET/HEAD/DELETE use UNSIGNED-PAYLOAD.
// Conditional writes pass If-Match / If-None-Match through (caller headers).
import { createHash, createHmac } from 'node:crypto';

const sha256hex = bytes => createHash('sha256').update(bytes).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

function encodeQuery(query) {
  return Object.keys(query).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&');
}

export function signR2({ accountId, accessKeyId, secretAccessKey, method, key, query = {}, headers = {}, payloadSha256 = 'UNSIGNED-PAYLOAD', now = new Date() }) {
  if (!/^[0-9a-f]{32}$/.test(accountId)) { throw new TypeError('account id required'); }
  if (!accessKeyId || !secretAccessKey) { throw new TypeError('credentials required'); }
  const host = `${accountId}.r2.cloudflarestorage.com`, region = 'auto', service = 's3';
  const amz = now.toISOString().replace(/[-:]|\.\d+/g, '');
  const date = amz.slice(0, 8);
  const path = `/${key.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalQuery = encodeQuery(query);
  const signed = { host, 'x-amz-content-sha256': payloadSha256, 'x-amz-date': amz, ...headers };
  const names = Object.keys(signed).map(n => n.toLowerCase()).sort();
  const canonicalHeaders = names.map(n => `${n}:${String(signed[Object.keys(signed).find(k => k.toLowerCase() === n)]).trim()}\n`).join('');
  const canonical = [method.toUpperCase(), path, canonicalQuery, canonicalHeaders, names.join(';'), payloadSha256].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonical)].join('\n');
  const signing = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), service), 'aws4_request');
  const signature = createHmac('sha256', signing).update(toSign).digest('hex');
  return Object.freeze({
    host, path: `${path}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    headers: Object.freeze({ 'X-Amz-Date': amz, 'X-Amz-Content-Sha256': payloadSha256, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope},SignedHeaders=${names.join(';')},Signature=${signature}` }),
  });
}
