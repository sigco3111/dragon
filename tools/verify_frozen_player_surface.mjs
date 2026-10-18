// Owned memory SQLite and FileBucket only; no browser, HTTP or cloud access.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
register('../vps/text-loader.mjs', import.meta.url);
const { createEditorApplication, createEditorGateway, default: legacyGateway } = await import('../server/editorapp.js');
const own = mkdtempSync(join(tmpdir(), 'dragon-frozen-surface-'));
const editor = 'https://owned-editor.invalid', player = 'https://owned-player.invalid';
const env = { EDITOR_ORIGIN: editor, EDITOR_PLAY_ORIGIN: player, EDITOR_REQUEST_KEY: 'c'.repeat(64), EDITOR_DEFAULT_PASSWORD: 'Owned player surface password!' };
const paths = ['/api/published-games', '/api/published-games?game=private', '/api/announcements', '/api/announcements?cursor=private', '/api/trial-pack', '/api/trial-pack?game=wolong-builtin', '/api/trial-asset?game=private', '/api/play/web/src/game/clock.js', '/api/play/web/private/unknown', '/api/play/web/content/builtin/compiled/unknown.png', '/content/builtin/compiled/unknown.png'];
const runtimeStager = { async stage() { throw new Error('no publish in this test'); }, verifyStaged() { throw new Error('no stage proof'); } };
let checks = 0;
const check = () => checks++;
async function closed(reply) {
  assert.equal(reply.status, 503); assert.deepEqual(await reply.json(), { error: 'PLAY_READER_REQUIRED' });
  assert.equal(reply.headers.get('cache-control'), 'no-store'); assert.equal(reply.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(reply.headers.get('location'), null); assert.equal(reply.headers.get('set-cookie'), null);
}
try {
  for (const value of [null, 0, 1, 'true', {}, []]) { assert.throws(() => createEditorGateway({ frozenPublication: value }), TypeError); check(); }
  const gateway = createEditorGateway({ frozenPublication: true }); let rpc = 0;
  const bindings = { ...env, EDITOR_METADATA: { idFromName() { rpc++; throw new Error('closed routes must not reach authority'); } } };
  for (const origin of [editor, player]) for (const path of ['/play', '/play?game=private', ...paths]) {
    await closed(await gateway.fetch(new Request(origin + path, { headers: { Cookie: '__Secure-dragon-editor=invalid', 'X-Frozen-Publication': 'false' } }), bindings));
  }
  assert.equal(rpc, 0); check();
  // Static editor modules remain available; query/headers/env cannot switch mode.
  for (const path of ['/', '/client.js', '/publish.js', '/style.css']) assert.equal((await gateway.fetch(new Request(editor + path), bindings)).status, 200);
  await closed(await gateway.fetch(new Request(editor + '/play?frozenPublication=false'), { ...bindings, frozenPublication: false })); check();
  for (const old of [legacyGateway, createEditorGateway({ frozenPublication: false })]) {
    assert.equal((await old.fetch(new Request(editor + '/play'), bindings)).status, 200);
    assert.equal((await old.fetch(new Request(player + '/play'), bindings)).status, 200);
  }
  assert.equal(rpc, 0); check();
  // Independently guard the authority: bypassing the configured gateway must not
  // reach live SQL projections, packs, library reads or automatic account seed.
  const bucket = new FileBucket({ root: join(own, 'private') });
  for (const frozenPublication of [false, true]) {
    const storage = openStorage(':memory:');
    try {
      const App = createEditorApplication(class {}, { runtimeStager, frozenPublication });
      const app = new App({ storage }, { ...env, EDITOR_BLOBS: bucket });
      let seeds = 0, liveReads = 0;
      app.seed = () => { seeds++; };
      app.publishedGames.list = () => { liveReads++; return [{ privateMarker: 'live-SQL-not-confirmed' }]; };
      app.announcements.list = () => { liveReads++; return { privateMarker: 'local-time-not-root' }; };
      if (frozenPublication) {
        for (const origin of [editor, player]) for (const path of paths) await closed(await app.fetch(new Request(origin + path)));
        assert.equal(seeds, 0); assert.equal(liveReads, 0); check();
        // Wrong origins and authenticated Trial/editor paths retain their own gates.
        assert.equal((await app.fetch(new Request('https://foreign.invalid/api/published-games'))).status, 403);
        assert.equal((await app.fetch(new Request(editor + '/api/games'))).status, 401);
        assert.equal((await app.fetch(new Request(editor + '/api/trial/web/src/game/clock.js'))).status, 401);
        assert.equal((await app.fetch(new Request(editor + '/api/trials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/pack'))).status, 401);
        assert.equal((await app.fetch(new Request(editor + '/api/health'))).status, 200); check();
        // An accidentally old gateway still cannot expose the frozen authority's data.
        const lower = { ...env, EDITOR_METADATA: { idFromName: name => name, get: () => app } };
        await closed(await legacyGateway.fetch(new Request(editor + '/api/published-games'), lower)); check();
      } else {
        const games = await app.fetch(new Request(editor + '/api/published-games'));
        assert.equal(games.status, 200); assert.equal((await games.json()).games[1].privateMarker, 'live-SQL-not-confirmed');
        const announcements = await app.fetch(new Request(editor + '/api/announcements'));
        assert.equal(announcements.status, 200); assert.equal((await announcements.json()).privateMarker, 'local-time-not-root');
        assert.equal(seeds, 2); assert.equal(liveReads, 2); check();
      }
    } finally { storage.close(); }
  }
  process.stdout.write(JSON.stringify({ checks, scope: 'trusted frozen gateway and independent authority closure; live-read sentinels, real memory SQLite, no network/game proof' }) + '\n');
} finally { rmSync(own, { recursive: true, force: true }); }
