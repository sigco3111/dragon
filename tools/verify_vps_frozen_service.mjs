// Constructor-only checks: owned in-memory SQLite/private directory, no sockets or cloud IO.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileBucket } from '../vps/file-bucket.mjs';
import { openStorage } from '../vps/sqlite-port.mjs';
import { createEditorService, startEditorServer } from '../vps/editor-server.mjs';
const env = { EDITOR_ORIGIN: 'https://owned-editor.invalid', EDITOR_REQUEST_KEY: 'd'.repeat(64), EDITOR_DEFAULT_PASSWORD: 'Owned constructor password 123!' };
let groups = 0, stageCalls = 0;
const stager = { async stage() { stageCalls++; throw new Error('unexpected stage'); }, verifyStaged() { stageCalls++; throw new Error('unexpected proof'); } };
const invalid = [
  { frozenPublication: true },
  ...[null, 0, 1, '', 'true', {}, []].map(frozenPublication => ({ frozenPublication, runtimeStager: stager })),
  { frozenPublication: true, runtimeStager: {} },
  { frozenPublication: true, runtimeStager: { stage() {}, async verifyStaged() {} } },
];
const own = mkdtempSync(join(tmpdir(), 'dragon-service-constructor-'));
const bucket = new FileBucket({ root: join(own, 'private') });
try {
for (const options of invalid) {
  const storage = openStorage(':memory:');
  try {
    const input = { storage, bucket, env, ...options, port: 0 };
    assert.throws(() => createEditorService(input), TypeError);
    assert.equal(storage.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").toArray()[0].n, 0);
    await assert.rejects(async () => {
      const server = await startEditorServer(input);
      await server.close(); // A regression must not leak an owned listener.
    }, TypeError);
    assert.equal(storage.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").toArray()[0].n, 0);
    groups++;
  } finally { storage.close(); }
}
for (const options of [{}, { frozenPublication: false }, { runtimeStager: stager }, { runtimeStager: stager, frozenPublication: true }]) {
  const storage = openStorage(':memory:');
  try {
    const service = createEditorService({ storage, bucket, env, ...options });
    assert.equal(service.origin, env.EDITOR_ORIGIN);
    const health = await service.fetch(new Request(env.EDITOR_ORIGIN + '/api/health'));
    const foreign = await service.fetch(new Request('https://attacker.invalid/api/health'));
    assert.equal(health.status, 200);
    assert.equal(foreign.status, 403);
    assert.equal(stageCalls, 0);
    groups++;
  } finally { storage.close(); }
}
process.stdout.write(`Node frozen service constructors: ${groups} groups green\n`);
} finally { rmSync(own, { recursive: true, force: true }); }
