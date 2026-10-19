// B-3b routes smoke: real server/worker.js on Miniflare (blobless), route
// matching + gates only. Heavy game flows stay in the lane suites.
// Usage: node tools/verify_topology_routes.mjs
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { startEditorBackend } from './start_editor_backend.mjs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};

const own = mkdtempSync(join(tmpdir(), 'topo-routes-'));
const origin = 'https://127.0.0.1:8787';
const initial = (randomBytes(24).toString('hex') + 'Aa1!');
let config;
try { config = JSON.parse(readFileSync('server/wrangler.jsonc', 'utf8')); }
catch (error) { throw new Error('cannot load server/wrangler.jsonc', { cause: error }); }
delete config.r2_buckets;
config.main = resolve('server/worker.js');
writeFileSync(join(own, 'config.json'), JSON.stringify(config), { flag: 'wx' });
writeFileSync(join(own, '.dev.vars'),
  'EDITOR_DEFAULT_PASSWORD=' + JSON.stringify(initial) + '\n' +
  'EDITOR_REQUEST_KEY=' + JSON.stringify(randomBytes(32).toString('hex')) + '\n',
  { flag: 'wx', mode: 0o600 });

const call = (path, value, s, extra = {}) => new Promise((done, reject) => {
  const headers = { Origin: origin, ...extra };
  if (s) { headers.Cookie = s.cookie; headers['X-CSRF-Token'] = s.csrf; }
  if (value !== undefined) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] ??= randomUUID(); }
  const req = httpsRequest(origin + path, { method: value === undefined ? 'GET' : 'POST', headers, rejectUnauthorized: false }, res => {
    const b = [];
    res.on('data', x => b.push(x)); res.on('error', reject);
    res.on('end', () => {
      let data = null;
      try { data = JSON.parse(Buffer.concat(b).toString('utf8')); } catch {}
      done({ status: res.statusCode, data, cookie: res.headers['set-cookie']?.[0]?.split(';')[0] });
    });
  });
  req.on('error', reject);
  req.end(value === undefined ? undefined : JSON.stringify(value));
});

const server = await startEditorBackend(join(own, 'config.json'));
try {
  const login = await call('/api/auth/login', { account: 'tianyi', password: initial });
  check('login 200', login.status === 200);
  const changed = await call('/api/auth/password', { oldPassword: initial, newPassword: (randomBytes(24).toString('hex') + 'Aa1!') },
    { cookie: login.cookie, csrf: login.data.csrf });
  check('password changed', changed.status === 200);
  const admin = { cookie: changed.cookie, csrf: changed.data.csrf };
  const G = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  let r = await call(`/api/games/${G}/topology`, undefined, admin);
  check('unknown game 404', r.status === 404);
  r = await call('/api/games/nope/topology', undefined, admin);
  check('bad path 404', r.status === 404);
  r = await call(`/api/games/${G}/topology/move`, { cityId: 'city-000', x: 1, y: 2 }, admin, { 'Idempotency-Key': undefined });
  void r;
  const noKey = await new Promise((done, reject) => {
    const req = httpsRequest(origin + `/api/games/${G}/topology/move`,
      { method: 'POST', headers: { Origin: origin, Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf, 'Content-Type': 'application/json' }, rejectUnauthorized: false }, res => {
        const b = [];
        res.on('data', x => b.push(x)); res.on('error', reject);
        res.on('end', () => done({ status: res.statusCode }));
      });
    req.on('error', reject);
    req.end(JSON.stringify({ cityId: 'city-000', x: 1, y: 2 }));
  });
  check('missing key 422', noKey.status === 422);
  r = await call(`/api/games/${G}/topology/move`, { cityId: 'city-000', x: 1, y: 2 }, admin);
  check('move needs game (404, no drafts)', r.status === 404 || r.status === 503, `got ${r.status}`);
  r = await call(`/api/games/${G}/topology/rebuild`, { roadId: 'r', geometry: [{ x: 0, y: 0 }], travelKind: 'land' }, admin);
  check('rebuild shape gate first', r.status === 404 || r.status === 503 || r.status === 422, `got ${r.status}`);
  r = await call(`/api/games/${G}/topology/rebuild/clear`, { roadId: 'r' }, admin);
  check('rebuild-clear needs game', r.status === 404, `got ${r.status}`);
  r = await call(`/api/games/${G}/topology/move/clear`, {}, admin);
  check('move-clear needs game', r.status === 404, `got ${r.status}`);
  r = await call(`/api/games/${G}/topology/move/clear`, { cityId: 7 }, admin);
  check('move-clear bad shape 422', r.status === 422, `got ${r.status}`);
  r = await call(`/api/games/${G}/topology?q=1`, undefined, admin);
  check('query string 422', r.status === 422, `got ${r.status}`);
} finally {
  await server.close();
}
console.log(`passed ${passed} checks`);
