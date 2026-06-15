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

const SWATCHES = [
  ['Ink', 'var(--text)'], ['Soft', 'var(--text-soft)'], ['Accent', 'var(--accent)'],
  ['Rose', '#e57373'], ['Amber', '#ffb74d'], ['Green', '#81c784'], ['Blue', '#64b5f6'], ['Violet', '#ba68c8']
];
const HILITES = [
  ['Yellow', '#FFF176'], ['Red', '#FFCDD2'], ['Blue', '#BBDEFB'], ['Orange', '#FFE0B2'], ['Green', '#C8E6C9'], ['None', 'transparent']
];

function colorMenu(anchor, palette, apply) {
  popMenu(anchor, palette.map(([name, c]) => ({ label: name, fn: () => apply(c) })));
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

    const exec = (cmd, val = null) => { editor.focus(); document.execCommand(cmd, false, val); save(editor); };
    const tb = (html, title, fn) => { const b = el(`<button class="btn-icon" title="${title}">${html}</button>`); b.onmousedown = (e) => e.preventDefault(); b.onclick = fn; return b; };
    const sep = () => el('<span class="sep"></span>');

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
      tb(icon('droplet', 15), 'Text color', (e) => colorMenu(e.currentTarget, SWATCHES, (c) => exec('foreColor', c))),
      tb(icon('edit', 15), 'Highlight', (e) => colorMenu(e.currentTarget, HILITES, (c) => exec('hiliteColor', c))),
      sep(),
      tb(icon('check-square', 15), 'Checklist', () => exec('insertHTML', '<div class="check-line"><input type="checkbox"><span>&nbsp;</span></div>')),
      tb(icon('list', 15), 'Bullet list', () => exec('insertUnorderedList')),
      tb('1.', 'Numbered list', () => exec('insertOrderedList')),
      tb(icon('chevron-down', 15), 'Dropdown', () => exec('insertHTML', '<details open><summary>Section</summary><div>…</div></details><p></p>')),
      tb(icon('minus', 15), 'Separator', () => exec('insertHorizontalRule')),
      tb(icon('image', 15), 'Image', () => pickImage(exec)),
      tb(icon('link', 15), 'Link to…', () => openNodePicker({ onPick: ({ kind, id, label }) => exec('insertHTML', `<a class="nlink" data-kind="${kind}" data-id="${id}" contenteditable="false">${label}</a>&nbsp;`) })),
      sep(),
      annoBtn('Key Term', 'keyterm'), annoBtn('Theme', 'theme'), annoBtn('Concept', 'concept'), annoBtn('Idea', 'idea'), annoBtn('Comment', 'comment')
    );

    host.append(head, bar, editor);
    editor.focus();
  };

  const render = () => (mode === 'preview' ? renderPreview() : renderEditor());
  render();
}
