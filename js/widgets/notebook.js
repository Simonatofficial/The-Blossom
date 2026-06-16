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
/** Drag-and-drop move: place dragId relative to targetId.
    mode 'inside' (nest as last child; targetId null = top level), 'before' or 'after'
    (as a sibling of target). No-ops when dropping onto self or a descendant. */
function moveNode(widget, dragId, targetId, mode) {
  if (dragId === targetId) return;
  const dragPath = pathTo(widget, dragId); if (!dragPath) return;
  const dragNode = dragPath[dragPath.length - 1];
  if (targetId && descendantIds(dragNode).includes(targetId)) return;
  const dpArr = dragPath.length > 1 ? dragPath[dragPath.length - 2].children : tree(widget);
  const di = dpArr.findIndex(x => x.id === dragId); if (di >= 0) dpArr.splice(di, 1); // detach first
  if (!targetId || mode === 'inside') {
    const dest = targetId ? pathTo(widget, targetId)?.slice(-1)[0] : null;
    (dest ? (dest.children || (dest.children = [])) : tree(widget)).push(dragNode);
  } else {
    const tPath = pathTo(widget, targetId); const tArr = tPath.length > 1 ? tPath[tPath.length - 2].children : tree(widget);
    let ti = tArr.findIndex(x => x.id === targetId); if (ti < 0) ti = tArr.length - 1;
    tArr.splice(mode === 'after' ? ti + 1 : ti, 0, dragNode);
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
    let suppressClick = false; // set by a drag so the row's click doesn't also open it

    const rowMenu = (anchor, node) => popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: `Rename ${node.name}`, value: node.name }); if (n) { node.name = n; save(); render(); } } },
      { label: 'Move up', iconName: 'chevron-up', fn: () => { moveSibling(widget, node.id, -1); save(); render(); } },
      { label: 'Move down', iconName: 'chevron-down', fn: () => { moveSibling(widget, node.id, 1); save(); render(); } },
      { label: 'Auto key terms (inside)', iconName: 'wand', fn: () => { const r = runAutoKeyTerms(widget, node.id); toast(r.made ? `Made ${r.made} key term${r.made === 1 ? '' : 's'}` : 'No --- separators in those notes.', r.made ? 'check' : 'info'); render(); } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${node.name}”?`, message: 'Its notes and everything inside go to the trash.' })) { removeNode(widget, node.id); if (curId === node.id) curId = null; save(); render(); } } }
    ]);

    // Add a child at the next level down — no picker (the levels are just depth labels).
    const addChild = async (parentId, parentLevel) => {
      const level = parentId ? childLevels(parentLevel)[0] : 'class';
      const n = await promptText({ title: `New ${LMETA[level].label}`, label: LMETA[level].label });
      if (n) { childrenArr(widget, parentId).push({ id: ulid(), name: n, level, children: [] }); save(); render(); }
    };

    const childRow = (node) => {
      const kids = (node.children || []).length, terms = termCount(widget, node.id);
      const sub = [kids ? `${kids} inside` : '', terms ? `${terms} key term${terms === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || LMETA[node.level].label;
      const li = el(`<button class="list-item nb-node" data-id="${node.id}"><span class="nb-grip" title="Drag to move">⠿</span>${icon(LMETA[node.level].icon, 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="btn-icon nb-m">${icon('more', 14)}</span></button>`);
      li.querySelector('.li-title').textContent = node.name;
      li.querySelector('.li-sub').textContent = sub;
      li.onclick = (e) => { if (suppressClick) { suppressClick = false; return; } if (e.target.closest('.nb-m') || e.target.closest('.nb-grip')) return; curId = node.id; render(); };
      li.querySelector('.nb-m').addEventListener('click', (e) => { e.stopPropagation(); rowMenu(e.currentTarget, node); });
      return li;
    };

    /* ---- inline drag & drop: grab a row's ⠿ handle; drop onto a row to nest it
       inside, on a row's top/bottom edge to reorder, or on a breadcrumb to move it
       out. Pointer-based so it works on touch + mouse, no libraries. ---- */
    const clearHints = () => host.querySelectorAll('.drop-inside,.drop-before,.drop-after,.crumb-drop').forEach(e => e.classList.remove('drop-inside', 'drop-before', 'drop-after', 'crumb-drop'));
    let drag = null;
    const onMove = (e) => {
      if (!drag) return;
      const x = e.clientX, y = e.clientY;
      if (!drag.started) { if (Math.hypot(x - drag.sx, y - drag.sy) < 4) return; drag.started = true; drag.src.classList.add('nb-dragging'); const g = el('<div class="nb-org-ghost"></div>'); g.textContent = drag.name; document.body.appendChild(g); drag.ghost = g; navigator.vibrate?.(12); }
      e.preventDefault();
      drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px';
      clearHints(); drag.target = null;
      drag.ghost.style.visibility = 'hidden'; const under = document.elementFromPoint(x, y); drag.ghost.style.visibility = 'visible';
      const crumb = under?.closest('.nb-crumb');
      if (crumb && host.contains(crumb)) { crumb.classList.add('crumb-drop'); drag.target = { crumbId: crumb.dataset.cid || null }; return; }
      const row = under?.closest('.nb-node[data-id]');
      if (!row || !host.contains(row) || row.dataset.id === drag.id) return;
      const r = row.getBoundingClientRect(), rel = (y - r.top) / r.height, mode = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside';
      row.classList.add('drop-' + mode); drag.target = { id: row.dataset.id, mode };
    };
    const onUp = () => {
      if (!drag) return;
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      host.style.touchAction = '';
      const d = drag; drag = null;
      if (!d.started) return;
      d.ghost?.remove(); d.src.classList.remove('nb-dragging'); clearHints(); suppressClick = true;
      if (d.target) { if ('crumbId' in d.target) moveNode(widget, d.id, d.target.crumbId, 'inside'); else moveNode(widget, d.id, d.target.id, d.target.mode); save(); }
      render();
    };
    host.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.nb-grip'); if (!grip) return;
      const row = grip.closest('.nb-node[data-id]'); if (!row) return;
      e.preventDefault(); host.style.touchAction = 'none';
      drag = { id: row.dataset.id, src: row, started: false, sx: e.clientX, sy: e.clientY, name: row.querySelector('.li-title').textContent, target: null };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    });

    const render = () => {
      host.innerHTML = '';
      const path = curId ? pathTo(widget, curId) : [];
      const node = path.length ? path[path.length - 1] : null;

      // breadcrumb
      const bc = el('<div class="nb-bc row" style="flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>');
      const crumbBtn = (label, id) => { const b = el(`<button class="btn btn-ghost nb-crumb" data-cid="${id || ''}">${label}</button>`); b.onclick = () => { curId = id; render(); }; return b; };
      bc.appendChild(crumbBtn(`${icon('book-open', 13)} Notebook`, null));
      path.forEach((p) => { bc.appendChild(el('<span class="soft">›</span>')); bc.appendChild(crumbBtn(p.name, p.id)); });
      host.appendChild(bc);

      // children ("Contents")
      const kids = childrenArr(widget, curId);
      const contents = el('<div class="nb-contents"></div>');
      if (node) contents.appendChild(el(`<h3 class="soft nb-col-h">CONTENTS</h3>`));
      if (!curId && !kids.length) contents.appendChild(emptyState('book-open', 'A fresh notebook. Add your first class, or import a doc.'));
      else if (kids.length) contents.appendChild(el('<p class="soft nb-draghint">Tip: drag the ⠿ handle to move a file into another, reorder it, or drop it on a breadcrumb to move it out.</p>'));
      for (const k of kids) contents.appendChild(childRow(k));
      const addBtn = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add ${curId ? LMETA[childLevels(node.level)[0]].label : 'class'}</button>`);
      addBtn.onclick = () => addChild(curId, node?.level);
      contents.appendChild(addBtn);
      if (!curId) {
        const imp = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('upload', 15)} Import notes (paste a doc)</button>`);
        imp.onclick = () => openConverter(widget, ctx, () => { curId = null; render(); });
        const akt = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('wand', 15)} Auto key terms (whole notebook)</button>`);
        akt.onclick = () => { const r = runAutoKeyTerms(widget, null); toast(r.made ? `Made ${r.made} key term${r.made === 1 ? '' : 's'} across ${r.touched} note${r.touched === 1 ? '' : 's'}` : 'No --- separators found.', r.made ? 'check' : 'info'); render(); };
        contents.append(imp, akt);
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

/* ---- doc → tree converter: paste any doc; Title + headings sort into the tree,
   keeping bold / italics / underline / highlights / separators ---- */
function openConverter(widget, ctx, done) {
  const d = openDrawer({ title: 'Import notes', iconName: 'upload' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.86rem;margin-bottom:8px">Paste a Word doc, Google Doc, or web page. Its <b>Title</b> and <b>headings</b> become the nested files (Title → Class, then Heading 1 / 2 / 3 → Section / Unit / Topic by depth); the text under each becomes that file’s notes, with <b>bold, italics, underline, highlights and separators kept</b>. Typed <code>#</code> <code>##</code> <code>###</code> headings also work.</p>'));
  d.body.appendChild(el('<label class="soft" style="font-size:0.78rem;display:block;margin-bottom:4px">Paste here</label>'));
  const paste = el('<div class="note-editor nb-import" contenteditable="true" spellcheck="false"></div>');
  d.body.appendChild(paste);
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Import</button>');
  go.onclick = () => {
    const made = convertDoc(widget, paste.innerHTML.trim() || paste.textContent || '');
    if (!made) { toast('No Title/headings found — add a Title or heading, or type # / ## lines.', 'info'); return; }
    store.put('widgets', widget);
    d.close(); toast(`Imported ${made} item${made === 1 ? '' : 's'}`, 'book-open');
    done(); syncImported(widget);
  };
  d.body.appendChild(go);
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Heading "rank" of an element: 0 = Title, 1 = Heading 1 / h1, 2 = h2, … or null
    if it's body text. Detects h1–h6, Title/Heading classes (incl. Word Mso*), and
    large styled paragraphs (Google Docs uses inline font-size, not heading tags). */
function rankOf(elm) {
  const tag = elm.tagName.toLowerCase();
  const hm = tag.match(/^h([1-6])$/); if (hm) return +hm[1];
  const cls = (elm.className || '').toLowerCase();
  if (/subtitle/.test(cls)) return 2;
  if (/title/.test(cls)) return 0;
  const cm = cls.match(/heading\s*([1-6])/); if (cm) return +cm[1];
  if (/^(p|div)$/.test(tag)) {
    const txt = (elm.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.length <= 140) {
      let pt = 0; const scan = (e) => { const s = e.style && e.style.fontSize; if (s) { const m = s.match(/([\d.]+)\s*(pt|px|em|rem)/i); if (m) { let v = parseFloat(m[1]); const u = m[2].toLowerCase(); if (u === 'px') v *= 0.75; else if (u === 'em' || u === 'rem') v *= 12; pt = Math.max(pt, v); } } for (const c of e.children) scan(c); };
      scan(elm);
      if (pt >= 13.5) return pt >= 22 ? 0 : pt >= 17 ? 1 : pt >= 14.5 ? 2 : 3;
    }
  }
  return null;
}

/** Sanitize pasted HTML to safe inline formatting: keep b/i/u/strike/mark/span +
    color/background/weight/style/decoration, lists, hr, links; drop everything else. */
const KEEP_TAGS = new Set(['P', 'DIV', 'BR', 'HR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'MARK', 'SPAN', 'A', 'BLOCKQUOTE']);
const KEEP_STYLE = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'];
function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1) { child.remove(); continue; }
    if (!KEEP_TAGS.has(child.tagName)) { while (child.firstChild) node.insertBefore(child.firstChild, child); child.remove(); continue; }
    const styles = []; for (const p of KEEP_STYLE) { const v = child.style && child.style.getPropertyValue(p); if (v) styles.push(`${p}:${v}`); }
    const href = child.tagName === 'A' ? child.getAttribute('href') : null;
    for (const a of [...child.attributes]) child.removeAttribute(a.name);
    if (styles.length) child.setAttribute('style', styles.join(';'));
    if (href) child.setAttribute('href', href);
    cleanNode(child);
  }
}
function cleanFragment(elm) { const w = document.createElement('div'); w.appendChild(elm.cloneNode(true)); cleanNode(w); return w.innerHTML; }

/** Flat token stream: headings { rank, name } and body blocks { html } (formatting
    preserved). Markdown headings work in plain text and inside pasted HTML. */
function tokenize(raw) {
  const tokens = [];
  const md = (t) => { const m = t.trim().match(/^(#{1,6})\s+(.+)$/); return m ? { rank: m[1].length - 1, name: m[2].trim() } : null; };
  if (/<\w+[\s>/]/.test(raw)) {
    const root = document.createElement('div'); root.innerHTML = raw;
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) { const t = child.textContent.trim(); if (t) tokens.push(md(t) || { html: `<p>${escapeHtml(t)}</p>` }); continue; }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName.toLowerCase();
        if (/^(style|script|meta|link|img)$/.test(tag)) continue;
        if (tag === 'hr') { tokens.push({ html: '<hr>' }); continue; }
        if (tag === 'br') continue;
        const rank = rankOf(child);
        if (rank != null) { const name = child.textContent.replace(/\s+/g, ' ').trim(); if (name) tokens.push({ rank, name }); continue; }
        const m = md(child.textContent); if (m && !child.querySelector('*')) { tokens.push(m); continue; }
        const hasBlockChild = [...child.children].some(c => /^(h[1-6]|p|div|ul|ol|li|table|section|article|blockquote)$/i.test(c.tagName));
        if (hasBlockChild) { visit(child); continue; }
        const html = cleanFragment(child);
        if (html.replace(/<[^>]+>/g, '').trim()) tokens.push({ html });
      }
    };
    visit(root);
  } else {
    for (const line of raw.split(/\r?\n/)) { const t = line.replace(/\s+$/, ''); if (!t.trim()) continue; tokens.push(md(t) || { html: `<p>${escapeHtml(t)}</p>` }); }
  }
  return tokens;
}

/** Build tree nodes from a doc. Heading RANKS (0 = Title, 1 = H1, …) map ordinally
    to Class/Section/Unit/Topic; a shallower heading after a deeper one walks back up
    to the right parent. Body blocks keep their formatting. Returns the node count. */
function convertDoc(widget, raw) {
  const tokens = tokenize(raw);
  const ranks = [...new Set(tokens.filter(t => t.rank != null).map(t => t.rank))].sort((a, b) => a - b);
  if (!ranks.length) return 0;
  const levelOf = (rank) => LEVELS[Math.min(ranks.indexOf(rank), LEVELS.length - 1)];
  const lastAt = {}; // rank -> node
  let current = null, made = 0;
  const bodyByNode = new Map();
  for (const tk of tokens) {
    if (tk.rank != null) {
      let parentArr = tree(widget), parent = null;
      for (const rr of ranks.filter(r => r < tk.rank).sort((a, b) => b - a)) { if (lastAt[rr]) { parent = lastAt[rr]; break; } }
      if (parent) { parent.children = parent.children || []; parentArr = parent.children; }
      const node = { id: ulid(), name: tk.name, level: levelOf(tk.rank), children: [] };
      parentArr.push(node); made++;
      lastAt[tk.rank] = node;
      for (const r of ranks) if (r > tk.rank) delete lastAt[r]; // deeper levels reset
      current = node;
    } else if (current && tk.html) {
      if (!bodyByNode.has(current)) bodyByNode.set(current, []);
      bodyByNode.get(current).push(tk.html);
    }
  }
  for (const [node, htmls] of bodyByNode) {
    const note = topicNote(widget, node.id);
    note.data.html = htmls.join('');
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

/* ---- batch: auto key terms across a node (and everything inside it) ---- */
function runAutoKeyTerms(widget, rootId) {
  const targets = new Set();
  if (rootId) { const n = pathTo(widget, rootId)?.slice(-1)[0]; if (n) for (const did of descendantIds(n)) targets.add(did); }
  else walk(tree(widget), (n) => targets.add(n.id));
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
  store.put('widgets', widget);
  return { made, touched };
}

