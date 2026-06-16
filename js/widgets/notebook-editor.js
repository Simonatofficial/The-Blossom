/* Notebook Topic editor (V2 §W-1): the rich-text notes area shown inside a
   Topic. One view at a time — Preview (default) or Edit. Annotations are
   highlight-only: selecting text and tapping Key Term / Theme / Concept / Idea /
   Comment wraps the selection in an .anno span (a <div> for the multi-line Key
   Term block, a <span> for inline tags) — the text is never altered and no
   bracket syntax is inserted. This editor is owned by the Notebook and is kept
   separate from the Notes widget on purpose. */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, toast } from '../ui/components.js';
import { saveObject } from './base.js';
import { syncTopicElements, legacyTextToHtml } from './notebook-parse.js';
import { openNodePicker } from '../ui/picker.js';

/** Convert a legacy plain-text note to HTML the first time it's opened. */
function ensureHtml(note) {
  if (note.data.html != null) return;
  const legacy = note.data.text || '';
  note.data.html = legacyTextToHtml(legacy);
  if (legacy) note.data.legacyText = legacy; // safety net (§W-1 migration)
  delete note.data.text;
  saveObject(note);
}

/** Snapshot the editor's HTML, persisting live checkbox state into the markup. */
function cleanHtml(editor) {
  const clone = editor.cloneNode(true);
  const live = editor.querySelectorAll('input[type="checkbox"]');
  clone.querySelectorAll('input[type="checkbox"]').forEach((c, i) => {
    if (live[i]?.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked');
  });
  return clone.innerHTML;
}

/* §W fix #3: full palette incl. Auto (theme text), Black, White, Gray + hues. */
const SWATCHES = [
  ['Auto (theme)', 'auto'], ['Black', '#111111'], ['White', '#ffffff'], ['Gray', '#9aa0a6'],
  ['Red', '#e53935'], ['Orange', '#fb8c00'], ['Yellow', '#fdd835'], ['Green', '#43a047'],
  ['Teal', '#00897b'], ['Blue', '#1e88e5'], ['Purple', '#8e24aa'], ['Pink', '#d81b60']
];
const HILITES = [
  ['Yellow', '#FFF176'], ['Red', '#FFCDD2'], ['Blue', '#BBDEFB'], ['Orange', '#FFE0B2'], ['Green', '#C8E6C9'], ['None', 'transparent']
];

function colorMenu(anchor, palette, apply) {
  popMenu(anchor, palette.map(([name, c]) => ({ label: name, fn: () => apply(c) })));
}

/* §W fix #4: keep note text legible on any theme — adapt explicit colors that
   clash with the theme's background (lighten dark-on-dark, darken light-on-light).
   Non-destructive: applied only to the read-only PREVIEW, re-evaluated per theme. */
function parseRGB(c) {
  if (!c) return null; c = c.trim();
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); if (h.length !== 6) return null; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(s => parseFloat(s)); return [p[0], p[1], p[2]]; }
  return null;
}
const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const toHex = (rgb) => '#' + rgb.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
function shiftTo(rgb, targetL) { const L = lum(rgb) || 0.001; if (targetL > L) { const t = (targetL - L) / (1 - L); return rgb.map(x => x + (255 - x) * t); } const t = (L - targetL) / L; return rgb.map(x => x * (1 - t)); }
function adaptColor(c, dark) { const rgb = parseRGB(c); if (!rgb) return null; const L = lum(rgb); if (dark && L < 0.4) return toHex(shiftTo(rgb, 0.82)); if (!dark && L > 0.62) return toHex(shiftTo(rgb, 0.2)); return null; }
function themeIsDark(root) { const t = getComputedStyle(root).getPropertyValue('--text') || getComputedStyle(root).color; const rgb = parseRGB(t.trim()); return rgb ? lum(rgb) > 0.55 : false; }
function adaptColors(root) {
  const dark = themeIsDark(root);
  for (const e of root.querySelectorAll('[style*="color"], font[color]')) {
    const explicit = e.style?.color || e.getAttribute?.('color');
    const orig = e.dataset?.oc || explicit;
    if (!orig) continue;
    const adj = adaptColor(orig, dark);
    if (adj) { if (e.dataset && !e.dataset.oc) e.dataset.oc = orig; e.style.color = adj; }
    else if (e.dataset?.oc) { e.style.color = e.dataset.oc; delete e.dataset.oc; }
  }
}

function pickImage(insert) {
  const fileIn = el('<input type="file" accept="image/*" class="hidden">');
  document.body.appendChild(fileIn);
  fileIn.onchange = () => {
    const file = fileIn.files[0]; fileIn.remove();
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const max = 1280, scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      insert('insertImage', cv.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  fileIn.click();
}

let openPop = null;
function showCommentPopover(anchor) {
  openPop?.remove();
  const pop = el('<div class="nb-comment-pop"></div>');
  pop.textContent = anchor.textContent.trim() || '(empty comment)';
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${r.bottom + 6}px`;
  openPop = pop;
  const close = (e) => { if (e && pop.contains(e.target)) return; pop.remove(); openPop = null; document.removeEventListener('click', close, true); };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

/**
 * Render the preview/edit area for one Topic into `host`.
 * @param {HTMLElement} host
 * @param {object} widget the notebook widget
 * @param {{classId,className,unitId,unitName,topic,note}} tctx
 * @param {object} ctx widget ctx (navigate/goWidget/refreshCard)
 */
export function renderTopicArea(host, widget, tctx, ctx) {
  const note = tctx.note;
  ensureHtml(note);
  let mode = 'preview';

  const save = (editor) => {
    note.data.html = cleanHtml(editor);
    note.data.editedAt = Date.now();
    saveObject(note);
    syncTopicElements(widget, tctx);
    ctx?.refreshCard?.(widget);
  };

  const linkNav = (e) => {
    const link = e.target.closest('.nlink'); if (!link) return;
    e.preventDefault();
    const { kind, id } = link.dataset;
    if (kind === 'module') ctx.navigate(id);
    else if (kind === 'page') { const m = store.all('modules').find(mm => mm.pages.includes(id)); if (m) ctx.navigate(m.id, id); }
    else if (kind === 'widget') ctx.goWidget(id);
  };

  const renderPreview = () => {
    host.innerHTML = '';
    const head = el(`<div class="nb-note-head"><span class="soft" style="font-size:0.74rem">PREVIEW</span><button class="btn-icon nb-edit" title="Edit">${icon('edit', 16)}</button></div>`);
    head.querySelector('.nb-edit').onclick = () => { mode = 'edit'; render(); };
    const pv = el('<div class="nb-note-preview note-editor"></div>');
    pv.innerHTML = note.data.html || '';
    if (!(note.data.html || '').replace(/<[^>]+>/g, '').trim()) pv.innerHTML = '<p class="soft">An empty page. Tap edit to begin.</p>';
    pv.querySelectorAll('.anno-comment').forEach(c => { c.style.cursor = 'pointer'; c.addEventListener('click', (e) => { e.stopPropagation(); showCommentPopover(c); }); });
    pv.addEventListener('click', linkNav);
    host.append(head, pv);
    adaptColors(pv); // §W fix #4: must run after pv is in the DOM so the theme's --text resolves
  };

  const renderEditor = () => {
    host.innerHTML = '';
    const editor = el('<div class="note-editor nb-editor" spellcheck="true"></div>');
    editor.contentEditable = 'true';
    editor.innerHTML = note.data.html || '';

    let timer = null;
    const queueSave = () => { clearTimeout(timer); timer = setTimeout(() => save(editor), 400); };
    editor.addEventListener('input', queueSave);
    editor.addEventListener('change', () => save(editor), true); // checkboxes
    editor.addEventListener('blur', () => { clearTimeout(timer); save(editor); }); // leaving the topic

    try { document.execCommand('styleWithCSS', false, true); } catch { /* color applies as inline style so #4 can read it */ }
    const exec = (cmd, val = null) => { editor.focus(); document.execCommand(cmd, false, val); save(editor); };
    const setColor = (c) => exec('foreColor', c === 'auto' ? getComputedStyle(editor).color : c); // §W fix #3: Auto = theme text
    const tb = (html, title, fn) => { const b = el(`<button class="btn-icon" title="${title}">${html}</button>`); b.onmousedown = (e) => e.preventDefault(); b.onclick = fn; return b; };
    const sep = () => el('<span class="sep"></span>');

    /* §W fix #2a: remove the highlight/annotation at the cursor (keeps the text). */
    const untag = () => {
      editor.focus();
      const sel = window.getSelection(); let node = sel.rangeCount ? sel.anchorNode : null;
      while (node && node !== editor) { if (node.nodeType === 1 && node.classList?.contains('anno')) { const p = node.parentNode; while (node.firstChild) p.insertBefore(node.firstChild, node); p.removeChild(node); save(editor); toast('Tag removed', 'check'); return; } node = node.parentNode; }
      toast('Place the cursor inside a highlight to remove it.', 'info');
    };
    /* §W fix #2b: turn every block between --- separators into a Key Term. */
    const autoKeyTerms = () => {
      const hrs = [...editor.childNodes].filter(n => n.nodeName === 'HR');
      if (hrs.length < 2) { toast('Wrap each term in --- separators (the divider) first.', 'info'); return; }
      let made = 0;
      for (let p = 0; p < hrs.length - 1; p++) {
        const between = []; let n = hrs[p].nextSibling; while (n && n !== hrs[p + 1]) { between.push(n); n = n.nextSibling; }
        if (!between.length || !between.map(x => x.textContent || '').join('').trim()) continue;
        if (between.length === 1 && between[0].nodeType === 1 && between[0].classList?.contains('anno-keyterm')) continue;
        const wrap = document.createElement('div'); wrap.className = 'anno anno-keyterm'; wrap.dataset.aid = ulid();
        editor.insertBefore(wrap, between[0]);
        for (const b of between) wrap.appendChild(b);
        made++;
      }
      if (made) { save(editor); toast(`Made ${made} key term${made === 1 ? '' : 's'}`, 'check'); } else toast('Nothing between separators to tag.', 'info');
    };

    const applyAnno = (type) => {
      editor.focus();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) { toast('Select some text to tag it.', 'info'); return; }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      const wrap = document.createElement(type === 'keyterm' ? 'div' : 'span');
      wrap.className = `anno anno-${type}`;
      wrap.dataset.aid = ulid();
      try { wrap.appendChild(range.extractContents()); range.insertNode(wrap); }
      catch { toast('Could not tag that selection — try selecting within one block.', 'info'); return; }
      sel.removeAllRanges();
      save(editor);
    };
    const annoBtn = (label, type) => { const b = el(`<button class="btn-soft anno-btn" data-anno="${type}" title="${label}">${label}</button>`); b.onmousedown = (e) => e.preventDefault(); b.onclick = () => applyAnno(type); return b; };

    const head = el(`<div class="nb-note-head"><span class="soft" style="font-size:0.74rem">EDITING</span><button class="btn-icon nb-done" title="Done">${icon('check', 16)}</button></div>`);
    head.querySelector('.nb-done').onclick = () => { save(editor); mode = 'preview'; render(); };

    const bar = el('<div class="note-toolbar nb-toolbar"></div>');
    bar.append(
      tb('<b>T</b>', 'Text style', (e) => popMenu(e.currentTarget, [
        { label: 'Title', fn: () => exec('formatBlock', '<h1>') },
        { label: 'Heading', fn: () => exec('formatBlock', '<h2>') },
        { label: 'Subheading', fn: () => exec('formatBlock', '<h3>') },
        { label: 'Body', fn: () => exec('formatBlock', '<p>') }
      ])),
      tb('<b>B</b>', 'Bold', () => exec('bold')),
      tb('<i>I</i>', 'Italic', () => exec('italic')),
      tb('<u>U</u>', 'Underline', () => exec('underline')),
      tb('<s>S</s>', 'Strikethrough', () => exec('strikeThrough')),
      tb(icon('droplet', 15), 'Text color', (e) => colorMenu(e.currentTarget, SWATCHES, setColor)),
      tb(icon('edit', 15), 'Highlight', (e) => colorMenu(e.currentTarget, HILITES, (c) => exec('hiliteColor', c))),
      sep(),
      tb(icon('check-square', 15), 'Checklist', () => exec('insertHTML', '<div class="check-line"><input type="checkbox"><span>&nbsp;</span></div>')),
      tb(icon('list', 15), 'Bullet list', () => exec('insertUnorderedList')),
      tb('1.', 'Numbered list', () => exec('insertOrderedList')),
      tb(icon('chevron-down', 15), 'Dropdown', () => exec('insertHTML', '<details open><summary>Section</summary><div>…</div></details><p></p>')),
      tb(icon('minus', 15), 'Separator', () => exec('insertHorizontalRule')),
      tb(icon('image', 15), 'Image', () => pickImage(exec)),
      tb(icon('link', 15), 'Link to…', () => openNodePicker({ onPick: ({ kind, id, label }) => exec('insertHTML', `<a class="nlink" data-kind="${kind}" data-id="${id}" contenteditable="false">${label}</a>&nbsp;`) })),
      tb(icon('wand', 15), 'Auto key terms from --- separators', autoKeyTerms),
      sep(),
      annoBtn('Key Term', 'keyterm'), annoBtn('Theme', 'theme'), annoBtn('Concept', 'concept'), annoBtn('Idea', 'idea'), annoBtn('Comment', 'comment'),
      tb(icon('x', 15), 'Remove tag at cursor', untag)
    );

    host.append(head, bar, editor);
    editor.focus();
  };

  const render = () => (mode === 'preview' ? renderPreview() : renderEditor());
  render();
}
