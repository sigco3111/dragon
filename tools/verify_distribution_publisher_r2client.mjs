// Actual r2client/signing call path with an in-process HTTPS double, never a socket.
// Fake credentials/owned URL only; low-level preload network denial remains active.
import assert from 'node:assert/strict';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { openStorage } from '../vps/sqlite-port.mjs';
import { r2client } from '../vps/r2client.mjs';
import { createDistributionPublisher } from '../vps/distribution-publisher.mjs';
const original = https.request, objects = new Map(), requests = [];
const host = '00000000000000000000000000000000.r2.cloudflarestorage.com';
const prefix = 'test/r2client-contract/', pathPrefix = '/owned-fixture/' + prefix;
let forcedGetStatus = null, errorBytes = null, declareErrorLength = true, checks = 0;
https.request = (url, options, callback) => {
  assert.equal(options.rejectUnauthorized, true);
  assert.ok(typeof url === 'string' && url.startsWith('https://' + host + pathPrefix));
  const path = url.slice(('https://' + host).length);
  assert.ok(!path.includes('?') && !path.includes('..'));
  assert.ok(['GET', 'PUT'].includes(options.method));
  const headers = {};
  for (const [key, value] of Object.entries(options.headers)) {
    const name = key.toLowerCase();
    if (Object.hasOwn(headers, name)) assert.equal(headers[name], value);
    headers[name] = value;
  }
  assert.ok(headers.authorization.startsWith('AWS4-HMAC-SHA256 '));
  requests.push({ path, method: options.method, ifMatch: headers['if-match'], ifNoneMatch: headers['if-none-match'] });
  const request = new EventEmitter();
  request.end = body => queueMicrotask(() => {
    let status, value = objects.get(path);
    if (options.method === 'GET') status = forcedGetStatus ?? (value ? 200 : 404);
    else if (headers['if-none-match'] === '*' ? value !== undefined : !value || headers['if-match'] !== value.headers.etag) status = 412;
    else {
      assert.equal(headers['content-type'], 'application/json');
      const bytes = Buffer.from(body);
      value = { bytes, headers: { etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"', 'content-type': headers['content-type'], 'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT' } };
      objects.set(path, value); status = 200;
    }
    const response = new EventEmitter(); response.statusCode = status; response.headers = { ...value?.headers };
    if (status >= 400 && errorBytes && declareErrorLength) response.headers['content-length'] = String(errorBytes.length);
    callback(response);
    if (status >= 400 && errorBytes) response.emit('data', errorBytes);
    if (status === 200 && options.method === 'GET') response.emit('data', Buffer.from(value.bytes));
    response.emit('end');
  });
  return request;
};
syncBuiltinESMExports();
const storage = openStorage(':memory:');
try {
  const r2 = r2client({ accountId: '00000000000000000000000000000000', accessKeyId: 'owned-fixture-access', secretAccessKey: 'owned-fixture-secret', bucket: 'owned-fixture' });
  const publisher = createDistributionPublisher({ storage, r2, prefix, authorityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', verifyResources: async () => {} });
  for (const generation of [1, 2]) storage.transactionSync(() => publisher.ledger.enqueueInTxn({ operationId: 'cccccccc-cccc-4ccc-8ccc-00000000000' + generation, kind: 'listing', gameId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', payload: Buffer.from(JSON.stringify({ version: 1, projection: { generation } })) }));
  assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED'); checks++;
  const prior = publisher.ledger.entry(1).receipt.rootETag;
  assert.equal((await publisher.drainOne()).state, 'VISIBLE_CONFIRMED'); checks++;
  const puts = requests.filter(r => r.method === 'PUT' && r.path === pathPrefix + 'control/current.json');
  assert.equal(puts.length, 2); assert.equal(puts[0].ifNoneMatch, '*'); assert.equal(puts[0].ifMatch, undefined);
  assert.equal(puts[1].ifNoneMatch, undefined); assert.equal(puts[1].ifMatch, prior); checks++;
  assert.equal((await publisher.drainOne()).state, 'IDLE');
  assert.equal(requests.filter(r => r.method === 'PUT' && r.path === pathPrefix + 'control/current.json').length, 2); checks++;
  for (const status of [412, 403, 500]) {
    forcedGetStatus = status;
    await assert.rejects(() => r2.get(prefix + 'control/current.json'), new RegExp('R2 get ' + status)); checks++;
  }
  forcedGetStatus = 404; assert.equal(await r2.get(prefix + 'missing.json'), null); checks++;
  // A real S3 missing-object XML envelope can exceed the tiny object's budget.
  // It is not object data; only 404 means absence, not 403/500 or a short 200.
  errorBytes = Buffer.alloc(512, 120);
  assert.equal(await r2.get(prefix + 'missing.json', { maxBytes: 1 }), null); checks++;
  forcedGetStatus = 403;
  await assert.rejects(r2.get(prefix + 'missing.json', { maxBytes: 1 }), /R2 get 403/); checks++;
  forcedGetStatus = 200;
  await assert.rejects(r2.get(prefix + 'control/current.json', { maxBytes: 1 }), /R2_RESPONSE_BUDGET/); checks++;
  forcedGetStatus = 404; errorBytes = Buffer.alloc(64 * 1024 + 1);
  for (declareErrorLength of [true, false]) {
    await assert.rejects(r2.get(prefix + 'missing.json', { maxBytes: 1 }), /R2_RESPONSE_BUDGET/); checks++;
  }
} finally { storage.close(); https.request = original; syncBuiltinESMExports(); }
assert.equal(checks, 13);
process.stdout.write('distribution actual r2client: 13 groups green; signed requests intercepted in process, no sockets/cloud; resource-verifier seam\n');
