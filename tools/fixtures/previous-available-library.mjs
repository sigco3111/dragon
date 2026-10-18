// Exact previous metadata, reconstructed without an ignored artifact dependency.
// Resources/licence/unresolved references are unchanged. This is NOT a policy grant.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const previousLibraryId = 'approved-available-library-76cdf28-1';
export const previousLibraryDigest = 'c89cb0c99ec2b3dd13900c35c2882f26799eadef074d7d2d4811c2d8059291f2';
export function previousAvailableLibrary(current) {
  assert.equal(sha(current), '8993b360d062fd29c2c26f5e55812a6b1911e2531881a44781e90e7690ddc06b');
  let text = Buffer.from(current).toString('utf8');
  for (const [now, before] of [
    ['24c1f74dcc1625f0c655fcfc2adc5ac7899119cf3dc0c3ef61f6e15fda5f8885', '0386710c4fe4ed163437da27ae97fcb3de3b96e898f591e1e18c5770dc635559'],
    ['e6b16a095a3590c8d2d97889815953811035b2151ed7fe8404de7ad0b70572c0', '89741bcc4aefcef4092d79ab44bfb808d638901ad01e35c400d9e2dd65af51e8'],
    ['0183b712412e020ec090991d0f7f99761c46b8e338b92c98e05c9f0f5e9c730f', 'cd2004291949d4117a6b1677c1b32fa523c9b2c6fca552ffd4ee83bc8f3ee5a5'],
    ['b956b5d552e79953ffd6b4c4de9137663bee2920d542f3fcacb1b1c7bd8c9a58', '33ffe5e619a90c699a9d93ce59bc268584a10fc6fda91bb995cd5fea79d1a8c4'],
  ]) {
    assert.equal(text.split(now).length, 2); text = text.replace(now, before);
  }
  const bytes = Buffer.from(text); assert.equal(bytes.length, 93632); assert.equal(sha(bytes), previousLibraryDigest);
  return bytes;
}
