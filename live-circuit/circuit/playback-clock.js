// Captured offsets and a selected rate are the only clock inputs. A slow
// browser catches up; it never adds a fixed delay per receipt.
export class PlaybackClock {
  constructor(timeline, apply, changed, { now = () => performance.now(), set = (fn, delay) => setTimeout(fn, delay), clear = id => clearTimeout(id), frameMilliseconds = 100 } = {}) {
    Object.assign(this, { timeline, apply, changed, now, set, clear, frameMilliseconds });
    this.index = 0; this.position = 0; this.rate = 1; this.paused = true; this.done = false;
    this.wallElapsed = 0; this.timer = null;
  }
  cancel() { this.clear(this.timer); this.timer = null; }
  arm() {
    this.cancel();
    if (this.paused || this.done) return;
    const next = this.timeline.frames[this.index]?.at ?? this.timeline.duration;
    this.timer = this.set(() => this.tick(), Math.min(this.frameMilliseconds, Math.max(0, (next - this.position) / this.rate)));
  }
  tick() {
    if (this.paused || this.done) return;
    const elapsed = this.now() - this.wallBase;
    this.wallElapsed = this.wallAccumulated + elapsed;
    this.position = Math.min(this.timeline.duration, this.base + elapsed * this.rate);
    while (this.index < this.timeline.frames.length && this.timeline.frames[this.index].at <= this.position + 1e-7)
      this.apply(this.timeline.frames[this.index++]);
    this.done = this.index === this.timeline.frames.length;
    if (this.done) this.position = this.timeline.duration;
    this.arm(); this.changed();
  }
  resume() {
    if (this.done) return;
    this.base = this.position; this.wallBase = this.now(); this.wallAccumulated = this.wallElapsed;
    this.paused = false; this.tick();
  }
  pause() { this.tick(); this.paused = true; this.cancel(); this.changed(); }
  speed(rate) {
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid replay rate');
    const paused = this.paused; this.pause(); this.rate = rate;
    if (!paused) this.resume(); else this.changed();
  }
  next() {
    this.pause();
    if (!this.done) {
      this.stepped = true;
      const frame = this.timeline.frames[this.index++]; this.position = frame.at;
      this.apply(frame); this.done = this.index === this.timeline.frames.length;
    }
    this.changed();
  }
  // Callers reset their accumulated receipt prefix before seeking backwards.
  seek(position, reset) {
    if (!Number.isFinite(position)) throw new Error('Invalid replay position');
    this.cancel(); this.paused = true; reset(); this.index = 0;
    this.position = Math.max(0, Math.min(this.timeline.duration, position));
    while (this.index < this.timeline.frames.length && this.timeline.frames[this.index].at <= this.position)
      this.apply(this.timeline.frames[this.index++]);
    this.done = this.index === this.timeline.frames.length; this.stepped = true;
    this.wallElapsed = 0; this.changed();
  }
  get gap() {
    const next = this.timeline.frames[this.index]?.at ?? this.position;
    return Math.max(0, (next - this.position) / this.rate);
  }
}
