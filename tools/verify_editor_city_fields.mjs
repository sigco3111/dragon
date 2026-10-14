// N3-1: chapter city troops/prod bounded edits (editChapterCity).
// No backend; pinned builtin copyIMMUTABLE. Usage:
// node tools/verify_editor_city_fields.mjs
import { editChapterCity } from '../web/src/content/authoring/gamesource.js';
import { createPinnedCopyLoader } from './editor_trusted_copy.mjs';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const throws = (name, fn) => {
  try { fn(); } catch { passed++; console.log(`ok ${name}`); return; }
  console.error(`FAIL ${name}`); process.exitCode = 1;
};

const { game } = await createPinnedCopyLoader()({ gameId: 'city-probe', ownerId: 'o' });
const ch0 = game.chapterOrder[0];
const rec0 = game.chapters[ch0].state.cities[0];
console.log(`base idx=${rec0.idx} troops=${rec0.troops}/${rec0.troops_cap} prod=${rec0.prod}/${rec0.max_prod}`);

const edited = editChapterCity(game, ch0, rec0.idx, { troops: rec0.troops - 1, prod: rec0.prod - 100 });
const rec1 = edited.chapters[ch0].state.cities.find(c => c.idx === rec0.idx);
check('applied', rec1.troops === rec0.troops - 1 && rec1.prod === rec0.prod - 100);
check('new object', edited !== game);
check('original intact', game.chapters[ch0].state.cities.find(c => c.idx === rec0.idx).troops === rec0.troops);
const raw = rec1.raw;
const byte = o => Number.parseInt(raw.slice(o * 2, o * 2 + 2), 16);
check('raw patched', byte(0x13) === rec1.troops && byte(0x0E) + byte(0x0F) * 256 === rec1.prod);

check('no-op same ref', editChapterCity(game, ch0, rec0.idx, { troops: rec0.troops }) === game);
check('zero troops allowed', editChapterCity(game, ch0, rec0.idx, { troops: 0 }).chapters[ch0].state.cities.find(c => c.idx === rec0.idx).troops === 0);
check('cap boundary', editChapterCity(game, ch0, rec0.idx, { troops: rec0.troops_cap, prod: rec0.max_prod }).chapters[ch0].state.cities.find(c => c.idx === rec0.idx).prod === rec0.max_prod);

throws('over cap', () => editChapterCity(game, ch0, rec0.idx, { troops: rec0.troops_cap + 1 }));
throws('negative', () => editChapterCity(game, ch0, rec0.idx, { prod: -1 }));
throws('fraction', () => editChapterCity(game, ch0, rec0.idx, { troops: 1.5 }));
throws('neg zero', () => editChapterCity(game, ch0, rec0.idx, { troops: -0 }));
throws('unknown key', () => editChapterCity(game, ch0, rec0.idx, { owner: 1 }));
throws('empty values', () => editChapterCity(game, ch0, rec0.idx, {}));
throws('bad chapter', () => editChapterCity(game, 'nope', rec0.idx, { troops: 1 }));
throws('bad idx', () => editChapterCity(game, ch0, 99999, { troops: 1 }));
throws('builtin game', () => editChapterCity({ ...game, gameId: 'wolong-builtin' }, ch0, rec0.idx, { troops: 1 }));
const tampered = structuredClone(game);
tampered.chapters[ch0].state.cities.find(c => c.idx === rec0.idx).troops += 0;
const tRaw = tampered.chapters[ch0].state.cities.find(c => c.idx === rec0.idx).raw;
tampered.chapters[ch0].state.cities.find(c => c.idx === rec0.idx).raw = tRaw.slice(0, 0x13 * 2) + 'ff' + tRaw.slice(0x13 * 2 + 2);
throws('raw divergence', () => editChapterCity(tampered, ch0, rec0.idx, { troops: 1 }));

console.log(`passed ${passed} checks`);
