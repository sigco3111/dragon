// Process-local scheduling only. The publisher/ledger retain all durable authority.
// Never regenerate payloads, acknowledge operations, unblock recovery or delete data.
import { setTimeout, clearTimeout } from 'node:timers';
const systemTimers = Object.freeze({ setTimeout, clearTimeout });
const outcomes = new Set(['IDLE', 'VISIBLE_CONFIRMED', 'COMMITTED_SYNC_PENDING']);
const recoveryReasons = new Set(['REMOTE_AHEAD', 'AUTHORITY_MISMATCH', 'REMOTE_GAP', 'LEGACY_PENDING']);
export function createDistributionDrainer({ publisher, intervalMs, timers = systemTimers }) {
  if (typeof publisher?.drainOne !== 'function' || typeof publisher?.ledger?.status !== 'function' ||
      !Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647 ||
      typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function') {
    throw new TypeError('publisher, explicit timer interval and trusted timer ports required');
  }
  let state = 'created', lastResult = null, blockedReason = null, attempts = 0;
  let timer = null, active = Promise.resolve(), stopping = false, stopped;
  function inspect() {
    try {
      const value = publisher.ledger.status();
      if (!value || value.blockedReason !== null && !recoveryReasons.has(value.blockedReason)) throw new TypeError('ledger status');
      blockedReason = value.blockedReason;
      if (blockedReason !== null) { state = 'blocked'; lastResult = 'RECOVERY_REQUIRED'; return false; }
      return true;
    } catch { state = 'faulted'; lastResult = 'STATUS_UNAVAILABLE'; return false; }
  }
  function schedule(delay) {
    state = 'scheduled';
    try {
      timer = timers.setTimeout(() => {
        timer = null;
        if (stopping) return;
        state = 'running';
        active = tick().catch(() => { state = 'faulted'; lastResult = 'LOOP_FAILURE'; });
      }, delay);
      return true;
    } catch { state = 'faulted'; lastResult = 'SCHEDULER_UNAVAILABLE'; return false; }
  }
  async function tick() {
    if (!inspect()) return;
    attempts++;
    let outcome;
    try { outcome = (await publisher.drainOne())?.state; }
    catch { outcome = 'RETRYABLE_ERROR'; }
    // A recovery lock or unreadable authority stops scheduling, even if the
    // transport returned pending or threw an apparently transient exception.
    if (!inspect()) return;
    if (!outcomes.has(outcome) && outcome !== 'RETRYABLE_ERROR') {
      state = 'faulted'; lastResult = 'INVALID_RESULT'; return;
    }
    lastResult = outcome;
    if (!stopping) schedule(outcome === 'VISIBLE_CONFIRMED' ? 0 : intervalMs);
  }
  return Object.freeze({
    start() {
      if (state !== 'created' || stopping) return false;
      return schedule(0);
    },
    status() { return Object.freeze({ state, lastResult, blockedReason, attempts }); },
    stop() {
      if (stopped) return stopped;
      stopping = true;
      if (timer !== null) { timers.clearTimeout(timer); timer = null; }
      state = 'stopping';
      // Do not cancel a possibly committed remote write, close its SQLite port,
      // or report stopped before its observation/ack attempt has settled.
      stopped = active.then(() => { state = 'stopped'; });
      return stopped;
    },
  });
}
