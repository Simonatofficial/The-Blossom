/* Pickers (docs/02 + docs/04): value-link picker (module → page → widget →
   output, live preview), app-node picker (for note links), and the
   "+ Add widget" gallery (types + From Blossom code). */

import { store } from '../core/store.js';
import { icon, iconOrEmoji } from './icons.js';
import { el, toast, openDrawer, emptyState } from './components.js';
import * as values from '../core/values.js';
import { registry } from '../widgets/registry.js';

function listItem({ iconHtml, title, sub = '', onClick }) {
  const li = el(`<button class="list-item"><span class="li-icon" style="color:var(--accent)">${iconHtml}</span><span class="li-main"><span class="li-title"></span>${sub ? '<span class="li-sub"></span>' : ''}</span>${icon('chevron-right', 16)}</button>`);
  li.querySelector('.li-title').textContent = title;
  if (sub) li.querySelector('.li-sub').textContent = sub;
  li.onclick = onClick;
  return li;
}

function pageWidgets(page) {
  return page.widgets.map(id => store.get('widgets', id)).filter(Boolean);
}

/* ---------- value link picker ---------- */

/**
 * @param {{consumerWidget: object, onPick: (link: object) => void}} opts
 */
export function openLinkPicker({ consumerWidget, onPick }) {
  const d = openDrawer({ title: 'Link a value', iconName: 'link' });

  const showModules = () => {
    d.setTitle('Link a value');
    d.body.innerHTML = '';
    for (const mod of store.all('modules')) {
      d.body.appendChild(listItem({
        iconHtml: iconOrEmoji(mod.icon, 18), title: mod.name,
        sub: `${mod.pages.length} page${mod.pages.length === 1 ? '' : 's'}`,
        onClick: () => showPages(mod)
      }));
    }
  };

  const showPages = (mod) => {
    d.setTitle(mod.name);
    d.body.innerHTML = '';
    for (const pid of mod.pages) {
      const page = store.get('pages', pid);
      if (!page) continue;
      const sources = pageWidgets(page).filter(w => values.outputsOf(w).length);
      d.body.appendChild(listItem({
        iconHtml: iconOrEmoji(page.icon, 18), title: page.name,
        sub: `${sources.length} linkable widget${sources.length === 1 ? '' : 's'}`,
        onClick: () => showWidgets(mod, page)
      }));
    }
  };

  const showWidgets = (mod, page) => {
    d.setTitle(page.name);
    d.body.innerHTML = '';
    const sources = pageWidgets(page).filter(w => values.outputsOf(w).length);
    if (!sources.length) {
      d.body.appendChild(emptyState('link', 'No widgets here share values yet.'));
      return;
    }
    for (const w of sources) {
      const def = registry.get(w.type);
      d.body.appendChild(listItem({
        iconHtml: icon(def?.icon || 'circle', 18), title: w.name, sub: def?.name || w.type,
        onClick: () => showOutputs(w)
      }));
    }
  };

  const showOutputs = (sourceWidget) => {
    d.setTitle(sourceWidget.name);
    d.body.innerHTML = '';
    for (const out of values.outputsOf(sourceWidget)) {
      let preview = null;
      try { preview = out.get(null); } catch { /* no preview */ }
      const li = el(`<button class="list-item"><span style="color:var(--accent)">${icon('activity', 18)}</span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="chip accent"></span></button>`);
      li.querySelector('.li-title').textContent = out.name;
      li.querySelector('.li-sub').textContent = out.dayKeyed ? 'daily value' : 'current value';
      li.querySelector('.chip').textContent = preview == null ? '—' : `now: ${Math.round(preview * 100) / 100}`;
      li.onclick = () => {
        if (values.wouldCycle(consumerWidget.id, sourceWidget.id)) {
          toast('These two widgets would feed each other forever.', 'info');
          return;
        }
        onPick({ sourceWidgetId: sourceWidget.id, output: out.key, transform: { scale: 1 } });
        d.close();
      };
      d.body.appendChild(li);
    }
  };

  showModules();
}

/* ---------- app node picker (notes links etc.) ---------- */

/**
 * Pick a module, page, widget, or object. onPick receives
 * { kind: 'module'|'page'|'widget', id, label }.
 */
export function openNodePicker({ onPick }) {
  const d = openDrawer({ title: 'Link to…', iconName: 'link' });
  const choose = (kind, rec, label) => { onPick({ kind, id: rec.id, label }); d.close(); };

  const chooseRow = (label, fn) => {
    const b = el(`<button class="btn" style="width:100%;margin-bottom:12px">${icon('check', 15)} <span></span></button>`);
    b.querySelector('span').textContent = label;
    b.onclick = fn;
    return b;
  };

  const showModules = () => {
    d.body.innerHTML = '';
    for (const mod of store.all('modules')) {
      d.body.appendChild(listItem({
        iconHtml: iconOrEmoji(mod.icon, 18), title: mod.name, sub: 'module',
        onClick: () => showPages(mod)
      }));
    }
  };

  const showPages = (mod) => {
    d.body.innerHTML = '';
    d.body.appendChild(chooseRow(`Link to “${mod.name}”`, () => choose('module', mod, mod.name)));
    for (const pid of mod.pages) {
      const page = store.get('pages', pid);
      if (page) d.body.appendChild(listItem({
        iconHtml: iconOrEmoji(page.icon, 18), title: page.name, sub: 'page',
        onClick: () => showWidgetsIn(mod, page)
      }));
    }
  };

  const showWidgetsIn = (mod, page) => {
    d.body.innerHTML = '';
    d.body.appendChild(chooseRow(`Link to “${page.name}”`, () => choose('page', page, `${mod.name} › ${page.name}`)));
    for (const w of pageWidgets(page)) {
      const def = registry.get(w.type);
      const li = listItem({
        iconHtml: icon(def?.icon || 'circle', 18), title: w.name, sub: def?.name || w.type,
        onClick: () => choose('widget', w, w.name)
      });
      d.body.appendChild(li);
    }
  };

  showModules();
}

/* ---------- "+ Add widget" gallery ---------- */

/**
 * @param {{pageId?: string, parentWidgetId?: string, onCreated?: (w: object) => void}} opts
 */
export function openWidgetGallery(opts) {
  const d = openDrawer({ title: 'Plant a widget', iconName: 'sprout' });

  const fromCode = el(`<button class="list-item">${icon('code', 18)}<span class="li-main"><span class="li-title">From Blossom code</span><span class="li-sub">Paste a copied widget</span></span></button>`);
  fromCode.onclick = async () => {
    const { openCodeImport } = await import('./settings.js');
    d.close();
    openCodeImport({ pageId: opts.pageId });
  };
  d.body.appendChild(fromCode);
  d.body.appendChild(el('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">'));

  for (const def of registry.all().sort((a, b) => a.name.localeCompare(b.name))) {
    if (opts.parentWidgetId && def.noNest) continue;
    const li = el(`<button class="list-item"><span style="color:var(--accent)">${icon(def.icon, 18)}</span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${icon('plus', 16)}</button>`);
    li.querySelector('.li-title').textContent = def.name;
    li.querySelector('.li-sub').textContent = def.description || '';
    li.onclick = async () => {
      d.close();
      if (def.wizard) { def.wizard(opts); return; } // e.g. Habit → COSMOS wizard (docs/06)
      const { createWidget } = await import('../widgets/base.js');
      const w = createWidget(def.type, opts);
      opts.onCreated?.(w);
    };
    d.body.appendChild(li);
  }
}
