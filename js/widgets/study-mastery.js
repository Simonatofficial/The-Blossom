/* Study mastery (A2): per-card outcome counters stored on the real flashcard
   object (card.data.mastery), written by BOTH the flashcard grader and the quiz
   grader (each carries the card's real object id). The aggregation that powers
   the weak-spots view + smart "Needs work" sets lives in flashcards-focus.js;
   this module is pure card-level primitives (no flashcards-model import) so the
   model can import it for grading without a cycle.

   Like SRS, auto (notebook-derived) cards have no persistent object, so they
   accrue no cross-session mastery — only real cards do. "Generate deck from
   Notebook" makes them real and trackable. */

import { store } from '../core/store.js';
import { saveObject } from './base.js';

const RECENT = 8; // rolling window for recency-weighted struggle
/** Outcome → struggle weight (1 = always missed, 0 = solid). */
const WEIGHT = { incorrect: 1, partial: 0.5, correct: 0, easy: 0 };

function blank() { return { seen: 0, correct: 0, partial: 0, incorrect: 0, easy: 0, recent: [], ts: 0 }; }

/** Record one outcome ('correct'|'partial'|'incorrect'|'easy') onto a real card. */
export function recordOutcome(realId, outcome) {
  if (!realId || WEIGHT[outcome] == null) return;
  const card = store.get('objects', realId);
  if (!card || card.kind !== 'flashcard') return;
  const m = card.data.mastery || (card.data.mastery = blank());
  m.seen++; m[outcome]++;
  m.recent = [...(m.recent || []), outcome].slice(-RECENT);
  m.ts = Date.now();
  saveObject(card);
}

/** Map a flashcard Hard/Good/Easy grade to a mastery outcome. */
export function gradeToOutcome(grade) {
  return grade === 'hard' ? 'incorrect' : grade === 'easy' ? 'easy' : 'correct';
}

/** Mastery record for a real card id, or null. */
export function masteryFor(realId) {
  return realId ? (store.get('objects', realId)?.data.mastery || null) : null;
}

/** Recency-weighted struggle: 0 (solid) … 1 (always missed); -1 if never seen. */
export function struggle(m) {
  if (!m || !m.seen) return -1;
  if (m.recent && m.recent.length) return m.recent.reduce((a, o) => a + (WEIGHT[o] ?? 0), 0) / m.recent.length;
  return (m.incorrect + 0.5 * m.partial) / m.seen;
}

/** Bucket a card by struggle: 'unseen' | 'weak' | 'shaky' | 'solid'. */
export function level(m) {
  const s = struggle(m);
  if (s < 0) return 'unseen';
  if (s >= 0.5) return 'weak';
  if (s >= 0.2) return 'shaky';
  return 'solid';
}

const shuf = (arr) => { const x = [...arr]; for (let i = x.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [x[i], x[j]] = [x[j], x[i]]; } return x; };

/** Confidence-first study order (docs/16 §2): warm up on cards you know, weave
    the weak ones through the middle so they're never clustered, and reserve a
    couple of knowns for the finish so a session ends on a win. `scoreOf(item)`
    returns a struggle value (0 solid … 1 always-missed; <0 = unseen). Small
    queues (≤4) just shuffle — too few to shape. */
export function adaptiveOrder(items, scoreOf) {
  if (items.length <= 4) return shuf(items);
  const known = [], mid = [], weak = [];
  for (const it of items) { const s = scoreOf(it); if (s >= 0 && s < 0.2) known.push(it); else if (s >= 0.5) weak.push(it); else mid.push(it); }
  const K = shuf(known), Mi = shuf(mid);
  const cushion = K.length ? K : Mi;                                   // cards used to bookend the session
  const warm = cushion.splice(0, Math.min(2, cushion.length));
  const finish = cushion.splice(0, Math.min(K.length ? 2 : 1, cushion.length));
  const easy = shuf([...K, ...Mi]);                                    // leftover knowns/mids spacing out the weak ones
  const middle = []; let e = 0;
  for (const w of shuf(weak)) { if (easy[e]) middle.push(easy[e++]); middle.push(w); }
  while (e < easy.length) middle.push(easy[e++]);
  return [...warm, ...middle, ...finish];
}
