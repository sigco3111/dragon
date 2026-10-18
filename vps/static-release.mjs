// Static package inventory, NOT a dependency-closure or remote-visibility proof.
// The expected digest must come from a trusted build, never from the response
// being checked. Source-tree equality is deliberately broader than the active
// engine import graph; it does not certify compiler/runtime compatibility.
import { createHash } from 'node:crypto';
import { STATIC_RELEASE_MAX_BYTES, staticReleaseFiles, staticSourceBytes, staticManifest, parseStaticReleaseShape } from '../reader/staticreleaseformat.js';
export { STATIC_RELEASE_FILE, STATIC_RELEASE_MAX_BYTES } from '../reader/staticreleaseformat.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function fail() { throw new Error('STATIC_RELEASE_INVALID'); }

/** Input is metadata of the copied bytes, not source-file stat guesses. */
export function buildStaticRelease(entries) {
  const files = staticReleaseFiles(entries);
  // Includes every shipped src/**/*.js, not just the Trial's current imports.
  const manifest = staticManifest(files, sha(staticSourceBytes(files)));
  const bytes = Buffer.from(JSON.stringify(manifest));
  if (bytes.length > STATIC_RELEASE_MAX_BYTES) fail();
  return Object.freeze({ manifest, bytes, sha256: sha(bytes) });
}

/** A canonical inventory with a caller-pinned digest. Does not GET any asset. */
export function parseStaticRelease(input, expectedDigest) {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 ||
      input.byteLength > STATIC_RELEASE_MAX_BYTES || !digest(expectedDigest)) fail();
  const bytes = Buffer.from(input);
  if (sha(bytes) !== expectedDigest) fail();
  const manifest = parseStaticReleaseShape(bytes);
  if (sha(staticSourceBytes(manifest.files)) !== manifest.sourceTreeDigest) fail();
  return manifest;
}
