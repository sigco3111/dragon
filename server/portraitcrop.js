// Server-side square-crop to normalized 128x128 portrait output (Trial opt-in).
// Web product decision (2026-10-09 author-confirmed crop, not a DOS mechanism):
// the author selects a square region with preview+confirm; the server applies it
// after bounded full decode and re-encodes canonical 128x128 RGBA PNG.
// No caller-controlled budgets: crop runs inside the already-decoded pixel
// buffer, so existing PNG/JPEG decode budgets are unchanged. No EXIF/orientation
// handling: decoded RGBA pixels carry no metadata by construction.
export const PORTRAIT_CROP_OUTPUT = 128;
export class PortraitCropError extends Error {}
const reject = () => { throw new PortraitCropError('Invalid portrait crop rectangle'); };
// Shape gate only (usable before decode/dimensions are known): exact keys and
// integer types with non-negative origin and positive side. Bounds against
// decoded geometry are enforced by checkCropRect after decode.
export function checkCropShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { reject(); }
  if (Object.keys(value).length !== 3 || !Object.hasOwn(value, 'x') || !Object.hasOwn(value, 'y') || !Object.hasOwn(value, 'side')) { reject(); }
  const { x, y, side } = value;
  for (const n of [x, y, side]) { if (!Number.isInteger(n)) { reject(); } }
  if (side < 1 || x < 0 || y < 0) { reject(); }
}
export function checkCropRect(value, width, height) {
  checkCropShape(value);
  const { x, y, side } = value;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) { reject(); }
  if (side < 1 || x < 0 || y < 0 || x + side > width || y + side > height) { reject(); }
  return Object.freeze({ x, y, side });
}
// Nearest-neighbor square-to-128 resample with pure integer arithmetic:
// out[dy][dx] = in[y + floor(dy*side/128)][x + floor(dx*side/128)].
// Deterministic and exactly testable; no smoothing kernel is invented here.
export function cropSquareTo128(pixels, width, height, rect) {
  const checked = checkCropRect(rect, width, height);
  if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 4) { reject(); }
  const out = new Uint8Array(PORTRAIT_CROP_OUTPUT * PORTRAIT_CROP_OUTPUT * 4);
  for (let dy = 0; dy < PORTRAIT_CROP_OUTPUT; dy++) {
    const sy = checked.y + Math.floor(dy * checked.side / PORTRAIT_CROP_OUTPUT);
    for (let dx = 0; dx < PORTRAIT_CROP_OUTPUT; dx++) {
      const sx = checked.x + Math.floor(dx * checked.side / PORTRAIT_CROP_OUTPUT);
      const from = (sy * width + sx) * 4, to = (dy * PORTRAIT_CROP_OUTPUT + dx) * 4;
      out[to] = pixels[from]; out[to + 1] = pixels[from + 1]; out[to + 2] = pixels[from + 2]; out[to + 3] = pixels[from + 3];
    }
  }
  return { width: PORTRAIT_CROP_OUTPUT, height: PORTRAIT_CROP_OUTPUT, pixels: out };
}
