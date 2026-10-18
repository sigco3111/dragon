// Shared Node/workerd SQLite association probes. Opaque ledger payloads and
// trusted principal/mutation callbacks; not a full authority or R2 proof.
import assert from 'node:assert/strict';
import { GameManagement } from '../../server/management.js';
import { GameMetadataStore } from '../../server/metadata.js';
import { FrozenDistributionLedger } from '../../server/distributionledger.js';
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', G='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', OTHER='dddddddd-dddd-4ddd-bddd-dddddddddddd', R='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export function exerciseManagementDistribution(storage) {
 const sql=storage.sql, one=(q,...v)=>sql.exec(q,...v).toArray()[0];
 const principal=h=>one('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=?',h);
 const make=()=>new GameManagement({storage,principal,operationGuard:()=>{}});
 const manager=make(), games=new GameMetadataStore({storage,principal});
 const ledger=new FrozenDistributionLedger({storage,verifyReceipt:()=>{throw new Error('no receipt seam');}});
 sql.exec('INSERT INTO content_used_ids VALUES(?)',G);
 sql.exec('INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',G,A,'Bound','',null,null,'1','1',R,'1.0',0,0,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
 let serial=0, checks=0;
 const op=(key=`owned-bound-operation-${++serial}`)=>({actor:A,key,digest:'d'.repeat(64),epoch:1});
 const input=()=>({gameId:G,expectedRowRevision:one('SELECT row_revision FROM content_games WHERE game_id=?',G).row_revision});
 const commit=()=>games.setListedInTxn('owned',G,true,input().expectedRowRevision).summary;
 const record=(kind='listing',gameId=G)=>ledger.enqueueInTxn({operationId:crypto.randomUUID(),kind,gameId,payload:new TextEncoder().encode('{"version":1,"opaque":true}')});
 const list=(request=op(),bind=changed=>changed?record():null)=>({request,result:manager.list('owned',request,input(),commit,bind)});
 const snapshot=()=>['content_games','content_reservations','content_operations','content_audits','content_registry','content_distribution_state','content_distribution_events','content_distribution_chunks'].map(t=>sql.exec(`SELECT * FROM ${t} ORDER BY rowid`).toArray());
 const code=expected=>error=>error.code===expected;
 function test(fn) {
  const rollback={};
  try { storage.transactionSync(()=>{fn();throw rollback;}); } catch(error) { if(error!==rollback) throw error; }
  checks++;
 }
 test(()=>{
  const {request,result}=list(), before=snapshot(), observed=make().queryDistribution('owned',G,request.key);
  assert.deepEqual(observed.result,result); assert.equal(observed.distribution.generation,1);
  assert.equal(ledger.operationStatus(G,observed.distribution.operationId).state,'pending');
  const never=()=>{throw new Error('replay cannot bind twice');};
  assert.deepEqual(manager.list('owned',request,{gameId:G,expectedRowRevision:'1'},never,never),result);
  assert.deepEqual(manager.query('owned',G,request.key),result); assert.deepEqual(snapshot(),before);
 });
 test(()=>{
  const {request,result}=list(); const unlist=op();
  manager.apply('owned',unlist,{...input(),action:'unlist'},changed=>changed?record('restriction'):null);
  assert.equal(make().queryDistribution('owned',G,unlist.key).distribution.generation,2);
  assert.deepEqual(manager.queryDistribution('owned',G,request.key).result,result);
  const clear=op(); manager.apply('owned',clear,{...input(),action:'clear-restriction'},changed=>changed?record('restriction'):null);
  assert.equal(manager.queryDistribution('owned',G,clear.key).distribution.generation,3);
  assert.equal(one('SELECT listed FROM content_games WHERE game_id=?',G).listed,0);
 });
 test(()=>{
  list(); const before=ledger.status().tailGeneration, {request,result}=list();
  assert.deepEqual(manager.queryDistribution('owned',G,request.key),{result,distribution:null});
  assert.equal(ledger.status().tailGeneration,before);
  const clear=op(); manager.apply('owned',clear,{...input(),action:'unlist'},changed=>changed?record('restriction'):null);
  const noop=op(); const value=manager.apply('owned',noop,{...input(),action:'unlist'},()=>null);
  assert.deepEqual(manager.queryDistribution('owned',G,noop.key),{result:value,distribution:null});
 });
 test(()=>{const request=op();manager.list('owned',request,input(),commit);assert.throws(()=>manager.queryDistribution('owned',G,request.key),code('DISTRIBUTION_STATUS_UNAVAILABLE'));});
 for(const bind of [()=>undefined,async()=>record(),()=>{record();return Promise.resolve(null);},()=>null,()=>({...record(),generation:2}),()=>record('restriction'),()=>record('listing',OTHER),()=>({...record(),deduped:true})]) test(()=>{
  const before=snapshot(); assert.throws(()=>list(op(),bind)); assert.deepEqual(snapshot(),before);
 });
 test(()=>{list();const before=snapshot();assert.throws(()=>list(op(),()=>record()),code('MANAGEMENT_DISTRIBUTION_CORRUPT'));assert.deepEqual(snapshot(),before);});
 test(()=>{
  const before=snapshot();
  assert.throws(()=>list(op(),()=>{const value=record();sql.exec('UPDATE content_games SET listed=0 WHERE game_id=?',G);return value;}),code('MANAGEMENT_RECEIPT_CORRUPT'));
  assert.deepEqual(snapshot(),before);
 });
 test(()=>{
  const request=op(), before=snapshot();
  sql.exec("CREATE TRIGGER owned_binding_fault BEFORE INSERT ON content_audits BEGIN SELECT RAISE(ABORT,'owned binding fault'); END");
  try { assert.throws(()=>list(request),/owned binding fault/); } finally { sql.exec('DROP TRIGGER owned_binding_fault'); }
  assert.deepEqual(snapshot(),before);
 });
 test(()=>{
  const {request}=list(), saved=one('SELECT result_json FROM content_operations WHERE op_key=?',request.key).result_json;
  let envelope; try { envelope=JSON.parse(saved); } catch { throw new Error('owned JSON'); }
  for(const text of [saved+'\n',JSON.stringify({...envelope,extra:true}),JSON.stringify({...envelope,version:2}),JSON.stringify({...envelope,distribution:{operationId:R,generation:1}}),JSON.stringify({...envelope,distribution:{...envelope.distribution,generation:2}}),JSON.stringify({...envelope,distribution:{...envelope.distribution,generation:0}})]) {
   sql.exec('UPDATE content_operations SET result_json=? WHERE op_key=?',text,request.key);
   assert.throws(()=>manager.queryDistribution('owned',G,request.key));
  }
  sql.exec('UPDATE content_operations SET result_json=? WHERE op_key=?',saved,request.key);
 });
 test(()=>{
  const {request}=list();
  assert.throws(()=>manager.queryDistribution('owned',OTHER,request.key),code('MANAGEMENT_OPERATION_NOT_FOUND'));
  assert.throws(()=>manager.queryDistribution('owned',G,'owned-missing-operation'),code('MANAGEMENT_OPERATION_NOT_FOUND'));
  sql.exec('INSERT INTO operations VALUES(?,?)',A,request.key);
  assert.throws(()=>manager.queryDistribution('owned',G,request.key),code('IDEMPOTENCY_CONFLICT'));
 });
 for(const [column,value,expected] of [['must_change',1,'PASSWORD_CHANGE_REQUIRED'],['disabled',1,'SESSION_INVALID'],['role','author','ADMIN_REQUIRED']]) test(()=>{
  const {request}=list();sql.exec(`UPDATE users SET ${column}=? WHERE id=?`,value,A);
  assert.throws(()=>manager.queryDistribution('owned',G,request.key),code(expected));
 });
 test(()=>{
  const {request}=list();sql.exec('UPDATE users SET epoch=2 WHERE id=?',A);sql.exec('UPDATE sessions SET epoch=2 WHERE user_id=?',A);
  assert.throws(()=>manager.queryDistribution('owned',G,request.key),code('OPERATION_REVOKED'));
 });
 test(()=>{
  const {request}=list();sql.exec('INSERT INTO content_deletion_fences VALUES(?,?,?,?,?,?)',G,A,A,'1','2','2026-01-01T00:00:00.000Z');
  assert.throws(()=>manager.queryDistribution('owned',G,request.key),code('GAME_DELETING'));
 });
 test(()=>{
  const {request}=list();sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?)',R,'second_admin','admin',1,0,0);
  sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?)','other',R,1,Date.now()+3600000,Date.now()+3600000);
  assert.throws(()=>manager.queryDistribution('other',G,request.key),code('MANAGEMENT_OPERATION_NOT_FOUND'));
 });
 test(()=>{
  list(); const before=snapshot();
  assert.throws(()=>manager.apply('owned',op(),{...input(),action:'unlist'},()=>{record('restriction');return Promise.resolve(null);}),TypeError);
  assert.deepEqual(snapshot(),before);
 });
 const retained=list(op('owned-bound-listing-retained'));
 const expected=manager.queryDistribution('owned',G,retained.request.key);
 return {checks,gameId:G,operationKey:retained.request.key,expected};
}
