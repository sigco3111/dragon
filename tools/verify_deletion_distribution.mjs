import assert from 'node:assert/strict';
import { openStorage } from '../vps/sqlite-port.mjs';
import { exerciseDeletionDistribution } from './fixtures/deletion-distribution.mjs';
const storage=openStorage(':memory:');
try {
  const result=exerciseDeletionDistribution(storage);
  assert.equal(result.checks,31);
  process.stdout.write(JSON.stringify({checks:result.checks,scope:'Owned SQLite deletion receipt association; principal/callback seams, no physical purge'})+'\n');
} finally {storage.close();}
