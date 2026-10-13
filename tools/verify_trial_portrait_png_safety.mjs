// Trial PNG slice: actual Node/workerd SQLite, explicit stub service ports.
// Source geometry is preserved; no crop/JPEG-safety/Root-auth/R2/App certificate.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync, crc32 } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { installedSourcePolicy } from '../server/sourcecatalogpolicy.js';
import { trialPortraitFixture } from './fixtures/trial_portrait_fixture.mjs';
const round = process.argv[2];
assert.match(round ?? '', /^[1-9][0-9]{0,2}$/); assert.equal(process.argv.length, 3);
const base = '.dragon-analysis/editor-phase/trial-portrait-png-r1';
mkdirSync(base, { recursive: true });
const out = `${base}/attempt${round}`; mkdirSync(out);
const sha = b => createHash('sha256').update(b).digest('hex');
const inputs = ['server/trials.js', 'server/pngio.js', 'server/security.js', 'server/sourcecatalogpolicy.js', 'server/pinned/world-manifest.txt', 'server/pinned/entity-manifest.txt', 'server/wrangler.jsonc', 'tools/verify_trial_portrait_png_safety.mjs', 'tools/fixtures/trial_portrait_fixture.mjs', 'tools/fixtures/trial_portrait_png_worker.mjs', 'tools/verify_trial_portrait_png_oracle.py', '.dragon-analysis/editor-phase/trial-portrait-png-parent-r1/budget-source.png'];
const pins = {};
for (const [i, name] of inputs.entries()) { const b = readFileSync(name); pins[name] = sha(b); writeFileSync(`${out}/input-${i}.txt`, b, { flag: 'wx' }); }
writeFileSync(`${out}/inputs.json`, JSON.stringify(pins, null, 2), { flag: 'wx' });
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function chunk(kind, bytes) {
  const body = Buffer.concat([Buffer.from(kind), bytes]), h = Buffer.alloc(4), c = Buffer.alloc(4);
  h.writeUInt32BE(bytes.length); c.writeUInt32BE(crc32(body)); return Buffer.concat([h, body, c]);
}
function header(width = 256, height = 128, type = 6, depth = 8, interlace = 0) {
  const h = Buffer.alloc(13); h.writeUInt32BE(width); h.writeUInt32BE(height, 4); h[8] = depth; h[9] = type; h[12] = interlace; return h;
}
function png(h, raw, prefix = [], tail = [], compressed = deflateSync(raw)) { return Buffer.concat([signature, chunk('IHDR', h), ...prefix, chunk('IDAT', compressed), ...tail, chunk('IEND', Buffer.alloc(0))]); }
const positives = [];
for (const [type, depth] of [[0,8],[2,8],[3,1],[3,2],[3,4],[3,8],[4,8],[6,8]]) {
  const width = 129, height = 71, channels = { 0:1,2:3,3:1,4:2,6:4 }[type];
  const stride = Math.ceil(width * channels * depth / 8), raw = Buffer.alloc((stride + 1) * height), expected = Buffer.alloc(width * height * 4);
  const palette = Buffer.from(Array.from({ length: 3 * 2 ** depth }, (_, i) => i * 11 % 256)), alpha = Buffer.from(Array.from({ length: 2 ** depth }, (_, i) => i * 17 % 256)), prefix = [];
  if (type === 3) { prefix.push(chunk('PLTE', palette), chunk('tRNS', alpha)); }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = (x + y * 3) % 256, at = y * (stride + 1) + 1 + x * channels, to = (y * width + x) * 4;
      if (type === 3) {
        const index = value % 2 ** depth, bit = x * depth;
        raw[y * (stride + 1) + 1 + (bit >>> 3)] |= index << (8 - depth - (bit & 7));
        expected.set(palette.subarray(index * 3, index * 3 + 3), to); expected[to + 3] = alpha[index];
      } else {
        const rgb = type === 0 || type === 4 ? [value,value,value] : [value,(value+1)%256,(value+2)%256];
        raw[at] = value; if (type === 2 || type === 6) { raw.set(rgb, at); }
        let opacity = 255;
        if (type === 4 || type === 6) { opacity = (x * 5 + y) % 256; raw[at + channels - 1] = opacity; }
        expected.set([...rgb, opacity], to);
      }
    }
  }
  positives.push({ name: `type${type}-depth${depth}`, bytes: png(header(width,height,type,depth),raw,prefix), width, height, pixelSHA: sha(expected) });
}
const raw = Buffer.alloc((256 * 4 + 1) * 128), zeroSHA = sha(Buffer.alloc(256 * 128 * 4));
const metadata = png(header(), raw, [chunk('tEXt',Buffer.from('Comment\0Synthetic metadata')),chunk('eXIf',Buffer.from('49492a0008000000000000000000','hex'))]);
positives.push({ name:'metadata', bytes:metadata,width:256,height:128,pixelSHA:zeroSHA });
const pad = 100 * 1024 - png(header(),raw).length - 12;
positives.push({ name:'exact-100KiB',bytes:png(header(),raw,[chunk('tEXt',Buffer.concat([Buffer.from('Comment\0'),Buffer.alloc(pad-8,65)]))]),width:256,height:128,pixelSHA:zeroSHA });
assert.equal(positives.at(-1).bytes.length,100*1024);
const largeWidth = 8192, largeHeight = 512, largeRaw = Buffer.alloc((largeWidth * 3 + 1) * largeHeight,96);
for (let y=0;y<largeHeight;y++) { largeRaw[y*(largeWidth*3+1)] = 0; }
const largePixels = Buffer.alloc(largeWidth*largeHeight*4,96); for(let i=3;i<largePixels.length;i+=4) { largePixels[i]=255; }
positives.push({name:'exact-4Mi-pixels-and-8192-side',bytes:png(header(largeWidth,largeHeight,2),largeRaw),width:largeWidth,height:largeHeight,pixelSHA:sha(largePixels)});
const negatives = [], invalid = (name,bytes,code='TRIAL_PORTRAIT_PNG_INVALID') => negatives.push({name,bytes,code});
const rgbBase=positives[1].bytes, badCRC=Buffer.from(rgbBase);badCRC[29]^=1;
invalid('fake-header',rgbBase.subarray(0,24));invalid('crc',badCRC);invalid('truncated',rgbBase.subarray(0,-1));invalid('tail-html',Buffer.concat([rgbBase,Buffer.from('<html>bad</html>')]));invalid('missing-iend',rgbBase.subarray(0,-12));
invalid('empty-idat',png(header(),raw,[],[],Buffer.alloc(0)));invalid('short-scanlines',png(header(),raw.subarray(0,-1)));invalid('long-scanlines',png(header(),Buffer.alloc(raw.length+1)));invalid('inflate-bomb',png(header(),Buffer.alloc(1024*1024)));
const badFilter=Buffer.from(raw);badFilter[0]=5;invalid('filter',png(header(),badFilter));
invalid('deflate-tail',png(header(),raw,[],[],Buffer.concat([deflateSync(raw),Buffer.from([1])])));invalid('second-zlib',png(header(),raw,[],[],Buffer.concat([deflateSync(raw),deflateSync(raw)])));
invalid('duplicate-ihdr',png(header(),raw,[chunk('IHDR',header())]));invalid('critical',png(header(),raw,[chunk('ABCD',Buffer.alloc(0))]));invalid('reserved-bit',png(header(),raw,[chunk('abca',Buffer.alloc(0))]));
for(const kind of ['acTL','fcTL','fdAT','iCCP','gAMA','cHRM','cICP','mDCV','cLLI']) {invalid(kind,png(header(),raw,[chunk(kind,Buffer.alloc(32))]));}
invalid('interlaced',png(header(256,128,6,8,1),raw));invalid('depth16',png(header(256,128,6,16),raw));invalid('palette-missing',png(header(256,128,3,1),raw));invalid('palette-index',png(header(256,128,3,8),Buffer.alloc(257*128,1),[chunk('PLTE',Buffer.from([1,2,3]))]));
invalid('chunk-budget',png(header(),raw,Array.from({length:4096},()=>chunk('tEXt',Buffer.from('a\0b')))));
invalid('over-pixels-before-inflate',png(header(8192,513),raw));invalid('over-side-before-inflate',png(header(8193,1),raw));invalid('zero-dimension',png(header(0,128),raw));
const growthSource=readFileSync('.dragon-analysis/editor-phase/trial-portrait-png-parent-r1/budget-source.png');assert.ok(growthSource.length<=100*1024);
invalid('source-compliant-canonical-over-budget',growthSource,'TRIAL_PORTRAIT_OUTPUT_BYTES');
invalid('over-bytes',Buffer.alloc(100*1024+1),'TRIAL_PORTRAIT_BYTES');invalid('empty',Buffer.alloc(0),'TRIAL_PORTRAIT_BYTES');invalid('svg',Buffer.from('<svg/>'),'TRIAL_PORTRAIT_TYPE');
const db=new DatabaseSync(':memory:');
const storage={sql:{exec(q,...v){const rows=db.prepare(q).all(...v);return{toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const nodeCall=trialPortraitFixture(storage,installedSourcePolicy(readFileSync('server/pinned/world-manifest.txt'),readFileSync('server/pinned/entity-manifest.txt')));
const checks=[],calls=[],oracleImages=[];let mf,index=0;
const assetId=()=> 'Image'+String.fromCharCode(65+Math.floor(index/26),65+index++%26);
const payload=(assetId,bytes,op='preview',extra={})=>({op,assetId,dataBase64:bytes.toString('base64'),...extra});
function image(bytes,test) {const file=`image-${oracleImages.length}.png`;writeFileSync(`${out}/${file}`,bytes,{flag:'wx'});oracleImages.push({file,width:test.width,height:test.height,pixelSHA:test.pixelSHA});}
try {
  const location=process.env.MINIFLARE_MODULE||'C:/Users/fczll/AppData/Roaming/npm/node_modules/wrangler/node_modules/miniflare/dist/src/index.js';
  const {Miniflare}=await import(pathToFileURL(location).href),config=JSON.parse(readFileSync('server/wrangler.jsonc','utf8'));
  mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']},{type:'Text',include:['**/*.txt']}],scriptPath:resolve('tools/fixtures/trial_portrait_png_worker.mjs'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,durableObjects:{TRIAL_PNG:{className:'TrialPortraitPNGFixture',useSQLite:true}},host:'127.0.0.1',port:0});
  const origin=await mf.ready;
  async function call(input) {
    const node=nodeCall(input),response=await fetch(origin,{method:'POST',body:JSON.stringify(input),signal:AbortSignal.timeout(30000)}),text=await response.text();
    calls.push({op:input.op,assetId:input.assetId??null,status:response.status});
    writeFileSync(`${out}/http-${calls.length}.json`,JSON.stringify({status:response.status,body:text},null,2),{flag:'wx'});
    let worker;
    try { worker=JSON.parse(text); } catch(cause) { throw new Error(`fixture response JSON ${input.op}/${input.assetId}: HTTP ${response.status}`,{cause}); }
    writeFileSync(`${out}/call-${calls.length}.json`,JSON.stringify({input,node,worker},null,2),{flag:'wx'});
    assert.equal(response.status,worker.status);assert.deepEqual(worker,node,`${input.op}/${input.assetId}`);return {...node,worker};
  }
  for(const test of positives) {
    const id=assetId(),p=await call(payload(id,test.bytes));assert.equal(p.status,200);assert.deepEqual(p.before,p.after);
    const c=await call(payload(id,test.bytes,'transaction',{expected:p.data}));assert.equal(c.status,200);assert.deepEqual(c.data,p.data);assert.equal(c.after.length,c.before.length+1);
    const served=await call({op:'asset',assetId:id});assert.equal(served.status,200);const bytes=Buffer.from(served.data.bytes,'base64');assert.equal(sha(bytes),p.data.sha256);assert.equal(bytes.length,p.data.byteLength);assert.equal(served.data.mime,'image/png');
    const kinds=[];for(let at=8;at<bytes.length;at+=bytes.readUInt32BE(at)+12){kinds.push(bytes.toString('ascii',at+4,at+8));}assert.deepEqual(kinds,['IHDR','IDAT','IEND']);
    const manifest=JSON.parse(Buffer.from(c.after.find(x=>x.asset_id==='manifest').bytes,'base64').toString('utf8'));assert.deepEqual(manifest.portraits.find(x=>x.assetId===id),p.data);
    image(test.bytes,test);image(bytes,test);image(Buffer.from(served.worker.data.bytes,'base64'),test);checks.push(test.name);
  }
  for(const test of negatives) {
    const id=assetId(),reply=await call(payload(id,test.bytes));assert.equal(reply.status,422,test.name);assert.equal(reply.error,test.code,test.name);assert.deepEqual(reply.before,reply.after);checks.push('reject-'+test.name);
  }
  const source=positives[1].bytes;
  const good=await call(payload('Mismatch',source));
  for(const [field,value] of [['assetId','Other'],['mime','image/jpeg'],['sha256','0'.repeat(64)],['byteLength',1]]) {
    const reply=await call(payload('Mismatch',source,'commit',{expected:{...good.data,[field]:value}}));assert.equal(reply.status,409);assert.equal(reply.error,'TRIAL_CHANGED');assert.deepEqual(reply.before,reply.after);checks.push('bare-commit-mismatch-'+field);
  }
  const missing=await call(payload('Mismatch',source,'commit'));assert.equal(missing.error,'TRIAL_CHANGED');assert.deepEqual(missing.before,missing.after);checks.push('bare-commit-missing-preview');
  const dup=await call(payload('ImageAA',source,'commit',{expected:good.data}));assert.equal(dup.error,'TRIAL_PORTRAIT_EXISTS');assert.deepEqual(dup.before,dup.after);checks.push('duplicate-no-write');
  for(const [name,extra,code,status] of [['id',{assetId:'bad-id'},'TRIAL_PORTRAIT_ID',422],['reserved',{assetId:'manifest'},'TRIAL_PORTRAIT_ID',422],['foreign-before-decode',{token:'foreign'},'TRIAL_INVALID',401],['invalid-before-decode',{token:'invalid'},'SESSION_INVALID',401],['missing-trial-before-decode',{trialId:'33333333-3333-4333-8333-333333333333'},'TRIAL_INVALID',401]]) {
    const reply=await call(payload(assetId(),rgbBase.subarray(0,24),'preview',extra));assert.equal(reply.status,status);assert.equal(reply.error,code);assert.deepEqual(reply.before,reply.after);checks.push(name);
  }
  for(const mode of ['missing','invalid-json','invalid-shape']) {
    await call({op:'seed'});const preview=await call(payload('MissingManifest',source));
    let text='not-json';if(mode==='invalid-shape'){text=JSON.stringify({portraits:null});}
    await call({op:'manifest',mode,text});const reply=await call(payload('MissingManifest',source,'commit',{expected:preview.data}));assert.equal(reply.error,'TRIAL_DERIVED_MISSING');assert.deepEqual(reply.before,reply.after);checks.push('bare-commit-'+mode);
  }
  await call({op:'seed'});const preview=await call(payload('Rollback',source));await call({op:'abort'});
  const rollback=await call(payload('Rollback',source,'transaction',{expected:preview.data}));assert.equal(rollback.error,'FIXTURE_SQL_ABORT');assert.deepEqual(rollback.before,rollback.after);checks.push('outer-transaction-write-abort-rollback');
  await call({op:'seed'});const legacy=Buffer.from('ffd8ffe000000000','hex'),lp=await call(payload('LegacyJPEG',legacy));assert.equal(lp.data.mime,'image/jpeg');await call(payload('LegacyJPEG',legacy,'transaction',{expected:lp.data}));checks.push('known-legacy-jpeg-header-not-safety');
  for(const op of ['epoch','deleting','ended']) {await call({op:'seed'});const reply=await call(payload('Guarded',source,op));assert.equal(reply.error,'TRIAL_INVALID');assert.ok(!reply.after.some(x=>x.asset_id==='Guarded'));checks.push(op+'-reject-no-new-portrait');}
  writeFileSync(`${out}/oracle.json`,JSON.stringify(oracleImages,null,2),{flag:'wx'});
  const env={};for(const [k,v] of Object.entries(process.env)){if(['path','systemroot','windir','temp','tmp','userprofile','localappdata','appdata'].includes(k.toLowerCase())){env[k]=v;}}env.PYTHONDONTWRITEBYTECODE='1';env.PYTHONUTF8='1';
  const oracle=spawnSync('python',['-B','tools/verify_trial_portrait_png_oracle.py',out],{env,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});writeFileSync(`${out}/oracle.log`,oracle.stdout??'',{flag:'wx'});writeFileSync(`${out}/oracle.err`,oracle.stderr??'',{flag:'wx'});assert.equal(oracle.status,0,oracle.stderr);
  for(const name of inputs){assert.equal(sha(readFileSync(name)),pins[name],name);}
  writeFileSync(`${out}/receipt.json`,JSON.stringify({checks,calls,pins,oracleImages:oracleImages.length,limits:'Real SQLite with explicit stub ports. Source PNG geometry retained, shared bounded PNG subset; no crop/128-output, process isolation, JPEG safety, Root/auth/R2/App or old-asset migration certificate.'},null,2),{flag:'wx'});
  process.stdout.write(`Trial PNG PASS ${checks.length} checks ${calls.length} HTTP ${oracleImages.length} Pillow images\n`);
} finally {writeFileSync(`${out}/partial.json`,JSON.stringify({checks,calls},null,2),{flag:'wx'});if(mf){await mf.dispose();}db.close();}
