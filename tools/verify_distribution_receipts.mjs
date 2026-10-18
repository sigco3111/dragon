// No network or files: real in-memory SQLite, deterministic private R2 port.
import { createHash } from 'node:crypto';
import { exerciseDistributionReceipts } from './fixtures/distribution-receipts.mjs';
const checks = await exerciseDistributionReceipts(async prefix => {
  const objects = new Map();
  const own = key => { if (!key.startsWith(prefix)) throw new Error('fixture prefix'); };
  return {
    async get(key) { own(key); const value = objects.get(key); return value ? { bytes: Buffer.from(value.bytes), headers: { ...value.headers } } : null; },
    async put(key, bytes, type) {
      own(key); objects.set(key, { bytes: Buffer.from(bytes), headers: { etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"', 'content-type': type, 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } });
    },
    async remove(key) { own(key); objects.delete(key); },
  };
});
process.stdout.write(`distribution receipts: ${checks} groups green; actual SQLite / memory R2; no publisher, CAS or dependency proof\n`);
