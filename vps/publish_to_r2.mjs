// VPS publisher: committed SQLite release → R2 `dragon` bucket layout.
// Layout (prefix overridable for tests, default prod root):
//   artifacts/<gameId>/<ordinal>/<sha256>  immutable pack bytes (If-None-Match)
//   artifacts/<gameId>/<ordinal>/manifest.json + chapters/<chapterId>.json
//   projections/<generation>/<digest>/projection.json
//   control/current.json  CAS root ({generation, digest}; create or If-Match)
// Only the current listed version is discoverable. Immutable runtime indexes
// and bytes survive updates/unlisting for previously admitted games (decision A).
// Usage: node vps/publish_to_r2.mjs --db <sqlite> --env <envfile> [--prefix test/<id>/] [--game <gameId>]
// Prints a JSON receipt. Credentials only from the env file, never logged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { r2client } from './r2client.mjs';
import { DistributionOutbox } from '../server/distribution.js';
import { buildRuntimeIndex } from './runtime-index.mjs';
import { MAX_METADATA_BYTES, isGameId, requireValue } from '../reader/runtimecontract.js';
import { validatePublicationRoot } from '../reader/publicationroot.js';

// node:sqlite → workerd storage 形状适配（仅 publisher 本地排空用）。
export function nodeStorage(db) {
  const sql = {
    // workerd exec() executes eagerly; toArray() only reads the cursor.
    // node:sqlite .all() silently skips DDL/DML, so route by statement kind.
    exec: (query, ...values) => {
      if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(query)) {
        const rows = db.prepare(query).all(...values);
        return { toArray: () => rows };
      }
      db.prepare(query).run(...values);
      return { toArray: () => [] };
    },
  };
  const transactionSync = fn => {
    db.exec('BEGIN');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw error; }
  };
  return { sql, transactionSync };
}

const sha256hex = bytes => createHash('sha256').update(bytes).digest('hex');
export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--drain') { result.drain = true; }
    else if (['--db', '--env', '--prefix', '--game'].includes(name) && argv[i + 1] && !argv[i + 1].startsWith('--')) { result[name.slice(2)] = argv[++i]; }
    else { throw new Error('invalid publisher arguments'); }
  }
  if (result.drain && result.game) { throw new Error('--drain cannot be combined with --game'); }
  return result;
}

function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const get = k => { const l = lines.find(x => x.toLowerCase().replace(/[^a-z]/g, '').startsWith(k)); return l?.split('=').slice(1).join('=').trim(); };
  return { accountId: get('accountid'), accessKeyId: get('accesskeyid'), secretAccessKey: get('secretaccesskey') };
}

function parsePin(gameId, raw) {
  try { return JSON.parse(raw); }
  catch { throw new Error(`pin corrupt ${gameId}`); }
}

export function buildPayload(db, { prefix = '', onlyGame = null } = {}) {
  requireValue(typeof prefix === 'string' && (prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)), 'publication prefix invalid');
  // A per-game snapshot must never replace the global production directory.
  if (onlyGame && !/^test\/[A-Za-z0-9_-]+\/$/.test(prefix)) { throw new Error('partial projection requires isolated test prefix'); }
  const games = db.prepare(`SELECT p.game_id,p.pin_json FROM published_games p JOIN content_games g ON g.game_id=p.game_id WHERE g.listed=1${onlyGame ? ' AND p.game_id=?' : ''} ORDER BY p.game_id`).all(...(onlyGame ? [onlyGame] : []));
  // A complete empty directory is meaningful: the last game was unlisted.
  // Refusing it would leave the previous public directory visible forever.
  if (!games.length && onlyGame) { throw new Error('no listed published game for test selection'); }
  const files = [], dependencies = [], directory = [], releases = [];
  for (const { game_id: gameId, pin_json: pinRaw } of games) {
    const pin = parsePin(gameId, pinRaw);
    requireValue(pin?.gameId === gameId && typeof pin.name === 'string' && typeof pin.publishedAt === 'string', 'pin corrupt');
    const pack = db.prepare('SELECT revision,source_digest,manifest_json FROM published_packs WHERE game_id=?').get(gameId);
    const release = db.prepare('SELECT game_id,release_id,ordinal,draft_revision,source_digest,created_at FROM content_releases WHERE game_id=? AND ordinal=?').get(gameId, pin.ordinal);
    const chapters = db.prepare('SELECT chapter_id,state_json FROM published_pack_chapters WHERE game_id=? ORDER BY chapter_id').all(gameId);
    const assets = db.prepare('SELECT asset_id,sha256,byte_length,bytes FROM published_pack_assets WHERE game_id=? ORDER BY asset_id').all(gameId);
    const runtime = buildRuntimeIndex(pin, release, pack, chapters, assets);
    files.push(...runtime.files.map(file => ({ ...file, key: `${prefix}${file.key}` })));
    dependencies.push(...runtime.dependencies.map(ref => ({ ...ref, key: `${prefix}${ref.key}` })));
    releases.push({ ...release, runtime: runtime.reference });
    directory.push({ gameId, name: pin.name, ordinal: pin.ordinal, releaseId: release.release_id, revision: pin.revision, sourceDigest: pin.sourceDigest, publishedAt: pin.publishedAt, chapters: [...pin.chapters] });
  }
  const announcements = db.prepare('SELECT a.* FROM content_announcements a JOIN content_games g ON g.game_id=a.game_id WHERE g.listed=1 ORDER BY a.first_online_at DESC,a.announcement_id DESC').all()
    .map(r => ({ gameId: r.game_id, ordinal: r.ordinal, name: r.name, creatorAccount: r.creator_account, publishedAt: r.published_at, firstOnlineAt: r.first_online_at }));
  const publicIds = new Set(games.map(g => g.game_id));
  // State is not a directory: no draft names/content are exposed. Unlisted
  // games remain here so an already signed old game can continue fetching.
  const gameStates = db.prepare(`SELECT game_id,listed FROM content_games${onlyGame ? ' WHERE game_id=?' : ''} ORDER BY game_id`).all(...(onlyGame ? [onlyGame] : [])).map(row => {
    requireValue(isGameId(row.game_id) && (row.listed === 0 || row.listed === 1));
    return { gameId: row.game_id, listed: row.listed === 1 };
  });
  return { runtimeVersion: 1, files, dependencies, directory, gameStates, announcements: announcements.filter(r => publicIds.has(r.gameId)), releases, gameIds: [...publicIds] };
}

export async function uploadRelease(r2, prefix, payload, priorControl) {
  requireValue(typeof prefix === 'string' && (prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix)), 'publication prefix invalid');
  // Validate the previously observed root before any writes; never infer a
  // generation from a corrupt value or silently turn a missing ETag into create.
  let prior = null, priorETag = null;
  if (priorControl) {
    try { prior = JSON.parse(priorControl.bytes.toString('utf8')); }
    catch { throw new Error('control corrupt'); }
    // Never downgrade the frozen-ledger protocol or replace its authority.
    // Reader compatibility is not permission for this legacy writer to migrate.
    if (prior && Object.hasOwn(prior, 'version')) { throw new Error('CONTROL_PROTOCOL_MISMATCH'); }
    try { validatePublicationRoot(prior); }
    catch { throw new Error('control corrupt'); }
    priorETag = priorControl.headers?.etag ?? priorControl.headers?.Etag ?? null;
    if (!Number.isSafeInteger(prior?.generation) || prior.generation < 1 ||
        prior.generation >= Number.MAX_SAFE_INTEGER || typeof prior.digest !== 'string' || !/^[a-f0-9]{64}$/.test(prior.digest) ||
        typeof priorETag !== 'string' || !priorETag) { throw new Error('control corrupt'); }
  }
  // Shared portrait dependencies already live in the private publication
  // bucket. Refuse a root that would reference missing/different library bytes.
  for (const ref of payload.dependencies) {
    const stored = await r2.get(ref.key);
    if (!stored || stored.bytes.length !== ref.byteLength || sha256hex(stored.bytes) !== ref.sha256) { throw new Error('runtime dependency mismatch'); }
  }
  const uploaded = [];
  async function putVerified(key, bytes, contentType) {
    await r2.putImmutable(key, bytes, contentType);
    // A successful PUT response is not a readback receipt. Existing keys and
    // newly created keys must both contain exactly the captured bytes.
    const stored = await r2.get(key);
    if (!stored || !Buffer.from(stored.bytes).equals(Buffer.from(bytes))) { throw new Error(`immutable mismatch ${key}`); }
    uploaded.push(key);
  }
  for (const file of payload.files) {
    await putVerified(file.key, file.bytes, file.contentType);
  }
  const projection = { runtimeVersion: payload.runtimeVersion, directory: payload.directory, gameStates: payload.gameStates, announcements: payload.announcements, releases: payload.releases, generatedAt: new Date().toISOString() };
  const projectionBytes = Buffer.from(JSON.stringify(projection));
  requireValue(projectionBytes.length <= MAX_METADATA_BYTES, 'projection too large');
  const digest = sha256hex(projectionBytes);
  const generation = (prior?.generation ?? 0) + 1;
  const projKey = `${prefix}projections/${generation}/${digest}/projection.json`;
  await putVerified(projKey, projectionBytes, 'application/json');
  const control = { generation, digest, previousDigest: prior?.digest ?? null };
  const controlBytes = Buffer.from(JSON.stringify(control));
  const controlKey = `${prefix}control/current.json`;
  const controlResult = await r2.putControl(controlKey, controlBytes, priorETag);
  if (!controlResult) { throw new Error('CONTROL_CAS_CONFLICT'); }
  const confirmed = await r2.get(controlKey);
  // The CAS may already have committed. Failure here is an unknown visibility
  // result, not rollback; drain must retain the operation rather than confirm.
  if (!confirmed || !Buffer.from(confirmed.bytes).equals(controlBytes)) { throw new Error('CONTROL_CONFIRMATION_PENDING'); }
  return { uploaded, generation, digest };
}

// Prototype drain only. V5 still owns durable payloads, listing events and
// crash/backup recovery; obsolete rows stop rather than acknowledging new data
// as an older release. Each root contains the complete listed directory.
export async function drainOutbox(db, r2, prefix = '') {
  const storage = nodeStorage(db);
  const outbox = new DistributionOutbox({ storage });
  const drained = [];
  for (const row of outbox.pending()) {
    try {
      const payload = storage.transactionSync(() => buildPayload(db, { prefix }));
      const current = payload.directory.find(g => g.gameId === row.game_id);
      if (current?.ordinal !== row.ordinal || !payload.releases.some(r => r.game_id === row.game_id && r.ordinal === row.ordinal && r.release_id === row.release_id)) {
        throw new Error('DISTRIBUTION_RELEASE_CHANGED');
      }
      const priorControl = await r2.get(`${prefix}control/current.json`);
      const { generation, digest } = await uploadRelease(r2, prefix, payload, priorControl);
      storage.transactionSync(() => outbox.confirmInTxn(row.op_id, { generation, digest }));
      drained.push({ opId: row.op_id, generation, digest });
    } catch (error) {
      storage.transactionSync(() => outbox.noteAttempt(row.op_id));
      throw error;
    }
  }
  return drained;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = args.db, envPath = args.env;
  if (!dbPath || !envPath) { throw new Error('usage: --db <sqlite> --env <envfile> [--prefix p/] [--game <gameId>]'); }
  const prefix = args.prefix ?? '';
  const onlyGame = args.game ?? null;
  const { accountId, accessKeyId, secretAccessKey } = loadEnv(envPath);
  const r2 = r2client({ accountId, accessKeyId, secretAccessKey, bucket: 'dragon' });
  const db = new DatabaseSync(dbPath, { readonly: !args.drain });
  try {
    if (args.drain) {
      const drained = await drainOutbox(db, r2, prefix);
      process.stdout.write(JSON.stringify({ result: 'DRAINED', drained }) + '\n');
      return;
    }
    const payload = nodeStorage(db).transactionSync(() => buildPayload(db, { prefix, onlyGame }));
    const priorControl = await r2.get(`${prefix}control/current.json`);
    const { uploaded, generation, digest } = await uploadRelease(r2, prefix, payload, priorControl);
    process.stdout.write(JSON.stringify({ result: 'PUBLISHED-TO-R2', games: payload.gameIds, generation, digest, uploaded: uploaded.length, keys: uploaded }) + '\n');
  } finally { db.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { await main().catch(error => { process.stderr.write(`publisher not confirmed: ${String(error.message).slice(0, 200)}\n`); process.exitCode = 1; }); }
