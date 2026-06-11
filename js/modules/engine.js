/* Generic module renderer (docs/04): pages, the widget grid, drag/reorder,
   collapse, move, internal views. Modules are pure data — all behavior lives
   in widget types; this engine just arranges them. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { router } from '../core/router.js';
import { registry } from '../widgets/registry.js';
import { makeCtx, engineHooks, openWidgetSettings, removeWidget } from '../widgets/base.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, openDrawer, popMenu, emptyState } from '../ui/components.js';
import { applyScopedTheme, applyEffects, getTheme, activeTheme } from '../fx/themes.js';
import { openWidgetGallery } from '../ui/picker.js';

let host = null;
const cardEls = new Map(); // widgetId -> card element
const ctx = makeCtx();

export function initEngine(hostEl) {
  host = hostEl;
  engineHooks.renderWidgetCard = renderWidgetCard;
  engineHooks.openInternal = openInternal;
  engineHooks.renderPage = renderPage;
  engineHooks.refreshCard = refreshCard;

  events.on('route:changed', renderPage);
  events.on('page:changed', renderPage);
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
  const { moduleId, pageId } = router.current();
  const mod = store.get('modules', moduleId);
  const page = store.get('pages', pageId);
  cardEls.clear();
  host.innerHTML = '';
  if (!mod || !page) return;

  const scope = el('<div class="page-scope"></div>');
  applyScopedTheme(scope, page.themeOverride || mod.themeOverride || null);
  // deepest non-inherit theme drives atmosphere + particles (docs/03)
  applyEffects(getTheme(page.themeOverride || mod.themeOverride) || activeTheme());

  const grid = el('<div class="widget-grid"></div>');
  const widgets = page.widgets.map(id => store.get('widgets', id)).filter(Boolean);

  let hiddenBySeparator = false;
  for (const w of widgets) {
    if (w.type === 'separator') hiddenBySeparator = w.collapsed;
    else if (hiddenBySeparator) continue;
    grid.appendChild(renderWidgetCard(w));
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
  const card = el(`<section class="widget-card ${widget.type}-card" data-w="${widget.w || 'full'}"></section>`);
  cardEls.set(widget.id, card);
  if (widget.collapsed) card.classList.add('collapsed');
  if (widget.themeOverride) applyScopedTheme(card, widget.themeOverride);
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

  const body = el('<div class="widget-body"></div>');
  card.appendChild(body);
  try { def.renderCard?.(body, widget, ctx); }
  catch (err) {
    console.error(`[engine] renderCard failed for ${widget.type}`, err);
    body.innerHTML = '<p class="soft">This widget had trouble blooming.</p>';
  }

  if (def.internal) {
    body.classList.add('openable');
    body.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, textarea, select, label, [contenteditable], .no-open')) return;
      openInternal(widget);
    });
  }
  return card;
}

function widgetMenu(anchor, widget) {
  popMenu(anchor, [
    { label: 'Edit', iconName: 'edit', fn: () => openWidgetSettings(widget) },
    { label: 'Theme', iconName: 'palette', fn: () => openWidgetSettings(widget) },
    { label: 'Move to page', iconName: 'move', fn: () => moveWidgetFlow(widget) },
    { label: 'Copy Blossom code', iconName: 'code', fn: async () => {
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

function moveWidgetFlow(widget) {
  const d = openDrawer({ title: 'Move to page', iconName: 'move' });
  for (const mod of store.all('modules')) {
    const h = el('<h3 class="soft" style="margin:10px 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em"></h3>');
    h.textContent = mod.name;
    d.body.appendChild(h);
    for (const pid of mod.pages) {
      const page = store.get('pages', pid);
      if (!page) continue;
      const li = el(`<button class="list-item"><span class="li-main"><span class="li-title"></span></span>${pid === widget.pageId ? '<span class="chip">here</span>' : icon('chevron-right', 14)}</button>`);
      li.querySelector('.li-title').textContent = page.name;
      li.onclick = () => {
        if (pid === widget.pageId) return;
        const from = store.get('pages', widget.pageId);
        if (from) { from.widgets = from.widgets.filter(id => id !== widget.id); store.put('pages', from); }
        page.widgets.push(widget.id);
        store.put('pages', page);
        widget.pageId = pid;
        store.put('widgets', widget);
        d.close();
        toast(`Moved to ${page.name}`, 'move');
        renderPage(); // links keep working — they're id-based (docs/02)
      };
      d.body.appendChild(li);
    }
  }
}

/* ---------- drag to reorder (pointer-based; works with touch) ---------- */

function enableDrag(handle, widget, card) {
  handle.addEventListener('pointerdown', (start) => {
    start.preventDefault();
    handle.setPointerCapture(start.pointerId);
    let started = false;
    let dropTarget = null; // { id, before }

    const onMove = (e) => {
      if (!started && Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < 7) return;
      if (!started) { started = true; card.classList.add('dragging'); }
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
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      card.classList.remove('dragging');
      document.querySelectorAll('.widget-card.drop-before').forEach(c => c.classList.remove('drop-before'));
      if (!started || !dropTarget) return;
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
  });
}

/* ---------- internal views (open through the shared panel — CR-1) ---------- */

export function openInternal(widget) {
  const def = registry.get(widget.type);
  if (!def?.internal) return;

  // breadcrumb chain: Page › parents › widget (docs/04)
  const crumbs = [];
  let p = widget;
  let guard = 0;
  while (p && guard++ < 30) {
    crumbs.unshift(p.name);
    p = p.parentWidgetId ? store.get('widgets', p.parentWidgetId) : null;
  }
  const pageRec = store.get('pages', topLevelOf(widget)?.pageId);
  if (pageRec) crumbs.unshift(pageRec.name);

  const panel = openDrawer({
    title: widget.name,
    iconName: def.icon,
    crumbs: crumbs.slice(0, -1),
    actions: [{ iconName: 'settings', label: 'Widget settings', fn: () => openWidgetSettings(widget) }],
    onClose: () => refreshCard(widget.id, true)
  });

  try { def.renderFull(panel.body, widget, ctx); }
  catch (err) {
    console.error(`[engine] renderFull failed for ${widget.type}`, err);
    panel.body.innerHTML = '<p class="soft">This view had trouble blooming.</p>';
  }
}

function topLevelOf(widget) {
  let w = widget;
  let guard = 0;
  while (w?.parentWidgetId && guard++ < 30) w = store.get('widgets', w.parentWidgetId);
  return w;
}
