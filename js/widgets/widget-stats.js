/* Shared widget-summary helpers (V2 §24). Hub, Overview, Characteristics, and
   Quest Board all need to read another widget's "stats" generically. Everything
   here derives from the value-system outputs a widget already exposes, plus a
   couple of common config fields — so it works for any widget type. */

import { outputsOf } from '../core/values.js';
import { todayStr, dateAdd } from './base.js';
import { el } from '../ui/components.js';

/** All numeric stats a widget exposes (its outputs, evaluated now/today). */
export function statsFor(widget) {
  return outputsOf(widget).map(o => {
    let value = 0;
    try { value = (o.dayKeyed ? o.get(todayStr()) : o.get(null)) ?? 0; } catch { /* quiet */ }
    return { key: o.key, label: o.name, value, dayKeyed: o.dayKeyed };
  });
}

const PRIORITY = ['level', 'streak', 'completionPct', 'progress', 'count', 'hp', 'xpToday'];

/** The single most representative stat for a summary row. */
export function keyStat(widget) {
  const stats = statsFor(widget);
  for (const k of PRIORITY) { const s = stats.find(x => x.key === k); if (s) return s; }
  return stats[0] || null;
}

/** Pretty-print a stat value (percent outputs get a %). */
export function fmtStat(s) {
  if (!s) return '—';
  const v = Math.round(s.value * 10) / 10;
  return /pct|percent|completion|adherence/i.test(s.key) ? `${Math.round(s.value)}%` : String(v);
}

/** A tiny inline sparkline canvas for a day-keyed output over N days. */
export function sparkline(widget, outputKey, days = 14) {
  const out = outputsOf(widget).find(o => o.key === outputKey && o.dayKeyed);
  const c = el(`<canvas class="ov-spark" width="240" height="36"></canvas>`);
  if (!out) return c;
  const g = c.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const pts = [];
  for (let i = days - 1; i >= 0; i--) { try { pts.push(out.get(dateAdd(todayStr(), -i)) || 0); } catch { pts.push(0); } }
  const max = Math.max(1, ...pts);
  g.strokeStyle = accent; g.lineWidth = 1.5; g.beginPath();
  pts.forEach((p, i) => { const x = 2 + (i / (days - 1)) * 236, y = 34 - (p / max) * 30; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  return c;
}

/** A compact 0–100% progress ring (shared visual with the Tracker). */
export function ring(pct, size = 30) {
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  const r = size / 2 - 3, c = 2 * Math.PI * r, off = c * (1 - pct / 100), m = size / 2;
  return el(`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--border)" stroke-width="3"></circle>
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${m} ${m})"></circle>
    <text x="${m}" y="${m + 3}" text-anchor="middle" font-size="9" fill="var(--text-soft)">${pct}</text></svg>`);
}
