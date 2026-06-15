/* Graph data layer (V2 §23). A graph holds 1+ datasets; each dataset is either
   MANUAL (its own stored {x,y} points) or LINKED (pulled live from another
   widget's output via the value system). This module migrates the old linked-
   `series` model, resolves datasets to plottable points, parses CSV, and builds
   part-to-whole segments — the engine (graph-engine.js) only draws. */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { todayStr, dateAdd } from './base.js';
import * as values from '../core/values.js';

/** Every chart type, grouped for the picker. `mode` tells the engine how a
    graph's datasets are consumed. */
export const CHART_TYPES = [
  { key: 'line', name: 'Line', group: 'Standard', mode: 'series' },
  { key: 'area', name: 'Area', group: 'Standard', mode: 'series' },
  { key: 'bar', name: 'Bar', group: 'Standard', mode: 'series' },
  { key: 'pie', name: 'Pie', group: 'Standard', mode: 'parts' },
  { key: 'donut', name: 'Donut', group: 'Standard', mode: 'parts' },
  { key: 'scatter', name: 'Scatter', group: 'Standard', mode: 'xy' },
  { key: 'bubble', name: 'Bubble', group: 'Standard', mode: 'xy' },
  { key: 'radar', name: 'Radar', group: 'Standard', mode: 'axes' },
  { key: 'histogram', name: 'Histogram', group: 'Standard', mode: 'values' },
  { key: 'polar', name: 'Polar Area', group: 'Standard', mode: 'parts' },
  { key: 'gauge', name: 'Gauge', group: 'Advanced', mode: 'single' },
  { key: 'funnel', name: 'Funnel', group: 'Advanced', mode: 'parts' },
  { key: 'pyramid', name: 'Pyramid', group: 'Advanced', mode: 'parts' },
  { key: 'mekko', name: 'Mekko', group: 'Advanced', mode: 'parts' },
  { key: 'dualaxis', name: 'Dual-Axis', group: 'Advanced', mode: 'series' },
  { key: 'venn', name: 'Venn', group: 'Advanced', mode: 'parts' },
  { key: 'pictogram', name: 'Pictogram', group: 'Advanced', mode: 'parts' },
  { key: 'flower', name: 'Flower', group: 'Blossom', mode: 'parts' },
  { key: 'solar', name: 'Solar System', group: 'Blossom', mode: 'parts' }
];

export function chartType(kind) { return CHART_TYPES.find(c => c.key === kind) || CHART_TYPES[0]; }

export const RANGES = [
  { key: '7d', label: '7d', days: 7 }, { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 }, { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null }
];
function rangeDays(key) { return (RANGES.find(r => r.key === key) || RANGES[1]).days; }

/** A fresh empty graph definition. */
export function newGraph(kind = 'line') {
  return {
    id: ulid(), kind, datasets: [],
    range: '30d',
    xAxis: { type: kind === 'scatter' || kind === 'bubble' ? 'value' : 'time', label: '', unit: '' },
    yAxis: { label: '', unit: '' },
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
export function resolveGraph(gdef, theme) {
  normalizeGraph(gdef);
  const days = rangeDays(gdef.range);
  const today = todayStr();
  const from = days == null ? earliestDate() : dateAdd(today, -(days - 1));

  const datasets = gdef.datasets.map((ds, i) => {
    const color = datasetColor(i, theme, ds.color);
    const src = ds.source === 'link' && ds.link ? store.get('widgets', ds.link.sourceWidgetId) : null;
    const name = ds.name || src?.name || `Data ${i + 1}`;
    let points = [], now = 0;
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

  // Part-to-whole segments: one dataset with multiple points → its points;
  // otherwise each dataset contributes a single segment (its `now`).
  let segments;
  if (datasets.length === 1 && datasets[0].points.length > 1) {
    segments = datasets[0].points.map((p, j) => ({ id: `${datasets[0].id}:${j}`, label: p.label || `#${j + 1}`, value: Math.max(0, p.y), color: datasetColor(j, theme) }));
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
