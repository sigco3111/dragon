// V1 slice 3: real-HTTP checks for vps/auth-server.mjs against a fresh
// profile. Parity targets: worker.js gate/login/session/password/admin.
// Usage: node tools/verify_vps_auth_server.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { startAuthServer } from '../vps/auth-server.mjs';

const ORIGIN = 'https://vps-test.invalid';
const SECRET = 'f'.repeat(64);
const DEFAULT_PW = 'Vps-default-password-01!';
const NEW_PW = 'Aa123456!';
const env = { EDITOR_ORIGIN: ORIGIN, EDITOR_REQUEST_KEY: SECRET, EDITOR_DEFAULT_PASSWORD: DEFAULT_PW };

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};

const { server, url } = await startAuthServer({ storage: openStorage(':memory:'), env });
const key = n => `test-key-${String(n).padStart(10, '0')}-zz`;
const jar = { cookie: '' };
const req = async (path, { method = 'GET', body, cookie, csrf, origin = ORIGIN, key: idem } = {}) => {
  const headers = {};
  if (origin !== null) { headers.Origin = origin; }
  if (cookie) { headers.Cookie = cookie; }
  if (csrf) { headers['X-CSRF-Token'] = csrf; }
  if (idem) { headers['Idempotency-Key'] = idem; }
  headers['X-Editor-Source'] = 'verify';
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(url + path, { method, headers, body: payload });
  const setCookie = r.headers.get('set-cookie') ?? '';
  const token = /__Secure-dragon-editor=([a-f0-9]{64})/.exec(setCookie)?.[1] ?? null;
  const cleared = setCookie.includes('Max-Age=0');
  return { status: r.status, json: await r.json(), cookie: token ? `__Secure-dragon-editor=${token}` : '', token, cleared };
};

try {
  let r = await req('/api/health');
  check('health uninitialized', r.status === 200 && r.json.initialized === false);
  const T0 = await req('/api/auth/login', { method: 'POST', body: { account: 'tianyi', password: DEFAULT_PW }, key: key(1) });
  check('login 200 + mustChange', T0.status === 200 && T0.json.user.account === 'tianyi' && T0.json.user.mustChangePassword === true && !!T0.token && !!T0.json.csrf);
  r = await req('/api/health');
  check('health initialized', r.json.initialized === true);
  const T1 = T0;
  r = await req('/api/session', { cookie: T1.cookie });
  check('must-change gate 403', r.status === 403 && r.json.error === 'PASSWORD_CHANGE_REQUIRED');
  r = await req('/api/auth/login', { method: 'POST', origin: null, body: { account: 'tianyi', password: DEFAULT_PW }, key: key(3) });
  check('missing origin 403', r.status === 403 && r.json.error === 'ORIGIN_REJECTED');
  r = await req('/api/auth/login', { method: 'POST', body: { account: 'tianyi', password: 'wrong-password-00000' }, key: key(4) });
  check('wrong password 401', r.status === 401 && r.json.error === 'INVALID_LOGIN');
  r = await req('/api/auth/login', { method: 'POST', body: { account: 'nosuchuser', password: 'wrong-password-00000' }, key: key(5) });
  check('unknown account 401', r.status === 401 && r.json.error === 'INVALID_LOGIN');
  let last = null;
  for (let i = 0; i < 6; i++) { last = await req('/api/auth/login', { method: 'POST', body: { account: 'ratelimit01', password: 'wrong-password-00000' }, key: key(10 + i) }); }
  check('rate limit 429', last.status === 429 && last.json.error === 'LOGIN_RATE_LIMIT');
  const invalid = [['Aa12345!', 'PASSWORD_LENGTH'], ['aa123456!', 'PASSWORD_COMPLEXITY'], ['AA123456!', 'PASSWORD_COMPLEXITY'], ['Aabcdefg!', 'PASSWORD_COMPLEXITY'], ['Aa1234567', 'PASSWORD_COMPLEXITY'], ['Aa123456 ', 'PASSWORD_COMPLEXITY']];
  for (const [i, [newPassword, code]] of invalid.entries()) {
    r = await req('/api/auth/password', { method: 'POST', cookie: T1.cookie, csrf: T1.json.csrf, body: { oldPassword: DEFAULT_PW, newPassword }, key: key(100 + i) });
    check(`password policy rejects case ${i}`, r.status === 422 && r.json.error === code);
  }
  r = await req('/api/auth/password', { method: 'POST', cookie: T1.cookie, csrf: T1.json.csrf, body: { oldPassword: DEFAULT_PW, newPassword: NEW_PW }, key: key(20) });
  check('password change 200', r.status === 200 && !!r.token && r.token !== T1.token);
  const T3 = r;
  r = await req('/api/session', { cookie: T1.cookie });
  check('old session revoked', r.status === 401 && r.json.error === 'SESSION_INVALID');
  r = await req('/api/session', { cookie: T3.cookie });
  check('new session ok', r.status === 200 && r.json.user.mustChangePassword === false);
  const A = await req('/api/auth/login', { method: 'POST', body: { account: 'tianyi', password: NEW_PW }, key: key(21) });
  const B = await req('/api/auth/login', { method: 'POST', body: { account: 'tianyi', password: NEW_PW }, key: key(21) });
  check('same-key replay same token', A.status === 200 && B.status === 200 && A.token === B.token);
  r = await req('/api/auth/logout', { method: 'POST', cookie: A.cookie, body: {} });
  check('logout without csrf 403', r.status === 403 && r.json.error === 'CSRF_REJECTED');
  r = await req('/api/auth/logout', { method: 'POST', cookie: A.cookie, csrf: A.json.csrf, body: {}, key: key(22) });
  check('logout ok + cleared', r.status === 200 && r.json.loggedOut === true && r.cleared);
  r = await req('/api/session', { cookie: A.cookie });
  check('logged-out session gone', r.status === 401);
  const L = await req('/api/auth/login', { method: 'POST', body: { account: 'tianyi', password: NEW_PW }, key: key(23) });
  r = await req('/api/admin/accounts', { method: 'POST', cookie: L.cookie, csrf: L.json.csrf, body: { account: 'author01' }, key: key(24) });
  check('admin create author', r.status === 200 && r.json.account.account === 'author01');
  r = await req('/api/admin/accounts', { cookie: L.cookie });
  check('admin list two', r.status === 200 && r.json.accounts.length === 2);
  const AU = await req('/api/auth/login', { method: 'POST', body: { account: 'author01', password: DEFAULT_PW }, key: key(25) });
  check('author login mustChange', AU.status === 200 && AU.json.user.mustChangePassword === true);
  r = await req('/api/auth/password', { method: 'POST', cookie: AU.cookie, csrf: AU.json.csrf, body: { oldPassword: DEFAULT_PW, newPassword: NEW_PW }, key: key(26) });
  const AU2 = r;
  r = await req('/api/admin/accounts', { method: 'POST', cookie: AU2.cookie ?? AU.cookie, csrf: AU2.json?.csrf ?? AU.json.csrf, body: { account: 'author02' }, key: key(27) });
  check('non-admin create 403', r.status === 403);
} finally {
  server.close();
  jar.cookie = '';
}

console.log(`passed ${passed} checks`);
