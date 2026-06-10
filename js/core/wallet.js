/* The coin wallet (docs/07). One raw copper integer in meta; the four
   denominations (copper/silver/gold/platinum, 10:1 chain) are display-only. */

import { store } from './store.js';
import { events } from './events.js';

export const wallet = {
  /** @returns {number} balance in raw copper. */
  get() { return store.getMeta('wallet', 0); },

  /** Credit copper (earnings always enter as copper-equivalent). */
  add(copper, reason = '') {
    if (!copper) return;
    store.setMeta('wallet', this.get() + Math.max(0, Math.round(copper)));
    events.emit('wallet:changed', { delta: copper, reason });
  },

  /** Spend copper. @returns {boolean} false if balance is insufficient. */
  spend(copper) {
    copper = Math.round(copper);
    if (this.get() < copper) return false;
    store.setMeta('wallet', this.get() - copper);
    events.emit('wallet:changed', { delta: -copper });
    return true;
  },

  /** @returns {{p: number, g: number, s: number, c: number}} display breakdown. */
  split(copper = this.get()) {
    return {
      p: Math.floor(copper / 1000),
      g: Math.floor((copper % 1000) / 100),
      s: Math.floor((copper % 100) / 10),
      c: copper % 10
    };
  },

  /** Render "1g 2s 3c" (skips zero denominations; "0c" when empty). */
  format(copper = this.get()) {
    const { p, g, s, c } = this.split(copper);
    const parts = [];
    if (p) parts.push(`${p}p`);
    if (g) parts.push(`${g}g`);
    if (s) parts.push(`${s}s`);
    if (c || !parts.length) parts.push(`${c}c`);
    return parts.join(' ');
  }
};
