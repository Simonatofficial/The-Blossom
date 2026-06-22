/* Quiz generation + grading (V2 §W-5). Pure-ish: reads cards from linked
   Flashcard widgets (their Group/Deck tree), then builds serializable question
   descriptors and grades answers. Distractor scope is structural — a card's
   deck = Topic, its parent group = Unit, the grandparent = Class. No DOM. */

import { store } from '../core/store.js';
import * as M from './flashcards-model.js';
import { masteryFor, struggle, adaptiveOrder } from './study-mastery.js';

const MIX_TYPES = ['mc', 'truefalse', 'fill', 'dropdown'];

export const FIELDS = ['term', 'definition', 'details', 'examples', 'tip'];
export const FIELD_LABEL = { term: 'Term', definition: 'Definition', details: 'Details', examples: 'Examples', tip: 'Tip' };

const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Linked flashcard widget ids (enabled, still present). */
export function sourceFcIds(widget) {
  return (widget.config.sources || []).filter(s => s.on && store.get('widgets', s.fcId)).map(s => s.fcId);
}

/** Flatten every card from linked flashcards into records carrying structural scope. */
export function quizCards(widget) {
  const out = [];
  for (const fcId of sourceFcIds(widget)) {
    const fc = store.get('widgets', fcId); if (!fc) continue;
    M.ensureModel(fc);
    const all = M.allNodes(fc);
    const byId = new Map(all.map(n => [n.id, n]));
    // Full ancestor name chain (root → deck) for the results breakdown, e.g.
    // Class › Section › Unit › Topic. The auto Notebook wrapper root is dropped
    // so Classes lead (mirrors scopeForest).
    const pathOf = (deck) => {
      const chain = []; let n = deck;
      while (n) { chain.unshift(n); n = n.parentId ? byId.get(n.parentId) : null; }
      if (chain[0]?.auto && !chain[0].parentId && chain.length > 1) chain.shift();
      return chain.map(x => x.name);
    };
    for (const deck of all.filter(n => n.kind === 'deck')) {
      const unit = all.find(n => n.id === deck.parentId);
      const cls = unit && all.find(n => n.id === unit.parentId);
      const path = pathOf(deck);
      for (const c of M.deckCards(fc, deck)) {
        out.push({
          key: `${fcId}:${c.id}`, fcId, real: c.real || null, deckId: deck.id, unitId: unit?.id || null, classId: cls?.id || null,
          deckName: deck.name, unitName: unit?.name || '', className: cls?.name || '', path,
          term: c.term, definition: c.definition, details: c.details || [], examples: c.examples || [], tip: c.tip || '', front: c.front, back: c.back
        });
      }
    }
  }
  return out;
}

/** Class→Unit→Deck tree (by structural id) for the scope picker + selection resolution. */
export function deckTree(cards) {
  const map = new Map();
  for (const c of cards) {
    const cid = c.classId || '_', uid = c.unitId || '_';
    if (!map.has(cid)) map.set(cid, { name: c.className || 'Cards', units: new Map() });
    const units = map.get(cid).units;
    if (!units.has(uid)) units.set(uid, { name: c.unitName || '', decks: new Map() });
    const decks = units.get(uid).decks;
    if (!decks.has(c.deckId)) decks.set(c.deckId, { name: c.deckName, count: 0 });
    decks.get(c.deckId).count++;
  }
  return map;
}

/** Full-depth scope forest for the picker: mirrors each linked Flashcard's real
    node hierarchy (Class → Section → Unit → … → deck) so the Class is always the
    top folder and every level nests inside it. Returns an array of root nodes,
    each { id, name, kind:'group'|'deck', count, children:[] }. Empty branches are
    pruned; the auto Notebook wrapper is hoisted so its Classes sit at the top. */
export function scopeForest(widget) {
  const roots = [];
  for (const fcId of sourceFcIds(widget)) {
    const fc = store.get('widgets', fcId); if (!fc) continue;
    M.ensureModel(fc);
    const all = M.allNodes(fc);
    const build = (node) => {
      if (node.kind === 'deck') {
        const count = M.deckCards(fc, node).length;
        return count ? { id: node.id, name: node.name, kind: 'deck', count, children: [] } : null;
      }
      const children = M.childNodes(all, node.id).map(build).filter(Boolean);
      const count = children.reduce((a, c) => a + c.count, 0);
      return count ? { id: node.id, name: node.name, kind: 'group', count, children } : null;
    };
    for (const r of M.childNodes(all, null)) {
      const t = build(r); if (!t) continue;
      if (r.auto && t.kind === 'group') roots.push(...t.children); // drop the Notebook wrapper → Classes on top
      else roots.push(t);
    }
  }
  return roots;
}

/** Text for one field of a card (custom cards map front→term, back→definition). */
function fieldVal(card, field, limits) {
  if (field === 'term') return card.term ?? card.front ?? '';
  if (field === 'definition') return card.definition ?? card.back ?? '';
  if (field === 'details') return (card.details || []).slice(0, limits.detailN).join('; ');
  if (field === 'examples') return (card.examples || []).slice(0, limits.exampleN).join('; ');
  if (field === 'tip') return card.tip || '';
  return '';
}
export function joinFields(card, fields, limits, sep = '\n') {
  return fields.map(f => fieldVal(card, f, limits)).filter(Boolean).join(sep);
}

function scopePool(cards, subject, scope) {
  const not = (x) => x.key !== subject.key;
  if (scope === 'topic') return cards.filter(x => not(x) && x.deckId === subject.deckId);
  if (scope === 'unit') return cards.filter(x => not(x) && x.unitId === subject.unitId);
  if (scope === 'class') return cards.filter(x => not(x) && x.classId === subject.classId);
  return cards.filter(not);
}
/** Distractor answer strings for a subject, widening scope until enough unique. */
function distractors(cards, subject, scope, answerFields, limits, want) {
  const ans = joinFields(subject, answerFields, limits);
  let acc = [];
  for (const sc of [scope, 'unit', 'class', 'random']) {
    if (acc.length >= want) break;
    const more = scopePool(cards, subject, sc).map(c => joinFields(c, answerFields, limits)).filter(x => x && x !== ans);
    acc = [...new Set([...acc, ...more])];
  }
  return shuffle(acc).slice(0, want);
}

/**
 * Build serializable question descriptors for the selected cards.
 * @returns {object[]} each { id, type, context, qText, ...typeSpecific }
 */
export function buildQuestions(cfg, cards, distractorPool) {
  const dpool = (distractorPool && distractorPool.length) ? distractorPool : cards; // wrong answers can draw from a wider pool than the subjects
  let pool = cfg.order === 'sequential' ? [...cards] : shuffle(cards);
  if (cfg.count) pool = pool.slice(0, cfg.count);
  // Adaptive (docs/16 §2): reorder the chosen set confidence-first, ending on a win.
  if (cfg.order === 'adaptive') pool = adaptiveOrder(pool, (c) => struggle(masteryFor(c.real)));
  const limits = { detailN: cfg.detailN || 1, exampleN: cfg.exampleN || 1 };
  const qF = cfg.questionFields?.length ? cfg.questionFields : ['term'];
  const aF = cfg.answerFields?.length ? cfg.answerFields : ['definition'];
  // Mixed types (docs/16 §2.4, default on): rotate a shuffled cycle so each style
  // appears evenly and no one type runs long. Off → every question is cfg.type.
  const mixOn = cfg.mixedTypes !== false;
  const cycle = mixOn ? shuffle(MIX_TYPES) : null;
  const out = [];
  for (const subj of pool) {
    const qText = joinFields(subj, qF, limits), aText = joinFields(subj, aF, limits);
    if (!qText || !aText) continue;
    const context = (subj.path && subj.path.length ? subj.path : [subj.className, subj.unitName, subj.deckName]).filter(Boolean).join(' › ');
    const base = { id: subj.key + ':' + out.length, context, qText, real: subj.real || null, fcId: subj.fcId };
    const type = cycle ? cycle[out.length % cycle.length] : cfg.type;
    out.push(buildOne(type, subj, aText, base, cfg, dpool, aF, limits));
  }
  return out;
}

/** Build one question descriptor of a given type. */
function buildOne(type, subj, aText, base, cfg, cards, aF, limits) {
  if (type === 'truefalse') {
    const makeTrue = Math.random() < 0.5;
    let shown = aText;
    if (!makeTrue) { const d = distractors(cards, subj, cfg.distractorScope || 'topic', aF, limits, 1); if (d.length) shown = d[0]; }
    return { ...base, type: 'truefalse', statement: `${base.qText} — ${shown}`, isTrue: makeTrue || shown === aText };
  }
  if (type === 'fill') {
    const blanks = aF.map(f => ({ label: FIELD_LABEL[f], answer: fieldVal(subj, f, limits) })).filter(b => b.answer);
    if (blanks.length) return { ...base, type: 'fill', blanks };
  } else if (type === 'dropdown') {
    const blanks = aF.map(f => {
      const answer = fieldVal(subj, f, limits);
      const opts = distractors(cards, subj, cfg.distractorScope || 'topic', [f], limits, Math.max(1, (cfg.optionCount || 4) - 1));
      return { label: FIELD_LABEL[f], answer, options: shuffle([answer, ...opts]) };
    }).filter(b => b.answer);
    if (blanks.length) return { ...base, type: 'dropdown', blanks };
  }
  // multiple choice (also the fallback when fill/dropdown had no usable blanks)
  const want = Math.max(2, Math.min(8, cfg.optionCount || 4)) - 1;
  const options = shuffle([aText, ...distractors(cards, subj, cfg.distractorScope || 'topic', aF, limits, want)]);
  return { ...base, type: 'mc', options, correct: aText };
}

/** Grade one answered question. @returns {'correct'|'semi'|'incorrect'} */
export function gradeQuestion(q, given) {
  if (q.type === 'mc') return given === q.correct ? 'correct' : 'incorrect';
  if (q.type === 'truefalse') return (!!given) === q.isTrue ? 'correct' : 'incorrect';
  // fill / dropdown: per-blank
  const right = q.blanks.reduce((n, b, i) => n + (norm(given?.[i]) === norm(b.answer) ? 1 : 0), 0);
  return right === q.blanks.length ? 'correct' : right > 0 ? 'semi' : 'incorrect';
}

/** Human-readable correct answer for review. */
export function correctText(q) {
  if (q.type === 'mc') return q.correct;
  if (q.type === 'truefalse') return q.isTrue ? 'True' : 'False';
  return q.blanks.map(b => b.answer).join(' · ');
}
export function givenText(q, given) {
  if (q.type === 'mc') return given ?? '—';
  if (q.type === 'truefalse') return given == null ? '—' : (given ? 'True' : 'False');
  return (given || []).map(x => x || '—').join(' · ') || '—';
}
