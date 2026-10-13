// Server-only JPEG boundary: fixed-128 library and bounded Trial source geometry.
// No caller-controlled budgets or process sandbox.
// T.81 Annex B/C/E/F/G: complete segments/tables, single frame, scan sequencing,
// restart syntax and padding. Wrapper budgets are engineering limits, not DOS rules.
import { decode } from './vendor/jpeg-js/decoder.js';
export class PortraitJPEGError extends Error {}
const reject = () => { throw new PortraitJPEGError('Invalid or unsupported portrait JPEG'); };
const requireJPEG = condition => { if (!condition) { reject(); } };
export const JPEG_LIMITS = Object.freeze({ bytes: 100 * 1024, segments: 256, scans: 64, memoryMiB: 4, sourcePixels: 128 * 128, sourceSide: 8192 });

function tables(data, kind, quant, huffman, usedQuant) {
  let at = 0;
  while (at < data.length) {
    const spec = data[at++], id = spec & 15, type = spec >> 4;
    requireJPEG(id <= 3);
    if (kind === 0xdb) {
      requireJPEG(type === 0 && at + 64 <= data.length && !usedQuant.has(id));
      for (const value of data.subarray(at, at + 64)) { requireJPEG(value > 0); }
      at += 64; quant.add(id);
    } else {
      requireJPEG(type <= 1 && at + 16 <= data.length);
      let count = 0, available = 1;
      for (let size = 0; size < 16; size++) {
        const n = data[at + size]; count += n; available = available * 2 - n;
        // The all-1 word must remain unused (Annex C); no overfull/empty tree.
        requireJPEG(available > 0);
      }
      at += 16; requireJPEG(count > 0 && count <= 256 && at + count <= data.length);
      const values = data.subarray(at, at + count); requireJPEG(new Set(values).size === count);
      for (const value of values) {
        if (type === 0) { requireJPEG(value <= 11); }
        else { requireJPEG((value & 15) <= 10); }
      }
      at += count; huffman.add(spec);
    }
  }
  requireJPEG(at === data.length && at > 0);
}

// Preflight makes all header allocation/iteration inputs bounded before codec work.
// APP/COM are never passed to the codec, so EXIF/comments/thumbnails cannot escape.
function preflightJPEG(bytes, sourceGeometry) {
  requireJPEG(bytes instanceof Uint8Array && bytes.length >= 4 && bytes.length <= JPEG_LIMITS.bytes);
  requireJPEG(bytes[0] === 0xff && bytes[1] === 0xd8);
  const clean = [bytes.subarray(0, 2)], quant = new Set(), usedQuant = new Set(), huffman = new Set();
  let at = 2, frame = null, scans = 0, segments = 0, restart = 0, jfif = false, adobe = null;
  const word = pos => (bytes[pos] << 8) | bytes[pos + 1];
  while (at < bytes.length) {
    requireJPEG(++segments <= JPEG_LIMITS.segments && bytes[at] === 0xff);
    while (bytes[at] === 0xff) { at++; }
    requireJPEG(at < bytes.length);
    const marker = bytes[at++], start = at - 2;
    if (marker === 0xd9) {
      requireJPEG(at === bytes.length && frame && scans > 0);
      for (const component of frame.components) { requireJPEG(component.state.every(n => n >= 0)); }
      clean.push(bytes.subarray(start, at));
      const ids = frame.components.map(c => c.id);
      let colorTransform = true;
      if (ids.length === 3) {
        const rgb = ids.join(',') === '82,71,66', ycbcr = ids.join(',') === '1,2,3';
        requireJPEG(rgb || ycbcr);
        requireJPEG(!(jfif && (rgb || adobe === 0)) && !(rgb && adobe === 1));
        colorTransform = !rgb && adobe !== 0;
      } else { requireJPEG(adobe === null && frame.components[0].h === 1 && frame.components[0].v === 1); }
      return { data: Buffer.concat(clean), width: frame.width, height: frame.height, scans, colorTransform };
    }
    requireJPEG(at + 2 <= bytes.length);
    const size = word(at); requireJPEG(size >= 2 && at + size <= bytes.length);
    const end = at + size, data = bytes.subarray(at + 2, end); at = end;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
      // Refuse unsupported color management / MPO instead of silently dropping it.
      if (marker === 0xe2) { requireJPEG(!Buffer.from(data).subarray(0, 12).equals(Buffer.from('ICC_PROFILE\0')) && !Buffer.from(data).subarray(0, 4).equals(Buffer.from('MPF\0'))); }
      if (marker === 0xe0 && Buffer.from(data).subarray(0, 5).equals(Buffer.from('JFIF\0'))) {
        requireJPEG(!jfif && data.length >= 14 && data.length === 14 + data[12] * data[13] * 3); jfif = true;
      }
      if (marker === 0xee) {
        requireJPEG(adobe === null && data.length === 12 && Buffer.from(data).subarray(0, 5).equals(Buffer.from('Adobe')) && data[11] <= 1); adobe = data[11];
      }
      continue;
    }
    if (marker === 0xdb || marker === 0xc4) { tables(data, marker, quant, huffman, usedQuant); }
    else if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      requireJPEG(!frame && scans === 0 && data.length >= 6 && data[0] === 8);
      const height = (data[1] << 8) | data[2], width = (data[3] << 8) | data[4], count = data[5];
      // Trial may retain a rectangle, but never expands the existing pixel or
      // allocation budget. Fixed-128 library callers keep their exact size gate.
      const dimensions = sourceGeometry
        ? width > 0 && height > 0 && width <= JPEG_LIMITS.sourceSide && height <= JPEG_LIMITS.sourceSide && width * height <= JPEG_LIMITS.sourcePixels
        : width === 128 && height === 128;
      requireJPEG(dimensions && (count === 1 || count === 3) && data.length === 6 + count * 3);
      const components = [];
      for (let i = 0; i < count; i++) {
        const id = data[6 + i * 3], sampling = data[7 + i * 3], q = data[8 + i * 3], h = sampling >> 4, v = sampling & 15;
        requireJPEG(!components.some(c => c.id === id) && h >= 1 && h <= 4 && v >= 1 && v <= 4 && q <= 3);
        components.push({ id, h, v, q, state: new Int8Array(64).fill(-1) });
      }
      requireJPEG(components.reduce((n, c) => n + c.h * c.v, 0) <= 10);
      frame = { marker, width, height, components };
    } else if (marker === 0xdd) { requireJPEG(data.length === 2); restart = (data[0] << 8) | data[1]; }
    else if (marker === 0xda) {
      requireJPEG(frame && ++scans <= JPEG_LIMITS.scans && data.length >= 6);
      const count = data[0]; requireJPEG(count >= 1 && count <= frame.components.length && data.length === 4 + 2 * count);
      const ss = data[data.length - 3], se = data[data.length - 2], ah = data.at(-1) >> 4, al = data.at(-1) & 15;
      const progressive = frame.marker === 0xc2;
      requireJPEG(ss <= se && se <= 63 && ah <= 13 && al <= 13);
      if (progressive) { requireJPEG((ss === 0 ? se === 0 : count === 1) && (ah === 0 || ah === al + 1)); }
      else { requireJPEG(ss === 0 && se === 63 && ah === 0 && al === 0); }
      let lastIndex = -1;
      for (let i = 0; i < count; i++) {
        const id = data[1 + i * 2], spec = data[2 + i * 2], dc = spec >> 4, ac = spec & 15;
        const index = frame.components.findIndex(c => c.id === id); requireJPEG(index > lastIndex); lastIndex = index;
        const component = frame.components[index]; requireJPEG(quant.has(component.q)); usedQuant.add(component.q);
        requireJPEG(dc <= 3 && ac <= 3 && (frame.marker !== 0xc0 || (dc <= 1 && ac <= 1)));
        if (!progressive || ss === 0) { requireJPEG(ah > 0 || huffman.has(dc)); }
        if (!progressive || ss > 0) { requireJPEG(huffman.has(0x10 | ac)); }
        requireJPEG(!progressive || ss === 0 || component.state[0] >= 0);
        for (let k = ss; k <= se; k++) { requireJPEG(ah === 0 ? component.state[k] === -1 : component.state[k] === ah); component.state[k] = al; }
      }
      clean.push(bytes.subarray(start, end));
      const entropyStart = at; let rst = 0;
      while (at < bytes.length) {
        if (bytes[at] !== 0xff) { at++; continue; }
        let next = at + 1; while (bytes[next] === 0xff) { next++; }
        requireJPEG(next < bytes.length);
        const code = bytes[next];
        if (code === 0) { requireJPEG(next === at + 1); at = next + 1; continue; }
        if (code >= 0xd0 && code <= 0xd7) { requireJPEG(restart > 0 && code === 0xd0 + (rst++ & 7)); at = next + 1; continue; }
        break;
      }
      requireJPEG(at > entropyStart && at < bytes.length); clean.push(bytes.subarray(entropyStart, at)); continue;
    } else { reject(); } // No lossless/arithmetic/hierarchy/DNL/recovery/unknown markers.
    clean.push(bytes.subarray(start, end));
  }
  reject();
}

export function preflightPortraitJPEG(bytes) { return preflightJPEG(bytes, false); }

function decodePixels(input) {
  let decoded;
  try {
    // Synchronous, non-reentrant byte-array-only call. Module allocation counter
    // resets every call; 4MiB is an estimate, not a hard isolate/RSS/CPU limit.
    decoded = decode(input.data, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, colorTransform: input.colorTransform, maxResolutionInMP: 0.016384, maxMemoryUsageInMB: JPEG_LIMITS.memoryMiB });
  } catch (cause) { throw new PortraitJPEGError('JPEG entropy/pixel decode failed', { cause }); }
  requireJPEG(decoded.width === input.width && decoded.height === input.height && decoded.data instanceof Uint8Array && decoded.data.length === input.width * input.height * 4);
  return { width: decoded.width, height: decoded.height, pixels: decoded.data };
}

export function decodePortraitJPEG(bytes) { return decodePixels(preflightPortraitJPEG(bytes)); }
// Trial-only supported source subset. Oversize/unsupported inputs fail closed;
// this is not the product's eventual arbitrary-source/crop/128-output contract.
export function decodeTrialPortraitJPEG(bytes) { return decodePixels(preflightJPEG(bytes, true)); }
