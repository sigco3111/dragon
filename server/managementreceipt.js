// Private persisted envelope only. HTTP/replay results retain their old shape.
// A null association means an explicitly recorded no-op, not public visibility.
import { fail } from './security.js';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const corrupt = () => fail(503, 'MANAGEMENT_RECEIPT_CORRUPT');
export function decodeManagementReceipt(text) {
  let value;
  try { value = JSON.parse(text); } catch { corrupt(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) corrupt();
  if (!Object.hasOwn(value, 'version')) return { result: value, distribution: undefined };
  if (value.version !== 1 || Object.keys(value).sort().join(',') !== 'distribution,result,version') corrupt();
  const ref = value.distribution;
  if (ref !== null && (!ref || Array.isArray(ref) || Object.keys(ref).sort().join(',') !== 'generation,operationId' || !uuid(ref.operationId) || !Number.isSafeInteger(ref.generation) || ref.generation < 1)) corrupt();
  if (JSON.stringify({ version: 1, result: value.result, distribution: ref }) !== text) corrupt();
  return { result: value.result, distribution: ref === null ? null : Object.freeze({ ...ref }) };
}
export function encodeManagementReceipt(result, distribution) {
  if (distribution === undefined) return JSON.stringify(result);
  const text = JSON.stringify({ version: 1, result, distribution });
  decodeManagementReceipt(text);
  return text;
}
