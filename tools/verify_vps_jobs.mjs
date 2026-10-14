// V1 slice 7: run the REAL server/jobs.js CompileJobs on the VPS SQLite
// port: enqueue/replay/claim/heartbeat/checkpoint/fail/retry plus
// lease-expiry/epoch/pipeline/snapshot gates. Usage:
// node tools/verify_vps_jobs.mjs
import { openStorage } from '../vps/sqlite-port.mjs';
import { CompileJobs } from '../server/jobs.js';
import { HttpError, fail } from '../server/security.js';

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
const sleep = ms => new Promise(r => setTimeout(r, ms));

const storage = openStorage(':memory:');
const actors = { h1: { id: 'u1', epoch: 1, must_change: 0 }, h2: { id: 'u2', epoch: 1, must_change: 0 } };
const principal = h => { if (!actors[h]) { fail(401, 'SESSION_INVALID'); } return actors[h]; };
const GAME = '44444444-4444-4444-8444-444444444444';
let snapChanged = false;
const metadata = {
  snapshotReference: (_tokenHash, gameId, rev) => ({
    gameId, draftRevision: rev,
    rootKey: `private/${gameId}/${snapChanged ? 'e'.repeat(64) : 'a'.repeat(64)}`,
    sourceDigest: 'b'.repeat(64), dependencyDigest: 'c'.repeat(64),
  }),
};
const cfg = { storage, principal, metadata, verifyCheckpoint: async ({ digest }) => ({ digest }), compilerRevision: 'test-compiler-1', profileRevision: 'fixed-copy-1', stages: ['validate', 'compile'], leaseMs: 100000 };
const jobs = new CompileJobs(cfg);
check('construct', !!jobs);
try { new CompileJobs({ ...cfg, leaseMs: 0 }); check('bad config throws', false); }
catch (e) { check('bad config throws', e instanceof TypeError); }

const j1 = jobs.enqueue('h1', { key: 'job-key-0000000001', gameId: GAME, draftRevision: '1', scope: 'all' });
check('enqueue queued', j1.state === 'queued' && j1.rowRevision === '1' && j1.stage === 0);
const j1r = jobs.enqueue('h1', { key: 'job-key-0000000001', gameId: GAME, draftRevision: '1', scope: 'all' });
check('enqueue replay same job', j1r.operationId === j1.operationId);
fails('bad scope 422', () => jobs.enqueue('h1', { key: 'job-key-0000000002', gameId: GAME, draftRevision: '1', scope: 'part' }), 'JOB_SCOPE');
fails('bad game 422', () => jobs.enqueue('h1', { key: 'job-key-0000000003', gameId: 'nope', draftRevision: '1', scope: 'all' }), 'JOB_GAME_ID');
check('query', jobs.query('h1', j1.operationId).operationId === j1.operationId);
fails('cross-actor 404', () => jobs.query('h2', j1.operationId), 'JOB_NOT_FOUND');

const c1 = jobs.claim('h1', j1.operationId, '1');
check('claim running', c1.job.state === 'running' && c1.job.attempt === 1 && !!c1.capability);
fails('claim stale rev 409', () => jobs.claim('h1', j1.operationId, '1'), 'JOB_CHANGED');
fails('reclaim running 409', () => jobs.claim('h1', j1.operationId, '2'), 'JOB_NOT_CLAIMABLE');
const hb = jobs.heartbeat('h1', c1.capability, '2');
check('heartbeat extends', hb.rowRevision === '3' && hb.state === 'running');

const outs = [{ assetId: 'a1', sha256: 'f'.repeat(64), byteLength: 10 }];
const cp1 = await jobs.checkpoint('h1', c1.capability, { expectedRevision: '3', stage: 'validate', outputs: outs });
check('checkpoint stage0', cp1.stage === 1 && cp1.state === 'running');
await fails('wrong stage 409', async () => jobs.checkpoint('h1', c1.capability, { expectedRevision: '4', stage: 'validate', outputs: outs }), 'JOB_STAGE');
await await fails('bad outputs 422', async () => jobs.checkpoint('h1', c1.capability, { expectedRevision: '4', stage: 'compile', outputs: [{ assetId: 'a1', sha256: 'zz', byteLength: 10 }] }), 'JOB_OUTPUT');
const cp2 = await jobs.checkpoint('h1', c1.capability, { expectedRevision: '4', stage: 'compile', outputs: outs });
check('checkpoint ready', cp2.state === 'ready' && cp2.stage === 2);
const doneRow = storage.sql.exec('SELECT lease_until, lease_hash FROM compile_jobs WHERE job_id=?', j1.operationId).toArray()[0];
check('ready lease cleared', doneRow.lease_until === 0 && doneRow.lease_hash === null);

const j2 = jobs.enqueue('h1', { key: 'job-key-0000000004', gameId: GAME, draftRevision: '1', scope: 'all' });
const c2 = jobs.claim('h1', j2.operationId, '1');
const f2 = jobs.fail('h1', c2.capability, { expectedRevision: '2', code: 'COMPILE_ERROR', retryable: true });
check('fail recorded', f2.state === 'failed' && f2.failureCode === 'COMPILE_ERROR' && f2.retryable === true);
const r2 = jobs.retry('h1', { key: 'job-key-0000000005', operationId: j2.operationId, expectedRevision: '3' });
check('retry queued', r2.state === 'queued');
const r2r = jobs.retry('h1', { key: 'job-key-0000000005', operationId: j2.operationId, expectedRevision: '3' });
check('retry replay', r2r.rowRevision === r2.rowRevision);
fails('retry ready 409', () => jobs.retry('h1', { key: 'job-key-0000000006', operationId: j1.operationId, expectedRevision: '5' }), 'JOB_NOT_RETRYABLE');

const jobsFast = new CompileJobs({ ...cfg, leaseMs: 60 });
const jf = jobsFast.enqueue('h1', { key: 'job-key-0000000007', gameId: GAME, draftRevision: '1', scope: 'all' });
const cf = jobsFast.claim('h1', jf.operationId, '1');
await sleep(120);
fails('lease expiry 409', () => jobsFast.heartbeat('h1', cf.capability, '2'), 'JOB_LEASE_EXPIRED');

actors.h1.epoch = 2;
fails('epoch revoked 409', () => jobs.query('h1', j1.operationId), 'JOB_AUTH_REVOKED');
actors.h1.epoch = 1;

const jobsNew = new CompileJobs({ ...cfg, compilerRevision: 'test-compiler-2' });
fails('pipeline changed 409', () => jobsNew.assertPipeline('h1', j1.operationId), 'JOB_PIPELINE_CHANGED');

snapChanged = true;
fails('snapshot changed 409', () => jobs.query('h1', j1.operationId), 'JOB_SNAPSHOT_CHANGED');
snapChanged = false;

const jobsBadProof = new CompileJobs({ ...cfg, verifyCheckpoint: async () => ({ digest: '0'.repeat(64) }) });
const jb = jobsBadProof.enqueue('h1', { key: 'job-key-0000000008', gameId: GAME, draftRevision: '1', scope: 'all' });
const cb = jobsBadProof.claim('h1', jb.operationId, '1');
await fails('proof mismatch 422', async () => jobsBadProof.checkpoint('h1', cb.capability, { expectedRevision: '2', stage: 'validate', outputs: outs }), 'JOB_OUTPUT_PROOF');

console.log(`passed ${passed} checks`);
