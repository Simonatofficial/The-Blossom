/* Blossoms — the flagship cozy clicker/sim widget (docs/13 §21, MVP).
   This file owns widget registration, the per-widget game controller (one live
   game per widget id, ticked by the shared fx loop), autosave, and the card
   view. The full-page game lives in blossoms-ui.js (lazy-loaded). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { loop } from '../fx/loop.js';
import { el, toast } from '../ui/components.js';
import { RESOURCES, TIERS } from './blossoms-data.js';
import * as E from './blossoms-engine.js';

/* ---- live game controllers (shared across card + full-page) ---- */
const games = new Map(); // widgetId -> { widget, g, subs:Set, saveAcc, away }
let ticking = false;

/** Get (or lazily create + offline-catch-up) the live game for a widget. */
export function gameFor(widget) {
  let ctl = games.get(widget.id);
  if (!ctl) {
    const g = widget.config.game ? E.deserialize(widget.config.game) : E.createGame();
    ctl = { widget, g, subs: new Set(), saveAcc: 0, away: E.applyOffline(g) };
    games.set(widget.id, ctl);
    if (ctl.away) save(ctl);
    ensureTick();
  }
  return ctl;
}

export function save(ctl) {
  ctl.widget.config.game = E.serialize(ctl.g);
  store.put('widgets', ctl.widget);
}
function notify(ctl) { for (const fn of [...ctl.subs]) fn(ctl); }
/** Subscribe a refresh fn to a game; it auto-unsubscribes once its node detaches. */
export function subscribe(ctl, node, fn) {
  const wrapped = () => { if (!node.isConnected) { ctl.subs.delete(wrapped); return; } fn(ctl); };
  ctl.subs.add(wrapped);
  return wrapped;
}

function ensureTick() {
  if (ticking) return;
  ticking = true;
  let acc = 0;
  loop.add((dt) => {
    if (!games.size) return;
    const doNotify = (acc += dt) >= 0.12; if (doNotify) acc = 0;
    for (const ctl of games.values()) {
      const tieredUp = E.tick(ctl.g, dt);
      if (tieredUp) { toast(`Your settlement grew into a ${TIERS[ctl.g.tier].name}! ${TIERS[ctl.g.tier].emoji}`, 'flower'); save(ctl); }
      if ((ctl.saveAcc += dt) >= 60) { ctl.saveAcc = 0; save(ctl); }
      if (doNotify) notify(ctl);
    }
  });
  // never lose progress: flush every game on hide / unload
  document.addEventListener('visibilitychange', () => { if (document.hidden) games.forEach(save); });
  addEventListener('pagehide', () => games.forEach(save));
}

/* ---- shared view helpers (used here + in blossoms-ui.js) ---- */

/** Compact number: 950, 1.2k, 3.4M. */
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
}

/** A cute theme-tinted SVG blossom (the tap target). */
export function blossomSVG(size = 96) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <g fill="var(--accent)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="25" rx="15" ry="23" transform="rotate(${a} 50 50)"/>`).join('')}</g>
    <circle cx="50" cy="50" r="15" fill="var(--highlight)"/>
    <circle cx="50" cy="50" r="7.5" fill="var(--warn)"/>
  </svg>`;
}

/** Floating "+N" that rises and fades from the tap point. */
export function popFloat(container, text) {
  const f = el(`<span class="bl-float">${text}</span>`);
  f.style.left = (38 + Math.random() * 24) + '%';
  container.appendChild(f);
  setTimeout(() => f.remove(), 850);
}

/** A compact Food/Wood/Ore chip row. */
export function resBar(g) {
  return ['food', 'wood', 'ore'].map(k => `<span class="bl-chip">${RESOURCES[k].emoji} ${fmt(g[k])}</span>`).join('');
}

/** Tap handler shared by card + full-page: tap, pop a +N, bounce, refresh. */
export function doTap(ctl, tapBtn, floatHost) {
  E.tap(ctl.g);
  popFloat(floatHost, '+' + fmt(E.tapValue(ctl.g)));
  tapBtn.classList.remove('bl-pop'); void tapBtn.offsetWidth; tapBtn.classList.add('bl-pop');
  notify(ctl);
}

function showAway(ctl) {
  if (!ctl.away) return;
  const g = ctl.away.gained;
  const parts = ['blossom', 'food', 'wood', 'ore'].filter(k => g[k]).map(k => `+${fmt(g[k])} ${RESOURCES[k].emoji}`);
  if (parts.length) toast(`While you were away: ${parts.join('  ')}`, 'flower');
  ctl.away = null;
}

/* ---- widget registration ---- */

registry.register({
  type: 'blossoms',
  name: 'Blossoms',
  icon: 'flower',
  description: 'A cozy garden-kingdom clicker — tap, build, and grow',
  keywords: ['game', 'games', 'blossoms', 'clicker', 'idle', 'kingdom', 'village', 'sim'],
  external: true, internal: true,
  defaultConfig: () => ({ game: E.serialize(E.createGame()) }),

  renderCard(host, widget, ctx) {
    const ctl = gameFor(widget);
    host.innerHTML = '';
    const card = el(`<div class="bl-card">
      <button class="bl-tap" aria-label="Tap the Blossom">${blossomSVG(92)}</button>
      <div class="bl-count"><span class="bl-n"></span> 🌸</div>
      <div class="row bl-resrow" style="gap:6px;justify-content:center;flex-wrap:wrap"></div>
      <button class="btn bl-open" style="width:100%">Open garden →</button>
    </div>`);
    const tapBtn = card.querySelector('.bl-tap');
    const floatHost = card.querySelector('.bl-tap');
    tapBtn.addEventListener('click', () => doTap(ctl, tapBtn, floatHost));
    card.querySelector('.bl-open').onclick = () => ctx.openInternal(widget);
    const refresh = () => {
      card.querySelector('.bl-n').textContent = fmt(ctl.g.blossom);
      card.querySelector('.bl-resrow').innerHTML = resBar(ctl.g);
    };
    subscribe(ctl, card, refresh);
    refresh();
    host.appendChild(card);
    showAway(ctl);
  },

  renderFull(host, widget, ctx) {
    const ctl = gameFor(widget);
    showAway(ctl);
    import('./blossoms-ui.js').then(m => m.renderGame(host, ctl, ctx))
      .catch(err => { console.error('[blossoms] full view failed', err); host.appendChild(el('<p class="soft" style="padding:20px">The garden could not open.</p>')); });
  }
});
