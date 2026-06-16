/* Notebook parsing (V2 §W-1): the source of truth is each Topic's rich-text
   note HTML. Study annotations live in the HTML as highlight-only spans —
   <span class="anno anno-theme" data-aid> for inline tags and
   <div class="anno anno-keyterm" data-aid> for multi-line Key Terms. This file
   derives the cross-widget `element` objects (Key Terms + Theme/Concept/Idea)
   from those spans; the Study Notes, Flashcard, and Quiz widgets all consume
   them via moduleElements(). No bracket syntax is ever written into the text. */

import { store } from '../core/store.js';
import { objectsOf, createObject } from './base.js';

/** Strip HTML to plain text, turning block boundaries + <br> into newlines. */
export function htmlToText(html) {
  const text = (html || '')
    .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const dec = document.createElement('textarea');
  dec.innerHTML = text;
  return dec.value;
}

/** Split a definition tail into {definition, details[], examples[]} for the
    one-line format: "def - detail - detail 1. example 2. example". */
function splitInline(def) {
  let examples = [];
  const exParts = def.split(/\s+\d+[.)]\s+/);
  if (exParts.length > 1) { def = exParts[0]; examples = exParts.slice(1); }
  let details = [];
  const detParts = def.split(/\s+[-–—*•]\s+/);
  if (detParts.length > 1) { def = detParts[0]; details = detParts.slice(1); }
  return { definition: def.trim(), details: details.map(s => s.trim()).filter(Boolean), examples: examples.map(s => s.trim()).filter(Boolean) };
}

/**
 * Parse the text of a single Key Term block into its fields. The block follows
 * "Term: definition", then "- detail" lines and "N. example" lines (or the
 * inline compact form). If no "Term:" colon is present, the first line becomes
 * the term name and the rest the definition (spec §W-1).
 * @returns {{term:string, definition:string, details:string[], examples:string[]}}
 */
export function parseKeyTermText(text) {
  const lines = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return { term: '', definition: '', details: [], examples: [] };
  let term = '', rest = '';
  const m = lines[0].match(/^([^:⟦⟧\n]{1,60}):\s*(.*)$/);
  if (m) { term = m[1].trim(); rest = m[2].trim(); }
  else { term = lines[0]; rest = ''; }
  const parts = splitInline(rest);
  const details = parts.details, examples = parts.examples;
  let definition = parts.definition;
  for (const line of lines.slice(1)) {
    let mm;
    if ((mm = line.match(/^[-–—*•]\s+(.*)/))) details.push(mm[1].trim());
    else if ((mm = line.match(/^(?:\d+|#)[.)]\s+(.*)/))) examples.push(mm[1].trim());
    else definition = definition ? `${definition} ${line}` : line; // prose continuation
  }
  return { term, definition: definition.trim(), details, examples };
}

const ANNO_TYPE = { 'anno-keyterm': 'term', 'anno-theme': 'theme', 'anno-concept': 'concept', 'anno-idea': 'idea', 'anno-comment': 'comment' };

/** Read the annotation type ('term'|'theme'|'concept'|'idea'|'comment') off an
    .anno element's class list, or null. */
export function annoType(elm) {
  for (const c of elm.classList) if (ANNO_TYPE[c]) return ANNO_TYPE[c];
  return null;
}

/**
 * Derive study elements from a topic note's HTML by reading its .anno spans.
 * Comments are intentionally excluded — they are inline notes, not study items.
 * @returns {{terms:object[], tags:{type,text}[]}}
 */
export function deriveElementsFromHtml(html) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  const terms = [], tags = [];
  for (const a of root.querySelectorAll('.anno')) {
    if (a.closest('.anno') !== a) continue; // skip nested annotations
    const type = annoType(a);
    if (type === 'term') {
      const parsed = parseKeyTermText(htmlToText(a.innerHTML));
      if (parsed.term || parsed.definition) terms.push(parsed);
    } else if (type === 'theme' || type === 'concept' || type === 'idea') {
      const text = htmlToText(a.innerHTML).replace(/\s+/g, ' ').trim();
      if (text) tags.push({ type, text });
    }
  }
  return { terms, tags };
}

/** Read a topic note's text (legacy plain-text or migrated from html). */
export function noteText(note) {
  if (note.data.html != null) return htmlToText(note.data.html);
  if (note.data.text != null) return note.data.text;
  return '';
}

/**
 * Migrate a legacy plain-text note (with ⟦type:text⟧ markers and "Term:" lines)
 * into rich HTML paragraphs. Per §W-1 this is a text-only migration: the words
 * are preserved verbatim, bracket markers are unwrapped to their inner text, and
 * no annotations are auto-applied (the user re-tags). The caller stashes the
 * original under data.legacyText as a safety net.
 * @returns {string} HTML
 */
export function legacyTextToHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stripped = (text || '').replace(/⟦(?:theme|concept|idea|keyterm|term|comment):([^⟧]*)⟧/g, '$1');
  const lines = stripped.split(/\r?\n/);
  return lines.map(l => l.trim() ? `<p>${esc(l)}</p>` : '<p><br></p>').join('');
}

/**
 * Re-derive the Element objects for one node from its note HTML. Accepts the
 * flexible-tree ctx `{ node, path:[{id,name,level}], note }` (path includes the
 * node itself). Elements carry the node's full ancestry (class/section/unit) for
 * filtering + a breadcrumb + pathIds for the Flashcard auto-tree. Fully replaced
 * each save. (Back-compatible with the old `{ topic, classId, … }` shape.)
 */
export function syncTopicElements(notebookWidget, ctx) {
  const node = ctx.node || ctx.topic;
  const path = ctx.path || [];
  const note = ctx.note;
  const anc = (lv) => path.find(p => p.level === lv);
  const { terms, tags } = deriveElementsFromHtml(note.data.html || '');
  for (const e of objectsOf(notebookWidget.id, 'element')) {
    if (e.data.topicId === node.id) store.del('objects', e.id);
  }
  const base = {
    topicId: node.id, topicName: node.name,
    classId: anc('class')?.id ?? ctx.classId, className: anc('class')?.name ?? ctx.className,
    sectionId: anc('section')?.id, sectionName: anc('section')?.name,
    unitId: anc('unit')?.id ?? ctx.unitId, unitName: anc('unit')?.name ?? ctx.unitName,
    crumb: path.length ? path.map(p => p.name).join(' › ') : node.name,
    pathIds: path.map(p => ({ id: p.id, name: p.name, level: p.level }))
  };
  for (const t of terms) createObject(notebookWidget.id, 'element', { type: 'term', ...base, term: t.term, definition: t.definition, details: t.details, examples: t.examples });
  for (const g of tags) createObject(notebookWidget.id, 'element', { type: g.type, ...base, text: g.text });
  store.put('widgets', notebookWidget); // touch for sync/autosave
  return { terms: terms.length, tags: tags.length };
}

/** All elements across a module's notebooks (optionally filtered). */
export function moduleElements(anyWidgetInModule, filter = {}) {
  const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(anyWidgetInModule.id)));
  const notebookIds = mod ? mod.pages.flatMap(pid => store.get('pages', pid)?.widgets || [])
    .map(id => store.get('widgets', id)).filter(w => w?.type === 'notebook').map(w => w.id) : [];
  const sel = filter.notebookIds || notebookIds;
  return store.all('objects').filter(o => o.kind === 'element' && sel.includes(o.widgetId)
    && (!filter.type || o.data.type === filter.type)
    && (!filter.classId || o.data.classId === filter.classId)
    && (!filter.unitId || o.data.unitId === filter.unitId))
    .map(o => o.data);
}
