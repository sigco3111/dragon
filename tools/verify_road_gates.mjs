// Q21 (no junction without a city) + Q59 (water/land share one gate).
// Additive to tools/verify_road_edit.mjs (sealed): water acceptance +
// identical refusal gates for water + synthetic X-crossing. Usage:
// node tools/verify_road_gates.mjs
import { readFileSync } from 'node:fs';
import { buildRoad } from '../web/src/content/authoring/roadedit.js';

let passed = 0;
const ok = (name, cond) => {
  if (!cond) { console.error(`FAIL ${name}`); process.exit(1); }
  passed++; console.log(`ok ${name}`);
};
const expectCode = (name, fn, code) => {
  try { fn(); } catch (error) {
    ok(name, error.code === code);
    return;
  }
  console.error(`FAIL ${name} (no refusal)`); process.exit(1);
};

// Real-data base: rebuild road-0 geometry as WATER with identical gates.
const readJSON = rel => {
  try {
    return JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  } catch (error) {
    throw new Error(`cannot load ${rel}`, { cause: error });
  }
};
const tiles = readFileSync(new URL('../web/mmap_map.bin', import.meta.url));
const T = (x, y) => tiles[y * 384 + x];
const graph = readJSON('../web/content/builtin/world/roads.json');
const world = readJSON('../web/content/builtin/world/world.json');
const cities = new Map(world.cities.map(c => [c.id, { x: c.x, y: c.y }]));
const e0 = graph.edges[0];
const base = {
  fromCityId: world.cities[e0.source].id,
  toCityId: world.cities[e0.target].id,
  geometry: e0.points.map(p => ({ x: p.x, y: p.y })),
  cities,
  roads: [],
  tiles: T,
};
const land = buildRoad({ ...base, travelKind: 'land' });
const water = buildRoad({ ...base, travelKind: 'water' });
ok('water accepted', water.travelKind === 'water');
ok('kind-independent derivation', water.nativeBinding.weight === land.nativeBinding.weight &&
  JSON.stringify(water.nativeBinding.flags) === JSON.stringify(land.nativeBinding.flags) &&
  JSON.stringify(water.geometry) === JSON.stringify(land.geometry));
expectCode('water bad kind', () => buildRoad({ ...base, travelKind: 'steam' }), 'bad-travel-kind');
const existing = [{ ...land, id: 'road-0' }];
expectCode('water shared-cell refused', () => buildRoad({ ...base, travelKind: 'water', roads: existing }), 'shared-cell');
expectCode('land shared-cell refused', () => buildRoad({ ...base, travelKind: 'land', roads: existing }), 'shared-cell');

// Synthetic X-crossing without a city: existing diagonal (10,9)-(11,8),
// new orthogonal-crossing segment (10,8)-(11,9). Cells are disjoint.
const ports = new Set(['10,11', '14,10', '11,10', '12,12']);
const corridor = new Set(['11,11', '12,10', '13,10', '12,11']);
const stubTiles = (x, y) => ports.has(`${x},${y}`) ? 0xd4 : corridor.has(`${x},${y}`) ? 0xb8 : 0x00;
const micro = new Map([['A', { x: 10, y: 12 }], ['B', { x: 15, y: 10 }], ['C', { x: 11, y: 9 }], ['D', { x: 12, y: 13 }]]);
const diag = buildRoad({ fromCityId: 'A', toCityId: 'B',
  geometry: [{ x: 10, y: 11 }, { x: 11, y: 11 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }],
  travelKind: 'land', cities: micro, roads: [], tiles: stubTiles });
const diagExisting = [{ ...diag, id: 'road-d' }];
const crossGeo = [{ x: 11, y: 10 }, { x: 12, y: 11 }, { x: 12, y: 12 }];
expectCode('x-crossing refused', () => buildRoad({ fromCityId: 'C', toCityId: 'D', geometry: crossGeo.map(p => ({ ...p })), travelKind: 'land', cities: micro, roads: diagExisting, tiles: stubTiles }), 'x-crossing');
expectCode('x-crossing water too', () => buildRoad({ fromCityId: 'C', toCityId: 'D', geometry: crossGeo.map(p => ({ ...p })), travelKind: 'water', cities: micro, roads: diagExisting, tiles: stubTiles }), 'x-crossing');

// B-3 structural gate: the trial compiler pins the 192 fixed slots, so a
// moved city can never compile. The B-1/B-2 save+publish block is therefore
// structural, not provisional (reopening needs G-SLOTS slot semantics).
const { createPinnedCopyLoader } = await import('./editor_trusted_copy.mjs');
const { compileGameSource } = await import('../web/src/content/authoring/trialcompile.js');
const { game: slotGame } = await createPinnedCopyLoader()({ gameId: 'slot-probe', ownerId: 'o' });
const movedGame = structuredClone(slotGame);
movedGame.cities['city-000'].x += 1;
try {
  compileGameSource(movedGame, () => 'x');
  console.error('FAIL moved city compiled'); process.exitCode = 1;
} catch (e) {
  ok('moved city never compiles', /unsupported city relocation/.test(e.message));
}

console.log(`passed ${passed} checks`);
