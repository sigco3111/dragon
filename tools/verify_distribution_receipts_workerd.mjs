// Real owned workerd R2 through an S3-shaped port, with real Node SQLite.
// Not a production S3/credentials test or a root-CAS/whole-publication proof.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exerciseDistributionReceipts } from './fixtures/distribution-receipts.mjs';
let modulePath;
try { modulePath = createRequire(import.meta.url).resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) throw new Error('installed Miniflare required; no automatic install');
const { Miniflare } = await import(pathToFileURL(modulePath).href);
const scratch = resolve('.dragon-analysis'); mkdirSync(scratch, { recursive: true });
const own = mkdtempSync(join(scratch, 'distribution-receipts-r2-'));
let mf, outbound = 0;
try {
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("owned fixture only");}}', compatibilityDate: '2026-01-01', r2Buckets: ['OWNED'], r2Persist: join(own, 'r2'), host: '127.0.0.1', port: 0, outboundService: () => { outbound++; return new Response('outbound forbidden', { status: 403 }); } });
  const bucket = await mf.getR2Bucket('OWNED');
  const checks = await exerciseDistributionReceipts(async prefix => {
    const ownKey = key => assert.ok(key.startsWith(prefix));
    return {
      async get(key) {
        ownKey(key); const object = await bucket.get(key);
        if (object === null) return null;
        return { bytes: new Uint8Array(await object.arrayBuffer()), headers: { etag: object.httpEtag, 'content-type': object.httpMetadata.contentType, 'last-modified': object.uploaded.toUTCString() } };
      },
      async put(key, bytes, contentType) { ownKey(key); await bucket.put(key, bytes, { httpMetadata: { contentType } }); },
      async remove(key) { ownKey(key); await bucket.delete(key); },
    };
  });
  assert.equal(outbound, 0);
  process.stdout.write(`distribution receipts workerd: ${checks} groups green; actual owned R2 / Node SQLite; outbound=0; no root CAS or production S3 proof\n`);
} finally { await mf?.dispose(); rmSync(own, { recursive: true, force: true }); }
