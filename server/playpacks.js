// Published play snapshots: workerd counterpart of the node build/ directory
// (POST /api/compile output + trial-pack/trial-asset serving, no auth on node).
// Publish freezes one whole-game snapshot per game (manifest + chapter states
// + binary payloads); play routes serve it anonymously. Revisions are pinned:
// republish replaces, unpublish/fence deletes. Corrupt rows fail closed.
// Manifest shape mirrors node EDITOR_BUILD_FORMAT so the unmodified playapp
// (persistent + playSaveDatabaseName isolation, browser-side) runs unchanged:
// minimap URLs keep the /api/trial-asset? shape buildFullAppVisuals demands,
// season visuals stay registry-relative (served anonymously under /content/).
import { createHash } from 'node:crypto';
import { fail } from './security.js';
import { MINIMAP_SIZES, renderMinimapPixels } from '../web/src/content/authoring/minimap.js';
import { encodePNG } from './pngio.js';
import { TRIAL_COMPILER_REVISION } from '../web/src/content/authoring/trialcompile.js';
import { installedSourcePolicy, isInstalledSourcePolicy } from './sourcecatalogpolicy.js';
import worldManifest from './pinned/world-manifest.txt';
import entityManifest from './pinned/entity-manifest.txt';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const revision = value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const shaBytes = value => createHash('sha256').update(value).digest('hex');
const ASSET_IDS = Object.freeze(['terrain', 'roadGraph', 'roadCost', 'roadOffset', 'minimapBase', 'minimapLarge']);
const ASSET_MIME = Object.freeze({ terrain: 'application/octet-stream', roadGraph: 'application/json', roadCost: 'application/octet-stream', roadOffset: 'application/json', minimapBase: 'image/png', minimapLarge: 'image/png' });
const ASSET_ROLE = Object.freeze({ terrain: 'rules-initial-terrain', roadGraph: 'native-road-v2', roadCost: 'legacy-grid-visual', roadOffset: 'legacy-grid-visual', minimapBase: 'automatic-minimap', minimapLarge: 'automatic-minimap' });
const assetURL = (gameId, rev, sourceDigest, assetId) => `/api/trial-asset?game=${encodeURIComponent(gameId)}&revision=${rev}&digest=${sourceDigest}&asset=${assetId}`;
export class PublishedPacks {
  #storage; #sql; #principal; #catalog; #policy;
  constructor({ storage, principal, catalog }) {
    if (!storage?.sql || typeof principal !== 'function') { throw new TypeError('actual SQLite and trusted principal required'); }
    this.#storage = storage; this.#sql = storage.sql; this.#principal = principal; this.#catalog = catalog ?? null;
    // Same installed-source policy the worker builds for TrialSessions.
    this.#policy = installedSourcePolicy(new TextEncoder().encode(worldManifest), new TextEncoder().encode(entityManifest));
    if (!isInstalledSourcePolicy(this.#policy)) { throw new TypeError('installed source policy required'); }
    storage.transactionSync(() => {
      this.#sql.exec('CREATE TABLE IF NOT EXISTS published_packs (game_id TEXT PRIMARY KEY, revision TEXT NOT NULL, source_digest TEXT NOT NULL, manifest_json TEXT NOT NULL, updated_at TEXT NOT NULL)');
      // Chapter states live one row per chapter: the whole-game JSON exceeds
      // the workerd SQLite single-value limit (SQLITE_TOOBIG, real-machine
      // evidence). Per-chapter JSON stays ~100KB, reassembly is verified.
      this.#sql.exec('CREATE TABLE IF NOT EXISTS published_pack_chapters (game_id TEXT NOT NULL, chapter_id TEXT NOT NULL, state_json TEXT NOT NULL, PRIMARY KEY(game_id,chapter_id))');
      this.#sql.exec('CREATE TABLE IF NOT EXISTS published_pack_assets (game_id TEXT NOT NULL, asset_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(game_id,asset_id))');
    });
  }
  get policy() { return this.#policy; }
  #one(query, ...values) { return this.#sql.exec(query, ...values).toArray()[0]; }
  #actor(tokenHash) {
    const actor = this.#principal(tokenHash);
    if (actor.must_change) { fail(403, 'PASSWORD_CHANGE_REQUIRED'); }
    return actor;
  }
  // Registry season-visual descriptors for the manifest. Same contract as
  // TrialSessions visuals (policy-bound role paths + sha, R2 re-verified at
  // serve time); the installed source is shared public art, not game data.
  async #visuals(tokenHash, gameId) {
    if (!this.#catalog) { fail(503, 'PLAY_NOT_CONFIGURED'); }
    const origin = this.#one('SELECT * FROM copy_origins WHERE game_id=?', gameId);
    if (!origin || origin.registry_id !== this.#policy.registryId || origin.profile_revision !== this.#policy.profileRevision || origin.definition_digest !== this.#catalog.definition().definitionDigest) { fail(409, 'PLAY_SOURCE_CHANGED'); }
    const source = await this.#catalog.loadFull(tokenHash, origin.registry_id);
    const visual = path => {
      const role = this.#policy.roles.find(item => item.path === path);
      if (!role) { fail(503, 'PLAY_VISUALS_BINDING'); }
      const bytes = source.readWeb(path);
      if (bytes.length !== role.byteLength || shaBytes(bytes) !== role.sha256) { fail(503, 'PLAY_VISUALS_BINDING'); }
      return Object.freeze({ path, url: role.path, sha256: role.sha256, byteLength: role.byteLength });
    };
    const rev = this.#policy.revision;
    const group = stem => Object.freeze(Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map(season => [season, visual(`content/builtin/compiled/${rev}/${stem}${season}.png`)])));
    return Object.freeze({ seasonAtlases: group('map_atlas_'), seasons: group('map_tiles_') });
  }
  // Freeze the proof-compiled snapshot the publish route already ran. Heavy
  // reads (catalog) stay outside the write transaction, as in trial issue.
  async buildAndStore(tokenHash, { game, reference, compiled }) {
    this.#actor(tokenHash);
    if (!game || game.gameId !== reference.gameId || !Array.isArray(game.chapterOrder) || game.chapterOrder.length < 1) { fail(422, 'PLAY_SNAPSHOT'); }
    const states = {};
    for (const chapterId of game.chapterOrder) {
      if (typeof chapterId !== 'string' || !chapterId) { fail(422, 'PLAY_SNAPSHOT'); }
      const state = game.chapters?.[chapterId]?.state;
      if (!state || typeof state !== 'object') { fail(422, 'PLAY_SNAPSHOT'); }
      states[chapterId] = state;
    }
    const payloads = {
      terrain: Buffer.from(compiled.terrainBytes),
      roadGraph: Buffer.from(JSON.stringify(compiled.roadGraph)),
      roadCost: Buffer.from(compiled.roadCost),
      roadOffset: Buffer.from(compiled.roadOffsetBytes),
    };
    const minimap = {};
    for (const [name, size] of Object.entries(MINIMAP_SIZES)) {
      const { pixels } = renderMinimapPixels(compiled.minimapGeography, compiled.roadMask, compiled.width, compiled.height, size.w, size.h, 1);
      minimap[`${size.w}x${size.h}`] = shaBytes(pixels);
      payloads[name === 'base' ? 'minimapBase' : 'minimapLarge'] = encodePNG(pixels, size.w, size.h, 3);
    }
    for (const bytes of Object.values(payloads)) {
      if (!(bytes instanceof Uint8Array) || bytes.length < 1) { fail(422, 'PLAY_SNAPSHOT'); }
    }
    const visuals = await this.#visuals(tokenHash, reference.gameId);
    const entries = Object.entries(payloads).map(([assetId, data]) => Object.freeze({ assetId, sha256: shaBytes(data), byteLength: data.length, role: ASSET_ROLE[assetId], url: assetURL(reference.gameId, reference.draftRevision, reference.sourceDigest, assetId) }));
    const manifest = Object.freeze({
      schemaVersion: 1, compilerRevision: TRIAL_COMPILER_REVISION, buildFormat: 'studio-app-2',
      compatibilityAssetMode: compiled.compatibilityAssetMode, ruleProfile: game.ruleProfile,
      identity: Object.freeze({ gameId: reference.gameId, draftRevision: reference.draftRevision, sourceDigest: reference.sourceDigest, trialSnapshotId: `${reference.gameId}@${reference.draftRevision}:${reference.sourceDigest}` }),
      world: Object.freeze({ id: `${reference.gameId}-world`, revision: reference.sourceDigest, width: compiled.width, height: compiled.height, tileSize: 16 }),
      chapters: Object.freeze([...game.chapterOrder]), visualAssets: visuals, minimap: Object.freeze({ ...minimap }), portraits: Object.freeze([]),
      minimapAssets: Object.freeze(entries.filter(entry => entry.assetId.startsWith('minimap'))),
      assets: Object.freeze(entries.filter(entry => !entry.assetId.startsWith('minimap'))),
    });
    const manifestJson = JSON.stringify(manifest), now = new Date().toISOString();
    this.#storage.transactionSync(() => {
      this.#sql.exec('INSERT OR REPLACE INTO published_packs VALUES(?,?,?,?,?)', reference.gameId, reference.draftRevision, reference.sourceDigest, manifestJson, now);
      this.#sql.exec('DELETE FROM published_pack_chapters WHERE game_id=?', reference.gameId);
      for (const [chapterId, state] of Object.entries(states)) {
        this.#sql.exec('INSERT INTO published_pack_chapters VALUES(?,?,?)', reference.gameId, chapterId, JSON.stringify(state));
      }
      this.#sql.exec('DELETE FROM published_pack_assets WHERE game_id=?', reference.gameId);
      for (const entry of entries) {
        const data = payloads[entry.assetId];
        this.#sql.exec('INSERT INTO published_pack_assets VALUES(?,?,?,?,?)', reference.gameId, entry.assetId, entry.sha256, entry.byteLength, Buffer.from(data));
      }
    });
    return manifest;
  }
  retire(gameId) {
    this.#sql.exec('DELETE FROM published_packs WHERE game_id=?', gameId);
    this.#sql.exec('DELETE FROM published_pack_chapters WHERE game_id=?', gameId);
    this.#sql.exec('DELETE FROM published_pack_assets WHERE game_id=?', gameId);
  }
  // Read-path pin check (same shape rules as the registry; corrupt → 500).
  #pin(gameId) {
    const row = this.#one('SELECT * FROM published_games WHERE game_id=?', gameId);
    if (!row) { fail(404, 'PLAY_UNPUBLISHED'); }
    let pin;
    try { pin = JSON.parse(row.pin_json); }
    catch { fail(500, 'PLAY_CORRUPT'); }
    if (!pin || pin.gameId !== gameId || typeof pin.name !== 'string' || !revision(pin.revision ?? null) || !digest(pin.sourceDigest) || !Array.isArray(pin.chapters) || typeof pin.publishedAt !== 'string') { fail(500, 'PLAY_CORRUPT'); }
    return pin;
  }
  #storedPack(pin) {
    const row = this.#one('SELECT * FROM published_packs WHERE game_id=?', pin.gameId);
    if (!row || row.revision !== pin.revision || row.source_digest !== pin.sourceDigest) { fail(500, 'PLAY_PACK_CORRUPT'); }
    let manifest;
    try { manifest = JSON.parse(row.manifest_json); }
    catch { fail(500, 'PLAY_PACK_CORRUPT'); }
    if (!manifest || manifest.identity?.gameId !== pin.gameId || manifest.identity?.draftRevision !== pin.revision || manifest.identity?.sourceDigest !== pin.sourceDigest) { fail(500, 'PLAY_PACK_CORRUPT'); }
    // Reassemble per-chapter rows; any missing/extra chapter is corruption.
    const rows = this.#sql.exec('SELECT chapter_id, state_json FROM published_pack_chapters WHERE game_id=?', pin.gameId).toArray();
    const states = {};
    try {
      for (const entry of rows) { states[entry.chapter_id] = JSON.parse(entry.state_json); }
    } catch { fail(500, 'PLAY_PACK_CORRUPT'); }
    const pinned = [...(pin.chapters ?? [])].sort(), stored = Object.keys(states).sort();
    if (pinned.length !== stored.length || pinned.some((id, i) => id !== stored[i])) { fail(500, 'PLAY_PACK_CORRUPT'); }
    return { manifest, states };
  }
  #serveAsset(pin, manifest, assetId) {
    const entry = [...(manifest.assets ?? []), ...(manifest.minimapAssets ?? [])].find(item => item?.assetId === assetId);
    if (!entry || !ASSET_IDS.includes(assetId) || !digest(entry.sha256) || !Number.isSafeInteger(entry.byteLength)) { fail(404, 'PLAY_ASSET'); }
    const row = this.#one('SELECT * FROM published_pack_assets WHERE game_id=? AND asset_id=?', pin.gameId, assetId);
    if (!row) { fail(500, 'PLAY_PACK_CORRUPT'); }
    const bytes = Buffer.from(row.bytes);
    if (bytes.length !== row.byte_length || shaBytes(bytes) !== row.sha256 || row.sha256 !== entry.sha256 || row.byte_length !== entry.byteLength) { fail(503, 'PLAY_ASSET_CORRUPT'); }
    return Object.freeze({ bytes, sha256: row.sha256, mime: ASSET_MIME[assetId] });
  }
  // Anonymous pinned-pack slice (node trial-pack parity: game + optional
  // revision defaulting to the pin + chapter defaulting to the first).
  pack(gameId, requestedRevision, chapterId) {
    if (gameId !== 'wolong-builtin' && !uuid(gameId)) { fail(422, 'PLAY_GAME_ID'); }
    const pin = this.#pin(gameId);
    const rev = requestedRevision ?? pin.revision;
    if (!revision(rev) || rev !== pin.revision) { fail(409, 'PLAY_SNAPSHOT_CHANGED'); }
    const { manifest, states } = this.#storedPack(pin);
    const chapter = chapterId ?? manifest.chapters?.[0] ?? null;
    if (typeof chapter !== 'string' || !states[chapter]) { fail(422, 'PLAY_CHAPTER'); }
    return Object.freeze({ manifest, chapterId: chapter, chapter: states[chapter] });
  }
  // Anonymous scoped asset (node trial-asset parity: digest must pin).
  asset(gameId, requestedRevision, sourceDigest, assetId) {
    if (gameId !== 'wolong-builtin' && !uuid(gameId)) { fail(422, 'PLAY_GAME_ID'); }
    const pin = this.#pin(gameId);
    if (!revision(requestedRevision) || requestedRevision !== pin.revision || !digest(sourceDigest) || sourceDigest !== pin.sourceDigest) { fail(409, 'PLAY_SNAPSHOT_CHANGED'); }
    if (typeof assetId !== 'string') { fail(404, 'PLAY_ASSET'); }
    const { manifest } = this.#storedPack(pin);
    return this.#serveAsset(pin, manifest, assetId);
  }
}
