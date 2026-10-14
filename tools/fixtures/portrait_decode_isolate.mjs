// PORTRAIT-DECODE-ISOLATION-1: NODE-ONLY EXPERIMENT, not a production adapter.
// Separate process + V8 OLD-SPACE cap + wall timeout. Neither hard RSS/CPU
// limits nor a permission sandbox. Never silently retries a failed child
// inside the parent. Worker/Trial upload APIs do NOT import this fixture.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNGError } from '../../server/pngio.js';
import { PortraitJPEGError } from '../../server/portraitjpeg.js';

export const PROBE_LIMITS = Object.freeze({ timeoutMs: 30000, oldSpaceMiB: 256, inputBytes: 100 * 1024, outputBytes: 32 * 1024 * 1024 });
export class DecodeProcessError extends Error {}
const kinds = new Set(['png', 'trial-jpeg', 'game-jpeg']);
const faults = new Set(['hang', 'crash', 'bad-reply', 'bad-pixels']);
const childPath = fileURLToPath(new URL('./portrait_decode_child.mjs', import.meta.url));

export function decodePortraitPixels(kind, bytes, { timeoutMs = PROBE_LIMITS.timeoutMs, oldSpaceMiB = PROBE_LIMITS.oldSpaceMiB, fault = null, executable = process.execPath } = {}) {
  if (!kinds.has(kind) || !(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > PROBE_LIMITS.inputBytes) { throw new TypeError('invalid probe input'); }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > PROBE_LIMITS.timeoutMs || !Number.isSafeInteger(oldSpaceMiB) || oldSpaceMiB < 16 || oldSpaceMiB > PROBE_LIMITS.oldSpaceMiB || (fault !== null && !faults.has(fault))) { throw new TypeError('invalid probe limits/fault'); }
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (['path', 'systemroot', 'windir', 'temp', 'tmp'].includes(key.toLowerCase())) { env[key] = value; }
  }
  let result;
  try {
    result = spawnSync(executable, [`--max-old-space-size=${oldSpaceMiB}`, childPath], {
      env, input: JSON.stringify({ kind, bytes: Buffer.from(bytes).toString('base64'), fault }),
      timeout: timeoutMs, maxBuffer: PROBE_LIMITS.outputBytes,
    });
  } catch (cause) { throw new DecodeProcessError('decode child could not start', { cause }); }
  if (result.error || result.status !== 0) { throw new DecodeProcessError(`decode child failed (${result.error?.code ?? result.signal ?? result.status})`); }
  let reply;
  try { reply = JSON.parse(String(result.stdout)); }
  catch (cause) { throw new DecodeProcessError('decode child unreadable reply', { cause }); }
  if (reply?.ok === true) {
    const { width, height, pixels } = reply;
    const maxPixels = kind === 'png' ? 4 * 1024 * 1024 : 16384;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > maxPixels || (kind === 'game-jpeg' && (width !== 128 || height !== 128)) || typeof pixels !== 'string' || pixels.length !== 4 * Math.ceil(width * height * 4 / 3)) { throw new DecodeProcessError('decode child invalid dimensions/pixel envelope'); }
    const rgba = Buffer.from(pixels, 'base64');
    if (rgba.length !== width * height * 4 || rgba.toString('base64') !== pixels) { throw new DecodeProcessError('decode child invalid pixel bytes'); }
    return { width, height, pixels: rgba };
  }
  if (kind === 'png' && reply?.errorClass === 'PNGError') { throw new PNGError(reply.message); }
  if (kind !== 'png' && reply?.errorClass === 'PortraitJPEGError') { throw new PortraitJPEGError(reply.message); }
  throw new DecodeProcessError('decode child failed outside the supported decoder contract');
}
