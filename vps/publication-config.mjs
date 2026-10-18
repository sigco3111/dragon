// Trusted process configuration only. No filesystem/network access, discovery,
// migration, secret logging or fallback to the legacy auth-only service.
import { isAbsolute, normalize, parse } from 'node:path';
import { config } from '../server/security.js';
import { createStaticByteReader } from './static-client.mjs';
import { createStaticResourceVerifier } from './static-resources.mjs';
import { createStaticArchiver } from './static-archive.mjs';

export function parsePublicationEnvironment(input) {
  const required = key => {
    const value = input?.[key];
    if (typeof value !== 'string' || !value || value.includes('\0')) throw new TypeError(`invalid ${key}`);
    return value;
  };
  const integer = (key, max) => {
    const value = required(key);
    if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new TypeError(`invalid ${key}`);
    return Number(value);
  };
  const env = {};
  for (const key of ['EDITOR_ORIGIN', 'EDITOR_REQUEST_KEY', 'EDITOR_DEFAULT_PASSWORD']) env[key] = required(key);
  for (const key of ['EDITOR_SESSION_MS', 'EDITOR_IDLE_MS', 'EDITOR_RATE_MS', 'EDITOR_ACCOUNT_LIMIT', 'EDITOR_SOURCE_LIMIT']) {
    if (input[key] !== undefined) env[key] = String(integer(key, Number.MAX_SAFE_INTEGER));
  }
  // There is no VPS player host in this deployment, even if a legacy env file
  // still contains one. Do not silently accept an incompatible deployment mode.
  if (input.EDITOR_PLAY_ORIGIN !== undefined && input.EDITOR_PLAY_ORIGIN !== '') throw new TypeError('legacy play origin unsupported');
  const policy = config(env);
  if (env.EDITOR_ORIGIN !== policy.origin) throw new TypeError('canonical editor origin required');
  const dataRoot = required('EDITOR_DATA_DIR');
  if (!isAbsolute(dataRoot) || dataRoot.startsWith('\\\\') || normalize(dataRoot) !== dataRoot || parse(dataRoot).root === dataRoot) throw new TypeError('private absolute data directory required');
  const host = required('EDITOR_LISTEN_HOST');
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new TypeError('invalid EDITOR_LISTEN_HOST');
  const port = integer('EDITOR_LISTEN_PORT', 65535), intervalMs = integer('EDITOR_DRAIN_INTERVAL_MS', 2147483647);
  const r2 = { accountId: required('R2_ACCOUNT_ID'), accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY'), bucket: required('R2_BUCKET') };
  if (!/^[a-f0-9]{32}$/.test(r2.accountId) || !/^[A-Za-z0-9_-]{16,128}$/.test(r2.accessKeyId) || !/^[A-Za-z0-9+/=_-]{32,256}$/.test(r2.secretAccessKey) || r2.bucket !== 'dragon') throw new TypeError('invalid R2 configuration');
  const prefix = input.R2_PREFIX;
  if (typeof prefix !== 'string' || !(prefix === '' || /^test\/[A-Za-z0-9_-]{1,100}\/$/.test(prefix))) throw new TypeError('explicit R2_PREFIX required');
  const staticOptions = { origin: required('STATIC_ORIGIN'), pathPrefix: input.STATIC_PATH_PREFIX ?? '' };
  const expectedDigest = required('STATIC_RELEASE_SHA256'), sourceTreeDigest = required('STATIC_SOURCE_SHA256');
  // Constructors are pure. The independently supplied pins are never obtained
  // from the remote manifest itself; no production bypass verifier is exposed.
  const readStatic = createStaticByteReader(staticOptions);
  const verifyStaticResources = createStaticResourceVerifier({ readStatic, expectedDigest, sourceTreeDigest });
  const archiveStaticProgram = (bucket, assertCurrent) => createStaticArchiver({ r2: bucket, readStatic,
    expectedDigest, sourceTreeDigest, prefix, maxTotalBytes: 256 * 1024 * 1024 }).stage(assertCurrent);
  return Object.freeze({ env: Object.freeze(env), dataRoot, host, port, intervalMs, prefix, r2: Object.freeze(r2), sourceTreeDigest, verifyStaticResources, archiveStaticProgram });
}
