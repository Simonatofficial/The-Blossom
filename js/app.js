/* Boot (docs/01): store init → theme → shell → engine → router → render.
   Also: day-rollover hooks, first-run seeding, service worker registration. */

import { store } from './core/store.js';
import { events } from './core/events.js';
import { router } from './core/router.js';
import { registry } from './widgets/registry.js';
import './widgets/all.js';
import { makeCtx } from './widgets/base.js';
import { applyGlobalTheme, activeThemeId, activeTheme, applyEffects } from './fx/themes.js';
import { initParticles } from './fx/particles.js';
import { initAtmosphere } from './fx/atmosphere.js';
import { initShell } from './ui/shell.js';
import { initEngine } from './modules/engine.js';
import { initSaves, checkDayRollover, maybeBackupReminder } from './core/saves.js';
import { initOnboarding } from './ui/onboarding.js';
import { el, toast } from './ui/components.js';
import { instantiatePreset, PRESET_MODULES } from './presets/modules/index.js';

/* ---- global error safety net (Phase 9): a runtime error in an event handler
   otherwise fails silently; surface it calmly (data is in IndexedDB, untouched)
   and keep logging to the console. Throttled so a repeating error can't storm. */
let lastErrToast = 0;
function gentleError(detail) {
  console.error('[blossom]', detail);
  const now = Date.now();
  if (now - lastErrToast < 5000) return;
  lastErrToast = now;
  try { toast('Something hiccuped — your work is safe.', 'leaf'); } catch { /* pre-boot */ }
}
window.addEventListener('error', (e) => {
  if (/ResizeObserver loop/.test(e.message || '')) return; // benign, common
  gentleError(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => gentleError(e.reason));

async function boot() {
  await store.init();

  if (store.all('modules').length === 0) {
    instantiatePreset(PRESET_MODULES[0]); // default module (docs/10 swaps in The Blossom at Phase 4)
  }

  applyGlobalTheme(activeThemeId());

  // Widget day-rollover hooks run before anything re-renders or autosaves
  // (registration order matters: this listener is first).
  events.on('day:rolled', (info) => {
    const ctx = makeCtx();
    for (const w of store.all('widgets')) {
      try { registry.get(w.type)?.onDayRolled?.(w, ctx, info); }
      catch (err) { console.error('[day:rolled] hook failed for', w.type, err); }
    }
  });

  initShell(document.getElementById('app'));
  initEngine(document.getElementById('page-host'));
  initParticles();
  initAtmosphere();
  applyEffects(activeTheme(), true);
  initSaves();
  checkDayRollover();
  maybeBackupReminder(); // gentle off-device backup nudge when overdue
  router.init();
  initOnboarding();
  registerSW();
  navigator.storage?.persist?.();
}

/* ---- service worker + gentle update toast (docs/09: never auto-reload) ---- */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
    const watch = () => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
    };
    watch();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', watch);
    });
  }).catch(err => console.warn('[sw] registration failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateToast(waiting) {
  const t = el(`<div class="toast show" style="pointer-events:auto">
    <span>A new version has bloomed — refresh when ready</span>
    <button class="btn" style="padding:4px 12px">Refresh</button></div>`);
  t.querySelector('button').onclick = () => waiting.postMessage('SKIP_WAITING');
  let host = document.getElementById('toast-host');
  if (!host) {
    host = el('<div id="toast-host"></div>');
    document.body.appendChild(host);
  }
  host.appendChild(t);
}

boot().catch(err => {
  console.error('[boot] failed', err);
  document.getElementById('app').innerHTML =
    '<div style="padding:40px;text-align:center;opacity:0.8">The Blossom could not open. Please refresh.</div>';
});
