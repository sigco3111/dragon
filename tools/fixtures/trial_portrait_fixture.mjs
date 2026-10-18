// Test-only fixture shared by Node SQLite and a real workerd SQLite DO.
// Principal/games/drafts/runtimeAssets are explicit stubs, NOT real authentication/R2.
import { TrialSessions } from '../../server/trials.js';
import { HttpError } from '../../server/security.js';
import { createHash } from 'node:crypto';
export const TRIAL = '22222222-2222-4222-8222-222222222222';
const GAME = '11111111-1111-4111-8111-111111111111';
const sha = b => createHash('sha256').update(b).digest('hex');
export function trialPortraitFixture(storage, policy) {
  const sql = storage.sql;
  let epoch = 1, deleting = false;
  const sessions = new TrialSessions({ storage, policy,
    principal: token => {
      if (token === 'invalid') { throw new HttpError(401, 'SESSION_INVALID'); }
      return { id: token === 'foreign' ? 'foreign' : 'owner', epoch, absolute_until: Date.now() + 3600000 };
    },
    games: { snapshotReference() { throw new Error('unused fixture port'); }, assertNotDeleting() { if (deleting) { throw new HttpError(409, 'GAME_DELETING'); } } },
    drafts: { captureForCompile() { throw new Error('unused fixture port'); } },
    runtimeAssets: { definition() { return {}; }, capture() { throw new Error('unused fixture port'); } }
  });
  const snapshot = () => sql.exec('SELECT asset_id,sha256,byte_length,bytes FROM trial_assets WHERE trial_id=? ORDER BY asset_id', TRIAL).toArray().map(row => ({ ...row, bytes: Buffer.from(row.bytes).toString('base64') }));
  const putManifest = bytes => sql.exec('INSERT OR REPLACE INTO trial_assets VALUES(?,?,?,?,?)', TRIAL, 'manifest', sha(bytes), bytes.length, bytes);
  const seed = () => {
    epoch = 1; deleting = false;
    sql.exec('DROP TRIGGER IF EXISTS portrait_write_abort');
    sql.exec('DELETE FROM trial_assets WHERE trial_id=?', TRIAL);
    sql.exec('INSERT OR REPLACE INTO trial_sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', TRIAL, 'owner', 'tok', 1, GAME, '1', 'ch', 'snap', 'd'.repeat(64), 'm'.repeat(64), 'active', null, 'fixture-created', Date.now() + 3600000);
    putManifest(Buffer.from(JSON.stringify({ portraits: [] })));
  };
  seed();
  return input => {
    if (input.op === 'seed') { seed(); return { data: true, before: snapshot(), after: snapshot(), status: 200 }; }
    if (input.op === 'manifest') {
      if (input.mode === 'missing') { sql.exec('DELETE FROM trial_assets WHERE trial_id=? AND asset_id=?', TRIAL, 'manifest'); }
      else { putManifest(Buffer.from(input.text)); }
      return { data: true, before: snapshot(), after: snapshot(), status: 200 };
    }
    if (input.op === 'abort') {
      sql.exec("CREATE TRIGGER portrait_write_abort BEFORE UPDATE ON trial_assets WHEN NEW.asset_id='manifest' BEGIN SELECT RAISE(ABORT,'TEST_TRIAL_PORTRAIT_ABORT'); END");
      return { data: true, before: snapshot(), after: snapshot(), status: 200 };
    }
    if (input.op === 'epoch') { epoch = 2; }
    if (input.op === 'deleting') { deleting = true; }
    if (input.op === 'ended') { sql.exec("UPDATE trial_sessions SET state='ended' WHERE trial_id=?", TRIAL); }
    const before = snapshot(), token = input.token ?? 'tok', trialId = input.trialId ?? TRIAL;
    try {
      let data;
      if (input.op === 'snapshot') { data = before; }
      else if (input.op === 'asset') {
        const asset = sessions.asset(token, trialId, input.assetId);
        data = { ...asset, bytes: Buffer.from(asset.bytes).toString('base64') };
      } else {
        const bytes = Buffer.from(input.dataBase64, 'base64');
        if (input.op === 'preview' || ['epoch', 'deleting', 'ended'].includes(input.op)) { data = sessions.uploadPreview(token, trialId, input.assetId, bytes, input.crop); }
        else if (input.op === 'commit') { data = sessions.uploadCommit(token, trialId, input.assetId, bytes, input.expected, input.crop); }
        else if (input.op === 'transaction') { data = storage.transactionSync(() => sessions.uploadCommit(token, trialId, input.assetId, bytes, input.expected, input.crop)); }
        else { throw new Error('unexpected fixture operation'); }
      }
      return { status: 200, data, before, after: snapshot() };
    } catch (error) {
      if (error instanceof HttpError) { return { status: error.status, error: error.code, before, after: snapshot() }; }
      if (input.op === 'transaction' && String(error.message).includes('TEST_TRIAL_PORTRAIT_ABORT')) { return { status: 503, error: 'FIXTURE_SQL_ABORT', before, after: snapshot() }; }
      throw error;
    }
  };
}
