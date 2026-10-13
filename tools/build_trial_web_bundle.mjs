// Build-time deterministic bundle of the trial-window engine code: web/src/**/*.js + web/intro/styles.css
// into server/public/trialweb.txt. Byte-faithful (no transforms); per-file sha256/byteLength for serve-time
// and audit-time verification. Regenerate whenever any bundled source changes; the bundle hash is pinned by evidence.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const OUT = fileURLToPath(new URL('../server/public/trialweb.txt', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const sources = [...walk(join(WEB, 'src')).filter(path => path.endsWith('.js')), join(WEB, 'intro', 'styles.css')];
assert.ok(sources.length >= 200, 'engine source tree present');
const files = sources.map(full => {
  const path = relative(WEB, full).replaceAll('\\', '/');
  if (!/^[A-Za-z0-9_][A-Za-z0-9_/.-]{0,255}$/.test(path) || path.includes('..')) throw new Error('bundle path escapes whitelist: ' + path);
  const bytes = readFileSync(full);
  return { path, sha256: sha(bytes), byteLength: bytes.length, text: bytes.toString('utf8') };
});
const seen = new Set();
for (const file of files) { assert.ok(!seen.has(file.path), 'duplicate bundle path ' + file.path); seen.add(file.path); }
const bundle = { schema: 'dragon-trial-web-bundle-1', fileCount: files.length, files };
const text = JSON.stringify(bundle) + '\n';
// Shell: the production index.html skeleton with favicons stripped and boot replaced by the server-trial boot module.
const shell = readFileSync(join(WEB, 'index.html'), 'utf8');
const BOOT = '<script type="module" src="src/boot.js"></script>';
const BANNER = '<div id="trial-status" style="position:fixed;left:4px;bottom:4px;z-index:100;color:#fff;background:#141414;pointer-events:none">草稿試運行 — 僅記憶體；正式存讀檔停用</div><script type="module" src="src/editor/servertrialapp.js"></script>';
if (!shell.includes(BOOT)) throw new Error('index.html boot anchor missing');
const faviconLines = shell.match(/^[^\n]*<link rel="icon"[^\n]*\r?\n/gm) ?? [];
if (faviconLines.length !== 3) throw new Error('expected exactly three favicon links, found ' + faviconLines.length);
let shellOut = shell;
for (const line of faviconLines) { assert.ok(shellOut.includes(line)); shellOut = shellOut.replace(line, ''); }
assert.equal(shellOut.split(BOOT).length, 2, 'boot anchor unique');
shellOut = shellOut.replace(BOOT, BANNER);
const shellText = JSON.stringify({ schema: 'dragon-trial-app-shell-1', sha256: sha(shellOut), byteLength: Buffer.byteLength(shellOut), html: shellOut }) + '\n';
const SHELL_OUT = fileURLToPath(new URL('../server/public/trialapp.txt', import.meta.url));
// Play shell: same skeleton, boot swapped to the anonymous play entry (node /play
// parity: title + #play-status + playapp.js, trial shell untouched). Engine and
// stylesheet resolve against the anonymous /api/play/web/ bundle route, so the
// shell works on either bound domain without login.
const PLAY_BANNER = '<div id="play-status" style="position:fixed;left:4px;bottom:4px;z-index:100;color:#fff;background:#141414;pointer-events:none">載入遊戲列表…</div><script type="module" src="/api/play/web/src/editor/playapp.js"></script>';
let playOut = shellOut;
// Runtime fetch()/Image URLs are document-relative, not relative to the boot module.
assert.equal(playOut.split('<head>').length, 2, 'play head anchor unique');
playOut = playOut.replace('<head>', '<head>\n<base href="/api/play/web/">');
assert.equal(playOut.split('<title>臥龍傳</title>').length, 2, 'play title anchor unique');
playOut = playOut.replace('<title>臥龍傳</title>', '<title>選擇遊戲 — 臥龍傳</title>');
assert.equal(playOut.split(BANNER).length, 2, 'play boot anchor unique');
playOut = playOut.replace(BANNER, PLAY_BANNER);
assert.equal(playOut.split('href="intro/styles.css"').length, 2, 'play stylesheet anchor unique');
playOut = playOut.replace('href="intro/styles.css"', 'href="/api/play/web/intro/styles.css"');
const playText = JSON.stringify({ schema: 'dragon-play-app-shell-1', sha256: sha(playOut), byteLength: Buffer.byteLength(playOut), html: playOut }) + '\n';
const PLAY_OUT = fileURLToPath(new URL('../server/public/playapp.txt', import.meta.url));
const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
const existingShell = existsSync(SHELL_OUT) ? readFileSync(SHELL_OUT, 'utf8') : null;
const existingPlay = existsSync(PLAY_OUT) ? readFileSync(PLAY_OUT, 'utf8') : null;
if (existing === text && existingShell === shellText && existingPlay === playText) {
  process.stdout.write(JSON.stringify({ bundle: 'server/public/trialweb.txt', shell: 'server/public/trialapp.txt', play: 'server/public/playapp.txt', files: files.length, sha256: sha(text), shellSha256: sha(shellText), playSha256: sha(playText), unchanged: true }) + '\n');
} else {
  writeFileSync(OUT, text);
  writeFileSync(SHELL_OUT, shellText);
  writeFileSync(PLAY_OUT, playText);
  process.stdout.write(JSON.stringify({ bundle: 'server/public/trialweb.txt', shell: 'server/public/trialapp.txt', play: 'server/public/playapp.txt', files: files.length, sha256: sha(text), shellSha256: sha(shellText), playSha256: sha(playText), unchanged: false }) + '\n');
}
