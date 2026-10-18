// Private-bucket transport envelope, not proof of SQL authority or history.
// Legacy roots remain readable for the existing prototype; this is NOT a
// migration bridge, authority pin, rollback detector or permission to overwrite.
import { isDigest, isGameId, requireValue } from './runtimecontract.js';
const legacyFields = ['generation', 'digest', 'previousDigest'];
const frozenFields = ['version', 'authorityId', 'generation', 'operationId', 'operationDigest', 'payloadDigest', 'previousOperationDigest', 'digest'];
// A locator only. Neither an archived descriptor nor its existence proves that
// the corresponding CAS became visible; history also requires its receipt.
export function publicationRootArchiveKey(value) {
  requireValue(isGameId(value?.authorityId) && Number.isSafeInteger(value.generation) && value.generation > 0 && isDigest(value.operationDigest), 'REGISTRY_CORRUPT');
  return `control/roots/${value.authorityId}/${value.generation}/${value.operationDigest}.json`;
}
export function validatePublicationRoot(value) {
  const check = condition => requireValue(condition, 'REGISTRY_CORRUPT');
  check(value && typeof value === 'object' && !Array.isArray(value));
  check(Number.isSafeInteger(value.generation) && value.generation > 0 && isDigest(value.digest));
  const predecessor = digest => value.generation === 1 ? digest === null : isDigest(digest);
  if (Object.hasOwn(value, 'version')) {
    check(value.version === 2 && Object.keys(value).length === frozenFields.length && Object.keys(value).every(key => frozenFields.includes(key)));
    check(isGameId(value.authorityId) && isGameId(value.operationId) && isDigest(value.operationDigest) && isDigest(value.payloadDigest) && predecessor(value.previousOperationDigest));
  } else {
    check(Object.keys(value).every(key => legacyFields.includes(key)));
    check(!Object.hasOwn(value, 'previousDigest') || predecessor(value.previousDigest));
  }
  return value;
}
