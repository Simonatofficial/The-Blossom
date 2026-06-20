/* Flashcard data layer (V2 §W-4). Pure data + resolution helpers, no DOM, so
   both the browsing UI (flashcards.js) and the study runtime (flashcards-study.js)
   share one source of truth.

   Model: config.nodes is a flat list of { id, name, parentId, kind:'group'|'deck' }.
   Groups contain groups or decks; decks contain cards (objects, kind 'flashcard').
   config.sources links Notebook widgets; each enabled source contributes a *virtual*
   read-only auto-tree (Notebook → Class → Unit → Topic-deck) computed live from the
   notebook's Key Terms — so it always reflects the notes. "Generate Deck from
   Notebook" materializes an editable real deck instead. (Override-preserving
   re-sync of auto decks is deferred — see §W-4 notes.) */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { objectsOf, createObject, saveObject, dayObject, todayStr, dateAdd } from './base.js';
import { moduleElements } from './notebook-parse.js';
import { recordOutcome, gradeToOutcome } from './study-mastery.js';

export const FIELDS = ['term', 'definition', 'details', 'examples', 'tip'];
export const FIELD_LABEL = { term: 'Term', definition: 'Definition', details: 'Details', examples: 'Examples', tip: 'Tip' };

/** One-time migration to the §W-4 model (idempotent, guarded by config.fcV2). */
export function ensureModel(widget) {
  const c = widget.config;
  if (c.fcV2) return widget;
  if (!c.nodes) c.nodes = (c.decks || []).map(d => ({ id: d.id, name: d.name, parentId: null }));
  delete c.decks;
  const hasChild = (id) => c.nodes.some(x => x.parentId === id);
  for (const n of c.nodes) if (!n.kind) n.kind = hasChild(n.id) ? 'group' : 'deck'; // infer from structure
  // cards attached to group nodes (legacy) move into a new child deck
  for (const g of c.nodes.filter(n => n.kind === 'group')) {
    const loose = objectsOf(widget.id, 'flashcard').filter(card => (card.data.nodeId || card.data.deckId) === g.id);
    if (loose.length) {
      const deck = { id: ulid(), name: 'Cards', parentId: g.id, kind: 'deck' };
      c.nodes.push(deck);
      for (const card of loose) { card.data.nodeId = deck.id; delete card.data.deckId; saveObject(card); }
    }
  }
  // normalize card pointer to nodeId
  for (const card of objectsOf(widget.id, 'flashcard')) if (card.data.deckId && !card.data.nodeId) { card.data.nodeId = card.data.deckId; saveObject(card); }
  c.sources = c.sources || [];
  c.studySets = c.studySets || [];
  c.fcV2 = true;
  store.put('widgets', widget);
  return widget;
}

export function nodes(widget) { return widget.config.nodes || []; }
export function childNodes(allNodes, parentId) { return allNodes.filter(n => (n.parentId || null) === (parentId || null)); }

/* ---- sources + virtual auto-tree ---- */
export function sourceIds(widget) {
  return (widget.config.sources || []).filter(s => s.on && store.get('widgets', s.notebookId)).map(s => s.notebookId);
}

/** Virtual nodes from enabled sources, mirroring the notebook's flexible tree
    (Notebook → …ancestors as groups… → note-node as deck). Built from each term
    element's `pathIds` so Section / arbitrary nesting is reflected. A node that
    holds its own terms AND has children gets a "(notes)" self-deck. */
export function autoNodes(widget) {
  const out = [];
  for (const nbId of sourceIds(widget)) {
    const nb = store.get('widgets', nbId);
    const terms = moduleElements(widget, { type: 'term', notebookIds: [nbId] });
    if (!terms.length) continue;
    const root = `a:${nbId}`;
    out.push({ id: root, name: nb.name, parentId: null, kind: 'group', auto: true });
    const seen = new Set([root]);
    const containers = new Set();
    for (const t of terms) { const p = t.pathIds || [{ id: t.topicId, name: t.topicName }]; for (let i = 0; i < p.length - 1; i++) containers.add(p[i].id); }
    for (const t of terms) {
      const p = t.pathIds && t.pathIds.length ? t.pathIds : [{ id: t.topicId, name: t.topicName }];
      let parent = root;
      for (let i = 0; i < p.length; i++) {
        const seg = p[i], nid = `a:${nbId}:${seg.id}`, isNote = i === p.length - 1, isContainer = containers.has(seg.id);
        if (isNote && !isContainer) {
          if (!seen.has(nid)) { out.push({ id: nid, name: seg.name, parentId: parent, kind: 'deck', auto: true, nbId, topicId: t.topicId }); seen.add(nid); }
        } else {
          if (!seen.has(nid)) { out.push({ id: nid, name: seg.name, parentId: parent, kind: 'group', auto: true }); seen.add(nid); }
          if (isNote && isContainer) { const did = `${nid}:_self`; if (!seen.has(did)) { out.push({ id: did, name: `${seg.name} (notes)`, parentId: nid, kind: 'deck', auto: true, nbId, topicId: t.topicId }); seen.add(did); } }
        }
        parent = nid;
      }
    }
  }
  return out;
}

/** All nodes (real + virtual auto), for unified browsing/resolution. */
export function allNodes(widget) { return [...nodes(widget), ...autoNodes(widget)]; }
export function findNode(widget, id) { return allNodes(widget).find(n => n.id === id) || null; }

/* ---- cards ---- */
/** Study-card shape resolved from a deck (real or auto). */
function realDeckCards(widget, deckId) {
  return objectsOf(widget.id, 'flashcard').filter(c => c.data.nodeId === deckId).map(c => ({
    id: c.id, real: c.id, term: c.data.term, definition: c.data.definition,
    details: c.data.details || [], examples: c.data.examples || [], tip: c.data.tip || '', front: c.data.front, back: c.data.back, bucket: c.data.bucket
  }));
}
function autoDeckCards(widget, deck) {
  const terms = moduleElements(widget, { type: 'term', notebookIds: [deck.nbId] }).filter(t => t.topicId === deck.topicId);
  return terms.map((t, i) => ({ id: `${deck.id}#${i}`, auto: true, term: t.term, definition: t.definition, details: t.details || [], examples: t.examples || [], tip: t.tip || '' }));
}
export function deckCards(widget, deck) { return deck.auto ? autoDeckCards(widget, deck) : realDeckCards(widget, deck.id); }

/** Count of cards under a node (deck or group), recursing into descendant decks. */
export function cardCount(widget, node, _all) {
  const all = _all || allNodes(widget);
  if (node.kind === 'deck') return deckCards(widget, node).length;
  return childNodes(all, node.id).reduce((a, c) => a + cardCount(widget, c, all), 0);
}

/** Collect every study-card under a node (deck → its cards; group → all
    descendants). Each card is tagged with its `scope` (Class/Unit/Deck names)
    so sessions can report a per-part breakdown. */
export function collectCards(widget, node, _all) {
  const all = _all || allNodes(widget);
  if (node.kind === 'deck') {
    const unit = all.find(n => n.id === node.parentId);
    const cls = unit && all.find(n => n.id === unit.parentId);
    const scope = { deckId: node.id, deckName: node.name, unitName: unit?.name || '', className: cls?.name || '' };
    return deckCards(widget, node).map(c => ({ ...c, scope }));
  }
  return childNodes(all, node.id).flatMap(c => collectCards(widget, c, all));
}

/* ---- faces (multi-field Front/Back) ---- */
export function cardFaces(card, frontFields, backFields) {
  if (card.front != null || card.back != null) return { front: card.front || '', back: card.back || '' };
  const part = (f) => {
    if (f === 'term') return card.term || '';
    if (f === 'definition') return card.definition || '';
    if (f === 'details') return (card.details || []).map(d => '• ' + d).join('\n');
    if (f === 'examples') return (card.examples || []).map((e, i) => `${i + 1}. ${e}`).join('\n');
    if (f === 'tip') return card.tip ? `Tip: ${card.tip}` : '';
    return '';
  };
  return { front: frontFields.map(part).filter(Boolean).join('\n'), back: backFields.map(part).filter(Boolean).join('\n') };
}

/* ---- SM-2 light + Hard/Good/Easy (only persists for real cards) ---- */
export function gradeCard(widget, studyCard, grade) {
  const day = dayObject(widget.id, 'studyDay', todayStr(), { reviews: 0 }); day.data.reviews += 1; saveObject(day);
  if (!studyCard.real) return; // auto cards have no persistent SRS / mastery
  const card = store.get('objects', studyCard.real); if (!card) return;
  const d = card.data;
  d.ease = d.ease ?? 2.3; d.interval = d.interval ?? 0; d.reps = (d.reps || 0) + 1;
  if (grade === 'hard') { d.interval = Math.max(1, Math.round(d.interval * 1.2)) || 1; d.ease = Math.max(1.3, d.ease - 0.15); }
  else if (grade === 'good') { d.interval = d.interval ? Math.round(d.interval * d.ease) : 1; }
  else { d.interval = Math.max(2, Math.round((d.interval || 1) * d.ease * 1.3)); d.ease = Math.min(3, d.ease + 0.1); }
  d.bucket = grade; d.due = dateAdd(todayStr(), d.interval);
  saveObject(card);
  recordOutcome(studyCard.real, gradeToOutcome(grade)); // A2: feed weak-spot tracking
}

/* ---- node CRUD ---- */
export function addNode(widget, parentId, name, kind) {
  const n = { id: ulid(), name, parentId: parentId || null, kind };
  nodes(widget).push(n); store.put('widgets', widget); return n;
}
export function ensureChild(widget, parentId, name, kind) {
  let n = childNodes(nodes(widget), parentId).find(x => x.name === name);
  if (!n) n = addNode(widget, parentId, name, kind);
  return n;
}
export function descendantRealIds(widget, id) {
  const out = [id]; const walk = (p) => { for (const n of nodes(widget)) if (n.parentId === p) { out.push(n.id); walk(n.id); } }; walk(id); return out;
}
export function deleteNode(widget, id) {
  const ids = descendantRealIds(widget, id);
  for (const c of objectsOf(widget.id, 'flashcard')) if (ids.includes(c.data.nodeId)) store.trash('objects', c.id);
  widget.config.nodes = nodes(widget).filter(n => !ids.includes(n.id));
  store.put('widgets', widget);
}
export function addCard(widget, deckId, data) { return createObject(widget.id, 'flashcard', { nodeId: deckId, due: todayStr(), ease: 2.3, interval: 0, reps: 0, ...data }); }

/* ---- bookmarks (A5) — a flag on the real card; auto cards can't be marked ---- */
export function isBookmarked(realId) { return !!(realId && store.get('objects', realId)?.data.bookmarked); }
/** Flip a real card's bookmark; returns the new state. */
export function toggleBookmark(realId) {
  const o = realId && store.get('objects', realId);
  if (!o) return false;
  o.data.bookmarked = !o.data.bookmarked;
  saveObject(o);
  return !!o.data.bookmarked;
}

/* ---- study sets (config-stored) ---- */
export function studySets(widget) { return widget.config.studySets || (widget.config.studySets = []); }
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function orderCards(cards, order) {
  const c = cards.slice();
  if (order === 'random') return shuffle(c);
  if (order === 'hardest') return c.sort((a, b) => rank(b.bucket) - rank(a.bucket));
  if (order === 'easiest') return c.sort((a, b) => rank(a.bucket) - rank(b.bucket));
  return c;
}
function rank(b) { return b === 'hard' ? 2 : b === 'good' ? 1 : b === 'easy' ? 0 : 1.5; }

/* ---- sessions (pause/resume snapshots, kind 'fcSession') ---- */
export function savedSessions(widget) { return objectsOf(widget.id, 'fcSession'); }
