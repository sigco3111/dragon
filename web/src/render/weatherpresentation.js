import { loadImage } from "../core/assets.js";
import { createPresentationImageResources } from './presentationimages.js';

const SLOTS = 16;
const WIDTH = 256, HEIGHT = 144;

export class WeatherPresentation {
  constructor(resourcePorts = null) {
    this.imageResources = resourcePorts === null ? null : createPresentationImageResources(resourcePorts);
    this.imageLoadGeneration = 0;
    this.scenario = null;
    this.clouds = Array(SLOTS).fill(null);
    this.frames = [];
    this.objectFrames = new Map();
    this.prepared = false;
    this.changed = false;
  }

  async preload() {
    if (this.imageResources) {
      const generation = ++this.imageLoadGeneration;
      this.frames = [];
      const frames = await this.imageResources.loadImages(Array.from({ length: 8 }, (_, frame) => `grf/weather/cloud_frame_${frame}.png`));
      this.imageResources.assertCurrent();
      if (generation !== this.imageLoadGeneration) throw new Error('WEATHER_IMAGES_STALE');
      this.frames = frames;
      return;
    }
    this.frames = await Promise.all(Array.from({ length: 8 }, (_, frame) =>
      loadImage(`grf/weather/cloud_frame_${frame}.png`)));
  }

  disposeImageResources() {
    this.imageLoadGeneration++;
    this.frames = [];
    this.imageResources?.close();
  }

  reset() {
    this.scenario = null;
    this.clouds.fill(null);
    this.objectFrames.clear();
    this.prepared = false;
    this.changed = false;
  }

  pause() {} // No independent wall clock or resume debt.

  /** Receives the OLD-frame snapshot from explicit KI:2533 preparation.
   * Called after each completed rule/calendar return, not from draw(). */
  capture(scenario, clock, frames) {
    if (scenario !== this.scenario) {
      this.reset();
      this.scenario = scenario;
    }
    const previousFrames = this.objectFrames;
    this.objectFrames = new Map();
    for (let slot = 0; slot < 32; slot++) {
      const source = slot < SLOTS ? scenario.disasterMapObjects[slot] : scenario.weatherClouds[slot - SLOTS];
      if (previousFrames.get(source) !== frames[slot]) this.changed = true;
      this.objectFrames.set(source, frames[slot]);
      if (slot < SLOTS) continue;
      const index = slot - SLOTS;
      let cloud = this.clouds[index];
      if (frames[slot] === null || source.group !== 0) {
        if (cloud) this.changed = true;
        this.clouds[index] = null;
        continue;
      }
      const interval = source.interval || 256; // byte DEC 0 expires after 256 updates.
      if (!cloud || cloud.source !== source) {
        cloud = this.clouds[index] = { source, x: source.x, y: source.y,
          fromX: source.x, fromY: source.y, sourceX: source.x, sourceY: source.y,
          serial: clock.strategicTickSerial, interval, alpha: 1 };
        this.changed = true;
      } else if (source.x !== cloud.sourceX || source.y !== cloud.sourceY) {
        // Each 248A axis moves at most one tile; physical wrap is a relocation.
        const wrap = Math.abs(source.x - cloud.sourceX) > 1 || Math.abs(source.y - cloud.sourceY) > 1;
        cloud.fromX = wrap ? source.x : cloud.sourceX;
        cloud.fromY = wrap ? source.y : cloud.sourceY;
        cloud.sourceX = source.x;
        cloud.sourceY = source.y;
        cloud.serial = clock.strategicTickSerial;
        cloud.interval = interval;
        this.changed = true;
      }
      cloud.frame = frames[slot];
    }
    this.prepared = true;
  }

  frameOf(object) {
    return this.objectFrames.has(object) ? this.objectFrames.get(object) : object.frame;
  }

  update(scenario, _now, { enabled = true, clock = null } = {}) {
    this.imageResources?.assertCurrent();
    this.prepared = false;
    if (!enabled || scenario !== this.scenario || !clock) return false;
    let changed = this.changed;
    this.changed = false;
    const serial = clock.strategicTickSerial + clock.dayProgress();
    for (const cloud of this.clouds) {
      if (!cloud) continue;
      const t = Math.max(0, Math.min(1, (serial - cloud.serial) / cloud.interval));
      const x = cloud.fromX + (cloud.sourceX - cloud.fromX) * t;
      const y = cloud.fromY + (cloud.sourceY - cloud.fromY) * t;
      if (x !== cloud.x || y !== cloud.y) changed = true;
      cloud.x = x;
      cloud.y = y;
    }
    return changed;
  }

  /** 原帧已含云体、雨丝及透明区域，不重画、不额外叠加粒子。 */
  draw(ctx, camera, tileSize, viewport) {
    this.imageResources?.assertCurrent();
    for (const cloud of this.clouds) {
      if (!cloud) continue;
      const image = this.frames[cloud.frame];
      if (!image) continue;
      const x = camera.x + (cloud.x - 8) * tileSize * camera.scale;
      const y = camera.y + (cloud.y - 4) * tileSize * camera.scale;
      if (x >= viewport.width || y >= viewport.height ||
          x + WIDTH * camera.scale <= 0 || y + HEIGHT * camera.scale <= 0) continue;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, x, y, WIDTH * camera.scale, HEIGHT * camera.scale);
      ctx.restore();
    }
  }
}
