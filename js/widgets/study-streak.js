/* Study streak (docs/16 §3, earned delight): a daily "tended the garden" streak.
   A day counts as tended if you reviewed any flashcard (a studyDay with reviews)
   or finished a quiz (a quizResult). Pure-derived from existing objects — no new
   writes. Shown as a quiet leaf + number on the study cards and at session end. */

import { store } from '../core/store.js';
import { todayStr, dateAdd } from './base.js';

/** Set of YYYY-MM-DD dates on which the garden was tended (study or quiz). */
export function activeDates() {
  const set = new Set();
  for (const o of store.all('objects')) {
    if (!o.date) continue;
    if (o.kind === 'studyDay' && (o.data?.reviews || 0) > 0) set.add(o.date);
    else if (o.kind === 'quizResult') set.add(o.date);
  }
  return set;
}

/**
 * Current + best study streak.
 * @returns {{current:number, best:number, todayDone:boolean}}
 * The current streak ends today if you've studied, else yesterday (still alive,
 * "at risk") — so it doesn't read 0 just because today isn't done yet.
 */
export function studyStreak() {
  const dates = activeDates();
  const today = todayStr();
  const todayDone = dates.has(today);
  let cursor = todayDone ? today : dateAdd(today, -1);
  let current = 0;
  while (dates.has(cursor)) { current++; cursor = dateAdd(cursor, -1); }
  let best = 0, run = 0, prev = null;
  for (const d of [...dates].sort()) {
    run = (prev && dateAdd(prev, 1) === d) ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return { current, best, todayDone };
}

/** A streak is a milestone at 3, 7, 14, 30, 50, 100, 200, 365… days. */
export function isStreakMilestone(n) {
  return [3, 7, 14, 30, 50, 100, 200, 365].includes(n);
}
