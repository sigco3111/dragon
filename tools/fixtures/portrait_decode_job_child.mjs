// Test-only Job Object payload. Faults are synthetic explicit stdin requests.
// No production imports this fixture; no permission sandbox is claimed.
import { spawn } from 'node:child_process';
import { decodePNG, PNGError } from '../../server/pngio.js';
import { decodePortraitJPEG, decodeTrialPortraitJPEG, PortraitJPEGError } from '../../server/portraitjpeg.js';
const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 140 * 1024) { throw new Error('input cap'); }
  chunks.push(chunk);
}
let request;
try { request = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
catch { process.stderr.write('Malformed probe input'); process.exit(2); }
if (!request || typeof request !== 'object') { process.exit(2); }
if (request.fault === 'cpu') {
  process.stdout.write('CPU_PROBE_READY\n');
  let value = 0;
  while (true) { value = Math.sin(value + 0.001); }
} else if (request.fault === 'memory') {
  process.stdout.write('MEMORY_PROBE_READY\n');
  // Buffers are native/external memory, not V8 old-space. Retain/touch all pages.
  const blocks = [];
  while (true) { blocks.push(Buffer.alloc(16 * 1024 * 1024, 0xcc)); }
} else if (request.fault === 'wall') {
  process.stdout.write('WALL_PROBE_READY\n');
  setInterval(() => {}, 1000);
} else if (request.fault === 'descendant') {
  // No detached/breakaway option. Wait for RUNNING readiness, not merely
  // spawn: an empty Windows environment can yield an immediately dead child.
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (['path', 'systemroot', 'windir', 'temp', 'tmp'].includes(key.toLowerCase())) { env[key] = value; }
  }
  const descendant = spawn(process.execPath, ['-e', "process.stdout.write('DESCENDANT_READY'); setInterval(() => {}, 1000)"], { stdio: ['ignore', 'pipe', 'pipe'], env });
  descendant.on('error', error => { process.stderr.write(String(error)); process.exitCode = 2; });
  descendant.stderr.on('data', chunk => process.stderr.write(chunk));
  descendant.on('exit', () => { process.stderr.write('Descendant exited before parent'); process.exitCode = 2; });
  descendant.stdout.once('data', chunk => {
    if (chunk.toString('utf8') !== 'DESCENDANT_READY') { process.exit(2); }
    process.stdout.write(JSON.stringify({ descendantPid: descendant.pid, descendantReady: true })); process.exit(0);
  });
} else if (request.fault === 'crash') {
  process.exitCode = 3;
} else if (request.fault === 'bad-reply') {
  process.stdout.write('not-json');
} else {
  try {
    const { kind, bytes } = request;
    if (typeof bytes !== 'string') { throw new Error('missing bytes'); }
    const raw = Buffer.from(bytes, 'base64');
    if (!raw.length || raw.length > 100 * 1024 || raw.toString('base64') !== bytes) { throw new Error('invalid bytes'); }
    let decoded;
    if (kind === 'png') { decoded = decodePNG(raw); }
    else if (kind === 'trial-jpeg') { decoded = decodeTrialPortraitJPEG(raw); }
    else if (kind === 'game-jpeg') { decoded = decodePortraitJPEG(raw); }
    else { throw new Error('unknown kind'); }
    process.stdout.write(JSON.stringify({ ok: true, width: decoded.width, height: decoded.height, pixels: Buffer.from(decoded.pixels).toString('base64') }));
  } catch (error) {
    let errorClass = 'Other';
    if (error instanceof PNGError) { errorClass = 'PNGError'; }
    else if (error instanceof PortraitJPEGError) { errorClass = 'PortraitJPEGError'; }
    process.stdout.write(JSON.stringify({ ok: false, errorClass, message: String(error?.message ?? error) }));
  }
}
