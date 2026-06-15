/* Notebook widget (docs/05 + V2 §W-1): Classes → Units → Topics → rich-text
   notes. The notes area lives in notebook-editor.js; study annotations there are
   parsed (notebook-parse.js) into Element objects the Study Notes, Flashcard, and
   Quiz widgets consume. Full-page view is a 3-column layout on wide screens and a
   drill-down on phones. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText, confirmDialog, emptyState, toast } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';
import { htmlToText } from './notebook-parse.js';
import { renderTopicArea } from './notebook-editor.js';

/** Classes (migrating a legacy 2-level subjects notebook in place). */
function classes(widget) {
  const c = widget.config;
  if (!c.classes) {
    c.classes = (c.subjects || []).map(s => ({ id: s.id || ulid(), name: s.name, units: [{ id: ulid(), name: 'General', topics: s.topics || [] }] }));
    delete c.subjects;
    store.put('widgets', widget);
  }
  return c.classes;
}

/** The note object for a topic (created on demand). */
export function topicNote(widget, topicId) {
  return objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === topicId) ||
    createObject(widget.id, 'topicNote', { topicId, html: '' });
}

/** Flatten every topic across a notebook — used by flashcard/quiz generators. */
export function topicsOf(widget) {
  return classes(widget).flatMap(cl => cl.units.flatMap(u => u.topics.map(t =>
    ({ id: t.id, name: t.name, subject: cl.name, className: cl.name, classId: cl.id, unitId: u.id, unitName: u.name }))));
}

function termCount(widget, topicId) {
  return objectsOf(widget.id, 'element').filter(e => e.data.topicId === topicId && e.data.type === 'term').length;
}

/** Most-recently-edited topic across the notebook (for the card). */
function lastEdited(widget) {
  const notes = objectsOf(widget.id, 'topicNote').filter(n => n.data.editedAt);
  if (!notes.length) return null;
  notes.sort((a, b) => b.data.editedAt - a.data.editedAt);
  const note = notes[0];
  for (const cl of classes(widget)) for (const u of cl.units) {
    const t = u.topics.find(x => x.id === note.data.topicId);
    if (t) return { crumb: `${cl.name} › ${u.name} › ${t.name}`, snippet: htmlToText(note.data.html).replace(/\s+/g, ' ').trim(), ts: note.data.editedAt };
  }
  return null;
}

registry.register({
  type: 'notebook',
  name: 'Notebook',
  icon: 'book-open',
  description: 'Classes → Units → Topics → rich study notes',
  keywords: ['study', 'school', 'class', 'unit', 'topic', 'term'],
  external: true, internal: true,
  defaultConfig: () => ({ classes: [] }),

  outputs: (widget) => [
    { key: 'topics', name: 'Topics', dayKeyed: false, get: () => topicsOf(widget).length },
    { key: 'terms', name: 'Key terms', dayKeyed: false, get: () => objectsOf(widget.id, 'element').filter(e => e.data.type === 'term').length }
  ],

  renderCard(host, widget) {
    host.innerHTML = '';
    const cls = classes(widget);
    if (!cls.length) { host.appendChild(el('<p class="soft">Tap to plant your first class.</p>')); return; }
    const last = lastEdited(widget);
    if (last) {
      const card = el(`<div class="nb-card-last">
        <div class="nb-card-crumb soft"></div>
        <div class="nb-card-snip"></div>
        <div class="nb-card-time soft"></div></div>`);
      card.querySelector('.nb-card-crumb').textContent = last.crumb;
      card.querySelector('.nb-card-snip').textContent = last.snippet || 'No notes yet.';
      card.querySelector('.nb-card-time').textContent = `Edited ${new Date(last.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      host.appendChild(card);
      return;
    }
    for (const cl of cls.slice(0, 4)) {
      const topics = cl.units.reduce((a, u) => a + u.topics.length, 0);
      host.appendChild(el(`<div class="row-between" style="padding:4px 0">
        <span style="font-size:0.92rem">${icon('folder', 14)} <span class="nb-s"></span></span>
        <span class="soft" style="font-size:0.78rem">${cl.units.length} unit${cl.units.length === 1 ? '' : 's'} · ${topics} topic${topics === 1 ? '' : 's'}</span></div>`))
        .querySelector('.nb-s').textContent = cl.name;
    }
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);
    const view = { cls: null, unit: null, topic: null };
    let wide = window.innerWidth >= 720;

    const rowMenu = (anchor, name, onRename, onDelete) => popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: `Rename ${name}`, value: name }); if (n) onRename(n); } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${name}”?` })) onDelete(); } }
    ]);

    /** One level's list (items + add button), reused by both layouts. */
    const levelList = ({ items, iconName, subOf, selectedId, onOpen, onRename, onDelete, onAdd, addLabel }) => {
      const wrap = el('<div class="nb-list"></div>');
      for (const it of items) {
        const li = el(`<button class="list-item ${selectedId === it.id ? 'active' : ''}">${icon(iconName, 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="btn-icon nb-m">${icon('more', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = it.name;
        li.querySelector('.li-sub').textContent = subOf(it);
        li.onclick = (e) => { if (e.target.closest('.nb-m')) return; onOpen(it); };
        li.querySelector('.nb-m').addEventListener('click', (e) => { e.stopPropagation(); rowMenu(e.currentTarget, it.name, (n) => onRename(it, n), () => onDelete(it)); });
        wrap.appendChild(li);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} ${addLabel}</button>`);
      add.onclick = onAdd;
      wrap.appendChild(add);
      return wrap;
    };

    const unitSub = (cl) => `${cl.units.length} unit${cl.units.length === 1 ? '' : 's'} · ${cl.units.reduce((a, u) => a + u.topics.length, 0)} topic${cl.units.reduce((a, u) => a + u.topics.length, 0) === 1 ? '' : 's'}`;
    const topicSub = (u) => `${u.topics.length} topic${u.topics.length === 1 ? '' : 's'}`;
    const termSub = (t) => `${termCount(widget, t.id)} key term${termCount(widget, t.id) === 1 ? '' : 's'}`;

    const classList = () => levelList({
      items: classes(widget), iconName: 'folder', subOf: unitSub, selectedId: view.cls?.id,
      onOpen: (cl) => { view.cls = cl; view.unit = null; view.topic = null; render(); },
      onRename: (cl, n) => { cl.name = n; save(); render(); },
      onDelete: (cl) => { widget.config.classes = classes(widget).filter(x => x.id !== cl.id); if (view.cls?.id === cl.id) { view.cls = view.unit = view.topic = null; } save(); render(); },
      onAdd: async () => { const n = await promptText({ title: 'New class', label: 'Class', placeholder: 'Biology 101' }); if (n) { classes(widget).push({ id: ulid(), name: n, units: [] }); save(); render(); } },
      addLabel: 'Add class'
    });
    const unitList = () => levelList({
      items: view.cls.units, iconName: 'layers', subOf: topicSub, selectedId: view.unit?.id,
      onOpen: (u) => { view.unit = u; view.topic = null; render(); },
      onRename: (u, n) => { u.name = n; save(); render(); },
      onDelete: (u) => { view.cls.units = view.cls.units.filter(x => x.id !== u.id); if (view.unit?.id === u.id) { view.unit = view.topic = null; } save(); render(); },
      onAdd: async () => { const n = await promptText({ title: 'New unit', label: 'Unit', placeholder: 'Unit 3: Cell Division' }); if (n) { view.cls.units.push({ id: ulid(), name: n, topics: [] }); save(); render(); } },
      addLabel: 'Add unit'
    });
    const topicList = () => levelList({
      items: view.unit.topics, iconName: 'note', subOf: termSub, selectedId: view.topic?.id,
      onOpen: (t) => { view.topic = t; render(); },
      onRename: (t, n) => { t.name = n; save(); render(); },
      onDelete: (t) => { view.unit.topics = view.unit.topics.filter(x => x.id !== t.id); if (view.topic?.id === t.id) view.topic = null; save(); render(); },
      onAdd: async () => { const n = await promptText({ title: 'New topic', label: 'Topic', placeholder: 'Mitosis' }); if (n) { view.unit.topics.push({ id: ulid(), name: n }); save(); render(); } },
      addLabel: 'Add topic'
    });

    const notesArea = (mountInto) => {
      const t = view.topic;
      const tctx = { classId: view.cls.id, className: view.cls.name, unitId: view.unit.id, unitName: view.unit.name, topic: t, note: topicNote(widget, t.id) };
      renderTopicArea(mountInto, widget, tctx, ctx);
    };

    const crumb = (label, fn) => { const b = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} ${label}</button>`); b.onclick = fn; return b; };
    const colWrap = (title, body) => { const c = el('<div class="nb-col"></div>'); c.appendChild(el('<h3 class="nb-col-h soft"></h3>')).textContent = title; c.appendChild(body); return c; };

    const renderWide = () => {
      host.innerHTML = '';
      const cols = el('<div class="nb-wide"></div>');
      cols.appendChild(colWrap('Classes', classes(widget).length ? classList() : (() => { const w = el('<div></div>'); w.appendChild(emptyState('book-open', 'Add your first class.')); w.appendChild(classList()); return w; })()));
      cols.appendChild(colWrap('Units', view.cls ? unitList() : el('<p class="soft nb-hint">Pick a class.</p>')));
      cols.appendChild(colWrap('Topics', view.unit ? topicList() : el('<p class="soft nb-hint">Pick a unit.</p>')));
      host.appendChild(cols);
      const notes = el('<div class="nb-notes"></div>');
      if (view.topic) { notes.appendChild(el('<div class="nb-notes-crumb soft"></div>')).textContent = `${view.cls.name} › ${view.unit.name} › ${view.topic.name}`; notesArea(notes.appendChild(el('<div></div>'))); }
      else notes.appendChild(el('<p class="soft nb-hint" style="text-align:center;padding:24px">Pick a topic to read or edit its notes.</p>'));
      host.appendChild(notes);
    };

    const renderNarrow = () => {
      host.innerHTML = '';
      if (view.topic) {
        host.appendChild(crumb(`${view.cls.name} › ${view.unit.name}`, () => { view.topic = null; render(); }));
        host.appendChild(el('<h2 style="margin-bottom:10px"></h2>')).textContent = view.topic.name;
        notesArea(host.appendChild(el('<div></div>')));
        return;
      }
      if (view.unit) {
        host.appendChild(crumb(view.cls.name, () => { view.unit = null; render(); }));
        host.appendChild(el('<h2 style="margin-bottom:10px"></h2>')).textContent = view.unit.name;
        host.appendChild(topicList());
        return;
      }
      if (view.cls) {
        host.appendChild(crumb('Classes', () => { view.cls = null; render(); }));
        host.appendChild(el('<h2 style="margin-bottom:10px"></h2>')).textContent = view.cls.name;
        host.appendChild(unitList());
        return;
      }
      if (!classes(widget).length) host.appendChild(emptyState('book-open', 'A fresh notebook. Add your first class?'));
      host.appendChild(classList());
    };

    const render = () => (wide ? renderWide() : renderNarrow());
    render();

    // re-render only when the layout breakpoint is actually crossed
    const ro = new ResizeObserver(() => {
      const nowWide = host.clientWidth >= 720;
      if (nowWide !== wide) { wide = nowWide; render(); }
    });
    ro.observe(host);
  }
});
