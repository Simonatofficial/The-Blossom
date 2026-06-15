/* Notebook widget (docs/05 + V2 §25): Classes → Units → Topics → Notes. A topic
   note is plain text; "Term: definition" lines (with "- detail" and "N. example"
   follow-ons) plus Theme/Concept/Idea tags are parsed into Elements (see
   notebook-parse.js) that the Elements, Flashcard, and Quiz widgets consume. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText, confirmDialog, emptyState, toast } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { syncTopicElements, noteText, previewHtml } from './notebook-parse.js';

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
    createObject(widget.id, 'topicNote', { topicId, text: '' });
}

/** Flatten every topic across a notebook — used by flashcard/quiz generators. */
export function topicsOf(widget) {
  return classes(widget).flatMap(cl => cl.units.flatMap(u => u.topics.map(t =>
    ({ id: t.id, name: t.name, subject: cl.name, className: cl.name, classId: cl.id, unitId: u.id, unitName: u.name }))));
}

function termCount(widget, topicId) {
  return objectsOf(widget.id, 'element').filter(e => e.data.topicId === topicId && e.data.type === 'term').length;
}

/* ---- topic note editor: textarea + tag toolbar + highlighted preview ---- */
function mountEditor(host, widget, cl, unit, topic) {
  const note = topicNote(widget, topic.id);
  const bar = el('<div class="nb-tagbar row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"></div>');
  const ta = el('<textarea class="textarea nb-text" rows="9" spellcheck="true" placeholder="Mitosis: the process of cell division\n- happens in somatic cells\n1. skin cell dividing"></textarea>');
  ta.value = noteText(note);
  const preview = el('<div class="nb-preview"></div>');

  const sync = () => {
    note.data.text = ta.value; delete note.data.html; saveObject(note);
    syncTopicElements(widget, { classId: cl.id, className: cl.name, unitId: unit.id, unitName: unit.name, topic, note });
    preview.innerHTML = previewHtml(ta.value);
  };
  let timer = null;
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(sync, 400); });

  const wrap = (type) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { toast('Select some text to tag it.', 'info'); return; }
    ta.value = ta.value.slice(0, s) + `⟦${type}:${ta.value.slice(s, e)}⟧` + ta.value.slice(e);
    sync();
  };
  for (const [type, label] of [['theme', 'Theme'], ['concept', 'Concept'], ['idea', 'Idea']]) {
    const b = el(`<button class="chip" style="cursor:pointer">${icon('tag', 11)} ${label}</button>`);
    b.onclick = () => wrap(type);
    bar.appendChild(b);
  }
  bar.appendChild(el(`<span class="soft" style="font-size:0.72rem;align-self:center">“Term: definition”, then “- detail” / “1. example”</span>`));

  host.append(bar, ta, el('<h3 class="soft" style="font-size:0.74rem;margin:12px 0 4px">PREVIEW</h3>'), preview);
  preview.innerHTML = previewHtml(ta.value);
}

registry.register({
  type: 'notebook',
  name: 'Notebook',
  icon: 'book-open',
  description: 'Classes → Units → Topics → study notes',
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
    for (const cl of cls.slice(0, 4)) {
      const topics = cl.units.reduce((a, u) => a + u.topics.length, 0);
      host.appendChild(el(`<div class="row-between" style="padding:4px 0">
        <span style="font-size:0.92rem">${icon('folder', 14)} <span class="nb-s"></span></span>
        <span class="soft" style="font-size:0.78rem">${cl.units.length} unit${cl.units.length === 1 ? '' : 's'} · ${topics} topic${topics === 1 ? '' : 's'}</span></div>`))
        .querySelector('.nb-s').textContent = cl.name;
    }
  },

  renderFull(host, widget, ctx) {
    const view = { cls: null, unit: null, topic: null };
    const save = () => store.put('widgets', widget);

    const crumb = (label, fn) => { const b = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} ${label}</button>`); b.onclick = fn; return b; };
    const rowMenu = (name, onRename, onDelete) => (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: `Rename ${name}`, value: name }); if (n) onRename(n); } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${name}”?` })) onDelete(); } }
    ]); };

    const render = () => {
      host.innerHTML = '';

      if (view.topic) { // note editor
        host.appendChild(crumb(`${view.cls.name} › ${view.unit.name}`, () => { view.topic = null; render(); }));
        host.appendChild(el(`<h2 style="margin-bottom:10px"></h2>`)).textContent = view.topic.name;
        mountEditor(host, widget, view.cls, view.unit, view.topic);
        return;
      }

      if (view.unit) { // topics
        host.appendChild(crumb(view.cls.name, () => { view.unit = null; render(); }));
        host.appendChild(el(`<h2 style="margin-bottom:10px"></h2>`)).textContent = view.unit.name;
        for (const t of view.unit.topics) {
          const li = el(`<button class="list-item">${icon('note', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${termCount(widget, t.id)} key terms</span></span><span class="btn-icon t-menu">${icon('more', 14)}</span></button>`);
          li.querySelector('.li-title').textContent = t.name;
          li.onclick = (e) => { if (e.target.closest('.t-menu')) return; view.topic = t; render(); };
          li.querySelector('.t-menu').addEventListener('click', rowMenu(t.name,
            (n) => { t.name = n; save(); render(); },
            () => { view.unit.topics = view.unit.topics.filter(x => x.id !== t.id); save(); render(); }));
          host.appendChild(li);
        }
        const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add topic</button>`);
        add.onclick = async () => { const n = await promptText({ title: 'New topic', label: 'Topic', placeholder: 'Mitosis' }); if (n) { view.unit.topics.push({ id: ulid(), name: n }); save(); render(); } };
        host.appendChild(add);
        return;
      }

      if (view.cls) { // units
        host.appendChild(crumb('Classes', () => { view.cls = null; render(); }));
        host.appendChild(el(`<h2 style="margin-bottom:10px"></h2>`)).textContent = view.cls.name;
        for (const u of view.cls.units) {
          const tcount = u.topics.length;
          const li = el(`<button class="list-item">${icon('layers', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${tcount} topic${tcount === 1 ? '' : 's'}</span></span><span class="btn-icon u-menu">${icon('more', 14)}</span></button>`);
          li.querySelector('.li-title').textContent = u.name;
          li.onclick = (e) => { if (e.target.closest('.u-menu')) return; view.unit = u; render(); };
          li.querySelector('.u-menu').addEventListener('click', rowMenu(u.name,
            (n) => { u.name = n; save(); render(); },
            () => { view.cls.units = view.cls.units.filter(x => x.id !== u.id); save(); render(); }));
          host.appendChild(li);
        }
        const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add unit</button>`);
        add.onclick = async () => { const n = await promptText({ title: 'New unit', label: 'Unit', placeholder: 'Unit 3: Cell Division' }); if (n) { view.cls.units.push({ id: ulid(), name: n, topics: [] }); save(); render(); } };
        host.appendChild(add);
        return;
      }

      // classes
      const cls = classes(widget);
      if (!cls.length) host.appendChild(emptyState('book-open', 'A fresh notebook. Add your first class?'));
      for (const cl of cls) {
        const topics = cl.units.reduce((a, u) => a + u.topics.length, 0);
        const li = el(`<button class="list-item">${icon('folder', 18)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${cl.units.length} unit${cl.units.length === 1 ? '' : 's'} · ${topics} topic${topics === 1 ? '' : 's'}</span></span><span class="btn-icon c-menu">${icon('more', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = cl.name;
        li.onclick = (e) => { if (e.target.closest('.c-menu')) return; view.cls = cl; render(); };
        li.querySelector('.c-menu').addEventListener('click', rowMenu(cl.name,
          (n) => { cl.name = n; save(); render(); },
          () => { widget.config.classes = classes(widget).filter(x => x.id !== cl.id); save(); render(); }));
        host.appendChild(li);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add class</button>`);
      add.onclick = async () => { const n = await promptText({ title: 'New class', label: 'Class', placeholder: 'Biology 101' }); if (n) { classes(widget).push({ id: ulid(), name: n, units: [] }); save(); render(); } };
      host.appendChild(add);
    };
    render();
  }
});
