// V4 读取端（miniflare 直驱，无凭据无网络）：目录/状态/准入/文件门。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const sha = b => createHash('sha256').update(b).digest('hex');
let n = 0;
const check = (label, cond) => { assert.ok(cond, label); n++; };

const require = createRequire(import.meta.url);
let modulePath;
try { modulePath = require.resolve('miniflare'); }
catch { modulePath = join(process.env.APPDATA ?? '', 'npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js'); }
if (!existsSync(modulePath)) { throw new Error('miniflare required'); }
const { Miniflare } = await import(pathToFileURL(modulePath).href);

const own = mkdtempSync(join(tmpdir(), 'dragon-reader-'));
const mf = new Miniflare({
  modules: true, scriptPath: resolve('reader/worker.js'),
  compatibilityDate: '2024-01-01',
  r2Buckets: ['PUBLISH_BUCKET'], r2Persist: join(own, 'blobs'),
});
let bucket;
try {
  await mf.ready;
  bucket = await mf.getR2Bucket('PUBLISH_BUCKET');
  const gid = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const projection = { directory: [{ gameId: gid, name: '乾', ordinal: '1.0', revision: '1', sourceDigest: sha('s'), publishedAt: '2026-10-16T00:00:00.000Z' }], announcements: [{ gameId: gid, ordinal: '1.0', name: '乾', creatorAccount: 'tianyi', publishedAt: '2026-10-16T00:00:00.000Z', firstOnlineAt: '2026-10-16T00:00:00.000Z' }], releases: [{ game_id: gid, release_id: 'r1', ordinal: '1.0', draft_revision: '1', source_digest: sha('s'), created_at: '2026-10-16T00:00:00.000Z' }], generatedAt: '2026-10-16T00:00:00.000Z' };
  const projectionBytes = Buffer.from(JSON.stringify(projection));
  const digest = sha(projectionBytes);
  await bucket.put('control/current.json', Buffer.from(JSON.stringify({ generation: 1, digest, previousDigest: null })));
  await bucket.put(`projections/1/${digest}/projection.json`, projectionBytes);
  const asset = Buffer.from('terrain-bytes');
  await bucket.put(`artifacts/${gid}/1.0/${sha(asset)}`, asset);
  await bucket.put('kao/0.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const get = async path => {
    const r = await mf.dispatchFetch(`https://reader.test${path}`);
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body, headers: r.headers };
  };
  const reg = await get('/play-api/v1/registry');
  check('registry 200', reg.status === 200);
  check('registry generation', reg.body.generation === 1 && reg.body.digest === digest);
  check('registry directory', reg.body.directory.length === 1 && reg.body.directory[0].name === '乾');
  check('registry announcements', reg.body.announcements.length === 1);
  check('no private fields', JSON.stringify(reg.body).includes('tianyi') && !JSON.stringify(reg.body).includes('display_name') && !JSON.stringify(reg.body).includes('email'));
  const st = await get(`/play-api/v1/status?game=${gid}`);
  check('status listed', st.status === 200 && st.body.listed === true && st.body.ordinal === '1.0');
  const stMiss = await get('/play-api/v1/status?game=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
  check('status unknown unlisted', stMiss.status === 200 && stMiss.body.listed === false);
  const stNoArg = await get('/play-api/v1/status');
  check('status arg required', stNoArg.status === 422);
  const adm = await get(`/play-api/v1/admissions?game=${gid}`);
  check('admissions listed', adm.status === 200 && adm.body.ordinal === '1.0' && adm.body.assets === `artifacts/${gid}/1.0/`);
  const admMiss = await get('/play-api/v1/admissions?game=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
  check('admissions unlisted 403', admMiss.status === 403);
  const file = await mf.dispatchFetch(`https://reader.test/play-api/v1/file?key=${encodeURIComponent(`artifacts/${gid}/1.0/${sha(asset)}`)}`);
  const fileBytes = Buffer.from(await file.arrayBuffer());
  check('file bytes exact', file.status === 200 && fileBytes.equals(asset));
  check('file sha header', file.headers.get('X-Content-SHA256') === sha(asset));
  check('file no-store', file.headers.get('Cache-Control') === 'no-store');
  const kao = await get(`/play-api/v1/file?key=${encodeURIComponent('kao/0.png')}`);
  check('kao reachable', kao.status === 200);
  const forbidden = await get('/play-api/v1/file?key=' + encodeURIComponent('secret/x.json'));
  check('prefix forbidden', forbidden.status === 403);
  const traversal = await get('/play-api/v1/file?key=' + encodeURIComponent('kao/../secret.json'));
  check('traversal forbidden', traversal.status === 403);
  const missing = await get('/play-api/v1/file?key=' + encodeURIComponent('kao/999.png'));
  check('missing 404', missing.status === 404);
  await bucket.put(`artifacts/${gid}/1.0/manifest.json`, JSON.stringify({ name: '測試' }));
  const manifest = await get('/play-api/v1/file?key=' + encodeURIComponent(`artifacts/${gid}/1.0/manifest.json`));
  check('JSON works without Node Buffer global', manifest.status === 200 && manifest.body.name === '測試');
  await bucket.put('kao/bad.json', '{');
  check('invalid JSON rejected', (await get('/play-api/v1/file?key=kao/bad.json')).status === 503);
  await bucket.put('kao/bad-utf8.json', new Uint8Array([34, 255, 34]));
  check('invalid UTF8 rejected', (await get('/play-api/v1/file?key=kao/bad-utf8.json')).status === 503);
  await bucket.put(`projections/1/${digest}/projection.json`, JSON.stringify({ ...projection, directory: [] }));
  const corrupt = await get('/play-api/v1/registry');
  check('projection digest verified', corrupt.status === 503 && corrupt.body.error === 'REGISTRY_CORRUPT');
  await bucket.put(`projections/1/${digest}/projection.json`, projectionBytes);
  await bucket.put('control/current.json', JSON.stringify({ generation: -1, digest }));
  check('invalid generation rejected', (await get('/play-api/v1/registry')).status === 503);
  await bucket.put('control/current.json', JSON.stringify({ generation: 1, digest: '../private' }));
  check('invalid digest rejected', (await get('/play-api/v1/registry')).status === 503);
  const post = await mf.dispatchFetch('https://reader.test/play-api/v1/registry', { method: 'POST' });
  check('POST rejected', post.status === 404);
  const unknown = await get('/play-api/v1/nope');
  check('unknown 404', unknown.status === 404);
} finally { await mf.dispose(); }
process.stdout.write(`reader: ${n} checks green\n`);
