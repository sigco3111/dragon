// Cloudflare 读取端（V4 切片）：只读当前 generation 投影＋不可变产物。
// 无管理写 API、无桶枚举、无玩家账户。签名准入票据延后（V5，需密钥轮换）。
// - GET /play-api/v1/registry      当前目录＋公告（同 generation 一次根读）
// - GET /play-api/v1/status?game=<id>  存在／版本／上架态（无删除事实的未知 ID 不报删除）
// - GET /play-api/v1/admissions?game=<id>  匿名新局资格（仅上架游戏；返回取数描述符）
// - GET /play-api/v1/file?key=<path>  字节原型（前缀门＋JSON语法检查＋响应SHA；no-store）
// 尚无已提交release/签名票据的资源准入门；禁止作为生产公开读取端部署。
async function sha256hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes)));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (code, status) => json({ error: code }, status);
const ALLOW_PREFIXES = ['kao/', 'artifacts/', 'projections/', 'control/'];

async function readControl(env) {
  const object = await env.PUBLISH_BUCKET.get('control/current.json');
  if (!object) { return null; }
  const text = await object.text();
  let control;
  try { control = JSON.parse(text); }
  catch { return { corrupt: true }; }
  if (!control || !Number.isSafeInteger(control.generation) || control.generation < 1 || typeof control.digest !== 'string' || !/^[a-f0-9]{64}$/.test(control.digest)) { return { corrupt: true }; }
  return control;
}

async function readProjection(env, control) {
  const object = await env.PUBLISH_BUCKET.get(`projections/${control.generation}/${control.digest}/projection.json`);
  if (!object) { return null; }
  const text = await object.text();
  if (await sha256hex(text) !== control.digest) { return { corrupt: true }; }
  let projection;
  try { projection = JSON.parse(text); }
  catch { return { corrupt: true }; }
  if (!projection || !Array.isArray(projection.directory)) { return { corrupt: true }; }
  return projection;
}

export default {
  async fetch(request, env) {
    let url;
    try { url = new URL(request.url); }
    catch { return fail('NOT_FOUND', 404); }
    if (request.method !== 'GET') { return fail('NOT_FOUND', 404); }
    if (url.pathname === '/play-api/v1/registry') {
      const control = await readControl(env);
      if (!control) { return fail('REGISTRY_EMPTY', 503); }
      if (control.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      const projection = await readProjection(env, control);
      if (!projection) { return fail('REGISTRY_MISSING', 503); }
      if (projection.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      return json({ generation: control.generation, digest: control.digest, directory: projection.directory, announcements: projection.announcements ?? [] });
    }
    if (url.pathname === '/play-api/v1/status') {
      const gameId = url.searchParams.get('game');
      if (!gameId) { return fail('GAME_REQUIRED', 422); }
      const control = await readControl(env);
      if (!control) { return fail('REGISTRY_EMPTY', 503); }
      if (control.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      const projection = await readProjection(env, control);
      if (!projection) { return fail('REGISTRY_MISSING', 503); }
      if (projection.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      const entry = projection.directory.find(g => g.gameId === gameId);
      if (!entry) { return json({ gameId, listed: false }); }
      return json({ gameId, listed: true, name: entry.name, ordinal: entry.ordinal, revision: entry.revision, sourceDigest: entry.sourceDigest });
    }
    if (url.pathname === '/play-api/v1/admissions') {
      const gameId = url.searchParams.get('game');
      if (!gameId) { return fail('GAME_REQUIRED', 422); }
      const control = await readControl(env);
      if (!control) { return fail('REGISTRY_EMPTY', 503); }
      if (control.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      const projection = await readProjection(env, control);
      if (!projection) { return fail('REGISTRY_MISSING', 503); }
      if (projection.corrupt) { return fail('REGISTRY_CORRUPT', 503); }
      const entry = projection.directory.find(g => g.gameId === gameId);
      if (!entry) { return fail('GAME_NOT_LISTED', 403); }
      const release = (projection.releases ?? []).find(r => r.game_id === gameId && r.ordinal === entry.ordinal);
      return json({ gameId, ordinal: entry.ordinal, revision: entry.revision, sourceDigest: entry.sourceDigest, releaseId: release?.release_id ?? null, assets: `artifacts/${gameId}/${entry.ordinal}/` });
    }
    if (url.pathname === '/play-api/v1/file') {
      const key = url.searchParams.get('key');
      if (!key || !ALLOW_PREFIXES.some(prefix => key.startsWith(prefix)) || key.includes('..')) { return fail('FILE_FORBIDDEN', 403); }
      const object = await env.PUBLISH_BUCKET.get(key);
      if (!object) { return fail('FILE_NOT_FOUND', 404); }
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (key.endsWith('.json')) {
        try { JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { return fail('FILE_CORRUPT', 503); }
      }
      return new Response(bytes, { headers: { 'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-SHA256': await sha256hex(bytes) } });
    }
    return fail('NOT_FOUND', 404);
  },
};
