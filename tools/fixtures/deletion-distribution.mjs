// Actual SQLite; trusted principal and opaque ledger payload seams. No purge/R2 proof.
import assert from 'node:assert/strict';
import { GameDeletionFence } from '../../server/deletionfence.js';
import { GameMetadataStore } from '../../server/metadata.js';
import { FrozenDistributionLedger } from '../../server/distributionledger.js';
import { fail } from '../../server/security.js';
export const actorId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', gameId='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const other='cccccccc-cccc-4ccc-8ccc-cccccccccccc', key='owned-deletion-binding-01';
export function deletionModel(storage) {
  return new GameDeletionFence({ storage, requestKey:'a'.repeat(64), principal:token=>{
    const actor=storage.sql.exec('SELECT * FROM users WHERE id=?',token).toArray()[0];
    if(!actor || actor.disabled) { fail(401,'SESSION_INVALID'); }
    return actor;
  }, operationGuard:(actor,operationKey)=>{
    if(storage.sql.exec('SELECT op_key FROM operations WHERE actor=? AND op_key=?',actor,operationKey).toArray().length) { fail(409,'IDEMPOTENCY_CONFLICT'); }
  } });
}
export function exerciseDeletionDistribution(storage) {
  const sql=storage.sql, one=(q,...args)=>sql.exec(q,...args).toArray()[0];
  sql.exec('CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,epoch INTEGER,disabled INTEGER,must_change INTEGER)');
  sql.exec('CREATE TABLE operations(actor TEXT,op_key TEXT)');
  sql.exec('INSERT INTO users VALUES(?,?,?,?,?)',actorId,'author',1,0,0);
  sql.exec('INSERT INTO users VALUES(?,?,?,?,?)',other,'admin',1,0,0);
  new GameMetadataStore({storage,principal:()=>one('SELECT * FROM users WHERE id=?',actorId)});
  const ledger=new FrozenDistributionLedger({storage,verifyReceipt:()=>{throw new Error('no confirmation seam');}});
  sql.exec('INSERT INTO content_used_ids VALUES(?)',gameId);
  sql.exec('INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',gameId,actorId,'Owned','',null,null,'1','1',null,'1.0',0,0,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
  const model=deletionModel(storage), input={gameId,expectedRowRevision:'1',confirmationName:'Owned'};
  const record=(kind='delete-fence',target=gameId)=>ledger.enqueueInTxn({operationId:crypto.randomUUID(),kind,gameId:target,payload:new TextEncoder().encode('{"version":1}')});
  const begin=(bind=()=>record())=>model.begin(actorId,key,input,bind);
  const tables=['users','operations','content_games','content_deletion_fences','content_deletion_operations','content_audits','content_distribution_state','content_distribution_events','content_distribution_chunks'];
  const snapshot=()=>tables.map(table=>sql.exec(`SELECT * FROM ${table} ORDER BY rowid`).toArray());
  const code=expected=>error=>error.code===expected;
  let checks=0;
  function test(fn) {
    const rollback={};
    try {storage.transactionSync(()=>{fn();throw rollback;});} catch(error) {if(error!==rollback) {throw error;}}
    checks++;
  }
  test(()=>{
    const result=begin(), before=snapshot(), bound=deletionModel(storage).queryDistribution(actorId,key,gameId);
    assert.deepEqual(bound.result,result); assert.equal(bound.distribution.generation,1);
    assert.equal(ledger.operationStatus(gameId,bound.distribution.operationId).state,'pending');
    assert.deepEqual(model.query(actorId,key),result);
    assert.deepEqual(model.begin(actorId,key,input,()=>{throw new Error('replay cannot record again');}),result);
    assert.deepEqual(snapshot(),before);
    assert.throws(()=>model.queryDistribution(other,key,gameId),code('DELETE_OPERATION_NOT_FOUND'));
    assert.throws(()=>model.queryDistribution(actorId,key,other),code('DELETE_OPERATION_NOT_FOUND'));
  });
  test(()=>{
    const result=model.begin(actorId,key,input);
    assert.equal(one('SELECT result_json FROM content_deletion_operations').result_json,JSON.stringify(result));
    assert.throws(()=>model.queryDistribution(actorId,key,gameId),code('DISTRIBUTION_STATUS_UNAVAILABLE'));
  });
  for(const bind of [()=>undefined,()=>null,async()=>record(),()=>{record();return Promise.resolve(null);},()=>({...record(),generation:2}),()=>record('restriction'),()=>record('delete-fence',other),()=>({...record(),deduped:true})]) {
    test(()=>{const before=snapshot();assert.throws(()=>begin(bind));assert.deepEqual(snapshot(),before);});
  }
  for(const mutation of [()=>sql.exec('UPDATE content_games SET listed=1'),()=>sql.exec("UPDATE content_games SET row_revision='3'"),()=>sql.exec('UPDATE content_games SET owner_id=?',other),()=>sql.exec('UPDATE users SET epoch=2 WHERE id=?',actorId),()=>sql.exec('UPDATE users SET disabled=1 WHERE id=?',actorId),()=>sql.exec('UPDATE users SET must_change=1 WHERE id=?',actorId),()=>sql.exec('INSERT INTO operations VALUES(?,?)',actorId,key),()=>sql.exec("UPDATE content_deletion_fences SET fence_revision='3'")]) {
    test(()=>{const before=snapshot();assert.throws(()=>begin(()=>{const saved=record();mutation();return saved;}));assert.deepEqual(snapshot(),before);});
  }
  test(()=>{
    const before=snapshot();sql.exec("CREATE TRIGGER owned_failure BEFORE INSERT ON content_audits BEGIN SELECT RAISE(ABORT,'owned failure'); END");
    try {assert.throws(()=>begin());assert.deepEqual(snapshot(),before);} finally {sql.exec('DROP TRIGGER owned_failure');}
  });
  for(const raw of ['{','{"version":2}','{"version":1,"result":{},"distribution":null}']) {
    test(()=>{begin();sql.exec('UPDATE content_deletion_operations SET result_json=?',raw);assert.throws(()=>model.query(actorId,key),code('DELETE_RECEIPT_CORRUPT'));});
  }
  test(()=>{begin();sql.exec("UPDATE content_distribution_events SET kind='restriction'");assert.throws(()=>model.query(actorId,key),code('DELETE_DISTRIBUTION_CORRUPT'));});
  test(()=>{begin();sql.exec('UPDATE users SET epoch=2 WHERE id=?',actorId);assert.throws(()=>model.queryDistribution(actorId,key,gameId),code('OPERATION_REVOKED'));});
  test(()=>{
    const before=snapshot();
    assert.deepEqual(model.previewForAdmin(other,gameId),{gameId,rowRevision:'1',confirmationName:'Owned'});
    assert.deepEqual(snapshot(),before);
    assert.throws(()=>model.previewForAdmin(actorId,gameId),code('ADMIN_REQUIRED'));
    assert.throws(()=>model.previewForAdmin(other,'wolong-builtin'),code('BUILTIN_PROTECTED'));
    assert.throws(()=>model.previewForAdmin(other,other),code('GAME_NOT_FOUND'));
    assert.deepEqual(snapshot(),before);
  });
  for(const [mutation,expectedCode] of [
    [()=>sql.exec('UPDATE content_games SET listed=1'),'GAME_LISTED'],
    [()=>sql.exec('UPDATE users SET disabled=1 WHERE id=?',other),'SESSION_INVALID'],
    [()=>sql.exec('UPDATE users SET must_change=1 WHERE id=?',other),'PASSWORD_CHANGE_REQUIRED'],
    [()=>sql.exec("UPDATE content_games SET draft_name='too-long-name'"),'DELETE_METADATA_CORRUPT'],
  ]) test(()=>{mutation();const before=snapshot();assert.throws(()=>model.previewForAdmin(other,gameId),code(expectedCode));assert.deepEqual(snapshot(),before);});
  test(()=>{begin();const before=snapshot();assert.throws(()=>model.previewForAdmin(other,gameId),code('GAME_DELETING'));assert.deepEqual(snapshot(),before);});
  test(()=>{
    const preview=model.previewForAdmin(other,gameId);
    sql.exec("UPDATE content_games SET draft_name='Changed',row_revision='2'");
    assert.throws(()=>model.begin(other,key,{gameId,expectedRowRevision:preview.rowRevision,confirmationName:preview.confirmationName}),code('GAME_CHANGED'));
    assert.equal(one('SELECT COUNT(*) AS n FROM content_deletion_fences').n,0);
  });
  const result=begin(), expected=model.queryDistribution(actorId,key,gameId);
  return {checks,result,expected,key};
}
