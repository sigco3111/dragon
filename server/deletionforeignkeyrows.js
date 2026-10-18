// Four fixed FK edges, with TEXT user IDs and INTEGER ledger generations.
// No full row/ref integrity, distribution payload proof or delete permission.
import {GameDeletionSchemaIntegrity} from './deletionschemaintegrity.js';
import {fail,fields} from './security.js';
const edges=Object.freeze([
 Object.freeze(['content_games','owner_id','users','id','text']),
 Object.freeze(['installed_sources','registered_by','users','id','text']),
 Object.freeze(['sessions','user_id','users','id','text']),
 Object.freeze(['content_distribution_chunks','generation','content_distribution_events','generation','integer']),
]);
// Names are fixed declaration constants, never request/metadata-derived identifiers.
export function inspectDeclaredForeignKeyRows(sql,afterTable=()=>{}){
 let checked=0;
 for(const [table,column,parent,parentColumn,kind]of edges){
  const limit=Math.min(10001,20001-checked);let rows;
  try{rows=sql.exec(`SELECT c.${column} AS childKey,p.${parentColumn} AS parentKey,typeof(c.${column}) AS childKind,typeof(p.${parentColumn}) AS parentKind FROM ${table} c LEFT JOIN ${parent} p ON p.${parentColumn}=c.${column} LIMIT ?`,limit).toArray();}catch{fail(503,'DELETE_FOREIGN_KEY_QUERY');}
  if(!Array.isArray(rows)||rows.length>limit)fail(503,'DELETE_FOREIGN_KEY_QUERY');
  if(rows.length>10000||checked+rows.length>20000)fail(503,'DELETE_FOREIGN_KEY_BUDGET');
  for(const row of rows)if(!row||row.childKind!==kind||row.parentKind!==kind||row.parentKey!==row.childKey||(kind==='text'?typeof row.childKey!=='string':!Number.isSafeInteger(row.childKey)||row.childKey<1))fail(503,'DELETE_FOREIGN_KEY_ROWS');
  checked+=rows.length;afterTable();
 }
 return Object.freeze({edgesVerified:edges.length,rowsChecked:checked});
}
export class GameDeletionForeignKeyRows{
 #storage;#principal;
 constructor({storage,principal}){if(!storage?.sql||typeof storage.transactionSync!=='function'||typeof principal!=='function')throw new TypeError('same SQLite storage and trusted principal required');this.#storage=storage;this.#principal=principal;}
 observe(tokenHash,input){
  fields(input,['gameId','expectedRowRevision']);const target=Object.freeze({gameId:input.gameId,expectedRowRevision:input.expectedRowRevision});
  return this.#storage.transactionSync(()=>{
   const first=this.#principal(tokenHash);if(first.must_change)fail(403,'PASSWORD_CHANGE_REQUIRED');const identity={id:first.id,epoch:first.epoch,role:first.role};
   const pinned=h=>{const actor=this.#principal(h);if(actor.must_change)fail(403,'PASSWORD_CHANGE_REQUIRED');if(actor.id!==identity.id||actor.epoch!==identity.epoch||actor.role!==identity.role)fail(401,'DELETE_FOREIGN_KEY_ACTOR_CHANGED');return actor;};
   const gate=new GameDeletionSchemaIntegrity({storage:this.#storage,principal:pinned});const initial=gate.observe(tokenHash,target);
   inspectDeclaredForeignKeyRows(this.#storage.sql,()=>gate.observe(tokenHash,target));
   const final=gate.observe(tokenHash,target);pinned(tokenHash);if(final.schemaDigest!==initial.schemaDigest)fail(503,'DELETE_FOREIGN_KEY_SCHEMA_CHANGED');
   // Deliberately no global session/user row counts or identifiers in the owner DTO.
   return Object.freeze({...final,foreignKeyRowsVerified:true,foreignKeyEdgesVerified:edges.length,rowIntegrityVerified:false,nativeDrainVerified:false,deleteAllowed:false,mode:'CURRENT_DECLARED_FOREIGN_KEY_ROWS_ONLY_LEGACY_UNKNOWN'});
  });
 }
}
