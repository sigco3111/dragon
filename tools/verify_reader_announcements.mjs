// Q36 transport failure isolation, actual isolated workerd/R2. These are opaque
// fixture/corruption probes, not a production publisher, UI or first-online proof.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { publication, GAME, OTHER_GAME, PORTRAIT, TEMPLATE_PORTRAIT, sha } from './fixtures/publication.mjs';
import { createPlayerReader } from '../reader/playerclient.js';
const clientMode = process.argv.includes('--client');
if (process.argv.slice(2).some(arg => arg !== '--client')) throw new TypeError('unknown argument');
const require = createRequire(import.meta.url);
let modulePath;
try { modulePath = require.resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) throw new Error('installed Miniflare required; no automatic install');
const { Miniflare } = await import(pathToFileURL(modulePath).href);
const own = mkdtempSync(join(tmpdir(), 'dragon-reader-announcements-'));
const bindings = { PLAYER_ORIGIN: 'https://reader.test', PLAYER_ADMISSION_ACTIVE_KEY: 'owned', PLAYER_ADMISSION_KEYS: JSON.stringify({ owned: '11'.repeat(32) }) };
let mf, bucket, outbound = 0, generation = 0, checks = 0;
const check = (name, value) => { assert.ok(value, name); checks++; };
try {
  mf = new Miniflare({ modules: true, modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }], scriptPath: resolve('reader/worker.js'), compatibilityDate: '2024-01-01', host: '127.0.0.1', port: 0, r2Buckets: ['PUBLISH_BUCKET'], r2Persist: join(own, 'r2'), bindings, outboundService: () => { outbound++; return new Response('forbidden', { status: 403 }); } });
  await mf.ready; bucket = await mf.getR2Bucket('PUBLISH_BUCKET');
  const source = publication(0);
  for (const file of source.files) await bucket.put(file.key, file.bytes, { httpMetadata: { contentType: file.contentType } });
  await bucket.put('kao/0.png', PORTRAIT); await bucket.put('kao/p0001.png', TEMPLATE_PORTRAIT);
  const base = { runtimeVersion: 1, directory: source.directory, releases: source.releases, gameStates: source.gameStates, announcements: source.announcements };
  // Controlled test setup only: no writer permission or recovery protocol implied.
  const install = async (projection, frozen) => {
    const bytes = Buffer.from(JSON.stringify(projection)), digest = sha(bytes);
    generation++;
    const previousOperationDigest = generation === 1 ? null : 'c'.repeat(64);
    const control = frozen ? { version: 2, authorityId: 'dddddddd-dddd-4ddd-addd-dddddddddddd', generation, operationId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee', operationDigest: 'a'.repeat(64), payloadDigest: 'b'.repeat(64), previousOperationDigest, digest } : { generation, digest };
    const key = `projections/${generation}/${digest}/projection.json`;
    await bucket.put(key, bytes); await bucket.put('control/current.json', JSON.stringify(control));
    return { key, control };
  };
  let clientChecks = 0;
  const client = createPlayerReader({ origin: 'https://reader.test', fetch: (url, options) => mf.dispatchFetch(url, options) });
  const call = async (path, ticket) => {
    const response = await mf.dispatchFetch(`https://reader.test${path}`, { headers: ticket ? { Authorization: `Bearer ${ticket}` } : {} });
    if (clientMode && path === '/play-api/v1/registry') {
      if (response.ok) {
        const expected = await response.clone().json(), actual = await client.registry();
        assert.deepEqual(actual.directory, expected.directory);
        assert.deepEqual(actual.announcements, expected.announcements);
        assert.equal(actual.announcementsError, expected.announcementsError ?? null);
        assert.equal(actual.generation, expected.generation); assert.equal(actual.digest, expected.digest);
      } else await assert.rejects(client.registry, error => error.status === response.status);
      clientChecks++;
    }
    return response;
  };
  const admission = `/play-api/v1/admissions?game=${GAME}&ordinal=1.0&chapter=c1`;
  const chapter = ticket => call('/play-api/v1/file?role=chapter%3Ac1', ticket);
  let oldTicket;
  for (const frozen of [false, true]) {
    await install(base, frozen);
    let response = await call('/play-api/v1/registry'), body = await response.json();
    check('successful registry shape unchanged', response.status === 200 && body.announcements.length === 1 && !Object.hasOwn(body, 'announcementsError'));
    response = await call(admission); body = await response.json();
    check('valid admission', response.status === 200 && typeof body.ticket === 'string'); oldTicket ??= body.ticket;
    const missing = { ...base }; delete missing.announcements;
    const badRows = [null, {}, 'private-sentinel', 1, [{ ...source.announcements[0], name: null }], [{ ...source.announcements[0], ordinal: 'invalid' }], [{ ...source.announcements[0], firstOnlineAt: 123 }]];
    for (const projection of [missing, ...badRows.map(announcements => ({ ...base, announcements }))]) {
      await install(projection, frozen);
      response = await call('/play-api/v1/registry'); body = await response.json();
      assert.deepEqual(body.directory, source.directory);
      check('announcement failure explicit without losing directory', response.status === 200 && body.announcementsError === 'ANNOUNCEMENTS_UNAVAILABLE' && body.announcements.length === 0);
      check('error carries no raw malformed data and stays no-store', !JSON.stringify(body).includes('private-sentinel') && response.headers.get('Cache-Control') === 'no-store');
      check('announcement failure cannot deny fresh admission', (await call(admission)).status === 200);
      response = await chapter(oldTicket);
      check('announcement failure cannot revoke admitted resource', response.status === 200 && (await response.json()).fixture === '0:c1');
      response = await call(`/play-api/v1/status?game=${GAME}`);
      check('game status independent of announcement data', response.status === 200 && (await response.json()).listed === true);
    }
    await install({ ...base, announcements: [] }, frozen);
    response = await call('/play-api/v1/registry'); body = await response.json();
    check('valid empty distinct from failure', response.status === 200 && body.announcements.length === 0 && !Object.hasOwn(body, 'announcementsError'));
    await install({ ...base, announcements: [{ gameId: OTHER_GAME, name: 'private-sentinel', ordinal: null }] }, frozen);
    response = await call('/play-api/v1/registry'); body = await response.json();
    check('unlisted announcements neither exposed nor interpreted', response.status === 200 && body.announcements.length === 0 && !body.announcementsError && !JSON.stringify(body).includes('private-sentinel'));
    for (const fault of [{ directory: null }, { releases: [] }, { gameStates: [] }]) {
      await install({ ...base, ...fault, announcements: null }, frozen);
      response = await call('/play-api/v1/registry'); body = await response.json();
      check('core corruption still blocks registry', response.status === 503 && typeof body.error === 'string' && !Object.hasOwn(body, 'directory'));
      check('core corruption still blocks admission and old resources', (await call(admission)).status === 503 && (await chapter(oldTicket)).status === 503);
    }
    await install({ ...base, directory: [], releases: [], gameStates: [{ gameId: GAME, listed: false, deleted: true }], announcements: null }, frozen);
    check('bad announcements cannot mask explicit deletion', (await call(admission)).status === 410 && (await chapter(oldTicket)).status === 410 && (await call(`/play-api/v1/status?game=${GAME}`)).status === 410);
    const last = await install(base, frozen);
    await bucket.put(last.key, JSON.stringify({ ...base, announcements: null }));
    check('projection hash mismatch never softened', (await call('/play-api/v1/registry')).status === 503 && (await call(admission)).status === 503);
    await bucket.delete(last.key);
    check('missing projection remains unavailable', (await call('/play-api/v1/registry')).status === 503);
  }
  check('no worker outbound network', outbound === 0);
  // pi-lens-ignore: no-console-except-error-js
  console.log(`reader announcements: ${checks} checks green; actual workerd/R2, legacy and frozen roots; no UI/first-online/production proof`);
  if (clientMode) process.stdout.write(JSON.stringify({ clientChecks, outbound }) + '\n');
} finally { try { await mf?.dispose(); } finally { rmSync(own, { recursive: true, force: true }); } }
