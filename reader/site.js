// Same-origin player site only. No editor authority, upload or publication API.
// Ordinary home requests remain Static Assets; formal entry pins its program.
import reader from './worker.js';
import programAssets from './programassets.js';
import programEntry from './programentry.js';
export default {
  async fetch(request, env) {
    let url;
    try { url = new URL(request.url); }
    catch { return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
    const { pathname, searchParams } = url;
    if ((pathname === '/' || pathname === '/index.html') && (searchParams.has('formalGame') || searchParams.has('mode')))
      return programEntry.fetch(request, env);
    if (pathname === '/play-api' || pathname.startsWith('/play-api/'))
      return reader.fetch(request, env);
    if (pathname === '/program-assets' || pathname.startsWith('/program-assets/'))
      return programAssets.fetch(request, env);
    return env.ASSETS.fetch(request);
  },
};
