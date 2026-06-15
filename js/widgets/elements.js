/* Elements widget (V2 §25): aggregates the Key Terms, Themes, Concepts, and
   Ideas parsed from every Notebook in the module. Four tabs, search, filter by
   class/unit, and export to a study sheet. Read-only — the source of truth is
   each notebook's note text (notebook-parse.js). */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { moduleElements } from './notebook-parse.js';

const TABS = [['term', 'Terms'], ['theme', 'Themes'], ['concept', 'Concepts'], ['idea', 'Ideas']];

function counts(widget) {
  const out = {};
  for (const [type] of TABS) out[type] = moduleElements(widget, { type }).length;
  return out;
}

function ctxLabel(d) { return [d.topicName, d.unitName, d.className].filter(Boolean).join(' › '); }

function termCard(d) {
  const c = el(`<details class="el-card el-term"><summary><strong class="el-term-name"></strong><span class="el-ctx soft"></span></summary><div class="el-body"></div></details>`);
  c.querySelector('.el-term-name').textContent = d.term;
  c.querySelector('.el-ctx').textContent = ctxLabel(d);
  const body = c.querySelector('.el-body');
  if (d.definition) body.appendChild(el(`<p class="el-def"></p>`)).textContent = d.definition;
  if (d.details?.length) { const ul = el('<ul class="el-details"></ul>'); for (const x of d.details) ul.appendChild(el('<li></li>')).textContent = x; body.appendChild(ul); }
  if (d.examples?.length) { const ol = el('<ol class="el-examples"></ol>'); for (const x of d.examples) ol.appendChild(el('<li></li>')).textContent = x; body.appendChild(ol); }
  return c;
}

function tagCard(d) {
  const c = el(`<div class="el-card el-tag tag-${d.type}"><span class="el-text"></span><span class="el-ctx soft"></span></div>`);
  c.querySelector('.el-text').textContent = d.text;
  c.querySelector('.el-ctx').textContent = ctxLabel(d);
  return c;
}

function exportSheet(widget, scopeLabel) {
  const lines = [`Study sheet — ${scopeLabel}`, ''];
  for (const [type, label] of TABS) {
    const items = moduleElements(widget, { type });
    if (!items.length) continue;
    lines.push(`## ${label}`);
    for (const d of items) {
      if (type === 'term') {
        lines.push(`- ${d.term}: ${d.definition || ''}`);
        for (const x of d.details || []) lines.push(`    - ${x}`);
        for (const [i, x] of (d.examples || []).entries()) lines.push(`    ${i + 1}. ${x}`);
      } else lines.push(`- ${d.text}  (${ctxLabel(d)})`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).then(() => toast('Study sheet copied', 'copy'), () => {});
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'study-sheet.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch { /* clipboard already covered it */ }
}

registry.register({
  type: 'elements',
  name: 'Elements',
  icon: 'tag',
  description: 'Key terms, themes, concepts & ideas from your notes',
  keywords: ['study', 'terms', 'glossary', 'definitions', 'vocab'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget) {
    host.innerHTML = '';
    const c = counts(widget);
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (!total) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">No elements yet — add “Term: definition” lines in a Notebook.</p>')); return; }
    const row = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
    for (const [type, label] of TABS) if (c[type]) row.appendChild(el(`<span class="chip">${c[type]} ${label}</span>`));
    host.appendChild(row);
  },

  renderFull(host, widget, ctx) {
    let tab = 'term', query = '', classId = '', unitId = '';
    host.innerHTML = '';

    const tabsEl = el('<div class="seg el-tabs" style="margin-bottom:10px"></div>');
    const search = el('<input class="input" type="search" placeholder="Search elements…" style="margin-bottom:8px">');
    const filters = el('<div class="row" style="gap:6px;margin-bottom:10px"></div>');
    const classSel = el('<select class="select"></select>');
    const unitSel = el('<select class="select"></select>');
    filters.append(classSel, unitSel);
    const listEl = el('<div class="el-list"></div>');

    const buildFilters = () => {
      const all = moduleElements(widget, {});
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
      let items = moduleElements(widget, { type: tab, classId: classId || undefined, unitId: unitId || undefined });
      if (query) items = items.filter(d => `${d.term || ''} ${d.definition || ''} ${d.text || ''} ${(d.details || []).join(' ')} ${(d.examples || []).join(' ')}`.toLowerCase().includes(query));
      if (!items.length) { listEl.appendChild(el('<p class="soft" style="font-size:0.86rem">Nothing here yet.</p>')); return; }
      for (const d of items) listEl.appendChild(tab === 'term' ? termCard(d) : tagCard(d));
    };

    const exportBtn = el(`<button class="btn-soft-wide" style="margin-top:12px">${icon('download', 15)} Export study sheet</button>`);
    exportBtn.onclick = () => exportSheet(widget, classId ? classSel.options[classSel.selectedIndex].text : 'All classes');

    host.append(search, filters, tabsEl, listEl, exportBtn);
    buildFilters(); buildTabs(); renderList();
  }
});
