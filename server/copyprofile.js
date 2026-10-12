// Content-only internal capability. NEVER a principal, persistent author grant or runtime certificate.
import { createHash } from 'node:crypto';
import { canonicalSourceTokens } from '../web/src/content/authoring/sourcejson.js';
import { normalizeGameMetadata } from '../web/src/editor/gamemetadata.js';
import { editChapterResources } from '../web/src/editor/chapterresources.js';
import { fail } from './security.js';
const resourceNames = Object.freeze(['money', 'reserve_cav', 'reserve_arc', 'reserve_inf']);
export const FIXED_COPY_PROFILE = 'fixed-copy-resources-1';
function view(value) {
  if (!value || typeof value !== 'object') fail(422, 'COPY_STRUCTURE');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !(array && proto === Array.prototype)) fail(422, 'COPY_STRUCTURE');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  for (const key of keys) {
    const d = descriptors[key];
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(d, 'value') || (!d.enumerable && !(array && key === 'length'))) fail(422, 'COPY_STRUCTURE');
  }
  if (array && (keys.length !== value.length + 1 || keys.some(key => key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))) fail(422, 'COPY_STRUCTURE');
  return descriptors;
}
function value(object, key) { const d = view(object)[key]; if (!d) fail(422, 'COPY_STRUCTURE'); return d.value; }
function digest(game) { const h = createHash('sha256'); for (const token of canonicalSourceTokens(game)) h.update(token, 'utf8'); return h.digest('hex'); }
// Chapter-edit allowlist (§4.5/B4a–B4c): the save pipeline applies validated
// ops before verification. Revert each applied op (reverse order) against
// baseline values on a clone; the final compare then proves nothing else
// changed. Resource fields (money/reserves) are never touched here, so the
// resource path below keeps working. Any structural surprise fails closed.
function revertAppliedChapterEdits(baseline, candidate, applied) {
  const edits = Array.isArray(applied) ? applied : [];
  if (!edits.length) return candidate;
  const reverted = structuredClone(candidate);
  const clone = (v) => structuredClone(v);
  const revChapters = reverted.chapters;
  if (!revChapters || typeof revChapters !== 'object' || Array.isArray(revChapters)) fail(422, 'COPY_PROTECTED_DELTA');
  const baseChapter = (id) => {
    const c = baseline.chapters?.[id];
    if (!c || typeof c !== 'object' || c.chapterId !== id) fail(422, 'COPY_PROTECTED_DELTA');
    return c;
  };
  const revChapter = (id) => {
    const c = revChapters[id];
    if (!c || typeof c !== 'object' || c.chapterId !== id) fail(422, 'COPY_PROTECTED_DELTA');
    return c;
  };
  const revGeneral = (chapter, idx) => {
    const list = chapter.state?.generals;
    if (!Array.isArray(list)) fail(422, 'COPY_PROTECTED_DELTA');
    const rec = list.find(g => g?.idx === idx);
    if (!rec || typeof rec !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    return rec;
  };
  const revFaction = (chapter, idx) => {
    const list = chapter.state?.factions;
    if (!Array.isArray(list)) fail(422, 'COPY_PROTECTED_DELTA');
    const rec = list.find(f => f?.idx === idx);
    if (!rec || typeof rec !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    return rec;
  };
  const baseGeneral = (chapterId, idx) => {
    const list = baseChapter(chapterId).state?.generals;
    const rec = Array.isArray(list) ? list.find(g => g?.idx === idx) : null;
    if (!rec || typeof rec !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    return rec;
  };
  // Narrow field restore for one general / one faction post.
  const revertGeneralFields = (chapterId, idx, keys) => {
    const rec = revGeneral(revChapter(chapterId), idx), base = baseGeneral(chapterId, idx);
    for (const key of keys) {
      if (base[key] === undefined) { delete rec[key]; }
      else rec[key] = clone(base[key]);
    }
  };
  const revertFactionPost = (chapterId, factionIdx, generalIdx, post) => {
    const faction = revFaction(revChapter(chapterId), factionIdx);
    const base = baseChapter(chapterId).state?.factions?.find(f => f?.idx === factionIdx);
    if (!base || typeof base !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    faction[post] = base[post] ?? null;
    if (generalIdx !== null && generalIdx !== undefined) revertGeneralFields(chapterId, generalIdx, ['faction']);
  };
  // Disband revert: re-add the faction record (resource fields overlaid from
  // the candidate so same-batch resource edits keep flowing) and restore
  // member/city membership from baseline.
  const revertDisband = (chapterId, factionIdx) => {
    const chapter = revChapter(chapterId);
    const base = baseChapter(chapterId);
    const record = base.state?.factions?.find(f => f?.idx === factionIdx);
    if (!record || typeof record !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    if (!chapter.state.factions.some(f => f?.idx === factionIdx)) {
      // Insert before the first present follower in baseline order (baseline
      // index is wrong when history already removed earlier factions).
      const order = (base.state?.factions ?? []).map(f => f?.idx);
      const after = order.slice(order.indexOf(factionIdx) + 1);
      const at = chapter.state.factions.findIndex(f => after.includes(f?.idx));
      if (at < 0) chapter.state.factions.push(clone(record));
      else chapter.state.factions.splice(at, 0, clone(record));
    }
    const baseGenerals = new Map((base.state?.generals ?? []).map(g => [g?.idx, g]));
    for (const g of chapter.state?.generals ?? []) {
      const b = baseGenerals.get(g?.idx);
      if (b && typeof b === 'object') g.faction = clone(b.faction ?? null);
    }
    const baseCities = new Map((base.state?.cities ?? []).map(c => [c?.idx, c]));
    for (const c of chapter.state?.cities ?? []) {
      const b = baseCities.get(c?.idx);
      if (b && typeof b === 'object') c.faction = clone(b.faction ?? null);
    }
  };
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i];
    if (!edit || typeof edit !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
    const { op, chapterId } = edit;
    if (op !== 'add-blank' && (typeof chapterId !== 'string' || !chapterId)) fail(422, 'COPY_PROTECTED_DELTA');
    if (op === 'rename') {
      revChapter(chapterId).name = baseChapter(chapterId).name;
    } else if (op === 'rename-general') {
      const keys = Object.keys(edit.values ?? {});
      if (!keys.length || keys.some(k => k !== 'name' && k !== 'hao')) fail(422, 'COPY_PROTECTED_DELTA');
      revertGeneralFields(chapterId, edit.generalIdx, keys);
    } else if (op === 'portrait') {
      const rec = revGeneral(revChapter(chapterId), edit.generalIdx);
      const base = baseGeneral(chapterId, edit.generalIdx);
      if (base.portraitKey === undefined) { delete rec.portraitKey; }
      else rec.portraitKey = clone(base.portraitKey);
    } else if (op === 'set-monarch') {
      revertFactionPost(chapterId, edit.factionIdx, edit.generalIdx, 'monarch_idx');
    } else if (op === 'set-strategist') {
      revertFactionPost(chapterId, edit.factionIdx, null, 'advisor_idx');
    } else if (op === 'remove-monarch') {
      const resolution = edit.resolution;
      if (!resolution || typeof resolution !== 'object') fail(422, 'COPY_PROTECTED_DELTA');
      if (resolution.disband === true) { revertDisband(chapterId, edit.factionIdx); }
      else {
        if (!Number.isInteger(resolution.successor)) fail(422, 'COPY_PROTECTED_DELTA');
        revertFactionPost(chapterId, edit.factionIdx, resolution.successor, 'monarch_idx');
      }
    } else if (op === 'disband-faction') {
      revertDisband(chapterId, edit.factionIdx);
    } else if (op === 'delete') {
      // Re-added below in baseline order (multi-delete positions).
      if (revChapters[chapterId] !== undefined) fail(422, 'COPY_PROTECTED_DELTA');
      baseChapter(chapterId);
    } else if (op !== 'add-blank' && op !== 'copy') {
      fail(422, 'COPY_PROTECTED_DELTA');
    }
  }
  // Deleted chapters: re-add pristine baseline clones in baseline order.
  for (const chapterId of baseline.chapterOrder ?? []) {
    if (revChapters[chapterId] === undefined && edits.some(e => e && e.op === 'delete' && e.chapterId === chapterId)) {
      revChapters[chapterId] = clone(baseChapter(chapterId));
    }
  }
  reverted.chapterOrder = [...(baseline.chapterOrder ?? [])].concat((reverted.chapterOrder ?? []).filter(id => !(baseline.chapterOrder ?? []).includes(id)));
  // Added chapters (generated ids): each must be a pristine blank or a
  // pristine copy of its source; then remove them for the final compare.
  const baseOrder = new Set(baseline.chapterOrder ?? []);
  const added = (reverted.chapterOrder ?? []).filter(id => !baseOrder.has(id));
  const structural = edits.filter(e => e && (e.op === 'add-blank' || e.op === 'copy'));
  if (added.length !== structural.length) fail(422, 'COPY_PROTECTED_DELTA');
  for (const id of added) {
    const chapter = revChapters[id];
    const isBlank = chapter && chapter.name === '新章节' && Array.isArray(chapter.state?.factions) && !chapter.state.factions.length && Array.isArray(chapter.state?.generals) && !chapter.state.generals.length && Array.isArray(chapter.state?.cities) && !chapter.state.cities.length;
    if (!isBlank) {
      const copies = structural.filter(e => e.op === 'copy' && typeof e.chapterId === 'string');
      const matched = copies.some(e => {
        let base;
        try { base = baseChapter(e.chapterId); } catch { return false; }
        // Order-insensitive: snapshot roundtrip sorts keys, baseline keeps
        // loader insertion order; reuse the structural compare instead of
        // stringify so key order can never false-fail.
        const { chapterId: _a, name: _b, sourceChapterId: _c, ...rest } = chapter;
        const { chapterId: _d, name: _e, sourceChapterId: _f, ...baseRest } = base;
        try { compare(baseRest, rest, new WeakMap()); return true; } catch { return false; }
      });
      if (!matched) fail(422, 'COPY_PROTECTED_DELTA');
    }
    delete revChapters[id];
    reverted.chapterOrder = reverted.chapterOrder.filter(entry => entry !== id);
  }
  return reverted;
}
function freezeGraph(root) {
  const pending = [root], seen = new WeakSet();
  while (pending.length) { const node = pending.pop(); if (!node || typeof node !== 'object' || seen.has(node)) continue; seen.add(node); for (const d of Object.values(view(node))) if (d.value && typeof d.value === 'object') pending.push(d.value); Object.freeze(node); }
  return root;
}
function compare(expected, candidate, replacements) {
  const stack = [[expected, candidate, 0]];
  while (stack.length) {
    let [a, b, depth] = stack.pop(); if (a && typeof a === 'object' && replacements.has(a)) a = replacements.get(a);
    if (Object.is(a, b)) continue;
    if (depth > 64 || !a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) fail(422, 'COPY_PROTECTED_DELTA');
    const ad = view(a), bd = view(b), ak = Object.keys(ad).sort(), bk = Object.keys(bd).sort();
    if (ak.length !== bk.length || ak.some((key, i) => key !== bk[i])) fail(422, 'COPY_PROTECTED_DELTA');
    for (const key of ak) stack.push([ad[key].value, bd[key].value, depth + 1]);
  }
}
export class FixedCopyProfile {
  #load; #captures = new WeakMap();
  constructor({ loadCopy }) { if (typeof loadCopy !== 'function') throw new TypeError('service-owned pinned copy loader required'); this.#load = loadCopy; }
  async capture(context) {
    // Constructor port is trusted code, not an HTTP descriptor/APPROVED marker.
    const loaded = await this.#load(context), baseline = loaded.game;
    const baselineDigest = digest(baseline); freezeGraph(baseline);
    const capability = Object.freeze({});
    const provenance = freezeGraph(structuredClone(loaded.provenance));
    this.#captures.set(capability, { baseline, baselineDigest, provenance });
    return Object.freeze({ capability, game: baseline, baselineDigest, provenance });
  }
  verify(capability, candidate, appliedEdits = []) {
    const captured = this.#captures.get(capability); if (!captured) fail(403, 'COPY_CAPTURE_REQUIRED');
    const { baseline, baselineDigest, provenance } = captured, replacements = new WeakMap(), changes = [];
    // No getters execute: validate descriptors before reading any candidate field.
    const metadata = value(candidate, 'metadata'); view(metadata);
    let normalized; try { normalized = normalizeGameMetadata(metadata); } catch { fail(422, 'COPY_METADATA'); }
    if (metadata.name !== normalized.name || metadata.introduction !== normalized.introduction) fail(422, 'COPY_METADATA');
    replacements.set(baseline.metadata, normalized);
    const chapters = value(candidate, 'chapters'); view(chapters);
    const reverted = revertAppliedChapterEdits(baseline, candidate, appliedEdits);
    const revertedChapters = value(reverted, 'chapters'); view(revertedChapters);
    for (const chapterId of baseline.chapterOrder) {
      const oldState = baseline.chapters[chapterId].state, state = value(value(revertedChapters, chapterId), 'state');
      const factions = value(state, 'factions'); view(factions);
      if (!Array.isArray(factions) || factions.length !== oldState.factions.length) fail(422, 'COPY_PROTECTED_DELTA');
      let shell = { gameId: baseline.gameId, sourceRef: baseline.sourceRef, chapterOrder: [chapterId], chapters: { [chapterId]: { chapterId, state: { factions: oldState.factions, nativeFactionSlotRaw: oldState.nativeFactionSlotRaw } } } };
      for (let slot = 0; slot < oldState.factions.length; slot++) {
        const row = value(factions, String(slot)), requested = Object.fromEntries(resourceNames.map(name => [name, value(row, name)]));
        try { shell = editChapterResources(shell, chapterId, slot, requested); } catch { fail(422, 'COPY_RESOURCE_DELTA'); }
        const names = resourceNames.filter(name => requested[name] !== oldState.factions[slot][name]);
        if (names.length) changes.push(Object.freeze({ chapterId, slot, fields: Object.freeze(names) }));
      }
      replacements.set(oldState.factions, shell.chapters[chapterId].state.factions);
      replacements.set(oldState.nativeFactionSlotRaw, shell.chapters[chapterId].state.nativeFactionSlotRaw);
    }
    compare(baseline, reverted, replacements);
    const sourceDigest = digest(candidate); // Strict canonical JSON after protected delta checks.
    return Object.freeze({ profileRevision: FIXED_COPY_PROFILE, baselineDigest, sourceDigest, provenance, changes: Object.freeze(changes), limits: 'Content-only captured full-copy profile; signed24/u16 representation not playable-input admission. No map/newchapter/role/image/runtime permission; no principal or persistent grant.' });
  }
}
