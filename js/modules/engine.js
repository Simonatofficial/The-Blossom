/* Generic module renderer (docs/04): pages, the widget grid, drag/reorder,
   collapse, move, internal views. Modules are pure data — all behavior lives
   in widget types; this engine just arranges them. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { router } from '../core/router.js';
import { registry } from '../widgets/registry.js';
import { makeCtx, engineHooks, openWidgetSettings, removeWidget } from '../widgets/base.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, emptyState, closeStrayPanels } from '../ui/components.js';
import { applyScopedTheme, applyEffects, getTheme, activeTheme } from '../fx/themes.js';
import { applyScopedIdentity, materialFor, materialHasWatermark } from '../fx/identity.js';
import { openWidgetGallery } from '../ui/picker.js';

let host = null;
const cardEls = new Map(); // widgetId -> card element
const ctx = makeCtx();

// Nav return-to-origin (E): the page wipes + rebuilds on every route/page change,
// which would dump you at the top. Remember the module page's scroll so coming
// back from a widget view — or a same-page re-render (e.g. toggling an effect in
// Settings) — returns you where you were instead of the top of the page.
let prevRoute = { moduleId: null, pageId: null, widgetId: null };
let pageScroll = 0; // last module-page scroll position
const pageY = () => window.scrollY || document.documentElement.scrollTop || 0;

// Phase 2 (docs/15 §4): page layout archetypes + entrance.
const PAGE_LAYOUTS = new Set(['stream', 'hearth', 'gallery', 'split']);
const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Merge module + page identity — page overrides module per field (cascade). */
function mergeIdentity(modId, pageId) {
  if (!modId && !pageId) return null;
  return { ...(modId || {}), ...(pageId || {}) };
}

export function initEngine(hostEl) {
  host = hostEl;
  engineHooks.renderWidgetCard = renderWidgetCard;
  engineHooks.openInternal = openInternal;
  engineHooks.renderPage = renderPage;
  engineHooks.refreshCard = refreshCard;

  // navigation never leaves stale overlays behind (CR-8)
  events.on('route:changed', closeStrayPanels);
  events.on('route:changed', renderPage);
  events.on('page:changed', renderPage);
  // Esc backs out of a widget page when no panel is above it (CR-11)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.drawer.open')) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (router.current().widgetId) router.closeWidget();
  });
  events.on('widget:added', renderPage);
  events.on('widget:removed', renderPage);
  events.on('day:rolled', renderPage);
  events.on('widget:changed', ({ widgetId }) => refreshCard(widgetId, true));
  events.on('object:changed', ({ widgetId }) => {
    refreshCard(widgetId);
    for (const [id, card] of cardEls) {
      const w = store.get('widgets', id);
      if (w?.links?.some(l => l.sourceWidgetId === widgetId)) {
        refreshCard(id);
        registry.get(w.type)?.onLinkedChange?.(w, ctx);
      }
    }
  });
  events.on('wallet:changed', () => {
    for (const [id] of cardEls) {
      if (store.get('widgets', id)?.type === 'market') refreshCard(id);
    }
  });
  events.on('widget:focus', ({ widgetId }) => {
    const card = cardEls.get(widgetId);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('focus-glow');
    setTimeout(() => card.classList.remove('focus-glow'), 1800);
  });
}

/* ---------- page rendering ---------- */

export function renderPage() {
  if (!host) return;
  const route = router.current();
  const prev = prevRoute;
  prevRoute = route;
  // capture the scroll of the module page we're leaving (not a widget view)
  if (!prev.widgetId) pageScroll = pageY();
  const mod = store.get('modules', route.moduleId);
  const page = store.get('pages', route.pageId);
  cardEls.clear();
  host.innerHTML = '';
  document.body.classList.remove('focus-page');
  if (!mod || !page) return;

  // CR-11: a widget's internal view is a real PAGE — when its route is
  // active, it replaces the page content entirely (never rendered behind)
  const viewWidget = route.widgetId ? store.get('widgets', route.widgetId) : null;
  if (viewWidget && registry.get(viewWidget.type)?.internal) {
    renderWidgetPage(viewWidget, page, mod, route.focus);
    const sameView = prev.widgetId === route.widgetId && prev.pageId === route.pageId;
    if (!sameView) window.scrollTo(0, 0); // a freshly opened view starts at the top
    return;
  }

  const scope = el('<div class="page-scope"></div>');
  applyScopedTheme(scope, page.themeOverride || mod.themeOverride || null);
  // Phase 2: page identity overrides module identity per-field (merged cascade)
  applyScopedIdentity(scope, mergeIdentity(mod.identity, page.identity));
  if (PAGE_LAYOUTS.has(page.layout)) scope.setAttribute('data-layout', page.layout);
  // deepest non-inherit theme drives atmosphere + particles (docs/03)
  applyEffects(getTheme(page.themeOverride || mod.themeOverride) || activeTheme());

  // home-page star (V2 §11/§15): a quiet filled star in the content corner
  if (mod.homePageId === page.id) {
    scope.appendChild(el(`<span class="page-home-star" title="Home page" aria-hidden="true">${icon('star', 13)}</span>`));
  }

  // optional, quiet page header band (Phase 2 §4.2) — opt-in, off by default so
  // it never costs 360px vertical space unless a page asks for it.
  if (page.subtitle || page.showHeader) {
    const band = el(`<div class="page-band"><h2></h2>${page.subtitle ? '<div class="pb-sub"></div>' : ''}<div class="pb-rule"></div></div>`);
    band.querySelector('h2').textContent = page.name;
    if (page.subtitle) band.querySelector('.pb-sub').textContent = page.subtitle;
    scope.appendChild(band);
  }

  const grid = el('<div class="widget-grid"></div>');
  const widgets = page.widgets.map(id => store.get('widgets', id)).filter(Boolean);

  // hearth hero: self-heals to the first non-separator widget if unset/invalid
  // (mirrors the homePageId self-heal in core/router.js).
  let heroId = null;
  if (page.layout === 'hearth') {
    const ids = widgets.map(w => w.id);
    heroId = ids.includes(page.heroWidgetId) ? page.heroWidgetId
      : (widgets.find(w => w.type !== 'separator')?.id || null);
  }

  // Category Dividers (V2 §18): a divider folds and indents the group beneath it
  let hiddenBySeparator = false;
  let inGroup = false;
  for (const w of widgets) {
    if (w.type === 'separator') {
      hiddenBySeparator = w.collapsed;
      inGroup = true;
      grid.appendChild(renderWidgetCard(w));
      continue;
    }
    if (hiddenBySeparator) continue;
    const card = renderWidgetCard(w);
    if (inGroup) card.classList.add('w-in-group');
    if (w.id === heroId) card.setAttribute('data-hero', '');
    grid.appendChild(card);
  }

  scope.appendChild(grid);

  if (!widgets.length) {
    scope.appendChild(emptyState('sprout', 'This page is quiet. Plant a widget?', 'Plant a widget',
      () => openWidgetGallery({ pageId: page.id })));
  } else {
    const add = el(`<button class="btn-soft-wide" style="margin-top:14px">${icon('plus', 16)} Plant a widget</button>`);
    add.onclick = () => openWidgetGallery({ pageId: page.id });
    scope.appendChild(add);
  }
  host.appendChild(scope);

  // return-to-origin (E): if this is the same page we just left (back from its
  // widget view, or a same-page re-render), restore the scroll; otherwise a
  // genuine page switch lands at the top.
  const samePage = prev.moduleId === route.moduleId && prev.pageId === route.pageId;
  // entrance (Phase 2): genuine page switches stagger-rise their widgets; a
  // same-page rebuild does not (no flicker). Reduced-motion shows them at rest.
  if (!samePage && !prefersReduced()) {
    grid.querySelectorAll('.widget-card').forEach((c, i) => {
      c.classList.add('w-enter');
      c.style.animationDelay = `${Math.min(i, 8) * 30}ms`;
    });
  }
  window.scrollTo(0, samePage ? pageScroll : 0);
}

/* ---------- widget pages (CR-11): the /w/<id> route renders the widget's
   internal view as a routed page in the app area — translucent surface,
   atmosphere visible, back pops the route. /f = focus (chrome hidden). ---------- */

function renderWidgetPage(widget, page, mod, focus) {
  const def = registry.get(widget.type);

  // breadcrumb chain: Page › parents › widget (docs/04)
  const crumbs = [];
  let p = widget;
  let guard = 0;
  while (p && guard++ < 30) {
    crumbs.unshift(p.name);
    p = p.parentWidgetId ? store.get('widgets', p.parentWidgetId) : null;
  }
  const pageRec = store.get('pages', topLevelOf(widget)?.pageId) || page;
  crumbs.unshift(pageRec.name);

  // CR-9: the open view is the deepest active theme scope — colors wrap the
  // page surface; its effects own the canvases until the route pops.
  const themeId = widget.themeOverride || pageRec?.themeOverride || mod?.themeOverride || null;

  const rp = el(`<div class="routed-page${focus ? ' rp-focus' : ''}">
    <header class="rp-head">
      <button class="btn-icon" aria-label="Back">${icon('arrow-left', 18)}</button>
      <span class="rp-icon">${icon(def.icon, 20)}</span>
      <div class="grow" style="min-width:0">
        <h2></h2>
        <div class="rp-crumbs"></div>
      </div>
      <button class="btn-icon" aria-label="Widget settings" title="Widget settings">${icon('settings', 17)}</button>
    </header>
    <div class="rp-body"></div></div>`);
  rp.querySelector('h2').textContent = widget.name;
  rp.querySelector('.rp-crumbs').textContent = crumbs.slice(0, -1).join(' › ');
  rp.querySelector('[aria-label="Back"]').onclick = () => router.closeWidget();
  rp.querySelector('[aria-label="Widget settings"]').onclick = () => openWidgetSettings(widget);

  applyScopedTheme(rp, themeId);
  applyScopedIdentity(rp, mod?.identity || null);
  applyEffects(getTheme(themeId) || getTheme(pageRec?.themeOverride || mod?.themeOverride) || activeTheme());
  if (focus) document.body.classList.add('focus-page');

  try { def.renderFull(rp.querySelector('.rp-body'), widget, ctx); }
  catch (err) {
    console.error(`[engine] renderFull failed for ${widget.type}`, err);
    rp.querySelector('.rp-body').innerHTML = '<p class="soft">This view had trouble blooming.</p>';
  }
  host.appendChild(rp);
}

function refreshCard(widgetId, structural = false) {
  const old = cardEls.get(widgetId);
  const widget = store.get('widgets', widgetId);
  if (!old || !widget) return;
  if (!structural && old.contains(document.activeElement)) return; // don't yank the caret
  const fresh = renderWidgetCard(widget);
  old.replaceWith(fresh);
}

/* ---------- widget cards ---------- */

/** Render one widget's card (also used by container widgets for children). */
export function renderWidgetCard(widget) {
  const def = registry.get(widget.type);
  const card = el(`<section class="widget-card ${widget.type}-card" data-w="${widget.w || 'full'}" data-wid="${widget.id}"></section>`);
  cardEls.set(widget.id, card);
  if (widget.style?.opacity != null) card.style.setProperty('--w-bg-opacity', widget.style.opacity);
  if (widget.collapsed) card.classList.add('collapsed');
  if (widget.themeOverride) applyScopedTheme(card, widget.themeOverride);
  // Phase 1 (docs/15 §3): the widget wears a material — its card's face.
  const material = materialFor(widget, def);
  if (material) card.setAttribute('data-material', material);
  if (!def) {
    card.appendChild(el('<div class="widget-body soft">Unknown widget type.</div>'));
    return card;
  }

  const head = el(`
    <header class="widget-head">
      <button class="btn-icon w-drag" aria-label="Drag to reorder">${icon('drag', 16)}</button>
      <span class="w-type-icon">${icon(def.icon, 16)}</span>
      <h3 class="w-name"></h3>
      <button class="btn-icon w-collapse" aria-label="Collapse">${icon('chevron-down', 16)}</button>
      <button class="btn-icon w-menu" aria-label="Widget menu">${icon('more', 16)}</button>
    </header>`);
  head.querySelector('.w-name').textContent = widget.name;

  head.querySelector('.w-collapse').onclick = () => {
    widget.collapsed = !widget.collapsed;
    store.put('widgets', widget);
    if (widget.type === 'separator') renderPage();
    else {
      card.classList.toggle('collapsed', widget.collapsed);
    }
  };

  head.querySelector('.w-menu').onclick = (e) => widgetMenu(e.currentTarget, widget);
  if (!widget.parentWidgetId) enableDrag(head.querySelector('.w-drag'), widget, card);
  card.appendChild(head);

  // signature corner watermark (paper): a faint maker's-mark of the type glyph,
  // behind the content (z-index:-1). Opt-in per material (docs/15 §3.3).
  if (material && materialHasWatermark(material) && def.icon) {
    card.appendChild(el(`<span class="w-watermark" aria-hidden="true">${icon(def.icon, 96)}</span>`));
  }

  const body = el('<div class="widget-body"></div>');
  card.appendChild(body);
  try { def.renderCard?.(body, widget, ctx); }
  catch (err) {
    console.error(`[engine] renderCard failed for ${widget.type}`, err);
    body.innerHTML = '<p class="soft">This widget had trouble blooming.</p>';
  }

  // P-2: a tap on the card body runs the widget's PRIMARY action — a custom
  // primaryTap (e.g. Counter increments, Dice rolls) or, for internal widgets,
  // opening the full view. No trip through ··· settings. Controls inside the
  // body (buttons, inputs, anything marked .no-open) keep their own taps.
  const primary = def.primaryTap
    ? () => { try { def.primaryTap(widget, ctx); } catch (e) { console.error('[engine] primaryTap failed for', widget.type, e); } }
    : def.internal ? () => openInternal(widget) : null;
  if (primary) {
    body.classList.add('openable');
    body.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, textarea, select, label, [contenteditable], .no-open')) return;
      primary();
    });
  }
  return card;
}

function widgetMenu(anchor, widget) {
  // V2 §12: Edit · Copy Widget Code · Delete (Theme merged into Edit →
  // Appearance; Move-to-page replaced by hold-drag).
  popMenu(anchor, [
    { label: 'Edit', iconName: 'edit', fn: () => openWidgetSettings(widget) },
    { label: 'Copy Widget Code', iconName: 'code', fn: async () => {
      const { copyNodeCode } = await import('../ui/settings.js');
      copyNodeCode('wgt', widget.id, widget.name);
    } },
    'sep',
    { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
      if (await confirmDialog({ title: `Delete “${widget.name}”?`, message: 'It rests in the trash for 30 days.' })) {
        removeWidget(widget);
        toast('Moved to trash', 'leaf');
      }
    } }
  ]);
}

/* ---------- drag to reorder (pointer-based; works with touch) ---------- */

function enableDrag(handle, widget, card) {
  handle.addEventListener('pointerdown', (start) => {
    start.preventDefault();
    handle.setPointerCapture(start.pointerId);
    let armed = false;       // becomes draggable only after a 600ms hold (V2 §12)
    let dropTarget = null;   // { id, before }

    // hold-to-move: a border glow grows over 600ms, then haptic + arm for drag
    card.classList.add('w-holding');
    const holdTimer = setTimeout(() => {
      armed = true;
      card.classList.remove('w-holding');
      card.classList.add('dragging');
      navigator.vibrate?.(30);
    }, 600);
    const cancelHold = () => { clearTimeout(holdTimer); card.classList.remove('w-holding'); };

    const onMove = (e) => {
      if (!armed) return; // movement before the threshold never reorders (release = no move)
      document.querySelectorAll('.widget-card.drop-before').forEach(c => c.classList.remove('drop-before'));
      dropTarget = null;
      for (const [id, other] of cardEls) {
        if (other === card || !other.isConnected) continue;
        const r = other.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          other.classList.add('drop-before');
          dropTarget = { id, before: e.clientY < r.top + r.height / 2 };
          break;
        }
      }
    };

    const onUp = () => {
      cancelHold();
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      card.classList.remove('dragging');
      document.querySelectorAll('.widget-card.drop-before').forEach(c => c.classList.remove('drop-before'));
      if (!armed || !dropTarget) return;
      const page = store.get('pages', widget.pageId);
      if (!page) return;
      const order = page.widgets.filter(id => id !== widget.id);
      let idx = order.indexOf(dropTarget.id);
      if (idx < 0) return;
      if (!dropTarget.before) idx += 1;
      order.splice(idx, 0, widget.id);
      page.widgets = order;
      store.put('pages', page);
      renderPage();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

/* ---------- internal views are ROUTES (CR-8): opening one navigates ---------- */

export function openInternal(widget) {
  const def = registry.get(widget.type);
  if (!def?.internal) return;
  router.openWidget(widget.id); // route change mounts the view (syncRoutedView)
}

function topLevelOf(widget) {
  let w = widget;
  let guard = 0;
  while (w?.parentWidgetId && guard++ < 30) w = store.get('widgets', w.parentWidgetId);
  return w;
}
