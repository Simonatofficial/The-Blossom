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
import { initWeather } from './fx/weather.js';
import { initShell } from './ui/shell.js';
import { initEngine } from './modules/engine.js';
import { initSaves, checkDayRollover, maybeBackupReminder } from './core/saves.js';
import { initOnboarding } from './ui/onboarding.js';
import { initSync } from './core/sync.js';
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

/* Storage write failed (most likely a full quota). The change is safe in
   memory and re-queued; tell the user calmly so they can free space or export
   a backup. store.js throttles this, so just surface it once it arrives. */
events.on('storage:full', ({ quota }) => {
  const text = quota
    ? 'Storage is full. Free up space (or export a backup and clear old data) so The Blossom can keep saving.'
    : 'A recent change could not be written to storage. Your work is still here — export a backup to be safe.';
  try { toast(quota ? 'Storage is full — recent changes may not be saved.' : 'A save didn’t go through.', 'leaf'); } catch { /* pre-boot */ }
  events.emit('notify', { category: 'storage', text });
});

async function boot() {
  // Register the service worker FIRST: its update detection must not depend on
  // the rest of boot succeeding. If anything below hangs or throws, the app can
  // still pull and activate a fix (see also the boot watchdog in index.html).
  registerSW();
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
  // Chrome is mounted — we're past the "stuck on a blank purple screen" failure
  // mode, so stand down the boot watchdog (later non-fatal errors use the error
  // safety net / update toast instead of the recovery card).
  if (window.__blossom) window.__blossom.booted = true;
  initEngine(document.getElementById('page-host'));
  initParticles();
  initAtmosphere();
  initWeather();
  applyEffects(activeTheme(), true);
  initSaves();
  checkDayRollover();
  maybeBackupReminder(); // gentle off-device backup nudge when overdue
  router.init();
  initOnboarding();
  navigator.storage?.persist?.();
  initSync(); // optional cloud mirror (V2 §1) — no-op unless configured

}

/* ---- service worker + gentle update flow (docs/09) ----------------------------
   Healthy app: a calm toast offers an instant refresh, and we quietly hand off
   to the new version on pagehide so the *next* launch is fresh without ever
   interrupting an entry. A genuinely *stuck* app is handled separately by the
   boot watchdog in index.html, which can pull and activate a fix even when boot
   never completes. We also poll for updates (cache-first won't notice on its
   own) so a deploy lands promptly instead of on some indefinite future visit. */

let pendingWorker = null;

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
    const watch = () => {
      if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg.waiting);
    };
    watch();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', watch);
    });
    // The page must ask for new code; the browser won't always check. Re-check
    // when the tab regains focus and hourly, so deploys are picked up quickly.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 60 * 60 * 1000);
  }).catch(err => console.warn('[sw] registration failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  // Race-free auto-update: when the user leaves, activate any waiting worker so
  // the next open is the new version. No live reload → can't interrupt an entry
  // and can't race the on-hide IndexedDB flush.
  window.addEventListener('pagehide', () => {
    if (pendingWorker) pendingWorker.postMessage('SKIP_WAITING');
  });
}

function onUpdateReady(waiting) {
  pendingWorker = waiting;
  showUpdateToast(waiting);
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
  const W = window.__blossom;
  if (W && !W.booted && W.showRecovery) W.showRecovery();
  else if (!W || !W.booted) document.getElementById('app').innerHTML =
    '<div style="padding:40px;text-align:center;opacity:0.8">The Blossom could not open. Please refresh.</div>';
});
