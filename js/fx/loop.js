/* The single shared requestAnimationFrame loop (docs/01).
   All canvas effects register a tick here. The loop sleeps when no tasks are
   registered and when the document is hidden — zero idle cost. */

const tasks = new Set();
let running = false;
let last = 0;

function frame(now) {
  if (!tasks.size || document.hidden) { running = false; return; }
  const dt = Math.min(0.05, (now - last) / 1000); // clamp long gaps (tab naps)
  last = now;
  for (const fn of [...tasks]) {
    try { fn(dt, now); }
    catch (err) { console.error('[loop] task failed, removing', err); tasks.delete(fn); }
  }
  requestAnimationFrame(frame);
}

function wake() {
  if (running || !tasks.size || document.hidden) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', wake);

export const loop = {
  /**
   * Register a per-frame task. Returns an unsubscribe function.
   * @param {(dt: number, now: number) => void} fn dt in seconds
   * @returns {() => void}
   */
  add(fn) {
    tasks.add(fn);
    wake();
    return () => tasks.delete(fn);
  },

  /** Nudge the loop awake (e.g. after re-enabling an effect). */
  wake
};
