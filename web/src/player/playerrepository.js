// Fixed formal store -> shared App repository shape. Explicit opt-in only.
// Observed tokens authorize CAS overwrites, never an automatic reread/retry.
import { saveInput, saveJSON, checkSaveToken } from '../core/gamesavecodec.js';
import { emptySave, normalizeSaveSlots, nextSaveId, summarizeSave, assertSaveId } from '../core/savecatalog.js';
import { GameSaveConflictError } from '../core/gamesavestore.js';

export function createPlayerSaveRepository(options) {
  return createRepository(options);
}

// Capture a selected, fully preflighted archive before App installs it. Later
// local replacement cannot change this snapshot or refresh its CAS permission.
// This repository's load is deliberately single-use, not a disk refresh API.
export async function capturePlayerSaveRepository({ saves, assertCurrent, expectedToken }) {
  const token = checkSaveToken(expectedToken, saves?.identity?.gameId);
  if (token.savedReleaseId !== saves?.identity?.releaseId) throw new TypeError('restore release mismatch');
  const repository = createRepository({ saves, assertCurrent }, token);
  const captured = await repository.load();
  assertCurrent();
  let consumed = false;
  return Object.freeze({ ...repository, async load() {
    assertCurrent();
    if (consumed) throw new Error('Captured restore already consumed');
    consumed = true;
    return structuredClone(captured);
  } });
}

function createRepository({ saves, assertCurrent }, restoreToken = null) {
  if (typeof assertCurrent !== 'function' || !saves?.identity ||
      ['list', 'get', 'put'].some(key => typeof saves[key] !== 'function')) throw new TypeError('explicit formal save ports required');
  assertCurrent();
  const identity = Object.freeze({ ...saves.identity });
  let observed = null, queue = Promise.resolve();
  function enqueue(action) {
    const result = queue.then(() => { assertCurrent(); return action(); });
    queue = result.catch(() => {});
    return result;
  }
  function capture(snapshot) {
    return saveInput({ ...identity, slot: snapshot?.slot, snapshot }, identity.gameId).snapshot;
  }
  function matches(row) {
    return Object.entries(identity).every(([key, value]) => row[key] === value);
  }
  function agrees(row, token) {
    return token && row.gameId === token.gameId && row.slot === token.slot && row.recordId === token.recordId &&
      row.writeRevision === token.writeRevision && row.releaseId === token.savedReleaseId && row.bodyDigest === token.bodyDigest;
  }
  function expected(slot) {
    assertSaveId(slot);
    if (!observed || !observed.has(slot) || observed.get(slot).unavailable) throw new Error('save slot not admitted by this repository');
    return observed.get(slot);
  }
  async function readObserved(slot) {
    const entry = expected(slot);
    if (entry.token === null) return null;
    const value = await saves.get(slot); assertCurrent();
    if (!value || saveJSON(value.token) !== saveJSON(entry.token)) throw new GameSaveConflictError();
    return structuredClone(value.snapshot);
  }
  async function write(snapshot, token) {
    const receipt = await saves.put(snapshot, token);
    // No post-commit guard that would misreport a completed write as an abort.
    // The App must independently reject late UI installation after retirement.
    observed.set(receipt.snapshot.slot, { token: receipt.token, snapshot: structuredClone(receipt.snapshot) });
    return structuredClone(receipt.snapshot);
  }
  return Object.freeze({
    load() {
      return enqueue(async () => {
        const rows = await saves.list(); assertCurrent();
        const next = new Map(), slots = [];
        for (const row of rows) {
          assertSaveId(row.slot);
          if (next.has(row.slot)) throw new TypeError('duplicate formal save slot');
          if (!matches(row)) {
            // Not a recognized old release or a delete permission. Reserve the
            // occupied slot, but never pass this record to scenario restoration.
            next.set(row.slot, { unavailable: true });
            slots.push({ ...emptySave(row.slot), unavailable: true });
            continue;
          }
          const value = await saves.get(row.slot); assertCurrent();
          if (!value || !agrees(row, value.token)) throw new GameSaveConflictError();
          if (restoreToken?.slot === row.slot && saveJSON(value.token) !== saveJSON(restoreToken)) throw new GameSaveConflictError();
          next.set(row.slot, { token: value.token, snapshot: structuredClone(value.snapshot) });
          slots.push(structuredClone(value.snapshot));
        }
        if (restoreToken) {
          const selected = next.get(restoreToken.slot);
          if (!selected?.snapshot?.played || saveJSON(selected.token) !== saveJSON(restoreToken)) throw new GameSaveConflictError();
        }
        const result = normalizeSaveSlots({ slots });
        for (const slot of result.slots) if (!next.has(slot.slot)) next.set(slot.slot, { token: null });
        observed = next; // Install only after the complete observation succeeds.
        return result;
      });
    },
    list() {
      return enqueue(() => {
        if (!observed) throw new Error('load formal save observations first');
        return [...observed].sort(([a], [b]) => a - b).map(([slot, entry]) => ({
          ...summarizeSave(entry.snapshot ?? emptySave(slot)), ...(entry.unavailable ? { unavailable: true } : {}),
        }));
      });
    },
    get(slot) { return enqueue(() => readObserved(slot)); },
    put(snapshot) {
      let input;
      try { assertCurrent(); input = capture(snapshot); } catch (error) { return Promise.reject(error); }
      return enqueue(() => write(input, expected(input.slot).token));
    },
    add(snapshot) {
      let input;
      try { assertCurrent(); input = capture(snapshot); } catch (error) { return Promise.reject(error); }
      return enqueue(() => {
        if (!observed) throw new Error('load formal save observations first');
        // Includes unavailable records and the four presentation placeholders.
        // A concurrent insertion is a conflict, not permission to overwrite it.
        const slot = nextSaveId([...observed.keys()].map(slot => ({ slot })));
        return write({ ...input, slot }, null);
      });
    },
  });
}
