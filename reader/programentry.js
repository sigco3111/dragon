// Current deployment chooses the software, never a request-supplied digest.
// site.js dispatches formal home requests here. Game admission stays in the
// existing reader; this provides no historical game or HTML selector.
import { isGameId } from './runtimecontract.js';
import { STATIC_RELEASE_MAX_BYTES, parseStaticReleaseShape } from './staticreleaseformat.js';
import { programDigest, sameProgramBytes, readRegisteredProgramFile } from './programarchive.js';
const check = value => { if (!value) throw new Error('PROGRAM_ENTRY_UNAVAILABLE'); };
const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
const unavailable = '<!doctype html><html lang="zh-Hant"><meta charset="UTF-8"><title>遊戲暫不可用</title><p>目前無法取得一致的遊戲程式。沒有開始對局，也沒有刪除存檔。</p><a href="">重新載入</a> <a href="/">返回首頁</a></html>';
const htmlPrefix = /^<!doctype html>\r?\n<html lang="zh-Hant">\r?\n  <head>\r?\n    <meta charset="UTF-8" \/>/;
export default { async fetch(request, env) {
  let url;
  try {
    url = new URL(request.url);
    const params = url.searchParams;
    if (!['GET', 'HEAD'].includes(request.method) || !['/', '/index.html'].includes(url.pathname) || url.hash ||
        params.getAll('formalGame').length !== 1 || !isGameId(params.get('formalGame')) || params.getAll('mode').length !== 1 ||
        !['new', 'load'].includes(params.get('mode')) || [...params.keys()].some(key => !['formalGame', 'mode'].includes(key)))
      return new Response(null, { status: 404, headers });
  } catch { return new Response(null, { status: 404, headers }); }
  try {
    const current = () => request.signal.throwIfAborted();
    const assets = env.ASSETS.fetch.bind(env.ASSETS);
    async function readDeployment() {
      current();
      const target = new URL('/static-release.json', url.origin).href;
      const response = await assets(new Request(target, { method: 'GET', redirect: 'manual', signal: request.signal, headers: { 'Cache-Control': 'no-cache' } }));
      let stream, complete = false;
      try {
        current();
        check(response.status === 200 && !response.redirected && (!response.url || response.url === target) &&
          ['application/json', 'application/json; charset=utf-8'].includes(response.headers.get('content-type')));
        const length = response.headers.get('content-length'), encoding = response.headers.get('content-encoding');
        check(length === null || /^\d+$/.test(length) && Number.isSafeInteger(Number(length)) && Number(length) > 0 && Number(length) <= STATIC_RELEASE_MAX_BYTES);
        stream = response.body.getReader();
        const chunks = []; let size = 0;
        while (true) {
          const row = await stream.read(); current();
          if (row.done) { complete = true; break; }
          check(row.value instanceof Uint8Array && row.value.length > 0 && row.value.length <= STATIC_RELEASE_MAX_BYTES - size);
          size += row.value.length; chunks.push(row.value);
        }
        check(size > 0 && (length === null || encoding && encoding.toLowerCase() !== 'identity' || Number(length) === size));
        const bytes = new Uint8Array(size); let at = 0;
        for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
        return bytes;
      } finally {
        if (!complete) { try { await (stream ? stream.cancel() : response.body?.cancel()); } catch { /* Preserve original failure. */ } }
        stream?.releaseLock();
      }
    }
    const deployed = await readDeployment();
    parseStaticReleaseShape(deployed);
    const digest = await programDigest(deployed); current();
    const { bytes } = await readRegisteredProgramFile({ get: env.PUBLISH_BUCKET.get.bind(env.PUBLISH_BUCKET), digest,
      path: 'index.html', maxBytes: 512 * 1024, signal: request.signal });
    const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Deliberately supports only our reviewed static shell, not general HTML
    // rewriting. No base or redirect may override the program-scoped document.
    check(htmlPrefix.test(html) && !/<base\b/i.test(html) && !/http-equiv\s*=/i.test(html));
    check(sameProgramBytes(deployed, await readDeployment())); current();
    const pinned = html.replace('<head>', `<head>\n    <base href="/program-assets/${digest}/" />`);
    return new Response(request.method === 'HEAD' ? null : pinned, { headers: { ...headers, 'X-Program-Digest': digest } });
  } catch { return new Response(request.method === 'HEAD' ? null : unavailable, { status: 503, headers }); }
} };
