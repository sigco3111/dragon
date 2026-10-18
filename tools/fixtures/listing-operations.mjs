// Real SQLite/model contract; the principal and synchronous listing callback
// are explicit seams. Common Request/compiled publication coverage is separate.
import assert from 'node:assert/strict';
import { GameManagement } from '../../server/management.js';
import { GameMetadataStore } from '../../server/metadata.js';
import { AnnouncementStore } from '../../server/announcements.js';
import { exerciseManagementDistribution } from './management-distribution.mjs';
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', G='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', R='cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER='dddddddd-dddd-4ddd-bddd-dddddddddddd';
const time='2026-01-01T00:00:00.000Z';
export function exerciseListingOperations(storage) {
 const sql=storage.sql, rows=q=>sql.exec(q).toArray(), one=(q,...v)=>sql.exec(q,...v).toArray()[0];
 sql.exec('CREATE TABLE users (id TEXT PRIMARY KEY,account TEXT,role TEXT,epoch INTEGER,disabled INTEGER,must_change INTEGER)');
 sql.exec('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,user_id TEXT,epoch INTEGER,absolute_until INTEGER,idle_until INTEGER)');
 sql.exec('CREATE TABLE operations (actor TEXT,op_key TEXT)');
 sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?)',A,'owned_admin','admin',1,0,0);
 sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?)','owned',A,1,Date.now()+3600000,Date.now()+3600000);
 const principal=h=>{ assert.equal(h,'owned'); return one('SELECT * FROM users WHERE id=?',A); };
 const games=new GameMetadataStore({storage,principal});
 const announcements=new AnnouncementStore({storage});
 for (const id of [G,OTHER]) {
  sql.exec('INSERT INTO content_used_ids VALUES(?)',id);
  sql.exec('INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,A,'Owned','',null,null,'1','1',R,'1.0',0,0,time,time);
 }
 const make=()=>new GameManagement({storage,principal,operationGuard:()=>{}});
 let manager=make(), calls=0, serial=0, checks=0;
 const op=()=>({actor:A,key:`owned-listing-operation-${++serial}`,digest:'d'.repeat(64),epoch:1});
 const input=()=>({gameId:G,expectedRowRevision:one('SELECT row_revision FROM content_games WHERE game_id=?',G).row_revision});
 const commit=()=>{
  calls++;
  const done=games.setListedInTxn('owned',G,true,input().expectedRowRevision);
  if(done.becameListed) {
   announcements.announceInTxn({gameId:G,releaseId:R,ordinal:'1.0',name:'Owned',creatorAccount:'owned_admin',publishedAt:time,firstOnlineAt:time});
   announcements.bumpRegistryInTxn();
  }
  return done.summary;
 };
 const tables=['content_games','content_reservations','content_operations','content_audits','content_announcements','content_registry'];
 const snapshot=()=>tables.map(table=>rows(`SELECT * FROM ${table} ORDER BY rowid`));
 const code=expected=>error=>error.code===expected;
 const request=op(), body=input(), first=manager.list('owned',request,body,commit), after=snapshot();
 assert.equal(first.listed,true); assert.equal(first.rowRevision,'2'); assert.equal(calls,1);
 assert.equal(rows('SELECT * FROM content_operations').length,1); assert.equal(rows('SELECT * FROM content_reservations').length,1); checks++;
 const never=()=>{throw new Error('replay must not invoke callback');};
 assert.deepEqual(manager.list('owned',request,body,never),first); assert.deepEqual(snapshot(),after); checks++;
 manager=make(); assert.deepEqual(manager.query('owned',G,request.key),first);
 assert.deepEqual(manager.list('owned',request,body,never),first); checks++;
 sql.exec('UPDATE content_games SET listed=0,restricted=1,row_revision=? WHERE game_id=?','3',G);
 const hidden=snapshot(); assert.deepEqual(manager.list('owned',request,body,never),first); assert.deepEqual(snapshot(),hidden); checks++;
 assert.throws(()=>manager.list('owned',{...request,digest:'e'.repeat(64)},body,never),code('IDEMPOTENCY_CONFLICT'));
 assert.throws(()=>manager.list('owned',request,{...body,gameId:OTHER},never),code('IDEMPOTENCY_CONFLICT')); checks++;
 for(const [column,value,expected] of [['must_change',1,'PASSWORD_CHANGE_REQUIRED'],['disabled',1,'SESSION_INVALID'],['role','author','ADMIN_REQUIRED'],['epoch',2,'SESSION_INVALID']]) {
  const old=one(`SELECT ${column} AS value FROM users WHERE id=?`,A).value;
  sql.exec(`UPDATE users SET ${column}=? WHERE id=?`,value,A);
  try{assert.throws(()=>manager.list('owned',request,body,never),code(expected));}
  finally{sql.exec(`UPDATE users SET ${column}=? WHERE id=?`,old,A);}
 }
 checks++;
 sql.exec('UPDATE users SET epoch=2 WHERE id=?',A); sql.exec('UPDATE sessions SET epoch=2');
 try{assert.throws(()=>manager.list('owned',{...request,epoch:2},body,never),code('OPERATION_REVOKED'));}
 finally{sql.exec('UPDATE users SET epoch=1 WHERE id=?',A);sql.exec('UPDATE sessions SET epoch=1');} checks++;
 const expiry=one('SELECT idle_until FROM sessions').idle_until; sql.exec('UPDATE sessions SET idle_until=0');
 try{assert.throws(()=>manager.list('owned',request,body,never),code('SESSION_INVALID'));}
 finally{sql.exec('UPDATE sessions SET idle_until=?',expiry);} checks++;
 sql.exec('INSERT INTO content_deletion_fences VALUES(?,?,?,?,?,?)',G,A,A,'2','3',time);
 try{assert.throws(()=>manager.list('owned',request,body,never),code('GAME_DELETING'));}
 finally{sql.exec('DELETE FROM content_deletion_fences WHERE game_id=?',G);} checks++;
 const saved=one('SELECT result_json FROM content_operations WHERE op_key=?',request.key).result_json;
 for(const text of ['{',JSON.stringify({...first,unexpected:true}),JSON.stringify({...first,listed:false}),JSON.stringify({...first,currentReleaseId:null}),JSON.stringify({...first,modifiedAt:'invalid'}),saved+'\n']) {
  sql.exec('UPDATE content_operations SET result_json=? WHERE op_key=?',text,request.key);
  try{assert.throws(()=>manager.list('owned',request,body,never),code('MANAGEMENT_RECEIPT_CORRUPT'));}
  finally{sql.exec('UPDATE content_operations SET result_json=? WHERE op_key=?',saved,request.key);}
 }
 checks++;
 const reserved=one('SELECT * FROM content_reservations WHERE op_key=?',request.key);
 sql.exec('DELETE FROM content_reservations WHERE op_key=?',request.key);
 try{assert.throws(()=>manager.list('owned',request,body,never),code('MANAGEMENT_RECEIPT_CORRUPT'));}
 finally{sql.exec('INSERT INTO content_reservations VALUES(?,?,?,?,?,?)',...Object.values(reserved));} checks++;
 sql.exec('UPDATE content_reservations SET method=? WHERE op_key=?','admin-unlist',request.key);
 try{assert.throws(()=>manager.list('owned',request,body,never),code('IDEMPOTENCY_CONFLICT'));}
 finally{sql.exec('UPDATE content_reservations SET method=? WHERE op_key=?','admin-list',request.key);} checks++;
 const half=op();sql.exec('INSERT INTO content_reservations VALUES(?,?,?,?,?,?)',A,half.key,'admin-list',G,half.digest,1);
 try{assert.throws(()=>manager.list('owned',half,input(),never),code('MANAGEMENT_RECEIPT_CORRUPT'));}
 finally{sql.exec('DELETE FROM content_reservations WHERE op_key=?',half.key);} checks++;
 const foreign=op();sql.exec('INSERT INTO operations VALUES(?,?)',A,foreign.key);
 try{assert.throws(()=>manager.list('owned',foreign,input(),never),code('IDEMPOTENCY_CONFLICT'));}
 finally{sql.exec('DELETE FROM operations WHERE op_key=?',foreign.key);} checks++;
 assert.throws(()=>manager.list('owned',op(),{...body,gameId:'wolong-builtin'},never),code('BUILTIN_PROTECTED'));
 assert.throws(()=>manager.list('owned',op(),input(),never),code('LISTING_RESTRICTED')); checks++;
 sql.exec('UPDATE content_games SET restricted=0 WHERE game_id=?',G);
 assert.throws(()=>manager.list('owned',op(),body,never),code('GAME_CHANGED'));
 const pending=op(), pendingInput=input(), before=snapshot();
 let invoked=false;
 assert.throws(()=>manager.list('owned',pending,pendingInput,async()=>{invoked=true;}),TypeError);assert.equal(invoked,false);
 assert.deepEqual(snapshot(),before); checks++;
 assert.throws(()=>manager.list('owned',pending,pendingInput,()=>{commit();return Promise.resolve(first);}),TypeError);
 assert.deepEqual(snapshot(),before); checks++;
 assert.throws(()=>manager.list('owned',pending,pendingInput,()=>({...commit(),metadata:{name:'forged',introduction:''}})),code('MANAGEMENT_RECEIPT_CORRUPT'));
 assert.deepEqual(snapshot(),before); checks++;
 assert.throws(()=>manager.list('owned',pending,pendingInput,()=>{const result=commit();sql.exec('UPDATE users SET disabled=1 WHERE id=?',A);return result;}),code('SESSION_INVALID'));
 assert.deepEqual(snapshot(),before); assert.equal(one('SELECT disabled FROM users WHERE id=?',A).disabled,0); checks++;
 for(const [table,action] of [['content_reservations','INSERT'],['content_registry','UPDATE'],['content_operations','INSERT'],['content_audits','INSERT']]) {
  sql.exec(`CREATE TRIGGER owned_listing_fault BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'owned listing fault'); END`);
  try{assert.throws(()=>manager.list('owned',pending,pendingInput,commit),/owned listing fault/);}
  finally{sql.exec('DROP TRIGGER owned_listing_fault');}
  assert.deepEqual(snapshot(),before,table);checks++;
 }
 const second=manager.list('owned',pending,pendingInput,commit);
 assert.equal(second.rowRevision,'4');assert.deepEqual(manager.list('owned',pending,pendingInput,never),second);checks++;
 const noOp=op(), noOpBody=input(), registryBefore=rows('SELECT * FROM content_registry');
 assert.deepEqual(manager.list('owned',noOp,noOpBody,commit),second);
 assert.deepEqual(rows('SELECT * FROM content_registry'),registryBefore);
 assert.deepEqual(manager.query('owned',G,noOp.key),second);checks++;
 const binding=exerciseManagementDistribution(storage);
 return {checks,gameId:G,operationKey:request.key,first,binding};
}
