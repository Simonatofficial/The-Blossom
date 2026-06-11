/* Hash-based module/page navigation (docs/01, CR-8, CR-11).
   Hash shape: #/m/<moduleId>/<pageId>[/w/<widgetId>[/f]] — emits
   'route:changed'. The /w segment is a widget's internal view — a REAL page
   per the CR-11 surface taxonomy (back/refresh/deep links behave; the page
   beneath fully unmounts). The /f flag is the distraction-free focus page
   (Canvas): same document, Blossom chrome hidden. */

import { events } from './events.js';
import { store } from './store.js';

let current = { moduleId: null, pageId: null, widgetId: null, focus: false };
let viewPushed = false; // we pushed the /w entry ourselves → back() pops it

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] !== 'm') return { moduleId: null, pageId: null, widgetId: null, focus: false };
  return {
    moduleId: parts[1] || null,
    pageId: parts[2] || null,
    widgetId: parts[3] === 'w' ? parts[4] || null : null,
    focus: parts[3] === 'w' && parts[5] === 'f'
  };
}

function resolve(route) {
  // Fall back gracefully: bad module -> last used or first module; bad page -> first page.
  const modules = store.all('modules');
  let mod = store.get('modules', route.moduleId);
  if (!mod) mod = store.get('modules', store.getMeta('lastModule')) || modules[0];
  if (!mod) return { moduleId: null, pageId: null, widgetId: null, focus: false };
  let pageId = mod.pages.includes(route.pageId) ? route.pageId : mod.pages[0];
  const widgetId = route.widgetId && store.get('widgets', route.widgetId) ? route.widgetId : null;
  return { moduleId: mod.id, pageId, widgetId, focus: !!widgetId && !!route.focus };
}

function same(a, b) {
  return a.moduleId === b.moduleId && a.pageId === b.pageId && a.widgetId === b.widgetId && !a.focus === !b.focus;
}

function apply() {
  const next = resolve(parse());
  if (same(next, current)) return;
  current = next;
  if (current.moduleId) {
    store.setMeta('lastModule', current.moduleId);
    localStorage.setItem('blossom:lastModule', current.moduleId);
  }
  events.emit('route:changed', { ...current });
}

export const router = {
  /** Begin listening; navigates to the last-used module. */
  init() {
    window.addEventListener('hashchange', apply);
    apply();
    if (!current.moduleId) {
      const first = store.all('modules')[0];
      if (first) this.go(first.id);
    }
  },

  /** @returns {{moduleId: string|null, pageId: string|null, widgetId: string|null}} */
  current() { return { ...current }; },

  /** Navigate to a module (and optionally a page). Closes any open view. */
  go(moduleId, pageId = null) {
    const target = resolve({ moduleId, pageId, widgetId: null });
    const hash = `#/m/${target.moduleId}/${target.pageId}`;
    if (location.hash === hash) apply();
    else location.hash = hash;
    if (same(target, current)) return;
    current = target;
    events.emit('route:changed', { ...current });
  },

  /** Open a widget's internal view as a real page (CR-8/CR-11).
      focus = the distraction-free variant (chrome hidden). */
  openWidget(widgetId, focus = false) {
    if (!current.moduleId) return;
    if (current.widgetId === widgetId && !current.focus === !focus) return;
    viewPushed = true;
    location.hash = `#/m/${current.moduleId}/${current.pageId}/w/${widgetId}${focus ? '/f' : ''}`;
  },

  /** Pop the view route (back arrow / scrim / Esc). */
  closeWidget() {
    if (!current.widgetId) return;
    if (viewPushed) {
      viewPushed = false;
      history.back(); // we pushed it — back returns to the page entry
    } else {
      // deep link / refresh: there is no page entry beneath us
      location.replace(`#/m/${current.moduleId}/${current.pageId}`);
      apply();
    }
  },

  /** Navigate to the page containing a widget, then ask it to glow (docs/02 flow 3). */
  goWidget(widgetId) {
    let w = store.get('widgets', widgetId);
    let guard = 0;
    while (w && w.parentWidgetId && guard++ < 50) w = store.get('widgets', w.parentWidgetId);
    if (!w || !w.pageId) return;
    const mod = store.all('modules').find(m => m.pages.includes(w.pageId));
    if (!mod) return;
    this.go(mod.id, w.pageId);
    setTimeout(() => events.emit('widget:focus', { widgetId }), 80);
  }
};
