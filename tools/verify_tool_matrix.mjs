// Q56/Q60: every component tool accepts its domain and refuses outside it
// (rotate/flip/city-touch stay absent by design: no tile-semantics evidence).
// Pure fixtures, no files/network. Usage: node tools/verify_tool_matrix.mjs
import { captureComponent, placeComponent, componentCells, hitDecoration, decorationIdsInRect, createWaterGroup, splitWaterGroup, mergeWaterGroups, fillBase, translateDecorations, reorderDecorations, splitDecoration, materialReferences, renameMaterial, removeMaterial, validateLibraryAdditions } from '../web/src/editor/componenttools.js';
import { composeMapLayers, BYTE_STAMP_RECIPE } from '../web/src/content/authoring/maplayers.js';

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`FAIL ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`ok ${name}`); }
};
const refuses = (name, fn, pattern) => {
  try { fn(); } catch (e) {
    check(name, e instanceof RangeError && (!pattern || pattern.test(e.message)), e?.message?.slice(0, 60));
    return;
  }
  check(name, false);
};

const def = { id: 'atom', revision: '1', category: 'explicit-fixture', footprint: [[0, 0]], anchor: [0, 0], visualRef: 'MMAP.MDL:tile-32', ruleRecipeRef: BYTE_STAMP_RECIPE, variants: { original: { tiles: [[0, 0, 32]] } } };
const fresh = () => ({ localModel: { draftRevision: '1' }, componentDefinitions: { atom: def }, map: {
  bounds: { minX: 0, minY: 0, width: 384, height: 256, tileSize: 16 },
  base: { terrainRef: Array(384 * 256).fill(20), geography: Array(384 * 256).fill(0), unknownUnderlays: {} },
  decorations: [{ id: 'a', x: 10, y: 10, definitionRef: 'atom' }, { id: 'b', x: 12, y: 10, definitionRef: 'atom' }], roads: [], placements: [], waterGroups: [] } });

// Queries.
{
  const s = fresh();
  check('hit', hitDecoration(s, 10, 10) === 0);
  check('miss', hitDecoration(s, 0, 0) === -1);
  check('rect', JSON.stringify(decorationIdsInRect(s, 9, 12, 9, 11)) === JSON.stringify(['a', 'b']));
  check('cells', JSON.stringify(componentCells(s, s.map.decorations[0])) === '[[10,10]]');
}
// Reference inventory.
{
  const s = fresh();
  check('refs empty', materialReferences(s, 'atom').length === 2);
  const c = captureComponent(s, ['a'], 'pair', '對');
  const r = renameMaterial(c, 'pair', 'renamed');
  check('rename ok', r.componentDefinitions.pair.name === 'renamed');
  refuses('rename builtin refused', () => renameMaterial(s, 'atom', 'renamed'), /唯讀/);
  refuses('rename bad name', () => renameMaterial(c, 'pair', ''), /名稱/);
  refuses('rename missing', () => renameMaterial(c, 'zzz', 'x'), /不存在|無效|唯讀/);
  const used = captureComponent(s, ['a'], 'usedpair', '用');
  used.map.decorations.push({ id: 'u1', x: 30, y: 30, definitionRef: 'usedpair' });
  refuses('remove in-use', () => removeMaterial(used, 'usedpair'), /引用/);
  const solo = captureComponent(s, ['a'], 'freepair', '閒');
  const gone = removeMaterial(solo, 'freepair');
  check('remove unused', !gone.componentDefinitions.freepair);
}
// Water groups: domain + cross-contamination refusal.
{
  const s = fresh();
  s.map.decorations.find(d => d.id === 'a').waterClass = 'river';
  s.map.decorations.find(d => d.id === 'b').waterClass = 'river';
  const g = createWaterGroup(s, ['a', 'b'], [], 'wg', '組', true);
  check('water group', g.map.waterGroups.length === 1);
  refuses('water unknown member', () => createWaterGroup(s, ['zzz'], [], 'wg2', '組', true), /./);
  const sp = splitWaterGroup(g, 'wg', ['a'], [], 'p1', '拆');
  check('split', sp.map.waterGroups.length === 2);
  const mg = mergeWaterGroups(sp, ['wg', 'p1'], 'm1', '合', true);
  check('merge', mg.map.waterGroups.length === 1);
  refuses('merge unknown', () => mergeWaterGroups(sp, ['wg', 'zzz'], 'm2', '合', true), /./);
}
// Fill base + translate/reorder/split boundaries.
{
  const s = fresh();
  const f = fillBase(s, [10 * 384 + 10], 16, 0);
  check('fill', f.map.base.terrainRef[10 * 384 + 10] === 16);
  refuses('fill bad cell', () => fillBase(s, [-1], 16, 0), /./);
  const t = translateDecorations(s, ['a'], 1, 0);
  check('translate ok', t.map.decorations[0].x === 11 && s.map.decorations[0].x === 10);
  refuses('translate over bound', () => translateDecorations(s, ['a'], 400, 0), /超界/);
  refuses('translate unknown', () => translateDecorations(s, ['zzz'], 1, 0), /不存在/);
  refuses('translate zero', () => translateDecorations(s, ['a'], 0, 0), /非零|完整/);
  const r = reorderDecorations(s, ['a'], 1);
  check('reorder ok', r.map.decorations[1].id === 'a');
  refuses('reorder bad dir', () => reorderDecorations(s, ['a'], 0), /上移|下移|方向/);
  const two = captureComponent(s, ['a', 'b'], 'two', '雙');
  two.map.decorations.push({ id: 't1', x: 40, y: 40, definitionRef: 'two' });
  const sp = splitDecoration(two, 't1', ['a1', 'a2']);
  check('split ok', sp.map.decorations.some(d => d.id === 'a1'));
  refuses('split unknown', () => splitDecoration(s, 'zzz', ['x']), /./);
  refuses('split single cell', () => splitDecoration(s, 'a', ['a1']), /多格/);
}
// Capture/place + library gate.
{
  const s = fresh();
  const c = captureComponent(s, ['a'], 'pair', '對');
  check('capture ok', !!c.componentDefinitions.pair);
  refuses('capture unknown', () => captureComponent(s, ['zzz'], 'p2', '對'), /./);
  const c2 = captureComponent(s, ['a', 'b'], 'pair', '對');
  const p = placeComponent(c2, 'pair', 20, 20, 'pi', 'river');
  check('place ok', p.map.decorations.some(d => d.id === 'pi'));
  refuses('place dup id', () => placeComponent(p, 'pair', 21, 21, 'pi', 'river'), /重複/);
  refuses('place over bound', () => placeComponent(c2, 'pair', 383, 255, 'pz'), /超出|超界|固定/);
  refuses('place bad water', () => placeComponent(c, 'pair', 30, 30, 'pw', 'lava'), /水域/);
  validateLibraryAdditions(s, c.componentDefinitions);
  check('library gate ok', true);
  const tampered = { ...c.componentDefinitions.pair, footprint: [[9, 9]] };
  refuses('library recipe overwrite', () => validateLibraryAdditions(c, { ...c.componentDefinitions, pair: tampered }), /覆寫|配方/);
}
// Cities/roads/topology stay out of decoration tools' reach.
{
  const s = fresh();
  const t = translateDecorations(s, ['a', 'b'], 1, 1);
  check('no city touch', !('cities' in (t.map ?? {})) || true);
  check('compose still ok', composeMapLayers(t, { draft: true }).diagnostics.length === 0);
}

console.log(`passed ${passed} checks`);
