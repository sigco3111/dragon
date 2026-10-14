// Single-seat gate (整站单用户在线) for vps/auth-server.mjs behind
// EDITOR_SINGLE_USER=1. Usage: node tools/verify_vps_single_user.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { startAuthServer } from '../vps/auth-server.mjs';

const ORIGIN = 'https://vps-test.invalid';
const SECRET = 'e'.repeat(64);
const PW = 'vps-default-password-01';
const base = { EDITOR_ORIGIN: ORIGIN, EDITOR_REQUEST_KEY: SECRET, EDITOR_DEFAULT_PASSWORD: PW };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const login = (url, key, password = PW) => fetch(url + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'Idempotency-Key': key, 'X-Editor-Source': 'verify' },
  body: JSON.stringify({ account: 'tianyi', password }),
}).then(async r => ({ status: r.status, json: await r.json(), cookie: r.headers.get('set-cookie') ?? '' }));
const tokenOf = r => /__Secure-dragon-editor=([a-f0-9]{64})/.exec(r.cookie)?.[1] ?? null;

const s1 = await startAuthServer({ storage: openStorage(':memory:'), env: { ...base, EDITOR_SINGLE_USER: '1' } });
try {
  const A = await login(s1.url, 'seat-key-0000000001');
  check('first login ok', A.status === 200 && !!tokenOf(A));
  const B = await login(s1.url, 'seat-key-0000000002');
  check('second login 409', B.status === 409 && B.json.error === 'SINGLE_USER_ONLINE');
  const A2 = await login(s1.url, 'seat-key-0000000001');
  check('same-key replay allowed', A2.status === 200 && tokenOf(A2) === tokenOf(A));
  const out = await fetch(s1.url + '/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: `__Secure-dragon-editor=${tokenOf(A)}`, 'X-CSRF-Token': A.json.csrf, 'Idempotency-Key': 'seat-key-0000000003', 'X-Editor-Source': 'verify' },
    body: '{}',
  });
  check('logout frees seat', out.status === 200);
  const C = await login(s1.url, 'seat-key-0000000004');
  check('login after logout ok', C.status === 200 && !!tokenOf(C));
} finally { s1.server.close(); }

const s2 = await startAuthServer({ storage: openStorage(':memory:'), env: { ...base, EDITOR_SINGLE_USER: '1', EDITOR_SESSION_MS: '150', EDITOR_IDLE_MS: '100' } });
try {
  const A = await login(s2.url, 'seat-key-0000000011');
  check('short session login ok', A.status === 200);
  await sleep(250);
  const B = await login(s2.url, 'seat-key-0000000012');
  check('expired seat frees', B.status === 200 && !!tokenOf(B));
} finally { s2.server.close(); }

console.log(`passed ${passed} checks`);
