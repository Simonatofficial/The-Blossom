/* Graph data layer (V2 §23). A graph holds 1+ datasets; each dataset is either
   MANUAL (its own stored {x,y} points) or LINKED (pulled live from another
   widget's output via the value system). This module migrates the old linked-
   `series` model, resolves datasets to plottable points, parses CSV, and builds
   part-to-whole segments — the engine (graph-engine.js) only draws. */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { todayStr, dateAdd } from './base.js';
import * as values from '../core/values.js';
import * as M from './flashcards-model.js';
import { masteryFor, struggle } from './study-mastery.js';

/** Every chart type, grouped for the picker. `mode` tells the engine how a
    graph's datasets are consumed. */
export const CHART_TYPES = [
  { key: 'line', name: 'Line', group: 'Standard', mode: 'series' },
  { key: 'bar', name: 'Bar', group: 'Standard', mode: 'series' },
  { key: 'area', name: 'Area', group: 'Standard', mode: 'series' },
  { key: 'pie', name: 'Pie', group: 'Standard', mode: 'parts' },
  { key: 'donut', name: 'Donut', group: 'Standard', mode: 'parts' },
  { key: 'scatter', name: 'Scatter', group: 'Standard', mode: 'xy' },
  { key: 'bubble', name: 'Bubble', group: 'Standard', mode: 'xy' },
  { key: 'radar', name: 'Radar / Spider', group: 'Comparison', mode: 'axes' },
  { key: 'histogram', name: 'Histogram', group: 'Comparison', mode: 'values' },
  { key: 'polar', name: 'Polar Area', group: 'Comparison', mode: 'parts' },
  { key: 'dualaxis', name: 'Dual-Axis', group: 'Comparison', mode: 'series' },
  { key: 'venn', name: 'Venn', group: 'Comparison', mode: 'parts' },
  { key: 'mekko', name: 'Mekko', group: 'Comparison', mode: 'parts' },
  { key: 'funnel', name: 'Funnel', group: 'Distribution', mode: 'parts' },
  { key: 'pyramid', name: 'Pyramid', group: 'Distribution', mode: 'parts' },
  { key: 'cone', name: 'Cone', group: 'Distribution', mode: 'parts' },
  { key: 'pictogram', name: 'Pictogram', group: 'Distribution', mode: 'parts' },
  { key: 'gauge', name: 'Gauge', group: 'Distribution', mode: 'single' },
  { key: 'flower', name: 'Flower', group: 'Blossom Specials', mode: 'parts' },
  { key: 'solar', name: 'Solar System', group: 'Blossom Specials', mode: 'parts' }
];

/** X-axis dimensions + Time granularities, and Y-axis dimension presets (§W-6). */
export const X_DIMENSIONS = [{ key: 'time', label: 'Time' }, { key: 'category', label: 'Category' }, { key: 'count', label: 'Count' }];
export const GRAINS = [{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }];
export const Y_DIMENSIONS = [
  { key: 'completed', label: 'Completed', unit: '' }, { key: 'streak', label: 'Streak', unit: '' },
  { key: 'measurement', label: 'Measurement', unit: '' }, { key: 'score', label: 'Score', unit: '%' },
  { key: 'level', label: 'Level', unit: '' }, { key: 'duration', label: 'Duration', unit: 'min' },
  { key: 'custom', label: 'Custom', unit: '' }
];

export function chartType(kind) { return CHART_TYPES.find(c => c.key === kind) || CHART_TYPES[0]; }

export const RANGES = [
  { key: '7d', label: '7d', days: 7 }, { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 }, { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null }
];
function rangeDays(key) { return (RANGES.find(r => r.key === key) || RANGES[1]).days; }

/* ---- Time dimension: navigable period + buckets (§W-6) ---- */
/** The date span + label for a Time grain at a period offset (0 = current). */
export function periodRange(grain, offset = 0) {
  const now = new Date(); now.setHours(12, 0, 0, 0);
  if (grain === 'week') { const s = new Date(now); s.setDate(s.getDate() - s.getDay() + offset * 7); const e = new Date(s); e.setDate(e.getDate() + 6); return { start: s, end: e, label: `Week of ${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }; }
  if (grain === 'month') { const s = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12); const e = new Date(s.getFullYear(), s.getMonth() + 1, 0, 12); return { start: s, end: e, label: s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }; }
  if (grain === 'year') { const s = new Date(now.getFullYear() + offset, 0, 1, 12); const e = new Date(now.getFullYear() + offset, 11, 31, 12); return { start: s, end: e, label: String(s.getFullYear()) }; }
  const d = new Date(now); d.setDate(d.getDate() + offset); return { start: d, end: d, label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) };
}
export function periodLabelFor(gdef) { return periodRange(gdef.xAxis?.grain, gdef.xAxis?.period || 0).label; }

function bucketsFor(grain, end) {
  if (grain === 'week') return { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], idx: (dt) => dt.getDay() };
  if (grain === 'year') return { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], idx: (dt) => dt.getMonth() };
  if (grain === 'month') { const n = Math.ceil(end.getDate() / 7); return { labels: Array.from({ length: n }, (_, i) => `W${i + 1}`), idx: (dt) => Math.min(n - 1, Math.floor((dt.getDate() - 1) / 7)) }; }
  return { labels: Array.from({ length: 24 }, (_, i) => `${i}h`), idx: (dt) => dt.getHours() };
}
/** Bucket a dataset's points into the period's buckets (sum per bucket). */
export function bucketTime(points, grain, offset = 0) {
  const { start, end } = periodRange(grain, offset);
  const { labels, idx } = bucketsFor(grain, end);
  const out = labels.map(l => ({ x: l, label: l, y: 0 }));
  const lo = new Date(start); lo.setHours(0, 0, 0, 0); const hi = new Date(end); hi.setHours(23, 59, 59, 999);
  for (const p of points) {
    const dt = p.date ? new Date(p.date + 'T12:00:00') : new Date(p.x);
    if (isNaN(dt) || dt < lo || dt > hi) continue;
    const i = idx(dt); if (out[i]) out[i].y += (Number(p.y) || 0);
  }
  return out;
}

/** A fresh empty graph definition. */
export function newGraph(kind = 'line') {
  return {
    id: ulid(), kind, datasets: [],
    range: '30d',
    xAxis: { type: kind === 'scatter' || kind === 'bubble' ? 'value' : 'time', grain: null, period: 0, label: '', unit: '' },
    yAxis: { dim: 'custom', label: '', unit: '' },
    legend: true, valueLabels: true, gridlines: true, smooth: false, animate: true,
    stacked: false, horizontal: false, background: 'transparent',
    gauge: { min: 0, max: 100 }
  };
}

/** Migrate a legacy graph ({series:[{link}]}) into the dataset model in place. */
export function normalizeGraph(gdef) {
  if (!gdef.datasets) {
    gdef.datasets = (gdef.series || []).map((s, i) => ({
      id: ulid(), name: s.label || null, color: s.color || null,
      source: 'link', link: s.link, points: []
    }));
  }
  gdef.range = gdef.range || '30d';
  if (typeof gdef.range === 'string' && !rangeKeys().includes(gdef.range)) {
    gdef.range = { week: '7d', month: '30d', quarter: '90d' }[gdef.range] || '30d';
  }
  gdef.xAxis = gdef.xAxis || { type: 'time', label: '', unit: '' };
  gdef.yAxis = gdef.yAxis || { label: '', unit: '' };
  gdef.gauge = gdef.gauge || { min: 0, max: 100 };
  return gdef;
}
function rangeKeys() { return RANGES.map(r => r.key); }

/** A new dataset (manual unless a link is supplied). */
export function newDataset(name = 'Data', link = null) {
  return { id: ulid(), name, color: null, source: link ? 'link' : 'manual', link, points: [] };
}

const PALETTE = (theme) => [theme.accent, theme.highlight, theme.success, theme.warn,
  '#7cc4ff', '#f6a5c0', '#9be3b4', '#e0b3ff', '#ffd28a', '#8fd0c7'];
export function datasetColor(i, theme, override) { return override || PALETTE(theme)[i % PALETTE(theme).length]; }

/* ---- Study skills source (docs/16 §5b) ---- */

/** Flashcard widgets that feed a study graph: same module as the graph if any
    live there, else every Flashcard widget in the workspace. */
function studyFlashcards(widget) {
  const all = store.all('widgets').filter(w => w.type === 'flashcards');
  if (!widget) return all;
  const page = store.all('pages').find(p => p.widgets?.includes(widget.id));
  const mod = page && store.all('modules').find(m => m.pages?.includes(page.id));
  if (mod) {
    const inMod = all.filter(w => mod.pages.some(pid => store.get('pages', pid)?.widgets?.includes(w.id)));
    if (inMod.length) return inMod;
  }
  return all;
}

/**
 * Per-Class study-skill points from card mastery: one point per Class (subject),
 * y = recall % (0–100), with per-Unit recall as complex-particle sub-values (the
 * buds on each petal). Recall = average (1 − struggle) over *seen* real cards;
 * unseen cards are ignored, a never-studied class shows recall 0 (a Seed bud).
 * @returns {{x:string,label:string,y:number,particles:{value01:number}[],seen:number}[]}
 */
export function studySkillPoints(widget) {
  const classes = new Map(); // key → { name, sum, seen, units:Map }
  for (const fc of studyFlashcards(widget)) {
    M.ensureModel(fc);
    const all = M.allNodes(fc);
    for (const deck of all.filter(n => n.kind === 'deck' && !n.auto)) {
      const unit = all.find(n => n.id === deck.parentId);
      const cls = unit && all.find(n => n.id === unit.parentId);
      const cKey = cls?.id || unit?.id || deck.id, cName = cls?.name || unit?.name || deck.name;
      let C = classes.get(cKey); if (!C) classes.set(cKey, C = { name: cName, sum: 0, seen: 0, units: new Map() });
      const uKey = unit?.id || deck.id, uName = unit?.name || deck.name;
      let U = C.units.get(uKey); if (!U) C.units.set(uKey, U = { name: uName, sum: 0, seen: 0 });
      for (const c of M.deckCards(fc, deck)) {
        const s = struggle(masteryFor(c.real));
        if (s < 0) continue; // unseen
        const recall = 1 - s; C.sum += recall; C.seen++; U.sum += recall; U.seen++;
      }
    }
  }
  const points = [...classes.values()].map(C => ({
    x: C.name, label: C.name, seen: C.seen,
    y: Math.round((C.seen ? C.sum / C.seen : 0) * 100),
    particles: [...C.units.values()].filter(u => u.seen).map(u => ({ value01: u.sum / u.seen }))
  }));
  return points.sort((a, b) => b.y - a.y); // strongest subjects lead
}

/** Earliest object date across the workspace (for range 'all'). */
function earliestDate() {
  let min = todayStr();
  for (const o of store.all('objects')) if (o.date && o.date < min) min = o.date;
  return min;
}

/**
 * Resolve a graph's datasets into plottable points.
 * @returns {{datasets:{id,name,color,points:{x,y,r,label,date}[],now:number}[], segments:{label,value,color,id}[]}}
 */
export function resolveGraph(gdef, theme, widget) {
  normalizeGraph(gdef);
  const days = rangeDays(gdef.range);
  const today = todayStr();
  const from = days == null ? earliestDate() : dateAdd(today, -(days - 1));

  const datasets = gdef.datasets.map((ds, i) => {
    const color = datasetColor(i, theme, ds.color);
    const src = ds.source === 'link' && ds.link ? store.get('widgets', ds.link.sourceWidgetId) : null;
    const name = ds.name || src?.name || `Data ${i + 1}`;
    let points = [], now = 0;
    if (ds.source === 'study') {
      points = studySkillPoints(widget).map(p => ({ x: p.x, label: p.label, y: p.y, particles: p.particles }));
      now = points[0]?.y || 0;
      return { id: ds.id, name: ds.name || 'Study skills', color, points, now };
    }
    if (ds.source === 'link' && ds.link) {
      const series = values.getSeries(ds.link, from, today);
      points = series.map(p => ({ x: p.date, date: p.date, y: p.value ?? 0, label: p.date.slice(5) }));
      now = values.getValue(ds.link) ?? (points.at(-1)?.y ?? 0);
    } else {
      points = (ds.points || []).map(p => ({ x: p.x, y: Number(p.y) || 0, r: p.r != null ? Number(p.r) : undefined, label: String(p.x ?? '') }));
      now = points.length ? points.at(-1).y : 0;
    }
    return { id: ds.id, name, color, points, now };
  });

  // §W-6 time dimension: re-bucket linked/manual points into the navigable period.
  const xa = gdef.xAxis || {};
  if (xa.type === 'time' && xa.grain) {
    for (const d of datasets) { d.points = bucketTime(d.points, xa.grain, xa.period || 0); d.now = d.points.at(-1)?.y ?? d.now; }
  } else if (xa.type === 'count') {
    for (const d of datasets) d.points = d.points.map((p, j) => ({ ...p, x: j + 1, label: String(j + 1) }));
  }

  // Part-to-whole segments: one dataset with multiple points (or any point that
  // carries complex particles, e.g. study skills) → its points; otherwise each
  // dataset contributes a single segment (its `now`).
  let segments;
  const solo = datasets.length === 1 ? datasets[0] : null;
  if (solo && (solo.points.length > 1 || solo.points.some(p => p.particles))) {
    segments = solo.points.map((p, j) => ({ id: `${solo.id}:${j}`, label: p.label || `#${j + 1}`, value: Math.max(0, p.y), color: datasetColor(j, theme), particles: p.particles }));
  } else {
    segments = datasets.map(d => ({ id: d.id, label: d.name, value: Math.max(0, d.now), color: d.color }));
  }
  return { datasets, segments };
}

/**
 * Parse CSV into manual datasets. First column = X (date or label); each further
 * column becomes a dataset (header row used for names when present).
 * @returns {{name:string, points:{x:string,y:number}[]}[]}
 */
export function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map(r => r.split(',').map(c => c.trim()));
  if (!rows.length) return [];
  const headerIsText = rows[0].slice(1).some(c => c !== '' && Number.isNaN(Number(c)));
  const header = headerIsText ? rows[0] : null;
  const body = headerIsText ? rows.slice(1) : rows;
  const cols = Math.max(...body.map(r => r.length));
  const out = [];
  for (let c = 1; c < cols; c++) {
    out.push({ name: header?.[c] || `Column ${c}`, points: body.filter(r => r[c] !== undefined && r[c] !== '').map(r => ({ x: r[0], y: Number(r[c]) || 0 })) });
  }
  return out;
}
