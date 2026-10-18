// Two-game SQL transaction/retention probes. Direct seeded authority rows and
// staged-runtime DTO are explicit seams; actual HTTP/compiler proof is separate.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register('../vps/text-loader.mjs',import.meta.url);
const {openStorage}=await import('../vps/sqlite-port.mjs');
const {GameMetadataStore}=await import('../server/metadata.js');
const {PublishedGames}=await import('../server/published.js');
const {ReleaseLedger}=await import('../server/releases.js');
const {AnnouncementStore}=await import('../server/announcements.js');
const {DistributionOutbox}=await import('../server/distribution.js');
const {FrozenPublicationProducer}=await import('../server/publicationproducer.js');
const {FrozenDistributionLedger}=await import('../server/distributionledger.js');
const G='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',H='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',digest='a'.repeat(64),time='2026-10-15T00:00:00.000Z';
const storage=openStorage(':memory:'),sql=storage.sql;let groups=0;
try{
 sql.exec('CREATE TABLE users (id TEXT PRIMARY KEY, account TEXT, role TEXT, epoch INTEGER, must_change INTEGER)');sql.exec("INSERT INTO users VALUES('owner','owned','author',1,0)");
 const principal=()=>({id:'owner',account:'owned',role:'author',epoch:1,must_change:0});
 const games=new GameMetadataStore({storage,principal});new PublishedGames({storage,principal});new ReleaseLedger({storage,principal,games});new AnnouncementStore({storage});new DistributionOutbox({storage});
 for(const id of [G,H])sql.exec('INSERT INTO content_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,'owner','draft','',null,null,'1','1',null,'0',0,0,time,time);
 let producer=new FrozenPublicationProducer({storage});
 const ledger=new FrozenDistributionLedger({storage,verifyReceipt:()=>{throw new Error('no receipt trust');}});
 const payload=n=>JSON.parse(new TextDecoder().decode(ledger.entry(n).payload));
 const snapshot=()=>['content_games','content_releases','published_games','content_distribution_state','content_distribution_events','content_distribution_chunks'].map(t=>sql.exec(`SELECT * FROM ${t} ORDER BY rowid`).toArray());
 function publish(id){
  const releaseId=randomUUID(),runtime={gameId:id,releaseId,ordinal:'1.0',revision:'1',sourceDigest:digest,chapters:[id+'#chapter'],runtime:{key:`artifacts/${id}/1.0/${releaseId}/runtime-${digest}.json`,sha256:digest,byteLength:1}};
  return storage.transactionSync(()=>{sql.exec('UPDATE content_games SET current_release_id=?,next_ordinal=? WHERE game_id=?',releaseId,'1.0',id);sql.exec('INSERT INTO content_releases VALUES(?,?,?,?,?,?)',id,releaseId,'1.0','1',digest,time);sql.exec('INSERT INTO published_games VALUES(?,?,?,?)',id,'owner',JSON.stringify({gameId:id,ordinal:'1.0',revision:'1',sourceDigest:digest,chapters:runtime.chapters,name:'secret-'+id,publishedAt:time}),time);return producer.recordInTxn('publish',id,runtime);});
 }
 for(const poison of [()=>sql.exec('UPDATE content_games SET listed=1 WHERE game_id=?',H),()=>sql.exec('UPDATE content_games SET current_release_id=? WHERE game_id=?',randomUUID(),H),()=>sql.exec('INSERT INTO content_deletion_fences VALUES(?,?,?,?,?,?)',H,'owner','owner','1','2',time)]){
  poison();const before=snapshot();try{assert.throws(()=>publish(G),e=>e.code==='DISTRIBUTION_BOOTSTRAP_REQUIRED');assert.deepEqual(snapshot(),before);}finally{sql.exec('UPDATE content_games SET listed=0,current_release_id=NULL WHERE game_id=?',H);sql.exec('DELETE FROM content_deletion_fences WHERE game_id=?',H);}groups++;
 }
 producer.assertPublishable(G);publish(G);const first=Buffer.from(ledger.entry(1).payload);assert.deepEqual(payload(1).projection.directory,[]);groups++;
 assert.throws(()=>producer.assertPublishable(G),e=>e.code==='DISTRIBUTION_GAME_PENDING');producer.assertPublishable(H);publish(H);assert.equal(ledger.status().tailGeneration,2);assert.equal(payload(2).catalog.games.length,2);assert.deepEqual(payload(2).projection.directory,[]);assert.deepEqual(Buffer.from(ledger.entry(1).payload),first);groups++;
 storage.transactionSync(()=>{sql.exec('UPDATE content_games SET listed=1 WHERE game_id=?',H);producer.recordInTxn('listing',H);});
 const third=payload(3);assert.deepEqual(third.projection.directory.map(r=>r.gameId),[H]);assert.equal(third.catalog.games.find(g=>g.gameId===G).current.gameId,G);assert.equal(JSON.stringify(third.projection).includes('secret-'+G),false);groups++;
 producer=new FrozenPublicationProducer({storage});
 storage.transactionSync(()=>{sql.exec('UPDATE content_games SET listed=1 WHERE game_id=?',G);producer.recordInTxn('listing',G);});
 assert.deepEqual(payload(4).projection.directory.map(r=>r.gameId),[G,H]);
 const h=payload(4).catalog.games.find(g=>g.gameId===H).announcements[0];assert.equal(h.firstOnline.generation,3);assert.equal(h.firstOnline.operationDigest,ledger.entry(3).operationDigest);groups++;
 const before=snapshot();sql.exec("CREATE TRIGGER owned_abort BEFORE INSERT ON content_distribution_chunks BEGIN SELECT RAISE(ABORT,'owned chunk fault'); END");
 try{assert.throws(()=>storage.transactionSync(()=>{sql.exec('UPDATE content_games SET listed=0,restricted=1 WHERE game_id=?',G);producer.recordInTxn('restriction',G);}));}finally{sql.exec('DROP TRIGGER owned_abort');}
 assert.deepEqual(snapshot(),before);groups++;
 storage.transactionSync(()=>{sql.exec('UPDATE content_games SET listed=0,restricted=1 WHERE game_id=?',G);producer.recordInTxn('restriction',G);});
 assert.deepEqual(payload(5).projection.directory.map(r=>r.gameId),[H]);assert.equal(payload(5).catalog.games.find(g=>g.gameId===G).announcements.length,1);groups++;
 sql.exec("INSERT INTO content_distribution_outbox VALUES('owned-legacy',?,?,?,'pending',0,?,NULL,NULL)",G,'1.0',randomUUID(),time);
 try{assert.throws(()=>producer.assertPublishable(H),e=>e.code==='DISTRIBUTION_BOOTSTRAP_REQUIRED');assert.throws(()=>storage.transactionSync(()=>producer.recordInTxn('restriction',G)),e=>e.code==='DISTRIBUTION_BOOTSTRAP_REQUIRED');}finally{sql.exec("DELETE FROM content_distribution_outbox WHERE op_id='owned-legacy'");}groups++;
 for(const fault of [()=>sql.exec('UPDATE content_games SET listed=0 WHERE game_id=?',H),()=>sql.exec('DELETE FROM published_games WHERE game_id=?',H)]){
  const before=snapshot();assert.throws(()=>storage.transactionSync(()=>{fault();producer.recordInTxn('restriction',G);}),e=>e.code==='DISTRIBUTION_AUTHORITY_CORRUPT');assert.deepEqual(snapshot(),before);groups++;
 }
 const saved=sql.exec('SELECT bytes FROM content_distribution_chunks WHERE generation=5 AND part=0').toArray()[0].bytes;
 sql.exec('UPDATE content_distribution_chunks SET bytes=? WHERE generation=5 AND part=0',new Uint8Array([1]));
 try{assert.throws(()=>storage.transactionSync(()=>producer.recordInTxn('restriction',G)),e=>e.code==='DISTRIBUTION_LEDGER_CORRUPT');}finally{sql.exec('UPDATE content_distribution_chunks SET bytes=? WHERE generation=5 AND part=0',saved);}groups++;
 ledger.block('REMOTE_AHEAD');assert.throws(()=>producer.assertPublishable(H),e=>e.code==='DISTRIBUTION_RECOVERY_REQUIRED');assert.throws(()=>storage.transactionSync(()=>producer.recordInTxn('restriction',G)),e=>e.code==='DISTRIBUTION_RECOVERY_REQUIRED');groups++;
 assert.equal(ledger.status().tailGeneration,5);assert.equal(ledger.status().confirmedGeneration,0);assert.deepEqual(Buffer.from(ledger.entry(1).payload),first);
 process.stdout.write(`publication producer: ${groups} groups passed (two-game SQL seams, no R2)\n`);
}finally{storage.close();}
