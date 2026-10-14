// Test-only child for portrait_decode_isolate.mjs. No production imports it.
// Fault actions are explicit test requests, NEVER inherited environment flags.
// This process still has its OS user's permissions: not a sandbox.
import { decodePNG, PNGError } from '../../server/pngio.js';
import { decodePortraitJPEG, decodeTrialPortraitJPEG, PortraitJPEGError } from '../../server/portraitjpeg.js';
const reply = value => process.stdout.write(JSON.stringify(value) + '\n');
const chunks = [];
let byteLength = 0;
process.stdin.on('data', chunk => {
  byteLength += chunk.length;
  if (byteLength > 140 * 1024) { process.exit(2); }
  chunks.push(chunk);
});
process.stdin.on('end', () => {
  let request;
  try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { process.exitCode = 2; return; }
  const { kind, bytes, fault } = request ?? {};
  if (fault === 'hang') { setInterval(() => {}, 1000); return; }
  if (fault === 'crash') { process.exitCode = 3; return; }
  if (fault === 'bad-reply') { process.stdout.write('not-json'); return; }
  if (fault === 'bad-pixels') { reply({ ok: true, width: 128, height: 128, pixels: 'AA==' }); return; }
  try {
    if (typeof bytes !== 'string') { throw new Error('malformed bytes'); }
    const raw = Buffer.from(bytes, 'base64');
    if (!raw.length || raw.length > 100 * 1024 || raw.toString('base64') !== bytes) { throw new Error('invalid bytes'); }
    let decoded;
    if (kind === 'png') { decoded = decodePNG(raw); }
    else if (kind === 'trial-jpeg') { decoded = decodeTrialPortraitJPEG(raw); }
    else if (kind === 'game-jpeg') { decoded = decodePortraitJPEG(raw); }
    else { throw new Error('unknown kind'); }
    reply({ ok: true, width: decoded.width, height: decoded.height, pixels: Buffer.from(decoded.pixels).toString('base64') });
  } catch (error) {
    let errorClass = 'Other';
    if (error instanceof PNGError) { errorClass = 'PNGError'; }
    else if (error instanceof PortraitJPEGError) { errorClass = 'PortraitJPEGError'; }
    reply({ ok: false, errorClass, message: String(error?.message ?? error) });
  }
});
