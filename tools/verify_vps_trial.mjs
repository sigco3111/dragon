// V1 slice 9: REAL TrialSessions issue/commit/serve/end on VPS ports with
// a REAL installed-source install (41 pinned roles verified) and the S5
// draft assembly. Usage: node tools/verify_vps_trial.mjs
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { ImmutableBlobStore } from '../server/blobs.js';
import { PrivateWriteJournal } from '../server/privatewrites.js';
import { GameMetadataStore } from '../server/metadata.js';
import { GameSnapshotVerifier } from '../server/snapshots.js';
import { PrivateDrafts } from '../server/drafts.js';
import { InstalledSourceCatalog } from '../server/sourcecatalog.js';
import { OwnedRuntimeAssets } from '../server/runtimeassets.js';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { FIXED_COPY_PROFILE } from '../server/copyprofile.js';
import { TrialSessions } from '../server/trials.js';
import { encodeSourceChunks, canonicalSourceTokens } from '../web/src/content/authoring/sourcejson.js';
import { HttpError, fail } from '../server/security.js';
import { createPinnedCopyLoader } from './editor_trusted_copy.mjs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const fails = async (name, fn, code) => {
  try { await fn(); } catch (e) {
    check(name, e instanceof HttpError && e.code === code, e?.code);
    return;
  }
  check(name, false);
};

const ADMIN = '77777777-7777-4777-8777-777777777777';
const OWNER = '88888888-8888-4888-8888-888888888888';
const OTHER = '99999999-9999-4999-8999-999999999999';
const ABSOLUTE = Date.now() + 8 * 3600000;
const actors = {
  ha: { id: ADMIN, role: 'admin', epoch: 1, must_change: 0, absolute_until: ABSOLUTE },
  h1: { id: OWNER, role: 'author', epoch: 1, must_change: 0, absolute_until: ABSOLUTE },
  h2: { id: OTHER, role: 'author', epoch: 1, must_change: 0, absolute_until: ABSOLUTE },
};
// Separate install administrator and game author. Runtime visual reads are
// owner-bound; this must not grant the author full-copy source access.

const principal = h => { if (!actors[h]) { fail(401, 'SESSION_INVALID'); } return actors[h]; };
const scratch = mkdtempSync(join(tmpdir(), 'vps-trial-'));
const storage = openStorage(':memory:');
try {
storage.transactionSync(() => {
  storage.sql.exec("CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, disabled INTEGER NOT NULL, must_change INTEGER NOT NULL, epoch INTEGER NOT NULL, version INTEGER NOT NULL)");
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', ADMIN, 'admin_s9', 'admin', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', OWNER, 'author_s9', 'author', '{}', 0, 0, 1, 1);
  storage.sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', OTHER, 'other_s9', 'author', '{}', 0, 0, 1, 1);
});
const root = join(scratch, 'data');
const bucket = new FileBucket({ root });
const journal = new PrivateWriteJournal({ storage, bucket });
const authority = () => ({ ownerId: OWNER, epoch: 1 });
const blobs = new ImmutableBlobStore({ bucket: journal, authority, storage });
const verifier = new GameSnapshotVerifier({ blobs });
const games = new GameMetadataStore({ storage, principal,
  verifySnapshot: input => verifier.verify(input.tokenHash, input),
  recoverAllocation: () => { fail(503, 'COPY_NOT_CONFIGURED'); } });

// 1. Real policy + real install of all 41 roles into the file bucket.
const policy = installedSourcePolicy(
  readFileSync('server/pinned/world-manifest.txt'),
  readFileSync('server/pinned/entity-manifest.txt'));
check('policy 41 roles', policy.roles.length === 41 && policy.registryId === 'approved-builtin-47e358-entities086-1');
const catalog = new InstalledSourceCatalog({ storage, bucket, principal, policy, operationGuard: () => {} });
const REG = policy.registryId;
const stageRaw = async bytes => {
  const data = new Uint8Array(bytes);
  const key = `installed/${REG}/${createHash('sha256').update(data).digest('hex')}`;
  if (!await bucket.get(key)) { await bucket.put(key, data, {}); }
  return { sha256: key.slice(key.lastIndexOf('/') + 1), byteLength: data.length };
};
const roleEntries = [];
for (const role of policy.roles) {
  const data = new Uint8Array(readFileSync(join('web', role.path)));
  if (data.length !== role.byteLength) { throw new Error(`pinned bytes mismatch ${role.path}`); }
  const chunks = [];
  for (let at = 0; at < data.length; at += 1048576) {
    chunks.push(await stageRaw(data.subarray(at, Math.min(at + 1048576, data.length))));
  }
  roleEntries.push({ path: role.path, sha256: role.sha256, byteLength: role.byteLength, chunks });
}
const DEF = catalog.definition().definitionDigest;
const srcIndex = { schema: 'dragon-installed-source-index-1', registryId: REG, definitionDigest: DEF, roles: roleEntries };
const srcRoot = await stageRaw(Buffer.concat(encodeSourceChunks(srcIndex)));
const installed = await catalog.install('ha', REG, srcRoot, 's9-install-00000001');
check('install registered', installed.registryId === REG && installed.rootDigest === srcRoot.sha256);

// 2. S5 game assembly, origin bound to the real catalog definition.
const allocation = games.allocateGameId('h1');
const GAME = allocation.gameId;
const loader = createPinnedCopyLoader();
const { game } = await loader({ gameId: GAME, ownerId: OWNER });
const depDigestOf = (chunks, dependencies) => { const h = createHash('sha256'); for (const t of canonicalSourceTokens({ chunks, dependencies })) h.update(t, 'utf8'); return h.digest('hex'); };
const stageGame = async bytes => {
  const put = await blobs.putImmutable('h1', { gameId: GAME, allocation: {}, bytes: new Uint8Array(bytes) });
  return { sha256: put.sha256, byteLength: put.byteLength };
};
const hAll = createHash('sha256'), chunks = [];
for (const part of encodeSourceChunks(game)) { hAll.update(part); chunks.push(await stageGame(part)); }
const sourceDigest = hAll.digest('hex');
const gIndex = { schema: 'dragon-game-source-index-1', gameId: GAME, sourceDigest, sourceByteLength: chunks.reduce((n, c) => n + c.byteLength, 0), chunks, dependencies: [] };
const gRoot = await stageGame(Buffer.concat(encodeSourceChunks(gIndex)));
storage.transactionSync(() => {
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_objects (game_id TEXT NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, state TEXT NOT NULL, PRIMARY KEY(game_id,sha256))');
  storage.sql.exec('CREATE TABLE IF NOT EXISTS copy_origins (game_id TEXT PRIMARY KEY, registry_id TEXT NOT NULL, definition_digest TEXT NOT NULL, catalog_root TEXT NOT NULL, profile_revision TEXT NOT NULL, baseline_root TEXT NOT NULL, baseline_length INTEGER NOT NULL, baseline_digest TEXT NOT NULL, source_digest TEXT NOT NULL, dependency_digest TEXT NOT NULL)');
  storage.sql.exec('INSERT INTO copy_objects VALUES(?,?,?,?)', GAME, gRoot.sha256, gRoot.byteLength, 'committed');
  storage.sql.exec('INSERT INTO copy_origins VALUES(?,?,?,?,?,?,?,?,?,?)', GAME, REG, DEF, installed.rootDigest, FIXED_COPY_PROFILE, gRoot.sha256, gRoot.byteLength, sourceDigest, sourceDigest, depDigestOf(chunks, []));
});
const drafts = new PrivateDrafts({ storage, principal, games, blobs, definition: () => catalog.definition(), operationGuard: () => {} });
const snap1 = await games.prepareSnapshot('h1', { gameId: GAME, draftRevision: '1', metadata: { ...game.metadata }, source: { sha256: gRoot.sha256, byteLength: gRoot.byteLength }, allocation });
games.transaction('h1', { key: 's9-create-00000001', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, snap1));
await drafts.save('h1', GAME, '1', 's9-save-0000000001', 'e'.repeat(64), { metadata: { ...game.metadata }, resourceEdits: [], chapterEdits: [] });
check('game ready', true);

// 3. Trial issue/commit/serve/end.
const runtimeAssets = new OwnedRuntimeAssets({ storage, bucket, principal, games, policy, kind: 'visuals' });
const trials = new TrialSessions({ storage, principal, games, drafts, runtimeAssets, policy });
check('construct', !!trials);
const chapterId = game.chapterOrder[0];
const issued = await trials.issue('h1', GAME, '1', chapterId);
check('issue active', issued.trial.state === 'active' && issued.trial.chapterId === chapterId && issued.derived.length > 0);
trials.commit('h1', issued.trial, issued.derived);
const st = trials.status('h1', issued.trial.trialId);
check('status active', st.state === 'active' && st.trialId === issued.trial.trialId);
const pack = trials.pack('h1', issued.trial.trialId);
check('pack manifest+chapter', pack.manifest.schemaVersion === 1 && pack.chapterId === chapterId && pack.binding.trialId === issued.trial.trialId);
const terrain = trials.asset('h1', issued.trial.trialId, 'terrain');
check('asset terrain', terrain.byteLength > 0 && terrain.sha256.length === 64);
await fails('unknown asset 404', async () => trials.asset('h1', issued.trial.trialId, 'nope'), 'TRIAL_ASSET_NOT_FOUND');
await fails('bad chapter 422', async () => trials.issue('h1', GAME, '1', ''), 'TRIAL_CHAPTER');
await fails('unknown trial 401', async () => trials.status('h1', randomUUID()), 'TRIAL_INVALID');

// 4. Portrait from shared manifest (B, no upload): manifest id resolves with kao URL.
const served = trials.asset('h1', issued.trial.trialId, '0');
check('portrait serve', served.mime === 'image/png' && served.url === 'kao/0.png' && served.sha256.length === 64);
await fails('portrait malformed id 422', async () => trials.asset('h1', issued.trial.trialId, 'no-such-id'), 'TRIAL_ASSET_ID');
await fails('portrait unknown 404', async () => trials.asset('h1', issued.trial.trialId, '999999'), 'TRIAL_ASSET_NOT_FOUND');

// 5. End + epoch revocation.
const pv = trials.endPreview('h1', issued.trial.trialId);
check('endPreview explicit', pv.state === 'ended' && pv.endReason === 'explicit');
const fin = trials.endCommit('h1', issued.trial.trialId, pv);
check('endCommit ended', fin.state === 'ended');
await fails('serve after end 401', async () => trials.pack('h1', issued.trial.trialId), 'TRIAL_INVALID');
await fails('author trial issue 404 (ownership first)', async () => trials.issue('h2', GAME, '1', chapterId), 'GAME_NOT_FOUND');
await fails('author full-copy source remains forbidden', async () => catalog.loadFull('h1', REG), 'FULL_COPY_SOURCE_ADMIN_REQUIRED');
actors.h1.epoch = 2;
await fails('epoch revoked 401', async () => trials.status('h1', issued.trial.trialId), 'TRIAL_INVALID');
actors.h1.epoch = 1;

process.stdout.write(`passed ${passed} checks\n`);
} finally { storage.close(); rmSync(scratch, { recursive: true, force: true }); }
