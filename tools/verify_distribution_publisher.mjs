// Owned memory R2 with atomic conditional writes, real Node SQLite; no network.
import { createHash } from 'node:crypto';
import { exerciseDistributionPublisher } from './fixtures/distribution-publisher.mjs';
const checks = await exerciseDistributionPublisher(async prefix => {
  const objects = new Map();
  const own = key => { if (!key.startsWith(prefix)) throw new Error('fixture prefix'); };
  const save = (key, bytes, type) => objects.set(key, { bytes: Buffer.from(bytes), headers: { etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"', 'content-type': type, 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } });
  return {
    async get(key) { own(key); const value = objects.get(key); return value ? { bytes: Buffer.from(value.bytes), headers: { ...value.headers } } : null; },
    async put(key, bytes, type) { own(key); save(key, bytes, type); },
    async putIfMatch(key, bytes, type, etag) {
      own(key); const old = objects.get(key);
      if (etag === null ? old !== undefined : !old || old.headers.etag !== etag) return false;
      save(key, bytes, type); return true;
    },
    async remove(key) { own(key); objects.delete(key); },
  };
});
process.stdout.write(`distribution publisher: ${checks} groups green; real SQLite / memory conditional R2; resource-verifier seam, not HTTP authority integration\n`);
