/* Hash-based module/page navigation (docs/01).
   Hash shape: #/m/<moduleId>/<pageId>  — emits 'route:changed'. */

import { events } from './events.js';
import { store } from './store.js';

let current = { moduleId: null, pageId: null };

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return parts[0] === 'm' ? { moduleId: parts[1] || null, pageId: parts[2] || null } : { moduleId: null, pageId: null };
}

function resolve(route) {
  // Fall back gracefully: bad module -> last used or first module; bad page -> first page.
  const modules = store.all('modules');
  let mod = store.get('modules', route.moduleId);
  if (!mod) mod = store.get('modules', store.getMeta('lastModule')) || modules[0];
  if (!mod) return { moduleId: null, pageId: null };
  let pageId = mod.pages.includes(route.pageId) ? route.pageId : mod.pages[0];
  return { moduleId: mod.id, pageId };
}

function apply() {
  const next = resolve(parse());
  if (next.moduleId === current.moduleId && next.pageId === current.pageId) return;
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

  /** @returns {{moduleId: string|null, pageId: string|null}} */
  current() { return { ...current }; },

  /** Navigate to a module (and optionally a page). */
  go(moduleId, pageId = null) {
    const target = resolve({ moduleId, pageId });
    const hash = `#/m/${target.moduleId}/${target.pageId}`;
    if (location.hash === hash) apply();
    else location.hash = hash;
    if (target.moduleId === current.moduleId && target.pageId === current.pageId) return;
    current = target;
    events.emit('route:changed', { ...current });
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
