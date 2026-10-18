// Pure metadata/byte contract. No network, filesystem, game or deployment proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildStaticRelease, parseStaticRelease, STATIC_RELEASE_MAX_BYTES } from '../vps/static-release.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entry = (path, text = path) => ({ path, byteLength: Buffer.byteLength(text), sha256: sha(text) });
const rows = [entry('src/main.js', 'const title="臥龍傳";\r\n'), entry('_headers'), entry('grf/music/loops/spring.flac'), entry('src/game/clock.js')];
let checks = 0;
function check(fn) { fn(); checks++; }
const good = buildStaticRelease(rows);
check(() => {
  const parsed = parseStaticRelease(good.bytes, good.sha256);
  assert.deepEqual(parsed, good.manifest);
  assert.equal(good.sha256, sha(good.bytes));
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.files), true);
  assert.ok(parsed.files.every(Object.isFrozen));
  assert.equal(parsed.files.find(file => file.path === '_headers').kind, 'configuration');
});
check(() => assert.deepEqual(buildStaticRelease(rows.toReversed()).bytes, good.bytes));
check(() => {
  const copy = structuredClone(rows), built = buildStaticRelease(copy);
  copy[0].path = 'changed'; copy[0].sha256 = '0'.repeat(64);
  assert.deepEqual(built.bytes, good.bytes);
});
check(() => {
  const imageChanged = rows.map(row => row.path.endsWith('.flac') ? entry(row.path, 'new music') : row);
  const changed = buildStaticRelease(imageChanged);
  assert.notEqual(changed.sha256, good.sha256);
  assert.equal(changed.manifest.sourceTreeDigest, good.manifest.sourceTreeDigest);
  const codeChanged = rows.map(row => row.path.endsWith('clock.js') ? entry(row.path, 'new code') : row);
  assert.notEqual(buildStaticRelease(codeChanged).manifest.sourceTreeDigest, good.manifest.sourceTreeDigest);
});
check(() => {
  const lf = rows.map(row => row.path === 'src/main.js' ? entry(row.path, 'const title="臥龍傳";\n') : row);
  assert.notEqual(buildStaticRelease(lf).sha256, good.sha256, 'no checkout or text normalization');
});
check(() => {
  const empty = buildStaticRelease([entry('empty.bin', '')]);
  assert.equal(parseStaticRelease(empty.bytes, empty.sha256).files[0].byteLength, 0);
});
for (const path of ['../secret', '/absolute', 'x\\y', 'x//y', 'x/./y', 'x/../y', 'x/.env', 'x/', 'x?y', 'x#y', 'x%2fy', 'static-release.json', 'STATIC-RELEASE.JSON', 'x'.repeat(513)]) {
  check(() => assert.throws(() => buildStaticRelease([entry(path)]), /STATIC_RELEASE_INVALID/));
}
check(() => assert.throws(() => buildStaticRelease([entry('src/A.js'), entry('src/a.js')]), /STATIC_RELEASE_INVALID/));
for (const patch of [{ byteLength: -1 }, { byteLength: 1.5 }, { byteLength: 25 * 1024 * 1024 + 1 }, { sha256: 'A'.repeat(64) }, { extra: true }]) {
  check(() => assert.throws(() => buildStaticRelease([{ ...rows[0], ...patch }]), /STATIC_RELEASE_INVALID/));
}
check(() => assert.throws(() => buildStaticRelease([]), /STATIC_RELEASE_INVALID/));
check(() => assert.throws(() => buildStaticRelease(Array(20001).fill(rows[0])), /STATIC_RELEASE_INVALID/));
check(() => {
  const many = Array.from({ length: 5000 }, (_, i) => entry(`data/${String(i).padStart(5, '0')}/${'x'.repeat(400)}`));
  assert.throws(() => buildStaticRelease(many), /STATIC_RELEASE_INVALID/);
});
check(() => assert.throws(() => parseStaticRelease(good.bytes, '0'.repeat(64)), /STATIC_RELEASE_INVALID/));
check(() => assert.throws(() => parseStaticRelease(good.bytes, undefined), /STATIC_RELEASE_INVALID/));
check(() => assert.throws(() => parseStaticRelease(Buffer.alloc(STATIC_RELEASE_MAX_BYTES + 1), good.sha256), /STATIC_RELEASE_INVALID/));
for (const change of [
  value => { value.version = 2; },
  value => { value.sourceTreeDigest = '0'.repeat(64); },
  value => { value.files[0].kind = 'asset'; },
  value => { value.files = value.files.toReversed(); },
  value => { value.extra = 'private'; },
  value => { value.files[0].extra = 'private'; },
]) {
  check(() => {
    const value = structuredClone(good.manifest); change(value);
    const bytes = Buffer.from(JSON.stringify(value));
    assert.throws(() => parseStaticRelease(bytes, sha(bytes)), /STATIC_RELEASE_INVALID/);
  });
}
for (const bytes of [Buffer.from([0xff]), Buffer.from('{}'), Buffer.from('[]'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), good.bytes]), Buffer.concat([good.bytes, Buffer.from('\n')])]) {
  check(() => assert.throws(() => parseStaticRelease(bytes, sha(bytes)), /STATIC_RELEASE_INVALID/));
}
process.stdout.write(JSON.stringify({ checks, scope: 'canonical package metadata only; no dependency/remote/old-session proof' }) + '\n');
