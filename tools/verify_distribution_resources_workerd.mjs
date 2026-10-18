// Actual owned workerd R2 conditional puts + Node SQLite. No real S3/credentials.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exerciseDistributionResources } from './fixtures/distribution-resources.mjs';
let modulePath;
try { modulePath = createRequire(import.meta.url).resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) throw new Error('installed Miniflare required; no automatic install');
const { Miniflare } = await import(pathToFileURL(modulePath).href);
const scratch = resolve('.dragon-analysis'); mkdirSync(scratch, { recursive: true });
const own = mkdtempSync(join(scratch, 'distribution-resources-r2-'));
let mf, outbound = 0;
try {
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("owned fixture only");}}', compatibilityDate: '2026-01-01', r2Buckets: ['OWNED'], r2Persist: join(own, 'r2'), host: '127.0.0.1', port: 0, outboundService: () => { outbound++; return new Response('outbound forbidden', { status: 403 }); } });
  const bucket = await mf.getR2Bucket('OWNED');
  const checks = await exerciseDistributionResources(async prefix => {
    const ownKey = key => assert.ok(key.startsWith(prefix));
    return {
      async get(key) {
        ownKey(key); const object = await bucket.get(key);
        if (object === null) return null;
        return { bytes: new Uint8Array(await object.arrayBuffer()), headers: { etag: object.httpEtag, 'content-type': object.httpMetadata.contentType, 'last-modified': object.uploaded.toUTCString() } };
      },
      async put(key, bytes, contentType) { ownKey(key); await bucket.put(key, bytes, { httpMetadata: { contentType } }); },
      async putIfMatch(key, bytes, contentType, etag) {
        ownKey(key); if (etag !== null) assert.match(etag, /^"[^"\r\n]+"$/);
        const onlyIf = etag === null ? { etagDoesNotMatch: '*' } : { etagMatches: etag.slice(1, -1) };
        return await bucket.put(key, bytes, { httpMetadata: { contentType }, onlyIf }) !== null;
      },
      async remove(key) { ownKey(key); await bucket.delete(key); },
    };
  });
  assert.equal(outbound, 0);
  process.stdout.write(`distribution resources workerd: ${checks} groups green; default publisher + owned conditional R2 / Node SQLite; outbound=0; opaque transport fixtures, static closure fail-closed, not playable game proof\n`);
} finally { await mf?.dispose(); rmSync(own, { recursive: true, force: true }); }
