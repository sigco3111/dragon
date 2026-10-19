// KI:286C/28B4 request ID3 only when the real road-action poll is due;
// KI:2B3F selects the visible phase from +03 & 3. No independent beat or
// five-sound budget. Audio I/O never writes rules or consumes their RNG.
const countdownOf = legion => legion?.engagementCountdown ?? legion?._engagement?.countdown;
function inContact(legion) {
  const countdown = countdownOf(legion);
  return !!legion?._engagement && !legion.dead && legion._active !== false &&
    Number.isInteger(countdown) && countdown > 0;
}

export class EngagementPresentation {
  constructor({ playSound = () => false, stopSound = () => {} } = {}) {
    this.playSound = playSound;
    this.stopSound = stopSound;
    this.contacts = new Set();
    this.frames = new Map();
    this.scenario = null;
    this.sounding = false;
    this.paused = false;
  }

  pause() {
    this.paused = true;
    if (this.sounding) {
      try {
        this.stopSound();
      } catch {
        /* Audio failure cannot affect rules. */
      }
      this.sounding = false;
    }
  }

  reset() {
    const changed = this.contacts.size > 0;
    this.pause();
    this.contacts.clear();
    this.frames.clear();
    this.scenario = null;
    return changed;
  }

  /** Called at the original sound-request branch, not inferred from RAF snapshots.
   * Same-ID retriggering is owned by the existing single-channel audio driver.
   * An unavailable audio context drops this request; no backlog or rule delay.
   */
  requestSound(scenario) {
    if (scenario !== this.scenario) {
      this.reset();
      this.scenario = scenario;
    }
    // The rule poll itself is the running-time authority. A stale paused RAF
    // snapshot must not suppress the first genuine request after resume.
    try {
      if (this.playSound() !== false) this.sounding = true;
    } catch {
      /* Retain ownership of an older sound for lifecycle cleanup. */
    }
  }

  /** Web lifecycle policy: holds/retirement stop current and pending voices.
   * Normal ending removes the effect immediately; never add a cosmetic battle
   * delay or extra sounds to complete a guessed count.
   */
  update(scenario, now, { enabled = true, paused = false } = {}) {
    if (!enabled || !scenario || !Number.isFinite(now)) return this.reset();
    let changed = false;
    if (scenario !== this.scenario) {
      changed = this.reset();
      this.scenario = scenario;
    }
    const contacts = new Set((scenario.legions ?? []).filter(inContact));
    if (!contacts.size) return this.reset() || changed;
    changed ||= contacts.size !== this.contacts.size ||
      [...contacts].some(legion => !this.contacts.has(legion));
    this.contacts = contacts;
    for (const legion of this.frames.keys()) {
      if (!contacts.has(legion)) this.frames.delete(legion);
    }
    if (paused) {
      this.pause();
      return changed;
    }
    this.paused = false;
    for (const legion of contacts) {
      const frame = countdownOf(legion) & 3;
      if (this.frames.get(legion) !== frame) changed = true;
      this.frames.set(legion, frame);
    }
    return changed;
  }

  frameOf(legion) {
    if (!this.contacts.has(legion) || !inContact(legion)) return null;
    return this.frames.get(legion) ?? (countdownOf(legion) & 3);
  }
}
