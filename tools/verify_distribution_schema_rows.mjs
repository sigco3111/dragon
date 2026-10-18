// Actual common Node application, isolated SQLite/FileBucket. No external I/O.
import { register } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '../vps/sqlite-port.mjs';
import { FileBucket } from '../vps/file-bucket.mjs';
import { GameDeletionJobFreeze } from '../server/deletionjobfreeze.js';
import { GameDeletionDraftFreeze } from '../server/deletiondraftfreeze.js';
import { verifyDistributionSchema } from './fixtures/distribution-schema.mjs';
register('../vps/text-loader.mjs',import.meta.url);
const { createEditorApplication } = await import('../server/editorapp.js');
const own=mkdtempSync(join(tmpdir(),'distribution-schema-rows-')),storage=openStorage(':memory:');
try {
  const app=new (createEditorApplication(class {}))({storage},{EDITOR_ORIGIN:'https://owned-schema.invalid',EDITOR_REQUEST_KEY:'a'.repeat(64),EDITOR_BLOBS:new FileBucket({root:join(own,'blobs')})});
  const options={storage,principal:()=>{throw new Error('unused fixture principal');},requestKey:'a'.repeat(64)};
  new GameDeletionJobFreeze(options); new GameDeletionDraftFreeze(options);
  console.log(JSON.stringify(await verifyDistributionSchema(storage,app.frozenDistribution),null,2));
} finally { storage.close(); rmSync(own,{recursive:true,force:true}); }
