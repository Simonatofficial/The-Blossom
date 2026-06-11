/* Widget base helpers (docs/04): creation, day-keyed objects, the universal
   settings drawer, and the ctx handed to every widget. Widgets never import
   each other — they speak through ctx, events, and value links. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { router } from '../core/router.js';
import { wallet } from '../core/wallet.js';
import * as values from '../core/values.js';
import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, openDrawer, field, input, seg } from '../ui/components.js';
import { allThemes } from '../fx/themes.js';
import { openLinkPicker } from '../ui/picker.js';

/* ---- dates ---- */

/** Local date as 'YYYY-MM-DD'. */
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Add days to a 'YYYY-MM-DD' string. */
export function dateAdd(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

/** Friendly short date ("Jun 10"). */
export function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ---- engine hooks (set by modules/engine.js to keep dependencies downward) ---- */
export const engineHooks = {
  renderWidgetCard: null,
  openInternal: null,
  renderPage: null,
  refreshCard: null
};

/** The ctx given to every widget render/lifecycle call (docs/04). */
export function makeCtx() {
  return {
    store, events, values, wallet, toast,
    navigate: (moduleId, pageId) => router.go(moduleId, pageId),
    goWidget: (widgetId) => router.goWidget(widgetId),
    openInternal: (widget) => engineHooks.openInternal?.(widget),
    renderWidgetCard: (widget) => engineHooks.renderWidgetCard?.(widget),
    refreshCard: (widget) => engineHooks.refreshCard?.(widget.id, true),
    openWidgetSettings: (widget) => openWidgetSettings(widget)
  };
}

/* ---- widget lifecycle ---- */

/**
 * Create a widget on a page or inside a container widget.
 * @param {string} type
 * @param {{pageId?: string, parentWidgetId?: string, name?: string, config?: object}} opts
 */
export function createWidget(type, opts = {}) {
  const def = registry.get(type);
  const widget = store.put('widgets', {
    id: ulid(),
    type,
    pageId: opts.pageId || null,
    parentWidgetId: opts.parentWidgetId || null,
    name: opts.name || def?.name || type,
    collapsed: false,
    themeOverride: null,
    w: 'full',
    config: { ...(def?.defaultConfig?.() || {}), ...(opts.config || {}) },
    links: []
  });
  if (opts.pageId) {
    const page = store.get('pages', opts.pageId);
    if (page) { page.widgets.push(widget.id); store.put('pages', page); }
  }
  if (opts.parentWidgetId) {
    const parent = store.get('widgets', opts.parentWidgetId);
    if (parent) {
      parent.config.childOrder = [...(parent.config.childOrder || []), widget.id];
      store.put('widgets', parent);
    }
  }
  events.emit('widget:added', { widget });
  return widget;
}

/** Soft-delete a widget, its nested widgets, and their objects (30-day trash). */
export function removeWidget(widget) {
  for (const child of childWidgetsOf(widget.id)) removeWidget(child);
  for (const obj of objectsOf(widget.id)) store.trash('objects', obj.id);
  if (widget.pageId) {
    const page = store.get('pages', widget.pageId);
    if (page) { page.widgets = page.widgets.filter(id => id !== widget.id); store.put('pages', page); }
  }
  if (widget.parentWidgetId) {
    const parent = store.get('widgets', widget.parentWidgetId);
    if (parent?.config.childOrder) {
      parent.config.childOrder = parent.config.childOrder.filter(id => id !== widget.id);
      store.put('widgets', parent);
    }
  }
  store.trash('widgets', widget.id);
  events.emit('widget:removed', { widgetId: widget.id, pageId: widget.pageId });
}

/** Ordered child widgets of a container. */
export function childWidgetsOf(parentWidgetId) {
  const parent = store.get('widgets', parentWidgetId);
  const order = parent?.config.childOrder || [];
  const kids = store.all('widgets').filter(w => w.parentWidgetId === parentWidgetId);
  kids.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return kids;
}

/* ---- objects ---- */

/** All objects belonging to a widget (optionally of one kind). */
export function objectsOf(widgetId, kind = null) {
  return store.all('objects').filter(o => o.widgetId === widgetId && (!kind || o.kind === kind));
}

/** Find-or-create a day-keyed object (tracker days, quest logs…). */
export function dayObject(widgetId, kind, date, initData = {}) {
  let obj = store.all('objects').find(o => o.widgetId === widgetId && o.kind === kind && o.date === date);
  if (!obj) {
    obj = store.put('objects', { id: ulid(), widgetId, kind, date, data: { ...initData } });
  }
  return obj;
}

/** Create a non-day object. */
export function createObject(widgetId, kind, data = {}, date = null) {
  return store.put('objects', { id: ulid(), widgetId, kind, date, data });
}

/** Persist an object and notify the value system + consumers. */
export function saveObject(obj) {
  store.put('objects', obj);
  events.emit('object:changed', { widgetId: obj.widgetId, objectId: obj.id, date: obj.date });
}

/* ---- celebrations (docs/07: quiet bloom, never a takeover) ---- */

/** Petal burst over an element. */
export function bloomBurst(target) {
  const host = el('<div class="bloom-burst"></div>');
  const r = target.getBoundingClientRect();
  host.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;z-index:55;`;
  for (let i = 0; i < 8; i++) {
    const p = el('<i></i>');
    p.style.setProperty('--ang', `${i * 45 + Math.random() * 20}deg`);
    p.style.animationDelay = `${i * 30}ms`;
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 1200);
}

/* ---- universal widget settings drawer ---- */

export function openWidgetSettings(widget) {
  const def = registry.get(widget.type);
  const ctx = makeCtx();
  const d = openDrawer({ title: `${widget.name} — settings`, iconName: def?.icon || 'settings' });
  const body = d.body;

  // name
  const nameIn = input(widget.name, 'Widget name');
  nameIn.addEventListener('change', () => {
    widget.name = nameIn.value.trim() || def.name;
    store.put('widgets', widget);
    events.emit('widget:changed', { widgetId: widget.id });
    d.setTitle(`${widget.name} — settings`);
  });
  body.appendChild(field('Name', nameIn));

  // width (full / half / third where columns allow)
  if (!widget.parentWidgetId) {
    body.appendChild(field('Width', seg(
      [{ value: 'full', label: 'Full' }, { value: 'half', label: 'Half' }, { value: 'third', label: 'Third' }],
      widget.w || 'full',
      (v) => { widget.w = v; store.put('widgets', widget); events.emit('widget:changed', { widgetId: widget.id }); }
    )));
  }

  // theme override (docs/03 scoping: Inherit / pick a theme)
  const themeSel = el('<select class="select"></select>');
  themeSel.appendChild(new Option('Inherit (default)', ''));
  for (const t of allThemes()) themeSel.appendChild(new Option(t.name, t.id));
  themeSel.value = widget.themeOverride || '';
  themeSel.onchange = () => {
    widget.themeOverride = themeSel.value || null;
    store.put('widgets', widget);
    events.emit('widget:changed', { widgetId: widget.id });
  };
  body.appendChild(field('Theme', themeSel));

  // type-specific settings
  if (def?.renderSettings) {
    const sec = el('<div class="dsec"><h3>Widget</h3><div class="sec-body"></div></div>');
    body.appendChild(sec);
    def.renderSettings(sec.querySelector('.sec-body'), widget, ctx);
  }

  // linked values (docs/02) — for consumer widgets
  if (def?.linkable) {
    const sec = el('<div class="dsec"><h3>Linked values</h3><div class="link-chips row" style="flex-wrap:wrap"></div></div>');
    body.appendChild(sec);
    const chips = sec.querySelector('.link-chips');
    const renderChips = () => {
      chips.innerHTML = '';
      for (const [i, link] of (widget.links || []).entries()) {
        const src = store.get('widgets', link.sourceWidgetId);
        const chip = el(`<button class="chip accent">${icon('link', 12)}<span></span> ×</button>`);
        chip.querySelector('span').textContent = `${src?.name || '?'} · ${link.output}`;
        chip.onclick = async () => {
          if (await confirmDialog({ title: 'Remove link?', message: 'The widgets stay; only the connection is removed.', confirmText: 'Remove' })) {
            widget.links.splice(i, 1);
            store.put('widgets', widget);
            events.emit('widget:changed', { widgetId: widget.id });
            renderChips();
          }
        };
        chips.appendChild(chip);
      }
      const add = el(`<button class="chip">${icon('plus', 12)} Add link</button>`);
      add.onclick = () => openLinkPicker({
        consumerWidget: widget,
        onPick: (link) => {
          widget.links = [...(widget.links || []), link];
          store.put('widgets', widget);
          events.emit('widget:changed', { widgetId: widget.id });
          renderChips();
        }
      });
      chips.appendChild(add);
    };
    renderChips();
  }

  // danger zone
  const delBtn = el(`<button class="btn" style="width:100%;color:var(--warn)">${icon('trash', 16)} Delete widget</button>`);
  delBtn.onclick = async () => {
    if (await confirmDialog({ title: `Delete “${widget.name}”?`, message: 'It rests in the trash for 30 days.', confirmText: 'Delete' })) {
      d.close();
      removeWidget(widget);
      toast('Moved to trash', 'leaf');
    }
  };
  body.appendChild(delBtn);
}
