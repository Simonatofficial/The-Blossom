/* Study Notes widget (V2 §W-2, renamed from Elements): aggregates the Key Terms,
   Themes, Concepts and Ideas parsed from one or more *explicitly linked* Notebook
   widgets. Four tabs, search, and Class/Unit filters. Read-only — the source of
   truth is each notebook's note HTML (notebook-parse.js deriveElementsFromHtml).
   Registered under type 'elements' for data compatibility with existing
   instances; everything user-facing is "Study Notes". */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, toast } from '../ui/components.js';
import { moduleElements } from './notebook-parse.js';

const TABS = [['term', 'Terms'], ['theme', 'Themes'], ['concept', 'Concepts'], ['idea', 'Ideas']];

/** Enabled, still-existing notebook ids configured as sources. */
function sourceIds(widget) {
  return (widget.config.sources || []).filter(s => s.on && store.get('widgets', s.notebookId)).map(s => s.notebookId);
}
/** Read elements from the configured sources only (empty sources → nothing). */
function elementsOf(widget, filter = {}) {
  return moduleElements(widget, { ...filter, notebookIds: sourceIds(widget) });
}
function counts(widget) {
  const out = {};
  for (const [type] of TABS) out[type] = elementsOf(widget, { type }).length;
  return out;
}
function nbLabel(nb) {
  const page = store.all('pages').find(p => p.widgets.includes(nb.id));
  const mod = page && store.all('modules').find(m => m.pages.includes(page.id));
  return [mod?.name, page?.name, nb.name].filter(Boolean).join(' › ');
}
function allNotebooks() { return store.all('widgets').filter(w => w.type === 'notebook'); }
function ctxLabel(d) { return [d.className, d.unitName, d.topicName].filter(Boolean).join(' › '); }

function termCard(d) {
  const c = el('<div class="sn-term"></div>');
  c.appendChild(el('<div class="sn-term-name"></div>')).textContent = d.term || '(untitled)';
  if (d.definition) c.appendChild(el('<div class="sn-term-def"></div>')).textContent = d.definition;
  c.appendChild(el('<div class="sn-ctx soft"></div>')).textContent = ctxLabel(d);
  if (d.details?.length) {
    c.appendChild(el('<div class="sn-label">Notes:</div>'));
    const ul = el('<ul class="sn-bullets"></ul>');
    for (const x of d.details) ul.appendChild(el('<li></li>')).textContent = x;
    c.appendChild(ul);
  }
  if (d.examples?.length) {
    c.appendChild(el('<div class="sn-label">Examples:</div>'));
    const ol = el('<ol class="sn-examples"></ol>');
    for (const x of d.examples) ol.appendChild(el('<li></li>')).textContent = x;
    c.appendChild(ol);
  }
  return c;
}
function tagCard(d) {
  const c = el(`<div class="sn-tag anno anno-${d.type}"><span class="sn-tag-text"></span><span class="sn-ctx soft"></span></div>`);
  c.querySelector('.sn-tag-text').textContent = d.text;
  c.querySelector('.sn-ctx').textContent = ctxLabel(d);
  return c;
}

registry.register({
  type: 'elements',
  name: 'Study Notes',
  icon: 'tag',
  description: 'Key terms, themes, concepts & ideas from linked Notebooks',
  keywords: ['study', 'terms', 'glossary', 'definitions', 'vocab', 'notes'],
  external: true, internal: true,
  defaultConfig: () => ({ sources: [] }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    if (!sourceIds(widget).length) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">Link a Notebook to get started.</p>')); return; }
    const c = counts(widget);
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const row = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
    if (!total) row.appendChild(el('<span class="soft" style="font-size:0.86rem">No terms yet — tag some in your Notebook.</span>'));
    for (const [type, label] of TABS) if (c[type]) row.appendChild(el(`<span class="chip">${c[type]} ${label}</span>`));
    host.appendChild(row);
    const search = el('<input class="input" type="search" placeholder="Search terms…" style="margin-top:8px">');
    const results = el('<div class="sn-card-results"></div>');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) return;
      const hits = elementsOf(widget, { type: 'term' }).filter(d => `${d.term} ${d.definition}`.toLowerCase().includes(q)).slice(0, 5);
      for (const d of hits) {
        const r = el('<button class="list-item"><span class="li-main"><span class="li-title"></span></span></button>');
        r.querySelector('.li-title').textContent = d.term;
        r.onclick = () => ctx.openInternal(widget);
        results.appendChild(r);
      }
      if (!hits.length) results.appendChild(el('<p class="soft" style="font-size:0.82rem">No matches.</p>'));
    });
    search.onclick = (e) => e.stopPropagation();
    host.append(search, results);
  },

  renderFull(host, widget, ctx) {
    if (!sourceIds(widget).length) {
      host.innerHTML = '';
      host.appendChild(el(`<div class="empty-state">${icon('tag', 30)}<h3 style="margin:8px 0 4px">Link a Notebook</h3><p>Open this widget's settings and add a Notebook source to see its terms here.</p></div>`));
      return;
    }
    let tab = 'term', query = '', classId = '', unitId = '';
    host.innerHTML = '';

    const tabsEl = el('<div class="seg el-tabs" style="margin-bottom:10px"></div>');
    const search = el('<input class="input" type="search" placeholder="Search…" style="margin-bottom:8px">');
    const filters = el('<div class="row" style="gap:6px;margin-bottom:10px"></div>');
    const classSel = el('<select class="select"></select>');
    const unitSel = el('<select class="select"></select>');
    filters.append(classSel, unitSel);
    const listEl = el('<div class="el-list"></div>');

    const buildFilters = () => {
      const all = elementsOf(widget, {});
      const classMap = new Map(), unitMap = new Map();
      for (const d of all) { if (d.classId) classMap.set(d.classId, d.className); if (d.unitId && (!classId || d.classId === classId)) unitMap.set(d.unitId, d.unitName); }
      classSel.innerHTML = ''; classSel.appendChild(new Option('All classes', ''));
      for (const [id, name] of classMap) classSel.appendChild(new Option(name, id));
      classSel.value = classId;
      unitSel.innerHTML = ''; unitSel.appendChild(new Option('All units', ''));
      for (const [id, name] of unitMap) unitSel.appendChild(new Option(name, id));
      unitSel.value = unitId;
    };
    classSel.onchange = () => { classId = classSel.value; unitId = ''; buildFilters(); renderList(); };
    unitSel.onchange = () => { unitId = unitSel.value; renderList(); };
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderList(); });

    const buildTabs = () => {
      tabsEl.innerHTML = '';
      const c = counts(widget);
      for (const [type, label] of TABS) {
        const b = el(`<button type="button" class="${tab === type ? 'active' : ''}">${label} (${c[type]})</button>`);
        b.onclick = () => { tab = type; buildTabs(); renderList(); };
        tabsEl.appendChild(b);
      }
    };

    const renderList = () => {
      listEl.innerHTML = '';
      let items = elementsOf(widget, { type: tab, classId: classId || undefined, unitId: unitId || undefined });
      if (tab === 'term') items = items.slice().sort((a, b) => (a.term || '').localeCompare(b.term || ''));
      if (query) items = items.filter(d => `${d.term || ''} ${d.definition || ''} ${d.text || ''} ${(d.details || []).join(' ')} ${(d.examples || []).join(' ')}`.toLowerCase().includes(query));
      if (!items.length) { listEl.appendChild(el('<p class="soft" style="font-size:0.86rem">Nothing here yet.</p>')); return; }
      for (const d of items) listEl.appendChild(tab === 'term' ? termCard(d) : tagCard(d));
    };

    host.append(search, filters, tabsEl, listEl);
    buildFilters(); buildTabs(); renderList();
  },

  renderSettings(host, widget, ctx) {
    const render = () => {
      host.innerHTML = '';
      host.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">Link Notebook widgets to pull their Key Terms, Themes, Concepts and Ideas.</p>'));
      const sources = widget.config.sources || (widget.config.sources = []);
      const list = el('<div class="sn-sources"></div>');
      if (!sources.length) list.appendChild(el('<p class="soft" style="font-size:0.84rem">No notebooks linked yet.</p>'));
      const commit = () => { store.put('widgets', widget); ctx.refreshCard?.(widget); render(); };
      sources.forEach((s, i) => {
        const nb = store.get('widgets', s.notebookId);
        const row = el(`<div class="row-between sn-src-row">
          <label class="row" style="gap:8px;min-width:0"><input type="checkbox" ${s.on ? 'checked' : ''}><span class="sn-src-name" style="overflow:hidden;text-overflow:ellipsis"></span></label>
          <span class="row" style="gap:2px;flex:none">
            <button class="btn-icon sn-up" title="Move up">${icon('chevron-up', 14)}</button>
            <button class="btn-icon sn-down" title="Move down">${icon('chevron-down', 14)}</button>
            <button class="btn-icon sn-rm" title="Remove">${icon('x', 14)}</button></span></div>`);
        row.querySelector('.sn-src-name').textContent = nb ? nbLabel(nb) : '(missing notebook)';
        row.querySelector('input').onchange = (e) => { s.on = e.target.checked; commit(); };
        row.querySelector('.sn-up').onclick = () => { if (i > 0) { [sources[i - 1], sources[i]] = [sources[i], sources[i - 1]]; commit(); } };
        row.querySelector('.sn-down').onclick = () => { if (i < sources.length - 1) { [sources[i + 1], sources[i]] = [sources[i], sources[i + 1]]; commit(); } };
        row.querySelector('.sn-rm').onclick = () => { sources.splice(i, 1); commit(); };
        list.appendChild(row);
      });
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add Notebook</button>`);
      add.onclick = () => {
        const avail = allNotebooks().filter(nb => !sources.some(s => s.notebookId === nb.id));
        if (!avail.length) { toast('No other Notebook widgets to add.', 'info'); return; }
        popMenu(add, avail.map(nb => ({ label: nbLabel(nb), fn: () => { sources.push({ notebookId: nb.id, on: true }); commit(); } })));
      };
      host.append(list, add);
    };
    render();
  }
});
