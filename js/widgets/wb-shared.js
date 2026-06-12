/* World Builder shared helpers (docs/08 §5): module-scoped entry lookup,
   the [[wikilink]] picker, backlink scanning, and world-date formatting.
   Widgets stay independent — they meet only through these lookups and the
   'wb:open' event (deep-opening an entry inside its widget's view). */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { icon } from '../ui/icons.js';
import { el, openPanel, input } from '../ui/components.js';

function topPageOf(widget) {
  let w = widget;
  let guard = 0;
  while (w?.parentWidgetId && guard++ < 30) w = store.get('widgets', w.parentWidgetId);
  return w?.pageId || null;
}

/** The module containing a widget (via its top-level page). */
export function moduleOf(widget) {
  const pageId = topPageOf(widget);
  return store.all('modules').find(m => m.pages.includes(pageId));
}

/** Sibling widgets of given types inside the same module (self included). */
export function siblingWidgets(widget, types) {
  const mod = moduleOf(widget);
  if (!mod) return [];
  const pageIds = new Set(mod.pages);
  return store.all('widgets').filter(w => types.includes(w.type) && pageIds.has(topPageOf(w)));
}

const ENTRY_KINDS = {
  article: { types: ['lorewiki'], objKind: 'article', icon: 'book-open', label: (o) => o.data.title },
  civ: { types: ['civprofile'], objKind: 'civ', icon: 'shield', label: (o) => o.data.name },
  char: { types: ['worldchars'], objKind: 'wchar', icon: 'user', label: (o) => o.data.name }
};

/**
 * Every linkable entry in the widget's module.
 * @returns {{kind, id, label, widgetId, iconName}[]}
 */
export function worldEntries(widget, kinds = ['article', 'civ', 'char', 'map']) {
  const out = [];
  for (const kind of kinds) {
    if (kind === 'map') {
      for (const w of siblingWidgets(widget, ['worldmap'])) {
        if (w.id !== widget.id) out.push({ kind: 'map', id: w.id, label: w.name, widgetId: w.id, iconName: 'map' });
      }
      continue;
    }
    const spec = ENTRY_KINDS[kind];
    if (!spec) continue;
    for (const w of siblingWidgets(widget, spec.types)) {
      for (const o of store.all('objects')) {
        if (o.widgetId === w.id && o.kind === spec.objKind) {
          out.push({ kind, id: o.id, label: spec.label(o) || '(untitled)', widgetId: w.id, iconName: spec.icon });
        }
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Resolve an entry ref back to its current label/object (may be gone). */
export function resolveEntry(ref) {
  if (!ref) return null;
  if (ref.kind === 'map') {
    const w = store.get('widgets', ref.id);
    return w ? { ...ref, label: w.name, widgetId: w.id, iconName: 'map' } : null;
  }
  const spec = ENTRY_KINDS[ref.kind];
  const o = spec && store.get('objects', ref.id);
  return o ? { ...ref, label: spec.label(o) || '(untitled)', widgetId: o.widgetId, iconName: spec.icon } : null;
}

/** Navigate to an entry: open its widget's page and ask it to show the item. */
export function openEntry(ref, ctx) {
  const entry = resolveEntry(ref);
  if (!entry) return false;
  const w = store.get('widgets', entry.widgetId);
  if (!w) return false;
  if (entry.kind !== 'map') {
    w.config.pendingOpen = entry.id; // the widget honors this on next render
    store.put('widgets', w);
  }
  ctx.openInternal(w); // no-op when its view is already open —
  events.emit('wb:open', { ...entry }); // — then the live listener handles it
  return true;
}

/** While a view is mounted, deep-opens into the SAME widget happen in place
    (navigation would be a no-op — the route is already here). */
export function onWbOpen(widget, hostEl, fn) {
  const off = events.on('wb:open', (e) => {
    if (!hostEl.isConnected) { off(); return; }
    if (e.widgetId !== widget.id) return;
    delete widget.config.pendingOpen; // handled live, don't replay next open
    store.put('widgets', widget);
    fn(e);
  });
}

/** Searchable picker over the module's entries (a panel, per CR-11). */
export function openEntryPicker(widget, { kinds = ['article', 'civ', 'char', 'map'], title = 'Link to…', onPick }) {
  const d = openPanel({ title, iconName: 'link' });
  const search = input('', 'Search the world…');
  d.body.appendChild(search);
  const list = el('<div style="margin-top:10px"></div>');
  d.body.appendChild(list);
  const all = worldEntries(widget, kinds);
  const render = () => {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const hits = all.filter(e => !q || e.label.toLowerCase().includes(q)).slice(0, 60);
    if (!hits.length) list.appendChild(el('<p class="soft" style="font-size:0.84rem">Nothing here yet — articles, civilizations and characters appear as you create them.</p>'));
    for (const e of hits) {
      const li = el(`<button class="list-item"><span style="color:var(--accent)">${icon(e.iconName, 16)}</span><span class="li-main"><span class="li-title"></span><span class="li-sub">${e.kind}</span></span></button>`);
      li.querySelector('.li-title').textContent = e.label;
      li.onclick = () => { d.close(); onPick(e); };
      list.appendChild(li);
    }
  };
  search.oninput = render;
  render();
  setTimeout(() => search.focus(), 150);
}

/* ---------- [[wikilinks]] (docs/08 §5 Lore) ----------
   Typing “[[” in a wiki-enabled editor opens the picker and inserts a
   navigable link chip; backlinks are found by scanning for the data-ref. */

export function watchWikilinks(editor, widget, onChanged) {
  editor.addEventListener('input', () => {
    const sel = getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return;
    const node = sel.anchorNode;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const upto = node.textContent.slice(0, sel.anchorOffset);
    if (!upto.endsWith('[[')) return;
    openEntryPicker(widget, {
      title: 'Link an entry',
      onPick: (e) => {
        node.textContent = upto.slice(0, -2) + node.textContent.slice(sel.anchorOffset);
        const a = el(`<a class="wlink" data-kind="${e.kind}" data-ref="${e.id}" contenteditable="false"></a>`);
        a.textContent = e.label;
        const range = document.createRange();
        range.setStart(node, upto.length - 2);
        range.collapse(true);
        range.insertNode(a);
        a.after(document.createTextNode(' '));
        onChanged?.();
      }
    });
  });
}

/** Wire click-through on rendered wikilinks. */
export function wireWikilinks(container, ctx) {
  container.addEventListener('click', (e) => {
    const a = e.target.closest('.wlink');
    if (!a) return;
    e.preventDefault();
    openEntry({ kind: a.dataset.kind, id: a.dataset.ref }, ctx);
  });
}

/** Ids referenced by wikilinks inside an html string. */
export function linkedRefs(html) {
  const out = [];
  const re = /data-ref="([^"]+)"/g;
  let m;
  while ((m = re.exec(html || ''))) out.push(m[1]);
  return out;
}

/* ---------- world dates (Timeline; custom eras, year-grained v1) ---------- */

/** @param {number} year @param {{eras?: {name, start}[]}} cal */
export function fmtWorldYear(year, cal) {
  const eras = (cal?.eras || []).slice().sort((a, b) => a.start - b.start);
  let era = null;
  for (const e of eras) if (year >= e.start) era = e;
  return era ? `${year} ${era.name}` : `Year ${year}`;
}

/** Collect dated events across the module for the Timeline. */
export function worldEvents(widget) {
  const out = [];
  for (const w of siblingWidgets(widget, ['civprofile', 'worldchars'])) {
    const objKind = w.type === 'civprofile' ? 'civ' : 'wchar';
    const kind = w.type === 'civprofile' ? 'civ' : 'char';
    for (const o of store.all('objects')) {
      if (o.widgetId !== w.id || o.kind !== objKind) continue;
      for (const ev of (o.data.history || [])) {
        if (typeof ev.year !== 'number') continue;
        out.push({ year: ev.year, title: ev.title, text: ev.text || '', category: ev.category || (kind === 'civ' ? 'civilizations' : 'characters'), source: { kind, id: o.id } });
      }
    }
  }
  return out;
}
