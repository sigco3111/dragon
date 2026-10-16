// VPS publisher: committed SQLite release → R2 `dragon` bucket layout.
// Layout (prefix overridable for tests, default prod root):
//   artifacts/<gameId>/<ordinal>/<sha256>  immutable pack bytes (If-None-Match)
//   artifacts/<gameId>/<ordinal>/manifest.json + chapters/<chapterId>.json
//   projections/<generation>/<digest>/projection.json
//   control/current.json  CAS root ({generation, digest}; create or If-Match)
// Single-version semantics: only listed=1 games; only current release rows.
// Usage: node vps/publish_to_r2.mjs --db <sqlite> --env <envfile> [--prefix test/<id>/] [--game <gameId>]
// Prints a JSON receipt. Credentials only from the env file, never logged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { r2client } from './r2client.mjs';
import { DistributionOutbox } from '../server/distribution.js';

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
  // A per-game snapshot must never replace the global production directory.
  if (onlyGame && !/^test\/[A-Za-z0-9_-]+\/$/.test(prefix)) { throw new Error('partial projection requires isolated test prefix'); }
  const games = db.prepare(`SELECT p.game_id,p.pin_json FROM published_games p JOIN content_games g ON g.game_id=p.game_id WHERE g.listed=1${onlyGame ? ' AND p.game_id=?' : ''} ORDER BY p.game_id`).all(...(onlyGame ? [onlyGame] : []));
  if (!games.length) { throw new Error('no listed published games'); }
  const files = [];
  for (const { game_id: gameId, pin_json: pinRaw } of games) {
    const pin = parsePin(gameId, pinRaw);
    const pack = db.prepare('SELECT manifest_json FROM published_packs WHERE game_id=?').get(gameId);
    if (!pack) { throw new Error(`no pack for ${gameId}`); }
    const base = `${prefix}artifacts/${gameId}/${pin.ordinal}/`;
    files.push({ key: `${base}manifest.json`, bytes: Buffer.from(pack.manifest_json), contentType: 'application/json' });
    for (const row of db.prepare('SELECT chapter_id,state_json FROM published_pack_chapters WHERE game_id=? ORDER BY chapter_id').all(gameId)) {
      files.push({ key: `${base}chapters/${row.chapter_id}.json`, bytes: Buffer.from(row.state_json), contentType: 'application/json' });
    }
    for (const row of db.prepare('SELECT asset_id,sha256,byte_length,bytes FROM published_pack_assets WHERE game_id=? ORDER BY asset_id').all(gameId)) {
      const bytes = Buffer.from(row.bytes);
      if (sha256hex(bytes) !== row.sha256 || bytes.length !== row.byte_length) { throw new Error(`asset corrupt ${gameId}/${row.asset_id}`); }
      files.push({ key: `${base}${row.sha256}`, bytes, contentType: 'application/octet-stream' });
    }
  }
  const directory = games.map(({ game_id: gameId, pin_json: pinRaw }) => { const pin = parsePin(gameId, pinRaw); return { gameId, name: pin.name, ordinal: pin.ordinal, revision: pin.revision, sourceDigest: pin.sourceDigest, publishedAt: pin.publishedAt }; });
  const announcements = db.prepare('SELECT a.* FROM content_announcements a JOIN content_games g ON g.game_id=a.game_id WHERE g.listed=1 ORDER BY a.first_online_at DESC,a.announcement_id DESC').all()
    .map(r => ({ gameId: r.game_id, ordinal: r.ordinal, name: r.name, creatorAccount: r.creator_account, publishedAt: r.published_at, firstOnlineAt: r.first_online_at }));
  const publicIds = new Set(games.map(g => g.game_id));
  const releases = db.prepare('SELECT game_id,release_id,ordinal,draft_revision,source_digest,created_at FROM content_releases ORDER BY game_id,ordinal').all().filter(r => publicIds.has(r.game_id));
  return { files, directory, announcements: announcements.filter(r => publicIds.has(r.gameId)), releases, gameIds: [...publicIds] };
}

export async function uploadRelease(r2, prefix, payload, priorControl) {
  const uploaded = [];
  for (const file of payload.files) {
    const put = await r2.putImmutable(file.key, file.bytes, file.contentType);
    if (!put) {
      // Same key = same content by construction (sha-addressed or single-version
      // ordinal paths); verify instead of overwriting.
      const existing = await r2.get(file.key);
      if (!existing || !existing.bytes.equals(Buffer.from(file.bytes))) { throw new Error(`immutable mismatch ${file.key}`); }
    }
    uploaded.push(file.key);
  }
  const projection = { directory: payload.directory, announcements: payload.announcements, releases: payload.releases, generatedAt: new Date().toISOString() };
  const projectionBytes = Buffer.from(JSON.stringify(projection));
  const digest = sha256hex(projectionBytes);
  let prior = null;
  if (priorControl) {
    try { prior = JSON.parse(priorControl.bytes.toString('utf8')); }
    catch { throw new Error('control corrupt'); }
  }
  const generation = (prior?.generation ?? 0) + 1;
  const projKey = `${prefix}projections/${generation}/${digest}/projection.json`;
  await r2.putImmutable(projKey, projectionBytes, 'application/json');
  uploaded.push(projKey);
  const control = { generation, digest, previousDigest: prior?.digest ?? null };
  const etagOf = r => r.headers.etag ?? r.headers.Etag ?? null;
  const controlResult = priorControl
    ? await r2.putControl(`${prefix}control/current.json`, Buffer.from(JSON.stringify(control)), etagOf(priorControl))
    : await r2.putControl(`${prefix}control/current.json`, Buffer.from(JSON.stringify(control)), null);
  if (!controlResult) { throw new Error('CONTROL_CAS_CONFLICT'); }
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
    const payload = buildPayload(db, { prefix, onlyGame });
    const priorControl = await r2.get(`${prefix}control/current.json`);
    const { uploaded, generation, digest } = await uploadRelease(r2, prefix, payload, priorControl);
    process.stdout.write(JSON.stringify({ result: 'PUBLISHED-TO-R2', games: payload.gameIds, generation, digest, uploaded: uploaded.length, keys: uploaded }) + '\n');
  } finally { db.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { await main().catch(error => { process.stderr.write(`publisher failed: ${String(error.message).slice(0, 200)}\n`); process.exitCode = 1; }); }
