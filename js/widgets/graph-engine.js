/* Graph engine (V2 §23): vanilla-canvas renderers for every chart type. No
   libraries. `drawChart` dispatches on gdef.kind and returns hit regions for
   the tap → tooltip → navigate interaction. Theme colours are passed in so the
   surface/atmosphere always shows through. The Flower geometry stays in
   flowergraph.js; everything else lives here. */

import { drawFlower, hexA } from './flowergraph.js';

const TAU = Math.PI * 2;
const round = (n) => Math.round(n * 100) / 100;

/** @returns {{hits:object[], animating:boolean}} */
export function drawChart(g, p) {
  const { gdef, datasets, segments, theme, W, H, t, big, selected, reduced } = p;
  g.clearRect(0, 0, W, H);
  const hits = [];

  if (!datasets.length || (!segments.some(s => s.value > 0) && !datasets.some(d => d.points.length))) {
    g.fillStyle = theme.textSoft; g.font = '13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('No data yet — add a dataset to grow this graph.', W / 2, H / 2);
    return { hits, animating: false };
  }
  const prog = reduced ? 1 : Math.min(1, t / 0.5);

  switch (gdef.kind) {
    case 'pie': case 'donut': return pie(g, p, hits, prog);
    case 'polar': return polar(g, p, hits, prog);
    case 'radar': return radar(g, p, hits, prog);
    case 'gauge': return gauge(g, p, hits, prog);
    case 'funnel': return funnel(g, p, hits, prog);
    case 'pyramid': return pyramid(g, p, hits, prog);
    case 'pictogram': return pictogram(g, p, hits);
    case 'venn': return venn(g, p, hits, prog);
    case 'mekko': return mekko(g, p, hits, prog);
    case 'histogram': return histogram(g, p, hits, prog);
    case 'scatter': case 'bubble': return scatter(g, p, hits, prog);
    case 'flower': return flower(g, p, hits, t);
    case 'solar': return solar(g, p, hits, t);
    case 'dualaxis': return dualAxis(g, p, hits, prog);
    case 'bar': return bars(g, p, hits, t);
    default: return lineArea(g, p, hits, t); // line / area
  }
}

/* ---------- shared chrome ---------- */

function plotBox(p, extraBottom = 0) {
  const { W, H, gdef } = p;
  const pad = { l: 38, r: 12, t: 14, b: 26 + extraBottom };
  if (gdef.legend && p.datasets.length > 1) pad.b += 16;
  if (gdef.yAxis?.label) pad.l += 14;
  if (gdef.xAxis?.label) pad.b += 12;
  return { ...pad, w: W - pad.l - pad.r, h: H - pad.t - pad.b };
}

function gridAndAxes(g, p, box, maxV, minV = 0) {
  const { theme, gdef, W, H } = p;
  g.font = '10px system-ui'; g.textBaseline = 'middle';
  for (let k = 0; k <= 3; k++) {
    const y = box.t + (box.h * k) / 3;
    if (gdef.gridlines !== false) {
      g.strokeStyle = theme.border; g.globalAlpha = 0.5; g.lineWidth = 1;
      g.beginPath(); g.moveTo(box.l, y); g.lineTo(box.l + box.w, y); g.stroke(); g.globalAlpha = 1;
    }
    g.fillStyle = theme.textSoft; g.textAlign = 'right';
    g.fillText(String(round(maxV - (maxV - minV) * (k / 3))), box.l - 5, y);
  }
  if (gdef.yAxis?.label) {
    g.save(); g.translate(11, box.t + box.h / 2); g.rotate(-Math.PI / 2);
    g.fillStyle = theme.textSoft; g.textAlign = 'center'; g.font = '10px system-ui';
    g.fillText(gdef.yAxis.label + (gdef.yAxis.unit ? ` (${gdef.yAxis.unit})` : ''), 0, 0); g.restore();
  }
  if (gdef.xAxis?.label) {
    g.fillStyle = theme.textSoft; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(gdef.xAxis.label + (gdef.xAxis.unit ? ` (${gdef.xAxis.unit})` : ''), box.l + box.w / 2, H - 4);
  }
}

function legend(g, items, theme, W, H) {
  if (items.length < 2) return;
  g.font = '10px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle';
  const widths = items.map(it => 16 + g.measureText(it.label).width + 12);
  let x = Math.max(8, (W - widths.reduce((a, b) => a + b, 0)) / 2);
  const y = H - 8;
  items.forEach((it, i) => {
    g.fillStyle = it.color; g.beginPath(); g.roundRect(x, y - 4, 9, 9, 2); g.fill();
    g.fillStyle = theme.textSoft; g.fillText(it.label, x + 13, y);
    x += widths[i];
  });
}

function xLabels(g, p, box, labels, n) {
  const { theme } = p;
  g.fillStyle = theme.textSoft; g.font = '9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'top';
  const step = Math.ceil(n / 8);
  for (let j = 0; j < n; j += step) {
    const x = box.l + (n === 1 ? box.w / 2 : (j / (n - 1)) * box.w);
    g.fillText(labels[j] ?? '', x, box.t + box.h + 4);
  }
}

/* ---------- series: line / area ---------- */

function lineArea(g, p, hits, t) {
  const { datasets, theme, gdef, reduced, selected } = p;
  const box = plotBox(p);
  const maxV = Math.max(1, ...datasets.flatMap(d => d.points.map(pt => pt.y)));
  gridAndAxes(g, p, box, maxV);
  const n = Math.max(1, ...datasets.map(d => d.points.length));
  const xAt = (j) => box.l + (n === 1 ? box.w / 2 : (j / (n - 1)) * box.w);
  const yAt = (v) => box.t + box.h - (v / maxV) * box.h;
  const prog = reduced ? 1 : Math.min(1, t / 0.5);
  const isArea = gdef.kind === 'area';
  datasets.forEach((d, i) => {
    const coords = d.points.map((pt, j) => [xAt(j), yAt(pt.y)]);
    const shown = coords.slice(0, Math.max(1, Math.floor(coords.length * prog)));
    const trace = () => {
      g.beginPath();
      if (gdef.smooth && shown.length > 2) {
        g.moveTo(shown[0][0], shown[0][1]);
        for (let j = 1; j < shown.length - 1; j++) {
          const mx = (shown[j][0] + shown[j + 1][0]) / 2, my = (shown[j][1] + shown[j + 1][1]) / 2;
          g.quadraticCurveTo(shown[j][0], shown[j][1], mx, my);
        }
        g.lineTo(shown.at(-1)[0], shown.at(-1)[1]);
      } else shown.forEach((c, j) => j ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1]));
    };
    if (shown.length > 1) {
      if (isArea) { trace(); g.lineTo(shown.at(-1)[0], box.t + box.h); g.lineTo(shown[0][0], box.t + box.h); g.closePath(); g.fillStyle = hexA(d.color, 0.18); g.fill(); }
      g.strokeStyle = d.color; g.lineWidth = 2; trace(); g.stroke();
    }
    if (prog >= 1) coords.forEach((c, j) => {
      g.beginPath(); g.arc(c[0], c[1], selected?.i === i && selected?.j === j ? 4 : 2.5, 0, TAU); g.fillStyle = d.color; g.fill();
      if (gdef.valueLabels !== false && coords.length <= 14) {
        g.fillStyle = theme.textSoft; g.font = '9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(String(round(d.points[j].y)), c[0], c[1] - 5);
      }
      hits.push({ i, j, kind: 'pt', test: (x, y) => Math.hypot(x - c[0], y - c[1]) < 12 });
    });
  });
  xLabels(g, p, box, datasets[0]?.points.map(pt => pt.label) || [], n);
  legend(g, datasets, theme, p.W, p.H);
  return { hits, animating: !reduced && t < 0.55 };
}

/* ---------- bars (grouped / stacked, vertical / horizontal) ---------- */

function bars(g, p, hits, t) {
  const { datasets, theme, gdef, reduced } = p;
  const horiz = gdef.horizontal, stacked = gdef.stacked;
  const box = plotBox(p);
  const n = Math.max(1, ...datasets.map(d => d.points.length));
  const stackMax = (j) => datasets.reduce((a, d) => a + (d.points[j]?.y || 0), 0);
  const maxV = stacked ? Math.max(1, ...Array.from({ length: n }, (_, j) => stackMax(j)))
    : Math.max(1, ...datasets.flatMap(d => d.points.map(pt => pt.y)));
  if (!horiz) gridAndAxes(g, p, box, maxV);
  const done = reduced || t >= 1;
  const grp = (horiz ? box.h : box.w) / n;
  const bw = stacked ? grp * 0.6 : Math.min(28, (grp * 0.7) / datasets.length);
  datasets.forEach((d, i) => {
    let acc = new Array(n).fill(0);
    d.points.forEach((pt, j) => {
      const rise = reduced ? 1 : Math.min(1, Math.max(0, (t - j * 0.02) / 0.4));
      const len = (pt.y / maxV) * (horiz ? box.w : box.h) * rise;
      let x, y, w, h;
      if (horiz) {
        const base = stacked ? box.l + (acc[j] / maxV) * box.w : box.l;
        y = box.t + j * grp + (grp - bw * (stacked ? 1 : datasets.length)) / 2 + (stacked ? 0 : i * bw);
        x = base; w = len; h = bw - 2;
      } else {
        const gx = box.l + j * grp + (grp - bw * (stacked ? 1 : datasets.length)) / 2 + (stacked ? 0 : i * bw);
        const baseY = stacked ? box.t + box.h - (acc[j] / maxV) * box.h : box.t + box.h;
        x = gx; y = baseY - len; w = bw - 2; h = len;
      }
      g.fillStyle = hexA(d.color, p.selected?.i === i && p.selected?.j === j ? 1 : 0.82);
      g.beginPath(); g.roundRect(x, y, Math.max(0.5, w), Math.max(0.5, h), 3); g.fill();
      if (gdef.valueLabels !== false && done && pt.y) {
        g.fillStyle = theme.textSoft; g.font = '9px system-ui';
        if (horiz) { g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(String(round(pt.y)), x + w + 3, y + h / 2); }
        else { g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(String(round(pt.y)), x + w / 2, y - 2); }
      }
      hits.push({ i, j, kind: 'pt', test: (px, py) => px >= x && px <= x + Math.abs(w) && py >= Math.min(y, y + h) && py <= Math.max(y, y + h) });
      acc[j] += pt.y;
    });
  });
  if (!horiz) xLabels(g, p, box, datasets[0]?.points.map(pt => pt.label) || [], n);
  legend(g, datasets, theme, p.W, p.H);
  return { hits, animating: !reduced && t < 1 };
}

/* ---------- dual axis (bars on left, line on right) ---------- */

function dualAxis(g, p, hits, prog) {
  const { datasets, theme, gdef } = p;
  const box = plotBox(p);
  const d0 = datasets[0], d1 = datasets[1];
  const n = Math.max(1, d0?.points.length || 0, d1?.points.length || 0);
  const max0 = Math.max(1, ...(d0?.points.map(pt => pt.y) || [1]));
  const max1 = Math.max(1, ...(d1?.points.map(pt => pt.y) || [1]));
  gridAndAxes(g, p, box, max0);
  // right axis labels
  g.fillStyle = theme.textSoft; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '10px system-ui';
  for (let k = 0; k <= 3; k++) g.fillText(String(round(max1 - max1 * k / 3)), box.l + box.w + 4, box.t + box.h * k / 3);
  const grp = box.w / n, bw = Math.min(26, grp * 0.6);
  d0?.points.forEach((pt, j) => {
    const h = (pt.y / max0) * box.h * prog, x = box.l + j * grp + (grp - bw) / 2;
    g.fillStyle = hexA(d0.color, 0.8); g.beginPath(); g.roundRect(x, box.t + box.h - h, bw, h, 3); g.fill();
    hits.push({ i: 0, j, kind: 'pt', test: (px, py) => px >= x && px <= x + bw && py >= box.t && py <= box.t + box.h });
  });
  if (d1) {
    g.strokeStyle = d1.color; g.lineWidth = 2; g.beginPath();
    d1.points.forEach((pt, j) => { const x = box.l + j * grp + grp / 2, y = box.t + box.h - (pt.y / max1) * box.h * prog; j ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    d1.points.forEach((pt, j) => { const x = box.l + j * grp + grp / 2, y = box.t + box.h - (pt.y / max1) * box.h * prog; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fillStyle = d1.color; g.fill(); });
  }
  xLabels(g, p, box, d0?.points.map(pt => pt.label) || [], n);
  legend(g, datasets, theme, p.W, p.H);
  return { hits, animating: prog < 1 };
}

/* ---------- scatter / bubble ---------- */

function scatter(g, p, hits, prog) {
  const { datasets, theme, gdef } = p;
  const box = plotBox(p);
  const all = datasets.flatMap(d => d.points);
  const xs = all.map(pt => Number(pt.x) || 0), ys = all.map(pt => pt.y);
  const xMax = Math.max(1, ...xs), yMax = Math.max(1, ...ys);
  const rMax = Math.max(1, ...all.map(pt => pt.r || 0));
  gridAndAxes(g, p, box, yMax);
  datasets.forEach((d, i) => d.points.forEach((pt, j) => {
    const x = box.l + ((Number(pt.x) || 0) / xMax) * box.w;
    const y = box.t + box.h - (pt.y / yMax) * box.h;
    const r = gdef.kind === 'bubble' && pt.r != null ? 3 + (pt.r / rMax) * 20 * prog : 4;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = hexA(d.color, 0.6); g.fill();
    g.strokeStyle = d.color; g.lineWidth = 1; g.stroke();
    hits.push({ i, j, kind: 'pt', test: (px, py) => Math.hypot(px - x, py - y) < r + 4 });
  }));
  legend(g, datasets, theme, p.W, p.H);
  return { hits, animating: prog < 1 };
}

/* ---------- histogram ---------- */

function histogram(g, p, hits, prog) {
  const { datasets, theme, gdef } = p;
  const box = plotBox(p);
  const vals = (datasets[0]?.points || []).map(pt => pt.y);
  if (!vals.length) return { hits, animating: false };
  const min = Math.min(...vals), max = Math.max(...vals);
  const binCount = Math.max(1, Math.min(12, Math.round(Math.sqrt(vals.length)) || 5));
  const span = (max - min) || 1, bw = span / binCount;
  const bins = new Array(binCount).fill(0);
  for (const v of vals) bins[Math.min(binCount - 1, Math.floor((v - min) / bw))]++;
  const maxC = Math.max(1, ...bins);
  gridAndAxes(g, p, box, maxC);
  const slot = box.w / binCount;
  bins.forEach((c, j) => {
    const h = (c / maxC) * box.h * prog, x = box.l + j * slot;
    g.fillStyle = hexA(datasets[0].color, 0.82); g.beginPath(); g.roundRect(x + 1, box.t + box.h - h, slot - 2, h, 3); g.fill();
    hits.push({ i: 0, j, kind: 'bin', label: `${round(min + j * bw)}–${round(min + (j + 1) * bw)}: ${c}`, test: (px, py) => px >= x && px <= x + slot && py >= box.t && py <= box.t + box.h });
  });
  xLabels(g, p, box, bins.map((_, j) => round(min + j * bw)), binCount);
  return { hits, animating: prog < 1 };
}

/* ---------- pie / donut ---------- */

function pie(g, p, hits, prog) {
  const { segments, theme, gdef, W, H } = p;
  const showLeg = gdef.legend;
  const cx = W / 2, cy = (H - (showLeg ? 14 : 0)) / 2, R = Math.min(W, H - (showLeg ? 14 : 0)) / 2 - 18;
  const total = Math.max(0.001, segments.reduce((a, s) => a + s.value, 0));
  let a0 = -Math.PI / 2;
  segments.forEach((s, i) => {
    const a1 = a0 + (s.value / total) * TAU * prog;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath();
    g.fillStyle = hexA(s.color, p.selected?.i === i ? 1 : 0.85); g.fill();
    if (prog >= 1 && s.value / total > 0.05 && gdef.valueLabels !== false) {
      const mid = (a0 + a1) / 2, lr = R * 0.62;
      g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${Math.round((s.value / total) * 100)}%`, cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
    }
    const lo = a0, hi = a0 + (s.value / total) * TAU;
    hits.push({ i, kind: 'seg', test: (x, y) => { const r = Math.hypot(x - cx, y - cy); if (r > R || (gdef.kind === 'donut' && r < R * 0.56)) return false; let a = Math.atan2(y - cy, x - cx); while (a < -Math.PI / 2) a += TAU; return a >= lo && a < hi; } });
    a0 = a1;
  });
  if (gdef.kind === 'donut') {
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx, cy, R * 0.56, 0, TAU); g.fill(); g.restore();
    g.fillStyle = theme.textSoft; g.font = '12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(round(total)), cx, cy);
  }
  legend(g, segments, theme, W, H);
  return { hits, animating: prog < 1 };
}

/* ---------- polar area ---------- */

function polar(g, p, hits, prog) {
  const { segments, theme, W, H } = p;
  const cx = W / 2, cy = H / 2, Rmax = Math.min(W, H) / 2 - 20;
  const maxV = Math.max(1, ...segments.map(s => s.value));
  const slice = TAU / segments.length;
  segments.forEach((s, i) => {
    const a0 = -Math.PI / 2 + i * slice, a1 = a0 + slice;
    const R = (s.value / maxV) * Rmax * prog;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath();
    g.fillStyle = hexA(s.color, p.selected?.i === i ? 0.95 : 0.7); g.fill();
    g.strokeStyle = theme.border; g.globalAlpha = 0.4; g.stroke(); g.globalAlpha = 1;
    hits.push({ i, kind: 'seg', test: (x, y) => { const r = Math.hypot(x - cx, y - cy); if (r > R) return false; let a = Math.atan2(y - cy, x - cx); while (a < -Math.PI / 2) a += TAU; return a >= a0 + Math.PI / 2 + i * 0 && a < a1; } });
  });
  legend(g, segments, theme, W, H);
  return { hits, animating: prog < 1 };
}

/* ---------- radar / spider ---------- */

function radar(g, p, hits, prog) {
  const { datasets, theme, W, H } = p;
  const axisLabels = datasets[0]?.points.map(pt => pt.label) || [];
  const A = axisLabels.length;
  if (A < 3) { g.fillStyle = theme.textSoft; g.textAlign = 'center'; g.fillText('Radar needs 3+ points per dataset', W / 2, H / 2); return { hits, animating: false }; }
  const cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 30;
  const maxV = Math.max(1, ...datasets.flatMap(d => d.points.map(pt => pt.y)));
  // rings + spokes
  g.strokeStyle = theme.border; g.globalAlpha = 0.5;
  for (let r = 1; r <= 3; r++) { g.beginPath(); for (let a = 0; a < A; a++) { const ang = -Math.PI / 2 + a * TAU / A, x = cx + Math.cos(ang) * R * r / 3, y = cy + Math.sin(ang) * R * r / 3; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.globalAlpha = 1;
  axisLabels.forEach((lab, a) => { const ang = -Math.PI / 2 + a * TAU / A; g.fillStyle = theme.textSoft; g.font = '9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, cx + Math.cos(ang) * (R + 12), cy + Math.sin(ang) * (R + 12)); });
  datasets.forEach((d) => {
    g.beginPath();
    d.points.forEach((pt, a) => { const ang = -Math.PI / 2 + a * TAU / A, rr = (pt.y / maxV) * R * prog, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fillStyle = hexA(d.color, 0.18); g.fill(); g.strokeStyle = d.color; g.lineWidth = 2; g.stroke();
  });
  legend(g, datasets, theme, W, H);
  return { hits, animating: prog < 1 };
}

/* ---------- gauge ---------- */

function gauge(g, p, hits, prog) {
  const { datasets, theme, gdef, W, H } = p;
  const val = datasets[0]?.now ?? 0;
  const min = gdef.gauge?.min ?? 0, max = gdef.gauge?.max ?? 100;
  const frac = Math.max(0, Math.min(1, (val - min) / ((max - min) || 1)));
  const cx = W / 2, cy = H * 0.72, R = Math.min(W / 2, H * 0.62) - 14;
  g.lineWidth = 16; g.lineCap = 'round';
  g.strokeStyle = theme.border; g.globalAlpha = 0.5; g.beginPath(); g.arc(cx, cy, R, Math.PI, TAU); g.stroke(); g.globalAlpha = 1;
  const col = frac < 0.34 ? theme.warn : frac < 0.67 ? theme.highlight : theme.success;
  g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * frac * prog); g.stroke();
  g.fillStyle = theme.textSoft; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = 'bold 24px system-ui'; g.fillText(String(round(val)), cx, cy);
  g.font = '10px system-ui'; g.fillText(`${round(min)} – ${round(max)}${gdef.yAxis?.unit ? ' ' + gdef.yAxis.unit : ''}`, cx, cy + 16);
  return { hits, animating: prog < 1 };
}

/* ---------- funnel / pyramid ---------- */

function funnel(g, p, hits, prog) { return stages(g, p, hits, prog, false); }
function pyramid(g, p, hits, prog) { return stages(g, p, hits, prog, true); }
function stages(g, p, hits, prog, pyr) {
  const { segments, theme, gdef, W, H } = p;
  const segs = pyr ? segments : [...segments].sort((a, b) => b.value - a.value);
  const maxV = Math.max(1, ...segs.map(s => s.value));
  const top = 16, bottom = H - 16, rows = segs.length, rh = (bottom - top) / rows * 0.86, gap = (bottom - top) / rows * 0.14;
  segs.forEach((s, i) => {
    const widthFrac = (pyr ? (i + 1) / rows : s.value / maxV) * prog;
    const w = widthFrac * (W - 40), y = top + i * (rh + gap), x = (W - w) / 2;
    g.fillStyle = hexA(s.color, p.selected?.i === i ? 1 : 0.82); g.beginPath(); g.roundRect(x, y, w, rh, 4); g.fill();
    g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (w > 50) g.fillText(`${s.label}: ${round(s.value)}`, W / 2, y + rh / 2);
    if (!pyr && i > 0 && gdef.valueLabels !== false) {
      const prev = segs[i - 1].value || 1; g.fillStyle = theme.textSoft; g.font = '9px system-ui';
      g.fillText(`${Math.round((s.value / prev) * 100)}%`, W / 2, y - gap / 2);
    }
    hits.push({ i, kind: 'seg', test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + rh });
  });
  return { hits, animating: prog < 1 };
}

/* ---------- pictogram ---------- */

function pictogram(g, p, hits) {
  const { segments, theme, W } = p;
  g.textBaseline = 'middle'; g.font = '18px system-ui';
  let y = 22;
  const per = 1;
  segments.forEach((s, i) => {
    const count = Math.round(s.value / per);
    g.fillStyle = theme.textSoft; g.textAlign = 'left'; g.font = '11px system-ui';
    g.fillText(`${s.label} (${round(s.value)})`, 8, y - 12);
    g.fillStyle = s.color; g.font = '16px system-ui';
    let x = 8;
    for (let k = 0; k < Math.min(count, 40); k++) { g.fillText('●', x, y + 4); x += 16; if (x > W - 18) { x = 8; y += 18; } }
    y += 34;
  });
  return { hits, animating: false };
}

/* ---------- venn (2–3 sets) ---------- */

function venn(g, p, hits, prog) {
  const { segments, theme, W, H } = p;
  const segs = segments.slice(0, 3);
  const maxV = Math.max(1, ...segs.map(s => s.value));
  const cx = W / 2, cy = H / 2, base = Math.min(W, H) / 4;
  const layout = segs.length === 2 ? [[-base * 0.5, 0], [base * 0.5, 0]] : [[0, -base * 0.5], [-base * 0.5, base * 0.4], [base * 0.5, base * 0.4]];
  segs.forEach((s, i) => {
    const r = (0.5 + 0.5 * s.value / maxV) * base * prog;
    g.beginPath(); g.arc(cx + layout[i][0], cy + layout[i][1], r, 0, TAU); g.fillStyle = hexA(s.color, 0.4); g.fill();
    g.fillStyle = theme.textSoft; g.font = '10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${s.label} (${round(s.value)})`, cx + layout[i][0], cy + layout[i][1] - r - 6);
    hits.push({ i, kind: 'seg', test: (x, y) => Math.hypot(x - (cx + layout[i][0]), y - (cy + layout[i][1])) < r });
  });
  return { hits, animating: prog < 1 };
}

/* ---------- mekko (marimekko) ---------- */

function mekko(g, p, hits, prog) {
  const { segments, theme, W, H } = p;
  const total = Math.max(0.001, segments.reduce((a, s) => a + s.value, 0));
  const top = 14, bottom = H - 14, maxV = Math.max(1, ...segments.map(s => s.value));
  let x = 8;
  segments.forEach((s, i) => {
    const w = (s.value / total) * (W - 16) * prog, h = (s.value / maxV) * (bottom - top);
    g.fillStyle = hexA(s.color, p.selected?.i === i ? 1 : 0.8); g.beginPath(); g.roundRect(x, bottom - h, Math.max(1, w - 2), h, 3); g.fill();
    g.fillStyle = theme.textSoft; g.font = '9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'top';
    if (w > 24) g.fillText(s.label, x + w / 2, bottom + 1);
    hits.push({ i, kind: 'seg', test: (px, py) => px >= x && px <= x + w && py >= bottom - h && py <= bottom });
    x += w;
  });
  return { hits, animating: prog < 1 };
}

/* ---------- flower (Blossom special) ---------- */

function flower(g, p, hits, t) {
  const { segments, theme, gdef, W, H, big, reduced, selected } = p;
  const cx = W / 2, cy = H / 2 + 6, radius = Math.min(W, H) / 2 - (big ? 40 : 26);
  const maxV = Math.max(1, ...segments.map(s => s.value));
  const res = drawFlower(g, {
    cx, cy, radius,
    petals: segments.map((s, i) => ({ label: s.label, value01: s.value / maxV, color: s.color, lifted: selected?.i === i })),
    t, rotation: (gdef.rotationDeg || 0) * Math.PI / 180, theme, showLabels: W >= 480 || big, reducedMotion: reduced
  });
  res.petalHits.forEach((h, i) => hits.push({ i, kind: 'seg', test: (x, y) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r > h.maxR + 4 || r < 6) return false; let da = Math.atan2(dy, dx) - h.angle; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; return Math.abs(da) < h.halfWidth; } }));
  return { hits, animating: !reduced };
}

/* ---------- solar system (Blossom special) ---------- */

function solar(g, p, hits, t) {
  const { segments, theme, W, H, reduced } = p;
  const cx = W / 2, cy = H / 2;
  const maxV = Math.max(1, ...segments.map(s => s.value));
  // sun
  g.beginPath(); g.arc(cx, cy, 12, 0, TAU); g.fillStyle = theme.highlight; g.fill();
  segments.forEach((s, i) => {
    const orbit = 28 + (i + 1) * (Math.min(W, H) / 2 - 36) / (segments.length + 0.5);
    g.strokeStyle = theme.border; g.globalAlpha = 0.4; g.beginPath(); g.arc(cx, cy, orbit, 0, TAU); g.stroke(); g.globalAlpha = 1;
    const ang = (reduced ? 0 : t * 0.3) * (1 + i * 0.2) + i * 1.7;
    const x = cx + Math.cos(ang) * orbit, y = cy + Math.sin(ang) * orbit;
    const r = 4 + (s.value / maxV) * 14;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = s.color; g.fill();
    g.fillStyle = theme.textSoft; g.font = '9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(`${s.label} ${round(s.value)}`, x, y - r - 2);
    hits.push({ i, kind: 'seg', test: (px, py) => Math.hypot(px - x, py - y) < r + 4 });
  });
  return { hits, animating: !reduced };
}
