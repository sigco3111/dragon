// VPS file bucket: native port behind server/blobs.js ImmutableBlobStore
// and server/privatewrites.js PrivateWriteJournal. Replaces the R2 API
// subset the worker uses:
//
//   put(key, bytes, { onlyIf }) -> object on write, null when the key
//     already exists under If-None-Match:* (caller re-reads + re-hashes;
//     an etag is never proof). Writes are atomic: O_EXCL create, fsync
//     file, fsync directory, no overwrites.
//   get(key) -> { key, size, body } with a web ReadableStream, or null.
//   list({ prefix }) -> real prefix scan over both layouts.
//
// Keys must match private/<game-uuid>/<sha256-hex> (authoritative blobs)
// or installed/<registry>/<sha256-hex> (installed source bytes; registry
// ids are pinned names, not uuids). Anything else throws. No authority
// logic here; server/blobs.js keeps every permission/hash gate.
import { openSync, closeSync, writeSync, fsyncSync, mkdirSync, statSync, readdirSync, createReadStream } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const KEY = /^(private\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})|installed\/([A-Za-z0-9_.-]{1,128}))\/([a-f0-9]{64})$/;

export class FileBucket {
  #root;
  constructor({ root }) {
    if (typeof root !== 'string' || !root) throw new TypeError('root directory required');
    this.#root = resolve(root);
    mkdirSync(this.#root, { recursive: true });
  }
  #path(key) {
    const match = KEY.exec(key);
    if (!match) throw new TypeError('bucket key shape');
    const parts = match[2] !== undefined ? ['private', match[2]] : ['installed', match[3]];
    const full = resolve(this.#root, parts[0], parts[1], `${match[4]}.bin`);
    if (!full.startsWith(this.#root + sep)) throw new TypeError('bucket key escape');
    return { full, dir: resolve(this.#root, parts[0], parts[1]) };
  }
  async put(key, bytes, options = {}) {
    const { full, dir } = this.#path(key);
    if (!ArrayBuffer.isView(bytes) || !(bytes instanceof Uint8Array) || !(bytes.buffer instanceof ArrayBuffer)) {
      throw new TypeError('bucket bytes');
    }
    const conditional = options?.onlyIf instanceof Headers && options.onlyIf.get('If-None-Match') === '*';
    mkdirSync(dir, { recursive: true });
    let fd;
    try {
      fd = openSync(full, conditional ? 'wx' : 'w');
    } catch (error) {
      if (conditional && error?.code === 'EEXIST') { return null; }
      throw error;
    }
    try {
      if (bytes.byteLength) { writeSync(fd, bytes, 0, bytes.byteLength, 0); }
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    // Directory fsync is required for durability on Linux. Windows forbids
    // fsync on directory handles (EPERM); there it is best-effort only and
    // production Linux enforcement is covered by V1 container verification.
    const dirFd = openSync(dir, 'r');
    try { fsyncSync(dirFd); } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'ENOSYS' && error?.code !== 'EINVAL') { throw error; }
    } finally { closeSync(dirFd); }
    return {};
  }
  async get(key) {
    let full;
    try { ({ full } = this.#path(key)); } catch { return null; }
    let size;
    try { size = statSync(full).size; } catch { return null; }
    return { key, size, body: Readable.toWeb(createReadStream(full)) };
  }
  async list({ prefix = '' } = {}) {
    const out = [];
    for (const namespace of ['private', 'installed']) {
      let gameDirs = [];
      try { gameDirs = readdirSync(join(this.#root, namespace), { withFileTypes: true }); } catch { continue; }
      for (const dirent of gameDirs) {
        if (!dirent.isDirectory()) { continue; }
        let files = [];
        try { files = readdirSync(join(this.#root, namespace, dirent.name)); } catch { continue; }
        for (const file of files) {
          if (!file.endsWith('.bin')) { continue; }
          const key = `${namespace}/${dirent.name}/${file.slice(0, -4)}`;
          if (!KEY.test(key) || (prefix && !key.startsWith(prefix))) { continue; }
          let size = 0;
          try { size = statSync(join(this.#root, namespace, dirent.name, file)).size; } catch { continue; }
          out.push({ key, size });
        }
      }
    }
    return { objects: out };
  }
}
