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
import { htmlToText, autoKeyTermsHtml, syncTopicElements } from './notebook-parse.js';
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
/** Swap a node with its previous/next sibling (dir -1/+1). */
function moveSibling(widget, id, dir) {
  const path = pathTo(widget, id); if (!path) return;
  const arr = path.length > 1 ? (path[path.length - 2].children || []) : tree(widget);
  const i = arr.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
/** Reparent nodes under destId (null = top level). Skips moves into self/descendants
    and drops ids nested under another selected id. */
function reparent(widget, ids, destId) {
  const set = new Set(ids);
  ids = ids.filter(id => { const p = pathTo(widget, id); return p && !p.slice(0, -1).some(a => set.has(a.id)); });
  const dest = destId ? pathTo(widget, destId)?.slice(-1)[0] : null;
  for (const id of ids) {
    const path = pathTo(widget, id); if (!path) continue;
    const node = path[path.length - 1];
    if (destId && (destId === id || descendantIds(node).includes(destId))) continue;
    const arr = path.length > 1 ? path[path.length - 2].children : tree(widget);
    const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1);
    (dest ? (dest.children || (dest.children = [])) : tree(widget)).push(node);
  }
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
      { label: 'Move up', iconName: 'chevron-up', fn: () => { moveSibling(widget, node.id, -1); save(); render(); } },
      { label: 'Move down', iconName: 'chevron-down', fn: () => { moveSibling(widget, node.id, 1); save(); render(); } },
      { label: 'Move to…', iconName: 'arrow-right', fn: () => openMovePicker(widget, [node.id], () => render()) },
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
      if (!curId) {
        const imp = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('upload', 15)} Import notes (paste a doc → tree)</button>`);
        imp.onclick = () => openConverter(widget, ctx, () => { curId = null; render(); });
        const akt = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('wand', 15)} Auto key terms (across topics)</button>`);
        akt.onclick = () => openAutoKeyTerms(widget, () => render());
        const mv = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('layers', 15)} Move / organize</button>`);
        mv.onclick = () => openMoveOrganizer(widget, () => render());
        contents.append(imp, akt, mv);
      }
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

/* ---- doc → tree converter: paste any doc; headings sort into the tree ---- */
function openConverter(widget, ctx, done) {
  const d = openDrawer({ title: 'Import notes → tree', iconName: 'upload', placement: 'full' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.86rem;margin-bottom:8px">Paste a Word doc, Google Doc, or web page below — its <b>headings</b> sort into Class → Section → Unit → Topic (in the order they appear), and the text under each heading becomes that node’s notes. Typed Markdown <code>#</code> <code>##</code> <code>###</code> <code>####</code> also works.</p>'));
  d.body.appendChild(el('<label class="soft" style="font-size:0.78rem;display:block;margin-bottom:4px">Paste here</label>'));
  const paste = el('<div class="note-editor nb-import" contenteditable="true" spellcheck="false" style="min-height:38vh"></div>');
  d.body.appendChild(paste);
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Import</button>');
  go.onclick = () => {
    const made = convertDoc(widget, paste.innerHTML.trim() || paste.textContent || '');
    if (!made) { toast('No headings found — paste a doc with headings, or type # / ## / ### lines.', 'info'); return; }
    store.put('widgets', widget);
    d.close(); toast(`Imported ${made} node${made === 1 ? '' : 's'}`, 'book-open');
    done(); syncImported(widget);
  };
  d.body.appendChild(go);
}

/** Turn pasted HTML or markdown/plain text into a flat token stream of headings
    ({depth,name}) and body lines ({body}). Markdown inside pasted HTML still works. */
function tokenize(raw) {
  const tokens = [];
  const asHeadingOrBody = (t) => { const m = t.match(/^(#{1,6})\s+(.+)$/); if (m) tokens.push({ depth: m[1].length, name: m[2].trim() }); else if (t.trim()) tokens.push({ body: t.trim() }); };
  if (/<\w+[\s>/]/.test(raw)) {
    const root = document.createElement('div'); root.innerHTML = raw;
    const depthOf = (elm) => {
      const m = elm.tagName.toLowerCase().match(/^h([1-6])$/); if (m) return +m[1];
      const cls = elm.className || '';
      if (/mso\w*title/i.test(cls)) return 1;
      const mm = cls.match(/(?:mso\w*)?heading\s*([1-6])/i); if (mm) return +mm[1] + 1; // Word: Heading 1 → depth 2
      return 0;
    };
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) { asHeadingOrBody(child.textContent); continue; }
        if (child.nodeType !== 1) continue;
        const depth = depthOf(child);
        if (depth) { const name = child.textContent.trim(); if (name) tokens.push({ depth, name }); continue; }
        if (/^(br|hr|img)$/i.test(child.tagName)) continue;
        const hasBlockChild = [...child.children].some(c => /^(h[1-6]|p|div|ul|ol|li|table|section|article|blockquote)$/i.test(c.tagName));
        if (hasBlockChild) visit(child);
        else asHeadingOrBody(child.textContent);
      }
    };
    visit(root);
  } else {
    for (const line of raw.split(/\r?\n/)) asHeadingOrBody(line.replace(/\s+$/, ''));
  }
  return tokens;
}

/** Build tree nodes from a doc. Heading depths map ordinally to Class/Section/
    Unit/Topic (shallowest depth present → Class, next → Section, …). Returns count. */
function convertDoc(widget, raw) {
  const tokens = tokenize(raw);
  const depths = [...new Set(tokens.filter(t => t.depth).map(t => t.depth))].sort((a, b) => a - b);
  if (!depths.length) return 0;
  const levelOf = (depth) => LEVELS[Math.min(depths.indexOf(depth), LEVELS.length - 1)];
  const lastAt = {}; // depth -> node
  let current = null, made = 0;
  const bodyByNode = new Map();
  for (const tk of tokens) {
    if (tk.depth) {
      let parentArr = tree(widget), parent = null;
      for (const dd of depths.filter(d => d < tk.depth).sort((a, b) => b - a)) { if (lastAt[dd]) { parent = lastAt[dd]; break; } }
      if (parent) { parent.children = parent.children || []; parentArr = parent.children; }
      const node = { id: ulid(), name: tk.name, level: levelOf(tk.depth), children: [] };
      parentArr.push(node); made++;
      lastAt[tk.depth] = node;
      for (const d of depths) if (d > tk.depth) delete lastAt[d]; // deeper levels reset
      current = node;
    } else if (current && tk.body) {
      if (!bodyByNode.has(current)) bodyByNode.set(current, []);
      bodyByNode.get(current).push(tk.body);
    }
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const [node, lines] of bodyByNode) {
    const note = topicNote(widget, node.id);
    note.data.html = lines.map(l => `<p>${esc(l)}</p>`).join('');
    note.data.editedAt = Date.now();
    store.put('objects', note);
  }
  return made;
}

/** Re-derive elements for every node that has a note (after import). */
function syncImported(widget) {
  walk(tree(widget), (n, p) => {
    const note = objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === n.id);
    if (note && note.data.html) syncTopicElements(widget, { node: n, path: [...p, n].map(x => ({ id: x.id, name: x.name, level: x.level })), note });
  });
}

/* ---- batch: auto key terms across many nodes ---- */
function nodeCheckTree(widget, sel) {
  const treeEl = el('<div class="qz-tree"></div>');
  walk(tree(widget), (n, p) => {
    const row = el(`<label class="qz-node row" style="gap:6px;padding-left:${p.length * 16}px"><input type="checkbox"><span>${icon(LMETA[n.level].icon, 13)} <span class="nb-cn"></span></span></label>`);
    row.querySelector('.nb-cn').textContent = n.name;
    row.querySelector('input').onchange = (e) => (e.target.checked ? sel.add(n.id) : sel.delete(n.id));
    treeEl.appendChild(row);
  });
  return treeEl;
}
function openAutoKeyTerms(widget, done) {
  const sel = new Set();
  const d = openDrawer({ title: 'Auto key terms', iconName: 'wand', placement: 'full' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.86rem;margin-bottom:8px">Tick any classes, sections, units, or topics. Every block wrapped in <code>---</code> separators in their notes (and everything inside them) becomes a Key Term.</p>'));
  d.body.appendChild(nodeCheckTree(widget, sel));
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Run</button>');
  go.onclick = () => {
    if (!sel.size) { toast('Tick at least one.', 'info'); return; }
    const targets = new Set();
    for (const id of sel) { const node = pathTo(widget, id)?.slice(-1)[0]; if (node) for (const did of descendantIds(node)) targets.add(did); }
    let made = 0, touched = 0;
    for (const nid of targets) {
      const note = objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === nid);
      if (!note || !note.data.html) continue;
      const r = autoKeyTermsHtml(note.data.html);
      if (!r.made) continue;
      note.data.html = r.html; note.data.editedAt = Date.now(); store.put('objects', note);
      const p = pathTo(widget, nid);
      syncTopicElements(widget, { node: p.slice(-1)[0], path: p.map(x => ({ id: x.id, name: x.name, level: x.level })), note });
      made += r.made; touched++;
    }
    d.close();
    toast(made ? `Made ${made} key term${made === 1 ? '' : 's'} across ${touched} note${touched === 1 ? '' : 's'}` : 'No --- separators found in those notes.', made ? 'check' : 'info');
    done();
  };
  d.body.appendChild(go);
}

/* ---- move / organize ---- */
function openMovePicker(widget, ids, done) {
  const moving = new Set();
  for (const id of ids) { const n = pathTo(widget, id)?.slice(-1)[0]; if (n) for (const did of descendantIds(n)) moving.add(did); }
  const d = openDrawer({ title: ids.length > 1 ? `Move ${ids.length} items to…` : 'Move to…', iconName: 'arrow-right' });
  const list = el('<div class="nb-list"></div>');
  const destBtn = (label, destId, depth) => { const b = el(`<button class="list-item" style="padding-left:${depth * 14 + 12}px"><span class="li-main"><span class="li-title"></span></span></button>`); b.querySelector('.li-title').textContent = label; b.onclick = () => { reparent(widget, ids, destId); store.put('widgets', widget); d.close(); toast('Moved', 'check'); done(); }; return b; };
  list.appendChild(destBtn('▲ Top level', null, 0));
  walk(tree(widget), (n, p) => { if (moving.has(n.id)) return; list.appendChild(destBtn(n.name, n.id, p.length + 1)); });
  d.body.appendChild(list);
}
function openMoveOrganizer(widget, done) {
  const sel = new Set();
  const d = openDrawer({ title: 'Move / organize', iconName: 'layers', placement: 'full' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.86rem;margin-bottom:8px">Tick the classes, sections, units, or topics to move, then pick where they go.</p>'));
  d.body.appendChild(nodeCheckTree(widget, sel));
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Move selected to…</button>');
  go.onclick = () => { if (!sel.size) { toast('Tick at least one.', 'info'); return; } openMovePicker(widget, [...sel], () => { d.close(); done(); }); };
  d.body.appendChild(go);
}
