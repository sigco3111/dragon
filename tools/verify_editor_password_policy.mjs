// Pure policy/KDF regression; no server, cloud, database or user credentials.
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { password, passwordHash, passwordMatches } from '../server/security.js';
let checks = 0;
for (const value of ['Aa123456!', 'Aa123456。', 'Aa123456😀', 'Aa1!' + 'x'.repeat(124)]) {
  assert.equal(password(value), value); checks++;
}
for (const [value, code] of [
  ['Aa12345!', 'PASSWORD_LENGTH'], ['Aa1!' + 'x'.repeat(125), 'PASSWORD_LENGTH'],
  [null, 'PASSWORD_LENGTH'], ['Aa123456!\0', 'PASSWORD_LENGTH'], ['Aa123456!\ud800', 'PASSWORD_LENGTH'],
  ['aa123456!', 'PASSWORD_COMPLEXITY'], ['AA123456!', 'PASSWORD_COMPLEXITY'],
  ['Aabcdefg!', 'PASSWORD_COMPLEXITY'], ['Aa1234567', 'PASSWORD_COMPLEXITY'],
  ['Aa123456 ', 'PASSWORD_COMPLEXITY'], ['Aa123456中', 'PASSWORD_COMPLEXITY']
]) { assert.throws(() => password(value), error => error.status === 422 && error.code === code); checks++; }
const encoded = passwordHash('Aa123456!');
assert.ok(passwordMatches('Aa123456!', encoded)); assert.equal(passwordMatches('Aa123456?', encoded), false); checks++;
// Simulate an existing pre-policy hash without using the new-password validator.
const old = 'existing-legacy-password', salt = 'a'.repeat(32);
const legacy = JSON.stringify({ algorithm: 'scrypt-32768-8-3', salt, digest: scryptSync(old, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }).toString('hex') });
assert.ok(passwordMatches(old, legacy)); assert.equal(passwordMatches(old + 'x', legacy), false); checks++;
process.stdout.write(`PASS password policy ${checks} groups; exact9, max128, four classes, Unicode and legacy login\n`);
