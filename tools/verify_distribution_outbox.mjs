// Outbox 账本单元（无网络）：入列去重、排空确认、崩溃重放幂等。
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { DistributionOutbox } from '../server/distribution.js';
import { nodeStorage } from '../vps/publish_to_r2.mjs';

let n = 0;
const check = (label, cond) => { assert.ok(cond, label); n++; };
const db = new DatabaseSync(':memory:');
const outbox = new DistributionOutbox({ storage: nodeStorage(db) });
check('empty pending', outbox.pending().length === 0);
const first = nodeStorage(db).transactionSync(() => outbox.enqueueInTxn({ gameId: 'g1', ordinal: '1.0', releaseId: 'r1' }));
check('enqueue', first.deduped === false && first.opId === 'g1:1.0');
const again = nodeStorage(db).transactionSync(() => outbox.enqueueInTxn({ gameId: 'g1', ordinal: '1.0', releaseId: 'r1' }));
check('enqueue dedup', again.deduped === true);
check('pending one', outbox.pending().length === 1 && outbox.pending()[0].attempts === 0);
nodeStorage(db).transactionSync(() => outbox.noteAttempt('g1:1.0'));
check('attempt counted', outbox.pending()[0].attempts === 1);
const confirmed = nodeStorage(db).transactionSync(() => outbox.confirmInTxn('g1:1.0', { generation: 1, digest: 'd' }));
check('confirm', confirmed.deduped === false);
check('pending drained', outbox.pending().length === 0);
const reconfirm = nodeStorage(db).transactionSync(() => outbox.confirmInTxn('g1:1.0', { generation: 1, digest: 'd' }));
check('reconfirm dedup', reconfirm.deduped === true);
assert.throws(() => nodeStorage(db).transactionSync(() => outbox.confirmInTxn('g9:9.9', {})), /DISTRIBUTION_UNKNOWN/);
check('unknown confirm 404', true);
assert.throws(() => nodeStorage(db).transactionSync(() => outbox.enqueueInTxn({ gameId: '', ordinal: '1.0', releaseId: 'r1' })), /DISTRIBUTION_INPUT/);
check('bad input 422', true);
process.stdout.write(`outbox: ${n} checks green\n`);
