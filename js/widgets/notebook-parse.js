/* Notebook parsing (V2 §25/§26): turn a topic's plain-text note into structured
   study Elements — Key Terms (with details + examples) and Theme/Concept/Idea
   tags — which the Elements, Flashcard, and Quiz widgets all consume. Pure
   functions here; notebook.js calls syncTopicElements on save. */

import { store } from '../core/store.js';
import { objectsOf, createObject } from './base.js';

/** Strip HTML to plain text (for migrating legacy contentEditable notes). */
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
  const detParts = def.split(/\s+[-–—]\s+/);
  if (detParts.length > 1) { def = detParts[0]; details = detParts.slice(1); }
  return { definition: def.trim(), details: details.map(s => s.trim()).filter(Boolean), examples: examples.map(s => s.trim()).filter(Boolean) };
}

/**
 * Parse a note's text into terms + tags.
 * @returns {{terms:{term,definition,details:string[],examples:string[]}[], tags:{type,text}[]}}
 */
export function parseNote(text) {
  const terms = [];
  let cur = null;
  const flush = () => { if (cur) terms.push(cur); cur = null; };
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if (cur && (m = line.match(/^[-–—]\s+(.*)/))) { cur.details.push(m[1].trim()); continue; }
    if (cur && (m = line.match(/^\d+[.)]\s+(.*)/))) { cur.examples.push(m[1].trim()); continue; }
    // "Term: definition" — term is short and free of markers/colons
    m = line.match(/^([^:⟦⟧\n]{1,60}):\s+(.+)$/);
    if (m) {
      flush();
      const parts = splitInline(m[2].trim());
      cur = { term: m[1].trim(), definition: parts.definition, details: parts.details, examples: parts.examples };
      continue;
    }
    flush(); // prose line ends any open term
  }
  flush();

  const tags = [];
  const re = /⟦(theme|concept|idea):([^⟧]*)⟧/g;
  let t;
  while ((t = re.exec(text || ''))) { const s = t[2].trim(); if (s) tags.push({ type: t[1], text: s }); }
  return { terms, tags };
}

/** Read a topic note's text (migrating legacy html on the fly). */
export function noteText(note) {
  if (note.data.text != null) return note.data.text;
  if (note.data.html) return htmlToText(note.data.html);
  return '';
}

/**
 * Re-derive the Element objects for one topic from its note text. Elements are
 * stored on the notebook widget (kind 'element') and fully replaced each save.
 */
export function syncTopicElements(notebookWidget, ctx) {
  const { classId, className, unitId, unitName, topic, note } = ctx;
  const { terms, tags } = parseNote(noteText(note));
  for (const e of objectsOf(notebookWidget.id, 'element')) {
    if (e.data.topicId === topic.id) store.del('objects', e.id);
  }
  const base = { topicId: topic.id, topicName: topic.name, classId, className, unitId, unitName };
  for (const t of terms) createObject(notebookWidget.id, 'element', { type: 'term', ...base, term: t.term, definition: t.definition, details: t.details, examples: t.examples });
  for (const g of tags) createObject(notebookWidget.id, 'element', { type: g.type, ...base, text: g.text });
  store.put('widgets', notebookWidget); // touch for sync/autosave
  return { terms: terms.length, tags: tags.length };
}

/** Escape + render note text to highlighted preview HTML. */
export function previewHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (text || '').split(/\r?\n/).map(raw => {
    let line = esc(raw);
    line = line.replace(/⟦(theme|concept|idea):([^⟧]*)⟧/g, (_, ty, tx) => `<mark class="tag-${ty}">${tx.trim()}</mark>`);
    const m = raw.match(/^(\s*)([^:⟦⟧\n]{1,60}):\s+(.+)$/);
    if (m) line = `${esc(m[1])}<mark class="key-term">${esc(m[2])}</mark>:${line.slice(esc(m[1] + m[2]).length + 1)}`;
    return line || '&nbsp;';
  }).join('<br>');
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
