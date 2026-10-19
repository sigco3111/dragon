// Actual common application Request dispatch and compiler/pack stores on owned
// SQLite/FileBucket. Seeded test sessions and pinned full-copy bootstrap are NOT
// login, author blank-creation, real S3 or browser certificates. In-memory R2
// carries actual twenty-chapter staged bytes; default publisher + Node reader.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createDistributionPublisher } from '../vps/distribution-publisher.mjs';
import reader from '../reader/worker.js';
register('../vps/text-loader.mjs', import.meta.url);
const { createEditorApplication } = await import('../server/editorapp.js');
const { openStorage } = await import('../vps/sqlite-port.mjs');
const { FileBucket } = await import('../vps/file-bucket.mjs');
const { installedSourcePolicy } = await import('../server/sourcecatalogpolicy.js');
const { encodeSourceChunks, canonicalSourceTokens } = await import('../web/src/content/authoring/sourcejson.js');
const { createPinnedCopyLoader } = await import('./editor_trusted_copy.mjs');
const { mac } = await import('../server/security.js');
const { assertDeletionDefinitions } = await import('../server/deletiondefinitions.js');
const { GameDeletionJobFreeze } = await import('../server/deletionjobfreeze.js');
const { GameDeletionDraftFreeze } = await import('../server/deletiondraftfreeze.js');
const scratch = mkdtempSync(join(tmpdir(), 'frozen-publication-root-')), storage = openStorage(':memory:');
const ADMIN = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', OWNER = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const origin = 'https://owned-editor.invalid', secret = 'c'.repeat(64), token = '1'.repeat(64), adminToken = '2'.repeat(64);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = sha(token), adminHash = sha(adminToken);
let staging = null;
let app, gameId, groups = 0, reads = 0, pauseReads = null;
try {
  staging = (await import('./fixtures/publish-runtime-stage.mjs')).makePublishRuntimeStage({ root: join(scratch, 'static-package') });
  const bucket = new FileBucket({ root: join(scratch, 'objects') }), get = bucket.get.bind(bucket);
  bucket.get = async key => { reads++; if (pauseReads) { await pauseReads(key); } return get(key); };
  const env = { EDITOR_ORIGIN: origin, EDITOR_REQUEST_KEY: secret, EDITOR_DEFAULT_PASSWORD: 'Owned-Test-Password-Only-1!', EDITOR_BLOBS: bucket };
  const makeApp = () => new (createEditorApplication(class {}, { runtimeStager: staging.stager, frozenPublication: true }))({ storage }, env);
  app = makeApp();
  // Include the two lazy, actual schema owners before the complete frozen gate.
  const freezeOptions = { storage, principal: () => { throw new Error('unused owned freeze principal'); }, requestKey: secret };
  new GameDeletionJobFreeze(freezeOptions); new GameDeletionDraftFreeze(freezeOptions);
  const sql = storage.sql;
  for (const [id, account, role, tokenHash] of [[ADMIN, 'tianyi', 'admin', adminHash], [OWNER, 'owned_author', 'author', hash]]) {
    sql.exec('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, account, role, '{}', 0, 0, 1, 1, '', '', '', '');
    sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?)', tokenHash, id, 1, Date.now() + 3600000, Date.now() + 3600000);
  }
  assert.equal(assertDeletionDefinitions(sql).tablesVerified, 50);
  const csrf = await mac(`csrf:${token}`, secret);
  const call = async (name, key, extra = {}) => {
    const started = performance.now();
    const response = await app.fetch(new Request(`${origin}/api/publish`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `__Secure-dragon-editor=${token}`, 'X-CSRF-Token': csrf, 'Idempotency-Key': key, ...extra }, body: JSON.stringify({ gameId, name }) }));
    const result = { status: response.status, value: await response.json() };
    if (staging) process.stdout.write(JSON.stringify({ request: key, status: result.status, milliseconds: Math.round(performance.now() - started) }) + '\n');
    return result;
  };
  const adminCsrf = await mac(`csrf:${adminToken}`, secret);
  let managementSerial = 0, lastManagementRequest;
  const managementRequest = async (request, expectedStatus = 200) => {
    const response = await app.fetch(request.clone());
    const result = await response.json(); assert.equal(response.status, expectedStatus, JSON.stringify(result));
    return result;
  };
  const manage = async (action, expectedStatus = 200, asAuthor = false) => {
    const rowRevision = sql.exec('SELECT row_revision FROM content_games WHERE game_id=?', gameId).toArray()[0].row_revision;
    const path = action === 'clear' ? 'restriction/clear' : 'listing';
    let value = {};
    if (action === 'list') value = { action, expectedRowRevision: rowRevision };
    else if (action !== 'clear') value = { action };
    lastManagementRequest = new Request(`${origin}/api/games/${gameId}/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `__Secure-dragon-editor=${asAuthor ? token : adminToken}`, 'X-CSRF-Token': asAuthor ? csrf : adminCsrf, 'Idempotency-Key': `owned-history-management-${++managementSerial}`, 'If-Match': `"${rowRevision}"` }, body: JSON.stringify(value) });
    return managementRequest(lastManagementRequest, expectedStatus);
  };
  const policy = installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'), readFileSync('server/pinned/entity-manifest.txt'));
  const stageInstalled = async bytes => {
    const data = new Uint8Array(bytes), digest = sha(data), key = `installed/${policy.registryId}/${digest}`;
    if (!await bucket.get(key)) { await bucket.put(key, data, {}); }
    return { sha256: digest, byteLength: data.length };
  };
  const roles = [];
  for (const role of policy.roles) {
    const data = readFileSync(join('web', role.path)), chunks = [];
    for (let at = 0; at < data.length; at += 1048576) { chunks.push(await stageInstalled(data.subarray(at, at + 1048576))); }
    roles.push({ path: role.path, sha256: role.sha256, byteLength: role.byteLength, chunks });
  }
  const definitionDigest = app.installedSources.definition().definitionDigest;
  const installedRoot = await stageInstalled(Buffer.concat(encodeSourceChunks({ schema: 'dragon-installed-source-index-1', registryId: policy.registryId, definitionDigest, roles })));
  await app.installedSources.install(adminHash, policy.registryId, installedRoot, 'owned-install-operation-01');
  const allocation = app.games.allocateGameId(hash); gameId = allocation.gameId;
  const { game } = await createPinnedCopyLoader()({ gameId, ownerId: OWNER });
  const stageGame = async bytes => {
    const put = await app.blobs.putImmutable(hash, { gameId, allocation, bytes: new Uint8Array(bytes) });
    return { sha256: put.sha256, byteLength: put.byteLength };
  };
  const all = createHash('sha256'), chunks = [];
  for (const bytes of encodeSourceChunks(game)) { all.update(bytes); chunks.push(await stageGame(bytes)); }
  const sourceDigest = all.digest('hex');
  const root = await stageGame(Buffer.concat(encodeSourceChunks({ schema: 'dragon-game-source-index-1', gameId, sourceDigest, sourceByteLength: chunks.reduce((n, part) => n + part.byteLength, 0), chunks, dependencies: [] })));
  const dependencies = createHash('sha256'); for (const part of canonicalSourceTokens({ chunks, dependencies: [] })) { dependencies.update(part, 'utf8'); }
  storage.transactionSync(() => {
    sql.exec('INSERT INTO copy_objects VALUES(?,?,?,?)', gameId, root.sha256, root.byteLength, 'committed');
    sql.exec('INSERT INTO copy_origins VALUES(?,?,?,?,?,?,?,?,?,?)', gameId, policy.registryId, definitionDigest, installedRoot.sha256, policy.profileRevision, root.sha256, root.byteLength, sourceDigest, sourceDigest, dependencies.digest('hex'));
  });
  const prepared = await app.games.prepareSnapshot(hash, { gameId, draftRevision: '1', metadata: { ...game.metadata }, source: root, allocation });
  app.games.transaction(hash, { key: 'owned-bootstrap-create-01', method: 'create', target: 'new', digest: 'd'.repeat(64) }, api => api.create(allocation, prepared));
  const tables = ['content_games','content_releases','published_games','published_packs','published_pack_chapters','published_pack_assets','content_operations','content_reservations','content_audits','content_announcements','content_registry','content_distribution_outbox','content_distribution_state','content_distribution_events','content_distribution_chunks','content_deletion_fences','content_deletion_operations'];
  const fingerprint = () => { const h=createHash('sha256'); for(const table of tables) h.update(JSON.stringify(sql.exec(`SELECT * FROM ${table} ORDER BY rowid`).toArray())); return h.digest('hex'); };
  const publicationStatus = async (key, expected = 200, actorToken = token, target = gameId, suffix = '') => {
    const headers = actorToken ? { Cookie: `__Secure-dragon-editor=${actorToken}` } : {};
    const response = await app.fetch(new Request(`${origin}/api/games/${target}/publish-operations/${key}${suffix}`, { headers }));
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value));
    assert.ok(response.headers.get('Cache-Control').includes('no-store'));
    return value;
  };
  const managementStatus = async (request, expected = 200, actorToken = adminToken, target = gameId, suffix = '') => {
    const key = typeof request === 'string' ? request : request.headers.get('Idempotency-Key');
    const headers = actorToken ? { Cookie: `__Secure-dragon-editor=${actorToken}` } : {};
    const response = await app.fetch(new Request(`${origin}/api/admin/games/${target}/management-operations/${key}/distribution${suffix}`, { headers }));
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value));
    assert.ok(response.headers.get('Cache-Control').includes('no-store')); return value;
  };
  const tail = () => app.frozenDistribution.status().tailGeneration;
  const envelope = gen => JSON.parse(new TextDecoder().decode(app.frozenDistribution.entry(gen).payload));
  assert.equal((await manage('list',409)).error,'GAME_NOT_PUBLISHED'); assert.equal(tail(),0); groups++;
  const unchanged=fingerprint();
  sql.exec("CREATE TRIGGER owned_abort BEFORE INSERT ON content_distribution_chunks BEGIN SELECT RAISE(ABORT,'owned frozen failure'); END");
  try { assert.equal((await call('Frozen one','owned-frozen-publish-01')).status,500); }
  finally { sql.exec('DROP TRIGGER owned_abort'); }
  assert.equal(fingerprint(),unchanged); assert.equal(tail(),0); groups++;
  const first=await call('Frozen one','owned-frozen-publish-01'); assert.equal(first.status,200,JSON.stringify(first.value));assert.equal(first.value.ordinal,'1.0');assert.equal(tail(),1);
  assert.equal(app.playPacks.pack(gameId).manifest.chapters.length,20);
  const frozen1=Buffer.from(app.frozenDistribution.entry(1).payload);
  const statusBefore = fingerprint(), pendingStatus = await publicationStatus('owned-frozen-publish-01');
  assert.deepEqual(pendingStatus.pin, first.value);
  assert.equal(pendingStatus.releaseId, app.frozenDistribution.entry(1).operationId);
  assert.deepEqual(pendingStatus.distribution, { gameId, operationId: pendingStatus.releaseId, generation: 1, kind: 'publish', state: 'pending', visibleAt: null, recoveryRequired: false });
  assert.equal((await publicationStatus('owned-frozen-publish-01', 404, adminToken)).error, 'GAME_NOT_FOUND');
  await publicationStatus('owned-frozen-publish-01', 401, null);
  await publicationStatus('owned-frozen-publish-01', 404, token, ADMIN);
  assert.equal((await publicationStatus('owned-frozen-unknown-key', 404)).error, 'PUBLISH_OPERATION_NOT_FOUND');
  await publicationStatus('owned-frozen-publish-01', 422, token, gameId, '?extra=1');
  assert.equal(fingerprint(), statusBefore, 'status reads change no authority, outbox or release state'); groups++;
  sql.exec('UPDATE users SET disabled=1 WHERE id=?', OWNER);
  try { await publicationStatus('owned-frozen-publish-01', 401); } finally { sql.exec('UPDATE users SET disabled=0 WHERE id=?', OWNER); }
  sql.exec('UPDATE users SET must_change=1 WHERE id=?', OWNER);
  try { await publicationStatus('owned-frozen-publish-01', 403); } finally { sql.exec('UPDATE users SET must_change=0 WHERE id=?', OWNER); }
  sql.exec('UPDATE users SET epoch=2 WHERE id=?', OWNER); sql.exec('UPDATE sessions SET epoch=2 WHERE token_hash=?', hash);
  try { assert.equal((await publicationStatus('owned-frozen-publish-01', 409)).error, 'OPERATION_REVOKED'); }
  finally { sql.exec('UPDATE users SET epoch=1 WHERE id=?', OWNER); sql.exec('UPDATE sessions SET epoch=1 WHERE token_hash=?', hash); } groups++;
  assert.equal(envelope(1).catalog.games[0].current.chapters.length,20);
  assert.deepEqual(envelope(1).projection.directory,[]); assert.deepEqual(envelope(1).projection.announcements,[]);
  assert.equal(sql.exec('SELECT * FROM content_announcements').toArray().length,0);
  assert.equal(sql.exec('SELECT * FROM content_distribution_outbox').toArray().length,0); groups++;
  assert.deepEqual(await call('Frozen one','owned-frozen-publish-01'),first); assert.equal(tail(),1);
  const pending=await call('Blocked','owned-frozen-publish-blocked');assert.equal(pending.status,409);assert.equal(pending.value.error,'DISTRIBUTION_GAME_PENDING');groups++;
  const savedReceipt = sql.exec("SELECT result_json FROM content_operations WHERE actor=? AND op_key='owned-frozen-publish-01'", OWNER).toArray()[0].result_json;
  sql.exec("UPDATE content_operations SET result_json=? WHERE actor=? AND op_key='owned-frozen-publish-01'", JSON.stringify({ version: 1, gameId, releaseId: ADMIN, pin: pendingStatus.pin }), OWNER);
  try { assert.equal((await publicationStatus('owned-frozen-publish-01',503)).error, 'DISTRIBUTION_STATUS_UNAVAILABLE'); }
  finally { sql.exec("UPDATE content_operations SET result_json=? WHERE actor=? AND op_key='owned-frozen-publish-01'", savedReceipt, OWNER); } groups++;
  let writes=0, failReceipt=true;
  const r2={
    async get(key,{maxBytes}) { assert.ok(key.startsWith(staging.prefix));const value=staging.objects.get(key);if(!value)return null;assert.ok(value.bytes.length<=maxBytes);return {bytes:Buffer.from(value.bytes),headers:{...value.headers}}; },
    async putImmutable(key,bytes,type) { assert.ok(key.startsWith(staging.prefix+'control/roots/')||key.startsWith(staging.prefix+'control/receipts/')||key.startsWith(staging.prefix+'projections/'));if(failReceipt && key.startsWith(staging.prefix+'control/receipts/'))throw new Error('owned receipt unavailable');if(!staging.objects.has(key))staging.objects.set(key,{bytes:Buffer.from(bytes),headers:{'content-type':type,etag:'"immutable-'+sha(bytes)+'"','last-modified':'Thu, 15 Oct 2026 00:00:00 GMT'}}); },
    async putControl(key,bytes,etag) { assert.equal(key,staging.prefix+'control/current.json');const previous=staging.objects.get(key);if((previous?.headers.etag??null)!==(etag??null))return false;writes++;staging.objects.set(key,{bytes:Buffer.from(bytes),headers:{'content-type':'application/json',etag:'"root-'+writes+'"','last-modified':new Date(Date.UTC(2026,9,15,0,0,writes)).toUTCString()}});return true; },
  };
  let publisher=createDistributionPublisher({storage,r2,prefix:staging.prefix,verifyStaticResources:staging.verifyStaticResources});
  const drain=async generation=>{const value=await publisher.drainOne();assert.equal(app.frozenDistribution.status().confirmedGeneration,generation,JSON.stringify(value));return value;};
  const playerOrigin='https://owned-player.invalid';
  const readerEnv={PLAYER_ORIGIN:playerOrigin,PLAYER_ADMISSION_ACTIVE_KEY:'owned',PLAYER_ADMISSION_KEYS:JSON.stringify({owned:'a'.repeat(64)}),PUBLISH_BUCKET:{async get(key){const value=staging.objects.get(staging.prefix+key);if(!value)return null;const bytes=Buffer.from(value.bytes);return {size:bytes.length,uploaded:new Date(value.headers['last-modified']),httpMetadata:{contentType:value.headers['content-type']},arrayBuffer:async()=>Uint8Array.from(bytes).buffer};}}};
  const player=async(path,headers)=>{const response=await reader.fetch(new Request(playerOrigin+path,{headers}),readerEnv);return {status:response.status,value:await response.json()};};
  await publisher.drainOne(); assert.equal(writes,1); assert.equal(app.frozenDistribution.status().confirmedGeneration,0);
  assert.deepEqual(await publicationStatus('owned-frozen-publish-01'), pendingStatus, 'remote root without a durable confirmation still reports pending');
  failReceipt=false;
  await drain(1);assert.equal(writes,1);assert.deepEqual((await player('/play-api/v1/registry')).value.directory,[]);groups++;
  const confirmedStatus = await publicationStatus('owned-frozen-publish-01');
  assert.deepEqual(confirmedStatus, { ...pendingStatus, distribution: { ...pendingStatus.distribution, state: 'confirmed', visibleAt: '2026-10-15T00:00:01.000Z' } });
  // Confirmation of a hidden publish is NOT evidence that a game is listed.
  assert.deepEqual((await player('/play-api/v1/registry')).value.directory, []); groups++;
  const beforeListing=fingerprint();
  sql.exec("CREATE TRIGGER owned_abort BEFORE INSERT ON content_operations WHEN NEW.method='admin-list' BEGIN SELECT RAISE(ABORT,'owned listing failure'); END");
  try { await manage('list',500); } finally { sql.exec('DROP TRIGGER owned_abort'); }
  const listingRequest=lastManagementRequest.clone();assert.equal(fingerprint(),beforeListing);assert.equal(tail(),1);groups++;
  const listed=await managementRequest(listingRequest);assert.equal(tail(),2);
  assert.deepEqual(await managementRequest(listingRequest),listed);assert.equal(tail(),2);
  const beforeManagementStatus=fingerprint(), pendingManagement=await managementStatus(listingRequest);
  assert.deepEqual(pendingManagement.result,listed);assert.equal(pendingManagement.version,1);assert.equal(pendingManagement.gameId,gameId);
  assert.deepEqual(pendingManagement.distribution,{gameId,operationId:app.frozenDistribution.entry(2).operationId,generation:2,kind:'listing',state:'pending',visibleAt:null,recoveryRequired:false});
  await managementStatus(listingRequest,403,token);await managementStatus(listingRequest,401,null);await managementStatus(listingRequest,404,adminToken,ADMIN);
  await managementStatus('owned-unknown-management',404);await managementStatus(listingRequest,422,adminToken,gameId,'?extra=1');
  assert.equal(fingerprint(),beforeManagementStatus);groups++;
  for(const [field,value,status]of [['disabled',1,401],['must_change',1,403]]) {
    sql.exec(`UPDATE users SET ${field}=? WHERE id=?`,value,ADMIN);
    try {await managementStatus(listingRequest,status);}finally{sql.exec(`UPDATE users SET ${field}=0 WHERE id=?`,ADMIN);}
  }
  sql.exec('UPDATE users SET epoch=2 WHERE id=?',ADMIN);sql.exec('UPDATE sessions SET epoch=2 WHERE token_hash=?',adminHash);
  try {assert.equal((await managementStatus(listingRequest,409)).error,'OPERATION_REVOKED');}finally{sql.exec('UPDATE users SET epoch=1 WHERE id=?',ADMIN);sql.exec('UPDATE sessions SET epoch=1 WHERE token_hash=?',adminHash);}groups++;
  const unchangedListing=await manage('list');assert.deepEqual(unchangedListing,listed);assert.equal(tail(),2);
  assert.deepEqual(await managementStatus(lastManagementRequest),{version:1,gameId,result:listed,distribution:null});groups++;
  assert.deepEqual((await player('/play-api/v1/registry')).value.directory,[],'authority commit is not remote visibility');
  assert.equal((await call('Blocked','owned-frozen-publish-blocked')).status,409);await drain(2);groups++;
  const confirmedManagement=await managementStatus(listingRequest);
  assert.deepEqual(confirmedManagement,{...pendingManagement,distribution:{...pendingManagement.distribution,state:'confirmed',visibleAt:'2026-10-15T00:00:02.000Z'}});groups++;
  const visible=(await player('/play-api/v1/registry')).value;assert.equal(visible.directory.length,1);assert.equal(visible.announcements.length,1);assert.equal(visible.announcements[0].firstOnlineAt,'2026-10-15T00:00:02.000Z');
  const chapter=visible.directory[0].chapters[0],admissionPath=ordinal=>`/play-api/v1/admissions?game=${gameId}&ordinal=${ordinal}&chapter=${encodeURIComponent(chapter)}`;
  const admitted=await player(admissionPath('1.0'));assert.equal(admitted.status,200,JSON.stringify(admitted));
  const role=`/play-api/v1/file?role=${encodeURIComponent('chapter:'+chapter)}`,auth={Authorization:'Bearer '+admitted.value.ticket};
  const oldChapter=await player(role,auth);assert.equal(oldChapter.status,200);groups++;
  app=makeApp();publisher=createDistributionPublisher({storage,r2,prefix:staging.prefix,verifyStaticResources:staging.verifyStaticResources});
  await publisher.drainOne();assert.equal(writes,2);assert.deepEqual(await managementRequest(listingRequest),listed);groups++;
  assert.deepEqual(await publicationStatus('owned-frozen-publish-01'), confirmedStatus); groups++;
  assert.deepEqual(await managementStatus(listingRequest),confirmedManagement);groups++;
  sql.exec("UPDATE users SET account='changed_author' WHERE id=?",OWNER);
  const updated=await Promise.all([call('Frozen two','owned-frozen-publish-02'),call('Frozen two','owned-frozen-publish-02')]);
  assert.equal(updated[0].status,200,JSON.stringify(updated));assert.deepEqual(updated[0],updated[1]);assert.equal(updated[0].value.ordinal,'1.1');assert.equal(tail(),3);assert.deepEqual(Buffer.from(app.frozenDistribution.entry(1).payload),frozen1);
  assert.deepEqual(await publicationStatus('owned-frozen-publish-01'), confirmedStatus, 'old request status survives release pruning');
  const secondStatus = await publicationStatus('owned-frozen-publish-02');
  assert.equal(secondStatus.distribution.generation, 3); assert.equal(secondStatus.distribution.state, 'pending');
  assert.notEqual(secondStatus.distribution.operationId, confirmedStatus.distribution.operationId); groups++;
  assert.equal((await player(admissionPath('1.1'))).status,409);await drain(3);
  assert.equal((await publicationStatus('owned-frozen-publish-02')).distribution.visibleAt, '2026-10-15T00:00:03.000Z');
  const announcements=(await player('/play-api/v1/registry')).value.announcements;assert.equal(announcements.length,2);assert.deepEqual(announcements[0],visible.announcements[0]);assert.equal(announcements[1].creatorAccount,'changed_author');
  assert.equal((await player(admissionPath('1.0'))).status,409);assert.equal((await player(admissionPath('1.1'))).status,200);assert.deepEqual(await player(role,auth),oldChapter);groups++;
  const recognized=await player('/play-api/v1/releases?'+new URLSearchParams({game:gameId,release:admitted.value.releaseId,ordinal:'1.0'}));
  assert.equal(recognized.status,200,JSON.stringify(recognized));
  assert.deepEqual(recognized.value.saved,{...visible.directory[0],manifestDigest:admitted.value.manifestDigest});
  assert.equal(recognized.value.current.ordinal,'1.1');assert.equal(recognized.value.current.releaseId,sql.exec('SELECT current_release_id FROM content_games WHERE game_id=?',gameId).toArray()[0].current_release_id);
  assert.equal(recognized.value.ticket,undefined);assert.equal((await player(admissionPath('1.0'))).status,409);groups++;
  const currentApp=app;app=new (createEditorApplication(class {}))({storage},env);const beforeLegacy=fingerprint();
  try {assert.equal((await manage('unlist',503)).error,'DISTRIBUTION_MODE_REQUIRED');assert.equal((await publicationStatus('owned-frozen-publish-01',503)).error,'DISTRIBUTION_NOT_CONFIGURED');assert.equal((await managementStatus(listingRequest,503)).error,'DISTRIBUTION_NOT_CONFIGURED');assert.equal(fingerprint(),beforeLegacy);}finally{app=currentApp;}groups++;
  const beforeUnlist=fingerprint();sql.exec("CREATE TRIGGER owned_abort BEFORE INSERT ON content_distribution_events WHEN NEW.kind='restriction' BEGIN SELECT RAISE(ABORT,'owned unlist failure'); END");
  try { await manage('unlist',500); } finally { sql.exec('DROP TRIGGER owned_abort'); }
  assert.equal(fingerprint(),beforeUnlist);assert.equal(tail(),3);groups++;
  await manage('unlist');assert.equal(tail(),4);const unlistRequest=lastManagementRequest.clone();assert.deepEqual(await managementRequest(unlistRequest),await managementRequest(unlistRequest));assert.equal(tail(),4);
  const unlistStatus=await managementStatus(unlistRequest);assert.equal(unlistStatus.distribution.generation,4);assert.equal(unlistStatus.distribution.kind,'restriction');assert.equal(unlistStatus.distribution.state,'pending');
  assert.deepEqual(await managementStatus(listingRequest),confirmedManagement,'old listing status does not relist or claim current state');groups++;
  await manage('clear');assert.equal(tail(),5);assert.equal((await managementStatus(lastManagementRequest)).distribution.generation,5);
  await manage('list');assert.equal(tail(),6);await manage('unlist');assert.equal(tail(),7);
  const row=sql.exec('SELECT row_revision,draft_name FROM content_games WHERE game_id=?',gameId).toArray()[0];
  const previewDeletion=async(expected=200,actorToken=adminToken,target=gameId,suffix='')=>{
    const headers=actorToken?{Cookie:`__Secure-dragon-editor=${actorToken}`} : {};
    const reply=await app.fetch(new Request(`${origin}/api/admin/games/${target}/deletion-preview${suffix}`,{headers}));
    const value=await reply.json();assert.equal(reply.status,expected,JSON.stringify(value));assert.ok(reply.headers.get('Cache-Control').includes('no-store'));return value;
  };
  const beforePreview=fingerprint();
  assert.deepEqual(await previewDeletion(),{gameId,rowRevision:row.row_revision,confirmationName:row.draft_name});assert.equal(fingerprint(),beforePreview);
  const privateBefore=reads;const forbiddenDraft=await app.fetch(new Request(`${origin}/api/games/${gameId}/draft?revision=1`,{headers:{Cookie:`__Secure-dragon-editor=${adminToken}`}}));assert.equal(forbiddenDraft.status,404);assert.equal(reads,privateBefore);
  await previewDeletion(403,token);await previewDeletion(401,null);await previewDeletion(403,adminToken,'wolong-builtin');await previewDeletion(404,adminToken,ADMIN);await previewDeletion(422,adminToken,gameId,'?extra=1');
  for(const [field,status]of [['disabled',401],['must_change',403]]){sql.exec(`UPDATE users SET ${field}=1 WHERE id=?`,ADMIN);try{await previewDeletion(status);}finally{sql.exec(`UPDATE users SET ${field}=0 WHERE id=?`,ADMIN);}}
  sql.exec('UPDATE content_games SET listed=1 WHERE game_id=?',gameId);try{await previewDeletion(409);}finally{sql.exec('UPDATE content_games SET listed=0 WHERE game_id=?',gameId);}assert.equal(fingerprint(),beforePreview);groups++;
  const deletion=new Request(`${origin}/api/games/${gameId}/deletion`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:`__Secure-dragon-editor=${adminToken}`,'X-CSRF-Token':adminCsrf,'Idempotency-Key':'owned-frozen-delete-01'},body:JSON.stringify({expectedRowRevision:row.row_revision,confirmationName:row.draft_name})});
  const beforeDeletion=fingerprint();sql.exec("CREATE TRIGGER owned_abort BEFORE INSERT ON content_distribution_events WHEN NEW.kind='delete-fence' BEGIN SELECT RAISE(ABORT,'owned fence failure'); END");
  try { await managementRequest(deletion,500); } finally { sql.exec('DROP TRIGGER owned_abort'); }
  assert.equal(fingerprint(),beforeDeletion);assert.equal(tail(),7);groups++;
  const deletionResult=await managementRequest(deletion);assert.equal(deletionResult.state,'fenced');assert.equal(tail(),8);assert.deepEqual(await managementRequest(deletion),deletionResult);assert.equal(tail(),8);groups++;
  const deletionStatus=async(expected=200,actorToken=adminToken,target=gameId,suffix='/distribution')=>{
    const headers=actorToken?{Cookie:`__Secure-dragon-editor=${actorToken}`} : {};
    const reply=await app.fetch(new Request(`${origin}/api/games/${target}/deletion-operations/owned-frozen-delete-01${suffix}`,{headers}));
    const value=await reply.json();assert.equal(reply.status,expected,JSON.stringify(value));assert.ok(reply.headers.get('Cache-Control').includes('no-store'));return value;
  };
  assert.equal((await previewDeletion(409)).error,'GAME_DELETING');groups++;
  const beforeDeletionStatus=fingerprint(), pendingDeletion=await deletionStatus();
  assert.deepEqual(pendingDeletion.result,deletionResult);assert.equal(pendingDeletion.distribution.generation,8);assert.equal(pendingDeletion.distribution.kind,'delete-fence');assert.equal(pendingDeletion.distribution.state,'pending');
  assert.deepEqual(await deletionStatus(200,adminToken,gameId,''),deletionResult);assert.equal(fingerprint(),beforeDeletionStatus);groups++;
  await deletionStatus(401,null);await deletionStatus(404,token);await deletionStatus(404,adminToken,ADMIN);await deletionStatus(404,adminToken,ADMIN,'');await deletionStatus(422,adminToken,gameId,'/distribution?extra=1');groups++;
  for(const [field,status]of [['disabled',401],['must_change',403]]){
    sql.exec(`UPDATE users SET ${field}=1 WHERE id=?`,ADMIN);
    try {await deletionStatus(status);}finally{sql.exec(`UPDATE users SET ${field}=0 WHERE id=?`,ADMIN);}
  }
  sql.exec('UPDATE users SET epoch=2 WHERE id=?',ADMIN);sql.exec('UPDATE sessions SET epoch=2 WHERE token_hash=?',adminHash);
  try {assert.equal((await deletionStatus(409)).error,'OPERATION_REVOKED');}finally{sql.exec('UPDATE users SET epoch=1 WHERE id=?',ADMIN);sql.exec('UPDATE sessions SET epoch=1 WHERE token_hash=?',adminHash);}groups++;
  const frozenApp=app;app=new (createEditorApplication(class {}))({storage},env);
  try {assert.equal((await deletionStatus(503)).error,'DISTRIBUTION_NOT_CONFIGURED');}finally{app=frozenApp;}groups++;
  assert.equal(sql.exec('SELECT * FROM published_packs').toArray().length,0);
  assert.equal((await publicationStatus('owned-frozen-publish-01',409)).error, 'GAME_DELETING'); groups++;
  assert.equal((await managementStatus(listingRequest,409)).error,'GAME_DELETING');groups++;
  // Drain old exact envelopes AFTER the mutable SQL packs have been removed.
  await drain(4);assert.deepEqual((await player('/play-api/v1/registry')).value.announcements,[]);assert.deepEqual(await player(role,auth),oldChapter);
  await drain(5);await drain(6);assert.deepEqual((await player('/play-api/v1/registry')).value.announcements,announcements);
  await drain(7);assert.deepEqual(await player(role,auth),oldChapter);await drain(8);assert.equal((await player(role,auth)).status,410);groups++;
  const confirmedDeletion=await deletionStatus();assert.equal(confirmedDeletion.distribution.state,'confirmed');assert.equal(confirmedDeletion.distribution.visibleAt,'2026-10-15T00:00:08.000Z');
  assert.equal(confirmedDeletion.distribution.operationId,pendingDeletion.distribution.operationId);assert.deepEqual(confirmedDeletion.result,deletionResult);groups++;
  assert.equal(writes,8);assert.deepEqual(sql.exec('SELECT kind FROM content_distribution_events ORDER BY generation').toArray().map(r=>r.kind),['publish','listing','publish','restriction','restriction','listing','restriction','delete-fence']);
  assert.equal(sql.exec('SELECT * FROM content_announcements').toArray().length,0);assert.equal(sql.exec('SELECT * FROM content_distribution_outbox').toArray().length,0);
  assert.deepEqual(Buffer.from(app.frozenDistribution.entry(1).payload),frozen1,'historical content remains: this is NOT physical deletion');
  const publicProjection=JSON.parse(staging.objects.get(staging.prefix+`projections/8/${JSON.parse(staging.objects.get(staging.prefix+'control/current.json').bytes).digest}/projection.json`).bytes);
  assert.equal(Object.hasOwn(publicProjection,'catalog'),false);assert.equal(JSON.stringify(publicProjection).includes('Frozen two'),false);
  assert.equal(assertDeletionDefinitions(sql).tablesVerified,50);groups++;
  process.stdout.write(JSON.stringify({scope:'frozen-publication-root',groups,generations:8,chapters:20,privateReads:reads,rootWrites:writes,static:staging.stats(),limits:'actual common Request/SQLite/compiler; in-memory R2 and Node reader, not S3/physical deletion/browser/production'})+'\n');
} finally { storage.close(); rmSync(scratch,{recursive:true,force:true}); }
