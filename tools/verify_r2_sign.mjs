// R2 signer regression lock (no network): determinism, shape, frozen vector.
// Live correctness was proven 2026-10-16 against the `dragon` bucket
// (ListObjects 200 after fixing the empty canonical query string).
import assert from 'node:assert/strict';
import { signR2 } from '../vps/r2sign.mjs';

const base = { accountId: '7cf57c12af6006a749d4df3c773dce90', accessKeyId: '0'.repeat(32), secretAccessKey: '1'.repeat(64) };
const fixed = { ...base, method: 'GET', key: 'dragon', query: { 'list-type': '2', 'max-keys': '1' }, now: new Date('2026-10-16T00:00:00.000Z') };
const first = signR2(fixed), second = signR2(fixed);
assert.deepEqual(first, second, 'deterministic');
assert.equal(first.host, '7cf57c12af6006a749d4df3c773dce90.r2.cloudflarestorage.com');
assert.equal(first.path, '/dragon?list-type=2&max-keys=1');
assert.equal(first.headers.Authorization, 'AWS4-HMAC-SHA256 Credential=00000000000000000000000000000000/20261016/auto/s3/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=eb4547bf623ac9d7e54c4862f53cf04696bb07c1f38d0def4708e15c5e458573');
assert.equal(signR2({ ...fixed, query: { 'max-keys': '1', 'list-type': '2' } }).path, '/dragon?list-type=2&max-keys=1', 'query sorted');
assert.equal(signR2({ ...fixed, key: 'artifacts/g 1/x+y.png', query: {} }).path, '/artifacts/g%201/x%2By.png', 'path encoded');
assert.throws(() => signR2({ ...fixed, accountId: 'x' }), TypeError);
assert.throws(() => signR2({ ...fixed, accessKeyId: '' }), TypeError);
process.stdout.write('r2 signer: 7 checks green\n');
