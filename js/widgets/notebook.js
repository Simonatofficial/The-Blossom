/* Notebook widget (V2 §W-1 + flexible-tree fix): a generic node tree with four
   named, optional levels — Class → Section → Unit → Topic. Any node holds its own
   rich-text notes (notebook-editor.js) AND child nodes, so you can nest all four
   or go Class→Topic directly. Annotations are parsed (notebook-parse.js) into
   Element objects the Study Notes, Flashcard, and Quiz widgets consume. A doc
   converter turns Title/H1/H2/H3 + body text into a Class/Section/Unit/Topic tree. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText, confirmDialog, emptyState, toast, openDrawer } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';
import { htmlToText } from './notebook-parse.js';
import { renderTopicArea } from './notebook-editor.js';

const LEVELS = ['class', 'section', 'unit', 'topic'];
const LMETA = { class: { label: 'Class', icon: 'folder' }, section: { label: 'Section', icon: 'layers' }, unit: { label: 'Unit', icon: 'book-open' }, topic: { label: 'Topic', icon: 'note' } };
const lidx = (lv) => LEVELS.indexOf(lv);
/** Levels addable under a node of the given level (always at least Topic). */
function childLevels(level) { const below = LEVELS.slice(lidx(level) + 1); return below.length ? below : ['topic']; }

/** The node tree (migrating the W-1 classes / legacy subjects model in place). */
export function tree(widget) {
  const c = widget.config;
  if (!c.tree) {
    const classesArr = c.classes || (c.subjects || []).map(s => ({ id: s.id || ulid(), name: s.name, units: [{ id: ulid(), name: 'General', topics: s.topics || [] }] }));
    c.tree = (classesArr || []).map(cl => ({ id: cl.id, name: cl.name, level: 'class', children: (cl.units || []).map(u => ({ id: u.id, name: u.name, level: 'unit', children: (u.topics || []).map(t => ({ id: t.id, name: t.name, level: 'topic', children: [] })) })) }));
    delete c.classes; delete c.subjects;
    store.put('widgets', widget);
  }
  return c.tree;
}
function walk(nodes, fn, path = []) { for (const n of nodes) { fn(n, path); if (n.children) walk(n.children, fn, [...path, n]); } }
function pathTo(widget, id) { let res = null; walk(tree(widget), (n, p) => { if (n.id === id) res = [...p, n]; }); return res; }
function childrenArr(widget, id) { if (!id) return tree(widget); const p = pathTo(widget, id); const n = p && p[p.length - 1]; if (!n) return tree(widget); if (!n.children) n.children = []; return n.children; }
function descendantIds(node) { const out = [node.id]; for (const c of node.children || []) out.push(...descendantIds(c)); return out; }
function removeNode(widget, id) {
  const node = pathTo(widget, id)?.slice(-1)[0]; if (!node) return;
  const ids = new Set(descendantIds(node));
  for (const o of objectsOf(widget.id, 'topicNote')) if (ids.has(o.data.topicId)) store.trash('objects', o.id);
  for (const o of objectsOf(widget.id, 'element')) if (ids.has(o.data.topicId)) store.del('objects', o.id);
  const prune = (arr) => { const i = arr.findIndex(x => x.id === id); if (i >= 0) { arr.splice(i, 1); return true; } return arr.some(x => x.children && prune(x.children)); };
  prune(tree(widget));
}

/** The note object for any node (created on demand). */
export function topicNote(widget, nodeId) {
  return objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === nodeId) ||
    createObject(widget.id, 'topicNote', { topicId: nodeId, html: '' });
}

/** Topic-level nodes with ancestry — used by flashcard/quiz generators. */
export function topicsOf(widget) {
  const out = [];
  walk(tree(widget), (n, p) => {
    if (n.level !== 'topic') return;
    const full = [...p, n], anc = (lv) => full.find(x => x.level === lv);
    out.push({ id: n.id, name: n.name, subject: anc('class')?.name, className: anc('class')?.name, classId: anc('class')?.id, sectionName: anc('section')?.name, unitId: anc('unit')?.id, unitName: anc('unit')?.name });
  });
  return out;
}

function termCount(widget, nodeId) { return objectsOf(widget.id, 'element').filter(e => e.data.topicId === nodeId && e.data.type === 'term').length; }
function countAll(widget) { let n = 0; walk(tree(widget), () => n++); return n; }

/** Most-recently-edited node across the notebook (for the card). */
function lastEdited(widget) {
  const notes = objectsOf(widget.id, 'topicNote').filter(n => n.data.editedAt && n.data.html);
  if (!notes.length) return null;
  notes.sort((a, b) => b.data.editedAt - a.data.editedAt);
  const p = pathTo(widget, notes[0].data.topicId);
  if (!p) return null;
  return { crumb: p.map(x => x.name).join(' › '), snippet: htmlToText(notes[0].data.html).replace(/\s+/g, ' ').trim(), ts: notes[0].data.editedAt };
}

registry.register({
  type: 'notebook',
  name: 'Notebook',
  icon: 'book-open',
  description: 'Class → Section → Unit → Topic, with rich notes at every level',
  keywords: ['study', 'school', 'class', 'section', 'unit', 'topic', 'term'],
  external: true, internal: true,
  defaultConfig: () => ({ tree: [] }),

  outputs: (widget) => [
    { key: 'topics', name: 'Topics', dayKeyed: false, get: () => topicsOf(widget).length },
    { key: 'terms', name: 'Key terms', dayKeyed: false, get: () => objectsOf(widget.id, 'element').filter(e => e.data.type === 'term').length }
  ],

  renderCard(host, widget) {
    host.innerHTML = '';
    const roots = tree(widget);
    if (!roots.length) { host.appendChild(el('<p class="soft">Tap to plant your first class.</p>')); return; }
    const last = lastEdited(widget);
    if (last) {
      const card = el('<div class="nb-card-last"><div class="nb-card-crumb soft"></div><div class="nb-card-snip"></div><div class="nb-card-time soft"></div></div>');
      card.querySelector('.nb-card-crumb').textContent = last.crumb;
      card.querySelector('.nb-card-snip').textContent = last.snippet || 'No notes yet.';
      card.querySelector('.nb-card-time').textContent = `Edited ${new Date(last.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      host.appendChild(card);
      return;
    }
    for (const cl of roots.slice(0, 4)) {
      host.appendChild(el(`<div class="row-between" style="padding:4px 0"><span style="font-size:0.92rem">${icon('folder', 14)} <span class="nb-s"></span></span><span class="soft" style="font-size:0.78rem">${(cl.children || []).length} inside</span></div>`))
        .querySelector('.nb-s').textContent = cl.name;
    }
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);
    let curId = null; // current node id (null = root)

    const rowMenu = (anchor, node) => popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: `Rename ${node.name}`, value: node.name }); if (n) { node.name = n; save(); render(); } } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${node.name}”?`, message: 'Its notes and everything inside go to the trash.' })) { removeNode(widget, node.id); if (curId === node.id) curId = pathTo(widget, node.id) ? null : curId; save(); render(); } } }
    ]);

    const addChild = (anchor, parentId, parentLevel) => {
      const opts = childLevels(parentLevel || (parentId ? pathTo(widget, parentId).slice(-1)[0].level : 'class'));
      const make = async (level) => { const n = await promptText({ title: `New ${LMETA[level].label}`, label: LMETA[level].label }); if (n) { childrenArr(widget, parentId).push({ id: ulid(), name: n, level, children: [] }); save(); render(); } };
      if (!parentId) return make('class');
      if (opts.length === 1) return make(opts[0]);
      popMenu(anchor, opts.map(lv => ({ label: `Add ${LMETA[lv].label}`, iconName: LMETA[lv].icon, fn: () => make(lv) })));
    };

    const childRow = (node) => {
      const kids = (node.children || []).length, terms = termCount(widget, node.id);
      const sub = [kids ? `${kids} inside` : '', terms ? `${terms} key term${terms === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || LMETA[node.level].label;
      const li = el(`<button class="list-item">${icon(LMETA[node.level].icon, 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="btn-icon nb-m">${icon('more', 14)}</span></button>`);
      li.querySelector('.li-title').textContent = node.name;
      li.querySelector('.li-sub').textContent = sub;
      li.onclick = (e) => { if (e.target.closest('.nb-m')) return; curId = node.id; render(); };
      li.querySelector('.nb-m').addEventListener('click', (e) => { e.stopPropagation(); rowMenu(e.currentTarget, node); });
      return li;
    };

    const render = () => {
      host.innerHTML = '';
      const path = curId ? pathTo(widget, curId) : [];
      const node = path.length ? path[path.length - 1] : null;

      // breadcrumb
      const bc = el('<div class="nb-bc row" style="flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>');
      const crumbBtn = (label, id) => { const b = el(`<button class="btn btn-ghost nb-crumb">${label}</button>`); b.onclick = () => { curId = id; render(); }; return b; };
      bc.appendChild(crumbBtn(`${icon('book-open', 13)} Notebook`, null));
      path.forEach((p) => { bc.appendChild(el('<span class="soft">›</span>')); bc.appendChild(crumbBtn(p.name, p.id)); });
      host.appendChild(bc);

      // children ("Contents")
      const kids = childrenArr(widget, curId);
      const contents = el('<div class="nb-contents"></div>');
      if (node) contents.appendChild(el(`<h3 class="soft nb-col-h">CONTENTS</h3>`));
      if (!curId && !kids.length) contents.appendChild(emptyState('book-open', 'A fresh notebook. Add your first class?'));
      for (const k of kids) contents.appendChild(childRow(k));
      const addBtn = el(`<button class="btn-soft-wide">${icon('plus', 15)} ${curId ? `Add ${childLevels(node.level).map(l => LMETA[l].label).join(' / ')}` : 'Add class'}</button>`);
      addBtn.onclick = (e) => addChild(e.currentTarget, curId, node?.level);
      contents.appendChild(addBtn);
      if (!curId) { const imp = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('upload', 15)} Import notes (doc → tree)</button>`); imp.onclick = () => openConverter(widget, ctx, () => { curId = null; render(); }); contents.appendChild(imp); }
      host.appendChild(contents);

      // this node's own notes
      if (node) {
        host.appendChild(el('<h3 class="soft nb-col-h" style="margin-top:14px">NOTES</h3>'));
        const notesHost = el('<div class="nb-notes"></div>');
        host.appendChild(notesHost);
        renderTopicArea(notesHost, widget, { node, path: path.map(p => ({ id: p.id, name: p.name, level: p.level })), note: topicNote(widget, node.id) }, ctx);
      }
    };
    render();
  }
});

/* ---- doc → tree converter (Title=Class, H1=Section, H2=Unit, H3=Topic) ---- */
function openConverter(widget, ctx, done) {
  const d = openDrawer({ title: 'Import notes → tree', iconName: 'upload' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">Paste clean notes. <b>Title</b> → Class, <b>Heading 1</b> → Section, <b>Heading 2</b> → Unit, <b>Heading 3</b> → Topic. Text under a heading becomes that node\'s notes. Use Markdown (#, ##, ###, # for title is one #? — here: a line of all-caps or “Title:” → Class) or paste HTML from the editor.</p>'));
  d.body.appendChild(el('<p class="soft" style="font-size:0.8rem;margin-bottom:6px">Markdown headings: <code># Title→Class</code> · <code>## →Section</code> · <code>### →Unit</code> · <code>#### →Topic</code>.</p>'));
  const ta = el('<textarea class="textarea" rows="10" placeholder="# Biology 101\nIntro to the class…\n## Genetics\n### Mendel\n#### Punnett squares\nA grid for predicting genotypes."></textarea>');
  d.body.appendChild(ta);
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Import</button>');
  go.onclick = () => {
    const made = convertDoc(widget, ta.value);
    if (!made) { toast('Add at least one # Title / heading.', 'info'); return; }
    store.put('widgets', widget);
    d.close(); toast(`Imported ${made} node${made === 1 ? '' : 's'}`, 'book-open');
    done();
    syncImported(widget);
  };
  d.body.appendChild(go);
}

/** Parse markdown-ish (or pasted HTML) into the tree. Returns node count added. */
function convertDoc(widget, raw) {
  // normalize pasted HTML headings → markdown; otherwise treat as markdown/plain
  let text = raw;
  if (/<h[1-4]|<p|<div/i.test(raw)) {
    text = raw.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n').replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n').replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
      .replace(/<\/(p|div|li)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const dec = document.createElement('textarea'); dec.innerHTML = text; text = dec.value;
  }
  const LV = { 1: 'class', 2: 'section', 3: 'unit', 4: 'topic' };
  const lastAt = {}; // level -> node
  let current = null, made = 0;
  const bodyByNode = new Map(); // node -> [lines]
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      const depth = m[1].length, level = LV[depth], name = m[2].trim();
      // parent = nearest existing shallower node
      let parentArr = tree(widget), parent = null;
      for (let dd = depth - 1; dd >= 1; dd--) { if (lastAt[dd]) { parent = lastAt[dd]; break; } }
      if (parent) { parent.children = parent.children || []; parentArr = parent.children; }
      const node = { id: ulid(), name, level, children: [] };
      parentArr.push(node); made++;
      lastAt[depth] = node;
      for (let dd = depth + 1; dd <= 4; dd++) delete lastAt[dd]; // deeper levels reset
      current = node;
    } else if (current && line.trim()) {
      if (!bodyByNode.has(current)) bodyByNode.set(current, []);
      bodyByNode.get(current).push(line);
    }
  }
  // write bodies as the node's note html
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const [node, lines] of bodyByNode) {
    const note = topicNote(widget, node.id);
    note.data.html = lines.map(l => `<p>${esc(l)}</p>`).join('');
    note.data.editedAt = Date.now();
    store.put('objects', note);
  }
  return made;
}

/** Re-derive elements for every imported node that got a note. */
function syncImported(widget) {
  import('./notebook-parse.js').then(({ syncTopicElements }) => {
    walk(tree(widget), (n, p) => {
      const note = objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === n.id);
      if (note && note.data.html) syncTopicElements(widget, { node: n, path: [...p, n].map(x => ({ id: x.id, name: x.name, level: x.level })), note });
    });
  });
}
