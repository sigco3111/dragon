// Transport-only visibility references. Authority/announcement uniqueness is the
// producer's responsibility; these checks never authorize a publication.
import { isGameId, isDigest, parseJSON, requireValue } from './runtimecontract.js';
const code = 'ANNOUNCEMENTS_UNAVAILABLE';
const check = value => requireValue(value, code);
function fields(value, keys) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
export function validateFirstOnlineReference(value, context) {
  check(isGameId(context?.authorityId) && Number.isSafeInteger(context.generation) && context.generation > 0);
  check(Number.isSafeInteger(value?.generation) && value.generation > 0 && value.generation <= context.generation);
  if (value.generation === context.generation) fields(value, ['generation']);
  else {
    fields(value, ['generation', 'operationId', 'operationDigest', 'payloadDigest']);
    check(isGameId(value.operationId) && isDigest(value.operationDigest) && isDigest(value.payloadDigest));
  }
  return value;
}
export function firstOnlineReceiptKey(value, context) {
  validateFirstOnlineReference(value, context);
  check(value.generation < context.generation);
  return `control/receipts/${context.authorityId}/${value.generation}/${value.operationDigest}.json`;
}
export function rootVisibleAt(uploaded) {
  // The same R2 object's service timestamp, normalized to S3 Last-Modified
  // precision. Never Date.now(), custom metadata, or a queued timestamp.
  check(uploaded instanceof Date && Number.isFinite(uploaded.getTime()));
  return new Date(Math.floor(uploaded.getTime() / 1000) * 1000).toISOString();
}
export function receiptVisibleAt(bytes, reference, context) {
  firstOnlineReceiptKey(reference, context);
  check(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= 4096);
  const value = parseJSON(bytes);
  fields(value, ['authorityId', 'generation', 'operationId', 'operationDigest', 'payloadDigest', 'rootDigest', 'rootETag', 'visibleAt']);
  check(value.authorityId === context.authorityId && ['generation', 'operationId', 'operationDigest', 'payloadDigest'].every(key => value[key] === reference[key]));
  check(isDigest(value.rootDigest) && typeof value.rootETag === 'string' && value.rootETag.length > 0 && value.rootETag.length <= 256 && !/[\r\n]/.test(value.rootETag));
  check(typeof value.visibleAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value.visibleAt) && rootVisibleAt(new Date(value.visibleAt)) === value.visibleAt);
  const canonical = { authorityId: value.authorityId, generation: value.generation, operationId: value.operationId, operationDigest: value.operationDigest, payloadDigest: value.payloadDigest, rootDigest: value.rootDigest, rootETag: value.rootETag, visibleAt: value.visibleAt };
  check(new TextDecoder('utf-8', { fatal: true }).decode(bytes) === JSON.stringify(canonical));
  return value.visibleAt;
}
