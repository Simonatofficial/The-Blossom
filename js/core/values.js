/* The Value system (docs/02) — what makes widgets composable.
   Widgets expose named numeric outputs; a Link pulls a source output into a
   consumer. Day-keyed outputs return series. Cycles are refused at creation. */

import { store } from './store.js';
import { registry } from '../widgets/registry.js';

/** @returns {{key, name, dayKeyed, get}[]} the outputs a widget exposes. */
export function outputsOf(widget) {
  const def = registry.get(widget?.type);
  if (!def?.outputs) return [];
  try { return def.outputs(widget) || []; }
  catch (err) { console.error('[values] outputs() failed for', widget?.type, err); return []; }
}

function applyTransform(value, transform) {
  if (value == null || Number.isNaN(value)) return null;
  let v = value;
  if (transform) {
    if (transform.scale != null) v *= transform.scale;
    if (transform.offset != null) v += transform.offset;
    if (transform.clamp) {
      const [lo, hi] = transform.clamp;
      if (lo != null) v = Math.max(lo, v);
      if (hi != null) v = Math.min(hi, v);
    }
  }
  return v;
}

/**
 * Resolve a link's current value (today for day-keyed outputs).
 * @param {{sourceWidgetId: string, output: string, transform?: object}} link
 * @param {string|null} [date] 'YYYY-MM-DD' for day-keyed outputs
 * @returns {number|null}
 */
export function getValue(link, date = null) {
  const widget = store.get('widgets', link.sourceWidgetId);
  if (!widget) return null;
  const out = outputsOf(widget).find(o => o.key === link.output);
  if (!out) return null;
  try { return applyTransform(out.get(date), link.transform); }
  catch (err) { console.error('[values] get failed', link, err); return null; }
}

/**
 * Day-keyed series for a link: [{date, value}] inclusive of both ends.
 * @param {object} link @param {string} fromDate @param {string} toDate
 */
export function getSeries(link, fromDate, toDate) {
  const series = [];
  const d = new Date(fromDate + 'T12:00:00');
  const end = new Date(toDate + 'T12:00:00');
  let guard = 0;
  while (d <= end && guard++ < 1000) {
    const date = d.toISOString().slice(0, 10);
    series.push({ date, value: getValue(link, date) });
    d.setDate(d.getDate() + 1);
  }
  return series;
}

/** Ids of widgets that `widgetId` depends on (links + nested children). */
function dependencyIds(widgetId) {
  const w = store.get('widgets', widgetId);
  if (!w) return [];
  const deps = (w.links || []).map(l => l.sourceWidgetId);
  for (const child of store.all('widgets')) {
    if (child.parentWidgetId === widgetId) deps.push(child.id);
  }
  return deps;
}

/**
 * Would adding consumer -> source create a cycle? (docs/02: refused with a
 * friendly message — nested Skill chains are fine, loops are not.)
 */
export function wouldCycle(consumerWidgetId, sourceWidgetId) {
  if (consumerWidgetId === sourceWidgetId) return true;
  const seen = new Set();
  const stack = [sourceWidgetId];
  while (stack.length) {
    const id = stack.pop();
    if (id === consumerWidgetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...dependencyIds(id));
  }
  return false;
}

/** All widgets (workspace-wide) that expose at least one output. */
export function linkableSources() {
  return store.all('widgets').filter(w => outputsOf(w).length > 0);
}
