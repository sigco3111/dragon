// Minimal R2 object client over raw HTTPS (no dependencies).
// Auth via ./r2sign.mjs. Credentials never leave the caller's env file.
import { createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { signR2 } from './r2sign.mjs';

const sha256hex = bytes => createHash('sha256').update(bytes).digest('hex');

function call({ accountId, accessKeyId, secretAccessKey, method, key, query = {}, headers = {}, body = null }) {
  const payloadSha = body ? sha256hex(body) : 'UNSIGNED-PAYLOAD';
  const signed = signR2({ accountId, accessKeyId, secretAccessKey, method, key, query, headers, payloadSha256: payloadSha });
  return new Promise((done, reject) => {
    try {
      const req = httpsRequest(`https://${signed.host}${signed.path}`, { method, headers: { ...signed.headers, ...headers }, rejectUnauthorized: true }, res => {
        const chunks = [];
        res.on('data', b => chunks.push(b));
        res.on('error', reject);
        res.on('end', () => done({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end(body ?? undefined);
    } catch (cause) { reject(cause); }
  });
}

export function r2client({ accountId, accessKeyId, secretAccessKey, bucket }) {
  if (!bucket) { throw new TypeError('bucket required'); }
  const key = suffix => `${bucket}/${suffix}`.replace(/\/+/g, '/');
  return Object.freeze({
    async list(prefix, maxKeys = 1000) {
      const r = await call({ accountId, accessKeyId, secretAccessKey, method: 'GET', key: bucket, query: { 'list-type': '2', prefix, 'max-keys': String(maxKeys) } });
      if (r.status !== 200) { throw new Error(`R2 list ${r.status}`); }
      const out = [], re = /<Key>([^<]*)<\/Key>/g;
      let match; while ((match = re.exec(r.bytes.toString('utf8'))) !== null) { out.push(match[1]); }
      return out;
    },
    async get(suffix) {
      const r = await call({ accountId, accessKeyId, secretAccessKey, method: 'GET', key: key(suffix) });
      if (r.status === 404 || r.status === 412) { return null; }
      if (r.status !== 200) { throw new Error(`R2 get ${r.status}`); }
      return r;
    },
    async putImmutable(suffix, bytes, contentType = 'application/octet-stream') {
      const r = await call({ accountId, accessKeyId, secretAccessKey, method: 'PUT', key: key(suffix), headers: { 'If-None-Match': '*', 'Content-Type': contentType, 'Cache-Control': 'no-store' }, body: Buffer.from(bytes) });
      if (r.status === 412) { return null; }
      if (r.status !== 200) { throw new Error(`R2 put ${r.status}`); }
      return r;
    },
    async putControl(suffix, bytes, ifMatch = null) {
      const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
      if (ifMatch === null) { headers['If-None-Match'] = '*'; }
      else { headers['If-Match'] = ifMatch; }
      const r = await call({ accountId, accessKeyId, secretAccessKey, method: 'PUT', key: key(suffix), headers, body: Buffer.from(bytes) });
      if (r.status === 412) { return null; }
      if (r.status !== 200) { throw new Error(`R2 control put ${r.status}`); }
      return r;
    },
    async remove(suffix) {
      const r = await call({ accountId, accessKeyId, secretAccessKey, method: 'DELETE', key: key(suffix) });
      if (r.status !== 204 && r.status !== 404) { throw new Error(`R2 delete ${r.status}`); }
      return r.status;
    },
  });
}
