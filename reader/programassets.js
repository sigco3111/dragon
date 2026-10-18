// Public software bytes only, registered by the trusted installation path.
// No HTML entry, game selection, capability issuance, author upload or fallback.
import { staticAssetPath } from './staticreleaseformat.js';
import { ProgramFileNotFound, readRegisteredProgramFile } from './programarchive.js';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' };
const types = Object.freeze({ js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  bin: 'application/octet-stream', flac: 'audio/flac', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' });
const error = (status, code) => new Response(JSON.stringify({ error: code }), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

export default { async fetch(request, env) {
  let match, path, mime;
  try {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method) || url.hash) return error(404, 'PROGRAM_ASSET_NOT_FOUND');
    match = /^\/program-assets\/([a-f0-9]{64})\/(.+)$/.exec(url.pathname);
    path = match?.[2];
    if (!staticAssetPath(path)) return error(404, 'PROGRAM_ASSET_NOT_FOUND');
    // Existing core/assets.js image cache suffix, not a software selector.
    // Only these four exact paths may alias the same registered file bytes.
    if (url.href.includes('?') && (url.search !== '?v=original-sprites-1' ||
        !/^grf\/(?:battle_terrain_[012]|battle_units)\.png$/.test(path))) return error(404, 'PROGRAM_ASSET_NOT_FOUND');
    const extension = path.slice(path.lastIndexOf('.') + 1);
    // The opening module fetches this reviewed fragment as text and parses it
    // locally. Serve no executable HTML document or arbitrary HTML suffix.
    mime = Object.hasOwn(types, extension) ? types[extension] : null;
    if (path === 'intro/scene.html') mime = 'text/plain; charset=utf-8';
    if (!mime) return error(404, 'PROGRAM_ASSET_NOT_FOUND');
  } catch { return error(404, 'PROGRAM_ASSET_NOT_FOUND'); }
  try {
    const { bytes } = await readRegisteredProgramFile({ get: env.PUBLISH_BUCKET.get.bind(env.PUBLISH_BUCKET), digest: match[1], path, signal: request.signal });
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { ...headers, 'Content-Type': mime, 'Content-Length': String(bytes.length) } });
  } catch (cause) { return cause instanceof ProgramFileNotFound ? error(404, 'PROGRAM_ASSET_NOT_FOUND') : error(503, 'PROGRAM_ASSET_UNAVAILABLE'); }
} };
