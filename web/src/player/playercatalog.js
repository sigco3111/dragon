// Public title presentation only. The reader owns validation; this view never
// admits a session, reads storage, navigates, or turns a missing row into deletion.
const BUILTIN = Object.freeze({ kind: 'builtin', gameId: 'wolong-builtin', name: '臥龍傳·制霸天下' });
export function mountPlayerCatalog({ root, reader, selectionVisible = true }) {
  if (typeof selectionVisible !== 'boolean' || !root?.ownerDocument || typeof root.append !== 'function' || typeof reader?.registry !== 'function')
    throw new TypeError('catalog root and validated player reader required');
  const document = root.ownerDocument;
  const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const host = make('section'), notice = make('button', '通知暫不可用'), select = make('select');
  const status = make('span'), retry = make('button', '重試');
  host.className = 'player-catalog'; notice.type = retry.type = 'button';
  notice.className = 'player-catalog-notice'; select.setAttribute('aria-label', '選擇遊戲');
  select.hidden = status.hidden = !selectionVisible;
  status.setAttribute('role', 'status'); retry.setAttribute('aria-label', '重新取得遊戲目錄及通知');
  Object.assign(host.style, { display: 'grid', gap: '6px', maxWidth: '100%' });
  Object.assign(notice.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  host.append(notice, select, status, retry); root.append(host);
  let closed = false, epoch = 0, wanted = BUILTIN.gameId, entries = new Map(), announcements = [];
  let announcementError = true, directoryError = false, pending = false, modal = null;
  function options() {
    select.replaceChildren();
    for (const entry of [BUILTIN, ...entries.values()]) {
      const option = make('option', entry.kind === 'builtin' ? entry.name : `${entry.name} ${entry.ordinal}`);
      option.value = entry.gameId; select.append(option);
    }
    select.value = entries.has(wanted) ? wanted : BUILTIN.gameId;
  }
  function paint() {
    let message = '暫無發布資訊';
    if (pending) message = '正在取得發布資訊…';
    else if (announcementError) message = '通知暫不可用';
    else if (announcements.length) message = `${announcements[0].name} ${announcements[0].ordinal}　${announcements[0].creatorAccount}`;
    notice.textContent = message;
    status.textContent = '';
    if (pending) status.textContent = '正在取得自建遊戲目錄；內置遊戲仍可選擇。';
    else if (directoryError) status.textContent = '自建遊戲目錄暫不可用；內置遊戲仍可選擇。';
    if (!modal) return;
    const content = modal.content;
    content.replaceChildren();
    if (pending || announcementError || !announcements.length) {
      content.append(make('p', message));
      return;
    }
    const table = make('table'), heading = make('tr');
    for (const label of ['遊戲', '版本', '創建者', '發布日期', '首次上線日期']) heading.append(make('th', label));
    table.append(heading);
    // Preserve the reader's server-ordered public history, not just five rows.
    for (const row of announcements) {
      const tr = make('tr');
      for (const key of ['name', 'ordinal', 'creatorAccount', 'publishedAt', 'firstOnlineAt']) tr.append(make('td', row[key]));
      table.append(tr);
    }
    content.append(table);
  }
  async function refresh() {
    if (closed) return false;
    const ticket = ++epoch;
    // Revalidation never leaves an old custom choice available as "latest".
    entries = new Map(); announcements = []; pending = true; options(); paint();
    try {
      const result = await reader.registry();
      if (closed || ticket !== epoch) return false;
      entries = new Map(result.directory.map(entry => [entry.gameId, Object.freeze({ ...entry, kind: 'formal' })]));
      announcements = result.announcements;
      announcementError = result.announcementsError !== null;
      directoryError = false;
    } catch {
      if (closed || ticket !== epoch) return false;
      entries = new Map(); announcements = []; announcementError = directoryError = true;
    }
    pending = false;
    if (!entries.has(wanted)) wanted = BUILTIN.gameId;
    options(); paint();
    return !directoryError;
  }
  function dismiss() {
    if (!modal) return;
    modal.node.remove(); modal = null;
    select.disabled = retry.disabled = notice.disabled = false;
    notice.focus();
  }
  function showAnnouncements() {
    if (closed || modal) return;
    const node = make('section'), content = make('div'), again = make('button', '重試');
    node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true'); node.setAttribute('aria-label', '發布資訊');
    node.tabIndex = -1; again.type = 'button';
    Object.assign(node.style, { position: 'fixed', inset: '8%', zIndex: '10001', background: '#f0d090', color: '#201800', padding: '16px', border: '4px solid #806020', display: 'flex', flexDirection: 'column', gap: '8px' });
    Object.assign(content.style, { overflow: 'auto', flex: '1', minHeight: '0' });
    node.append(make('h2', '發布資訊'), content, again, make('p', '右鍵返回'));
    node.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); dismiss(); });
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'wheel']) node.addEventListener(type, event => event.stopPropagation());
    node.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Tab') { event.preventDefault(); again.focus(); } });
    again.addEventListener('click', () => { void refresh(); });
    modal = { node, content }; host.append(node);
    select.disabled = retry.disabled = notice.disabled = true;
    node.focus(); void refresh();
  }
  select.addEventListener('change', () => { wanted = entries.has(select.value) ? select.value : BUILTIN.gameId; });
  retry.addEventListener('click', () => { void refresh(); });
  notice.addEventListener('click', showAnnouncements);
  options(); paint();
  return Object.freeze({ refresh, showAnnouncements,
    selection() { return closed || modal || !selectionVisible ? null : entries.get(select.value) ?? BUILTIN; },
    close() { if (closed) return; closed = true; epoch++; modal = null; host.remove(); entries.clear(); announcements = []; },
  });
}
