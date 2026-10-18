// Owned Linux subprocess only; parent supplies newly-created temp directories.
// Real process signals/files/SQLite; HTTPS is a strict in-process static/archive
// and empty-root seam. No remote object store or real TLS connection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { installedStaticHTTPS } from './installed-static-https.mjs';
assert.equal(process.platform, 'linux');
assert.equal(typeof process.send, 'function');
const [mode, root, port, sourceDigest] = process.argv.slice(2);
assert.match(basename(dirname(root)), /^dragon-linux-/);
assert.ok(fs.lstatSync(root).isDirectory());
const deny = () => { throw new Error('owned Linux child forbids outbound network'); };
net.Socket.prototype.connect = deny; tls.connect = deny; globalThis.fetch = deny;
http.request = deny; http.get = deny; https.get = deny;
const send = value => process.send(value);
process.umask(0); // Test production's explicit modes, not a protective shell umask.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.alloc(65537, 71), game = '11111111-1111-4111-8111-111111111111';
if (mode === 'file-before-link' || mode === 'file-after-link') {
  https.request = deny;
  const sync = fs.fsyncSync, link = fs.linkSync; let linked = false;
  fs.linkSync = (...args) => { const result = link(...args); linked = true; return result; };
  fs.fsyncSync = fd => {
    sync(fd);
    if ((mode === 'file-before-link' && fs.fstatSync(fd).isFile()) ||
        (mode === 'file-after-link' && linked && fs.fstatSync(fd).isDirectory())) {
      send({ phase: mode });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      throw new Error('owned paused child unexpectedly resumed');
    }
  };
  syncBuiltinESMExports();
  const { FileBucket } = await import('../../vps/file-bucket.mjs');
  await new FileBucket({ root: join(root, 'objects') }).put(`private/${game}/${sha(bytes)}`, bytes);
  throw new Error('owned crash barrier not reached');
} else if (mode === 'sqlite-crash') {
  https.request = deny; syncBuiltinESMExports();
  const path = join(root, 'editor.sqlite'); fs.closeSync(fs.openSync(path, 'wx', 0o600));
  const { openStorage } = await import('../../vps/sqlite-port.mjs');
  const store = openStorage(path);
  store.sql.exec('CREATE TABLE owned_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  store.sql.exec("INSERT INTO owned_probe VALUES(1,'committed')");
  store.sql.exec('BEGIN IMMEDIATE'); store.sql.exec("INSERT INTO owned_probe VALUES(2,'uncommitted')");
  send({ phase: mode });
  setInterval(() => {}, 1000);
} else {
  assert.ok(['publication', 'early', 'reject', 'archive-source', 'archive-put', 'archive-recheck'].includes(mode));
  let release, barrierEvents;
  let controlGets = 0, servers = 0;
  const archive = installedStaticHTTPS('test/owned-linux/');
  assert.equal(archive.release.manifest.sourceTreeDigest, sourceDigest);
  https.request = (url, options, callback) => {
    const control = url === 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/dragon/test/owned-linux/control/current.json';
    assert.equal(options.rejectUnauthorized, true);
    if (control) {
      controlGets++;
      assert.equal(options.method, 'GET');
      assert.ok(options.headers.Authorization.startsWith('AWS4-HMAC-SHA256 Credential=' + 'b'.repeat(32) + '/'));
      assert.equal(archive.objects.size, archive.files.size);
      assert.deepEqual(archive.registrations.get(archive.registrationURL), archive.registrationBytes);
    }
    const req = new EventEmitter(), res = new EventEmitter();
    req.destroy = () => {}; res.destroy = () => {};
    req.end = (body = Buffer.alloc(0)) => {
      const deliver = () => {
        const stored = archive.handle(url, options, body);
        assert.ok(control || stored, 'unexpected Linux HTTPS request');
        const respond = () => {
          res.statusCode = stored?.status ?? 404; res.headers = stored?.headers ?? { 'content-length': '0' };
          callback(res); if (stored?.bytes.length) res.emit('data', stored.bytes); res.complete = true; res.emit('end');
        };
        const holdSource = mode === 'archive-source' && archive.events.length === 1;
        const holdPut = mode === 'archive-put' && options.method === 'PUT';
        const holdManifest = mode === 'archive-recheck' && options.method === 'PUT' && url === archive.manifestURL;
        if (!release && (holdSource || holdPut || holdManifest)) {
          // PUT is already committed in the owned transport; only its response
          // is held. Cancellation must not pretend to roll that write back.
          release = respond; barrierEvents = archive.events.length;
          send({ phase: 'archive-held', objects: archive.objects.size, manifest: archive.objects.has(archive.manifestURL) });
        } else respond();
      };
      if (control && mode === 'early' && !release) { release = deliver; send({ phase: 'preflight-held' }); }
      else queueMicrotask(deliver);
    };
    return req;
  };
  const createServer = http.createServer;
  http.createServer = (...args) => {
    servers++;
    const server = createServer(...args);
    server.on('request', request => { if (request.method === 'POST') send({ phase: 'request-accepted' }); });
    return server;
  };
  syncBuiltinESMExports();
  const { runPublicationCommand } = await import('../../vps/publication-main.mjs');
  const env = { EDITOR_ORIGIN: 'https://owned-editor.invalid', EDITOR_REQUEST_KEY: 'c'.repeat(64), EDITOR_DEFAULT_PASSWORD: 'Owned Linux password only!',
    EDITOR_DATA_DIR: root, EDITOR_LISTEN_HOST: '127.0.0.1', EDITOR_LISTEN_PORT: port, EDITOR_DRAIN_INTERVAL_MS: '20',
    R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'b'.repeat(32), R2_SECRET_ACCESS_KEY: 'd'.repeat(64), R2_BUCKET: 'dragon', R2_PREFIX: 'test/owned-linux/',
    STATIC_ORIGIN: 'https://owned-static.invalid', STATIC_PATH_PREFIX: 'release/', STATIC_RELEASE_SHA256: archive.release.sha256, STATIC_SOURCE_SHA256: sourceDigest };
  const observed = signal => send({ phase: 'signal-observed', signal });
  const term = () => observed('SIGTERM'), interrupt = () => observed('SIGINT');
  process.on('SIGTERM', term); process.on('SIGINT', interrupt);
  const message = value => { assert.deepEqual(value, { release: true }); assert.equal(typeof release, 'function'); release(); };
  process.on('message', message);
  let stopped;
  const end = new Promise(resolve => { stopped = resolve; });
  const runtime = await runPublicationCommand({ argv: [], env, report: value => {
    send(value); if (value.event === 'stopped' || value.event === 'startup-failed') stopped();
  } });
  if (runtime && mode !== 'early') {
    assert.equal(process.listenerCount('SIGTERM'), 2); assert.equal(process.listenerCount('SIGINT'), 2);
    send({ phase: 'ready', port: runtime.address.port });
  }
  await end;
  if (mode.startsWith('archive-')) {
    assert.equal(runtime, null);
    for (const [url, object] of archive.objects) {
      const path = url === archive.manifestURL ? 'static-release.json' : url.slice((archive.base + 'files/').length);
      assert.deepEqual(object.bytes, archive.files.get(path), 'retained archive bytes must remain exact');
    }
    send({ phase: 'archive-final', objects: archive.objects.size, expectedObjects: archive.files.size,
      manifest: archive.objects.has(archive.manifestURL), additionalRequests: archive.events.length - barrierEvents, controlGets, servers });
  }
  assert.equal(process.listenerCount('SIGTERM'), 1); assert.equal(process.listenerCount('SIGINT'), 1);
  process.off('SIGTERM', term); process.off('SIGINT', interrupt); process.off('message', message);
  process.disconnect();
}
