// Owned transport fixtures only. Not compiled game data or engine certificates.
import { createHash } from 'node:crypto';
import { buildRuntimeIndex } from '../../vps/runtime-index.mjs';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const GAME = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
export const OTHER_GAME = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
export const PORTRAIT = Buffer.from('owned opaque portrait fixture');
export const TEMPLATE_PORTRAIT = Buffer.from('owned opaque p-prefixed portrait fixture');
export function publication(version = 0, gameId = GAME, chapterIds = ['c1', 'c2'], releaseId = `r${version}`) {
  const revision = String(version + 1), ordinal = `1.${version}`, sourceDigest = sha(`owned-source-${gameId}-${version}`);
  const pin = { gameId, name: '自有測試', ordinal, revision, sourceDigest, publishedAt: '2026-10-16T00:00:00.000Z', chapters: [...chapterIds] };
  const release = { game_id: gameId, release_id: releaseId, ordinal, draft_revision: revision, source_digest: sourceDigest, created_at: pin.publishedAt };
  const bytes = Buffer.from(`owned-terrain-${gameId}-${version}`);
  const asset = { asset_id: 'terrain', sha256: sha(bytes), byte_length: bytes.length, bytes };
  const manifest = { schemaVersion: 1, buildFormat: 'studio-app-2', identity: { gameId, draftRevision: revision, sourceDigest }, chapters: pin.chapters, assets: [{ assetId: 'terrain', sha256: asset.sha256, byteLength: bytes.length, url: `/api/trial-asset?game=${gameId}&revision=${revision}&digest=${sourceDigest}&asset=terrain` }], minimapAssets: [], portraits: [['0', PORTRAIT], ['p0001', TEMPLATE_PORTRAIT]].map(([assetId, portrait]) => ({ assetId, role: 'game-portrait', url: `kao/${assetId}.png`, sha256: sha(portrait), byteLength: portrait.length, mime: 'image/png' })) };
  const pack = { revision, source_digest: sourceDigest, manifest_json: JSON.stringify(manifest) };
  const chapters = pin.chapters.map(chapter_id => ({ chapter_id, state_json: JSON.stringify({ fixture: `${version}:${chapter_id}` }) }));
  const built = buildRuntimeIndex(pin, release, pack, chapters, [asset]);
  return { runtimeVersion: 1, files: built.files, dependencies: built.dependencies, directory: [{ ...pin, releaseId }], releases: [{ ...release, runtime: built.reference }], gameStates: [{ gameId, listed: true }], announcements: [{ gameId, ordinal, name: pin.name, creatorAccount: 'fixture-author', publishedAt: pin.publishedAt, firstOnlineAt: pin.publishedAt }], gameIds: [gameId] };
}
export function unlisted(deleted = false, current = null) {
  return { runtimeVersion: 1, files: [], dependencies: [], directory: [], releases: [], gameStates: [{ gameId: GAME, listed: false, ...(deleted ? { deleted: true } : {}), ...(!deleted && current ? { currentRelease: { releaseId: current.releaseId, ordinal: current.ordinal } } : {}) }], announcements: [], gameIds: [] };
}
