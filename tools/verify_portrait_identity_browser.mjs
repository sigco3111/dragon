// Q37 presentation identity: real modules, real PNG pixels, fresh Chromium.
// Synthetic compiled packs/HTTP; not workerd auth, safe upload decode or full battle proof.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { encodePNG } from '../server/pngio.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = new Map();
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name).replaceAll('\\', '/');
    if (item.isDirectory()) walk(path);
    else if (path.endsWith('.js')) inputs.set(path, readFileSync(path));
  }
}
walk('web/src');
inputs.set('web/data.json', readFileSync('web/data.json'));
inputs.set('web/talk.json', readFileSync('web/talk.json'));
let chapter;
try { chapter = JSON.parse(inputs.get('web/data.json')).scenarios[0]; }
catch (cause) { throw new Error('owned Web chapter fixture is invalid', { cause }); }
const pins = Object.fromEntries([...inputs].map(([path, bytes]) => [path, sha(bytes)]));
const png = rgb => encodePNG(new Uint8Array(Array.from({ length: 128 * 128 }, () => [...rgb, 255]).flat()), 128, 128);
const routes = new Map([
  ['/portraits/A.png', png([255, 0, 0])], ['/portraits/B.png', png([0, 0, 255])],
  ['/portraits/Other.png', png([0, 255, 0])], ['/kao/7.png', png([255, 255, 0])],
  ['/portraits/Late.png', png([255, 0, 255])],
]);
const outside = [], errors = [], checks = [], requests = [];
let releaseLate;
const server = createServer((req, res) => {
  const path = req.url;
  requests.push(path);
  if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (path === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><link rel="icon" href="data:,"><canvas id="cv" width="1000" height="800"></canvas><canvas id="startv"></canvas>'); return; }
  if (routes.has(path)) {
    res.setHeader('Content-Type', 'image/png');
    if (path === '/portraits/Late.png') { releaseLate = () => res.end(routes.get(path)); return; }
    res.end(routes.get(path)); return;
  }
  const input = inputs.get('web' + path);
  if (input && (path.startsWith('/src/') || path === '/talk.json')) {
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'application/json'); res.end(input); return;
  }
  outside.push(path); res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/fczll/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async chapterInput => {
    window.idbCalls = 0;
    indexedDB.open = () => { window.idbCalls++; throw new Error('IDB forbidden'); };
    const assets = await import('/src/core/assets.js');
    const { createTrialEnvironment } = await import('/src/content/authoring/trialruntime.js');
    const { TRIAL_COMPILER_REVISION } = await import('/src/content/authoring/trialcompile.js');
    const { GameBar } = await import('/src/ui/gamebar.js');
    const { StartMenu } = await import('/src/ui/startmenu.js');
    const { HUD } = await import('/src/ui/hud.js');
    const { Scenario } = await import('/src/game/world.js');
    const { BattleView } = await import('/src/render/battleview.js');
    const { originalTalkContext } = await import('/src/game/battle/originalmessages.js');
    const checks = [];
    const ok = (name, condition) => { if (!condition) throw new Error(name); checks.push(name); };
    const chapter = structuredClone(chapterInput);
    for (const [idx, key] of [[0, 'First'], [1, 'Second']]) Object.assign(chapter.generals[idx], { portrait: 7, portraitKey: key });
    chapter.generals[2].portrait = 7;
    delete chapter.generals[2].portraitKey;
    const pack = (gameId, url) => ({ chapterId: 'chapter', chapter: structuredClone(chapter), manifest: {
      compilerRevision: TRIAL_COMPILER_REVISION, buildFormat: 'studio-app-2', chapters: ['chapter'],
      identity: { gameId, draftRevision: '1', sourceDigest: gameId + '-digest', trialSnapshotId: gameId + '-snapshot' },
      assets: ['terrain', 'roadGraph', 'roadCost', 'roadOffset'].map(assetId => ({ assetId, url: '/unused/' + assetId })),
      portraits: [{ assetId: 'First', url }, { assetId: 'Second', url: '/portraits/B.png' }],
    } });
    const first = pack('first', '/portraits/A.png'), original = JSON.stringify(first);
    const a = createTrialEnvironment(first);
    const b = createTrialEnvironment(pack('second', '/portraits/Other.png'), { persistent: true });
    const [ga, gb, unbound] = a.raw.generals;
    ok('same-byte-two-entities', assets.portraitURL(ga, a.world) === '/portraits/A.png' && assets.portraitURL(gb, a.world) === '/portraits/B.png');
    ok('unbound-same-byte-falls-back', assets.portraitURL(unbound, a.world) === 'kao/7.png');
    ok('two-worlds-coexist', assets.portraitURL(b.raw.generals[0], b.world) === '/portraits/Other.png' && assets.portraitURL(ga, a.world) === '/portraits/A.png');
    ok('numeric-custom-and-builtin-not-overridden', assets.portraitURL(7, a.world) === 'kao/7.png' && assets.portraitURL(ga) === 'kao/7.png');
    ok('mismatched-byte-or-explicit-key-no-override', !assets.hasPortraitOverride({ ...ga, portrait: 8 }, a.world) && !assets.hasPortraitOverride({ ...ga, portraitKey: null }, a.world));
    const duplicate = structuredClone(first); duplicate.chapter.generals[1].portraitKey = 'First';
    const shared = createTrialEnvironment(duplicate);
    ok('one-asset-reusable', assets.portraitURL(shared.raw.generals[0], shared.world) === assets.portraitURL(shared.raw.generals[1], shared.world));
    first.manifest.portraits[0].url = '/wrong';
    first.chapter.generals[0].portraitKey = 'Second';
    ok('captured-inputs-not-aliases', assets.portraitURL(ga, a.world) === '/portraits/A.png');
    const broken = pack('bad', '/portraits/Other.png'); broken.chapter.factions = [];
    let rejected = false; try { createTrialEnvironment(broken); } catch { rejected = true; }
    ok('failed-boot-cannot-reset-other-world', rejected && assets.portraitURL(ga, a.world) === '/portraits/A.png');
    const pixel = image => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      c.getContext('2d').drawImage(image, 0, 0);
      const bytes = c.getContext('2d').getImageData(0, 0, 128, 128).data;
      for (let i = 4; i < bytes.length; i++) if (bytes[i] !== bytes[i % 4]) throw new Error('nonuniform PNG pixel ' + i);
      return [...bytes.slice(0, 4)].join(',');
    };
    const images = await Promise.all([assets.portrait(ga, a.world), assets.portrait(gb, a.world), assets.portrait(b.raw.generals[0], b.world), assets.portrait(unbound, a.world)]);
    ok('real-png-pixels-independent', images.map(pixel).join('|') === '255,0,0,255|0,0,255,255|0,255,0,255|255,255,0,255');
    const sc = new Scenario(a.raw);
    const app = { world: a.world, scenario: sc, view: { draw() {} } };
    const bar = Object.assign(Object.create(GameBar.prototype), { app, syncClock() {}, imgs: {}, panelRect: () => ({ x: 10, y: 10, w: 224, h: 208 }) });
    await bar.showGeneralCard(ga); const redCard = bar.generalCard.img;
    await bar.showGeneralCard(gb);
    ok('actual-general-cards', pixel(redCard) === '255,0,0,255' && pixel(bar.generalCard.img) === '0,0,255,255');
    const menu = Object.assign(Object.create(StartMenu.prototype), { app });
    ok('actual-start-menu-no-byte-cache-collision', pixel(await menu._kao(ga)) === '255,0,0,255' && pixel(await menu._kao(gb)) === '0,0,255,255');
    const canvas = document.querySelector('#cv'), ctx = canvas.getContext('2d');
    const legionA = { leader: 'identical-name', generalIdx: 0, faction: 0 }, legionB = { ...legionA, generalIdx: 1 };
    bar._drawLegionDetailPanel(ctx, legionA); await new Promise(r => setTimeout(r, 0));
    const redLegion = bar._legionPortraitImg;
    bar._drawLegionDetailPanel(ctx, legionB); await new Promise(r => setTimeout(r, 0));
    ok('actual-legion-id-and-url-cache', pixel(redLegion) === '255,0,0,255' && pixel(bar._legionPortraitImg) === '0,0,255,255');
    sc.factions[0].monarch_idx = 0;
    await bar.drawRes(ctx); await new Promise(r => setTimeout(r, 0)); const redMonarch = bar.portraitImg;
    sc.factions[0].monarch_idx = 1;
    await bar.drawRes(ctx); await new Promise(r => setTimeout(r, 0));
    ok('actual-res-monarch-url-cache', pixel(redMonarch) === '255,0,0,255' && pixel(bar.portraitImg) === '0,0,255,255');
    const hud = Object.assign(Object.create(HUD.prototype), { app, _modal: node => node });
    hud._musterAllocate(sc, { troops: 6000 }, ga);
    const face = document.querySelector('#musterdlg img'); await face.decode();
    ok('actual-hud-img-not-promise-string', face.getAttribute('src') === '/portraits/A.png' && pixel(face) === '255,0,0,255');
    document.querySelector('#musterdlg').remove();
    sc.factions[0].advisor_idx = 1;
    hud._musterConfirm(sc, sc.factions[0], ga, [1000, 1000, 1000, 1000, 1000, 1000]);
    const advisorFace = document.querySelector('#musterdlg img'); await advisorFace.decode();
    ok('actual-hud-confirm-advisor', pixel(advisorFace) === '0,0,255,255');
    document.querySelector('#musterdlg').remove();
    let factionFace;
    hud._installFactionCard = (_f, _cap, _quote, img) => { factionFace = img; };
    await hud.showFactionCard(sc.factions[0]); await factionFace.decode();
    ok('actual-hud-faction-card', pixel(factionFace) === '0,0,255,255');
    await bar.showGeneralMessageDialog(ga, 'message', null, { autoClose: 0 });
    ok('actual-general-message', pixel(bar.generalCard.img) === '255,0,0,255');
    const captureContext = originalTalkContext(sc, [{ slot: 0, generalIdx: 1 }, { slot: 1, generalIdx: 0 }]);
    const savedContext = JSON.stringify(captureContext);
    for (const side of ['atk', 'def']) { const box = document.createElement('div'); box.id = 'bdialogue-' + side; for (const name of ['name', 'text', 'face']) { const node = document.createElement(name === 'face' ? 'img' : 'div'); node.id = box.id + '-' + name; box.append(node); } document.body.append(box); }
    const battle = Object.assign(Object.create(BattleView.prototype), { app, battle: { sideMap: { atk: 0 } }, dialoguePresentation: { expire() {}, owns() { return true; } } });
    battle.showBattleDialogue({ side: 0, speaker: captureContext.speakers[0], text: 'a\nb' }, {});
    battle.showBattleDialogue({ side: 1, speaker: captureContext.speakers[1], text: 'c' }, {});
    await new Promise(r => setTimeout(r, 0));
    const faces = [document.querySelector('#bdialogue-atk-face'), document.querySelector('#bdialogue-def-face')];
    await Promise.all(faces.map(image => image.decode()));
    ok('actual-battle-retained-slot-not-commander', pixel(faces[0]) === '255,0,0,255' && pixel(faces[1]) === '0,0,255,255' && JSON.stringify(captureContext) === savedContext);
    const ffWorld = {}, ff = [{ idx: 4, portrait: 255, portraitKey: 'First' }, { idx: 5, portrait: 255 }];
    assets.bindPortraitOverrides(ffWorld, assets.buildPortraitOverrides(ff, [{ assetId: 'First', url: '/portraits/A.png' }]));
    ok('ff-upload-exception-is-entity-local', assets.hasPortraitOverride(ff[0], ffWorld) && !assets.hasPortraitOverride(ff[1], ffWorld) && !assets.hasPortraitOverride(ff[0], a.world));
    const captureWorld = {}, bindingMap = assets.buildPortraitOverrides([ga], [{ assetId: 'First', url: '/portraits/A.png' }]);
    assets.bindPortraitOverrides(captureWorld, bindingMap); bindingMap.clear();
    let rebound = false; try { assets.bindPortraitOverrides(captureWorld, new Map()); } catch { rebound = true; }
    ok('bindings-copy-and-no-rebind', rebound && assets.portraitURL(ga, captureWorld) === '/portraits/A.png');
    const rawUnmodified = pack('immutable', '/portraits/A.png'), rawBefore = JSON.stringify(rawUnmodified);
    createTrialEnvironment(rawUnmodified);
    ok('environment-does-not-mutate-source', JSON.stringify(rawUnmodified) === rawBefore && original.length > 0);
    window.testState = { assets, app, bar, sc, ctx, checks, pixel };
    return checks;
  }, chapter);
  checks.push(...result);
  await page.evaluate(async () => {
    const { assets, app, bar, sc, ctx } = window.testState;
    const lateWorld = {};
    assets.bindPortraitOverrides(lateWorld, assets.buildPortraitOverrides([{ idx: 0, portrait: 7, portraitKey: 'Late' }], [{ assetId: 'Late', url: '/portraits/Late.png' }]));
    app.world = lateWorld; sc.generals[0].portraitKey = 'Late'; sc.factions[0].monarch_idx = 0;
    await bar.drawRes(ctx);
  });
  await page.waitForFunction(() => window.testState.bar.portraitKey === '/portraits/Late.png');
  const deadline = Date.now() + 10000;
  while (!releaseLate && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
  assert.equal(typeof releaseLate, 'function', 'late request received');
  await page.evaluate(() => { window.testState.app.world = {}; window.testState.app.scenario = {}; });
  releaseLate();
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => e.name.endsWith('/portraits/Late.png')));
  assert.equal(await page.evaluate(() => window.testState.bar.portraitImg), null);
  checks.push('late-resource-does-not-write-new-world');
  assert.equal(await page.evaluate(() => window.idbCalls), 0);
  assert.deepEqual(errors, []); assert.deepEqual(outside, []);
  for (const [path, digest] of Object.entries(pins)) assert.equal(sha(readFileSync(path)), digest, 'source drift: ' + path);
  process.stdout.write(JSON.stringify({ checks, idbCalls: 0, errors, outside, requests, pins, testSha256: sha(readFileSync('tools/verify_portrait_identity_browser.mjs')), limits: 'Synthetic packs and loopback image/TALK server; actual consumer methods and PNG pixels. Not workerd authorization, upload safety, complete App/battle/publish or DRM.' }, null, 2) + '\n');
} finally {
  releaseLate?.();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
