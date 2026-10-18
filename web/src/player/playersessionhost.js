// Formal-session presentation/lifetime owner, not a rule clock or Trial gate.
// Navigation is an explicit host port; no storage or automatic re-admission.
import { validateIdentity, isChapterId, isDigest } from './runtimecontract.js';
export function createPlayerSessionHost({ session, pack, root, navigate }) {
  if (typeof session?.status !== 'function' || typeof session?.state !== 'function' ||
      typeof session?.close !== 'function' || typeof pack?.close !== 'function' ||
      !root?.ownerDocument || typeof root.append !== 'function' || typeof navigate !== 'function')
    throw new TypeError('formal session, owned pack, DOM root and navigation port required');
  validateIdentity(session.identity); validateIdentity(pack.identity);
  const { gameId, releaseId, ordinal, chapterId, manifestDigest } = session.identity;
  if (!isChapterId(chapterId, gameId) || !isDigest(manifestDigest) ||
      ['gameId', 'releaseId', 'ordinal', 'revision', 'sourceDigest', 'chapterId', 'manifestDigest'].some(key => pack.identity[key] !== session.identity[key]))
    throw new TypeError('matching fixed formal identities required');
  const document = root.ownerDocument, host = document.createElement('section');
  const warning = document.createElement('p');
  warning.setAttribute('role', 'status'); warning.hidden = true;
  Object.assign(warning.style, { position: 'fixed', top: '8px', left: '8px', right: '8px', zIndex: '10002', background: '#f0d090', color: '#201800', padding: '8px', pointerEvents: 'none' });
  host.className = 'player-session-host'; host.append(warning); root.append(host);
  let retired = false, updated = false, pending = null, exit = null, disposed = false;
  function dispose() {
    // Session retirement is irreversible even if an owned URL release fails.
    session.close(); pack.close(); disposed = true;
  }
  async function checkStatus() {
    if (retired) return Object.freeze({ kind: 'retired' });
    if (pending) return pending;
    const work = (async () => {
      try {
        const latest = await session.status();
        if (retired) return Object.freeze({ kind: 'retired' });
        if (latest.gameId !== gameId || typeof latest.listed !== 'boolean') throw new TypeError('status game mismatch');
        if (!latest.listed) return Object.freeze({ kind: 'unlisted', updated });
        if (!/^1\.(0|[1-9][0-9]*)$/.test(latest.ordinal ?? '')) throw new TypeError('status ordinal missing');
        validateIdentity(latest);
        const newer = BigInt(latest.ordinal.slice(2)) > BigInt(ordinal.slice(2));
        if (newer && latest.releaseId !== releaseId) {
          updated = true; warning.hidden = false;
          warning.textContent = '當前對局仍為舊版本，保存後將無法在新版讀取。';
          return Object.freeze({ kind: 'updated' });
        }
        if (latest.releaseId !== releaseId || latest.ordinal !== ordinal) throw new TypeError('status identity conflict');
        return Object.freeze({ kind: 'current', updated });
      } catch {
        if (retired) return Object.freeze({ kind: 'retired' });
        // Only the actual reader's terminal state proves deletion. A network
        // failure, missing resource or arbitrary status/error string does not.
        return Object.freeze({ kind: session.state() === 'deleted' ? 'deleted' : 'unavailable' });
      }
    })();
    pending = work;
    try { return await work; } finally { if (pending === work) pending = null; }
  }
  function onExit({ reason, initialAction } = {}) {
    if (exit) return exit;
    retired = true;
    const deleted = session.state() === 'deleted';
    let exitReason = 'unavailable';
    if (deleted) exitReason = 'deleted';
    else if (reason === 'title') exitReason = 'title';
    const result = Object.freeze({ reason: exitReason, initialAction, gameId });
    // Construct the promise before any caller-controlled resource/navigation
    // callback so re-entrant or repeated App exits always share one operation.
    let resolveExit;
    exit = new Promise(resolve => { resolveExit = resolve; });
    const dialog = document.createElement('section'), message = document.createElement('p');
    const confirm = document.createElement('button'), failure = document.createElement('p');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', '遊戲結束');
    message.textContent = deleted ? '遊戲已刪除。確認後返回初始載入頁面，本機存檔保留。' : '遊戲無法繼續。確認後返回初始載入頁面，本機存檔保留。';
    confirm.type = 'button'; confirm.textContent = '確認'; failure.setAttribute('role', 'status');
    Object.assign(dialog.style, { position: 'fixed', inset: '25% 15%', zIndex: '10003', background: '#f0d090', color: '#201800', border: '4px solid #806020', padding: '24px' });
    dialog.append(message, confirm, failure);
    let navigating = false;
    async function finish() {
      if (navigating) return;
      navigating = true; confirm.disabled = true;
      try {
        if (!disposed) dispose();
        await navigate(result);
        host.remove(); resolveExit(result);
      } catch {
        failure.textContent = '無法返回載入頁面，請重試。';
        navigating = false; confirm.disabled = false;
        if (!dialog.isConnected) host.append(dialog);
        confirm.focus();
      }
    }
    // Native button keyboard activation is a confirmation as well; right click
    // never confirms, closes, or resumes the retired game.
    confirm.addEventListener('click', event => { if (event.button === 0) void finish(); });
    dialog.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'wheel']) dialog.addEventListener(type, event => event.stopPropagation());
    dialog.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Tab') { event.preventDefault(); confirm.focus(); } });
    try { dispose(); } catch { /* Retry resource disposal on explicit confirmation. */ }
    warning.hidden = true;
    if (result.reason === 'title') void finish();
    else { host.append(dialog); confirm.focus(); }
    return exit;
  }
  return Object.freeze({ checkStatus, onExit, warning: () => updated });
}
