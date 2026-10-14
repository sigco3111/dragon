// V1 slice 3: VPS auth HTTP service. Faithful port of the worker.js
// accounts/sessions/idempotent-operation core (seed/rate/principal/
// postLogin/postAuthMutation/operation/replay/remember/canCommit/
// contentKey) onto Node http + vps/sqlite-port.mjs. No R2/blob/Trial/
// publish surface yet; unknown routes 404 like the worker.
import http from 'node:http';
import { GameMetadataStore } from '../server/metadata.js';
import { HttpError, fail, config, fields, body, account, password, passwordHash, passwordMatches, randomToken, sha, mac, seal, unseal, equal } from '../server/security.js';

const COOKIE = '__Secure-dragon-editor';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" };
function requestURL(request) { try { return new URL(request.url); } catch { fail(400, 'INVALID_URL'); } }
function response(value, status = 200, token) {
  const h = new Headers(headers); h.set('Content-Type', 'application/json; charset=utf-8');
  if (token !== undefined) { h.set('Set-Cookie', `${COOKIE}=${token}; Path=/api; Secure; HttpOnly; SameSite=Strict${token ? '' : '; Max-Age=0'}`); }
  return new Response(JSON.stringify(value), { status, headers: h });
}
function dto(user) { return { id: user.id, account: user.account, role: user.role, disabled: Boolean(user.disabled), mustChangePassword: Boolean(user.must_change), version: user.version, displayName: user.display_name ?? '', email: user.email ?? '', phone: user.phone ?? '', note: user.note ?? '' }; }
function profileField(value) { if (value === undefined) { return undefined; } if (typeof value !== 'string' || value.length > 128) { fail(422, 'PROFILE_FIELD'); } return value; }
function cookie(request) {
  const values = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${COOKIE}=`));
  if (values.length !== 1 || !/^[a-f0-9]{64}$/.test(values[0].slice(COOKIE.length + 1))) { fail(401, 'LOGIN_REQUIRED'); }
  return values[0].slice(COOKIE.length + 1);
}

export class VpsEditorAuth {
  constructor(storage, env) {
    this.storage = storage; this.env = env;
    this.policy = config(env);
    // Web产品决定（整站单用户在线）：仅VPS端口支持，默认关闭以保已有
    // 多会话验证语义；生产Compose以 EDITOR_SINGLE_USER=1 开启。workerd
    // 开发后端是否跟进另议，已封存lanes不动。
    this.singleUser = env.EDITOR_SINGLE_USER === '1';
    this.sql = storage.sql;
    storage.transactionSync(() => {
      this.sql.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY CHECK(version=1))');
      this.sql.exec('INSERT OR IGNORE INTO schema_version VALUES(1)');
      this.sql.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','author')), password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL, display_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '')");
      const userColumns = new Set(this.sql.exec('PRAGMA table_info(users)').toArray().map(column => column.name));
      for (const column of ['display_name', 'email', 'phone', 'note']) { if (!userColumns.has(column)) { this.sql.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`); } }
      this.sql.exec('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), epoch INTEGER NOT NULL, absolute_until INTEGER NOT NULL, idle_until INTEGER NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS login_rates (bucket TEXT PRIMARY KEY, start_at INTEGER NOT NULL, attempts INTEGER NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS operations (actor TEXT NOT NULL, op_key TEXT NOT NULL, request_digest TEXT NOT NULL, sealed_result TEXT NOT NULL, epoch INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(actor,op_key))');
    });
    // content_* tables for the auth-namespace contentKey gate and later slices.
    this.games = new GameMetadataStore({ storage, principal: hash => this.principal(hash),
      verifySnapshot: undefined, recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });
    this.adminCopies = null;
  }
  one(query, ...args) { return this.sql.exec(query, ...args).toArray()[0]; }
  seed(policy) {
    if (this.one("SELECT id FROM users WHERE account='tianyi'")) { return; }
    const id = crypto.randomUUID(), encoded = passwordHash(policy.defaultPassword);
    this.storage.transactionSync(() => { if (!this.one("SELECT id FROM users WHERE account='tianyi'")) { this.sql.exec("INSERT INTO users VALUES(?,?,'admin',?,0,1,1,1,'','','','')", id, 'tianyi', encoded); } });
  }
  rate(accountName, source, policy) {
    const now = Date.now(); let denied = false;
    this.storage.transactionSync(() => {
      for (const [bucket, limit] of [[`account:${accountName}`, policy.accountLimit], [`source:${source}`, policy.sourceLimit]]) {
        const row = this.one('SELECT * FROM login_rates WHERE bucket=?', bucket);
        const start = row && now - row.start_at < policy.rateMs ? row.start_at : now;
        const attempts = row && start === row.start_at ? row.attempts : 0;
        if (attempts >= limit) { denied = true; }
        this.sql.exec('INSERT OR REPLACE INTO login_rates VALUES(?,?,?)', bucket, start, Math.min(attempts + 1, limit));
      }
    });
    if (denied) { fail(429, 'LOGIN_RATE_LIMIT'); }
  }
  principal(tokenHash) {
    const row = this.one('SELECT s.*,u.account,u.role,u.disabled,u.must_change,u.version,u.epoch AS user_epoch,u.password_hash,u.display_name,u.email,u.phone,u.note FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=?', tokenHash);
    const now = Date.now();
    if (!row || row.disabled || row.epoch !== row.user_epoch || now >= row.absolute_until || now >= row.idle_until) { fail(401, 'SESSION_INVALID'); }
    return { ...row, id: row.user_id, epoch: row.user_epoch };
  }
  touch(tokenHash, policy) { this.sql.exec('UPDATE sessions SET idle_until=MIN(absolute_until,?) WHERE token_hash=?', Date.now() + policy.idleMs, tokenHash); }
  async sessionData(user, policy) {
    const token = randomToken(), hash = await sha(token), now = Date.now();
    return { token, hash, absolute: now + policy.sessionMs, idle: Math.min(now + policy.idleMs, now + policy.sessionMs), csrf: await mac(`csrf:${token}`, policy.secret), user };
  }
  insertSession(s, user) { this.sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?)', s.hash, user.id, user.epoch, s.absolute, s.idle); }
  contentKey(actor, key, namespace) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) { fail(422, 'IDEMPOTENCY_KEY'); }
    if (namespace !== 'delete' && this.one('SELECT op_key FROM content_deletion_operations WHERE actor=? AND op_key=?', actor, key)) { fail(409, 'IDEMPOTENCY_CONFLICT'); }
    if (!this.adminCopies) { return; }
  }
  async operation(request, value, actor, epoch, policy) {
    const key = request.headers.get('Idempotency-Key'); if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) { fail(422, 'IDEMPOTENCY_KEY'); }
    const digest = await mac(JSON.stringify([request.method, requestURL(request).pathname, value]), policy.secret);
    return { actor, key, digest, epoch, aad: JSON.stringify([actor, key, digest]) };
  }
  async replay(op, policy) {
    const row = this.one('SELECT * FROM operations WHERE actor=? AND op_key=?', op.actor, op.key); if (!row) { return null; }
    if (row.request_digest !== op.digest) { fail(409, 'IDEMPOTENCY_CONFLICT'); }
    if (row.epoch !== op.epoch || Date.now() >= row.expires_at) { fail(409, 'OPERATION_EXPIRED'); }
    return unseal(row.sealed_result, policy.secret, op.aad);
  }
  canCommit(op) {
    this.contentKey(op.actor, op.key, 'auth');
    const row = this.one('SELECT * FROM operations WHERE actor=? AND op_key=?', op.actor, op.key); if (!row) { return true; }
    const actor = this.one('SELECT epoch,disabled FROM users WHERE id=?', op.actor);
    if (row.request_digest !== op.digest) { fail(409, 'IDEMPOTENCY_CONFLICT'); }
    if (!actor || actor.disabled || row.epoch !== actor.epoch || Date.now() >= row.expires_at) { fail(409, 'OPERATION_EXPIRED'); }
    return false;
  }
  remember(op, sealed, policy) { this.sql.exec('INSERT INTO operations VALUES(?,?,?,?,?,?)', op.actor, op.key, op.digest, sealed, op.epoch, Date.now() + policy.sessionMs); }
  gateEntry(request, policy, url, method, path) {
    const welcome = value => value === policy.origin;
    if (!welcome(url.origin)) { fail(403, 'ORIGIN_REJECTED'); }
    if (method === 'GET' && path === '/api/health') { return response({ service: 'dragon-editor', stage: 'accounts-sessions', initialized: Boolean(this.one("SELECT id FROM users WHERE account='tianyi'")) }); }
    if (method !== 'GET' && (method !== 'POST' || !welcome(request.headers.get('Origin')))) { fail(403, 'ORIGIN_REJECTED'); }
    const suppliedOrigin = request.headers.get('Origin'); if (suppliedOrigin && !welcome(suppliedOrigin)) { fail(403, 'ORIGIN_REJECTED'); }
    return null;
  }
  assertPasswordCurrent(user, path) {
    if (user.must_change && path !== '/api/auth/password' && path !== '/api/auth/logout') { fail(403, 'PASSWORD_CHANGE_REQUIRED'); }
  }
  async postLogin(request, policy) {
    const value = await body(request); fields(value, ['account', 'password']); const name = account(value.account);
    const source = await mac(`source:${request.headers.get('X-Editor-Source')}`, policy.secret); this.rate(name, source, policy);
    const user = this.one('SELECT * FROM users WHERE account=?', name);
    const encoded = user?.password_hash ?? this.one("SELECT password_hash FROM users WHERE account='tianyi'").password_hash;
    const matches = passwordMatches(value.password, encoded);
    if (!user || !matches || user.disabled) { fail(401, 'INVALID_LOGIN'); }
    this.contentKey(user.id, request.headers.get('Idempotency-Key'), 'auth');
    const op = await this.operation(request, value, user.id, user.epoch, policy);
    const old = await this.replay(op, policy); if (old) { this.principal(await sha(old.token)); return response(old.body, 200, old.token); }
    if (this.singleUser) {
      const now = Date.now();
      const occupant = this.one('SELECT token_hash FROM sessions WHERE absolute_until>? AND idle_until>?', now, now);
      if (occupant) { fail(409, 'SINGLE_USER_ONLINE'); }
    }
    const s = await this.sessionData(user, policy), result = { body: { user: dto(user), csrf: s.csrf }, token: s.token };
    const sealed = await seal(result, policy.secret, op.aad);
    const committed = this.storage.transactionSync(() => {
      if (!this.canCommit(op)) { return false; }
      const current = this.one('SELECT * FROM users WHERE id=?', user.id); if (current.epoch !== user.epoch || current.disabled) { fail(401, 'SESSION_INVALID'); }
      this.insertSession(s, current); this.remember(op, sealed, policy); return true;
    });
    const chosen = committed ? result : await this.replay(op, policy); this.principal(await sha(chosen.token)); return response(chosen.body, 200, chosen.token);
  }
  async buildPasswordMutation(user, value, policy) {
    fields(value, ['oldPassword', 'newPassword']); password(value.newPassword);
    if (value.newPassword === value.oldPassword || value.newPassword === policy.defaultPassword) { fail(422, 'NEW_PASSWORD_REQUIRED'); }
    if (!passwordMatches(value.oldPassword, user.password_hash)) { fail(401, 'INVALID_PASSWORD'); }
    const encoded = passwordHash(value.newPassword), changed = { ...user, must_change: 0, epoch: user.epoch + 1, version: user.version + 1 }, s = await this.sessionData(changed, policy);
    const mutation = () => { this.sql.exec('UPDATE users SET password_hash=?,must_change=0,epoch=epoch+1,version=version+1 WHERE id=?', encoded, user.id); this.sql.exec('DELETE FROM sessions WHERE user_id=?', user.id); this.insertSession(s, changed); };
    return { mutation, result: { body: { user: dto(changed), csrf: s.csrf }, token: s.token }, operationEpoch: changed.epoch };
  }
  buildProfileMutation(user, value) {
    if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).every(key => ['displayName', 'email', 'phone', 'note'].includes(key))) { fail(422, 'REQUEST_FIELDS'); }
    const patch = {};
    for (const [key, column] of [['displayName', 'display_name'], ['email', 'email'], ['phone', 'phone'], ['note', 'note']]) {
      if (!(key in value)) { continue; }
      patch[column] = profileField(value[key]);
    }
    if (Object.keys(patch).length === 0) { fail(422, 'PROFILE_EMPTY'); }
    const changed = { ...user, ...patch, version: user.version + 1 };
    const mutation = () => { const current = this.one('SELECT version FROM users WHERE id=?', user.id); if (current.version !== user.version) { fail(409, 'ACCOUNT_CHANGED'); } this.sql.exec(`UPDATE users SET ${Object.keys(patch).map(column => `${column}=?`).join(',')},version=version+1 WHERE id=?`, ...Object.values(patch), user.id); };
    return { mutation, result: { body: { user: dto(changed) } } };
  }
  buildAccountMutation(user, match, value, policy) {
    fields(value, match[2] === 'disable' ? ['expectedVersion', 'disabled'] : ['expectedVersion']);
    if (!Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1) { fail(422, 'ACCOUNT_VERSION'); }
    if (match[2] === 'disable' && typeof value.disabled !== 'boolean') { fail(422, 'DISABLED_BOOLEAN'); }
    const target = this.one('SELECT * FROM users WHERE id=?', match[1]); if (!target) { fail(404, 'ACCOUNT_NOT_FOUND'); }
    if (target.account === 'tianyi') { fail(403, 'ADMIN_PROTECTED'); } if (target.version !== value.expectedVersion) { fail(409, 'ACCOUNT_CHANGED'); }
    if (match[2] === 'disable' && value.disabled && target.role === 'admin' && !target.disabled && this.one("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND disabled=0").n < 2) { fail(403, 'ADMIN_LAST'); }
    const encoded = match[2] === 'reset' ? passwordHash(policy.defaultPassword) : target.password_hash;
    const changed = { ...target, disabled: match[2] === 'disable' ? Number(value.disabled) : target.disabled, must_change: match[2] === 'reset' ? 1 : target.must_change, epoch: target.epoch + 1, version: target.version + 1 };
    const mutation = () => { const current = this.one('SELECT version FROM users WHERE id=?', target.id); if (current.version !== value.expectedVersion) { fail(409, 'ACCOUNT_CHANGED'); } this.sql.exec('UPDATE users SET password_hash=?,disabled=?,must_change=?,epoch=?,version=? WHERE id=?', encoded, changed.disabled, changed.must_change, changed.epoch, changed.version, changed.id); this.sql.exec('DELETE FROM sessions WHERE user_id=?', target.id); };
    return { mutation, result: { body: { account: dto(changed) } }, operationEpoch: user.epoch };
  }
  async postAuthMutation(request, tokenHash, user, policy, path, value) {
    this.contentKey(user.id, request.headers.get('Idempotency-Key'), 'auth');
    const op = await this.operation(request, value, user.id, user.epoch, policy), old = await this.replay(op, policy);
    if (old) { return response(old.body, 200, old.token); }
    let mutation, result, operationEpoch = user.epoch;
    if (path === '/api/auth/logout') {
      fields(value, []); mutation = () => this.sql.exec('DELETE FROM sessions WHERE token_hash=?', tokenHash); result = { body: { loggedOut: true }, token: '' };
    } else if (path === '/api/auth/password') {
      const built = await this.buildPasswordMutation(user, value, policy);
      mutation = built.mutation; result = built.result; operationEpoch = built.operationEpoch;
    } else if (path === '/api/auth/profile') {
      const built = this.buildProfileMutation(user, value);
      mutation = built.mutation; result = built.result;
    } else if (path === '/api/admin/accounts') {
      if (user.role !== 'admin') { fail(403, 'ADMIN_REQUIRED'); } fields(value, ['account']); const name = account(value.account);
      const created = { id: crypto.randomUUID(), account: name, role: 'author', disabled: 0, must_change: 1, epoch: 1, version: 1 }, encoded = passwordHash(policy.defaultPassword);
      mutation = () => { if (this.one('SELECT id FROM users WHERE account=?', name)) { fail(409, 'ACCOUNT_EXISTS'); } this.sql.exec("INSERT INTO users VALUES(?,?,'author',?,0,1,1,1,'','','','')", created.id, name, encoded); };
      result = { body: { account: dto(created) } };
    } else {
      const match = /^\/api\/admin\/accounts\/([a-f0-9-]{36})\/(disable|reset)$/.exec(path);
      if (!match) { fail(404, 'NOT_FOUND'); } if (user.role !== 'admin') { fail(403, 'ADMIN_REQUIRED'); }
      const built = this.buildAccountMutation(user, match, value, policy);
      mutation = built.mutation; result = built.result; operationEpoch = built.operationEpoch;
    }
    const sealed = await seal(result, policy.secret, op.aad);
    const committed = this.storage.transactionSync(() => { if (!this.canCommit(op)) { return false; } const current = this.principal(tokenHash); if (current.epoch !== user.epoch) { fail(401, 'SESSION_INVALID'); } mutation(); this.touch(tokenHash, policy); this.remember({ ...op, epoch: operationEpoch }, sealed, policy); return true; });
    if (!committed) { result = await this.replay({ ...op, epoch: operationEpoch }, policy); }
    return response(result.body, 200, result.token);
  }
  async handle(request) {
    const policy = this.policy, url = requestURL(request), path = url.pathname, method = request.method;
    const gate = this.gateEntry(request, policy, url, method, path);
    if (gate) { return gate; }
    this.seed(policy);
    if (method === 'POST' && path === '/api/auth/login') { return this.postLogin(request, policy); }
    const token = cookie(request), tokenHash = await sha(token), user = this.principal(tokenHash), csrf = await mac(`csrf:${token}`, policy.secret);
    this.assertPasswordCurrent(user, path);
    if (method === 'GET' && path === '/api/session') { this.touch(tokenHash, policy); return response({ user: dto(user), csrf }); }
    if (method === 'GET' && path === '/api/admin/accounts') {
      if (user.role !== 'admin') { fail(403, 'ADMIN_REQUIRED'); }
      this.touch(tokenHash, policy); return response({ accounts: this.sql.exec('SELECT * FROM users ORDER BY account').toArray().map(dto) });
    }
    if (method !== 'POST') { fail(404, 'NOT_FOUND'); }
    if (!equal(request.headers.get('X-CSRF-Token'), csrf)) { fail(403, 'CSRF_REJECTED'); }
    const value = await body(request);
    return this.postAuthMutation(request, tokenHash, user, policy, path, value);
  }
  async fetch(request) {
    try { return await this.handle(request); }
    catch (error) { return response({ error: error instanceof HttpError ? error.code : 'INTERNAL_ERROR' }, error instanceof HttpError ? error.status : 500); }
  }
}

export function startAuthServer({ storage, env, host = '127.0.0.1', port = 0 }) {
  const service = new VpsEditorAuth(storage, env);
  const server = http.createServer(async (req, res) => {
    try {
      const raw = await new Promise((resolve, reject) => {
        const chunks = []; let length = 0;
        req.on('data', c => { length += c.length; if (length > 1048576) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      const url = new URL(req.url ?? '/', service.policy.origin);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) { if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v); }
      const init = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD' && raw.length) { init.body = raw; }
      const resp = await service.fetch(new Request(service.policy.origin + url.pathname + url.search, init));
      const out = {};
      for (const [k, v] of resp.headers) { if (k.toLowerCase() !== 'set-cookie') out[k] = v; }
      const setCookie = resp.headers.getSetCookie?.();
      if (setCookie?.length) { out['set-cookie'] = setCookie; }
      res.writeHead(resp.status, out);
      res.end(Buffer.from(await resp.arrayBuffer()));
    } catch (error) {
      res.writeHead(error.status === 413 ? 413 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }));
    }
  });
  return new Promise(resolve => server.listen(port, host, () => resolve({ service, server, url: `http://${host}:${server.address().port}` })));
}
