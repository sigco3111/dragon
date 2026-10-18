// Fixed admitted environment -> existing opt-in game save store. No implicit
// IndexedDB, migration, latest-version inference, deletion permission or App UI.
import { validateIdentity, isChapterId, isDigest } from './runtimecontract.js';
import { saveInput, checkSaveToken, saveReleaseOrdinalFromVersion } from '../core/gamesavecodec.js';
import { encodeSaveFile } from '../core/saveexchange.js';
import { readSavedAssembly, assertAssemblyIdentity } from '../game/scenarioassembly.js';

export function createPlayerSaveStore({ environment, store }) {
  if (typeof environment?.assertCurrent !== 'function' || typeof store?.get !== 'function' ||
      typeof store?.list !== 'function' || typeof store?.put !== 'function') throw new TypeError('explicit formal environment and game store required');
  const current = environment.assertCurrent.bind(environment), source = environment.identity;
  current(); validateIdentity(source);
  if (store.gameId !== source.gameId || !isChapterId(source.chapterId, source.gameId) || !isDigest(source.manifestDigest)) throw new TypeError('save game/chapter/manifest mismatch');
  const identity = Object.freeze({ gameId: source.gameId, releaseId: source.releaseId,
    releaseOrdinal: saveReleaseOrdinalFromVersion(source.ordinal), chapterId: source.chapterId, manifestDigest: source.manifestDigest });
  const context = Object.freeze({ content: environment.content, data: environment.content?.data, world: environment.world });
  const reference = context.content?.chapter(0)?.reference;
  if (reference?.packId !== identity.gameId || reference.chapterId !== identity.chapterId || reference.revision !== source.sourceDigest ||
      reference.publication?.releaseId !== identity.releaseId || reference.publication.ordinal !== source.ordinal) throw new TypeError('formal save environment identity mismatch');
  function capture(snapshot) {
    const input = saveInput({ ...identity, slot: snapshot?.slot, snapshot }, identity.gameId);
    if (input.snapshot.played !== true || input.snapshot.scenario_idx !== 0) throw new TypeError('played fixed-chapter snapshot required');
    const metadata = readSavedAssembly(input.snapshot).metadata;
    assertAssemblyIdentity(metadata, 0, context.content, context.world);
    return input;
  }
  async function validate(input) {
    current();
    // Same JSON/RNG/rule/capability and detached restore preflight as backups.
    // This does not install a live Scenario or change the caller's rule RNG.
    await encodeSaveFile(input.snapshot, context);
    current();
  }
  return Object.freeze({ identity,
    async list() {
      current(); const rows = await store.list(); current();
      // Summaries are not loadability, recognized old-release or delete proofs.
      return Object.freeze(structuredClone(rows).map(row => Object.freeze(row)));
    },
    async get(slot) {
      current(); const saved = await store.get(slot); current();
      if (saved === null) return null;
      for (const [key, value] of Object.entries(identity)) if (saved.record[key] !== value) throw new TypeError('formal save identity mismatch');
      const input = capture(saved.record.snapshot);
      if (input.slot !== slot || saved.record.slot !== slot) throw new TypeError('formal save slot mismatch');
      await validate(input);
      return Object.freeze({ snapshot: input.snapshot, token: saved.token });
    },
    async put(snapshot, expected = null) {
      current(); const input = capture(snapshot);
      const token = expected === null ? null : checkSaveToken(expected, identity.gameId);
      if (token && token.slot !== input.slot) throw new TypeError('formal save token slot mismatch');
      await validate(input);
      const saved = await store.put(input, token);
      // Once dispatched, the local transaction may commit even if the session
      // retires. Return its commit receipt, never claim the old record survived.
      // The owner must reject late live installation; this adapter installs none.
      return Object.freeze({ committed: true, snapshot: saved.record.snapshot, token: saved.token });
    },
  });
}
