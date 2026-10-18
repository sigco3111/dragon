// Private frozen authority metadata, NOT a player projection or runtime source.
// Exact schema; derived public data never includes hidden names or accounts.
import { isGameId, isOrdinal, isChapterId, validateRuntimeReference, MAX_METADATA_BYTES } from '../reader/runtimecontract.js';
import { validateFirstOnlineReference } from '../reader/firstonline.js';
const check = value => { if (!value) throw new Error('DISTRIBUTION_CATALOG'); };
function fields(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
function iso(value) { check(typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value); }
export function validatePublicationCatalog(catalog, context) {
  check(isGameId(context?.authorityId) && Number.isSafeInteger(context.generation) && context.generation > 0);
  fields(catalog, ['version', 'games']); check(catalog.version === 1 && Array.isArray(catalog.games));
  const ids = new Set();
  for (const game of catalog.games) {
    fields(game, ['gameId', 'listed', 'deleted', 'current', 'announcements']);
    check(isGameId(game.gameId) && !ids.has(game.gameId)); ids.add(game.gameId);
    check(typeof game.listed === 'boolean' && typeof game.deleted === 'boolean' && !(game.listed && game.deleted) && Array.isArray(game.announcements));
    const current = game.current;
    if (current === null) check(!game.listed && game.announcements.length === 0);
    else {
      check(!game.deleted);
      fields(current, ['gameId', 'releaseId', 'ordinal', 'revision', 'sourceDigest', 'chapters', 'runtime', 'name', 'publishedAt', 'createdAt']);
      fields(current.runtime, ['key', 'sha256', 'byteLength']);
      validateRuntimeReference(current, current.runtime);
      check(current.gameId === game.gameId && isGameId(current.releaseId) && typeof current.name === 'string');
      iso(current.publishedAt); iso(current.createdAt);
      check(Array.isArray(current.chapters) && current.chapters.length > 0 && current.chapters.every(id => isChapterId(id, game.gameId)) && new Set(current.chapters).size === current.chapters.length);
    }
    const ordinals = new Set(), releases = new Set();
    for (const row of game.announcements) {
      fields(row, ['releaseId', 'ordinal', 'name', 'creatorAccount', 'publishedAt', 'firstOnline']);
      check(current && isGameId(row.releaseId) && isOrdinal(row.ordinal) && BigInt(row.ordinal.slice(2)) <= BigInt(current.ordinal.slice(2)) && !ordinals.has(row.ordinal) && !releases.has(row.releaseId));
      ordinals.add(row.ordinal); releases.add(row.releaseId);
      check(typeof row.name === 'string' && typeof row.creatorAccount === 'string'); iso(row.publishedAt);
      validateFirstOnlineReference(row.firstOnline, context);
      if (row.ordinal === current.ordinal) check(row.releaseId === current.releaseId);
      else check(row.firstOnline.generation < context.generation);
      // Only a currently visible publication can create a new announcement.
      if (row.firstOnline.generation === context.generation) check(game.listed && row.ordinal === current.ordinal);
    }
    if (game.listed) check(ordinals.has(current.ordinal));
  }
  return catalog;
}
export function projectPublicationCatalog(catalog, context) {
  validatePublicationCatalog(catalog, context);
  const directory = [], releases = [], gameStates = [], announcements = [];
  // Stable ordering, without changing chapter order or announcement snapshots.
  const games = [...catalog.games].sort((a, b) => { if (a.gameId < b.gameId) return -1; if (a.gameId > b.gameId) return 1; return 0; });
  for (const game of games) {
    gameStates.push({ gameId: game.gameId, listed: game.listed, ...(game.deleted ? { deleted: true } : {}),
      ...(game.current ? { currentRelease: { releaseId: game.current.releaseId, ordinal: game.current.ordinal } } : {}) });
    if (!game.listed) continue;
    const c = game.current;
    directory.push({ gameId: c.gameId, releaseId: c.releaseId, ordinal: c.ordinal, revision: c.revision, sourceDigest: c.sourceDigest, name: c.name, publishedAt: c.publishedAt, chapters: [...c.chapters] });
    releases.push({ game_id: c.gameId, release_id: c.releaseId, ordinal: c.ordinal, draft_revision: c.revision, source_digest: c.sourceDigest, created_at: c.createdAt, runtime: { ...c.runtime } });
    for (const row of game.announcements) announcements.push({ gameId: game.gameId, ordinal: row.ordinal, name: row.name, creatorAccount: row.creatorAccount, publishedAt: row.publishedAt, firstOnline: { ...row.firstOnline } });
  }
  const projection = { runtimeVersion: 2, directory, releases, gameStates, announcements };
  check(new TextEncoder().encode(JSON.stringify(projection)).byteLength <= MAX_METADATA_BYTES);
  return projection;
}
