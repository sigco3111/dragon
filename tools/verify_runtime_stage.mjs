// Owned memory R2; no SQL, network or visibility switch.
import { createHash } from 'node:crypto';
import { exerciseRuntimeStage } from './fixtures/runtime-stage.mjs';
const checks = await exerciseRuntimeStage(async prefix => {
  const objects = new Map();
  const own = key => { if (!key.startsWith(prefix)) throw new Error('fixture prefix'); };
  const save = (key, bytes, type) => objects.set(key, { bytes: Buffer.from(bytes), headers: { etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"', 'content-type': type } });
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
process.stdout.write(`runtime stage: ${checks} groups green; immutable upload/readback on memory R2; authority/static seams, no SQL/root/projection writes or compiled-game proof\n`);
