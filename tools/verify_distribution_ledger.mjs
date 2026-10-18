// Owned in-memory/temporary SQLite only. Not an R2 receipt or application-flow certificate.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FrozenDistributionLedger } from '../server/distributionledger.js';
import { exerciseDistributionLedger } from './fixtures/distribution-ledger.mjs';
let checks = exerciseDistributionLedger(() => openStorage(':memory:'));
const own = mkdtempSync(join(tmpdir(), 'dragon-distribution-ledger-'));
const path = join(own, 'owned.sqlite');
const verifyReceipt = () => { throw new Error('no remote receipt capability in this fixture'); };
let storage;
try {
  storage = openStorage(path);
  let ledger = new FrozenDistributionLedger({ storage, verifyReceipt });
  const bytes = Buffer.from(JSON.stringify({ version: 1, text: '中'.repeat(60000) }));
  const entry = storage.transactionSync(() => ledger.enqueueInTxn({ operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', kind: 'publish', gameId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', payload: bytes }));
  const before = ledger.status(); storage.close(); storage = null;
  storage = openStorage(path); ledger = new FrozenDistributionLedger({ storage, verifyReceipt });
  assert.deepEqual(ledger.status(), before);
  assert.deepEqual(Buffer.from(ledger.next().payload), bytes);
  assert.equal(ledger.next().operationDigest, entry.operationDigest);
  ledger.block('AUTHORITY_MISMATCH'); storage.close(); storage = null;
  storage = openStorage(path); ledger = new FrozenDistributionLedger({ storage, verifyReceipt });
  assert.equal(ledger.status().blockedReason, 'AUTHORITY_MISMATCH');
  assert.throws(() => ledger.next(), /DISTRIBUTION_RECOVERY_REQUIRED/); checks++;
} finally { storage?.close(); rmSync(own, { recursive: true, force: true }); }
process.stdout.write(`frozen distribution ledger: ${checks} groups green (receipt seam only; no power-loss or R2 proof)\n`);
