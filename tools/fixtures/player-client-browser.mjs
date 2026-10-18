// Test-only module routes and probes. Runs the actual client in a fresh browser;
// never expose its capability or substitute reader API responses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const directory = '/__owned-player-client/';
export function assertCompletedStreamObservation(event, traces, calls, origin) {
  assert.equal(event.error, 'net::ERR_ABORTED');
  assert.match(event.sequence ?? '', /^[1-9][0-9]*$/);
  assert.ok(['/play-api/v1/admissions', '/play-api/v1/status', '/play-api/v1/file', '/play-api/v1/registry'].includes(event.path));
  const matches = traces.filter(row => row.sequence === event.sequence), replies = calls.filter(row => row.sequence === event.sequence);
  assert.equal(matches.length, 1); assert.equal(replies.length, 1);
  const [trace] = matches, [reply] = replies;
  assert.equal(reply.origin, origin); assert.equal(reply.path, event.path);
  assert.equal(trace.completed, true); assert.equal(trace.cancelled, false);
  assert.equal(trace.status, reply.status); assert.equal(trace.bytes, reply.bytes);
  assert.ok(Number.isSafeInteger(trace.bytes) && trace.bytes > 0);
  return Object.freeze({ ...event, bytes: trace.bytes, status: trace.status });
}
// Only exact manifest-pinned season PNGs, never an arbitrary static error.
export function assertCompletedProgramStream(event, traces, calls, { origin, basePath, files }) {
  assert.equal(/^\/program-assets\/[a-f0-9]{64}\/$/.exec(basePath)?.[0], basePath);
  assert.ok(event.path.startsWith(basePath));
  const path = event.path.slice(basePath.length);
  assert.match(path, /^content\/builtin\/compiled\/map-2-[a-f0-9]{64}\/(?:map_atlas_|map_tiles_)(?:spring|summer|autumn|winter)\.png$/);
  const file = files.get(path); assert.equal(file?.kind, 'asset'); assert.match(file.sha256, /^[a-f0-9]{64}$/);
  assert.equal(event.error, 'net::ERR_ABORTED'); assert.match(event.sequence ?? '', /^[1-9][0-9]*$/);
  const matches = traces.filter(row => row.sequence === event.sequence), replies = calls.filter(row => row.sequence === event.sequence);
  assert.equal(matches.length, 1); assert.equal(replies.length, 1);
  const [trace] = matches, [reply] = replies;
  assert.equal(reply.origin, origin); assert.equal(reply.path, event.path); assert.equal(reply.status, 200);
  assert.equal(reply.sha256, file.sha256); assert.equal(reply.bytes, file.byteLength);
  assert.equal(trace.completed, true); assert.equal(trace.cancelled, false); assert.equal(trace.status, reply.status);
  assert.equal(trace.bytes, reply.bytes); assert.ok(Number.isSafeInteger(trace.bytes) && trace.bytes > 0);
  return Object.freeze({ ...event, bytes: trace.bytes, status: trace.status });
}
export function createPlayerClientBrowserProbe({ page, context, origin, gameId, chapters }) {
  const modules = new Map(['playerclient.js', 'runtimecontract.js'].map(name => [directory + name, readFileSync('web/src/player/' + name)]));
  const sources = Object.fromEntries([...modules].map(([path, bytes]) => ['web/src/player/' + path.slice(directory.length), createHash('sha256').update(bytes).digest('hex')]));
  const checks = [];
  let identity, chapterDigest, resources = 0, served = 0;
  return {
    sources,
    async serve(route, url) {
      const bytes = modules.get(url.pathname);
      if (!bytes) return false;
      assert.equal(url.search, ''); assert.equal(route.request().method(), 'GET'); served++;
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, body: bytes });
      return true;
    },
    async start(index, expectedChapters) {
      await page.evaluate(async ({ origin, path }) => {
        window.__ownedStorage = 0;
        for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { window.__ownedStorage++; throw new Error('player storage forbidden'); } });
        const { createPlayerReader } = await import(path);
        const traces = [];
        const transport = async (url, options) => {
          const sequence = String(traces.length + 1);
          const trace = { sequence, completed: false, cancelled: false, bytes: 0, status: null };
          traces.push(trace);
          // Observe native streaming without replacing bytes, responses or errors.
          // The test-only header correlates CDP events with this exact request.
          const response = await fetch(url, { ...options, headers: { ...options.headers, 'X-Owned-Client-Request': sequence } });
          trace.status = response.status;
          const body = response.body, getReader = body.getReader.bind(body);
          Object.defineProperty(body, 'getReader', { value() {
            const reader = getReader();
            return {
              async read() { const row = await reader.read(); if (row.done) trace.completed = true; else trace.bytes += row.value.byteLength; return row; },
              cancel() { trace.cancelled = true; return reader.cancel(); },
              releaseLock() { return reader.releaseLock(); },
            };
          } });
          return response;
        };
        window.__ownedPlayer = { reader: createPlayerReader({ origin, fetch: transport }), traces };
      }, { origin, path: directory + 'playerclient.js' });
      // A real same-origin browser cookie must not be sent by the client fetch.
      await context.addCookies([{ name: 'owned-player-transport', value: 'must-not-send', url: origin, secure: true, sameSite: 'Strict' }]);
      let result;
      try {
        result = await page.evaluate(async ({ gameId, chapters, roles }) => {
          const owner = window.__ownedPlayer, rows = [];
          for (const chapterId of chapters) {
            const session = await owner.reader.admit({ gameId, ordinal: '1.0', chapterId });
            if (!Object.isFrozen(session) || !Object.isFrozen(session.identity) || !Object.isFrozen(session.identity.chapters) || 'ticket' in session || 'ticket' in session.identity) throw new Error('public capability shape');
            const manifest = await session.read('manifest'), chapter = await session.read('chapter:' + chapterId);
            rows.push({ chapterId, digest: chapter.sha256, manifest: manifest.sha256 });
            if (!owner.session) owner.session = session; else session.close();
          }
          const assets = [];
          for (const role of roles) { const value = await owner.session.read(role); assets.push({ role, digest: value.sha256, length: value.bytes.length, type: value.contentType }); }
          return { rows, assets, identity: owner.session.identity, state: owner.session.state() };
        }, { gameId, chapters, roles: Object.keys(index.resources).filter(role => role.startsWith('asset:')) });
      } finally { await context.clearCookies({ name: 'owned-player-transport', domain: new URL(origin).hostname, path: '/' }); }
      assert.equal(result.state, 'active'); assert.deepEqual(result.rows.map(row => ({ chapterId: row.chapterId, digest: row.digest })), expectedChapters);
      for (const row of result.rows) assert.equal(row.manifest, index.resources.manifest.sha256);
      for (const row of result.assets) { const ref = index.resources[row.role]; assert.equal(row.digest, ref.sha256); assert.equal(row.length, ref.byteLength); assert.equal(row.type, ref.contentType); }
      identity = result.identity; chapterDigest = result.rows[0].digest; resources = result.assets.length;
      assert.equal(served, 2); assert.equal(identity.ordinal, '1.0');
      checks.push('native browser client: 20 compiled chapters, manifest binding and every indexed asset; cookie omitted, no persistent storage');
    },
    async unavailable() {
      const result = await page.evaluate(async () => {
        const session = window.__ownedPlayer.session;
        try { await session.read('chapter:' + session.identity.chapterId); return { unexpected: true }; }
        catch (error) { return { code: error.code, status: error.status, state: session.state() }; }
      });
      assert.deepEqual(result, { code: 'RUNTIME_UNAVAILABLE', status: 503, state: 'active' });
      checks.push('missing actual R2 chapter is nonterminal 503, not deletion');
    },
    async recovered() {
      const result = await page.evaluate(async () => { const session = window.__ownedPlayer.session; return { digest: (await session.read('chapter:' + session.identity.chapterId)).sha256, identity: session.identity, state: session.state() }; });
      assert.deepEqual(result, { digest: chapterDigest, identity, state: 'active' });
      checks.push('restored exact owned chapter is readable with the same session');
    },
    async observe(listed) {
      const result = await page.evaluate(async ({ listed, gameId }) => {
        const { reader, session } = window.__ownedPlayer;
        const status = await session.status(), data = await session.read('chapter:' + session.identity.chapterId);
        let rejected;
        try { await reader.admit({ gameId, ordinal: listed ? '1.0' : '1.1', chapterId: session.identity.chapterId }); }
        catch (error) { rejected = { code: error.code, status: error.status }; }
        let current = null;
        if (listed) {
          const next = await reader.admit({ gameId, ordinal: '1.1', chapterId: session.identity.chapterId });
          await next.read('manifest'); await next.read('chapter:' + next.identity.chapterId);
          current = next.identity.ordinal; next.close(); if (next.state() !== 'closed') throw new Error('close failed');
        }
        return { status, rejected, current, identity: session.identity, digest: data.sha256, state: session.state() };
      }, { listed, gameId });
      assert.equal(result.status.listed, listed); if (listed) assert.equal(result.status.ordinal, '1.1');
      assert.deepEqual(result.identity, identity); assert.equal(result.digest, chapterDigest); assert.equal(result.state, 'active');
      assert.deepEqual(result.rejected, listed ? { code: 'RELEASE_CHANGED', status: 409 } : { code: 'GAME_NOT_LISTED', status: 403 });
      assert.equal(result.current, listed ? '1.1' : null);
      checks.push(listed ? 'update rejects old new-admission, admits current version, never replaces the old session' : 'unlisting rejects new admission while old session still reads');
    },
    async deleted() {
      const result = await page.evaluate(async () => {
        const session = window.__ownedPlayer.session, failures = [];
        for (let i = 0; i < 2; i++) try { await session.read('chapter:' + session.identity.chapterId); } catch (error) { failures.push({ code: error.code, status: error.status }); }
        return { failures, identity: session.identity, state: session.state(), storage: window.__ownedStorage, idb: window.__ownedIDB };
      });
      assert.deepEqual(result.failures, [{ code: 'GAME_DELETED', status: 410 }, { code: 'GAME_DELETED', status: 410 }]);
      assert.deepEqual(result.identity, identity); assert.equal(result.state, 'deleted'); assert.equal(result.storage, 0); assert.equal(result.idb, 0);
      checks.push('explicit deletion retires the browser session; second read is local and no persistent stores were accessed');
    },
    async traces() { return page.evaluate(() => window.__ownedPlayer.traces); },
    report() { return { checks, resources, modulesServed: served, sources }; },
  };
}
