// Current-release chapter presentation only. Preview tickets are closed, never
// retained for gameplay; choosing a row requires a new server admission.
import { PlayerReaderError } from './playerclient.js';
import { MAX_RESOURCE_BYTES, isChapterId, isDigest, parseJSON, sha256, validateIdentity } from './runtimecontract.js';
const fields = ['gameId', 'releaseId', 'ordinal', 'revision', 'sourceDigest', 'name', 'publishedAt'];
const fail = code => { throw new PlayerReaderError(code); };
function capture(value) {
  validateIdentity(value);
  if (typeof value.name !== 'string' || typeof value.publishedAt !== 'string' ||
      !Array.isArray(value.chapters) || !value.chapters.length ||
      !value.chapters.every(id => isChapterId(id, value.gameId)) || new Set(value.chapters).size !== value.chapters.length ||
      (value.manifestDigest !== undefined && !isDigest(value.manifestDigest))) throw new TypeError('current release selection required');
  return Object.freeze({ ...Object.fromEntries(fields.map(key => [key, value[key]])),
    chapters: Object.freeze([...value.chapters]), ...(value.manifestDigest === undefined ? {} : { manifestDigest: value.manifestDigest }) });
}
function same(expected, actual) {
  const observed = capture(actual);
  if (!fields.every(key => observed[key] === expected[key]) ||
      observed.chapters.length !== expected.chapters.length ||
      !observed.chapters.every((id, index) => id === expected.chapters[index]) ||
      (expected.manifestDigest !== undefined && observed.manifestDigest !== expected.manifestDigest)) fail('PLAYER_SELECTION_CHANGED');
}
function ports(reader, assertCurrent) {
  if (typeof reader?.admit !== 'function' || typeof assertCurrent !== 'function') throw new TypeError('reader and selection ownership guard required');
}
export async function admitPlayerChapter({ reader, selection, chapterId, assertCurrent = () => {} }) {
  ports(reader, assertCurrent);
  const expected = capture(selection);
  if (!expected.chapters.includes(chapterId)) throw new TypeError('selected chapter required');
  assertCurrent();
  const session = await reader.admit({ gameId: expected.gameId, ordinal: expected.ordinal, chapterId });
  try {
    assertCurrent();
    if (typeof session?.read !== 'function' || typeof session.close !== 'function' || typeof session.state !== 'function' ||
        session.state() !== 'active' || session.identity?.chapterId !== chapterId || !isDigest(session.identity?.manifestDigest)) fail('PLAYER_CHAPTER_PREVIEW_INVALID');
    same(expected, session.identity);
    assertCurrent();
    return session;
  } catch (error) { session?.close?.(); throw error; }
}
export async function loadPlayerChapters({ reader, selection, assertCurrent = () => {} }) {
  ports(reader, assertCurrent);
  if (typeof reader.status !== 'function') throw new TypeError('current status reader required');
  const expected = capture(selection), rows = [];
  let pinned = expected;
  for (const chapterId of expected.chapters) {
    const session = await admitPlayerChapter({ reader, selection: pinned, chapterId, assertCurrent });
    try {
      if (pinned.manifestDigest === undefined) pinned = capture({ ...expected, manifestDigest: session.identity.manifestDigest });
      const reply = await session.read('chapter:' + chapterId);
      assertCurrent();
      if (session.state() !== 'active' || reply?.contentType !== 'application/json' ||
          !(reply.bytes instanceof Uint8Array) || reply.bytes.length === 0 || reply.bytes.length > MAX_RESOURCE_BYTES || !isDigest(reply.sha256)) fail('PLAYER_CHAPTER_PREVIEW_INVALID');
      const bytes = new Uint8Array(reply.bytes);
      if (await sha256(bytes) !== reply.sha256) fail('PLAYER_CHAPTER_PREVIEW_INVALID');
      assertCurrent();
      if (session.state() !== 'active') fail('PLAYER_CHAPTER_PREVIEW_INVALID');
      let chapter;
      try { chapter = parseJSON(bytes); } catch { fail('PLAYER_CHAPTER_PREVIEW_INVALID'); }
      if (typeof chapter?.name !== 'string' || !chapter.name.length ||
          !['year', 'month', 'day'].every(key => Number.isSafeInteger(chapter.start?.[key]))) fail('PLAYER_CHAPTER_PREVIEW_INVALID');
      // Display fields only: no faction choice, rule initialization or playable
      // certification. The selected pack still passes the shared engine gates.
      rows.push(Object.freeze({ chapterId, name: chapter.name,
        start: Object.freeze({ year: chapter.start.year, month: chapter.start.month, day: chapter.start.day }) }));
    } finally { session.close(); }
  }
  assertCurrent();
  const current = await reader.status(expected.gameId);
  assertCurrent();
  if (current?.listed !== true) fail('PLAYER_SELECTION_CHANGED');
  // Public status has no manifestDigest. It checks the release again, while the
  // captured admission digest binds all preview rows and the final admission.
  same({ ...expected, manifestDigest: undefined }, current);
  return Object.freeze({ selection: pinned, chapters: Object.freeze(rows) });
}
