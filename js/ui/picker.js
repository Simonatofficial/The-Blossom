/* Pickers (docs/02 + docs/04): value-link picker (module → page → widget →
   output, live preview), app-node picker (for note links), and the
   "+ Add widget" gallery (types + From Blossom code). */

import { store } from '../core/store.js';
import { router } from '../core/router.js';
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

/* ---------- "+ Add widget" gallery + widget search (CR-2) ---------- */

function widgetPath(w) {
  let top = w;
  let guard = 0;
  while (top?.parentWidgetId && guard++ < 30) top = store.get('widgets', top.parentWidgetId);
  const page = top?.pageId && store.get('pages', top.pageId);
  const mod = page && store.all('modules').find(m => m.pages.includes(page.id));
  return { page, mod, label: mod && page ? `${mod.name} › ${page.name}` : null };
}

/**
 * @param {{pageId?: string, parentWidgetId?: string, onCreated?: (w: object) => void}} opts
 */
export function openWidgetGallery(opts) {
  const d = openDrawer({ title: 'Plant a widget', iconName: 'sprout' });
  let query = '';
  let scope = 'module'; // 'module' | 'all'

  const search = el('<input class="input" type="search" placeholder="Search widgets…" style="margin-bottom:8px">');
  const scopeSeg = el('<div style="margin-bottom:12px"></div>');
  const buildScopeSeg = () => {
    scopeSeg.innerHTML = '';
    const s = el('<div class="seg"></div>');
    for (const [value, label] of [['module', 'This module'], ['all', 'Everywhere']]) {
      const b = el(`<button type="button" class="${scope === value ? 'active' : ''}">${label}</button>`);
      b.onclick = () => { scope = value; buildScopeSeg(); renderResults(); };
      s.appendChild(b);
    }
    scopeSeg.appendChild(s);
  };
  buildScopeSeg();
  const results = el('<div></div>');
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderResults(); });
  d.body.append(search, scopeSeg, results);

  const matchesType = (def) =>
    !query ||
    def.name.toLowerCase().includes(query) ||
    (def.description || '').toLowerCase().includes(query) ||
    (def.keywords || []).some(k => k.includes(query));

  const renderResults = () => {
    results.innerHTML = '';

    if (!query) {
      const fromCode = el(`<button class="list-item">${icon('code', 18)}<span class="li-main"><span class="li-title">From Blossom code</span><span class="li-sub">Paste a copied widget</span></span></button>`);
      fromCode.onclick = async () => {
        const { openCodeImport } = await import('./settings.js');
        d.close();
        openCodeImport({ pageId: opts.pageId });
      };
      results.appendChild(fromCode);
      results.appendChild(el('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">'));
    }

    // group 1: add new (widget types)
    const types = registry.all()
      .filter(def => !(opts.parentWidgetId && def.noNest) && matchesType(def))
      .sort((a, b) => a.name.localeCompare(b.name));

    const typeRow = (def) => {
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
      return li;
    };

    if (query) {
      // searching: flat, ranked list so matches aren't hidden inside folds
      results.appendChild(el('<h3 class="soft" style="font-size:0.74rem;margin:2px 0 6px">ADD NEW</h3>'));
      for (const def of types) results.appendChild(typeRow(def));
      if (!types.length) {
        results.appendChild(el('<p class="soft" style="font-size:0.85rem;padding:6px 2px">Nothing matches — try “notes” or “graph”.</p>'));
      }
    } else {
      // browsing: collapsible categories, like the Modules & Widgets panels (P-3)
      const groups = new Map();
      for (const def of types) {
        const cat = registry.categoryOf(def.type);
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(def);
      }
      const single = groups.size <= 1;
      for (const [cat, defs] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
        const det = el(`<details class="nav-group"${single ? ' open' : ''}><summary><span class="nav-chev">${icon('chevron-right', 14)}</span><span class="grow"></span><span class="nav-count"></span></summary><div class="nav-group-body"></div></details>`);
        det.querySelector('summary .grow').textContent = cat;
        det.querySelector('.nav-count').textContent = defs.length;
        const body = det.querySelector('.nav-group-body');
        for (const def of defs) body.appendChild(typeRow(def));
        results.appendChild(det);
      }
    }

    // group 2: your widgets (existing instances, navigate on tap)
    if (query) {
      const currentModuleId = router.current().moduleId;
      const instances = store.all('widgets')
        .filter(w => w.name.toLowerCase().includes(query))
        .map(w => ({ w, path: widgetPath(w) }))
        .filter(({ path }) => path.label && (scope === 'all' || path.mod?.id === currentModuleId))
        .slice(0, 12);
      if (instances.length) {
        results.appendChild(el('<h3 class="soft" style="font-size:0.74rem;margin:12px 0 6px">YOUR WIDGETS</h3>'));
        for (const { w, path } of instances) {
          const def = registry.get(w.type);
          const li = el(`<button class="list-item"><span style="color:var(--text-soft)">${icon(def?.icon || 'circle', 18)}</span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${icon('chevron-right', 16)}</button>`);
          li.querySelector('.li-title').textContent = w.name;
          li.querySelector('.li-sub').textContent = path.label;
          li.onclick = () => {
            d.close();
            router.goWidget(w.id); // lands on the page; the card glows briefly
          };
          results.appendChild(li);
        }
      }
    }
  };

  renderResults();
  if (innerWidth >= 600) setTimeout(() => search.focus(), 120); // autofocus on desktop only
}
