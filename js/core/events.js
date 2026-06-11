/* Tiny pub/sub event bus (docs/01). Widgets never call each other directly —
   they emit and listen here. Namespaced event names like 'object:changed'. */

const listeners = new Map(); // event -> Set<fn>

export const events = {
  /**
   * Subscribe. Returns an unsubscribe function.
   * @param {string} event
   * @param {(payload?: any) => void} fn
   * @returns {() => void}
   */
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },

  /**
   * Subscribe once.
   * @param {string} event
   * @param {(payload?: any) => void} fn
   */
  once(event, fn) {
    const off = this.on(event, (p) => { off(); fn(p); });
    return off;
  },

  /**
   * Emit to all subscribers. Errors in one listener never break the others.
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); }
      catch (err) { console.error(`[events] listener for "${event}" failed`, err); }
    }
  }
};
