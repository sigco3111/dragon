// Fresh actual workerd Root + lazy freeze constructors; no historical audit
// fixtures, secrets, cloud IO, real databases or player storage are consulted.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let modulePath;
try { modulePath = createRequire(import.meta.url).resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) throw new Error('Installed Miniflare required; no automatic install');
const { Miniflare } = await import(pathToFileURL(modulePath).href);
const scratch = join(root, '.dragon-analysis');
mkdirSync(scratch, { recursive: true });
const own = mkdtempSync(join(scratch, 'distribution-schema-'));
writeFileSync(join(own, 'fixture.mjs'), `
import { EditorMetadata } from '../../server/worker.js';
import { GameDeletionJobFreeze } from '../../server/deletionjobfreeze.js';
import { GameDeletionDraftFreeze } from '../../server/deletiondraftfreeze.js';
import { assertDeletionDefinitions } from '../../server/deletiondefinitions.js';
export class SchemaFixture extends EditorMetadata {
  constructor(ctx, env) {
    super(ctx, env);
    const options = { storage: ctx.storage, principal: () => { throw new Error('no principal operations'); }, requestKey: env.EDITOR_REQUEST_KEY };
    new GameDeletionJobFreeze(options);
    new GameDeletionDraftFreeze(options);
  }
  async fetch() {
    const facts = assertDeletionDefinitions(this.sql);
    const columns = this.sql.exec("SELECT name FROM sqlite_master WHERE type='table'").toArray().reduce((n, t) => n + this.sql.exec('PRAGMA table_xinfo(' + t.name + ')').toArray().length, 0);
    return Response.json({ ...facts, columns, pending: this.distribution.pending().length });
  }
}
export default { fetch(request, env) { return env.TEST_ROOT.get(env.TEST_ROOT.idFromName('owned')).fetch(request); } };
`, { flag: 'wx' });
let mf;
try {
  mf = new Miniflare({
    modules: true, scriptPath: join(own, 'fixture.mjs'),
    compatibilityDate: '2026-01-01', compatibilityFlags: ['nodejs_compat'],
    modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }, { type: 'Text', include: ['**/*.html', '**/*.css', '**/*.txt'] }],
    durableObjects: { TEST_ROOT: { className: 'SchemaFixture', useSQLite: true } },
    r2Buckets: ['EDITOR_BLOBS'],
    bindings: { EDITOR_ORIGIN: 'https://schema.test', EDITOR_REQUEST_KEY: randomBytes(32).toString('hex') },
    host: '127.0.0.1', port: 0,
  });
  const response = await mf.dispatchFetch('https://schema.test/');
  assert.equal(response.status, 200, await response.clone().text());
  const facts = await response.json();
  assert.equal(facts.tablesVerified, 47);
  assert.equal(facts.indexesVerified, 47);
  assert.equal(facts.foreignKeyDeclarationsVerified, 3);
  assert.equal(facts.columns, 318);
  assert.equal(facts.pending, 0);
  assert.match(facts.schemaDigest, /^[a-f0-9]{64}$/);
  process.stdout.write('distribution schema: actual Root 47 tables / 47 indexes / 318 columns; declarations, columns, FK and index attributes match frozen gate\n');
} finally {
  await mf?.dispose();
  rmSync(own, { recursive: true, force: true });
}
