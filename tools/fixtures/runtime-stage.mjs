// Shared owned transport tests; opaque bytes, not a compiled-game certificate.
import assert from 'node:assert/strict';
import { createRuntimeStager } from '../../vps/runtime-stage.mjs';
import { buildRuntimeIndex } from '../../vps/runtime-index.mjs';
import { publication, GAME, OTHER_GAME, PORTRAIT, TEMPLATE_PORTRAIT } from './publication.mjs';
function parse(text) { try { return JSON.parse(text); } catch (cause) { throw new Error('owned fixture JSON invalid', { cause }); } }
function input() {
  const source = publication(0, GAME, [`${GAME}#c1`, `${GAME}#c2`]);
  const pin = source.directory[0], file = suffix => source.files.find(item => item.key.endsWith(suffix));
  const manifest = parse(file('/manifest.json').bytes.toString());
  const candidate = { gameId: GAME, releaseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ordinal: pin.ordinal, draftRevision: pin.revision, sourceDigest: pin.sourceDigest };
  const snapshot = {
    identity: { gameId: GAME, draftRevision: pin.revision, sourceDigest: pin.sourceDigest },
    pack: { game_id: GAME, revision: pin.revision, source_digest: pin.sourceDigest, manifest_json: JSON.stringify(manifest) },
    chapters: pin.chapters.map(chapter_id => ({ chapter_id, state_json: file(`/chapters/${chapter_id}.json`).bytes.toString() })),
    assets: manifest.assets.map(row => ({ game_id: GAME, asset_id: row.assetId, sha256: row.sha256, byte_length: row.byteLength, bytes: Buffer.from(file('/' + row.sha256).bytes) })),
  };
  return { candidate, snapshot };
}
export async function exerciseRuntimeStage(makeStore) {
  let sequence = 0, checks = 0;
  async function fixture(run, options = {}) {
    const prefix = `test/runtime-stage-${++sequence}/`, store = await makeStore(prefix), value = input();
    for (const [id, bytes] of [['0', PORTRAIT], ['p0001', TEMPLATE_PORTRAIT]]) await store.put(prefix + `kao/${id}.png`, bytes, 'image/png');
    const oldRoot = Buffer.from('owned unchanged root'), oldProjection = Buffer.from('owned unchanged projection');
    await store.put(prefix + 'control/current.json', oldRoot, 'application/json');
    await store.put(prefix + 'projections/old.json', oldProjection, 'application/json');
    const gets = [], puts = [], hooks = {}; let active = true;
    const current = () => { if (!active) throw new Error('OWNED_AUTH_REVOKED'); };
    const r2 = {
      async get(key, budget) {
        assert.ok(key.startsWith(prefix + 'artifacts/') || key.startsWith(prefix + 'kao/')); gets.push({ key, budget });
        await hooks.beforeGet?.(key);
        const result = await store.get(key);
        return hooks.afterGet ? hooks.afterGet(key, result) : result;
      },
      async putImmutable(key, bytes, type) {
        assert.ok(key.startsWith(prefix + 'artifacts/')); puts.push(key);
        await hooks.beforePut?.(key, bytes);
        const result = await store.putIfMatch(key, bytes, type, null);
        await hooks.afterPut?.(key, bytes); return result;
      },
    };
    const stager = createRuntimeStager({ r2, prefix, ...options });
    await run({ ...value, store, r2, prefix, gets, puts, hooks, stager, current, revoke: () => { active = false; } });
    assert.deepEqual((await store.get(prefix + 'control/current.json')).bytes, oldRoot);
    assert.deepEqual((await store.get(prefix + 'projections/old.json')).bytes, oldProjection);
    checks++;
  }
  await fixture(async f => {
    const result = await f.stager.stage(f.candidate, f.snapshot, f.current);
    assert.equal(f.puts.length, 5); assert.equal(f.gets.length, 14);
    assert.ok(f.puts.some(key => key.includes(GAME + '#c1'))); assert.ok(f.puts.every(key => !key.includes('%23')));
    for (const read of f.gets) assert.equal(read.budget.maxBytes, (await f.store.get(read.key)).bytes.length);
    assert.deepEqual(f.stager.verifyStaged(result.ticket, f.candidate), result.runtime);
    assert.ok(Object.isFrozen(result.runtime) && Object.isFrozen(result.runtime.chapters) && Object.isFrozen(result.runtime.runtime));
    assert.deepEqual(Object.keys(result.ticket), []);
    assert.throws(() => f.stager.verifyStaged({}, f.candidate), /RUNTIME_STAGE/);
    assert.throws(() => createRuntimeStager({ r2: f.r2, prefix: f.prefix }).verifyStaged(result.ticket, f.candidate), /RUNTIME_STAGE/);
    for (const [key, value] of Object.entries({ gameId: OTHER_GAME, releaseId: OTHER_GAME, ordinal: '1.1', draftRevision: '2', sourceDigest: 'a'.repeat(64) })) assert.throws(() => f.stager.verifyStaged(result.ticket, { ...f.candidate, [key]: value }), /RUNTIME_STAGE/);
    const again = await f.stager.stage(f.candidate, f.snapshot, f.current);
    assert.deepEqual(again.runtime, result.runtime); assert.notEqual(again.ticket, result.ticket);
  });
  await fixture(async f => {
    await f.stager.stage(f.candidate, f.snapshot, f.current);
    const before = await f.store.get(f.prefix + `artifacts/${GAME}/1.0/${f.candidate.releaseId}/chapters/${GAME}#c1.json`);
    f.snapshot.chapters[0].state_json = '{"changed":true}';
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /RUNTIME_STAGE/);
    assert.deepEqual(await f.store.get(f.prefix + `artifacts/${GAME}/1.0/${f.candidate.releaseId}/chapters/${GAME}#c1.json`), before);
    f.candidate.releaseId = OTHER_GAME;
    await f.stager.stage(f.candidate, f.snapshot, f.current);
  });
  for (const id of ['0', 'p0001']) await fixture(async f => {
    await f.store.remove(f.prefix + `kao/${id}.png`);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /RUNTIME_STAGE/); assert.equal(f.puts.length, 0);
  });
  for (const corruption of ['bytes', 'mime', 'duplicate']) await fixture(async f => {
    f.hooks.afterGet = (key, result) => {
      if (key.endsWith('kao/0.png')) {
        if (corruption === 'bytes') result.bytes = Buffer.alloc(result.bytes.length);
        if (corruption === 'mime') result.headers['content-type'] = 'text/plain';
        if (corruption === 'duplicate') result.headers['Content-Type'] = 'image/png';
      }
      return result;
    };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /RUNTIME_STAGE/); assert.equal(f.puts.length, 0);
  });
  await fixture(async f => {
    f.hooks.beforeGet = () => { throw new Error('OWNED_NETWORK'); };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /OWNED_NETWORK/); assert.equal(f.puts.length, 0);
  });
  await fixture(async f => {
    f.hooks.beforePut = () => { throw new Error('OWNED_NO_WRITE'); };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /RUNTIME_STAGE/); assert.equal(f.puts.length, 1);
  });
  await fixture(async f => {
    f.hooks.afterPut = () => { throw new Error('OWNED_RESPONSE_LOST'); };
    const result = await f.stager.stage(f.candidate, f.snapshot, f.current);
    assert.equal(f.stager.verifyStaged(result.ticket, f.candidate), result.runtime);
  });
  await fixture(async f => {
    f.hooks.afterPut = (_key, bytes) => bytes.fill(0);
    await f.stager.stage(f.candidate, f.snapshot, f.current);
  });
  await fixture(async f => {
    f.hooks.afterGet = (key, result) => { if (key.includes('/artifacts/')) result.bytes = Buffer.from('corrupt'); return result; };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /RUNTIME_STAGE/); assert.equal(f.puts.length, 1);
  });
  for (const phase of ['afterGet', 'afterPut']) await fixture(async f => {
    f.hooks[phase] = (_key, result) => { f.revoke(); return result; };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /OWNED_AUTH_REVOKED/);
    assert.equal(f.puts.length, phase === 'afterGet' ? 0 : 1);
  });
  await fixture(async f => {
    const captured = { ...f.candidate }; let changed = false;
    f.hooks.beforeGet = () => { if (!changed) { changed = true; f.candidate.ordinal = '1.9'; f.snapshot.pack.manifest_json = '{}'; f.snapshot.chapters[0].state_json = '{}'; f.snapshot.assets[0].bytes.fill(0); } };
    const result = await f.stager.stage(f.candidate, f.snapshot, f.current);
    assert.equal(f.stager.verifyStaged(result.ticket, captured).ordinal, '1.0');
    assert.throws(() => f.stager.verifyStaged(result.ticket, f.candidate), /RUNTIME_STAGE/);
  });
  for (const kind of ['chapter', 'portrait']) await fixture(async f => {
    const suffix = kind === 'chapter' ? `/chapters/${GAME}#c1.json` : 'kao/0.png'; let count = 0;
    f.hooks.beforeGet = async key => { if (key.endsWith(suffix) && ++count === 2) await f.store.remove(key); };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /DISTRIBUTION_RESOURCES/);
    assert.equal(f.puts.length, 5);
  });
  await fixture(async f => {
    const manifest = parse(f.snapshot.pack.manifest_json); manifest.visualAssets = {}; f.snapshot.pack.manifest_json = JSON.stringify(manifest);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /DISTRIBUTION_STATIC_NOT_CONFIGURED/);
    assert.equal(f.gets.length + f.puts.length, 0);
  });
  let staticChecks = 0;
  await fixture(async f => {
    const manifest = parse(f.snapshot.pack.manifest_json); manifest.visualAssets = {}; f.snapshot.pack.manifest_json = JSON.stringify(manifest);
    await f.stager.stage(f.candidate, f.snapshot, f.current); assert.equal(staticChecks, 1);
  }, { verifyStaticResources: async value => { staticChecks++; value.index.resources = {}; } }); // Explicit static verifier seam, NOT deployed-byte proof.
  await fixture(async f => {
    const manifest = parse(f.snapshot.pack.manifest_json); manifest.visualAssets = {}; f.snapshot.pack.manifest_json = JSON.stringify(manifest);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /OWNED_STATIC_MISSING/);
  }, { verifyStaticResources: async () => { throw new Error('OWNED_STATIC_MISSING'); } });
  await fixture(async f => {
    const manifest = parse(f.snapshot.pack.manifest_json); manifest.visualAssets = {}; f.snapshot.pack.manifest_json = JSON.stringify(manifest);
    const stager = createRuntimeStager({ r2: f.r2, prefix: f.prefix, verifyStaticResources: async () => { await Promise.resolve(); f.revoke(); } });
    await assert.rejects(stager.stage(f.candidate, f.snapshot, f.current), /OWNED_AUTH_REVOKED/);
    assert.equal(f.puts.length, 5);
  });
  await fixture(async f => {
    let reads = 0;
    f.hooks.afterGet = (key, result) => { if (key.endsWith(`/chapters/${GAME}#c2.json`) && ++reads === 2) f.revoke(); return result; };
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current), /OWNED_AUTH_REVOKED/);
    assert.equal(f.puts.length, 5);
  });
  await fixture(async f => {
    let invoked = false;
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, async () => { invoked = true; }), /synchronous/); assert.equal(invoked, false);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot), /synchronous/);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, () => Promise.resolve()), /return undefined/);
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, () => false), /return undefined/);
    assert.equal(f.gets.length + f.puts.length, 0);
  });
  for (const fault of ['game', 'asset', 'chapter', 'release']) await fixture(async f => {
    if (fault === 'game') f.snapshot.pack.game_id = OTHER_GAME;
    if (fault === 'asset') f.snapshot.assets[0].bytes.fill(0);
    if (fault === 'chapter') {
      const manifest = parse(f.snapshot.pack.manifest_json); manifest.chapters[0] = OTHER_GAME + '#c1'; f.snapshot.pack.manifest_json = JSON.stringify(manifest); f.snapshot.chapters[0].chapter_id = manifest.chapters[0];
    }
    if (fault === 'release') f.candidate.releaseId = 'r0';
    await assert.rejects(f.stager.stage(f.candidate, f.snapshot, f.current)); assert.equal(f.gets.length + f.puts.length, 0);
  });
  await fixture(async f => {
    for (const prefix of ['../', 'kao/', 'test/a/../', 'test/a/b/']) assert.throws(() => createRuntimeStager({ r2: f.r2, prefix }), /trusted/);
    assert.throws(() => createRuntimeStager({ r2: { get() {} } }), /trusted/);
    assert.throws(() => createRuntimeStager({ r2: f.r2, verifyStaticResources: true }), /trusted/);
    const manifest = parse(f.snapshot.pack.manifest_json), pin = { gameId: GAME, ordinal: f.candidate.ordinal, revision: f.candidate.draftRevision, sourceDigest: f.candidate.sourceDigest, chapters: manifest.chapters };
    const expected = buildRuntimeIndex(pin, { game_id: GAME, release_id: f.candidate.releaseId, ordinal: pin.ordinal, draft_revision: pin.revision, source_digest: pin.sourceDigest }, f.snapshot.pack, f.snapshot.chapters, f.snapshot.assets);
    const result = await f.stager.stage(f.candidate, f.snapshot, f.current); assert.deepEqual(result.runtime.runtime, expected.reference);
    for (const file of expected.files) assert.deepEqual((await f.store.get(f.prefix + file.key)).bytes, file.bytes);
  });
  return checks;
}
