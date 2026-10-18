// Test host only. Real reader admission, pack, engine and native IDB; no DTO or
// API response substitution. Real session host; navigation is a recording port.
import { startApp } from '/src/main.js';
import { createPlayerReader } from '/src/player/playerclient.js';
import { mountPlayerRestore } from '/src/player/playerrestore.js';
import { mountPlayerNewGame } from '/src/player/playernewgame.js';
import { createPlayerSessionHost } from '/src/player/playersessionhost.js';
import { createPlayerStaticReader } from '/src/player/playerstatic.js';
import { createPlayerEnvironment } from '/src/player/playerenvironment.js';
import { createPlayerSaveStore } from '/src/player/playersaves.js';
import { createPlayerSaveRepository } from '/src/player/playerrepository.js';
import { createGameSaveStore } from '/src/core/gamesavestore.js';
import { TRIAL_COMPILER_REVISION } from '/src/content/authoring/trialcompile.js';
import { sha256 } from '/src/player/runtimecontract.js';
import { snapshotScenarioAssembly } from '/src/game/scenarioassembly.js';
const control = window.__ownedPublishedApp = { traces: [], exits: [], staticReads: [], statusChecks: [], ready: false };
control.start = async ({ gameId, restore, sequenceBase }) => {
  const transport = async (url, options) => {
    const trace = { sequence: String(sequenceBase + control.traces.length + 1), completed: false, cancelled: false, bytes: 0, status: null };
    control.traces.push(trace);
    const response = await fetch(url, { ...options, headers: { ...options.headers, 'X-Owned-Client-Request': trace.sequence } });
    trace.status = response.status;
    const body = response.body, getReader = body.getReader.bind(body);
    Object.defineProperty(body, 'getReader', { value() {
      const reader = getReader();
      return {
        async read() { const row = await reader.read(); if (row.done) trace.completed = true; else trace.bytes += row.value.byteLength; return row; },
        cancel() { trace.cancelled = true; return reader.cancel(); },
        releaseLock() { return reader.releaseLock(); },
      };
    } });
    return response;
  };
  const reader = createPlayerReader({ origin: location.origin, fetch: transport });
  const selection = (await reader.registry()).directory.find(entry => entry.gameId === gameId);
  const readStatic = createPlayerStaticReader({ origin: location.origin });
  const policy = { compilerRevision: TRIAL_COMPILER_REVISION, maxTotalBytes: 256 * 1024 * 1024,
    async readStatic(path, options) {
      const result = await readStatic(path, options);
      control.staticReads.push({ path, bytes: result.bytes.length, digest: result.sha256 });
      return result;
    },
  };
  const store = createGameSaveStore({ gameId, databaseName: 'owned-published-app', getIndexedDB: () => indexedDB });
  let preview, session, pack, playerFaction, environment, repository, savedSlot = null;
  if (restore) {
    const chooser = mountPlayerRestore({ root: document.body, reader, selection, store, ...policy });
    const chosen = await chooser.result;
    if (!chosen) throw new Error('owned restore choice cancelled');
    ({ session, pack, environment, savedSlot } = chosen); repository = chosen.saveRepository; preview = { chapters: chosen.chapters };
  } else {
    const chooser = mountPlayerNewGame({ root: document.body, reader, selection, ...policy });
    const chosen = await chooser.result;
    if (!chosen) throw new Error('owned new-game choice cancelled');
    ({ session, pack, playerFaction } = chosen); preview = { chapters: chosen.chapters };
  }
  if (!restore) {
    environment = createPlayerEnvironment(pack, { playerFaction });
    const saves = createPlayerSaveStore({ environment, store });
    repository = createPlayerSaveRepository({ saves, assertCurrent: pack.assertCurrent });
  }
  const host = createPlayerSessionHost({ session, pack, root: document.body,
    navigate({ reason, initialAction }) { control.exits.push({ reason, initialAction }); },
  });
  Object.assign(control, { session, pack, environment, store, repository, host });
  await startApp(null, { formal: { environment, saveRepository: repository, savedSlot,
    onExit: host.onExit,
    async checkStatus() { const result = await host.checkStatus(); control.statusChecks.push(result); return result; },
  } });
  window.__app.gamebar._clockHoldRequested = true; window.__app.gamebar.syncClock();
  control.ready = true;
  return { chapterPreviews: preview.chapters, identity: pack.identity, resources: Object.keys(pack.resourceURLs).length, staticReads: control.staticReads,
    metadata: snapshotScenarioAssembly(window.__app), cities: window.__app.scenario.cities.length,
    trial: window.__app.trialIdentity ?? null, slot: window.__app.loadedSaveSlot, databases: window.__ownedDatabases,
    chapterDigest: await sha256(new TextEncoder().encode(JSON.stringify(pack.chapter))) };
};
